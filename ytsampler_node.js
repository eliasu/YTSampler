// YT Sampler – Node for Max Teil
// Bibliothek, Snippets, Analyse, Downloads, Session-Dateien, Webserver für Teletext und Editor.
// Protokolle zu [js] und Editor: .scratch/bank-editor/spec.md Abschnitt 3 und 6.

const Max = require('max-api');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');

// Live startet Max ohne Shell-PATH -> Homebrew-Pfade selbst ergänzen
const EXTRA_PATHS = ['/opt/homebrew/bin', '/usr/local/bin', '/opt/local/bin', path.join(os.homedir(), '.local/bin')];
const ENV = { ...process.env, PATH: [...EXTRA_PATHS, process.env.PATH || '/usr/bin:/bin'].join(':') };

// Ablage (Spec 2.1): D = Datenordner in iCloud Drive (sonst lokal), L = lokal, nur Cache und Chrome-Profil
const LOCAL = path.join(os.homedir(), 'Music', 'YTSampler');
const LOCAL_ONLY = new Set(['cache', 'chrome-profile']);

// Erster Start mit iCloud: alles außer LOCAL_ONLY von L nach D verschieben (Spec 8.1)
function dataDir() {
  const icloud = path.join(os.homedir(), 'Library', 'Mobile Documents', 'com~apple~CloudDocs');
  if (!fs.existsSync(icloud)) return { dir: LOCAL };
  const dir = path.join(icloud, 'YTSampler');
  if (fs.existsSync(dir)) return { dir };
  const moved = [];
  try {
    fs.mkdirSync(dir, { recursive: true });
    let names = [];
    try { names = fs.readdirSync(LOCAL); } catch (e) { /* noch kein alter Ordner */ }
    for (const n of names) {
      const to = path.join(dir, n);
      if (LOCAL_ONLY.has(n) || fs.existsSync(to)) continue;   // Ziel da: zweites Device war schneller
      try { fs.renameSync(path.join(LOCAL, n), to); moved.push(n); } catch (e) { if (e.code !== 'ENOENT') throw e; }
    }
    return { dir };
  } catch (e) {
    // halber Umzug wäre schlimmer als keiner: zurückschieben, D wieder weg, beim nächsten Start neu versuchen
    for (const n of moved) { try { fs.renameSync(path.join(dir, n), path.join(LOCAL, n)); } catch (e2) { /* bleibt in D */ } }
    try { fs.rmdirSync(dir); } catch (e2) { /* nicht leer */ }
    return { dir: LOCAL, error: 'Umzug nach iCloud fehlgeschlagen' };
  }
}
const DATA_SETUP = dataDir();
const DATA = DATA_SETUP.dir;
const CACHE = path.join(LOCAL, 'cache');
const MAX_SECONDS = 600;  // URL-Videos über 10 min: nur die ersten 10 Minuten laden (RAM!)
const SEARCH_FETCH = 30;  // so viele Treffer holen …
const SEARCH_SHOW = 15;   // … und davon höchstens so viele anzeigen
let maxLenSec = 7 * 60;   // Längenfilter der Teletext-Suche (fest, der Regler „Max Length“ ist mit 2.0 weggefallen)

const SESSIONS = path.join(DATA, 'sessions');
fs.mkdirSync(CACHE, { recursive: true });
fs.mkdirSync(SESSIONS, { recursive: true });

let allResults = [];   // ungefilterte Treffer der letzten Suche
let lastResults = [];  // angezeigte Treffer (Index = Menüeintrag)
let lastQuery = '';

const status = (t) => { Max.outlet('status', t); ui.message = String(t); pushUi(); };

// Zustand für die Teletext-Seite (wird bei jeder Änderung an alle Browser geschickt)
const ui = {
  query: '',        // aktuelle Eingabe
  searched: '',     // zuletzt gesuchter Begriff
  searching: false,
  sel: 0,           // markierter Treffer
  loading: false,
  phase: '',        // INFO | DOWNLOAD | KONVERT | ANALYSE
  progress: 0,
  title: '',
  message: '',
  learn: null,      // Schritt im IR-Merkmodus oder null
  tvOff: false,     // Fernseher per An/Aus-Taste "abgeschaltet"
};
let pushUi = () => {};  // wird unten vom Webserver gesetzt

// Zeichen entfernen, die in Max-Nachrichten Ärger machen
const clean = (s) => String(s || '').replace(/[,;{}\\\[\]]/g, ' ').replace(/\s+/g, ' ').trim();

function fmtDur(sec) {
  sec = Math.round(sec || 0);
  if (!sec) return '–';
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function errMsg(e) {
  if (e && e.code === 'ENOENT') return 'yt-dlp nicht gefunden → Terminal: brew install yt-dlp ffmpeg deno';
  const msg = clean(e && e.message ? e.message : e);
  return 'Fehler: ' + msg.slice(0, 140);
}

// job (optional): {aborted, child} – abort(job) beendet den laufenden Prozess
function run(cmd, args, onLine, job) {
  return new Promise((resolve, reject) => {
    if (job && job.aborted) { reject(new Error('abgebrochen')); return; }
    const p = spawn(cmd, args, { env: ENV });
    if (job) job.child = p;
    let out = '', err = '';
    p.stdout.on('data', (d) => {
      const s = d.toString();
      out += s;
      if (onLine) s.split(/\r?\n|\r/).forEach((l) => l && onLine(l));
    });
    p.stderr.on('data', (d) => { err += d.toString(); });
    p.on('error', reject);
    p.on('close', (code) => {
      if (code === 0) resolve(out);
      else {
        const lastLine = err.trim().split('\n').filter(Boolean).pop();
        reject(new Error(lastLine || `${cmd} exit ${code}`));
      }
    });
  });
}

function abort(job) {
  job.aborted = true;
  if (job.child) job.child.kill();
}

function extractId(input) {
  const s = String(input || '').trim();
  const m = s.match(/(?:v=|youtu\.be\/|shorts\/|embed\/|live\/)([A-Za-z0-9_-]{11})/);
  if (m) return m[1];
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  return null;
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return null; }
}

// WAV-Header lesen: Formatdaten + Lage der Audiodaten
function wavInfo(file) {
  const fd = fs.openSync(file, 'r');
  try {
    const size = fs.fstatSync(fd).size;
    const hdr = Buffer.alloc(12);
    fs.readSync(fd, hdr, 0, 12, 0);
    if (hdr.toString('ascii', 0, 4) !== 'RIFF' || hdr.toString('ascii', 8, 12) !== 'WAVE') {
      throw new Error('Datei ist kein WAV');
    }
    let pos = 12, fmt = null, offset = 0, dataSize = 0;
    const ch = Buffer.alloc(8);
    while (pos + 8 <= size) {
      fs.readSync(fd, ch, 0, 8, pos);
      const id = ch.toString('ascii', 0, 4);
      const len = ch.readUInt32LE(4);
      if (id === 'fmt ') {
        const f = Buffer.alloc(16);
        fs.readSync(fd, f, 0, 16, pos + 8);
        fmt = { channels: f.readUInt16LE(2), sr: f.readUInt32LE(4), byteRate: f.readUInt32LE(8), bits: f.readUInt16LE(14) };
      } else if (id === 'data') {
        offset = pos + 8;
        dataSize = (len === 0xffffffff || offset + len > size) ? size - offset : len;
        break;
      }
      pos += 8 + len + (len % 2);
    }
    if (!fmt || !dataSize) throw new Error('WAV-Header unlesbar');
    return { ...fmt, offset, dataSize };
  } finally {
    fs.closeSync(fd);
  }
}

function wavDurationMs(file) {
  const w = wavInfo(file);
  return (w.dataSize / w.byteRate) * 1000;
}

// =====================================================================
// Tonart-Analyse
// Einmal pro Video: Chromagramm (12 Halbtöne pro Frame) + Tonalität + Stimmung.
// Pro Pad: nur Summieren der Frames im Fenster -> praktisch kostenlos.
// =====================================================================
const AN = {
  VERSION: 3,         // 3 = mit Einsatzkurven für Beat-Tracking
  TARGET_SR: 5512.5,  // reicht für Töne bis ~2,7 kHz
  N: 4096,            // FFT-Länge (~0,74 s, ~1,35 Hz Auflösung)
  HOP: 1024,          // ~186 ms Schrittweite
  FMIN: 50, FMAX: 2000,
  MINWIN: 2000,       // Mindest-Analysefenster pro Pad in ms
  STRIDE: 14,         // pro Frame: 12 Chroma + Flatness + Energie
};
// Krumhansl-Kessler-Tonartprofile
const KK_MAJ = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const KK_MIN = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

let analysis = null; // { id, srd, tuning, nf, frames }

function makeFFT(n) {
  const bits = Math.round(Math.log2(n));
  const rev = new Uint32Array(n);
  for (let i = 0; i < n; i++) {
    let r = 0;
    for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b);
    rev[i] = r;
  }
  const cos = new Float64Array(n / 2), sin = new Float64Array(n / 2);
  for (let i = 0; i < n / 2; i++) { cos[i] = Math.cos(2 * Math.PI * i / n); sin[i] = Math.sin(2 * Math.PI * i / n); }
  return (re, im) => {
    for (let i = 0; i < n; i++) {
      const j = rev[i];
      if (j > i) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
    }
    for (let size = 2; size <= n; size <<= 1) {
      const half = size >> 1, step = n / size;
      for (let i = 0; i < n; i += size) {
        for (let j = i, k = 0; j < i + half; j++, k += step) {
          const l = j + half;
          const tre = re[l] * cos[k] + im[l] * sin[k];
          const tim = im[l] * cos[k] - re[l] * sin[k];
          re[l] = re[j] - tre; im[l] = im[j] - tim;
          re[j] += tre; im[j] += tim;
        }
      }
    }
  };
}

// WAV -> Mono, tiefpassgefiltert und heruntergerechnet
function loadMonoDecimated(file) {
  const w = wavInfo(file);
  if (w.bits !== 16) throw new Error(`Nur 16-Bit-WAV unterstützt (ist ${w.bits})`);
  const raw = fs.readFileSync(file);
  const pcm = new Int16Array(raw.buffer.slice(raw.byteOffset + w.offset, raw.byteOffset + w.offset + (w.dataSize - (w.dataSize % 2))));
  const chs = w.channels, len = Math.floor(pcm.length / chs);
  const dec = Math.max(1, Math.round(w.sr / AN.TARGET_SR));
  // gefensterter Sinc-Tiefpass (Blackman), Grenzfrequenz knapp unter der neuen Nyquist
  const M = 32, taps = 2 * M + 1, fc = 0.45 / dec;
  const h = new Float64Array(taps);
  let hs = 0;
  for (let k = 0; k < taps; k++) {
    const x = k - M;
    const sinc = x === 0 ? 2 * fc : Math.sin(2 * Math.PI * fc * x) / (Math.PI * x);
    const bw = 0.42 - 0.5 * Math.cos(2 * Math.PI * k / (taps - 1)) + 0.08 * Math.cos(4 * Math.PI * k / (taps - 1));
    h[k] = sinc * bw; hs += h[k];
  }
  for (let k = 0; k < taps; k++) h[k] /= hs * 32768 * chs;
  const outLen = Math.floor(len / dec);
  const y = new Float32Array(outLen);
  for (let n = 0; n < outLen; n++) {
    const c = n * dec;
    let acc = 0;
    for (let k = 0; k < taps; k++) {
      const i = c + k - M;
      if (i < 0 || i >= len) continue;
      let v = 0;
      for (let ch = 0; ch < chs; ch++) v += pcm[i * chs + ch];
      acc += h[k] * v;
    }
    y[n] = acc;
  }
  return { y, srd: w.sr / dec };
}

