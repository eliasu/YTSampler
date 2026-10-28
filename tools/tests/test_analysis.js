// Analyse (Spec 2.4) und Würfeln (Spec 3.1): node tools/tests/test_analysis.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { tempHome, loadNode, t, run } = require('./harness');
const { SR, beatWav, writeWav } = require('./wav');

const V = 'BBBBBBBBBBB';
const SEC = 90, SIL = [20, 45];   // 120 BPM, Takt = 2 s, Stille 20–45 s
const LEAD = 12;                  // BEAT_LEAD_MS
let wavCopy = null;               // einmal erzeugen, dann kopieren

function setup() {
  const home = tempHome(false);
  const { node, max } = loadNode(home);
  const wav = path.join(node.CACHE, `${V}.wav`);
  if (!wavCopy) { beatWav(wav, SEC, 120, SIL); wavCopy = fs.readFileSync(wav); } else fs.writeFileSync(wav, wavCopy);
  return { node, max, wav, done: () => fs.rmSync(home, { recursive: true, force: true }) };
}
// Abstand zum nächsten Rasterpunkt (Beats liegen LEAD ms vor dem Einsatz)
const near = (t, grid) => { const r = ((t + LEAD) % grid + grid) % grid; return Math.min(r, grid - r); };
// Was das Device nach ensureAnalysis und beattrack bekommt
async function deviceOut(node, max, bank) {
  max.out.length = 0;
  await node.ensureAnalysis(V, 'Titel', bank);
  max.handlers.beattrack(120);
  return max.out.filter((m) => m[0] !== 'status');
}

t('Tempo, Beats und „1“ aus erzeugter WAV, Beats gültig', () => {
  const { node, done } = setup();
  const a = node.getAnalysis(V, false);
  assert.ok(Math.abs(a.bpm - 120) < 1, `bpm ${a.bpm}`);
  assert.ok(a.bpmConf >= 0.3, `conf ${a.bpmConf}`);
  const b = node.videoBeats(V);
  assert.strictEqual(b.ok, true);
  assert.strictEqual(b.confirmed, false);
  const audible = b.beats.filter((x) => x < SIL[0] * 1000 - 500 || x > SIL[1] * 1000 + 500);
  assert.ok(audible.every((x) => near(x, 500) < 25), 'Beats auf dem 500-ms-Raster');
  assert.ok(near(b.beats[b.down], 2000) < 25, `„1“ bei ${b.beats[b.down]} ms`);
  done();
});

t('Ergebnis aus dem Bank-Ordner gleich wie aus cache/, ohne ganze WAV', async () => {
  const { node, max, wav, done } = setup();
  const fromCache = await deviceOut(node, max, false);
  assert.deepStrictEqual(fromCache.map((m) => m[0]), ['tuning', 'tempo', 'silence', 'analysisready', 'beatsclear', 'beatsadd', 'beatsdone']);
  const { id } = node.libChange('create', { video: V, title: 'T', starts: Array.from({ length: 16 }, (_, i) => i * 1000) }, 't');
  node.cutSnippets(node.libNow.lib.banks.find((x) => x.id === id));
  fs.unlinkSync(wav);
  fs.unlinkSync(path.join(node.CACHE, `${V}.chroma`));
  const fromBank = await deviceOut(node, max, true);
  assert.deepStrictEqual(fromBank, fromCache);
  assert.strictEqual(node.analysis.id, V);
  done();
});

t('Analyse fehlt ohne WAV: Status, keine Analyse-Nachrichten', async () => {
  const { node, max, wav, done } = setup();
  fs.unlinkSync(wav);
  max.out.length = 0;
  await node.ensureAnalysis(V, 'Titel', true);
  assert.deepStrictEqual(max.out, [['status', 'Analyse fehlt – Bank im Editor neu schneiden']]);
  assert.strictEqual(node.analysis, null);
  done();
});

t('Analyse fehlt in D, WAV da: neu rechnen und ablegen', async () => {
  const { node, max, done } = setup();
  await node.ensureAnalysis(V, 'Titel', true);
  assert.ok(fs.existsSync(path.join(node.SNIP_DIR, `${V}.chroma`)));
  assert.ok(max.out.some((m) => m[0] === 'analysisready'));
  done();
});

