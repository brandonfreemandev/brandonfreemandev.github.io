/* Wish Fork — segments.js
 * The composition: a silver lattice of 12 moments.
 *
 *   I  intro (anchor)          — one version
 *   II–XI  nine forking moments — two versions each
 *   VI  the still point         — converges in structure, diverges in tint
 *   XII afterglow (adaptive)    — reads the accumulated path tint
 *
 * Fork i chooses the variant of moment i+1 → 11 forks, 2^11 = 2048 journeys.
 * Segment lengths: 18 + 9×16.5 + 15 + 22 ≈ 3:24.
 */
window.SEG = (function () {
  'use strict';

  const BPM = 82;
  const BEAT = 60 / BPM;

  /* hand-voiced chords (absolute MIDI) around A minor ↔ E lydian haze */
  const CH = {
    Am9:      [45, 57, 60, 64, 67, 71],   // A2 A3 C4 E4 G4 B4
    Fmaj9:    [41, 53, 57, 60, 64, 67],   // F2 F3 A3 C4 E4 G4
    Cmaj9:    [48, 55, 59, 62, 64, 67],   // C3 G3 B3 D4 E4 G4
    G6:       [43, 55, 59, 62, 64, 69],   // G2 G3 B3 D4 E4 A4
    Emaj9:    [40, 52, 56, 59, 62, 66],   // E2 E3 G#3 B3 D4 F#4  (borrowed lift)
    Dmaj7:    [50, 54, 57, 61, 64],       // D3 F#3 A3 C#4 E4
    Cmaj7s11: [48, 55, 59, 66, 69, 74],   // C3 G3 B3 F#4 A4 D5  (lydian glory)
    Dm9:      [38, 50, 53, 57, 60, 64],   // D2 D3 F3 A3 C4 E4
    Amadd9:   [45, 57, 64, 71, 76],       // airy A
    droneA:   [33, 45, 52, 57],           // low A skeleton
    stillA:   [45, 57, 64, 69],           // the blue still
    stillB:   [45, 57, 64, 74]            // the ivory still (adds the 4th, D)
  };
  const prog = (...pairs) => pairs.map(([n, b]) => ({ n: CH[n], b }));

  /* each recipe: what the moment is made of */
  const R = {
    intro: {
      name: 'Iridescent Sleep',
      prog: prog(['Fmaj9', 12], ['Am9', 10]),
      cutoff: 850, fuzz: .38, bend: .4, glide: 1.6, swell: 4.5,
      dens: .12, sub: .5, voice: 'sparse', shim: .35, space: .85, lvl: .9,
      palette: 'sleep', voiceLvl: .55
    },
    wither: {
      name: 'Wither',
      prog: prog(['Am9', 8], ['Dm9', 8]),
      cutoff: 620, fuzz: .55, bend: .55, glide: 2, swell: 5,
      dens: .18, sub: .85, voice: 'sparse', shim: .25, space: .85, lvl: 1,
      palette: 'wither', tint: { bright: -1, warm: -1, dense: 1 }
    },
    unfurl: {
      name: 'Unfurl',
      prog: prog(['Cmaj9', 8], ['G6', 8]),
      cutoff: 1500, fuzz: .3, bend: .3, glide: 1.4, swell: 3.5,
      dens: .38, sub: .55, voice: 'sparse', shim: .6, space: .9, lvl: .9,
      palette: 'unfurl', tint: { bright: 1, warm: 1 }
    },
    submerge: {
      name: 'Submerge',
      prog: prog(['Am9', 10], ['Fmaj9', 8]),
      cutoff: 480, fuzz: .42, bend: .65, glide: 2.6, swell: 6,
      dens: .08, sub: .95, voice: 'off', shim: .15, space: .9, lvl: .95,
      palette: 'deep', tint: { bright: -1, dense: 1 }
    },
    surface: {
      name: 'Surface',
      prog: prog(['Cmaj9', 8], ['Emaj9', 8]),
      cutoff: 1900, fuzz: .25, bend: .3, glide: 1.2, swell: 3,
      dens: .42, sub: .5, voice: 'lift', shim: .85, space: .95, lvl: .9,
      palette: 'dawn', tint: { bright: 1, warm: 1 }
    },
    smear: {
      name: 'Smear',
      prog: prog(['Am9', 6], ['Cmaj9', 6], ['Fmaj9', 6]),
      cutoff: 1100, fuzz: .8, bend: .95, glide: 2.8, swell: 2.5,
      dens: .3, sub: .8, voice: 'off', shim: .3, space: .8, lvl: 1.05,
      palette: 'smear', tint: { dense: 2 }
    },
    crystallize: {
      name: 'Crystallize',
      prog: prog(['Emaj9', 10], ['Dmaj7', 8]),
      cutoff: 2600, fuzz: .12, bend: .12, glide: .4, swell: 4,
      dens: .75, sub: .35, voice: 'sparse', shim: .95, space: 1, lvl: .8,
      palette: 'crystal', glitchType: 'grain', tint: { bright: 2, dense: -1 }
    },
    dissolve: {
      name: 'Dissolve',
      prog: prog(['droneA', 14]),
      cutoff: 750, fuzz: .2, bend: .3, glide: 2, swell: 6,
      dens: .15, sub: .3, voice: 'off', shim: .5, space: 1, lvl: .55,
      palette: 'dissolve', glitchType: 'grain', tint: { dense: -2 }
    },
    bloom: {
      name: 'Bloom',
      prog: prog(['Cmaj7s11', 10], ['Emaj9', 10]),
      cutoff: 2000, fuzz: .6, bend: .35, glide: 1.5, swell: 4,
      dens: .3, sub: .7, voice: 'lift', shim: 1, space: 1, lvl: 1,
      palette: 'bloom', tint: { bright: 1, warm: 1, dense: 1 }
    },
    blueStill: {
      name: 'The Blue Still',
      prog: prog(['stillA', 16]),
      cutoff: 680, fuzz: .15, bend: .2, glide: 1, swell: 7,
      dens: 0, sub: .3, voice: 'sparse', shim: .45, space: 1.1, lvl: .6,
      palette: 'bluestill', voiceLvl: .75, tint: { bright: -1, dense: -1 }
    },
    ivoryStill: {
      name: 'The Ivory Still',
      prog: prog(['stillB', 16]),
      cutoff: 900, fuzz: .15, bend: .25, glide: 1.2, swell: 7,
      dens: .04, sub: .3, voice: 'sparse', shim: .6, space: 1.1, lvl: .6,
      palette: 'ivorystill', voiceLvl: .8, tint: { warm: 1, dense: -1 }
    },
    spiral: {
      name: 'Spiral',
      prog: prog(['Fmaj9', 4], ['G6', 4], ['Am9', 4], ['Cmaj9', 4]),
      cutoff: 1600, fuzz: .35, bend: .4, glide: .8, swell: 1.8,
      dens: .8, sub: .6, voice: 'arp', shim: .5, space: .85, lvl: .85,
      palette: 'spiral', tint: { dense: 1 }
    },
    drift: {
      name: 'Drift',
      prog: prog(['Fmaj9', 16]),
      cutoff: 800, fuzz: .3, bend: .5, glide: 2, swell: 7,
      dens: .04, sub: .55, voice: 'sparse', shim: .4, space: 1.05, lvl: .8,
      palette: 'drift', tint: { dense: -1 }
    },
    fever: {
      name: 'Fever',
      prog: prog(['Am9', 6], ['Emaj9', 6], ['Am9', 6]),
      cutoff: 1400, fuzz: .9, bend: .8, glide: 1.2, swell: 2,
      dens: .45, sub: .85, voice: 'off', shim: .35, space: .8, lvl: 1.05,
      palette: 'fever', tint: { dense: 2, warm: 1 }
    },
    hush: {
      name: 'Hush',
      prog: prog(['Fmaj9', 12], ['Cmaj9', 8]),
      cutoff: 900, fuzz: .1, bend: .25, glide: 1.8, swell: 5.5,
      dens: .1, sub: .35, voice: 'sparse', shim: .7, space: 1.05, lvl: .6,
      palette: 'hush', voiceLvl: 1, tint: { dense: -2 }
    },
    ignite: {
      name: 'Ignite',
      prog: prog(['Cmaj7s11', 10], ['G6', 10]),
      cutoff: 2400, fuzz: .7, bend: .3, glide: 1.2, swell: 3.5,
      dens: .55, sub: .7, voice: 'lift', shim: 1, space: 1.05, lvl: 1,
      palette: 'ignite', tint: { bright: 2 }
    },
    gutter: {
      name: 'Gutter',
      prog: prog(['Am9', 8], ['droneA', 8]),
      cutoff: 430, fuzz: .85, bend: .9, glide: 3, swell: 6,
      dens: .2, sub: 1, voice: 'off', shim: .1, space: .8, lvl: 1,
      palette: 'gutter', tint: { bright: -2, dense: 2 }
    },
    ascend: {
      name: 'Ascend',
      prog: prog(['Cmaj9', 6], ['Emaj9', 6], ['G6', 6]),
      transpose: 2,
      cutoff: 2100, fuzz: .5, bend: .35, glide: 1, swell: 3,
      dens: .5, sub: .6, voice: 'lift', shim: .9, space: 1, lvl: .95,
      palette: 'ascend', tint: { bright: 1 }
    },
    resolve: {
      name: 'Resolve',
      prog: prog(['Fmaj9', 6], ['G6', 6], ['Am9', 8]),
      cutoff: 1050, fuzz: .35, bend: .3, glide: 1.5, swell: 4,
      dens: .25, sub: .6, voice: 'sparse', shim: .5, space: .9, lvl: .9,
      palette: 'resolve', tint: { warm: 1, dense: -1 }
    },
    letgo: {
      name: 'Let Go',
      prog: prog(['Amadd9', 14]),
      cutoff: 1200, fuzz: .3, bend: .4, glide: 2.4, swell: 8,
      dens: .08, sub: .4, voice: 'sparse', shim: .8, space: 1.05, lvl: .7,
      palette: 'letgo', voiceLvl: .8, tint: { dense: -1 }
    },
    holdon: {
      name: 'Hold On',
      prog: prog(['Cmaj7s11', 8], ['Emaj9', 8]),
      cutoff: 1900, fuzz: .65, bend: .3, glide: 1.4, swell: 4.5,
      dens: .4, sub: .75, voice: 'lift', shim: .95, space: 1, lvl: 1,
      palette: 'holdon', tint: { bright: 1, dense: 1 }
    },
    fadeOutro: {
      name: 'Afterglow — Dissolve',
      prog: prog(['Am9', 24]),
      cutoff: 750, fuzz: .3, bend: .25, glide: 2, swell: 9,
      dens: 0, sub: .35, voice: 'final', shim: .7, space: 1.1, lvl: .85,
      palette: 'afterglow', voiceLvl: .7, adaptive: true
    },
    lingerOutro: {
      name: 'Afterglow — Linger',
      prog: prog(['Amadd9', 24]),
      cutoff: 950, fuzz: .4, bend: .3, glide: 2.2, swell: 7,
      dens: .06, sub: .45, voice: 'final', shim: .85, space: 1.05, lvl: .95,
      palette: 'afterglow', voiceLvl: .75, adaptive: true
    }
  };

  /* fork metadata: what the listener (or the room) is choosing between.
   * energy / dark / cold feed the auto-decision scorer. */
  const F = {
    witherUnfurl: {
      a: { label: 'Wither', glyph: '✧', whisper: 'curl inward; let the low end bloom like dusk', energy: .35, dark: .8, cold: .5 },
      b: { label: 'Unfurl', glyph: '❋', whisper: 'open the shutters; let the highs scatter', energy: .6, dark: .25, cold: .4 }
    },
    submergeSurface: {
      a: { label: 'Submerge', glyph: '⌇', whisper: 'drop beneath the surface; the water takes the treble', energy: .3, dark: .85, cold: .2 },
      b: { label: 'Surface', glyph: '◌', whisper: 'rise; the voice finds a higher room', energy: .65, dark: .2, cold: .5 }
    },
    smearCrystallize: {
      a: { label: 'Smear', glyph: '⌾', whisper: 'drag the chords through hot glass', energy: .75, dark: .5, cold: .1 },
      b: { label: 'Crystallize', glyph: '✦', whisper: 'hang the notes like frost', energy: .45, dark: .15, cold: .9 }
    },
    dissolveBloom: {
      a: { label: 'Dissolve', glyph: '☾', whisper: 'thin to breath and static', energy: .2, dark: .7, cold: .3 },
      b: { label: 'Bloom', glyph: '✿', whisper: 'stack the choir; blow out the halo', energy: .7, dark: .25, cold: .2 }
    },
    blueIvory: {
      a: { label: 'The Blue Still', glyph: '❄', whisper: 'a held breath, indigo', energy: .15, dark: .85, cold: .7 },
      b: { label: 'The Ivory Still', glyph: '🕯', whisper: 'a held breath, candlelit', energy: .15, dark: .4, cold: .3 }
    },
    spiralDrift: {
      a: { label: 'Spiral', glyph: '⟳', whisper: 'let the pattern quicken', energy: .8, dark: .4, cold: .5 },
      b: { label: 'Drift', glyph: '≈', whisper: 'let go of the grid entirely', energy: .2, dark: .6, cold: .3 }
    },
    feverHush: {
      a: { label: 'Fever', glyph: '✹', whisper: 'push the fuzz until it sings wrong', energy: .85, dark: .55, cold: .1 },
      b: { label: 'Hush', glyph: '⌣', whisper: 'everything but the whisper', energy: .25, dark: .55, cold: .2 }
    },
    igniteGutter: {
      a: { label: 'Ignite', glyph: '✺', whisper: 'full white, all shimmer', energy: .8, dark: .1, cold: .3 },
      b: { label: 'Gutter', glyph: '▽', whisper: 'drop to the amber basement', energy: .55, dark: .95, cold: .1 }
    },
    ascendResolve: {
      a: { label: 'Ascend', glyph: '⌃', whisper: 'lift the key; the floor becomes sky', energy: .7, dark: .15, cold: .6 },
      b: { label: 'Resolve', glyph: '⊙', whisper: 'come home to the cadence', energy: .4, dark: .45, cold: .3 }
    },
    letgoHoldon: {
      a: { label: 'Let Go', glyph: '⌄', whisper: 'release, thinning into afterglow', energy: .3, dark: .5, cold: .5 },
      b: { label: 'Hold On', glyph: '◉', whisper: 'one more swell, held past sense', energy: .75, dark: .3, cold: .2 }
    },
    fadeLinger: {
      a: { label: 'Dissolve', glyph: '◌', whisper: 'end as blue silence', energy: .2, dark: .6, cold: .4 },
      b: { label: 'Linger', glyph: '✧', whisper: 'end on the held chord, glowing', energy: .6, dark: .35, cold: .3 }
    }
  };

  /* the lattice. fork = the choice arriving AT this moment. */
  const LIST = [
    { num: 'I',    len: 18,   fork: null,              variants: [R.intro] },
    { num: 'II',   len: 16.5, fork: F.witherUnfurl,    variants: [R.wither, R.unfurl] },
    { num: 'III',  len: 16.5, fork: F.submergeSurface, variants: [R.submerge, R.surface] },
    { num: 'IV',   len: 16.5, fork: F.smearCrystallize,variants: [R.smear, R.crystallize] },
    { num: 'V',    len: 16.5, fork: F.dissolveBloom,   variants: [R.dissolve, R.bloom] },
    { num: 'VI',   len: 15,   fork: F.blueIvory,       variants: [R.blueStill, R.ivoryStill] },
    { num: 'VII',  len: 16.5, fork: F.spiralDrift,     variants: [R.spiral, R.drift] },
    { num: 'VIII', len: 16.5, fork: F.feverHush,       variants: [R.fever, R.hush] },
    { num: 'IX',   len: 16.5, fork: F.igniteGutter,    variants: [R.ignite, R.gutter] },
    { num: 'X',    len: 16.5, fork: F.ascendResolve,   variants: [R.ascend, R.resolve] },
    { num: 'XI',   len: 16.5, fork: F.letgoHoldon,     variants: [R.letgo, R.holdon] },
    { num: 'XII',  len: 22,   fork: F.fadeLinger,      variants: [R.fadeOutro, R.lingerOutro] }
  ];

  /* ---------- visual palettes: bg + orb colors ---------- */
  const PALETTES = {
    sleep:      ['#07060f', '#3a3a6e', '#7b6390', '#c08fbb', '#f3d3d8'],
    wither:     ['#080510', '#33224d', '#5e3f63', '#9c5f7c', '#d8a3a8'],
    unfurl:     ['#06070d', '#3f5f7d', '#6f9aa8', '#a9d6c8', '#f2ead6'],
    deep:       ['#03040a', '#12213f', '#27436b', '#4f7d9c', '#a9c8cf'],
    dawn:       ['#0a0710', '#5f3a5e', '#a05c77', '#e0908f', '#f7dcc2'],
    smear:      ['#0a0512', '#4a2a5c', '#8a4a7a', '#d76d92', '#f4c1b0'],
    crystal:    ['#050810', '#2e4a6b', '#6fa3c9', '#b8e0e8', '#f4fbff'],
    dissolve:   ['#060608', '#2b2b33', '#55505e', '#8a8296', '#d8d2dc'],
    bloom:      ['#090612', '#5c3a6e', '#a05c8a', '#e08ab0', '#ffe3c8'],
    bluestill:  ['#04060e', '#1c2a52', '#3d5580', '#7d97c0', '#dfe6f2'],
    ivorystill: ['#0b0806', '#4a3b2c', '#7d6a4f', '#bda87f', '#f2e6cd'],
    spiral:     ['#070610', '#3a2a5e', '#6e4a9c', '#a868c9', '#e8b0d8'],
    drift:      ['#06060d', '#2e2e4e', '#5c5c8a', '#9c9cc0', '#e0e0f0'],
    fever:      ['#0c0510', '#5e2440', '#a04260', '#d8687c', '#f8b890'],
    hush:       ['#070609', '#33283f', '#5e4a6e', '#937f9c', '#ded2e0'],
    ignite:     ['#080712', '#4a3a8a', '#8a5cb8', '#d890e0', '#fff0c8'],
    gutter:     ['#050308', '#2e1a22', '#5e3038', '#8a4a3f', '#c8845a'],
    ascend:     ['#060812', '#3a4a8a', '#6f8ac9', '#a9c0e8', '#f0f6ff'],
    resolve:    ['#07070c', '#3a3a55', '#6e6a8a', '#a89cb0', '#e8dcd8'],
    letgo:      ['#060710', '#2e3a5e', '#5c6f9c', '#9cb0c9', '#e8e6ef'],
    holdon:     ['#080610', '#4a3a6e', '#8a5c9c', '#c98ac0', '#ffd8e0'],
    afterglow:  ['#050509', '#3a2a4e', '#6e507d', '#b086a0', '#f0d8d0']
  };

  const envPhasePalette = { night: 'sleep', dawn: 'dawn', day: 'unfurl', dusk: 'wither' };

  /* merge a recipe with accumulated path tint + environment */
  function resolve(recipe, tint, envPhase) {
    const bright = 1 + 0.07 * (tint.bright || 0) + (envPhase === 'night' ? -0.1 : envPhase === 'dawn' ? 0.1 : 0);
    return {
      name: recipe.name,
      prog: recipe.prog,
      palette: recipe.palette || envPhasePalette[envPhase] || 'sleep',
      glitchType: recipe.glitchType,
      transpose: recipe.transpose || 0,
      adaptive: recipe.adaptive,
      voiceMode: recipe.voice,
      voiceLvl: recipe.voiceLvl !== undefined ? recipe.voiceLvl : .7,
      spawn: {
        cutoff: Math.max(150, recipe.cutoff * bright),
        fuzz: Math.min(1, recipe.fuzz * (1 + 0.05 * (tint.dense || 0))),
        bend: Math.min(1, recipe.bend * (1 + 0.05 * Math.abs(tint.dense || 0))),
        glide: recipe.glide,
        swell: recipe.swell,
        dens: recipe.dens
      },
      mix: {
        padLvl: recipe.lvl * 0.9,
        voiceLvl: (recipe.voiceLvl !== undefined ? recipe.voiceLvl : .7) * .9,
        glitchLvl: .85,
        subLvl: recipe.sub,
        shimmer: recipe.shim * (1 + 0.08 * (tint.bright || 0)),
        space: recipe.space
      }
    };
  }

  return { BPM, BEAT, LIST, PALETTES, envPhasePalette, resolve, CH };
})();
