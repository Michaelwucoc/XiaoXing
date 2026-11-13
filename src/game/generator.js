// 自动生成关卡：同一个关卡号永远生成同一张地图（方便重来和撤销），
// 每张地图都用求解器确认能完成，并记下最少步数（par），用于普通模式的步数限制。
import { FRIENDS, FRIEND_ORDER, ITEMS, STORY_LEVELS, MECHANICS, themeFor } from './data.js';
import { createState, step as ruleStep } from './rules.js';
import { solve } from './solver.js';

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const int = (r, min, max) => min + Math.floor(r() * (max - min + 1));
const pick = (r, list) => list[Math.floor(r() * list.length)];
function shuffle(r, list) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export const unlockedFriends = (n) => FRIEND_ORDER.filter((kind) => FRIENDS[kind].unlock <= n);
export const newFriendAt = (n) => FRIEND_ORDER.find((kind) => FRIENDS[kind].unlock === n) || null;
export const nextFriendAfter = (n) => FRIEND_ORDER.find((kind) => FRIENDS[kind].unlock > n) || null;
export const newMechanicAt = (n) => Object.keys(MECHANICS).find((m) => MECHANICS[m].from === n) || null;

// 每关用哪种机关：新机关第一次出现的那关一定用它；其余按场景偏好随机。
export function mechanicFor(n, r) {
  const fresh = newMechanicAt(n);
  if (fresh) return fresh;
  const open = Object.keys(MECHANICS).filter((m) => MECHANICS[m].from <= n);
  const theme = themeFor(n).id;
  const bias = { meadow: 'door', forest: 'river', snow: 'ice', night: 'portal' }[theme];
  const roll = r();
  if (open.includes(bias) && roll < 0.45) return bias;
  if (roll < 0.62) return 'plain';
  return pick(r, open);
}

export function difficulty(n) {
  const friends = n <= 5 ? 2 : 3;
  return {
    friends: Math.min(friends, unlockedFriends(n).length),
    w: Math.min(6 + Math.floor(n / 4), 9),
    h: Math.min(4 + Math.floor(n / 4), 7),
    trees: Math.min(0.08 + n * 0.006, 0.2),
    minSteps: Math.min(6 + Math.floor(n * 0.8), 22),
    maxSteps: Math.min(18 + n * 2, 44),
  };
}

