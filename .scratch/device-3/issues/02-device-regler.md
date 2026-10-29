# Device-Regler 3.0

Type: grilling
Status: resolved

## Question

Welche Regler bleiben auf der Device-Oberfläche, welche werden feste Werte, welche wandern in den Editor? Wie sieht die Oberfläche danach aus?

## Answer

Entschieden vom Nutzer (Auftrag, 2026-10-29), dazu F1 und F5.

**Bühne:** `Bank` + ◀ ▶, Division (Slice-Länge), Mode (Trigger/Hold), Rev, Tune, Warp, Quant, Rate, Volume. **Einrichten:** Base Note, Voices.

**Grid geht in Warp auf.** Einen Grid-Schalter gibt es nicht mehr. Die Takt- und Schlaglinien im Overlay sind immer an, sobald Beats da sind. Warp folgt im Trigger-Modus immer dem Beat-Raster der Quelle, wenn Beats da sind (heute „Warp + Grid“). Sonst gilt das feste Verhältnis Projekttempo/Quelltempo.

**Snap fällt weg.** Mit Bank wurde ohnehin nichts eingerastet. Die Starts setzt der Editor, dort rastet der Marker auf Schläge ein.

**Source BPM, ÷2, ×2 fallen aus dem Device.** Der Editor kann das schon: Zahlenfeld, ½×, 2× und „Tempo stimmt“ in der Detailspalte (`/cmd tempo`, `tempook`). Am Device gibt es kein `bpmset` mehr. Node schickt Korrekturen aus dem Editor weiter als `bpm <video> <bpm>`.

**Tonal, Attack, Release (F1, Nutzer 2026-10-29):** ganz weg, feste Werte im Code: Tonal 0,5, Attack 2 ms, Release 20 ms (die heutigen Startwerte). Es gibt keine unsichtbaren Parameter dafür.

**Rate** bleibt als Effekt (0,25–2). **Tune** passt weiter in Lives Skala ein (`computeShift`), nicht hart auf den Grundton.

**Parameternamen** (Bruch, Teil von 3.0.0): 8 fallen weg: `Tonal`, `Attack`, `Release`, `Source BPM`, `BPM Half`, `BPM Double`, `Grid`, `Snap`. Mappings auf die übrigen bleiben erhalten, weil sich deren Namen nicht ändern.

**Oberfläche (F5, Nutzer 2026-10-29):** Die Breite bleibt bei 1024, die Waveform bleibt groß. Die frei werdende Fläche unter der Waveform bekommen die Bühnenschalter: Mode, Rev, Tune, Warp und Quant werden größer (etwa 70 × 30 statt 78 × 18). Base Note und Voices rücken als Einricht-Gruppe nach rechts. Maße siehe Spec 4.1.
