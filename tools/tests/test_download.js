// Downloads (Spec 3.1): zwei Wege, Abbruch, Reihenfolge, Fehlschläge, newbank. node tools/tests/test_download.js
// yt-dlp ist eine Attrappe (fake_ytdlp.js), nie das echte.
const assert = require('assert');
const cp = require('child_process');
const fs = require('fs');
const path = require('path');
const { tempHome, loadNode, t, run, sleep } = require('./harness');
const { beatWav } = require('./wav');

// vor loadNode: ytsampler_node.js holt sich spawn beim Laden
const realSpawn = cp.spawn;
cp.spawn = (cmd, args, opts) => (cmd === 'yt-dlp' ? realSpawn(process.execPath, [path.join(__dirname, 'fake_ytdlp.js'), ...args], opts) : realSpawn(cmd, args, opts));

const ID = (c) => c.repeat(11);
function setup(delay = 120) {
  const home = tempHome(false);
  process.env.FAKE_LOG = path.join(home, 'fake.log');
  process.env.FAKE_WAV = path.join(home, 'src.wav');
  process.env.FAKE_DELAY = String(delay);
  fs.writeFileSync(process.env.FAKE_LOG, '');
  beatWav(process.env.FAKE_WAV, 30, 120);
  const { node, max } = loadNode(home);
  const events = [];
  for (const ev of ['job', 'msg', 'cache', 'status']) node.libEvents.on(ev, (d) => events.push([ev, d]));
  const log = () => fs.readFileSync(process.env.FAKE_LOG, 'utf8').trim().split('\n').filter(Boolean);
  const until = async (fn, ms = 8000) => { const t0 = Date.now(); while (!fn()) { if (Date.now() - t0 > ms) throw new Error('Zeit um, Protokoll: ' + log().join(', ')); await sleep(20); } };
  const leftovers = () => fs.readdirSync(node.CACHE).filter((n) => n.includes('.dl-'));
  return { node, max, log, until, events, leftovers, done: () => fs.rmSync(home, { recursive: true, force: true }) };
}

t('Editor: neuer Wunsch bricht den laufenden ab, keine halbe WAV, der abgebrochene lädt danach', async () => {
  const { node, log, until, leftovers, done } = setup();
  const A = ID('A'), B = ID('B');
  const pa = node.fetchVideo(A, 'fetch');
  await until(() => log().includes('start ' + A));
  const pb = node.fetchVideo(B, 'select');
  await until(() => log().includes('kill ' + A));
  await sleep(50);
  assert.ok(!fs.existsSync(path.join(node.CACHE, `${A}.wav`)));
  assert.deepStrictEqual(leftovers().filter((n) => n.startsWith(A)), []);
  const [ia, ib] = await Promise.all([pa, pb]);
  assert.deepStrictEqual(log(), [`start ${A}`, `kill ${A}`, `start ${B}`, `end ${B}`, `start ${A}`, `end ${A}`], log().join(", "));
  assert.strictEqual(ia.raw, `Titel; ${A}`);
  assert.strictEqual(ia.title, `Titel ${A}`);
  assert.ok(fs.existsSync(path.join(node.CACHE, `${A}.wav`)) && fs.existsSync(path.join(node.CACHE, `${B}.json`)));
  assert.strictEqual(ib.id, B);
  assert.deepStrictEqual(leftovers(), []);
  done();
});

t('Editor-Reihenfolge: select/fetch vor newbank vor fetchall, newbank und fetchall der Reihe nach', async () => {
  const { node, log, until, done } = setup();
  const [X, Y, Z1, Z2, W] = ['X', 'Y', 'Z', 'Q', 'W'].map(ID);
  for (const v of [X, Y]) node.libChange('create', { video: v, title: v, starts: Array(16).fill(0).map((_, i) => i) }, 't');
  assert.deepStrictEqual(node.fetchAll(), { todo: 2 });
  await until(() => log().includes('start ' + X));
  const pz1 = node.fetchVideo(Z1, 'newbank'), pz2 = node.fetchVideo(Z2, 'newbank');
  await until(() => log().includes('start ' + Z1));
  const pw = node.fetchVideo(W, 'fetch');
  await Promise.all([pz1, pz2, pw]);
  await until(() => log().includes('end ' + Y));
  assert.deepStrictEqual(log(), [
    `start ${X}`, `kill ${X}`, `start ${Z1}`, `kill ${Z1}`, `start ${W}`, `end ${W}`,
    `start ${Z1}`, `end ${Z1}`, `start ${Z2}`, `end ${Z2}`, `start ${X}`, `end ${X}`, `start ${Y}`, `end ${Y}`,
  ]);
  done();
});

