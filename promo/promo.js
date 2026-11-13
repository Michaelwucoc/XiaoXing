// 小星快递宣传片：用游戏本身的规则、求解器和美术在页面里“实拍”。
// 直接打开 /promo/ 可以实时预览；scripts/render-promo.mjs 会逐帧渲染成视频。
import { FRIENDS, ITEMS, TOOLS, STICKERS } from '../src/game/data.js';
import { createState, step, magnetPull } from '../src/game/rules.js';
import { solve } from '../src/game/solver.js';
import { createBoard } from '../src/ui/board.js';
import * as art from '../src/ui/art.js';

const $ = (s) => document.querySelector(s);
const stage = $('#stage');
const scenes = $('#scenes');
const root = document.documentElement;
export const DURATION = 52; // 秒

// 实时预览时按窗口缩放；渲染时窗口正好 1920×1080
const fit = () => { stage.style.transform = `scale(${Math.min(innerWidth / 1920, innerHeight / 1080)})`; };
addEventListener('resize', fit);
fit();

// 音效时间表（渲染脚本读它来合成配乐里的音效）
window.__sfx = [];
const t0 = performance.now();
const sfx = (name) => window.__sfx.push({ t: Math.round(performance.now() - t0) / 1000, name });
const at = (sec, fn) => setTimeout(fn, sec * 1000);
const theme = (id) => { root.dataset.themeScene = id; };
const retrigger = (node, cls) => { node.classList.remove(cls); void node.offsetWidth; node.classList.add(cls); };

function swoosh() { retrigger($('#swoosh'), 'go'); sfx('whoosh'); }
function scene(id, html) {
  const node = document.createElement('section');
  node.className = 'scene';
  node.id = id;
  node.innerHTML = html;
  scenes.append(node);
  return node;
}
let current = null;
function show(node) {
  if (current) { const old = current; old.classList.remove('on'); old.classList.add('off'); setTimeout(() => old.remove(), 500); }
  node.classList.add('on');
  current = node;
}

// 背景漂浮的小光点
{
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  let html = '';
  for (let i = 0; i < 26; i++) {
    const size = 8 + rnd() * 22;
    html += `<i style="left:${rnd() * 1920}px;width:${size}px;height:${size}px;--dx:${(rnd() - 0.5) * 260}px;animation-duration:${9 + rnd() * 10}s;animation-delay:${-rnd() * 18}s;opacity:${0.3 + rnd() * 0.5}"></i>`;
  }
  $('#bokeh').innerHTML = html;
}

function confetti(count = 150, spread = 1.2) {
  const colors = ['#ffb52e', '#ff6b81', '#5b8def', '#5cbf6a', '#b8a4ff', '#ffd23f', '#ffffff'];
  const box = $('#confetti');
  for (let i = 0; i < count; i++) {
    const p = document.createElement('i');
    p.style.cssText = `left:${Math.random() * 1920}px;background:${colors[i % colors.length]};--dx:${(Math.random() - 0.5) * 400}px;--rot:${(Math.random() - 0.5) * 1400}deg;animation-duration:${2.2 + Math.random() * 1.8}s;animation-delay:${Math.random() * spread}s;width:${12 + Math.random() * 12}px;height:${18 + Math.random() * 18}px`;
    box.append(p);
    setTimeout(() => p.remove(), 5600);
  }
}

