# Auris Play — Studio Kiosk

A play section for the Auris business, derived from the `ref-35` birthday gift.
Target: a tablet on the Saint Scalpelburg studio floor, handed to a client
waiting for their appointment.

Supersedes nothing. `ref-35` is a finished, delivered gift and is not touched by
this work; this repository is a fork of its code with the personal layer removed.

## Goal

Give a waiting client something worth picking up that leaves them knowing what
Auris makes. The jewellery is the content, so playing is browsing the catalogue
without it feeling like browsing a catalogue.

Success is that a client plays it unprompted and puts it down when called without
feeling interrupted.

## Non-goals

- **No conversion funnel.** Nothing measures or chases a click through to the
  shop. The kiosk is not a storefront.
- **No sharing.** No OG cards, no share buttons, no per-player result image.
- **No personal layer.** Vlad's portrait, the «Влад Бодмодов» REF. 35 plate and
  the voice recording are all removed. See Rights.
- **No account, no server.** Everything is static and local to the tablet.

## Constraints

| | |
|---|---|
| Device | One shared tablet, touch, Chrome in kiosk mode |
| Network | Studio wifi, assumed unreliable — must survive a dropout mid-session |
| Audience | Strangers, one after another, sessions bounded by an appointment |
| Language | Russian and English |
| Build | No build step, no dependencies, no package manager — inherited and kept |

The single-tablet-shared-by-strangers constraint drives more of this design than
anything else: whatever is on screen is visible to the next person, whatever gets
typed in stays typed, and no session may leave state behind for the next one.

## Decisions

Each of these closed an alternative that was considered and rejected. The
reasoning is kept because the rejected options are the ones that look attractive
again later.

### The ladder replaces the target

The gift is a single ~35 second arc ending at a target of 35 — his age. A
stranger has no reason to care about 35 and no idea how long their wait is, so a
fixed arc either ends too early or is abandoned mid-way.

Instead: **finishing a collection is the unit of progress.** A collection needs
`PIECES_PER_COLLECTION` finished pieces; completing one shows that collection's
catalogue plate, fills one piercing in the ear, and swaps the next collection onto
the tray. Natural stopping points roughly every fifteen seconds, and a longer wait
is rewarded without being required.

*Rejected:* keeping the 35-point arc with a neutral payoff — a ten-minute wait
replays the same 35 seconds. Endless-only — throws away the payoff screen, the
best-made thing in the project. A timed round — a competitive register that fights
the tone, and a clock is the wrong thing to show someone who is waiting.

### Three collections live at a time, rotating

`START_PIECES = 10`, `SPAWN_BIAS = 0.65` and `collectionsWantingPartner` in
`rules.js` are tuned and measured for **exactly three chains** on a 25-cell tray.
Six chains at once spreads ten pieces across six collections, pairs starve, and
every number in that file needs re-deriving.

So the roster holds three. A completed collection leaves it and the next one from
the queue takes its slot. The measured tuning is untouched, and the swap gives
progression a visible form: new jewellery arrives on the tray as you climb.

*Rejected:* all collections live at once — invalidates the tuning wholesale,
likely forces a larger grid, and bets a day of measurement against numbers that
already work. A full 35-run per collection — four minutes to climb, and the ear
gains no new meaning.

### The ear becomes the ladder

The ear's seven piercings currently mean one per finished piece. They now mean
**one per collection completed**. The ear keeps doing what it already does — being
the progress meter and the shape of the ending at once — one level up.

This caps the ladder at seven collections, which is the design's own headroom.

**Known compromise:** at five or six collections, one or two piercings can never
fill, and the seven anatomical points in `drawEarDots` become a documented subset.
It works, but seven collections is what makes the ear anatomically whole. Cutting
a seventh chain is the fix if art time exists; nothing blocks on it.

### The score stays, and a leaderboard with it

Scoring is kept as the flat table currently under `SCORING.endless` — every merge
counts one — so the number is a tally of pieces made, with no target to land on
and nothing that competes with the ear. Three meters, three different jobs: pips
are the current rung, the ear is the ladder, the score is total output.

The board is **top ten by score, three-letter initials, arcade style**, held in
`localStorage` and cleared whenever the tablet's local calendar date changes from
the one stored with the board.

