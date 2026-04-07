// ═══════════════════════════════════════════════════════════════
// IMPORT.JS v6 — todos los bugs de importación corregidos
// ═══════════════════════════════════════════════════════════════

let iMode = 'add';
let iCols = [];
let iRows = [];

// ── ESTADOS válidos por tipo ──────────────────────────────────
// Prospectos: new | sent | replied | waiting | negotiation | won | rejected
// Clientes:   ok  | incident | renewal | churned | lost (inactivo)

const PROSPECT_STATUS_MAP = {
  'sin contactar':'new',  'new':'new',     'nuevo':'new',      'sin email':'new',
  'enviado':'sent',       'sent':'sent',   'enviados':'sent',
  'respondido':'replied', 'replied':'replied', 'respondidos':'replied',
  'sin respuesta':'waiting', 'waiting':'waiting', 'no responde':'waiting',
  'negociando':'negotiation', 'negotiation':'negotiation', 'en negociacion':'negotiation',
  'ganado':'won',         'won':'won',     'cerrado':'won',
  'rechazado':'rejected', 'rejected':'rejected', 'rechaza':'rejected',
  'perdido':'rejected',   // 'perdido' in prospects = rechazado (lost only applies to clients)
  'no interesado':'rejected', 'no interesa':'rejected',
};

const CLIENT_STATUS_MAP = {
  'sin incidencias':'ok', 'ok':'ok', 'activo':'ok',  'active':'ok', 'normal':'ok',
  'incidencia':'incident', 'incident':'incident', 'incidencia activa':'incident', 'con incidencia':'incident',
  'renovacion':'renewal',  'renewal':'renewal',   'renovación':'renewal',
  'baja':'churned',        'churned':'churned',   'de baja':'churned',
  'perdido':'lost',        'lost':'lost',         'inactivo':'lost', 'inactive':'lost',
  'baja definitiva':'lost', 'inactiva':'lost',    'ex cliente':'lost',
};

// ── FIELD DEFINITIONS ─────────────────────────────────────────
const FIELD_MAP = {
  company:       ['empresa','company','nombre empresa','nombre de la empresa','compañia','nombre del cliente','nombre del prospecto','hospital','laboratorio','centro','razon social','razón social','nombre clinica','nombre hospital'],
  email:         ['email','correo','e-mail','correo electrónico','mail'],
  contact:       ['contacto','contact','persona de contacto','nombre contacto','responsable','interlocutor'],
  role:          ['cargo','rol','role','puesto','posición','position','título'],
  country:       ['país','pais','country','nación'],
  city:          ['ciudad','city','localidad','municipio','población'],
  phone:         ['teléfono','telefono','phone','tel','móvil','movil','celular','tfno'],
  priority:      ['prioridad','priority'],
  type:          ['tipo','type'],
  client_type:   ['tipo cliente','tipo de cliente','client type','público','publico','privado','sector publico','sector privado'],
  program:       ['programa','program','galenic','citostaticos','producto'],
  version:       ['versión','version','ver','v.'],
  notes:         ['notas','notes','comentario','comentarios','observaciones','nota'],
  status:        ['estado del proceso','estado proceso','estado','status','situación','situacion'],
  sent_date:     ['fecha envío','fecha envio','fecha de envio','fecha contacto','fecha primer contacto','sent date','fecha'],
  email_type:    ['tipo de email','tipo email','tipo de correo','tipo correo','tipo envío'],
  subject:       ['asunto','subject','asunto del email'],
  sent_text:     ['cuerpo del email','cuerpo email','cuerpo','email enviado','texto enviado','body'],
  attachments:   ['adjuntos','adjuntos enviados','adjuntos nombres','attachments','archivos adjuntos'],
  reply_date:    ['fecha respuesta','fecha de respuesta','reply date'],
  reply_from:    ['respondido por','respuesta de','quien respondio','replied by'],
  reply_text:    ['texto respuesta','respuesta recibida','reply text','texto de la respuesta'],
  next_followup: ['próximo followup','proximo followup','next followup','fecha followup','followup','proximo follow-up','próximo follow-up'],
  client_status: ['estado cliente','estado del cliente','incidencia','client status'],
};

