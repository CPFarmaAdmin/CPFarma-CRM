// deno-lint-ignore-file no-explicit-any
/**
 * check-inbox — Edge Function para captura automática de respuestas IMAP
 * v2: incluye cuerpo del email + deduplicación robusta sin Message-ID
 */
import { createClient }  from 'npm:@supabase/supabase-js@2';
import { ImapFlow }      from 'npm:imapflow@1';
import { simpleParser } from 'npm:mailparser@3';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

Deno.serve(async (req: Request) => {
  const auth    = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const svcKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const cronSec = Deno.env.get('CRON_SECRET') ?? '';

  if (auth !== svcKey && !(cronSec && auth === cronSec)) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const results = await checkAllInboxes();
    return new Response(
      JSON.stringify({ ok: true, results, ts: new Date().toISOString() }),
      { headers: { 'Content-Type': 'application/json' } },
    );
  } catch (err: any) {
    console.error('check-inbox fatal:', err);
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
});

async function checkAllInboxes(): Promise<any[]> {
  const { data: accounts, error } = await supabase
    .from('email_accounts').select('*').eq('is_active', true);
  if (error) throw new Error('DB accounts: ' + error.message);
  if (!accounts?.length) return [];

  const { data: contacts } = await supabase
    .from('contacts').select('id, email, email2, email3, it_email, mgmt_email');

  const emailMap = new Map<string, string>();
  for (const c of contacts ?? []) {
    for (const e of [c.email, c.email2, c.email3, c.it_email, c.mgmt_email]) {
      if (e?.trim()) emailMap.set(e.trim().toLowerCase(), c.id);
    }
  }

  const results: any[] = [];
  for (const acc of accounts) {
    try {
      const r = await processAccount(acc, emailMap);
      results.push({ email: acc.email, ...r });
    } catch (err: any) {
      console.error(`check-inbox [${acc.email}]:`, err);
      results.push({ email: acc.email, error: String(err) });
    }
  }
  return results;
}

async function processAccount(
  account: any,
  emailMap: Map<string, string>,
): Promise<{ processed: number; matched: number; error?: string }> {

  const imap = new ImapFlow({
    host:   account.imap_host,
    port:   account.imap_port ?? 993,
    secure: account.imap_secure !== false,
    auth:   { user: account.email, pass: account.password },
    logger: false,
    tls:    { rejectUnauthorized: false },
  });

  try {
    await imap.connect();
  } catch (err: any) {
    await supabase.from('email_accounts').update({
      last_error:    'Conexión fallida: ' + err.message,
      last_check_at: new Date().toISOString(),
    }).eq('id', account.id);
    return { processed: 0, matched: 0, error: 'connect: ' + err.message };
  }

  let processed = 0;
  let matched   = 0;
  let maxUid    = account.last_uid_checked ?? 0;

  try {
    const lock = await imap.getMailboxLock('INBOX');
    try {
      const since = new Date();
      if (account.last_check_at) {
        since.setTime(new Date(account.last_check_at).getTime());
        since.setDate(since.getDate() - 1);
      } else {
        since.setDate(since.getDate() - 7);
      }
      since.setHours(0, 0, 0, 0);

      const uids = (await imap.search({ since }, { uid: true })) as number[];
      if (!uids?.length) {
        await supabase.from('email_accounts').update({
          last_check_at: new Date().toISOString(),
          last_error:    null,
        }).eq('id', account.id);
        return { processed: 0, matched: 0 };
      }

      const batch = uids.slice(-200);

      // Fetch envelope + raw source for body extraction
      for await (const msg of imap.fetch(batch, { uid: true, envelope: true, source: true }, { uid: true })) {
        processed++;
        if ((msg.uid as number) > maxUid) maxUid = msg.uid as number;

        const env      = msg.envelope as any;
        const from     = env?.from?.[0];
        const fromAddr = from?.address?.toLowerCase()?.trim();
        if (!fromAddr) continue;

        const contactId = emailMap.get(fromAddr);
        if (!contactId) continue;

        const msgId: string | null = env?.messageId ?? null;
        const subject  = env?.subject ?? '(sin asunto)';
        const fromName = from?.name as string | undefined;
        const label    = fromName ? `${fromName} <${fromAddr}>` : fromAddr;
        const date     = env?.date
          ? new Date(env.date).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0];

        // ── Deduplicación primaria: por Message-ID ───────────────
        if (msgId) {
          const { data: dup } = await supabase
            .from('interactions').select('id').eq('message_id', msgId).maybeSingle();
          if (dup) continue;
        } else {
          // ── Deduplicación secundaria: mismo contacto+fecha+remitente ──
          const { data: dup } = await supabase
            .from('interactions').select('id')
            .eq('contact_id', contactId)
            .eq('date', date)
            .ilike('text', `%${fromAddr}%`)
            .limit(1).maybeSingle();
          if (dup) continue;
        }

        // ── Extraer cuerpo del email ─────────────────────────────
        let bodyText = '';
        if (msg.source) {
          try {
            const parsed = await simpleParser(msg.source as any);
            bodyText = (parsed.text ?? '').trim();

            // Cortar en el primer separador de cadena de respuesta
            const separators = [
              /^_{5,}/m,                          // Outlook: ___________
              /^-{5,}\s*(original message|mensaje original)/im,
              /^On\s.+\swrote:/m,                 // Gmail/Apple: On <date>, <name> wrote:
              /^El\s.+escribió:/m,                // Thunderbird ES
              /^Am\s.+schrieb:/m,                 // Thunderbird DE
              /^Le\s.+a écrit\s*:/m,              // Thunderbird FR
            ];
            let cutAt = bodyText.length;
            for (const sep of separators) {
              const m = bodyText.match(sep);
              if (m?.index !== undefined && m.index < cutAt) cutAt = m.index;
            }
            bodyText = bodyText.slice(0, cutAt).trim();

            // Quitar líneas de cita estilo "> " (Gmail inline quotes residuales)
            bodyText = bodyText
              .split('\n')
              .filter((line: string) => !line.trimStart().startsWith('>'))
              .join('\n')
              .replace(/\n{3,}/g, '\n\n')
              .trim();

            if (bodyText.length > 2000) bodyText = bodyText.slice(0, 2000) + '…';
          } catch (_) { /* si falla el parse, solo usamos asunto */ }
        }

        const text = bodyText
          ? `De: ${label}\nAsunto: ${subject}\n\n${bodyText}`
          : `Respuesta de ${label}\nAsunto: ${subject}`;

        const { error: insErr } = await supabase.from('interactions').insert({
          contact_id:    contactId,
          type:          'reply',
          date,
          text,
          message_id:    msgId,
          auto_detected: true,
        });

        if (!insErr) matched++;
      }

      await supabase.from('email_accounts').update({
        last_uid_checked: maxUid,
        last_check_at:    new Date().toISOString(),
        last_error:       null,
      }).eq('id', account.id);

    } finally {
      lock.release();
    }
  } catch (err: any) {
    await supabase.from('email_accounts').update({
      last_error:    err.message,
      last_check_at: new Date().toISOString(),
    }).eq('id', account.id);
    return { processed, matched, error: err.message };
  } finally {
    try { await imap.logout(); } catch (_) { /* ignore */ }
  }

  return { processed, matched };
}
