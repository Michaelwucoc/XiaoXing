// 所有美术都是内联 SVG，以 100×100 的格子为单位绘制，不依赖外部图片。

const INK = '#4a3b32';

function face(cx, cy, mood, { gap = 13, eye = 4.2, mouthY = 9, cheek = '#ff9f8f' } = {}) {
  const l = cx - gap;
  const r = cx + gap;
  const eyes = mood === 'happy'
    ? `<path d="M${l - 5} ${cy + 1} q5 -6 10 0 M${r - 5} ${cy + 1} q5 -6 10 0" stroke="${INK}" stroke-width="3.2" fill="none" stroke-linecap="round"/>`
    : `<ellipse cx="${l}" cy="${cy}" rx="${eye}" ry="${eye * 1.2}" fill="${INK}"/><ellipse cx="${r}" cy="${cy}" rx="${eye}" ry="${eye * 1.2}" fill="${INK}"/>
       <circle cx="${l + 1.4}" cy="${cy - 1.8}" r="1.5" fill="#fff"/><circle cx="${r + 1.4}" cy="${cy - 1.8}" r="1.5" fill="#fff"/>`;
  const mouth = mood === 'happy'
    ? `<path d="M${cx - 7} ${cy + mouthY - 2} q7 9 14 0 z" fill="#c8504a" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>`
    : `<path d="M${cx - 4.5} ${cy + mouthY} q4.5 4 9 0" stroke="${INK}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
  return `${eyes}<ellipse cx="${l - 6}" cy="${cy + 8}" rx="5.5" ry="3.6" fill="${cheek}" opacity=".7"/><ellipse cx="${r + 6}" cy="${cy + 8}" rx="5.5" ry="3.6" fill="${cheek}" opacity=".7"/>${mouth}`;
}

const shadow = (rx = 28) => `<ellipse cx="50" cy="90" rx="${rx}" ry="6" fill="#2d4a1e" opacity=".16"/>`;

// ---------- 主角：小星 ----------
// 衣橱：不同的帽子，用爱心 / 星级 / 宝石解锁。
export const OUTFITS = {
  blue: { name: '蓝色帽子', need: null, cap: '#5b8def', brim: '#3f6fd1' },
  red: { name: '红色帽子', need: { hearts: 8 }, cap: '#ef5f5f', brim: '#cf4343' },
  leaf: { name: '树叶帽', need: { stars: 12 }, cap: '#5cbf6a', brim: '#3e9a4c', extra: 'leaf' },
  flower: { name: '花朵帽', need: { gems: 5 }, cap: '#ff9fc2', brim: '#e9779f', extra: 'flower' },
  rainbow: { name: '彩虹帽', need: { hearts: 40 }, cap: 'url(#rainbow)', brim: '#7d6bd6', extra: 'rainbow' },
  crown: { name: '金色皇冠', need: { stars: 45 }, crown: true },
};

function hat(outfit) {
  const o = OUTFITS[outfit] || OUTFITS.blue;
  if (o.crown) {
    return `<path d="M24 50 L26 26 L38 38 L50 20 L62 38 L74 26 L76 50 Z" fill="#ffd23f" stroke="#e0a21b" stroke-width="3" stroke-linejoin="round"/>
      <circle cx="50" cy="38" r="4.5" fill="#ff6b81"/><circle cx="34" cy="42" r="3.2" fill="#5fb7e8"/><circle cx="66" cy="42" r="3.2" fill="#5cbf6a"/>`;
  }
  const defs = o.extra === 'rainbow' ? '<defs><linearGradient id="rainbow" x1="0" x2="1"><stop offset="0" stop-color="#ff6b6b"/><stop offset=".25" stop-color="#ffb52e"/><stop offset=".5" stop-color="#ffe066"/><stop offset=".75" stop-color="#5cbf6a"/><stop offset="1" stop-color="#5b8def"/></linearGradient></defs>' : '';
  const extra = o.extra === 'leaf' ? '<path d="M50 28 q10 -16 24 -12 q-6 14 -24 12z" fill="#7dd87f" stroke="#3e9a4c" stroke-width="2"/>'
    : o.extra === 'flower' ? '<g transform="translate(66 30)"><circle cy="-7" r="6" fill="#fff"/><circle cx="7" r="6" fill="#fff"/><circle cy="7" r="6" fill="#fff"/><circle cx="-7" r="6" fill="#fff"/><circle r="5" fill="#ffc533"/></g>'
      : '<path d="M50 10 l3.4 6.9 7.6 1.1 -5.5 5.4 1.3 7.6 -6.8 -3.6 -6.8 3.6 1.3 -7.6 -5.5 -5.4 7.6 -1.1z" fill="#ffd23f" stroke="#e0a21b" stroke-width="2" stroke-linejoin="round"/><path d="M50 30 v-4" stroke="#e0a21b" stroke-width="3" stroke-linecap="round"/>';
  return `${defs}${o.extra === 'leaf' || o.extra === 'flower' ? '' : extra}
    <path d="M22 50 Q24 26 50 26 Q76 26 78 50 Z" fill="${o.cap}"/>
    <rect x="17" y="46" width="66" height="9" rx="4.5" fill="${o.brim}"/>
    <circle cx="50" cy="38" r="5" fill="#fff" opacity=".9"/>${o.extra === 'leaf' || o.extra === 'flower' ? extra : ''}`;
}

export function hero(outfit = 'blue') {
  return `${shadow(25)}
  <g class="hero-body">
    <circle cx="50" cy="58" r="30" fill="#ffd96a" stroke="#e9ac2a" stroke-width="3"/>
    ${hat(outfit)}
    ${face(50, 64, 'idle', { gap: 11, mouthY: 8 })}
    <path d="M24 72 Q20 84 30 86" stroke="#c27a43" stroke-width="4" fill="none" stroke-linecap="round"/>
    <rect x="15" y="74" width="20" height="15" rx="4" fill="#d98b4f" stroke="#a9622f" stroke-width="2"/>
    <rect x="15" y="74" width="20" height="6" rx="3" fill="#c27a43"/>
  </g>`;
}

// ---------- 朋友们 ----------
const friendArt = {
  hedgehog(mood) {
    return `${shadow(30)}
    <path d="M18 74 L14 60 L22 58 L18 44 L28 46 L28 32 L38 38 L42 24 L50 34 L58 24 L62 38 L72 32 L72 46 L82 44 L78 58 L86 60 L82 74 Z" fill="#9a6b47" stroke="#7a5236" stroke-width="2.5" stroke-linejoin="round"/>
    <ellipse cx="50" cy="66" rx="27" ry="23" fill="#f3d8b5" stroke="#d6b48c" stroke-width="2.5"/>
    <ellipse cx="50" cy="73" rx="4" ry="3" fill="${INK}"/>
    ${face(50, 62, mood, { gap: 11, mouthY: 15 })}`;
  },
  rabbit(mood) {
    const ear = mood === 'happy' ? '' : 'transform="rotate(-8 38 34)"';
    return `${shadow(26)}
    <g ${ear}><ellipse cx="38" cy="22" rx="8" ry="22" fill="#fff" stroke="#d9d2cc" stroke-width="2.5"/><ellipse cx="38" cy="24" rx="3.6" ry="14" fill="#ffc2cb"/></g>
    <g ${mood === 'happy' ? '' : 'transform="rotate(14 62 34)"'}><ellipse cx="62" cy="22" rx="8" ry="22" fill="#fff" stroke="#d9d2cc" stroke-width="2.5"/><ellipse cx="62" cy="24" rx="3.6" ry="14" fill="#ffc2cb"/></g>
    <ellipse cx="50" cy="64" rx="28" ry="26" fill="#fff" stroke="#d9d2cc" stroke-width="2.5"/>
    <ellipse cx="50" cy="72" rx="3.5" ry="2.6" fill="#f08a9b"/>
    ${face(50, 62, mood, { gap: 12, mouthY: 14 })}`;
  },
  bear(mood) {
    return `${shadow(30)}
    <circle cx="26" cy="36" r="11" fill="#b07a4f" stroke="#8a5c38" stroke-width="2.5"/><circle cx="26" cy="36" r="5" fill="#e3b58a"/>
    <circle cx="74" cy="36" r="11" fill="#b07a4f" stroke="#8a5c38" stroke-width="2.5"/><circle cx="74" cy="36" r="5" fill="#e3b58a"/>
    <circle cx="50" cy="60" r="31" fill="#b07a4f" stroke="#8a5c38" stroke-width="2.5"/>
    <ellipse cx="50" cy="72" rx="15" ry="11" fill="#f0cfa6"/>
    <ellipse cx="50" cy="67" rx="5" ry="3.6" fill="${INK}"/>
    ${face(50, 55, mood, { gap: 13, mouthY: 19 })}`;
  },
  cat(mood) {
    return `${shadow(28)}
    <path d="M22 50 L24 20 L44 36 Z" fill="#f2a65a" stroke="#d07f35" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M78 50 L76 20 L56 36 Z" fill="#f2a65a" stroke="#d07f35" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M28 40 L28 28 L38 36 Z M72 40 L72 28 L62 36 Z" fill="#ffc9b0"/>
    <ellipse cx="50" cy="62" rx="31" ry="27" fill="#f2a65a" stroke="#d07f35" stroke-width="2.5"/>
    <path d="M42 38 q8 6 16 0 M38 44 q12 8 24 0" stroke="#d07f35" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M47 70 l3 3 3 -3z" fill="#e0667a"/>
    <path d="M24 70 h14 M24 76 l14 -3 M76 70 h-14 M76 76 l-14 -3" stroke="${INK}" stroke-width="1.8" stroke-linecap="round" opacity=".55"/>
    ${face(50, 62, mood, { gap: 12, mouthY: 14 })}`;
  },
  penguin(mood) {
    return `${shadow(26)}
    <ellipse cx="50" cy="58" rx="28" ry="32" fill="#3c4a63" stroke="#2a3549" stroke-width="2.5"/>
    <ellipse cx="50" cy="66" rx="19" ry="23" fill="#fff"/>
    <ellipse cx="50" cy="48" rx="20" ry="15" fill="#fff"/>
    <path d="M44 60 L56 60 L50 67 Z" fill="#ffa63d" stroke="#e08419" stroke-width="2" stroke-linejoin="round"/>
    <ellipse cx="38" cy="90" rx="8" ry="4" fill="#ffa63d"/><ellipse cx="62" cy="90" rx="8" ry="4" fill="#ffa63d"/>
    ${face(50, 50, mood, { gap: 10, mouthY: 20 })}`;
  },
  owl(mood) {
    return `${shadow(27)}
    <path d="M24 34 L22 14 L40 28 Z M76 34 L78 14 L60 28 Z" fill="#8d6fb8" stroke="#6a4f96" stroke-width="2.5" stroke-linejoin="round"/>
    <ellipse cx="50" cy="58" rx="30" ry="32" fill="#a388cf" stroke="#6a4f96" stroke-width="2.5"/>
    <ellipse cx="50" cy="70" rx="18" ry="17" fill="#efe6fb"/>
    <path d="M40 66 q3 4 6 0 M54 66 q3 4 6 0 M47 74 q3 4 6 0" stroke="#b9a3dd" stroke-width="2.4" fill="none" stroke-linecap="round"/>
    <circle cx="37" cy="48" r="12" fill="#fff" stroke="#6a4f96" stroke-width="2"/><circle cx="63" cy="48" r="12" fill="#fff" stroke="#6a4f96" stroke-width="2"/>
    ${mood === 'happy'
    ? `<path d="M31 49 q6 -7 12 0 M57 49 q6 -7 12 0" stroke="${INK}" stroke-width="3.2" fill="none" stroke-linecap="round"/>`
    : `<circle cx="37" cy="48" r="5.4" fill="${INK}"/><circle cx="63" cy="48" r="5.4" fill="${INK}"/><circle cx="38.8" cy="46" r="1.8" fill="#fff"/><circle cx="64.8" cy="46" r="1.8" fill="#fff"/>`}
    <path d="M45 57 L55 57 L50 65 Z" fill="#ffb347" stroke="#e08419" stroke-width="2" stroke-linejoin="round"/>
    <ellipse cx="27" cy="58" rx="4.5" ry="3" fill="#ff9f8f" opacity=".6"/><ellipse cx="73" cy="58" rx="4.5" ry="3" fill="#ff9f8f" opacity=".6"/>
    <path d="M38 90 h8 M54 90 h8" stroke="#ffa63d" stroke-width="5" stroke-linecap="round"/>`;
  },
};
export const friend = (kind, mood = 'idle') => friendArt[kind](mood);

// ---------- 物品 ----------
const itemArt = {
  apple: `<path d="M50 34 q-4 -10 -2 -16" stroke="#7a4a2a" stroke-width="4" fill="none" stroke-linecap="round"/>
    <path d="M52 26 q12 -10 20 -2 q-10 8 -20 2z" fill="#69b84a"/>
    <path d="M50 36 C30 24 14 44 22 66 C28 82 42 86 50 80 C58 86 72 82 78 66 C86 44 70 24 50 36Z" fill="#ef5a4c" stroke="#c23d33" stroke-width="2.5"/>
    <ellipse cx="34" cy="50" rx="5" ry="9" fill="#fff" opacity=".45" transform="rotate(20 34 50)"/>`,
  carrot: `<path d="M50 30 q-14 -14 -8 -20 q6 6 8 14 q2 -10 10 -14 q4 8 -10 20z" fill="#5cb85c"/>
    <path d="M34 34 Q50 26 66 34 L52 86 Q50 90 48 86 Z" fill="#ff8a3d" stroke="#d96a1f" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M40 46 h8 M44 58 h8 M46 70 h6" stroke="#d96a1f" stroke-width="2.5" stroke-linecap="round"/>`,
  honey: `<rect x="28" y="36" width="44" height="46" rx="12" fill="#ffc533" stroke="#d99a12" stroke-width="2.5"/>
    <rect x="30" y="26" width="40" height="12" rx="4" fill="#c98a4b" stroke="#9e6630" stroke-width="2.5"/>
    <path d="M30 44 q8 8 14 0 q6 10 12 0 q6 8 14 0" fill="#e9a516"/>
    <rect x="36" y="54" width="28" height="16" rx="5" fill="#fff6dc"/>
    <path d="M44 62 h12" stroke="#d99a12" stroke-width="3" stroke-linecap="round"/>`,
  fish: `<path d="M22 56 C34 34 62 34 72 56 C62 76 34 76 22 56Z" fill="#5fb7e8" stroke="#3a8fc4" stroke-width="2.5"/>
    <path d="M70 56 L88 42 L86 70 Z" fill="#5fb7e8" stroke="#3a8fc4" stroke-width="2.5" stroke-linejoin="round"/>
    <circle cx="36" cy="52" r="4" fill="${INK}"/><circle cx="37.3" cy="50.6" r="1.4" fill="#fff"/>
    <path d="M48 46 q6 10 0 20 M56 46 q6 10 0 20" stroke="#3a8fc4" stroke-width="2.2" fill="none" opacity=".6"/>`,
  scarf: `<path d="M24 38 Q50 50 76 38 L78 52 Q50 64 22 52 Z" fill="#e8505b" stroke="#bf3a44" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M58 54 L64 86 L50 86 L48 56 Z" fill="#e8505b" stroke="#bf3a44" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M32 42 l-2 12 M44 46 l-1 12 M56 46 l1 12 M68 42 l2 12" stroke="#fff" stroke-width="3" opacity=".7"/>
    <path d="M51 86 v6 M56 86 v6 M61 86 v6" stroke="#bf3a44" stroke-width="2.5" stroke-linecap="round"/>`,
  lantern: `<path d="M38 22 Q50 8 62 22" stroke="#8a5a3a" stroke-width="4" fill="none" stroke-linecap="round"/>
    <rect x="36" y="20" width="28" height="9" rx="3" fill="#c9503f" stroke="#9c3528" stroke-width="2.5"/>
    <circle cx="50" cy="54" r="30" fill="#ffe9a8" opacity=".5"/>
    <rect x="28" y="29" width="44" height="48" rx="20" fill="#ff8a4c" stroke="#d45f24" stroke-width="2.5"/>
    <ellipse cx="50" cy="53" rx="12" ry="19" fill="#ffe27a"/>
    <path d="M39 31 q-7 22 0 44 M61 31 q7 22 0 44" stroke="#d45f24" stroke-width="2.2" fill="none" opacity=".7"/>
    <rect x="36" y="76" width="28" height="8" rx="3" fill="#c9503f" stroke="#9c3528" stroke-width="2.5"/>
    <path d="M50 84 v8 M45 92 h10" stroke="#e8b23a" stroke-width="3" stroke-linecap="round"/>`,
  keyY: keyArt('#ffc933', '#d39b0d', 'circle'),
  keyB: keyArt('#62a4f0', '#3a7bc8', 'diamond'),
};
function keyArt(fill, stroke, mark) {
  const emblem = mark === 'circle' ? '<circle cx="34" cy="50" r="5" fill="#fff"/>' : '<path d="M34 43 l7 7 -7 7 -7 -7z" fill="#fff"/>';
  return `<circle cx="34" cy="50" r="16" fill="${fill}" stroke="${stroke}" stroke-width="3"/>${emblem}
    <rect x="48" y="45" width="34" height="10" rx="4" fill="${fill}" stroke="${stroke}" stroke-width="3"/>
    <rect x="66" y="53" width="7" height="12" rx="2" fill="${fill}" stroke="${stroke}" stroke-width="3"/>
    <rect x="76" y="53" width="6" height="9" rx="2" fill="${fill}" stroke="${stroke}" stroke-width="3"/>`;
}
export const item = (type) => itemArt[type];

