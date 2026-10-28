# Bestehender Webserver und Datenwege

Type: research
Status: resolved

## Question

Was können der Webserver in `ytsampler_node.js` und die Wege Node ↔ `[js]` heute schon, und was fehlt für einen Editor, der das Device fernsteuert?

Im Einzelnen:
- Welche Routen gibt es, und wie kommt der Zustand zur Teletext-Seite (Polling, SSE, …)? Wie kommen Tasten zurück (`POST /key`)?
- Welche Zustände (Video, 16 Starts, aktuelle Bank, Beats, Stille, Dauer) kennt heute nur `[js]` und welche kennt Node? Was müsste `[js]` neu an Node melden?
- Kann der Browser die Waveform zeichnen? Die WAVs liegen im Cache (`<id>.wav`, 44,1 kHz/16 Bit/Stereo). Lohnt sich eine Peaks-Datei, oder reicht es, die WAV auszuliefern?
- Wie kommt ein Pad-Anschlag aus dem Browser hörbar in Live (Weg über `hit()`/`trigger`)?
- Wo stehen die Favoriten heute (Session-Datei, `st.favs`), und was davon wird beim Umbau zur Bibliothek frei?

## Answer

Ausführlich mit Datei:Zeile: [research/02-webserver-und-datenwege.md](../research/02-webserver-und-datenwege.md).

- **Server:** nacktes `http`, nur `127.0.0.1`, Ports 8765–8770. Routen: `/events` (SSE-Push des ganzen `viewState()`, 30 ms gebündelt), `POST /key` (max. 1000 Byte, immer 204), `/state`, `/` (nur `teletext.html`).
- **Zustand:** `viewState()` enthält nur Teletext-Sachen (Suche, Laden, Titel, Fav-Name). Pads, Starts, Dauer, `sel`, Device-Regler kennt nur `[js]`. Node hat Analyse, Stille (`silentRanges`) und Beats (`trackBeats`, wird aber nicht aufgehoben); `st.pads` sieht Node nur URI-kodiert in `savestate`.
- **`[js]` muss neu melden:** nach jeder Pad-Änderung Bank, `durMs`, 16 (eingerastete) Starts, `sel`, „Beats gültig“, z. B. `bankstate …` aus `sendPadMarks()`.
- **Waveform:** Cache-WAVs Median 39 MB, max. 106 MB. `decodeAudioData` kostet 85–230 MB RAM, nur zum Malen. Besser `GET /peaks/<id>` aus Node (Min/Max je 256 Samples, ≈ 76–207 KB), zuerst ohne Cache-Datei.
- **Pad-Anschlag:** fast fertig. Node `Max.outlet('padhit', i)` → Router-Rest → `[js] padhit` → `hit` → `trigger`. Neu nur Route + eine Zeile. Am Patch ändert sich nichts.
- **Neu in `[js]`:** Bank laden, Start setzen, Pads tauschen, ein Pad würfeln ohne Nachbargrenze (`reroll` hält Chronologie).
- **Neu in Node:** `editor.html`-Route, `POST /cmd` mit Antwort, Editor-Zustand im SSE, `/peaks`, Bibliotheksdatei.
- **Favoriten:** in `sessions/<nr>.json` → `state.favs[64]`, pro Device. Frei werden `main.js:649-781` + Locks, `favinfo`/`ui.fav` in Node, Patch-Parameter `Fav *`, `Lock`, `Shuffle`, `Reroll`, `Nudge *` (→ 2.0). `Fav Select` + Prev/Next ist schon der künftige Bank-Regler (lädt nach 350 ms Ruhe).
- **Offen:** Gehört das bestätigte Quelltempo (`srcBpm`/`srcAuto`) in die Bank? Heute steckt es im Favoriten.
