// Headless-Tests für editor.html gegen die Attrappe (Spec 9 „Editor“).
// Steuert Chrome über das DevTools-Protokoll (Node ≥ 22 hat WebSocket), ohne Playwright.
//   node tools/tests/test_editor.js            Tests
//   node tools/tests/test_editor.js --shots    zusätzlich Screenshots nach tools/tests/editor_screens/
const assert = require('assert');
const { createMock } = require('./editor_mock');
const { t, run, sleep } = require('./harness');
const { launch } = require('./cdp');

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
  assert(/^Pad 1\d:\d\d\.\d\d/.test(r.insp) && /Neues Snippet/.test(r.insp) && /Anspielen/.test(r.insp) && /½×/.test(r.insp) && /2×/.test(r.insp));
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
  const before = (await b.eval('S.lib.banks[0].pads.map((p) => p.start)')).slice();
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
  const st0 = (await b.eval('S.lib.banks[0].pads.map((p) => p.start)')).slice();
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
  await b.click('#results li .t');
  const fp = await waitLog((x) => x.cmd === 'fillpads' && x.video === 'Cy5BraBra00');
  assert.deepStrictEqual([fp.id, fp.pads], [13, [0]], 'Treffer anklicken = gewähltes Pad, keine neue Bank');
  await b.waitFor(`S.dev.bankId === 13 && $('undo').title.startsWith('Rückgängig: Pad 1 aus „Cymande – Bra“')`);
  assert.strictEqual(await b.eval(`S.lib.banks.length`), 8);
  m.log = []; await undoKey(b);
  assert.deepStrictEqual((await waitLog((x) => x.cmd === 'setpad')).video, 'Rk7tQ2mLp0A', 'Undo bringt das alte Pad zurück');
  m.log = []; await redoKey(b); assert.strictEqual((await waitLog((x) => x.cmd === 'setpad')).video, 'Cy5BraBra00');
  await b.waitFor('!histBusy');

  // erst wenn die Liste neu gezeichnet ist: sonst trifft der Klick noch das Löschen-Icon der vorigen Bank (14)
  await b.click('#banklist li:nth-child(1)'); await b.waitFor(`S.dev.bankId === 7 && document.querySelector('#banklist li.on').dataset.id === '7'`);
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
  m.lib.videos.Rk7tQ2mLp0A.wav = false; m.lib.banks[0].pads[0].start = 1; // Undo-Starts kommen in der alten Datei nicht vor
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

t('nichts geladen (bankId 0): leere Fläche statt Waveform, keine „keine Bank“-Ansicht', async () => {
  await open('nichtsgeladen');
  const r = await b.eval(`({ blank: document.body.classList.contains('blank'), msg: $('blankmsg').textContent, nav: $('navname').textContent,
    on: document.querySelectorAll('#banklist li.on').length, tag: !!$('nobank') })`);
  assert(r.blank); assert.strictEqual(r.msg, 'Keine Bank aktiv'); assert.strictEqual(r.nav, '–'); assert.strictEqual(r.on, 0); assert(!r.tag);
  m.log = []; await b.key('a', 'KeyA', 65); await sleep(100);
  assert(!m.log.some((x) => x.cmd === 'hit'), 'ohne Bank kein Pad');
  assert.deepStrictEqual(b.errors, []);
});

// ---------- Device-Regler (Spec 3.0, 5.1) ----------
const ctlState = () => b.eval(`({ div: $('p-div').value, divText: $('p-div').selectedOptions[0].textContent, rate: +$('p-rate').value, rateV: $('p-rate-v').textContent,
  mode: $('p-mode').textContent, on: ['mode', 'rev', 'tune', 'warp', 'quant'].filter((n) => $('p-' + n).classList.contains('on')),
  vol: +$('p-vol').value, volV: $('p-vol-v').textContent, voices: $('p-voices').selectedOptions[0].textContent, base: $('p-base').value, note: $('p-base-v').textContent,
  locked: $('ctl').classList.contains('locked'), disabled: [...$('ctl').querySelectorAll('select, input, button')].filter((e) => e.disabled).length,
  count: $('ctl').querySelectorAll('select, input, button').length })`);
const params = () => m.log.filter((x) => x.cmd === 'param');

t('Regler: Leiste in der Pad-Karte zeigt device.params und folgt dem Device', async () => {
  await open('normal');
  const pos = await b.eval(`(() => { const c = $('ctl'), h = $('pads').querySelector('.cardhead').getBoundingClientRect(), r = c.getBoundingClientRect(), g = $('grid').getBoundingClientRect();
    return { parent: c.parentNode.id, below: r.top >= h.bottom - 1, above: r.bottom <= g.top + 1, set: c.querySelector('.set').contains($('p-vol')) && c.querySelector('.set').contains($('p-base')) && c.querySelector('.set').contains($('p-voices')),
      setRight: c.querySelector('.set').getBoundingClientRect().left > $('p-quant').getBoundingClientRect().right,
      dim: +getComputedStyle(c.querySelector('.set')).opacity, divs: [...$('p-div').options].map((o) => o.textContent).join(' '), voices: [...$('p-voices').options].map((o) => o.textContent).join(' ') }; })()`);
  assert.strictEqual(pos.parent, 'pads'); assert(pos.below && pos.above, 'zwischen Kartenkopf und Pads');
  assert(pos.set && pos.setRight && pos.dim < 1, 'Einrichtung rechts, gedämpft');
  assert.strictEqual(pos.divs, '1/64 1/32 1/16T 1/16 1/8T 1/8 1/4T 1/4 1/2 1 Bar 2 Bars');
  assert.strictEqual(pos.voices, 'Mono 2 3 4 5 8 16');
  let s = await ctlState();
  assert.deepStrictEqual([s.div, s.divText, s.rate, s.rateV, s.mode, s.on, s.vol, s.volV, s.voices, s.base, s.note, s.locked, s.disabled],
    ['5', '1/8', 1, '1,00×', 'Trigger', ['tune', 'quant'], -3.5, '-3,5 dB', '16', '36', 'C1', false, 0]);
  m.setParams({ div: 9, rate: 0.5, mode: 1, rev: 1, tune: 0, warp: 1, quant: 0, vol: 6, voices: 0, base: 60 }); // am Device gedreht
  await b.waitFor(`$('p-mode').textContent === 'Hold'`);
  s = await ctlState();
  assert.deepStrictEqual([s.divText, s.rate, s.rateV, s.on, s.volV, s.voices, s.base, s.note], ['1 Bar', 0.5, '0,50×', ['mode', 'rev', 'warp'], '6,0 dB', 'Mono', '60', 'C3']);
  assert.strictEqual(await b.eval(`parseFloat($('slice').style.width) > 0`), true, 'Spanne sichtbar');
  assert.deepStrictEqual(b.errors, []);
});

