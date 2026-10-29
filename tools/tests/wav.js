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

// Weitere Testsignale für Tempo- und Tonart-Konfidenz (fester Zufall, also jedes Mal gleich)
function rng(seed) { let x = seed; return () => { x = (x * 16807) % 2147483647; return x / 2147483647; }; }
const toS = (v) => { const s = Math.max(-32767, Math.min(32767, Math.round(v * 20000))); return [s, s]; };
const kickAt = (d) => (d >= 0 && d < 0.25 ? Math.sin(2 * Math.PI * (45 * d + 3.75 * (1 - Math.exp(-d * 20)))) * Math.exp(-d * 12) : 0);
const AM = [220, 261.63, 329.63], FD = [174.6, 220, 261.63], GD = [196, 246.9, 293.7], EM = [164.8, 207.6, 246.9];
const SIGNALS = {
  // Four-on-the-floor, Snare auf 2 und 4, Hi-Hat mit Swing kurz nach der Achtel, Bass, Akkordwechsel alle 2 Takte
  swing: (sec, bpm = 124) => { const r = rng(7), P = 60 / bpm, ch = [AM, FD, GD, EM]; return [sec, (t) => {
    const k = Math.floor(t / P), d = t - k * P, c = ch[Math.floor(k / 8) % 4];
    let v = 0.5 * kickAt(d) + 0.15 * Math.sin(2 * Math.PI * c[0] / 2 * t);
    for (const hz of c) v += 0.08 * Math.sin(2 * Math.PI * hz * t) + 0.03 * Math.sin(4 * Math.PI * hz * t);
    if (k % 2 === 1 && d < 0.12) v += (r() * 2 - 1) * 0.25 * Math.exp(-d * 30);
    const o = d - 0.62 * P; if (o >= 0 && o < 0.04) v += (r() * 2 - 1) * 0.2 * Math.exp(-o * 100);
    return toS(v); }]; },
  // Flächen: Akkorde alle 5,3 s mit langer Überblendung, leichtes Tremolo, kein Puls
  pad: (sec) => [sec, (t) => { const ch = [AM, FD, GD], seg = t / 5.3, i = Math.floor(seg), x = Math.min(1, (seg - i) * 3);
    let v = 0; for (const hz of ch[i % 3]) v += 0.1 * x * Math.sin(2 * Math.PI * hz * t);
    for (const hz of ch[(i + 2) % 3]) v += 0.1 * (1 - x) * Math.sin(2 * Math.PI * hz * t);
    return toS(v * (1 + 0.2 * Math.sin(2 * Math.PI * 0.13 * t))); }],
  noise: (sec) => { const r = rng(3); return [sec, () => toS((r() * 2 - 1) * 0.5)]; },
  // unregelmäßige Einsätze (~3/s, wie Gerede oder Geklapper)
  random: (sec) => { const r = rng(5), on = [0]; while (on[on.length - 1] < sec) on.push(on[on.length - 1] - Math.log(r()) / 3);
    let j = 0; return [sec, (t) => { while (j + 1 < on.length && on[j + 1] <= t) j++; const d = t - on[j];
      return toS((d < 0.15 ? 0.6 * Math.sin(2 * Math.PI * 300 * d) * Math.exp(-d * 25) : 0) + 0.05 * Math.sin(2 * Math.PI * 220 * t)); }]; },
  // dichter Mix: lautes Rauschen und Akkorde, Kick leiser darunter (spektrale Flatness wie echte Musik ~0,6)
  busy: (sec, bpm = 126) => { const r = rng(11), P = 60 / bpm; return [sec, (t) => { const d = t % P;
    let v = 0.3 * kickAt(d) + (r() * 2 - 1) * 0.12; for (const hz of [196, 246.9, 293.7, 392]) v += 0.08 * Math.sin(2 * Math.PI * hz * t + Math.sin(t));
    return toS(v); }]; },
  // nur Schlagzeug, 120 BPM: Kick, Snare, Hi-Hat, nichts Tonales. Laute Kick (Tonhöhe!) wirkt für die Tonart tonal.
  drums: (sec, kick = 0.6) => { const r = rng(13); return [sec, (t) => { const k = Math.floor(t / 0.5), d = t - k * 0.5, o = d - 0.25;
    let v = kick * kickAt(d); if (o >= 0 && o < 0.04) v += (r() * 2 - 1) * 0.2 * Math.exp(-o * 100);
    if (k % 2 && d < 0.12) v += (r() * 2 - 1) * 0.3 * Math.exp(-d * 30);
    return toS(v); }]; },
};
function signalWav(file, name, sec, ...args) {
  const [s, fn] = SIGNALS[name](sec, ...args);
  writeWav(file, Math.round(s * SR), (f) => fn(f / SR));
}

module.exports = { SR, writeWav, rampWav, rampFrame, beatWav, signalWav };
