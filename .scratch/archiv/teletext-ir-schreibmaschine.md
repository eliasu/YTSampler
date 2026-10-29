# Archiv: Teletext, IR-Fernbedienung, Schreibmaschine, Spielen ohne Bank

Mit 3.0.0 entfernt (Entscheidung des Nutzers, Planung `.scratch/device-3/`). Hier steht, wie es gebaut war, damit man es wieder aufbauen kann. Kein Code-Dump.

**Wo der Code liegt:** im letzten 2.x-Tag. Das ist `v2.0.1`, außer die Master-Session released vor 3.0.0 noch eine 2.x-Version. Dann gilt deren Tag, und das Bau-Paket 4 trägt ihn hier ein: **letzter Tag mit dem Code: `v2.0.1`**.

```
git show v2.0.1:teletext.html
git show "v2.0.1:Teletext öffnen.command"
git show v2.0.1:ir_teletext/ir_teletext.ino
git show v2.0.1:ytsampler_node.js     # Abschnitt „Teletext-Webseite“ am Ende, loadVideo, search
git show v2.0.1:ytsampler_main.js     # note(), loaded(), randomStart(), rollAll()
git show v2.0.1:README.md             # Bedienung aus Nutzersicht
```

Davor gab es die Funktionen auch in 1.x, dort noch zusammen mit Favoriten und dem Suchblock im Device (`v1.3.6`).

## 1. Teletext-Seite

**Zweck:** Eine Videotext-Seite (40 × 25 Zeichen, 4:3, für 720 × 576 PAL) auf einem Röhrenmonitor über SCART. Auf der Bühne konnte man dort YouTube suchen und ein Video direkt ins Device laden.

**Dateien**
- `teletext.html`: eine Datei, ohne Abhängigkeiten. Zeichnet ein Raster aus Zeichenzellen mit den Teletext-Farben (W, Y, C, G, R, B, K) und blinkenden Zellen. `?overscan=8` vergrößert den Sicherheitsrand (Standard 5 %), `?crt=1` legt Scanlines zur Vorschau darüber. Doppelklick schaltet Vollbild. Die Uhr in der Kopfzeile läuft jede Sekunde.
- `Teletext öffnen.command`: öffnet `http://localhost:8765` als randloses Chrome-Fenster (`--app`, eigenes Profil in `~/Music/YTSampler/chrome-profile`, also L). Mit `X=… Y=…` direkt auf dem zweiten Bildschirm, ohne Chrome in Safari.
- Node spiegelt die Seite über `pagePath()` nach `D/web/teletext.html`. So findet ein eingefrorenes Device sie auch.

**Seitenaufbau:** Zeile 0 mit `P100 YT-SAMPLER` und Datum/Uhr, Zeile 1 als Titelbalken, Zeile 3 mit dem Verbindungszustand („KEINE VERBINDUNG / WARTE AUF LIVE“, „VERBUNDEN“, dann „LÄDT n%“ mit Balken, „KONVERTIERT“, „ANALYSIERT“, „SUCHT …“, „BEREIT“). Ab Zeile 5 „AKTUELL“ mit dem Titel, ab Zeile 9 „SUCHE“ mit dem Eingabefeld und `MAX n MIN`. Ab Zeile 12 die Trefferliste: 7 pro Seite (`PAGE_SIZE`), der markierte Treffer gelb hinterlegt, Dauer rechts, „SEITE x/y“. Zeile 22 die Meldung (`ui.message`), darunter die Fastext-Zeile. Im Merkmodus eine eigene Seite „FERNBEDIENUNG LERNEN“ mit Schritt x/y, der blinkenden Taste und einem Fortschrittsbalken. `tvOff` spielt eine Abschalt-/Einschalt-Animation.

**HTTP** (Node, gleicher Server wie der Editor, 127.0.0.1:8765–8770)
| Route | Was |
|---|---|
| `GET /` und `/index.html` | `teletext.html` |
| `GET /events` | SSE ohne Eventnamen: bei jeder Änderung `data: <viewState()>`, gebündelt in 30 ms (`pushUi`) |
| `POST /key` | `{k}` mit höchstens 1000 Byte, Antwort 204. `k` = Taste (siehe unten) oder `ir:<code>:<0|1>` |
| `GET /state` | `viewState()` als JSON |

`viewState()`: `query, searched, searching, sel, pageSize, results [{t, d}], hidden, maxLen, loading, phase (INFO|DOWNLOAD|KONVERT|ANALYSE), progress, title, message, learn ({step, of, label} | null), tvOff`.

