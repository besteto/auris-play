/* Auris Merge — pure game logic. No DOM, no imports, no side effects beyond the
   state object handed in. Everything here is asserted by tests.html. */
(function (root) {
  'use strict';

  var GRID = 5;
  var CELLS = GRID * GRID;
  var TRAY_SETS = 3;                 // measured; see the tuning note below

  /* ---- tuning knobs -------------------------------------------------------
     Every merge counts one, so the score is a plain tally of pieces made. The
     gift's weighted table existed to land exactly on 35 — his age — and there is
     no target to land on any more.

     START_PIECES, SPAWN_BIAS and the partner bias are measured for exactly three
     chains on a 25-cell tray. Do not change them without re-running tuning.html;
     six chains at once starves pairs and every number here needs re-deriving. */
  var SCORING      = { 2: 1, 3: 1, 4: 1 };
  var START_PIECES = 10;
  var SPAWN_BIAS   = 0.65;           // chance a spawn favours a set already on the
                                     // board, so chains stay completable
  var PIECES_PER_SET = 3;            // finished pieces that retire a set

  /* Deterministic RNG so tests are reproducible and a seed can replay a game. */
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), 1 | t);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* `opts.sets` is an ordered list of descriptors, {key, tiers}, built by
     Manifest. The first three go on the tray, the rest queue behind them. Rules
     never learn what a collection is; ordering is somebody else's decision. */
  function createState(seed, opts) {
    opts = opts || {};
    var all = (opts.sets || []).slice();
    if (all.length < TRAY_SETS) {
      throw new Error('createState needs at least ' + TRAY_SETS + ' sets');
    }

    var state = {
      cells: new Array(CELLS).fill(null),
      score: 0,
      seq: 0,          // piece id counter, also doubles as birth order
      rng: mulberry32(seed === undefined ? 1 : seed),
      mode: opts.mode === 'demo' ? 'demo' : 'endless',
      all: all,
      tray: all.slice(0, TRAY_SETS),
      queue: all.slice(TRAY_SETS),
      done: [],
      finished: {}
    };

    /* Demo is over when the three sets it opened with are all finished. Captured
       here because the tray changes underneath as sets retire. */
    state.opening = state.tray.map(function (d) { return d.key; });

    /* Deal the opening hand round-robin rather than at random, so the first tray
       has all three sets on it. Left to chance, a tray can open almost entirely
       one chain, which reads as a duller game than it is. Positions are still
       random. */
    for (var i = 0; i < START_PIECES; i++) {
      spawn(state, undefined, state.tray[i % state.tray.length].key);
    }
    return state;
  }

  function descriptorFor(state, key) {
    for (var i = 0; i < state.tray.length; i++) {
      if (state.tray[i].key === key) return state.tray[i];
    }
    for (var j = 0; j < state.all.length; j++) {
      if (state.all[j].key === key) return state.all[j];
    }
    return null;
  }

  function emptyCells(state) {
    var out = [];
    for (var i = 0; i < CELLS; i++) if (!state.cells[i]) out.push(i);
    return out;
  }

  /* Sets holding an ODD number of tier-1s, i.e. one piece sitting without a
     partner. Biasing spawns toward these completes pairs the player can see.

     The first attempt biased toward "any set already on the tray", which ran
     away: whichever set got ahead kept being picked until the tray was
     effectively one chain and the other two never appeared. */
  function setsWantingPartner(state) {
    var count = {};
    for (var i = 0; i < CELLS; i++) {
      var p = state.cells[i];
      if (p && p.tier === 1) count[p.key] = (count[p.key] || 0) + 1;
    }
    return state.tray
      .map(function (d) { return d.key; })
      .filter(function (k) { return (count[k] || 0) % 2 === 1; });
  }

  function spawn(state, forceIndex, forceKey) {
    var free = emptyCells(state);
    if (!free.length) return [];

    var idx = forceIndex !== undefined ? forceIndex
            : free[Math.floor(state.rng() * free.length)];

    var pool = state.tray.map(function (d) { return d.key; });
    var wanting = setsWantingPartner(state);
    if (wanting.length && state.rng() < SPAWN_BIAS) pool = wanting;
    var key = forceKey || pool[Math.floor(state.rng() * pool.length)];

    var d = descriptorFor(state, key);
    var piece = {
      id: ++state.seq,
      key: key,
      tier: 1,
      top: d ? d.tiers : 3,
      born: state.seq
    };
    state.cells[idx] = piece;
    return [{ type: 'spawn', index: idx, piece: piece }];
  }

  function pointsFor(state, tier) {
    return SCORING[tier] || 0;
  }

  function canMerge(a, b) {
    return !!a && !!b && a !== b
        && a.key === b.key
        && a.tier === b.tier
        && a.tier < a.top;
  }

  /* A cell index must be a whole number on the tray. Testing the negation
     matters: NaN fails BOTH `< 0` and `>= CELLS`, so a range check written the
     obvious way lets NaN through, and cells[NaN] then reads as an empty cell. */
  function isCell(i) {
    return typeof i === 'number' && i === Math.floor(i) && i >= 0 && i < CELLS;
  }

  /* What would dragging `from` onto `to` do? Returns 'merge', 'move', or null. */
  function classify(state, from, to) {
    if (from === to) return null;
    if (!isCell(from) || !isCell(to)) return null;
    var a = state.cells[from];
    if (!a) return null;
    var b = state.cells[to];
    if (!b) return 'move';
    return canMerge(a, b) ? 'merge' : null;
  }

  /* Apply a drag. Returns an event list for the renderer; [] if illegal. */
  function apply(state, from, to) {
    var kind = classify(state, from, to);
    if (!kind) return [];

    var a = state.cells[from];

    if (kind === 'move') {
      state.cells[to] = a;
      state.cells[from] = null;
      return [{ type: 'move', from: from, to: to, piece: a }];
    }

    var merged = {
      id: ++state.seq,
      key: a.key,
      tier: a.tier + 1,
      top: a.top,
      born: state.seq
    };
    state.cells[from] = null;
    state.cells[to] = merged;

    var gained = pointsFor(state, merged.tier);
    state.score += gained;

    var events = [{ type: 'merge', from: from, to: to, piece: merged, points: gained }];

    /* A top-tier piece is the payoff: it scores, shows itself, then dissolves and
       flies to the ear. Keeping it on the board is what would clog the tray. */
    if (merged.tier === merged.top) {
      state.cells[to] = null;
      events.push({ type: 'score', index: to, piece: merged, points: gained });
      state.finished[merged.key] = (state.finished[merged.key] || 0) + 1;
    }

    events = events.concat(spawn(state));

    /* A finished piece costs four tier-1s but only three merges, so one extra
       tier-1 arrives with each crown. That keeps the tray stocked at a steady
       level without the player having to keep tapping the pouch. */
    if (merged.tier === merged.top) events = events.concat(spawn(state));

    /* Retire last, so the dissolve and seed events land after the refill and the
       renderer plays them in the order they read. */
    if (merged.tier === merged.top &&
        state.finished[merged.key] >= PIECES_PER_SET) {
      events = events.concat(retire(state, merged.key));
    }

    return events;
  }

  function hasLegalMove(state) {
    if (emptyCells(state).length) return true;
    for (var i = 0; i < CELLS; i++) {
      for (var j = i + 1; j < CELLS; j++) {
        if (canMerge(state.cells[i], state.cells[j])) return true;
      }
    }
    return false;
  }

  /* A set leaves the tray when PIECES_PER_SET of it have been finished. Its
     leftovers go into the case with it rather than sitting on the tray as pieces
     nobody can merge any more, and the incoming set seeds the cells they leave.
     That is what makes the swap read as a reward instead of as bookkeeping. */
  function retire(state, key) {
    var slot = -1;
    for (var i = 0; i < state.tray.length; i++) {
      if (state.tray[i].key === key) { slot = i; break; }
    }
    if (slot < 0) return [];

    var events = [{ type: 'setComplete', key: key, index: slot }];
    state.tray.splice(slot, 1);
    if (state.done.indexOf(key) < 0) state.done.push(key);

    var freed = [];
    for (var c = 0; c < CELLS; c++) {
      var p = state.cells[c];
      if (!p || p.key !== key) continue;
      state.cells[c] = null;
      freed.push(c);
      events.push({ type: 'dissolve', index: c, piece: p, reason: 'retire' });
    }

    /* Endless means endless: when the queue runs out, everything not currently
       on the tray goes back into it. Demo deliberately does not recycle — it is
       supposed to end. */
    if (!state.queue.length && state.mode === 'endless') {
      var onTray = state.tray.map(function (d) { return d.key; });
      state.queue = state.all.filter(function (d) { return onTray.indexOf(d.key) < 0; });
    }

    var incoming = state.queue.shift();
    if (incoming) {
      state.tray.splice(slot, 0, incoming);
      state.finished[incoming.key] = 0;
      for (var f = 0; f < freed.length; f++) {
        events = events.concat(spawn(state, freed[f], incoming.key));
      }
    }
    return events;
  }

  /* Birthday mode must not be losable. When the tray jams, the oldest tier-1
     quietly dissolves rather than ending his own birthday. */
  function relieve(state) {
    var oldest = -1;
    for (var i = 0; i < CELLS; i++) {
      var p = state.cells[i];
      if (!p || p.tier !== 1) continue;
      if (oldest < 0 || p.born < state.cells[oldest].born) oldest = i;
    }
    if (oldest < 0) return [];
    var gone = state.cells[oldest];
    state.cells[oldest] = null;
    return [{ type: 'dissolve', index: oldest, piece: gone }];
  }

  /* Endless has no completion at all — it ends when the player presses стоп,
     which is a UI action, not a rule. Demo ends when the three sets it opened
     with are all retired. */
  function isComplete(state) {
    if (state.mode !== 'demo') return false;
    return state.opening.every(function (k) { return state.done.indexOf(k) >= 0; });
  }

  root.Rules = {
    GRID: GRID, CELLS: CELLS, TRAY_SETS: TRAY_SETS,
    SCORING: SCORING, PIECES_PER_SET: PIECES_PER_SET,
    pointsFor: pointsFor,
    mulberry32: mulberry32,
    createState: createState, emptyCells: emptyCells,
    spawn: spawn, setsWantingPartner: setsWantingPartner,
    canMerge: canMerge, classify: classify, apply: apply, isCell: isCell,
    hasLegalMove: hasLegalMove, relieve: relieve, retire: retire,
    isComplete: isComplete
  };
})(typeof window !== 'undefined' ? window : globalThis);
