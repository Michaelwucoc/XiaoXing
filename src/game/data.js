// 游戏数据：朋友、物品、场景。
// 每位朋友永远只想要同一种礼物，规则保持一致、可预测。

export const FRIENDS = {
  hedgehog: { char: 'H', name: '小刺猬', want: 'apple', unlock: 1, bio: '最爱红红的苹果。背上的刺软软的，不扎人。' },
  rabbit: { char: 'R', name: '小兔', want: 'carrot', unlock: 2, bio: '最爱胡萝卜。开心的时候，耳朵会竖得高高的。' },
  bear: { char: 'E', name: '小熊', want: 'honey', unlock: 3, bio: '最爱甜甜的蜂蜜。走路慢慢的，说话轻轻的。' },
  cat: { char: 'C', name: '小猫', want: 'fish', unlock: 8, bio: '最爱小鱼。喜欢在暖和的地方打个盹。' },
  penguin: { char: 'G', name: '小企鹅', want: 'scarf', unlock: 13, bio: '住在雪山上。冬天想要一条暖暖的围巾。' },
  owl: { char: 'W', name: '小猫头鹰', want: 'lantern', unlock: 18, bio: '晚上才醒来。想要一盏小灯笼，照亮回家的路。' },
};
// 收到礼物时说的话（每位朋友固定一句，保持可预测）
export const THANKS = {
  hedgehog: '谢谢你！苹果真甜',
  rabbit: '谢谢！胡萝卜脆脆的',
  bear: '谢谢你，蜂蜜好香呀',
  cat: '喵～谢谢你的小鱼',
  penguin: '谢谢！围巾好暖和',
  owl: '咕咕～灯笼亮亮的，谢谢',
};
export const FRIEND_ORDER = Object.keys(FRIENDS).sort((a, b) => FRIENDS[a].unlock - FRIENDS[b].unlock);

export const ITEMS = {
  apple: { char: 'a', name: '苹果' },
  carrot: { char: 'c', name: '胡萝卜' },
  honey: { char: 'h', name: '蜂蜜' },
  fish: { char: 'f', name: '小鱼' },
  scarf: { char: 's', name: '围巾' },
  lantern: { char: 'l', name: '小灯笼' },
  keyY: { char: 'y', name: '黄钥匙' },
  keyB: { char: 'b', name: '蓝钥匙' },
};

export const DOORS = {
  Y: { name: '黄色小门', key: 'keyY' },
  B: { name: '蓝色小门', key: 'keyB' },
};

// 道具：放在口袋里，想用的时候才用；不用也能过关。
export const TOOLS = {
  firefly: { name: '指路萤火虫', short: '萤火虫', desc: '照亮通往终点的整条路。' },
  magnet: { name: '礼物磁铁', short: '磁铁', desc: '空着手时，把一件朋友想要的礼物吸到手里。' },
  shoes: { name: '加步鞋', short: '加步鞋', desc: '普通模式里多走 5 步。' },
};
export const TOOL_ORDER = Object.keys(TOOLS);

