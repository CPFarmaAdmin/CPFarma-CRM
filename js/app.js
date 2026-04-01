// ═══════════════════════════════════════════════════════════════
// APP.JS — Lógica principal: estado, tabla dual, filtros, sidebar
// ═══════════════════════════════════════════════════════════════

// ── STATE ─────────────────────────────────────────────────────
let records   = [];
let folders   = [];
let templates = [];

let activeFolder  = 'all';
let activeView    = 'prospects'; // 'prospects' | 'clients'
let cFilter       = 'all';
let cSort         = 'date';
let cSortDir      = 'desc';
let selectedIds   = new Set();

// ── INIT ──────────────────────────────────────────────────────
async function initApp() {
  showLoading(true);
  try {
    await Promise.all([ loadFolders(), loadTemplates() ]);
    await loadContacts();
    setView('prospects');           // start on prospects tab
    renderSidebar();
    renderFollowupBanner();
    populateCountryFilter();
    setupRealtimeSync();
  } catch(err) {
    console.error('Init error:', err);
    toast('Error al cargar los datos. Comprueba la conexión.', 'er');
  }
  showLoading(false);
}

async function loadContacts() {
  try { records = await dbGetContacts(); }
  catch(err) { console.error('loadContacts:', err); records = []; }
}

async function loadFolders() {
  try { folders = await dbGetFolders(); }
  catch(err) { console.error('loadFolders:', err); folders = []; }
  const opts = '<option value="">— Sin carpeta —</option>' +
    folders.map(f => `<option value="${f.id}">${f.icon||'📁'} ${f.name}</option>`).join('');
  ['f-folder','impFolder'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { const prev = el.value; el.innerHTML = opts; if (prev) el.value = prev; }
  });
}

async function loadTemplates() {
  try { templates = await dbGetTemplates(); }
  catch(err) { console.error('loadTemplates:', err); templates = []; }
}

function showLoading(on) {
  const loading = document.getElementById('loadingState');
  const tables  = document.getElementById('tablesWrap');
  const empty   = document.getElementById('emptyState');
  if (loading) loading.style.display = on ? '' : 'none';
  if (tables)  tables.style.display  = on ? 'none' : '';
  if (on && empty) empty.style.display = 'none';
}

// ── REALTIME ──────────────────────────────────────────────────
function setupRealtimeSync() {
  subscribeToContacts(async () => {
    await loadContacts();
    renderSidebar();
    renderBothTables();
    renderFollowupBanner();
    populateCountryFilter();
  });
}

// ── VIEW SWITCHER (Prospectos / Clientes) ─────────────────────
function setView(v) {
  activeView = v;

  // Sync all view-tab buttons (top AND sidebar)
  document.querySelectorAll('.view-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.view === v);
  });

  // Always update the title based on current view
  const folderName = activeFolder !== 'all' ? folders.find(f=>f.id===activeFolder)?.name : null;
  document.getElementById('viewTitle').textContent =
    folderName || (v === 'prospects' ? 'Prospectos' : 'Clientes');

  // Show/hide filter bars based on view
  const fp = document.getElementById('filtersProspects');
  const fc = document.getElementById('filtersClients');
  const ep = document.getElementById('extraFiltersP');
  const ec = document.getElementById('extraFiltersC');
  if (fp) fp.style.display = v === 'prospects' ? '' : 'none';
  if (fc) fc.style.display = v === 'clients'   ? '' : 'none';
  if (ep) ep.style.display = v === 'prospects' ? 'contents' : 'none';
  if (ec) ec.style.display = v === 'clients'   ? 'contents' : 'none';

  // Reset filter to 'all' when switching views
  cFilter = 'all';
  document.querySelectorAll('.ftab').forEach(t => {
    t.classList.toggle('active', t.dataset.filter === 'all');
  });

  renderBothTables();
}

