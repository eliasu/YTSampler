// YT Sampler – Raster-Overlay über der Waveform (jsui, durchsichtig, klickt durch)
// rein: grid clear | grid dur <ms> | grid beats <ms…> | grid bars <ms…> | grid show <0/1> | grid pads <sel> <16 x ms>
// bars = die Schläge, die eine „1“ sind (mit Bank liegen Lücken zwischen den Fächern, ein Index ginge nicht)

mgraphics.init();
mgraphics.relative_coords = 0;
mgraphics.autofill = 0;

inlets = 1;
outlets = 0;

var durMs = 0, beatMs = [], barNo = {}, barCount = 0, showOn = 0, padMs = [], sel = 0;   // barNo: ms -> laufende Taktnummer

function grid() {
    var a = arrayfromargs(arguments);
    var cmd = a.shift();
    if (cmd === "clear") { beatMs = []; barNo = {}; barCount = 0; }
    else if (cmd === "dur") durMs = a[0] || 0;
    else if (cmd === "beats") beatMs = beatMs.concat(a);
    else if (cmd === "bars") for (var k = 0; k < a.length; k++) barNo[a[k]] = barCount++;
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
        // kleinster Abstand = Schlagabstand (zwischen zwei Fächern liegt eine Lücke)
        var d = Infinity;
        for (var j = 1; j < beatMs.length; j++) if (beatMs[j] > beatMs[j - 1]) d = Math.min(d, beatMs[j] - beatMs[j - 1]);
        var beatPx = px(d);
        // so dicht wie lesbar: Beats ab 5 px Abstand, sonst nur Takte, sonst nur jeden 4./16. Takt
        var barEvery = 1;
        if (beatPx * 4 < 4) barEvery = 4;
        if (beatPx * 16 < 4) barEvery = 16;
        for (var i = 0; i < beatMs.length; i++) {
            var bn = barNo[beatMs[i]];
            var isBar = bn !== undefined;
            var x = Math.round(px(beatMs[i])) + 0.5;
            if (isBar && bn % barEvery === 0) {
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
