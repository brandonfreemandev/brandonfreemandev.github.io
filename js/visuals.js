/* Wish Fork — visuals.js
 * The melted optical feed: ping-pong canvas feedback (scale/rotate/shear),
 * wandering light orbs driven by analyser bands, grain, vignette,
 * cheap chromatic ghosts, and fork-edge glows.
 */
window.Visuals = (function () {
  'use strict';

  const cvs = document.getElementById('veil');
  const vctx = cvs.getContext('2d');
  let fbA = document.createElement('canvas');
  let fbB = document.createElement('canvas');
  let fa = fbA.getContext('2d'), fb = fbB.getContext('2d');
  let W = 0, H = 0, DPR = 1;

  let palette = { bg: [7, 6, 15], cols: [[58, 58, 110], [123, 99, 144], [192, 143, 187], [243, 211, 216]] };
  let curPalName = 'sleep';

  let shear = 0;             // bend-pulse melt amount, decays
  let forkGlow = null;       // {a:[r,g,b], b:[r,g,b]}
  let bloomFx = null;        // {col:[r,g,b], t0}
  let ended = false;
  const pres = { x: 0, y: 0, e: 0 };   // listener presence, set from main tick

  const LITE = !!(window.Engine && Engine.lite);
  const ORB_COUNT = LITE ? 4 : 7;

  const orbs = [];
  for (let i = 0; i < ORB_COUNT; i++) {
    orbs.push({
      w1: .05 + Math.random() * .07, w2: .04 + Math.random() * .07,
      p1: Math.random() * 9, p2: Math.random() * 9,
      r: .12 + Math.random() * .3, ci: 1 + Math.floor(Math.random() * 3),
      band: ['sub', 'low', 'mid', 'high', 'air'][i % 5]
    });
  }

  function hex2rgb(h) {
    return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  }
  function setPalette(name) {
    const P = SEG.PALETTES[name];
    if (!P || name === curPalName) return;
    curPalName = name;
    palette = { bg: hex2rgb(P[0]), cols: P.slice(1).map(hex2rgb) };
  }

  /* Rotation without the hiccup:
   *  - reallocation is debounced until the turn settles (~a third of a
   *    second); meanwhile the CSS box simply stretches the old bitmap,
   *    which the browser composites on the GPU — no jank, and a stretched
   *    light-field is on-brand
   *  - when we do reallocate, the accumulated feedback image is carried
   *    over stretched into the new frames — the turn reads as a dissolve,
   *    never a wipe
   *  - for ~0.7 s around the turn the renderer does its cheapest frames,
   *    staying out of the way of the OS rotation compositing (this is what
   *    protected the audio from main-thread starvation clicks) */
  let resizeTimer = 0, resizes = 0, quietUntil = 0;

  function applyResize() {
    const dpr = Math.min(LITE ? 1 : 1.5, window.devicePixelRatio || 1);
    const w2 = Math.floor(innerWidth * dpr), h2 = Math.floor(innerHeight * dpr);
    if (w2 === W && h2 === H) return;

    let snap = null;
    if (W > 0 && H > 0) {
      snap = document.createElement('canvas');
      snap.width = W; snap.height = H;
      snap.getContext('2d').drawImage(fbA, 0, 0);
    }
    DPR = dpr; W = w2; H = h2;
    cvs.width = W; cvs.height = H;
    fbA.width = W; fbA.height = H; fbB.width = W; fbB.height = H;
    if (snap) {
      fa.drawImage(snap, 0, 0, W, H);
      fb.drawImage(snap, 0, 0, W, H);
      // a real turn (not the initial layout): the piece takes a soft breath
      if (window.Engine && Engine.started && typeof Engine.breathe === 'function') Engine.breathe();
    }
    resizes++;
    quietUntil = performance.now() + 700;
  }
  addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(applyResize, 320);
  });
  applyResize();

  /* noise tile for grain */
  const grain = document.createElement('canvas');
  grain.width = grain.height = 160;
  (function () {
    const g = grain.getContext('2d');
    const id = g.createImageData(160, 160);
    for (let i = 0; i < id.data.length; i += 4) {
      const v = 120 + Math.random() * 135;
      id.data[i] = id.data[i + 1] = id.data[i + 2] = v;
      id.data[i + 3] = 255;
    }
    g.putImageData(id, 0, 0);
  })();

  function melt(amt) { shear = Math.min(1.4, shear + amt * 0.35); }
  function setPresence(x, y, e) { pres.x = x; pres.y = y; pres.e = e; }
  function forkWindow(glows) { forkGlow = glows; }
  function bloom(side) {
    if (!forkGlow) return;
    bloomFx = { col: side === 0 ? forkGlow.a : forkGlow.b, t0: performance.now() };
  }
  function finish() { ended = true; }

  function frame(t) {
    requestAnimationFrame(frame);
    if (document.hidden) return;
    const quiet = performance.now() < quietUntil;   // cheapest frames during a turn
    const bands = Engine.started ? Engine.bands() : { sub: 0, low: 0, mid: 0, high: 0, air: 0 };
    const tt = t / 1000;

    /* ---- 1. feedback pass: fbA → fbB, scaled/rotated/faded ---- */
    const src = fa, dst = fb;
    // fade toward bg (slightly faster fade in lite mode: shorter accumulation)
    dst.globalCompositeOperation = 'source-over';
    dst.fillStyle = `rgba(${palette.bg[0]},${palette.bg[1]},${palette.bg[2]},${ended ? 0.012 : (LITE ? 0.06 : 0.045)})`;
    dst.fillRect(0, 0, W, H);

    const scale = 1.0045 + bands.mid * 0.006;
    const rot = 0.0016 * Math.sin(tt * 0.13) + bands.low * 0.004 + pres.x * 0.0035;
    dst.save();
    dst.globalAlpha = 0.985;
    // the field leans and drifts with the listener's presence
    dst.translate(W / 2 + pres.x * W * 0.018, H / 2 - pres.y * H * 0.014);
    dst.rotate(rot);
    dst.scale(scale, scale);
    dst.translate(-W / 2, -H / 2);
    dst.drawImage(fbA, 0, 0);
    dst.restore();

    // horizontal melt: slice shear when bends pulse
    if (shear > 0.02) {
      const slices = 22, sh = H / slices;
      for (let i = 0; i < slices; i++) {
        const dx = shear * 16 * DPR * Math.sin(i * 0.7 + tt * 3.1);
        dst.drawImage(fbB, 0, i * sh, W, sh, dx, i * sh, W, sh);
      }
      shear *= 0.9;
    }
    dst.globalAlpha = 1;

    /* ---- 2. paint light orbs (also faintly stamped into feedback) ---- */
    dst.globalCompositeOperation = 'lighter';
    const stride = quiet ? 2 : 1;                    // half the orbs during a turn
    for (let oi = 0; oi < orbs.length; oi += stride) {
      const o = orbs[oi];
      const b = bands[o.band] || 0;
      const x = W / 2 + Math.sin(tt * o.w1 + o.p1) * W * 0.31 + pres.x * W * 0.05;
      const y = H / 2 + Math.cos(tt * o.w2 + o.p2) * H * 0.31 - pres.y * H * 0.05;
      const rad = (0.05 + 0.11 * o.r + b * 0.4) * Math.min(W, H) *
                  (ended ? 0.5 : 1) * (1 + pres.e * 0.3);
      const c = palette.cols[o.ci % palette.cols.length];
      const g = dst.createRadialGradient(x, y, 0, x, y, Math.max(4, rad));
      const a = 0.05 + b * 0.4;
      g.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},${a.toFixed(3)})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      dst.fillStyle = g;
      dst.beginPath(); dst.arc(x, y, Math.max(4, rad), 0, 7); dst.fill();
    }

    // fork bloom burst
    if (bloomFx) {
      const age = (performance.now() - bloomFx.t0) / 900;
      if (age < 1) {
        const c = bloomFx.col;
        const g = dst.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.min(W, H) * (0.2 + age * 0.6));
        g.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},${(0.5 * (1 - age)).toFixed(3)})`);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        dst.fillStyle = g;
        dst.fillRect(0, 0, W, H);
      } else bloomFx = null;
    }

    // sustained fast motion keeps the image liquid
    if (pres.e > 0.5 && !quiet) melt(pres.e * 0.45);

    dst.globalCompositeOperation = 'source-over';

    /* ---- 3. present fbB (chromatic ghosts skipped in lite mode / turns) ---- */
    vctx.clearRect(0, 0, W, H);
    vctx.drawImage(fbB, 0, 0);
    if (!LITE && !quiet) {
      const off = 1.4 * DPR + bands.high * 3 * DPR;
      vctx.globalCompositeOperation = 'lighter';
      vctx.globalAlpha = 0.1 + bands.high * 0.12;
      vctx.drawImage(fbB, -off, 0);
      vctx.drawImage(fbB, off, off * 0.4);
      vctx.globalAlpha = 1;
    }

    /* ---- 4. fork window glows on the edges ---- */
    if (forkGlow) {
      const pulse = 0.16 + 0.1 * Math.sin(tt * 2.2);
      const edge = (col, side) => {
        const g = vctx.createLinearGradient(side === 0 ? 0 : W, 0, side === 0 ? W * 0.3 : W * 0.7, 0);
        g.addColorStop(0, `rgba(${col[0]},${col[1]},${col[2]},${pulse})`);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        vctx.fillStyle = g;
        vctx.fillRect(0, 0, W, H);
      };
      vctx.globalCompositeOperation = 'screen';
      edge(forkGlow.a, 0); edge(forkGlow.b, 1);
      vctx.globalCompositeOperation = 'source-over';
    }

    /* ---- 5. grain + vignette ---- */
    if (!quiet) {
      vctx.globalAlpha = 0.05;
      vctx.globalCompositeOperation = 'overlay';
      vctx.drawImage(grain, Math.random() * 40, Math.random() * 40, 120, 120, 0, 0, W, H);
      vctx.globalCompositeOperation = 'source-over';
      vctx.globalAlpha = 1;
    }

    const vg = vctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(2,1,5,0.55)');
    vctx.fillStyle = vg;
    vctx.fillRect(0, 0, W, H);

    /* ---- swap ping-pong ---- */
    const tmp = fbA; fbA = fbB; fbB = tmp;
    const tc = fa; fa = fb; fb = tc;
  }
  requestAnimationFrame(frame);

  return {
    setPalette, melt, setPresence, forkWindow, bloom, finish,
    get resizes() { return resizes; },
    get quiet() { return performance.now() < quietUntil; }
  };
})();