t('Regler: Umschalter und Menüs schicken param sofort, kein Undo, kein „gespeichert“', async () => {
  await open('normal');
  const w0 = await b.eval(`parseFloat($('slice').style.width)`);
  for (const [name, value] of [['rev', 1], ['mode', 1], ['warp', 1], ['tune', 0], ['quant', 0], ['qcatch', 1]]) {
    m.log = []; await b.click('#p-' + name);
    const x = await waitLog((y) => y.cmd === 'param');
    assert.deepStrictEqual({ name: x.name, value: x.value }, { name, value });
    await b.waitFor(`$('p-${name}').classList.contains('on') === ${!!value}`);
  }
  // Raster für Quant: Menü schickt qdiv, Device-Wert kommt zurück, Leiste bleibt einzeilig
  m.log = []; await b.eval(`(() => { const e = $('p-qdiv'); e.value = '3'; e.dispatchEvent(new Event('change')); })()`);
  const qd = await waitLog((y) => y.cmd === 'param');
  assert.deepStrictEqual({ name: qd.name, value: qd.value }, { name: 'qdiv', value: 3 });
  await b.waitFor(`S.dev.params.qdiv === 3 && $('p-qdiv').value === '3'`);
  m.setParams({ qdiv: 0 }); await b.waitFor(`$('p-qdiv').value === '0'`);
  assert.strictEqual(await b.eval(`$('p-qdiv').selectedOptions[0].textContent`), '1/32');
  assert(await b.eval(`$('ctl').querySelector('.set').getBoundingClientRect().top < $('p-quant').getBoundingClientRect().bottom`), 'Reglerleiste einzeilig');
  assert.strictEqual(await b.eval(`$('p-mode').textContent`), 'Hold');
  m.log = []; await b.click('#p-mode'); assert.strictEqual((await waitLog((y) => y.cmd === 'param')).value, 0);
  await b.waitFor(`$('p-mode').textContent === 'Trigger'`);
  m.log = []; await b.eval(`$('p-div').value = '10'; $('p-div').dispatchEvent(new Event('change'))`);
  assert.deepStrictEqual(await waitLog((y) => y.cmd === 'param'), { client: last().client, cmd: 'param', name: 'div', value: 10 });
  await b.waitFor(`parseFloat($('slice').style.width) > ${w0}`); // Spanne folgt der Slice-Länge
  m.log = []; await b.eval(`$('p-voices').value = '3'; $('p-voices').dispatchEvent(new Event('change'))`);
  assert.strictEqual((await waitLog((y) => y.cmd === 'param' && y.name === 'voices')).value, 3);
  assert.strictEqual(await b.eval(`document.activeElement === $('p-voices')`), false, 'Menü gibt den Fokus ab (Pad-Tasten)');
  // Base Note: tippen, Enter
  m.log = []; await b.click('#p-base'); await b.eval(`$('p-base').select()`); await b.type('48'); await b.key('Enter', 'Enter', 13);
  assert.strictEqual((await waitLog((y) => y.cmd === 'param' && y.name === 'base')).value, 48);
  await b.waitFor(`$('p-base-v').textContent === 'C2'`);
  m.log = []; await b.click('#p-base'); await b.eval(`$('p-base').select()`); await b.type('200'); await b.key('Enter', 'Enter', 13);
  await b.waitFor(`$('toast').textContent === 'Base Note 0–127' && $('p-base').value === '48'`);
  assert.deepStrictEqual(params(), [], 'ungültig: nichts gesendet');
  // Pad-Tasten gehen nach den Reglern weiter
  m.log = []; await b.click('#p-rev'); await waitLog((y) => y.cmd === 'param'); await b.key('a', 'KeyA', 65); await waitLog((y) => y.cmd === 'hit' && y.pad === 4);
  assert.strictEqual(await b.eval(`$('undo').disabled`), true, 'Regler sind kein Schritt');
  assert.strictEqual(await b.eval(`$('saved').textContent`), 'automatisch gespeichert');
  assert.deepStrictEqual(b.errors, []);
});

