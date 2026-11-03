// Bibliothek (Spec 2.2, 2.6; Mix-Spec 2.1 format 2): node tools/tests/test_library.js
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
// format 1 im Speicher als format 2
const PADS = (v, k) => S(k).map((start) => ({ video: v, start }));
const VALID2 = () => ({
  format: 2, rev: 3, nextId: 4,
  banks: [
    { id: 1, name: 'Funk', pads: PADS('AAAAAAAAAAA', 1) },
    { id: 3, name: 'Soul', pads: PADS('BBBBBBBBBBB', 3) },
  ],
  videos: { AAAAAAAAAAA: { title: 'A', bpm: 99.5 }, BBBBBBBBBBB: { title: 'B' } },
});
const starts = (b) => b.pads.map((p) => p && p.start);
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
  assert.deepStrictEqual(node.libNow.lib, { format: 2, rev: 0, nextId: 1, banks: [], videos: {} });
  assert.strictEqual(node.libNow.state, 'leer');
  assert.ok(!fs.existsSync(node.LIB_FILE));
  assert.deepStrictEqual(node.libChange('create', { video: 'AAAAAAAAAAA', title: 'Titel', starts: S(0) }, 'c1'), { id: 1 });
  const lib = readLib(node);
  assert.strictEqual(lib.rev, 1); assert.strictEqual(lib.nextId, 2);
  assert.strictEqual(lib.format, 2);
  assert.deepStrictEqual(lib.banks[0], { id: 1, name: 'Titel', pads: PADS('AAAAAAAAAAA', 0) });
  assert.strictEqual(fs.readFileSync(node.LIB_FILE, 'utf8'), JSON.stringify(lib, null, 1));
  assert.ok(!fs.existsSync(node.LIB_LOCK) && !fs.existsSync(node.LIB_FILE + '.tmp'));
});

t('format 1 wird im Speicher format 2, beim nächsten Schreiben auf der Platte; Sicherung hält format 1', () => {
  const { node } = loadNode(home(VALID()));
  assert.strictEqual(node.libNow.state, 'ok');
  assert.deepStrictEqual(node.libNow.lib, VALID2());
  assert.strictEqual(JSON.parse(fs.readFileSync(node.LIB_FILE, 'utf8')).format, 1, 'Lesen schreibt nicht');
  const bk = fs.readdirSync(node.BACKUP_DIR);
  assert.strictEqual(JSON.parse(fs.readFileSync(path.join(node.BACKUP_DIR, bk[0]), 'utf8')).format, 1);
  node.libChange('rename', { id: 3, name: 'Soul' });
  assert.deepStrictEqual(readLib(node), { ...VALID2(), rev: 4 });
});

