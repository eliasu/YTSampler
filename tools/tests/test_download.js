// Downloads (Spec 3.1, nur noch der Editor-Weg): Abbruch, Reihenfolge, Fehlschläge, fillpads. node tools/tests/test_download.js
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
  const leftovers = () => fs.readdirSync(node.CACHE).filter((n) => n.includes('.dl.'));
  return { node, max, log, until, events, leftovers, done: () => fs.rmSync(home, { recursive: true, force: true }) };
}

// höchstens wie viele gleichzeitig laufen, aus dem Protokoll der Attrappe
const maxRunning = (log) => { let n = 0, m = 0; for (const l of log) { n += l.startsWith('start') ? 1 : -1; m = Math.max(m, n); } return m; };
const before = (log, x, y) => log.indexOf(x) >= 0 && log.indexOf(x) < log.indexOf(y);

t('Editor: drei parallel, ein neuer Wunsch bricht den ältesten ab, keine halbe WAV, der abgebrochene lädt danach', async () => {
  const { node, log, until, leftovers, done } = setup();
  const [A, B, C, D] = ['A', 'B', 'C', 'D'].map(ID);
  const ps = [A, B, C].map((v) => node.fetchVideo(v, 'fetch'));
  await until(() => [A, B, C].every((v) => log().includes('start ' + v)));
  ps.push(node.fetchVideo(D, 'select'));
  await until(() => log().includes('kill ' + A));
  await sleep(50);
  assert.ok(!fs.existsSync(path.join(node.CACHE, `${A}.wav`)));
  assert.deepStrictEqual(leftovers().filter((n) => n.startsWith(A)), []);
  const [ia] = await Promise.all(ps);
  const l = log();
  assert.ok(before(l, `kill ${A}`, `start ${D}`) && l.lastIndexOf(`start ${A}`) > l.indexOf(`start ${D}`), l.join(', '));
  assert.ok(maxRunning(l) <= 3, l.join(', '));
  assert.strictEqual(ia.raw, `Titel; ${A}`);
  assert.strictEqual(ia.title, `Titel ${A}`);
  assert.ok([A, B, C, D].every((v) => fs.existsSync(path.join(node.CACHE, `${v}.wav`))));
  assert.deepStrictEqual(leftovers(), []);
  done();
});

t('Editor-Reihenfolge: bei vollen Plätzen verdrängt select/fetch pads verdrängt fetchall', async () => {
  const { node, log, until, done } = setup();
  const [X, Y, Z1, Z2, W] = ['X', 'Y', 'Z', 'Q', 'W'].map(ID);
  for (const v of [X, Y]) node.libChange('create', { video: v, title: v, starts: Array(16).fill(0).map((_, i) => i) }, 't');
  assert.deepStrictEqual(node.fetchAll(), { todo: 2 });
  await until(() => log().includes('start ' + X) && log().includes('start ' + Y));
  const pz1 = node.fetchVideo(Z1, 'pads');
  await until(() => log().includes('start ' + Z1));
  const pz2 = node.fetchVideo(Z2, 'pads');
  await until(() => log().includes('start ' + Z2));
  const pw = node.fetchVideo(W, 'fetch');
  await Promise.all([pz1, pz2, pw]);
  await until(() => log().filter((x) => x.startsWith('end')).length === 5);
  const l = log();
  assert.ok(before(l, `kill ${X}`, `start ${Z2}`) && before(l, `kill ${Y}`, `start ${W}`), l.join(', '));
  assert.ok(!l.includes(`kill ${Z1}`) && !l.includes(`kill ${Z2}`), l.join(', '));
  assert.ok(maxRunning(l) <= 3, l.join(', '));
  done();
});

t('fillpads parallel: eigene job-Zeile pro tag, vierte wartet sichtbar, jede Bank bekommt ihren Track', async () => {
  const { node, log, events, done } = setup(60);
  const [V1, V2, V3, V4, V5] = ['1', '2', '3', '4', '5'].map(ID);
  await node.fetchVideo(V2, 'fetch');   // V2 liegt schon im Cache und wäre sofort fertig
  const ids = [V1, V2, V3, V4, V5].map(() => node.libChange('newmix', {}, 't').id);
  await Promise.all([V1, V2, V3, V4, V5].map((v, i) => node.fillPads({ id: ids[i], video: v, pads: [i], tag: 't' + i }, 'c')));
  const banks = node.libNow.lib.banks;
  assert.deepStrictEqual(banks.map((b, i) => b.pads[i].video), [V1, V2, V3, V4, V5]);
  assert.ok(maxRunning(log().slice(2)) <= 3, log().join(', '));
  const nb = events.filter(([ev, d]) => ev === 'job' && d.kind === 'pads').map(([, d]) => d);
  assert.ok(nb.some((d) => d.tag === 't4' && d.phase === 'queue'), 'fünfte wartet');
  [0, 1, 2, 3, 4].forEach((i) => assert.strictEqual(nb.filter((d) => d.tag === 't' + i && d.phase === 'done').length, 1));
  assert.ok(!events.some(([ev, d]) => ev === 'job' && d.kind === 'fetch' && d.video !== V2), 'fillpads meldet nicht doppelt');
  done();
});

