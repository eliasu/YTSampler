// YT Sampler – Node for Max Teil
// Suche und Download über yt-dlp (+ ffmpeg). Audio landet als WAV im Cache.
// Nachrichten rein:  search <begriff…> | pick <index> | load <url|id>
// Nachrichten raus:  rclear | radd <titel> | status <text> | loaded <pfad> <dauer_ms> <id> <titel>

const Max = require('max-api');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');

// Live startet Max ohne Shell-PATH -> Homebrew-Pfade selbst ergänzen
const EXTRA_PATHS = ['/opt/homebrew/bin', '/usr/local/bin', '/opt/local/bin', path.join(os.homedir(), '.local/bin')];
const ENV = { ...process.env, PATH: [...EXTRA_PATHS, process.env.PATH || '/usr/bin:/bin'].join(':') };

const CACHE = path.join(os.homedir(), 'Music', 'YTSampler', 'cache');
const MAX_SECONDS = 600;  // URL-Videos über 10 min: nur die ersten 10 Minuten laden (RAM!)
const SEARCH_FETCH = 30;  // so viele Treffer holen …
const SEARCH_SHOW = 15;   // … und davon höchstens so viele anzeigen
let maxLenSec = 7 * 60;   // Längenfilter der Suche, kommt vom Device

const SESSIONS = path.join(os.homedir(), 'Music', 'YTSampler', 'sessions');
fs.mkdirSync(CACHE, { recursive: true });
fs.mkdirSync(SESSIONS, { recursive: true });

let allResults = [];   // ungefilterte Treffer der letzten Suche
let lastResults = [];  // angezeigte Treffer (Index = Menüeintrag)
let lastQuery = '';
let busy = false;

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
  fav: '',
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

function run(cmd, args, onLine) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { env: ENV });
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

function readAnalysis(file) {
  try {
    const buf = fs.readFileSync(file);
    const arr = new Float32Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length - (buf.length % 4)));
    if (arr[0] !== AN.VERSION) return null;
    const nf = arr[3], no = arr[7], H = 8;
    if (arr.length !== H + 2 * no + nf * AN.STRIDE) return null;
    return { srd: arr[1], tuning: arr[2], nf, bpm: Math.round(arr[4] * 10) / 10, bpmConf: Math.round(arr[5] * 100) / 100,
             fps: arr[6], onset: arr.subarray(H, H + no), bass: arr.subarray(H + no, H + 2 * no),
             frames: arr.subarray(H + 2 * no) };
  } catch (e) { return null; }
}

async function ensureAnalysis(id, wav, title) {
  analysis = null;
  await new Promise((r) => setImmediate(r)); // "loaded" zuerst rausschicken
  const cacheFile = path.join(CACHE, `${id}.chroma`);
  let a = readAnalysis(cacheFile);
  if (!a) {
    status('Analysiere Tonart …');
    await new Promise((r) => setTimeout(r, 20));
    const t0 = Date.now();
    a = computeAnalysis(wav);
    saveAnalysis(cacheFile, a);
    Max.post(`YT Sampler: Analyse in ${Date.now() - t0} ms`);
  }
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
  Max.outlet('rclear');
  // Kopfzeile: sonst sieht der erste Treffer aus, als wäre er schon geladen
  Max.outlet('radd', lastResults.length ? `▾ ${lastResults.length} Treffer – auswählen` : '– keine Treffer –');
  lastResults.forEach((r) => Max.outlet('radd', `${r.title} · ${fmtDur(r.duration)}`));
  ui.sel = Math.min(ui.sel, Math.max(0, lastResults.length - 1));
  const hidden = allResults.length - lastResults.length;
  const lim = `${Math.round(maxLenSec / 60)} min`;
  if (!lastResults.length) status(`Keine Treffer unter ${lim} – Limit erhöhen oder anders suchen`);
  else status(`${lastResults.length} Treffer ≤ ${lim}` + (hidden > 0 ? ` (${hidden} ausgeblendet)` : ''));
}

