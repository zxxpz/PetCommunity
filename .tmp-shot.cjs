/* 无头 Edge + CDP 截图：把 3D 头像裁出来，用于人眼比对。
 * 用法：
 *   OUT=.tmp-head.png DPR=3 CROPFRAC="0.16,0.02,0.68,0.58" node .tmp-shot.cjs
 *   OUT=.tmp-body.png DPR=2 node .tmp-shot.cjs
 */
const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');
const path = require('path');

const PORT = 9333;
const APP = 'http://127.0.0.1:3000/';
const TOKEN = '132a91116fcef6946c2ad7d397dc8ac8505b6e5814198c26';
const TOKEN_KEY = 'meow-kart-auth-token-v1';
const OUT = process.env.OUT || '.tmp-shot.png';
const DPR = Number(process.env.DPR || 2);
const SEL = process.env.SEL || '.cat-stage';
const CROP = (process.env.CROPFRAC || '').split(',').map(Number);
const MODE = process.env.MODE || 'model';

const EDGE_CANDIDATES = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe'
];
const EDGE = EDGE_CANDIDATES.find((p) => fs.existsSync(p));
if (!EDGE) { console.error('找不到 Edge'); process.exit(1); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function httpJson(urlPath) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port: PORT, path: urlPath }, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => { try { resolve(JSON.parse(body)); } catch (e) { reject(e); } });
    });
    req.on('error', reject);
    req.setTimeout(4000, () => req.destroy(new Error('timeout')));
  });
}

function httpPut(urlPath) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: PORT, path: urlPath, method: 'PUT' }, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => { try { resolve(JSON.parse(body)); } catch (e) { reject(e); } });
    });
    req.on('error', reject);
    req.end();
  });
}

(async () => {
  const profile = path.join(require('os').tmpdir(), 'meow-shot-profile');
  const child = spawn(EDGE, [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu-sandbox',
    '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--window-size=1440,1000', 'about:blank'
  ], { stdio: 'ignore', detached: false });

  let target = null;
  for (let i = 0; i < 60; i += 1) {
    try { target = await httpPut(`/json/new?${encodeURIComponent(APP)}`); break; } catch (_) { await sleep(250); }
  }
  if (!target || !target.webSocketDebuggerUrl) { console.error('无法连接 CDP'); child.kill(); process.exit(1); }

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  let nextId = 1;
  const pending = new Map();
  const events = [];
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    else if (msg.method) events.push(msg);
  });
  const send = (method, params) => new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, (msg) => (msg.error ? reject(new Error(`${method}: ${msg.error.message}`)) : resolve(msg.result)));
    ws.send(JSON.stringify({ id, method, params: params || {} }));
  });
  await new Promise((r) => ws.addEventListener('open', r));

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: DPR, mobile: false });
  await send('Page.navigate', { url: APP });
  await sleep(2500);
  await send('Runtime.evaluate', { expression: `localStorage.setItem(${JSON.stringify(TOKEN_KEY)}, ${JSON.stringify(TOKEN)})` });
  await send('Page.reload', {});
  await sleep(9000);

  const errors = [];
  await send('Runtime.evaluate', { expression: '1' });
  const errEvents = events.filter((e) => e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error');
  errEvents.forEach((e) => errors.push(e.params.args.map((a) => a.value || a.description || '').join(' ')));
  const exEvents = events.filter((e) => e.method === 'Runtime.exceptionThrown');
  exEvents.forEach((e) => errors.push(e.params.exceptionDetails.text + ' ' + (e.params.exceptionDetails.exception || {}).description));

  await send('Runtime.evaluate', { expression: `window.__meowPetMode && window.__meowPetMode(${JSON.stringify(MODE)})` });
  await sleep(2600);

  const boxRes = await send('Runtime.evaluate', {
    expression: `(() => { const el = document.querySelector(${JSON.stringify(SEL)}); if (!el) return null; const r = el.getBoundingClientRect(); return JSON.stringify({x:r.x,y:r.y,w:r.width,h:r.height}); })()`,
    returnByValue: true
  });
  const box = JSON.parse(boxRes.result.value || 'null');
  if (!box) { console.error('找不到元素', SEL); child.kill(); process.exit(1); }

  let clip = { x: box.x, y: box.y, width: box.w, height: box.h, scale: 1 };
  if (CROP.length === 4 && CROP.every((v) => !Number.isNaN(v))) {
    clip = {
      x: box.x + CROP[0] * box.w,
      y: box.y + CROP[1] * box.h,
      width: CROP[2] * box.w,
      height: CROP[3] * box.h,
      scale: 1
    };
  }
  const shot = await send('Page.captureScreenshot', { format: 'png', clip, captureBeyondViewport: true });
  fs.writeFileSync(OUT, Buffer.from(shot.data, 'base64'));
  console.log(`saved ${OUT}  clip=${Math.round(clip.width)}x${Math.round(clip.height)} dpr=${DPR}`);
  console.log(`console errors: ${errors.length}`);
  errors.slice(0, 6).forEach((e) => console.log('  !', e.slice(0, 240)));
  child.kill();
  process.exit(0);
})().catch((err) => { console.error(err); process.exit(1); });
