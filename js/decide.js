/* Wish Fork — decide.js
 * Deterministic seeds, environment sensing (hour, optional weather),
 * passive behavioral cues (pointer stillness, tab presence),
 * and the auto-decision function used when the listener drifts.
 */
window.Decide = (function () {
  'use strict';

  /* ---------- deterministic randomness ---------- */

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hashStr(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  /* ---------- seed / journey URL ---------- */

  const Hash = {
    parse() {
      const h = location.hash.replace(/^#/, '');
      const out = { seed: null, choices: null, env: null };
      if (!h) return out;
      h.split('&').forEach(kv => {
        const [k, v] = kv.split('=');
        if (k === 's') out.seed = decodeURIComponent(v);
        if (k === 'c') out.choices = v.split('').map(ch => (ch === '1' ? 1 : 0));
        if (k === 'e') out.env = decodeURIComponent(v);
      });
      return out;
    },
    build(seed, choices, envPhase) {
      return '#s=' + encodeURIComponent(seed) +
        '&c=' + choices.join('') +
        '&e=' + encodeURIComponent(envPhase);
    }
  };

  function randomSeed() {
    return Array.from(crypto.getRandomValues(new Uint8Array(4)))
      .map(b => (b % 36).toString(36)).join('').toUpperCase();
  }

  /* ---------- environment ---------- */

  const Env = {
    phase: 'day',
    hour: new Date().getHours(),
    tempC: null,
    tempSource: 'unattuned', // 'live' | 'simulated' | 'unattuned'
    attuning: false,

    init() {
      const h = this.hour;
      this.phase = (h >= 4 && h < 7) ? 'dawn' : (h >= 7 && h < 17) ? 'day' : (h >= 17 && h < 22) ? 'dusk' : 'night';
    },

    /* Optional attunement: real local temperature via open-meteo (no key).
     * Falls back to a seeded simulated sensor so the piece never breaks offline. */
    attune(seed, cb) {
      if (this.attuning) return;
      this.attuning = true;
      const fallback = () => {
        const rng = mulberry32(hashStr(seed + ':sensor'));
        this.tempC = Math.round(6 + rng() * 22);
        this.tempSource = 'simulated';
        this.attuning = false;
        cb && cb(this);
      };
      const to = setTimeout(fallback, 7000);
      if (!navigator.geolocation) { clearTimeout(to); return fallback(); }
      navigator.geolocation.getCurrentPosition(pos => {
        const { latitude, longitude } = pos.coords;
        fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude.toFixed(3)}&longitude=${longitude.toFixed(3)}&current=temperature_2m`)
          .then(r => r.json())
          .then(j => {
            clearTimeout(to);
            this.tempC = Math.round(j.current.temperature_2m);
            this.tempSource = 'live';
            this.attuning = false;
            cb && cb(this);
          })
          .catch(() => { clearTimeout(to); fallback(); });
      }, () => { clearTimeout(to); fallback(); }, { timeout: 6000 });
    },

    describe() {
      const glyphs = { night: '☾ night', dawn: '✧ dawn', day: '☀ day', dusk: '◔ dusk' };
      let s = glyphs[this.phase] || this.phase;
      if (this.tempC !== null) s += `  ${this.tempC}°C`;
      return s;
    }
  };

  /* ---------- passive behavior ---------- */

  const Behavior = {
    lastMove: performance.now(),
    lastX: null, lastY: null,
    speed: 0,          // EMA of pointer velocity (0..~2)
    stillness: 1,      // 0 restless .. 1 perfectly still (slow EMA)
    hidden: false,
    hiddenAt: 0,
    awayFor: 0,

    init() {
      const move = (x, y) => {
        const t = performance.now();
        if (this.lastX !== null) {
          const d = (Math.abs(x - this.lastX) + Math.abs(y - this.lastY)) / 40;
          this.speed = this.speed * 0.88 + Math.min(3, d) * 0.12;
        }
        this.lastX = x; this.lastY = y;
        this.lastMove = t;
      };
      addEventListener('pointermove', e => move(e.clientX, e.clientY), { passive: true, capture: true });
      addEventListener('pointerdown', e => move(e.clientX, e.clientY), { passive: true, capture: true });
      addEventListener('keydown', () => { this.lastMove = performance.now(); }, true);
      addEventListener('touchstart', e => {
        const t = e.touches[0]; if (t) move(t.clientX, t.clientY);
      }, { passive: true, capture: true });
      document.addEventListener('visibilitychange', () => {
        this.hidden = document.hidden;
        if (this.hidden) this.hiddenAt = performance.now();
        else this.awayFor = performance.now() - this.hiddenAt;
      });
    },

    /* called ~10×/s from the main tick */
    tick() {
      const idle = (performance.now() - this.lastMove) / 1000;
      const motion = Math.max(0, 1 - this.speed * 0.9);
      const inst = Math.min(1, motion * Math.min(1, 0.25 + idle / 7));
      this.stillness += (inst - this.stillness) * 0.03;
      this.speed *= 0.99;
    }
  };

  /* ---------- the auto-decision ----------
   * Called when a fork deadline passes with no human choice.
   * Contributions are scored; the largest decides both the branch
   * and the "reason" shown to the listener. Deterministic given
   * seed + fork index + environment snapshot.
   */

  function autoDecide(fork, forkIndex, seed, env, behav, absent) {
    const rng = mulberry32(hashStr(seed + '#' + forkIndex));
    const s = [rng() * 0.9, rng() * 0.9];
    const contrib = [{ label: 'the seed', amt: 0 }, { label: 'the seed', amt: 0 }];
    const add = (i, amt, label) => { s[i] += amt; if (amt > contrib[i].amt) contrib[i] = { label, amt }; };

    const A = fork.a, B = fork.b;
    const br = [A, B];

    // passive behavior: stillness sinks, restlessness sparks
    if (absent) {
      const i = (A.energy <= B.energy) ? 0 : 1;
      add(i, 2.0, 'your absence');
    } else if (behav.stillness > 0.62) {
      const i = (A.energy <= B.energy) ? 0 : 1;
      add(i, 1.4 + behav.stillness * 0.6, 'your stillness');
    } else if (behav.stillness < 0.35) {
      const i = (A.energy >= B.energy) ? 0 : 1;
      add(i, 1.4 + (1 - behav.stillness) * 0.6, 'your restlessness');
    }

    // hour of day
    if (env.phase === 'night') {
      add(0, A.dark * 1.3, 'the night'); add(1, B.dark * 1.3, 'the night');
    } else if (env.phase === 'dawn') {
      add(0, (1 - A.dark) * 1.3, 'the dawn'); add(1, (1 - B.dark) * 1.3, 'the dawn');
    } else if (env.phase === 'day') {
      add(0, (1 - A.dark) * 0.7, 'the daylight'); add(1, (1 - B.dark) * 0.7, 'the daylight');
    } else { // dusk
      add(0, 0.35 + A.dark * 0.5, 'the dusk'); add(1, 0.35 + B.dark * 0.5, 'the dusk');
    }

    // temperature (live, or simulated sensor)
    if (env.tempC !== null) {
      if (env.tempC <= 8) {
        add(0, A.cold * 1.6, 'the cold'); add(1, B.cold * 1.6, 'the cold');
      } else if (env.tempC >= 26) {
        add(0, (1 - A.cold) * 1.6, 'the heat'); add(1, (1 - B.cold) * 1.6, 'the heat');
      }
    }

    let pick = s[0] === s[1] ? (rng() < 0.5 ? 0 : 1) : (s[0] > s[1] ? 0 : 1);
    let reason = Math.abs(s[0] - s[1]) < 0.25 ? 'the seed' : contrib[pick].label;
    if (absent) reason = 'your absence';
    return { pick, reason };
  }

  return { mulberry32, hashStr, Hash, randomSeed, Env, Behavior, autoDecide };
})();
