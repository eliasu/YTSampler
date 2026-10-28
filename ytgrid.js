// YT Sampler – Raster-Overlay über der Waveform (jsui, durchsichtig, klickt durch)
// rein: grid clear | grid dur <ms> | grid beats <ms…> | grid down <index> | grid show <0/1> | grid pads <sel> <16 x ms>

mgraphics.init();
mgraphics.relative_coords = 0;
mgraphics.autofill = 0;

inlets = 1;
outlets = 0;

var durMs = 0, beatMs = [], downIdx = 0, showOn = 0, padMs = [], sel = 0;

function grid() {
    var a = arrayfromargs(arguments);
    var cmd = a.shift();
    if (cmd === "clear") { beatMs = []; downIdx = 0; }
    else if (cmd === "dur") durMs = a[0] || 0;
    else if (cmd === "beats") beatMs = beatMs.concat(a);
    else if (cmd === "down") downIdx = Math.floor(a[0]) || 0;
    else if (cmd === "show") { showOn = a[0] ? 1 : 0; mgraphics.redraw(); }
    else if (cmd === "pads") { sel = Math.floor(a.shift()); padMs = a; mgraphics.redraw(); }
}

// Der UI-Router im Patch entfernt „grid“: hier kommt „clear“, „dur …“ usw. an. Zustandsvariablen heißen deshalb nicht wie Nachrichten
function anything() {
    grid.apply(this, [messagename].concat(arrayfromargs(arguments)));
}

function paint() {
    var w = mgraphics.size[0], h = mgraphics.size[1];
    if (!(durMs > 0)) return;
    var px = function (ms) { return ms / durMs * w; };

    if (showOn && beatMs.length > 1) {
        var beatPx = px(beatMs[1] - beatMs[0]);
        // so dicht wie lesbar: Beats ab 5 px Abstand, sonst nur Takte, sonst nur jeden 4./16. Takt
        var barEvery = 1;
        if (beatPx * 4 < 4) barEvery = 4;
        if (beatPx * 16 < 4) barEvery = 16;
        for (var i = 0; i < beatMs.length; i++) {
            var rel = i - downIdx;
            var isBar = ((rel % 4) + 4) % 4 === 0;
            var barNo = Math.floor(rel / 4);
            var x = Math.round(px(beatMs[i])) + 0.5;
            if (isBar && ((barNo % barEvery) + barEvery) % barEvery === 0) {
                mgraphics.set_source_rgba(1, 0.75, 0.2, 0.75);
                mgraphics.set_line_width(1);
                mgraphics.move_to(x, 0); mgraphics.line_to(x, h);
                mgraphics.stroke();
            } else if (!isBar && beatPx >= 5) {
                mgraphics.set_source_rgba(1, 1, 1, 0.22);
                mgraphics.set_line_width(1);
                mgraphics.move_to(x, h * 0.55); mgraphics.line_to(x, h);
                mgraphics.stroke();
            }
        }
    }

    // Pad-Marken: kleine Dreiecke oben, gewähltes Pad hell
    for (var p = 0; p < padMs.length; p++) {
        var mx = px(padMs[p]);
        if (p === sel) mgraphics.set_source_rgba(1, 1, 1, 1);
        else mgraphics.set_source_rgba(1, 0.55, 0.1, 0.9);
        mgraphics.move_to(mx - 3, 0); mgraphics.line_to(mx + 3, 0); mgraphics.line_to(mx, 5);
        mgraphics.close_path();
        mgraphics.fill();
    }
}

function onresize() { mgraphics.redraw(); }
