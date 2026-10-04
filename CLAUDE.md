# YT Sampler – Hinweise für Claude

Max-for-Live-Instrument (macOS, Apple Silicon, Live 12 / Max 9) nach dem Vorbild von ypc2000.fun: YouTube-Video suchen, Audio laden, 16 zufällige Slices auf Pads, per MIDI fingerdrummen.

**Charakter:** Live-Werkzeug für die Bühne, kein Produktionswerkzeug. Features, die zu speziell sind oder die Bedienung komplizierter machen, lehnt der Nutzer ab. Im Zweifel einfach halten und vorher fragen. Bewusst abgelehnt: Launch-Quantisierung (Clip-artig auf Takte; Input-Quantize auf 1/16 per Toggle „Quant“ gibt es seit 1.1.0), Button zum Verschieben der „1“, Pads als Clip exportieren.

**Sprache:** Mit dem Nutzer Deutsch. UI-Beschriftungen und Code-Kommentare deutsch. Parameternamen (`parameter_longname`) sind englisch, so bleiben sie.

**Setup des Nutzers:** Pad-Controller „Mutprobe“ (Pro Micro, MIDI-Noten), umgebaute Schreibmaschine (MIDI-Noten auf Kanal 16 = Tasten), Röhrenmonitor über SCART für die Teletext-Seite, dazu Technomaschine und Sidestep-Controller.

## Dateien

Alle Dateien müssen neben der `.amxd` liegen. Abhängigkeiten: `brew install yt-dlp ffmpeg deno`.

