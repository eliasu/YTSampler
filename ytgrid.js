// YT Sampler – Raster-Overlay über der Waveform (jsui, durchsichtig, klickt durch)
// rein: grid clear | grid dur <ms> | grid beats <ms…> | grid down <index> | grid show <0/1> | grid pads <sel> <16 x ms>

mgraphics.init();
mgraphics.relative_coords = 0;
mgraphics.autofill = 0;

inlets = 1;
outlets = 0;

var dur = 0, beats = [], down = 0, show = 0, pads = [], sel = 0;

function grid() {
    var a = arrayfromargs(arguments);
    var cmd = a.shift();
    if (cmd === "clear") { beats = []; down = 0; }
    else if (cmd === "dur") dur = a[0] || 0;
    else if (cmd === "beats") beats = beats.concat(a);
    else if (cmd === "down") down = Math.floor(a[0]) || 0;
    else if (cmd === "show") { show = a[0] ? 1 : 0; mgraphics.redraw(); }
    else if (cmd === "pads") { sel = Math.floor(a.shift()); pads = a; mgraphics.redraw(); }
}

function paint() {
    var w = mgraphics.size[0], h = mgraphics.size[1];
    if (!(dur > 0)) return;
    var px = function (ms) { return ms / dur * w; };

    if (show && beats.length > 1) {
        var beatPx = px(beats[1] - beats[0]);
        // so dicht wie lesbar: Beats ab 5 px Abstand, sonst nur Takte, sonst nur jeden 4./16. Takt
        var barEvery = 1;
        if (beatPx * 4 < 4) barEvery = 4;
        if (beatPx * 16 < 4) barEvery = 16;
        for (var i = 0; i < beats.length; i++) {
            var rel = i - down;
            var isBar = ((rel % 4) + 4) % 4 === 0;
            var barNo = Math.floor(rel / 4);
            var x = Math.round(px(beats[i])) + 0.5;
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
    for (var p = 0; p < pads.length; p++) {
        var mx = px(pads[p]);
        if (p === sel) mgraphics.set_source_rgba(1, 1, 1, 1);
        else mgraphics.set_source_rgba(1, 0.55, 0.1, 0.9);
        mgraphics.move_to(mx - 3, 0); mgraphics.line_to(mx + 3, 0); mgraphics.line_to(mx, 5);
        mgraphics.close_path();
        mgraphics.fill();
    }
}

function onresize() { mgraphics.redraw(); }