export function build(n, r, mechanic) {
  const d = difficulty(n);
  const w = Math.max(6, d.w - int(r, 0, 1));
  const h = Math.max(4, d.h - int(r, 0, 1));
  // terrain：地形；thing：站在上面的东西（人物、礼物、箱子…）
  const terrain = Array.from({ length: h }, () => Array(w).fill('.'));
  const thing = Array.from({ length: h }, () => Array(w).fill(''));
  const inside = (x, y) => x >= 0 && y >= 0 && x < w && y < h;
  const empty = (x, y) => inside(x, y) && terrain[y][x] === '.' && !thing[y][x];
  const cells = (test = () => true) => {
    const out = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (empty(x, y) && test(x, y)) out.push([x, y]);
    return out;
  };
  const put = (ch, list) => {
    if (!list.length) return null;
    const [x, y] = pick(r, list);
    thing[y][x] = ch;
    return [x, y];
  };

  // 选朋友：新朋友那一关一定有它
  let kinds = shuffle(r, unlockedFriends(n));
  const fresh = newFriendAt(n);
  if (fresh) kinds = [fresh, ...kinds.filter((k) => k !== fresh)];
  kinds = kinds.slice(0, d.friends);

  // 分区：河流 / 冰面会把地图分成左右两边，起点在左，朋友在右
  let split = null;
  if (mechanic === 'river' || mechanic === 'ice' || mechanic === 'portal') {
    const width = mechanic === 'ice' ? int(r, 2, Math.min(4, w - 4)) : mechanic === 'portal' ? 1 : (n >= 20 && r() < 0.35 ? 2 : 1);
    const start = int(r, mechanic === 'river' ? 3 : 2, w - 2 - width);
    split = { start, end: start + width - 1 };
    for (let y = 0; y < h; y++) for (let x = split.start; x <= split.end; x++) terrain[y][x] = mechanic === 'ice' ? '_' : '~';
    if (mechanic === 'ice') {
      const rocks = int(r, 1, Math.max(1, Math.floor((width * h) / 6)));
      for (let i = 0; i < rocks; i++) {
        const x = int(r, split.start, split.end);
        const y = int(r, 0, h - 1);
        terrain[y][x] = 'o';
      }
    }
  }
  const left = (x) => !split || x < split.start;
  const right = (x) => !split || x > split.end;

  // 传送门：河的两边各放一个，这是过河的唯一办法
  if (mechanic === 'portal') {
    for (const side of [left, right]) {
      const list = cells((x) => side(x));
      if (!list.length) throw new Error('no room');
      const [x, y] = pick(r, list);
      terrain[y][x] = 'O';
    }
  }

  // 小门：把朋友围在小院里，留一扇门
  const doorColors = mechanic === 'door2' ? ['Y', 'B'] : mechanic === 'door' ? ['Y'] : [];
  doorColors.forEach((door, i) => {
    const spots = cells((x, y) => x >= 1 && y >= 1 && x <= w - 2 && y <= h - 2
      && [-1, 0, 1].every((dy) => [-1, 0, 1].every((dx) => empty(x + dx, y + dy))));
    if (!spots.length) throw new Error('no room');
    const [fx, fy] = pick(r, spots);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) terrain[fy + dy][fx + dx] = '=';
    terrain[fy][fx] = '.';
    thing[fy][fx] = FRIENDS[kinds[i]].char;
    const sides = DIRS4.filter(([dx, dy]) => empty(fx + dx * 2, fy + dy * 2));
    if (!sides.length) throw new Error('door faces edge');
    const [ddx, ddy] = pick(r, sides);
    terrain[fy + ddy][fx + ddx] = door;
    thing[fy + ddy * 2][fx + ddx * 2] = '+'; // 门外留一格空地
    kinds[i] = null;
  });

  for (const kind of kinds.filter(Boolean)) if (!put(FRIENDS[kind].char, cells((x) => right(x)))) throw new Error('no room');
  const player = put('P', cells((x) => left(x)));
  if (!player) throw new Error('no room');

  // 箱子：放在起点这一边，离河至少一格
  if (mechanic === 'river') {
    const width = split.end - split.start + 1;
    for (let i = 0; i < width + (r() < 0.4 ? 1 : 0); i++) {
      if (!put('X', cells((x, y) => x >= 1 && x < split.start - 1 && y >= 1 && y <= h - 2))) throw new Error('no room');
    }
  }

  // 只放不会把地图隔断的树和石头（河和冰当作“迟早能过去”）
  const passable = (x, y) => {
    const t = terrain[y][x];
    if (t === '#' || t === 'o' || t === '=') return false;
    const ch = thing[y][x];
    return !ch || ch === '+' || ch === 'P' || ch === 'X' || !FRIEND_ORDER.some((k) => FRIENDS[k].char === ch);
  };
  const connected = () => {
    const seen = new Set([`${player[0]},${player[1]}`]);
    const stack = [player];
    while (stack.length) {
      const [x, y] = stack.pop();
      for (const [dx, dy] of DIRS4) {
        const nx = x + dx;
        const ny = y + dy;
        if (!inside(nx, ny) || seen.has(`${nx},${ny}`) || !passable(nx, ny)) continue;
        seen.add(`${nx},${ny}`);
        stack.push([nx, ny]);
      }
    }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (passable(x, y) && !seen.has(`${x},${y}`)) return false;
      const ch = thing[y][x];
      if (ch && FRIEND_ORDER.some((k) => FRIENDS[k].char === ch) && !DIRS4.some(([dx, dy]) => seen.has(`${x + dx},${y + dy}`))) return false;
    }
    return true;
  };
  const amount = Math.round(w * h * d.trees * (split ? 0.7 : 1));
  for (let i = 0, tries = 0; i < amount && tries < amount * 4; tries++) {
    const list = cells();
    if (!list.length) break;
    const [x, y] = pick(r, list);
    terrain[y][x] = r() < 0.75 ? '#' : 'o';
    if (connected()) i++;
    else terrain[y][x] = '.';
  }
  for (const row of thing) for (let x = 0; x < w; x++) if (row[x] === '+') row[x] = '';

  // 礼物、钥匙、宝石：离起点稍远；冰关可以把礼物放在冰上
  const far = ([x, y]) => Math.abs(x - player[0]) + Math.abs(y - player[1]) >= 2;
  const spot = (allowIce) => {
    const list = cells(() => true).filter(far);
    if (allowIce && split && mechanic === 'ice') {
      for (let y = 0; y < h; y++) for (let x = split.start; x <= split.end; x++) if (terrain[y][x] === '_' && !thing[y][x]) list.push([x, y]);
    }
    return list;
  };
  const friendsHere = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const kind = FRIEND_ORDER.find((k) => FRIENDS[k].char === thing[y][x]);
    if (kind) friendsHere.push(kind);
  }
  for (const kind of friendsHere) if (!put(ITEMS[FRIENDS[kind].want].char, spot(r() < 0.4))) throw new Error('no room');
  for (const door of doorColors) if (!put(door === 'Y' ? ITEMS.keyY.char : ITEMS.keyB.char, spot(false))) throw new Error('no room');
  put('*', spot(r() < 0.5));
  // 宝箱：每三关藏一个，里面有一件道具（可选，不拿也能过关）
  if (n >= 5 && n % 3 === 2) put('T', spot(false));

  // 合成地图：有东西的格子写东西，地形不是平地的记到 under 里
  const map = [];
  const under = [];
  for (let y = 0; y < h; y++) {
    let row = '';
    let urow = '';
    for (let x = 0; x < w; x++) {
      row += thing[y][x] || terrain[y][x];
      urow += thing[y][x] && terrain[y][x] !== '.' ? terrain[y][x] : ' ';
    }
    map.push(row);
    under.push(urow);
  }
  return { map, under: under.some((u) => u.trim()) ? under : undefined };
}

