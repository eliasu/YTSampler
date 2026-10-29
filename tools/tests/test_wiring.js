// Verdrahtung Patch ↔ [js] ↔ Node: jeder Selektor hat ein Ziel, jede Patch-Nachricht an [js] eine Funktion
// Aufruf aus dem Projektordner: node tools/tests/test_wiring.js
var fs = require('fs'), path = require('path'), assert = require('assert');
var root = path.join(__dirname, '..', '..');
var read = function (f) { return fs.readFileSync(path.join(root, f), 'utf8'); };

var main = read('ytsampler_main.js'), node = read('ytsampler_node.js'), pads = read('ytpads.js');
var pat = JSON.parse(read('YT Sampler.maxpat')).patcher;
var amxd = fs.readFileSync(path.join(root, 'YT Sampler.amxd'));
assert.strictEqual(amxd.slice(amxd.indexOf('{')).toString('utf8').replace(/\n\0$/, ''), read('YT Sampler.maxpat'), '.amxd nicht synchron mit .maxpat');

var B = {};
pat.boxes.forEach(function (b) { B[b.box.id] = b.box; });
function byText(re) { return Object.keys(B).filter(function (id) { return re.test(B[id].text || ''); }); }
var JS = byText(/^js ytsampler_main\.js/)[0], NODE = byText(/^node\.script /)[0], BUF = byText(/^buffer~ /)[0];
function outs(id, o) {
    return pat.lines.filter(function (l) { return l.patchline.source[0] === id && l.patchline.source[1] === o; })
        .map(function (l) { return l.patchline.destination; });
}
function ins(id) {
    return pat.lines.filter(function (l) { return l.patchline.destination[0] === id; }).map(function (l) { return l.patchline.source[0]; });
}
function has(list, id, inl) { return list.some(function (d) { return d[0] === id && d[1] === inl; }); }

