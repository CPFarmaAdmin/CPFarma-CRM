// ═══════════════════════════════════════════════════════════════
// UI.JS — Panel de contacto, formulario, historial
// ═══════════════════════════════════════════════════════════════

let editId    = null;
let cTags     = [];
let cStatus   = 'new';
let cNotes    = [];
let activeTab = 'info';

// ── PANEL OPEN/CLOSE ──────────────────────────────────────────
async function openPanel(id) {
  editId  = id || null;
  cTags   = [];
  cStatus = 'new';
  cNotes  = [];

  document.getElementById('panelTitle').textContent = id ? 'Editar contacto' : 'Nuevo contacto';
  document.getElementById('panelSub').textContent   = '';
  document.getElementById('panelDelBtn').style.display  = id ? '' : 'none';
  document.getElementById('panelSendBtn').style.display = 'none';

  // Reset to first tab
  switchPanelTab('info', document.querySelector('.ptab[data-tab="info"]'));

  // Reset all fields
  clearForm();
  setVal('f-sentDate', today());

  // Populate folder select
  const sel = document.getElementById('f-folder');
  sel.innerHTML = '<option value="">— Sin carpeta —</option>' +
    folders.map(f => `<option value="${f.id}">${f.icon||'📁'} ${f.name}</option>`).join('');
  if (activeFolder !== 'all') sel.value = activeFolder;

  if (id) {
    const r = records.find(x => x.id === id);
    if (!r) return;

    document.getElementById('panelSub').textContent       = `${r.company}${r.email ? ' · ' + r.email : ''}`;
    document.getElementById('panelSendBtn').style.display = r.email ? '' : 'none';

    // Fill all fields
    setVal('f-company',         r.company);
    setVal('f-contact',         r.contact);
    setVal('f-role',            r.role);
    setVal('f-email',           r.email);
    setVal('f-phone',           r.phone);
    setVal('f-country',         r.country);
    setVal('f-city',            r.city);
    setVal('f-sector',          r.sector);
    setVal('f-type',            r.type || 'prospect');
    setVal('f-priority',        r.priority || 'Media');
    setVal('f-folder',          r.folder_id || '');
    setVal('f-linkedin',        r.linkedin);
    setVal('f-url',             r.url);
    setVal('f-sentDate',        r.sent_date);
    setVal('f-emailType',       r.email_type);
    setVal('f-subject',         r.subject);
    setVal('f-sentText',        r.sent_text);
    setVal('f-replyDate',       r.reply_date);
    setVal('f-replyFrom',       r.reply_from);
    setVal('f-replyText',       r.reply_text);
    setVal('f-followupNum',     r.followup_num);
    setVal('f-nextFollowup',    r.next_followup);
    setVal('f-meetingDate',     r.meeting_date);
    setVal('f-meetingPlatform', r.meeting_platform);
    setVal('f-followupNotes',   r.followup_notes);
    setVal('f-product',         r.deal_product);
    setVal('f-dealValue',       r.deal_value);
    setVal('f-dealProb',        r.deal_prob);
    setVal('f-dealClose',       r.deal_close);

    cTags = Array.isArray(r.tags) ? [...r.tags] : [];
    selStatus(r.status || 'new');

    // Load interaction history from DB
    try {
      cNotes = await dbGetInteractions(id);
    } catch(e) {
      console.warn('Could not load interactions:', e);
      cNotes = [];
    }
  } else {
    selStatus('new');
  }

  document.getElementById('noteDate').value = today();
  renderTags();
  renderHistory();

  document.getElementById('overlay').classList.add('open');
  document.getElementById('sidePanel').classList.add('open');
}

function openEdit(id) { openPanel(id); }

function closePanel() {
  document.getElementById('overlay').classList.remove('open');
  document.getElementById('sidePanel').classList.remove('open');
  editId = null;
}

// ── PANEL TABS ────────────────────────────────────────────────
function switchPanelTab(tab, btn) {
  activeTab = tab;
  document.querySelectorAll('.ptab-content').forEach(c => c.classList.remove('active'));
  document.querySelectorAll('.ptab').forEach(t => t.classList.remove('active'));
  const content = document.getElementById('tab-' + tab);
  if (content) content.classList.add('active');
  if (btn) {
    btn.classList.add('active');
  } else {
    // Find by data-tab attribute
    const tabBtn = document.querySelector(`.ptab[data-tab="${tab}"]`);
    if (tabBtn) tabBtn.classList.add('active');
  }
}

