# Spezifikation: Mix-Bänke

Stand 2026-11-02. Grundlage: Spec 2.0 (`.scratch/bank-editor/spec.md`), Spec 3.0 (`.scratch/device-3/spec.md`), gültiger Stand in `CLAUDE.md`. **Was hier nicht geändert wird, gilt dort weiter.** **(festgelegt)** = von der Planung aus dem Code entschieden. **(Mx)** = vom Nutzer entschieden (Abschnitt 9).

Leitlinie: Bühnenwerkzeug, einfach halten. Was hier nicht steht, wird nicht gebaut. Version: **4.0.0** (Format der Bibliothek ändert sich, 3.x-Devices sperren sich aus, siehe 2.1).

## 1. Überblick

Feste Entscheidungen des Nutzers:
1. **Ein Bank-Typ.** Das Video hängt am Pad, nicht an der Bank. Eine Track-Bank hat 16 Pads aus einem Video, eine Mix-Bank Pads aus mehreren Videos (oder leere Plätze). Das Device spielt beide gleich.
2. **Kopie.** Ein Pad aus Bank A wird in die Mix-Bank kopiert (Video + Start). Spätere Änderungen an A wirken nicht auf die Mix-Bank.
3. **Quellleiste** unter den Pads: Bank wählen, ihre 16 Pads erscheinen, man zieht sie auf Plätze.
4. **Start verschieben** geht auch in Mix-Bänken. Die Waveform zeigt den ganzen Track des gewählten Pads. Eingerastet wird auf die Schläge dieses Videos. Ohne Track ist das Pad „nur spielbar“.
5. **Tempo, Tune, Raster und Analyse pro Pad** bzw. pro Video. Jedes Pad warpt aus dem Tempo seines Videos.
6. **Bibliothek:** eine Liste, Mix-Bänke mit dem Zeichen „Mix“.

Kern der Umsetzung **(festgelegt)**: `[js]` hält Tempo, Stimmung und Schläge ab jetzt **pro Pad**, auch bei einer Track-Bank. Node schickt sie pro Pad fertig zu, `[js]` fragt nicht mehr nach (`analyzeall`, `beattrack`, `tempo`, `tuning`, `beats*` fallen weg). Bei einer Track-Bank bekommen alle 16 Pads dieselben Werte und das Device klingt wie in 3.0.

| | 3.0 | Mix |
|---|---|---|
| Bank | `video` + `starts[16]` | `pads[16]` = `{video, start}` oder `null` |
| `library.json` | `format 1` | `format 2`, liest `1` und wandelt beim Lesen um |
| Snippet-`.json` | `video`, `starts` | `pads`, alte Dateien bleiben gültig |
| Analyse im Node | eine (`analysis`) | eine pro Video |
| Tempo/Tune/Raster in `[js]` | global | pro Pad |
| Waveform im Editor | Track der Bank | Track des gewählten Pads |

## 2. Datenablage

### 2.1 `library.json` (format 2)

```json
{
 "format": 2, "rev": 58, "nextId": 14,
 "banks": [
  {"id": 7, "name": "Funk",
   "pads": [{"video": "F2RnxZnubCM", "start": 42962}, {"video": "F2RnxZnubCM", "start": 46333}, …]},
  {"id": 13, "name": "Neue Mix-Bank",
   "pads": [{"video": "F2RnxZnubCM", "start": 11435}, {"video": "dQw4w9WgXcQ", "start": 8000}, null, …]}
 ],
 "videos": {"F2RnxZnubCM": {"title": "…", "bpm": 99.5}, "dQw4w9WgXcQ": {"title": "…"}}
}
```

| Feld | Regel |
|---|---|
| `format` | `2` |
| `banks[].pads` | genau 16 Einträge, jeder `null` (leerer Platz) oder `{video, start}`. `video` muss in `videos` stehen, `start` ist eine ganze Zahl ≥ 0 in Song-ms seines Videos. Unbekannte Felder im Pad bleiben erhalten. |
| `banks[].video`, `banks[].starts` | gibt es in format 2 nicht mehr. Wer sie liest, findet sie nicht |
| `videos` | wie 2.0. Ein Eintrag lebt, solange **ein Pad** ihn benutzt (`dropOrphans` über alle Pads) |

**Lesen:**
- `format 1`: gültig nach den alten Regeln (Spec 2.0, 2.2), wird im Speicher zu format 2 umgewandelt: `pads[i] = {video: b.video, start: b.starts[i]}`, `video`/`starts` fallen weg, übrige Felder der Bank bleiben. Kein eigener Schreibvorgang: Die Datei wird beim nächsten `libChange` als format 2 geschrieben **(festgelegt)**. Die Sicherung beim Start (2.6) hält die letzte Datei im format 1 fest.
- `format 2`: neue Prüfregeln (Tabelle oben). Eine Bank mit 16 × `null` ist gültig.
- `format > 2`: „neuer“ wie bisher.

**Abwärts:** Ein 3.x-Device liest format 2 als „neuer“, fasst nichts an und bleibt stumm. Das ist so gewollt, denn sonst würde es Mix-Snippets aus `banks[].video` neu schneiden und in iCloud überschreiben. Folge: Beide Macs müssen gleichzeitig auf 4.0 **(M6)**. README und Release-Hinweis sagen das.

**Sessions** bleiben gültig, `state` ist weiter nur `{bankId}`.

**Begriffe (abgeleitet, nicht gespeichert):** Eine Bank heißt **Track-Bank**, wenn alle 16 Pads belegt sind und dasselbe Video haben, sonst **Mix-Bank** **(festgelegt)**.

### 2.2 Snippet-Dateien