function computeAnalysis(file) {
  const { y, srd } = loadMonoDecimated(file);
  const N = AN.N, HOP = AN.HOP, S = AN.STRIDE;
  const fft = makeFFT(N);
  const hann = new Float64Array(N);
  for (let i = 0; i < N; i++) hann[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / N);
  const res = srd / N;
  const kmin = Math.ceil(AN.FMIN / res), kmax = Math.min(N / 2 - 2, Math.floor(AN.FMAX / res));
  const nf = Math.max(1, Math.floor((y.length - N) / HOP) + 1);
  const re = new Float64Array(N), im = new Float64Array(N), mag = new Float64Array(N / 2);

  const spectrum = (f) => {
    const o = f * HOP;
    for (let i = 0; i < N; i++) { const v = o + i < y.length ? y[o + i] : 0; re[i] = v * hann[i]; im[i] = 0; }
    fft(re, im);
    let mx = 0;
    for (let k = kmin - 1; k <= kmax + 1; k++) { mag[k] = Math.hypot(re[k], im[k]); if (mag[k] > mx) mx = mag[k]; }
    return mx;
  };
  // Spitzen finden, Frequenz per Parabel-Interpolation verfeinern
  const peaks = (mx, cb) => {
    const thr = mx * 0.08;
    for (let k = kmin; k <= kmax; k++) {
      const b = mag[k];
      if (b < thr || b <= mag[k - 1] || b < mag[k + 1]) continue;
      const la = Math.log(mag[k - 1] + 1e-12), lb = Math.log(b + 1e-12), lc = Math.log(mag[k + 1] + 1e-12);
      const den = la - 2 * lb + lc;
      const p = den !== 0 ? 0.5 * (la - lc) / den : 0;
      cb((k + p) * res, b);
    }
  };
  const midiOf = (f) => 69 + 12 * Math.log2(f / 440);

  // Durchgang 1: Stimmung (Abweichung von A=440) aus jedem 4. Frame
  let C = 0, Sn = 0;
  for (let f = 0; f < nf; f += 4) {
    const mx = spectrum(f);
    if (mx <= 0) continue;
    peaks(mx, (freq, m) => {
      const d = midiOf(freq);
      const ph = 2 * Math.PI * (d - Math.round(d));
      C += m * Math.cos(ph); Sn += m * Math.sin(ph);
    });
  }
  const tuning = (C || Sn) ? Math.atan2(Sn, C) / (2 * Math.PI) : 0; // Halbtöne, -0.5..0.5

  // Durchgang 2: Chroma, Flatness, Energie pro Frame
  const frames = new Float32Array(nf * S);
  const nb = kmax - kmin + 1;
  for (let f = 0; f < nf; f++) {
    const mx = spectrum(f);
    const base = f * S;
    let sum = 0, lsum = 0;
    for (let k = kmin; k <= kmax; k++) { sum += mag[k]; lsum += Math.log(mag[k] + 1e-12); }
    const mean = sum / nb;
    frames[base + 12] = mean > 1e-9 ? Math.exp(lsum / nb) / mean : 1; // spektrale Flatness: 0 = tonal, 1 = Rauschen
    frames[base + 13] = sum;
    if (mx <= 0) continue;
    peaks(mx, (freq, m) => {
      const pc = ((Math.round(midiOf(freq) - tuning) % 12) + 12) % 12;
      frames[base + pc] += m;
    });
  }
  const tempo = estimateTempo(y, srd);
  return { srd, tuning, nf, frames, bpm: tempo.bpm, bpmConf: tempo.conf,
           fps: tempo.fps || 0, onset: tempo.onset || new Float32Array(0), bass: tempo.bass || new Float32Array(0) };
}

// Tempo-Schätzung: Einsatzkurve (spektraler Fluss) + Autokorrelation mit Vorliebe für ~120 BPM
function estimateTempo(y, srd) {
  const N = 512, HOP = 64;                     // ~93 ms Fenster, ~11,6 ms Raster
  const fps = srd / HOP;
  const nf = Math.floor((y.length - N) / HOP) + 1;
  if (nf < fps * 4) return { bpm: 0, conf: 0 };  // unter 4 s: zu kurz
  const fft = makeFFT(N);
  const hann = new Float64Array(N);
  for (let i = 0; i < N; i++) hann[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / N);
  const re = new Float64Array(N), im = new Float64Array(N);
  const half = N / 2;
  let prev = new Float64Array(half), cur = new Float64Array(half);
  const flux = new Float64Array(nf);
  const bassFlux = new Float32Array(nf);          // < ~140 Hz: Kick -> Hinweis auf die "1"
  const kBass = Math.max(2, Math.round(140 / (srd / N)));
  for (let f = 0; f < nf; f++) {
    const o = f * HOP;
    for (let i = 0; i < N; i++) { re[i] = y[o + i] * hann[i]; im[i] = 0; }
    fft(re, im);
    let sum = 0;
    for (let k = 1; k < half; k++) {
      cur[k] = Math.log(1 + 1000 * Math.hypot(re[k], im[k]));
      const d = cur[k] - prev[k];
      if (d > 0) { sum += d; if (k <= kBass) bassFlux[f] += d; }
    }
    flux[f] = f ? sum : 0;
    if (!f) bassFlux[f] = 0;
    const t = prev; prev = cur; cur = t;
  }
  // gleitenden Mittelwert (~0,5 s) abziehen, nur Anstiege behalten
  const w = Math.max(1, Math.round(fps * 0.25));
  const env = new Float64Array(nf);
  let acc = 0;
  for (let i = 0; i < nf; i++) {
    acc += flux[i];
    if (i - 2 * w - 1 >= 0) acc -= flux[i - 2 * w - 1];
    const cnt = Math.min(i + 1, 2 * w + 1);
    env[i] = Math.max(0, flux[Math.max(0, i - w)] - acc / cnt);
  }
  // für das Beat-Tracking aufheben – env[i] gehört zu flux[i - w], also zeitlich zurückschieben
  const onset = new Float32Array(nf);
  for (let i = w; i < nf; i++) onset[i - w] = env[i];
  let mean = 0;
  for (let i = 0; i < nf; i++) mean += env[i];
  mean /= nf;
  for (let i = 0; i < nf; i++) env[i] -= mean;

  const minL = Math.floor(60 * fps / 220), maxL = Math.ceil(60 * fps / 50);
  const ac = new Float64Array(2 * maxL + 2);
  for (let L = 0; L < ac.length; L++) {
    let s = 0;
    for (let i = 0; i + L < nf; i++) s += env[i] * env[i + L];
    ac[L] = s / (nf - L);
  }
  if (ac[0] <= 0) return { bpm: 0, conf: 0, fps, onset, bass: bassFlux };
  const prior = (bpm) => Math.exp(-0.5 * Math.pow(Math.log2(bpm / 120) / 0.6, 2));
  let best = -1, bestL = 0, sumS = 0, cntS = 0;
  const score = new Float64Array(maxL + 2);
  for (let L = minL; L <= maxL; L++) {
    const v = (ac[L] + 0.5 * ac[2 * L]) * prior(60 * fps / L);
    score[L] = v; sumS += v; cntS++;
    if (v > best) { best = v; bestL = L; }
  }
  // Parabel-Interpolation für Nachkommastellen
  let lag = bestL;
  if (bestL > minL && bestL < maxL) {
    const a = ac[bestL - 1], b = ac[bestL], c = ac[bestL + 1];
    const den = a - 2 * b + c;
    if (den < 0) lag = bestL + 0.5 * (a - c) / den;
  }
  const bpm = 60 * fps / lag;
  // Konfidenz: Wie tief sind die Täler zwischen den Schlägen? (Flächen/Rauschen: kaum Kontrast)
  const g = (L) => ac[L] + 0.5 * ac[Math.min(ac.length - 1, 2 * L)];
  let trough = Infinity;
  for (let L = Math.floor(bestL * 0.55); L <= Math.ceil(bestL * 0.95); L++) trough = Math.min(trough, g(L));
  const periodic = Math.max(0, Math.min(1, (g(bestL) - trough) / ac[0] * 1.5));
  // Wie stark setzt überhaupt etwas ein? (Streuung der Einsatzkurve; Flächen/Rauschen ~3–5, Beats > 50)
  const rhythmic = Math.max(0, Math.min(1, (Math.sqrt(ac[0]) - 8) / 30));
  const conf = periodic * rhythmic;
  return { bpm: Math.round(bpm * 10) / 10, conf: Math.round(conf * 100) / 100, fps, onset, bass: bassFlux };
}

// =====================================================================
// Beat-Tracking (dynamische Programmierung nach D. Ellis 2007):
// sucht die Kette von Schlägen, die möglichst auf Einsätzen liegt und
// dabei möglichst gleichmäßig im vorgegebenen Tempo bleibt.
// =====================================================================
const BEAT_LEAD_MS = 12;   // Slices knapp vor dem Einsatz starten, damit der Anschlag ganz drin ist

function trackBeats(a, bpm) {
  const env = a.onset, fps = a.fps, n = env.length;
  if (!n || !(bpm > 0) || !(fps > 0)) return null;
  const period = 60 * fps / bpm;
  if (period < 4 || n < period * 4) return null;

  // normieren und leicht glätten
  let m = 0, v = 0;
  for (let i = 0; i < n; i++) m += env[i];
  m /= n;
  for (let i = 0; i < n; i++) v += (env[i] - m) * (env[i] - m);
  const sd = Math.sqrt(v / n) || 1;
  const hw = Math.max(1, Math.round(period / 16));
  const win = [];
  for (let k = -hw; k <= hw; k++) win.push(Math.exp(-0.5 * Math.pow(k * 32 / period, 2)));
  const local = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let k = -hw; k <= hw; k++) { const j = i + k; if (j >= 0 && j < n) s += (env[j] / sd) * win[k + hw]; }
    local[i] = s;
  }

  const TIGHT = 100;
  const lo = Math.round(period / 2), hi = Math.round(2 * period);
  const pen = new Float64Array(hi + 1);
  for (let d = lo; d <= hi; d++) pen[d] = -TIGHT * Math.pow(Math.log(d / period), 2);
  const cum = new Float64Array(n), back = new Int32Array(n).fill(-1);
  for (let i = 0; i < n; i++) {
    let best = -Infinity, bi = -1;
    for (let d = lo; d <= hi && i - d >= 0; d++) {
      const s = cum[i - d] + pen[d];
      if (s > best) { best = s; bi = i - d; }
    }
    cum[i] = local[i] + (bi >= 0 && best > 0 ? best : 0);
    back[i] = bi >= 0 && best > 0 ? bi : -1;
  }
  // Ende: bester Wert im letzten Takt, dann zurückverfolgen
  let end = n - 1;
  for (let i = Math.max(0, n - Math.round(period)); i < n; i++) if (cum[i] > cum[end]) end = i;
  const frames = [];
  for (let i = end; i >= 0; i = back[i]) frames.push(i);
  frames.reverse();
  if (frames.length < 4) return null;

  // Frame -> ms. Der Fluss ist am größten, wenn der Einsatz ~3/4 ins Analysefenster gerückt ist.
  const N = 512, HOP = 64;
  const toMs = (f) => ((f * HOP + 0.78 * N) / a.srd) * 1000;
  const beats = frames.map((f) => Math.max(0, Math.round(toMs(f) - BEAT_LEAD_MS)));
  return { beats, frames, down: findDownbeat(a, frames, period, findIntro(a, frames)) };
}

// Größter Wert einer Kurve um Frame f (±2 Frames)
function peakAt(env, f) {
  let mx = 0;
  for (let k = -2; k <= 2; k++) { const j = f + k; if (j >= 0 && j < env.length && env[j] > mx) mx = env[j]; }
  return mx;
}

// Intro: Schläge am Anfang, bevor Kick und Einsätze richtig da sind (Stille, Gerede, Flächen).
// Ergebnis: Index des ersten Schlags danach (0 = kein Intro).
// ponytail: einfache Schwelle am Median; Intros mit vollem Schlagzeug werden nicht erkannt
function findIntro(a, frames) {
  const nb = frames.length;
  if (nb < 16) return 0;
  const B = frames.map((f) => peakAt(a.bass, f)), O = frames.map((f) => peakAt(a.onset, f));
  const bm = Math.max(...B) || 1, om = Math.max(...O) || 1;
  const s = B.map((b, i) => b / bm + O[i] / om);
  const thr = 0.6 * [...s].sort((x, y) => x - y)[Math.floor(nb / 2)];
  for (let i = 0; i + 8 <= nb && i <= nb / 2; i++) {
    if (s[i] < thr) continue;
    let m = 0;
    for (let j = i; j < i + 8; j++) m += s[j];
    if (m / 8 >= thr) return i;
  }
  return 0;
}

// Welcher von 4 Schlägen ist die "1"? Bass-Einsätze (Kick) + Harmoniewechsel am Taktanfang.
// Gezählt wird erst ab dem Intro-Ende; Ergebnis ist die erste "1" ab dort (= Takt 1).
function findDownbeat(a, frames, period, from) {
  const nb = frames.length;
  if (nb - from < 8) from = 0;
  if (nb < 8) return 0;
  const bassAt = (f) => peakAt(a.bass, f);
  // Chroma-Frames liegen im 1024er-Raster bei TARGET_SR
  const chromaAt = (ms0, ms1) => {
    const c = new Array(12).fill(0);
    const f0 = Math.max(0, Math.round((ms0 / 1000 * a.srd - AN.N / 2) / AN.HOP));
    const f1 = Math.min(a.nf - 1, Math.round((ms1 / 1000 * a.srd - AN.N / 2) / AN.HOP));
    for (let f = f0; f <= f1; f++) for (let pc = 0; pc < 12; pc++) c[pc] += a.frames[f * AN.STRIDE + pc];
    return c;
  };
  const cosd = (x, y) => {
    let xy = 0, xx = 0, yy = 0;
    for (let i = 0; i < 12; i++) { xy += x[i] * y[i]; xx += x[i] * x[i]; yy += y[i] * y[i]; }
    return xx > 0 && yy > 0 ? 1 - xy / Math.sqrt(xx * yy) : 0;
  };
  const pMs = period / a.fps * 1000;
  const bass = [], nov = [];
  for (let i = 0; i < nb; i++) {
    const t = ((frames[i] * 64 + 0.78 * 512) / a.srd) * 1000;
    bass.push(bassAt(frames[i]));
    nov.push(cosd(chromaAt(t - 2 * pMs, t), chromaAt(t, t + 2 * pMs)));
  }
  const norm = (arr) => { const mx = Math.max(...arr) || 1; return arr.map((x) => x / mx); };
  const B = norm(bass), V = norm(nov);
  let best = -1, down = 0;
  for (let k = from; k < from + 4; k++) {
    let s = 0, c = 0;
    for (let i = k; i < nb; i += 4) { s += B[i] + 0.7 * V[i]; c++; }
    s /= c || 1;
    if (s > best) { best = s; down = k; }
  }
  return down;
}

