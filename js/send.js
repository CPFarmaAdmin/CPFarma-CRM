// ═══════════════════════════════════════════════════════════════
// SEND.JS — Flujo de envío de emails y gestión de plantillas
// ═══════════════════════════════════════════════════════════════

let sendStep       = 1;
let sendRecipIds   = [];
let sPrevIdx       = 0;
let sFilteredList  = [];
let activeStdId    = null;

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
  }

  // Restore saved signature
  const sig = localStorage.getItem('cpfarma_sig') || '';
  if (sig) document.getElementById('sigHtml').value = sig;

  showSendStep(1);
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
    document.getElementById(`mstep${i}`)?.classList.toggle('active', i === n);
  });

  const bk = document.getElementById('sendBack');
  const nx = document.getElementById('sendNext');
  bk.style.display = n > 1 && n < 4 ? '' : 'none';

  if (n === 1) { nx.textContent = 'Siguiente →'; nx.className = 'btn btn-primary'; nx.style.display = ''; }
  else if (n === 2) { nx.textContent = `Vista previa (${sendRecipIds.length} sel.) →`; nx.className = 'btn btn-primary'; nx.style.display = ''; }
  else if (n === 3) { nx.textContent = `✉️ Enviar (${sendRecipIds.length})`; nx.className = 'btn btn-send'; nx.style.display = ''; }
  else { nx.style.display = 'none'; bk.style.display = 'none'; }
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
    container.innerHTML = '<div style="font-size:.78rem;color:var(--ink3)">No hay plantillas. Créalas en 📝 Plantillas.</div>';
    return;
  }
  container.innerHTML = templates.map(t =>
    `<div class="tpl-tab ${t.id === activeStdId ? 'active' : ''}" onclick="setSendTab('${t.id}')">${t.name}</div>`
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

// ── RECIPIENTS ────────────────────────────────────────────────
function populateRecipList() {
  // Populate folder filter
  const fsel = document.getElementById('recipFolderFilter');
  fsel.innerHTML = '<option value="">Todas las carpetas</option>' +
    folders.map(f => `<option value="${f.id}">${f.icon || '📁'} ${f.name}</option>`).join('');
  filterRecip();
}

function filterRecip() {
  const q      = (document.getElementById('recipSearch')?.value || '').toLowerCase();
  const fid    = document.getElementById('recipFolderFilter')?.value || '';
  const status = document.getElementById('recipStatusFilter')?.value || '';
  const body   = document.getElementById('sendBody').value;

  sFilteredList = records.filter(r => {
    if (!r.email) return false;
    if (fid && r.folder_id !== fid) return false;
    if (status && r.status !== status) return false;
    if (q && ![r.company, r.contact, r.email, r.country].join(' ').toLowerCase().includes(q)) return false;
    return true;
  });

  document.getElementById('recipCount').textContent =
    `${sFilteredList.length} contacto${sFilteredList.length !== 1 ? 's' : ''} con email`;

  document.getElementById('recipItems').innerHTML = sFilteredList.map(r => {
    const preview = personalise(body, r).slice(0, 55) + '…';
    const checked = sendRecipIds.includes(r.id) ? 'checked' : '';
    return `
    <div class="recip-item" onclick="toggleRecip('${r.id}', event)">
      <input type="checkbox" class="chk" ${checked} data-id="${r.id}"
        onclick="event.stopPropagation();toggleRecipChk(this)">
      <div style="flex:1;min-width:0">
        <div class="recip-company">${escH(r.company)}</div>
        <div class="recip-email">${r.email}</div>
      </div>
      <div class="recip-preview">${escH(preview)}</div>
    </div>`;
  }).join('');

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

  const pBody  = escH(personalise(body, r));
  const company = escH(r.company || r.contact || '');
  const highlighted = company ? pBody.split(company).join(`<mark>${company}</mark>`) : pBody;
  document.getElementById('prevBody').innerHTML = highlighted;
}

function prevPrev() { if (sPrevIdx > 0) { sPrevIdx--; showPreviewItem(); } }
function prevNext() { if (sPrevIdx < sendRecipIds.length - 1) { sPrevIdx++; showPreviewItem(); } }

// ── SEND ──────────────────────────────────────────────────────
async function doSend() {
  showSendStep(4);

  const body    = document.getElementById('sendBody').value;
  const subj    = document.getElementById('sendSubject').value;
  const useSig  = document.getElementById('useSig')?.checked;
  const sigText = document.getElementById('sigHtml')?.value || '';
  const webmail = (WEBMAIL_URL || 'https://webmail.cpfarma.es').replace(/\/login$/, '');

  const total = sendRecipIds.length;
  let done = 0;

  const log  = document.getElementById('sLog');
  log.innerHTML = '';

  const next = async () => {
    if (done >= total) {
      document.getElementById('sProgLabel').textContent = '✅ Completado';
      document.getElementById('sProgPct').textContent   = '100%';
      document.getElementById('sProgBar').style.width   = '100%';
      document.getElementById('sDoneMsg').style.display = '';
      // Refresh table to show updated statuses
      await loadContacts();
      renderTable();
      renderSidebar();
      renderFollowupBanner();
      return;
    }

    const id = sendRecipIds[done];
    const r  = records.find(x => x.id === id);
    const pct = Math.round((done / total) * 100);

    document.getElementById('sProgLabel').textContent = `Enviando ${done + 1} de ${total}…`;
    document.getElementById('sProgPct').textContent   = pct + '%';
    document.getElementById('sProgBar').style.width   = pct + '%';

    if (!r?.email) {
      log.innerHTML += `<div class="sk">⊘ Saltado: ${r?.company || id}</div>`;
      done++;
      setTimeout(next, 50);
      return;
    }

    let pBody = personalise(body, r);
    if (useSig && sigText) {
      pBody += '\n\n-- \n' + sigText.replace(/<[^>]*>/g, '');
    }
    const pSubj = personalise(subj, r);

    // Open Roundcube
    window.open(
      `${webmail}/?_task=mail&_action=compose&_to=${encodeURIComponent(r.email)}&_subject=${encodeURIComponent(pSubj)}&_body=${encodeURIComponent(pBody)}`,
      '_blank'
    );

    // Update contact status in DB
    try {
      const today = new Date().toISOString().split('T')[0];
      await dbSaveContact({
        id: r.id,
        status:     'sent',
        sent_date:  r.sent_date || today,
        subject:    pSubj,
        email_type: getActiveTplName(),
      });

      // Log interaction
      await dbAddInteraction({
        contact_id: r.id,
        type:       'sent',
        date:       today,
        text:       `Email enviado\nAsunto: ${pSubj}`,
        user_id:    currentUser?.id,
      });

      log.innerHTML += `<div class="ok">✅ ${escH(r.company)} — ${r.email}</div>`;
    } catch (err) {
      log.innerHTML += `<div class="er">⚠️ ${escH(r.company)} — error al guardar</div>`;
    }

    log.scrollTop = log.scrollHeight;
    done++;
    setTimeout(next, 900);
  };

  next();
}

function getActiveTplName() {
  return templates.find(t => t.id === activeStdId)?.name || 'Email enviado';
}

function personalise(text, r) {
  return (text || '').replace(/\[Name\]/gi, r.company || r.contact || '[Name]');
}

// ── SIGNATURE ─────────────────────────────────────────────────
function toggleSigEdit() {
  const el = document.getElementById('sigEditArea');
  el.style.display = el.style.display === 'none' ? '' : 'none';
}

function previewSig() {
  const h   = document.getElementById('sigHtml').value;
  const box = document.getElementById('sigPreviewBox');
  box.style.display = '';
  box.innerHTML = h || '<span style="color:var(--ink3)">Sin firma</span>';
}

function saveSig() {
  const h = document.getElementById('sigHtml').value;
  localStorage.setItem('cpfarma_sig', h);
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
    el.innerHTML = '<div style="color:var(--ink3);font-size:.82rem;font-style:italic">No hay plantillas. Crea la primera.</div>';
    return;
  }
  el.innerHTML = templates.map(t => `
    <div class="tpl-item">
      <div class="tpl-item-header">
        <span class="tpl-item-name">${escH(t.name)}</span>
        <button class="btn btn-ghost btn-sm" onclick="editTpl('${t.id}')">✏️ Editar</button>
        <button class="btn btn-danger btn-sm" onclick="deleteTpl('${t.id}')">🗑</button>
      </div>
      <div style="font-size:.73rem;color:var(--ink3);margin-bottom:4px;font-family:var(--fm)">Asunto: ${escH(t.subject || '—')}</div>
      <div class="tpl-item-body">${escH(t.body || '')}</div>
    </div>
  `).join('');
}

