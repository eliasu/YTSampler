// IR-Fernbedienung → Teletext-Seite
// Pro Micro als USB-MIDI: reicht jeden IR-Code roh als Note auf Kanal 15 weiter.
// Welche Taste was macht, lernt das Device (Teletext: Cmd+Shift+M), gespeichert
// in ~/Music/YTSampler/ir.json. Dieser Sketch muss dafür nie geändert werden.
//   Note     = Command & 127
//   Velocity = 1 + Bit 7 des Commands + 2 bei Wiederholung (Taste gehalten)
// Serieller Monitor (115200) zeigt jedes Signal, alle 5 s ohne Signal "wartet auf IR …".

#include <IRremote.hpp>
#include <MIDIUSB.h>

const uint8_t IR_PIN = 7;   // Datenpin des IR-Empfängers
const uint8_t CH = 14;      // Kanal 15 (0-basiert)

void send(uint8_t note, uint8_t vel) {
  midiEventPacket_t on  = { 0x09, (uint8_t)(0x90 | CH), note, vel };
  midiEventPacket_t off = { 0x08, (uint8_t)(0x80 | CH), note, 0 };
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
  if (d.protocol != UNKNOWN) {               // unbekannt = meist Störung
    // ponytail: nur Command, keine Address – fremde Fernbedienungen mit gleichem Command lösen auch aus
    uint8_t cmd = d.command;
    bool rep = d.flags & IRDATA_FLAGS_IS_REPEAT;
    send(cmd & 0x7F, 1 + (cmd >> 7) + (rep ? 2 : 0));
  }
  IrReceiver.resume();
}