// ── STATUS SELECTOR ───────────────────────────────────────────
function selStatus(v) {
  cStatus = v;
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
  if (v && !cTags.includes(v)) {
    cTags.push(v);
    renderTags();
  }
  e.target.value = '';
}

function removeTag(t) {
  cTags = cTags.filter(x => x !== t);
  renderTags();
}

function renderTags() {
  const wrap = document.getElementById('tagWrap');
  const inp  = document.getElementById('tagInput');
  if (!wrap || !inp) return;
  [...wrap.children].forEach(c => { if (!c.classList.contains('tag-input')) c.remove(); });
  cTags.forEach(t => {
    const span = document.createElement('span');
    span.className = 'tag';
    span.innerHTML = `${escH(t)} <span class="tag-remove" onclick="removeTag('${escH(t)}')">✕</span>`;
    wrap.insertBefore(span, inp);
  });
}

// ── HISTORY ───────────────────────────────────────────────────
const NOTE_META = {
  comment:  { label: '💬 Comentario',        cls: 'type-comment'  },
  reply:    { label: '📥 Respuesta recibida', cls: 'type-reply'    },
  followup: { label: '🔔 Seguimiento',        cls: 'type-followup' },
  sent:     { label: '📤 Email enviado',      cls: 'type-sent'     },
  call:     { label: '📞 Llamada',           cls: 'type-call'     },
  meeting:  { label: '🤝 Reunión',           cls: 'type-meeting'  },
};

async function addNote() {
  const text = document.getElementById('noteText').value.trim();
  const date = document.getElementById('noteDate').value || today();
  const type = document.getElementById('noteType').value;

  if (!text) { toast('Escribe el texto de la nota', 'er'); return; }

  if (editId) {
    try {
      const note = await dbAddInteraction({
        contact_id: editId, type, date, text,
        user_id: currentUser?.id,
      });
      cNotes.unshift(note);
      document.getElementById('noteText').value = '';
      renderHistory();
      // Update local count
      const idx = records.findIndex(r => r.id === editId);
      if (idx >= 0) {
        records[idx]._noteCount = (records[idx]._noteCount || 0) + 1;
        records[idx].interactions = [{ count: records[idx]._noteCount }];
      }
    } catch(err) {
      toast('Error al guardar nota: ' + err.message, 'er');
    }
  } else {
    // New contact not saved yet — store in memory
    cNotes.unshift({ id: 'tmp_' + Date.now(), type, date, text });
    document.getElementById('noteText').value = '';
    renderHistory();
  }
}

async function deleteNote(noteId) {
  if (String(noteId).startsWith('tmp_')) {
    cNotes = cNotes.filter(n => n.id !== noteId);
    renderHistory();
    return;
  }
  try {
    await dbDeleteInteraction(noteId);
    cNotes = cNotes.filter(n => n.id !== noteId);
    renderHistory();
  } catch(err) {
    toast('Error: ' + err.message, 'er');
  }
}

function renderHistory() {
  const el = document.getElementById('historyThread');
  if (!el) return;

  if (!cNotes.length) {
    el.innerHTML = `<div class="history-empty">Sin entradas aún.<br>Añade la primera nota arriba.</div>`;
    return;
  }

  el.innerHTML = cNotes.map(n => {
    const meta = NOTE_META[n.type] || NOTE_META.comment;
    return `
    <div class="history-item ${meta.cls}">
      <div class="history-item-header">
        <span class="history-item-type">${meta.label}</span>
        <span class="history-item-date">${n.date || ''}</span>
        <button class="history-item-del" onclick="deleteNote('${n.id}')">🗑</button>
      </div>
      <div class="history-item-text">${escH(n.text)}</div>
    </div>`;
  }).join('');
}

