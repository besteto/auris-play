# Auris Play — Studio Kiosk

A play section for the Auris business, derived from the `ref-35` birthday gift.
Target since revision 3: the client's own phone, with a tablet on the Saint
Scalpelburg studio floor as a configuration of the same build.

Supersedes nothing. `ref-35` is a finished, delivered gift and is not touched by
this work; this repository is a fork of its code with the personal layer removed.

Revision 2 (2026-09-03) replaces the collection ladder of revision 1 with two
modes, and makes the **set**, not the collection, the unit on the tray. The ear is
parked. See `DECISIONS.md`, block 2.

Revision 3 (2026-09-04) demotes the tablet. The client's own phone is now the
primary carrier and the studio tablet a configuration of it, reached by an explicit
flag. See `DECISIONS.md`, block 4.

## Goal

Give a waiting client something worth picking up that leaves them knowing what
Auris makes. The jewellery is the content, so playing is browsing the catalogue
without it feeling like browsing a catalogue.

Success is that a client plays it unprompted and puts it down when called without
feeling interrupted — and, since revision 3, that the same page is worth keeping on
the phone they walked in with.

## Non-goals

- **The kiosk measures nothing.** It collects, stores and transmits nothing about
  the person playing. Demo mode ends on a contacts screen, but that is a door, not
  a funnel: it is offered once, at a natural ending, and the page learns nothing
  from it. This binds on a phone exactly as it binds on the tablet. What Auris's
  own site records about visits is Auris's business and outside this repository —
  see the QR rule under Screens.
- **No sharing.** No OG cards, no share buttons, no per-player result image.
- **No personal layer.** Vlad's portrait, the «Влад Бодмодов» REF. 35 plate and
  the voice recording are all removed. See Rights.
- **No account, no server.** Everything is static and local to the device.

## Constraints

| | |
|---|---|
| Device | The client's own phone by default; a shared studio tablet under `#kiosk` |
| Network | Studio wifi, assumed unreliable — must survive a dropout mid-session |
| Audience | Strangers, one after another, sessions bounded by an appointment |
| Language | Russian and English |
| Build | No build step, no dependencies, no package manager — inherited and kept |

The single-tablet-shared-by-strangers constraint drives more of this design than
anything else — but only where it applies: whatever is on screen is visible to the
next person, whatever gets typed in stays typed, and no session may leave state
behind for the next one. On a phone that belongs to one person none of that holds,
and the behaviours it justifies become wrong rather than merely unnecessary. Which
constraint is in force is decided by the flag, never guessed. See *The carrier is a
flag*.

## Modes

Two, chosen from the attract screen. They share one board, one tuning and one
renderer; they differ in what fills the tray and in how they end.

| | Endless | Demo |
|---|---|---|
| Tray | three sets, drawn across collections | three sets of one featured collection |
| Ends when | the player presses **стоп** | the three sets on the tray are done |
| Reward | score, leaderboard | the collection plate, then contacts |
| Board | yes | no |
| Ear | no | no |

**Endless** is the default and the base mode. It has no target, no clock and no
completion. A client can be called at any second, so the exit is a control, not an
event: **стоп** is on screen the whole time, and it goes straight to initials and
the board.

**Demo** is the shop window. It is pointed at one collection — normally the newest
— and is how a new release gets shown on the studio floor. A collection with fewer
than three sets fills the remaining tray slots from other collections, chosen to
contrast in accent colour; the featured collection's sets are always dealt first
and its plate is always the ending, so a one-set collection still gets its own
screen. Which collection is featured is a config value, not a code change.

## Decisions

Each of these closed an alternative that was considered and rejected. The
reasoning is kept because the rejected options are the ones that look attractive
again later.

### Two modes replace the ladder

Revision 1 made finishing a collection the unit of progress and hung the whole arc
off it. That is dropped. It asked the client to care about a structure they have no
reason to care about, and it made the ending depend on how long they were willing
to stay — which is exactly the thing a waiting room does not let anyone control.

Instead the game has no arc at all in endless, and a short bounded one in demo.
Progress is the score; the reason to keep playing is that the next merge is
satisfying, which is the property the gift already had and the only one that
survives being handed to a stranger for an unknown number of minutes.

*Rejected:* keeping the 35-point arc — a stranger has no reason to care about 35.
A timed round — a competitive register that fights the tone, and a clock is the
wrong thing to show someone who is waiting. The collection ladder — see above.

### The set is the unit on the tray

