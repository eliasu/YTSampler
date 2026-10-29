#!/bin/bash
# Kopiert die Device-Dateien in die Ableton User Library, ohne Commit (zum Testen in Live).
# Aufruf aus dem Projektordner:  tools/deploy.sh
set -euo pipefail

DEST="$HOME/Music/Ableton/User Library/YTSampler"
cd "$(dirname "$0")/.."

# nur, was das Device braucht; alles andere im Ziel wird ersetzt bzw. entfernt
mkdir -p "$DEST"
rsync -a --delete --exclude .DS_Store \
  *.amxd *.maxpat *.js teletext.html editor.html "Teletext öffnen.command" README.md VERSION "$DEST/"

echo "→ $DEST"
