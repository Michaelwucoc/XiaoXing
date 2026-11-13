// micro:bit USB 串口控制器（Web Serial）。协议见 firmware/main.py。
// 如果板子上是 MicroPython，可以通过 REPL 一键写入/更新控制程序 main.py。

export const FIRMWARE_VERSION = 2;
const PREFIX = 'ORBIT|';

export function parseMessage(line) {
  if (typeof line !== 'string' || line.length > 64 || !line.startsWith(PREFIX)) return null;
  if (line === 'ORBIT|A') return { type: 'a' };
  if (line === 'ORBIT|B') return { type: 'b' };
  if (line === 'ORBIT|K') return { type: 'calibrated' };
  let match = /^ORBIT\|M\|(up|down|left|right)$/.exec(line);
  if (match) return { type: 'move', direction: match[1] };
  match = /^ORBIT\|V\|(\d+)$/.exec(line);
  if (match) return { type: 'version', version: Number(match[1]) };
  match = /^ORBIT\|T\|(-?\d+),(-?\d+)$/.exec(line);
  if (match) return { type: 'tilt', x: Number(match[1]), y: Number(match[2]) };
  return null;
}

export class SerialLineDecoder {
  constructor() { this.buffer = ''; this.dropping = false; }
  push(chunk) {
    const actions = [];
    for (const character of String(chunk).slice(0, 8192)) {
      if (character === '\n') {
        if (!this.dropping) {
          const action = parseMessage(this.buffer.replace(/\r$/, ''));
          if (action) actions.push(action);
        }
        this.buffer = ''; this.dropping = false;
      } else if (!this.dropping) {
        this.buffer += character;
        if (this.buffer.length > 64) { this.buffer = ''; this.dropping = true; }
      }
    }
    return actions;
  }
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export const SENSITIVITY = { low: 520, mid: 380, high: 260 };

export function createMicrobit({ onAction, onStatus, onTilt, tiltEnabled = () => true, sensitivity = () => 'mid', serial = globalThis.navigator?.serial }) {
  let port = null;
  let reader = null;
  let reading = null;
  let closing = false;
  let lastMove = -Infinity;
  let heard = false;
  let version = 0;
  let tail = '';
  let calibrated = null;
  const status = (state, message) => onStatus?.({ state, message });
  const readyText = '已连接！倾斜板子走路，A 键看提示，B 键撤销。';

  async function readLoop(current) {
    const lines = new SerialLineDecoder();
    const text = new TextDecoder();
    let failure = null;
    try {
      reader = current.readable.getReader();
      while (!closing) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = text.decode(value, { stream: true });
        tail = (tail + chunk).slice(-3000);
        for (const action of lines.push(chunk)) {
          if (action.type === 'version') { version = action.version; continue; }
          if (action.type === 'tilt') { onTilt?.(action); continue; }
          if (action.type === 'calibrated') { calibrated?.(); continue; }
          if (!heard) {
            heard = true;
            if (version >= FIRMWARE_VERSION) status('ready', readyText);
          }
          if (action.type === 'move') {
            const now = performance.now();
            if (!tiltEnabled() || now - lastMove < 200) continue;
            lastMove = now;
          }
          onAction?.(action);
        }
      }
    } catch (error) { failure = error; }
    finally {
      try { reader?.releaseLock(); } catch { /* 设备可能已拔出 */ }
      reader = null;
      try { await current.close(); } catch { /* 拔线时端口可能已关闭 */ }
      if (port === current) port = null;
      heard = false; version = 0;
      status('idle', closing ? 'micro:bit 已断开。' : failure ? 'micro:bit 连接中断了。游戏进度还在，可以继续用屏幕玩。' : 'micro:bit 停止发送数据。');
    }
  }

  async function write(text) {
    if (!port?.writable) return;
    const writer = port.writable.getWriter();
    try {
      const bytes = new TextEncoder().encode(text);
      for (let i = 0; i < bytes.length; i += 64) {
        await writer.write(bytes.slice(i, i + 64));
        await wait(12);
      }
    } finally { writer.releaseLock(); }
  }
  const command = (cmd) => write(`\nORBIT|${cmd}\n`);

