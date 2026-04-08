# SQL — Ejecutar en Supabase para actualizar la base de datos

Ve a **Supabase → SQL Editor → New query** y ejecuta esto:

```sql
-- Añadir columnas nuevas a la tabla contacts
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS program       TEXT,
  ADD COLUMN IF NOT EXISTS version       TEXT,
  ADD COLUMN IF NOT EXISTS client_type   TEXT DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS client_status TEXT DEFAULT 'ok',
  ADD COLUMN IF NOT EXISTS attachments   TEXT;

-- Si ya tienes datos, estos campos aparecerán vacíos hasta que los rellenes
-- No se borra nada existente
```

Eso es todo. Ejecuta el SQL, recarga la web, y ya funciona.

---

## SQL v5 — Ejecutar también este bloque (nuevas columnas)

```sql
-- Añadir email2, email3 y notes a contacts
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS email2  TEXT,
  ADD COLUMN IF NOT EXISTS email3  TEXT,
  ADD COLUMN IF NOT EXISTS notes   TEXT;
```

---

## SQL v9 — Nuevos campos para clientes

Ejecuta en Supabase SQL Editor:

```sql
-- Contactos de farmacia (3 personas)
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS ph1_name  TEXT,
  ADD COLUMN IF NOT EXISTS ph1_phone TEXT,
  ADD COLUMN IF NOT EXISTS ph1_email TEXT,
  ADD COLUMN IF NOT EXISTS ph2_name  TEXT,
  ADD COLUMN IF NOT EXISTS ph2_phone TEXT,
  ADD COLUMN IF NOT EXISTS ph2_email TEXT,
  ADD COLUMN IF NOT EXISTS ph3_name  TEXT,
  ADD COLUMN IF NOT EXISTS ph3_phone TEXT,
  ADD COLUMN IF NOT EXISTS ph3_email TEXT,
  -- Contacto informática
  ADD COLUMN IF NOT EXISTS it_name   TEXT,
  ADD COLUMN IF NOT EXISTS it_phone  TEXT,
  ADD COLUMN IF NOT EXISTS it_email  TEXT,
  -- Contacto gerencia
  ADD COLUMN IF NOT EXISTS mgmt_name  TEXT,
  ADD COLUMN IF NOT EXISTS mgmt_phone TEXT,
  ADD COLUMN IF NOT EXISTS mgmt_email TEXT,
  -- Mantenimiento
  ADD COLUMN IF NOT EXISTS maintenance      TEXT,
  ADD COLUMN IF NOT EXISTS maintenance_date DATE,
  -- Enviado a (destinatario del email)
  ADD COLUMN IF NOT EXISTS email_to TEXT;
```

---

## SQL v9 — Nuevas columnas para clientes y campos de email

```sql
-- Contactos de farmacia (hasta 3)
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS ph1_name   TEXT,
  ADD COLUMN IF NOT EXISTS ph1_phone  TEXT,
  ADD COLUMN IF NOT EXISTS ph1_email  TEXT,
  ADD COLUMN IF NOT EXISTS ph2_name   TEXT,
  ADD COLUMN IF NOT EXISTS ph2_phone  TEXT,
  ADD COLUMN IF NOT EXISTS ph2_email  TEXT,
  ADD COLUMN IF NOT EXISTS ph3_name   TEXT,
  ADD COLUMN IF NOT EXISTS ph3_phone  TEXT,
  ADD COLUMN IF NOT EXISTS ph3_email  TEXT;

-- Contacto informática
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS it_name    TEXT,
  ADD COLUMN IF NOT EXISTS it_phone   TEXT,
  ADD COLUMN IF NOT EXISTS it_email   TEXT;

-- Contacto gerencia
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS mgmt_name  TEXT,
  ADD COLUMN IF NOT EXISTS mgmt_phone TEXT,
  ADD COLUMN IF NOT EXISTS mgmt_email TEXT;

-- Mantenimiento
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS maintenance       TEXT,
  ADD COLUMN IF NOT EXISTS maintenance_date  DATE;

-- Email enviado a (destinatario específico)
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS email_to   TEXT;
```
