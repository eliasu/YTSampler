# YT Sampler – Max for Live Instrument

Spielt Bänke aus 16 Slices eines YouTube-Tracks per MIDI/Pads. Die Bänke stellst du im Browser-Editor zusammen, auf der Bühne schaltest du sie am Device durch. Die Slice-Länge wird in Notenwerten gewählt und folgt live dem Tempo des Sets.

## 1. Einmalig installieren (Terminal)

```
brew install yt-dlp ffmpeg deno
```

**Intel-Mac mit macOS 14:** Dort kann Homebrew `yt-dlp` und `deno` nicht bauen. Stattdessen `brew install ffmpeg` und die fertigen Programme von GitHub nach `~/.local/bin` legen: `yt-dlp_macos.zip` von github.com/yt-dlp/yt-dlp/releases nach `~/.local/yt-dlp-dir/` entpacken und `ln -s ../yt-dlp-dir/yt-dlp_macos ~/.local/bin/yt-dlp` (nicht die Einzeldatei `yt-dlp_macos`, die startet dort extrem langsam) und `deno-x86_64-apple-darwin.zip` von github.com/denoland/deno/releases (entpacken). Das Device sucht dort von selbst.

yt-dlp braucht für YouTube inzwischen eine JavaScript-Runtime (deno). Wenn Downloads irgendwann fehlschlagen: `brew upgrade yt-dlp`, YouTube ändert öfter etwas.

## 2. Dateien

Alle Dateien gehören in **denselben Ordner**, z. B. `~/Music/Ableton/User Library/Presets/Instruments/Max Instrument/YT Sampler/`:

- `YT Sampler.amxd` – das Device
- `ytsampler_main.js` – Pad- und Tempo-Logik
- `ytsampler_node.js` – Bibliothek, Suche, Download, Webserver für den Editor
- `editor.html` – Bank-Editor im Browser
- `ytpads.js` – Pad-Feld
- `ytgrid.js` – Beat-Raster und Pad-Marken über der Waveform
- `ytvoice.maxpat` – Sampler-Voice für poly~
- `ytwarpvoice.maxpat` – Warp-Voice (Timestretch), rechnet nur, während sie spielt

Das Device auf eine MIDI-Spur ziehen. Wenn alles läuft: Device im Editor öffnen und **Freeze Device** klicken, dann sind die Skripte eingebettet.

**Falls die .amxd nicht öffnet:** Leeres „Max Instrument“ auf eine Spur ziehen → Edit → Inhalt löschen. `YT Sampler.maxpat` in Max öffnen, alles kopieren, in den Editor einfügen. Im Patcher-Inspector „Open in Presentation“ aktivieren und die Device-Breite auf 1024 setzen, dann in den obigen Ordner speichern.

## 3. Bedienung

Seit 3.0 ist das Device nur noch das Bühneninstrument: Bank wählen und spielen. Kuratiert wird (Video suchen, Bänke bauen, Starts setzen, Tempo korrigieren) nur im Editor.

