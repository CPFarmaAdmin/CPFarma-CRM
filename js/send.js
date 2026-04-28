// ═══════════════════════════════════════════════════════════════
// SEND.JS — Flujo de envío + adjuntos guardados + plantillas
// ═══════════════════════════════════════════════════════════════

let sendStep      = 1;
let sendRecipIds  = [];
let sendCcMap     = {};   // { recordId: [email, email2, ...] } — CC emails per recipient
let sPrevIdx      = 0;
let sFilteredList = [];
let activeStdId   = null;
let savedAttach   = [];

// ── SAVED ATTACHMENTS ─────────────────────────────────────────
function loadSavedAttach() {
  try { savedAttach = JSON.parse(localStorage.getItem('cpfarma_attach') || '[]'); }
  catch(e) { savedAttach = []; }
}

function saveFavAttach(files) {
  loadSavedAttach();
  [...files].forEach(file => {
    if (savedAttach.find(a => a.name === file.name)) return; // no duplicates
    savedAttach.push({ id: Date.now() + '_' + Math.random().toString(36).slice(2), name: file.name, size: file.size, active: false });
  });
  try { localStorage.setItem('cpfarma_attach', JSON.stringify(savedAttach)); }
  catch(e) {}
  renderSavedAttach();
  document.getElementById('savedAttachInput').value = '';
}

function toggleAttach(id) {
  const a = savedAttach.find(x => x.id === id);
  if (a) a.active = !a.active;
  renderSavedAttach();
}

function deleteAttach(id) {
  savedAttach = savedAttach.filter(a => a.id !== id);
  try { localStorage.setItem('cpfarma_attach', JSON.stringify(savedAttach)); }
  catch(e) {}
  renderSavedAttach();
}

function getActiveAttachNames() {
  return savedAttach.filter(a => a.active).map(a => a.name);
}

function renderSavedAttach() {
  const el = document.getElementById('savedAttachList');
  if (!el) return;
  if (!savedAttach.length) {
    el.innerHTML = '<span style="font-size:.73rem;color:var(--ink3);font-style:italic">Sin adjuntos guardados. Añade catálogos, fichas técnicas…</span>';
    return;
  }
  el.innerHTML = savedAttach.map(a =>
    `<div class="saved-attach-chip ${a.active ? 'active' : ''}" onclick="toggleAttach('${a.id}')">
      📎 ${escH(a.name)}
      ${a.active ? '<span style="font-size:.65rem">✓</span>' : ''}
      <span class="del-attach" onclick="event.stopPropagation();deleteAttach('${a.id}')">🗑</span>
    </div>`
  ).join('');
}

// ── OPEN / CLOSE ──────────────────────────────────────────────
function openSendModal(preselectedIds, skipToStep2 = false) {
  sendStep     = 1;
  sendRecipIds = preselectedIds ? [...preselectedIds] : [];
  sendCcMap    = {}; // reset CC selections
  sPrevIdx     = 0;

  loadSavedAttach();
  renderSendTabs();
  renderSavedAttach();

  const tpl = templates.find(t => t.id === activeStdId) || templates[0];
  if (tpl) {
    document.getElementById('sendBody').value    = tpl.body    || '';
    document.getElementById('sendSubject').value = tpl.subject || '';
    activeStdId = tpl.id;
    renderSendTabs();
  }

  const sig = localStorage.getItem('cpfarma_sig') || '';
  if (sig) document.getElementById('sigHtml').value = sig;

  populateRecipList();
  document.getElementById('sendModal').classList.add('open');

  if (skipToStep2 && preselectedIds?.length === 1) {
    // Skip directly to step 2 so user sees contact/CC selection immediately
    showSendStep(2);
  } else {
    showSendStep(1);
  }
}

function closeSendModal() {
  document.getElementById('sendModal').classList.remove('open');
}

