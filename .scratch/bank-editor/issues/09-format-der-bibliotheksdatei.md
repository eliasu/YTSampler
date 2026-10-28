# Format der Bibliotheksdatei

Type: grilling
Status: resolved

## Question

Wie sieht die Bibliotheksdatei unter `~/Music/YTSampler/` aus, und was ändert sich an der Session-Datei für 2.0?

Was bisher feststeht:
- pro Bank: feste `id` (nie wiederverwendet, auch nicht nach dem Löschen), Name, Video-ID, Videotitel, 16 Starts, Reihenfolge = Platz. Siehe [Bank-Identität beim Umsortieren](08-bank-identitaet-bei-umsortieren.md).
- pro Video: bestätigtes Quelltempo, nur solange eine Bank aus dem Video existiert. Siehe [Quelltempo in der Bank](06-quelltempo-in-der-bank.md).
- nie überschreiben, solange sie nicht gelesen wurde. Ist sie kaputt, wird das Speichern gesperrt. Siehe [Bank auf der Bühne robust laden](05-bank-auf-der-buehne-robust.md).
- Session-Datei: `bankId` statt `st.fav`, `st.favs` und Locks fallen weg, Track, Starts und Quelltempo bleiben als Kopie.

Offen:
- Datei- und Feldnamen
- eine Versionsnummer im Format
- atomares Schreiben
- wie gelöschte IDs gesperrt bleiben (Zähler statt Liste?)
- wie mehrere Devices bzw. Fenster gleichzeitig schreiben, ohne sich zu überschreiben
- was mit alten Session-Dateien (1.x) beim ersten Öffnen unter 2.0 passiert

Vieles ist technisch. Den Nutzer nur fragen, was ihn betrifft, z. B. ob die Datei von Hand lesbar und bearbeitbar sein soll.

## Answer

> **Teilweise überholt durch [Snippets statt ganzer WAV](11-snippets-statt-ganzer-wav.md):** Dazu kommt pro Bank eine Snippet-Datei, abgeleitet aus der `id`.

Geklärt am 2026-10-28 mit dem Nutzer. Fakten aus `ytsampler_node.js` (Session-Speicher `:739-810`) und `ytsampler_main.js` (`save`/`state` `:819-850`), dazu die drei Dateien in `~/Music/YTSampler/sessions/` (nur gelesen).

**Kernaussage:** Eine Datei `~/Music/YTSampler/library.json` mit `banks` (Reihenfolge = Platz) und `videos` (Titel, bestätigtes Tempo). Jede Änderung liest die Datei unter einer kurzen Sperre frisch ein, ändert sie und ersetzt sie atomar. Gelöschte IDs sperrt der Zähler `nextId`.

**Stand heute (Code)**
- `sessions/<nr>.json` = `{version: 1, saved, state}`. Dabei ist `state` ein String: `encodeURIComponent(JSON.stringify(st))` aus `[js]`. Node speichert ihn unverändert. Schlüssel heute: `id, title, pads, locks, favs, fav, bank, srcBpm, srcAuto, bpmConf`. Die Starts sind Fließkomma-ms.
- Atomar wird schon so geschrieben: `<datei>.tmp` schreiben, dann `renameSync` (`writeStateNow`), 400 ms entprellt.
- `<nr>.lock` enthält die PID des Node-Prozesses. Ist die Nummer schon in einem lebenden Prozess belegt (`pidAlive`), zweigt Node auf eine neue Nummer ab (`newsession`, Spur dupliziert).
- `stateReady` in `[js]`: Gespeichert wird erst, wenn `state` oder `statenone` gekommen ist. Eine kaputte Session-Datei landet aber als `statenone` und wird dann überschrieben.
- Heute liegen da `161774.json`, `576628.json` (je 4 Favoriten, September) und `255.json` (8 Favoriten, aktiv, `255.lock` mit lebender PID).
- Jedes Device hat einen eigenen Node-Prozess. Mehrere Devices bedeuten also mehrere Schreiber auf dieselbe Bibliothek.

