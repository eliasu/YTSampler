// YT Sampler – Hauptlogik ([js] in Max)
// outlet 0 -> poly~ (Voices)   outlet 1 -> node.script (bankload, bankstate, …)
// outlet 2 -> UI-Router        outlet 3 -> poly~ Warp-Voices (ytwarpvoice)
// outlet 4 -> buffer~ (replace <pfad>, clear)
// Gespielt wird nur eine Bank: Im Buffer liegt pro Pad ein Snippet (Fach i ab i × 16 s). Intern wird in Song-ms
// gerechnet, umgerechnet wird nur an den Ausgängen (toBuf).
// Zustand (nur bankId) wird vom Node-Teil als Datei gespeichert (D/sessions/<session>.json).
// Die Session-Nummer ist ein unsichtbarer Live-Parameter und steckt damit im Set.

autowatch = 0;
inlets = 1;
outlets = 5;

var DIVS = [
    ["1/64", 1 / 64], ["1/32", 1 / 32], ["1/16T", 1 / 24], ["1/16", 1 / 16],
    ["1/8T", 1 / 12], ["1/8", 1 / 8], ["1/4T", 1 / 6], ["1/4", 1 / 4],
    ["1/2", 1 / 2], ["1 Bar", 1], ["2 Bars", 2]
];
var NPADS = 16;
var SNIP_MS = 16000;     // Länge eines Fachs in der Snippet-Datei
var SNIP_FADE_MS = 10;   // Hold: Ausblenden am Snippet-Ende
var BANK_REST = 350;     // Bank-Regler / Prev / Next: so lange ruhen, dann laden
var FLASH_MS = 2000;     // kurze Statusmeldung, danach wieder die normale Zeile
var HOLD_MAX = 1e9;     // Hold-Modus: bis Snippet-Ende (playRange begrenzt)
var VMAX = 16;          // Anzahl Instanzen im poly~
var VOICE_OPTS = [1, 2, 3, 4, 5, 8, 16];
var NOTE = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
var ANALYSIS_MS = 4000;     // Analysefenster pro Pad (ms), fest: Slice-Länge, Rate und Mode ändern die Tonart nicht
var TONAL = 0.5;            // Tune: darunter gilt ein Pad als nicht tonal und bleibt, wie es ist
var ATK_MS = 2;             // Einblenden
var REL_MS = 20;            // Ausblenden (Slice-Ende, Hold loslassen)

// Einstellungen kommen von den live.*-Reglern (die speichert Live selbst), so wie der Regler sie schickt.
// voices = Anzahl, voicesIdx = Index im Menü; vol nur zum Melden an den Editor
var P = { bpm: 120, div: 5, rate: 1, mode: 0, rev: 0, base: 36, voices: 16, voicesIdx: 6, tune: 0, warp: 0, quant: 0, qdiv: 1, qcatch: 0, vol: 0 };
var QUANT_LATE = 0.3;       // Input-Quantize: bis zu diesem Anteil des Rasters (höchstens einer 1/16) danach sofort spielen (zu spät gedrückt)
var QDIV_BEATS = [0.125, 0.25, 0.5, 1];   // Raster in Schlägen: 1/32, 1/16, 1/8, 1/4 (live.menu „Quant Div“)

// Editor stellt Regler: Name im Protokoll -> varname des live.*-Objekts
var PARAM_VAR = { div: "Division", rate: "Rate", mode: "Mode", rev: "Reverse", tune: "Tune", warp: "Warp",
                  quant: "Quantize", qdiv: "Quant Div", qcatch: "Quant Catch", vol: "Volume", voices: "Voices", base: "Base Note" };

// Lives globale Skala (Live 12: Song.root_note / Song.scale_intervals)
var SC = { root: 0, ints: [0, 2, 4, 5, 7, 9, 11] };

// Zustand, der in der Session-Datei landet (bankId 0 = nichts geladen)
var st = { bankId: 0 };

