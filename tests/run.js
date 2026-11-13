// 运行：node tests/run.js
import assert from 'node:assert/strict';
import { STORY_LEVELS, STICKERS, TOOLS, FRIENDS, THANKS } from '../src/game/data.js';
import { createState, step, magnetPull } from '../src/game/rules.js';
import { solve, findPath } from '../src/game/solver.js';
import { generateLevel, dailyNumber, dayKey } from '../src/game/generator.js';
import { parseMessage, SerialLineDecoder, createMicrobit } from '../src/input/microbit.js';
import { stepRules, rating } from '../src/storage.js';

const tests = [];
const test = (name, fn) => tests.push({ name, fn });
const run = (state, dirs) => dirs.reduce((s, d) => step(s, d).state, state);

test('走路、捡起、送礼', () => {
  let s = createState({ id: 't', map: ['Pa.H'] });
  s = run(s, ['right']);
  assert.equal(s.carry, 'apple');
  const r = step(run(s, ['right']), 'right');
  assert.ok(r.events.some((e) => e.type === 'deliver'));
  assert.equal(r.state.won, true);
});
test('送错礼物不会被收下', () => {
  const s = run(createState({ id: 't', map: ['Pc.H'] }), ['right', 'right']);
  const r = step(s, 'right');
  assert.ok(r.events.some((e) => e.type === 'wrong'));
  assert.equal(r.state.carry, 'carrot');
});
test('一次只拿一样：踩到新礼物会交换', () => {
  const s = run(createState({ id: 't', map: ['Pac'] }), ['right', 'right']);
  assert.equal(s.carry, 'carrot');
  assert.equal(s.items[0].type, 'apple');
});
test('钥匙开同色门，钥匙用掉', () => {
  let s = run(createState({ id: 't', map: ['PyY.'] }), ['right']);
  const r = step(s, 'right');
  assert.ok(r.events.some((e) => e.type === 'open'));
  s = r.state;
  assert.equal(s.carry, null);
  assert.equal(s.tiles[2], '.');
});
test('树、栅栏、边界挡路', () => {
  const s = createState({ id: 't', map: ['P#', '=.'] });
  for (const d of ['right', 'down', 'up', 'left']) assert.equal(step(s, d).changed, false);
});
test('点地图寻路不会顺路捡东西', () => {
  const s = createState({ id: 't', map: ['Pa.', '...'] });
  const path = findPath(s, 2, 0);
  const end = run(s, path);
  assert.equal(end.player.x, 2);
  assert.equal(end.carry, null);
});
test('前 3 关都能完成', () => {
  for (const level of STORY_LEVELS) assert.ok(solve(createState(level)).path?.length, `第 ${level.id} 关无解`);
});
test('自动生成第 4–80 关：都能完成、同号同图', () => {
  for (let n = 4; n <= 80; n++) {
    const level = generateLevel(n);
    assert.ok(solve(createState(level), { maxNodes: 200000 }).path, `第 ${n} 关无解`);
    assert.notEqual(level.map, STORY_LEVELS[1].map, `第 ${n} 关生成失败`);
  }
});
test('micro:bit 串口消息解析', () => {
  assert.deepEqual(parseMessage('ORBIT|M|left'), { type: 'move', direction: 'left' });
  assert.deepEqual(parseMessage('ORBIT|A'), { type: 'a' });
  assert.equal(parseMessage('hello'), null);
  const d = new SerialLineDecoder();
  assert.deepEqual(d.push('ORBIT|M|u'), []);
  assert.deepEqual(d.push('p\r\nORBIT|B\n'), [{ type: 'move', direction: 'up' }, { type: 'b' }]);
});