**Entscheidungen des Nutzers**
1. **Von Hand lesen und bearbeiten:** „Egal, ich schaue nie hinein.“ Die Datei muss also nicht für Menschen gemacht sein. Sie wird trotzdem eingerückt geschrieben (kostet nichts, hilft bei der Fehlersuche und bei Sicherungskopien, Ticket 10). Eine Garantie fürs Bearbeiten von Hand gibt es nicht: Eine ungültige Datei gilt als kaputt (Ticket 05).
2. **Altes 1.x-Set unter 2.0:** Das Set klingt wie beim Speichern, das Device zeigt „keine Bank“ (wie Ticket 08, Fall 2). Favoriten werden nicht übernommen. Die alte Session-Datei bleibt als Kopie liegen.

**Format `library.json`**

```json
{
 "format": 1,
 "rev": 57,
 "nextId": 13,
 "banks": [
  {
   "id": 7,
   "name": "Funk",
   "video": "F2RnxZnubCM",
   "starts": [42962, 46333, 194740, 165892, 11435, 41259, 212877, 128466, 7643, 260155, 191096, 2210, 99015, 150020, 170433, 230871]
  },
  {
   "id": 12,
   "name": "Funk (Kopie)",
   "video": "F2RnxZnubCM",
   "starts": [42962, 46333, 194740, 165892, 11435, 41259, 212877, 128466, 7643, 260155, 191096, 2210, 99015, 150020, 170433, 230871]
  }
 ],
 "videos": {
  "F2RnxZnubCM": { "title": "Titanic • My Heart Will Go On • Celine Dion", "bpm": 99.5 }
 }
}
```

| Feld | Regel | Warum |
|---|---|---|
| `format` | Ganzzahl, heute `1`. Erhöht nur, wenn ein alter Leser die Datei falsch verstehen würde. | Eigene Zählung, unabhängig von `VERSION` und vom Session-Format. |
| `rev` | Ganzzahl, jede Änderung zählt +1. | Prozesse und der Editor erkennen damit Änderungen von außen (Undo-Historie leeren, Ticket 03). |
| `nextId` | Ganzzahl ≥ 1, wird nie kleiner. Neue Bank: `id = nextId`, danach `nextId + 1`. | Gelöschte IDs bleiben gesperrt, ohne dass man eine Liste führt (Ticket 08). |
| `banks` | Array, Index + 1 = Banknummer. Keine Obergrenze (Ticket 04). | Reihenfolge = Platz, ohne extra Feld. |
| `banks[].id` | Ganzzahl ≥ 1, eindeutig, < `nextId`. `0` heißt in der Session „keine Bank“. | Kurz und vergleichbar. |
| `banks[].name` | String, darf leer sein und doppelt vorkommen. Gespeichert wird er roh. Erst auf dem Weg nach Max läuft er durch `clean()`. | Die Datei liest nur Node, Max-Symbolregeln gelten erst im Patch. |
| `banks[].video` | YouTube-ID, muss in `videos` stehen. | Titel und Tempo stehen einmal pro Video. |
| `banks[].starts` | Genau 16 Zahlen, ganze ms, ≥ 0. Reihenfolge = Pad 1–16. | 1 ms ist unhörbar. Die Starts sind schon eingerastet (Editor), das Device rastet nicht nach (Ticket 12). So bleibt die Datei kurz. |
| `videos.<id>.title` | String, roh. | Der Titel stand im Ticket pro Bank, ist aber eine Eigenschaft des Videos. |
| `videos.<id>.bpm` | Nur wenn bestätigt (Ticket 06). Fehlt der Wert, gilt der Wert aus der Analyse. | `srcAuto` ist damit überflüssig: Gibt es `bpm`, ist er bestätigt. |

Ein Eintrag in `videos` existiert genau dann, wenn mindestens eine Bank ihn benutzt. Das Löschen der letzten Bank eines Videos entfernt ihn in derselben Änderung (Ticket 06, Punkt 7).

