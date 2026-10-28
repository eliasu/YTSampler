# Analyse im Device mit Snippets

Type: grilling
Status: resolved

## Question

Heute rechnet Node die Analyse auf dem ganzen Track: Tonart und Chroma pro Pad für Tune, Tempo, Beats und die „1“ für Grid, Snap und Warp+Grid, dazu Stille fürs Würfeln. Künftig hat das Device nur die 16 Snippets einer Bank, siehe [Bank speichert Snippets statt ganzer WAV](11-snippets-statt-ganzer-wav.md).

- Was davon braucht das Device auf der Bühne noch, und woher bekommt es das? Möglich sind: auf den Snippets neu rechnen, beim Schneiden einmal rechnen und in der Bibliothek ablegen, oder ganz weglassen.
- Wie verhalten sich Grid/Snap und Warp+Grid, deren Slice-Ende heute den Schlägen des ganzen Tracks folgt?
- Würfeln und Stille betreffen nur noch den Editor: Bleibt die Analyse dort wie heute, also auf der ganzen WAV?
- Was passiert mit Teletext-Videos („keine Bank“, ganze WAV)? Dort bleibt vermutlich alles wie heute.

Vieles ist technisch. Den Nutzer nur fragen, was man auf der Bühne hört oder sieht. Ein Beispiel: Ob Tune bei Bänken gleich klingt wie heute.

## Answer

Geklärt am 2026-10-28. Das Technische ist aus dem Code entschieden. Der Nutzer hat in einer Runde drei Fragen zur Bühne beantwortet und alle Empfehlungen angenommen.

**Kernaussage:** Die Analyse des ganzen Tracks wird beim Schneiden einmal pro Video neben die Snippets gelegt. Das Device rechnet damit wie heute in Song-Koordinaten. Tune, Tempo, Schläge, die „1“ und Warp+Grid klingen deshalb gleich. Nur das Einrasten der Starts wandert in den Editor.

**Was der Code heute macht** (`ytsampler_node.js`, `ytsampler_main.js`)
- `computeAnalysis` läuft einmal pro Video auf der ganzen WAV und landet in `cache/<id>.chroma` (`AN.VERSION` 3). Die Datei enthält die Stimmung, das automatische Tempo samt Konfidenz, die Einsatzkurven `onset`/`bass` (≈86 Frames/s) und Chroma-Frames (12 Chroma + Flatness + Energie, Hop 1024 bei 5512,5 Hz). Im Cache liegen heute 57 Dateien, im Schnitt 130 KB, höchstens 400 KB. Zum Vergleich: Die Snippets einer Bank sind etwa 45 MB groß.
- Danach schickt Node `tuning <cent>` (ein Wert pro Video), `tempo <bpm> <konf>`, `silence <von> <bis> …` und `analysisready`.
- `analyze`/`analyzeall` (`analyzeWindow`) summieren nur die Chroma-Frames eines Fensters. Das Fenster hat die Mitte `start + span/2` und ist `max(span, 2 s)` lang. `span` ist `spanMs()` (Division × Rate, Live-Tempo) bzw. 4 s bei Hold (`HOLD_ANALYSIS`). Ergebnis ist `padinfo <i> <konf> <grundton> <moll> <12 chroma>`. Das Fenster hängt also von den Reglern am Device ab und wird bei jeder Änderung neu angefordert (`requestAll`).
- `beattrack <bpm>` → `trackBeats` auf der Einsatzkurve des ganzen Tracks, dazu `findIntro`/`findDownbeat` → `beatsclear`, `beatsadd <ms…>`, `beatsdone <down> <anzahl>`. Dafür braucht es den ganzen Track. Bei jeder Tempokorrektur (½×, 2×, Zahlenfeld) wird es neu angefordert.
- Die Schläge des ganzen Tracks werden gebraucht von: `gridOK()`/`beatsOK()` (Schläge da und Tempo vertrauenswürdig), `effStart` (rastet den freien Start aufs Raster), `playRange` (Warp+Grid: Ende = Start + Notenwert in Schlägen der Quelle, `timeAt(xAt(start)+n)`), `nudge` und `randomStart` (Raster, Taktanfang), `sendGridUI` (Overlay-Linien) und `updateSel` (Infozeile `T<takt>.<schlag>`).
- `silence` braucht nur `randomStart` (Würfeln).

