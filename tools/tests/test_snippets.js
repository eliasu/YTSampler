// Snippets (Spec 2.3, 2.5; Mix-Spec 2.2): node tools/tests/test_snippets.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { tempHome, loadNode, t, run, sleep } = require('./harness');
const { SR, rampWav, rampFrame } = require('./wav');

const V = 'VVVVVVVVVVV', W = 'WWWWWWWWWWW';
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
const PADS = (v, st) => st.map((start) => ({ video: v, start }));
const snipJ = (node, id) => JSON.parse(fs.readFileSync(path.join(node.SNIP_DIR, `${id}.json`), 'utf8'));
const silent = (buf, i) => buf.subarray(44 + i * SLOT, 44 + (i + 1) * SLOT).every((b) => b === 0);

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
  const j = snipJ(node, id);
  assert.deepStrictEqual(j, { pads: PADS(V, STARTS), lens: STARTS.map((s) => Math.min(16000, DUR - s)), durs: { [V]: DUR } });
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
  const j = snipJ(node, id);
  assert.deepStrictEqual([j.lens[0], j.lens[15], j.durs[V]], [5000, 16000, DUR]);
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
  assert.deepStrictEqual(r.pads, PADS(V, STARTS));
  assert.ok(r.path.endsWith(`snippets/${id}.wav`));
  done();
});

t('ohne Snippets und ohne WAV: nosnip; mit WAV schneidet snipEnsure sofort', () => {
  const { node, id, bank, done } = setup();
  assert.deepStrictEqual(node.snipStatus(bank()), { snip: 'stale', wav: true });   // Entprell-Timer läuft
  const r = node.snipEnsure(bank());
  assert.deepStrictEqual([r.durs[V], r.lens[15], r.pads[15].video], [DUR, 5000, V]);
  fs.unlinkSync(path.join(node.CACHE, `${V}.wav`));
  for (const n of [`${id}.wav`, `${id}.json`]) fs.unlinkSync(path.join(node.SNIP_DIR, n));
  assert.deepStrictEqual(node.snipStatus(bank()), { snip: 'missing', wav: false });
  assert.throws(() => node.snipEnsure(bank()), (e) => e.code === 'nosnip');
  done();
});

t('alte .json (video, starts, dur) gilt als aktuell: kein Neuschnitt, auch ohne WAV', () => {
  const { node, id, bank, done } = setup();
  node.cutSnippets(bank());
  const f = path.join(node.SNIP_DIR, `${id}.json`);
  const lens = snipJ(node, id).lens;
  fs.writeFileSync(f, JSON.stringify({ video: V, starts: STARTS, lens, dur: DUR }));
  fs.unlinkSync(path.join(node.CACHE, `${V}.wav`));
  assert.ok(node.snipCurrent(bank()));
  assert.deepStrictEqual(node.readSnip(id), { pads: PADS(V, STARTS), lens, durs: { [V]: DUR } });
  const t0 = fs.statSync(path.join(node.SNIP_DIR, `${id}.wav`)).mtimeMs;
  const r = node.snipEnsure(bank());
  assert.deepStrictEqual([r.pads[3], r.lens[15], r.durs[V]], [{ video: V, start: 3333 }, 5000, DUR]);
  assert.strictEqual(fs.statSync(path.join(node.SNIP_DIR, `${id}.wav`)).mtimeMs, t0);
  assert.ok(fs.readFileSync(f, 'utf8').includes('"starts"'), 'Datei unverändert');
  done();
});

