-- ═══════════════════════════════════════════════════════════════
-- SQL_EMAIL_ACCOUNTS.sql — Integración IMAP (captura automática de respuestas)
-- Ejecuta en Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Columnas en interactions para rastrear emails auto-detectados ──
ALTER TABLE public.interactions
  ADD COLUMN IF NOT EXISTS message_id    TEXT,
  ADD COLUMN IF NOT EXISTS auto_detected BOOLEAN DEFAULT false;

-- Índice único para deduplicar por Message-ID (evita importar el mismo email dos veces)
CREATE UNIQUE INDEX IF NOT EXISTS idx_interactions_message_id
  ON public.interactions(message_id)
  WHERE message_id IS NOT NULL;

-- ── 2. Tabla de cuentas de correo IMAP ────────────────────────
CREATE TABLE IF NOT EXISTS public.email_accounts (
  id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  display_name     TEXT        NOT NULL,
  email            TEXT        NOT NULL,
  imap_host        TEXT        NOT NULL DEFAULT 'imap.hostinger.com',
  imap_port        INTEGER     NOT NULL DEFAULT 993,
  imap_secure      BOOLEAN     NOT NULL DEFAULT true,
  password         TEXT        NOT NULL,
  last_uid_checked BIGINT               DEFAULT 0,
  last_check_at    TIMESTAMPTZ,
  last_error       TEXT,
  is_active        BOOLEAN     NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ          DEFAULT NOW()
);

ALTER TABLE public.email_accounts ENABLE ROW LEVEL SECURITY;

-- Solo admins pueden gestionar las cuentas de correo
CREATE POLICY "ea_admin_all" ON public.email_accounts
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_id = auth.uid() AND role = 'admin' AND is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_id = auth.uid() AND role = 'admin' AND is_active = true
    )
  );

-- ── 3. Refrescar caché de esquema PostgREST ───────────────────
NOTIFY pgrst, 'reload schema';

-- ═══════════════════════════════════════════════════════════════
-- PASO 4 — Configurar pg_cron para llamar a la Edge Function
-- ═══════════════════════════════════════════════════════════════
-- Reemplaza YOUR_PROJECT_REF y YOUR_SERVICE_ROLE_KEY con tus valores reales.
-- Los encuentras en: Supabase Dashboard → Settings → API
--
-- SELECT cron.schedule(
--   'check-inbox',
--   '*/10 * * * *',
--   $$
--   SELECT net.http_post(
--     url     := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/check-inbox',
--     headers := '{"Content-Type":"application/json","Authorization":"Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
--     body    := '{}'::jsonb
--   ) AS request_id;
--   $$
-- );
--
-- Para ver los jobs programados: SELECT * FROM cron.job;
-- Para eliminar este job:        SELECT cron.unschedule('check-inbox');