const FIELD_LABELS = {
  company:       'Empresa / Nombre ⚠️',
  email:         'Email ⚠️',
  contact:       'Persona de contacto',
  role:          'Cargo',
  country:       'País',
  city:          'Ciudad',
  phone:         'Teléfono',
  priority:      'Prioridad (Alta/Media/Baja)',
  type:          'Tipo (Prospecto / Cliente)',
  client_type:   'Tipo cliente (Público / Privado)',
  program:       'Programa',
  version:       'Versión',
  notes:         'Notas generales',
  status:        'Estado del proceso (prospecto)',
  client_status: 'Estado del cliente (incidencias)',
  sent_date:     'Fecha de envío',
  email_type:    'Tipo de email',
  subject:       'Asunto',
  sent_text:     'Cuerpo del email enviado',
  attachments:   'Adjuntos enviados',
  reply_date:    'Fecha respuesta',
  reply_from:    'Respondido por',
  reply_text:    'Texto de la respuesta',
  next_followup: 'Próximo follow-up',
};

function autoMapField(colName) {
  const col = (colName||'').trim();
  if (!col) return '';  // Fix 3: empty column → no importar
  const c = col.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  for (const [field, aliases] of Object.entries(FIELD_MAP)) {
    if (aliases.some(a => {
      const n = a.normalize('NFD').replace(/[\u0300-\u036f]/g,'');
      return c === n || c.includes(n) || n.includes(c);
    })) return field;
  }
  return '';
}

// ── NORMALIZE HELPERS ─────────────────────────────────────────
function normPriority(v) {
  const m = {'alta':'Alta','media':'Media','baja':'Baja','high':'Alta','low':'Baja','medium':'Media'};
  return m[(v||'').toLowerCase()] || 'Media';
}

function normType(v) {
  // Fix 1: robust client detection
  const lower = (v||'').toLowerCase().trim();
  const clientWords = ['cliente','client','clientes','clients'];
  const prospectWords = ['prospecto','prospect','prospectos','prospects'];
  if (clientWords.includes(lower)) return 'client';
  if (prospectWords.includes(lower)) return 'prospect';
  return 'prospect'; // default
}

function normClientType(v) {
  const lower = (v||'').toLowerCase();
  if (lower.includes('priv')) return 'private';
  return 'public';
}

function normProspectStatus(v) {
  const lower = (v||'').toLowerCase().trim();
  return PROSPECT_STATUS_MAP[lower] || 'new';
}

function normClientStatus(v) {
  const lower = (v||'').toLowerCase().trim();
  return CLIENT_STATUS_MAP[lower] || 'ok';
}

