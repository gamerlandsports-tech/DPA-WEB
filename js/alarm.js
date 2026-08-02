/* ============================================================
   DPA — alarm.js — Motor de Alarmas, Vibración y Notificaciones
   ============================================================ */

'use strict';

const AlarmEngine = {

  enabled: true,
  audioCtx: null,
  triggeredKeys: new Set(),
  _timer: null,

  /* ================================================================
     INIT
     ================================================================ */
  init() {
    this._requestNotificationPermission();
    this._initUserAudioUnlock();
    this.startChecking();
  },

  _requestNotificationPermission() {
    if (typeof Notification !== 'undefined' && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      try {
        Notification.requestPermission();
      } catch (e) {
        console.warn('AlarmEngine: Error solicitando permiso de notificación:', e);
      }
    }
  },

  unlocked: false,
  _wakeLock: null,

  _initUserAudioUnlock() {
    const events = ['touchstart', 'touchend', 'click', 'pointerdown', 'keydown'];
    const unlock = () => {
      try {
        if (!this.audioCtx) {
          const AudioCtx = window.AudioContext || window.webkitAudioContext;
          if (AudioCtx) this.audioCtx = new AudioCtx();
        }
        if (this.audioCtx) {
          if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
          }
          // Play silent buffer source to permanently unlock mobile audio output (iOS Safari & Android Chrome)
          const buffer = this.audioCtx.createBuffer(1, 1, 22050);
          const source = this.audioCtx.createBufferSource();
          source.buffer = buffer;
          source.connect(this.audioCtx.destination);
          source.start(0);
          this.unlocked = true;
        }
      } catch (e) {
        console.warn('AlarmEngine: Error desbloqueando audio mobile:', e);
      }

      events.forEach(evt => document.removeEventListener(evt, unlock));
    };

    events.forEach(evt => document.addEventListener(evt, unlock, { passive: true, capture: true }));
  },

  /* ================================================================
     AUDIO ALARM SYNTHESIZER (Web Audio API)
     ================================================================ */
  playAlarmSound() {
    try {
      if (!this.audioCtx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) this.audioCtx = new AudioCtx();
      }

      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      if (!this.audioCtx) return;

      const now = this.audioCtx.currentTime;

      // Play double-beep patterns (Loud & Clear for Mobile Speakers)
      [0, 0.35, 0.7].forEach(delay => {
        const osc1 = this.audioCtx.createOscillator();
        const gain1 = this.audioCtx.createGain();
        osc1.type = 'triangle';
        osc1.frequency.setValueAtTime(932.33, now + delay); // Bb5
        gain1.gain.setValueAtTime(0.5, now + delay);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.18);
        osc1.connect(gain1);
        gain1.connect(this.audioCtx.destination);
        osc1.start(now + delay);
        osc1.stop(now + delay + 0.18);

        const osc2 = this.audioCtx.createOscillator();
        const gain2 = this.audioCtx.createGain();
        osc2.type = 'square';
        osc2.frequency.setValueAtTime(1396.91, now + delay + 0.18); // F6
        gain2.gain.setValueAtTime(0.4, now + delay + 0.18);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.35);
        osc2.connect(gain2);
        gain2.connect(this.audioCtx.destination);
        osc2.start(now + delay + 0.18);
        osc2.stop(now + delay + 0.35);
      });

    } catch (e) {
      console.warn('AlarmEngine: Error reproduciendo audio:', e);
    }
  },

  /* ================================================================
     VIBRATION
     ================================================================ */
  vibrate() {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate([800, 300, 800, 300, 800]);
      } catch (e) {
        console.warn('AlarmEngine: Error de vibración:', e);
      }
    }
  },

  async _requestWakeLock() {
    if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
      try {
        this._wakeLock = await navigator.wakeLock.request('screen');
      } catch (e) {}
    }
  },

  _releaseWakeLock() {
    if (this._wakeLock) {
      try { this._wakeLock.release(); } catch (e) {}
      this._wakeLock = null;
    }
  },

  /* ================================================================
     PUSH NOTIFICATION & WHATSAPP TRIGGER
     ================================================================ */
  sendNotification(title, message, waUrl = null) {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try {
        const notif = new Notification(title, {
          body: message,
          icon: '🎾',
          requireInteraction: true
        });
        if (waUrl) {
          notif.onclick = () => {
            window.open(waUrl, '_blank');
          };
        }
      } catch (e) {
        console.warn('AlarmEngine: Error en notificación push:', e);
      }
    }
  },

  /* ================================================================
     SCHEDULE CHECKER ENGINE
     ================================================================ */
  startChecking() {
    if (this._timer) clearInterval(this._timer);
    this._timer = setInterval(() => this.checkSchedule(), 15000); // Check every 15 seconds
    this.checkSchedule();
  },

  checkSchedule() {
    if (!this.enabled) return;

    const todayStr = Utils.toISO(new Date());
    const todayClasses = Storage.getClassesByDate(todayStr)
      .filter(c => c.status !== 'cancelled' && c.time)
      .sort((a, b) => Utils.timeToMinutes(a.time) - Utils.timeToMinutes(b.time));

    if (todayClasses.length === 0) return;

    // Classify targeted classes
    const targetedClasses = this._findTargetedClasses(todayClasses);

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    targetedClasses.forEach(cls => {
      const classMinutes = Utils.timeToMinutes(cls.time);
      const diffMinutes = classMinutes - currentMinutes;

      // Check windows: 30 min, 20 min, 10 min
      [30, 20, 10].forEach(targetWindow => {
        if (diffMinutes >= targetWindow - 1 && diffMinutes <= targetWindow) {
          const key = `${cls.id}_${targetWindow}_${todayStr}`;
          if (!this.triggeredKeys.has(key)) {
            this.triggeredKeys.add(key);
            this.triggerAlarm(cls, targetWindow);
          }
        }
      });
    });

    // Refresh UI to update flashing alert styles
    if (typeof Classes !== 'undefined' && App._currentSection === 'calendar') {
      Classes.renderDayTable(todayStr);
    }
  },

  _findTargetedClasses(classes) {
    if (classes.length === 0) return [];
    const targeted = [];

    // 1. First class of the day
    targeted.push(classes[0]);

    // 2. First class of the afternoon (>= 12:00 / 720 mins)
    const afternoonClass = classes.find(c => {
      const mins = Utils.timeToMinutes(c.time);
      return mins >= 720;
    });
    if (afternoonClass && !targeted.some(c => c.id === afternoonClass.id)) {
      targeted.push(afternoonClass);
    }

    // 3. Intercalated classes (gap >= 60 minutes before class)
    for (let i = 1; i < classes.length; i++) {
      const prev = classes[i - 1];
      const curr = classes[i];

      const prevStartMins = Utils.timeToMinutes(prev.time);
      const prevDuration  = prev.tipo === 'academia' ? 90 : 60;
      const prevEndMinutes = prevStartMins + prevDuration;

      const currStartMinutes = Utils.timeToMinutes(curr.time);

      if (currStartMinutes - prevEndMinutes >= 60) {
        if (!targeted.some(c => c.id === curr.id)) {
          targeted.push(curr);
        }
      }
    }

    return targeted;
  },

  /* ================================================================
     CONTINUOUS ALARM SOUND & VIBRATION LOOP (DESPERTADOR)
     ================================================================ */
  startContinuousAlarm(title, message, waUrl = null) {
    this.stopAlarm(); // Stop any previous alarm loop

    this.isPlaying = true;
    this._requestWakeLock();

    // 1. Play sound immediately and repeat every 1200ms
    this.playAlarmSound();
    this._soundLoopTimer = setInterval(() => {
      if (this.isPlaying) this.playAlarmSound();
    }, 1200);

    // 2. Vibrate immediately and repeat every 2000ms
    this.vibrate();
    this._vibrateLoopTimer = setInterval(() => {
      if (this.isPlaying) this.vibrate();
    }, 2000);

    // 3. Show Alarm Clock Modal
    const overlay = document.getElementById('alarmClockOverlay');
    const titleEl = document.getElementById('alarmClockTitle');
    const msgEl   = document.getElementById('alarmClockMessage');
    const waBtn   = document.getElementById('alarmClockWaBtn');

    if (titleEl) titleEl.textContent = title || '¡ALARMA DE CLASE!';
    if (msgEl)   msgEl.textContent = message || 'Una clase de pádel está por comenzar.';

    if (waBtn) {
      if (waUrl) {
        waBtn.href = waUrl;
        waBtn.style.display = 'inline-flex';
      } else {
        waBtn.style.display = 'none';
      }
    }

    if (overlay) overlay.classList.add('open');
  },

  stopAlarm() {
    this.isPlaying = false;
    this._releaseWakeLock();
    if (this._soundLoopTimer) {
      clearInterval(this._soundLoopTimer);
      this._soundLoopTimer = null;
    }
    if (this._vibrateLoopTimer) {
      clearInterval(this._vibrateLoopTimer);
      this._vibrateLoopTimer = null;
    }

    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate(0); } catch (e) {}
    }

    const overlay = document.getElementById('alarmClockOverlay');
    if (overlay) overlay.classList.remove('open');
  },

  triggerAlarm(cls, windowMins) {
    // 3. Prepare Notification & WhatsApp link for CLASS PROFESSOR
    const profId = cls.teacherId || Storage.getActiveTeacherId();
    const prof = profId ? Storage.getTeacher(profId) : null;
    const profName = prof ? Utils.fullName(prof.name, prof.lastName) : 'Profesor';

    const students = (cls.studentIds || [])
      .map(id => Storage.getStudent(id))
      .filter(Boolean);
    const studentNames = students.map(s => Utils.fullName(s.name, s.lastName)).join(', ') || 'Alumnos';

    let profWaUrl = null;
    if (prof && prof.phone && prof.phone.trim()) {
      const cleanPhone = prof.phone.replace(/[^0-9]/g, '');
      const msg = encodeURIComponent(`Hola Profe ${prof.name}! DPA Alerta: Tu clase de las ${cls.time} hs con ${studentNames} empieza en ${windowMins} minutos.`);
      profWaUrl = `https://wa.me/${cleanPhone}?text=${msg}`;
    }

    const title = `⏰ Alerta Profe ${profName} (${windowMins} min)`;
    const message = `La clase de las ${cls.time} hs con ${studentNames} empieza en ${windowMins} minutos.`;

    // Start continuous audio/vibration alarm loop & modal popup
    this.startContinuousAlarm(title, message, profWaUrl);

    // Send push notification
    this.sendNotification(title, message + ' Hacé clic para abrir WhatsApp.', profWaUrl);

    if (typeof App !== 'undefined' && App.showToast) {
      App.showToast(`⏰ Alarma Profe ${profName}: Clase de ${cls.time} hs en ${windowMins} min`, 'error');
    }
  },

  isUpcomingAlert(cls) {
    if (!cls || !cls.date || !cls.time || cls.status === 'cancelled') return false;
    const todayStr = Utils.toISO(new Date());
    if (cls.date !== todayStr) return false;

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const classMinutes = Utils.timeToMinutes(cls.time);

    const diff = classMinutes - currentMinutes;
    return diff >= 0 && diff <= 30;
  },

  hasUpcomingClassToday() {
    const todayStr = Utils.toISO(new Date());
    const todayClasses = Storage.getClassesByDate(todayStr);
    return todayClasses.some(c => this.isUpcomingAlert(c));
  },

  toggleEnabled() {
    this.enabled = !this.enabled;
    if (this.enabled) {
      this.playAlarmSound(); // Test chime & unlock audio on touch
    } else {
      this.stopAlarm();
    }
    const badge = document.getElementById('alarmStatusToggle');
    if (badge) {
      badge.textContent = this.enabled ? '🔔 Alarmas: ACTIVAS' : '🔕 Alarmas: DESACTIVADAS';
      badge.className = this.enabled ? 'alarm-toggle-badge active' : 'alarm-toggle-badge inactive';
    }
    if (typeof App !== 'undefined' && App.showToast) {
      App.showToast(this.enabled ? '🔔 Alarmas activadas (Sonido listo)' : '🔕 Alarmas desactivadas', 'info');
    }
  },
};

window.AlarmEngine = AlarmEngine;