// ── SIDEBAR ───────────────────────────────────────────────────
function renderSidebar() {
  const today = new Date(); today.setHours(0,0,0,0);
  const prospects = records.filter(r => r.type !== 'client');
  const clients   = records.filter(r => r.type === 'client');
  const fuToday   = records.filter(r => {
    if (!r.next_followup) return false;
    const d = new Date(r.next_followup); d.setHours(0,0,0,0);
    return d <= today;
  }).length;

  document.getElementById('sbStats').innerHTML = `
    <div class="sb-stat"><div class="sb-stat-n">${prospects.length}</div><div class="sb-stat-l">Prospectos</div></div>
    <div class="sb-stat"><div class="sb-stat-n green">${clients.length}</div><div class="sb-stat-l">Clientes</div></div>
    <div class="sb-stat"><div class="sb-stat-n yellow">${records.filter(r=>r.status==='replied').length}</div><div class="sb-stat-l">Respondidos</div></div>
    <div class="sb-stat"><div class="sb-stat-n ${fuToday>0?'red':''}">${fuToday}</div><div class="sb-stat-l">Follow-up</div></div>
  `;

  const fc = {};
  records.forEach(r => { if (r.folder_id) fc[r.folder_id] = (fc[r.folder_id]||0)+1; });

  document.getElementById('sbNav').innerHTML = `
    <div class="sb-section">Vistas</div>
    <button class="nb ${activeFolder==='all'&&activeView==='prospects'?'active':''}" onclick="setFolder('all');setView('prospects')">
      <span class="ni">🎯</span><span class="nt">Prospectos</span><span class="nk">${prospects.length}</span>
    </button>
    <button class="nb ${activeFolder==='all'&&activeView==='clients'?'active':''}" onclick="setFolder('all');setView('clients')">
      <span class="ni">💼</span><span class="nt">Clientes</span><span class="nk">${clients.length}</span>
    </button>
    <button class="nb" onclick="showFollowups()">
      <span class="ni">🔔</span><span class="nt">Follow-up hoy</span>
      <span class="nk" style="${fuToday>0?'color:#fca5a5':''}">${fuToday}</span>
    </button>

    <div class="sb-section" style="margin-top:8px">
      Carpetas
      <button onclick="openFolderModal()" style="float:right;background:rgba(255,255,255,.1);border:none;color:rgba(255,255,255,.6);border-radius:3px;padding:1px 6px;cursor:pointer;font-size:.62rem">+ Nueva</button>
    </div>
    ${folders.map(f => `
      <button class="nb ${activeFolder===f.id?'active':''}" onclick="setFolder('${f.id}');setView(activeView)">
        <span class="ni">${f.icon||'📁'}</span>
        <span class="nt">${f.name}</span>
        <span class="nk">${fc[f.id]||0}</span>
        <span class="folder-actions">
          <span class="folder-btn" onclick="event.stopPropagation();editFolder('${f.id}')">✏️</span>
          <span class="folder-btn" onclick="event.stopPropagation();deleteFolder('${f.id}')">🗑</span>
        </span>
      </button>`).join('')}

    <div class="sb-section" style="margin-top:8px">Herramientas</div>
    <button class="nb" onclick="openSendModal()"><span class="ni">✉️</span><span class="nt">Enviar emails</span></button>
    <button class="nb" onclick="openTplModal()"><span class="ni">📝</span><span class="nt">Plantillas</span></button>
    <button class="nb" onclick="openImport()"><span class="ni">📥</span><span class="nt">Importar Excel</span></button>
    <button class="nb" onclick="exportCSV()"><span class="ni">⬇️</span><span class="nt">Exportar CSV</span></button>
  `;
}

function setFolder(id) {
  activeFolder = id;
  const name = id === 'all'
    ? (activeView === 'prospects' ? 'Prospectos' : 'Clientes')
    : (folders.find(f => f.id === id)?.name || id);
  document.getElementById('viewTitle').textContent = name;
  renderSidebar();
  renderBothTables();
}

function showFollowups() {
  cFilter = 'followup';
  document.querySelectorAll('.ftab').forEach(t => t.classList.remove('active'));
  document.querySelector('[data-filter="followup"]')?.classList.add('active');
  renderBothTables();
}

// ── FILTERS ───────────────────────────────────────────────────
function setFilter(f, btn) {
  cFilter = f;
  document.querySelectorAll('.ftab').forEach(t => t.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderBothTables();
}

function populateCountryFilter() {
  const countries = [...new Set(records.map(r=>r.country).filter(Boolean))].sort();
  ['filterCountry','filterCountryC'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const prev = sel.value;
    sel.innerHTML = '<option value="">País</option>' +
      countries.map(c=>`<option value="${c}">${c}</option>`).join('');
    if (prev) sel.value = prev;
  });
}

// ── SORTING ───────────────────────────────────────────────────
function setSort(col) {
  cSortDir = cSort === col ? (cSortDir==='asc'?'desc':'asc') : 'asc';
  cSort = col;
  updateSortIcons();
  renderBothTables();
}

