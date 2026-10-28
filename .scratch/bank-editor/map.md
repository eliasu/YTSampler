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

## Not yet specified

- Protokoll Editor ↔ Node ↔ `[js]` im Detail (Befehle für `POST /cmd`, `bankstate`-Meldung, `/peaks`-Format). Die Bausteine sind seit dem Research-Ticket bekannt. Scharf wird es, wenn das Editor-Layout steht und damit die Befehle feststehen.
- „Erstes Device“ = wer Port 8765 zuerst belegt, nicht die erste Spur. Wird das erste Device neu geladen, während ein zweites läuft, landet das zweite auf 8765. Reicht das, oder braucht der Editor einen Hinweis?
- Format der Bibliotheksdatei und Umgang mit Session-Datei und `st.favs` beim Umbau auf 2.0.
- Sicherung der Bibliothek (kuratierte Arbeit, wertvoll): mit ins Git, Backup-Kopie oder nichts?
- Am Ende: alles in `spec.md` zusammenschreiben und in Umsetzungs-Tickets schneiden.

## Out of scope

- Teletext weiterentwickeln: Es bleibt, wie es ist.
- Pads aus mehreren Tracks in einer Bank, eigenes Ende pro Pad, Länge pro Bank.
- Wiedergabe im Browser ohne Live und Editor ohne laufendes Device.
- Auswahl zwischen mehreren Devices im Editor.
- Import der alten Favoriten.
