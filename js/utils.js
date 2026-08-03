/* ============================================================
   DPA — utils.js — Funciones utilitarias globales
   ============================================================ */

'use strict';

const Utils = {

  /* ---- ID Generation ---- */
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  },
  uid() {
    return this.generateId();
  },

  /* ---- Date Formatting ---- */
  MONTHS_ES: [
    'enero','febrero','marzo','abril','mayo','junio',
    'julio','agosto','septiembre','octubre','noviembre','diciembre'
  ],
  DAYS_ES: ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'],
  DAYS_SHORT: ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'],

  /**
   * Returns "yyyy-mm-dd" from a Date object
   */
  toISO(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  },

  /**
   * Returns a Date object from "yyyy-mm-dd" string (local time)
   */
  fromISO(str) {
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d);
  },

  /**
   * "lunes 1 de agosto de 2026"
   */
  formatFull(dateOrStr) {
    const date = typeof dateOrStr === 'string' ? this.fromISO(dateOrStr) : dateOrStr;
    const day  = this.DAYS_ES[date.getDay()];
    const num  = date.getDate();
    const mon  = this.MONTHS_ES[date.getMonth()];
    const yr   = date.getFullYear();
    return `${day} ${num} de ${mon} de ${yr}`;
  },

  /**
   * "1 ago" – short format for table cells
   */
  formatShort(dateOrStr) {
    const date = typeof dateOrStr === 'string' ? this.fromISO(dateOrStr) : dateOrStr;
    return `${date.getDate()} ${this.MONTHS_ES[date.getMonth()].substr(0, 3)}`;
  },

  /**
   * "Lunes 1 de agosto"
   */
  formatLong(dateOrStr) {
    const date = typeof dateOrStr === 'string' ? this.fromISO(dateOrStr) : dateOrStr;
    const day  = this.DAYS_ES[date.getDay()];
    const num  = date.getDate();
    const mon  = this.MONTHS_ES[date.getMonth()];
    const capDay = day.charAt(0).toUpperCase() + day.slice(1);
    return `${capDay} ${num} de ${mon}`;
  },

  /**
   * "agosto 2026" – month + year
   */
  formatMonth(year, month) {
    return `${this.MONTHS_ES[month]} ${year}`;
  },

  /* ---- Time Slots ---- */
  /**
   * Generates time slot strings based on settings
   * @param {number} startHour – e.g. 7
   * @param {number} endHour   – e.g. 22
   * @param {number} interval  – minutes: 30 or 60
   * @returns {string[]}       – ["7:00 AM", "7:30 AM", ...]
   */
  generateTimeSlots(startHour = 7, endHour = 22, interval = 30) {
    const slots = [];
    let totalMins = startHour * 60;
    const endMins  = endHour  * 60;
    while (totalMins <= endMins) {
      const h24 = Math.floor(totalMins / 60);
      const m   = totalMins % 60;
      const ampm = h24 < 12 ? 'AM' : 'PM';
      const h12  = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
      slots.push(`${h12}:${String(m).padStart(2, '0')} ${ampm}`);
      totalMins += interval;
    }
    return slots;
  },

  /* ---- Currency ---- */
  formatCurrency(amount) {
    if (amount === null || amount === undefined || isNaN(amount)) return '$0';
    return '$' + Math.round(Number(amount)).toLocaleString('es-AR');
  },

  /* ---- Name initials ---- */
  initials(name, lastName) {
    const n = (name || '').trim()[0] || '';
    const l = (lastName || '').trim()[0] || '';
    return (n + l).toUpperCase() || '??';
  },

  /* ---- Full name ---- */
  fullName(name, lastName) {
    return [name, lastName].filter(Boolean).join(' ');
  },

  /* ---- Calculate class value ---- */
  /**
   * @param {string} tipo         – 'individual' | 'grupal' | 'academia'
   * @param {number} persons      – number of people
   * @param {object} settings     – DPA settings object
   * @returns {{ total, prof, club }}
   */
  calcValue(tipo, persons, settings) {
    const pct = (settings.profPercentage || 50) / 100;
    let total = 0;

    if (tipo === 'individual') {
      total = Number(settings.prices.individual) || 0;
    } else if (tipo === 'grupal') {
      const grupalPrices = settings.prices.grupal || {};
      const key = String(persons);
      // Try exact match; fallback to highest available
      if (grupalPrices[key] !== undefined) {
        total = Number(grupalPrices[key]);
      } else {
        // Fallback: use last defined price
        const keys = Object.keys(grupalPrices).map(Number).sort((a,b) => a-b);
        const match = keys.filter(k => k <= persons).pop() || keys[0];
        total = match !== undefined ? Number(grupalPrices[String(match)]) : 0;
      }
    } else if (tipo === 'academia') {
      total = (Number(settings.prices.academia) || 0) * (persons || 1);
    }

    const prof = Math.round(total * pct);
    const club = total - prof;
    return { total, prof, club };
  },

  /* ---- Capitalize ---- */
  capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  },

  /* ---- Debounce ---- */
  debounce(fn, delay) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  },

  /* ---- Pluralize (Spanish simple) ---- */
  plural(n, singular, plural) {
    return n === 1 ? `${n} ${singular}` : `${n} ${plural}`;
  },

  /* ---- Get days in month ---- */
  daysInMonth(year, month) {
    return new Date(year, month + 1, 0).getDate();
  },

  /* ---- First day of month (0=Sun) ---- */
  firstDayOfMonth(year, month) {
    return new Date(year, month, 1).getDay();
  },

  /* ---- Is today ---- */
  isToday(dateStr) {
    return dateStr === this.toISO(new Date());
  },

  /* ---- Convert time string to total minutes ---- */
  timeToMinutes(t) {
    if (!t) return 0;
    const match = t.match(/(\d+):(\d+)\s*(AM|PM)?/i);
    if (!match) return 0;
    let h = parseInt(match[1]);
    const m = parseInt(match[2]);
    const ampm = match[3] ? match[3].toUpperCase() : null;
    if (ampm) {
      if (ampm === 'PM' && h !== 12) h += 12;
      if (ampm === 'AM' && h === 12) h = 0;
    }
    return h * 60 + m;
  },

  /* ---- Sort classes by date and time ---- */
  sortByDateTime(classes, ascending = true) {
    return [...classes].sort((a, b) => {
      const dateA = a.date || '';
      const dateB = b.date || '';
      if (dateA !== dateB) {
        return ascending ? dateA.localeCompare(dateB) : dateB.localeCompare(dateA);
      }
      const minA = this.timeToMinutes(a.time);
      const minB = this.timeToMinutes(b.time);
      return ascending ? minA - minB : minB - minA;
    });
  },

  /* ---- Sort classes by time ---- */
  sortByTime(classes) {
    return [...classes].sort((a, b) => this.timeToMinutes(a.time) - this.timeToMinutes(b.time));
  }
};

