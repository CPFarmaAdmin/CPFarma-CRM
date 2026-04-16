// ═══════════════════════════════════════════════════════════════
// IMPORT.JS v10 — mapeo exacto de columnas de cliente y prospecto
// ═══════════════════════════════════════════════════════════════

let iMode = 'add';
let iCols = [];
let iRows = [];

// ── ESTADOS por tipo ──────────────────────────────────────────
const PROSPECT_STATUS_MAP = {
  // Sin contactar
  'sin contactar':'new',   'new':'new',

  // Primer contacto — se ha enviado el primer email, aún sin respuesta de datos
  'primer contacto':'first_contact', 'first_contact':'first_contact',
  'enviado':'first_contact',         'sent':'first_contact',
  'primer email':'first_contact',    'primer email enviado':'first_contact',

  // Sin responder — se envió y no respondieron
  'sin responder':'no_response',     'no_response':'no_response',
  'sin respuesta':'no_response',     'no responde':'no_response',
  'waiting':'no_response',           'no reply':'no_response',

  // Datos obtenidos — respondieron y tenemos los datos de contacto correctos
  'datos obtenidos':'contact_obtained', 'contact_obtained':'contact_obtained',
  'contactado':'contact_obtained',      'contacted':'contact_obtained',
  'respondido':'contact_obtained',      'replied':'contact_obtained',

  // Información enviada
  'informacion enviada':'info_sent', 'información enviada':'info_sent',
  'info enviada':'info_sent',        'info_sent':'info_sent',

  // Demo
  'demo agendada':'demo_scheduled',  'demo programada':'demo_scheduled',
  'demo realizada':'demo_done',      'demo hecha':'demo_done',

  // Presupuesto
  'presupuesto enviado':'budget_sent', 'propuesta enviada':'budget_sent',
  'budget_sent':'budget_sent',         'presupuesto':'budget_sent',

  // Seguimiento
  'en seguimiento':'followup',  'seguimiento':'followup',  'followup':'followup',
  'negociando':'followup',

  // Esperando aprobación
  'esperando aprobacion':'waiting_approval', 'esperando aprobación':'waiting_approval',

  // Cerrados
  'ganado':'won',    'won':'won',    'confirmado':'won',
  'rechazado':'rejected', 'rejected':'rejected', 'no interesado':'rejected',
};

const CLIENT_STATUS_MAP = {
  'sin incidencias':'ok', 'ok':'ok', 'activo':'ok', 'active':'ok', 'alta':'ok', 'normal':'ok',
  'incidencia':'incident', 'incident':'incident', 'incidencia activa':'incident',
  'renovacion':'renewal',  'renewal':'renewal',   'renovación':'renewal',
  'baja':'churned',        'churned':'churned',   'de baja':'churned',
  'perdido':'lost',        'lost':'lost',         'inactivo':'lost', 'inactive':'lost',
};

