# Spezifikation: Device 3.0 – nur noch kuratiert

Stand 2026-10-29, aus den Tickets 01–04 der Karte [`map.md`](map.md) und den Antworten des Nutzers auf F1–F5. Grundlage ist die Spec 2.0 (`.scratch/bank-editor/spec.md`). **Was hier nicht geändert wird, gilt dort weiter.** Begründungen stehen in den Tickets. **(festgelegt)** markiert, was die Planung ohne Rückfrage entschieden hat.

Leitlinie: Das Device ist das Bühneninstrument, kuratiert wird nur im Editor. Was hier nicht steht, wird nicht gebaut. Version: **3.0.0** (Parameter fallen weg, Bedienkonzept).

## 1. Überblick

| | 2.0 | 3.0 |
|---|---|---|
| Laden | Bank, oder ganzes Video über Teletext („keine Bank“) | nur Bank |
| Eingabe | Pads, Schreibmaschine (Kanal 16), IR (Kanal 15) | Pads auf allen Kanälen |
| Würfeln | Editor (Node) und Device (nur ohne Bank) | nur Editor (Node) |
| Grid/Snap | Schalter `Grid`, Menü `Snap` | weg. Linien immer, wenn Beats da sind. Warp folgt dem Raster |
| Quelltempo | Device (Source BPM, ÷2, ×2) und Editor | nur Editor |
| Tonal/Attack/Release | Regler | feste Werte 0,5 / 2 ms / 20 ms |
| Editor-Regler | keine | spiegelt Division, Mode, Rev, Tune, Warp, Quant, Rate, Volume, Voices, Base Note |
| Ohne Bank im Set | spielt Session-Kopie | lädt die Bank, auf der `Bank` steht |

Begriff **„keine Bank“** (Spec 2.0, 1.) entfällt. `bankId 0` heißt nur noch: Es ist (noch) nichts geladen.

## 2. Was wegfällt

### 2.1 Dateien

Löschen: `teletext.html`, `Teletext öffnen.command`, `ir_teletext/` (Ordner). Archiv: `.scratch/archiv/teletext-ir-schreibmaschine.md`. Dort trägt Paket 5 den letzten 2.x-Tag ein.

Nicht anfassen (Daten des Nutzers, nichts wird automatisch gelöscht): `D/ir.json`, `D/web/teletext.html`, `L/chrome-profile/`. `LOCAL_ONLY` in Node behält `chrome-profile`, der Umzug aus 1.x bleibt gleich.

### 2.2 Node (`ytsampler_node.js`)

| Weg | Was genau |
|---|---|
| Teletext-Zustand | `ui`, `pushUi`, `viewState`, `clients`, `PAGE_SIZE`, `fmtDur`, `allResults`, `lastResults`, `lastQuery`, `maxLenSec`, `SEARCH_SHOW`, `search()`, `showResults()`. `status()` schickt nur noch `Max.outlet('status', t)`. |
| Teletext-HTTP | Routen `/events`, `/key`, `/state`, `/index.html` und `pagePath('teletext.html')`. `GET /` antwortet **302 → `/editor`** (festgelegt). Das Ping-Intervall gilt nur noch für `edClients`. Log beim Start: `YT Sampler: Editor unter http://localhost:<port>/editor`. |
| Schreibmaschine/IR | `handleKey`, `MIDI_KEYS`, `MIDI_CHARS`, Handler `key`, `TAP`, `TAP_MS`, `tap`, `multitap`, `IR_FILE`, `IR_STEPS`, `IR_REPEAT`, `irMap`, `irNew`, `IR_DEDUP_MS`, `irLast`, `irInput`. |
| Laden ohne Bank | `loadVideo`, `devJob`, Handler `load`, Nachrichten `loaded`, `loadfail` an `[js]`. In `download()` fällt der Parameter `way` weg, der Zwischenname ist fest `<id>.dl.*` (festgelegt). Die Kommentare zu „zwei Wegen“ werden angepasst. |
| Analyse | `ensureAnalysis(id, title, bank)`: nur noch der Bank-Weg (Parameter `bank` fällt weg, immer aus D, sonst Cache/WAV wie heute über `getAnalysis(v, true)`). `Max.outlet('silence', …)` fällt weg. `silentRanges()` bleibt für `roller`. Handler `analyze` fällt weg (toter Code). |
| SSE `device` | Feld `teletext` fällt weg, `mode`/`rev` ziehen nach `params` (3.2). |
| Export für Tests | `loadVideo` aus `module.exports` entfernen. |

