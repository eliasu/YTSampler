// Attrappen-Test für ytsampler_main.js ([js] in Max): Bänke, Song/Buffer-ms, Snippet-Klammer, Overlay, Bank-Regler,
// ready()-Sperren, Reglerwerte im bankstate, param vom Editor, Session nur mit bankId, Bank am Regler laden.
// Aufruf aus dem Projektordner: node tools/tests/test_main.js
var fs = require('fs'), vm = require('vm'), assert = require('assert'), path = require('path');

var ROOT = path.join(__dirname, '..', '..');

// lädt ein [js]-Skript mit Attrappen für outlet, Task, arrayfromargs, post, this.patcher.getnamed, LiveAPI.
// m.values[name] = Wert für getvalueof() (fehlt er, hat das Objekt kein getvalueof)
function load(src) {
    var m = { out: [], named: [], tasks: [], api: null, clock: 1000, values: {} };
    var ctx = {
        outlet: function (n) {
            var a = [n];
            for (var k = 1; k < arguments.length; k++) a = a.concat(arguments[k]);
            m.out.push(a);
        },
        arrayfromargs: function (a) { return Array.prototype.slice.call(a); },
        post: function () {},
        Task: function (fn, that) { this.fn = fn; this.pending = false; m.tasks.push(this); },
        LiveAPI: function (cb, p) { this.cb = cb; this.path = p; m.api = this; },
        patcher: { getnamed: function (name) {
            var o = { message: function () { m.named.push([name].concat(Array.prototype.slice.call(arguments))); } };
            if (name in m.values) o.getvalueof = function () { return m.values[name]; };
            return o;
        } }
    };
    ctx.Task.prototype.schedule = function (ms) { this.pending = true; this.ms = ms; };
    ctx.Task.prototype.cancel = function () { this.pending = false; };
    vm.createContext(ctx);
    vm.runInContext(src, ctx);
    ctx.nowMs = function () { return m.clock; };
    m.ctx = ctx;
    m.send = function (sel) { return ctx[sel].apply(ctx, Array.prototype.slice.call(arguments, 1)); };
    m.fire = function (task) { if (task.pending) { task.pending = false; task.fn(); } };
    m.take = function () { var o = m.out; m.out = []; return o; };
    m.on = function (n, sel) { return m.out.filter(function (o) { return o[0] === n && (!sel || o[1] === sel); }); };
    return m;
}

var SRC = fs.readFileSync(ROOT + '/ytsampler_main.js', 'utf8');
function startDevice(m) {
    m.send('init');
    m.fire(m.ctx.initTask);
    m.send('statenone');
}
function bankstates(m) { return m.on(1, 'bankstate'); }

var STARTS = [], LENS = [];
for (var i = 0; i < 16; i++) { STARTS.push(10000 + i * 20000); LENS.push(16000); }
LENS[5] = 3000;                                    // kurzes Snippet (Track endet früh)
// bank <id> <nr> <s×16> <l×16> <pfad…> (Spec Mix 3.3)
function bankMsg(id, nr, pathName, starts, lens) {
    return ['bank', id, nr].concat(starts || STARTS, lens || LENS, pathName.split(' '));
}
// wie Node: bank, danach bei bekanntem Tempo padana pro Pad (ohne Schläge)
function sendBank(m, id, nr, bpm, pathName) {
    m.send.apply(null, bankMsg(id, nr, pathName));
    if (bpm > 0) for (var i = 0; i < 16; i++) m.send('padana', i, bpm, 0, 0);
}
function beatsFor(bpm, dur) { var b = []; for (var t = 0; t < dur; t += 60000 / bpm) b.push(Math.round(t * 1000) / 1000); return b; }
// padana wie Node: Schläge im Fenster [start − 4 Schläge, start + l + 4 Schläge], off = Index des ersten − down
function padanaMsg(i, bpm, cent, b, down, start, len) {
    var w = 4 * 60000 / bpm, lo = start - w, hi = start + len + w, first = -1, sent = [];
    for (var j = 0; j < b.length; j++) if (b[j] >= lo && b[j] <= hi) { if (first < 0) first = j; sent.push(b[j]); }
    return ['padana', i, bpm, cent, first < 0 ? 0 : first - down].concat(sent);
}
function feedBeats(m, bpm, down) {
    var b = beatsFor(bpm, 400000);
    for (var i = 0; i < 16; i++) m.send.apply(null, padanaMsg(i, bpm, 0, b, down, STARTS[i], LENS[i]));
    m.send('analysisready');
    return b;
}

var tests = [];
function t(name, fn) { tests.push([name, fn]); }

t('ready()-Sperren: Regler und Tempo vor init tun nichts', function () {
    var m = load(SRC);
    m.send('libstate', 3, 1, 'ok');
    sendBank(m, 7, 1, 100, '/x/7.wav');
    m.take();
    m.named = [];
    m.send('banknum', 2); m.send('banknext'); m.send('bankprev'); m.send('param', 'warp', 1);
    assert.deepStrictEqual(m.on(1), [], 'nichts an Node');
    assert.deepStrictEqual(m.named, [], 'param vor ready() stellt nichts');
    assert.ok(!m.ctx.selTask.pending);
    startDevice(m); m.take();
    m.send('banknum', 2);
    assert.deepStrictEqual(m.on(1, 'bankpeek')[0], [1, 'bankpeek', 2]);
    m.fire(m.ctx.selTask);
    assert.deepStrictEqual(m.on(1, 'banksel')[0], [1, 'banksel', 2]);
});

t('bank: klingende Stimmen in beiden poly~ aus, replace erst nach dem Task, letzte Wahl gewinnt', function () {
    var m = load(SRC);
    startDevice(m);
    m.send('libstate', 3, 1, 'ok');
    sendBank(m, 7, 1, 100, '/x/7.wav');
    m.fire(m.ctx.replaceTask);
    feedBeats(m, 100, 0);
    m.send('note', 36, 100, 1);                    // Sampler-Stimme
    m.send('warp', 1); m.send('bpm', 120);
    m.send('note', 37, 100, 1);                    // Warp-Stimme
    m.take();
    sendBank(m, 8, 2, 0, '/x/8 a.wav');
    var off0 = m.on(0, 'gateoff'), off3 = m.on(3, 'gateoff');
    assert.deepStrictEqual(off0, [[0, 'gateoff', 5]], 'Sampler-Stimme ausgeblendet');
    assert.deepStrictEqual(off3, [[3, 'gateoff', 5]], 'Warp-Stimme ausgeblendet');
    assert.deepStrictEqual(m.on(4), [], 'replace noch nicht');
    assert.ok(m.ctx.replaceTask.pending && m.ctx.replaceTask.ms <= 20);
    sendBank(m, 9, 3, 0, '/x/9.wav');
    m.fire(m.ctx.replaceTask);
    assert.deepStrictEqual(m.on(4), [[4, 'replace', '/x/9.wav']], 'nur die letzte Bank');
    assert.strictEqual(m.ctx.st.bankId, 9);
    assert.ok(m.named.some(function (n) { return n[0] === 'bank' && n[1] === 'set' && n[2] === 3; }), 'Bank-Regler per set');
    // Pfad mit Leerzeichen bleibt ganz
    m.take(); sendBank(m, 8, 2, 0, '/x/8 a.wav'); m.fire(m.ctx.replaceTask);
    assert.deepStrictEqual(m.on(4), [[4, 'replace', '/x/8 a.wav']]);
});

t('Song-ms -> Buffer-ms in pos/wplay, playing in Song-ms', function () {
    var m = load(SRC);
    startDevice(m);
    sendBank(m, 7, 1, 100, '/x/7.wav');
    m.send('bpm', 120); m.take();
    m.send('note', 36 + 3, 100, 1);
    var pos = m.on(0, 'pos')[0];
    assert.strictEqual(pos[2], 3 * 16000, 'Fach 3 beginnt bei 48000');
    assert.strictEqual(pos[3], 3 * 16000 + 250, '1/8 bei 120 BPM = 250 ms');
    var pl = m.on(1, 'playing')[0];
    assert.deepStrictEqual(pl.slice(1, 4), ['playing', 3, STARTS[3]]);
    m.send('warp', 1); m.take();
    m.send('note', 36 + 4, 100, 1);
    assert.strictEqual(m.on(3, 'wplay')[0][2], 4 * 16000);
});