// ── FIELD MAP — basado en las columnas reales del excel del usuario ──
// IMPORTANTE: el orden importa — first match wins. Más específicos primero.
const FIELD_MAP = {
  // ── COMUNES ──────────────────────────────────────────────────
  company:       ['nombre','empresa','company','nombre empresa','nombre del cliente',
                  'nombre del prospecto','hospital','laboratorio','centro',
                  'razon social','razón social','nombre clinica','nombre hospital'],
  email:         ['email 1','email1','email principal','email','correo electronico',
                  'correo','e-mail','mail'],
  email2:        ['email 2','email2','correo 2','correo2','correo alternativo','email alternativo'],
  email3:        ['email 3','email3','correo 3','correo3','correo adicional','email adicional'],
  country:       ['pais','país','country','nacion'],
  city:          ['ciudad','city','localidad','municipio','poblacion'],
  program:       ['programa','program','galenic','citostaticos','producto'],
  notes:         ['notas generales','notas','notes','comentario','comentarios','observaciones','nota'],
  type:          ['tipo registro','tipo de registro'],
  client_status_col: ['tipo cliente','tipo baja','estado cliente'],
  client_type:   ['tipo entidad','tipo de entidad','entidad','sector',
                  'publico o privado','privado publico','tipo organizacion'],

  // ── CONTACTO PRINCIPAL (prospecto usa f-contact / f-role) ────
  contact:       ['persona contacto','persona de contacto','contacto farmacia',
                  'contacto principal','responsable','interlocutor',
                  'nombre contacto','contacto'],
  role:          ['cargo farmacia','cargo principal','cargo','rol','role',
                  'puesto','posicion','titulo'],
  phone:         ['telefono farmacia','telefono principal','telefono','phone',
                  'tel','movil','celular','tfno','teléfono'],

  // ── CLIENTE: contactos adicionales ───────────────────────────
  it_name:       ['contacto informatica','nombre informatica','contacto it',
                  'responsable informatica','informatica nombre','it nombre'],
  it_phone:      ['telefono informatica','telefono it','it telefono',
                  'telefono informatica','it phone'],
  it_email:      ['email informatica','correo informatica','it email',
                  'email it','correo it'],
  mgmt_name:     ['contacto gerencia','nombre gerencia','gerencia nombre',
                  'contacto administracion','administracion nombre',
                  'gerente','responsable gerencia','gerencia'],
  mgmt_phone:    ['telefono gerencia','gerencia telefono','telefono administracion',
                  'gerencia phone'],
  mgmt_email:    ['email gerencia','correo gerencia','gerencia email',
                  'email administracion','correo administracion'],

  // ── CLIENTE: versión y mantenimiento ─────────────────────────
  version:       ['version','versión','ver'],
  maintenance:   ['mantenimiento','maintenance','mant'],
  maintenance_date: ['fecha inicio mantenimiento','fecha mantenimiento',
                     'inicio mantenimiento','maintenance date','fecha mant'],

  // ── PROSPECTO: clasificación ──────────────────────────────────
  priority:      ['prioridad','priority'],
  status:        ['estado del proceso','estado proceso','estado prospecto','status prospecto',
                  'estado','status','situacion'],

  // ── EMAIL (ambos) ─────────────────────────────────────────────
  sent_date:     ['fecha de envio de ultimo email','fecha envio','fecha de envio',
                  'fecha ultimo email','fecha contacto','fecha envío'],
  email_type:    ['tipo de email','tipo email','tipo correo','tipo envio'],
  email_to:      ['enviado a','enviado_a','sent to','destinatario'],
  subject:       ['asunto','subject'],
  sent_text:     ['cuerpo del email','cuerpo email','email enviado','body','cuerpo'],
  attachments:   ['adjuntos enviados','adjuntos','attachments','archivos adjuntos'],
  reply_text:    ['respuesta recibida','texto respuesta','reply text','texto de la respuesta'],
  reply_date:    ['fecha respuesta','fecha de respuesta'],
  reply_from:    ['respondido por','respuesta de','replied by'],
  next_followup: ['proximo followup','proximo follow-up','next followup','fecha followup'],
};

const FIELD_LABELS = {
  company:          'Empresa / Nombre ⚠️',
  email:            'Email principal ⚠️',
  email2:           'Email 2',
  email3:           'Email 3',
  contact:          'Persona de contacto / Farmacia',
  role:             'Cargo',
  country:          'País',
  city:             'Ciudad',
  phone:            'Teléfono',
  program:          'Programa',
  version:          'Versión instalada',
  notes:            'Notas generales',
  type:             'Tipo de registro (Prospecto/Cliente)',
  client_status_col:'Estado/Tipo cliente (Activo/Baja/Perdido…)',
  client_type:      'Tipo entidad (Público/Privado)',
  it_name:          'Contacto Informática — Nombre',
  it_phone:         'Contacto Informática — Teléfono',
  it_email:         'Contacto Informática — Email',
  mgmt_name:        'Contacto Gerencia — Nombre',
  mgmt_phone:       'Contacto Gerencia — Teléfono',
  mgmt_email:       'Contacto Gerencia — Email',
  maintenance:      'Mantenimiento (sí/no)',
  maintenance_date: 'Fecha inicio mantenimiento',
  priority:         'Prioridad (Alta/Media/Baja)',
  status:           'Estado del proceso (prospectos)',
  sent_date:        'Fecha de envío',
  email_type:       'Tipo de email',
  email_to:         'Enviado a',
  subject:          'Asunto del email',
  sent_text:        'Cuerpo del email enviado',
  attachments:      'Adjuntos enviados',
  reply_text:       'Texto de la respuesta',
  reply_date:       'Fecha respuesta',
  reply_from:       'Respondido por',
  next_followup:    'Próximo follow-up',
};

// ── NORMALIZACIÓN ─────────────────────────────────────────────
function norm(s) {
  return (s||'').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .trim();
}

