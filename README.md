# Wish Fork

**A song that keeps deciding where to go.**

Wish Fork is an interactive, forking ambient-ethereal piece in the "choose
your own adventure" form. It plays for roughly **3:20–3:30** and reaches a
fork about **twice a minute**. If you choose, it follows you. If you drift, it
reads the hour, the cold, and your stillness — and wishes for you. Eleven
forks give **2,048 possible journeys**, every one of them shareable as a link
that replays it exactly.

Smeared, bent, wasted-but-heavenly. For *Blown a Wish*, for *To Here Knows
When*, for the micro-rhythms under the wash.

---

## Run it

No build, no dependencies, no samples — everything is synthesized live in the
browser.

```bash
cd wish-fork
python3 -m http.server 8931
# open http://127.0.0.1:8931
```

(Opening `index.html` directly from disk also works; the optional weather
attunement may be unavailable offline and falls back to a simulated sensor.)

**Controls**

| input | effect |
|---|---|
| `←` / `→` or click a card | choose a branch at a fork |
| `space` | let the room choose now |
| do nothing | the room chooses at the deadline anyway |
| `attune to local weather` | optional real local temperature (open-meteo, no key) |

**Dev knob:** `?speed=0.2` compresses the entire timeline (forks included) for
testing; `#s=SEED&c=01001101110&e=night` is the shareable journey format.

---

## The structure debate: anchored, outward, or lattice?

The brief asks whether intros and outros should be singular anchors (branch in
the middle, recombine) or whether paths should branch continuously outward
until the end. Both were considered; what shipped is a hybrid.

### Option A — anchored diamond (shared intro + outro, branch in the middle)

- **For:** a fixed emotional arc; the ending can be composed to land; total
  duration is constant; less material to author.
- **Against:** the middle becomes a maze with one exit — choices feel
  decorative once the listener senses the rail. For a piece about *wishing*,
  an ending that was always coming undermines the premise.

### Option B — pure binary tree, branching outward to the end

- **For:** maximal sovereignty. Every fork is real because nothing is ever
  guaranteed again; 2^n endings with n forks.
- **Against:** with forks every ~16s over 3:25, the outro must make sense
  after **2,048 different histories**. In an ambient piece whose transitions
  are slow swells, an ending that ignores how you arrived feels amnesiac —
  the opposite of the emotional through-line this aesthetic lives on.

### What shipped — the silver lattice

```
                    ┌──────────────────────────────┐
   I  intro         │  singular anchor             │
                    └──────────────┬───────────────┘
              II   III   IV   V    · continuous forking
               ╲    ╱ ╲   ╱  ╲ ╱
                ╳╳╳╳╳╳╳╳╳╳╳╳        · paths converge in structure only —
               ╱ ╲   ╱ ╲  ╱  ╲        VI THE STILL POINT is one shared breath
             VII VIII IX  X  XI      · tinted by the road you took to it
                    ┌──────────────┴───────────────┐
   XII afterglow    │  adaptive outro: reads the   │
                    │  accumulated path tint       │
                    └──────────────────────────────┘
```

- **One intro.** Every journey begins in the same iridescent sleep — the
  reference frame that makes divergence perceptible.
- **Continuous branching** through moments II–V and VII–XI (ten forking
  moments, two variants each).
- **One structural convergence** at the exact midpoint: *the still point*
  (moment VI), near-silence — a held breath every path passes through. But it
  has two colours (*the blue still* / *the ivory still*), so paths **converge
  in structure while diverging in timbre**. This is the "return" that makes
  the second half's divergence meaningful: you come back to the same room,
  changed.
- **An adaptive outro** instead of a fixed ending: the afterglow inherits the
  accumulated *tint* of your choices — warmth picks its final chord
  (Fmaj9 vs Am9), brightness opens or closes the filter, heaviness deepens
  the pitch-bend. Two endings in form (dissolve vs linger), thousands in
  character.

**Why this wins:** branching only *feels* infinite when there is something to
return to. The lattice keeps Option B's sovereignty (no moment after the intro
is ever guaranteed, 2,048 distinct journeys) while stealing Option A's arc
(shared breath, adaptive resolution). Authoring stays linear — 21 recipes, not
2,048 — because every variant is a parameter-space transform of shared
generators, and the outro computes itself from the path.

### Path tint (the memory of the journey)

Each variant carries `{bright, warm, dense}` deltas. Choices accumulate them,
and everything downstream is modulated: filter cutoff, shimmer sends, fuzz
depth, bend depth, sub weight, the final chord of the piece. Two listeners who
arrive at the same moment by different roads hear measurably different music.

---

## Decision mechanics

When a fork deadline passes untouched, the room chooses. Scores per branch,
highest wins; the largest single contribution becomes the *reason* shown to
the listener ("chosen by your stillness").

| signal | source | pull |
|---|---|---|
| **hour of day** | local clock | night → darker branches · dawn → brighter · dusk → warm/dark · day → mild bright |
| **temperature** | optional geolocation + open-meteo (no API key); falls back to a seeded simulated sensor | cold (≤8°C) → crystalline branches · heat (≥26°C) → warm/smeared |
| **stillness** | slow EMA of pointer velocity & idle time | still → low-energy branches · restless → lively ones |
| **absence** | tab hidden during the fork window | overrides with "your absence" (the calmer branch) |
| **seed** | URL seed, hashed with the fork index | deterministic tiebreak / base pull |

