const PREFIX = 'ORBIT|';
export function parseMessage(line) {
  if (typeof line !== 'string' || line.length > 64 || !line.startsWith(PREFIX)) return null;
  if (line === 'ORBIT|A') return { type: 'primary' };
  if (line === 'ORBIT|B') return { type: 'cycle' };
  const match = /^ORBIT\|M\|(up|down|left|right)$/.exec(line);
  return match ? { type: 'move', direction: match[1] } : null;
}

export class SerialLineDecoder {
  constructor() { this.buffer = ''; this.dropping = false; }
  push(chunk) {
    const actions = [];
    // Bound work even if a device emits a very large burst of startup noise.
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
    if (String(chunk).length > 8192) { this.buffer = ''; this.dropping = true; }
    return actions;
  }
}

export function createMicrobit({ onAction, onStatus, tiltEnabled = () => true, serial = globalThis.navigator?.serial }) {
  let port = null;
  let reader = null;
  let reading = null;
  let connecting = false;
  let closing = false;
  let lastMove = -Infinity;
  let lastButton = -Infinity;
  const status = (state, message) => onStatus?.({ state, message });

  async function readLoop(currentPort) {
    const lines = new SerialLineDecoder();
    const text = new TextDecoder();
    let failure = null;
    try {
      reader = currentPort.readable.getReader();
      while (!closing) {
        const { value, done } = await reader.read();
        if (done) break;
        for (const action of lines.push(text.decode(value, { stream: true }))) {
          const now = performance.now();
          if (action.type === 'move') {
            if (!tiltEnabled() || now - lastMove < 180) continue;
            lastMove = now;
          } else {
            if (now - lastButton < 70) continue;
            lastButton = now;
          }
          onAction?.(action);
        }
      }
    } catch (error) { failure = error; }
    finally {
      try { reader?.releaseLock(); } catch { /* The device may already be gone. */ }
      reader = null;
      try { await currentPort.close(); } catch { /* Unplugging can close the port first. */ }
      if (port === currentPort) port = null;
      status('idle', closing ? 'micro:bit 已断开，键盘与屏幕操作仍可用。' : failure ? 'micro:bit 连接中断。进度保留，可继续用键盘或屏幕操作。' : '设备已停止发送数据。进度保留，可用屏幕继续。');
    }
  }
  async function connect() {
    if (!serial) { status('idle', '当前浏览器不支持 USB 串口。请用桌面 Chrome / Edge，或继续使用屏幕。'); return false; }
    if (connecting || port) return false;
    connecting = true; closing = false;
    status('connecting', '请选择已烧录控制器固件的 micro:bit 串口。');
    try {
      const selected = await serial.requestPort();
      await selected.open({ baudRate: 115200 });
      if (!selected.readable) {
        await selected.close();
        throw new Error('Serial stream unavailable');
      }
      port = selected; lastMove = -Infinity; lastButton = -Infinity;
      status('connected', 'micro:bit 已连接：倾斜移动，A 操作，B 切换交互。键盘与屏幕也始终可用。');
      reading = readLoop(selected);
      return true;
    } catch (error) {
      status('idle', error?.name === 'NotFoundError' ? '没有选择设备。无需硬件，也可以完整游玩。' : '未能连接设备。检查固件、USB 数据线，以及串口是否被其他程序占用。');
      return false;
    } finally { connecting = false; }
  }
  async function disconnect() {
    if (!port) return;
    closing = true;
    try { await reader?.cancel(); } catch { /* Already disconnected. */ }
    await reading;
    reading = null;
  }
  return { supported: Boolean(serial), connect, disconnect };
}
