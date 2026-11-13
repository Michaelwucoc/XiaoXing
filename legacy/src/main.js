import { levels, deviceInfo } from './game/levels.js';
import { createSession } from './game/history.js';
import { powered, objective, interactionOptions, describeState } from './game/rules.js';
import { drawMap, tileDescription, TILE } from './ui/map.js';
import { icon, hydrateIcons } from './ui/icons.js';
import { loadPreferences, savePreferences } from './ui/preferences.js';
import { installKeyboard } from './input/keyboard.js';
import { installTouchControls } from './input/touch.js';
import { createMicrobit } from './input/microbit.js';

const $ = (selector) => document.querySelector(selector);
const dialog = $('#game-dialog');
let storage;
try { storage = window.localStorage; } catch { storage = null; }
const preferences = loadPreferences(storage, window.matchMedia('(prefers-reduced-motion: reduce)').matches);
let levelIndex = 0;
let session = createSession(levels[levelIndex]);
let selected = null;
let ping = null;
let spotlight = null;
let selectedInteraction = 0;
let hintDepth = 0;
let dialogKind = null;
let focusBeforeDialog = null;
let hardwareState = 'idle';
let audioContext = null;
let winShown = false;
const level = () => levels[levelIndex];
const options = () => interactionOptions(session.state, level()).sort((a, b) => Number(a.action.type === 'drop-battery') - Number(b.action.type === 'drop-battery'));
const save = () => savePreferences(storage, preferences);

function feedback(message, type = '') {
  $('#feedback').textContent = message;
  $('#feedback').className = type;
}
function applyPreferences() {
  document.documentElement.dataset.reduced = String(preferences.reduced);
  document.documentElement.dataset.largeText = String(preferences.largeText);
  $('#play-mode').value = preferences.mode;
}
function sound() {
  if (!preferences.sound) return;
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = 'sine'; oscillator.frequency.value = 430;
    gain.gain.setValueAtTime(.025, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + .075);
    oscillator.connect(gain); gain.connect(audioContext.destination);
    oscillator.start(); oscillator.stop(audioContext.currentTime + .08);
  } catch { /* Sound is optional and must never block a move. */ }
}

