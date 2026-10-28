// Migration 1.x -> 2.0.0 (Spec 8.1, 8.2): node tools/tests/test_migration.js
// Umzug nur im Temp-HOME, nie im echten ~/Music/YTSampler.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { tempHome, loadNode, t, run, sleep } = require('./harness');

const L = (h, ...p) => path.join(h, 'Music', 'YTSampler', ...p);
const D = (h, ...p) => path.join(h, 'Library', 'Mobile Documents', 'com~apple~CloudDocs', 'YTSampler', ...p);

// alter 1.x-Ordner
function oldHome(icloud) {
  const h = tempHome(icloud);
  for (const d of ['cache', 'chrome-profile', 'sessions', 'web']) fs.mkdirSync(L(h, d), { recursive: true });
  fs.writeFileSync(L(h, 'cache', 'AAAAAAAAAAA.wav'), 'wav');
  fs.writeFileSync(L(h, 'chrome-profile', 'Prefs'), 'p');
  fs.writeFileSync(L(h, 'sessions', '5.json'), JSON.stringify({ version: 1, saved: 'x', state: 'S1' }));
  fs.writeFileSync(L(h, 'sessions', '6.json'), JSON.stringify({ saved: 'x', state: 'S0' }));
  fs.writeFileSync(L(h, 'web', 'teletext.html'), 'alt');
  fs.writeFileSync(L(h, 'ir.json'), '{"12":"up"}');
  return h;
}

t('mit iCloud: alles außer cache und chrome-profile zieht nach D', () => {
  const h = oldHome(true);
  const { node, max } = loadNode(h);
  assert.strictEqual(node.DATA, D(h));
  assert.strictEqual(node.CACHE, L(h, 'cache'));
  assert.strictEqual(node.SESSIONS, D(h, 'sessions'));
  assert.strictEqual(fs.readFileSync(D(h, 'ir.json'), 'utf8'), '{"12":"up"}');
  assert.ok(fs.existsSync(D(h, 'sessions', '5.json')) && fs.existsSync(D(h, 'web')));
  assert.deepStrictEqual(fs.readdirSync(L(h)).sort(), ['cache', 'chrome-profile']);
  assert.ok(fs.existsSync(L(h, 'cache', 'AAAAAAAAAAA.wav')) && fs.existsSync(L(h, 'chrome-profile', 'Prefs')));
  assert.ok(!max.out.some((o) => o[0] === 'status'));
  // zweiter Start: D gibt es schon, nichts passiert
  fs.writeFileSync(L(h, 'neu.txt'), 'x');
  assert.strictEqual(loadNode(h).node.DATA, D(h));
  assert.ok(fs.existsSync(L(h, 'neu.txt')));
});

t('ohne iCloud: D = ~/Music/YTSampler, nichts bewegt', () => {
  const h = oldHome(false);
  const { node } = loadNode(h);
  assert.strictEqual(node.DATA, L(h));
  assert.strictEqual(node.LIB_FILE, L(h, 'library.json'));
  assert.ok(fs.existsSync(L(h, 'ir.json')) && fs.existsSync(L(h, 'sessions', '5.json')));
});

t('frische Installation mit iCloud: D wird angelegt', () => {
  const h = tempHome(true);
  const { node } = loadNode(h);
  assert.strictEqual(node.DATA, D(h));
  assert.ok(fs.existsSync(D(h, 'sessions')) && fs.existsSync(L(h, 'cache')));
});

t('Umzug scheitert: alles zurück nach L, Status-Meldung, nächster Start versucht neu', () => {
  const h = oldHome(true);
  fs.chmodSync(L(h, 'web'), 0o555);   // Ordner ohne Schreibrecht lässt sich nicht in einen anderen Ordner umbenennen
  const { node, max } = loadNode(h);
  fs.chmodSync(L(h, 'web'), 0o755);
  assert.strictEqual(node.DATA, L(h));
  assert.ok(!fs.existsSync(D(h)), 'D wieder weg');
  for (const n of ['ir.json', 'sessions', 'web', 'cache', 'chrome-profile']) assert.ok(fs.existsSync(L(h, n)), n);
  assert.ok(max.out.some((o) => o[0] === 'status' && o[1] === 'Umzug nach iCloud fehlgeschlagen'));
  assert.strictEqual(loadNode(h).node.DATA, D(h));
  assert.ok(fs.existsSync(D(h, 'ir.json')) && fs.existsSync(D(h, 'web', 'teletext.html')));
});

t('zwei Devices starten gleichzeitig: nichts geht verloren', async () => {
  const h = oldHome(true);
  const child = () => new Promise((resolve) => {
    const code = `const { loadNode } = require(${JSON.stringify(path.join(__dirname, 'harness.js'))});
      console.log(loadNode(${JSON.stringify(h)}).node.DATA); process.exit(0);`;
    const p = spawn(process.execPath, ['-e', code]);
    let out = '';
    p.stdout.on('data', (d) => { out += d; });
    p.on('close', () => resolve(out.trim()));
  });
  const dirs = await Promise.all([child(), child()]);
  assert.deepStrictEqual(dirs, [D(h), D(h)]);
  for (const n of ['ir.json', 'sessions/5.json', 'sessions/6.json', 'web/teletext.html']) {
    assert.ok(fs.existsSync(D(h, n)) || fs.existsSync(L(h, n)), n);
  }
});

t('Session 1 -> .v1.json, state unverändert, Autosave schreibt version 2', async () => {
  const h = oldHome(true);
  const { node, max } = loadNode(h);
  max.handlers.session(5);
  assert.deepStrictEqual(max.out.pop(), ['state', 'S1']);
  const v1 = path.join(node.SESSIONS, '5.v1.json');
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(v1, 'utf8')), { version: 1, saved: 'x', state: 'S1' });
  max.handlers.savestate('S2');
  await sleep(500);
  const now = JSON.parse(fs.readFileSync(path.join(node.SESSIONS, '5.json'), 'utf8'));
  assert.strictEqual(now.version, 2); assert.strictEqual(now.state, 'S2');
  assert.ok(!isNaN(Date.parse(now.saved)));
  // erneut laden: v2 -> keine neue Kopie, .v1.json bleibt die alte
  max.handlers.session(5);
  assert.deepStrictEqual(max.out.pop(), ['state', 'S2']);
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(v1, 'utf8')).state, 'S1');
  // ohne version gilt als 1
  max.handlers.session(6);
  assert.deepStrictEqual(max.out.pop(), ['state', 'S0']);
  assert.ok(fs.existsSync(path.join(node.SESSIONS, '6.v1.json')));
  // neue Session: statenone, keine Kopie
  max.handlers.session(7);
  assert.deepStrictEqual(max.out.pop(), ['statenone']);
  assert.ok(!fs.existsSync(path.join(node.SESSIONS, '7.v1.json')));
});

t('Teletext ohne fav, favinfo weg', () => {
  const { max } = loadNode(tempHome(false));
  assert.ok(!('favinfo' in max.handlers));
});

run();