// 隐藏宝石（每关一颗，可选收集）
export const star = () => `<ellipse cx="50" cy="86" rx="20" ry="5" fill="#2d4a1e" opacity=".14"/>
  <path d="M30 34 L42 22 H58 L70 34 L50 76 Z" fill="#7fd3f7" stroke="#3a9fd4" stroke-width="3.5" stroke-linejoin="round"/>
  <path d="M30 34 H70 M42 22 L46 34 L50 76 M58 22 L54 34 L50 76" fill="none" stroke="#3a9fd4" stroke-width="2.5" stroke-linejoin="round"/>
  <path d="M36 32 l6 -6" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".85"/>`;
export const gemIcon = () => `<svg viewBox="22 16 56 66" aria-hidden="true">${star()}</svg>`;

// 宝箱（里面是一件道具，可选收集）
export const chest = () => `<ellipse cx="50" cy="88" rx="26" ry="5" fill="#2d4a1e" opacity=".16"/>
  <rect x="20" y="46" width="60" height="38" rx="6" fill="#c9793a" stroke="#8a4d1e" stroke-width="3"/>
  <path d="M20 50 Q20 26 50 26 Q80 26 80 50 Z" fill="#e0934d" stroke="#8a4d1e" stroke-width="3" stroke-linejoin="round"/>
  <path d="M33 28 V84 M67 28 V84" stroke="#ffd23f" stroke-width="6"/>
  <rect x="20" y="46" width="60" height="7" fill="#8a4d1e" opacity=".55"/>
  <rect x="42" y="42" width="16" height="18" rx="4" fill="#ffd23f" stroke="#c9940f" stroke-width="2.5"/>
  <circle cx="50" cy="50" r="3" fill="#8a4d1e"/>
  <path d="M30 36 q8 -6 14 -5" stroke="#fff" stroke-width="3.5" fill="none" stroke-linecap="round" opacity=".6"/>`;