// ── STEPS ─────────────────────────────────────────────────────
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
  if (n === 1) { nx.textContent = 'Siguiente →'; nx.className = 'btn btn-primary'; nx.style.display = ''; }
  else if (n === 2) { nx.textContent = `Vista previa (${sendRecipIds.length} sel.) →`; nx.className = 'btn btn-primary'; nx.style.display = ''; }
  else if (n === 3) { nx.textContent = `✉️ Preparar envíos (${sendRecipIds.length})`; nx.className = 'btn btn-send'; nx.style.display = ''; }
  else {
    nx.style.display = 'none';
    bk.style.display = 'none';
    // Replace Cancelar with Cerrar in step 4
    const cancelBtn = document.querySelector('#sendModal .modal-footer .btn-ghost');
    if (cancelBtn) cancelBtn.textContent = 'Cerrar';
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
  const el = document.getElementById('sendStdTabs');
  if (!el) return;
  if (!templates.length) {
    el.innerHTML = '<div style="font-size:.78rem;color:var(--ink3)">No hay plantillas. Créalas en Plantillas.</div>';
    return;
  }
  el.innerHTML = templates.map(t =>
    `<div class="tpl-tab ${t.id === activeStdId ? 'active' : ''}" onclick="setSendTab('${t.id}')">${escH(t.name)}</div>`
  ).join('');
}

function setSendTab(id) {
  activeStdId = id;
  const tpl = templates.find(t => t.id === id);
  if (tpl) {
    document.getElementById('sendBody').value    = tpl.body    || '';
    document.getElementById('sendSubject').value = tpl.subject || '';
  }
  renderSendTabs();
}

// ── RECIPIENTS ────────────────────────────────────────────────
function populateRecipList() {
  const fsel   = document.getElementById('recipFolderFilter');
  const prevF  = fsel.value;
  fsel.innerHTML = '<option value="">📬 Todas las carpetas</option>' +
    folders.map(f => `<option value="${f.id}">${f.icon||'📁'} ${f.name}</option>`).join('');
  if (prevF) fsel.value = prevF;

  // Folder quick buttons
  const qs = document.getElementById('folderQuickSelect');
  if (qs) {
    const fc = {};
    records.forEach(r => { if (r.folder_id) fc[r.folder_id] = (fc[r.folder_id]||0)+1; });
    qs.innerHTML = '<span style="font-size:.68rem;color:var(--ink3);font-family:var(--fm);align-self:center">Seleccionar carpeta:</span>' +
      folders.map(f => {
        const n = fc[f.id] || 0;
        const allSel = n > 0 && records.filter(r => r.folder_id === f.id && r.email).every(r => sendRecipIds.includes(r.id));
        return `<button class="folder-quick-btn${allSel?' all-sel':''}" onclick="toggleFolderSel('${f.id}')">
          ${f.icon||'📁'} ${f.name} <span style="opacity:.6">(${n})</span>
        </button>`;
      }).join('');
  }

  // Reset country filter
  const cEl = document.getElementById('recipCountryFilter');
  if (cEl) {
    const countries = [...new Set(records.map(r => r.country).filter(Boolean))].sort();
    const prev = cEl.value;
    cEl.innerHTML = '<option value="">Todos los países</option>' +
      countries.map(c => `<option value="${c}">${c}</option>`).join('');
    if (prev) cEl.value = prev;
  }

  filterRecip();
}