function renderMap() { drawMap($('#facility-map'), session.state, level(), { selected, ping, spotlight }); }
function renderMarkTargets() {
  const current = level();
  const positions = [session.state.robot, session.state.cart, current.exit, current.dock, current.loadSlot, ...current.bridges, ...current.gates, ...current.sockets.map((socket) => socket.at), ...(current.lever ? [current.lever] : []), ...(session.state.battery?.at ? [session.state.battery.at] : []), ...(selected ? [selected] : [])];
  const unique = [...new Map(positions.map((at) => [`${at.x},${at.y}`, at])).entries()];
  $('#mark-target').innerHTML = '<option value="">或选择标记对象</option>' + unique.map(([value, at]) => `<option value="${value}">${tileDescription(at, session.state, current)}</option>`).join('');
  $('#mark-target').value = selected ? `${selected.x},${selected.y}` : '';
  $('#mark-target-label').textContent = selected ? `已选：${tileDescription(selected, session.state, current)}` : '先点地图，再发送标记';
}
function render() {
  const activeKey = document.activeElement?.dataset.focusKey;
  const state = session.state;
  const current = level();
  $('#level-nav').innerHTML = levels.map((item, index) => `<button type="button" class="level-tab" data-level="${index}" data-focus-key="level-${index}" ${index === levelIndex ? 'aria-current="step"' : ''}><span class="level-id">${item.number}</span><span>${item.name}</span>${preferences.completed.includes(item.id) ? `<span class="completed-mark" aria-label="已完成">${icon('check')}</span>` : ''}</button>`).join('');
  $('#level-number').textContent = current.number;
  $('#level-title').textContent = current.name;
  $('#level-theme').textContent = current.theme;
  $('#current-objective').textContent = objective(state, current);
  $('#cargo-state').textContent = state.cart.delivered ? '核心已抵达' : state.cart.loaded ? '核心已装载' : '核心待装载';
  $('#device-controls').innerHTML = current.devices.map((device, index) => {
    const main = state.power === device;
    const on = powered(state, current, device);
    const status = main ? (state.battery?.socketId && current.sockets.find((socket) => socket.id === state.battery.socketId)?.device === device ? '主电源 + 备用电池' : '主电源已接入') : on ? '备用电池供电' : '未接电';
    return `<button type="button" class="device-button ${on && !main ? 'battery-powered' : ''}" data-device="${device}" data-focus-key="device-${device}" aria-pressed="${main}" aria-label="${index + 1}，${deviceInfo[device].name}，${status}" ${state.paused || state.won ? 'disabled' : ''}>${icon(device)}<span class="device-text"><span class="device-name">${deviceInfo[device].name}</span><span class="device-state ${on ? 'is-powered' : ''}">${status}</span></span><kbd>${index + 1}</kbd></button>`;
  }).join('');
  $('#route-controls').innerHTML = `<div class="route-options">${current.routes.map((route) => `<button type="button" class="route-button" data-route="${route.id}" data-focus-key="route-${route.id}" aria-pressed="${state.route === route.id}" ${state.paused || state.won ? 'disabled' : ''}>${route.name}</button>`).join('')}</div>`;
  $('#route-description').textContent = current.routes.find((route) => route.id === state.route).description;
  $('#battery-section').hidden = !state.battery;
  if (state.battery) {
    const socket = current.sockets.find((item) => item.id === state.battery.socketId);
    $('#battery-status').innerHTML = `${icon('battery')}<span>${state.battery.carried ? '由机器人携带。靠近插座后，可在现场操作中放入。' : socket ? `已插入${socket.name}，独立供电中。` : '在地图上的黄色电池处，走近并按 E 拿起。'}</span>`;
  }
  const interactions = options();
  if (selectedInteraction >= interactions.length) selectedInteraction = 0;
  $('#interactions').innerHTML = interactions.length ? interactions.map((option, index) => `<button type="button" class="interaction-button ${selectedInteraction === index ? 'current' : ''}" data-interaction="${index}" data-focus-key="interaction-${option.action.type}-${option.action.socketId || ''}" ${!option.enabled ? 'disabled' : ''}>${option.title}${option.enabled ? icon('right') : icon('info')}</button>${option.reason ? `<p class="interaction-reason">${option.reason}</p>` : ''}`).join('') : '<p class="empty-interaction">靠近开关、电池或运输车，现场操作会出现在这里。<br>空车需要从左侧向右推入吊装区。</p>';
  $('#undo-button').disabled = !session.canUndo;
  document.querySelectorAll('[data-move]').forEach((button) => { button.disabled = state.paused || state.won; });
  renderMarkTargets();
  $('#clear-mark').hidden = !ping && !selected;
  renderMap();
  if (activeKey && !dialog.open) document.querySelector(`[data-focus-key="${activeKey}"]`)?.focus({ preventScroll: true });
  if (state.won && !winShown) {
    winShown = true;
    if (!preferences.completed.includes(current.id)) { preferences.completed.push(current.id); save(); }
    openDialog('win');
  }
}

function dispatch(action) {
  if (dialog.open) return;
  if (action.type === 'rest') { openDialog('pause'); return; }
  if (action.type === 'cycle') {
    const candidates = options();
    if (!candidates.length) { feedback('附近还没有可交互的设备。先移动到开关、电池或运输车旁。'); return; }
    selectedInteraction = (selectedInteraction + 1) % candidates.length;
    feedback(`已选择：${candidates[selectedInteraction].title}`);
    render(); return;
  }
  if (action.type === 'primary') {
    const candidates = options();
    const chosen = candidates[selectedInteraction] || candidates[0];
    if (!chosen) { feedback('附近没有可交互的物件。请先移动到开关、电池或运输车旁。'); return; }
    action = chosen.action;
  }
  const result = session.dispatch(action);
  if (result.ok) {
    selectedInteraction = 0;
    sound();
    render();
    feedback(action.type === 'move' ? `${result.message} ${describeState(session.state, level())}` : result.message);
  } else feedback(result.message, 'error');
}

