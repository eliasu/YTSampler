// Mini-CDP: Chrome headless über das DevTools-Protokoll (Node ≥ 22 hat WebSocket), ohne Playwright.
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { sleep } = require('./harness');

const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SHOTS = path.join(__dirname, 'editor_screens');
const W = 1440, H = 900;

async function launch() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'yts-chrome-'));
  const proc = spawn(CHROME, ['--headless=new', '--remote-debugging-port=0', '--user-data-dir=' + dir, '--no-first-run',
    '--no-default-browser-check', '--disable-extensions', '--hide-scrollbars', `--window-size=${W},${H}`, 'about:blank'], { stdio: 'ignore', env: { ...process.env, HOME: os.userInfo().homedir } });   // harness biegt HOME um, daran hängt Chrome
  let port;
  for (let k = 0; k < 100 && !port; k++) {
    await sleep(100);
    try { port = fs.readFileSync(path.join(dir, 'DevToolsActivePort'), 'utf8').split('\n')[0]; } catch { /* noch nicht da */ }
  }
  if (!port) throw new Error('Chrome startet nicht');
  const page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((x) => x.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const wait = new Map(), errors = [];
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && wait.has(m.id)) { const [r, j] = wait.get(m.id); wait.delete(m.id); m.error ? j(new Error(m.error.message)) : r(m.result); }
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map((a) => a.value || a.description).join(' '));
  };
  const send = (method, params = {}) => new Promise((r, j) => { wait.set(++id, [r, j]); ws.send(JSON.stringify({ id, method, params })); });
  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 0, height: 0, deviceScaleFactor: 2, mobile: false }); // Größe aus --window-size, sonst stimmt 100vh nicht
  const b = {
    send, errors,
    async eval(expr) {
      const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error('eval: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
      return r.result.value;
    },
    async waitFor(expr, ms = 3000) {
      const end = Date.now() + ms;
      for (;;) { if (await b.eval(expr)) return; if (Date.now() > end) throw new Error('Zeitüberschreitung: ' + expr); await sleep(30); }
    },
    async center(sel) {
      const r = await b.eval(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const r = e.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
        const top = document.elementFromPoint(x, y); return [x, y, !top || e.contains(top) || top.contains(e) ? '' : top.outerHTML.slice(0, 100)]; })()`);
      if (!r) throw new Error('fehlt: ' + sel);
      if (r[2] && !sel.startsWith('#vsplit') && !sel.startsWith('#hsplit')) throw new Error(sel + ' verdeckt von ' + r[2]);
      return r;
    },
    pressed: false,
    mouse(type, x, y, modifiers = 0, clickCount = 1) {
      if (type !== 'mouseMoved') b.pressed = type === 'mousePressed';
      return send('Input.dispatchMouseEvent', { type, x, y, modifiers, button: b.pressed || type === 'mouseReleased' ? 'left' : 'none', buttons: b.pressed ? 1 : 0, clickCount });
    },
    async click(sel, clickCount = 1) { const [x, y] = await b.center(sel); await b.mouse('mouseMoved', x, y); await b.mouse('mousePressed', x, y, 0, clickCount); await b.mouse('mouseReleased', x, y, 0, clickCount); },
    async key(key, code, vk, modifiers = 0) {
      await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key, code, windowsVirtualKeyCode: vk, modifiers });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: vk, modifiers });
    },
    type: (text) => send('Input.insertText', { text }),
    async shot(name) {
      const r = await send('Page.captureScreenshot', { format: 'png' });
      fs.mkdirSync(SHOTS, { recursive: true }); fs.writeFileSync(path.join(SHOTS, name + '.png'), Buffer.from(r.data, 'base64'));
    },
    close() { ws.close(); proc.kill(); setTimeout(() => fs.rmSync(dir, { recursive: true, force: true }), 300); },
  };
  return b;
}
module.exports = { launch };
