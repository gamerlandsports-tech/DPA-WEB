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

  _initUserAudioUnlock() {
    const unlock = () => {
      if (!this.audioCtx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          this.audioCtx = new AudioCtx();
        }
      } else if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
      document.removeEventListener('click', unlock);
      document.removeEventListener('touchstart', unlock);
    };
    document.addEventListener('click', unlock);
    document.addEventListener('touchstart', unlock);
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

      // Play 3 double-beep patterns
      [0, 0.4, 0.8].forEach(delay => {
        const osc1 = this.audioCtx.createOscillator();
        const gain1 = this.audioCtx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(880, now + delay); // A5
        gain1.gain.setValueAtTime(0.3, now + delay);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.15);
        osc1.connect(gain1);
        gain1.connect(this.audioCtx.destination);
        osc1.start(now + delay);
        osc1.stop(now + delay + 0.15);

        const osc2 = this.audioCtx.createOscillator();
        const gain2 = this.audioCtx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(1174.66, now + delay + 0.15); // D6
        gain2.gain.setValueAtTime(0.35, now + delay + 0.15);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.3);
        osc2.connect(gain2);
        gain2.connect(this.audioCtx.destination);
        osc2.start(now + delay + 0.15);
        osc2.stop(now + delay + 0.3);
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
        navigator.vibrate([500, 200, 500, 200, 500]);
      } catch (e) {
        console.warn('AlarmEngine: Error de vibración:', e);
      }
    }
  },

  /* ================================================================
     PUSH NOTIFICATION
     ================================================================ */
  sendNotification(title, message) {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body: message,
          icon: '🎾',
          requireInteraction: true
        });
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
    this._timer = setInterval(() => this.checkSchedule(), 20000); // Check every 20 seconds
    this.checkSchedule();
  },

  checkSchedule() {
    if (!this.enabled) return;

    const todayStr = Utils.toISO(new Date());
    const todayClasses = Storage.getClassesByDate(todayStr)
      .filter(c => c.status !== 'cancelled' && c.time)
      .sort((a, b) => a.time.localeCompare(b.time));

    if (todayClasses.length === 0) return;

    // Classify targeted classes
    const targetedClasses = this._findTargetedClasses(todayClasses);

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    targetedClasses.forEach(cls => {
      const [h, m] = cls.time.split(':').map(Number);
      const classMinutes = h * 60 + m;
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

    // 2. First class of the afternoon (>= 12:00 or 13:00)
    const afternoonClass = classes.find(c => {
      const h = parseInt(c.time.split(':')[0]) || 0;
      return h >= 13;
    });
    if (afternoonClass && !targeted.some(c => c.id === afternoonClass.id)) {
      targeted.push(afternoonClass);
    }

    // 3. Intercalated classes (gap >= 60 minutes before class)
    for (let i = 1; i < classes.length; i++) {
      const prev = classes[i - 1];
      const curr = classes[i];

      const prevDuration = prev.tipo === 'academia' ? 90 : 60;
      const prevEndMinutes = pH * 60 + pM + prevDuration;
      const currStartMinutes = cH * 60 + cM;

      if (currStartMinutes - prevEndMinutes >= 60) {
        if (!targeted.some(c => c.id === curr.id)) {
          targeted.push(curr);
        }
      }
    }

    return targeted;
  },

  triggerAlarm(cls, windowMins) {
    // 1. Audio sound
    this.playAlarmSound();

    // 2. Mobile vibration
    this.vibrate();

    // 3. Notification
    const students = (cls.studentIds || [])
      .map(id => Storage.getStudent(id))
      .filter(Boolean);
    const studentNames = students.map(s => Utils.fullName(s.name, s.lastName)).join(', ') || 'Alumnos';

    const title = `⏰ ¡Alerta de Clase (${windowMins} min)!`;
    const message = `La clase de las ${cls.time} hs (${studentNames}) empieza en ${windowMins} minutos.`;

    this.sendNotification(title, message);

    if (typeof App !== 'undefined' && App.showToast) {
      App.showToast(`⏰ Alarma: Clase de ${cls.time} hs empieza en ${windowMins} min`, 'error');
    }
  },

  isUpcomingAlert(cls) {
    if (!cls || !cls.date || !cls.time || cls.status === 'cancelled') return false;
    const todayStr = Utils.toISO(new Date());
    if (cls.date !== todayStr) return false;

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const [h, m] = cls.time.split(':').map(Number);
    const classMinutes = h * 60 + m;

    const diff = classMinutes - currentMinutes;
    return diff >= 0 && diff <= 30;
  },

  toggleEnabled() {
    this.enabled = !this.enabled;
    const badge = document.getElementById('alarmStatusToggle');
    if (badge) {
      badge.textContent = this.enabled ? '🔔 Alarmas: ACTIVAS' : '🔕 Alarmas: DESACTIVADAS';
      badge.className = this.enabled ? 'alarm-toggle-badge active' : 'alarm-toggle-badge inactive';
    }
    if (typeof App !== 'undefined' && App.showToast) {
      App.showToast(this.enabled ? '🔔 Alarmas activadas' : '🔕 Alarmas desactivadas', 'info');
    }
  },
};

window.AlarmEngine = AlarmEngine;
