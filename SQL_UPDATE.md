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
