# 🚀 GUÍA DE CONFIGURACIÓN — CP Farma CRM

Sigue estos pasos **en orden**. Tardas unos 20 minutos en total.

---

## PASO 1 — Crear cuenta en Supabase

1. Ve a **https://supabase.com** y haz clic en **Start your project**
2. Regístrate con tu cuenta de GitHub o con email
3. Haz clic en **New project**
4. Rellena:
   - **Name:** `cpfarma-crm`
   - **Database Password:** elige una contraseña segura (guárdala)
   - **Region:** `West EU (Ireland)` — la más cercana a España
5. Haz clic en **Create new project**
6. Espera 2-3 minutos mientras se crea el proyecto

---

## PASO 2 — Crear las tablas en la base de datos

1. En el panel de Supabase, ve a **SQL Editor** (icono del terminal en el sidebar izquierdo)
2. Haz clic en **New query**
3. **Copia y pega TODO el siguiente SQL** y haz clic en **Run**:

```sql
-- ═══════════════════════════════════════════════════════════════
-- CP FARMA CRM — ESQUEMA DE BASE DE DATOS
-- ═══════════════════════════════════════════════════════════════

-- CARPETAS
CREATE TABLE IF NOT EXISTS folders (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT NOT NULL,
  icon        TEXT DEFAULT '📁',
  position    INT  DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- CONTACTOS
CREATE TABLE IF NOT EXISTS contacts (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company           TEXT NOT NULL,
  contact           TEXT,
  role              TEXT,
  email             TEXT,
  phone             TEXT,
  country           TEXT,
  city              TEXT,
  sector            TEXT,
  type              TEXT DEFAULT 'prospect',   -- prospect, client, partner, lost
  priority          TEXT DEFAULT 'Media',       -- Alta, Media, Baja
  status            TEXT DEFAULT 'new',         -- new, sent, replied, waiting, negotiation, won, lost
  tags              TEXT[] DEFAULT '{}',
  folder_id         UUID REFERENCES folders(id) ON DELETE SET NULL,

  -- Email tracking
  email_type        TEXT,
  sent_date         DATE,
  subject           TEXT,
  sent_text         TEXT,
  reply_date        DATE,
  reply_from        TEXT,
  reply_text        TEXT,

  -- Follow-up & meetings
  followup_num      TEXT,
  next_followup     DATE,
  meeting_date      DATE,
  meeting_platform  TEXT,
  followup_notes    TEXT,

  -- Deal / opportunity
  deal_product      TEXT,
  deal_value        NUMERIC,
  deal_prob         INT,
  deal_close        DATE,

  -- Links
  linkedin          TEXT,
  url               TEXT,

  -- Meta
  user_id           UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- INTERACCIONES (historial de notas por contacto)
CREATE TABLE IF NOT EXISTS interactions (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id  UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  type        TEXT NOT NULL DEFAULT 'comment',  -- comment, reply, followup, sent, call, meeting
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  text        TEXT NOT NULL,
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- PLANTILLAS DE EMAIL
CREATE TABLE IF NOT EXISTS templates (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT NOT NULL,
  subject     TEXT,
  body        TEXT,
  position    INT  DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- CONFIGURACIÓN POR USUARIO
CREATE TABLE IF NOT EXISTS user_settings (
  user_id     UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  settings    JSONB DEFAULT '{}'
);

-- ── ÍNDICES para rendimiento ──────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_contacts_folder    ON contacts(folder_id);
CREATE INDEX IF NOT EXISTS idx_contacts_status    ON contacts(status);
CREATE INDEX IF NOT EXISTS idx_contacts_followup  ON contacts(next_followup);
CREATE INDEX IF NOT EXISTS idx_interactions_contact ON interactions(contact_id);

-- ── DATOS INICIALES ───────────────────────────────────────────

-- Carpetas por defecto
INSERT INTO folders (name, icon, position) VALUES
  ('Prospectos',  '🎯', 1),
  ('Clientes',    '💼', 2),
  ('Hospitales',  '🏥', 3),
  ('USA',         '🇺🇸', 4),
  ('Europa',      '🌎', 5)
ON CONFLICT DO NOTHING;

-- Plantillas por defecto
INSERT INTO templates (name, subject, body, position) VALUES
  (
    'Primer contacto',
    'Presentación CP Farma — Soluciones farmacéuticas',
    E'Estimado/a [Name],\n\nMe pongo en contacto con usted para presentarle CP Farma, empresa especializada en soluciones farmacéuticas de alta calidad.\n\nNos gustaría explorar posibles sinergias y ver cómo podríamos colaborar con su empresa.\n\n¿Estaría disponible para una breve llamada esta semana?\n\nQuedo a su disposición para cualquier consulta.\n\nSaludos cordiales,\nCP Farma',
    1
  ),
  (
    'Follow-up 1',
    'Seguimiento — CP Farma',
    E'Estimado/a [Name],\n\nQuería hacer un breve seguimiento de mi email anterior sobre CP Farma.\n\nEntiendo que está muy ocupado/a, por lo que seré breve: ¿ha tenido oportunidad de revisar nuestra propuesta?\n\nQuedo a su disposición.\n\nSaludos,\nCP Farma',
    2
  ),
  (
    'Follow-up 2',
    'Última oportunidad de colaboración — CP Farma',
    E'Estimado/a [Name],\n\nLe envío este último mensaje para no ser intrusivo.\n\nSi en algún momento le interesa conocer más sobre nuestras soluciones, estamos a su disposición.\n\nMuchas gracias por su tiempo.\n\nSaludos,\nCP Farma',
    3
  )
ON CONFLICT DO NOTHING;
```

