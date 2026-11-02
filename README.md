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
| Bank | 1–128 direkt anwählen, z. B. per Encoder oder CC (CC 0 = Bank 1). Beim Drehen zeigt die Anzeige das Ziel, geladen wird erst, wenn der Regler 350 ms ruht. Über der letzten Bank steht „leer“, dann lädt nichts. |
| ◀ ▶ | vorherige/nächste Bank, bleibt an der ersten und letzten stehen. Geht auch über 128 hinaus (der Regler bleibt auf 128, die Anzeige zeigt die echte Nummer). |
| Pads | Noten ab Base Note (Standard C1 = 36) spielen Pad 1–16, Pad 1 unten links. **Alle MIDI-Kanäle** spielen Pads, welcher Controller ankommt, regelt der MIDI-Eingang der Spur. Maus-Klick geht auch. |
| Slice | Notenwert 1/64 … 2 Takte, rechnet mit dem aktuellen Live-Tempo |
| Rate | 0.25–2×, ändert Tonhöhe, die rhythmische Länge bleibt gleich |
| Trigger / Hold | Trigger: spielt genau einen Slice (Notenwert). Hold: spielt, solange gedrückt, längstens 16 s (Ende des Snippets) |
| Rev | rückwärts |
| Tune | stimmt jedes Pad auf Lives aktuelle Skala (Live 12: Skala-Grundton + Skalatyp). Transponiert wird so, dass möglichst viele Töne in der Skala liegen, max. ±6 Halbtöne, plus Korrektur der Stimmung der Aufnahme (Abweichung von A=440). Pads ohne klare Tonart (Drums, Sprache, Rauschen) bleiben, wie sie sind. |
| Warp | Material läuft im Tempo des Sets, Tonhöhe bleibt (Timestretch, élastique über `groove~`). Sind Beats erkannt, folgt jeder Slice dem Beat-Raster des Originals (siehe „Tempo, Beats und Warp“). Rate und Tune ändern dann nur die Tonhöhe. Aus = klassischer Sampler-Modus, knackiger für Drums. |
| Quant | Input-Quantize: Pad-Anschläge warten auf den nächsten Rasterpunkt von Lives Transport. Das Raster (1/32, 1/16, 1/8, 1/4, Standard 1/16) stellt das Menü darunter ein. Bis knapp ⅓ einer 1/16 zu spät gespielt klingt sofort. **Catch** (nur bei Raster 1/8 und 1/4, Standard aus): Wer in der ersten Hälfte nach einem Rasterpunkt drückt (zu spät, bei 1/4 bis zu einer Achtel, bei 1/8 bis zu einer Sechzehntel), klingt sofort, aber an der Stelle, die auf dem Raster schon erreicht wäre. Das Sample läuft also im Takt, der Anfang fehlt. In der zweiten Hälfte (zu früh) wartet der Anschlag auf den nächsten Rasterpunkt. Läuft der Transport nicht, wirkt Quant nicht. |
| Volume | Lautstärke des Device |
| Base Note, Voices (rechts, Einrichtung) | Base Note = Note für Pad 1. Voices = Mono, 2, 3, 4, 5, 8 oder 16 gleichzeitige Stimmen. Das gleiche Pad schneidet sich immer selbst ab, sonst wird die älteste Stimme gestohlen. |

Attack (2 ms), Release (20 ms) und die Tonal-Schwelle für Tune (0,5) sind seit 3.0 feste Werte. Das Quelltempo (früher Src BPM, ÷2, ×2) stellt man nur noch im Editor.

**Pads spielen:** per MIDI-Noten, nicht per Cmd+M-Mapping. Controller-Pads senden ohnehin Noten. Fürs Rechner-Keyboard in Live die Computer-MIDI-Tastatur aktivieren (Taste M) und entweder Base Note auf C3 stellen oder mit Z zwei Oktaven runter gehen.

Alle Regler und Buttons sind `live.*`-Objekte: MIDI-Map-Modus (Cmd+M) funktioniert, sie sind automatisierbar und werden mit dem Set gespeichert. Wie Bank und Pads gespeichert werden, steht unten unter „Speichern“.

