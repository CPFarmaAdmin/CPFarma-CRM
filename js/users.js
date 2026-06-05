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

// ── OPEN / CLOSE USERS PANEL ──────────────────────────────────
async function openUsersPanel() {
  if (!isAdmin()) { toast('Solo los administradores pueden gestionar usuarios.', 'er'); return; }
  document.getElementById('usersModal').classList.add('open');

  // Show entity name + current admin in modal header
  const orgEl = document.getElementById('usersModalOrg');
  if (orgEl) {
    const orgName = typeof ORG_NAME !== 'undefined' ? ORG_NAME : '';
    orgEl.innerHTML = orgName
      ? `🏢 <strong>${escH(orgName)}</strong> · <span style="color:var(--ink3)">Administrando como ${escH(currentUser?.email || '')}</span>`
      : '';
  }

  await _loadAllUsers();
}

function closeUsersPanel() {
  document.getElementById('usersModal').classList.remove('open');
  const f = document.getElementById('inviteForm');
  if (f) f.style.display = 'none';
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
    if (u) u.role = newRole;
    _renderUsersList();
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
