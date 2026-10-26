/* Wish Fork — main.js
 * The timeline controller: moment sequencing, seamless fork crossfades,
 * deterministic event scheduling, decision flow, journey recording.
 */
(function () {
  'use strict';

  const D = window.Decide, E = window.Engine, S = window.SEG,
        V = window.Visuals, UI = window.UI;

  const hash = D.Hash.parse();
  const seed = hash.seed || D.randomSeed();
  const replayChoices = hash.choices;
  const replayMode = !!replayChoices;

  /* dev/testing knob: ?speed=0.2 compresses the whole timeline (forks and all)
   * without changing musical grid or crossfade behaviour */
  const SPEED = Math.min(1, Math.max(0.05, Number(new URLSearchParams(location.search).get('speed')) || 1));

  D.Env.init();
  if (hash.env) D.Env.phase = hash.env;   // a shared journey replays under its original sky
  D.Behavior.init();

  const FORK_COUNT = S.LIST.length - 1;   // 11 forks
  const FORK_OPEN_AT = 7.5 * SPEED;      // seconds into a moment
  const FORK_DEADLINE = 14 * SPEED;      // auto-decide if untouched
  const STEP = S.BEAT / 4;                // 16th-note grid

  const st = {
    idx: 0,                // current moment index
    started: false, ended: false,
    startTime: 0,          // ctx time at begin
    segStart: 0,           // ctx time current moment began
    chordT: 0, ci: 0, chordI: 0,
    stepT: 0, stepI: 0,
    forkOpen: false, choice: null, choiceSource: '',
    hiddenDuringFork: false,
    resolved: null,        // resolved params for current moment
    tint: { bright: 0, warm: 0, dense: 0 },
    choices: [],           // 0/1 per fork
    journey: [],           // {glyph,label,source,choice}
    dynDens: 1
  };

  window.WF = {
    get state() {
      return {
        seed, idx: st.idx, moment: st.resolved && st.resolved.name,
        elapsed: st.started ? (E.now - st.startTime) : 0,
        choices: st.choices.slice(), tint: { ...st.tint },
        stillness: +D.Behavior.stillness.toFixed(3),
        phase: D.Env.phase, tempC: D.Env.tempC, tempSource: D.Env.tempSource,
        replayMode, started: st.started, ended: st.ended
      };
    }
  };

  /* ---------- deterministic per-event rng ---------- */
  const evRng = (kind, i) => D.mulberry32(D.hashStr(seed + ':' + kind + ':' + i));

  /* ---------- recipe resolution ---------- */

  function variantFor(idx) {
    const m = S.LIST[idx];
    const v = st.choice === null ? 0 : st.choice;
    return m.variants[Math.min(v, m.variants.length - 1)];
  }

  function resolveMoment(idx, recipe) {
    const r = S.resolve(recipe, st.tint, D.Env.phase);
    if (r.adaptive) {
      // the outro reads the whole journey: warmth picks the final colour,
      // brightness opens or closes the veil, heaviness deepens the bend
      if (st.tint.warm > 0) r.prog = [{ n: S.CH.Fmaj9, b: 24 }];
      r.spawn.cutoff = Math.max(380, Math.min(2400, r.spawn.cutoff * (1 + 0.09 * st.tint.bright)));
      r.spawn.bend = Math.min(1, r.spawn.bend + 0.04 * Math.abs(st.tint.dense));
    }
    return r;
  }

  function enterMoment(idx) {
    const recipe = variantFor(idx);
    if (recipe.tint) {
      st.tint.bright += recipe.tint.bright || 0;
      st.tint.warm += recipe.tint.warm || 0;
      st.tint.dense += recipe.tint.dense || 0;
    }
    st.resolved = resolveMoment(idx, recipe);
    st.idx = idx;
    st.segStart = st.boundary !== undefined ? st.boundary : E.now + 0.05;
    st.chordT = st.segStart; st.ci = 0;
    st.stepT = st.segStart;
    st.forkOpen = false; st.choice = null;
    st.hiddenDuringFork = false;
    E.applyParams(st.resolved.mix);
    V.setPalette(st.resolved.palette);
    UI.setMoment(S.LIST[idx].num, st.resolved.name);
    st.isLast = idx === S.LIST.length - 1;
  }

  /* ---------- scheduling ---------- */

  function scheduleChords(boundary) {
    const r = st.resolved;
    const ahead = E.now + 1.6;
    while (st.chordT < ahead && st.chordT < boundary + 2.0) {
      const ch = r.prog[st.ci % r.prog.length];
      let dur = ch.b * S.BEAT;
      if (st.isLast) dur = Math.min(dur, boundary - st.chordT + 14); // outro rings long
      else dur = Math.min(dur, Math.max(4, boundary - st.chordT + 2.5));
      const rng = evRng('chord', st.chordI++);
      const midis = ch.n.map(m => m + (r.transpose || 0));

      if (E.now < st.chordT + dur) E.spawnChord(midis, st.chordT, dur, r.spawn);

      // gossamer voice rides the chords
      const vm = r.voiceMode;
      if (vm === 'sparse' && rng() < 0.6) {
        const tone = midis[midis.length - 2] + 12;
        E.spawnVoice(tone, st.chordT + dur * 0.25, dur * 0.7, { slide: rng() < 0.4 }, r.mix);
      } else if (vm === 'lift' && rng() < 0.7) {
        const tone = midis[midis.length - 1] + 12;
        E.spawnVoice(tone, st.chordT + dur * 0.15, dur * 0.75, { slide: rng() < 0.5, peak: 0.14 }, r.mix);
      } else if (vm === 'arp') {
        const tones = midis.slice(1).map(m => m + 12);
        const n = Math.min(10, Math.floor(dur / (S.BEAT * 0.5)));
        for (let i = 0; i < n; i++) {
          E.spawnVoice(tones[i % tones.length], st.chordT + i * S.BEAT * 0.5, S.BEAT * 0.42,
            { att: 0.04, rel: 0.5, peak: 0.045 }, r.mix);
        }
      } else if (vm === 'final' && st.ci === 0) {
        const root = midis[0];
        E.spawnVoice(root + 36, st.chordT + 1.5, 13, { att: 4, rel: 4, peak: 0.13, slide: true }, r.mix);
      }
      st.chordT += ch.b * S.BEAT;
      st.ci++;
    }
  }

  function scheduleSteps(boundary) {
    const ahead = E.now + (document.hidden ? 1.3 : 0.35);
    while (st.stepT < ahead && st.stepT < boundary) {
      const rng = evRng('step', st.stepI++);
      E.glitchStep(st.stepT, {
        dens: st.resolved.spawn.dens,
        glitchType: st.resolved.glitchType,
        dynDensity: st.dynDens
      }, rng, st.stepI);
      st.stepT += STEP;
    }
  }

  /* ---------- fork flow ---------- */

  function openFork() {
    st.forkOpen = true;
    const fork = S.LIST[st.idx + 1].fork;
    V.forkWindow({
      a: palAccents(fork, 0), b: palAccents(fork, 1)
    });
    UI.showFork(fork, FORK_DEADLINE - FORK_OPEN_AT, input => {
      if (input === 'drift') {
        const d = D.autoDecide(fork, st.idx, seed, D.Env, D.Behavior, D.Behavior.hidden);
        lockChoice(d.pick, 'the room');
      } else {
        lockChoice(input.side, input.source);
      }
    });
  }

  function palAccents(fork, side) {
    // tint each branch's glow from its moment's palette accent
    const which = side === 0 ? S.LIST[st.idx + 1].variants[0] : S.LIST[st.idx + 1].variants[1];
    const cols = S.PALETTES[which.palette || 'sleep'];
    const hex = cols[side === 0 ? 3 : 2];
    return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
  }

  function lockChoice(side, source) {
    if (st.choice !== null) return;
    st.choice = side;
    st.choiceSource = source;
    st.choices.push(side);
    const fork = S.LIST[st.idx + 1].fork;
    const br = side === 0 ? fork.a : fork.b;
    st.journey.push({ glyph: br.glyph, label: br.label, source, choice: side });
    UI.closeFork();
    V.bloom(side);
    V.forkWindow(null);
    UI.ribbonLight(st.choices.length - 1, side);
    UI.setDecision(source === 'you chose'
      ? 'you chose <b>' + br.label.toLowerCase() + '</b>'
      : 'chosen by <b>' + source + '</b>');
    UI.ticker(source === 'you chose'
      ? 'you chose ' + br.label.toLowerCase()
      : 'the wish went ' + br.label.toLowerCase() + ' — ' + source);
  }

  /* ---------- the tick ---------- */

  function tick() {
    if (!st.started || st.ended) return;
    D.Behavior.tick();

    // passive cue: stillness thins the micro-rhythm live
    st.dynDens = 0.55 + 0.85 * (1 - D.Behavior.stillness);
    document.body.classList.toggle('still', D.Behavior.stillness > 0.85);

    const now = E.now;
    const el2 = now - st.segStart;
    const len = S.LIST[st.idx].len * SPEED;
    const boundary = st.segStart + len;

    UI.setClock(now - st.startTime);

    if (st.isLast) {
      if (el2 >= len - 5 * SPEED && !st.fading) {
        st.fading = true;
        E.fadeOut(5 * SPEED);
      }
      if (el2 >= len + 1) return finish();
      scheduleChords(boundary + 30);
      scheduleSteps(boundary + 20);
      return;
    }

    if (!st.forkOpen && !st.forkDone && el2 >= FORK_OPEN_AT) {
      if (D.Behavior.hidden) st.hiddenDuringFork = true;
      openFork();
      st.forkDone = true;
    }
    if (st.forkOpen && st.choice === null && el2 >= FORK_DEADLINE) {
      const fork = S.LIST[st.idx + 1].fork;
      const absent = st.hiddenDuringFork || D.Behavior.hidden;
      // replay mode: the remembered choice overrides the room
      if (replayMode && st.choices.length < replayChoices.length) {
        lockChoice(replayChoices[st.choices.length], 'a remembered wish');
      } else {
        const d = D.autoDecide(fork, st.idx, seed, D.Env, D.Behavior, absent);
        lockChoice(d.pick, absent ? 'your absence' : d.reason);
      }
    }

    scheduleChords(boundary);
    scheduleSteps(boundary);

    if (el2 >= len) {
      st.boundary = boundary;
      enterMoment(st.idx + 1);
      st.forkDone = false;
    }
  }

  /* ---------- begin / end ---------- */

  function begin() {
    if (st.started) return;
    st.started = true;
    E.init();
    E.fadeIn();
    E.onPulse((type, when) => {
      if (type === 'glide') V.melt(0.5);
      else if (type === 'thump' || type === 'stutter') V.melt(0.25);
    });
    st.startTime = E.now + 0.05;
    st.boundary = st.startTime;
    UI.hideBegin();
    UI.ribbonInit(FORK_COUNT);
    UI.setChips(seed, D.Env.describe(), '');
    enterMoment(0);
    UI.setDecision('');
    setInterval(tick, 100);
  }

  function finish() {
    st.ended = true;
    V.finish();
    V.forkWindow(null);
    const manual = st.journey.filter(j => j.source === 'you chose').length;
    const url = location.origin === 'null' || location.origin === 'file:'
      ? location.href.split('#')[0] + D.Hash.build(seed, st.choices, D.Env.phase)
      : location.origin + location.pathname + D.Hash.build(seed, st.choices, D.Env.phase);
    UI.showEnd(
      st.journey,
      `${manual === 0 ? 'You never touched it' : manual === FORK_COUNT ? 'You chose every turn' : 'You chose ' + manual + ' of ' + FORK_COUNT + ' turns'} — ` +
      `the rest were wished for you. ${1 << FORK_COUNT} journeys exist; this one was yours.`,
      url,
      {
        replay: () => location.reload(),
        again: () => {
          const ns = D.randomSeed();
          location.hash = 's=' + ns + '&e=' + D.Env.phase;
          location.reload();
        }
      }
    );
  }

  /* ---------- boot ---------- */

  UI.showBegin(replayMode);
  UI.beginBtn.addEventListener('click', begin);
  UI.attuneBox.addEventListener('change', () => {
    if (UI.attuneChecked) {
      UI.setAttuneState('listening…');
      D.Env.attune(seed, env => {
        UI.setAttuneState(env.tempSource === 'live' ? `${env.tempC}°C live` : `${env.tempC}°C sensor`);
        if (st.started) UI.setChips(seed, env.describe(), '');
        else UI.setAttuneState(env.tempSource === 'live' ? `${env.tempC}°C live` : `${env.tempC}°C sensor`);
      });
    } else {
      D.Env.tempC = null; D.Env.tempSource = 'unattuned';
      UI.setAttuneState('');
    }
  });
})();
