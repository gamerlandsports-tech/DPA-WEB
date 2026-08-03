/* ============================================================
   DPA — storage.js — Motor de datos (LocalStorage)
   ============================================================ */

'use strict';

const Storage = {

  KEYS: {
    TEACHERS:  'dpa_teachers',
    STUDENTS:  'dpa_students',
    CLASSES:   'dpa_classes',
    SETTINGS:  'dpa_settings',
    ACTIVE_TEACHER: 'dpa_active_teacher',
    TOURNAMENTS: 'dpa_tournaments',
    ADVANCES:    'dpa_advances',
  },

  /* ---- Default Settings ---- */
  DEFAULT_SETTINGS: {
    profPercentage: 50,
    prices: {
      individual: 0,
      grupal: {
        '2': 0, '3': 0, '4': 0, '5': 0, '6': 0,
        '7': 0, '8': 0, '9': 0, '10': 0, '11': 0, '12': 0,
      },
      academia: 0,
    },
    timeStart: 6,
    timeEnd: 22,
    timeInterval: 30,
  },

  /* ---- Generic helpers ---- */
  _get(key) {
    try {
      return JSON.parse(localStorage.getItem(key));
    } catch {
      return null;
    }
  },
  _set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error('Storage error:', e);
    }
  },

  /* ================================================================
     SETTINGS (Supports per-teacher settings when in professor session)
     ================================================================ */
  getSettings() {
    let key = this.KEYS.SETTINGS;
    if (typeof Auth !== 'undefined' && Auth.isProfessor() && Auth.getCurrentProfessorId()) {
      key = `${this.KEYS.SETTINGS}_teacher_${Auth.getCurrentProfessorId()}`;
    }

    const saved = this._get(key) || this._get(this.KEYS.SETTINGS);
    // Deep merge with defaults
    const settings = { ...this.DEFAULT_SETTINGS };
    if (saved) {
      settings.profPercentage = saved.profPercentage ?? settings.profPercentage;
      settings.timeStart      = saved.timeStart      ?? settings.timeStart;
      settings.timeEnd        = saved.timeEnd        ?? settings.timeEnd;
      settings.timeInterval   = saved.timeInterval   ?? settings.timeInterval;
      if (saved.prices) {
        settings.prices.individual = saved.prices.individual ?? 0;
        settings.prices.academia   = saved.prices.academia   ?? 0;
        if (saved.prices.grupal) {
          settings.prices.grupal = { ...settings.prices.grupal, ...saved.prices.grupal };
        }
      }
    }
    return settings;
  },

  saveSettings(settings) {
    let key = this.KEYS.SETTINGS;
    if (typeof Auth !== 'undefined' && Auth.isProfessor() && Auth.getCurrentProfessorId()) {
      key = `${this.KEYS.SETTINGS}_teacher_${Auth.getCurrentProfessorId()}`;
    }
    this._set(key, settings);
    if (typeof CloudSync !== 'undefined') CloudSync.pushSettings(settings);
  },

  /* ================================================================
     ACTIVE TEACHER
     ================================================================ */
  getActiveTeacher() {
    const active = this._get(this.KEYS.ACTIVE_TEACHER);
    if (active) return active;
    const teachers = this.getAllTeachersRaw();
    if (teachers.length > 0) {
      this.setActiveTeacher(teachers[0].id);
      return teachers[0].id;
    }
    return null;
  },

  getActiveTeacherId() {
    if (typeof Auth !== 'undefined' && Auth.isProfessor()) {
      const profId = Auth.getCurrentProfessorId();
      if (profId) return profId;
    }
    return this.getActiveTeacher();
  },

  setActiveTeacher(teacherId) {
    this._set(this.KEYS.ACTIVE_TEACHER, teacherId);
  },

  /* ================================================================
     TEACHERS
     ================================================================ */
  getAllTeachersRaw() {
    return this._get(this.KEYS.TEACHERS) || [];
  },

  getTeachers() {
    const raw = this.getAllTeachersRaw();
    if (typeof Auth !== 'undefined' && Auth.isProfessor()) {
      const profId = Auth.getCurrentProfessorId();
      if (profId) {
        return raw.filter(t => t.id === profId);
      }
    }
    return raw;
  },

  saveTeachers(teachers) {
    this._set(this.KEYS.TEACHERS, teachers);
  },

  addTeacher(data) {
    const teachers = this.getAllTeachersRaw();
    const teacher = {
      id: Utils.generateId(),
      name: data.name || '',
      lastName: data.lastName || '',
      phone: data.phone || '',
      email: data.email || '',
      percentage: Number(data.percentage) || 50,
      password: data.password || '',
      createdAt: new Date().toISOString(),
    };
    teachers.push(teacher);
    this.saveTeachers(teachers);
    if (typeof CloudSync !== 'undefined') CloudSync.push('TEACHERS', teacher.id, teacher);
    return teacher;
  },

  updateTeacher(id, data) {
    const teachers = this.getAllTeachersRaw();
    const idx = teachers.findIndex(t => t.id === id);
    if (idx === -1) return null;
    teachers[idx] = { ...teachers[idx], ...data, id };
    this.saveTeachers(teachers);
    if (typeof CloudSync !== 'undefined') CloudSync.push('TEACHERS', id, teachers[idx]);
    return teachers[idx];
  },

  deleteTeacher(id) {
    const teachers = this.getAllTeachersRaw().filter(t => t.id !== id);
    this.saveTeachers(teachers);
    if (typeof CloudSync !== 'undefined') CloudSync.delete('TEACHERS', id);
    // If active teacher was deleted, clear active
    if (this.getActiveTeacher() === id) {
      this.setActiveTeacher(null);
    }
  },

  getTeacher(id) {
    return this.getAllTeachersRaw().find(t => t.id === id) || null;
  },

  /* ================================================================
     STUDENTS
     ================================================================ */
  getStudents() {
    return this._get(this.KEYS.STUDENTS) || [];
  },

  saveStudents(students) {
    this._set(this.KEYS.STUDENTS, students);
  },

  addStudent(data) {
    const students = this.getStudents();
    const student = {
      id: Utils.generateId(),
      name: data.name || '',
      lastName: data.lastName || '',
      phone: data.phone || '',
      email: data.email || '',
      notes: data.notes || '',
      gender: data.gender || '',
      packageTotal: Number(data.packageTotal) || 0,
      packagePrice: Number(data.packagePrice) || 0,
      packageUsed:  Number(data.packageUsed)  || 0,
      createdAt: new Date().toISOString(),
    };
    students.push(student);
    this.saveStudents(students);
    if (typeof CloudSync !== 'undefined') CloudSync.push('STUDENTS', student.id, student);
    return student;
  },

  updateStudent(id, data) {
    const students = this.getStudents();
    const idx = students.findIndex(s => s.id === id);
    if (idx === -1) return null;
    students[idx] = { ...students[idx], ...data, id };
    this.saveStudents(students);
    if (typeof CloudSync !== 'undefined') CloudSync.push('STUDENTS', id, students[idx]);
    return students[idx];
  },

  deleteStudent(id) {
    const students = this.getStudents().filter(s => s.id !== id);
    this.saveStudents(students);
    if (typeof CloudSync !== 'undefined') CloudSync.delete('STUDENTS', id);
  },

  getStudent(id) {
    return this.getStudents().find(s => s.id === id) || null;
  },

  /* ----------------------------------------------------------------
     PACKAGE HELPERS
     ---------------------------------------------------------------- */
  getStudentPackageStatus(studentId) {
    const s = this.getStudent(studentId);
    if (!s) return { total: 0, used: 0, remaining: 0, isActive: false, price: 0 };
    const total     = Number(s.packageTotal) || 0;
    const price     = Number(s.packagePrice) || 0;
    const used      = Number(s.packageUsed)  || 0;
    const remaining = Math.max(0, total - used);
    const isActive  = total > 0 && remaining > 0;
    return { total, used, remaining, isActive, price };
  },

  incrementPackageUsed(studentId) {
    const s = this.getStudent(studentId);
    if (!s) return;
    const total = Number(s.packageTotal) || 0;
    const used  = Number(s.packageUsed)  || 0;
    if (total > 0 && used < total) {
      this.updateStudent(studentId, { packageUsed: used + 1 });
    }
  },

  /**
   * Search students by query (name or lastName, case-insensitive)
   */
  searchStudents(query) {
    if (!query || !query.trim()) return this.getStudents();
    const q = query.toLowerCase().trim();
    return this.getStudents().filter(s => {
      const full = Utils.fullName(s.name, s.lastName).toLowerCase();
      const rev  = Utils.fullName(s.lastName, s.name).toLowerCase();
      return full.includes(q) || rev.includes(q);
    });
  },

  /* ================================================================
     CLASSES (Privacy scoped: Professors only see their own classes)
     ================================================================ */
  getAllClassesRaw() {
    return this._get(this.KEYS.CLASSES) || [];
  },

  getClasses() {
    const raw = this.getAllClassesRaw();
    const activeProfId = this.getActiveTeacherId();
    if (activeProfId) {
      return raw.filter(c => c.teacherId === activeProfId);
    }
    return [];
  },

  saveClasses(classes) {
    this._set(this.KEYS.CLASSES, classes);
  },

  /**
   * Get classes for a specific date string "yyyy-mm-dd"
   */
  getClassesByDate(dateStr) {
    return this.getClasses().filter(c => c.date === dateStr);
  },

  /**
   * Get classes for a specific month (year, month: 0-indexed)
   */
  getClassesByMonth(year, month) {
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
    return this.getClasses().filter(c => c.date && c.date.startsWith(prefix));
  },

  /**
   * Get the next auto-increment number for a given date
   */
  getNextDayNumber(dateStr) {
    const dayClasses = this.getClassesByDate(dateStr);
    if (dayClasses.length === 0) return 1;
    const maxNum = Math.max(...dayClasses.map(c => c.dayNumber || 0));
    return maxNum + 1;
  },

  addClass(data) {
    const raw = this.getAllClassesRaw();
    const activeProfId = data.teacherId || this.getActiveTeacherId();

    const cls = {
      id: Utils.generateId(),
      dayNumber: this.getNextDayNumber(data.date),
      date: data.date || Utils.toISO(new Date()),
      time: data.time || '',
      persons: Number(data.persons) || 1,
      studentIds: data.studentIds || [],
      tipo: data.tipo || '',
      value: Number(data.value) || 0,
      profCut: Number(data.profCut) || 0,
      clubCut: Number(data.clubCut) || 0,
      invoiceNumber: data.invoiceNumber || '',
      paymentMethod: data.paymentMethod || '',
      status: data.status || 'pending',
      teacherId: activeProfId || null,
      isManualPrice: !!data.isManualPrice,
      createdAt: new Date().toISOString(),
    };
    raw.push(cls);
    this.saveClasses(raw);
    if (typeof CloudSync !== 'undefined') CloudSync.push('CLASSES', cls.id, cls);
    return cls;
  },

  updateClass(id, data) {
    const raw = this.getAllClassesRaw();
    const idx = raw.findIndex(c => c.id === id);
    if (idx === -1) return null;
    const teacherId = data.teacherId || raw[idx].teacherId || this.getActiveTeacherId();
    raw[idx] = { ...raw[idx], ...data, teacherId, id };
    this.saveClasses(raw);
    if (typeof CloudSync !== 'undefined') CloudSync.push('CLASSES', id, raw[idx]);
    return raw[idx];
  },

  deleteClass(id) {
    const allClasses = this.getAllClassesRaw();
    const deletedClass = allClasses.find(c => c.id === id);
    const remaining = allClasses.filter(c => c.id !== id);
    this.saveClasses(remaining);
    if (typeof CloudSync !== 'undefined') CloudSync.delete('CLASSES', id);
    if (deletedClass) {
      this._renumberDay(deletedClass.date, remaining);
    }
  },

  /**
   * Re-number all classes for a given date after deletion
   */
  _renumberDay(dateStr, allClasses) {
    const activeTeacherId = this.getActiveTeacherId();
    const sorted = Utils.sortByTime(allClasses.filter(c => c.date === dateStr && c.teacherId === activeTeacherId));
    sorted.forEach((cls, idx) => {
      const found = allClasses.find(c => c.id === cls.id);
      if (found) {
        found.dayNumber = idx + 1;
        if (typeof CloudSync !== 'undefined') CloudSync.push('CLASSES', found.id, found);
      }
    });
    this.saveClasses(allClasses);
  },

  /**
   * Set class status
   */
  setClassStatus(id, status) {
    return this.updateClass(id, { status });
  },

  getClass(id) {
    return this.getClasses().find(c => c.id === id) || null;
  },

  /* ================================================================
     STUDENT STATISTICS
     ================================================================ */
  getStudentStats(studentId) {
    const allClasses = this.getClasses().filter(
      c => c.studentIds && c.studentIds.includes(studentId)
    );
    return {
      total: allClasses.length,
      individual: allClasses.filter(c => c.tipo === 'individual').length,
      grupal:     allClasses.filter(c => c.tipo === 'grupal').length,
      academia:   allClasses.filter(c => c.tipo === 'academia').length,
      completed:  allClasses.filter(c => c.status === 'completed').length,
      cancelled:  allClasses.filter(c => c.status === 'cancelled').length,
      pending:    allClasses.filter(c => !c.status || c.status === 'pending').length,
      classes:    Utils.sortByTime(allClasses).reverse(), // latest first
    };
  },

  /* ================================================================
     GENERAL STATS FOR A MONTH
     ================================================================ */
  getMonthStats(year, month) {
    const classes = this.getClassesByMonth(year, month);
    const completedClasses = classes.filter(c => c.status === 'completed');
    const total      = classes.length;
    const completed  = completedClasses.length;
    const cancelled  = classes.filter(c => c.status === 'cancelled').length;
    const pending    = classes.filter(c => !c.status || c.status === 'pending').length;
    const totalValue = completedClasses.reduce((s, c) => s + (c.value || 0), 0);
    const totalProf  = completedClasses.reduce((s, c) => s + (c.profCut || 0), 0);
    const totalClub  = completedClasses.reduce((s, c) => s + (c.clubCut || 0), 0);
    return { total, completed, cancelled, pending, totalValue, totalProf, totalClub, classes };
  },

  /* ================================================================
     TOURNAMENTS
     ================================================================ */
  getTournaments() {
    return this._get(this.KEYS.TOURNAMENTS) || [];
  },

  saveTournaments(tournaments) {
    this._set(this.KEYS.TOURNAMENTS, tournaments);
  },

  getTournament(id) {
    return this.getTournaments().find(t => String(t.id) === String(id)) || null;
  },

  addTournament(data) {
    const tournaments = this.getTournaments();
    const tournament = {
      id: data.id || Utils.generateId(),
      name: data.name || 'Nuevo Torneo',
      date: data.date || Utils.toISO(new Date()),
      modality: data.modality || 'americano-individual',
      category: data.category || '6ta',
      status: data.status || 'pending',
      zone4Mode: data.zone4Mode || 1,
      internalState: data.internalState || {},
      createdAt: new Date().toISOString(),
    };
    tournaments.push(tournament);
    this.saveTournaments(tournaments);
    if (typeof CloudSync !== 'undefined') CloudSync.push('TOURNAMENTS', tournament.id, tournament);
    return tournament;
  },

  updateTournament(id, data) {
    const tournaments = this.getTournaments();
    const idx = tournaments.findIndex(t => String(t.id) === String(id));
    if (idx === -1) return null;
    tournaments[idx] = { ...tournaments[idx], ...data, id: tournaments[idx].id };
    this.saveTournaments(tournaments);
    if (typeof CloudSync !== 'undefined') CloudSync.push('TOURNAMENTS', id, tournaments[idx]);
    return tournaments[idx];
  },

  deleteTournament(id) {
    const tournaments = this.getTournaments().filter(t => String(t.id) !== String(id));
    this.saveTournaments(tournaments);
    if (typeof CloudSync !== 'undefined') CloudSync.delete('TOURNAMENTS', id);
  },

  /* ================================================================
     ADVANCES (Adelantos del Club a Profesores)
     ================================================================ */
  getAdvances() {
    return this._get(this.KEYS.ADVANCES) || [];
  },

  saveAdvances(advances) {
    this._set(this.KEYS.ADVANCES, advances);
    if (typeof CloudSync !== 'undefined') CloudSync.pushAll();
  },

  addAdvance(data) {
    const advances = this.getAdvances();
    const newAdv = {
      id: Utils.generateId(),
      amount: Number(data.amount) || 0,
      date: data.date || Utils.toISO(new Date()),
      note: data.note || '',
      teacherId: data.teacherId || Storage.getActiveTeacherId(),
      createdAt: new Date().toISOString(),
    };
    advances.push(newAdv);
    this.saveAdvances(advances);
    return newAdv;
  },

  deleteAdvance(id) {
    let advances = this.getAdvances();
    advances = advances.filter(a => String(a.id) !== String(id));
    this.saveAdvances(advances);
  },
};

window.Storage = Storage;