- WAV unverändert: 16 Fächer à 16 s.
- `.json` neu: `{"pads": [{video, start} | null ×16], "lens": [16], "durs": {"<video>": <ms>}}`. Bei einem leeren Platz ist `lens[i] = 0` und das Fach still. `durs` enthält die Songdauer pro Video (für den Editor ohne WAV).
- **Alte `.json`** (`{video, starts, lens, dur}`) gilt als `pads[i] = {video, start: starts[i]}`, `durs = {video: dur}`. Sie bleibt also aktuell und wird nicht neu geschnitten, auch nicht auf der Bühne ohne Cache.
- **Aktuell** = die Pads der `.json` sind gleich den Pads der Bank (Video und Start je Platz, `null` = `null`).
- **Schneiden, Quelle pro Fach** **(festgelegt)**, in dieser Reihenfolge:
  1. ganze WAV des Videos in `L/cache/`,
  2. ein Fach mit gleichem `{video, start}` in der alten Snippet-Datei derselben Bank,
  3. ein Fach mit gleichem `{video, start}` in der aktuellen Snippet-Datei einer anderen Bank der Bibliothek (so geht Reinziehen auch ohne Cache, das gezogene Pad stammt ja aus einer Bank).
  4. Leerer Platz: Stille.
  Findet sich für ein belegtes Pad keine Quelle, gibt es `playonly` (Schneiden geht nicht, die alte Datei spielt weiter).
- `.chroma`: Beim Schneiden wird pro Video mit ganzer WAV die Analyse nach `D/snippets/<video>.chroma` gelegt, wenn sie dort fehlt (wie heute, nur pro Video statt einmal).

### 2.3 Analyse pro Video

`D/snippets/<video>.chroma` gibt es schon pro Video. Node hält beim Laden einer Bank eine Analyse pro Video, das in der Bank vorkommt (`Map video → Analyse`, ersetzt die globale `analysis`). Fehlt sie für ein Video: Das Video hat keine Stimmung, kein Analyse-Tempo und keine Schläge. Warp geht weiter mit bestätigtem `bpm`. Status siehe 4.4.

`AN.VERSION` bleibt gleich, am Analyseformat ändert sich nichts.

## 3. Node (`ytsampler_node.js`)

### 3.1 Vorgänge (`LIB`) und Befehle (`/cmd`)

| `cmd` | neu/geändert | Regel |
|---|---|---|
| `newmix` | **neu** | Bank am Ende, Name „Mix-Bank“, 16 × `null`, wird aktiv. Antwort `{id}`. Undo = `delete`, Redo = `restore` (wie Neue Bank) **(M1)** |
| `setpad` | **neu** | `{id, pad, video, start}` kopiert ein Pad auf einen Platz. `video: null` leert den Platz (Icon „leeren“ und Undo, **M5**). Das Fach wird beim Schneiden still, `lens 0`. Steht `video` nicht in `videos`, braucht es `info: {title, bpm?}` (Undo nach Löschen der Quellbank), sonst `badreq`. Schneiden nach 2.2. Keine Quelle → `playonly`, nichts geändert. Antwort `{}` |
| `setstart`, `roll` | geändert | wirken auf `pads[pad]`. Leerer Platz → `badreq`. `playonly`, wenn die WAV **dieses** Pads fehlt. `roll` würfelt im Video des Pads, belegt sind die Starts der Pads mit demselben Video **(M3)** |
| `setstarts` | geändert | `starts[16]`: setzt die Starts der belegten Pads, bei leeren wird der Wert ignoriert. Videos bleiben. Ohne WAV nur, wenn jedes neue `{video, start}` in einer Quelle nach 2.2 vorkommt |
| `swap` | geändert | tauscht ganze Pad-Einträge (auch `null`) |
| `select` | geändert | lädt fehlende WAVs **aller** Videos der Bank in den Cache, über die Warteschlange (siehe 7, Paket N) mit Vorrang für das Video des gewählten Pads |
| `newbank` | geändert | legt `pads` aus einem Video an |
| `restore` | geändert | `bank` mit `pads`. `video` (eins) wird zu `videos: {<id>: {title, bpm?}}` für alle fehlenden Videos der Bank |
| `delete` | geändert | `removed.videos` statt `removed.video`: die `videos`-Einträge aller Pads |
| `duplicate`, `rename`, `move`, `tempo`, `tempook`, `fetch`, `fetchall`, `hit`, `up`, `param`, `search` | gleich | `fetchall` sammelt die Videos über alle Pads |

### 3.2 SSE

| Event | Änderung |
|---|---|
| `lib` | `banks[]` = `{id, name, pads, mix, snip, wav}`. `mix` nach 2.1. `wav` = alle Videos der Bank liegen im Cache. `videos.<id>` bekommt `wav` (liegt im Cache) und `dur` (aus Cache oder einer Snippet-`.json`, sonst fehlt das Feld) |
| `device` | `video` = Video des gewählten Pads (`dev.sel`), `-` bei einem leeren Platz. Node leitet es aus der Bank ab, `[js]` schickt es nicht mehr |
| `beats` | für `device.video` (Video des gewählten Pads), wie heute pro Video. Wechselt mit dem gewählten Pad |
| `play` | bekommt `video` dazu (Abspielkopf nur auf der passenden Waveform) |

### 3.3 Bank ins Device

`sendBank(b)`:
1. `bankname` wie heute.
2. `bank <id> <nr> <s×16> <l×16> <pfad…>`. Die Starts sind Song-ms des eigenen Videos, bei einem leeren Platz `0` mit `l = 0`. Weggefallen: `bpm`, `songdur`, `video`.
3. Analyse (asynchron, `setImmediate` danach wie heute): pro belegtem Pad
   `padana <i> <bpm> <cent> <off> <beats…>`. Dann `padinfo <i> …` wie heute (Fenster `ANALYSIS_MS` 4000 ab Start, jetzt Konstante in Node). Zum Schluss `analysisready`.
   - `bpm`: bestätigtes `videos[v].bpm`, sonst das Analyse-Tempo, sonst `0`.
   - `cent`: Stimmung des Videos (`round(tuning × 100)`), ohne Analyse `0`.
   - `beats`: Schläge des Videos (`trackBeats` mit `bpm`, gemerkt in `beatStore`) im Bereich `[start − 4 Schläge, start + l + 4 Schläge]`, Song-ms. Ohne Schläge leer.
   - `off`: Position des ersten gesendeten Schlags in Schlägen ab der ersten „1“ (= globaler Index − `down`). Takt-Einsen sind die Schläge mit `(off + j) mod 4 = 0`.
   - Eine Nachricht pro Pad. Bei 300 BPM sind das höchstens ≈ 90 Schläge, also unter 200 Atomen **(festgelegt)**.