function autoMapField(colName) {
  const col = (colName||'').trim();
  if (!col) return '';
  const c = norm(col);

  // Pass 1: exact match (highest priority)
  for (const [field, aliases] of Object.entries(FIELD_MAP)) {
    if (aliases.some(a => norm(a) === c)) return field;
  }

  // Pass 2: longest alias that is a substring of the column name
  // (prefers "contacto informatica" over just "contacto")
  let bestField = '', bestLen = 0;
  for (const [field, aliases] of Object.entries(FIELD_MAP)) {
    for (const a of aliases) {
      const n = norm(a);
      if (n && c.includes(n) && n.length > bestLen) {
        bestField = field;
        bestLen   = n.length;
      }
    }
  }
  if (bestField) return bestField;

  // Pass 3: column name is a substring of an alias
  for (const [field, aliases] of Object.entries(FIELD_MAP)) {
    if (aliases.some(a => norm(a).includes(c))) return field;
  }

  return '';
}

function normPriority(v) {
  const m = {'alta':'Alta','media':'Media','baja':'Baja','high':'Alta','low':'Baja','medium':'Media'};
  return m[norm(v)] || 'Media';
}

function normType(v) {
  const lower = norm(v);
  if (['cliente','client','clientes','clients'].includes(lower)) return 'client';
  if (['prospecto','prospect','prospectos','prospects'].includes(lower)) return 'prospect';
  return null;
}

function normMaintenance(v) {
  const lower = norm(v);
  if (['si','sí','yes','true','1','contratado','con mantenimiento'].includes(lower)) return 'yes';
  if (['no','false','0','sin mantenimiento'].includes(lower)) return 'no';
  return v || null;
}

function resolveClientStatusCol(v) {
  const lower = norm(v);
  const isClientIndicator = [
    'cliente','client','clientes','activo','active','normal','alta','sin incidencias',
    'ok','baja','perdido','inactivo','lost','churned','baja definitiva','de baja',
    'renovacion','incidencia'
  ].includes(lower);
  if (!isClientIndicator) return null;
  const cs = CLIENT_STATUS_MAP[lower] || 'ok';
  return { type:'client', client_status:cs, status:(cs==='lost'||cs==='churned')?'lost':'ok' };
}

function normProspectStatus(v) {
  return PROSPECT_STATUS_MAP[norm(v)] || 'new';
}

// Normalize any date to YYYY-MM-DD for Supabase
// Accepts: dd/mm/yyyy (Spanish), yyyy-mm-dd (ISO), dd-mm-yyyy, empty, '-'
function normDate(v) {
  if (!v && v !== 0) return null;
  const s = String(v).trim();
  if (!s || s === '-' || s === '—' || s === '–') return null;

  // ISO string with time component (from XLSX date cells): "2026-03-06T00:00:00.000Z"
  if (s.match(/^\d{4}-\d{2}-\d{2}T/)) return s.slice(0, 10);

  // yyyy-mm-dd (ISO, already correct)
  const ymd = s.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/);
  if (ymd) {
    const [, y, m, d] = ymd;
    const date = new Date(Date.UTC(+y, +m - 1, +d));
    return isNaN(date) ? null : date.toISOString().split('T')[0];
  }

  // dd/mm/yyyy or dd-mm-yyyy (Spanish/European format)
  const dmy = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    const date = new Date(Date.UTC(+y, +m - 1, +d));
    return isNaN(date) ? null : date.toISOString().split('T')[0];
  }

  return null; // unknown format — skip to avoid sending bad data to DB
}

function normClientStatusVal(v) {
  return CLIENT_STATUS_MAP[norm(v)] || 'ok';
}

function normClientType(v) {
  const lower = norm(v);
  if (lower.includes('priv')) return 'private';
  return 'public';
}

// ── OPEN / CLOSE ──────────────────────────────────────────────
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