| Bereich | Funktion |
|---|---|
| Anzeige links | große Banknummer und Name, darunter `Bank` mit ◀ ▶, darunter die Statuszeile |
| Bank | 1–128 direkt anwählen, z. B. per Encoder oder CC (CC 0 = Bank 1). Gezählt werden nur die Bänke auf der **Bühne** (siehe Editor). Beim Drehen zeigt die Anzeige das Ziel, geladen wird erst, wenn der Regler 350 ms ruht. Über der letzten Bank steht „leer“, dann lädt nichts. |
| ◀ ▶ | vorherige/nächste Bank der Bühne, bleibt an der ersten und letzten stehen. Geht auch über 128 hinaus (der Regler bleibt auf 128, die Anzeige zeigt die echte Nummer). Steht „-“ in der Anzeige (Bank aus der Ablage), holen ◀ und ▶ die Bühnen-Bank, auf der der Regler steht. |
| Pads | Noten ab Base Note (Standard C1 = 36) spielen Pad 1–16, Pad 1 unten links. **Alle MIDI-Kanäle** spielen Pads, welcher Controller ankommt, regelt der MIDI-Eingang der Spur. Maus-Klick geht auch. |
| Slice | Notenwert 1/64 … 4 Takte, rechnet mit dem aktuellen Live-Tempo. Drehst du ihn, während Pads klingen (Trigger), endet der klingende Slice gleich am neuen Ende |
| Rate | 0.25–2×, ändert Tonhöhe, die rhythmische Länge bleibt gleich |
| Trigger / Hold | Trigger: spielt genau einen Slice (Notenwert). Hold: spielt, solange gedrückt, längstens 16 s (Ende des Snippets) |
| Rev | rückwärts |
| Tune | stimmt jedes Pad auf Lives aktuelle Skala (Live 12: Skala-Grundton + Skalatyp). Transponiert wird so, dass möglichst viele Töne in der Skala liegen, max. ±6 Halbtöne, plus Korrektur der Stimmung der Aufnahme (Abweichung von A=440). Pads ohne klare Tonart (Drums, Sprache, Rauschen) bleiben, wie sie sind. |
| Warp | Material läuft im Tempo des Sets, Tonhöhe bleibt (Timestretch, élastique über `groove~`). Sind Beats erkannt, folgt jeder Slice dem Beat-Raster des Originals (siehe „Tempo, Beats und Warp“). Rate und Tune ändern dann nur die Tonhöhe. Aus = klassischer Sampler-Modus, knackiger für Drums. |
| Quant | Input-Quantize: Pad-Anschläge warten auf den nächsten Rasterpunkt von Lives Transport. Das Raster (1/32, 1/16, 1/8, 1/4, Standard 1/16) stellt das Menü darunter ein. Bis knapp ⅓ einer 1/16 zu spät gespielt klingt sofort. **Catch** (nur bei Raster 1/8 und 1/4, Standard aus): Wer in der ersten Hälfte nach einem Rasterpunkt drückt (zu spät, bei 1/4 bis zu einer Achtel, bei 1/8 bis zu einer Sechzehntel), klingt sofort, aber an der Stelle, die auf dem Raster schon erreicht wäre. Das Sample läuft also im Takt, der Anfang fehlt. In der zweiten Hälfte (zu früh) wartet der Anschlag auf den nächsten Rasterpunkt. Läuft der Transport nicht, wirkt Quant nicht. |
| Volume | Lautstärke des Device |
| Norm | gleicht die Lautstärke der Pads an (Standard an). Gemessen wird beim Schneiden die empfundene Lautheit der ersten 2 s jedes Pads, leise Pads werden lauter, laute leiser (höchstens ±12 dB, angehoben nur so weit, dass die Spitzen unter −1 dBFS bleiben). Aus: kein Ausgleich, der Trim aus dem Editor wirkt weiter. |
| Base Note, Voices (rechts, Einrichtung) | Base Note = Note für Pad 1. Voices = Mono, 2, 3, 4, 5, 8 oder 16 gleichzeitige Stimmen. Das gleiche Pad schneidet sich immer selbst ab, sonst wird die älteste Stimme gestohlen. |

Attack (2 ms), Release (20 ms) und die Tonal-Schwelle für Tune (0,5) sind seit 3.0 feste Werte. Das Quelltempo (früher Src BPM, ÷2, ×2) stellt man nur noch im Editor.

**Pads spielen:** per MIDI-Noten, nicht per Cmd+M-Mapping. Controller-Pads senden ohnehin Noten. Fürs Rechner-Keyboard in Live die Computer-MIDI-Tastatur aktivieren (Taste M) und entweder Base Note auf C3 stellen oder mit Z zwei Oktaven runter gehen.

Alle Regler und Buttons sind `live.*`-Objekte: MIDI-Map-Modus (Cmd+M) funktioniert, sie sind automatisierbar und werden mit dem Set gespeichert. Wie Bank und Pads gespeichert werden, steht unten unter „Speichern“.

## Bänke und Bibliothek

Eine **Bank** sind 16 Plätze. Jedes Pad bringt seinen Track und seinen Startpunkt mit, ein Platz darf leer sein. Eine Bank kann Pads aus einem oder mehreren Tracks haben, es gibt dafür keine zwei Arten. In der Liste steht unter dem Namen bei einem Track „Titel · BPM“, bei mehreren „n Tracks“, bei einer leeren Bank „leer“. Tempo, Stimmung, Raster und Warp gelten pro Pad, aus dem Track des Pads. Leere Plätze sind stumm und am Device dunkel ohne Nummer. Die Slice-Länge kommt immer von den Reglern am Device. Alle Bänke zusammen sind die **Bibliothek**, geordnet und für alle Live-Sets gleich. Die Banknummer ist der Platz in der Liste und ändert sich beim Umsortieren.

