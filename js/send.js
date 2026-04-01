// ═══════════════════════════════════════════════════════════════
// SEND.JS — Flujo de envío de emails y plantillas
// ═══════════════════════════════════════════════════════════════

let sendStep      = 1;
let sendRecipIds  = [];
let sPrevIdx      = 0;
let sFilteredList = [];
let activeStdId   = null;

// ── OPEN / CLOSE ──────────────────────────────────────────────
function openSendModal(preselectedIds) {
  sendStep = 1;
  sendRecipIds = preselectedIds ? [...preselectedIds] : [];
  sPrevIdx = 0;

  renderSendTabs();
  const tpl = templates.find(t => t.id === activeStdId) || templates[0];
  if (tpl) {
    document.getElementById('sendBody').value    = tpl.body || '';
    document.getElementById('sendSubject').value = tpl.subject || '';
    activeStdId = tpl.id;
    renderSendTabs();
  }

  const sig = localStorage.getItem('cpfarma_sig') || '';
  if (sig) document.getElementById('sigHtml').value = sig;

  showSendStep(1);
  populateRecipList();  // pre-populate step 2
  document.getElementById('sendModal').classList.add('open');
}

function closeSendModal() {
  document.getElementById('sendModal').classList.remove('open');
}

// ── STEP NAVIGATION ──────────────────────────────────────────
function showSendStep(n) {
  sendStep = n;
  [1,2,3,4].forEach(i => {
    document.getElementById(`sendStep${i}`).style.display = i === n ? '' : 'none';
    const ms = document.getElementById(`mstep${i}`);
    if (ms) ms.className = 'mstep' + (i <= n ? ' active' : '');
  });

  const bk = document.getElementById('sendBack');
  const nx = document.getElementById('sendNext');
  bk.style.display = (n > 1 && n < 4) ? '' : 'none';

  if (n === 1) {
    nx.textContent = 'Siguiente →';
    nx.className = 'btn btn-primary';
    nx.style.display = '';
  } else if (n === 2) {
    nx.textContent = `Vista previa (${sendRecipIds.length} sel.) →`;
    nx.className = 'btn btn-primary';
    nx.style.display = '';
  } else if (n === 3) {
    nx.textContent = `✉️ Enviar (${sendRecipIds.length})`;
    nx.className = 'btn btn-send';
    nx.style.display = '';
  } else {
    nx.style.display = 'none';
    bk.style.display = 'none';
  }
}

function sBack() { if (sendStep > 1) showSendStep(sendStep - 1); }

function sNext() {
  if (sendStep === 1) {
    const body = document.getElementById('sendBody').value.trim();
    const subj = document.getElementById('sendSubject').value.trim();
    if (!body) { toast('Escribe el cuerpo del email', 'er'); return; }
    if (!subj) { toast('Escribe el asunto', 'er'); return; }
    populateRecipList();
    showSendStep(2);
  } else if (sendStep === 2) {
    if (!sendRecipIds.length) { toast('Selecciona al menos un destinatario', 'er'); return; }
    renderPreview();
    showSendStep(3);
  } else if (sendStep === 3) {
    doSend();
  }
}

// ── TEMPLATE TABS ─────────────────────────────────────────────
function renderSendTabs() {
  const container = document.getElementById('sendStdTabs');
  if (!templates.length) {
    container.innerHTML = '<div style="font-size:.78rem;color:var(--ink3)">No hay plantillas. Créalas en Plantillas.</div>';
    return;
  }
  container.innerHTML = templates.map(t =>
    `<div class="tpl-tab ${t.id === activeStdId ? 'active' : ''}" onclick="setSendTab('${t.id}')">${escH(t.name)}</div>`
  ).join('');
}

function setSendTab(id) {
  activeStdId = id;
  const tpl = templates.find(t => t.id === id);
  if (tpl) {
    document.getElementById('sendBody').value    = tpl.body || '';
    document.getElementById('sendSubject').value = tpl.subject || '';
  }
  renderSendTabs();
}

