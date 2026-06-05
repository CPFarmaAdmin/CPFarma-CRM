-- ═══════════════════════════════════════════════════════════════
-- SQL_USERS.sql — Tabla de perfiles y roles de usuario
-- Ejecutar en Supabase: Settings → SQL Editor → New query
-- ═══════════════════════════════════════════════════════════════

-- 1. CREAR TABLA user_profiles
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT,
  name        TEXT,
  role        TEXT        NOT NULL DEFAULT 'viewer'
                          CHECK (role IN ('admin', 'comercial', 'viewer')),
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  invited_by  UUID        REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- 2. ACTIVAR ROW LEVEL SECURITY
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- 3. POLÍTICAS RLS

-- Todos los usuarios autenticados pueden leer todos los perfiles
-- (necesario para que cada usuario conozca su propio rol)
CREATE POLICY "profiles_select_authenticated"
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- Un usuario puede insertar su propio perfil (primer login = bootstrap)
-- Un admin puede insertar perfiles para otros (flujo de invitación)
CREATE POLICY "profiles_insert"
  ON public.user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Solo admins pueden actualizar perfiles
CREATE POLICY "profiles_update_admin"
  ON public.user_profiles
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Solo admins pueden eliminar perfiles
CREATE POLICY "profiles_delete_admin"
  ON public.user_profiles
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- ═══════════════════════════════════════════════════════════════
-- NOTAS IMPORTANTES:
--
-- 1. PRIMER USUARIO = ADMIN AUTOMÁTICO
--    La primera persona que inicie sesión tras aplicar este cambio
--    se convertirá automáticamente en administrador (bootstrap).
--    A partir de ahí, el admin gestiona el resto desde el panel.
--
-- 2. USUARIOS EXISTENTES
--    Los usuarios que ya tenían acceso y hagan login se auto-crearán
--    como "comercial" (acceso completo excepto gestión de usuarios).
--    El admin puede cambiarles el rol desde el panel.
--
-- 3. CREAR USUARIOS DESDE EL CRM
--    Para que el admin pueda crear usuarios sin perder su sesión,
--    activa "Confirm email" en Supabase:
--    Authentication → Settings → Email Auth → Confirm email = ON
--
-- 4. DESHABILITAR REGISTRO PÚBLICO (recomendado)
--    Para evitar que cualquiera se registre, ve a:
--    Authentication → Settings → User Signups → "Disable sign ups" = ON
--    Así solo el admin puede crear usuarios desde el panel del CRM.
-- ═══════════════════════════════════════════════════════════════
