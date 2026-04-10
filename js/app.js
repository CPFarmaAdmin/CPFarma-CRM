// ═══════════════════════════════════════════════════════════════
// APP.JS v9 — estados de proceso completos, filtros, realtime fix
// ═══════════════════════════════════════════════════════════════

let records   = [];
let folders   = [];
let templates = [];

let activeFolder  = 'all';
let activeView    = 'prospects';
let cFilter       = 'active';
let cFilterP      = 'all';
let cSort         = 'date';
let cSortDir      = 'desc';
let selectedIds   = new Set();
let realtimeSub   = null;  // track subscription to avoid duplicates

// ── PROSPECT STATUS DEFINITIONS ───────────────────────────────
const PROSPECT_STATUS_LABELS = {
  new:              '🆕 Sin contactar',
  first_contact:    '📤 Primer contacto',
  no_response:      '📭 Sin responder',
  contact_obtained: '📞 Datos obtenidos',
  info_sent:        '📋 Información enviada',
  demo_scheduled:   '📅 Demo agendada',
  demo_done:        '🎬 Demo realizada',
  budget_sent:      '💰 Presupuesto enviado',
  followup:         '🔔 En seguimiento',
  waiting_approval: '⏳ Esperando aprobación',
  won:              '🏆 Ganado',
  rejected:         '🚫 Rechazado',
  // Legacy mappings (keep for backward compat)
  sent:             '📤 Enviado',
  replied:          '✅ Respondido',
  waiting:          '⏳ Sin respuesta',
  negotiation:      '🤝 Negociando',
};

const CLIENT_STATUS_LABELS = {
  ok:       '✅ Sin incidencias',
  incident: '⚠️ Incidencia activa',
  renewal:  '🔄 Renovación',
  churned:  '❌ Baja',
  lost:     '⬜ Inactivo',
};

// ── INIT ──────────────────────────────────────────────────────
async function initApp() {
  showLoading(true);
  try {
    await Promise.all([loadFolders(), loadTemplates()]);
    await loadContacts();
    setView('prospects');
    renderSidebar();
    renderFollowupBanner();
    populateCountryFilter();
    setupRealtimeSync();
  } catch(err) {
    console.error('Init error:', err);
    toast('Error al cargar los datos. Comprueba la conexión.', 'er');
    showLoading(false);
  }
  showLoading(false);
}

async function loadContacts() {
  try { records = await dbGetContacts(); }
  catch(err) { console.error('loadContacts:', err); records = []; }
}

async function loadFolders() {
  try { folders = await dbGetFolders(); }
  catch(err) { folders = []; }
  const opts = '<option value="">— Sin carpeta —</option>' +
    folders.map(f => `<option value="${f.id}">${f.icon||'📁'} ${f.name}</option>`).join('');
  ['f-folder','impFolder'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { const p = el.value; el.innerHTML = opts; if (p) el.value = p; }
  });
}

async function loadTemplates() {
  try { templates = await dbGetTemplates(); }
  catch(err) { templates = []; }
}

function showLoading(on) {
  const loading = document.getElementById('loadingState');
  const tables  = document.getElementById('tablesWrap');
  const empty   = document.getElementById('emptyState');
  if (loading) loading.style.display = on ? '' : 'none';
  if (tables)  tables.style.display  = on ? 'none' : '';
  if (on && empty) empty.style.display = 'none';
}

// ── REALTIME — FIX: avoid spinner on tab switch ───────────────
function setupRealtimeSync() {
  if (realtimeSub) return; // already subscribed
  realtimeSub = subscribeToContacts(async () => {
    // Silently refresh — no spinner
    try {
      const fresh = await dbGetContacts();
      records = fresh;
      renderSidebar();
      renderBothTables();
      renderFollowupBanner();
      populateCountryFilter();
    } catch(e) { /* ignore silent sync errors */ }
  });
}

