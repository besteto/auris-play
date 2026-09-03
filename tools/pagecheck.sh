#!/usr/bin/env bash
# Load the real page in headless Chrome and report what actually rendered.
#
#     tools/pagecheck.sh                 # the attract screen
#     tools/pagecheck.sh '#endless'      # a running endless game
#     tools/pagecheck.sh '#demo/cassiopea'
#     tools/pagecheck.sh '#board' '#contacts'
#
# The harness pages test the rules; this tests that the page BOOTS. A thrown
# error in game.js leaves the tray empty and every screen dark, and no rules
# assertion can see that. Chrome's DOM dump after load can: if the cells and
# pieces are there, the module ran to the end and the renderer reconciled
# against real state.
#
# Exits non-zero when a game hash produced no tray, so it works as a gate.
set -u

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HASHES=("$@")
[ ${#HASHES[@]} -eq 0 ] && HASHES=("")

CHROME=""
for candidate in \
  "/c/Program Files/Google/Chrome/Application/chrome.exe" \
  "/c/Program Files (x86)/Google/Chrome/Application/chrome.exe" \
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  "$(command -v google-chrome 2>/dev/null)" \
  "$(command -v chromium 2>/dev/null)"; do
  [ -n "$candidate" ] && [ -f "$candidate" ] && CHROME="$candidate" && break
done

if [ -z "$CHROME" ]; then
  echo "No Chrome found. Open index.html by hand instead." >&2
  exit 2
fi

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
STATUS=0
BASE="$(cygpath -m "$REPO/index.html" 2>/dev/null || echo "$REPO/index.html")"

for hash in "${HASHES[@]}"; do
  label="${hash:-(attract)}"
  slug="$(echo "$label" | tr -c 'A-Za-z0-9' '_')"
  dump="$(cygpath -m "$WORK/$slug.dom" 2>/dev/null || echo "$WORK/$slug.dom")"

  "$CHROME" --headless=new --disable-gpu --no-sandbox \
            --user-data-dir="$WORK/profile-$slug" \
            --virtual-time-budget=10000 \
            --dump-dom "file:///$BASE$hash" > "$dump" 2>/dev/null

  echo "=== index.html$label ==="
  python -c "
import re, sys
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

dom = open(r'$dump', encoding='utf-8', errors='replace').read()
if not dom.strip():
    print('  EMPTY DUMP -- Chrome rendered nothing at all.')
    sys.exit(1)

on = re.findall(r'id=\"(screen-[a-z-]+)\"[^>]*class=\"screen is-on\"', dom)
on += re.findall(r'class=\"screen is-on\"[^>]*id=\"(screen-[a-z-]+)\"', dom)
cells = len(re.findall(r'class=\"cell', dom))
pieces = len(re.findall(r'class=\"piece(?![-a-z])', dom))
overlays = re.findall(r'id=\"([a-z-]+)\" class=\"overlay\"(?! hidden)', dom)

print('  screen on:  ' + (', '.join(on) if on else 'NONE'))
print('  cells:      %d' % cells)
print('  pieces:     %d' % pieces)
if overlays:
    print('  overlays:   ' + ', '.join(overlays))

# A game hash that produced no tray means the module threw before buildCells.
wants_game = '$hash' in ('#game', '#endless') or '$hash'.startswith('#demo/')
if wants_game and cells == 0:
    print('  FAIL -- a game hash rendered no tray. game.js threw before buildCells().')
    sys.exit(1)
if wants_game and pieces == 0:
    print('  FAIL -- tray built but no pieces. sync() never reconciled against state.')
    sys.exit(1)
if not on:
    print('  WARN -- no screen is lit. Fine for an overlay-only hash, otherwise a bug.')
" || STATUS=1
done

exit $STATUS
