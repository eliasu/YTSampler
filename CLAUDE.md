# YT Sampler – Hinweise für Claude

Max-for-Live-Instrument (macOS, Apple Silicon, Live 12 / Max 9) nach dem Vorbild von ypc2000.fun: 16 Slices eines YouTube-Tracks auf Pads, per MIDI fingerdrummen. Seit 2.0 kuratiert: Bänke (16 Pads aus einem Track, gespeichert als 16 Snippets à 16 s) in einer globalen Bibliothek, bearbeitet im Browser-Editor, auf der Bühne per `Bank`-Regler durchgeschaltet. Begriffe in `GLOSSARY.md`, die Spezifikation von 2.0 in `.scratch/bank-editor/spec.md`.

**Charakter:** Live-Werkzeug für die Bühne, kein Produktionswerkzeug. Features, die zu speziell sind oder die Bedienung komplizierter machen, lehnt der Nutzer ab. Im Zweifel einfach halten und vorher fragen. Bewusst abgelehnt: Launch-Quantisierung (Clip-artig auf Takte; Input-Quantize auf 1/16 per Toggle „Quant“ gibt es seit 1.1.0), Button zum Verschieben der „1“, Pads als Clip exportieren. Außerhalb von 2.0 (Spec 1): Pads aus mehreren Tracks, Länge pro Pad, Wiedergabe im Browser, Editor ohne Device, Auswahl zwischen Devices, Import der alten Favoriten, Export.

**Sprache:** Mit dem Nutzer Deutsch. UI-Beschriftungen und Code-Kommentare deutsch. Parameternamen (`parameter_longname`) sind englisch, so bleiben sie.

**Setup des Nutzers:** Pad-Controller „Mutprobe“ (Pro Micro, MIDI-Noten), umgebaute Schreibmaschine (MIDI-Noten auf Kanal 16 = Tasten), Röhrenmonitor über SCART für die Teletext-Seite, dazu Technomaschine und Sidestep-Controller.

## Dateien

Alle Dateien müssen neben der `.amxd` liegen. Abhängigkeiten: `brew install yt-dlp ffmpeg deno`.

