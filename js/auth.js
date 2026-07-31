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
      return JSON.parse(sessionStorage.getItem(this.SESSION_KEY));
    } catch { return null; }
  },

  setSession(session) {
    sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
  },

  clearSession() {
    sessionStorage.removeItem(this.SESSION_KEY);
  },

  isLoggedIn() {
    return this.getSession() !== null;
  },

  isAdmin() {
    const s = this.getSession();
    return s && s.type === 'admin';
  },

  isProfessor() {
    const s = this.getSession();
    return s && s.type === 'professor';
  },

  getCurrentProfessorId() {
    const s = this.getSession();
    return (s && s.type === 'professor') ? s.professorId : null;
  },

  /* ================================================================
     FLEXIBLE AUTHENTICATION
     Matches username (DPA / teacher name), email, or phone number
     ================================================================ */
  authenticate(userOrContact, pass) {
    const input = (userOrContact || '').trim().toLowerCase();
    const cleanInputPhone = input.replace(/\D/g, '');
    const password = (pass || '').trim();

    if (!input) return { success: false, reason: 'empty_user' };
    if (!password) return { success: false, reason: 'empty_pass' };

    const settings = Storage.getSettings();

    // 1. Check Admin Credentials
    const adminUsers  = [this.ADMIN_USER.toLowerCase(), 'admin', (settings.adminUser || '').toLowerCase()].filter(Boolean);
    const adminEmail  = (settings.adminEmail || '').toLowerCase();
    const adminPhone  = (settings.adminPhone || '').replace(/\D/g, '');
    const adminPass   = settings.adminPass || this.ADMIN_PASS;

    const isAdminUser  = adminUsers.includes(input);
    const isAdminEmail = adminEmail && input === adminEmail;
    const isAdminPhone = cleanInputPhone && adminPhone && cleanInputPhone === adminPhone;

    if ((isAdminUser || isAdminEmail || isAdminPhone) && password === adminPass) {
      this.setSession({ type: 'admin', professorId: null });
      return { success: true, type: 'admin' };
    }

    // 2. Check Teacher Credentials (matches username/name, email, or phone)
    const teachers = Storage.getTeachers();
    for (const t of teachers) {
      const tName     = (t.name || '').toLowerCase();
      const tLastName = (t.lastName || '').toLowerCase();
      const tFull     = Utils.fullName(t.name, t.lastName).toLowerCase();
      const tRev      = Utils.fullName(t.lastName, t.name).toLowerCase();
      const tEmail    = (t.email || '').toLowerCase();
      const tPhone    = (t.phone || '').replace(/\D/g, '');
      const tPass     = t.password || this.ADMIN_PASS;

      const isNameMatch  = input === tName || input === tLastName || input === tFull || input === tRev;
      const isEmailMatch = tEmail && input === tEmail;
      const isPhoneMatch = cleanInputPhone && tPhone && cleanInputPhone === tPhone;

      if ((isNameMatch || isEmailMatch || isPhoneMatch) && (password === tPass || password === this.ADMIN_PASS)) {
        this.setSession({ type: 'professor', professorId: t.id });
        Storage.setActiveTeacher(t.id);
        return { success: true, type: 'professor', professorId: t.id };
      }
    }

    return { success: false, reason: 'invalid_credentials' };
  },

  loginAdmin(user, pass) {
    const res = this.authenticate(user, pass);
    return res.success && res.type === 'admin';
  },

  loginProfessor(professorId, pass = null) {
    const t = Storage.getTeacher(professorId);
    if (!t) return false;
    if (pass) {
      const tPass = t.password || this.ADMIN_PASS;
      if (pass !== tPass && pass !== this.ADMIN_PASS) return false;
    }
    this.setSession({ type: 'professor', professorId });
    Storage.setActiveTeacher(professorId);
    return true;
  },

  logout() {
    this.clearSession();
  },

  /* ================================================================
     UI — INIT LOGIN SCREEN
     ================================================================ */
  initLoginScreen() {
    this._populateProfessors();
    this._initTabs();
    this._initButtons();
  },

  _populateProfessors() {
    const select   = document.getElementById('loginProfSelect');
    const noprofs  = document.getElementById('loginNoProfs');
    const teachers = Storage.getTeachers();

    select.innerHTML = '<option value="">— Seleccionar —</option>';

    if (teachers.length === 0) {
      select.style.display = 'none';
      noprofs.style.display = 'block';
    } else {
      select.style.display = 'block';
      noprofs.style.display = 'none';
      teachers.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.id;
        opt.textContent = Utils.fullName(t.name, t.lastName);
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
        document.getElementById(`panel${Utils.capitalize(tab)}`).classList.add('active');
        // Clear error
        document.getElementById('loginError').style.display = 'none';
      });
    });
  },

  _initButtons() {
    // Admin login button
    document.getElementById('btnLoginAdmin').addEventListener('click', () => this._handleAdminLogin());

    // Professor login button
    document.getElementById('btnLoginProf').addEventListener('click', () => this._handleProfLogin());

    // Enter key support
    document.getElementById('loginPass').addEventListener('keydown', e => {
      if (e.key === 'Enter') this._handleAdminLogin();
    });
    document.getElementById('loginUser').addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('loginPass').focus();
    });

    // Password toggle
    document.getElementById('togglePass').addEventListener('click', () => {
      const input = document.getElementById('loginPass');
      const btn   = document.getElementById('togglePass');
      if (input.type === 'password') {
        input.type = 'text';
        btn.textContent = '🙈';
      } else {
        input.type = 'password';
        btn.textContent = '👁';
      }
    });

    // Logout button
    document.getElementById('btnLogout').addEventListener('click', () => this._handleLogout());
  },

  _handleAdminLogin() {
    const user = document.getElementById('loginUser').value;
    const pass = document.getElementById('loginPass').value;
    const err  = document.getElementById('loginError');

    const authRes = this.authenticate(user, pass);

    if (authRes.success) {
      err.style.display = 'none';
      this._enterApp(authRes.type, authRes.professorId || null);
    } else {
      err.style.display = 'block';
      err.textContent = authRes.reason === 'empty_user' ? '⚠️ Ingrese su usuario, correo o teléfono'
                      : authRes.reason === 'empty_pass' ? '⚠️ Ingrese su contraseña'
                      : '⚠️ Credenciales incorrectas (usuario/email/teléfono o contraseña)';
      document.getElementById('loginPass').value = '';
      document.getElementById('loginPass').focus();
      // Shake animation
      const card = document.getElementById('loginCard');
      card.style.animation = 'none';
      card.offsetHeight; // reflow
      card.style.animation = 'shake 0.4s ease';
    }
  },

  _handleProfLogin() {
    const professorId = document.getElementById('loginProfSelect').value;
    if (!professorId) {
      App.showToast('Seleccioná un profesor para ingresar', 'error');
      return;
    }
    if (this.loginProfessor(professorId)) {
      this._enterApp('professor', professorId);
    }
  },

  _handleLogout() {
    App.confirm(
      '¿Cerrar sesión?',
      'Se cerrará la sesión actual. Los datos se conservan.',
      () => {
        this.logout();
        this._showLoginScreen();
      }
    );
  },

  /* ================================================================
     APP ENTER / EXIT
     ================================================================ */
  _enterApp(type, professorId) {
    // Hide login screen
    document.getElementById('loginScreen').classList.add('hidden');

    // Apply session body class
    document.body.classList.remove('session-admin', 'session-professor');
    document.body.classList.add(`session-${type}`);

    // Update session info in sidebar
    this._updateSidebarSession(type, professorId);

    // Set active teacher for data context
    if (type === 'professor' && professorId) {
      Storage.setActiveTeacher(professorId);
    }

    // Update active teacher bar and navigate
    App.updateActiveTeacherBar();
    App.navigate('calendar');
    App._checkFirstRun();
  },

  _showLoginScreen() {
    document.body.classList.remove('session-admin', 'session-professor');
    document.getElementById('loginScreen').classList.remove('hidden');
    // Re-populate professors in case new ones were added
    this._populateProfessors();
    // Reset form
    document.getElementById('loginUser').value = '';
    document.getElementById('loginPass').value = '';
    document.getElementById('loginError').style.display = 'none';
  },

  _updateSidebarSession(type, professorId) {
    const nameEl   = document.getElementById('sessionName');
    const roleEl   = document.getElementById('sessionRole');
    const avatarEl = document.getElementById('sessionAvatar');

    if (type === 'admin') {
      nameEl.textContent   = 'Administrador';
      roleEl.textContent   = '⭐ Admin';
      roleEl.className     = 'session-role admin';
      avatarEl.textContent = 'AD';
      avatarEl.style.background = 'rgba(245,158,11,0.15)';
      avatarEl.style.borderColor = 'rgba(245,158,11,0.4)';
      avatarEl.style.color = '#f59e0b';
    } else {
      const t = Storage.getTeacher(professorId);
      if (t) {
        nameEl.textContent   = Utils.fullName(t.name, t.lastName);
        roleEl.textContent   = 'Profesor';
        roleEl.className     = 'session-role';
        avatarEl.textContent = Utils.initials(t.name, t.lastName);
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
    if (this.isLoggedIn()) {
      // Restore existing session
      const session = this.getSession();
      this._enterApp(session.type, session.professorId);
    } else {
      // Show login screen
      this._showLoginScreen();
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
