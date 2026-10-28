// Headless-Tests für editor.html gegen die Attrappe (Spec 9 „Editor“).
// Steuert Chrome über das DevTools-Protokoll (Node ≥ 22 hat WebSocket), ohne Playwright.
//   node tools/tests/test_editor.js            Tests
//   node tools/tests/test_editor.js --shots    zusätzlich Screenshots nach tools/tests/editor_screens/
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { createMock } = require('./editor_mock');
const { t, run, sleep } = require('./harness');

const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SHOTS = path.join(__dirname, 'editor_screens');
const W = 1440, H = 900;

// ---------- Mini-CDP ----------
async function launch() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'yts-chrome-'));
  const proc = spawn(CHROME, ['--headless=new', '--remote-debugging-port=0', '--user-data-dir=' + dir, '--no-first-run',
    '--no-default-browser-check', '--disable-extensions', '--hide-scrollbars', `--window-size=${W},${H}`, 'about:blank'], { stdio: 'ignore' });
  let port;
  for (let k = 0; k < 100 && !port; k++) {
    await sleep(100);
    try { port = fs.readFileSync(path.join(dir, 'DevToolsActivePort'), 'utf8').split('\n')[0]; } catch { /* noch nicht da */ }
  }
  if (!port) throw new Error('Chrome startet nicht');
  const page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((x) => x.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const wait = new Map(), errors = [];
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && wait.has(m.id)) { const [r, j] = wait.get(m.id); wait.delete(m.id); m.error ? j(new Error(m.error.message)) : r(m.result); }
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map((a) => a.value || a.description).join(' '));
  };
  const send = (method, params = {}) => new Promise((r, j) => { wait.set(++id, [r, j]); ws.send(JSON.stringify({ id, method, params })); });
  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 0, height: 0, deviceScaleFactor: 2, mobile: false }); // Größe aus --window-size, sonst stimmt 100vh nicht
  const b = {
    send, errors,
    async eval(expr) {
      const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error('eval: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
      return r.result.value;
    },
    async waitFor(expr, ms = 3000) {
      const end = Date.now() + ms;
      for (;;) { if (await b.eval(expr)) return; if (Date.now() > end) throw new Error('Zeitüberschreitung: ' + expr); await sleep(30); }
    },
    async center(sel) {
      const r = await b.eval(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const r = e.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
        const top = document.elementFromPoint(x, y); return [x, y, !top || e.contains(top) || top.contains(e) ? '' : top.outerHTML.slice(0, 100)]; })()`);
      if (!r) throw new Error('fehlt: ' + sel);
      if (r[2] && !sel.startsWith('#vsplit') && !sel.startsWith('#hsplit')) throw new Error(sel + ' verdeckt von ' + r[2]);
      return r;
    },
    pressed: false,
    mouse(type, x, y, modifiers = 0, clickCount = 1) {
      if (type !== 'mouseMoved') b.pressed = type === 'mousePressed';
      return send('Input.dispatchMouseEvent', { type, x, y, modifiers, button: b.pressed || type === 'mouseReleased' ? 'left' : 'none', buttons: b.pressed ? 1 : 0, clickCount });
    },
    async click(sel, clickCount = 1) { const [x, y] = await b.center(sel); await b.mouse('mouseMoved', x, y); await b.mouse('mousePressed', x, y, 0, clickCount); await b.mouse('mouseReleased', x, y, 0, clickCount); },
    async key(key, code, vk, modifiers = 0) {
      await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key, code, windowsVirtualKeyCode: vk, modifiers });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: vk, modifiers });
    },
    type: (text) => send('Input.insertText', { text }),
    async shot(name) {
      const r = await send('Page.captureScreenshot', { format: 'png' });
      fs.mkdirSync(SHOTS, { recursive: true }); fs.writeFileSync(path.join(SHOTS, name + '.png'), Buffer.from(r.data, 'base64'));
    },
    close() { ws.close(); proc.kill(); setTimeout(() => fs.rmSync(dir, { recursive: true, force: true }), 300); },
  };
  return b;
}
// HTML5-Drag lässt sich mit Mausereignissen headless nicht auslösen, deshalb echte DragEvents im Seitenkontext
const dnd = (from, to) => `(() => { const dt = new DataTransfer(), a = document.querySelector(${JSON.stringify(from)}), c = document.querySelector(${JSON.stringify(to)});
  const f = (el, ty) => el.dispatchEvent(new DragEvent(ty, { bubbles: true, cancelable: true, dataTransfer: dt }));
  f(a, 'dragstart'); f(c, 'dragover'); f(c, 'drop'); f(a, 'dragend'); return true; })()`;
const CTRL = 2, SHIFT = 8, ALT = 1;
// Der Schritt landet erst mit der /cmd-Antwort in der Historie, SSE kann früher da sein: auf den Knopf warten
const undoKey = async (b) => { await b.waitFor(`!$('undo').disabled && !histBusy`); await b.key('z', 'KeyZ', 90, CTRL); };
const redoKey = async (b) => { await b.waitFor(`!$('redo').disabled && !histBusy`); await b.key('Z', 'KeyZ', 90, CTRL | SHIFT); };

let m, b, url;
const last = () => m.log[m.log.length - 1];
async function waitLog(pred, ms = 3000) {
  const end = Date.now() + ms;
  for (;;) { const e = m.log.find(pred); if (e) return e; if (Date.now() > end) throw new Error('Befehl fehlt, Log: ' + JSON.stringify(m.log.map((x) => x.cmd))); await sleep(20); }
}
async function open(scenario) {
  m.down = false; m.session = 1; m.beatsOk = null; m.scenario(scenario); m.log = [];
  await b.send('Page.navigate', { url });
  await b.waitFor(`document.readyState === 'complete' && !document.body.classList.contains('offline') && typeof S === 'object' && S.dev && S.lib`);
  await b.eval('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))');
  await b.waitFor(`!document.querySelector('#wavemsg.on') || !!document.querySelector('#fetchone') || document.body.classList.contains('blank')`);
  await sleep(50);
}
// Marker von Pad i um dx Pixel ziehen, Zwischenstand prüfen
async function dragMarker(i, dx, mod = 0) {
  const [x, y] = await b.center(`.mk[data-pad="${i}"]`);
  await b.mouse('mouseMoved', x, y + 40); await b.mouse('mousePressed', x, y + 40, mod);
  for (let k = 1; k <= 5; k++) await b.mouse('mouseMoved', x + dx * k / 5, y + 40, mod);
  const tip = await b.eval(`getComputedStyle($('tip')).display === 'block' && $('tip').textContent`);
  await b.mouse('mouseReleased', x + dx, y + 40, mod);
  return tip;
}

t('Attrappe startet nicht auf dem Port des echten Device', async () => {
  m = createMock({ jobStep: 40 }); await m.listen(0);
  assert(m.port < 8765 || m.port > 8770);
  url = `http://127.0.0.1:${m.port}/editor`;
  b = await launch();
});