// ── RECIPIENTS — filters ──────────────────────────────────────
function populateRecipList() {
  // Populate folder filter dropdown
  const fsel = document.getElementById('recipFolderFilter');
  const prevF = fsel.value;
  fsel.innerHTML = '<option value="">📬 Todas las carpetas</option>' +
    folders.map(f => `<option value="${f.id}">${f.icon||'📁'} ${f.name}</option>`).join('');
  if (prevF) fsel.value = prevF;

  // Render folder quick-select buttons
  const qs = document.getElementById('folderQuickSelect');
  if (qs) {
    const folderCounts = {};
    records.forEach(r => { if (r.folder_id) folderCounts[r.folder_id] = (folderCounts[r.folder_id]||0)+1; });
    qs.innerHTML = '<span style="font-size:.68rem;color:var(--ink3);font-family:var(--fm);align-self:center">Seleccionar carpeta:</span>' +
      folders.map(f => {
        const n = folderCounts[f.id] || 0;
        const allSel = n > 0 && records.filter(r=>r.folder_id===f.id&&r.email).every(r=>sendRecipIds.includes(r.id));
        return `<button class="folder-quick-btn${allSel?' all-sel':''}" onclick="toggleFolderSel('${f.id}')">
          ${f.icon||'📁'} ${f.name} <span style="opacity:.6">(${n})</span>
        </button>`;
      }).join('');
  }

  // Reset country filter populated flag so it refreshes
  const cEl = document.getElementById('recipCountryFilter');
  if (cEl) delete cEl.dataset.populated;

  filterRecip();
}

function toggleFolderSel(fid) {
  const inFolder = records.filter(r => r.email && r.folder_id === fid);
  const allAlreadySel = inFolder.every(r => sendRecipIds.includes(r.id));
  if (allAlreadySel) {
    // Deselect all in this folder
    sendRecipIds = sendRecipIds.filter(id => !inFolder.find(r=>r.id===id));
  } else {
    // Select all in this folder
    inFolder.forEach(r => { if (!sendRecipIds.includes(r.id)) sendRecipIds.push(r.id); });
  }
  filterRecip();
  populateRecipList();
}

function filterRecip() {
  const q       = (document.getElementById('recipSearch')?.value || '').toLowerCase();
  const fid     = document.getElementById('recipFolderFilter')?.value || '';
  const status  = document.getElementById('recipStatusFilter')?.value || '';
  const prio    = document.getElementById('recipPrioFilter')?.value || '';
  const country = document.getElementById('recipCountryFilter')?.value || '';
  const body    = document.getElementById('sendBody').value;

  // Populate country filter dynamically
  const countryEl = document.getElementById('recipCountryFilter');
  if (countryEl && !countryEl.dataset.populated) {
    const countries = [...new Set(records.map(r=>r.country).filter(Boolean))].sort();
    countryEl.innerHTML = '<option value="">Todos los países</option>' +
      countries.map(c=>`<option value="${c}">${c}</option>`).join('');
    countryEl.dataset.populated = '1';
  }

  sFilteredList = records.filter(r => {
    if (!r.email) return false;
    if (fid     && r.folder_id !== fid) return false;
    if (status  && r.status !== status) return false;
    if (prio    && r.priority !== prio) return false;
    if (country && r.country !== country) return false;
    if (q && ![r.company,r.contact,r.email,r.country,r.city].join(' ').toLowerCase().includes(q)) return false;
    return true;
  });

  const info = document.getElementById('recipCount');
  info.textContent = `${sFilteredList.length} contacto${sFilteredList.length!==1?'s':''} con email · ${sendRecipIds.length} seleccionado${sendRecipIds.length!==1?'s':''}`;

  document.getElementById('recipItems').innerHTML = sFilteredList.map(r => {
    const preview = personalise(body, r).slice(0, 60) + '…';
    const checked = sendRecipIds.includes(r.id) ? 'checked' : '';
    const statusBadge = renderBadge(r.status);
    return `
    <div class="recip-item" onclick="toggleRecip('${r.id}',event)">
      <input type="checkbox" class="chk" ${checked} data-id="${r.id}"
        onclick="event.stopPropagation();toggleRecipChk(this)">
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:6px">
          <span class="recip-company">${escH(r.company)}</span>
          ${statusBadge}
        </div>
        <div class="recip-email">${r.email}</div>
        ${r.country||r.city ? `<div style="font-size:.68rem;color:var(--ink3)">${[r.city,r.country].filter(Boolean).join(', ')}</div>` : ''}
      </div>
      <div class="recip-preview">${escH(preview)}</div>
    </div>`;
  }).join('');

  // Sync checkboxes with current selection
  document.querySelectorAll('#recipItems .chk').forEach(chk => {
    chk.checked = sendRecipIds.includes(chk.dataset.id);
  });

  updateSelChips();
  updateSelCount();
}