// ── VIEW SWITCHER ─────────────────────────────────────────────
function setView(v) {
  activeView = v;
  document.querySelectorAll('.view-tab').forEach(t => t.classList.toggle('active', t.dataset.view === v));
  document.querySelectorAll('.sb-nav-view').forEach(t => t.classList.toggle('active', t.dataset.view === v));

  const folderName = activeFolder !== 'all' ? folders.find(f => f.id === activeFolder)?.name : null;
  document.getElementById('viewTitle').textContent =
    folderName ? `${folderName} — ${v === 'prospects' ? 'Prospectos' : 'Clientes'}`
               : (v === 'prospects' ? 'Prospectos' : 'Clientes');

  const fp = document.getElementById('filtersProspects');
  const fc = document.getElementById('filtersClients');
  const ep = document.getElementById('extraFiltersP');
  const ec = document.getElementById('extraFiltersC');
  if (fp) fp.style.display = v === 'prospects' ? '' : 'none';
  if (fc) fc.style.display = v === 'clients'   ? '' : 'none';
  if (ep) ep.style.display = v === 'prospects' ? 'contents' : 'none';
  if (ec) ec.style.display = v === 'clients'   ? 'contents' : 'none';

  if (v === 'clients') {
    cFilter = 'active';
    document.querySelectorAll('#filtersClients .ftab').forEach(t => t.classList.toggle('active', t.dataset.filter === 'active'));
  } else {
    cFilter = cFilterP;
    document.querySelectorAll('#filtersProspects .ftab').forEach(t => t.classList.toggle('active', t.dataset.filter === cFilterP));
  }

  renderBothTables();
}

