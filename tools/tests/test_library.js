// Bibliothek (Spec 2.2, 2.6): node tools/tests/test_library.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { tempHome, loadNode, t, run, sleep } = require('./harness');

const S = (k) => Array.from({ length: 16 }, (_, i) => k * 1000 + i);
const VALID = () => ({
  format: 1, rev: 3, nextId: 4,
  banks: [
    { id: 1, name: 'Funk', video: 'AAAAAAAAAAA', starts: S(1) },
    { id: 3, name: 'Soul', video: 'BBBBBBBBBBB', starts: S(3) },
  ],
  videos: { AAAAAAAAAAA: { title: 'A', bpm: 99.5 }, BBBBBBBBBBB: { title: 'B' } },
});
function home(lib) {
  const h = tempHome(false);
  if (lib !== undefined) {
    fs.mkdirSync(path.join(h, 'Music', 'YTSampler'), { recursive: true });
    fs.writeFileSync(path.join(h, 'Music', 'YTSampler', 'library.json'), typeof lib === 'string' ? lib : JSON.stringify(lib));
  }
  return h;
}
const readLib = (node) => JSON.parse(fs.readFileSync(node.LIB_FILE, 'utf8'));
const throwsCode = (fn, code) => assert.throws(fn, (e) => e.code === code && typeof e.text === 'string');

t('fehlende Datei = leere Bibliothek, entsteht beim ersten Schreiben', () => {
  const { node } = loadNode(home());
  assert.deepStrictEqual(node.libNow.lib, { format: 1, rev: 0, nextId: 1, banks: [], videos: {} });
  assert.strictEqual(node.libNow.state, 'leer');
  assert.ok(!fs.existsSync(node.LIB_FILE));
  assert.deepStrictEqual(node.libChange('create', { video: 'AAAAAAAAAAA', title: 'Titel', starts: S(0) }, 'c1'), { id: 1 });
  const lib = readLib(node);
  assert.strictEqual(lib.rev, 1); assert.strictEqual(lib.nextId, 2);
  assert.deepStrictEqual(lib.banks[0], { id: 1, name: 'Titel', video: 'AAAAAAAAAAA', starts: S(0) });
  assert.strictEqual(fs.readFileSync(node.LIB_FILE, 'utf8'), JSON.stringify(lib, null, 1));
  assert.ok(!fs.existsSync(node.LIB_LOCK) && !fs.existsSync(node.LIB_FILE + '.tmp'));
});

t('gültige Datei wird gelesen', () => {
  const { node } = loadNode(home(VALID()));
  assert.strictEqual(node.libNow.state, 'ok');
  assert.deepStrictEqual(node.libNow.lib, VALID());
});

// jede Kaputt-Regel: Zustand kaputt, Schreiben libbroken, Datei unberührt
const BROKEN = {
  'kein JSON': '{"format": 1,',
  'kein Objekt': '[1]',
  'format fehlt': (l) => { delete l.format; },
  'format 0': (l) => { l.format = 0; },
  'format als String': (l) => { l.format = '1'; },
  'rev fehlt': (l) => { delete l.rev; },
  'nextId fehlt': (l) => { delete l.nextId; },
  'nextId 0': (l) => { l.nextId = 0; },
  'banks kein Array': (l) => { l.banks = {}; },
  'videos fehlt': (l) => { delete l.videos; },
  'Bank ohne id': (l) => { delete l.banks[0].id; },
  'id als String': (l) => { l.banks[0].id = '1'; },
  'id doppelt': (l) => { l.banks[1].id = 1; },
  'id = nextId': (l) => { l.banks[1].id = 4; },
  'name fehlt': (l) => { delete l.banks[0].name; },
  'video fehlt in videos': (l) => { l.banks[0].video = 'CCCCCCCCCCC'; },
  'starts 15': (l) => { l.banks[0].starts.pop(); },
  'starts 17': (l) => { l.banks[0].starts.push(5); },
  'start negativ': (l) => { l.banks[0].starts[3] = -1; },
  'start als String': (l) => { l.banks[0].starts[3] = '7'; },
  'start nicht ganz': (l) => { l.banks[0].starts[3] = 1.5; },
  'title fehlt': (l) => { delete l.videos.BBBBBBBBBBB.title; },
  'bpm als String': (l) => { l.videos.AAAAAAAAAAA.bpm = '99'; },
};
for (const [name, br] of Object.entries(BROKEN)) {
  t('kaputt: ' + name, () => {
    let text = br;
    if (typeof br === 'function') { const l = VALID(); br(l); text = JSON.stringify(l); }
    const { node } = loadNode(home(text));
    assert.strictEqual(node.libNow.state, 'kaputt');
    assert.ok(node.libNow.error);
    throwsCode(() => node.libChange('rename', { id: 1, name: 'x' }, 'c'), 'libbroken');
    assert.strictEqual(fs.readFileSync(node.LIB_FILE, 'utf8'), text);
    assert.ok(!fs.existsSync(node.LIB_LOCK));
  });
}

