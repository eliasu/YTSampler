// Snippets (Spec 2.3, 2.5): node tools/tests/test_snippets.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { tempHome, loadNode, t, run, sleep } = require('./harness');
const { SR, rampWav, rampFrame } = require('./wav');

const V = 'VVVVVVVVVVV';
const DUR = 40000;                 // Track 40 s
const SLOT = 16000 * SR / 1000 * 4;
// Pad 16 startet 5 s vor dem Ende -> kürzeres Snippet
const STARTS = [0, 1000, 2500, 3333, 5000, 7000, 9000, 11000, 13000, 15000, 17000, 19000, 21000, 23000, 30000, DUR - 5000];

function setup() {
  const home = tempHome(false);
  const { node, max } = loadNode(home);
  rampWav(path.join(node.CACHE, `${V}.wav`), DUR / 1000);
  const { id } = node.libChange('create', { video: V, title: 'Rampe', starts: STARTS }, 'test');
  const bank = () => node.libNow.lib.banks.find((b) => b.id === id);
  const done = () => fs.rmSync(home, { recursive: true, force: true });
  return { node, max, id, bank, done, home };
}
const snipBuf = (node, id) => fs.readFileSync(path.join(node.SNIP_DIR, `${id}.wav`));
// erster Frame von Fach i -> Quell-Frame
const slotFrame = (buf, i, k = 0) => rampFrame(buf, 44 + i * SLOT + k * 4);

t('Schneiden aus der ganzen WAV: Inhalt pro Fach, .json mit lens und dur', () => {
  const { node, id, bank, done } = setup();
  node.cutSnippets(bank());
  const buf = snipBuf(node, id);
  assert.strictEqual(buf.length, 44 + 16 * SLOT);
  assert.strictEqual(buf.toString('ascii', 0, 4), 'RIFF');
  assert.strictEqual(buf.readUInt32LE(24), 44100);
  assert.strictEqual(buf.readUInt16LE(22), 2);
  for (let i = 0; i < 16; i++) {
    assert.strictEqual(slotFrame(buf, i), Math.round(STARTS[i] * SR / 1000), `Fach ${i}`);
    assert.strictEqual(slotFrame(buf, i, 1000), Math.round(STARTS[i] * SR / 1000) + 1000, `Fach ${i} +1000`);
  }
  const j = JSON.parse(fs.readFileSync(path.join(node.SNIP_DIR, `${id}.json`), 'utf8'));
  assert.deepStrictEqual(j, { video: V, starts: STARTS, lens: STARTS.map((s) => Math.min(16000, DUR - s)), dur: DUR });
  assert.ok(node.snipCurrent(bank()));
  assert.deepStrictEqual(node.snipStatus(bank()), { snip: 'ok', wav: true });
  assert.ok(!fs.readdirSync(node.SNIP_DIR).some((n) => n.endsWith('.tmp')));
  done();
});

t('kürzeres letztes Snippet: nach dem Track-Ende Stille', () => {
  const { node, id, bank, done } = setup();
  node.cutSnippets(bank());
  const buf = snipBuf(node, id);
  const end = 44 + 15 * SLOT + 5000 * SR / 1000 * 4;   // 5 s ins Fach 16
  assert.strictEqual(rampFrame(buf, end - 4), Math.round((DUR - 5000) * SR / 1000) + 5000 * SR / 1000 - 1);
  assert.ok(buf.subarray(end, 44 + 16 * SLOT).every((b) => b === 0));
  done();
});

t('.chroma wird beim Schneiden nach D/snippets kopiert, unverändert und nur wenn sie fehlt', () => {
  const { node, bank, done } = setup();
  const d = path.join(node.SNIP_DIR, `${V}.chroma`);
  node.cutSnippets(bank());
  assert.ok(fs.existsSync(d));
  assert.ok(fs.readFileSync(d).equals(fs.readFileSync(path.join(node.CACHE, `${V}.chroma`))));
  const t0 = fs.statSync(d).mtimeMs;
  node.libChange('setstart', { id: bank().id, pad: 0, ms: 100 }, 'test');
  node.cutSnippets(bank());
  assert.strictEqual(fs.statSync(d).mtimeMs, t0);
  done();
});

t('swap ohne WAV: Fächer aus der alten Datei, Undo des Tauschs auch', () => {
  const { node, id, bank, done } = setup();
  node.cutSnippets(bank());
  fs.unlinkSync(path.join(node.CACHE, `${V}.wav`));
  node.libChange('swap', { id, a: 0, b: 15 }, 'test');
  assert.deepStrictEqual(node.snipStatus(bank()), { snip: 'stale', wav: false });
  node.cutSnippets(bank());
  let buf = snipBuf(node, id);
  assert.strictEqual(slotFrame(buf, 0), Math.round(STARTS[15] * SR / 1000));
  assert.strictEqual(slotFrame(buf, 15), 0);
  assert.ok(buf.subarray(44 + 5000 * SR / 1000 * 4, 44 + SLOT).every((b) => b === 0), 'Stille wandert mit');
  const j = JSON.parse(fs.readFileSync(path.join(node.SNIP_DIR, `${id}.json`), 'utf8'));
  assert.deepStrictEqual([j.lens[0], j.lens[15], j.dur], [5000, 16000, DUR]);
  node.libChange('swap', { id, a: 0, b: 15 }, 'test');
  node.cutSnippets(bank());
  buf = snipBuf(node, id);
  for (let i = 0; i < 16; i++) assert.strictEqual(slotFrame(buf, i), Math.round(STARTS[i] * SR / 1000));
  done();
});

