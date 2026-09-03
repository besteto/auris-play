# Auris Play Studio Kiosk — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the delivered `ref-35` birthday gift into a two-mode studio kiosk — an endless scoring game with a leaderboard, and a collection demo that ends on a catalogue plate — with the personal layer removed and the tuning intact.

**Architecture:** The **set** replaces the collection as the unit on the tray. `src/rules.js` stays pure and stops knowing any collection names: it receives an ordered list of *set descriptors* (`{key, tiers}`) at `createState` and deals exactly three at a time. Everything nameable — labels, accents, plates, URLs — moves into `data/collections.js`, a manifest that `src/manifest.js` flattens into those descriptors. `game.js` keeps its role as the only file that touches the DOM.

**Tech Stack:** Vanilla ES5-flavoured JS in IIFEs, no build step, no package manager, no runtime dependencies. Tests are `tests.html` / `smoke.html` / `tuning.html`, opened in a browser. Python 3.13 + Pillow for `tools/cut.py` (dev-time only).

**Spec:** `docs/superpowers/specs/2026-09-03-auris-kiosk-design.md` (revision 2)

## Global Constraints

- **No build step, no dependencies, no package manager** at runtime. Scripts are plain `<script src>` tags in document order.
- **`src/rules.js` stays pure**: no DOM, no imports, no globals besides the `Rules` export. This is what lets `tests.html` assert against it directly.
- **The tray holds exactly three sets at all times.** `START_PIECES = 10`, `SPAWN_BIAS = 0.65` and the partner-bias rule are measured for exactly three chains on 25 cells. Do not change these numbers.
- **`relieve()` is unconditional.** A dead-ended board in front of a client is the worst failure available; endless mode has no end state to fall through to.
- **`PROMO_Auris/` and `choosed/` are never committed.** They are 311 MB and not recoverable from history. `.gitignore` already excludes them — verify before every `git add`.
- **The kiosk measures nothing** about the player. No analytics, no counters, no scan tracking.
- Existing code style: 2-space indent, `var`, IIFE modules, single quotes, comments that explain *why*.
- Sprite path convention: `assets/pieces/<collection>_<set>_<tier>.png`.
- Set key convention: `'<collection>/<set>'`, e.g. `'cassiopea/rings'`.

---

## File Structure

| File | Responsibility |
|---|---|
| `data/collections.js` | **New.** The manifest: collections, their sets, names, accents, plates, URLs. Data only. |
| `data/copy.js` | **New.** All UI strings, `{ ru: {}, en: {} }`. |
| `src/manifest.js` | **New.** Pure. Flattens the manifest into set descriptors; builds the endless and demo orderings; the accent-contrast rule. |
| `src/rules.js` | **Modify.** Pure game logic, now set-based and mode-aware. |
| `src/board.js` | **New.** Leaderboard: top ten, three letters, daily reset, `localStorage`. |
| `src/kiosk.js` | **New.** Idle reset, attract loop. |
| `src/game.js` | **Modify.** Rendering, input, screen flow, i18n application. |
| `src/sfx.js` | **Modify.** One line: muted by default. |
| `sw.js` | **New.** Cache-first service worker. |
| `index.html` | **Modify.** Screens, `data-i18n` attributes, personal layer removed. |
| `style.css` | **Modify.** Accent as a runtime custom property; new screens. |
| `tests.html` | **Modify.** Rules assertions, rewritten for sets. |
| `smoke.html` | **Modify.** Measures seconds per set, not drags to 35. |
| `tuning.html` | **Modify.** Sweeps `PIECES_PER_SET` and 3- vs 4-tier chains. |
| `tools/cut.py` | **Modify.** `CROPS` re-keyed to `<collection>_<set>_<tier>`. |
| `tools/qr.py` | **New.** Generates `assets/qr/*.png` from the manifest URLs. |
| `LICENSE`, `README.md`, `docs/DEVELOPING.md` | **Modify.** Rights, badges, kiosk operations, set delivery format. |

---

### Task 1: Baseline — commit the inherited tree and record the harness

Nothing is safe to change until the starting point is in git and the harness has a
reading. The code is currently untracked.

**Files:**
- Modify: none
- Create: `docs/superpowers/baseline-2026-09-03.md`

- [ ] **Step 1: Verify the larders are excluded before anything is staged**

```bash
git status --porcelain | grep -iE "PROMO|choosed" && echo "STOP — larder is visible to git" || echo "safe"
git add -An . | wc -l    # expect ~37 files
```

Expected: `safe`, and a file count under 50. If `PROMO_Auris/` or `choosed/` appear,
stop and fix `.gitignore` before doing anything else.

- [ ] **Step 2: Open the harness and record the baseline**

Open `tests.html` and `smoke.html` in a browser. Copy the final `RESULT` line of
each into `docs/superpowers/baseline-2026-09-03.md`, with the date and the commit
that will be made in step 3.

Expected: `tests.html` shows ALL PASS. `smoke.html` shows ALL PASS with a median
around 21-26 drags. If either fails *before* any change, record that too — it is
the baseline, not a blocker.

- [ ] **Step 3: Commit the tree as inherited**

```bash
git add .
git commit -m "Import the ref-35 code as the kiosk baseline"
```

- [ ] **Step 4: Commit the baseline record**

```bash
git add docs/superpowers/baseline-2026-09-03.md
git commit -m "Record the pre-change harness baseline"
```

---

### Task 2: The manifest and its flattener

**Files:**
- Create: `data/collections.js`
- Create: `src/manifest.js`
- Modify: `tests.html` (add a manifest section)

**Interfaces:**
- Produces: `window.Collections` — an array of collection objects.
- Produces: `window.Manifest` with:
  - `Manifest.sets(collections) -> [{key, collection, set, tiers}]` — every set, in manifest order.
  - `Manifest.endlessOrder(collections, rnd) -> [descriptor]` — round-robin across collections so the opening three are never one collection, then the rest shuffled.
  - `Manifest.demoOrder(collections, featuredId, rnd) -> [descriptor]` — the featured collection's sets first, then fillers ordered by descending accent contrast.
  - `Manifest.hue(hex) -> number` — 0..360.
  - `Manifest.find(collections, key) -> {collection, set}` — for labels and plates.

- [ ] **Step 1: Write the failing tests**

Add to `tests.html`, before the closing `</script>`:

```javascript
/* --- manifest ------------------------------------------------------------- */
var M = Manifest;
var FIX = [
  { id: 'aa', accent: '#ff0000', sets: [ { id: 's1', tiers: 3 }, { id: 's2', tiers: 4 } ] },
  { id: 'bb', accent: '#00ff00', sets: [ { id: 's1', tiers: 3 } ] },
  { id: 'cc', accent: '#0000ff', sets: [ { id: 's1', tiers: 3 } ] }
];

eq('sets flattens every set', M.sets(FIX).length, 4);
eq('a descriptor key is collection/set', M.sets(FIX)[0].key, 'aa/s1');
eq('a descriptor carries its tier cap', M.sets(FIX)[1].tiers, 4);
eq('a descriptor defaults to three tiers',
   M.sets([{ id: 'z', accent: '#000', sets: [{ id: 's' }] }])[0].tiers, 3);

var order = M.endlessOrder(FIX, function () { return 0.5; });
eq('endless order covers every set', order.length, 4);
var firstThree = order.slice(0, 3).map(function (d) { return d.collection; });
eq('the opening three are three different collections',
   firstThree.slice().sort().join(','), 'aa,bb,cc');

var demo = M.demoOrder(FIX, 'aa', function () { return 0.5; });
eq('demo deals the featured collection first', demo[0].collection, 'aa');
eq('demo deals every featured set before any filler', demo[1].collection, 'aa');
ok('demo fills the third slot from elsewhere', demo[2].collection !== 'aa');
eq('demo still offers every set', demo.length, 4);

eq('hue of red is 0', Math.round(M.hue('#ff0000')), 0);
eq('hue of green is 120', Math.round(M.hue('#00ff00')), 120);
eq('hue of blue is 240', Math.round(M.hue('#0000ff')), 240);

eq('find resolves a key to its pair', M.find(FIX, 'aa/s2').set.id, 's2');
eq('find resolves the collection too', M.find(FIX, 'aa/s2').collection.id, 'aa');
eq('find returns null for an unknown key', M.find(FIX, 'nope/nope'), null);

/* The real manifest must satisfy the same invariants the fixtures do. */
var real = M.sets(Collections);
ok('the real manifest has at least three sets', real.length >= 3);
ok('every real set declares three or four tiers',
   real.every(function (d) { return d.tiers === 3 || d.tiers === 4; }));
ok('every real set key is unique',
   real.map(function (d) { return d.key; })
       .filter(function (k, i, a) { return a.indexOf(k) !== i; }).length === 0);
ok('every real collection has an accent and a url',
   Collections.every(function (c) { return !!c.accent && !!c.url; }));
```

Add the two script tags to `tests.html` above `src/rules.js`:

```html
<script src="data/collections.js"></script>
<script src="src/manifest.js"></script>
```

- [ ] **Step 2: Run the tests to verify they fail**

Open `tests.html`. Expected: a JS error, `Manifest is not defined`, and the page
stops rendering results.

- [ ] **Step 3: Write `data/collections.js`**

The three existing chains become one set each. Set ids describe the jewellery, so
the sprite filenames stay readable. Plate bodies are placeholders in the sense that
the *copy* is provisional — the structure is not, and every field must be present.

