// HTTP, /cmd, SSE, Peaks, Device-Nachrichten (Spec 3.2–3.4, 6.1, 6.2, 6.5): node tools/tests/test_http.js
// Server auf freiem Port (YTS_PORT=0), Temp-HOME, Attrappen für max-api und yt-dlp.
const assert = require('assert');
const cp = require('child_process');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { tempHome, loadNode, t, run, sleep } = require('./harness');
const { beatWav } = require('./wav');

const realSpawn = cp.spawn;
cp.spawn = (cmd, args, opts) => (cmd === 'yt-dlp' ? realSpawn(process.execPath, [path.join(__dirname, 'fake_ytdlp.js'), ...args], opts) : realSpawn(cmd, args, opts));

const V1 = 'AAAAAAAAAAA', V2 = 'BBBBBBBBBBB', V3 = 'CCCCCCCCCCC';
const DUR = 40000;
const STARTS = Array.from({ length: 16 }, (_, i) => i * 2000);
STARTS[15] = DUR - 5000;                        // kürzeres letztes Snippet
const SRC = path.join(fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'yts-src-')), 'beat.wav');
beatWav(SRC, DUR / 1000, 120);

const until = async (fn, what = 'Bedingung', ms = 8000) => { const t0 = Date.now(); while (!fn()) { if (Date.now() - t0 > ms) throw new Error('Zeit um: ' + what); await sleep(15); } };

// Drei Bänke: 1 = V1, 2 = V2 (ohne ganze WAV, Snippets geschnitten), 3 = V1
async function setup(delay = '20') {
  const home = tempHome(false);
  process.env.FAKE_LOG = path.join(home, 'fake.log');
  process.env.FAKE_WAV = SRC;
  process.env.FAKE_DELAY = delay;   // ENV übernimmt Node beim Laden
  const { node, max } = loadNode(home);
  for (const v of [V1, V2]) fs.copyFileSync(SRC, path.join(node.CACHE, `${v}.wav`));
  const mk = (video, name) => node.libChange('create', { video, title: 'Titel ' + video, name, starts: STARTS }, 'test').id;
  const ids = [mk(V1, 'Eins'), mk(V2, 'Zwei'), mk(V1, 'Drei')];
  node.cutSnippets(node.libNow.lib.banks[1]);
  fs.unlinkSync(path.join(node.CACHE, `${V2}.wav`));
  await until(() => node.webPort > 0, 'Server');
  max.out = [];
  const port = node.webPort;
  const on = (sel) => max.out.filter((m) => m[0] === sel);
  const done = () => { for (const c of conns) c.close(); fs.rmSync(home, { recursive: true, force: true }); };
  const conns = [];
  const events = () => { const c = sse(port); conns.push(c); return c; };
  return { node, max, port, ids, on, done, events, cmd: (body) => req(port, { body }).then((r) => r.json) };
}

