/* ============================================================
   DPA — app.js — Controlador principal de la aplicación
   ============================================================ */

'use strict';

const App = {

  _currentSection: 'calendar',
  _sectionClassesYear:  new Date().getFullYear(),
  _sectionClassesMonth: new Date().getMonth(),
  _confirmCallback: null,

  /* ================================================================
     INIT
     ================================================================ */
  init() {
    this._initNavigation();
    this._initSidebar();
    this._initConfirm();
    this._initSettings();
    this._initClassesSection();
    this._initChangePasswordModal();
    this._updateTopbarDate();

    // Init all modules
    Teachers.init();
    Students.init();
    Classes.init();
    Calendar.init();
    Stats.init();
    if (typeof Prices !== 'undefined') Prices.init();
    if (typeof Tournaments !== 'undefined') Tournaments.init();

    // Init CloudSync (Firebase)
    if (typeof CloudSync !== 'undefined') {
      CloudSync.init();
    }

    // Init auth (shows login screen or restores session)
    Auth.initLoginScreen();
    Auth.boot();
  },

  /* ================================================================
     NAVIGATION
     ================================================================ */
  _initNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', e => {
        e.preventDefault();
        const section = item.dataset.section;
        if (section) this.navigate(section);
        // Close sidebar on mobile
        this._closeSidebar();
      });
    });
  },

  navigate(section) {
    this._currentSection = section;

    // Guard admin-only sections for professor users
    const adminOnlySections = ['teachers'];
    if (adminOnlySections.includes(section) && Auth.isProfessor()) {
      this.showToast('Esta sección es solo para administradores', 'error');
      return;
    }
    // Update nav items
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.section === section);
    });

    // Show/hide sections
    document.querySelectorAll('.content-section').forEach(sec => {
      sec.classList.toggle('active', sec.id === `section-${section}`);
    });

    // Update page title
    const titles = {
      calendar: 'Calendario',
      classes:  'Registro de Clases',
      students: 'Alumnos',
      teachers: 'Profesores',
      stats:    'Estadísticas',
      settings: 'Configuración',
      prices:   'Precios',
      tournaments: 'Torneos',
    };
    const titleEl = document.getElementById('topbarTitle').querySelector('h1');
    if (titleEl) titleEl.textContent = titles[section] || section;

    // Section-specific actions on navigate
    if (section === 'calendar') Calendar.renderMonth();
    if (section === 'teachers') Teachers.render();
    if (section === 'students') Students.render();
    if (section === 'stats')    Stats.render(Stats._year, Stats._month);
    if (section === 'settings') this._loadSettings();
    if (section === 'prices' && typeof Prices !== 'undefined') Prices.render();
    if (section === 'tournaments' && typeof Tournaments !== 'undefined') Tournaments.render();
    if (section === 'classes') {
      Classes.renderMonthTable(this._sectionClassesYear, this._sectionClassesMonth);
    }
  },

  /* ================================================================
     SIDEBAR (mobile)
     ================================================================ */
  _initSidebar() {
    const menuBtn  = document.getElementById('menuBtn');
    const sidebar  = document.getElementById('sidebar');
    const overlay  = document.getElementById('sidebarOverlay');
    const toggleBtn = document.getElementById('sidebarToggle');

    menuBtn.addEventListener('click', () => this._openSidebar());
    toggleBtn.addEventListener('click', () => this._closeSidebar());
    overlay.addEventListener('click', () => this._closeSidebar());
  },

  _openSidebar() {
    document.getElementById('sidebar').classList.add('open');
    document.getElementById('sidebarOverlay').classList.add('open');
  },

  _closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('open');
  },

  /* ================================================================
     ACTIVE TEACHER BAR
     ================================================================ */
  updateActiveTeacherBar() {
    const select = document.getElementById('activeTeacherSelect');
    if (!select) return;
    const teachers = Storage.getTeachers();
    const activeId = Storage.getActiveTeacher();

    select.innerHTML = '';
    if (teachers.length === 0) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = '— Sin profesores —';
      select.appendChild(opt);
      return;
    }

    teachers.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = Utils.fullName(t.name, t.lastName);
      if (t.id === activeId) opt.selected = true;
      select.appendChild(opt);
    });

    if (!activeId && teachers.length > 0) {
      Storage.setActiveTeacher(teachers[0].id);
      select.value = teachers[0].id;
    }

    if (!select._hasChangeListener) {
      select._hasChangeListener = true;
      select.addEventListener('change', (e) => {
        const teacherId = e.target.value;
        if (teacherId) {
          Storage.setActiveTeacher(teacherId);
          App.showToast(`Profesor activo cambiado a ${e.target.options[e.target.selectedIndex].text}`, 'info');
          if (App._currentSection === 'calendar') Calendar.renderMonth();
          if (App._currentSection === 'classes') Classes.renderMonthTable(App._sectionClassesYear, App._sectionClassesMonth);
          if (App._currentSection === 'teachers') Teachers.render();
          if (App._currentSection === 'stats') Stats.render(Stats._year, Stats._month);
        }
      });
    }
  },

  /* ================================================================
     TOPBAR DATE
     ================================================================ */
  _updateTopbarDate() {
    const el = document.getElementById('currentDateDisplay');
    if (el) {
      const now = new Date();
      el.textContent = Utils.formatFull(now);
    }
  },

  /* ================================================================
     CONFIRM DIALOG
     ================================================================ */
  _initConfirm() {
    document.getElementById('confirmOk').addEventListener('click', () => {
      if (this._confirmCallback) this._confirmCallback();
      this._closeConfirm();
    });
    document.getElementById('confirmCancel').addEventListener('click', () => this._closeConfirm());
    document.getElementById('confirmOverlay').addEventListener('click', e => {
      if (e.target === e.currentTarget) this._closeConfirm();
    });
  },

  confirm(title, message, callback) {
    document.getElementById('confirmTitle').textContent   = title;
    document.getElementById('confirmMessage').textContent = message;
    this._confirmCallback = callback;
    document.getElementById('confirmOverlay').classList.add('open');
  },

  _closeConfirm() {
    document.getElementById('confirmOverlay').classList.remove('open');
    this._confirmCallback = null;
  },

  /* ================================================================
     TOAST NOTIFICATIONS
     ================================================================ */
  showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const icons = { success: '✅', error: '❌', info: 'ℹ️' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
      <span>${message}</span>
    `;
    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('toast-out');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  },

  /* ================================================================
     SETTINGS
     ================================================================ */
  _initSettings() {
    // Build grupal prices grid
    this._buildGrupalPrices();

    // Percentage preview
    document.getElementById('profPercentage').addEventListener('input', e => {
      const pct = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
      document.getElementById('pctProfBar').style.width = pct + '%';
      document.getElementById('pctClubBar').style.width = (100 - pct) + '%';
      document.getElementById('pctProfBar').textContent = `Profesor ${pct}%`;
      document.getElementById('pctClubBar').textContent = `Club ${100 - pct}%`;
    });

    // Save
    document.getElementById('saveSettingsBtn').addEventListener('click', () => this._saveSettings());

    // Cloud sync buttons
    const btnPush = document.getElementById('btnPushAllCloud');
    if (btnPush) {
      btnPush.addEventListener('click', async () => {
        if (typeof CloudSync !== 'undefined') {
          if (!CloudSync.isInitialized) {
            this.showToast('Conectando a Firebase Nube...', 'info');
            await CloudSync.init();
          }
          if (CloudSync.isInitialized) {
            CloudSync.pushAll();
          } else {
            this.showToast('⚠️ No se pudo conectar a Firestore. Verifique que la base de datos esté activa en Firebase Console.', 'error');
          }
        }
      });
    }

    const btnPull = document.getElementById('btnPullAllCloud');
    if (btnPull) {
      btnPull.addEventListener('click', async () => {
        if (typeof CloudSync !== 'undefined') {
          if (!CloudSync.isInitialized) {
            this.showToast('Conectando a Firebase Nube...', 'info');
            await CloudSync.init();
          }
          if (CloudSync.isInitialized) {
            this.showToast('Descargando datos de la nube...', 'info');
            await CloudSync.pullAll();
            this.showToast('✅ Datos recargados desde la nube', 'success');
            if (typeof Calendar !== 'undefined') Calendar.refresh();
          } else {
            this.showToast('⚠️ No se pudo conectar a Firestore. Verifique que la base de datos esté activa en Firebase Console.', 'error');
          }
        }
      });
    }

    // Init Firebase Config Editor handlers
    this._initFirebaseConfigEditor();

    // Change password button (Settings section)
    const btnPass = document.getElementById('btnUpdatePassword');
    if (btnPass) {
      btnPass.addEventListener('click', () => {
        const newPass = (document.getElementById('newPassInput').value || '').trim();
        const confirmPass = (document.getElementById('confirmPassInput').value || '').trim();

        if (!newPass) {
          this.showToast('Ingrese la nueva contraseña', 'error');
          return;
        }
        if (newPass !== confirmPass) {
          this.showToast('Las contraseñas no coinciden', 'error');
          return;
        }

        if (Auth.isAdmin()) {
          const settings = Storage.getSettings();
          settings.adminPass = newPass;
          Storage.saveSettings(settings);
          this.showToast('🔑 Contraseña de Administrador actualizada', 'success');
        } else if (Auth.isProfessor()) {
          const profId = Auth.getCurrentProfessorId();
          if (profId) {
            Storage.updateTeacher(profId, { password: newPass });
            this.showToast('🔑 Tu contraseña de Profesor fue actualizada', 'success');
          }
        }
        document.getElementById('newPassInput').value = '';
        document.getElementById('confirmPassInput').value = '';
      });
    }
  },

  /* ================================================================
     CHANGE PASSWORD MODAL
     ================================================================ */
  _initChangePasswordModal() {
    const btnSidebar  = document.getElementById('btnSidebarChangePass');
    const overlay     = document.getElementById('changePassOverlay');
    const btnClose    = document.getElementById('changePassClose');
    const btnCancel   = document.getElementById('changePassCancel');
    const btnSave     = document.getElementById('changePassSave');
    const newPassInput = document.getElementById('modalNewPass');
    const confPassInput = document.getElementById('modalConfirmPass');

    const openModal = () => {
      if (newPassInput) newPassInput.value = '';
      if (confPassInput) confPassInput.value = '';
      if (overlay) overlay.classList.add('open');
      if (newPassInput) newPassInput.focus();
    };

    const closeModal = () => {
      if (overlay) overlay.classList.remove('open');
    };

    if (btnSidebar) btnSidebar.addEventListener('click', openModal);
    if (btnClose) btnClose.addEventListener('click', closeModal);
    if (btnCancel) btnCancel.addEventListener('click', closeModal);

    if (overlay) {
      overlay.addEventListener('click', e => {
        if (e.target === overlay) closeModal();
      });
    }

    // Pass toggles inside modal
    const toggleNew = document.getElementById('toggleModalNewPass');
    if (toggleNew && newPassInput) {
      toggleNew.onclick = () => {
        if (newPassInput.type === 'password') {
          newPassInput.type = 'text';
          toggleNew.textContent = '🙈';
        } else {
          newPassInput.type = 'password';
          toggleNew.textContent = '👁';
        }
      };
    }

    const toggleConf = document.getElementById('toggleModalConfirmPass');
    if (toggleConf && confPassInput) {
      toggleConf.onclick = () => {
        if (confPassInput.type === 'password') {
          confPassInput.type = 'text';
          toggleConf.textContent = '🙈';
        } else {
          confPassInput.type = 'password';
          toggleConf.textContent = '👁';
        }
      };
    }

    if (btnSave) {
      btnSave.addEventListener('click', () => {
        const newPass = (newPassInput ? newPassInput.value : '').trim();
        const confirmPass = (confPassInput ? confPassInput.value : '').trim();

        if (!newPass) {
          this.showToast('Ingresá la nueva contraseña', 'error');
          return;
        }
        if (newPass !== confirmPass) {
          this.showToast('Las contraseñas no coinciden', 'error');
          return;
        }

        if (Auth.isAdmin()) {
          const settings = Storage.getSettings();
          settings.adminPass = newPass;
          Storage.saveSettings(settings);
          this.showToast('🔑 Contraseña de Administrador actualizada', 'success');
        } else if (Auth.isProfessor()) {
          const profId = Auth.getCurrentProfessorId();
          if (profId) {
            Storage.updateTeacher(profId, { password: newPass });
            this.showToast('🔑 Tu contraseña de Profesor fue actualizada', 'success');
          }
        }
        closeModal();
      });
    }
  },

  /* ================================================================
     FIREBASE CONFIG EDITOR (SETTINGS)
     ================================================================ */
  _initFirebaseConfigEditor() {
    const toggleBtn = document.getElementById('btnToggleFirebaseConfig');
    const editor    = document.getElementById('firebaseConfigEditor');
    const btnSave   = document.getElementById('btnSaveFirebaseConfig');
    const btnReset  = document.getElementById('btnResetFirebaseConfig');

    if (toggleBtn && editor) {
      toggleBtn.addEventListener('click', () => {
        const isHidden = editor.style.display === 'none';
        editor.style.display = isHidden ? 'block' : 'none';
        if (isHidden) {
          const cfg = (typeof CloudSync !== 'undefined') ? CloudSync.getConfig() : {};
          if (cfg) {
            if (document.getElementById('fbApiKey')) document.getElementById('fbApiKey').value = cfg.apiKey || '';
            if (document.getElementById('fbProjectId')) document.getElementById('fbProjectId').value = cfg.projectId || '';
            if (document.getElementById('fbAuthDomain')) document.getElementById('fbAuthDomain').value = cfg.authDomain || '';
            if (document.getElementById('fbAppId')) document.getElementById('fbAppId').value = cfg.appId || '';
          }
        }
      });
    }

    if (btnSave) {
      btnSave.addEventListener('click', async () => {
        const apiKey     = (document.getElementById('fbApiKey').value || '').trim();
        const projectId  = (document.getElementById('fbProjectId').value || '').trim();
        const authDomain = (document.getElementById('fbAuthDomain').value || '').trim();
        const appId      = (document.getElementById('fbAppId').value || '').trim();

        if (!apiKey || !projectId) {
          this.showToast('Ingrese al menos apiKey y projectId', 'error');
          return;
        }

        const customCfg = {
          apiKey,
          projectId,
          authDomain: authDomain || `${projectId}.firebaseapp.com`,
          storageBucket: `${projectId}.firebasestorage.app`,
          appId: appId || ''
        };

        localStorage.setItem('dpa_firebase_custom_config', JSON.stringify(customCfg));
        window.FIREBASE_CONFIG = customCfg;

        this.showToast('Guardando y probando conexión Firebase...', 'info');
        if (typeof CloudSync !== 'undefined') {
          const ok = await CloudSync.init();
          if (ok) {
            this.showToast('✅ Conectado exitosamente a Firebase', 'success');
            if (editor) editor.style.display = 'none';
          } else {
            this.showToast('⚠️ Claves guardadas pero no se pudo conectar. Verifique que la base de datos Firestore esté activa en Firebase Console.', 'error');
          }
        }
      });
    }

    if (btnReset) {
      btnReset.addEventListener('click', async () => {
        localStorage.removeItem('dpa_firebase_custom_config');
        this.showToast('Restaurando configuración predeterminada...', 'info');
        if (typeof CloudSync !== 'undefined') {
          await CloudSync.init();
        }
        if (editor) editor.style.display = 'none';
      });
    }
  },

  _buildGrupalPrices() {
    const container = document.getElementById('grupalPrices');
    container.innerHTML = '';
    const settings = Storage.getSettings();
    for (let i = 2; i <= 12; i++) {
      const row = document.createElement('div');
      row.className = 'grupal-price-row';
      const val = (settings.prices.grupal && settings.prices.grupal[String(i)]) || 0;
      row.innerHTML = `
        <label>${i} personas:</label>
        <div class="input-prefix" style="flex:1">
          <span class="prefix">$</span>
          <input type="number" id="grupalPrice${i}" min="0" value="${val}" style="flex:1; background:var(--bg-card); border:1px solid var(--border); border-radius:0 var(--radius-sm) var(--radius-sm) 0; color:var(--text-primary); padding:6px 10px; font-size:13px; outline:none; width:100%">
        </div>
      `;
      container.appendChild(row);
    }
  },

  _loadSettings() {
    const settings = Storage.getSettings();
    document.getElementById('priceIndividual').value = settings.prices.individual || 0;
    document.getElementById('priceAcademia').value   = settings.prices.academia   || 0;
    document.getElementById('profPercentage').value  = settings.profPercentage    || 50;
    document.getElementById('timeStart').value    = settings.timeStart    || 7;
    document.getElementById('timeEnd').value      = settings.timeEnd      || 22;
    document.getElementById('timeInterval').value = settings.timeInterval || 30;

    // Grupal prices
    this._buildGrupalPrices();

    // Update preview bar
    const pct = settings.profPercentage || 50;
    document.getElementById('pctProfBar').style.width = pct + '%';
    document.getElementById('pctClubBar').style.width = (100 - pct) + '%';
    document.getElementById('pctProfBar').textContent = `Profesor ${pct}%`;
    document.getElementById('pctClubBar').textContent = `Club ${100 - pct}%`;
  },

  _saveSettings() {
    const grupalPrices = {};
    for (let i = 2; i <= 12; i++) {
      const el = document.getElementById(`grupalPrice${i}`);
      grupalPrices[String(i)] = el ? (Number(el.value) || 0) : 0;
    }

    const settings = {
      profPercentage: parseFloat(document.getElementById('profPercentage').value) || 50,
      prices: {
        individual: Number(document.getElementById('priceIndividual').value) || 0,
        grupal: grupalPrices,
        academia: Number(document.getElementById('priceAcademia').value) || 0,
      },
      timeStart:    parseInt(document.getElementById('timeStart').value)    || 7,
      timeEnd:      parseInt(document.getElementById('timeEnd').value)      || 22,
      timeInterval: parseInt(document.getElementById('timeInterval').value) || 30,
    };

    Storage.saveSettings(settings);
    this.showToast('Configuración guardada', 'success');
  },

  /* ================================================================
     CLASSES SECTION (monthly view navigation)
     ================================================================ */
  _initClassesSection() {
    document.getElementById('classesMonthPrev').addEventListener('click', () => {
      if (this._sectionClassesMonth === 0) {
        this._sectionClassesMonth = 11;
        this._sectionClassesYear--;
      } else {
        this._sectionClassesMonth--;
      }
      document.getElementById('classesMonthLabel').textContent =
        Utils.formatMonth(this._sectionClassesYear, this._sectionClassesMonth);
      Classes.renderMonthTable(this._sectionClassesYear, this._sectionClassesMonth);
    });

    document.getElementById('classesMonthNext').addEventListener('click', () => {
      if (this._sectionClassesMonth === 11) {
        this._sectionClassesMonth = 0;
        this._sectionClassesYear++;
      } else {
        this._sectionClassesMonth++;
      }
      document.getElementById('classesMonthLabel').textContent =
        Utils.formatMonth(this._sectionClassesYear, this._sectionClassesMonth);
      Classes.renderMonthTable(this._sectionClassesYear, this._sectionClassesMonth);
    });

    document.getElementById('classesMonthLabel').textContent =
      Utils.formatMonth(this._sectionClassesYear, this._sectionClassesMonth);
  },

  /* ================================================================
     FIRST RUN CHECK
     ================================================================ */
  _checkFirstRun() {
    const teachers = Storage.getTeachers();
    const settings = Storage.getSettings();
    const priceSet = settings.prices.individual > 0 || settings.prices.academia > 0;

    if (Auth.isAdmin() && teachers.length === 0) {
      setTimeout(() => {
        this.showToast('👋 Bienvenido. Agregue el primer profesor en la sección Profesores', 'info');
      }, 600);
    } else if (Auth.isAdmin() && !priceSet) {
      setTimeout(() => {
        this.showToast('⚙️ Recuerde configurar los precios en Configuración', 'info');
      }, 800);
    }
  },
};

window.App = App;

/* ================================================================
   BOOT
   ================================================================ */
document.addEventListener('DOMContentLoaded', () => App.init());
