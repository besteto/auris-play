#!/usr/bin/env bash
# Run the browser harness without a browser window.
#
#     tools/harness.sh              # tests + smoke
#     tools/harness.sh tests        # just one page
#     tools/harness.sh tuning
#
# There is no node in this project and none is wanted: the harness pages ARE the
# test suite and they run in a real browser engine. This drives headless Chrome
# over file:// and prints the <pre id="out"> block, so the same pages a person
# opens by hand also work from a terminal and from CI.
set -u

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PAGES=("$@")
[ ${#PAGES[@]} -eq 0 ] && PAGES=(tests smoke)

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
  echo "No Chrome found. Open the pages by hand instead." >&2
  exit 2
fi

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
STATUS=0

for page in "${PAGES[@]}"; do
  # A Windows-style path so both the shell and python can read the dump.
  dump="$(cygpath -m "$WORK/$page.dom" 2>/dev/null || echo "$WORK/$page.dom")"
  url="file:///$(cygpath -m "$REPO/$page.html" 2>/dev/null || echo "$REPO/$page.html")"

  "$CHROME" --headless=new --disable-gpu --no-sandbox \
            --user-data-dir="$WORK/profile-$page" \
            --virtual-time-budget=60000 \
            --dump-dom "$url" > "$dump" 2>/dev/null

  echo "=== $page.html ==="
  python -c "
import html, re, sys
raw = open(r'$dump', encoding='utf-8', errors='replace').read()
hit = re.search(r'<pre id=\"out\">(.*?)</pre>', raw, re.S)
if not hit:
    print('NO OUTPUT BLOCK -- the page threw before rendering. Check for a syntax error.')
    sys.exit(1)
text = html.unescape(hit.group(1))
for line in text.split(chr(10)):
    if 'FAIL' in line or 'RESULT' in line or line.strip().startswith(('taps', 'at ', 'pouch', 'unjams', 'median')):
        print(line)
sys.exit(1 if 'FAIL' in text else 0)
" || STATUS=1
done

exit $STATUS
