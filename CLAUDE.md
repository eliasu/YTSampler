# YT Sampler – Hinweise für Claude

Max-for-Live-Instrument (macOS, Apple Silicon, Live 12 / Max 9) nach dem Vorbild von ypc2000.fun: 16 Slices eines YouTube-Tracks auf Pads, per MIDI fingerdrummen. Seit 2.0 kuratiert: Bänke (16 Pads aus einem Track, gespeichert als 16 Snippets à 16 s) in einer globalen Bibliothek, bearbeitet im Browser-Editor, auf der Bühne per `Bank`-Regler durchgeschaltet. Seit 3.0 **nur noch** kuratiert: Das Device spielt ausschließlich Bänke, kuratiert wird nur im Editor, der Editor spiegelt die Device-Regler. Begriffe in `GLOSSARY.md`. Seit 4.0 hängt das Video am Pad, nicht an der Bank, ein Platz darf leer sein. Es gibt keine Track- und Mix-Bänke als Arten: Jede neue Bank startet leer, Tracks kommen per Suche aufs Pad (`fillpads`), Pads anderer Bänke per Quell-Grid (Nachtrag „Editor-Flow“ in der 4.0-Spec). Spezifikationen: 2.0 in `.scratch/bank-editor/spec.md`, 3.0 in `.scratch/device-3/spec.md`, 4.0 in `.scratch/mix-banks/spec.md` (jede ändert nur, was dort steht, sonst gilt die vorige). Teletext, IR-Fernbedienung, Schreibmaschine und Spielen ohne Bank sind seit 3.0 weg, beschrieben in `.scratch/archiv/teletext-ir-schreibmaschine.md` (Code im Tag `v2.1.0`).

**Offene Punkte und Stand der Arbeit:** `OFFEN.md` (zuerst lesen).

**Charakter:** Live-Werkzeug für die Bühne, kein Produktionswerkzeug. Features, die zu speziell sind oder die Bedienung komplizierter machen, lehnt der Nutzer ab. Im Zweifel einfach halten und vorher fragen. Bewusst abgelehnt: Launch-Quantisierung (Clip-artig auf Takte; Input-Quantize per Toggle „Quant“ gibt es seit 1.1.0, Raster 1/32–1/4 per Menü „Quant Div“), Button zum Verschieben der „1“, Pads als Clip exportieren. Außerhalb von 2.0 (Spec 1): Pads aus mehreren Tracks, Länge pro Pad, Wiedergabe im Browser (Ausnahme seit 4.0: Vorhören der Quell-Pads, Mix-Spec Nachtrag 12), Editor ohne Device, Auswahl zwischen Devices, Import der alten Favoriten, Export. Außerhalb von 3.0: Grid/Snap als eigener Schalter, Bankwahl-Regler im Editor spiegeln, Ersatz für IR oder Schreibmaschine.

**Sprache:** Mit dem Nutzer Deutsch. UI-Beschriftungen und Code-Kommentare deutsch. Parameternamen (`parameter_longname`) sind englisch, so bleiben sie.

**Setup des Nutzers:** Pad-Controller „Mutprobe“ (Pro Micro, MIDI-Noten), dazu Technomaschine und Sidestep-Controller. Alle MIDI-Kanäle spielen Pads.

## Dateien

Alle Dateien müssen neben der `.amxd` liegen. Abhängigkeiten: `brew install yt-dlp ffmpeg deno`.