t('Klammer am Snippet-Ende: Trigger, Hold (10 ms), Hold rückwärts, Warp mit Beats', function () {
    var m = load(SRC);
    startDevice(m);
    sendBank(m, 7, 1, 100, '/x/7.wav');
    m.send('bpm', 120);
    m.send('division', 10);                        // 2 Takte = 4000 ms, Fach 5 hat nur 3000
    m.take();
    m.send('note', 36 + 5, 100, 1);
    var pos = m.on(0, 'pos')[0];
    assert.deepStrictEqual(pos.slice(2, 4), [5 * 16000, 5 * 16000 + 3000], 'Trigger gekappt');
    m.send('playmode', 1); m.take();
    m.send('note', 36 + 5, 100, 1);
    pos = m.on(0, 'pos')[0];
    assert.deepStrictEqual(pos.slice(2, 4), [5 * 16000, 5 * 16000 + 3000], 'Hold bis Snippet-Ende');
    var rel = m.on(0, 'rel')[0];
    assert.strictEqual(rel[3], 10, 'Hold blendet in 10 ms aus');
    assert.strictEqual(rel[2] + rel[3], pos[4], 'Ausblenden endet am Snippet-Ende');
    m.send('note', 36 + 5, 0, 1);
    m.send('reverse', 1); m.take();
    m.send('note', 36 + 5, 100, 1);
    pos = m.on(0, 'pos')[0];
    assert.deepStrictEqual(pos.slice(2, 4), [5 * 16000 + 3000, 5 * 16000], 'Hold rückwärts: Ende -> Start');
    assert.ok(m.on(1, 'playstop').length === 0);
    m.send('note', 36 + 5, 0, 1);
    assert.deepStrictEqual(m.on(1, 'playstop')[0], [1, 'playstop', 5]);
    // Warp mit Beats (ohne Grid-Schalter): Quelle 100 BPM, Live 120, Slice 2 Takte -> Quelle bräuchte 4800 ms, Fach hat 3000
    m.send('playmode', 0); m.send('reverse', 0);
    feedBeats(m, 100, 0);
    m.send('warp', 1); m.take();
    m.send('note', 36 + 5, 100, 1);
    var wp = m.on(3, 'wplay')[0], wr = m.on(3, 'rel')[0];
    var R = wp[3], realDur = wr[2] + wr[3];
    assert.strictEqual(wp[2], 5 * 16000);
    assert.ok(realDur * R <= 3000 + 1e-6, 'Warp-Stimme ist vor dem Fach-Ende aus: ' + realDur * R);
    // langes Fach: Ende folgt dem Raster der Quelle
    m.take(); m.send('note', 36 + 6, 100, 1);
    wp = m.on(3, 'wplay')[0]; wr = m.on(3, 'rel')[0];
    assert.ok(Math.abs((wr[2] + wr[3]) * wp[3] - 4800) < 1, '2 Takte in der Quelle');
});

t('4 Bars: neuer höchster Division-Wert, alte Indizes unverändert; Klammer am Snippet-Ende', function () {
    var m = load(SRC);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(m.ctx.DIVS.map(function (d) { return d[0]; }))),
        ['1/64', '1/32', '1/16T', '1/16', '1/8T', '1/8', '1/4T', '1/4', '1/2', '1 Bar', '2 Bars', '4 Bars']);
    assert.strictEqual(m.ctx.DIVS[11][1], 4);
    startDevice(m);
    sendBank(m, 7, 1, 100, '/x/7.wav');
    m.send('bpm', 120); m.send('division', 11);    // 16 Schläge bei 120 = 8000 ms
    m.take(); m.send('note', 36, 100, 1);
    assert.deepStrictEqual(m.on(0, 'pos')[0].slice(2, 5), [0, 8000, 8000], '120 BPM: ganz');
    m.send('division', 99); assert.strictEqual(m.ctx.P.div, 11, 'darüber: 4 Bars');
    m.send('bpm', 60); m.take(); m.send('note', 37, 100, 1);
    assert.deepStrictEqual(m.on(0, 'pos')[0].slice(2, 4), [16000, 32000], '60 BPM: genau ein Fach');
    m.send('bpm', 50); m.take(); m.send('note', 38, 100, 1);
    assert.deepStrictEqual(m.on(0, 'pos')[0].slice(2, 4), [32000, 48000], 'unter 60 BPM: am Snippet-Ende geklammert');
    // Warp: Quelle 55 BPM bräuchte 17455 ms, das Fach hat 16000
    m.send('bpm', 120); m.send('warp', 1); m.send('padana', 3, 55, 0, 0); m.take();
    m.send('note', 39, 100, 1);
    var wp = m.on(3, 'wplay')[0], wr = m.on(3, 'rel')[0];
    assert.ok((wr[2] + wr[3]) * wp[3] <= 16000 + 1e-6, 'Warp-Stimme endet am Fach-Ende');
    // Quelle 100 BPM: 9600 ms, passt
    m.take(); m.send('note', 40, 100, 1);
    wp = m.on(3, 'wplay')[0]; wr = m.on(3, 'rel')[0];
    assert.ok(Math.abs((wr[2] + wr[3]) * wp[3] - 9600) < 1, '4 Takte in der Quelle');
});

t('effStart fest, kein Einrasten bei Beats', function () {
    var m = load(SRC);
    startDevice(m);
    STARTS[2] = 50123;
    sendBank(m, 7, 1, 100, '/x/7.wav');
    feedBeats(m, 100, 0);
    assert.strictEqual(m.ctx.effStart(2), 50123);
    assert.ok(!('gridon' in m.ctx) && !('snapmode' in m.ctx), 'Grid/Snap gibt es nicht mehr');
    STARTS[2] = 50000;
});

t('Overlay in Buffer-ms ohne Schalter: show nach beatsOK, dur, beats, bars, pads', function () {
    var m = load(SRC);
    startDevice(m);
    sendBank(m, 7, 1, 100, '/x/7.wav');
    assert.deepStrictEqual(m.on(2, 'grid').filter(function (o) { return o[2] === 'show'; }).pop(), [2, 'grid', 'show', 0], 'ohne Beats aus');
    m.take();
    var b = feedBeats(m, 100, 1);
    assert.deepStrictEqual(m.on(2, 'grid').filter(function (o) { return o[2] === 'show'; }).pop(), [2, 'grid', 'show', 1], 'mit Beats an');
    var g = m.on(2, 'grid'), last = g.lastIndexOf(g.filter(function (o) { return o[2] === 'clear'; }).pop());
    g = g.slice(last);
    assert.deepStrictEqual(g.filter(function (o) { return o[2] === 'dur'; })[0], [2, 'grid', 'dur', 256000]);
    var beats = [], bars = [];
    g.forEach(function (o) { if (o[2] === 'beats') beats = beats.concat(o.slice(3)); if (o[2] === 'bars') bars = bars.concat(o.slice(3)); });
    assert.ok(g.every(function (o) { return o[2] !== 'down'; }), 'kein down mehr');
    var want = [], wantBars = [];
    for (var i = 0; i < 16; i++) for (var j = 0; j < b.length; j++) {
        if (b[j] >= STARTS[i] && b[j] < STARTS[i] + LENS[i]) { want.push(i * 16000 + b[j] - STARTS[i]); if ((j - 1) % 4 === 0) wantBars.push(i * 16000 + b[j] - STARTS[i]); }
    }
    assert.deepStrictEqual(beats, want);
    assert.deepStrictEqual(bars, wantBars);
    assert.ok(beats.every(function (x) { var k = Math.floor(x / 16000); return x - k * 16000 < LENS[k]; }), 'nur Schläge im Fach');
    var pads = g.filter(function (o) { return o[2] === 'pads'; }).pop();
    var bounds = []; for (i = 0; i < 16; i++) bounds.push(i * 16000);
    assert.deepStrictEqual(pads.slice(4), bounds);
    var ws = m.on(2, 'wsel').pop();
    assert.strictEqual(ws[2], 0, 'wsel in Buffer-ms');
});

t('bankstate nur bei Änderung, Song-ms, w gekappt auf l', function () {
    var m = load(SRC);
    startDevice(m);
    sendBank(m, 7, 1, 100, '/x/7.wav');
    m.send('bpm', 120); m.send('playmode', 1);
    m.take();
    m.send('updateSel'); m.send('updateSel');
    m.send('reverse', 1);
    var bs = m.on(1, 'bankstate');
    assert.strictEqual(bs.length, 1, 'einmal für reverse');
    var b = bs[0];
    assert.deepStrictEqual(b.slice(1, 6), ['bankstate', 7, 0, 1, 1], 'ohne Video');
    assert.deepStrictEqual(b.slice(6, 22), STARTS);
    assert.deepStrictEqual(b.slice(22, 38), LENS, 'Hold: ganze Snippets');
    // angehängt: div rate tune warp quant vol voices base qdiv qcatch bpm (Lives Tempo, fürs Vorhören im Editor) norm
    assert.strictEqual(b.length, 38 + 12);
    assert.deepStrictEqual(b.slice(38), [5, 1, 0, 0, 0, 0, 6, 36, 1, 0, 120, 1]);
});

