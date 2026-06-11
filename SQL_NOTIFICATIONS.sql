-- ═══════════════════════════════════════════════════════════════
-- SQL_NOTIFICATIONS.sql — Sistema de notificaciones persistentes
-- Ejecuta en Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Tabla de notificaciones ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id                UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id           UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type              TEXT        NOT NULL,
  -- followup_due | demo_reminder | auto_reply | user_registered
  title             TEXT        NOT NULL,
  body              TEXT,
  entity_id         UUID,        -- contact_id o user_id según el tipo
  entity_name       TEXT,        -- nombre para mostrar sin joins
  notification_date DATE        NOT NULL DEFAULT CURRENT_DATE,
  read_at           TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW(),

  -- Evita duplicar la misma notificación del mismo día para el mismo objeto
  UNIQUE (user_id, type, entity_id, notification_date)
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notif_select" ON public.notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "notif_update" ON public.notifications
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "notif_delete" ON public.notifications
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_notif_user_unread
  ON public.notifications(user_id, read_at)
  WHERE read_at IS NULL;

-- ── 2. Trigger: nueva respuesta IMAP auto-detectada ──────────
CREATE OR REPLACE FUNCTION public.fn_notify_auto_reply()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company  TEXT;
  v_assigned UUID;
  admin_ids  UUID[];
BEGIN
  SELECT company, assigned_to INTO v_company, v_assigned
  FROM contacts WHERE id = NEW.contact_id;

  SELECT ARRAY(SELECT user_id FROM user_profiles WHERE role = 'admin' AND is_active = true)
  INTO admin_ids;

  -- Notificar admins
  INSERT INTO notifications (user_id, type, title, body, entity_id, entity_name)
  SELECT u, 'auto_reply',
    '📥 Nueva respuesta automática',
    'El prospecto ' || v_company || ' ha respondido. Actualizado automáticamente por el bot.',
    NEW.contact_id, v_company
  FROM unnest(admin_ids) u
  ON CONFLICT (user_id, type, entity_id, notification_date) DO NOTHING;

  -- Notificar comercial asignado (si no es admin)
  IF v_assigned IS NOT NULL AND NOT (v_assigned = ANY(admin_ids)) THEN
    INSERT INTO notifications (user_id, type, title, body, entity_id, entity_name)
    VALUES (
      v_assigned, 'auto_reply',
      '📥 Nueva respuesta automática',
      'El prospecto ' || v_company || ' ha respondido. Actualizado automáticamente por el bot.',
      NEW.contact_id, v_company
    ) ON CONFLICT (user_id, type, entity_id, notification_date) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_auto_reply ON public.interactions;
CREATE TRIGGER trg_notify_auto_reply
  AFTER INSERT ON public.interactions
  FOR EACH ROW
  WHEN (NEW.auto_detected = true)
  EXECUTE FUNCTION public.fn_notify_auto_reply();

-- ── 3. Trigger: nuevo usuario registrado (solo admins) ────────
CREATE OR REPLACE FUNCTION public.fn_notify_user_registered()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO notifications (user_id, type, title, body, entity_id, entity_name)
  SELECT
    up.user_id, 'user_registered',
    '👤 Nuevo usuario registrado',
    COALESCE(NEW.name, NEW.email) || ' se ha unido al CRM con rol ' || NEW.role || '.',
    NEW.user_id,
    COALESCE(NEW.name, NEW.email)
  FROM user_profiles up
  WHERE up.role = 'admin' AND up.is_active = true AND up.user_id != NEW.user_id
  ON CONFLICT (user_id, type, entity_id, notification_date) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_user_registered ON public.user_profiles;
CREATE TRIGGER trg_notify_user_registered
  AFTER INSERT ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_notify_user_registered();

-- ── 4. Función para notificaciones diarias (pg_cron) ──────────
CREATE OR REPLACE FUNCTION public.fn_generate_daily_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r         RECORD;
  admin_ids UUID[];
BEGIN
  SELECT ARRAY(SELECT user_id FROM user_profiles WHERE role = 'admin' AND is_active = true)
  INTO admin_ids;

  -- ── Seguimiento pendiente (next_followup = hoy) ─────────────
  FOR r IN
    SELECT id, company, assigned_to
    FROM contacts
    WHERE next_followup::date = CURRENT_DATE
      AND type = 'prospect'
  LOOP
    INSERT INTO notifications (user_id, type, title, body, entity_id, entity_name, notification_date)
    SELECT u, 'followup_due',
      '⏰ Seguimiento pendiente hoy',
      'Debes hacer seguimiento a ' || r.company || ' hoy.',
      r.id, r.company, CURRENT_DATE
    FROM unnest(admin_ids) u
    ON CONFLICT (user_id, type, entity_id, notification_date) DO NOTHING;

    IF r.assigned_to IS NOT NULL AND NOT (r.assigned_to = ANY(admin_ids)) THEN
      INSERT INTO notifications (user_id, type, title, body, entity_id, entity_name, notification_date)
      VALUES (r.assigned_to, 'followup_due',
        '⏰ Seguimiento pendiente hoy',
        'Debes hacer seguimiento a ' || r.company || ' hoy.',
        r.id, r.company, CURRENT_DATE)
      ON CONFLICT (user_id, type, entity_id, notification_date) DO NOTHING;
    END IF;
  END LOOP;

  -- ── Demo: recordatorio 1 y 2 días antes ─────────────────────
  FOR r IN
    SELECT id, company, assigned_to, demo_date
    FROM contacts
    WHERE demo_date::date IN (CURRENT_DATE + 1, CURRENT_DATE + 2)
  LOOP
    INSERT INTO notifications (user_id, type, title, body, entity_id, entity_name, notification_date)
    SELECT u, 'demo_reminder',
      '📅 Reconfirmar DEMO — ' || to_char(r.demo_date::date, 'DD/MM'),
      'Envía la reconfirmación de la DEMO a ' || r.company || ' (demo el ' || to_char(r.demo_date::date, 'DD/MM/YYYY') || ').',
      r.id, r.company, CURRENT_DATE
    FROM unnest(admin_ids) u
    ON CONFLICT (user_id, type, entity_id, notification_date) DO NOTHING;

    IF r.assigned_to IS NOT NULL AND NOT (r.assigned_to = ANY(admin_ids)) THEN
      INSERT INTO notifications (user_id, type, title, body, entity_id, entity_name, notification_date)
      VALUES (r.assigned_to, 'demo_reminder',
        '📅 Reconfirmar DEMO — ' || to_char(r.demo_date::date, 'DD/MM'),
        'Envía la reconfirmación de la DEMO a ' || r.company || ' (demo el ' || to_char(r.demo_date::date, 'DD/MM/YYYY') || ').',
        r.id, r.company, CURRENT_DATE)
      ON CONFLICT (user_id, type, entity_id, notification_date) DO NOTHING;
    END IF;
  END LOOP;
END;
$$;

-- ── 5. Programar notificaciones diarias a las 07:00 UTC ───────
-- (09:00 España verano / 08:00 invierno)
SELECT cron.schedule(
  'daily-notifications',
  '0 7 * * 1-5',
  $$ SELECT public.fn_generate_daily_notifications(); $$
);

-- ── 6. Refrescar caché ────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
