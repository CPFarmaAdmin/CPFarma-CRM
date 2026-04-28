// ═══════════════════════════════════════════════════════════════
// UI.JS — Panel ficha (Prospecto / Cliente), historial, adjuntos
// ═══════════════════════════════════════════════════════════════

let editId    = null;
let cTags     = [];
let cStatus   = 'new';
let cNotes    = [];
let activeTab = 'info';

// ── PANEL ─────────────────────────────────────────────────────
async function openPanel(id) {
  editId  = id || null;
  cTags   = [];
  cStatus = 'new';
  cNotes  = [];

  const r        = id ? records.find(x => x.id === id) : null;
  const isClient = r ? r.type === 'client' : activeView === 'clients';

  // Panel title
  document.getElementById('panelTitle').textContent =
    id ? `Editar ${isClient ? 'cliente' : 'prospecto'}` : `Nuevo ${isClient ? 'cliente' : 'prospecto'}`;
  document.getElementById('panelSub').textContent   = '';
  document.getElementById('panelDelBtn').style.display  = id ? '' : 'none';
  document.getElementById('panelSendBtn').style.display = 'none';

  // Show/hide section title and fields based on type
  _applyTypeUI(isClient);

  switchPanelTab('info', document.querySelector('.ptab[data-tab="info"]'));
  clearForm();
  setVal('f-sentDate', today());
  setVal('f-type', isClient ? 'client' : 'prospect');

  // Folder select
  const fsel = document.getElementById('f-folder');
  fsel.innerHTML = '<option value="">— Sin carpeta —</option>' +
    folders.map(f => `<option value="${f.id}">${f.icon||'📁'} ${f.name}</option>`).join('');
  if (activeFolder !== 'all') fsel.value = activeFolder;

  if (r) {
    document.getElementById('panelSub').textContent       = `${r.company}${r.email?' · '+r.email:''}`;
    document.getElementById('panelSendBtn').style.display = r.email ? '' : 'none';

    setVal('f-company',         r.company);
    setVal('f-contact',         r.contact);
    setVal('f-role',            r.role);
    setVal('f-email',           r.email);
    setVal('f-email2',          r.email2);
    setVal('f-email3',          r.email3);
    setVal('f-phone',           r.phone);
    setVal('f-country',         r.country);
    setVal('f-city',            r.city);
    setVal('f-program',         r.program);
    setVal('f-version',         r.version);
    setVal('f-client-status',   r.client_status || 'ok');
    // Client contact fields (HTML uses it-contact, mgmt-contact)
    setVal('f-it-contact',   r.it_name);   setVal('f-it-phone',  r.it_phone);  setVal('f-it-email',  r.it_email);
    setVal('f-mgmt-contact', r.mgmt_name); setVal('f-mgmt-phone',r.mgmt_phone);setVal('f-mgmt-email',r.mgmt_email);
    setVal('f-maintenance',      r.maintenance);
    setVal('f-maintenanceDate', r.maintenance_date);
    setVal('f-sentTo',          r.email_to);
    setVal('f-client-type',     r.client_type || 'public');
    setVal('f-type',            r.type || 'prospect');
    setVal('f-priority',        r.priority || 'Media');
    setVal('f-folder',          r.folder_id || '');
    setVal('f-sentDate',        r.sent_date);
    // Email type: populate correct select based on record type
    if (isClient) {
      setVal('f-emailTypeClient', r.email_type);
    } else {
      setVal('f-emailType', r.email_type);
    }
    setVal('f-subject',         r.subject);
    setVal('f-sentText',        r.sent_text);
    setVal('f-attachments',     r.attachments || '');
    setVal('f-replyDate',       r.reply_date);
    setVal('f-replyFrom',       r.reply_from);
    setVal('f-replyText',       r.reply_text);
    setVal('f-followupNum',     r.followup_num);
    setVal('f-nextFollowup',    r.next_followup);
    setVal('f-meetingDate',     r.meeting_date);
    setVal('f-demoDate',        r.demo_date);
    setVal('f-demoTime',        r.demo_time);
    setVal('f-meetingPlatform', r.meeting_platform);
    setVal('f-followupNotes',   r.followup_notes);
    setVal('f-notes',           r.notes);
    setVal('f-product',         r.deal_product);
    setVal('f-dealValue',       r.deal_value);
    setVal('f-dealProb',        r.deal_prob);
    setVal('f-dealClose',       r.deal_close);

    cTags = Array.isArray(r.tags) ? [...r.tags] : [];
    // Fix 8: clients use client_status for the selector, prospects use status
    // Safety: if a prospect somehow has status='lost', show as 'rejected'
    const statusToShow = isClient
      ? (r.client_status || 'ok')
      : (r.status === 'lost' ? 'rejected' : r.status || 'new');
    selStatus(statusToShow);

    try { cNotes = await dbGetInteractions(id); }
    catch(e) { cNotes = []; }
  } else {
    selStatus(isClient ? 'ok' : 'new');
  }

  document.getElementById('noteDate').value = today();
  renderTags();
  renderHistory();
  document.getElementById('overlay').classList.add('open');
  document.getElementById('sidePanel').classList.add('open');
}

