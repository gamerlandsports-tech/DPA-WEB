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
  },

  _renderCards(stats) {
    const container = document.getElementById('statsCards');
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
        <div class="stat-val" style="color:var(--accent)">${Utils.formatCurrency(stats.totalValue)}</div>
        <div class="stat-label">Ingresos totales</div>
      </div>
      <div class="stat-card">
        <div class="stat-val" style="color:var(--green)">${Utils.formatCurrency(stats.totalProf)}</div>
        <div class="stat-label">Ganancia profesor</div>
      </div>
    `;
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
  },
};