Pro Bank liegen die 16 Pads als **Snippets** à 16 s in einer eigenen Datei. Auf der Bühne lädt das Device nur diese Datei: kein Internet, kein Warten, Bankwechsel klickfrei. Mehr als 16 s spielt ein Pad nie, auch nicht im Hold-Modus. 4 Takte sind bei 60 BPM genau 16 s: langsamer (ohne Warp, bei Rate 1) oder mit Warp aus einem Track unter 60 BPM endet der Slice früher, am Ende des Snippets.

### Bank-Editor (Browser)

Solange das Device läuft: Button **Editor** im Device drücken, oder **http://localhost:8765/editor** im Browser öffnen (http://localhost:8765 leitet dorthin weiter). Der Editor steuert immer das erste YT-Sampler-Device (oben rechts steht „steuert: <Spurname>“) und zeigt dieselbe Bank wie das Device.

| Aktion | Wie |
|---|---|
| Bühne und Ablage | Die Liste hat zwei Bereiche. **Bühne** (mit Nummern): nur diese Bänke schaltet das Device mit `Bank` und ◀ ▶ durch, ihre Reihenfolge ergibt die Nummern. **Ablage** (ohne Nummer): zum Weiterbauen und als Quelle. Umschalten mit dem Pfeil am Ende der Zeile (landet am Ende des anderen Bereichs) oder Zeile in den anderen Bereich ziehen. Eine Ablage-Bank anklicken lädt sie trotzdem im Device, die Anzeige zeigt „-“. Jede Änderung lässt sich rückgängig machen. Bänke aus älteren Versionen stehen alle auf der Bühne. |
| Neue Bank | „Neue Bank“ im Listenfuß: Bank mit 16 leeren Plätzen in der Ablage, sie wird aktiv |
| Track aus YouTube aufs Pad | „Video suchen“ oder ⌘K, Begriff oder YouTube-URL. Treffer auf ein Pad ziehen oder anklicken (kommt auf das gewählte Pad). Ein belegtes Pad wird überschrieben. Die Stelle im Track wird gewürfelt (Taktanfang, keine Stille, kein Start doppelt). Danach anspielen, würfeln oder den Start ziehen. |
| leere Plätze füllen | Knopf „Leere Plätze füllen“ am Suchtreffer: alle leeren Plätze der Bank bekommen zufällige Stellen aus diesem Track |
| Bank aus einem Track | Knopf „Neue Bank“ am Suchtreffer: neue Bank mit dem Videotitel in der Ablage, alle 16 Plätze bekommen zufällige Stellen aus diesem Track. Sie wird aktiv. ⌘Z entfernt sie wieder. |
| Ladezustand | Solange der Track lädt (bis 3 gleichzeitig, der Rest wartet), zeigt das Pad „wartet“ bzw. „lädt n %“. Danach wird geschnitten und das Device lädt die Bank neu. |
| Bank wählen | Klick in der Liste, ◀ ▶ oder ↑/↓ |
| umbenennen, duplizieren, löschen | Icons an der Zeile, umbenennen auch per Doppelklick. Die Kopie landet in der Ablage. Löschen fragt nicht, dafür 5 s „Rückgängig“. Wird die aktive Bühnen-Bank gelöscht, rückt die nächste der Bühne nach. |
| verschieben | Zeile in der Liste ziehen: innerhalb der Bühne ändert das die Nummern. Auf die Überschrift „Bühne“/„Ablage“ = an den Anfang, auf die freie Fläche darunter = ans Ende. |
| Start setzen | Marker in der Waveform ziehen. Rastet auf Schläge, mit Alt frei. |
| neues Snippet | Würfel am Pad oder „Neues Snippet“ |
| Pads tauschen | Pad auf Pad ziehen (auch mit leeren Plätzen) |
| Pad kopieren | Pad mit gedrückter **Alt-Taste** (⌥) auf ein anderes Pad ziehen: Das Ziel wird überschrieben (Track und Start), der Zeiger zeigt ein Plus. Alt darf man auch erst während des Ziehens drücken. |
| Pad in eine andere Bank | Eigenes Pad links über eine andere Bank ziehen und dort kurz halten (0,6 s): Die Bank öffnet sich und lädt im Device. Auf einem ihrer Pads loslassen: Das Pad wird **verschoben**, der alte Platz wird leer. Mit Alt wird kopiert, die alte Bank bleibt, wie sie ist. Ein belegtes Ziel wird überschrieben. Ein ⌘Z stellt beide Bänke wieder her. Abbrechen (Esc) lässt die geöffnete Bank aktiv. |
| Pad aus einer anderen Bank | **Quell-Grids** rechts neben den Pads (je 4×4, Pad 1 unten links), so viele nebeneinander, wie das Fenster breit ist. Jedes hat seine eigene Bank (vorgeschlagen: die nächsten nach der aktiven, die Auswahl merkt sich der Browser). Ein Pad daraus auf einen Platz ziehen: kopiert Track und Start, spätere Änderungen an der Quelle wirken nicht. Geht auch ohne Cache. |
| vorhören | Quell-Pad anklicken: spielt sein Snippet im Browser (Lautsprecher des Macs, nicht über Live), so lang wie der Slice des Device im Tempo des Sets, ohne Warp/Rate/Tune, mit Ausgleich (wenn „Norm“ an ist) und Trim; ohne Device-Regler 2 s. Noch ein Klick stoppt, ein anderes Pad wechselt. Das Pad leuchtet, solange es spielt. |
| Platz leeren | × rechts oben am Pad (immer sichtbar), darunter der Würfel für ein neues Snippet. Klick in die Mitte spielt an |
| anspielen | Pad klicken, klingt am Device |
| Trim | Schieber „Trim“ neben dem Track des gewählten Pads: −12 … +12 dB in halben Schritten, zusätzlich zum automatischen Ausgleich (der gemessene Wert steht im Tooltip). Doppelklick = 0. Jede Änderung ist ein Schritt im Rückgängig. Der Trim gehört zum Pad und wandert beim Kopieren, Verschieben und Tauschen mit. |
| Tempo | Zahlenfeld, ½×, 2×, „Tempo stimmt“ (daneben der Hinweis, solange das Tempo nur aus der Analyse kommt) für das Video des gewählten Pads (gilt für alle Bänke mit diesem Video) |
| Device-Regler | Leiste über den Pads, siehe unten |
| Rückgängig | ⌘Z / ⇧⌘Z oder ↶ ↷ (100 Schritte, nur in diesem Fenster). Geleerte oder überschriebene Pads kommen auch ohne Cache zurück, solange Node läuft. |
| Cache leeren | Knopf neben der Cache-Größe im Listenfuß, mit Rückfrage. Löscht die ganzen Tracks im lokalen Cache, nicht die Snippets. Gesperrt, solange Tracks laden oder geschnitten wird. |