t('Regler: Schieber gedrosselt, zeigt beim Ziehen den lokalen Wert, Doppelklick = Standard', async () => {
  await open('normal');
  const r = await b.eval(`(() => { const e = $('p-rate').getBoundingClientRect(); return [e.left, e.right, e.top + e.height / 2]; })()`);
  const [x0, x1, y] = r, steps = 30;
  m.log = [];
  await b.mouse('mouseMoved', x0 + 2, y); await b.mouse('mousePressed', x0 + 2, y);
  const t0 = Date.now();
  for (let k = 1; k <= steps; k++) { await b.mouse('mouseMoved', x0 + 2 + (x1 - x0 - 4) * k / steps, y); await sleep(8); }
  const dt = Date.now() - t0;
  m.setParams({ rate: 1.25 }); await sleep(80);                                     // Echo mitten im Ziehen: Schieber bleibt lokal
  const during = await b.eval(`[+$('p-rate').value, $('p-rate-v').textContent]`);
  assert.deepStrictEqual(during, [2, '2,00×'], 'beim Ziehen lokal: ' + during);
  await b.mouse('mouseReleased', x1 - 2, y);
  await waitLog((x) => x.cmd === 'param' && x.value === 2);
  await sleep(120);
  const sent = params();
  assert(sent.every((x) => x.name === 'rate'));
  assert(sent.length >= 2 && sent.length <= Math.ceil(dt / 50) + 2, sent.length + ' Befehle in ' + dt + ' ms');
  assert.strictEqual(sent[sent.length - 1].value, 2, 'letzter Wert gewinnt');
  assert(sent.every((x) => x.value === Math.round(x.value * 1000) / 1000), 'auf 3 Stellen');
  await b.waitFor(`S.dev.params.rate === 2 && $('p-rate-v').textContent === '2,00×'`);
  m.setParams({ rate: 1.5 });                                                       // nach dem Loslassen gilt wieder params
  await b.waitFor(`+$('p-rate').value === 1.5 && $('p-rate-v').textContent === '1,50×'`);
  // Doppelklick: Rate 1, Volume 0 dB
  m.log = []; await b.click('#p-rate'); await b.click('#p-rate', 2);
  await waitLog((x) => x.cmd === 'param' && x.name === 'rate' && x.value === 1);
  await b.waitFor(`$('p-rate-v').textContent === '1,00×' && S.dev.params.rate === 1`);
  m.log = []; await b.click('#p-vol'); await b.click('#p-vol', 2);
  await waitLog((x) => x.cmd === 'param' && x.name === 'vol' && x.value === 0);
  await b.waitFor(`$('p-vol-v').textContent === '0,0 dB'`);
  assert(params().every((x) => x.name !== 'vol' || x.value === Math.round(x.value * 10) / 10), 'Volume auf 1 Stelle');
  // Tastatur: Pfeil rechts am Schieber sendet und gibt den Fokus ab
  m.log = []; await b.eval(`$('p-vol').focus()`); await b.key('ArrowRight', 'ArrowRight', 39);
  await waitLog((x) => x.cmd === 'param' && x.name === 'vol' && x.value === 0.1);
  assert.strictEqual(await b.eval(`document.activeElement === $('p-vol')`), false);
  assert.deepStrictEqual(b.errors, []);
});

t('Regler: gesperrt ohne Device und ohne params, frei bei leerer/kaputter Bibliothek', async () => {
  await open('normal');
  m.setParams(null);
  await b.waitFor(`$('ctl').classList.contains('locked')`);
  let s = await ctlState(); assert.strictEqual(s.disabled, s.count);
  m.log = []; await b.eval(`$('p-rev').click()`); await sleep(80); assert.deepStrictEqual(params(), []);
  m.setParams({ ...require('./editor_mock').PARAMS_START, rev: 1 });
  await b.waitFor(`!$('ctl').classList.contains('locked') && $('p-rev').classList.contains('on')`);
  m.setDown(true); await b.waitFor(`document.body.classList.contains('offline') && $('ctl').classList.contains('locked')`);
  s = await ctlState(); assert.strictEqual(s.disabled, s.count);
  m.down = false;
  for (const sc of ['leer', 'kaputt']) {
    await open(sc);
    const r = await b.eval(`({ inBlank: $('blank').contains($('ctl')), vis: getComputedStyle($('ctl')).visibility, locked: $('ctl').classList.contains('locked') })`);
    assert(r.inBlank && r.vis === 'visible' && !r.locked, sc + ': ' + JSON.stringify(r));
    m.log = []; await b.click('#p-warp');
    assert.deepStrictEqual(await waitLog((x) => x.cmd === 'param'), { client: last().client, cmd: 'param', name: 'warp', value: 1 }, sc);
    await b.waitFor(`$('p-warp').classList.contains('on')`); // Echo abwarten, sonst landet es im nächsten Szenario
  }
  // zurück in die Pad-Karte, sobald eine Bank da ist
  await open('normal');
  assert.strictEqual(await b.eval(`$('ctl').parentNode.id`), 'pads');
});

t('Attrappe: /cmd param prüft Name und Bereich (badreq)', async () => {
  await open('normal');
  const post = (q) => b.eval(`fetch('/cmd', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: ${JSON.stringify(JSON.stringify(q))} }).then((r) => r.json())`);
  for (const q of [{ name: 'grid', value: 1 }, { name: 'div', value: 11 }, { name: 'div', value: 2.5 }, { name: 'rev', value: 2 }, { name: 'rate', value: 3 }, { name: 'vol', value: '0' }, { name: 'base', value: -1 }])
    assert.strictEqual((await post({ cmd: 'param', ...q })).code, 'badreq', JSON.stringify(q));
  assert.deepStrictEqual(await post({ cmd: 'param', name: 'rate', value: 0.25 }), { ok: true });
  await b.waitFor(`S.dev.params.rate === 0.25`);
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
  assert(await b.eval(`/Noch keine Bank/.test($('banklist').textContent) && /Bibliothek leer/.test($('navname').textContent) && $('opensearch').disabled && /Neue Bank/.test($('blank').textContent)`));
  m.log = []; await b.click('#banklist li.empty button'); await waitLog((x) => x.cmd === 'newmix');
  await b.waitFor(`!$('opensearch').disabled && document.querySelectorAll('.pad.empty').length === 16`);
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

const keyDown = (code, key, mod = 0, autoRepeat = false) => b.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key, code, modifiers: mod, autoRepeat });
const keyUp = (code, key, mod = 0) => b.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, modifiers: mod });
const wheel = (x, y, deltaY, mod = 0, deltaX = 0) => b.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x, y, deltaX, deltaY, modifiers: mod });

