/* ============================================================
   DPA — stats.js — Módulo de Estadísticas
   ============================================================ */

'use strict';

const Stats = {

  _year:  new Date().getFullYear(),
  _month: new Date().getMonth(),

  render(year, month) {
    this._year  = year;
    this._month = month;
    document.getElementById('statsMonthLabel').textContent = Utils.formatMonth(year, month);

    const stats = Storage.getMonthStats(year, month);
    this._renderCards(stats);
    this._renderTypeBars(stats.classes);
    this._renderRanking(stats.classes);
    this._renderGenderStats(stats.classes);
    this._renderAdvancesList();
  },

  _getAdvancesForMonth(year, month) {
    const activeProfId = (typeof Auth !== 'undefined' && Auth.isProfessor()) ? Auth.getCurrentProfessorId() : null;
    return Storage.getAdvances().filter(a => {
      if (!a.date) return false;
      const d = Utils.fromISO(a.date);
      const matchesMonth = d.getFullYear() === year && d.getMonth() === month;
      if (!matchesMonth) return false;
      if (activeProfId) return String(a.teacherId) === String(activeProfId);
      return true;
    });
  },

  _renderCards(stats) {
    const container = document.getElementById('statsCards');

    // Filter ONLY completed classes for REAL financial generation
    const completedClasses = stats.classes.filter(c => c.status === 'completed');
    const realIngresos = completedClasses.reduce((s, c) => s + (c.value || 0), 0);
    const realProf     = completedClasses.reduce((s, c) => s + (c.profCut || 0), 0);

    const advances = this._getAdvancesForMonth(this._year, this._month);
    const totalAdvances = advances.reduce((s, a) => s + (a.amount || 0), 0);

    const netBalance = realProf - totalAdvances;

    container.innerHTML = `
      <div class="stat-card">
        <div class="stat-val">${stats.total}</div>
        <div class="stat-label">Total clases</div>
      </div>
      <div class="stat-card">
        <div class="stat-val" style="color:var(--green)">${stats.completed}</div>
        <div class="stat-label">Completadas</div>
      </div>
      <div class="stat-card">
        <div class="stat-val" style="color:var(--red)">${stats.cancelled}</div>
        <div class="stat-label">Canceladas</div>
      </div>
      <div class="stat-card">
        <div class="stat-val">${stats.pending}</div>
        <div class="stat-label">Pendientes</div>
      </div>
      <div class="stat-card">
        <div class="stat-val" style="color:var(--accent)">${Utils.formatCurrency(realIngresos)}</div>
        <div class="stat-label">💵 Ingreso Real (Completadas)</div>
      </div>
      <div class="stat-card">
        <div class="stat-val" style="color:var(--text-secondary)">${Utils.formatCurrency(stats.totalValue)}</div>
        <div class="stat-label">📅 Ingreso Proyectado (Reservas)</div>
      </div>
      <div class="stat-card">
        <div class="stat-val" style="color:var(--green)">${Utils.formatCurrency(realProf)}</div>
        <div class="stat-label">📊 Ganancia Real Profesor</div>
      </div>
      <div class="stat-card">
        <div class="stat-val" style="color:var(--red)">-${Utils.formatCurrency(totalAdvances)}</div>
        <div class="stat-label">💸 Adelantos Entregados Club</div>
      </div>
      <div class="stat-card" style="border:2px solid var(--accent); background:rgba(34,197,94,0.06)">
        <div class="stat-val" style="color:var(--accent); font-size:22px">${Utils.formatCurrency(netBalance)}</div>
        <div class="stat-label" style="color:var(--accent); font-weight:800">💵 Saldo Neto a Cobrar (Profe)</div>
      </div>
    `;
  },

  _renderAdvancesList() {
    const container = document.getElementById('advancesListContent');
    if (!container) return;

    const advances = this._getAdvancesForMonth(this._year, this._month);

    if (advances.length === 0) {
      container.innerHTML = '<p style="color:var(--text-muted); font-size:13px; padding:12px 0;">No hay adelantos o entregas registradas en este mes.</p>';
      return;
    }

    let html = `
      <div class="table-container" style="margin-top:8px">
        <table class="classes-table" style="width:100%">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Profesor</th>
              <th>Concepto / Detalle</th>
              <th>Monto Entregado</th>
              <th style="text-align:right">Acciones</th>
            </tr>
          </thead>
          <tbody>
    `;

    advances.forEach(a => {
      const prof = Storage.getTeacher(a.teacherId);
      const profName = prof ? Utils.fullName(prof.name, prof.lastName) : 'General';
      html += `
        <tr>
          <td>${Utils.formatShort(a.date)}</td>
          <td><strong>${profName}</strong></td>
          <td>${a.note || '<span style="opacity:0.5">-</span>'}</td>
          <td style="color:var(--red); font-weight:800">-${Utils.formatCurrency(a.amount)}</td>
          <td style="text-align:right">
            <button class="btn-delete-class" onclick="Stats.deleteAdvance('${a.id}')" title="Eliminar Adelanto">🗑</button>
          </td>
        </tr>
      `;
    });

    html += `
          </tbody>
        </table>
      </div>
    `;

    container.innerHTML = html;
  },

  _renderTypeBars(classes) {
    const container = document.getElementById('typeBars');
    const total = classes.length || 1;

    const types = [
      { key: 'individual', label: 'Clase Individual', cls: 'fill-individual' },
      { key: 'grupal',     label: 'Clase Grupal',     cls: 'fill-grupal' },
      { key: 'academia',   label: 'Academia',          cls: 'fill-academia' },
    ];

    container.innerHTML = types.map(t => {
      const count  = classes.filter(c => c.tipo === t.key).length;
      const pct    = Math.round((count / total) * 100);
      return `
        <div class="type-bar-item">
          <div class="type-bar-header">
            <span class="type-bar-name">${t.label}</span>
            <span class="type-bar-count">${count} clases (${pct}%)</span>
          </div>
          <div class="type-bar-bg">
            <div class="type-bar-fill ${t.cls}" style="width:${pct}%"></div>
          </div>
        </div>
      `;
    }).join('');
  },

  _renderRanking(classes) {
    const container = document.getElementById('rankingList');

    // Count classes per student
    const studentCount = {};
    classes.forEach(cls => {
      (cls.studentIds || []).forEach(sid => {
        studentCount[sid] = (studentCount[sid] || 0) + 1;
      });
    });

    const ranked = Object.entries(studentCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    if (ranked.length === 0) {
      container.innerHTML = '<p style="color:var(--text-muted); font-size:13px;">Sin datos para el mes seleccionado.</p>';
      return;
    }

    const posCls = ['gold', 'silver', 'bronze'];
    container.innerHTML = ranked.map(([sid, count], i) => {
      const s = Storage.getStudent(sid);
      if (!s) return '';
      const pos = i < 3 ? posCls[i] : '';
      return `
        <div class="ranking-item">
          <div class="rank-pos ${pos}">${i + 1}</div>
          <div class="rank-name">${Utils.fullName(s.name, s.lastName)}</div>
          <div class="rank-classes">${count} ${count === 1 ? 'clase' : 'clases'}</div>
        </div>
      `;
    }).join('');
  },

  _renderGenderStats(classes) {
    const container = document.getElementById('genderStatsContent');

    // Collect unique student IDs from the month's classes
    const studentIds = new Set();
    classes.forEach(cls => (cls.studentIds || []).forEach(id => studentIds.add(id)));

    if (studentIds.size === 0) {
      container.innerHTML = '<p style="color:var(--text-muted); font-size:13px;">Sin alumnos registrados en este mes.</p>';
      return;
    }

    let masc = 0, fem = 0, noSpec = 0;
    studentIds.forEach(id => {
      const s = Storage.getStudent(id);
      if (!s) return;
      if      (s.gender === 'masculino') masc++;
      else if (s.gender === 'femenino')  fem++;
      else                               noSpec++;
    });

    const total = masc + fem + noSpec;
    const mascPct = total ? Math.round((masc / total) * 100) : 0;
    const femPct  = total ? Math.round((fem  / total) * 100) : 0;
    const noSpecPct = 100 - mascPct - femPct;

    container.innerHTML = `
      <div style="display:flex; gap:24px; flex-wrap:wrap; margin-bottom:16px;">
        <div class="stat-card" style="flex:1; min-width:110px;">
          <div class="stat-val" style="color:#60a5fa">${masc}</div>
          <div class="stat-label">♂ Masculino (${mascPct}%)</div>
        </div>
        <div class="stat-card" style="flex:1; min-width:110px;">
          <div class="stat-val" style="color:#f472b6">${fem}</div>
          <div class="stat-label">♀ Femenino (${femPct}%)</div>
        </div>
        <div class="stat-card" style="flex:1; min-width:110px;">
          <div class="stat-val" style="color:var(--text-secondary)">${noSpec}</div>
          <div class="stat-label">Sin especificar (${noSpecPct}%)</div>
        </div>
        <div class="stat-card" style="flex:1; min-width:110px;">
          <div class="stat-val">${total}</div>
          <div class="stat-label">Alumnos únicos</div>
        </div>
      </div>
      <div class="gender-stats-bar">
        <div class="gender-stats-header">
          <span style="color:#60a5fa">♂ Masculino ${mascPct}%</span>
          <span style="color:#f472b6">♀ Femenino ${femPct}%</span>
        </div>
        <div class="gender-stats-bg">
          <div class="gender-fill-masc" style="width:${mascPct}%"></div>
          <div class="gender-fill-fem"  style="width:${femPct}%"></div>
        </div>
        <div class="gender-stats-legend">
          <div class="gender-legend-item">
            <div class="gender-legend-dot" style="background:#3b82f6"></div>
            <span>${masc} Masculino</span>
          </div>
          <div class="gender-legend-item">
            <div class="gender-legend-dot" style="background:#ec4899"></div>
            <span>${fem} Femenino</span>
          </div>
          ${noSpec > 0 ? `
          <div class="gender-legend-item">
            <div class="gender-legend-dot" style="background:var(--text-muted)"></div>
            <span>${noSpec} Sin especificar</span>
          </div>` : ''}
        </div>
      </div>
    `;
  },

  openAdvanceForm() {
    const overlay = document.getElementById('advanceFormOverlay');
    const amount  = document.getElementById('advanceAmount');
    const date    = document.getElementById('advanceDate');
    const teacher = document.getElementById('advanceTeacher');
    const note    = document.getElementById('advanceNote');

    if (amount)  amount.value = '';
    if (date)    date.value = Utils.toISO(new Date());
    if (note)    note.value = '';

    if (teacher) {
      teacher.innerHTML = '';
      const teachers = Storage.getTeachers();
      teachers.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.id;
        opt.textContent = Utils.fullName(t.name, t.lastName);
        if (t.id === Storage.getActiveTeacherId()) opt.selected = true;
        teacher.appendChild(opt);
      });
    }

    if (overlay) overlay.classList.add('open');
  },

  saveAdvance() {
    const amountEl  = document.getElementById('advanceAmount');
    const dateEl    = document.getElementById('advanceDate');
    const teacherEl = document.getElementById('advanceTeacher');
    const noteEl    = document.getElementById('advanceNote');

    const amount    = amountEl ? amountEl.value : '';
    const date      = dateEl ? dateEl.value : '';
    const teacherId = teacherEl ? teacherEl.value : '';
    const note      = noteEl ? noteEl.value.trim() : '';

    if (!amount || Number(amount) <= 0) {
      App.showToast('Por favor ingrese un monto de adelanto válido', 'error');
      return;
    }

    const advDate = date || Utils.toISO(new Date());

    Storage.addAdvance({
      amount: Number(amount),
      date: advDate,
      teacherId: teacherId || Storage.getActiveTeacherId(),
      note,
    });

    App.showToast('💸 Adelanto del club registrado exitosamente', 'success');

    const overlay = document.getElementById('advanceFormOverlay');
    if (overlay) overlay.classList.remove('open');

    const d = Utils.fromISO(advDate);
    this.render(d.getFullYear(), d.getMonth());
  },

  deleteAdvance(id) {
    App.confirm(
      '¿Eliminar este adelanto?',
      'Se removerá el registro del adelanto permanentemente.',
      () => {
        Storage.deleteAdvance(id);
        App.showToast('Adelanto eliminado', 'info');
        this.render(this._year, this._month);
      }
    );
  },

  init() {
    document.getElementById('statsMonthPrev').addEventListener('click', () => {
      if (this._month === 0) { this._month = 11; this._year--; }
      else { this._month--; }
      this.render(this._year, this._month);
    });
    document.getElementById('statsMonthNext').addEventListener('click', () => {
      if (this._month === 11) { this._month = 0; this._year++; }
      else { this._month++; }
      this.render(this._year, this._month);
    });

    const btnAdd = document.getElementById('btnAddAdvance');
    if (btnAdd) btnAdd.addEventListener('click', () => this.openAdvanceForm());

    const btnSave = document.getElementById('advanceFormSave');
    if (btnSave) btnSave.addEventListener('click', () => this.saveAdvance());

    ['advanceFormClose', 'advanceFormCancel'].forEach(id => {
      const btn = document.getElementById(id);
      if (btn) {
        btn.addEventListener('click', () => {
          document.getElementById('advanceFormOverlay').classList.remove('open');
        });
      }
    });
  },
};

window.Stats = Stats;
