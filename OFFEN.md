# Offen – Stand 2026-11-02

Übergabe für die Arbeit an einem anderen Rechner. Erst diese Datei lesen, dann `CLAUDE.md`.

## Wo der Code steht

| Zweig / Tag | Inhalt | Status |
|---|---|---|
| `main`, Tag `v2.1.0` | letzte veröffentlichte Version (Editor-Zoom, Pads per Tastatur, reparierte Analyse) | released, letzter Stand mit Teletext/IR/Schreibmaschine |
| `v3` | 3.0 komplett plus Nachträge (siehe unten) | **nicht released**, auf dem Intel-Mac deployt und teilweise in Live getestet |

`v3` ist noch nicht nach `main` gemergt. Auf dem neuen Rechner:

```
git fetch && git checkout v3
tools/deploy.sh
```

Dann das Device in Live neu auf die Spur ziehen (nicht nur ersetzen, `poly~` lädt Stimmen nur beim Laden).

## Was in `v3` steckt

**3.0 (geplant in `.scratch/device-3/`):** nur noch kuratierte Bänke. Teletext, IR, Schreibmaschine und Spielen ohne Bank sind raus (Archiv: `.scratch/archiv/teletext-ir-schreibmaschine.md`). Grid geht in Warp auf, Snap weg, Source BPM/÷2/×2 nur noch im Editor, Tonal/Attack/Release fest. Editor spiegelt die Device-Regler (echte Live-Parameter, beide Richtungen). Ohne Bank lädt das Device die Bank am Regler.

**Nachträge nach der Spec** (stehen in `CLAUDE.md`, aber **nicht** in `.scratch/device-3/spec.md`):
1. Button **Editor** im Device öffnet den Editor im Standardbrowser (Parameter `Open Editor`, gesperrt in den ersten 300 ms nach dem Laden).
2. **Quant Div**: Menü unter Quant, Raster 1/32, 1/16, 1/8, 1/4 (Standard 1/16). Vier `metro` im Patch schicken `tick 0…3`, es zählt nur das eingestellte.
3. **Catch** (Parameter `Quant Catch`, Standard aus, nur bei Raster 1/8 und 1/4): Bis zu einer Achtel zu spät klingt sofort, aber an der Stelle, die auf dem Raster schon erreicht wäre. Später wartet der Anschlag. Ist der Slice kürzer als die Verspätung, klingt er vom Anfang.
4. **Suche** direkt über die YouTube-Ergebnisseite (400–600 ms), bei Fehler oder ohne Treffer Rückfall auf `yt-dlp`. 15 Treffer.
5. **Würfeln immer aufs Raster** (neue Bank, „Neues Snippet“): erst Taktanfänge, dann Schläge, frei nur ohne Beats.
6. **Start im Editor verschoben:** Node meldet `bankbusy`, das Device hält Anschläge zurück, bis die neuen Snippets im Buffer sind (`bank` + `bufloaded`, höchstens 3 s). Entprellen 150 ms statt 500 ms.
7. `deploy.sh` löscht jetzt wirklich alte Dateien im Live-Ordner (`--delete` wirkte mit Dateiliste nicht).
8. Tests starten nie mehr das echte `yt-dlp` und gehen nicht ins Netz (`harness.js`).

## In Live prüfen (dann Release)

Device neu auf die Spur ziehen, Max-Fenster offen lassen.

**Prüfliste 3.0**
1. Device lädt ohne Fehler im Max-Fenster. Schalter groß genug, Zeile unter der Waveform lesbar.
2. Altes 2.x-Set öffnen: Bank kommt, MIDI-Mappings auf die bleibenden Parameter gehen noch.
3. Neues Device und 2.x-Set mit Teletext-Stand laden die Bank, auf der der Regler „Bank“ steht.
4. Editor-Regler in beide Richtungen, auch per MIDI gedreht. Entsteht ein Eintrag in Lives Undo? Was passiert mit Automation auf einem Regler („Re-Enable Automation“)?
5. Volume aus dem Editor stellen, am Device drehen: kommt jeweils auf der anderen Seite an.
6. Warp ohne Grid-Schalter folgt dem Raster (klingt wie früher Warp+Grid), Linien im Overlay erscheinen.
7. Alle MIDI-Kanäle spielen Pads.

