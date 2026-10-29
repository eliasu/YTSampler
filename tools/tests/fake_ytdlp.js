// Attrappe für yt-dlp. Umgebung: FAKE_WAV (wird als Ergebnis kopiert), FAKE_LOG (Protokoll), FAKE_DELAY (ms pro Fortschrittszeile).
// Video-IDs mit „FAIL“ scheitern. Protokoll: "start <id>", "end <id>", "kill <id>".
const fs = require('fs');
const args = process.argv.slice(2);
// Suche: "ytsearchN:<begriff>". Begriff mit „FAIL“ scheitert, sonst nach FAKE_DELAY drei Treffer (einer ohne Dauer)
const sq = /^ytsearch\d+:(.*)$/.exec(args[args.length - 1]);
if (sq) {
  if (sq[1].includes('FAIL')) { process.stderr.write('ERROR: Suche kaputt\n'); process.exit(1); }
  setTimeout(() => {
    process.stdout.write(JSON.stringify({ entries: [{ id: 'SuchTreffer', title: `${sq[1]}, eins`, duration: 200 },
      { id: 'LiveStream0', title: 'live', duration: null }, { id: 'LangerTrack', title: 'lang', duration: 3600 }] }));
  }, +process.env.FAKE_DELAY || 0);
  return;
}
const id = (args[args.length - 1].match(/v=([\w-]{11})/) || [])[1];
const log = (s) => fs.appendFileSync(process.env.FAKE_LOG, s + '\n');

if (id.startsWith('FAIL')) { process.stderr.write('ERROR: Video unavailable\n'); process.exit(1); }
if (args.includes('-J')) { process.stdout.write(JSON.stringify({ id, title: `Titel; ${id}`, duration: 100 })); process.exit(0); }

const out = args[args.indexOf('-o') + 1];
process.on('SIGTERM', () => { log('kill ' + id); process.exit(1); });
log('start ' + id);
fs.writeFileSync(out.replace('%(ext)s', 'webm.part'), 'halb');
let p = 0;
const step = () => {
  p += 25;
  process.stdout.write(`[download]  ${p.toFixed(1)}% of 1MiB\n`);
  if (p < 100) { setTimeout(step, +process.env.FAKE_DELAY); return; }
  process.stdout.write('[ExtractAudio] Destination: x.wav\n');
  fs.copyFileSync(process.env.FAKE_WAV, out.replace('%(ext)s', 'wav'));
  log('end ' + id);
};
setTimeout(step, +process.env.FAKE_DELAY);