// Rohe Anfrage, damit sich Host und Origin setzen lassen
function req(port, { method = 'POST', url = '/cmd', headers = {}, body = '' } = {}) {
  const data = typeof body === 'string' ? body : JSON.stringify(body);
  const h = { Host: `127.0.0.1:${port}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), ...headers };
  for (const k of Object.keys(h)) if (h[k] === null) delete h[k];
  return new Promise((resolve, reject) => {
    const r = http.request({ host: '127.0.0.1', port, method, path: url, headers: h }, (res) => {
      const chunks = [];
      res.on('data', (d) => chunks.push(d));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        let json = null;
        try { json = JSON.parse(buf.toString()); } catch (e) { /* kein JSON */ }
        resolve({ status: res.statusCode, headers: res.headers, buf, json });
      });
    });
    r.on('error', reject);
    r.end(method === 'GET' ? undefined : data);
  });
}

// SSE-Client: events = [[name, data], …], retry als ['retry', n]
function sse(port) {
  const c = { events: [], buf: '' };
  c.req = http.get({ host: '127.0.0.1', port, path: '/editor/events' }, (res) => {
    res.setEncoding('utf8');
    res.on('data', (d) => {
      c.buf += d;
      let i;
      while ((i = c.buf.indexOf('\n\n')) >= 0) {
        const block = c.buf.slice(0, i); c.buf = c.buf.slice(i + 2);
        let ev = 'message', data = null;
        for (const l of block.split('\n')) {
          if (l.startsWith('retry: ')) c.events.push(['retry', +l.slice(7)]);
          else if (l.startsWith('event: ')) ev = l.slice(7);
          else if (l.startsWith('data: ')) data = JSON.parse(l.slice(6));
        }
        if (data !== null) c.events.push([ev, data]);
      }
    });
  });
  c.req.on('error', () => {});
  c.of = (ev) => c.events.filter((e) => e[0] === ev).map((e) => e[1]);
  c.last = (ev) => c.of(ev).pop();
  c.wait = (pred, what) => until(() => c.events.some(([ev, d]) => pred(ev, d)), what);
  c.close = () => c.req.destroy();
  return c;
}

const bankArgs = (m) => ({ id: m[1], nr: m[2], bpm: m[3], starts: m.slice(4, 20), lens: m.slice(20, 36), dur: m[36], video: m[37], path: m[38] });

t('Schutz für /cmd: Content-Type, Host, Origin, 64 KB, Methode → 403; kaputtes JSON → 400; unbekannt → badreq', async () => {
  const { port, done } = await setup();
  const ok = { cmd: 'hit', pad: 0 };
  assert.strictEqual((await req(port, { body: ok })).json.ok, true);
  assert.strictEqual((await req(port, { body: ok, headers: { 'Content-Type': 'application/json; charset=utf-8' } })).json.ok, true);
  assert.strictEqual((await req(port, { body: ok, headers: { Host: `localhost:${port}` } })).json.ok, true);
  assert.strictEqual((await req(port, { body: ok, headers: { Origin: `http://localhost:${port}` } })).json.ok, true);
  for (const headers of [{ 'Content-Type': 'text/plain' }, { 'Content-Type': null }, { Host: `evil.com:${port}` }, { Host: `127.0.0.1:${port + 1}` },
    { Origin: 'http://evil.com' }, { Origin: `http://127.0.0.1:${port + 1}` }, { Origin: 'null' }]) {
    assert.strictEqual((await req(port, { body: ok, headers })).status, 403, JSON.stringify(headers));
  }
  assert.strictEqual((await req(port, { method: 'GET' })).status, 403);
  const big = JSON.stringify({ cmd: 'hit', pad: 0, x: 'a'.repeat(70000) });
  assert.strictEqual((await req(port, { body: big })).status, 403);
  assert.strictEqual((await req(port, { body: big, headers: { 'Content-Length': null, 'Transfer-Encoding': 'chunked' } })).status, 403, 'ohne Content-Length');
  assert.strictEqual((await req(port, { body: '{kaputt' })).status, 400);
  for (const body of [{ cmd: 'gibtsnicht' }, { pad: 1 }, [1], { cmd: 'hit', pad: 16 }, { cmd: 'hit', pad: 1.5 }, { cmd: 'toString' }]) {
    const r = await req(port, { body });
    assert.deepStrictEqual([r.status, r.json], [200, { ok: false, code: 'badreq', text: 'Ungültiger Befehl' }], JSON.stringify(body));
  }
  done();
});

t('/peaks: 400 bei falscher ID, 404 ohne WAV, sonst Kopf + Min/Max je 256 Frames', async () => {
  const { node, port, done } = await setup();
  assert.strictEqual((await req(port, { method: 'GET', url: '/peaks/kurz' })).status, 400);
  assert.strictEqual((await req(port, { method: 'GET', url: '/peaks/..%2F..%2Fxx' })).status, 400);
  assert.strictEqual((await req(port, { method: 'GET', url: `/peaks/${V2}` })).status, 404);
  const r = await req(port, { method: 'GET', url: `/peaks/${V1}` });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.headers['content-type'], 'application/octet-stream');
  assert.strictEqual(r.headers['cache-control'], 'private, max-age=86400');
  const frames = DUR * 44.1, blocks = Math.floor(frames / 256);
  assert.strictEqual(r.buf.readUInt32LE(0), 44100);
  assert.strictEqual(r.buf.readUInt32LE(4), 256);
  assert.strictEqual(r.buf.length, 8 + blocks * 2);
  // gegenrechnen aus der WAV
  const wav = fs.readFileSync(path.join(node.CACHE, `${V1}.wav`));
  for (const k of [0, 1, 100, 1234, blocks - 1]) {
    let mn = 127, mx = -128;
    for (let s = 0; s < 512; s++) { const x = wav.readInt16LE(44 + (k * 512 + s) * 2) >> 8; mn = Math.min(mn, x); mx = Math.max(mx, x); }
    assert.deepStrictEqual([r.buf.readInt8(8 + k * 2), r.buf.readInt8(9 + k * 2)], [mn, mx], `Block ${k}`);
  }
  assert.ok(r.buf.readInt8(9) > 50, 'Kick am Anfang ist laut');
  done();
});

