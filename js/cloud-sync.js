/* ============================================================
   DPA — cloud-sync.js
   Motor de sincronización Firebase Firestore
   Arquitectura Local-First:
     - Los datos se leen/escriben en localStorage (instantáneo)
     - Cada escritura se replica a Firestore en background
     - Al iniciar, se descarga todo desde Firestore
     - Listeners en tiempo real actualizan el caché local
   ============================================================ */

'use strict';

const CloudSync = {

  db: null,
  isConnected: false,
  isInitialized: false,
  _syncQueue: [],   // Pending writes if offline
  _listeners: [],   // Active Firestore listeners

  /* ---- Firestore collection paths ---- */
  COLLECTIONS: {
    TEACHERS: 'dpa/data/teachers',
    STUDENTS: 'dpa/data/students',
    CLASSES:  'dpa/data/classes',
    SETTINGS: 'dpa/data/settings',
  },

  /* ================================================================
     INIT — Connect to Firebase
     ================================================================ */
  getConfig() {
    let savedConfig = null;
    try {
      savedConfig = JSON.parse(localStorage.getItem('dpa_firebase_custom_config'));
    } catch(e) {}

    if (savedConfig && savedConfig.apiKey) return savedConfig;

    return (typeof window !== 'undefined' && window.FIREBASE_CONFIG)
      ? window.FIREBASE_CONFIG
      : ((typeof FIREBASE_CONFIG !== 'undefined') ? FIREBASE_CONFIG : null);
  },

  async init() {
    this._setStatus('syncing');

    // Check if Firebase SDK is loaded
    if (typeof firebase === 'undefined') {
      console.warn('CloudSync: Firebase SDK no encontrado. Usando solo localStorage.');
      this._setStatus('offline');
      this.isInitialized = false;
      this.isConnected = false;
      return false;
    }

    const config = this.getConfig();

    if (!config || !config.apiKey || config.apiKey === 'TU_API_KEY_AQUI') {
      console.warn('CloudSync: Credenciales de Firebase no configuradas. Usando solo localStorage.');
      this._setStatus('not-configured');
      this.isInitialized = false;
      this.isConnected = false;
      return false;
    }

    try {
      // Re-initialize if custom config changed
      if (firebase.apps && firebase.apps.length > 0) {
        // If app already exists, use it
        this.db = firebase.firestore();
      } else {
        firebase.initializeApp(config);
        this.db = firebase.firestore();
      }

      // Enable offline persistence safely
      try {
        await this.db.enablePersistence({ synchronizeTabs: true });
      } catch (err) {
        if (err && err.code === 'failed-precondition') {
          console.warn('CloudSync: Persistencia offline no disponible (múltiples pestañas).');
        } else if (err && err.code === 'unimplemented') {
          console.warn('CloudSync: Persistencia offline no soportada por este navegador.');
        } else {
          console.warn('CloudSync: Info sobre persistencia:', err);
        }
      }

      this.isInitialized = true;
      this.isConnected = true;
      this._setStatus('connected');
      console.log('CloudSync: Conectado a Firebase Firestore ✓');

      // Pull data and set listeners in background
      this.pullAll().then(() => {
        this._setupListeners();
      }).catch(err => {
        console.warn('CloudSync: Sync en segundo plano:', err);
      });

      return true;

    } catch (error) {
      console.error('CloudSync: Error al conectar con Firebase:', error);
      this._setStatus('error');
      this.isInitialized = false;
      this.isConnected = false;
      return false;
    }
  },

  /* ================================================================
     PULL — Download all data from Firestore to localStorage
     ================================================================ */
  async pullAll() {
    if (!this.db) return;

    try {
      const promises = [
        this._pullCollection('TEACHERS', Storage.KEYS.TEACHERS),
        this._pullCollection('STUDENTS', Storage.KEYS.STUDENTS),
        this._pullCollection('CLASSES',  Storage.KEYS.CLASSES),
        this._pullSettings(),
      ];
      await Promise.all(promises);
      console.log('CloudSync: Datos descargados de la nube ✓');

      // Refresh UI components with newly pulled data
      if (typeof Auth !== 'undefined') Auth._populateProfessors();
      this._triggerViewRefresh();
    } catch (error) {
      console.warn('CloudSync: Error al descargar datos:', error);
    }
  },

  async _pullCollection(collectionKey, localStorageKey) {
    try {
      const snapshot = await this.db.collection(this.COLLECTIONS[collectionKey]).get();
      if (!snapshot.empty) {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        localStorage.setItem(localStorageKey, JSON.stringify(data));
      }
    } catch (error) {
      console.warn(`CloudSync: Error al descargar ${collectionKey}:`, error);
    }
  },

  async _pullSettings() {
    try {
      const doc = await this.db.collection(this.COLLECTIONS.SETTINGS).doc('config').get();
      if (doc.exists) {
        localStorage.setItem(Storage.KEYS.SETTINGS, JSON.stringify(doc.data()));
      }
    } catch (error) {
      console.warn('CloudSync: Error al descargar settings:', error);
    }
  },

  /* ================================================================
     PUSH — Write a single document to Firestore
     ================================================================ */
  async push(collectionKey, id, data) {
    if (!this.db || !this.isInitialized) return;
    try {
      // Clean data (remove undefined values for Firestore)
      const cleanData = JSON.parse(JSON.stringify(data));
      await this.db
        .collection(this.COLLECTIONS[collectionKey])
        .doc(id)
        .set(cleanData, { merge: true });
    } catch (error) {
      console.warn(`CloudSync: Error al guardar en ${collectionKey}:`, error);
    }
  },

  /* ================================================================
     DELETE — Remove a document from Firestore
     ================================================================ */
  async delete(collectionKey, id) {
    if (!this.db || !this.isInitialized) return;
    try {
      await this.db
        .collection(this.COLLECTIONS[collectionKey])
        .doc(id)
        .delete();
    } catch (error) {
      console.warn(`CloudSync: Error al eliminar de ${collectionKey}:`, error);
    }
  },

  /* ================================================================
     PUSH SETTINGS — Save settings document
     ================================================================ */
  async pushSettings(data) {
    if (!this.db || !this.isInitialized) return;
    try {
      const cleanData = JSON.parse(JSON.stringify(data));
      await this.db
        .collection(this.COLLECTIONS.SETTINGS)
        .doc('config')
        .set(cleanData);
    } catch (error) {
      console.warn('CloudSync: Error al guardar configuración:', error);
    }
  },

  /* ================================================================
     REAL-TIME LISTENERS
     Refresh the local cache when Firestore data changes
     (useful when multiple devices use the app)
     ================================================================ */
  _setupListeners() {
    if (!this.db) return;

    // Listen to classes changes (most critical for multi-device use)
    const classesListener = this.db
      .collection(this.COLLECTIONS.CLASSES)
      .onSnapshot(snapshot => {
        const classes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        localStorage.setItem(Storage.KEYS.CLASSES, JSON.stringify(classes));
        // Soft refresh of current view
        this._triggerViewRefresh();
      }, err => console.warn('CloudSync: Error en listener de clases:', err));

    // Listen to teachers
    const teachersListener = this.db
      .collection(this.COLLECTIONS.TEACHERS)
      .onSnapshot(snapshot => {
        const teachers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        localStorage.setItem(Storage.KEYS.TEACHERS, JSON.stringify(teachers));
        if (typeof Auth !== 'undefined') Auth._populateProfessors();
        if (typeof Teachers !== 'undefined' && App._currentSection === 'teachers') Teachers.render();
      }, err => console.warn('CloudSync: Error en listener de profesores:', err));

    // Listen to students (for autocomplete updates)
    const studentsListener = this.db
      .collection(this.COLLECTIONS.STUDENTS)
      .onSnapshot(snapshot => {
        const students = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        localStorage.setItem(Storage.KEYS.STUDENTS, JSON.stringify(students));
      }, err => console.warn('CloudSync: Error en listener de alumnos:', err));

    this._listeners.push(classesListener, teachersListener, studentsListener);
  },

  _triggerViewRefresh() {
    // Only refresh if the calendar or classes view is active
    if (typeof App === 'undefined') return;
    if (App._currentSection === 'calendar' && typeof Calendar !== 'undefined') {
      Calendar.refresh();
    } else if (App._currentSection === 'classes' && typeof Classes !== 'undefined') {
      Classes.renderMonthTable(App._sectionClassesYear, App._sectionClassesMonth);
    }
  },

  /* ================================================================
     FULL SYNC — Push all localStorage data to Firestore
     (used when Firebase wasn't configured initially)
     ================================================================ */
  async pushAll() {
    if (!this.db || !this.isInitialized) return;
    this._setStatus('syncing');

    try {
      const teachers = Storage.getTeachers();
      const students = Storage.getStudents();
      const classes  = Storage.getClasses();
      const settings = Storage.getSettings();

      // Batch upload (max 500 per batch in Firestore)
      const batch = this.db.batch();

      teachers.forEach(t => {
        const ref = this.db.collection(this.COLLECTIONS.TEACHERS).doc(t.id);
        batch.set(ref, JSON.parse(JSON.stringify(t)));
      });
      students.forEach(s => {
        const ref = this.db.collection(this.COLLECTIONS.STUDENTS).doc(s.id);
        batch.set(ref, JSON.parse(JSON.stringify(s)));
      });
      classes.forEach(c => {
        const ref = this.db.collection(this.COLLECTIONS.CLASSES).doc(c.id);
        batch.set(ref, JSON.parse(JSON.stringify(c)));
      });

      await batch.commit();

      // Settings
      await this.pushSettings(settings);

      this._setStatus('connected');
      App.showToast('✅ Todos los datos sincronizados con Firebase', 'success');
      console.log('CloudSync: Sync completo ✓');

    } catch (error) {
      this._setStatus('error');
      console.error('CloudSync: Error en push completo:', error);
      App.showToast('Error al sincronizar con Firebase', 'error');
    }
  },

  /* ================================================================
     STATUS INDICATOR (in sidebar)
     ================================================================ */
  _setStatus(status) {
    const el = document.getElementById('cloudStatus');
    if (!el) return;

    const states = {
      'connected':      { dot: '🟢', text: 'Nube conectada',   cls: 'status-connected' },
      'syncing':        { dot: '🔄', text: 'Sincronizando...',  cls: 'status-syncing'   },
      'offline':        { dot: '🟡', text: 'Modo local',        cls: 'status-offline'   },
      'error':          { dot: '🔴', text: 'Error de conexión', cls: 'status-error'     },
      'not-configured': { dot: '⚪', text: 'Sin configurar',    cls: 'status-offline'   },
    };

    const s = states[status] || states['offline'];
    el.innerHTML = `<span class="cloud-dot">${s.dot}</span><span class="cloud-text">${s.text}</span>`;
    el.className = `cloud-status-bar ${s.cls}`;
  },

  /* ================================================================
     CLEANUP
     ================================================================ */
  destroy() {
    this._listeners.forEach(unsub => unsub && unsub());
    this._listeners = [];
  },
};

window.CloudSync = CloudSync;
