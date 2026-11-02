// Analyse (Spec 2.4; pro Pad: Mix-Spec 2.3, 3.3) und Würfeln (Spec 3.1): node tools/tests/test_analysis.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { tempHome, loadNode, t, run, sleep } = require('./harness');
const { SR, beatWav, writeWav, signalWav } = require('./wav');

const V = 'BBBBBBBBBBB';
const SEC = 90, SIL = [20, 45];   // 120 BPM, Takt = 2 s, Stille 20–45 s
const LEAD = 12;                  // BEAT_LEAD_MS
let wavCopy = null;               // einmal erzeugen, dann kopieren

function setup() {
  const home = tempHome(false);
  const { node, max } = loadNode(home);
  const wav = path.join(node.CACHE, `${V}.wav`);
  if (!wavCopy) { beatWav(wav, SEC, 120, SIL); wavCopy = fs.readFileSync(wav); } else fs.writeFileSync(wav, wavCopy);
  return { node, max, wav, done: () => fs.rmSync(home, { recursive: true, force: true }) };
}
// Abstand zum nächsten Rasterpunkt (Beats liegen LEAD ms vor dem Einsatz)
const near = (t, grid) => { const r = ((t + LEAD) % grid + grid) % grid; return Math.min(r, grid - r); };
const mod = (x, n) => ((x % n) + n) % n;
const until = async (fn, what, ms = 30000) => { const t0 = Date.now(); while (!fn()) { if (Date.now() - t0 > ms) throw new Error('Zeit um: ' + what); await sleep(10); } };
const ST = Array.from({ length: 16 }, (_, i) => i * 1000);
const mkBank = (node, v, starts = ST) => node.libChange('create', { video: v, title: 'T', starts }, 't').id;
// Was das Device beim Laden der Bank bekommt (bankopen), bis analysisready. Ohne status.
async function deviceOut(node, max, id) {
  max.out.length = 0;
  max.handlers.bankopen(id);
  await until(() => max.out.some((m) => m[0] === 'analysisready'), 'analysisready');
  return max.out.filter((m) => m[0] !== 'status');
}
const padana = (out) => out.filter((m) => m[0] === 'padana').map((m) => ({ i: m[1], bpm: m[2], cent: m[3], off: m[4], beats: m.slice(5) }));
const statusOf = (max) => max.out.filter((m) => m[0] === 'status' && !/yt-dlp/.test(m[1])).map((m) => m[1]);

t('Tempo, Beats und „1“ aus erzeugter WAV, Beats gültig', () => {
  const { node, done } = setup();
  const a = node.getAnalysis(V, false);
  assert.ok(Math.abs(a.bpm - 120) < 1, `bpm ${a.bpm}`);
  assert.ok(a.bpmConf >= 0.3, `conf ${a.bpmConf}`);
  const b = node.videoBeats(V);
  assert.strictEqual(b.ok, true);
  assert.strictEqual(b.confirmed, false);
  const audible = b.beats.filter((x) => x < SIL[0] * 1000 - 500 || x > SIL[1] * 1000 + 500);
  assert.ok(audible.every((x) => near(x, 500) < 25), 'Beats auf dem 500-ms-Raster');
  assert.ok(near(b.beats[b.down], 2000) < 25, `„1“ bei ${b.beats[b.down]} ms`);
  done();
});

t('Ergebnis aus dem Bank-Ordner gleich wie aus der WAV, ohne ganze WAV; kein silence; Status Track-Bank', async () => {
  const { node, max, wav, done } = setup();
  const id = mkBank(node, V);
  const fromCache = await deviceOut(node, max, id);
  const sel = fromCache.map((m) => m[0]);
  assert.deepStrictEqual(sel, ['bankname', 'bank', ...Array(16).fill('padana'), ...Array(16).fill('padinfo'), 'analysisready']);
  assert.match(statusOf(max).pop(), /^Bereit: T · 12\d(\.\d)? BPM · Stimmung [+-]\d+ ct$/);
  fs.unlinkSync(wav);
  fs.unlinkSync(path.join(node.CACHE, `${V}.chroma`));
  const fromBank = await deviceOut(node, max, id);
  assert.deepStrictEqual(fromBank, fromCache);
  assert.ok(node.anaMap.get(V));
  done();
});

