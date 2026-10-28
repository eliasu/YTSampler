# Quelltempo in der Bank

Type: grilling
Status: resolved

## Question

Soll eine Bank das bestätigte Quelltempo ihres Tracks mitspeichern (`srcBpm`/`srcAuto`, also ½×/2× oder eine manuelle Korrektur)? Heute steckt es im Favoriten. Ohne Speichern ginge jede Korrektur beim Bankwechsel verloren, und Warp und das Raster stünden wieder auf dem automatisch erkannten Wert.

Abzugrenzen von der Entscheidung „Länge kommt vom Device“ in [Grundsatzentscheidungen zum Bank-Editor](01-grundsatzentscheidungen.md): Das Quelltempo ist eine Eigenschaft des Tracks, keine Spielvorgabe.

## Answer

Geklärt am 2026-10-28 mit dem Nutzer in drei Runden.

**Kernaussage:** Das bestätigte Quelltempo gehört zum Video, nicht zur Bank. Es steht einmal pro Video in der Bibliotheksdatei.

**Was der Code heute macht** (`ytsampler_main.js`, `ytsampler_node.js`)
- Node schätzt beim Laden `bpm` und `bpmConf` (`estimateTempo`) und meldet `tempo <bpm> <konf>`. `[js]` übernimmt den Wert als `srcBpm` mit `srcAuto=1`. Das passiert nur, wenn `srcAuto` noch gesetzt ist oder noch kein Tempo da ist.
- ½× und 2× (`scaleSrc`, gerundet auf 0,1, begrenzt auf 30–300) sowie das Zahlenfeld (`srcbpm`) setzen `srcAuto=0` und fordern das Beat-Tracking neu an.
- Wer es benutzt: `tempoTrusted()` ist falsch, wenn `srcAuto=1` und `bpmConf < 0.3`. Davon hängen ab: das Warp-Verhältnis (`P.bpm / srcBpm`), `beatsOK()` und damit das Raster und das Würfeln auf Taktanfänge sowie die Marken im Grid. Das Beat-Tracking (`beattrack <srcBpm>`) läuft mit jedem Tempo > 0. Im Editor hängt auch das Einrasten des Markers auf Schläge davon ab.
- Gespeichert wird das Tempo heute nur im Favoriten (`snapshot`) und im Session-Zustand. Ein neues Video ohne Favorit setzt es zurück. Die Datei `<id>.json` im Cache enthält nur `id`, Titel und Dauer und wird neu geschrieben, sobald die WAV fehlt. Die `.chroma` speichert nur den automatisch erkannten Wert. Ein Tempo pro Video gibt es heute also nirgends.
- Lücke: Ein unsicheres Tempo, das eigentlich stimmt, lässt sich nicht bestätigen. Die gleiche Zahl ins Feld einzugeben wird ignoriert (`abs < 0.01`), es bleibt nur der Umweg ½× und danach 2×.

**Entscheidungen**
1. **Pro Video gespeichert.** Alle Bänke aus demselben Video teilen sich ein Quelltempo. Eine neue Bank aus einem Video, das schon in der Bibliothek ist, bekommt es gleich mit. Wer eine Bank korrigiert, korrigiert damit alle Bänke dieses Videos.
2. **In der Bibliotheksdatei, nicht im Cache.** Damit wird es zusammen mit der Bibliothek gesichert (siehe offene Frage zur Sicherung in der Karte). Der Cache darf weiter wegwerfbar bleiben.
3. **Gespeichert wird nur ein bestätigtes Tempo.** Fehlt ein Eintrag, gilt der automatisch erkannte Wert aus der Analyse, wie heute mit `srcAuto=1`.
4. **Korrektur im Editor und am Device.** Das ist eine Ausnahme zu „Device nur Bank-Regler, Vor/Zurück und Anzeige“ aus Ticket 01. Am Device bleiben ½×, 2× und das Zahlenfeld so wie heute. Jede Korrektur wird sofort gespeichert (Autosave, Ticket 01).
5. **„Tempo stimmt“:** Im Editor gibt es dafür einen Knopf. Er bestätigt ein unsicheres Tempo, ohne es zu ändern. Am Device gibt es keinen vierten Knopf: Wer dieselbe Zahl ins Zahlenfeld tippt, bestätigt damit.
6. **Startpunkte bleiben,** wenn das Tempo nachträglich geändert wird. Sie rasten nicht neu auf die neuen Schläge ein. Neue Schläge gelten erst beim nächsten Ziehen oder Würfeln.
7. **Löschen:** Wird die letzte Bank eines Videos gelöscht, fällt auch sein Tempo-Eintrag weg. Wer das Video später neu sucht, bekommt wieder den automatisch erkannten Wert.

**Für spätere Tickets**
- Für das Format der Bibliotheksdatei heißt das: Neben der Liste der Bänke gibt es pro Video einen Eintrag (Video-ID mit Quelltempo). Er existiert nur, solange es eine Bank aus diesem Video gibt.
- Für die Device-Oberfläche (Ticket 04): Am Device bleiben ½×, 2× und das Zahlenfeld für das Quelltempo.
