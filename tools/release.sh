#!/bin/bash
# Neue Version: prüft, taggt und kopiert die Device-Dateien in die Ableton User Library.
# Aufruf aus dem Projektordner:  tools/release.sh 1.1
set -euo pipefail

V="${1:?Version angeben, z. B. tools/release.sh 1.1}"
DEST="$HOME/Music/Ableton/User Library/YTSampler"
cd "$(dirname "$0")/.."

[ -z "$(git status --porcelain)" ] || { echo "Erst committen – Arbeitsordner ist nicht sauber."; exit 1; }
git rev-parse -q --verify "refs/tags/v$V" >/dev/null && { echo "v$V gibt es schon."; exit 1; }

# .amxd muss zur .maxpat passen
python3 - <<'EOF'
import json, sys
sys.path.insert(0, 'tools')
from patchlib import check
raw = open('YT Sampler.amxd', 'rb').read()
assert json.loads(raw[32:-2]) == json.load(open('YT Sampler.maxpat')), '.amxd und .maxpat sind nicht synchron'
for f in ('YT Sampler.maxpat', 'ytvoice.maxpat', 'ytwarpvoice.maxpat'):
    assert not check(f)[2], f'{f}: ungültige Verbindungen'
EOF
for f in *.js; do node --check "$f"; done

git tag -a "v$V" -m "Version $V"

# nur, was das Device braucht; alles andere im Ziel wird ersetzt bzw. entfernt
mkdir -p "$DEST"
rsync -a --delete --exclude .DS_Store \
  *.amxd *.maxpat *.js teletext.html "Teletext öffnen.command" README.md "$DEST/"

echo "v$V → $DEST"