export const chestIcon = () => `<svg viewBox="12 18 76 76" aria-hidden="true">${chest()}</svg>`;

// 传送门（成对出现）
export const portal = () => `<ellipse cx="50" cy="60" rx="40" ry="26" fill="#6f55c9" opacity=".28"/>
  <g class="portal-spin"><ellipse cx="50" cy="58" rx="36" ry="22" fill="#3b2a7a" stroke="#b79cff" stroke-width="4"/>
  <ellipse cx="50" cy="58" rx="26" ry="15" fill="none" stroke="#8fd3ff" stroke-width="3.5" stroke-dasharray="20 12" class="portal-ring"/>
  <ellipse cx="50" cy="58" rx="15" ry="8.5" fill="#7fe0ff" opacity=".85"/><ellipse cx="50" cy="58" rx="7" ry="4" fill="#fff"/></g>
  <g fill="#fff6b8" class="portal-stars"><path d="M22 34 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z"/><path d="M78 30 l1.6 4 4 1.6 -4 1.6 -1.6 4 -1.6 -4 -4 -1.6 4 -1.6z"/><path d="M60 16 l1.3 3.2 3.2 1.3 -3.2 1.3 -1.3 3.2 -1.3 -3.2 -3.2 -1.3 3.2 -1.3z"/></g>`;