4. Tempo-Korrektur im Editor (`tempo`/`tempook`): Node schickt `padana` für alle Pads der aktiven Bank mit diesem Video noch einmal. Das ersetzt `bpm <video> <bpm>` an `[js]`.

Weggefallen (Handler bzw. Nachrichten): `beattrack`, `analyzeall`, `tuning`, `tempo`, `beatsclear`, `beatsadd`, `beatsdone`, `bpm` mit zwei Argumenten. `analyzeWindow`/`sendPadInfo` bekommen die Analyse als Argument.

`bankstate` von `[js]`: Das Feld `<video>` entfällt:
```
bankstate <bankId> <sel> <mode> <rev> <s×16> <w×16> <div> <rate> <tune> <warp> <quant> <vol> <voices> <base> <qdiv> <qcatch>
```

**Status** nach dem Laden: Track-Bank wie heute („Bereit: <Name> · 99.5 BPM · Stimmung +12 ct“). Mix-Bank: „Bereit: <Name> · Mix aus <n> Tracks“. Fehlt bei einem Video die Analyse: „Analyse fehlt bei <k> Pads – im Editor neu schneiden“.

## 4. Device (`ytsampler_main.js`, ES5)

### 4.1 Zustand pro Pad

```
var PA = [];   // pro Pad: { bpm, cent, off, beats[] }, null = keine Analyse
```
Ersetzt `srcBpm`, `srcAuto`, `tuningCents`, `beats`, `beatsIn`, `beatsDown`, `beatsReady`, `videoId`. `pads[]`, `B.lens`, `keys`, `shifts` bleiben.

| alt (global) | neu (pro Pad) |
|---|---|
| `tempoTrusted()` | `tempoTrusted(i)` = `PA[i] && PA[i].bpm > 0` |
| `warpRatio()` | `warpRatio(i)` = `P.bpm / PA[i].bpm` (geklammert 0,25–4) |
| `beatsOK()` | `beatsOK(i)` = ≥ 4 Schläge und `tempoTrusted(i)` |
| `xAt(t)`, `timeAt(x)` | `xAt(i, t)`, `timeAt(i, x)` auf `PA[i].beats`, Index-Versatz `PA[i].off` statt `−beatsDown`. Außerhalb linear wie heute |
| `pitchRate(i)` mit `tuningCents` | mit `PA[i].cent` |
| `keyInfo(i)` mit `tuningCents` | mit `PA[i].cent` |

`playRange(i)`, `padSpan(i)`, `updateSel()` und `sendGridUI()` benutzen diese Funktionen mit dem Pad-Index. Die Logik bleibt gleich. `sendGridUI()`: Linien pro Fach aus `PA[i].beats` (nur in `[start, start + l)`), Takt-Einsen nach `off`, `grid show 1`, sobald ein Pad `beatsOK(i)` hat.

### 4.2 Nachrichten

- `bank <id> <nr> <s×16> <l×16> <pfad…>`: wie heute, ohne Tempo/Video/Songdauer. `durMs = NPADS × SNIP_MS` (nur noch „geladen“-Zeichen). `PA` leeren, `analysisReady = 0`.
- `padana <i> <bpm> <cent> <off> <beats…>`: `PA[i]` setzen, `shifts[i]` neu, `sendGridUI()`, `updateSel()`. Kommt auch einzeln nach einer Tempo-Korrektur.
- `padinfo`, `analysisready`, `bankbusy`, `bankname`, `bankgone`, `bankfail`, `libstate`, `bankpeek`, `padhit`/`padup`, `param`, Session-Nachrichten: unverändert. `analysisready` fordert nichts mehr an.
- `bpm <tempo>` (Lives Tempo, ein Argument) bleibt. Der Zweig mit zwei Argumenten fällt weg.
- Weg: `tempo`, `tuning`, `beatsclear`, `beatsadd`, `beatsdone`, `requestBeats`, `requestAll`, `analysisSpan`, die Ausgaben `analyzeall`/`beattrack`.

### 4.3 Leerer Platz

`l = 0` → `playRange` ergibt Dauer 0, `trigger` spielt nichts. **Fix:** `trigger` ruft `updateSel()` auch, wenn nichts klingt, damit das gewählte Pad beim Editor ankommt. `selinfo` bei leerem Platz: „Pad <n>  leer“. Pad-jsui: neue Nachricht `padempty <16 × 0/1>` aus `bank()`. Ein geleerter Platz kommt als neues `bank` (neu geschnitten) und ist danach dunkel. Ein leeres Pad zeichnet `ytpads.js` dunkel und ohne Nummer **(M2)**.

### 4.4 Anzeige

Großer Name und Nummer wie heute. Am Device gibt es kein Mix-Zeichen **(festgelegt)**. Statuszeile kommt von Node (3.3).

### 4.5 Aufwand und Risiko `[js]`

Ehrlich: **mittel**. Etwa 120 Zeilen ändern sich. Neue Logik ist kaum dabei, der größte Teil ist Umstellung von global auf pro Pad in `playRange`, `xAt`/`timeAt`, `sendGridUI`, `updateSel`, `pitchRate`, `keyInfo`. Gefährlich sind Warp mit Raster und Catch, weil sie nur in Live hörbar sind. Absicherung: ein **Golden-Test** in `test_main.js`. Eine Track-Bank in 3.0 und in 4.0 bekommt dieselben Anschläge und Reglerwechsel (Warp an/aus, Hold, Rev, Quant+Catch, Division), die Ausgänge 0, 2 und 3 (`pos`, `wplay`, `rel`, `grid`, `selinfo`) müssen gleich sein. Die 3.0-Aufnahme wird vor dem Umbau einmal als JSON in `tools/tests/` abgelegt.

## 5. Editor (`editor.html`)

### 5.1 Bibliothek

