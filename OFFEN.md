# Offen – Stand 2026-11-02

Übergabe für die Arbeit an einem anderen Rechner. Erst diese Datei lesen, dann `CLAUDE.md`.

## Wo der Code steht

`main` mit Tag `v3.0.0` ist der aktuelle Stand: nur noch kuratierte Bänke (geplant in `.scratch/device-3/`), in Live geprüft und released. Teletext, IR und Schreibmaschine liegen im Archiv-Tag `v2.1.0` und in `.scratch/archiv/teletext-ir-schreibmaschine.md`.

Auf einem neuen Rechner: siehe `CLAUDE.md` „Neuer Rechner“, dann das Device in Live neu auf die Spur ziehen.

Zweig `mix`: **Mix-Bänke (4.0.0)**, geplant in `.scratch/mix-banks/spec.md`, gebaut in den Paketen N, J, E, I. Alle Tests grün, in Live noch nicht geprüft, noch nicht released.

## Mix-Bänke: in Live zu prüfen (Spec 6)

Erst `tools/deploy.sh`, Device neu auf die Spur ziehen, dann:
- Alte Bänke spielen wie in 3.0 (Warp, Raster, Tune), ohne Neuschnitt.
- Mix-Bank aus zwei Tracks mit verschiedenem Tempo: Beide Pads laufen mit Warp im Live-Tempo, Linien pro Fach stimmen.
- Leere Plätze stumm, am Device erkennbar: Pad dunkel ohne Nummer. Wie sieht das dunkle Pad in echtem Max aus (Farbe, Kontrast zum normalen Pad)?
- Icons am Pad im Editor (Würfel, „leeren“) auf kleinen Pads: treffbar, überdecken sie Nummer und Startzeit nicht?
- Bühne ohne Cache: Mix-Bank aus Pads anderer Bänke legen geht.
- Zweiter Mac mit 3.x zeigt „Bibliothek aus neuerer Version“ (beide Macs gleichzeitig auf 4.0).
- **Division live** (Zweig `mix-livediv`): Pad mit 1/8 anschlagen, auf 1 Takt drehen: läuft weiter, ohne Knacken? Zurückdrehen nach dem neuen Ende: kurzes Ausblenden statt Abriss? Mit Warp: Release neu terminiert (endet am neuen Ende, wird danach stumm)? Rückwärts?
- Danach `release.sh 4.0.0`.

Bekannte Grenze: „Leeren“ rückgängig machen ohne den ganzen Track im Cache geht nur, wenn eine andere Bank dasselbe Pad noch hat (sonst „nur spielbar“).

## Offene Entscheidungen

- **Suche nur mit Enter** statt beim Tippen (heute: 400 ms nach dem letzten Tastendruck)? Mit der schnellen Suche vermutlich unnötig.
- **Loslassen bei Hold** aus dem Quant-Raster nehmen? Heute wartet auch das Loslassen aufs Raster (bei 1/4 bis zu einer Viertel Nachklang).
- **Bänke 1 und 2** (Lady Gaga) entstanden mit der alten, kaputten Tempo-Konfidenz und liegen frei, nicht auf dem Raster. Pads neu würfeln oder Bänke neu anlegen. Es wird nichts automatisch verschoben.
- **Abracadabra**: Analyse sagt 126 BPM. Mit Lives Tap-Tempo gegenprüfen.

## Aufräumen

- `.scratch/device-3/spec.md` kennt die Nachträge nach der Spec nicht (Button „Editor“, Quant Div 1/32–1/4, Catch mit halbem Raster, schnelle Suche, Würfeln aufs Raster, Start verschieben mit `bankbusy`). Gültig ist `CLAUDE.md`.
- Alte Arbeitszweige und Worktrees auf dem Intel-Mac (`v3-node`, `v3-js`, `v3-editor`, `v3-patch`, `v3-integration`, `plan-3.0`, `analyse-konfidenz`, `editor-zoom-tasten`) sind gemergt und können weg.
- Daten, die von 2.x liegen bleiben, nur von Hand löschen: `D/ir.json`, `D/web/teletext.html`, `~/Music/YTSampler/chrome-profile/`.

## Tests

`for f in tools/tests/test_*.js; do node "$f" || echo FEHLER $f; done`. Auf Apple Silicon alle grün (2026-11-02). Auf dem Intel-Mac unter Last gelegentlich rot, wegen Zeitannahmen in den Tests:
- `test_editor.js` „Undo/Redo: neues Snippet, tauschen, umbenennen, verschieben“ (Fokus im Umbenennen-Feld)
- `test_http.js` „search … neue Suche bricht alte ab“
- `test_library.js` „zwei Prozesse schreiben gleichzeitig“, selten

## Intel-Mac (nur falls wieder dort gearbeitet wird)

`yt-dlp` als entpackte Fassung, nicht als Einzeldatei, siehe `CLAUDE.md` „Neuer Rechner“. Die Einzeldatei steht als `~/.local/bin/yt-dlp.einzeldatei.alt` daneben und kann weg.