```javascript
/* The single source of truth for what the game deals. Adding a collection is a
   row here plus its art — no code changes. Consumed by src/manifest.js, and
   never by src/rules.js, which is kept ignorant of names on purpose. */
window.Collections = [
  {
    id: 'cassiopea',
    name: { ru: 'Кассиопея', en: 'Cassiopea' },
    accent: '#8e1f22',
    hero: 'assets/plates/cassiopea.jpg',
    url: 'https://aurisjewellery.com/',
    plate: {
      ru: { body: 'Кольца и хеликсы глубокого красного. Гранат, сталь, ручная посадка камня.' },
      en: { body: 'Rings and helixes in deep red. Garnet, steel, hand-set stones.' }
    },
    sets: [
      { id: 'rings', tiers: 3,
        name: { ru: 'Кольца', en: 'Rings' },
        plate: {
          ru: { ref: 'REF. 01', body: 'Сегментное кольцо, три размера.',
                specs: { 'материал': 'сталь 316L', 'камень': 'гранат' } },
          en: { ref: 'REF. 01', body: 'Segment ring, three sizes.',
                specs: { 'material': '316L steel', 'stone': 'garnet' } }
        } }
    ]
  },
  {
    id: 'marchesa',
    name: { ru: 'Маркеза', en: 'Marchesa' },
    accent: '#1f3f8e',
    hero: 'assets/plates/marchesa.jpg',
    url: 'https://aurisjewellery.com/',
    plate: {
      ru: { body: 'Сапфировая линия. Холодный синий, огранка маркиз.' },
      en: { body: 'The sapphire line. Cold blue, marquise cut.' }
    },
    sets: [
      { id: 'sapphire', tiers: 3,
        name: { ru: 'Сапфир', en: 'Sapphire' },
        plate: {
          ru: { ref: 'REF. 02', body: 'Сапфировая подвеска, три размера.',
                specs: { 'материал': 'титан', 'камень': 'сапфир' } },
          en: { ref: 'REF. 02', body: 'Sapphire pendant, three sizes.',
                specs: { 'material': 'titanium', 'stone': 'sapphire' } }
        } }
    ]
  },
  {
    id: 'farfalla',
    name: { ru: 'Фарфалла', en: 'Farfalla' },
    accent: '#6a8e1f',
    hero: 'assets/plates/farfalla.jpg',
    url: 'https://aurisjewellery.com/',
    plate: {
      ru: { body: 'Бабочки на коже. От монохрома к пастели и к самоцвету.' },
      en: { body: 'Butterflies on skin. Mono to pastel to jewel.' }
    },
    sets: [
      { id: 'butterflies', tiers: 3,
        name: { ru: 'Бабочки', en: 'Butterflies' },
        plate: {
          ru: { ref: 'REF. 03', body: 'Бабочка, три размера.',
                specs: { 'материал': 'титан', 'покрытие': 'анодирование' } },
          en: { ref: 'REF. 03', body: 'Butterfly, three sizes.',
                specs: { 'material': 'titanium', 'finish': 'anodised' } }
        } }
    ]
  }
];
```

- [ ] **Step 4: Write `src/manifest.js`**

```javascript
/* Turns the manifest into what rules.js actually needs: a flat, ordered list of
   set descriptors. Pure — no DOM, no state. The orderings live here rather than
   in rules.js so the rules never learn what a "collection" or a "featured"
   collection is; to them a run is just three chains and a queue. */
(function (root) {
  'use strict';

  function sets(collections) {
    var out = [];
    collections.forEach(function (c) {
      (c.sets || []).forEach(function (s) {
        out.push({
          key: c.id + '/' + s.id,
          collection: c.id,
          set: s.id,
          tiers: s.tiers || 3
        });
      });
    });
    return out;
  }

  function find(collections, key) {
    var parts = String(key).split('/');
    for (var i = 0; i < collections.length; i++) {
      if (collections[i].id !== parts[0]) continue;
      var list = collections[i].sets || [];
      for (var j = 0; j < list.length; j++) {
        if (list[j].id === parts[1]) return { collection: collections[i], set: list[j] };
      }
    }
    return null;
  }

  /* Fisher-Yates against an injected rnd, so orderings are reproducible in tests
     and per-session in play. */
  function shuffle(list, rnd) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function hue(hex) {
    var h = String(hex).replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var r = parseInt(h.slice(0, 2), 16) / 255,
        g = parseInt(h.slice(2, 4), 16) / 255,
        b = parseInt(h.slice(4, 6), 16) / 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    if (!d) return 0;
    var deg;
    if (max === r) deg = ((g - b) / d) % 6;
    else if (max === g) deg = (b - r) / d + 2;
    else deg = (r - g) / d + 4;
    deg *= 60;
    return deg < 0 ? deg + 360 : deg;
  }

  function hueDistance(a, b) {
    var d = Math.abs(hue(a) - hue(b));
    return d > 180 ? 360 - d : d;
  }

  /* Round-robin the opening so the first tray is never one collection — the same
     reason createState deals its opening hand round-robin. The tail is shuffled
     so two clients in a row do not get the same climb. */
  function endlessOrder(collections, rnd) {
    var byCollection = collections.map(function (c) {
      return sets([c]);
    }).filter(function (list) { return list.length; });

    var head = [], tail = [], round = 0, taken = true;
    while (taken) {
      taken = false;
      for (var i = 0; i < byCollection.length; i++) {
        var d = byCollection[i][round];
        if (!d) continue;
        taken = true;
        (head.length < 3 ? head : tail).push(d);
      }
      round++;
    }
    return head.concat(shuffle(tail, rnd));
  }

  /* The featured collection's sets first, then fillers ordered by how far their
     accent sits from the featured one — a demo tray that reads as three different
     things even when two of them are borrowed. */
  function demoOrder(collections, featuredId, rnd) {
    var featured = null;
    collections.forEach(function (c) { if (c.id === featuredId) featured = c; });
    if (!featured) return endlessOrder(collections, rnd);

    var mine = shuffle(sets([featured]), rnd);
    var others = collections.filter(function (c) { return c.id !== featuredId; });
    others.sort(function (a, b) {
      return hueDistance(featured.accent, b.accent) - hueDistance(featured.accent, a.accent);
    });

    var fillers = [];
    others.forEach(function (c) { fillers = fillers.concat(sets([c])); });
    return mine.concat(fillers);
  }

  root.Manifest = {
    sets: sets, find: find, shuffle: shuffle,
    hue: hue, hueDistance: hueDistance,
    endlessOrder: endlessOrder, demoOrder: demoOrder
  };
})(typeof window !== 'undefined' ? window : globalThis);
```

- [ ] **Step 5: Run the tests to verify they pass**

Open `tests.html`. Expected: every manifest assertion `ok`, and the pre-existing
rules assertions still passing (they have not been touched yet).

- [ ] **Step 6: Commit**

```bash
git add data/collections.js src/manifest.js tests.html
git commit -m "Add the collection manifest and its flattener"
```

---

### Task 3: Rules — sets replace collections

The heart of the change. After this task `rules.js` knows nothing about
`cassiopea`, and a piece knows its own tier cap.

**Files:**
- Modify: `src/rules.js:6-9` (constants), `:46-100` (createState/spawn), `:107-112` (canMerge)
- Modify: `tests.html` (rules section rewritten)

**Interfaces:**
- Consumes: `Manifest.sets()` descriptors — `{key, collection, set, tiers}`.
- Produces:
  - `R.TRAY_SETS = 3`
  - `R.createState(seed, opts)` where `opts = { sets: [descriptor], mode: 'endless'|'demo' }`. Throws if fewer than three sets.
  - piece shape `{ id, key, tier, top, born }` — `top` is the set's tier cap.
  - `R.canMerge(a, b)` — unchanged signature, now comparing `key` and `a.tier < a.top`.
  - `R.setsWantingPartner(state) -> [key]`
  - `R.spawn(state, forceIndex, forceKey)`
  - `state.tray` (3 descriptors), `state.queue`, `state.done`, `state.all`

- [ ] **Step 1: Write the failing tests**

Replace the construction, canMerge and spawn sections of `tests.html`. The helper
functions change shape too, so replace lines 15-26 with:

```javascript
function fixture() {
  return [
    { key: 'aa/s', collection: 'aa', set: 's', tiers: 3 },
    { key: 'bb/s', collection: 'bb', set: 's', tiers: 3 },
    { key: 'cc/s', collection: 'cc', set: 's', tiers: 3 },
    { key: 'dd/s', collection: 'dd', set: 's', tiers: 4 }
  ];
}
function fresh(seed) {
  return R.createState(seed === undefined ? 1 : seed, { sets: fixture() });
}
function blank(seed) {
  var s = fresh(seed);
  s.cells = new Array(R.CELLS).fill(null); s.score = 0; return s;
}
function put(s, i, key, tier, top) {
  s.cells[i] = { id: ++s.seq, key: key, tier: tier, top: top || 3, born: s.seq };
  return s.cells[i];
}
function evs(list, type) { return list.filter(function (e) { return e.type === type; }); }
function blankPair(key, tier, top) {
  var s = blank(); put(s, 0, key, tier, top); put(s, 1, key, tier, top); return s;
}
```

Then the new assertions:

```javascript
/* --- construction ------------------------------------------------------- */
var s = fresh(42);
eq('createState fills the tray with START_PIECES', R.CELLS - R.emptyCells(s).length, 10);
ok('every starting piece is tier 1', s.cells.every(function (p) { return !p || p.tier === 1; }));
eq('createState starts at zero score', s.score, 0);
eq('the tray holds exactly three sets', s.tray.length, 3);
eq('the rest of the sets wait in the queue', s.queue.length, 1);
eq('nothing is done yet', s.done.length, 0);
ok('the opening hand only deals sets on the tray',
   s.cells.every(function (p) {
     return !p || s.tray.some(function (d) { return d.key === p.key; });
   }));
ok('every piece carries its own tier cap',
   s.cells.every(function (p) { return !p || p.top === 3 || p.top === 4; }));

var threw = false;
try { R.createState(1, { sets: fixture().slice(0, 2) }); } catch (err) { threw = true; }
ok('createState refuses fewer than three sets', threw);

var a1 = fresh(7), a2 = fresh(7), a3 = fresh(8);
eq('same seed replays the same tray', JSON.stringify(a1.cells), JSON.stringify(a2.cells));
ok('a different seed gives a different tray', JSON.stringify(a1.cells) !== JSON.stringify(a3.cells));

/* --- canMerge ------------------------------------------------------------ */
var A = { key: 'aa/s', tier: 1, top: 3 }, B = { key: 'aa/s', tier: 1, top: 3 };
ok('twins merge', R.canMerge(A, B));
ok('different sets do not merge', !R.canMerge(A, { key: 'bb/s', tier: 1, top: 3 }));
ok('two sets of the same collection do not merge',
   !R.canMerge({ key: 'aa/s1', tier: 1, top: 3 }, { key: 'aa/s2', tier: 1, top: 3 }));
ok('different tiers do not merge', !R.canMerge(A, { key: 'aa/s', tier: 2, top: 3 }));
ok('top tier cannot merge further',
   !R.canMerge({ key: 'aa/s', tier: 3, top: 3 }, { key: 'aa/s', tier: 3, top: 3 }));
ok('a four-tier set still merges at tier 3',
   R.canMerge({ key: 'dd/s', tier: 3, top: 4 }, { key: 'dd/s', tier: 3, top: 4 }));
ok('a piece cannot merge with itself', !R.canMerge(A, A));
ok('null never merges', !R.canMerge(A, null) && !R.canMerge(null, null));

/* --- spawn draws only from the tray -------------------------------------- */
s = fresh(3);
var spawned = R.spawn(s);
ok('a spawn belongs to a set on the tray',
   !spawned.length || s.tray.some(function (d) { return d.key === spawned[0].piece.key; }));
eq('a forced spawn honours the key', R.spawn(blank(), 0, 'bb/s')[0].piece.key, 'bb/s');
eq('a forced spawn carries that set tier cap',
   R.spawn(blank(), 0, 'dd/s')[0].piece.top, 4);

s = blank();
put(s, 0, 'aa/s', 1); put(s, 1, 'aa/s', 1); put(s, 2, 'bb/s', 1);
eq('a set with an odd number of tier-1s wants a partner',
   R.setsWantingPartner(s).join(','), 'bb/s');
```

