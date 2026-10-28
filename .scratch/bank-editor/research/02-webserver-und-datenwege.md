# Bestehender Webserver und Datenwege

Research zu [Ticket 02](../issues/02-bestehender-webserver-und-datenwege.md). Stand: Code von Version 1.3.0 (`e94f452`), 2026-10-28. Alle Zeilenangaben beziehen sich auf diesen Stand.

## 1. Webserver: Routen, Zustand, Tasten

Der Server ist ein nacktes `http.createServer` ohne Framework (`ytsampler_node.js:969-1021`). Er lauscht nur auf `127.0.0.1` (`:1014`). Ist der Port belegt, probiert er den nächsten, höchstens fünfmal, also 8765 bis 8770 (`:1011`, Aufruf `:1022`).

| Route | Methode | Was | Beleg |
|---|---|---|---|
| `/events` | GET | Server-Sent Events. Erst `retry: 1500`, dann sofort ein vollständiger `viewState()`, danach bei jeder Änderung. Ping-Kommentar alle 15 s. | `:972-979`, `:1019` |
| `/key` | POST | Body `{"k": "<taste>"}`, höchstens 1000 Byte (sonst `req.destroy()`). `ir:<code>:<0/1>` geht an `irInput`, alles andere an `handleKey`. Antwort immer 204, Fehler werden verschluckt. | `:980-993` |
| `/state` | GET | derselbe `viewState()` einmalig als JSON | `:994-998` |
| `/`, `/index.html` | GET | `teletext.html` (neben dem Skript oder Kopie in `~/Music/YTSampler/web/`) | `:999-1006`, `pagePath()` `:824-835` |
| alles andere | | 404 | `:1007` |

**Zustand zur Seite:** Push per SSE, kein Polling. `pushUi()` sammelt Änderungen 30 ms und schickt dann das ganze `viewState()`-Objekt an alle Clients (`:851-859`). Es gibt keine Deltas und keine Event-Typen, nur `data:`. Die Seite öffnet `new EventSource('/events')` und ersetzt bei jeder Nachricht ihren Zustand `S` komplett (`teletext.html:325-330`). Beim Abbruch verbindet sich der Browser selbst neu.

**Inhalt von `viewState()`** (`:837-849`): nur Teletext-Sachen, also Suche (`query`, `searched`, `searching`, `sel`, `results`, `hidden`, `maxLen`), Ladefortschritt (`loading`, `phase`, `progress`), `title`, `fav` (nur der Name des Favoriten-Platzes, z. B. „A3“), `message` (letzte Statuszeile), `learn`, `tvOff`. **Keine Pads, keine Starts, keine Dauer, keine Beats, keine Video-ID.**

**Tasten zurück:** `teletext.html:348` schickt `fetch('/key', {method: 'POST', body: JSON.stringify({k})})`. `handleKey` (`:863-892`) kennt `enter`, `back`, `esc`, `learn`, `power`, `up`, `down`, `pgup`, `pgdn`, `tap:<d>`, `char:<c>`. Sie wirken alle nur auf den Node-Zustand `ui` (Suche, Treffer laden per `loadVideo`). **Keine Taste erreicht heute `[js]`.**

**Folgerungen für den Editor:**
- SSE als Kanal Node → Browser ist da und taugt. Nötig ist ein zweites Zustandsobjekt (Bank, Pads, Dauer, Beats, Bibliothek), am besten als eigener Event-Typ (`event: bank`) auf demselben `/events`, oder als eigene Route `/editor-events`. Sonst müsste die Teletext-Seite fremde Felder ignorieren. Das tut sie zwar ohnehin (`S = JSON.parse(...)`), aber Bibliothek und Beats bei jeder Teletext-Änderung mitzuschicken ist Verschwendung.
- `/key` taugt nicht als Befehlskanal: Body auf 1000 Byte begrenzt, keine Antwort, keine Fehlermeldung. Gebraucht wird eine Route wie `POST /cmd` mit JSON-Antwort (ok/Fehler).
- Statische Auslieferung kann nur genau `teletext.html`. Für `editor.html` (plus evtl. JS/CSS) braucht es eine Route und dieselbe Spiegelung nach `web/` wie in `pagePath()`, sonst fehlt der Editor beim eingefrorenen Device.
- „Erstes Device“ heißt technisch: das Device, dessen `node.script` 8765 zuerst belegt hat. Das ist die Startreihenfolge, nicht die Spurreihenfolge. Lädt der Nutzer das erste Device neu, während ein zweites läuft, rutscht das zweite auf 8765.
- Kein CORS, kein Login. Das passt, solange der Editor vom selben Server kommt und nur `127.0.0.1` lauscht.

## 2. Wer kennt welchen Zustand?