function filterRecip() {
  const q       = (document.getElementById('recipSearch')?.value || '').toLowerCase();
  const fid     = document.getElementById('recipFolderFilter')?.value   || '';
  const type    = document.getElementById('recipTypeFilter')?.value     || '';
  const status  = document.getElementById('recipStatusFilter')?.value   || '';
  const prio    = document.getElementById('recipPrioFilter')?.value     || '';
  const country = document.getElementById('recipCountryFilter')?.value  || '';
  const body    = document.getElementById('sendBody').value;

  sFilteredList = records.filter(r => {
    if (!r.email) return false;
    if (fid    && r.folder_id !== fid)   return false;
    if (type   && r.type !== type)       return false;
    if (status && r.status !== status)   return false;
    if (prio   && r.priority !== prio)   return false;
    if (country && r.country !== country) return false;
    if (q && ![r.company, r.contact, r.email, r.country, r.city, r.program]
      .join(' ').toLowerCase().includes(q)) return false;
    return true;
  });

  const countEl = document.getElementById('recipCount');
  if (countEl) countEl.textContent =
    `${sFilteredList.length} contacto${sFilteredList.length!==1?'s':''} con email · ${sendRecipIds.length} seleccionado${sendRecipIds.length!==1?'s':''}`;

  const typeIcon = { prospect:'🎯', client:'💼' };
  document.getElementById('recipItems').innerHTML = sFilteredList.map(r => {
    const checked  = sendRecipIds.includes(r.id) ? 'checked' : '';
    const preview  = personalise(body, r).slice(0, 55) + '…';
    const contacts = getRecordContacts(r);
    const hasMulti = contacts.length > 1;
    const ccSelected = sendCcMap[r.id] || [];

    // CC panel: only shown when record is selected and has multiple emails
    // Show CC panel when: record is selected AND has multiple contacts
    // Also show when it's the only pre-selected record (from quickSend)
    const showCcPanel = hasMulti && (checked || (sendRecipIds.length === 1 && sendRecipIds[0] === r.id));
    const ccPanel = showCcPanel ? `
      <div class="recip-cc-panel">
        <div class="recip-cc-title">✉️ Destinatarios para este contacto</div>
        ${contacts.map((c, i) => `
          <div class="recip-cc-row">
            <label>
              <input type="checkbox" class="chk cc-chk"
                data-recid="${r.id}" data-email="${escH(c.email)}"
                ${i === 0 ? 'checked disabled' : (ccSelected.includes(c.email) ? 'checked' : '')}
                onclick="event.stopPropagation();toggleCc('${r.id}','${escH(c.email)}',this)">
              <span>${escH(c.name)}</span>
              <span class="cc-role">&nbsp;—&nbsp;${escH(c.role)}${i===0?' (Para)':' (CC)'}</span>
            </label>
          </div>`).join('')}
      </div>` : '';

    return `<div class="recip-item ${checked?'recip-selected':''}" onclick="toggleRecip('${r.id}',event)">
      <input type="checkbox" class="chk" ${checked} data-id="${r.id}" onclick="event.stopPropagation();toggleRecipChk(this)">
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:5px">
          <span style="font-size:.75rem">${typeIcon[r.type]||'📋'}</span>
          <span class="recip-company">${escH(r.company)}</span>
          ${r.type!=='client'?renderBadge(r.status):''}
          ${hasMulti?`<span style="font-size:.65rem;color:#1d4ed8;margin-left:4px">+${contacts.length-1} emails</span>`:''}
        </div>
        <div class="recip-email">${r.email}</div>
        ${r.country||r.city?`<div style="font-size:.67rem;color:var(--ink3)">${[r.city,r.country].filter(Boolean).join(', ')}</div>`:''}
        ${ccPanel || ''}
      </div>
      <div class="recip-preview" style="align-self:flex-start">${escH(preview)}</div>
    </div>`;
  }).join('');

  document.querySelectorAll('#recipItems .chk').forEach(chk => {
    chk.checked = sendRecipIds.includes(chk.dataset.id);
  });
  updateSelChips();
  updateSelCount();
}

function toggleFolderSel(fid) {
  const inFolder = records.filter(r => r.email && r.folder_id === fid);
  const allSel   = inFolder.every(r => sendRecipIds.includes(r.id));
  if (allSel) sendRecipIds = sendRecipIds.filter(id => !inFolder.find(r => r.id === id));
  else inFolder.forEach(r => { if (!sendRecipIds.includes(r.id)) sendRecipIds.push(r.id); });
  filterRecip();
  populateRecipList();
}