function updateSortIcons() {
  ['name','country','date','prio','followup','program','status-c'].forEach(col => {
    const el = document.getElementById('si-'+col);
    if (!el) return;
    el.textContent = cSort===col ? (cSortDir==='asc'?'↑':'↓') : '';
    el.style.opacity = cSort===col ? '1' : '0.3';
  });
}

// ── GET FILTERED DATA ─────────────────────────────────────────
function getFilteredFor(viewType) {
  const q       = (document.getElementById('searchInput')?.value||'').toLowerCase();
  const prio    = viewType==='prospects' ? (document.getElementById('filterPriority')?.value||'') : '';
  const country = viewType==='prospects'
    ? (document.getElementById('filterCountry')?.value||'')
    : (document.getElementById('filterCountryC')?.value||'');
  const today   = new Date(); today.setHours(0,0,0,0);

  const isClient = viewType === 'clients';

  return records.filter(r => {
    // Type split
    if (isClient  && r.type !== 'client')  return false;
    if (!isClient && r.type === 'client')  return false;

    // Folder
    if (activeFolder !== 'all' && r.folder_id !== activeFolder) return false;

    // Search
    if (q) {
      const s = [r.company, r.contact, r.email, r.city, r.country, r.program, r.version]
        .join(' ').toLowerCase();
      if (!s.includes(q)) return false;
    }

    if (prio    && r.priority !== prio)    return false;
    if (country && r.country !== country)  return false;

    // Client status filter (dropdown)
    const clientStatusFilter = document.getElementById('filterClientStatus')?.value || '';
    if (isClient && clientStatusFilter && r.client_status !== clientStatusFilter) return false;

    // Status tabs
    if (cFilter === 'new')      return !r.status || r.status === 'new';
    if (cFilter === 'sent')     return r.status === 'sent';
    if (cFilter === 'replied')  return r.status === 'replied';
    if (cFilter === 'waiting')  return r.status === 'waiting';
    // Client-specific tab filters
    if (cFilter === 'ok')       return r.client_status === 'ok' || !r.client_status;
    if (cFilter === 'incident') return r.client_status === 'incident';
    if (cFilter === 'followup') {
      if (!r.next_followup) return false;
      const d = new Date(r.next_followup); d.setHours(0,0,0,0);
      return d <= today;
    }
    return true;
  }).sort((a,b) => {
    let vA, vB;
    const pm = {Alta:0,Media:1,Baja:2};
    if (cSort==='name')     { vA=a.company||''; vB=b.company||''; }
    if (cSort==='prio')     { vA=pm[a.priority]??1; vB=pm[b.priority]??1; }
    if (cSort==='followup') { vA=a.next_followup||'9999'; vB=b.next_followup||'9999'; }
    if (cSort==='country')  { vA=a.country||''; vB=b.country||''; }
    if (cSort==='program')  { vA=a.program||''; vB=b.program||''; }
    if (cSort==='date')     { vA=a.sent_date||a.created_at||''; vB=b.sent_date||b.created_at||''; }
    if (typeof vA === 'number') return cSortDir==='asc' ? vA-vB : vB-vA;
    return cSortDir==='asc' ? (vA||'').localeCompare(vB||'') : (vB||'').localeCompare(vA||'');
  });
}

// ── RENDER BOTH TABLES ────────────────────────────────────────
function renderBothTables() {
  const prospects = getFilteredFor('prospects');
  const clients   = getFilteredFor('clients');

  const totalShown = activeView==='prospects' ? prospects.length : clients.length;
  document.getElementById('rcount').textContent =
    `${totalShown} ${activeView==='prospects'?'prospecto':'cliente'}${totalShown!==1?'s':''}`;

  renderProspectsTable(prospects);
  renderClientsTable(clients);

  // Show/hide sections based on activeView
  const pSec = document.getElementById('prospectsSection');
  const cSec = document.getElementById('clientsSection');
  if (pSec) pSec.style.display = activeView==='prospects' ? '' : 'none';
  if (cSec) cSec.style.display = activeView==='clients'   ? '' : 'none';

  const empty = document.getElementById('emptyState');
  empty.style.display = totalShown === 0 ? '' : 'none';
}

// Alias for old callers
function renderTable() { renderBothTables(); }

