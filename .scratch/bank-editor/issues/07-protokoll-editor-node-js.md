# Protokoll Editor ↔ Node ↔ `[js]`

Type: grilling
Status: open
Blocked by: 09

## Question

Wie sehen die Nachrichten zwischen Editor, Node und `[js]` aus, genau genug zum Bauen?

- **Befehle aus dem Editor** (`POST /cmd`), abgeleitet aus [Editor-Layout](03-editor-layout.md): Bank wählen, umbenennen, duplizieren, löschen, verschieben, suchen, Treffer als neue Bank, Pad anspielen, Pads tauschen, Start setzen, ein Pad neu würfeln, alle fehlenden WAVs nachladen, dazu Undo/Redo. Welche erledigt Node allein (Bibliothek), welche gehen an `[js]`?
- **Zustandsmeldung von `[js]`** (`bankstate`) und was der SSE-Strom dem Editor schickt.
- **Format von `/peaks/<id>`.**
- **Erstes Device:** Es ist das, welches Port 8765 zuerst belegt, nicht die erste Spur. Wird das erste Device neu geladen, während ein zweites läuft, landet das zweite auf 8765. Reicht das, oder braucht der Editor einen Hinweis, welches Device er gerade steuert?
- Undo-Befehle aus [Editor-Layout](03-editor-layout.md): eine gelöschte Bank samt ID wiederherstellen, alle Starts einer Bank auf einmal setzen. Die Historie liegt im Browser. Ändert sich die Bibliothek von außen, leert sie sich.
- **Fehlermeldungen:** Download fehlgeschlagen, Bibliothek kaputt.

Grundlage: [Bestehender Webserver und Datenwege](02-bestehender-webserver-und-datenwege.md). Vieles davon ist eher technisch als Geschmackssache. Dem Nutzer nur vorlegen, was ihn auf der Bühne oder beim Kuratieren betrifft.