| Datei | Rolle |
|---|---|
| `YT Sampler.amxd` / `YT Sampler.maxpat` | Device bzw. derselbe Patcher als JSON. **Immer synchron halten.** |
| `ytsampler_main.js` | `[js]`: Pads, Stimmen, Favoriten, Tune, Warp, Grid, Zustand. **ES5.** |
| `ytsampler_node.js` | `[node.script]`: Suche/Download, Cache, Analyse, Session-Dateien, Teletext-Webserver. Modernes JS erlaubt. |
| `ytpads.js` | jsui 4×4-Pads (Pad 1 unten links). **ES5.** |
| `ytgrid.js` | jsui-Overlay über der Waveform (Takt-/Beatlinien, Pad-Marken), `ignoreclick 1`. **ES5.** |
| `ytvoice.maxpat` / `ytwarpvoice.maxpat` | Stimmen für die zwei `poly~` (je 16). Erzeugt von `tools/build_voices.py`. |
| `teletext.html`, `Teletext öffnen.command` | Videotext-Seite (http://localhost:8765) und Starter als randloses Chrome-Fenster. |
| `tools/patchlib.py` | `Patch` (Box-Builder), `write_amxd()`, `check()`. |
| `tools/release.sh` | Neue Version taggen und in die Ableton User Library kopieren. |
| `README.md` | Anleitung für den Nutzer. Veraltet: „Device-Breite 870“ (richtig: 1378). |

Ablage unter `~/Music/YTSampler/`: `cache/` (`<id>.wav` 44,1 kHz/16 Bit/Stereo, `<id>.json`, `<id>.chroma`), `sessions/` (`<nr>.json` + `<nr>.lock` mit PID), `web/` (Kopie von `teletext.html` für eingefrorene Devices), `chrome-profile/`.

## Git und Versionen

- Entwickelt wird hier, Live benutzt eine Kopie unter `~/Music/Ableton/User Library/YTSampler/`. Dort nie direkt arbeiten.
- Jede abgeschlossene Änderung ist eine neue Version. Claude committet selbständig, und zwar immer über `tools/release.sh X.Y.Z "kurze deutsche Nachricht"`, nie per Hand. Nicht pushen ohne Rückfrage.
- Hochzählen nach eigenem Ermessen, ausgehend von der Zahl in `VERSION`:
  - **Patch** (`1.0.1` → `1.0.2`): Fixes, Doku, Werkzeuge, kleine Anpassungen.
  - **Minor** (`1.0.x` → `1.1.0`): neue Funktion oder spürbar anderes Verhalten auf der Bühne.
  - **Major** (`1.x` → `2.0.0`): bricht Bestehendes, z. B. Session-/Favoriten-Dateien, Parameternamen (MIDI-Mappings im Set) oder Bedienkonzept.
- Das Skript prüft den Sync von `.amxd` und `.maxpat`, die Verbindungen und die Syntax. Danach schreibt es `VERSION`, committet alles als „X.Y.Z: Nachricht“, taggt `vX.Y.Z` und ersetzt den Live-Ordner per `rsync --delete`. `tools/` und `CLAUDE.md` werden nicht kopiert. Nach jedem Lauf sagt Claude dem Nutzer Bescheid, mit Version und ob sich am Device etwas geändert hat.
- Nach dem Release muss der Nutzer das Device in Live neu laden (siehe `poly~` unten).

## Signalfluss im Hauptpatch

- `[js]`-Ausgänge: 0 → `poly~ ytvoice 16 args ---ytbuf`, 1 → `node.script`, 2 → UI-Router `route memclear memadd selinfo lockset wsel status grid` (Rest → Pad-jsui; `memclear`/`memadd` sind tote Altlasten), 3 → `poly~ ytwarpvoice 16 args ---ytbuf`. Beide `poly~` → `live.gain~` → `plugout~`.
- `node.script`-Ausgang 0 → `route rclear radd status loaded needmaxlen`. `rclear`/`radd` → Treffer-`umenu`, `status` → Status-Kommentar, `loaded` → `buffer~ replace <pfad>` **und** an `[js]`, `needmaxlen` → bangt das Max-Length-Feld. Alles andere geht an `[js]`.
- `live.thisdevice` → `t b b b`: erst `init` an `[js]`, dann `set ---ytbuf` an `waveform~`, dann `live.path live_set` → Observer `tempo`, `root_note`, `scale_intervals`.
- `notein` → `pack` → `note <pitch> <vel> <kanal>` an `[js]`.
- `metro 16n @quantize 16n @active 1` → `tick` an `[js]` (Input-Quantize; läuft nur bei laufendem Transport). Pad-Anschläge gehen über `hit()`, das wartet bis zum nächsten `tick` oder sofort `trigger`/`noteoff` aufruft.
- Suche, URL, Treffer-Auswahl, Max Len gehen **direkt vom Patch** an Node, nicht über `[js]`.
- Achtung: `route` entfernt das erste Wort. Was hinter dem Router ankommt, hat kein Selektor-Präfix mehr.

## Nachrichtenprotokolle

**An die Stimmen** (immer erst `target <k>`, k = 1…16):
- beide: `env <wert> [<ms>]`, `rel <verzögerung> <releasezeit>`, `gateoff <releasezeit>`
- Sampler: `pos <von> <bis> <dauer>` (ms) → `line~` fährt die Leseposition, `play~` liest.
- Warp: `wplay <position> <tempo> <tonhöhe>` → `groove~ @timestretch 1`, Tempo als `sig~` (negativ = rückwärts), Tonhöhe per `pitchshift`. Die Stimme mutet sich via `thispoly~` 50 ms nach dem Release-Ende.

**`[js]` → Node:** `load`, `analyze <i> <start> <span>`, `analyzeall <span> <16 starts>`, `beattrack <bpm>`, `session <nr>`, `savestate <uri-kodiertes JSON>`, `key <code>`, `favinfo <name>`.
**Patch → Node:** `search`/`text`, `pick <menüindex>` (0 = Kopfzeile), `load <url|id>`, `maxlen <min>`. Unverdrahtet: `opencache`.
**Node → `[js]`:** `loaded <pfad> <ms> <id> <titel…>`, `needsession`, `newsession <nr>`, `state <kodiert>`, `statenone`, `tuning <cent>`, `tempo <bpm> <konf>`, `analysisready`, `padinfo <i> <konf> <grundton> <moll> <12 chroma>`, `beatsclear`, `beatsadd <ms…>` (Blöcke à 200), `beatsdone <down> <anzahl>`.
**`[js]` → UI (Ausgang 2):** `selinfo`, `lockset`, `wsel <von> <bis>`, `status`, `grid <clear|dur|beats|down|show|pads …>`, sowie `padflash`, `padlight`, `padsel` ans Pad-jsui.

## Patch und `.amxd` bearbeiten

Das Generator-Skript für den Hauptpatch ist verloren. Der Hauptpatch wird direkt als JSON bearbeitet:

```python
import json, sys; sys.path.insert(0, 'tools')
from patchlib import write_amxd, check
d = json.load(open('YT Sampler.maxpat'))
# … Boxen/Verbindungen in d['patcher'] ändern, neue IDs ab obj-181 …
open('YT Sampler.maxpat', 'w').write(json.dumps(d, indent=1, ensure_ascii=False))  # ohne Schluss-Newline
write_amxd(d, 'YT Sampler.amxd')
print(check('YT Sampler.maxpat'))   # (boxen, linien, ungültige Verbindungen) – letzte Liste muss leer sein
```

So geschrieben bleiben beide Dateien byte-identisch zum bisherigen Format. Aus dem Projektordner ausführen, auch `python3 tools/build_voices.py` (relative Pfade).

- Presentation-Modus, `devicewidth` 1378. Später angehängte Boxen liegen oben (das Grid-Overlay ist deshalb die letzte Box).
- Jeder Regler ist ein `live.*`-Objekt mit eigenem Parameternamen (MIDI-mappbar, im Set gespeichert). Buttons (`live.text` mode 0) hängen an `[t b]`. Toggles (Tune, Warp, Grid, Mode, Rev, Lock, Fav-Slots) schicken ihren Wert.
- `---` im Buffernamen ersetzt Live pro Device-Instanz.
- `poly~` lädt Stimmen nur beim Laden des Devices. Nach Änderungen muss der Nutzer das Device neu auf die Spur ziehen. Ein eingefrorenes Device benutzt eingebettete Kopien.
- `appversion` im JSON sagt 8.6.0. Das stammt vom Generator und ist egal.

## Fallen

- **ES5** in `ytsampler_main.js`, `ytpads.js`, `ytgrid.js`: kein `let`/`const`, keine Pfeilfunktionen, keine Template-Strings.
- **Live stellt beim Öffnen alle Parameter wieder her und „drückt“ dabei Buttons.** Aktionen sind über `ready()` bis 300 ms nach `init` gesperrt. Neue Aktions-Handler brauchen `if (!ready()) return;`.
- **`live.text`** schickt per Maus `bang`, per Mapping abwechselnd 1/0. Deshalb `[t b]`.
- **`pattr` als Zustandsspeicher ging nicht.** Daher Session-Datei plus unsichtbarer Parameter „Session“. Der Zustand wird erst gespeichert, wenn er gelesen ist (`stateReady`).
- **`play~`** versteht „Start Ende Dauer“ nicht zuverlässig. Daher `line~` davor.
- **`groove~` mit Timestretch nie in die Sampler-Stimme.** Das hat einmal alles stumm gemacht, ohne Fehlermeldung. Deshalb das zweite `poly~`.
- **`waveform~`:** nichts an Eingang 1 und 2 schicken (ergibt eine flache Linie). Nur 0 (`set`) und 3/4 (Auswahl).
- **Kein Shell-PATH unter Live.** Node ergänzt die Homebrew-Pfade selbst (`EXTRA_PATHS`).
- **Max-Symbole vertragen keine Kommas, Semikolons oder Klammern.** Titel laufen durch `clean()`, der Zustand als `encodeURIComponent(JSON)`.
- **Onset-Timing:** Der Versatz durch den gleitenden Mittelwert und die Fensterposition (0,78 × Fensterlänge) ist korrigiert. Die Konstanten N=512, HOP=64, 0,78 stehen dreifach (`estimateTempo`, `trackBeats`, `findDownbeat`). Wer an der Analyse dreht, muss die Beat-Positionen neu messen.
- **Cache-Format geändert → `AN.VERSION` erhöhen**, sonst werden alte `.chroma` falsch gelesen.
- **Webserver:** Ist 8765 belegt (zweites Device), weicht er auf bis zu 8770 aus. `Teletext öffnen.command` kennt nur 8765.

## Testen

Max und Live laufen in der Claude-Session nicht. Möglich sind:
- `node --check *.js`, plus grep auf ES6-Konstrukte in den drei ES5-Dateien
- `check()` auf alle `.maxpat`. Stimmen: `build_voices.py` in einem Scratch-Ordner laufen lassen und mit `cmp` vergleichen.
- Hauptlogik in Node simulieren (Attrappen für `outlet`, `Task`, `arrayfromargs`, `post`, `this.patcher.getnamed`). Node-Teil mit Attrappe für `max-api`.
- Analyse mit erzeugten WAVs, deren Tonart, Tempo, Schläge und „1“ bekannt sind
- `teletext.html` per Headless-Browser rendern

Alles, was nur in echtem Max sichtbar wird, testet der Nutzer in Live. Wenn etwas nicht geht, nach dem Max-Fenster fragen. Fehler von `poly~` und `js` erscheinen dort oft nur beim Laden des Devices.

## Offen / ungeprüft

- **Bekannter Fehler (nicht behoben):** Der UI-Router entfernt `grid`, beim Overlay kommt also `clear`, `dur …`, `pads …` an. `ytgrid.js` kennt aber nur die Funktion `grid()`. Das Overlay bekommt damit vermutlich nie Daten. Lösung: entweder `prepend grid` zwischen Router-Ausgang 6 und `gridui` oder die Funktionen in `ytgrid.js` einzeln anlegen.
- Warp in echtem Max: `groove~ @timestretch`, `pitchshift`, Positions-Float im linken Eingang.
- Grid-Overlay: deckungsgleich mit der Waveform? Durchsichtig? Klickt es durch?
- Treffsicherheit von Tonart, Tempo, Beats und „1“ auf echtem YouTube-Material (bisher nur synthetisch gemessen).
- Reicht Live MIDI-Kanal 16 unverändert an `notein` durch?
- Geparkt: Arduino-Sketch für die Schreibmaschine (Matrix → Noten auf Kanal 16), LED-/Display-Rückmeldung per USB-Serial.