**Lesen und Prüfen**
- Datei fehlt → leere Bibliothek (`format 1, rev 0, nextId 1`), die Datei entsteht beim ersten Schreiben. Das Device zeigt „Bibliothek leer“ (Ticket 05).
- Kaputt ist sie, wenn eines davon zutrifft: kein gültiges JSON, `format` keine `1`, ein Pflichtfeld fehlt oder hat den falschen Typ, eine ID ist doppelt oder ≥ `nextId`, `starts` hat nicht genau 16 Zahlen, oder `video` fehlt in `videos`. Dann wird das Speichern gesperrt, Device und Editor zeigen einen Fehler, und die Pads sind stumm (Ticket 05, Punkt 8). Die Datei wird nie angefasst. Erst wenn sie wieder gültig gelesen wurde (siehe „Änderungen von außen“), geht das Speichern wieder.
- Ein `format` > 1 (von einer neueren Version) gilt ebenso als kaputt, mit der Meldung „Bibliothek aus neuerer Version“.
- Unbekannte Felder sind erlaubt und bleiben beim Schreiben erhalten (Node ändert das gelesene Objekt, statt es neu aufzubauen).
- Verwaiste `videos`-Einträge sind kein Fehler. Sie werden beim nächsten Schreiben entfernt.

**Schreiben**
Jede Änderung ist ein Vorgang, z. B. umbenennen, verschieben, löschen, Starts setzen oder Tempo bestätigen. Er läuft in Node synchron und am Stück:
1. Sperre `library.lock` holen (siehe unten).
2. `library.json` frisch lesen und prüfen. Ist sie kaputt: abbrechen, Sperre freigeben, Speichern sperren.
3. Den Vorgang auf diesen frischen Stand anwenden, `rev + 1`.
4. `library.json.tmp` schreiben (`JSON.stringify(lib, null, 1)`), `fsync`, dann `rename` auf `library.json`. Wie `writeStateNow` heute, nur mit `fsync`, weil hier kuratierte Arbeit drinsteckt.
5. Sperre freigeben, Ergebnis an `[js]` und Editor melden.

Weil jeder Vorgang den frischen Stand liest, überschreibt kein Prozess die Änderung eines anderen. Einen Merge braucht es nicht. Vorgänge, die sich auf eine ID beziehen, schlagen fehl, wenn die ID inzwischen fehlt (z. B. „umbenennen“ einer Bank, die ein anderes Fenster gelöscht hat). Ein Vorgang, der sich auf einen Platz bezieht, wird beim Absenden in die ID übersetzt. Entprellt wird nur das Ziehen von Markern im Editor (wie heute 400 ms), damit nicht jeder Pixel einen Schreibvorgang auslöst. Alles andere wird sofort geschrieben.

**Sperren**
- `library.lock` wird mit `fs.openSync(…, 'wx')` angelegt und enthält die PID. Existiert die Datei schon, ist die Sperre belegt.
- Ist die PID tot (`pidAlive` wie heute) oder die Datei älter als 5 s, wird die Sperre übernommen: löschen, neu anlegen. So blockiert ein abgestürzter Prozess nichts.
- Bei belegter Sperre wartet Node in kurzen Schritten bis zu 1 s. Danach bricht der Vorgang mit der Meldung „Bibliothek belegt“ ab. Praktisch kommt das nicht vor, denn die Sperre hält nur Millisekunden.
- Gesperrt wird nur fürs Schreiben, Lesen geht immer. Das ist sicher, weil `rename` atomar ist.

**Änderungen von außen**
- Jeder Node-Prozess beobachtet `library.json` (`fs.watchFile`, 500 ms) und liest neu ein, wenn sich `rev` geändert hat. Danach berechnet er den Platz der aktiven ID neu (Ticket 08) und meldet es an `[js]` und den Editor.
- Node merkt sich die `rev` seiner eigenen letzten Schreibvorgänge. Ist die neue `rev` nicht von ihm, gilt die Änderung als von außen: Der Editor leert seine Undo-Historie (Ticket 03). Ein Bankwechsel am Device schreibt nichts in die Bibliothek und ändert `rev` deshalb nicht.