t('Layout: Liste, 4×4 mit Pad 1 unten links, Marker, Kopfzeile, Fuß', async () => {
  await open('normal');
  const r = await b.eval(`(() => {
    const p = [...Array(16)].map((_, i) => $('pad' + i).getBoundingClientRect());
    return { rows: $('banklist').children.length, on: document.querySelector('#banklist li.on .nr').textContent,
      p1bl: p.every((q) => p[0].left <= q.left + 1 && p[0].top >= q.top - 1), p16tr: p.every((q) => p[15].left >= q.left - 1 && p[15].top <= q.top + 1),
      p2right: p[1].left > p[0].left && Math.abs(p[1].top - p[0].top) < 1, p5above: p[4].top < p[0].top,
      marks: document.querySelectorAll('.mk.edit').length, nav: $('navname').textContent, conn: $('conntext').textContent,
      list: $('banklist').textContent, cache: $('cachesize').textContent, fetchall: $('fetchall').style.display,
      insp: $('insp').textContent, wavemsg: !!document.querySelector('#wavemsg.on'), side: getComputedStyle($('side')).width };
  })()`);
  assert.strictEqual(r.rows, 7); assert.strictEqual(r.on, '1');
  assert(r.p1bl && r.p16tr && r.p2right && r.p5above, 'Pad-Anordnung');
  assert.strictEqual(r.marks, 16); assert(!r.wavemsg);
  assert(/1 \/ 7\s+Rockit Scratches/.test(r.nav), r.nav);
  assert.strictEqual(r.conn, 'steuert: 3-YT Sampler');
  assert(/nur spielbar/.test(r.list) && /nicht ladbar/.test(r.list) && /Track laden/.test(r.list) && /Video nicht verfügbar/.test(r.list));
  assert(/Herbie Hancock – Rockit · 97 BPM/.test(r.list));
  assert.strictEqual(r.cache, 'Cache 4,2 GB'); assert.strictEqual(r.fetchall, '');
  assert(/Länge\s*vom Device/.test(r.insp) && /Neues Snippet/.test(r.insp) && /Anspielen/.test(r.insp) && /½×/.test(r.insp) && /2×/.test(r.insp));
  assert(!/Tempo stimmt/.test(r.insp), 'bestätigtes Tempo zeigt kein „Tempo stimmt“');
  assert.strictEqual(r.side, '280px');
  assert.deepStrictEqual(b.errors, []);
});