| Zustand | `[js]` | Node | Beleg |
|---|---|---|---|
| Video-ID, Titel | `st.id`, `st.title` | `ui.title`; ID nur lokal in `loadVideo` und in `analysis.id` | main `:68`, `:605-619`; node `:558`, `:702` |
| Dauer | `durMs` | nur lokal `ms` in `loadVideo`, nicht gespeichert; `wavDurationMs()` kann es jederzeit neu ausrechnen | main `:38`, `:599`; node `:134`, `:701` |
| 16 Starts (frei gespeichert) | `st.pads` | indirekt: steckt URI-kodiert in `savestate` (`pendingState`, nach dem Schreiben verworfen) und in `sessions/<nr>.json` | main `:819-825`; node `:767-773`, `:796-802` |
| 16 Starts (tatsächlich, eingerastet) | `effStart(i)`, hängt an Grid/Snap/Division | nur flüchtig in `analyze`/`analyzeall`-Argumenten | main `:178-184`, `:434-443` |
| Locks | `st.locks` | nur in `savestate` | main `:590-594` |
| Ausgewähltes Pad | `sel` | nein | main `:39`, `:511` |
| Quelltempo | `st.srcBpm`, `srcAuto`, `bpmConf` | `analysis.bpm` (Auto-Wert); den vom Nutzer bestätigten Wert nur über `beattrack <bpm>` | main `:380-402`; node `:561`, `:734` |
| Beats, „1“ | `beats`, `beatsDown` | rechnet sie in `sendBeats` aus, **behält sie aber nicht** (`r` ist lokal) | main `:50`, `:239-248`; node `:516-524` |
| Stille | `silent` | aus `analysis` jederzeit per `silentRanges(analysis)` | main `:53`, `:417`; node `:500-514` |
| Tonart pro Pad | `keys`, `shifts` | `analyzeWindow` auf Anfrage | main `:58`, `:425-432`; node `:578-612` |
| Device-Regler (BPM, Division, Rate, Mode, Warp, Grid, Snap, Quant …) | `P` | nein | main `:28` |
| Favoriten, aktive Bank | `st.favs`, `st.fav`, `st.bank` | nur als Name (`favinfo`) und in `savestate` | main `:68-71`, `:780`; node `:967` |
| Ladezustand, Suche | nein | `ui`, `busy` | node `:30`, `:35-48` |

**Was `[js]` neu an Node melden müsste**, damit der Editor eine Bank zeichnen kann:
- nach jeder Änderung an Bank oder Pads: Bank-Index, `durMs`, die 16 Starts (die freien aus der Bank, für die Anzeige im Editor besser die eingerasteten `effStart`), `sel`. Einfachste Form: eine Nachricht `bankstate <bank> <dur> <sel> <16 starts>` aus `sendPadMarks()` heraus (`main :268-272`), das ohnehin nach jeder Pad-Änderung läuft.
- für das Einrasten im Browser: Beats und „1“. Die muss `[js]` nicht schicken. Node rechnet sie selbst; es reicht, in `sendBeats` das Ergebnis `r` aufzuheben (`node :519`). Allerdings gelten sie nur, wenn `tempoTrusted()` in `[js]` stimmt (`main :135-138`). Ein Flag „Beats gültig“ müsste `[js]` mitschicken.
- Spiel-Anzeige (welches Pad klingt): optional. `padflash`/`padlight` gehen heute nur an das Pad-jsui (`main :540-541`).

Vereinfachung, die sich anbietet: Wenn die Bibliothek in Node lebt (Datei unter `~/Music/YTSampler/`), ist Node die Quelle der Wahrheit für Track und Starts. `[js]` bekommt nur noch „lade Bank n: id + 16 Starts“ und meldet zurück, was das Device daraus macht (Dauer, eingerastete Starts, `sel`). Dann muss man `st.pads` nicht mehr aus `savestate` herauspulen.

## 3. Waveform im Browser

Cache-WAVs (60 Dateien, 2,3 GB, gemessen per `stat`): Minimum 6,4 MB, Median 39 MB (≈ 3:42 min), 90 % unter 64 MB, Maximum 106 MB (= 10 min, die Grenze `MAX_SECONDS = 600`, `node :18`). 44,1 kHz × 2 Kanäle × 2 Byte = 176 400 Byte/s.

**WAV ausliefern + `decodeAudioData`:**
- Übertragung über localhost ist kein Problem, aber `decodeAudioData` braucht die ganze Datei und legt sie als Float32 pro Kanal ab, je nach `AudioContext` auf 48 kHz umgerechnet. Median ≈ 85 MB RAM, 10-min-Video ≈ 230 MB, plus die 39–106 MB ArrayBuffer der Datei. Decodieren dauert spürbar (Größenordnung ¼–1 s).
- Der Editor spielt nichts ab (Wiedergabe läuft über Live, Ticket 01). Er würde also Audio decodieren, nur um Striche zu malen.
- Code ist minimal: eine Route `/audio/<id>.wav` mit `fs.createReadStream`, im Browser ~20 Zeilen Min/Max pro Pixel.