Three letters rather than a name is a kiosk decision, not a stylistic one: it
needs no on-screen keyboard, which is slow for someone about to be called; it
limits what anyone can spell on a screen the next client will read; and a daily
reset keeps the board reachable instead of permanently owned. Full names on a
shared tablet would also make the studio the custodian of personal data it has no
reason to hold.

## Content model

A collection is currently defined in three places that can drift — `COLLECTIONS`
in `rules.js`, `COLLECTION_LABEL` in `game.js`, and `--cassiopea` / `--marchesa` /
`--farfalla` in `style.css`. All three collapse into one manifest.

`data/collections.js`:

```js
{ id:     'cassiopea',
  name:   { ru: 'Кассиопея', en: 'Cassiopea' },
  accent: '#8e1f22',
  plate:  { ru: { ref: 'REF. 01', body: '…', specs: {} },
            en: { ref: 'REF. 01', body: '…', specs: {} } },
  hero:   'assets/plates/cassiopea.jpg' }
```

Sprites stay conventional at `assets/pieces/<id>_<1..3>.png`, so **adding a
collection is three sprites, a hero shot, and one row, with no code touched.**
The accent is written to a CSS custom property at runtime rather than hardcoded in
the stylesheet, which is what makes that true. The crop dict in `tools/cut.py` is
keyed by the same `id`, so the manifest and the cutter cannot drift apart.

Target is five to six collections at launch, structured for more.

### Roster and rotation

`rules.js` loses the `COLLECTIONS` constant and gains:

- `state.roster` — the three ids currently dealable
- `state.queue` — the rest, waiting
- `state.done` — completed, in order

The first three manifest entries are a fixed opening roster, chosen to read well
together. `createState` already deals the opening hand round-robin specifically so
the first tray is not monochrome; that behaviour is preserved, against the roster
rather than against a global list. The queue behind them is shuffled per session
so two clients in a row do not get an identical climb.

**On completion**, the finished collection's leftover tier-1 and tier-2 pieces
still on the tray dissolve into the plate animation — they go into the case with
it — and the incoming collection seeds their cells. This stops a retired chain
leaving dead pieces nobody can merge, and makes the swap read as a reward rather
than as bookkeeping.

## Rules

`src/rules.js` stays pure: no DOM, no imports. That property is what lets
`tests.html` and `smoke.html` assert against it directly, and it is preserved.

**Removed:** `TARGET`; the birthday scoring table; `state.endless` and every
branch on it, including the `поднос полон` stall. Endless mode existed to demo the
game to other people; on a studio floor the ladder is that mode.

**Kept:** `SCORING` with the flat table as its only entry, and `pointsFor`.

**Kept, and promoted:** `relieve()`. The tray un-jamming rather than ending was a
birthday courtesy; on a kiosk it is a hard requirement, because a dead-ended board
in front of a client in the chair is the worst failure available. It now applies
unconditionally.

**Added:**

- `PIECES_PER_COLLECTION = 3` — a tuning knob, independent of the score
- `state.finished` — per-collection counts of finished pieces
- rotation: a tier-3 merge increments the count; reaching the threshold emits
  `{ type: 'complete', collection }`, retires the chain, and emits the dissolve
  and incoming-spawn events through the existing event list, so `game.js` animates
  them with machinery it already has

**Changed:** `earFilled(state)` returns `state.done.length`. `isComplete(state)`
is `state.done.length === manifest.length`.

## Screens and flow

```
attract ──▶ game ──▶ (rung plate, overlay) ──▶ game ──▶ … ──▶ case ──▶ initials? ──▶ board ──▶ attract
   │                                                                                    ▲
   └──▶ manual / collections / board ───────────────────────────────────────────────────┘
```

The **rung plate** is an overlay, not a screen: it dims the tray, holds about
three seconds, and is tap-skippable. A client about to be called should not have
to wait out a reward.

The **case**, at a full ear, shows every plate collected, then offers initials
entry if the score made the top ten, then the board, then drops to attract.

Two cuts from the existing plates:

- The manual loses step 8 (`Собери 35. Это ты.`) and step 9 (the Haddaway line)
  along with the rest of the personal layer.