t('Tempo: „Tempo stimmt“ nur unbestätigt, ½×/2×/Zahlenfeld/tempook senden', async () => {
  await open('normal');
  await b.click('#banklist li:nth-child(2)');
  await waitLog((x) => x.cmd === 'select' && x.id === 3);
  await b.waitFor(`/Tempo stimmt/.test($('insp').textContent)`);
  await b.click('#half'); assert.deepStrictEqual(await waitLog((x) => x.cmd === 'tempo'), { client: last().client, cmd: 'tempo', video: 'Cv1tAm1nC0x', bpm: 58 });
  await b.waitFor(`$('bpm').value === '58' && !/Tempo stimmt/.test($('insp').textContent)`);
  await b.click('#double'); await waitLog((x) => x.cmd === 'tempo' && x.bpm === 116);
  await b.waitFor(`$('bpm').value === '116'`);
  await b.click('#bpm'); await b.eval(`$('bpm').select()`); await b.type('120.5'); await b.key('Enter', 'Enter', 13);
  await waitLog((x) => x.cmd === 'tempo' && x.bpm === 120.5);
  await open('normal');
  m.lib.videos.Cv1tAm1nC0x = { title: 'Can – Vitamin C' };
  await b.click('#banklist li:nth-child(2)'); await b.waitFor(`!!$('tempook')`);
  await b.click('#tempook'); await waitLog((x) => x.cmd === 'tempook' && x.video === 'Cv1tAm1nC0x');
  assert.strictEqual(await b.eval(`$('undo').disabled`), true, 'Tempo ist kein Schritt');
});

t('Marker ziehen rastet auf Schläge, mit Alt frei, ohne gültige Beats frei', async () => {
  await open('normal');
  const beats = await b.eval('S.beats.beats');
  const tip = await dragMarker(1, 137);
  assert(/^Pad 2 · \d+:\d\d\.\d\d$/.test(tip), 'Blase: ' + tip);
  const s1 = await waitLog((x) => x.cmd === 'setstart');
  assert.strictEqual(s1.pad, 1); assert(beats.includes(s1.ms), 'eingerastet: ' + s1.ms);
  m.log = [];
  const tip2 = await dragMarker(1, 61, ALT);
  assert(/frei$/.test(tip2), tip2);
  const s2 = await waitLog((x) => x.cmd === 'setstart');
  assert(!beats.includes(s2.ms) && Number.isInteger(s2.ms), 'frei: ' + s2.ms);
  m.log = []; m.beatsOk = false; m.emit('beats', { ...(await b.eval('S.beats')), ok: false });
  await b.waitFor(`/kein Einrasten/.test($('wavehint').textContent)`);
  const tip3 = await dragMarker(3, 53);
  assert(/frei$/.test(tip3), tip3);
  const s3 = await waitLog((x) => x.cmd === 'setstart');
  assert(!beats.includes(s3.ms), 'ohne Beats frei: ' + s3.ms);
});

