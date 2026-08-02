/* ============================================================
   DPA — tournaments.js — Módulo de Gestión y Ejecución de Torneos
   ============================================================ */

'use strict';

const Tournaments = {

  _view: 'management', // 'management', 'create', 'playing'
  _filter: 'all',      // 'all', 'pending', 'active', 'finished'
  _currentTournamentId: null,

  _selectedModality: 'americano-individual',
  _selectedCategory: '6ta',
  _zone4Mode: 1,
  _participants: [], // [{ id, name, isStudent }]

  MODALITIES: [
    { id: 'americano-individual', name: 'AMERICANO Individual', desc: 'Rotación individual, sumatoria de puntos personal' },
    { id: 'americano-pairs',      name: 'AMERICANO por Parejas', desc: 'Parejas fijas, todos contra todos (Round Robin)' },
    { id: 'super8-individual',   name: 'SUPER 8 Individual',   desc: 'Formato rápido de 8 jugadores con rotación' },
    { id: 'super8-pairs',        name: 'SUPER 8 por Parejas',    desc: 'Formato rápido de 8 parejas' },
    { id: 'tradicional',          name: 'Torneo Tradicional por Zonas', desc: 'Fase de grupos + Cuadro eliminatorio' },
    { id: 'professional',         name: 'Torneo Profesional',    desc: 'Multi-fase (Previa/Pre-Previa) + Llave principal' },
  ],

  CATEGORIES: ['1ra', '2da', '3ra', '4ta', '5ta', '6ta', '7ma'],

  /* ================================================================
     INIT
     ================================================================ */
  init() {
    this._initEvents();
  },

  _initEvents() {
    // Filter tabs
    const filterContainer = document.getElementById('tFilterTabs');
    if (filterContainer) {
      filterContainer.addEventListener('click', e => {
        const btn = e.target.closest('.t-filter-btn');
        if (!btn) return;
        this._filter = btn.dataset.filter;
        filterContainer.querySelectorAll('.t-filter-btn').forEach(b => b.classList.toggle('active', b === btn));
        this.renderManagement();
      });
    }

    // New Tournament Button
    const btnNew = document.getElementById('btnNewTournament');
    if (btnNew) {
      btnNew.addEventListener('click', () => {
        this.openCreateForm();
      });
    }

    // Category Selector
    const catContainer = document.getElementById('tCategoryPills');
    if (catContainer) {
      catContainer.addEventListener('click', e => {
        const pill = e.target.closest('.t-cat-pill');
        if (!pill) return;
        this._selectedCategory = pill.dataset.category;
        catContainer.querySelectorAll('.t-cat-pill').forEach(p => p.classList.toggle('active', p === pill));
      });
    }

    // Modality Selector
    const modContainer = document.getElementById('tModalityList');
    if (modContainer) {
      modContainer.addEventListener('click', e => {
        const opt = e.target.closest('.t-modality-option');
        if (!opt) return;
        this._selectedModality = opt.dataset.modality;
        modContainer.querySelectorAll('.t-modality-option').forEach(o => o.classList.toggle('selected', o === opt));

        const zoneBox = document.getElementById('tZone4Box');
        if (zoneBox) {
          zoneBox.style.display = this._selectedModality === 'tradicional' ? 'block' : 'none';
        }
      });
    }

    // Zone 4 Options
    const zoneBox = document.getElementById('tZone4Box');
    if (zoneBox) {
      zoneBox.addEventListener('click', e => {
        const opt = e.target.closest('.zone4-mode-option');
        if (!opt) return;
        this._zone4Mode = Number(opt.dataset.mode) || 1;
        zoneBox.querySelectorAll('.zone4-mode-option').forEach(o => o.classList.toggle('selected', o === opt));
      });
    }

    // Add External Player
    const btnAddExt = document.getElementById('btnAddExternalPlayer');
    if (btnAddExt) {
      btnAddExt.addEventListener('click', () => this._addExternalPlayer());
    }

    // Save New Tournament
    const btnSaveT = document.getElementById('btnSaveTournament');
    if (btnSaveT) {
      btnSaveT.addEventListener('click', () => this._saveNewTournament());
    }

    // Back to Management
    const btnBack = document.getElementById('btnBackToTournaments');
    if (btnBack) {
      btnBack.addEventListener('click', () => {
        this._view = 'management';
        this.render();
      });
    }

    // Autocomplete student search for tournaments
    this._initStudentSearch();
  },

  _initStudentSearch() {
    const input = document.getElementById('tStudentSearchInput');
    const dropdown = document.getElementById('tStudentDropdown');
    if (!input || !dropdown) return;

    input.addEventListener('input', Utils.debounce(() => {
      const q = input.value.trim();
      if (!q) {
        dropdown.classList.remove('open');
        return;
      }
      const students = Storage.searchStudents(q);
      if (students.length === 0) {
        dropdown.innerHTML = '<div style="padding:10px; color:var(--text-muted); font-size:12px">No se encontraron alumnos</div>';
      } else {
        dropdown.innerHTML = students.slice(0, 6).map(s => `
          <div class="autocomplete-item" data-student-id="${s.id}">
            <div class="autocomplete-avatar">${Utils.initials(s.name, s.lastName)}</div>
            <div>
              <div class="autocomplete-name">${Utils.fullName(s.name, s.lastName)}</div>
            </div>
          </div>
        `).join('');
      }
      dropdown.classList.add('open');
    }, 150));

    dropdown.addEventListener('click', e => {
      const item = e.target.closest('.autocomplete-item');
      if (!item) return;
      const sId = item.dataset.studentId;
      const student = Storage.getStudent(sId);
      if (student) {
        this._addParticipant({
          id: student.id,
          name: Utils.fullName(student.name, student.lastName),
          isStudent: true
        });
      }
      input.value = '';
      dropdown.classList.remove('open');
    });

    document.addEventListener('click', e => {
      if (!document.getElementById('tStudentAutocompleteWrap')?.contains(e.target)) {
        dropdown.classList.remove('open');
      }
    });
  },

  /* ================================================================
     RENDER MAIN ROUTER
     ================================================================ */
  render() {
    const viewMgmt = document.getElementById('tViewManagement');
    const viewCreate = document.getElementById('tViewCreate');
    const viewLive = document.getElementById('tViewLive');

    if (viewMgmt) viewMgmt.style.display = this._view === 'management' ? 'block' : 'none';
    if (viewCreate) viewCreate.style.display = this._view === 'create' ? 'block' : 'none';
    if (viewLive) viewLive.style.display = this._view === 'playing' ? 'block' : 'none';

    if (this._view === 'management') this.renderManagement();
    if (this._view === 'create') this.renderCreateForm();
    if (this._view === 'playing') this.renderLive();
  },

  /* ================================================================
     RENDER MANAGEMENT (Dashboard)
     ================================================================ */
  renderManagement() {
    const listContainer = document.getElementById('tournamentsList');
    if (!listContainer) return;

    let tournaments = Storage.getTournaments();

    if (this._filter !== 'all') {
      tournaments = tournaments.filter(t => t.status === this._filter);
    }

    if (tournaments.length === 0) {
      listContainer.innerHTML = `
        <div style="grid-column: 1/-1; text-align:center; padding: 40px 20px; background:var(--bg-card); border-radius:14px; border:1px dashed var(--border)">
          <div style="font-size:36px; margin-bottom:10px">🏆</div>
          <p style="color:var(--text-secondary); font-size:14px; margin:0">No hay torneos ${this._filter !== 'all' ? 'en esta categoría' : 'registrados aún'}.</p>
          <button class="btn btn-primary btn-sm" style="margin-top:14px" onclick="Tournaments.openCreateForm()">+ Crear primer torneo</button>
        </div>
      `;
      return;
    }

    listContainer.innerHTML = tournaments.map(t => {
      const mode = this.MODALITIES.find(m => m.id === t.modality);
      const statusBadge = t.status === 'finished'
        ? '<span class="tournament-status-badge t-status-finished">✓ Finalizado</span>'
        : t.status === 'active'
        ? '<span class="tournament-status-badge t-status-active">▶ En Curso</span>'
        : '<span class="tournament-status-badge t-status-pending">⏳ Por Disputarse</span>';

      return `
        <div class="tournament-card">
          <div>
            <div class="tournament-card-header">
              <div style="font-size:24px">🎾</div>
              <div>
                ${statusBadge}
                <div class="tournament-card-title">${t.name}</div>
                <div class="tournament-card-meta">${Utils.formatShort(t.date)} &bull; ${t.category} &bull; ${mode ? mode.name : t.modality}</div>
              </div>
            </div>
          </div>
          <div class="tournament-card-actions">
            <button class="btn btn-primary btn-sm" style="flex:1" onclick="Tournaments.openTournament('${t.id}')">
              ${t.status === 'finished' ? '📊 Ver Resultados' : '▶ Continuar Torneo'}
            </button>
            <button class="btn btn-ghost btn-sm" style="color:var(--red); border-color:rgba(239,68,68,0.3)" onclick="Tournaments.deleteTournament('${t.id}')">🗑</button>
          </div>
        </div>
      `;
    }).join('');
  },

  /* ================================================================
     CREATE TOURNAMENT FORM
     ================================================================ */
  openCreateForm() {
    this._view = 'create';
    this._participants = [];
    this._selectedModality = 'americano-individual';
    this._selectedCategory = '6ta';
    this._zone4Mode = 1;

    document.getElementById('tFormName').value = '';
    document.getElementById('tFormDate').value = Utils.toISO(new Date());
    this._renderParticipants();
    this.render();
  },

  renderCreateForm() {
    // Render Category Pills
    const catBox = document.getElementById('tCategoryPills');
    if (catBox) {
      catBox.innerHTML = this.CATEGORIES.map(cat => `
        <button type="button" class="t-cat-pill ${cat === this._selectedCategory ? 'active' : ''}" data-category="${cat}">${cat}</button>
      `).join('');
    }

    // Render Modality Options
    const modBox = document.getElementById('tModalityList');
    if (modBox) {
      modBox.innerHTML = this.MODALITIES.map(m => `
        <div class="t-modality-option ${m.id === this._selectedModality ? 'selected' : ''}" data-modality="${m.id}">
          <div class="t-modality-name">${m.name}</div>
          <div class="t-modality-desc">${m.desc}</div>
        </div>
      `).join('');
    }
  },

  _addParticipant(p) {
    if (this._participants.some(existing => existing.name.toLowerCase() === p.name.toLowerCase())) {
      App.showToast('El participante ya fue agregado', 'error');
      return;
    }
    this._participants.push(p);
    this._renderParticipants();
  },

  _addExternalPlayer() {
    const input = document.getElementById('tExternalPlayerInput');
    const name = (input ? input.value : '').trim();
    if (!name) {
      App.showToast('Ingrese un nombre de jugador', 'error');
      return;
    }
    this._addParticipant({
      id: 'ext_' + Date.now(),
      name,
      isStudent: false
    });
    input.value = '';
  },

  _removeParticipant(index) {
    this._participants.splice(index, 1);
    this._renderParticipants();
  },

  _renderParticipants() {
    const container = document.getElementById('tParticipantsList');
    if (!container) return;

    if (this._participants.length === 0) {
      container.innerHTML = '<span style="color:var(--text-muted); font-size:12.5px">Sin participantes agregados aún</span>';
      return;
    }

    container.innerHTML = this._participants.map((p, idx) => `
      <div class="t-player-chip">
        <span>${p.isStudent ? '👤' : '🎾'} ${p.name}</span>
        <span class="remove-chip" onclick="Tournaments._removeParticipant(${idx})">&times;</span>
      </div>
    `).join('');
  },

  _saveNewTournament() {
    const name = document.getElementById('tFormName').value.trim();
    const date = document.getElementById('tFormDate').value;

    if (!name) {
      App.showToast('Ingrese el nombre del torneo', 'error');
      return;
    }

    if (this._participants.length < 2) {
      App.showToast('Agregue al menos 2 participantes para iniciar el torneo', 'error');
      return;
    }

    // Build Initial State
    const internalState = this._generateFixture(this._selectedModality, this._participants, this._zone4Mode);

    const tournament = Storage.addTournament({
      name,
      date,
      modality: this._selectedModality,
      category: this._selectedCategory,
      zone4Mode: this._zone4Mode,
      status: 'active',
      internalState
    });

    App.showToast('🏆 Torneo creado exitosamente', 'success');
    this.openTournament(tournament.id);
  },

  /* ================================================================
     FIXTURE GENERATION ENGINE
     ================================================================ */
  _generateFixture(modality, participants, zone4Mode) {
    if (modality === 'americano-individual' || modality === 'super8-individual') {
      const scores = {};
      participants.forEach(p => { scores[p.id] = 0; });

      // Round robin matches for individuals (rotating pairs)
      const rounds = [];
      const n = participants.length;
      const numRounds = n % 2 === 0 ? n - 1 : n;
      const pool = [...participants];
      if (n % 2 !== 0) pool.push({ id: 'bye', name: 'DESCANSO' });

      const totalP = pool.length;
      for (let r = 0; r < numRounds; r++) {
        const matches = [];
        for (let i = 0; i < totalP; i += 4) {
          if (i + 3 < totalP) {
            const p1 = pool[i];
            const p2 = pool[i + 1];
            const p3 = pool[i + 2];
            const p4 = pool[i + 3];

            if (p1.id !== 'bye' && p2.id !== 'bye' && p3.id !== 'bye' && p4.id !== 'bye') {
              matches.push({
                id: `r${r}_m${i}`,
                teamA: [p1, p2],
                teamB: [p3, p4],
                scoreA: 0,
                scoreB: 0,
                completed: false
              });
            }
          }
        }
        if (matches.length > 0) rounds.push({ id: r, name: `Fecha ${r + 1}`, matches });

        // Rotation
        const last = pool.pop();
        pool.splice(1, 0, last);
      }

      return { participants, rounds, scores, currentRoundIndex: 0 };
    }

    if (modality === 'americano-pairs' || modality === 'super8-pairs') {
      // Pairs round robin
      const pairs = [];
      for (let i = 0; i < participants.length; i += 2) {
        if (i + 1 < participants.length) {
          pairs.push({
            id: `pair_${i}`,
            name: `${participants[i].name} & ${participants[i + 1].name}`
          });
        } else {
          pairs.push({
            id: `pair_${i}`,
            name: `${participants[i].name}`
          });
        }
      }

      const leaderboard = {};
      pairs.forEach(p => { leaderboard[p.id] = 0; });

      const rounds = [];
      const t = [...pairs];
      if (t.length % 2 !== 0) t.push({ id: 'bye', name: 'DESCANSO' });
      const n = t.length;

      for (let r = 0; r < n - 1; r++) {
        const matches = [];
        for (let i = 0; i < n / 2; i++) {
          const teamA = t[i];
          const teamB = t[n - 1 - i];
          if (teamA.id !== 'bye' && teamB.id !== 'bye') {
            matches.push({
              id: `r${r}_m${i}`,
              teamA,
              teamB,
              scoreA: 0,
              scoreB: 0,
              completed: false
            });
          }
        }
        if (matches.length > 0) rounds.push({ id: r, name: `Fecha ${r + 1}`, matches });

        const last = t.pop();
        t.splice(1, 0, last);
      }

      return { pairs, rounds, leaderboard, currentRoundIndex: 0 };
    }

    // Default basic structure for Traditional and Professional
    return {
      participants,
      rounds: [],
      scores: {},
      currentRoundIndex: 0
    };
  },

  /* ================================================================
     LIVE TOURNAMENT EXECUTION VIEW
     ================================================================ */
  openTournament(id) {
    this._currentTournamentId = id;
    this._view = 'playing';
    this.render();
  },

  deleteTournament(id) {
    App.confirm('¿Eliminar torneo?', 'Se perderán todos los datos y resultados cargados.', () => {
      Storage.deleteTournament(id);
      App.showToast('Torneo eliminado', 'info');
      this.renderManagement();
    });
  },

  renderLive() {
    const t = Storage.getTournament(this._currentTournamentId);
    if (!t) return;

    const titleEl = document.getElementById('tLiveTitle');
    const metaEl = document.getElementById('tLiveMeta');
    const contentEl = document.getElementById('tLiveContent');

    if (titleEl) titleEl.textContent = t.name;
    if (metaEl) {
      const mode = this.MODALITIES.find(m => m.id === t.modality);
      metaEl.textContent = `${Utils.formatShort(t.date)} • Categoría ${t.category} • ${mode ? mode.name : t.modality}`;
    }

    if (!contentEl) return;

    const state = t.internalState || {};
    const rounds = state.rounds || [];

    // Check completion
    const allCompleted = rounds.length > 0 && rounds.every(r => r.matches.every(m => m.completed));

    let html = '';

    if (allCompleted) {
      html += `
        <div class="t-champion-banner">
          <div style="font-size:40px">🏆</div>
          <h2>¡TORNEO FINALIZADO!</h2>
          <p style="color:var(--text-primary); font-size:14px; font-weight:600">Revisá la tabla final de posiciones a continuación.</p>
        </div>
      `;
    }

    // Standings / Leaderboard
    html += this._buildLeaderboardHtml(t);

    // Rounds Fixture
    html += `
      <div style="margin-top:28px">
        <h3 style="font-size:18px; font-weight:800; color:var(--text-primary); margin-bottom:16px">🎾 Partidos del Torneo</h3>
    `;

    if (rounds.length === 0) {
      html += `<p style="color:var(--text-muted); font-size:13px">Sin partidos generados para esta modalidad.</p>`;
    } else {
      rounds.forEach((r, rIdx) => {
        html += `
          <div class="t-round-header">${r.name || `Fecha ${rIdx + 1}`}</div>
        `;
        r.matches.forEach((m, mIdx) => {
          const nameA = Array.isArray(m.teamA) ? m.teamA.map(p => p.name).join(' / ') : (m.teamA ? m.teamA.name : 'Equipo A');
          const nameB = Array.isArray(m.teamB) ? m.teamB.map(p => p.name).join(' / ') : (m.teamB ? m.teamB.name : 'Equipo B');

          const isWinnerA = m.completed && m.scoreA > m.scoreB;
          const isWinnerB = m.completed && m.scoreB > m.scoreA;

          html += `
            <div class="t-match-card ${m.completed ? 'completed' : ''}">
              <div class="t-team-box ${isWinnerA ? 'winner' : ''}">${isWinnerA ? '🏆 ' : ''}${nameA}</div>
              <div class="t-score-inputs">
                <input type="number" class="t-score-input" value="${m.scoreA}" min="0" onchange="Tournaments.updateScore('${t.id}', ${rIdx}, ${mIdx}, this.value, null)" />
                <span style="font-weight:800; color:var(--text-muted)">-</span>
                <input type="number" class="t-score-input" value="${m.scoreB}" min="0" onchange="Tournaments.updateScore('${t.id}', ${rIdx}, ${mIdx}, null, this.value)" />
              </div>
              <div class="t-team-box ${isWinnerB ? 'winner' : ''}" style="text-align:right">${isWinnerB ? '🏆 ' : ''}${nameB}</div>
              <div>
                <button class="btn btn-sm ${m.completed ? 'btn-ghost' : 'btn-primary'}" onclick="Tournaments.toggleMatchComplete('${t.id}', ${rIdx}, ${mIdx})">
                  ${m.completed ? '✓ Finalizado' : 'Guardar'}
                </button>
              </div>
            </div>
          `;
        });
      });
    }

    html += `</div>`;
    contentEl.innerHTML = html;
  },

  updateScore(tournamentId, roundIdx, matchIdx, valA, valB) {
    const t = Storage.getTournament(tournamentId);
    if (!t) return;
    const match = t.internalState.rounds[roundIdx].matches[matchIdx];
    if (valA !== null) match.scoreA = parseInt(valA) || 0;
    if (valB !== null) match.scoreB = parseInt(valB) || 0;
    Storage.updateTournament(tournamentId, { internalState: t.internalState });
  },

  toggleMatchComplete(tournamentId, roundIdx, matchIdx) {
    const t = Storage.getTournament(tournamentId);
    if (!t) return;
    const state = t.internalState;
    const match = state.rounds[roundIdx].matches[matchIdx];
    match.completed = !match.completed;

    // Recalculate scores / standings
    this._recalculateStandings(t);

    const allCompleted = state.rounds.every(r => r.matches.every(m => m.completed));
    const status = allCompleted ? 'finished' : 'active';

    Storage.updateTournament(tournamentId, { internalState: state, status });
    App.showToast(match.completed ? 'Partido registrado' : 'Partido reabierto', 'success');
    this.renderLive();
  },

  _recalculateStandings(t) {
    const state = t.internalState;
    if (!state.rounds) return;

    if (t.modality === 'americano-individual' || t.modality === 'super8-individual') {
      const scores = {};
      (state.participants || []).forEach(p => { scores[p.id] = 0; });

      state.rounds.forEach(r => {
        r.matches.forEach(m => {
          if (m.completed) {
            m.teamA.forEach(p => { scores[p.id] = (scores[p.id] || 0) + m.scoreA; });
            m.teamB.forEach(p => { scores[p.id] = (scores[p.id] || 0) + m.scoreB; });
          }
        });
      });
      state.scores = scores;
    } else if (t.modality === 'americano-pairs' || t.modality === 'super8-pairs') {
      const leaderboard = {};
      (state.pairs || []).forEach(p => { leaderboard[p.id] = 0; });

      state.rounds.forEach(r => {
        r.matches.forEach(m => {
          if (m.completed && m.teamA && m.teamB) {
            leaderboard[m.teamA.id] = (leaderboard[m.teamA.id] || 0) + m.scoreA;
            leaderboard[m.teamB.id] = (leaderboard[m.teamB.id] || 0) + m.scoreB;
          }
        });
      });
      state.leaderboard = leaderboard;
    }
  },

  _buildLeaderboardHtml(t) {
    const state = t.internalState || {};

    if (t.modality === 'americano-individual' || t.modality === 'super8-individual') {
      const scores = state.scores || {};
      const sorted = [...(state.participants || [])].sort((a, b) => (scores[b.id] || 0) - (scores[a.id] || 0));

      return `
        <div class="t-standings-card">
          <div class="t-standings-title">📊 Tabla Posiciones Individuales</div>
          <table class="t-table">
            <thead>
              <tr>
                <th>Pos</th>
                <th>Jugador</th>
                <th style="text-align:right">Puntos Totales</th>
              </tr>
            </thead>
            <tbody>
              ${sorted.map((p, idx) => `
                <tr>
                  <td><span class="t-rank-badge t-rank-${idx + 1}">${idx + 1}</span></td>
                  <td>${p.name}</td>
                  <td style="text-align:right; font-weight:800">${scores[p.id] || 0} pts</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    if (t.modality === 'americano-pairs' || t.modality === 'super8-pairs') {
      const leaderboard = state.leaderboard || {};
      const sorted = [...(state.pairs || [])].sort((a, b) => (leaderboard[b.id] || 0) - (leaderboard[a.id] || 0));

      return `
        <div class="t-standings-card">
          <div class="t-standings-title">📊 Tabla Posiciones Parejas</div>
          <table class="t-table">
            <thead>
              <tr>
                <th>Pos</th>
                <th>Pareja</th>
                <th style="text-align:right">Puntos Totales</th>
              </tr>
            </thead>
            <tbody>
              ${sorted.map((p, idx) => `
                <tr>
                  <td><span class="t-rank-badge t-rank-${idx + 1}">${idx + 1}</span></td>
                  <td>${p.name}</td>
                  <td style="text-align:right; font-weight:800">${leaderboard[p.id] || 0} pts</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    return '';
  },
};

window.Tournaments = Tournaments;
