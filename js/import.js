// ═══════════════════════════════════════════════════════════════
// IMPORT.JS v8 — importación de clientes y prospectos corregida
// ═══════════════════════════════════════════════════════════════

let iMode = 'add';
let iCols = [];
let iRows = [];

// ── ESTADOS válidos por tipo ──────────────────────────────────
const PROSPECT_STATUS_MAP = {
  // New pipeline stages
  'sin contactar':'new',        'new':'new',           'nuevo':'new',
  'contactado':'contacted',     'contacted':'contacted','primer contacto':'contacted',
  'demo agendada':'demo_scheduled', 'demo_scheduled':'demo_scheduled',
  'demo realizada':'demo_done', 'demo hecha':'demo_done', 'demo_done':'demo_done',
  'presupuesto enviado':'proposal_sent', 'presupuestado':'proposal_sent', 'proposal_sent':'proposal_sent',
  'en seguimiento':'followup',  'seguimiento':'followup', 'followup':'followup',
  'esperando decision':'waiting_decision', 'waiting_decision':'waiting_decision',
  'confirmado':'won',           'won':'won',           'cerrado':'won', 'contratado':'won',
  'en instalacion':'installation', 'installation':'installation',
  'rechazado':'rejected',       'rejected':'rejected',
  'no interesado':'rejected',   'no interesa':'rejected',
  // Legacy (backward compat)
  'enviado':'contacted',        'sent':'contacted',    'enviados':'contacted',
  'respondido':'contacted',     'replied':'contacted', 'respondidos':'contacted',
  'sin respuesta':'followup',   'waiting':'followup',  'no responde':'followup',
  'negociando':'followup',      'negotiation':'followup',
  'ganado':'won',
};

const CLIENT_STATUS_MAP = {
  // client_status (incidencias)
  'sin incidencias':'ok', 'ok':'ok', 'activo':'ok', 'active':'ok', 'normal':'ok', 'alta':'ok',
  'incidencia':'incident', 'incident':'incident', 'incidencia activa':'incident', 'con incidencia':'incident',
  'renovacion':'renewal',  'renewal':'renewal',   'renovación':'renewal',
  'baja':'churned',        'churned':'churned',   'de baja':'churned', 'baja definitiva':'churned',
  // These map to status=lost (inactivo) on the main status field
  'perdido':'lost',    'lost':'lost',     'inactivo':'lost', 'inactive':'lost',
  'ex cliente':'lost', 'inactiva':'lost', 'dado de baja':'lost',
};

// ── FIELD DEFINITIONS ─────────────────────────────────────────
// IMPORTANT: order matters — first match wins. More specific aliases FIRST.
const FIELD_MAP = {
  // Core
  company:       ['empresa','company','nombre empresa','nombre de la empresa','compañia',
                  'nombre del cliente','nombre del prospecto','nombre clinica','nombre hospital',
                  'razon social','razón social','hospital','laboratorio','centro'],
  email:         ['email','correo electronico','e-mail','correo','mail'],
  email2:        ['email 2','email2','correo 2','correo2','email alternativo','correo alternativo'],
  email3:        ['email 3','email3','correo 3','correo3','email adicional','correo adicional'],
  // Contact
  contact:       ['contacto','persona de contacto','nombre contacto','responsable','interlocutor','contact'],
  role:          ['cargo','rol','role','puesto','posicion','position','titulo'],
  country:       ['pais','country','nacion'],
  city:          ['ciudad','city','localidad','municipio','poblacion'],
  phone:         ['telefono','phone','tel','movil','celular','tfno'],
  // Classification
  type:          ['tipo registro','tipo de registro','tipo prospecto','tipo cliente valor',
                  'registro','prospect or client'],
  // NOTE: 'tipo cliente' alone maps to this special column — see below
  client_status_col: ['tipo cliente','tipo baja','estado cliente','estado del cliente','client status'],
  client_type:   ['tipo entidad','tipo de entidad','entidad','sector','publico o privado',
                  'public private','tipo organizacion','privado publico'],
  program:       ['programa','program','galenic','citostaticos','producto'],
  version:       ['version','ver'],
  notes:         ['notas','notes','comentario','comentarios','observaciones','nota'],
  priority:      ['prioridad','priority'],
  // Email tracking
  status:        ['estado del proceso','estado proceso','estado prospecto','situacion'],
  sent_date:     ['fecha envio','fecha de envio','fecha contacto','fecha primer contacto','sent date','fecha envío'],
  email_type:    ['tipo de email','tipo email','tipo correo','tipo envio'],
  subject:       ['asunto','subject','asunto del email'],
  sent_text:     ['cuerpo del email','cuerpo email','email enviado','texto enviado','body'],
  attachments:   ['adjuntos','adjuntos enviados','attachments','archivos adjuntos'],
  reply_date:    ['fecha respuesta','fecha de respuesta'],
  reply_from:    ['respondido por','respuesta de'],
  reply_text:    ['texto respuesta','respuesta recibida','texto de la respuesta'],
  next_followup: ['proximo followup','proximo follow-up','next followup','fecha followup','followup'],
};