- Zeile: Name, darunter klein bei Track-Bänken wie heute „Titel · BPM“, bei Mix-Bänken das Zeichen **Mix** vor dem Namen und darunter „<n> Tracks“.
- „nur spielbar“, wenn ein Video der Bank nicht im Cache liegt (`bank.wav false`). Lädt ein Video der Bank: „lädt n %“ (Fortschrittszeilen aus der Session downloads übernehmen).
- Knopf **„Neue Mix-Bank“** im Listenfuß neben „Alle nachladen“ → `newmix`, Schritt in der Historie **(M1)**.

### 5.2 Waveform

- Zeigt immer den Track des **gewählten Pads** (`device.video`, `/peaks/<video>`). Marker gibt es für alle Pads der Bank mit **diesem** Video. Bei einer Track-Bank sind das alle 16, wie heute.
- Gewähltes Pad ohne WAV: Fläche „Track fehlt“ + „Track laden“ (`fetch` mit diesem Video). Marker ziehen und Würfeln sind für dieses Pad gesperrt.
- Leerer Platz gewählt: Fläche „Leerer Platz – Pad aus der Quellleiste hierher ziehen“.
- Einrasten auf `beats` (kommt für `device.video`). Abspielkopf nur, wenn `play.video` zur Waveform passt.
- Zoom und Scroll merkt sich die Waveform nicht pro Video. Wechselt das Video, scrollt sie zum Marker des gewählten Pads.

### 5.3 Pads

- Jedes Pad zeigt Nummer und Startzeit. Der Mini-Balken zeigt die Lage im **eigenen** Track (`videos[v].dur`, ohne Dauer kein Balken). In Mix-Bänken zeigt jedes Pad zusätzlich klein die ersten Zeichen des Videotitels, Tooltip mit dem ganzen Titel.
- Leerer Platz: gestrichelt, „leer“, nimmt Ablagen an, Würfel aus.
- Belegtes Pad: Icon **„leeren“** bei Hover und am gewählten Pad, neben dem Würfel → `setpad {id, pad, video: null}`. Schritt in der Historie „Pad <n> geleert“, Undo = `setpad` mit dem alten Eintrag plus `info`, Redo = `setpad` mit `null`. Geht auch ohne WAV (Stille braucht keine Quelle) **(M5)**.
- Detailspalte: Video · BPM und Tempo-Knöpfe für das Video des gewählten Pads (`tempo` mit diesem Video). Leerer Platz: nur „leer“.
- Pad auf Pad ziehen tauscht wie heute (`swap`), auch mit leeren Plätzen.

### 5.4 Quellleiste

- Unter dem Pad-Raster, einklappbar (Zustand im `localStorage`, wie die Größen). Bei jeder Bank sichtbar **(M1)**.
- Oben ein `<select>` mit allen Bänken außer der aktiven (Nummer + Name, Mix-Bänke mit „Mix“). Der Editor merkt sich pro Browser die zuletzt gewählte Quelle.
- Darunter die 16 Pads der Quellbank als kleine Kacheln in einer Reihe (Pad 1 links): Nummer, Startzeit, Titel als Tooltip. Leere Plätze der Quelle sind ausgegraut und nicht ziehbar.
- Kachel auf einen Platz ziehen → `setpad {id, pad, video, start}`. Ein belegter Platz wird ersetzt. Schritt in der Historie „Pad <n> aus <Quellbank>“. Undo = `setpad` mit dem alten Eintrag (bzw. `video: null`) plus `info` des alten Videos, Redo = `setpad` neu.
- Vorhören gibt es nicht: reinziehen, anspielen, ⌘Z **(M4)**.
- Gesperrt wie alles Schreibende (kaputte Bibliothek, kein Device).

### 5.5 Undo

| Schritt | Undo | Redo |
|---|---|---|
| Pad aus Quelle | `setpad` alt (+ `info`) | `setpad` neu |
| Pad leeren | `setpad` alt (+ `info`) | `setpad` mit `null` |
| Neue Mix-Bank | `delete` | `restore` |
| Start setzen, Neues Snippet | `setstarts` alt (wie heute) | `setstarts` neu |
| Rest | wie Spec 2.0, 5.3 | |

## 6. Prüfen

**In der Session:**
- `node --check`, ES5-grep, `check()` (Patch unverändert), Sync.
- `test_library.js`: format 1 → im Speicher format 2, beim nächsten Schreiben format 2 auf der Platte. format 2 gültig/kaputt (Pad mit fremdem Video, 15 Pads, `start` negativ), 16 × `null` gültig, format 3 = neuer, `dropOrphans` über Pads, unbekannte Pad-Felder bleiben.
- `test_snippets.js`: alte `.json` gilt als aktuell (kein Neuschnitt). Mix aus zwei WAVs. Quelle aus einer anderen Bank ohne WAV. Leerer Platz still, `lens 0`. Keine Quelle → `playonly`.
- `test_analysis.js`: `padana` pro Pad mit richtigem `bpm`/`cent`/`off` für zwei Videos (synthetische WAVs mit bekanntem Tempo), Fenster ± 4 Schläge, Tempo-Korrektur schickt nur die Pads dieses Videos.
- `test_http.js`: `newmix`, `setpad` (mit und ohne `info`, `null`), `roll`/`setstart` auf leerem Platz → `badreq`, `device.video` folgt `sel`, `beats` wechselt mit dem Pad, `delete`/`restore` mit mehreren Videos.
- `test_main.js`: Golden-Test Track-Bank (4.5). Mix: Warp-Faktor pro Pad (zwei Tempi), Tune mit `cent` pro Pad, Overlay-Linien pro Fach, leerer Platz spielt nichts, meldet aber `sel`. `padana` vor/nach `bank`.
- `test_wiring.js`: neue Selektoren `padana`, `padempty`. Die weggefallenen haben keine Ziele mehr.
- `test_editor.js` (`editor_mock.js` mit Mix-Bank): Mix-Zeichen, Waveform wechselt mit dem Pad, Marker nur fürs eigene Video, Quellleiste ziehen → `setpad`, Icon „leeren“ → `setpad` mit `null` (auch ohne WAV), Undo/Redo, leerer Platz, „Neue Mix-Bank“. Screenshots mit `--shots`.
- `test_e2e.js`: Mix-Bank aus zwei Videos anlegen, ins echte `[js]` laden, Anschlag auf beiden Videos mit Warp.