Bleibt unverändert: Bibliothek, Snippets, Würfeln für den Editor, Editor-Downloads, Peaks, Session, Umzug, `extractId` (Editor-Suche mit URL).

### 2.3 `[js]` (`ytsampler_main.js`, ES5)

| Weg | Was genau |
|---|---|
| Kanäle | `KEY_CHANNEL`, `IR_CHANNEL`. `note(p, v, ch)` ignoriert den Kanal: `i = p − P.base`, dann `hit`. |
| Ohne Bank | `loaded`, `loadfail`, `autoRoll`, `silent`, `silence()`, `randomStart`, `randomGridStart`, `isSilent`, `taken`, `sortPads`, `rollAll`. Alle Zweige „ohne Bank“ in `effStart`, `playRange` (Hold rückwärts ohne Bank), `toBuf`, `bufMs`, `sendGridUI`, `sendPadMarks`, `showBank`, `libstate`. `B === null` heißt jetzt: nichts geladen (`durMs = 0`, Pads tun nichts). |
| Grid/Snap | `P.grid`, `P.snap`, `gridon`, `snapmode`, `gridStep`, `snapTime`, `gridOK`. Ersetzt durch `beatsOK()` (4.3). `effStart(i)` ist `st.pads[i]` (Funktion darf bleiben oder inline). |
| Quelltempo am Device | `srcbpm`, `bpmhalf`, `bpmdouble`, `scaleSrc`, `setSrc`, `updateSrcUI`, Nachricht `bpmset`. Bleiben: `tempo(bpm, conf)` (Analyse) und `bpm(video, bpm)` (Editor über Node). |
| Tonal/Attack/Release | `P.thresh`, `P.atk`, `P.rel`, Handler `threshold`, `attack`, `release`. Ersetzt durch Konstanten `TONAL = 0.5`, `ATK_MS = 2`, `REL_MS = 20` (F1). |
| Session-Kopie | `st.id`, `st.title`, `st.pads`, `st.srcBpm`, `st.srcAuto`, `st.bpmConf` werden nicht mehr gespeichert (4.5). Laufzeitwerte dürfen im Speicher bleiben, aber außerhalb von `st`. |
| `bankgone` | lädt nicht mehr die Kopie per `load`, sondern nach 4.5. |

### 2.4 Patch (`YT Sampler.maxpat`/`.amxd`)

Boxen samt Verbindungen weg: `Tonal` (obj-138) + `prepend threshold` (139), `Attack` (152) + `prepend attack` (153), `Release` (154) + `prepend release` (155), `Source BPM` (142) + `prepend srcbpm` (143), `÷2` (144) + `t b` (145) samt Ziel, `×2` (147) + `t b` (148) samt Ziel, `Grid` (176) + `prepend gridon` (177), `Snap` (178) + `prepend snapmode` (179). Was dabei ohne Verbindung übrig bleibt (z. B. eine Nachricht `bpmhalf`), fällt mit weg.

**Parameternamen, die wegfallen (8):** `Tonal`, `Attack`, `Release`, `Source BPM`, `BPM Half`, `BPM Double`, `Grid`, `Snap`.
**Bleiben (14):** `Bank`, `Bank Prev`, `Bank Next`, `Division`, `Base Note`, `Voices`, `Rate`, `Mode`, `Reverse`, `Tune`, `Warp`, `Input Quantize`, `Volume`, `Session` (unsichtbar).

`notein` → `pack` → `prepend note` bleibt mit drei Werten, `[js]` ignoriert den dritten.

