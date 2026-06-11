// deno-lint-ignore-file no-explicit-any
/**
 * check-inbox — Edge Function para captura automática de respuestas IMAP
 *
 * Invocada cada 10 minutos vía pg_cron + pg_net.
 * Para cada cuenta activa en email_accounts:
 *   1. Conecta por IMAP y busca emails recientes
 *   2. Si el remitente coincide con un contacto del CRM, crea una interacción tipo 'reply'
 *   3. Usa message_id para evitar duplicados
 *   4. Actualiza last_check_at y last_uid_checked
 *
 * Secrets necesarios (supabase secrets set ...):
 *   SUPABASE_URL              — automático en Edge Functions
 *   SUPABASE_SERVICE_ROLE_KEY — automático en Edge Functions
 *   CRON_SECRET               — opcional, token adicional para pg_cron
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { ImapFlow }     from 'npm:imapflow@1';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

Deno.serve(async (req: Request) => {
  // ── Auth: acepta service role key o CRON_SECRET ──────────────
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

// ── Main orchestrator ─────────────────────────────────────────

async function checkAllInboxes(): Promise<any[]> {
  const { data: accounts, error } = await supabase
    .from('email_accounts').select('*').eq('is_active', true);
  if (error) throw new Error('DB accounts: ' + error.message);
  if (!accounts?.length) return [];

  // Build email → contact_id map once (shared across all IMAP accounts)
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

// ── Per-account IMAP processor ────────────────────────────────

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

  // ── Connect ───────────────────────────────────────────────────
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
      // ── Determine search window ─────────────────────────────
      const since = new Date();
      if (account.last_check_at) {
        // Go back to start of day before last check (catches emails in transit)
        since.setTime(new Date(account.last_check_at).getTime());
        since.setDate(since.getDate() - 1);
      } else {
        since.setDate(since.getDate() - 7); // First run: last 7 days
      }
      since.setHours(0, 0, 0, 0);

      // ── Search for UIDs in window ───────────────────────────
      const uids = (await imap.search({ since }, { uid: true })) as number[];
      if (!uids?.length) {
        await supabase.from('email_accounts').update({
          last_check_at: new Date().toISOString(),
          last_error:    null,
        }).eq('id', account.id);
        return { processed: 0, matched: 0 };
      }

      // Process at most 200 per run to stay within Edge Function timeout
      const batch = uids.slice(-200);

      // ── Fetch envelopes ─────────────────────────────────────
      for await (const msg of imap.fetch(batch, { uid: true, envelope: true }, { uid: true })) {
        processed++;
        if ((msg.uid as number) > maxUid) maxUid = msg.uid as number;

        const env  = msg.envelope as any;
        const from = env?.from?.[0];
        const fromAddr = from?.address?.toLowerCase()?.trim();
        if (!fromAddr) continue;

        const contactId = emailMap.get(fromAddr);
        if (!contactId) continue;

        const msgId: string | null = env?.messageId ?? null;

        // ── Deduplicate by Message-ID ─────────────────────────
        if (msgId) {
          const { data: dup } = await supabase
            .from('interactions').select('id').eq('message_id', msgId).maybeSingle();
          if (dup) continue;
        }

        // ── Create interaction ────────────────────────────────
        const subject = env?.subject ?? '(sin asunto)';
        const name    = from?.name as string | undefined;
        const label   = name ? `${name} <${fromAddr}>` : fromAddr;
        const date    = env?.date
          ? new Date(env.date).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0];

        const { error: insErr } = await supabase.from('interactions').insert({
          contact_id:    contactId,
          type:          'reply',
          date,
          text:          `Respuesta de ${label}\nAsunto: ${subject}`,
          message_id:    msgId,
          auto_detected: true,
        });

        if (!insErr) matched++;
      }

      // ── Update watermark ────────────────────────────────────
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
