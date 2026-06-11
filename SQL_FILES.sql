-- ═══════════════════════════════════════════════════════════════
-- SQL_FILES.sql — Archivos adjuntos por contacto
-- Ejecuta en Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- 1. Tabla de metadatos de archivos
CREATE TABLE IF NOT EXISTS public.contact_files (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id  UUID        NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  file_name   TEXT        NOT NULL,
  file_path   TEXT        NOT NULL,
  file_size   BIGINT,
  file_type   TEXT,
  uploaded_by UUID        REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.contact_files ENABLE ROW LEVEL SECURITY;

-- Todos los usuarios autenticados pueden ver archivos
CREATE POLICY "cf_select" ON public.contact_files
  FOR SELECT TO authenticated USING (true);

-- Solo admin y comercial pueden subir archivos
CREATE POLICY "cf_insert" ON public.contact_files
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_id = auth.uid() AND role IN ('admin','comercial') AND is_active = true
  ));

-- Solo quien subió el archivo o un admin puede borrarlo
CREATE POLICY "cf_delete" ON public.contact_files
  FOR DELETE TO authenticated
  USING (
    uploaded_by = auth.uid() OR
    EXISTS (SELECT 1 FROM public.user_profiles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- 2. Bucket de Storage privado (máx. 50 MB por archivo)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('contact-files', 'contact-files', false, 52428800)
ON CONFLICT (id) DO NOTHING;

-- 3. Políticas de Storage
CREATE POLICY "cf_storage_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'contact-files');

CREATE POLICY "cf_storage_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'contact-files');

CREATE POLICY "cf_storage_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'contact-files');
