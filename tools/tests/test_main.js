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
function bankMsg(id, nr, bpm, pathName) {
    return ['bank', id, nr, bpm].concat(STARTS, LENS, [400000, 'F2RnxZnubCM'], pathName.split(' '));
}
function beatsFor(bpm, dur) { var b = []; for (var t = 0; t < dur; t += 60000 / bpm) b.push(Math.round(t * 1000) / 1000); return b; }
function feedBeats(m, bpm, down) {
    var b = beatsFor(bpm, 400000);
    m.send('analysisready');
    m.send('beatsclear');
    for (var k = 0; k < b.length; k += 200) m.send.apply(null, ['beatsadd'].concat(b.slice(k, k + 200)));
    m.send('beatsdone', down, b.length);
    return b;
}

var tests = [];
function t(name, fn) { tests.push([name, fn]); }

t('ready()-Sperren: Regler und Tempo vor init tun nichts', function () {
    var m = load(SRC);
    m.send('libstate', 3, 1, 'ok');
    m.send.apply(null, bankMsg(7, 1, 100, '/x/7.wav'));
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
    m.send.apply(null, bankMsg(7, 1, 100, '/x/7.wav'));
    m.fire(m.ctx.replaceTask);
    feedBeats(m, 100, 0);
    m.send('note', 36, 100, 1);                    // Sampler-Stimme
    m.send('warp', 1); m.send('bpm', 120);
    m.send('note', 37, 100, 1);                    // Warp-Stimme
    m.take();
    m.send.apply(null, bankMsg(8, 2, 0, '/x/8 a.wav'));
    var off0 = m.on(0, 'gateoff'), off3 = m.on(3, 'gateoff');
    assert.deepStrictEqual(off0, [[0, 'gateoff', 5]], 'Sampler-Stimme ausgeblendet');
    assert.deepStrictEqual(off3, [[3, 'gateoff', 5]], 'Warp-Stimme ausgeblendet');
    assert.deepStrictEqual(m.on(4), [], 'replace noch nicht');
    assert.ok(m.ctx.replaceTask.pending && m.ctx.replaceTask.ms <= 20);
    m.send.apply(null, bankMsg(9, 3, 0, '/x/9.wav'));
    m.fire(m.ctx.replaceTask);
    assert.deepStrictEqual(m.on(4), [[4, 'replace', '/x/9.wav']], 'nur die letzte Bank');
    assert.strictEqual(m.ctx.st.bankId, 9);
    assert.ok(m.named.some(function (n) { return n[0] === 'bank' && n[1] === 'set' && n[2] === 3; }), 'Bank-Regler per set');
    // Pfad mit Leerzeichen bleibt ganz
    m.take(); m.send.apply(null, bankMsg(8, 2, 0, '/x/8 a.wav')); m.fire(m.ctx.replaceTask);
    assert.deepStrictEqual(m.on(4), [[4, 'replace', '/x/8 a.wav']]);
});

