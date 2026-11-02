# Spezifikation: Mix-Bänke

Stand 2026-11-02. Grundlage: Spec 2.0 (`.scratch/bank-editor/spec.md`), Spec 3.0 (`.scratch/device-3/spec.md`), gültiger Stand in `CLAUDE.md`. **Was hier nicht geändert wird, gilt dort weiter.** **(festgelegt)** = von der Planung aus dem Code entschieden. **(offen Mx)** = Bedienfrage an den Nutzer (Abschnitt 9). Bis zur Antwort gilt die Empfehlung, sie ist hier schon eingetragen.

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

**Abwärts:** Ein 3.x-Device liest format 2 als „neuer“, fasst nichts an und bleibt stumm. Das ist so gewollt, denn sonst würde es Mix-Snippets aus `banks[].video` neu schneiden und in iCloud überschreiben. Folge: Beide Macs müssen gleichzeitig auf 4.0 **(offen M6)**. README und Release-Hinweis sagen das.

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
| `newmix` | **neu** | Bank am Ende, Name „Mix-Bank“, 16 × `null`, wird aktiv. Antwort `{id}`. Undo = `delete`, Redo = `restore` (wie Neue Bank) **(offen M1)** |
| `setpad` | **neu** | `{id, pad, video, start}` kopiert ein Pad auf einen Platz. `video: null` leert den Platz (nur für Undo, **offen M5**). Steht `video` nicht in `videos`, braucht es `info: {title, bpm?}` (Undo nach Löschen der Quellbank), sonst `badreq`. Schneiden nach 2.2. Keine Quelle → `playonly`, nichts geändert. Antwort `{}` |
| `setstart`, `roll` | geändert | wirken auf `pads[pad]`. Leerer Platz → `badreq`. `playonly`, wenn die WAV **dieses** Pads fehlt. `roll` würfelt im Video des Pads, belegt sind die Starts der Pads mit demselben Video **(offen M3)** |
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

`l = 0` → `playRange` ergibt Dauer 0, `trigger` spielt nichts. **Fix:** `trigger` ruft `updateSel()` auch, wenn nichts klingt, damit das gewählte Pad beim Editor ankommt. `selinfo` bei leerem Platz: „Pad <n>  leer“. Pad-jsui: neue Nachricht `padempty <16 × 0/1>` aus `bank()`. Ein leeres Pad zeichnet `ytpads.js` dunkel und ohne Nummer **(offen M2)**.

### 4.4 Anzeige

Großer Name und Nummer wie heute. Am Device gibt es kein Mix-Zeichen **(festgelegt)**. Statuszeile kommt von Node (3.3).

### 4.5 Aufwand und Risiko `[js]`

Ehrlich: **mittel**. Etwa 120 Zeilen ändern sich. Neue Logik ist kaum dabei, der größte Teil ist Umstellung von global auf pro Pad in `playRange`, `xAt`/`timeAt`, `sendGridUI`, `updateSel`, `pitchRate`, `keyInfo`. Gefährlich sind Warp mit Raster und Catch, weil sie nur in Live hörbar sind. Absicherung: ein **Golden-Test** in `test_main.js`. Eine Track-Bank in 3.0 und in 4.0 bekommt dieselben Anschläge und Reglerwechsel (Warp an/aus, Hold, Rev, Quant+Catch, Division), die Ausgänge 0, 2 und 3 (`pos`, `wplay`, `rel`, `grid`, `selinfo`) müssen gleich sein. Die 3.0-Aufnahme wird vor dem Umbau einmal als JSON in `tools/tests/` abgelegt.

## 5. Editor (`editor.html`)

### 5.1 Bibliothek

- Zeile: Name, darunter klein bei Track-Bänken wie heute „Titel · BPM“, bei Mix-Bänken das Zeichen **Mix** vor dem Namen und darunter „<n> Tracks“.
- „nur spielbar“, wenn ein Video der Bank nicht im Cache liegt (`bank.wav false`). Lädt ein Video der Bank: „lädt n %“ (Fortschrittszeilen aus der Session downloads übernehmen).
- Knopf **„Neue Mix-Bank“** im Listenfuß neben „Alle nachladen“ → `newmix`, Schritt in der Historie **(offen M1)**.

### 5.2 Waveform

- Zeigt immer den Track des **gewählten Pads** (`device.video`, `/peaks/<video>`). Marker gibt es für alle Pads der Bank mit **diesem** Video. Bei einer Track-Bank sind das alle 16, wie heute.
- Gewähltes Pad ohne WAV: Fläche „Track fehlt“ + „Track laden“ (`fetch` mit diesem Video). Marker ziehen und Würfeln sind für dieses Pad gesperrt.
- Leerer Platz gewählt: Fläche „Leerer Platz – Pad aus der Quellleiste hierher ziehen“.
- Einrasten auf `beats` (kommt für `device.video`). Abspielkopf nur, wenn `play.video` zur Waveform passt.
- Zoom und Scroll merkt sich die Waveform nicht pro Video. Wechselt das Video, scrollt sie zum Marker des gewählten Pads.

### 5.3 Pads