Also update the deadlock section, which used `R.COLLECTIONS`:

```javascript
s = blank();
for (var i = 0; i < R.CELLS; i++) put(s, i, fixture()[i % 3].key, (i % 2) + 1);
ok('a full tray with a twin still has a move', R.hasLegalMove(s));
```

- [ ] **Step 2: Run the tests to verify they fail**

Open `tests.html`. Expected: FAIL on `the tray holds exactly three sets` (undefined),
`createState refuses fewer than three sets`, `different sets do not merge`, and the
spawn assertions.

- [ ] **Step 3: Rewrite the affected parts of `src/rules.js`**

Replace lines 6-9:

```javascript
  var GRID = 5;
  var CELLS = GRID * GRID;
  var TRAY_SETS = 3;                 // measured; see the tuning note below
```

Replace `createState` (lines 46-62):

```javascript
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
```

Replace `collectionsWantingPartner` (lines 76-83) with:

```javascript
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
```

Replace `spawn` (lines 85-100):

```javascript
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
```

Replace `canMerge` (lines 107-112):

```javascript
  function canMerge(a, b) {
    return !!a && !!b && a !== b
        && a.key === b.key
        && a.tier === b.tier
        && a.tier < a.top;
  }
```

In `apply`, the merged piece carries the cap forward — replace lines 145-150:

```javascript
    var merged = {
      id: ++state.seq,
      key: a.key,
      tier: a.tier + 1,
      top: a.top,
      born: state.seq
    };
```

and every `merged.tier === MAX_TIER` becomes `merged.tier === merged.top`
(lines 161 and 171).

Update the export block (lines 209-218): drop `COLLECTIONS` and `MAX_TIER`, add
`TRAY_SETS` and `setsWantingPartner`.

- [ ] **Step 4: Run the tests to verify they pass**

Open `tests.html`. Expected: ALL PASS for construction, canMerge, spawn, classify,
move and merge. The ear, completion and scoring sections will still fail — Task 4
owns those. Note which ones so the next task can confirm it fixed exactly them.

- [ ] **Step 5: Commit**

```bash
git add src/rules.js tests.html
git commit -m "Make the set, not the collection, the unit on the tray"
```

---

### Task 4: Rules — modes, flat scoring, no ear

**Files:**
- Modify: `src/rules.js:11-32` (tuning block), `:102-105` (pointsFor), `:201-207` (earFilled/isComplete)
- Modify: `tests.html` (ear section deleted, scoring and completion rewritten)

**Interfaces:**
- Produces: `R.SCORING` — a flat table, `{2:1, 3:1, 4:1}`; `R.pointsFor(state, tier)`; `R.isComplete(state)`.
- Removed: `R.TARGET`, `R.EAR_SLOTS`, `R.earFilled`, `R.MAX_TIER`, `SCORING.birthday`.

- [ ] **Step 1: Write the failing tests**

Delete the `--- ear meter ---` section of `tests.html` (lines 142-148) and the
`--- endless scores differently ---` section (155-162) outright. Replace the
completion section with:

```javascript
/* --- scoring: flat, every merge counts ------------------------------------ */
s = blank(); put(s, 0, 'aa/s', 1); put(s, 1, 'aa/s', 1);
R.apply(s, 0, 1);
eq('an intermediate merge scores one', s.score, 1);

s = blank(); put(s, 0, 'aa/s', 2); put(s, 1, 'aa/s', 2);
R.apply(s, 0, 1);
eq('a finished piece also scores one', s.score, 1);
eq('there is no target to land on', R.TARGET, undefined);
eq('the ear meter is gone', R.earFilled, undefined);

/* --- completion ----------------------------------------------------------- */
var e1 = R.createState(1, { sets: fixture(), mode: 'endless' });
e1.score = 9999;
ok('endless never completes, whatever the score', !R.isComplete(e1));

var d1 = R.createState(1, { sets: fixture(), mode: 'demo' });
ok('demo does not complete while sets remain', !R.isComplete(d1));
eq('demo remembers the three it opened with', d1.opening.length, 3);
d1.done = d1.opening.slice();
ok('demo completes when its opening three are done', R.isComplete(d1));

var d2 = R.createState(1, { sets: fixture(), mode: 'demo' });
d2.done = [d2.opening[0], d2.opening[1]];
ok('demo does not complete on two of three', !R.isComplete(d2));
```

- [ ] **Step 2: Run the tests to verify they fail**

Open `tests.html`. Expected: FAIL on `an intermediate merge scores one` (got 0),
`there is no target to land on`, `the ear meter is gone`, and the demo completion
assertions.

- [ ] **Step 3: Rewrite the scoring and completion parts of `src/rules.js`**

Replace the tuning comment block and constants (lines 11-32):

```javascript
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
```

Replace `pointsFor` (lines 102-105):

```javascript
  function pointsFor(state, tier) {
    return SCORING[tier] || 0;
  }
```

Replace `earFilled` and `isComplete` (lines 201-207):

```javascript
  /* Endless has no completion at all — it ends when the player presses стоп,
     which is a UI action, not a rule. Demo ends when the three sets it opened
     with are all retired. */
  function isComplete(state) {
    if (state.mode !== 'demo') return false;
    return state.opening.every(function (k) { return state.done.indexOf(k) >= 0; });
  }
```

Update the export block: remove `TARGET`, `EAR_SLOTS`, `earFilled`; add
`PIECES_PER_SET`.

- [ ] **Step 4: Run the tests to verify they pass**

Open `tests.html`. Expected: ALL PASS.

- [ ] **Step 5: Commit**

```bash
git add src/rules.js tests.html
git commit -m "Replace the target and the ear meter with two modes"
```

---

### Task 5: Rules — finishing a set, retirement and rotation

**Files:**
- Modify: `src/rules.js` (`apply`, plus a new `retire`)
- Modify: `tests.html`

**Interfaces:**
- Produces:
  - `R.PIECES_PER_SET = 3`
  - `state.finished` — `{key: count}`
  - event `{ type: 'setComplete', key: string, index: number }` where `index` is the tray slot the set occupied
  - `R.retire(state, key) -> events` — exported for tests, called internally by `apply`

- [ ] **Step 1: Write the failing tests**

```javascript
/* --- finishing a set ------------------------------------------------------ */
function finishOne(s, key, top) {
  /* One finished piece: put two top-1 pieces down and merge them. */
  var t = (top || 3) - 1;
  put(s, 0, key, t, top || 3); put(s, 1, key, t, top || 3);
  return R.apply(s, 0, 1);
}

s = blank();
var ev = finishOne(s, 'aa/s');
eq('a finished piece is counted against its set', s.finished['aa/s'], 1);
eq('one finished piece does not retire the set', s.done.length, 0);
eq('no setComplete event yet', evs(ev, 'setComplete').length, 0);

s = blank();
s.finished['aa/s'] = R.PIECES_PER_SET - 1;
ev = finishOne(s, 'aa/s');
eq('the threshold retires the set', s.done[0], 'aa/s');
eq('a retirement emits setComplete', evs(ev, 'setComplete').length, 1);
eq('setComplete names the set', evs(ev, 'setComplete')[0].key, 'aa/s');
eq('the tray is still three sets after a retirement', s.tray.length, 3);
ok('the retired set is off the tray',
   !s.tray.some(function (d) { return d.key === 'aa/s'; }));
ok('the incoming set came from the queue',
   s.tray.some(function (d) { return d.key === 'dd/s'; }));

/* --- retirement clears the retired chain off the tray --------------------- */
s = blank();
put(s, 5, 'aa/s', 1); put(s, 6, 'aa/s', 2); put(s, 7, 'bb/s', 1);
ev = R.retire(s, 'aa/s');
ok('no piece of a retired set survives on the tray',
   s.cells.every(function (p) { return !p || p.key !== 'aa/s'; }));
ok('other sets are untouched', s.cells[7] && s.cells[7].key === 'bb/s');
eq('retirement dissolves what it removed', evs(ev, 'dissolve').length, 2);
ok('the incoming set seeds the freed cells', evs(ev, 'spawn').length >= 1);
ok('the seeded pieces belong to the incoming set',
   evs(ev, 'spawn').every(function (x) {
     return s.tray.some(function (d) { return d.key === x.piece.key; });
   }));
eq('setComplete comes before the dissolves', ev[0].type, 'setComplete');

/* --- endless never runs dry ----------------------------------------------- */
s = R.createState(5, { sets: fixture(), mode: 'endless' });
s.queue = [];
var trayBefore = s.tray.map(function (d) { return d.key; });
R.retire(s, trayBefore[0]);
eq('endless refills the queue rather than shrinking the tray', s.tray.length, 3);
ok('the refill never re-deals a set already on the tray',
   s.tray.map(function (d) { return d.key; })
     .filter(function (k, i, a) { return a.indexOf(k) !== i; }).length === 0);

/* --- demo stops rather than recycling -------------------------------------- */
s = R.createState(5, { sets: fixture(), mode: 'demo' });
s.queue = [];
var demoTray = s.tray.map(function (d) { return d.key; });
R.retire(s, demoTray[0]);
eq('demo lets the tray shrink when the queue is empty', s.tray.length, 2);
```

- [ ] **Step 2: Run the tests to verify they fail**

Expected: FAIL on `a finished piece is counted against its set` (undefined) and
every assertion after it; `R.retire is not a function`.

- [ ] **Step 3: Implement counting and retirement in `src/rules.js`**

Add after `relieve`:

```javascript
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
```

In `apply`, inside the `merged.tier === merged.top` branch (after the `score`
event is pushed, before the refill spawns), add:

