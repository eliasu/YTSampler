# Editor-Layout

Type: prototype
Status: resolved

## Question

Wie sieht der Editor auf einer Seite aus: Bankliste (sortierbar, umbenennbar, löschbar), Suche, die 16 Pads im 4×4-Raster (Pad 1 unten links wie am Controller, per Drag tauschbar, „Neues Snippet“, anspielbar) und die Waveform mit 16 ziehbaren Start-Markern samt Schlagraster?

Ein grober klickbarer HTML-Prototyp mit Attrappendaten, ohne Anbindung ans Device. Der Nutzer reagiert darauf, ob die Anordnung beim Kuratieren trägt.

## Answer

Geklärt am 2026-10-28 in zwei Runden mit dem Nutzer am Prototyp [`prototype/editor-layout.html`](../prototype/editor-layout.html) (im Browser öffnen, Attrappendaten, Wegwerfcode).

Der Editor ist ein ruhiges, modernes Arbeits-Dashboard: dunkel, klare Typografie, kein Schnickschnack. Für Nebensachen gibt es Slide-ins und Modale, damit die Hauptfläche frei bleibt.

**Anordnung** (Runde 1: Layout A „Liste links“ statt „Waveform oben“ oder „Bänke als Leiste“)
- Kopfzeile: Bibliothek ein- und ausklappen, Vor/Zurück mit „Nr / Anzahl + Bankname“, Hinweis „automatisch gespeichert“, Verbindung zum Device, Knopf „Video suchen“ (⌘K).
- Links die Bibliothek als senkrechte Liste: Nummer, Name und darunter klein Videotitel · BPM. Die aktive Bank ist hervorgehoben.
- Rechts oben die Waveform mit den 16 Markern, darunter die Pads. Beide liegen auf derselben Fläche.

**Bibliothek**
- Pro Bank drei kleine Icons (bei Hover und an der aktiven Bank): umbenennen (auch per Doppelklick in der Zeile), duplizieren, löschen.
- Duplizieren ist neu gegenüber Ticket 01. Die Kopie heißt „<Name> (Kopie)“, landet direkt unter dem Original und wird aktiv.
- Löschen geht sofort, ohne Rückfrage. Danach erscheint 5 s lang ein Hinweis „Bank … gelöscht · Rückgängig“ (Nachtrag Undo/Redo, ersetzt das Modal und damit „Löschen mit Rückfrage“ aus Ticket 01).
- Reihenfolge ändern per Drag in der Liste.
- Bank wechseln per Klick, mit Vor/Zurück oder mit ↑/↓.

**Suche**
- Ein Slide-in von rechts, kein fester Bereich. Die Treffer kommen mit Vorschaubild, Titel und Dauer.
- Einen Treffer auf die Pads ziehen oder anklicken legt eine **neue Bank am Ende** der Bibliothek an (Nutzer bestätigt, kein Ersetzen). Beim Ziehen gleitet das Panel zur Seite, die Pads zeigen eine Ablagefläche.

**Waveform**
- Ganzer Track mit Taktlinien, die „1“ ist betont, ab 4× Zoom kommen die Schlaglinien dazu. Zoomen geht mit 1×/4×/16× oder mit ⌘/Strg + Mausrad, darunter wird horizontal gescrollt.
- Marker mit Pad-Nummer. Ziehen rastet auf Schläge, mit Alt läuft der Marker frei. Beim Ziehen zeigt eine Blase die Zeit.
- Das gewählte Pad ist farbig, seine Slice-Länge (vom Device) liegt als Fläche hinter dem Marker. Beim Anspielen läuft ein Abspielkopf.

**Pads**
- 4×4, Pad 1 unten links. Ein Klick spielt das Pad an und wählt es aus, die Waveform scrollt dann zu seinem Marker.
- Ein Pad auf ein anderes ziehen tauscht die beiden.
- „Neues Snippet“ als Würfel-Icon auf dem Pad (bei Hover) und als Knopf in der Detailspalte.
- Jedes Pad zeigt seine Startzeit und einen Mini-Balken, wo im Track es liegt.
- Rechts neben dem Raster steht eine Detailspalte für das gewählte Pad: Nummer, Start, „Länge: vom Device“, Video · BPM, dazu „Neues Snippet“ und „Anspielen“.

**Anpassen:** nur Größen. Die Breite der Bibliothek lässt sich ziehen, die Bibliothek einklappen und die Grenze zwischen Waveform und Pads verschieben. Keine frei anordnenden Panels, kein Hell/Dunkel-Umschalter. Ob die Größen gespeichert werden, ist offen (im Prototyp nicht).

**Für das Protokoll** (Befehle, die das Layout braucht): Bank wählen, umbenennen, duplizieren, löschen, verschieben; suchen; Treffer als neue Bank; Pad anspielen; Pads tauschen; Start setzen; ein Pad neu würfeln.

**Undo/Redo** (Nachtrag am 2026-10-28, im Prototyp eingebaut, alle Empfehlungen vom Nutzer bestätigt)
- Rückgängig machen lässt sich jede Änderung an Pads und Bibliothek: Start setzen, Pads tauschen, neues Snippet, umbenennen, verschieben, duplizieren, neue Bank, löschen. Der Bankwechsel selbst ist kein Schritt.
- Undo und Redo springen zu der Bank, in der die Änderung passiert ist (die Bank wird gewählt, das Device lädt sie mit). Ein Hinweis sagt, was zurückgenommen wurde („Rückgängig: Start Pad 3 verschoben“).
- Löschen geht ohne Rückfrage, weil Undo es auffängt (siehe Bibliothek). Ticket 01 ist damit an dieser Stelle überholt.
- Bedienung: ⌘Z und ⇧⌘Z, dazu Knöpfe ↶ ↷ in der Kopfzeile neben dem Banknamen. Ihr Tooltip nennt den Schritt. Ohne Schritt sind sie ausgegraut. In Eingabefeldern (Umbenennen, Suche) gilt das Undo des Browsers.
- Eine neue Änderung nach Undo verwirft die Redo-Schritte (lineare Historie).
- Die Historie hält 100 Schritte, solange der Editor offen ist. Neuladen des Editors leert sie, sie wird nicht gespeichert. Damit liegt sie im Browser, Node muss sie nicht kennen.
- Fürs Protokoll: Undo setzt einen früheren Zustand wieder ein (Bibliothek mit Namen, Reihenfolge und 16 Starts je Bank). Gebraucht wird ein Befehl, der eine gelöschte Bank wiederherstellt (mit ihrer ID, damit Cache und Peaks passen), und einer, der die Starts einer Bank auf einmal setzt.
- Zwei offene Editor-Fenster haben je eine eigene Historie. Das ist so gewollt (Nutzer bestätigt).
- Ändert sich die Bibliothek von außen (z. B. aus dem zweiten Fenster), leert sich die Historie, Undo/Redo sind ausgegraut, und ein Hinweis sagt es. Sonst würde Undo fremde Änderungen überschreiben. Der Bankwechsel am Device ist keine Änderung und leert nichts. Da das Device in 2.0 nur auswählt und spielt, trifft das praktisch nur den Fall „zwei Fenster“.
