# YT Sampler – Max for Live Instrument

Lädt YouTube-Audio, verteilt 16 Slices zufällig über das Video und macht sie per MIDI/Pads spielbar. Die Slice-Länge wird in Notenwerten gewählt und folgt live dem Tempo des Sets.

## 1. Einmalig installieren (Terminal)

```
brew install yt-dlp ffmpeg deno
```

yt-dlp braucht für YouTube inzwischen eine JavaScript-Runtime (deno). Wenn Downloads irgendwann fehlschlagen: `brew upgrade yt-dlp`, YouTube ändert öfter etwas.

## 2. Dateien

Alle Dateien gehören in **denselben Ordner**, z. B. `~/Music/Ableton/User Library/Presets/Instruments/Max Instrument/YT Sampler/`:

- `YT Sampler.amxd` – das Device
- `ytsampler_main.js` – Pad- und Tempo-Logik
- `ytsampler_node.js` – Suche und Download
- `ytpads.js` – Pad-Feld
- `ytgrid.js` – Beat-Raster und Pad-Marken über der Waveform
- `teletext.html` – Videotext-Anzeige für den externen Bildschirm
- `Teletext öffnen.command` – öffnet die Anzeige als randloses Fenster
- `ytvoice.maxpat` – Sampler-Voice für poly~
- `ytwarpvoice.maxpat` – Warp-Voice (Timestretch), rechnet nur, während sie spielt

Das Device auf eine MIDI-Spur ziehen. Wenn alles läuft: Device im Editor öffnen und **Freeze Device** klicken, dann sind die Skripte eingebettet.

**Falls die .amxd nicht öffnet:** Leeres „Max Instrument“ auf eine Spur ziehen → Edit → Inhalt löschen. `YT Sampler.maxpat` in Max öffnen, alles kopieren, in den Editor einfügen. Im Patcher-Inspector „Open in Presentation“ aktivieren und die Device-Breite auf 870 setzen, dann in den obigen Ordner speichern.

## 3. Bedienung

| Bereich | Funktion |
|---|---|
| Suche | Begriff eingeben, Enter oder „Suche“. Die Trefferliste beginnt mit „▾ N Treffer – auswählen“. Einen Treffer im Menü wählen lädt ihn, alternativ lädt „Laden“ daneben den angezeigten Eintrag. Nach der Suche wird nichts automatisch geladen. |
| Max Len | Suche zeigt nur Videos bis zu dieser Länge (1–20 min, Standard 7). Änderung filtert die letzte Suche sofort neu. |
| URL | YouTube-Link oder ID einfügen → Enter oder „Laden“ |
| Pads | Noten ab Base Note (Standard C1 = 36) spielen Pad 1–16, Pad 1 unten links. Maus-Klick geht auch. |
| Slice | Notenwert 1/64 … 2 Takte, rechnet mit dem aktuellen Live-Tempo |
| Voices | Mono, 2, 3, 4, 5, 8 oder 16 gleichzeitige Stimmen. Das gleiche Pad schneidet sich immer selbst ab, sonst wird die älteste Stimme gestohlen. |
| Tune | stimmt jedes Pad auf Lives aktuelle Skala (Live 12: Skala-Grundton + Skalatyp). Transponiert wird so, dass möglichst viele Töne in der Skala liegen, max. ±6 Halbtöne, plus Korrektur der Stimmung der Aufnahme (Abweichung von A=440). |
| Tonal | Schwelle 0–1: Pads mit geringerer Tonalitäts-Konfidenz (Drums, Sprache, Rauschen) werden nicht transponiert. Standard 0,5. |
| Warp | Material läuft im Tempo des Sets, Tonhöhe bleibt (Timestretch, élastique über `groove~`). Rate und Tune ändern dann nur die Tonhöhe. Aus = klassischer Sampler-Modus, knackiger für Drums. |
| Src BPM | erkanntes Tempo des Videos. Überschreibbar, gilt dann als bestätigt. |
| ÷2 / ×2 | korrigiert die typischen Halb/Doppelt-Fehler der Erkennung |
| Grid | Pads starten auf dem erkannten Beat-Raster des Videos (knapp vor dem Einsatz). Kein erkennbarer Beat → bleibt aus, Anzeige „G: kein Beat“. |
| Snap | Rasterweite: Slice (= aktueller Notenwert), Beat oder Bar (jedes Pad startet auf einer „1“) |
| Quant | Input-Quantize: Pad-Anschläge warten auf die nächste 1/16 von Lives Transport. Bis knapp ⅓ einer 1/16 zu spät gespielt klingt sofort. Läuft der Transport nicht, wirkt Quant nicht. |
| Rate | 0.25–2×, ändert Tonhöhe, die rhythmische Länge bleibt gleich |
| Attack / Release | Fades gegen Knackser |
| Trigger / Hold | Trigger: spielt genau einen Slice (Notenwert). Hold: spielt, solange gedrückt, max. 10 s (`HOLD_MAX` in `ytsampler_main.js`) |
| Rev | rückwärts |
| Shuffle | alle nicht gesperrten Pads neu würfeln |
| Reroll Pad / ◀ ▶ / Lock | wirkt auf das zuletzt gespielte Pad (◀ ▶ = 1/8 Slice verschieben) |

