/* Wish Fork — ui.js
 * Overlays (begin / fork / end), HUD chips, ticker, journey ribbon, toast.
 */
window.UI = (function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const el = {
    begin: $('begin'), end: $('end'), fork: $('fork'),
    cardA: $('card-a'), cardB: $('card-b'),
    timer: $('fork-timer').firstElementChild,
    momentNum: $('moment-num'), momentName: $('moment-name'),
    phaseChip: $('phase-chip'), tempChip: $('temp-chip'),
    seedChip: $('seed-chip'), decisionChip: $('decision-chip'),
    clock: $('clock'), ticker: $('ticker'), ribbon: $('ribbon'),
    attune: $('attune'), attuneState: $('attune-state'),
    beginDesc: $('begin-desc'), beginBtn: $('btn-begin'),
    journeyLine: $('journey-line'), endSummary: $('end-summary'),
    share: $('btn-share'), replay: $('btn-replay'), again: $('btn-again')
  };

  let forkOpen = false;
  let timerRAF = 0;
  let keyHandler = null;
  let tickerTO = 0;

  /* ---------- begin / end ---------- */

  function showBegin(replay) {
    if (replay) {
      el.beginDesc.innerHTML =
        'You are about to relive a remembered wish — every fork will resolve ' +
        'exactly as it did before. The room is no longer consulted.';
    }
  }
  function hideBegin() { el.begin.classList.add('hidden'); }

  function showEnd(journey, summary, shareUrl, actions) {
    el.endSummary.textContent = summary;
    el.journeyLine.innerHTML = '';
    journey.forEach((j, i) => {
      const s = document.createElement('span');
      s.textContent = j.glyph;
      s.style.color = j.choice === 0 ? 'var(--hue-a)' : 'var(--hue-b)';
      s.style.animationDelay = (i * 0.12) + 's';
      s.title = j.label + ' — ' + j.source;
      el.journeyLine.appendChild(s);
    });
    el.share.onclick = () => {
      (navigator.clipboard ? navigator.clipboard.writeText(shareUrl) : Promise.reject())
        .then(() => toast('journey link copied'))
        .catch(() => toast(shareUrl));
    };
    el.replay.onclick = actions.replay;
    el.again.onclick = actions.again;
    el.end.classList.remove('hidden');
  }

  /* ---------- HUD ---------- */

  function setMoment(num, name) {
    el.momentNum.textContent = num ? num + ' ·' : '';
    el.momentName.textContent = name;
  }
  function setChips(seed, envText, tempText) {
    el.seedChip.textContent = 'seed ' + seed;
    el.phaseChip.textContent = envText;
    el.tempChip.textContent = tempText;
  }
  function setDecision(html) { el.decisionChip.innerHTML = html; }
  function setClock(sec) {
    const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
    el.clock.textContent = m + ':' + String(s).padStart(2, '0');
  }

  function ticker(msg) {
    el.ticker.textContent = msg;
    el.ticker.classList.add('show');
    clearTimeout(tickerTO);
    tickerTO = setTimeout(() => el.ticker.classList.remove('show'), 4200);
  }

  function toast(msg) {
    let t = $('toast');
    if (!t) {
      t = document.createElement('div'); t.id = 'toast';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2200);
  }

  /* ---------- journey ribbon ---------- */

  function ribbonInit(n) {
    el.ribbon.innerHTML = '';
    for (let i = 0; i < n; i++) {
      const d = document.createElement('div');
      d.className = 'node';
      el.ribbon.appendChild(d);
    }
  }
  function ribbonLight(i, choice) {
    const d = el.ribbon.children[i];
    if (!d) return;
    d.classList.add('lit', choice === 0 ? 'hue-a' : 'hue-b');
  }

  /* ---------- fork overlay ---------- */

  function showFork(fork, seconds, onChoose) {
    forkOpen = true;
    const fill = (card, side, key) => {
      card.querySelector('.glyph').textContent = fork[key].glyph;
      card.querySelector('.word').textContent = fork[key].label;
      card.querySelector('.whisper').textContent = fork[key].whisper;
      card.onclick = () => choose(side, 'you chose');
    };
    fill(el.cardA, 0, 'a');
    fill(el.cardB, 1, 'b');
    el.fork.classList.remove('hidden');

    const t0 = performance.now();
    const draw = () => {
      const left = 1 - Math.min(1, (performance.now() - t0) / (seconds * 1000));
      el.timer.style.width = (left * 100).toFixed(1) + '%';
      if (forkOpen) timerRAF = requestAnimationFrame(draw);
    };
    cancelAnimationFrame(timerRAF);
    draw();

    keyHandler = e => {
      if (!forkOpen) return;
      if (e.key === 'ArrowLeft') choose(0, 'you chose');
      else if (e.key === 'ArrowRight') choose(1, 'you chose');
      else if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        onChoose('drift');
      }
    };
    addEventListener('keydown', keyHandler);

    let done = false;
    function choose(side, source) {
      if (done) return;
      done = true;
      closeFork();
      onChoose({ side, source });
    }
  }

  function closeFork() {
    forkOpen = false;
    cancelAnimationFrame(timerRAF);
    removeEventListener('keydown', keyHandler);
    keyHandler = null;
    el.fork.classList.add('hidden');
  }

  return {
    showBegin, hideBegin, showEnd,
    setMoment, setChips, setDecision, setClock,
    ticker, toast, ribbonInit, ribbonLight,
    showFork, closeFork,
    get attuneChecked() { return el.attune.checked; },
    setAttuneState(t) { el.attuneState.textContent = t; },
    get beginBtn() { return el.beginBtn; },
    get attuneBox() { return el.attune; }
  };
})();