**Prüft der Nutzer in Live:**
- Alte Bänke spielen wie in 3.0 (Warp, Raster, Tune), ohne Neuschnitt.
- Mix-Bank aus zwei Tracks mit verschiedenem Tempo: Beide Pads laufen mit Warp im Live-Tempo, Linien pro Fach stimmen.
- Leere Plätze stumm, am Device erkennbar.
- Bühne ohne Cache: Mix-Bank aus Pads anderer Bänke legen geht.
- Zweiter Mac mit 3.x zeigt „Bibliothek aus neuerer Version“.

## 7. Bau-Pakete

Regeln wie in 3.0: jedes Paket eine eigene Worktree-Session, normaler `git commit`, kein Release/Deploy/Push. Merge und Release macht die Master-Session. **Den Patch ändert kein Paket.** `ytpads.js` ist kein Patch, aber nur Paket J fasst es an.

**Reihenfolge:** Alle Pakete setzen auf `main` **nach** dem Merge der Session downloads auf (die ändert `ytsampler_node.js` und `editor.html`). Danach laufen N, J und E parallel, die Dateien sind getrennt. Gemergt wird auf einen gemeinsamen Zweig `mix`, ohne Release (N allein bricht 3.0-Devices nicht, aber `[js]` und Node passen nur zusammen). Am Schluss I.

| # | Paket | Dateien | parallel? |
|---|---|---|---|
| N | Node | `ytsampler_node.js`, `tools/tests/test_library.js`, `test_snippets.js`, `test_analysis.js`, `test_http.js`, `test_migration.js` (falls betroffen), `harness.js`/`wav.js` bei Bedarf | ja, mit J, E |
| J | `[js]` + Pad-jsui | `ytsampler_main.js`, `ytpads.js`, `tools/tests/test_main.js`, neue Golden-Datei in `tools/tests/` | ja, mit N, E |
| E | Editor | `editor.html`, `tools/tests/editor_mock.js`, `tools/tests/test_editor.js` | ja, mit N, J |
| I | Integration, Doku → 4.0.0 | `tools/tests/test_wiring.js`, `test_e2e.js`, `README.md`, `CLAUDE.md`, kleine Korrekturen überall | allein, nach N, J, E |

### Paket N: Node
- **Ziel:** 2.1 (Lesen format 1/2, Prüfen, Schreiben format 2), 2.2 (Snippet-`.json` neu, alte lesen, Quelle pro Fach), 2.3 (Analyse pro Video), 3.1 (`newmix`, `setpad`, geänderte Befehle), 3.2 (SSE), 3.3 (`bank` neu, `padana`, Status, weggefallene Handler, `bankstate` ohne Video).
- **Abhängig:** Merge der Session downloads (Warteschlange für `select` mit mehreren Videos).
- **Abnahme:** `node --check`. Tests aus 6 für Library, Snippets, Analysis, HTTP. Alle übrigen Node-Tests grün.

### Paket J: `[js]` + Pad-jsui
- **Ziel:** 4.1–4.4. Zuerst die Golden-Aufnahme mit dem 3.0-Stand ablegen (eigener Commit), dann umbauen.
- **Abhängig:** keins (arbeitet gegen diese Spec, Nachrichten von Node per Attrappe).
- **Abnahme:** ES5-grep, `node --check`, `test_main.js` mit Golden-Test und den Mix-Fällen aus 6, `test_ytgrid.js` grün.

### Paket E: Editor
- **Ziel:** 5.1–5.5, mit Icon „leeren“ (5.3). Die Attrappe kennt format-2-`lib` (`pads`, `mix`, `videos.wav/dur`), `device.video` nach `sel`, `beats` pro Video, `newmix`, `setpad`.
- **Abhängig:** Merge der Session downloads (Fortschrittszeilen in der Bibliothek).
- **Abnahme:** `test_editor.js` mit den Fällen aus 6, Screenshots Track-Bank, Mix-Bank, leerer Platz, Quellleiste. Der Nutzer schaut einmal gegen die Attrappe drauf.

### Paket I: Integration → 4.0.0
- **Ziel:** N, J, E auf `mix` zusammen. `test_wiring.js` (Selektoren), `test_e2e.js` (Mix-Bank Ende zu Ende). README: Mix-Bänke, Quellleiste, Hinweis „beide Macs auf 4.0“. `CLAUDE.md`: Ablage (format 2, Snippet-`.json`), Protokolle (`bank`, `padana`, `padempty`, `bankstate`, `setpad`, `newmix`), Fallen (pro Pad), Spec-Verweis. Gestrichene Nachrichten raus.
- **Abnahme:** alle `tools/tests/test_*.js` ohne FEHLER. Dann `deploy.sh`, der Nutzer prüft die Liste aus 6. Danach `release.sh 4.0.0`.

## 8. Außerhalb

Pads vorhören in der Quellleiste, Mix-Zeichen am Device, Pads aus Suchtreffern direkt in eine Mix-Bank (geht über eine neue Track-Bank als Quelle), Länge pro Pad, Verknüpfung statt Kopie, Export.

## 9. Entschiedene Fragen

| # | Frage | Antwort (Nutzer, 2026-11-02) | verworfen |
|---|---|---|---|
| M1 | Wie entsteht eine Mix-Bank? | Knopf „Neue Mix-Bank“ (16 leere Plätze), Quellleiste bei jeder Bank | Quellleiste nur bei Mix-Bänken · kein Knopf, duplizieren + reinziehen |
| M2 | Leere Plätze am Device | stumm, Pad dunkel ohne Nummer | stumm, sieht normal aus |
| M3 | Neues Snippet in Mix-Bank | würfelt im Video des Pads | in Mix-Bänken gesperrt |
| M4 | Quell-Pads vorhören | nein (reinziehen, anspielen, ⌘Z) | ja, braucht zweite Bank im Device (großer Umbau) |
| M5 | „Platz leeren“ | **ja, Icon „leeren“ am Pad** (Undo-Schritt, Device dunkel, Fach still) | nur über Undo |
| M6 | Zwei Macs | format 2, beide Macs gleichzeitig updaten | format 1 lesbar halten (riskant: 3.x schneidet Mix-Snippets falsch) |