t('/editor liefert editor.html und spiegelt sie nach D/web', async () => {
  const { node, port, done } = await setup();
  const r = await req(port, { method: 'GET', url: '/editor' });
  assert.strictEqual(r.status, 200);
  assert.match(r.headers['content-type'], /^text\/html/);
  assert.ok(r.buf.toString().includes('/editor/events'));
  assert.ok(fs.existsSync(path.join(node.DATA, 'web', 'editor.html')));
  assert.strictEqual((await req(port, { method: 'GET', url: '/' })).status, 200, 'Teletext bleibt');
  done();
});

t('SSE: retry, hello, lib, device, cache beim Verbinden; beats erst mit aktiver Bank', async () => {
  const { node, port, ids, cmd, events, done } = await setup();
  const a = events();
  await a.wait((ev) => ev === 'cache', 'cache');
  await sleep(60);
  assert.deepStrictEqual(a.events.map((e) => e[0]), ['retry', 'hello', 'lib', 'device', 'cache']);
  assert.strictEqual(a.events[0][1], 1500);
  assert.deepStrictEqual(a.last('hello'), { port, session: 0, track: '' });
  const lib = a.last('lib');
  assert.strictEqual(lib.state, 'ok');
  assert.strictEqual(lib.by, 'test');
  assert.deepStrictEqual(lib.banks.map((b) => [b.id, b.name, b.video, b.snip, b.wav]),
    [[ids[0], 'Eins', V1, 'stale', true], [ids[1], 'Zwei', V2, 'ok', false], [ids[2], 'Drei', V1, 'stale', true]]);
  assert.deepStrictEqual(lib.banks[0].starts, STARTS);
  assert.deepStrictEqual(lib.videos, { [V1]: { title: 'Titel ' + V1 }, [V2]: { title: 'Titel ' + V2 } });
  assert.deepStrictEqual(Object.keys(lib.cache), ['bytes', 'warn']);
  assert.deepStrictEqual(a.last('device'), { bankId: 0, video: '-', sel: 0, mode: 0, rev: 0, starts: [], spans: [], nr: 0, teletext: null });
  assert.strictEqual(a.last('cache').warn, false);

  assert.deepStrictEqual(await cmd({ client: 'c1', cmd: 'select', id: ids[0] }), { ok: true });
  await a.wait((ev) => ev === 'beats', 'beats nach select');
  const b = a.last('beats');
  assert.strictEqual(b.video, V1);
  assert.ok(Math.abs(b.bpm - 120) < 2, 'bpm ' + b.bpm);
  assert.strictEqual(b.confirmed, false);
  assert.ok(b.beats.length > 40 && typeof b.down === 'number' && typeof b.conf === 'number' && typeof b.ok === 'boolean');
  await a.wait((ev, d) => ev === 'lib' && d.banks[0].snip === 'ok', 'snip ok nach dem Schneiden');

  const c = events();
  await c.wait((ev) => ev === 'beats', 'beats beim Verbinden');
  assert.deepStrictEqual(c.events.map((e) => e[0]), ['retry', 'hello', 'lib', 'device', 'cache', 'beats']);
  done();
});

