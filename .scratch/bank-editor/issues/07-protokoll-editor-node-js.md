# Protokoll Editor ↔ Node ↔ `[js]`

Type: grilling
Status: resolved
Blocked by: 09, 11

## Question

Wie sehen die Nachrichten zwischen Editor, Node und `[js]` aus, genau genug zum Bauen?

- **Befehle aus dem Editor** (`POST /cmd`), abgeleitet aus [Editor-Layout](03-editor-layout.md): Bank wählen, umbenennen, duplizieren, löschen, verschieben, suchen, Treffer als neue Bank, Pad anspielen, Pads tauschen, Start setzen, ein Pad neu würfeln, alle fehlenden WAVs nachladen, dazu Undo/Redo. Welche erledigt Node allein (Bibliothek), welche gehen an `[js]`?
- **Zustandsmeldung von `[js]`** (`bankstate`) und was der SSE-Strom dem Editor schickt.
- **Format von `/peaks/<id>`.**
- **Erstes Device:** Es ist das, welches Port 8765 zuerst belegt, nicht die erste Spur. Wird das erste Device neu geladen, während ein zweites läuft, landet das zweite auf 8765. Reicht das, oder braucht der Editor einen Hinweis, welches Device er gerade steuert?
- Undo-Befehle aus [Editor-Layout](03-editor-layout.md): eine gelöschte Bank samt ID wiederherstellen, alle Starts einer Bank auf einmal setzen. Die Historie liegt im Browser. Ändert sich die Bibliothek von außen, leert sie sich.
- **Fehlermeldungen:** Download fehlgeschlagen, Bibliothek kaputt.

Grundlage: [Bestehender Webserver und Datenwege](02-bestehender-webserver-und-datenwege.md). Vieles davon ist eher technisch als Geschmackssache. Dem Nutzer nur vorlegen, was ihn auf der Bühne oder beim Kuratieren betrifft.

## Answer

Geklärt am 2026-10-28. Der Nutzer hat die vier Fragen zu Bühne und Kuratieren beantwortet und alle Empfehlungen angenommen. Den Rest habe ich technisch aus dem Code abgeleitet: `ytsampler_node.js` (Server `:969-1022`, `loadVideo` `:656-730`, Session `:739-810`), `ytsampler_main.js` (`sendPadMarks` `:268`, `loaded` `:597`, `recallFav` `:657`, `trigger` `:519`, `state` `:829`) und `teletext.html:326-348`. Grundlage sind die Tickets 02, 03, 05, 08, 09 und 11.

**Kernaussage:** Node ist die Wahrheit für die Bibliothek und schneidet die Snippets. `[js]` spielt nur die geladene Snippet-Datei der aktiven Bank und meldet zurück, was das Device daraus macht. Der Editor spricht mit Node über `POST /cmd` (ID-basiert, JSON-Antwort) und hört auf `GET /editor/events` (SSE).

### Entscheidungen des Nutzers

1. **Welches Device:** In der Kopfzeile steht der Spurname („steuert: YT 1“). Wechselt der Editor auf ein anderes Device (zum Beispiel weil das erste neu geladen wurde), zeigt er kurz „steuert jetzt …“.
2. **Tempo am Device:** Die Undo-Historie im Editor bleibt erhalten. Tempo ist nirgends ein Undo-Schritt, weder im Editor noch am Device. Das ist der Vorschlag aus Ticket 09.
3. **Device ohne Bank** (Video aus Teletext oder Ticket 08, Fall 2): Der Editor zeigt Waveform und Pads und lässt sie anspielen, aber nicht bearbeiten. Dazu kommt der Hinweis „keine Bank“.
4. **Suche:** Den Längenfilter („Max Length“ fällt in 2.0 weg) gibt es nicht mehr. Der Editor zeigt alle Treffer, Videos über 10 min tragen den Hinweis „nur 10 min“ (`MAX_SECONDS`). Treffer ohne Dauer (Livestreams) fallen weiter heraus.

### Grundregeln

