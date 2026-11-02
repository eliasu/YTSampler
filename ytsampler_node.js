// YT Sampler – Node for Max Teil
// Bibliothek, Snippets, Analyse, Downloads, Session-Dateien, Webserver für den Editor.
// Protokolle zu [js] und Editor: .scratch/bank-editor/spec.md Abschnitt 3 und 6, Änderungen für 3.0 in .scratch/device-3/spec.md,
// Mix-Bänke (Video pro Pad, library.json format 2) in .scratch/mix-banks/spec.md.

const Max = require('max-api');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const https = require('https');

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
const SEARCH_FETCH = 15;  // so viele Treffer holen
const SEARCH_FAST_MS = 4000;   // direkte Suche: danach yt-dlp

const SESSIONS = path.join(DATA, 'sessions');
fs.mkdirSync(CACHE, { recursive: true });
fs.mkdirSync(SESSIONS, { recursive: true });

const status = (t) => { Max.outlet('status', t); };

// Zeichen entfernen, die in Max-Nachrichten Ärger machen
const clean = (s) => String(s || '').replace(/[,;{}\\\[\]]/g, ' ').replace(/\s+/g, ' ').trim();

// Bekannte yt-dlp-Fehler in verständliche Hinweise übersetzen. Alte yt-dlp-Versionen scheitern an YouTube mit „No video formats“ o. ä.
const YT_HINTS = [
  [/ffmpeg|ffprobe|WAV fehlt/i, 'ffmpeg fehlt → Terminal: brew install ffmpeg'],
  [/JavaScript runtime|\bdeno\b/i, 'deno fehlt → Terminal: brew install deno'],
  [/No video formats|Requested format is not available|nsig|Precondition check failed|HTTP Error 403|Sign in to confirm|latest version/i,
    'yt-dlp veraltet (YouTube verweigert den Download) → Terminal: brew upgrade yt-dlp'],
];
function errMsg(e) {
  if (e && e.code === 'ENOENT') return 'yt-dlp nicht gefunden → Terminal: brew install yt-dlp ffmpeg deno';
  const msg = clean(e && e.message ? e.message : e);
  const hint = YT_HINTS.find(([re]) => re.test(msg));
  if (hint) return 'Fehler: ' + hint[1];
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
  return { ...tempoFromOnset(onset, fps), fps, onset, bass: bassFlux };
}

// Tempo und Konfidenz allein aus der Einsatzkurve. Läuft auch beim Lesen gespeicherter Analysen,
// so gilt eine geänderte Formel ohne neues Analyseformat und ohne ganze WAV.
function tempoFromOnset(onset, fps) {
  const nf = onset.length;
  if (!(fps > 0) || nf < fps * 4) return { bpm: 0, conf: 0 };
  const env = Float64Array.from(onset);
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
  if (ac[0] <= 0) return { bpm: 0, conf: 0 };
  const prior = (bpm) => Math.exp(-0.5 * Math.pow(Math.log2(bpm / 120) / 0.6, 2));
  let best = -Infinity, bestL = 0;
  for (let L = minL; L <= maxL; L++) {
    const v = (ac[L] + 0.5 * ac[2 * L]) * prior(60 * fps / L);
    if (v > best) { best = v; bestL = L; }
  }
  // Ein Frame Raster sind bei 120 BPM ~3 BPM. Fein nachsuchen: Autokorrelation (linear interpoliert)
  // über 16 Schläge, erst grob ±3 %, dann ±0,3 BPM. Kleine Fehler würden sich über 16 Schläge aufsummieren.
  const acf = (L) => {
    const Li = Math.floor(L), fr = L - Li;
    let s = 0;
    for (let i = 0; i + Li + 1 < nf; i++) s += env[i] * (env[i + Li] * (1 - fr) + env[i + Li + 1] * fr);
    return s / (nf - L);
  };
  const K = 16;
  const comb = (bpm) => { const P = 60 * fps / bpm; let s = 0; for (let k = 1; k <= K; k++) s += acf(k * P); return s / K / ac[0]; };
  const b0 = 60 * fps / bestL;
  let bpm = b0, top = -Infinity;
  const scan = (lo, hi, step) => { for (let b = lo; b <= hi + 1e-9; b += step) { const c = comb(b); if (c > top) { top = c; bpm = b; } } };
  scan(b0 * 0.97, b0 * 1.03, 0.25);
  const mid = bpm;
  scan(mid - 0.3, mid + 0.3, 0.02);
  // Konfidenz: Wie ähnlich ist die Einsatzkurve sich selbst, 1…16 Schläge später? Unabhängig von
  // Lautstärke und Mix-Dichte. Klarer Beat ~0,5–0,9, Rauschen/Gerede ~0,01, Flächen ~0,1.
  const periodic = Math.max(0, Math.min(1, (top - 0.05) / 0.45));
  // Fast gar keine Einsätze (Flächen, Stille; Streuung < 2) zählen nicht, auch wenn sie periodisch wirken
  const strong = Math.max(0, Math.min(1, (Math.sqrt(ac[0]) - 2) / 4));
  return { bpm: Math.round(bpm * 10) / 10, conf: Math.round(periodic * strong * 100) / 100 };
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

function saveAnalysis(file, a) {
  const head = new Float32Array([AN.VERSION, a.srd, a.tuning, a.nf, a.bpm || 0, a.bpmConf || 0, a.fps || 0, a.onset.length]);
  const f32 = (x) => Buffer.from(Float32Array.from(x).buffer);
  fs.writeFileSync(file, Buffer.concat([Buffer.from(head.buffer), f32(a.onset), f32(a.bass), f32(a.frames)]));
}

// Spec 2.4: Das Format ändert sich nur abwärtskompatibel. Abgelegte Analysen (D/snippets) lassen sich
// ohne ganze WAV nicht neu rechnen. Neue Version: Felder hinten anhängen, Leser für die alten behalten.
// Versionen 1 und 2 lagen nur im Cache (neben der WAV) und werden dort neu gerechnet.
const AN_READABLE = [3];
const tempoMemo = new Map();   // Datei -> {key: Größe+mtime, t: {bpm, conf}}

function readAnalysis(file) {
  try {
    const buf = fs.readFileSync(file);
    const arr = new Float32Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length - (buf.length % 4)));
    if (!AN_READABLE.includes(arr[0])) return null;
    const nf = arr[3], no = arr[7], H = 8;
    if (arr.length !== H + 2 * no + nf * AN.STRIDE) return null;   // Version 3: nichts angehängt
    const onset = arr.subarray(H, H + no);
    // bpm/bpmConf im Kopf stammen ggf. von einer älteren Formel: aus der Einsatzkurve neu (Spec 2.4)
    let t = { bpm: Math.round(arr[4] * 10) / 10, conf: Math.round(arr[5] * 100) / 100 };
    if (no >= arr[6] * 4) {   // wie in tempoFromOnset: unter 4 s bleibt der Kopf
      const st = fs.statSync(file), key = `${st.size}:${st.mtimeMs}`, m = tempoMemo.get(file);   // ~100 ms, daher gemerkt
      if (m && m.key === key) t = m.t;
      else { t = tempoFromOnset(onset, arr[6]); tempoMemo.set(file, { key, t }); }
    }
    return { srd: arr[1], tuning: arr[2], nf, bpm: t.bpm, bpmConf: t.conf,
             fps: arr[6], onset, bass: arr.subarray(H + no, H + 2 * no),
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

function pearson(x, y) {
  let mx = 0, my = 0;
  for (let i = 0; i < 12; i++) { mx += x[i]; my += y[i]; }
  mx /= 12; my /= 12;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < 12; i++) { const a = x[i] - mx, b = y[i] - my; sxy += a * b; sxx += a * a; syy += b * b; }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : 0;
}

// Analyse eines Zeitfensters: Chroma, Tonart, Konfidenz
function analyzeWindow(a, startMs, spanMs) {
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
    // Flatness 0,5 -> voll tonal, 0,8 -> Rauschen. Gemischte Musik liegt bei 0,43–0,69, Rauschen/Hi-Hats ~0,84.
    const wt = Math.min(1, Math.max(0, (0.8 - flat) / 0.3));
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

function sendPadInfo(a, i, startMs, spanMs) {
  const r = analyzeWindow(a, startMs, spanMs);
  Max.outlet('padinfo', i, +r.conf.toFixed(3), r.tonic, r.minor, ...r.c.map((v) => +v.toFixed(4)));
}

// Ganzen Track in den Cache laden (nur noch für den Editor, ein yt-dlp nach dem anderen).
// Geladen wird unter <id>.dl.* und erst am Ende auf <id>.wav umbenannt: Ein abgebrochener
// Download hinterlässt keine halbe WAV. onPhase(phase, prozent): info | long | download | convert
async function download(id, job, onPhase) {
  const url = `https://www.youtube.com/watch?v=${id}`;
  const tmp = path.join(CACHE, `${id}.dl`);
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
    // Reste (.webm, .part, …) wegräumen
    for (const n of fs.readdirSync(CACHE)) if (n.startsWith(`${id}.dl.`)) { try { fs.unlinkSync(path.join(CACHE, n)); } catch (e) { /* weg */ } }
  }
}

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
const emptyLib = () => ({ format: 2, rev: 0, nextId: 1, banks: [], videos: {} });
const libState = (lib) => (lib.banks.length ? 'ok' : 'leer');
// Pad = {video, start} oder null (leerer Platz). Videos einer Bank, ohne Doppelte, in Pad-Reihenfolge
const padVideos = (b) => [...new Set(b.pads.filter(Boolean).map((p) => p.video))];
const isPadList = (a) => Array.isArray(a) && a.length === 16
  && a.every((p) => p === null || (isObj(p) && typeof p.video === 'string' && p.video !== '' && isInt(p.start, 0)));
// Track-Bank: 16 belegte Pads aus einem Video, sonst Mix-Bank (Mix-Spec 2.1)
const isMix = (b) => !(b.pads.every(Boolean) && padVideos(b).length === 1);
const videoEntry = (v) => { const e = { title: v.title }; if (typeof v.bpm === 'number') e.bpm = v.bpm; return e; };

// Kaputt-Regeln -> Fehlertext, '' = gültig. format 1 nach Spec 2.0, format 2 mit pads (Mix-Spec 2.1)
function libCheck(lib) {
  if (!isObj(lib) || (lib.format !== 1 && lib.format !== 2)) return 'format fehlt oder falsch';
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
    if (lib.format === 1) {
      if (typeof b.video !== 'string' || !has(lib.videos, b.video)) return at + 'video fehlt in videos';
      if (!isStarts(b.starts)) return at + 'starts nicht genau 16 ganze ms';
      continue;
    }
    if (!Array.isArray(b.pads) || b.pads.length !== 16) return at + 'pads nicht genau 16';
    for (let k = 0; k < 16; k++) {
      const p = b.pads[k];
      if (p === null) continue;
      if (!isObj(p) || typeof p.video !== 'string' || !has(lib.videos, p.video)) return at + `Pad ${k + 1}: video fehlt in videos`;
      if (!isInt(p.start, 0)) return at + `Pad ${k + 1}: start keine ganze ms`;
    }
  }
  return '';
}