| Datei | Rolle |
|---|---|
| `YT Sampler.amxd` / `YT Sampler.maxpat` | Device bzw. derselbe Patcher als JSON. **Immer synchron halten.** |
| `ytsampler_main.js` | `[js]`: Pads, Stimmen, Bank laden, Song-/Buffer-ms, Tune, Warp, Beat-Overlay, Anzeige, Regler an den Editor melden, Zustand. **ES5.** |
| `ytsampler_node.js` | `[node.script]`: Bibliothek, Snippets, Analyse, Würfeln für den Editor, Downloads, Session-Dateien, Webserver für den Editor. Modernes JS erlaubt. Alle Funktionen stehen auch in `module.exports` (Tests). |
| `editor.html` | Bank-Editor (http://localhost:8765/editor), eine Datei, ES2020, keine externen Abhängigkeiten. |
| `ytpads.js` | jsui 4×4-Pads (Pad 1 unten links). **ES5.** |
| `ytgrid.js` | jsui-Overlay über der Waveform (Takt-/Beatlinien, Pad-Marken), `ignoreclick 1`. **ES5.** |
| `ytvoice.maxpat` / `ytwarpvoice.maxpat` | Stimmen für die zwei `poly~` (je 16). Erzeugt von `tools/build_voices.py`. |
| `tools/patchlib.py` | `Patch` (Box-Builder), `write_amxd()`, `check()`. |
| `tools/release.sh` | Neue Version taggen und in die Ableton User Library kopieren. |
| `tools/deploy.sh` | Nur kopieren, ohne Commit: Zwischenstand in Live testen. `release.sh` ruft es am Ende auf. Kopiert `*.amxd *.maxpat *.js editor.html README.md VERSION`. |
| `tools/tests/` | Testskripte (`node tools/tests/test_*.js`), siehe „Testen“. Werden nicht nach Live kopiert. |
| `README.md` | Anleitung für den Nutzer. |

Speicherorte, zwei Ordner (Spec 2.1):
- **D** (Datenordner) = `~/Library/Mobile Documents/com~apple~CloudDocs/YTSampler/`, ohne iCloud Drive `~/Music/YTSampler/`. Darin `library.json` (`format 2`: `banks[].pads` = 16 × `{video, start, trim?}` oder `null` (`trim` in dB, ±12, fehlt = 0), `banks[].stage` = `false` für Ablage-Bänke, fehlt = Bühne (siehe „Bühne/Ablage“ unter Fallen), `videos`-Einträge ohne Pad bleiben während der Sitzung stehen und fallen erst beim Start weg (`keepCleanup`); `format 1` mit `video`/`starts` wird beim Lesen umgewandelt und beim nächsten `libChange` als 2 geschrieben) (+ `library.lock` mit PID), `backup/bibliothek-JJJJ-MM-TT-hhmmss.json` (10 neueste), `snippets/<bankId>.wav` (16 × 16 s, 44,1 kHz/16 Bit/Stereo) + `<bankId>.json` (`{pads, lens, durs, gain}`, `durs` = Songdauer pro Video, leerer Platz `lens 0` und stilles Fach, `gain` = Ausgleich pro Fach in dB (Mix-Spec Nachtrag 14), fehlt bei alten Dateien und wird einmal nachgemessen; alte `{video, starts, lens, dur}` gelten weiter und werden nicht neu geschnitten) + `<videoId>.chroma` + `keep/<video>_<start>.wav` und `.json` (`{len, dur}`, **Undo-Vorrat**: Audio geleerter oder überschriebener Pads, für Undo ohne Cache; nicht verwechseln mit der Ablage für Bänke), `audio/<id>.wav` + `<id>.json` (Audiodateien aus dem Finder, 44,1 kHz/16 Bit/Stereo, `{id, title, raw, duration}` wie Downloads; `cacheWav`/`infoJson` zeigen für Audio-IDs hierher; „Cache leeren“ fasst sie nie an, `keepCleanup` löscht beim Start die, die kein Pad mehr braucht), `sessions/<nr>.json` (`version: 2`, `state` seit 3.0 nur `{bankId}`) + `<nr>.lock` + einmalig `<nr>.v1.json`, `web/editor.html` (Kopie für eingefrorene Devices). Keine absoluten Pfade in D. Reste aus 2.x, die 3.0 nicht anfasst und nicht löscht: `ir.json`, `web/teletext.html`.
- **L** = `~/Music/YTSampler/`: `cache/` (`<id>.wav` ganze Tracks, `<id>.json`, `<id>.chroma`), Rest aus 2.x `chrome-profile/` (bleibt in `LOCAL_ONLY`). Wegwerfbar, wird nie automatisch gelöscht. Der Editor-Knopf „Cache leeren“ (`clearcache`) löscht dort `.wav/.json/.chroma`, nie etwas in D.
- **Aufräumen nur beim Start** von Node: `snipCleanup` (Snippets gelöschter Bänke nach 7 Tagen) und `keepCleanup` (Undo-Vorrat `keep/`, `D/snippets/<video>.chroma` und `videos`-Einträge, die kein Pad irgendeiner Bank mehr braucht). Während der Sitzung wird nichts gelöscht, was zu einem Track gehört.
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
- **Fragen an den Nutzer** stellen Arbeitssessions nie selbst. Sie schicken sie per SendMessage an die Master-Session: Titel, Kontext in 1–2 Sätzen, 2–4 Optionen mit Empfehlung zuerst, blockiert ja/nein. Die Master-Session stellt sie per Frage-Tool (AskUserQuestion, bis 4 Fragen pro Aufruf; keine visualize-Widgets, die sieht der Nutzer per Remote Control nicht) und schickt die Antworten zurück. Jeder Brief für eine neue Session nennt diese Regel und die `local_…`-ID der Master-Session (in list_sessions steht sie als `startedBy`).
- Den Fortschritt der Sessions zeigt die Master-Session in ihrer Aufgabenliste, bei laufenden Sessions mit verknüpfter Session.
- Den Patch (`.maxpat`/`.amxd`) ändert immer nur eine Session gleichzeitig. Sessions, die parallel laufen, brauchen getrennte Dateien.
- Größere Vorhaben werden erst geplant, dann gebaut. Vorbild sind `.scratch/bank-editor/`, `.scratch/device-3/` und `.scratch/mix-banks/`: Karte (`map.md`), Entscheidungs-Tickets (`issues/`), daraus `spec.md` mit Bau-Paketen. Die Spec ist der gültige Stand, die Tickets erklären das Warum. Begriffe stehen in `GLOSSARY.md`.

## Neuer Rechner

Alles Nötige liegt im Git (`github.com/eliasu/YTSampler`) und in iCloud Drive:
```
brew install yt-dlp ffmpeg deno gh
gh auth login
git clone https://github.com/eliasu/YTSampler.git ~/Sites/YTSampler
cd ~/Sites/YTSampler && tools/deploy.sh
```
- Gebraucht werden Ableton Live 12 mit Max 9 und für die Editor-Tests Chrome unter /Applications.
- **`yt-dlp` aktuell halten:** YouTube bricht ältere Versionen nach wenigen Wochen. Typische Meldung „No video formats found“ / HTTP 403, im Editor „yt-dlp veraltet → brew upgrade yt-dlp“. Abhilfe: `brew upgrade yt-dlp` (Apple Silicon: `/opt/homebrew/bin`, steht in `EXTRA_PATHS`). So war es nach dem Umzug auf den M-Mac (2026.08.19 → 2026.10.26).
- **Intel-Mac mit macOS 14:** Homebrew kann `yt-dlp` und `deno` dort nicht bauen. Stattdessen fertige Programme von den GitHub-Releases: **`yt-dlp_macos.zip`** (entpackte Fassung, nicht die Einzeldatei `yt-dlp_macos`: die entpackt sich bei jedem Start neu, braucht dann bis zu 1 min und staute sich hier zu über 160 hängenden Prozessen) nach `~/.local/yt-dlp-dir/`, Symlink `~/.local/bin/yt-dlp` → `../yt-dlp-dir/yt-dlp_macos`; `deno-x86_64-apple-darwin.zip` nach `~/.local/bin` (entpackt `deno`). `ffmpeg` geht weiter über brew. `~/.local/bin` steht in `EXTRA_PATHS` von Node, so findet das Device die Programme auch unter Live.
- Bibliothek, Snippets und Sessions kommen über iCloud Drive (`YTSampler/`, dort „Geladen lassen“). Derselbe Apple-Account muss angemeldet sein.
- Lokal bleibt `cache/` mit den ganzen WAVs (er baut sich beim Bearbeiten im Editor neu auf).
- Die Erinnerungen von Claude unter `~/.claude/` kommen nicht mit. Was wichtig ist, steht deshalb hier.

## Signalfluss im Hauptpatch

- `[js]`-Ausgänge: 0 → `poly~ ytvoice 16 args ---ytbuf`, 1 → `node.script`, 2 → UI-Router `route shownr showname selinfo wsel status grid` (Rest → Pad-jsui), 3 → `poly~ ytwarpvoice 16 args ---ytbuf`, 4 → `buffer~ ---ytbuf` (`replace <pfad>`, `clear`). Beide `poly~` → `live.gain~` → `plugout~`.
- UI-Router: `shownr`, `showname`, `selinfo`, `status` je über `prepend set` an einen Kommentar, `wsel` → `unpack` → `waveform~` Eingang 3/4, `grid` → `ytgrid.js`.
- `node.script`-Ausgang 0 geht **direkt** an `[js]`, ohne Router. Jeder Node-Selektor braucht eine gleichnamige Funktion in `[js]`, sonst „no function“ im Max-Fenster. `status` aus Node landet in `status()` und wird dort zur normalen Statuszeile.
- `buffer~` rechter Ausgang (fertig geladen) → `set ---ytbuf` → `waveform~` und `bufloaded` → `[js]`.
- `live.thisdevice` → `t b b b`: erst `init` an `[js]`, dann `set ---ytbuf` an `waveform~`, dann `live.path live_set` → Observer `tempo` (→ `prepend bpm`), `root_note`, `scale_intervals`.
- `notein` → `pack` → `note <pitch> <vel> <kanal>` an `[js]`. `[js]` ignoriert den Kanal, alle Kanäle spielen Pads.
- `live.gain~` (Volume, obj-5) Ausgang 3 (dB) → `prepend volume` (obj-197) → `[js]`. Nur zum Melden an den Editor, der Klang läuft direkt über `live.gain~`.
- Vier `metro <n> @quantize <n> @active 1` (32n, 16n, 8n, 4n) → `tick 0…3` an `[js]` (Input-Quantize; läuft nur bei laufendem Transport, es zählt nur der Tick des eingestellten Rasters). Pad-Anschläge gehen über `hit()`, das wartet bis zum nächsten `tick` oder sofort `trigger`/`noteoff` aufruft.
- Linker Block: `Bank` (`live.numbox` 1–128, varname `bank` für `setNamed`) → `prepend banknum`. Nicht `prepend bank`: `bank` ist die Node-Nachricht zum Laden. `Bank Prev`/`Bank Next` (`live.text`) → `[t b]` → `bankprev`/`banknext`.
- Die übrigen Regler je über `prepend <name>` an `[js]`: `Division` → `division`, `Rate` → `rate`, `Mode` → `playmode`, `Reverse` → `reverse`, `Tune` → `tune`, `Warp` → `warp`, `Quantize` → `quantize`, `Quant Div` → `quantdiv`, `Quant Catch` → `quantcatch`, `Voices` → `voicecount`, `Base Note` → `basenote`, `Normalize` → `normalize`. Vom Patch geht nichts direkt an Node.
- Parameter (18): `Bank`, `Bank Prev`, `Bank Next`, `Division`, `Base Note`, `Voices`, `Rate`, `Mode`, `Reverse`, `Tune`, `Warp`, `Input Quantize`, `Quant Div`, `Quant Catch`, `Normalize` (Nachtrag 14, Standard an), `Volume`, `Open Editor`, `Session` (unsichtbar). Seit 3.0 weg: `Tonal`, `Attack`, `Release`, `Source BPM`, `BPM Half`, `BPM Double`, `Grid`, `Snap`.
- Achtung: `route` entfernt das erste Wort. Was hinter dem Router ankommt, hat kein Selektor-Präfix mehr.
- `tools/tests/test_wiring.js` prüft das alles gegen die Quelltexte.

## Nachrichtenprotokolle

Vollständig in Spec 2.0 Abschnitt 6, Änderungen in Spec 3.0 Abschnitt 3. Freitext (Name, Pfad, Grund) steht immer am Ende, Namen laufen durch `clean()`, fehlende Video-ID = `-`.

**An die Stimmen** (immer erst `target <k>`, k = 1…16), Positionen in Buffer-ms:
- beide: `env <wert> [<ms>]`, `rel <verzögerung> <releasezeit>`, `gateoff <releasezeit>`. Attack 2 ms, Release 20 ms fest (`ATK_MS`, `REL_MS`).
- Sampler: `pos <von> <bis> <dauer>` (ms) → `line~` fährt die Leseposition, `play~` liest. `ext <bis> <dauer>` → dasselbe `line~` ohne Startwert, fährt also von der aktuellen Position zum neuen Ende.
- **Division live** (`retime()`, nur nach `ready()`): Dreht man `Division`, während Trigger-Pads klingen, bekommt jede Stimme vor ihrem Release nur ein neues Ende: Anker (Slice-Anfang vor Catch, rückwärts das obere Ende) + Richtung × `sliceMs()` × gemerkte Geschwindigkeit, geklammert aufs Fach. Sampler `ext` + `rel`, Warp nur `rel` (alter Faktor R, auch mit Raster). Neues Ende schon vorbei → `gateoff` mit der Release-Zeit und `playstop`. Sonst `playing <pad> <jetzt> <bis> <rest>` neu. Rate, Tune, Warp wirken weiter erst beim nächsten Anschlag, Hold ist nie betroffen. Rückwärts endet ein Slice am Pad-Start, länger als der ursprüngliche Slice geht dann nicht. Der Golden-Test schaltet `retime` ab (gab es in 3.0 nicht).
- Warp: `wplay <position> <tempo> <tonhöhe>` → `groove~ @timestretch 1`, Tempo als `sig~` (negativ = rückwärts), Tonhöhe per `pitchshift`. Die Stimme mutet sich via `thispoly~` 50 ms nach dem Release-Ende.

**Song-ms / Buffer-ms:** Im Buffer liegt Fach *i* ab `i × 16000`. `[js]` rechnet intern in Song-ms und rechnet nur an den Ausgängen um (`toBuf`): Stimmen, `wsel`, `grid` (`dur 256000`, `pads` = 16 Fachgrenzen, `beats`/`bars` pro Fach). Song-ms bleiben: Infozeile, `padana`-Schläge, `bankstate`, `playing`. Song-ms sind die des Videos von Pad *i*. Ohne Bank (`B === null`) ist nichts geladen, `durMs = 0`, Pads tun nichts.

**Regler-Werte** (`name` → varname → Handler): `div` → `Division` → `division` (Index 0–11 in `DIVS`, 11 = „4 Bars“ seit 4.0; nur hinten anhängen, sonst verschieben sich gespeicherte Sets und MIDI-Mappings; Liste dreifach: `DIVS` in `[js]`, Enum des `live.menu` „Division“, `DIVS` im Editor), `rate` → `Rate` → `rate` (0,25–2), `mode` → `Mode` → `playmode`, `rev` → `Reverse` → `reverse`, `tune` → `Tune` → `tune`, `warp` → `Warp` → `warp`, `quant` → `Quantize` → `quantize` (0/1), `qdiv` → `Quant Div` → `quantdiv` (Index 0–3: 1/32, 1/16, 1/8, 1/4), `qcatch` → `Quant Catch` → `quantcatch` (0/1; wirkt nur bei `qdiv` ≥ 2: in der ersten Hälfte nach dem Rasterpunkt klingt sofort, in der zweiten wartet es, Start im Slice um die Verspätung versetzt, Ende bleibt), `vol` → `Volume` → `volume` (−70–6 dB), `voices` → `Voices` → `voicecount` (Index 0–6 in `VOICE_OPTS`), `base` → `Base Note` → `basenote` (0–127), `norm` → `Normalize` → `normalize` (0/1, Standard 1: Ausgleich pro Pad an). In `[js]` als `PARAM_VAR`.

**Patch → `[js]`:** `note <p> <v> <kanal>`, `tick`, `init`, `bpm <tempo>` (Live, ein Argument), `scaleroot`/`scaleints` (Observer), `banknum`, `bankprev`, `banknext`, `sessionid`, die Regler-Handler oben.
**`[js]` → Node:** `session <nr>`, `savestate <uri-kodiertes JSON>` (nur `{bankId}`), `bankstate <bankId> <sel> <mode> <rev> <s×16> <w×16> <div> <rate> <tune> <warp> <quant> <vol> <voices> <base> <qdiv> <qcatch> <bpm> <norm>` (nur bei Änderung, `bpm` = Lives Tempo auf 2 Stellen, fürs Vorhören im Editor, `rate` auf 3, `vol` auf 1 Nachkommastelle gerundet), `bankpeek <nr>`, `banksel <nr>` (über der letzten Bank: nichts), `bankload <nr>` (wie `banksel`, aber auf die letzte Bank geklammert; Device ohne Bank). `nr` zählt nur die Bühne, `bankopen <bankId>`, `playing <pad> <von> <bis> <dauer>`, `playstop <pad>`, `trackname <name…>`.
**Node → `[js]`:** `bank <id> <nr> <s×16> <l×16> <pfad…>` (`nr` = Platz auf der Bühne, 0 = Ablage-Bank, Anzeige „-“) (davor `bankname <id> <name…>`; leerer Platz: Start 0, `l = 0`), danach pro belegtem Pad `padana <i> <bpm> <cent> <off> <beats…>` (Tempo, Stimmung und Schläge des Videos von Pad *i*: `bpm` bestätigt, sonst Analyse, sonst 0; Schläge in Song-ms nur im Fenster [Start − 4 Schläge, Start + l + 4 Schläge]; `off` = Index des ersten Schlags ab der ersten „1“) und `padinfo`, zum Schluss `analysisready`. Gleich nach `bank` (vor der Analyse) `padgain <i> <ausgleich dB> <trim dB>` für alle 16 Pads, danach nur bei geändertem Trim der aktiven Bank (Nachtrag 14). Nach einer Tempo-Korrektur im Editor kommt `padana` für die Pads dieses Videos noch einmal, `bankbusy` (aktive Bank wird gleich neu geschnitten: Anschläge warten bis `bank` + `bufloaded`, höchstens 3 s), `bankgone <id>`, `bankfail <id> <grund…>`, `libstate <anzahl> <nr> <ok|leer|kaputt|neuer>` (`anzahl` = Bänke auf der Bühne, `nr` 0 = aktive Bank in der Ablage; `leer` nur, wenn es gar keine Bank gibt), `bankpeek <nr> <anzahl> <name…>` (Bühne), `padhit <i>`/`padup <i>`, `param <name> <wert>` (Editor stellt einen Regler), `needsession`, `newsession <nr>`, `state <kodiert>`, `statenone`, `status <text…>`, `analysisready`, `padinfo <i> <konf> <grundton> <moll> <12 chroma>`.
**`[js]` → UI (Ausgang 2):** `shownr <text>`, `showname <text…>`, `selinfo`, `wsel <von> <bis>`, `status`, `grid <clear|dur|beats|bars|show|pads …>`, sowie `padflash`, `padlight`, `padsel`, `padempty <16 × 0/1>` ans Pad-jsui (aus `bank()` und `unload()`, leerer Platz dunkel ohne Nummer; `unload()` schickt 16 Nullen).
**Gestrichen in 4.0:** Node → `[js]` `tempo`, `tuning`, `beatsclear`, `beatsadd`, `beatsdone`, `bpm` mit zwei Argumenten; `[js]` → Node `analyzeall`, `beattrack`; `<video>` in `bankstate` (Node leitet `device.video` aus `sel` ab).
**Gestrichen in 3.0:** Node → `[js]` `loaded`, `loadfail`, `silence`; `[js]` → Node `load`, `key`, `analyze`, `bpmset`; Patch → `[js]` `threshold`, `attack`, `release`, `srcbpm`, `bpmhalf`, `bpmdouble`, `gridon`, `snapmode`.

**Regler spiegeln:** Editor `POST /cmd {cmd: "param", name, value}` → Node prüft (sonst `badreq`, auch bei kaputter Bibliothek erlaubt) → `param <name> <wert>` an `[js]` → `setNamed(PARAM_VAR[name], wert)` (erst nach `ready()`) → der `live.*`-Regler gibt den Wert aus → `prepend` → Handler → `bankstate` → SSE `device.params`. Eine Wahrheit (die Live-Parameter), keine Schleife: Der Editor schickt nur bei Bedienung.

**HTTP (Node, 127.0.0.1:8765–8770):** `GET /` → 302 `/editor`, `GET /editor`, `GET /editor/events` (SSE: `hello`, `lib`, `device`, `cache`, `beats`, `play`, `stop`, `job`, `msg`), `POST /cmd` (Befehle Spec 2.0 3.3 plus `param`, seit 4.0 `newmix {name?}` → `{id}` (Knopf „Neue Bank“: Name „Neue Bank“ bzw. `name`, 16 leere Plätze, landet in der Ablage, wird aktiv; Undo `delete`, Redo `restore`; „Neue Bank“ am Suchtreffer = `newmix {name: Titel}` + `fillpads` mit allen 16 Plätzen, ein Undo-Schritt), `stage {id, on, at?}` → `{at}` (Bühne `on: true`/Ablage, `at` = Platz im Zielbereich, fehlt = ans Ende; Undo = `stage` mit altem Bereich und Platz), `move {id, to}` → `{at}` (`to` = Platz im eigenen Bereich), `setpad {id, pad, video, start, info?}` (Pad kopieren, `video: null` leert; `info {title, bpm?}` nur nötig, wenn das Video nicht in `videos` steht, sonst ignoriert; ohne Quelle `playonly`; das alte Pad landet in der Ablage), `fillpads {id, video, pads[], tag?}` → `{}` sofort (Track laden, pro Platz würfeln, Plätze überschreiben; Fortschritt als SSE `job {kind: "pads", tag, id, video, pads, phase, progress}`, `done` bringt `before`, `after` (Pad-Einträge) und `videos` (Titel/bpm) fürs Undo = `setpad` pro Platz), `trim {id, pad, trim}` (Nachtrag 14: Trim pro Pad, ±12 dB, 0 löscht das Feld, leerer Platz `badreq`; `setpad` nimmt optional `trim` mit), `clearcache` → `{freed}` (gesperrt mit `cachebusy`, solange geladen oder geschnitten wird), `newbank` gibt es nicht mehr, `delete` → `removed.videos` (Map), `restore` nimmt sie; Fehlercodes 6.5; nur JSON, Host/Origin localhost, ≤ 64 KB), `POST /audio?name=<Dateiname>` (Audiodatei aus dem Finder, roher Body `application/octet-stream`, höchstens 200 MB, Host/Origin wie `/cmd`, sonst 403; Node wandelt per `ffmpeg` nach `D/audio/<id>.wav`, gleiche Datei = gleiche ID, nicht neu gewandelt → `{ok, video, title, dur}` oder `{ok: false, code: audiofail, text}`; aufs Pad danach per `fillpads`, mehrere Dateien = ein Undo-Schritt im Editor), `GET /peaks/<video>`, `GET /snip/<bankId>/<pad>` (Mix-Spec Nachtrag 12: Fach des Pads aus `snippets/<bankId>.wav` als WAV, nur bis `lens[pad]`; 404 bei leerem Platz, fehlender Datei oder Snippet, das nicht zur Bank passt (wird gerade neu geschnitten); nur GET, Host localhost; zum Vorhören im Quell-Grid per Web Audio, an Live vorbei). Der Editor steuert nur das Device auf 8765. SSE `lib`: `banks[]` = `{id, name, pads, mix, stage, snip, wav, gain}` (`gain` = Ausgleich pro Pad aus der Snippet-`.json`, 0 wo das Snippet nicht zum Pad passt) (`stage` immer Boolean), `videos.<id>` mit `wav`, `dur`. SSE `device`: `{bankId, nr (0 = Ablage), video (des gewählten Pads, `-` = leer), sel, starts, spans, params}`, `params` = `{div, rate, mode, rev, tune, warp, quant, qdiv, qcatch, vol, voices, base, bpm, norm}` (`bpm` nur Anzeige, kein Regler) oder `null` vor dem ersten `bankstate`.

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
- **Starts** kommen immer aus der Bibliothek, nichts rastet ein (`effStart(i)` = `pads[i]`). Ein Pad spielt nie über sein Snippet-Ende (Klammer in `playRange`, Hold blendet `SNIP_FADE_MS` vorher aus). Mit „4 Bars“ greift die Klammer bei Pads mit vollem Fach (16 s) ohne Warp ab Live-Tempo < 60 × Rate × Tonhöhenfaktor BPM, mit Warp, wenn das Quelltempo des Pads < 60 BPM ist (der Slice umfasst 16 Schläge der Quelle); kürzere Fächer (Track-Ende) entsprechend früher. `retime` klammert genauso.
- **Werte pro Pad (4.0):** `[js]` hält Tempo, Stimmung und Schläge in `PA[i]` (`{bpm, cent, off, beats}`, `null` = keine Analyse), auch bei einer Track-Bank (dann 16 × dieselben Werte). `tempoTrusted(i)`, `warpRatio(i)`, `beatsOK(i)`, `xAt(i, t)`, `timeAt(i, x)`, `pitchRate(i)` nehmen den Pad-Index. Außerhalb des `padana`-Fensters rechnen `xAt`/`timeAt` linear weiter, das reicht für Slices bis 4 Takte und das Snippet-Ende. `[js]` fragt keine Analyse mehr an, Node schickt sie nach `bank` von selbst. Node hält eine Analyse pro Video (`anaMap`). Golden-Test in `test_main.js`: eine Track-Bank klingt wie in 3.0.
- **Beats statt Grid:** `beatsOK(i)` = ≥ 4 Beats und Quelltempo > 0. Dann Overlay-Linien (`grid show 1`), Taktposition in `selinfo` und Warp im Trigger-Modus auf dem Raster der Quelle. Sonst festes Verhältnis Set-Tempo/Quelltempo. Es gibt keinen Schalter.
- **Bank wechseln:** erst alle Stimmen `gateoff 5`, `replace` 10 ms später per `Task` (letzte Wahl gewinnt). Nie `replace` aus dem Patch, das macht nur Ausgang 4.
- **„Stumm“** gilt immer bei `libstate leer|kaputt|neuer` und wenn nichts geladen ist. `bankfail` ohne klingende Bank macht ebenfalls stumm („nicht ladbar“).
- **Device ohne Bank** (neues Device, 1.x-/Teletext-Set, `statenone`, `bankId 0`, `bankgone`): `[js]` schickt `bankload <Wert des Reglers „Bank“>` (`bankTarget()` per `getvalueof()`), aber erst nach `state`/`statenone` **und** `libstate ok` (`wantLoad`). Node schickt `libstate` vor `state`.
- **Würfeln** gibt es nur noch im Editor (Node: `roller`, `rollStart`, `rollBank(v, n, taken)` für `fillpads`). Bevorzugt Taktanfänge, verwirft Slices ganz in Stille (`silentRanges()`). Die „1“: `findIntro()` überspringt den Anfang ohne Kick/Einsätze, die erste „1“ danach.
- **`param` per `setNamed`:** Ein Wert aus dem Editor läuft durch den echten Regler. Ob Live dabei einen Undo-Eintrag macht oder Automation überschreibt, ist ungeprüft (siehe Offen). Kommt der Wert nicht an, wäre die Variante `setNamed(var, "set", v)` plus direkter Handler-Aufruf zu prüfen.
- **Analyseformat (`AN.VERSION`) nur abwärtskompatibel ändern.** Analysen in `D/snippets/` lassen sich nicht neu rechnen, wenn die ganze WAV fehlt. Neue Felder anhängen, `AN.VERSION` erhöhen und die alte Version in `AN_READABLE` behalten. Unbekannte Version = „Analyse fehlt“ (im Cache wird neu gerechnet, in D nie überschrieben). In 4.0 unverändert, die Analyse liegt wie bisher pro Video (`D/snippets/<video>.chroma`).
- **`library.json`** nur über `libChange()` schreiben (Sperre, frisch lesen, `rev + 1`, tmp + `fsync` + `rename`). Unbekannte Felder bleiben erhalten. Kaputt oder `format > 2` → nie anfassen. Ein 3.x-Device sieht `format 2` als „neuer“ und bleibt stumm: beide Macs gleichzeitig auf 4.0.
- **Schneiden pro Fach (4.0, `snipSource`):** ganze WAV im Cache, sonst gleiches `{video, start}` in der alten Snippet-Datei derselben Bank, sonst in der einer anderen Bank, leerer Platz = Stille. Ein belegtes Pad ohne Quelle → `playonly`, nichts geändert. Danach der Undo-Vorrat `D/snippets/keep/` (`findSlot`): `setpad` und `fillpads` legen das alte Pad dort ab, bevor sie es überschreiben (`keepPad`). So geht Undo von Leeren/Überschreiben auch ohne Cache. Grenze: Ein zweites Device räumt beim Start den Undo-Vorrat auf, die das erste in seiner Sitzung noch für Undo bräuchte.
- **Node-Downloads immer mit `.catch`** (`fetchVideo`, `fillPads`), sonst beendet ein Fehlschlag den Prozess.
- **Downloads im Editor:** bis `ED_PAR` (3) laufen parallel, der Rest wartet (job-Phase `queue`, im Editor „wartet“). Volle Plätze: select/fetch verdrängt pads (`fillpads`) verdrängt fetchall. `fillpads` trägt ein `tag` vom Editor, das in jedem `job` zurückkommt (Ladezustand an genau diesen Pads). Ein Pad, das lädt, nimmt im Editor nichts Gezogenes an. Bekannte yt-dlp-Fehler übersetzt `errMsg` per `YT_HINTS`.
- **Audio-IDs:** 10 Hex aus dem SHA-1 des Dateiinhalts + `_` (`isAudio`), passt in `VIDEO_RE`, YouTube-IDs enden nie auf `_`. Für Audio nie `yt-dlp`: `download` wirft „Audiodatei fehlt“ (iCloud noch nicht geladen), `fetchAll` und der Hintergrund-Teil von `select` überspringen Audio. Audio ≤ 16 s bekommt Start 0 (das Würfeln landet von selbst dort, `last ≤ 0`).
- **Suche:** erst direkt über die YouTube-Ergebnisseite (`fastSearch`, unter 1 s), bei Fehler oder ohne Treffer `yt-dlp`. Tests setzen `YTS_NO_FAST_SEARCH` und starten nie das echte `yt-dlp` (`harness.js`).
- **Würfeln (`roller`):** immer aufs Raster, solange Beats da sind, auch bei unsicherem Tempo: erst Taktanfänge, dann Schläge.
- **Bühne/Ablage:** `onStage(b)` = `b.stage !== false`. Fehlendes Feld = Bühne, deshalb bleibt `format 2` (ältere Versionen behalten das Feld als unbekanntes Feld und zeigen alle Bänke durchnummeriert). Auf der Bühne wird das Feld gelöscht, in der Ablage steht `false`. Die Reihenfolge in `banks[]` ist gemischt, jeder Bereich zählt für sich. Nummern (`bankNr`, `stageBanks()`) und alles, was das Device durchschaltet, nur Bühne. `newmix`/`duplicate` → Ablage, `create` (Tests) → Bühne. Löschen der aktiven Bühnen-Bank: Nachrücker auf demselben Bühnenplatz, sonst der davor. Aktive Ablage-Bank gelöscht oder Bühne leer: `bankgone` an `[js]`, das die Bank am Regler lädt (`bankload`). `[js]`: Nummer 0 → Anzeige „-“, Regler bleibt stehen; `libstate` setzt `B.nr` auch auf 0. Prev/Next von „-“ aus holen beide die Bühnen-Bank, auf der der Regler steht, der Regler selbst springt auf die Bank seines Werts.
- **Lautstärke (Nachtrag 14):** Ausgleich = Messung pro Snippet-Fach (`padGain`, K-Gewichtung, erste 2 s ab Start, Ziel `NORM_TARGET` −14, ±12 dB, Anheben bis Peak −1 dBFS), steht in der Snippet-`.json`. Trim = Pad-Feld in der Bibliothek. Am Device `env × 10^(((Norm ? gain : 0) + trim) / 20)`, Werte > 1 gehen (`line~` → `*~`). Wer am Schneiden dreht, muss `gain` weiter mitschreiben; fehlt es, misst `snipGain` aus der WAV nach (beim Start und in `snipEnsure`). Der Golden-Test bekommt kein `padgain`, bleibt also bei 0 dB.
- **Webserver:** Ist 8765 belegt (zweites Device), weicht er auf bis zu 8770 aus. Der Editor kennt nur 8765 (= erstes Device).
- **Neue Node-Nachricht an `[js]`** braucht eine gleichnamige Funktion in `[js]`, neue `[js]`-Nachricht an Node ein `Max.addHandler`. `test_wiring.js` meckert sonst.

## Testen

Max und Live laufen in der Claude-Session nicht. Möglich sind:
- `node --check *.js`, plus grep auf ES6-Konstrukte in den drei ES5-Dateien
- `check()` auf alle `.maxpat`. Stimmen: `build_voices.py` in einem Scratch-Ordner laufen lassen und mit `cmp` vergleichen.
- `for f in tools/tests/test_*.js; do node "$f" || echo FEHLER $f; done` aus dem Projektordner:
  - `test_wiring.js`: Sync `.maxpat`/`.amxd`, Router, jeder Selektor hat ein Ziel, Parameter
  - `test_main.js`, `test_ytgrid.js`: `[js]` bzw. Overlay mit Attrappen (`outlet`, `Task`, `arrayfromargs`, `LiveAPI`, `mgraphics`)
  - `test_audio.js`: `POST /audio` mit echtem `ffmpeg`, `fillpads` mit Audio, nie `yt-dlp`, `clearcache`, `keepCleanup`
  - `test_library.js`, `test_migration.js`, `test_snippets.js`, `test_analysis.js`, `test_download.js`, `test_http.js`: Node mit Attrappen für `max-api` und `yt-dlp` (`fake_ytdlp.js`), Temp-HOME (`harness.js`), freier Port (`YTS_PORT=0`)
  - `test_editor.js` (gegen `editor_mock.js`, `--shots` schreibt `editor_screens/`), `test_e2e.js` (echter Node + echtes `[js]` + Editor): brauchen Chrome unter /Applications
- Analyse mit erzeugten WAVs (`wav.js`), deren Tonart, Tempo, Schläge und „1“ bekannt sind

Alles, was nur in echtem Max sichtbar wird, testet der Nutzer in Live. Wenn etwas nicht geht, nach dem Max-Fenster fragen. Fehler von `poly~` und `js` erscheinen dort oft nur beim Laden des Devices.

## Offen / ungeprüft

- **3.0 in Live (Prüfliste aus Spec 3.0, 6):** Device lädt ohne Fehler, neue Zeile unter der Waveform lesbar, Schalter groß genug. Altes 2.x-Set: Bank kommt, MIDI-Mappings auf die 14 Parameter gehen noch; 2.x-Set mit Teletext-Stand und neues Device laden die Bank am Regler. Editor-Regler in beide Richtungen, auch per MIDI gedreht; Undo-Eintrag in Live? Automation („Re-Enable Automation“)? Volume aus dem Editor (`live.gain~` Ausgang 3 wirklich dB?). Warp ohne Grid-Schalter folgt dem Raster (klingt wie Warp+Grid in 2.0), Linien im Overlay ohne Schalter. Alle MIDI-Kanäle spielen.
- **Aus 2.0 noch offen:** Grid-Linien und 16 Fachgrenzen deckungsgleich auf der Snippet-Waveform; Bankwechsel klickfrei auch bei Hold und Warp, Snippet-Ende sauber; `Bank` per CC mit 350 ms Ruhe, Prev/Next; „steuert: <Spurname>“ (`LiveAPI` auf `this_device canonical_parent`); Set speichern → Bank verschieben/löschen → Set öffnen; iCloud-Umzug, „Geladen lassen“, Bühne ohne Internet.
- Bekannte Grenzen: Löscht ein **anderes** Device die aktive Bank, spielt dieses weiter (Nummer 0) und lädt keinen Nachrücker. Zwei Bibliotheksänderungen innerhalb von 30 ms kommen als ein `lib` mit dem letzten `by`. Tempo am zweiten Device leert die Undo-Historie im Editor.
- Grid-Overlay: durchsichtig, klickt es durch? (`ignoreclick 1`)
- Warp in echtem Max: `groove~ @timestretch`, `pitchshift`, Positions-Float im linken Eingang.
- Treffsicherheit von Tonart, Tempo, Beats und „1“ auf echtem YouTube-Material (bisher nur synthetisch gemessen).
- Tests nie gegen Port 8765 laufen lassen, wenn Live läuft: das ist das echte Device. Die Tests nehmen Port 0.
- Wackelig auf dem Intel-Mac: `test_library.js` „zwei Prozesse schreiben gleichzeitig“ schlägt selten fehl. Nicht kaschieren, beobachten.
- Geparkt: LED-/Display-Rückmeldung per USB-Serial.