**Entscheidungen**
1. **Analyse pro Video, beim Schneiden abgelegt.** Wenn Node die Snippets einer Bank schneidet (Ticket 11), kopiert er `cache/<videoId>.chroma` unverändert neben die Snippet-Dateien, falls sie dort noch fehlt. Sie liegt damit in iCloud (Ticket 10), ist winzig und wird nie automatisch gelöscht. So bleibt auch ein Undo nach dem Löschen der letzten Bank eines Videos vollständig. Andere Möglichkeiten:
   - *Auf den Snippets neu rechnen* scheidet aus: Tempo, Beat-Tracking, Intro und die „1“ brauchen den durchgehenden Track. Die zusammengesetzten Snippets haben Sprünge, und eine Tempokorrektur am Device (Ticket 06) bräuchte ohnehin die Einsatzkurve des ganzen Tracks.
   - *Fertige Ergebnisse speichern* (Chroma pro Pad, Schläge) scheidet ebenfalls aus: Das Tune-Fenster hängt von Division, Rate, Live-Tempo und Mode ab, die Schläge vom bestätigten Tempo. Fertige Werte wären beim ersten Drehen falsch.
2. **Das Device rechnet in Song-Koordinaten wie heute.** Lädt das Device eine Bank, liest Node die Analyse aus dem Bank-Ordner statt aus `cache/`. Danach laufen `tuning`, `tempo`, `silence`, `analysisready`, `analyze`/`analyzeall`, `beattrack` und `beats*` unverändert. `[js]` kennt pro Pad den Song-Start (`starts` aus der Bibliothek) und die Snippet-Länge. Erst beim Abspielen und in der Anzeige rechnet es Song-ms in Buffer-ms um: Pad i liegt im Snippet-WAV bei `i × 16000 + (t − start_i)`. Jedes Snippet hat einen festen 16-s-Platz, ein kürzeres wird mit Stille aufgefüllt. `playRange` begrenzt auf `[start_i, start_i + länge_i]` (Ticket 11: nie über das Snippet-Ende).
3. **Tune** klingt wie heute: gleiche Stimmung, gleiche Chroma-Frames, gleiches Fenster. Ragt das Fenster vor den Snippet-Start (Spanne < 2 s), liest es dort aus der Analyse des Songs. Das ist gewollt, denn es geht um die Tonart der Stelle. Bei Hold rückwärts bleibt das Fenster wie heute (4 s ab Start).
4. **Starts sitzen fest** (Nutzer: ja). Mit einer Bank gilt `effStart(i) = starts[i]`, ohne Einrasten. Grid und Snap verschieben am Device nichts. Eingerastet wird im Editor beim Setzen des Markers. In `library.json` steht deshalb der tatsächliche Schnittpunkt, nicht mehr eine freie Position. Das überholt in Ticket 09 die Begründung „Einrasten rechnet `[js]` ohnehin neu (`effStart`)“. Snap wirkt am Device nur noch ohne Bank (Teletext).
5. **Warp+Grid** bleibt: Das Slice-Ende folgt den Schlägen der Quelle wie heute, begrenzt auf das Snippet-Ende. Nach einer Tempokorrektur am Device werden die Schläge neu getrackt. Die Starts bleiben dabei stehen (Ticket 06, Punkt 6).
6. **Grid-Linien in der Snippet-Waveform** (Nutzer: ja, wie heute). Bei gültigem Grid zeichnet das Overlay in jedem Snippet-Platz die Schläge, die in `[start_i, start_i + länge_i]` fallen, umgerechnet auf Buffer-ms. Takte werden wie heute hervorgehoben, dazu kommen die 16 Grenzen (Ticket 11). Voraussetzung ist weiter, dass der Grid-Overlay-Fehler behoben ist (Ticket 04).
7. **Infozeile** (Nutzer: ja). Sie zeigt weiter die Stelle im Originalsong und den Takt, also `fmt(start)` und `T<takt>.<schlag>` aus `xAt`. Das geht ohne Änderung, weil `[js]` in Song-Koordinaten rechnet.
8. **Wegfallen** auf dem Bank-Weg: Einrasten am Device, `silence` und das Würfeln (Ticket 04 streicht Würfeln/Nudge ohnehin). Node darf `silence` weiter schicken, `[js]` nutzt es mit einer Bank nicht.
9. **Editor:** Würfeln, Stille, Einrasten und Analyse laufen dort wie heute auf der ganzen WAV.
10. **Teletext** („keine Bank“, ganze WAV): alles wie heute, Analyse aus `cache/`.
11. **Analyse fehlt oder ist veraltet** (iCloud hat sie nicht geladen, oder `AN.VERSION` wurde erhöht): Liegt die ganze WAV im Cache, rechnet Node die Analyse neu und legt sie ab. Sonst bleibt die Bank spielbar, aber ohne Tune, Grid und automatisches Tempo. Warp mit einem bestätigten `bpm` aus der Bibliothek geht weiter, denn `warpRatio` braucht nur das Tempo. Die Statuszeile zeigt „Analyse fehlt – Bank im Editor neu schneiden“.

