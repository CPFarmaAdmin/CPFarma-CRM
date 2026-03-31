// ═══════════════════════════════════════════════════════════════
// AUTH.JS — Autenticación con Supabase
// ═══════════════════════════════════════════════════════════════

let currentUser = null;

async function initAuth() {
  // Check existing session
  const { data: { session } } = await db.auth.getSession();
  if (session?.user) {
    currentUser = session.user;
    await showApp();
  } else {
    showLogin();
  }

  // Listen for auth changes
  db.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session?.user) {
      currentUser = session.user;
      await showApp();
    } else if (event === 'SIGNED_OUT') {
      currentUser = null;
      showLogin();
    }
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
    showLoginError('Email o contraseña incorrectos.');
    return;
  }

  currentUser = data.user;
  await showApp();
}

async function doLogout() {
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
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('app').style.display = '';

  // Show user email in sidebar
  const email = currentUser?.email || '';
  document.getElementById('sbUser').textContent = '👤 ' + email;

  // Init the app
  await initApp();
}

// Allow pressing Enter on password field
document.getElementById('loginPassword')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') doLogin();
});