// Version 3 von Hand gebaut (nicht mit saveAnalysis), damit eine Formatänderung den alten Leser nicht still mitnimmt
function v3File(file, version = 3, extra = 0) {
  const nf = 3, no = 5, S = 14;
  const head = [version, 5512.5, 0.125, nf, 99.5, 0.42, 86.1, no];
  const arr = Float32Array.from([...head, ...Array(no).fill(1), ...Array(no).fill(2), ...Array.from({ length: nf * S }, (_, i) => i), ...Array(extra).fill(7)]);
  fs.writeFileSync(file, Buffer.from(arr.buffer));
}

t('alte .chroma-Version 3 bleibt lesbar', () => {
  const { node, done } = setup();
  const f = path.join(node.SNIP_DIR, 'v3.chroma');
  v3File(f);
  const a = node.readAnalysis(f);
  assert.deepStrictEqual([a.srd, a.tuning, a.nf, a.bpm, a.bpmConf], [5512.5, 0.125, 3, 99.5, 0.42]);
  assert.ok(Math.abs(a.fps - 86.1) < 1e-4);
  assert.deepStrictEqual([...a.onset], [1, 1, 1, 1, 1]);
  assert.deepStrictEqual([...a.bass], [2, 2, 2, 2, 2]);
  assert.strictEqual(a.frames.length, 42);
  assert.strictEqual(a.frames[41], 41);
  done();
});

t('unbekannte Version oder falsche Länge = Analyse fehlt', () => {
  const { node, done } = setup();
  const f = path.join(node.SNIP_DIR, 'x.chroma');
  for (const [v, extra] of [[1, 0], [2, 0], [99, 0], [3, 1]]) {
    v3File(f, v, extra);
    assert.strictEqual(node.readAnalysis(f), null, `Version ${v} +${extra}`);
  }
  done();
});

t('neuere Analyse in D wird nie überschrieben', () => {
  const { node, done } = setup();
  const f = path.join(node.SNIP_DIR, `${V}.chroma`);
  v3File(f, node.AN.VERSION + 1);
  const before = fs.readFileSync(f);
  assert.ok(node.getAnalysis(V, true));
  assert.ok(fs.readFileSync(f).equals(before));
  done();
});

t('newbank-Würfeln: 16 Starts aufsteigend, ganz, verschieden, auf Taktanfängen, nie ganz in Stille', () => {
  const { node, done } = setup();
  for (let n = 0; n < 5; n++) {
    const s = node.rollBank(V);
    assert.strictEqual(s.length, 16);
    assert.deepStrictEqual(s, [...s].sort((x, y) => x - y));
    assert.strictEqual(new Set(s).size, 16);
    for (const x of s) {
      assert.ok(Number.isInteger(x) && x >= 0 && x <= (SEC - 16) * 1000, `Start ${x}`);
      assert.ok(near(x, 2000) < 30, `Start ${x} nicht auf Taktanfang`);
      assert.ok(!(x >= SIL[0] * 1000 && x + 16000 <= SIL[1] * 1000), `Start ${x} ganz in Stille`);
    }
  }
  done();
});

t('roll: ein Start, nicht schon belegt', () => {
  const { node, done } = setup();
  const taken = node.rollBank(V);
  for (let n = 0; n < 20; n++) assert.ok(!taken.includes(node.rollStart(V, taken)));
  done();
});

t('ohne gültige Beats frei würfeln, bestätigtes bpm macht Beats gültig', () => {
  const home = tempHome(false);
  const { node } = loadNode(home);
  const W = 'NNNNNNNNNNN';
  writeWav(path.join(node.CACHE, `${W}.wav`), 40 * SR, (f) => { const s = Math.round(6000 * Math.sin(2 * Math.PI * 220 * f / SR)); return [s, s]; });
  const b = node.videoBeats(W);
  assert.strictEqual(b.ok, false);
  const s = node.rollBank(W);
  assert.strictEqual(new Set(s).size, 16);
  assert.ok(s.every((x) => Number.isInteger(x) && x >= 0 && x <= 24000));
  assert.ok(s.some((x) => near(x, 2000) > 30), 'frei, nicht auf einem Raster');
  node.libChange('create', { video: W, title: 'Sinus', starts: s }, 't');
  node.libChange('tempo', { video: W, bpm: 120 }, 't');
  const c = node.videoBeats(W);
  assert.strictEqual(c.confirmed, true);
  assert.strictEqual(c.bpm, 120);
  assert.strictEqual(c.ok, c.beats.length >= 4);
  fs.rmSync(home, { recursive: true, force: true });
});

run();
