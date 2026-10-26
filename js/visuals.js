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

  function resize() {
    DPR = Math.min(LITE ? 1 : 1.5, window.devicePixelRatio || 1);
    W = Math.floor(innerWidth * DPR); H = Math.floor(innerHeight * DPR);
    cvs.width = W; cvs.height = H;
    fbA.width = W; fbA.height = H; fbB.width = W; fbB.height = H;
  }
  addEventListener('resize', resize);
  resize();

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
  function forkWindow(glows) { forkGlow = glows; }
  function bloom(side) {
    if (!forkGlow) return;
    bloomFx = { col: side === 0 ? forkGlow.a : forkGlow.b, t0: performance.now() };
  }
  function finish() { ended = true; }

  function frame(t) {
    requestAnimationFrame(frame);
    if (document.hidden) return;
    const bands = Engine.started ? Engine.bands() : { sub: 0, low: 0, mid: 0, high: 0, air: 0 };
    const tt = t / 1000;

    /* ---- 1. feedback pass: fbA → fbB, scaled/rotated/faded ---- */
    const src = fa, dst = fb;
    // fade toward bg (slightly faster fade in lite mode: shorter accumulation)
    dst.globalCompositeOperation = 'source-over';
    dst.fillStyle = `rgba(${palette.bg[0]},${palette.bg[1]},${palette.bg[2]},${ended ? 0.012 : (LITE ? 0.06 : 0.045)})`;
    dst.fillRect(0, 0, W, H);

    const scale = 1.0045 + bands.mid * 0.006;
    const rot = 0.0016 * Math.sin(tt * 0.13) + bands.low * 0.004;
    dst.save();
    dst.globalAlpha = 0.985;
    dst.translate(W / 2, H / 2);
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
    for (const o of orbs) {
      const b = bands[o.band] || 0;
      const x = W / 2 + Math.sin(tt * o.w1 + o.p1) * W * 0.31;
      const y = H / 2 + Math.cos(tt * o.w2 + o.p2) * H * 0.31;
      const rad = (0.05 + 0.11 * o.r + b * 0.4) * Math.min(W, H) * (ended ? 0.5 : 1);
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
    dst.globalCompositeOperation = 'source-over';

    /* ---- 3. present fbB (chromatic ghosts skipped in lite mode) ---- */
    vctx.clearRect(0, 0, W, H);
    vctx.drawImage(fbB, 0, 0);
    if (!LITE) {
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
    vctx.globalAlpha = 0.05;
    vctx.globalCompositeOperation = 'overlay';
    vctx.drawImage(grain, Math.random() * 40, Math.random() * 40, 120, 120, 0, 0, W, H);
    vctx.globalCompositeOperation = 'source-over';
    vctx.globalAlpha = 1;

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

  return { setPalette, melt, forkWindow, bloom, finish };
})();