**Zustand in Node:** Das Objekt `ui` (Felder wie oben) und `status()`, das neben `Max.outlet('status')` auch `ui.message` setzt. Dazu `allResults`/`lastResults`/`lastQuery`. Der Längenfilter `maxLenSec` stand fest auf 7 min (seit 2.0, vorher Regler „Max Length“). Treffer ohne Dauer fielen weg. `search()` lief über `yt-dlp --flat-playlist --dump-single-json ytsearch30:<q>`, angezeigt wurden höchstens 15.

**Tasten (`handleKey`)**: `enter` (neuer Begriff → suchen, sonst markierten Treffer laden), `back`, `esc` (Eingabe leeren bzw. Lernen abbrechen), `up`/`down`, `pgup`/`pgdn` (seitenweise), `char:<z>` (höchstens 36 Zeichen), `tap:<0–9>`, `learn`, `power`. Im Browser: Enter, ⌫, Esc, ↑/↓, ←/→ bzw. Bild ↑/↓ und Zeichen. Cmd/Strg+Shift+M → `learn`. Cmd-Kürzel blieben beim Browser.

**Editor-Anbindung (2.x):** Das SSE-Event `device` hatte `teletext: {phase, progress} | null`. Der Editor zeigte dann „Teletext lädt n %“.

## 2. IR-Fernbedienung

**Weg:** IR-Empfänger an D7 eines Pro Micro (`ir_teletext/ir_teletext.ino`, Bibliotheken IRremote und MIDIUSB). Der Pro Micro ist ein USB-MIDI-Gerät und schickt jeden erkannten Code roh als Note-On/Off auf **Kanal 15**. Das ging an Live vorbei: `teletext.html` las den Pro Micro per **Web MIDI** (`navigator.requestMIDIAccess`, auch neu eingesteckte Geräte über `onstatechange`) und schickte `POST /key {k: "ir:<code>:<rep>"}`. In Live musste beim Pro Micro „Spur“ aus sein. `[js]` ignorierte Kanal 15 ohnehin (`IR_CHANNEL`).

**Kodierung**
- Sketch: `note = command & 127`, `velocity = 1 + (command >> 7) + (Wiederholung ? 2 : 0)`. Protokoll `UNKNOWN` wurde verworfen. Die Address wurde nicht ausgewertet: Fremde Fernbedienungen mit gleichem Command lösten mit aus. Getestet war RC5 mit Address 7.
- Seite: nur Status `0x9E` (Note-On Kanal 15) mit Velocity > 0. `code = note + 128 × ((vel − 1) & 1)`, `rep = ((vel − 1) & 2) ? 1 : 0`.
- Seriell (115200) zeigte der Sketch jedes Signal, ohne Signal alle 5 s „wartet auf IR …“.

**Zuordnung `D/ir.json`:** `{ "<code>": "<taste>" }`, Tasten wie bei `handleKey`: `up, down, pgup, pgdn, enter, back, tap:1 … tap:9, tap:0, power`. Gehaltene Tasten wiederholten nur `up, down, pgup, pgdn, back` (`IR_REPEAT`). Bei `tvOff` wirkte nur `power`.

**Merkmodus:** `learn` setzt `ui.learn = 0`. Nacheinander wurden 17 Schritte abgefragt (`IR_STEPS`: HOCH, RUNTER, LINKS, RECHTS, OK, LÖSCHEN, 1–9, 0, AN/AUS). Wiederholungen und schon vergebene Codes zählten nicht. Nach dem letzten Schritt wurde `ir.json` geschrieben („Fernbedienung gespeichert“), Esc brach ab („Lernen abgebrochen“).

**Dubletten:** Schickten mehrere offene Teletext-Fenster denselben Code, verwarf Node ihn innerhalb von `IR_DEDUP_MS = 60` (gleicher Code und gleiches `rep`).

**Ziffern wie beim Handy (`multitap`, auch für die Schreibmaschine nutzbar):** `TAP = [' 0', 'abc1', 'def2', 'ghi3', 'jkl4', 'mno5', 'pqr6', 'stu7', 'vwx8', 'yz9']`. Dieselbe Ziffer innerhalb von `TAP_MS = 1200` ersetzt den letzten Buchstaben durch den nächsten. Jede andere Taste beendet das Tippen.

## 3. Schreibmaschine (MIDI-Tastatur)

**Weg:** Eine umgebaute Schreibmaschine schickt Noten auf **Kanal 16**, die Notennummer ist der Zeichencode. Im Patch `notein → pack → note <pitch> <vel> <kanal>` an `[js]`. `note()` leitete Kanal 16 (`KEY_CHANNEL`) bei Velocity > 0 als `key <code>` an Node weiter. Sonst ging nichts an die Pads.