t('Zoom stufenlos: +/−/0, Regler, ⌘/Strg-Rad um die Maus, Grenzen, Rad schiebt', async () => {
  await open('normal');
  const st = () => b.eval(`({ z: S.zoom, sl: $('scroll').scrollLeft, cw: $('scroll').clientWidth, iw: $('inner').getBoundingClientRect().width, max: maxZoom(),
    fit: $('zoomfit').textContent, r: +$('zoomr').value, n: S.peaks.get(view().video).n })`);
  let s = await st();
  assert.strictEqual(s.z, 1); assert.strictEqual(s.fit, '1×'); assert.strictEqual(s.r, 0);
  assert(Math.abs(s.max - s.n * 2 / s.cw) < 1e-6, 'Höchstzoom = 2 px pro Peak-Block');
  await b.click('#zoomin'); s = await st();
  assert(Math.abs(s.z - 1.5) < 1e-9 && Math.abs(s.iw - 1.5 * s.cw) < 1, 'Knopf +'); assert.strictEqual(s.fit, '1,5×');
  await b.key('+', 'BracketRight', 187); s = await st(); assert(Math.abs(s.z - 2.25) < 1e-9, '+ Taste: ' + s.z);
  await b.key('-', 'Slash', 189); s = await st(); assert(Math.abs(s.z - 1.5) < 1e-9, '− Taste');
  await b.key('0', 'Digit0', 48); s = await st(); assert.strictEqual(s.z, 1);
  // Strg + Rad (= Pinch): die Stelle unter der Maus bleibt stehen
  const [sx, sy] = await b.center('#scroll'), ax = sx - 100;
  const msAt = `(($('scroll').scrollLeft + ${ax} - $('scroll').getBoundingClientRect().left) / W.innerW * W.dur)`;
  const ms0 = await b.eval(msAt);
  for (let k = 0; k < 6; k++) await wheel(ax, sy, -100, CTRL);
  await b.waitFor(`S.zoom > 10`);
  assert(Math.abs(await b.eval(msAt) - ms0) < 30, 'Stelle unter der Maus bleibt: ' + ms0 + ' → ' + (await b.eval(msAt)));
  for (let k = 0; k < 20; k++) await wheel(ax, sy, -100, CTRL);
  s = await st(); assert(Math.abs(s.z - s.max) < 1e-6, 'oben begrenzt'); assert(await b.eval(`$('zoomin').disabled`));
  assert.strictEqual(s.r, 1000);
  // senkrechtes Rad ohne Taste schiebt waagrecht
  const sl = s.sl; await wheel(sx, sy, 300); await b.waitFor(`$('scroll').scrollLeft > ${sl + 100}`).catch(async (e) => { throw new Error(e.message + ' ' + JSON.stringify(await st())); });
  for (let k = 0; k < 40; k++) await wheel(ax, sy, 100, CTRL);
  s = await st(); assert.strictEqual(s.z, 1, 'unten begrenzt'); assert(await b.eval(`$('zoomout').disabled && $('zoomfit').disabled`));
  // Regler: logarithmisch, Mitte = Wurzel aus dem Höchstzoom
  await b.eval(`$('zoomr').value = 500; $('zoomr').dispatchEvent(new Event('input'))`);
  s = await st(); assert(Math.abs(s.z - Math.sqrt(s.max)) < 0.01, 'Regler: ' + s.z);
  assert.deepStrictEqual(b.errors, []);
});

t('Marker ziehen stimmt bei hohem Zoom, Schlaglinien je nach Platz', async () => {
  await open('normal');
  await b.eval(`S.sel = 4; setZoom(40)`); await b.eval(`showSel()`); await sleep(50);
  const r = await b.eval(`(() => { const m = document.querySelector('.mk[data-pad="4"]'); return { left: parseFloat(m.style.left), want: msToX(view().starts[4]), px: W.innerW / W.dur }; })()`);
  assert(Math.abs(r.left - r.want) < 0.01, 'Marker sitzt auf seinem Start');
  const before = await b.eval('S.lib.banks[0].pads[4].start');
  await dragMarker(4, 50, ALT);
  const s = await waitLog((x) => x.cmd === 'setstart');
  assert(Math.abs(s.ms - (before + 50 / r.px)) < 2 / r.px + 1, 'frei gezogen um 50 px = ' + Math.round(50 / r.px) + ' ms, war ' + (s.ms - before));
  const beatPx = await b.eval(`msToX(60000 / S.beats.bpm)`);
  assert(beatPx >= 6, 'bei 40× Platz für Schlaglinien');
});

t('Pads per Tastatur: Y X C V / A S D F / Q W E R / 1 2 3 4, ohne Wiederholung, nicht in Feldern', async () => {
  await open('normal');
  const codes = ['KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyQ', 'KeyW', 'KeyE', 'KeyR', 'Digit1', 'Digit2', 'Digit3', 'Digit4'];
  const keys = 'yxcvasdfqwer1234';
  for (let i = 0; i < 16; i++) {
    m.log = [];
    await keyDown(codes[i], keys[i]); await keyDown(codes[i], keys[i], 0, true); // Auto-Repeat löst nicht neu aus
    await waitLog((x) => x.cmd === 'hit' && x.pad === i);
    await keyUp(codes[i], keys[i]); await waitLog((x) => x.cmd === 'up' && x.pad === i);
    assert.deepStrictEqual(m.log.map((x) => x.cmd + x.pad), ['hit' + i, 'up' + i]);
  }
  assert.strictEqual(await b.eval(`document.querySelector('#pad0 .k').textContent + document.querySelector('#pad15 .k').textContent`), 'Y4');
  // zwei Tasten: die zweite übernimmt, das Loslassen der ersten stoppt sie nicht
  m.log = []; await keyDown('KeyZ', 'y'); await keyDown('KeyX', 'x'); await keyUp('KeyZ', 'y'); await sleep(100);
  assert.deepStrictEqual(m.log.map((x) => x.cmd + x.pad), ['hit0', 'up0', 'hit1']);
  await keyUp('KeyX', 'x'); await waitLog((x) => x.cmd === 'up' && x.pad === 1);
  // mit ⌘/Strg/Alt nichts, Strg+Z bleibt Undo, im Tempo-Feld wird getippt
  m.log = []; await b.key('z', 'KeyZ', 90, CTRL); await b.key('a', 'KeyA', 65, ALT); await b.key('1', 'Digit1', 49, CTRL); await sleep(100);
  assert(!m.log.some((x) => x.cmd === 'hit'), 'mit Modifier kein Pad');
  await b.click('#bpm'); m.log = []; await b.key('1', 'Digit1', 49); await b.key('q', 'KeyQ', 81); await sleep(100);
  assert(!m.log.some((x) => x.cmd === 'hit'), 'im Eingabefeld kein Pad');
  await b.eval(`$('bpm').blur()`);
  // nach dem Zoom-Regler gehen die Tasten weiter
  await b.eval(`$('zoomr').focus()`); m.log = []; await b.key('2', 'Digit2', 50); await waitLog((x) => x.cmd === 'hit' && x.pad === 13);
  // Suche offen: kein Pad
  await b.key('k', 'KeyK', 75, CTRL); await b.waitFor(`document.body.classList.contains('search')`);
  await b.eval(`$('q').blur()`); m.log = []; await b.key('a', 'KeyA', 65); await sleep(100);
  assert(!m.log.some((x) => x.cmd === 'hit'), 'Suche offen');
  assert.deepStrictEqual(b.errors, []);
});