t('kaputt: iCloud-Platzhalter statt Datei', () => {
  const h = home();
  fs.mkdirSync(path.join(h, 'Music', 'YTSampler'), { recursive: true });
  fs.writeFileSync(path.join(h, 'Music', 'YTSampler', '.library.json.icloud'), '');
  const { node } = loadNode(h);
  assert.strictEqual(node.libNow.state, 'kaputt');
  throwsCode(() => node.libChange('create', { video: 'AAAAAAAAAAA', title: 'x', starts: S(0) }), 'libbroken');
  assert.ok(!fs.existsSync(node.LIB_FILE));
});

t('neuer: format 2', () => {
  const text = JSON.stringify({ format: 2, whatever: true });
  const { node } = loadNode(home(text));
  assert.strictEqual(node.libNow.state, 'neuer');
  throwsCode(() => node.libChange('rename', { id: 1, name: 'x' }), 'libnewer');
  assert.strictEqual(fs.readFileSync(node.LIB_FILE, 'utf8'), text);
});

t('unbekannte Felder bleiben erhalten', () => {
  const l = VALID();
  l.extra = { a: [1, 2] }; l.banks[0].color = 'rot'; l.videos.AAAAAAAAAAA.note = 'x';
  const { node } = loadNode(home(l));
  node.libChange('rename', { id: 1, name: '  Neu  ' });
  node.libChange('duplicate', { id: 1 });
  const r = readLib(node);
  assert.deepStrictEqual(r.extra, { a: [1, 2] });
  assert.strictEqual(r.banks[0].color, 'rot');
  assert.strictEqual(r.banks[0].name, 'Neu');
  assert.strictEqual(r.banks[1].color, 'rot');
  assert.strictEqual(r.videos.AAAAAAAAAAA.note, 'x');
});

t('Vorgänge: rename, duplicate, move, setstart, setstarts, swap, tempo', () => {
  const { node } = loadNode(home(VALID()));
  node.libChange('rename', { id: 3, name: 'x'.repeat(150) });
  assert.strictEqual(readLib(node).banks[1].name.length, 100);
  assert.deepStrictEqual(node.libChange('duplicate', { id: 1 }), { id: 4 });
  let r = readLib(node);
  assert.deepStrictEqual(r.banks.map((b) => b.id), [1, 4, 3]);
  assert.strictEqual(r.banks[1].name, 'Funk (Kopie)');
  assert.strictEqual(r.nextId, 5);
  node.libChange('move', { id: 3, to: 1 });
  assert.deepStrictEqual(readLib(node).banks.map((b) => b.id), [3, 1, 4]);
  node.libChange('move', { id: 3, to: 3 });
  assert.deepStrictEqual(readLib(node).banks.map((b) => b.id), [1, 4, 3]);
  node.libChange('setstart', { id: 4, pad: 15, ms: 777 });
  assert.strictEqual(readLib(node).banks[1].starts[15], 777);
  assert.strictEqual(readLib(node).banks[0].starts[15], 1015);
  node.libChange('setstarts', { id: 4, starts: S(9) });
  assert.deepStrictEqual(readLib(node).banks[1].starts, S(9));
  node.libChange('swap', { id: 4, a: 0, b: 5 });
  r = readLib(node);
  assert.strictEqual(r.banks[1].starts[0], 9005); assert.strictEqual(r.banks[1].starts[5], 9000);
  assert.deepStrictEqual(node.libChange('tempo', { video: 'BBBBBBBBBBB', bpm: 120.04 }), { bpm: 120 });
  assert.strictEqual(readLib(node).videos.BBBBBBBBBBB.bpm, 120);
  assert.strictEqual(readLib(node).rev, 3 + 8);
});

