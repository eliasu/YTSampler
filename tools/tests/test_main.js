// Attrappen-Test für ytsampler_main.js ([js] in Max): Bänke, Song/Buffer-ms, Snippet-Klammer, Overlay, Bank-Regler,
// ready()-Sperren und der Teletext-Weg im Vergleich mit v1.3.6.
// Aufruf aus dem Projektordner: node tools/tests/test_main.js
var fs = require('fs'), vm = require('vm'), assert = require('assert'), cp = require('child_process'), path = require('path');

var ROOT = path.join(__dirname, '..', '..');

// lädt ein [js]-Skript mit Attrappen für outlet, Task, arrayfromargs, post, this.patcher.getnamed, LiveAPI
function load(src) {
    var m = { out: [], named: [], tasks: [], api: null, clock: 1000 };
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
        patcher: { getnamed: function (name) { return { message: function () { m.named.push([name].concat(Array.prototype.slice.call(arguments))); } }; } }
    };
    ctx.Task.prototype.schedule = function (ms) { this.pending = true; this.ms = ms; };
    ctx.Task.prototype.cancel = function () { this.pending = false; };
    vm.createContext(ctx);
    // fester Zufall, damit alt und neu dasselbe würfeln
    vm.runInContext('(function(){ var x = 12345; Math.random = function () { x = (x * 1103515245 + 12345) % 2147483648; return x / 2147483648; }; })();', ctx);
    vm.runInContext(src, ctx);
    ctx.nowMs = function () { return m.clock; };
    m.ctx = ctx;
    m.send = function (sel) { return ctx[sel].apply(ctx, Array.prototype.slice.call(arguments, 1)); };
    m.fire = function (task) { if (task.pending) { task.pending = false; task.fn(); } };
    m.take = function () { var o = m.out; m.out = []; return o; };
    m.on = function (n, sel) { return m.out.filter(function (o) { return o[0] === n && (!sel || o[1] === sel); }); };
    return m;
}

function startDevice(m) {
    m.send('init');
    m.fire(m.ctx.initTask);
    m.send('statenone');
}

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
    var m = load(fs.readFileSync(ROOT + '/ytsampler_main.js', 'utf8'));
    m.send('libstate', 3, 1, 'ok');
    m.send.apply(null, bankMsg(7, 1, 100, '/x/7.wav'));
    m.take();
    m.send('banknum', 2); m.send('banknext'); m.send('bankprev'); m.send('srcbpm', 90); m.send('bpmhalf'); m.send('bpmdouble');
    assert.deepStrictEqual(m.on(1), [], 'nichts an Node');
    assert.ok(!m.ctx.selTask.pending);
    startDevice(m); m.take();
    m.send('banknum', 2);
    assert.deepStrictEqual(m.on(1, 'bankpeek')[0], [1, 'bankpeek', 2]);
    m.fire(m.ctx.selTask);
    assert.deepStrictEqual(m.on(1, 'banksel')[0], [1, 'banksel', 2]);
});

