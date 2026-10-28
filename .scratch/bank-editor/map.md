# Bank-Editor

## Destination

Eine Spezifikation (`.scratch/bank-editor/spec.md`) für den Bank-Editor im Browser und das umgebaute Device 2.0. Sie ist so vollständig, dass Arbeitssessions sie ohne Rückfragen umsetzen können.

## Notes

- Domäne: Max-for-Live-Device „YT Sampler“, siehe `CLAUDE.md` (Signalfluss, Protokolle, Fallen) und `GLOSSARY.md` (Pad, Bank, Bibliothek).
- Grilling-Tickets: Skills `grilling` und `domain-modeling`. Fragen als klickbare Karten im Chat stellen, der Nutzer wünscht das so.
- Leitlinie: Live-Werkzeug für die Bühne. Im Zweifel einfacher, Spezialfunktionen lehnt der Nutzer ab.
- Mit dem Nutzer Deutsch reden.
- Diese Karte entscheidet nur. Gebaut wird danach in eigenen Sessions mit Worktree, gemergt und released nur in der Master-Session.

## Decisions so far

- [Grundsatzentscheidungen zum Bank-Editor](issues/01-grundsatzentscheidungen.md): Bank = 1 Track + 16 Starts, Länge vom Device, globale Bibliothek ersetzt Favoriten (2.0), Editor ist Fernbedienung fürs erste Device mit Autosave, Device nur Bank-Regler + Vor/Zurück + Anzeige.
- [Bestehender Webserver und Datenwege](issues/02-bestehender-webserver-und-datenwege.md): Server kann SSE und POST, kennt aber nur Teletext-Zustand. Pads/Starts kennt nur `[js]`, muss neu an Node melden. Waveform über `/peaks` aus Node statt WAV im Browser. Pad-Anschlag fast fertig.
- [Editor-Layout](issues/03-editor-layout.md): dunkles Dashboard, Bibliothek links als Liste (umbenennen, duplizieren, löschen, verschieben), rechts Waveform mit Zoom und Markern über 4×4-Pads mit Detailspalte, Suche als Slide-in, Treffer → neue Bank. Prototyp verlinkt. Undo/Redo wird gerade nachgetragen.
- [Device-Oberfläche 2.0](issues/04-device-oberflaeche-2.md): linker Fav- und Suchblock fällt weg, neu sind `Bank` (numbox 1–128), `Bank Prev`/`Bank Next` (ohne Kreis, 350 ms Ruhe) und eine große Anzeige. 26 alte Parameternamen fallen weg, das Device wird etwa 1000 breit. Teletext darf weiter laden („keine Bank“). Grid-Overlay-Fehler vorher beheben.
- [Bank auf der Bühne robust laden](issues/05-bank-auf-der-buehne-robust.md): Die alte Bank klingt, bis die neue bereit ist, dann kurzer Fade. Die letzte Wahl gewinnt und bricht den Download ab. Fehlendes wird nachgeladen. Nichts wird automatisch gelöscht. Eine kaputte Bibliothek wird nie überschrieben. `loaded` muss über `[js]` laufen.
- [Quelltempo in der Bank](issues/06-quelltempo-in-der-bank.md): Das bestätigte Tempo gilt pro Video und steht in der Bibliotheksdatei, nur bestätigte Werte werden gespeichert. Korrigiert wird im Editor (mit „Tempo stimmt“) und am Device (½×, 2×, Zahlenfeld bleiben). Starts rasten nicht neu ein.
- [Bank-Identität beim Umsortieren](issues/08-bank-identitaet-bei-umsortieren.md): Jede Bank hat eine feste, unsichtbare ID. Das Set folgt der ID, Regler und MIDI treffen den Platz. Wird die aktive Bank gelöscht, lädt der Nachrücker. Ist die gespeicherte Bank weg, bleibt die Kopie aus der Session.
- Nachtrag zu [Editor-Layout](issues/03-editor-layout.md): Undo/Redo für alle Änderungen an Pads und Bibliothek, 100 Schritte, nur im Browser. Löschen geht ohne Rückfrage, weil Undo es auffängt. Das überholt „Löschen mit Rückfrage“ aus Ticket 01.
- [Format der Bibliotheksdatei](issues/09-format-der-bibliotheksdatei.md): `library.json` mit `banks` (Reihenfolge = Platz) und `videos` (Titel, bestätigtes `bpm`), `nextId` sperrt gelöschte IDs, `rev` zeigt Änderungen von außen. Jede Änderung: Sperre, frisch lesen, atomar ersetzen. Session-Datei v2 mit `bankId`, 1.x-Sets klingen wie gespeichert und zeigen „keine Bank“.
- [Sicherung der Bibliothek](issues/10-sicherung-der-bibliothek.md): Der ganze Datenordner (außer `chrome-profile/`) zieht nach iCloud Drive mit „Geladen lassen“, dazu die letzten 10 Stände der Bibliothek. Kein Export, kein Knopf, keine Time Machine.
- [Bank speichert Snippets statt ganzer WAV](issues/11-snippets-statt-ganzer-wav.md): 16 Snippets à 16 s pro Bank. Hold endet am Snippet-Ende, rückwärts spielt das Snippet von hinten. Ganze WAVs nur im Editor, lokaler Wegwerf-Cache mit Warnung ab 10 GB. Device-Waveform zeigt die Snippets. Überholt Teile von 01, 04, 05, 09, 10.
- [Analyse im Device mit Snippets](issues/12-analyse-im-device-mit-snippets.md): Die Analyse des ganzen Tracks wird beim Schneiden neben die Snippets gelegt, das Device rechnet weiter in Song-Koordinaten. Tune, Tempo, Beats, „1“ und Warp+Grid klingen wie heute. Starts rasten nur im Editor ein, am Device sitzen sie fest.
- [Protokoll Editor ↔ Node ↔ `[js]`](issues/07-protokoll-editor-node-js.md): Node hält Bibliothek, Snippets und Cache, `[js]` spielt nur die Snippet-Datei der aktiven Bank. Der Editor spricht über `POST /cmd` (ID-basiert) und `GET /editor/events` (SSE). Snippet-Datei `snippets/<bankId>.wav` mit 16 Fächern à 16 s. Kopfzeile zeigt das gesteuerte Device. Analyse-Nachrichten und `snips` aus Ticket 12 nachgetragen.

## Not yet specified

- [`spec.md`](spec.md) ist geschrieben, mit 7 Bau-Paketen. Offen sind noch zwei Fragen zum Editor (Layout merken, Tempo-Bedienung), die Paket 5 blockieren.

## Out of scope

- Teletext weiterentwickeln: Es bleibt, wie es ist.
- Pads aus mehreren Tracks in einer Bank, eigenes Ende pro Pad, Länge pro Bank.
- Wiedergabe im Browser ohne Live und Editor ohne laufendes Device.
- Auswahl zwischen mehreren Devices im Editor.
- Import der alten Favoriten.
