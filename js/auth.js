// ═══════════════════════════════════════════════════════════════
// AUTH.JS — Autenticación con Supabase
// Fix: no reinicializar la app en token_refreshed events
// ═══════════════════════════════════════════════════════════════

let currentUser = null;
let appInitialized = false;  // prevent duplicate init on token refresh

async function initAuth() {
  const { data: { session } } = await db.auth.getSession();
  if (session?.user) {
    currentUser = session.user;
    await showApp();
  } else {
    showLogin();
  }

  // Listen for auth changes — but only reinit on actual sign in/out
  db.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session?.user) {
      currentUser = session.user;
      // Only call showApp on first login, not on token refresh
      if (!appInitialized) {
        await showApp();
      } else {
        // Just update the current user silently
        currentUser = session.user;
      }
    } else if (event === 'SIGNED_OUT') {
      currentUser = null;
      appInitialized = false;
      showLogin();
    }
    // TOKEN_REFRESHED, USER_UPDATED etc → ignore, app stays as-is
  });
}

async function doLogin() {
  const email    = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errEl    = document.getElementById('loginError');
  const btn      = document.getElementById('loginBtn');

  if (!email || !password) {
    showLoginError('Introduce email y contraseña.');
    return;
  }

  btn.textContent = 'Entrando…';
  btn.disabled = true;
  errEl.style.display = 'none';

  const { data, error } = await db.auth.signInWithPassword({ email, password });

  btn.textContent = 'Entrar';
  btn.disabled = false;

  if (error) {
    showLoginError(error.message || 'Email o contraseña incorrectos.');
    return;
  }

  currentUser = data.user;
  appInitialized = false; // reset so showApp runs fully
  await showApp();
}

async function doLogout() {
  appInitialized = false;
  await db.auth.signOut();
  location.reload();
}

function showLoginError(msg) {
  const el = document.getElementById('loginError');
  el.textContent = msg;
  el.style.display = '';
}

function showLogin() {
  document.getElementById('loginScreen').style.display = '';
  document.getElementById('app').style.display = 'none';
}

async function showApp() {
  if (appInitialized) return; // guard against duplicate calls
  
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('app').style.display = '';

  const email = currentUser?.email || '';
  document.getElementById('sbUser').textContent = '👤 ' + email;

  await initApp();
  appInitialized = true;
}

document.getElementById('loginPassword')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') doLogin();
});