// Laufzeitwerte der geladenen Bank (werden nicht gespeichert)
var videoId = "";        // Video der Bank
var pads = [];           // Starts der Pads in Song-ms
for (var pi = 0; pi < NPADS; pi++) pads.push(0);
var srcBpm = 0, srcAuto = 1;   // Quelltempo, srcAuto = aus der Analyse (nicht bestätigt)

var durMs = 0;           // Songdauer, 0 = nichts geladen (Pads tun nichts)
var sel = 0;
var lastSaved = "";

// Geladene Bank: null = nichts geladen
var B = null;           // { nr, lens[16] }
var bankName = "", pendingName = null;
var bankCount = 0;       // Bänke in der Bibliothek (aus libstate/bankpeek)
var peekNr = 0;          // gerade angezeigtes Ziel beim Drehen/Prev/Next, 0 = keins
var peekWait = 0;        // Regler/Prev/Next noch nicht zur Ruhe gekommen
var muted = 0;           // Bibliothek leer/kaputt/neuer oder Bank nicht ladbar: Pads stumm
var libOk = 0;           // letzter libstate war ok
var wantLoad = 0;        // Bank am Regler laden, sobald Zustand gelesen und Bibliothek ok
var lastBankstate = "";
var pendingPath = "";
var replaceTask = new Task(function () { outlet(4, "replace", pendingPath); }, this);
var selTask = new Task(function () { peekWait = 0; if (peekNr > 0) outlet(1, "banksel", peekNr); }, this);
var statusLine = "";
var flashTask = new Task(function () { outlet(2, "status", statusLine); }, this);
var trackApi = null;

function bufMs() { return NPADS * SNIP_MS; }
// Song-ms von Pad i -> Buffer-ms
function toBuf(i, t) { return i * SNIP_MS + (t - pads[i]); }

// Stimmenverwaltung: welche Stimme spielt welches Pad, bis wann
var voices = [];
for (var vi = 0; vi < VMAX; vi++) voices.push({ pad: -1, end: 0, t: 0, eng: 0 });   // eng: 0 = Sampler, 1 = Warp

function engOut(e) { return e ? 3 : 0; }

// Beat-Raster (kommt vom Node-Teil): Schlagzeiten in ms, Index der ersten "1"
var beats = [], beatsIn = [], beatsDown = 0, beatsReady = 0;

// Tonart pro Pad (kommt vom Node-Teil) und daraus berechnete Verschiebung
var keys = [], shifts = [];
var tuningCents = 0, analysisReady = 0;
resetKeys();

function resetKeys() {
    keys = []; shifts = [];
    for (var i = 0; i < NPADS; i++) { keys.push(null); shifts.push(null); }
}

// ---------- Start / Session ----------
var P_ = this.patcher;  // Patcher-Referenz für getnamed()
var initDone = 0;       // Aktionen erst nach dem Laden des Sets zulassen
var stateReady = 0;     // erst speichern, wenn der gespeicherte Zustand gelesen wurde
var sessionId = 0;
var claimedId = 0;

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

function statenone() {                                    // keine Session-Datei: Bank am Regler
    stateReady = 1;
    if (!B) { st.bankId = 0; loadTarget(); }
    showBank();
}

function setNamed(name) {
    var o = P_.getnamed(name);
    if (!o) return;
    var a = arrayfromargs(arguments).slice(1);
    o.message.apply(o, a);
}