**Device-Regler im Editor:** Die Leiste über den Pads zeigt die Regler des Device: links die Bühne (Slice, Rate, Trigger/Hold, Rev, Tune, Warp, Quant, Raster, Catch), rechts gedämpft die Einrichtung (Norm, Volume, Voices, Base Note). Es ist derselbe Zustand wie im Device: Dreht man am Device (oder per MIDI), folgt der Editor. Stellt man im Editor, bewegt sich der Regler im Device und wird mit dem Set gespeichert. Doppelklick auf Rate bzw. Volume setzt 1× bzw. 0 dB. Die Regler sind kein Schritt im Rückgängig des Editors. Ohne laufendes Device ist die Leiste ausgegraut.

Die Waveform zeigt immer den Track des gewählten Pads, mit den Markern aller Pads aus diesem Track.

Alles wird sofort gespeichert. Fehlt ein Track einer Bank im Cache, heißt sie „nur spielbar“: Starts von Pads aus diesem Track lassen sich dann nicht ändern, „Track laden“ holt ihn. „Alle nachladen“ im Listenfuß holt alle fehlenden Tracks.

### Am Device

`Bank`, ◀ und ▶ schalten durch die Bibliothek (siehe Bedienung oben). Die Anzeige links zeigt:

| Anzeige | Bedeutung |
|---|---|
| Nummer + Name | Bank aktiv |
| „-“ | nichts geladen, Pads stumm |
| „Bibliothek leer“ | noch keine Bank, Pads stumm. Im Editor eine anlegen. |
| „Bibliothek aus neuerer Version“ | die Bibliothek stammt von einem neueren Device (z. B. 4.0 auf dem anderen Mac). Pads stumm, nichts wird angefasst. Device updaten. |
| „Bibliothek kaputt“ | `library.json` unlesbar (oder iCloud hat sie noch nicht geladen). Pads stumm, nichts wird gespeichert. Geht von selbst weiter, sobald die Datei wieder lesbar ist. |
| „nicht ladbar“ | Snippets fehlen und der Track auch. Lief vorher eine Bank, spielt sie weiter (nur kurz eingeblendet). Sonst stumm, Status „Bank im Editor prüfen“. |
| kurz „Bank gelöscht“ | die im Set gespeicherte Bank gibt es nicht mehr. Das Device lädt die Bank, die jetzt auf ihrem Platz steht (hinter der letzten: die letzte). |