- **Wer was hält:** Node hält `library.json` (Ticket 09), die Snippet-Dateien, den lokalen Cache der ganzen WAVs und die Analyse (siehe Ticket 12). `[js]` hält die aktive Bank (`st.bankId`, 16 Starts, 16 Längen, Tempo) und die Device-Regler und rechnet `playRange`.
- **ID statt Platz:** Alle Editor-Befehle nennen die Bank-ID (Ticket 09). Nur der Regler `Bank` und Vor/Zurück am Device schicken einen Platz, Node übersetzt ihn.
- **Snippets schneidet nur Node.** Ändern sich Starts oder Pads, schreibt Node sofort `library.json`, schneidet entprellt neu und schickt die Bank danach erneut an `[js]`. Eine eigene Meldung „Starts geändert“ an `[js]` gibt es nicht.
- **Max-Fallen:** Neue Node→`[js]`-Nachrichten haben eigene Selektoren und gehen nicht durch den UI-Router. Damit trifft sie „`route` entfernt das erste Wort“ nicht, sie landen über den Rest-Ausgang des Node-Routers bei der gleichnamigen `[js]`-Funktion. Freitext (Name, Pfad, Grund) steht immer **am Ende** und wird in `[js]` mit `arrayfromargs(arguments).slice(k).join(" ")` zusammengesetzt, wie heute bei `loaded`. Namen laufen vorher durch `clean()` (keine Kommas, Semikolons, Klammern). Fehlt eine Video-ID, steht `-`. Neue `[js]`-Funktionen sind ES5. Aktionen, die Live beim Laden „drücken“ könnte (`banksel`, `bpmset`), brauchen `if (!ready()) return;`. Alles, was von Node kommt, braucht das nicht.
- **Lokaler Cache:** `cache/` bleibt unter `~/Music/YTSampler/` (Ticket 11, nicht in iCloud). Snippets liegen im Datenordner aus Ticket 10 (`iCloud Drive/YTSampler/`).

### Snippet-Datei

| Was | Regel |
|---|---|
| Ort | `<Datenordner>/snippets/<bankId>.wav`, dazu `snippets/<bankId>.json`. In `library.json` steht kein Pfad, der Name folgt aus der `id` (Ticket 11, Ticket 10: keine absoluten Pfade). |
| Aufbau | 44,1 kHz, 16 Bit, Stereo. 16 Fächer zu je genau 16 000 ms, Fach *i* (Pad *i* + 1) beginnt bei `i × 16000` ms. Ist ein Snippet kürzer (Track endet), wird der Rest mit Stille aufgefüllt. Das sind ≈ 45 MB pro Bank. |
| Begleitdatei `.json` | `{"video": "<id>", "starts": [16 ms], "lens": [16 ms]}`. `lens[i] = min(16000, Dauer − starts[i])`. Daraus kennt Node die Längen auch ohne die ganze WAV, und es erkennt veraltete Snippets: `starts` oder `video` weichen von `library.json` ab. |
| Schreiben | `<bankId>.<pid>.tmp` schreiben, danach `rename`, erst die WAV, dann die `.json`. `buffer~` hält die Daten im Speicher, ein Überschreiben stört also nicht. |
| Schneiden | Aus der ganzen WAV im Cache (`wavInfo`, gezielt lesen pro Fach). Fehlt sie, setzt Node die neue Datei aus den Fächern der alten Snippet-Datei zusammen. Das geht nur, wenn jeder neue Start schon in der alten Datei vorkommt, also beim Tauschen, beim Undo eines Tauschs und beim Duplizieren. Sonst gilt „nur spielbar“, und der Befehl wird mit `playonly` abgelehnt. |
| Entprellen | Pro Bank 500 ms nach der letzten Änderung, damit schnelles Undo/Redo nur einmal schneidet und iCloud nicht 45 MB pro Klick hochlädt. `banksel`/`bankopen` auf eine veraltete Bank schneidet sofort und synchron (≈ 0,1–0,3 s, nicht gemessen). |
| Gelöschte Bänke | Die Snippet-Datei bleibt liegen, damit Undo nach dem Löschen (`restore`) auch ohne ganze WAV klingt. Node löscht beim Start verwaiste `snippets/<id>.*`, deren ID nicht mehr in der Bibliothek steht, sobald die Datei älter als 7 Tage ist. Die Undo-Historie überlebt ohnehin kein Neuladen. Löschen der Bank-Daten selbst bleibt verboten (Ticket 05). |
| Mehrere Devices | Geschnitten wird nur im Node-Prozess, der den Befehl ausführt. Die anderen sehen die Änderung über `fs.watchFile` (Ticket 09), vergleichen die `.json` ihrer aktiven Bank und laden neu, wenn sie sich geändert hat. Gleichzeitiges Schneiden derselben Bank ergibt dieselbe Datei, `rename` ist atomar. |

