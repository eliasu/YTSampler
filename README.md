# YT Sampler – Max for Live Instrument

Spielt Bänke aus 16 Slices eines YouTube-Tracks per MIDI/Pads. Die Bänke stellst du im Browser-Editor zusammen, auf der Bühne schaltest du sie am Device durch. Die Slice-Länge wird in Notenwerten gewählt und folgt live dem Tempo des Sets.

## 1. Einmalig installieren (Terminal)

```
brew install yt-dlp ffmpeg deno
```

yt-dlp braucht für YouTube inzwischen eine JavaScript-Runtime (deno). Wenn Downloads irgendwann fehlschlagen: `brew upgrade yt-dlp`, YouTube ändert öfter etwas.

## 2. Dateien

Alle Dateien gehören in **denselben Ordner**, z. B. `~/Music/Ableton/User Library/Presets/Instruments/Max Instrument/YT Sampler/`:

- `YT Sampler.amxd` – das Device
- `ytsampler_main.js` – Pad- und Tempo-Logik
- `ytsampler_node.js` – Bibliothek, Suche, Download, Webserver für Editor und Teletext
- `editor.html` – Bank-Editor im Browser
- `ytpads.js` – Pad-Feld
- `ytgrid.js` – Beat-Raster und Pad-Marken über der Waveform
- `teletext.html` – Videotext-Anzeige für den externen Bildschirm
- `Teletext öffnen.command` – öffnet die Anzeige als randloses Fenster
- `ytvoice.maxpat` – Sampler-Voice für poly~
- `ytwarpvoice.maxpat` – Warp-Voice (Timestretch), rechnet nur, während sie spielt

Das Device auf eine MIDI-Spur ziehen. Wenn alles läuft: Device im Editor öffnen und **Freeze Device** klicken, dann sind die Skripte eingebettet.

**Falls die .amxd nicht öffnet:** Leeres „Max Instrument“ auf eine Spur ziehen → Edit → Inhalt löschen. `YT Sampler.maxpat` in Max öffnen, alles kopieren, in den Editor einfügen. Im Patcher-Inspector „Open in Presentation“ aktivieren und die Device-Breite auf 1024 setzen, dann in den obigen Ordner speichern.

## 3. Bedienung

| Bereich | Funktion |
|---|---|
| Anzeige links | große Banknummer und Name, darunter `Bank` mit ◀ ▶, darunter die Statuszeile |
| Bank | 1–128 direkt anwählen, z. B. per Encoder oder CC (CC 0 = Bank 1). Beim Drehen zeigt die Anzeige das Ziel, geladen wird erst, wenn der Regler 350 ms ruht. Über der letzten Bank steht „leer“, dann lädt nichts. |
| ◀ ▶ | vorherige/nächste Bank, bleibt an der ersten und letzten stehen. Geht auch über 128 hinaus (der Regler bleibt auf 128, die Anzeige zeigt die echte Nummer). |
| Pads | Noten ab Base Note (Standard C1 = 36) spielen Pad 1–16, Pad 1 unten links. Maus-Klick geht auch. |
| Slice | Notenwert 1/64 … 2 Takte, rechnet mit dem aktuellen Live-Tempo |
| Voices | Mono, 2, 3, 4, 5, 8 oder 16 gleichzeitige Stimmen. Das gleiche Pad schneidet sich immer selbst ab, sonst wird die älteste Stimme gestohlen. |
| Tune | stimmt jedes Pad auf Lives aktuelle Skala (Live 12: Skala-Grundton + Skalatyp). Transponiert wird so, dass möglichst viele Töne in der Skala liegen, max. ±6 Halbtöne, plus Korrektur der Stimmung der Aufnahme (Abweichung von A=440). |
| Tonal | Schwelle 0–1: Pads mit geringerer Tonalitäts-Konfidenz (Drums, Sprache, Rauschen) werden nicht transponiert. Standard 0,5. |
| Warp | Material läuft im Tempo des Sets, Tonhöhe bleibt (Timestretch, élastique über `groove~`). Rate und Tune ändern dann nur die Tonhöhe. Aus = klassischer Sampler-Modus, knackiger für Drums. |
| Src BPM | erkanntes Tempo des Videos. Überschreibbar, gilt dann als bestätigt, auch wenn du dieselbe Zahl noch einmal eintippst. Das Tempo landet in der Bibliothek und gilt für alle Bänke dieses Videos. |
| ÷2 / ×2 | korrigiert die typischen Halb/Doppelt-Fehler der Erkennung |
| Grid | Pads starten auf dem erkannten Beat-Raster des Videos (knapp vor dem Einsatz). Kein erkennbarer Beat → bleibt aus, Anzeige „G: kein Beat“. |
| Snap | Rasterweite: Slice (= aktueller Notenwert), Beat oder Bar (jedes Pad startet auf einer „1“) |
| Quant | Input-Quantize: Pad-Anschläge warten auf die nächste 1/16 von Lives Transport. Bis knapp ⅓ einer 1/16 zu spät gespielt klingt sofort. Läuft der Transport nicht, wirkt Quant nicht. |
| Rate | 0.25–2×, ändert Tonhöhe, die rhythmische Länge bleibt gleich |
| Attack / Release | Fades gegen Knackser |
| Trigger / Hold | Trigger: spielt genau einen Slice (Notenwert). Hold: spielt, solange gedrückt, mit Bank längstens 16 s (Ende des Snippets), ohne Bank bis Songende |
| Rev | rückwärts |

