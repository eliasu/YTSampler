// Ende-zu-Ende: echter Node-Server (max-api-Attrappe), echtes [js] (vm, Tasks über setTimeout), beide über die
// Max-Nachrichten verbunden, dazu editor.html headless in Chrome. Freier Port, Temp-HOME.
//   node tools/tests/test_e2e.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { tempHome, loadNode, t, run, sleep } = require('./harness');
const { beatWav } = require('./wav');
const { launch } = require('./cdp');

const V1 = 'AAAAAAAAAAA', V2 = 'BBBBBBBBBBB';
const DUR = 40000;
const STARTS = Array.from({ length: 16 }, (_, i) => i * 2000);
STARTS[15] = DUR - 5000;

// Regler im Patch: varname -> [js]-Handler hinter dem prepend (Spec 3.0, 3.1)
const ECHO = { Division: 'division', Rate: 'rate', Mode: 'playmode', Reverse: 'reverse', Tune: 'tune', Warp: 'warp',
  Quantize: 'quantize', 'Quant Div': 'quantdiv', 'Quant Catch': 'quantcatch', Volume: 'volume', Voices: 'voicecount', 'Base Note': 'basenote' };

// [js] mit Attrappen; Ausgang 1 geht an die Node-Handler, Node-Nachrichten an die gleichnamige [js]-Funktion.
// Beide Richtungen asynchron und der Reihe nach, wie im Max-Scheduler.
// Der Patcher zeichnet setNamed auf. Ein Wert ohne „set“ geht wie beim live.*-Objekt über prepend zurück an [js].
function device(max) {
  const d = { out: [], api: null, named: [], vals: { bank: 1 } };
  const named = (name) => ({
    message(...a) {
      d.named.push([name, ...a]);
      if (a[0] === 'set' || a[0] === 'int') { d.vals[name] = a[1]; return; }
      d.vals[name] = a[0];
      if (ECHO[name]) setImmediate(() => d.ctx[ECHO[name]](a[0]));
    },
    getvalueof: () => d.vals[name],
  });
  const ctx = {
    outlet(n, ...rest) {
      const a = [].concat(...rest);
      d.out.push([n, ...a]);
      if (n === 1 && max.handlers[a[0]]) setImmediate(() => max.handlers[a[0]](...a.slice(1)));
      if (n === 4 && a[0] === 'replace') setImmediate(() => ctx.bufloaded());   // buffer~ fertig -> Nachrichtenbox bufloaded
    },
    arrayfromargs: (a) => Array.prototype.slice.call(a),
    post: () => {},
    Task: function (fn) { this.fn = fn; },
    LiveAPI: function (cb) { this.cb = cb; d.api = this; },
    patcher: { getnamed: named },
  };
  ctx.Task.prototype.schedule = function (ms) { clearTimeout(this.t); this.t = setTimeout(this.fn, ms); };
  ctx.Task.prototype.cancel = function () { clearTimeout(this.t); };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', '..', 'ytsampler_main.js'), 'utf8'), ctx);
  max.outlet = (...a) => { max.out.push(a); if (typeof ctx[a[0]] === 'function') setImmediate(() => ctx[a[0]](...a.slice(1))); };
  d.ctx = ctx;
  d.on = (n, sel) => d.out.filter((o) => o[0] === n && (!sel || o[1] === sel));
  return d;
}

const until = async (fn, what, ms = 8000) => { const t0 = Date.now(); while (!fn()) { if (Date.now() - t0 > ms) throw new Error('Zeit um: ' + what); await sleep(15); } };

let home, node, max, dev, b, ids;
const bankMsgs = () => max.out.filter((m) => m[0] === 'bank');