function closeImport() { document.getElementById('impModal').classList.remove('open'); }
function dzDrag(e, on) { e.preventDefault(); document.getElementById('dz').classList.toggle('drag', on); }
function dzDrop(e) { e.preventDefault(); dzDrag(e, false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }

// ── FILE HANDLING ─────────────────────────────────────────────
function handleFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  const reader = new FileReader();

  reader.onload = e => {
    try {
      let wb;
      if (ext === 'csv') wb = XLSX.read(e.target.result, {type:'string'});
      else               wb = XLSX.read(e.target.result, {type:'array'});

      const ws   = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws, {header:1, defval:'', raw:false, dateNF:'yyyy-mm-dd'});
      if (!json.length) { toast('Archivo vacío','er'); return; }

      iCols = json[0].map(c => String(c).trim());
      iRows = json.slice(1).filter(r => r.some(c => String(c||'').trim() !== ''));

      document.getElementById('impGuide').style.display = 'none';
      document.getElementById('impPrev').style.display  = '';
      document.getElementById('impPrev').innerHTML = `
        <div class="imp-file-info">
          <span>📊</span>
          <div><strong>${escH(file.name)}</strong>
          <div class="imp-file-meta">${iRows.length} filas · ${iCols.length} columnas</div></div>
          <button class="btn-link" onclick="document.getElementById('fInput').click()">Cambiar</button>
        </div>`;

      document.getElementById('impMap').style.display = '';
      const autoMapped = iCols.map(c => autoMapField(c));
      const allFields  = [
        {val:'', label:'— No importar —'},
        ...Object.keys(FIELD_LABELS).map(k => ({val:k, label:FIELD_LABELS[k]})),
      ];

      document.getElementById('mapRows').innerHTML = iCols.map((col, i) => {
        const auto    = autoMapped[i];
        const isEmpty = !col.trim();
        const display = isEmpty ? '<em style="color:var(--ink3)">(columna vacía)</em>' : escH(col);
        return `<div class="map-row">
          <span class="map-col-name">${display}</span>
          <span class="map-arrow">→</span>
          <select id="map-${i}" class="${auto&&!isEmpty?'map-sel-mapped':''}">
            ${allFields.map(o=>`<option value="${o.val}"${o.val===auto?' selected':''}>${o.label}</option>`).join('')}
          </select>
        </div>`;
      }).join('');

      document.getElementById('impFolderWrap').style.display = '';
      document.getElementById('impModeWrap').style.display   = '';
      document.getElementById('impBtn').style.display        = '';
      setIMode('add');
    } catch(err) { toast('Error al leer: '+err.message,'er'); }
  };

  if (ext==='csv') reader.readAsText(file,'UTF-8');
  else             reader.readAsArrayBuffer(file);
}

function setIMode(m) {
  iMode = m;
  ['add','merge','replace'].forEach(x =>
    document.getElementById(`m-${x}`)?.classList.toggle('active', x===m)
  );
}