// ---------- 道具 ----------
const toolArt = {
  firefly: `<circle cx="50" cy="60" r="34" fill="#fff3a6" opacity=".55"/><circle cx="50" cy="60" r="22" fill="#ffe45c" opacity=".7"/>
    <ellipse cx="33" cy="38" rx="17" ry="10" fill="#eaf6ff" stroke="#9cc3ef" stroke-width="2.5" transform="rotate(-28 33 38)" opacity=".92"/>
    <ellipse cx="67" cy="38" rx="17" ry="10" fill="#eaf6ff" stroke="#9cc3ef" stroke-width="2.5" transform="rotate(28 67 38)" opacity=".92"/>
    <ellipse cx="50" cy="56" rx="13" ry="20" fill="#5a4a3f" stroke="${INK}" stroke-width="2.5"/>
    <path d="M38 62 Q50 70 62 62 Q62 78 50 78 Q38 78 38 62Z" fill="#ffe45c" stroke="#e0a21b" stroke-width="2.5"/>
    <circle cx="45" cy="46" r="3" fill="#fff"/><circle cx="55" cy="46" r="3" fill="#fff"/>
    <path d="M45 36 q-4 -10 -10 -10 M55 36 q4 -10 10 -10" stroke="${INK}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`,
  magnet: `<path d="M22 28 H42 V54 a8 8 0 0 0 16 0 V28 H78 V54 a28 28 0 0 1 -56 0 Z" fill="#ef5a4c" stroke="#b93a30" stroke-width="3" stroke-linejoin="round"/>
    <rect x="22" y="28" width="20" height="15" fill="#f4f1ec" stroke="#b93a30" stroke-width="3"/><rect x="58" y="28" width="20" height="15" fill="#f4f1ec" stroke="#b93a30" stroke-width="3"/>
    <path d="M30 58 q2 12 12 16" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round" opacity=".5"/>
    <path d="M26 16 l3 6 M38 12 v8 M62 12 v8 M74 16 l-3 6" stroke="#ffc21a" stroke-width="4" stroke-linecap="round"/>`,
  shoes: `<path d="M20 44 h20 l6 14 q20 2 30 12 q4 4 4 10 H20 Z" fill="#5b8def" stroke="#3f6fd1" stroke-width="3" stroke-linejoin="round"/>
    <rect x="16" y="76" width="68" height="9" rx="4.5" fill="#fff" stroke="#3f6fd1" stroke-width="3"/>
    <path d="M44 60 l6 -5 M52 63 l6 -5 M60 67 l5 -5" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/>
    <path d="M22 50 Q4 44 6 30 Q16 36 24 40 M22 58 Q2 58 2 46 Q12 50 22 52" fill="#fff" stroke="#9cc3ef" stroke-width="2.5" stroke-linejoin="round"/>
    <text x="72" y="40" font-size="24" font-weight="900" fill="#ffb52e" stroke="#e38b00" stroke-width="1" text-anchor="middle">+5</text>`,
};
export const tool = (id) => toolArt[id];
export const toolIcon = (id) => `<svg viewBox="2 6 96 88" aria-hidden="true">${toolArt[id]}</svg>`;

