// Lädt ytsampler_node.js mit Attrappe für max-api in einem Temp-HOME.
// Nie der echte Datenordner, nie Port 8765 (YTS_PORT=0 = freier Port).
const Module = require('module');
const fs = require('fs');
const os = require('os');
const path = require('path');

const NODE_FILE = path.join(__dirname, '..', '..', 'ytsampler_node.js');
process.env.YTS_PORT = '0';
process.setMaxListeners(0);   // jedes loadNode hängt exit-Handler an

const TMP = fs.realpathSync(os.tmpdir());
function tempHome(icloud) {
  const home = fs.mkdtempSync(path.join(TMP, 'yts-test-'));
  if (icloud) fs.mkdirSync(path.join(home, 'Library', 'Mobile Documents', 'com~apple~CloudDocs'), { recursive: true });
  return home;
}

function loadNode(home) {
  if (!fs.realpathSync(home).startsWith(TMP)) throw new Error('Test-HOME muss im Temp-Ordner liegen: ' + home);
  process.env.HOME = home;
  const max = {
    out: [], handlers: {},
    outlet: (...a) => max.out.push(a),
    post: () => {},
    addHandler: (n, f) => { max.handlers[n] = f; },
  };
  const orig = Module._load;
  Module._load = function (req, ...rest) { return req === 'max-api' ? max : orig.call(this, req, ...rest); };
  try {
    delete require.cache[NODE_FILE];
    return { node: require(NODE_FILE), max };
  } finally { Module._load = orig; }
}

// Mini-Runner: t('name', fn) sammelt, run() führt der Reihe nach aus und beendet den Prozess
const tests = [];
const t = (name, fn) => tests.push([name, fn]);
async function run() {
  let bad = 0;
  for (const [name, fn] of tests) {
    try { await fn(); console.log('ok   ' + name); } catch (e) { bad++; console.log('FAIL ' + name + '\n     ' + (e.stack || e).toString().split('\n').slice(0, 12).join('\n     ')); }
  }
  console.log(bad ? `${bad} von ${tests.length} fehlgeschlagen` : `alle ${tests.length} grün`);
  process.exit(bad ? 1 : 0);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

module.exports = { tempHome, loadNode, t, run, sleep };