t('bankstate: die zwölf Reglerwerte, gerundet, nur bei Änderung', function () {
    var m = load(SRC);
    startDevice(m);
    sendBank(m, 7, 1, 100, '/x/7.wav');
    m.send('bpm', 120);
    var steps = [['division', 3], ['rate', 1.23456], ['playmode', 1], ['reverse', 1], ['tune', 1], ['warp', 1],
        ['quantize', 1], ['volume', -3.54], ['voicecount', 2], ['basenote', 48], ['quantdiv', 2], ['quantcatch', 1], ['normalize', 0]];
    steps.forEach(function (st) {
        m.take();
        m.send.apply(null, st);
        assert.strictEqual(bankstates(m).length, 1, st[0] + ' meldet einmal');
    });
    var b = bankstates(m)[0];
    assert.deepStrictEqual(b.slice(4, 6), [1, 1], 'mode rev');
    assert.deepStrictEqual(b.slice(38), [3, 1.235, 1, 1, 1, -3.5, 2, 48, 2, 1, 120, 0]);
    m.take(); m.send('bpm', 98.7654);
    assert.strictEqual(bankstates(m)[0][48], 98.77, 'Tempo meldet mit, gerundet');
    assert.strictEqual(m.ctx.P.voices, 3, 'Index 2 = 3 Stimmen');
    // Mikroänderung unterhalb der Rundung: kein neues bankstate
    m.take(); m.send('volume', -3.52); m.send('rate', 1.2349);
    assert.strictEqual(bankstates(m).length, 0);
    // nochmal derselbe Wert: nichts
    m.take(); m.send('basenote', 48); m.send('tune', 1);
    assert.strictEqual(bankstates(m).length, 0);
});

t('Lautstärke pro Pad: env × 10^((Ausgleich + Trim)/20), Normalize aus = nur Trim, neue Bank setzt zurück', function () {
    var m = load(SRC);
    startDevice(m);
    sendBank(m, 7, 1, 100, '/x/7.wav');
    m.send('bpm', 120);
    var amp = function (pad) { m.take(); m.send('note', 36 + pad, 127, 1); var e = m.on(0, 'env').concat(m.on(3, 'env')); return e[e.length - 1][2]; };
    assert.strictEqual(amp(0), 1, 'ohne padgain unverändert');
    m.send('padgain', 0, 6, 0); m.send('padgain', 1, -6, 2); m.send('padgain', 2, 12, 6);
    assert.ok(Math.abs(amp(0) - Math.pow(10, 6 / 20)) < 1e-9, 'Ausgleich +6 dB');
    assert.ok(Math.abs(amp(1) - Math.pow(10, -4 / 20)) < 1e-9, 'Ausgleich + Trim');
    assert.ok(Math.abs(amp(2) - Math.pow(10, 18 / 20)) < 1e-9, 'über 1 geht');
    m.send('normalize', 0);
    assert.strictEqual(amp(0), 1, 'Norm aus: kein Ausgleich');
    assert.ok(Math.abs(amp(1) - Math.pow(10, 2 / 20)) < 1e-9, 'Norm aus: Trim wirkt');
    m.send('warp', 1);
    assert.ok(Math.abs(amp(1) - Math.pow(10, 2 / 20)) < 1e-9, 'Warp-Stimme ebenso');
    m.send('normalize', 1); m.send('warp', 0);
    m.send('padgain', 99, 6, 6); m.send('padgain', -1, 6, 6);   // außerhalb: nichts
    sendBank(m, 8, 2, 100, '/x/8.wav');
    assert.strictEqual(amp(2), 1, 'neue Bank: zurück auf 0 dB bis padgain kommt');
});

t('param vom Editor -> setNamed mit varname, unbekannt -> nichts', function () {
    var m = load(SRC);
    startDevice(m);
    var want = { div: 'Division', rate: 'Rate', mode: 'Mode', rev: 'Reverse', tune: 'Tune', warp: 'Warp',
        quant: 'Quantize', qdiv: 'Quant Div', qcatch: 'Quant Catch', vol: 'Volume', voices: 'Voices', base: 'Base Note', norm: 'Normalize' };
    Object.keys(want).forEach(function (n) {
        m.named = [];
        m.send('param', n, 1);
        assert.deepStrictEqual(m.named, [[want[n], 1]], n);
    });
    m.named = [];
    m.send('param', 'bank', 3); m.send('param', 'constructor', 1); m.send('param', 'Tonal', 1);
    assert.deepStrictEqual(m.named, [], 'nur die zwölf Regler');
    m.send('param', 'vol', -12.5);
    assert.deepStrictEqual(m.named, [['Volume', -12.5]]);
});

t('MIDI: Kanal 15 und 16 spielen Pads, Kanal zählt nicht', function () {
    var m = load(SRC);
    startDevice(m);
    sendBank(m, 7, 1, 100, '/x/7.wav');
    m.send('bpm', 120); m.take();
    m.send('note', 36 + 2, 100, 16);
    m.send('note', 36 + 3, 100, 15);
    m.send('note', 36 + 4, 100, 1);
    assert.deepStrictEqual(m.on(1, 'playing').map(function (o) { return o[2]; }), [2, 3, 4]);
    assert.deepStrictEqual(m.on(1, 'key'), []);
    assert.strictEqual(m.on(0, 'pos').length, 3);
});

t('Feste Attack 2 ms / Release 20 ms in env, rel, gateoff', function () {
    var m = load(SRC);
    startDevice(m);
    sendBank(m, 7, 1, 100, '/x/7.wav');
    m.send('bpm', 120); m.take();
    m.send('note', 36, 100, 1);
    var env = m.on(0, 'env'), rel = m.on(0, 'rel')[0];
    assert.deepStrictEqual(env[1], [0, 'env', 100 / 127, 2]);
    assert.strictEqual(rel[3], 20);
    assert.strictEqual(rel[2], 250 - 20);
    ['threshold', 'attack', 'release', 'srcbpm', 'bpmhalf', 'bpmdouble', 'loaded', 'loadfail', 'silence'].forEach(function (f) {
        assert.ok(!(f in m.ctx), f + ' gibt es nicht mehr');
    });
    // Hold loslassen: gateoff 20
    m.send('playmode', 1); m.send('note', 37, 100, 1); m.take();
    m.send('note', 37, 0, 1);
    assert.deepStrictEqual(m.on(0, 'gateoff'), [[0, 'gateoff', 20]]);
});

t('Prev/Next: Enden, über 128, 350 ms Ruhe', function () {
    var m = load(SRC);
    startDevice(m);
    m.send('libstate', 130, 129, 'ok');
    sendBank(m, 7, 129, 100, '/x/7.wav');
    m.take(); m.named = [];
    m.send('banknext');
    assert.deepStrictEqual(m.on(1, 'bankpeek'), [[1, 'bankpeek', 130]]);
    assert.deepStrictEqual(m.named.pop(), ['bank', 'set', 128], 'Regler bleibt auf 128');
    assert.strictEqual(m.ctx.selTask.ms, 350);
    m.send('bankpeek', 130, 130, 'Letzte', 'Bank');
    assert.deepStrictEqual(m.on(2, 'shownr').pop(), [2, 'shownr', '130']);
    assert.deepStrictEqual(m.on(2, 'showname').pop(), [2, 'showname', 'Letzte Bank']);
    m.take();
    m.send('banknext');
    assert.deepStrictEqual(m.on(1), [], 'an der letzten Bank bleibt es stehen');
    m.fire(m.ctx.selTask);
    assert.deepStrictEqual(m.on(1, 'banksel'), [[1, 'banksel', 130]]);
    // Anfang
    sendBank(m, 7, 1, 100, '/x/7.wav');
    m.take(); m.send('bankprev');
    assert.deepStrictEqual(m.on(1), [], 'an der ersten Bank bleibt es stehen');
    // über der letzten: Anzeige leer
    m.send('bankpeek', 140, 130);
    assert.deepStrictEqual(m.on(2, 'showname').pop(), [2, 'showname', 'leer']);
    // bankfail: Anzeige zurück auf die klingende Bank
    m.send('bankname', 7, 'Funk');
    m.send('bankfail', 9, 'Snippets', 'fehlen');
    assert.deepStrictEqual(m.on(2, 'shownr').pop(), [2, 'shownr', '1']);
    assert.deepStrictEqual(m.on(2, 'status').pop(), [2, 'status', 'nicht ladbar']);
    m.fire(m.ctx.flashTask);
    assert.notStrictEqual(m.on(2, 'status').pop()[2], 'nicht ladbar', 'nach 2 s wieder die normale Zeile');
});