t('Undo/Redo: Start setzen wählt erst die Bank, Tooltip und Toast nennen den Schritt', async () => {
  await open('normal');
  const before = (await b.eval('S.lib.banks[0].starts')).slice();
  await dragMarker(2, 90);
  const s = await waitLog((x) => x.cmd === 'setstart');
  await b.waitFor(`!$('undo').disabled`);
  assert.strictEqual(await b.eval(`$('undo').title`), 'Rückgängig: Start Pad 3 verschoben (⌘Z)');
  await b.click('#banklist li:nth-child(2)'); await b.waitFor('S.dev.bankId === 3');
  m.log = [];
  await undoKey(b);
  await waitLog((x) => x.cmd === 'setstarts');
  assert.deepStrictEqual(m.log.map((x) => x.cmd), ['select', 'setstarts']);
  assert.strictEqual(m.log[0].id, 7); assert.deepStrictEqual(m.log[1].starts, before);
  await b.waitFor(`$('toast').textContent === 'Rückgängig: Start Pad 3 verschoben'`);
  m.log = [];
  await redoKey(b);
  const r = await waitLog((x) => x.cmd === 'setstarts');
  const after = before.slice(); after[2] = s.ms;
  assert.deepStrictEqual(r.starts, after);
  await b.waitFor(`$('toast').textContent === 'Wiederholt: Start Pad 3 verschoben' && $('redo').disabled`);
});

t('Undo/Redo: neues Snippet, tauschen, umbenennen, verschieben', async () => {
  await open('normal');
  const st0 = (await b.eval('S.lib.banks[0].starts')).slice();
  await b.click('#pad4'); await waitLog((x) => x.cmd === 'hit' && x.pad === 4); await waitLog((x) => x.cmd === 'up' && x.pad === 4);
  await b.click('#rollbtn');
  const rl = await waitLog((x) => x.cmd === 'roll'); assert.strictEqual(rl.pad, 4);
  await b.waitFor(`$('undo').title.startsWith('Rückgängig: Neues Snippet Pad 5')`);
  m.log = []; await undoKey(b); assert.deepStrictEqual((await waitLog((x) => x.cmd === 'setstarts')).starts, st0);
  m.log = []; await redoKey(b); const rr = await waitLog((x) => x.cmd === 'setstarts'); assert.notDeepStrictEqual(rr.starts, st0); assert.deepStrictEqual(rr.starts.filter((v, i) => i !== 4), st0.filter((v, i) => i !== 4));

  m.log = []; await b.eval(dnd('#pad0', '#pad5'));
  assert.deepStrictEqual(await waitLog((x) => x.cmd === 'swap'), { client: last().client, cmd: 'swap', id: 7, a: 0, b: 5 });
  await b.waitFor(`$('undo').title.startsWith('Rückgängig: Pad 1 ↔ 6 getauscht')`);
  m.log = []; await undoKey(b); assert.strictEqual((await waitLog((x) => x.cmd === 'swap')).b, 5);
  m.log = []; await redoKey(b); await waitLog((x) => x.cmd === 'swap');

  m.log = []; await b.click('#banklist li.on .ren');
  await b.waitFor(`document.activeElement.tagName === 'INPUT'`);
  await b.eval(`document.activeElement.select()`); await b.type('Neue Kratzer'); await b.key('Enter', 'Enter', 13);
  assert.strictEqual((await waitLog((x) => x.cmd === 'rename')).name, 'Neue Kratzer');
  await b.waitFor(`/Neue Kratzer/.test($('navname').textContent)`);
  m.log = []; await undoKey(b); assert.strictEqual((await waitLog((x) => x.cmd === 'rename')).name, 'Rockit Scratches');
  m.log = []; await redoKey(b); assert.strictEqual((await waitLog((x) => x.cmd === 'rename')).name, 'Neue Kratzer');
  // Esc bricht ab, Doppelklick öffnet
  m.log = []; await b.click('#banklist li.on .name', 2); await b.waitFor(`document.activeElement.tagName === 'INPUT'`);
  await b.type('xyz'); await b.key('Escape', 'Escape', 27); await sleep(150);
  assert(!m.log.some((x) => x.cmd === 'rename'), 'Esc sendet nichts');

  m.log = []; await b.eval(dnd('#banklist li:nth-child(1)', '#banklist li:nth-child(3)'));
  assert.deepStrictEqual(await waitLog((x) => x.cmd === 'move'), { client: last().client, cmd: 'move', id: 7, to: 3 });
  await b.waitFor(`document.querySelector('#banklist li.on .nr').textContent === '3'`);
  m.log = []; await undoKey(b); assert.strictEqual((await waitLog((x) => x.cmd === 'move')).to, 1);
  m.log = []; await redoKey(b); assert.strictEqual((await waitLog((x) => x.cmd === 'move')).to, 3);
});