**Codes (Node, `Max.addHandler('key')`)**
| Note | Taste |
|---|---|
| 32–126 | Zeichen (ASCII) |
| 1 2 3 4 / 5 6 7 | ä ö ü ß / Ä Ö Ü (`MIDI_CHARS`) |
| 8 / 13 / 27 | back / enter / esc |
| 17 / 18 / 19 / 20 | up / down / pgup / pgdn (`MIDI_KEYS`) |

**Routing in Live**, wenn Pad-Controller und Schreibmaschine gleichzeitig spielen sollten: Die Sampler-Spur bekam die Mutprobe als Eingang. Eine zweite MIDI-Spur bekam die Schreibmaschine als Eingang und gab auf die Sampler-Spur aus. Beide auf Monitor „In“.

Der Arduino-Sketch für die Schreibmaschine (Matrix → Noten) war geparkt und wurde nie gebaut.

## 4. Spielen ohne Bank („keine Bank“)

**Wann:** Nach einem Teletext-Download, nach einem 1.x-Set (Session ohne `bankId`) und wenn die gespeicherte Bank gelöscht war (`bankgone`, dann lud die Session-Kopie).

**Ablauf**
- `[js]` → Node `load <id>`. `loadVideo()` lud über den eigenen Download-Weg `dev` (unabhängig vom Editor-Weg `ed`, ein neuer Wunsch brach den laufenden `yt-dlp` ab) die ganze WAV nach `L/cache/<id>.wav` (+ `<id>.json` mit Titel und Dauer). Videos über 10 min nur die ersten 10 min (`--download-sections *0-600`). Danach `loaded <pfad> <ms> <id> <titel…>` an `[js]`, Analyse aus `L/cache/<id>.chroma` (`ensureAnalysis(…, false)`). Fehler kamen als `loadfail <video> <grund…>`.
- `[js] loaded()`: `buffer~ replace` über Ausgang 4, `B = null`, `st.bankId = 0`, Buffer = ganzer Track, Buffer-ms = Song-ms. Bei einem neuen Video wurden alle 16 Pads gewürfelt und `autoRoll = 1` gesetzt. Beim gleichen Video (Set geöffnet) blieben die Starts. Anzeige „keine Bank: <Titel>“. Leere oder kaputte Bibliothek machte in diesem Modus **nicht** stumm.
- Gespeichert wurde die Kopie in der Session (`id, title, pads, srcBpm, srcAuto, bpmConf`), in die Bibliothek kam nichts. Eine Bank daraus entstand nur im Editor.

**Würfeln im Device (`randomStart(lo, hi)`)**: bis zu 40 Versuche. In den ersten 20 ein Taktanfang (`randomGridStart(4, …)`), wenn `beatsOK()`. Sonst ein Rasterpunkt im Grid-Abstand (`gridStep()`: Slice-Notenwert, Beat oder Bar je nach Snap), wenn `gridOK()`. Sonst frei in `[lo, durMs − spanMs]`. Verworfen wurden Slices ganz in Stille (`isSilent`, Bereiche aus der Node-Nachricht `silence <von> <bis> …`, berechnet von `silentRanges()`) und schon belegte Starts (`taken`). `sortPads()` sortierte aufsteigend. `rollAll()` lief bei `beatsdone` bzw. bei `analysisready` ohne Tempo, solange `autoRoll` gesetzt war. Die „1“ kam aus `findIntro()`/`findDownbeat()` (bleibt in Node für den Editor).

**Einrasten (Snap)**: Ohne Bank lag `effStart(i)` mit Grid auf dem nächsten Rasterpunkt (`snapTime`). Gespeichert wurde die freie Position. Hold rückwärts ohne Bank spielte vom Start nach links durch den Track.

**Tempo ohne Bank:** `tempoTrusted()` verlangte bei automatisch erkanntem Tempo eine Konfidenz ≥ 0,3. Bestätigen ging über Source BPM, ÷2, ×2.

## 5. Was 3.0 davon behält

- Node: `silentRanges()`, `findIntro()`/`findDownbeat()`, `trackBeats()` und das Würfeln für den Editor (`roller`, `rollStart`, `rollBank`).
- Den Download in den Cache (nur noch der Editor-Weg), `extractId()` für URL-Eingaben in der Editor-Suche.
- `chrome-profile/` in L bleibt liegen, `D/ir.json` und `D/web/teletext.html` ebenfalls. Nichts davon wird automatisch gelöscht.
