# YT Sampler

Live-Instrument: Ausschnitte aus YouTube-Tracks liegen auf Pads und werden per MIDI gespielt. Kuratierte Bänke machen daraus ein Bühnenrepertoire.

## Sprache

**Pad**:
Einer von 16 Plätzen, auf dem ein Ausschnitt eines Tracks liegt, bestimmt durch seinen Track und seinen Startpunkt.
_Avoid_: Slot, Slice (für den Platz selbst)

**Bank**:
Ein kuratierter Satz aus 16 Plätzen. Jedes Pad bringt seinen Track mit, ein Platz darf leer sein.
_Avoid_: Favorit, Sample-Set, Sample Pack, Preset

**Track-Bank**:
Eine Bank, deren 16 Pads alle aus demselben Track kommen.
_Avoid_: normale Bank

**Mix-Bank**:
Eine Bank mit Pads aus mehreren Tracks oder mit leeren Plätzen. Kein eigener Typ: Das Device spielt sie wie jede Bank.
_Avoid_: Kit, Playlist

**Quellleiste**:
Die Leiste unter den Pads im Editor, die die Pads einer anderen Bank zeigt. Von dort zieht man Pads auf Plätze. Gezogen wird eine Kopie, spätere Änderungen an der Quelle wirken nicht.
_Avoid_: Browser, Pool

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