t('Fehlercodes: nobank, badreq; Datei bleibt dann gleich', () => {
  const { node } = loadNode(home(VALID()));
  const before = fs.readFileSync(node.LIB_FILE, 'utf8');
  throwsCode(() => node.libChange('rename', { id: 2, name: 'x' }), 'nobank');
  throwsCode(() => node.libChange('delete', { id: 99 }), 'nobank');
  for (const [op, a] of [
    ['rename', { id: 1 }], ['rename', { id: '1', name: 'x' }],
    ['setstart', { id: 1, pad: 16, ms: 0 }], ['setstart', { id: 1, pad: 0, ms: -1 }], ['setstart', { id: 1, pad: 0, ms: 1.5 }],
    ['setstarts', { id: 1, starts: S(0).slice(1) }], ['swap', { id: 1, a: 0, b: -1 }],
    ['move', { id: 1, to: 0 }], ['move', { id: 1, to: 3 }],
    ['tempo', { video: 'AAAAAAAAAAA', bpm: 29 }], ['tempo', { video: 'AAAAAAAAAAA', bpm: 301 }], ['tempo', { video: 'CCCCCCCCCCC', bpm: 100 }],
    ['create', { video: 'X', title: 'x', starts: [1] }], ['gibtsnicht', {}],
  ]) throwsCode(() => node.libChange(op, a), 'badreq');
  assert.strictEqual(fs.readFileSync(node.LIB_FILE, 'utf8'), before);
});

t('nextId, delete samt videos, restore, idtaken', () => {
  const { node } = loadNode(home(VALID()));
  const { removed } = node.libChange('delete', { id: 1 });
  assert.deepStrictEqual(removed, { bank: VALID().banks[0], at: 1, video: { title: 'A', bpm: 99.5 } });
  let r = readLib(node);
  assert.ok(!('AAAAAAAAAAA' in r.videos), 'letzte Bank des Videos weg -> Eintrag weg');
  assert.strictEqual(r.nextId, 4);
  assert.deepStrictEqual(node.libChange('create', { video: 'AAAAAAAAAAA', title: 'A neu', starts: S(5) }), { id: 4 });
  assert.ok(!('bpm' in readLib(node).videos.AAAAAAAAAAA), 'bpm ist mit dem Eintrag gelöscht');
  node.libChange('delete', { id: 4 });
  node.libChange('restore', removed);
  r = readLib(node);
  assert.deepStrictEqual(r.banks.map((b) => b.id), [1, 3]);
  assert.deepStrictEqual(r.videos.AAAAAAAAAAA, { title: 'A', bpm: 99.5 });
  assert.strictEqual(r.nextId, 5);
  throwsCode(() => node.libChange('restore', removed), 'idtaken');
  throwsCode(() => node.libChange('restore', { ...removed, bank: { ...removed.bank, id: 5 } }), 'idtaken');
  // restore mit vorhandenem Video lässt dessen Eintrag stehen; at hinter dem Ende hängt an
  node.libChange('restore', { bank: { id: 2, name: 'Zwei', video: 'BBBBBBBBBBB', starts: S(2) }, at: 99, video: { title: 'anders', bpm: 50 } });
  r = readLib(node);
  assert.deepStrictEqual(r.banks.map((b) => b.id), [1, 3, 2]);
  assert.deepStrictEqual(r.videos.BBBBBBBBBBB, { title: 'B' });
});

t('verwaiste videos fallen beim nächsten Schreiben weg', () => {
  const l = VALID(); l.videos.ZZZZZZZZZZZ = { title: 'weg' };
  const { node } = loadNode(home(l));
  assert.strictEqual(node.libNow.state, 'ok');
  node.libChange('rename', { id: 1, name: 'x' });
  assert.ok(!('ZZZZZZZZZZZ' in readLib(node).videos));
});

t('Sperre: tote PID wird übernommen, alte Datei auch, lebendige -> libbusy', () => {
  const { node } = loadNode(home(VALID()));
  fs.writeFileSync(node.LIB_LOCK, '999999');   // macOS-PIDs gehen nicht so hoch
  node.libChange('rename', { id: 1, name: 'tot' });
  assert.ok(!fs.existsSync(node.LIB_LOCK));
  fs.writeFileSync(node.LIB_LOCK, String(process.ppid));
  const t0 = Date.now();
  throwsCode(() => node.libChange('rename', { id: 1, name: 'busy' }), 'libbusy');
  assert.ok(Date.now() - t0 >= 1000);
  assert.strictEqual(fs.readFileSync(node.LIB_LOCK, 'utf8'), String(process.ppid), 'fremde Sperre bleibt');
  fs.writeFileSync(node.LIB_LOCK, '');   // leer = wird gerade geschrieben
  throwsCode(() => node.libChange('rename', { id: 1, name: 'busy' }), 'libbusy');
  const old = (Date.now() - 6000) / 1000;
  fs.writeFileSync(node.LIB_LOCK, String(process.ppid));
  fs.utimesSync(node.LIB_LOCK, old, old);
  node.libChange('rename', { id: 1, name: 'alt' });
  assert.strictEqual(readLib(node).banks[0].name, 'alt');
});

