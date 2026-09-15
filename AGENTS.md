# AGENTS.md

Instructions for coding agents working in this repository. People read
`CONTRIBUTING.md`; everything there binds you too. This file adds what an agent
tends to get wrong.

## Start here, and only here

1. Read `STATE.md` in full. It is short on purpose and is the current truth.
2. Read the first eight items of `OPEN.md`.
3. Do **not** read `DECISIONS.md` end to end. Grep for a decision number
   (`Р-028`) when you need its text.
4. The active spec and plan are named in `STATE.md`. The plan's tasks carry
   "Revision 3 amendments" blocks at the top; they override the steps below them.

Sessions open with `/brief` and close with `/park`. A context compaction is not
a park: it loses exactly what the park would have saved.

## Roles

The coordinator session discusses and decides but does not edit code. Changes go
into a task brief and are implemented by a fresh implementer, then reviewed.
Briefs, reports and review diffs live in `.superpowers/sdd/<plan-name>/`, which is
git-ignored scratch; the ledger there is `progress.md`. If you are an implementer:
do only what your brief says, never spawn subagents, never spawn a reviewer, write
the full report to the path you were given and return the short status contract.

## Laws

Violating one of these is a defect, not a style choice. The number is the
decision in `DECISIONS.md`.

- `src/rules.js` and `src/manifest.js`: no DOM, no imports, no globals besides
  their own export. The harness calls them directly.
- `src/game.js` is the only file that touches the DOM.
- `START_PIECES = 10`, `SPAWN_BIAS = 0.65`, tray `min(94vw, 60vh, 440px)`:
  measured, do not touch [Р-014, Р-021, Р-030].
- Exactly three sets on the tray while a run is going [Р-014].
- `relieve()` is unconditional and unreachable in normal play [Р-026].
- `state.done` is a set of distinct keys, not a log [Р-025].
- Names, notes and links come from the manifest at runtime [Р-010, Р-023].
  Never duplicate a collection string into `data/copy.js`.
- Carrier by flag, never by guess: phone by default, kiosk only under `#kiosk`
  [Р-028]. No idle reset and no attract loop outside the kiosk flag.
- QR only on the contacts screen, one at a time, `min(72vw, 60vh, 420px)` [Р-029].
- The game measures nothing about the player.
- Nothing personal under the Auris name [Р-007]. `ref-35` is a delivered gift
  and is frozen [Р-001]; screenshots from `besteto.github.io/ref-35/` are not
  this branch.
- `PROMO_Auris/`, `choosed/` and `info_brief.md` are never committed.

## Gates

There is no node and none is wanted. Do not add `package.json`, npm, or a
bundler. The gates are:

```bash
bash tools/harness.sh tests smoke tuning      # 152/152, 5/5, 6/6 — may rise, never fall
bash tools/pagecheck.sh '#endless' '#demo/cassiopea' '#collections' '#board' '#contacts'
```

Run them before every commit and put the real output in your report. A report
without the numbers is not evidence. The service worker, QR codes and audio
files need HTTP, not `file://`:

```bash
python -m http.server 8732 --bind 0.0.0.0
```

Headless Chrome has two traps: CSS animations do not advance under
`--virtual-time-budget`, and `--window-size` is ignored (viewport is 500×749).
Never read geometry from a headless dump without disabling animation first, and
never claim a visual result from headless — say what was asserted on the DOM.

## Commits

- Subject `[Category] [symbol] short description` (categories in
  `CONTRIBUTING.md`). One line. No body paragraphs.
- Blank line, then the trailer `Co-Authored-By: <your model name> <noreply@anthropic.com>`.
- Never add a `Claude-Session:` or any session URL trailer.
- Commit only the files of your task. Check `git status` for strays such as
  `tools/_contact.png` (generated, ignored) before staging.
- Squash your own fix-ups into the commit they fix. Do not rewrite anyone
  else's history unless the owner asks.

## Environment quirks

- Windows, Git Bash. Process substitution (`<(...)`) does not work with git;
  write a temp file. Expect "LF will be replaced by CRLF" warnings; they are noise.
- Python is available (`tools/cut.py` uses PIL). Chrome is found by `harness.sh`.
- The canon files are in Russian, the code and developer docs in English. Keep
  each in its language. Grep for Cyrillic with a UTF-8-aware tool.
- `docs/DEVELOPING.md` is partly stale (birthday build). Trust `STATE.md` over
  it when they disagree.

## When unsure

Write the question into `OPEN.md` (one line: question, what it blocks, who
decides) and proceed on the smallest safe assumption, stated in your report.
Do not resolve an open question by choosing wording or behaviour in code.
Open-question numbers are stable: code references them as `TODO(open-N)`.