**Pads spielen:** per MIDI-Noten, nicht per Cmd+M-Mapping. Controller-Pads senden ohnehin Noten. Fürs Rechner-Keyboard in Live die Computer-MIDI-Tastatur aktivieren (Taste M) und entweder Base Note auf C3 stellen oder mit Z zwei Oktaven runter gehen.

Alle Regler und Buttons sind `live.*`-Objekte: MIDI-Map-Modus (Cmd+M) funktioniert, sie sind automatisierbar und werden mit dem Set gespeichert. Wie Video, Pads und Favoriten gespeichert werden, steht unten unter „Speichern“.

## Favoriten (linker Bereich)

64 feste Plätze in 4 Bänken (A–D) à 16. Ein Favorit speichert Video **und** Slice-Positionen samt Locks. Beim Abrufen stehen die Pads also genau so da wie beim Speichern.

| Element | Funktion |
|---|---|
| 16 Slot-Buttons | Favorit der aktuellen Bank laden. Der aktive Slot leuchtet. Jeder Slot ist einzeln MIDI-mappbar. |
| A B C D | Bank wählen (mappbar) |
| Fav # | 1–64 direkt anwählen, z. B. per Encoder. Geladen wird erst, wenn der Regler kurz ruht. |
| ◀ ▶ | vorheriger/nächster belegter Favorit, leere Plätze werden übersprungen |
| + Neu | aktuelles Video + Slices auf den ersten freien Platz ab der aktuellen Bank |
| Update | aktiven Favoriten mit dem aktuellen Stand überschreiben, z. B. nach Reroll oder Nudge |
| Löschen | aktiven Favoriten leeren. Die anderen Plätze bleiben, wo sie sind, damit Mappings stimmen. |

Ist das Video schon geladen, schaltet ein Favorit nur die Slices um, sofort und ohne Nachladen.

## Speichern

Das Device merkt sich automatisch das aktuelle Video, die Pad-Positionen, die Favoriten und die aktive Bank. Beim Öffnen des Sets wird alles wieder geladen, das Audio kommt aus dem Cache.

Technisch steckt im Set nur eine unsichtbare Session-Nummer, der Zustand liegt in `~/Music/YTSampler/sessions/<nummer>.json`. Dupliziert man die Spur, bekommt die Kopie eine eigene Nummer samt Kopie des Zustands. Achtung bei „Speichern unter“: Beide Sets teilen sich danach dieselbe Session-Datei. Eine Änderung in einem Set ist dann auch im anderen zu sehen.

## Tonart-Erkennung

Beim ersten Laden eines Videos wird ein Chromagramm berechnet (ca. 3 s bei 10 Minuten) und als `.chroma` im Cache abgelegt. Jedes Pad wird in einem Fenster um seinen Slice ausgewertet, mindestens 2 s, damit auch kurze Notenwerte genug Material haben. Die Zeile unter der Waveform zeigt für das gewählte Pad die erkannte Tonart, die Konfidenz und die Verschiebung. Transponiert wird über die Abspielrate wie bei einem klassischen Sampler. Die rhythmische Slice-Länge bleibt gleich, das Tempo des Materials ändert sich leicht mit.

