# Device ohne Bank, alte Sets

Type: grilling
Status: resolved

## Question

Ohne Teletext und ohne „keine Bank“ kann das Device nur noch Bänke spielen. Was tut es, wenn es keine Bank kennt: neues Device, Set aus 1.x oder mit Teletext gespeichert (Session ohne `bankId` bzw. `bankId 0`), gespeicherte Bank inzwischen gelöscht? Was wird aus der Session-Datei?

## Answer

F3 vom Nutzer, Rest festgelegt in der Planung.

**Regel (F3, Nutzer 2026-10-29):** Kennt das Device keine Bank, lädt es die Bank, auf der der Regler `Bank` steht.
- Neues Device: `Bank` steht auf 1 → Bank 1.
- Set aus 1.x oder ein Teletext-Set: `Bank` hat seinen gespeicherten Wert bzw. den Startwert 1.
- Gespeicherte Bank gelöscht (`bankgone`): die Bank, die jetzt auf diesem Platz liegt (wie der Nachrücker beim Löschen im Editor). Liegt der Platz hinter der letzten Bank, die letzte Bank.
- Bibliothek leer, kaputt oder neuer: stumm, Anzeige wie in 2.0 (Spec 2.0, 4.5).
- Nicht ladbar (`bankfail`, keine Snippets und kein Track): stumm, „nicht ladbar“. Es gibt keine alte Bank, die weiterspielen könnte.

**Technik (festgelegt):** `[js]` liest den Regler mit `getvalueof()` und schickt die neue Nachricht `bankload <nr>`. Das ist `banksel` mit Klammer auf die letzte Bank. `banksel` selbst bleibt ohne Klammer, damit beim Drehen über die letzte Bank weiter nichts lädt.

**Session-Datei:** Format `version: 2` bleibt. `state` enthält nur noch `{"bankId": n}`. Die Kopie (`id`, `title`, `pads`, `srcBpm`, `srcAuto`, `bpmConf`) wird nicht mehr geschrieben, alte Felder werden beim Lesen ignoriert. Weil eine 2.x-Version mit fehlenden Feldern ohnehin „keine Bank“ zeigt, braucht es keinen Versionssprung und keine Migration. Die einmalige Kopie `<nr>.v1.json` für 1.x-Sessions bleibt, wie sie ist.

**Parameter alter Sets:** Werte für weggefallene Parameter (Ticket 02) ignoriert Live beim Öffnen. Ihre MIDI-Mappings gehen verloren.

**Warum nicht stumm, bis man dreht:** Auf der Bühne soll ein Set nach dem Öffnen sofort spielen. Der Regler hat immer einen Wert, also gibt es immer ein sinnvolles Ziel.