```javascript
    if (merged.tier === merged.top) {
      state.cells[to] = null;
      events.push({ type: 'score', index: to, piece: merged, points: gained });
      state.finished[merged.key] = (state.finished[merged.key] || 0) + 1;
    }

    events = events.concat(spawn(state));
    if (merged.tier === merged.top) events = events.concat(spawn(state));

    /* Retire last, so the dissolve and seed events land after the refill and the
       renderer plays them in the order they read. */
    if (merged.tier === merged.top &&
        state.finished[merged.key] >= PIECES_PER_SET) {
      events = events.concat(retire(state, merged.key));
    }

    return events;
```

Export `retire` and `PIECES_PER_SET`.

- [ ] **Step 4: Run the tests to verify they pass**

Open `tests.html`. Expected: ALL PASS.

- [ ] **Step 5: Commit**

```bash
git add src/rules.js tests.html
git commit -m "Retire a set at the threshold and rotate the next one in"
```

---

### Task 6: Rules — relieve is unconditional and the tray can never dead-end

The single most important property in the file. It gets its own task because it is
the one a reviewer should be able to reject on its own.

**Files:**
- Modify: `src/rules.js:186-199` (comment only — the function is already correct)
- Modify: `tests.html`
- Modify: `src/game.js:236-243` (remove the endless branch)

- [ ] **Step 1: Write the failing tests**

```javascript
/* --- relieve: the tray can never dead-end --------------------------------- */
s = blank();
var first = put(s, 3, 'aa/s', 1);
put(s, 4, 'bb/s', 1); put(s, 5, 'cc/s', 1);
e = R.relieve(s);
eq('relieve dissolves the oldest tier-1', s.cells[3], null);
eq('relieve reports what it dissolved', e[0].piece.id, first.id);
eq('relieve frees exactly one cell', R.emptyCells(s).length, R.CELLS - 2);

s = blank(); put(s, 0, 'aa/s', 2);
eq('relieve never touches a tier-2', R.relieve(s).length, 0);

/* The case that only exists now that sets retire mid-game: a tray full of
   pieces belonging to sets that have LEFT. Nothing can merge, nothing spawns
   into them, and endless has no end state to fall through to. */
var stranded = blank();
for (i = 0; i < R.CELLS; i++) put(stranded, i, 'zz/gone', 1);
ok('a tray of stranded tier-1s is jammed', !R.hasLegalMove(stranded));
ok('relieve still frees a cell there', R.relieve(stranded).length === 1);
ok('a legal move exists once relieve has run', R.hasLegalMove(stranded));

/* Drive it hard: retire every set in turn and confirm the tray never reaches a
   state that relieve cannot open. */
var loop = R.createState(11, { sets: fixture(), mode: 'endless' });
var guard = 0, stuck = false;
while (guard++ < 2000) {
  if (!R.hasLegalMove(loop)) {
    if (!R.relieve(loop).length && !R.emptyCells(loop).length) { stuck = true; break; }
  }
  var moves = [];
  for (i = 0; i < R.CELLS; i++) {
    for (var j = 0; j < R.CELLS; j++) {
      if (i !== j && R.classify(loop, i, j) === 'merge') moves.push([i, j]);
    }
  }
  if (moves.length) R.apply(loop, moves[0][0], moves[0][1]);
  else if (R.emptyCells(loop).length) R.spawn(loop);
}
ok('two thousand turns of endless never dead-end', !stuck);
ok('endless kept the tray at three sets throughout', loop.tray.length === 3);
```

- [ ] **Step 2: Run the tests to verify they fail**

Expected: FAIL on `relieve still frees a cell there` if `relieve` was made
set-aware by mistake in an earlier task, and possibly on the loop assertion.
If they pass immediately, that is a real result — record it and continue; the
game.js change in step 3 is still required.

- [ ] **Step 3: Make the unconditional rule real in `src/game.js`**

Replace lines 236-243:

```javascript
    /* The tray must never dead-end in front of a client in the chair. Endless
       has no end state to fall through to, so this is not a courtesy any more —
       it is the only thing standing between a jam and a board that can only be
       left by the idle timer. */
    if (!R.hasLegalMove(state)) {
      setTimeout(function () { runEvents(R.relieve(state)); }, 420);
    }
```

Update the comment above `relieve` in `rules.js` (lines 186-187):

```javascript
  /* Unconditional. When the tray jams, the oldest tier-1 quietly dissolves.
     Pieces of a retired set are the common case now: they cannot merge with
     anything and nothing will ever spawn a partner for them. */
```

- [ ] **Step 4: Run the tests to verify they pass**

Open `tests.html`. Expected: ALL PASS, including the two-thousand-turn loop.

- [ ] **Step 5: Commit**

```bash
git add src/rules.js src/game.js tests.html
git commit -m "Make relieve unconditional and prove the tray cannot dead-end"
```

---

### Task 7: The leaderboard

**Files:**
- Create: `src/board.js`
- Modify: `tests.html`

**Interfaces:**
- Produces:
  - `Board.attach(storage, todayFn)` — dependency injection for tests; defaults to `localStorage` and the real local date.
  - `Board.today() -> 'YYYY-MM-DD'`
  - `Board.rows() -> [{initials, score}]` — top ten, descending, empty if the stored date is not today
  - `Board.qualifies(score) -> boolean`
  - `Board.add(initials, score) -> rows`

- [ ] **Step 1: Write the failing tests**

```javascript
/* --- leaderboard ---------------------------------------------------------- */
function fakeStore() {
  var mem = {};
  return {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; },
    setItem: function (k, v) { mem[k] = String(v); },
    _mem: mem
  };
}
var store = fakeStore(), day = '2026-09-03';
Board.attach(store, function () { return day; });

eq('a fresh board is empty', Board.rows().length, 0);
ok('any score qualifies for an empty board', Board.qualifies(1));

Board.add('АБВ', 40);
eq('a score lands on the board', Board.rows().length, 1);
eq('the board keeps the initials', Board.rows()[0].initials, 'АБВ');

Board.add('ГДЕ', 90);
eq('the board sorts by score, highest first', Board.rows()[0].score, 90);

for (var b = 0; b < 12; b++) Board.add('X' + b, 100 + b);
eq('the board holds ten rows at most', Board.rows().length, 10);
eq('the top row is the highest score', Board.rows()[0].score, 111);
ok('a score below the tenth does not qualify', !Board.qualifies(1));

eq('initials are cut to three characters', Board.add('ABCDEF', 500)[0].initials, 'ABC');
eq('initials are upper-cased', Board.add('xyz', 600)[0].initials, 'XYZ');

day = '2026-09-04';
eq('the board resets when the date changes', Board.rows().length, 0);
ok('any score qualifies again the next day', Board.qualifies(1));
```

Add `<script src="src/board.js"></script>` to `tests.html`.

- [ ] **Step 2: Run the tests to verify they fail**

Expected: `Board is not defined`.

- [ ] **Step 3: Write `src/board.js`**

```javascript
/* Top ten by score, three-letter initials, cleared whenever the tablet's local
   calendar date changes. Three letters needs no on-screen keyboard, limits what
   one client can spell on a screen the next one will read, and keeps the studio
   from holding personal data it has no reason to hold. */
(function (root) {
  'use strict';

  var KEY = 'auris.board.v1';
  var SIZE = 10;
  var store = null;
  var todayFn = null;

  function attach(storage, fn) {
    store = storage;
    todayFn = fn;
  }

  function today() {
    if (todayFn) return todayFn();
    var d = new Date();
    var m = String(d.getMonth() + 1);
    var day = String(d.getDate());
    return d.getFullYear() + '-' + (m.length < 2 ? '0' + m : m) + '-' +
           (day.length < 2 ? '0' + day : day);
  }

  /* Every read goes through here, so a stale board is never returned even if
     the tablet sat on the board screen across midnight. */
  function read() {
    if (!store) return { date: today(), rows: [] };
    var raw;
    try { raw = store.getItem(KEY); } catch (e) { return { date: today(), rows: [] }; }
    if (!raw) return { date: today(), rows: [] };
    var data;
    try { data = JSON.parse(raw); } catch (e) { return { date: today(), rows: [] }; }
    if (!data || data.date !== today() || !data.rows) return { date: today(), rows: [] };
    return data;
  }

  function write(data) {
    if (!store) return;
    try { store.setItem(KEY, JSON.stringify(data)); } catch (e) { /* full or private */ }
  }

  function rows() {
    return read().rows.slice();
  }

  function qualifies(score) {
    var r = rows();
    if (r.length < SIZE) return true;
    return score > r[r.length - 1].score;
  }

  function add(initials, score) {
    var data = read();
    data.rows.push({
      initials: String(initials).slice(0, 3).toUpperCase(),
      score: score
    });
    data.rows.sort(function (a, b) { return b.score - a.score; });
    data.rows = data.rows.slice(0, SIZE);
    data.date = today();
    write(data);
    return data.rows.slice();
  }

  root.Board = {
    SIZE: SIZE,
    attach: attach, today: today,
    rows: rows, qualifies: qualifies, add: add
  };

  if (typeof localStorage !== 'undefined') attach(localStorage, null);
})(typeof window !== 'undefined' ? window : globalThis);
```

- [ ] **Step 4: Run the tests to verify they pass**

Expected: ALL PASS.

- [ ] **Step 5: Commit**

```bash
git add src/board.js tests.html
git commit -m "Add the daily leaderboard"
```

---

### Task 8: game.js — render sets, drop the ear, carry the mode

**Files:**
- Modify: `src/game.js:11-15` (labels), `:48-69` (makePiece), `:116-142` (showCrown), `:166-197` (HUD), `:207-244` (runEvents), `:377-396` (start), `:398-427` (collections), `:442-476` (acts and deep links)
- Modify: `index.html` (ear markup out, mode buttons in)
- Modify: `style.css` (accent as a runtime property)

**Interfaces:**
- Consumes: `Manifest`, `Collections`, `Rules`, `Board`.
- Produces: `window.Game.start(mode, featuredId)`, `Game.stop()`, `Game.getState()`.

- [ ] **Step 1: Delete the ear from the DOM and the HUD**

In `index.html`, remove the whole `ear-wrap` block (lines 46-55). In `src/game.js`
delete `drawEarDots` (lines 166-180) and both of its call sites (lines 392, 465).

Keep the ear geometry: move the seven points and the SVG paths into
`docs/superpowers/ear-geometry.md` with a one-line note saying they are reserved
for «собери свой сет». Re-deriving those anatomical points later is real work.

Rewrite `drawHud` (lines 182-197):

