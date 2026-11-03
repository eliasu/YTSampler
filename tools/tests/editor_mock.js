// Attrappe des Editor-Servers (Spec 3.2–3.4, 6.5): /editor, /editor/events (SSE), /cmd, /peaks.
// Bibliothek, Device und Downloads nur im Speicher. Nie auf 8765–8770, dort läuft das echte Device.
//   node tools/tests/editor_mock.js [port] [szenario]     → http://localhost:<port>/editor
// Szenario umschalten im Browser: /mock/normal, /mock/nurspielbar, /mock/nichtsgeladen, /mock/leer,
// /mock/kaputt, /mock/neuer, /mock/mix (aktive Bank aus mehreren Tracks), /mock/down (kein Device), /mock/up.
// Bibliothek im format 2 (Mix-Spec 2.1/3.2): banks[].pads = {video, start} | null, lib meldet mix/wav pro Bank, videos.wav/dur.
// Device-Regler (Spec 3.0, 3.2/3.3): device.params, /cmd param stellt den Wert und schickt device zurück.
const http = require('http');
const fs = require('fs');
const path = require('path');

const EDITOR = path.join(__dirname, '..', '..', 'editor.html');
const ERR = {
  nobank: 'Bank gibt es nicht mehr', libbroken: 'Bibliothek kaputt – Speichern gesperrt', libnewer: 'Bibliothek aus neuerer Version',
  playonly: 'Track fehlt – nur spielbar', nosnip: 'Snippets fehlen – Bank nicht ladbar', idtaken: 'Bank existiert schon',
  notempo: 'Kein Tempo erkannt', cachebusy: 'Downloads oder Schnitte laufen – danach noch einmal', superseded: 'Neuere Suche läuft', badreq: 'Ungültiger Befehl',
};
const WRITE = ['rename', 'duplicate', 'delete', 'move', 'stage', 'restore', 'setstart', 'setstarts', 'swap', 'roll', 'fillpads', 'newmix', 'setpad', 'trim', 'tempo', 'tempook', 'fetch', 'fetchall'];

// Videos: id → [Titel, Analyse-BPM, Dauer s]
const VIDEOS = {
  'Rk7tQ2mLp0A': ['Herbie Hancock – Rockit', 97, 324], 'Cv1tAm1nC0x': ['Can – Vitamin C', 116, 212],
  'Fk4WaterNoG': ['Fela Kuti – Water No Get Enemy', 104, 290], 'Kw8Numbers0': ['Kraftwerk – Numbers', 112, 199],
  'Es9UfoUfo00': ['ESG – UFO', 101, 178], 'Lq2Cavern00': ['Liquid Liquid – Cavern', 108, 301],
  'Mt3CissyStr': ['The Meters – Cissy Strut', 92, 183],
};
const POOL = [['Cy5BraBra00', 'Cymande – Bra', 100, 372], ['Ew6LastNigh', 'Esther Williams – Last Night Changed It All', 120, 425],
  ['Mg7E2E4e2e4', 'Manuel Göttsching – E2-E4', 124, 3540], ['Bj8Nautilus', 'Bob James – Nautilus', 95, 309]];
for (const p of POOL) VIDEOS[p[0]] = [p[1], p[2], p[3]];

function beatsOf(video, bpm) {
  const dur = VIDEOS[video][2] * 1000, beat = 60000 / bpm, off = 300, out = [];
  for (let t = off; t < dur; t += beat) out.push(Math.round(t));
  return { beats: out, down: out[8] };
}
function bars(video) { const v = VIDEOS[video], b = beatsOf(video, v[1]); return b.beats.filter((t, k) => k >= 8 && (k - 8) % 4 === 0); }
// Regler wie Spec 3.0, 3.1: [min, max, ganz]
const PARAMS = { div: [0, 11, true], rate: [0.25, 2], mode: [0, 1, true], rev: [0, 1, true], tune: [0, 1, true], warp: [0, 1, true],
  quant: [0, 1, true], qdiv: [0, 3, true], qcatch: [0, 1, true], vol: [-70, 6], voices: [0, 6, true], base: [0, 127, true], norm: [0, 1, true] };