function toggleRecip(id, e) {
  if (e?.target?.type === 'checkbox') return;
  const i = sendRecipIds.indexOf(id);
  if (i >= 0) sendRecipIds.splice(i, 1);
  else sendRecipIds.push(id);
  filterRecip();
}

function toggleRecipChk(chk) {
  const id = chk.dataset.id;
  const i  = sendRecipIds.indexOf(id);
  if (chk.checked && i < 0) sendRecipIds.push(id);
  else if (!chk.checked && i >= 0) sendRecipIds.splice(i, 1);
  updateSelChips();
  updateSelCount();
}

function toggleSelAllRecip(chk) {
  if (chk.checked) sFilteredList.forEach(r => { if (!sendRecipIds.includes(r.id)) sendRecipIds.push(r.id); });
  else sFilteredList.forEach(r => { sendRecipIds = sendRecipIds.filter(x => x !== r.id); });
  filterRecip();
}

// Select all in a specific folder
function selectFolder(fid) {
  const inFolder = records.filter(r => r.email && r.folder_id === fid);
  inFolder.forEach(r => { if (!sendRecipIds.includes(r.id)) sendRecipIds.push(r.id); });
  filterRecip();
}

function updateSelChips() {
  const el = document.getElementById('selChips');
  if (!sendRecipIds.length) {
    el.innerHTML = '<span style="font-size:.73rem;color:var(--ink3);padding:4px">Ninguno seleccionado</span>';
    return;
  }
  el.innerHTML = sendRecipIds.map(id => {
    const r = records.find(x => x.id === id);
    if (!r) return '';
    return `<div class="sel-chip">${escH(r.company)}<span class="sel-chip-remove" onclick="removeSR('${id}')">✕</span></div>`;
  }).join('');
}

function removeSR(id) {
  sendRecipIds = sendRecipIds.filter(x => x !== id);
  filterRecip();
}

function clearAllRecip() {
  sendRecipIds = [];
  filterRecip();
}

function updateSelCount() {
  document.getElementById('selCount').textContent = sendRecipIds.length ? `${sendRecipIds.length} sel.` : '';
  if (sendStep === 2) {
    document.getElementById('sendNext').textContent = `Vista previa (${sendRecipIds.length} sel.) →`;
  }
}

// ── PREVIEW ───────────────────────────────────────────────────
function renderPreview() {
  sPrevIdx = 0;
  showPreviewItem();
}

function showPreviewItem() {
  const id = sendRecipIds[sPrevIdx];
  const r  = records.find(x => x.id === id);
  if (!r) return;

  const body = document.getElementById('sendBody').value;
  const subj = document.getElementById('sendSubject').value;

  document.getElementById('prevCo').textContent   = r.company;
  document.getElementById('prevIdx').textContent  = `${sPrevIdx + 1} / ${sendRecipIds.length}`;
  document.getElementById('prevTo').textContent   = r.email;
  document.getElementById('prevSubj').textContent = personalise(subj, r);

  const pBody    = escH(personalise(body, r));
  const company  = escH(r.company || r.contact || '');
  const highlighted = company ? pBody.split(company).join(`<mark>${company}</mark>`) : pBody;
  document.getElementById('prevBody').innerHTML = highlighted;
}

