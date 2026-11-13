import { DIRS, DIR_NAMES, step, stateKey, friendAt, boxAt, tileAt, doorKey, inside } from './rules.js';

// 宽度优先搜索：找到让所有朋友开心的最短步骤。
// 返回 { path } 、{ path: null }（走不通）或 { path: undefined }（超出搜索上限）。
export function solve(start, { maxNodes = 250000 } = {}) {
  if (start.won) return { path: [], nodes: 0 };
  const seen = new Map([[stateKey(start), null]]);
  const queue = [start];
  const parents = [null];
  const moves = [null];
  for (let head = 0; head < queue.length; head++) {
    const state = queue[head];
    for (const dir of DIR_NAMES) {
      const { state: next, changed } = step(state, dir);
      if (!changed) continue;
      const key = stateKey(next);
      if (seen.has(key)) continue;
      seen.set(key, true);
      queue.push(next);
      parents.push(head);
      moves.push(dir);
      if (next.won) {
        const path = [];
        for (let i = queue.length - 1; i > 0; i = parents[i]) path.unshift(moves[i]);
        return { path, nodes: queue.length };
      }
      if (queue.length > maxNodes) return { path: undefined, nodes: queue.length };
    }
  }
  return { path: null, nodes: queue.length };
}

const QUIET = new Set(['move', 'star', 'chest']);

// 点地图移动：只走“安全”的格子（不会顺路捡东西、推箱子），最后一步才互动。
export function findPath(start, tx, ty) {
  if (!inside(start, tx, ty)) return null;
  const isBumpTarget = Boolean(friendAt(start, tx, ty) || doorKey(tileAt(start, tx, ty)));
  const box = boxAt(start, tx, ty);
  const isPortal = tileAt(start, tx, ty) === 'O';
  const reached = (prev, next, events) => {
    if (isBumpTarget) return events.some((e) => e.x === tx && e.y === ty && ['deliver', 'wrong', 'wish', 'friend-done', 'open', 'locked'].includes(e.type));
    if (box) return false;
    if (isPortal) return events.some((e) => e.type === 'portal' && e.from.x === tx && e.from.y === ty);
    return next.player.x === tx && next.player.y === ty;
  };
  // 推箱子：已相邻就推一下；否则走到能推动它的一侧。
  let boxGoals = null;
  if (box) {
    boxGoals = new Set();
    for (const dir of DIR_NAMES) {
      const [dx, dy] = DIRS[dir];
      const fromX = tx - dx;
      const fromY = ty - dy;
      if (start.player.x === fromX && start.player.y === fromY) {
        const { events } = step(start, dir);
        if (events.some((e) => e.type === 'push' || e.type === 'splash')) return [dir];
      }
      const probe = { ...start, player: { x: fromX, y: fromY } };
      if (inside(start, fromX, fromY) && step(probe, dir).events.some((e) => e.type === 'push' || e.type === 'splash')) boxGoals.add(`${fromX},${fromY}`);
    }
    if (!boxGoals.size) return null;
    if (boxGoals.has(`${start.player.x},${start.player.y}`)) return [];
  }
  const seen = new Set([`${start.player.x},${start.player.y}`]);
  const queue = [{ state: start, path: [] }];
  for (let head = 0; head < queue.length && head < 4000; head++) {
    const { state, path } = queue[head];
    for (const dir of DIR_NAMES) {
      const { state: next, events, changed } = step(state, dir);
      if (reached(state, next, events)) return [...path, dir];
      if (!changed || !events.every((e) => QUIET.has(e.type))) continue;
      const key = `${next.player.x},${next.player.y}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (boxGoals?.has(key)) return [...path, dir];
      queue.push({ state: next, path: [...path, dir] });
    }
  }
  return null;
}