// Editor stellt einen Regler: der live.*-Regler gibt den Wert aus, er kommt über prepend im Handler an
function param(name, v) {
    if (!ready() || !PARAM_VAR.hasOwnProperty(name)) return;
    setNamed(PARAM_VAR[name], v);
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// Slice-Länge in ms aus Live-Tempo und Notenwert (4/4 angenommen)
function sliceMs() { return 60000 / Math.max(20, P.bpm) * 4 * DIVS[P.div][1]; }

// Tonhöhenfaktor aus Skala-Anpassung + Stimmungskorrektur
function pitchRate(i) {
    if (!P.tune || shifts[i] === null) return 1;
    return Math.pow(2, (shifts[i] - tuningCents / 100) / 12);
}
function padRate(i) { return P.rate * pitchRate(i); }

// Warp: Verhältnis Projekttempo / Quelltempo (0 = Warp aus oder Tempo unbekannt)
// Bank ist kuratiert: auch ein erkanntes, nicht bestätigtes Tempo gilt
function tempoTrusted() { return srcBpm > 0; }
function warpRatio() {
    if (!P.warp || !tempoTrusted()) return 0;
    return clamp(P.bpm / srcBpm, 0.25, 4);
}

// ---------- Beat-Raster ----------
// Beats bekannt und Tempo vertrauenswürdig: Overlay, Taktposition, Warp folgt dem Raster
function beatsOK() { return beatsReady && beats.length >= 4 && tempoTrusted(); }

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

// Startpunkt eines Pads (fest: die Snippets sind ab genau diesem Start geschnitten)
function effStart(i) { return pads[i]; }

function requestBeats() {
    beatsReady = 0;
    if (analysisReady && srcBpm > 0) outlet(1, "beattrack", srcBpm);
    else sendGridUI();
}

// vom Node-Teil: beatsclear | beatsadd <ms…> | beatsdone <down> <anzahl>
function beatsclear() { beatsIn = []; }
function beatsadd() { beatsIn = beatsIn.concat(arrayfromargs(arguments)); }
function beatsdone(down, n) {
    beats = beatsIn; beatsIn = [];
    beatsDown = Math.floor(down) || 0;
    beatsReady = beats.length >= 4 ? 1 : 0;
    if (beatsReady && beatsDown >= beats.length) beatsDown = 0;
    requestAll();
    sendGridUI();
    updateSel();
}

// Raster-Overlay über der Waveform, alles in Buffer-ms, nur die Schläge, die in einem Fach liegen.
// Linien immer, wenn Beats da sind (kein Schalter)
function sendGridUI() {
    var on = B && beatsOK() ? 1 : 0;
    outlet(2, "grid", "clear");
    outlet(2, "grid", "dur", bufMs());
    if (on) {
        var bt = [], bars = [], i, j, s, e, x;
        for (i = 0; i < NPADS; i++) {
            s = pads[i]; e = s + B.lens[i];
            for (j = 0; j < beats.length; j++) {
                if (beats[j] < s || beats[j] >= e) continue;
                x = toBuf(i, beats[j]);
                bt.push(x);
                if ((((j - beatsDown) % 4) + 4) % 4 === 0) bars.push(x);
            }
        }
        for (var k = 0; k < bt.length; k += 200) outlet(2, ["grid", "beats"].concat(bt.slice(k, k + 200)));
        for (k = 0; k < bars.length; k += 200) outlet(2, ["grid", "bars"].concat(bars.slice(k, k + 200)));
    }
    outlet(2, "grid", "show", on);
    sendPadMarks();
}
function sendPadMarks() {
    var a = ["grid", "pads", sel];
    for (var i = 0; i < NPADS; i++) a.push(i * SNIP_MS);
    outlet(2, a);
    sendBankstate();
}
// an Node (SSE device für den Editor), Song-ms, nur bei Änderung. Hinten die Reglerwerte (Spec 3.0, 3.2)
function sendBankstate() {
    var s = [], w = [], i, pr;
    for (i = 0; i < NPADS; i++) {
        pr = durMs > 0 ? playRange(i) : { from: 0, to: 0 };
        s.push(Math.round(effStart(i)));
        w.push(Math.round(Math.abs(pr.to - pr.from)));
    }
    var b = ["bankstate", st.bankId, videoId || "-", sel, P.mode, P.rev].concat(s, w,
        [P.div, Math.round(P.rate * 1000) / 1000, P.tune, P.warp, P.quant, Math.round(P.vol * 10) / 10, P.voicesIdx, P.base, P.qdiv, P.qcatch]);
    var key = b.join(" ");
    if (key === lastBankstate) return;
    lastBankstate = key;
    outlet(1, b);
}

// Abspielbereich eines Pads: von, bis (Song-ms) und Warp-Faktor. Nie über das Snippet hinaus
function playRange(i) {
    var start = effStart(i), from, to, R = warpRatio();
    var hi = start + (B ? B.lens[i] : 0);
    if (P.mode && P.rev) {                     // Hold rückwärts: Fach vom Ende zum Start
        from = hi; to = start;
    } else {
        if (R > 0 && !P.mode && beatsOK()) {
            // Warp mit Beats: Slice endet auf dem Raster der Quelle -> folgt schwankendem Tempo
            var end = timeAt(xAt(start) + DIVS[P.div][1] * 4);
            if (end > start) R = clamp((end - start) / sliceMs(), 0.25, 4);
            to = Math.min(start + sliceMs() * R, hi);
        } else {
            to = Math.min(start + padSpan(i), hi);
        }
        from = start;
        if (P.rev) { var tmp = from; from = to; to = tmp; }
    }
    return { from: from, to: to, R: R };
}

// Abgespielter Quellbereich: Trigger = Slice, Hold = bis Snippet-Ende
// Warp: Slice = gleicher Notenwert im Tempo der Quelle
function padSpan(i) {
    var base = P.mode ? HOLD_MAX : sliceMs();
    var R = warpRatio();
    return R > 0 ? base * R : base * padRate(i);
}

// Fenster, das der Node-Teil pro Pad analysiert (mind. 2 s, macht der Node-Teil)
function analysisSpan() { return ANALYSIS_MS; }

function fmt(ms) {
    var m = Math.floor(ms / 60000);
    var s = (ms % 60000) / 1000;
    return m + ":" + (s < 10 ? "0" : "") + s.toFixed(2);
}

// normale Statuszeile (auch Node schickt status <text…>); flash = kurz, danach wieder die normale
function status() {
    statusLine = arrayfromargs(arguments).join(" ");
    flashTask.cancel();
    outlet(2, "status", statusLine);
}
function flash(t) {
    outlet(2, "status", t);
    flashTask.cancel();
    flashTask.schedule(FLASH_MS);
}

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
    showBank();
    updateSel();
    initTask.schedule(300);
    watchTrack();
}