t('Undo/Redo: duplizieren, neue Bank, löschen (Toast mit Rückgängig)', async () => {
  await open('normal');
  await b.click('#banklist li.on .dup');
  const d = await waitLog((x) => x.cmd === 'duplicate'); assert.strictEqual(d.id, 7);
  await b.waitFor(`S.dev.bankId === 13 && document.querySelector('#banklist li.on .nr').textContent === '2'`);
  m.log = []; await undoKey(b); assert.strictEqual((await waitLog((x) => x.cmd === 'delete')).id, 13);
  m.log = []; await redoKey(b);
  const rs = await waitLog((x) => x.cmd === 'restore');
  assert.strictEqual(rs.bank.id, 13); assert.strictEqual(rs.at, 2); assert.strictEqual(rs.bank.name, 'Rockit Scratches (Kopie)');
  await waitLog((x) => x.cmd === 'select' && x.id === 13);

  m.log = []; await b.key('k', 'KeyK', 75, CTRL);
  await b.waitFor(`document.body.classList.contains('search') && document.activeElement === $('q')`);
  await b.type('Cymande'); await b.key('Enter', 'Enter', 13);
  await b.waitFor(`document.querySelectorAll('#results img').length === 1`);
  assert(await b.eval(`$('results').querySelector('img').src === 'https://i.ytimg.com/vi/Cy5BraBra00/mqdefault.jpg' && /6:12/.test($('results').textContent)`));
  await b.click('#results li');
  await waitLog((x) => x.cmd === 'newbank' && x.video === 'Cy5BraBra00');
  await b.waitFor(`S.dev.bankId === 14 && $('undo').title.startsWith('Rückgängig: Neue Bank „Cymande – Bra“')`);
  m.log = []; await undoKey(b); assert.strictEqual((await waitLog((x) => x.cmd === 'delete')).id, 14);
  m.log = []; await redoKey(b); assert.strictEqual((await waitLog((x) => x.cmd === 'restore')).bank.id, 14);
  await waitLog((x) => x.cmd === 'select' && x.id === 14); await b.waitFor('S.dev.bankId === 14 && !histBusy');

  await b.click('#banklist li:nth-child(1)'); await b.waitFor('S.dev.bankId === 7');
  m.log = []; await b.click('#banklist li.on .del');
  assert.strictEqual((await waitLog((x) => x.cmd === 'delete')).id, 7);
  await b.waitFor(`$('toast').classList.contains('on') && $('toast').textContent === 'Bank „Rockit Scratches“ gelöscht' + 'Rückgängig'`);
  await b.waitFor('S.dev.bankId === 13'); // Nachrücker
  m.log = []; await b.click('#toast button');
  const rr = await waitLog((x) => x.cmd === 'restore'); assert.strictEqual(rr.bank.id, 7); assert.strictEqual(rr.at, 1);
  await waitLog((x) => x.cmd === 'select' && x.id === 7);
  m.log = []; await redoKey(b); assert.strictEqual((await waitLog((x) => x.cmd === 'delete')).id, 7);
});

t('Undo-Fehler (playonly) zeigt den Text und lässt den Schritt stehen', async () => {
  await open('normal');
  await dragMarker(0, 120); await waitLog((x) => x.cmd === 'setstart');
  await b.waitFor(`!$('undo').disabled`);
  m.lib.banks[0].wav = false; m.lib.banks[0].starts[0] = 1; // Undo-Starts kommen in der alten Datei nicht vor
  m.log = []; await undoKey(b); await waitLog((x) => x.cmd === 'setstarts');
  await b.waitFor(`$('toast').classList.contains('err') && $('toast').textContent === 'Track fehlt – nur spielbar'`);
  assert.strictEqual(await b.eval(`$('undo').disabled`), false);
});

t('Historie leert sich nur bei fremder neuer rev', async () => {
  await open('normal');
  await b.click('#banklist li.on .dup'); await b.waitFor(`!$('undo').disabled`);
  const lib = () => ({ ...m.lib, cache: { bytes: 1, warn: false } });
  m.emit('lib', { ...lib(), by: 'extern' }); await sleep(150);                       // gleiche rev
  assert.strictEqual(await b.eval(`$('undo').disabled`), false);
  m.lib.rev++; m.emit('lib', { ...lib(), by: 'device' }); await sleep(150);          // Tempo am Device
  assert.strictEqual(await b.eval(`$('undo').disabled`), false);
  m.lib.rev++; m.emit('lib', { ...lib(), by: 'anderer-client' });
  await b.waitFor(`$('undo').disabled && $('toast').textContent === 'Bibliothek wurde anderswo geändert'`);
});