  // 询问版本：新版控制程序会回复 ORBIT|V|2
  async function checkVersion() {
    version = 0;
    await command('?');
    for (let i = 0; i < 10 && !version; i++) await wait(100);
    if (version >= FIRMWARE_VERSION) {
      heard = true;
      await command(`S|${SENSITIVITY[sensitivity()] || SENSITIVITY.mid}`);
      status('ready', readyText);
    } else if (heard) {
      status('outdated', '能收到信号，但板子上是旧版控制程序，不能校准。点“更新控制程序”即可（约 5 秒）。');
    } else {
      status('silent', '板子已连接，但还没有收到控制信号。如果是第一次用，点“安装控制程序”。');
    }
    return version;
  }

  async function connect() {
    if (!serial) { status('unsupported', '这个浏览器不能连接 USB 设备。请用电脑上的 Chrome 或 Edge 打开游戏。'); return false; }
    if (port) return true;
    status('connecting', '请在弹出的窗口里选择 micro:bit（名字里通常有 “mbed” 或 “usbmodem”）。');
    try {
      const selected = await serial.requestPort({ filters: [{ usbVendorId: 0x0d28 }] });
      await selected.open({ baudRate: 115200 });
      port = selected; closing = false; heard = false; version = 0; tail = '';
      reading = readLoop(selected);
      status('listening', '已打开 micro:bit，正在和它打招呼……');
      await wait(300);
      await checkVersion();
      return true;
    } catch (error) {
      if (error?.name === 'NotFoundError') status('idle', '没有选择设备。不用 micro:bit 也能完整地玩。');
      else if (error?.name === 'InvalidStateError' || /open/i.test(error?.message || '')) status('busy', '端口被别的程序占用了。请关掉其他连着 micro:bit 的网页或编辑器，再试一次。');
      else status('idle', '没能连接 micro:bit。请检查 USB 线是否能传数据，再试一次。');
      return false;
    }
  }

  async function calibrate() {
    if (!port || version < FIRMWARE_VERSION) return false;
    const done = new Promise((resolve) => { calibrated = resolve; setTimeout(() => resolve(false), 2500); });
    await command('C');
    const ok = await done;
    calibrated = null;
    return ok !== false;
  }
  const setSensitivity = (level) => (port && version >= FIRMWARE_VERSION ? command(`S|${SENSITIVITY[level] || SENSITIVITY.mid}`) : null);
  const streamTilt = (on) => (port && version >= FIRMWARE_VERSION ? command(`T|${on ? 1 : 0}`) : null);

  // 检查板子上是不是 MicroPython（能进入 >>> 提示符）。
  async function detectPython() {
    if (!port) return false;
    tail = '';
    await write('\r\x03\x03\r');
    await wait(900);
    return />>> ?$/m.test(tail) || /MicroPython/.test(tail);
  }

  // 通过 raw REPL 写入 main.py 并重启。
  async function installController(code) {
    if (!port) return false;
    status('installing', '正在把控制程序写进 micro:bit，请不要拔线……');
    try {
      await write('\r\x03\x03');
      await wait(300);
      tail = '';
      await write('\x01');
      await wait(400);
      if (!/raw REPL/.test(tail)) throw new Error('raw REPL unavailable');
      tail = '';
      await write(`f=open('main.py','w')\nf.write(${JSON.stringify(code)})\nf.close()\nprint('XIAOXING-OK')\n`);
      await write('\x04');
      for (let i = 0; i < 30 && !/XIAOXING-OK/.test(tail); i++) await wait(100);
      if (!/XIAOXING-OK/.test(tail)) throw new Error('write failed');
      await write('\x02');
      await wait(200);
      heard = false; version = 0;
      await write('\x04'); // 软重启，运行新的 main.py
      for (let i = 0; i < 30 && !version; i++) await wait(100);
      await checkVersion();
      return version >= FIRMWARE_VERSION;
    } catch {
      status('silent', '没能自动安装。可以用 micro:bit Python 编辑器手动烧录（见“查看步骤”）。');
      return false;
    }
  }

  async function disconnect() {
    if (!port) return;
    closing = true;
    try { await reader?.cancel(); } catch { /* 已断开 */ }
    await reading;
    reading = null;
  }

  return {
    get supported() { return Boolean(serial); },
    get connected() { return Boolean(port); },
    get ready() { return Boolean(port) && version >= FIRMWARE_VERSION; },
    get heard() { return heard; },
    connect, disconnect, detectPython, installController, calibrate, setSensitivity, streamTilt,
  };
}