| Datei | Rolle |
|---|---|
| `YT Sampler.amxd` / `YT Sampler.maxpat` | Device bzw. derselbe Patcher als JSON. **Immer synchron halten.** |
| `ytsampler_main.js` | `[js]`: Pads, Stimmen, Bank laden, Song-/Buffer-ms, Tune, Warp, Grid, Anzeige, Zustand. **ES5.** |
| `ytsampler_node.js` | `[node.script]`: Bibliothek, Snippets, Analyse, Würfeln für den Editor, Downloads, Session-Dateien, Webserver für Editor und Teletext. Modernes JS erlaubt. Alle Funktionen stehen auch in `module.exports` (Tests). |
| `editor.html` | Bank-Editor (http://localhost:8765/editor), eine Datei, ES2020, keine externen Abhängigkeiten. |
| `ytpads.js` | jsui 4×4-Pads (Pad 1 unten links). **ES5.** |
| `ytgrid.js` | jsui-Overlay über der Waveform (Takt-/Beatlinien, Pad-Marken), `ignoreclick 1`. **ES5.** |
| `ytvoice.maxpat` / `ytwarpvoice.maxpat` | Stimmen für die zwei `poly~` (je 16). Erzeugt von `tools/build_voices.py`. |
| `teletext.html`, `Teletext öffnen.command` | Videotext-Seite (http://localhost:8765) und Starter als randloses Chrome-Fenster. |
| `ir_teletext/ir_teletext.ino` | Pro Micro mit IR-Empfänger an D7. Reicht rohe IR-Codes als Noten auf Kanal 15 weiter. Wird nicht nach Live kopiert. |
| `tools/patchlib.py` | `Patch` (Box-Builder), `write_amxd()`, `check()`. |
| `tools/release.sh` | Neue Version taggen und in die Ableton User Library kopieren. |
| `tools/deploy.sh` | Nur kopieren, ohne Commit: Zwischenstand in Live testen. `release.sh` ruft es am Ende auf. Kopiert `*.amxd *.maxpat *.js teletext.html editor.html`, `.command`, `README.md`, `VERSION`. |
| `tools/tests/` | Testskripte (`node tools/tests/test_*.js`), siehe „Testen“. Werden nicht nach Live kopiert. |
| `README.md` | Anleitung für den Nutzer. |

Ablage in zwei Ordnern (Spec 2.1):
- **D** (Datenordner) = `~/Library/Mobile Documents/com~apple~CloudDocs/YTSampler/`, ohne iCloud Drive `~/Music/YTSampler/`. Darin `library.json` (+ `library.lock` mit PID), `backup/bibliothek-JJJJ-MM-TT-hhmmss.json` (10 neueste), `snippets/<bankId>.wav` (16 × 16 s, 44,1 kHz/16 Bit/Stereo) + `<bankId>.json` (`video`, `starts`, `lens`, `dur`) + `<videoId>.chroma`, `sessions/<nr>.json` (`version: 2`) + `<nr>.lock` + einmalig `<nr>.v1.json`, `ir.json` (gelernte Fernbedienung), `web/` (Kopien von `teletext.html`/`editor.html` für eingefrorene Devices). Keine absoluten Pfade in D.
- **L** = `~/Music/YTSampler/`: `cache/` (`<id>.wav` ganze Tracks, `<id>.json`, `<id>.chroma`), `chrome-profile/`. Wegwerfbar, wird nie automatisch gelöscht.
- **Umzug** beim ersten Start von 2.0: Gibt es iCloud Drive, aber kein D, verschiebt Node alles aus L außer `cache/` und `chrome-profile/` per `rename` nach D. Gescheitert → weiter in L, Status „Umzug nach iCloud fehlgeschlagen“. Tests laufen deshalb nur in einem Temp-HOME (die Harness verweigert sonst).

## Git und Versionen

- Entwickelt wird hier, Live benutzt eine Kopie unter `~/Music/Ableton/User Library/YTSampler/`. Dort nie direkt arbeiten.
- Jede abgeschlossene Änderung ist eine neue Version. Claude committet selbständig, und zwar immer über `tools/release.sh X.Y.Z "kurze deutsche Nachricht"`, nie per Hand. Nicht pushen ohne Rückfrage.
- Hochzählen nach eigenem Ermessen, ausgehend von der Zahl in `VERSION`:
  - **Patch** (`1.0.1` → `1.0.2`): Fixes, Doku, Werkzeuge, kleine Anpassungen.
  - **Minor** (`1.0.x` → `1.1.0`): neue Funktion oder spürbar anderes Verhalten auf der Bühne.
  - **Major** (`1.x` → `2.0.0`): bricht Bestehendes, z. B. Session-/Favoriten-Dateien, Parameternamen (MIDI-Mappings im Set) oder Bedienkonzept.
- Das Skript prüft den Sync von `.amxd` und `.maxpat`, die Verbindungen und die Syntax. Danach schreibt es `VERSION`, committet alles als „X.Y.Z: Nachricht“, taggt `vX.Y.Z` und ersetzt den Live-Ordner per `rsync --delete`. `tools/` und `CLAUDE.md` werden nicht kopiert. Nach jedem Lauf sagt Claude dem Nutzer Bescheid, mit Version und ob sich am Device etwas geändert hat.
- **Deploy:** Sagt der Nutzer „deploy“, kopiert Claude den aktuellen Stand per `tools/deploy.sh` nach Live, ohne Commit und ohne Version. Vorher selbst prüfen (Sync, `check()`, `node --check`), das Skript prüft nichts. Danach lädt der Nutzer neu und testet. Erst wenn es passt, kommt `release.sh`.
- Nach Release oder Deploy muss der Nutzer das Device in Live neu laden (siehe `poly~` unten).

## Arbeitsweise mit Sessions

Der Nutzer arbeitet mit einer **Master-Session** (Claude-Desktop-App, oft per Remote Control vom Handy):
- Besprochen und entschieden wird in der Master-Session. Größere Arbeit lagert sie in eigene Sessions aus. Die bekommen einen eigenen Worktree und dürfen Sub-Agents nutzen.
- **Arbeitssessions** committen auf ihrem Zweig mit normalem `git commit`. Kein `release.sh`, kein `deploy.sh`, kein Push. Mergen, Deploy, Release und Push macht nur die Master-Session, nacheinander, nach Rückfrage beim Nutzer.
- **Fragen an den Nutzer** stellen Arbeitssessions nie selbst. Sie schicken sie per SendMessage an die Master-Session: Titel, Kontext in 1–2 Sätzen, 2–4 Optionen mit Empfehlung zuerst, blockiert ja/nein. Die Master-Session zeigt sie als klickbare Karten im Chat (visualize, Modul elicitation) und schickt die Antworten zurück. Jeder Brief für eine neue Session nennt diese Regel und die `local_…`-ID der Master-Session (in list_sessions steht sie als `startedBy`).
- Den Fortschritt der Sessions zeigt die Master-Session in ihrer Aufgabenliste, bei laufenden Sessions mit verknüpfter Session.
- Den Patch (`.maxpat`/`.amxd`) ändert immer nur eine Session gleichzeitig. Sessions, die parallel laufen, brauchen getrennte Dateien.
- Größere Vorhaben werden erst geplant, dann gebaut. Vorbild ist `.scratch/bank-editor/`: Karte (`map.md`), Entscheidungs-Tickets (`issues/`), daraus `spec.md` mit Bau-Paketen. Die Spec ist der gültige Stand, die Tickets erklären das Warum. Begriffe stehen in `GLOSSARY.md`.

## Neuer Rechner

Alles Nötige liegt im Git (`github.com/eliasu/YTSampler`) und in iCloud Drive:
```
brew install yt-dlp ffmpeg deno gh
gh auth login
git clone https://github.com/eliasu/YTSampler.git ~/Sites/YTSampler
cd ~/Sites/YTSampler && tools/deploy.sh
```
- Gebraucht werden Ableton Live 12 mit Max 9 und für die Editor-Tests Chrome unter /Applications.
- Bibliothek, Snippets, Sessions und `ir.json` kommen über iCloud Drive (`YTSampler/`, dort „Geladen lassen“). Derselbe Apple-Account muss angemeldet sein.
- Lokal bleiben `cache/` mit den ganzen WAVs (er baut sich beim Bearbeiten im Editor neu auf) und `chrome-profile/`.
- Die Erinnerungen von Claude unter `~/.claude/` kommen nicht mit. Was wichtig ist, steht deshalb hier.

## Signalfluss im Hauptpatch

- `[js]`-Ausgänge: 0 → `poly~ ytvoice 16 args ---ytbuf`, 1 → `node.script`, 2 → UI-Router `route shownr showname selinfo wsel status grid` (Rest → Pad-jsui), 3 → `poly~ ytwarpvoice 16 args ---ytbuf`, 4 → `buffer~ ---ytbuf` (`replace <pfad>`, `clear`). Beide `poly~` → `live.gain~` → `plugout~`.
- UI-Router: `shownr`, `showname`, `selinfo`, `status` je über `prepend set` an einen Kommentar, `wsel` → `unpack` → `waveform~` Eingang 3/4, `grid` → `ytgrid.js`.
- `node.script`-Ausgang 0 geht **direkt** an `[js]`, ohne Router. Jeder Node-Selektor braucht eine gleichnamige Funktion in `[js]`, sonst „no function“ im Max-Fenster. `status` aus Node landet in `status()` und wird dort zur normalen Statuszeile.
- `buffer~` rechter Ausgang (fertig geladen) → `set ---ytbuf` → `waveform~`.
- `live.thisdevice` → `t b b b`: erst `init` an `[js]`, dann `set ---ytbuf` an `waveform~`, dann `live.path live_set` → Observer `tempo` (→ `prepend bpm`), `root_note`, `scale_intervals`.
- `notein` → `pack` → `note <pitch> <vel> <kanal>` an `[js]`. Kanal 16 = Schreibmaschine (`key`), Kanal 15 = IR (ignoriert), Rest = Pads.
- `metro 16n @quantize 16n @active 1` → `tick` an `[js]` (Input-Quantize; läuft nur bei laufendem Transport). Pad-Anschläge gehen über `hit()`, das wartet bis zum nächsten `tick` oder sofort `trigger`/`noteoff` aufruft.
- Linker Block: `Bank` (`live.numbox` 1–128, varname `bank` für `setNamed`) → `prepend banknum`. Nicht `prepend bank`: `bank` ist die Node-Nachricht zum Laden. `Bank Prev`/`Bank Next` (`live.text`) → `[t b]` → `bankprev`/`banknext`.
- Die übrigen Regler je über `prepend <name>` an `[js]`. Vom Patch geht nichts mehr direkt an Node.
- Achtung: `route` entfernt das erste Wort. Was hinter dem Router ankommt, hat kein Selektor-Präfix mehr.
- `tools/tests/test_wiring.js` prüft das alles gegen die Quelltexte.

## Nachrichtenprotokolle

Vollständig in Spec 6. Freitext (Name, Pfad, Grund) steht immer am Ende, Namen laufen durch `clean()`, fehlende Video-ID = `-`.

**An die Stimmen** (immer erst `target <k>`, k = 1…16), Positionen in Buffer-ms:
- beide: `env <wert> [<ms>]`, `rel <verzögerung> <releasezeit>`, `gateoff <releasezeit>`
- Sampler: `pos <von> <bis> <dauer>` (ms) → `line~` fährt die Leseposition, `play~` liest.
- Warp: `wplay <position> <tempo> <tonhöhe>` → `groove~ @timestretch 1`, Tempo als `sig~` (negativ = rückwärts), Tonhöhe per `pitchshift`. Die Stimme mutet sich via `thispoly~` 50 ms nach dem Release-Ende.

**Song-ms / Buffer-ms:** Mit Bank liegt im Buffer Fach *i* ab `i × 16000`. `[js]` rechnet intern in Song-ms und rechnet nur an den Ausgängen um (`toBuf`): Stimmen, `wsel`, `grid` (`dur 256000`, `pads` = 16 Fachgrenzen, `beats`/`bars` pro Fach). Song-ms bleiben: Infozeile, Analyse-Anfragen, `bankstate`, `playing`, Session. Ohne Bank ist Buffer = Song.

**`[js]` → Node:** `session <nr>`, `savestate <uri-kodiertes JSON>`, `load <id>` (Teletext/keine Bank), `analyze <i> <start> <span>`, `analyzeall <span> <16 starts>`, `beattrack <bpm>`, `key <code>`, `bankstate <bankId> <video|-> <sel> <mode> <rev> <s×16> <w×16>` (nur bei Änderung), `bankpeek <nr>`, `banksel <nr>`, `bankopen <bankId>`, `bpmset <video> <bpm>`, `playing <pad> <von> <bis> <dauer>`, `playstop <pad>`, `trackname <name…>`.
**Node → `[js]`:** `bank <id> <nr> <bpm> <s×16> <l×16> <songdur> <video> <pfad…>` (davor `bankname <id> <name…>`), `bankgone <id>`, `bankfail <id> <grund…>`, `libstate <anzahl> <nr> <ok|leer|kaputt|neuer>`, `bankpeek <nr> <anzahl> <name…>`, `bpm <video> <bpm>` (Lives Tempo kommt als `bpm <tempo>` mit einem Argument), `padhit <i>`/`padup <i>` (Editor), `loaded <pfad> <ms> <id> <titel…>` (nur ohne Bank), `loadfail <video> <grund…>`, `needsession`, `newsession <nr>`, `state <kodiert>`, `statenone`, `status <text…>`, `tuning <cent>`, `tempo <bpm> <konf>`, `silence <von> <bis> …`, `analysisready`, `padinfo <i> <konf> <grundton> <moll> <12 chroma>`, `beatsclear`, `beatsadd <ms…>` (Blöcke à 200), `beatsdone <down> <anzahl>`.
**`[js]` → UI (Ausgang 2):** `shownr <text>`, `showname <text…>`, `selinfo`, `wsel <von> <bis>`, `status`, `grid <clear|dur|beats|bars|show|pads …>`, sowie `padflash`, `padlight`, `padsel` ans Pad-jsui.

**HTTP (Node, 127.0.0.1:8765–8770):** Teletext `/`, `/events`, `/key`, `/state`; Editor `GET /editor`, `GET /editor/events` (SSE: `hello`, `lib`, `device`, `cache`, `beats`, `play`, `stop`, `job`, `msg`), `POST /cmd` (Befehle Spec 3.3, Fehlercodes 6.5; nur JSON, Host/Origin localhost, ≤ 64 KB), `GET /peaks/<video>`. Der Editor steuert nur das Device auf 8765.

**IR-Fernbedienung:** läuft an Live vorbei. `teletext.html` liest den Pro Micro per Web MIDI (Note-On Kanal 15) und schickt `POST /key {k: "ir:<code>:<wiederholung>"}`. Mehrere offene Fenster → Node verwirft Dubletten (`IR_DEDUP_MS`). In Live beim Pro Micro „Spur“ ausschalten. Code = Note + 128 × Bit 0 von (Velocity − 1), Wiederholung = Bit 1. Node übersetzt per `ir.json` in `handleKey`-Tasten (`up`, `down`, `pgup`, `pgdn`, `enter`, `back`, `tap:0`–`tap:9`, `power`). Merkmodus: Cmd+Shift+M (oder Strg+Shift+M) auf der Teletext-Seite → `learn`, Esc bricht ab. Ziffern tippen wie beim Handy (`TAP`, 1 = abc … 9 = yz, 0 = Leerzeichen, `TAP_MS`). `power` schaltet `ui.tvOff` → Abschalt-/Einschalt-Animation; aus = nur An/Aus wirkt.

## Patch und `.amxd` bearbeiten

Das Generator-Skript für den Hauptpatch ist verloren. Der Hauptpatch wird direkt als JSON bearbeitet:

```python
import json, sys; sys.path.insert(0, 'tools')
from patchlib import write_amxd, check
d = json.load(open('YT Sampler.maxpat'))
# … Boxen/Verbindungen in d['patcher'] ändern, neue IDs ab obj-195 …
open('YT Sampler.maxpat', 'w').write(json.dumps(d, indent=1, ensure_ascii=False))  # ohne Schluss-Newline
write_amxd(d, 'YT Sampler.amxd')
print(check('YT Sampler.maxpat'))   # (boxen, linien, ungültige Verbindungen) – letzte Liste muss leer sein
```

So geschrieben bleiben beide Dateien byte-identisch zum bisherigen Format. Aus dem Projektordner ausführen, auch `python3 tools/build_voices.py` (relative Pfade).

- Presentation-Modus, `devicewidth` 1024. Links (x 5–165) Anzeige, `Bank` ◀ ▶, Statuszeile; dann Pads (170), Waveform mit Overlay (378–968), Volume (972). Später angehängte Boxen liegen oben (das Grid-Overlay ist deshalb die letzte Box).
- Jeder Regler ist ein `live.*`-Objekt mit eigenem Parameternamen (MIDI-mappbar, im Set gespeichert). Buttons (`live.text` mode 0) hängen an `[t b]`. Toggles (Tune, Warp, Grid, Quant, Mode, Rev) schicken ihren Wert.
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
- **Mit Bank** rastet nichts ein (`effStart` = Start aus der Bibliothek), es wird nicht gewürfelt und `silence` nicht benutzt. Ein Pad spielt nie über sein Snippet-Ende (Klammer in `playRange`, Hold blendet `SNIP_FADE_MS` vorher aus).
- **Bank wechseln:** erst alle Stimmen `gateoff 5`, `replace` 10 ms später per `Task` (letzte Wahl gewinnt). Nie `replace` aus dem Patch, das macht nur Ausgang 4.
- **„Stumm“** (`libstate leer|kaputt|neuer`) gilt nur mit aktiver Bank oder wenn nichts geladen ist. Teletext und 1.x-Sets spielen weiter.
- **Würfeln (`randomStart`, nur ohne Bank / Teletext):** bevorzugt Taktanfänge (wenn `beatsOK()`), sonst Rasterpunkt, sonst frei. Verwirft Slices ganz in Stille und schon belegte Starts. `sortPads()` hält die freien Pads chronologisch. Neues Video → `autoRoll`, nachgewürfelt wird bei `beatsdone` (bzw. `analysisready` ohne Tempo). Die „1“: `findIntro()` überspringt den Anfang ohne Kick/Einsätze, `beatsDown` ist die erste „1“ danach.
- **Analyseformat (`AN.VERSION`) nur abwärtskompatibel ändern.** Analysen in `D/snippets/` lassen sich nicht neu rechnen, wenn die ganze WAV fehlt. Neue Felder anhängen, `AN.VERSION` erhöhen und die alte Version in `AN_READABLE` behalten. Unbekannte Version = „Analyse fehlt“ (im Cache wird neu gerechnet, in D nie überschrieben).
- **`library.json`** nur über `libChange()` schreiben (Sperre, frisch lesen, `rev + 1`, tmp + `fsync` + `rename`). Unbekannte Felder bleiben erhalten. Kaputt oder `format > 1` → nie anfassen.
- **Node-Downloads immer mit `.catch`** (`fetchVideo`, `newBank`), sonst beendet ein Fehlschlag den Prozess.
- **Webserver:** Ist 8765 belegt (zweites Device), weicht er auf bis zu 8770 aus. `Teletext öffnen.command` und der Editor kennen nur 8765 (= erstes Device).
- **Neue Node-Nachricht an `[js]`** braucht eine gleichnamige Funktion in `[js]`, neue `[js]`-Nachricht an Node ein `Max.addHandler`. `test_wiring.js` meckert sonst.

## Testen

Max und Live laufen in der Claude-Session nicht. Möglich sind:
- `node --check *.js`, plus grep auf ES6-Konstrukte in den drei ES5-Dateien
- `check()` auf alle `.maxpat`. Stimmen: `build_voices.py` in einem Scratch-Ordner laufen lassen und mit `cmp` vergleichen.
- `for f in tools/tests/test_*.js; do node "$f" || echo FEHLER $f; done` aus dem Projektordner:
  - `test_wiring.js`: Sync `.maxpat`/`.amxd`, Router, jeder Selektor hat ein Ziel, Parameter
  - `test_main.js`, `test_ytgrid.js`: `[js]` bzw. Overlay mit Attrappen (`outlet`, `Task`, `arrayfromargs`, `LiveAPI`, `mgraphics`)
  - `test_library.js`, `test_migration.js`, `test_snippets.js`, `test_analysis.js`, `test_download.js`, `test_http.js`: Node mit Attrappen für `max-api` und `yt-dlp` (`fake_ytdlp.js`), Temp-HOME (`harness.js`), freier Port (`YTS_PORT=0`)
  - `test_editor.js` (gegen `editor_mock.js`, `--shots` schreibt `editor_screens/`), `test_e2e.js` (echter Node + echtes `[js]` + Editor): brauchen Chrome unter /Applications
- Analyse mit erzeugten WAVs (`wav.js`), deren Tonart, Tempo, Schläge und „1“ bekannt sind
- `teletext.html` per Headless-Browser rendern

Alles, was nur in echtem Max sichtbar wird, testet der Nutzer in Live. Wenn etwas nicht geht, nach dem Max-Fenster fragen. Fehler von `poly~` und `js` erscheinen dort oft nur beim Laden des Devices.

## Offen / ungeprüft

- **2.0 in Live (Prüfliste aus Spec 9):** Device lädt ohne Fehler, Breite 1024 und linker Block lesbar (Schriftgröße der Banknummer), Grid-Linien und 16 Fachgrenzen deckungsgleich auf der Snippet-Waveform; Bankwechsel klickfrei auch bei Hold und Warp, Snippet-Ende sauber; Tune/Warp/Warp+Grid wie 1.3; `Bank` per CC mit 350 ms Ruhe, Prev/Next; Editor steuert, „steuert: <Spurname>“ (`LiveAPI` auf `this_device canonical_parent`); Set speichern → Bank verschieben/löschen → Set öffnen; iCloud-Umzug, „Geladen lassen“, Bühne ohne Internet.
- Bekannte Grenzen: Löscht ein **anderes** Device die aktive Bank, spielt dieses weiter (Nummer 0) und lädt keinen Nachrücker. Zwei Bibliotheksänderungen innerhalb von 30 ms kommen als ein `lib` mit dem letzten `by`. Tempo am zweiten Device leert die Undo-Historie im Editor.
- Grid-Overlay: durchsichtig, klickt es durch? (`ignoreclick 1`)
- Warp in echtem Max: `groove~ @timestretch`, `pitchshift`, Positions-Float im linken Eingang.
- Treffsicherheit von Tonart, Tempo, Beats und „1“ auf echtem YouTube-Material (bisher nur synthetisch gemessen).
- Reicht Live MIDI-Kanal 15/16 unverändert an `notein` durch?
- IR mit echter Fernbedienung (RC5, Address 7); Web-MIDI-Erlaubnis im Teletext-Chrome; fängt Chrome Cmd+Shift+M selbst ab?
- Tests nie gegen Port 8765 laufen lassen, wenn Live läuft: das ist das echte Device. Die Tests nehmen Port 0.
- Geparkt: Arduino-Sketch für die Schreibmaschine (Matrix → Noten auf Kanal 16), LED-/Display-Rückmeldung per USB-Serial.
