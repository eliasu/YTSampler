# Format der Bibliotheksdatei

Type: grilling
Status: open

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
