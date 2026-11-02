# YT Sampler

Live-Instrument: Ausschnitte aus YouTube-Tracks liegen auf Pads und werden per MIDI gespielt. Kuratierte Bänke machen daraus ein Bühnenrepertoire.

## Sprache

**Pad**:
Einer von 16 Plätzen, auf dem ein Ausschnitt eines Tracks liegt, bestimmt durch seinen Track und seinen Startpunkt.
_Avoid_: Slot, Slice (für den Platz selbst)

**Bank**:
Ein kuratierter Satz aus 16 Plätzen. Jedes Pad bringt seinen Track mit, ein Platz darf leer sein. Es gibt nur diese eine Art: Ob die Pads aus einem oder mehreren Tracks kommen, ändert nichts. Eine neue Bank startet leer.
_Avoid_: Favorit, Sample-Set, Sample Pack, Preset, Track-Bank, Mix-Bank, Kit

**Quell-Grid**:
Das 4×4-Raster rechts neben den Pads im Editor, das die Pads einer anderen Bank zeigt, in derselben Anordnung (Pad 1 unten links). Von dort zieht man Pads auf Plätze. Gezogen wird eine Kopie, spätere Änderungen an der Quelle wirken nicht.
_Avoid_: Quellleiste, Browser, Pool

**Füllen**:
Einen Track aus der Suche auf Plätze bringen: auf ein Pad ziehen oder anklicken (ein Platz) oder „Leere Plätze füllen“ (alle leeren Plätze der Bank). Die Stelle im Track wird gewürfelt.
_Avoid_: Bank aus Video anlegen

**Ablage**:
Audio eines Pads, das geleert oder überschrieben wurde, damit Rückgängig auch ohne Cache geht. Wird erst beim Start aufgeräumt, wenn keine Bank das Pad mehr hat.
_Avoid_: Papierkorb

**Snippet**:
Der gespeicherte Audioausschnitt eines Pads ab seinem Startpunkt, mehr als das spielt das Pad nie.
_Avoid_: Slice (für das gespeicherte Audio), Sample

**Bibliothek**:
Alle Bänke zusammen, geordnet und unabhängig vom Live-Set.
_Avoid_: Favoriten, Bänke A–D


**Kuratieren**:
Bänke anlegen und bearbeiten: Video suchen, Starts setzen, würfeln, Tempo korrigieren. Seit 3.0 nur im Editor, das Device spielt nur.
_Avoid_: Laden (für das Anlegen einer Bank)

**Device-Regler**:
Die Live-Parameter des Device (Slice, Rate, Trigger/Hold, Rev, Tune, Warp, Quant, Raster, Catch, Volume, Voices, Base Note). Der Editor zeigt und stellt dieselben Werte, es gibt keine zweite Kopie.
_Avoid_: Einstellungen der Bank (die Bank speichert keine Regler)