// ---------- 地形 ----------
export function tree(theme) {
  const snow = theme === 'snow' || theme === true;
  if (theme === 'night') {
    return `${shadow(26)}<rect x="44" y="62" width="12" height="24" rx="4" fill="#6b4a3a"/>
      <circle cx="50" cy="44" r="30" fill="#2f6f73"/><circle cx="36" cy="52" r="18" fill="#28626a"/><circle cx="64" cy="52" r="18" fill="#28626a"/>
      <circle cx="42" cy="32" r="10" fill="#4a9a94" opacity=".8"/>
      <circle cx="62" cy="38" r="3.5" fill="#fff3a6" class="twinkle"/><circle cx="36" cy="54" r="3" fill="#fff3a6" class="twinkle t2"/><circle cx="56" cy="60" r="2.6" fill="#fff3a6" class="twinkle t3"/>`;
  }
  if (snow) {
    return `${shadow(22)}<rect x="45" y="70" width="10" height="16" rx="3" fill="#8a5a3a"/>
      <path d="M50 10 L80 74 H20 Z" fill="#3f8f6b"/><path d="M50 10 L64 40 Q50 46 36 40 Z" fill="#fff"/>
      <path d="M30 60 Q50 66 70 60 L76 72 H24 Z" fill="#e9f4fb" opacity=".85"/>`;
  }
  return `${shadow(26)}<rect x="44" y="62" width="12" height="24" rx="4" fill="#9a6440"/>
    <circle cx="50" cy="44" r="30" fill="#4caf63"/><circle cx="36" cy="52" r="18" fill="#43a05a"/><circle cx="64" cy="52" r="18" fill="#43a05a"/>
    <circle cx="42" cy="32" r="10" fill="#6fcb7d" opacity=".9"/>
    <circle cx="62" cy="40" r="4" fill="#ff7d6b"/><circle cx="38" cy="54" r="4" fill="#ff7d6b"/>`;
}
export const rock = () => `${shadow(26)}<path d="M20 80 Q16 56 32 46 Q40 30 58 34 Q78 38 82 60 Q86 80 70 82 Z" fill="#a9b2bd" stroke="#808b98" stroke-width="2.5"/>
  <path d="M36 50 Q44 40 56 42" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round" opacity=".6"/>`;