// ── SIDEBAR ───────────────────────────────────────────────────
function renderSidebar() {
  const today     = new Date(); today.setHours(0,0,0,0);
  const prospects = records.filter(r => r.type !== 'client' && r.status !== 'rejected');
  const rejected  = records.filter(r => r.type !== 'client' && r.status === 'rejected');
  const clients   = records.filter(r => r.type === 'client' && r.status !== 'lost');
  const inactive  = records.filter(r => r.type === 'client' && r.status === 'lost');
  const fuToday   = records.filter(r => {
    if (!r.next_followup) return false;
    const d = new Date(r.next_followup); d.setHours(0,0,0,0);
    return d <= today;
  }).length;

  document.getElementById('sbStats').innerHTML = `
    <div class="sb-stat"><div class="sb-stat-n">${prospects.length}</div><div class="sb-stat-l">Prospectos</div></div>
    <div class="sb-stat"><div class="sb-stat-n green">${clients.length}</div><div class="sb-stat-l">Clientes</div></div>
    <div class="sb-stat"><div class="sb-stat-n yellow">${inactive.length}</div><div class="sb-stat-l">Inactivos</div></div>
    <div class="sb-stat"><div class="sb-stat-n ${fuToday>0?'red':''}">${fuToday}</div><div class="sb-stat-l">Follow-up hoy</div></div>
  `;

  const fc = {};
  records.forEach(r => { if (r.folder_id) fc[r.folder_id] = (fc[r.folder_id]||0)+1; });

  document.getElementById('sbNav').innerHTML = `
    <div class="sb-section">Vistas</div>
    <button class="nb sb-nav-view ${activeFolder==='all'&&activeView==='prospects'?'active':''}" data-view="prospects" onclick="setFolder('all');setView('prospects')">
      <span class="ni">🎯</span><span class="nt">Prospectos</span><span class="nk">${prospects.length}</span>
    </button>
    <button class="nb sb-nav-view ${activeFolder==='all'&&activeView==='clients'?'active':''}" data-view="clients" onclick="setFolder('all');setView('clients')">
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
        <span class="ni">${f.icon||'📁'}</span><span class="nt">${f.name}</span><span class="nk">${fc[f.id]||0}</span>
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
  renderSidebar();
}

function showFollowups() {
  cFilter = 'followup_today';
  cFilterP = 'followup_today';
  const barId = activeView === 'prospects' ? '#filtersProspects' : '#filtersClients';
  document.querySelectorAll(`${barId} .ftab`).forEach(t => t.classList.toggle('active', t.dataset.filter === 'followup_today'));
  renderBothTables();
}

// ── FILTERS ───────────────────────────────────────────────────
function setFilter(f, btn) {
  cFilter = f;
  if (activeView === 'prospects') cFilterP = f;
  const barId = activeView === 'prospects' ? '#filtersProspects' : '#filtersClients';
  document.querySelectorAll(`${barId} .ftab`).forEach(t => t.classList.toggle('active', t.dataset.filter === f));
  renderBothTables();
}

function populateCountryFilter() {
  const countries = [...new Set(records.map(r => r.country).filter(Boolean))].sort();
  ['filterCountry','filterCountryC'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const prev = sel.value;
    sel.innerHTML = '<option value="">País</option>' + countries.map(c => `<option value="${c}">${c}</option>`).join('');
    if (prev) sel.value = prev;
  });
  const versions = [...new Set(records.filter(r=>r.type==='client').map(r=>r.version).filter(Boolean))].sort();
  const vsel = document.getElementById('filterVersionC');
  if (vsel) {
    const prev = vsel.value;
    vsel.innerHTML = '<option value="">Versión</option>' + versions.map(v => `<option value="${v}">${v}</option>`).join('');
    if (prev) vsel.value = prev;
  }
}

// ── SORTING ───────────────────────────────────────────────────
function setSort(col) {
  cSortDir = cSort === col ? (cSortDir==='asc'?'desc':'asc') : 'asc';
  cSort = col;
  ['name','country','date','prio','followup','program'].forEach(c => {
    const el = document.getElementById('si-'+c);
    if (!el) return;
    el.textContent = cSort===c ? (cSortDir==='asc'?'↑':'↓') : '';
    el.style.opacity = cSort===c ? '1' : '0.3';
  });
  renderBothTables();
}

// ── FILTER DATA ───────────────────────────────────────────────
function getFilteredFor(viewType) {
  const q        = (document.getElementById('searchInput')?.value||'').toLowerCase();
  const today    = new Date(); today.setHours(0,0,0,0);
  const isClient = viewType === 'clients';

  const country   = !isClient ? (document.getElementById('filterCountry')?.value||'')   : (document.getElementById('filterCountryC')?.value||'');
  const program   = !isClient ? (document.getElementById('filterProgram')?.value||'')   : (document.getElementById('filterProgramC')?.value||'');
  const prio      = !isClient ? (document.getElementById('filterPriority')?.value||'')  : '';
  const dateRange = !isClient ? (document.getElementById('filterDateRange')?.value||'') : '';
  const versionF  = isClient  ? (document.getElementById('filterVersionC')?.value||'')  : '';
  const activeFilter = isClient ? cFilter : cFilterP;

  return records.filter(r => {
    // Type split: REJECTED prospects stay in prospects view only
    if (isClient  && r.type !== 'client')  return false;
    if (!isClient && r.type === 'client')  return false;

    if (activeFolder !== 'all' && r.folder_id !== activeFolder) return false;

    if (q) {
      const s = [r.company, r.contact, r.email, r.email2, r.email3,
                 r.city, r.country, r.program, r.version, r.notes].join(' ').toLowerCase();
      if (!s.includes(q)) return false;
    }

    if (country  && r.country   !== country)  return false;
    if (program  && r.program   !== program)  return false;
    if (prio     && r.priority  !== prio)     return false;
    if (versionF && r.version   !== versionF) return false;

    if (dateRange) {
      if (dateRange === 'never') { if (r.sent_date) return false; }
      else {
        const cutoff = new Date(); cutoff.setDate(cutoff.getDate()-parseInt(dateRange)); cutoff.setHours(0,0,0,0);
        if (!r.sent_date) return false;
        const sd = new Date(r.sent_date); sd.setHours(0,0,0,0);
        if (sd < cutoff) return false;
      }
    }

    if (isClient) {
      if (activeFilter === 'active')       return r.status !== 'lost';
      if (activeFilter === 'inactive')     return r.status === 'lost';
      if (activeFilter === 'ok')           return r.status !== 'lost' && (r.client_status === 'ok' || !r.client_status);
      if (activeFilter === 'incident')     return r.status !== 'lost' && r.client_status === 'incident';
      if (activeFilter === 'followup_today') {
        if (!r.next_followup) return false;
        const d = new Date(r.next_followup); d.setHours(0,0,0,0); return d <= today;
      }
      return true;
    } else {
      if (activeFilter === 'all')              return true;
      if (activeFilter === 'followup_today') {
        if (!r.next_followup) return false;
        const d = new Date(r.next_followup); d.setHours(0,0,0,0); return d <= today;
      }
      // Status-based filters — map both new and legacy statuses
      return r.status === activeFilter || legacyStatusMatch(r.status, activeFilter);
    }
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

// Map legacy status values to new filter names
function legacyStatusMatch(status, filter) {
  const legacyMap = {
    first_contact: ['sent'],                              // legacy 'sent' → Primer contacto
    no_response:   ['waiting'],                           // legacy 'waiting' → Sin responder
    contact_obtained: ['replied'],                        // legacy 'replied' → Datos obtenidos
    followup:      ['negotiation'],                       // legacy 'negotiation' → En seguimiento
  };
  return legacyMap[filter]?.includes(status) || false;
}

// ── RENDER ────────────────────────────────────────────────────
function renderBothTables() {
  const prospects = getFilteredFor('prospects');
  const clients   = getFilteredFor('clients');
  const totalShown = activeView==='prospects' ? prospects.length : clients.length;
  document.getElementById('rcount').textContent = `${totalShown} ${activeView==='prospects'?'prospecto':'cliente'}${totalShown!==1?'s':''}`;
  renderProspectsTable(prospects);
  renderClientsTable(clients);
  const pSec = document.getElementById('prospectsSection');
  const cSec = document.getElementById('clientsSection');
  if (pSec) pSec.style.display = activeView==='prospects' ? '' : 'none';
  if (cSec) cSec.style.display = activeView==='clients'   ? '' : 'none';
  const empty = document.getElementById('emptyState');
  if (empty) {
    empty.style.display = totalShown === 0 ? '' : 'none';
    document.getElementById('emptyIcon').textContent  = activeView==='prospects' ? '🎯' : '💼';
    document.getElementById('emptyTitle').textContent = `Sin ${activeView==='prospects'?'prospectos':'clientes'}`;
  }
}
function renderTable() { renderBothTables(); }

function renderEmails(r) {
  const emails = [r.email, r.email2, r.email3].filter(Boolean);
  if (!emails.length) return '';
  return `<div class="tc-emails">${emails.map(e=>`<div class="tc-email-line">${escH(e)}</div>`).join('')}</div>`;
}

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
        <div class="tc-company">${r.company?escH(r.company):'<span style="color:var(--ink3);font-style:italic">Sin nombre</span>'}</div>
        ${n>0?`<div class="tc-notes">💬 ${n}</div>`:''}
        ${r.notes?`<div class="tc-sub" style="font-style:italic;color:var(--ink3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:180px" title="${escH(r.notes)}">${escH(r.notes.slice(0,50))}${r.notes.length>50?'…':''}</div>`:''}
      </td>
      <td>
        <div style="font-size:.82rem;color:var(--ink2)">${r.contact||'<span style="color:var(--ink3);font-style:italic">—</span>'}</div>
        ${renderEmails(r)}
      </td>
      <td><div style="font-size:.82rem">${escH(loc)}</div></td>
      <td style="font-size:.82rem;color:var(--ink2)">${escH(r.program||'—')}</td>
      <td class="tc-date">${r.sent_date?fmtDate(r.sent_date):'<span style="font-style:italic;color:var(--ink3)">—</span>'}</td>
      <td>${renderProspectBadge(r.status)}</td>
      <td>${renderPrio(r.priority)}</td>
      <td>${renderFollowup(r.next_followup)}</td>
      <td><div class="row-actions">
        <button class="row-btn" onclick="event.stopPropagation();quickSend('${r.id}')" title="Enviar">✉️</button>
        <button class="row-btn" onclick="event.stopPropagation();openEdit('${r.id}')">✏️</button>
        <button class="row-btn danger" onclick="event.stopPropagation();deleteRecord('${r.id}')">🗑</button>
      </div></td>
    </tr>`;
  }).join('');
}