// format 1 -> 2 nur im Speicher, geschrieben wird beim nächsten libChange. Übrige Felder der Bank bleiben.
function toFormat2(lib) {
  lib.format = 2;
  lib.banks = lib.banks.map(({ video, starts, ...b }) => ({ ...b, pads: starts.map((start) => ({ video, start })) }));
  return lib;
}

// -> {state: ok|leer|kaputt|neuer, lib (null bei kaputt/neuer), error, text (Dateiinhalt, null wenn keine Datei)}
function libParse(text) {
  let lib;
  try { lib = JSON.parse(text); } catch (e) { return { state: 'kaputt', lib: null, error: 'kein gültiges JSON', text }; }
  if (isObj(lib) && typeof lib.format === 'number' && lib.format > 2) return { state: 'neuer', lib: null, error: `format ${lib.format}`, text };
  const error = libCheck(lib);
  if (error) return { state: 'kaputt', lib: null, error, text };
  if (lib.format === 1) toFormat2(lib);
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

// videos-Eintrag ohne Pad: bleibt während der Sitzung (Undo), fällt erst beim Start weg (keepCleanup)
function dropOrphans(lib) {
  const used = new Set(lib.banks.flatMap(padVideos));
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
  // Bank aus einem Video am Ende (Tests, Migration), ein schon bekanntes Video behält Titel und bpm
  create(lib, { video, title, name, starts }) {
    need(typeof video === 'string' && video !== '' && isStarts(starts));
    if (!has(lib.videos, video)) lib.videos[video] = { title: String(title || '') };
    const id = lib.nextId++;
    lib.banks.push({ id, name: bankName(name === undefined ? lib.videos[video].title : name), pads: starts.map((start) => ({ video, start })) });
    return { id };
  },
  // Neue Bank: 16 leere Plätze am Ende (Flow-Nachtrag: jede neue Bank startet leer)
  newmix(lib) {
    const id = lib.nextId++;
    lib.banks.push({ id, name: 'Neue Bank', pads: Array(16).fill(null) });
    return { id };
  },
  // Pad kopieren (video + start) oder Platz leeren (video null). Unbekanntes Video braucht info {title, bpm?}
  setpad(lib, { id, pad, video, start, info }) {
    const i = bankIndex(lib, id);
    need(isPad(pad));
    if (video === null) { lib.banks[i].pads[pad] = null; return; }
    need(typeof video === 'string' && video !== '' && isInt(start, 0));
    if (!has(lib.videos, video)) {
      need(isObj(info) && typeof info.title === 'string');
      lib.videos[video] = videoEntry(info);
    }
    lib.banks[i].pads[pad] = { video, start };
  },
  // beim Start: videos-Einträge ohne Pad weg
  prune(lib) { dropOrphans(lib); },
  // fillpads: mehrere Plätze aus einem Video in einem Schritt
  fill(lib, { id, pads, video, starts, info }) {
    need(Array.isArray(pads) && Array.isArray(starts) && pads.length === starts.length);
    pads.forEach((pad, k) => LIB.setpad(lib, { id, pad, video, start: starts[k], info }));
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
    const videos = {};
    for (const v of padVideos(bank)) videos[v] = videoEntry(lib.videos[v]);
    return { removed: { bank, at: i + 1, videos } };
  },
  move(lib, { id, to }) {
    const i = bankIndex(lib, id);
    need(isInt(to, 1) && to <= lib.banks.length);
    lib.banks.splice(to - 1, 0, lib.banks.splice(i, 1)[0]);
  },
  // Undo von delete: alte ID, nextId bleibt
  restore(lib, { bank, at, videos }) {
    need(isObj(bank) && isInt(bank.id, 1) && typeof bank.name === 'string' && isPadList(bank.pads) && isInt(at, 1));
    if (bank.id >= lib.nextId || lib.banks.some((b) => b.id === bank.id)) throw libErr('idtaken');
    for (const v of padVideos(bank)) {
      if (has(lib.videos, v)) continue;
      need(isObj(videos) && isObj(videos[v]) && typeof videos[v].title === 'string');
      lib.videos[v] = videoEntry(videos[v]);
    }
    const b = JSON.parse(JSON.stringify(bank));
    lib.banks.splice(Math.min(at, lib.banks.length + 1) - 1, 0, b);
  },
  // leerer Platz -> badreq
  setstart(lib, { id, pad, ms }) {
    const i = bankIndex(lib, id);
    need(isPad(pad) && isInt(ms, 0) && lib.banks[i].pads[pad]);
    lib.banks[i].pads[pad].start = ms;
  },
  // Starts der belegten Pads, bei leeren wird der Wert ignoriert
  setstarts(lib, { id, starts }) {
    const i = bankIndex(lib, id);
    need(isStarts(starts));
    lib.banks[i].pads.forEach((p, k) => { if (p) p.start = starts[k]; });
  },
  // tauscht ganze Pad-Einträge, auch leere
  swap(lib, { id, a, b }) {
    const i = bankIndex(lib, id);
    need(isPad(a) && isPad(b));
    const s = lib.banks[i].pads;
    [s[a], s[b]] = [s[b], s[a]];
  },
  // tempo und tempook aus dem Editor: bestätigtes Tempo des Videos
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
const SNIP_DEBOUNCE = 150;
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

// Snippet-.json lesen -> {pads, lens, durs}. Alte Form {video, starts, lens, dur} gilt als Pads aus einem Video
// (Mix-Spec 2.2), sie bleibt aktuell und wird nicht neu geschnitten. null = fehlt oder unlesbar.
function readSnip(id) {
  const j = readJson(snipJson(id));
  if (!isObj(j) || !Array.isArray(j.lens) || j.lens.length !== 16) return null;
  if (isPadList(j.pads)) return { pads: j.pads, lens: j.lens, durs: isObj(j.durs) ? j.durs : {} };
  if (typeof j.video === 'string' && isStarts(j.starts)) {
    return { pads: j.starts.map((start) => ({ video: j.video, start })), lens: j.lens, durs: typeof j.dur === 'number' ? { [j.video]: j.dur } : {} };
  }
  return null;
}
const samePad = (a, b) => (a && b ? a.video === b.video && a.start === b.start : !a && !b);

// aktuell = Pads der .json gleich den Pads der Bank
function snipCurrent(bank) {
  const j = readSnip(bank.id);
  return !!j && bank.pads.every((p, i) => samePad(p, j.pads[i])) && fs.existsSync(snipWav(bank.id));
}

// Für SSE lib: banks[].snip und .wav = alle Videos der Bank im Cache (videos[].fail steht in videoFail)
function snipStatus(bank) {
  const snip = snipCutting === bank.id ? 'cutting' : snipTimers.has(bank.id) ? 'stale'
    : snipCurrent(bank) ? 'ok' : fs.existsSync(snipJson(bank.id)) ? 'stale' : 'missing';
  return { snip, wav: padVideos(bank).every(hasWav) };
}

// Fach mit gleichem {video, start} in einer Snippet-Datei: erst die eigene Bank, dann die übrigen der Bibliothek.
// memo: Map bankId -> {j, w} (eine Suche liest jede Datei nur einmal). -> {id, k, j, w} oder null
function findSlot(p, bankId, memo) {
  const ids = [bankId, ...(libNow.lib ? libNow.lib.banks.map((b) => b.id).filter((x) => x !== bankId) : [])];
  for (const id of ids) {
    if (!memo.has(id)) {
      const j = readSnip(id);
      let w = null;
      if (j) { try { w = wavInfo(snipWav(id)); } catch (e) { /* keine WAV */ } }
      memo.set(id, w ? { j, w } : null);
    }
    const m = memo.get(id);
    const k = m ? m.j.pads.findIndex((q) => samePad(p, q)) : -1;
    if (k >= 0) return { id, k, ...m };
  }
  // Ablage (geleerte/überschriebene Pads, Flow-Nachtrag): ein Fach pro {video, start}
  const kb = keepBase(p), kj = kb && readJson(kb + '.json');
  if (isObj(kj) && isInt(kj.len, 0)) {
    try { return { file: kb + '.wav', k: 0, j: { lens: [kj.len], durs: typeof kj.dur === 'number' ? { [p.video]: kj.dur } : {} }, w: wavInfo(kb + '.wav') }; } catch (e) { /* WAV fehlt */ }
  }
  return null;
}

// Ablage D/snippets/keep/<video>_<start>.wav (+ .json {len, dur}): Audio eines Pads, das geleert oder überschrieben
// wird. So geht Undo auch ohne ganzen Track im Cache. Aufgeräumt nur beim Start (keepCleanup).
const KEEP_DIR = path.join(SNIP_DIR, 'keep');
const keepBase = (p) => (/^[\w-]{11}$/.test(p.video) ? path.join(KEEP_DIR, `${p.video}_${p.start}`) : null);
function keepPad(p, bankId) {
  const kb = p && keepBase(p);
  if (!kb || fs.existsSync(kb + '.json')) return;
  const tmp = path.join(KEEP_DIR, `keep.${process.pid}.tmp`);
  try {
    const src = snipSource({ id: bankId, pads: [p, ...Array(15).fill(null)] });
    if (!src) return;   // keine Quelle: dann ging es vorher auch nicht
    const [file, pos, bytes] = src.slots[0], buf = Buffer.alloc(SLOT_BYTES);
    const fd = fs.openSync(file, 'r');
    try { fs.readSync(fd, buf, 0, bytes, pos); } finally { fs.closeSync(fd); }
    fs.mkdirSync(KEEP_DIR, { recursive: true });
    fs.writeFileSync(tmp, Buffer.concat([wavHeader(SLOT_BYTES), buf]));
    fs.renameSync(tmp, kb + '.wav');
    fs.writeFileSync(tmp, JSON.stringify({ len: src.lens[0], dur: src.durs[p.video] }));
    fs.renameSync(tmp, kb + '.json');
  } catch (e) {
    try { fs.unlinkSync(tmp); } catch (e2) { /* weg */ }
    Max.post(`YT Sampler: Pad nicht abgelegt: ${e.message}`);
  }
}

// Beim Start: Ablage, Analysen in D (.chroma) und videos-Einträge, die kein Pad irgendeiner Bank mehr braucht.
// Der Cache in L bleibt, Snippets gelöschter Bänke regelt snipCleanup (7 Tage).
function keepCleanup() {
  if (!libNow.lib) return;
  const pads = libNow.lib.banks.flatMap((b) => b.pads.filter(Boolean));
  const used = new Set(pads.map((p) => p.video)), keep = new Set(pads.map((p) => `${p.video}_${p.start}`));
  const rm = (f) => { try { fs.unlinkSync(f); } catch (e) { /* weg */ } };
  let names = [];
  try { names = fs.readdirSync(KEEP_DIR); } catch (e) { /* keine Ablage */ }
  for (const n of names) { const m = /^(.+_\d+)\.(wav|json)$/.exec(n); if (m && !keep.has(m[1])) rm(path.join(KEEP_DIR, n)); }
  for (const n of fs.readdirSync(SNIP_DIR)) { const m = /^(.+)\.chroma$/.exec(n); if (m && !used.has(m[1])) rm(path.join(SNIP_DIR, n)); }
  if (Object.keys(libNow.lib.videos).some((v) => !used.has(v))) libChange('prune', {}, 'start');
}
// Gibt es für ein Pad eine Quelle zum Schneiden (ganze WAV oder ein passendes Fach)?
const padSource = (p, bankId, memo = new Map()) => hasWav(p.video) || !!findSlot(p, bankId, memo);

// Quelle pro Fach (Mix-Spec 2.2): ganze WAV des Videos, sonst ein Fach mit gleichem {video, start} in der alten
// Snippet-Datei derselben Bank, sonst in der einer anderen Bank. Leerer Platz: Stille. null = ein Pad ohne Quelle (playonly).
// -> {slots[i] = [Datei, Byte-Position, Bytes] | null, lens, durs, whole = Videos aus ganzer WAV}
function snipSource(bank) {
  const memo = new Map(), whole = new Map();
  const lens = [], slots = [], durs = {};
  for (const p of bank.pads) {
    if (!p) { lens.push(0); slots.push(null); continue; }
    if (hasWav(p.video)) {
      if (!whole.has(p.video)) {
        const w = wavInfo(cacheWav(p.video));
        if (w.sr !== SNIP_SR || w.channels !== 2 || w.bits !== 16) throw libErr('cutfail', 'Track nicht 44,1 kHz/16 Bit/Stereo');
        const frames = Math.floor(w.dataSize / BPF);
        whole.set(p.video, { w, frames, dur: Math.round(frames * 1000 / SNIP_SR) });
      }
      const x = whole.get(p.video), f = Math.min(x.frames, Math.round(p.start * SNIP_SR / 1000));
      durs[p.video] = x.dur;
      lens.push(Math.max(0, Math.min(SNIP_MS, x.dur - p.start)));
      slots.push([cacheWav(p.video), x.w.offset + f * BPF, Math.min(SLOT_BYTES, (x.frames - f) * BPF)]);
      continue;
    }
    const s = findSlot(p, bank.id, memo);
    if (!s) return null;
    if (!has(durs, p.video) && typeof s.j.durs[p.video] === 'number') durs[p.video] = s.j.durs[p.video];
    lens.push(s.j.lens[s.k]);
    slots.push([s.file || snipWav(s.id), s.w.offset + s.k * SLOT_BYTES, Math.max(0, Math.min(SLOT_BYTES, s.w.dataSize - s.k * SLOT_BYTES))]);
  }
  return { slots, lens, durs, whole: [...whole.keys()] };
}

// Schneidet die Snippets einer Bank, synchron. Erst die WAV, dann die .json, beide über <id>.<pid>.tmp.
// Wirft libErr playonly oder cutfail.
function cutSnippets(bank) {
  clearTimeout(snipTimers.get(bank.id));
  snipTimers.delete(bank.id);
  const job = (phase) => libEvents.emit('job', { kind: 'cut', bankId: bank.id, video: padVideos(bank)[0] || '-', phase, progress: phase === 'done' ? 100 : 0, left: 0 });
  let src;
  try { src = snipSource(bank); } catch (e) { throw e.code === 'cutfail' ? e : libErr('cutfail', clean(e.message).slice(0, 80)); }
  if (!src) throw libErr('playonly');
  const tmp = path.join(SNIP_DIR, `${bank.id}.${process.pid}.tmp`);
  snipCutting = bank.id;
  job('cut');
  const fds = new Map();
  const fd = (f) => { if (!fds.has(f)) fds.set(f, fs.openSync(f, 'r')); return fds.get(f); };
  try {
    const out = fs.openSync(tmp, 'w');
    try {
      fs.writeSync(out, wavHeader(16 * SLOT_BYTES), 0, 44, 0);
      const buf = Buffer.alloc(SLOT_BYTES);
      src.slots.forEach((sl, i) => {
        buf.fill(0);
        if (sl && sl[2] > 0) fs.readSync(fd(sl[0]), buf, 0, sl[2], sl[1]);
        fs.writeSync(out, buf, 0, SLOT_BYTES, 44 + i * SLOT_BYTES);
      });
    } finally {
      fs.closeSync(out);
      for (const f of fds.values()) fs.closeSync(f);
    }
    fs.renameSync(tmp, snipWav(bank.id));
    const pads = bank.pads.map((p) => (p ? { video: p.video, start: p.start } : null));
    fs.writeFileSync(tmp, JSON.stringify({ pads, lens: src.lens, durs: src.durs }));
    fs.renameSync(tmp, snipJson(bank.id));
  } catch (e) {
    try { fs.unlinkSync(tmp); } catch (e2) { /* weg */ }
    job('fail');
    throw libErr('cutfail', clean(e.message).slice(0, 80));
  } finally {
    snipCutting = 0;
  }
  // Analyse pro Video mit ganzer WAV einmal neben die Snippets legen (Spec 2.4)
  for (const v of src.whole) { try { getAnalysis(v, true); } catch (e) { Max.post(`YT Sampler: Analyse fehlgeschlagen: ${e.message}`); } }
  job('done');
  libEvents.emit('status');
}

// select/banksel/bankopen: veraltete oder fehlende Snippets sofort schneiden.
// -> {path, pads, lens, durs} aus der .json. Geht das Schneiden nicht, spielt die alte Datei weiter.
// Ohne Snippet-Datei: libErr nosnip (keine Quelle) bzw. cutfail.
function snipEnsure(bank) {
  let err = null;
  if (!snipCurrent(bank)) { try { cutSnippets(bank); } catch (e) { err = e; } }
  const j = readSnip(bank.id);
  if (!j || !fs.existsSync(snipWav(bank.id))) throw err && err.code !== 'playonly' ? err : libErr('nosnip');
  return { path: snipWav(bank.id), ...j };
}

// Neu schneiden, kurz nach der letzten Änderung der Bank
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
    if ((video && !padVideos(b).includes(video)) || snipCurrent(b)) continue;
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

// Würfeln auf der ganzen WAV: immer aufs Raster, solange Beats da sind (auch bei unsicherem Tempo, es wird ja
// kuratiert): erst Taktanfänge, dann Schläge, frei nur ohne Beats. Keine Slice (16 s) ganz in Stille, kein Start doppelt.
// -> (belegte Starts) => ganze ms. Ohne WAV libErr playonly.
function roller(v) {
  if (!hasWav(v)) throw libErr('playonly');
  const last = wavDurationMs(cacheWav(v)) - SNIP_MS;
  const a = getAnalysis(v, false);
  const sil = a ? silentRanges(a) : [];
  const b = beatsOf(v, a);
  const usable = b.beats.length >= 4 ? b.beats.filter((t) => t <= last) : [];
  const bars = usable.filter((t) => (b.beats.indexOf(t) - b.down) % 4 === 0);
  const silent = (t) => {
    for (let k = 0; k + 1 < sil.length; k += 2) if (sil[k] <= t && t + SNIP_MS <= sil[k + 1]) return true;
    return false;
  };
  return (taken) => {
    const free = (pool) => pool.map(Math.round).filter((t) => !silent(t) && !taken.includes(t));
    for (const pool of [bars, usable]) {
      const c = free(pool);
      if (c.length) return c[Math.floor(Math.random() * c.length)];
    }
    if (usable.length) return Math.round(usable[Math.floor(Math.random() * usable.length)]);   // alles belegt oder still: lieber doppelt als neben dem Raster
    let t = 0;
    for (let n = 0; n < 40; n++) {
      t = last > 0 ? Math.round(Math.random() * last) : 0;
      if (!silent(t) && !taken.includes(t)) return t;
    }
    return t;
  };
}
// roll: ein Pad neu, belegt = die 16 Starts der Bank (auch der eigene, damit sich etwas ändert)
const rollStart = (v, taken) => roller(v)(taken);
// fillpads: n Starts, aufsteigend, keiner aus taken und keiner doppelt
function rollBank(v, n = 16, taken = []) {
  const r = roller(v), s = [];
  for (let i = 0; i < n; i++) s.push(r([...taken, ...s]));
  return s.sort((x, y) => x - y);
}

// =====================================================================
// Downloads im Editor-Weg (Spec 3.1). kind: select | fetch | pads | fetchall.
// Bis ED_PAR Downloads laufen gleichzeitig, der Rest wartet (Phase „queue“). Reihenfolge der Warteschlange:
// select/fetch vor pads vor fetchall. Sind alle Plätze belegt, bricht ein neues select/fetch den laufenden
// mit der niedrigsten Stufe ab (unter select/fetch den ältesten), ebenso jeder Wunsch höherer Stufe;
// der abgebrochene wartet dann wieder. Unter select/fetch gewinnt der neueste, pads und fetchall der Reihe nach.
// Fehlschlag setzt videoFail, fetchall überspringt solche Videos.
// onPhase (optional, fillPads): Fortschritt geht an den Aufrufer statt als job kind fetch.
// Achtung Aufrufer: fetchVideo-Promise immer mit catch, sonst beendet ein Fehlschlag den Node-Prozess.
// =====================================================================
const FETCH_PRIO = { select: 0, fetch: 0, pads: 1, fetchall: 2 };
const ED_PAR = 3;
const edQueue = [], edJobs = [];
let edSeq = 0;

// Fortschritt an alle, die auf dieses Video warten
function edPhase(e, phase, progress) {
  if (e.waiters.some((w) => !w.onPhase)) libEvents.emit('job', { kind: 'fetch', video: e.video, phase, progress, left: edQueue.length });
  e.waiters.forEach((w) => w.onPhase && w.onPhase(phase, progress));
}

function fetchVideo(video, kind, onPhase) {
  const prio = FETCH_PRIO[kind];
  return new Promise((resolve, reject) => {
    let e = edJobs.find((x) => x.video === video) || edQueue.find((x) => x.video === video);
    if (e) { e.prio = Math.min(e.prio, prio); if (!prio) e.seq = ++edSeq; e.waiters.push({ resolve, reject, onPhase }); }
    else { e = { video, prio, seq: ++edSeq, waiters: [{ resolve, reject, onPhase }] }; edQueue.push(e); }
    if (edJobs.includes(e)) return;
    if (edJobs.length >= ED_PAR) {
      const v = edJobs.reduce((a, b) => (b.prio > a.prio || (b.prio === a.prio && b.seq < a.seq) ? b : a));
      if (e.prio < v.prio || e.prio + v.prio === 0) abort(v);   // edRun reiht ihn wieder ein und startet den nächsten
    } else edNext();
    if (edQueue.includes(e)) edPhase(e, 'queue', 0);
  });
}

function edNext() {
  edQueue.sort((a, b) => a.prio - b.prio || (a.prio ? a.seq - b.seq : b.seq - a.seq));
  while (edJobs.length < ED_PAR && edQueue.length) edRun(edQueue.shift());
}

async function edRun(e) {
  edJobs.push(e); e.aborted = false; e.child = null;
  const drop = () => edJobs.splice(edJobs.indexOf(e), 1);
  if (has(videoFail, e.video)) { delete videoFail[e.video]; libEvents.emit('status'); }
  try {
    const info = await download(e.video, e, (ph, p) => { if (!e.aborted) edPhase(e, ph, p); });
    drop();
    if (e.waiters.some((w) => !w.onPhase)) libEvents.emit('job', { kind: 'fetch', video: e.video, phase: 'done', progress: 100, left: edQueue.length });   // fillpads meldet selbst weiter
    libEvents.emit('cache', cacheSize());
    libEvents.emit('status');
    snipRefresh(e.video);
    e.waiters.forEach((w) => w.resolve(info));
  } catch (err) {
    drop();
    if (e.aborted) { edQueue.push(e); edPhase(e, 'queue', 0); }
    else {
      const reason = errMsg(err).replace(/^Fehler: /, '');
      videoFail[e.video] = reason;
      const title = libNow.lib && libNow.lib.videos[e.video] ? libNow.lib.videos[e.video].title : e.video;
      const le = libErr('loadfail', `${title} – ${reason}`);
      edPhase(e, 'fail', 0);
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
  const todo = [...new Set(libNow.lib.banks.flatMap(padVideos))].filter((v) => !hasWav(v) && !has(videoFail, v));
  todo.forEach((v) => fetchVideo(v, 'fetchall').catch(() => { /* steht in videoFail */ }));
  return { todo: todo.length };
}

// fillpads (Flow-Nachtrag): Track laden → Analyse → pro Platz würfeln (Taktanfang, keine Stille, kein Start doppelt
// mit den übrigen Pads dieses Videos) → Plätze überschreiben. Schneiden und neu Laden macht libChange wie bei setpad.
// Fortschritt als job {kind: 'pads', tag, id, video, pads, phase, progress}; done bringt before/after (Pad-Einträge der
// Plätze vorher/nachher) und videos (Titel/bpm dazu) fürs Undo. Wirft libErr (loadfail, nobank, libbroken, …).
async function fillPads(q, by) {
  const job = (phase, progress, extra) => libEvents.emit('job', { kind: 'pads', tag: q.tag, id: q.id, video: q.video, pads: q.pads, phase, progress, left: edQueue.length, ...extra });
  try {
    const info = (hasWav(q.video) && readJson(path.join(CACHE, `${q.video}.json`))) || await fetchVideo(q.video, 'pads', job);
    job('analyse', 0);
    await new Promise((r) => setTimeout(r, 0));
    const b = libBank(q.id);
    const taken = b.pads.filter((p, k) => p && p.video === q.video && !q.pads.includes(k)).map((p) => p.start);
    const starts = rollBank(q.video, q.pads.length, taken);
    const before = q.pads.map((k) => (b.pads[k] ? { ...b.pads[k] } : null));
    const videos = {};
    for (const p of before) if (p && has(libNow.lib.videos, p.video)) videos[p.video] = videoEntry(libNow.lib.videos[p.video]);
    before.forEach((p) => keepPad(p, q.id));
    libChange('fill', { id: q.id, pads: q.pads, video: q.video, starts, info: { title: info.raw || info.title || q.video } }, by);
    videos[q.video] = videoEntry(libNow.lib.videos[q.video]);
    job('done', 100, { before, after: starts.map((start) => ({ video: q.video, start })), videos });
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
let dev = { bankId: 0, sel: 0, starts: [], spans: [], params: null };   // letzter bankstate
let activeId = 0;
let track = '';            // Spurname für hello
let libBy = 'extern';      // by der letzten Bibliotheksänderung (SSE lib)
let sending = false;       // sendBank schneidet gerade selbst
let activeSnip = '';       // .json der aktiven Bank beim Laden (zweites Device schneidet -> neu laden)
let loaded = { pads: [], lens: [] };   // Pads und Längen, wie zuletzt mit bank ans Device geschickt
let anaMap = new Map();    // video -> Analyse (null = fehlt) für die Videos der geladenen Bank (Mix-Spec 2.3)
let anaSeq = 0;            // neuere Bank bricht eine laufende Analyse ab
const ANALYSIS_MS = 4000;  // Analysefenster pro Pad ab Start (padinfo)

const libBroken = () => libErr(libNow.state === 'neuer' ? 'libnewer' : 'libbroken');
const bankById = (id) => (libNow.lib ? libNow.lib.banks.find((b) => b.id === id) : null);
const bankNr = (id) => (libNow.lib ? libNow.lib.banks.findIndex((b) => b.id === id) + 1 : 0);
const readText = (f) => { try { return fs.readFileSync(f, 'utf8'); } catch (e) { return ''; } };

// Bank ins Device: bankname, bank <id> <nr> <s×16> <l×16> <pfad…>, danach die Analyse pro Pad (Mix-Spec 3.3).
// Ohne Snippets bankfail an [js] und libErr.
function sendBank(b) {
  let s;
  sending = true;
  try { s = snipEnsure(b); } catch (e) { Max.outlet('bankfail', b.id, clean(e.text || e.message)); throw e; } finally { sending = false; }
  if (activeId !== b.id) fs.unwatchFile(snipJson(activeId), onActiveSnip);
  fs.watchFile(snipJson(b.id), { interval: 500 }, onActiveSnip);   // doppelt angemeldet zählt einmal
  activeId = b.id;
  activeSnip = readText(snipJson(b.id));
  loaded = { pads: s.pads, lens: s.pads.map((p, i) => (p ? s.lens[i] : 0)) };
  Max.outlet('bankname', b.id, clean(b.name));
  Max.outlet('bank', b.id, bankNr(b.id), ...s.pads.map((p) => (p ? p.start : 0)), ...loaded.lens, s.path);
  sendAnalysis(clean(b.name)).catch((e) => status('Tonart-Analyse fehlgeschlagen: ' + clean(e.message).slice(0, 80)));
  edDirty('device'); edDirty('beats');
}

// padana <i> <bpm> <cent> <off> <beats…>: Tempo, Stimmung und Schläge des Videos von Pad i.
// bpm: bestätigt, sonst Analyse, sonst 0. beats: Song-ms in [start − 4 Schläge, start + l + 4 Schläge],
// off = Index des ersten gesendeten Schlags ab der ersten „1“. Leerer Platz: nichts.
function sendPadana(i) {
  const p = loaded.pads[i];
  if (!p) return;
  const a = anaMap.get(p.video) || null;
  const b = beatsOf(p.video, a);
  let beats = [], off = 0;
  if (b.bpm > 0 && b.beats.length) {
    const edge = 4 * 60000 / b.bpm, from = p.start - edge, to = p.start + loaded.lens[i] + edge;
    const k0 = b.beats.findIndex((t) => t >= from);
    if (k0 >= 0) {
      beats = b.beats.slice(k0).filter((t) => t <= to);
      off = beats.length ? k0 - b.down : 0;
    }
  }
  Max.outlet('padana', i, b.bpm, a ? Math.round(a.tuning * 100) : 0, off, ...beats);
}

// Analyse pro Video der geladenen Bank: aus D/snippets, sonst Cache bzw. ganze WAV. Dann padana und padinfo
// pro belegtem Pad, analysisready, Status.
async function sendAnalysis(name) {
  const seq = ++anaSeq;
  await new Promise((r) => setImmediate(r)); // "bank" zuerst rausschicken
  const map = new Map();
  const vids = [...new Set(loaded.pads.filter(Boolean).map((p) => p.video))];
  for (const v of vids) {
    let a = readAnalysis(chromaBank(v));
    if (!a) {
      if (hasWav(v)) {
        status('Analysiere Tonart …');
        await new Promise((r) => setTimeout(r, 20));
        if (seq !== anaSeq) return;
      }
      try { a = getAnalysis(v, true); } catch (e) { Max.post(`YT Sampler: Analyse fehlgeschlagen: ${e.message}`); }
    }
    map.set(v, a || null);
  }
  if (seq !== anaSeq) return;
  anaMap = map;
  for (let i = 0; i < 16; i++) sendPadana(i);
  loaded.pads.forEach((p, i) => { const a = p && map.get(p.video); if (a) sendPadInfo(a, i, p.start, ANALYSIS_MS); });
  Max.outlet('analysisready');
  const missing = loaded.pads.filter((p) => p && !map.get(p.video)).length;
  const a = map.get(vids[0]);
  if (missing) status(`Analyse fehlt bei ${missing} Pads – im Editor neu schneiden`);
  else if (vids.length === 1 && loaded.pads.every(Boolean)) {
    const cents = Math.round(a.tuning * 100);
    const tempoTxt = a.bpm ? ` · ${a.bpm} BPM${a.bpmConf < 0.3 ? ' (unsicher)' : ''}` : '';
    status(`Bereit: ${name}${tempoTxt} · Stimmung ${cents >= 0 ? '+' : ''}${cents} ct`);
  } else status(`Bereit: ${name} · ${vids.length ? vids.length + (vids.length === 1 ? ' Track' : ' Tracks') : 'leer'}`);
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
// Tempo-Korrektur im Editor: padana für alle geladenen Pads mit diesem Video noch einmal
const bpmToDevice = (v) => { if (activeId) loaded.pads.forEach((p, i) => { if (p && p.video === v) sendPadana(i); }); };
// Video des gewählten Pads der aktiven Bank, '-' bei leerem Platz oder ohne Bank
const devVideo = () => { const b = bankById(activeId), p = b && b.pads[dev.sel]; return p ? p.video : '-'; };

// Aktive Bank wird gleich neu geschnitten: [js] hält Anschläge zurück, bis die neuen Snippets im Buffer sind
function busyIfStale(by) {
  const b = bankById(activeId);
  if (!b || by === 'extern' || snipCurrent(b)) return;
  let ok;
  try { ok = !!snipSource(b); } catch (e) { ok = false; }
  if (ok) Max.outlet('bankbusy');
}
libEvents.on('change', (stand, by) => { busyIfStale(by); libBy = by; sendLibstate(); edDirty('lib'); edDirty('device'); edDirty('beats'); });
libEvents.on('status', () => edDirty('lib'));
libEvents.on('cache', () => edDirty('cache'));
libEvents.on('job', (j) => edEmit('job', j));
libEvents.on('msg', (m) => edEmit('msg', m));

// ---------- [js] -> Node (6.2, Spec 3.0 3.2) ----------
// bankstate <bankId> <sel> <mode> <rev> <s×16> <w×16> <div> <rate> <tune> <warp> <quant> <vol> <voices> <base> <qdiv> <qcatch>
Max.addHandler('bankstate', (id, sel, mode, rev, ...sw) => {
  const p = sw.slice(32, 42);
  const params = p.length === 10 ? { div: p[0], rate: p[1], mode, rev, tune: p[2], warp: p[3], quant: p[4], vol: p[5], voices: p[6], base: p[7], qdiv: p[8], qcatch: p[9] } : null;
  dev = { bankId: Math.floor(id) || 0, sel, starts: sw.slice(0, 16), spans: sw.slice(16, 32), params };
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
// Button „Editor“ im Device: Editor dieses Devices im Standardbrowser öffnen
Max.addHandler('openeditor', () => {
  if (!webPort) { status('Editor-Server läuft nicht'); return; }
  const p = spawn('open', [`http://localhost:${webPort}/editor`], { env: ENV });
  p.on('error', () => status('Browser lässt sich nicht öffnen'));
});
// Device ohne Bank (Spec 3.0 4.5): wie banksel, aber hinter der letzten Bank die letzte. Leer/kaputt: nichts.
Max.addHandler('bankload', (nr) => {
  const L = libNow.lib ? libNow.lib.banks : [];
  if (!L.length) return;
  trySend(L[Math.min(Math.max(1, Math.floor(nr) || 1), L.length) - 1]);
});
Max.addHandler('bankopen', (id) => {
  if (!libNow.lib) return;   // kaputt: [js] fragt wieder, sobald libstate ok kommt
  const b = bankById(Math.floor(id));
  if (b) trySend(b); else Max.outlet('bankgone', Math.floor(id));
});
Max.addHandler('playing', (pad, from, to, dur) => edEmit('play', { pad, from, to, dur, video: (loaded.pads[pad] && loaded.pads[pad].video) || '-' }));
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
// belegtes Pad q.pad der Bank q.id, leerer Platz -> badreq
function libPad(q) {
  const b = libBank(q.id);
  need(isPad(q.pad) && b.pads[q.pad]);
  return { b, p: b.pads[q.pad] };
}

// Direkte Suche über die YouTube-Ergebnisseite (unter 1 s). Die Seite kann sich ändern: Dann bleibt der Rückfall auf yt-dlp.
function parseSearchPage(html) {
  const i = html.indexOf('var ytInitialData = '), j = html.indexOf(';</script>', i);
  if (i < 0 || j < 0) return [];
  const out = [];
  const walk = (o) => {
    if (Array.isArray(o)) { o.forEach(walk); return; }
    if (!o || typeof o !== 'object') return;
    if (o.videoRenderer) {
      const v = o.videoRenderer, len = v.lengthText && v.lengthText.simpleText;
      const title = v.title && (v.title.simpleText || (v.title.runs || []).map((r) => r.text).join(''));
      out.push({ id: v.videoId, title, duration: len ? len.split(':').reduce((s, x) => s * 60 + +x, 0) : 0 });
      return;
    }
    Object.values(o).forEach(walk);
  };
  walk(JSON.parse(html.slice(i + 20, j)));
  return out;
}
function fastSearch(q, job) {
  return new Promise((resolve, reject) => {
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}&sp=EgIQAQ%3D%3D`;   // sp: nur Videos
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
      'Accept-Language': 'en', Cookie: 'CONSENT=YES+1; SOCS=CAI' }, timeout: SEARCH_FAST_MS }, (res) => {
      if (res.statusCode !== 200) { res.resume(); reject(new Error(`HTTP ${res.statusCode}`)); return; }
      let b = '';
      res.setEncoding('utf8');
      res.on('data', (d) => { b += d; });
      res.on('error', reject);
      res.on('end', () => { try { resolve(parseSearchPage(b)); } catch (e) { reject(e); } });
    });
    req.on('timeout', () => req.destroy(new Error('Zeitüberschreitung')));
    req.on('error', reject);
    job.child = { kill: () => req.destroy(new Error('abgebrochen')) };
  });
}
// Treffer ohne Dauer (live) fallen weg
const searchResults = (list) => list.filter((e) => e && e.id && e.duration > 0)
  .map((e) => ({ id: e.id, title: String(e.title || e.id), dur: Math.round(e.duration), long: e.duration > MAX_SECONDS }));

// Editor-Suche: eigene Trefferliste, neue Suche bricht die alte ab. URL oder ID -> genau dieses Video.
let edSearchJob = null;
async function edSearch(q) {
  need(typeof q === 'string');
  if (edSearchJob) abort(edSearchJob);
  const job = edSearchJob = { aborted: false, child: null };
  const id = extractId(q);
  try {
    if (!id && !process.env.YTS_NO_FAST_SEARCH) {
      try {
        const r = searchResults(await fastSearch(q.trim(), job)).slice(0, SEARCH_FETCH);
        if (r.length) return { results: r };
      } catch (e) { if (job.aborted) throw e; }
      job.child = null;
    }
    const out = await run('yt-dlp', id ? ['-J', '--no-playlist', '--no-warnings', `https://www.youtube.com/watch?v=${id}`]
      : ['--flat-playlist', '--dump-single-json', '--no-warnings', `ytsearch${SEARCH_FETCH}:${q.trim()}`], null, job);
    const data = JSON.parse(out);
    return { results: searchResults(id ? [data] : data.entries || []) };
  } catch (e) {
    if (job.aborted) throw libErr('superseded');
    throw libErr('searchfail', errMsg(e).replace(/^Fehler: /, ''));
  } finally {
    if (edSearchJob === job) edSearchJob = null;
  }
}

// Device-Regler (Spec 3.0 3.1): name -> [min, max, ganz]. Toggles 0/1.
const PARAMS = {
  div: [0, 10, true], rate: [0.25, 2, false], mode: [0, 1, true], rev: [0, 1, true], tune: [0, 1, true],
  warp: [0, 1, true], quant: [0, 1, true], qdiv: [0, 3, true], qcatch: [0, 1, true], vol: [-70, 6, false], voices: [0, 6, true], base: [0, 127, true],
};

// (Felder, client) -> Antwortfelder, wirft libErr
const CMD = {
  // fehlende WAVs aller Videos der Bank laden, das des gewählten Pads mit Vorrang, die übrigen im Hintergrund
  select(q) {
    const b = libBank(q.id);
    const first = b.pads[dev.sel] ? b.pads[dev.sel].video : null;
    for (const v of padVideos(b)) if (v !== first && !hasWav(v)) fetchVideo(v, 'fetchall').catch(() => { /* steht in videoFail */ });
    if (first && !hasWav(first)) fetchVideo(first, 'select').catch(() => { /* steht in videoFail */ });
    sendBank(b);
  },
  newmix(q, by) {
    const r = libChange('newmix', {}, by);
    trySend(bankById(r.id));
    return r;
  },
  // Track aus der Suche auf Plätze (ein Platz oder alle leeren): {} sofort, Rest per job kind pads
  fillpads(q, by) {
    need(isVideo(q.video) && Array.isArray(q.pads) && q.pads.length >= 1 && q.pads.every(isPad) && new Set(q.pads).size === q.pads.length
      && (q.tag === undefined || (typeof q.tag === 'string' && /^[\w-]{1,40}$/.test(q.tag))));
    libBank(q.id);
    fillPads(q, by).catch((e) => {
      if (e.code !== 'loadfail') edEmit('msg', { level: 'error', code: e.code || 'cutfail', text: e.text || e.message });   // loadfail meldet der Download selbst
    });
  },
  // Pad kopieren oder leeren (video null). Ohne Quelle zum Schneiden playonly, dann bleibt alles, wie es ist.
  setpad(q, by) {
    const b = libBank(q.id);
    need(isPad(q.pad) && (q.video === null || (isVideo(q.video) && isInt(q.start, 0))));
    if (q.video !== null && !padSource({ video: q.video, start: q.start }, b.id)) throw libErr('playonly');
    if (!samePad(b.pads[q.pad], q.video === null ? null : { video: q.video, start: q.start })) keepPad(b.pads[q.pad], b.id);
    libChange('setpad', { id: q.id, pad: q.pad, video: q.video, start: q.start, info: q.info }, by);
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
  restore: (q, by) => { libChange('restore', { bank: q.bank, at: q.at, videos: q.videos }, by); },
  setstart(q, by) {
    const { p } = libPad(q);
    need(isInt(q.ms, 0));
    if (!hasWav(p.video)) throw libErr('playonly');
    libChange('setstart', { id: q.id, pad: q.pad, ms: q.ms }, by);
  },
  // ohne WAV nur, wenn jedes neue {video, start} als Fach in einer Snippet-Datei liegt
  setstarts(q, by) {
    const b = libBank(q.id);
    need(isStarts(q.starts));
    const memo = new Map();
    if (!b.pads.every((p, k) => !p || padSource({ video: p.video, start: q.starts[k] }, b.id, memo))) throw libErr('playonly');
    libChange('setstarts', { id: q.id, starts: q.starts }, by);
  },
  swap: (q, by) => { libChange('swap', { id: q.id, a: q.a, b: q.b }, by); },
  // würfelt im Video des Pads, belegt sind die Starts der Pads mit demselben Video (M3)
  roll(q, by) {
    const { b, p } = libPad(q);
    const ms = rollStart(p.video, b.pads.filter((x) => x && x.video === p.video).map((x) => x.start));
    libChange('setstart', { id: q.id, pad: q.pad, ms }, by);
    return { ms };
  },
  hit: (q) => { need(isPad(q.pad)); Max.outlet('padhit', q.pad); },
  up: (q) => { need(isPad(q.pad)); Max.outlet('padup', q.pad); },
  param(q) {
    const r = PARAMS[q.name];
    need(typeof q.name === 'string' && has(PARAMS, q.name) && typeof q.value === 'number' && q.value >= r[0] && q.value <= r[1]
      && (!r[2] || Number.isInteger(q.value)));
    Max.outlet('param', q.name, q.value);
  },
  search: (q) => edSearch(q.q),
  tempo(q, by) {
    libChange('tempo', { video: q.video, bpm: q.bpm }, by);
    bpmToDevice(q.video);
  },
  tempook(q, by) {
    if (!libNow.lib) throw libBroken();
    need(typeof q.video === 'string' && has(libNow.lib.videos, q.video));
    const a = getAnalysis(q.video, true);
    if (!a || !(a.bpm > 0)) throw libErr('notempo');
    const r = libChange('tempo', { video: q.video, bpm: a.bpm }, by);
    bpmToDevice(q.video);
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
    m.banks = L.banks.map((b) => ({ id: b.id, name: b.name, pads: b.pads, mix: isMix(b), ...snipStatus(b) }));
    // Songdauer: aus dem Cache, sonst aus einer Snippet-.json
    const durs = {};
    for (const b of L.banks) {
      const j = readSnip(b.id);
      if (j) for (const v of Object.keys(j.durs)) if (!has(durs, v) && typeof j.durs[v] === 'number') durs[v] = j.durs[v];
    }
    for (const v of Object.keys(L.videos)) {
      const e = { title: L.videos[v].title };
      if (has(L.videos[v], 'bpm')) e.bpm = L.videos[v].bpm;
      if (has(videoFail, v)) e.fail = videoFail[v];
      e.wav = hasWav(v);
      if (e.wav) { try { e.dur = Math.round(wavDurationMs(cacheWav(v))); } catch (err) { /* unlesbar */ } }
      if (!has(e, 'dur') && has(durs, v)) e.dur = durs[v];
      m.videos[v] = e;
    }
    return m;
  },
  device: () => ({ bankId: dev.bankId, nr: bankNr(dev.bankId), video: devVideo(), sel: dev.sel, starts: dev.starts, spans: dev.spans, params: dev.params }),
  cache: () => cacheSize(),
  // Track des gewählten Pads (device.video)
  beats() {
    const v = devVideo();
    if (v === '-') return null;
    let a = null;
    try { a = getAnalysis(v, true); } catch (e) { /* ohne Analyse keine Beats */ }
    return beatsOf(v, a);
  },
};
const sse = (res, ev, data) => res.write(`event: ${ev}\ndata: ${JSON.stringify(data)}\n\n`);
function edEmit(ev, data) { for (const r of edClients) sse(r, ev, data); }

// Zustands-Events gebündelt (30 ms), Inhalt erst beim Senden berechnet
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
// Webserver: Editor unter http://localhost:8765/editor
// =====================================================================
const WEB_PORT = process.env.YTS_PORT ? +process.env.YTS_PORT : 8765;   // YTS_PORT nur für Tests
const WEB_DIR = path.join(DATA, 'web');
let webPort = 0;

// editor.html neben dem Skript nach D/web spiegeln
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

function startWeb(port, tries) {
  const server = http.createServer((req, res) => {
    const url = req.url.split('?')[0];
    if (url === '/') { res.writeHead(302, { Location: '/editor' }); res.end(); return; }
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
    Max.post(`YT Sampler: Editor unter http://localhost:${webPort}/editor`);
  });
  // Verbindung offen halten
  setInterval(() => { for (const r of edClients) r.write(': ping\n\n'); }, 15000).unref();
}
startWeb(WEB_PORT, 5);

try { libBackup(); } catch (e) { Max.post(`YT Sampler: Sicherung fehlgeschlagen: ${e.message}`); }
libWatch();
try { snipCleanup(); keepCleanup(); } catch (e) { Max.post(`YT Sampler: Aufräumen fehlgeschlagen: ${e.message}`); }

// Startcheck; Session vom Device anfordern
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
  errMsg, DATA, LOCAL, CACHE, SESSIONS, LIB_FILE, LIB_LOCK, BACKUP_DIR, ERR, LIB, libErr, libParse, libRead, libChange, libBackup, libEvents, get libNow() { return libNow; },
  AN, SNIP_DIR, SNIP_MS, computeAnalysis, tempoFromOnset, saveAnalysis, readAnalysis, getAnalysis, trackBeats, silentRanges,
  hasWav, readSnip, snipCurrent, snipStatus, cutSnippets, snipEnsure, snipRefresh, snipCopy, snipCleanup, keepCleanup, KEEP_DIR, cacheSize, videoFail,
  beatsOf, videoBeats, rollStart, rollBank, fetchVideo, fetchAll, fillPads, get anaMap() { return anaMap; },
  parseSearchPage, runCmd, peaks, get webPort() { return webPort; }, get activeId() { return activeId; },
};