export function fence(n) {
  // n: {up, down, left, right} 相邻是否也是栅栏/门
  const rails = [];
  if (n.left) rails.push('<rect x="0" y="44" width="50" height="8" rx="3"/><rect x="0" y="64" width="50" height="8" rx="3"/>');
  if (n.right) rails.push('<rect x="50" y="44" width="50" height="8" rx="3"/><rect x="50" y="64" width="50" height="8" rx="3"/>');
  if (n.up) rails.push('<rect x="40" y="0" width="8" height="58" rx="3"/><rect x="54" y="0" width="8" height="58" rx="3"/>');
  if (n.down) rails.push('<rect x="40" y="50" width="8" height="50" rx="3"/><rect x="54" y="50" width="8" height="50" rx="3"/>');
  return `<g fill="#d9a066" stroke="#a8713f" stroke-width="2">${rails.join('')}</g>
    <rect x="40" y="30" width="22" height="52" rx="6" fill="#e3ad73" stroke="#a8713f" stroke-width="2.5"/>
    <path d="M40 36 L51 26 L62 36" fill="#e3ad73" stroke="#a8713f" stroke-width="2.5" stroke-linejoin="round"/>`;
}

export function door(color) {
  const c = color === 'Y' ? { fill: '#ffcf4a', stroke: '#c9940f' } : { fill: '#6aa9f2', stroke: '#3a7bc8' };
  const emblem = color === 'Y' ? '<circle cx="50" cy="56" r="7" fill="#fff"/>' : '<path d="M50 47 l9 9 -9 9 -9 -9z" fill="#fff"/>';
  return `<rect x="10" y="22" width="80" height="66" rx="10" fill="${c.fill}" stroke="${c.stroke}" stroke-width="3"/>
    <path d="M24 26 v58 M38 26 v58 M62 26 v58 M76 26 v58" stroke="${c.stroke}" stroke-width="2.5" opacity=".45"/>
    <circle cx="50" cy="56" r="16" fill="${c.stroke}"/>${emblem}`;
}