t('Analyse fehlt ohne WAV: padana ohne Tempo und Schläge, analysisready, Status', async () => {
  const { node, max, wav, done } = setup();
  const id = mkBank(node, V);
  node.cutSnippets(node.libNow.lib.banks[0]);
  fs.unlinkSync(wav);
  for (const f of [path.join(node.CACHE, `${V}.chroma`), path.join(node.SNIP_DIR, `${V}.chroma`)]) fs.unlinkSync(f);
  const out = await deviceOut(node, max, id);
  assert.deepStrictEqual(padana(out), ST.map((_, i) => ({ i, bpm: 0, cent: 0, off: 0, beats: [] })));
  assert.ok(!out.some((m) => m[0] === 'padinfo'));
  assert.deepStrictEqual(statusOf(max), ['Analyse fehlt bei 16 Pads – im Editor neu schneiden']);
  assert.strictEqual(node.anaMap.get(V), null);
  // bestätigtes Tempo: Warp geht weiter
  node.libChange('tempo', { video: V, bpm: 120 }, 't');
  assert.ok(padana(await deviceOut(node, max, id)).every((p) => p.bpm === 120 && p.beats.length === 0));
  done();
});

t('Analyse fehlt in D, WAV da: neu rechnen und ablegen', async () => {
  const { node, max, done } = setup();
  const id = mkBank(node, V);
  node.cutSnippets(node.libNow.lib.banks[0]);
  fs.unlinkSync(path.join(node.SNIP_DIR, `${V}.chroma`));
  const out = await deviceOut(node, max, id);
  assert.ok(fs.existsSync(path.join(node.SNIP_DIR, `${V}.chroma`)));
  assert.ok(padana(out).every((p) => p.bpm > 0));
  done();
});

t('padana pro Pad für zwei Videos: bpm, cent, Fenster ± 4 Schläge, off auf die „1“; Tempo-Korrektur nur für Pads dieses Videos', async () => {
  const { node, max, done } = setup();
  const X = 'XXXXXXXXXXX';
  beatWav(path.join(node.CACHE, `${X}.wav`), 60, 100);   // 100 BPM: Schlag 600 ms, Takt 2400 ms
  mkBank(node, V);
  const { id } = node.libChange('newmix', {}, 't');
  node.libChange('setpad', { id, pad: 0, video: V, start: 8000 }, 't');
  node.libChange('setpad', { id, pad: 1, video: X, start: 6000, info: { title: 'X' } }, 't');
  node.libChange('setpad', { id, pad: 3, video: X, start: 50000 }, 't');   // nur 10 s bis zum Ende
  const out = await deviceOut(node, max, id);
  assert.deepStrictEqual(out[1], ['bank', id, 2, 8000, 6000, 0, 50000, ...Array(12).fill(0), 16000, 16000, 0, 10000, ...Array(12).fill(0), path.join(node.SNIP_DIR, `${id}.wav`)]);
  const pa = padana(out);
  assert.deepStrictEqual(pa.map((p) => p.i), [0, 1, 3], 'leere Plätze: kein padana');
  assert.deepStrictEqual(out.filter((m) => m[0] === 'padinfo').map((m) => m[1]), [0, 1, 3]);
  const [p0, p1, p3] = pa;
  assert.ok(Math.abs(p0.bpm - 120) < 1 && Math.abs(p1.bpm - 100) < 1, `bpm ${p0.bpm} ${p1.bpm}`);
  assert.strictEqual(p0.cent, Math.round(node.anaMap.get(V).tuning * 100));
  assert.strictEqual(p1.cent, Math.round(node.anaMap.get(X).tuning * 100));
  for (const [p, start, len, beat] of [[p0, 8000, 16000, 500], [p1, 6000, 16000, 600], [p3, 50000, 10000, 600]]) {
    const from = start - 4 * 60000 / p.bpm, to = start + len + 4 * 60000 / p.bpm;
    assert.ok(p.beats.every((x) => x >= from && x <= to), `Pad ${p.i} im Fenster`);
    assert.ok(p.beats[0] - from < beat + 30 && Math.min(to, p.i === 3 ? 60000 : to) - p.beats[p.beats.length - 1] < beat + 30, `Pad ${p.i} Fenster voll`);   // Pad 4 endet mit dem Track
    assert.ok(p.beats.length < 200);
    // Takt-Einsen nach off liegen auf den Takten der Quelle (Rand nach der Stille von V ausgenommen)
    const bar = 4 * beat;
    const ones = p.beats.filter((x, j) => mod(p.off + j, 4) === 0 && (p.i || x < SIL[0] * 1000 - 500));
    assert.ok(ones.length >= 3 && ones.every((x) => near(x, bar) < 30), `Pad ${p.i}: Einsen ${ones}`);
  }
  assert.match(statusOf(max).pop(), /^Bereit: Neue Bank · 2 Tracks$/);

  // Tempo-Korrektur: padana nur für Pads mit X
  max.out.length = 0;
  await node.runCmd({ cmd: 'tempo', video: X, bpm: 101 });
  const again = padana(max.out);
  assert.deepStrictEqual(again.map((p) => [p.i, p.bpm]), [[1, 101], [3, 101]]);
  assert.ok(!max.out.some((m) => m[0] === 'bpm'), 'bpm <video> <bpm> gibt es nicht mehr');
  max.out.length = 0;
  await node.runCmd({ cmd: 'tempook', video: V });
  assert.deepStrictEqual(padana(max.out).map((p) => p.i), [0]);
  for (const h of ['beattrack', 'analyzeall']) assert.ok(!(h in max.handlers), h);
  done();
});