test('新机关：河关要搭桥、冰关要滑行、钥匙关要开门', () => {
  const seen = new Set();
  for (let n = 4; n <= 40; n++) {
    const level = generateLevel(n);
    seen.add(level.mechanic);
    let s = createState(level);
    const events = [];
    for (const d of solve(s, { maxNodes: 200000 }).path) { const r = step(s, d); s = r.state; events.push(...r.events); }
    if (level.mechanic === 'river') assert.ok(events.some((e) => e.type === 'splash'), `第 ${n} 关没用到桥`);
    if (level.mechanic === 'ice') assert.ok(events.some((e) => e.type === 'move' && e.slide), `第 ${n} 关没用到冰`);
    if (level.mechanic?.startsWith('door')) assert.ok(events.some((e) => e.type === 'open'), `第 ${n} 关没开门`);
    if (level.mechanic === 'portal') assert.ok(events.some((e) => e.type === 'portal'), `第 ${n} 关没用到传送门`);
  }
  for (const m of ['plain', 'door', 'river', 'ice', 'portal', 'door2']) assert.ok(seen.has(m), `没出现 ${m}`);
});
test('传送门：走进一个，从另一个出来；点地图可以走进传送门', () => {
  const s = createState({ id: 't', map: ['PO~O.H'] });
  const r = step(s, 'right');
  assert.ok(r.events.some((e) => e.type === 'portal'));
  assert.deepEqual(r.state.player, { x: 3, y: 0 });
  assert.deepEqual(step(run(r.state, ['right']), 'left').state.player, { x: 1, y: 0 });
  assert.deepEqual(findPath(s, 1, 0), ['right']);
  assert.ok(solve(createState({ id: 't', map: ['PaO~O.H'] })).path);
});
test('宝箱：走上去就拿到，不影响过关', () => {
  const s = run(createState({ id: 't', map: ['PTa.H'] }), ['right']);
  assert.equal(s.chestTaken, true);
  assert.equal(solve(createState({ id: 't', map: ['PTa.H'] })).path.length, 4);
});
test('道具磁铁：空手时吸来最近朋友想要的礼物', () => {
  const s = createState({ id: 't', map: ['P..H', 'c..a', 'R...'] });
  const pulled = magnetPull(s);
  assert.equal(pulled.state.carry, 'carrot');
  assert.equal(pulled.state.items.length, 1);
  assert.equal(magnetPull(pulled.state), null);
  assert.ok(solve(pulled.state).path);
});
test('新朋友小猫头鹰、每日挑战、贴纸数据', () => {
  assert.ok(generateLevel(18).map.join('').includes('W'), '第 18 关没有小猫头鹰');
  for (const kind of Object.keys(FRIENDS)) assert.ok(THANKS[kind], `${kind} 没有感谢语`);
  for (let i = 0; i < 20; i++) {
    const n = dailyNumber(dayKey(new Date(2026, 10, 1 + i)));
    assert.equal(n, dailyNumber(dayKey(new Date(2026, 10, 1 + i))));
    assert.ok(solve(createState(generateLevel(n)), { maxNodes: 200000 }).path, `每日挑战 ${n} 无解`);
  }
  const fresh = { hearts: 0, best: 0, ratings: {}, gems: {}, chests: {}, met: {}, stats: { doors: 0, bridges: 0, slides: 0, portals: 0 }, daily: { total: 0, bestStreak: 0 } };
  assert.equal(STICKERS.filter((st) => st.test(fresh)).length, 0);
  assert.equal(new Set(STICKERS.map((st) => st.id)).size, STICKERS.length);
  assert.ok(STICKERS.find((st) => st.id === 'first').test({ ...fresh, hearts: 1 }));
  assert.equal(Object.keys(TOOLS).length, 3);
});
test('普通模式：最优解三星、步数上限大于三星线', () => {
  for (const par of [5, 20, 40]) {
    const r = stepRules(par);
    assert.ok(r.three < r.two && r.two < r.limit);
    assert.equal(rating(par, par), 3);
    assert.equal(rating(r.limit, par), 1);
  }
});
test('micro:bit 版本、校准、灵敏度（模拟板子）', async () => {
  const written = [];
  let push;
  const readable = new ReadableStream({ start(c) { push = (t) => c.enqueue(new TextEncoder().encode(t)); } });
  const writable = new WritableStream({ write(chunk) {
    const text = new TextDecoder().decode(chunk);
    written.push(text);
    if (text.includes('ORBIT|?')) push('ORBIT|V|2\n');
    if (text.includes('ORBIT|C')) setTimeout(() => push('ORBIT|K\n'), 20);
  } });
  const port = { readable, writable, open: async () => {}, close: async () => {} };
  const states = [];
  const actions = [];
  const mb = createMicrobit({ serial: { requestPort: async () => port }, onStatus: (s) => states.push(s.state), onAction: (a) => actions.push(a) });
  assert.equal(await mb.connect(), true);
  assert.equal(mb.ready, true);
  assert.ok(states.includes('ready'));
  assert.ok(written.join('').includes('ORBIT|S|380'));
  assert.equal(await mb.calibrate(), true);
  await mb.setSensitivity('low');
  assert.ok(written.join('').includes('ORBIT|S|520'));
  push('ORBIT|M|left\nORBIT|B\n');
  await new Promise((r) => setTimeout(r, 30));
  assert.deepEqual(actions, [{ type: 'move', direction: 'left' }, { type: 'b' }]);
});

let failed = 0;
for (const t of tests) {
  try { await t.fn(); console.log(`PASS ${t.name}`); } catch (e) { failed++; console.log(`FAIL ${t.name}\n  ${e.message}`); }
}
console.log(`\n${tests.length - failed}/${tests.length} 通过`);
if (failed) process.exitCode = 1;
