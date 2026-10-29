# Nur noch kuratiert

Type: grilling
Status: resolved

## Question

Was bleibt vom Device, wenn nur noch im Editor kuratiert wird? Was passiert mit Teletext, IR-Fernbedienung, Schreibmaschine und dem Spielen ohne Bank, und was mit den MIDI-Kanälen 15 und 16?

## Answer

Entschieden vom Nutzer (Auftrag an die Planung, 2026-10-29), dazu F4.

**Hintergrund:** Das Device ist wie eine alte MPC, nur mit YouTube-Videos. Kuratiert wird (Videos suchen, Bänke bauen, Slices setzen, Tempo korrigieren) nur noch im Editor. Auf der Bühne wählt man eine Bank und spielt.

**Fällt weg**
- Teletext-Seite: `teletext.html`, `Teletext öffnen.command`, HTTP `/`, `/events`, `/key`, `/state`, die Spiegelung `D/web/teletext.html`, `device.teletext` im Editor.
- IR-Fernbedienung: `ir_teletext/`, `ir.json`, Merkmodus, Dedup, `IR_CHANNEL`.
- Schreibmaschine: Kanal 16, `key`, `handleKey`, `TAP`.
- Spielen ohne Bank: Video direkt laden (`load`, `loaded`, `loadfail`), Würfeln im Device (`randomStart`, `rollAll`, `autoRoll`, `sortPads`), `silence` an `[js]`, Einrasten der Starts (Snap).
- Toter Code, der dabei auffällt: der Node-Handler `analyze` (das Device schickt nur `analyzeall`).

**Bleibt**
- Würfeln im Editor (`roll`, `newbank` in Node) mit Stille, Takten und „1“.
- Download in den Cache, nur noch auf dem Editor-Weg.

**Archiv:** `.scratch/archiv/teletext-ir-schreibmaschine.md` beschreibt Aufbau, Protokolle und den letzten Tag mit dem Code (v2.x).

**MIDI-Kanäle (F4, Nutzer 2026-10-29):** Alle Kanäle spielen Pads. Welcher Controller ankommt, regelt der MIDI-Eingang der Spur in Live. Kanal 15 und 16 haben keine Sonderrolle mehr.

**Daten, die liegen bleiben:** `D/ir.json`, `D/web/teletext.html` und `L/chrome-profile/` werden nicht gelöscht (nichts wird automatisch gelöscht). Das README sagt, dass man sie von Hand löschen kann.