### 2.5 Editor (`editor.html`)

Fällt weg: die Ansicht „keine Bank“ (`view().nobank`, Klasse `nobank`, Tag `#nobank`, Hinweise „keine Bank …“, „Teletext lädt“). Bei `device.bankId 0` zeigt der Editor die vorhandene Fläche `#blank` („Keine Bank aktiv“, „Bibliothek leer“ usw.).

### 2.6 Doku und Werkzeuge

- `tools/deploy.sh`: `teletext.html` und `"Teletext öffnen.command"` aus der `rsync`-Liste. `rsync --delete` räumt beides im Live-Ordner weg.
- `README.md`: Abschnitte „Teletext-Anzeige“, „Tastatur / Schreibmaschine“, „Grid (Beat-Raster)“ und alles zu „keine Bank“, Source BPM/÷2/×2, Tonal, Attack, Release raus. Neu: Bedienung 3.0 (Device-Regler, Editor-Regler), Hinweis „`ir.json`, `web/teletext.html` und `chrome-profile/` kann man von Hand löschen“, „alle MIDI-Kanäle spielen Pads“.
- `CLAUDE.md`: Charakter (Teletext/Schreibmaschine/IR nicht mehr im Setup), Dateitabelle, Signalfluss (Kanal 15/16), Protokolle (3.), HTTP, IR-Absatz, Fallen („Stumm“ ohne Ausnahme, Würfeln nur Editor, „Mit Bank“-Sätze vereinfachen), „Offen“ (IR-, Teletext-, Kanal-Punkte raus, neue Live-Prüfpunkte aus 6.), Verweis auf diese Spec.
- `GLOSSARY.md`: unverändert (Pad, Bank, Snippet, Bibliothek gelten weiter).

## 3. Protokoll-Änderungen

Max-Regeln wie Spec 2.0, 6. Neue Selektoren laufen über den Rest-Ausgang an die gleichnamige `[js]`-Funktion.

### 3.1 Die Regler-Werte

| `name` | Regler (varname) | Wert | `[js]`-Handler |
|---|---|---|---|
| `div` | `Division` | ganz 0–10 (Index in `DIVS`) | `division` |
| `rate` | `Rate` | 0,25–2 | `rate` |
| `mode` | `Mode` | 0 Trigger · 1 Hold | `playmode` |
| `rev` | `Reverse` | 0 · 1 | `reverse` |
| `tune` | `Tune` | 0 · 1 | `tune` |
| `warp` | `Warp` | 0 · 1 | `warp` |
| `quant` | `Quantize` | 0 · 1 | `quantize` |
| `vol` | `Volume` | −70–6 dB | `volume` **(neu)** |
| `voices` | `Voices` | ganz 0–6 (Index in `VOICE_OPTS`: Mono, 2, 3, 4, 5, 8, 16) | `voicecount` |
| `base` | `Base Note` | ganz 0–127 | `basenote` |

- `[js]` merkt sich alle zehn Werte in `P` so, wie der Regler sie schickt. Für Voices kommt dazu der Index (`P.voicesIdx`), für Volume `P.vol`.
- **Volume** ist neu für `[js]`: Patch-Verbindung `live.gain~` (obj-5) Ausgang 3 (float, dB) → neues `prepend volume` → `[js]`. `volume(v)` speichert nur `P.vol` und ruft `sendBankstate()`. Am Klang ändert sich nichts.

### 3.2 `[js]` → Node: `bankstate` mit Reglern

```
bankstate <bankId> <video|-> <sel> <mode> <rev> <s×16> <w×16> <div> <rate> <tune> <warp> <quant> <vol> <voices> <base>
```
Die neuen Werte werden **angehängt**, die Reihenfolge davor bleibt. Gesendet wird wie heute nur bei Änderung. Jeder der zehn Handler ruft am Ende `sendBankstate()` (direkt oder über `updateSel`/`sendPadMarks`). `rate` wird auf 3 Nachkommastellen, `vol` auf 1 gerundet, damit Drehen nicht jede Mikroänderung meldet **(festgelegt)**.