// Stille: Bereiche (ms), in denen die Analyse-Frames über 40 dB leiser sind als die lauten Stellen.
// Liefert flach [von, bis, von, bis, …]; Stille am Ende reicht bis 1e9.
function silentRanges(a) {
  const S = AN.STRIDE, nf = a.nf, e = [];
  for (let f = 0; f < nf; f++) e.push(a.frames[f * S + 13]);
  const thr = 0.01 * [...e].sort((x, y) => x - y)[Math.floor(nf * 0.95)];
  const hopMs = AN.HOP / a.srd * 1000;
  const mid = (f) => (f * AN.HOP + AN.N / 2) / a.srd * 1000;
  const out = [];
  for (let f = 0; f < nf; f++) {
    if (e[f] >= thr) continue;
    const f0 = f;
    while (f + 1 < nf && e[f + 1] < thr) f++;
    out.push(f0 === 0 ? 0 : Math.round(mid(f0) - hopMs / 2), f === nf - 1 ? 1e9 : Math.round(mid(f) + hopMs / 2));
  }
  return out.slice(0, 1000);   // ponytail: bei sehr zerhackter Musik nur die ersten 500 Bereiche
}

function sendBeats(bpm) {
  const a = analysis;
  if (!a) return;
  const r = trackBeats(a, bpm);
  Max.outlet('beatsclear');
  if (!r) { Max.outlet('beatsdone', 0, 0); return; }
  for (let i = 0; i < r.beats.length; i += 200) Max.outlet('beatsadd', ...r.beats.slice(i, i + 200));
  Max.outlet('beatsdone', r.down, r.beats.length);
}

function saveAnalysis(file, a) {
  const head = new Float32Array([AN.VERSION, a.srd, a.tuning, a.nf, a.bpm || 0, a.bpmConf || 0, a.fps || 0, a.onset.length]);
  const f32 = (x) => Buffer.from(Float32Array.from(x).buffer);
  fs.writeFileSync(file, Buffer.concat([Buffer.from(head.buffer), f32(a.onset), f32(a.bass), f32(a.frames)]));
}

// Spec 2.4: Das Format ändert sich nur abwärtskompatibel. Abgelegte Analysen (D/snippets) lassen sich
// ohne ganze WAV nicht neu rechnen. Neue Version: Felder hinten anhängen, Leser für die alten behalten.
// Versionen 1 und 2 lagen nur im Cache (neben der WAV) und werden dort neu gerechnet.
const AN_READABLE = [3];

function readAnalysis(file) {
  try {
    const buf = fs.readFileSync(file);
    const arr = new Float32Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length - (buf.length % 4)));
    if (!AN_READABLE.includes(arr[0])) return null;
    const nf = arr[3], no = arr[7], H = 8;
    if (arr.length !== H + 2 * no + nf * AN.STRIDE) return null;   // Version 3: nichts angehängt
    return { srd: arr[1], tuning: arr[2], nf, bpm: Math.round(arr[4] * 10) / 10, bpmConf: Math.round(arr[5] * 100) / 100,
             fps: arr[6], onset: arr.subarray(H, H + no), bass: arr.subarray(H + no, H + 2 * no),
             frames: arr.subarray(H + 2 * no, H + 2 * no + nf * AN.STRIDE) };
  } catch (e) { return null; }
}

const chromaCache = (v) => path.join(CACHE, `${v}.chroma`);
const chromaBank = (v) => path.join(SNIP_DIR, `${v}.chroma`);
const cacheWav = (v) => path.join(CACHE, `${v}.wav`);
const hasWav = (v) => fs.existsSync(cacheWav(v));

// Analyse eines Videos, null = fehlt. bank: zuerst die abgelegte aus D/snippets (Bühne ohne ganze WAV),
// sonst Cache, sonst aus der ganzen WAV rechnen. Mit bank wird sie nach D/snippets kopiert, wenn sie dort fehlt.
function getAnalysis(v, bank) {
  let a = bank ? readAnalysis(chromaBank(v)) : null;
  const inBank = !!a;
  if (!a) a = readAnalysis(chromaCache(v));
  if (!a && hasWav(v)) { a = computeAnalysis(cacheWav(v)); saveAnalysis(chromaCache(v), a); }
  if (a && bank && !inBank && !newerAnalysis(chromaBank(v))) {
    const tmp = path.join(SNIP_DIR, `${v}.${process.pid}.tmp`);
    try { fs.copyFileSync(chromaCache(v), tmp); fs.renameSync(tmp, chromaBank(v)); } catch (e) { Max.post(`YT Sampler: Analyse nicht abgelegt: ${e.message}`); }
  }
  return a;
}

// abgelegt von einer neueren Device-Version: nie überschreiben
function newerAnalysis(file) {
  try { const b = Buffer.alloc(4); const fd = fs.openSync(file, 'r'); fs.readSync(fd, b, 0, 4, 0); fs.closeSync(fd); return b.readFloatLE(0) > AN.VERSION; } catch (e) { return false; }
}

// Analyse ans Device: tuning, tempo, silence, analysisready. bank: aus D/snippets (Spec 2.4), sonst aus L/cache.
async function ensureAnalysis(id, title, bank) {
  analysis = null;
  await new Promise((r) => setImmediate(r)); // "loaded" bzw. "bank" zuerst rausschicken
  let a = bank ? readAnalysis(chromaBank(id)) : readAnalysis(chromaCache(id));
  if (!a && hasWav(id)) {
    status('Analysiere Tonart …');
    await new Promise((r) => setTimeout(r, 20));
    const t0 = Date.now();
    a = getAnalysis(id, bank);
    Max.post(`YT Sampler: Analyse in ${Date.now() - t0} ms`);
  }
  if (!a) { status('Analyse fehlt – Bank im Editor neu schneiden'); return; }
  analysis = { id, ...a };
  const cents = Math.round(a.tuning * 100);
  Max.outlet('tuning', cents);
  Max.outlet('tempo', a.bpm, a.bpmConf);
  Max.outlet('silence', ...silentRanges(a));
  Max.outlet('analysisready');
  const tempoTxt = a.bpm ? ` · ${a.bpm} BPM${a.bpmConf < 0.3 ? ' (unsicher)' : ''}` : '';
  status(`Bereit: ${title}${tempoTxt} · Stimmung ${cents >= 0 ? '+' : ''}${cents} ct`);
}

function pearson(x, y) {
  let mx = 0, my = 0;
  for (let i = 0; i < 12; i++) { mx += x[i]; my += y[i]; }
  mx /= 12; my /= 12;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < 12; i++) { const a = x[i] - mx, b = y[i] - my; sxy += a * b; sxx += a * a; syy += b * b; }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : 0;
}

// Analyse eines Zeitfensters: Chroma, Tonart, Konfidenz
function analyzeWindow(startMs, spanMs) {
  const a = analysis;
  if (!a) return null;
  const len = Math.max(Math.abs(spanMs), AN.MINWIN);
  const center = startMs + spanMs / 2;
  const from = center - len / 2, to = center + len / 2;
  const toFrame = (ms) => (ms * a.srd / 1000 - AN.N / 2) / AN.HOP;
  let f0 = Math.max(0, Math.ceil(toFrame(from)));
  let f1 = Math.min(a.nf - 1, Math.floor(toFrame(to)));
  if (f1 < f0) { f0 = f1 = Math.min(a.nf - 1, Math.max(0, Math.round(toFrame(center)))); }

  const c = new Array(12).fill(0);
  let eTot = 0, eTon = 0;
  for (let f = f0; f <= f1; f++) {
    const b = f * AN.STRIDE;
    const e = a.frames[b + 13], flat = a.frames[b + 12];
    const wt = Math.min(1, Math.max(0, (0.5 - flat) / 0.3)); // Flatness 0.2 -> voll tonal, 0.5 -> Rauschen
    eTot += e; eTon += e * wt;
    for (let pc = 0; pc < 12; pc++) c[pc] += a.frames[b + pc] * wt;
  }
  const csum = c.reduce((s, v) => s + v, 0);
  if (eTot <= 1e-9 || csum <= 1e-12) return { conf: 0, tonic: 0, minor: 0, c: c.map(() => 0) };
  for (let pc = 0; pc < 12; pc++) c[pc] /= csum;

  let best = -2, tonic = 0, minor = 0;
  for (let k = 0; k < 12; k++) {
    const rot = (prof) => prof.map((_, pc) => prof[(pc - k + 12) % 12]);
    const rMaj = pearson(c, rot(KK_MAJ)), rMin = pearson(c, rot(KK_MIN));
    if (rMaj > best) { best = rMaj; tonic = k; minor = 0; }
    if (rMin > best) { best = rMin; tonic = k; minor = 1; }
  }
  const tonalShare = eTon / eTot;
  const conf = Math.max(0, best) * Math.min(1, tonalShare / 0.5);
  return { conf, tonic, minor, c };
}

function sendPadInfo(i, startMs, spanMs) {
  const r = analyzeWindow(startMs, spanMs);
  if (!r) return;
  Max.outlet('padinfo', i, +r.conf.toFixed(3), r.tonic, r.minor, ...r.c.map((v) => +v.toFixed(4)));
}

async function search(query) {
  const q = String(query || '').trim();
  if (!q) return;
  status(`Suche: ${clean(q)} …`);
  ui.query = q; ui.searching = true; pushUi();
  try {
    const out = await run('yt-dlp', ['--flat-playlist', '--dump-single-json', '--no-warnings', `ytsearch${SEARCH_FETCH}:${q}`]);
    const data = JSON.parse(out);
    allResults = (data.entries || [])
      .filter((e) => e && e.id)
      .map((e) => ({ id: e.id, title: clean(e.title || e.id), duration: e.duration || 0 }));
    lastQuery = q;
    ui.searched = q; ui.sel = 0; ui.searching = false;
    showResults();
  } catch (e) {
    ui.searching = false;
    status(errMsg(e));
  }
}

// Treffer nach Länge filtern und ins Menü schreiben
function showResults() {
  lastResults = allResults
    .filter((r) => r.duration > 0 && r.duration <= maxLenSec)   // ohne Länge = Livestream o. Ä.
    .slice(0, SEARCH_SHOW);
  ui.sel = Math.min(ui.sel, Math.max(0, lastResults.length - 1));
  const hidden = allResults.length - lastResults.length;
  const lim = `${Math.round(maxLenSec / 60)} min`;
  if (!lastResults.length) status(`Keine Treffer unter ${lim} – anders suchen`);
  else status(`${lastResults.length} Treffer ≤ ${lim}` + (hidden > 0 ? ` (${hidden} ausgeblendet)` : ''));
}

// Ganzen Track in den Cache laden. Zwei Wege (Spec 3.1): way "dev" (Teletext) und "ed" (Editor), je ein yt-dlp.
// Geladen wird unter <id>.dl-<way>.* und erst am Ende auf <id>.wav umbenannt: Ein abgebrochener
// Download hinterlässt keine halbe WAV. onPhase(phase, prozent): info | long | download | convert
async function download(id, way, job, onPhase) {
  const url = `https://www.youtube.com/watch?v=${id}`;
  const tmp = path.join(CACHE, `${id}.dl-${way}`);
  try {
    onPhase('info', 0);
    const j = JSON.parse(await run('yt-dlp', ['-J', '--no-playlist', '--no-warnings', url], null, job));
    const info = { id, title: clean(j.title || id), raw: String(j.title || id), duration: j.duration || 0 };
    const args = [
      '-f', 'bestaudio/best',
      '-x', '--audio-format', 'wav',
      '--postprocessor-args', 'ExtractAudio:-ar 44100 -ac 2',
      '--no-playlist', '--newline', '--no-warnings', '--force-overwrites',
      '-o', tmp + '.%(ext)s',
    ];
    if (info.duration > MAX_SECONDS) {
      args.push('--download-sections', `*0-${MAX_SECONDS}`);
      onPhase('long', 0);
    }
    args.push(url);
    let lastPct = -10;
    await run('yt-dlp', args, (line) => {
      const m = line.match(/\[download\]\s+([\d.]+)%/);
      if (m) {
        const p = parseFloat(m[1]);
        if (p - lastPct >= 5 || p >= 100) { lastPct = p; onPhase('download', p); }
      } else if (/ExtractAudio/.test(line)) onPhase('convert', 100);
    }, job);
    if (!fs.existsSync(tmp + '.wav')) throw new Error('WAV fehlt – ist ffmpeg installiert?');
    fs.renameSync(tmp + '.wav', cacheWav(id));
    fs.writeFileSync(path.join(CACHE, `${id}.json`), JSON.stringify(info));
    return info;
  } finally {
    // Reste (.webm, .part, …) dieses Wegs wegräumen
    for (const n of fs.readdirSync(CACHE)) if (n.startsWith(`${id}.dl-${way}.`)) { try { fs.unlinkSync(path.join(CACHE, n)); } catch (e) { /* weg */ } }
  }
}

