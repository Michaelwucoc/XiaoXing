// 本地保存进度和设置，只存在当前浏览器里。
const KEY = 'xiaoxing-delivery-v1';
const DEFAULTS = {
  settings: { sound: true, music: false, volume: 0.6, speech: false, calm: false, dpad: true, tilt: true, mode: 'easy', sensitivity: 'mid', outfit: 'blue' },
  progress: {
    level: 1, best: 0, hearts: 0, gems: {}, ratings: {}, gifts: {}, met: {}, setupDone: false,
    tools: { firefly: 1, magnet: 1, shoes: 1 }, // 口袋里的道具（新玩家各送一件）
    chests: {}, // 已打开宝箱的关卡
    stickers: {}, // 已获得的贴纸
    stats: { doors: 0, bridges: 0, slides: 0, portals: 0, tools: 0 },
    daily: { last: null, streak: 0, bestStreak: 0, total: 0, stars: 0 },
    giftDay: null, // 上次领取每日礼物的日期
  },
};
const NESTED = ['tools', 'stats', 'daily'];
export function load() {
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) || '{}');
    const progress = { ...DEFAULTS.progress, ...(raw.progress || {}) };
    if (raw.progress?.stars && !raw.progress.gems) progress.gems = raw.progress.stars; // 旧版“星星”改名为宝石
    delete progress.stars;
    for (const key of NESTED) progress[key] = { ...DEFAULTS.progress[key], ...(raw.progress?.[key] || {}) };
    return { settings: { ...DEFAULTS.settings, ...(raw.settings || {}) }, progress };
  } catch {
    return structuredClone(DEFAULTS);
  }
}
export function save(data) {
  try { window.localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* 隐私模式下可能无法保存 */ }
}
export const defaults = () => structuredClone(DEFAULTS);

// 普通模式：步数上限和星级
export function stepRules(par) {
  return {
    three: par + Math.max(2, Math.ceil(par * 0.15)),
    two: par + Math.max(4, Math.ceil(par * 0.3)),
    limit: par + Math.max(6, Math.ceil(par * 0.5)),
  };
}
export const rating = (steps, par) => {
  const r = stepRules(par);
  return steps <= r.three ? 3 : steps <= r.two ? 2 : 1;
};
