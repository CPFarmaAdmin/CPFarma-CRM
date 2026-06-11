// ═══════════════════════════════════════════════════════════════
// NOTIFICATIONS.JS — Campana de notificaciones en tiempo real
// ═══════════════════════════════════════════════════════════════

let _notifs        = [];
let _notifOpen     = false;
let _notifSub      = null;

// ── INIT (llamado desde auth.js al hacer login) ───────────────
async function initNotifications() {
  if (!currentUser) return;
  await loadNotifications();
  _subscribeNotifications();
}

async function loadNotifications() {
  try {
    const { data, error } = await db
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(40);
    if (error) throw error;
    _notifs = data || [];
    _renderNotifBadge();
    if (_notifOpen) _renderNotifList();
  } catch (e) {
    console.warn('Notifications load error:', e.message);
  }
}

function _subscribeNotifications() {
  if (_notifSub) return;
  _notifSub = db.channel('notif-' + currentUser.id)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'notifications',
      filter: `user_id=eq.${currentUser.id}`,
    }, (payload) => {
      _notifs.unshift(payload.new);
      _renderNotifBadge();
      if (_notifOpen) _renderNotifList();
      toast('🔔 ' + payload.new.title, 'info');
    })
    .subscribe();
}

// ── BADGE ─────────────────────────────────────────────────────
function _renderNotifBadge() {
  const badge  = document.getElementById('notifBadge');
  const unread = _notifs.filter(n => !n.read_at).length;
  if (!badge) return;
  badge.textContent    = unread > 9 ? '9+' : String(unread);
  badge.style.display  = unread > 0 ? '' : 'none';
}

// ── DROPDOWN ──────────────────────────────────────────────────
function toggleNotifDropdown() {
  const dropdown = document.getElementById('notifDropdown');
  if (!dropdown) return;
  _notifOpen = !_notifOpen;
  dropdown.style.display = _notifOpen ? '' : 'none';
  if (_notifOpen) {
    _renderNotifList();
    setTimeout(() => document.addEventListener('click', _onOutsideNotifClick), 50);
  }
}

function _onOutsideNotifClick(e) {
  const dropdown = document.getElementById('notifDropdown');
  const bell     = document.getElementById('notifBell');
  if (dropdown?.contains(e.target) || bell?.contains(e.target)) {
    document.addEventListener('click', _onOutsideNotifClick, { once: true });
    return;
  }
  dropdown && (dropdown.style.display = 'none');
  _notifOpen = false;
}

// ── RENDER LIST ───────────────────────────────────────────────
const _NOTIF_ICONS = {
  followup_due:    '⏰',
  demo_reminder:   '📅',
  auto_reply:      '📥',
  user_registered: '👤',
};

function _renderNotifList() {
  const list = document.getElementById('notifList');
  if (!list) return;

  if (!_notifs.length) {
    list.innerHTML = '<div class="notif-empty">Sin notificaciones 🎉</div>';
    return;
  }

  list.innerHTML = _notifs.map((n, i) => {
    const unread   = !n.read_at;
    const icon     = _NOTIF_ICONS[n.type] || '🔔';
    const timeStr  = _timeAgo(n.created_at);
    const entityId = n.entity_id || '';

    return `<div class="notif-item${unread ? ' notif-unread' : ''}"
        onclick="_notifClick(${i})">
      ${unread ? '<div class="notif-dot"></div>' : '<div class="notif-dot-ph"></div>'}
      <div class="notif-icon">${icon}</div>
      <div class="notif-content">
        <div class="notif-title">${escH(n.title)}</div>
        ${n.body ? `<div class="notif-body">${escH(n.body)}</div>` : ''}
        <div class="notif-time">${timeStr}</div>
      </div>
    </div>`;
  }).join('');
}

// ── CLICK ON NOTIFICATION ─────────────────────────────────────
async function _notifClick(idx) {
  const n = _notifs[idx];
  if (!n) return;

  // Mark as read immediately
  if (!n.read_at) await markNotifRead(n.id);

  // Close dropdown
  document.getElementById('notifDropdown').style.display = 'none';
  _notifOpen = false;

  // Navigate
  if (n.type === 'user_registered' && isAdmin()) {
    openUsersPanel();
    return;
  }
  if (n.entity_id) {
    // Try local records first, then fetch from DB
    let r = (typeof records !== 'undefined' ? records : []).find(x => x.id === n.entity_id);
    if (!r) {
      try { r = await dbGetContact(n.entity_id); } catch (_) { return; }
    }
    if (r) openPanel(r);
  }
}

// ── MARK READ ─────────────────────────────────────────────────
async function markNotifRead(id) {
  const now = new Date().toISOString();
  _notifs = _notifs.map(n => n.id === id ? { ...n, read_at: now } : n);
  _renderNotifBadge();
  _renderNotifList();
  await db.from('notifications').update({ read_at: now }).eq('id', id);
}

async function markAllNotifsRead() {
  if (!currentUser) return;
  const now = new Date().toISOString();
  _notifs   = _notifs.map(n => ({ ...n, read_at: n.read_at || now }));
  _renderNotifBadge();
  _renderNotifList();
  await db.from('notifications')
    .update({ read_at: now })
    .eq('user_id', currentUser.id)
    .is('read_at', null);
}

// ── HELPERS ───────────────────────────────────────────────────
function _timeAgo(iso) {
  const diff  = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60000);
  if (mins < 1)   return 'ahora mismo';
  if (mins < 60)  return `hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours}h`;
  const days  = Math.floor(hours / 24);
  return `hace ${days}d`;
}