const FIELD_LABELS = {
  company:           'Empresa / Nombre ⚠️',
  email:             'Email principal ⚠️',
  email2:            'Email 2',
  email3:            'Email 3',
  contact:           'Persona de contacto',
  role:              'Cargo',
  country:           'País',
  city:              'Ciudad',
  phone:             'Teléfono',
  type:              'Tipo de registro (Prospecto/Cliente)',
  client_status_col: 'Estado/Tipo cliente (Activo/Baja/Perdido…)',
  client_type:       'Tipo entidad (Público/Privado)',
  program:           'Programa',
  version:           'Versión instalada',
  notes:             'Notas generales',
  priority:          'Prioridad (Alta/Media/Baja)',
  status:            'Estado del proceso (prospectos)',
  sent_date:         'Fecha de envío',
  email_type:        'Tipo de email',
  subject:           'Asunto del email',
  sent_text:         'Cuerpo del email enviado',
  attachments:       'Adjuntos enviados',
  reply_date:        'Fecha respuesta recibida',
  reply_from:        'Respondido por',
  reply_text:        'Texto de la respuesta',
  next_followup:     'Próximo follow-up',
};

function autoMapField(colName) {
  const col = (colName || '').trim();
  if (!col) return ''; // empty header → no importar

  // Normalize: remove accents, lowercase
  function norm(s) {
    return (s || '').toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  const c = norm(col);

  // Iterate in definition order — first match wins
  for (const [field, aliases] of Object.entries(FIELD_MAP)) {
    for (const a of aliases) {
      const n = norm(a);
      if (c === n || c.includes(n) || n.includes(c)) {
        return field;
      }
    }
  }
  return '';
}

// ── NORMALIZE HELPERS ─────────────────────────────────────────
function normPriority(v) {
  const m = { 'alta':'Alta','media':'Media','baja':'Baja','high':'Alta','low':'Baja','medium':'Media' };
  return m[norm(v)] || 'Media';
}

function normType(v) {
  const lower = norm(v);
  const clientWords  = ['cliente','client','clientes','clients'];
  const prospectWords = ['prospecto','prospect','prospectos','prospects'];
  if (clientWords.includes(lower))   return 'client';
  if (prospectWords.includes(lower)) return 'prospect';
  return null; // unknown — will be resolved by activeView or client_status_col
}

// Resolve "Tipo Cliente" column value → tells us type AND status
function resolveClientStatusCol(v) {
  // This column might contain: Cliente, Baja, Perdido, Inactivo, Activo, etc.
  const lower = norm(v);
  // Client-type values → type=client with various statuses
  const isClient = ['cliente','client','clientes','activo','active','normal','alta',
                    'sin incidencias','ok','baja','perdido','inactivo','lost','churned',
                    'baja definitiva','de baja','renovacion','incidencia'].includes(lower);
  if (!isClient) return null; // not recognized as client indicator

  // Determine the client_status from this value
  const cs = CLIENT_STATUS_MAP[lower] || 'ok';
  // If churned/lost → set status=lost too
  const mainStatus = (cs === 'lost' || cs === 'churned') ? 'lost' : 'ok';
  return { type: 'client', client_status: cs, status: mainStatus };
}

function normClientType(v) {
  const lower = norm(v);
  if (lower.includes('priv')) return 'private';
  return 'public';
}

function normProspectStatus(v) {
  const lower = norm(v);
  return PROSPECT_STATUS_MAP[lower] || 'new';
}

function normClientStatusVal(v) {
  const lower = norm(v);
  return CLIENT_STATUS_MAP[lower] || 'ok';
}

function norm(s) {
  return (s || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .trim();
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

      document.getElementById('mapRows').innerHTML =
        iCols.map((col, i) => {
          const auto    = autoMapped[i];
          const isEmpty = !col.trim();
          const display = isEmpty ? '<em style="color:var(--ink3)">(columna vacía)</em>' : escH(col);
          return `<div class="map-row">
            <span class="map-col-name">${display}</span>
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
    // Step 1: collect raw values from mapped columns
    const raw = {};
    iCols.forEach((col, i) => {
      const field = mapping[i];
      if (!field) return;
      raw[field] = String(row[i] || '').trim();
    });

    // Step 2: determine type
    // Priority order:
    // a) If there's a 'type' column, use it
    // b) If there's a 'client_status_col' column (like "Tipo Cliente"), derive type from values
    // c) Fall back to activeView
    let resolvedType = null;
    let derivedClientStatus = null;
    let derivedMainStatus   = null;

    if (raw.type) {
      const t = normType(raw.type);
      if (t) {
        resolvedType = t;
      } else {
        // value not recognized as type word — check if it's a client status value
        const csc = resolveClientStatusCol(raw.type);
        if (csc) {
          resolvedType       = csc.type;
          derivedClientStatus = csc.client_status;
          derivedMainStatus   = csc.status;
        }
      }
    }

    if (!resolvedType && raw.client_status_col) {
      const csc = resolveClientStatusCol(raw.client_status_col);
      if (csc) {
        resolvedType        = csc.type;
        derivedClientStatus = csc.client_status;
        derivedMainStatus   = csc.status;
      } else {
        // Value not recognized — still treat as client if we're in clients view
        resolvedType = activeView === 'clients' ? 'client' : 'prospect';
      }
    }

    // Final fallback: use activeView
    if (!resolvedType) {
      resolvedType = activeView === 'clients' ? 'client' : 'prospect';
    }

    const isClient = resolvedType === 'client';

    // Step 3: build the record
    const r = {
      company:       (raw.company  || '').trim(),
      email:         (raw.email    || '').trim(),
      email2:        (raw.email2   || '').trim() || null,
      email3:        (raw.email3   || '').trim() || null,
      contact:       raw.contact   || '',
      role:          raw.role      || '',
      country:       raw.country   || '',
      city:          raw.city      || '',
      phone:         raw.phone     || '',
      program:       raw.program   || '',
      version:       raw.version   || '',
      notes:         raw.notes     || '',
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

    // Step 4: set status fields correctly per type
    if (isClient) {
      // client_status = incidencias (ok/incident/renewal/churned/lost)
      // status = 'ok' for active, 'lost' for inactive/baja
      if (derivedClientStatus) {
        // Already derived from client_status_col
        r.client_status = derivedClientStatus;
        r.status        = derivedMainStatus || 'ok';
      } else if (raw.client_status) {
        r.client_status = normClientStatusVal(raw.client_status);
        r.status = (r.client_status === 'lost' || r.client_status === 'churned') ? 'lost' : 'ok';
      } else if (raw.status) {
        // Status column on a client — try to interpret as client_status
        const cs = normClientStatusVal(raw.status);
        r.client_status = cs;
        r.status = (cs === 'lost' || cs === 'churned') ? 'lost' : 'ok';
      } else {
        r.client_status = 'ok';
        r.status        = 'ok';
      }
    } else {
      // Prospect
      r.status        = raw.status ? normProspectStatus(raw.status) : 'new';
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
          const existing = records.find(r =>
            r.email?.toLowerCase() === rec.email?.toLowerCase()
          );
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
        errorList.push(rec.company || rec.email || '?');
      }
    }

    await loadContacts();
    renderSidebar(); renderBothTables(); renderFollowupBanner(); populateCountryFilter();

    document.getElementById('impWizard').style.display = 'none';
    document.getElementById('impResult').style.display = '';
    // Switch footer buttons: hide Cancelar+Importar, show Cerrar+ImportarMás
    document.getElementById('impCancelBtn').style.display = 'none';
    document.getElementById('impBtn').style.display       = 'none';
    document.getElementById('impCloseBtn').style.display  = '';
    document.getElementById('impMoreBtn').style.display   = '';
    document.getElementById('impResultMsg').innerHTML = `
      <div style="font-size:1.1rem;font-weight:700;color:var(--c-replied);margin-bottom:10px">✅ Importación completada</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:${errors?'10px':'0'}">
        ${added>0  ? `<span class="imp-stat-ok">+${added} nuevos</span>`         : ''}
        ${merged>0 ? `<span class="imp-stat-blue">${merged} actualizados</span>`  : ''}
        ${errors>0 ? `<span class="imp-stat-er">${errors} con error</span>`       : ''}
      </div>
      ${errors>0 ? `<div style="font-size:.75rem;color:var(--ink3);margin-top:6px">Errores: ${errorList.slice(0,5).join(', ')}${errorList.length>5?'…':''}</div>` : ''}`;

  } catch(err) {
    toast('Error al importar: ' + err.message, 'er');
    console.error(err);
  }

  btn.textContent = '📥 Importar';
  btn.disabled = false;
}