// Teletext: ins Device laden. Ein neuer Wunsch bricht den laufenden ab (statt "busy").
let devJob = null;
async function loadVideo(input) {
  const id = extractId(input);
  if (!id) { status('Keine gültige YouTube-URL oder ID'); return; }
  if (devJob) abort(devJob);
  const job = devJob = { aborted: false, child: null };
  ui.loading = true; ui.phase = 'INFO'; ui.progress = 0; pushUi();
  try {
    let info = readJson(path.join(CACHE, `${id}.json`));
    if (!hasWav(id) || !info) {
      info = await download(id, 'dev', job, (ph, p) => {
        if (job.aborted) return;
        if (ph === 'info') status('Hole Video-Infos …');
        else if (ph === 'long') status(`Langes Video – nehme die ersten ${MAX_SECONDS / 60} Minuten`);
        else if (ph === 'download') { ui.phase = 'DOWNLOAD'; ui.progress = p; status(`Lade … ${p.toFixed(0)} %`); }
        else if (ph === 'convert') { ui.phase = 'KONVERT'; status('Konvertiere …'); }
      });
      libEvents.emit('cache', cacheSize());
    }
    if (job.aborted) return;
    const ms = wavDurationMs(cacheWav(id));
    analysis = null;
    Max.outlet('loaded', cacheWav(id), ms, id, info.title);
    ui.title = info.title; ui.phase = 'ANALYSE';
    status(`Bereit: ${info.title}`);
    try {
      await ensureAnalysis(id, info.title, false);
    } catch (e) {
      status('Tonart-Analyse fehlgeschlagen: ' + clean(e.message).slice(0, 80));
    }
  } catch (e) {
    if (!job.aborted) {
      const m = errMsg(e);
      ui.message = m;
      Max.outlet('loadfail', id, m.replace(/^Fehler: /, ''));
    }
  } finally {
    if (devJob === job) {
      devJob = null;
      ui.loading = false; ui.phase = ''; pushUi();
    }
  }
}

Max.addHandler('load', (...parts) => loadVideo(parts.join('')));
Max.addHandler('analyze', (i, start, span) => sendPadInfo(Math.floor(i), start, span));
Max.addHandler('beattrack', (bpm) => sendBeats(bpm));
Max.addHandler('analyzeall', (span, ...starts) => starts.forEach((st, i) => sendPadInfo(i, st, span)));

// =====================================================================
// Session-Speicher: Zustand pro Device als JSON-Datei.
// Die Session-Nummer steckt als unsichtbarer Parameter im Live-Set.
// =====================================================================
let sessionId = 0;
let saveTimer = null;
let pendingState = null;

const sessionFile = (id) => path.join(SESSIONS, `${id}.json`);
const lockFile = (id) => path.join(SESSIONS, `${id}.lock`);

function pidAlive(pid) {
  try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; }
}

function lockedByOther(id) {
  try {
    const pid = parseInt(fs.readFileSync(lockFile(id), 'utf8'), 10);
    return pid && pid !== process.pid && pidAlive(pid);
  } catch (e) { return false; }
}

function releaseLock() {
  if (!sessionId) return;
  try {
    if (parseInt(fs.readFileSync(lockFile(sessionId), 'utf8'), 10) === process.pid) fs.unlinkSync(lockFile(sessionId));
  } catch (e) { /* egal */ }
}

function writeStateNow() {
  if (!sessionId || pendingState === null) return;
  const tmp = sessionFile(sessionId) + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify({ version: 2, saved: new Date().toISOString(), state: pendingState }));
  fs.renameSync(tmp, sessionFile(sessionId));   // atomar: nie halb geschriebene Datei
  pendingState = null;
}

Max.addHandler('session', (id) => {
  id = Math.floor(id);
  if (!id) return;
  flushState();
  releaseLock();
  if (lockedByOther(id)) {
    // gleiche Nummer läuft schon in einem anderen Device (Spur dupliziert) -> abzweigen
    let nid;
    do { nid = 1 + Math.floor(Math.random() * 999998); } while (fs.existsSync(sessionFile(nid)));
    try { fs.copyFileSync(sessionFile(id), sessionFile(nid)); } catch (e) { /* noch keine Datei */ }
    id = nid;
    Max.outlet('newsession', id);
  }
  sessionId = id;
  sendLibstate();   // vor state: [js] kennt dann schon die Anzahl der Bänke
  edDirty('hello');
  fs.writeFileSync(lockFile(id), String(process.pid));
  let data = null;
  try { data = JSON.parse(fs.readFileSync(sessionFile(id), 'utf8')); } catch (e) { /* neu */ }
  if (data && data.state) {
    // Session aus 1.x: einmal aufheben, das nächste Autosave schreibt version 2 (Spec 8.2)
    if (!(data.version >= 2)) {
      try { fs.copyFileSync(sessionFile(id), path.join(SESSIONS, `${id}.v1.json`), fs.constants.COPYFILE_EXCL); } catch (e) { /* schon da */ }
    }
    Max.outlet('state', data.state);
  } else Max.outlet('statenone');
});

Max.addHandler('savestate', (...parts) => {
  pendingState = parts.join('');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { writeStateNow(); } catch (e) { status('Speichern fehlgeschlagen: ' + clean(e.message).slice(0, 80)); }
  }, 400);
});

function flushState() {
  clearTimeout(saveTimer);
  try { writeStateNow(); } catch (e) { /* egal */ }
}

process.on('exit', () => { flushState(); releaseLock(); });
['SIGTERM', 'SIGINT'].forEach((sig) => process.on(sig, () => process.exit(0)));

// =====================================================================
// Bibliothek: D/library.json, global für alle Live-Sets (Spec 2.2).
// Die Vorgänge in LIB sind reine Funktionen auf dem gelesenen Objekt.
// libChange() holt die Sperre, liest frisch, wendet an und schreibt atomar.
// =====================================================================
const LIB_FILE = path.join(DATA, 'library.json');
const LIB_LOCK = path.join(DATA, 'library.lock');
const BACKUP_DIR = path.join(DATA, 'backup');
const BACKUP_KEEP = 10;

// Fehlercodes für /cmd-Antwort und SSE msg (Spec 6.5)
const ERR = {
  nobank: 'Bank gibt es nicht mehr',
  libbroken: 'Bibliothek kaputt – Speichern gesperrt',
  libnewer: 'Bibliothek aus neuerer Version',
  libbusy: 'Bibliothek belegt',
  writefail: 'Speichern fehlgeschlagen',
  playonly: 'Track fehlt – nur spielbar',
  cutfail: 'Snippets schneiden fehlgeschlagen',
  nosnip: 'Snippets fehlen – Bank nicht ladbar',
  idtaken: 'Bank existiert schon',
  notempo: 'Kein Tempo erkannt',
  superseded: 'Neuere Suche läuft',
  searchfail: 'Suche fehlgeschlagen',
  loadfail: 'Download fehlgeschlagen',
  badreq: 'Ungültiger Befehl',
};
// Fehler mit .code und .text, z. B. libErr('writefail', 'Platte voll') -> "Speichern fehlgeschlagen: Platte voll"
function libErr(code, detail) {
  const e = new Error(ERR[code] + (detail ? ': ' + detail : ''));
  e.code = code;
  e.text = e.message;
  return e;
}

const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const isObj = (o) => o !== null && typeof o === 'object' && !Array.isArray(o);
const isInt = (v, min) => Number.isInteger(v) && v >= min;
const isPad = (v) => isInt(v, 0) && v < 16;
const isStarts = (a) => Array.isArray(a) && a.length === 16 && a.every((v) => isInt(v, 0));
const emptyLib = () => ({ format: 1, rev: 0, nextId: 1, banks: [], videos: {} });
const libState = (lib) => (lib.banks.length ? 'ok' : 'leer');

// Kaputt-Regeln -> Fehlertext, '' = gültig
function libCheck(lib) {
  if (!isObj(lib) || lib.format !== 1) return 'format fehlt oder falsch';
  if (!isInt(lib.rev, 0)) return 'rev fehlt oder falsch';
  if (!isInt(lib.nextId, 1)) return 'nextId fehlt oder falsch';
  if (!Array.isArray(lib.banks)) return 'banks fehlt oder falsch';
  if (!isObj(lib.videos)) return 'videos fehlt oder falsch';
  for (const v of Object.keys(lib.videos)) {
    const e = lib.videos[v];
    if (!isObj(e) || typeof e.title !== 'string' || (has(e, 'bpm') && typeof e.bpm !== 'number')) return `Video ${v}: title oder bpm falsch`;
  }
  const ids = new Set();
  for (let i = 0; i < lib.banks.length; i++) {
    const b = lib.banks[i], at = `Bank ${i + 1}: `;
    if (!isObj(b) || !isInt(b.id, 1)) return at + 'id fehlt oder falsch';
    if (ids.has(b.id)) return at + `id ${b.id} doppelt`;
    if (b.id >= lib.nextId) return at + `id ${b.id} nicht kleiner als nextId`;
    ids.add(b.id);
    if (typeof b.name !== 'string') return at + 'name fehlt oder falsch';
    if (typeof b.video !== 'string' || !has(lib.videos, b.video)) return at + 'video fehlt in videos';
    if (!isStarts(b.starts)) return at + 'starts nicht genau 16 ganze ms';
  }
  return '';
}

// -> {state: ok|leer|kaputt|neuer, lib (null bei kaputt/neuer), error, text (Dateiinhalt, null wenn keine Datei)}
function libParse(text) {
  let lib;
  try { lib = JSON.parse(text); } catch (e) { return { state: 'kaputt', lib: null, error: 'kein gültiges JSON', text }; }
  if (isObj(lib) && typeof lib.format === 'number' && lib.format > 1) return { state: 'neuer', lib: null, error: `format ${lib.format}`, text };
  const error = libCheck(lib);
  if (error) return { state: 'kaputt', lib: null, error, text };
  return { state: libState(lib), lib, error: '', text };
}

function libRead() {
  try {
    return libParse(fs.readFileSync(LIB_FILE, 'utf8'));
  } catch (e) {
    if (e.code !== 'ENOENT') return { state: 'kaputt', lib: null, error: 'nicht lesbar: ' + e.code, text: null };
    // iCloud hat die Datei ausgelagert: nur der Platzhalter liegt da
    if (fs.existsSync(path.join(DATA, '.library.json.icloud'))) return { state: 'kaputt', lib: null, error: 'noch nicht aus iCloud geladen', text: null };
    return { state: 'leer', lib: emptyLib(), error: '', text: null };
  }
}

const sleepSync = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

function libLock() {
  const until = Date.now() + 1000;
  for (;;) {
    try {
      const fd = fs.openSync(LIB_LOCK, 'wx');
      try { fs.writeSync(fd, String(process.pid)); } finally { fs.closeSync(fd); }
      return;
    } catch (e) {
      if (e.code !== 'EEXIST') throw libErr('writefail', clean(e.message).slice(0, 80));
    }
    try {
      const pid = parseInt(fs.readFileSync(LIB_LOCK, 'utf8'), 10);   // leer = wird gerade geschrieben, gilt als lebendig
      const age = Date.now() - fs.statSync(LIB_LOCK).mtimeMs;
      // shortcut: übernehmen zwei Prozesse gleichzeitig dieselbe tote Sperre, kann einer die frische des anderen löschen; bei einem Rechner und ms-kurzen Vorgängen hingenommen
      if ((pid > 0 && !pidAlive(pid)) || age > 5000) { fs.unlinkSync(LIB_LOCK); continue; }
    } catch (e) { /* gerade freigegeben: nochmal versuchen */ }
    if (Date.now() >= until) throw libErr('libbusy');
    sleepSync(10);
  }
}

function libUnlock() {
  try { if (parseInt(fs.readFileSync(LIB_LOCK, 'utf8'), 10) === process.pid) fs.unlinkSync(LIB_LOCK); } catch (e) { /* schon weg */ }
}