function fnSet(src, re) { var s = {}, m; while ((m = re.exec(src))) s[m[1]] = 1; return s; }
var jsFns = fnSet(main, /^function (\w+)\s*\(/gm);
var nodeHandlers = fnSet(node, /Max\.addHandler\('(\w+)'/g);
var padFns = fnSet(pads, /^function (\w+)\s*\(/gm);

// Selektoren pro [js]-Ausgang: outlet(n, "sel" …) und outlet(n, a) mit var a = ["sel", …]
function jsSent() {
    var r = {}, m, re = /outlet\((\d),\s*(?:"(\w+)"|\[\s*"(\w+)"|(\w+)\))/g;
    while ((m = re.exec(main))) {
        var sel = m[2] || m[3];
        if (m[4]) {   // Variable: letzte Zuweisung davor suchen
            var before = main.slice(0, m.index), dm, dre = new RegExp('var ' + m[4] + ' = \\["(\\w+)"', 'g'), last = null;
            while ((dm = dre.exec(before))) last = dm[1];
            assert.ok(last, 'outlet(' + m[1] + ', ' + m[4] + '): Selektor nicht gefunden');
            sel = last;
        }
        (r[m[1]] = r[m[1]] || {})[sel] = 1;
    }
    return r;
}
var sent = jsSent();
var fails = [];
function need(ok, text) { if (!ok) fails.push(text); }

// Ausgang 1 → Node
need(has(outs(JS, 1), NODE, 0), '[js] Ausgang 1 geht nicht an node.script');
Object.keys(sent[1] || {}).forEach(function (s) { need(nodeHandlers[s], '[js] → Node: kein Handler für ' + s); });

// Ausgang 4 → buffer~
need(has(outs(JS, 4), BUF, 0), '[js] Ausgang 4 geht nicht an buffer~');
Object.keys(sent[4] || {}).forEach(function (s) { need(s === 'replace' || s === 'clear', '[js] → buffer~: unbekannt ' + s); });

// Ausgang 2 → UI-Router, Rest → Pad-jsui
var ui = outs(JS, 2).map(function (d) { return d[0]; }).filter(function (id) { return /^route /.test(B[id].text || ''); });
need(ui.length === 1, '[js] Ausgang 2 hat keinen UI-Router');
var routeSels = B[ui[0]].text.split(/\s+/).slice(1);
routeSels.forEach(function (s, i) { need(outs(ui[0], i).length > 0, 'UI-Router: ' + s + ' hat kein Ziel'); });
var rest = outs(ui[0], routeSels.length).map(function (d) { return B[d[0]]; });
need(rest.length === 1 && rest[0].filename === 'ytpads.js', 'UI-Router-Rest geht nicht an ytpads.js');
Object.keys(sent[2] || {}).forEach(function (s) {
    need(routeSels.indexOf(s) >= 0 || padFns[s], '[js] → UI: ' + s + ' hat kein Ziel');
});
['shownr', 'showname', 'status', 'selinfo'].forEach(function (s) {   // Kommentare über prepend set
    var d = outs(ui[0], routeSels.indexOf(s));
    need(d.length && B[d[0][0]].text === 'prepend set' && B[outs(d[0][0], 0)[0][0]].maxclass === 'comment', s + ': kein prepend set → Kommentar');
});
need(routeSels.indexOf('memclear') < 0 && routeSels.indexOf('lockset') < 0, 'UI-Router: tote Einträge');

// Ausgänge 0 und 3 → poly~
need(/^poly~ ytvoice /.test(B[outs(JS, 0)[0][0]].text), '[js] Ausgang 0 nicht an ytvoice');
need(/^poly~ ytwarpvoice /.test(B[outs(JS, 3)[0][0]].text), '[js] Ausgang 3 nicht an ytwarpvoice');

// Node → [js]: direkt, ohne Router, jeder Selektor hat eine Funktion
var nodeOut = outs(NODE, 0);
need(nodeOut.length === 1 && has(nodeOut, JS, 0), 'node.script Ausgang 0 geht nicht direkt an [js]');
Object.keys(fnSet(node, /Max\.outlet\('(\w+)'/g)).forEach(function (s) { need(jsFns[s], 'Node → [js]: keine Funktion ' + s); });
need(!/Max\.outlet\((?!')/.test(node), 'Node: Max.outlet mit berechnetem Selektor, nicht prüfbar');

// Pad-jsui → [js]
Object.keys(fnSet(pads, /outlet\(0, "(\w+)"/g)).forEach(function (s) { need(jsFns[s], 'ytpads → [js]: keine Funktion ' + s); });

// Patch → [js]: prepend X und Nachrichtenboxen
ins(JS).forEach(function (id) {
    var b = B[id], t = b.text || '', sel = null;
    if (/^prepend /.test(t)) sel = t.split(' ')[1];
    else if (b.maxclass === 'message') sel = t.split(' ')[0];
    else if (id === NODE || b.filename === 'ytpads.js') return;
    else return need(false, 'unerwartete Quelle an [js]: ' + id + ' ' + t);
    need(jsFns[sel], 'Patch → [js]: keine Funktion ' + sel + ' (' + id + ')');
});

// Parameter
var names = {};
pat.boxes.forEach(function (b) {
    var v = b.box.saved_attribute_attributes && b.box.saved_attribute_attributes.valueof;
    if (v && v.parameter_longname) { need(!names[v.parameter_longname], 'Parametername doppelt: ' + v.parameter_longname); names[v.parameter_longname] = b.box; }
});
['Bank', 'Bank Prev', 'Bank Next', 'Session'].forEach(function (n) { need(names[n], 'Parameter fehlt: ' + n); });
need(names.Bank && names.Bank.varname === 'bank' && names.Bank.saved_attribute_attributes.valueof.parameter_mmin === 1 &&
     names.Bank.saved_attribute_attributes.valueof.parameter_mmax === 128, 'Bank: varname bank, 1–128');
['Fav Bank', 'Fav Select', 'Fav Prev', 'Fav Next', 'Fav Add', 'Fav Update', 'Fav Delete', 'Search', 'Load Result', 'Load URL',
 'Max Length', 'Lock', 'Shuffle', 'Reroll', 'Nudge Left', 'Nudge Right'].concat(
    Array.apply(null, Array(16)).map(function (_, i) { return 'Fav Slot ' + (i + 1); })
).forEach(function (n) { need(!names[n], 'alter Parameter noch da: ' + n); });
// setNamed-Ziele
Object.keys(fnSet(main, /setNamed\("(\w+)"/g)).forEach(function (v) {
    need(pat.boxes.some(function (b) { return b.box.varname === v; }), 'setNamed: kein Objekt mit varname ' + v);
});
need(pat.boxes[pat.boxes.length - 1].box.filename === 'ytgrid.js', 'Grid-Overlay ist nicht die letzte Box');

if (fails.length) { console.log(fails.join('\n')); process.exit(1); }
console.log('Verdrahtung ok: ' + routeSels.length + ' UI-Selektoren, ' + Object.keys(nodeHandlers).length + ' Node-Handler');