t('Fortschritt in Prozent, begrenzt auf 0–100, Phase als Text', async () => {
  await open('nurspielbar');
  const job = (j) => m.emit('job', { kind: 'fetch', video: 'Fk4WaterNoG', left: 0, ...j });
  job({ phase: 'download', progress: 28 });
  await b.waitFor(`/lädt 28 %/.test($('wavemsg').textContent) && /lädt 28 %/.test($('banklist').textContent)`);
  job({ phase: 'download', progress: 2800 }); await b.waitFor(`/lädt 100 %/.test($('wavemsg').textContent)`);
  job({ phase: 'download', progress: -5 }); await b.waitFor(`/lädt 0 %/.test($('wavemsg').textContent)`);
  job({ phase: 'convert', progress: 100 }); await b.waitFor(`/konvertiert/.test($('wavemsg').textContent)`);
  // Track aufs Pad: Ladezustand am Pad in Prozent, zwei gleichzeitig mit eigenem Fortschritt
  await open('normal');
  await b.eval(`fillVideo('Cy5BraBra00', 'Erste', [3]); fillVideo('Bj8Nautilus', 'Zweite', [6])`);
  await b.waitFor(`/lädt (25|50|75) %/.test($('pad3').querySelector('.s').textContent) && $('pad3').classList.contains('loading') && $('pad6').classList.contains('loading')`);
  const seen = await b.eval(`$('pad3').querySelector('.s').textContent.match(/lädt (\\d+) %/)[1]`); assert(+seen <= 100, seen);
  assert.strictEqual(await b.eval(`$('pad6').querySelector('.vt').textContent`), 'Zweite');
  await b.waitFor(`!S.fills.length && !document.querySelector('.pad.loading')`, 4000);
});

t('Bank wechseln mit ↑/↓ und ◀ ▶', async () => {
  await open('normal');
  await b.key('ArrowDown', 'ArrowDown', 40); await waitLog((x) => x.cmd === 'select' && x.id === 3);
  await b.waitFor('S.dev.bankId === 3');
  m.log = []; await b.click('#prev'); await waitLog((x) => x.cmd === 'select' && x.id === 7);
  await b.waitFor(`$('prev').disabled`);
  assert.deepStrictEqual(b.errors, []);
});

// ---------- Mix-Bänke (Mix-Spec 5, 6) ----------
// Szenario mix: Bank 13 „Mix Funk“, Pads 1–4 + 13 Rockit, 5–8 + 14 Can, 9 Fela (ohne WAV), 11 Cymande (nur hier), 10/12/15/16 leer
const markers = () => b.eval(`[...document.querySelectorAll('.mk')].map((x) => +x.dataset.pad)`);
const post = (q) => b.eval(`fetch('/cmd', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: ${JSON.stringify(JSON.stringify(q))} }).then((r) => r.json())`);

