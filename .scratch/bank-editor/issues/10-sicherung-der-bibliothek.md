# Sicherung der Bibliothek

Type: grilling
Status: open

## Question

Die Bibliothek ist kuratierte Arbeit. Die Cache-WAV ist unter Umständen die einzige Kopie eines Tracks (siehe [Bank auf der Bühne robust laden](05-bank-auf-der-buehne-robust.md)). Wie wird beides gesichert?

Mögliche Wege:
- Gar nicht, Time Machine reicht.
- Automatische Backup-Kopien der Bibliotheksdatei, z. B. die letzten N Stände.
- Die Bibliothek liegt in einem Git-Repo oder in der Cloud (iCloud Drive).
- Ein Export, der Bänke samt WAVs bündelt, z. B. für einen zweiten Rechner auf der Bühne.

Wie viel Aufwand ist dem Nutzer das wert? Deckt eine Time-Machine-Sicherung `~/Music/YTSampler/` schon ab? Das kannst du selbst prüfen (`tmutil`), ohne etwas zu ändern.