function libWrite(lib) {
  const tmp = LIB_FILE + '.tmp';
  try {
    const fd = fs.openSync(tmp, 'w');
    try { fs.writeSync(fd, JSON.stringify(lib, null, 1)); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    fs.renameSync(tmp, LIB_FILE);
  } catch (e) { throw libErr('writefail', clean(e.message).slice(0, 80)); }
}

// videos-Eintrag lebt nur, solange eine Bank ihn benutzt
function dropOrphans(lib) {
  const used = new Set(lib.banks.map((b) => b.video));
  for (const v of Object.keys(lib.videos)) if (!used.has(v)) delete lib.videos[v];
}

const need = (ok) => { if (!ok) throw libErr('badreq'); };
function bankIndex(lib, id) {
  need(isInt(id, 1));
  const i = lib.banks.findIndex((b) => b.id === id);
  if (i < 0) throw libErr('nobank');
  return i;
}
const bankName = (n) => String(n).trim().slice(0, 100);
const roundBpm = (bpm) => { need(typeof bpm === 'number' && bpm >= 30 && bpm <= 300); return Math.round(bpm * 10) / 10; };

// Vorgänge: (lib, Felder) -> Antwortfelder. Ändern lib, werfen libErr. Alle nennen IDs, keine Plätze.
const LIB = {
  // newbank: Bank am Ende, ein schon bekanntes Video behält Titel und bpm
  create(lib, { video, title, name, starts }) {
    need(typeof video === 'string' && video !== '' && isStarts(starts));
    if (!has(lib.videos, video)) lib.videos[video] = { title: String(title || '') };
    const id = lib.nextId++;
    lib.banks.push({ id, name: bankName(name === undefined ? lib.videos[video].title : name), video, starts: starts.slice() });
    return { id };
  },
  rename(lib, { id, name }) {
    need(typeof name === 'string');
    lib.banks[bankIndex(lib, id)].name = bankName(name);
  },
  duplicate(lib, { id }) {
    const i = bankIndex(lib, id);
    const copy = JSON.parse(JSON.stringify(lib.banks[i]));
    copy.id = lib.nextId++;
    copy.name += ' (Kopie)';
    lib.banks.splice(i + 1, 0, copy);
    return { id: copy.id };
  },
  // verwaister videos-Eintrag fällt in libChange weg; removed reicht für restore
  delete(lib, { id }) {
    const i = bankIndex(lib, id);
    const bank = lib.banks.splice(i, 1)[0];
    const v = lib.videos[bank.video];
    const video = { title: v.title };
    if (has(v, 'bpm')) video.bpm = v.bpm;
    return { removed: { bank, at: i + 1, video } };
  },
  move(lib, { id, to }) {
    const i = bankIndex(lib, id);
    need(isInt(to, 1) && to <= lib.banks.length);
    lib.banks.splice(to - 1, 0, lib.banks.splice(i, 1)[0]);
  },
  // Undo von delete: alte ID, nextId bleibt
  restore(lib, { bank, at, video }) {
    need(isObj(bank) && isInt(bank.id, 1) && typeof bank.name === 'string' && typeof bank.video === 'string' && bank.video !== '' && isStarts(bank.starts) && isInt(at, 1));
    if (bank.id >= lib.nextId || lib.banks.some((b) => b.id === bank.id)) throw libErr('idtaken');
    if (!has(lib.videos, bank.video)) {
      need(isObj(video) && typeof video.title === 'string');
      lib.videos[bank.video] = { title: video.title };
      if (typeof video.bpm === 'number') lib.videos[bank.video].bpm = video.bpm;
    }
    const b = JSON.parse(JSON.stringify(bank));
    lib.banks.splice(Math.min(at, lib.banks.length + 1) - 1, 0, b);
  },
  setstart(lib, { id, pad, ms }) {
    const i = bankIndex(lib, id);
    need(isPad(pad) && isInt(ms, 0));
    lib.banks[i].starts[pad] = ms;
  },
  setstarts(lib, { id, starts }) {
    const i = bankIndex(lib, id);
    need(isStarts(starts));
    lib.banks[i].starts = starts.slice();
  },
  swap(lib, { id, a, b }) {
    const i = bankIndex(lib, id);
    need(isPad(a) && isPad(b));
    const s = lib.banks[i].starts;
    [s[a], s[b]] = [s[b], s[a]];
  },
  // tempo, tempook und bpmset vom Device: bestätigtes Tempo des Videos
  tempo(lib, { video, bpm }) {
    const v = roundBpm(bpm);
    need(typeof video === 'string' && has(lib.videos, video));
    lib.videos[video].bpm = v;
    return { bpm: v };
  },
};

// Zuletzt gelesener Stand. libEvents 'change' (stand, by) nach jeder eigenen Änderung (by = Aufrufer)
// und bei Änderung von außen (by "extern"). Andockstelle für libstate an [js] und SSE lib.
let libNow = libRead();
const libEvents = new (require('events'))();

// Ein Schreibvorgang (Spec 2.2 „Schreiben“), synchron am Stück. Wirft libErr.
function libChange(op, args, by) {
  need(has(LIB, op) && isObj(args));
  libLock();
  let res;
  try {
    const r = libRead();
    // libNow bleibt: libWatch merkt den Wechsel und meldet ihn an [js] und Editor
    if (!r.lib) throw libErr(r.state === 'neuer' ? 'libnewer' : 'libbroken');
    res = LIB[op](r.lib, args) || {};
    dropOrphans(r.lib);
    r.lib.rev++;
    libWrite(r.lib);
    libNow = { state: libState(r.lib), lib: r.lib, error: '', text: null };
  } finally {
    libUnlock();
  }
  libEvents.emit('change', libNow, by);
  return res;
}

// Andere Prozesse (zweites Device, Finder) beobachten. Die eigene rev steckt schon in libNow.
function libWatch() {
  fs.watchFile(LIB_FILE, { interval: 500 }, () => {
    const r = libRead();
    const rev = (x) => (x.lib ? x.lib.rev : -1);
    if (r.state === libNow.state && rev(r) === rev(libNow)) return;
    libNow = r;
    libEvents.emit('change', libNow, 'extern');
  });
}

// Sicherung beim Start (Spec 2.6): nur gültig gelesene Dateien, nur wenn anders als die neueste, 10 bleiben
function libBackup() {
  const r = libRead();
  if (!r.lib || r.text === null) return;
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const names = fs.readdirSync(BACKUP_DIR).filter((n) => /^bibliothek-\d{4}-\d\d-\d\d-\d{6}\.json$/.test(n)).sort();
  let newest = null;
  if (names.length) { try { newest = fs.readFileSync(path.join(BACKUP_DIR, names[names.length - 1]), 'utf8'); } catch (e) { /* neu schreiben */ } }
  if (newest !== r.text) {
    const d = new Date(), p = (n) => String(n).padStart(2, '0');
    const name = `bibliothek-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.json`;
    fs.writeFileSync(path.join(BACKUP_DIR, name), r.text);
    if (!names.includes(name)) names.push(name);
  }
  for (const n of names.slice(0, -BACKUP_KEEP)) fs.unlinkSync(path.join(BACKUP_DIR, n));
}

// =====================================================================
// Snippets (Spec 2.3): D/snippets/<bankId>.wav + .json. 16 Fächer à 16 s, Fach i ab i × 16000 ms,
// kürzere mit Stille aufgefüllt. Zustand snip/wav/fail nur im Speicher.
// libEvents für Paket 4: 'status' (snip/wav/fail geändert -> SSE lib mit gleicher rev), 'job', 'msg', 'cache'.
// =====================================================================
const SNIP_DIR = path.join(DATA, 'snippets');
const SNIP_MS = 16000;
const SNIP_SR = 44100, BPF = 4;                      // 16 Bit Stereo: 4 Byte pro Frame
const SLOT_BYTES = SNIP_MS * SNIP_SR / 1000 * BPF;   // ein Fach
const SNIP_DEBOUNCE = 500;
const SNIP_KEEP_MS = 7 * 86400000;                   // Snippets gelöschter Bänke (Undo)
const CACHE_WARN = 10000000000;
fs.mkdirSync(SNIP_DIR, { recursive: true });

const snipWav = (id) => path.join(SNIP_DIR, `${id}.wav`);
const snipJson = (id) => path.join(SNIP_DIR, `${id}.json`);
const snipTimers = new Map();   // bankId -> Entprell-Timer (Zustand stale)
const videoFail = {};           // video -> Grund des letzten gescheiterten Downloads
let snipCutting = 0;            // bankId, die gerade geschnitten wird

function wavHeader(dataBytes) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + dataBytes, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22);
  h.writeUInt32LE(SNIP_SR, 24); h.writeUInt32LE(SNIP_SR * BPF, 28); h.writeUInt16LE(BPF, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(dataBytes, 40);
  return h;
}

// aktuell = .json passt zu video und starts der Bank
function snipCurrent(bank) {
  const j = readJson(snipJson(bank.id));
  return !!j && j.video === bank.video && Array.isArray(j.starts) && j.starts.join() === bank.starts.join() && fs.existsSync(snipWav(bank.id));
}

// Für SSE lib: banks[].snip und .wav (videos[].fail steht in videoFail)
function snipStatus(bank) {
  const snip = snipCutting === bank.id ? 'cutting' : snipTimers.has(bank.id) ? 'stale'
    : snipCurrent(bank) ? 'ok' : fs.existsSync(snipJson(bank.id)) ? 'stale' : 'missing';
  return { snip, wav: hasWav(bank.video) };
}

// Quelle fürs Schneiden: die ganze WAV, sonst die Fächer der alten Snippet-Datei. Das geht nur, wenn jeder
// Start darin vorkommt (Tauschen, Undo eines Tauschs, Duplizieren). null = keine Quelle (playonly).
// slots[i] = [Byte-Position, Bytes] in file
function snipSource(bank) {
  if (hasWav(bank.video)) {
    const w = wavInfo(cacheWav(bank.video));
    if (w.sr !== SNIP_SR || w.channels !== 2 || w.bits !== 16) throw libErr('cutfail', 'Track nicht 44,1 kHz/16 Bit/Stereo');
    const frames = Math.floor(w.dataSize / BPF), dur = Math.round(frames * 1000 / SNIP_SR);
    return {
      file: cacheWav(bank.video), dur, whole: true,
      lens: bank.starts.map((s) => Math.max(0, Math.min(SNIP_MS, dur - s))),
      slots: bank.starts.map((s) => {
        const f = Math.min(frames, Math.round(s * SNIP_SR / 1000));
        return [w.offset + f * BPF, Math.min(SLOT_BYTES, (frames - f) * BPF)];
      }),
    };
  }
  const old = readJson(snipJson(bank.id));
  if (!old || old.video !== bank.video || !Array.isArray(old.starts) || !Array.isArray(old.lens)) return null;
  const from = bank.starts.map((s) => old.starts.indexOf(s));
  if (from.some((k) => k < 0)) return null;
  let w;
  try { w = wavInfo(snipWav(bank.id)); } catch (e) { return null; }
  return {
    file: snipWav(bank.id), dur: old.dur, lens: from.map((k) => old.lens[k]),
    slots: from.map((k) => [w.offset + k * SLOT_BYTES, Math.max(0, Math.min(SLOT_BYTES, w.dataSize - k * SLOT_BYTES))]),
  };
}

// Schneidet die Snippets einer Bank, synchron. Erst die WAV, dann die .json, beide über <id>.<pid>.tmp.
// Wirft libErr playonly oder cutfail.
function cutSnippets(bank) {
  clearTimeout(snipTimers.get(bank.id));
  snipTimers.delete(bank.id);
  const job = (phase) => libEvents.emit('job', { kind: 'cut', bankId: bank.id, video: bank.video, phase, progress: phase === 'done' ? 100 : 0, left: 0 });
  let src;
  try { src = snipSource(bank); } catch (e) { throw e.code === 'cutfail' ? e : libErr('cutfail', clean(e.message).slice(0, 80)); }
  if (!src) throw libErr('playonly');
  const tmp = path.join(SNIP_DIR, `${bank.id}.${process.pid}.tmp`);
  snipCutting = bank.id;
  job('cut');
  try {
    const out = fs.openSync(tmp, 'w');
    try {
      const inp = fs.openSync(src.file, 'r');
      try {
        fs.writeSync(out, wavHeader(16 * SLOT_BYTES), 0, 44, 0);
        const buf = Buffer.alloc(SLOT_BYTES);
        src.slots.forEach(([at, n], i) => {
          buf.fill(0);
          if (n > 0) fs.readSync(inp, buf, 0, n, at);
          fs.writeSync(out, buf, 0, SLOT_BYTES, 44 + i * SLOT_BYTES);
        });
      } finally { fs.closeSync(inp); }
    } finally { fs.closeSync(out); }
    fs.renameSync(tmp, snipWav(bank.id));
    fs.writeFileSync(tmp, JSON.stringify({ video: bank.video, starts: bank.starts, lens: src.lens, dur: src.dur }));
    fs.renameSync(tmp, snipJson(bank.id));
  } catch (e) {
    try { fs.unlinkSync(tmp); } catch (e2) { /* weg */ }
    job('fail');
    throw libErr('cutfail', clean(e.message).slice(0, 80));
  } finally {
    snipCutting = 0;
  }
  // Analyse einmal neben die Snippets legen (Spec 2.4)
  if (src.whole) { try { getAnalysis(bank.video, true); } catch (e) { Max.post(`YT Sampler: Analyse fehlgeschlagen: ${e.message}`); } }
  job('done');
  libEvents.emit('status');
}

// select/banksel/bankopen: veraltete oder fehlende Snippets sofort schneiden.
// -> {path, video, starts, lens, dur} aus der .json. Geht das Schneiden nicht, spielt die alte Datei weiter.
// Ohne Snippet-Datei: libErr nosnip (keine Quelle) bzw. cutfail.
function snipEnsure(bank) {
  let err = null;
  if (!snipCurrent(bank)) { try { cutSnippets(bank); } catch (e) { err = e; } }
  const j = readJson(snipJson(bank.id));
  if (!j || !fs.existsSync(snipWav(bank.id))) throw err && err.code !== 'playonly' ? err : libErr('nosnip');
  return { path: snipWav(bank.id), ...j };
}

