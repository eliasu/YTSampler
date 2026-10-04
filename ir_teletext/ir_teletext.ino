// IR-Fernbedienung → Teletext-Seite
// Pro Micro als USB-MIDI: schickt Noten auf Kanal 16 wie die Schreibmaschine
// (Notennummer = Zeichencode, siehe MIDI_KEYS in ytsampler_node.js).
// Lernen: Serieller Monitor (115200) zeigt jedes empfangene Signal
// (Protokoll, Address, Command) → Command unten in KEYS eintragen.
// Alle 5 s ohne Signal: "wartet auf IR …" (zeigt, dass er läuft).

#include <IRremote.hpp>
#include <MIDIUSB.h>

const uint8_t IR_PIN = 7;   // Datenpin des IR-Empfängers
const uint8_t CH = 15;      // Kanal 16 (0-basiert)

// Tasten-Codes → Zeichen. Codes per Lernmodus ermitteln.
struct Key { uint8_t cmd; uint8_t code; bool repeat; };
const Key KEYS[] = {
  { 0x18, 17,  true  },  // hoch
  { 0x52, 18,  true  },  // runter
  { 0x08, 19,  true  },  // links  → Seite zurück
  { 0x5A, 20,  true  },  // rechts → Seite vor
  { 0x1C, 13,  false },  // OK     → Enter (suchen/laden)
  { 0x16, 27,  false },  // *      → Suchbegriff löschen
  { 0x0D, 8,   false },  // #      → Backspace
  { 0x19, '0', false },
  { 0x45, '1', false }, { 0x46, '2', false }, { 0x47, '3', false },
  { 0x44, '4', false }, { 0x40, '5', false }, { 0x43, '6', false },
  { 0x07, '7', false }, { 0x15, '8', false }, { 0x09, '9', false },
};

void send(uint8_t code) {
  midiEventPacket_t on  = { 0x09, (uint8_t)(0x90 | CH), code, 100 };
  midiEventPacket_t off = { 0x08, (uint8_t)(0x80 | CH), code, 0 };
  MidiUSB.sendMIDI(on);
  MidiUSB.sendMIDI(off);
  MidiUSB.flush();
}

void setup() {
  Serial.begin(115200);
  IrReceiver.begin(IR_PIN, DISABLE_LED_FEEDBACK);  // Pin 13 ist am Pro Micro nicht herausgeführt
}

unsigned long lastMsg = 0;

void loop() {
  if (!IrReceiver.decode()) {
    if (millis() - lastMsg >= 5000) { Serial.println(F("wartet auf IR …")); lastMsg = millis(); }
    return;
  }
  lastMsg = millis();
  IrReceiver.printIRResultShort(&Serial);   // jedes Signal, auch Wiederholungen und unbekannte
  IRData &d = IrReceiver.decodedIRData;
  bool rep = d.flags & IRDATA_FLAGS_IS_REPEAT;
  if (d.protocol != UNKNOWN) {
    for (const Key &k : KEYS) {
      if (k.cmd == d.command && (!rep || k.repeat)) {   // nur Pfeile wiederholen beim Halten
        send(k.code);
        Serial.print(F("  → MIDI-Note ")); Serial.println(k.code);
      }
    }
  }
  IrReceiver.resume();
}