## 10. Nachtrag Editor-Flow (Nutzer, 2026-11-02)

Ersetzt, was oben über Track-/Mix-Bank, „Neue Mix-Bank“, Quellleiste und `newbank` steht. Der Rest gilt weiter.

**Entscheidungen (fest):**
1. **Keine Track-/Mix-Bank mehr.** Jede neue Bank startet leer (16 × `null`). Der Knopf heißt „Neue Bank“ (Befehl bleibt `newmix`, Name der Bank „Neue Bank“). Ein Klick auf einen Suchtreffer legt keine Bank mehr an.
2. **Track aus der Suche aufs Pad:**
   - a) Treffer auf einen Platz ziehen oder anklicken (gewählter Platz). Der Platz bekommt eine gewürfelte Stelle (`roller`: Taktanfang bevorzugt, keine Stille, kein Start doppelt mit den übrigen Pads dieses Videos).
   - b) Knopf „Leere Plätze füllen“ am Treffer: alle leeren Plätze der aktiven Bank, Starts aufsteigend in Pad-Reihenfolge.
   - Solange geladen wird (Warteschlange, bis 3 parallel), zeigen die Pads „wartet“/„lädt n %“. Danach wird geschnitten, das Device lädt die Bank neu (wie bei `setpad`).
   - Ein belegter Platz wird überschrieben, als Undo-Schritt. Ein Platz, der gerade lädt, nimmt keine weitere Ablage an.
3. **Quell-Grid** statt Quellleiste: 4×4 rechts neben den Pads, Pad 1 unten links, darüber die Auswahl der Quellbank (jede außer der aktiven, gemerkt pro Browser). Bei jeder Bank. Ziehen = Kopie (`setpad` mit `info`). Die Detailspalte (Start, Video · BPM, Knöpfe, Tempo) steht kompakt darunter. Einklappen gibt es nicht mehr.
4. **Kein Zeichen „Mix“.** Unter dem Namen: ein Track „Titel · BPM“, mehrere „n Tracks“, leer „leer“. Titel am Pad nur bei mehreren Tracks. Device-Status: „Bereit: <Name> · n Tracks“ bzw. „· leer“ (statt „Mix aus n Tracks“).

**Protokoll:**
- `fillpads {id, video, pads[], tag?}` → `{}` sofort. Prüfung: `video` = YouTube-ID, `pads` 1–16 verschiedene Plätze, Bank vorhanden (`nobank`), Bibliothek schreibbar. Ablauf (`fillPads`): Video über `fetchVideo(…, 'pads')` laden (Stufe zwischen select/fetch und fetchall), würfeln (`rollBank(v, n, taken)`), ein `libChange('fill')` für alle Plätze, Titel aus dem Download. SSE `job {kind: 'pads', tag, id, video, pads, phase, progress}`, `done` zusätzlich mit `before`/`after` (Pad-Einträge der Plätze) und `videos` (Titel/bpm aller beteiligten Videos). Fehler: `loadfail` meldet der Download, sonst `msg`.
- Undo/Redo im Editor: `setpad` pro Platz mit `before` bzw. `after` (+ `info` aus `videos`).
- `newbank` (Bank aus einem Video) entfällt. `LIB.create` bleibt nur als Hilfe für Tests.

**Ablage statt sofort löschen (Nutzer, gleicher Tag; heißt seit Abschnitt 11 „Undo-Vorrat“):** Nichts, was zu einem Track gehört, wird gelöscht, nur weil das letzte Pad mit diesem Track verschwindet.
- `setpad` und `fillpads` legen das alte Pad vor dem Überschreiben/Leeren als `D/snippets/keep/<video>_<start>.wav` (ein Fach, 16 s) + `.json` (`{len, dur}`) ab (`keepPad`, Quelle wie beim Schneiden). Die Ablage ist die letzte Quelle beim Schneiden (2.2). Damit geht Undo ohne Cache.
- `videos`-Einträge ohne Pad und `D/snippets/<video>.chroma` bleiben während der Sitzung (`dropOrphans` nicht mehr in `libChange`).
- Beim Start von Node (`keepCleanup`): Ablage, `.chroma` in D und `videos`-Einträge ohne Pad in irgendeiner Bank fliegen raus. 7-Tage-Regel für Snippets gelöschter Bänke bleibt, der Cache in L wird weiter nie automatisch gelöscht.
- Grenze: Startet ein zweites Device, räumt es auf, was das erste noch für Undo bräuchte.

**Cache leeren (Nutzer, gleicher Tag, überholt „kein Knopf zum Leeren“):** Knopf „Cache leeren“ neben der Cache-Größe. Rückfrage „Cache leeren (2,7 GB)? Bänke spielen weiter, zum Bearbeiten werden Tracks neu geladen.“ `clearcache` → `{freed}` löscht in `L/cache/` nur `.wav`, `.json`, `.chroma`, nie etwas in D. Gesperrt (`cachebusy`, im Editor ausgegraut), solange Downloads laufen oder warten oder geschnitten wird. Danach „nur spielbar“/„Track laden“ wie üblich, Anzeige 0 GB.

**Offen gelassen (einfach gelöst, nicht gefragt):**
- Klick auf einen Treffer schließt die Suche (wie früher), damit der Ladezustand am Pad sichtbar ist.
- Ohne aktive Bank (leere Bibliothek) ist die Suche gesperrt, „Neue Bank“ ist der Einstieg.
- Ladende Pads sperren nur Ablagen, keine anderen Schritte (Undo/Redo können sie trotzdem ändern; `fillpads` überschreibt dann beim Fertigwerden).