**Lautstärke angleichen (Norm):** Beim ersten Start misst das Device alle vorhandenen Snippets einmal nach, ohne neu zu schneiden. Ein neues Device und alte Sets haben „Norm“ an, das ändert also den Klang bestehender Bänke. Wer es wie vorher will, schaltet „Norm“ aus.

**Update auf 4.0 (Mix-Bänke):** Die Bibliothek bekommt ein neues Format. Ein Device in 3.x liest sie als „Bibliothek aus neuerer Version“ und bleibt stumm, damit es nichts falsch schneidet. **Beide Macs gleichzeitig auf 4.0 bringen**, sonst bleibt der alte stumm. Bestehende Bänke spielen ohne Neuschnitt weiter.

**Update auf 3.0:** Die Regler Tonal, Attack, Release, Source BPM, ÷2, ×2, Grid und Snap gibt es nicht mehr, ihre MIDI-Mappings gehen verloren. Alle anderen Mappings bleiben. Teletext-Seite, IR-Fernbedienung, Schreibmaschine (Kanal 16) und das Spielen eines ganzen Videos ohne Bank sind weggefallen. Ein Set, das ohne Bank gespeichert war (Teletext oder 1.x), lädt beim Öffnen die Bank, auf der der Regler `Bank` steht.

## Speichern

Das Device merkt sich automatisch die aktive Bank. Beim Öffnen des Sets wird sie wieder geladen, auch wenn sie inzwischen auf einem anderen Platz oder in der Ablage steht (dann zeigt die Anzeige „-“). Kennt das Device keine Bank (neues Device, altes Set, Bank gelöscht), lädt es die Bank, auf der der Regler `Bank` steht.

Technisch steckt im Set nur eine unsichtbare Session-Nummer, der Zustand liegt in `sessions/<nummer>.json` im Datenordner. Dupliziert man die Spur, bekommt die Kopie eine eigene Nummer samt Kopie des Zustands. Achtung bei „Speichern unter“: Beide Sets teilen sich danach dieselbe Session-Datei.

### Datenordner und iCloud

Bibliothek, Snippets und Sessions liegen in **iCloud Drive** unter `iCloud Drive/YTSampler/` (ohne iCloud in `~/Music/YTSampler/`). Lokal in `~/Music/YTSampler/` bleibt nur der Cache der ganzen Tracks.

- **Umzug:** Beim ersten Start von 2.0 schiebt das Device alles außer `cache/` und `chrome-profile/` aus `~/Music/YTSampler/` nach iCloud. Klappt das nicht, arbeitet es im alten Ordner weiter und zeigt „Umzug nach iCloud fehlgeschlagen“.
- **Einmal im Finder:** Ordner `YTSampler` in iCloud Drive rechts anklicken → **„Geladen lassen“**. Sonst lagert macOS die Snippets aus, und auf der Bühne ohne Internet fehlen sie („Bibliothek kaputt“ bzw. „nicht ladbar“).
- Es arbeitet immer nur ein Rechner gleichzeitig mit der Bibliothek.
- **Reste aus 2.x:** `ir.json` und `web/teletext.html` im Datenordner sowie `chrome-profile/` in `~/Music/YTSampler/` braucht 3.0 nicht mehr. Man kann sie von Hand löschen, das Device löscht nichts selbst.
- **Sicherung:** Bei jedem Start legt das Device eine Kopie der Bibliothek in `backup/` ab (die 10 neuesten bleiben). Zurückholen: Kopie im Finder über `library.json` legen, Device neu laden.

