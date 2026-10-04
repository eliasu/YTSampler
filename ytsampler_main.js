// YT Sampler – Hauptlogik ([js] in Max)
// outlet 0 -> poly~ (Voices)   outlet 1 -> node.script (load <id>)
// outlet 2 -> UI-Router        outlet 3 -> poly~ Warp-Voices (ytwarpvoice)
// Zustand wird vom Node-Teil als Datei gespeichert (~/Music/YTSampler/sessions/<session>.json).
// Die Session-Nummer ist ein unsichtbarer Live-Parameter und steckt damit im Set.

autowatch = 0;
inlets = 1;
outlets = 4;

var DIVS = [
    ["1/64", 1 / 64], ["1/32", 1 / 32], ["1/16T", 1 / 24], ["1/16", 1 / 16],
    ["1/8T", 1 / 12], ["1/8", 1 / 8], ["1/4T", 1 / 6], ["1/4", 1 / 4],
    ["1/2", 1 / 2], ["1 Bar", 1], ["2 Bars", 2]
];
var NPADS = 16;
var KEY_CHANNEL = 16;    // Schreibmaschine: Noten auf diesem Kanal sind Tasten (Notennummer = Zeichencode)
var NFAV = 64;           // Favoriten-Plätze (4 Bänke à 16)
var BANKS = ["A", "B", "C", "D"];
var HOLD_MAX = 10000;   // Hold-Modus: maximale Länge in ms
var VMAX = 16;          // Anzahl Instanzen im poly~
var VOICE_OPTS = [1, 2, 3, 4, 5, 8, 16];
var NOTE = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
var HOLD_ANALYSIS = 4000;   // Analysefenster im Hold-Modus (ms)

// Einstellungen kommen von den live.*-Reglern (die speichert Live selbst)
var P = { bpm: 120, div: 5, rate: 1, atk: 2, rel: 20, mode: 0, rev: 0, base: 36, voices: 16, tune: 0, thresh: 0.5, warp: 0, grid: 0, snap: 0, quant: 0 };   // snap: 0 = Slice, 1 = Beat, 2 = Bar
var TEMPO_MIN_CONF = 0.3;
var QUANT_LATE = 0.3;       // Input-Quantize: bis zu diesem Anteil einer 1/16 nach dem Raster sofort spielen (zu spät gedrückt)   // darunter wird ein erkanntes Tempo nicht automatisch benutzt

// Lives globale Skala (Live 12: Song.root_note / Song.scale_intervals)
var SC = { root: 0, ints: [0, 2, 4, 5, 7, 9, 11] };

// Zustand, der über pattr im Set landet
var st = newState();

var durMs = 0;
var sel = 0;
var memSel = -1;
var lastSaved = "";

// Stimmenverwaltung: welche Stimme spielt welches Pad, bis wann
var voices = [];
for (var vi = 0; vi < VMAX; vi++) voices.push({ pad: -1, end: 0, t: 0, eng: 0 });   // eng: 0 = Sampler, 1 = Warp

function engOut(e) { return e ? 3 : 0; }

// Beat-Raster (kommt vom Node-Teil): Schlagzeiten in ms, Index der ersten "1"
var beats = [], beatsIn = [], beatsDown = 0, beatsReady = 0, beatsDone = 0;

// Tonart pro Pad (kommt vom Node-Teil) und daraus berechnete Verschiebung
var keys = [], shifts = [];
var tuningCents = 0, analysisReady = 0;
resetKeys();

function resetKeys() {
    keys = []; shifts = [];
    for (var i = 0; i < NPADS; i++) { keys.push(null); shifts.push(null); }
}

function newState() {
    var s = { id: "", title: "", pads: [], locks: [], favs: [], fav: -1, bank: 0,
              srcBpm: 0, srcAuto: 1, bpmConf: 0 };   // Quelltempo des aktuellen Videos
    for (var i = 0; i < NPADS; i++) { s.pads.push(0); s.locks.push(0); }
    for (var f = 0; f < NFAV; f++) s.favs.push(null);
    return s;
}

// ---------- Start / Session ----------
var P_ = this.patcher;  // Patcher-Referenz für getnamed()
var initDone = 0;       // Aktionen erst nach dem Laden des Sets zulassen
var stateReady = 0;     // erst speichern, wenn der gespeicherte Zustand gelesen wurde
var sessionId = 0;
var claimedId = 0;
var pendingFav = -1;    // Favorit, dessen Video gerade lädt
var favTask = new Task(favSelectNow, this);
var favSelTarget = -1;

