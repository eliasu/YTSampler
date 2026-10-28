# Bank speichert Snippets statt ganzer WAV

Type: grilling
Status: resolved

## Question

Wunsch des Nutzer (2026-10-28): Eine Bank speichert nur ihre 16 Snippets statt der ganzen WAV. Den ganzen Track lädt nur der Editor (mit Internet), damit man die Starts bearbeiten kann. Zusätzlich soll der Editor warnen, wie groß der Cache ist.

Zu klären:
- Wie lang ist ein Snippet?
- Was passiert mit Hold (spielt heute bis Songende) und Hold rückwärts (heute ab Start nach links)?
- Was gilt für den Cache der ganzen WAVs, und wann warnt der Editor?
- Was zeigt die Waveform im Device?
- Was gilt, wenn ein Video bei YouTube verschwunden ist?

Das berührt bereits entschiedene Tickets: 01 (Länge vom Device), 04 (Pad-Marken auf der Waveform), 05 (WAV nachladen), 09 (Format), 10 (Sicherung).

Fakten (`ytsampler_main.js`): Die Division reicht bis „2 Bars“, Rate bis 4×, das Warp-Verhältnis bis 4×. Bei 120 BPM sind 2 Takte 4 s. Hold spielt bis `durMs`, Hold rückwärts von Start bis 0. Der Cache hat heute 60 WAVs mit 2,3 GB.

## Answer

Geklärt am 2026-10-28 mit dem Nutzer in einer Runde. Alle Empfehlungen sind bestätigt, nur die Warnschwelle ist höher.

**Kernaussage:** Eine Bank besteht auf der Bühne aus 16 gespeicherten Snippets zu je 16 s. Den ganzen Track braucht nur der Editor zum Bearbeiten. Er liegt in einem lokalen Wegwerf-Cache.

**Entscheidungen**
1. **Länge:** Jedes Snippet ist 16 s lang ab seinem Start. Das sind 2 Takte, auch bei Warp 4× und 120 BPM, unkomprimiert etwa 45 MB pro Bank. Division, Rate und Warp gelten weiter wie in Ticket 01, aber nie über das Snippet-Ende hinaus. Endet der Track früher, ist das Snippet kürzer.
2. **Hold** spielt bis zum Ende des Snippets statt bis zum Songende und blendet dort kurz aus.
3. **Hold rückwärts** spielt das Snippet von hinten nach vorn. Vor dem Start wird nichts mitgespeichert.
4. **Cache der ganzen WAVs:** Er ist lokal und wegwerfbar, liegt nicht in iCloud und wird nie automatisch gelöscht. Der Editor zeigt seine Größe an. Es gibt keinen Knopf zum Leeren, aufgeräumt wird von Hand im Finder.
5. **Warnung** ab 10 GB Cache-Größe.
6. **Waveform im Device:** Sie zeigt die 16 Snippets nebeneinander, Pad 1 bis 16.
7. **Video bei YouTube weg:** Die Bank bleibt spielbar. Umbenennen, verschieben, duplizieren, löschen und Pads tauschen gehen weiter. Starts verschieben und „Neues Snippet“ gehen nur, solange der ganze Track im Cache liegt. Sonst zeigt der Editor die Bank als „nur spielbar“.

**Was das an entschiedenen Tickets ändert** (die Master-Session hat Hinweise in die Tickets gesetzt)
- [01](01-grundsatzentscheidungen.md): Die Länge kommt weiter vom Device, ist aber auf 16 s begrenzt.
- [04](04-device-oberflaeche-2.md): Die Waveform zeigt Snippets statt des Songs. Pad-Marken über dem ganzen Song gibt es nicht mehr, nur die 16 Grenzen. Ob dafür das Grid-Overlay nötig ist, entscheidet der Bau.
- [05](05-bank-auf-der-buehne-robust.md): Auf der Bühne wird nie eine ganze WAV geladen, und Internet braucht es nicht. „WAV fehlt im Cache“ und „Alle nachladen“ betreffen nur noch den Editor. Fehlen die Snippets einer Bank (z. B. von iCloud nicht geladen), gilt sie als „nicht ladbar“.
- [09](09-format-der-bibliotheksdatei.md): Die Starts bleiben in `library.json` (zum Bearbeiten). Dazu kommt pro Bank eine Snippet-Datei, deren Name sich aus der Bank-`id` ableitet, mit relativem Pfad. Nach jeder Änderung an Starts oder Pads schneidet Node die Snippets neu aus der ganzen WAV.
- [10](10-sicherung-der-bibliothek.md): In iCloud liegen Bibliothek, Snippets, Sessions, `ir.json` und `web/`. Der Cache der ganzen WAVs bleibt lokal, wie `chrome-profile/`.
- Teletext lädt weiter ganze Videos ins Device („keine Bank“, Ticket 04). Diese landen im lokalen Cache.

**Offen:** Wie Tune, Grid/Snap und Warp+Grid im Device mit Snippets arbeiten, steht in Ticket 12.
