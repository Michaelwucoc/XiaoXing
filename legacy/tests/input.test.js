import { test, assert, equal } from './harness.js';
import { actionForKey } from '../src/input/keyboard.js';
import { SerialLineDecoder, parseMessage, createMicrobit } from '../src/input/microbit.js';
import { loadPreferences, savePreferences } from '../src/ui/preferences.js';

test('串口异常结束会回退到屏幕操作并释放资源', async () => {
  const statuses = []; let output; let closed = false;
  const port = { readable: new ReadableStream({ start(controller) { output = controller; } }), open: async () => {}, close: async () => { closed = true; } };
  const controller = createMicrobit({ serial: { requestPort: async () => port }, onStatus: (value) => statuses.push(value) });
  await controller.connect(); output.error(new Error('Cable removed'));
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert(closed && statuses.at(-1).state === 'idle' && statuses.at(-1).message.includes('进度保留'));
});

test('同一批串口倾斜消息会节流，不连续跳多格', async () => {
  const actions = []; let output;
  const port = { readable: new ReadableStream({ start(controller) { output = controller; } }), open: async () => {}, close: async () => {} };
  const controller = createMicrobit({ serial: { requestPort: async () => port }, onAction: (value) => actions.push(value) });
  await controller.connect(); output.enqueue(new TextEncoder().encode('ORBIT|M|up\\nORBIT|M|right\\n'.replaceAll('\\n', '\n')));
  await new Promise((resolve) => setTimeout(resolve, 5));
  equal(actions, [{ type: 'move', direction: 'up' }]); await controller.disconnect();
});

const keyEvent = (key, rest = {}) => ({ key, ctrlKey: false, metaKey: false, altKey: false, repeat: false, ...rest });
test('方向键、WASD 和触屏使用同一移动动作格式', () => {
  equal(actionForKey(keyEvent('ArrowUp')), { type: 'move', direction: 'up' });
  equal(actionForKey(keyEvent('D')), { type: 'move', direction: 'right' });
});
test('设备数字键与切轨快捷键映射正确', () => {
  equal(actionForKey(keyEvent('2'), ['bridge', 'crane']), { type: 'power', device: 'crane' });
  equal(actionForKey(keyEvent('r'), [], [{ id: 'buffer' }, { id: 'direct' }], 'buffer'), { type: 'route', route: 'direct' });
});
test('组合快捷键、输入法组合与非移动长按不触发操作', () => {
  assert(!actionForKey(keyEvent('z', { metaKey: true })));
  assert(!actionForKey(keyEvent('e', { repeat: true })));
  assert(!actionForKey(keyEvent('w', { isComposing: true })));
});
test('硬件只接受定义的协议消息', () => {
  equal(parseMessage('ORBIT|A'), { type: 'primary' });
  equal(parseMessage('ORBIT|B'), { type: 'cycle' });
  equal(parseMessage('ORBIT|M|left'), { type: 'move', direction: 'left' });
  for (const value of ['A', 'ORBIT|M|teleport', 'ORBIT|reset', '<script>', 'ORBIT|A trailing', 'ORBIT|' + 'x'.repeat(100)]) assert(!parseMessage(value));
});
test('串口接收可拆分消息与 CRLF', () => {
  const decoder = new SerialLineDecoder();
  equal(decoder.push('ORBIT|M|'), []);
  equal(decoder.push('up\r\nORBIT|A\n'), [{ type: 'move', direction: 'up' }, { type: 'primary' }]);
});
test('串口启动文本与超长垃圾不影响下一条合法消息', () => {
  const decoder = new SerialLineDecoder();
  equal(decoder.push('MicroPython ready\n' + 'x'.repeat(1000) + '\nORBIT|B\n'), [{ type: 'cycle' }]);
  assert(decoder.buffer.length <= 64);
});
test('超长分片不会被误当作合法消息尾部', () => {
  const decoder = new SerialLineDecoder();
  equal(decoder.push('x'.repeat(80) + 'ORBIT|'), []);
  equal(decoder.push('A\nORBIT|A\n'), [{ type: 'primary' }]);
});
test('不支持串口时保留零硬件路径', async () => {
  const statuses = [];
  const controller = createMicrobit({ serial: null, onStatus: (value) => statuses.push(value) });
  assert(!controller.supported);
  assert(!await controller.connect());
  assert(statuses.at(-1).message.includes('屏幕'));
});
test('取消授权不会报未处理异常', async () => {
  const statuses = [];
  const controller = createMicrobit({ serial: { requestPort: async () => { const error = new Error('Cancelled'); error.name = 'NotFoundError'; throw error; } }, onStatus: (value) => statuses.push(value) });
  assert(!await controller.connect());
  assert(statuses.at(-1).state === 'idle' && statuses.at(-1).message.includes('没有选择'));
});
test('模拟串口连接、消息、主动断开与资源释放', async () => {
  const actions = []; const statuses = []; let closeCount = 0;
  let streamController;
  const stream = new ReadableStream({ start(controller) { streamController = controller; } });
  const port = { readable: stream, open: async () => {}, close: async () => { closeCount++; } };
  const controller = createMicrobit({ serial: { requestPort: async () => port }, onAction: (value) => actions.push(value), onStatus: (value) => statuses.push(value) });
  assert(await controller.connect());
  streamController.enqueue(new TextEncoder().encode('ORBIT|M|up\n'));
  await new Promise((resolve) => setTimeout(resolve, 5));
  equal(actions, [{ type: 'move', direction: 'up' }]);
  await controller.disconnect();
  assert(closeCount === 1 && statuses.at(-1).state === 'idle');
});
test('关闭倾斜后仍保留按钮输入', async () => {
  const actions = []; let output;
  const port = { readable: new ReadableStream({ start(controller) { output = controller; } }), open: async () => {}, close: async () => {} };
  const controller = createMicrobit({ serial: { requestPort: async () => port }, tiltEnabled: () => false, onAction: (value) => actions.push(value) });
  await controller.connect(); output.enqueue(new TextEncoder().encode('ORBIT|M|up\nORBIT|A\n'));
  await new Promise((resolve) => setTimeout(resolve, 5));
  equal(actions, [{ type: 'primary' }]); await controller.disconnect();
});
test('存储损坏和不可用时使用安全默认值', () => {
  assert(!loadPreferences({ getItem: () => '{' }).sound);
  assert(loadPreferences({ getItem: () => { throw new Error('blocked'); } }, true).reduced);
  assert(!savePreferences({ setItem: () => { throw new Error('quota'); } }, {}));
});
test('本地设置按类型校验，不载入其他字段', () => {
  const result = loadPreferences({ getItem: () => JSON.stringify({ sound: 'yes', mode: '<script>', completed: ['transfer', 'transfer', 'other'], diagnosis: 'not stored' }) });
  equal(result.completed, ['transfer']); assert(result.sound === false && result.mode === 'duo'); assert(!('diagnosis' in result));
});