## 11. Nachtrag Bühne und Ablage (Nutzer, 2026-11-02)

Ergänzt Abschnitt 10. Der Rest gilt weiter.

**Entscheidungen (fest):**
1. Jede Bank steht auf der **Bühne** oder in der **Ablage**. Nur Bühnen-Bänke schaltet das Device mit `Bank` und Prev/Next durch, ihre Reihenfolge ergibt die Nummern 1…n. Ablage-Bänke haben keine Nummer, zum Weiterbauen oder als Quelle im Quell-Grid.
2. Neue Bänke („Neue Bank“, Duplizieren, „Neue Bank“ am Suchtreffer) landen in der Ablage.
3. Bestehende Bänke stehen nach dem Update auf der Bühne.
4. Editor, linke Liste: oben „Bühne“ (mit Nummern), darunter „Ablage“. Umschalten per Schalter in jeder Zeile und per Ziehen zwischen die Bereiche. Ziehen innerhalb der Bühne ändert die Nummern. Jede Änderung ist ein Undo-Schritt.
5. Ablage-Bank im Editor anklicken: lädt im Device, Anzeige „-“. Der nächste Dreh am Regler lädt die Bühnen-Bank seines Werts.
6. Ein Set, das sich eine Ablage-Bank gemerkt hat, lädt sie beim Öffnen trotzdem (per ID), Anzeige „-“.
7. Die alte technische „Ablage“ `snippets/keep/` heißt jetzt **Undo-Vorrat** (Ordnername bleibt).

**Datei:** `banks[].stage = false` = Ablage, Feld fehlt = Bühne. `format` bleibt 2: Unbekannte Felder bleiben erhalten (`libChange` liest und schreibt das ganze Objekt), ein älteres 4.0-Device ignoriert das Feld und nummeriert einfach alle Bänke durch. Ein neues `format` hätte nur ältere Devices stumm geschaltet, ohne dass etwas kaputtgehen kann. Auf der Bühne wird das Feld gelöscht, nicht `true` geschrieben. Die Reihenfolge in `banks[]` ist gemischt, jeder Bereich zählt für sich.

**Protokoll:**
- `/cmd stage {id, on, at?}` → `{at}`: Bank in den Bereich `on` (true = Bühne) an Platz `at` des Bereichs, ohne `at` ans Ende, `at` hinter dem Ende = ans Ende. `badreq` bei `on` kein Boolean oder `at` keine ganze Zahl ≥ 1.
- `move {id, to}` → `{at}`: `to` ist jetzt der Platz im eigenen Bereich (bisher: in der ganzen Liste). Mit allen Bänken auf der Bühne wie vorher.
- `newmix {name?}` → `{id}`: optionaler Name (Knopf „Neue Bank“ am Suchtreffer).
- `bank <id> <nr> …`, `libstate <anzahl> <nr> …`, `bankpeek`, `banksel`, `bankload`, SSE `device.nr`: nur Bühne, `nr 0` = Ablage. `libstate leer` nur, wenn es gar keine Bank gibt (eine Ablage-Bank darf klingen, auch wenn die Bühne leer ist).
- SSE `lib`: `banks[].stage` (Boolean).
- `delete` der aktiven Bank: Bühnen-Bank → Nachrücker auf demselben Bühnenplatz, sonst der davor. Ablage-Bank oder Bühne danach leer → `bankgone <id>`, `[js]` lädt die Bank am Regler (`bankload`, bei leerer Bühne nichts).

**`[js]`:** `libstate` setzt `B.nr` auch auf 0 (aktive Bank in die Ablage geschoben → „-“). Prev/Next von „-“ aus (Entscheidung der Arbeitssession, einfach gehalten): beide holen die Bühnen-Bank, auf der der Regler steht, statt von einer Nummer aus zu zählen, die es nicht gibt. Der Regler springt beim Drehen auf die Bank seines Werts. Kein neuer Selektor, der Patch bleibt.

**Editor:** zwei Listen (`#banklist` Bühne, `#shelflist` Ablage) in `#libscroll`, je mit Überschrift und Anzahl. Pfeil am Zeilenende (↓ in die Ablage, ↑ auf die Bühne, jeweils ans Ende). Ziehen: auf eine Zeile = deren Platz, auf die Überschrift = Platz 1, auf die freie Fläche = ans Ende; im selben Bereich `move`, sonst `stage`. Undo `stage` mit altem Bereich und Platz, Redo mit dem gemeldeten `at`. Kopfzeile „n / Anzahl Bühne“ bzw. „Ablage“. ↑/↓ und ◀ ▶ im Editor gehen durch beide Bereiche (Bühne, dann Ablage). Quell-Grid-Auswahl: Nummer bzw. „–“.

**„Neue Bank“ am Suchtreffer (Nutzer, gleicher Tag):** zweiter Knopf neben „Leere Plätze füllen“. `newmix {name: Videotitel}` (Ablage, wird aktiv, Anzeige „-“), dann `fillpads` mit allen 16 Plätzen. Ein Undo-Schritt „Neue Bank „Titel““ = `delete`, Redo = `restore`. Das Füllen bekommt keinen eigenen Schritt. Undo während des Ladens: die Bank ist weg, das spätere Füllen meldet „Bank gibt es nicht mehr“.


## 12. Nachtrag Editor-Design und 4 Takte (Nutzer, 2026-11-03)

Ergänzt Abschnitte 10 und 11. Der Rest gilt weiter.

