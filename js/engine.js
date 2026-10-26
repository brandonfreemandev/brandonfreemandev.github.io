/* Wish Fork — engine.js
 * All-synthesis Web Audio engine. No samples.
 *
 * Signature chain (the "Blown a Wish" posture):
 *   pads: detuned saw/triangle stacks → per-note bend LFOs on detune (pitch-bent),
 *         portamento glide between chords (the smeared glide-guitar analogue),
 *         lowpass wobble → tanh fuzz waveshaper
 *   voice: sine + partial, delayed vibrato, parallel formant bandpasses, drowned in shimmer
 *   glitch: 16th-grid probabilistic ticks / grains / soft thumps / stutters (micro-IDM)
 *   sub: slow sine drone
 *   space: two generated convolution IRs + a shimmer feedback path
 *   master: tape wow/flutter delay → soft clip → compressor → analyser
 */
window.Engine = (function () {
  'use strict';

  const AC = window.AudioContext || window.webkitAudioContext;

  /* lite mode: phones / weak cores / Bluetooth — smaller IRs, fewer
   * oscillators, thinner visuals. Prevents the underrun crackle. */
  const LITE = (function () {
    const ua = navigator.userAgent;
    const mobile = /Android|iPhone|iPad|iPod/i.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const cores = navigator.hardwareConcurrency || 4;
    const mem = navigator.deviceMemory;
    return mobile || cores <= 4 || (mem && mem <= 4);
  })();

  let ctx = null;
  let sum, tape, soft, comp, master, analyser, breath;
  let convA, convB, shimHP, shimDelay, shimFB, shimOut, shimTrim;
  let tilt, padTilt;
  const bus = {}; // pad, voice, glitch, sub — each: {in, duck, dry, rev, shim}
  const curveCache = {};
  const noiseB = { buf: null };
  const pulses = [];
  const cur = {  // live param state (ramped by applyParams)
    padLvl: .9, voiceLvl: .7, glitchLvl: .8, subLvl: .5,
    padDry: .8, padRev: .9, padShim: .35,
    voxDry: .25, voxRev: 1, voxShim: .8,
    gliDry: .9, gliRev: .35, gliShim: .15
  };
  const padPrev = []; // last frequency per voice slot → portamento glide

  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

  function fuzzCurve(d) {
    const k = String(Math.round(d * 10));
    if (curveCache[k]) return curveCache[k];
    const n = 1024, c = new Float32Array(n), norm = Math.tanh(d);
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      c[i] = Math.tanh(d * x) / norm;
    }
    return curveCache[k] = c;
  }
  function crushCurve(lv) {
    const k = 'c' + lv;
    if (curveCache[k]) return curveCache[k];
    const n = 512, c = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      c[i] = Math.round(x * lv) / lv;
    }
    return curveCache[k] = c;
  }
  function mkOsc(f, type) {
    const o = ctx.createOscillator();
    o.type = type || 'sine'; o.frequency.value = f;
    return o;
  }
  function noiseBuffer() {
    if (noiseB.buf) return noiseB.buf;
    const len = ctx.sampleRate * 2, b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    return noiseB.buf = b;
  }
  /* exponentially-decaying, lowpassed noise IR — deep cathedral tail */
  function makeIR(sec, pow) {
    const len = Math.floor(ctx.sampleRate * sec);
    const b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      let last = 0;
      for (let i = 0; i < len; i++) {
        const e = Math.pow(1 - i / len, pow);
        last = last * 0.74 + (Math.random() * 2 - 1) * 0.26;
        d[i] = last * e;
      }
    }
    return b;
  }

  function init() {
    if (ctx) return;
    // 'playback' requests large output buffers: the single biggest cure for
    // Bluetooth / phone crackle (underruns). Latency is irrelevant here.
    try { ctx = new AC({ latencyHint: 'playback' }); }
    catch (e) { ctx = new AC(); }

    // Bluetooth/device changes or iOS interruptions can suspend the graph;
    // recover it instead of letting it die crackling.
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && ctx && ctx.state !== 'running') ctx.resume().catch(() => {});
    });
    if ('onstatechange' in ctx) {
      ctx.onstatechange = () => {
        if (ctx && (ctx.state === 'suspended' || ctx.state === 'interrupted') &&
            master && master.gain.value > 0.001) ctx.resume().catch(() => {});
      };
    }

    // master path: sum → tape(wow) → softclip → comp → master → analyser → out
    sum = ctx.createGain(); sum.gain.value = 1;
    tape = ctx.createDelay(0.2); tape.delayTime.value = 0.02;
    const wow = mkOsc(0.37, 'sine'), wowG = ctx.createGain(); wowG.gain.value = 0.0013;
    const flut = mkOsc(5.3, 'sine'), flutG = ctx.createGain(); flutG.gain.value = LITE ? 0 : 0.00034;
    wow.connect(wowG); wowG.connect(tape.delayTime);
    flut.connect(flutG); flutG.connect(tape.delayTime);
    soft = ctx.createWaveShaper(); soft.curve = fuzzCurve(1.35);
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -20; comp.knee.value = 14; comp.ratio.value = 3;
    comp.attack.value = 0.012; comp.release.value = 0.32;
    master = ctx.createGain(); master.gain.value = 0;
    analyser = ctx.createAnalyser();
    analyser.fftSize = 2048; analyser.smoothingTimeConstant = 0.85;

    sum.connect(tape); tape.connect(soft); soft.connect(comp);
    // presence pan: lean left, the wall leans left
    tilt = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (tilt) { comp.connect(tilt); tilt.connect(master); }
    else comp.connect(master);
    breath = ctx.createGain(); breath.gain.value = 1;
    master.connect(breath); breath.connect(analyser);
    analyser.connect(ctx.destination);
    wow.start(); flut.start();

    // reverb A — long hall (shorter tail in lite mode)
    convA = ctx.createConvolver(); convA.buffer = makeIR(LITE ? 3.4 : 7.5, 2.6);
    const revInA = ctx.createGain(); revInA.gain.value = 1;
    revInA.connect(convA); convA.connect(sum);

    // shimmer path — bright short IR + modulated feedback delay
    shimHP = ctx.createBiquadFilter(); shimHP.type = 'highpass';
    shimHP.frequency.value = LITE ? 2200 : 1800;
    convB = ctx.createConvolver(); convB.buffer = makeIR(LITE ? 1.5 : 2.6, 1.6);
    shimDelay = ctx.createDelay(2); shimDelay.delayTime.value = 0.55;
    const shimMod = mkOsc(0.09, 'sine'), shimModG = ctx.createGain(); shimModG.gain.value = 0.04;
    shimMod.connect(shimModG); shimModG.connect(shimDelay.delayTime); shimMod.start();
    shimFB = ctx.createGain(); shimFB.gain.value = LITE ? 0.6 : 0.7;
    shimOut = ctx.createGain(); shimOut.gain.value = 0.9;
    shimTrim = ctx.createGain(); shimTrim.gain.value = 1;   // presence lifts this
    shimHP.connect(convB); convB.connect(shimOut); shimOut.connect(sum);
    convB.connect(shimDelay); shimDelay.connect(shimFB); shimFB.connect(shimHP);

    // buses — lvl (moment level) and duck (thump dips) are SEPARATE params:
    // never cancel each other's automation (that snap was a pop source).
    // an optional insert sits between duck and the sends (pads get the
    // presence tilt-filter).
    const mkBus = (insert) => {
      const input = ctx.createGain();
      const lvl = ctx.createGain(); lvl.gain.value = 0;
      const duck = ctx.createGain(); duck.gain.value = 1;
      const dry = ctx.createGain(), rev = ctx.createGain(), shim = ctx.createGain();
      input.connect(lvl); lvl.connect(duck);
      dry.connect(sum); rev.connect(revInA); shim.connect(shimTrim);
      const post = insert || duck;
      if (insert) duck.connect(insert);
      post.connect(dry); post.connect(rev); post.connect(shim);
      return { in: input, lvl, duck, dry, rev, shim };
    };
    padTilt = ctx.createBiquadFilter();          // presence veil: moving down darkens the pads
    padTilt.type = 'lowpass'; padTilt.frequency.value = 20000; padTilt.Q.value = 0.4;
    bus.pad = mkBus(padTilt);
    bus.voice = mkBus(); bus.glitch = mkBus(); bus.sub = mkBus();

    // continuous sub drone (A1, slightly drifting)
    const subOsc = mkOsc(mtof(33), 'sine');
    const subDrift = mkOsc(0.05, 'sine'), subDriftG = ctx.createGain(); subDriftG.gain.value = 4;
    subDrift.connect(subDriftG); subDriftG.connect(subOsc.detune); subDrift.start();
    const subOct = mkOsc(mtof(45), 'triangle');
    const subOctG = ctx.createGain(); subOctG.gain.value = 0.18;
    subOsc.connect(bus.sub.in); subOct.connect(subOctG); subOctG.connect(bus.sub.in);
    subOsc.start(); subOct.start();
    setSends(bus.sub, { dry: 1, rev: 0, shim: 0 });
  }

  function setSends(b, lv, tau) {
    const t = ctx.currentTime, k = tau || 0.8;
    b.dry.gain.setTargetAtTime(lv.dry, t, k);
    b.rev.gain.setTargetAtTime(lv.rev, t, k);
    b.shim.gain.setTargetAtTime(lv.shim, t, k);
  }

  /* ---------- params (per-moment recipe, ramped for seamless forks) ---------- */

  function applyParams(p) {
    if (!ctx) return;
    Object.assign(cur, p);
    const t = ctx.currentTime;
    bus.pad.lvl.gain.setTargetAtTime(p.padLvl, t, 1.1);
    bus.voice.lvl.gain.setTargetAtTime(p.voiceLvl, t, 1.1);
    bus.glitch.lvl.gain.setTargetAtTime(p.glitchLvl, t, 1.1);
    bus.sub.lvl.gain.setTargetAtTime(p.subLvl * 0.5, t, 1.6);
    const sh = clamp(p.shimmer, 0, 1.4), sp = clamp(p.space, 0, 1.4);
    setSends(bus.pad, { dry: .8 * sp, rev: .95 * sp, shim: .5 * sh }, 1.1);
    setSends(bus.voice, { dry: .28, rev: 1.05 * sp, shim: .9 * sh }, 1.1);
    setSends(bus.glitch, { dry: .9, rev: .4 * sp, shim: .18 * sh }, 1.1);
    shimOut.gain.setTargetAtTime(0.55 + 0.5 * sh, t, 1.1);
  }

  function duckPads(t) {
    // dips only the dedicated duck param; never cancels anything
    const g = bus.pad.duck.gain;
    g.setTargetAtTime(0.74, t, 0.02);
    g.setTargetAtTime(1, t + 0.1, 0.09);
  }

  /* ---------- pads: the bent, smeared wall ---------- */

  function spawnChord(midis, when, dur, p) {
    if (!ctx) return;
    const swell = Math.min(p.swell, dur * 0.45);
    const rel = 3.8;
    const stop = when + dur + rel + 0.3;
    const peak = 0.34 / Math.sqrt(Math.max(3, midis.length));
    midis.forEach((m, vi) => {
      const f = mtof(m);
      const voices = LITE ? 1 : 2;   // phones: half the oscillator stack
      for (let k = 0; k < voices; k++) {
        const o = ctx.createOscillator();
        o.type = k ? 'triangle' : 'sawtooth';
        const staticCents = p.bend * (14 + Math.random() * 40) * (Math.random() < 0.5 ? -1 : 1);
        o.frequency.value = f;
        o.detune.value = staticCents + (Math.random() * 10 - 5);

        // glide from this slot's previous pitch — the smeared "bent string" join
        const pf = padPrev[vi];
        const gl = p.glide || 0;
        if (pf && gl > 0) {
          o.frequency.setValueAtTime(Math.max(20, pf), when);
          o.frequency.exponentialRampToValueAtTime(f, when + gl * (1.4 + Math.random()));
          pulses.forEach(cb => cb('glide', when));
        }

        // slow per-oscillator bend LFO — chords never quite sit still
        const bl = mkOsc(0.05 + Math.random() * 0.22, 'sine');
        const bg = ctx.createGain(); bg.gain.value = p.bend * (16 + Math.random() * 38);
        bl.connect(bg); bg.connect(o.detune);

        const fl = ctx.createBiquadFilter();
        fl.type = 'lowpass'; fl.Q.value = 0.8;
        const co = clamp(p.cutoff * (0.8 + Math.random() * 0.5), 120, 12000);
        fl.frequency.setValueAtTime(co * 0.55, when);
        fl.frequency.linearRampToValueAtTime(co, when + Math.max(1, dur * 0.5));
        const wl = LITE ? null : mkOsc(0.03 + Math.random() * 0.09, 'sine');
        const wg = ctx.createGain(); wg.gain.value = co * 0.28;
        if (wl) { wl.connect(wg); wg.connect(fl.frequency); }

        const fz = ctx.createWaveShaper();
        fz.curve = fuzzCurve(1 + p.fuzz * 6.5);

        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, when);
        g.gain.linearRampToValueAtTime(peak, when + swell);
        g.gain.setValueAtTime(peak, when + dur);
        g.gain.linearRampToValueAtTime(0.0001, when + dur + rel);

        o.connect(fl); fl.connect(fz); fz.connect(g); g.connect(bus.pad.in);
        o.start(when); o.stop(stop);
        bl.start(when); bl.stop(stop);
        if (wl) { wl.start(when); wl.stop(stop); }
      }
      padPrev[vi] = f;
    });
    for (let vi = midis.length; vi < padPrev.length; vi++) padPrev[vi] = null;
  }

  /* ---------- gossamer voice ---------- */

  function spawnVoice(m, when, dur, opts, p) {
    if (!ctx) return;
    opts = opts || {};
    const f = mtof(m);
    const rel = opts.rel || 1.6, att = opts.att || 0.7, peak = opts.peak || 0.12;

    const o1 = mkOsc(f, 'sine');
    const o2 = mkOsc(f * 2, 'sine');
    const o2g = ctx.createGain(); o2g.gain.value = 0.22;

    // delayed vibrato — the note arrives straight, then trembles
    const vib = mkOsc(5.2, 'sine'); const vibG = ctx.createGain();
    vibG.gain.setValueAtTime(0, when);
    vibG.gain.setValueAtTime(0, when + 0.4);
    vibG.gain.linearRampToValueAtTime(9, when + 1.6);
    vib.connect(vibG); vibG.connect(o1.detune); vibG.connect(o2.detune);

    // breath-slide into the note
    if (opts.slide) {
      o1.frequency.setValueAtTime(f * 0.955, when);
      o1.frequency.exponentialRampToValueAtTime(f, when + 0.45);
      o2.frequency.setValueAtTime(f * 2 * 0.955, when);
      o2.frequency.exponentialRampToValueAtTime(f * 2, when + 0.45);
    }

    // parallel formant bandpasses — a vowel hiding in the shimmer
    const mix = ctx.createGain();
    const mkF = (freq, q, amt) => {
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
      bp.frequency.value = freq; bp.Q.value = q;
      const g = ctx.createGain(); g.gain.value = amt;
      o1.connect(bp); bp.connect(g); g.connect(mix);
    };
    const d0 = ctx.createGain(); d0.gain.value = 0.5;
    o1.connect(d0); d0.connect(mix);
    mkF(720, 2.2, 0.55); mkF(1140, 3.2, 0.38);
    o1.connect(o2g); o2g.connect(mix);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, when);
    env.gain.linearRampToValueAtTime(peak, when + att);
    env.gain.setValueAtTime(peak, when + dur);
    env.gain.linearRampToValueAtTime(0.0001, when + dur + rel);

    mix.connect(env); env.connect(bus.voice.in);
    const stop = when + dur + rel + 0.3;
    o1.start(when); o1.stop(stop);
    o2.start(when); o2.stop(stop);
    vib.start(when); vib.stop(stop);
    pulses.forEach(cb => cb('voice', when));
  }

  /* ---------- micro-rhythm / IDM grains ---------- */

  function glitchStep(t, p, rng, stepIndex) {
    if (!ctx) return;
    const dens = p.dens * (p.dynDensity || 1) * (LITE ? 0.7 : 1);
    if (dens <= 0.001) return;
    const type = p.glitchType;

    const src = (dur, hpType, freq) => {
      const s = ctx.createBufferSource();
      s.buffer = noiseBuffer();
      s.loop = true;
      s.playbackRate.value = 0.9 + rng() * 0.3;
      const f = ctx.createBiquadFilter();
      f.type = hpType; f.frequency.value = freq; f.Q.value = type === 'grain' ? 6 : 1;
      if (type === 'grain') f.frequency.value = 700 + rng() * 3600;
      const g = ctx.createGain();
      const pk = 0.05 + rng() * 0.1;
      // 2ms fade-in: kills the discontinuity click on onset (Bluetooth codecs
      // pre-echo these into audible pops)
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(pk, t + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      let tail = s;
      if (type === 'grain' && rng() < 0.5) {
        const cr = ctx.createWaveShaper(); cr.curve = crushCurve(5);
        s.connect(f); f.connect(cr); tail = cr;
      } else { s.connect(f); tail = f; }
      tail.connect(g); g.connect(bus.glitch.in);
      s.start(t, rng() * 1.5); s.stop(t + dur + 0.05);
    };

    if (type !== 'grain' && rng() < dens * 0.42) src(0.03 + rng() * 0.02, 'highpass', 6500);                       // tick
    if (rng() < dens * 0.13) src(0.06 + rng() * 0.05, 'bandpass', 700 + rng() * 3500);                             // grain
    if (type !== 'grain' && rng() < dens * 0.055) {                                                                // soft thump
      const o = mkOsc(64, 'sine');
      o.frequency.setValueAtTime(64, t);
      o.frequency.exponentialRampToValueAtTime(38, t + 0.11);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.34, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.17);
      o.connect(g); g.connect(bus.glitch.in);
      o.start(t); o.stop(t + 0.2);
      duckPads(t);
      pulses.forEach(cb => cb('thump', t));
    }
    if (type !== 'grain' && rng() < dens * 0.03) {                                                                 // stutter
      const n = 3 + Math.floor(rng() * 4);
      for (let i = 0; i < n; i++) {
        const s = ctx.createBufferSource(); s.buffer = noiseBuffer(); s.loop = true;
        const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 5000;
        const g = ctx.createGain();
        const tt = t + i * 0.036;
        g.gain.setValueAtTime(0.0001, tt);
        g.gain.linearRampToValueAtTime(0.07, tt + 0.001);
        g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.03);
        s.connect(f); f.connect(g); g.connect(bus.glitch.in);
        s.start(tt, rng()); s.stop(tt + 0.05);
      }
      pulses.forEach(cb => cb('stutter', t));
    }
  }

  /* ---------- analysis for visuals ---------- */

  const freqData = new Uint8Array(1024);
  function bands() {
    if (!analyser) return { sub: 0, low: 0, mid: 0, high: 0, air: 0 };
    analyser.getByteFrequencyData(freqData);
    const avg = (a, b) => {
      let s = 0; for (let i = a; i < b; i++) s += freqData[i];
      return s / ((b - a) * 255);
    };
    return { sub: avg(1, 8), low: avg(8, 40), mid: avg(40, 160), high: avg(160, 400), air: avg(400, 900) };
  }

  function onPulse(cb) { pulses.push(cb); }

  /* ---------- presence (mouse / tilt) ----------
   * px −1..1 leans the mix; py −1..1 lifts (+) or veils (−) the pads;
   * energy 0..1 briefly swells the shimmer feedback. All long-tailed. */
  function setPresence(px, py, energy) {
    if (!ctx) return;
    const t = ctx.currentTime;
    if (tilt) tilt.pan.setTargetAtTime(clamp(px * 0.35, -0.5, 0.5), t, 0.6);
    const pyDown = Math.max(0, -py);
    padTilt.frequency.setTargetAtTime(20000 * Math.pow(6000 / 20000, pyDown), t, 0.7);
    shimTrim.gain.setTargetAtTime(1 + Math.max(0, py) * 0.4 + energy * 0.1, t, 0.7);
    const fb = Math.min(0.82, (LITE ? 0.6 : 0.7) + energy * 0.12);
    shimFB.gain.setTargetAtTime(fb, t, 0.8);
  }

  function fadeIn() {
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    const t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(0.0001, t);
    master.gain.linearRampToValueAtTime(0.85, t + 2.6);
  }
  function fadeOut(sec) {
    if (!ctx) return;
    const t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(master.gain.value, t);
    master.gain.linearRampToValueAtTime(0.0001, t + sec);
  }

  /* a soft dip-and-return of the master around phone rotation: any residual
   * underrun click scales with signal level, so the breath lowers the click
   * floor on weak devices — and just sounds like the piece turning over */
  function breathe() {
    if (!ctx) return;
    const t = ctx.currentTime;
    breath.gain.setTargetAtTime(0.72, t, 0.16);
    breath.gain.setTargetAtTime(1, t + 0.55, 0.5);
  }

  return {
    init, applyParams, spawnChord, spawnVoice, glitchStep,
    bands, onPulse, fadeIn, fadeOut, setPresence, breathe,
    get lite() { return LITE; },
    get now() { return ctx ? ctx.currentTime : 0; },
    get started() { return !!ctx; },
    get presence() {
      return ctx ? {
        pan: tilt ? +tilt.pan.value.toFixed(2) : null,
        veil: Math.round(padTilt.frequency.value),
        shimTrim: +shimTrim.gain.value.toFixed(2),
        shimFB: +shimFB.gain.value.toFixed(2)
      } : null;
    },
    mtof
  };
})();
