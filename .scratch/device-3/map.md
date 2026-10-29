# Device 3.0: nur noch kuratiert

## Destination

Eine Spezifikation (`.scratch/device-3/spec.md`) für 3.0.0. Kuratiert wird nur noch im Editor, das Device ist das Bühneninstrument: Bank wählen und spielen, dazu wenige Helfer, damit es immer passt (Tune, Warp, Quant). Teletext, IR, Schreibmaschine und das Spielen ohne Bank fallen weg. Der Editor spiegelt die Bühnenregler des Device. Die Spec ist so vollständig, dass Arbeitssessions sie ohne Rückfragen umsetzen können.

## Notes

- Vorbild und Vorgänger: `.scratch/bank-editor/` (Spec 2.0). Was hier nicht geändert wird, gilt dort weiter.
- Leitlinie: Bühnenwerkzeug, einfach halten. Viele Spieler sind nicht musikalisch, darum Helfer statt Regler.
- Gebaut wird in eigenen Worktree-Sessions. Gemergt, deployt und released wird nur in der Master-Session.

## Decisions so far

- [Nur noch kuratiert](issues/01-nur-noch-kuratiert.md): Teletext, IR, Schreibmaschine, Laden ohne Bank, Würfeln und Einrasten im Device fallen weg, beschrieben im Archiv `.scratch/archiv/teletext-ir-schreibmaschine.md`. Alle MIDI-Kanäle spielen Pads.
- [Device-Regler 3.0](issues/02-device-regler.md): Grid geht in Warp auf, Snap fällt weg, Source BPM/÷2/×2 nur noch im Editor, Tonal/Attack/Release als feste Werte. 8 Parameternamen fallen weg. Breite bleibt 1024, größere Bühnenschalter.
- [Editor spiegelt die Device-Regler](issues/03-editor-spiegelt-regler.md): ein Zustand (die echten Live-Parameter), beidseitig. alle Regler außer der Bankwahl (auch Volume, Voices, Base Note). `bankstate` trägt die Werte, `/cmd param` stellt sie über `setNamed`.
- [Device ohne Bank, alte Sets](issues/04-ohne-bank-und-alte-sets.md): Ohne bekannte Bank lädt das Device die Bank, auf der der Regler `Bank` steht. Die Session speichert nur noch `bankId`.

## Not yet specified

Nichts. Die Antworten des Nutzers auf F1–F5 (2026-10-29) sind in den Tickets eingetragen, `spec.md` ist geschrieben.

## Out of scope

- Steuern eines anderen Device als des ersten (Port 8765) im Editor: bleibt wie in 2.0.
- Die Bankwahl über die Device-Regler `Bank`, ◀ ▶ im Editor spiegeln: Der Editor wählt Bänke wie bisher über die Liste (`select`).
- Ein neues Hardware-Feature als Ersatz für IR oder Schreibmaschine.
- Snap oder Grid als eigener Schalter.