// ── PROSPECTS TABLE ───────────────────────────────────────────
function renderProspectsTable(rows) {
  const tbody = document.getElementById('tbodyProspects');
  if (!tbody) return;
  tbody.innerHTML = rows.map(r => {
    const n = r._noteCount || 0;
    const sel = selectedIds.has(r.id);
    const loc = [r.city, r.country].filter(Boolean).join(', ') || '—';
    return `
    <tr onclick="openEdit('${r.id}')" class="${sel?'selected-row':''}">
      <td onclick="event.stopPropagation()"><input type="checkbox" class="chk rchk" data-id="${r.id}" ${sel?'checked':''} onchange="toggleRowSel(this)"></td>
      <td>
        <div class="tc-company">${escH(r.company)}</div>
        ${n>0?`<div class="tc-notes">💬 ${n}</div>`:''}
      </td>
      <td>
        <div style="font-size:.82rem;color:var(--ink2)">${r.contact||'<span style="color:var(--ink3);font-style:italic">—</span>'}</div>
        <div class="tc-email">${r.email||''}</div>
      </td>
      <td><div style="font-size:.82rem">${escH(loc)}</div></td>
      <td style="font-size:.82rem;color:var(--ink2)">${escH(r.program||'—')}</td>
      <td class="tc-date">${r.sent_date?fmtDate(r.sent_date):'<span style="font-style:italic;color:var(--ink3)">—</span>'}</td>
      <td>${renderBadge(r.status)}</td>
      <td>${renderPrio(r.priority)}</td>
      <td>${renderFollowup(r.next_followup)}</td>
      <td><div class="row-actions">
        <button class="row-btn" onclick="event.stopPropagation();quickSend('${r.id}')" title="Enviar email">✉️</button>
        <button class="row-btn" onclick="event.stopPropagation();openEdit('${r.id}')">✏️</button>
        <button class="row-btn danger" onclick="event.stopPropagation();deleteRecord('${r.id}')">🗑</button>
      </div></td>
    </tr>`;
  }).join('');
}

// ── CLIENTS TABLE ─────────────────────────────────────────────
function renderClientsTable(rows) {
  const tbody = document.getElementById('tbodyClients');
  if (!tbody) return;
  tbody.innerHTML = rows.map(r => {
    const n = r._noteCount || 0;
    const sel = selectedIds.has(r.id);
    const loc = [r.city, r.country].filter(Boolean).join(', ') || '—';
    const clientStatus = r.client_status || 'ok'; // 'ok' | 'incident'
    return `
    <tr onclick="openEdit('${r.id}')" class="${sel?'selected-row':''}">
      <td onclick="event.stopPropagation()"><input type="checkbox" class="chk rchk" data-id="${r.id}" ${sel?'checked':''} onchange="toggleRowSel(this)"></td>
      <td>
        <div class="tc-company">${escH(r.company)}</div>
        ${n>0?`<div class="tc-notes">💬 ${n}</div>`:''}
      </td>
      <td>
        <div style="font-size:.82rem;color:var(--ink2)">${r.contact||'<span style="color:var(--ink3);font-style:italic">—</span>'}</div>
        <div class="tc-email">${r.email||''}</div>
      </td>
      <td><div style="font-size:.82rem">${escH(loc)}</div></td>
      <td style="font-size:.82rem;color:var(--ink2)">${escH(r.program||'—')}</td>
      <td style="font-size:.82rem;color:var(--ink3);font-family:var(--fm)">${escH(r.version||'—')}</td>
      <td>${renderClientStatusBadge(clientStatus)}</td>
      <td class="tc-date">${r.sent_date?fmtDate(r.sent_date):'<span style="font-style:italic;color:var(--ink3)">—</span>'}</td>
      <td>${renderFollowup(r.next_followup)}</td>
      <td><div class="row-actions">
        <button class="row-btn" onclick="event.stopPropagation();quickSend('${r.id}')" title="Enviar email">✉️</button>
        <button class="row-btn" onclick="event.stopPropagation();openEdit('${r.id}')">✏️</button>
        <button class="row-btn danger" onclick="event.stopPropagation();deleteRecord('${r.id}')">🗑</button>
      </div></td>
    </tr>`;
  }).join('');
}

