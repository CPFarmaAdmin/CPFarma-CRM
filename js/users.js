// ═══════════════════════════════════════════════════════════════
// USERS.JS — Gestión de usuarios y roles (admin / comercial / viewer)
// ═══════════════════════════════════════════════════════════════

let currentUserProfile = null;
let allUserProfiles    = [];

const ROLE_LABELS = {
  admin:     '🔑 Admin',
  comercial: '💼 Comercial',
  viewer:    '👁 Visor',
};
const ROLE_LABELS_FULL = {
  admin:     '🔑 Administrador',
  comercial: '💼 Comercial',
  viewer:    '👁️ Solo lectura',
};

// ── ROLE HELPERS ──────────────────────────────────────────────
function isAdmin()     { return currentUserProfile?.role === 'admin'; }
function isComercial() { return currentUserProfile?.role === 'comercial'; }
function isViewer()    { return currentUserProfile?.role === 'viewer'; }
function canEdit()     { return currentUserProfile && (isAdmin() || isComercial()); }

// ── LOAD / CREATE PROFILE ─────────────────────────────────────
async function loadCurrentUserProfile() {
  if (!currentUser) return null;

  const { data, error } = await db
    .from('user_profiles')
    .select('*')
    .eq('user_id', currentUser.id)
    .maybeSingle();

  if (data) {
    currentUserProfile = data;
    return data;
  }

  // No profile — create one (auto-bootstrap)
  return await _createOwnProfile();
}

async function _createOwnProfile() {
  // Count existing profiles: if none exist this is the first user → admin
  const { count } = await db
    .from('user_profiles')
    .select('*', { count: 'exact', head: true });

  const isFirstUser = (count === 0);

  const profile = {
    user_id:   currentUser.id,
    email:     currentUser.email,
    name:      currentUser.email?.split('@')[0] || 'Usuario',
    role:      isFirstUser ? 'admin' : 'comercial',
    is_active: true,
  };

  const { data, error } = await db
    .from('user_profiles')
    .insert(profile)
    .select()
    .single();

  if (error) {
    console.error('_createOwnProfile:', error);
    currentUserProfile = { ...profile, id: 'local' };
    return currentUserProfile;
  }

  currentUserProfile = data;
  return data;
}

// ── APPLY UI RESTRICTIONS ─────────────────────────────────────
function applyRoleRestrictions() {
  if (!currentUserProfile) return;

  // Static elements with .role-admin only show for admins
  document.querySelectorAll('.role-admin').forEach(el => {
    el.style.display = isAdmin() ? '' : 'none';
  });

  // Static elements with .role-edit show for admin + comercial
  document.querySelectorAll('.role-edit').forEach(el => {
    el.style.display = canEdit() ? '' : 'none';
  });

  // Viewer info banner
  const vb = document.getElementById('viewerBanner');
  if (vb) vb.style.display = isViewer() ? '' : 'none';

  // Role badge in sidebar
  const badge = document.getElementById('sbRoleBadge');
  if (badge) {
    badge.textContent = ROLE_LABELS[currentUserProfile.role] || currentUserProfile.role;
    badge.className   = `sb-role-badge sb-role-${currentUserProfile.role}`;
  }
}

// ── INACTIVE SCREEN ───────────────────────────────────────────
function showInactiveScreen() {
  document.getElementById('loginScreen').style.display  = 'none';
  document.getElementById('app').style.display          = 'none';
  const s = document.getElementById('inactiveScreen');
  if (s) s.style.display = '';
}

// ── ORG SETTINGS ──────────────────────────────────────────────
let _currentOrgName = '';

async function loadOrgName() {
  try {
    const settings = await dbGetOrgSettings();
    const name = settings?.name || (typeof ORG_NAME !== 'undefined' ? ORG_NAME : 'Mi Empresa');
    _currentOrgName = name;
    _applyOrgName(name);
  } catch(e) {
    _currentOrgName = typeof ORG_NAME !== 'undefined' ? ORG_NAME : 'Mi Empresa';
  }
}

function _applyOrgName(name) {
  const brandEl = document.getElementById('sbBrandName');
  const logoEl  = document.getElementById('sbLogo');
  if (brandEl) brandEl.textContent = name;
  if (logoEl)  logoEl.textContent  = name.slice(0, 2).toUpperCase();
}

async function saveOrgName() {
  const input = document.getElementById('orgNameInput');
  const name  = input?.value?.trim();
  const errEl = document.getElementById('orgNameError');
  errEl.style.display = 'none';
  if (!name) { errEl.textContent = 'El nombre no puede estar vacío.'; errEl.style.display = ''; return; }
  const btn = document.getElementById('orgNameBtn');
  btn.textContent = 'Guardando…'; btn.disabled = true;
  try {
    await dbSaveOrgSettings(name);
    _currentOrgName = name;
    _applyOrgName(name);
    _updateModalOrgHeader();
    dbLogActivity('org_name_changed', 'org', null, name, { name });
    toast(`✅ Nombre actualizado a "${name}"`, 'ok');
  } catch(err) {
    errEl.textContent = err.message; errEl.style.display = '';
  }
  btn.textContent = '💾 Guardar'; btn.disabled = false;
}

function _updateModalOrgHeader() {
  const orgEl = document.getElementById('usersModalOrg');
  if (orgEl) {
    orgEl.innerHTML = _currentOrgName
      ? `🏢 <strong>${escH(_currentOrgName)}</strong> · <span style="color:var(--ink3)">Admin: ${escH(currentUser?.email || '')}</span>`
      : '';
  }
}

// ── OPEN / CLOSE CONTROL PANEL ────────────────────────────────
async function openUsersPanel() {
  if (!isAdmin()) { toast('Solo los administradores pueden gestionar usuarios.', 'er'); return; }
  document.getElementById('usersModal').classList.add('open');
  _updateModalOrgHeader();
  switchControlTab('users');
}

