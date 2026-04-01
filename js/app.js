// ═══════════════════════════════════════════════════════════════
// APP.JS — Lógica principal: estado, tabla, filtros, sidebar
// ═══════════════════════════════════════════════════════════════

// ── STATE ─────────────────────────────────────────────────────
let records   = [];
let folders   = [];
let templates = [];

let activeFolder = 'all';
let cFilter      = 'all';
let cSort        = 'date';
let cSortDir     = 'desc';
let selectedIds  = new Set();

// ── INIT ──────────────────────────────────────────────────────
async function initApp() {
  showLoading(true);
  try {
    await Promise.all([
      loadFolders(),
      loadTemplates(),
    ]);
    await loadContacts();
    renderSidebar();
    renderTable();
    renderFollowupBanner();
    populateCountryFilter();
    setupRealtimeSync();
  } catch (err) {
    console.error('Init error:', err);
    toast('Error al cargar los datos. Comprueba la conexión.', 'er');
  }
  showLoading(false);
}

async function loadContacts() {
  try {
    records = await dbGetContacts();
  } catch(err) {
    console.error('loadContacts:', err);
    records = [];
  }
}

async function loadFolders() {
  try {
    folders = await dbGetFolders();
  } catch(err) {
    console.error('loadFolders:', err);
    folders = [];
  }
  // Refresh all folder selects in the UI
  const folderOpts = '<option value="">— Sin carpeta —</option>' +
    folders.map(f => `<option value="${f.id}">${f.icon || '📁'} ${f.name}</option>`).join('');
  ['f-folder','impFolder'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { const prev = el.value; el.innerHTML = folderOpts; if (prev) el.value = prev; }
  });
}

async function loadTemplates() {
  try {
    templates = await dbGetTemplates();
  } catch(err) {
    console.error('loadTemplates:', err);
    templates = [];
  }
}

function showLoading(on) {
  const loading = document.getElementById('loadingState');
  const table   = document.getElementById('contactsTable');
  const empty   = document.getElementById('emptyState');
  if (loading) loading.style.display = on ? '' : 'none';
  if (table)   table.style.display   = on ? 'none' : '';
  if (on && empty) empty.style.display = 'none';
}

// ── REALTIME ──────────────────────────────────────────────────
function setupRealtimeSync() {
  subscribeToContacts(async (payload) => {
    // Re-fetch contacts when any change happens from another user
    await loadContacts();
    renderSidebar();
    renderTable();
    renderFollowupBanner();
    populateCountryFilter();
  });
}

// ── SIDEBAR ───────────────────────────────────────────────────
function renderSidebar() {
  const today = new Date(); today.setHours(0,0,0,0);

  const total    = records.length;
  const replied  = records.filter(r => r.status === 'replied' || r.status === 'won').length;
  const waiting  = records.filter(r => r.status === 'waiting').length;
  const fuToday  = records.filter(r => {
    if (!r.next_followup) return false;
    const d = new Date(r.next_followup); d.setHours(0,0,0,0);
    return d <= today;
  }).length;

  document.getElementById('sbStats').innerHTML = `
    <div class="sb-stat"><div class="sb-stat-n">${total}</div><div class="sb-stat-l">Total</div></div>
    <div class="sb-stat"><div class="sb-stat-n green">${replied}</div><div class="sb-stat-l">Respondidos</div></div>
    <div class="sb-stat"><div class="sb-stat-n yellow">${waiting}</div><div class="sb-stat-l">Sin resp.</div></div>
    <div class="sb-stat"><div class="sb-stat-n ${fuToday > 0 ? 'red' : ''}">${fuToday}</div><div class="sb-stat-l">Follow-up</div></div>
  `;

  const folderCounts = {};
  records.forEach(r => {
    if (r.folder_id) folderCounts[r.folder_id] = (folderCounts[r.folder_id] || 0) + 1;
  });

  document.getElementById('sbNav').innerHTML = `
    <div class="sb-section">Vistas</div>
    <button class="nb ${activeFolder === 'all' ? 'active' : ''}" onclick="setFolder('all')">
      <span class="ni">📬</span><span class="nt">Todos los contactos</span><span class="nk">${total}</span>
    </button>
    <button class="nb" onclick="setFilter('followup', document.querySelector('[data-filter=followup]'))">
      <span class="ni">🔔</span><span class="nt">Follow-up hoy</span><span class="nk ${fuToday > 0 ? 'style=color:#fca5a5' : ''}">${fuToday}</span>
    </button>

    <div class="sb-section" style="margin-top:8px">
      Carpetas
      <button onclick="openFolderModal()" style="float:right;background:rgba(255,255,255,.1);border:none;color:rgba(255,255,255,.6);border-radius:3px;padding:1px 6px;cursor:pointer;font-size:.62rem">+ Nueva</button>
    </div>
    ${folders.map(f => `
      <button class="nb ${activeFolder === f.id ? 'active' : ''}" onclick="setFolder('${f.id}')">
        <span class="ni">${f.icon || '📁'}</span>
        <span class="nt">${f.name}</span>
        <span class="nk">${folderCounts[f.id] || 0}</span>
        <span class="folder-actions">
          <span class="folder-btn" onclick="event.stopPropagation();editFolder('${f.id}')" title="Editar">✏️</span>
          <span class="folder-btn" onclick="event.stopPropagation();deleteFolder('${f.id}')" title="Eliminar">🗑</span>
        </span>
      </button>
    `).join('')}

    <div class="sb-section" style="margin-top:8px">Herramientas</div>
    <button class="nb" onclick="openSendModal()"><span class="ni">✉️</span><span class="nt">Enviar emails</span></button>
    <button class="nb" onclick="openTplModal()"><span class="ni">📝</span><span class="nt">Plantillas</span></button>
    <button class="nb" onclick="openImport()"><span class="ni">📥</span><span class="nt">Importar Excel</span></button>
    <button class="nb" onclick="exportCSV()"><span class="ni">⬇️</span><span class="nt">Exportar CSV</span></button>
  `;
}