async function addTpl() {
  const name = prompt('Nombre de la plantilla:');
  if (!name) return;
  try {
    const maxPos = templates.length ? Math.max(...templates.map(t => t.position || 0)) : 0;
    await dbSaveTemplate({
      name,
      subject: '',
      body: 'Estimado/a [Name],\n\n\n\nSaludos,\nCP Farma',
      position: maxPos + 1,
    });
    await loadTemplates();
    renderTplList();
    toast(`✅ Plantilla "${name}" creada`, 'ok');
  } catch (err) {
    toast('Error: ' + err.message, 'er');
  }
}

async function editTpl(id) {
  const tpl = templates.find(t => t.id === id);
  if (!tpl) return;

  const name = prompt('Nombre:', tpl.name);
  if (name === null) return;
  const subject = prompt('Asunto:', tpl.subject || '');
  if (subject === null) return;
  const body = prompt('Cuerpo (usa [Name] para personalizar):', tpl.body || '');
  if (body === null) return;

  try {
    await dbSaveTemplate({ id, name, subject, body });
    await loadTemplates();
    renderTplList();
    toast('✅ Plantilla actualizada', 'ok');
  } catch (err) {
    toast('Error: ' + err.message, 'er');
  }
}

async function deleteTpl(id) {
  if (!confirm('¿Eliminar esta plantilla?')) return;
  try {
    await dbDeleteTemplate(id);
    await loadTemplates();
    renderTplList();
    toast('🗑 Plantilla eliminada', 'er');
  } catch (err) {
    toast('Error: ' + err.message, 'er');
  }
}