## Bänke und Bibliothek

Eine **Bank** sind 16 Pads aus genau einem Track. Gespeichert werden Video, Name und die 16 Startpunkte. Die Slice-Länge kommt immer von den Reglern am Device. Alle Bänke zusammen sind die **Bibliothek**, geordnet und für alle Live-Sets gleich. Die Banknummer ist der Platz in der Liste und ändert sich beim Umsortieren.

Pro Bank liegen die 16 Pads als **Snippets** à 16 s in einer eigenen Datei. Auf der Bühne lädt das Device nur diese Datei: kein Internet, kein Warten, Bankwechsel klickfrei. Mehr als 16 s spielt ein Pad nie, auch nicht im Hold-Modus.

### Bank-Editor (Browser)

Solange das Device läuft: Button **Editor** im Device drücken, oder **http://localhost:8765/editor** im Browser öffnen (http://localhost:8765 leitet dorthin weiter). Der Editor steuert immer das erste YT-Sampler-Device (oben rechts steht „steuert: <Spurname>“) und zeigt dieselbe Bank wie das Device.

| Aktion | Wie |
|---|---|
| Video suchen, neue Bank | „Video suchen“ oder ⌘K, Begriff oder YouTube-URL. Treffer anklicken oder auf die Pads ziehen: Track laden, 16 Starts würfeln, Bank am Ende anlegen, sie wird aktiv. |
| Bank wählen | Klick in der Liste, ◀ ▶ oder ↑/↓ |
| umbenennen, duplizieren, löschen | Icons an der Zeile, umbenennen auch per Doppelklick. Löschen fragt nicht, dafür 5 s „Rückgängig“. |
| verschieben | Zeile in der Liste ziehen |
| Start setzen | Marker in der Waveform ziehen. Rastet auf Schläge, mit Alt frei. |
| neues Snippet | Würfel am Pad oder „Neues Snippet“ |
| Pads tauschen | Pad auf Pad ziehen |
| anspielen | Pad klicken, klingt am Device |
| Tempo | Zahlenfeld, ½×, 2×, „Tempo stimmt“ (gilt für alle Bänke des Videos) |
| Device-Regler | Leiste über den Pads, siehe unten |
| Rückgängig | ⌘Z / ⇧⌘Z oder ↶ ↷ (100 Schritte, nur in diesem Fenster) |

**Device-Regler im Editor:** Die Leiste über den Pads zeigt die Regler des Device: links die Bühne (Slice, Rate, Trigger/Hold, Rev, Tune, Warp, Quant, Raster, Catch), rechts gedämpft die Einrichtung (Base Note, Voices, Volume). Es ist derselbe Zustand wie im Device: Dreht man am Device (oder per MIDI), folgt der Editor. Stellt man im Editor, bewegt sich der Regler im Device und wird mit dem Set gespeichert. Doppelklick auf Rate bzw. Volume setzt 1× bzw. 0 dB. Die Regler sind kein Schritt im Rückgängig des Editors. Ohne laufendes Device ist die Leiste ausgegraut.

Alles wird sofort gespeichert. Ist der ganze Track nicht im Cache, heißt die Bank „nur spielbar“: Starts lassen sich dann nicht ändern, „Track laden“ holt ihn. „Alle nachladen“ im Listenfuß holt alle fehlenden Tracks.

### Am Device

`Bank`, ◀ und ▶ schalten durch die Bibliothek (siehe Bedienung oben). Die Anzeige links zeigt:

| Anzeige | Bedeutung |
|---|---|
| Nummer + Name | Bank aktiv |
| „-“ | nichts geladen, Pads stumm |
| „Bibliothek leer“ | noch keine Bank, Pads stumm. Im Editor eine anlegen. |
| „Bibliothek kaputt“ | `library.json` unlesbar (oder iCloud hat sie noch nicht geladen). Pads stumm, nichts wird gespeichert. Geht von selbst weiter, sobald die Datei wieder lesbar ist. |
| „nicht ladbar“ | Snippets fehlen und der Track auch. Lief vorher eine Bank, spielt sie weiter (nur kurz eingeblendet). Sonst stumm, Status „Bank im Editor prüfen“. |
| kurz „Bank gelöscht“ | die im Set gespeicherte Bank gibt es nicht mehr. Das Device lädt die Bank, die jetzt auf ihrem Platz steht (hinter der letzten: die letzte). |