// Version 3 von Hand gebaut (nicht mit saveAnalysis), damit eine Formatänderung den alten Leser nicht still mitnimmt
function v3File(file, version = 3, extra = 0) {
  const nf = 3, no = 5, S = 14;
  const head = [version, 5512.5, 0.125, nf, 99.5, 0.42, 86.1, no];
  const arr = Float32Array.from([...head, ...Array(no).fill(1), ...Array(no).fill(2), ...Array.from({ length: nf * S }, (_, i) => i), ...Array(extra).fill(7)]);
  fs.writeFileSync(file, Buffer.from(arr.buffer));
}

t('alte .chroma-Version 3 bleibt lesbar', () => {
  const { node, done } = setup();
  const f = path.join(node.SNIP_DIR, 'v3.chroma');
  v3File(f);
  const a = node.readAnalysis(f);
  assert.deepStrictEqual([a.srd, a.tuning, a.nf, a.bpm, a.bpmConf], [5512.5, 0.125, 3, 99.5, 0.42]);
  assert.ok(Math.abs(a.fps - 86.1) < 1e-4);
  assert.deepStrictEqual([...a.onset], [1, 1, 1, 1, 1]);
  assert.deepStrictEqual([...a.bass], [2, 2, 2, 2, 2]);
  assert.strictEqual(a.frames.length, 42);
  assert.strictEqual(a.frames[41], 41);
  done();
});

// Tempo-Konfidenz: klarer Puls deutlich über 0,5, ohne Puls nahe 0 (TEMPO_MIN_CONF = 0,3)
t('Tempo-Konfidenz: Beat hoch, Swing/dichter Mix über 0,5, Flächen, Rauschen, Gerede niedrig', () => {
  const { node, done } = setup();
  const dir = path.join(node.CACHE, 'sig');
  const an = (name, ...args) => { const f = path.join(dir, `${name}.wav`); signalWav(f, name, 30, ...args); return node.computeAnalysis(f); };
  const b = node.getAnalysis(V, false);
  assert.ok(b.bpmConf > 0.8, `Beat ${b.bpmConf}`);
  const sw = an('swing', 124), bu = an('busy', 126), dr = an('drums');
  assert.ok(sw.bpmConf > 0.6 && Math.abs(sw.bpm - 124) <= 0.3, `Swing ${sw.bpm} ${sw.bpmConf}`);
  assert.ok(bu.bpmConf > 0.5 && Math.abs(bu.bpm - 126) <= 0.3, `dichter Mix ${bu.bpm} ${bu.bpmConf}`);
  assert.ok(dr.bpmConf > 0.8 && Math.abs(dr.bpm - 120) <= 0.3, `Drums ${dr.bpm} ${dr.bpmConf}`);
  for (const n of ['pad', 'noise', 'random']) { const a = an(n); assert.ok(a.bpmConf < 0.1, `${n} ${a.bpmConf}`); }
  done();
});

t('Tempo aus der Einsatzkurve neu beim Lesen: alte Konfidenz im Kopf zählt nicht', () => {
  const { node, done } = setup();
  const a = node.getAnalysis(V, false);
  const f = path.join(node.SNIP_DIR, `${V}.chroma`);
  node.saveAnalysis(f, { ...a, bpm: 126, bpmConf: 0.29 });   // wie mit der Formel bis 2.0.1 gespeichert
  const r = node.readAnalysis(f);
  assert.strictEqual(r.bpm, a.bpm);
  assert.strictEqual(r.bpmConf, a.bpmConf);
  assert.ok(Math.abs(r.bpm - 120) <= 0.1, `bpm ${r.bpm}`);
  done();
});

