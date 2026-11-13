import { FRIENDS, ITEMS, DOORS, LESSONS, STORY_LEVELS, TOOLS, TOOL_ORDER, STICKERS, THANKS, THEMES, themeFor } from './game/data.js';
import { createState, step, magnetPull } from './game/rules.js';
import { solve, findPath } from './game/solver.js';
import { generateLevel, newFriendAt, nextFriendAfter, dayKey, dailyNumber } from './game/generator.js';
import { createBoard } from './ui/board.js';
import * as art from './ui/art.js';
import { createAudio } from './ui/audio.js';
import { speak } from './ui/speech.js';
import { load, save, defaults, stepRules, rating } from './storage.js';
import { createMicrobit, SENSITIVITY } from './input/microbit.js';

const $ = (s) => document.querySelector(s);
const data = load();
const settings = data.settings;
const progress = data.progress;
const persist = () => save(data);
const audio = createAudio(() => settings);
const board = createBoard($('#board'));
const modal = $('#modal');
const arrow = (rot) => `<svg class="icon" viewBox="0 0 24 24" style="transform:rotate(${rot}deg)" aria-hidden="true"><path d="M12 19 V5 M6 11 L12 5 L18 11" fill="none"/></svg>`;
const starRow = (n, total = 3) => Array.from({ length: total }, (_, i) => `<span class="${i < n ? 'on' : 'off'}">${art.icon('star')}</span>`).join('');

let game = null; // { n, level, state, history, theme, tutorialStep, won, normal, rules }
let walkTimer = null;
let quietMoves = 0;
let modalOnClose = null;

// ---------- 通用 ----------
function applySettings() {
  document.documentElement.dataset.calm = String(settings.calm);
  $('#dpad').hidden = !settings.dpad;
  audio.syncMusic();
}
const friendName = (kind) => FRIENDS[kind].name;
const itemName = (type) => ITEMS[type].name;
const totals = () => ({
  hearts: progress.hearts,
  stars: Object.values(progress.ratings).reduce((a, b) => a + b, 0),
  gems: Object.keys(progress.gems).length,
});
const outfitUnlocked = (id, t = totals()) => {
  const need = art.OUTFITS[id].need;
  return !need || Object.entries(need).every(([k, v]) => t[k] >= v);
};
const NEED_LABEL = { hearts: '♥', stars: '★', gems: '宝石' };

// 道具与贴纸
const toolCount = () => TOOL_ORDER.reduce((sum, id) => sum + (progress.tools[id] || 0), 0);
function grantTool(id = TOOL_ORDER[Math.floor(Math.random() * TOOL_ORDER.length)]) {
  progress.tools[id] = (progress.tools[id] || 0) + 1;
  persist();
  return id;
}
// 返回这次新得到的贴纸
function checkStickers() {
  const fresh = STICKERS.filter((st) => !progress.stickers[st.id] && st.test(progress));
  for (const st of fresh) progress.stickers[st.id] = true;
  if (fresh.length) persist();
  return fresh;
}
const stickerNote = (list) => list.map((st) => `<div class="unlock-note sticker-note"><span class="sticker-badge">${st.icon}</span><span>新贴纸：<b>${st.name}</b></span></div>`).join('');
const dailyDone = () => progress.daily.last === dayKey();

let toastTimer = null;
function toast(text, { voice = true } = {}) {
  const node = $('#toast');
  node.textContent = text;
  node.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove('show'), 2600);
  if (voice) speak(text, settings.speech);
}

function openModal(html, { onClose, dismissable = true } = {}) {
  $('#modal-card').onclick = null;
  $('#modal-card').innerHTML = (dismissable ? `<button class="modal-close" type="button" data-close aria-label="关闭">${art.icon('close')}</button>` : '') + html;
  modalOnClose = onClose || null;
  modal.dataset.dismissable = String(dismissable);
  if (!modal.open) modal.showModal();
  const first = modal.querySelector('[data-primary]') || modal.querySelector('button:not([data-close])');
  first?.focus();
}
const closeModal = () => { if (modal.open) modal.close(); };
// 关闭弹窗后再执行下一步（例如进入下一关）
const closeThen = (fn) => { $('#modal-card').onclick = null; modalOnClose = fn; closeModal(); };
modal.addEventListener('close', () => {
  if (tiltStreaming) { tiltStreaming = false; microbit.streamTilt(false); }
  const cb = modalOnClose;
  modalOnClose = null;
  cb?.();
});
modal.addEventListener('cancel', (event) => { if (modal.dataset.dismissable === 'false') event.preventDefault(); });
modal.addEventListener('click', (event) => { if (event.target.closest('[data-close]')) closeModal(); });

function showScreen(name) {
  for (const id of ['title', 'levels', 'game']) $(`#screen-${id}`).hidden = name !== id;
}

// ---------- 标题画面 ----------
function renderTitle() {
  cancelWalk();
  document.documentElement.dataset.themeScene = 'meadow';
  $('#title-hero').innerHTML = art.heroIcon(settings.outfit);
  const fresh = progress.level <= 1 && !progress.best;
  $('#play-button').innerHTML = `${art.icon('play')}<span>${fresh ? '开始游戏' : `继续 · 第 ${progress.level} 关`}</span>`;
  $('#levels-button').innerHTML = `${art.icon('grid')}<span>选关</span>`;
  $('#wardrobe-button').innerHTML = `${art.icon('shirt')}<span>衣橱</span>`;
  $('#book-button').innerHTML = `${art.icon('book')}<span>朋友图鉴</span>`;
  $('#microbit-button').innerHTML = `${art.icon('plug')}<span>${microbit.ready ? 'micro:bit 已连接' : '连接 micro:bit'}</span>`;
  $('#settings-button').innerHTML = `${art.icon('settings')}<span>设置</span>`;
  $('#daily-button').innerHTML = `${art.icon('calendar')}<span>每日挑战</span>${dailyDone() ? `<i class="pill done">${art.icon('check')}</i>` : '<i class="pill">新</i>'}`;
  $('#stickers-button').innerHTML = `${art.icon('medal')}<span>贴纸册</span><i class="pill soft">${Object.keys(progress.stickers).length}/${STICKERS.length}</i>`;
  $('#gift-button').innerHTML = `${art.icon('gift')}<span>今日礼物</span>`;
  $('#gift-button').hidden = progress.giftDay === dayKey() || !progress.setupDone;
  renderModeToggle();
  showScreen('title');
}
function renderModeToggle() {
  for (const b of document.querySelectorAll('#mode-toggle button')) b.setAttribute('aria-pressed', String(b.dataset.mode === settings.mode));
}
$('#mode-toggle').addEventListener('click', (event) => {
  const b = event.target.closest('[data-mode]');
  if (!b) return;
  settings.mode = b.dataset.mode;
  persist(); renderModeToggle(); audio.play('tap');
});

const play = (n, options) => {
  audio.play('tap');
  audio.syncMusic();
  if (!progress.setupDone) comfortSetup(() => startLevel(n, options));
  else startLevel(n, options);
};
$('#daily-button').addEventListener('click', () => play(dailyNumber(), { daily: true }));
$('#stickers-button').addEventListener('click', () => openStickers());
$('#gift-button').addEventListener('click', () => openGift());
$('#play-button').addEventListener('click', () => play(progress.level));
$('#levels-button').addEventListener('click', () => openLevels());
$('#wardrobe-button').addEventListener('click', () => openWardrobe());
$('#book-button').addEventListener('click', () => openBook());
$('#settings-button').addEventListener('click', () => openSettings());
$('#microbit-button').addEventListener('click', () => openMicrobit());
$('#parent-button').addEventListener('click', () => openParent());