t('nur spielbar: Marker und Neues Snippet gesperrt, Rest geht, Track laden', async () => {
  await open('nurspielbar');
  const r = await b.eval(`({ msg: $('wavemsg').textContent, edit: document.querySelectorAll('.mk.edit').length, roll: $('rollbtn').disabled,
    rollIcon: getComputedStyle(document.querySelector('#pad0 .roll')).display, drag: $('pad0').draggable,
    acts: [...document.querySelectorAll('#banklist li.on .acts button')].every((x) => !x.disabled) })`);
  assert(/Track fehlt/.test(r.msg) && /Track laden/.test(r.msg)); assert.strictEqual(r.edit, 0);
  assert.strictEqual(r.roll, true); assert.strictEqual(r.rollIcon, 'none'); assert.strictEqual(r.drag, true); assert(r.acts);
  await b.click('#pad2'); await waitLog((x) => x.cmd === 'hit' && x.pad === 2);
  await b.eval(dnd('#pad0', '#pad1')); await waitLog((x) => x.cmd === 'swap');
  await b.click('#fetchone'); assert.strictEqual((await waitLog((x) => x.cmd === 'fetch')).video, 'Fk4WaterNoG');
  await b.waitFor(`document.querySelectorAll('.mk.edit').length === 16 && !$('rollbtn').disabled`, 4000);
});

t('nicht ladbar: Wählen meldet nosnip, Track laden in der Zeile', async () => {
  await open('normal');
  await b.click('#banklist li:nth-child(5)');
  await waitLog((x) => x.cmd === 'select' && x.id === 11);
  await b.waitFor(`$('toast').textContent === 'Snippets fehlen – Bank nicht ladbar'`);
  assert.strictEqual(await b.eval('S.dev.bankId'), 7);
  await b.click('#banklist li:nth-child(5) .fetch'); await waitLog((x) => x.cmd === 'fetch' && x.video === 'Es9UfoUfo00');
});

t('keine Bank: Track sichtbar und anspielbar, nicht bearbeitbar', async () => {
  await open('keinebank');
  const r = await b.eval(`({ cls: document.body.classList.contains('nobank'), tag: getComputedStyle($('nobank')).display, nav: $('navname').textContent,
    mk: document.querySelectorAll('.mk').length, edit: document.querySelectorAll('.mk.edit').length, on: document.querySelectorAll('#banklist li.on').length,
    drag: $('pad3').draggable, roll: $('rollbtn').disabled, bpm: $('bpm').disabled, hint: $('padhint').textContent })`);
  assert(r.cls && r.tag !== 'none'); assert.strictEqual(r.nav, 'keine Bank');
  assert.strictEqual(r.mk, 16); assert.strictEqual(r.edit, 0); assert.strictEqual(r.on, 0);
  assert.strictEqual(r.drag, false); assert(r.roll && r.bpm); assert(/keine Bank/.test(r.hint));
  const [px, py] = await b.center('#pad7');
  await b.mouse('mouseMoved', px, py); await b.mouse('mousePressed', px, py);
  await waitLog((x) => x.cmd === 'hit' && x.pad === 7);
  await b.waitFor(`getComputedStyle($('play')).display === 'block'`);             // Abspielkopf läuft, solange gehalten
  await b.mouse('mouseReleased', px, py); await waitLog((x) => x.cmd === 'up' && x.pad === 7);
  await b.waitFor(`getComputedStyle($('play')).display === 'none'`);
});

t('Bibliothek kaputt/neuer: Fehlerleiste, Schreiben gesperrt', async () => {
  await open('kaputt');
  const r = await b.eval(`({ bar: getComputedStyle($('errbar')).display, text: $('errbar').textContent, search: $('opensearch').disabled, blank: $('blank').textContent })`);
  assert.notStrictEqual(r.bar, 'none'); assert(/^Bibliothek kaputt – Speichern gesperrt/.test(r.text)); assert(r.search); assert(/Bibliothek kaputt/.test(r.blank));
  await b.key('k', 'KeyK', 75, CTRL); await sleep(100);
  assert.strictEqual(await b.eval(`document.body.classList.contains('search')`), false);
  await open('neuer');
  assert.strictEqual(await b.eval(`$('errbar').textContent`), 'Bibliothek aus neuerer Version');
  await open('leer');
  assert(await b.eval(`/Noch keine Bank/.test($('banklist').textContent) && /Bibliothek leer/.test($('navname').textContent) && !$('opensearch').disabled`));
});