Node legt daraus das SSE-Event `device` an:
```json
{"bankId": 7, "nr": 3, "video": "F2RnxZnubCM", "sel": 5, "starts": [16], "spans": [16],
 "params": {"div": 5, "rate": 1, "mode": 0, "rev": 0, "tune": 1, "warp": 0, "quant": 1, "vol": -3.5, "voices": 6, "base": 36}}
```
`mode`, `rev` und `teletext` stehen nicht mehr auf der obersten Ebene. Vor dem ersten `bankstate` ist `params` `null`.

### 3.3 Editor → Node → `[js]`: `param`

`POST /cmd {client, cmd: "param", name, value}`

| Prüfung | Fehler |
|---|---|
| `name` aus 3.1, `value` Zahl im Bereich, ganz bei `div`, `voices`, `base`; 0/1 bei Toggles | `badreq` |

Node schickt `param <name> <value>` an `[js]` und antwortet `{}`. Es schreibt nichts in die Bibliothek und meldet nichts zurück, die Bestätigung kommt über `device.params`. Auch bei kaputter Bibliothek erlaubt, wie `hit`/`up`. Gehört nicht in die Menge `WRITE` des Editors.

`[js]`:
```
var PARAM_VAR = { div: "Division", rate: "Rate", mode: "Mode", rev: "Reverse", tune: "Tune", warp: "Warp",
                  quant: "Quantize", vol: "Volume", voices: "Voices", base: "Base Note" };
function param(name, v) { if (!ready() || !PARAM_VAR[name]) return; setNamed(PARAM_VAR[name], v); }
```
`setNamed` schickt den Wert an das `live.*`-Objekt. Das gibt ihn aus, er läuft durch `prepend` in den Handler und kommt per `bankstate` zum Editor. Bei `live.text` als 0/1, bei `live.menu` als Index, bei `live.dial`/`live.numbox`/`live.gain~` als Zahl. Kommt der Wert nicht an, prüft Paket 4 in Live die Variante `setNamed(var, "set", v)` plus direkten Handler-Aufruf. Nicht vorab bauen.

### 3.4 Gestrichene Nachrichten

- Node → `[js]`: `loaded`, `loadfail`, `silence`.
- `[js]` → Node: `load`, `key`, `analyze` (nie gesendet), `bpmset`.
- HTTP: `/events`, `/key`, `/state`, `/index.html` (`/` → 302 `/editor`).
- Patch → `[js]`: `threshold`, `attack`, `release`, `srcbpm`, `bpmhalf`, `bpmdouble`, `gridon`, `snapmode`.
- Neu: Patch → `[js]` `volume`. Node → `[js]` `param`. `[js]` → Node `bankload`. `/cmd param`.

`bankstate` (erweitert), `bank`, `bankname`, `bankgone`, `bankfail`, `libstate`, `bankpeek`, `bpm`, `padhit`/`padup`, `tuning`, `tempo`, `analysisready`, `padinfo`, `beats*`, Session-Nachrichten und `status` bleiben.

## 4. Device: Verhalten

### 4.1 Oberfläche

Presentation-Modus, `devicewidth` 1024, Höhe wie heute (≈ 160). Linker Block (5–165), Pads (170–374), Waveform mit Overlay und `selinfo` (378–968) und Volume (972) bleiben, wo sie sind. Die Zeile unter der Waveform (y 90–158) wird neu aufgeteilt **(festgelegt, Richtwerte; Paket 4 darf um wenige Pixel schieben)**:

| Element | Rechteck (x, y, b, h) |
|---|---|
| Kommentar „Slice“ + `Division` | 378, 90, 60, 16 · 378, 106, 60, 18 |
| `Rate` (live.dial) | 444, 92, 44, 48 |
| `Mode` · `Rev` | 496, 92, 70, 30 · 496, 128, 70, 30 |
| `Tune` · `Warp` | 572, 92, 70, 30 · 572, 128, 70, 30 |
| `Quant` | 648, 92, 70, 30 |
| Einrichten: Kommentar „Base Note“ + `Base Note` | 880, 90, 84, 14 · 880, 104, 84, 18 |
| Einrichten: Kommentar „Voices“ + `Voices` | 880, 124, 84, 14 · 880, 138, 84, 18 |