const cache = new Map();
export function generateLevel(n) {
  if (n <= STORY_LEVELS.length) {
    const level = STORY_LEVELS[Math.max(0, n - 1)];
    if (!level.par) level.par = solve(createState(level)).path.length;
    return level;
  }
  if (cache.has(n)) return cache.get(n);
  const d = difficulty(n);
  let best = null;
  for (let attempt = 0; attempt < 120; attempt++) {
    const r = rng(n * 7919 + attempt * 104729 + 17);
    const mechanic = mechanicFor(n, r);
    let built;
    try { built = build(n, r, mechanic); } catch { continue; }
    const level = { id: n, mechanic, lesson: newMechanicAt(n), ...built };
    const state = createState(level);
    const { path } = solve(state, { maxNodes: 30000 });
    if (!path || path.length > d.maxSteps) continue;
    // 机关必须真的用上（例如河关一定要搭桥）
    if (mechanic === 'river' || mechanic === 'ice' || mechanic === 'portal') {
      let s = state;
      let used = false;
      for (const dir of path) {
        const { state: next, events } = ruleStep(s, dir);
        s = next;
        if (events.some((e) => e.type === 'splash' || e.type === 'portal' || (e.type === 'move' && e.slide))) used = true;
      }
      if (!used) continue;
    }
    level.par = path.length;
    if (path.length >= d.minSteps) { best = level; break; }
    if (!best || path.length > best.par) best = level;
  }
  if (!best) best = { ...STORY_LEVELS[1], id: n, par: generateLevel(2).par };
  cache.set(n, best);
  return best;
}

// 每日挑战：同一天所有人都是同一张图。用很大的关卡号，难度固定在最高档。
export const dayKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
export function dailyNumber(key = dayKey()) {
  let hash = 0;
  for (const ch of key) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return 1000 + (hash % 9000);
}