export const box = () => `${shadow(30)}<rect x="16" y="20" width="68" height="66" rx="8" fill="#d9a066" stroke="#9e6a3a" stroke-width="3"/>
  <path d="M22 26 L78 80 M78 26 L22 80" stroke="#b47c47" stroke-width="6" stroke-linecap="round"/>
  <rect x="16" y="20" width="68" height="66" rx="8" fill="none" stroke="#9e6a3a" stroke-width="3"/>`;

export function flower(seed) {
  const colors = ['#ff9fb5', '#ffd166', '#ffffff', '#b8a4ff'];
  const c = colors[seed % colors.length];
  return `<g opacity=".95"><circle cx="0" cy="-5" r="4" fill="${c}"/><circle cx="5" cy="0" r="4" fill="${c}"/><circle cx="0" cy="5" r="4" fill="${c}"/><circle cx="-5" cy="0" r="4" fill="${c}"/><circle r="3" fill="#ffb627"/></g>`;
}

export const heart = () => '<path d="M0 6 C-14 -4 -8 -16 0 -9 C8 -16 14 -4 0 6Z" fill="#ff6b81" stroke="#e04a63" stroke-width="1.5"/>';

export const pointer = () => `<g class="pointer-hand">
  <path d="M30 4 c0 -6 10 -6 10 0 v26 c0 -6 10 -6 10 0 v4 c0 -6 10 -6 10 0 v4 c0 -6 10 -6 10 0 v20 c0 14 -10 24 -24 24 h-4 c-10 0 -16 -6 -20 -14 l-12 -22 c-3 -6 5 -10 9 -5 l11 12 z" fill="#fff" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/>
</g>`;