// 第一次玩：选一选让自己舒服的方式
function comfortSetup(done) {
  const choice = (key, value, icon, title, desc) => `<button class="choice" type="button" data-set="${key}" data-value="${value}" aria-pressed="${String(settings[key]) === String(value)}"><span class="big">${icon}</span>${title}<small>${desc}</small></button>`;
  const render = () => openModal(`
    <div class="modal-art">${art.heroIcon(settings.outfit)}</div>
    <h2 id="modal-title">开始之前</h2>
    <p>选一选，让自己玩得舒服。以后也能在“设置”里改。</p>
    <div class="setup-group"><h3>玩法</h3><div class="choice-row">
      ${choice('mode', 'easy', '🌱', '简单', '不限步数，慢慢玩')}${choice('mode', 'normal', '⭐', '普通', '有步数挑战，拿三颗星')}
    </div></div>
    <div class="setup-group"><h3>声音</h3><div class="choice-row">
      ${choice('sound', true, art.icon('sound'), '有声音', '轻轻的提示音')}${choice('sound', false, '🤫', '安静', '没有声音')}
    </div></div>
    <div class="setup-group"><h3>画面</h3><div class="choice-row">
      ${choice('calm', false, '✨', '活泼', '有小动画')}${choice('calm', true, '🍃', '安静', '画面更平静')}
    </div></div>
    <div class="actions"><button class="btn btn-big btn-primary" type="button" data-primary data-go>好了，出发！</button></div>
  `, { dismissable: false });
  const handler = (event) => {
    const c = event.target.closest('[data-set]');
    if (c) {
      const v = c.dataset.value;
      settings[c.dataset.set] = v === 'true' ? true : v === 'false' ? false : v;
      applySettings(); persist(); renderModeToggle();
      if (c.dataset.set === 'sound' && settings.sound) audio.play('pickup');
      render();
      $('#modal-card').onclick = handler;
      modal.querySelector(`[data-set="${c.dataset.set}"][data-value="${v}"]`)?.focus();
    }
    if (event.target.closest('[data-go]')) { progress.setupDone = true; persist(); closeThen(done); }
  };
  render();
  $('#modal-card').onclick = handler;
}

// ---------- 选关 ----------
function openLevels() {
  const t = totals();
  $('#levels-back').innerHTML = art.icon('home');
  $('#levels-totals').innerHTML = `<span class="reward star">${art.icon('star')} ${t.stars}</span><span class="reward gem">${art.gemIcon()} ${t.gems}</span>`;
  const last = Math.max(progress.level + 4, 12);
  let html = '';
  for (let n = 1; n <= last; n++) {
    const open = n <= progress.level;
    const theme = themeFor(n).id;
    const r = progress.ratings[n] || 0;
    const done = n < progress.level || progress.best >= n;
    html += `<button class="level-tile theme-${theme} ${open ? '' : 'locked'} ${n === progress.level ? 'current' : ''}" type="button" data-level="${n}" ${open ? '' : 'aria-disabled="true"'} aria-label="第 ${n} 关${open ? '' : '，还没解锁'}">
      <span class="num">${open ? n : art.icon('lock')}</span>
      <span class="mini-stars">${done ? starRow(r) : ''}</span>
      ${progress.gems[n] ? `<span class="tile-gem">${art.gemIcon()}</span>` : ''}
    </button>`;
  }
  $('#levels-grid').innerHTML = html;
  showScreen('levels');
  $('#levels-grid .current')?.scrollIntoView({ block: 'center' });
  $('#levels-grid .current')?.focus();
}
$('#levels-back').addEventListener('click', () => renderTitle());
$('#levels-grid').addEventListener('click', (event) => {
  const tile = event.target.closest('[data-level]');
  if (!tile) return;
  const n = Number(tile.dataset.level);
  if (n > progress.level) { audio.play('bump'); return; }
  play(n);
});

// ---------- 关卡 ----------
const levelTitle = (n, level) => level.title || themeFor(n).name;

// 每日挑战里不放宝石和宝箱（奖励在过关时统一发）
function freshState(level, daily) {
  const state = createState(level);
  if (daily) { state.star = null; state.chest = null; }
  return state;
}

function startLevel(n, { daily = false } = {}) {
  cancelWalk();
  const level = generateLevel(n);
  const theme = themeFor(n).id;
  const normal = settings.mode === 'normal';
  game = { n, level, daily, state: freshState(level, daily), history: [], theme, tutorialStep: level.tutorial ? 0 : -1, won: false, normal, rules: stepRules(level.par || 20), outOfSteps: false };
  quietMoves = 0;
  document.documentElement.dataset.themeScene = theme;
  $('#level-number').textContent = daily ? '每日挑战' : `第 ${n} 关`;
  $('#level-title').textContent = daily ? `${Number(dayKey().slice(5, 7))} 月 ${Number(dayKey().slice(8))} 日 · ${themeFor(n).name}` : levelTitle(n, level);
  renderToolButton();
  $('#hint-button').classList.remove('glow');
  showScreen('game');
  board.setLevel(game.state, theme, settings.outfit);
  renderTasks();
  $('#coach').hidden = true;
  board.showPointer(null);
  if (level.tutorial) openWelcome();
  else openMission();
  if (!daily) setTimeout(() => generateLevel(n + 1), 800); // 空闲时提前准备下一关
}

function openWelcome() {
  openModal(`
    <div class="modal-art">${art.heroIcon(settings.outfit)}</div>
    <h2 id="modal-title">你好，我是小星！</h2>
    <p>我是森林里的小快递员。<br>朋友们都在等礼物，我们一起送过去吧！</p>
    ${game.normal ? `<p class="mode-note">${art.icon('steps')} 普通模式：最多 ${game.rules.limit} 步，走得越少星星越多。</p>` : ''}
    <div class="actions"><button class="btn btn-big btn-primary" type="button" data-primary data-close>好呀！</button></div>
  `, { dismissable: false, onClose: () => tutorialShow() });
  speak('你好，我是小星！朋友们都在等礼物，我们一起送过去吧！', settings.speech);
}

const tile = (html) => `<svg viewBox="0 0 100 100" aria-hidden="true">${html}</svg>`;
const WATER = '<rect x="4" y="4" width="92" height="92" rx="18" fill="#7cc7ea"/><path d="M18 40 q12 -8 24 0 t24 0 M30 66 q12 -8 24 0 t24 0" stroke="#b8e4f7" stroke-width="5" fill="none" stroke-linecap="round"/>';
const RAFT = `${WATER}<rect x="12" y="18" width="76" height="64" rx="10" fill="#c98f58" stroke="#93622f" stroke-width="3"/><path d="M12 40 H88 M12 62 H88" stroke="#93622f" stroke-width="3"/>`;
const ICE = '<rect x="4" y="4" width="92" height="92" rx="18" fill="#d6f1fb"/><path d="M20 70 L40 50 M52 34 L70 16 M60 80 L82 58" stroke="#fff" stroke-width="6" stroke-linecap="round"/>';
function lessonDemo(kind) {
  const a = '<span class="arrow">→</span>';
  if (kind === 'key') return `${art.itemIcon('keyY')}${a}${tile(art.door('Y'))}${a}${art.avatar('bear', 'happy')}`;
  if (kind === 'river') return `${tile(art.box())}${a}${tile(WATER)}${a}${tile(RAFT)}`;
  if (kind === 'ice') return `${art.heroIcon(settings.outfit)}${a}${tile(ICE)}${tile(ICE)}${a}${tile(art.rock())}`;
  if (kind === 'portal') return `${art.heroIcon(settings.outfit)}${a}${tile(art.portal())}<span class="arrow">⋯</span>${tile(art.portal())}${a}${art.avatar('owl', 'happy')}`;
  if (kind === 'door2') return `${art.itemIcon('keyY')}${tile(art.door('Y'))}<span class="arrow">·</span>${art.itemIcon('keyB')}${tile(art.door('B'))}`;
  return '';
}