// ── FOLLOW-UP BANNER ──────────────────────────────────────────
function renderFollowupBanner() {
  const today = new Date(); today.setHours(0,0,0,0);
  const overdue  = records.filter(r => { if (!r.next_followup) return false; const d=new Date(r.next_followup);d.setHours(0,0,0,0);return d<today; });
  const todayFu  = records.filter(r => { if (!r.next_followup) return false; const d=new Date(r.next_followup);d.setHours(0,0,0,0);return d.getTime()===today.getTime(); });
  const banner   = document.getElementById('followupBanner');
  const total    = overdue.length + todayFu.length;
  if (total === 0) { banner.style.display='none'; return; }
  let msg = '🔔 ';
  if (overdue.length) msg += `<strong>${overdue.length} follow-up${overdue.length>1?'s':''} vencido${overdue.length>1?'s':''}</strong>`;
  if (overdue.length && todayFu.length) msg += ' · ';
  if (todayFu.length) msg += `<strong>${todayFu.length} para hoy</strong>`;
  msg += ` — <a href="#" onclick="showFollowups();return false;" style="color:#92400e;font-weight:700;text-decoration:underline">Ver todos →</a>`;
  banner.innerHTML = msg;
  banner.style.display = '';
}

// ── HELPERS ───────────────────────────────────────────────────
function fmtDate(s) {
  if (!s) return '—';
  const [y,m,d] = s.split('T')[0].split('-');
  return `${d}/${m}/${y}`;
}
function escH(s) {
  return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

const STATUS_LABELS = {
  new:'🆕 Sin contactar', sent:'📤 Enviado', replied:'✅ Respondido',
  waiting:'⏳ Sin respuesta', negotiation:'🤝 Negociando', won:'🏆 Ganado', lost:'❌ Perdido',
};

function renderBadge(status) {
  const s = status||'new';
  return `<span class="badge badge-${s}">${STATUS_LABELS[s]||s}</span>`;
}

function renderClientStatusBadge(s) {
  if (s === 'incident') return `<span class="badge badge-incident">⚠️ Incidencia activa</span>`;
  return `<span class="badge badge-ok">✅ Sin incidencias</span>`;
}

function renderPrio(p) {
  const cls = p==='Alta'?'alta':p==='Baja'?'baja':'media';
  return `<span class="prio prio-${cls}"><span class="prio-dot"></span>${p||'Media'}</span>`;
}

function renderFollowup(dateStr) {
  if (!dateStr) return '<span style="color:var(--ink3);font-size:.72rem">—</span>';
  const today = new Date(); today.setHours(0,0,0,0);
  const d = new Date(dateStr); d.setHours(0,0,0,0);
  const diff = Math.round((d-today)/86400000);
  let cls='fu-ok', note=`en ${diff}d`;
  if (diff<0)      { cls='fu-overdue'; note=`vencido (${-diff}d)`; }
  else if (diff===0) { cls='fu-soon'; note='HOY'; }
  else if (diff<=3)  { cls='fu-soon'; }
  return `<div class="fu-cell ${cls}"><span class="fu-date">${fmtDate(dateStr)}</span><br><small style="font-size:.65rem">(${note})</small></div>`;
}

function toast(msg, type='') {
  const c = document.getElementById('toasts');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => { t.style.opacity='0'; t.style.transform='translateY(8px)'; t.style.transition='all 300ms'; setTimeout(()=>t.remove(),300); }, 3500);
}

// ── SELECTION ─────────────────────────────────────────────────
function toggleRowSel(chk) {
  if (chk.checked) selectedIds.add(chk.dataset.id);
  else selectedIds.delete(chk.dataset.id);
  updateBulkBar();
}
function toggleSelAll(chk) {
  const rows = getFilteredFor(activeView);
  rows.forEach(r => { if (chk.checked) selectedIds.add(r.id); else selectedIds.delete(r.id); });
  renderBothTables();
  updateBulkBar();
}
function clearSelection() { selectedIds.clear(); renderBothTables(); updateBulkBar(); }
function updateBulkBar() {
  const bar = document.getElementById('bulkBar');
  const n = selectedIds.size;
  bar.style.display = n>0 ? '' : 'none';
  document.getElementById('bulkCount').textContent = `${n} seleccionado${n!==1?'s':''}`;
}
async function bulkDelete() {
  if (!selectedIds.size) return;
  if (!confirm(`¿Eliminar ${selectedIds.size} contactos?`)) return;
  try {
    await dbDeleteContacts([...selectedIds]);
    await loadContacts();
    selectedIds.clear();
    renderSidebar(); renderBothTables(); renderFollowupBanner();
    toast('🗑 Eliminados', 'er');
  } catch(err) { toast('Error: '+err.message,'er'); }
}
function bulkSend() { openSendModal([...selectedIds]); }

// ── FOLDERS ───────────────────────────────────────────────────
let editingFolderId = null;
let pickedIcon = '📁';

