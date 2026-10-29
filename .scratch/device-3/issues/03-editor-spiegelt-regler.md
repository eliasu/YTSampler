# Editor spiegelt die Device-Regler

Type: grilling
Status: resolved

## Question

Der Editor soll die Samples mit den echten Einstellungen hörbar machen. Welche Regler zeigt er? Wer hält den Zustand, wie läuft die Synchronisation, und was passiert mit Undo, Automation und MIDI-Mappings?

## Answer

Entschieden vom Nutzer (Auftrag, 2026-10-29), dazu F2. Technik festgelegt in der Planung.

**Ein Zustand:** die echten Live-Parameter des ersten Device (Port 8765). Der Editor hat keine eigene Kopie. Dreht man am Device, aktualisiert sich der Editor. Stellt man im Editor, bewegt sich der Regler im Device. Alles steht im Set wie jeder andere Parameterwert.

**Welche Regler (F2, Nutzer 2026-10-29, abweichend von der Empfehlung):** alle Device-Regler außer der Bankwahl. Bühne: Division, Mode, Rev, Tune, Warp, Quant, Rate. Einrichten: Volume, Voices, Base Note. Der Editor zeigt beide Gruppen getrennt, die Einricht-Gruppe gedämpft.

**Wie**
- `[js]` kennt alle Werte (`P`). Es meldet sie im bestehenden `bankstate` mit, angehängt am Ende. `bankstate` geht ohnehin nur bei Änderung raus und wird bei jeder Regleränderung neu gerechnet (die Spannen hängen von Division, Rate und Warp ab).
- Node legt die Werte in das SSE-Event `device` als `params`.
- Der Editor schickt `POST /cmd {cmd: "param", name, value}`. Node prüft und schickt `param <name> <wert>` an `[js]`. `[js]` stellt den Regler per `setNamed(<varname>, <wert>)`. Der Regler gibt den Wert aus, er läuft über `prepend` in den normalen Handler, `[js]` meldet ihn per `bankstate` zurück. Es gibt keine zweite Wahrheit und keine Schleife: Der Editor schickt nur bei Bedienung.
- Die varnames gibt es schon: `Division`, `Rate`, `Mode`, `Reverse`, `Tune`, `Warp`, `Quantize`, `Volume`, `Voices`, `Base Note`.
- Volume kennt `[js]` heute nicht: `live.gain~` geht nur in den Signalweg. Der Patch bekommt deshalb eine Verbindung vom Werte-Ausgang des `live.gain~` über `prepend volume` an `[js]`. `[js]` merkt sich den Wert nur zum Melden, am Klang ändert sich nichts.

**Undo:** Regler sind kein Schritt in der Undo-Historie des Editors (wie Tempo und Bankwechsel).

**Zu prüfen in Live** (offen, nur in echtem Max sichtbar): Erzeugt ein Wert aus dem Editor einen Eintrag in Lives Undo? Was passiert bei Automation auf dem Parameter (Live überschreibt sie dann vermutlich bis „Re-Enable Automation“)? Beides ist hinnehmbar, der Nutzer prüft es einmal.

**Mehrere Devices:** Der Editor steuert weiter nur das erste Device (8765), seine Regler eingeschlossen.