function toggleRecip(id, e) {
  if (e?.target?.type === 'checkbox') return;
  const i = sendRecipIds.indexOf(id);
  if (i >= 0) sendRecipIds.splice(i, 1); else sendRecipIds.push(id);
  filterRecip();
}
function toggleRecipChk(chk) {
  const id = chk.dataset.id;
  const i  = sendRecipIds.indexOf(id);
  if (chk.checked && i < 0) sendRecipIds.push(id);
  else if (!chk.checked && i >= 0) sendRecipIds.splice(i, 1);
  updateSelChips(); updateSelCount();
}
function toggleSelAllRecip(chk) {
  if (chk.checked) sFilteredList.forEach(r => { if (!sendRecipIds.includes(r.id)) sendRecipIds.push(r.id); });
  else sFilteredList.forEach(r => { sendRecipIds = sendRecipIds.filter(x => x !== r.id); });
  filterRecip();
}
function updateSelChips() {
  const el = document.getElementById('selChips');
  if (!el) return;
  if (!sendRecipIds.length) { el.innerHTML = '<span style="font-size:.73rem;color:var(--ink3)">Ninguno</span>'; return; }
  el.innerHTML = sendRecipIds.map(id => {
    const r = records.find(x => x.id === id);
    if (!r) return '';
    return `<div class="sel-chip">${escH(r.company)}<span class="sel-chip-remove" onclick="removeSR('${id}')">✕</span></div>`;
  }).join('');
}
function removeSR(id) { sendRecipIds = sendRecipIds.filter(x => x !== id); filterRecip(); }

function toggleCc(recId, email, chk) {
  if (!sendCcMap[recId]) sendCcMap[recId] = [];
  if (chk.checked) {
    if (!sendCcMap[recId].includes(email)) sendCcMap[recId].push(email);
  } else {
    sendCcMap[recId] = sendCcMap[recId].filter(e => e !== email);
  }
}
function clearAllRecip() { sendRecipIds = []; filterRecip(); }
function updateSelCount() {
  const el = document.getElementById('selCount');
  if (el) el.textContent = sendRecipIds.length ? `${sendRecipIds.length} sel.` : '';
  if (sendStep === 2) {
    const nx = document.getElementById('sendNext');
    if (nx) nx.textContent = `Vista previa (${sendRecipIds.length} sel.) →`;
  }
}

// ── PREVIEW ───────────────────────────────────────────────────
function renderPreview() {
  sPrevIdx = 0;
  showPreviewItem();
  // Hide nav arrows when only 1 recipient
  const single = sendRecipIds.length <= 1;
  const prevBtn = document.getElementById('prevPrevBtn');
  const nextBtn = document.getElementById('prevNextBtn');
  if (prevBtn) prevBtn.style.visibility = single ? 'hidden' : '';
  if (nextBtn) nextBtn.style.visibility = single ? 'hidden' : '';
}
function showPreviewItem() {
  const r = records.find(x => x.id === sendRecipIds[sPrevIdx]);
  if (!r) return;
  const body = document.getElementById('sendBody').value;
  const subj = document.getElementById('sendSubject').value;
  document.getElementById('prevCo').textContent   = r.company;
  document.getElementById('prevIdx').textContent  = `${sPrevIdx+1} / ${sendRecipIds.length}`;
  document.getElementById('prevTo').textContent   = r.email;
  document.getElementById('prevSubj').textContent = personalise(subj, r);
  const pBody     = escH(personalise(body, r));
  const company   = escH(r.company || '');
  document.getElementById('prevBody').innerHTML = company ? pBody.split(company).join(`<mark>${company}</mark>`) : pBody;
}
function prevPrev() { if (sPrevIdx > 0) { sPrevIdx--; showPreviewItem(); } }
function prevNext() { if (sPrevIdx < sendRecipIds.length - 1) { sPrevIdx++; showPreviewItem(); } }