t('Fehlschlag: loadfail mit Titel und Grund, fail gesetzt, fetchall überspringt, neuer Versuch löscht fail', async () => {
  const { node, events, log, until, done } = setup(20);
  const F = 'FAIL' + ID('F').slice(4), C = ID('C');
  for (const v of [F, C]) node.libChange('create', { video: v, title: 'Lied ' + v, starts: Array(16).fill(0).map((_, i) => i) }, 't');
  await assert.rejects(node.fetchVideo(F, 'select'), (e) => e.code === 'loadfail' && e.text === `Download fehlgeschlagen: Lied ${F} – ERROR: Video unavailable`);
  assert.strictEqual(node.videoFail[F], 'ERROR: Video unavailable');
  assert.ok(events.some(([ev, d]) => ev === 'msg' && d.code === 'loadfail' && d.level === 'error'));
  assert.ok(events.some(([ev, d]) => ev === 'job' && d.video === F && d.phase === 'fail'));
  assert.deepStrictEqual(node.fetchAll(), { todo: 1 });
  await until(() => log().includes('end ' + C));
  assert.ok(!log().some((l) => l.includes(F)));
  const p = node.fetchVideo(F, 'fetch').catch(() => {});
  assert.ok(!(F in node.videoFail), 'gilt bis zum nächsten Versuch');
  await p;
  assert.ok(F in node.videoFail);
  done();
});

t('Teletext und Editor brechen sich nicht ab; Teletext: neuester Wunsch gewinnt', async () => {
  const { node, max, log, until, done } = setup();
  const A = ID('a'), B = ID('b'), C = ID('c'), D = ID('d');
  node.loadVideo(A);
  await until(() => log().includes('start ' + A));
  const pb = node.fetchVideo(B, 'fetch');
  await pb;
  await until(() => max.out.some((m) => m[0] === 'loaded' && m[3] === A));
  assert.ok(!log().some((l) => l.startsWith('kill')));
  max.out.length = 0;
  node.loadVideo(C);
  await until(() => log().includes('start ' + C));
  node.loadVideo(D);
  await until(() => max.out.some((m) => m[0] === 'analysisready'));
  assert.ok(log().includes('kill ' + C));
  assert.deepStrictEqual(max.out.filter((m) => m[0] === 'loaded').map((m) => m[3]), [D]);
  assert.ok(!fs.existsSync(path.join(node.CACHE, `${C}.wav`)));
  assert.ok(!max.out.some((m) => m[0] === 'status' && /Fehler/.test(m[1])), 'kein Fehler für den abgebrochenen');
  done();
});

t('newbank: laden, würfeln, Bank am Ende mit Titel, Snippets geschnitten, Fortschritt per job', async () => {
  const { node, events, done } = setup(20);
  const V = ID('N');
  const id = await node.newBank(V, 'client1');
  const lib = node.libNow.lib;
  const bank = lib.banks[lib.banks.length - 1];
  assert.strictEqual(bank.id, id);
  assert.strictEqual(bank.name, `Titel; ${V}`);
  assert.strictEqual(lib.videos[V].title, `Titel; ${V}`);
  assert.deepStrictEqual(bank.starts, [...bank.starts].sort((x, y) => x - y));
  assert.strictEqual(new Set(bank.starts).size, 16);
  assert.ok(node.snipCurrent(bank));
  assert.ok(fs.existsSync(path.join(node.SNIP_DIR, `${V}.chroma`)));
  const phases = events.filter(([ev, d]) => ev === 'job' && d.kind === 'newbank').map(([, d]) => d.phase);
  assert.deepStrictEqual([...new Set(phases)], ['info', 'download', 'convert', 'analyse', 'cut', 'done']);
  const last = events.filter(([ev, d]) => ev === 'job' && d.kind === 'newbank').pop()[1];
  assert.strictEqual(last.bankId, id);
  assert.ok(events.some(([ev, d]) => ev === 'cache' && d.bytes > 0 && d.warn === false));
  done();
});

run();