function closeUsersPanel() {
  document.getElementById('usersModal').classList.remove('open');
  const f = document.getElementById('inviteForm');
  if (f) f.style.display = 'none';
}

// ── CONTROL PANEL TABS ────────────────────────────────────────
function switchControlTab(tab) {
  document.querySelectorAll('.ctrl-tab-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.ctrl-tab-pane').forEach(p =>
    p.style.display = p.dataset.pane === tab ? '' : 'none');

  if (tab === 'users')  _loadAllUsers();
  if (tab === 'logs')   loadLogsTab();
  if (tab === 'config') _loadConfigTab();
  if (tab === 'email')  loadEmailTab();
}

// ── LOAD & RENDER USERS LIST ──────────────────────────────────
async function _loadAllUsers() {
  const list = document.getElementById('usersList');
  list.innerHTML = '<div style="padding:20px;text-align:center;color:var(--ink3);font-style:italic">Cargando usuarios…</div>';

  try {
    const { data, error } = await db
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) throw error;
    allUserProfiles = data || [];
    _renderUsersList();
  } catch (err) {
    list.innerHTML = `<div style="padding:20px;color:var(--c-lost)">Error al cargar: ${escH(err.message)}</div>`;
  }
}

function _renderUsersList() {
  const list = document.getElementById('usersList');
  if (!allUserProfiles.length) {
    list.innerHTML = '<div style="padding:20px;text-align:center;color:var(--ink3);font-style:italic">No hay usuarios registrados.</div>';
    return;
  }

  list.innerHTML = allUserProfiles.map(u => {
    const isMe     = u.user_id === currentUser.id;
    const isActive = u.is_active !== false;
    const initials = (u.name || u.email || '?').slice(0, 2).toUpperCase();
    return `
    <div class="user-row${!isActive ? ' user-inactive' : ''}">
      <div class="user-avatar uav-${u.role}">${initials}</div>
      <div class="user-info">
        <div class="user-name">
          ${escH(u.name || '—')}
          ${isMe ? '<span class="user-you">tú</span>' : ''}
          ${!isActive ? '<span class="user-suspended">suspendido</span>' : ''}
        </div>
        <div class="user-email">${escH(u.email || '—')}</div>
      </div>
      <div class="user-role-cell">
        ${isMe
          ? `<span class="role-tag role-${u.role}">${ROLE_LABELS_FULL[u.role] || u.role}</span>`
          : `<select class="user-role-select" onchange="changeUserRole('${u.user_id}', this.value)">
               <option value="admin"     ${u.role === 'admin'     ? 'selected' : ''}>🔑 Administrador</option>
               <option value="comercial" ${u.role === 'comercial' ? 'selected' : ''}>💼 Comercial</option>
               <option value="viewer"    ${u.role === 'viewer'    ? 'selected' : ''}>👁️ Solo lectura</option>
             </select>`
        }
      </div>
      <div class="user-actions-cell">
        <button class="btn btn-ghost btn-sm pwd-btn"
          onclick="openPasswordModal('${u.user_id}','${escH(u.email||'')}')"
          title="${isMe ? 'Cambiar mi contraseña' : 'Enviar email de recuperación'}">
          🔑
        </button>
        ${!isActive
          ? `<button class="btn btn-primary btn-sm" onclick="activateUser('${u.user_id}')">✅ Activar</button>`
          : (!isMe ? `<button class="btn btn-ghost btn-sm user-btn-suspend" onclick="suspendUser('${u.user_id}','${escH(u.name || u.email || '')}')">🚫 Suspender</button>` : '')
        }
        ${!isMe
          ? `<button class="btn btn-danger btn-sm" style="padding:4px 10px" onclick="deleteUserProfile('${u.user_id}','${escH(u.name || u.email || '')}')">🗑</button>`
          : ''
        }
      </div>
    </div>`;
  }).join('');
}

// ── USER ACTIONS ──────────────────────────────────────────────
async function changeUserRole(userId, newRole) {
  try {
    const { error } = await db
      .from('user_profiles')
      .update({ role: newRole, updated_at: new Date().toISOString() })
      .eq('user_id', userId);
    if (error) throw error;
    const u = allUserProfiles.find(x => x.user_id === userId);
    const oldRole = u?.role;
    if (u) u.role = newRole;
    _renderUsersList();
    dbLogActivity('user_role_changed', 'user', userId, u?.email||'',
      { from: oldRole, to: newRole });
    toast(`✅ Rol cambiado a ${ROLE_LABELS_FULL[newRole]}`, 'ok');
  } catch (err) {
    toast('Error al cambiar rol: ' + err.message, 'er');
    await _loadAllUsers();
  }
}

async function activateUser(userId) {
  try {
    const { error } = await db
      .from('user_profiles')
      .update({ is_active: true, updated_at: new Date().toISOString() })
      .eq('user_id', userId);
    if (error) throw error;
    const u = allUserProfiles.find(x => x.user_id === userId);
    if (u) u.is_active = true;
    _renderUsersList();
    dbLogActivity('user_activated', 'user', userId, u?.email||'');
    toast('✅ Usuario activado', 'ok');
  } catch (err) {
    toast('Error: ' + err.message, 'er');
  }
}

async function suspendUser(userId, name) {
  if (!confirm(`¿Suspender el acceso de "${name}"?\nNo podrá iniciar sesión hasta que lo reactives.`)) return;
  try {
    const { error } = await db
      .from('user_profiles')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('user_id', userId);
    if (error) throw error;
    const u = allUserProfiles.find(x => x.user_id === userId);
    if (u) u.is_active = false;
    _renderUsersList();
    dbLogActivity('user_suspended', 'user', userId, u?.email||name);
    toast('🚫 Usuario suspendido', 'info');
  } catch (err) {
    toast('Error: ' + err.message, 'er');
  }
}