// Neu schneiden, 500 ms nach der letzten Änderung der Bank
function snipSchedule(id) {
  clearTimeout(snipTimers.get(id));
  snipTimers.set(id, setTimeout(() => {
    snipTimers.delete(id);
    const bank = libNow.lib && libNow.lib.banks.find((b) => b.id === id);
    if (!bank || snipCurrent(bank)) { libEvents.emit('status'); return; }   // z. B. duplicate hat schon kopiert
    try { cutSnippets(bank); } catch (e) { libEvents.emit('msg', { level: 'error', code: e.code || 'cutfail', text: e.text || e.message }); }
  }, SNIP_DEBOUNCE));
}

// Veraltete oder fehlende Snippets (nur eines Videos, wenn angegeben) entprellt neu schneiden, wo es eine Quelle gibt
function snipRefresh(video) {
  if (!libNow.lib) return;
  for (const b of libNow.lib.banks) {
    if ((video && b.video !== video) || snipCurrent(b)) continue;
    let ok;
    try { ok = !!snipSource(b); } catch (e) { ok = true; }   // Fehler zeigt dann das Schneiden
    if (ok) snipSchedule(b.id);
  }
}
// Geschnitten wird im Prozess, der die Änderung macht (Spec 2.3 „mehrere Devices“)
libEvents.on('change', (stand, by) => { if (by !== 'extern') snipRefresh(); });

// duplicate: Snippet-Dateien der Quelle übernehmen. false = fehlgeschlagen (dann schneidet snipRefresh)
function snipCopy(from, to) {
  const tmp = path.join(SNIP_DIR, `${to}.${process.pid}.tmp`);
  try {
    for (const f of [snipWav, snipJson]) { fs.copyFileSync(f(from), tmp); fs.renameSync(tmp, f(to)); }
    return true;
  } catch (e) {
    try { fs.unlinkSync(tmp); } catch (e2) { /* weg */ }
    return false;
  }
}

// Beim Start: Snippets von Bänken, die nicht in der Bibliothek stehen und älter als 7 Tage sind.
// Nur Namen aus Ziffern (nie .chroma), nur mit gültig gelesener Bibliothek.
function snipCleanup(now = Date.now()) {
  if (!libNow.lib) return;
  const ids = new Set(libNow.lib.banks.map((b) => String(b.id)));
  for (const n of fs.readdirSync(SNIP_DIR)) {
    const m = /^(\d+)\.(wav|json)$/.exec(n);
    if (!m || ids.has(m[1])) continue;
    const f = path.join(SNIP_DIR, n);
    try { if (now - fs.statSync(f).mtimeMs > SNIP_KEEP_MS) fs.unlinkSync(f); } catch (e) { /* weg */ }
  }
}

// Spec 2.5: Größe aller Dateien im Cache
function cacheSize() {
  let bytes = 0;
  let names = [];
  try { names = fs.readdirSync(CACHE); } catch (e) { /* im Finder gelöscht */ }
  for (const n of names) { try { bytes += fs.statSync(path.join(CACHE, n)).size; } catch (e) { /* weg */ } }
  return { bytes, warn: bytes >= CACHE_WARN };
}

// =====================================================================
// Beats und Würfeln für den Editor (Spec 3.1)
// =====================================================================
const TEMPO_MIN_CONF = 0.3;   // wie tempoTrusted() in [js]
const beatStore = new Map();  // video -> {bpm, beats, down}

// Beats gültig: bpm bestätigt oder Analyse-Konfidenz ≥ 0,3. Getrackt mit bestätigtem bpm, sonst Analyse-Tempo.
function beatsOf(v, a) {
  const lv = libNow.lib && libNow.lib.videos[v];
  const confirmed = !!(lv && lv.bpm > 0);
  const bpm = confirmed ? lv.bpm : a ? a.bpm : 0;
  const conf = a ? a.bpmConf : 0;
  let r = beatStore.get(v);
  if (a && (!r || r.bpm !== bpm)) {
    const tb = bpm > 0 ? trackBeats(a, bpm) : null;
    r = { bpm, beats: tb ? tb.beats : [], down: tb && tb.down < tb.beats.length ? tb.down : 0 };
    beatStore.set(v, r);
  }
  if (!a || !r) r = { beats: [], down: 0 };
  return { video: v, bpm, conf, confirmed, ok: r.beats.length >= 4 && (confirmed || conf >= TEMPO_MIN_CONF), beats: r.beats, down: r.down };
}
// SSE beats für den Track der aktiven Bank
const videoBeats = (v) => beatsOf(v, getAnalysis(v, true));

// Wie randomStart in [js] auf der ganzen WAV: Taktanfang, wenn die Beats gültig sind, sonst frei
// (Raster ohne Beats gibt es hier nicht). Keine Slice (16 s) ganz in Stille, kein Start doppelt.
// -> (belegte Starts) => ganze ms. Ohne WAV libErr playonly.
function roller(v) {
  if (!hasWav(v)) throw libErr('playonly');
  const last = wavDurationMs(cacheWav(v)) - SNIP_MS;
  const a = getAnalysis(v, false);
  const sil = a ? silentRanges(a) : [];
  const b = beatsOf(v, a);
  const bars = b.ok ? b.beats.filter((t, i) => (i - b.down) % 4 === 0 && t <= last) : [];
  const silent = (t) => {
    for (let k = 0; k + 1 < sil.length; k += 2) if (sil[k] <= t && t + SNIP_MS <= sil[k + 1]) return true;
    return false;
  };
  return (taken) => {
    let t = 0;
    for (let n = 0; n < 40; n++) {
      t = Math.round(n < 20 && bars.length ? bars[Math.floor(Math.random() * bars.length)] : last > 0 ? Math.random() * last : 0);
      if (!silent(t) && !taken.includes(t)) return t;
    }
    return t;
  };
}
// roll: ein Pad neu, belegt = die 16 Starts der Bank (auch der eigene, damit sich etwas ändert)
const rollStart = (v, taken) => roller(v)(taken);
// newbank: 16 Starts, aufsteigend
function rollBank(v) {
  const r = roller(v), s = [];
  for (let i = 0; i < 16; i++) s.push(r(s));
  return s.sort((x, y) => x - y);
}

// =====================================================================
// Downloads im Editor-Weg (Spec 3.1). kind: select | fetch | newbank | fetchall.
// Reihenfolge select/fetch vor newbank vor fetchall. Ein neues select/fetch bricht den laufenden Download
// ab, ebenso jeder Wunsch höherer Stufe; der abgebrochene wartet dann wieder. Unter select/fetch gewinnt
// der neueste, newbank und fetchall laufen der Reihe nach (Bänke entstehen in der gewünschten Folge). Der Teletext-Weg (loadVideo) ist getrennt, keiner bricht den anderen ab.
// Fehlschlag setzt videoFail, fetchall überspringt solche Videos.
// Achtung Aufrufer: fetchVideo-Promise immer mit catch, sonst beendet ein Fehlschlag den Node-Prozess.
// =====================================================================
const FETCH_PRIO = { select: 0, fetch: 0, newbank: 1, fetchall: 2 };
const edQueue = [];
let edJob = null, edSeq = 0;

function fetchVideo(video, kind) {
  const prio = FETCH_PRIO[kind];
  return new Promise((resolve, reject) => {
    let e = edJob && edJob.video === video ? edJob : edQueue.find((x) => x.video === video);
    if (e) { e.prio = Math.min(e.prio, prio); if (!prio) e.seq = ++edSeq; e.waiters.push({ resolve, reject }); }
    else { e = { video, prio, seq: ++edSeq, waiters: [{ resolve, reject }] }; edQueue.push(e); }
    if (edJob && edJob !== e && (prio < edJob.prio || prio + edJob.prio === 0)) abort(edJob);   // edRun reiht ihn wieder ein
    else edNext();
  });
}

function edNext() {
  if (edJob || !edQueue.length) return;
  edQueue.sort((a, b) => a.prio - b.prio || (a.prio ? a.seq - b.seq : b.seq - a.seq));
  edRun(edQueue.shift());
}

async function edRun(e) {
  edJob = e; e.aborted = false; e.child = null;
  const kind = e.prio === 1 ? 'newbank' : 'fetch';
  const job = (phase, progress) => libEvents.emit('job', { kind, video: e.video, phase, progress, left: edQueue.length });
  if (has(videoFail, e.video)) { delete videoFail[e.video]; libEvents.emit('status'); }
  try {
    const info = await download(e.video, 'ed', e, (ph, p) => { if (!e.aborted) job(ph, p); });
    edJob = null;
    if (kind === 'fetch') job('done', 100);   // newbank meldet selbst weiter
    libEvents.emit('cache', cacheSize());
    libEvents.emit('status');
    snipRefresh(e.video);
    e.waiters.forEach((w) => w.resolve(info));
  } catch (err) {
    edJob = null;
    if (e.aborted) edQueue.push(e);
    else {
      const reason = errMsg(err).replace(/^Fehler: /, '');
      videoFail[e.video] = reason;
      const title = libNow.lib && libNow.lib.videos[e.video] ? libNow.lib.videos[e.video].title : e.video;
      const le = libErr('loadfail', `${title} – ${reason}`);
      job('fail', 0);
      libEvents.emit('msg', { level: 'error', code: le.code, text: le.text });
      libEvents.emit('status');
      e.waiters.forEach((w) => w.reject(le));
    }
  }
  edNext();
}

// fetchall: alle fehlenden ganzen WAVs der Bibliothek, ohne gescheiterte
function fetchAll() {
  if (!libNow.lib) return { todo: 0 };
  const todo = [...new Set(libNow.lib.banks.map((b) => b.video))].filter((v) => !hasWav(v) && !has(videoFail, v));
  todo.forEach((v) => fetchVideo(v, 'fetchall').catch(() => { /* steht in videoFail */ }));
  return { todo: todo.length };
}

// newbank (Spec 3.3): Track laden → Analyse → 16 Starts würfeln → Bank am Ende → schneiden. -> Bank-ID.
// Aktiv machen (bank … an [js]) macht der Aufrufer. Wirft libErr (loadfail, libbroken, …).
async function newBank(video, by) {
  const job = (phase, progress, bankId) => libEvents.emit('job', { kind: 'newbank', video, bankId, phase, progress, left: edQueue.length });
  try {
    const info = (hasWav(video) && readJson(path.join(CACHE, `${video}.json`))) || await fetchVideo(video, 'newbank');
    job('analyse', 0);
    await new Promise((r) => setTimeout(r, 0));
    const starts = rollBank(video);
    const { id } = libChange('create', { video, title: info.raw || info.title, starts }, by);
    job('cut', 0, id);
    cutSnippets(libNow.lib.banks.find((b) => b.id === id));
    job('done', 100, id);
    return id;
  } catch (e) {
    job('fail', 0);
    throw e;
  }
}

// =====================================================================
// Device und Editor (Spec 3.2–3.4, 6.1, 6.2): Bank laden, Nachrichten von [js], /cmd, SSE, Peaks.
// "aktiv" = die Bank, die dieses Device hat oder gerade lädt.
// =====================================================================
const VIDEO_RE = /^[\w-]{11}$/;
const CMD_MAX = 65536;
let dev = { bankId: 0, video: '-', sel: 0, mode: 0, rev: 0, starts: [], spans: [] };   // letzter bankstate
let activeId = 0;
let track = '';            // Spurname für hello
let libBy = 'extern';      // by der letzten Bibliotheksänderung (SSE lib)
let sending = false;       // sendBank schneidet gerade selbst
let activeSnip = '';       // .json der aktiven Bank beim Laden (zweites Device schneidet -> neu laden)

const libBroken = () => libErr(libNow.state === 'neuer' ? 'libnewer' : 'libbroken');
const bankById = (id) => (libNow.lib ? libNow.lib.banks.find((b) => b.id === id) : null);
const bankNr = (id) => (libNow.lib ? libNow.lib.banks.findIndex((b) => b.id === id) + 1 : 0);
const readText = (f) => { try { return fs.readFileSync(f, 'utf8'); } catch (e) { return ''; } };

// Bank ins Device: bankname, bank …, danach die Analyse. Ohne Snippets bankfail an [js] und libErr.
function sendBank(b) {
  let s;
  sending = true;
  try { s = snipEnsure(b); } catch (e) { Max.outlet('bankfail', b.id, clean(e.text || e.message)); throw e; } finally { sending = false; }
  const v = libNow.lib.videos[b.video];
  if (activeId !== b.id) fs.unwatchFile(snipJson(activeId), onActiveSnip);
  fs.watchFile(snipJson(b.id), { interval: 500 }, onActiveSnip);   // doppelt angemeldet zählt einmal
  activeId = b.id;
  activeSnip = readText(snipJson(b.id));
  Max.outlet('bankname', b.id, clean(b.name));
  Max.outlet('bank', b.id, bankNr(b.id), (v && v.bpm) || 0, ...s.starts, ...s.lens, s.dur, s.video, s.path);
  ensureAnalysis(s.video, clean(b.name), true).catch((e) => status('Tonart-Analyse fehlgeschlagen: ' + clean(e.message).slice(0, 80)));
  edDirty('beats');
}
const trySend = (b) => { try { sendBank(b); } catch (e) { Max.post(`YT Sampler: Bank ${b.id} nicht geladen: ${e.message}`); } };