function renderClientsTable(rows) {
  const tbody = document.getElementById('tbodyClients');
  if (!tbody) return;
  tbody.innerHTML = rows.map(r => {
    const n = r._noteCount || 0;
    const sel = selectedIds.has(r.id);
    const loc = [r.city, r.country].filter(Boolean).join(', ') || '—';
    const isLost = r.status === 'lost';
    return `
    <tr onclick="openEdit('${r.id}')" class="${sel?'selected-row':''}${isLost?' row-inactive':''}">
      <td onclick="event.stopPropagation()"><input type="checkbox" class="chk rchk" data-id="${r.id}" ${sel?'checked':''} onchange="toggleRowSel(this)"></td>
      <td>
        <div class="tc-company">${r.company?escH(r.company):'<span style="color:var(--ink3);font-style:italic">Sin nombre</span>'}${isLost?'<span class="badge badge-inactive" style="margin-left:5px;font-size:.6rem">Inactivo</span>':''}</div>
        ${n>0?`<div class="tc-notes">💬 ${n}</div>`:''}
        ${r.notes?`<div class="tc-sub" style="font-style:italic;color:var(--ink3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:180px">${escH(r.notes.slice(0,50))}${r.notes.length>50?'…':''}</div>`:''}
      </td>
      <td>
        <div style="font-size:.82rem;color:var(--ink2)">${r.contact||'<span style="color:var(--ink3);font-style:italic">—</span>'}</div>
        ${renderEmails(r)}
      </td>
      <td><div style="font-size:.82rem">${escH(loc)}</div></td>
      <td style="font-size:.82rem;color:var(--ink2)">${escH(r.program||'—')}</td>
      <td style="font-size:.82rem;color:var(--ink3);font-family:var(--fm)">${escH(r.version||'—')}</td>
      <td>${renderClientStatusBadge(r.client_status||'ok')}</td>
      <td style="text-align:center;font-size:.8rem">${
        r.maintenance === 'yes' ? '<span style="color:#16a34a" title="Mantenimiento contratado">✅</span>'
        : r.maintenance === 'no' ? '<span style="color:#dc2626" title="Sin mantenimiento">❌</span>'
        : '<span style="color:var(--ink3)">—</span>'
      }</td>
      <td class="tc-date">${r.sent_date?fmtDate(r.sent_date):'<span style="font-style:italic;color:var(--ink3)">—</span>'}</td>
      <td>${renderFollowup(r.next_followup)}</td>
      <td><div class="row-actions">
        <button class="row-btn" onclick="event.stopPropagation();quickSend('${r.id}')" title="Enviar">✉️</button>
        <button class="row-btn" onclick="event.stopPropagation();openEdit('${r.id}')">✏️</button>
        <button class="row-btn danger" onclick="event.stopPropagation();deleteRecord('${r.id}')">🗑</button>
      </div></td>
    </tr>`;
  }).join('');
}