async function deleteUserProfile(userId, name) {
  if (!confirm(`¿Eliminar el acceso de "${name}"?\n\nEsto revoca su acceso al CRM pero NO elimina su cuenta de Supabase.`)) return;
  try {
    const { error } = await db.from('user_profiles').delete().eq('user_id', userId);
    if (error) throw error;
    dbLogActivity('user_profile_deleted', 'user', userId, name);
    allUserProfiles = allUserProfiles.filter(u => u.user_id !== userId);
    _renderUsersList();
    toast('🗑 Acceso eliminado', 'er');
  } catch (err) {
    toast('Error: ' + err.message, 'er');
  }
}

// ── CHANGE / RESET PASSWORD ───────────────────────────────────

function openPasswordModal(targetUserId, targetEmail) {
  try {
    const modal = document.getElementById('passwordModal');
    if (!modal) { toast('Error interno: modal no encontrado', 'er'); return; }

    // isMe = true when called with no args (sidebar button) OR when targetUserId matches current user
    const isMe = !targetUserId || (currentUser && targetUserId === currentUser.id);

    // Show/hide sections safely
    const _show = (id, visible) => { const el = document.getElementById(id); if (el) el.style.display = visible ? '' : 'none'; };
    const _val  = (id, v)       => { const el = document.getElementById(id); if (el) el.value = v; };

    _show('pwdError', false);
    _show('pwdNewWrap', isMe);
    _show('pwdConfirmWrap', isMe);
    _show('pwdEmailInfo', !isMe);
    _val('pwdNew', '');
    _val('pwdConfirm', '');

    if (!isMe) {
      const emailEl = document.getElementById('pwdEmailText');
      if (emailEl) emailEl.textContent = targetEmail || '';
    }

    modal.dataset.targetUser  = targetUserId  || '';
    modal.dataset.targetEmail = targetEmail   || '';
    modal.dataset.isMe        = isMe ? '1' : '0';
    modal.classList.add('open');

    if (isMe) setTimeout(() => { const el = document.getElementById('pwdNew'); if (el) el.focus(); }, 60);
  } catch (err) {
    console.error('openPasswordModal:', err);
    toast('Error al abrir el formulario: ' + err.message, 'er');
  }
}

function closePasswordModal() {
  document.getElementById('passwordModal').classList.remove('open');
}

async function doChangePassword() {
  const modal  = document.getElementById('passwordModal');
  const isMe   = modal.dataset.isMe === '1';
  const email  = modal.dataset.targetEmail;
  const errEl  = document.getElementById('pwdError');
  const btn    = document.getElementById('pwdBtn');

  errEl.style.display = 'none';

  if (isMe) {
    const np = document.getElementById('pwdNew').value;
    const cp = document.getElementById('pwdConfirm').value;
    if (!np || np.length < 6) {
      errEl.textContent = 'La contraseña debe tener al menos 6 caracteres.';
      errEl.style.display = ''; return;
    }
    if (np !== cp) {
      errEl.textContent = 'Las contraseñas no coinciden.';
      errEl.style.display = ''; return;
    }
    btn.textContent = 'Guardando…'; btn.disabled = true;
    try {
      const { error } = await db.auth.updateUser({ password: np });
      if (error) throw error;
      closePasswordModal();
      toast('✅ Contraseña actualizada', 'ok');
    } catch(err) {
      errEl.textContent = err.message; errEl.style.display = '';
    }
  } else {
    btn.textContent = 'Enviando…'; btn.disabled = true;
    try {
      const { error } = await db.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + window.location.pathname,
      });
      if (error) throw error;
      closePasswordModal();
      toast(`📧 Email de recuperación enviado a ${email}`, 'ok');
    } catch(err) {
      errEl.textContent = err.message; errEl.style.display = '';
    }
  }
  btn.textContent = 'Confirmar'; btn.disabled = false;
}

// ── LOGS VIEWER ───────────────────────────────────────────────
const LOG_META = {
  contact_created:      { label: 'Creó registro',             icon: '✅', cls: 'lm-create' },
  contact_updated:      { label: 'Editó registro',            icon: '✏️', cls: 'lm-update' },
  status_changed:       { label: 'Cambió estado',             icon: '🔄', cls: 'lm-status' },
  contact_deleted:      { label: 'Eliminó registro',          icon: '🗑️', cls: 'lm-delete' },
  contacts_deleted:     { label: 'Eliminación masiva',        icon: '🗑️', cls: 'lm-delete' },
  email_sent:           { label: 'Envió emails',              icon: '📤', cls: 'lm-email'  },
  contacts_imported:    { label: 'Importó contactos',         icon: '📥', cls: 'lm-import' },
  user_created:         { label: 'Creó usuario',              icon: '👤', cls: 'lm-admin'  },
  user_role_changed:    { label: 'Cambió rol',                icon: '🔑', cls: 'lm-admin'  },
  user_suspended:       { label: 'Suspendió usuario',         icon: '🚫', cls: 'lm-admin'  },
  user_activated:       { label: 'Activó usuario',            icon: '✅', cls: 'lm-admin'  },
  user_profile_deleted: { label: 'Eliminó acceso',            icon: '❌', cls: 'lm-admin'  },
  password_changed:     { label: 'Cambió contraseña',         icon: '🔑', cls: 'lm-admin'  },
  org_name_changed:     { label: 'Cambió nombre de empresa',  icon: '🏢', cls: 'lm-admin'  },
};

let _logsOffset = 0;
let _logsUserFilter   = '';
let _logsActionFilter = '';
let _logsData = [];