**Update auf 3.0:** Die Regler Tonal, Attack, Release, Source BPM, ÷2, ×2, Grid und Snap gibt es nicht mehr, ihre MIDI-Mappings gehen verloren. Alle anderen Mappings bleiben. Teletext-Seite, IR-Fernbedienung, Schreibmaschine (Kanal 16) und das Spielen eines ganzen Videos ohne Bank sind weggefallen. Ein Set, das ohne Bank gespeichert war (Teletext oder 1.x), lädt beim Öffnen die Bank, auf der der Regler `Bank` steht.

## Speichern

Das Device merkt sich automatisch die aktive Bank. Beim Öffnen des Sets wird sie wieder geladen, auch wenn sie inzwischen auf einem anderen Platz steht. Kennt das Device keine Bank (neues Device, altes Set, Bank gelöscht), lädt es die Bank, auf der der Regler `Bank` steht.

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

Beim ersten Laden eines Videos werden Tempo, Schläge und die „1“ erkannt und gecacht. Der Status zeigt z. B. „94 BPM“. Ist das Tempo falsch (typisch: halb/doppelt, z. B. 172 → 86 bei Drum & Bass), korrigiert man es **im Editor** (Zahlenfeld, ½×, 2×, „Tempo stimmt“). Das Tempo steht dann in der Bibliothek und gilt für alle Bänke des Videos, das Raster wird sofort neu berechnet.

Der Beat-Tracker folgt leichten Tempo-Schwankungen, eine echte Band ist also kein Problem. Die „1“ jedes Takts schätzt er aus der Kick und aus Harmoniewechseln. Ein Intro ohne Beat (Stille, Gerede, Flächen) wird übersprungen, Takt 1 ist dort, wo der Beat einsetzt.

- **Linien:** Sind Beats erkannt, zeigen über der Waveform orange Linien die Takte und feine weiße Linien die Schläge (nur wenn genug Platz ist). Einen Schalter dafür gibt es nicht. Die Waveform zeigt die 16 Snippets nebeneinander, kleine Dreiecke oben markieren die Pads, das gewählte ist weiß.
- **Zeile unter der Waveform:** Position des gewählten Pads als Takt.Schlag, z. B. „T6.1“ (nur mit Beats), dazu „W×1.32“ (Streckfaktor) oder „W: kein Tempo“.
- **Warp mit Beats:** Jeder Slice ist genau ein Notenwert des Original-Grooves, von Raster zu Raster. Schwankt das Original, passt sich der Streckfaktor pro Slice an, das Ergebnis läuft exakt in deinem Tempo. Ohne Beats gilt ein festes Verhältnis Set-Tempo / Quelltempo.
- **Würfeln** (im Editor): Ist ein sicherer Beat erkannt, starten neue Pads auf Taktanfängen.

Grenzen: Timestretching verschmiert Transienten leicht, hat etwas Latenz und braucht mehr CPU.

## Hinweise

- Cache: `~/Music/YTSampler/cache` (ganze Tracks, WAV 44.1 kHz). Wird nie automatisch geleert, der Editor warnt ab 10 GB. Löschen geht im Finder: Bänke spielen weiter aus ihren Snippets, sind dann aber „nur spielbar“.
- Videos über 10 Minuten: Nur die ersten 10 Minuten werden geladen (RAM). Die Grenze steht als `MAX_SECONDS` in `ytsampler_node.js`.
- Takt: 4/4 wird angenommen („1 Bar“ = 4 Viertel).
- Das Herunterladen von YouTube verstößt gegen deren Nutzungsbedingungen. Für veröffentlichte Tracks die Rechte am Sample klären.