**Peaks aus Node:**
- Node liest das WAV schon für die Analyse komplett ein (`loadMonoDecimated`, `node :190-194`; `wavInfo` `:101-132`). Min/Max pro Block auszurechnen sind ein paar Zeilen. Mit 256 Samples pro Block (≈ 5,8 ms, fein genug für Marker-Ziehen mit Zoom) und Int8 Min/Max: Median ≈ 76 KB, 10 min ≈ 207 KB. Lesen + Rechnen ≈ 100–300 ms synchron im Node-Prozess, nicht im Max-Thread.
- Ob als Datei `<id>.peaks` im Cache oder bei jeder Anfrage frisch: Frisch reicht für den Anfang (ein Track pro Bank, einmal pro Bankwechsel). Ein Cache-File lohnt erst, wenn Bankwechsel im Editor sich langsam anfühlt. `AN.VERSION` bleibt davon unberührt, das betrifft nur `.chroma`.

**Einschätzung:** Peaks aus Node, ausgeliefert über eine Route `GET /peaks/<id>` (binär oder JSON). Es ist kaum mehr Code als die WAV-Route, spart dem Browser 100–300 MB und die Decodierzeit und macht den Editor unabhängig vom Audioformat. Die WAV-Route nur, falls später doch Vorhören im Browser kommt (laut Ticket 01 außerhalb des Umfangs).

## 4. Pad-Anschlag aus dem Browser

Der Weg ist fast fertig:

1. Browser → `POST /cmd {hit: i}` (neu) → Node.
2. Node → `Max.outlet('padhit', i)`. Der Node-Ausgang läuft durch `route rclear radd status loaded needmaxlen`; alles, was dort nicht passt, geht über Ausgang 5 direkt an `[js]` (Patch: `obj-23` Ausgang 5 → `obj-1`, siehe CLAUDE.md „Alles andere geht an `[js]`“).
3. `[js]` hat `padhit(i)` schon, das Pad-jsui benutzt es (`main :486`; jsui `obj-126` → `obj-1`, `ytpads.js:103`). `padhit` → `hit(i, 100)` → bei Quant auf den nächsten `tick` warten, sonst `play` → `trigger(i, 100)` (`main :499-543`).
4. `trigger` setzt `sel = i` und ruft `updateSel()`, das Device zeigt das Pad also auch als ausgewählt.

Für Hold-Modus gibt es `padup(i)` (`main :487`); der Browser muss dazu `pointerup` schicken. Velocity ist fest 100. Latenz HTTP + Node-Prozess + Max-Messaging: zum Vorhören gut genug, zum Fingerdrummen nicht gedacht. Neu nötig ist nur die Route in Node und eine Zeile `Max.outlet`. Am Patch ändert sich nichts.

Achtung: `padhit` prüft `ready()` nicht. Das ist richtig so (kein Button, wird beim Laden nicht „gedrückt“).

**Auch die übrigen Editor-Befehle laufen diesen Weg** (Node → Ausgang 5 → `[js]`-Funktion gleichen Namens). Heute fehlen in `[js]`:
- Start eines Pads setzen (`setpad i ms`). Gibt es nicht; `nudge` verschiebt nur `sel` um eine Rasterstufe (`main :576-588`).
- zwei Pads tauschen. Gibt es nicht.
- ein Pad neu würfeln (`rollpad i`). `reroll()` gibt es, aber nur für `sel` und nur zwischen den Nachbar-Pads, damit die Reihenfolge chronologisch bleibt (`main :565-574`). Nach Tausch und Marker-Ziehen ist eine Bank nicht mehr chronologisch; die Nachbargrenze gehört dann weg. `randomStart()` (Taktanfang bevorzugt, keine Stille, kein doppelter Start, `main :307-320`) ist direkt nutzbar.
- Bank laden (`bank <id> <16 starts>`). Das Vorbild ist `recallFav` (`main :657-680`) mit `pendingFav` und `applyPads` in `loaded` (`main :608-615`).
- Neues Video aus dem Editor: `loadVideo` und `search` in Node gibt es schon (`node :620`, `:656`); `loaded` würfelt im neuen Video automatisch (`autoRoll`, `main :616-625`). Fehlt nur, dass Node danach die gewürfelten Starts als neue Bank übernimmt (siehe Punkt 2: `bankstate`).

## 5. Favoriten heute und was beim Umbau frei wird

