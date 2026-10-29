// Attrappe des Editor-Servers (Spec 3.2–3.4, 6.5): /editor, /editor/events (SSE), /cmd, /peaks.
// Bibliothek, Device und Downloads nur im Speicher. Nie auf 8765–8770, dort läuft das echte Device.
//   node tools/tests/editor_mock.js [port] [szenario]     → http://localhost:<port>/editor
// Szenario umschalten im Browser: /mock/normal, /mock/nurspielbar, /mock/keinebank, /mock/leer,
// /mock/kaputt, /mock/neuer, /mock/down (kein Device), /mock/up.
const http = require('http');
const fs = require('fs');
const path = require('path');

const EDITOR = path.join(__dirname, '..', '..', 'editor.html');
const ERR = {
  nobank: 'Bank gibt es nicht mehr', libbroken: 'Bibliothek kaputt – Speichern gesperrt', libnewer: 'Bibliothek aus neuerer Version',
  playonly: 'Track fehlt – nur spielbar', nosnip: 'Snippets fehlen – Bank nicht ladbar', idtaken: 'Bank existiert schon',
  notempo: 'Kein Tempo erkannt', superseded: 'Neuere Suche läuft', badreq: 'Ungültiger Befehl',
};
const WRITE = ['rename', 'duplicate', 'delete', 'move', 'restore', 'setstart', 'setstarts', 'swap', 'roll', 'newbank', 'tempo', 'tempook', 'fetch', 'fetchall'];

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
function makeStarts(video, seed) { const b = bars(video), out = []; for (let i = 0; out.length < 16; i++) { const t = b[(seed * 7 + i * 5) % b.length]; if (!out.includes(t)) out.push(t); } return out.sort((a, c) => a - c); }

function scenarioLib(name) {
  const ids = Object.keys(VIDEOS).slice(0, 7);
  const lib = { rev: 57, nextId: 13, banks: [], videos: {} };
  const names = ['Rockit Scratches', 'Vitamin C', 'Water No Get Enemy', 'Numbers – nur Stimmen', 'UFO', 'Cavern', 'Cissy Strut'];
  ids.forEach((v, k) => {
    lib.banks.push({ id: [7, 3, 9, 4, 11, 2, 12][k], name: names[k], video: v, starts: makeStarts(v, k), snip: 'ok', wav: true });
    lib.videos[v] = { title: VIDEOS[v][0] };
  });
  lib.videos.Rk7tQ2mLp0A.bpm = 97;
  lib.videos.Kw8Numbers0.bpm = 112;
  lib.banks[2].wav = false;                                                  // nur spielbar
  lib.videos.Fk4WaterNoG.fail = 'Video nicht verfügbar';
  lib.banks[4].wav = false; lib.banks[4].snip = 'missing';                   // nicht ladbar
  lib.state = 'ok';
  if (name === 'leer') { lib.banks = []; lib.videos = {}; lib.state = 'leer'; }
  if (name === 'kaputt') { lib.banks = []; lib.videos = {}; lib.state = 'kaputt'; lib.error = ERR.libbroken + ' (Zeile 14: unerwartetes Komma)'; }
  if (name === 'neuer') { lib.banks = []; lib.videos = {}; lib.state = 'neuer'; lib.error = ERR.libnewer; }
  return lib;
}

