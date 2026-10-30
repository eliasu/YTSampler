#!/bin/bash
# Kopiert die Device-Dateien in die Ableton User Library, ohne Commit (zum Testen in Live).
# Aufruf aus dem Projektordner:  tools/deploy.sh
set -euo pipefail

DEST="$HOME/Music/Ableton/User Library/YTSampler"
cd "$(dirname "$0")/.."

# nur, was das Device braucht; alles andere im Ziel wird ersetzt bzw. entfernt
mkdir -p "$DEST"
# Ordner-Abgleich mit Filter (mit einer Dateiliste würde --delete nichts löschen; --delete-excluded räumt alles andere im Ziel weg)
rsync -a --delete --delete-excluded --exclude .DS_Store \
  --include '*.amxd' --include '*.maxpat' --include '*.js' --include editor.html --include README.md --include VERSION \
  --exclude '*' ./ "$DEST/"

echo "→ $DEST"