// ── DO IMPORT ─────────────────────────────────────────────────
async function doImport() {
  if (!iRows.length) { toast('Sin datos','er'); return; }

  const mapping = {};
  iCols.forEach((col, i) => {
    const v = document.getElementById(`map-${i}`)?.value;
    if (v) mapping[i] = v;
  });

  const folderId = document.getElementById('impFolder').value || null;
  const btn = document.getElementById('impBtn');
  btn.textContent = 'Importando…'; btn.disabled = true;

  const newRecords = iRows.map(row => {
    // Step 1: collect raw values — sanitize placeholder text to empty
    const PLACEHOLDERS = new Set(['-','—','–','n/a','nd','no data','sin dato',
                                   'hay que buscarlo','buscar','pendiente','?','??']);
    const raw = {};
    iCols.forEach((col, i) => {
      const field = mapping[i];
      if (!field) return;
      const val = String(row[i]||'').trim();
      if (!val) return; // skip empty
      if (PLACEHOLDERS.has(val.toLowerCase())) return; // skip placeholder → treats as empty
      raw[field] = val;
    });

    // Step 2: determine type
    let resolvedType = null;
    let derivedClientStatus = null;
    let derivedMainStatus   = null;

    if (raw.type) {
      const t = normType(raw.type);
      resolvedType = t || (activeView === 'clients' ? 'client' : 'prospect');
    }

    if (!resolvedType && raw.client_status_col) {
      const csc = resolveClientStatusCol(raw.client_status_col);
      if (csc) {
        resolvedType        = csc.type;
        derivedClientStatus = csc.client_status;
        derivedMainStatus   = csc.status;
      } else {
        resolvedType = activeView === 'clients' ? 'client' : 'prospect';
      }
    }

    if (!resolvedType) resolvedType = activeView === 'clients' ? 'client' : 'prospect';

    const isClient = resolvedType === 'client';

    // Step 3: build record
    const r = {
      // Core
      company:       (raw.company||'').trim(),
      email:         (raw.email||'').trim(),
      email2:        raw.email2  || null,
      email3:        raw.email3  || null,
      contact:       raw.contact || '',
      role:          raw.role    || '',
      country:       raw.country || '',
      city:          raw.city    || '',
      phone:         raw.phone   || '',
      program:       raw.program || '',
      version:       raw.version || '',
      notes:         raw.notes   || '',
      type:          resolvedType,
      client_type:   raw.client_type ? normClientType(raw.client_type) : 'public',
      priority:      raw.priority ? normPriority(raw.priority) : (isClient ? null : 'Media'),
      folder_id:     folderId,
      user_id:       currentUser?.id,
      // Client contacts
      it_name:       raw.it_name   || null,
      it_phone:      raw.it_phone  || null,
      it_email:      raw.it_email  || null,
      mgmt_name:     raw.mgmt_name  || null,
      mgmt_phone:    raw.mgmt_phone || null,
      mgmt_email:    raw.mgmt_email || null,
      // Maintenance
      maintenance:      raw.maintenance ? normMaintenance(raw.maintenance) : null,
      maintenance_date: normDate(raw.maintenance_date),
      // Email tracking — dates normalized to YYYY-MM-DD for Supabase
      email_to:      raw.email_to   || null,
      sent_date:     normDate(raw.sent_date),
      email_type:    raw.email_type || '',
      subject:       raw.subject    || '',
      sent_text:     raw.sent_text  || '',
      attachments:   (raw.attachments === '-' || raw.attachments === '—') ? '' : (raw.attachments || ''),
      reply_date:    normDate(raw.reply_date),
      reply_from:    raw.reply_from || '',
      reply_text:    raw.reply_text || '',
      next_followup: normDate(raw.next_followup),
    };

    // Step 4: status
    if (isClient) {
      if (derivedClientStatus) {
        r.client_status = derivedClientStatus;
        r.status        = derivedMainStatus || 'ok';
      } else if (raw.client_status) {
        r.client_status = normClientStatusVal(raw.client_status);
        r.status = (r.client_status==='lost'||r.client_status==='churned') ? 'lost' : 'ok';
      } else if (raw.status) {
        const cs = normClientStatusVal(raw.status);
        r.client_status = cs;
        r.status = (cs==='lost'||cs==='churned') ? 'lost' : 'ok';
      } else {
        r.client_status = 'ok'; r.status = 'ok';
      }
    } else {
      r.status        = raw.status ? normProspectStatus(raw.status) : 'new';
      r.client_status = null;
    }

    // Never send tags from import (DB expects array, we just omit it)
    delete r.tags;
    return r;
  }).filter(r => r.company || r.email);

  let added = 0, merged = 0, errors = 0;
  const errorList = [];

  try {
    if (iMode === 'replace' && folderId) {
      const toDelete = records.filter(r => r.folder_id===folderId).map(r => r.id);
      if (toDelete.length) await dbDeleteContacts(toDelete);
    }

    for (const rec of newRecords) {
      try {
        if (iMode === 'merge' && rec.email) {
          const existing = records.find(r =>
            r.email?.toLowerCase() === rec.email?.toLowerCase()
          );
          if (existing) {
            await dbSaveContact({...rec, id:existing.id});
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

    // Switch footer buttons
    document.getElementById('impCancelBtn').style.display = 'none';
    document.getElementById('impBtn').style.display       = 'none';
    document.getElementById('impCloseBtn').style.display  = '';
    document.getElementById('impMoreBtn').style.display   = '';

    document.getElementById('impWizard').style.display = 'none';
    document.getElementById('impResult').style.display  = '';
    document.getElementById('impResultMsg').innerHTML = `
      <div style="font-size:1.1rem;font-weight:700;color:var(--c-replied);margin-bottom:10px">✅ Importación completada</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${added>0  ? `<span class="imp-stat-ok">+${added} nuevos</span>` : ''}
        ${merged>0 ? `<span class="imp-stat-blue">${merged} actualizados</span>` : ''}
        ${errors>0 ? `<span class="imp-stat-er">${errors} con error</span>` : ''}
      </div>
      ${errors>0?`<div style="font-size:.75rem;color:var(--ink3);margin-top:6px">Errores: ${errorList.slice(0,5).join(', ')}${errorList.length>5?'…':''}</div>`:''}`;

  } catch(err) {
    toast('Error al importar: '+err.message,'er');
    console.error(err);
  }
  btn.textContent = '📥 Importar'; btn.disabled = false;
}