t('errMsg: verständliche Hinweise für veraltetes yt-dlp, fehlendes ffmpeg/yt-dlp', () => {
  const { node, done } = setup();
  assert.match(node.errMsg(new Error('ERROR: [youtube] x: No video formats found!; please report this issue')), /yt-dlp veraltet.*brew upgrade yt-dlp/);
  assert.match(node.errMsg(new Error('WAV fehlt – ist ffmpeg installiert?')), /ffmpeg fehlt/);
  assert.match(node.errMsg(Object.assign(new Error('spawn yt-dlp ENOENT'), { code: 'ENOENT' })), /yt-dlp nicht gefunden/);
  assert.strictEqual(node.errMsg(new Error('ERROR: Video unavailable')), 'Fehler: ERROR: Video unavailable');
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
  await until(() => !(F in node.videoFail));   // gilt bis der nächste Versuch startet
  await p;
  assert.ok(F in node.videoFail);
  done();
});

t('Teletext-Weg ist weg: kein loadVideo, kein load-Handler', () => {
  const { node, max, done } = setup();
  assert.ok(!('loadVideo' in node));
  for (const h of ['load', 'key']) assert.ok(!(h in max.handlers), h);
  done();
});

t('fillpads: laden, leere Plätze würfeln (aufsteigend, verschieden), Titel, Snippets geschnitten, done mit before/after', async () => {
  const { node, events, done } = setup(20);
  const V = ID('N'), O = ID('O');
  await node.fetchVideo(O, 'fetch');
  const { id } = node.libChange('newmix', {}, 't');
  node.libChange('setpad', { id, pad: 5, video: O, start: 1000, info: { title: 'Alt' } }, 't');
  const empty = [...Array(16).keys()].filter((k) => k !== 5);
  await node.fillPads({ id, video: V, pads: empty, tag: 'x' }, 'client1');
  const bank = node.libNow.lib.banks.find((b) => b.id === id);
  assert.deepStrictEqual(bank.pads[5], { video: O, start: 1000 });
  const starts = empty.map((k) => bank.pads[k].start);
  assert.ok(empty.every((k) => bank.pads[k].video === V));
  assert.deepStrictEqual(starts, [...starts].sort((x, y) => x - y));
  assert.strictEqual(new Set(starts).size, 15);
  assert.strictEqual(node.libNow.lib.videos[V].title, `Titel; ${V}`);
  assert.strictEqual(bank.name, 'Neue Bank');
  await new Promise((r) => setTimeout(r, 300));   // Schneiden entprellt
  assert.ok(node.snipCurrent(bank));
  assert.ok(fs.existsSync(path.join(node.SNIP_DIR, `${V}.chroma`)));
  const pj = events.filter(([ev, d]) => ev === 'job' && d.kind === 'pads').map(([, d]) => d);
  assert.deepStrictEqual([...new Set(pj.map((d) => d.phase))], ['info', 'download', 'convert', 'analyse', 'done']);
  const last = pj.pop();
  assert.deepStrictEqual([last.id, last.tag, last.pads], [id, 'x', empty]);
  assert.deepStrictEqual(last.before, Array(15).fill(null));
  assert.deepStrictEqual(last.after, starts.map((start) => ({ video: V, start })));
  assert.deepStrictEqual(last.videos[V], { title: `Titel; ${V}` });
  // überschreiben: before = alter Eintrag samt Titel, kein Start doppelt mit den übrigen Pads des Videos
  await node.fillPads({ id, video: V, pads: [5], tag: 'y' }, 'client1');
  const l2 = events.filter(([ev, d]) => ev === 'job' && d.kind === 'pads' && d.tag === 'y').pop()[1];
  assert.deepStrictEqual(l2.before, [{ video: O, start: 1000 }]);
  assert.deepStrictEqual(l2.videos[O], { title: 'Alt' });
  assert.ok(!starts.includes(node.libNow.lib.banks.find((b) => b.id === id).pads[5].start) || starts.length >= 15);
  assert.ok(events.some(([ev, d]) => ev === 'cache' && d.bytes > 0 && d.warn === false));
  // Bank inzwischen gelöscht: nobank
  node.libChange('delete', { id }, 't');
  await assert.rejects(node.fillPads({ id, video: V, pads: [0] }, 'c'), (e) => e.code === 'nobank');
  done();
});

run();