// ── OPEN/CLOSE ────────────────────────────────────────────────
function openImport() {
  document.getElementById('impWizard').style.display = '';
  document.getElementById('impResult').style.display = 'none';
  ['impPrev','impMap','impFolderWrap','impModeWrap'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  document.getElementById('impBtn').style.display = 'none';
  document.getElementById('fInput').value = '';
  document.getElementById('impGuide').style.display = '';
  iCols = []; iRows = [];

  const fsel = document.getElementById('impFolder');
  fsel.innerHTML = '<option value="">— Sin carpeta —</option>' +
    folders.map(f => `<option value="${f.id}">${f.icon||'📁'} ${f.name}</option>`).join('');

  document.getElementById('impModal').classList.add('open');
}

function closeImport() {
  document.getElementById('impModal').classList.remove('open');
}

function dzDrag(e, on) { e.preventDefault(); document.getElementById('dz').classList.toggle('drag', on); }
function dzDrop(e) { e.preventDefault(); dzDrag(e, false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }

// ── FILE HANDLING ─────────────────────────────────────────────
function handleFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  const reader = new FileReader();

  reader.onload = e => {
    try {
      let wb;
      if (ext === 'csv') wb = XLSX.read(e.target.result, { type: 'string' });
      else               wb = XLSX.read(e.target.result, { type: 'array' });

      const ws   = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

      if (!json.length) { toast('Archivo vacío', 'er'); return; }

      iCols = json[0].map(c => String(c).trim());
      iRows = json.slice(1).filter(r => r.some(c => String(c||'').trim() !== ''));

      document.getElementById('impGuide').style.display = 'none';

      document.getElementById('impPrev').style.display = '';
      document.getElementById('impPrev').innerHTML = `
        <div class="imp-file-info">
          <span>📊</span>
          <div><strong>${escH(file.name)}</strong>
          <div class="imp-file-meta">${iRows.length} filas · ${iCols.length} columnas</div></div>
          <button class="btn-link" onclick="document.getElementById('fInput').click()">Cambiar</button>
        </div>`;

      document.getElementById('impMap').style.display = '';
      const autoMapped = iCols.map(c => autoMapField(c));
      const allFields = [
        { val: '', label: '— No importar —' },
        ...Object.keys(FIELD_LABELS).map(k => ({ val: k, label: FIELD_LABELS[k] })),
      ];

      // Fix 3: empty column name → auto-map to '' (no importar)
      document.getElementById('mapRows').innerHTML =
        iCols.map((col, i) => {
          const auto = autoMapped[i];
          const isEmpty = !col.trim();
          const displayName = isEmpty ? '<em style="color:var(--ink3)">(columna vacía)</em>' : escH(col);
          return `<div class="map-row">
            <span class="map-col-name">${displayName}</span>
            <span class="map-arrow">→</span>
            <select id="map-${i}" class="${auto && !isEmpty ? 'map-sel-mapped' : ''}">
              ${allFields.map(o => `<option value="${o.val}"${o.val===auto?' selected':''}>${o.label}</option>`).join('')}
            </select>
          </div>`;
        }).join('');

      document.getElementById('impFolderWrap').style.display = '';
      document.getElementById('impModeWrap').style.display   = '';
      document.getElementById('impBtn').style.display        = '';
      setIMode('add');
    } catch(err) {
      toast('Error al leer el archivo: ' + err.message, 'er');
    }
  };

  if (ext === 'csv') reader.readAsText(file, 'UTF-8');
  else               reader.readAsArrayBuffer(file);
}

function setIMode(m) {
  iMode = m;
  ['add','merge','replace'].forEach(x => {
    document.getElementById(`m-${x}`)?.classList.toggle('active', x === m);
  });
}

// ── DO IMPORT ─────────────────────────────────────────────────
async function doImport() {
  if (!iRows.length) { toast('Sin datos', 'er'); return; }

  const mapping = {};
  iCols.forEach((col, i) => {
    const v = document.getElementById(`map-${i}`)?.value;
    if (v) mapping[i] = v;
  });

  const folderId = document.getElementById('impFolder').value || null;
  const btn = document.getElementById('impBtn');
  btn.textContent = 'Importando…';
  btn.disabled = true;

  const newRecords = iRows.map(row => {
    // Build raw record from mapped columns first
    const raw = {};
    iCols.forEach((col, i) => {
      const field = mapping[i];
      if (!field) return;
      raw[field] = String(row[i]||'').trim();
    });

    // Fix 1: determine type FIRST from the data
    const resolvedType = raw.type ? normType(raw.type) : (activeView === 'clients' ? 'client' : 'prospect');
    const isClient = resolvedType === 'client';

    // Build final record with correct defaults per type
    const r = {
      company:       (raw.company || '').trim(),
      email:         raw.email   || '',
      contact:       raw.contact || '',
      role:          raw.role    || '',
      country:       raw.country || '',
      city:          raw.city    || '',
      phone:         raw.phone   || '',
      program:       raw.program || '',
      version:       raw.version || '',
      notes:         raw.notes   || '',   // Fix 2: goes to notes field, not history
      sent_date:     raw.sent_date     || null,
      email_type:    raw.email_type    || '',
      subject:       raw.subject       || '',
      sent_text:     raw.sent_text     || '',
      attachments:   raw.attachments   || '',
      reply_date:    raw.reply_date    || null,
      reply_from:    raw.reply_from    || '',
      reply_text:    raw.reply_text    || '',
      next_followup: raw.next_followup || null,
      type:          resolvedType,
      client_type:   raw.client_type ? normClientType(raw.client_type) : 'public',
      priority:      raw.priority ? normPriority(raw.priority) : (isClient ? null : 'Media'),
      folder_id:     folderId,
      user_id:       currentUser?.id,
    };

    // Fix 4+8: Status normalization — different per type
    if (isClient) {
      // For clients, 'status' column maps to client_status (incidencias)
      // 'client_status' column also maps to client_status
      if (raw.client_status) {
        r.client_status = normClientStatus(raw.client_status);
        r.status = 'ok'; // main status for clients is irrelevant, use ok by default
      } else if (raw.status) {
        // Try to map status to client context
        const cs = normClientStatus(raw.status);
        if (cs !== 'ok' || CLIENT_STATUS_MAP[(raw.status||'').toLowerCase()]) {
          r.client_status = cs;
          r.status = 'ok';
        } else {
          // Might be 'perdido/inactivo' → goes to r.status for clients
          const ps = normProspectStatus(raw.status);
          r.status = ps === 'rejected' ? 'lost' : ps; // rejected doesn't apply to clients
          r.client_status = 'ok';
        }
      } else {
        r.status = 'ok';
        r.client_status = 'ok';
      }
    } else {
      // For prospects, 'status' maps directly to status
      r.status = raw.status ? normProspectStatus(raw.status) : 'new';
      r.client_status = null;
    }

    return r;
  }).filter(r => r.company || r.email);

  let added = 0, merged = 0, errors = 0;
  const errorList = [];

  try {
    if (iMode === 'replace' && folderId) {
      const toDelete = records.filter(r => r.folder_id === folderId).map(r => r.id);
      if (toDelete.length) await dbDeleteContacts(toDelete);
    }

    for (const rec of newRecords) {
      try {
        if (iMode === 'merge' && rec.email) {
          const existing = records.find(r => r.email?.toLowerCase() === rec.email?.toLowerCase());
          if (existing) {
            await dbSaveContact({ ...rec, id: existing.id });
            merged++; continue;
          }
        }
        await dbSaveContact(rec);
        added++;
      } catch(rowErr) {
        console.error('Row error:', rowErr, rec);
        errors++;
        errorList.push(rec.company || rec.email);
      }
    }

    await loadContacts();
    renderSidebar(); renderBothTables(); renderFollowupBanner(); populateCountryFilter();

    document.getElementById('impWizard').style.display = 'none';
    document.getElementById('impResult').style.display = '';
    document.getElementById('impResultMsg').innerHTML = `
      <div style="font-size:1.1rem;font-weight:700;color:var(--c-replied);margin-bottom:10px">✅ Importación completada</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:${errors?'10px':'0'}">
        ${added>0   ? `<span class="imp-stat-ok">+${added} nuevos</span>`         : ''}
        ${merged>0  ? `<span class="imp-stat-blue">${merged} actualizados</span>`  : ''}
        ${errors>0  ? `<span class="imp-stat-er">${errors} con error</span>`       : ''}
      </div>
      ${errors>0 ? `<div style="font-size:.75rem;color:var(--ink3);margin-top:6px">Con error: ${errorList.slice(0,5).join(', ')}${errorList.length>5?'…':''}</div>` : ''}`;
  } catch(err) {
    toast('Error al importar: ' + err.message, 'er');
    console.error(err);
  }

  btn.textContent = '📥 Importar';
  btn.disabled = false;
}