```javascript
  function drawHud() {
    scoreEl.textContent = state.score;

    /* Pips are progress inside the current set: how many finished pieces this
       chain still owes before it retires. */
    var pips = document.getElementById('set-pips');
    pips.innerHTML = '';
    state.tray.forEach(function (d) {
      var done = state.finished[d.key] || 0;
      var box = document.createElement('div');
      box.className = 'set-pip';
      box.style.setProperty('--accent', accentOf(d.key));
      for (var i = 0; i < R.PIECES_PER_SET; i++) {
        var dot = document.createElement('i');
        if (i < done) dot.className = 'is-set';
        box.appendChild(dot);
      }
      pips.appendChild(box);
    });
  }
```

- [ ] **Step 2: Replace the hardcoded labels with manifest lookups**

Replace `COLLECTION_LABEL` (lines 11-15) with:

```javascript
  var lang = localStorage.getItem('auris.lang') || 'ru';

  function pair(key) { return Manifest.find(Collections, key); }

  function labelOf(key) {
    var p = pair(key);
    if (!p) return '';
    return p.collection.name[lang] + ' · ' + p.set.name[lang];
  }

  function accentOf(key) {
    var p = pair(key);
    return p ? p.collection.accent : '#888';
  }

  function spriteOf(piece) {
    var p = pair(piece.key);
    if (!p) return '';
    return 'assets/pieces/' + p.collection.id + '_' + p.set.id + '_' + piece.tier + '.png';
  }
```

In `makePiece` (lines 48-69) replace the two collection references:

```javascript
    el.dataset.collection = pair(piece.key) ? pair(piece.key).collection.id : '';
    el.style.setProperty('--accent', accentOf(piece.key));
    ...
    face.style.backgroundImage = 'url("' + spriteOf(piece) + '")';
```

In `showCrown` (line 138): `label.textContent = labelOf(piece.collection)` becomes
`label.textContent = labelOf(piece.key);`

In `style.css`, replace the three hardcoded `--cassiopea` / `--marchesa` /
`--farfalla` rules with a single rule reading the runtime property:

```css
.piece { --accent: #8e1f22; }
.piece-face { box-shadow: 0 0 0 2px var(--accent) inset; }
```

- [ ] **Step 3: Handle the new events in `runEvents`**

Add to the event loop in `runEvents` (after the `dissolve` branch, line 223):

```javascript
      } else if (e.type === 'setComplete') {
        pendingPlate = e.key;
      }
```

and after `drawHud()`:

```javascript
    if (pendingPlate) {
      var key = pendingPlate;
      pendingPlate = null;
      setTimeout(function () { showSetPlate(key); }, 420);
    }
```

Declare `var pendingPlate = null;` beside the other module state at line 21.

- [ ] **Step 4: Rewrite `start` to take a mode**

Replace lines 385-396:

```javascript
  function start(mode, featuredId) {
    var seed = (Date.now() ^ (Math.random() * 1e9)) >>> 0;
    var rnd = R.mulberry32(seed);
    var order = mode === 'demo'
      ? Manifest.demoOrder(Collections, featuredId, rnd)
      : Manifest.endlessOrder(Collections, rnd);

    state = R.createState(seed, { sets: order, mode: mode });
    featured = featuredId || null;
    els = {};
    busy = false;
    pendingPlate = null;
    clearSelection();
    buildCells();
    sync();
    drawHud();
    document.body.dataset.mode = mode;
    show('screen-game');
  }
```

- [ ] **Step 5: Rewrite the collections screen against the manifest**

Replace `showCollections` (lines 401-427):

```javascript
  function showCollections() {
    var list = document.getElementById('collection-list');
    list.innerHTML = '';
    Collections.forEach(function (c) {
      var row = document.createElement('section');
      row.className = 'coll-row';
      row.style.setProperty('--accent', c.accent);

      var name = document.createElement('h3');
      name.className = 'coll-name';
      name.textContent = c.name[lang];
      row.appendChild(name);

      (c.sets || []).forEach(function (set) {
        var strip = document.createElement('ol');
        strip.className = 'coll-strip';
        for (var t = 1; t <= (set.tiers || 3); t++) {
          var li = document.createElement('li');
          var img = document.createElement('img');
          img.src = 'assets/pieces/' + c.id + '_' + set.id + '_' + t + '.png';
          img.alt = '';
          li.appendChild(img);
          strip.appendChild(li);
        }
        row.appendChild(strip);
      });
      list.appendChild(row);
    });
    show('screen-collections');
  }
```

- [ ] **Step 6: Update the action table and deep links**

Replace the switch cases (lines 448-449) and the deep-link block (470-476):

```javascript
      case 'play-endless':  start('endless'); break;
      case 'play-demo':     start('demo', btn.dataset.collection || Collections[0].id); break;
      case 'stop':          stopRun(); break;
      case 'contacts':      showContacts(featured); break;
```

```javascript
  (function (hash) {
    if (hash === '#manual') document.getElementById('manual').hidden = false;
    else if (hash === '#game' || hash === '#endless') start('endless');
    else if (hash.indexOf('#demo/') === 0) start('demo', hash.slice(6));
    else if (hash === '#collections') showCollections();
    else if (hash === '#board') showBoard();
    else if (hash === '#contacts') showContacts(null);
  })(location.hash);
```

Add the two script tags to `index.html` before `src/game.js`:

```html
<script src="data/collections.js"></script>
<script src="data/copy.js"></script>
<script src="src/manifest.js"></script>
<script src="src/board.js"></script>
```

- [ ] **Step 7: Verify by driving the real page**

Open `index.html#endless`. Expected: a tray of three chains, pips under the score,
no ear, merges working, a set plate after three finished pieces of one chain, and a
new chain arriving in its place.

- [ ] **Step 8: Commit**

```bash
git add src/game.js index.html style.css docs/superpowers/ear-geometry.md
git commit -m "Render sets from the manifest and retire the ear"
```

---

### Task 9: Screens — стоп, initials, board, and the demo ending

**Files:**
- Modify: `index.html` (four new sections), `style.css`, `src/game.js`

**Interfaces:**
- Consumes: `Board`, `Manifest`, `Collections`.
- Produces: `showSetPlate(key)`, `stopRun()`, `showInitials(score)`, `showBoard()`, `showCollectionPlate(collectionId)`, `showContacts(collectionId)`.

- [ ] **Step 1: Add the screens to `index.html`**

Replace the whole `screen-payoff` section (lines 71-105) with:

```html
<!-- ══ SET PLATE (overlay) ════════════════════════════════════════════════ -->
<div id="set-plate" class="overlay" hidden>
  <article class="plate catalogue">
    <img class="plate-mark" src="assets/logo/mark-dark.png" alt="AURIS">
    <p class="plate-eyebrow" id="set-plate-eyebrow"></p>
    <figure class="cat-shot"><img id="set-plate-shot" src="" alt=""></figure>
    <h1 class="cat-title" id="set-plate-title"></h1>
    <p class="cat-ref" id="set-plate-ref"></p>
    <div class="cat-rule"></div>
    <p class="cat-body" id="set-plate-body"></p>
    <dl class="cat-specs" id="set-plate-specs"></dl>
  </article>
</div>

<!-- ══ COLLECTION PLATE — the demo ending ═════════════════════════════════ -->
<section id="screen-collection-plate" class="screen">
  <article class="plate catalogue">
    <img class="plate-mark" src="assets/logo/mark-dark.png" alt="AURIS">
    <p class="plate-eyebrow" data-i18n="plate.eyebrow"></p>
    <figure class="cat-shot"><img id="coll-plate-hero" src="" alt=""></figure>
    <h1 class="cat-title" id="coll-plate-title"></h1>
    <div class="cat-rule"></div>
    <p class="cat-body" id="coll-plate-body"></p>
    <nav class="cat-menu">
      <button class="btn btn-gold" data-act="demo-again" data-i18n="btn.again"></button>
      <button class="btn" data-act="contacts" data-i18n="btn.contacts"></button>
      <button class="btn btn-quiet" data-act="home" data-i18n="btn.menu"></button>
    </nav>
  </article>
</section>

<!-- ══ INITIALS ═══════════════════════════════════════════════════════════ -->
<section id="screen-initials" class="screen">
  <article class="plate">
    <p class="plate-eyebrow" data-i18n="initials.eyebrow"></p>
    <h2 class="plate-title" data-i18n="initials.title"></h2>
    <p class="initials-score"><span id="initials-score">0</span></p>
    <div class="initials-slots">
      <button class="initials-slot is-on" data-slot="0">A</button>
      <button class="initials-slot" data-slot="1">A</button>
      <button class="initials-slot" data-slot="2">A</button>
    </div>
    <div class="initials-pad" id="initials-pad"></div>
    <nav class="cat-menu">
      <button class="btn btn-gold" data-act="initials-ok" data-i18n="btn.ok"></button>
      <button class="btn btn-quiet" data-act="board" data-i18n="btn.skip"></button>
    </nav>
  </article>
</section>

<!-- ══ BOARD ══════════════════════════════════════════════════════════════ -->
<section id="screen-board" class="screen">
  <article class="plate">
    <button class="plate-close" data-act="home" aria-label="×">×</button>
    <p class="plate-eyebrow" data-i18n="board.eyebrow"></p>
    <h2 class="plate-title" data-i18n="board.title"></h2>
    <ol class="board-list" id="board-list"></ol>
    <p class="board-note" data-i18n="board.note"></p>
    <nav class="cat-menu">
      <button class="btn btn-gold" data-act="play-endless" data-i18n="btn.again"></button>
      <button class="btn btn-quiet" data-act="home" data-i18n="btn.menu"></button>
    </nav>
  </article>
</section>

<!-- ══ CONTACTS ═══════════════════════════════════════════════════════════ -->
<section id="screen-contacts" class="screen">
  <article class="plate">
    <button class="plate-close" data-act="home" aria-label="×">×</button>
    <p class="plate-eyebrow" data-i18n="contacts.eyebrow"></p>
    <h2 class="plate-title" data-i18n="contacts.title"></h2>
    <ul class="qr-list">
      <li>
        <img class="qr" id="qr-auris" src="assets/qr/auris.png" alt="">
        <img class="qr-mark" src="assets/logo/auris-horiz-dark.png" alt="AURIS">
        <span data-i18n="contacts.auris"></span>
      </li>
      <li>
        <img class="qr" src="assets/qr/scalpelburg.png" alt="">
        <img class="qr-mark" src="assets/logo/scalpelburg.png" alt="Scalpelburg">
        <span data-i18n="contacts.scalpelburg"></span>
      </li>
    </ul>
    <nav class="cat-menu">
      <button class="btn btn-quiet" data-act="home" data-i18n="btn.menu"></button>
    </nav>
  </article>
</section>
```