// Tonart-Konfidenz (padinfo): tonal über 0,5, Drums und Rauschen darunter; dichter Mix mit Flatness ~0,46 bleibt tonal
t('Tonart-Konfidenz: Akkorde über 0,5 mit richtiger Tonart, Drums/Rauschen nahe 0', async () => {
  const { node, max, done } = setup();
  // padinfo der Pads 1–3 (Fenster 4 s ab Start), über eine Bank des Videos
  const info = async (v, name, ...args) => {
    if (name) signalWav(path.join(node.CACHE, `${v}.wav`), name, 30, ...args);
    const st = [3000, 12000, v === V ? 60000 : 21000, ...Array(13).fill(0)];   // V ist von 20–45 s still
    const out = await deviceOut(node, max, mkBank(node, v, st));
    return out.filter((m) => m[0] === 'padinfo' && m[1] < 3).map((m) => ({ conf: m[2], tonic: m[3], minor: m[4] }));
  };
  for (const p of await info(V)) assert.ok(p.conf > 0.5 && p.tonic === 9 && p.minor === 1, `a-Moll ${JSON.stringify(p)}`);
  for (const p of await info('PPPPPPPPPPP', 'pad')) assert.ok(p.conf > 0.5, `Flächen ${p.conf}`);
  for (const p of await info('MMMMMMMMMMM', 'busy')) assert.ok(p.conf > 0.5 && p.tonic === 7 && p.minor === 0, `G-Dur im Mix ${JSON.stringify(p)}`);
  // Snare und Hi-Hats. ponytail: Eine Kick mit Tonhöhe ist für Flatness + Chroma tonal (Flatness 0,3–0,6 wie Musik),
  // Drum-Pads mit lauter Kick landen deshalb hoch, wie schon vor dieser Änderung. Trennen ginge nur mit neuem Analyseformat.
  for (const p of await info('DDDDDDDDDDD', 'drums', 0)) assert.ok(p.conf < 0.2, `Drums ${p.conf}`);
  for (const p of await info('NNNNNNNNNNN', 'noise')) assert.ok(p.conf < 0.2, `Rauschen ${p.conf}`);
  done();
});

t('unbekannte Version oder falsche Länge = Analyse fehlt', () => {
  const { node, done } = setup();
  const f = path.join(node.SNIP_DIR, 'x.chroma');
  for (const [v, extra] of [[1, 0], [2, 0], [99, 0], [3, 1]]) {
    v3File(f, v, extra);
    assert.strictEqual(node.readAnalysis(f), null, `Version ${v} +${extra}`);
  }
  done();
});

t('neuere Analyse in D wird nie überschrieben', () => {
  const { node, done } = setup();
  const f = path.join(node.SNIP_DIR, `${V}.chroma`);
  v3File(f, node.AN.VERSION + 1);
  const before = fs.readFileSync(f);
  assert.ok(node.getAnalysis(V, true));
  assert.ok(fs.readFileSync(f).equals(before));
  done();
});

t('newbank-Würfeln: 16 Starts aufsteigend, ganz, verschieden, auf Taktanfängen, nie ganz in Stille', () => {
  const { node, done } = setup();
  for (let n = 0; n < 5; n++) {
    const s = node.rollBank(V);
    assert.strictEqual(s.length, 16);
    assert.deepStrictEqual(s, [...s].sort((x, y) => x - y));
    assert.strictEqual(new Set(s).size, 16);
    for (const x of s) {
      assert.ok(Number.isInteger(x) && x >= 0 && x <= (SEC - 16) * 1000, `Start ${x}`);
      assert.ok(near(x, 2000) < 30, `Start ${x} nicht auf Taktanfang`);
      assert.ok(!(x >= SIL[0] * 1000 && x + 16000 <= SIL[1] * 1000), `Start ${x} ganz in Stille`);
    }
  }
  done();
});

t('roll: ein Start, nicht schon belegt', () => {
  const { node, done } = setup();
  const taken = node.rollBank(V);
  for (let n = 0; n < 20; n++) assert.ok(!taken.includes(node.rollStart(V, taken)));
  done();
});

t('ohne gültige Beats frei würfeln, bestätigtes bpm macht Beats gültig', () => {
  const home = tempHome(false);
  const { node } = loadNode(home);
  const W = 'NNNNNNNNNNN';
  writeWav(path.join(node.CACHE, `${W}.wav`), 40 * SR, (f) => { const s = Math.round(6000 * Math.sin(2 * Math.PI * 220 * f / SR)); return [s, s]; });
  const b = node.videoBeats(W);
  assert.strictEqual(b.ok, false);
  const s = node.rollBank(W);
  assert.strictEqual(new Set(s).size, 16);
  assert.ok(s.every((x) => Number.isInteger(x) && x >= 0 && x <= 24000));
  assert.ok(s.some((x) => near(x, 2000) > 30), 'frei, nicht auf einem Raster');
  node.libChange('create', { video: W, title: 'Sinus', starts: s }, 't');
  node.libChange('tempo', { video: W, bpm: 120 }, 't');
  const c = node.videoBeats(W);
  assert.strictEqual(c.confirmed, true);
  assert.strictEqual(c.bpm, 120);
  assert.strictEqual(c.ok, c.beats.length >= 4);
  fs.rmSync(home, { recursive: true, force: true });
});

run();
