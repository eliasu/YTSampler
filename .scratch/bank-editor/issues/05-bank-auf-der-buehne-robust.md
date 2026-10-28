# Bank auf der Bühne robust laden

Type: grilling
Status: resolved

## Question

Was passiert, wenn eine Bank auf der Bühne nicht sofort spielbar ist?

- Die WAV fehlt im Cache (gelöscht, anderer Rechner): Wird automatisch nachgeladen, oder wird die Bank übersprungen bzw. markiert? Soll der Editor dafür sorgen, dass jede Bank im Cache liegt?
- Das Video ist bei YouTube verschwunden: Ist die Cache-WAV dann die einzige Kopie, die nie gelöscht werden darf?
- Ist die Bibliothek leer, oder ist die Datei kaputt?
- Was hört man während des Ladens einer Bank: laufen alte Stimmen weiter oder ist sofort Stille?

## Answer

> **Teilweise überholt durch [Snippets statt ganzer WAV](11-snippets-statt-ganzer-wav.md):** Auf der Bühne werden nur Snippets geladen, ganze WAVs und Internet nur noch im Editor.

Geklärt am 2026-10-28 in zwei Runden mit dem Nutzer.

**Stand heute (Code)**
- Node lädt nur dann neu, wenn `<id>.wav` oder `<id>.json` im Cache fehlt (`loadVideo`). Liegen beide da, braucht es kein Netz. Der Cache wird nie aufgeräumt (heute 177 Dateien, 2,3 GB).
- Während eines Ladevorgangs wird jedes weitere `load` abgelehnt (`busy`, „Lade noch …“). Es gewinnt also der erste Wunsch.
- Beim Wechsel werden die Stimmen nicht gestoppt. Bis `loaded` spielen die Pads das alte Video. Dann ersetzt `buffer~ replace` die Datei, und Stimmen, die noch klingen, lesen an ihrer Position aus der neuen WAV weiter. Das gibt einen Sprung, im Hold-Modus bis zum Songende.
- Fehlt die Session-Datei oder ist sie unlesbar, kommt `statenone`, das Device startet leer. Eine kaputte Datei überschreibt das nächste Autosave. Für die Bibliothek darf das nicht passieren.

**Entscheidungen**
1. **Klang beim Bankwechsel:** Die alte Bank bleibt spielbar, bis die neue bereit ist. Beim Tausch blenden alle klingenden Stimmen kurz aus, statt in die neue WAV zu springen.
2. **Weiterdrehen während des Ladens:** Die letzte Wahl gewinnt. Ein laufender Download wird abgebrochen.
3. **WAV fehlt im Cache:** Das Device lädt sie automatisch nach und zeigt dabei „Lädt“ mit Prozent an. Die alte Bank bleibt bis dahin spielbar (siehe 1).
4. **Editor und Cache:** Der Editor markiert jede Bank, deren WAV fehlt. Der Knopf „Alle nachladen“ holt alle fehlenden WAVs. Wird dabei die Bank gewechselt, hat der Wechsel Vorrang, danach geht es weiter. Fehlschläge werden markiert und übersprungen.
5. **Video bei YouTube verschwunden:** Die Bank bleibt in der Bibliothek, nichts wird automatisch gelöscht. Der Cache wird nie automatisch aufgeräumt, die Cache-WAV ist damit unter Umständen die einzige Kopie.
6. **Bank nicht ladbar auf der Bühne** (Video weg, kein Netz): Die Anzeige springt zurück auf die Bank, die gerade klingt, dazu kommt kurz die Meldung „nicht ladbar“.
7. **Markierung „nicht ladbar“:** Sie wird nicht in der Bibliothek gespeichert. Der Editor prüft den Cache selbst, und „nicht ladbar“ gilt nur bis zum nächsten Versuch.
8. **Bibliotheksdatei kaputt:** Sie wird nie überschrieben. Device und Editor zeigen einen Fehler, und das Speichern bleibt gesperrt, bis die Datei repariert ist. Die Pads sind dann stumm wie bei einer leeren Bibliothek.
9. **Bibliothek leer:** Das Device zeigt „Bibliothek leer – Bank im Editor anlegen“, die Pads sind stumm.

**Folgen für die Umsetzung**
- `busy`-Ablehnung wird zu „neuester Wunsch bricht den laufenden `yt-dlp` ab“.
- Der Wechsel braucht in `[js]` vor `buffer~ replace` ein Ausblenden aller Stimmen, also `gateoff` mit wenigen ms an alle 16 in beiden `poly~`, und erst danach den Tausch. Achtung: Heute geht `loaded` im Patch direkt an `buffer~ replace`, an `[js]` vorbei. Das muss umverdrahtet werden, sodass `[js]` das Ersetzen nach dem Fade selbst auslöst.
- Ein Download-Fehler muss als eigene Meldung an `[js]` gehen (heute nur `status`), damit die Bankanzeige zurückspringen kann.
- Die Bibliothek wird nur gespeichert, wenn sie gelesen wurde. Dasselbe Prinzip gilt heute mit `stateReady` für die Session.