function prevPrev() { if (sPrevIdx > 0) { sPrevIdx--; showPreviewItem(); } }
function prevNext() { if (sPrevIdx < sendRecipIds.length-1) { sPrevIdx++; showPreviewItem(); } }

// ── SEND ──────────────────────────────────────────────────────
async function doSend() {
  showSendStep(4);

  const body   = document.getElementById('sendBody').value;
  const subj   = document.getElementById('sendSubject').value;
  const useSig = document.getElementById('useSig')?.checked;
  const sigTxt = document.getElementById('sigHtml')?.value || '';
  const webmail = (WEBMAIL_URL || 'https://webmail.cpfarma.es').replace(/\/login$/,'');

  const total = sendRecipIds.length;
  let done = 0;
  const log = document.getElementById('sLog');
  log.innerHTML = '';

  const next = async () => {
    if (done >= total) {
      document.getElementById('sProgLabel').textContent = '✅ Completado';
      document.getElementById('sProgPct').textContent   = '100%';
      document.getElementById('sProgBar').style.width   = '100%';
      document.getElementById('sDoneMsg').style.display = '';
      await loadContacts();
      renderTable(); renderSidebar(); renderFollowupBanner();
      return;
    }

    const id  = sendRecipIds[done];
    const r   = records.find(x => x.id === id);
    const pct = Math.round((done / total) * 100);

    document.getElementById('sProgLabel').textContent = `Enviando ${done+1} de ${total}…`;
    document.getElementById('sProgPct').textContent   = pct + '%';
    document.getElementById('sProgBar').style.width   = pct + '%';

    if (!r?.email) {
      log.innerHTML += `<div class="sk">⊘ Sin email: ${escH(r?.company||id)}</div>`;
      done++; setTimeout(next, 50); return;
    }

    let pBody = personalise(body, r);
    if (useSig && sigTxt) pBody += '\n\n-- \n' + sigTxt.replace(/<[^>]*>/g,'');
    const pSubj = personalise(subj, r);

    window.open(
      `${webmail}/?_task=mail&_action=compose&_to=${encodeURIComponent(r.email)}&_subject=${encodeURIComponent(pSubj)}&_body=${encodeURIComponent(pBody)}`,
      '_blank'
    );

    try {
      const today = new Date().toISOString().split('T')[0];
      await dbSaveContact({
        id: r.id, status:'sent',
        sent_date: r.sent_date || today,
        subject: pSubj,
        email_type: templates.find(t=>t.id===activeStdId)?.name || 'Email',
      });
      await dbAddInteraction({
        contact_id:r.id, type:'sent', date:today,
        text:`Asunto: ${pSubj}`, user_id:currentUser?.id,
      });
      log.innerHTML += `<div class="ok">✅ ${escH(r.company)} — ${r.email}</div>`;
    } catch(err) {
      log.innerHTML += `<div class="er">⚠️ ${escH(r.company)} — error al guardar estado</div>`;
    }

    log.scrollTop = log.scrollHeight;
    done++;
    setTimeout(next, 900);
  };

  next();
}

function personalise(text, r) {
  return (text||'').replace(/\[Name\]/gi, r.company || r.contact || '[Name]');
}

// ── SIGNATURE ─────────────────────────────────────────────────
function toggleSigEdit() {
  const el = document.getElementById('sigEditArea');
  el.style.display = el.style.display === 'none' ? '' : 'none';
}
function previewSig() {
  const h = document.getElementById('sigHtml').value;
  const box = document.getElementById('sigPreviewBox');
  box.style.display = '';
  box.innerHTML = h || '<span style="color:var(--ink3)">Sin firma</span>';
}
function saveSig() {
  localStorage.setItem('cpfarma_sig', document.getElementById('sigHtml').value);
  toast('✅ Firma guardada', 'ok');
}