Add the стоп button to the game HUD, beside the mute control (after line 43):

```html
    <button class="btn btn-stop" data-act="stop" data-i18n="btn.stop"></button>
```

Replace the title menu (lines 25-30):

```html
    <nav class="title-menu">
      <button class="btn btn-gold" data-act="play-endless" data-i18n="btn.play"></button>
      <button class="btn" data-act="play-demo" data-i18n="btn.demo"></button>
      <button class="btn" data-act="collections" data-i18n="btn.collections"></button>
      <button class="btn btn-quiet" data-act="board" data-i18n="btn.board"></button>
      <button class="btn btn-quiet" data-act="manual" data-i18n="btn.manual"></button>
      <button class="lang-toggle" data-act="lang">RU / EN</button>
    </nav>
```

- [ ] **Step 2: Implement the screen functions in `src/game.js`**

```javascript
  var PLATE_MS = 3000;
  var featured = null;
  var plateTimer = 0;
  var initials = ['А', 'А', 'А'];
  var slot = 0;

  /* The rung reward. An overlay, not a screen: it dims the tray and is
     tap-skippable, because a client about to be called should not have to wait
     out a reward. */
  function showSetPlate(key) {
    var p = pair(key);
    if (!p) return;
    var plate = (p.set.plate && p.set.plate[lang]) || {};
    document.getElementById('set-plate-eyebrow').textContent = p.collection.name[lang];
    document.getElementById('set-plate-title').textContent = p.set.name[lang];
    document.getElementById('set-plate-ref').textContent = plate.ref || '';
    document.getElementById('set-plate-body').textContent = plate.body || '';
    document.getElementById('set-plate-shot').src =
      'assets/plates/' + p.collection.id + '_' + p.set.id + '.jpg';

    var specs = document.getElementById('set-plate-specs');
    specs.innerHTML = '';
    Object.keys(plate.specs || {}).forEach(function (k) {
      var row = document.createElement('div');
      row.innerHTML = '<dt></dt><dd></dd>';
      row.querySelector('dt').textContent = k;
      row.querySelector('dd').textContent = plate.specs[k];
      specs.appendChild(row);
    });

    var box = document.getElementById('set-plate');
    box.hidden = false;
    box.style.setProperty('--accent', p.collection.accent);
    clearTimeout(plateTimer);
    plateTimer = setTimeout(hideSetPlate, PLATE_MS);

    if (R.isComplete(state)) {
      clearTimeout(plateTimer);
      plateTimer = setTimeout(function () {
        hideSetPlate();
        showCollectionPlate(featured);
      }, PLATE_MS);
    }
  }

  function hideSetPlate() {
    clearTimeout(plateTimer);
    document.getElementById('set-plate').hidden = true;
  }

  document.getElementById('set-plate').addEventListener('click', hideSetPlate);

  /* стоп is a control, not an event: the client is called at an unpredictable
     moment and must be able to leave with their score recorded. */
  function stopRun() {
    if (!state) { show('screen-title'); return; }
    var score = state.score;
    state = null;
    if (Board.qualifies(score) && score > 0) showInitials(score);
    else showBoard();
  }

  function showInitials(score) {
    initials = ['А', 'А', 'А'];
    slot = 0;
    document.getElementById('initials-score').textContent = score;
    pendingScore = score;
    buildPad();
    drawInitials();
    show('screen-initials');
  }

  /* An on-screen alphabet, not a keyboard: three taps and out. */
  function buildPad() {
    var letters = lang === 'ru'
      ? 'АБВГДЕЖЗИКЛМНОПРСТУФХЦЧШЩЭЮЯ'
      : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    var pad = document.getElementById('initials-pad');
    pad.innerHTML = '';
    for (var i = 0; i < letters.length; i++) {
      var b = document.createElement('button');
      b.className = 'pad-key';
      b.textContent = letters[i];
      b.dataset.letter = letters[i];
      pad.appendChild(b);
    }
  }

  function drawInitials() {
    var slots = document.querySelectorAll('.initials-slot');
    for (var i = 0; i < slots.length; i++) {
      slots[i].textContent = initials[i];
      slots[i].classList.toggle('is-on', i === slot);
    }
  }

  function showBoard() {
    var list = document.getElementById('board-list');
    list.innerHTML = '';
    Board.rows().forEach(function (row) {
      var li = document.createElement('li');
      li.innerHTML = '<span class="board-initials"></span><span class="board-score"></span>';
      li.querySelector('.board-initials').textContent = row.initials;
      li.querySelector('.board-score').textContent = row.score;
      list.appendChild(li);
    });
    show('screen-board');
  }

  function showCollectionPlate(collectionId) {
    var c = null;
    Collections.forEach(function (x) { if (x.id === collectionId) c = x; });
    if (!c) c = Collections[0];
    document.getElementById('coll-plate-title').textContent = c.name[lang];
    document.getElementById('coll-plate-body').textContent =
      (c.plate && c.plate[lang] && c.plate[lang].body) || '';
    document.getElementById('coll-plate-hero').src = c.hero;
    document.body.style.setProperty('--accent', c.accent);
    featured = c.id;
    show('screen-collection-plate');
  }

  /* The Auris code points at the collection the client just assembled when they
     arrive from demo, and at the catalogue otherwise. */
  function showContacts(collectionId) {
    var file = 'assets/qr/auris.png';
    if (collectionId) file = 'assets/qr/auris_' + collectionId + '.png';
    document.getElementById('qr-auris').src = file;
    show('screen-contacts');
  }
```

Add the actions:

```javascript
      case 'board':         showBoard(); break;
      case 'demo-again':    start('demo', featured); break;
      case 'initials-ok':
        Board.add(initials.join(''), pendingScore);
        showBoard();
        break;
      case 'lang':
        lang = lang === 'ru' ? 'en' : 'ru';
        localStorage.setItem('auris.lang', lang);
        applyCopy(lang);
        break;
```

and the pad handler:

```javascript
  document.getElementById('initials-pad').addEventListener('click', function (ev) {
    var k = ev.target.closest('.pad-key');
    if (!k) return;
    initials[slot] = k.dataset.letter;
    slot = (slot + 1) % 3;
    drawInitials();
  });

  document.querySelector('.initials-slots').addEventListener('click', function (ev) {
    var s = ev.target.closest('.initials-slot');
    if (!s) return;
    slot = parseInt(s.dataset.slot, 10);
    drawInitials();
  });
```

Declare `var pendingScore = 0;` with the module state.

- [ ] **Step 3: Verify by driving the real page**

- `index.html#endless` → merge until a set retires → the set plate appears and
  auto-hides after three seconds; tapping it dismisses it sooner.
- Press стоп → initials appear → tap three letters → OK → the board shows the row.
- Press стоп again with score 0 → the board appears with no initials step.
- `index.html#demo/cassiopea` → the tray opens on Cassiopea's set plus two
  contrasting fillers → finish all three → the collection plate → contacts.
- `index.html#board` and `index.html#contacts` open directly.

- [ ] **Step 4: Commit**

```bash
git add index.html style.css src/game.js
git commit -m "Add стоп, initials, the board and the demo ending"
```

---

### Task 10: Copy — RU and EN

**Files:**
- Create: `data/copy.js`
- Modify: `src/game.js` (`applyCopy`), `index.html` (`data-i18n` on every string)

**Interfaces:**
- Produces: `window.Copy = { ru: {}, en: {} }`; `applyCopy(lang)` in game.js.

- [ ] **Step 1: Write `data/copy.js`**

Roughly forty keys. Per-collection and per-set strings live in the manifest, not
here, so a new collection brings its own copy.

```javascript
window.Copy = {
  ru: {
    'title.edition': 'Studio Edition',
    'btn.play': 'Играть',
    'btn.demo': 'Коллекция',
    'btn.collections': 'Коллекции',
    'btn.board': 'Рекорды',
    'btn.manual': 'Как играть',
    'btn.stop': 'Стоп',
    'btn.again': 'Ещё раз',
    'btn.contacts': 'Контакты',
    'btn.menu': 'В меню',
    'btn.ok': 'Готово',
    'btn.skip': 'Пропустить',
    'plate.eyebrow': 'Auris',
    'initials.eyebrow': 'Ваш результат',
    'initials.title': 'Три буквы',
    'board.eyebrow': 'Auris',
    'board.title': 'Рекорды дня',
    'board.note': 'Доска обнуляется каждый день.',
    'contacts.eyebrow': 'Auris',
    'contacts.title': 'Забрать с собой',
    'contacts.auris': 'украшения',
    'contacts.scalpelburg': 'студия пирсинга',
    'toast.safe': 'убрано в сейф',
    'pouch': 'добавить на витрину',
    'manual.title': 'Как играть',
    'manual.1': 'Возьмите украшение и перетащите его на такое же.',
    'manual.2': 'Два одинаковых складываются в одно — крупнее.',
    'manual.3': 'Складывать можно только внутри одного набора.',
    'manual.4': 'Цвет ободка подсказывает коллекцию.',
    'manual.5': 'Точки под украшением — его размер.',
    'manual.6': 'Последний размер — украшение готово.',
    'manual.7': 'Не хватает деталей — добавьте на витрину.',
    'manual.8': 'Три готовых украшения — набор собран, приходит следующий.'
  },
  en: {
    'title.edition': 'Studio Edition',
    'btn.play': 'Play',
    'btn.demo': 'Collection',
    'btn.collections': 'Collections',
    'btn.board': 'High scores',
    'btn.manual': 'How to play',
    'btn.stop': 'Stop',
    'btn.again': 'Again',
    'btn.contacts': 'Contacts',
    'btn.menu': 'Menu',
    'btn.ok': 'Done',
    'btn.skip': 'Skip',
    'plate.eyebrow': 'Auris',
    'initials.eyebrow': 'Your score',
    'initials.title': 'Three letters',
    'board.eyebrow': 'Auris',
    'board.title': 'Today’s scores',
    'board.note': 'The board clears every day.',
    'contacts.eyebrow': 'Auris',
    'contacts.title': 'Take it with you',
    'contacts.auris': 'jewellery',
    'contacts.scalpelburg': 'piercing studio',
    'toast.safe': 'put away safely',
    'pouch': 'add to the tray',
    'manual.title': 'How to play',
    'manual.1': 'Take a piece and drag it onto a matching one.',
    'manual.2': 'Two of a kind become one, larger.',
    'manual.3': 'Pieces only merge within the same set.',
    'manual.4': 'The ring colour tells you the collection.',
    'manual.5': 'The dots under a piece are its size.',
    'manual.6': 'The last size means the piece is finished.',
    'manual.7': 'Short of pieces? Add to the tray.',
    'manual.8': 'Three finished pieces complete a set and the next one arrives.'
  }
};
```