t('Ablage-Bank (Nummer 0): Anzeige „-“, Regler bleibt; Prev/Next und Regler zurück auf die Bühne', function () {
    var m = load(SRC);
    startDevice(m);
    m.values.bank = 3;
    m.send('libstate', 5, 3, 'ok');
    sendBank(m, 7, 3, 100, '/x/7.wav');
    m.take(); m.named = [];
    sendBank(m, 9, 0, 100, '/x/9.wav');            // Ablage-Bank aus dem Editor
    assert.deepStrictEqual(m.on(2, 'shownr').pop(), [2, 'shownr', '-']);
    assert.deepStrictEqual(m.named, [], 'Regler bleibt auf 3');
    ['banknext', 'bankprev'].forEach(function (b) {
        m.take(); m.ctx.peekNr = 0;
        m.send(b);
        assert.deepStrictEqual(m.on(1, 'bankpeek'), [[1, 'bankpeek', 3]], b + ' von „-“: Bank am Regler');
    });
    m.fire(m.ctx.selTask);
    m.take(); m.ctx.peekNr = 0;
    m.send('banknum', 4);
    assert.deepStrictEqual(m.on(1, 'bankpeek'), [[1, 'bankpeek', 4]], 'Regler: Bank seines Werts');
    m.fire(m.ctx.selTask);
    // aktive Bühnen-Bank wandert in die Ablage: libstate mit Nummer 0
    sendBank(m, 7, 3, 100, '/x/7.wav');
    m.take();
    m.send('libstate', 4, 0, 'ok');
    assert.strictEqual(m.ctx.B.nr, 0);
    assert.deepStrictEqual(m.on(2, 'shownr').pop(), [2, 'shownr', '-']);
});

t('Tempo pro Pad: Warp ohne Beats festes Verhältnis, mit Beats folgt das Raster, ohne padana kein Tempo', function () {
    var m = load(SRC);
    startDevice(m);
    sendBank(m, 7, 1, 0, '/x/7.wav');
    m.send('bpm', 120); m.send('warp', 1); m.send('division', 9);   // 1 Takt
    m.send('padana', 0, 100, 0, 0);
    assert.ok(m.ctx.tempoTrusted(0) && !m.ctx.beatsOK(0));
    m.take(); m.send('note', 36, 100, 1);
    var wp = m.on(3, 'wplay')[0], wr = m.on(3, 'rel')[0];
    assert.ok(Math.abs(wp[3] - 1.2) < 1e-9, 'festes Verhältnis 120/100');
    assert.ok(Math.abs((wr[2] + wr[3]) - 2000) < 1e-6, '1 Takt bei 120 BPM');
    assert.ok(m.on(2, 'selinfo').pop()[2].indexOf(' T') < 0, 'ohne Beats keine Taktposition');
    // Beats weichen vom Tempo ab (96 statt 100 BPM): Slice endet auf dem Raster der Quelle
    m.send.apply(null, padanaMsg(0, 100, 0, beatsFor(96, 400000), 0, STARTS[0], LENS[0]));
    assert.ok(m.ctx.beatsOK(0));
    m.take(); m.send('note', 36, 100, 1);
    wp = m.on(3, 'wplay')[0]; wr = m.on(3, 'rel')[0];
    assert.ok(Math.abs((wr[2] + wr[3]) * wp[3] - 4 * 60000 / 96) < 1, 'Raster der Quelle: 4 Schläge à 625 ms');
    assert.ok(/  T\d+\.\d/.test(m.on(2, 'selinfo').pop()[2]), 'Taktposition mit Beats');
    // Pad ohne padana: W: kein Tempo, Sampler-Stimme
    m.take(); m.send('note', 37, 100, 1);
    assert.strictEqual(m.on(3, 'wplay').length, 0);
    assert.strictEqual(m.on(0, 'pos').length, 1);
    assert.ok(m.on(2, 'selinfo').pop()[2].indexOf('W: kein Tempo') > 0);
});

t('Weggefallen: tempo, tuning, beats*, bpm mit Video, keine Analyse-Anfragen mehr', function () {
    var m = load(SRC);
    startDevice(m);
    ['tempo', 'tuning', 'beatsclear', 'beatsadd', 'beatsdone', 'requestBeats', 'requestAll', 'analysisSpan',
     'srcBpm', 'tuningCents', 'videoId', 'beatsDown', 'ANALYSIS_MS'].forEach(function (f) {
        assert.ok(!(f in m.ctx), f + ' gibt es nicht mehr');
    });
    m.send('bpm', 124);
    sendBank(m, 7, 1, 100, '/x/7.wav');
    m.send('analysisready');
    [['division', 0], ['division', 10], ['rate', 2], ['playmode', 1], ['warp', 1], ['bpm', 128]].forEach(function (x) { m.send.apply(null, x); });
    assert.deepStrictEqual(m.out.filter(function (o) { return o[0] === 1 && (o[1] === 'analyzeall' || o[1] === 'beattrack'); }), []);
    assert.strictEqual(m.ctx.P.bpm, 128, 'Lives Tempo kommt an');
});

t('Session: speichert nur bankId, liest alte Dateien, bankId -> bankopen', function () {
    var m = load(SRC);
    m.send('init'); m.fire(m.ctx.initTask);
    m.send('libstate', 3, 1, 'ok');
    var o = { bankId: 7, id: 'F2RnxZnubCM', title: 'Funk', pads: STARTS, srcBpm: 99.5, srcAuto: 0, bpmConf: 0.4 };
    m.take();
    m.send('state', encodeURIComponent(JSON.stringify(o)));
    assert.deepStrictEqual(m.on(1, 'bankopen'), [[1, 'bankopen', 7]]);
    assert.deepStrictEqual(m.on(1, 'bankload'), []);
    assert.deepStrictEqual(m.on(2, 'status').pop(), [2, 'status', 'Lade letzten Stand …']);
    sendBank(m, 7, 1, 100, '/x/7.wav');
    var saved = JSON.parse(decodeURIComponent(m.on(1, 'savestate').pop()[2]));
    assert.deepStrictEqual(saved, { bankId: 7 });
    assert.deepStrictEqual(Object.keys(m.ctx.st), ['bankId']);
    // Node neu gestartet, derselbe Stand: nichts neu laden
    m.take(); m.send('needsession');
    m.send('state', m.ctx.lastSaved);
    assert.deepStrictEqual(m.on(1, 'bankopen'), []);
    assert.deepStrictEqual(m.on(1, 'bankload'), []);
});

t('Ohne Bank: 1.x-/Teletext-Session, statenone, bankId 0 -> bankload <Regler>, erst nach libstate ok', function () {
    // libstate ok vor state (Reihenfolge von Node): sofort
    var m = load(SRC);
    m.values.bank = 5;
    m.send('init'); m.fire(m.ctx.initTask);
    m.send('libstate', 9, 0, 'ok');
    m.take();
    m.send('state', encodeURIComponent(JSON.stringify({ id: 'abcdefghijk', title: 'Alt', pads: STARTS, locks: [], favs: [], fav: 2 })));
    assert.deepStrictEqual(m.on(1, 'bankload'), [[1, 'bankload', 5]]);
    assert.deepStrictEqual(m.on(1, 'load'), []);
    assert.strictEqual(m.ctx.st.bankId, 0);
    assert.deepStrictEqual(m.on(2, 'status').pop(), [2, 'status', 'Lade letzten Stand …']);
    // Teletext-Stand aus 2.x (bankId 0 mit Kopie)
    m = load(SRC); m.values.bank = 2;
    m.send('init'); m.fire(m.ctx.initTask); m.send('libstate', 9, 0, 'ok'); m.take();
    m.send('state', encodeURIComponent(JSON.stringify({ bankId: 0, id: 'abcdefghijk', title: 'T', pads: STARTS })));
    assert.deepStrictEqual(m.on(1, 'bankload'), [[1, 'bankload', 2]]);
    // statenone vor libstate: warten, dann bei ok laden. Ohne getvalueof (Attrappe fehlt): 1
    m = load(SRC);
    startDevice(m);
    assert.deepStrictEqual(m.on(1, 'bankload'), [], 'noch kein libstate');
    m.send('libstate', 0, 0, 'leer');
    assert.deepStrictEqual(m.on(1, 'bankload'), [], 'leer: nichts');
    assert.deepStrictEqual(m.on(2, 'showname').pop(), [2, 'showname', 'Bibliothek leer']);
    m.take();
    m.send('libstate', 1, 0, 'ok');
    assert.deepStrictEqual(m.on(1, 'bankload'), [[1, 'bankload', 1]]);
    // libstate ok vor state: erst nach state
    m = load(SRC); m.values.bank = [130.0];
    m.send('init'); m.fire(m.ctx.initTask);
    m.send('libstate', 3, 0, 'ok');
    assert.deepStrictEqual(m.on(1, 'bankload'), [], 'state noch nicht da');
    m.send('statenone');
    assert.deepStrictEqual(m.on(1, 'bankload'), [[1, 'bankload', 128]], 'Regler höchstens 128');
    // Bank kommt: kein weiteres bankload bei späteren libstate ok
    sendBank(m, 7, 3, 100, '/x/7.wav');
    m.take(); m.send('libstate', 3, 3, 'ok');
    assert.deepStrictEqual(m.on(1, 'bankload'), []);
});

