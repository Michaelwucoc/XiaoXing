import { test, assert, equal } from './harness.js';
import { levels } from '../src/game/levels.js';
import { createState } from '../src/game/state.js';
import { transition, same, gateIsOpen } from '../src/game/rules.js';
import { solutions } from './solutions.js';

export function play(level, actions) {
  let state = createState(level);
  actions.forEach((action, index) => {
    const result = transition(state, level, action);
    assert(result.ok, `第 ${index + 1} 步 ${JSON.stringify(action)}: ${result.message}`);
    state = result.state;
  });
  return state;
}

for (const [levelIndex, name] of [[0, 'transfer'], [1, 'reserveBridge'], [1, 'reserveCrane'], [2, 'bypassBox'], [2, 'bypassBattery'], [2, 'bypassGateBattery']]) {
  test(`完整解法：${levels[levelIndex].name} / ${name}`, () => {
    const level = levels[levelIndex];
    const state = play(level, solutions[name]);
    assert(state.won && state.cart.delivered && same(state.robot, level.exit));
  });
}

test('每关数据的起点、终点、设备和物件均在合法地面', () => {
  for (const level of levels) {
    const positions = [level.start, level.exit, level.dock, level.cart, level.loadSlot, ...level.sockets.map((socket) => socket.at), ...level.boxes];
    for (const at of positions) assert(level.floor.some((tile) => same(tile, at)), `${level.id}: ${JSON.stringify(at)}`);
  }
});

test('箱子能在不耗电时支撑第三关的门', () => {
  const state = play(levels[2], solutions.bypassBox.slice(0, 13));
  assert(gateIsOpen(state, levels[2]));
});

test('核心先到出口，不会在机器人返程前提早通关', () => {
  const sequence = solutions.transfer;
  const index = sequence.findIndex((action) => action.type === 'ship');
  const state = play(levels[0], sequence.slice(0, index + 1));
  assert(state.cart.delivered && !state.won);
});

test('读取解法不会污染关卡初始数据', () => {
  const before = JSON.stringify(levels);
  play(levels[0], solutions.transfer);
  equal(JSON.stringify(levels), before);
});