t('Bank aus mehreren Tracks: „n Tracks“ ohne Mix-Zeichen, Waveform folgt dem Pad, Marker nur fürs eigene Video', async () => {
  await open('mix');
  const r = await b.eval(`({ on: document.querySelector('#banklist li.on .name').textContent, mixTags: document.querySelectorAll('#banklist .tag.mix').length,
    first: document.querySelector('#banklist li:nth-child(1) .name').textContent, vt0: $('pad0').querySelector('.vt').textContent, vt4: $('pad4').querySelector('.vt').textContent,
    title4: $('pad4').title, empty: [...document.querySelectorAll('.pad.empty')].map((x) => +x.id.slice(3)).sort((a, c) => a - c) })`);
  assert(/^Mix Funk4 Tracks/.test(r.on), r.on); assert.strictEqual(r.mixTags, 0);
  assert(/^Rockit ScratchesHerbie Hancock – Rockit · 97 BPM/.test(r.first), r.first);
  assert.strictEqual(r.vt0, 'Herbie Hancock – Rockit'); assert.strictEqual(r.vt4, 'Can – Vitamin C'); assert(r.title4.startsWith('Can – Vitamin C · '));
  assert.deepStrictEqual(r.empty, [9, 11, 14, 15]);
  assert.deepStrictEqual(await markers(), [0, 1, 2, 3, 12]);
  assert.strictEqual(await b.eval(`S.beats.video`), 'Rk7tQ2mLp0A');
  // anderes Video: Waveform, Marker, beats und Tempo wechseln
  await b.click('#pad4'); await waitLog((x) => x.cmd === 'hit' && x.pad === 4);
  await b.waitFor(`S.beats.video === 'Cv1tAm1nC0x' && S.peaks.get('Cv1tAm1nC0x').state === 'ok' && !document.querySelector('#wavemsg.on')`);
  assert.deepStrictEqual(await markers(), [4, 5, 6, 7, 13]);
  assert(/Can – Vitamin C · 116 BPM/.test(await b.eval(`$('insp').textContent`)));
  assert.strictEqual(await b.eval(`Math.abs(W.dur - 212000) < 100`), true, 'Waveform = ganzer Track des Pads');
  // Abspielkopf nur auf der passenden Waveform
  m.emit('play', { pad: 0, video: 'Rk7tQ2mLp0A', from: 1000, to: 3000, dur: 3000 }); await sleep(80);
  assert.strictEqual(await b.eval(`$('play').style.display`), 'none');
  m.emit('play', { pad: 4, video: 'Cv1tAm1nC0x', from: 1000, to: 3000, dur: 3000 }); await b.waitFor(`$('play').style.display === 'block'`);
  // Pad ohne WAV: Track fehlt, Marker und Würfel gesperrt, Leeren geht
  await b.click('#pad8'); await waitLog((x) => x.cmd === 'hit' && x.pad === 8);
  await b.waitFor(`/Track fehlt/.test($('wavemsg').textContent) && !!$('fetchone')`);
  const f = await b.eval(`({ edit: document.querySelectorAll('.mk.edit').length, roll: getComputedStyle($('pad8').querySelector('.roll')).display, clr: getComputedStyle($('pad8').querySelector('.clr')).display, rb: $('rollbtn').disabled })`);
  assert.deepStrictEqual(f, { edit: 0, roll: 'none', clr: 'block', rb: true });
  m.log = []; await b.click('#fetchone'); assert.strictEqual((await waitLog((x) => x.cmd === 'fetch')).video, 'Fk4WaterNoG');
  // leerer Platz
  await b.click('#pad9'); await waitLog((x) => x.cmd === 'hit' && x.pad === 9);
  await b.waitFor(`/Leerer Platz/.test($('wavemsg').textContent) && S.dev.video === '-'`);
  const e = await b.eval(`({ insp: $('insp').textContent, s: $('pad9').querySelector('.s').textContent, roll: getComputedStyle($('pad9').querySelector('.roll')).display,
    clr: getComputedStyle($('pad9').querySelector('.clr')).display, mk: document.querySelectorAll('.mk').length, dev: S.dev.video })`);
  assert.deepStrictEqual(e, { insp: 'Pad 10leer', s: 'leer', roll: 'none', clr: 'none', mk: 0, dev: '-' });
  assert.deepStrictEqual(b.errors, []);
});

t('Quell-Grid: rechts 4×4 (Pad 1 unten links), Bank wählen (gemerkt), Pad auf Platz ziehen → setpad, Undo/Redo', async () => {
  await b.eval(`localStorage.clear()`);
  await open('mix');
  const opts = await b.eval(`[...$('srcsel').options].map((o) => o.textContent)`);
  assert.strictEqual(opts.length, 7); assert(!opts.some((x) => /Mix Funk/.test(x)), 'aktive Bank nicht in der Auswahl');
  assert.strictEqual(opts[0], '1  Rockit Scratches');
  await b.eval(`$('srcsel').value = '3'; $('srcsel').dispatchEvent(new Event('change'))`);
  await b.waitFor(`document.querySelectorAll('#srcpads .st').length === 16 && $('srcpads').querySelector('.st').title.startsWith('Can – Vitamin C · ')`);
  const g = await b.eval(`(() => { const q = (k) => $('srcpads').querySelector('.st[data-pad="' + k + '"]').getBoundingClientRect(), gr = $('grid').getBoundingClientRect(), sp = $('srcpads').getBoundingClientRect(), ins = $('insp').getBoundingClientRect();
    return { right: sp.left > gr.right, below: ins.top >= sp.bottom - 1, bl: q(0).left <= q(15).left && q(0).top > q(15).top, row: Math.abs(q(1).top - q(0).top) < 1 && q(4).top < q(0).top }; })()`);
  assert.deepStrictEqual(g, { right: true, below: true, bl: true, row: true });
  const cs = (await b.eval('S.lib.banks[1].pads'))[2].start;
  m.log = []; await b.eval(dnd('#srcpads .st[data-pad="2"]', '#pad9'));
  assert.deepStrictEqual(await waitLog((x) => x.cmd === 'setpad'), { client: last().client, cmd: 'setpad', id: 13, pad: 9, video: 'Cv1tAm1nC0x', start: cs, info: { title: 'Can – Vitamin C' } });
  await b.waitFor(`!$('pad9').classList.contains('empty') && $('undo').title === 'Rückgängig: Pad 10 aus Vitamin C (⌘Z)'`);
  m.log = []; await undoKey(b);
  assert.deepStrictEqual(await waitLog((x) => x.cmd === 'setpad'), { client: last().client, cmd: 'setpad', id: 13, pad: 9, video: null });
  await b.waitFor(`$('pad9').classList.contains('empty')`);
  m.log = []; await redoKey(b); assert.strictEqual((await waitLog((x) => x.cmd === 'setpad')).video, 'Cv1tAm1nC0x');
  // belegter Platz wird ersetzt, Undo bringt den alten Eintrag mit info zurück
  const old = (await b.eval('S.lib.banks[7].pads'))[0];
  m.log = []; await b.eval(dnd('#srcpads .st[data-pad="0"]', '#pad0')); await waitLog((x) => x.cmd === 'setpad' && x.pad === 0);
  m.log = []; await undoKey(b);
  assert.deepStrictEqual(await waitLog((x) => x.cmd === 'setpad'), { client: last().client, cmd: 'setpad', id: 13, pad: 0, video: 'Rk7tQ2mLp0A', start: old.start, info: { title: 'Herbie Hancock – Rockit', bpm: 97 } });
  // Quelle gemerkt
  await open('mix');
  assert.strictEqual(await b.eval(`$('srcsel').value`), '3');
  // Bank mit leeren Plätzen als Quelle: kein „Mix“ in der Auswahl, leere Plätze nicht ziehbar
  await b.click('#banklist li:nth-child(1)'); await b.waitFor(`S.dev.bankId === 7 && !!$('srcsel').querySelector('option[value="13"]')`);
  assert(/\|8  Mix Funk$/.test(await b.eval(`[...$('srcsel').options].map((o) => o.textContent).join('|')`)));
  await b.eval(`$('srcsel').value = '13'; $('srcsel').dispatchEvent(new Event('change'))`);
  await b.waitFor(`$('srcpads').querySelector('.st[data-pad="9"]').classList.contains('empty')`);
  assert.strictEqual(await b.eval(`$('srcpads').querySelector('.st[data-pad="9"]').draggable`), false);
  assert.strictEqual(await b.eval(`$('srcpads').querySelector('.st[data-pad="10"]').draggable`), true);
  // gesperrt ohne Device
  m.setDown(true); await b.waitFor(`document.body.classList.contains('offline') && !$('srcpads').querySelector('.st[data-pad="10"]').draggable`);
  m.down = false;
  await b.eval(`localStorage.clear()`);
  assert.deepStrictEqual(b.errors, []);
});