**Entscheidungen (fest):**
1. **Pad-Icons:** × („leeren“) rechts oben, Würfel („Neues Snippet“) darunter, beide immer sichtbar (nicht nur bei Hover/Auswahl), 13 px. Sie liegen rechts neben der Nummer und über der Startzeit, verdecken beide nicht (Prüfung im Test bei 1440×900). Klick in die Mitte spielt an.
2. **Division „4 Bars“** als neuer höchster Wert (Index 11), hinten angehängt: `DIVS` in `[js]`, Enum des `live.menu` „Division“ (`parameter_mmax` 11), `DIVS` im Editor, `PARAMS.div` in Node. Index 0–10 unverändert, gespeicherte Sets und MIDI-Mappings bleiben gleich. Ein Snippet hat 16 s: `playRange` und `retime` klammern aufs Fach. Volles Fach, ohne Warp: geklammert ab Live-Tempo < 60 × Rate × Tonhöhenfaktor BPM. Mit Warp: wenn das Quelltempo des Pads < 60 BPM ist (der Slice sind 16 Schläge der Quelle). Kürzere Fächer (Track-Ende) früher.
3. **Tempo-Hinweis** „Tempo aus der Analyse, nicht bestätigt“ steht rechts neben „Tempo stimmt“ (gemeinsame Gruppe, bricht nur als Ganzes um).
4. **Vorhören im Quell-Grid (Ausnahme zu „keine Wiedergabe im Browser“, gilt nur hier, überholt M4):** Klick auf ein Quell-Pad spielt sein Snippet im Browser per Web Audio (Ausgang des Macs, nicht über Live), ab Start, so lang wie der Slice des Device in Lives Tempo (`device.params.div` und `.bpm`), ohne Warp, Rate und Tune, höchstens bis zum Snippet-Ende. Ohne `params` 2 s. Noch ein Klick stoppt, Klick auf ein anderes Pad wechselt, Ziehen stoppt und kopiert wie bisher. Das Pad leuchtet (Akzentfarbe), solange es spielt. Ende und Stopp blenden 10 ms aus.
5. **Mehrere Quell-Grids** nebeneinander: so viele 4×4, wie bei voller Höhe in die Breite rechts neben den eigenen Pads passen, höchstens eins pro anderer Bank. Kein Grid wird dafür kleiner, als ein einzelnes wäre (die Höhe bestimmt die Größe). Jedes hat eine eigene Auswahl. Startwerte: die Bänke nach der aktiven in der Liste (Bühne, dann Ablage, im Kreis), keine doppelt. Gemerkt im localStorage-Layout als `srcIds[k]` (alte `srcId` wird `srcIds[0]`). Die Detailspalte steht kompakt (zwei Zeilen: Pad + Track, Knöpfe + Tempo) unter allen Grids, über die ganze Breite.

**Protokoll:**
- `GET /snip/<bankId>/<pad>` (Node): Fach `pad` aus `D/snippets/<bankId>.wav` als WAV (44,1 kHz/16 Bit/Stereo), nur bis `lens[pad]`, `Cache-Control: no-store`. 404: Bank fehlt, leerer Platz, `lens 0`, keine Snippet-Datei oder Snippet-Pad ≠ Bibliotheks-Pad (wird gerade neu geschnitten). 400 bei falschem Pfad, 403 bei anderer Methode als GET oder fremdem Host.
- `bankstate` bekommt hinten `<bpm>` (Lives Tempo, 2 Nachkommastellen). SSE `device.params.bpm`, kein Regler (`param` kennt es nicht).

**Offen gelassen (einfach gelöst, nicht gefragt):**
- Der Knopf heißt weiter „Tempo stimmt“ (im Wunsch „Stimmt so“ genannt).
- Hold am Device: Vorhören spielt trotzdem die Slice-Länge.
- Vorhören ist kein Undo-Schritt und geht auch ohne Schreibrecht (z. B. kaputte Bibliothek), solange Node läuft.
- Leere Pads, „nur spielbar“ ohne Snippet-Datei: Toast „Vorhören geht nicht (Snippet fehlt)“.


## 13. Nachtrag Pads ziehen: Alt-Kopie und in andere Bänke (Nutzer, 2026-11-03)

Ergänzt Abschnitte 10–12. Der Rest gilt weiter.

**Entscheidungen (fest):**
1. **Alt-Drag in derselben Bank:** Eigenes Pad auf eigenes Pad ohne Alt = tauschen (`swap`) wie bisher. Mit Alt = Ziel wird Kopie des gezogenen Pads (Video und Start), auch auf leere Ziele. `dropEffect` `copy` (Plus am Zeiger), sonst `move`. Alt zählt beim Loslassen, darf sich während des Ziehens ändern. Ein Undo-Schritt.
2. **In eine andere Bank:** Eigenes Pad über einer anderen Bank der Liste (Bühne oder Ablage) **0,6 s** halten (`HOLD_OPEN_MS`) → `select` wie ein Klick, das Ziehen läuft weiter. Loslassen auf einem ihrer Pads: verschieben (Ziel überschrieben, Quellplatz leer), mit Alt kopieren (Quelle bleibt). Ein Undo-Schritt über beide Bänke. Abbrechen lässt die geöffnete Bank aktiv.
3. Quell-Grid-Pads und Suchtreffer bleiben Kopie, Alt ändert dort nichts. Nur eigene Pads öffnen Bänke per Halten.
4. Bänke ziehen (Umsortieren, Bühne/Ablage) bleibt unverändert: Das Halten gilt nur für Drags vom Typ `pad`.

**Protokoll:** keins neu. Verschieben = `setpad` aufs Ziel, danach `setpad … video null` auf den Quellplatz (ID-basiert, die Quellbank wird im Hintergrund neu geschnitten). Erst das Ziel, damit das Audio beim Schneiden noch in der Quellbank liegt; sonst greift der Undo-Vorrat. Undo: Quellplatz zurück, dann Ziel zurück (je `setpad` mit `info`), vorher `select` der Zielbank. Schlägt das Leeren der Quelle fehl, bleibt es eine Kopie (eigener Undo-Schritt als Kopie).

**Offen gelassen (einfach gelöst, nicht gefragt):**
- Kein eigener Hinweis während der 0,6 s (die Zeile bekommt keine Markierung); die Bank öffnet sich einfach.
- Ein leerer Platz lässt sich weiter tauschen, aber nicht kopieren oder in eine andere Bank verschieben (nichts passiert).
- Das Halten öffnet nur mit Schreibrecht.
- Nicht atomar: Zwei `setpad` nacheinander statt eines neuen `movepad`. Zwischen beiden kann ein anderer Editor schreiben, schlimmstenfalls bleibt eine Kopie.
