/* ============================================================
   DPA — students.js — Módulo de Alumnos
   ============================================================ */

'use strict';

const Students = {

  _currentQuery: '',

  /* ---- Render student grid ---- */
  render(query = '') {
    this._currentQuery = query;
    const grid    = document.getElementById('studentGrid');
    const empty   = document.getElementById('emptyStudents');
    const students = query ? Storage.searchStudents(query) : Storage.getStudents();

    // Sort alphabetically
    students.sort((a, b) => {
      const nameA = Utils.fullName(a.lastName, a.name).toLowerCase();
      const nameB = Utils.fullName(b.lastName, b.name).toLowerCase();
      return nameA.localeCompare(nameB, 'es');
    });

    grid.innerHTML = '';

    if (students.length === 0) {
      grid.style.display = 'none';
      empty.classList.add('visible');
      return;
    }

    grid.style.display = 'grid';
    empty.classList.remove('visible');

    students.forEach(s => {
      const stats = Storage.getStudentStats(s.id);
      const pkg   = Storage.getStudentPackageStatus(s.id);
      let pkgBadge = '';
      if (pkg.total > 0) {
        if (pkg.isActive) {
          pkgBadge = `<div class="student-package-badge pkg-active">📦 ${pkg.used}/${pkg.total} — Quedan ${pkg.remaining}</div>`;
        } else {
          pkgBadge = `<div class="student-package-badge pkg-done">📦 Paquete completado</div>`;
        }
      }
        const pendingBadge = stats.pending > 0
          ? `<div class="student-pending-badge" style="margin-top:8px; padding:6px 10px; border-radius:6px; background:rgba(234,179,8,0.15); border:1px solid rgba(234,179,8,0.4); color:#fde047; font-size:11.5px; font-weight:700; text-align:center;">⏳ ${stats.pending} clase${stats.pending !== 1 ? 's' : ''} pendiente${stats.pending !== 1 ? 's' : ''} de pago</div>`
          : '';

        const card = document.createElement('div');
        card.className = 'person-card';
        card.innerHTML = `
          <div class="person-avatar">${Utils.initials(s.name, s.lastName)}</div>
          <div class="person-name">${Utils.fullName(s.name, s.lastName)}</div>
          <div class="person-meta">
            ${s.gender === 'masculino' ? '<span class="gender-badge masc">♂ Masculino</span>' : s.gender === 'femenino' ? '<span class="gender-badge fem">♀ Femenino</span>' : ''}
            ${s.phone ? `📱 ${s.phone}` : ''}
            ${s.email ? `&nbsp;·&nbsp; ✉ ${s.email}` : ''}
          </div>
          <div class="student-type-breakdown">
            <div class="stb-item">
              <div class="stb-dot fill-individual"></div>
              <span class="stb-count">${stats.individual}</span>
              <span class="stb-label">Individual</span>
            </div>
            <div class="stb-item">
              <div class="stb-dot fill-grupal"></div>
              <span class="stb-count">${stats.grupal}</span>
              <span class="stb-label">Grupal</span>
            </div>
            <div class="stb-item">
              <div class="stb-dot fill-academia"></div>
              <span class="stb-count">${stats.academia}</span>
              <span class="stb-label">Academia</span>
            </div>
          </div>
          <div class="person-stats" style="margin-top:10px">
            <div class="ps-item">
              <span class="ps-val green">${stats.completed}</span>
              <span class="ps-label">Completadas</span>
            </div>
            <div class="ps-item">
              <span class="ps-val" style="color:#eab308">${stats.pending}</span>
              <span class="ps-label">Pendientes</span>
            </div>
            <div class="ps-item">
              <span class="ps-val red">${stats.cancelled}</span>
              <span class="ps-label">Canceladas</span>
            </div>
          </div>
          ${pendingBadge}
          <div class="person-actions">
            <button class="btn btn-ghost btn-sm student-card-detail-btn" data-action="detail-student" data-id="${s.id}">👁 Ver ficha</button>
            <button class="btn btn-ghost btn-sm" data-action="edit-student" data-id="${s.id}">✏️ Editar</button>
            <button class="btn btn-ghost btn-sm" style="color:var(--red); border-color:rgba(239,68,68,0.3);" data-action="delete-student" data-id="${s.id}">🗑</button>
          </div>
          ${pkgBadge}
        `;
      grid.appendChild(card);
    });
  },

  /* ---- Open form ---- */
  openForm(studentId = null) {
    const overlay = document.getElementById('studentFormOverlay');
    const title   = document.getElementById('studentFormTitle');
    const idField = document.getElementById('studentFormId');

    document.getElementById('studentName').value      = '';
    document.getElementById('studentLastName').value  = '';
    document.getElementById('studentPhone').value     = '';
    document.getElementById('studentEmail').value     = '';
    document.getElementById('studentNotes').value     = '';
    document.getElementById('studentPackageTotal').value = '';
    document.getElementById('studentPackagePrice').value = '';
    document.getElementById('studentPackageUsed').value  = 0;
    this._updatePackageResetBtn(0, 0);
    this._setGender('');

    if (studentId) {
      const s = Storage.getStudent(studentId);
      if (!s) return;
      title.textContent = 'Editar Alumno';
      idField.value = s.id;
      document.getElementById('studentName').value      = s.name;
      document.getElementById('studentLastName').value  = s.lastName;
      document.getElementById('studentPhone').value     = s.phone;
      document.getElementById('studentEmail').value     = s.email;
      document.getElementById('studentNotes').value     = s.notes;
      document.getElementById('studentPackageTotal').value = s.packageTotal || '';
      document.getElementById('studentPackagePrice').value = s.packagePrice || '';
      document.getElementById('studentPackageUsed').value  = s.packageUsed  || 0;
      this._updatePackageResetBtn(s.packageUsed || 0, s.packageTotal || 0);
      this._setGender(s.gender || '');
    } else {
      title.textContent = 'Nuevo Alumno';
      idField.value = '';
    }

    overlay.classList.add('open');
    document.getElementById('studentName').focus();
  },

  _updatePackageResetBtn(used, total) {
    const infoEl = document.getElementById('packageUsedInfo');
    if (infoEl) {
      if (total > 0) {
        const remaining = Math.max(0, total - used);
        infoEl.textContent = `Usadas: ${used} / ${total} — Quedan: ${remaining}`;
        infoEl.style.display = 'block';
      } else {
        infoEl.style.display = 'none';
      }
    }
  },

  /* ---- Gender toggle helper ---- */
  _setGender(value) {
    document.getElementById('studentGender').value = value;
    document.querySelectorAll('.gender-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.gender === value);
    });
  },

  /* ---- Save student ---- */
  save() {
    const name         = document.getElementById('studentName').value.trim();
    const lastName     = document.getElementById('studentLastName').value.trim();
    const phone        = document.getElementById('studentPhone').value.trim();
    const email        = document.getElementById('studentEmail').value.trim();
    const notes        = document.getElementById('studentNotes').value.trim();
    const gender       = document.getElementById('studentGender').value;
    const id           = document.getElementById('studentFormId').value;
    const packageTotal = Number(document.getElementById('studentPackageTotal').value) || 0;
    const packagePrice = Number(document.getElementById('studentPackagePrice').value) || 0;
    const packageUsed  = Number(document.getElementById('studentPackageUsed').value)  || 0;

    if (!name || !lastName) {
      App.showToast('Por favor complete nombre y apellido', 'error');
      return;
    }

    const data = { name, lastName, phone, email, notes, gender, packageTotal, packagePrice, packageUsed };

    if (id) {
      Storage.updateStudent(id, data);
      App.showToast(`Alumno ${name} ${lastName} actualizado`, 'success');
    } else {
      Storage.addStudent(data);
      App.showToast(`Alumno ${name} ${lastName} agregado`, 'success');
    }

    document.getElementById('studentFormOverlay').classList.remove('open');
    this.render(this._currentQuery);
  },

  /* ---- Delete student ---- */
  delete(id) {
    const s = Storage.getStudent(id);
    if (!s) return;
    App.confirm(
      `¿Eliminar al alumno ${Utils.fullName(s.name, s.lastName)}?`,
      'Se perderá el registro. Esta acción no se puede deshacer.',
      () => {
        Storage.deleteStudent(id);
        this.render(this._currentQuery);
        App.showToast('Alumno eliminado', 'info');
      }
    );
  },

  /* ---- Show student detail ---- */
  showDetail(studentId) {
    const s = Storage.getStudent(studentId);
    if (!s) return;
    const stats = Storage.getStudentStats(studentId);

    document.getElementById('studentDetailName').textContent =
      Utils.fullName(s.name, s.lastName);

    const body = document.getElementById('studentDetailBody');

    // Build history rows
    const historyRows = stats.classes.map((cls, i) => {
      const students = Storage.getStudents();
      const statusClass = cls.status === 'completed' ? 'status-completed' :
                          cls.status === 'cancelled'  ? 'status-cancelled'  : '';
      const statusText  = cls.status === 'completed' ? '✓ Completada' :
                          cls.status === 'cancelled'  ? '✗ Cancelada'  : '⏳ Pendiente';
      const tipoLabel   = cls.tipo === 'individual' ? 'Individual' :
                          cls.tipo === 'grupal'      ? 'Grupal'      : 'Academia';
      return `
        <tr class="${statusClass}">
          <td>${Utils.formatShort(cls.date)}</td>
          <td>${cls.time || '-'}</td>
          <td>${tipoLabel}</td>
          <td>${cls.persons || 1}</td>
          <td>${Utils.formatCurrency(cls.value)}</td>
          <td>${statusText}</td>
        </tr>
      `;
    }).join('');

    body.innerHTML = `
      <div class="student-detail-header">
        <div class="student-detail-avatar">${Utils.initials(s.name, s.lastName)}</div>
        <div class="student-detail-info">
          <h3>${Utils.fullName(s.name, s.lastName)}</h3>
          <div class="student-detail-meta">
            ${s.phone ? `<span>📱 ${s.phone}</span>` : ''}
            ${s.email ? `<span>✉ ${s.email}</span>` : ''}
          </div>
        </div>
      </div>

      ${s.notes ? `<div class="student-notes">${s.notes}</div>` : ''}

      <div class="student-stats-row">
        <div class="student-stat-box ssb-total">
          <div class="ssb-val">${stats.total}</div>
          <div class="ssb-label">Total clases</div>
        </div>
        <div class="student-stat-box">
          <div class="ssb-val" style="color:var(--green)">${stats.individual}</div>
          <div class="ssb-label">Individual</div>
        </div>
        <div class="student-stat-box">
          <div class="ssb-val" style="color:var(--blue)">${stats.grupal}</div>
          <div class="ssb-label">Grupal</div>
        </div>
        <div class="student-stat-box">
          <div class="ssb-val" style="color:var(--orange)">${stats.academia}</div>
          <div class="ssb-label">Academia</div>
        </div>
        <div class="student-stat-box">
          <div class="ssb-val" style="color:var(--green)">${stats.completed}</div>
          <div class="ssb-label">Completadas</div>
        </div>
        <div class="student-stat-box">
          <div class="ssb-val" style="color:#eab308">${stats.pending}</div>
          <div class="ssb-label">Pendientes</div>
        </div>
        <div class="student-stat-box">
          <div class="ssb-val" style="color:var(--red)">${stats.cancelled}</div>
          <div class="ssb-label">Canceladas</div>
        </div>
      </div>

      <div class="student-history">
        <h4>Historial de Clases</h4>
        ${stats.classes.length === 0
          ? '<p style="color:var(--text-muted); font-size:13px;">Sin clases registradas todavía.</p>'
          : `
          <div class="table-wrapper" style="max-height:320px; overflow-y:auto">
            <table class="history-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Hora</th>
                  <th>Tipo</th>
                  <th>Personas</th>
                  <th>Valor</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>${historyRows}</tbody>
            </table>
          </div>
          `
        }
      </div>
    `;

    document.getElementById('studentDetailOverlay').classList.add('open');
  },

  /* ---- Quick create from autocomplete ---- */
  quickCreate(nameStr) {
    // Try to split into name + lastName
    const parts = nameStr.trim().split(/\s+/);
    const name     = parts[0] || '';
    const lastName = parts.slice(1).join(' ') || '';
    const student  = Storage.addStudent({ name, lastName, phone: '', email: '', notes: '' });
    App.showToast(`Alumno ${Utils.fullName(name, lastName)} creado`, 'success');
    return student;
  },

  /* ---- Init ---- */
  init() {
    document.getElementById('addStudentBtn').addEventListener('click', () => this.openForm());
    document.getElementById('addStudentBtnEmpty').addEventListener('click', () => this.openForm());

    const btnSync = document.getElementById('btnSyncPackages');
    if (btnSync) {
      btnSync.addEventListener('click', () => {
        Storage.syncAllStudentPackages();
        this.render(this._currentQuery);
        App.showToast('✅ Clases reales y paquetes de alumnos restablecidos correctamente', 'success');
      });
    }

    // Form save
    document.getElementById('studentFormSave').addEventListener('click', () => this.save());

    // Form close/cancel
    ['studentFormClose', 'studentFormCancel'].forEach(id => {
      document.getElementById(id).addEventListener('click', () => {
        document.getElementById('studentFormOverlay').classList.remove('open');
      });
    });

    // Detail close
    document.getElementById('studentDetailClose').addEventListener('click', () => {
      document.getElementById('studentDetailOverlay').classList.remove('open');
    });

    // Close overlays on backdrop click
    ['studentFormOverlay', 'studentDetailOverlay'].forEach(id => {
      document.getElementById(id).addEventListener('click', e => {
        if (e.target === e.currentTarget) e.currentTarget.classList.remove('open');
      });
    });

    // Search input
    const searchInput = document.getElementById('studentSearchInput');
    searchInput.addEventListener('input', Utils.debounce(e => {
      this.render(e.target.value.trim());
    }, 200));

    // Grid delegation
    document.getElementById('studentGrid').addEventListener('click', e => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      const id     = btn.dataset.id;
      if (action === 'detail-student') this.showDetail(id);
      if (action === 'edit-student')   this.openForm(id);
      if (action === 'delete-student') this.delete(id);
    });

    // Gender button delegation
    document.getElementById('genderSelector').addEventListener('click', e => {
      const btn = e.target.closest('.gender-btn');
      if (!btn) return;
      this._setGender(btn.dataset.gender);
    });

    // Package reset button
    const resetPkgBtn = document.getElementById('resetPackageBtn');
    if (resetPkgBtn) {
      resetPkgBtn.addEventListener('click', () => {
        document.getElementById('studentPackageUsed').value = 0;
        const total = Number(document.getElementById('studentPackageTotal').value) || 0;
        this._updatePackageResetBtn(0, total);
        App.showToast('Contador de paquete reiniciado', 'info');
      });
    }
  },
};

window.Students = Students;
