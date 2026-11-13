// 纯规则：不碰 DOM，方便测试和求解。
// 地形字符： . 地面  # 树  o 石头  = 栅栏  ~ 水  r 木筏(箱子填的水)  _ 冰  Y/B 黄门/蓝门  O 传送门(成对)

import { FRIENDS, ITEMS } from './data.js';

export const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
export const DIR_NAMES = Object.keys(DIRS);

const ENTITY = {
  P: 'player', X: 'box', '*': 'star', T: 'chest',
};
const ITEM_BY_CHAR = Object.fromEntries(Object.entries(ITEMS).map(([type, item]) => [item.char, type]));
const FRIEND_BY_CHAR = Object.fromEntries(Object.entries(FRIENDS).map(([kind, friend]) => [friend.char, kind]));
const TERRAIN = new Set(['.', '#', 'o', '=', '~', '_', 'Y', 'B', 'O']);

export function createState(level) {
  const rows = level.map;
  const h = rows.length;
  const w = rows[0].length;
  const tiles = [];
  const state = {
    w, h, tiles, player: null, facing: 'down', carry: null,
    items: [], boxes: [], friends: [], star: null, starTaken: false, chest: null, chestTaken: false,
    steps: 0, won: false, nextId: 1,
  };
  for (let y = 0; y < h; y++) {
    if (rows[y].length !== w) throw new Error(`${level.id}: 第 ${y + 1} 行长度不一致`);
    for (let x = 0; x < w; x++) {
      const ch = rows[y][x];
      const under = level.under?.[y]?.[x];
      let tile = TERRAIN.has(ch) ? ch : '.';
      if (under && under !== ' ' && !TERRAIN.has(ch)) tile = under;
      tiles.push(tile);
      if (TERRAIN.has(ch)) continue;
      if (ENTITY[ch] === 'player') state.player = { x, y };
      else if (ENTITY[ch] === 'box') state.boxes.push({ id: `b${state.nextId++}`, x, y });
      else if (ENTITY[ch] === 'star') state.star = { x, y };
      else if (ENTITY[ch] === 'chest') state.chest = { x, y };
      else if (ITEM_BY_CHAR[ch]) state.items.push({ id: `i${state.nextId++}`, type: ITEM_BY_CHAR[ch], x, y });
      else if (FRIEND_BY_CHAR[ch]) {
        const kind = FRIEND_BY_CHAR[ch];
        state.friends.push({ id: `f${state.nextId++}`, kind, want: FRIENDS[kind].want, x, y, happy: false });
      } else throw new Error(`${level.id}: 未知字符 "${ch}"`);
    }
  }
  if (!state.player) throw new Error(`${level.id}: 没有起点 P`);
  return state;
}

export const clone = (s) => ({
  ...s,
  tiles: s.tiles.slice(),
  player: { ...s.player },
  items: s.items.map((i) => ({ ...i })),
  boxes: s.boxes.map((b) => ({ ...b })),
  friends: s.friends.map((f) => ({ ...f })),
  star: s.star ? { ...s.star } : null,
  chest: s.chest ? { ...s.chest } : null,
});

export const inside = (s, x, y) => x >= 0 && y >= 0 && x < s.w && y < s.h;
export const tileAt = (s, x, y) => (inside(s, x, y) ? s.tiles[y * s.w + x] : null);
const setTile = (s, x, y, t) => { s.tiles[y * s.w + x] = t; };
export const friendAt = (s, x, y) => s.friends.find((f) => f.x === x && f.y === y);
export const boxAt = (s, x, y) => s.boxes.find((b) => b.x === x && b.y === y);
export const itemAt = (s, x, y) => s.items.find((i) => i.x === x && i.y === y);
const starAt = (s, x, y) => s.star && !s.starTaken && s.star.x === x && s.star.y === y;
const chestAt = (s, x, y) => s.chest && !s.chestTaken && s.chest.x === x && s.chest.y === y;
export const isWalkable = (t) => t === '.' || t === 'r' || t === '_' || t === 'O';
// 传送门成对出现：返回另一个门的位置
export function portalExit(s, x, y) {
  for (let i = 0; i < s.tiles.length; i++) {
    if (s.tiles[i] !== 'O') continue;
    const px = i % s.w;
    const py = Math.floor(i / s.w);
    if (px !== x || py !== y) return { x: px, y: py };
  }
  return null;
}
export const doorKey = (t) => (t === 'Y' ? 'keyY' : t === 'B' ? 'keyB' : null);

// 朝某个方向碰到朋友或门时的互动；返回 true 表示被处理（玩家不移动）。
function bump(s, x, y, ev) {
  const friend = friendAt(s, x, y);
  if (friend) {
    if (friend.happy) ev.push({ type: 'friend-done', friend: friend.id, kind: friend.kind });
    else if (s.carry === friend.want) {
      friend.happy = true;
      ev.push({ type: 'deliver', friend: friend.id, kind: friend.kind, item: s.carry, x, y });
      s.carry = null;
    } else if (s.carry) ev.push({ type: 'wrong', friend: friend.id, kind: friend.kind, item: s.carry, want: friend.want });
    else ev.push({ type: 'wish', friend: friend.id, kind: friend.kind, want: friend.want });
    return true;
  }
  const tile = tileAt(s, x, y);
  const key = doorKey(tile);
  if (key) {
    if (s.carry === key) {
      setTile(s, x, y, '.');
      s.carry = null;
      ev.push({ type: 'open', door: tile, x, y });
    } else ev.push({ type: 'locked', door: tile, key, x, y });
    return true;
  }
  return false;
}

