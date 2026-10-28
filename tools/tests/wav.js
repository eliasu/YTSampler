// Erzeugte WAVs für die Tests: 44,1 kHz, 16 Bit, Stereo
const fs = require('fs');
const path = require('path');

const SR = 44100;

// sample(f) -> [links, rechts] als Int16
function writeWav(file, frames, sample) {
  const buf = Buffer.alloc(44 + frames * 4);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + frames * 4, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(frames * 4, 40);
  for (let f = 0; f < frames; f++) {
    const [l, r] = sample(f);
    buf.writeInt16LE(l, 44 + f * 4); buf.writeInt16LE(r, 46 + f * 4);
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, buf);
}

// Rampe: aus jedem Frame lässt sich seine Position ablesen (links Bits 0–14, rechts Bits 15+)
const rampWav = (file, sec) => writeWav(file, Math.round(sec * SR), (f) => [f & 0x7fff, f >> 15]);
const rampFrame = (buf, byte) => buf.readInt16LE(byte) + buf.readInt16LE(byte + 2) * 32768;

// Musik mit bekanntem Tempo: Kick (120 → 45 Hz) auf jeder „1“, hoher Klick (2 kHz) auf jedem Schlag, leiser a-Moll-Akkord.
// silence: [von, bis] in s ohne alles. Schlag k liegt bei k × 60/bpm s, die „1“ bei k = 0, 4, 8, …
function beatWav(file, sec, bpm, silence) {
  const beat = Math.round(SR * 60 / bpm);
  const chord = [220, 261.63, 329.63];
  writeWav(file, Math.round(sec * SR), (f) => {
    const t = f / SR;
    if (silence && t >= silence[0] && t < silence[1]) return [0, 0];
    const k = Math.floor(f / beat), d = (f - k * beat) / SR;
    let v = 0;
    for (const hz of chord) v += 0.06 * Math.sin(2 * Math.PI * hz * t);
    if (d < 0.03) v += 0.15 * Math.sin(2 * Math.PI * 2000 * d) * Math.exp(-d * 150);
    if (k % 4 === 0 && d < 0.25) v += Math.sin(2 * Math.PI * (45 * d + 3.75 * (1 - Math.exp(-d * 20)))) * Math.exp(-d * 12);   // 120 → 45 Hz
    const s = Math.max(-32767, Math.min(32767, Math.round(v * 20000)));
    return [s, s];
  });
}

module.exports = { SR, writeWav, rampWav, rampFrame, beatWav };