Die großen Schalter haben eine größere Schrift (12 statt Standard), damit man sie auf der Bühne trifft. Die Lücke 720–876 bleibt frei. Die Kommentare `Slice`, `Base Note` und `Voices` gibt es schon (obj-127, obj-130, obj-133) und werden nur verschoben.

### 4.2 Tonal, Attack, Release

`TONAL = 0.5` ersetzt `P.thresh` in `computeShift`. `ATK_MS = 2` und `REL_MS = 20` ersetzen `P.atk` und `P.rel` in `trigger` und `noteoff` (Hold-Loslassen blendet in `REL_MS` aus, Hold am Snippet-Ende weiter `SNIP_FADE_MS`).

### 4.3 Beats, Overlay, Warp

- `tempoTrusted()` = `st.srcBpm > 0` (mit Bank war das schon so).
- `beatsOK()` = Beats da (≥ 4) und `tempoTrusted()`. Ersetzt `gridOK()` überall.
- **Overlay:** `sendGridUI()` schickt `beats`/`bars` und `grid show 1`, wenn `beatsOK()`, sonst `grid show 0`. Es gibt keinen Schalter mehr. `ytgrid.js` bleibt unverändert.
- **Warp:** In `playRange` gilt der Raster-Zweig (Slice endet auf dem Raster der Quelle) bei `R > 0 && !P.mode && beatsOK()`. Ohne Beats gilt das feste Verhältnis `P.bpm / srcBpm`. Hold und Hold rückwärts wie 2.0.
- **`selinfo`:** Taktposition `T<takt>.<schlag>`, wenn `beatsOK()`. Ohne Beats nichts. Warp-Teil wie heute (`W×…`, „W: kein Tempo“). Der Hinweis „W? Tempo bestätigen“ entfällt, weil mit Bank jedes erkannte Tempo gilt. „Tempo korrigieren im Editor“ steht im README.

### 4.4 Quelltempo

Kommt nur noch aus `bank` (bestätigtes `bpm`), `tempo` (Analyse, wenn nicht bestätigt) und `bpm <video> <bpm>` (Korrektur im Editor). `requestBeats()` wie heute. Das Device schickt kein Tempo mehr an Node.

### 4.5 Ohne Bank, Set öffnen, Session

**Session-Datei** (`D/sessions/<nr>.json`): Format `version: 2` bleibt. `state` = `encodeURIComponent(JSON.stringify({bankId: n}))`. `[js]` liest aus alten Dateien nur `bankId`, alles andere wird ignoriert. `.v1.json`-Kopie, Sperre, `newsession`, `stateReady` und 400 ms Entprellen bleiben (Spec 2.0, 2.7).

**Ziel ohne Bank** = Wert des Reglers `Bank`: `P_.getnamed("bank").getvalueof()`, ganz, 1–128. Fehlt das Objekt (Tests ohne Attrappe), dann 1.

| Lage | `[js]` tut |
|---|---|
| `state` mit `bankId > 0` | `bankopen <bankId>` wie 2.0 |
| `state` mit `bankId 0`/ohne, oder `statenone` | `bankload <Ziel>` (siehe unten) |
| `bankgone <id>` | `bankId = 0`, kurz „Bank gelöscht“, dann `bankload <Ziel>`. Das Ziel ist die Position, auf der `Bank` steht. Live hat sie aus dem Set wiederhergestellt, also der alte Platz |
| `bankfail` ohne klingende Bank | stumm (`muted`), Anzeige `-` + „nicht ladbar“, Status „Bank im Editor prüfen“ |
| `libstate leer/kaputt/neuer` | stumm wie 2.0, **ohne** die Ausnahme „keine Bank spielt weiter“ |
| `libstate ok` nach stumm | wie 2.0: `bankopen <bankId>`, und wenn `bankId 0`: `bankload <Ziel>` |

