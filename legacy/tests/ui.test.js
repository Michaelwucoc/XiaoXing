import { test, assert, equal } from './harness.js';
import { solutions } from './solutions.js';

const key = 'different-orbits.preferences.v1';
async function withGame(callback) {
  const saved = localStorage.getItem(key);
  const iframe = document.createElement('iframe');
  iframe.title = '隔离的游戏端到端测试';
  iframe.style.cssText = 'position:fixed;left:-20000px;top:0;width:1200px;height:1000px';
  iframe.src = '../';
  const loaded = new Promise((resolve, reject) => {
    iframe.onload = resolve;
    iframe.onerror = () => reject(new Error('游戏测试框架载入失败'));
  });
  document.body.append(iframe);
  try {
    await loaded;
    const doc = iframe.contentDocument;
    assert(doc.querySelector('[data-device]'), '游戏入口未完成初始化');
    await callback(doc, iframe.contentWindow);
  } finally {
    iframe.remove();
    if (saved === null) localStorage.removeItem(key); else localStorage.setItem(key, saved);
  }
}
function click(doc, selector) {
  const element = doc.querySelector(selector);
  assert(element && !element.disabled, `控件不可用：${selector}`);
  element.click();
}
function play(doc, actions) {
  for (const [index, action] of actions.entries()) {
    let selector;
    if (action.type === 'move') selector = `[data-move="${action.direction}"]`;
    else if (action.type === 'power') selector = `[data-device="${action.device}"]`;
    else if (action.type === 'route') selector = `[data-route="${action.route}"]`;
    else {
      const titles = { 'open-gate': '打开维修通道', 'take-battery': '拿起备用电池', load: '装载核心', ship: '确认发车' };
      const title = action.type === 'insert-battery' ? `插入${action.socketId.startsWith('bridge') ? '电桥' : action.socketId.startsWith('crane') ? '起重机' : '隔离门'}插座` : titles[action.type];
      const button = [...doc.querySelectorAll('[data-interaction]')].find((item) => item.textContent.includes(title));
      assert(button && !button.disabled, `第 ${index + 1} 步找不到可用交互：${title}`);
      button.click();
    }
    if (selector) click(doc, selector);
    assert(!doc.querySelector('#feedback').classList.contains('error'), `第 ${index + 1} 步：${doc.querySelector('#feedback').textContent}`);
  }
}

for (const [index, solution] of [[0, 'transfer'], [1, 'reserveBridge'], [1, 'reserveCrane'], [2, 'bypassBox'], [2, 'bypassBattery'], [2, 'bypassGateBattery']]) {
  test(`浏览器完整操作：${solution}`, () => withGame((doc) => {
    if (index) click(doc, `[data-level="${index}"]`);
    play(doc, solutions[solution]);
    assert(doc.querySelector('#game-dialog').open && doc.querySelector('#dialog-title').textContent.includes(index === 2 ? '相遇' : '刚刚好'));
    assert(doc.querySelector('#current-objective').textContent.includes('均已抵达'));
    click(doc, '[data-dialog-action="restart"]');
    assert(!doc.querySelector('#game-dialog').open && doc.querySelector('#cargo-state').textContent === '核心待装载');
  }));
}

test('浏览器暂停、键盘与屏幕输入阻断、恢复与撤销', () => withGame((doc, win) => {
  const original = doc.querySelector('.robot-piece').getAttribute('transform');
  click(doc, '#pause-button');
  doc.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'd', bubbles: true }));
  doc.querySelector('[data-move="right"]').click();
  equal(doc.querySelector('.robot-piece').getAttribute('transform'), original);
  click(doc, '.primary-button[data-dialog-action="close"]');
  doc.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'd', bubbles: true }));
  assert(doc.querySelector('.robot-piece').getAttribute('transform') !== original);
  click(doc, '#undo-button');
  equal(doc.querySelector('.robot-piece').getAttribute('transform'), original);
}));

test('浏览器下拉框获取焦点时，方向键不会移动机器人', () => withGame((doc, win) => {
  const original = doc.querySelector('.robot-piece').getAttribute('transform');
  const select = doc.querySelector('#play-mode'); select.focus();
  select.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  equal(doc.querySelector('.robot-piece').getAttribute('transform'), original);
}));

test('浏览器提示逐级展开，不修改关卡局面', () => withGame((doc) => {
  const original = doc.querySelector('.robot-piece').getAttribute('transform');
  click(doc, '#hint-button');
  const first = doc.querySelector('.hint-step').textContent;
  click(doc, '[data-dialog-action="more-hint"]');
  assert(doc.querySelector('.hint-step').textContent !== first);
  click(doc, '.primary-button[data-dialog-action="close"]');
  equal(doc.querySelector('.robot-piece').getAttribute('transform'), original);
}));

test('浏览器低刺激、文字设置与标记正常工作', () => withGame((doc, win) => {
  click(doc, '#settings-button');
  click(doc, '[data-preset="quiet"]');
  equal(doc.documentElement.dataset.reduced, 'true');
  assert(!doc.querySelector('[data-setting="sound"]').checked);
  const setting = doc.querySelector('[data-setting="largeText"]');
  setting.checked = true; setting.dispatchEvent(new win.Event('change', { bubbles: true }));
  equal(doc.documentElement.dataset.largeText, 'true');
  click(doc, '.primary-button[data-dialog-action="close"]');
  click(doc, '[data-ping="ready"]');
  assert(doc.querySelector('#feedback').textContent.includes('准备好了'));
  click(doc, '#clear-mark');
  assert(doc.querySelector('#clear-mark').hidden);
}));

test('浏览器用下拉框即可给远端设备发标记，并可放大地图', () => withGame((doc, win) => {
  const target = doc.querySelector('#mark-target'); target.value = '6,3';
  target.dispatchEvent(new win.Event('change', { bubbles: true }));
  assert(doc.querySelector('#mark-target-label').textContent.includes('电桥'));
  click(doc, '[data-ping="power"]');
  assert(doc.querySelector('#feedback').textContent.includes('电桥'));
  click(doc, '#zoom-map');
  equal(doc.querySelector('#map-frame').dataset.zoomed, 'true');
  click(doc, '#zoom-map');
  equal(doc.querySelector('#map-frame').dataset.zoomed, 'false');
}));

test('浏览器关闭通关弹窗后不会重复弹出，仍可换关', () => withGame((doc) => {
  play(doc, solutions.transfer);
  click(doc, '.icon-button[data-dialog-action="close"]');
  assert(!doc.querySelector('#game-dialog').open);
  click(doc, '[data-level="1"]');
  assert(doc.querySelector('#level-title').textContent === '双路供电');
}));
