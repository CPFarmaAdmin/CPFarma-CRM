# SQL — Script completo para Supabase

Ve a **Supabase → SQL Editor → New query**, pega todo este bloque y ejecuta.
Todos los `ADD COLUMN IF NOT EXISTS` son seguros — no borra nada si la columna ya existe.

```sql
-- ════════════════════════════════════════════
-- TABLA: contacts — todas las columnas del CRM
-- ════════════════════════════════════════════

ALTER TABLE contacts
  -- Información básica
  ADD COLUMN IF NOT EXISTS program          TEXT,
  ADD COLUMN IF NOT EXISTS version          TEXT,
  ADD COLUMN IF NOT EXISTS notes            TEXT,

  -- Tipo y estado
  ADD COLUMN IF NOT EXISTS client_type      TEXT DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS client_status    TEXT DEFAULT 'ok',

  -- Emails adicionales
  ADD COLUMN IF NOT EXISTS email2           TEXT,
  ADD COLUMN IF NOT EXISTS email3           TEXT,

  -- Contacto informática (para clientes)
  ADD COLUMN IF NOT EXISTS it_name          TEXT,
  ADD COLUMN IF NOT EXISTS it_phone         TEXT,
  ADD COLUMN IF NOT EXISTS it_email         TEXT,

  -- Contacto gerencia / administración (para clientes)
  ADD COLUMN IF NOT EXISTS mgmt_name        TEXT,
  ADD COLUMN IF NOT EXISTS mgmt_phone       TEXT,
  ADD COLUMN IF NOT EXISTS mgmt_email       TEXT,

  -- Mantenimiento (para clientes)
  ADD COLUMN IF NOT EXISTS maintenance      TEXT,
  ADD COLUMN IF NOT EXISTS maintenance_date DATE,

  -- Seguimiento
  ADD COLUMN IF NOT EXISTS next_followup    DATE,
  ADD COLUMN IF NOT EXISTS followup_num     TEXT,
  ADD COLUMN IF NOT EXISTS followup_notes   TEXT,
  ADD COLUMN IF NOT EXISTS meeting_date     DATE,
  ADD COLUMN IF NOT EXISTS meeting_platform TEXT,

  -- Oportunidad comercial (para prospectos)
  ADD COLUMN IF NOT EXISTS deal_product     TEXT,
  ADD COLUMN IF NOT EXISTS deal_value       NUMERIC,
  ADD COLUMN IF NOT EXISTS deal_prob        INTEGER,
  ADD COLUMN IF NOT EXISTS deal_close       DATE,

  -- Email enviado
  ADD COLUMN IF NOT EXISTS email_to         TEXT,
  ADD COLUMN IF NOT EXISTS email_type       TEXT,
  ADD COLUMN IF NOT EXISTS sent_date        DATE,
  ADD COLUMN IF NOT EXISTS subject          TEXT,
  ADD COLUMN IF NOT EXISTS sent_text        TEXT,
  ADD COLUMN IF NOT EXISTS attachments      TEXT,

  -- Respuesta recibida
  ADD COLUMN IF NOT EXISTS reply_date       DATE,
  ADD COLUMN IF NOT EXISTS reply_from       TEXT,
  ADD COLUMN IF NOT EXISTS reply_text       TEXT;
```

> **Nota:** Las columnas `id`, `created_at`, `updated_at`, `company`, `contact`, `role`,
> `email`, `phone`, `city`, `country`, `type`, `status`, `priority`, `folder_id`,
> `user_id` y `tags` ya existen en el schema base de Supabase y no necesitan añadirse.

