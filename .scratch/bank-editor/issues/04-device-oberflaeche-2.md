# Device-Oberfläche 2.0

Type: grilling
Status: resolved

## Question

Welche Elemente bleiben in der Presentation-Ansicht (Breite 1378), welche fallen weg und was kommt dazu?

- Wegfallen sollen Suchfeld, Treffer-Menü, URL, Max Len, Würfeln/Shuffle/Reroll/Nudge, Lock, die Fav-Buttons und Fav-Slots, Fav-# und die Bänke A–D. Gibt es darunter etwas, das trotzdem bleiben soll?
- Neu: Bank-Regler über die ganze Bibliothek. Ein `live.dial` hat einen festen Wertebereich, die Bibliothek wächst aber. Bekommt der Regler einen festen Bereich (z. B. 1–999, oberhalb der letzten Bank passiert nichts), oder verteilt er 0–100 % auf alle Bänke? Was macht ein MIDI-Mapping beim Wachsen der Bibliothek?
- Vor/Zurück: Laufen sie am Ende im Kreis herum?
- Anzeige: Wo stehen Banknummer und Name? Pad-Marken auf der Waveform setzen voraus, dass der bekannte Grid-Overlay-Fehler (Router entfernt `grid`) behoben ist.
- Parameternamen ändern sich (MIDI-Mappings im Set): Welche alten Namen dürfen verschwinden?

## Answer

> **Teilweise überholt durch [Snippets statt ganzer WAV](11-snippets-statt-ganzer-wav.md):** Waveform zeigt die 16 Snippets statt des ganzen Songs.

Geklärt am 2026-10-28, zwei Runden mit dem Nutzer. Fakten aus `YT Sampler.maxpat` und `ytsampler_main.js` (Stand 1.3.1).

**Was wegfällt**
- Der ganze linke Block (x 5–255): `Fav Bank` (A–D), `Fav Select` (1–64), 16 Fav-Slots, ◀ ▶, `+ Neu`, `Update`, `Löschen`, Info-Zeile `favinfo`.
- Der Suchblock (x 267–512): Suchfeld, `Max Length`, Suche, Treffer-Menü, Laden, URL, Laden.
- Aus der Reglerzeile: `Lock`, `Shuffle`, `Reroll Pad`, Nudge ◀ ▶.

**Was bleibt**
- Pads (jsui), Waveform mit `selinfo`, Division, Base Note, Voices, Rate, Attack, Release, Mode, Rev, Tune/Tonal, Warp/Source BPM/÷2/×2, Grid/Snap, Quant, Volume.
- Die Status-Zeile (`statustext`, heute im Suchblock). Sie zieht in den neuen linken Block.
- Der unsichtbare Parameter `Session`.

**Neu: Bank-Auswahl im linken Block**
- Oben steht groß die Banknummer mit dem Namen. Darunter liegen der Regler `Bank` und die Knöpfe ◀ ▶, darunter die Status-Zeile.
- Beim Drehen oder Drücken zeigt die Anzeige schon die Ziel-Bank, bevor sie lädt (wie heute `favselect`).
- Der freie Platz fällt weg. Das Device wird schmaler, ungefähr 1000 statt 1378 (der genaue Wert ergibt sich beim Bauen).

**Bank-Regler**
- `live.numbox` mit dem festen Bereich 1–128. Ein Schritt ist eine Bank, ein absoluter CC trifft genau eine Bank (CC 0 = Bank 1, CC 127 = Bank 128). Ein MIDI-Mapping bleibt stabil, wenn die Bibliothek wächst.
- Steht der Regler über der letzten Bank, zeigt die Anzeige „leer“ und es wird nichts geladen.
- Geladen wird erst, wenn der Regler 350 ms ruht (wie heute `favselect`).

**Vor/Zurück**
- Sie bleiben an der ersten und letzten Bank stehen. Im Kreis laufen sie nicht mehr, heute tun sie das.
- Sie warten wie der Regler 350 ms Ruhe ab. Dreimal schnell drücken lädt also nur die dritte Bank.
- Sie reichen über Bank 128 hinaus, die Bibliothek hat keine Obergrenze. Ab Bank 129 bleibt der Regler auf 128 stehen, Nummer und Name zeigen die echte Bank.

**Set öffnen**
- Live stellt `Bank` aus dem Set wieder her. Das Device lädt diese Bank so, wie sie jetzt in der Bibliothek steht. Änderungen aus dem Editor gelten also.
- Stand beim Speichern „keine Bank“ (siehe Teletext), stellt die Session-Datei den Track wie heute wieder her.

**Teletext**
- Teletext bleibt, wie es ist, und kann weiter Videos laden. Das Device zeigt dann „keine Bank“ und würfelt wie heute. Gespeichert wird nichts, eine Bank daraus entsteht nur im Editor.

**Parameternamen** (Bruch, Teil von 2.0.0)
- Alle 26 alten Namen fallen weg: `Fav Bank`, `Fav Select`, `Fav Slot 1`–`16`, `Fav Prev`, `Fav Next`, `Fav Add`, `Fav Update`, `Fav Delete`, `Search`, `Load Result`, `Load URL`, `Max Length`, `Lock`, `Shuffle`, `Reroll`, `Nudge Left`, `Nudge Right`.
- Neu sind `Bank`, `Bank Prev` und `Bank Next`. Alte Mappings auf die Fav-Knöpfe lernt der Nutzer einmal neu.

**Voraussetzung:** Pad-Marken auf der Waveform gehen erst, wenn der bekannte Grid-Overlay-Fehler aus `CLAUDE.md` behoben ist. Der UI-Router entfernt `grid`, deshalb kommt bei `ytgrid.js` nur `clear`/`dur`/`pads …` an. Das muss vor oder mit dem Umbau behoben werden, entweder mit `prepend grid` oder mit eigenen Funktionen in `ytgrid.js`.

**Offen, für die Karte:** Der Regler und das Set merken sich die Bank nach ihrer Position in der Bibliothek. Verschiebt oder löscht man im Editor eine Bank, zeigen gespeicherte Sets und Mappings danach auf eine andere Bank.
