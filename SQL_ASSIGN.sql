-- ═══════════════════════════════════════════════════════════════
-- SQL_ASSIGN.sql — Asignación de comerciales a prospectos
-- Ejecuta en Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_assigned_to ON public.contacts(assigned_to);