**Zustand pro Bank** (im SSE `lib`, nie in `library.json` gespeichert, vgl. Ticket 05, Punkt 7):
- `snip`: `ok` (Datei da und aktuell) · `cutting` · `stale` (veraltet, wartet aufs Schneiden) · `missing` (fehlt, zum Beispiel von iCloud noch nicht geladen). Ist sie `missing` und die ganze WAV im Cache, schneidet Node neu. Sonst ist die Bank am Device „nicht ladbar“ (Ticket 11 zu 05).
- `wav`: `true`/`false`, ob die ganze WAV im lokalen Cache liegt.
- **„nur spielbar“** = `wav: false`. Der Editor erlaubt dann umbenennen, verschieben, duplizieren, löschen und tauschen, aber nicht Start setzen oder „Neues Snippet“ (Ticket 11, Punkt 7). Er bietet „Track laden“ an (`fetch`). Ist der letzte Versuch gescheitert, steht der Grund dabei (`videos.<id>.fail`, zum Beispiel „Video nicht mehr verfügbar“).
- Wählt man im Editor eine Bank mit `wav: false`, lädt Node den Track für den Editor im Hintergrund nach (Vorrang vor „Alle nachladen“). Das Device spielt dabei unverändert die Snippets.

### HTTP

| Route | Was |
|---|---|
| `GET /editor` | `editor.html`, wie `teletext.html` über `pagePath()` nach `web/` gespiegelt (für eingefrorene Devices). |
| `GET /editor/events` | SSE mit eigener Client-Liste. Teletext-`/events` und `viewState()` bleiben unverändert. |
| `POST /cmd` | Befehle, siehe unten. |
| `GET /peaks/<video>` | Waveform des ganzen Tracks, siehe unten. |

**Schutz für `/cmd`** (Trust-Grenze, weil jede Webseite im Browser `localhost` erreichen kann): Nur `Content-Type: application/json` wird angenommen. Das erzwingt bei fremden Seiten einen CORS-Preflight, den der Server nicht beantwortet. `Host` muss `localhost:<port>` oder `127.0.0.1:<port>` sein (gegen DNS-Rebinding), `Origin` ebenso, falls gesetzt. Der Body darf höchstens 64 KB groß sein. Die Antwort ist immer JSON mit HTTP 200: `{ok: true, …}` oder `{ok: false, code, text}`. Nur bei unlesbarem JSON oder einer verletzten Schutzregel kommt 400 bzw. 403.

Jeder Befehl trägt `client`, eine Zufalls-ID pro Seitenaufruf des Editors. Node gibt sie im SSE `lib` als `by` zurück.

### Befehle `POST /cmd`

Body: `{client, cmd, …Felder}`. „aktiv“ = die Bank, die das Device gerade hat.