function createMock(opts = {}) {
  const m = {
    log: [], clients: new Set(), down: false, session: 1, track: '3-YT Sampler', port: 0,
    lib: null, dev: null, beatsOk: null, searchSeq: 0, slowSearch: 0,
  };
  const spanOf = () => Array.from({ length: 16 }, (_, i) => 1800 + i * 40);
  function devFor(b) {
    return { bankId: b ? b.id : 0, nr: b ? m.lib.banks.indexOf(b) + 1 : 0, video: b ? b.video : '-', sel: m.dev ? m.dev.sel : 0, mode: 0,
      rev: 0, starts: b ? b.starts.slice() : [], spans: spanOf(), teletext: null };
  }
  m.scenario = function (name) {
    m.name = name;
    m.lib = scenarioLib(name);
    const b = m.lib.banks[name === 'nurspielbar' ? 2 : 0];
    m.dev = devFor(b);
    if (name === 'keinebank') { m.dev = devFor(null); m.dev.video = 'Mt3CissyStr'; m.dev.starts = makeStarts('Mt3CissyStr', 3); }
    m.beatsOk = null;
    broadcastAll();
  };
  const byId = (id) => m.lib.banks.find((b) => b.id === id);
  function libMsg(by) {
    const { rev, state, error, banks, videos } = m.lib;
    return { rev, by, state, error, cache: cacheMsg(), banks, videos };
  }
  function cacheMsg() { const bytes = opts.cacheBytes != null ? opts.cacheBytes : 4.2e9; return { bytes, warn: bytes >= 1e10 }; }
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
  function syncDev() { const b = byId(m.dev.bankId); if (b) { m.dev = devFor(b); m.emit('device', m.dev); } }
  m.setDown = function (d) { m.down = d; if (d) for (const c of m.clients) c.destroy(); };
  m.close = () => new Promise((r) => { for (const c of m.clients) c.destroy(); m.server.close(r); });

  const fail = (code) => ({ ok: false, code, text: ERR[code] || code });
  const isPad = (p) => Number.isInteger(p) && p >= 0 && p <= 15;
  function job(kind, extra, done) {
    let p = 0;
    const t = setInterval(() => {
      p = Math.min(1, p + 0.25);
      m.emit('job', { kind, ...extra, phase: p < 1 ? 'download' : 'done', progress: p, left: 0, ...(p < 1 ? {} : done()) });
      if (p >= 1) clearInterval(t);
    }, opts.jobStep || 250);
  }

  function cmd(q) {
    const c = q.cmd, b = q.id != null ? byId(q.id) : null;
    if (WRITE.includes(c) && (m.lib.state === 'kaputt' || m.lib.state === 'neuer')) return fail(m.lib.state === 'kaputt' ? 'libbroken' : 'libnewer');
    if (['select', 'rename', 'duplicate', 'delete', 'move', 'setstart', 'setstarts', 'swap', 'roll'].includes(c) && !b) return fail(q.id == null ? 'badreq' : 'nobank');
    switch (c) {
      case 'select':
        if (b.snip === 'missing' && !b.wav) return fail('nosnip');
        activate(b); return { ok: true };
      case 'rename':
        if (typeof q.name !== 'string') return fail('badreq');
        b.name = q.name.trim().slice(0, 100); changed(q.client); return { ok: true };
      case 'duplicate': {
        const k = { ...b, id: m.lib.nextId++, name: b.name + ' (Kopie)', starts: b.starts.slice() };
        m.lib.banks.splice(m.lib.banks.indexOf(b) + 1, 0, k); changed(q.client); activate(k); return { ok: true, id: k.id };
      }
      case 'delete': {
        const at = m.lib.banks.indexOf(b) + 1, v = m.lib.videos[b.video];
        m.lib.banks.splice(at - 1, 1);
        const video = { title: v.title }; if (v.bpm) video.bpm = v.bpm;
        if (!m.lib.banks.some((x) => x.video === b.video)) delete m.lib.videos[b.video];
        if (!m.lib.banks.length) m.lib.state = 'leer';
        changed(q.client);
        if (m.dev.bankId === b.id) activate(m.lib.banks[Math.min(at - 1, m.lib.banks.length - 1)] || null); else syncDev();
        const { snip, wav, ...bank } = b;
        return { ok: true, removed: { bank, at, video } };
      }
      case 'move': {
        if (!Number.isInteger(q.to) || q.to < 1 || q.to > m.lib.banks.length) return fail('badreq');
        m.lib.banks.splice(m.lib.banks.indexOf(b), 1); m.lib.banks.splice(q.to - 1, 0, b); changed(q.client); syncDev(); return { ok: true };
      }
      case 'restore': {
        const r = q.bank; if (!r || !Number.isInteger(r.id) || !Number.isInteger(q.at)) return fail('badreq');
        if (r.id >= m.lib.nextId || byId(r.id)) return fail('idtaken');
        if (!m.lib.videos[r.video]) m.lib.videos[r.video] = { ...q.video };
        m.lib.banks.splice(Math.min(q.at - 1, m.lib.banks.length), 0, { ...r, starts: r.starts.slice(), snip: 'ok', wav: true });
        m.lib.state = 'ok'; changed(q.client); syncDev(); return { ok: true };
      }
      case 'setstart':
        if (!isPad(q.pad) || !Number.isInteger(q.ms) || q.ms < 0) return fail('badreq');
        if (!b.wav) return fail('playonly');
        b.starts[q.pad] = q.ms; changed(q.client); syncDev(); return { ok: true };
      case 'setstarts':
        if (!Array.isArray(q.starts) || q.starts.length !== 16) return fail('badreq');
        if (!b.wav && !q.starts.every((s) => b.starts.includes(s))) return fail('playonly');
        b.starts = q.starts.slice(); changed(q.client); syncDev(); return { ok: true };
      case 'swap':
        if (!isPad(q.a) || !isPad(q.b)) return fail('badreq');
        [b.starts[q.a], b.starts[q.b]] = [b.starts[q.b], b.starts[q.a]]; changed(q.client); syncDev(); return { ok: true };
      case 'roll': {
        if (!isPad(q.pad)) return fail('badreq');
        if (!b.wav) return fail('playonly');
        const free = bars(b.video).filter((t) => !b.starts.includes(t)), ms = free[Math.floor(Math.random() * free.length)];
        b.starts[q.pad] = ms; changed(q.client); syncDev(); return { ok: true, ms };
      }
      case 'hit': case 'up': {
        if (!isPad(q.pad)) return fail('badreq');
        if (c === 'up') { m.emit('stop', { pad: q.pad }); return { ok: true }; }
        const from = m.dev.starts[q.pad], dur = m.dev.spans[q.pad];
        m.dev.sel = q.pad; m.emit('device', m.dev); m.emit('play', { pad: q.pad, from, to: from + dur, dur });
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
      case 'newbank': {
        const v = q.video; if (!VIDEOS[v]) return fail('badreq');
        job('newbank', { video: v }, () => {
          const k = { id: m.lib.nextId++, name: VIDEOS[v][0], video: v, starts: makeStarts(v, m.lib.nextId), snip: 'ok', wav: true };
          if (!m.lib.videos[v]) m.lib.videos[v] = { title: VIDEOS[v][0] };
          m.lib.banks.push(k); m.lib.state = 'ok'; changed(q.client); activate(k);
          return { bankId: k.id };
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
          for (const x of m.lib.banks) if (x.video === v) { x.wav = true; if (x.snip === 'missing') x.snip = 'ok'; }
          m.emit('lib', libMsg(q.client)); return {};
        });
        return { ok: true };
      }
      case 'fetchall': return { ok: true, todo: m.lib.banks.filter((x) => !x.wav).length };
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
    const pk = u.pathname.match(/^\/peaks\/(.*)$/);
    if (pk) {
      if (!/^[\w-]{11}$/.test(pk[1])) { res.writeHead(400); return res.end(); }
      const b = m.lib.banks.find((x) => x.video === pk[1]);
      if (!VIDEOS[pk[1]] || (b && !b.wav)) { res.writeHead(404); return res.end(); }
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

module.exports = { createMock, VIDEOS };

if (require.main === module) {
  const port = Number(process.argv[2] || 8790), sc = process.argv[3] || 'normal';
  if (port >= 8765 && port <= 8770) { console.error('8765–8770 gehört dem echten Device'); process.exit(1); }
  createMock({ scenario: sc }).listen(port).then((m) => {
    console.log(`Attrappe läuft: http://localhost:${m.port}/editor  (Szenario ${sc})`);
    console.log(`Umschalten: http://localhost:${m.port}/mock/<normal|nurspielbar|keinebank|leer|kaputt|neuer|down|up>`);
  });
}