// 小图标（界面用）。
export function icon(name) {
  const paths = {
    home: '<path d="M4 11 L12 4 L20 11 V20 H14 V14 H10 V20 H4 Z"/>',
    undo: '<path d="M9 7 L4 12 L9 17" fill="none"/><path d="M5 12 H14 a6 6 0 0 1 0 12" fill="none" transform="translate(0 -6)"/>',
    restart: '<path d="M19 12 a7 7 0 1 1 -2.1 -5" fill="none"/><path d="M19 4 V8 H15" fill="none"/>',
    hint: '<path d="M9 18 h6 M10 21 h4 M12 3 a6 6 0 0 1 3.5 10.9 c-.9.7 -1.5 1.7 -1.5 2.8 V17 h-4 v-.3 c0 -1.1 -.6 -2.1 -1.5 -2.8 A6 6 0 0 1 12 3z" fill="none"/>',
    pause: '<path d="M8 5 V19 M16 5 V19"/>',
    settings: '<circle cx="12" cy="12" r="3.2" fill="none"/><path d="M12 2.5 v3 M12 18.5 v3 M2.5 12 h3 M18.5 12 h3 M5.3 5.3 l2.1 2.1 M16.6 16.6 l2.1 2.1 M5.3 18.7 l2.1 -2.1 M16.6 7.4 l2.1 -2.1"/>',
    sound: '<path d="M4 9 H8 L13 5 V19 L8 15 H4 Z"/><path d="M16 9 a4 4 0 0 1 0 6 M18.5 6.5 a8 8 0 0 1 0 11" fill="none"/>',
    book: '<path d="M4 5 a2 2 0 0 1 2 -2 H11 V20 H6 a2 2 0 0 0 -2 2 Z M20 5 a2 2 0 0 0 -2 -2 H13 V20 H18 a2 2 0 0 1 2 2 Z" fill="none"/>',
    leaf: '<path d="M5 19 C5 9 11 4 20 4 C20 13 15 19 5 19Z M5 19 L13 11" fill="none"/>',
    play: '<path d="M8 5 L19 12 L8 19 Z"/>',
    close: '<path d="M6 6 L18 18 M18 6 L6 18"/>',
    plug: '<path d="M9 3 V8 M15 3 V8 M6 8 H18 V12 a6 6 0 0 1 -12 0 Z M12 18 V22" fill="none"/>',
    speak: '<path d="M4 9 H8 L13 5 V19 L8 15 H4 Z"/><path d="M16 9 a4 4 0 0 1 0 6" fill="none"/>',
    check: '<path d="M5 12.5 L10 17 L19 7" fill="none"/>',
    lock: '<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10 V7 a4 4 0 0 1 8 0 V10" fill="none"/>',
    heart: '<path d="M12 20 C4 14 3 9 6 6.5 C8.5 4.5 11 5.5 12 7.5 C13 5.5 15.5 4.5 18 6.5 C21 9 20 14 12 20Z"/>',
    star: '<path d="M12 3 l2.7 5.6 6.1 .9 -4.4 4.3 1 6.1 -5.4 -2.9 -5.4 2.9 1 -6.1 -4.4 -4.3 6.1 -.9z"/>',
    next: '<path d="M5 12 H19 M13 6 L19 12 L13 18" fill="none"/>',
    gem: '<path d="M6 9 L10 4 H14 L18 9 L12 20 Z"/>',
    steps: '<ellipse cx="8" cy="9" rx="3" ry="4.5"/><ellipse cx="16" cy="15" rx="3" ry="4.5"/>',
    grid: '<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>',
    shirt: '<path d="M8 4 L4 7 L6 11 L8 10 V20 H16 V10 L18 11 L20 7 L16 4 Q12 7 8 4Z"/>',
    target: '<circle cx="12" cy="12" r="8" fill="none"/><circle cx="12" cy="12" r="3"/>',
    bag: '<path d="M5 9 H19 L18 20 H6 Z"/><path d="M9 9 V7 a3 3 0 0 1 6 0 V9" fill="none"/>',
    gift: '<rect x="4" y="10" width="16" height="10" rx="1.5"/><rect x="3" y="7" width="18" height="4" rx="1.5"/><path d="M12 7 V20 M12 7 C9 2 5 5 12 7 C19 5 15 2 12 7" fill="none" stroke="#fff"/>',
    calendar: '<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M8 3 V7 M16 3 V7" fill="none"/><path d="M4 10 H20" stroke="#fff" fill="none"/>',
    medal: '<circle cx="12" cy="14" r="6"/><path d="M8 3 L10.5 8.5 M16 3 L13.5 8.5" fill="none"/>',
    music: '<path d="M9 18 V6 L19 4 V16" fill="none"/><circle cx="7" cy="18" r="2.6"/><circle cx="17" cy="16" r="2.6"/>',
    flame: '<path d="M12 3 C13 8 18 9 18 14.5 A6 6 0 0 1 6 14.5 C6 11.5 8 10.5 8.5 8 C10 9 11.5 7 12 3Z"/>',
    infinity: '<path d="M7 9 a3 3 0 1 0 0 6 c3 0 7 -6 10 -6 a3 3 0 1 1 0 6 c-3 0 -7 -6 -10 -6z" fill="none"/>',
  };
  return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${paths[name] || ''}</svg>`;
}

// 独立的小头像 SVG（任务栏、图鉴）。
export const avatar = (kind, mood = 'idle') => `<svg viewBox="0 6 100 92" aria-hidden="true">${friend(kind, mood)}</svg>`;
export const itemIcon = (type) => `<svg viewBox="10 10 80 80" aria-hidden="true">${item(type)}</svg>`;
export const heroIcon = (outfit) => `<svg viewBox="5 2 90 92" aria-hidden="true">${hero(outfit)}</svg>`;