function missionRows(state) {
  return state.friends.map((f) => `<div class="mission-row">${art.avatar(f.kind)}<span>${friendName(f.kind)}</span><span class="arrow">想要</span>${art.itemIcon(f.want)}<span>${itemName(f.want)}</span></div>`).join('');
}

function openMission() {
  const { n, level, state, daily } = game;
  const fresh = daily ? null : newFriendAt(n);
  const lesson = level.lesson && !daily ? LESSONS[level.lesson === 'door' ? 'key' : level.lesson] : null;
  const lessonKey = level.lesson === 'door' ? 'key' : level.lesson;
  const lessonHtml = lesson ? `<div class="lesson-demo">${lessonDemo(lessonKey)}</div>
    <ul class="lesson-list">${lesson.lines.map((line, i) => `<li><span class="n">${i + 1}</span>${line}</li>`).join('')}</ul>` : '';
  const best = daily ? (dailyDone() ? progress.daily.stars : 0) : progress.ratings[n];
  openModal(`
    <div class="modal-art">${fresh ? art.avatar(fresh, 'happy') : art.heroIcon(settings.outfit)}</div>
    <h2 id="modal-title">${daily ? '今天的每日挑战' : lesson ? lesson.title : fresh ? `新朋友：${friendName(fresh)}！` : `第 ${n} 关 · ${levelTitle(n, level)}`}</h2>
    ${daily ? `<p>每天一张新地图，大家玩的都一样。${dailyDone() ? '今天已经完成啦，可以再玩一次。' : '完成后送你一件道具！'}</p>${progress.daily.streak > 1 && (dailyDone() || progress.daily.last === dayKey(new Date(Date.now() - 864e5))) ? `<p class="streak-note">${art.icon('flame')} 已经连续 ${progress.daily.streak} 天</p>` : ''}` : ''}
    ${fresh && !lesson ? `<p>${FRIENDS[fresh].bio}</p>` : ''}
    ${lessonHtml}
    <div class="mission">${missionRows(state)}</div>
    ${game.normal ? `<div class="mode-note">${art.icon('steps')} 最多 <b>${game.rules.limit}</b> 步 · ${game.rules.three} 步以内得 <span class="mini-stars inline">${starRow(3)}</span>${best ? ` · 最好成绩 <span class="mini-stars inline">${starRow(best)}</span>` : ''}</div>` : ''}
    ${state.star && !progress.gems[n] ? `<p class="gem-note">${art.gemIcon()} 地图上藏着一颗宝石，找到有惊喜（不找也可以）</p>` : ''}
    ${state.chest && !progress.chests[n] ? `<p class="gem-note">${art.chestIcon()} 这一关有个宝箱，里面有一件道具</p>` : ''}
    <div class="actions"><button class="btn btn-big btn-primary" type="button" data-primary data-close>出发！</button></div>
  `, { dismissable: false });
  speak(`${lesson ? lesson.lines.join('') : ''}${state.friends.map((f) => `${friendName(f.kind)}想要${itemName(f.want)}`).join('，')}。`, settings.speech);
}

function renderTasks() {
  const s = game.state;
  const hand = `<div class="hand-slot" title="小星手里"><span class="label">手里</span><span class="slot ${s.carry ? 'full' : ''}">${s.carry ? art.itemIcon(s.carry) : ''}</span></div>`;
  const tasks = s.friends.map((f) => `<div class="task ${f.happy ? 'done' : ''}" title="${friendName(f.kind)}想要${itemName(f.want)}">${art.avatar(f.kind, f.happy ? 'happy' : 'idle')}<span class="arrow">←</span><span class="want">${art.itemIcon(f.want)}</span><span class="check">${art.icon('check')}</span></div>`).join('');
  let steps = '';
  if (game.normal) {
    const left = game.rules.limit - s.steps;
    const now = rating(s.steps, game.level.par || 20);
    steps = `<div class="steps-chip ${left <= 5 ? 'warn' : ''}" title="已走步数 / 最多步数"><span class="steps-num">${art.icon('steps')}<b>${s.steps}</b>/${game.rules.limit}</span><span class="mini-stars">${starRow(now)}</span></div>`;
  }
  $('#tasks').innerHTML = hand + tasks + steps;
}

// ---------- 教学（第 1 关） ----------
const TUTORIAL_STEPS = [
  { text: '点一点发光的草地，小星就会走过去。（也可以用方向键）', at: (s) => [s.player.x + 2, s.player.y], until: (ev) => ev.some((e) => e.type === 'move') },
  { text: '看，那是苹果！走到苹果上，就能拿起来。', at: (s) => { const a = s.items.find((i) => i.type === 'apple'); return a ? [a.x, a.y] : null; }, until: (ev) => ev.some((e) => e.type === 'pickup' || e.type === 'swap') },
  { text: '小刺猬想要苹果。点一点小刺猬，把苹果送给它！', at: (s) => [s.friends[0].x, s.friends[0].y], until: (ev) => ev.some((e) => e.type === 'deliver') },
];
function tutorialShow() {
  if (!game || game.tutorialStep < 0) return;
  const info = TUTORIAL_STEPS[game.tutorialStep];
  if (!info) { $('#coach').hidden = true; board.showPointer(null); return; }
  if (game.tutorialStep === 1 && game.state.carry === 'apple') { game.tutorialStep = 2; tutorialShow(); return; }
  $('#coach-avatar').innerHTML = art.heroIcon(settings.outfit);
  $('#coach-text').textContent = info.text;
  $('#coach').hidden = false;
  const at = info.at(game.state);
  if (at) board.showPointer(at[0], at[1]);
  speak(info.text, settings.speech);
}
function tutorialCheck(events) {
  if (!game || game.tutorialStep < 0) return;
  const info = TUTORIAL_STEPS[game.tutorialStep];
  if (info?.until(events)) {
    game.tutorialStep++;
    if (game.tutorialStep >= TUTORIAL_STEPS.length) { $('#coach').hidden = true; board.showPointer(null); } else setTimeout(tutorialShow, 350);
  }
}
$('#coach-speak').innerHTML = art.icon('speak');
$('#coach-speak').addEventListener('click', () => speak($('#coach-text').textContent, true));

// ---------- 移动与事件 ----------
const canPlay = () => game && !game.won && !game.outOfSteps && !modal.open && !$('#screen-game').hidden;

function describe(events) {
  for (const e of events) {
    switch (e.type) {
      case 'pickup': {
        if (e.item === 'keyY' || e.item === 'keyB') return `拿到${itemName(e.item)}！去打开${DOORS[e.item === 'keyY' ? 'Y' : 'B'].name}吧`;
        const who = game.state.friends.find((f) => f.want === e.item && !f.happy);
        return who ? `拿到${itemName(e.item)}啦！送给${friendName(who.kind)}吧` : `拿到${itemName(e.item)}啦`;
      }
      case 'swap': return `放下${itemName(e.dropped)}，拿起${itemName(e.item)}`;
      case 'deliver': return `${friendName(e.kind)}：${THANKS[e.kind] || '谢谢你'}！`;
      case 'wrong': return `${friendName(e.kind)}想要的是${itemName(e.want)}哦`;
      case 'wish': return `${friendName(e.kind)}想要${itemName(e.want)}`;
      case 'friend-done': return `${friendName(e.kind)}已经收到礼物啦`;
      case 'locked': return game.state.carry ? `要拿着${itemName(e.key)}才能开门。小星一次只能拿一样东西哦` : `需要${itemName(e.key)}才能打开`;
      case 'open': return '门开啦！';
      case 'star': return '找到一颗宝石！';
      case 'chest': return '发现宝箱！过关后就能打开';
      case 'portal': return '嗖——从另一个传送门出来啦';
      case 'splash': return '箱子变成了小木桥！';
      case 'blocked':
        if (e.what === 'water') return game.state.boxes.length ? '水太深啦。把箱子推进河里，就能搭桥' : '水太深，过不去';
        if (e.what === 'box') return '箱子推不动：那边被挡住了';
        break;
      default:
    }
  }
  return null;
}