function changeLevel(index) {
  if (index < 0 || index >= levels.length) return;
  levelIndex = index; session = createSession(level());
  selected = null; ping = null; spotlight = null; hintDepth = 0; selectedInteraction = 0; winShown = false;
  $('#device-explanation').textContent = level().description;
  render(); feedback(level().description);
}
function dialogHeader(title) {
  return `<div class="dialog-header"><h2 id="dialog-title">${title}</h2><button type="button" class="icon-button" data-dialog-action="close" aria-label="关闭">${icon('close')}</button></div>`;
}
function dialogBody(kind) {
  switch (kind) {
    case 'pause': return `${dialogHeader('休息一下，局面会等你。')}<p class="dialog-copy">机器人、电力和物件都留在原处。没有倒计时，也不会失去进度。</p><div class="dialog-actions"><button class="primary-button" data-dialog-action="close">${icon('play')}准备好再继续</button></div>`;
    case 'help': return `${dialogHeader('一人走空间，一人改规则。')}<div class="dialog-copy"><p><strong>目标：让数据核心和机器人都回到西侧出口。</strong></p><p>所有动作都是逐步执行的，不需要抢时间。一人也可以操作两侧；双人时可随时交换角色。</p></div><div class="help-roles"><div class="help-role"><h3>A · 现场操作员</h3><p>方向键 / WASD 移动，顶住空车或箱子继续移动即可推动。</p><p>E 操作附近物件。也可以点击现场操作按钮。</p></div><div class="help-role"><h3>B · 系统操作员</h3><p>点击设备或按数字键分配唯一的主电源。</p><p>R 切换货运分轨。装载与发车由现场方确认。</p></div></div><p class="dialog-copy">点击地图选择位置，再点“这里供电”等标记，可以不说话地交流。Z 撤销一步。P 或 Esc 休息。micro:bit 只替代控制器，不增加关卡权限。</p><div class="dialog-actions"><button class="primary-button" data-dialog-action="close">明白了，回到设施</button></div>`;
    case 'settings': return `${dialogHeader('按自己的方式玩')}<div class="preset-buttons"><button class="secondary-button" data-preset="standard">标准配置</button><button class="secondary-button" data-preset="quiet">低刺激配置</button></div><label class="setting-row"><span>操作音效<small>仅有短促确认声，默认关闭</small></span><input type="checkbox" data-setting="sound" ${preferences.sound ? 'checked' : ''}></label><label class="setting-row"><span>减少动态效果<small>不影响规则与操作反馈</small></span><input type="checkbox" data-setting="reduced" ${preferences.reduced ? 'checked' : ''}></label><label class="setting-row"><span>放大辅助文字<small>放大设备状态、说明和消息</small></span><input type="checkbox" data-setting="largeText" ${preferences.largeText ? 'checked' : ''}></label><label class="setting-row"><span>micro:bit 倾斜移动<small>可关闭倾斜，保留 A/B 按钮</small></span><input type="checkbox" data-setting="tilt" ${preferences.tilt ? 'checked' : ''}></label><p class="hint-note">只在当前浏览器保存设置与已完成关卡。不采集身份、诊断或录音。系统的“减少动态效果”设置始终优先。</p><div class="dialog-actions"><button class="primary-button" data-dialog-action="close">保存并返回</button></div>`;
    case 'hint': return `${dialogHeader('一点线索，不急着揭晓。')}<p class="dialog-copy">${level().name} · 线索 ${hintDepth + 1} / ${level().hints.length}</p><div class="hint-step">${level().hints[hintDepth]}</div><p class="hint-note">提示不会替你操作，也不影响通关。</p><div class="dialog-actions">${hintDepth < level().hints.length - 1 ? '<button class="secondary-button" data-dialog-action="more-hint">再多一点线索</button>' : ''}<button class="primary-button" data-dialog-action="close">回去试试</button></div>`;
    case 'restart': return `${dialogHeader('重新开始这一关？')}<p class="dialog-copy">本关的机器人、物件和供电会回到初始位置。已完成的其他关卡和设置会保留。</p><div class="dialog-actions"><button class="secondary-button" data-dialog-action="close">继续当前局面</button><button class="primary-button" data-dialog-action="restart">重新开始</button></div>`;
    case 'switch': return `${dialogHeader('切换关卡？')}<p class="dialog-copy">当前关卡的局面不会保存。已完成关卡和设置不会丢失。</p><div class="dialog-actions"><button class="secondary-button" data-dialog-action="close">留在这里</button><button class="primary-button" data-dialog-action="switch">切换关卡</button></div>`;
    case 'hardware': return `${dialogHeader('把 micro:bit 变成控制器')}<div class="dialog-copy"><p>游戏不需要硬件也能完整游玩。连接实体板之前，先通过 MicroPython 编辑器烧录项目中的 <strong>firmware/main.py</strong>。</p><p>USB 接入电脑后，在支持 Web Serial 的桌面浏览器中点击“连接 micro:bit”，再选择对应串口。</p><p>倾斜移动 · A 现场操作 · B 切换附近交互。倾斜不适合你时，可在设置中关闭。</p></div><div class="compatibility-note">${hardware.supported ? '本浏览器提供串口接口；实际连接仍需要实体板、USB 数据线和你的授权。' : '当前浏览器不提供 Web Serial。可以换用桌面 Chrome / Edge，或直接用键鼠、触屏继续玩。'}</div><div class="dialog-actions"><button class="primary-button" data-dialog-action="close">用屏幕继续玩</button>${hardware.supported ? '<button class="secondary-button" data-dialog-action="connect">已烧录，选择设备</button>' : ''}</div>`;
    case 'win': return `<div class="win-symbol">${icon('check')}</div>${dialogHeader(levelIndex === levels.length - 1 ? '两条轨道，在这里相遇。' : '这一程，配合得刚刚好。')}<p class="dialog-copy"><strong>${level().name}已完成。</strong><br>核心与机器人均已回到出口。没有快慢排名，找到自己的办法就很好。</p><div class="dialog-actions"><button class="secondary-button" data-dialog-action="restart">再试一种方法</button>${levelIndex < levels.length - 1 ? '<button class="primary-button" data-dialog-action="next">进入下一关</button>' : '<button class="primary-button" data-dialog-action="first">回到第一关</button>'}</div>`;
    default: return '';
  }
}
function openDialog(kind) {
  if (!dialog.open) focusBeforeDialog = document.activeElement;
  dialogKind = kind;
  session.dispatch({ type: 'pause', value: true });
  $('#dialog-content').innerHTML = dialogBody(kind);
  if (!dialog.open) dialog.showModal();
  dialog.querySelector('.primary-button, button, input')?.focus();
}
function closeDialog() {
  dialog.close(); dialogKind = null;
  session.dispatch({ type: 'pause', value: false });
  render();
  if (!dialog.open && focusBeforeDialog?.isConnected) focusBeforeDialog.focus({ preventScroll: true });
}
let pendingLevel = null;