function openFolderModal(id) {
  editingFolderId = id||null;
  document.getElementById('folderModalTitle').textContent = id?'Editar carpeta':'Nueva carpeta';
  const f = id ? folders.find(x=>x.id===id) : null;
  document.getElementById('folderName').value = f?.name||'';
  pickedIcon = f?.icon||'📁';
  renderIconPicker();
  document.getElementById('folderModal').classList.add('open');
}
function closeFolderModal() { document.getElementById('folderModal').classList.remove('open'); }
function renderIconPicker() {
  const icons = '📁 🌎 🇺🇸 🇲🇽 🇪🇸 🇩🇪 🇫🇷 🇬🇧 🇮🇹 🇸🇪 🇳🇴 🇵🇹 ⭐ 🔥 💼 🏗️ 💊 🎯 📌 🏥 🔬 🤝 💰'.split(' ');
  document.getElementById('iconPicker').innerHTML = icons.map(ic =>
    `<span class="icon-opt ${ic===pickedIcon?'selected':''}" onclick="pickIcon('${ic}')">${ic}</span>`
  ).join('');
}
function pickIcon(ic) { pickedIcon=ic; renderIconPicker(); }
async function saveFolderModal() {
  const name = document.getElementById('folderName').value.trim();
  if (!name) { toast('Escribe un nombre','er'); return; }
  try {
    const maxPos = folders.length ? Math.max(...folders.map(f=>f.position||0)) : 0;
    await dbSaveFolder({ id:editingFolderId||undefined, name, icon:pickedIcon, position:editingFolderId?undefined:maxPos+1 });
    await loadFolders();
    closeFolderModal();
    renderSidebar();
    toast(`✅ Carpeta "${name}" guardada`,'ok');
  } catch(err) { toast('Error: '+err.message,'er'); }
}
function editFolder(id) { openFolderModal(id); }
async function deleteFolder(id) {
  const f = folders.find(x=>x.id===id);
  if (!confirm(`¿Eliminar la carpeta "${f?.name}"?\nLos contactos NO se borran.`)) return;
  try {
    await dbDeleteFolder(id);
    if (activeFolder===id) activeFolder='all';
    await loadFolders();
    renderSidebar(); renderBothTables();
    toast('🗑 Carpeta eliminada','er');
  } catch(err) { toast('Error: '+err.message,'er'); }
}

// ── MOVE MODAL ────────────────────────────────────────────────
function openMoveModal() {
  const ids = [...selectedIds];
  const list = document.getElementById('moveFolderList');
  list.innerHTML = folders.map(f =>
    `<button class="nb" style="color:var(--ink2);background:var(--paper);border:1.5px solid var(--border);margin-bottom:4px" onclick="doMove('${f.id}',${JSON.stringify(ids)})">
      <span>${f.icon||'📁'}</span><span style="flex:1;color:var(--ink)">${f.name}</span>
      <span style="font-size:.72rem;color:var(--acc)">→ mover aquí</span>
    </button>`
  ).join('');
  document.getElementById('moveModal').classList.add('open');
}
function closeMoveModal() { document.getElementById('moveModal').classList.remove('open'); }
async function doMove(folderId, ids) {
  try {
    await dbMoveContacts(ids, folderId);
    await loadContacts();
    clearSelection();
    renderSidebar(); renderBothTables(); closeMoveModal();
    toast(`📁 ${ids.length} → ${folders.find(f=>f.id===folderId)?.name}`,'ok');
  } catch(err) { toast('Error: '+err.message,'er'); }
}

// ── EXPORT CSV ────────────────────────────────────────────────
function exportCSV() {
  const rows = getFilteredFor(activeView);
  const H = ['ID','Nombre','Contacto','Email','Cargo','País','Ciudad','Programa','Versión',
    'Tipo','Tipo cliente','Prioridad','Estado','Fecha Envío','Asunto','Próx. Follow-up','Carpeta'];
  const esc = v => `"${String(v||'').replace(/"/g,'""')}"`;
  const fn  = id => folders.find(f=>f.id===id)?.name||'';
  const csv = [H.join(','), ...rows.map(r=>[
    r.id,r.company,r.contact,r.email,r.role,r.country,r.city,
    r.program,r.version,r.type,r.client_type,r.priority,r.status,
    r.sent_date,r.subject,r.next_followup,fn(r.folder_id)
  ].map(esc).join(','))].join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));
  a.download = `cpfarma_${activeView}_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  toast('📥 CSV exportado','info');
}

// ── START ──────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => initAuth());