function soundFor(events) {
  const types = new Set(events.map((e) => e.type));
  if (types.has('deliver')) audio.play('deliver');
  else if (types.has('portal')) audio.play('portal');
  else if (types.has('chest')) audio.play('chest');
  else if (types.has('open') || types.has('splash')) audio.play('open');
  else if (types.has('pickup') || types.has('swap')) audio.play('pickup');
  else if (types.has('star')) audio.play('star');
  else if (types.has('wrong')) audio.play('wrong');
  else if (types.has('blocked') || types.has('locked')) audio.play('bump');
  else if (types.has('move')) audio.play('step');
}

function doStep(dir) {
  const result = step(game.state, dir);
  if (result.changed) game.history.push(game.state);
  game.state = result.state;
  for (const e of result.events) {
    if (e.type === 'open') progress.stats.doors++;
    if (e.type === 'splash') progress.stats.bridges++;
    if (e.type === 'portal') progress.stats.portals++;
  }
  if (result.events.some((e) => e.type === 'move' && e.slide)) progress.stats.slides++;
  board.clearHint();
  board.update(game.state, result.events);
  soundFor(result.events);
  const text = describe(result.events);
  if (text) toast(text);
  if (result.events.some((e) => !['move', 'blocked'].includes(e.type))) quietMoves = 0;
  else if (++quietMoves > 30) $('#hint-button').classList.add('glow');
  renderTasks();
  tutorialCheck(result.events);
  if (game.tutorialStep >= 0 && game.tutorialStep < TUTORIAL_STEPS.length && result.changed) {
    const at = TUTORIAL_STEPS[game.tutorialStep].at(game.state);
    if (game.tutorialStep === 0) board.showPointer(null); else if (at) board.showPointer(at[0], at[1]);
  }
  if (game.state.won) onWin();
  else if (game.normal && game.state.steps >= game.rules.limit) outOfSteps();
  return result;
}

function move(dir) {
  if (!canPlay()) return;
  cancelWalk();
  doStep(dir);
}
function cancelWalk() { clearTimeout(walkTimer); walkTimer = null; }
function walk(path) {
  cancelWalk();
  const next = () => {
    if (!path.length || !canPlay()) { walkTimer = null; return; }
    const result = doStep(path.shift());
    if (!result.changed && path.length) { walkTimer = null; return; }
    walkTimer = setTimeout(next, 175);
  };
  next();
}

function tap(cell) {
  if (!canPlay() || !cell) return;
  const { state } = game;
  if (cell.x === state.player.x && cell.y === state.player.y) return;
  const path = findPath(state, cell.x, cell.y);
  if (path === null) {
    const t = state.tiles[cell.y * state.w + cell.x];
    const msg = { '#': '那是小树，走不过去', o: '那是石头，走不过去', '=': '那是栅栏，要找小门', '~': '水太深，先搭桥吧', _: '冰面会滑，用方向键或滑动屏幕试试' }[t];
    toast(msg || '那里现在走不过去', { voice: false });
    audio.play('bump');
    return;
  }
  board.tapMark(cell.x, cell.y);
  walk(path);
}

// ---------- 步数用完 ----------
function outOfSteps() {
  game.outOfSteps = true;
  cancelWalk();
  setTimeout(() => {
    openModal(`
      <div class="modal-art">${art.heroIcon(settings.outfit)}</div>
      <h2 id="modal-title">步数用完啦</h2>
      <p>小星有点累了。想一想，有没有更近的路？</p>
      <p class="mode-note">${art.icon('hint')} 小窍门：点“提示”会画出最近的路线。</p>
      <div class="actions">
        <button class="btn btn-soft" type="button" data-act="undo">${art.icon('undo')}退回几步</button>
        ${progress.tools.shoes ? `<button class="btn btn-soft" type="button" data-act="shoes"><span class="btn-tool">${art.toolIcon('shoes')}</span>用加步鞋 +5 步</button>` : ''}
        <button class="btn btn-soft" type="button" data-act="easy">换简单模式继续</button>
        <button class="btn btn-big btn-primary" type="button" data-primary data-act="restart">${art.icon('restart')}从头再来</button>
      </div>
    `, { dismissable: false });
    speak('步数用完啦。想一想，有没有更近的路？', settings.speech);
    $('#modal-card').onclick = (event) => {
      const act = event.target.closest('[data-act]')?.dataset.act;
      if (!act) return;
      closeThen(() => {
        game.outOfSteps = false;
        if (act === 'undo') { for (let i = 0; i < 5 && game.history.length; i++) game.state = game.history.pop(); redraw(); }
        if (act === 'restart') restart(true);
        if (act === 'shoes') useTool('shoes');
        if (act === 'easy') { settings.mode = 'easy'; persist(); game.normal = false; renderTasks(); toast('已换成简单模式：不限步数', { voice: false }); }
      });
    };
  }, 450);
}

// ---------- 撤销 / 重来 / 提示 ----------
function redraw() {
  board.setLevel(game.state, game.theme, settings.outfit);
  renderTasks();
  if (game.tutorialStep >= 0) tutorialShow();
}
function undo() {
  if (!game || game.won || modal.open) return;
  cancelWalk();
  const prev = game.history.pop();
  if (!prev) { toast('已经是一开始的样子啦', { voice: false }); return; }
  game.state = prev;
  game.outOfSteps = false;
  redraw();
  audio.play('tap');
  toast('退回了一步', { voice: false });
}
function restart(force = false) {
  if (!game || game.won || (modal.open && !force)) return;
  cancelWalk();
  if (game.state.steps) game.history.push(game.state);
  game.state = freshState(game.level, game.daily);
  game.outOfSteps = false;
  redraw();
  toast('重新开始。想回到刚才，可以点“撤销”', { voice: false });
}
function hint() {
  if (!canPlay()) return;
  cancelWalk();
  $('#hint-button').classList.remove('glow');
  quietMoves = 0;
  const { path } = solve(game.state, { maxNodes: 80000 });
  if (path === null) { toast('这样好像走不通了。点“撤销”退回去试试吧'); return; }
  if (!path || !path.length) { toast('想一想：谁还在等礼物？'); return; }
  if (game.normal && game.state.steps + path.length > game.rules.limit) toast('剩下的步数可能不够了，可以撤销几步，换条近路');
  let s = game.state;
  const cells = [];
  let goal = null;
  let text = null;
  for (const dir of path) {
    const r = step(s, dir);
    s = r.state;
    const key = r.events.find((e) => ['pickup', 'swap', 'deliver', 'open', 'splash', 'portal'].includes(e.type));
    if (key) {
      goal = key.type === 'portal' ? [key.from.x, key.from.y] : [key.x, key.y];
      text = key.type === 'pickup' || key.type === 'swap' ? `先去拿${itemName(key.item)}` : key.type === 'deliver' ? `把${itemName(key.item)}送给${friendName(key.kind)}` : key.type === 'open' ? `用钥匙打开${DOORS[key.door].name}` : key.type === 'portal' ? '走进传送门' : '把箱子推进河里搭桥';
      break;
    }
    cells.push([s.player.x, s.player.y]);
  }
  board.showHint(cells.slice(0, 14), goal);
  if (text && !(game.normal && game.state.steps + path.length > game.rules.limit)) toast(`提示：${text}`);
}

