// Audiodateien aus dem Finder (POST /audio → D/audio, fillpads mit Audio-ID): node tools/tests/test_audio.js
// Temp-HOME, freier Port, Attrappe für yt-dlp. Wandelt mit dem echten ffmpeg (brew install ffmpeg).
const assert = require('assert');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { tempHome, loadNode, t, run, sleep } = require('./harness');
const { beatWav } = require('./wav');

const SRCDIR = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'yts-audio-'));
const SHORT = path.join(SRCDIR, 'kurz.wav'), LONG = path.join(SRCDIR, 'lang.wav');
beatWav(SHORT, 8, 120);
beatWav(LONG, 40, 120);
const until = async (fn, what, ms = 8000) => { const t0 = Date.now(); while (!fn()) { if (Date.now() - t0 > ms) throw new Error('Zeit um: ' + what); await sleep(15); } };

function post(port, url, body, headers = {}) {
  const h = { Host: `127.0.0.1:${port}`, 'Content-Type': 'application/octet-stream', 'Content-Length': body.length, ...headers };
  return new Promise((resolve, reject) => {
    const r = http.request({ host: '127.0.0.1', port, method: 'POST', path: url, headers: h }, (res) => {
      const c = []; res.on('data', (d) => c.push(d));
      res.on('end', () => { let json = null; try { json = JSON.parse(Buffer.concat(c)); } catch (e) { /* leer */ } resolve({ status: res.statusCode, json }); });
    });
    r.on('error', reject); r.end(body);
  });
}
const upload = (port, file, name = path.basename(file)) => post(port, '/audio?name=' + encodeURIComponent(name), fs.readFileSync(file));
const cmd = (port, q) => post(port, '/cmd', Buffer.from(JSON.stringify(q)), { 'Content-Type': 'application/json' }).then((r) => r.json);

let home, node, port;
t('Start in Temp-HOME', async () => {
  home = tempHome(false);
  process.env.FAKE_LOG = path.join(home, 'fake.log');
  ({ node } = loadNode(home));
  await until(() => node.webPort > 0, 'Server');
  port = node.webPort;
});

let A, B;
t('Upload: WAV landet in D/audio mit .json, gleiche Datei = gleiche ID ohne neues Wandeln', async () => {
  const r = await upload(port, SHORT, 'Mein Kick, 1.wav');
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.json.ok, true, JSON.stringify(r.json));
  A = r.json.video;
  assert(node.isAudio(A) && /^[\w-]{11}$/.test(A), A);
  assert.strictEqual(r.json.title, 'Mein Kick, 1');
  assert(Math.abs(r.json.dur - 8000) < 50, r.json.dur);
  const wav = path.join(node.AUDIO_DIR, `${A}.wav`);
  assert(wav.startsWith(node.DATA) && node.hasWav(A));
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(path.join(node.AUDIO_DIR, `${A}.json`))).title, 'Mein Kick 1');
  const mt = fs.statSync(wav).mtimeMs;
  await sleep(20);
  const r2 = await upload(port, SHORT, 'anders.wav');
  assert.strictEqual(r2.json.video, A);
  assert.strictEqual(fs.statSync(wav).mtimeMs, mt, 'nicht neu gewandelt');
  assert.deepStrictEqual(fs.readdirSync(node.AUDIO_DIR).filter((n) => !n.startsWith(A)), [], 'keine Reste');
  B = (await upload(port, LONG)).json.video;
  assert(node.isAudio(B) && B !== A);
});

t('Upload: kein Audio → audiofail, falscher Host/Typ → 403', async () => {
  const r = await post(port, '/audio?name=x.txt', Buffer.from('das ist kein Audio'));
  assert.deepStrictEqual([r.json.ok, r.json.code], [false, 'audiofail']);
  assert(/kein Audio/.test(r.json.text));
  assert.strictEqual((await post(port, '/audio?name=x', Buffer.from('x'), { Host: 'evil.com' })).status, 403);
  assert.strictEqual((await post(port, '/audio?name=x', Buffer.from('x'), { Origin: 'http://evil.com' })).status, 403);
  assert.strictEqual((await post(port, '/audio?name=x', Buffer.from('x'), { 'Content-Type': 'text/plain' })).status, 403);
  assert.strictEqual((await post(port, '/audio?name=x', Buffer.from('x'), { 'Content-Length': 300 * 1024 * 1024 }).catch(() => ({ status: 403 }))).status, 403);
  assert.deepStrictEqual(fs.readdirSync(node.AUDIO_DIR).filter((n) => /tmp/.test(n)), [], 'keine Temp-Reste');
});

let bank;
t('fillpads: Audio ≤ 16 s mit Start 0, länger gewürfelt, Titel in videos, geschnitten', async () => {
  bank = node.libChange('newmix', {}, 'test').id;
  assert.deepStrictEqual(await cmd(port, { cmd: 'fillpads', id: bank, video: A, pads: [0, 1] }), { ok: true });
  assert.deepStrictEqual(await cmd(port, { cmd: 'fillpads', id: bank, video: B, pads: [2] }), { ok: true });
  const b = () => node.libNow.lib.banks.find((x) => x.id === bank);
  await until(() => b().pads[0] && b().pads[1] && b().pads[2], 'fillpads');
  assert.deepStrictEqual([b().pads[0].start, b().pads[1].start], [0, 0]);
  assert(b().pads[2].start >= 0 && b().pads[2].start <= 24000, b().pads[2].start);
  assert.strictEqual(node.libNow.lib.videos[A].title, 'Mein Kick, 1');
  await until(() => node.snipCurrent(b()), 'geschnitten');
});

t('fetch/fetchall/select starten für Audio nie yt-dlp, fehlende Datei = „Audiodatei fehlt“', async () => {
  const wav = path.join(node.AUDIO_DIR, `${B}.wav`), tmp = wav + '.weg';
  fs.renameSync(wav, tmp);   // wie iCloud noch nicht geladen
  assert.deepStrictEqual(await cmd(port, { cmd: 'fetchall' }), { ok: true, todo: 0 });
  await cmd(port, { cmd: 'fetch', video: B });
  await until(() => node.videoFail[B], 'Fehler');
  assert(/Audiodatei fehlt/.test(node.videoFail[B]), node.videoFail[B]);
  await cmd(port, { cmd: 'select', id: bank });
  await sleep(200);
  assert(!fs.existsSync(process.env.FAKE_LOG), 'yt-dlp gestartet');
  fs.renameSync(tmp, wav);
});

t('clearcache lässt D/audio stehen', async () => {
  fs.writeFileSync(path.join(node.CACHE, 'XXXXXXXXXXX.wav'), 'x');
  const r = await cmd(port, { cmd: 'clearcache' });
  assert.strictEqual(r.ok, true, JSON.stringify(r));
  assert(!fs.existsSync(path.join(node.CACHE, 'XXXXXXXXXXX.wav')));
  assert(node.hasWav(A) && node.hasWav(B));
});

t('Start: keepCleanup löscht Audiodateien, die kein Pad mehr braucht', async () => {
  await cmd(port, { cmd: 'setpad', id: bank, pad: 2, video: null });
  ({ node } = loadNode(home));
  assert(node.hasWav(A) && fs.existsSync(path.join(node.AUDIO_DIR, `${A}.json`)), 'A wird gebraucht');
  assert(!node.hasWav(B) && !fs.existsSync(path.join(node.AUDIO_DIR, `${B}.json`)), 'B weg');
});

t('aufräumen', async () => {
  fs.rmSync(home, { recursive: true, force: true });
  fs.rmSync(SRCDIR, { recursive: true, force: true });
});

run();
