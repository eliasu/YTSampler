# Grundsatzentscheidungen zum Bank-Editor

Type: grilling
Status: resolved

## Question

Was ist eine Bank, wo lebt die Bibliothek, wie teilen sich Browser-Editor und Device die Arbeit?

## Answer

> **Teilweise überholt durch [Snippets statt ganzer WAV](11-snippets-statt-ganzer-wav.md):** Länge vom Device bleibt, aber höchstens 16 s (Snippet).

Geklärt beim Kartieren am 2026-10-28, drei Runden mit dem Nutzer.

**Hintergrund:** Zufällige Slices aus YouTube-Videos klingen oft schlecht. Darum kuratiert der Nutzer die Bänke selbst. Teletext bleibt im Device, wird aber nicht weiterentwickelt.

**Modell**
- Eine Bank besteht aus 16 Pads, alle aus genau einem Track. Die Bibliothek ist die geordnete Liste aller Bänke, ihre Länge ist beliebig.
- Eine Bank speichert nur Track und 16 Startpunkte. Die Slice-Länge (BPM/Division/Rate) kommt immer von den Device-Reglern. Es gibt kein Ende pro Pad und keine Länge pro Bank.
- Die Bibliothek liegt global unter `~/Music/YTSampler/`, gilt für alle Live-Sets und gehört nicht ins Set.
- Die Bibliothek ersetzt die Favoriten. Die alten Favoriten werden verworfen, nichts wird importiert. Das wird Version 2.0.0.

**Editor (Browser)**
- Er ist eine Fernbedienung für das Device in Live. Gehört wird über Live. Ohne laufendes Device zeigt er nur einen Hinweis.
- Bei mehreren YT-Samplern im Set bedient er nur das erste Device (Port 8765).
- Editor und Device zeigen immer dieselbe Bank. Wird im einen eine Bank gewählt, lädt sie auch im anderen.
- Eine neue Bank entsteht über die Suche im Editor. Sie kommt ans Ende der Bibliothek, das Device lädt sie sofort und würfelt automatisch.
- Jede Änderung wird sofort gespeichert, einen Speichern-Knopf gibt es nicht.
- Pads per Drag aufeinander ziehen tauscht die beiden.
- „Neues Snippet“ würfelt ein einzelnes Pad nach den bestehenden Regeln: Taktanfang bevorzugt, keine Stille, kein doppelter Start.
- Den Startpunkt setzt man, indem man den Marker auf der Waveform zieht. Er rastet auf Schläge ein, mit gedrückter Alt-Taste lässt er sich frei setzen.
- Eine Bank heißt anfangs wie ihr Video und lässt sich umbenennen. In der Liste lässt sie sich per Drag verschieben.
- Löschen geht per Knopf mit Rückfrage.

**Device (Live)**
- Im Device wird nur ausgewählt und gespielt. Suche, Würfeln, Locks und Favoriten fallen aus der Oberfläche.
- Die Bank wechselt man mit einem Regler über die ganze Bibliothek, dazu Vor/Zurück. Geladen wird, wenn der Regler ruht.
- Das Device zeigt Banknummer und Name sowie die Pad-Marken auf der Waveform.