t('bankgone: Bank gelöscht -> bankload <Regler>, Pads tun nichts bis zur neuen Bank', function () {
    var m = load(SRC);
    m.values.bank = 4;
    m.send('init'); m.fire(m.ctx.initTask);
    m.send('libstate', 5, 0, 'ok');
    m.send('state', encodeURIComponent(JSON.stringify({ bankId: 7 })));
    sendBank(m, 7, 4, 100, '/x/7.wav');
    m.fire(m.ctx.replaceTask);
    m.send('note', 36, 100, 1);                    // klingt
    m.take();
    m.send('bankgone', 7);
    assert.deepStrictEqual(m.on(0, 'gateoff'), [[0, 'gateoff', 5]], 'klingende Stimme aus');
    assert.deepStrictEqual(m.on(1, 'bankload'), [[1, 'bankload', 4]]);
    assert.deepStrictEqual(m.on(1, 'load'), []);
    assert.deepStrictEqual(m.on(2, 'status').pop(), [2, 'status', 'Bank gelöscht']);
    m.fire(m.ctx.flashTask);
    assert.deepStrictEqual(m.on(2, 'status').pop(), [2, 'status', 'Lade letzten Stand …']);
    assert.deepStrictEqual(JSON.parse(decodeURIComponent(m.on(1, 'savestate').pop()[2])), { bankId: 0 });
    assert.deepStrictEqual(m.on(2, 'shownr').pop(), [2, 'shownr', '-']);
    m.take(); m.send('note', 36, 100, 1); m.send('padhit', 2);
    assert.deepStrictEqual(m.on(0), [], 'nichts geladen: stumm');
    assert.deepStrictEqual(m.on(1, 'playing'), []);
    sendBank(m, 9, 4, 100, '/x/9.wav');
    m.take(); m.send('note', 36, 100, 1);
    assert.strictEqual(m.on(0, 'pos').length, 1, 'Nachrücker spielt');
});

t('bankfail ohne klingende Bank: stumm, „nicht ladbar“, Status', function () {
    var m = load(SRC);
    startDevice(m);
    m.send('libstate', 3, 0, 'ok');
    assert.deepStrictEqual(m.on(1, 'bankload'), [[1, 'bankload', 1]]);
    m.take();
    m.send('bankfail', 1, 'Snippets', 'fehlen');
    assert.deepStrictEqual(m.on(2, 'shownr').pop(), [2, 'shownr', '-']);
    assert.deepStrictEqual(m.on(2, 'showname').pop(), [2, 'showname', 'nicht ladbar']);
    assert.deepStrictEqual(m.on(2, 'status').pop(), [2, 'status', 'Bank im Editor prüfen']);
    assert.strictEqual(m.ctx.muted, 1);
    m.take(); m.send('note', 36, 100, 1);
    assert.deepStrictEqual(m.on(0), []);
    // andere Bank gewählt: spielt
    sendBank(m, 8, 2, 100, '/x/8.wav');
    assert.strictEqual(m.ctx.muted, 0);
    m.take(); m.send('note', 36, 100, 1);
    assert.strictEqual(m.on(0, 'pos').length, 1);
});

t('Bibliothek leer/kaputt: stumm, wieder ok -> bankopen', function () {
    var m = load(SRC);
    startDevice(m);
    sendBank(m, 7, 1, 100, '/x/7.wav');
    m.take();
    m.send('libstate', 0, 0, 'kaputt');
    assert.deepStrictEqual(m.on(4), [[4, 'clear']]);
    assert.deepStrictEqual(m.on(2, 'showname').pop(), [2, 'showname', 'Bibliothek kaputt']);
    m.take(); m.send('note', 36, 100, 1);
    assert.deepStrictEqual(m.on(0), [], 'stumm');
    m.send('libstate', 3, 1, 'ok');
    assert.deepStrictEqual(m.on(1, 'bankopen'), [[1, 'bankopen', 7]], 'wieder lesbar -> Bank neu laden');
    assert.deepStrictEqual(m.on(1, 'bankload'), []);
});

t('trackname über LiveAPI', function () {
    var m = load(SRC);
    startDevice(m);
    assert.strictEqual(m.api.path, 'this_device canonical_parent');
    assert.strictEqual(m.api.property, 'name');
    m.take();
    m.api.cb(['name', '"1-YT', 'Sampler"']);
    assert.deepStrictEqual(m.on(1, 'trackname'), [[1, 'trackname', '1-YT Sampler']]);
});

// Quant-Raster: nur der Tick des eingestellten Rasters zählt, Wartefenster wächst mit dem Raster
t('Quant Div: tick <index> nur vom eingestellten Raster, Anschlag wartet darauf', function () {
    var m = load(SRC);
    startDevice(m);
    sendBank(m, 7, 1, 100, '/x/7.wav');
    m.send('bpm', 120);
    m.send('quantize', 1);
    m.send('quantdiv', 3);                 // 1/4 = 500 ms bei 120 BPM
    m.send('tick', 3);
    m.clock += 200; m.take();
    m.send('tick', 1);                     // 1/16-Tick: darf hier nichts auslösen
    m.send('padhit', 2);
    assert.strictEqual(m.on(1, 'playing').length, 0, 'wartet auf die nächste 1/4');
    m.send('tick', 1);
    assert.strictEqual(m.on(1, 'playing').length, 0, '1/16-Tick spielt nicht ab');
    m.clock += 300;
    m.send('tick', 3);
    assert.strictEqual(m.on(1, 'playing').length, 1, '1/4-Tick spielt ab');
    // knapp nach dem Raster: höchstens 0,3 einer 1/16 (37,5 ms) gilt als zu spät gedrückt
    m.send('padup', 2); m.clock += 30; m.take();
    m.send('padhit', 3);
    assert.strictEqual(m.on(1, 'playing').length, 1, 'zu spät gedrückt: sofort');
    // Rasterwechsel: Wartendes spielt sofort, danach kein Warten bis zum ersten neuen Tick
    m.clock += 100; m.take();
    m.send('padhit', 4);
    assert.strictEqual(m.on(1, 'playing').length, 0);
    m.send('quantdiv', 1);
    assert.strictEqual(m.on(1, 'playing').length, 1, 'Wechsel spielt Wartendes');
    m.take();
    m.send('padhit', 5);
    assert.strictEqual(m.on(1, 'playing').length, 1, 'noch kein neuer Tick: sofort');
});

t('Catch: bei 1/8 und 1/4 zu spät (erste Rasterhälfte) später einsteigen, zu früh warten; bei 1/16 und aus wie bisher', function () {
    function setup(qdiv, on) {
        var m = load(SRC);
        startDevice(m);
        sendBank(m, 7, 1, 100, '/x/7.wav');
        m.send('bpm', 120);
        m.send('quantize', 1); m.send('quantdiv', qdiv); m.send('quantcatch', on);
        m.send('division', 7);             // Slice 1/4 = 500 ms
        m.send('tick', qdiv); m.take();
        return m;
    }
    var S0 = STARTS[2];
    var m = setup(2, 1);                   // 1/8: 100 ms zu spät
    m.clock += 100; m.send('padhit', 2);
    var p = m.on(1, 'playing');
    assert.strictEqual(p.length, 1, 'klingt sofort');
    assert.ok(Math.abs(p[0][3] - (S0 + 100)) < 0.01, 'Start 100 ms versetzt');
    assert.ok(Math.abs(p[0][4] - (S0 + 500)) < 0.01, 'Ende auf dem Raster');
    assert.ok(Math.abs(p[0][5] - 400) < 0.01, 'Dauer gekürzt');
    m = setup(2, 1); m.clock += 200; m.send('padhit', 2);   // 1/8: 50 ms vor dem nächsten Punkt = zu früh
    assert.strictEqual(m.on(1, 'playing').length, 0, '1/8 zu früh: wartet');
    m.clock += 50; m.send('tick', 2);
    assert.strictEqual(m.on(1, 'playing')[0][3], S0, '1/8 zu früh: auf dem Tick vom Anfang');
    m = setup(3, 1);                       // 1/4: 200 ms aufholen, 300 ms warten
    m.clock += 200; m.send('padhit', 2);
    assert.ok(Math.abs(m.on(1, 'playing')[0][3] - (S0 + 200)) < 0.01);
    m = setup(3, 1); m.clock += 300; m.send('padhit', 2);
    assert.strictEqual(m.on(1, 'playing').length, 0, 'zweite Rasterhälfte: wartet');
    m.clock += 200; m.send('tick', 3);
    assert.strictEqual(m.on(1, 'playing')[0][3], S0, 'auf dem Tick vom Anfang');
    m = setup(1, 1); m.clock += 20; m.send('padhit', 2);   // 1/16: Catch wirkt nicht
    assert.strictEqual(m.on(1, 'playing')[0][3], S0, '1/16 wie bisher');
    m = setup(2, 0); m.clock += 20; m.send('padhit', 2);   // aus
    assert.strictEqual(m.on(1, 'playing')[0][3], S0, 'aus: knapp zu spät vom Anfang');
    m = setup(2, 0); m.clock += 100; m.send('padhit', 2);
    assert.strictEqual(m.on(1, 'playing').length, 0, 'aus: später wartet');
    m = setup(2, 1); m.send('division', 0); m.take(); m.clock += 100; m.send('padhit', 2);   // Slice kürzer als der Versatz
    assert.strictEqual(m.on(1, 'playing')[0][3], S0, 'kurzer Slice: Ton vom Anfang statt Stille');
});