## Teletext-Anzeige (externer Bildschirm)

Solange das Device läuft, gibt es unter **http://localhost:8765** eine Videotext-Seite: Verbindung, Ladezustand mit Fortschrittsbalken und blinkender roter Lampe, aktueller Titel und Favorit, Suchfeld und seitenweise Trefferliste (7 pro Seite). Auf einen zweiten Bildschirm ziehen, Doppelklick = Vollbild. Oder `Teletext öffnen.command` starten, das öffnet ein randloses Chrome-Fenster.

- 40 × 25 Zeichen in 4:3, kein Scrollen. Gedacht für 720 × 576 (PAL/SCART).
- `?overscan=8` vergrößert den Sicherheitsrand, falls der Fernseher am Rand abschneidet (Standard 5 %).
- `?crt=1` simuliert Scanlines zur Vorschau auf normalen Bildschirmen. Auf der echten Röhre weglassen.
- Wird Live beendet, zeigt die Seite „KEINE VERBINDUNG“ und verbindet sich selbst neu, sobald das Device wieder läuft.
- Die Seite ist `teletext.html`. Du kannst sie frei umgestalten, sie wird bei jedem Neuladen frisch gelesen. Eine Kopie liegt unter `~/Music/YTSampler/web/`, damit sie auch bei eingefrorenem Device gefunden wird.

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

Mit Warp an ist ein Slice derselbe Notenwert im Groove des Originals, gestreckt auf dein Tempo. Favoriten speichern das Quelltempo mit.

Grenzen: Timestretching verschmiert Transienten leicht, hat etwas Latenz und braucht mehr CPU. Die Erkennung nimmt ein gleichbleibendes Tempo pro Video an. Halb/Doppelt-Verwechslungen kommen vor (z. B. 172 → 86 bei Drum & Bass).

## Grid (Beat-Raster)

Beim Laden sucht ein Beat-Tracker die Schläge im Video. Er folgt leichten Tempo-Schwankungen, eine echte Band ist also kein Problem. Dazu schätzt er, wo die „1“ jedes Takts liegt: aus der Kick und aus Harmoniewechseln. Über der Waveform zeigen orange Linien die Takte, feine weiße Linien die Schläge (nur wenn genug Platz ist), und oben markieren kleine Dreiecke die 16 Pads. Das gewählte Pad ist weiß.

- **Grid an:** Shuffle und Reroll wählen nur Rasterpunkte, ◀ ▶ springt eine Rasterstufe. Die Zeile unter der Waveform zeigt die Position als Takt.Schlag, z. B. „T6.1“.
- **Gespeichert wird die freie Position.** Grid rastet erst beim Abspielen ein. Snap oder Notenwert umschalten und zurück verändert also nichts dauerhaft.
- **Warp + Grid:** Jeder Slice ist genau ein Notenwert des Original-Grooves, von Raster zu Raster. Schwankt das Original, passt sich der Streckfaktor pro Slice an. Das Ergebnis läuft trotzdem exakt in deinem Tempo.
- **Tempo korrigieren** (Src BPM, ÷2, ×2) berechnet das Raster sofort neu, ohne neue Analyse.
- **Ohne sicheren Beat** (Sprache, Flächen, freies Spiel) bleibt Grid aus, genau wie Warp. Bestätigst du ein Tempo von Hand, wird das Raster trotzdem benutzt.
- Videos, die vor diesem Update analysiert wurden, werden beim nächsten Laden einmal neu analysiert.

## Hinweise

- Cache: `~/Music/YTSampler/cache` (WAV, 44.1 kHz). Kann jederzeit gelöscht werden.
- Videos über 10 Minuten: Nur die ersten 10 Minuten werden geladen (RAM). Die Grenze steht als `MAX_SECONDS` in `ytsampler_node.js`.
- Takt: 4/4 wird angenommen („1 Bar“ = 4 Viertel).
- Das Herunterladen von YouTube verstößt gegen deren Nutzungsbedingungen. Für veröffentlichte Tracks die Rechte am Sample klären.
