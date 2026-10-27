/* Wish Fork — presence.js
 * The body of the listener as an input — pointer only, zero sensors:
 *   position → where the pointer rests (mouse on desktop, touch-drag on phone)
 *   energy   → how fast it moves (fast decay)
 * Heavy smoothing throughout — the room leans, it doesn't twitch.
 *
 * (An accelerometer tilt mode existed briefly; it kept main-thread wakeups
 * at sensor rate and janked mid-range phones, so it was removed.)
 */
window.Presence = (function () {
  'use strict';

  let px = 0, py = 0, energy = 0;   // smoothed outputs, py: up = +
  let rawX = 0, rawY = 0;
  let lx = null, ly = null;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  addEventListener('pointermove', e => {
    if (lx !== null) {
      const d = Math.min(1, Math.hypot(e.clientX - lx, e.clientY - ly) / 40);
      energy = clamp(energy + d * 0.12, 0, 1);
    }
    lx = e.clientX; ly = e.clientY;
    rawX = clamp((e.clientX / innerWidth) * 2 - 1, -1, 1);
    rawY = clamp(1 - (e.clientY / innerHeight) * 2, -1, 1);
  }, { passive: true, capture: true });

  function tick() {
    px += (rawX - px) * 0.06;
    py += (rawY - py) * 0.06;
    energy *= 0.94;
  }

  return {
    tick,
    get px() { return px; },
    get py() { return py; },
    get energy() { return energy; }
  };
})();
