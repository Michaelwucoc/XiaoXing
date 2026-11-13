import { test, assert, equal } from './harness.js';
import { levels } from '../src/game/levels.js';
import { createState } from '../src/game/state.js';
import { transition, powered, interactionOptions } from '../src/game/rules.js';
import { createSession } from '../src/game/history.js';
import { solutions } from './solutions.js';

for (const [levelIndex, solution, type] of [[0, 'transfer', 'load'], [1, 'reserveBridge', 'insert-battery'], [2, 'bypassBox', 'ship']]) {
  test(`复杂状态撤销：${solution} / ${type}`, () => {
    const session = createSession(levels[levelIndex]);
    const sequence = solutions[solution];
    const stop = sequence.findIndex((action) => action.type === type);
    for (const action of sequence.slice(0, stop)) assert(session.dispatch(action).ok);
    const before = JSON.stringify(session.state);
    assert(session.dispatch(sequence[stop]).ok);
    assert(session.dispatch({ type: 'undo' }).ok);
    equal(JSON.stringify(session.state), before);
  });
}

const first = levels[0];

test('规则函数不修改传入状态', () => {
  const state = createState(first);
  const before = JSON.stringify(state);
  transition(state, first, { type: 'move', direction: 'right' });
  equal(JSON.stringify(state), before);
});

test('无效操作保留同一个状态，不增加步数', () => {
  const state = createState(first);
  const result = transition(state, first, { type: 'move', direction: 'diagonal' });
  assert(!result.ok && result.state === state && !state.steps);
});

test('不能跨越未供电的桥', () => {
  const state = createState(first);
  state.robot = { x: 5, y: 3 };
  assert(!transition(state, first, { type: 'move', direction: 'right' }).ok);
});

test('机器人在桥面时禁止切断最后的供电', () => {
  const state = createState(first);
  state.robot = { x: 6, y: 3 }; state.power = 'bridge';
  const result = transition(state, first, { type: 'power', device: 'crane' });
  assert(!result.ok && result.state.power === 'bridge');
});

test('桥有备用电池时可切走主电源', () => {
  const level = levels[1]; const state = createState(level);
  state.robot = { x: 6, y: 2 }; state.power = 'bridge';
  state.battery = { carried: false, socketId: 'bridge-socket', at: null };
  const result = transition(state, level, { type: 'power', device: 'rail' });
  assert(result.ok && powered(result.state, level, 'bridge'));
});

test('不能远程拿电池或远程插入电池', () => {
  const level = levels[1]; const state = createState(level);
  state.robot = { x: 11, y: 7 };
  assert(!transition(state, level, { type: 'take-battery' }).ok);
  state.battery = { carried: true, socketId: null, at: null };
  assert(!transition(state, level, { type: 'insert-battery', socketId: 'bridge-socket' }).ok);
});

test('取出唯一供电电池时也执行桥面安全检查', () => {
  const level = { ...levels[1], sockets: [{ id: 'near', at: { x: 7, y: 2 }, device: 'bridge' }] };
  const state = createState(level);
  state.robot = { x: 6, y: 2 }; state.battery = { at: null, carried: false, socketId: 'near' };
  assert(!transition(state, level, { type: 'take-battery' }).ok);
});

test('空车不在吊装位时不能装载', () => {
  const state = createState(first); state.robot = { x: 8, y: 3 }; state.power = 'crane';
  assert(!transition(state, first, { type: 'load' }).ok);
});

test('吊装需要供电，也需要现场操作员在车旁', () => {
  const state = createState(first); Object.assign(state.cart, first.loadSlot); state.robot = { x: 9, y: 3 };
  assert(!transition(state, first, { type: 'load' }).ok);
  state.power = 'crane'; state.robot = { x: 2, y: 5 };
  assert(!transition(state, first, { type: 'load' }).ok);
});

test('已装载的运输车不能手推', () => {
  const state = createState(first); Object.assign(state.cart, first.loadSlot, { loaded: true }); state.robot = { x: 9, y: 3 };
  assert(!transition(state, first, { type: 'move', direction: 'right' }).ok);
});