t('Aufbau: Node, [js] und Editor verbunden', async () => {
  home = tempHome(false);
  ({ node, max } = loadNode(home));
  beatWav(path.join(node.CACHE, `${V1}.wav`), DUR / 1000, 120);
  beatWav(path.join(node.CACHE, `${V2}.wav`), DUR / 1000, 100);   // zweites Tempo für die Mix-Bank
  const mk = (video, name) => node.libChange('create', { video, title: 'Titel ' + video, name, starts: STARTS }, 'test').id;
  ids = [mk(V1, 'Eins'), mk(V2, 'Zwei'), mk(V1, 'Drei')];
  await until(() => node.webPort > 0, 'Server');
  assert.ok(node.webPort < 8765 || node.webPort > 8770);
  dev = device(max);
  dev.ctx.init();                                   // -> session -> libstate, statenone -> bankload 1 (Regler „Bank“)
  await until(() => dev.ctx.bankCount === 3, 'libstate am Device');
  await until(() => bankMsgs().length, 'bank am Regler');
  assert.deepStrictEqual(dev.on(1, 'bankload'), [[1, 'bankload', 1]]);
  assert.deepStrictEqual(bankMsgs()[0].slice(1, 3), [ids[0], 1]);
  await until(() => dev.ctx.st.bankId === ids[0], '[js] hat Bank 1');
  b = await launch();
  await b.send('Page.navigate', { url: `http://127.0.0.1:${node.webPort}/editor` });
  await b.waitFor(`typeof S === 'object' && S.conn && S.lib && S.lib.banks.length === 3`, 5000);
  dev.api.cb(['name', '"2-YT Sampler"']);          // Spurname aus Live
  await b.waitFor(`S.hello && S.hello.track === '2-YT Sampler'`);
});

t('Bank-Regler am Device: banksel -> bank mit Starts, Längen, Pfad -> padana pro Pad -> Editor folgt', async () => {
  await sleep(350);                                 // ready() nach init
  max.out = []; dev.out = [];                       // Bank 1 vom Aufbau nicht mitzählen
  dev.ctx.banknum(3);
  await until(() => bankMsgs().length, 'bank');
  const m = bankMsgs()[0];
  assert.deepStrictEqual(m.slice(1, 3), [ids[2], 3]);
  assert.deepStrictEqual(m.slice(3, 19), STARTS);
  assert.deepStrictEqual(m.slice(19, 35), STARTS.map((s) => Math.min(16000, DUR - s)));
  assert.deepStrictEqual(m.slice(35), [path.join(node.SNIP_DIR, `${ids[2]}.wav`)]);
  // Analyse pro Pad: 16 × padana mit demselben Tempo, dann analysisready
  await until(() => max.out.some((o) => o[0] === 'analysisready'), 'analysisready');
  const pa = max.out.filter((o) => o[0] === 'padana');
  assert.deepStrictEqual(pa.map((o) => o[1]), STARTS.map((_, i) => i));
  assert.ok(max.out.findIndex((o) => o[0] === 'analysisready') > max.out.lastIndexOf(pa[15]));
  pa.forEach((o) => assert.ok(Math.abs(o[2] - 120) < 1.5 && o.length > 9, 'padana ' + o.slice(1, 5)));
  await until(() => dev.ctx.PA[15] && dev.ctx.PA[15].bpm > 0, 'PA im [js]');
  assert.ok(dev.ctx.beatsOK(0) && dev.ctx.beatsOK(15));
  assert.ok(dev.on(1, 'bankstate').length && dev.on(1, 'bankstate').every((o) => o[2] === ids[2] && typeof o[3] === 'number'), 'bankstate ohne Video');
  await until(() => dev.on(4, 'replace').length, 'replace an buffer~');
  assert.deepStrictEqual(dev.on(4, 'replace').pop(), [4, 'replace', path.join(node.SNIP_DIR, `${ids[2]}.wav`)]);
  assert.strictEqual(dev.ctx.st.bankId, ids[2]);
  await b.waitFor(`S.dev.bankId === ${ids[2]} && S.dev.nr === 3 && S.dev.video === '${V1}' && document.querySelector('#banklist li.on')?.dataset.id === '${ids[2]}'`);
  assert.deepStrictEqual(await b.eval('S.dev.starts'), STARTS);
  await b.waitFor(`S.beats && S.beats.video === '${V1}' && S.beats.beats.length > 40`);
  assert.deepStrictEqual(dev.on(2, 'shownr').pop(), [2, 'shownr', '3']);
  assert.deepStrictEqual(dev.on(2, 'showname').pop(), [2, 'showname', 'Drei']);
});