**Determinism.** Every event stream (chords, voice notes, glitch grains, fork
decisions) draws from `mulberry32(hash(seed : stream : index))` — a fresh
generator per event *index*, not a shared sequence — so scheduling jitter
(tabs throttling timers, etc.) can never change the music. Same seed + same
choices + same sky = the same piece, exactly. The end screen's **share this
journey** button copies a URL of the form `#s=SEED&c=01001101110&e=dusk`;
opening it replays the journey verbatim, ignoring the live room.

**Passive micro-feedback (always on, not just at forks):** the glitch
scheduler's density is scaled live by your stillness — sit perfectly still and
the micro-rhythm thins on its own; move and it stirs. The cursor dissolves
after you stop moving. The piece is watching back, gently.

---

## Presence — the body as an instrument

Your physical presence modulates both sound and image, continuously:

| signal | source | what it bends |
|---|---|---|
| **position x** | mouse on desktop; phone tilt (accelerometer) | the mix leans with you (±0.35 pan); the light field drifts and slowly spirals toward your side |
| **position y** | same | up lifts the veil (shimmer send +40%); down darkens the pad wall (lowpass to ~6 kHz); orbs parallax vertically |
| **energy** | how fast you move / shake | shimmer feedback swells (up to +0.12), glitch density rises, and the image momentarily liquifies |

Everything is heavily smoothed (τ ≈ 0.6–1.7 s) — the room *leans*, it never
twitches. On phones, enable **feel tilt** on the begin screen (iOS shows its
motion-permission prompt; without it, touch-drag does the same job). Where
your hand rests is how the room stays lit — centre is neutral.

**Rotating the phone** doesn't hiccup: canvas reallocation is debounced until
the turn settles, the old light-field is carried over stretched (the turn
reads as a dissolve, never a wipe), and the renderer runs its cheapest frames
for ~0.7 s around the turn so the audio thread is never starved. Both
orientations stay first-class.

---

## Sound design (all Web Audio, zero samples)

The posture is *Blown a Wish*: gliding, bent, drowned — with an IDM
undercurrent like the artist's own *Nines* / *Oh Da Te*.

- **Bent pad walls** — every chord spawns detuned saw+triangle stacks; each
  oscillator carries its own slow pitch-bend LFO on `detune` (±15–55¢, rates
  0.05–0.28 Hz) so chords never sit still — the "wasted" drift.
- **Portamento glide between chords** — each voice slot ramps from its
  *previous* chord's pitch (1.4–3 s), the smeared glide-guitar join. Chords
  bleed into each other instead of changing.
- **Fuzz** — per-note `tanh` waveshapers scaled by the moment's fuzz recipe
  (0.12 crystalline → 0.9 fever), inside a per-note lowpass with its own
  wobble LFO.
- **Gossamer voice** — sine + partial with delayed-onset vibrato (the note
  arrives straight, then trembles), parallel formant bandpasses (~720 Hz /
  ~1140 Hz) for a hidden vowel, breath-slide into attacks, drowned in the
  shimmer bus.
- **Micro-rhythm** — a 16th-note grid at 82 BPM with probabilistic events:
  filtered-noise ticks, bandpass grains (some bit-crushed through a stair-step
  waveshaper), a soft 64→38 Hz thump that gently ducks the pads, and rare
  40 ms stutters. Density is a per-moment parameter and is modulated live by
  stillness.
- **Space** — two generated convolution IRs (7.5 s lowpassed-noise hall;
  2.6 s bright tail) plus a shimmer feedback path: highpassed signal → short
  IR → modulated delay (0.55 s, slowly breathing) → feedback at 0.7.
- **Tape** — master wow/flutter: a 20 ms delay with 0.37 Hz ±1.3 ms and
  5.3 Hz ±0.34 ms modulation, into a soft clipper and glue compressor.
- **Sub drone** — A1 sine (+triangle octave) with a 0.05 Hz drift.

Harmony lives between A aeolian and E lydian: Am9, Fmaj9, Cmaj9, G6, borrowed
Emaj9, Dmaj7, Cmaj7♯11 — voiced for common tones so the glides have somewhere
to go.

## Visuals

A melted optical feed nodding to the *To Here Knows When* video: ping-pong
canvas feedback (scale + rotate + slow fade), seven wandering light orbs sized
by analyser bands, horizontal slice-shear "melt" pulses whenever the pads
glide or a thump lands, chromatic ghost offsets, grain, vignette. Each moment
carries its own palette; fork windows glow at the screen edges with each
branch's hue, and choosing blooms that side. The imagery is feedback of its
own past — nothing is drawn twice the same way.

## Files

```
index.html          entry, overlays, HUD
css/style.css       dream-glass UI
js/decide.js        seeded PRNG, environment + behavior sensing, auto-decision
js/engine.js        Web Audio synthesis engine
js/segments.js      the composition: chords, 21 recipes, fork metadata, palettes
js/visuals.js       feedback-melt canvas renderer
js/ui.js            overlays, ribbon, ticker, toast
js/main.js          timeline controller, fork windows, replay, journey record
```

## Roadmap ideas

- Ableton bridge: record a journey to stems via the Live MCP (each fork
  snapshot as a scene).
- More sensors: microphone RMS (room loudness → density), ambient light.
- A "wish well" — anonymous aggregate map of which branches the world chose
  tonight.
- WebGPU depth: true per-pixel feedback displacement instead of slice shear.
