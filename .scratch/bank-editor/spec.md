# Spezifikation: Bank-Editor und Device 2.0

Stand 2026-10-28, zusammengefasst aus den Tickets 01–12 der Karte [`map.md`](map.md). Hier steht nur der gültige Stand. Die Begründungen stehen in den Tickets. Wo die Tickets etwas offen ließen und diese Spec es festlegt, steht **(festgelegt)** dabei. Fragen an den Nutzer sind mit **(Frage)** markiert, siehe [Offene Fragen](#offene-fragen).

Leitlinie: Live-Werkzeug für die Bühne. Was hier nicht steht, wird nicht gebaut.

## 1. Begriffe

| Begriff | Bedeutung |
|---|---|
| **Pad** | Einer von 16 Plätzen, bestimmt durch seinen Startpunkt im Track. Pad 1 liegt unten links. |
| **Bank** | 16 Pads aus genau einem Track. Gespeichert werden Video, Name und 16 Starts. Die Slice-Länge kommt immer von den Device-Reglern. |
| **Snippet** | Das gespeicherte Audio eines Pads: 16 s ab seinem Start, kürzer, wenn der Track früher endet. Mehr spielt das Pad nie. |
| **Bibliothek** | Alle Bänke, geordnet, global für alle Live-Sets. Ersetzt die Favoriten. |
| **Banknummer / Platz** | Position in der Bibliothek, 1…n. Sichtbar, ändert sich beim Umsortieren. |
| **Bank-ID** | Feste, unsichtbare Ganzzahl ≥ 1. Ändert sich nie und wird nie neu vergeben. `0` = keine Bank. |
| **Song-ms / Buffer-ms** | Position im ganzen Track bzw. in der Snippet-Datei. Pad *i* (0–15): `buffer = i × 16000 + (song − start_i)`. |
| **keine Bank** | Das Device spielt einen ganzen Track ohne Bank: nach Teletext-Laden, nach einem 1.x-Set, oder wenn die gespeicherte Bank gelöscht ist. |
| **nur spielbar** | Bank, deren ganzer Track nicht im lokalen Cache liegt. Spielbar, aber Starts lassen sich nicht ändern. |
| **nicht ladbar** | Bank ohne Snippet-Datei und ohne ganzen Track. Das Device kann sie nicht laden. |
| **erstes Device** | Das Device, dessen Node-Prozess Port 8765 belegt. Nur dieses steuert der Editor. |

Außerhalb des Umfangs: Teletext weiterentwickeln, Pads aus mehreren Tracks, Ende oder Länge pro Pad oder Bank, Wiedergabe im Browser, Editor ohne laufendes Device, Auswahl zwischen Devices im Editor, Import der alten Favoriten, Export, Knopf zum Zurückholen einer Sicherung, Cache-Leeren-Knopf.

## 2. Datenablage

### 2.1 Ordner

| Kürzel | Pfad | Inhalt |
|---|---|---|
| **D** (Datenordner) | `~/Library/Mobile Documents/com~apple~CloudDocs/YTSampler/`. Fehlt `com~apple~CloudDocs`, dann `~/Music/YTSampler/`. | `library.json`, `library.lock`, `backup/`, `snippets/`, `sessions/`, `ir.json`, `web/` |
| **L** (lokal) | `~/Music/YTSampler/` | `cache/` (ganze WAVs, `.json`, `.chroma`), `chrome-profile/` |

- D liegt in iCloud Drive. Der Nutzer stellt den Ordner im Finder einmal auf „Geladen lassen“. Das Device prüft das nicht.
- Es arbeitet nie mehr als ein Rechner gleichzeitig. Konflikt-Kopien von iCloud werden nicht behandelt.
- Keine Datei in D enthält absolute Pfade.
- Eine Datei, die iCloud noch nicht geladen hat, gilt als unlesbar.
- `Teletext öffnen.command` und `chrome-profile/` behalten ihren Pfad.

### 2.2 `library.json`

```json
{
 "format": 1,
 "rev": 57,
 "nextId": 13,
 "banks": [
  {"id": 7, "name": "Funk", "video": "F2RnxZnubCM",
   "starts": [42962, 46333, 194740, 165892, 11435, 41259, 212877, 128466, 7643, 260155, 191096, 2210, 99015, 150020, 170433, 230871]}
 ],
 "videos": {
  "F2RnxZnubCM": {"title": "Titanic • My Heart Will Go On • Celine Dion", "bpm": 99.5}
 }
}
```

| Feld | Regel |
|---|---|
| `format` | Ganzzahl, `1`. Wird nur erhöht, wenn ein alter Leser die Datei falsch verstünde. Unabhängig von `VERSION`. |
| `rev` | +1 bei jeder Änderung. |
| `nextId` | ≥ 1, wird nie kleiner. Neue Bank: `id = nextId`, dann `nextId + 1`. |
| `banks` | Index + 1 = Banknummer. Keine Obergrenze. |
| `banks[].id` | Ganzzahl ≥ 1, eindeutig, < `nextId`. |
| `banks[].name` | String, roh, darf leer oder doppelt sein. `clean()` erst auf dem Weg nach Max. |
| `banks[].video` | YouTube-ID, muss in `videos` stehen. |
| `banks[].starts` | Genau 16 ganze ms ≥ 0, Pad 1–16, Song-ms. Schon eingerastet: Das Device rastet nicht nach. |
| `videos.<id>.title` | String, roh. |
| `videos.<id>.bpm` | Nur wenn bestätigt. Fehlt er, gilt das Tempo aus der Analyse. 30–300, auf 0,1 gerundet. |

- Ein `videos`-Eintrag existiert genau so lange, wie eine Bank ihn benutzt. Löschen der letzten Bank eines Videos entfernt ihn in derselben Änderung, samt `bpm`. Verwaiste Einträge sind kein Fehler und fallen beim nächsten Schreiben weg.
- Unbekannte Felder bleiben beim Schreiben erhalten: Node ändert das gelesene Objekt, statt es neu aufzubauen.
- Geschrieben wird eingerückt: `JSON.stringify(lib, null, 1)`.

**Lesen und Prüfen**
- Datei fehlt → leere Bibliothek (`format 1, rev 0, nextId 1, banks [], videos {}`). Die Datei entsteht beim ersten Schreiben.
- **Kaputt**, wenn: kein gültiges JSON, `format` ≠ 1, Pflichtfeld fehlt oder hat falschen Typ, ID doppelt oder ≥ `nextId`, `starts` nicht genau 16 Zahlen, `video` fehlt in `videos`, oder die Datei ist (noch) nicht lesbar.
- `format > 1` heißt **neuer**: wie kaputt, aber mit eigener Meldung.
- Kaputt oder neuer: Die Datei wird nie angefasst, das Speichern ist gesperrt, die Pads sind stumm, Device und Editor zeigen den Fehler. Sobald sie wieder gültig gelesen wird (über `watchFile`), geht alles wieder.

**Schreiben** (ein Vorgang, synchron am Stück in Node)
1. Sperre `library.lock` holen.
2. `library.json` frisch lesen und prüfen. Kaputt → abbrechen, Sperre freigeben, Speichern sperren.
3. Vorgang auf den frischen Stand anwenden, `rev + 1`. Bezieht er sich auf eine ID, die fehlt → Fehler `nobank`.
4. `library.json.tmp` schreiben, `fsync`, `rename` auf `library.json`.
5. Sperre freigeben, die eigene `rev` merken, an `[js]` und Editor melden.

Es gibt kein Entprellen beim Schreiben. Der Editor schickt `setstart` erst beim Loslassen.

**Sperre**: `fs.openSync('library.lock', 'wx')`, Inhalt PID. Belegt und PID tot (`pidAlive`) oder Datei älter als 5 s → übernehmen. Sonst bis 1 s in kurzen Schritten warten, dann `libbusy`. Lesen braucht keine Sperre.

**Änderungen von außen**: Jeder Node-Prozess beobachtet `library.json` mit `fs.watchFile` (500 ms). Hat sich `rev` geändert, liest er neu, berechnet den Platz der aktiven ID und meldet `libstate` an `[js]` und `lib` an den Editor. War die `rev` nicht seine eigene, ist `by: "extern"`.

### 2.3 Snippet-Dateien

| Was | Regel |
|---|---|
| Ort | `D/snippets/<bankId>.wav` und `D/snippets/<bankId>.json`. Der Name folgt aus der ID, in `library.json` steht kein Pfad. |
| WAV | 44,1 kHz, 16 Bit, Stereo, genau 16 × 16 000 ms = 256 000 ms (≈ 45 MB). Fach *i* beginnt bei `i × 16000`. Kürzere Snippets sind mit Stille aufgefüllt. |
| `.json` | `{"video": "<id>", "starts": [16], "lens": [16], "dur": <Songdauer ms>}`, `lens[i] = min(16000, dur − starts[i])`. **(festgelegt: `dur` ergänzt, damit Node die Songdauer ohne ganze WAV kennt.)** |
| aktuell | `.json` stimmt mit `video` und `starts` der Bank in `library.json` überein. Sonst veraltet. |
| Schreiben | `<bankId>.<pid>.tmp` schreiben, dann `rename`. Erst die WAV, dann die `.json`. |
| Schneiden | Aus der ganzen WAV in `L/cache/` (gezielt pro Fach lesen). Fehlt sie, setzt Node die Datei aus den Fächern der alten Snippet-Datei zusammen. Das geht nur, wenn jeder neue Start schon in der alten Datei vorkommt: Tauschen, Undo eines Tauschs, Duplizieren. Sonst `playonly`. |
| Entprellen | Pro Bank 500 ms nach der letzten Änderung. `select`/`banksel`/`bankopen` auf eine veraltete Bank schneidet sofort und synchron. |
| gelöschte Bänke | Snippet-Dateien bleiben liegen (Undo). Beim Start löscht Node `snippets/<zahl>.wav/.json`, deren ID nicht in der Bibliothek steht und die älter als 7 Tage sind. Nur Dateinamen aus Ziffern, nie `.chroma`. |
| mehrere Devices | Geschnitten wird im Prozess, der den Befehl ausführt. Die anderen vergleichen nach `watchFile` die `.json` ihrer aktiven Bank und laden neu, wenn sie sich geändert hat. |

Zustand pro Bank, nur im Speicher und im SSE `lib`, nie in einer Datei:
- `snip`: `ok` · `cutting` · `stale` (wartet aufs Schneiden) · `missing` (fehlt). Bei `missing` und vorhandener WAV schneidet Node neu.
- `wav`: liegt der ganze Track in `L/cache/`?
- `videos.<id>.fail`: Grund des letzten gescheiterten Downloads, gilt bis zum nächsten Versuch.

### 2.4 Analyse

- Die Analyse eines Videos (`cache/<videoId>.chroma`, Format wie heute) wird beim Schneiden einmal unverändert nach `D/snippets/<videoId>.chroma` kopiert, wenn sie dort fehlt. Sie wird nie automatisch gelöscht.
- Lädt das Device eine Bank, liest Node die Analyse aus `D/snippets/`. Bei Teletext („keine Bank“) aus `L/cache/`.
- Fehlt sie oder ist sie nicht lesbar: Liegt die ganze WAV im Cache, rechnet Node neu und legt ab. Sonst bleibt die Bank spielbar ohne Tune, Grid und automatisches Tempo. Warp mit bestätigtem `bpm` geht weiter. Status: „Analyse fehlt – Bank im Editor neu schneiden“.
- **Analyseformat (`AN.VERSION`) nur noch abwärtskompatibel ändern.** Abgelegte Analysen von Bänken, deren WAV nicht mehr im Cache liegt, lassen sich nicht neu rechnen. Neue Felder werden angehängt. Der Leser versteht jede ältere Version, die schon einmal abgelegt wurde. Wer `AN.VERSION` erhöht, behält den Leser für die alten Versionen. Eine Version, die er nicht versteht, gilt als „Analyse fehlt“. Gehört nach dem Bau auch in `CLAUDE.md` („Fallen“).

### 2.5 Cache der ganzen WAVs

- `L/cache/`, lokal, wegwerfbar, nicht in iCloud. Wird nie automatisch gelöscht. Aufgeräumt wird von Hand im Finder.
- Gebraucht wird er nur vom Editor (Starts setzen, würfeln, Peaks, Beats) und von Teletext. Auf der Bühne lädt das Device mit Bank nie eine ganze WAV.
- Der Editor zeigt die Größe (Summe aller Dateien). Ab 10 000 000 000 Byte warnt er.

### 2.6 Sicherung

- Beim Start jedes Node-Prozesses: Ist `library.json` gültig gelesen und anders als die neueste Sicherung, schreibt Node `D/backup/bibliothek-JJJJ-MM-TT-hhmmss.json` **(festgelegt: mit Sekunden)**. Die 10 neuesten bleiben, ältere löscht Node. Eine kaputte Datei wird nie gesichert.
- Zurückholen: von Hand im Finder eine Kopie über `library.json` legen, Device neu laden. Kein Knopf, keine Anzeige.

### 2.7 Session-Datei 2

`D/sessions/<nr>.json`:
```json
{"version": 2, "saved": "2026-10-28T20:15:00.000Z", "state": "<encodeURIComponent(JSON)>"}
```
`state` dekodiert: `{"bankId": 7, "id": "F2RnxZnubCM", "title": "…", "pads": [16 Song-ms], "srcBpm": 99.5, "srcAuto": 0, "bpmConf": 0.42}`

- `bankId` `0` = keine Bank. `id`, `title`, `pads`, `srcBpm`, `srcAuto`, `bpmConf` sind die Kopie für den Fall, dass die Bank fehlt. Gibt es die Bank, gelten Starts und Tempo aus der Bibliothek.
- Weg fallen `favs`, `fav`, `bank`, `locks`, `mem`.
- `.lock` mit PID, Abzweigen bei duplizierter Spur (`newsession`), `stateReady`, atomares Schreiben (400 ms entprellt) bleiben wie heute.

## 3. Node (`ytsampler_node.js`)

### 3.1 Aufgaben

Node ist die Wahrheit für Bibliothek, Snippets, Cache und Analyse. Er schneidet, würfelt für den Editor, lädt herunter, rechnet Peaks und Beats und bedient den Editor.

- **Downloads** werden geteilt in „in den Cache laden“ (Editor: `select`, `fetch`, `fetchall`, `newbank`) und „ins Device laden“ (nur Teletext, schickt `loaded`). Je Weg gilt: Der neueste Wunsch bricht den laufenden `yt-dlp` ab (statt `busy`). Ein Editor-Download bricht nie einen Teletext-Download ab und umgekehrt. Reihenfolge der Editor-Downloads: `select`/`fetch` vor `newbank` vor `fetchall`. Fehlschläge setzen `fail`, `fetchall` überspringt sie.
- **Würfeln** (`roll`, `newbank`) läuft in Node auf der ganzen WAV, mit den Regeln von `randomStart`: Taktanfang bevorzugt, wenn die Beats gültig sind, sonst frei; keine Slice ganz in Stille; kein Start doppelt. Ein Rasterpunkt ohne Beats entfällt, Node kennt die Device-Division nicht **(festgelegt)**. Spanne für die Stilleprüfung: 16 s. `newbank` sortiert die 16 Starts aufsteigend. `roll` hat keine Nachbargrenze.
- **Beats gültig** (für Würfeln, Editor-Einrasten): `videos[v].bpm` gesetzt oder Analyse-Konfidenz ≥ 0,3, wie `tempoTrusted()` in `[js]`. Node trackt mit `bpm` aus der Bibliothek, sonst mit dem Analyse-Tempo, und hebt das Ergebnis (`beats`, `down`) pro Video auf.
- **Basisordner und Umzug** siehe [Migration](#8-migration-1x--200).

### 3.2 HTTP

Server wie heute: `127.0.0.1`, Port 8765–8770. Teletext-Routen (`/`, `/events`, `/key`, `/state`) und `viewState()` bleiben unverändert.

| Route | Was |
|---|---|
| `GET /editor` | `editor.html`, über `pagePath()` nach `D/web/` gespiegelt (eingefrorene Devices). |
| `GET /editor/events` | SSE für den Editor, eigene Client-Liste. |
| `POST /cmd` | Befehle, Antwort JSON. |
| `GET /peaks/<video>` | Waveform des ganzen Tracks. |

**Schutz für `/cmd`**: nur `Content-Type: application/json`. `Host` muss `localhost:<port>` oder `127.0.0.1:<port>` sein, `Origin` ebenso, wenn gesetzt. Body höchstens 64 KB. Antwort HTTP 200 mit `{ok: true, …}` oder `{ok: false, code, text}`. Nur unlesbares JSON → 400, verletzte Schutzregel → 403.

**`GET /peaks/<video>`**: `video` muss `/^[\w-]{11}$/` sein, sonst 400. Ganze WAV fehlt → 404. Sonst `application/octet-stream`: 8 Byte Kopf (Uint32 LE Samplerate, Uint32 LE Blockgröße 256), danach pro 256 Frames Int8 Min, Int8 Max über beide Kanäle (Int16 `>> 8`). Die Dauer folgt aus der Größe. Jedes Mal frisch gerechnet. `Cache-Control: private, max-age=86400`.

### 3.3 Befehle `POST /cmd`

Body `{client, cmd, …}`. `client` ist eine Zufalls-ID pro Seitenaufruf, Node gibt sie in `lib.by` zurück. „aktiv“ = die Bank, die das erste Device gerade hat. Alle Befehle nennen IDs, keine Plätze.

| `cmd` | Felder | Node tut | an `[js]` | Antwort |
|---|---|---|---|---|
| `select` | `id` | prüfen, bei Bedarf sofort schneiden. `wav: false` → Track im Hintergrund in den Cache laden. Ohne Snippets und ohne WAV → `nosnip` | `bank …`, `bankname …` | `{}` |
| `rename` | `id`, `name` (getrimmt, ≤ 100 Zeichen) | Bibliothek | `bankname …`, wenn aktiv | `{}` |
| `duplicate` | `id` | Kopie direkt dahinter, `"<Name> (Kopie)"`, neue ID, Snippet-Dateien kopieren | `bank …` (Kopie wird aktiv) | `{id}` |
| `delete` | `id` | entfernen, verwaisten `videos`-Eintrag mit. War sie aktiv: Nachrücker auf demselben Platz aktiv, war es die letzte, die davor | `bank …` des Nachrückers bzw. `libstate … leer` | `{removed: {bank, at, video: {title, bpm?}}}` |
| `move` | `id`, `to` (1…n) | Bibliothek | `libstate` | `{}` |
| `restore` | `bank: {id, name, video, starts}`, `at`, `video: {title, bpm?}` | nur wenn `id < nextId` und frei, sonst `idtaken`. `videos`-Eintrag zurück, falls er fehlt. Vorhandene Snippets weiterverwenden, sonst schneiden. `nextId` bleibt | `libstate`; war sie aktiv (Editor schickt danach `select`), `bank …` | `{}` |
| `setstart` | `id`, `pad` 0–15, `ms` ≥ 0 ganz | Bibliothek, neu schneiden. Ohne WAV `playonly` | `bank …` nach dem Schneiden, wenn aktiv | `{}` |
| `setstarts` | `id`, `starts[16]` | wie `setstart` (Undo/Redo). Ohne WAV nur, wenn alle Starts in der alten Datei vorkommen | wie oben | `{}` |
| `swap` | `id`, `a`, `b` | Bibliothek, Fächer tauschen (auch ohne WAV) | wie oben | `{}` |
| `roll` | `id`, `pad` | würfeln (3.1), Bibliothek, schneiden. Ohne WAV `playonly` | wie oben | `{ms}` |
| `hit` / `up` | `pad` | — | `padhit <i>` / `padup <i>` | `{}` |
| `search` | `q` | yt-dlp wie `search()`, eigene Trefferliste (Teletext bleibt unberührt). Neue Suche bricht die alte ab (`superseded`). Treffer ohne Dauer fallen weg | — | `{results: [{id, title, dur, long}]}`, `long` = über 10 min |
| `newbank` | `video` | Track laden → Analyse → 16 Starts würfeln → Bank am Ende anlegen (Name = Titel, `bpm` übernehmen, falls Video schon da) → schneiden → aktiv | `bank …` | `{}` sofort, Fortschritt per `job`, am Ende `job` mit `phase: "done"`, `bankId` |
| `tempo` | `video`, `bpm` 30–300 | auf 0,1 runden, `videos[v].bpm` | `bpm <video> <bpm>`, wenn aktiv | `{}` |
| `tempook` | `video` | Analyse-Tempo als `bpm` bestätigen. Kein Analyse-Tempo → `notempo` | `bpm …`, wenn aktiv | `{bpm}` |
| `fetch` | `video` | ganze WAV in den Cache | — | `{}`, Fortschritt per `job` |
| `fetchall` | — | Warteschlange aller fehlenden WAVs | — | `{todo}` |

Ungültige Felder → `badreq`. Kaputte Bibliothek → alle schreibenden Befehle `libbroken` bzw. `libnewer`. `hit`, `up`, `search`, `select` gehen weiter.

### 3.4 SSE `GET /editor/events`

Benannte Events, `data:` ist JSON. Nach dem Verbinden `retry: 1500`, dann `hello`, `lib`, `device`, `cache`, ggf. `beats`. Ping-Kommentar alle 15 s. Bündelung 30 ms wie `pushUi`.

| Event | Inhalt |
|---|---|
| `hello` | `{port, session, track}`. Erneut, wenn sich der Spurname ändert. |
| `lib` | `{rev, by, state: "ok"\|"leer"\|"kaputt"\|"neuer", error?, cache: {bytes, warn}, banks: [{id, name, video, starts, snip, wav}], videos: {<id>: {title, bpm?, fail?}}}`. Immer die ganze Bibliothek, auch bei Wechsel von `snip`/`wav`/`fail` (dann gleiche `rev`). `by` = `client`-ID, `"device"` (Tempo am Device) oder `"extern"`. |
| `device` | `{bankId, nr, video, sel, mode, rev, starts[16], spans[16], teletext: {phase, progress} \| null}` |
| `beats` | `{video, bpm, conf, confirmed, ok, beats: [ms], down}` für den Track der aktiven Bank. `ok` = Beats gültig (3.1). **(festgelegt: `conf`, `confirmed`, `ok` ergänzt, damit der Editor „Tempo stimmt“ und das Einrasten richtig zeigt.)** |
| `play` / `stop` | `{pad, from, to, dur}` (Song-ms) / `{pad}` |
| `job` | `{kind: "fetch"\|"newbank"\|"cut", video?, bankId?, phase, progress, left}` |
| `cache` | `{bytes, warn}`, `warn = bytes ≥ 10 000 000 000`. Beim Verbinden und nach jedem Download. |
| `msg` | `{level: "info"\|"error", code, text}` |

## 4. Device: `[js]` (`ytsampler_main.js`, ES5)

### 4.1 Oberfläche und Parameter

- **Fällt weg** (mit Logik): linker Fav-Block, Suchblock (Suchfeld, Max Length, Suche, Treffer-Menü, Laden, URL), `Lock`, `Shuffle`, `Reroll Pad`, Nudge ◀ ▶. In `[js]`: `NFAV`, `BANKS`, `st.favs/fav/bank/locks`, `pendingFav`, `favTask`, `favSelTarget`, `favName`…`updateFavUI`, `lock()`, Lock-Prüfungen in `sortPads`/`rollAll`, `favinfo`.
- **Bleibt**: Pads, Waveform mit `selinfo`, Division, Base Note, Voices, Rate, Attack, Release, Mode, Rev, Tune/Tonal, Warp/Source BPM/÷2/×2, Grid/Snap, Quant, Volume, Status-Zeile, unsichtbarer Parameter `Session`. `randomStart`/`autoRoll` bleiben für Teletext.
- **Neu, linker Block** (oben nach unten): große Anzeige Banknummer + Name, darunter `Bank` und ◀ ▶, darunter die Status-Zeile. Device-Breite ≈ 1000 (genauer Wert beim Bauen).

| Parameter | Objekt | Verhalten |
|---|---|---|
| `Bank` | `live.numbox` 1–128 | Jeder Schritt → `bankpeek`. Ruht er 350 ms → `banksel <nr>`. Über der letzten Bank: Anzeige „leer“, nichts lädt. CC 0 = Bank 1 … CC 127 = Bank 128. |
| `Bank Prev` / `Bank Next` | `live.text` mode 0 → `[t b]` | Ziel = angezeigter Platz ± 1, bleibt an der ersten/letzten Bank stehen. Auch über 128 hinaus (Regler bleibt auf 128, Anzeige zeigt die echte Nummer). 350 ms Ruhe wie der Regler. |

Alle 26 alten Namen fallen weg: `Fav Bank`, `Fav Select`, `Fav Slot 1`–`16`, `Fav Prev`, `Fav Next`, `Fav Add`, `Fav Update`, `Fav Delete`, `Search`, `Load Result`, `Load URL`, `Max Length`, `Lock`, `Shuffle`, `Reroll`, `Nudge Left`, `Nudge Right`.

`bankpeek`, `banksel`, Prev/Next und `bpmset` brauchen `if (!ready()) return;`. Was von Node kommt, nicht.

### 4.2 Bank laden

Auf `bank <id> <nr> <bpm> <s×16> <l×16> <songdur> <video> <pfad…>`:
1. Sofort übernehmen: `st.bankId`, `st.id` (= `video`), Titel (kommt mit `bankname`), Starts, Längen, `songDur`, `bpm` (> 0 → `srcBpm`, `srcAuto = 0`; 0 → `srcAuto = 1`). Anzeige Nummer + Name. `Bank` per `set` auf `min(nr, 128)` (löst nichts aus).
2. Alle klingenden Stimmen in beiden `poly~` mit `gateoff 5` ausblenden.
3. Nach ≈ 10 ms per `Task`: `replace <pfad>` an `buffer~`. Kommt vorher ein neues `bank`, ersetzt dessen Task den alten (letzte Wahl gewinnt).
4. Node schickt danach die Analyse (`tuning`, `tempo`, `silence`, `analysisready`). `[js]` fordert wie heute `analyzeall` und `beattrack` an.

Dieselbe `id` noch einmal (neu geschnitten) läuft genauso. `nr 0` = Bank steht nicht in der Bibliothek.

Set öffnen: `state()` liest `bankId`. `> 0` → `bankopen <bankId>`, Node antwortet `bank …` (Platz neu berechnet, `Bank` aus dem Set wird ignoriert) oder `bankgone`. `0` → wie heute `load <st.id>` mit den Starts der Kopie, Anzeige „keine Bank“.

### 4.3 Song-ms und Buffer-ms

Mit Bank rechnet `[js]` intern in Song-ms wie heute. Umgerechnet wird nur an den Ausgängen.

| Stelle | Regel |
|---|---|
| `durMs` | Länge des Buffers: 256 000 mit Bank. Für `xAt`/`timeAt` und Klammern gilt `songDur`. |
| `effStart(i)` | mit Bank `= starts[i]`, kein Einrasten. Grid/Snap verschieben nichts. Snap wirkt nur ohne Bank. |
| `playRange(i)` | wie heute in Song-ms, dann begrenzt auf `[start_i, start_i + len_i]`. |
| `trigger` → `pos`/`wplay` | Buffer-ms: `i × 16000 + (t − start_i)`. |
| Overlay | `grid dur 256000`; `grid beats`/`grid bars` (Takt-Einsen) nur Schläge in `[start_i, start_i + len_i]`, pro Fach umgerechnet; `grid pads <sel> <16 × i×16000>` (die 16 Grenzen). |
| `wsel` | Buffer-ms. |
| Infozeile, `analyze`, `analyzeall`, `beattrack`, `padinfo`, `bankstate`, Session-Kopie | Song-ms, unverändert. |

Ohne Bank (Teletext, `bankgone`, 1.x-Set) gilt alles wie in 1.3.x: Buffer = ganzer Track, Buffer-ms = Song-ms.

### 4.4 Spielen

- **Länge**: Division, Rate und Warp wie heute, nie über das Snippet-Ende.
- **Hold** spielt bis zum Snippet-Ende und blendet dort in 10 ms aus **(festgelegt: 10 ms, Konstante `SNIP_FADE_MS`)**.
- **Hold rückwärts** spielt das Fach vom Snippet-Ende zum Start. Vor dem Start gibt es nichts.
- **Warp+Grid**: Slice-Ende folgt den Schlägen der Quelle wie heute (`timeAt(xAt(start)+n)`), begrenzt auf das Snippet-Ende. Die Stimme bekommt `rel` so, dass sie vor dem Fach-Ende ausgeblendet ist, auch bei Timestretch.
- **Tune** wie heute. Das Analysefenster darf vor den Snippet-Start reichen (es liest die Song-Analyse). Hold: 4 s ab Start (`HOLD_ANALYSIS`).
- **Tempo**: ½×, 2×, Zahlenfeld wie heute. Die gleiche Zahl im Feld bestätigt (die `abs < 0.01`-Sperre fällt weg). Jede Korrektur schickt `bpmset <video> <bpm>` und fordert `beattrack` neu an. Starts bleiben stehen.
- Mit Bank fallen weg: Einrasten, `silence`-Nutzung, Würfeln.

### 4.5 Anzeige und Status-Zeile

| Lage | Große Anzeige | Status-Zeile | Pads |
|---|---|---|---|
| Bank aktiv | `<nr>` + Name | wie heute | spielen |
| Drehen/Prev/Next | Ziel-Nr + Name (`bankpeek`), über der letzten: „leer“ | — | alte Bank spielt |
| keine Bank | „keine Bank“ + Videotitel | wie heute | spielen |
| gespeicherte Bank gelöscht | „keine Bank“ | kurz „Bank gelöscht“ | Session-Kopie |
| nicht ladbar | springt zurück auf klingende Bank | kurz „nicht ladbar“ | alte Bank spielt |
| Bibliothek leer | „Bibliothek leer“ | „Bank im Editor anlegen“ | stumm |
| Bibliothek kaputt | „Bibliothek kaputt“ | „Speichern gesperrt“ | stumm |
| Bibliothek neuer | „Bibliothek aus neuerer Version“ | — | stumm |
| Analyse fehlt | `<nr>` + Name | „Analyse fehlt – Bank im Editor neu schneiden“ | spielen, ohne Tune/Grid |

„kurz“ = 2 s, danach wieder die normale Zeile **(festgelegt)**. „stumm“ = Pad-Anschläge werden ignoriert und der Buffer wird geleert.

### 4.6 Rückmeldung an Node

- `bankstate` aus `sendPadMarks()`, nur wenn sich der String geändert hat.
- `playing`/`playstop` aus `trigger`/`noteoff`, in Song-ms.
- `trackname`: `new LiveAPI(cb, "this_device canonical_parent")`, Eigenschaft `name` beobachten, nach `init`.

## 5. Editor (`editor.html`)

Ein dunkles, ruhiges Arbeits-Dashboard, Vorlage ist [`prototype/editor-layout.html`](prototype/editor-layout.html) (nur Layout, der Code ist Wegwerfcode). Nebensachen als Slide-in oder Toast. Kein Hell/Dunkel-Umschalter, keine frei anordnenden Panels. Eine Datei, keine externen Abhängigkeiten.

### 5.1 Layout

- **Kopfzeile**: Bibliothek ein-/ausklappen · ◀ ▶ mit „Nr / Anzahl + Bankname“ · ↶ ↷ · „automatisch gespeichert“ · „steuert: <Spurname>“ · „Video suchen“ (⌘K).
- **Links Bibliothek**: senkrechte Liste. Pro Zeile Nummer, Name, darunter klein Videotitel · BPM. Aktive Bank hervorgehoben. Marken: „nur spielbar“, „nicht ladbar“, „lädt n %“, Fehlergrund (`fail`). Pro Zeile bei Hover und an der aktiven Bank drei Icons: umbenennen, duplizieren, löschen. Im Fuß: „Alle nachladen“ (nur wenn eine Bank `wav: false` hat) und die Cache-Größe, ab 10 GB als Warnung „Cache über 10 GB – im Finder aufräumen“ **(festgelegt: Ort im Listenfuß)**.
- **Rechts oben Waveform** des ganzen Tracks (`/peaks`): Taktlinien, die „1“ betont, ab 4× Zoom Schlaglinien. 16 Marker mit Pad-Nummer. Gewähltes Pad farbig, seine gespielte Länge (`device.spans`) als Fläche hinter dem Marker. Abspielkopf aus `play`/`stop`.
- **Rechts unten Pads** 4×4, Pad 1 unten links. Jedes Pad: Nummer, Startzeit, Mini-Balken mit seiner Lage im Track, Würfel-Icon bei Hover.
- **Detailspalte** neben den Pads: Nummer, Start, „Länge: vom Device“, Video · BPM, „Neues Snippet“, „Anspielen“. Dazu das Tempo: Zahlenfeld, ½×, 2× und „Tempo stimmt“ (nur sichtbar, wenn nicht bestätigt) **(Frage 2)**.
- **Größen**: Breite der Bibliothek ziehbar, Bibliothek einklappbar, Grenze Waveform/Pads verschiebbar. Ob das gespeichert wird: **(Frage 1)**.

### 5.2 Bedienung

| Aktion | Wie | Befehl |
|---|---|---|
| Bank wählen | Klick in der Liste, ◀ ▶, ↑/↓ | `select` |
| umbenennen | Icon oder Doppelklick, Enter übernimmt, Esc bricht ab | `rename` |
| duplizieren | Icon. Kopie direkt darunter, wird aktiv | `duplicate` |
| löschen | Icon, ohne Rückfrage. Toast 5 s „Bank … gelöscht · Rückgängig“ | `delete` |
| verschieben | Drag in der Liste | `move` |
| suchen | ⌘K oder Knopf → Slide-in von rechts, Treffer mit Vorschaubild (`https://i.ytimg.com/vi/<id>/mqdefault.jpg`), Titel, Dauer, bei `long` „nur 10 min“ | `search` |
| neue Bank | Treffer anklicken oder auf die Pads ziehen (Panel gleitet zur Seite, Pads zeigen Ablagefläche). Immer neue Bank am Ende | `newbank` |
| Pad anspielen | Klick (pointerdown/-up). Wählt das Pad, Waveform scrollt zum Marker | `hit` / `up` |
| Pads tauschen | Pad auf Pad ziehen | `swap` |
| Start setzen | Marker ziehen, rastet auf Schläge (`beats.ok`), mit Alt frei. Sind die Beats nicht gültig, läuft er frei. Blase zeigt die Zeit. Gesendet wird beim Loslassen | `setstart` |
| neues Snippet | Würfel-Icon oder Knopf | `roll` |
| Zoom | 1×/4×/16× oder ⌘/Strg + Mausrad, horizontal scrollen | — |
| Tempo | Zahlenfeld, ½×, 2× / „Tempo stimmt“ | `tempo` / `tempook` |
| Track laden | Knopf bei „nur spielbar“ | `fetch` |
| alle nachladen | Knopf im Listenfuß | `fetchall` |

- Editor und erstes Device zeigen immer dieselbe Bank: Der Editor folgt `device.bankId`.
- **„nur spielbar“** (`wav: false`): umbenennen, verschieben, duplizieren, löschen, tauschen, anspielen gehen. Marker und „Neues Snippet“ sind gesperrt. Waveform-Fläche zeigt „Track fehlt“ und „Track laden“. Beim Wählen lädt Node den Track ohnehin im Hintergrund.
- **keine Bank** (`device.bankId 0`): Waveform und Pads des Device-Tracks sichtbar und anspielbar, nicht bearbeitbar, Hinweis „keine Bank“.
- **Bibliothek kaputt/neuer**: Fehlerleiste mit dem Text, alles Schreibende gesperrt.
- **kein Device** (SSE getrennt): ganze Fläche ausgegraut, Hinweis „Kein Device – YT Sampler in Live laden“. Der Browser verbindet sich selbst neu.
- **anderes Device**: Ändert sich `hello.session` nach dem Neuverbinden, Toast „steuert jetzt <Spurname>“. Die Historie leert sich.

### 5.3 Undo/Redo

- Ein Schritt ist jede Änderung an Pads und Bibliothek: Start setzen, neues Snippet, Pads tauschen, umbenennen, verschieben, duplizieren, neue Bank, löschen. Kein Schritt: Bankwechsel, Tempo.
- ⌘Z / ⇧⌘Z, Knöpfe ↶ ↷ in der Kopfzeile. Tooltip nennt den Schritt, ohne Schritt ausgegraut. In Eingabefeldern gilt das Undo des Browsers.
- Linear, 100 Schritte, nur im Browser. Neu laden leert sie. Zwei Fenster haben je eine eigene Historie.
- Undo/Redo wählt die betroffene Bank (`select`, wenn nicht aktiv) und zeigt einen Toast „Rückgängig: Start Pad 3 verschoben“ bzw. „Wiederholt: …“.

| Schritt | Undo | Redo |
|---|---|---|
| Start setzen, neues Snippet | `setstarts` alt | `setstarts` neu |
| Pads tauschen | `swap` gleiches Paar | `swap` |
| umbenennen | `rename` alt | `rename` neu |
| verschieben | `move` auf alten Platz | `move` auf neuen Platz |
| duplizieren, neue Bank | `delete` | `restore` aus der `delete`-Antwort |
| löschen | `restore` mit `removed` | `delete` |

- Schlägt Undo/Redo fehl (`playonly`, `nobank`, `idtaken`), zeigt der Editor den Text und lässt den Schritt stehen.
- Die Historie leert sich (Undo/Redo grau, Hinweis „Bibliothek wurde anderswo geändert“), wenn ein `lib` mit **neuer `rev`** kommt und `by` weder die eigene `client`-ID noch `"device"` ist. `lib` mit gleicher `rev` (Statuswechsel) leert nie.

## 6. Protokolle

Max-Regeln für alle Nachrichten Node ↔ `[js]`: Neue Selektoren laufen über den Rest-Ausgang des Node-Routers an die gleichnamige `[js]`-Funktion, nicht durch den UI-Router. Freitext (Name, Pfad, Grund) steht am Ende und wird mit `arrayfromargs(arguments).slice(k).join(" ")` zusammengesetzt. Namen laufen durch `clean()`. Fehlende Video-ID = `-`. Rein numerische Video-IDs würden zur Zahl (bekannte Grenze, wie heute).

### 6.1 Node → `[js]`

| Nachricht | `[js]` tut |
|---|---|
| `bank <id> <nr> <bpm> <s×16> <l×16> <songdur> <video> <pfad…>` | Bank laden (4.2). `bpm 0` = nicht bestätigt, `nr 0` = nicht in der Bibliothek. **(festgelegt: Songdauer und Video stecken in `bank`, eine eigene Nachricht `snips` und `loaded` für Bänke gibt es nicht.)** |
| `bankname <id> <name…>` | Anzeige, nur bei `id == st.bankId` oder der Bank, die gerade lädt |
| `bankgone <id>` | `bankId = 0`, `load <st.id>` mit Session-Kopie, „keine Bank“ + kurz „Bank gelöscht“ |
| `bankfail <id> <grund…>` | Ladewunsch verwerfen, Anzeige zurück auf die klingende Bank + kurz „nicht ladbar“ |
| `libstate <anzahl> <nr> <ok\|leer\|kaputt\|neuer>` | `Bank` per `set` auf `min(nr, 128)`, Anzeige nach 4.5. `leer`/`kaputt`/`neuer` → stumm |
| `bankpeek <nr> <anzahl> <name…>` | Anzeige beim Drehen. `nr > anzahl` = „leer“ |
| `bpm <video> <bpm>` | nur bei Video der aktiven Bank: `srcBpm = bpm`, `srcAuto = 0`, `beattrack` neu. Kein `bpmset` zurück |
| `padhit <i>` / `padup <i>` | gibt es schon |
| `loaded <pfad> <ms> <id> <titel…>` | nur Teletext und `bankgone`: wie heute, `bankId = 0`, `buffer~ replace` jetzt aus `[js]` |
| `loadfail <video> <grund…>` | Teletext-Download gescheitert (ersetzt die reine `status`-Meldung) |
| `tuning`, `tempo`, `analysisready`, `silence`, `padinfo`, `beatsclear`, `beatsadd`, `beatsdone`, `needsession`, `newsession`, `state`, `statenone`, `status` | unverändert, Song-ms |

### 6.2 `[js]` → Node

| Nachricht | Wann | Node tut |
|---|---|---|
| `bankstate <bankId> <video\|-> <sel> <mode> <rev> <s×16> <w×16>` | `sendPadMarks()`, nur bei Änderung. `s` Song-Starts, `w` = gespielte Länge in Song-ms (gekappt auf `l`) | SSE `device` |
| `bankpeek <nr>` | jeder Schritt an `Bank` | `bankpeek …` zurück |
| `banksel <nr>` | `Bank` ruht 350 ms, oder Prev/Next nach 350 ms | `bank …`, `bankfail` oder nichts (über der letzten Bank) |
| `bankopen <bankId>` | `state()` mit `bankId > 0` | `bank …` oder `bankgone` |
| `bpmset <video> <bpm>` | ½×, 2×, Zahlenfeld | steht das Video in der Bibliothek: `videos[v].bpm`, SSE `lib` mit `by: "device"`. Sonst nichts |
| `playing <pad> <von> <bis> <dauer>` / `playstop <pad>` | `trigger` / `noteoff` | SSE `play` / `stop` |
| `trackname <name…>` | Spurname geändert | SSE `hello` |
| `session`, `savestate`, `key`, `load`, `analyze`, `analyzeall`, `beattrack` | wie heute | wie heute |

`favinfo` fällt weg.

### 6.3 `[js]` → UI (Ausgang 2) und neuer Ausgang

| Nachricht | Ziel |
|---|---|
| `shownr <text>`, `showname <text…>` | neue Kommentare im linken Block (Router-Einträge, `set`) **(festgelegt)** |
| `status`, `selinfo`, `wsel`, `grid …`, `padflash`, `padlight`, `padsel` | wie heute |
| `grid bars <ms…>` | neu, Blöcke à 200, nach `grid beats` |
| Ausgang 4: `replace <pfad>` | neu, direkt an `buffer~` **(festgelegt: eigener Ausgang statt Router)** |

Router `memclear`, `memadd`, `lockset` sind tot und fallen weg. Node-Router: `rclear`, `radd`, `needmaxlen` fallen mit dem Suchblock weg, `loaded` geht nicht mehr an `buffer~`, sondern über den Rest an `[js]`.

### 6.4 An die Stimmen

Unverändert (`target`, `env`, `rel`, `gateoff`, `pos`, `wplay`). Positionen sind Buffer-ms. Die Stimmen-Patches (`ytvoice.maxpat`, `ytwarpvoice.maxpat`) ändern sich nicht.

### 6.5 Fehlercodes (`/cmd`-Antwort und SSE `msg`)

| `code` | Text | Wann |
|---|---|---|
| `nobank` | Bank gibt es nicht mehr | ID fehlt |
| `libbroken` | Bibliothek kaputt – Speichern gesperrt | Prüfung schlägt fehl |
| `libnewer` | Bibliothek aus neuerer Version | `format > 1` |
| `libbusy` | Bibliothek belegt | Sperre > 1 s |
| `writefail` | Speichern fehlgeschlagen: … | Schreibfehler `library.json` |
| `playonly` | Track fehlt – nur spielbar | Start setzen, würfeln, `setstarts` ohne WAV |
| `cutfail` | Snippets schneiden fehlgeschlagen: … | Lese-/Schreibfehler beim Schneiden |
| `nosnip` | Snippets fehlen – Bank nicht ladbar | ohne Snippets und ohne WAV (ans Device als `bankfail`) |
| `idtaken` | Bank existiert schon | `restore` mit vergebener ID |
| `notempo` | Kein Tempo erkannt | `tempook` ohne Analyse-Tempo |
| `superseded` | Neuere Suche läuft | ältere `search` |
| `searchfail` | Suche fehlgeschlagen: … | yt-dlp-Fehler (`errMsg`) |
| `loadfail` | Download fehlgeschlagen: <Titel> – <Grund> | nur SSE `msg`, setzt `fail` |
| `badreq` | Ungültiger Befehl | Feld fehlt, falscher Typ, `pad` außerhalb 0–15, `starts` ≠ 16 |

## 7. Fehlerfälle

| Fall | Device | Editor |
|---|---|---|
| Bibliothek fehlt | „Bibliothek leer“, stumm | leere Liste, Hinweis „Video suchen“ |
| Bibliothek leer (letzte Bank gelöscht) | wie oben | wie oben |
| Bibliothek kaputt / iCloud noch nicht geladen | „Bibliothek kaputt“, stumm, nichts wird geschrieben | Fehlerleiste, Schreiben gesperrt |
| Bibliothek neuer | „Bibliothek aus neuerer Version“, stumm | Fehlerleiste |
| Sperre belegt > 1 s | — | Toast `libbusy`, Schritt nicht in der Historie |
| Snippets fehlen, WAV da | Node schneidet sofort, lädt | Marke `cutting` |
| Snippets fehlen, WAV fehlt | `bankfail`, alte Bank spielt weiter | „nicht ladbar“, „Track laden“ |
| Snippets veraltet | sofort neu schneiden, dann laden | `stale` → `cutting` |
| Video bei YouTube weg | Bank spielt weiter aus den Snippets | `fail`-Grund, „nur spielbar“ |
| Analyse fehlt | spielt ohne Tune/Grid/Auto-Tempo, Status | — |
| Gespeicherte Bank gelöscht | Session-Kopie über `load` (braucht ganze WAV oder Internet), „keine Bank“ + „Bank gelöscht“. Geht auch das nicht: `loadfail`, Status wie heute | „keine Bank“ |
| Aktive Bank gelöscht | Nachrücker lädt, letzte → die davor, einzige → leer | dasselbe |
| Aktive oder andere Bank verschoben | nur Nummer und `Bank` springen, nichts lädt | — |
| Download im Editor scheitert | — | `msg` + Marke, `fetchall` überspringt |
| Mehrere Devices | jedes lädt selbst, folgt `watchFile` | steuert nur das erste |
| Tempo am zweiten Device | — | kommt als `extern`, Historie leert sich (bekannte Grenze) |
| Max-Symbol-Fallen | Namen durch `clean()`, Freitext am Ende | — |

## 8. Migration 1.x → 2.0.0

1. **Datenordner** (Node, beim Start): Gibt es iCloud Drive, aber noch kein `D`, wird `D` angelegt und jeder Eintrag aus `~/Music/YTSampler/` außer `cache/` und `chrome-profile/` per `rename` nach `D` verschoben. Existiert ein Ziel schon, bleibt der Eintrag liegen (zwei Devices starten gleichzeitig). Schlägt `rename` fehl, arbeitet Node mit `~/Music/YTSampler/` weiter und meldet „Umzug nach iCloud fehlgeschlagen“ im Status **(festgelegt)**.
2. **Session-Datei**: Beim `session`-Befehl mit `version` 1 oder ohne `version` kopiert Node die Datei einmal nach `sessions/<nr>.v1.json` (falls nicht vorhanden) und reicht `state` weiter. `[js]` liest nur `bankId`, `id`, `title`, `pads`, Tempo. Ohne `bankId` → `0`: „keine Bank“, klingt wie gespeichert. Das nächste Autosave schreibt `version: 2`. Die `.v1.json` wird nie gelöscht.
3. **Favoriten** werden nicht übernommen. Eine `library.json` entsteht erst mit der ersten Bank aus dem Editor.
4. **MIDI-Mappings** auf die 26 alten Parameter gehen verloren. Der Nutzer mappt `Bank`, `Bank Prev`, `Bank Next` einmal neu.
5. **Teletext** zeigt bei `FAV` künftig nichts mehr (`ui.fav` fällt weg). Sonst bleibt Teletext gleich und lädt ganze Videos als „keine Bank“ in den lokalen Cache.
6. **Doku**: `CLAUDE.md` (Dateien, Signalfluss, Protokolle, Ablage, Fallen inkl. `AN.VERSION`, „Offen“) und `README.md` (Bedienung 2.0, „Geladen lassen“, Breite) werden mit 2.0.0 nachgezogen.

## 9. Testbarkeit

**In der Session prüfbar** (Testskripte unter `tools/tests/`, laufen mit `node`, werden nicht nach Live kopiert):
- `node --check` auf alle `.js`, grep auf ES6 in `ytsampler_main.js`, `ytpads.js`, `ytgrid.js`.
- `check()` auf alle `.maxpat`, Sync `.maxpat`/`.amxd`.
- **Bibliothek**: lesen/prüfen (jede Kaputt-Regel), Schreiben mit Sperre, zwei Prozesse gleichzeitig (Child-Processes), übernommene Sperre bei toter PID, `nextId`/`restore`/`idtaken`, `videos` entfernen und zurückholen, unbekannte Felder bleiben, Backups (10, keine kaputten).
- **Snippets**: Schneiden aus erzeugten WAVs (bekannter Inhalt pro Fach), kürzeres letztes Snippet mit Stille, Zusammensetzen ohne WAV bei `swap`/`duplicate`, `playonly` sonst, Entprellen, Aufräumen nach 7 Tagen, `.chroma`-Kopie.
- **HTTP/SSE**: Server auf einem freien Testport (nie 8765, solange Live läuft), alle `/cmd`-Befehle mit Attrappe für `max-api`, Schutzregeln (Content-Type, Host, Origin, 64 KB), `/peaks`-Format, SSE-Reihenfolge beim Verbinden, `by`/`rev`.
- **`[js]`** mit Attrappen (`outlet`, `Task`, `arrayfromargs`, `post`, `this.patcher.getnamed`, `LiveAPI`): `bank` → Fade, `replace` nach dem Task, letzte Wahl gewinnt; Song→Buffer-Umrechnung in `pos`/`wplay`; Klammer am Snippet-Ende für Trigger, Hold, Hold rückwärts, Warp+Grid; Overlay-Nachrichten (`dur`, `beats`, `bars`, `pads`) in Buffer-ms; `bankstate` nur bei Änderung; Prev/Next an den Enden und über 128; `ready()`-Sperren; Teletext-Weg unverändert.
- **Analyse**: erzeugte WAVs mit bekanntem Tempo/Beats/„1“, Ergebnis aus Bank-Ordner gleich wie aus `cache/`; alte `.chroma`-Version bleibt lesbar.
- **Editor**: `editor.html` im Headless-Browser gegen einen Attrappen-Server (SSE + `/cmd` mit Aufzeichnung): Layout, Marker ziehen mit/ohne Einrasten, Undo/Redo-Tabelle, Historie leeren nur bei fremder neuer `rev`, „nur spielbar“, „keine Bank“, kein Device.

**Prüft der Nutzer in Live** (nach `deploy.sh`):
- Device lädt ohne Fehler im Max-Fenster, Breite und Anzeige stimmen, Grid-Linien und 16 Grenzen liegen deckungsgleich auf der Snippet-Waveform.
- Bankwechsel klickfrei und ohne Sprung, auch bei Hold und Warp. Snippet-Ende hörbar sauber.
- Tune, Warp, Warp+Grid klingen wie in 1.3.
- `Bank` per MIDI-CC, Prev/Next, 350 ms Ruhe.
- Editor steuert das Device, Pad-Anschlag hörbar, Abspielkopf läuft, „steuert: <Spurname>“ stimmt (`LiveAPI`).
- Set speichern, Bank im Editor verschieben/löschen, Set wieder öffnen.
- iCloud-Umzug, „Geladen lassen“, Bühne ohne Internet.

## 10. Bau-Tickets

Regeln: Jedes Paket läuft in einer eigenen Worktree-Session, gemergt und released wird nur in der Master-Session. `YT Sampler.maxpat`/`.amxd` fasst **nur Paket 7** an. Pakete, die dieselbe Datei ändern, laufen nacheinander. Empfehlung an die Master-Session: Paket 1 als 1.3.x releasen, die Pakete 2–6 auf einen gemeinsamen Zweig (z. B. `v2`) mergen, ohne Release, weil sie einzeln das laufende 1.x-Device verändern würden (Datenordner). Paket 7 bringt 2.0.0.

| # | Paket | parallel? |
|---|---|---|
| 1 | Grid-Overlay-Fehler | ja, mit 2 und 5 |
| 2 | Node: Datenablage und Bibliothek | ja, mit 1, 5, 6 |
| 3 | Node: Snippets, Analyse, Würfeln, Downloads | nach 2 (gleiche Datei), parallel zu 5 und 6 |
| 4 | Node: HTTP, `/cmd`, SSE, Peaks, Device-Nachrichten | nach 3 (gleiche Datei), parallel zu 5 und 6 |
| 5 | Editor `editor.html` | ja, ab sofort, gegen Attrappe |
| 6 | Device-Logik `[js]` und Overlay-Takte | nach 1 (`ytgrid.js`), parallel zu 2–5 |
| 7 | Patch, Integration, Doku → 2.0.0 | allein, nach 1–6 |

### Paket 1: Grid-Overlay-Fehler
- **Ziel**: Das Overlay bekommt seine Daten. Der UI-Router entfernt `grid`, an `ytgrid.js` kommen `clear`, `dur …`, `beats …`, `down …`, `show …`, `pads …` an. Lösung ohne Patch-Änderung: in `ytgrid.js` `function anything()` ergänzen, das `grid` mit `messagename` und den Argumenten aufruft. `grid()` bleibt.
- **Dateien**: `ytgrid.js`.
- **Abhängigkeiten**: keine.
- **Abnahme**: ES5-grep, `node --check`; Test mit jsui-Attrappe (`messagename`, `mgraphics`): nach `dur`/`beats`/`down`/`show 1` zeichnet `paint()` Linien. Nutzer: in Live mit Grid an sind Takt-/Beatlinien und Pad-Marken über der Waveform sichtbar, deckungsgleich, durchsichtig, Klicks gehen durch. `CLAUDE.md`: Eintrag unter „Offen“ entfernen. Release 1.3.5.

### Paket 2: Node – Datenablage und Bibliothek
- **Ziel**: Abschnitte 2.1, 2.2, 2.6, 2.7, 8.1, 8.2. Basisordner D/L, Umzug, `library.json` lesen/prüfen/schreiben mit Sperre und `fsync`, `watchFile` mit eigener `rev`, Vorgänge (anlegen, umbenennen, duplizieren, löschen inkl. `videos`, verschieben, `restore`, Starts setzen, tauschen, Tempo) als reine Funktionen mit Fehlercodes, Backups, Session v2 mit `.v1.json`-Kopie, `favinfo`/`ui.fav` entfernen.
- **Dateien**: `ytsampler_node.js`, `tools/tests/`.
- **Abhängigkeiten**: keine.
- **Abnahme**: Tests aus Abschnitt 9 „Bibliothek“ und Migration (Umzug in einem Temp-HOME, Session 1 → `.v1.json`). `node --check`.

### Paket 3: Node – Snippets, Analyse, Würfeln, Downloads
- **Ziel**: Abschnitte 2.3, 2.4, 2.5, 3.1. Schneiden (WAV schreiben, `.json` mit `dur`, Zusammensetzen ohne WAV, Entprellen, Aufräumen, Zustand `snip`/`wav`/`fail`), `.chroma` ablegen und aus D lesen, abwärtskompatibler Leser, Neurechnen bei fehlender Analyse, Würfeln in Node (`randomStart`-Regeln), Beats pro Video aufheben und `ok` berechnen, Downloads teilen (Cache vs. Device) mit Abbruch je Weg und Warteschlange, Cache-Größe.
- **Dateien**: `ytsampler_node.js`, `tools/tests/`.
- **Abhängigkeiten**: Paket 2.
- **Abnahme**: Tests aus Abschnitt 9 „Snippets“ und „Analyse“, Download-Abbruch mit Attrappe für `yt-dlp`.

### Paket 4: Node – HTTP, `/cmd`, SSE, Peaks, Device-Nachrichten
- **Ziel**: Abschnitte 3.2–3.4, 6.1, 6.2 (Node-Seite), 6.5. Routen `/editor`, `/editor/events`, `/cmd`, `/peaks`, Schutzregeln, alle Befehle, SSE-Events, Nachrichten an `[js]` (`bank`, `bankname`, `bankgone`, `bankfail`, `libstate`, `bankpeek`, `bpm`, `loadfail`) und Handler für `bankstate`, `bankpeek`, `banksel`, `bankopen`, `bpmset`, `playing`, `playstop`, `trackname`. Spiegelung von `editor.html` nach `D/web/`.
- **Dateien**: `ytsampler_node.js`, `tools/tests/`.
- **Abhängigkeiten**: Paket 3. `editor.html` muss für die Route nicht fertig sein.
- **Abnahme**: Tests aus Abschnitt 9 „HTTP/SSE“ auf einem Testport, dazu ein Ablauf mit `max-api`-Attrappe: `banksel` → `bank` mit richtigen Längen, Pfad, Songdauer; Löschen der aktiven Bank → Nachrücker.

### Paket 5: Editor
- **Ziel**: Abschnitt 5 vollständig in `editor.html`, gegen Protokoll 3.2–3.4. Eine Datei, ES2020 erlaubt, keine CDN-Abhängigkeit. Dazu eine Attrappe des Servers (SSE + `/cmd`) für Tests.
- **Dateien**: `editor.html`, `tools/tests/editor_mock.js` (o. ä.).
- **Abhängigkeiten**: nur diese Spec. Fragen 1 und 2 müssen beantwortet sein.
- **Abnahme**: Headless-Tests aus Abschnitt 9 „Editor“, Screenshots von normal, „nur spielbar“, „keine Bank“, „kaputt“, „kein Device“. Nutzer schaut einmal im Browser gegen die Attrappe drauf.

### Paket 6: Device-Logik `[js]` und Overlay-Takte
- **Ziel**: Abschnitt 4 und 6.1–6.3 auf der `[js]`-Seite. Favoriten, Locks, Suche, Nudge, Reroll, Shuffle entfernen; Bank laden mit Fade und `replace` über Ausgang 4; Song/Buffer-Umrechnung; Klammer am Snippet-Ende; `effStart` fest mit Bank; Prev/Next/`Bank` mit 350 ms, Enden, > 128; Anzeige und Status nach 4.5; `bankstate`, `playing`, `playstop`, `trackname`; `bpmset` und bestätigen mit gleicher Zahl; `state()`/`save()` für Session v2. In `ytgrid.js`: `grid bars` für die Takt-Hervorhebung statt Index.
- **Dateien**: `ytsampler_main.js`, `ytgrid.js`, `tools/tests/`.
- **Abhängigkeiten**: Paket 1 (`ytgrid.js`). Protokoll aus dieser Spec, nicht der Node-Code.
- **Abnahme**: ES5-grep, `node --check`, Tests aus Abschnitt 9 „`[js]`“ mit Attrappen. Der Teletext-Weg verhält sich in der Simulation wie 1.3.4.

### Paket 7: Patch, Integration, Doku → 2.0.0
- **Ziel**: Abschnitt 4.1 und 6.3 im Patch: linken Fav-Block, Suchblock, `Lock`, `Shuffle`, `Reroll`, Nudge entfernen; `Bank` (`live.numbox` 1–128), `Bank Prev`/`Bank Next` (`live.text` + `[t b]`), Kommentare für `shownr`/`showname`, Status-Zeile nach links; UI-Router um `shownr showname` erweitern, `memclear memadd lockset` entfernen; Node-Router ohne `rclear radd needmaxlen`, `loaded` nicht mehr an `buffer~`; `[js]` Ausgang 4 → `buffer~`; `devicewidth` ≈ 1000. Danach Integration aller Pakete, `CLAUDE.md` und `README.md` (8.6).
- **Dateien**: `YT Sampler.maxpat`, `YT Sampler.amxd`, `CLAUDE.md`, `README.md`, ggf. kleine Anpassungen in `ytsampler_main.js`/`ytsampler_node.js`.
- **Abhängigkeiten**: Pakete 1–6. Läuft allein.
- **Abnahme**: `check()` ohne ungültige Verbindungen, Sync `.maxpat`/`.amxd`, alle Tests aus `tools/tests/` grün. Dann `deploy.sh`, und der Nutzer prüft die Liste „Prüft der Nutzer in Live“ aus Abschnitt 9. Erst danach `release.sh 2.0.0`.

## Offene Fragen

1. **Layout-Größen merken?** Breite der Bibliothek, eingeklappt ja/nein und die Grenze Waveform/Pads. Empfehlung: ja, pro Browser im `localStorage`, ohne Knopf.
2. **Tempo im Editor**: Reicht in der Detailspalte dasselbe wie am Device (Zahlenfeld, ½×, 2×) plus „Tempo stimmt“? Empfehlung: ja.