async function loadLogsTab(reset = true) {
  if (reset) { _logsOffset = 0; _logsData = []; }

  const wrap = document.getElementById('logsTableWrap');
  const more = document.getElementById('logsLoadMore');
  if (wrap) wrap.innerHTML = '<div style="padding:20px;text-align:center;color:var(--ink3);font-style:italic">Cargando…</div>';

  // Populate user filter dropdown
  _populateLogsUserFilter();

  try {
    _logsUserFilter   = document.getElementById('logsFilterUser')?.value   || '';
    _logsActionFilter = document.getElementById('logsFilterAction')?.value || '';

    const rows = await dbGetActivityLogs({
      limit:  50,
      offset: _logsOffset,
      userId: _logsUserFilter || null,
      action: _logsActionFilter || null,
    });

    if (reset) _logsData = rows;
    else        _logsData = [..._logsData, ...rows];

    _renderLogsTable();
    if (more) more.style.display = rows.length === 50 ? '' : 'none';
    _logsOffset += rows.length;
  } catch(err) {
    if (wrap) wrap.innerHTML = `<div style="padding:20px;color:var(--c-lost)">Error: ${escH(err.message)}</div>`;
  }
}

function _populateLogsUserFilter() {
  const sel = document.getElementById('logsFilterUser');
  if (!sel || sel.dataset.populated) return;
  sel.innerHTML = '<option value="">Todos los usuarios</option>'
    + allUserProfiles.map(u =>
        `<option value="${u.user_id}">${escH(u.name || u.email)}</option>`
      ).join('');
  sel.dataset.populated = '1';
}

function _renderLogsTable() {
  const wrap = document.getElementById('logsTableWrap');
  if (!wrap) return;
  if (!_logsData.length) {
    wrap.innerHTML = '<div style="padding:20px;text-align:center;color:var(--ink3);font-style:italic">Sin actividad registrada aún.</div>';
    return;
  }

  wrap.innerHTML = `
    <table class="logs-table">
      <thead><tr>
        <th>Fecha</th>
        <th>Usuario</th>
        <th>Acción</th>
        <th>Registro</th>
        <th>Detalles</th>
      </tr></thead>
      <tbody>${_logsData.map(_renderLogRow).join('')}</tbody>
    </table>`;
}

function _renderLogRow(log) {
  const meta = LOG_META[log.action] || { label: log.action, icon: '•', cls: '' };
  const date = log.created_at ? _fmtLogDate(log.created_at) : '—';
  const user = escH(log.user_email?.split('@')[0] || '—');
  const name = escH(log.entity_name || '—');
  const det  = _renderLogDetails(log);
  return `<tr>
    <td class="log-date">${date}</td>
    <td class="log-user" title="${escH(log.user_email||'')}">${user}</td>
    <td><span class="log-action-badge ${meta.cls}">${meta.icon} ${meta.label}</span></td>
    <td class="log-name">${name}</td>
    <td class="log-detail">${det}</td>
  </tr>`;
}

function _renderLogDetails(log) {
  const d = log.details;
  if (!d) return '';
  if (log.action === 'status_changed') {
    const from = _statusLabel(d.from, d.type);
    const to   = _statusLabel(d.to,   d.type);
    return `${from} → ${to}`;
  }
  if (log.action === 'email_sent')      return `${d.count || 0} destinatarios · ${escH(d.subject||'')}`.slice(0, 60);
  if (log.action === 'contacts_imported') return `+${d.added||0} nuevos, ${d.merged||0} actualizados`;
  if (log.action === 'contacts_deleted')  return `${d.count||0} registros`;
  if (log.action === 'user_role_changed') return `${d.from} → ${d.to}`;
  if (log.action === 'user_created')      return `Rol: ${d.role||''}`;
  if (log.action === 'org_name_changed')  return escH(d.name||'');
  return '';
}

function _statusLabel(s, type) {
  if (!s) return '—';
  const allLabels = {
    new:'Sin contactar', first_contact:'Primer contacto', no_response:'Sin respuesta',
    contact_obtained:'Datos obtenidos', info_sent:'Info enviada', demo_scheduled:'Demo agendada',
    demo_done:'Demo realizada', budget_sent:'Presupuesto enviado', followup:'Seguimiento',
    waiting_approval:'Esperando aprobación', won:'Ganado', rejected:'Rechazado',
    ok:'Sin incidencias', incident:'Incidencia', renewal:'Renovación', churned:'Baja', lost:'Inactivo',
  };
  return allLabels[s] || s;
}