// ── SAVE RECORD ───────────────────────────────────────────────
async function saveRecord() {
  const company = getVal('f-company');
  const email   = getVal('f-email');

  if (!company) { toast('❌ El nombre de la empresa es obligatorio', 'er'); return; }
  if (!email)   { toast('❌ El email es obligatorio', 'er'); return; }

  const btn = document.getElementById('saveBtn');
  btn.textContent = 'Guardando…';
  btn.disabled    = true;

  const record = {
    id:               editId || undefined,
    company,
    contact:          getVal('f-contact'),
    role:             getVal('f-role'),
    email,
    phone:            getVal('f-phone'),
    country:          getVal('f-country'),
    city:             getVal('f-city'),
    sector:           getVal('f-sector'),
    type:             getVal('f-type') || 'prospect',
    priority:         getVal('f-priority') || 'Media',
    folder_id:        getVal('f-folder') || null,
    linkedin:         getVal('f-linkedin'),
    url:              getVal('f-url'),
    tags:             cTags,
    status:           cStatus,
    email_type:       getVal('f-emailType'),
    sent_date:        getVal('f-sentDate')       || null,
    subject:          getVal('f-subject'),
    sent_text:        getVal('f-sentText'),
    reply_date:       getVal('f-replyDate')      || null,
    reply_from:       getVal('f-replyFrom'),
    reply_text:       getVal('f-replyText'),
    followup_num:     getVal('f-followupNum'),
    next_followup:    getVal('f-nextFollowup')   || null,
    meeting_date:     getVal('f-meetingDate')    || null,
    meeting_platform: getVal('f-meetingPlatform'),
    followup_notes:   getVal('f-followupNotes'),
    deal_product:     getVal('f-product'),
    deal_value:       parseFloat(getVal('f-dealValue'))  || null,
    deal_prob:        parseInt(getVal('f-dealProb'))      || null,
    deal_close:       getVal('f-dealClose')     || null,
    user_id:          currentUser?.id,
  };

  try {
    const saved = await dbSaveContact(record);

    // Save pending notes for brand-new contacts
    if (!editId && cNotes.length) {
      for (const n of [...cNotes].reverse()) {
        if (String(n.id).startsWith('tmp_')) {
          await dbAddInteraction({
            contact_id: saved.id,
            type: n.type, date: n.date, text: n.text,
            user_id: currentUser?.id,
          });
        }
      }
    }

    await loadContacts();
    await loadFolders();
    renderSidebar();
    renderTable();
    renderFollowupBanner();
    populateCountryFilter();
    closePanel();
    toast(`✅ ${company} guardado`, 'ok');
  } catch(err) {
    toast('Error al guardar: ' + err.message, 'er');
    console.error(err);
  }

  btn.textContent = '💾 Guardar';
  btn.disabled    = false;
}

// ── DELETE ────────────────────────────────────────────────────
async function deleteRecord(id) {
  const r = records.find(x => x.id === id);
  if (!r) return;
  if (!confirm(`¿Eliminar "${r.company}"?\nEsta acción no se puede deshacer.`)) return;
  try {
    await dbDeleteContact(id);
    records = records.filter(x => x.id !== id);
    renderSidebar();
    renderTable();
    renderFollowupBanner();
    toast('🗑 Contacto eliminado', 'er');
  } catch(err) {
    toast('Error: ' + err.message, 'er');
  }
}

async function delFromPanel() {
  if (!editId) return;
  const id = editId;
  closePanel();
  await deleteRecord(id);
}

function sendFromPanel() {
  if (!editId) return;
  closePanel();
  openSendModal([editId]);
}

function quickSend(id) {
  openSendModal([id]);
}

// ── HELPERS ───────────────────────────────────────────────────
function today() { return new Date().toISOString().split('T')[0]; }
function setVal(id, v) { const el = document.getElementById(id); if (el) el.value = v == null ? '' : v; }
function getVal(id)    { return (document.getElementById(id)?.value || '').trim(); }

function clearForm() {
  ['f-company','f-contact','f-role','f-email','f-phone','f-city','f-linkedin','f-url',
   'f-sentText','f-subject','f-replyDate','f-replyFrom','f-replyText',
   'f-followupNum','f-nextFollowup','f-meetingDate','f-followupNotes',
   'f-product','f-dealValue','f-dealProb','f-dealClose'].forEach(id => setVal(id, ''));
  setVal('f-country',         '');
  setVal('f-sector',          '');
  setVal('f-type',            'prospect');
  setVal('f-priority',        'Media');
  setVal('f-emailType',       'Primer contacto');
  setVal('f-meetingPlatform', '');
  cTags = [];
  cNotes = [];
  if (document.getElementById('tagWrap')) renderTags();
  if (document.getElementById('historyThread')) renderHistory();
}

function pasteStdText() {
  if (!templates.length) { toast('No hay plantillas guardadas', 'er'); return; }
  const tpl = templates.find(t => t.id === activeStdId) || templates[0];
  if (tpl) {
    setVal('f-sentText', tpl.body);
    if (tpl.subject) setVal('f-subject', tpl.subject);
    toast('📋 Plantilla pegada', 'info');
  }
}