- [ ] **Step 2: Add `data-i18n` to every string in `index.html`**

Every visible string becomes `<tag data-i18n="key"></tag>` with an empty body.
Delete manual steps 8 and 9 (`Собери 35. Это ты.` and the Haddaway line) and the
`step-nine` block entirely — they belong to the personal layer.

- [ ] **Step 3: Implement `applyCopy` in `src/game.js`**

```javascript
  function applyCopy(which) {
    lang = which;
    document.documentElement.lang = which;
    var dict = Copy[which] || Copy.ru;
    var nodes = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodes.length; i++) {
      var key = nodes[i].dataset.i18n;
      if (dict[key] !== undefined) nodes[i].textContent = dict[key];
    }
  }
```

Call `applyCopy(lang)` once at startup, beside `syncMuteGlyph()`.

- [ ] **Step 4: Verify by driving the real page**

Open `index.html`, tap the RU/EN toggle. Expected: every button and heading
switches language, the choice survives a reload, and no key renders as an empty
element (an empty element means a missing key — fix it).

- [ ] **Step 5: Commit**

```bash
git add data/copy.js index.html src/game.js
git commit -m "Extract every string into a two-language copy file"
```

---

### Task 11: Kiosk plumbing — idle reset, muted sound, attract loop

**Files:**
- Create: `src/kiosk.js`
- Modify: `src/sfx.js` (default mute), `src/game.js` (expose a reset), `index.html`

**Interfaces:**
- Consumes: `Game.stop()`, `Game.getState()`.
- Produces: `Kiosk.touch()` — resets the idle timer; `Kiosk.start()`.

- [ ] **Step 1: Write `src/kiosk.js`**

```javascript
/* One tablet, strangers one after another. No session may leave state behind for
   the next person, and this is also the backstop for any dead end the design
   fails to anticipate. */
(function (root) {
  'use strict';

  var PLAY_IDLE_MS = 60000;     // mid-game: they may be thinking
  var STATIC_IDLE_MS = 30000;   // a plate or the board: nobody reads that long
  var timer = 0;

  function inPlay() {
    var screen = document.querySelector('.screen.is-on');
    return !!screen && screen.id === 'screen-game';
  }

  function reset() {
    /* Discard, do not pause. The next client must never inherit a half-played
       tray, and a score they did not earn must never reach the board. */
    if (root.Game && root.Game.discard) root.Game.discard();
    location.hash = '';
    if (root.Game && root.Game.home) root.Game.home();
  }

  function touch() {
    clearTimeout(timer);
    timer = setTimeout(reset, inPlay() ? PLAY_IDLE_MS : STATIC_IDLE_MS);
  }

  function start() {
    ['pointerdown', 'pointermove', 'keydown'].forEach(function (type) {
      document.addEventListener(type, touch, { passive: true });
    });
    touch();
  }

  root.Kiosk = { start: start, touch: touch, reset: reset,
                 PLAY_IDLE_MS: PLAY_IDLE_MS, STATIC_IDLE_MS: STATIC_IDLE_MS };
})(typeof window !== 'undefined' ? window : globalThis);
```

Add to `window.Game` in `game.js`:

```javascript
    discard: function () { state = null; hideSetPlate(); },
    home: function () { show('screen-title'); }
```

and `<script src="src/kiosk.js"></script>` plus `Kiosk.start();` at the end of
`game.js`.

- [ ] **Step 2: Mute by default in `src/sfx.js`**

Find the line that initialises the muted flag from storage and flip the default so
an absent value means muted:

```javascript
  var muted = localStorage.getItem('auris.muted') !== '0';
```

A hundred and ten merge blips against the studio's own music and a needle going in
is a lot. The mute control becomes an opt-in, and this is one line to reverse after
hearing it on the floor.

- [ ] **Step 3: Verify by driving the real page**

Open `index.html#endless`, make a few merges, then leave it alone. Expected: after
60 seconds the title screen returns. Reopen the game — the tray is new, the score
is zero. On the board screen the same happens after 30 seconds.

Open the page fresh in a private window. Expected: the mute glyph shows muted and
no sound plays until it is tapped.

- [ ] **Step 4: Commit**

```bash
git add src/kiosk.js src/sfx.js src/game.js index.html
git commit -m "Add idle reset and mute sound by default"
```

---

### Task 12: QR codes and the service worker

**Files:**
- Create: `tools/qr.py`, `sw.js`
- Modify: `index.html` (registration), `docs/DEVELOPING.md`

**Note for the reviewer:** the spec calls for QR codes but does not say how they
are produced. Generating them at runtime would need a JS library, and the project
has no dependencies and no build step. They are therefore generated offline into
`assets/qr/` and committed as plain PNGs. `qrcode` is a dev-time Python dependency
alongside Pillow, never shipped.

- [ ] **Step 1: Write `tools/qr.py`**

```python
"""Generate the QR codes the contacts screen shows.

    pip install qrcode pillow
    python tools/qr.py

Reads the URLs out of data/collections.js so the codes cannot drift from the
manifest. One code per collection plus the two constants.
"""
import json
import os
import re

import qrcode

OUT = os.path.join("assets", "qr")
SCALPELBURG = "https://scalpelburg.com/"
AURIS = "https://aurisjewellery.com/"


def collections():
    """Pull id/url pairs out of the manifest without executing JavaScript."""
    with open(os.path.join("data", "collections.js"), encoding="utf-8") as fh:
        src = fh.read()
    ids = re.findall(r"id:\s*'([^']+)'\s*,\s*\n\s*name:", src)
    urls = re.findall(r"url:\s*'([^']+)'", src)
    return list(zip(ids, urls))


def write(name, url):
    img = qrcode.make(url, box_size=8, border=2)
    img.save(os.path.join(OUT, name + ".png"))
    print("  {:<28} {}".format(name + ".png", url))


def main():
    os.makedirs(OUT, exist_ok=True)
    write("scalpelburg", SCALPELBURG)
    write("auris", AURIS)
    for cid, url in collections():
        write("auris_" + cid, url)


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Run it and check a code actually scans**

```bash
pip install qrcode
python tools/qr.py
```

Expected: `assets/qr/` holds `scalpelburg.png`, `auris.png` and one
`auris_<id>.png` per collection. **Scan one with a phone** and confirm it opens the
right page — a QR that does not scan off a tablet screen is the whole failure mode
this is guarding against.

- [ ] **Step 3: Write `sw.js`**

```javascript
/* Cache-first over everything, so a wifi dropout mid-session is invisible.
   Bump CACHE on every release or the tablet keeps serving the old build. */
var CACHE = 'auris-play-v1';

var ASSETS = [
  './', 'index.html', 'style.css',
  'data/collections.js', 'data/copy.js',
  'src/manifest.js', 'src/rules.js', 'src/board.js', 'src/sfx.js',
  'src/kiosk.js', 'src/game.js'
];

self.addEventListener('install', function (ev) {
  ev.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(ASSETS); }));
  self.skipWaiting();
});

self.addEventListener('activate', function (ev) {
  ev.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; })
                           .map(function (k) { return caches.delete(k); }));
  }));
  self.clients.claim();
});

/* Cache-first, then network, and anything fetched successfully joins the cache —
   sprites and plates are numerous enough that listing them all above would rot. */