t('Pad 6 im Editor anspielen: padhit -> [js] spielt -> SSE play', async () => {
  // S.play räumt der Editor nach der kurzen Slice selbst weg, deshalb ein zweiter Zuhörer
  await b.eval(`new Promise((open) => { window.__play = new Promise((r) => { const es = new EventSource('/editor/events'); es.onopen = open;
    es.addEventListener('play', (e) => { es.close(); r(JSON.parse(e.data)); }); }); })`);
  await b.click('#pad5');
  await until(() => dev.on(1, 'playing').length, 'playing');
  assert.deepStrictEqual(dev.on(1, 'playing')[0].slice(2, 4), [5, STARTS[5]]);
  const p = await b.eval('window.__play');
  assert.deepStrictEqual([p.pad, p.from], [5, STARTS[5]]);
});

t('Regler im Editor: param -> setNamed im [js] -> Regler-Echo -> bankstate -> device.params', async () => {
  await b.waitFor(`S.dev.params && S.dev.params.warp === 0 && !document.querySelector('#ctl').classList.contains('locked')`);
  await b.click('#p-warp');
  await until(() => dev.named.some((n) => n[0] === 'Warp' && n[1] === 1), 'setNamed Warp');
  assert.deepStrictEqual(dev.named.filter((n) => n[0] === 'Warp'), [['Warp', 1]]);
  await b.waitFor(`S.dev.params.warp === 1 && document.querySelector('#p-warp').classList.contains('on')`);
  await b.eval(`(() => { const e = document.querySelector('#p-div'); e.value = 7; e.dispatchEvent(new Event('change')); })()`);
  await until(() => dev.named.some((n) => n[0] === 'Division' && n[1] === 7), 'setNamed Division');
  await b.waitFor(`S.dev.params.div === 7`);
  // am Device gedreht: Editor folgt
  dev.ctx.volume(-6.04);
  await b.waitFor(`S.dev.params.vol === -6 && document.querySelector('#p-vol-v').textContent.startsWith('-6,0')`);
});

t('Aktive Bank im Editor löschen: Nachrücker (die davor, weil letzte) lädt im Device, Editor folgt', async () => {
  max.out = [];
  await b.eval(`document.querySelector('#banklist li.on .del').click()`);
  await until(() => bankMsgs().length, 'bank des Nachrückers');
  assert.deepStrictEqual(bankMsgs()[0].slice(1, 3), [ids[1], 2]);
  await b.waitFor(`S.dev.bankId === ${ids[1]} && S.lib.banks.length === 2`);
  await until(() => dev.ctx.st.bankId === ids[1], '[js] hat die neue Bank');
  // mittlere aktive Bank löschen: Nachrücker auf demselben Platz
  await b.eval(`document.querySelector('#banklist li[data-id="${ids[0]}"]').click()`);
  await b.waitFor(`document.querySelector('#banklist li.on')?.dataset.id === '${ids[0]}'`);
  await b.eval(`document.querySelector('#banklist li.on .del').click()`);
  await b.waitFor(`S.dev.bankId === ${ids[1]} && S.lib.banks.length === 1`);
  assert.deepStrictEqual(b.errors, []);
});