t('format 2 gültig: gemischte Videos, leere Plätze, 16 × null, unbekannte Pad-Felder', () => {
  const l = VALID2();
  l.banks[0].pads[2] = { video: 'BBBBBBBBBBB', start: 0, farbe: 'rot' };
  l.banks[0].pads[5] = null;
  l.banks.push({ id: 2, name: 'Leer', pads: Array(16).fill(null) });
  const { node } = loadNode(home(l));
  assert.strictEqual(node.libNow.state, 'ok');
  assert.deepStrictEqual(node.libNow.lib, l);
  node.libChange('setstart', { id: 1, pad: 2, ms: 9 });
  assert.deepStrictEqual(readLib(node).banks[0].pads[2], { video: 'BBBBBBBBBBB', start: 9, farbe: 'rot' });
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
// format 2 (Mix-Spec 2.1)
const BROKEN2 = {
  'f2: pads fehlt': (l) => { delete l.banks[0].pads; },
  'f2: 15 Pads': (l) => { l.banks[0].pads.pop(); },
  'f2: 17 Pads': (l) => { l.banks[0].pads.push(null); },
  'f2: Pad mit fremdem Video': (l) => { l.banks[0].pads[4].video = 'CCCCCCCCCCC'; },
  'f2: Pad ohne video': (l) => { delete l.banks[0].pads[4].video; },
  'f2: start negativ': (l) => { l.banks[0].pads[4].start = -1; },
  'f2: start nicht ganz': (l) => { l.banks[0].pads[4].start = 2.5; },
  'f2: Pad als Zahl': (l) => { l.banks[0].pads[4] = 7; },
  'f2: alte Felder statt pads': (l) => { l.banks[0] = { id: 1, name: 'x', video: 'AAAAAAAAAAA', starts: S(1) }; },
};
for (const [name, br] of Object.entries({ ...BROKEN, ...BROKEN2 })) {
  t('kaputt: ' + name, () => {
    let text = br;
    if (typeof br === 'function') { const l = name.startsWith('f2:') ? VALID2() : VALID(); br(l); text = JSON.stringify(l); }
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

t('neuer: format 3', () => {
  const text = JSON.stringify({ format: 3, whatever: true });
  const { node } = loadNode(home(text));
  assert.strictEqual(node.libNow.state, 'neuer');
  throwsCode(() => node.libChange('rename', { id: 1, name: 'x' }), 'libnewer');
  throwsCode(() => node.libChange('newmix', {}), 'libnewer');
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
  assert.strictEqual(r.banks[1].stage, false, 'Kopie landet in der Ablage');
  assert.strictEqual(r.nextId, 5);
  // move: Platz innerhalb des eigenen Bereichs (Bühne 1, 3; Ablage 4)
  assert.deepStrictEqual(node.libChange('move', { id: 3, to: 1 }), { at: 1 });
  assert.deepStrictEqual(readLib(node).banks.map((b) => b.id), [3, 1, 4]);
  node.libChange('move', { id: 3, to: 2 });
  assert.deepStrictEqual(readLib(node).banks.map((b) => b.id), [1, 3, 4]);
  throwsCode(() => node.libChange('move', { id: 3, to: 3 }), 'badreq');
  node.libChange('setstart', { id: 4, pad: 15, ms: 777 });
  assert.strictEqual(readLib(node).banks[2].pads[15].start, 777);
  assert.strictEqual(readLib(node).banks[0].pads[15].start, 1015);
  node.libChange('setstarts', { id: 4, starts: S(9) });
  assert.deepStrictEqual(starts(readLib(node).banks[2]), S(9));
  node.libChange('swap', { id: 4, a: 0, b: 5 });
  r = readLib(node);
  assert.strictEqual(r.banks[2].pads[0].start, 9005); assert.strictEqual(r.banks[2].pads[5].start, 9000);
  assert.deepStrictEqual(node.libChange('tempo', { video: 'BBBBBBBBBBB', bpm: 120.04 }), { bpm: 120 });
  assert.strictEqual(readLib(node).videos.BBBBBBBBBBB.bpm, 120);
  assert.strictEqual(readLib(node).rev, 3 + 8);
});

t('stage: Bühne/Ablage umschalten, at im Bereich, fehlendes Feld = Bühne, Undo-Weg zurück', () => {
  const { node } = loadNode(home(VALID()));   // Bänke 1, 3 ohne stage -> Bühne
  const ids = () => readLib(node).banks.map((b) => b.id + (b.stage === false ? 'a' : ''));
  node.libChange('newmix', {});              // 4 in die Ablage
  node.libChange('newmix', {});              // 5
  assert.deepStrictEqual(ids(), ['1', '3', '4a', '5a']);
  assert.deepStrictEqual(node.libChange('stage', { id: 5, on: true }), { at: 3 });   // ans Ende der Bühne
  assert.deepStrictEqual(ids(), ['1', '3', '5', '4a']);
  assert.ok(!('stage' in readLib(node).banks[2]), 'Bühne: Feld fällt weg');
  assert.deepStrictEqual(node.libChange('stage', { id: 4, on: true, at: 1 }), { at: 1 });
  assert.deepStrictEqual(ids(), ['4', '1', '3', '5']);
  assert.deepStrictEqual(node.libChange('stage', { id: 1, on: false }), { at: 1 });   // Ablage war leer
  assert.deepStrictEqual(ids(), ['4', '3', '5', '1a']);
  node.libChange('stage', { id: 3, on: false, at: 1 });
  assert.deepStrictEqual(ids(), ['4', '5', '3a', '1a']);
  node.libChange('stage', { id: 4, on: false, at: 99 });   // hinter dem Ende: ans Ende
  node.libChange('stage', { id: 5, on: false });
  assert.deepStrictEqual(ids(), ['3a', '1a', '4a', '5a']);
  node.libChange('stage', { id: 1, on: true, at: 5 });     // Bühne leer: an den Anfang
  assert.deepStrictEqual(ids(), ['1', '3a', '4a', '5a']);
  node.libChange('move', { id: 5, to: 1 });                 // move bleibt im Bereich
  assert.deepStrictEqual(ids(), ['1', '5a', '3a', '4a']);
  for (const a of [{ id: 1, on: 1 }, { id: 1 }, { id: 1, on: true, at: 0 }, { id: 1, on: true, at: 1.5 }]) throwsCode(() => node.libChange('stage', a), 'badreq');
  throwsCode(() => node.libChange('stage', { id: 99, on: true }), 'nobank');
  // delete/restore: Ablage-Bank kommt in die Ablage zurück
  const { removed } = node.libChange('delete', { id: 3 });
  assert.strictEqual(removed.bank.stage, false);
  node.libChange('restore', removed);
  assert.deepStrictEqual(ids(), ['1', '5a', '3a', '4a']);
  // stage ist ein unbekanntes Feld für ältere Versionen: format bleibt 2
  assert.strictEqual(readLib(node).format, 2);
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
    ['setpad', { id: 1, pad: 16, video: null }], ['setpad', { id: 1, pad: 0, video: 'AAAAAAAAAAA', start: -1 }],
    ['setpad', { id: 1, pad: 0, video: 'CCCCCCCCCCC', start: 0 }], ['setpad', { id: 1, pad: 0, video: 'CCCCCCCCCCC', start: 0, info: { bpm: 3 } }],
    ['restore', { bank: { id: 2, name: 'x', pads: PADS('CCCCCCCCCCC', 0) }, at: 1, videos: {} }],
    ['restore', { bank: { id: 2, name: 'x', pads: PADS('AAAAAAAAAAA', 0).slice(1) }, at: 1 }],
  ]) throwsCode(() => node.libChange(op, a), 'badreq');
  assert.strictEqual(fs.readFileSync(node.LIB_FILE, 'utf8'), before);
});

t('nextId, delete samt videos, restore, idtaken', () => {
  const { node } = loadNode(home(VALID()));
  const { removed } = node.libChange('delete', { id: 1 });
  assert.deepStrictEqual(removed, { bank: VALID2().banks[0], at: 1, videos: { AAAAAAAAAAA: { title: 'A', bpm: 99.5 } } });
  let r = readLib(node);
  assert.ok('AAAAAAAAAAA' in r.videos, 'letzte Bank des Videos weg -> Eintrag bleibt bis zum Start');
  assert.strictEqual(r.nextId, 4);
  assert.deepStrictEqual(node.libChange('create', { video: 'AAAAAAAAAAA', title: 'A neu', starts: S(5) }), { id: 4 });
  assert.strictEqual(readLib(node).videos.AAAAAAAAAAA.bpm, 99.5, 'Eintrag blieb samt bpm');
  node.libChange('delete', { id: 4 });
  node.libChange('restore', removed);
  r = readLib(node);
  assert.deepStrictEqual(r.banks.map((b) => b.id), [1, 3]);
  assert.deepStrictEqual(r.videos.AAAAAAAAAAA, { title: 'A', bpm: 99.5 });
  assert.strictEqual(r.nextId, 5);
  throwsCode(() => node.libChange('restore', removed), 'idtaken');
  throwsCode(() => node.libChange('restore', { ...removed, bank: { ...removed.bank, id: 5 } }), 'idtaken');
  // restore mit vorhandenem Video lässt dessen Eintrag stehen; at hinter dem Ende hängt an
  node.libChange('restore', { bank: { id: 2, name: 'Zwei', pads: PADS('BBBBBBBBBBB', 2) }, at: 99, videos: { BBBBBBBBBBB: { title: 'anders', bpm: 50 } } });
  r = readLib(node);
  assert.deepStrictEqual(r.banks.map((b) => b.id), [1, 3, 2]);
  assert.deepStrictEqual(r.videos.BBBBBBBBBBB, { title: 'B' });
});

t('newmix, setpad (mit info, null), Leeres: setstart badreq, setstarts/swap; delete/restore mit mehreren Videos; dropOrphans über Pads', () => {
  const { node } = loadNode(home(VALID()));
  assert.deepStrictEqual(node.libChange('newmix', {}), { id: 4 });
  let r = readLib(node);
  assert.deepStrictEqual(r.banks[2], { id: 4, name: 'Neue Bank', pads: Array(16).fill(null), stage: false });
  node.libChange('setpad', { id: 4, pad: 0, video: 'AAAAAAAAAAA', start: 1000 });
  node.libChange('setpad', { id: 4, pad: 1, video: 'CCCCCCCCCCC', start: 500, info: { title: 'C', bpm: 88 } });
  r = readLib(node);
  assert.deepStrictEqual(r.banks[2].pads.slice(0, 3), [{ video: 'AAAAAAAAAAA', start: 1000 }, { video: 'CCCCCCCCCCC', start: 500 }, null]);
  assert.deepStrictEqual(r.videos.CCCCCCCCCCC, { title: 'C', bpm: 88 });
  // vorhandenes Video: info wird ignoriert
  node.libChange('setpad', { id: 4, pad: 2, video: 'AAAAAAAAAAA', start: 7, info: { title: 'anders' } });
  assert.strictEqual(readLib(node).videos.AAAAAAAAAAA.title, 'A');
  throwsCode(() => node.libChange('setstart', { id: 4, pad: 5, ms: 1 }), 'badreq');
  node.libChange('setstarts', { id: 4, starts: S(2) });
  assert.deepStrictEqual(starts(readLib(node).banks[2]).slice(0, 4), [2000, 2001, 2002, null]);
  node.libChange('swap', { id: 4, a: 0, b: 5 });
  assert.deepStrictEqual([readLib(node).banks[2].pads[0], readLib(node).banks[2].pads[5]], [null, { video: 'AAAAAAAAAAA', start: 2000 }]);
  // Platz leeren: letztes Pad von C weg -> videos-Eintrag bleibt bis zum Start
  node.libChange('setpad', { id: 4, pad: 1, video: null });
  r = readLib(node);
  assert.strictEqual(r.banks[2].pads[1], null);
  assert.ok('CCCCCCCCCCC' in r.videos);
  node.libChange('setpad', { id: 4, pad: 1, video: 'CCCCCCCCCCC', start: 500, info: { title: 'C', bpm: 88 } });
  node.libChange('setpad', { id: 4, pad: 3, video: 'BBBBBBBBBBB', start: 1 });
  // delete der Mix-Bank: videos aller Pads, restore bringt die fehlenden zurück
  node.libChange('delete', { id: 3 });
  const { removed } = node.libChange('delete', { id: 4 });
  assert.deepStrictEqual(removed.videos, { AAAAAAAAAAA: { title: 'A', bpm: 99.5 }, CCCCCCCCCCC: { title: 'C', bpm: 88 }, BBBBBBBBBBB: { title: 'B' } });
  assert.deepStrictEqual(Object.keys(readLib(node).videos).sort(), ['AAAAAAAAAAA', 'BBBBBBBBBBB', 'CCCCCCCCCCC'], 'bis zum Start');
  const n2 = loadNode(process.env.HOME).node;   // Start räumt verwaiste Einträge auf
  assert.deepStrictEqual(Object.keys(readLib(n2).videos), ['AAAAAAAAAAA']);
  throwsCode(() => n2.libChange('restore', { ...removed, videos: { CCCCCCCCCCC: { title: 'C' } } }), 'badreq');
  n2.libChange('restore', removed);
  r = readLib(node);
  assert.deepStrictEqual(r.banks[1], removed.bank);
  assert.deepStrictEqual(r.videos, { AAAAAAAAAAA: { title: 'A', bpm: 99.5 }, CCCCCCCCCCC: { title: 'C', bpm: 88 }, BBBBBBBBBBB: { title: 'B' } });
  // 16 × null gültig und schreibbar
  node.libChange('newmix', {});
  assert.strictEqual(loadNode(process.env.HOME).node.libNow.state, 'ok');
});

t('verwaiste videos fallen beim Start weg, nicht beim Schreiben', () => {
  const l = VALID(); l.videos.ZZZZZZZZZZZ = { title: 'weg' };
  const { node } = loadNode(home(l));
  assert.strictEqual(node.libNow.state, 'ok');
  assert.ok(!('ZZZZZZZZZZZ' in readLib(node).videos));
  node.libChange('setpad', { id: 1, pad: 0, video: 'YYYYYYYYYYY', start: 1, info: { title: 'y' } });
  node.libChange('setpad', { id: 1, pad: 0, video: null });
  assert.ok('YYYYYYYYYYY' in readLib(node).videos);
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
    assert.deepStrictEqual(lib.banks.filter((b) => b.pads[0].video === tag).map((b) => b.name), Array.from({ length: N }, (_, i) => tag + i));
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

t('Trim pro Pad (Nachtrag 14): format bleibt 2, in der Datei, wandert mit duplicate/swap/delete/restore, 0 löscht', () => {
  const { node } = loadNode(home(VALID2()));
  node.libChange('trim', { id: 1, pad: 2, trim: 3.04 }, 'test');
  let f = readLib(node);
  assert.strictEqual(f.format, 2);
  assert.deepStrictEqual(f.banks[0].pads[2], { video: 'AAAAAAAAAAA', start: 1002, trim: 3 }, 'auf 0,1 dB gerundet');
  const { id } = node.libChange('duplicate', { id: 1 }, 'test');
  assert.strictEqual(node.libNow.lib.banks.find((b) => b.id === id).pads[2].trim, 3);
  node.libChange('swap', { id: 1, a: 2, b: 9 }, 'test');
  assert.deepStrictEqual([node.libNow.lib.banks[0].pads[9].trim, 'trim' in node.libNow.lib.banks[0].pads[2]], [3, false]);
  const { removed } = node.libChange('delete', { id: 1 }, 'test');
  node.libChange('restore', removed, 'test');
  assert.strictEqual(node.libNow.lib.banks[0].pads[9].trim, 3);
  node.libChange('setpad', { id: 3, pad: 0, video: 'AAAAAAAAAAA', start: 5, trim: -1.5 }, 'test');
  assert.deepStrictEqual(readLib(node).banks.find((b) => b.id === 3).pads[0], { video: 'AAAAAAAAAAA', start: 5, trim: -1.5 });
  node.libChange('trim', { id: 1, pad: 9, trim: 0 }, 'test');
  assert.ok(!('trim' in readLib(node).banks[0].pads[9]));
  throwsCode(() => node.libChange('trim', { id: 1, pad: 9, trim: 12.1 }, 'test'), 'badreq');
  node.libChange('setpad', { id: 1, pad: 9, video: null }, 'test');
  throwsCode(() => node.libChange('trim', { id: 1, pad: 9, trim: 1 }, 'test'), 'badreq');
});

run();