## Tonart-Erkennung

Beim ersten Laden eines Videos wird ein Chromagramm berechnet (ca. 3 s bei 10 Minuten) und als `.chroma` im Cache abgelegt. Jedes Pad wird in einem Fenster um seinen Slice ausgewertet, mindestens 2 s, damit auch kurze Notenwerte genug Material haben. Die Zeile unter der Waveform zeigt für das gewählte Pad die erkannte Tonart, die Konfidenz und die Verschiebung. Transponiert wird über die Abspielrate wie bei einem klassischen Sampler. Die rhythmische Slice-Länge bleibt gleich, das Tempo des Materials ändert sich leicht mit.

## Tempo, Beats und Warp

Beim ersten Laden eines Videos werden Tempo, Schläge und die „1“ erkannt und gecacht. Der Status zeigt z. B. „94 BPM“, bei einer Bank aus mehreren Tracks „3 Tracks“. Jedes Pad warpt aus dem Tempo seines eigenen Tracks. Ist das Tempo falsch (typisch: halb/doppelt, z. B. 172 → 86 bei Drum & Bass), korrigiert man es **im Editor** (Zahlenfeld, ½×, 2×, „Tempo stimmt“). Das Tempo steht dann in der Bibliothek und gilt für alle Bänke des Videos, das Raster wird sofort neu berechnet.

Der Beat-Tracker folgt leichten Tempo-Schwankungen, eine echte Band ist also kein Problem. Die „1“ jedes Takts schätzt er aus der Kick und aus Harmoniewechseln. Ein Intro ohne Beat (Stille, Gerede, Flächen) wird übersprungen, Takt 1 ist dort, wo der Beat einsetzt.

- **Linien:** Sind Beats erkannt, zeigen über der Waveform orange Linien die Takte und feine weiße Linien die Schläge (nur wenn genug Platz ist). Einen Schalter dafür gibt es nicht. Die Waveform zeigt die 16 Snippets nebeneinander, kleine Dreiecke oben markieren die Pads, das gewählte ist weiß.
- **Zeile unter der Waveform:** Position des gewählten Pads als Takt.Schlag, z. B. „T6.1“ (nur mit Beats), dazu „W×1.32“ (Streckfaktor) oder „W: kein Tempo“.
- **Warp mit Beats:** Jeder Slice ist genau ein Notenwert des Original-Grooves, von Raster zu Raster. Schwankt das Original, passt sich der Streckfaktor pro Slice an, das Ergebnis läuft exakt in deinem Tempo. Ohne Beats gilt ein festes Verhältnis Set-Tempo / Quelltempo.
- **Würfeln** (im Editor): Ist ein sicherer Beat erkannt, starten neue Pads auf Taktanfängen.

Grenzen: Timestretching verschmiert Transienten leicht, hat etwas Latenz und braucht mehr CPU.

## Hinweise

- Cache: `~/Music/YTSampler/cache` (ganze Tracks, WAV 44.1 kHz). Wird nie automatisch geleert, der Editor warnt ab 10 GB. Leeren mit „Cache leeren“ im Editor (oder im Finder): Bänke spielen weiter aus ihren Snippets, sind dann aber „nur spielbar“.
- Was beim Leeren oder Überschreiben eines Pads anfällt (sein Audio, Analyse, Titel und Tempo des Tracks), bleibt bis zum nächsten Start liegen, damit Rückgängig geht. Beim Start räumt der Sampler weg, was keine Bank mehr braucht.
- Videos über 10 Minuten: Nur die ersten 10 Minuten werden geladen (RAM). Die Grenze steht als `MAX_SECONDS` in `ytsampler_node.js`.
- Takt: 4/4 wird angenommen („1 Bar“ = 4 Viertel).
- Das Herunterladen von YouTube verstößt gegen deren Nutzungsbedingungen. Für veröffentlichte Tracks die Rechte am Sample klären.