t('Icon „leeren“: setpad mit null, auch ohne WAV, Undo mit info nach Wegfall des Videos', async () => {
  await open('mix');
  await b.click('#pad10'); await waitLog((x) => x.cmd === 'hit' && x.pad === 10);
  assert.strictEqual(await b.eval(`getComputedStyle($('pad10').querySelector('.clr')).opacity`), '1', 'am gewählten Pad sichtbar');
  const start = (await b.eval('S.lib.banks[7].pads'))[10].start;
  m.log = []; await b.click('#pad10 .clr');
  assert.deepStrictEqual(await waitLog((x) => x.cmd === 'setpad'), { client: last().client, cmd: 'setpad', id: 13, pad: 10, video: null });
  assert(!m.log.some((x) => x.cmd === 'hit'), 'Icon spielt nicht an');
  await b.waitFor(`$('pad10').classList.contains('empty') && !S.lib.videos.Cy5BraBra00 && $('undo').title === 'Rückgängig: Pad 11 geleert (⌘Z)'`);
  m.log = []; await undoKey(b);
  assert.deepStrictEqual(await waitLog((x) => x.cmd === 'setpad'), { client: last().client, cmd: 'setpad', id: 13, pad: 10, video: 'Cy5BraBra00', start, info: { title: 'Cymande – Bra' } });
  await b.waitFor(`!$('pad10').classList.contains('empty') && !!S.lib.videos.Cy5BraBra00`);
  m.log = []; await redoKey(b); assert.strictEqual((await waitLog((x) => x.cmd === 'setpad')).video, null);
  // ohne WAV (Fela)
  m.log = []; await b.click('#pad8 .clr');
  await waitLog((x) => x.cmd === 'setpad' && x.pad === 8 && x.video === null);
  await b.waitFor(`$('pad8').classList.contains('empty')`);
  // Attrappe: unbekanntes Video braucht info, leerer Platz kein roll/setstart
  assert.strictEqual((await post({ cmd: 'setpad', id: 13, pad: 9, video: 'Mg7E2E4e2e4', start: 1000 })).code, 'badreq');
  assert.strictEqual((await post({ cmd: 'setpad', id: 13, pad: 9, video: 'Mg7E2E4e2e4', start: 1000, info: { title: 'E2-E4' } })).ok, true);
  assert.strictEqual((await post({ cmd: 'roll', id: 13, pad: 11 })).code, 'badreq');
  assert.strictEqual((await post({ cmd: 'setstart', id: 13, pad: 11, ms: 5 })).code, 'badreq');
  assert.deepStrictEqual(b.errors, []);
});

t('Neue Bank: Knopf, 16 leere Plätze, „leer“, Undo = delete, Redo = restore, füllen', async () => {
  await open('normal');
  assert.strictEqual(await b.eval(`$('pad0').querySelector('.vt').textContent`), '', 'Track-Bank ohne Titel am Pad');
  m.log = []; await b.click('#newbank'); await waitLog((x) => x.cmd === 'newmix');
  await b.waitFor(`S.dev.bankId === 13 && document.querySelectorAll('.pad.empty').length === 16 && /Leerer Platz/.test($('wavemsg').textContent)`);
  assert.strictEqual(await b.eval(`document.querySelector('#banklist li.on .name').textContent`), 'Neue Bankleer');
  await b.waitFor(`$('undo').title === 'Rückgängig: Neue Bank (⌘Z)'`);
  m.log = []; await undoKey(b); assert.strictEqual((await waitLog((x) => x.cmd === 'delete')).id, 13);
  m.log = []; await redoKey(b);
  const rs = await waitLog((x) => x.cmd === 'restore');
  assert.strictEqual(rs.bank.id, 13); assert.deepStrictEqual(rs.videos, {}); assert.strictEqual(rs.bank.pads.length, 16);
  await waitLog((x) => x.cmd === 'select' && x.id === 13); await b.waitFor('S.dev.bankId === 13 && !histBusy');
  // aus der Quelle (Standard: erste andere Bank) füllen
  m.log = []; await b.eval(dnd('#srcpads .st[data-pad="5"]', '#pad0'));
  assert.strictEqual((await waitLog((x) => x.cmd === 'setpad')).video, 'Rk7tQ2mLp0A');
  await b.waitFor(`document.querySelector('#banklist li.on .sub').textContent === 'Herbie Hancock – Rockit · 97 BPM' && document.querySelectorAll('.mk').length === 1`);
  assert.deepStrictEqual(b.errors, []);
});