// Spurname für den Editor („steuert: …“)
function watchTrack() {
    if (trackApi || typeof LiveAPI === "undefined") return;
    trackApi = new LiveAPI(function (args) {
        if (args[0] !== "name") return;
        outlet(1, ["trackname"].concat(String(args.slice(1).join(" ")).replace(/^"|"$/g, "")));
    }, "this_device canonical_parent");
    trackApi.property = "name";
}
// bpm <tempo> = Lives Tempo (Observer); bpm <video> <bpm> = Quelltempo aus dem Editor (Node), nur für die aktive Bank
function bpm(v, b) {
    if (arguments.length < 2) { P.bpm = v; requestAll(); updateSel(); return; }
    if (!st.bankId || String(v) !== videoId || !(b > 0)) return;
    srcBpm = b; srcAuto = 0;
    requestBeats(); updateSel();
}
// Regler: jeder Handler meldet am Ende per bankstate an den Editor (direkt oder über updateSel)
function division(v) { P.div = clamp(Math.floor(v), 0, DIVS.length - 1); requestAll(); updateSel(); }
function rate(v) { P.rate = clamp(v, 0.1, 4); requestAll(); updateSel(); }
function playmode(v) { P.mode = v ? 1 : 0; requestAll(); updateSel(); }   // 0 = Trigger, 1 = Hold
function reverse(v) { P.rev = v ? 1 : 0; sendBankstate(); }
function basenote(v) { P.base = Math.floor(v); sendBankstate(); }
function volume(v) { P.vol = v; sendBankstate(); }                       // dB, am Klang ändert sich hier nichts
// ---------- Warp / Quelltempo ----------
function warp(v) { P.warp = v ? 1 : 0; requestAll(); updateSel(); }

