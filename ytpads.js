// YT Sampler – Pad-Raster (jsui)
// raus: padhit <i> (Maus runter), padup <i> (Maus los)
// rein: padflash <i> <ms> | padlight <i> <0/1> | padsel <i>

mgraphics.init();
mgraphics.relative_coords = 0;
mgraphics.autofill = 0;

inlets = 1;
outlets = 1;

var NP = 16, GAP = 3;
var level = [], held = [], until = [];
var sel = 0;
var pressed = -1;

for (var i = 0; i < NP; i++) { level.push(0); held.push(0); until.push(0); }

var anim = new Task(tick, this);
anim.interval = 30;

function now() { return new Date().getTime(); }

function geom() {
    var w = mgraphics.size[0], h = mgraphics.size[1];
    return { cw: (w - GAP * 3) / 4, ch: (h - GAP * 3) / 4 };
}

// Pad 1 unten links wie bei MPC / Drum Rack
function padRect(i, g) {
    var col = i % 4, row = 3 - Math.floor(i / 4);
    return [col * (g.cw + GAP), row * (g.ch + GAP), g.cw, g.ch];
}

function padAt(x, y) {
    var g = geom();
    var col = Math.floor(x / (g.cw + GAP)), row = Math.floor(y / (g.ch + GAP));
    if (col < 0 || col > 3 || row < 0 || row > 3) return -1;
    return (3 - row) * 4 + col;
}

function paint() {
    var g = geom();
    mgraphics.select_font_face("Arial Bold");
    mgraphics.set_font_size(10);
    for (var i = 0; i < NP; i++) {
        var r = padRect(i, g), l = level[i];
        // dunkelgrau -> orange
        mgraphics.set_source_rgba(0.20 + 0.80 * l, 0.20 + 0.42 * l, 0.22 - 0.12 * l, 1);
        mgraphics.rectangle_rounded(r[0], r[1], r[2], r[3], 5, 5);
        mgraphics.fill();
        if (i === sel) {
            mgraphics.set_source_rgba(1, 1, 1, 0.85);
            mgraphics.set_line_width(1.5);
            mgraphics.rectangle_rounded(r[0] + 0.75, r[1] + 0.75, r[2] - 1.5, r[3] - 1.5, 5, 5);
            mgraphics.stroke();
        }
        mgraphics.set_source_rgba(l > 0.5 ? 0.1 : 0.75, l > 0.5 ? 0.1 : 0.75, l > 0.5 ? 0.1 : 0.78, 1);
        mgraphics.move_to(r[0] + 4, r[1] + 12);
        mgraphics.show_text(String(i + 1));
    }
}

function tick() {
    var t = now(), active = false;
    for (var i = 0; i < NP; i++) {
        if (!held[i] && level[i] > 0 && t >= until[i]) level[i] = Math.max(0, level[i] - 0.2);
        if (level[i] > 0 || held[i]) active = true;
    }
    mgraphics.redraw();
    if (!active) anim.cancel();
}

function wake() { if (!anim.running) anim.repeat(); }

function padflash(i, ms) {
    i = Math.floor(i);
    if (i < 0 || i >= NP) return;
    level[i] = 1; held[i] = 0;
    until[i] = now() + Math.max(60, ms || 0);
    wake();
}

function padlight(i, v) {
    i = Math.floor(i);
    if (i < 0 || i >= NP) return;
    held[i] = v ? 1 : 0;
    if (v) level[i] = 1; else until[i] = now();
    wake();
}

function padsel(i) {
    i = Math.floor(i);
    if (i < 0 || i >= NP || i === sel) return;
    sel = i;
    mgraphics.redraw();
}

function onclick(x, y, but) {
    var i = padAt(x, y);
    if (i < 0) return;
    pressed = i;
    outlet(0, "padhit", i);
}

function ondrag(x, y, but) {
    if (but === 0 && pressed >= 0) {       // Maustaste losgelassen
        outlet(0, "padup", pressed);
        pressed = -1;
    }
}

function onresize() { mgraphics.redraw(); }
