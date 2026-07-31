/* ============================================================
   DPA — calendar.js — Módulo de Calendario
   ============================================================ */

'use strict';

const Calendar = {

  currentYear:  new Date().getFullYear(),
  currentMonth: new Date().getMonth(), // 0-indexed
  selectedDate: Utils.toISO(new Date()),

  /* ================================================================
     RENDER MONTHLY CALENDAR
     ================================================================ */
  renderMonth() {
    const grid  = document.getElementById('calendarGrid');
    const title = document.getElementById('calMonthTitle');

    title.textContent = Utils.formatMonth(this.currentYear, this.currentMonth);

    const year  = this.currentYear;
    const month = this.currentMonth;
    const days  = Utils.daysInMonth(year, month);
    let firstDay = Utils.firstDayOfMonth(year, month); // 0=Sun

    // Adjust: week starts on Monday
    firstDay = (firstDay === 0) ? 6 : firstDay - 1;

    // Monthly classes (for indicators)
    const monthClasses = Storage.getClassesByMonth(year, month);

    grid.innerHTML = '';

    // Day of week headers
    const weekdays = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
    weekdays.forEach((d, i) => {
      const hdr = document.createElement('div');
      hdr.className = `cal-weekday${i >= 5 ? ' weekend' : ''}`;
      hdr.textContent = d;
      grid.appendChild(hdr);
    });

    // Empty cells before the 1st
    for (let i = 0; i < firstDay; i++) {
      const empty = document.createElement('div');
      empty.className = 'cal-day empty';
      grid.appendChild(empty);
    }

    const today   = Utils.toISO(new Date());

    // Build a quick lookup by date
    const byDate  = {};
    monthClasses.forEach(cls => {
      if (!byDate[cls.date]) byDate[cls.date] = [];
      byDate[cls.date].push(cls);
    });

    for (let d = 1; d <= days; d++) {
      const dateStr  = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const dayClasses = byDate[dateStr] || [];
      const isToday  = dateStr === today;
      const isSelected = dateStr === this.selectedDate;
      // 0=Sun,1=Mon...6=Sat → after first-day-Monday adjustment, day of week
      const dow      = new Date(year, month, d).getDay(); // 0=Sun,6=Sat
      const isWeekend = dow === 0 || dow === 6;

      const completed = dayClasses.filter(c => c.status === 'completed').length;
      const cancelled = dayClasses.filter(c => c.status === 'cancelled').length;
      const pending   = dayClasses.filter(c => c.status === 'pending').length;
      const totalVal  = dayClasses.reduce((s,c) => s+(c.value||0), 0);

      // Build dots
      let dotsHtml = '';
      for (let i = 0; i < Math.min(completed, 5); i++) dotsHtml += '<div class="cal-dot cal-dot-completed"></div>';
      for (let i = 0; i < Math.min(cancelled, 3); i++) dotsHtml += '<div class="cal-dot cal-dot-cancelled"></div>';
      for (let i = 0; i < Math.min(pending, 3);   i++) dotsHtml += '<div class="cal-dot cal-dot-pending"></div>';

      const cell = document.createElement('div');
      cell.className = [
        'cal-day',
        isToday    ? 'today'    : '',
        isSelected ? 'selected' : '',
        isWeekend  ? 'weekend'  : '',
      ].filter(Boolean).join(' ');
      cell.dataset.date = dateStr;

      cell.innerHTML = `
        <span class="cal-day-num">${d}</span>
        ${dayClasses.length > 0
          ? `<span class="cal-class-count">${dayClasses.length} clase${dayClasses.length !== 1 ? 's' : ''}</span>`
          : ''}
        <div class="cal-status-dots">${dotsHtml}</div>
        ${totalVal > 0 ? `<span class="cal-income">${Utils.formatCurrency(totalVal)}</span>` : ''}
      `;

      cell.addEventListener('click', () => this.selectDay(dateStr));
      grid.appendChild(cell);
    }

    // Update monthly summary
    this._updateMonthlySummary();
  },

  /* ================================================================
     SELECT A DAY → go to daily view
     ================================================================ */
  selectDay(dateStr) {
    this.selectedDate = dateStr;

    // Highlight selected cell
    document.querySelectorAll('.cal-day').forEach(c => c.classList.remove('selected'));
    const cell = document.querySelector(`.cal-day[data-date="${dateStr}"]`);
    if (cell) cell.classList.add('selected');

    // Update daily view
    const date  = Utils.fromISO(dateStr);
    const title = document.getElementById('dailyTitle');
    title.textContent = Utils.formatFull(date);

    // Render classes for this day
    Classes.renderDayTable(dateStr);

    // Show daily view
    document.getElementById('view-monthly').classList.remove('view-active');
    document.getElementById('view-monthly').classList.add('view-hidden');
    document.getElementById('view-daily').classList.remove('view-hidden');
    document.getElementById('view-daily').classList.add('view-active');
  },

  /* ================================================================
     BACK TO MONTH
     ================================================================ */
  backToMonth() {
    document.getElementById('view-daily').classList.remove('view-active');
    document.getElementById('view-daily').classList.add('view-hidden');
    document.getElementById('view-monthly').classList.remove('view-hidden');
    document.getElementById('view-monthly').classList.add('view-active');
    this.renderMonth();
  },

  /* ================================================================
     NAVIGATE MONTHS
     ================================================================ */
  prevMonth() {
    if (this.currentMonth === 0) {
      this.currentMonth = 11;
      this.currentYear--;
    } else {
      this.currentMonth--;
    }
    this.renderMonth();
  },

  nextMonth() {
    if (this.currentMonth === 11) {
      this.currentMonth = 0;
      this.currentYear++;
    } else {
      this.currentMonth++;
    }
    this.renderMonth();
  },

  goToToday() {
    const now = new Date();
    this.currentYear  = now.getFullYear();
    this.currentMonth = now.getMonth();
    this.renderMonth();
  },

  /* ================================================================
     REFRESH (after class changes)
     ================================================================ */
  refresh() {
    this.renderMonth();
  },

  refreshDay(dateStr) {
    // If daily view is showing that date, re-render
    if (this.selectedDate === dateStr) {
      Classes.renderDayTable(dateStr);
    }
    // Update the calendar cell
    const cell = document.querySelector(`.cal-day[data-date="${dateStr}"]`);
    if (cell) {
      const dayClasses = Storage.getClassesByDate(dateStr);
      const completed  = dayClasses.filter(c => c.status === 'completed').length;
      const cancelled  = dayClasses.filter(c => c.status === 'cancelled').length;
      const pending    = dayClasses.filter(c => c.status === 'pending').length;
      const totalVal   = dayClasses.reduce((s,c) => s+(c.value||0), 0);

      let dotsHtml = '';
      for (let i = 0; i < Math.min(completed, 5); i++) dotsHtml += '<div class="cal-dot cal-dot-completed"></div>';
      for (let i = 0; i < Math.min(cancelled, 3); i++) dotsHtml += '<div class="cal-dot cal-dot-cancelled"></div>';
      for (let i = 0; i < Math.min(pending, 3);   i++) dotsHtml += '<div class="cal-dot cal-dot-pending"></div>';

      const d = Utils.fromISO(dateStr).getDate();
      cell.innerHTML = `
        <span class="cal-day-num">${d}</span>
        ${dayClasses.length > 0
          ? `<span class="cal-class-count">${dayClasses.length} clase${dayClasses.length !== 1 ? 's' : ''}</span>`
          : ''}
        <div class="cal-status-dots">${dotsHtml}</div>
        ${totalVal > 0 ? `<span class="cal-income">${Utils.formatCurrency(totalVal)}</span>` : ''}
      `;
    }
    this._updateMonthlySummary();
  },

  /* ================================================================
     MONTHLY SUMMARY CARDS
     ================================================================ */
  _updateMonthlySummary() {
    const stats = Storage.getMonthStats(this.currentYear, this.currentMonth);
    const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setEl('msTotalClases',   stats.total);
    setEl('msCompletadas',   stats.completed);
    setEl('msCanceladas',    stats.cancelled);
    setEl('msTotalIngresos', Utils.formatCurrency(stats.totalValue));
    setEl('msTotalProf',     Utils.formatCurrency(stats.totalProf));
    setEl('msTotalClub',     Utils.formatCurrency(stats.totalClub));
  },

  /* ================================================================
     INIT
     ================================================================ */
  init() {
    document.getElementById('calPrev').addEventListener('click', () => this.prevMonth());
    document.getElementById('calNext').addEventListener('click', () => this.nextMonth());
    document.getElementById('calToday').addEventListener('click', () => this.goToToday());
    document.getElementById('backToMonth').addEventListener('click', () => this.backToMonth());

    this.renderMonth();
  },
};
