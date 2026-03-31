// ═══════════════════════════════════════════════════════════════
// IMPORT.JS — Importar contactos desde Excel / CSV
// ═══════════════════════════════════════════════════════════════

let iMode = 'add';
let iCols = [];
let iRows = [];

// Column name → field mapping
const FIELD_MAP = {
  company:    ['empresa', 'company', 'nombre de la empresa', 'nombre'],
  email:      ['email', 'correo', 'e-mail'],
  contact:    ['contacto', 'contact', 'nombre contacto', 'nombre y apellidos'],
  role:       ['cargo', 'rol', 'role', 'puesto'],
  country:    ['país', 'pais', 'country'],
  city:       ['ciudad', 'city'],
  phone:      ['teléfono', 'telefono', 'phone', 'tel'],
  sector:     ['sector', 'industry'],
  priority:   ['prioridad', 'priority'],
  status:     ['estado', 'status'],
  sent_date:  ['fecha envío', 'fecha envio', 'sent_date', 'fecha'],
  subject:    ['asunto', 'subject'],
  notes:      ['notas', 'notes', 'comentario', 'comentarios'],
};

function autoMapField(colName) {
  const c = colName.toLowerCase().trim();
  for (const [field, aliases] of Object.entries(FIELD_MAP)) {
    if (aliases.some(a => c.includes(a))) return field;
  }
  return '';
}

// ── OPEN / CLOSE ──────────────────────────────────────────────
function openImport() {
  ['impPrev', 'impMap', 'impFolderWrap', 'impModeWrap'].forEach(id => {
    document.getElementById(id).style.display = 'none';
  });
  document.getElementById('impBtn').style.display = 'none';
  document.getElementById('fInput').value = '';
  iCols = []; iRows = [];

  // Populate folder select
  const fsel = document.getElementById('impFolder');
  fsel.innerHTML = '<option value="">— Sin carpeta —</option>' +
    folders.map(f => `<option value="${f.id}">${f.icon || '📁'} ${f.name}</option>`).join('');

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
  const ext    = file.name.split('.').pop().toLowerCase();
  const reader = new FileReader();

  reader.onload = e => {
    try {
      let wb;
      if (ext === 'csv') wb = XLSX.read(e.target.result, { type: 'string' });
      else               wb = XLSX.read(e.target.result, { type: 'array' });

      const ws   = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

      if (!json.length) { toast('❌ Archivo vacío', 'er'); return; }

      iCols = json[0].map(c => String(c).trim());
      iRows = json.slice(1).filter(r => r.some(c => String(c).trim() !== ''));

      // Show preview info
      document.getElementById('impPrev').style.display = '';
      document.getElementById('impPrev').innerHTML = `
        <div style="background:var(--paper2);border-radius:7px;padding:9px 12px;font-size:.82rem;border:1px solid var(--border)">
          <strong>📊 ${escH(file.name)}</strong>
          <div style="font-family:var(--fm);font-size:.72rem;color:var(--ink3);margin-top:3px">
            ${iRows.length} filas · ${iCols.length} columnas
          </div>
        </div>`;

      // Column mapping UI
      document.getElementById('impMap').style.display = '';
      const allFields = [
        { val: '', label: '— No importar —' },
        ...Object.keys(FIELD_MAP).map(k => ({ val: k, label: k })),
      ];
      document.getElementById('mapRows').innerHTML = iCols.map((col, i) => {
        const auto = autoMapField(col);
        return `
          <div class="map-row">
            <span class="map-col-name">${escH(col)}</span>
            <span style="color:var(--ink3)">→</span>
            <select id="map-${i}">
              ${allFields.map(o => `<option value="${o.val}" ${o.val === auto ? 'selected' : ''}>${o.label}</option>`).join('')}
            </select>
          </div>`;
      }).join('');

      document.getElementById('impFolderWrap').style.display = '';
      document.getElementById('impModeWrap').style.display   = '';
      document.getElementById('impBtn').style.display        = '';
      setIMode('add');
    } catch (err) {
      toast('❌ Error al leer el archivo: ' + err.message, 'er');
    }
  };

  if (ext === 'csv') reader.readAsText(file);
  else               reader.readAsArrayBuffer(file);
}

function setIMode(m) {
  iMode = m;
  ['add', 'merge', 'replace'].forEach(x => {
    document.getElementById(`m-${x}`).classList.toggle('active', x === m);
  });
}

// ── DO IMPORT ─────────────────────────────────────────────────
async function doImport() {
  if (!iRows.length) { toast('❌ Sin datos para importar', 'er'); return; }

  const mapping = {};
  iCols.forEach((col, i) => {
    const v = document.getElementById(`map-${i}`)?.value;
    if (v) mapping[i] = v;
  });

  const folderId = document.getElementById('impFolder').value || null;
  const btn      = document.getElementById('impBtn');
  btn.textContent = 'Importando…';
  btn.disabled    = true;

  // Build records array
  const newRecords = iRows.map(row => {
    const r = {
      company: '', email: '', contact: '', role: '', country: '', city: '',
      phone: '', sector: '', priority: 'Media', status: 'new', tags: [],
      folder_id: folderId, type: 'prospect', user_id: currentUser?.id,
    };
    iCols.forEach((col, i) => {
      if (mapping[i]) r[mapping[i]] = String(row[i] || '').trim();
    });
    return r;
  }).filter(r => r.company || r.email);

  try {
    let added = 0, merged = 0;

    if (iMode === 'replace' && folderId) {
      // Delete all contacts in that folder first
      const toDelete = records.filter(r => r.folder_id === folderId).map(r => r.id);
      if (toDelete.length) await dbDeleteContacts(toDelete);
    }

    for (const rec of newRecords) {
      if (iMode === 'merge' && rec.email) {
        const existing = records.find(r =>
          r.email?.toLowerCase() === rec.email?.toLowerCase()
        );
        if (existing) {
          await dbSaveContact({ ...rec, id: existing.id });
          merged++;
          continue;
        }
      }

      // Extract notes if present
      const notesText = rec.notes;
      delete rec.notes;

      const saved = await dbSaveContact(rec);

      // Import notes as interaction
      if (notesText && saved.id) {
        await dbAddInteraction({
          contact_id: saved.id,
          type: 'comment',
          date: new Date().toISOString().split('T')[0],
          text: notesText,
          user_id: currentUser?.id,
        });
      }
      added++;
    }

    await loadContacts();
    renderSidebar();
    renderTable();
    renderFollowupBanner();
    populateCountryFilter();
    closeImport();
    toast(`✅ ${added} nuevos${merged ? `, ${merged} actualizados` : ''}`, 'ok');
  } catch (err) {
    toast('Error al importar: ' + err.message, 'er');
  }

  btn.textContent = '📥 Importar';
  btn.disabled    = false;
}