// vom Node-Teil: tempo <bpm> <konfidenz>. Ein bestätigtes Tempo (aus bank oder Editor) bleibt
function tempo(bpm, conf) {
    if (srcAuto || !(srcBpm > 0)) { srcBpm = bpm || 0; srcAuto = 1; }
    updateSel();
}   // Beats werden bei analysisready angefordert

// ---------- Skala / Tonart ----------
function tune(v) { P.tune = v ? 1 : 0; updateSel(); }
function scaleroot(v) { SC.root = ((Math.floor(v) % 12) + 12) % 12; recomputeShifts(); }
function scaleints() {
    var a = arrayfromargs(arguments), ints = [];
    for (var k = 0; k < a.length; k++) if (typeof a[k] === "number") ints.push(((Math.floor(a[k]) % 12) + 12) % 12);
    if (ints.length) SC.ints = ints;
    recomputeShifts();
}
function tuning(c) { tuningCents = c; updateSel(); }
function analysisready() {
    analysisReady = 1;
    requestBeats(); requestAll();
}

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

// Verschiebung (Halbtöne), mit der möglichst viel vom Pad in Lives Skala liegt.
// Gleichstand: erkannter Grundton landet auf Lives Grundton, dann kleinere Verschiebung.
// null = nicht tonal genug -> nicht transponieren.
function computeShift(i) {
    var k = keys[i];
    if (!k || k.conf < TONAL) return null;
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
    P.voicesIdx = clamp(Math.floor(v), 0, VOICE_OPTS.length - 1);
    P.voices = VOICE_OPTS[P.voicesIdx];
    for (var k = P.voices; k < VMAX; k++) killVoice(k, 10);   // überzählige Stimmen ausblenden
    sendBankstate();
}

// ---------- Spielen ----------
// note <pitch> <vel> <kanal>: alle Kanäle spielen Pads, der Kanal zählt nicht
function note(p, v) {
    var i = Math.floor(p) - P.base;
    if (i < 0 || i >= NPADS) return;
    hit(i, v);
}

function padhit(i) { hit(clamp(Math.floor(i), 0, NPADS - 1), 100); }
function padup(i) { hit(clamp(Math.floor(i), 0, NPADS - 1), 0); }

// ---------- Input-Quantize ----------
// Im Patch läuft je ein [metro … @quantize …] pro Raster und schickt tick <index>; es zählt nur das eingestellte.
// Läuft der Transport nicht, kommen keine Ticks und alles spielt sofort.
var qTick = 0, qQueue = [];
function quantize(v) { P.quant = v ? 1 : 0; if (!P.quant) tick(); sendBankstate(); }
function quantcatch(v) { P.qcatch = v ? 1 : 0; sendBankstate(); }
function quantdiv(v) {
    P.qdiv = clamp(Math.floor(v), 0, QDIV_BEATS.length - 1);
    flushQueue(); qTick = 0;                   // bis zum ersten Tick des neuen Rasters spielt alles sofort
    sendBankstate();
}
function tick(d) {
    if (d !== undefined && Math.floor(d) !== P.qdiv) return;
    qTick = nowMs();
    flushQueue();
}
function flushQueue() {
    var q = qQueue; qQueue = [];
    for (var n = 0; n < q.length; n++) play(q[n][0], q[n][1]);
}
function hit(i, v) {
    if (muted || durMs <= 0) return;           // stumm oder nichts geladen
    var beat = 60000 / Math.max(20, P.bpm), step = beat * QDIV_BEATS[P.qdiv], since = nowMs() - qTick;
    // Catch (nur Raster 1/8 und 1/4): bis zu einer Achtel zu spät klingt sofort, an der Stelle, die auf dem Raster schon erreicht wäre
    var catchWin = P.quant && P.qcatch && P.qdiv >= 2 ? beat / 2 : 0;
    var wait = P.quant && since < step * 1.5 && since > (catchWin || Math.min(step, beat / 4) * QUANT_LATE);
    if (!wait && v === 0) {                    // Note-Off hinter seinem wartenden Note-On einreihen
        for (var n = 0; n < qQueue.length; n++) if (qQueue[n][0] === i) wait = true;
    }
    if (wait) qQueue.push([i, v]);
    else if (v > 0 && since <= catchWin) trigger(i, v, since);
    else play(i, v);
}
function play(i, v) { if (v > 0) trigger(i, v); else noteoff(i); }