// Eigene Schnitte der aktiven Bank sofort laden, fremde (zweites Device) über watchFile
libEvents.on('job', (j) => { if (j.kind === 'cut' && j.phase === 'done' && j.bankId === activeId && !sending) { const b = bankById(activeId); if (b) trySend(b); } });
function onActiveSnip() {
  const t = readText(snipJson(activeId)), b = bankById(activeId);
  if (t && t !== activeSnip && b) trySend(b);
}

function sendLibstate() {
  Max.outlet('libstate', libNow.lib ? libNow.lib.banks.length : 0, bankNr(activeId), libNow.state);
}
const bpmToDevice = (v, bpm) => { const b = bankById(activeId); if (b && b.video === v) Max.outlet('bpm', v, bpm); };

libEvents.on('change', (stand, by) => { libBy = by; sendLibstate(); edDirty('lib'); edDirty('device'); edDirty('beats'); });
libEvents.on('status', () => edDirty('lib'));
libEvents.on('cache', () => edDirty('cache'));
libEvents.on('job', (j) => edEmit('job', j));
libEvents.on('msg', (m) => edEmit('msg', m));

// ---------- [js] -> Node (6.2) ----------
Max.addHandler('bankstate', (id, video, sel, mode, rev, ...sw) => {
  dev = { bankId: Math.floor(id) || 0, video: String(video), sel, mode, rev, starts: sw.slice(0, 16), spans: sw.slice(16, 32) };
  activeId = dev.bankId;
  edDirty('device'); edDirty('beats');
});
Max.addHandler('bankpeek', (nr) => {
  const b = libNow.lib && libNow.lib.banks[Math.floor(nr) - 1];
  Max.outlet('bankpeek', Math.floor(nr), libNow.lib ? libNow.lib.banks.length : 0, clean(b ? b.name : ''));
});
Max.addHandler('banksel', (nr) => {
  const b = libNow.lib && libNow.lib.banks[Math.floor(nr) - 1];
  if (b) trySend(b);   // über der letzten Bank: nichts
});
Max.addHandler('bankopen', (id) => {
  if (!libNow.lib) return;   // kaputt: [js] fragt wieder, sobald libstate ok kommt
  const b = bankById(Math.floor(id));
  if (b) trySend(b); else Max.outlet('bankgone', Math.floor(id));
});
Max.addHandler('bpmset', (video, bpm) => {
  const v = String(video);
  if (!libNow.lib || !has(libNow.lib.videos, v)) return;
  try { libChange('tempo', { video: v, bpm: +bpm }, 'device'); } catch (e) { Max.post(`YT Sampler: Tempo nicht gespeichert: ${e.message}`); }
});
Max.addHandler('playing', (pad, from, to, dur) => edEmit('play', { pad, from, to, dur }));
Max.addHandler('playstop', (pad) => edEmit('stop', { pad }));
Max.addHandler('trackname', (...w) => { track = w.join(' '); edDirty('hello'); });

// ---------- POST /cmd (3.3) ----------
const isVideo = (v) => typeof v === 'string' && VIDEO_RE.test(v);
function libBank(id) {
  need(isInt(id, 1));
  if (!libNow.lib) throw libBroken();
  const b = bankById(id);
  if (!b) throw libErr('nobank');
  return b;
}
function checkWav(b) { if (!hasWav(b.video)) throw libErr('playonly'); }

// Editor-Suche: eigene Trefferliste, neue Suche bricht die alte ab. URL oder ID -> genau dieses Video.
let edSearchJob = null;
async function edSearch(q) {
  need(typeof q === 'string');
  if (edSearchJob) abort(edSearchJob);
  const job = edSearchJob = { aborted: false, child: null };
  const id = extractId(q);
  try {
    const out = await run('yt-dlp', id ? ['-J', '--no-playlist', '--no-warnings', `https://www.youtube.com/watch?v=${id}`]
      : ['--flat-playlist', '--dump-single-json', '--no-warnings', `ytsearch${SEARCH_FETCH}:${q.trim()}`], null, job);
    const data = JSON.parse(out);
    const results = (id ? [data] : data.entries || []).filter((e) => e && e.id && e.duration > 0)
      .map((e) => ({ id: e.id, title: String(e.title || e.id), dur: Math.round(e.duration), long: e.duration > MAX_SECONDS }));
    return { results };
  } catch (e) {
    if (job.aborted) throw libErr('superseded');
    throw libErr('searchfail', errMsg(e).replace(/^Fehler: /, ''));
  } finally {
    if (edSearchJob === job) edSearchJob = null;
  }
}

// (Felder, client) -> Antwortfelder, wirft libErr
const CMD = {
  select(q) {
    const b = libBank(q.id);
    if (!hasWav(b.video)) fetchVideo(b.video, 'select').catch(() => { /* steht in videoFail */ });
    sendBank(b);
  },
  rename(q, by) {
    libChange('rename', { id: q.id, name: q.name }, by);
    if (q.id === activeId) Max.outlet('bankname', q.id, clean(bankById(q.id).name));
  },
  duplicate(q, by) {
    const r = libChange('duplicate', { id: q.id }, by);
    snipCopy(q.id, r.id);
    trySend(bankById(r.id));
    return r;
  },
  delete(q, by) {
    const was = q.id === activeId;
    const r = libChange('delete', { id: q.id }, by);
    const L = libNow.lib.banks, next = L[r.removed.at - 1] || L[r.removed.at - 2];
    if (was && next) trySend(next);   // keiner mehr: libstate leer ging schon raus
    return r;
  },
  move: (q, by) => { libChange('move', { id: q.id, to: q.to }, by); },
  restore: (q, by) => { libChange('restore', { bank: q.bank, at: q.at, video: q.video }, by); },
  setstart(q, by) {
    const b = libBank(q.id);
    need(isPad(q.pad) && isInt(q.ms, 0));
    checkWav(b);
    libChange('setstart', { id: q.id, pad: q.pad, ms: q.ms }, by);
  },
  setstarts(q, by) {
    const b = libBank(q.id);
    need(isStarts(q.starts));
    if (!hasWav(b.video)) {
      const j = readJson(snipJson(b.id));
      if (!j || !Array.isArray(j.starts) || !q.starts.every((s) => j.starts.includes(s))) throw libErr('playonly');
    }
    libChange('setstarts', { id: q.id, starts: q.starts }, by);
  },
  swap: (q, by) => { libChange('swap', { id: q.id, a: q.a, b: q.b }, by); },
  roll(q, by) {
    const b = libBank(q.id);
    need(isPad(q.pad));
    const ms = rollStart(b.video, b.starts);
    libChange('setstart', { id: q.id, pad: q.pad, ms }, by);
    return { ms };
  },
  hit: (q) => { need(isPad(q.pad)); Max.outlet('padhit', q.pad); },
  up: (q) => { need(isPad(q.pad)); Max.outlet('padup', q.pad); },
  search: (q) => edSearch(q.q),
  newbank(q, by) {
    need(isVideo(q.video));
    if (!libNow.lib) throw libBroken();
    newBank(q.video, by).then((id) => sendBank(bankById(id))).catch((e) => {
      if (e.code !== 'loadfail') edEmit('msg', { level: 'error', code: e.code || 'cutfail', text: e.text || e.message });   // loadfail meldet der Download selbst
    });
  },
  tempo(q, by) {
    const r = libChange('tempo', { video: q.video, bpm: q.bpm }, by);
    bpmToDevice(q.video, r.bpm);
  },
  tempook(q, by) {
    if (!libNow.lib) throw libBroken();
    need(typeof q.video === 'string' && has(libNow.lib.videos, q.video));
    const a = getAnalysis(q.video, true);
    if (!a || !(a.bpm > 0)) throw libErr('notempo');
    const r = libChange('tempo', { video: q.video, bpm: a.bpm }, by);
    bpmToDevice(q.video, r.bpm);
    return r;
  },
  fetch(q) {
    need(isVideo(q.video));
    if (!hasWav(q.video)) fetchVideo(q.video, 'fetch').catch(() => { /* steht in videoFail */ });
  },
  fetchall: () => fetchAll(),
};

async function runCmd(q) {
  need(isObj(q) && typeof q.cmd === 'string' && has(CMD, q.cmd));
  return (await CMD[q.cmd](q, typeof q.client === 'string' && q.client ? q.client : 'editor')) || {};
}

// Schutz: nur JSON, nur vom eigenen Host/Origin, höchstens 64 KB. Unlesbares JSON -> 400, Schutzregel -> 403.
function cmdRoute(req, res) {
  const hosts = [`localhost:${webPort}`, `127.0.0.1:${webPort}`];
  const origin = req.headers.origin;
  const deny = (code) => { res.writeHead(code, { Connection: 'close' }); res.end(); };
  if (req.method !== 'POST' || !/^application\/json(;|$)/i.test(req.headers['content-type'] || '') || !hosts.includes(req.headers.host)
      || (origin !== undefined && !hosts.some((h) => origin === 'http://' + h)) || +(req.headers['content-length'] || 0) > CMD_MAX) {
    deny(403); req.resume(); return;
  }
  const chunks = [];
  let size = 0;
  req.on('data', (d) => { size += d.length; if (size <= CMD_MAX) chunks.push(d); });
  req.on('end', async () => {
    if (size > CMD_MAX) { deny(403); return; }
    let q;
    try { q = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch (e) { deny(400); return; }
    let out;
    try { out = { ok: true, ...(await runCmd(q)) }; } catch (e) {
      if (!e.code || !ERR[e.code]) Max.post(`YT Sampler: Befehl ${q && q.cmd} fehlgeschlagen: ${e.stack || e}`);
      out = { ok: false, code: e.code && ERR[e.code] ? e.code : 'badreq', text: e.text || `${ERR.badreq}: ${clean(e.message)}` };
    }
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(out));
  });
}

// ---------- SSE /editor/events (3.4) ----------
const edClients = new Set();
const edPending = new Set();
const edLast = {};          // zuletzt gesendet je Zustands-Event: Gleiches nicht noch einmal
let edTimer = null;

const ED = {
  hello: () => ({ port: webPort, session: sessionId, track }),
  lib() {
    const L = libNow.lib;
    const m = { rev: L ? L.rev : 0, by: libBy, state: libNow.state, cache: cacheSize(), banks: [], videos: {} };
    if (!L) { m.error = `${ERR[libNow.state === 'neuer' ? 'libnewer' : 'libbroken']}: ${libNow.error}`; return m; }
    m.banks = L.banks.map((b) => ({ id: b.id, name: b.name, video: b.video, starts: b.starts, ...snipStatus(b) }));
    for (const v of Object.keys(L.videos)) {
      const e = { title: L.videos[v].title };
      if (has(L.videos[v], 'bpm')) e.bpm = L.videos[v].bpm;
      if (has(videoFail, v)) e.fail = videoFail[v];
      m.videos[v] = e;
    }
    return m;
  },
  device: () => ({ ...dev, nr: bankNr(dev.bankId), teletext: ui.loading ? { phase: ui.phase, progress: Math.round(ui.progress) } : null }),
  cache: () => cacheSize(),
  // Track der aktiven Bank, ohne Bank der des Device (Teletext)
  beats() {
    const b = bankById(activeId), v = b ? b.video : dev.video;
    if (!v || v === '-') return null;
    let a = null;
    try { a = getAnalysis(v, !!b); } catch (e) { /* ohne Analyse keine Beats */ }
    return beatsOf(v, a);
  },
};
const sse = (res, ev, data) => res.write(`event: ${ev}\ndata: ${JSON.stringify(data)}\n\n`);
function edEmit(ev, data) { for (const r of edClients) sse(r, ev, data); }

// Zustands-Events gebündelt (30 ms wie pushUi), Inhalt erst beim Senden berechnet
function edDirty(ev) {
  if (!edClients.size) return;
  edPending.add(ev);
  if (!edTimer) edTimer = setTimeout(edFlush, 30);
}
function edFlush() {
  edTimer = null;
  for (const ev of Object.keys(ED)) {
    if (!edPending.delete(ev)) continue;
    const d = ED[ev]();
    const j = JSON.stringify(d);
    if (!d || j === edLast[ev]) continue;
    edLast[ev] = j;
    for (const r of edClients) r.write(`event: ${ev}\ndata: ${j}\n\n`);
  }
}

function edConnect(req, res) {
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  res.write('retry: 1500\n\n');
  for (const ev of ['hello', 'lib', 'device', 'cache', 'beats']) {
    const d = ED[ev]();
    if (d) { sse(res, ev, d); edLast[ev] = JSON.stringify(d); }
  }
  edClients.add(res);
  req.on('close', () => edClients.delete(res));
}