t('bankbusy: Anschlag wartet auf neue Snippets im Buffer und spielt dann die neue Stelle', function () {
    var m = load(SRC);
    startDevice(m);
    sendBank(m, 7, 1, 100, '/x/7.wav');
    m.send('bpm', 120); m.take();
    m.send('bankbusy');
    m.send('padhit', 2); m.send('padup', 2);
    assert.strictEqual(m.on(1, 'playing').length, 0, 'wartet');
    m.send('bufloaded');                   // alter Ladevorgang: zählt erst nach bank
    assert.strictEqual(m.on(1, 'playing').length, 0, 'noch keine neue Bank');
    var neu = bankMsg(7, 1, '/x/7.wav'); neu[3 + 2] = 77777;   // ['bank', id, nr, s0, s1, s2 …]
    m.send.apply(null, neu);
    assert.strictEqual(m.on(1, 'playing').length, 0, 'Buffer lädt noch');
    m.send('bufloaded');
    var p = m.on(1, 'playing');
    assert.strictEqual(p.length, 1, 'jetzt');
    assert.strictEqual(p[0][3], 77777, 'neue Stelle');
    m.take(); m.send('padhit', 3);
    assert.strictEqual(m.on(1, 'playing').length, 1, 'danach wieder sofort');
});

// ---------- Mix-Bänke (Spec Mix 4.1–4.4): Pads 0–7 aus Video A (100 BPM), 8–15 aus Video B (80 BPM) ----------
function mixDevice(opt) {
    var m = load(SRC);
    startDevice(m);
    m.send('libstate', 3, 1, 'ok');
    var lens = LENS.slice();
    (opt && opt.empty || []).forEach(function (k) { lens[k] = 0; });
    m.send.apply(null, bankMsg(13, 2, '/x/13.wav', STARTS, lens));
    m.fire(m.ctx.replaceTask);
    var bA = beatsFor(100, 400000), bB = beatsFor(80, 400000);
    for (var i = 0; i < 16; i++) {
        if (!lens[i]) continue;
        if (i < 8) m.send.apply(null, padanaMsg(i, 100, 0, bA, 0, STARTS[i], lens[i]));
        else m.send.apply(null, padanaMsg(i, 80, 50, bB, 1, STARTS[i], lens[i]));
    }
    m.send('analysisready');
    m.send('bpm', 120);
    return { m: m, bA: bA, bB: bB, lens: lens };
}

t('Mix: Warp-Faktor pro Pad aus dem Tempo seines Videos', function () {
    var m = mixDevice().m;
    m.send('warp', 1); m.send('playmode', 1);        // Hold: festes Verhältnis, Raster egal
    m.take(); m.send('note', 36 + 2, 100, 1); m.send('note', 36 + 10, 100, 1);
    var wp = m.on(3, 'wplay');
    assert.strictEqual(wp.length, 2);
    assert.ok(Math.abs(wp[0][3] - 1.2) < 1e-9, 'Video A: 120/100');
    assert.ok(Math.abs(wp[1][3] - 1.5) < 1e-9, 'Video B: 120/80');
    // Trigger mit Raster: 1 Takt = 4 Schläge im Tempo des eigenen Videos
    m.send('playmode', 0); m.send('division', 9); m.take();
    m.send('note', 36 + 2, 100, 1); m.send('note', 36 + 10, 100, 1);
    wp = m.on(3, 'wplay'); var wr = m.on(3, 'rel');
    assert.ok(Math.abs((wr[0][2] + wr[0][3]) * wp[0][3] - 2400) < 1, 'A: 4 × 600 ms');
    assert.ok(Math.abs((wr[1][2] + wr[1][3]) * wp[1][3] - 3000) < 1, 'B: 4 × 750 ms');
});

t('Mix: Tune mit der Stimmung pro Pad (cent)', function () {
    var m = mixDevice().m;
    var c = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];   // nur C: in C-Dur ohne Verschiebung
    m.send.apply(null, ['padinfo', 1, 0.9, 0, 0].concat(c));
    m.send.apply(null, ['padinfo', 9, 0.9, 0, 0].concat(c));
    m.send('tune', 1);
    assert.strictEqual(m.ctx.pitchRate(1), 1, 'Video A: 0 ct');
    assert.ok(Math.abs(m.ctx.pitchRate(9) - Math.pow(2, -0.5 / 12)) < 1e-12, 'Video B: −50 ct');
    m.take(); m.send('note', 36 + 9, 100, 1);
    assert.ok(/ -50 ct/.test(m.on(2, 'selinfo').pop()[2]));
    m.take(); m.send('note', 36 + 1, 100, 1);
    assert.ok(!/ ct/.test(m.on(2, 'selinfo').pop()[2]));
});

t('Mix: Overlay-Linien pro Fach aus den Schlägen seines Videos, Einsen nach off', function () {
    var x = mixDevice(), m = x.m;
    m.take(); m.send('sendGridUI');
    var beats = [], bars = [];
    m.on(2, 'grid').forEach(function (o) { if (o[2] === 'beats') beats = beats.concat(o.slice(3)); if (o[2] === 'bars') bars = bars.concat(o.slice(3)); });
    var want = [], wantBars = [];
    for (var i = 0; i < 16; i++) {
        var b = i < 8 ? x.bA : x.bB, down = i < 8 ? 0 : 1;
        for (var j = 0; j < b.length; j++) {
            if (b[j] < STARTS[i] || b[j] >= STARTS[i] + LENS[i]) continue;
            want.push(i * 16000 + b[j] - STARTS[i]);
            if ((j - down) % 4 === 0) wantBars.push(i * 16000 + b[j] - STARTS[i]);
        }
    }
    assert.deepStrictEqual(beats, want);
    assert.deepStrictEqual(bars, wantBars);
    // Abstände: Fach 0 alle 600 ms, Fach 8 alle 750 ms
    var f0 = beats.filter(function (v) { return v < 16000; }), f8 = beats.filter(function (v) { return v >= 128000 && v < 144000; });
    assert.ok(Math.abs(f0[1] - f0[0] - 600) < 0.01 && Math.abs(f8[1] - f8[0] - 750) < 0.01);
    // Pad ohne Analyse: keine Linien in seinem Fach, die anderen bleiben
    m.send.apply(null, bankMsg(13, 2, '/x/13.wav'));
    m.send('padana', 4, 100, 0, 0);                  // Tempo, aber keine Schläge
    m.send.apply(null, padanaMsg(5, 100, 0, x.bA, 0, STARTS[5], LENS[5]));
    m.take(); m.send('sendGridUI');
    beats = [];
    m.on(2, 'grid').forEach(function (o) { if (o[2] === 'beats') beats = beats.concat(o.slice(3)); });
    assert.ok(beats.length > 0 && beats.every(function (v) { return Math.floor(v / 16000) === 5; }), 'nur Fach 5');
    assert.deepStrictEqual(m.on(2, 'grid').filter(function (o) { return o[2] === 'show'; }), [[2, 'grid', 'show', 1]]);
});

t('Mix: leerer Platz spielt nichts, meldet aber sel, dunkel per padempty', function () {
    var x = mixDevice({ empty: [3, 12] }), m = x.m;
    var pe = m.out.filter(function (o) { return o[0] === 2 && o[1] === 'padempty'; }).pop();
    var want = [2, 'padempty']; for (var i = 0; i < 16; i++) want.push(i === 3 || i === 12 ? 1 : 0);
    assert.deepStrictEqual(pe, want);
    m.take();
    m.send('note', 36 + 3, 100, 1);
    assert.deepStrictEqual(m.on(0), [], 'kein pos');
    assert.deepStrictEqual(m.on(3), [], 'kein wplay');
    assert.deepStrictEqual(m.on(1, 'playing'), []);
    assert.deepStrictEqual(m.on(2, 'padflash'), []);
    assert.deepStrictEqual(m.on(2, 'selinfo').pop(), [2, 'selinfo', 'Pad 4  leer']);
    assert.deepStrictEqual(m.on(2, 'padsel').pop(), [2, 'padsel', 3]);
    assert.strictEqual(bankstates(m).pop()[3], 3, 'sel 3 an Node (Editor)');
    // Warp, Hold, Rückwärts: auch still
    m.send('warp', 1); m.send('playmode', 1); m.send('reverse', 1); m.take();
    m.send('note', 36 + 12, 100, 1); m.send('note', 36 + 12, 0, 1);
    assert.deepStrictEqual(m.on(0).concat(m.on(3)).filter(function (o) { return o[1] !== 'gateoff' && o[1] !== 'target'; }), []);
    assert.deepStrictEqual(m.on(1, 'playing'), []);
    // belegtes Pad daneben klingt
    m.take(); m.send('note', 36 + 4, 100, 1);
    assert.strictEqual(m.on(3, 'wplay').length, 1);
    // nichts geladen (Bibliothek kaputt): keine dunklen Pads mehr
    m.take(); m.send('libstate', 0, 0, 'kaputt');
    pe = m.on(2, 'padempty').pop();
    assert.ok(pe && pe.slice(2).every(function (v) { return v === 0; }));
});