// Live stellt beim Öffnen alle Parameter wieder her; Buttons würden dabei "gedrückt".
// Deshalb alle Aktionen erst kurz nach live.thisdevice erlauben.
var initTask = new Task(function () { initDone = 1; }, this);

function ready() { return initDone === 1; }

function sessionid(v) {
    v = Math.floor(v);
    if (v > 0) sessionId = v;
}

function sendSession() {
    if (sessionId > 0 && sessionId !== claimedId) {
        claimedId = sessionId;
        outlet(1, "session", sessionId);
    }
}

function needsession() { claimedId = 0; sendSession(); }   // Node-Teil ist (neu) gestartet

function newsession(v) {                                   // Node-Teil hat Duplikat erkannt
    sessionId = claimedId = Math.floor(v);
    setNamed("Session", "int", sessionId);
}

function statenone() { stateReady = 1; updateFavUI(); }

function setNamed(name) {
    var o = P_.getnamed(name);
    if (!o) return;
    var a = arrayfromargs(arguments).slice(1);
    o.message.apply(o, a);
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// Slice-Länge in ms aus Live-Tempo und Notenwert (4/4 angenommen)
function sliceMs() { return 60000 / Math.max(20, P.bpm) * 4 * DIVS[P.div][1]; }

// Wie viel Quellmaterial ein Slice verbraucht (Rate > 1 = mehr Material)
function spanMs() { return sliceMs() * P.rate; }

// Tonhöhenfaktor aus Skala-Anpassung + Stimmungskorrektur
function pitchRate(i) {
    if (!P.tune || shifts[i] === null) return 1;
    return Math.pow(2, (shifts[i] - tuningCents / 100) / 12);
}
function padRate(i) { return P.rate * pitchRate(i); }

// Warp: Verhältnis Projekttempo / Quelltempo (0 = Warp aus oder Tempo unbekannt)
function tempoTrusted() {
    if (!(st.srcBpm > 0)) return false;
    return !(st.srcAuto && st.bpmConf < TEMPO_MIN_CONF);        // unsicheres Tempo nicht automatisch nutzen
}
function warpRatio() {
    if (!P.warp || !tempoTrusted()) return 0;
    return clamp(P.bpm / st.srcBpm, 0.25, 4);
}

// ---------- Beat-Raster ----------
// Raster ist aktiv, wenn eingeschaltet, Beats da und das Tempo vertrauenswürdig (sonst: kein Beat)
function gridOK() { return P.grid && beatsReady && beats.length >= 4 && tempoTrusted(); }

// Rasterabstand in Schlägen
function gridStep() {
    if (P.snap === 1) return 1;
    if (P.snap === 2) return 4;
    return DIVS[P.div][1] * 4;                 // Slice: Notenwert, z. B. 1/8 = 0,5 Schlag
}

// Zeit (ms) -> Position in Schlägen, 0 = erste "1"; außerhalb der Beats linear weiter
function xAt(t) {
    var n = beats.length, lo = 0, hi = n - 1, i;
    if (t <= beats[0]) return (0 - beatsDown) + (t - beats[0]) / (beats[1] - beats[0]);
    if (t >= beats[n - 1]) return (n - 1 - beatsDown) + (t - beats[n - 1]) / (beats[n - 1] - beats[n - 2]);
    while (hi - lo > 1) { i = (lo + hi) >> 1; if (beats[i] <= t) lo = i; else hi = i; }
    return (lo - beatsDown) + (t - beats[lo]) / (beats[lo + 1] - beats[lo]);
}

// Position in Schlägen -> Zeit (ms)
function timeAt(x) {
    var n = beats.length, j = x + beatsDown, i = Math.floor(j), f = j - i;
    if (i < 0) return beats[0] + j * (beats[1] - beats[0]);
    if (i >= n - 1) return beats[n - 1] + (j - (n - 1)) * (beats[n - 1] - beats[n - 2]);
    return beats[i] + f * (beats[i + 1] - beats[i]);
}

function snapTime(t) {
    var st_ = gridStep();
    return timeAt(Math.round(xAt(t) / st_) * st_);
}

// tatsächlicher Startpunkt eines Pads (mit Raster eingerastet; gespeichert wird die freie Position)
function effStart(i) {
    var t = clamp(st.pads[i] || 0, 0, durMs);
    if (!gridOK()) return t;
    var s = snapTime(t);
    if (s < 0) s = timeAt((Math.floor(xAt(t) / gridStep()) + 1) * gridStep());
    return clamp(s, 0, Math.max(0, durMs - 1));
}

// zufälliger Rasterpunkt, von dem aus noch ein ganzer Slice Material übrig ist
function randomGridStart() {
    var stp = gridStep();
    var g0 = Math.ceil(xAt(0) / stp), g1 = Math.floor(xAt(Math.max(0, durMs - spanMs())) / stp);
    if (g1 < g0) return -1;
    return clamp(timeAt((g0 + Math.floor(Math.random() * (g1 - g0 + 1))) * stp), 0, durMs);
}

function requestBeats() {
    beatsReady = 0; beatsDone = 0;
    if (analysisReady && st.srcBpm > 0) outlet(1, "beattrack", st.srcBpm);
    else sendGridUI();
}

// vom Node-Teil: beatsclear | beatsadd <ms…> | beatsdone <down> <anzahl>
function beatsclear() { beatsIn = []; }
function beatsadd() { beatsIn = beatsIn.concat(arrayfromargs(arguments)); }
function beatsdone(down, n) {
    beats = beatsIn; beatsIn = []; beatsDone = 1;
    beatsDown = Math.floor(down) || 0;
    beatsReady = beats.length >= 4 ? 1 : 0;
    if (beatsReady && beatsDown >= beats.length) beatsDown = 0;
    requestAll();
    sendGridUI();
    updateSel();
}

function gridon(v) {
    P.grid = v ? 1 : 0;
    requestAll(); sendGridUI(); updateSel();
    if (P.grid && ready() && durMs > 0 && !gridOK()) status(beatsReady ? "Grid: kein sicherer Beat – Tempo bestätigen (Src BPM, ÷2, ×2)" : "Grid: kein Beat erkannt");
}
function snapmode(v) { P.snap = clamp(Math.floor(v), 0, 2); requestAll(); sendGridUI(); updateSel(); }

// Raster-Overlay über der Waveform
function sendGridUI() {
    outlet(2, "grid", "clear");
    outlet(2, "grid", "dur", durMs);
    if (gridOK()) {
        for (var k = 0; k < beats.length; k += 200) outlet(2, ["grid", "beats"].concat(beats.slice(k, k + 200)));
        outlet(2, "grid", "down", beatsDown);
    }
    outlet(2, "grid", "show", gridOK() ? 1 : 0);
    sendPadMarks();
}
function sendPadMarks() {
    var a = ["grid", "pads", sel];
    for (var i = 0; i < NPADS; i++) a.push(effStart(i));
    outlet(2, a);
}

// Abspielbereich eines Pads: von, bis (Quell-ms) und Warp-Faktor
function playRange(i) {
    var start = effStart(i), from, to, R = warpRatio();
    if (P.mode && P.rev) {                     // Hold rückwärts: ab Startpunkt nach links
        from = start; to = Math.max(0, start - padSpan(i));
    } else {
        if (R > 0 && !P.mode && gridOK()) {
            // Warp + Grid: Slice endet auf dem Raster der Quelle -> folgt schwankendem Tempo
            var end = timeAt(xAt(start) + DIVS[P.div][1] * 4);
            if (end > start) R = clamp((end - start) / sliceMs(), 0.25, 4);
            to = Math.min(start + sliceMs() * R, durMs);
        } else {
            to = Math.min(start + padSpan(i), durMs);
        }
        from = start;
        if (P.rev) { var tmp = from; from = to; to = tmp; }
    }
    return { from: from, to: to, R: R };
}

// Abgespielter Quellbereich: Trigger = Slice, Hold = bis zu HOLD_MAX
// Warp: Slice = gleicher Notenwert im Tempo der Quelle
function padSpan(i) {
    var base = P.mode ? HOLD_MAX : sliceMs();
    var R = warpRatio();
    return R > 0 ? base * R : base * padRate(i);
}

// Fenster, das der Node-Teil pro Pad analysiert (mind. 2 s, macht der Node-Teil)
function analysisSpan() { return P.mode ? HOLD_ANALYSIS : spanMs(); }

function randomStart() {
    if (gridOK()) { var g = randomGridStart(); if (g >= 0) return g; }
    var m = durMs - spanMs();
    return m > 0 ? Math.random() * m : 0;
}

function fmt(ms) {
    var m = Math.floor(ms / 60000);
    var s = (ms % 60000) / 1000;
    return m + ":" + (s < 10 ? "0" : "") + s.toFixed(2);
}

function status(t) { outlet(2, "status", t); }

function nowMs() { return new Date().getTime(); }

// Stimme für Pad i wählen:
// 1. Stimme, die schon dieses Pad spielt (Pad schneidet sich selbst ab)
// 2. freie Stimme
// 3. älteste Stimme stehlen
function allocVoice(i) {
    var t = nowMs(), n = P.voices, k, best = -1;
    for (k = 0; k < n; k++) if (voices[k].pad === i) return k;
    for (k = 0; k < n; k++) if (voices[k].end <= t) { best = k; break; }
    if (best < 0) {
        best = 0;
        for (k = 1; k < n; k++) if (voices[k].t < voices[best].t) best = k;
    }
    return best;
}

function killVoice(k, fade) {
    var v = voices[k];
    if (v.end > nowMs()) {
        outlet(engOut(v.eng), "target", k + 1);
        outlet(engOut(v.eng), "gateoff", fade);
        if (v.pad >= 0) outlet(2, "padlight", v.pad, 0);
    }
    v.pad = -1; v.end = 0;
}

// ---------- Parameter ----------
function init() {
    if (!sessionId) {                                     // neues Device: Nummer erzeugen
        sessionId = 1 + Math.floor(Math.random() * 999998);
        setNamed("Session", "int", sessionId);
    }
    sendSession();
    updateFavUI();
    updateSel();
    initTask.schedule(300);
}
function bpm(v) { P.bpm = v; requestAll(); updateSel(); }
function division(v) { P.div = clamp(Math.floor(v), 0, DIVS.length - 1); requestAll(); if (P.snap === 0) sendPadMarks(); updateSel(); }
function rate(v) { P.rate = clamp(v, 0.1, 4); requestAll(); updateSel(); }
function attack(v) { P.atk = Math.max(0, v); }
function release(v) { P.rel = Math.max(0, v); }
function playmode(v) { P.mode = v ? 1 : 0; requestAll(); updateSel(); }   // 0 = Trigger, 1 = Hold
function reverse(v) { P.rev = v ? 1 : 0; }
function basenote(v) { P.base = Math.floor(v); }
// ---------- Warp / Quelltempo ----------
function warp(v) { P.warp = v ? 1 : 0; requestAll(); updateSel(); }

// vom Node-Teil: tempo <bpm> <konfidenz>
function tempo(bpm, conf) {
    st.bpmConf = conf || 0;
    if (st.srcAuto || !(st.srcBpm > 0)) { st.srcBpm = bpm || 0; st.srcAuto = 1; }
    save();
    updateSrcUI();
    updateSel();
}   // Beats werden bei analysisready angefordert

// Quelltempo von Hand (Zahlenfeld) -> gilt als bestätigt
function srcbpm(v) {
    if (!ready()) return;
    if (Math.abs(v - st.srcBpm) < 0.01) return;
    st.srcBpm = v; st.srcAuto = 0;
    save(); updateSrcUI(); requestBeats(); updateSel();
}
function bpmhalf() { scaleSrc(0.5); }
function bpmdouble() { scaleSrc(2); }
function scaleSrc(f) {
    if (!ready() || !(st.srcBpm > 0)) return;
    st.srcBpm = clamp(Math.round(st.srcBpm * f * 10) / 10, 30, 300); st.srcAuto = 0;
    save(); updateSrcUI(); requestBeats(); updateSel();
    status("Quelltempo: " + st.srcBpm + " BPM");
}

function updateSrcUI() { setNamed("srcbpm", "set", st.srcBpm || 0); }

// ---------- Skala / Tonart ----------
function tune(v) { P.tune = v ? 1 : 0; updateSel(); }
function threshold(v) { P.thresh = clamp(v, 0, 1); recomputeShifts(); }
function scaleroot(v) { SC.root = ((Math.floor(v) % 12) + 12) % 12; recomputeShifts(); }
function scaleints() {
    var a = arrayfromargs(arguments), ints = [];
    for (var k = 0; k < a.length; k++) if (typeof a[k] === "number") ints.push(((Math.floor(a[k]) % 12) + 12) % 12);
    if (ints.length) SC.ints = ints;
    recomputeShifts();
}
function tuning(c) { tuningCents = c; updateSel(); }
function analysisready() { analysisReady = 1; requestBeats(); requestAll(); }

// Ergebnis vom Node-Teil: padinfo <i> <konfidenz> <grundton> <moll> <chroma x12>
function padinfo() {
    var a = arrayfromargs(arguments);
    var i = Math.floor(a[0]);
    if (i < 0 || i >= NPADS) return;
    keys[i] = { conf: a[1], tonic: a[2], minor: a[3], c: a.slice(4, 16) };
    shifts[i] = computeShift(i);
    if (i === sel) updateSel();
}

function requestAll() {
    if (!analysisReady) return;
    var a = ["analyzeall", analysisSpan()];
    for (var i = 0; i < NPADS; i++) a.push(effStart(i));
    outlet(1, a);
}
function requestPad(i) {
    if (!analysisReady) return;
    outlet(1, "analyze", i, effStart(i), analysisSpan());
}

// Verschiebung (Halbtöne), mit der möglichst viel vom Pad in Lives Skala liegt.
// Gleichstand: erkannter Grundton landet auf Lives Grundton, dann kleinere Verschiebung.
// null = nicht tonal genug -> nicht transponieren.
function computeShift(i) {
    var k = keys[i];
    if (!k || k.conf < P.thresh) return null;
    var mask = [], pc, s, best = 0, bestScore = -1e9;
    for (pc = 0; pc < 12; pc++) mask.push(0);
    for (var n = 0; n < SC.ints.length; n++) mask[(SC.root + SC.ints[n]) % 12] = 1;
    for (s = -5; s <= 6; s++) {
        var score = 0;
        for (pc = 0; pc < 12; pc++) score += k.c[((pc - s) % 12 + 12) % 12] * mask[pc];
        if (((k.tonic + s) % 12 + 12) % 12 === SC.root) score += 0.15;
        score -= 0.01 * Math.abs(s);
        if (score > bestScore) { bestScore = score; best = s; }
    }
    return best;
}

function recomputeShifts() {
    for (var i = 0; i < NPADS; i++) shifts[i] = computeShift(i);
    updateSel();
}

function voicecount(v) {                        // Index aus dem live.menu
    P.voices = VOICE_OPTS[clamp(Math.floor(v), 0, VOICE_OPTS.length - 1)];
    for (var k = P.voices; k < VMAX; k++) killVoice(k, 10);   // überzählige Stimmen ausblenden
}

// ---------- Spielen ----------
function note(p, v, ch) {
    if (ch === KEY_CHANNEL) {                  // Texteingabe, kein Pad
        if (v > 0) outlet(1, "key", Math.floor(p));
        return;
    }
    var i = Math.floor(p) - P.base;
    if (i < 0 || i >= NPADS) return;
    hit(i, v);
}

function padhit(i) { hit(clamp(Math.floor(i), 0, NPADS - 1), 100); }
function padup(i) { hit(clamp(Math.floor(i), 0, NPADS - 1), 0); }

// ---------- Input-Quantize ----------
// [metro 16n @quantize 16n] im Patch schickt tick auf jede 1/16 von Lives Transport.
// Läuft der Transport nicht, kommen keine Ticks und alles spielt sofort.
var qTick = 0, qQueue = [];
function quantize(v) { P.quant = v ? 1 : 0; if (!P.quant) tick(); }
function tick() {
    qTick = nowMs();
    var q = qQueue; qQueue = [];
    for (var n = 0; n < q.length; n++) play(q[n][0], q[n][1]);
}
function hit(i, v) {
    var step = 15000 / Math.max(20, P.bpm), since = nowMs() - qTick;
    var wait = P.quant && since < step * 1.5 && since > step * QUANT_LATE;
    if (!wait && v === 0) {                    // Note-Off hinter seinem wartenden Note-On einreihen
        for (var n = 0; n < qQueue.length; n++) if (qQueue[n][0] === i) wait = true;
    }
    if (wait) qQueue.push([i, v]);
    else play(i, v);
}
function play(i, v) { if (v > 0) trigger(i, v); else noteoff(i); }

function trigger(i, vel) {
    sel = i;
    if (durMs <= 0) { updateSel(); return; }
    var r = padRate(i);
    var pr = playRange(i), from = pr.from, to = pr.to, R = pr.R;
    var dur = Math.abs(to - from) / (R > 0 ? R : r);   // reale Abspieldauer in ms
    if (dur < 1) return;
    var amp = vel / 127;
    var atk = Math.min(P.atk, dur * 0.5);
    var rel = Math.min(P.rel, dur * 0.5);

    var t = nowMs();
    var k = allocVoice(i);
    var old = voices[k].pad;
    if (old >= 0 && old !== i && voices[k].end > t) outlet(2, "padlight", old, 0);   // gestohlen
    var eng = R > 0 ? 1 : 0;
    // Voice spielte noch auf der anderen Engine -> dort kurz ausblenden
    if (voices[k].eng !== eng && voices[k].end > t) {
        outlet(engOut(voices[k].eng), "target", k + 1);
        outlet(engOut(voices[k].eng), "gateoff", 5);
    }
    voices[k].pad = i; voices[k].end = t + dur; voices[k].t = t; voices[k].eng = eng;

    var o = engOut(eng);
    outlet(o, "target", k + 1);
    outlet(o, "env", 0);
    if (eng) outlet(o, "wplay", from, to >= from ? R : -R, r);   // Tempo R, Tonhöhe r (Rate × Tune)
    else outlet(o, "pos", from, to, dur);
    outlet(o, "env", amp, atk);
    outlet(o, "rel", Math.max(0, dur - rel), rel);
    if (P.mode) outlet(2, "padlight", i, 1);
    else outlet(2, "padflash", i, dur);
    updateSel();
}

function noteoff(i) {
    if (!P.mode) return;                       // Trigger: Note-Off ignorieren
    outlet(2, "padlight", i, 0);
    var t = nowMs();
    for (var k = 0; k < VMAX; k++) {
        if (voices[k].pad === i && voices[k].end > t) {
            outlet(engOut(voices[k].eng), "target", k + 1);
            outlet(engOut(voices[k].eng), "gateoff", P.rel);
            voices[k].end = t + P.rel;
        }
    }
}

// ---------- Slices bearbeiten ----------
function shuffle() {
    if (!ready()) return;
    for (var i = 0; i < NPADS; i++) if (!st.locks[i]) st.pads[i] = randomStart();
    save();
    requestAll();
    sendPadMarks();
    updateSel();
    status(gridOK() ? "Pads neu gewürfelt (auf Raster)" : "Pads neu gewürfelt");
}

function reroll() {
    if (!ready()) return;
    st.pads[sel] = randomStart();
    save();
    requestPad(sel);
    trigger(sel, 100);
}

function nudge(d) {
    if (!ready()) return;
    if (gridOK()) {                            // eine Rasterstufe weiter
        var stp = gridStep();
        st.pads[sel] = clamp(timeAt((Math.round(xAt(effStart(sel)) / stp) + d) * stp), 0, Math.max(0, durMs - 1));
    } else {
        st.pads[sel] = clamp(st.pads[sel] + d * sliceMs() / 8, 0, Math.max(0, durMs - 1));
    }
    save();
    requestPad(sel);
    trigger(sel, 100);
}

function lock(v) {
    if (!ready()) return;
    st.locks[sel] = v ? 1 : 0;
    save();
}

// ---------- Laden ----------
function loaded() {
    var a = arrayfromargs(arguments);          // pfad dauer id titel…
    durMs = parseFloat(a[1]) || 0;
    analysisReady = 0;
    tuningCents = 0;
    resetKeys();
    beats = []; beatsIn = []; beatsReady = 0; beatsDone = 0;
    var id = String(a[2]);
    var title = a.slice(3).join(" ");
    var i;
    var pf = (pendingFav >= 0) ? st.favs[pendingFav] : null;
    pendingFav = -1;
    if (pf && pf.id === id) {
        // Favorit: gespeicherte Slice-Positionen übernehmen
        st.id = id;
        st.title = title || pf.title;
        applyPads(pf);
        applySrc(pf);
    } else if (id !== st.id || st.pads.length !== NPADS) {
        // neues Video: alles frisch würfeln, kein Favorit aktiv
        st.id = id;
        st.title = title;
        st.srcBpm = 0; st.srcAuto = 1; st.bpmConf = 0;   // Tempo kommt gleich aus der Analyse
        st.pads = []; st.locks = [];
        for (i = 0; i < NPADS; i++) { st.pads.push(randomStart()); st.locks.push(0); }
        if (st.fav >= 0 && (!st.favs[st.fav] || st.favs[st.fav].id !== id)) st.fav = -1;
    } else {
        // gleiches Video (z. B. Set neu geöffnet): Positionen behalten
        if (title) st.title = title;
        for (i = 0; i < NPADS; i++) st.pads[i] = clamp(st.pads[i] || 0, 0, durMs);
    }
    save();
    updateFavUI();
    updateSrcUI();
    sendGridUI();
    updateSel();
}

function applySrc(f) {
    if (f.srcBpm > 0) { st.srcBpm = f.srcBpm; st.srcAuto = f.srcAuto ? 1 : 0; st.bpmConf = f.bpmConf || 0; }
}

function applyPads(f) {
    for (var i = 0; i < NPADS; i++) {
        st.pads[i] = clamp((f.pads && f.pads[i]) || 0, 0, Math.max(0, durMs));
        st.locks[i] = (f.locks && f.locks[i]) ? 1 : 0;
    }
}

// ---------- Favoriten (64 Plätze, 4 Bänke à 16, feste Plätze) ----------
function favName(idx) { return BANKS[Math.floor(idx / 16)] + ((idx % 16) + 1); }

function shortTitle(t) {
    t = String(t || "").replace(/^\s+|\s+$/g, "");
    return t.length > 9 ? t.substring(0, 8) + "…" : t;
}

function recallFav(idx) {
    var f = st.favs[idx];
    if (!f) { status("Platz " + favName(idx) + " ist leer – mit „+ Neu“ belegen"); updateFavUI(); return; }
    st.fav = idx;
    st.bank = Math.floor(idx / 16);
    if (f.id === st.id && durMs > 0) {           // gleiches Video: nur Slices umschalten
        var oldBpm = st.srcBpm;
        applyPads(f);
        applySrc(f);
        updateSrcUI();
        save();
        if (st.srcBpm !== oldBpm) requestBeats();
        requestAll();
        sendPadMarks();
        updateSel();
        status("Favorit " + favName(idx) + ": " + f.title);
    } else {
        pendingFav = idx;
        status("Lade Favorit " + favName(idx) + ": " + f.title + " …");
        outlet(1, "load", f.id);
    }
    updateFavUI();
}

// Slot-Buttons der aktuellen Bank (1–16)
function favslot(k) {
    if (!ready()) return;
    recallFav(st.bank * 16 + clamp(Math.floor(k) - 1, 0, 15));
}

// Fav-# -Regler: erst laden, wenn der Regler kurz ruht (Encoder-Drehen lädt nicht jeden Schritt)
function favselect(n) {
    if (!ready()) return;
    favSelTarget = clamp(Math.floor(n) - 1, 0, NFAV - 1);
    var f = st.favs[favSelTarget];
    setNamed("favinfo", "set", favName(favSelTarget) + ": " + (f ? f.title : "(leer)"));
    favTask.cancel();
    favTask.schedule(350);
}
function favSelectNow() { if (favSelTarget >= 0 && st.favs[favSelTarget]) recallFav(favSelTarget); }

function favstep(d) {
    if (!ready()) return;
    var start = st.fav >= 0 ? st.fav : (d > 0 ? -1 : 0);
    for (var n = 1; n <= NFAV; n++) {
        var idx = ((start + d * n) % NFAV + NFAV) % NFAV;
        if (st.favs[idx]) { recallFav(idx); return; }
    }
    status("Noch keine Favoriten gespeichert");
}
function favprev() { favstep(-1); }
function favnext() { favstep(1); }

function favbank(b) {
    b = clamp(Math.floor(b), 0, BANKS.length - 1);
    if (b === st.bank) return;
    st.bank = b;
    if (ready()) save();
    updateFavUI();
}

function snapshot() {
    return { id: st.id, title: st.title, pads: st.pads.slice(), locks: st.locks.slice(),
             srcBpm: st.srcBpm, srcAuto: st.srcAuto, bpmConf: st.bpmConf };
}

// aktuelles Video + Slices auf den ersten freien Platz (ab aktueller Bank)
function favadd() {
    if (!ready()) return;
    if (!st.id) { status("Noch kein Video geladen"); return; }
    for (var n = 0; n < NFAV; n++) {
        var idx = (st.bank * 16 + n) % NFAV;
        if (!st.favs[idx]) {
            st.favs[idx] = snapshot();
            st.fav = idx;
            st.bank = Math.floor(idx / 16);
            save();
            updateFavUI();
            status("Gespeichert als " + favName(idx) + ": " + st.title);
            return;
        }
    }
    status("Alle " + NFAV + " Plätze belegt – erst einen löschen");
}

// aktiven Favoriten mit aktuellem Video + Slices überschreiben
function favupdate() {
    if (!ready()) return;
    if (st.fav < 0 || !st.favs[st.fav]) { favadd(); return; }
    if (!st.id) return;
    st.favs[st.fav] = snapshot();
    save();
    updateFavUI();
    status("Favorit " + favName(st.fav) + " aktualisiert");
}

function favdelete() {
    if (!ready()) return;
    if (st.fav < 0 || !st.favs[st.fav]) { status("Kein Favorit aktiv"); return; }
    var name = favName(st.fav);
    st.favs[st.fav] = null;
    st.fav = -1;
    save();
    updateFavUI();
    status("Favorit " + name + " gelöscht");
}

function updateFavUI() {
    for (var k = 0; k < 16; k++) {
        var idx = st.bank * 16 + k;
        var f = st.favs[idx];
        var label = f ? shortTitle(f.title) : "·";
        var o = P_.getnamed("favslot" + (k + 1));
        if (!o) continue;
        o.message("text", label);
        o.message("texton", label);
        o.message("set", idx === st.fav ? 1 : 0);
    }
    setNamed("favbank", "set", st.bank);
    if (st.fav >= 0) setNamed("favsel", "set", st.fav + 1);
    var cur = (st.fav >= 0 && st.favs[st.fav]) ? favName(st.fav) + ": " + st.favs[st.fav].title : "kein Favorit aktiv";
    setNamed("favinfo", "set", cur);
    outlet(1, "favinfo", st.fav >= 0 ? favName(st.fav) : "");   // für die Teletext-Seite
}

// ---------- UI ----------
function updateSel() {
    var pr = durMs > 0 ? playRange(sel) : { from: 0, to: 0, R: 0 };
    var s = Math.min(pr.from, pr.to), e = Math.max(pr.from, pr.to);
    var info = P.mode ? "Hold" : DIVS[P.div][0] + " " + Math.round(sliceMs()) + " ms";
    if (P.grid && durMs > 0) {
        if (gridOK()) {
            var x = Math.round(xAt(s) * 4) / 4;
            var bar = Math.floor(x / 4) + 1, bt = x - (bar - 1) * 4 + 1;
            info += "  T" + bar + "." + (Math.round(bt * 4) / 4);
        } else info += (beatsDone || (analysisReady && !(st.srcBpm > 0))) ? "  G: kein Beat" : "  G: …";
    }
    var R = pr.R;
    if (R > 0) info += "  W×" + R.toFixed(2);
    else if (P.warp) info += (st.srcBpm > 0 ? "  W? Tempo bestätigen" : "  W: kein Tempo");
    outlet(2, "selinfo", "Pad " + (sel + 1) + "  " + fmt(s) + "  " + info + keyInfo(sel));
    outlet(2, "padsel", sel);
    outlet(2, "lockset", st.locks[sel] ? 1 : 0);
    if (durMs > 0) outlet(2, "wsel", s, e);
    sendPadMarks();
}

function keyInfo(i) {
    if (!durMs) return "";
    if (!analysisReady) return "  |  Analyse …";
    var k = keys[i];
    if (!k) return "  |  …";
    var name = NOTE[k.tonic] + (k.minor ? "m" : "");
    var conf = " (" + k.conf.toFixed(2) + ")";
    if (shifts[i] === null) return "  |  " + (k.conf < 0.05 ? "atonal" : name) + conf + " – bleibt";
    if (!P.tune) return "  |  " + name + conf;
    var sh = shifts[i], ct = -Math.round(tuningCents);
    return "  |  " + name + conf + " → " + (sh > 0 ? "+" : "") + sh + " st" + (ct ? " " + (ct > 0 ? "+" : "") + ct + " ct" : "");
}

// ---------- Speichern (Datei über Node-Teil) ----------
function save() {
    if (!stateReady) return;                              // gespeicherten Stand nie überschreiben, bevor er gelesen ist
    var s = encodeURIComponent(JSON.stringify(st));       // keine Kommas/Leerzeichen im Symbol
    if (s === lastSaved) return;
    lastSaved = s;
    outlet(1, "savestate", s);
}

// state <kodierter JSON-String>  (vom Node-Teil nach "session")
function state() {
    var s = arrayfromargs(arguments).join("");
    stateReady = 1;
    if (!s || s === lastSaved) return;
    var o;
    try { o = JSON.parse(decodeURIComponent(s)); }
    catch (e) { post("YT Sampler: Zustand nicht lesbar: " + e + "\n"); return; }
    var fresh = newState(), i;
    st.id = o.id || "";
    st.title = o.title || "";
    st.pads = (o.pads && o.pads.length === NPADS) ? o.pads : fresh.pads;
    st.locks = (o.locks && o.locks.length === NPADS) ? o.locks : fresh.locks;
    st.favs = fresh.favs;
    if (o.favs) for (i = 0; i < NFAV && i < o.favs.length; i++) st.favs[i] = o.favs[i] || null;
    if (o.mem) for (i = 0; i < o.mem.length && i < NFAV; i++) if (!st.favs[i]) st.favs[i] = o.mem[i];  // alte Merkliste übernehmen
    st.fav = (typeof o.fav === "number") ? o.fav : -1;
    st.bank = clamp(o.bank || 0, 0, BANKS.length - 1);
    st.srcBpm = o.srcBpm || 0; st.srcAuto = (o.srcAuto === 0) ? 0 : 1; st.bpmConf = o.bpmConf || 0;
    lastSaved = s;
    updateFavUI();
    updateSrcUI();
    updateSel();
    if (st.id) {
        status("Lade letzten Stand …");
        outlet(1, "load", st.id);
    }
}
