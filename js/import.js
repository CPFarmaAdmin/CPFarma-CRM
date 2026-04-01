// ═══════════════════════════════════════════════════════════════
// IMPORT.JS — Importar contactos desde Excel / CSV
// ═══════════════════════════════════════════════════════════════

let iMode = 'add';
let iCols = [];
let iRows = [];

const FIELD_MAP = {
  company:       ['empresa','company','nombre empresa','nombre de la empresa','compañia','compañía'],
  email:         ['email','correo','e-mail','correo electrónico','mail'],
  contact:       ['contacto','contact','nombre contacto','persona de contacto','responsable'],
  role:          ['cargo','rol','role','puesto','posición','position'],
  country:       ['país','pais','country'],
  city:          ['ciudad','city','localidad','población'],
  phone:         ['teléfono','telefono','phone','tel','móvil','movil','celular'],
  sector:        ['sector','industria','industry'],
  priority:      ['prioridad','priority'],
  status:        ['estado','status'],
  type:          ['tipo','type','categoría','categoria'],
  sent_date:     ['fecha envío','fecha envio','sent_date','fecha contacto'],
  subject:       ['asunto','subject'],
  next_followup: ['próximo followup','proximo followup','next followup','fecha followup'],
  deal_product:  ['producto','product','servicio','interés'],
  deal_value:    ['valor','value','importe','presupuesto'],
  linkedin:      ['linkedin'],
  url:           ['web','url','website'],
  notes:         ['notas','notes','comentario','comentarios','observaciones'],
  tags:          ['etiquetas','tags'],
};

const FIELD_LABELS = {
  company:'Empresa ⚠️', email:'Email ⚠️', contact:'Contacto', role:'Cargo',
  country:'País', city:'Ciudad', phone:'Teléfono', sector:'Sector',
  priority:'Prioridad', status:'Estado', type:'Tipo (prospect/client)',
  sent_date:'Fecha envío', subject:'Asunto', next_followup:'Próx. Follow-up',
  deal_product:'Producto', deal_value:'Valor (€)', linkedin:'LinkedIn',
  url:'Web', notes:'Notas/Comentarios', tags:'Etiquetas',
};

function autoMapField(colName) {
  const c = (colName||'').toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  for (const [field, aliases] of Object.entries(FIELD_MAP)) {
    if (aliases.some(a => {
      const n = a.normalize('NFD').replace(/[\u0300-\u036f]/g,'');
      return c === n || c.includes(n);
    })) return field;
  }
  return '';
}

function openImport() {
  document.getElementById('impWizard').style.display = '';
  document.getElementById('impResult').style.display = 'none';
  ['impPrev','impMap','impFolderWrap','impModeWrap'].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.style.display = 'none';
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
        {val:'',label:'— No importar —'},
        ...Object.keys(FIELD_LABELS).map(k=>({val:k,label:FIELD_LABELS[k]})),
      ];

      document.getElementById('mapRows').innerHTML =
        iCols.map((col, i) => {
          const auto = autoMapped[i];
          const sample = iRows.slice(0,2).map(r=>String(r[i]||'').trim()).filter(Boolean).join(' / ');
          return `<div class="map-row">
            <div class="map-col-info">
              <div class="map-col-name">${escH(col)}</div>
              ${sample?`<div class="map-col-sample">${escH(sample.slice(0,50))}</div>`:''}
            </div>
            <span class="map-arrow">→</span>
            <select id="map-${i}" class="${auto?'map-sel-mapped':''}">
              ${allFields.map(o=>`<option value="${o.val}"${o.val===auto?' selected':''}>${o.label}</option>`).join('')}
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
    const r = {
      company:'', email:'', contact:'', role:'', country:'', city:'',
      phone:'', sector:'', priority:'Media', status:'new', type:'prospect',
      tags:[], folder_id:folderId, user_id:currentUser?.id,
    };
    iCols.forEach((col, i) => {
      const field = mapping[i];
      if (!field) return;
      const val = String(row[i]||'').trim();
      if (field === 'tags') {
        r.tags = val ? val.split(/[,;]/).map(t=>t.trim()).filter(Boolean) : [];
      } else {
        r[field] = val;
      }
    });
    // Normalize priority
    const pMap = {'alta':'Alta','media':'Media','baja':'Baja','high':'Alta','low':'Baja'};
    if (r.priority) r.priority = pMap[r.priority.toLowerCase()] || 'Media';
    // Normalize status
    const sMap = {'nuevo':'new','enviado':'sent','respondido':'replied','sin respuesta':'waiting','negociando':'negotiation','ganado':'won','perdido':'lost'};
    if (r.status) r.status = sMap[r.status.toLowerCase()] || 'new';
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
            await dbSaveContact({...rec, id:existing.id});
            if (notesText) {
              await dbAddInteraction({
                contact_id:existing.id, type:'comment',
                date:new Date().toISOString().split('T')[0],
                text:'[Importado] '+notesText, user_id:currentUser?.id,
              });
            }
            merged++; continue;
          }
        }
        const saved = await dbSaveContact(rec);
        if (notesText && saved?.id) {
          await dbAddInteraction({
            contact_id:saved.id, type:'comment',
            date:new Date().toISOString().split('T')[0],
            text:'[Importado] '+notesText, user_id:currentUser?.id,
          });
        }
        added++;
      } catch(rowErr) { console.error(rowErr); errors++; }
    }

    await loadContacts();
    renderSidebar(); renderTable(); renderFollowupBanner(); populateCountryFilter();

    document.getElementById('impWizard').style.display = 'none';
    document.getElementById('impResult').style.display = '';
    document.getElementById('impResultMsg').innerHTML = `
      <div style="font-size:1.1rem;font-weight:700;color:var(--c-replied);margin-bottom:10px">✅ Importación completada</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${added>0?`<span class="imp-stat-ok">+${added} nuevos</span>`:''}
        ${merged>0?`<span class="imp-stat-blue">${merged} actualizados</span>`:''}
        ${errors>0?`<span class="imp-stat-er">${errors} con error</span>`:''}
      </div>`;
  } catch(err) {
    toast('Error al importar: ' + err.message, 'er');
  }

  btn.textContent = '📥 Importar';
  btn.disabled = false;
}