function _fmtLogDate(iso) {
  const d = new Date(iso);
  const pad = n => String(n).padStart(2,'0');
  return `${pad(d.getDate())}/${pad(d.getMonth()+1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function loadMoreLogs() {
  await loadLogsTab(false);
}

// ── CONFIG TAB ────────────────────────────────────────────────
function _loadConfigTab() {
  const input = document.getElementById('orgNameInput');
  if (input) input.value = _currentOrgName;
  const errEl = document.getElementById('orgNameError');
  if (errEl) errEl.style.display = 'none';
  _renderStatusEditor('prospect');
  _renderStatusEditor('client');
  _renderFieldLabelsEditor('prospect');
  _renderFieldLabelsEditor('client');
  _renderCustomFieldEditor('prospect');
  _renderCustomFieldEditor('client');
}

// ── STATUS EDITOR ─────────────────────────────────────────────
function _renderStatusEditor(type) {
  const wrap = document.getElementById(`statusEditor-${type}`);
  if (!wrap) return;
  const statuses = type === 'prospect'
    ? orgConfig.prospect_statuses
    : orgConfig.client_statuses;
  const header = `<div class="cfg-status-hdr">
    <span>Emoji</span><span>Nombre visible</span><span>Clave interna</span><span></span>
  </div>`;
  const rows = statuses.map((s, i) => `
    <div class="cfg-status-row" data-i="${i}">
      <input class="cfg-status-emoji" type="text" value="${escH(s.emoji)}" maxlength="4"
        oninput="_statusFieldChange('${type}',${i},'emoji',this.value)" placeholder="🔔">
      <input class="cfg-status-label" type="text" value="${escH(s.label)}"
        oninput="_statusFieldChange('${type}',${i},'label',this.value)" placeholder="Ej: Primer contacto">
      <input class="cfg-status-value" type="text" value="${escH(s.value)}"
        oninput="_statusFieldChange('${type}',${i},'value',this.value)" placeholder="primer_contacto"
        title="${['won','rejected','lost','churned'].includes(s.value)?'Estado reservado del sistema':'Clave única sin espacios'}">
      <button class="cfg-btn-del" onclick="_deleteStatus('${type}',${i})" title="Eliminar">✕</button>
    </div>`).join('');
  wrap.innerHTML = header + rows +
    `<div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">
       <button class="cfg-btn-add" onclick="_addStatus('${type}')">+ Añadir estado</button>
       <button class="btn btn-primary btn-sm" onclick="_saveStatuses('${type}')">💾 Guardar estados</button>
     </div>`;
}

function _statusFieldChange(type, idx, field, val) {
  const list = type === 'prospect' ? orgConfig.prospect_statuses : orgConfig.client_statuses;
  if (list[idx]) list[idx][field] = val;
}

function _addStatus(type) {
  const list = type === 'prospect' ? orgConfig.prospect_statuses : orgConfig.client_statuses;
  list.push({ value: 'nuevo_estado_' + Date.now(), label: 'Nuevo estado', emoji: '🔵' });
  _renderStatusEditor(type);
}

function _deleteStatus(type, idx) {
  const list = type === 'prospect' ? orgConfig.prospect_statuses : orgConfig.client_statuses;
  const s = list[idx];
  if (['won','rejected','lost','churned'].includes(s?.value)) {
    toast('Este estado es reservado y no puede eliminarse.', 'er'); return;
  }
  if (!confirm(`¿Eliminar estado "${s?.label}"? Los contactos con ese estado mantendrán el valor en BD pero no se mostrará la etiqueta.`)) return;
  list.splice(idx, 1);
  _renderStatusEditor(type);
}

async function _saveStatuses(type) {
  const list = type === 'prospect' ? orgConfig.prospect_statuses : orgConfig.client_statuses;
  // Validate: all must have value and label
  if (list.some(s => !s.value.trim() || !s.label.trim())) {
    toast('Todos los estados deben tener clave y nombre.', 'er'); return;
  }
  // Ensure unique values
  const values = list.map(s => s.value.trim());
  if (new Set(values).size !== values.length) {
    toast('Las claves internas deben ser únicas.', 'er'); return;
  }
  try {
    const patch = type === 'prospect'
      ? { prospect_statuses: list }
      : { client_statuses: list };
    await dbSaveOrgConfig(patch);
    if (type === 'prospect') orgConfig.prospect_statuses = list;
    else                     orgConfig.client_statuses   = list;
    renderProspectFilterTabs();
    toast('✅ Estados guardados', 'ok');
  } catch(e) {
    toast('Error: ' + e.message, 'er');
  }
}

// ── FIELD LABELS EDITOR (system fields) ──────────────────────
const SYSTEM_FIELDS = {
  prospect: [
    { key: 'company',  default: 'Nombre del prospecto' },
    { key: 'contact',  default: 'Persona de contacto' },
    { key: 'role',     default: 'Cargo' },
    { key: 'phone',    default: 'Teléfono' },
    { key: 'country',  default: 'País' },
    { key: 'city',     default: 'Ciudad' },
    { key: 'program',  default: 'Programa / Solución' },
    { key: 'priority', default: 'Prioridad' },
    { key: 'notes',    default: 'Notas generales' },
  ],
  client: [
    { key: 'company',  default: 'Nombre del cliente' },
    { key: 'contact',  default: 'Persona de contacto' },
    { key: 'role',     default: 'Cargo' },
    { key: 'phone',    default: 'Teléfono' },
    { key: 'country',  default: 'País' },
    { key: 'city',     default: 'Ciudad' },
    { key: 'program',  default: 'Programa / Solución' },
    { key: 'version',  default: 'Versión instalada' },
    { key: 'notes',    default: 'Notas generales' },
  ],
};

function _renderFieldLabelsEditor(type) {
  const wrap = document.getElementById(`flEditor-${type}`);
  if (!wrap) return;
  const saved = orgConfig.field_labels?.[type] || {};
  const fields = SYSTEM_FIELDS[type] || [];
  wrap.innerHTML = `<div class="form-grid" style="margin-bottom:10px">` +
    fields.map(f => {
      const current = saved[f.key] || f.default;
      return `<div>
        <label style="font-size:.72rem;color:var(--ink3)">${escH(f.default)}</label>
        <input type="text" id="fl-${type}-${f.key}" value="${escH(current)}" placeholder="${escH(f.default)}">
      </div>`;
    }).join('') +
    `</div>
    <button class="btn btn-primary btn-sm" onclick="_saveFieldLabels('${type}')">💾 Guardar etiquetas</button>`;
}

async function _saveFieldLabels(type) {
  const fields = SYSTEM_FIELDS[type] || [];
  const labels = {};
  fields.forEach(f => {
    const el = document.getElementById(`fl-${type}-${f.key}`);
    if (el) labels[f.key] = el.value.trim() || f.default;
  });
  const updated = { ...orgConfig.field_labels, [type]: labels };
  try {
    await dbSaveOrgConfig({ field_labels: updated });
    orgConfig.field_labels = updated;
    toast('✅ Etiquetas guardadas', 'ok');
  } catch(e) {
    toast('Error: ' + e.message, 'er');
  }
}

// ── CUSTOM FIELD EDITOR ───────────────────────────────────────
let _cfEditId = null;

function _renderCustomFieldEditor(type) {
  const wrap = document.getElementById(`cfEditor-${type}`);
  if (!wrap) return;
  const defs = (orgConfig.custom_field_defs || []).filter(d => d.applies_to === type || d.applies_to === 'both');

  const typeLabel = { text:'Texto', number:'Número', date:'Fecha', select:'Selección', textarea:'Texto largo', checkbox:'Sí/No' };

  wrap.innerHTML = (defs.length ? defs.map(d => `
    <div class="cfg-cf-row">
      <span class="cfg-cf-label">${escH(d.label)}</span>
      <span class="cfg-cf-type">${typeLabel[d.field_type]||d.field_type}</span>
      <div class="cfg-cf-btns">
        <button class="cfg-btn-sm" onclick="_cfOpenForm('${type}','${d.id}')">✏️</button>
        <button class="cfg-btn-sm cfg-btn-del" onclick="_cfDelete('${d.id}','${type}')">✕</button>
      </div>
    </div>`).join('') : '<div class="cfg-empty">Sin campos adicionales</div>') +
    `<button class="cfg-btn-add" onclick="_cfOpenForm('${type}',null)">+ Añadir campo</button>`;

  // Form (hidden by default)
  const formId = `cfForm-${type}`;
  if (!document.getElementById(formId)) {
    const form = document.createElement('div');
    form.id = formId;
    form.style.display = 'none';
    form.className = 'cfg-cf-form';
    form.innerHTML = `
      <div class="form-grid">
        <div><label>Etiqueta <span class="req">*</span></label>
          <input type="text" id="cfF-label-${type}" placeholder="Nombre del campo"></div>
        <div><label>Tipo <span class="req">*</span></label>
          <select id="cfF-type-${type}" onchange="_cfTypeChange('${type}')">
            <option value="text">Texto</option>
            <option value="number">Número</option>
            <option value="date">Fecha</option>
            <option value="select">Selección</option>
            <option value="textarea">Texto largo</option>
            <option value="checkbox">Sí/No</option>
          </select></div>
        <div id="cfF-opts-wrap-${type}" class="fg-full" style="display:none">
          <label>Opciones (una por línea)</label>
          <textarea id="cfF-opts-${type}" rows="3" style="width:100%" placeholder="Opción 1&#10;Opción 2&#10;Opción 3"></textarea>
        </div>
      </div>
      <div style="display:flex;gap:8px;margin-top:10px">
        <button class="btn btn-primary btn-sm" onclick="_cfSave('${type}')">💾 Guardar campo</button>
        <button class="btn btn-sm" onclick="_cfCloseForm('${type}')">Cancelar</button>
      </div>`;
    wrap.appendChild(form);
  }
}

function _cfOpenForm(type, id) {
  _cfEditId = id;
  const form = document.getElementById(`cfForm-${type}`);
  if (!form) return;
  if (id) {
    const d = orgConfig.custom_field_defs.find(x => x.id === id);
    if (!d) return;
    document.getElementById(`cfF-label-${type}`).value = d.label;
    document.getElementById(`cfF-type-${type}`).value  = d.field_type;
    const optsWrap = document.getElementById(`cfF-opts-wrap-${type}`);
    const optsArea = document.getElementById(`cfF-opts-${type}`);
    if (d.field_type === 'select') {
      optsWrap.style.display = '';
      optsArea.value = (d.options || []).join('\n');
    } else {
      optsWrap.style.display = 'none';
    }
  } else {
    document.getElementById(`cfF-label-${type}`).value = '';
    document.getElementById(`cfF-type-${type}`).value  = 'text';
    document.getElementById(`cfF-opts-wrap-${type}`).style.display = 'none';
    document.getElementById(`cfF-opts-${type}`).value  = '';
  }
  form.style.display = '';
  document.getElementById(`cfF-label-${type}`).focus();
}

function _cfCloseForm(type) {
  const form = document.getElementById(`cfForm-${type}`);
  if (form) form.style.display = 'none';
  _cfEditId = null;
}

function _cfTypeChange(type) {
  const sel  = document.getElementById(`cfF-type-${type}`);
  const wrap = document.getElementById(`cfF-opts-wrap-${type}`);
  if (wrap) wrap.style.display = sel.value === 'select' ? '' : 'none';
}

async function _cfSave(type) {
  const label = document.getElementById(`cfF-label-${type}`)?.value.trim();
  const ftype = document.getElementById(`cfF-type-${type}`)?.value;
  if (!label) { toast('El nombre del campo es obligatorio.', 'er'); return; }

  const opts = ftype === 'select'
    ? (document.getElementById(`cfF-opts-${type}`)?.value || '').split('\n').map(s => s.trim()).filter(Boolean)
    : [];

  // field_key: generate from label if new
  const existing = _cfEditId ? orgConfig.custom_field_defs.find(x => x.id === _cfEditId) : null;
  const field_key = existing?.field_key || label.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_');
  const maxPos = orgConfig.custom_field_defs.length
    ? Math.max(...orgConfig.custom_field_defs.map(d => d.position || 0)) + 1 : 0;

  try {
    const saved = await dbSaveCustomFieldDef({
      id:         _cfEditId || undefined,
      applies_to: type,
      field_key,
      label,
      field_type: ftype,
      options:    opts,
      position:   existing?.position ?? maxPos,
      is_active:  true,
    });
    // Update local config
    orgConfig.custom_field_defs = orgConfig.custom_field_defs.filter(x => x.id !== saved.id);
    orgConfig.custom_field_defs.push(saved);
    orgConfig.custom_field_defs.sort((a, b) => (a.position || 0) - (b.position || 0));
    _cfCloseForm(type);
    _renderCustomFieldEditor(type);
    toast('✅ Campo guardado', 'ok');
  } catch(e) {
    toast('Error: ' + e.message, 'er');
  }
}

async function _cfDelete(id, type) {
  const d = orgConfig.custom_field_defs.find(x => x.id === id);
  if (!confirm(`¿Eliminar campo "${d?.label}"? Los datos existentes en contactos no se borran.`)) return;
  try {
    await dbDeleteCustomFieldDef(id);
    orgConfig.custom_field_defs = orgConfig.custom_field_defs.filter(x => x.id !== id);
    _renderCustomFieldEditor(type);
    toast('🗑 Campo eliminado', 'er');
  } catch(e) {
    toast('Error: ' + e.message, 'er');
  }
}

// ── INVITE / CREATE USER ──────────────────────────────────────
function openInviteUser() {
  const form = document.getElementById('inviteForm');
  form.style.display = '';
  ['inviteName', 'inviteEmail', 'invitePassword'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('inviteRole').value = 'comercial';
  document.getElementById('inviteError').style.display = 'none';
  document.getElementById('inviteEmail').focus();
}

function closeInviteUser() {
  document.getElementById('inviteForm').style.display = 'none';
}

async function doInviteUser() {
  const email    = document.getElementById('inviteEmail').value.trim();
  const name     = document.getElementById('inviteName').value.trim();
  const password = document.getElementById('invitePassword').value;
  const role     = document.getElementById('inviteRole').value;
  const errEl    = document.getElementById('inviteError');
  const btn      = document.getElementById('inviteBtn');

  errEl.style.display = 'none';

  if (!email || !password) {
    errEl.textContent = 'Email y contraseña son obligatorios.';
    errEl.style.display = '';
    return;
  }
  if (password.length < 6) {
    errEl.textContent = 'La contraseña debe tener al menos 6 caracteres.';
    errEl.style.display = '';
    return;
  }

  btn.textContent = 'Creando…';
  btn.disabled    = true;

  try {
    const adminId = currentUser.id;

    // signUp creates the Supabase auth user.
    // When "Confirm email" is ON in Supabase Auth settings, this does NOT change the
    // current session (returns session: null for the new user). If it's OFF, the admin
    // session will be replaced — we detect and warn below.
    const { data: authData, error: authError } = await db.auth.signUp({
      email,
      password,
      options: {
        data: { name },
        emailRedirectTo: window.location.origin + window.location.pathname,
      },
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error('Supabase no devolvió el usuario creado.');

    // Detect fake user response: Supabase returns identities=[] when the email
    // already exists in auth.users (prevents email enumeration).
    // In this case the returned user.id is fake and the FK insert will fail.
    if (!authData.user.identities || authData.user.identities.length === 0) {
      throw new Error(
        'Este email ya tiene cuenta en Supabase. ' +
        'Pídele que inicie sesión directamente — su perfil se creará automáticamente con rol Comercial. ' +
        'Después puedes cambiarle el rol desde este panel.'
      );
    }

    // Detect session replacement (email confirmation disabled)
    const { data: { user: nowUser } } = await db.auth.getUser();
    if (nowUser && nowUser.id !== adminId) {
      await db.auth.signOut();
      appInitialized = false;
      closeUsersPanel();
      toast('⚠️ Tu sesión fue reemplazada. Activa "Confirm email" en Supabase → Auth → Settings y vuelve a iniciar sesión.', 'er');
      setTimeout(() => location.reload(), 5000);
      return;
    }

    // Insert user profile
    const { error: profileError } = await db.from('user_profiles').insert({
      user_id:    authData.user.id,
      email,
      name:       name || email.split('@')[0],
      role,
      is_active:  true,
      invited_by: currentUser.id,
    });

    if (profileError) throw profileError;

    dbLogActivity('user_created', 'user', authData.user.id, email, { role });
    closeInviteUser();
    await _loadAllUsers();
    toast(`✅ Usuario ${email} creado como ${ROLE_LABELS_FULL[role]}`, 'ok');

  } catch (err) {
    errEl.textContent = err.message || 'Error al crear el usuario.';
    errEl.style.display = '';
  }

  btn.textContent = '+ Crear usuario';
  btn.disabled    = false;
}

// ── EMAIL ACCOUNTS (Panel de Control → tab Correos) ───────────

let _emailAccounts = [];
let _eaEditId      = null;

async function loadEmailTab() {
  if (!isAdmin()) return;
  const wrap = document.getElementById('ea-list');
  if (!wrap) return;
  wrap.innerHTML = '<div style="color:var(--ink3);font-size:.82rem;padding:12px 0">Cargando…</div>';
  try {
    const { data, error } = await db.from('email_accounts').select('*').order('created_at');
    if (error) throw error;
    _emailAccounts = data || [];
    _renderEmailAccounts();
  } catch (e) {
    wrap.innerHTML = `<div style="color:var(--c-lost);font-size:.82rem;padding:12px 0">Error: ${escH(e.message)}</div>`;
  }
}

function _renderEmailAccounts() {
  const wrap = document.getElementById('ea-list');
  if (!wrap) return;
  if (!_emailAccounts.length) {
    wrap.innerHTML = '<div class="ea-empty">No hay cuentas configuradas. Añade la primera abajo.</div>';
    return;
  }
  const fmt = iso => iso
    ? new Date(iso).toLocaleString('es-ES', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })
    : '—';
  wrap.innerHTML = _emailAccounts.map((a, i) => `
    <div class="ea-row${!a.is_active ? ' ea-inactive' : ''}">
      <div class="ea-dot">${a.is_active ? '🟢' : '⚪'}</div>
      <div class="ea-info">
        <div class="ea-name">${escH(a.display_name)} <span class="ea-badge">${escH(a.email)}</span></div>
        <div class="ea-meta">${escH(a.imap_host)}:${a.imap_port || 993} · ${fmt(a.last_check_at)}${a.last_error ? ' · <span class="ea-err">⚠ ' + escH(a.last_error.slice(0, 55)) + '</span>' : ''}</div>
      </div>
      <div class="ea-btns">
        <button class="btn btn-ghost btn-sm" onclick="_eaEdit(${i})" title="Editar">✏️</button>
        <button class="btn btn-ghost btn-sm" onclick="eaToggle('${a.id}',${!a.is_active})" title="${a.is_active ? 'Desactivar' : 'Activar'}">${a.is_active ? '⏸' : '▶️'}</button>
        <button class="btn btn-danger btn-sm" onclick="eaDelete('${a.id}')" title="Eliminar">🗑</button>
      </div>
    </div>`).join('');
}

function eaShowForm(editIdx) {
  editIdx = (editIdx === undefined || editIdx === null) ? -1 : editIdx;
  _eaEditId = editIdx >= 0 ? (_emailAccounts[editIdx]?.id || null) : null;

  const form  = document.getElementById('ea-form');
  const title = document.getElementById('ea-form-title');
  const passEl = document.getElementById('ea-f-pass');
  if (!form) return;

  if (editIdx >= 0 && _emailAccounts[editIdx]) {
    const a = _emailAccounts[editIdx];
    document.getElementById('ea-f-name').value  = a.display_name || '';
    document.getElementById('ea-f-email').value = a.email        || '';
    document.getElementById('ea-f-host').value  = a.imap_host    || '';
    document.getElementById('ea-f-port').value  = a.imap_port    || 993;
    passEl.value       = '';
    passEl.placeholder = '(sin cambios — déjalo vacío para mantener la actual)';
    title.textContent  = '✏️ Editar cuenta de correo';
  } else {
    ['ea-f-name','ea-f-email','ea-f-host','ea-f-pass'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    document.getElementById('ea-f-port').value = '993';
    passEl.placeholder = '••••••••';
    title.textContent  = '➕ Añadir cuenta de correo';
  }

  document.getElementById('ea-form-err').style.display = 'none';
  form.style.display = '';
  document.getElementById('ea-f-name').focus();
}

function _eaEdit(idx) { eaShowForm(idx); }

function eaHideForm() {
  const form = document.getElementById('ea-form');
  if (form) form.style.display = 'none';
  _eaEditId = null;
}

function eaAutoFillHost(input) {
  const hostEl = document.getElementById('ea-f-host');
  if (!hostEl || hostEl.value) return; // don't override if user already typed
  const domain = (input.value.toLowerCase().split('@')[1] || '').trim();
  if (!domain) return;
  if (domain === 'gmail.com')                                                  hostEl.value = 'imap.gmail.com';
  else if (['outlook.com','hotmail.com','live.com'].includes(domain))          hostEl.value = 'outlook.office365.com';
  else if (domain === 'yahoo.com' || domain === 'yahoo.es')                    hostEl.value = 'imap.mail.yahoo.com';
  else                                                                         hostEl.value = 'imap.hostinger.com';
}

async function eaSave() {
  const name  = document.getElementById('ea-f-name').value.trim();
  const email = document.getElementById('ea-f-email').value.trim();
  const host  = document.getElementById('ea-f-host').value.trim();
  const port  = parseInt(document.getElementById('ea-f-port').value, 10) || 993;
  const pass  = document.getElementById('ea-f-pass').value;
  const errEl = document.getElementById('ea-form-err');
  const btn   = document.getElementById('ea-save-btn');

  errEl.style.display = 'none';

  if (!name || !email || !host) {
    errEl.textContent = 'Nombre, email y servidor IMAP son obligatorios.';
    errEl.style.display = ''; return;
  }
  if (!_eaEditId && !pass) {
    errEl.textContent = 'La contraseña es obligatoria para añadir una cuenta.';
    errEl.style.display = ''; return;
  }

  btn.textContent = 'Guardando…'; btn.disabled = true;

  try {
    const fields = { display_name: name, email, imap_host: host, imap_port: port };
    if (pass) fields.password = pass;

    if (_eaEditId) {
      const { error } = await db.from('email_accounts').update(fields).eq('id', _eaEditId);
      if (error) throw error;
    } else {
      const { error } = await db.from('email_accounts').insert({ ...fields, is_active: true });
      if (error) throw error;
    }

    eaHideForm();
    await loadEmailTab();
    toast(`✅ Cuenta ${_eaEditId ? 'actualizada' : 'añadida'}: ${email}`, 'ok');
  } catch (e) {
    errEl.textContent = e.message;
    errEl.style.display = '';
  }

  btn.textContent = '💾 Guardar'; btn.disabled = false;
}

async function eaToggle(id, active) {
  try {
    const { error } = await db.from('email_accounts').update({ is_active: active }).eq('id', id);
    if (error) throw error;
    await loadEmailTab();
    toast(active ? '✅ Cuenta activada' : '⏸ Cuenta desactivada', 'ok');
  } catch (e) {
    toast('Error: ' + e.message, 'er');
  }
}

async function eaDelete(id) {
  const acc = _emailAccounts.find(a => a.id === id);
  if (!confirm(`¿Eliminar la cuenta "${acc?.email || id}"?\nEl historial de respuestas ya capturado se conservará.`)) return;
  try {
    const { error } = await db.from('email_accounts').delete().eq('id', id);
    if (error) throw error;
    await loadEmailTab();
    toast('Cuenta de correo eliminada', 'ok');
  } catch (e) {
    toast('Error: ' + e.message, 'er');
  }
}