// ---------- 道具 ----------
function renderToolButton() {
  const n = toolCount();
  $('#tools-button .tool-icon').innerHTML = `${art.icon('bag')}${n ? `<i class="badge">${n}</i>` : ''}`;
}
function openTools() {
  if (!canPlay()) return;
  cancelWalk();
  const cards = TOOL_ORDER.map((id) => {
    const have = progress.tools[id] || 0;
    return `<button class="tool-card ${have ? '' : 'empty'}" type="button" data-tool="${id}" ${have ? '' : 'aria-disabled="true"'}>
      <span class="tool-pic">${art.toolIcon(id)}<i class="count">×${have}</i></span>
      <b>${TOOLS[id].name}</b><small>${TOOLS[id].desc}</small></button>`;
  }).join('');
  openModal(`
    <h2 id="modal-title">小星的口袋</h2>
    <p>道具是帮手：想用就用，不用也能过关。</p>
    <div class="tool-cards">${cards}</div>
    <p class="gem-note">${art.chestIcon()} 宝箱、每日礼物和每日挑战都会送道具</p>
    <div class="actions"><button class="btn btn-primary" type="button" data-primary data-close>好了</button></div>
  `);
  $('#modal-card').onclick = (event) => {
    const card = event.target.closest('[data-tool]');
    if (!card) return;
    const id = card.dataset.tool;
    if (!progress.tools[id]) { audio.play('bump'); return; }
    closeThen(() => useTool(id));
  };
}
function useTool(id) {
  if (!game || game.won || !progress.tools[id]) return;
  if (id === 'shoes') {
    if (!game.normal) { toast('简单模式不限步数，用不上加步鞋'); return; }
    game.rules.limit += 5;
    game.outOfSteps = false;
    toast('加步鞋：可以多走 5 步！');
  } else if (id === 'magnet') {
    const pulled = magnetPull(game.state);
    if (!pulled) { toast(game.state.carry ? '手里空着的时候，磁铁才有用' : '地图上没有可以吸过来的礼物'); return; }
    game.history.push(game.state);
    game.state = pulled.state;
    board.setLevel(game.state, game.theme, settings.outfit);
    board.flyItem(pulled.item.type, pulled.item);
    const who = game.state.friends.find((f) => f.want === pulled.item.type && !f.happy);
    toast(`磁铁把${itemName(pulled.item.type)}吸过来啦！${who ? `送给${friendName(who.kind)}吧` : ''}`);
  } else if (id === 'firefly') {
    const { path } = solve(game.state, { maxNodes: 120000 });
    if (!path || !path.length) { toast('萤火虫找不到路。点“撤销”退回几步再试试'); return; }
    let s = game.state;
    const cells = [];
    for (const dir of path) { s = step(s, dir).state; cells.push([s.player.x, s.player.y]); }
    board.showHint(cells.slice(0, 80), null, { glow: true });
    toast('萤火虫照亮了整条路，跟着光走吧');
  }
  progress.tools[id]--;
  progress.stats.tools++;
  persist();
  audio.play('tool');
  renderTasks();
  renderToolButton();
}