t('bank: klingende Stimmen in beiden poly~ aus, replace erst nach dem Task, letzte Wahl gewinnt', function () {
    var m = load(fs.readFileSync(ROOT + '/ytsampler_main.js', 'utf8'));
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
    var m = load(fs.readFileSync(ROOT + '/ytsampler_main.js', 'utf8'));
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

t('Klammer am Snippet-Ende: Trigger, Hold (10 ms), Hold rückwärts, Warp+Grid', function () {
    var m = load(fs.readFileSync(ROOT + '/ytsampler_main.js', 'utf8'));
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
    // Warp + Grid: Quelle 100 BPM, Live 120, Slice 2 Takte -> Quelle bräuchte 4800 ms, Fach hat 3000
    m.send('playmode', 0); m.send('reverse', 0);
    feedBeats(m, 100, 0);
    m.send('warp', 1); m.send('gridon', 1); m.take();
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

t('effStart mit Bank fest, kein Einrasten durch Grid/Snap', function () {
    var m = load(fs.readFileSync(ROOT + '/ytsampler_main.js', 'utf8'));
    startDevice(m);
    STARTS[2] = 50123;
    m.send.apply(null, bankMsg(7, 1, 100, '/x/7.wav'));
    feedBeats(m, 100, 0);
    m.send('gridon', 1); m.send('snapmode', 2);
    assert.strictEqual(m.ctx.effStart(2), 50123);
    STARTS[2] = 50000;
});

t('Overlay in Buffer-ms: dur, beats, bars, pads', function () {
    var m = load(fs.readFileSync(ROOT + '/ytsampler_main.js', 'utf8'));
    startDevice(m);
    m.send.apply(null, bankMsg(7, 1, 100, '/x/7.wav'));
    m.take();
    var b = feedBeats(m, 100, 1);
    m.send('gridon', 1);
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
    var m = load(fs.readFileSync(ROOT + '/ytsampler_main.js', 'utf8'));
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
});

t('Prev/Next: Enden, über 128, 350 ms Ruhe', function () {
    var m = load(fs.readFileSync(ROOT + '/ytsampler_main.js', 'utf8'));
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

t('Tempo: gleiche Zahl bestätigt, bpmset an Node, bpm von Node ohne Echo', function () {
    var m = load(fs.readFileSync(ROOT + '/ytsampler_main.js', 'utf8'));
    startDevice(m);
    m.send.apply(null, bankMsg(7, 1, 0, '/x/7.wav'));
    m.send('analysisready');
    m.send('tempo', 99.5, 0.1);
    assert.strictEqual(m.ctx.st.srcAuto, 1);
    m.take();
    m.send('srcbpm', 99.5);
    assert.strictEqual(m.ctx.st.srcAuto, 0, 'gleiche Zahl bestätigt');
    assert.deepStrictEqual(m.on(1, 'bpmset'), [[1, 'bpmset', 'F2RnxZnubCM', 99.5]]);
    assert.deepStrictEqual(m.on(1, 'beattrack'), [[1, 'beattrack', 99.5]]);
    m.take(); m.send('bpmdouble');
    assert.deepStrictEqual(m.on(1, 'bpmset'), [[1, 'bpmset', 'F2RnxZnubCM', 199]]);
    m.take();
    m.send('bpm', 'F2RnxZnubCM', 100);
    assert.strictEqual(m.ctx.st.srcBpm, 100);
    assert.deepStrictEqual(m.on(1, 'bpmset'), [], 'kein Echo');
    assert.deepStrictEqual(m.on(1, 'beattrack'), [[1, 'beattrack', 100]]);
    m.send('bpm', 'anderesVide', 80);
    assert.strictEqual(m.ctx.st.srcBpm, 100, 'anderes Video zählt nicht');
    m.send('bpm', 128);
    assert.strictEqual(m.ctx.P.bpm, 128, 'Lives Tempo kommt weiter an');
});

t('Session v2: bankId -> bankopen, bankgone -> Kopie laden, 1.x-Session -> load', function () {
    var m = load(fs.readFileSync(ROOT + '/ytsampler_main.js', 'utf8'));
    m.send('init'); m.fire(m.ctx.initTask);
    var o = { bankId: 7, id: 'F2RnxZnubCM', title: 'Funk', pads: STARTS, srcBpm: 99.5, srcAuto: 0, bpmConf: 0.4 };
    m.take();
    m.send('state', encodeURIComponent(JSON.stringify(o)));
    assert.deepStrictEqual(m.on(1, 'bankopen'), [[1, 'bankopen', 7]]);
    assert.deepStrictEqual(m.on(1, 'load'), []);
    m.take();
    m.send('bankgone', 7);
    assert.deepStrictEqual(m.on(1, 'load'), [[1, 'load', 'F2RnxZnubCM']]);
    assert.deepStrictEqual(m.on(2, 'status').pop(), [2, 'status', 'Bank gelöscht']);
    m.send('loaded', '/c/F2RnxZnubCM.wav', 400000, 'F2RnxZnubCM', 'Titanic');
    assert.deepStrictEqual(Array.from(m.ctx.st.pads), STARTS, 'Starts der Kopie bleiben');
    assert.strictEqual(m.ctx.st.bankId, 0);
    var saved = JSON.parse(decodeURIComponent(m.on(1, 'savestate').pop()[2]));
    assert.deepStrictEqual(Object.keys(saved).sort(), ['bankId', 'bpmConf', 'id', 'pads', 'srcAuto', 'srcBpm', 'title']);
    assert.deepStrictEqual(m.on(2, 'showname').pop(), [2, 'showname', 'keine Bank: Titanic']);
    // 1.x-Session ohne bankId
    m = load(fs.readFileSync(ROOT + '/ytsampler_main.js', 'utf8'));
    m.send('init'); m.fire(m.ctx.initTask);
    m.send('state', encodeURIComponent(JSON.stringify({ id: 'abcdefghijk', title: 'Alt', pads: STARTS, locks: [], favs: [], fav: 2 })));
    assert.deepStrictEqual(m.on(1, 'load'), [[1, 'load', 'abcdefghijk']]);
    assert.strictEqual(m.ctx.st.bankId, 0);
});

t('Bibliothek leer/kaputt: mit Bank stumm, ohne Bank (Teletext) spielt weiter', function () {
    var m = load(fs.readFileSync(ROOT + '/ytsampler_main.js', 'utf8'));
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
    // Teletext
    m = load(fs.readFileSync(ROOT + '/ytsampler_main.js', 'utf8'));
    startDevice(m);
    m.send('loaded', '/c/x.wav', 200000, 'abcdefghijk', 'Teletext');
    m.send('libstate', 0, 0, 'leer');
    m.take(); m.send('note', 36, 100, 1);
    assert.strictEqual(m.on(0, 'pos').length, 1, 'Teletext spielt');
});

t('trackname über LiveAPI', function () {
    var m = load(fs.readFileSync(ROOT + '/ytsampler_main.js', 'utf8'));
    startDevice(m);
    assert.strictEqual(m.api.path, 'this_device canonical_parent');
    assert.strictEqual(m.api.property, 'name');
    m.take();
    m.api.cb(['name', '"1-YT', 'Sampler"']);
    assert.deepStrictEqual(m.on(1, 'trackname'), [[1, 'trackname', '1-YT Sampler']]);
});

// Teletext-Weg: gleiche Nachrichten an 1.3.6 und an den neuen Stand, Stimmen/Analyse/Overlay müssen gleich sein
t('Teletext-Weg wie v1.3.6', function () {
    var oldSrc = cp.execSync('git show v1.3.6:ytsampler_main.js', { cwd: ROOT, encoding: 'utf8' });
    function runAll(src) {
        var m = load(src);
        startDevice(m);
        m.send('bpm', 124); m.send('scaleroot', 2);
        m.send('loaded', '/c/abcdefghijk.wav', 240000, 'abcdefghijk', 'Ein', 'Titel');
        m.send('tuning', -12);
        m.send('tempo', 98, 0.7);
        m.send('silence', 0, 3000, 200000, 240000);
        feedBeats(m, 98, 2);
        for (var p = 0; p < 16; p++) m.send('padinfo', p, 0.5, p % 12, p % 2, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1);
        m.send('tune', 1);
        var steps = [['note', 36, 100, 1], ['note', 40, 90, 2], ['division', 3], ['note', 41, 80, 1], ['gridon', 1], ['snapmode', 1],
            ['note', 42, 100, 1], ['warp', 1], ['note', 43, 100, 1], ['playmode', 1], ['note', 44, 100, 1], ['note', 44, 0, 1],
            ['reverse', 1], ['note', 45, 100, 1], ['note', 45, 0, 1], ['rate', 1.5], ['warp', 0], ['note', 46, 100, 1],
            ['srcbpm', 120], ['note', 47, 100, 1], ['bpmhalf'], ['note', 48, 100, 1], ['padhit', 3], ['padup', 3]];
        steps.forEach(function (s, k) { m.clock += 37; m.send.apply(null, s); });
        return m.out.filter(function (o) {
            if (o[0] === 0 || o[0] === 3) return true;
            if (o[0] === 1) return ['analyzeall', 'analyze', 'beattrack', 'load', 'key'].indexOf(o[1]) >= 0;
            if (o[0] === 2) return ['selinfo', 'wsel', 'padflash', 'padlight', 'padsel'].indexOf(o[1]) >= 0 ||
                (o[1] === 'grid' && ['dur', 'beats', 'show', 'pads', 'clear'].indexOf(o[2]) >= 0);
            return false;
        }).map(function (o) { return JSON.stringify(o); });
    }
    var a = runAll(oldSrc), b = runAll(fs.readFileSync(ROOT + '/ytsampler_main.js', 'utf8'));
    for (var k = 0; k < Math.max(a.length, b.length); k++) assert.strictEqual(b[k], a[k], 'Nachricht ' + k);
    assert.ok(a.length > 100);
});

var bad = 0;
tests.forEach(function (x) {
    try { x[1](); console.log('ok   ' + x[0]); }
    catch (e) { bad++; console.log('FAIL ' + x[0] + '\n     ' + String(e.stack || e).split('\n').slice(0, 4).join('\n     ')); }
});
console.log(bad ? bad + ' von ' + tests.length + ' fehlgeschlagen' : 'alle ' + tests.length + ' grün');
process.exit(bad ? 1 : 0);