const PARAMS_START = { div: 5, rate: 1, mode: 0, rev: 0, tune: 1, warp: 0, quant: 1, qdiv: 1, qcatch: 0, vol: -3.5, voices: 6, base: 36, bpm: 120, norm: 1 };   // bpm = Lives Tempo
const DIV_FRAC = [1 / 64, 1 / 32, 1 / 24, 1 / 16, 1 / 12, 1 / 8, 1 / 6, 1 / 4, 1 / 2, 1, 2, 4];
function makeStarts(video, seed) { const b = bars(video), out = []; for (let i = 0; out.length < 16; i++) { const t = b[(seed * 7 + i * 5) % b.length]; if (!out.includes(t)) out.push(t); } return out.sort((a, c) => a - c); }

const videoEntry = (v, title) => ({ title: title || VIDEOS[v][0], wav: true, dur: VIDEOS[v][2] * 1000 });
const padsOf = (v, starts) => starts.map((start) => ({ video: v, start }));
const videosOf = (b) => [...new Set(b.pads.filter(Boolean).map((p) => p.video))];
// Track-Bank = 16 belegte Pads aus einem Video, sonst Mix (Spec 2.1)
const isMix = (b) => !b.pads.every((p) => p && b.pads[0] && p.video === b.pads[0].video);

function scenarioLib(name) {
  const ids = Object.keys(VIDEOS).slice(0, 7);
  const lib = { rev: 57, nextId: 13, banks: [], videos: {} };
  const names = ['Rockit Scratches', 'Vitamin C', 'Water No Get Enemy', 'Numbers – nur Stimmen', 'UFO', 'Cavern', 'Cissy Strut'];
  ids.forEach((v, k) => {
    lib.banks.push({ id: [7, 3, 9, 4, 11, 2, 12][k], name: names[k], pads: padsOf(v, makeStarts(v, k)), snip: 'ok' });
    lib.videos[v] = videoEntry(v);
  });
  lib.videos.Rk7tQ2mLp0A.bpm = 97;
  lib.videos.Kw8Numbers0.bpm = 112;
  lib.videos.Fk4WaterNoG.wav = false;                                        // nur spielbar (Dauer aus der Snippet-.json)
  lib.videos.Fk4WaterNoG.fail = 'Video nicht verfügbar';
  lib.videos.Es9UfoUfo00.wav = false; delete lib.videos.Es9UfoUfo00.dur; lib.banks[4].snip = 'missing'; // nicht ladbar
  if (name === 'mix') { // Mix-Bank aus drei Bänken, einem Video nur hier (Cymande), leeren Plätzen und einem Pad ohne WAV (Fela)
    const [R, C, F] = lib.banks.map((b) => b.pads), cy = 'Cy5BraBra00';
    lib.videos[cy] = videoEntry(cy);
    const pads = [R[0], R[3], R[6], R[9], C[1], C[4], C[7], C[10], F[2], null, { video: cy, start: bars(cy)[12] }, null, R[12], C[13], null, null];
    lib.banks.push({ id: 13, name: 'Mix Funk', pads: pads.map((p) => p && { ...p }), snip: 'ok' }); lib.nextId = 14;
  }
  lib.state = 'ok';
  if (name === 'leer') { lib.banks = []; lib.videos = {}; lib.state = 'leer'; }
  if (name === 'kaputt') { lib.banks = []; lib.videos = {}; lib.state = 'kaputt'; lib.error = ERR.libbroken + ' (Zeile 14: unerwartetes Komma)'; }
  if (name === 'neuer') { lib.banks = []; lib.videos = {}; lib.state = 'neuer'; lib.error = ERR.libnewer; }
  return lib;
}