**Node `bankload <nr>`** (neu, `[js]` → Node, festgelegt): wie `banksel`, aber mit Klammer auf die letzte Bank (`nr = min(nr, Anzahl)`). `banksel` selbst bleibt ohne Klammer, damit beim Drehen über die letzte Bank weiter nichts lädt (Spec 2.0, 4.1). Bei leerer oder kaputter Bibliothek tut `bankload` nichts, die Anzeige regelt dann `libstate`. Ohne Snippets und ohne Track: `bankfail` wie bei `banksel`.

Reihenfolge beim Öffnen wie 2.0: Node schickt `libstate` vor `state`. `[js]` darf `bankload` erst nach `state`/`statenone` schicken, und nur wenn `libstate ok` vorliegt. Sonst wartet es auf `libstate ok` (Zeile oben).

**Anzeige** (ersetzt die Zeile „keine Bank“ in Spec 2.0, 4.5): Wenn nichts geladen ist und nichts lädt: `-` + leer, Status wie die Lage. Während `bankopen`/`bankload` läuft: Status „Lade letzten Stand …“ wie heute.

### 4.6 Stumm

„Stumm“ gilt jetzt immer bei `leer`/`kaputt`/`neuer` und wenn nichts geladen ist. Die Ausnahme für Teletext und 1.x-Sets entfällt. Pad-Anschläge tun ohne geladenen Buffer nichts (`durMs <= 0`).

## 5. Editor

### 5.1 Device-Regler

Eine Reglerleiste **in der Pad-Karte, zwischen Kartenkopf und Pads** (festgelegt). Links die Bühne, rechts gedämpft die Einrichtung:

| Regler | Bedienelement | `name` |
|---|---|---|
| Slice | `<select>` mit den 11 Notenwerten (`1/64` … `2 Bars`, gleiche Liste wie `DIVS`) | `div` |
| Rate | Schieber 0,25–2 plus Zahl, Doppelklick = 1 | `rate` |
| Trigger/Hold | Umschalter, Beschriftung „Trigger“ bzw. „Hold“ | `mode` |
| Rev, Tune, Warp, Quant | Umschalter, an = Akzentfarbe | `rev`, `tune`, `warp`, `quant` |
| Base Note | Zahlfeld 0–127 mit Notenname (36 = C1) | `base` |
| Voices | `<select>` Mono, 2, 3, 4, 5, 8, 16 | `voices` |
| Volume | Schieber −70–6 dB plus Zahl, Doppelklick = 0 dB | `vol` |

- **Anzeige** folgt immer `device.params`. Während ein Schieber gezogen wird, zeigt er den lokalen Wert und übernimmt `params` erst nach dem Loslassen.
- **Senden:** Umschalter und Menüs sofort. Schieber beim Ziehen höchstens alle 50 ms (letzter Wert gewinnt) und beim Loslassen. Kein Eintrag in der Undo-Historie, kein „gespeichert ✓“.
- **Gesperrt** (ausgegraut): kein Device (SSE getrennt) oder `params` ist `null`. Nicht gesperrt bei leerer oder kaputter Bibliothek.
- **Spannen:** Die Fläche hinter dem gewählten Marker (`device.spans`) zeigt die Wirkung von Slice, Rate und Warp sofort, das gibt es schon.
- Tastatur: keine neuen Kürzel. Die Pad-Tasten bleiben.

### 5.2 Sonst

Tempo (Zahlenfeld, ½×, 2×, „Tempo stimmt“) bleibt in der Detailspalte, wie es ist. Die Ansicht „keine Bank“ fällt weg (2.5). `S.dev.mode`/`rev` werden, falls irgendwo gelesen, zu `S.dev.params.mode`/`rev`.

## 6. Prüfen

