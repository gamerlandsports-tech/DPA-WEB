/* ============================================================
   DPA — teachers.js — Módulo de Profesores
   ============================================================ */

'use strict';

const Teachers = {

  /* ---- Render teacher grid ---- */
  render() {
    const grid    = document.getElementById('teacherGrid');
    const empty   = document.getElementById('emptyTeachers');
    const teachers = Storage.getTeachers();
    const activeId = Storage.getActiveTeacher();

    grid.innerHTML = '';

    if (teachers.length === 0) {
      grid.style.display = 'none';
      empty.classList.add('visible');
      return;
    }

    grid.style.display = 'grid';
    empty.classList.remove('visible');

    teachers.forEach(t => {
      const stats = this._getTeacherStats(t.id);
      const isActive = t.id === activeId;
      const card = document.createElement('div');
      card.className = `person-card${isActive ? ' active-teacher' : ''}`;
      card.innerHTML = `
        ${isActive ? '<div class="active-badge">⚡ Activo</div>' : ''}
        <div class="person-avatar">${Utils.initials(t.name, t.lastName)}</div>
        <div class="person-name">${Utils.fullName(t.name, t.lastName)}</div>
        <div class="person-meta">
          ${t.phone ? `📱 ${t.phone}` : ''}
          ${t.email ? `&nbsp;·&nbsp; ✉ ${t.email}` : ''}
          <br>📊 Ganancia: ${t.percentage || 50}%
        </div>
        <div class="person-stats">
          <div class="ps-item">
            <span class="ps-val">${stats.total}</span>
            <span class="ps-label">Clases</span>
          </div>
          <div class="ps-item">
            <span class="ps-val green">${stats.completed}</span>
            <span class="ps-label">Completadas</span>
          </div>
          <div class="ps-item">
            <span class="ps-val accent">${Utils.formatCurrency(stats.totalEarned)}</span>
            <span class="ps-label">Ganado</span>
          </div>
        </div>
        <div class="person-actions">
          ${t.phone ? `<a href="https://wa.me/${t.phone.replace(/[^0-9]/g, '')}" target="_blank" rel="noopener" class="btn-whatsapp btn-sm" title="Enviar WhatsApp al Profesor">💬 WhatsApp</a>` : ''}
          ${!isActive ? `<button class="btn btn-primary btn-sm" data-action="set-active" data-id="${t.id}">⚡ Activar</button>` : ''}
          <button class="btn btn-ghost btn-sm" data-action="edit-teacher" data-id="${t.id}">✏️ Editar</button>
          <button class="btn btn-ghost btn-sm" style="color:var(--red); border-color:rgba(239,68,68,0.3);" data-action="delete-teacher" data-id="${t.id}">🗑</button>
        </div>
      `;
      grid.appendChild(card);
    });
  },

  _getTeacherStats(teacherId) {
    const classes   = Storage.getClasses().filter(c => c.teacherId === teacherId);
    const completed = classes.filter(c => c.status === 'completed').length;
    const totalEarned = classes.reduce((s, c) => s + (c.profCut || 0), 0);
    return { total: classes.length, completed, totalEarned };
  },

  /* ---- Open form ---- */
  openForm(teacherId = null) {
    const overlay = document.getElementById('teacherFormOverlay');
    const title   = document.getElementById('teacherFormTitle');
    const idField = document.getElementById('teacherFormId');

    document.getElementById('teacherName').value       = '';
    document.getElementById('teacherLastName').value   = '';
    document.getElementById('teacherPhone').value      = '';
    document.getElementById('teacherEmail').value      = '';
    document.getElementById('teacherPercentage').value = 50;
    document.getElementById('teacherPassword').value   = '';

    if (teacherId) {
      const t = Storage.getTeacher(teacherId);
      if (!t) return;
      title.textContent = 'Editar Profesor';
      idField.value = t.id;
      document.getElementById('teacherName').value       = t.name;
      document.getElementById('teacherLastName').value   = t.lastName;
      document.getElementById('teacherPhone').value      = t.phone;
      document.getElementById('teacherEmail').value      = t.email;
      document.getElementById('teacherPercentage').value = t.percentage;
      document.getElementById('teacherPassword').value   = t.password || '';
    } else {
      title.textContent = 'Nuevo Profesor';
      idField.value = '';
    }

    overlay.classList.add('open');
    document.getElementById('teacherName').focus();
  },

  /* ---- Save teacher ---- */
  save() {
    const name       = document.getElementById('teacherName').value.trim();
    const lastName   = document.getElementById('teacherLastName').value.trim();
    const phone      = document.getElementById('teacherPhone').value.trim();
    const email      = document.getElementById('teacherEmail').value.trim();
    const percentage = parseFloat(document.getElementById('teacherPercentage').value) || 50;
    const password   = document.getElementById('teacherPassword').value.trim();
    const id         = document.getElementById('teacherFormId').value;

    if (!name || !lastName) {
      App.showToast('Por favor complete nombre y apellido', 'error');
      return;
    }

    const data = { name, lastName, phone, email, percentage, password };

    if (id) {
      Storage.updateTeacher(id, data);
      App.showToast(`Profesor ${name} ${lastName} actualizado`, 'success');
    } else {
      const newTeacher = Storage.addTeacher(data);
      // If no active teacher, set this one as active automatically
      if (!Storage.getActiveTeacher()) {
        Storage.setActiveTeacher(newTeacher.id);
        App.updateActiveTeacherBar();
      }
      App.showToast(`Profesor ${name} ${lastName} agregado`, 'success');
    }

    if (typeof Auth !== 'undefined') Auth._populateProfessors();
    document.getElementById('teacherFormOverlay').classList.remove('open');
    this.render();
  },

  /* ---- Delete teacher ---- */
  delete(id) {
    const t = Storage.getTeacher(id);
    if (!t) return;
    App.confirm(
      `¿Eliminar al profesor ${Utils.fullName(t.name, t.lastName)}?`,
      'Esta acción no se puede deshacer.',
      () => {
        Storage.deleteTeacher(id);
        if (typeof Auth !== 'undefined') Auth._populateProfessors();
        App.updateActiveTeacherBar();
        this.render();
        App.showToast('Profesor eliminado', 'info');
      }
    );
  },

  /* ---- Set active teacher ---- */
  setActive(id) {
    Storage.setActiveTeacher(id);
    App.updateActiveTeacherBar();
    this.render();
    const t = Storage.getTeacher(id);
    if (t) App.showToast(`Profesor activo: ${Utils.fullName(t.name, t.lastName)}`, 'success');
  },

  /* ---- Init event listeners ---- */
  init() {
    // Add teacher buttons
    document.getElementById('addTeacherBtn').addEventListener('click', () => this.openForm());
    document.getElementById('addTeacherBtnEmpty').addEventListener('click', () => this.openForm());

    // Form save
    document.getElementById('teacherFormSave').addEventListener('click', () => this.save());

    // Form cancel/close
    ['teacherFormClose', 'teacherFormCancel'].forEach(id => {
      document.getElementById(id).addEventListener('click', () => {
        document.getElementById('teacherFormOverlay').classList.remove('open');
      });
    });

    // Overlay click to close
    document.getElementById('teacherFormOverlay').addEventListener('click', e => {
      if (e.target === e.currentTarget) {
        document.getElementById('teacherFormOverlay').classList.remove('open');
      }
    });

    // Grid delegation
    document.getElementById('teacherGrid').addEventListener('click', e => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      const id     = btn.dataset.id;
      if (action === 'set-active')    this.setActive(id);
      if (action === 'edit-teacher')  this.openForm(id);
      if (action === 'delete-teacher') this.delete(id);
    });
  },
};