t('Mix aus zwei WAVs, leerer Platz still mit lens 0, durs pro Video', () => {
  const { node, done } = setup();
  rampWav(path.join(node.CACHE, `${W}.wav`), 20);   // W: 20 s
  const { id } = node.libChange('newmix', {}, 'test');
  const pads = [{ video: V, start: 1000 }, { video: W, start: 2000 }, null, { video: W, start: 10000 }];
  pads.forEach((p, pad) => { if (p) node.libChange('setpad', { id, pad, ...p, info: { title: 'W' } }, 'test'); });
  const mix = node.libNow.lib.banks.find((b) => b.id === id);
  node.cutSnippets(mix);
  const buf = snipBuf(node, id);
  assert.strictEqual(slotFrame(buf, 0), Math.round(1000 * SR / 1000));
  assert.strictEqual(slotFrame(buf, 1), Math.round(2000 * SR / 1000));
  assert.strictEqual(slotFrame(buf, 3, 500), Math.round(10000 * SR / 1000) + 500);
  for (const i of [2, 4, 15]) assert.ok(silent(buf, i), `Fach ${i} still`);
  const j = snipJ(node, id);
  assert.deepStrictEqual(j.pads, [...pads, ...Array(12).fill(null)]);
  assert.deepStrictEqual(j.lens, [16000, 16000, 0, 10000, ...Array(12).fill(0)]);
  assert.deepStrictEqual(j.durs, { [V]: DUR, [W]: 20000 });
  assert.ok(node.snipCurrent(mix));
  assert.deepStrictEqual(node.snipStatus(mix), { snip: 'ok', wav: true });
  assert.ok(fs.existsSync(path.join(node.SNIP_DIR, `${W}.chroma`)), 'Analyse pro Video abgelegt');
  fs.unlinkSync(path.join(node.CACHE, `${W}.wav`));
  assert.strictEqual(node.snipStatus(mix).wav, false, 'ein Video fehlt -> wav false');
  done();
});

t('Quelle aus einer anderen Bank ohne WAV; leeren geht ohne Quelle; keine Quelle -> playonly', () => {
  const { node, id, bank, done } = setup();
  node.cutSnippets(bank());
  fs.unlinkSync(path.join(node.CACHE, `${V}.wav`));
  const { id: mid } = node.libChange('newmix', {}, 'test');
  const mix = () => node.libNow.lib.banks.find((b) => b.id === mid);
  node.cutSnippets(mix());
  assert.ok(silent(snipBuf(node, mid), 0));
  node.libChange('setpad', { id: mid, pad: 7, video: V, start: STARTS[15] }, 'test');
  node.libChange('setpad', { id: mid, pad: 0, video: V, start: STARTS[3] }, 'test');
  node.cutSnippets(mix());
  let buf = snipBuf(node, mid);
  assert.strictEqual(slotFrame(buf, 7), Math.round(STARTS[15] * SR / 1000));
  assert.strictEqual(slotFrame(buf, 0, 100), Math.round(STARTS[3] * SR / 1000) + 100);
  let j = snipJ(node, mid);
  assert.deepStrictEqual([j.lens[7], j.lens[0], j.lens[1], j.durs], [5000, 16000, 0, { [V]: DUR }]);
  // Platz leeren ohne WAV: Fach wird still
  node.libChange('setpad', { id: mid, pad: 0, video: null }, 'test');
  node.cutSnippets(mix());
  assert.ok(silent(snipBuf(node, mid), 0));
  // Start ohne passendes Fach irgendwo: playonly, alte Datei bleibt
  node.libChange('setpad', { id: mid, pad: 1, video: V, start: 4444 }, 'test');
  assert.throws(() => node.cutSnippets(mix()), (e) => e.code === 'playonly');
  const r = node.snipEnsure(mix());
  assert.deepStrictEqual([r.pads[0], r.pads[1], r.pads[7]], [null, null, { video: V, start: STARTS[15] }]);
  assert.ok(id !== mid);
  done();
});

t('Entprellen: mehrere Änderungen -> einmal geschnitten, kurz nach der letzten', async () => {
  const { node, id, bank, done } = setup();
  const cuts = [];
  node.libEvents.on('job', (j) => { if (j.kind === 'cut' && j.phase === 'done') cuts.push(Date.now()); });
  await sleep(100);
  const t0 = Date.now();
  node.libChange('setstart', { id, pad: 1, ms: 1100 }, 'c');
  await sleep(70);
  node.libChange('setstart', { id, pad: 2, ms: 2600 }, 'c');
  const t1 = Date.now();
  await sleep(70);
  assert.strictEqual(cuts.length, 0);
  assert.strictEqual(node.snipStatus(bank()).snip, 'stale');
  await sleep(1500);   // erster Schnitt rechnet auch die Analyse
  assert.strictEqual(cuts.length, 1);
  assert.ok(cuts[0] - t1 >= 140 && cuts[0] - t0 > 200, `geschnitten nach ${cuts[0] - t1} ms`);
  assert.ok(node.snipCurrent(bank()));
  done();
});