- The collections screen's boutique block loses its outbound links. On a tablet in
  Chrome kiosk mode, a `target="_blank"` to `aurisjewellery.com` strands the
  client on a website with no way back. **Both links become QR codes**, so the
  client takes the shop away on their own phone and the tablet stays a kiosk. This
  is better than the current behaviour even ignoring kiosk mode.

Deep links (`#game`, `#manual`, `#collections`, …) are kept for development and
extended to cover the new screens.

## Copy

`data/copy.js` holding `{ ru: {}, en: {} }`, roughly forty keys, with `data-i18n`
attributes on the markup and a single `applyCopy(lang)` pass in `game.js`.
Per-collection strings live in the manifest, not here, so a new collection brings
its own copy.

A discreet RU/EN toggle sits on the attract screen; the choice persists in
`localStorage`.

This is the extraction the original design spec promised — "all copy lives in one
`RU = {}` object so a second language is a drop-in later" — and which was never
actually built. The strings are currently inline in `index.html`.

## Kiosk plumbing

None of this exists in the gift.

- **Idle reset.** No pointer event for 60s in play, or 30s on a static screen,
  returns to attract and *discards state*. The next client must never inherit a
  half-played tray. This is also the backstop for any dead end the design fails to
  anticipate.
- **Attract loop.** A slow cycle behind the title, drawn from the
  `choosed/schemes/` instruction plates. `info_brief.md` proposed exactly this use
  for them and it was never taken up.
- **Sound muted by default.** A hundred and ten merge blips against the studio's
  own music and a needle going in is a lot. The mute control becomes an opt-in.
  A one-line default flip, easily reversed after hearing it on the floor.
- **Service worker**, cache-first across every asset, versioned cache name bumped
  per release, with an update check so the tablet takes a new version next time it
  is online. This is what makes a wifi dropout mid-session invisible.
- **A kiosk section in `DEVELOPING.md`**: Chrome launch flags, disabling sleep and
  the screensaver. The operational half that otherwise gets rediscovered every
  time.

## Repository, hosting, rights

`git init` in `auris-play`, its own remote, GitHub Pages, with
`.github/workflows/tests.yml` carried over from `ref-35`.

**The `.gitignore` excluding `PROMO_Auris/` and `choosed/` must be in place before
the first commit.** It already is, having been copied along with everything else,
but 311 MB committed by accident is not practically recoverable from history, and
this is the one irreversible mistake available in this project.

Rights changes, all of them deletions:

- `assets/portrait/vlad.jpg` and `assets/sfx/voice.m4a` are **deleted**, not
  gitignored.
- `LICENSE` loses §2 (voice recording) entirely, and the portrait clause in §3.
  This is precisely the clear build described in the existing §4: with the voice
  gone, `celebrate` falls back to the synthesised sting, which is an original
  composition and needs no clearance. Code stays MIT; photography, logos and
  branding stay all rights reserved, reframed as Auris's own commercial use rather
  than as material borrowed for a gift.
- `README.md` is rewritten, and must not inherit ref-35's hardcoded
  `besteto.github.io/ref-35/` play badge.

Also fixed in passing: `LICENSE` and `assets/sfx/README.md` both reference
`assets/sfx/takes/`, a directory that exists in neither repository — the alternate
takes live in the gitignored `choosed/sounds/takes/`.

## Verification

The existing harness is this project's real strength, and is repointed rather than
replaced.

- `tests.html` gains assertions for rotation, completion, retirement, and — the
  important one — that `relieve()` still guarantees no dead end now that a
  collection can leave the roster mid-game.
- `smoke.html` and `tuning.html` move from measuring "drags to 35" to measuring
  "seconds per rung" and "seconds to a full ear". That is what sets
  `PIECES_PER_COLLECTION`.
- At the currently measured ~5s per finished piece, a threshold of 3 gives a ~15s
  rung and a ~1:45 climb. **That is arithmetic, not measurement** — the harness
  exists to check it, and the number is expected to move.
- The kiosk behaviours that matter most — idle reset discarding state, the service
  worker surviving a dropout, no dead end — are verified by driving the real page,
  not by reading code.

## Deferred

- A seventh collection, which would make the ear anatomically whole.
- Recutting Marchesa, whose source is 469×444 and is already noted as the soft one.
- Anything that would make this a funnel: outbound click tracking, analytics,
  product deep links. Explicitly out of scope, and the QR codes are the deliberate
  non-tracking substitute.