t('Mix-Bank Ende zu Ende: newmix, setpad aus zwei Track-Bänken, ein Platz geleert -> Längen, padana, padempty, Warp pro Pad', async () => {
  const eins = node.libChange('create', { video: V1, title: 'Titel ' + V1, name: 'Eins neu', starts: STARTS }, 'test').id;
  await b.waitFor(`S.lib.banks.length === 2 && S.lib.banks.every((x) => !x.mix && x.pads.length === 16)`);
  const r = await b.eval(`cmd('newmix')`);
  assert.ok(r.ok && Number.isInteger(r.id), JSON.stringify(r));
  await until(() => dev.ctx.st.bankId === r.id, '[js] hat die Mix-Bank');
  assert.deepStrictEqual(dev.on(2, 'padempty').pop(), [2, 'padempty', ...Array(16).fill(1)]);
  await b.waitFor(`S.dev.bankId === ${r.id} && S.dev.video === '-' && S.lib.banks.find((x) => x.id === ${r.id}).mix`);
  const set = async (f) => { const x = await b.eval(`cmd('setpad', ${JSON.stringify({ id: r.id, ...f })})`); assert.ok(x.ok, JSON.stringify([f, x])); };
  await set({ pad: 0, video: V1, start: STARTS[3], info: { title: 'überflüssig' } });   // Video bekannt: info wird ignoriert
  await set({ pad: 1, video: V2, start: STARTS[15] });
  await set({ pad: 2, video: V1, start: STARTS[5] });
  max.out = []; dev.out = [];
  await set({ pad: 2, video: null });                                                       // Icon „leeren“
  const lens = [16000, 5000, ...Array(14).fill(0)];
  await until(() => bankMsgs().some((m) => m[1] === r.id && m.slice(19, 35).join() === lens.join()), 'bank mit Mix-Längen');
  await until(() => max.out.some((o) => o[0] === 'analysisready'), 'analysisready');
  const m = bankMsgs().pop();
  assert.deepStrictEqual(m.slice(3, 19), [STARTS[3], STARTS[15], ...Array(14).fill(0)]);
  const pa = max.out.filter((o) => o[0] === 'padana');
  assert.deepStrictEqual(pa.map((o) => o[1]), [0, 1]);                                   // nur belegte Pads
  assert.ok(Math.abs(pa[0][2] - 120) < 1.5 && Math.abs(pa[1][2] - 100) < 1.5, pa.map((o) => o[2]).join());
  await until(() => dev.ctx.PA[1] && dev.ctx.PA[1].bpm > 0, 'PA im [js]');
  assert.deepStrictEqual(dev.on(2, 'padempty').pop(), [2, 'padempty', 0, 0, ...Array(14).fill(1)]);
  assert.strictEqual(node.libNow.lib.banks.find((x) => x.id === r.id).pads[2], null);
  // Anschlag auf beiden Videos mit Warp (Live 120 BPM): Tempo 1 bzw. 1,2, Position im eigenen Fach
  assert.strictEqual(dev.ctx.P.warp, 1);
  dev.out = [];
  dev.ctx.padhit(0); dev.ctx.padhit(1); dev.ctx.padhit(2);
  const w = dev.on(3, 'wplay');
  assert.strictEqual(w.length, 2, 'leerer Platz spielt nicht ' + JSON.stringify([dev.ctx.bankBusy, dev.ctx.muted, dev.ctx.durMs, dev.out.slice(0, 8)]));
  assert.ok(Math.abs(w[0][2]) < 1 && Math.abs(w[0][3] - 1) < 0.03, 'Pad 1: ' + w[0]);
  assert.ok(Math.abs(w[1][2] - 16000) < 1 && Math.abs(w[1][3] - 1.2) < 0.03, 'Pad 2: ' + w[1]);
  assert.match(dev.on(2, 'selinfo').pop().slice(2).join(' '), /leer/);
  await b.waitFor(`S.dev.sel === 2 && S.dev.video === '-'`);
  dev.ctx.padhit(1);
  await b.waitFor(`S.dev.sel === 1 && S.dev.video === '${V2}'`);
  assert.ok(eins > 0);
  assert.deepStrictEqual(b.errors, []);
});

t('aufräumen', async () => { b.close(); fs.rmSync(home, { recursive: true, force: true }); });

run();