// ── SEND ──────────────────────────────────────────────────────
async function doSend() {
  showSendStep(4);
  const body    = document.getElementById('sendBody').value;
  const subj    = document.getElementById('sendSubject').value;
  const useSig  = document.getElementById('useSig')?.checked;
  const sigTxt  = document.getElementById('sigHtml')?.value || '';
  const activeAttachNames = getActiveAttachNames();
  const todayStr = new Date().toISOString().split('T')[0];
  const tplName  = templates.find(t => t.id === activeStdId)?.name || 'Email';

  const total = sendRecipIds.length;
  const log   = document.getElementById('sLog');
  log.innerHTML = '';

  // Prepare all mailto links and save to DB upfront
  // We render each as a clickable link — the user clicks each one manually.
  // This bypasses browser popup blockers which block multiple window.open() calls.
  const items = [];
  for (const id of sendRecipIds) {
    const r = records.find(x => x.id === id);
    if (!r) continue;

    if (!r.email) {
      items.push({ r, mailtoUrl: null, pSubj: '', pBody: '' });
      continue;
    }

    let pBody = personalise(body, r);
    if (useSig && sigTxt) pBody += '\n\n-- \n' + sigTxt.replace(/<[^>]*>/g, '');
    const pSubj = personalise(subj, r);
    // Build mailto with optional CC for additional contacts
    const ccEmails = (sendCcMap[r.id] || []).filter(e => e !== r.email);
    let mailtoUrl = 'mailto:' + encodeURIComponent(r.email)
      + '?subject=' + encodeURIComponent(pSubj)
      + '&body='    + encodeURIComponent(pBody);
    if (ccEmails.length) mailtoUrl += '&cc=' + encodeURIComponent(ccEmails.join(','));
    items.push({ r, mailtoUrl, pSubj, pBody });

    // Save to DB immediately (mark as sent, save date, add history)
    try {
      const newStatus = (r.type !== 'client' && (!r.status || r.status === 'new'))
        ? 'first_contact' : r.status;
      await dbSaveContact({
        id: r.id, status: newStatus, sent_date: todayStr,
        subject: pSubj, email_type: tplName, email_to: r.email,
        attachments: activeAttachNames.length ? activeAttachNames.join(', ') : r.attachments,
      });
      await dbAddInteraction({
        contact_id: r.id, type: 'sent', date: todayStr,
        text: `Plantilla: ${tplName}\nAsunto: ${pSubj}${activeAttachNames.length ? '\nAdjuntos: '+activeAttachNames.join(', ') : ''}`,
        user_id: currentUser?.id,
      });
    } catch(err) { console.error('DB save error', err); }
  }

  // Render clickable mailto links in the log
  // User clicks each button to open their email client for that recipient
  document.getElementById('sProgLabel').textContent = `${items.filter(i=>i.mailtoUrl).length} emails preparados — haz clic en cada uno para abrirlo`;
  document.getElementById('sProgPct').textContent   = '100%';
  document.getElementById('sProgBar').style.width   = '100%';

  items.forEach(({ r, mailtoUrl }) => {
    if (!mailtoUrl) {
      log.innerHTML += `<div class="sk">⊘ Sin email: ${escH(r?.company||'')}</div>`;
      return;
    }
    const ccForRow = (sendCcMap[r.id] || []).filter(e => e !== r.email);
    const ccLabel  = ccForRow.length ? `<span style="font-size:.67rem;color:#1d4ed8">CC: ${ccForRow.slice(0,2).join(', ')}${ccForRow.length>2?'…':''}</span>` : '';
    log.innerHTML += `
      <div class="send-item-row">
        <div style="flex:1;min-width:0">
          <div class="send-item-name">${escH(r.company)}</div>
          <div class="send-item-email">${escH(r.email)} ${ccLabel}</div>
        </div>
        <a class="btn btn-send btn-sm send-mailto-btn" href="${mailtoUrl}" target="_blank"
           onclick="this.closest('.send-item-row').classList.add('sent')">
          ✉️ Abrir en correo
        </a>
        <span class="send-check" style="display:none">✅</span>
      </div>`;
  });

  // When all links are rendered show the done message
  document.getElementById('sDoneMsg').style.display = '';
  log.scrollTop = log.scrollHeight;

  await loadContacts();
  renderBothTables(); renderSidebar(); renderFollowupBanner();
}

// Get all email contacts for a record as [{email, name, role}]
function getRecordContacts(r) {
  const contacts = [];
  if (r.email)      contacts.push({ email: r.email,     name: r.contact  || r.company, role: 'Principal' });
  if (r.email2)     contacts.push({ email: r.email2,    name: r.company,               role: 'Email 2' });
  if (r.email3)     contacts.push({ email: r.email3,    name: r.company,               role: 'Email 3' });
  if (r.it_email)   contacts.push({ email: r.it_email,  name: r.it_name  || 'Informática', role: 'Informática' });
  if (r.mgmt_email) contacts.push({ email: r.mgmt_email,name: r.mgmt_name|| 'Gerencia',    role: 'Gerencia' });
  return contacts;
}