// 贴纸（成就）：只记录好事，没有“失败”类的条目。
export const STICKERS = [
  { id: 'first', icon: '🎁', name: '第一份礼物', desc: '送出第一份礼物', test: (p) => p.hearts >= 1 },
  { id: 'hearts25', icon: '💗', name: '爱心满满', desc: '送出 25 份礼物', test: (p) => p.hearts >= 25 },
  { id: 'hearts100', icon: '🚀', name: '超级快递员', desc: '送出 100 份礼物', test: (p) => p.hearts >= 100 },
  { id: 'star3', icon: '⭐', name: '三星闪闪', desc: '第一次拿到三颗星', test: (p) => Object.values(p.ratings).some((r) => r >= 3) },
  { id: 'stars30', icon: '🌟', name: '星星收藏家', desc: '一共拿到 30 颗星', test: (p) => Object.values(p.ratings).reduce((a, b) => a + b, 0) >= 30 },
  { id: 'gems5', icon: '💎', name: '寻宝小能手', desc: '找到 5 颗宝石', test: (p) => Object.keys(p.gems).length >= 5 },
  { id: 'chest3', icon: '🧰', name: '开箱达人', desc: '打开 3 个宝箱', test: (p) => Object.keys(p.chests).length >= 3 },
  { id: 'door', icon: '🔑', name: '开锁专家', desc: '打开 10 扇小门', test: (p) => p.stats.doors >= 10 },
  { id: 'bridge', icon: '🌉', name: '小小造桥师', desc: '搭好 5 座小木桥', test: (p) => p.stats.bridges >= 5 },
  { id: 'ice', icon: '⛸️', name: '滑冰高手', desc: '在冰面上滑行 10 次', test: (p) => p.stats.slides >= 10 },
  { id: 'portal', icon: '🌀', name: '星夜旅行家', desc: '穿过传送门 5 次', test: (p) => p.stats.portals >= 5 },
  { id: 'daily1', icon: '📅', name: '今日挑战', desc: '完成一次每日挑战', test: (p) => p.daily.total >= 1 },
  { id: 'daily3', icon: '🔥', name: '连续三天', desc: '连续 3 天完成每日挑战', test: (p) => p.daily.bestStreak >= 3 },
  { id: 'friends', icon: '🤝', name: '朋友遍天下', desc: '认识所有的朋友', test: (p) => Object.keys(FRIENDS).every((k) => p.met[k]) },
  { id: 'level20', icon: '🗺️', name: '走得很远', desc: '完成第 20 关', test: (p) => p.best >= 20 },
];

// 每 5 关换一个场景，轮流出现。
export const THEMES = [
  { id: 'meadow', name: '阳光草地' },
  { id: 'forest', name: '蘑菇森林' },
  { id: 'snow', name: '冰雪山谷' },
  { id: 'night', name: '星光夜晚' },
];
export const themeFor = (n) => THEMES[Math.floor((n - 1) / 5) % THEMES.length];

// 机关：第一次出现的关卡会先介绍玩法。
export const MECHANICS = {
  plain: { from: 1 },
  door: { from: 3 },
  river: { from: 6 },
  ice: { from: 11 },
  portal: { from: 16 },
  door2: { from: 21 },
};

export const LESSONS = {
  key: {
    title: '新本领：钥匙和小门',
    lines: ['拿着钥匙，朝同样颜色的小门走一步，门就开了。', '小星一次只能拿一样东西：先开门，再去拿礼物。'],
  },
  river: {
    title: '新本领：推箱子搭桥',
    lines: ['朝箱子走，就能把它推动一格。', '把箱子推进河里，它会变成一座小木桥。', '推到角落推不动了？点“撤销”退回去就好。'],
  },
  ice: {
    title: '新本领：冰面滑行',
    lines: ['走上冰面会一直滑，碰到东西才停下。', '石头可以帮你停住；滑到礼物上也会停。', '想好方向再出发！'],
  },
  portal: {
    title: '新本领：星星传送门',
    lines: ['地图上有两个发光的传送门，它们是一对。', '走进一个，就会从另一个出来。', '河对岸过不去？找找传送门！'],
  },
  door2: {
    title: '新本领：两把钥匙',
    lines: ['黄钥匙开黄色小门（圆形标记），蓝钥匙开蓝色小门（菱形标记）。', '一次只能拿一把，想想先开哪一扇。'],
  },
};

// 前 3 关是精心设计的固定关卡；之后由生成器自动出题。
export const STORY_LEVELS = [
  {
    id: 1, title: '你好，小刺猬', tutorial: true,
    map: [
      '#.....#',
      '.P..a..',
      '.....H.',
      '#..*..#',
    ],
  },
  {
    id: 2, title: '两位好朋友',
    map: [
      '#...#...',
      '.a.....R',
      '..P.o...',
      '.c.....H',
      '#...#.*#',
    ],
  },
  {
    id: 3, title: '小熊的院子', lesson: 'key', mechanic: 'door',
    map: [
      'y.....*',
      '..o....',
      '.===Y==',
      '.=....=',
      '.=.E..=',
      '.======',
      'P.....h',
    ],
  },
];
export const TUTORIAL = STORY_LEVELS[0];
