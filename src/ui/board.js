import * as art from './art.js';

const NS = 'http://www.w3.org/2000/svg';
const T = 100;
const PAD = { top: 70, side: 18, bottom: 26 };

const THEME = {
  meadow: { a: '#a5dc85', b: '#9bd47b', lip: '#7fb35f', lip2: '#8a6a45', tuft: '#86c46a' },
  forest: { a: '#93cf7c', b: '#88c672', lip: '#6ea457', lip2: '#7a5a3a', tuft: '#74b25d' },
  snow: { a: '#f3f8fc', b: '#e8f1f8', lip: '#c4d8e6', lip2: '#8fa9bd', tuft: '#d5e5f0' },
  night: { a: '#5f8f8e', b: '#578785', lip: '#3e6a70', lip2: '#2c4a5c', tuft: '#4a7a79', water: '#3b6fb0', wave: '#7fb2e6' },
};

const el = (name, attrs = {}, html = '') => {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (html) node.innerHTML = html;
  return node;
};
const place = (node, x, y) => { node.style.transform = `translate(${x * T}px, ${y * T}px)`; };
const hash = (x, y) => ((x * 73856093) ^ (y * 19349663)) >>> 0;

export function createBoard(svg) {
  let state = null;
  let theme = THEME.meadow;
  let themeId = 'meadow';
  const layers = {};
  const nodes = { items: new Map(), friends: new Map(), boxes: new Map() };
  let hero = null;
  let starNode = null;
  let chestNode = null;
  let hopTimer = null;

  function clear() {
    svg.innerHTML = '';
    for (const name of ['base', 'ground', 'decor', 'hint', 'terrain', 'things', 'actors', 'bubbles', 'fx', 'guide']) {
      layers[name] = el('g', { class: `layer-${name}` });
      svg.appendChild(layers[name]);
    }
    nodes.items.clear(); nodes.friends.clear(); nodes.boxes.clear();
  }

  function drawStatic() {
    const { w, h } = state;
    layers.base.innerHTML = '';
    layers.ground.innerHTML = '';
    layers.decor.innerHTML = '';
    layers.base.append(
      el('rect', { x: -10, y: -6, width: w * T + 20, height: h * T + 30, rx: 34, fill: theme.lip2 }),
      el('rect', { x: -10, y: -10, width: w * T + 20, height: h * T + 22, rx: 34, fill: theme.lip }),
    );
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const t = state.tiles[y * w + x];
        if (t === '~' || t === 'r') {
          layers.ground.append(el('rect', { x: x * T, y: y * T, width: T, height: T, fill: theme.water || '#7cc7ea' }));
          layers.ground.append(el('path', { class: 'wave', d: `M${x * T + 14} ${y * T + 40} q12 -8 24 0 t24 0 M${x * T + 30} ${y * T + 68} q12 -8 24 0 t24 0`, stroke: theme.wave || '#b8e4f7', 'stroke-width': 5, fill: 'none', 'stroke-linecap': 'round' }));
          if (t === 'r') layers.ground.append(el('g', { transform: `translate(${x * T} ${y * T})` }, '<rect x="8" y="14" width="84" height="72" rx="10" fill="#c98f58" stroke="#93622f" stroke-width="3"/><path d="M8 38 H92 M8 62 H92" stroke="#93622f" stroke-width="3"/>'));
          continue;
        }
        const fill = (x + y) % 2 ? theme.a : theme.b;
        layers.ground.append(el('rect', { x: x * T, y: y * T, width: T, height: T, fill }));
        if (t === '_') layers.ground.append(el('g', { transform: `translate(${x * T} ${y * T})` }, '<rect x="2" y="2" width="96" height="96" rx="8" fill="#d6f1fb"/><path d="M20 70 L40 50 M52 34 L70 16 M60 80 L82 58" stroke="#fff" stroke-width="5" stroke-linecap="round"/>'));
        const occupied = t !== '.' || state.items.some((i) => i.x === x && i.y === y) || state.friends.some((f) => f.x === x && f.y === y)
          || (state.player.x === x && state.player.y === y) || (state.star && state.star.x === x && state.star.y === y) || (state.chest && state.chest.x === x && state.chest.y === y);
        const r = hash(x, y);
        if (!occupied && r % 5 === 0) {
          const g = el('g', { transform: `translate(${x * T + 22 + (r % 50)} ${y * T + 24 + ((r >> 4) % 50)})` }, themeId === 'snow' ? '<circle r="5" fill="#fff"/><circle cx="9" cy="3" r="3" fill="#fff"/>'
            : themeId === 'night' ? `<g class="twinkle ${['', 't2', 't3'][r % 3]}"><circle r="9" fill="#fff3a6" opacity=".25"/><circle r="3.4" fill="#fff3a6"/></g>` : art.flower(r >> 3));
          layers.decor.append(g);
        } else if (!occupied && r % 3 === 0) {
          const gx = x * T + 20 + (r % 56);
          const gy = y * T + 30 + ((r >> 5) % 46);
          layers.decor.append(el('path', { d: `M${gx} ${gy} l-4 -10 M${gx + 4} ${gy} l0 -12 M${gx + 8} ${gy} l4 -10`, stroke: theme.tuft, 'stroke-width': 3.2, 'stroke-linecap': 'round' }));
        }
      }
    }
    // 岛屿圆角遮罩：用 clipPath 剪出圆角地面
    const clipId = 'island-clip';
    const defs = el('defs', {}, `<clipPath id="${clipId}"><rect x="0" y="0" width="${w * T}" height="${h * T}" rx="26"/></clipPath>`);
    layers.base.append(defs);
    layers.ground.setAttribute('clip-path', `url(#${clipId})`);
    drawTerrain();
  }

  function drawTerrain() {
    const { w, h } = state;
    layers.terrain.innerHTML = '';
    const isFence = (x, y) => x >= 0 && y >= 0 && x < w && y < h && ['=', 'Y', 'B'].includes(state.tiles[y * w + x]);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const t = state.tiles[y * w + x];
        let html = '';
        if (t === '#') html = art.tree(themeId);
        else if (t === 'O') html = art.portal();
        else if (t === 'o') html = art.rock();
        else if (t === '=') html = art.fence({ left: isFence(x - 1, y), right: isFence(x + 1, y), up: isFence(x, y - 1), down: isFence(x, y + 1) });
        else if (t === 'Y' || t === 'B') html = art.door(t);
        if (html) layers.terrain.append(el('g', { transform: `translate(${x * T} ${y * T})`, class: `tile tile-${t === '#' ? 'tree' : t === 'O' ? 'portal' : t}` }, html));
      }
    }
  }

  function makeActor(layer, html, x, y, cls) {
    const g = el('g', { class: `actor ${cls}` });
    const inner = el('g', { class: 'actor-inner' }, html);
    g.append(inner);
    place(g, x, y);
    layer.append(g);
    return g;
  }

  function bubbleFor(f) {
    const g = el('g', { class: 'bubble' });
    g.innerHTML = `<g class="bubble-in">
      <circle cx="-6" cy="34" r="5" fill="#fff" stroke="#e0d6cc" stroke-width="2"/>
      <rect x="-4" y="-14" width="56" height="44" rx="18" fill="#fff" stroke="#e0d6cc" stroke-width="2.5"/>
      <g transform="translate(5 -12) scale(.4)">${art.item(f.want)}</g></g>`;
    g.style.transform = `translate(${f.x * T + 56}px, ${f.y * T - 34}px)`;
    return g;
  }

  function renderFriend(f, mood) {
    let entry = nodes.friends.get(f.id);
    if (!entry) {
      const node = makeActor(layers.actors, '', f.x, f.y, `friend friend-${f.kind}`);
      const bubble = bubbleFor(f);
      layers.bubbles.append(bubble);
      entry = { node, bubble, mood: null };
      nodes.friends.set(f.id, entry);
    }
    if (entry.mood !== mood) {
      entry.node.querySelector('.actor-inner').innerHTML = art.friend(f.kind, mood);
      entry.mood = mood;
      entry.bubble.classList.toggle('done', mood === 'happy');
    }
  }

  function setLevel(next, themeName = 'meadow', outfit = 'blue') {
    state = next;
    themeId = themeName;
    theme = THEME[themeName] || THEME.meadow;
    clear();
    svg.setAttribute('viewBox', `${-PAD.side} ${-PAD.top} ${state.w * T + PAD.side * 2} ${state.h * T + PAD.top + PAD.bottom}`);
    svg.dataset.theme = themeName;
    drawStatic();
    if (state.star && !state.starTaken) starNode = makeActor(layers.things, art.star(), state.star.x, state.star.y, 'star');
    chestNode = state.chest && !state.chestTaken ? makeActor(layers.things, art.chest(), state.chest.x, state.chest.y, 'chest') : null;
    clearTimeout(hopTimer);
    for (const i of state.items) nodes.items.set(i.id, makeActor(layers.things, art.item(i.type), i.x, i.y, `item item-${i.type}`));
    for (const b of state.boxes) nodes.boxes.set(b.id, makeActor(layers.things, art.box(), b.x, b.y, 'box'));
    for (const f of state.friends) renderFriend(f, f.happy ? 'happy' : 'idle');
    hero = makeActor(layers.actors, `<g class="hero-art">${art.hero(outfit)}</g><g class="carry"></g>`, state.player.x, state.player.y, 'hero');
    syncHero(state, 0);
  }

  function syncHero(s, duration) {
    hero.style.transitionDuration = `${duration}ms`;
    place(hero, s.player.x, s.player.y);
    hero.querySelector('.hero-art').setAttribute('transform', s.facing === 'left' ? 'translate(100 0) scale(-1 1)' : '');
    const carry = hero.querySelector('.carry');
    if (carry.dataset.type !== (s.carry || '')) {
      carry.dataset.type = s.carry || '';
      carry.innerHTML = s.carry ? `<g transform="translate(30 -34) scale(.42)"><g class="carry-pop"><circle cx="50" cy="55" r="46" fill="#fff" opacity=".9" stroke="#ffd27a" stroke-width="5"/>${art.item(s.carry)}</g></g>` : '';
    }
  }

  function retrigger(node, cls) {
    node.classList.remove(cls);
    void node.getBoundingClientRect();
    node.classList.add(cls);
  }

  function fxAt(x, y, html, cls, life = 1200) {
    // 外层负责定位，内层负责动画（CSS 动画的 transform 会盖掉 SVG 的 transform 属性）
    const g = el('g', { transform: `translate(${x * T + 50} ${y * T + 40})` });
    g.append(el('g', { class: `fx ${cls}` }, html));
    layers.fx.append(g);
    setTimeout(() => g.remove(), life);
  }

  function update(next, events = [], { stepMs = 160 } = {}) {
    const prev = state;
    state = next;
    const slides = events.filter((e) => e.type === 'move').length;
    const hop = events.find((e) => e.type === 'portal');
    clearTimeout(hopTimer);
    if (hop) {
      // 先走进传送门，再“嗖”地从另一个门出来
      syncHero({ ...next, player: hop.from }, stepMs);
      fxAt(hop.from.x, hop.from.y + 0.15, '<circle r="34" fill="none" stroke="#b79cff" stroke-width="7"/><circle r="20" fill="none" stroke="#8fd3ff" stroke-width="5"/>', 'ring', 700);
      hero.classList.add('warping');
      hopTimer = setTimeout(() => {
        if (state !== next) return;
        syncHero(next, 0);
        hero.classList.remove('warping');
        retrigger(hero.querySelector('.actor-inner'), 'warp-in');
        fxAt(hop.x, hop.y + 0.15, '<circle r="34" fill="none" stroke="#b79cff" stroke-width="7"/><circle r="20" fill="none" stroke="#8fd3ff" stroke-width="5"/>', 'ring', 700);
      }, stepMs + 90);
    } else {
      hero.classList.remove('warping');
      syncHero(next, Math.max(stepMs, slides * 110));
    }
    if (prev.tiles.join('') !== next.tiles.join('')) drawTerrain();
    // 物品
    const ids = new Set(next.items.map((i) => i.id));
    for (const [id, node] of nodes.items) {
      if (!ids.has(id)) { node.classList.add('picked'); setTimeout(() => node.remove(), 300); nodes.items.delete(id); }
    }
    for (const i of next.items) {
      if (!nodes.items.has(i.id)) {
        const node = makeActor(layers.things, art.item(i.type), i.x, i.y, `item item-${i.type} dropped`);
        nodes.items.set(i.id, node);
      }
    }
    // 箱子
    const boxIds = new Set(next.boxes.map((b) => b.id));
    for (const [id, node] of nodes.boxes) if (!boxIds.has(id)) { node.classList.add('sunk'); setTimeout(() => node.remove(), 400); nodes.boxes.delete(id); }
    for (const b of next.boxes) { const node = nodes.boxes.get(b.id); node.style.transitionDuration = `${stepMs}ms`; place(node, b.x, b.y); }
    // 星星
    if (next.starTaken && starNode) { starNode.classList.add('picked'); const s = starNode; setTimeout(() => s.remove(), 500); starNode = null; }
    if (next.chestTaken && chestNode) { chestNode.classList.add('picked'); const c = chestNode; setTimeout(() => c.remove(), 500); chestNode = null; }
    // 朋友
    for (const f of next.friends) renderFriend(f, f.happy ? 'happy' : 'idle');

    for (const e of events) {
      if (e.type === 'blocked' || e.type === 'locked') retrigger(hero.querySelector('.actor-inner'), `bump-${next.facing}`);
      if (e.type === 'deliver') {
        const node = nodes.friends.get(e.friend).node;
        retrigger(node.querySelector('.actor-inner'), 'hop');
        for (let k = 0; k < 3; k++) fxAt(e.x, e.y, `<g transform="translate(${(k - 1) * 22} ${-10 - k * 6}) scale(1.3)">${art.heart()}</g>`, `float-up d${k}`, 1600);
      }
      if (e.type === 'wrong' || e.type === 'wish' || e.type === 'friend-done') {
        const entry = nodes.friends.get(e.friend);
        retrigger(entry.node.querySelector('.actor-inner'), e.type === 'wrong' ? 'shake' : 'nod');
        retrigger(entry.bubble, 'attention');
      }
      if (e.type === 'open') fxAt(e.x, e.y, '<circle r="30" fill="none" stroke="#fff" stroke-width="8"/>', 'ring', 700);
      if (e.type === 'star') fxAt(e.x, e.y, '<path d="M0 -30 V-14 M0 14 V30 M-30 0 H-14 M14 0 H30 M-20 -20 l8 8 M20 20 l-8 -8 M20 -20 l-8 8 M-20 20 l8 -8" stroke="#ffd23f" stroke-width="6" stroke-linecap="round"/>', 'sparkle', 800);
      if (e.type === 'chest') fxAt(e.x, e.y, '<path d="M0 -32 V-14 M0 14 V32 M-32 0 H-14 M14 0 H32 M-22 -22 l9 9 M22 22 l-9 -9 M22 -22 l-9 9 M-22 22 l9 -9" stroke="#ffb52e" stroke-width="7" stroke-linecap="round"/>', 'sparkle', 800);
      if (e.type === 'pickup' || e.type === 'swap') fxAt(e.x, e.y, '<circle r="24" fill="none" stroke="#fff" stroke-width="6"/>', 'ring', 600);
      if (e.type === 'splash') fxAt(e.x, e.y, '<circle r="20" fill="none" stroke="#e8f7ff" stroke-width="6"/><circle r="34" fill="none" stroke="#e8f7ff" stroke-width="4"/>', 'ring', 800);
    }
  }

  function showHint(cells, target, { glow = false } = {}) {
    layers.hint.innerHTML = '';
    cells.forEach(([x, y], i) => {
      const dot = el('g', { class: glow ? 'foot glowfly' : 'foot', transform: `translate(${x * T + 50} ${y * T + 50})` },
        glow ? '<circle r="20" fill="#fff3a6" opacity=".45"/><circle r="9" fill="#ffe45c" stroke="#fff" stroke-width="3"/>' : '<circle r="11" fill="#fff" opacity=".85"/>');
      dot.style.animationDelay = `${i * (glow ? 55 : 90)}ms`;
      layers.hint.append(dot);
    });
    if (target) layers.hint.append(el('g', { class: 'hint-target', transform: `translate(${target[0] * T + 50} ${target[1] * T + 50})` }, '<circle r="44" fill="none" stroke="#fff" stroke-width="7" stroke-dasharray="14 10"/>'));
  }
  const clearHint = () => { layers.hint.innerHTML = ''; };

  function showPointer(x, y) {
    layers.guide.innerHTML = '';
    if (x == null) return;
    layers.guide.append(el('g', { class: 'guide-ring', transform: `translate(${x * T + 50} ${y * T + 50})` }, '<circle r="46" fill="#fff" opacity=".35"/><circle r="46" fill="none" stroke="#fff" stroke-width="6"/>'));
    layers.guide.append(el('g', { transform: `translate(${x * T + 44} ${y * T + 52}) scale(.7)` }, art.pointer()));
  }

  // 磁铁：礼物从原来的位置飞到小星手里
  function flyItem(type, from) {
    const g = el('g', { class: 'fly-item' }, art.item(type));
    g.style.transform = `translate(${from.x * T}px, ${from.y * T}px)`;
    layers.fx.append(g);
    void g.getBoundingClientRect();
    g.style.transform = `translate(${state.player.x * T + 20}px, ${state.player.y * T - 40}px) scale(.5)`;
    setTimeout(() => g.remove(), 520);
    fxAt(from.x, from.y, '<circle r="26" fill="none" stroke="#ef5a4c" stroke-width="6"/>', 'ring', 600);
  }

  function tapMark(x, y) { fxAt(x, y + 0.1, '<circle r="20" fill="none" stroke="#fff" stroke-width="6"/>', 'ring', 500); }

  function cellAt(clientX, clientY) {
    const point = svg.createSVGPoint();
    point.x = clientX; point.y = clientY;
    const p = point.matrixTransform(svg.getScreenCTM().inverse());
    const x = Math.floor(p.x / T);
    const y = Math.floor(p.y / T);
    return state && x >= 0 && y >= 0 && x < state.w && y < state.h ? { x, y } : null;
  }

  return { setLevel, update, showHint, clearHint, showPointer, tapMark, flyItem, cellAt, get state() { return state; } };
}
