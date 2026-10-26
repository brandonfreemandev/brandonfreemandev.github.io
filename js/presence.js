/* Wish Fork — presence.js
 * The body of the listener as an input: a unified presence vector.
 *   desktop  → pointer position relative to viewport centre
 *   phone    → accelerometer tilt (iOS: explicit permission toggle)
 *   both     → "energy": fast-decaying motion magnitude
 * Heavy smoothing throughout — the room leans, it doesn't twitch.
 */
window.Presence = (function () {
  'use strict';

  let px = 0, py = 0, energy = 0;   // smoothed outputs, py: up = +
  let rawX = 0, rawY = 0;
  let motionOn = false, motionSeen = false, attached = false;
  let lastAx = 0, lastAy = 0, lastAz = 0;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const isCoarse = (matchMedia && matchMedia('(pointer: coarse)').matches) ||
                   ('ontouchstart' in window);

  /* pointer (mouse, or touch-drag when motion isn't attuned) */
  addEventListener('pointermove', e => {
    if (motionOn) return;                       // accelerometer wins once attuned
    rawX = clamp((e.clientX / innerWidth) * 2 - 1, -1, 1);
    rawY = clamp(1 - (e.clientY / innerHeight) * 2, -1, 1);
  }, { passive: true, capture: true });

  /* accelerometer: tilt becomes position, rotation/shake becomes energy */
  function onMotion(e) {
    const a = e.accelerationIncludingGravity;
    if (!a || (a.x === null && a.y === null)) return;
    motionSeen = true;
    // portrait-held phone: x+ = right edge, gravity reads negative when
    // tilted that way — lean left → px < 0 → the mix leans left
    rawX = clamp(a.x / 9.81, -1, 1);
    // upright ≈ slightly open (+0.5), flat on a table ≈ slightly dark (−0.5)
    rawY = clamp(a.y / 9.81 - 0.5, -1, 1);
    let inp = 0;
    const r = e.rotationRate;
    if (r) inp = Math.max(Math.abs(r.alpha || 0), Math.abs(r.beta || 0), Math.abs(r.gamma || 0)) / 120;
    const d = Math.abs(a.x - lastAx) + Math.abs(a.y - lastAy) + Math.abs(a.z - lastAz);
    inp = Math.max(inp, d / 8);
    energy = clamp(energy + inp * 0.25, 0, 1);
    lastAx = a.x; lastAy = a.y; lastAz = a.z;
  }

  function attach() {
    if (attached) return;
    attached = true; motionOn = true;
    addEventListener('devicemotion', onMotion, { passive: true });
  }

  /* call from a user gesture (the toggle) — iOS requires it */
  function enable(cb) {
    const DME = window.DeviceMotionEvent;
    if (!DME) return cb(false, 'unavailable');
    if (typeof DME.requestPermission === 'function') {
      DME.requestPermission()
        .then(s => { if (s === 'granted') { attach(); cb(true, 'granted'); } else cb(false, 'denied'); })
        .catch(() => cb(false, 'denied'));
    } else { attach(); cb(true, 'granted'); }
  }
  function disable() {
    if (!attached) return;
    attached = false; motionOn = false; motionSeen = false;
    removeEventListener('devicemotion', onMotion);
    rawX = 0; rawY = 0;
  }

  function tick() {
    px += (rawX - px) * 0.06;
    py += (rawY - py) * 0.06;
    energy *= 0.94;
  }

  return {
    tick, enable, disable,
    get px() { return px; },
    get py() { return py; },
    get energy() { return energy; },
    get motionCapable() { return typeof window.DeviceMotionEvent !== 'undefined' && isCoarse; },
    get motionActive() { return motionOn && motionSeen; }
  };
})();