// ── TEMPLATES MODAL ───────────────────────────────────────────
function openTplModal() {
  renderTplList();
  document.getElementById('tplModal').classList.add('open');
}
function closeTplModal() {
  document.getElementById('tplModal').classList.remove('open');
}

function renderTplList() {
  const el = document.getElementById('tplList');
  if (!templates.length) {
    el.innerHTML = '<div style="color:var(--ink3);font-size:.82rem;font-style:italic;padding:8px 0">No hay plantillas. Crea la primera.</div>';
    return;
  }
  el.innerHTML = templates.map(t => `
    <div class="tpl-item">
      <div class="tpl-item-header">
        <span class="tpl-item-name">${escH(t.name)}</span>
        <button class="btn btn-ghost btn-sm" onclick="editTplInline('${t.id}')">✏️ Editar</button>
        <button class="btn btn-danger btn-sm" onclick="deleteTpl('${t.id}')">🗑</button>
      </div>
      <div style="font-size:.72rem;color:var(--ink3);margin-bottom:5px;font-family:var(--fm)">📧 ${escH(t.subject||'—')}</div>
      <div id="tpl-preview-${t.id}" class="tpl-item-body">${escH((t.body||'').slice(0,120))}${(t.body||'').length>120?'…':''}</div>
      <div id="tpl-edit-${t.id}" style="display:none">
        <div class="form-group"><label>Nombre</label><input type="text" id="te-name-${t.id}" value="${escH(t.name)}"></div>
        <div class="form-group"><label>Asunto</label><input type="text" id="te-subj-${t.id}" value="${escH(t.subject||'')}"></div>
        <div class="form-group"><label>Cuerpo <span style="font-size:.68rem;color:var(--ink3)">(usa [Name] para personalizar)</span></label>
          <textarea id="te-body-${t.id}" rows="7">${escH(t.body||'')}</textarea></div>
        <div style="display:flex;gap:6px;margin-top:6px">
          <button class="btn btn-primary btn-sm" onclick="saveTplInline('${t.id}')">💾 Guardar</button>
          <button class="btn btn-ghost btn-sm" onclick="cancelTplEdit('${t.id}')">Cancelar</button>
        </div>
      </div>
    </div>`).join('');
}

function editTplInline(id) {
  document.getElementById(`tpl-preview-${id}`).style.display = 'none';
  document.getElementById(`tpl-edit-${id}`).style.display = '';
}
function cancelTplEdit(id) {
  document.getElementById(`tpl-preview-${id}`).style.display = '';
  document.getElementById(`tpl-edit-${id}`).style.display = 'none';
}
async function saveTplInline(id) {
  const name    = document.getElementById(`te-name-${id}`).value.trim();
  const subject = document.getElementById(`te-subj-${id}`).value.trim();
  const body    = document.getElementById(`te-body-${id}`).value;
  if (!name) { toast('El nombre es obligatorio', 'er'); return; }
  try {
    await dbSaveTemplate({id, name, subject, body});
    await loadTemplates();
    renderTplList();
    renderSendTabs();
    toast('✅ Plantilla actualizada', 'ok');
  } catch(err) { toast('Error: '+err.message, 'er'); }
}

async function addTpl() {
  const maxPos = templates.length ? Math.max(...templates.map(t=>t.position||0)) : 0;
  try {
    await dbSaveTemplate({
      name: 'Nueva plantilla',
      subject: '',
      body: 'Estimado/a [Name],\n\n\n\nSaludos,\nCP Farma',
      position: maxPos + 1,
    });
    await loadTemplates();
    renderTplList();
    toast('✅ Plantilla creada', 'ok');
  } catch(err) { toast('Error: '+err.message, 'er'); }
}

async function deleteTpl(id) {
  if (!confirm('¿Eliminar esta plantilla?')) return;
  try {
    await dbDeleteTemplate(id);
    await loadTemplates();
    renderTplList();
    renderSendTabs();
    toast('🗑 Plantilla eliminada', 'er');
  } catch(err) { toast('Error: '+err.message, 'er'); }
}