self.addEventListener('fetch', function (ev) {
  if (ev.request.method !== 'GET') return;
  ev.respondWith(
    caches.match(ev.request).then(function (hit) {
      if (hit) return hit;
      return fetch(ev.request).then(function (res) {
        if (res && res.status === 200 && res.type === 'basic') {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(ev.request, copy); });
        }
        return res;
      }).catch(function () { return hit; });
    })
  );
});
```

Register it at the end of `index.html`:

```html
<script>
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('sw.js').then(function (reg) { reg.update(); });
  });
}
</script>
```

- [ ] **Step 4: Verify the dropout is invisible**

Serve the folder over http (`python -m http.server 8000`), open it, play a little,
then switch the network off in DevTools and reload. Expected: the page loads and
plays. This must be tested by driving the real page — reading the code proves
nothing here.

- [ ] **Step 5: Commit**

```bash
git add tools/qr.py sw.js assets/qr index.html docs/DEVELOPING.md
git commit -m "Generate the QR codes offline and cache the app for dropouts"
```

---

### Task 13: Art — re-cut the sprites under the set naming

**Files:**
- Modify: `tools/cut.py:24-41` (`CROPS`), `:83-93` (`build_pieces`)
- Delete: `assets/pieces/*.png` (the old three-part names)

Nothing is shot for launch. The opening sets are cut from what is already in
`PROMO_Auris/PhotoShoots/`, and the set plates are crops from the same shoots.

- [ ] **Step 1: Re-key `CROPS` to `<collection>_<set>_<tier>`**

```python
CROPS = {
    # CASSIOPEA / rings -- rings on red/black. Source is 1667x2500.
    "cassiopea_rings_1": ("AES2711.jpg", 1100, 790, 430),
    "cassiopea_rings_2": ("AES2711.jpg", 800, 1165, 430),
    "cassiopea_rings_3": ("AES2711.jpg", 465, 1550, 430),

    # FARFALLA / butterflies -- butterflies on skin. Source is 1333x2000.
    # Ordered mono -> pastel -> jewel so the tiers read apart at tablet size.
    "farfalla_butterflies_1": ("dsc07958.jpg", 855, 965, 215),
    "farfalla_butterflies_2": ("dsc07958.jpg", 722, 1232, 225),
    "farfalla_butterflies_3": ("dsc07958.jpg", 878, 800, 245),

    # MARCHESA / sapphire -- source is only 469x444, so these are the soft ones;
    # first candidates for replacement when better photography lands.
    "marchesa_sapphire_1": ("Screenshot 2026-08-25 071125.png", 175, 275, 95),
    "marchesa_sapphire_2": ("Screenshot 2026-08-25 071125.png", 325, 185, 95),
    "marchesa_sapphire_3": ("Screenshot 2026-08-25 071125.png", 127, 88, 185),
}
```

- [ ] **Step 2: Add plate and hero crops**

`build_pieces` writes circular tokens; plates are rectangular. Add beside it:

```python
# Catalogue plates: one per set, plus one hero per collection. Rectangular,
# 4:5, cut from the same shoots -- nothing is shot for launch.
PLATES = {
    "cassiopea_rings":       ("AES2711.jpg", 833, 1250, 1100),
    "farfalla_butterflies":  ("dsc07958.jpg", 666, 1000, 900),
    "marchesa_sapphire":     ("Screenshot 2026-08-25 071125.png", 234, 222, 440),
}
HEROES = {
    "cassiopea": ("AES2711.jpg", 833, 1250, 1400),
    "farfalla":  ("dsc07958.jpg", 666, 1000, 1200),
    "marchesa":  ("Screenshot 2026-08-25 071125.png", 234, 222, 460),
}


def build_plates():
    dest = os.path.join(OUT, "plates")
    os.makedirs(dest, exist_ok=True)
    for name, (src, cx, cy, size) in list(PLATES.items()) + list(HEROES.items()):
        im = crop_square(src, cx, cy, size)
        im.convert("RGB").save(os.path.join(dest, name + ".jpg"), quality=88)
        print("  plates/{}.jpg".format(name))
```

Call `build_plates()` from `main()`.

- [ ] **Step 3: Regenerate and check the tray**

```bash
python tools/cut.py
git rm assets/pieces/cassiopea_1.png assets/pieces/cassiopea_2.png assets/pieces/cassiopea_3.png
git rm assets/pieces/farfalla_1.png assets/pieces/farfalla_2.png assets/pieces/farfalla_3.png
git rm assets/pieces/marchesa_1.png assets/pieces/marchesa_2.png assets/pieces/marchesa_3.png
```

Open `index.html#endless`. Expected: every piece shows its sprite, no broken
images. A broken image means a manifest id and a filename disagree.

- [ ] **Step 4: Commit**

```bash
git add tools/cut.py assets/pieces assets/plates
git commit -m "Cut sprites and plates under the set naming"
```

---

### Task 14: Rights — remove the personal layer

**Files:**
- Delete: `assets/portrait/vlad.jpg`, `assets/sfx/voice.m4a`
- Modify: `LICENSE:37-49` (§2), `:50-75` (§3), `assets/sfx/README.md`, `README.md`, `index.html:7-13`, `src/game.js:432`

- [ ] **Step 1: Delete the personal files**

```bash
git rm assets/portrait/vlad.jpg assets/sfx/voice.m4a
rmdir assets/portrait 2>/dev/null || true
```

Deleted, not gitignored. With the voice gone, `celebrate` falls back to the
synthesised sting, which is an original composition and needs no clearance.

- [ ] **Step 2: Remove the voice from `src/game.js`**

Delete line 432, `Sfx.play('voice');`, and its comment. Delete `'voice'` from the
`Sfx.stop` calls on line 379.

- [ ] **Step 3: Rewrite the LICENSE**

- Delete §2 (voice recording) entirely.
- In §3, delete the portrait clause. Reframe the section as Auris's own commercial
  use rather than material borrowed for a gift, and add: *"The photography depicts
  a person who has consented to its commercial use by Auris. The consent is
  recorded outside this repository."*
- Keep §1 (code, MIT) unchanged.
- In §4, drop the sentence about the voice layering over the sting.
- Fix the `assets/sfx/takes/` reference: that directory exists in neither
  repository — the alternate takes live in the gitignored `choosed/sounds/takes/`.
  Fix the same reference in `assets/sfx/README.md`.

- [ ] **Step 4: Rewrite `index.html`'s head**

Replace the `robots` meta and its comment (lines 7-13) — the page no longer carries
a real person's face and is meant to be found:

```html
<title>AURIS · Play</title>
```

- [ ] **Step 5: Rewrite `README.md`**

It must not inherit ref-35's hardcoded `besteto.github.io/ref-35/` play badge. Two
of the three badges were already relative; make the third relative too, or leave
the play badge out until the hosting question is settled.

- [ ] **Step 6: Verify nothing references the deleted files**

```bash
grep -rn "vlad\|voice\.m4a\|portrait\|Бодмодов\|REF. 35\|Haddaway\|HURT ME" \
  --include=*.js --include=*.html --include=*.css --include=*.md . \
  | grep -v "^./docs/" | grep -v "^./DECISIONS.md"
```

Expected: no output. Anything that appears is a leftover of the personal layer.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Remove the personal layer and reframe the licence"
```

---

### Task 15: Repoint the measuring harness

**Files:**
- Modify: `smoke.html`, `tuning.html`

This is the task that produces the number `PIECES_PER_SET` should actually be. The
current value of 3 is arithmetic, not measurement, and is expected to move.

- [ ] **Step 1: Rewrite `smoke.html` to measure seconds per set**

Replace `playOne` and the assertions. The bot plays endless for a fixed number of
set retirements rather than to a target:

```javascript
var SETS_TO_WATCH = 6;

function playSets(seed, mix) {
  var order = Manifest.endlessOrder(Collections, R.mulberry32(seed));
  var s = R.createState(seed, { sets: order, mode: 'endless' });
  var actions = 0, pouch = 0, relieved = 0, guard = 0;
  var marks = [];
  var lastAction = 0;

  tally(s, mix);
  while (s.done.length < SETS_TO_WATCH) {
    if (++guard > 8000) return null;
    var merges = findMerges(s);
    if (merges.length) {
      var m = merges[Math.floor(s.rng() * merges.length)];
      var before = s.done.length;
      R.apply(s, m[0], m[1]);
      tally(s, mix);
      actions++;
      if (s.done.length > before) { marks.push(actions - lastAction); lastAction = actions; }
    } else if (R.emptyCells(s).length) {
      R.spawn(s); actions++; pouch++;
    } else {
      R.relieve(s); relieved++;
    }
  }
  return { actions: actions, pouch: pouch, relieved: relieved, perSet: marks };
}
```

and the assertions:

```javascript
ok('every run retired six sets without stalling', broken === 0, broken + ' stalled');
ok('the tray was never left short of three sets', shortTray === 0);

var per = [].concat.apply([], runs.map(function (r) { return r.perSet; }))
             .sort(function (a, b) { return a - b; });
var p50 = per[Math.floor(per.length / 2)];
var SEC_PER_DRAG = 1.35;
ok('a set takes roughly fifteen seconds',
   p50 * SEC_PER_DRAG >= 10 && p50 * SEC_PER_DRAG <= 22,
   'median ' + p50 + ' drags = ' + (p50 * SEC_PER_DRAG).toFixed(0) + 's per set');
ok('a demo run of three sets stays under two minutes',
   p50 * 3 * SEC_PER_DRAG <= 120);
ok('the anti-jam rule is a safety net, not the norm',
   jams / runs.length < 1.0, (jams / runs.length).toFixed(2) + ' unjams per run');
```

Add the `data/collections.js` and `src/manifest.js` script tags.

- [ ] **Step 2: Rewrite `tuning.html` to sweep the knob that now exists**

Replace `MODELS` with a sweep over `PIECES_PER_SET` and chain length:

```javascript
var MODELS = [
  { label: '3 tiers, 2 per set', tiers: 3, per: 2 },
  { label: '3 tiers, 3 per set', tiers: 3, per: 3 },
  { label: '3 tiers, 4 per set', tiers: 3, per: 4 },
  { label: '4 tiers, 2 per set', tiers: 4, per: 2 },
  { label: '4 tiers, 3 per set', tiers: 4, per: 3 }
];
```

`Rules.PIECES_PER_SET` is closed over by the module, so expose a setter for the
harness rather than writing to the export object:

```javascript
  function setPiecesPerSet(n) { PIECES_PER_SET = n; }
```

and export it as `_setPiecesPerSet`, named with the underscore so it reads as what
it is: a test seam, not part of the game's API.

- [ ] **Step 3: Run both and record the numbers**

Open `smoke.html` and `tuning.html`. Record the median seconds per set for each
model in `docs/superpowers/tuning-2026-09-03.md`.

**If the measured seconds per set differs materially from the ~15s arithmetic,
change `PIECES_PER_SET` to the value the measurement supports and re-run
`tests.html`.** That is what this harness is for.

- [ ] **Step 4: Commit**

```bash
git add smoke.html tuning.html src/rules.js docs/superpowers/tuning-2026-09-03.md
git commit -m "Repoint the harness at seconds per set"
```

---

### Task 16: Documentation and the kiosk runbook

**Files:**
- Modify: `docs/DEVELOPING.md`

- [ ] **Step 1: Add the set delivery page**

The contract from the spec, as a page that can be sent to whoever prepares the
material:

| | |
|---|---|
| Sprites | 3 (or 4) crops, transparent PNG, square, tier in the filename |
| Set plate | one catalogue shot of the finished piece |
| Text | set name RU/EN, reference number, specs |
| Belongs to | an existing collection id, or a new collection |

A new collection additionally brings: name RU/EN, one accent colour, one hero shot,
the collection blurb RU/EN, and its `url`.

- [ ] **Step 2: Add the kiosk section**

Chrome launch flags for kiosk mode, disabling sleep and the screensaver, how to
point the tablet at a featured collection (`index.html#demo/<collection>`), and the
reminder that `sw.js`'s `CACHE` constant must be bumped on every release.

- [ ] **Step 3: Commit**

```bash
git add docs/DEVELOPING.md
git commit -m "Document the set delivery format and the kiosk runbook"
```

---

## Self-Review

**Spec coverage.** Modes → Tasks 4, 8, 9. Set as the unit → Tasks 2, 3. Ear parked →
Task 8 step 1. Score and board → Tasks 4, 7, 9. Manifest and delivery format →
Tasks 2, 16. Chain length → Tasks 3, 15. Launch inventory and rotation → Tasks 5, 13.
Rules → Tasks 3-6. Screens → Tasks 8, 9. Copy → Task 10. Kiosk plumbing → Tasks 11, 12.
Rights → Task 14. Verification → Tasks 1, 6, 15.

**Two spec requirements have no task, deliberately:**

1. **The attract loop** drawn from `choosed/schemes/` instruction plates. It needs
   art selection that has not happened and blocks nothing; it is the one piece of
   kiosk plumbing safe to add after the floor test.
2. **GitHub Pages and the workflow** (`.github/workflows/tests.yml`, the remote, the
   domain). Blocked on OPEN #7 — the repository name and address are not chosen.

**Open questions this plan had to answer on its own** — all three are marked in the
tasks and need a ruling:

- **QR generation** (Task 12): offline via a dev-time `qrcode` dependency, committed
  as PNGs, because runtime generation would need a JS library the project forbids.
- **Accent contrast** (Task 2): "chosen to contrast" is implemented as greatest
  circular hue distance from the featured accent.
- **Set ids for the three existing chains** (Task 2): `rings`, `sapphire`,
  `butterflies`. These become filenames, so renaming them later is a re-cut.