t('select: bankname, bank mit Starts, Längen, Songdauer, Video, Pfad; danach die Analyse aus D', async () => {
  const { node, max, ids, on, cmd, done } = await setup();
  await cmd({ cmd: 'select', id: ids[2] });
  assert.deepStrictEqual(max.out.slice(0, 2).map((m) => m[0]), ['bankname', 'bank']);
  assert.deepStrictEqual(on('bankname')[0], ['bankname', ids[2], 'Drei']);
  const b = bankArgs(on('bank')[0]);
  assert.deepStrictEqual(b, { id: ids[2], nr: 3, bpm: 0, starts: STARTS, lens: STARTS.map((s) => Math.min(16000, DUR - s)), dur: DUR, video: V1, path: path.join(node.SNIP_DIR, `${ids[2]}.wav`) });
  assert.strictEqual(b.lens[15], 5000);
  assert.ok(fs.existsSync(b.path));
  await until(() => on('analysisready').length, 'analysisready');
  assert.deepStrictEqual(max.out.filter((m) => ['tuning', 'tempo', 'silence', 'analysisready'].includes(m[0])).map((m) => m[0]), ['tuning', 'tempo', 'silence', 'analysisready']);
  assert.ok(fs.existsSync(path.join(node.SNIP_DIR, `${V1}.chroma`)), 'Analyse liegt in D');
  assert.strictEqual(node.activeId, ids[2]);

  // ohne WAV, aber mit Snippets: lädt, und der Track kommt im Hintergrund
  max.out = [];
  fs.writeFileSync(process.env.FAKE_LOG, '');
  await cmd({ cmd: 'select', id: ids[1] });
  assert.strictEqual(bankArgs(on('bank')[0]).video, V2);
  await until(() => node.hasWav(V2), 'Track im Hintergrund');
  // ohne Snippets und ohne WAV: nosnip, an [js] bankfail
  fs.unlinkSync(path.join(node.SNIP_DIR, `${ids[1]}.json`));
  fs.unlinkSync(path.join(node.CACHE, `${V2}.wav`));
  max.out = [];
  const r = await cmd({ cmd: 'select', id: ids[1] });
  assert.deepStrictEqual(r, { ok: false, code: 'nosnip', text: 'Snippets fehlen – Bank nicht ladbar' });
  assert.deepStrictEqual(on('bankfail'), [['bankfail', ids[1], 'Snippets fehlen – Bank nicht ladbar']]);
  assert.deepStrictEqual(on('bank'), []);
  assert.deepStrictEqual(await cmd({ cmd: 'select', id: 99 }), { ok: false, code: 'nobank', text: 'Bank gibt es nicht mehr' });
  assert.strictEqual((await cmd({ cmd: 'select' })).code, 'badreq');
  done();
});

t('Device: banksel, bankpeek, bankopen/bankgone, banksel über der letzten Bank', async () => {
  const { node, max, ids, on, done } = await setup();
  const h = max.handlers;
  h.bankpeek(2);
  assert.deepStrictEqual(on('bankpeek'), [['bankpeek', 2, 3, 'Zwei']]);
  h.bankpeek(4);
  assert.deepStrictEqual(on('bankpeek')[1], ['bankpeek', 4, 3, '']);
  h.banksel(1);
  const b = bankArgs(on('bank')[0]);
  assert.deepStrictEqual([b.id, b.nr, b.dur, b.lens[15], b.path], [ids[0], 1, DUR, 5000, path.join(node.SNIP_DIR, `${ids[0]}.wav`)]);
  max.out = [];
  h.banksel(4);
  h.bankopen(77);
  assert.deepStrictEqual(max.out, [['bankgone', 77]]);
  max.out = [];
  h.bankopen(ids[1]);
  assert.strictEqual(bankArgs(on('bank')[0]).nr, 2);
  done();
});