**In der Session** (Testskripte `tools/tests/`):
- `node --check`, ES5-grep, `check()` auf alle `.maxpat`, Sync `.maxpat`/`.amxd`.
- `test_wiring.js`: Router und Selektoren ohne die gestrichenen Nachrichten. `param`, `volume` und `bankload` haben Ziele. Die 14 Parameter aus 2.4 sind da, die 8 weggefallenen nicht. `live.gain~` Ausgang 3 → `prepend volume` → `[js]`.
- `test_main.js`: Kanal 15/16 spielt Pads. Ohne `Grid`: Warp folgt dem Raster bei Beats, festes Verhältnis ohne. Overlay `show` nach `beatsOK`. `bankstate` mit den 10 angehängten Werten, nur bei Änderung. `param` → `setNamed` mit richtigem varname, vor `ready()` nichts. Session schreibt nur `{bankId}`, liest alte Dateien. `statenone`/`bankId 0`/`bankgone` → `bankload <Regler>`, aber erst nach `libstate ok`. `bankfail` ohne Bank → stumm. Feste Attack/Release in `env`/`rel`.
- `test_http.js`: `GET /` → 302, `/events`, `/key`, `/state` → 404. `device` mit `params`, ohne `teletext`/`mode`/`rev` oben. `/cmd param`: gültig → `param` an `[js]`, ungültig → `badreq`, auch bei kaputter Bibliothek erlaubt. `bankload` klammert auf die letzte Bank, leer → nichts.
- `test_download.js`: Teletext-Weg raus, Editor-Weg unverändert. `test_analysis.js`: Reihenfolge ohne `silence`.
- `test_editor.js` gegen `editor_mock.js` (mit `params` und `/cmd param`): Leiste zeigt `params`, Bedienung schickt `param`, Schieber gedrosselt, gesperrt ohne Device, „keine Bank“-Test raus. Screenshots mit Leiste (`--shots`).
- `test_e2e.js`: ein `param` vom Editor kommt als `setNamed` im echten `[js]` an (Attrappe des Patchers zeichnet auf).

**Prüft der Nutzer in Live** (nach `deploy.sh`):
- Device lädt ohne Fehler im Max-Fenster. Die neue Zeile unter der Waveform ist lesbar, die Schalter sind groß genug.
- Ein altes Set aus 2.x öffnen: Bank kommt, MIDI-Mappings auf die 14 bleibenden Parameter gehen noch. Ein 2.x-Set mit Teletext-Stand und ein neues Device laden die Bank am Regler.
- Editor-Regler in beide Richtungen, auch per MIDI gedreht. Prüfen: Entsteht ein Eintrag in Lives Undo? Was passiert mit Automation auf einem Parameter (überschrieben, „Re-Enable Automation“)? Volume aus dem Editor.
- Warp ohne Grid-Schalter: folgt dem Raster, klingt wie Warp+Grid in 2.0. Linien im Overlay ohne Schalter.
- Alle MIDI-Kanäle spielen.

## 7. Bau-Pakete

Regeln: Jedes Paket in einer eigenen Worktree-Session, normaler `git commit` auf dem eigenen Zweig, kein Release/Deploy/Push. Gemergt und released wird nur in der Master-Session. **`YT Sampler.maxpat`/`.amxd` fasst nur Paket 4 an.** Jedes Paket arbeitet gegen diese Spec, nicht gegen den Code der anderen Pakete.

Empfehlung an die Master-Session: Pakete 1–4 parallel starten und auf einen gemeinsamen Zweig `v3` mergen, ohne Release (jedes allein bricht das laufende 2.x-Device). Paket 5 auf `v3` integriert. Dann `deploy.sh`, der Nutzer testet, dann `release.sh 3.0.0`.

