# Contributing

Auris Play is a small static browser game for the Auris jewellery studio: merge
pieces on a tray, complete sets, see the collection they come from. No build step,
no dependencies, no package manager. This file is for people; agents also read
`AGENTS.md`. The long-form developer notes live in `docs/DEVELOPING.md` — parts of
it still describe the birthday build this repository was forked from and are being
rewritten.

## Branches

- `main` — the imported baseline plus the project canon (`STATE.md`, `OPEN.md`,
  `DECISIONS.md`, the spec and plan under `docs/superpowers/`).
- `kiosk` — the studio edition, where the work happens. GitHub Pages serves it.

Branch from `kiosk` for anything you want merged into the studio edition.

## Getting started

```bash
python -m http.server 8732 --bind 0.0.0.0   # then http://localhost:8732/index.html
```

Opening `index.html` straight from disk works for the game itself, but audio
files, the service worker and the QR codes need HTTP. Google Chrome is required
for the headless checks below.

Deep links open any screen without playing to it: `#endless`, `#demo/<collection>`
(e.g. `#demo/cassiopea`), `#collections`, `#board`, `#contacts`, `#manual`.
`#kiosk` switches the build into the studio-tablet configuration.

## Before you open a pull request

Run the gates and paste their last lines into the PR:

```bash
bash tools/harness.sh tests smoke tuning
bash tools/pagecheck.sh '#endless' '#demo/cassiopea' '#collections' '#board' '#contacts'
```

The harness pages *are* the test suite: `tests.html` asserts against the rules,
`smoke.html` plays whole games and measures tempo, `tuning.html` sweeps models.
Their counts (currently 152 / 5 / 6) may go up, never down, and the smoke tempo
must not drift without a decision recorded in `DECISIONS.md`. `pagecheck.sh`
proves the real page boots, which no rules assertion can see.

Anything visual is also checked by eye on a phone in portrait. The headless
harness freezes CSS animations and ignores `--window-size`, so it cannot judge
layout — `docs/DEVELOPING.md` explains both traps.

## Layout

```
index.html           all screens, marked up with data-i18n keys
style.css
data/collections.js  the manifest: collections, sets, names in both languages
data/copy.js         every other user-facing string, RU and EN
src/rules.js         pure game logic — no DOM, no imports
src/manifest.js      pure manifest flattener — no DOM, no imports
src/board.js         the daily leaderboard in localStorage
src/game.js          the only file that touches the DOM
src/sfx.js           audio
tools/harness.sh     headless runner for tests / smoke / tuning
tools/pagecheck.sh   headless boot check for the real page
tools/cut.py         regenerates every sprite and plate from the source photography
```

## Things that are settled

These are decisions, not preferences. Each has a number in `DECISIONS.md`; to
change one, open a question in `OPEN.md` rather than editing around it.

- `src/rules.js` and `src/manifest.js` stay pure. The harness hits them directly.
- `src/game.js` is the only DOM file.
- `START_PIECES`, `SPAWN_BIAS` and the tray size `min(94vw, 60vh, 440px)` are
  measured values. Changing one means re-measuring with `tuning.html`.
- The tray always holds exactly three sets while a run is going.
- Everything nameable — collections, sets, their notes and links — comes from the
  manifest at runtime. Do not hard-code a collection anywhere else.
- The carrier is a flag, never a guess: the build is a phone by default and a
  kiosk only under `#kiosk`. Idle reset and the attract loop exist only on the
  kiosk; on a phone they would wipe someone's run.
- The game measures nothing about the player. No analytics, no fingerprinting.
- The default-language text stays in the markup as a fallback; `data-i18n`,
  `data-i18n-aria` and `data-i18n-alt` name the key, `applyCopy` fills it.

## Copy and languages

Every string a player can see has a key in `data/copy.js`, present in both `ru`
and `en`. Collection and set strings live in the manifest instead, so a new
collection brings its own copy. English is written for a native reader, not word
for word: "витрина" is *showcase*, never *tray* — the tray is the play grid.

## Artwork

Source photography (`PROMO_Auris/`, `choosed/`) is hundreds of megabytes and is
**never committed**; `.gitignore` enforces it. Only what `tools/cut.py` produces
goes into `assets/`. A new collection needs its crop boxes in `cut.py`, a plate
per set, a hero per collection and three sprites per set, and the script asserts
that plate and hero keys never collide.

## Rights

`LICENSE` is sectioned: the code is MIT; the photography, the Auris and
Scalpelburg branding and any recordings are not. Do not add media you do not
have the rights to, and do not add anything personal under the Auris name.

## Commits

```
[Category] [symbol] short description
```

| Category | Meaning |
|----------|---------|
| `Rules` | `src/rules.js`: scoring, retiring, the tray |
| `Manifest` | the collection manifest and its flattener |
| `Screens` / `UI` | markup, styling, screen flow |
| `Copy` | `data/copy.js`, translations |
| `Board` | the leaderboard |
| `SFX` | audio |
| `Art` | sprites, plates, `tools/cut.py` |
| `Build` | harness, headless checks, Pages plumbing |
| `Docs` | documentation and the project canon |
| `Fix` | a bug fix not tied to another category |

| Symbol | Meaning |
|--------|---------|
| `[+]` | Added |
| `[-]` | Removed |
| `[*]` | Changed / fixed |

Examples:
```
[Rules] [+] retire a set at the threshold and rotate the next one in
[Art] [*] re-key sprite crops to collection_set_tier names
```

One subject line, no body paragraphs — the reasoning belongs in the PR or in
`DECISIONS.md`. Keep a `Co-Authored-By:` trailer when an assistant wrote the
change, separated from the subject by a blank line. Squash fix-ups into the
commit they fix before pushing. Never include session URLs.

## Decisions and open questions

`STATE.md` is the current snapshot, `OPEN.md` the queue of unresolved questions,
`DECISIONS.md` the numbered journal (`Р-001`, `Р-002`, …). New entries are
appended, never rewritten. Open-question numbers are referenced from code as
`TODO(open-N)`, so items keep their number when they close.