t('rename, move, duplicate, delete, restore: Antworten, by/rev in lib, Nachrichten an [js]', async () => {
  const { node, max, ids, on, cmd, events, done } = await setup();
  const a = events();
  await a.wait((ev) => ev === 'cache');
  const rev0 = a.last('lib').rev;
  await cmd({ cmd: 'select', id: ids[0] });
  max.out = [];

  assert.deepStrictEqual(await cmd({ client: 'c1', cmd: 'rename', id: ids[0], name: '  Neu; Name  ' }), { ok: true });
  assert.deepStrictEqual(on('bankname'), [['bankname', ids[0], 'Neu Name']]);
  await a.wait((ev, d) => ev === 'lib' && d.rev === rev0 + 1);
  assert.deepStrictEqual([a.last('lib').by, a.last('lib').banks[0].name], ['c1', 'Neu; Name']);
  assert.deepStrictEqual(on('libstate').pop(), ['libstate', 3, 1, 'ok']);
  max.out = [];
  await cmd({ client: 'c1', cmd: 'rename', id: ids[1], name: 'Andere' });
  assert.deepStrictEqual(on('bankname'), [], 'nicht aktiv: kein bankname');

  await cmd({ client: 'c1', cmd: 'move', id: ids[0], to: 3 });
  assert.deepStrictEqual(on('libstate').pop(), ['libstate', 3, 3, 'ok']);
  assert.deepStrictEqual(on('bank'), [], 'verschieben lädt nichts');
  assert.strictEqual((await cmd({ cmd: 'move', id: ids[0], to: 4 })).code, 'badreq');

  // duplicate: Kopie direkt dahinter, Snippets kopiert, Kopie aktiv
  max.out = [];
  const d = await cmd({ client: 'c1', cmd: 'duplicate', id: ids[0] });
  assert.ok(d.ok && d.id === 4);
  assert.deepStrictEqual(node.libNow.lib.banks.map((b) => b.id), [ids[1], ids[2], ids[0], 4]);
  assert.ok(fs.existsSync(path.join(node.SNIP_DIR, '4.wav')));
  assert.deepStrictEqual(bankArgs(on('bank')[0]).id, 4);
  assert.deepStrictEqual(on('bankname')[0], ['bankname', 4, 'Neu Name (Kopie)']);
  await a.wait((ev, d2) => ev === 'lib' && d2.banks.length === 4 && d2.banks[3].snip === 'ok', 'Kopie snip ok');

  // delete der aktiven (letzten) Bank: die davor wird aktiv
  max.out = [];
  const del = await cmd({ client: 'c1', cmd: 'delete', id: 4 });
  assert.deepStrictEqual(del.removed, { bank: { id: 4, name: 'Neu; Name (Kopie)', video: V1, starts: STARTS }, at: 4, video: { title: 'Titel ' + V1 } });
  assert.strictEqual(bankArgs(on('bank')[0]).id, ids[0]);
  // delete der aktiven Bank in der Mitte: Nachrücker auf demselben Platz
  await cmd({ cmd: 'move', id: ids[0], to: 2 });
  max.out = [];
  await cmd({ client: 'c1', cmd: 'delete', id: ids[0] });
  assert.deepStrictEqual(bankArgs(on('bank')[0]).id, ids[2]);
  // nicht aktive löschen lädt nichts
  max.out = [];
  const del2 = await cmd({ client: 'c1', cmd: 'delete', id: ids[1] });
  assert.deepStrictEqual(on('bank'), []);
  assert.deepStrictEqual(del2.removed.video, { title: 'Titel ' + V2 });
  assert.deepStrictEqual(Object.keys(node.libNow.lib.videos), [V1], 'verwaister videos-Eintrag weg');
  // restore: alte ID, videos zurück; vergebene ID → idtaken
  assert.deepStrictEqual(await cmd({ client: 'c1', cmd: 'restore', ...del2.removed }), { ok: true });
  assert.deepStrictEqual(node.libNow.lib.banks.map((b) => b.id), [ids[1], ids[2]]);
  assert.deepStrictEqual(node.libNow.lib.videos[V2], { title: 'Titel ' + V2 });
  assert.strictEqual((await cmd({ cmd: 'restore', ...del2.removed })).code, 'idtaken');
  // letzte Bank weg: libstate leer, kein bank
  await cmd({ cmd: 'delete', id: ids[1] });
  max.out = [];
  await cmd({ cmd: 'delete', id: ids[2] });
  assert.deepStrictEqual(on('libstate'), [['libstate', 0, 0, 'leer']]);
  assert.deepStrictEqual(on('bank'), []);
  await a.wait((ev, d2) => ev === 'lib' && d2.state === 'leer');
  done();
});