**Für Ticket 07 (Protokoll)**
- Neu, Node → `[js]` beim Laden einer Bank, vor `loaded`: die Song-Starts und Snippet-Längen der 16 Pads, z. B. `snips <16 Starts ms> <16 Längen ms>`. Dazu kommt die Dauer des ganzen Songs (für `xAt`/`timeAt` am Rand und die Klammern), z. B. als Feld in `loaded` oder in `snips`. Ohne `snips` (Teletext) gilt das alte Verhalten.
- `loaded <pfad>` zeigt bei einer Bank auf die Snippet-WAV (16 × 16 s). `buffer~ replace` und die Waveform bleiben, wie sie sind.
- Gleich bleiben: `tuning`, `tempo`, `silence`, `analysisready`, `analyze`, `analyzeall`, `padinfo`, `beattrack`, `beatsclear`, `beatsadd`, `beatsdone`. Sie arbeiten weiter in Song-ms.
- An die Stimmen: `pos`/`wplay` bekommen Buffer-ms. Umgerechnet wird nur in `[js]` (`trigger`).
- An das Overlay: `grid dur` = Länge der Snippet-WAV, `grid beats`/`grid pads` in Buffer-ms (pro Snippet umgerechnet). Die Takt-Hervorhebung braucht pro Schlag die Info „ist eine 1“, weil der gleichmäßige Index über die Snippet-Grenzen nicht mehr gilt. Vorschlag: `grid bars <ms…>` zusätzlich zu `grid beats`.
- Schneiden (Editor → Node): kopiert die Analyse neben die Snippets, falls sie dort fehlt. Die Starts kommen schon eingerastet an und werden so gespeichert.
- Meldung an Device und Editor: „Analyse fehlt“ (Entscheidung 11).

**Neu aufgetaucht**
- `AN.VERSION` erhöhen bricht ab jetzt die Analysen der Bänke, deren WAV nicht mehr im Cache liegt (Entscheidung 11 fängt das nur ab). Für `CLAUDE.md`/Spec: Das Analyseformat nur noch abwärtskompatibel ändern oder alte Versionen weiter lesen können.
- Das Einrasten im Editor nutzt dessen eigenes Grid/Snap. Ob der Editor dafür einen eigenen Snap-Schalter hat oder den des Devices übernimmt, gehört zu Ticket 03/07.