function trigger(i, vel, late) {
    sel = i;
    if (durMs <= 0) { updateSel(); return; }
    var r = padRate(i);
    var pr = playRange(i), from = pr.from, to = pr.to, R = pr.R;
    var speed = R > 0 ? R : r;
    var dur = Math.abs(to - from) / speed;     // reale Abspieldauer in ms
    if (dur < 1) return;
    if (late > 0 && late < dur - 1) {          // Catch: später einsteigen, das Ende bleibt auf dem Raster
        from += (to >= from ? 1 : -1) * late * speed;
        dur -= late;
    }
    var amp = vel / 127;
    var atk = Math.min(ATK_MS, dur * 0.5);
    var rel = Math.min(P.mode ? SNIP_FADE_MS : REL_MS, dur * 0.5);   // Hold: am Snippet-Ende kurz ausblenden

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
    if (eng) outlet(o, "wplay", toBuf(i, from), to >= from ? R : -R, r);   // Tempo R, Tonhöhe r (Rate × Tune)
    else outlet(o, "pos", toBuf(i, from), toBuf(i, to), dur);
    outlet(o, "env", amp, atk);
    outlet(o, "rel", Math.max(0, dur - rel), rel);
    if (P.mode) outlet(2, "padlight", i, 1);
    else outlet(2, "padflash", i, dur);
    outlet(1, "playing", i, from, to, dur);
    updateSel();
}

function noteoff(i) {
    if (!P.mode) return;                       // Trigger: Note-Off ignorieren
    outlet(2, "padlight", i, 0);
    outlet(1, "playstop", i);
    var t = nowMs();
    for (var k = 0; k < VMAX; k++) {
        if (voices[k].pad === i && voices[k].end > t) {
            outlet(engOut(voices[k].eng), "target", k + 1);
            outlet(engOut(voices[k].eng), "gateoff", REL_MS);
            voices[k].end = t + REL_MS;
        }
    }
}

// ---------- Laden ----------
function resetAnalysis() {
    analysisReady = 0;
    tuningCents = 0;
    resetKeys();
    beats = []; beatsIn = []; beatsReady = 0;
}

// Ziel ohne Bank: die Position, auf der der Regler „Bank“ steht (1–128)
function bankTarget() {
    var o = P_.getnamed("bank"), v = 1;
    if (o && typeof o.getvalueof === "function") v = o.getvalueof();
    if (v && typeof v === "object" && v.length) v = v[0];
    return clamp(Math.floor(v) || 1, 1, 128);
}

// Bank am Regler laden, aber erst wenn der Zustand gelesen ist und die Bibliothek ok
function loadTarget() {
    if (!stateReady || !libOk) { wantLoad = 1; return; }
    wantLoad = 0;
    status("Lade letzten Stand …");
    outlet(1, "bankload", bankTarget());
}