| # | Paket | Dateien | parallel? |
|---|---|---|---|
| 1 | Node | `ytsampler_node.js`, `tools/tests/test_http.js`, `test_download.js`, `test_analysis.js` (+ ggf. `harness.js`) | ja, mit 2, 3, 4 |
| 2 | `[js]` | `ytsampler_main.js`, `tools/tests/test_main.js` | ja, mit 1, 3, 4 |
| 3 | Editor | `editor.html`, `tools/tests/editor_mock.js`, `tools/tests/test_editor.js` | ja, mit 1, 2, 4 |
| 4 | Patch | `YT Sampler.maxpat`, `YT Sampler.amxd` | ja, mit 1, 2, 3 |
| 5 | Integration, Doku → 3.0.0 | `tools/tests/test_wiring.js`, `tools/tests/test_e2e.js`, `tools/deploy.sh`, `README.md`, `CLAUDE.md`, Löschen `teletext.html`, `Teletext öffnen.command`, `ir_teletext/`, Archiv-Tag eintragen; kleine Korrekturen in allen Dateien | allein, nach 1–4 |

### Paket 1: Node
- **Ziel**: 2.2, 3.2 (Node-Seite: `bankstate` mit angehängten Werten → `device.params`), 3.3 (`/cmd param` → `param`), 3.4, 4.5 (`bankload`), `GET /` → 302.
- **Abnahme**: `node --check`. Tests aus 6 für `test_http`, `test_download`, `test_analysis`. Alle übrigen Node-Tests grün (`test_library`, `test_migration`, `test_snippets`).

### Paket 2: `[js]`
- **Ziel**: 2.3, 3.1, 3.2 (`[js]`-Seite), 3.3 (`param`), 4.2–4.6. Neue Funktionen: `volume`, `param`. Neue Nachricht: `bankload`.
- **Abnahme**: ES5-grep, `node --check`, `test_main.js` mit den Fällen aus 6. `test_ytgrid.js` bleibt grün.

### Paket 3: Editor
- **Ziel**: 2.5, 5. Die Attrappe kennt `device.params` und `/cmd param` (zeichnet auf, schickt `device` mit dem neuen Wert zurück).
- **Abnahme**: `test_editor.js` mit den Fällen aus 6, Screenshots normal, kein Device, Bibliothek leer. Der Nutzer schaut einmal gegen die Attrappe drauf.

### Paket 4: Patch
- **Ziel**: 2.4 und 4.1. Boxen entfernen, `live.gain~` Ausgang 3 → `prepend volume` → `[js]` (neue IDs ab obj-196), Layout nach 4.1, größere Schrift der fünf Schalter. Patch per JSON wie in `CLAUDE.md` („Patch und `.amxd` bearbeiten“).
- **Abnahme**: `check()` ohne ungültige Verbindungen, Sync `.maxpat`/`.amxd`. Liste der Parameter wie 2.4 (kleines Python-Skript). `test_wiring.js` wird erst in Paket 5 angepasst und darf hier rot sein.

### Paket 5: Integration, Doku → 3.0.0
- **Ziel**: Zweige 1–4 zusammen, `test_wiring.js` und `test_e2e.js` nach 6, alle Tests grün. 2.1 (löschen, Archiv-Tag), 2.6 (`deploy.sh`, README, CLAUDE.md). Kleine Lücken zwischen den Paketen schließen.
- **Abnahme**: `for f in tools/tests/test_*.js; do node "$f" || echo FEHLER $f; done` ohne FEHLER. Dann `deploy.sh`, der Nutzer prüft die Liste „Prüft der Nutzer in Live“ aus 6. Danach `release.sh 3.0.0`.

## 8. Entschiedene Fragen

| # | Frage | Antwort (Nutzer, 2026-10-29) |
|---|---|---|
| F1 | Tonal, Attack, Release | ganz weg, 0,5 / 2 ms / 20 ms |
| F2 | Regler im Editor | alle außer Bankwahl, auch Volume, Voices, Base Note |
| F3 | Device ohne Bank | lädt die Bank am Regler `Bank` |
| F4 | MIDI-Kanäle 15/16 | alle Kanäle spielen Pads |
| F5 | Breite | 1024, größere Bühnenschalter |

Außerdem festgelegt (Planung): `/` → 302 `/editor`; Session bleibt `version: 2` mit nur `bankId`; `bankload` statt geänderter `banksel`; Reglerwerte angehängt an `bankstate`; `param` über `setNamed`; Reglerleiste in der Pad-Karte; Layout-Richtwerte 4.1.
