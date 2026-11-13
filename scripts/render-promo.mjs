// 把 promo/ 页面逐帧渲染成视频：node scripts/render-promo.mjs [--fps 60] [--stills 1,5.5,9] [--out promo/xiaoxing-promo.mp4]
// 原理：给页面注入“虚拟时钟”（接管 setTimeout / performance.now，并手动推进所有 CSS 动画和过渡），
// 每推进 1/fps 秒截一张图，直接喂给 ffmpeg。不依赖 npm 包，只需要本机的 Chrome/Chromium 和 ffmpeg。
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const fps = Number(arg('fps', 60));
const stills = arg('stills', '') ? arg('stills', '').split(',').map(Number) : null;
const out = resolve(root, arg('out', 'promo/xiaoxing-promo.mp4'));
const work = resolve(root, arg('work', 'promo/.render'));
const PORT = 5199;
const DEBUG_PORT = 9347;
mkdirSync(work, { recursive: true });

function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const cache = join(homedir(), 'Library/Caches/ms-playwright');
  const list = existsSync(cache) ? readdirSync(cache).sort().reverse() : [];
  for (const dir of list) {
    for (const rel of ['chrome-headless-shell-mac-arm64/chrome-headless-shell', 'chrome-headless-shell-mac-x64/chrome-headless-shell', 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium']) {
      if (existsSync(join(cache, dir, rel))) return join(cache, dir, rel);
    }
  }
  for (const p of ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge', '/usr/bin/google-chrome', '/usr/bin/chromium']) if (existsSync(p)) return p;
  throw new Error('找不到 Chrome，请设置 CHROME_PATH');
}

// 注入页面的虚拟时钟
const SHIM = `(() => {
  let now = 0, seq = 1;
  const timers = new Map();
  const starts = new WeakMap();
  const done = new WeakSet();
  performance.now = () => now;
  const realDate = Date.now.bind(Date); const base = realDate();
  Date.now = () => base + now;
  window.setTimeout = (fn, d = 0, ...a) => { const id = seq++; timers.set(id, { t: now + Math.max(0, Number(d) || 0), fn, a }); return id; };
  window.setInterval = (fn, d = 0, ...a) => { const id = seq++; timers.set(id, { t: now + Math.max(1, Number(d) || 0), fn, a, every: Math.max(1, Number(d) || 0) }); return id; };
  window.clearTimeout = window.clearInterval = (id) => { timers.delete(id); };
  const rafs = new Map();
  window.requestAnimationFrame = (fn) => { const id = seq++; rafs.set(id, fn); return id; };
  window.cancelAnimationFrame = (id) => { rafs.delete(id); };
  function sync() {
    for (const a of document.getAnimations()) {
      if (done.has(a)) continue;
      let start = starts.get(a);
      if (start === undefined) { start = now; starts.set(a, start); try { a.pause(); } catch {} }
      const t = now - start;
      const end = a.effect ? a.effect.getComputedTiming().endTime : Infinity;
      try { if (Number.isFinite(end) && t >= end) { a.finish(); done.add(a); } else a.currentTime = t; } catch {}
    }
  }
  window.__advance = (to) => {
    for (let guard = 0; guard < 100000; guard++) {
      let pick = null, pickId = 0;
      for (const [id, tm] of timers) if (tm.t <= to && (!pick || tm.t < pick.t)) { pick = tm; pickId = id; }
      if (!pick) break;
      now = Math.max(now, pick.t);
      if (pick.every) pick.t += pick.every; else timers.delete(pickId);
      try { pick.fn(...pick.a); } catch (e) { console.error(e); }
      sync();
    }
    now = to;
    const list = [...rafs.values()]; rafs.clear();
    for (const fn of list) { try { fn(now); } catch (e) { console.error(e); } }
    sync();
    return now;
  };
})();`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const server = spawn(process.execPath, [join(root, 'scripts/serve.mjs')], { env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
const chrome = spawn(findChrome(), ['--headless=new', `--remote-debugging-port=${DEBUG_PORT}`, '--hide-scrollbars', '--mute-audio', '--force-device-scale-factor=1', '--window-size=1920,1080', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', `--user-data-dir=${join(work, 'profile')}`, 'about:blank'], { stdio: 'ignore' });
const cleanup = () => { try { chrome.kill(); } catch {} try { server.kill(); } catch {} };
process.on('exit', cleanup);
process.on('SIGINT', () => process.exit(1));

async function connect() {
  for (let i = 0; i < 60; i++) {
    try {
      const pages = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`)).json();
      const page = pages.find((p) => p.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch { /* 还没启动好 */ }
    await sleep(250);
  }
  throw new Error('连不上 Chrome');
}
const ws = new WebSocket(await connect());
await new Promise((ok, fail) => { ws.onopen = ok; ws.onerror = fail; });
let msgId = 0;
const pending = new Map();
ws.onmessage = ({ data }) => {
  const msg = JSON.parse(data);
  if (msg.id && pending.has(msg.id)) { const { ok, fail } = pending.get(msg.id); pending.delete(msg.id); msg.error ? fail(new Error(msg.error.message)) : ok(msg.result); }
  else if (msg.method === 'Runtime.exceptionThrown') console.error('页面错误：', msg.params.exceptionDetails?.exception?.description || msg.params.exceptionDetails?.text);
};
const send = (method, params = {}) => new Promise((ok, fail) => { const id = ++msgId; pending.set(id, { ok, fail }); ws.send(JSON.stringify({ id, method, params })); });
const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result.value;

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
await send('Page.addScriptToEvaluateOnNewDocument', { source: SHIM });
await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/promo/` });
for (let i = 0; i < 100 && !(await evaluate('Boolean(window.__started)')); i++) await sleep(100);
if (!(await evaluate('Boolean(window.__started)'))) throw new Error('宣传片页面没有启动');
const duration = await evaluate('window.__duration');
const shot = async () => Buffer.from((await send('Page.captureScreenshot', { format: 'jpeg', quality: 96 })).data, 'base64');

if (stills) {
  // 只截几张图，用来检查画面
  let f = 0;
  for (const t of [...stills].sort((a, b) => a - b)) {
    for (; f <= Math.round(t * fps); f++) await evaluate(`__advance(${(f * 1000) / fps})`);
    const file = join(work, `still-${t.toFixed(2).padStart(5, '0')}.jpg`);
    writeFileSync(file, await shot());
    console.log(file);
  }
} else {
  const silent = join(work, 'video-silent.mp4');
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'slow', '-crf', '15', '-pix_fmt', 'yuv420p', '-vf', 'scale=in_range=pc:out_range=tv,format=yuv420p', '-color_range', 'tv', '-movflags', '+faststart', silent], { stdio: ['pipe', 'inherit', 'inherit'] });
  const total = Math.round(duration * fps);
  const began = Date.now();
  for (let f = 0; f < total; f++) {
    await evaluate(`__advance(${(f * 1000) / fps})`);
    const jpg = await shot();
    if (!ff.stdin.write(jpg)) await new Promise((r) => ff.stdin.once('drain', r));
    if (f % 120 === 0) console.log(`${f}/${total} 帧  ${((Date.now() - began) / 1000).toFixed(0)}s`);
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  writeFileSync(join(work, 'sfx.json'), JSON.stringify({ duration, cuts: await evaluate('window.__cuts'), sfx: await evaluate('window.__sfx') }));
  // 合成配乐并合并
  await new Promise((ok, fail) => spawn(process.execPath, [join(root, 'scripts/promo-audio.mjs'), join(work, 'sfx.json'), join(work, 'audio.wav')], { stdio: 'inherit' }).on('close', (c) => (c ? fail(new Error('配乐生成失败')) : ok())));
  await new Promise((ok, fail) => spawn('ffmpeg', ['-y', '-loglevel', 'error', '-i', silent, '-i', join(work, 'audio.wav'), '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out], { stdio: 'inherit' }).on('close', (c) => (c ? fail(new Error('合并失败')) : ok())));
  console.log(`完成：${out}`);
}
ws.close();
cleanup();
process.exit(0);