**Pads spielen:** per MIDI-Noten, nicht per Cmd+M-Mapping. Controller-Pads senden ohnehin Noten. Fürs Rechner-Keyboard in Live die Computer-MIDI-Tastatur aktivieren (Taste M) und entweder Base Note auf C3 stellen oder mit Z zwei Oktaven runter gehen.

Alle Regler und Buttons sind `live.*`-Objekte: MIDI-Map-Modus (Cmd+M) funktioniert, sie sind automatisierbar und werden mit dem Set gespeichert. Wie Bank und Pads gespeichert werden, steht unten unter „Speichern“.

## Bänke und Bibliothek

Eine **Bank** sind 16 Pads aus genau einem Track. Gespeichert werden Video, Name und die 16 Startpunkte. Die Slice-Länge kommt immer von den Reglern am Device. Alle Bänke zusammen sind die **Bibliothek**, geordnet und für alle Live-Sets gleich. Die Banknummer ist der Platz in der Liste und ändert sich beim Umsortieren.

Pro Bank liegen die 16 Pads als **Snippets** à 16 s in einer eigenen Datei. Auf der Bühne lädt das Device nur diese Datei: kein Internet, kein Warten, Bankwechsel klickfrei. Mehr als 16 s spielt ein Pad nie, auch nicht im Hold-Modus.

### Bank-Editor (Browser)

Solange das Device läuft: **http://localhost:8765/editor** im Browser öffnen. Der Editor steuert immer das erste YT-Sampler-Device (oben rechts steht „steuert: <Spurname>“) und zeigt dieselbe Bank wie das Device.

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
| Tempo | Zahlenfeld, ½×, 2×, „Tempo stimmt“ |
| Rückgängig | ⌘Z / ⇧⌘Z oder ↶ ↷ (100 Schritte, nur in diesem Fenster) |

Alles wird sofort gespeichert. Ist der ganze Track nicht im Cache, heißt die Bank „nur spielbar“: Starts lassen sich dann nicht ändern, „Track laden“ holt ihn. „Alle nachladen“ im Listenfuß holt alle fehlenden Tracks.

### Am Device

`Bank`, ◀ und ▶ schalten durch die Bibliothek (siehe Bedienung oben). Die Anzeige links zeigt:

| Anzeige | Bedeutung |
|---|---|
| Nummer + Name | Bank aktiv |
| „keine Bank: <Titel>“ | ganzer Track ohne Bank (Teletext oder altes 1.x-Set), spielt wie früher |
| „Bibliothek leer“ | noch keine Bank, Pads stumm. Im Editor eine anlegen. |
| „Bibliothek kaputt“ | `library.json` unlesbar (oder iCloud hat sie noch nicht geladen). Pads stumm, nichts wird gespeichert. Geht von selbst weiter, sobald die Datei wieder lesbar ist. |
| kurz „nicht ladbar“ | Snippets fehlen und der Track auch. Die alte Bank spielt weiter. |
| kurz „Bank gelöscht“ | die im Set gespeicherte Bank gibt es nicht mehr, das Device lädt die gespeicherte Kopie als „keine Bank“ |

Nach dem Update auf 2.0 die MIDI-Mappings für `Bank`, `Bank Prev` und `Bank Next` einmal neu setzen. Die alten Favoriten-, Such-, Lock-, Shuffle-, Reroll- und Nudge-Regler gibt es nicht mehr, die Favoriten werden nicht übernommen.

## Speichern

Das Device merkt sich automatisch die aktive Bank (bzw. ohne Bank Video und Pad-Positionen). Beim Öffnen des Sets wird sie wieder geladen, auch wenn sie inzwischen auf einem anderen Platz steht.

