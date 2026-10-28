# Sicherung der Bibliothek

Type: grilling
Status: resolved

## Question

Die Bibliothek ist kuratierte Arbeit. Die Cache-WAV ist unter Umständen die einzige Kopie eines Tracks (siehe [Bank auf der Bühne robust laden](05-bank-auf-der-buehne-robust.md)). Wie wird beides gesichert?

Mögliche Wege:
- Gar nicht, Time Machine reicht.
- Automatische Backup-Kopien der Bibliotheksdatei, z. B. die letzten N Stände.
- Die Bibliothek liegt in einem Git-Repo oder in der Cloud (iCloud Drive).
- Ein Export, der Bänke samt WAVs bündelt, z. B. für einen zweiten Rechner auf der Bühne.

Wie viel Aufwand ist dem Nutzer das wert? Deckt eine Time-Machine-Sicherung `~/Music/YTSampler/` schon ab? Das kannst du selbst prüfen (`tmutil`), ohne etwas zu ändern.

## Answer

Geklärt am 2026-10-28 in drei Runden mit dem Nutzer.

**Kernaussage:** Der ganze Ordner `YTSampler` liegt in iCloud Drive, samt WAVs, und bleibt mit „Geladen lassen“ auf dem Mac. Dazu hält das Device die letzten 10 Stände der Bibliotheksdatei vor. Mehr gibt es nicht: keinen Export, keinen Knopf zum Zurückholen.

**Stand heute (geprüft, nichts geändert)**
- Time Machine ist nicht eingerichtet (`tmutil destinationinfo`: „No destinations configured“). `~/Music/YTSampler/` ist zwar nicht ausgeschlossen, gesichert wird aber nichts.
- iCloud Drive ist an, mit „Mac-Speicher optimieren“ (`com.apple.bird optimize-storage = 1`). `~/Music` liegt nicht in iCloud.
- Inhalt von `~/Music/YTSampler/`: `cache/` mit 2,3 GB, `chrome-profile/` mit 216 MB, `sessions/`, `ir.json`, `web/`. Sonst gibt es keine Sicherung.

**Entscheidungen**
1. **Ort:** Alles, was heute unter `~/Music/YTSampler/` liegt, kommt nach `iCloud Drive/YTSampler/` (`~/Library/Mobile Documents/com~apple~CloudDocs/YTSampler/`). Das umfasst Bibliotheksdatei, Cache mit WAVs, Sessions, `ir.json` und `web/`. Die WAVs sind damit mitgesichert, auch die, die es bei YouTube nicht mehr gibt.
2. **Ausnahme:** `chrome-profile/` bleibt lokal unter `~/Music/YTSampler/`. Das sind Browser-Interna, die man nicht sichern muss und die sich mit dem Sync nicht vertragen.
3. **Offline auf der Bühne:** Der Nutzer stellt den Ordner im Finder einmal auf „Geladen lassen“. So lagert „Speicher optimieren“ keine WAVs aus. Das Device prüft das nicht.
4. **Ein Rechner schreibt:** Es arbeiten nie mehrere Rechner gleichzeitig an der Bibliothek. Konflikt-Kopien von iCloud werden nicht behandelt.
5. **10 Stände der Bibliotheksdatei:** Bei jedem Laden des Devices wird eine Kopie angelegt, im selben iCloud-Ordner. Die letzten 10 bleiben. Es gibt keinen Knopf und keine Anzeige.
6. **Zurückholen:** von Hand im Finder. Der Nutzer legt eine Kopie über die Bibliotheksdatei und lädt das Device neu.
7. **Kein eigener Export:** Für einen zweiten Rechner reicht es, sich mit derselben Apple-ID anzumelden oder den Ordner zu kopieren.
8. **Keine Time Machine:** Für dieses Projekt wird keine eingerichtet, iCloud übernimmt die Sicherung.

**Folgen für die Umsetzung** (technisch, nicht mit dem Nutzer besprochen)
- Node bekommt einen Basisordner `iCloud Drive/YTSampler/` statt `~/Music/YTSampler/`. Gibt es kein iCloud Drive (der Ordner `com~apple~CloudDocs` fehlt), bleibt es bei `~/Music/YTSampler/`.
- Umzug beim ersten Start von 2.0: Gibt es den alten Ordner und noch keinen neuen, verschiebt Node ihn einmal (ohne `chrome-profile/`). Beides liegt auf demselben Volume, also reicht ein `rename`, Kopieren ist nicht nötig. `Teletext öffnen.command` und das Chrome-Profil behalten ihren Pfad.
- Eine Kopie wird nur angelegt, wenn die Bibliotheksdatei gelesen werden konnte und sich seit der letzten Kopie geändert hat. Name mit Datum und Uhrzeit, z. B. `backup/bibliothek-2026-10-28-1930.json`. Damit verdrängt eine kaputte Datei nie die guten Stände.
- Eine Datei, die iCloud noch nicht geladen hat, gilt wie eine unlesbare Datei aus [Bank auf der Bühne robust laden](05-bank-auf-der-buehne-robust.md): Sie wird nie überschrieben, das Speichern bleibt gesperrt.
- Die Bibliothek darf keine absoluten Pfade enthalten (relevant für [Format der Bibliotheksdatei](09-format-der-bibliotheksdatei.md)), damit Kopieren und ein zweiter Rechner funktionieren.
- Gelöscht wird im Cache weiter nichts automatisch (Ticket 05). Der iCloud-Speicher wächst mit jedem neuen Video, heute um etwa 2,3 GB.