t('setstart, setstarts, swap, roll: neu schneiden, aktive Bank lädt danach; ohne WAV playonly', async () => {
  const { node, max, ids, on, cmd, done } = await setup();
  await cmd({ cmd: 'select', id: ids[0] });
  max.out = [];
  assert.deepStrictEqual(await cmd({ cmd: 'setstart', id: ids[0], pad: 3, ms: 12345 }), { ok: true });
  assert.deepStrictEqual(on('bank'), [], 'erst nach dem Schneiden');
  await until(() => on('bank').length, 'bank nach dem Schnitt');
  const b = bankArgs(on('bank')[0]);
  assert.deepStrictEqual([b.starts[3], b.lens[3]], [12345, 16000]);
  await sleep(700);
  assert.strictEqual(on('bank').length, 1, 'nur einmal laden');

  max.out = [];
  const r = await cmd({ cmd: 'roll', id: ids[0], pad: 0 });
  assert.ok(r.ok && Number.isInteger(r.ms) && r.ms >= 0 && r.ms <= DUR - 16000);
  assert.strictEqual(node.libNow.lib.banks[0].starts[0], r.ms);
  await until(() => on('bank').length, 'bank nach roll');

  // nicht aktive Bank ohne WAV: Starts setzen geht nicht, tauschen schon
  max.out = [];
  assert.deepStrictEqual(await cmd({ cmd: 'setstart', id: ids[1], pad: 0, ms: 5 }), { ok: false, code: 'playonly', text: 'Track fehlt – nur spielbar' });
  assert.strictEqual((await cmd({ cmd: 'roll', id: ids[1], pad: 0 })).code, 'playonly');
  const sw = STARTS.slice(); [sw[0], sw[5]] = [sw[5], sw[0]];
  assert.strictEqual((await cmd({ cmd: 'setstarts', id: ids[1], starts: STARTS.map((s) => s + 1) })).code, 'playonly');
  assert.deepStrictEqual(await cmd({ cmd: 'setstarts', id: ids[1], starts: sw }), { ok: true }, 'Undo eines Tauschs ohne WAV');
  assert.deepStrictEqual(await cmd({ cmd: 'swap', id: ids[1], a: 0, b: 5 }), { ok: true });
  assert.deepStrictEqual(node.libNow.lib.banks[1].starts, STARTS);
  assert.strictEqual((await cmd({ cmd: 'swap', id: ids[1], a: 0, b: 16 })).code, 'badreq');
  assert.strictEqual((await cmd({ cmd: 'setstart', id: ids[0], pad: 0, ms: -1 })).code, 'badreq');
  assert.strictEqual((await cmd({ cmd: 'setstarts', id: ids[0], starts: [1, 2] })).code, 'badreq');
  await sleep(700);
  assert.deepStrictEqual(on('bank'), [], 'nicht aktiv: kein bank');
  assert.ok(node.snipCurrent(node.libNow.lib.banks[1]), 'ohne WAV aus den alten Fächern zusammengesetzt');
  done();
});

t('tempo, tempook, bpmset: bpm an [js] nur für die aktive Bank, by device, notempo', async () => {
  const { node, max, ids, on, cmd, events, done } = await setup();
  const a = events();
  await cmd({ cmd: 'select', id: ids[0] });
  max.out = [];
  assert.deepStrictEqual(await cmd({ client: 'c1', cmd: 'tempo', video: V1, bpm: 99.94 }), { ok: true });
  assert.deepStrictEqual(on('bpm'), [['bpm', V1, 99.9]]);
  await a.wait((ev, d) => ev === 'beats' && d.confirmed && d.bpm === 99.9, 'beats mit bestätigtem Tempo');
  max.out = [];
  await cmd({ cmd: 'tempo', video: V2, bpm: 80 });
  assert.deepStrictEqual(on('bpm'), [], 'nicht aktiv');
  assert.strictEqual((await cmd({ cmd: 'tempo', video: V1, bpm: 20 })).code, 'badreq');
  assert.strictEqual((await cmd({ cmd: 'tempo', video: V3, bpm: 100 })).code, 'badreq');

  const ok = await cmd({ cmd: 'tempook', video: V1 });
  assert.ok(ok.ok && Math.abs(ok.bpm - 120) < 2, JSON.stringify(ok));
  assert.deepStrictEqual(on('bpm'), [['bpm', V1, ok.bpm]]);
  fs.writeFileSync(path.join(node.SNIP_DIR, `${V2}.chroma`), 'kaputt');
  fs.unlinkSync(path.join(node.CACHE, `${V2}.chroma`));
  assert.deepStrictEqual(await cmd({ cmd: 'tempook', video: V2 }), { ok: false, code: 'notempo', text: 'Kein Tempo erkannt' });

  max.out = [];
  max.handlers.bpmset(V1, 101.26);
  assert.strictEqual(node.libNow.lib.videos[V1].bpm, 101.3);
  await a.wait((ev, d) => ev === 'lib' && d.by === 'device' && d.videos[V1].bpm === 101.3);
  assert.deepStrictEqual(on('bpm'), [], 'kein bpm zurück');
  const rev = node.libNow.lib.rev;
  max.handlers.bpmset(V3, 100);
  assert.strictEqual(node.libNow.lib.rev, rev, 'unbekanntes Video: nichts');
  done();
});