test('维修开关必须从附近操作，打开后不依赖供电', () => {
  const state = createState(first);
  assert(!transition(state, first, { type: 'open-gate' }).ok);
  state.robot = { x: 8, y: 5 };
  const result = transition(state, first, { type: 'open-gate' });
  assert(result.ok && result.state.gateOpen && !result.state.power);
});

test('通道有人时不能关闭隔离门', () => {
  const state = createState(levels[2]); state.power = 'gate'; state.robot = { x: 6, y: 7 };
  assert(!transition(state, levels[2], { type: 'power', device: 'crane' }).ok);
});

test('旁路发车需要独立的电桥供电', () => {
  const state = createState(levels[2]); state.power = 'rail'; state.route = 'bypass';
  state.cart.loaded = true; Object.assign(state.cart, levels[2].loadSlot); state.robot = { x: 9, y: 3 };
  assert(!transition(state, levels[2], { type: 'ship' }).ok);
  state.battery = { at: null, carried: false, socketId: 'bridge-socket' };
  assert(transition(state, levels[2], { type: 'ship' }).ok);
});

test('直达线的门关闭时不能发车', () => {
  const state = createState(levels[2]); state.power = 'rail'; state.cart.loaded = true;
  Object.assign(state.cart, levels[2].loadSlot); state.robot = { x: 9, y: 3 };
  assert(!transition(state, levels[2], { type: 'ship' }).ok);
});

test('缓存位可以重新发往出口，不会丢失货物', () => {
  const level = levels[1]; const state = createState(level); state.power = 'rail';
  state.cart.loaded = true; Object.assign(state.cart, level.loadSlot); state.robot = { x: 9, y: 3 };
  const staged = transition(state, level, { type: 'ship' });
  assert(staged.ok && !staged.state.cart.delivered);
  staged.state.robot = { x: 11, y: 5 }; staged.state.route = 'direct';
  const sent = transition(staged.state, level, { type: 'ship' });
  assert(sent.ok && sent.state.cart.delivered && sent.state.cart.loaded);
});

test('暂停阻止所有玩法操作，恢复不改变局面', () => {
  const session = createSession(first); const original = JSON.stringify(session.state.robot);
  session.dispatch({ type: 'pause', value: true });
  for (const action of [{ type: 'move', direction: 'right' }, { type: 'power', device: 'bridge' }, { type: 'route', route: 'direct' }, { type: 'undo' }]) assert(!session.dispatch(action).ok);
  session.dispatch({ type: 'pause', value: false });
  equal(JSON.stringify(session.state.robot), original);
  assert(session.dispatch({ type: 'move', direction: 'right' }).ok);
});

test('撤销同步恢复供电和机器人，暂停不占历史', () => {
  const session = createSession(first); const before = JSON.stringify(session.state);
  session.dispatch({ type: 'power', device: 'bridge' });
  session.dispatch({ type: 'pause', value: true }); session.dispatch({ type: 'pause', value: false });
  session.dispatch({ type: 'undo' });
  equal(JSON.stringify(session.state), before);
});

test('撤销恢复被推动的车和机器人', () => {
  const session = createSession(first); session.state.robot = { x: 8, y: 3 };
  const before = JSON.stringify(session.state);
  assert(session.dispatch({ type: 'move', direction: 'right' }).ok);
  assert(session.dispatch({ type: 'undo' }).ok);
  equal(JSON.stringify(session.state), before);
});

test('无效动作不进入撤销记录，重开恢复所有初始物件', () => {
  const session = createSession(first);
  session.dispatch({ type: 'unknown' }); assert(!session.canUndo);
  session.dispatch({ type: 'power', device: 'bridge' }); session.reset();
  equal(session.state, createState(first)); assert(!session.canUndo);
});

test('现场交互列表说明为什么不能装载', () => {
  const state = createState(first); state.robot = { x: 8, y: 3 };
  const option = interactionOptions(state, first).find((item) => item.action.type === 'load');
  assert(option && !option.enabled && option.reason.includes('吊装区'));
});

test('胜利后普通操作不再改变关卡', () => {
  const state = createState(first); state.won = true;
  assert(!transition(state, first, { type: 'move', direction: 'right' }).ok);
});