$('#level-nav').addEventListener('click', (event) => {
  const button = event.target.closest('[data-level]'); if (!button) return;
  const index = Number(button.dataset.level); if (index === levelIndex) return;
  if (session.state.steps && !session.state.won) { pendingLevel = index; openDialog('switch'); }
  else changeLevel(index);
});
$('#device-controls').addEventListener('click', (event) => {
  const button = event.target.closest('[data-device]'); if (button) dispatch({ type: 'power', device: button.dataset.device });
});
function explainDevice(event) {
  const button = event.target.closest('[data-device]'); if (!button) return;
  const device = button.dataset.device;
  const old = session.state.power;
  $('#device-explanation').textContent = `${deviceInfo[device].detail}${old && old !== device ? ` 切换会撤掉${deviceInfo[old].name}的主电源；备用电池不受影响。` : ''}`;
  spotlight = device; renderMap();
}
$('#device-controls').addEventListener('pointerover', explainDevice);
$('#device-controls').addEventListener('focusin', explainDevice);
$('#device-controls').addEventListener('pointerleave', () => { spotlight = null; renderMap(); });
$('#route-controls').addEventListener('click', (event) => {
  const button = event.target.closest('[data-route]'); if (button) dispatch({ type: 'route', route: button.dataset.route });
});
$('#interactions').addEventListener('click', (event) => {
  const button = event.target.closest('[data-interaction]'); if (!button || button.disabled) return;
  dispatch(options()[Number(button.dataset.interaction)].action);
});
$('#facility-map').addEventListener('click', (event) => {
  if (dialog.open || session.state.won) return;
  const svg = $('#facility-map');
  const matrix = svg.getScreenCTM(); if (!matrix) return;
  const point = svg.createSVGPoint(); point.x = event.clientX; point.y = event.clientY;
  const local = point.matrixTransform(matrix.inverse());
  const at = { x: Math.floor(local.x / TILE), y: Math.floor(local.y / TILE) };
  if (at.x < 0 || at.x >= level().width || at.y < 0 || at.y >= level().height) return;
  selected = at;
  renderMarkTargets();
  $('#clear-mark').hidden = false; renderMap();
});
const pingText = { power: '这里供电', wait: '等一下', ready: '准备好了', help: '需要帮助' };
document.querySelector('.communication-buttons').addEventListener('click', (event) => {
  const button = event.target.closest('[data-ping]'); if (!button) return;
  if (button.dataset.ping === 'rest') { openDialog('pause'); return; }
  const at = selected || session.state.robot;
  ping = { at: { ...at }, text: pingText[button.dataset.ping] };
  feedback(`${ping.text} · ${tileDescription(at, session.state, level())}`, 'ping');
  $('#clear-mark').hidden = false; renderMap();
});
$('#clear-mark').addEventListener('click', () => { ping = null; selected = null; render(); feedback('已清除地图标记。'); });
$('#mark-target').addEventListener('change', (event) => {
  const value = event.target.value;
  selected = value ? { x: Number(value.split(',')[0]), y: Number(value.split(',')[1]) } : null;
  renderMarkTargets(); renderMap(); $('#clear-mark').hidden = !selected && !ping;
});
$('#zoom-map').addEventListener('click', () => {
  const expanded = $('#map-frame').dataset.zoomed !== 'true';
  $('#map-frame').dataset.zoomed = String(expanded);
  $('#zoom-map').setAttribute('aria-pressed', String(expanded));
  $('#zoom-map').textContent = expanded ? '完整地图' : '放大地图';
});
$('#undo-button').addEventListener('click', () => dispatch({ type: 'undo' }));
$('#pause-button').addEventListener('click', () => openDialog('pause'));
$('#settings-button').addEventListener('click', () => openDialog('settings'));
$('#help-button').addEventListener('click', () => openDialog('help'));
$('#hint-button').addEventListener('click', () => openDialog('hint'));
$('#restart-button').addEventListener('click', () => openDialog('restart'));
$('#play-mode').addEventListener('change', (event) => {
  preferences.mode = event.target.value; save();
  feedback(preferences.mode === 'solo' ? '单人模式：你可以操作现场与调度两侧，按自己的节奏来。' : '同屏双人：一人控制现场，一人分配电力。角色可以随时交换。');
});
dialog.addEventListener('cancel', (event) => { event.preventDefault(); if (dialogKind !== 'win') closeDialog(); });
dialog.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-dialog-action], [data-preset]'); if (!button) return;
  if (button.dataset.preset) {
    preferences.sound = false;
    preferences.reduced = button.dataset.preset === 'quiet';
    applyPreferences(); save(); $('#dialog-content').innerHTML = dialogBody('settings');
    dialog.querySelector(`[data-preset="${button.dataset.preset}"]`)?.focus(); return;
  }
  switch (button.dataset.dialogAction) {
    case 'close':
      if (dialogKind === 'win') { closeDialog(); return; }
      closeDialog(); break;
    case 'more-hint': hintDepth = Math.min(hintDepth + 1, level().hints.length - 1); $('#dialog-content').innerHTML = dialogBody('hint'); dialog.querySelector('.primary-button')?.focus(); break;
    case 'restart': closeDialogForChange(); changeLevel(levelIndex); break;
    case 'next': closeDialogForChange(); changeLevel(levelIndex + 1); break;
    case 'first': closeDialogForChange(); changeLevel(0); break;
    case 'switch': closeDialogForChange(); changeLevel(pendingLevel); pendingLevel = null; break;
    case 'connect': closeDialog(); await hardware.connect(); break;
  }
});
function closeDialogForChange() { dialog.close(); dialogKind = null; }
dialog.addEventListener('change', (event) => {
  if (!event.target.matches('[data-setting]')) return;
  preferences[event.target.dataset.setting] = event.target.checked; applyPreferences(); save();
});

const hardware = createMicrobit({
  onAction: (action) => { if (!dialog.open && !session.state.paused && !session.state.won) dispatch(action); },
  tiltEnabled: () => preferences.tilt,
  onStatus: ({ state, message }) => {
    hardwareState = state;
    $('#hardware-label').textContent = state === 'connected' ? 'micro:bit 已连接' : state === 'connecting' ? '连接中…' : '连接 micro:bit';
    $('#connect-hardware').classList.toggle('connected', state === 'connected');
    $('#connect-hardware').disabled = state === 'connecting';
    $('#connect-hardware').setAttribute('aria-label', state === 'connected' ? 'micro:bit 已连接，点击断开' : '连接 micro:bit');
    feedback(message);
  },
});
$('#connect-hardware').addEventListener('click', async () => {
  if (hardwareState === 'connected') await hardware.disconnect();
  else openDialog('hardware');
});
installKeyboard({ getContext: () => ({ blocked: dialog.open, devices: level().devices, routes: level().routes, route: session.state.route }), onAction: dispatch });
installTouchControls({ onAction: dispatch });
hydrateIcons(); applyPreferences(); render(); feedback(level().description);