t('hit/up → padhit/padup; bankstate → device; playing/playstop → play/stop; trackname → hello', async () => {
  const { max, ids, on, cmd, events, done } = await setup();
  const a = events();
  await a.wait((ev) => ev === 'cache');
  await cmd({ cmd: 'hit', pad: 4 });
  await cmd({ cmd: 'up', pad: 4 });
  assert.deepStrictEqual(max.out, [['padhit', 4], ['padup', 4]]);
  const w = Array.from({ length: 16 }, (_, i) => 1000 + i);
  max.handlers.bankstate(ids[2], V1, 5, 1, 1, ...STARTS, ...w);
  await a.wait((ev, d) => ev === 'device' && d.bankId === ids[2]);
  assert.deepStrictEqual(a.last('device'), { bankId: ids[2], video: V1, sel: 5, mode: 1, rev: 1, starts: STARTS, spans: w, nr: 3, teletext: null });
  await a.wait((ev, d) => ev === 'beats' && d.video === V1, 'beats der aktiven Bank');
  const n = a.of('device').length;
  max.handlers.bankstate(ids[2], V1, 5, 1, 1, ...STARTS, ...w);
  await sleep(80);
  assert.strictEqual(a.of('device').length, n, 'Gleiches nicht noch einmal');
  max.handlers.playing(5, 2000, 3500, 1500);
  max.handlers.playstop(5);
  await a.wait((ev) => ev === 'stop');
  assert.deepStrictEqual([a.last('play'), a.last('stop')], [{ pad: 5, from: 2000, to: 3500, dur: 1500 }, { pad: 5 }]);
  max.handlers.trackname('3', 'YT', 'Sampler');
  await a.wait((ev, d) => ev === 'hello' && d.track === '3 YT Sampler');
  done();
});

t('search: Treffer ohne Dauer fallen weg, long über 10 min, neue Suche bricht alte ab, Fehler', async () => {
  const { cmd, done } = await setup('300');
  const p1 = cmd({ cmd: 'search', q: 'alt' });
  await sleep(100);
  const p2 = cmd({ cmd: 'search', q: 'neu' });
  assert.deepStrictEqual(await p1, { ok: false, code: 'superseded', text: 'Neuere Suche läuft' });
  assert.deepStrictEqual(await p2, { ok: true, results: [{ id: 'SuchTreffer', title: 'neu, eins', dur: 200, long: false }, { id: 'LangerTrack', title: 'lang', dur: 3600, long: true }] });
  const f = await cmd({ cmd: 'search', q: 'FAIL' });
  assert.deepStrictEqual([f.code, f.text], ['searchfail', 'Suche fehlgeschlagen: ERROR: Suche kaputt']);
  assert.strictEqual((await cmd({ cmd: 'search' })).code, 'badreq');
  done();
});

t('newbank: {} sofort, job bis done mit bankId, Bank am Ende wird aktiv; fetch und fetchall', async () => {
  const { node, max, on, cmd, events, done } = await setup();
  const a = events();
  assert.deepStrictEqual(await cmd({ client: 'c1', cmd: 'newbank', video: V3 }), { ok: true });
  await a.wait((ev, d) => ev === 'job' && d.kind === 'newbank' && d.phase === 'done', 'newbank done');
  const j = a.of('job').filter((x) => x.kind === 'newbank').pop();
  assert.strictEqual(j.bankId, 4);
  assert.ok(a.of('job').some((x) => x.kind === 'newbank' && x.phase === 'download'));
  await until(() => on('bank').length, 'bank');
  const b = bankArgs(on('bank')[0]);
  assert.deepStrictEqual([b.id, b.nr, b.video], [4, 4, V3]);
  assert.deepStrictEqual(b.starts, b.starts.slice().sort((x, y) => x - y));
  assert.strictEqual(node.libNow.lib.banks[3].name, `Titel; ${V3}`);
  await a.wait((ev, d) => ev === 'lib' && d.banks.length === 4 && d.by === 'c1');
  assert.strictEqual((await cmd({ cmd: 'newbank', video: 'kurz' })).code, 'badreq');

  // gescheiterter Download: msg loadfail, fail im lib
  const F = 'FAILFAILFAI';
  await cmd({ cmd: 'newbank', video: F });
  await a.wait((ev, d) => ev === 'msg' && d.code === 'loadfail', 'loadfail');
  assert.strictEqual(a.of('msg').length, 1, 'nur eine Meldung');

  fs.unlinkSync(path.join(node.CACHE, `${V1}.wav`));
  assert.deepStrictEqual(await cmd({ cmd: 'fetchall' }), { ok: true, todo: 2 });
  await until(() => node.hasWav(V1) && node.hasWav(V2), 'fetchall');
  fs.unlinkSync(path.join(node.CACHE, `${V2}.wav`));
  assert.deepStrictEqual(await cmd({ cmd: 'fetch', video: V2 }), { ok: true });
  await a.wait((ev, d) => ev === 'job' && d.kind === 'fetch' && d.video === V2 && d.phase === 'done');
  await a.wait((ev, d) => ev === 'lib' && d.banks[1].wav === true, 'wav im lib, gleiche rev');
  assert.ok(a.of('cache').length >= 2, 'cache nach jedem Download');
  max.out = [];
  done();
});