// ---------- 自动演示一张地图（用求解器的答案） ----------
const SFX_BY_EVENT = [['deliver', 'deliver'], ['portal', 'portal'], ['open', 'open'], ['splash', 'splash'], ['pickup', 'pickup'], ['swap', 'pickup'], ['star', 'star']];
function autoplay(host, level, themeId, { delay = 0.6, stepMs = 300, onEvents, outfit = 'blue' } = {}) {
  host.querySelector('svg')?.remove();
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'board');
  host.append(svg);
  const board = createBoard(svg);
  const run = { board, state: createState(level), stopped: false, path: [] };
  board.setLevel(run.state, themeId, outfit);
  const next = () => {
    if (run.stopped || !run.path.length) return;
    const r = step(run.state, run.path.shift());
    run.state = r.state;
    board.update(run.state, r.events, { stepMs: Math.round(stepMs * 0.86) });
    const types = new Set(r.events.map((e) => e.type));
    const hit = SFX_BY_EVENT.find(([type]) => types.has(type));
    sfx(hit ? hit[1] : r.events.some((e) => e.slide) ? 'slide' : 'step');
    onEvents?.(r.events, run.state);
    const slides = r.events.filter((e) => e.type === 'move').length;
    setTimeout(next, stepMs + (types.has('portal') ? 520 : Math.max(0, slides - 1) * 110) + (types.has('deliver') ? 260 : 0));
  };
  run.go = (wait = delay) => { run.path = solve(run.state).path || []; setTimeout(next, wait * 1000); };
  run.stop = () => { run.stopped = true; };
  run.go();
  return run;
}

const spark = (x, y, size = 60, sd = 0, color = '#fff') => `<div class="spark" style="left:${x}px;top:${y}px;width:${size}px;height:${size}px;--sd:${sd}s"><svg viewBox="-12 -12 24 24"><path d="M0 -11 L2.6 -2.6 L11 0 L2.6 2.6 L0 11 L-2.6 2.6 L-11 0 L-2.6 -2.6Z" fill="${color}"/></svg></div>`;
const ICON = (svgBody) => `<svg viewBox="0 0 100 100">${svgBody}</svg>`;
const WATER = '<rect x="4" y="4" width="92" height="92" rx="18" fill="#7cc7ea"/><path d="M18 40 q12 -8 24 0 t24 0 M30 66 q12 -8 24 0 t24 0" stroke="#b8e4f7" stroke-width="5" fill="none" stroke-linecap="round"/>';
const RAFT = `${WATER}<rect x="12" y="18" width="76" height="64" rx="10" fill="#c98f58" stroke="#93622f" stroke-width="3"/><path d="M12 40 H88 M12 62 H88" stroke="#93622f" stroke-width="3"/>`;
const ICE = '<rect x="4" y="4" width="92" height="92" rx="18" fill="#d6f1fb" stroke="#a9d8ee" stroke-width="3"/><path d="M20 70 L40 50 M52 34 L70 16 M60 80 L82 58" stroke="#fff" stroke-width="6" stroke-linecap="round"/>';

// =====================================================================
// 1 开场 0.0 – 5.4
// =====================================================================
function intro() {
  const letters = [...'小星快递'].map((ch, i) => `<span class="drop" style="--d:${0.35 + i * 0.13}s"><i style="--d:${i * 0.18}s">${ch}</i></span>`).join('');
  const peeks = [['hedgehog', 170, -8, 2.5], ['rabbit', 470, 6, 2.68], ['bear', 1240, -5, 2.86], ['cat', 1530, 8, 3.04], ['penguin', 820, 3, 3.22]]
    .map(([kind, x, r, d]) => `<div class="peek peek-up" style="left:${x}px;--r:${r}deg;--d:${d}s">${art.avatar(kind, 'happy')}</div>`).join('');
  const node = scene('s-intro', `
    <div class="hero hero-jump" style="--d:1.05s"><div class="hero-float">${art.heroIcon('blue')}</div></div>
    <div class="logo-row">${letters}</div>
    <div class="tag"><p class="p-sub rise" style="--d:1.9s">把礼物，送到朋友身边</p></div>
    <div class="new pop" style="--d:2.5s"><span class="p-chip">全新玩法上线</span></div>
    ${spark(330, 300, 80, 0)}${spark(1530, 520, 64, 0.6)}${spark(420, 620, 46, 1.1)}${spark(1250, 150, 54, 0.3, '#fff6b8')}${spark(640, 200, 40, 1.4)}
    ${peeks}`);
  show(node);
  [0.35, 0.48, 0.61, 0.74].forEach((t) => at(t + 0.45, () => sfx('thud')));
  at(1.2, () => sfx('jump'));
  at(1.95, () => sfx('chime'));
  [2.5, 2.68, 2.86, 3.04, 3.22].forEach((t) => at(t + 0.1, () => sfx('pop')));
}