function boxBlocked(s, x, y) {
  if (!inside(s, x, y)) return true;
  const t = tileAt(s, x, y);
  if (t !== '.' && t !== 'r' && t !== '~') return true;
  return Boolean(boxAt(s, x, y) || friendAt(s, x, y) || itemAt(s, x, y) || starAt(s, x, y) || chestAt(s, x, y));
}

// 走一格。返回 'moved' | 'stop'（移动后需停下，如捡到东西） | false（没动）
function moveOnce(s, dir, ev, sliding) {
  const [dx, dy] = DIRS[dir];
  const x = s.player.x + dx;
  const y = s.player.y + dy;
  if (!inside(s, x, y)) { ev.push({ type: 'blocked', what: 'edge', x, y }); return false; }
  if (bump(s, x, y, ev)) return false;
  const tile = tileAt(s, x, y);
  if (tile === '~') { ev.push({ type: 'blocked', what: 'water', x, y }); return false; }
  if (!isWalkable(tile)) { ev.push({ type: 'blocked', what: tile, x, y }); return false; }
  const box = boxAt(s, x, y);
  if (box) {
    const bx = x + dx;
    const by = y + dy;
    if (sliding || boxBlocked(s, bx, by)) { ev.push({ type: 'blocked', what: 'box', x, y }); return false; }
    if (tileAt(s, bx, by) === '~') {
      setTile(s, bx, by, 'r');
      s.boxes = s.boxes.filter((b) => b !== box);
      ev.push({ type: 'splash', box: box.id, from: { x, y }, x: bx, y: by });
    } else {
      box.x = bx; box.y = by;
      ev.push({ type: 'push', box: box.id, x: bx, y: by });
    }
  }
  s.player = { x, y };
  ev.push({ type: 'move', x, y, slide: sliding });
  if (starAt(s, x, y)) { s.starTaken = true; ev.push({ type: 'star', x, y }); }
  if (chestAt(s, x, y)) { s.chestTaken = true; ev.push({ type: 'chest', x, y }); }
  if (tile === 'O') {
    const exit = portalExit(s, x, y);
    if (exit && !boxAt(s, exit.x, exit.y)) {
      s.player = { x: exit.x, y: exit.y };
      ev.push({ type: 'portal', from: { x, y }, x: exit.x, y: exit.y });
      return 'stop';
    }
  }
  const item = itemAt(s, x, y);
  if (item) {
    if (s.carry) {
      const dropped = { id: `i${s.nextId++}`, type: s.carry, x, y };
      s.items = s.items.filter((i) => i !== item).concat(dropped);
      ev.push({ type: 'swap', item: item.type, dropped: s.carry, x, y });
    } else {
      s.items = s.items.filter((i) => i !== item);
      ev.push({ type: 'pickup', item: item.type, x, y });
    }
    s.carry = item.type;
    return 'stop';
  }
  return 'moved';
}

// 执行一次方向输入。冰面上会一直滑，直到撞到东西、捡到东西或离开冰面。
export function step(state, dir) {
  const s = clone(state);
  const ev = [];
  s.facing = dir;
  let result = moveOnce(s, dir, ev, false);
  let slid = 0;
  while (result === 'moved' && tileAt(s, s.player.x, s.player.y) === '_' && slid < 64) {
    result = moveOnce(s, dir, ev, true);
    slid++;
  }
  const changed = ev.some((e) => e.type !== 'blocked' && e.type !== 'wish' && e.type !== 'wrong' && e.type !== 'locked' && e.type !== 'friend-done');
  if (changed) s.steps++;
  if (!s.won && s.friends.length && s.friends.every((f) => f.happy)) {
    s.won = true;
    ev.push({ type: 'win' });
  }
  return { state: s, events: ev, changed };
}

// 道具“礼物磁铁”：空着手时，把最近一位还在等礼物的朋友想要的礼物吸到手里。
export function magnetPull(state) {
  if (state.carry || state.won) return null;
  const dist = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  const waiting = state.friends.filter((f) => !f.happy && state.items.some((i) => i.type === f.want))
    .sort((a, b) => dist(a, state.player) - dist(b, state.player));
  if (!waiting.length) return null;
  const s = clone(state);
  const item = s.items.find((i) => i.type === waiting[0].want);
  s.items = s.items.filter((i) => i !== item);
  s.carry = item.type;
  return { state: s, item: { ...item } };
}

export const stateKey = (s) => [
  s.player.x, s.player.y, s.carry || '-',
  s.items.map((i) => `${i.type}@${i.x},${i.y}`).sort().join(';'),
  s.boxes.map((b) => `${b.x},${b.y}`).sort().join(';'),
  s.tiles.join(''),
  s.friends.map((f) => (f.happy ? 1 : 0)).join(''),
].join('|');
