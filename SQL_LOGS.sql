-- ═══════════════════════════════════════════════════════════════
-- SQL_LOGS.sql — Logs de actividad + configuración de entidad
-- Ejecutar en Supabase: SQL Editor → New query
-- ═══════════════════════════════════════════════════════════════

-- ── 1. ORG SETTINGS (una fila por entidad) ────────────────────

CREATE TABLE IF NOT EXISTS public.org_settings (
  id         INTEGER     PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  name       TEXT        NOT NULL DEFAULT 'Mi Empresa',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insertar fila inicial con el nombre actual
INSERT INTO public.org_settings (id, name)
VALUES (1, 'CP Farma')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.org_settings ENABLE ROW LEVEL SECURITY;

-- Todos los usuarios autenticados pueden leer el nombre
CREATE POLICY "org_read" ON public.org_settings
  FOR SELECT TO authenticated USING (true);

-- Solo admins pueden actualizar
CREATE POLICY "org_update_admin" ON public.org_settings
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_id = auth.uid() AND role = 'admin'
  ));


-- ── 2. ACTIVITY LOGS ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.activity_logs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email  TEXT,
  action      TEXT        NOT NULL,
  entity_type TEXT,
  entity_id   UUID,
  entity_name TEXT,
  details     JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_logs_created ON public.activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_user    ON public.activity_logs(user_id);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Cualquier usuario autenticado puede insertar SUS PROPIOS logs
CREATE POLICY "logs_insert" ON public.activity_logs
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Solo admins pueden leer todos los logs
CREATE POLICY "logs_admin_read" ON public.activity_logs
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_id = auth.uid() AND role = 'admin'
  ));
