/* ============================================================
   DPA — auth.js — Sistema de Autenticación y Sesiones
   ============================================================ */

'use strict';

const Auth = {

  /* ---- Credentials (admin) ---- */
  ADMIN_USER: 'DPA',
  ADMIN_PASS: 'lokititopata',

  /* ---- Session key (sessionStorage: expires on tab close) ---- */
  SESSION_KEY: 'dpa_session',

  /* ================================================================
     SESSION MANAGEMENT
     ================================================================ */
  getSession() {
    try {
      return JSON.parse(sessionStorage.getItem(Auth.SESSION_KEY));
    } catch { return null; }
  },

  setSession(session) {
    try {
      sessionStorage.setItem(Auth.SESSION_KEY, JSON.stringify(session));
    } catch (e) {
      console.error('Error saving session:', e);
    }
  },

  clearSession() {
    try {
      sessionStorage.removeItem(Auth.SESSION_KEY);
    } catch (e) {
      console.error('Error clearing session:', e);
    }
  },

  isLoggedIn() {
    return Auth.getSession() !== null;
  },

  isAdmin() {
    const s = Auth.getSession();
    return s && s.type === 'admin';
  },

  isProfessor() {
    const s = Auth.getSession();
    return s && s.type === 'professor';
  },

  getCurrentProfessorId() {
    const s = Auth.getSession();
    return (s && s.type === 'professor') ? s.professorId : null;
  },

  /* ================================================================
     FLEXIBLE AUTHENTICATION
     Matches username (DPA / teacher name), email, or phone number
     ================================================================ */
  authenticate(userOrContact, pass) {
    try {
      const input = (userOrContact || '').trim().toLowerCase();
      const cleanInputPhone = input.replace(/\D/g, '');
      const password = (pass || '').trim();

      if (!input) return { success: false, reason: 'empty_user' };
      if (!password) return { success: false, reason: 'empty_pass' };

      const settings = (typeof Storage !== 'undefined' && Storage.getSettings) ? Storage.getSettings() : {};

      // 1. Check Admin Credentials
      const adminUsers  = [Auth.ADMIN_USER.toLowerCase(), 'admin', (settings.adminUser || '').toLowerCase()].filter(Boolean);
      const adminEmail  = (settings.adminEmail || '').toLowerCase();
      const adminPhone  = (settings.adminPhone || '').replace(/\D/g, '');
      const adminPass   = settings.adminPass || Auth.ADMIN_PASS;

      const isAdminUser  = adminUsers.includes(input);
      const isAdminEmail = adminEmail && input === adminEmail;
      const isAdminPhone = cleanInputPhone && adminPhone && cleanInputPhone === adminPhone;

      const passLower = password.toLowerCase();
      const adminPassLower = adminPass.toLowerCase();

      if ((isAdminUser || isAdminEmail || isAdminPhone) && (password === adminPass || passLower === adminPassLower)) {
        Auth.setSession({ type: 'admin', professorId: null });
        return { success: true, type: 'admin' };
      }

      // 2. Check Teacher Credentials (matches username/name, email, or phone)
      const teachers = (typeof Storage !== 'undefined' && Storage.getTeachers) ? Storage.getTeachers() : [];
      for (const t of teachers) {
        const tName     = (t.name || '').toLowerCase();
        const tLastName = (t.lastName || '').toLowerCase();
        const tFull     = (typeof Utils !== 'undefined' && Utils.fullName) ? Utils.fullName(t.name, t.lastName).toLowerCase() : `${tName} ${tLastName}`;
        const tRev      = (typeof Utils !== 'undefined' && Utils.fullName) ? Utils.fullName(t.lastName, t.name).toLowerCase() : `${tLastName} ${tName}`;
        const tEmail    = (t.email || '').toLowerCase();
        const tPhone    = (t.phone || '').replace(/\D/g, '');
        const tPass     = t.password || Auth.ADMIN_PASS;

        const isNameMatch  = input === tName || input === tLastName || input === tFull || input === tRev;
        const isEmailMatch = tEmail && input === tEmail;
        const isPhoneMatch = cleanInputPhone && tPhone && cleanInputPhone === tPhone;

        if ((isNameMatch || isEmailMatch || isPhoneMatch) && (password === tPass || password === Auth.ADMIN_PASS || passLower === Auth.ADMIN_PASS.toLowerCase())) {
          Auth.setSession({ type: 'professor', professorId: t.id });
          if (typeof Storage !== 'undefined') Storage.setActiveTeacher(t.id);
          return { success: true, type: 'professor', professorId: t.id };
        }
      }

      return { success: false, reason: 'invalid_credentials' };
    } catch (e) {
      console.error('Error in Auth.authenticate:', e);
      return { success: false, reason: 'error', error: e };
    }
  },

  loginAdmin(user, pass) {
    const res = Auth.authenticate(user, pass);
    return res.success && res.type === 'admin';
  },

  loginProfessor(professorId, pass = null) {
    const t = (typeof Storage !== 'undefined') ? Storage.getTeacher(professorId) : null;
    if (!t) return false;
    if (pass) {
      const tPass = (t.password && t.password.trim()) ? t.password.trim() : Auth.ADMIN_PASS;
      const passTrim = pass.trim();
      if (passTrim !== tPass && passTrim !== Auth.ADMIN_PASS && passTrim.toLowerCase() !== Auth.ADMIN_PASS.toLowerCase()) {
        return false;
      }
    }
    Auth.setSession({ type: 'professor', professorId });
    if (typeof Storage !== 'undefined') Storage.setActiveTeacher(professorId);
    return true;
  },

  logout() {
    Auth.clearSession();
  },

  /* ================================================================
     UI — INIT LOGIN SCREEN
     ================================================================ */
  initLoginScreen() {
    Auth._populateProfessors();
    Auth._initTabs();
    Auth._initButtons();
  },

  _populateProfessors() {
    const select   = document.getElementById('loginProfSelect');
    const noprofs  = document.getElementById('loginNoProfs');
    if (!select || !noprofs) return;

    const teachers = (typeof Storage !== 'undefined' && Storage.getTeachers) ? Storage.getTeachers() : [];

    select.innerHTML = '<option value="">— Seleccionar Profesor —</option>';

    if (teachers.length === 0) {
      select.style.display = 'none';
      noprofs.style.display = 'block';
    } else {
      select.style.display = 'block';
      noprofs.style.display = 'none';
      teachers.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.id;
        opt.textContent = (typeof Utils !== 'undefined' && Utils.fullName) ? Utils.fullName(t.name, t.lastName) : `${t.name} ${t.lastName}`;
        select.appendChild(opt);
      });
    }
  },

  _initTabs() {
    document.querySelectorAll('.lmt-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        // Update active tab
        document.querySelectorAll('.lmt-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        // Show correct panel
        document.querySelectorAll('.login-panel').forEach(p => p.classList.remove('active'));
        const panel = document.getElementById(`panel${(typeof Utils !== 'undefined' && Utils.capitalize) ? Utils.capitalize(tab) : tab.charAt(0).toUpperCase() + tab.slice(1)}`);
        if (panel) panel.classList.add('active');
        // Clear errors
        const err = document.getElementById('loginError');
        const profErr = document.getElementById('loginProfError');
        if (err) err.style.display = 'none';
        if (profErr) profErr.style.display = 'none';
      });
    });
  },

  _initButtons() {
    const btnAdmin = document.getElementById('btnLoginAdmin');
    if (btnAdmin) {
      btnAdmin.onclick = (e) => {
        if (e) e.preventDefault();
        Auth._handleAdminLogin();
      };
    }

    const btnProf = document.getElementById('btnLoginProf');
    if (btnProf) {
      btnProf.onclick = (e) => {
        if (e) e.preventDefault();
        Auth._handleProfLogin();
      };
    }

    // Enter key support for admin pass
    const passInput = document.getElementById('loginPass');
    if (passInput) {
      passInput.onkeydown = (e) => {
        if (e.key === 'Enter') Auth._handleAdminLogin();
      };
    }

    // Enter key support for professor pass
    const profPassInput = document.getElementById('loginProfPass');
    if (profPassInput) {
      profPassInput.onkeydown = (e) => {
        if (e.key === 'Enter') Auth._handleProfLogin();
      };
    }

    const userInput = document.getElementById('loginUser');
    if (userInput) {
      userInput.onkeydown = (e) => {
        if (e.key === 'Enter') {
          const passEl = document.getElementById('loginPass');
          if (passEl) passEl.focus();
        }
      };
    }

    // Password toggle for admin panel
    const togglePass = document.getElementById('togglePass');
    if (togglePass) {
      togglePass.onclick = () => {
        const input = document.getElementById('loginPass');
        if (input) {
          if (input.type === 'password') {
            input.type = 'text';
            togglePass.textContent = '🙈';
          } else {
            input.type = 'password';
            togglePass.textContent = '👁';
          }
        }
      };
    }

    // Password toggle for professor panel
    const toggleProfPass = document.getElementById('toggleProfPass');
    if (toggleProfPass) {
      toggleProfPass.onclick = () => {
        const input = document.getElementById('loginProfPass');
        if (input) {
          if (input.type === 'password') {
            input.type = 'text';
            toggleProfPass.textContent = '🙈';
          } else {
            input.type = 'password';
            toggleProfPass.textContent = '👁';
          }
        }
      };
    }

    // Logout button
    const btnLogout = document.getElementById('btnLogout');
    if (btnLogout) {
      btnLogout.onclick = () => Auth._handleLogout();
    }
  },

  _handleAdminLogin() {
    try {
      const userEl = document.getElementById('loginUser');
      const passEl = document.getElementById('loginPass');
      const errEl  = document.getElementById('loginError');

      const user = userEl ? userEl.value : '';
      const pass = passEl ? passEl.value : '';

      const authRes = Auth.authenticate(user, pass);

      if (authRes.success) {
        if (errEl) errEl.style.display = 'none';
        Auth._enterApp(authRes.type, authRes.professorId || null);
      } else {
        if (errEl) {
          errEl.style.display = 'block';
          errEl.textContent = authRes.reason === 'empty_user' ? '⚠️ Ingrese su usuario, correo o teléfono'
                          : authRes.reason === 'empty_pass' ? '⚠️ Ingrese su contraseña'
                          : '⚠️ Credenciales incorrectas (usuario/email/teléfono o contraseña)';
        }
        if (passEl) {
          passEl.value = '';
          passEl.focus();
        }
        // Shake animation
        const card = document.getElementById('loginCard');
        if (card) {
          card.style.animation = 'none';
          card.offsetHeight; // reflow
          card.style.animation = 'shake 0.4s ease';
        }
      }
    } catch (e) {
      console.error('Error in _handleAdminLogin:', e);
      if (typeof App !== 'undefined' && App.showToast) {
        App.showToast('Error al iniciar sesión: ' + e.message, 'error');
      }
    }
  },

  _handleProfLogin() {
    try {
      const select = document.getElementById('loginProfSelect');
      const passEl = document.getElementById('loginProfPass');
      const errEl  = document.getElementById('loginProfError');

      const professorId = select ? select.value : '';
      const pass        = passEl ? passEl.value : '';

      if (errEl) errEl.style.display = 'none';

      if (!professorId) {
        if (errEl) {
          errEl.textContent = '⚠️ Seleccioná un profesor de la lista';
          errEl.style.display = 'block';
        }
        return;
      }

      if (!pass) {
        if (errEl) {
          errEl.textContent = '⚠️ Por favor ingresá tu contraseña de profesor';
          errEl.style.display = 'block';
        }
        if (passEl) passEl.focus();
        return;
      }

      if (Auth.loginProfessor(professorId, pass)) {
        if (errEl) errEl.style.display = 'none';
        if (passEl) passEl.value = '';
        Auth._enterApp('professor', professorId);
      } else {
        if (errEl) {
          errEl.textContent = '⚠️ Contraseña incorrecta para el profesor seleccionado';
          errEl.style.display = 'block';
        }
        if (passEl) {
          passEl.value = '';
          passEl.focus();
        }
        // Shake animation
        const card = document.getElementById('loginCard');
        if (card) {
          card.style.animation = 'none';
          card.offsetHeight; // reflow
          card.style.animation = 'shake 0.4s ease';
        }
      }
    } catch (e) {
      console.error('Error in _handleProfLogin:', e);
      if (typeof App !== 'undefined' && App.showToast) {
        App.showToast('Error al ingresar: ' + e.message, 'error');
      }
    }
  },

  _handleLogout() {
    Auth.logout();
    Auth._showLoginScreen();
    if (typeof App !== 'undefined' && App.showToast) {
      App.showToast('Sesión cerrada correctamente', 'info');
    }
  },

  /* ================================================================
     APP ENTER / EXIT
     ================================================================ */
  _enterApp(type, professorId) {
    // Hide login screen
    const loginScreen = document.getElementById('loginScreen');
    if (loginScreen) {
      loginScreen.classList.add('hidden');
      loginScreen.style.display = 'none';
    }

    // Apply session body class
    document.body.classList.remove('session-admin', 'session-professor');
    document.body.classList.add(`session-${type}`);

    // Update session info in sidebar
    Auth._updateSidebarSession(type, professorId);

    // Set active teacher for data context
    if (type === 'professor' && professorId) {
      if (typeof Storage !== 'undefined') Storage.setActiveTeacher(professorId);
    }

    // Update active teacher bar and navigate
    if (typeof App !== 'undefined') {
      App.updateActiveTeacherBar();
      App.navigate('calendar');
      if (App._checkFirstRun) App._checkFirstRun();
    }
  },

  _showLoginScreen() {
    document.body.classList.remove('session-admin', 'session-professor');
    const loginScreen = document.getElementById('loginScreen');
    if (loginScreen) {
      loginScreen.classList.remove('hidden');
      loginScreen.style.display = 'flex';
    }
    // Re-populate professors in case new ones were added
    Auth._populateProfessors();
    // Reset forms
    const userInput  = document.getElementById('loginUser');
    const passInput  = document.getElementById('loginPass');
    const profSelect = document.getElementById('loginProfSelect');
    const profPass   = document.getElementById('loginProfPass');
    const errEl      = document.getElementById('loginError');
    const profErrEl  = document.getElementById('loginProfError');

    if (userInput) userInput.value = '';
    if (passInput) passInput.value = '';
    if (profSelect) profSelect.value = '';
    if (profPass) profPass.value = '';
    if (errEl) errEl.style.display = 'none';
    if (profErrEl) profErrEl.style.display = 'none';
  },

  _updateSidebarSession(type, professorId) {
    const nameEl   = document.getElementById('sessionName');
    const roleEl   = document.getElementById('sessionRole');
    const avatarEl = document.getElementById('sessionAvatar');

    if (!nameEl || !roleEl || !avatarEl) return;

    if (type === 'admin') {
      nameEl.textContent   = 'Administrador';
      roleEl.textContent   = '⭐ Admin';
      roleEl.className     = 'session-role admin';
      avatarEl.textContent = 'AD';
      avatarEl.style.background = 'rgba(245,158,11,0.15)';
      avatarEl.style.borderColor = 'rgba(245,158,11,0.4)';
      avatarEl.style.color = '#f59e0b';
    } else {
      const t = (typeof Storage !== 'undefined') ? Storage.getTeacher(professorId) : null;
      if (t) {
        nameEl.textContent   = (typeof Utils !== 'undefined' && Utils.fullName) ? Utils.fullName(t.name, t.lastName) : `${t.name} ${t.lastName}`;
        roleEl.textContent   = 'Profesor';
        roleEl.className     = 'session-role';
        avatarEl.textContent = (typeof Utils !== 'undefined' && Utils.initials) ? Utils.initials(t.name, t.lastName) : 'PR';
        avatarEl.style.background = '';
        avatarEl.style.borderColor = '';
        avatarEl.style.color = '';
      }
    }
  },

  /* ================================================================
     BOOT — CHECK SESSION ON APP START
     ================================================================ */
  boot() {
    if (Auth.isLoggedIn()) {
      // Restore existing session
      const session = Auth.getSession();
      Auth._enterApp(session.type, session.professorId);
    } else {
      // Show login screen
      Auth._showLoginScreen();
    }
  },
};

/* ---- Shake animation for wrong password ---- */
const shakeStyle = document.createElement('style');
shakeStyle.textContent = `
  @keyframes shake {
    0%,100% { transform: translateX(0); }
    20%      { transform: translateX(-10px); }
    40%      { transform: translateX(10px); }
    60%      { transform: translateX(-6px); }
    80%      { transform: translateX(6px); }
  }
`;
document.head.appendChild(shakeStyle);

window.Auth = Auth;