t('kaputte Bibliothek: schreibend libbroken, hit/up gehen, [js] libstate kaputt; neuer → libnewer; Änderung von außen by extern', async () => {
  const { node, max, ids, on, cmd, events, done } = await setup();
  const a = events();
  await cmd({ cmd: 'select', id: ids[0] });
  fs.writeFileSync(node.LIB_FILE, '{kaputt');
  for (const c of [{ cmd: 'rename', id: ids[0], name: 'x' }, { cmd: 'setstart', id: ids[0], pad: 0, ms: 1 }, { cmd: 'tempo', video: V1, bpm: 100 }]) {
    assert.deepStrictEqual(await cmd(c), { ok: false, code: 'libbroken', text: 'Bibliothek kaputt – Speichern gesperrt' }, c.cmd);
  }
  assert.strictEqual((await cmd({ cmd: 'hit', pad: 0 })).ok, true);
  await a.wait((ev, d) => ev === 'lib' && d.state === 'kaputt', 'lib kaputt');
  await until(() => on('libstate').length, 'libstate an [js]');
  assert.match(a.last('lib').error, /^Bibliothek kaputt – Speichern gesperrt: /);
  assert.deepStrictEqual(a.last('lib').banks, []);
  assert.deepStrictEqual(on('libstate').pop(), ['libstate', 0, 0, 'kaputt']);
  assert.strictEqual((await cmd({ cmd: 'newbank', video: V3 })).code, 'libbroken');
  fs.writeFileSync(node.LIB_FILE, JSON.stringify({ format: 2 }));
  await a.wait((ev, d) => ev === 'lib' && d.state === 'neuer');
  assert.strictEqual((await cmd({ cmd: 'swap', id: ids[0], a: 0, b: 1 })).code, 'libnewer');
  max.out = [];
  max.handlers.bankopen(ids[0]);
  assert.deepStrictEqual(max.out, [], 'kaputt: weder bank noch bankgone');
  // wieder gültig, von außen geschrieben
  const lib = { format: 1, rev: 90, nextId: 9, banks: [{ id: 8, name: 'Fremd', video: V1, starts: STARTS }], videos: { [V1]: { title: 't' } } };
  fs.writeFileSync(node.LIB_FILE, JSON.stringify(lib));
  await a.wait((ev, d) => ev === 'lib' && d.rev === 90, 'extern');
  assert.deepStrictEqual([a.last('lib').by, a.last('lib').state], ['extern', 'ok']);
  assert.deepStrictEqual(on('libstate').pop(), ['libstate', 1, 0, 'ok']);
  done();
});

t('Teletext-Download gescheitert: loadfail an [js] statt status', async () => {
  const { max, on, done } = await setup();
  await max.handlers.load('FAILxxxxxxx');
  assert.deepStrictEqual(on('loadfail'), [['loadfail', 'FAILxxxxxxx', 'ERROR: Video unavailable']]);
  assert.ok(!on('status').some((m) => /Fehler/.test(m[1])));
  done();
});

t('session: libstate vor state, hello mit Session-Nummer', async () => {
  const { max, events, done } = await setup();
  const a = events();
  await a.wait((ev) => ev === 'cache');
  max.handlers.session(4711);
  const sel = max.out.map((m) => m[0]);
  assert.ok(sel.indexOf('libstate') >= 0 && sel.indexOf('libstate') < sel.indexOf('statenone'), sel.join());
  await a.wait((ev, d) => ev === 'hello' && d.session === 4711);
  done();
});

run();