function sineWav(ms, hz) {
  const n = Math.max(1, Math.round(ms * 44.1)), out = Buffer.alloc(44 + n * 4);
  out.write('RIFF', 0); out.writeUInt32LE(36 + n * 4, 4); out.write('WAVEfmt ', 8); out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20); out.writeUInt16LE(2, 22);
  out.writeUInt32LE(44100, 24); out.writeUInt32LE(176400, 28); out.writeUInt16LE(4, 32); out.writeUInt16LE(16, 34); out.write('data', 36); out.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) { const x = Math.round(Math.sin(2 * Math.PI * hz * i / 44100) * 8000); out.writeInt16LE(x, 44 + i * 4); out.writeInt16LE(x, 46 + i * 4); }
  return out;
}

function createMock(opts = {}) {
  const m = {
    log: [], clients: new Set(), down: false, session: 1, track: '3-YT Sampler', port: 0,
    lib: null, dev: null, beatsOk: null, searchSeq: 0, slowSearch: 0, params: { ...PARAMS_START }, gets: [],
  };
  // Spanne wie [js] grob: Slice-Länge im Quelltempo, durch Rate (Warp und Hold hier egal)
  const spanOf = (b) => b.pads.map((pad) => {
    if (!pad) return 0;
    const video = pad.video, bpm = (m.lib.videos[video] && m.lib.videos[video].bpm) || (VIDEOS[video] ? VIDEOS[video][1] : 120), p = m.params || PARAMS_START;
    return Math.round(Math.min(16000, 240000 / bpm * DIV_FRAC[p.div] / p.rate));
  });
  // device.video = Video des gewählten Pads (Spec 3.2), '-' bei leerem Platz
  function devFor(b) {
    const sel = m.dev ? m.dev.sel : 0, pad = b && b.pads[sel];
    return { bankId: b ? b.id : 0, nr: b ? stageOf().indexOf(b) + 1 : 0, video: pad ? pad.video : '-', sel,
      starts: b ? b.pads.map((p) => (p ? p.start : 0)) : [], spans: b ? spanOf(b) : [], params: m.params ? { ...m.params } : null };
  }
  m.scenario = function (name) {
    m.name = name;
    m.lib = scenarioLib(name);
    m.params = { ...PARAMS_START }; m.cacheBytes = opts.cacheBytes != null ? opts.cacheBytes : 4.2e9;
    const b = name === 'nichtsgeladen' ? null : m.lib.banks[name === 'nurspielbar' ? 2 : name === 'mix' ? 7 : 0];
    m.dev = null; m.dev = devFor(b);
    m.beatsOk = null;
    broadcastAll();
  };
  const byId = (id) => m.lib.banks.find((b) => b.id === id);
  // Bühne/Ablage wie Node: stage false = Ablage, fehlt = Bühne. Nummern zählen nur die Bühne
  const onStage = (b) => b.stage !== false;
  const stageOf = (on = true) => m.lib.banks.filter((b) => onStage(b) === on);
  function stageTo(b, on, at) {
    m.lib.banks.splice(m.lib.banks.indexOf(b), 1);
    if (on) delete b.stage; else b.stage = false;
    const sec = stageOf(on), pos = Math.min(at == null ? Infinity : at, sec.length + 1);
    const k = pos <= sec.length ? m.lib.banks.indexOf(sec[pos - 1]) : sec.length ? m.lib.banks.indexOf(sec[sec.length - 1]) + 1 : on ? 0 : m.lib.banks.length;
    m.lib.banks.splice(k, 0, b);
    return pos;
  }
  const bankWav = (b) => videosOf(b).every((v) => m.lib.videos[v] && m.lib.videos[v].wav);
  // ein videos-Eintrag lebt, solange ein Pad ihn benutzt
  // videos-Einträge ohne Pad bleiben wie bei Node bis zum Start (Flow-Nachtrag)
  function libMsg(by) {
    const { rev, state, error, banks, videos } = m.lib;
    return { rev, by, state, error, cache: cacheMsg(), banks: banks.map((b) => ({ ...b, mix: isMix(b), stage: onStage(b), wav: bankWav(b), gain: b.pads.map((p, i) => (p ? (i % 3) - 1 : 0)) })), videos };   // Ausgleich: −1/0/+1 dB
  }
  m.cacheBytes = opts.cacheBytes != null ? opts.cacheBytes : 4.2e9;
  function cacheMsg() { const bytes = m.cacheBytes; return { bytes, warn: bytes >= 1e10 }; }
  function beatsMsg() {
    const v = m.dev.video; if (!VIDEOS[v]) return null;
    const conf = m.lib.videos[v] && m.lib.videos[v].bpm ? 0.8 : 0.42, bpm = (m.lib.videos[v] && m.lib.videos[v].bpm) || VIDEOS[v][1];
    const confirmed = !!(m.lib.videos[v] && m.lib.videos[v].bpm);
    return { video: v, bpm, conf, confirmed, ok: m.beatsOk != null ? m.beatsOk : (confirmed || conf >= 0.3), ...beatsOf(v, bpm) };
  }
  function send(res, ev, data) { res.write(`event: ${ev}\ndata: ${JSON.stringify(data)}\n\n`); }
  m.emit = function (ev, data) { for (const c of m.clients) send(c, ev, data); };
  function broadcastAll() {
    for (const c of m.clients) { send(c, 'lib', libMsg('extern')); send(c, 'device', m.dev); const b = beatsMsg(); if (b) send(c, 'beats', b); }
  }
  function changed(by) { m.lib.rev++; m.emit('lib', libMsg(by)); }
  function activate(b) { m.dev = devFor(b); m.emit('device', m.dev); const bt = beatsMsg(); if (bt) m.emit('beats', bt); }
  // beats folgt dem Video des gewählten Pads
  function syncDev() {
    const b = byId(m.dev.bankId), old = m.dev.video; if (!b) return;
    m.dev = devFor(b); m.emit('device', m.dev);
    if (m.dev.video !== old) { const bt = beatsMsg(); if (bt) m.emit('beats', bt); }
  }
  // wie Node, wenn [js] einen neuen bankstate schickt (z. B. Regler am Device gedreht); params null = noch kein bankstate
  m.setParams = function (p) { m.params = p && { ...m.params, ...p }; m.dev = devFor(byId(m.dev.bankId)); m.emit('device', m.dev); };
  m.setDown = function (d) { m.down = d; if (d) for (const c of m.clients) c.destroy(); };
  m.close = () => new Promise((r) => { for (const c of m.clients) c.destroy(); m.server.close(r); });

  const fail = (code) => ({ ok: false, code, text: ERR[code] || code });
  const isPad = (p) => Number.isInteger(p) && p >= 0 && p <= 15;
  // Fortschritt wie Node in Prozent (0–100)
  function job(kind, extra, done) {
    let p = 0;
    const t = setInterval(() => {
      p = Math.min(100, p + 25);
      m.emit('job', { kind, ...extra, phase: p < 100 ? 'download' : 'done', progress: p, left: 0, ...(p < 100 ? {} : done()) });
      if (p >= 100) clearInterval(t);
    }, opts.jobStep || 250);
  }

  function cmd(q) {
    const c = q.cmd, b = q.id != null ? byId(q.id) : null;
    if (WRITE.includes(c) && (m.lib.state === 'kaputt' || m.lib.state === 'neuer')) return fail(m.lib.state === 'kaputt' ? 'libbroken' : 'libnewer');
    if (['select', 'rename', 'duplicate', 'delete', 'move', 'stage', 'setstart', 'setstarts', 'swap', 'roll', 'setpad', 'trim', 'fillpads'].includes(c) && !b) return fail(q.id == null ? 'badreq' : 'nobank');
    const pad = b && isPad(q.pad) ? b.pads[q.pad] : null, padWav = pad && m.lib.videos[pad.video].wav;
    const known = (video, start) => m.lib.banks.some((x) => x.pads.some((p) => p && p.video === video && p.start === start)); // Quelle ohne WAV (Spec 2.2)
    switch (c) {
      case 'select':
        if (b.snip === 'missing' && !bankWav(b)) return fail('nosnip');
        activate(b); return { ok: true };
      case 'rename':
        if (typeof q.name !== 'string') return fail('badreq');
        b.name = q.name.trim().slice(0, 100); changed(q.client); return { ok: true };
      case 'duplicate': {
        const k = { ...b, id: m.lib.nextId++, name: b.name + ' (Kopie)', pads: b.pads.map((p) => p && { ...p }), stage: false };
        m.lib.banks.splice(m.lib.banks.indexOf(b) + 1, 0, k); changed(q.client); activate(k); return { ok: true, id: k.id };
      }
      case 'delete': {
        const at = m.lib.banks.indexOf(b) + 1, k = stageOf().indexOf(b), videos = {};
        for (const v of videosOf(b)) { const e = m.lib.videos[v]; videos[v] = { title: e.title }; if (e.bpm) videos[v].bpm = e.bpm; }
        m.lib.banks.splice(at - 1, 1);
        if (!m.lib.banks.length) m.lib.state = 'leer';
        changed(q.client);
        // Nachrücker von der Bühne; Ablage-Bank: [js] lädt die Bank am Regler, hier grob die erste der Bühne
        if (m.dev.bankId === b.id) { const L = stageOf(); activate((k >= 0 ? L[k] || L[k - 1] : L[0]) || null); } else syncDev();
        const { snip, ...bank } = b;
        return { ok: true, removed: { bank, at, videos } };
      }
      case 'move': {
        if (!Number.isInteger(q.to) || q.to < 1 || q.to > stageOf(onStage(b)).length) return fail('badreq');
        const at = stageTo(b, onStage(b), q.to); changed(q.client); syncDev(); return { ok: true, at };
      }
      case 'stage': {
        if (typeof q.on !== 'boolean' || (q.at !== undefined && !(Number.isInteger(q.at) && q.at >= 1))) return fail('badreq');
        const at = stageTo(b, q.on, q.at); changed(q.client); syncDev(); return { ok: true, at };
      }
      case 'restore': {
        const r = q.bank; if (!r || !Number.isInteger(r.id) || !Number.isInteger(q.at)) return fail('badreq');
        if (r.id >= m.lib.nextId || byId(r.id)) return fail('idtaken');
        if (!Array.isArray(r.pads) || r.pads.length !== 16 || !videosOf(r).every((v) => m.lib.videos[v] || (q.videos && q.videos[v]))) return fail('badreq');
        for (const v of videosOf(r)) if (!m.lib.videos[v]) m.lib.videos[v] = { ...videoEntry(v), ...q.videos[v] };
        m.lib.banks.splice(Math.min(q.at - 1, m.lib.banks.length), 0, { ...r, pads: r.pads.map((p) => p && { ...p }), snip: 'ok' });
        m.lib.state = 'ok'; changed(q.client); syncDev(); return { ok: true };
      }
      case 'setstart':
        if (!pad || !Number.isInteger(q.ms) || q.ms < 0) return fail('badreq');
        if (!padWav) return fail('playonly');
        pad.start = q.ms; changed(q.client); syncDev(); return { ok: true };
      case 'setstarts':
        if (!Array.isArray(q.starts) || q.starts.length !== 16 || !q.starts.every((s) => Number.isInteger(s) && s >= 0)) return fail('badreq');
        if (!b.pads.every((p, i) => !p || m.lib.videos[p.video].wav || p.start === q.starts[i] || known(p.video, q.starts[i]))) return fail('playonly');
        b.pads.forEach((p, i) => { if (p) p.start = q.starts[i]; }); changed(q.client); syncDev(); return { ok: true };
      case 'swap':
        if (!isPad(q.a) || !isPad(q.b)) return fail('badreq');
        [b.pads[q.a], b.pads[q.b]] = [b.pads[q.b], b.pads[q.a]]; changed(q.client); syncDev(); return { ok: true };
      case 'roll': {
        if (!pad) return fail('badreq');
        if (!padWav) return fail('playonly');
        const taken = b.pads.filter((p) => p && p.video === pad.video).map((p) => p.start);
        const free = bars(pad.video).filter((t) => !taken.includes(t)), ms = free[Math.floor(Math.random() * free.length)];
        pad.start = ms; changed(q.client); syncDev(); return { ok: true, ms };
      }
      case 'setpad': { // Spec 3.1: Pad auf einen Platz kopieren, video null leert
        if (!isPad(q.pad)) return fail('badreq');
        if (q.video === null) { b.pads[q.pad] = null; changed(q.client); syncDev(); return { ok: true }; }
        const e = m.lib.videos[q.video];
        if (typeof q.video !== 'string' || !Number.isInteger(q.start) || q.start < 0) return fail('badreq');
        if (!e && !(q.info && typeof q.info.title === 'string')) return fail('badreq');
        const wav = e ? e.wav : !!VIDEOS[q.video];                                // gelöschtes Video: WAV liegt noch im Cache
        if (!wav && !known(q.video, q.start)) return fail('playonly');
        if (!e) { m.lib.videos[q.video] = { ...videoEntry(q.video, q.info.title), wav }; if (q.info.bpm) m.lib.videos[q.video].bpm = q.info.bpm; }
        if (q.trim !== undefined && !(typeof q.trim === 'number' && Math.abs(q.trim) <= 12)) return fail('badreq');
        b.pads[q.pad] = { video: q.video, start: q.start }; if (q.trim) b.pads[q.pad].trim = q.trim;
        changed(q.client); syncDev(); return { ok: true };
      }
      case 'trim': { // Nachtrag 14: Trim pro Pad, 0 = Feld weg
        if (!pad || typeof q.trim !== 'number' || Math.abs(q.trim) > 12) return fail('badreq');
        if (q.trim) pad.trim = Math.round(q.trim * 10) / 10; else delete pad.trim;
        m.trims = (m.trims || []).concat([[q.id, q.pad, q.trim]]); changed(q.client); return { ok: true };
      }
      case 'newmix': {
        if (q.name !== undefined && typeof q.name !== 'string') return fail('badreq');
        const k = { id: m.lib.nextId++, name: (q.name && q.name.trim().slice(0, 100)) || 'Neue Bank', pads: Array(16).fill(null), snip: 'ok', stage: false };
        m.lib.banks.push(k); m.lib.state = 'ok'; changed(q.client); activate(k); return { ok: true, id: k.id };
      }
      case 'hit': case 'up': {
        if (!isPad(q.pad)) return fail('badreq');
        if (c === 'up') { m.emit('stop', { pad: q.pad }); return { ok: true }; }
        m.dev.sel = q.pad; syncDev();
        const hb = byId(m.dev.bankId), hp = hb && hb.pads[q.pad], from = m.dev.starts[q.pad], dur = m.dev.spans[q.pad];
        if (hp) m.emit('play', { pad: q.pad, video: hp.video, from, to: from + dur, dur });
        return { ok: true };
      }
      case 'search': {
        const seq = ++m.searchSeq;
        return new Promise((r) => setTimeout(() => {
          if (seq !== m.searchSeq) return r(fail('superseded'));
          const s = String(q.q || '').toLowerCase();
          r({ ok: true, results: POOL.filter((p) => !s || p[1].toLowerCase().includes(s) || s.length < 3).map((p) => ({ id: p[0], title: p[1], dur: p[3], long: p[3] > 600 })) });
        }, m.slowSearch || 200));
      }
      case 'fillpads': { // Track aus der Suche auf Plätze, gewürfelt auf Taktanfänge, done mit before/after/videos fürs Undo
        const v = q.video;
        if (!VIDEOS[v] || !Array.isArray(q.pads) || !q.pads.length || !q.pads.every(isPad) || new Set(q.pads).size !== q.pads.length) return fail('badreq');
        job('pads', { video: v, tag: q.tag, id: b.id, pads: q.pads }, () => {
          const taken = b.pads.filter((p, k) => p && p.video === v && !q.pads.includes(k)).map((p) => p.start);
          const free = bars(v).filter((t) => !taken.includes(t)), starts = [];
          while (starts.length < q.pads.length) { const t = free.splice(Math.floor(Math.random() * free.length), 1)[0]; starts.push(t); }
          starts.sort((x, y) => x - y);
          const before = q.pads.map((k) => b.pads[k] && { ...b.pads[k] }), videos = {};
          for (const p of before) if (p) { const e = m.lib.videos[p.video]; videos[p.video] = { title: e.title }; if (e.bpm) videos[p.video].bpm = e.bpm; }
          if (!m.lib.videos[v]) m.lib.videos[v] = videoEntry(v);
          q.pads.forEach((k, n) => { b.pads[k] = { video: v, start: starts[n] }; });
          changed(q.client); syncDev();
          videos[v] = { title: m.lib.videos[v].title };
          return { before, after: starts.map((start) => ({ video: v, start })), videos };
        });
        return { ok: true };
      }
      case 'tempo': {
        if (!m.lib.videos[q.video] || typeof q.bpm !== 'number' || q.bpm < 30 || q.bpm > 300) return fail('badreq');
        m.lib.videos[q.video].bpm = Math.round(q.bpm * 10) / 10; changed(q.client);
        if (m.dev.video === q.video) m.emit('beats', beatsMsg());
        return { ok: true };
      }
      case 'tempook': {
        if (!m.lib.videos[q.video]) return fail('badreq');
        if (!VIDEOS[q.video]) return fail('notempo');
        const bpm = VIDEOS[q.video][1]; m.lib.videos[q.video].bpm = bpm; changed(q.client);
        if (m.dev.video === q.video) m.emit('beats', beatsMsg());
        return { ok: true, bpm };
      }
      case 'fetch': {
        const v = q.video; if (!m.lib.videos[v]) return fail('badreq');
        delete m.lib.videos[v].fail;
        job('fetch', { video: v }, () => {
          Object.assign(m.lib.videos[v], { wav: true, dur: VIDEOS[v][2] * 1000 });
          for (const x of m.lib.banks) if (videosOf(x).includes(v) && x.snip === 'missing') x.snip = 'ok';
          m.emit('lib', libMsg(q.client)); return {};
        });
        return { ok: true };
      }
      case 'clearcache': { // ganze Tracks weg, Snippets bleiben: alles „nur spielbar“
        if (m.busy) return fail('cachebusy');
        const freed = m.cacheBytes; m.cacheBytes = 0;
        for (const e of Object.values(m.lib.videos)) e.wav = false;
        m.emit('lib', libMsg(q.client)); m.emit('cache', cacheMsg());
        return { ok: true, freed };
      }
      case 'fetchall': return { ok: true, todo: Object.values(m.lib.videos).filter((x) => !x.wav).length };
      case 'param': { // auch bei kaputter Bibliothek erlaubt; Bestätigung nur über device.params
        const r = PARAMS[q.name], v = q.value;
        if (!r || typeof v !== 'number' || !Number.isFinite(v) || v < r[0] || v > r[1] || (r[2] && !Number.isInteger(v))) return fail('badreq');
        if (!m.params) return { ok: true };
        setTimeout(() => m.setParams({ [q.name]: v }), opts.paramDelay || 0);
        return { ok: true };
      }
    }
    return fail('badreq');
  }

  function peaks(video) {
    const v = VIDEOS[video], sr = 44100, blocks = Math.floor(v[2] * sr / 256), buf = Buffer.alloc(8 + blocks * 2), beat = 60000 / v[1];
    buf.writeUInt32LE(sr, 0); buf.writeUInt32LE(256, 4);
    let seed = video.charCodeAt(0) * 31 + video.charCodeAt(5);
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    for (let i = 0; i < blocks; i++) {
      const ms = i * 256 / sr * 1000, ph = ((ms - 300) % beat + beat) % beat / beat;
      const a = Math.min(1, (ms < 2000 ? 0.15 : 0.45) * (0.6 + 0.4 * Math.sin(ms / 23000)) * (0.5 + rnd() * 0.5) + Math.max(0, 1 - ph * 6) * 0.45);
      buf.writeInt8(Math.round(-a * 127), 8 + i * 2); buf.writeInt8(Math.round(a * 127), 9 + i * 2);
    }
    return buf;
  }

  m.server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    const mk = u.pathname.match(/^\/mock\/(\w+)$/);
    if (mk) {
      if (mk[1] === 'down') m.setDown(true); else if (mk[1] === 'up') m.down = false; else m.scenario(mk[1]);
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Attrappe: ' + mk[1] + '\n');
    }
    if (m.down && u.pathname !== '/editor') { res.writeHead(503); return res.end(); }
    if (u.pathname === '/editor' || u.pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }); return res.end(fs.readFileSync(EDITOR));
    }
    if (u.pathname === '/editor/events') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
      res.write('retry: 1500\n\n');
      send(res, 'hello', { port: m.port, session: m.session, track: m.track });
      send(res, 'lib', libMsg('extern')); send(res, 'device', m.dev); send(res, 'cache', cacheMsg());
      const b = beatsMsg(); if (b) send(res, 'beats', b);
      m.clients.add(res); req.on('close', () => m.clients.delete(res));
      return;
    }
    // Vorhören (Nachtrag 12): Fach als WAV, hier ein Sinus pro Pad, Länge wie Node (bis Snippet- bzw. Track-Ende)
    const sn = u.pathname.match(/^\/snip\/(.*)$/);
    if (sn) {
      m.gets.push(u.pathname);
      const q = sn[1].match(/^(\d+)\/(\d+)$/);
      if (req.method !== 'GET') { res.writeHead(403); return res.end(); }
      if (!q || +q[2] > 15) { res.writeHead(400); return res.end(); }
      const b = byId(+q[1]), pd = b && b.pads[+q[2]];
      if (!pd || !VIDEOS[pd.video]) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'Content-Type': 'audio/wav', 'Cache-Control': 'no-store' });
      return res.end(sineWav(Math.min(16000, VIDEOS[pd.video][2] * 1000 - pd.start), 220 + 20 * +q[2]));
    }
    const pk = u.pathname.match(/^\/peaks\/(.*)$/);
    if (pk) {
      if (!/^[\w-]{11}$/.test(pk[1])) { res.writeHead(400); return res.end(); }
      const e = m.lib.videos[pk[1]];
      if (!VIDEOS[pk[1]] || (e && !e.wav)) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Cache-Control': 'private, max-age=86400' }); return res.end(peaks(pk[1]));
    }
    if (u.pathname === '/cmd' && req.method === 'POST') {
      if (!/^application\/json/.test(req.headers['content-type'] || '')) { res.writeHead(403); return res.end(); }
      let body = '';
      req.on('data', (d) => { body += d; });
      req.on('end', async () => {
        let q; try { q = JSON.parse(body); } catch { res.writeHead(400); return res.end(); }
        m.log.push(q);
        const out = await cmd(q);
        res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(out));
      });
      return;
    }
    res.writeHead(404); res.end();
  });
  m.scenario(opts.scenario || 'normal');
  m.listen = (port) => new Promise((r) => m.server.listen(port, '127.0.0.1', () => {
    m.port = m.server.address().port;
    if (m.port >= 8765 && m.port <= 8770) throw new Error('Port des echten Device');
    r(m);
  }));
  return m;
}

module.exports = { createMock, VIDEOS, PARAMS_START };

if (require.main === module) {
  const port = Number(process.argv[2] || 8790), sc = process.argv[3] || 'normal';
  if (port >= 8765 && port <= 8770) { console.error('8765–8770 gehört dem echten Device'); process.exit(1); }
  createMock({ scenario: sc }).listen(port).then((m) => {
    console.log(`Attrappe läuft: http://localhost:${m.port}/editor  (Szenario ${sc})`);
    console.log(`Umschalten: http://localhost:${m.port}/mock/<normal|mix|nurspielbar|nichtsgeladen|leer|kaputt|neuer|down|up>`);
  });
}