t('zwei Prozesse schreiben gleichzeitig, nichts geht verloren', async () => {
  const h = home(VALID());
  const N = 60;
  const child = (tag) => new Promise((resolve) => {
    const code = `
      const { loadNode } = require(${JSON.stringify(path.join(__dirname, 'harness.js'))});
      const { node } = loadNode(${JSON.stringify(h)});
      let ok = 0;
      for (let i = 0; i < ${N}; i++) { node.libChange('create', { video: '${tag}', title: '${tag}', name: '${tag}' + i, starts: Array(16).fill(i) }); ok++; }
      console.log(ok); process.exit(0);`;
    const p = spawn(process.execPath, ['-e', code]);
    let out = '', err = '';
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', (d) => { err += d; });
    p.on('close', (c) => resolve({ c, out: out.trim(), err }));
  });
  const res = await Promise.all([child('P1PPPPPPPPP'), child('P2PPPPPPPPP')]);
  for (const r of res) assert.strictEqual(r.out, String(N), r.err);
  const { node } = loadNode(h);
  const lib = node.libNow.lib;
  assert.strictEqual(lib.rev, 3 + 2 * N);
  assert.strictEqual(lib.nextId, 4 + 2 * N);
  assert.strictEqual(new Set(lib.banks.map((b) => b.id)).size, 2 + 2 * N);
  for (const tag of ['P1PPPPPPPPP', 'P2PPPPPPPPP']) {
    assert.deepStrictEqual(lib.banks.filter((b) => b.video === tag).map((b) => b.name), Array.from({ length: N }, (_, i) => tag + i));
  }
});

t('watchFile: Änderung von außen kommt als extern, eigene nicht doppelt', async () => {
  const { node } = loadNode(home(VALID()));
  const ev = [];
  node.libEvents.on('change', (now, by) => ev.push([by, now.state, now.lib && now.lib.rev]));
  node.libChange('rename', { id: 1, name: 'x' }, 'client42');
  await sleep(1300);
  assert.deepStrictEqual(ev, [['client42', 'ok', 4]]);
  const l = readLib(node); l.rev = 10; l.banks[0].name = 'Finder';
  fs.writeFileSync(node.LIB_FILE, JSON.stringify(l));
  await sleep(1300);
  assert.deepStrictEqual(ev[1], ['extern', 'ok', 10]);
  assert.strictEqual(node.libNow.lib.banks[0].name, 'Finder');
  fs.writeFileSync(node.LIB_FILE, '{kaputt');
  await sleep(1300);
  assert.deepStrictEqual(ev[2], ['extern', 'kaputt', null]);
  fs.writeFileSync(node.LIB_FILE, JSON.stringify(l));
  await sleep(1300);
  assert.deepStrictEqual(ev[3], ['extern', 'ok', 10], 'wieder gültig -> geht wieder');
  assert.strictEqual(ev.length, 4);
});

t('Sicherung: beim Start, nur bei Änderung, 10 bleiben, nie kaputte', () => {
  const h = home(VALID());
  let { node } = loadNode(h);
  const list = () => fs.readdirSync(node.BACKUP_DIR).sort();
  assert.strictEqual(list().length, 1);
  assert.match(list()[0], /^bibliothek-\d{4}-\d\d-\d\d-\d{6}\.json$/);
  assert.strictEqual(fs.readFileSync(path.join(node.BACKUP_DIR, list()[0]), 'utf8'), fs.readFileSync(node.LIB_FILE, 'utf8'));
  ({ node } = loadNode(h));
  assert.strictEqual(list().length, 1, 'gleicher Stand -> keine neue Sicherung');
  for (let i = 0; i < 12; i++) fs.writeFileSync(path.join(node.BACKUP_DIR, `bibliothek-2020-01-${String(i + 10)}-120000.json`), '{}');
  fs.writeFileSync(path.join(node.BACKUP_DIR, 'notiz.txt'), 'bleibt');
  ({ node } = loadNode(h));
  const names = list().filter((n) => n.startsWith('bibliothek-'));
  assert.strictEqual(names.length, 10);
  assert.ok(!names.includes('bibliothek-2020-01-10-120000.json') && names.includes('bibliothek-2020-01-21-120000.json'));
  assert.strictEqual(fs.readFileSync(path.join(node.BACKUP_DIR, names[9]), 'utf8'), fs.readFileSync(node.LIB_FILE, 'utf8'));
  assert.ok(list().includes('notiz.txt'));
  fs.writeFileSync(node.LIB_FILE, '{kaputt');
  const before = list();
  ({ node } = loadNode(h));
  assert.deepStrictEqual(list(), before, 'kaputte Datei wird nicht gesichert');
  const h2 = home();
  ({ node } = loadNode(h2));
  assert.ok(!fs.existsSync(node.BACKUP_DIR) || list().length === 0, 'ohne Datei keine Sicherung');
});

run();