| `cmd` | Felder | Node tut | an `[js]` | Antwort `ok` |
|---|---|---|---|---|
| `select` | `id` | Bank prüfen, bei Bedarf schneiden; `wav: false` → Track im Hintergrund laden | `bank …` + `bankname …` | `{}` |
| `rename` | `id`, `name` (getrimmt, ≤ 100 Zeichen, roh gespeichert) | Bibliothek | `bankname …`, wenn aktiv | `{}` |
| `duplicate` | `id` | Kopie direkt dahinter, `"<Name> (Kopie)"`, neue ID, Snippet-Dateien kopieren | `bank …` (Kopie wird aktiv, Ticket 03/08) | `{id}` |
| `delete` | `id` | entfernen, verwaisten `videos`-Eintrag mit entfernen (Ticket 06, Punkt 7); war sie aktiv, wird der Nachrücker aktiv (Ticket 08, Fall 5) | `bank …` des Nachrückers bzw. `libstate … leer` | `{removed: {bank, at, video}}` mit `video = {title, bpm?}` |
| `move` | `id`, `to` (Platz 1…n) | Bibliothek | `libstate` (neuer Platz) | `{}` |
| `restore` | `bank: {id, name, video, starts}`, `at`, `video: {title, bpm?}` | nur wenn `id < nextId` und frei (Ticket 09); `videos`-Eintrag zurück, falls er fehlt; vorhandene Snippet-Datei weiterverwenden, sonst schneiden | `libstate` | `{}` |
| `setstart` | `id`, `pad` (0–15), `ms` (≥ 0, ganze ms) | Bibliothek, neu schneiden | `bank …` nach dem Schneiden, wenn aktiv | `{}` |
| `setstarts` | `id`, `starts[16]` | wie `setstart` (für Undo/Redo) | wie oben | `{}` |
| `swap` | `id`, `a`, `b` | Bibliothek, Fächer tauschen (geht auch ohne WAV) | wie oben | `{}` |
| `roll` | `id`, `pad` | würfelt nach den Regeln aus Ticket 01 (Taktanfang, keine Stille, kein doppelter Start). Node würfelt auf der ganzen WAV (Ticket 12, Punkt 9) | wie oben | `{ms}` |
| `hit` / `up` | `pad` | — | `padhit <i>` / `padup <i>` (Hold: `up` beim Loslassen) | `{}` |
| `search` | `q` | yt-dlp wie `search()`, aber mit eigener Trefferliste. Teletext-`ui`/`lastResults` bleiben unberührt. Eine neue Suche bricht die alte ab | — | `{results: [{id, title, dur, long}]}`, `long` = über 10 min; Vorschaubild `https://i.ytimg.com/vi/<id>/mqdefault.jpg` |
| `newbank` | `video` | Track laden → Analyse → 16 Starts würfeln (Node, ganze WAV) → Bank am Ende anlegen (Name = Titel, `bpm` aus `videos`, falls schon da) → schneiden → aktiv | `bank …` am Ende | `{}` sofort, Fortschritt über SSE `job` |
| `tempo` | `video`, `bpm` (30–300, auf 0,1 gerundet) | `videos[v].bpm` | `bpm <video> <bpm>`, wenn aktiv | `{}` |
| `tempook` | `video` | bestätigt den erkannten Wert (Analyse-Tempo) als `bpm` | `bpm …` | `{bpm}` |
| `fetch` | `video` | ganze WAV in den lokalen Cache laden (Knopf „Track laden“) | — | `{}`, Fortschritt über `job` |
| `fetchall` | — | Warteschlange aller fehlenden WAVs; `select`/`fetch` haben Vorrang, Fehlschläge werden markiert und übersprungen (Ticket 05, Punkt 4) | — | `{todo}` |

- Marker ziehen: Der Editor schickt `setstart` erst beim Loslassen, also kein Entprellen beim Ziehen. Das Einrasten auf Schläge rechnet der Editor mit SSE `beats`.
- Downloads für den Editor (`select`, `fetch`, `fetchall`, `newbank`) schicken **kein** `loaded` an `[js]`. `loadVideo` wird dazu geteilt: in „herunterladen in den Cache“ und „ins Device laden“ (nur Teletext). Ein Download für den Editor bricht einen anderen Download für den Editor ab, wenn er Vorrang hat. Einen Teletext-Download bricht er nie ab, und umgekehrt (Ticket 05, „letzte Wahl gewinnt“ gilt je Weg).

### Undo/Redo (Historie im Browser, Ticket 03)

| Schritt | Undo | Redo |
|---|---|---|
| Start setzen, neues Snippet | `setstarts` alt | `setstarts` neu |
| Pads tauschen | `swap` (gleiches Paar) | `swap` |
| umbenennen | `rename` alt | `rename` neu |
| verschieben | `move` auf alten Platz | `move` auf neuen Platz |
| duplizieren, neue Bank | `delete` | `restore` mit derselben ID (aus der `delete`-Antwort) |
| löschen | `restore` mit `removed` | `delete` |