t('Änderung von außen schneidet nicht', async () => {
  const { node, bank, done } = setup();
  node.cutSnippets(bank());
  const lib = JSON.parse(fs.readFileSync(node.LIB_FILE, 'utf8'));
  lib.banks[0].pads[0].start = 50; lib.rev++;
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

t('Ablage: Leeren/Überschreiben ohne Cache, Undo spielt wieder; videos bleibt; Neustart räumt nur Unbenutztes', async () => {
  const { node, id, bank, done, home } = setup();
  const Z = 'ZZZZZZZZZZZ';
  node.cutSnippets(bank());
  fs.unlinkSync(path.join(node.CACHE, `${V}.wav`));
  const keep = (v, st) => path.join(node.KEEP_DIR, `${v}_${st}.wav`);
  // leeren und überschreiben ohne ganzen Track: altes Fach landet in der Ablage
  await node.runCmd({ cmd: 'setpad', id, pad: 3, video: null });
  await node.runCmd({ cmd: 'setpad', id, pad: 4, video: V, start: STARTS[15] });
  node.cutSnippets(bank());
  assert.ok(fs.existsSync(keep(V, 3333)) && fs.existsSync(keep(V, 5000)));
  assert.ok(!node.readSnip(id).pads.some((p) => p && (p.start === 3333 || p.start === 5000)), 'keine Bank hat die Pads mehr');
  // Undo: beide zurück, ohne Cache und ohne andere Bank -> kein playonly
  await node.runCmd({ cmd: 'setpad', id, pad: 3, video: V, start: 3333 });
  await node.runCmd({ cmd: 'setpad', id, pad: 4, video: V, start: 5000 });
  node.cutSnippets(bank());
  const buf = snipBuf(node, id), j = snipJ(node, id);
  assert.strictEqual(slotFrame(buf, 3, 100), Math.round(3333 * SR / 1000) + 100);
  assert.strictEqual(slotFrame(buf, 4, 100), Math.round(5000 * SR / 1000) + 100);
  assert.deepStrictEqual([j.lens[3], j.lens[4], j.durs[V]], [16000, 16000, DUR]);
  // letztes Pad eines Videos geleert: videos-Eintrag und .chroma bleiben während der Sitzung
  rampWav(path.join(node.CACHE, `${Z}.wav`), 20);
  await node.runCmd({ cmd: 'setpad', id, pad: 6, video: Z, start: 0, info: { title: 'Z' } });
  node.cutSnippets(bank());
  await node.runCmd({ cmd: 'setpad', id, pad: 6, video: null });
  await node.runCmd({ cmd: 'setpad', id, pad: 5, video: null });
  assert.deepStrictEqual(node.libNow.lib.videos[Z], { title: 'Z' });
  assert.ok(fs.existsSync(path.join(node.SNIP_DIR, `${Z}.chroma`)) && fs.existsSync(keep(Z, 0)) && fs.existsSync(keep(V, 7000)));
  // Neustart: ohne Pad weg (Ablage, .chroma in D, videos), mit Pad bleibt; Cache bleibt
  const n2 = loadNode(home).node;
  assert.ok(!fs.existsSync(keep(Z, 0)) && !fs.existsSync(keep(V, 7000)), 'ohne Referenz weg');
  assert.ok(fs.existsSync(keep(V, 3333)) && fs.existsSync(keep(V, 5000)), 'mit Referenz bleibt');
  assert.ok(!fs.existsSync(path.join(n2.SNIP_DIR, `${Z}.chroma`)) && fs.existsSync(path.join(n2.SNIP_DIR, `${V}.chroma`)));
  assert.ok(!(Z in n2.libNow.lib.videos) && V in n2.libNow.lib.videos);
  assert.ok(fs.existsSync(path.join(n2.CACHE, `${Z}.wav`)), 'Cache wird nie automatisch gelöscht');
  done();
});

run();
