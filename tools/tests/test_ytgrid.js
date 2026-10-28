// Attrappen-Test für ytgrid.js: Nachrichten wie hinter dem UI-Router (ohne „grid“) → paint() zeichnet Linien
// Aufruf aus dem Projektordner: node tools/tests/test_ytgrid.js
var fs = require('fs'), vm = require('vm'), assert = require('assert');

var lines = 0, fills = 0;
var mg = {
    size: [800, 60],
    init: function () {}, redraw: function () {},
    set_source_rgba: function () {}, set_line_width: function () {},
    move_to: function () {}, line_to: function () {}, close_path: function () {},
    stroke: function () { lines++; }, fill: function () { fills++; }
};
var ctx = { mgraphics: mg, arrayfromargs: function (a) { return Array.prototype.slice.call(a); } };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(__dirname + '/../../ytgrid.js', 'utf8'), ctx);

// wie Max: gibt es eine Funktion mit dem Selektornamen, die, sonst anything() mit messagename
function send(sel) {
    var args = Array.prototype.slice.call(arguments, 1);
    ctx.messagename = sel;
    (typeof ctx[sel] === "function" ? ctx[sel] : ctx.anything).apply(null, args);
}

var beats = [];
for (var t = 0; t < 8000; t += 500) beats.push(t);
send('clear');
send('dur', 8000);
send.apply(null, ['beats'].concat(beats));
send.apply(null, ['bars'].concat(beats.filter(function (b, i) { return i % 4 === 0; })));
send('show', 1);
send.apply(null, ['pads', 0].concat([0, 500, 1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000, 5500, 6000, 6500, 7000, 7500]));

ctx.paint();
assert.strictEqual(lines, beats.length, 'eine Linie pro Beat');
assert.strictEqual(fills, 16, 'eine Marke pro Pad');

lines = 0; fills = 0;
send('show', 0);
ctx.paint();
assert.strictEqual(lines, 0, 'show 0 → keine Linien');
console.log('ok ytgrid');