Danach schickt der Editor `select` auf die betroffene Bank, wenn sie nicht aktiv ist (Ticket 03: Undo springt zur Bank). Ist die Bank „nur spielbar“, schlägt das Undo eines Starts mit `playonly` fehl, der Editor zeigt den Hinweis und lässt den Schritt in der Historie. Tempo ist kein Schritt (Entscheidung 2). Der Editor leert die Historie, wenn `lib.by` weder seine eigene `client`-ID noch `"device"` ist.

### Node → `[js]`

| Nachricht | `[js]` tut |
|---|---|
| `bank <id> <nr> <bpm> <s1…s16> <l1…l16> <pfad…>` | Aktive Bank setzen oder neu laden. Alle klingenden Stimmen in beiden `poly~` mit `gateoff 5` ausblenden, nach ≈ 10 ms per `Task` `replace <pfad>` an `buffer~` (Patch: Ausgang von `[js]` statt `loaded` → `buffer~`, Ticket 05). `durMs = 256000`, Pad *i* spielt ab `i × 16000`, höchstens bis `i × 16000 + l[i]`. Hold endet am Snippet-Ende, Hold rückwärts spielt das Fach von hinten (Ticket 11, Punkte 2–3). `bpm 0` = nicht bestätigt. Die Starts `s` sind Positionen im ganzen Track: für die Anzeige, `bankstate` und die Session-Kopie. Kommt dieselbe `id` erneut (neu geschnitten), läuft es genauso. `nr 0` = Bank steht nicht in der Bibliothek. |
| `bankname <id> <name…>` | Anzeige (Nummer + Name), gilt nur bei `id == st.bankId` oder für die Bank, die gerade lädt |
| `bankgone <id>` | Antwort auf `bankopen`: Bank gelöscht. `bankId = 0`, Track und Starts aus der Session-Kopie laden (wie heute über `load <st.id>`, braucht die ganze WAV oder Internet), Anzeige „keine Bank“ + kurz „Bank gelöscht“ (Ticket 08, Fall 2) |
| `bankfail <id> <grund…>` | Snippets nicht ladbar: Ladewunsch verwerfen, Anzeige zurück auf die klingende Bank + kurz „nicht ladbar“ (Ticket 05, Punkt 6) |
| `libstate <anzahl> <nr> <ok\|leer\|kaputt\|neuer>` | Regler `Bank` per `set` auf `min(nr, 128)` (`set` löst nichts aus, also kein zweites Laden, Ticket 08), Anzeige „Bibliothek leer – Bank im Editor anlegen“ bzw. „Bibliothek kaputt“ bzw. „Bibliothek aus neuerer Version“. Bei `leer`/`kaputt`/`neuer`: Pads stumm (Ticket 05, Punkte 8–9) |
| `bankpeek <nr> <anzahl> <name…>` | Anzeige beim Drehen, bevor geladen wird (Ticket 04). `nr > anzahl` = „leer“ |
| `bpm <video> <bpm>` | nur bei `video` der aktiven Bank: `srcBpm = bpm`, `srcAuto = 0`. Schickt **kein** `bpmset` zurück |
| `padhit <i>` / `padup <i>` | gibt es schon (`main :486-487`) |
| `loaded …`, `loadfail <video> <grund…>` | nur noch Teletext („keine Bank“, ganze WAV wie heute). `loadfail` ersetzt die reine `status`-Meldung (Ticket 05) |
| `snips <16 Starts> <16 Längen> <Songdauer>` | vor `loaded`, nur bei Bänken: Song-Starts und Snippet-Längen in ms. `[js]` rechnet weiter in Song-ms und erst in `trigger`/Overlay auf Buffer-ms um (`i × 16000 + (t − start_i)`). Ohne `snips` (Teletext) altes Verhalten. Ticket 12 |
| Analyse (`tempo`, `tuning`, `analysisready`, `silence`, `padinfo`, `beats*`; Anfragen `analyze`/`analyzeall`/`beattrack`) | bleibt unverändert in Song-ms. Bei Bänken liest Node die `.chroma` aus dem Bank-Ordner statt aus `cache/`. Fehlt sie und die WAV: Status „Analyse fehlt – Bank im Editor neu schneiden“. Overlay: `grid dur` = Snippet-WAV, `grid beats`/`pads` in Buffer-ms, neu `grid bars <ms…>`. Ticket 12 |

