/* ============================================================
   DPA — classes.js — Módulo de Registro de Clases
   ============================================================ */

'use strict';

const Classes = {

  _selectedStudents: [], // Array of student objects selected for current form
  _editingId: null,
  _currentDate: null,    // Date string "yyyy-mm-dd" for daily view context

  /* ================================================================
     RENDER TABLE (for a specific date — daily view)
     ================================================================ */
  renderDayTable(dateStr) {
    this._currentDate = dateStr;
    const classes  = Utils.sortByTime(Storage.getClassesByDate(dateStr));
    const tbody    = document.getElementById('classesTableBody');
    const emptyDiv = document.getElementById('emptyClasses');
    const table    = document.getElementById('classesTable');

    tbody.innerHTML = '';

    if (classes.length === 0) {
      table.style.display = 'none';
      emptyDiv.classList.add('visible');
      this._updateDayTotals(dateStr);
      return;
    }

    table.style.display = 'table';
    emptyDiv.classList.remove('visible');

    classes.forEach((cls, idx) => {
      const row = this._buildRow(cls, idx + 1);
      tbody.appendChild(row);
    });

    this._updateDayTotals(dateStr);
  },

  /* ================================================================
     RENDER TABLE (for section — all classes for a month)
     ================================================================ */
  renderMonthTable(year, month) {
    const monthClasses = Utils.sortByTime(Storage.getClassesByMonth(year, month));
    // Sort by date then time
    monthClasses.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return 0;
    });

    const tbody    = document.getElementById('classesTableSectionBody');
    const emptyDiv = document.getElementById('emptyClassesSection');
    const table    = document.getElementById('classesTableSection');

    tbody.innerHTML = '';

    if (monthClasses.length === 0) {
      table.style.display = 'none';
      emptyDiv.classList.add('visible');
      this._updateMonthTotals(year, month);
      return;
    }

    table.style.display = 'table';
    emptyDiv.classList.remove('visible');

    // Group by date for day-numbering
    const byDate = {};
    monthClasses.forEach(cls => {
      if (!byDate[cls.date]) byDate[cls.date] = [];
      byDate[cls.date].push(cls);
    });

    monthClasses.forEach(cls => {
      const dayGroup   = Utils.sortByTime(byDate[cls.date] || []);
      const dayIdx     = dayGroup.findIndex(c => c.id === cls.id);
      const row = this._buildRow(cls, dayIdx + 1, true);
      tbody.appendChild(row);
    });

    this._updateMonthTotals(year, month);
  },

  /* ================================================================
     BUILD A TABLE ROW
     ================================================================ */
  _buildRow(cls, num, showDate = false) {
    const students = (cls.studentIds || [])
      .map(id => Storage.getStudent(id))
      .filter(Boolean);

    const tipoLabels = {
      individual: '<span class="tipo-badge tipo-individual">Individual</span>',
      grupal:     '<span class="tipo-badge tipo-grupal">Grupal</span>',
      academia:   '<span class="tipo-badge tipo-academia">Academia</span>',
    };

    const pagoLabels = {
      efectivo:      '💵 Efectivo',
      transferencia: '📲 Transferencia',
      tarjeta:       '💳 Tarjeta',
    };

    const studentsHtml = students.length === 0
      ? '<span style="color:var(--text-muted)">-</span>'
      : `<div class="students-list">
          ${students.slice(0, 3).map(s =>
            `<span class="student-name-pill">${Utils.fullName(s.name, s.lastName)}</span>`
          ).join('')}
          ${students.length > 3 ? `<span class="more-students">+${students.length - 3} más</span>` : ''}
        </div>`;

    let statusHtml = '';
    if (cls.status === 'completed') {
      statusHtml = `
        <span class="status-badge-completed">✓ Completada</span>
        <button class="btn-cancel-class" data-action="cancel-class" data-id="${cls.id}" title="Marcar como cancelada">✗ Cancelar</button>
      `;
    } else if (cls.status === 'cancelled') {
      statusHtml = `
        <span class="status-badge-cancelled">✗ Cancelada</span>
        <button class="btn-complete" data-action="complete-class" data-id="${cls.id}" title="Marcar como completada">✓ Completar</button>
      `;
    } else {
      statusHtml = `
        <button class="btn-complete" data-action="complete-class" data-id="${cls.id}">✓ Completada</button>
        <button class="btn-cancel-class" data-action="cancel-class" data-id="${cls.id}">✗ Cancelada</button>
      `;
    }

    let waBtn = '';
    const studentWithPhone = students.find(s => s.phone && s.phone.trim());
    if (studentWithPhone) {
      const cleanPhone = studentWithPhone.phone.replace(/[^0-9]/g, '');
      const msg = encodeURIComponent(`Hola ${studentWithPhone.name}! Recordatorio de DPA: Tenés clase hoy a las ${cls.time} hs. ¡Te esperamos!`);
      waBtn = `<a href="https://wa.me/${cleanPhone}?text=${msg}" target="_blank" rel="noopener" class="btn-whatsapp" title="Enviar recordatorio por WhatsApp">💬 WhatsApp</a>`;
    }

    const isUpcoming = typeof AlarmEngine !== 'undefined' && AlarmEngine.isUpcomingAlert(cls);

    const statusClass = [
      cls.status === 'completed' ? 'row-completed' : cls.status === 'cancelled' ? 'row-cancelled' : '',
      cls.isManualPrice ? 'row-manual-price' : '',
      isUpcoming ? 'row-upcoming-alert' : ''
    ].filter(Boolean).join(' ');

    const manualBadge = cls.isManualPrice
      ? `<span class="badge-manual-price" title="Precio modificado manualmente">✏️ Personalizado</span>`
      : '';

    const tr = document.createElement('tr');
    tr.className = statusClass;
    tr.dataset.id = cls.id;
    tr.innerHTML = `
      <td class="row-num">${num}</td>
      <td class="col-fecha">${showDate ? Utils.formatShort(cls.date) : Utils.formatShort(cls.date)}</td>
      <td class="cell-hora">${cls.time || '-'}</td>
      <td class="cell-personas">${cls.persons || 1}</td>
      <td>${studentsHtml}</td>
      <td>${tipoLabels[cls.tipo] || '<span style="color:var(--text-muted)">-</span>'}</td>
      <td class="cell-valor">${Utils.formatCurrency(cls.value)}${manualBadge}</td>
      <td class="cell-prof">${Utils.formatCurrency(cls.profCut)}</td>
      <td class="cell-club">${Utils.formatCurrency(cls.clubCut)}</td>
      <td class="cell-factura">${cls.invoiceNumber || '-'}</td>
      <td>${cls.paymentMethod ? `<span class="pago-badge">${pagoLabels[cls.paymentMethod] || cls.paymentMethod}</span>` : '-'}</td>
      <td><div class="estado-cell">${statusHtml} ${waBtn}</div></td>
      <td>
        <div class="action-btns">
          <button class="btn-edit-class" data-action="edit-class" data-id="${cls.id}" title="Editar">✏️</button>
          <button class="btn-delete-class" data-action="delete-class" data-id="${cls.id}" title="Eliminar">🗑</button>
        </div>
      </td>
    `;
    return tr;
  },

  /* ================================================================
     TOTALS — DAY
     ================================================================ */
  _updateDayTotals(dateStr) {
    const classes   = Storage.getClassesByDate(dateStr);
    const completed = classes.filter(c => c.status === 'completed').length;
    const cancelled = classes.filter(c => c.status === 'cancelled').length;
    const pending   = classes.filter(c => c.status === 'pending').length;
    const totVal    = classes.reduce((s, c) => s + (c.value || 0), 0);
    const totProf   = classes.reduce((s, c) => s + (c.profCut || 0), 0);
    const totClub   = classes.reduce((s, c) => s + (c.clubCut || 0), 0);

    this._setEl('totValor',    Utils.formatCurrency(totVal));
    this._setEl('totProf',     Utils.formatCurrency(totProf));
    this._setEl('totClub',     Utils.formatCurrency(totClub));
    this._setEl('totCompleted',`✓ ${completed} completada${completed !== 1 ? 's' : ''}`);
    this._setEl('totCancelled',`✗ ${cancelled} cancelada${cancelled !== 1 ? 's' : ''}`);
    this._setEl('totPending',  `⏳ ${pending} pendiente${pending !== 1 ? 's' : ''}`);

    // Day summary bar
    this._setEl('dsbTotal',    classes.length);
    this._setEl('dsbCompleted',completed);
    this._setEl('dsbCancelled',cancelled);
    this._setEl('dsbIngresos', Utils.formatCurrency(totVal));
    this._setEl('dsbProf',     Utils.formatCurrency(totProf));
    this._setEl('dsbClub',     Utils.formatCurrency(totClub));
  },

  /* ================================================================
     TOTALS — MONTH
     ================================================================ */
  _updateMonthTotals(year, month) {
    const stats = Storage.getMonthStats(year, month);

    this._setEl('secTotalClases',  stats.total);
    this._setEl('secCompletadas',  stats.completed);
    this._setEl('secCanceladas',   stats.cancelled);
    this._setEl('secIngresos',     Utils.formatCurrency(stats.totalValue));
    this._setEl('secProf',         Utils.formatCurrency(stats.totalProf));
    this._setEl('secClub',         Utils.formatCurrency(stats.totalClub));

    this._setEl('secTotValor',     Utils.formatCurrency(stats.totalValue));
    this._setEl('secTotProf',      Utils.formatCurrency(stats.totalProf));
    this._setEl('secTotClub',      Utils.formatCurrency(stats.totalClub));
    this._setEl('secTotCompleted', `✓ ${stats.completed}`);
    this._setEl('secTotCancelled', `✗ ${stats.cancelled}`);
    this._setEl('secTotPending',   `⏳ ${stats.pending}`);
  },

  _setEl(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  },

  /* ================================================================
     OPEN CLASS FORM
     ================================================================ */
  openForm(classId = null, dateStr = null) {
    this._editingId = classId;
    this._selectedStudents = [];

    const overlay = document.getElementById('classFormOverlay');
    const title   = document.getElementById('classFormTitle');

    // Reset form
    document.getElementById('classFormId').value  = '';
    document.getElementById('classFormDate').value = '';
    document.getElementById('classDate').value    = '';
    document.getElementById('classHour').value    = '';
    document.getElementById('classPersonas').value = '';
    document.getElementById('classTipo').value    = '';
    document.getElementById('classPago').value    = '';
    document.getElementById('classFactura').value = '';
    document.getElementById('classValorManual').value = '';
    this._renderSelectedStudents();
    this._updateValuePreview();

    if (classId) {
      const cls = Storage.getClass(classId);
      if (!cls) return;
      title.textContent = 'Editar Clase';
      document.getElementById('classFormId').value = cls.id;
      document.getElementById('classDate').value   = cls.date;
      
      // Build time slots after setting date
      this._populateTimeSlots();
      
      document.getElementById('classHour').value   = cls.time;
      document.getElementById('classPersonas').value = cls.persons;
      document.getElementById('classTipo').value   = cls.tipo;
      document.getElementById('classPago').value   = cls.paymentMethod;
      document.getElementById('classFactura').value = cls.invoiceNumber;
      // Restore selected students
      this._selectedStudents = (cls.studentIds || [])
        .map(id => Storage.getStudent(id)).filter(Boolean);
      this._renderSelectedStudents();
      this._updateValuePreview();
    } else {
      title.textContent = 'Nueva Clase';
      const targetDate = dateStr || this._currentDate || Utils.toISO(new Date());
      document.getElementById('classDate').value = targetDate;
      document.getElementById('classFormDate').value = targetDate;
      
      // Build time slots after setting date
      this._populateTimeSlots();
    }

    overlay.classList.add('open');
    document.getElementById('studentSearchClass').focus();
  },

  _populateTimeSlots() {
    const settings = Storage.getSettings();
    const slots    = Utils.generateTimeSlots(settings.timeStart, settings.timeEnd, settings.timeInterval);
    const select   = document.getElementById('classHour');
    
    const dateInput = document.getElementById('classDate');
    const selectedDate = dateInput ? dateInput.value : '';

    const activeTeacherId = Storage.getActiveTeacherId();

    // Get booked time slots for this date & teacher (excluding the class being edited and cancelled classes)
    const existingClasses = (selectedDate && activeTeacherId)
      ? Storage.getAllClassesRaw().filter(c => 
          c.date === selectedDate && 
          c.teacherId === activeTeacherId && 
          c.id !== this._editingId &&
          c.status !== 'cancelled'
        )
      : [];

    const bookedHours = existingClasses.map(c => c.time);

    select.innerHTML = '<option value="">Seleccionar hora...</option>';
    slots.forEach(slot => {
      const opt = document.createElement('option');
      opt.value = slot;
      
      const isBooked = bookedHours.includes(slot);
      if (isBooked) {
        opt.disabled = true;
        opt.textContent = `${slot} (Ocupado)`;
      } else {
        opt.textContent = slot;
      }
      select.appendChild(opt);
    });
  },

  /* ================================================================
     STUDENT AUTOCOMPLETE
     ================================================================ */
  _autocompleteActive: false,

  initAutocomplete() {
    const input    = document.getElementById('studentSearchClass');
    const dropdown = document.getElementById('autocompleteDropdown');

    input.addEventListener('input', Utils.debounce(() => {
      const q = input.value.trim();
      if (q.length < 1) {
        dropdown.classList.remove('open');
        return;
      }
      const results = Storage.searchStudents(q);
      this._renderDropdown(results, q);
      dropdown.classList.add('open');
    }, 150));

    input.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        dropdown.classList.remove('open');
        input.value = '';
      }
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', e => {
      if (!document.getElementById('studentAutocomplete').contains(e.target)) {
        dropdown.classList.remove('open');
      }
    });

    dropdown.addEventListener('click', e => {
      const item = e.target.closest('.autocomplete-item');
      const createBtn = e.target.closest('.autocomplete-create');

      if (item) {
        const studentId = item.dataset.id;
        const student   = Storage.getStudent(studentId);
        if (student) this._addStudent(student);
        input.value = '';
        dropdown.classList.remove('open');
      }

      if (createBtn) {
        const newStudent = Students.quickCreate(input.value.trim());
        this._addStudent(newStudent);
        input.value = '';
        dropdown.classList.remove('open');
      }
    });
  },

  _renderDropdown(students, query) {
    const dropdown = document.getElementById('autocompleteDropdown');
    const already  = this._selectedStudents.map(s => s.id);
    const filtered = students.filter(s => !already.includes(s.id));

    if (filtered.length === 0 && !query) {
      dropdown.innerHTML = '<div style="padding:10px 14px; color:var(--text-muted); font-size:12px;">No hay coincidencias</div>';
      return;
    }

    let html = filtered.slice(0, 8).map(s => {
      const stats = Storage.getStudentStats(s.id);
      return `
        <div class="autocomplete-item" data-id="${s.id}">
          <div class="autocomplete-avatar">${Utils.initials(s.name, s.lastName)}</div>
          <div>
            <div class="autocomplete-name">${Utils.fullName(s.name, s.lastName)}</div>
            <div class="autocomplete-meta">${stats.total} clase${stats.total !== 1 ? 's' : ''} registrada${stats.total !== 1 ? 's' : ''}</div>
          </div>
        </div>
      `;
    }).join('');

    if (query) {
      html += `<div class="autocomplete-create">➕ Crear "${query}" como nuevo alumno</div>`;
    }

    dropdown.innerHTML = html;
  },

  _addStudent(student) {
    if (this._selectedStudents.find(s => s.id === student.id)) return;
    this._selectedStudents.push(student);
    this._renderSelectedStudents();
    this._updateValuePreview();
  },

  _removeStudent(studentId) {
    this._selectedStudents = this._selectedStudents.filter(s => s.id !== studentId);
    this._renderSelectedStudents();
    this._updateValuePreview();
  },

  _renderSelectedStudents() {
    const container = document.getElementById('selectedStudents');
    container.innerHTML = this._selectedStudents.map(s => {
      const pkg = Storage.getStudentPackageStatus(s.id);
      let pkgHtml = '';
      if (pkg.total > 0) {
        if (pkg.isActive) {
          const pct = Math.round((pkg.used / pkg.total) * 100);
          pkgHtml = `
            <div class="class-pkg-info pkg-active">
              <span class="pkg-icon">📦</span>
              <span class="pkg-text">Paquete: <strong>${pkg.used}</strong> usadas / <strong>${pkg.total}</strong> total &mdash; Quedan <strong>${pkg.remaining}</strong></span>
              <div class="pkg-bar-wrap"><div class="pkg-bar-fill" style="width:${pct}%"></div></div>
              <span class="pkg-price-tag">${Utils.formatCurrency(pkg.price)} / clase (paquete)</span>
            </div>`;
        } else {
          pkgHtml = `<div class="class-pkg-info pkg-done"><span class="pkg-icon">📦</span> Paquete completado &mdash; se aplica precio normal</div>`;
        }
      }
      return `
        <div class="student-tag">
          <div class="student-tag-main">
            ${Utils.fullName(s.name, s.lastName)}
            <button class="tag-remove" data-student-id="${s.id}">&times;</button>
          </div>
          ${pkgHtml}
        </div>`;
    }).join('');

    container.querySelectorAll('.tag-remove').forEach(btn => {
      btn.addEventListener('click', () => this._removeStudent(btn.dataset.studentId));
    });
  },

  _updateTipoOptions() {
    const personsInput = document.getElementById('classPersonas');
    const tipoSelect   = document.getElementById('classTipo');
    if (!tipoSelect) return;

    const indOption = tipoSelect.querySelector('option[value="individual"]');
    const count = parseInt(personsInput.value) || this._selectedStudents.length || 1;

    if (count >= 2) {
      if (indOption) {
        indOption.disabled = true;
        indOption.hidden = true;
      }
      // If "individual" was currently selected, auto-switch to "grupal"
      if (tipoSelect.value === 'individual') {
        tipoSelect.value = 'grupal';
      }
    } else {
      if (indOption) {
        indOption.disabled = false;
        indOption.hidden = false;
      }
    }
  },

  /* ================================================================
     VALUE PREVIEW (auto-calculate)
     ================================================================ */
  _updateValuePreview() {
    this._updateTipoOptions();

    const tipo    = document.getElementById('classTipo').value;
    const persons = parseInt(document.getElementById('classPersonas').value) || this._selectedStudents.length || 1;
    const manual  = document.getElementById('classValorManual').value;
    const settings = Storage.getSettings();

    let calc = { total: 0, prof: 0, club: 0 };

    if (manual && manual !== '') {
      const total = Number(manual) || 0;
      const profPct = (settings.profPercentage || 50) / 100;
      calc = {
        total,
        prof: Math.round(total * profPct),
        club: total - Math.round(total * profPct),
      };
    } else {
      // Check if any selected student has an active package
      const pkgStudent = this._selectedStudents.find(s => {
        const pkg = Storage.getStudentPackageStatus(s.id);
        return pkg.isActive;
      });

      if (pkgStudent && !tipo) {
        // Package price preview without tipo
        const pkg = Storage.getStudentPackageStatus(pkgStudent.id);
        const profPct = (settings.profPercentage || 50) / 100;
        calc = {
          total: pkg.price,
          prof: Math.round(pkg.price * profPct),
          club: pkg.price - Math.round(pkg.price * profPct),
        };
      } else if (pkgStudent && tipo) {
        const pkg = Storage.getStudentPackageStatus(pkgStudent.id);
        const profPct = (settings.profPercentage || 50) / 100;
        calc = {
          total: pkg.price,
          prof: Math.round(pkg.price * profPct),
          club: pkg.price - Math.round(pkg.price * profPct),
        };
      } else if (tipo) {
        calc = Utils.calcValue(tipo, persons, settings);
      }
    }

    this._setEl('vpTotal', Utils.formatCurrency(calc.total));
    this._setEl('vpProf',  Utils.formatCurrency(calc.prof));
    this._setEl('vpClub',  Utils.formatCurrency(calc.club));

    return calc;
  },

  /* ================================================================
     SAVE CLASS
     ================================================================ */
  save() {
    const id      = document.getElementById('classFormId').value;
    const date    = document.getElementById('classDate').value;
    const time    = document.getElementById('classHour').value;
    const persons = parseInt(document.getElementById('classPersonas').value) || this._selectedStudents.length || 1;
    const tipo    = document.getElementById('classTipo').value;
    const pago    = document.getElementById('classPago').value;
    const factura = document.getElementById('classFactura').value.trim();
    const manual  = document.getElementById('classValorManual').value;

    if (!date) {
      App.showToast('Por favor ingrese una fecha', 'error');
      return;
    }
    if (!time) {
      App.showToast('Por favor seleccione el horario', 'error');
      return;
    }
    if (this._selectedStudents.length === 0) {
      App.showToast('Agregue al menos un alumno', 'error');
      return;
    }
    if (!tipo) {
      App.showToast('Por favor seleccione el tipo de clase', 'error');
      return;
    }
    if (persons >= 2 && tipo === 'individual') {
      App.showToast('Una clase con 2 o más personas debe ser Grupal o Academia', 'error');
      return;
    }

    const settings = Storage.getSettings();
    let calc = {};

    if (manual && manual !== '') {
      const total = Number(manual) || 0;
      const profPct = (settings.profPercentage || 50) / 100;
      calc = {
        total,
        prof: Math.round(total * profPct),
        club: total - Math.round(total * profPct),
      };
    } else {
      // Check for active package on any selected student
      const pkgStudent = this._selectedStudents.find(s => {
        const pkg = Storage.getStudentPackageStatus(s.id);
        return pkg.isActive;
      });
      if (pkgStudent) {
        const pkg = Storage.getStudentPackageStatus(pkgStudent.id);
        const profPct = (settings.profPercentage || 50) / 100;
        calc = {
          total: pkg.price,
          prof: Math.round(pkg.price * profPct),
          club: pkg.price - Math.round(pkg.price * profPct),
        };
      } else {
        calc = Utils.calcValue(tipo, persons, settings);
      }
    }

    const activeTeacherId = Storage.getActiveTeacherId();

    const isManualPrice = manual !== '' && manual !== null && manual !== undefined;

    const data = {
      date,
      time,
      persons,
      studentIds: this._selectedStudents.map(s => s.id),
      tipo,
      value: calc.total,
      profCut: calc.prof,
      clubCut: calc.club,
      paymentMethod: pago,
      invoiceNumber: factura,
      teacherId: activeTeacherId,
      isManualPrice,
    };

    if (id) {
      Storage.updateClass(id, data);
      App.showToast('Clase actualizada', 'success');
    } else {
      Storage.addClass(data);
      // Increment package usage for students with active packages
      this._selectedStudents.forEach(s => {
        const pkg = Storage.getStudentPackageStatus(s.id);
        if (pkg.isActive) {
          Storage.incrementPackageUsed(s.id);
        }
      });
      App.showToast('Clase registrada exitosamente', 'success');
    }

    document.getElementById('classFormOverlay').classList.remove('open');
    this._refresh(date);
    Calendar.refreshDay(date);
  },

  _refresh(date) {
    // Refresh whichever views are active
    if (this._currentDate === date || !date) {
      if (this._currentDate) this.renderDayTable(this._currentDate);
    }
    // Refresh month section if active
    const secSection = document.getElementById('section-classes');
    if (secSection.classList.contains('active') && App._sectionClassesYear) {
      this.renderMonthTable(App._sectionClassesYear, App._sectionClassesMonth);
    }
  },

  /* ================================================================
     CLASS STATUS CHANGE
     ================================================================ */
  complete(id) {
    const cls = Storage.getClass(id);
    if (!cls) return;
    Storage.setClassStatus(id, 'completed');
    App.showToast('Clase marcada como ✓ completada', 'success');
    this._refresh(cls.date);
    Calendar.refreshDay(cls.date);
    if (App._sectionClassesYear !== undefined) {
      this.renderMonthTable(App._sectionClassesYear, App._sectionClassesMonth);
    }
  },

  cancel(id) {
    const cls = Storage.getClass(id);
    if (!cls) return;
    Storage.setClassStatus(id, 'cancelled');
    App.showToast('Clase marcada como ✗ cancelada', 'info');
    this._refresh(cls.date);
    Calendar.refreshDay(cls.date);
    if (App._sectionClassesYear !== undefined) {
      this.renderMonthTable(App._sectionClassesYear, App._sectionClassesMonth);
    }
  },

  /* ================================================================
     DELETE CLASS
     ================================================================ */
  delete(id) {
    const cls = Storage.getClass(id);
    if (!cls) return;
    App.confirm(
      '¿Eliminar esta clase?',
      'Se perderá el registro permanentemente.',
      () => {
        const date = cls.date;
        Storage.deleteClass(id);
        App.showToast('Clase eliminada', 'info');
        this._refresh(date);
        Calendar.refresh();
      }
    );
  },

  /* ================================================================
     EVENT DELEGATION — tables
     ================================================================ */
  _handleTableEvent(e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const id     = btn.dataset.id;
    if (action === 'complete-class') Classes.complete(id);
    if (action === 'cancel-class')   Classes.cancel(id);
    if (action === 'edit-class')     Classes.openForm(id);
    if (action === 'delete-class')   Classes.delete(id);
  },

  /* ================================================================
     INIT
     ================================================================ */
  init() {
    // Form close/cancel
    ['classFormClose', 'classFormCancel'].forEach(id => {
      document.getElementById(id).addEventListener('click', () => {
        document.getElementById('classFormOverlay').classList.remove('open');
      });
    });

    // Overlay backdrop
    document.getElementById('classFormOverlay').addEventListener('click', e => {
      if (e.target === e.currentTarget) e.currentTarget.classList.remove('open');
    });

    // Save
    document.getElementById('classFormSave').addEventListener('click', () => this.save());

    // Add class buttons (daily view)
    document.getElementById('addClassBtn').addEventListener('click', () => {
      this.openForm(null, Calendar.selectedDate);
    });
    document.getElementById('addClassBtnEmpty').addEventListener('click', () => {
      this.openForm(null, Calendar.selectedDate);
    });

    // Add class button (section view)
    document.getElementById('addClassBtnSection').addEventListener('click', () => {
      this.openForm(null, Utils.toISO(new Date()));
    });

    // Auto-update value preview when tipo or personas changes
    ['classTipo', 'classPersonas', 'classValorManual'].forEach(id => {
      document.getElementById(id).addEventListener('change', () => this._updateValuePreview());
    });
    document.getElementById('classValorManual').addEventListener('input', () => this._updateValuePreview());

    // Update time slots dropdown when the form date is modified
    document.getElementById('classDate').addEventListener('change', () => this._populateTimeSlots());

    // Autocomplete
    this.initAutocomplete();

    // Table event delegation (daily view)
    document.getElementById('classesTableBody').addEventListener('click', e => this._handleTableEvent(e));

    // Table event delegation (section view)
    document.getElementById('classesTableSectionBody').addEventListener('click', e => this._handleTableEvent(e));
  },
};