t('Mix: padana vor bank verfällt, nach bank gilt, einzeln nach Tempo-Korrektur', function () {
    var m = load(SRC);
    startDevice(m);
    m.send('bpm', 120); m.send('warp', 1); m.send('playmode', 1);
    m.send('padana', 0, 100, 0, 0);
    m.send.apply(null, bankMsg(13, 2, '/x/13.wav'));
    assert.strictEqual(m.ctx.PA[0], null, 'bank leert PA');
    m.take(); m.send('note', 36, 100, 1);
    assert.strictEqual(m.on(3, 'wplay').length, 0, 'ohne Tempo kein Warp');
    m.send('padana', 0, 100, 0, 0);
    m.take(); m.send('note', 36, 100, 1);
    assert.ok(Math.abs(m.on(3, 'wplay')[0][3] - 1.2) < 1e-9);
    // Editor korrigiert das Tempo: nur dieses Pad kommt neu
    m.send('padana', 0, 96, 0, 0);
    m.take(); m.send('note', 36, 100, 1);
    assert.ok(Math.abs(m.on(3, 'wplay')[0][3] - 1.25) < 1e-9);
    m.send('padana', 99, 96, 0, 0); m.send('padana', -1, 96, 0, 0);   // außerhalb: nichts
    assert.strictEqual(m.ctx.PA.length, 16);
});