t('kein Device: ausgegraut, verbindet sich selbst neu; anderes Device leert die Historie', async () => {
  await open('normal');
  await b.click('#banklist li.on .dup'); await b.waitFor(`!$('undo').disabled`);
  m.setDown(true);
  await b.waitFor(`document.body.classList.contains('offline') && getComputedStyle($('offline')).display === 'flex'`);
  assert(/Kein Device\s*YT Sampler in Live laden/.test(await b.eval(`$('offline').textContent`)));
  m.session = 2; m.track = '5-Zweites Device'; m.down = false;
  await b.waitFor(`!document.body.classList.contains('offline')`, 6000);
  await b.waitFor(`$('toast').textContent === 'steuert jetzt 5-Zweites Device' && $('undo').disabled && $('conntext').textContent === 'steuert: 5-Zweites Device'`);
  m.track = '3-YT Sampler';
});

t('Größen bleiben im localStorage, Bibliothek einklappbar', async () => {
  await open('normal');
  const [x, y] = await b.center('#vsplit');
  await b.mouse('mouseMoved', x, y); await b.mouse('mousePressed', x, y);
  await b.mouse('mouseMoved', 340, y); await b.mouse('mouseMoved', 351, y); await b.mouse('mouseReleased', 351, y);
  await b.waitFor(`layout.sw === 351`);
  const [hx, hy] = await b.center('#hsplit');
  await b.mouse('mouseMoved', hx, hy); await b.mouse('mousePressed', hx, hy); await b.mouse('mouseMoved', hx, hy + 80); await b.mouse('mouseReleased', hx, hy + 80);
  await b.waitFor(`!$('hsplit').classList.contains('on')`);
  const whl = await b.eval('layout.wh');
  assert(whl > 42, 'Waveform höher: ' + whl);
  await open('normal');
  assert.strictEqual(await b.eval(`getComputedStyle($('side')).width`), '351px');
  assert.strictEqual(await b.eval(`getComputedStyle(document.documentElement).getPropertyValue('--wh')`), whl + '%');
  await b.click('#toggleside');
  await open('normal');
  assert.strictEqual(await b.eval(`$('body').classList.contains('collapsed')`), true);
  await b.click('#toggleside');
  await b.eval(`localStorage.setItem('ytsampler.editor.layout', '{kaputt')`);
  await open('normal');
  assert.strictEqual(await b.eval(`getComputedStyle($('side')).width`), '280px');
  await b.eval(`localStorage.clear()`);
});

t('Zoom 1×/4×/16×, Schlaglinien ab 4×, Bank wechseln mit ↑/↓ und ◀ ▶', async () => {
  await open('normal');
  await b.click('#zoom button:nth-child(2)');
  assert(await b.eval(`$('inner').getBoundingClientRect().width > 3.9 * $('scroll').clientWidth`));
  await b.key('ArrowDown', 'ArrowDown', 40); await waitLog((x) => x.cmd === 'select' && x.id === 3);
  await b.waitFor('S.dev.bankId === 3');
  m.log = []; await b.click('#prev'); await waitLog((x) => x.cmd === 'select' && x.id === 7);
  await b.waitFor(`$('prev').disabled`);
  assert.deepStrictEqual(b.errors, []);
});

t('Screenshots', async () => {
  if (!process.argv.includes('--shots')) return;
  await open('normal'); await b.click('#pad5'); await sleep(250); await b.shot('editor-normal');
  await open('nurspielbar'); await b.shot('editor-nur-spielbar');
  await open('keinebank'); await b.shot('editor-keine-bank');
  await open('kaputt'); await b.shot('editor-kaputt');
  await open('normal'); m.setDown(true); await b.waitFor(`document.body.classList.contains('offline')`); await sleep(100); await b.shot('editor-kein-device');
  m.down = false;
  await open('normal'); await b.key('k', 'KeyK', 75, CTRL); await b.type('a'); await b.key('Enter', 'Enter', 13);
  await b.waitFor(`document.querySelectorAll('#results li img').length > 1`); await sleep(400); await b.shot('editor-suche');
});

t('aufräumen', async () => { b.close(); await m.close(); });

run();