A collection holds **one or more sets**. A set is one merge chain: tier 1 merges to
tier 2 merges to tier 3, and a set may declare a fourth tier.

The tray always holds **exactly three sets**. `START_PIECES = 10`,
`SPAWN_BIAS = 0.65` and `collectionsWantingPartner` in `rules.js` are tuned and
measured for exactly three chains on a 25-cell tray. Six chains at once spreads ten
pieces across six, pairs starve, and every number in that file needs re-deriving.
Making the set the unit keeps that number at three in both modes: three sets from
three collections in endless, three sets from one collection in demo. **The
measured tuning is not touched.**

This is also what makes demo mode possible at all. A collection is a marketing
object of variable size; a chain is a fixed-size game object. Separating them lets
a new collection of any size be shown without redesigning the board.

*Rejected:* three collections on the tray with one chain each (revision 1) — a
collection then cannot be shown on its own, so there is no demo mode. All sets live
at once — invalidates the tuning wholesale and bets a day of measurement against
numbers that already work.

### The ear is parked

The ear's seven piercings meant one per finished piece in the gift, and one per
finished collection in revision 1. Both are dropped: **the ear does not fill in
either mode**, and it comes off the play screen.

It is reserved for a third mode, «собери свой сет», where the top piercing takes
jewellery made for the top piercing and the lobe takes jewellery made for the lobe.
That needs a placement field on every piece, which does not exist and is not being
added now, so the ear waits for it rather than being given a meaning it does not
have.

`drawEarDots` and the ear geometry stay in the codebase, unreferenced, because
re-deriving those seven anatomical points from scratch later is real work and the
art is already correct.

**Consequence:** the open question about cutting a seventh collection is closed. It
existed only because five or six collections left piercings that could never fill.
With no ear on screen, the number of collections is an art-budget question and
nothing else.

### The score stays, and the board with it — endless only

Scoring is kept as the flat table currently under `SCORING.endless` — every merge
counts one — so the number is a tally of pieces made, with no target to land on.
Two meters, two jobs: pips are progress inside the current set, the score is total
output.

The board is **top ten by score, three-letter initials, arcade style**, held in
`localStorage` and cleared whenever the device's local calendar date changes from
the one stored with the board.

Three letters rather than a name is a kiosk decision, not a stylistic one: it needs
no on-screen keyboard, which is slow for someone about to be called; it limits what
anyone can spell on a screen the next client will read; and a daily reset keeps the
board reachable instead of permanently owned. Full names on a shared tablet would
also make the studio the custodian of personal data it has no reason to hold.

**Demo scores are not recorded.** Demo is bounded by the size of three sets and
endless is not, so the two numbers are not comparable and putting them in one table
would be a lie. Demo ends on the collection plate instead.

### The carrier is a flag, not a guess

One build serves both carriers. It behaves as a **phone** by default and as a
**kiosk** only when the address carries `#kiosk`, which is typed once into the
tablet's bookmark and remembered in `localStorage` from then on.

The carrier is never inferred from screen width or touch support. A tablet and a
large phone are indistinguishable by measurement, and a wrong guess is costly in
both directions: an idle reset firing on someone's own phone eats a run they walked
away from for a moment, and a missing one on the tablet hands the next client a
half-played tray. A flag is one line of configuration and cannot be wrong by
accident.

What the flag governs:

| | Phone (default) | Kiosk (`#kiosk`) |
|---|---|---|
| Idle reset | none | 60s in play, 30s static |
| Attract loop | none | slow cycle behind the title |
| Sound | muted by default, as on the kiosk | muted by default |
| Contacts | tappable links, new tab | QR codes, no outbound links |
| Board | the phone's own record | the day's board on a shared screen |

The board carries a wording problem the flag does not solve: «Рекорды дня» is a
shared-screen phrase, and on a personal phone the same `localStorage` table is one
person's own record. It is an open question, not a decision — see `OPEN.md`.

## Content model

A collection is currently defined in three places that can drift — `COLLECTIONS` in
`rules.js`, `COLLECTION_LABEL` in `game.js`, and `--cassiopea` / `--marchesa` /
`--farfalla` in `style.css`. All three collapse into one manifest, which now nests
sets inside collections.

`data/collections.js`:

```js
{ id:     'cassiopea',
  name:   { ru: 'Кассиопея', en: 'Cassiopea' },
  accent: '#8e1f22',
  hero:   'assets/plates/cassiopea.jpg',
  url:    'https://aurisjewellery.com/collections/cassiopea',  // the QR target
  plate:  { ru: { body: '...' }, en: { body: '...' } },   // shown when demo completes
  sets: [
    { id: 'pendant',
      name:  { ru: 'Подвеска', en: 'Pendant' },
      tiers: 3,
      plate: { ru: { ref: 'REF. 01', body: '...', specs: {} },
               en: { ref: 'REF. 01', body: '...', specs: {} } } },
    { id: 'cuff', name: { ru: 'Каффа', en: 'Cuff' }, tiers: 4, plate: { } }
  ] }
```

Two plates, two jobs. The **set plate** is the rung reward inside a run: one piece
of jewellery, its reference number and its specs. The **collection plate** is the
demo ending: the collection as a whole, its hero shot, its story.

Sprites are conventional at `assets/pieces/<collection>_<set>_<tier>.png` — so
`cassiopea_pendant_1.png` through `_3.png`, and `_4.png` where a set declares four
tiers. Set plates are `assets/plates/<collection>_<set>.jpg`.

**Adding a collection is: a manifest row, a hero shot, and per set three or four
sprites plus a plate shot. No code is touched.** The accent is written to a CSS
custom property at runtime rather than hardcoded in the stylesheet, which is what
makes that true. The crop dict in `tools/cut.py` is re-keyed from `id` to
`collection/set`, so the manifest and the cutter cannot drift apart.

`url` is where that collection's QR code points. It lives on the collection rather
than in the copy file precisely so a new collection arrives with its own link and
nothing central needs editing.

### What one set delivery contains

New collections arrive from Auris already prepared, so the format has to be written
down rather than rediscovered per delivery. **One set is:**

| | |
|---|---|
| Sprites | 3 (or 4) crops, transparent PNG, square, the tier order explicit in the filename |
| Set plate | one catalogue shot of the finished piece |
| Text | set name RU/EN, reference number, specs |
| Belongs to | an existing collection id, or a new collection |

**A new collection additionally brings:** name RU/EN, one accent colour, one hero
shot, the collection blurb RU/EN, and its `url`.

That table is the whole contract. It goes into `DEVELOPING.md` as a page that can
be sent to whoever is preparing the material, and `tools/cut.py` is the fallback
for anything that arrives as a flat photograph instead of a cut sprite.

### Chain length

`tiers` is 3 or 4, declared per set. Three is the measured case, inherited from the
gift. **Four is supported by the rules and unmeasured**: a fourth tier roughly
doubles the pieces consumed per finished item, which changes spawn economics, and
`tuning.html` has to measure it before a four-tier set ships. Until then, sets
declare 3.

### Launch inventory

The floor is **six sets**, so endless can retire and replace the whole tray once
without repeating itself inside a normal wait. More is better and the ceiling is
art time, not design. How those six-plus sets distribute across collections is an
art-budget decision, not a structural one — one collection of six sets and six
collections of one both work.

**Nothing is shot for launch.** The opening sets are cut from what is already in
`PROMO_Auris/PhotoShoots/` — whatever is quickest and cheapest to pull, with the
most usable material in `2023` (80 frames) and `2024` (31). Set plates are crops
from the same shoots, not new photography. At three sprites per set, six sets is
eighteen crops, which is what the gift already had; the launch art budget is
therefore flat against the gift, not larger.

Better material is expected to arrive later as prepared sets, which is what the
delivery format above exists to receive.

### Roster and rotation

`rules.js` loses the `COLLECTIONS` constant and gains:

- `state.tray` — the three set ids currently dealable
- `state.queue` — the rest, waiting
- `state.done` — retired sets, in order

`createState` already deals the opening hand round-robin specifically so the first
tray is not monochrome; that behaviour is preserved, against the three sets rather
than against a global list. In endless the queue is shuffled per session so two
clients in a row do not get an identical run. In demo the featured collection's
sets are dealt first and the queue holds the contrast fillers.

**On completion**, the finished set's leftover low-tier pieces still on the tray
dissolve into the plate animation — they go into the case with it — and the
incoming set seeds their cells. This stops a retired chain leaving dead pieces
nobody can merge, and makes the swap read as a reward rather than as bookkeeping.

In endless the queue never empties: when it runs out, the retired sets are
reshuffled back into it. Endless means endless.

## Rules

`src/rules.js` stays pure: no DOM, no imports. That property is what lets
`tests.html` and `smoke.html` assert against it directly, and it is preserved.

