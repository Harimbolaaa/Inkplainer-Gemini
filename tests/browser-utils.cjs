/* Dependency-free Chromium/CDP harness. Uses the already running static server. */
const { spawn } = require('node:child_process');
const { mkdtempSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');

async function browser() {
  const profile = mkdtempSync(join(tmpdir(), 'inkplainer-test-'));
  const child = spawn(process.env.CHROMIUM_BIN || 'chromium', [
    '--headless', '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu',
    '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0',
    '--window-size=1600,1000', `--user-data-dir=${profile}`, 'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  const debuggerURL = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Chromium did not start')), 20000);
    child.on('error', reject);
    child.on('exit', code => { if (code) reject(new Error(`Chromium exited ${code}`)); });
    child.stderr.on('data', data => {
      const match = data.toString().match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match) { clearTimeout(timer); resolve(match[1]); }
    });
  });
  const port = new URL(debuggerURL).port;
  const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const ws = new WebSocket(pages.find(p => p.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let seq = 0;
  const pending = new Map(), events = new Map();
  ws.addEventListener('message', event => {
    const msg = JSON.parse(event.data);
    if (msg.id) {
      const handler = pending.get(msg.id);
      if (!handler) return;
      clearTimeout(handler.timer); pending.delete(msg.id);
      if (msg.error) handler.reject(new Error(msg.error.message));
      else handler.resolve(msg.result);
    } else {
      for (const callback of events.get(msg.method) || []) callback(msg.params);
    }
  });
  const call = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++seq;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 30000);
    pending.set(id, { resolve, reject, timer });
    ws.send(JSON.stringify({ id, method, params }));
  });
  const on = (event, callback) => {
    if (!events.has(event)) events.set(event, []);
    events.get(event).push(callback);
  };
  const evaluate = async expression => {
    const result = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  };
  const waitFor = async (expression, timeout = 10000) => {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      try { if (await evaluate(expression)) return; } catch (_) { /* Navigation can replace the execution context. */ }
      await new Promise(r => setTimeout(r, 80));
    }
    throw new Error(`Timed out waiting for: ${expression}`);
  };
  const screenshot = async path => {
    const shot = await call('Page.captureScreenshot', { format: 'png' });
    writeFileSync(path, Buffer.from(shot.data, 'base64'));
  };
  return {
    call, on, evaluate, waitFor, screenshot,
    async close() {
      for (const p of pending.values()) { clearTimeout(p.timer); p.reject(new Error('Browser closed')); }
      pending.clear();
      ws.close();
      child.kill('SIGTERM');
      await new Promise(resolve => { if (child.exitCode !== null) resolve(); else child.once('exit', resolve); });
      try { rmSync(profile, { recursive: true, force: true }); } catch (_) {}
    },
  };
}
module.exports = { browser };
