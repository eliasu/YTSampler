# Bank-Identität beim Umsortieren

Type: grilling
Status: resolved

## Question

Der Regler `Bank` und das gespeicherte Set merken sich eine Bank über ihre Position (1–128), siehe [Device-Oberfläche 2.0](04-device-oberflaeche-2.md). Was soll passieren, wenn du im Editor Bänke verschiebst, duplizierst oder löschst?

Ein Set wurde mit Bank 7 gespeichert, danach rutscht durch eine neue Sortierung eine andere Bank auf Platz 7. Gibt es dann den Ton von Platz 7 (also die neue Bank), oder bekommt jede Bank eine feste ID, der das Set folgt? Ein MIDI-Mapping auf CC-Werte zeigt in jedem Fall auf eine Position.

## Answer

Geklärt am 2026-10-28 in zwei Runden mit dem Nutzer. Fakten aus `ytsampler_main.js` und `YT Sampler.maxpat` (Stand 1.3.1).

**Stand heute (Code)**
- `Fav Select` (`live.numbox` 1–64) wird von Live zwar wiederhergestellt, `favselect()` ist beim Laden aber durch `ready()` gesperrt. Der Wert bewirkt beim Öffnen nichts.
- Den Klang stellt allein die Session-Datei her. Das Set kennt sie über den unsichtbaren Parameter `Session` (Zahl 1–999999, `sessions/<nr>.json`). Darin stehen Video-ID, Titel und die 16 Starts als Kopie, dazu `st.fav` als Platznummer. `state()` lädt danach `st.id`. Ein Set klingt heute also wie beim Speichern, auch wenn der Favorit seitdem geändert wurde.

**Entscheidung: Jede Bank hat eine feste ID, die man nicht sieht**
- Die ID entsteht beim Anlegen und ändert sich nie, auch nicht beim Verschieben oder Umbenennen. Der Nutzer sieht nur Nummer (Platz in der Bibliothek) und Name.
- Die Session-Datei merkt sich die ID der aktiven Bank, dazu weiterhin Track und Starts als Kopie.
- Auf der Bühne zählt nur die Nummer: Regler `Bank`, Vor/Zurück und MIDI-Mappings treffen immer einen Platz. CC 6 lädt also, was gerade auf Platz 7 steht. Der Editor warnt beim Umsortieren nicht.

**Was wann passiert**
1. **Set öffnen:** Das Device lädt die Bank mit der gespeicherten ID, so wie sie jetzt in der Bibliothek steht, und stellt den Regler auf ihren aktuellen Platz. Den Wert von `Bank` aus dem Set ignoriert es dabei. Beispiel: „Funk“ war beim Speichern auf 7 und steht jetzt auf 3. Dann lädt „Funk“, und der Regler springt auf 3. Das präzisiert „Set öffnen“ in [Device-Oberfläche 2.0](04-device-oberflaeche-2.md).
2. **Gespeicherte Bank inzwischen gelöscht:** Das Device stellt Track und Starts aus der Session-Datei wieder her und zeigt „keine Bank“ (wie nach Teletext-Laden), dazu kurz die Meldung „Bank gelöscht“. Das Set klingt wie beim Speichern.
3. **Aktive Bank verschieben:** Das Device bleibt auf der Bank, es wird nichts geladen. Nur Nummer und Regler springen auf den neuen Platz.
4. **Andere Bank verschieben:** Die aktive Bank rutscht eventuell auf eine andere Nummer, dann gilt dasselbe wie bei 3.
5. **Aktive Bank löschen:** Die Bank, die auf denselben Platz nachrückt, wird aktiv und lädt. War es die letzte Bank, lädt die davor. War es die einzige, gilt „Bibliothek leer“ aus [Bank auf der Bühne robust laden](05-bank-auf-der-buehne-robust.md).
6. **Duplizieren:** Das Original behält seine ID, die Kopie bekommt eine neue. Sets folgen dem Original. Die Kopie wird aktiv (Ticket 03), das Device lädt sie (gleiches Video, nur die Starts werden umgeschaltet).
7. **Undo/Redo:**
   - Undo nach Löschen stellt die Bank mit derselben ID an ihrem alten Platz wieder her, Sets finden sie dann wieder. War sie vorher aktiv, wird sie wieder aktiv.
   - Undo nach Verschieben stellt den alten Platz wieder her. Das Device bleibt auf seiner Bank (wie bei 3).
   - Undo nach Duplizieren entfernt die Kopie, dafür gilt dieselbe Regel wie bei 5.
8. **Mehrere Devices:** Jedes Device hat eigene Session-Datei und eigenen Regler. Für alle gilt dieselbe Regel: Die Nummer springt mit, beim Löschen lädt der Nachrücker. Der Editor bedient trotzdem nur das erste Device.

**Folgen für die Umsetzung**
- Das Bibliotheksformat braucht pro Bank ein Feld `id`, eindeutig und nie wiederverwendet. Gelöschte IDs dürfen nicht neu vergeben werden, sonst landet ein altes Set auf einer fremden Bank.
- In der Session-Datei kommt `bankId` dazu (statt `st.fav`). `st.id`, `st.pads` und Quelltempo bleiben als Kopie für Fall 2.
- Beim Öffnen ist `Bank` wegen `ready()` ohnehin gesperrt, das passt. Nach `state` sucht `[js]` bzw. Node die ID in der Bibliothek und setzt `Bank` per `setNamed` auf den Platz. Das darf keinen zweiten Ladevorgang auslösen.
- Ändert der Editor die Reihenfolge, müssen alle Devices ihre Anzeige neu berechnen (Platz der aktiven ID). Laden wird dabei nur im Fall 5 ausgelöst.
- Der Undo-Verlauf muss eine gelöschte Bank samt `id` und Platz aufbewahren.
- Nachtrag, vom Nutzer bestätigt: Das Löschen-Modal aus [Editor-Layout](03-editor-layout.md) („lässt sich nicht rückgängig machen“) fällt weg. Löschen geht sofort, zurück geht es mit Undo. Ticket 03 muss angepasst werden.
- Bestätigt für die Karte (Format der Bibliotheksdatei): `id` pro Bank, nie wiederverwendet. `bankId` in der Session-Datei statt `st.fav`.