Technisch steckt im Set nur eine unsichtbare Session-Nummer, der Zustand liegt in `sessions/<nummer>.json` im Datenordner. Dupliziert man die Spur, bekommt die Kopie eine eigene Nummer samt Kopie des Zustands. Achtung bei „Speichern unter“: Beide Sets teilen sich danach dieselbe Session-Datei.

### Datenordner und iCloud

Bibliothek, Snippets, Sessions und Fernbedienung liegen in **iCloud Drive** unter `iCloud Drive/YTSampler/` (ohne iCloud in `~/Music/YTSampler/`). Lokal in `~/Music/YTSampler/` bleiben nur der Cache der ganzen Tracks und das Chrome-Profil.

- **Umzug:** Beim ersten Start von 2.0 schiebt das Device alles außer `cache/` und `chrome-profile/` aus `~/Music/YTSampler/` nach iCloud. Klappt das nicht, arbeitet es im alten Ordner weiter und zeigt „Umzug nach iCloud fehlgeschlagen“.
- **Einmal im Finder:** Ordner `YTSampler` in iCloud Drive rechts anklicken → **„Geladen lassen“**. Sonst lagert macOS die Snippets aus, und auf der Bühne ohne Internet fehlen sie („Bibliothek kaputt“ bzw. „nicht ladbar“).
- Es arbeitet immer nur ein Rechner gleichzeitig mit der Bibliothek.
- **Sicherung:** Bei jedem Start legt das Device eine Kopie der Bibliothek in `backup/` ab (die 10 neuesten bleiben). Zurückholen: Kopie im Finder über `library.json` legen, Device neu laden.

## Tonart-Erkennung

Beim ersten Laden eines Videos wird ein Chromagramm berechnet (ca. 3 s bei 10 Minuten) und als `.chroma` im Cache abgelegt. Jedes Pad wird in einem Fenster um seinen Slice ausgewertet, mindestens 2 s, damit auch kurze Notenwerte genug Material haben. Die Zeile unter der Waveform zeigt für das gewählte Pad die erkannte Tonart, die Konfidenz und die Verschiebung. Transponiert wird über die Abspielrate wie bei einem klassischen Sampler. Die rhythmische Slice-Länge bleibt gleich, das Tempo des Materials ändert sich leicht mit.

## Teletext-Anzeige (externer Bildschirm)

Solange das Device läuft, gibt es unter **http://localhost:8765** eine Videotext-Seite: Verbindung, Ladezustand mit Fortschrittsbalken und blinkender roter Lampe, aktueller Titel, Suchfeld und seitenweise Trefferliste (7 pro Seite). Auf einen zweiten Bildschirm ziehen, Doppelklick = Vollbild. Oder `Teletext öffnen.command` starten, das öffnet ein randloses Chrome-Fenster.

- 40 × 25 Zeichen in 4:3, kein Scrollen. Gedacht für 720 × 576 (PAL/SCART).
- `?overscan=8` vergrößert den Sicherheitsrand, falls der Fernseher am Rand abschneidet (Standard 5 %).
- `?crt=1` simuliert Scanlines zur Vorschau auf normalen Bildschirmen. Auf der echten Röhre weglassen.
- Wird Live beendet, zeigt die Seite „KEINE VERBINDUNG“ und verbindet sich selbst neu, sobald das Device wieder läuft.
- Die Seite ist `teletext.html`. Du kannst sie frei umgestalten, sie wird bei jedem Neuladen frisch gelesen. Eine Kopie liegt im Datenordner unter `web/`, damit sie auch bei eingefrorenem Device gefunden wird.

### Tastatur / Schreibmaschine

Tippen geht auf zwei Wegen:

1. **MIDI (empfohlen für die Schreibmaschine):** Noten auf **Kanal 16** sind Tasten, die Notennummer ist der Zeichencode. Das funktioniert unabhängig davon, welches Fenster vorne ist. Pads bleiben auf den anderen Kanälen.
2. **Normale Tastatur**, wenn das Teletext-Fenster vorne ist. Praktisch zum Testen.

| Note (Kanal 16) | Funktion | Mac-Tastatur im Browser |
|---|---|---|
| 32–126 | Zeichen (ASCII, z. B. 65 = A, 97 = a, 32 = Leertaste) | Zeichen |
| 1 2 3 4 / 5 6 7 | ä ö ü ß / Ä Ö Ü | Umlaute |
| 8 | Zeichen löschen | ⌫ |
| 13 | Enter: neuer Begriff → suchen, sonst markierten Treffer laden | ↵ |
| 27 | Eingabe leeren | Esc |
| 17 / 18 | Treffer hoch / runter | ↑ / ↓ |
| 19 / 20 | Seite zurück / vor | ← / → oder Bild ↑/↓ |