// =====================================================================
// 2 玩法 5.4 – 13.6
// =====================================================================
function play() {
  swoosh();
  stage.classList.add('low');
  const node = scene('s-play', `
    <div class="head"><h2 class="p-title drop" style="--d:.25s">规则只有三条</h2></div>
    <div class="p-board rise" style="--d:.2s"><div class="panel"></div></div>
    <div class="steps">
      <div class="step-pill" data-i="0"><span class="n">1</span>${art.heroIcon('blue')}<span>走一走</span></div>
      <div class="step-pill" data-i="1"><span class="n">2</span>${art.itemIcon('apple')}<span>拿起礼物</span></div>
      <div class="step-pill" data-i="2"><span class="n">3</span>${art.avatar('hedgehog', 'happy')}<span>送给朋友</span></div>
    </div>
    <div class="yay"><span class="p-title pink" style="font-size:120px">太棒了！</span></div>`);
  at(0.3, () => show(node));
  const pill = (i, cls) => { node.querySelector(`[data-i="${i}"]`).classList.add(cls); sfx('pop'); };
  at(0.9, () => pill(0, 'show'));
  let picked = false;
  let delivered = false;
  autoplay(node.querySelector('.p-board'), { id: 'p1', map: ['#.....#.', '.P..a...', '..o...H.', '.c...#..', '#..R...#'] }, 'meadow', {
    delay: 1.5, stepMs: 330,
    onEvents(events, state) {
      if (!picked && events.some((e) => e.type === 'pickup')) { picked = true; pill(0, 'done'); pill(1, 'show'); }
      if (!delivered && events.some((e) => e.type === 'deliver')) { delivered = true; pill(1, 'done'); pill(2, 'show'); }
      if (state.won) {
        pill(2, 'done');
        at(0.35, () => { node.querySelector('.yay').classList.add('show'); confetti(110, 0.8); sfx('win'); });
      }
    },
  });
}

// =====================================================================
// 3 机关 13.6 – 27.5
// =====================================================================
const MECHS = [
  { theme: 'meadow', color: '', title: '钥匙开门', sub: '拿到钥匙，打开同色的小门', dur: 3.25, stepMs: 215,
    l: art.itemIcon('keyY'), r: ICON(art.door('Y')),
    map: ['.y.====', 'P..Y.E=', '..h====', '#.....#'] },
  { theme: 'forest', color: 'green', title: '推箱搭桥', sub: '把箱子推进河里，变成小木桥', dur: 2.75, stepMs: 250,
    l: ICON(art.box()), r: ICON(RAFT),
    map: ['.#..~...', 'P.X.~.cR', '...#~.#.', '.#..~...'] },
  { theme: 'snow', color: 'blue', title: '冰面滑行', sub: '一滑到底，碰到东西才停下', dur: 4.0, stepMs: 240,
    l: ICON(ICE), r: ICON(art.rock()),
    map: ['.s___.G', 'P.___fC', '#.___.#', '..___o.'] },
  { theme: 'night', color: 'purple', title: '星星传送门', sub: '走进一个，从另一个出来', dur: 3.6, stepMs: 380, fresh: true,
    l: ICON(art.portal()), r: art.avatar('owl', 'happy'),
    map: ['.O.~..#', 'P..~.lW', '#..~O..', '..#~...'] },
];
function mechanics() {
  swoosh();
  const node = scene('s-mech', `
    <div class="head"><h2 class="p-title drop" style="--d:.2s;font-size:84px">越玩越有趣的机关</h2></div>
    <div class="dots">${MECHS.map(() => '<i></i>').join('')}</div>
    <div class="side-icon l"></div><div class="side-icon r"></div>
    <div class="p-board"><div class="panel"></div></div>
    <div class="newtag"><span class="p-chip">NEW 全新机关</span></div>
    <div class="cap"></div>`);
  at(0.3, () => show(node));
  const host = node.querySelector('.p-board');
  let t = 0.3;
  let run = null;
  MECHS.forEach((m, i) => {
    at(t, () => {
      run?.stop();
      theme(m.theme);
      retrigger(host, 'swap-in');
      run = autoplay(host, { id: `m${i}`, map: m.map }, m.theme, { delay: 0.55, stepMs: m.stepMs });
      node.querySelectorAll('.dots i').forEach((dot, k) => dot.classList.toggle('on', k === i));
      const cap = node.querySelector('.cap');
      cap.innerHTML = `<h3 class="p-title ${m.color}" style="font-size:96px">${m.title}</h3><p class="p-sub" style="font-size:40px">${m.sub}</p>`;
      retrigger(cap, 'swap');
      for (const side of ['l', 'r']) { const el = node.querySelector(`.side-icon.${side}`); el.innerHTML = m[side]; retrigger(el, 'swap'); }
      node.querySelector('.newtag').classList.toggle('show', Boolean(m.fresh));
      if (i) sfx('swap');
      if (m.fresh) at(0.35, () => sfx('chime'));
    });
    if (i < MECHS.length - 1) at(t + m.dur - 0.26, () => { host.classList.remove('swap-in'); retrigger(host, 'swap-out'); });
    t += m.dur;
  });
  return t;
}