// ---------- Bänke ----------
// bank <id> <nr> <bpm> <s×16> <l×16> <songdur> <video> <pfad…>
function bank() {
    var a = arrayfromargs(arguments), i;
    var id = Math.floor(a[0]), nr = Math.floor(a[1]), bp = a[2];
    var lens = a.slice(19, 35);
    st.bankId = id;
    videoId = String(a[36]);
    pads = a.slice(3, 19);
    durMs = a[35] || 0;
    B = { nr: nr, lens: lens };
    if (pendingName && pendingName.id === id) bankName = pendingName.name;
    else bankName = "";
    pendingName = null;
    if (bp > 0) { srcBpm = bp; srcAuto = 0; }
    else { srcBpm = 0; srcAuto = 1; }
    resetAnalysis();
    muted = 0; wantLoad = 0;
    if (!peekWait) peekNr = 0;                     // wer noch dreht, behält seine Anzeige
    if (nr > 0) setNamed("bank", "set", Math.min(nr, 128));
    for (i = 0; i < VMAX; i++) killVoice(i, 5);      // klickfrei aus, bevor der Buffer wechselt
    pendingPath = a.slice(37).join(" ");
    replaceTask.cancel();
    replaceTask.schedule(10);
    save();
    showBank();
    sendGridUI();
    updateSel();
}

function bankname() {
    var a = arrayfromargs(arguments), id = Math.floor(a[0]), name = a.slice(1).join(" ");
    if (B && id === st.bankId) { bankName = name; if (!peekNr) showBank(); }
    else pendingName = { id: id, name: name };    // Bank lädt gerade
}

// nichts mehr geladen: Stimmen aus, Pads tun nichts (der Buffer wird beim nächsten replace überschrieben)
function unload() {
    for (var k = 0; k < VMAX; k++) killVoice(k, 5);
    B = null; durMs = 0; videoId = ""; srcBpm = 0; srcAuto = 1;
    resetAnalysis();
}

// gespeicherte Bank gibt es nicht mehr: die Bank laden, auf der der Regler steht (der alte Platz)
function bankgone(id) {
    if (Math.floor(id) !== st.bankId) return;
    st.bankId = 0;
    unload();
    save();
    showBank();
    sendGridUI(); updateSel();
    loadTarget();
    flash("Bank gelöscht");                        // danach „Lade letzten Stand …“
}

function bankfail() {
    if (!B) {                                      // nichts klingt, das weiterspielen könnte: stumm
        muted = 1;
        status("Bank im Editor prüfen");
        if (peekWait) return;
        peekNr = 0;
        show("-", "nicht ladbar");
        return;
    }
    flash("nicht ladbar");
    if (peekWait) return;                          // wer schon weiterdreht, sieht sein Ziel
    peekNr = 0;
    if (B && B.nr > 0) setNamed("bank", "set", Math.min(B.nr, 128));
    showBank();
}

// libstate <anzahl> <nr> <ok|leer|kaputt|neuer>
var LIBMSG = { leer: ["Bibliothek leer", "Bank im Editor anlegen"], kaputt: ["Bibliothek kaputt", "Speichern gesperrt"],
               neuer: ["Bibliothek aus neuerer Version", ""] };
function libstate(n, nr, state) {
    bankCount = Math.floor(n) || 0;
    nr = Math.floor(nr) || 0;
    libOk = state === "ok" ? 1 : 0;
    if (state === "ok") {
        var was = muted;
        muted = 0;
        if (B && nr > 0) { B.nr = nr; setNamed("bank", "set", Math.min(nr, 128)); }
        if (was && st.bankId > 0) {                // Bibliothek wieder lesbar
            status("Lade letzten Stand …");
            outlet(1, "bankopen", st.bankId);
        } else if (!B && (was || wantLoad)) loadTarget();
        if (!peekNr) showBank();
        return;
    }
    var m = LIBMSG[state];
    if (!m) return;
    muted = 1;
    unload();
    replaceTask.cancel();
    outlet(4, "clear");
    show("-", m[0]);
    sendGridUI(); updateSel();
    if (m[1]) status(m[1]);
}