### `[js]` → Node

| Nachricht | Wann | Node tut |
|---|---|---|
| `bankstate <bankId> <video\|-> <sel> <mode> <rev> <s1…s16> <w1…w16>` | aus `sendPadMarks()`, nur wenn sich der String geändert hat (Merker wie `lastSaved`, sonst feuert jeder Anschlag über `updateSel`) | SSE `device`, 30 ms gebündelt wie `pushUi` |
| `bankpeek <nr>` | jeder Schritt am Regler `Bank` | antwortet `bankpeek` |
| `banksel <nr>` | Regler ruht 350 ms, oder Vor/Zurück (Ziel = aktueller Platz ± 1, an den Enden stehen bleiben, Ticket 04) | `bank …` oder nichts, wenn `nr` über der letzten Bank liegt |
| `bankopen <bankId>` | in `state()`, wenn `bankId > 0` | `bank …` (Platz neu berechnet, Ticket 08, Fall 1) oder `bankgone` |
| `bpmset <video> <bpm>` | ½×, 2×, Zahlenfeld. Die gleiche Zahl bestätigt: Die `abs < 0.01`-Sperre in `srcbpm` fällt weg (Ticket 06, Punkt 5) | `videos[v].bpm` schreiben, wenn das Video in der Bibliothek steht, SSE `lib` mit `by: "device"`; sonst nichts (nur die Session-Kopie) |
| `playing <pad> <von> <bis> <dauer>` / `playstop <pad>` | `trigger` / `noteoff` | SSE `play` / `stop` (Abspielkopf, Ticket 03). `von`/`bis` als Position im ganzen Track: `s[i] + (Snippet-Position − i × 16000)` |
| `trackname <name…>` | `new LiveAPI(cb, "this_device canonical_parent")`, Eigenschaft `name` beobachtet | SSE `hello` erneut (Entscheidung 1) |

Bestehende Nachrichten bleiben: `session`, `savestate`, `key`, `load` (Teletext). `favinfo` fällt weg (2.0). In `bankstate` sind `s` die Starts im ganzen Track: bei einer Bank die aus `bank`, bei „keine Bank“ `effStart(i)`. `w` ist die tatsächlich gespielte Länge in Track-ms (`|bis − von|` aus `playRange`, gekappt auf `l[i]`). Damit zeichnet der Editor die Fläche hinter dem Marker. `mode` 0/1 = Trigger/Hold, `rev` 0/1.

### SSE `GET /editor/events`

Benannte Events, `data:` ist JSON. Direkt nach dem Verbinden: `retry: 1500`, dann `hello`, `lib`, `device`, `cache` und gegebenenfalls `beats`. Ping-Kommentar alle 15 s wie heute.

| Event | Inhalt |
|---|---|
| `hello` | `{port, session, track}`. Ändert sich `session` nach einem Neuverbinden, zeigt der Editor „steuert jetzt <track>“ (Entscheidung 1) |
| `lib` | `{rev, by, state: "ok"\|"leer"\|"kaputt"\|"neuer", error?, banks: [{id, name, video, starts, snip, wav}], videos: {<id>: {title, bpm?, fail?}}}`. `by` = `client`-ID, `"device"` oder `"extern"` (`rev` nicht von diesem Prozess, Ticket 09). Immer die ganze Bibliothek, auch nach Statuswechseln von `snip`/`wav` |
| `device` | `{bankId, nr, video, sel, mode, rev, starts[16], spans[16], teletext: {phase, progress} \| null}`. `bankId 0` = „keine Bank“ (Entscheidung 3) |
| `beats` | `{video, bpm, beats: [ms], down}` für den Track der aktiven Bank, zum Einrasten und für die Taktlinien. Node trackt auf der ganzen WAV bzw. der abgelegten Analyse (Ticket 12). Heute: Ergebnis von `sendBeats` aufheben |
| `play` / `stop` | `{pad, from, to, dur}` / `{pad}` |
| `job` | `{kind: "fetch"\|"newbank"\|"cut", video?, bankId?, phase, progress, left}`: Download-Fortschritt (Phasen wie `ui.phase`), Schneiden (`cut`, `left` = Bänke in der Warteschlange), „Alle nachladen“ |
| `cache` | `{bytes, warn}`, Größe von `cache/` (Summe aller Dateien per `readdirSync` + `statSync`). `warn = bytes ≥ 10 000 000 000` (Ticket 11, Punkt 5). Kommt beim Verbinden und nach jedem Download |
| `msg` | `{level: "info"\|"error", code, text}` für Hinweise und Fehler |