// =====================================================================
// 4 道具 27.5 – 35.1
// =====================================================================
function tools() {
  swoosh();
  const tint = { firefly: '#fff3a6', magnet: '#ffd9d4', shoes: '#d6e6ff' };
  const big = [[165, 300], [725, 300], [1285, 300]];
  const small = [[1500, 250], [1500, 522], [1500, 794]];
  const cards = Object.keys(TOOLS).map((id, i) => `
    <div class="tcard tcard-in" data-tool="${id}" style="--x:${big[i][0]}px;--y:${big[i][1]}px;--d:${0.45 + i * 0.16}s;--tint:${tint[id]}">
      <span class="ring"></span><div class="pic">${art.toolIcon(id)}</div><b>${TOOLS[id].name}</b><small>${TOOLS[id].desc}</small></div>`).join('');
  const node = scene('s-tools', `
    <div class="head"><h2 class="p-title purple drop" style="--d:.2s">三件全新道具</h2></div>
    <div class="p-board"><div class="panel"></div></div>
    <div class="stepchip">${art.icon('steps')}<span>步数 <b>18</b> / <b class="lim">20</b></span><span class="plus">+5</span></div>
    ${cards}`);
  at(0.3, () => { show(node); theme('forest'); });
  [0.75, 0.91, 1.07].forEach((t) => at(t, () => sfx('pop')));
  const card = (id) => node.querySelector(`[data-tool="${id}"]`);
  const activate = (id) => { node.querySelectorAll('.tcard').forEach((c) => c.classList.toggle('active', c === card(id))); sfx('tool'); };
  let run = null;
  at(2.9, () => {
    node.querySelectorAll('.tcard').forEach((c, i) => { c.style.setProperty('--x', `${small[i][0]}px`); c.style.setProperty('--y', `${small[i][1]}px`); c.style.setProperty('--s', '.44'); });
    const host = node.querySelector('.p-board');
    host.classList.add('show');
    run = autoplay(host, { id: 't1', map: ['..#....#.', '.P..o..a.', '.#..#....', '....c..#R', '.o.....H.'] }, 'forest', { delay: 999, stepMs: 290 });
    run.path = [];
    sfx('swap');
  });
  const glow = () => {
    let s = run.state;
    const cells = [];
    for (const dir of solve(s).path) { s = step(s, dir).state; cells.push([s.player.x, s.player.y]); }
    run.board.showHint(cells, null, { glow: true });
  };
  at(3.7, () => { activate('firefly'); glow(); });
  at(5.0, () => {
    activate('magnet');
    const pulled = magnetPull(run.state);
    run.state = pulled.state;
    run.board.setLevel(run.state, 'forest', 'blue');
    run.board.flyItem(pulled.item.type, pulled.item);
    at(0.25, () => sfx('pickup'));
    at(0.6, glow);
    run.go(0.9);
  });
  at(6.2, () => {
    activate('shoes');
    node.querySelector('.stepchip').classList.add('show');
    at(0.45, () => { node.querySelector('.plus').classList.add('go'); const lim = node.querySelector('.lim'); lim.textContent = '25'; lim.classList.add('bump'); sfx('chime'); });
  });
  return () => run?.stop();
}

