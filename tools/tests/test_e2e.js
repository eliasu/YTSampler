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
  Quantize: 'quantize', Volume: 'volume', Voices: 'voicecount', 'Base Note': 'basenote' };

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
  for (const v of [V1, V2]) beatWav(path.join(node.CACHE, `${v}.wav`), DUR / 1000, 120);
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

t('Bank-Regler am Device: banksel -> bank mit Längen, Pfad, Songdauer -> Editor folgt', async () => {
  await sleep(350);                                 // ready() nach init
  max.out = []; dev.out = [];                       // Bank 1 vom Aufbau nicht mitzählen
  dev.ctx.banknum(3);
  await until(() => bankMsgs().length, 'bank');
  const m = bankMsgs()[0];
  assert.deepStrictEqual(m.slice(1, 4), [ids[2], 3, 0]);
  assert.deepStrictEqual(m.slice(4, 20), STARTS);
  assert.deepStrictEqual(m.slice(20, 36), STARTS.map((s) => Math.min(16000, DUR - s)));
  assert.deepStrictEqual(m.slice(36), [DUR, V1, path.join(node.SNIP_DIR, `${ids[2]}.wav`)]);
  await until(() => dev.on(4, 'replace').length, 'replace an buffer~');
  assert.deepStrictEqual(dev.on(4, 'replace').pop(), [4, 'replace', path.join(node.SNIP_DIR, `${ids[2]}.wav`)]);
  assert.strictEqual(dev.ctx.st.bankId, ids[2]);
  await b.waitFor(`S.dev.bankId === ${ids[2]} && S.dev.nr === 3 && document.querySelector('#banklist li.on')?.dataset.id === '${ids[2]}'`);
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

t('aufräumen', async () => { b.close(); fs.rmSync(home, { recursive: true, force: true }); });

run();