**Routing in Live**, wenn Mutprobe und Schreibmaschine gleichzeitig spielen sollen: Die Spur mit dem YT Sampler bekommt als Eingang die Mutprobe. Eine zweite MIDI-Spur bekommt als Eingang die Schreibmaschine, und als Ausgang wählst du die Sampler-Spur. Beide Spuren auf Monitor „In“ stellen, oder beide aufnahmebereit schalten.

## Tempo-Erkennung und Warp

Das Tempo wird zusammen mit der Tonart beim Laden erkannt und gecacht. Der Status zeigt z. B. „94 BPM“. Ist die Erkennung unsicher (Sprache, Flächen, freies Tempo), steht „(unsicher)“ dabei, und Warp bleibt für dieses Video aus, bis du das Tempo bestätigst: Wert eintippen oder ÷2/×2 drücken. Die Zeile unter der Waveform zeigt dann „W×1.32“ (Streckfaktor), „W? Tempo bestätigen“ oder „W: kein Tempo“.

Mit Warp an ist ein Slice derselbe Notenwert im Groove des Originals, gestreckt auf dein Tempo. Das bestätigte Tempo steht in der Bibliothek und gilt für alle Bänke des Videos.

Grenzen: Timestretching verschmiert Transienten leicht, hat etwas Latenz und braucht mehr CPU. Die Erkennung nimmt ein gleichbleibendes Tempo pro Video an. Halb/Doppelt-Verwechslungen kommen vor (z. B. 172 → 86 bei Drum & Bass).

## Grid (Beat-Raster)

Beim Laden sucht ein Beat-Tracker die Schläge im Video. Er folgt leichten Tempo-Schwankungen, eine echte Band ist also kein Problem. Dazu schätzt er, wo die „1“ jedes Takts liegt: aus der Kick und aus Harmoniewechseln. Ein Intro ohne Beat (Stille, Gerede, Flächen) wird dabei übersprungen, Takt 1 ist dort, wo der Beat einsetzt. Über der Waveform zeigen orange Linien die Takte, feine weiße Linien die Schläge (nur wenn genug Platz ist), und oben markieren kleine Dreiecke die 16 Pads. Das gewählte Pad ist weiß.

- **Würfeln:** Ist ein sicherer Beat erkannt, starten neue Pads auf Taktanfängen (im Editor und beim Laden über Teletext).
- **Mit Bank** stehen die Starts fest, Grid und Snap verschieben nichts. Die Waveform zeigt die 16 Snippets nebeneinander, die Linien liegen auf den Schlägen in jedem Snippet. Die Zeile unter der Waveform zeigt die Position als Takt.Schlag, z. B. „T6.1“.
- **Ohne Bank** (Teletext) wird die freie Position gespeichert, Grid rastet erst beim Abspielen ein.
- **Warp + Grid:** Jeder Slice ist genau ein Notenwert des Original-Grooves, von Raster zu Raster. Schwankt das Original, passt sich der Streckfaktor pro Slice an. Das Ergebnis läuft trotzdem exakt in deinem Tempo.
- **Tempo korrigieren** (Src BPM, ÷2, ×2) berechnet das Raster sofort neu, ohne neue Analyse.
- **Ohne sicheren Beat** (Sprache, Flächen, freies Spiel) bleibt Grid aus, genau wie Warp. Bestätigst du ein Tempo von Hand, wird das Raster trotzdem benutzt.
- Videos, die vor diesem Update analysiert wurden, werden beim nächsten Laden einmal neu analysiert.

## Hinweise

- Cache: `~/Music/YTSampler/cache` (ganze Tracks, WAV 44.1 kHz). Wird nie automatisch geleert, der Editor warnt ab 10 GB. Löschen geht im Finder: Bänke spielen weiter aus ihren Snippets, sind dann aber „nur spielbar“.
- Videos über 10 Minuten: Nur die ersten 10 Minuten werden geladen (RAM). Die Grenze steht als `MAX_SECONDS` in `ytsampler_node.js`.
- Takt: 4/4 wird angenommen („1 Bar“ = 4 Viertel).
- Das Herunterladen von YouTube verstößt gegen deren Nutzungsbedingungen. Für veröffentlichte Tracks die Rechte am Sample klären.