// Apply UI changes when type changes
function _applyTypeUI(isClient) {
  const t = document.getElementById('infoSectionTitle');
  if (t) t.textContent = isClient ? '💼 Datos del cliente' : '🎯 Datos del prospecto';

  const lbl = document.getElementById('labelCompany');
  if (lbl) lbl.innerHTML = `${isClient ? 'Nombre del cliente' : 'Nombre del prospecto'} <span class="req">*</span>`;

  document.querySelectorAll('.client-only').forEach(el => el.style.display = isClient ? '' : 'none');
  document.querySelectorAll('.prospect-only').forEach(el => el.style.display = !isClient ? '' : 'none');

  // Show the correct status selector block
  const sp = document.getElementById('statusSelProspect');
  const sc = document.getElementById('statusSelClient');
  if (sp) sp.style.display = isClient ? 'none' : '';
  if (sc) sc.style.display = isClient ? '' : 'none';

  // Show the correct email type select
  const etP = document.getElementById('f-emailType');
  const etC = document.getElementById('f-emailTypeClient');
  if (etP) etP.style.display = isClient ? 'none' : '';
  if (etC) etC.style.display = isClient ? '' : 'none';
}

// When user changes type in the select
function onTypeChange(sel) {
  const isClient = sel.value === 'client';
  _applyTypeUI(isClient);
  // Reset status to correct default for the type
  cStatus = isClient ? 'ok' : 'new';
  selStatus(cStatus);
}

function openEdit(id) { openPanel(id); }
function closePanel() {
  document.getElementById('overlay').classList.remove('open');
  document.getElementById('sidePanel').classList.remove('open');
  editId = null;
}

// ── TABS ──────────────────────────────────────────────────────
function switchPanelTab(tab, btn) {
  activeTab = tab;
  document.querySelectorAll('.ptab-content').forEach(c => c.classList.remove('active'));
  document.querySelectorAll('.ptab').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-' + tab)?.classList.add('active');
  if (btn) btn.classList.add('active');
  else document.querySelector(`.ptab[data-tab="${tab}"]`)?.classList.add('active');
}

// ── STATUS ────────────────────────────────────────────────────

// Auto follow-up schedule (days from today) per prospect status
const FOLLOWUP_CADENCE = {
  first_contact:    14,   // sent first email → follow up in 2 weeks
  no_response:      30,   // no reply to first followup → 1 month
  contact_obtained: 7,    // got data → reach out in 1 week
  info_sent:        14,   // sent program info → follow up in 2 weeks
  demo_scheduled:   2,    // demo scheduled → remind 2 days before (manual)
  demo_done:        7,    // demo done → send proposal in 1 week
  budget_sent:      21,   // proposal sent → follow up in 3 weeks
  followup:         14,   // in follow-up → every 2 weeks
  waiting_approval: 30,   // waiting decision → check in 1 month
  won:              null, // closed → no auto follow-up
  rejected:         null, // rejected → no follow-up
};