// Tune live: Grundton in Live ändert sich, Tune an -> klingende Stimmen in der neuen Tonhöhe weiter
function tuneDev() {
    var m = liveDev();
    m.send.apply(null, ['padinfo', 0, 0.9, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);   // Pad 0 in C
    m.send('scaleroot', 0); m.send('tune', 1); m.take();
    return m;
}
var UP2 = Math.pow(2, 2 / 12);
t('Tune live: Sampler ab der Position schneller zum selben Ende', function () {
    var m = tuneDev();
    m.send('note', 36, 100, 1); m.take();           // Pad 0: 10000 -> 10250 in 250 ms
    m.clock += 100; m.send('scaleroot', 2);         // D: +2 Halbtöne, Position 10100
    var d = 150 / UP2;
    assert.deepStrictEqual(sig(m, 0), [['target', 1], ['ext', 250, Math.round(d * 1000) / 1000], ['rel', Math.round((d - 20) * 1000) / 1000, 20]]);
    var pl = m.on(1, 'playing')[0]; near(pl[3], 10100); near(pl[4], 10250); near(pl[5], d);
    m.take(); m.clock += 50; m.send('scaleroot', 0);   // zurück, Position 10100 + 50 × 1,1225
    var e = m.on(0, 'ext')[0]; near(e[3], 150 - 50 * UP2);
    m.take(); m.send('scaleints', 0, 2, 4, 5, 7, 9, 11);   // gleiche Tonhöhe: nichts
    assert.deepStrictEqual(sig(m, 0), []);
});

t('Tune live: Warp nur wpitch, Hold bis Snippet-Ende, Tune aus und nach Note-Off nichts', function () {
    var m = tuneDev();
    m.send('warp', 1); m.send('note', 36, 100, 1); m.take();
    m.clock += 100; m.send('scaleroot', 2);
    assert.deepStrictEqual(sig(m, 3).slice(0, 1), [['target', 1]]);
    near(m.on(3, 'wpitch')[0][2], UP2);
    assert.deepStrictEqual(sig(m, 0), []);

    m = tuneDev();
    m.send('playmode', 1); m.send('note', 36, 100, 1);
    var pos = m.on(0, 'pos')[0]; m.take();          // Hold: bis zum Fachende
    m.clock += 100; m.send('scaleroot', 2);
    var e = m.on(0, 'ext')[0]; assert.strictEqual(e[2], pos[3]); near(e[3], (pos[4] - 100) / UP2);
    assert.deepStrictEqual(m.on(2, 'padflash'), []);
    m.send('note', 36, 0, 1); m.take(); m.clock += 5; m.send('scaleroot', 4);
    assert.deepStrictEqual(sig(m, 0), [], 'nach Note-Off im Release');

    m = tuneDev();
    m.send('note', 36, 100, 1); m.send('tune', 0); m.take();
    m.clock += 100; m.send('scaleroot', 2);
    assert.deepStrictEqual(sig(m, 0), [], 'Tune aus');
});

// Division live: klingende Trigger-Stimmen bekommen nur ein neues Ende (ext/rel bzw. gateoff)
function liveDev() {
    var m = load(SRC);
    startDevice(m);
    sendBank(m, 7, 1, 100, '/x/7.wav');            // Video 100 BPM -> Warp-Faktor 1,2 bei Live 120
    m.send('bpm', 120); m.send('division', 5);      // 1/8 = 250 ms
    m.take();
    return m;
}
function near(a, b) { assert.ok(Math.abs(a - b) < 1e-6, a + ' != ' + b); }
function sig(m, n) { return m.on(n).map(function (o) { return o.slice(1).map(function (x) { return typeof x === 'number' ? Math.round(x * 1000) / 1000 : x; }); }); }

t('Division live: Sampler verlängern und verkürzen vor der Position, ohne Sprung', function () {
    var m = liveDev();
    m.send('note', 36, 100, 1); m.take();           // Pad 0: 10000 -> 10250 in 250 ms
    m.clock += 100; m.send('division', 7);          // 1/4: Ende 10500, jetzt bei 10100
    assert.deepStrictEqual(sig(m, 0), [['target', 1], ['ext', 500, 400], ['rel', 380, 20]]);
    assert.deepStrictEqual(m.on(1, 'playing').map(function (o) { return o.slice(2); }), [[0, 10100, 10500, 400]]);
    assert.deepStrictEqual(m.on(2, 'padflash'), [[2, 'padflash', 0, 400]]);
    m.take(); m.clock += 100; m.send('division', 5);   // zurück auf 1/8: Ende 10250, jetzt bei 10200
    assert.deepStrictEqual(sig(m, 0), [['target', 1], ['ext', 250, 50], ['rel', 30, 20]]);
    assert.deepStrictEqual(sig(m, 3), []);
});

t('Division live: neues Ende schon vorbei -> gateoff mit Release, danach nichts mehr', function () {
    var m = liveDev();
    m.send('division', 7); m.send('note', 36, 100, 1); m.take();
    m.clock += 300; m.send('division', 5);          // Ende 10250, Position 10300
    assert.deepStrictEqual(sig(m, 0), [['target', 1], ['gateoff', 20]]);
    assert.deepStrictEqual(m.on(1, 'playstop'), [[1, 'playstop', 0]]);
    m.take(); m.clock += 5; m.send('division', 9);  // im Release: bleibt aus
    assert.deepStrictEqual(sig(m, 0), []);
});

t('Division live: rückwärts verkürzen und wieder verlängern, Klammer am Fachanfang', function () {
    var m = liveDev();
    m.send('reverse', 1); m.send('division', 7);
    m.send('note', 37, 100, 1); m.take();           // Pad 1: 30500 -> 30000
    m.clock += 100; m.send('division', 5);          // Ende 30250, Position 30400
    assert.deepStrictEqual(sig(m, 0), [['target', 1], ['ext', 16250, 150], ['rel', 130, 20]]);
    m.take(); m.clock += 50; m.send('division', 6); // 1/4T: Ende 30500 − 333,3, Position 30350
    var e = m.on(0, 'ext')[0];
    near(e[2], 16500 - 1000 / 3); near(e[3], 1000 / 3 - 150);   // Position 30350 bis 30166,7
    m.take(); m.send('division', 10);               // 2 Takte: nie vor den Fachanfang
    assert.deepStrictEqual(sig(m, 0), [['target', 1], ['ext', 16000, 350], ['rel', 330, 20]]);
});

t('Division live: Klammer am Snippet-Ende', function () {
    var m = liveDev();
    m.send('division', 9); m.send('note', 41, 100, 1); m.take();   // Pad 5: l = 3000, 1 Takt = 2000 ms
    m.clock += 100; m.send('division', 10);         // 2 Takte wären 4000, Fach endet bei 3000
    assert.deepStrictEqual(sig(m, 0), [['target', 1], ['ext', 83000, 2900], ['rel', 2880, 20]]);
});

t('Division live: auf 4 Bars verlängern, über das Fach hinaus geklammert', function () {
    var m = liveDev();
    m.send('note', 36, 100, 1); m.take();           // Pad 0: 1/8 = 250 ms
    m.clock += 100; m.send('division', 11);         // 4 Takte bei 120 = 8000 ms: Ende 18000, jetzt bei 10100
    assert.deepStrictEqual(sig(m, 0), [['target', 1], ['ext', 8000, 7900], ['rel', 7880, 20]]);
    assert.deepStrictEqual(m.on(1, 'playing').map(function (o) { return o.slice(2); }), [[0, 10100, 18000, 7900]]);
    m.take(); m.send('bpm', 40); m.clock += 100; m.send('division', 10); m.send('division', 11);   // 4 Takte bei 40 = 24000 ms > Fach
    assert.deepStrictEqual(sig(m, 0).slice(-2), [['ext', 16000, 15800], ['rel', 15780, 20]]);
});

t('Division live: Warp nur rel neu, Position/Tempo/Tonhöhe bleiben', function () {
    var m = liveDev();
    m.send('warp', 1); m.send('note', 36, 100, 1); m.take();   // R = 1,2: 300 Quell-ms in 250 ms
    m.clock += 100; m.send('division', 7);          // Ende 10600, Position 10120 -> 400 ms
    assert.deepStrictEqual(sig(m, 3), [['target', 1], ['rel', 380, 20]]);
    assert.deepStrictEqual(sig(m, 0), []);
    assert.deepStrictEqual(m.on(1, 'playing').map(function (o) { return o.slice(2); }), [[0, 10120, 10600, 400]]);
});

t('Division live: Hold unberührt, Rate wirkt nicht live, vor ready() nichts', function () {
    var m = liveDev();
    m.send('playmode', 1); m.send('note', 36, 100, 1); m.take();
    m.clock += 100; m.send('division', 7);
    assert.deepStrictEqual(sig(m, 0).concat(sig(m, 3)), []);

    m = liveDev();
    m.send('rate', 2); m.send('note', 36, 100, 1); m.take();   // 500 Quell-ms in 250 ms
    m.send('rate', 1);
    assert.deepStrictEqual(sig(m, 0), []);
    m.clock += 100; m.send('division', 7);          // Geschwindigkeit bleibt 2: Ende 11000, Position 10200
    assert.deepStrictEqual(sig(m, 0), [['target', 1], ['ext', 1000, 400], ['rel', 380, 20]]);

    m = liveDev();
    m.send('note', 36, 100, 1); m.take();
    m.ctx.initDone = 0; m.clock += 100; m.send('division', 7);
    assert.deepStrictEqual(sig(m, 0), []);
});

// Golden-Test (Spec Mix 4.5): Track-Bank, Anschläge und Reglerwechsel. Die Ausgänge 0, 2, 3 und playing/playstop
// müssen gleich bleiben wie in 3.0 (aufgenommen in golden_trackbank.json). Nur das Laden unterscheidet sich.
// Aufgenommen mit dem 3.0-Stand (Commit „Golden-Aufnahme“, Laden per bank/tuning/beats*), nicht neu aufnehmen.
var GOLDEN = path.join(__dirname, 'golden_trackbank.json');
var G = { bpm: 99.5, cent: 23, down: 2 };
var G_KEYS = [];                                   // padinfo pro Pad: konf, grundton, moll, chroma
for (i = 0; i < 16; i++) {
    var c = []; for (var q = 0; q < 12; q++) c.push(Math.round((0.5 + 0.5 * Math.sin(i * 1.7 + q * 0.9)) * 1000) / 1000);
    G_KEYS.push([i % 5 === 4 ? 0.3 : 0.6 + (i % 3) * 0.1, (i * 5) % 12, i % 2].concat(c));
}
// Schläge mit Schwankung, damit Warp dem Raster folgt und nicht dem festen Verhältnis
function goldenBeats() {
    var b = [], t = 120, p = 60000 / G.bpm;
    while (t < 400000) { b.push(Math.round(t * 1000) / 1000); t += p * (1 + 0.03 * Math.sin(b.length * 0.7)); }
    return b;
}
function goldenLoad(m) {
    m.send('libstate', 3, 1, 'ok');
    m.send.apply(null, bankMsg(7, 1, '/x/7.wav'));
    m.fire(m.ctx.replaceTask);
    var b = goldenBeats();
    for (var i = 0; i < 16; i++) m.send.apply(null, padanaMsg(i, G.bpm, G.cent, b, G.down, STARTS[i], LENS[i]));
    for (i = 0; i < 16; i++) m.send.apply(null, ['padinfo', i].concat(G_KEYS[i]));
    m.send('analysisready');
}
function goldenScenario(m) {
    var rec = [];
    function step(name, fn) {
        m.take(); fn();
        rec.push([name, m.out.filter(function (o) {
            return o[0] === 0 || o[0] === 2 || o[0] === 3 || (o[0] === 1 && (o[1] === 'playing' || o[1] === 'playstop'));
        })]);
        m.clock += 700;
    }
    function hits() {
        [0, 3, 5, 9, 15].forEach(function (i) {
            m.send('note', 36 + i, 100, 1); m.clock += 60; m.send('note', 36 + i, 0, 1); m.clock += 40;
        });
    }
    step('grid', function () { m.send('sendGridUI'); });
    step('bpm', function () { m.send('bpm', 120); });
    [[], [['warp', 1]], [['division', 9]], [['division', 10]], [['division', 2]], [['reverse', 1]], [['warp', 0]],
     [['playmode', 1]], [['reverse', 0]], [['warp', 1]], [['reverse', 1]], [['playmode', 0], ['reverse', 0], ['division', 5], ['tune', 1]],
     [['rate', 1.3]], [['warp', 0]], [['scaleroot', 2]], [['bpm', 93]], [['warp', 1], ['division', 7]], [['tune', 0]]
    ].forEach(function (cfg, n) {
        step('cfg' + n, function () { cfg.forEach(function (s) { m.send.apply(null, s); }); hits(); });
    });
    // Quant + Catch mit Warp: zu spät (Catch), zu früh (wartet auf den Tick), 1/4
    step('quant', function () {
        m.send('quantize', 1); m.send('quantdiv', 2); m.send('quantcatch', 1); m.send('tick', 2);
        m.clock += 100; m.send('padhit', 2);
        m.clock += 200; m.send('padhit', 3);
        m.clock += 50; m.send('tick', 2);
        m.send('quantdiv', 3); m.send('tick', 3);
        m.clock += 200; m.send('padhit', 6);
        m.clock += 100; m.send('padhit', 7);
        m.clock += 200; m.send('tick', 3);
        m.send('warp', 0); m.clock += 100; m.send('padhit', 8);
    });
    return rec;
}
function closeEnough(a, b, where) {
    if (typeof a === 'number' && typeof b === 'number') {
        assert.ok(Math.abs(a - b) < 1e-6, where + ': ' + a + ' != ' + b);
    } else if (Array.isArray(a)) {
        assert.ok(Array.isArray(b) && a.length === b.length, where + ': Länge ' + JSON.stringify(a) + ' / ' + JSON.stringify(b));
        for (var k = 0; k < a.length; k++) closeEnough(a[k], b[k], where);
    } else assert.strictEqual(a, b, where);
}
function goldenRun(loader) {
    var m = load(SRC);
    m.ctx.retime = function () {};                 // Division live (4.x) gab es in 3.0 nicht, eigener Test oben
    m.ctx.retune = function () {};                 // Tune live (4.2) ebenso
    startDevice(m);
    loader(m);
    return goldenScenario(m);
}
t('Golden: Track-Bank klingt wie in 3.0 (Ausgänge 0, 2, 3, playing)', function () {
    var want = JSON.parse(fs.readFileSync(GOLDEN, 'utf8')), got = goldenRun(goldenLoad);
    assert.strictEqual(got.length, want.length);
    for (var k = 0; k < want.length; k++) {
        var w = want[k], g = got[k];
        assert.strictEqual(g[0], w[0]);
        for (var n = 0; n < Math.max(w[1].length, g[1].length); n++) closeEnough(g[1][n], w[1][n], w[0] + ' #' + n);
    }
});

var bad = 0;
tests.forEach(function (x) {
    try { x[1](); console.log('ok   ' + x[0]); }
    catch (e) { bad++; console.log('FAIL ' + x[0] + '\n     ' + String(e.stack || e).split('\n').slice(0, 4).join('\n     ')); }
});
console.log(bad ? bad + ' von ' + tests.length + ' fehlgeschlagen' : 'alle ' + tests.length + ' grün');
process.exit(bad ? 1 : 0);