async function loadVideo(input) {
  const id = extractId(input);
  if (!id) { status('Keine gültige YouTube-URL oder ID'); return; }
  if (busy) { status('Lade noch – bitte kurz warten'); return; }
  busy = true;
  ui.loading = true; ui.phase = 'INFO'; ui.progress = 0; pushUi();
  try {
    const url = `https://www.youtube.com/watch?v=${id}`;
    const wav = path.join(CACHE, `${id}.wav`);
    const metaFile = path.join(CACHE, `${id}.json`);
    let info = readJson(metaFile);

    if (!fs.existsSync(wav) || !info) {
      status('Hole Video-Infos …');
      const j = JSON.parse(await run('yt-dlp', ['-J', '--no-playlist', '--no-warnings', url]));
      info = { id, title: clean(j.title || id), duration: j.duration || 0 };

      const args = [
        '-f', 'bestaudio/best',
        '-x', '--audio-format', 'wav',
        '--postprocessor-args', 'ExtractAudio:-ar 44100 -ac 2',
        '--no-playlist', '--newline', '--no-warnings', '--force-overwrites',
        '-o', path.join(CACHE, '%(id)s.%(ext)s'),
      ];
      if (info.duration > MAX_SECONDS) {
        args.push('--download-sections', `*0-${MAX_SECONDS}`);
        status(`Langes Video – nehme die ersten ${MAX_SECONDS / 60} Minuten`);
      }
      args.push(url);

      let lastPct = -10;
      await run('yt-dlp', args, (line) => {
        const m = line.match(/\[download\]\s+([\d.]+)%/);
        if (m) {
          const p = parseFloat(m[1]);
          if (p - lastPct >= 5 || p >= 100) { lastPct = p; ui.phase = 'DOWNLOAD'; ui.progress = p; status(`Lade … ${p.toFixed(0)} %`); }
        } else if (/ExtractAudio/.test(line)) {
          ui.phase = 'KONVERT';
          status('Konvertiere …');
        }
      });
      if (!fs.existsSync(wav)) throw new Error('WAV fehlt – ist ffmpeg installiert?');
      fs.writeFileSync(metaFile, JSON.stringify(info));
    }

    const ms = wavDurationMs(wav);
    analysis = null;
    Max.outlet('loaded', wav, ms, id, info.title);
    ui.title = info.title; ui.phase = 'ANALYSE';
    status(`Bereit: ${info.title}`);
    try {
      await ensureAnalysis(id, wav, info.title);
    } catch (e) {
      status('Tonart-Analyse fehlgeschlagen: ' + clean(e.message).slice(0, 80));
    }
  } catch (e) {
    status(errMsg(e));
  } finally {
    busy = false;
    ui.loading = false; ui.phase = ''; pushUi();
  }
}

Max.addHandler('search', (...words) => search(words.join(' ')));
Max.addHandler('text', (...words) => search(words.join(' '))); // falls textedit "text" mitsendet
Max.addHandler('pick', (idx) => {
  const r = lastResults[Math.floor(idx) - 1];   // Index 0 = Kopfzeile
  if (r) loadVideo(r.id);
  else if (lastResults.length) status('Erst einen Treffer im Menü auswählen');
});
Max.addHandler('load', (...parts) => loadVideo(parts.join('')));
Max.addHandler('maxlen', (min) => {
  const sec = Math.max(1, Math.round(min)) * 60;
  if (sec === maxLenSec) return;
  maxLenSec = sec;
  if (allResults.length) showResults();   // letzte Suche sofort neu filtern
});
Max.addHandler('analyze', (i, start, span) => sendPadInfo(Math.floor(i), start, span));
Max.addHandler('beattrack', (bpm) => sendBeats(bpm));
Max.addHandler('analyzeall', (span, ...starts) => starts.forEach((st, i) => sendPadInfo(i, st, span)));
Max.addHandler('opencache', () => spawn('open', [CACHE]));

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
  fs.writeFileSync(tmp, JSON.stringify({ version: 1, saved: new Date().toISOString(), state: pendingState }));
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
  fs.writeFileSync(lockFile(id), String(process.pid));
  let data = null;
  try { data = JSON.parse(fs.readFileSync(sessionFile(id), 'utf8')); } catch (e) { /* neu */ }
  if (data && data.state) Max.outlet('state', data.state);
  else Max.outlet('statenone');
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
// Teletext-Webseite: http://localhost:8765
// Server-Sent Events schicken den Zustand live, POST /key nimmt Tasten an.
// =====================================================================
const WEB_PORT = 8765;
const PAGE_SIZE = 7;
const WEB_DIR = path.join(os.homedir(), 'Music', 'YTSampler', 'web');
const clients = new Set();
let webPort = 0;

// Seite neben das Skript legen und nach ~/Music/YTSampler/web spiegeln
// (so findet der Server sie auch, wenn das Device eingefroren ist)
function pagePath() {
  const local = path.join(__dirname, 'teletext.html');
  const copy = path.join(WEB_DIR, 'teletext.html');
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
    title: ui.title, fav: ui.fav, message: ui.message,
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
const IR_FILE = path.join(os.homedir(), 'Music', 'YTSampler', 'ir.json');
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

Max.addHandler('favinfo', (...parts) => { ui.fav = parts.join(' '); pushUi(); });

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
      fs.readFile(pagePath(), (err, data) => {
        if (err) { res.writeHead(404); res.end('teletext.html nicht gefunden'); return; }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
        res.end(data);
      });
      return;
    }
    res.writeHead(404); res.end();
  });
  server.on('error', (e) => {
    // Port belegt (z. B. zweites Device) -> nächsten probieren
    if (e.code === 'EADDRINUSE' && tries > 0) startWeb(port + 1, tries - 1);
    else Max.post(`YT Sampler: Webserver nicht gestartet: ${e.message}`);
  });
  server.listen(port, '127.0.0.1', () => {
    webPort = port;
    Max.post(`YT Sampler: Teletext unter http://localhost:${port}`);
  });
  // Verbindung offen halten
  setInterval(() => { for (const r of clients) r.write(': ping\n\n'); }, 15000).unref();
}
startWeb(WEB_PORT, 5);

// Startcheck; Session und Längenfilter vom Device anfordern
Max.outlet('needsession');
Max.outlet('needmaxlen');
(async () => {
  try {
    const v = (await run('yt-dlp', ['--version'])).trim();
    status(`yt-dlp ${v} bereit`);
  } catch (e) {
    status(errMsg(e));
  }
})();