t('Song-ms -> Buffer-ms in pos/wplay, playing in Song-ms', function () {
    var m = load(SRC);
    startDevice(m);
    m.send.apply(null, bankMsg(7, 1, 100, '/x/7.wav'));
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
    m.send.apply(null, bankMsg(7, 1, 100, '/x/7.wav'));
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

t('effStart fest, kein Einrasten bei Beats', function () {
    var m = load(SRC);
    startDevice(m);
    STARTS[2] = 50123;
    m.send.apply(null, bankMsg(7, 1, 100, '/x/7.wav'));
    feedBeats(m, 100, 0);
    assert.strictEqual(m.ctx.effStart(2), 50123);
    assert.ok(!('gridon' in m.ctx) && !('snapmode' in m.ctx), 'Grid/Snap gibt es nicht mehr');
    STARTS[2] = 50000;
});

t('Overlay in Buffer-ms ohne Schalter: show nach beatsOK, dur, beats, bars, pads', function () {
    var m = load(SRC);
    startDevice(m);
    m.send.apply(null, bankMsg(7, 1, 100, '/x/7.wav'));
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
    m.send.apply(null, bankMsg(7, 1, 100, '/x/7.wav'));
    m.send('bpm', 120); m.send('playmode', 1);
    m.take();
    m.send('updateSel'); m.send('updateSel');
    m.send('reverse', 1);
    var bs = m.on(1, 'bankstate');
    assert.strictEqual(bs.length, 1, 'einmal für reverse');
    var b = bs[0];
    assert.deepStrictEqual(b.slice(1, 7), ['bankstate', 7, 'F2RnxZnubCM', 0, 1, 1]);
    assert.deepStrictEqual(b.slice(7, 23), STARTS);
    assert.deepStrictEqual(b.slice(23, 39), LENS, 'Hold: ganze Snippets');
    // angehängt: div rate tune warp quant vol voices base qdiv qcatch
    assert.strictEqual(b.length, 39 + 10);
    assert.deepStrictEqual(b.slice(39), [5, 1, 0, 0, 0, 0, 6, 36, 1, 0]);
});

t('bankstate: die zwölf Reglerwerte, gerundet, nur bei Änderung', function () {
    var m = load(SRC);
    startDevice(m);
    m.send.apply(null, bankMsg(7, 1, 100, '/x/7.wav'));
    m.send('bpm', 120);
    var steps = [['division', 3], ['rate', 1.23456], ['playmode', 1], ['reverse', 1], ['tune', 1], ['warp', 1],
        ['quantize', 1], ['volume', -3.54], ['voicecount', 2], ['basenote', 48], ['quantdiv', 2], ['quantcatch', 1]];
    steps.forEach(function (st) {
        m.take();
        m.send.apply(null, st);
        assert.strictEqual(bankstates(m).length, 1, st[0] + ' meldet einmal');
    });
    var b = bankstates(m)[0];
    assert.deepStrictEqual(b.slice(5, 7), [1, 1], 'mode rev');
    assert.deepStrictEqual(b.slice(39), [3, 1.235, 1, 1, 1, -3.5, 2, 48, 2, 1]);
    assert.strictEqual(m.ctx.P.voices, 3, 'Index 2 = 3 Stimmen');
    // Mikroänderung unterhalb der Rundung: kein neues bankstate
    m.take(); m.send('volume', -3.52); m.send('rate', 1.2349);
    assert.strictEqual(bankstates(m).length, 0);
    // nochmal derselbe Wert: nichts
    m.take(); m.send('basenote', 48); m.send('tune', 1);
    assert.strictEqual(bankstates(m).length, 0);
});

t('param vom Editor -> setNamed mit varname, unbekannt -> nichts', function () {
    var m = load(SRC);
    startDevice(m);
    var want = { div: 'Division', rate: 'Rate', mode: 'Mode', rev: 'Reverse', tune: 'Tune', warp: 'Warp',
        quant: 'Quantize', qdiv: 'Quant Div', qcatch: 'Quant Catch', vol: 'Volume', voices: 'Voices', base: 'Base Note' };
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
    m.send.apply(null, bankMsg(7, 1, 100, '/x/7.wav'));
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
    m.send.apply(null, bankMsg(7, 1, 100, '/x/7.wav'));
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
    m.send.apply(null, bankMsg(7, 129, 100, '/x/7.wav'));
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
    m.send.apply(null, bankMsg(7, 1, 100, '/x/7.wav'));
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

t('Tempo: erkanntes Tempo gilt, Warp folgt Beats, ohne Beats festes Verhältnis', function () {
    var m = load(SRC);
    startDevice(m);
    m.send.apply(null, bankMsg(7, 1, 0, '/x/7.wav'));
    m.send('bpm', 120); m.send('warp', 1); m.send('division', 9);   // 1 Takt
    m.send('tempo', 100, 0.1);
    m.send('analysisready');                       // beattrack angefordert, Beats noch nicht da
    assert.ok(!m.ctx.beatsOK());
    m.take(); m.send('note', 36, 100, 1);
    var wp = m.on(3, 'wplay')[0], wr = m.on(3, 'rel')[0];
    assert.ok(Math.abs(wp[3] - 1.2) < 1e-9, 'festes Verhältnis 120/100');
    assert.ok(Math.abs((wr[2] + wr[3]) - 2000) < 1e-6, '1 Takt bei 120 BPM');
    assert.ok(m.on(2, 'selinfo').pop()[2].indexOf(' T') < 0, 'ohne Beats keine Taktposition');
    // Beats weichen vom Quelltempo ab (96 statt 100 BPM): Slice endet auf dem Raster der Quelle, nicht beim festen Verhältnis
    var b = beatsFor(96, 400000);
    m.send('beatsclear'); m.send.apply(null, ['beatsadd'].concat(b)); m.send('beatsdone', 0, b.length);
    assert.ok(m.ctx.beatsOK(), 'erkanntes Tempo + Beats');
    m.take(); m.send('note', 36, 100, 1);
    wp = m.on(3, 'wplay')[0]; wr = m.on(3, 'rel')[0];
    assert.ok(Math.abs((wr[2] + wr[3]) * wp[3] - 4 * 60000 / 96) < 1, 'Raster der Quelle: 4 Schläge à 625 ms');
    assert.ok(/  T\d+\.\d/.test(m.on(2, 'selinfo').pop()[2]), 'Taktposition mit Beats');
    // kein Tempo: W: kein Tempo
    m.send.apply(null, bankMsg(8, 2, 0, '/x/8.wav')); m.take();
    m.send('updateSel');
    assert.ok(m.on(2, 'selinfo').pop()[2].indexOf('W: kein Tempo') > 0);
});

t('Tempo vom Editor: bpm <video> <bpm> bestätigt, kein bpmset, Analyse überschreibt es nicht', function () {
    var m = load(SRC);
    startDevice(m);
    m.send.apply(null, bankMsg(7, 1, 0, '/x/7.wav'));
    m.send('analysisready');
    m.send('tempo', 99.5, 0.1);
    assert.strictEqual(m.ctx.srcBpm, 99.5);
    m.take();
    m.send('bpm', 'F2RnxZnubCM', 100);
    assert.strictEqual(m.ctx.srcBpm, 100);
    assert.strictEqual(m.ctx.srcAuto, 0);
    assert.deepStrictEqual(m.on(1, 'bpmset'), [], 'kein Echo');
    assert.deepStrictEqual(m.on(1, 'beattrack'), [[1, 'beattrack', 100]]);
    m.send('tempo', 120, 0.9);
    assert.strictEqual(m.ctx.srcBpm, 100, 'bestätigt bleibt');
    m.send('bpm', 'anderesVide', 80);
    assert.strictEqual(m.ctx.srcBpm, 100, 'anderes Video zählt nicht');
    m.send('bpm', 128);
    assert.strictEqual(m.ctx.P.bpm, 128, 'Lives Tempo kommt weiter an');
    // bank mit bestätigtem Tempo
    m.send.apply(null, bankMsg(8, 2, 87, '/x/8.wav'));
    m.send('tempo', 120, 0.9);
    assert.strictEqual(m.ctx.srcBpm, 87);
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
    m.send.apply(null, bankMsg(7, 1, 100, '/x/7.wav'));
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
    m.send.apply(null, bankMsg(7, 3, 100, '/x/7.wav'));
    m.take(); m.send('libstate', 3, 3, 'ok');
    assert.deepStrictEqual(m.on(1, 'bankload'), []);
});

t('bankgone: Bank gelöscht -> bankload <Regler>, Pads tun nichts bis zur neuen Bank', function () {
    var m = load(SRC);
    m.values.bank = 4;
    m.send('init'); m.fire(m.ctx.initTask);
    m.send('libstate', 5, 0, 'ok');
    m.send('state', encodeURIComponent(JSON.stringify({ bankId: 7 })));
    m.send.apply(null, bankMsg(7, 4, 100, '/x/7.wav'));
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
    m.send.apply(null, bankMsg(9, 4, 100, '/x/9.wav'));
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
    m.send.apply(null, bankMsg(8, 2, 100, '/x/8.wav'));
    assert.strictEqual(m.ctx.muted, 0);
    m.take(); m.send('note', 36, 100, 1);
    assert.strictEqual(m.on(0, 'pos').length, 1);
});

t('Bibliothek leer/kaputt: stumm, wieder ok -> bankopen', function () {
    var m = load(SRC);
    startDevice(m);
    m.send.apply(null, bankMsg(7, 1, 100, '/x/7.wav'));
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

// Analysefenster fest 4 s: Slice-Länge, Rate und Mode ändern die Tonart (und damit Tune) nicht
t('analyzeall: festes Fenster unabhängig von Division, Rate, Mode', function () {
    var m = load(SRC);
    startDevice(m);
    m.send('bpm', 124);
    m.send.apply(null, bankMsg(7, 1, 100, '/x/7.wav'));
    m.send('analysisready');
    [['division', 0], ['division', 10], ['rate', 2], ['playmode', 1], ['playmode', 0]].forEach(function (s) { m.send.apply(null, s); });
    var spans = m.out.filter(function (o) { return o[0] === 1 && o[1] === 'analyzeall'; }).map(function (o) { return o[2]; });
    assert.ok(spans.length >= 5);
    spans.forEach(function (v) { assert.strictEqual(v, 4000); });
});

// Quant-Raster: nur der Tick des eingestellten Rasters zählt, Wartefenster wächst mit dem Raster
t('Quant Div: tick <index> nur vom eingestellten Raster, Anschlag wartet darauf', function () {
    var m = load(SRC);
    startDevice(m);
    m.send.apply(null, bankMsg(7, 1, 100, '/x/7.wav'));
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

t('Catch: bei 1/8 und 1/4 später einsteigen, Ende bleibt; bei 1/16 und aus wie bisher', function () {
    function setup(qdiv, on) {
        var m = load(SRC);
        startDevice(m);
        m.send.apply(null, bankMsg(7, 1, 100, '/x/7.wav'));
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
    m = setup(3, 1);                       // 1/4: 200 ms aufholen, 300 ms warten
    m.clock += 200; m.send('padhit', 2);
    assert.ok(Math.abs(m.on(1, 'playing')[0][3] - (S0 + 200)) < 0.01);
    m = setup(3, 1); m.clock += 300; m.send('padhit', 2);
    assert.strictEqual(m.on(1, 'playing').length, 0, 'über eine Achtel: wartet');
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
    m.send.apply(null, bankMsg(7, 1, 100, '/x/7.wav'));
    m.send('bpm', 120); m.take();
    m.send('bankbusy');
    m.send('padhit', 2); m.send('padup', 2);
    assert.strictEqual(m.on(1, 'playing').length, 0, 'wartet');
    m.send('bufloaded');                   // alter Ladevorgang: zählt erst nach bank
    assert.strictEqual(m.on(1, 'playing').length, 0, 'noch keine neue Bank');
    var neu = bankMsg(7, 1, 100, '/x/7.wav'); neu[3 + 1 + 2] = 77777;   // ['bank', id, nr, bpm, s0, s1, s2 …]
    m.send.apply(null, neu);
    assert.strictEqual(m.on(1, 'playing').length, 0, 'Buffer lädt noch');
    m.send('bufloaded');
    var p = m.on(1, 'playing');
    assert.strictEqual(p.length, 1, 'jetzt');
    assert.strictEqual(p[0][3], 77777, 'neue Stelle');
    m.take(); m.send('padhit', 3);
    assert.strictEqual(m.on(1, 'playing').length, 1, 'danach wieder sofort');
});

var bad = 0;
tests.forEach(function (x) {
    try { x[1](); console.log('ok   ' + x[0]); }
    catch (e) { bad++; console.log('FAIL ' + x[0] + '\n     ' + String(e.stack || e).split('\n').slice(0, 4).join('\n     ')); }
});
console.log(bad ? bad + ' von ' + tests.length + ' fehlgeschlagen' : 'alle ' + tests.length + ' grün');
process.exit(bad ? 1 : 0);