- Jedes Pad zeigt Nummer und Startzeit. Der Mini-Balken zeigt die Lage im **eigenen** Track (`videos[v].dur`, ohne Dauer kein Balken). In Mix-Bänken zeigt jedes Pad zusätzlich klein die ersten Zeichen des Videotitels, Tooltip mit dem ganzen Titel.
- Leerer Platz: gestrichelt, „leer“, nimmt Ablagen an, Würfel aus.
- Detailspalte: Video · BPM und Tempo-Knöpfe für das Video des gewählten Pads (`tempo` mit diesem Video). Leerer Platz: nur „leer“.
- Pad auf Pad ziehen tauscht wie heute (`swap`), auch mit leeren Plätzen.

### 5.4 Quellleiste

- Unter dem Pad-Raster, einklappbar (Zustand im `localStorage`, wie die Größen). Bei jeder Bank sichtbar **(offen M1)**.
- Oben ein `<select>` mit allen Bänken außer der aktiven (Nummer + Name, Mix-Bänke mit „Mix“). Der Editor merkt sich pro Browser die zuletzt gewählte Quelle.
- Darunter die 16 Pads der Quellbank als kleine Kacheln in einer Reihe (Pad 1 links): Nummer, Startzeit, Titel als Tooltip. Leere Plätze der Quelle sind ausgegraut und nicht ziehbar.
- Kachel auf einen Platz ziehen → `setpad {id, pad, video, start}`. Ein belegter Platz wird ersetzt. Schritt in der Historie „Pad <n> aus <Quellbank>“. Undo = `setpad` mit dem alten Eintrag (bzw. `video: null`) plus `info` des alten Videos, Redo = `setpad` neu.
- Vorhören gibt es nicht: reinziehen, anspielen, ⌘Z **(offen M4)**.
- Gesperrt wie alles Schreibende (kaputte Bibliothek, kein Device).

### 5.5 Undo

| Schritt | Undo | Redo |
|---|---|---|
| Pad aus Quelle | `setpad` alt (+ `info`) | `setpad` neu |
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
- `test_editor.js` (`editor_mock.js` mit Mix-Bank): Mix-Zeichen, Waveform wechselt mit dem Pad, Marker nur fürs eigene Video, Quellleiste ziehen → `setpad`, Undo/Redo, leerer Platz, „Neue Mix-Bank“. Screenshots mit `--shots`.
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
- **Ziel:** 5.1–5.5. Die Attrappe kennt format-2-`lib` (`pads`, `mix`, `videos.wav/dur`), `device.video` nach `sel`, `beats` pro Video, `newmix`, `setpad`.
- **Abhängig:** Merge der Session downloads (Fortschrittszeilen in der Bibliothek).
- **Abnahme:** `test_editor.js` mit den Fällen aus 6, Screenshots Track-Bank, Mix-Bank, leerer Platz, Quellleiste. Der Nutzer schaut einmal gegen die Attrappe drauf.

### Paket I: Integration → 4.0.0
- **Ziel:** N, J, E auf `mix` zusammen. `test_wiring.js` (Selektoren), `test_e2e.js` (Mix-Bank Ende zu Ende). README: Mix-Bänke, Quellleiste, Hinweis „beide Macs auf 4.0“. `CLAUDE.md`: Ablage (format 2, Snippet-`.json`), Protokolle (`bank`, `padana`, `padempty`, `bankstate`, `setpad`, `newmix`), Fallen (pro Pad), Spec-Verweis. Gestrichene Nachrichten raus.
- **Abnahme:** alle `tools/tests/test_*.js` ohne FEHLER. Dann `deploy.sh`, der Nutzer prüft die Liste aus 6. Danach `release.sh 4.0.0`.

## 8. Außerhalb

Pads vorhören in der Quellleiste, Mix-Zeichen am Device, Pads aus Suchtreffern direkt in eine Mix-Bank (geht über eine neue Track-Bank als Quelle), Länge pro Pad, Verknüpfung statt Kopie, „Platz leeren“-Knopf (offen M5), Export.

## 9. Offene Fragen an den Nutzer (über die Master-Session gestellt, 2026-11-02)

Keine blockiert. Eingetragen ist jeweils die Empfehlung A.

| # | Frage | Empfehlung (gilt bis zur Antwort) | Alternativen |
|---|---|---|---|
| M1 | Wie entsteht eine Mix-Bank? | Knopf „Neue Mix-Bank“ (16 leere Plätze), Quellleiste bei jeder Bank | B: Quellleiste nur bei Mix-Bänken · C: kein Knopf, duplizieren + reinziehen |
| M2 | Leere Plätze am Device | stumm, Pad dunkel ohne Nummer | B: stumm, sieht normal aus (dann kein `padempty`, `ytpads.js` bleibt) |
| M3 | Neues Snippet in Mix-Bank | würfelt im Video des Pads | B: in Mix-Bänken gesperrt |
| M4 | Quell-Pads vorhören | nein (reinziehen, anspielen, ⌘Z) | B: ja, braucht zweite Bank im Device (großer Umbau) |
| M5 | „Platz leeren“ | nein, nur über Undo | B: Icon am Pad (`setpad` mit `null` gibt es schon) |
| M6 | Zwei Macs | format 2, beide Macs gleichzeitig updaten | B: format 1 lesbar halten (riskant: 3.x schneidet Mix-Snippets falsch) |