t('duplicate ohne WAV: Snippet-Dateien kopiert, Kopie aktuell', () => {
  const { node, id, done } = setup();
  node.cutSnippets(node.libNow.lib.banks[0]);
  fs.unlinkSync(path.join(node.CACHE, `${V}.wav`));
  const { id: id2 } = node.libChange('duplicate', { id }, 'test');
  assert.ok(node.snipCopy(id, id2));
  const copy = node.libNow.lib.banks.find((b) => b.id === id2);
  assert.ok(node.snipCurrent(copy));
  assert.ok(snipBuf(node, id2).equals(snipBuf(node, id)));
  done();
});

t('Start setzen ohne WAV: playonly, snipEnsure spielt die alte Datei weiter', () => {
  const { node, id, bank, done } = setup();
  node.cutSnippets(bank());
  fs.unlinkSync(path.join(node.CACHE, `${V}.wav`));
  node.libChange('setstart', { id, pad: 3, ms: 3400 }, 'test');
  assert.throws(() => node.cutSnippets(bank()), (e) => e.code === 'playonly' && e.text === 'Track fehlt – nur spielbar');
  assert.throws(() => node.rollStart(V, STARTS), (e) => e.code === 'playonly');
  const r = node.snipEnsure(bank());
  assert.deepStrictEqual(r.starts, STARTS);
  assert.ok(r.path.endsWith(`snippets/${id}.wav`));
  done();
});

t('ohne Snippets und ohne WAV: nosnip; mit WAV schneidet snipEnsure sofort', () => {
  const { node, id, bank, done } = setup();
  assert.deepStrictEqual(node.snipStatus(bank()), { snip: 'stale', wav: true });   // Entprell-Timer läuft
  const r = node.snipEnsure(bank());
  assert.deepStrictEqual([r.dur, r.lens[15], r.video], [DUR, 5000, V]);
  fs.unlinkSync(path.join(node.CACHE, `${V}.wav`));
  for (const n of [`${id}.wav`, `${id}.json`]) fs.unlinkSync(path.join(node.SNIP_DIR, n));
  assert.deepStrictEqual(node.snipStatus(bank()), { snip: 'missing', wav: false });
  assert.throws(() => node.snipEnsure(bank()), (e) => e.code === 'nosnip');
  done();
});

t('Entprellen: mehrere Änderungen -> einmal geschnitten, 500 ms nach der letzten', async () => {
  const { node, id, bank, done } = setup();
  const cuts = [];
  node.libEvents.on('job', (j) => { if (j.kind === 'cut' && j.phase === 'done') cuts.push(Date.now()); });
  await sleep(100);
  const t0 = Date.now();
  node.libChange('setstart', { id, pad: 1, ms: 1100 }, 'c');
  await sleep(300);
  node.libChange('setstart', { id, pad: 2, ms: 2600 }, 'c');
  const t1 = Date.now();
  await sleep(300);
  assert.strictEqual(cuts.length, 0);
  assert.strictEqual(node.snipStatus(bank()).snip, 'stale');
  await sleep(1500);   // erster Schnitt rechnet auch die Analyse
  assert.strictEqual(cuts.length, 1);
  assert.ok(cuts[0] - t1 >= 490 && cuts[0] - t0 > 700, `geschnitten nach ${cuts[0] - t1} ms`);
  assert.ok(node.snipCurrent(bank()));
  done();
});

t('Änderung von außen schneidet nicht', async () => {
  const { node, bank, done } = setup();
  node.cutSnippets(bank());
  const lib = JSON.parse(fs.readFileSync(node.LIB_FILE, 'utf8'));
  lib.banks[0].starts[0] = 50; lib.rev++;
  fs.writeFileSync(node.LIB_FILE, JSON.stringify(lib));
  await sleep(1300);
  assert.strictEqual(node.libNow.lib.rev, lib.rev);
  assert.ok(!node.snipCurrent(bank()));
  done();
});

t('Aufräumen: nur Ziffern-Namen gelöschter Bänke, älter als 7 Tage', () => {
  const { node, id, bank, done } = setup();
  node.cutSnippets(bank());
  const D = node.SNIP_DIR, old = (Date.now() - 8 * 86400000) / 1000;
  for (const n of ['99.wav', '99.json', '98.wav', 'x99.wav', '12345678901.chroma']) fs.writeFileSync(path.join(D, n), '');
  for (const n of ['99.wav', '99.json', 'x99.wav', '12345678901.chroma', `${id}.wav`, `${id}.json`]) fs.utimesSync(path.join(D, n), old, old);
  node.snipCleanup();
  const left = fs.readdirSync(D).sort();
  assert.deepStrictEqual(left, ['12345678901.chroma', `${id}.json`, `${id}.wav`, '98.wav', `${V}.chroma`, 'x99.wav'].sort());
  done();
});

t('Aufräumen nie bei kaputter Bibliothek', () => {
  const { node, done } = setup();
  fs.writeFileSync(path.join(node.SNIP_DIR, '99.wav'), '');
  const old = (Date.now() - 8 * 86400000) / 1000;
  fs.utimesSync(path.join(node.SNIP_DIR, '99.wav'), old, old);
  fs.writeFileSync(node.LIB_FILE, '{kaputt');
  const { node: n2 } = loadNode(process.env.HOME);
  assert.strictEqual(n2.libNow.state, 'kaputt');
  assert.ok(fs.existsSync(path.join(node.SNIP_DIR, '99.wav')));
  done();
});

t('Cache-Größe: Summe aller Dateien, Warnung ab 10 GB', () => {
  const { node, done } = setup();
  fs.writeFileSync(path.join(node.CACHE, 'x.json'), '12345');
  assert.deepStrictEqual(node.cacheSize(), { bytes: 44 + DUR * SR / 1000 * 4 + 5, warn: false });
  done();
});

run();