**Removed:** `TARGET`; the birthday scoring table; the `поднос полон` stall;
`earFilled` and every caller.

**Kept:** `SCORING` with the flat table as its only entry, and `pointsFor`.

**Kept, and promoted:** `relieve()`. The tray un-jamming rather than ending was a
birthday courtesy; on a kiosk it is a hard requirement, and endless mode makes it
absolute — there is no end state to fall through to, so a jam with no relief is a
board that can never be left except by the idle timer. It applies unconditionally.

**Added:**

- `state.mode` — `'endless'` or `'demo'`; in demo, `state.featured` names the
  collection
- `PIECES_PER_SET = 3` — finished top-tier pieces that retire a set. A tuning knob,
  independent of the score
- `state.finished` — per-set counts of finished pieces
- rotation: a top-tier merge increments the count; reaching the threshold emits
  `{ type: 'setComplete', set, collection }`, retires the set, and emits the
  dissolve and incoming-spawn events through the existing event list, so `game.js`
  animates them with machinery it already has
- `isComplete(state)` — in demo, true when the opening three sets are all in
  `state.done`; in endless, always false. Endless has no completion; it has a
  **стоп** button, which is a UI action, not a rule.

## Screens and flow

```
              +-- endless -> (set plate) -> ... -> [стоп] -> initials? -> board --+
              |                                                                  |
attract ------+                                                                  |
   ^          |                                                                  |
   |          +-- demo -> (set plate) -> ... -> collection plate --+-> again --+  |
   |                                                               |            |  |
   |                                                               +-> contacts |  |
   |                                                                            |  |
   +-- manual / collections / board --------------------------------------------+--+
```

The **set plate** is an overlay, not a screen: it dims the tray, holds about three
seconds, and is tap-skippable. A client about to be called should not have to wait
out a reward.

**стоп** is persistent in endless, not hidden in a menu. It offers initials if the
score made the top ten, then the board, then drops to attract.

The **collection plate** ends demo, full screen, and offers exactly two things:
*ещё раз* — which reshuffles to a different trio of sets, so a second run is not the
first one again — and *контакты*.

The **contacts screen** is new, and it branches on the carrier.

On a **phone**, the client is already holding the device the shop needs to reach,
so the screen is two large tappable rows opening in a new tab. No QR is drawn at
all: a code photographed off the screen it is displayed on is a device asking
itself for its own address.

On the **kiosk**, `target="_blank"` to `aurisjewellery.com` strands the client on a
website with no way back, so both outbound links become QR codes and the client
takes the shop away on their own phone. The collections screen's boutique block
loses its links to the same screen.

A code that must be photographed is the whole content of the screen it sits on:
**one code at a time, sized `min(72vw, 60vh, 420px)`**, not two side by side. Two
132px codes were the first draft and they are too small to scan at arm's length
under studio glare. Arriving from demo the first code is the collection the client
just assembled; Scalpelburg follows.

Two codes, two targets:

- **scalpelburg.com** — the site's front page, always the same code.
- **aurisjewellery.com** — the collection's own page, taken from `url` in the
  manifest. **Arriving from demo, this code points at the collection the client
  just assembled**; arriving from the menu, at the catalogue section. Same door,
  aimed better, and it costs one manifest field.

`url` may carry Auris's own campaign parameters — the analytics then sit on their
site, which is theirs to run, and the tablet still learns nothing. Two rules make
that safe and workable:

- **Constant per collection.** No session id, timestamp, score, run number, or
  anything that varies between players. A constant parameter attributes a channel;
  a varying one follows a person, and that is the line.
- **Short.** A long parameter string raises the QR code's density, and this code
  gets scanned off a tablet screen at arm's length, often at an angle and under
  glare. Short parameters, or a short redirect on their side. Legibility, not
  taste.

The manual loses step 8 (`Собери 35. Это ты.`) and step 9 (the Haddaway line) along
with the rest of the personal layer.

Deep links (`#game`, `#manual`, `#collections`, ...) are kept for development and
extended to cover the new screens, including `#demo/<collection>` — which is also
how the tablet is pointed at the featured collection.

### Scale on a phone

The layout is already fluid where the game is: the tray is `min(94vw, 60vh, 440px)`
— 94% of the width of a 412px phone, at 77px a cell — and the plates run to the
full width of the screen inside their padding. The tray, the pieces and the pips
are not to be touched: `START_PIECES` and `SPAWN_BIAS` are measured against that
geometry.