**Gelöschte IDs und Undo**
- Durch `nextId` wird eine gelöschte ID nie neu vergeben.
- Undo nach dem Löschen darf eine Bank mit ihrer alten ID wieder einsetzen. Das geht, wenn die ID < `nextId` ist und gerade nicht vergeben ist. `nextId` bleibt dabei gleich.

**Session-Datei 2.0** (`sessions/<nr>.json`)

```json
{"version": 2, "saved": "2026-10-28T20:15:00.000Z", "state": "<encodeURIComponent von:>"}
```
```json
{"bankId": 7, "id": "F2RnxZnubCM", "title": "Titanic • My Heart Will Go On • Celine Dion",
 "pads": [42962, 46333, 194740, …], "srcBpm": 99.5, "srcAuto": 0, "bpmConf": 0.42}
```
- `state` bleibt ein URI-kodierter String. Der Weg aus `[js]` über `savestate` passt so (Max-Symbolregeln), Node ändert nichts daran.
- Neu ist `bankId` (`0` = keine Bank). Es fallen weg: `favs`, `fav`, `bank`, `locks` (die Pad-Locks) und `mem`.
- `id`, `title`, `pads`, `srcBpm`, `srcAuto` und `bpmConf` bleiben als Kopie. Sie gelten nur, wenn die Bank mit `bankId` fehlt (Ticket 08, Fall 2). Gibt es die Bank, gelten Starts und Tempo aus der Bibliothek.
- `.lock`-Datei, Abzweigen bei duplizierter Spur, `stateReady` und atomares Schreiben bleiben wie heute. Die „Locks“ im Ticket meinten nur `st.locks`, nicht `<nr>.lock`.

**Übergang von 1.x**
- Node liest beim `session`-Befehl `version`. Bei `1` oder einer fehlenden Version kopiert er die Datei einmal nach `sessions/<nr>.v1.json`, falls es die Kopie noch nicht gibt, und reicht `state` wie gewohnt an `[js]`.
- `[js]` (`state()`) liest nur noch `bankId`, `id`, `title`, `pads` und das Tempo. Fehlt `bankId`, gilt `0`: Das Device zeigt „keine Bank“ und klingt wie beim Speichern (Entscheidung 2). Favoriten werden nicht übernommen (Karte: „Import der alten Favoriten“ ist außerhalb).
- Das nächste Autosave schreibt `version: 2`. Die `.v1.json` wird nie automatisch gelöscht.
- Eine `library.json` wird dabei nicht angelegt. Sie entsteht erst mit der ersten Bank aus dem Editor.

**Folgen für andere Tickets**
- Ticket 07 (Protokoll): Befehle beziehen sich auf die ID, nicht auf den Platz. „Gelöschte Bank wiederherstellen“ braucht `id`, Platz, Name, Video, Starts und den `videos`-Eintrag (Titel, `bpm`). Wurde die letzte Bank eines Videos gelöscht, ist dessen Eintrag samt bestätigtem Tempo schon weg und muss mit dem Undo zurückkommen. Antworten auf Vorgänge, die nicht klappen: „ID fehlt“, „Bibliothek kaputt“, „Bibliothek belegt“.
- Ticket 07: Eine Tempokorrektur am Device schreibt in die Bibliothek und ändert `rev`. Fürs erste Device ist das keine Änderung von außen, für den Editor aber schon. Sollte der Editor dann seine Undo-Historie leeren? Vorschlag: Node meldet „Tempo geändert vom Device“ als eigene Art, und die Historie bleibt.
- Ticket 10 (Sicherung): Die Datei ist eingerückt und klein, Sicherungskopien lassen sich also leicht vergleichen. Wird `library.json.tmp` umbenannt, ist das ein guter Moment für eine Kopie.