// =====================================================================
// 5 朋友 35.1 – 40.7
// =====================================================================
function friends() {
  swoosh();
  const kinds = Object.keys(FRIENDS);
  const heart = `<svg viewBox="-16 -18 32 28">${art.heart()}</svg>`;
  const cards = kinds.map((kind, i) => `
    <div class="fcard flip" data-kind="${kind}" style="--d:${0.45 + i * 0.12}s">
      <div class="gift">${art.itemIcon(FRIENDS[kind].want)}</div>
      <div class="hearts">${heart}${heart}${heart}</div>
      <div class="ava">${art.avatar(kind, 'idle')}</div><b>${FRIENDS[kind].name}</b></div>`).join('');
  const node = scene('s-friends', `
    <div class="head"><h2 class="p-title pink drop" style="--d:.2s">6 位朋友，都在等礼物</h2></div>
    <div class="row">${cards}</div>
    <div class="stats">
      <div class="stat pop" style="--d:2.9s"><b data-to="4">0</b><span>个世界</span></div>
      <div class="stat pop" style="--d:3.05s"><b data-to="5">0</b><span>种机关</span></div>
      <div class="stat pop" style="--d:3.2s"><b data-inf>∞</b><span>无限关卡</span></div>
    </div>`);
  at(0.3, () => { show(node); theme('meadow'); });
  kinds.forEach((kind, i) => {
    at(0.55 + i * 0.12, () => sfx('pop'));
    at(1.75 + i * 0.2, () => {
      const c = node.querySelector(`[data-kind="${kind}"]`);
      c.querySelector('.ava').innerHTML = art.avatar(kind, 'happy');
      c.classList.add('happy');
      sfx(i === kinds.length - 1 ? 'deliver' : 'pickup');
    });
  });
  node.querySelectorAll('[data-to]').forEach((b, k) => {
    const to = Number(b.dataset.to);
    for (let v = 1; v <= to; v++) at(3.1 + k * 0.15 + v * 0.11, () => { b.textContent = v; sfx('tick'); });
  });
}

// =====================================================================
// 6 更多惊喜 40.7 – 46.3
// =====================================================================
function more() {
  swoosh();
  const hats = Object.keys(art.OUTFITS);
  const stickers = STICKERS.slice(0, 8).map((st) => `<span>${st.icon}</span>`).join('');
  const node = scene('s-more', `
    <div class="head"><h2 class="p-title blue drop" style="--d:.2s">每天都有新惊喜</h2></div>
    <div class="cards">
      <div class="mcard flip" style="--d:.45s"><div class="art" style="background:linear-gradient(#e3edff,#c9dbff)"><div class="cal"><div class="top">每日挑战</div><div class="day"><span>1</span></div></div><div class="streak">${art.icon('flame')}<span>连续 <b class="sn">1</b> 天</span></div></div><b>每日挑战</b><small>每天一张新地图，送道具</small></div>
      <div class="mcard flip" style="--d:.6s"><div class="art" style="background:linear-gradient(#fff6dc,#ffe9b0)"><div class="sgrid">${stickers}</div></div><b>贴纸册</b><small>${STICKERS.length} 张贴纸，慢慢收集</small></div>
      <div class="mcard flip" style="--d:.75s"><div class="art" style="background:linear-gradient(#e6f8e4,#c8efc6)"><div class="hatbox">${hats.map((id, i) => `<div class="h ${i ? '' : 'on'}">${art.heroIcon(id)}</div>`).join('')}</div></div><b>小星的衣橱</b><small>${hats.length} 顶帽子等你解锁</small></div>
    </div>
    <div class="gentle">${['没有倒计时', '不会失败', '随时休息'].map((text, i) => `<div class="gpill pop" style="--d:${2.8 + i * 0.16}s"><i>${art.icon('check')}</i>${text}</div>`).join('')}</div>`);
  at(0.3, () => { show(node); theme('snow'); });
  [0.55, 0.7, 0.85].forEach((t) => at(t, () => sfx('pop')));
  const day = node.querySelector('.day span');
  [2, 3].forEach((d, i) => at(1.5 + i * 0.75, () => { day.textContent = d; retrigger(day, 'tick'); node.querySelector('.sn').textContent = d; sfx('tick'); }));
  node.querySelectorAll('.sgrid span').forEach((s, i) => at(1.3 + i * 0.16, () => { s.classList.add('on'); sfx('tick'); }));
  const hatNodes = [...node.querySelectorAll('.hatbox .h')];
  hatNodes.forEach((h, i) => { if (i) at(1.2 + i * 0.62, () => { hatNodes.forEach((x) => x.classList.toggle('on', x === h)); sfx('pop'); }); });
  [2.9, 3.06, 3.22].forEach((t) => at(t, () => sfx('pop')));
}