// bankpeek <nr> <anzahl> <name…> (Antwort auf Drehen/Prev/Next)
function bankpeek() {
    var a = arrayfromargs(arguments), nr = Math.floor(a[0]);
    bankCount = Math.floor(a[1]) || 0;
    show(nr, nr > bankCount ? "leer" : a.slice(2).join(" "));
}

// Bank-Regler (1–128): jeder Schritt zeigt, nach 350 ms Ruhe wird geladen
function banknum(v) {
    if (!ready()) return;
    peekTo(clamp(Math.floor(v), 1, 128));
}
// Button „Editor“: Node öffnet den Editor im Standardbrowser (auf seinem eigenen Port)
function openeditor() { if (!ready()) return; outlet(1, "openeditor"); }
function bankprev() { bankstep(-1); }
function banknext() { bankstep(1); }
function bankstep(d) {
    if (!ready() || bankCount <= 0) return;
    var cur = peekNr > 0 ? peekNr : (B ? B.nr : 0);
    var t = clamp(cur + d, 1, bankCount);              // bleibt an den Enden stehen, auch über 128
    if (t === cur) return;
    setNamed("bank", "set", Math.min(t, 128));
    peekTo(t);
}
function peekTo(nr) {
    peekNr = nr; peekWait = 1;
    outlet(1, "bankpeek", nr);
    selTask.cancel();
    selTask.schedule(BANK_REST);
}

// große Anzeige im linken Block
function show(nr, name) {
    outlet(2, "shownr", String(nr));
    outlet(2, "showname", name || "");
}
function showBank() {
    if (B) show(B.nr > 0 ? B.nr : "-", bankName);
    else if (!muted) show("-", "");
}

// ---------- UI ----------
function updateSel() {
    var pr = durMs > 0 ? playRange(sel) : { from: 0, to: 0, R: 0 };
    var s = Math.min(pr.from, pr.to), e = Math.max(pr.from, pr.to);
    var info = P.mode ? "Hold" : DIVS[P.div][0] + " " + Math.round(sliceMs()) + " ms";
    if (durMs > 0 && beatsOK()) {
        var x = Math.round(xAt(s) * 4) / 4;
        var bar = Math.floor(x / 4) + 1, bt = x - (bar - 1) * 4 + 1;
        info += "  T" + bar + "." + (Math.round(bt * 4) / 4);
    }
    var R = pr.R;
    if (R > 0) info += "  W×" + R.toFixed(2);
    else if (P.warp) info += "  W: kein Tempo";
    outlet(2, "selinfo", "Pad " + (sel + 1) + "  " + fmt(s) + "  " + info + keyInfo(sel));
    outlet(2, "padsel", sel);
    if (durMs > 0) outlet(2, "wsel", toBuf(sel, s), toBuf(sel, e));
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
    var s = encodeURIComponent(JSON.stringify({ bankId: st.bankId }));   // keine Kommas/Leerzeichen im Symbol
    if (s === lastSaved) return;
    lastSaved = s;
    outlet(1, "savestate", s);
}

// state <kodierter JSON-String>  (vom Node-Teil nach "session"). Gelesen wird nur bankId,
// alte Felder (Kopie aus 2.x, 1.x-Sessions) werden ignoriert
function state() {
    var s = arrayfromargs(arguments).join(""), id = 0;
    stateReady = 1;
    if (s && s === lastSaved) return;                // eigener Stand (Node neu gestartet)
    if (s) {
        try { id = Math.floor(JSON.parse(decodeURIComponent(s)).bankId) || 0; }
        catch (e) { post("YT Sampler: Zustand nicht lesbar: " + e + "\n"); }
    }
    lastSaved = s;
    if (id > 0) {                                    // Platz rechnet Node neu, „Bank“ aus dem Set zählt nicht
        st.bankId = id;
        status("Lade letzten Stand …");
        outlet(1, "bankopen", id);
    } else if (!B) {                                 // 1.x-, Teletext-Set oder nie gespeichert: Bank am Regler
        st.bankId = 0;
        loadTarget();
    }
    showBank();
    updateSel();
}