4. Verás el mensaje **Success. No rows returned** — es correcto.

---

## PASO 3 — Configurar Row Level Security (RLS)

Esto garantiza que cada usuario solo vea sus datos. En el mismo SQL Editor, crea una **nueva query** y ejecuta:

```sql
-- Activar RLS en todas las tablas
ALTER TABLE folders     ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates   ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- POLÍTICA: usuarios autenticados pueden ver y editar todo
-- (para un equipo pequeño esto es suficiente)

CREATE POLICY "Authenticated users full access" ON folders
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users full access" ON contacts
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users full access" ON interactions
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users full access" ON templates
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Own settings" ON user_settings
  FOR ALL USING (auth.uid() = user_id);
```

---

## PASO 4 — Crear los usuarios del equipo

1. En Supabase, ve a **Authentication** → **Users**
2. Haz clic en **Add user** → **Create new user**
3. Añade los emails y contraseñas de cada persona del equipo:
   - `sergio@cpfarma.es` → contraseña segura
   - Añade más usuarios si necesitáis
4. **NO actives "Send confirmation email"** — los usuarios pueden entrar directamente

---

## PASO 5 — Obtener las credenciales de la API

1. Ve a **Settings** (engranaje en el sidebar) → **API**
2. Copia estos dos valores:
   - **Project URL** → algo como `https://abcdefghij.supabase.co`
   - **anon public** key → una clave larga que empieza por `eyJ...`

---

## PASO 6 — Conectar el CRM con Supabase

Abre el archivo `js/config.js` y sustituye los valores:

```javascript
const SUPABASE_URL  = 'https://TU_PROYECTO.supabase.co';  // ← tu Project URL
const SUPABASE_ANON = 'eyJ...TU_ANON_KEY...';             // ← tu anon public key
```

Guarda el archivo.

---

## PASO 7 — Subir a GitHub y publicar con GitHub Pages

```bash
# En tu terminal, dentro de la carpeta cpfarma-crm:
git init
git add .
git commit -m "CP Farma CRM v2.0"
git remote add origin https://github.com/sergiogarbayo-svg/outreachdesk.git
git push -u origin main
```

Luego en GitHub:
1. Ve a tu repositorio → **Settings** → **Pages**
2. En **Source** selecciona **Deploy from a branch**
3. Elige **main** y la carpeta **/ (root)**
4. Haz clic en **Save**

En 1-2 minutos la web estará disponible en:
`https://sergiogarbayo-svg.github.io/outreachdesk/`

---

## PASO 8 — Probar que todo funciona

1. Abre la URL de GitHub Pages
2. Entra con el email y contraseña que creaste en el Paso 4
3. Deberías ver las 5 carpetas y las 3 plantillas que se crearon automáticamente
4. Crea un contacto de prueba y comprueba que aparece

---

## ✅ Checklist final

- [ ] Cuenta Supabase creada
- [ ] Tablas creadas (Paso 2)
- [ ] RLS configurado (Paso 3)
- [ ] Usuarios creados (Paso 4)
- [ ] Credenciales copiadas en config.js (Paso 5-6)
- [ ] Subido a GitHub (Paso 7)
- [ ] GitHub Pages activado (Paso 7)
- [ ] Login funciona (Paso 8)

---

## ❓ Problemas frecuentes

**"Error al cargar los datos"**
→ Revisa que SUPABASE_URL y SUPABASE_ANON en config.js son correctos.

**"Email o contraseña incorrectos"**
→ Asegúrate de haber creado el usuario en Authentication → Users.

**La web no carga**
→ Comprueba que el archivo `index.html` está en la raíz del repositorio (no dentro de una carpeta).

**Los cambios de un usuario no se ven en otro**
→ La sincronización en tiempo real está activada. Si no funciona, recarga la página (F5).

---

## 📌 Estructura de archivos

```
cpfarma-crm/
├── index.html          ← Página principal
├── css/
│   └── styles.css      ← Todos los estilos
├── js/
│   ├── config.js       ← ⚠️ TUS CREDENCIALES VAN AQUÍ
│   ├── db.js           ← Todas las llamadas a Supabase
│   ├── auth.js         ← Login / logout
│   ├── app.js          ← Lógica principal, tabla, filtros
│   ├── ui.js           ← Panel de contacto, formulario
│   ├── send.js         ← Flujo de envío de emails
│   └── import.js       ← Importar Excel / CSV
└── SETUP.md            ← Esta guía
```