**Ablage:** In der Session-Datei des Devices, `~/Music/YTSampler/sessions/<nr>.json` = `{version: 1, saved, state}`, wobei `state` der URI-kodierte JSON-String von `st` ist (`node :767-773`, `main :819-825`). Geprüft an `sessions/255.json`: Schlüssel `id, title, pads, locks, favs, fav, bank, srcBpm, srcAuto, bpmConf`, 8 von 64 Plätzen belegt. Die Favoriten hängen also pro Device-Instanz an der Session-Nummer im Set, nicht global.

**Format eines Favoriten** (`snapshot()`, `main :719-722`): `{id, title, pads[16], locks[16], srcBpm, srcAuto, bpmConf}`. Das ist schon fast eine Bank. Neu kämen ein Name dazu; `locks` fällt weg (Bank = Track + 16 Starts). Ob `srcBpm`/`srcAuto` in die Bank gehören, ist offen: Ein vom Nutzer bestätigtes Quelltempo („÷2“, „×2“) steckt heute im Favoriten (`applySrc`, `main :638-640`) und ginge sonst bei jedem Bankwechsel verloren.

**Was frei wird (Major 2.0):**
- `[js]`: `NFAV`, `BANKS` (`main :19-20`), `st.favs/fav/bank` (`:68-71`), `pendingFav`, `favTask`, `favSelTarget` (`:81-83`), der ganze Block `favName` … `updateFavUI` (`:649-781`), der `pendingFav`-Zweig in `loaded` (`:608-615`, wird durch „Bank laden“ ersetzt), Laden von `favs`/`mem` in `state()` (`:840-844`). Mit den Locks: `lock()` (`:590-594`), `st.locks`, die Lock-Prüfung in `sortPads`/`rollAll` (`:210-228`).
- Node: `favinfo`-Handler und `ui.fav` (`node :967`, `:44`, `:845`). Die Teletext-Seite zeigt `FAV <name>` (`teletext.html:199`); das bliebe leer stehen oder zeigt künftig die Banknummer. Laut Karte wird Teletext nicht weiterentwickelt, das wäre also die einzige nötige Anpassung.
- Patch, mit Parameternamen (MIDI-Mappings im Set brechen, daher 2.0): `Fav Bank` (obj-53), `Fav Select` (obj-55), `Fav Slot 1`–`16` (obj-57 … obj-102), `Fav Prev/Next/Add/Update/Delete` (obj-105 … obj-117), dazu `Lock` (obj-160), `Shuffle` (obj-163), `Reroll` (obj-166), `Nudge Left/Right` (obj-169, obj-172), Suchfeld, Treffermenü und `Max Len`. `Fav Select` + `Fav Prev/Next` sind funktional genau der künftige Bank-Regler mit Vor/Zurück, inklusive „laden, wenn der Regler 350 ms ruht“ (`main :689-697`). Den Mechanismus kann man übernehmen, den Namen eher neu vergeben („Bank“).
- Session-Datei: bleibt für das, was pro Set gilt (aktuelle Bank, ggf. Quelltempo), wird aber viel kleiner. Alte Dateien mit `favs` stören nicht, wenn `state()` das Feld einfach ignoriert.

## 6. Was für den Editor neu gebaut werden muss

In Node:
- Route für `editor.html` (plus Spiegelung nach `web/`).
- Befehlsroute `POST /cmd` mit JSON-Antwort statt `/key`.
- Zweites Zustandsobjekt im SSE-Strom (Bibliothek, aktuelle Bank, Dauer, 16 Starts, `sel`, Beats + „1“, Stille, Ladezustand).
- `GET /peaks/<id>` aus dem Cache-WAV.
- Bibliotheksdatei lesen/schreiben (atomar wie `writeStateNow`, `node :767-773`).
- Beats aus `sendBeats` aufheben statt nur weiterzuschicken.

In `[js]`:
- neue Handler: Bank laden, Start setzen, Pads tauschen, ein Pad würfeln (ohne Nachbargrenze).
- Rückmeldung an Node nach jeder Pad-Änderung (`bankstate …`), z. B. aus `sendPadMarks()`.
- Favoriten-, Lock-, Such- und Würfel-UI entfernen (2.0).

Schon vorhanden und direkt nutzbar: SSE-Kanal, Port-Ausweichen, Suche und Download (`search`, `loadVideo`), Node → `[js]` für beliebige Selektoren, `padhit`/`padup`, `randomStart` mit allen Würfelregeln, `silentRanges`, `trackBeats`, `wavInfo`.

## Nicht geprüft

- Laufzeit nicht gemessen: Peaks-Rechenzeit und `decodeAudioData`-Speicher sind aus Dateigrößen abgeschätzt, nicht ausprobiert.
- Nichts gegen Port 8765 getestet (dort lief vermutlich gerade das echte Device: `sessions/255.lock` ist von heute).
