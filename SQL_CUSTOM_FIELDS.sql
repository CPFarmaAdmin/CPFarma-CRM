-- ═══════════════════════════════════════════════════════════════
-- SQL_CUSTOM_FIELDS.sql — Campos personalizables y estados configurables
-- Ejecuta en Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Ampliar org_settings con columnas de configuración ─────
ALTER TABLE public.org_settings
  ADD COLUMN IF NOT EXISTS prospect_statuses JSONB,
  ADD COLUMN IF NOT EXISTS client_statuses   JSONB,
  ADD COLUMN IF NOT EXISTS field_labels      JSONB;

-- ── 2. Añadir columnas nuevas a contacts ──────────────────────
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS complejo  TEXT,
  ADD COLUMN IF NOT EXISTS province  TEXT,
  ADD COLUMN IF NOT EXISTS ccaa      TEXT,
  ADD COLUMN IF NOT EXISTS beds      INTEGER;

-- ── 3. Tabla de definiciones de campos custom ─────────────────
CREATE TABLE IF NOT EXISTS public.custom_field_defs (
  id          UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  applies_to  TEXT    NOT NULL CHECK (applies_to IN ('prospect','client','both')),
  field_key   TEXT    NOT NULL,
  label       TEXT    NOT NULL,
  field_type  TEXT    NOT NULL CHECK (field_type IN ('text','number','date','select','textarea','checkbox')),
  options     JSONB   DEFAULT '[]',
  position    INT     DEFAULT 0,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.custom_field_defs ENABLE ROW LEVEL SECURITY;

-- Todos los usuarios autenticados pueden leer (para renderizar los campos)
CREATE POLICY "cfd_read" ON public.custom_field_defs
  FOR SELECT TO authenticated USING (true);

-- Solo admins pueden crear/editar/borrar
CREATE POLICY "cfd_admin_write" ON public.custom_field_defs
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_id = auth.uid() AND role = 'admin' AND is_active = true
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_id = auth.uid() AND role = 'admin' AND is_active = true
  ));

-- ── 4. Refrescar caché PostgREST ──────────────────────────────
NOTIFY pgrst, 'reload schema';