### `GET /peaks/<video>`

- `video` muss `/^[\w-]{11}$/` sein, sonst 400 (kein Pfad aus der URL). Fehlt die ganze WAV im Cache, kommt 404: Der Editor zeigt die Bank dann als „nur spielbar“ bzw. „lädt“.
- `application/octet-stream`: 8 Byte Kopf (Uint32 LE Samplerate, Uint32 LE Blockgröße = 256), danach pro Block von 256 Frames Int8 Min und Int8 Max über beide Kanäle (Int16 `>> 8`). Median ≈ 76 KB, 10 min ≈ 207 KB. Die Dauer folgt aus der Dateigröße.
- Wird bei jeder Anfrage frisch aus `wavInfo` und den Daten gerechnet, ohne Cache-Datei (Research 02). `Cache-Control: private, max-age=86400`, denn eine Video-ID hat immer denselben Inhalt.
- Für „nur spielbar“ gibt es keine Waveform. Snippet-Peaks wären möglich, sind aber nicht verlangt.

### Fehler

| `code` | Text | Wann |
|---|---|---|
| `nobank` | Bank gibt es nicht mehr | ID fehlt (anderes Fenster hat gelöscht, Ticket 09) |
| `libbroken` | Bibliothek kaputt – Speichern gesperrt | Prüfung aus Ticket 09 schlägt fehl |
| `libnewer` | Bibliothek aus neuerer Version | `format > 1` |
| `libbusy` | Bibliothek belegt | Sperre länger als 1 s |
| `writefail` | Speichern fehlgeschlagen: … | Schreibfehler bei `library.json` |
| `playonly` | Track fehlt – nur spielbar | Start setzen/würfeln ohne ganze WAV |
| `cutfail` | Snippets schneiden fehlgeschlagen: … | Lese- oder Schreibfehler beim Schneiden (auch als SSE `msg`) |
| `nosnip` | Snippets fehlen – Bank nicht ladbar | `select` ohne Snippet-Datei und ohne WAV (auch als `bankfail` ans Device) |
| `idtaken` | Bank existiert schon | `restore` mit vergebener ID |
| `notempo` | Kein Tempo erkannt | `tempook` ohne Analyse-Tempo |
| `superseded` | Neuere Suche läuft | ältere `search` |
| `searchfail` | Suche fehlgeschlagen: … | yt-dlp-Fehler (Text über `errMsg`) |
| `loadfail` | Download fehlgeschlagen: <Titel> – <Grund> | nur SSE `msg`, setzt `videos.<id>.fail` |
| `badreq` | Ungültiger Befehl | Feld fehlt, falscher Typ, `pad` außerhalb 0–15, `starts` nicht genau 16 |

### Bekannte Grenzen

- Ändert man das Tempo am **zweiten** Device, kommt das bei Node 1 als `"extern"` an, und der Editor leert seine Historie. Abhilfe wäre ein Feld „zuletzt geändert von“ in `library.json` (Format aus Ticket 09). Weil das selten vorkommt, bleibt es weg.
- Video-IDs als Max-Atom: Eine rein numerische ID würde zur Zahl. Das gilt heute schon für `loaded`.
- `bankgone` (Ticket 08, Fall 2) braucht die ganze WAV oder Internet, denn die Session-Kopie enthält nur Starts im ganzen Track. Liegt die verwaiste Snippet-Datei noch da (7 Tage), könnte Node sie stattdessen mit `bank <id> 0 …` schicken. Das ist nicht verlangt.
- Laufzeiten (Schneiden, Peaks) sind geschätzt, nicht gemessen. `LiveAPI`-Beobachtung des Spurnamens ist in echtem Max ungeprüft.