t('Suche → Pad: Treffer aufs Pad ziehen (überschreibt, Ladezustand), „Leere Plätze füllen“, Undo/Redo, Liste „n Tracks“', async () => {
  await open('normal');
  await b.click('#newbank'); await b.waitFor(`S.dev.bankId === 13 && document.querySelectorAll('.pad.empty').length === 16`);
  await b.key('k', 'KeyK', 75, CTRL); await b.type('Cymande'); await b.key('Enter', 'Enter', 13);
  await b.waitFor(`!!$('results').querySelector('.fill') && !$('results').querySelector('.fill').disabled`);
  // ziehen auf Pad 6
  m.log = []; await b.eval(dnd('#results li', '#pad5'));
  assert.deepStrictEqual(await waitLog((x) => x.cmd === 'fillpads'), { client: last().client, cmd: 'fillpads', id: 13, video: 'Cy5BraBra00', pads: [5], tag: last().tag });
  await b.waitFor(`$('pad5').classList.contains('loading') && S.sel === 5`);
  // Platz lädt: Ziehen darauf wird abgelehnt
  m.log = []; await b.eval(dnd('#srcpads .st[data-pad="0"]', '#pad5')); await sleep(80);
  assert(!m.log.some((x) => x.cmd === 'setpad'), 'kein setpad auf ladenden Platz');
  await b.waitFor(`!$('pad5').classList.contains('loading') && !$('pad5').classList.contains('empty') && $('undo').title === 'Rückgängig: Pad 6 aus „Cymande – Bra“ (⌘Z)'`, 4000);
  assert.strictEqual(await b.eval(`document.querySelector('#banklist li.on .sub').textContent`), 'Cymande – Bra');
  // leere Plätze füllen
  await b.key('k', 'KeyK', 75, CTRL); await b.waitFor(`document.querySelectorAll('#results li').length === 1`);
  await b.eval(`$('q').value = 'Nautilus'; runSearch()`); await b.waitFor(`/Nautilus/.test($('results').textContent) && !!$('results').querySelector('.fill')`); await sleep(300);
  m.log = []; await b.click('#results li .fill');
  const fe = await waitLog((x) => x.cmd === 'fillpads');
  assert.deepStrictEqual([fe.video, fe.pads], ['Bj8Nautilus', [0, 1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]]);
  assert(!m.log.some((x) => x.cmd === 'select'), 'keine neue Bank');
  await b.waitFor(`document.querySelectorAll('.pad.loading').length === 15`);
  await b.waitFor(`!document.querySelector('.pad.loading') && !document.querySelector('.pad.empty') && $('undo').title === 'Rückgängig: 15 Plätze aus „Bob James – Nautilus“ (⌘Z)'`, 4000);
  assert.strictEqual(await b.eval(`document.querySelector('#banklist li.on .sub').textContent`), '2 Tracks');
  assert.strictEqual(await b.eval(`$('pad0').querySelector('.vt').textContent`), 'Bob James – Nautilus', 'mehrere Tracks: Titel am Pad');
  const starts = (await b.eval('S.lib.banks[7].pads')).filter((p) => p.video === 'Bj8Nautilus').map((p) => p.start);
  assert.strictEqual(new Set(starts).size, 15); assert.deepStrictEqual(starts, [...starts].sort((x, y) => x - y));
  await b.waitFor(`$('results').querySelector('.fill') === null || $('results').querySelector('.fill').disabled`);
  // Undo leert die 15 Plätze, Redo setzt dieselben Starts
  m.log = []; await undoKey(b);
  await b.waitFor(`document.querySelectorAll('.pad.empty').length === 15 && !histBusy`);
  assert.strictEqual(m.log.filter((x) => x.cmd === 'setpad' && x.video === null).length, 15);
  m.log = []; await redoKey(b);
  await b.waitFor(`!document.querySelector('.pad.empty') && !histBusy`);
  assert.deepStrictEqual(m.log.filter((x) => x.cmd === 'setpad').map((x) => x.start), starts);
  // Undo der Überschreibung von Pad 6 mit gelöschtem Video: info aus done
  m.log = []; await undoKey(b); await b.waitFor('!histBusy');
  m.log = []; await undoKey(b);
  assert.deepStrictEqual(await waitLog((x) => x.cmd === 'setpad'), { client: last().client, cmd: 'setpad', id: 13, pad: 5, video: null });
  assert.deepStrictEqual(b.errors, []);
});

t('Screenshots', async () => {
  if (!process.argv.includes('--shots')) return;
  await open('normal'); await b.click('#pad5'); await sleep(250); await b.shot('editor-normal');
  await b.eval(`setZoom(6)`); await sleep(100); await b.shot('editor-zoom');
  await open('nurspielbar'); await b.shot('editor-nur-spielbar');
  await open('mix'); await b.click('#pad4'); await sleep(300); await b.shot('editor-mix');
  await b.click('#pad9'); await sleep(250); await b.shot('editor-leerer-platz');
  await b.click('#banklist li:nth-child(1)'); await b.waitFor(`S.dev.bankId === 7 && !!$('srcsel').querySelector('option[value="13"]')`);
  await b.eval(`$('srcsel').value = '13'; $('srcsel').dispatchEvent(new Event('change'))`); await sleep(300); await b.shot('editor-quell-grid');
  await open('normal'); await b.click('#newbank'); await b.waitFor(`S.dev.bankId === 13`); await sleep(300); await b.shot('editor-neue-bank-leer');
  await b.key('k', 'KeyK', 75, CTRL); await b.type('a'); await b.key('Enter', 'Enter', 13);
  await b.waitFor(`document.querySelectorAll('#results li img').length > 1`); await sleep(400); await b.shot('editor-suche-leere-plaetze-fuellen');
  await b.eval(`localStorage.clear()`);
  await open('leer'); await b.shot('editor-leer');
  await open('kaputt'); await b.shot('editor-kaputt');
  await open('normal'); m.setDown(true); await b.waitFor(`document.body.classList.contains('offline')`); await sleep(100); await b.shot('editor-kein-device');
  m.down = false;
  await open('normal'); await b.key('k', 'KeyK', 75, CTRL); await b.type('a'); await b.key('Enter', 'Enter', 13);
  await b.waitFor(`document.querySelectorAll('#results li img').length > 1`); await sleep(400); await b.shot('editor-suche');
});

t('aufräumen', async () => { b.close(); await m.close(); });

run();
