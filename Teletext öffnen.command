#!/bin/bash
# Öffnet die Teletext-Seite als randloses Fenster (Chrome) bzw. in Safari.
# Doppelklick auf die Seite = Vollbild. Vorher das Fenster auf den Röhrenmonitor ziehen.
#
# Optional: Fenster direkt auf dem zweiten Bildschirm öffnen.
# X/Y = Position des Röhrenmonitors in Systemeinstellungen > Displays > Anordnen
# (z. B. rechts neben einem 1920 px breiten Hauptbildschirm: X=1920, Y=0)
X=${X:-}
Y=${Y:-0}

URL="http://localhost:8765"
PROFILE="$HOME/Music/YTSampler/chrome-profile"

if [ -d "/Applications/Google Chrome.app" ]; then
  ARGS=(--app="$URL" --user-data-dir="$PROFILE" --no-first-run --disable-features=Translate)
  [ -n "$X" ] && ARGS+=(--window-position="$X,$Y" --start-fullscreen)
  open -na "Google Chrome" --args "${ARGS[@]}"
else
  open -a Safari "$URL"
fi