function setFolder(id) {
  activeFolder = id;
  const folderName = id === 'all' ? 'Todos los contactos' :
    (folders.find(f => f.id === id)?.name || id);
  document.getElementById('viewTitle').textContent = folderName;
  renderSidebar();
  renderTable();
}

// ── FILTERS ───────────────────────────────────────────────────
function setFilter(f, btn) {
  cFilter = f;
  document.querySelectorAll('.ftab').forEach(t => t.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderTable();
}

function populateCountryFilter() {
  const countries = [...new Set(records.map(r => r.country).filter(Boolean))].sort();
  const sel = document.getElementById('filterCountry');
  const prev = sel.value;
  sel.innerHTML = '<option value="">País</option>' +
    countries.map(c => `<option value="${c}">${c}</option>`).join('');
  if (prev) sel.value = prev;
}

// ── SORTING ───────────────────────────────────────────────────
function setSort(col) {
  if (cSort === col) {
    cSortDir = cSortDir === 'asc' ? 'desc' : 'asc';
  } else {
    cSort = col;
    cSortDir = 'asc';
  }
  updateSortIcons();
  renderTable();
}

function updateSortIcons() {
  ['company', 'country', 'date', 'prio', 'followup'].forEach(col => {
    const el = document.getElementById(`si-${col}`);
    if (!el) return;
    el.textContent = cSort === col ? (cSortDir === 'asc' ? '↑' : '↓') : '';
    el.style.opacity = cSort === col ? '1' : '0.3';
  });
}

// ── TABLE ─────────────────────────────────────────────────────
function getFiltered() {
  const q = (document.getElementById('searchInput')?.value || '').toLowerCase();
  const prio = document.getElementById('filterPriority')?.value || '';
  const country = document.getElementById('filterCountry')?.value || '';
  const today = new Date(); today.setHours(0,0,0,0);

  return records.filter(r => {
    // Folder filter
    if (activeFolder !== 'all' && r.folder_id !== activeFolder) return false;

    // Search
    if (q) {
      const searchable = [r.company, r.contact, r.email, r.city, r.country,
        r.subject, r.sector, (r.tags || []).join(' ')].join(' ').toLowerCase();
      if (!searchable.includes(q)) return false;
    }

    // Priority filter
    if (prio && r.priority !== prio) return false;

    // Country filter
    if (country && r.country !== country) return false;

    // Type filter
    const typeFilter = document.getElementById('filterType')?.value || '';
    if (typeFilter && r.type !== typeFilter) return false;

    // Status filter
    if (cFilter === 'new')     return r.status === 'new' || !r.status;
    if (cFilter === 'sent')    return r.status === 'sent';
    if (cFilter === 'replied') return r.status === 'replied';
    if (cFilter === 'waiting') return r.status === 'waiting';
    if (cFilter === 'followup') {
      if (!r.next_followup) return false;
      const d = new Date(r.next_followup); d.setHours(0,0,0,0);
      return d <= today;
    }

    return true;
  }).sort((a, b) => {
    let valA, valB;
    const prioMap = { Alta: 0, Media: 1, Baja: 2 };

    if (cSort === 'company')  { valA = a.company || ''; valB = b.company || ''; }
    if (cSort === 'prio')     { valA = prioMap[a.priority] ?? 1; valB = prioMap[b.priority] ?? 1; }
    if (cSort === 'followup') { valA = a.next_followup || '9999'; valB = b.next_followup || '9999'; }
    if (cSort === 'country')  { valA = a.country || ''; valB = b.country || ''; }
    if (cSort === 'date')     { valA = a.sent_date || a.created_at || ''; valB = b.sent_date || b.created_at || ''; }

    if (typeof valA === 'number') {
      return cSortDir === 'asc' ? valA - valB : valB - valA;
    }
    return cSortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
  });
}

function renderTable() {
  const rows = getFiltered();
  const tbody = document.getElementById('tableBody');

  document.getElementById('rcount').textContent = `${rows.length} contacto${rows.length !== 1 ? 's' : ''}`;
  document.getElementById('topbarBadge').textContent = '';

  if (!rows.length) {
    tbody.innerHTML = '';
    document.getElementById('emptyState').style.display = '';
    return;
  }
  document.getElementById('emptyState').style.display = 'none';

  tbody.innerHTML = rows.map(r => {
    const noteCount = r._noteCount || r.interactions?.[0]?.count || 0;
    const isSelected = selectedIds.has(r.id);
    return `
    <tr onclick="openEdit('${r.id}')" class="${isSelected ? 'selected-row' : ''}">
      <td onclick="event.stopPropagation()">
        <input type="checkbox" class="chk rchk" data-id="${r.id}"
          ${isSelected ? 'checked' : ''} onchange="toggleRowSel(this)">
      </td>
      <td>
        <div class="tc-company">${escH(r.company)}</div>
        ${r.email_type ? `<div class="tc-sub">${r.email_type}</div>` : ''}
        ${noteCount > 0 ? `<div class="tc-notes">💬 ${noteCount}</div>` : ''}
      </td>
      <td>
        <div style="font-size:.82rem;color:var(--ink2)">${r.contact || '<span style="color:var(--ink3);font-style:italic">—</span>'}</div>
        <div class="tc-email">${r.email || ''}</div>
      </td>
      <td>
        <div style="font-size:.82rem">${r.country || '—'}</div>
        ${r.city ? `<div class="tc-sub">${r.city}</div>` : ''}
      </td>
      <td class="tc-date">${r.sent_date ? fmtDate(r.sent_date) : '<span style="font-style:italic">—</span>'}</td>
      <td>${renderBadge(r.status)}</td>
      <td>${renderPrio(r.priority)}</td>
      <td>${renderFollowup(r.next_followup)}</td>
      <td>
        <div class="row-actions">
          <button class="row-btn" onclick="event.stopPropagation();quickSend('${r.id}')" title="Enviar email">✉️</button>
          <button class="row-btn" onclick="event.stopPropagation();openEdit('${r.id}')">✏️</button>
          <button class="row-btn danger" onclick="event.stopPropagation();deleteRecord('${r.id}')" title="Eliminar">🗑</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

// ── FOLLOW-UP BANNER ──────────────────────────────────────────
function renderFollowupBanner() {
  const today = new Date(); today.setHours(0,0,0,0);
  const overdue = records.filter(r => {
    if (!r.next_followup) return false;
    const d = new Date(r.next_followup); d.setHours(0,0,0,0);
    return d < today;
  });
  const todayItems = records.filter(r => {
    if (!r.next_followup) return false;
    const d = new Date(r.next_followup); d.setHours(0,0,0,0);
    return d.getTime() === today.getTime();
  });

  const banner = document.getElementById('followupBanner');
  const total = overdue.length + todayItems.length;

  if (total === 0) {
    banner.style.display = 'none';
    return;
  }

  let msg = '🔔 ';
  if (overdue.length > 0) msg += `<strong>${overdue.length} follow-up${overdue.length > 1 ? 's' : ''} vencido${overdue.length > 1 ? 's' : ''}</strong>`;
  if (overdue.length > 0 && todayItems.length > 0) msg += ' · ';
  if (todayItems.length > 0) msg += `<strong>${todayItems.length} para hoy</strong>`;
  msg += ` — <a href="#" onclick="setFilter('followup', document.querySelector('[data-filter=followup]'));return false;" style="color:#92400e;font-weight:700;text-decoration:underline">Ver todos →</a>`;

  banner.innerHTML = msg;
  banner.style.display = '';
}

// ── HELPERS ───────────────────────────────────────────────────
function fmtDate(s) {
  if (!s) return '—';
  const [y, m, d] = s.split('T')[0].split('-');
  return `${d}/${m}/${y}`;
}

function escH(s) {
  return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

const STATUS_LABELS = {
  new: '🆕 Sin contactar',
  sent: '📤 Enviado',
  replied: '✅ Respondido',
  waiting: '⏳ Sin respuesta',
  negotiation: '🤝 Negociando',
  won: '🏆 Ganado',
  lost: '❌ Perdido',
};

function renderBadge(status) {
  const s = status || 'new';
  const label = STATUS_LABELS[s] || s;
  return `<span class="badge badge-${s}">${label}</span>`;
}

function renderPrio(p) {
  const cls = p === 'Alta' ? 'alta' : p === 'Baja' ? 'baja' : 'media';
  const dot = `<span class="prio-dot"></span>`;
  return `<span class="prio prio-${cls}">${dot}${p || 'Media'}</span>`;
}

function renderFollowup(dateStr) {
  if (!dateStr) return '<span style="color:var(--ink3);font-size:.72rem">—</span>';
  const today = new Date(); today.setHours(0,0,0,0);
  const d = new Date(dateStr); d.setHours(0,0,0,0);
  const diff = Math.round((d - today) / 86400000);
  let cls = 'fu-ok', note = `en ${diff}d`;
  if (diff < 0)     { cls = 'fu-overdue'; note = `vencido (${-diff}d)`; }
  else if (diff === 0) { cls = 'fu-soon'; note = 'HOY'; }
  else if (diff <= 3)  { cls = 'fu-soon'; }
  return `<div class="fu-cell ${cls}"><span class="fu-date">${fmtDate(dateStr)}</span><br><small style="font-size:.65rem">(${note})</small></div>`;
}

function toast(msg, type = '') {
  const c = document.getElementById('toasts');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => {
    t.style.opacity = '0';
    t.style.transform = 'translateY(8px)';
    t.style.transition = 'all 300ms';
    setTimeout(() => t.remove(), 300);
  }, 3500);
}

// ── SELECTION ─────────────────────────────────────────────────
function toggleRowSel(chk) {
  const id = chk.dataset.id;
  if (chk.checked) selectedIds.add(id);
  else selectedIds.delete(id);
  updateBulkBar();
}

function toggleSelAll(chk) {
  const rows = getFiltered();
  rows.forEach(r => {
    if (chk.checked) selectedIds.add(r.id);
    else selectedIds.delete(r.id);
  });
  renderTable();
  updateBulkBar();
}

function clearSelection() {
  selectedIds.clear();
  renderTable();
  updateBulkBar();
}

function updateBulkBar() {
  const bar = document.getElementById('bulkBar');
  const count = selectedIds.size;
  if (count > 0) {
    bar.style.display = '';
    document.getElementById('bulkCount').textContent = `${count} seleccionado${count > 1 ? 's' : ''}`;
  } else {
    bar.style.display = 'none';
  }
}

async function bulkDelete() {
  if (!selectedIds.size) return;
  if (!confirm(`¿Eliminar ${selectedIds.size} contactos? Esta acción no se puede deshacer.`)) return;
  try {
    await dbDeleteContacts([...selectedIds]);
    await loadContacts();
    selectedIds.clear();
    renderSidebar();
    renderTable();
    renderFollowupBanner();
    toast(`🗑 ${selectedIds.size} contactos eliminados`, 'er');
  } catch (err) {
    toast('Error al eliminar: ' + err.message, 'er');
  }
}

function bulkSend() {
  openSendModal([...selectedIds]);
}

// ── FOLDERS ───────────────────────────────────────────────────
let editingFolderId = null;
let pickedIcon = '📁';

function openFolderModal(id) {
  editingFolderId = id || null;
  pickedIcon = '📁';
  document.getElementById('folderModalTitle').textContent = id ? 'Editar carpeta' : 'Nueva carpeta';
  const f = id ? folders.find(x => x.id === id) : null;
  document.getElementById('folderName').value = f?.name || '';
  if (f?.icon) pickedIcon = f.icon;
  renderIconPicker();
  document.getElementById('folderModal').classList.add('open');
}

function closeFolderModal() {
  document.getElementById('folderModal').classList.remove('open');
}

function renderIconPicker() {
  const icons = '📁 🌎 🇺🇸 🇲🇽 🇪🇸 🇩🇪 🇫🇷 🇬🇧 🇮🇹 🇸🇪 🇳🇴 🇵🇹 ⭐ 🔥 💼 🏗️ 💊 🎯 📌 🏥 🔬 🤝 💰'.split(' ');
  document.getElementById('iconPicker').innerHTML = icons.map(ic =>
    `<span class="icon-opt ${ic === pickedIcon ? 'selected' : ''}" onclick="pickIcon('${ic}')">${ic}</span>`
  ).join('');
}

function pickIcon(ic) {
  pickedIcon = ic;
  renderIconPicker();
}

async function saveFolderModal() {
  const name = document.getElementById('folderName').value.trim();
  if (!name) { toast('Escribe un nombre', 'er'); return; }
  try {
    const maxPos = folders.length ? Math.max(...folders.map(f => f.position || 0)) : 0;
    await dbSaveFolder({
      id: editingFolderId || undefined,
      name,
      icon: pickedIcon,
      position: editingFolderId ? undefined : maxPos + 1,
    });
    await loadFolders();
    closeFolderModal();
    renderSidebar();
    toast(`✅ Carpeta "${name}" guardada`, 'ok');
  } catch (err) {
    toast('Error: ' + err.message, 'er');
  }
}

function editFolder(id) { openFolderModal(id); }

async function deleteFolder(id) {
  const f = folders.find(x => x.id === id);
  if (!confirm(`¿Eliminar la carpeta "${f?.name}"?\nLos contactos no se borran.`)) return;
  try {
    await dbDeleteFolder(id);
    if (activeFolder === id) activeFolder = 'all';
    await loadFolders();
    renderSidebar();
    renderTable();
    toast('🗑 Carpeta eliminada', 'er');
  } catch (err) {
    toast('Error: ' + err.message, 'er');
  }
}

// ── MOVE MODAL ────────────────────────────────────────────────
function openMoveModal() {
  const movingIds = selectedIds.size > 0 ? [...selectedIds] : [];
  const list = document.getElementById('moveFolderList');
  list.innerHTML = folders.map(f =>
    `<button class="nb" style="color:var(--ink2);background:var(--paper);border:1.5px solid var(--border);margin-bottom:4px"
      onclick="doMove('${f.id}',${JSON.stringify(movingIds)})">
      <span>${f.icon || '📁'}</span>
      <span style="flex:1;color:var(--ink)">${f.name}</span>
      <span style="font-size:.72rem;color:var(--acc)">→ mover aquí</span>
    </button>`
  ).join('');
  document.getElementById('moveModal').classList.add('open');
}

function closeMoveModal() {
  document.getElementById('moveModal').classList.remove('open');
}

async function doMove(folderId, ids) {
  try {
    await dbMoveContacts(ids, folderId);
    await loadContacts();
    clearSelection();
    renderSidebar();
    renderTable();
    closeMoveModal();
    const folderName = folders.find(f => f.id === folderId)?.name || folderId;
    toast(`📁 ${ids.length} contacto${ids.length > 1 ? 's' : ''} → ${folderName}`, 'ok');
  } catch (err) {
    toast('Error: ' + err.message, 'er');
  }
}

// ── EXPORT CSV ────────────────────────────────────────────────
function exportCSV() {
  const rows = getFiltered();
  const headers = ['ID','Empresa','Contacto','Email','Cargo','País','Ciudad','Sector',
    'Prioridad','Tipo','Estado','Fecha Envío','Asunto','Próx. Follow-up','Producto','Valor','Carpeta'];
  const esc = v => `"${String(v || '').replace(/"/g, '""')}"`;
  const folderName = id => folders.find(f => f.id === id)?.name || '';

  const csv = [
    headers.join(','),
    ...rows.map(r => [
      r.id, r.company, r.contact, r.email, r.role, r.country, r.city, r.sector,
      r.priority, r.type, r.status, r.sent_date, r.subject,
      r.next_followup, r.deal_product, r.deal_value, folderName(r.folder_id)
    ].map(esc).join(','))
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `cpfarma_crm_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  toast('📥 CSV exportado', 'info');
}

// ── START ──────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => initAuth());