// ---------- 过关 ----------
function confetti() {
  if (settings.calm || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const box = document.createElement('div');
  box.className = 'confetti';
  const colors = ['#ffb52e', '#ff6b81', '#5b8def', '#5cbf6a', '#b8a4ff', '#ffd23f'];
  for (let i = 0; i < 60; i++) {
    const p = document.createElement('i');
    p.style.left = `${Math.random() * 100}%`;
    p.style.background = colors[i % colors.length];
    p.style.animationDelay = `${Math.random() * 0.6}s`;
    p.style.animationDuration = `${1.8 + Math.random() * 1.4}s`;
    box.append(p);
  }
  document.body.append(box);
  setTimeout(() => box.remove(), 3600);
}

function onWin() {
  game.won = true;
  cancelWalk();
  $('#coach').hidden = true;
  board.showPointer(null);
  const { n, state, daily } = game;
  const before = totals();
  const hearts = state.friends.length;
  const stars = game.normal ? rating(state.steps, game.level.par) : 0;
  let prevBest = progress.ratings[n] || 0;
  let prize = null; // 这一关得到的道具
  progress.hearts += hearts;
  for (const f of state.friends) { progress.gifts[f.kind] = (progress.gifts[f.kind] || 0) + 1; progress.met[f.kind] = true; }
  if (daily) {
    const d = progress.daily;
    const today = dayKey();
    prevBest = d.last === today ? d.stars : 0;
    if (d.last !== today) {
      d.streak = d.last === dayKey(new Date(Date.now() - 864e5)) ? d.streak + 1 : 1;
      d.bestStreak = Math.max(d.bestStreak, d.streak);
      d.total++;
      d.last = today;
      d.stars = stars;
      prize = grantTool();
    } else d.stars = Math.max(d.stars, stars);
  } else {
    if (state.starTaken) progress.gems[n] = true;
    if (state.chestTaken && !progress.chests[n]) { progress.chests[n] = true; prize = grantTool(); }
    if (stars > prevBest) progress.ratings[n] = stars;
    if (n >= progress.level) progress.level = n + 1;
    progress.best = Math.max(progress.best, n);
  }
  const stickers = checkStickers();
  persist();
  const after = totals();
  const unlocked = Object.keys(art.OUTFITS).filter((id) => !outfitUnlocked(id, before) && outfitUnlocked(id, after));

  setTimeout(() => {
    audio.play('win');
    confetti();
    const upcoming = daily ? null : nextFriendAfter(n);
    const storyDone = !daily && n === STORY_LEVELS.length;
    if (stickers.length) setTimeout(() => audio.play('sticker'), 900);
    const teaser = upcoming ? `<div class="next-friend">${art.avatar(upcoming)}<span>再过 ${FRIENDS[upcoming].unlock - n} 关，会遇到一位新朋友</span></div>` : '';
    const scoreHtml = game.normal
      ? `<div class="big-stars">${starRow(stars)}</div><p>用了 <b>${state.steps}</b> 步（${state.steps < game.level.par ? '道具帮了大忙' : `最少 ${game.level.par} 步`}）${stars > prevBest && prevBest ? ' · 新纪录！' : ''}</p>`
      : '<p class="mode-note">想挑战三颗星？回首页选“普通”模式。</p>';
    openModal(`
      <div class="win-friends">${state.friends.slice(0, 3).map((f) => art.avatar(f.kind, 'happy')).join('')}</div>
      <h2 id="modal-title">太棒了！</h2>
      <p>${state.friends.map((f) => friendName(f.kind)).join('和')}都收到了礼物。</p>
      ${scoreHtml}
      <div class="rewards">
        <span class="reward heart">${art.icon('heart')} +${hearts}</span>
        ${state.star ? `<span class="reward gem ${state.starTaken ? '' : 'missed'}">${art.gemIcon()} ${state.starTaken ? '找到宝石' : '宝石下次再找'}</span>` : ''}
      </div>
      ${daily ? `<div class="unlock-note daily-note">${art.icon('flame')}<span>每日挑战完成！已经连续 <b>${progress.daily.streak}</b> 天</span></div>` : ''}
      ${prize ? `<div class="unlock-note prize-note"><span class="prize-pic">${art.toolIcon(prize)}</span><span>${daily ? '挑战奖励' : '打开宝箱'}：<b>${TOOLS[prize].name}</b> ×1</span></div>` : ''}
      ${stickerNote(stickers)}
      ${unlocked.length ? `<div class="unlock-note">${art.heroIcon(unlocked[0])}<span>解锁新帽子：<b>${art.OUTFITS[unlocked[0]].name}</b>！去“衣橱”换上吧</span></div>` : ''}
      ${storyDone ? '<p><b>前 3 关都完成啦！</b>接下来会出现箱子、小河、冰面……关卡自动生成，可以一直玩下去。</p>' : teaser}
      <div class="actions">
        <button class="btn btn-soft" type="button" data-again>${art.icon('restart')}再玩一次</button>
        <button class="btn btn-big btn-primary" type="button" data-primary data-next>${daily ? `${art.icon('home')}回到首页` : `${art.icon('next')}${storyDone ? '继续冒险' : '下一关'}`}</button>
      </div>
    `, { dismissable: false });
    speak(`太棒了！${game.normal ? `得到${stars}颗星。` : ''}`, settings.speech);
    $('#modal-card').onclick = (event) => {
      if (event.target.closest('[data-next]')) closeThen(() => (daily ? renderTitle() : startLevel(n + 1)));
      if (event.target.closest('[data-again]')) closeThen(() => startLevel(n, { daily }));
    };
  }, settings.calm ? 500 : 1100);
}

// ---------- 休息、设置、衣橱、图鉴、说明 ----------
function openRest() {
  cancelWalk();
  openModal(`
    <h2 id="modal-title">休息一下</h2>
    <div class="breath">慢慢呼吸</div>
    <p>看着圆圈：变大时吸气，变小时呼气。<br>游戏会一直等你，进度不会丢。</p>
    <div class="actions">
      <button class="btn btn-soft" type="button" data-home>${art.icon('home')}回到首页</button>
      <button class="btn btn-big btn-primary" type="button" data-primary data-close>继续玩</button>
    </div>
  `);
  $('#modal-card').onclick = (event) => { if (event.target.closest('[data-home]')) closeThen(renderTitle); };
}

function openSettings() {
  const row = (key, title, desc) => `<div class="setting"><div>${title}<small>${desc}</small></div><button class="switch" type="button" role="switch" data-key="${key}" aria-checked="${settings[key]}" aria-label="${title}"></button></div>`;
  const seg = (key, title, desc, options) => `<div class="setting"><div>${title}<small>${desc}</small></div><div class="seg" data-key="${key}">${options.map(([v, label]) => `<button type="button" data-v="${v}" aria-pressed="${settings[key] === v}">${label}</button>`).join('')}</div></div>`;
  openModal(`
    <h2 id="modal-title">设置</h2>
    <div class="settings">
      ${seg('mode', '游戏模式', '普通模式有步数限制和星级', [['easy', '简单'], ['normal', '普通']])}
      ${row('sound', '音效', '轻轻的提示音')}
      ${row('music', '背景音乐', '很轻的小旋律（需要打开音效）')}
      ${row('speech', '朗读文字', '把提示读出来（需要浏览器支持中文语音）')}
      ${row('calm', '安静画面', '关掉小动画和彩带')}
      ${row('dpad', '屏幕方向键', '在屏幕上显示方向按钮')}
      ${row('tilt', 'micro:bit 倾斜走路', '关掉后只用 A / B 按键')}
      ${seg('sensitivity', 'micro:bit 灵敏度', '容易误走就调低', [['low', '低'], ['mid', '中'], ['high', '高']])}
    </div>
    <div class="actions"><button class="btn btn-soft" type="button" data-reset>清除全部进度</button><button class="btn btn-primary" type="button" data-primary data-close>好了</button></div>
  `, { onClose: () => { if (game && !$('#screen-game').hidden && game.normal !== (settings.mode === 'normal') && !game.won) toast('模式会从下一关开始生效', { voice: false }); if (!$('#screen-title').hidden) renderTitle(); } });
  $('#modal-card').onclick = (event) => {
    const sw = event.target.closest('.switch');
    if (sw) {
      settings[sw.dataset.key] = !settings[sw.dataset.key];
      sw.setAttribute('aria-checked', String(settings[sw.dataset.key]));
      applySettings(); persist();
      if (sw.dataset.key === 'sound' && settings.sound) audio.play('pickup');
      audio.syncMusic();
      if (sw.dataset.key === 'speech' && settings.speech) speak('好的，我会把提示读出来。', true);
    }
    const opt = event.target.closest('.seg [data-v]');
    if (opt) {
      const key = opt.parentElement.dataset.key;
      settings[key] = opt.dataset.v;
      for (const b of opt.parentElement.children) b.setAttribute('aria-pressed', String(b === opt));
      persist();
      if (key === 'sensitivity') microbit.setSensitivity(settings.sensitivity);
    }
    const reset = event.target.closest('[data-reset]');
    if (reset) {
      if (reset.dataset.confirm) { Object.assign(progress, defaults().progress); persist(); closeThen(renderTitle); }
      else { reset.dataset.confirm = '1'; reset.textContent = '再点一次确认清除'; }
    }
  };
}

function openWardrobe() {
  const t = totals();
  const cards = Object.entries(art.OUTFITS).map(([id, o]) => {
    const open = outfitUnlocked(id, t);
    const need = o.need ? Object.entries(o.need).map(([k, v]) => `${NEED_LABEL[k]} ${Math.min(t[k], v)}/${v}`).join(' ') : '一开始就有';
    return `<button class="outfit ${open ? '' : 'locked'}" type="button" data-outfit="${id}" aria-pressed="${settings.outfit === id}" ${open ? '' : 'aria-disabled="true"'}>
      ${art.heroIcon(id)}<b>${o.name}</b><small>${open ? (settings.outfit === id ? '正在戴' : '点一下换上') : `需要 ${need}`}</small></button>`;
  }).join('');
  openModal(`
    <h2 id="modal-title">小星的衣橱</h2>
    <div class="totals"><span class="reward heart">${art.icon('heart')} ${t.hearts}</span><span class="reward star">${art.icon('star')} ${t.stars}</span><span class="reward gem">${art.gemIcon()} ${t.gems}</span></div>
    <p style="font-size:14px">♥ 每送出一份礼物得一颗；★ 来自普通模式；宝石藏在地图里。</p>
    <div class="outfits">${cards}</div>
    <div class="actions"><button class="btn btn-primary" type="button" data-primary data-close>好了</button></div>
  `, { onClose: () => { if (!$('#screen-title').hidden) renderTitle(); } });
  $('#modal-card').onclick = (event) => {
    const b = event.target.closest('[data-outfit]');
    if (!b) return;
    if (!outfitUnlocked(b.dataset.outfit)) { audio.play('bump'); return; }
    settings.outfit = b.dataset.outfit; persist(); audio.play('pickup');
    openWardrobe();
  };
}

function openBook() {
  const cards = Object.keys(FRIENDS).map((kind) => {
    const met = progress.met[kind];
    const f = FRIENDS[kind];
    return `<div class="card ${met ? '' : 'locked'}"><div class="pic">${art.avatar(kind, met ? 'happy' : 'idle')}<span class="gift">${met ? art.itemIcon(f.want) : ''}</span></div>
      <h3>${met ? f.name : '？？？'}</h3><p>${met ? f.bio : `第 ${f.unlock} 关会遇到`}</p>${met ? `<div class="count">♥ 收到 ${progress.gifts[kind] || 0} 份礼物</div>` : ''}</div>`;
  }).join('');
  const t = totals();
  openModal(`
    <h2 id="modal-title">朋友图鉴</h2>
    <div class="totals"><span class="reward heart">${art.icon('heart')} ${t.hearts}</span><span class="reward star">${art.icon('star')} ${t.stars}</span><span class="reward gem">${art.gemIcon()} ${t.gems}</span></div>
    <div class="book">${cards}</div>
    <div class="actions"><button class="btn btn-primary" type="button" data-primary data-close>好了</button></div>
  `);
}

function openStickers() {
  checkStickers();
  const have = Object.keys(progress.stickers).length;
  const cards = STICKERS.map((st) => {
    const got = progress.stickers[st.id];
    return `<div class="sticker ${got ? 'got' : ''}"><span class="sticker-badge">${got ? st.icon : '？'}</span><b>${st.name}</b><small>${st.desc}</small></div>`;
  }).join('');
  openModal(`
    <h2 id="modal-title">贴纸册</h2>
    <p>已经收集 <b>${have}</b> / ${STICKERS.length} 张。慢慢来，不着急。</p>
    <div class="stickers">${cards}</div>
    <div class="actions"><button class="btn btn-primary" type="button" data-primary data-close>好了</button></div>
  `, { onClose: () => { if (!$('#screen-title').hidden) renderTitle(); } });
}

// 每日礼物：每天第一次来，送一件道具
function openGift() {
  if (progress.giftDay === dayKey()) return;
  progress.giftDay = dayKey();
  const id = grantTool();
  audio.play('chest');
  openModal(`
    <div class="gift-reveal"><span class="gift-glow"></span>${art.toolIcon(id)}</div>
    <h2 id="modal-title">今日礼物</h2>
    <p>送你一件道具：<b>${TOOLS[id].name}</b></p>
    <p>${TOOLS[id].desc}</p>
    <p class="gem-note">明天再来，还有新的礼物</p>
    <div class="actions"><button class="btn btn-big btn-primary" type="button" data-primary data-close>收下</button></div>
  `, { onClose: () => { if (!$('#screen-title').hidden) renderTitle(); } });
  speak(`今日礼物：${TOOLS[id].name}`, settings.speech);
}

function openParent() {
  openModal(`
    <h2 id="modal-title">给家长和老师</h2>
    <ul class="parent-list">
      <li><b>规则少、始终一样：</b>走路、拿礼物、送给朋友。每位朋友永远想要同一种礼物。新机关（钥匙、箱子搭桥、冰面、传送门）出现前都会先讲解。</li>
      <li><b>两种模式：</b>“简单”不限步数；“普通”有步数上限和 1–3 颗星，步数用完可以退回、重来或直接换成简单模式。</li>
      <li><b>看得见的任务清单：</b>上方显示“谁想要什么”“手里拿着什么”和步数。</li>
      <li><b>不会被惩罚：</b>可以无限撤销、重来；“提示”会画出脚印。</li>
      <li><b>可以随时休息：</b>右上角的“休息”有慢呼吸动画，进度保留。</li>
      <li><b>感官可调：</b>声音、动画、朗读可单独开关，也跟随系统“减少动态效果”。</li>
      <li><b>多种操作：</b>点屏幕、滑动、方向键，或 micro:bit 倾斜（可校准、调灵敏度）。</li>
      <li><b>道具是可选的帮手：</b>萤火虫（照亮整条路）、礼物磁铁、加步鞋。来自宝箱、每日礼物和每日挑战，不用也能过关，不需要花钱。</li>
      <li><b>每日挑战与贴纸：</b>每天一张新地图；贴纸只记录做到的好事，没有倒计时，断了连续天数也不会有任何损失。</li>
      <li><b>持续可玩：</b>前 3 关是教学关，之后自动生成，每张图都经程序验证一定能完成。</li>
    </ul>
    <p style="font-size:14px">这是一个游戏，不是诊断或治疗工具。每个孩子的需要都不同，建议陪孩子一起试玩，观察 TA 喜欢和不舒服的地方。进度只保存在这台设备的浏览器里。</p>
    <div class="actions"><button class="btn btn-primary" type="button" data-primary data-close>知道了</button></div>
  `);
}

// ---------- micro:bit ----------
let mbState = { state: 'idle', message: '还没有连接。' };
let tiltStreaming = false;
let calibrating = false;
const microbit = createMicrobit({
  tiltEnabled: () => settings.tilt,
  sensitivity: () => settings.sensitivity,
  onStatus(next) {
    mbState = next;
    const ready = next.state === 'ready';
    $('#mb-dot').hidden = !ready;
    if (ready) $('#mb-dot').textContent = 'micro:bit';
    if (!$('#screen-title').hidden) $('#microbit-button span').textContent = ready ? 'micro:bit 已连接' : '连接 micro:bit';
    if (modal.open && modal.querySelector('.mb-status')) renderMicrobit();
    else if (ready || next.state === 'idle') toast(next.message, { voice: false });
  },
  onTilt({ x, y }) {
    const dot = document.querySelector('#tilt-dot');
    if (!dot) return;
    const scale = 50 / 1000;
    const cx = Math.max(-56, Math.min(56, x * scale));
    const cy = Math.max(-56, Math.min(56, y * scale));
    dot.setAttribute('transform', `translate(${cx} ${cy})`);
    const r = SENSITIVITY[settings.sensitivity] * scale;
    dot.classList.toggle('over', Math.max(Math.abs(x), Math.abs(y)) * scale >= r);
  },
  onAction(action) {
    if (action.type === 'move') { move(action.direction); return; }
    if (action.type === 'a') {
      if (modal.open) { if (!modal.querySelector('.mb-status')) modal.querySelector('[data-primary]')?.click(); return; }
      if (!$('#screen-title').hidden) { $('#play-button').click(); return; }
      hint();
    }
    if (action.type === 'b' && !modal.open) undo();
  },
});

const MB_SVG = `<svg class="mb-board" viewBox="0 0 200 130" aria-hidden="true"><rect x="6" y="6" width="188" height="118" rx="16" fill="#2b2b33"/>
  <circle cx="34" cy="62" r="13" fill="#3a3a44" stroke="#666" stroke-width="2"/><text x="34" y="68" text-anchor="middle" font-size="16" font-weight="700" fill="#ddd">A</text>
  <circle cx="166" cy="62" r="13" fill="#3a3a44" stroke="#666" stroke-width="2"/><text x="166" y="68" text-anchor="middle" font-size="16" font-weight="700" fill="#ddd">B</text>
  ${Array.from({ length: 25 }, (_, i) => `<rect x="${72 + (i % 5) * 12}" y="${34 + Math.floor(i / 5) * 12}" width="6" height="8" rx="1.5" fill="${[2, 7, 10, 11, 12, 13, 14, 17, 22].includes(i) ? '#ff5a4f' : '#55555f'}"/>`).join('')}
  ${[22, 52, 100, 148, 178].map((x) => `<rect x="${x - 9}" y="104" width="18" height="20" rx="3" fill="#c9a35a"/>`).join('')}</svg>`;

function calibrationPanel() {
  const r = SENSITIVITY[settings.sensitivity] * 0.05;
  return `<div class="calib">
    <svg class="tilt-meter" viewBox="-64 -64 128 128" aria-label="倾斜水平仪">
      <circle r="62" fill="#eef6ff" stroke="#cfe0f5" stroke-width="2"/>
      <circle r="${r}" fill="#fff" stroke="#9cc3ef" stroke-width="2" stroke-dasharray="5 4"/>
      <path d="M-62 0 H62 M0 -62 V62" stroke="#cfe0f5" stroke-width="1.5"/>
      <g id="tilt-dot"><circle r="9" fill="#5b8def" stroke="#fff" stroke-width="3"/></g>
    </svg>
    <div class="calib-side">
      <p>蓝点在虚线圈里 = 不走动。<br>蓝点出圈 = 朝那个方向走。</p>
      <button class="btn btn-blue" type="button" data-mb="calibrate">${calibrating ? '校准中…' : `${art.icon('target')}校准`}</button>
      <div class="seg" data-key="sensitivity">${[['low', '低'], ['mid', '中'], ['high', '高']].map(([v, l]) => `<button type="button" data-v="${v}" aria-pressed="${settings.sensitivity === v}">灵敏度 ${l}</button>`).join('')}</div>
    </div>
  </div>`;
}

function renderMicrobit(extra = '') {
  const s = mbState.state;
  const connectBtn = microbit.connected
    ? '<button class="btn btn-soft" type="button" data-mb="disconnect">断开</button>'
    : `<button class="btn btn-blue" type="button" data-primary data-mb="connect">${art.icon('plug')}连接 micro:bit</button>`;
  const fixBtns = microbit.connected && ['silent', 'listening', 'outdated'].includes(s)
    ? `<button class="btn btn-primary" type="button" data-mb="install">${s === 'outdated' ? '更新控制程序' : '安装控制程序'}</button><button class="btn btn-soft" type="button" data-mb="manual">查看手动步骤</button>` : '';
  const ready = s === 'ready' && microbit.ready;
  const html = `
    <h2 id="modal-title">micro:bit 控制器</h2>
    ${ready ? calibrationPanel() : MB_SVG}
    <div class="mb-controls"><div><b>倾斜</b>小星走路</div><div><b>A</b>提示 / 确定</div><div><b>B</b>撤销</div></div>
    <div class="mb-status" data-state="${s}"><span class="light"></span><span>${mbState.message}</span></div>
    ${ready ? '<p style="font-size:13px">小星自己乱走？把板子放平（或用孩子舒服的姿势拿着），点“校准”。板子上同时按 A+B 也能校准。</p>' : ''}
    ${extra}
    <div class="actions">${fixBtns}${connectBtn}${ready ? '<button class="btn btn-primary" type="button" data-close>好了</button>' : ''}</div>
    <p style="font-size:13px">需要电脑上的 Chrome 或 Edge。没有 micro:bit 也能完整地玩。</p>`;
  if (modal.open && modal.querySelector('.mb-status')) {
    const card = $('#modal-card');
    const handler = card.onclick;
    card.innerHTML = `<button class="modal-close" type="button" data-close aria-label="关闭">${art.icon('close')}</button>${html}`;
    card.onclick = handler;
  } else openModal(html);
  if (ready && !tiltStreaming) { tiltStreaming = true; microbit.streamTilt(true); }
}

const firmwareCode = async () => (await fetch('firmware/main.py', { cache: 'no-store' })).text();

function openMicrobit() {
  if (!microbit.supported) mbState = { state: 'unsupported', message: '这个浏览器不能连接 USB 设备。请用电脑上的 Chrome 或 Edge 打开游戏。' };
  renderMicrobit();
  $('#modal-card').onclick = async (event) => {
    const opt = event.target.closest('.seg [data-v]');
    if (opt) {
      settings.sensitivity = opt.dataset.v; persist();
      await microbit.setSensitivity(settings.sensitivity);
      renderMicrobit();
      return;
    }
    const btn = event.target.closest('[data-mb]');
    if (!btn) return;
    const action = btn.dataset.mb;
    if (action === 'connect') await microbit.connect();
    if (action === 'disconnect') { tiltStreaming = false; await microbit.disconnect(); }
    if (action === 'calibrate' && !calibrating) {
      calibrating = true;
      for (const n of [3, 2, 1]) { btn.textContent = `保持不动… ${n}`; await new Promise((r) => setTimeout(r, 700)); }
      const ok = await microbit.calibrate();
      calibrating = false;
      mbState = { state: 'ready', message: ok ? '校准好了！现在这个姿势就是“不倾斜”。' : '校准没有成功，请再试一次。' };
      renderMicrobit();
      if (ok) audio.play('pickup');
    }
    if (action === 'install') {
      mbState = { state: 'installing', message: '正在检查板子上的程序……' };
      renderMicrobit();
      tiltStreaming = false;
      if (!(await microbit.detectPython())) {
        mbState = { state: 'silent', message: '板子上不是 MicroPython，没法自动安装。请按下面的步骤烧录一次（只需要一次）。' };
        renderMicrobit(await manualSteps());
        return;
      }
      await microbit.installController(await firmwareCode());
    }
    if (action === 'manual') renderMicrobit(await manualSteps());
  };
}
$('#mb-dot').addEventListener('click', () => openMicrobit());

async function manualSteps() {
  let code = '';
  try { code = await firmwareCode(); } catch { code = '（请打开项目里的 firmware/main.py）'; }
  const escaped = code.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return `<ol class="mb-help">
    <li>先点下面的“断开”。</li>
    <li>打开 <b>python.microbit.org</b>（micro:bit 官方 Python 编辑器）。</li>
    <li>把下面的代码全部复制进去，点“Send to micro:bit”烧录。</li>
    <li>关掉编辑器页面，回到这里点“连接 micro:bit”。</li>
  </ol>
  <div class="code-box">${escaped}</div>
  <div class="actions"><button class="btn btn-soft" type="button" onclick="navigator.clipboard?.writeText(this.closest('.modal-card').querySelector('.code-box').textContent)">复制代码</button></div>`;
}

// ---------- 输入 ----------
const KEYS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right' };
let lastKey = 0;
window.addEventListener('keydown', (event) => {
  if (modal.open || $('#screen-game').hidden) return;
  const dir = KEYS[event.key];
  if (dir) {
    event.preventDefault();
    const now = performance.now();
    if (event.repeat && now - lastKey < 150) return;
    lastKey = now;
    move(dir);
  } else if (event.key === 'z' || event.key === 'Z' || event.key === 'Backspace') { event.preventDefault(); undo(); }
  else if (event.key === 'h' || event.key === 'H') hint();
  else if (event.key === 'i' || event.key === 'I') openTools();
  else if (event.key === 'Escape') openRest();
});

let pointerStart = null;
const svg = $('#board');
svg.addEventListener('pointerdown', (event) => { pointerStart = { x: event.clientX, y: event.clientY }; });
svg.addEventListener('pointerup', (event) => {
  if (!pointerStart) return;
  const dx = event.clientX - pointerStart.x;
  const dy = event.clientY - pointerStart.y;
  pointerStart = null;
  if (Math.max(Math.abs(dx), Math.abs(dy)) > 34) move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
  else tap(board.cellAt(event.clientX, event.clientY));
});
svg.addEventListener('pointercancel', () => { pointerStart = null; });

for (const button of document.querySelectorAll('#dpad button')) {
  button.innerHTML = arrow({ up: 0, right: 90, down: 180, left: 270 }[button.dataset.dir]);
  button.addEventListener('click', () => move(button.dataset.dir));
}
$('#undo-button .tool-icon').innerHTML = art.icon('undo');
$('#restart-button .tool-icon').innerHTML = art.icon('restart');
$('#hint-button .tool-icon').innerHTML = art.icon('hint');
$('#home-button').innerHTML = art.icon('home');
$('#rest-button').innerHTML = art.icon('pause');
$('#undo-button').addEventListener('click', undo);
$('#restart-button').addEventListener('click', () => restart());
$('#hint-button').addEventListener('click', hint);
$('#tools-button').addEventListener('click', openTools);
$('#rest-button').addEventListener('click', openRest);
$('#home-button').addEventListener('click', () => renderTitle());

// 测试用入口
window.__game = { get state() { return game?.state; }, get game() { return game; }, move, tap, startLevel, useTool, settings, progress };

applySettings();
renderTitle();