// ── FOLLOW-UP BANNER ──────────────────────────────────────────
function renderFollowupBanner() {
  const today   = new Date(); today.setHours(0,0,0,0);
  const overdue = records.filter(r => { if (!r.next_followup) return false; const d=new Date(r.next_followup);d.setHours(0,0,0,0);return d<today; });
  const todayFu = records.filter(r => { if (!r.next_followup) return false; const d=new Date(r.next_followup);d.setHours(0,0,0,0);return d.getTime()===today.getTime(); });
  const banner  = document.getElementById('followupBanner');
  const total   = overdue.length + todayFu.length;
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
function renderProspectBadge(status) {
  const s = status || 'new';
  const label = PROSPECT_STATUS_LABELS[s] || s;
  return `<span class="badge badge-${s}">${label}</span>`;
}

function renderBadge(status, isClient) {
  if (isClient) return renderClientStatusBadge(status);
  return renderProspectBadge(status);
}
function renderClientStatusBadge(s) {
  const label = CLIENT_STATUS_LABELS[s] || '✅ Sin incidencias';
  return `<span class="badge badge-c-${s||'ok'}">${label}</span>`;
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
  if (diff<0)        { cls='fu-overdue'; note=`vencido (${-diff}d)`; }
  else if (diff===0) { cls='fu-soon';    note='HOY'; }
  else if (diff<=3)  { cls='fu-soon'; }
  return `<div class="fu-cell ${cls}"><span class="fu-date">${fmtDate(dateStr)}</span><br><small style="font-size:.65rem">(${note})</small></div>`;
}
function toast(msg, type='') {
  const c = document.getElementById('toasts');
  const t = document.createElement('div');
  t.className=`toast ${type}`; t.textContent=msg; c.appendChild(t);
  setTimeout(()=>{t.style.opacity='0';t.style.transform='translateY(8px)';t.style.transition='all 300ms';setTimeout(()=>t.remove(),300);},3500);
}

// ── SELECTION ─────────────────────────────────────────────────
function toggleRowSel(chk) { if(chk.checked)selectedIds.add(chk.dataset.id);else selectedIds.delete(chk.dataset.id);updateBulkBar(); }
function toggleSelAll(chk) { getFilteredFor(activeView).forEach(r=>{if(chk.checked)selectedIds.add(r.id);else selectedIds.delete(r.id);}); renderBothTables();updateBulkBar(); }
function clearSelection() { selectedIds.clear();renderBothTables();updateBulkBar(); }
function updateBulkBar() {
  const bar=document.getElementById('bulkBar'),n=selectedIds.size;
  bar.style.display=n>0?'':'none';
  document.getElementById('bulkCount').textContent=`${n} seleccionado${n!==1?'s':''}`;
}
async function bulkDelete() {
  if(!selectedIds.size)return;if(!confirm(`¿Eliminar ${selectedIds.size} contactos?`))return;
  try{await dbDeleteContacts([...selectedIds]);await loadContacts();selectedIds.clear();renderSidebar();renderBothTables();renderFollowupBanner();toast('🗑 Eliminados','er');}
  catch(err){toast('Error: '+err.message,'er');}
}
function bulkSend(){openSendModal([...selectedIds]);}

// ── FOLDERS ───────────────────────────────────────────────────
let editingFolderId=null, pickedIcon='📁';
function openFolderModal(id){editingFolderId=id||null;document.getElementById('folderModalTitle').textContent=id?'Editar carpeta':'Nueva carpeta';const f=id?folders.find(x=>x.id===id):null;document.getElementById('folderName').value=f?.name||'';pickedIcon=f?.icon||'📁';renderIconPicker();document.getElementById('folderModal').classList.add('open');}
function closeFolderModal(){document.getElementById('folderModal').classList.remove('open');}
function renderIconPicker(){'📁 🌎 🇺🇸 🇲🇽 🇪🇸 🇩🇪 🇫🇷 🇬🇧 🇮🇹 🇸🇪 🇳🇴 🇵🇹 ⭐ 🔥 💼 🏗️ 💊 🎯 📌 🏥 🔬 🤝 💰'.split(' ').reduce((el,ic)=>{const s=document.createElement('span');s.className=`icon-opt ${ic===pickedIcon?'selected':''}`;s.textContent=ic;s.onclick=()=>pickIcon(ic);el.appendChild(s);return el;},document.getElementById('iconPicker'));}
function pickIcon(ic){pickedIcon=ic;renderIconPicker();}
async function saveFolderModal(){const name=document.getElementById('folderName').value.trim();if(!name){toast('Escribe un nombre','er');return;}try{const maxPos=folders.length?Math.max(...folders.map(f=>f.position||0)):0;await dbSaveFolder({id:editingFolderId||undefined,name,icon:pickedIcon,position:editingFolderId?undefined:maxPos+1});await loadFolders();closeFolderModal();renderSidebar();toast(`✅ Carpeta "${name}" guardada`,'ok');}catch(err){toast('Error: '+err.message,'er');}}
function editFolder(id){openFolderModal(id);}
async function deleteFolder(id){const f=folders.find(x=>x.id===id);if(!confirm(`¿Eliminar la carpeta "${f?.name}"?\nLos contactos NO se borran.`))return;try{await dbDeleteFolder(id);if(activeFolder===id)activeFolder='all';await loadFolders();renderSidebar();renderBothTables();toast('🗑 Carpeta eliminada','er');}catch(err){toast('Error: '+err.message,'er');}}
function openMoveModal(){const ids=[...selectedIds];document.getElementById('moveFolderList').innerHTML=folders.map(f=>`<button class="nb" style="color:var(--ink2);background:var(--paper);border:1.5px solid var(--border);margin-bottom:4px" onclick="doMove('${f.id}',${JSON.stringify(ids)})"><span>${f.icon||'📁'}</span><span style="flex:1;color:var(--ink)">${f.name}</span><span style="font-size:.72rem;color:var(--acc)">→ mover aquí</span></button>`).join('');document.getElementById('moveModal').classList.add('open');}
function closeMoveModal(){document.getElementById('moveModal').classList.remove('open');}
async function doMove(folderId,ids){try{await dbMoveContacts(ids,folderId);await loadContacts();clearSelection();renderSidebar();renderBothTables();closeMoveModal();toast(`📁 ${ids.length} → ${folders.find(f=>f.id===folderId)?.name}`,'ok');}catch(err){toast('Error: '+err.message,'er');}}

// ── EXPORT ────────────────────────────────────────────────────
function exportCSV(){
  const rows=getFilteredFor(activeView);
  const H=['ID','Nombre','Contacto','Email','Email2','Email3','Cargo','País','Ciudad','Programa','Versión','Tipo','Tipo cliente','Prioridad','Estado','Estado cliente','Fecha Envío','Asunto','Próx. Follow-up','Notas','Carpeta'];
  const esc=v=>`"${String(v||'').replace(/"/g,'""')}"`;
  const fn=id=>folders.find(f=>f.id===id)?.name||'';
  const csv=[H.join(','),...rows.map(r=>[r.id,r.company,r.contact,r.email,r.email2||'',r.email3||'',r.role,r.country,r.city,r.program,r.version,r.type,r.client_type,r.priority,r.status,r.client_status,r.sent_date,r.subject,r.next_followup,r.notes,fn(r.folder_id)].map(esc).join(','))].join('\n');
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));a.download=`cpfarma_${activeView}_${new Date().toISOString().slice(0,10)}.csv`;a.click();
  toast('📥 CSV exportado','info');
}

window.addEventListener('DOMContentLoaded', () => initAuth());