**Nachträge**
8. Button **Editor** öffnet den Editor. Beim Öffnen eines Sets geht **kein** Browserfenster von selbst auf.
9. **Suche**: Treffer fast sofort. Video anklicken → neue Bank, Pads auf Taktanfängen.
10. **Quant Div**: 1/32 bis 1/4 rasten hörbar richtig ein (Transport muss laufen). Fühlt sich 1/16 wie 1/16 an? (Vorher war der Eindruck 1/8, im Code stand immer 1/16.)
11. **Catch** bei 1/8 und 1/4: Bleibt das Sample bei knapp verspätetem Anschlag im Takt? Klickt der versetzte Einstieg?
12. Hold mit Raster 1/4: Auch das Loslassen wartet aufs Raster (bis zu einer Viertel Nachklang). Stört das? Dann Loslassen aus dem Raster nehmen.
13. **Start verschieben**: Start im Editor ziehen, sofort Pad spielen (Taste und Mutprobe). Ton kurz verzögert, aber von der neuen Stelle? Mehrere Starts schnell hintereinander: nichts hängt, nichts bleibt stumm. Ist die Verzögerung spürbar störend?
14. Catch-Schalter und Raster-Menü im Device: Lage und Lesbarkeit (rechts neben Tune/Warp).

Wenn alles passt: `v3` nach `main` mergen, `tools/release.sh 3.0.0 "…"`, pushen.

## Offene Entscheidungen

- **Suche nur mit Enter** statt beim Tippen (heute: 400 ms nach dem letzten Tastendruck)? Mit der schnellen Suche vermutlich unnötig. Erst ausprobieren.
- **Loslassen bei Hold** aus dem Quant-Raster nehmen? (siehe Punkt 12)
- **Bänke 1 und 2** (Lady Gaga) entstanden mit der alten, kaputten Tempo-Konfidenz und liegen frei, nicht auf dem Raster. Pads neu würfeln oder Bänke neu anlegen. Es wird nichts automatisch verschoben.
- **Abracadabra**: Analyse sagt 126 BPM (Analyse-Session hält das für richtig). Mit Lives Tap-Tempo gegenprüfen.

## Aufräumen

- `.scratch/device-3/spec.md` um die Nachträge oben ergänzen (oder dort auf `CLAUDE.md` verweisen).
- Alte Arbeitszweige und Worktrees auf dem Intel-Mac (`v3-node`, `v3-js`, `v3-editor`, `v3-patch`, `v3-integration`, `plan-3.0`, `analyse-konfidenz`, `editor-zoom-tasten`) sind gemergt und können weg. Sie werden nicht gepusht.
- Daten, die von 2.x liegen bleiben, nur von Hand löschen: `D/ir.json`, `D/web/teletext.html`, `~/Music/YTSampler/chrome-profile/`.

## Tests

`for f in tools/tests/test_*.js; do node "$f" || echo FEHLER $f; done`. Zuletzt alle grün bis auf einzelne Ausreißer unter hoher Last auf dem Intel-Mac:
- `test_editor.js` „Undo/Redo: neues Snippet, tauschen, umbenennen, verschieben“ (wartet auf den Fokus im Umbenennen-Feld), einmal rot.
- `test_http.js` „SSE … beim Verbinden“ und „search … neue Suche bricht alte ab“: Zeitannahmen im Test, mal rot.
- `test_library.js` „zwei Prozesse schreiben gleichzeitig“, selten.

Auf einem schnellen Rechner prüfen, ob sie dort stabil sind. Sonst die Zeitannahmen in den Tests lockern.

## Intel-Mac (nur falls wieder dort gearbeitet wird)

`yt-dlp` als entpackte Fassung, nicht als Einzeldatei, siehe `CLAUDE.md` „Neuer Rechner“. Die Einzeldatei steht als `~/.local/bin/yt-dlp.einzeldatei.alt` daneben und kann weg.