// ---------- GET /peaks/<video> (3.2) ----------
// 8 Byte Kopf (Samplerate, Blockgröße), dann pro 256 Frames Int8 Min, Int8 Max über beide Kanäle
const PEAK_BLOCK = 256;
function peaks(v) {
  const w = wavInfo(cacheWav(v));
  if (w.bits !== 16) throw new Error('nur 16 Bit');
  const per = PEAK_BLOCK * w.channels, blocks = Math.floor(w.dataSize / 2 / per), step = 4096;
  const out = Buffer.alloc(8 + blocks * 2);
  out.writeUInt32LE(w.sr, 0); out.writeUInt32LE(PEAK_BLOCK, 4);
  const buf = Buffer.alloc(step * per * 2), pcm = new Int16Array(buf.buffer, buf.byteOffset, step * per);
  const fd = fs.openSync(cacheWav(v), 'r');
  try {
    for (let b0 = 0; b0 < blocks; b0 += step) {
      const n = Math.min(step, blocks - b0);
      fs.readSync(fd, buf, 0, n * per * 2, w.offset + b0 * per * 2);
      for (let k = 0; k < n; k++) {
        let mn = 127, mx = -128;
        for (let i = k * per, e = i + per; i < e; i++) { const x = pcm[i] >> 8; if (x < mn) mn = x; if (x > mx) mx = x; }
        out.writeInt8(mn, 8 + (b0 + k) * 2); out.writeInt8(mx, 9 + (b0 + k) * 2);
      }
    }
  } finally { fs.closeSync(fd); }
  return out;
}
function peaksRoute(v, res) {
  if (!VIDEO_RE.test(v)) { res.writeHead(400); res.end(); return; }
  if (!hasWav(v)) { res.writeHead(404); res.end(); return; }
  let data;
  try { data = peaks(v); } catch (e) { res.writeHead(500); res.end(); return; }
  res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Cache-Control': 'private, max-age=86400' });
  res.end(data);
}

// =====================================================================
// Teletext-Webseite: http://localhost:8765
// Server-Sent Events schicken den Zustand live, POST /key nimmt Tasten an.
// =====================================================================
const WEB_PORT = process.env.YTS_PORT ? +process.env.YTS_PORT : 8765;   // YTS_PORT nur für Tests
const PAGE_SIZE = 7;
const WEB_DIR = path.join(DATA, 'web');
const clients = new Set();
let webPort = 0;

// Seite (teletext.html, editor.html) neben dem Skript nach D/web spiegeln
// (so findet der Server sie auch, wenn das Device eingefroren ist)
function pagePath(name) {
  const local = path.join(__dirname, name);
  const copy = path.join(WEB_DIR, name);
  try {
    if (fs.existsSync(local)) {
      fs.mkdirSync(WEB_DIR, { recursive: true });
      if (!fs.existsSync(copy) || fs.statSync(local).mtimeMs > fs.statSync(copy).mtimeMs) fs.copyFileSync(local, copy);
      return local;
    }
  } catch (e) { /* weiter mit Kopie */ }
  return copy;
}

function viewState() {
  return {
    query: ui.query, searched: ui.searched, searching: ui.searching,
    sel: ui.sel, pageSize: PAGE_SIZE,
    results: lastResults.map((r) => ({ t: r.title, d: fmtDur(r.duration) })),
    hidden: Math.max(0, allResults.length - lastResults.length),
    maxLen: Math.round(maxLenSec / 60),
    loading: ui.loading, phase: ui.phase, progress: Math.round(ui.progress),
    title: ui.title, message: ui.message,
    learn: ui.learn === null ? null : { step: ui.learn + 1, of: IR_STEPS.length, label: IR_STEPS[ui.learn][1] },
    tvOff: ui.tvOff,
  };
}

let pushTimer = null;
pushUi = () => {
  if (pushTimer) return;
  pushTimer = setTimeout(() => {
    pushTimer = null;
    const msg = `data: ${JSON.stringify(viewState())}\n\n`;
    for (const res of clients) res.write(msg);
    edDirty('device');   // device.teletext (Phase, Fortschritt)
  }, 30);
};

// Tasten kommen von der Webseite (Tastatur, wenn das Fenster vorne ist)
// oder als MIDI-Noten auf Kanal 16 (Schreibmaschine, funktioniert immer).
function handleKey(k) {
  const n = lastResults.length;
  if (!String(k).startsWith('tap:')) tap.d = -1;     // andere Taste beendet das Mehrfachtippen
  switch (k) {
    case 'enter': {
      const q = ui.query.trim();
      if (q && q !== ui.searched) search(q);                        // neuer Begriff -> suchen
      else if (n) loadVideo(lastResults[ui.sel].id);                 // sonst markierten Treffer laden
      break;
    }
    case 'back': ui.query = ui.query.slice(0, -1); break;
    case 'esc':
      if (ui.learn !== null) { ui.learn = null; ui.message = 'Lernen abgebrochen'; }
      else ui.query = '';
      break;
    case 'learn': ui.learn = 0; irNew = {}; break;
    case 'power': ui.tvOff = !ui.tvOff; break;
    case 'up': ui.sel = Math.max(0, ui.sel - 1); break;
    case 'down': ui.sel = Math.min(Math.max(0, n - 1), ui.sel + 1); break;
    case 'pgup': ui.sel = Math.max(0, (Math.floor(ui.sel / PAGE_SIZE) - 1) * PAGE_SIZE); break;
    case 'pgdn': ui.sel = Math.min(Math.max(0, n - 1), (Math.floor(ui.sel / PAGE_SIZE) + 1) * PAGE_SIZE); break;
    default:
      if (typeof k === 'string' && k.startsWith('tap:')) multitap(+k.slice(4));
      else if (typeof k === 'string' && k.startsWith('char:')) {
        const ch = k.slice(5);
        if (ch.length === 1 && ui.query.length < 36) ui.query += ch;
      }
  }
  pushUi();
}

// MIDI-Schreibmaschine: Notennummer = Zeichencode
const MIDI_KEYS = { 8: 'back', 13: 'enter', 27: 'esc', 17: 'up', 18: 'down', 19: 'pgup', 20: 'pgdn' };
const MIDI_CHARS = { 1: 'ä', 2: 'ö', 3: 'ü', 4: 'ß', 5: 'Ä', 6: 'Ö', 7: 'Ü' };
Max.addHandler('key', (code) => {
  code = Math.floor(code);
  if (MIDI_KEYS[code]) handleKey(MIDI_KEYS[code]);
  else if (MIDI_CHARS[code]) handleKey('char:' + MIDI_CHARS[code]);
  else if (code >= 32 && code <= 126) handleKey('char:' + String.fromCharCode(code));
});

// Ziffern der Fernbedienung wie beim Handy: mehrmals drücken = nächster Buchstabe
const TAP = [' 0', 'abc1', 'def2', 'ghi3', 'jkl4', 'mno5', 'pqr6', 'stu7', 'vwx8', 'yz9'];
const TAP_MS = 1200;   // so lange zählt erneutes Drücken als "nächster Buchstabe"
let tap = { d: -1, i: 0, t: 0 };
function multitap(d) {
  const set = TAP[d], now = Date.now();
  if (!set) return;
  if (d === tap.d && now - tap.t < TAP_MS) {
    tap.i = (tap.i + 1) % set.length;
    ui.query = ui.query.slice(0, -1) + set[tap.i];
  } else {
    const n = ui.query.length;
    ui.query += set[0];
    if (ui.query.length > 36) ui.query = ui.query.slice(0, 36);
    tap = { d: ui.query.length > n ? d : -1, i: 0, t: 0 };
  }
  tap.t = now;
}

// IR-Fernbedienung: der Pro Micro schickt rohe Codes als MIDI auf Kanal 15.
// Die Teletext-Seite liest sie per Web MIDI (an Live vorbei) und schickt "ir:<code>:<wiederholung>".
// Die Zuordnung lernt der Merkmodus (Cmd+Shift+M auf der Teletext-Seite).
const IR_FILE = path.join(DATA, 'ir.json');
const IR_STEPS = [
  ['up', 'HOCH'], ['down', 'RUNTER'], ['pgup', 'LINKS'], ['pgdn', 'RECHTS'],
  ['enter', 'OK'], ['back', 'LÖSCHEN'],
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((d) => ['tap:' + d, String(d)]),
  ['power', 'AN/AUS'],
];
const IR_REPEAT = new Set(['up', 'down', 'pgup', 'pgdn', 'back']);   // beim Halten wiederholen
let irMap = {};
try { irMap = JSON.parse(fs.readFileSync(IR_FILE, 'utf8')); } catch (e) { /* noch nichts gelernt */ }
let irNew = {};

// Sind mehrere Teletext-Fenster offen, schickt jedes denselben Code
const IR_DEDUP_MS = 60;
let irLast = { code: -1, rep: false, t: 0 };

function irInput(code, rep) {
  const now = Date.now();
  if (code === irLast.code && rep === irLast.rep && now - irLast.t < IR_DEDUP_MS) return;
  irLast = { code, rep, t: now };
  if (ui.learn !== null) {
    if (rep || code in irNew) return;                  // gehalten oder doppelt gedrückt
    irNew[code] = IR_STEPS[ui.learn][0];
    if (++ui.learn >= IR_STEPS.length) {
      ui.learn = null;
      irMap = irNew;
      try {
        fs.mkdirSync(path.dirname(IR_FILE), { recursive: true });
        fs.writeFileSync(IR_FILE, JSON.stringify(irMap, null, 1));
        ui.message = 'Fernbedienung gespeichert';
      } catch (e) { ui.message = 'Fehler beim Speichern: ' + e.message; }
    }
    pushUi();
    return;
  }
  const k = irMap[code];
  if (!k || (rep && !IR_REPEAT.has(k))) return;
  if (ui.tvOff && k !== 'power') return;               // Fernseher aus: nur An/Aus geht
  handleKey(k);
}

function startWeb(port, tries) {
  const server = http.createServer((req, res) => {
    const url = req.url.split('?')[0];
    if (url === '/events') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
      res.write('retry: 1500\n\n');
      res.write(`data: ${JSON.stringify(viewState())}\n\n`);
      clients.add(res);
      req.on('close', () => clients.delete(res));
      return;
    }
    if (url === '/key' && req.method === 'POST') {
      let body = '';
      req.on('data', (d) => { body += d; if (body.length > 1000) req.destroy(); });
      req.on('end', () => {
        try {
          const k = String(JSON.parse(body).k || '');
          const ir = /^ir:(\d+):([01])$/.exec(k);
          if (ir) irInput(+ir[1], ir[2] === '1');
          else handleKey(k);
        } catch (e) { /* ignorieren */ }
        res.writeHead(204); res.end();
      });
      return;
    }
    if (url === '/state') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(viewState()));
      return;
    }
    if (url === '/' || url === '/index.html') {
      fs.readFile(pagePath('teletext.html'), (err, data) => {
        if (err) { res.writeHead(404); res.end('teletext.html nicht gefunden'); return; }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
        res.end(data);
      });
      return;
    }
    if (url === '/editor') {
      fs.readFile(pagePath('editor.html'), (err, data) => {
        if (err) { res.writeHead(404); res.end('editor.html nicht gefunden'); return; }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
        res.end(data);
      });
      return;
    }
    if (url === '/editor/events') { edConnect(req, res); return; }
    if (url === '/cmd') { cmdRoute(req, res); return; }
    if (url.startsWith('/peaks/')) { peaksRoute(url.slice(7), res); return; }
    res.writeHead(404); res.end();
  });
  server.on('error', (e) => {
    // Port belegt (z. B. zweites Device) -> nächsten probieren
    if (e.code === 'EADDRINUSE' && tries > 0) startWeb(port + 1, tries - 1);
    else Max.post(`YT Sampler: Webserver nicht gestartet: ${e.message}`);
  });
  server.listen(port, '127.0.0.1', () => {
    webPort = server.address().port;   // YTS_PORT=0: frei gewählt
    Max.post(`YT Sampler: Teletext unter http://localhost:${port}`);
  });
  // Verbindung offen halten
  setInterval(() => { for (const r of [...clients, ...edClients]) r.write(': ping\n\n'); }, 15000).unref();
}
startWeb(WEB_PORT, 5);

try { libBackup(); } catch (e) { Max.post(`YT Sampler: Sicherung fehlgeschlagen: ${e.message}`); }
libWatch();
try { snipCleanup(); } catch (e) { Max.post(`YT Sampler: Aufräumen fehlgeschlagen: ${e.message}`); }

// Startcheck; Session und Längenfilter vom Device anfordern
if (DATA_SETUP.error) status(DATA_SETUP.error);
Max.outlet('needsession');
(async () => {
  try {
    const v = (await run('yt-dlp', ['--version'])).trim();
    status(DATA_SETUP.error || `yt-dlp ${v} bereit`);
  } catch (e) {
    status(errMsg(e));
  }
})();

// Für tools/tests/ (unter Max ohne Wirkung)
module.exports = {
  DATA, LOCAL, CACHE, SESSIONS, LIB_FILE, LIB_LOCK, BACKUP_DIR, ERR, LIB, libErr, libParse, libRead, libChange, libBackup, libEvents, get libNow() { return libNow; },
  AN, SNIP_DIR, SNIP_MS, computeAnalysis, saveAnalysis, readAnalysis, getAnalysis, ensureAnalysis, trackBeats, silentRanges,
  hasWav, snipCurrent, snipStatus, cutSnippets, snipEnsure, snipRefresh, snipCopy, snipCleanup, cacheSize, videoFail,
  beatsOf, videoBeats, rollStart, rollBank, fetchVideo, fetchAll, newBank, loadVideo, get analysis() { return analysis; },
  runCmd, peaks, get webPort() { return webPort; }, get activeId() { return activeId; },
};
