// ═══════════════════════════════════════════════════════════════
// IMPORT.JS — Importar contactos desde Excel / CSV
// ═══════════════════════════════════════════════════════════════

let iMode = 'add';
let iCols = [];
let iRows = [];

// ── FIELD DEFINITIONS (issues 5 — only the fields we want) ───
const FIELD_MAP = {
  company:      ['empresa','company','nombre empresa','nombre de la empresa','compañia','nombre','cliente','prospecto'],
  email:        ['email','correo','e-mail','correo electrónico','mail'],
  contact:      ['contacto','contact','persona de contacto','nombre contacto','responsable'],
  role:         ['cargo','rol','role','puesto','posición','position'],
  country:      ['país','pais','country'],
  city:         ['ciudad','city','localidad'],
  phone:        ['teléfono','telefono','phone','tel','móvil','movil','celular'],
  priority:     ['prioridad','priority'],
  status:       ['estado','status'],
  type:         ['tipo','type'],
  program:      ['programa','program','producto','galenic','citostaticos'],
  version:      ['versión','version','ver'],
  notes:        ['notas','notes','comentario','comentarios','observaciones'],
  client_type:  ['tipo cliente','tipo de cliente','client type','público','publico','privado'],
};

const FIELD_LABELS = {
  company:     'Empresa / Nombre ⚠️',
  email:       'Email ⚠️',
  contact:     'Persona de contacto',
  role:        'Cargo',
  country:     'País',
  city:        'Ciudad',
  phone:       'Teléfono',
  priority:    'Prioridad (Alta/Media/Baja)',
  status:      'Estado',
  type:        'Tipo (Prospecto / Cliente)',
  program:     'Programa (Galenic Plus / Citostaticos)',
  version:     'Versión',
  notes:       'Notas / Comentarios',
  client_type: 'Tipo cliente (Público / Privado)',
};

function autoMapField(colName) {
  const c = (colName||'').toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  for (const [field, aliases] of Object.entries(FIELD_MAP)) {
    if (aliases.some(a => {
      const n = a.normalize('NFD').replace(/[\u0300-\u036f]/g,'');
      return c === n || c.includes(n) || n.includes(c);
    })) return field;
  }
  return '';
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

function dzDrag(e, on) {
  e.preventDefault();
  document.getElementById('dz').classList.toggle('drag', on);
}
function dzDrop(e) {
  e.preventDefault();
  dzDrag(e, false);
  const f = e.dataTransfer.files[0];
  if (f) handleFile(f);
}

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

      // File info
      document.getElementById('impPrev').style.display = '';
      document.getElementById('impPrev').innerHTML = `
        <div class="imp-file-info">
          <span>📊</span>
          <div><strong>${escH(file.name)}</strong>
          <div class="imp-file-meta">${iRows.length} filas · ${iCols.length} columnas detectadas</div></div>
          <button class="btn-link" onclick="document.getElementById('fInput').click()">Cambiar archivo</button>
        </div>`;

      // Column mapping — issue 10: NO sample data shown, just column name + arrow + select
      document.getElementById('impMap').style.display = '';
      const autoMapped = iCols.map(c => autoMapField(c));
      const allFields = [
        { val: '', label: '— No importar —' },
        ...Object.keys(FIELD_LABELS).map(k => ({ val: k, label: FIELD_LABELS[k] })),
      ];

      document.getElementById('mapRows').innerHTML =
        iCols.map((col, i) => {
          const auto = autoMapped[i];
          return `<div class="map-row">
            <span class="map-col-name">${escH(col)}</span>
            <span class="map-arrow">→</span>
            <select id="map-${i}" class="${auto ? 'map-sel-mapped' : ''}">
              ${allFields.map(o => `<option value="${o.val}"${o.val===auto?' selected':''}>${o.label}</option>`).join('')}
            </select>
          </div>`;
        }).join('');

      document.getElementById('impFolderWrap').style.display = '';
      document.getElementById('impModeWrap').style.display   = '';
      document.getElementById('impBtn').style.display        = '';
      setIMode('add');
    } catch (err) {
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

  // Normalize helpers
  const normPriority = v => {
    const m = { 'alta':'Alta','media':'Media','baja':'Baja','high':'Alta','low':'Baja','medium':'Media' };
    return m[(v||'').toLowerCase()] || 'Media';
  };
  const normType = v => {
    const m = { 'cliente':'client','client':'client','clientes':'client',
                'prospecto':'prospect','prospect':'prospect','prospectos':'prospect' };
    return m[(v||'').toLowerCase()] || 'prospect';
  };
  const normClientType = v => {
    const m = { 'público':'public','publico':'public','public':'public',
                'privado':'private','private':'private' };
    return m[(v||'').toLowerCase()] || 'public';
  };

  const newRecords = iRows.map(row => {
    const r = {
      company:'', email:'', contact:'', role:'', country:'', city:'', phone:'',
      priority:'Media', status:'new', type:'prospect', client_type:'public',
      program:'', version:'', folder_id:folderId, user_id:currentUser?.id,
    };
    iCols.forEach((col, i) => {
      const field = mapping[i];
      if (!field) return;
      const val = String(row[i]||'').trim();
      if      (field === 'priority')    r.priority    = normPriority(val);
      else if (field === 'type')        r.type        = normType(val);
      else if (field === 'client_type') r.client_type = normClientType(val);
      else r[field] = val;
    });
    return r;
  }).filter(r => r.company || r.email);

  let added = 0, merged = 0, errors = 0;

  try {
    if (iMode === 'replace' && folderId) {
      const toDelete = records.filter(r => r.folder_id === folderId).map(r => r.id);
      if (toDelete.length) await dbDeleteContacts(toDelete);
    }

    for (const rec of newRecords) {
      const notesText = rec.notes;
      delete rec.notes;
      try {
        if (iMode === 'merge' && rec.email) {
          const existing = records.find(r => r.email?.toLowerCase() === rec.email?.toLowerCase());
          if (existing) {
            await dbSaveContact({ ...rec, id: existing.id });
            if (notesText) {
              await dbAddInteraction({
                contact_id: existing.id, type:'comment',
                date: new Date().toISOString().split('T')[0],
                text: '[Importado] ' + notesText, user_id: currentUser?.id,
              });
            }
            merged++; continue;
          }
        }
        const saved = await dbSaveContact(rec);
        if (notesText && saved?.id) {
          await dbAddInteraction({
            contact_id: saved.id, type:'comment',
            date: new Date().toISOString().split('T')[0],
            text: '[Importado] ' + notesText, user_id: currentUser?.id,
          });
        }
        added++;
      } catch(rowErr) { console.error(rowErr); errors++; }
    }

    await loadContacts();
    renderSidebar(); renderBothTables(); renderFollowupBanner(); populateCountryFilter();

    document.getElementById('impWizard').style.display = 'none';
    document.getElementById('impResult').style.display = '';
    document.getElementById('impResultMsg').innerHTML = `
      <div style="font-size:1.1rem;font-weight:700;color:var(--c-replied);margin-bottom:10px">✅ Importación completada</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${added>0   ? `<span class="imp-stat-ok">+${added} nuevos</span>`        : ''}
        ${merged>0  ? `<span class="imp-stat-blue">${merged} actualizados</span>` : ''}
        ${errors>0  ? `<span class="imp-stat-er">${errors} con error</span>`      : ''}
      </div>`;
  } catch(err) {
    toast('Error al importar: ' + err.message, 'er');
  }

  btn.textContent = '📥 Importar';
  btn.disabled = false;
}