What does not scale is the catalogue micro-typography: eighteen rules pinned at
9–12px, nearly all of them letterspaced 0.2–0.36em, which is the hardest thing to
read on a small screen. Plate eyebrows sit at 10px, `REF.` and the specs at 11px,
the QR caption at 10px. These move to `clamp()` with a phone floor — eyebrows 12px,
specs and `REF.` 13px — and shed some of their letterspacing on narrow screens.

## Copy

`data/copy.js` holding `{ ru: {}, en: {} }`, roughly forty keys, with `data-i18n`
attributes on the markup and a single `applyCopy(lang)` pass in `game.js`.
Per-collection and per-set strings live in the manifest, not here, so a new
collection brings its own copy.

A discreet RU/EN toggle sits on the attract screen; the choice persists in
`localStorage`.

This is the extraction the original design spec promised — "all copy lives in one
`RU = {}` object so a second language is a drop-in later" — and which was never
actually built. The strings are currently inline in `index.html`.

## Kiosk plumbing

None of this exists in the gift, and **all of it lives behind `#kiosk`**. On a
phone every item below is either absent or, in the case of the service worker,
kept for its own sake rather than for the floor.

- **Idle reset.** No pointer event for 60s in play, or 30s on a static screen,
  returns to attract and *discards state*. The next client must never inherit a
  half-played tray. This is also the backstop for any dead end the design fails to
  anticipate, and the only exit endless has other than **стоп**.
- **Attract loop.** A slow cycle behind the title, drawn from the
  `choosed/schemes/` instruction plates. `info_brief.md` proposed exactly this use
  for them and it was never taken up.
- **Sound muted by default.** A hundred and ten merge blips against the studio's
  own music and a needle going in is a lot. The mute control becomes an opt-in. A
  one-line default flip, easily reversed after hearing it on the floor.
- **Service worker**, cache-first across every asset, versioned cache name bumped
  per release, with an update check so the tablet takes a new version next time it
  is online. This is what makes a wifi dropout mid-session invisible.
- **A kiosk section in `DEVELOPING.md`**: Chrome launch flags, disabling sleep and
  the screensaver, and how to point the tablet at a featured collection. The
  operational half that otherwise gets rediscovered every time.

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

Consent for the commercial use of the photography is given. The rewritten §3
states that the material is used with the consent of the person depicted; **the
consent itself is recorded outside this repository**, because a public repo is the
wrong place to keep a named person's statement about themselves. The LICENSE cites
that it exists; it does not quote it.

Also fixed in passing: `LICENSE` and `assets/sfx/README.md` both reference
`assets/sfx/takes/`, a directory that exists in neither repository — the alternate
takes live in the gitignored `choosed/sounds/takes/`.

## Verification

The existing harness is this project's real strength, and is repointed rather than
replaced.

`tests.html` gains assertions for:

- the tray holds exactly three sets at every point in a run, including across a
  retirement
- a set retires at `PIECES_PER_SET` and its leftovers are dissolved, not stranded
- demo with a one-set collection fills from other collections and still ends on the
  featured collection's plate
- endless never reports completion, and its queue refills rather than running dry
- **`relieve()` still guarantees no dead end** now that a set can leave the tray
  mid-game — the single most important assertion in the file
- a four-tier set merges correctly end to end

`smoke.html` and `tuning.html` move from measuring "drags to 35" to measuring
**seconds per set**, for three-tier and four-tier chains separately. That is what
sets `PIECES_PER_SET`. At the currently measured ~5s per finished piece a threshold
of 3 gives a ~15s rung and a ~45s demo run — **that is arithmetic, not
measurement**, and the number is expected to move.

The kiosk behaviours that matter most — **стоп** discarding state, idle reset
discarding state, the service worker surviving a dropout, no dead end — are
verified by driving the real page, not by reading code.

## Deferred

- **«Собери свой сет»** — the third mode, and the only one that uses the ear. Needs
  a placement field on every piece (top piercing, lobe, ...), which is a manifest
  change and an art-classification pass, not a code problem.
- **Four-tier sets** — supported by the rules, unmeasured, and not shipping until
  `tuning.html` has numbers for them.
- Recutting Marchesa, whose source is 469×444 and is already noted as the soft one.
- Anything that measures: outbound click tracking, analytics, per-code UTM
  parameters, counting scans. Explicitly out of scope. Pointing a QR code at the
  right collection is aim, not measurement, and stays; knowing whether anyone
  scanned it is the line this project does not cross.