function autoFollowupDate(status) {
  const days = FOLLOWUP_CADENCE[status];
  if (!days) return null;
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function selStatus(v) {
  cStatus = v;
  // Auto-set next follow-up date when status changes (if field is empty)
  const nextFu = document.getElementById('f-nextFollowup');
  if (nextFu && !nextFu.value) {
    const autoDate = autoFollowupDate(v);
    if (autoDate) nextFu.value = autoDate;
  }
  // Highlight in whichever selector is currently visible
  document.querySelectorAll('.status-opt').forEach(el => {
    el.className = 'status-opt';
    if (el.dataset.v === v) el.classList.add('active-' + v);
  });
}

// ── TAGS ──────────────────────────────────────────────────────
function addTag(e) {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  const v = e.target.value.trim();
  if (v && !cTags.includes(v)) { cTags.push(v); renderTags(); }
  e.target.value = '';
}
function removeTag(t) { cTags = cTags.filter(x => x !== t); renderTags(); }
function renderTags() {
  const wrap = document.getElementById('tagWrap');
  const inp  = document.getElementById('tagInput');
  if (!wrap || !inp) return;
  [...wrap.children].forEach(c => { if (!c.classList.contains('tag-input')) c.remove(); });
  cTags.forEach(t => {
    const s = document.createElement('span');
    s.className = 'tag';
    s.innerHTML = `${escH(t)} <span class="tag-remove" onclick="removeTag('${escH(t)}')">✕</span>`;
    wrap.insertBefore(s, inp);
  });
}

// ── HISTORY ───────────────────────────────────────────────────
const NOTE_META = {
  comment:  { label:'💬 Comentario',          cls:'type-comment'  },
  reply:    { label:'📥 Respuesta recibida',   cls:'type-reply'    },
  followup: { label:'🔔 Seguimiento',          cls:'type-followup' },
  sent:     { label:'📤 Email enviado',        cls:'type-sent'     },
  call:     { label:'📞 Llamada',             cls:'type-call'     },
  meeting:  { label:'🤝 Reunión',             cls:'type-meeting'  },
  incident: { label:'⚠️ Incidencia',          cls:'type-incident' },
};

async function addNote() {
  const text = document.getElementById('noteText').value.trim();
  const date = document.getElementById('noteDate').value || today();
  const type = document.getElementById('noteType').value;
  if (!text) { toast('Escribe el texto de la nota', 'er'); return; }

  if (editId) {
    try {
      const note = await dbAddInteraction({ contact_id:editId, type, date, text, user_id:currentUser?.id });
      cNotes.unshift(note);
      document.getElementById('noteText').value = '';
      renderHistory();
      const idx = records.findIndex(r => r.id === editId);
      if (idx >= 0) records[idx]._noteCount = (records[idx]._noteCount || 0) + 1;
    } catch(err) { toast('Error: ' + err.message, 'er'); }
  } else {
    cNotes.unshift({ id:'tmp_' + Date.now(), type, date, text });
    document.getElementById('noteText').value = '';
    renderHistory();
  }
}

async function deleteNote(noteId) {
  if (String(noteId).startsWith('tmp_')) { cNotes = cNotes.filter(n => n.id !== noteId); renderHistory(); return; }
  try { await dbDeleteInteraction(noteId); cNotes = cNotes.filter(n => n.id !== noteId); renderHistory(); }
  catch(err) { toast('Error: ' + err.message, 'er'); }
}

function renderHistory() {
  const el = document.getElementById('historyThread');
  if (!el) return;
  if (!cNotes.length) {
    el.innerHTML = `<div class="history-empty">Sin entradas aún. Añade la primera nota arriba.</div>`;
    return;
  }
  el.innerHTML = cNotes.map(n => {
    const meta = NOTE_META[n.type] || NOTE_META.comment;
    return `<div class="history-item ${meta.cls}">
      <div class="history-item-header">
        <span class="history-item-type">${meta.label}</span>
        <span class="history-item-date">${n.date || ''}</span>
        <button class="history-item-del" onclick="deleteNote('${n.id}')">🗑</button>
      </div>
      <div class="history-item-text">${escH(n.text)}</div>
    </div>`;
  }).join('');
}

// ── SAVE ──────────────────────────────────────────────────────
async function saveRecord() {
  const company = getVal('f-company');
  const email   = getVal('f-email');
  if (!company) { toast('❌ El nombre es obligatorio', 'er'); return; }
  if (!email)   { toast('❌ El email es obligatorio', 'er'); return; }

  const btn = document.getElementById('saveBtn');
  btn.textContent = 'Guardando…'; btn.disabled = true;

  const isClient = getVal('f-type') === 'client';

  const record = {
    id:               editId || undefined,
    company,
    contact:          getVal('f-contact'),
    role:             getVal('f-role'),
    email,
    email2:           getVal('f-email2') || null,
    email3:           getVal('f-email3') || null,
    phone:            getVal('f-phone'),
    country:          getVal('f-country'),
    city:             getVal('f-city'),
    program:          getVal('f-program'),
    version:          getVal('f-version'),
    client_type:      getVal('f-client-type') || 'public',
    it_name:   getVal('f-it-contact'),  it_phone:  getVal('f-it-phone'), it_email:  getVal('f-it-email'),
    mgmt_name: getVal('f-mgmt-contact'),mgmt_phone:getVal('f-mgmt-phone'),mgmt_email:getVal('f-mgmt-email'),
    maintenance:      getVal('f-maintenance') || null,
    maintenance_date: getVal('f-maintenanceDate') || null,
    email_to:         getVal('f-sentTo'),
    type:             getVal('f-type') || 'prospect',
    priority:         isClient ? null : (getVal('f-priority') || 'Media'),
    folder_id:        getVal('f-folder') || null,
    tags:             cTags,
    // STATUS LOGIC:
    // Prospects: status field = new/sent/replied/waiting/negotiation/won/rejected
    //            (never 'lost' — that only applies to clients)
    // Clients:   client_status field = ok/incident/renewal/churned/lost
    //            status field = 'ok' (active) or 'lost' (inactive/churned)
    status:           isClient
                        ? (cStatus === 'lost' || cStatus === 'churned' ? 'lost' : 'ok')
                        : (cStatus === 'lost' ? 'rejected' : cStatus),  // safety: prospect can't be 'lost'
    client_status:    isClient ? cStatus : null,
    email_type:       isClient ? getVal('f-emailTypeClient') : getVal('f-emailType'),
    sent_date:        getVal('f-sentDate')        || null,
    subject:          getVal('f-subject'),
    sent_text:        getVal('f-sentText'),
    attachments:      getVal('f-attachments'),
    reply_date:       getVal('f-replyDate')       || null,
    reply_from:       getVal('f-replyFrom'),
    reply_text:       getVal('f-replyText'),
    followup_num:     getVal('f-followupNum'),
    next_followup:    getVal('f-nextFollowup')    || null,
    meeting_date:     getVal('f-meetingDate')     || null,
    demo_date:        getVal('f-demoDate')         || null,
    demo_time:        getVal('f-demoTime')         || null,
    meeting_platform: getVal('f-meetingPlatform'),
    followup_notes:   getVal('f-followupNotes'),
    notes:            getVal('f-notes'),
    deal_product:     getVal('f-product'),
    deal_value:       parseFloat(getVal('f-dealValue'))  || null,
    deal_prob:        parseInt(getVal('f-dealProb'))      || null,
    deal_close:       getVal('f-dealClose')       || null,
    user_id:          currentUser?.id,
  };

  try {
    const saved = await dbSaveContact(record);
    if (!editId && cNotes.length) {
      for (const n of [...cNotes].reverse()) {
        if (String(n.id).startsWith('tmp_')) {
          await dbAddInteraction({ contact_id:saved.id, type:n.type, date:n.date, text:n.text, user_id:currentUser?.id });
        }
      }
    }
    await loadContacts();
    await loadFolders();
    renderSidebar(); renderBothTables(); renderFollowupBanner(); populateCountryFilter();
    closePanel();
    toast(`✅ ${company} guardado`, 'ok');
  } catch(err) {
    toast('Error al guardar: ' + err.message, 'er');
    console.error(err);
  }
  btn.textContent = '💾 Guardar'; btn.disabled = false;
}

// ── DELETE ────────────────────────────────────────────────────
async function deleteRecord(id) {
  const r = records.find(x => x.id === id);
  if (!r) return;
  if (!confirm(`¿Eliminar "${r.company}"? Esta acción no se puede deshacer.`)) return;
  try {
    await dbDeleteContact(id);
    records = records.filter(x => x.id !== id);
    renderSidebar(); renderBothTables(); renderFollowupBanner();
    toast('🗑 Eliminado', 'er');
  } catch(err) { toast('Error: ' + err.message, 'er'); }
}
async function delFromPanel() { if (!editId) return; const id = editId; closePanel(); await deleteRecord(id); }
function sendFromPanel() { if (!editId) return; closePanel(); openSendModal([editId]); }
function quickSend(id) { openSendModal([id]); }

// ── HELPERS ───────────────────────────────────────────────────
function today() { return new Date().toISOString().split('T')[0]; }
function setVal(id, v) { const el = document.getElementById(id); if (el) el.value = v == null ? '' : v; }
function getVal(id)    { return (document.getElementById(id)?.value || '').trim(); }

function clearForm() {
  ['f-company','f-contact','f-role','f-email','f-email2','f-email3','f-phone',
   'f-city','f-program','f-version','f-notes','f-sentTo',
   'f-it-contact','f-it-phone','f-it-email',
   'f-mgmt-contact','f-mgmt-phone','f-mgmt-email','f-maintenanceDate',
   'f-sentText','f-subject','f-attachments','f-replyDate','f-replyFrom','f-replyText',
   'f-followupNum','f-nextFollowup','f-meetingDate','f-followupNotes',
   'f-product','f-dealValue','f-dealProb','f-dealClose'].forEach(id => setVal(id, ''));
  setVal('f-country', ''); setVal('f-client-type', 'public');
  setVal('f-priority', 'Media'); setVal('f-emailType', ''); setVal('f-emailTypeClient', '');
  setVal('f-meetingPlatform', ''); setVal('f-client-status', 'ok');
  cTags = []; cNotes = [];
  if (document.getElementById('tagWrap')) renderTags();
  if (document.getElementById('historyThread')) {
    document.getElementById('historyThread').innerHTML =
      `<div style="color:var(--ink3);font-size:.82rem;font-style:italic;padding:12px 0">Abre un contacto para ver su historial.</div>`;
  }
}

// Populate email-to datalist with contacts from current record
function _populateEmailToList(r) {
  if (!r) return;
  // Build list of all known contacts for this record
  const contacts = [
    r.contact   ? `${r.contact}${r.email    ? ' <'+r.email+'>': ''}` : (r.email || null),
    r.email2    || null,
    r.email3    || null,
    r.it_name   ? `${r.it_name}${r.it_email    ? ' <'+r.it_email+'>': ''}` : (r.it_email || null),
    r.mgmt_name ? `${r.mgmt_name}${r.mgmt_email ? ' <'+r.mgmt_email+'>': ''}` : (r.mgmt_email || null),
  ].filter(Boolean);

  // Populate 'Enviado a' datalist
  const dlSent = document.getElementById('sentToList');
  if (dlSent) {
    dlSent.innerHTML = '';
    contacts.forEach(c => { const o = document.createElement('option'); o.value = c; dlSent.appendChild(o); });
  }
  // Populate 'Respondido por' datalist (names only, no email)
  const dlReply = document.getElementById('replyFromList');
  if (dlReply) {
    dlReply.innerHTML = '';
    const names = [
      r.contact   || null,
      r.it_name   || null,
      r.mgmt_name || null,
    ].filter(Boolean);
    names.forEach(n => { const o = document.createElement('option'); o.value = n; dlReply.appendChild(o); });
  }
}

function pasteStdText() {
  if (!templates.length) { toast('No hay plantillas', 'er'); return; }
  const tpl = templates.find(t => t.id === activeStdId) || templates[0];
  if (tpl) {
    setVal('f-sentText', tpl.body);
    if (tpl.subject) setVal('f-subject', tpl.subject);
    toast('📋 Pegado', 'info');
  }
}