// =====================================================================
// 7 结尾 46.3 – 52
// =====================================================================
function ending() {
  swoosh();
  stage.classList.remove('low');
  const pals = [['hedgehog', 200, 170], ['rabbit', 440, 60], ['bear', 150, 520], ['cat', 1290, 60], ['penguin', 1530, 170], ['owl', 1580, 520]]
    .map(([kind, x, y], i) => `<div class="pal pop" style="left:${x}px;top:${y}px;--d:${0.9 + i * 0.11}s;--fd:${-i * 0.5}s">${art.avatar(kind, 'happy')}</div>`).join('');
  const node = scene('s-end', `
    <div class="hero hero-jump" style="--d:.35s"><div class="hero-float">${art.heroIcon('crown')}</div></div>
    <h1 class="logo drop" style="--d:.5s">小星快递</h1>
    ${pals}
    <div class="tag"><p class="p-sub rise" style="--d:1.4s">温柔的解谜小游戏 · 为每一个孩子设计</p></div>
    <div class="cta"><div class="pop" style="--d:1.8s"><span class="cta-btn">${art.icon('play')}现在就出发！</span></div></div>
    ${spark(360, 420, 70, 0)}${spark(1500, 440, 60, 0.7)}${spark(960, 40, 44, 1.2, '#fff6b8')}
    <div class="foot rise" style="--d:2.2s">Building Shanghai</div>`);
  at(0.3, () => { show(node); theme('meadow'); });
  at(0.5, () => sfx('jump'));
  at(1.0, () => { confetti(170, 1.6); sfx('win'); });
  for (let i = 0; i < 6; i++) at(1.0 + i * 0.11, () => sfx('pop'));
  at(1.9, () => sfx('chime'));
}

// ---------- 时间线 ----------
export const CUTS = { intro: 0, play: 5.4, mech: 13.6, tools: 27.5, friends: 35.1, more: 40.7, end: 46.3 };
window.__cuts = CUTS;
window.__duration = DURATION;
function start() {
  window.__started = true;
  let stopTools = null;
  intro();
  at(CUTS.play, play);
  at(CUTS.mech, mechanics);
  at(CUTS.tools, () => { stopTools = tools(); });
  at(CUTS.friends, () => { stopTools?.(); friends(); });
  at(CUTS.more, more);
  at(CUTS.end, ending);
  at(DURATION - 0.7, () => $('#fade').classList.add('on'));
}
// 等圆体字加载好再开始，避免第一帧换字体
(document.fonts?.load ? document.fonts.load('700 100px "Resource Han Rounded CN"', '小星快递').catch(() => {}) : Promise.resolve()).then(start);
window.__ready = true;