function personalise(text, r) {
  // [Name] = contact person name first, fallback to company name
  const name = r.contact || r.company || '[Name]';
  return (text || '').replace(/\[Name\]/gi, name);
}

// ── SIGNATURE ─────────────────────────────────────────────────
function toggleSigEdit() {
  const el = document.getElementById('sigEditArea');
  el.style.display = el.style.display === 'none' ? '' : 'none';
}
function previewSig() {
  const h = document.getElementById('sigHtml').value;
  const b = document.getElementById('sigPreviewBox');
  b.style.display = '';
  b.innerHTML = h || '<span style="color:var(--ink3)">Sin firma</span>';
}
function saveSig() {
  localStorage.setItem('cpfarma_sig', document.getElementById('sigHtml').value);
  toast('✅ Firma guardada', 'ok');
}

// ── TEMPLATES MODAL ───────────────────────────────────────────
function openTplModal() { renderTplList(); document.getElementById('tplModal').classList.add('open'); }
function closeTplModal() { document.getElementById('tplModal').classList.remove('open'); }

function renderTplList() {
  const el = document.getElementById('tplList');
  if (!el) return;
  if (!templates.length) {
    el.innerHTML = '<div style="color:var(--ink3);font-size:.82rem;font-style:italic">No hay plantillas. Crea la primera.</div>';
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
      <div id="tpl-preview-${t.id}" class="tpl-item-body">${escH((t.body||'').slice(0,130))}${(t.body||'').length>130?'…':''}</div>
      <div id="tpl-edit-${t.id}" style="display:none">
        <div class="form-group"><label>Nombre</label><input type="text" id="te-name-${t.id}" value="${escH(t.name)}"></div>
        <div class="form-group"><label>Asunto</label><input type="text" id="te-subj-${t.id}" value="${escH(t.subject||'')}"></div>
        <div class="form-group">
          <label>Cuerpo <span style="font-size:.68rem;color:var(--ink3)">(usa [Name] para personalizar)</span></label>
          <textarea id="te-body-${t.id}" rows="8">${escH(t.body||'')}</textarea>
        </div>
        <div style="display:flex;gap:6px;margin-top:6px">
          <button class="btn btn-primary btn-sm" onclick="saveTplInline('${t.id}')">💾 Guardar</button>
          <button class="btn btn-ghost btn-sm" onclick="cancelTplEdit('${t.id}')">Cancelar</button>
        </div>
      </div>
    </div>`).join('');
}

function editTplInline(id)   { document.getElementById(`tpl-preview-${id}`).style.display='none'; document.getElementById(`tpl-edit-${id}`).style.display=''; }
function cancelTplEdit(id)   { document.getElementById(`tpl-preview-${id}`).style.display=''; document.getElementById(`tpl-edit-${id}`).style.display='none'; }
async function saveTplInline(id) {
  const name    = document.getElementById(`te-name-${id}`).value.trim();
  const subject = document.getElementById(`te-subj-${id}`).value.trim();
  const body    = document.getElementById(`te-body-${id}`).value;
  if (!name) { toast('El nombre es obligatorio', 'er'); return; }
  try {
    await dbSaveTemplate({ id, name, subject, body });
    await loadTemplates();
    renderTplList(); renderSendTabs();
    toast('✅ Plantilla actualizada', 'ok');
  } catch(err) { toast('Error: '+err.message, 'er'); }
}
async function addTpl() {
  const maxPos = templates.length ? Math.max(...templates.map(t => t.position||0)) : 0;
  try {
    await dbSaveTemplate({ name:'Nueva plantilla', subject:'', body:'Estimado/a [Name],\n\n\n\nSaludos,\nCP Farma', position:maxPos+1 });
    await loadTemplates(); renderTplList();
    toast('✅ Plantilla creada', 'ok');
  } catch(err) { toast('Error: '+err.message, 'er'); }
}
async function deleteTpl(id) {
  if (!confirm('¿Eliminar esta plantilla?')) return;
  try {
    await dbDeleteTemplate(id);
    await loadTemplates(); renderTplList(); renderSendTabs();
    toast('🗑 Eliminada', 'er');
  } catch(err) { toast('Error: '+err.message, 'er'); }
}
