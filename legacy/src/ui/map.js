import { powered, gateIsOpen, wedged, same, atAny, describeState } from '../game/rules.js';

export const TILE = 58;
const center = (at) => ({ x: (at.x + .5) * TILE, y: (at.y + .5) * TILE });
const esc = (value) => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const label = (x, y, text, className = 'map-label', anchor = 'middle') => `<text x="${x}" y="${y}" text-anchor="${anchor}" class="${className}">${esc(text)}</text>`;

function piece(at, content) {
  const c = center(at);
  return `<g transform="translate(${c.x} ${c.y})">${content}</g>`;
}
function batterySymbol() {
  return '<rect x="-12" y="-9" width="23" height="18" rx="3" fill="#f4dfaa" stroke="#946000" stroke-width="2"/><path d="M13-3v6M-7 0h12M-1-5v10" stroke="#946000" stroke-width="2"/>';
}

export function tileDescription(at, state, level) {
  const parts = [];
  if (same(at, state.robot)) parts.push('机器人');
  if (same(at, state.cart)) parts.push(state.cart.loaded ? '运输车与核心' : '空运输车');
  if (same(at, level.exit)) parts.push('人员出口');
  if (same(at, level.dock)) parts.push('核心接收区');
  if (same(at, level.loadSlot)) parts.push('吊装区');
  if (same(at, level.core) && !state.cart.loaded) parts.push('数据核心');
  if (atAny(at, level.bridges)) parts.push(powered(state, level, 'bridge') ? '电桥，已供电' : '电桥，未供电');
  if (atAny(at, level.gates)) parts.push(gateIsOpen(state, level) ? '通道，已开启' : '通道，未开启');
  if (same(at, level.lever)) parts.push('维修开关');
  const socket = level.sockets.find((item) => same(at, item.at));
  if (socket) parts.push(socket.name);
  if (same(at, state.battery?.at)) parts.push('备用电池');
  if (atAny(at, state.boxes)) parts.push('支撑箱');
  return parts.join(' / ') || `第 ${at.x + 1} 列，第 ${at.y + 1} 行`;
}

export function drawMap(svg, state, level, { selected, ping, spotlight } = {}) {
  const bridgeOn = powered(state, level, 'bridge');
  const gateOpen = gateIsOpen(state, level);
  const railOn = powered(state, level, 'rail');
  let drawing = `<defs>
    <pattern id="floor-grid" width="58" height="58" patternUnits="userSpaceOnUse"><rect width="58" height="58" fill="#f2f5f6"/><path d="M58 0H0v58" fill="none" stroke="#dbe2e6" stroke-width="1"/></pattern>
    <pattern id="moat" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><rect width="12" height="12" fill="#bac9d4"/><path d="M0 0v12" stroke="#a8bbc9" stroke-width="3"/></pattern>
    <pattern id="safety" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="12" height="12" fill="#d0aa62"/><path d="M0 0v12" stroke="#8c6d34" stroke-width="5"/></pattern>
  </defs>
  <rect x="45" y="58" width="664" height="420" rx="7" fill="#aabac7"/>
  <rect x="45" y="47" width="664" height="419" rx="6" fill="#6f8494"/>
  <rect x="348" y="49" width="58" height="414" fill="url(#moat)"/>`;
  drawing += label(64, 29, '西侧 / 出口区', 'zone-label', 'start');
  drawing += label(691, 29, '东侧 / 仓库', 'zone-label', 'end');
  for (const at of level.floor) {
    if (at.x !== 6) drawing += `<rect x="${at.x * TILE}" y="${at.y * TILE}" width="58" height="58" fill="url(#floor-grid)"/>`;
  }
  // Raised cargo rails are distinct from the walkable floor.
  const start = center(level.loadSlot), dock = center(level.dock), buffer = center(level.buffer);
  let railPath;
  if (state.route === 'buffer') railPath = `M${start.x} ${start.y}H${buffer.x}V${buffer.y}`;
  else if (level.id === 'bypass' && state.route === 'direct') railPath = `M${start.x} ${start.y}V${6.8 * TILE}H${dock.x}V${dock.y}`;
  else railPath = `M${start.x} ${start.y}V${2.1 * TILE}H${dock.x}V${dock.y}`;
  drawing += `<path d="${railPath}" fill="none" stroke="#d4dfe7" stroke-width="13" stroke-linejoin="round"/><path d="${railPath}" fill="none" stroke="${railOn ? '#175ea8' : '#7892a6'}" stroke-width="3" stroke-dasharray="7 5" stroke-linejoin="round"/>`;
  for (const at of level.bridges) {
    drawing += piece(at, `<rect x="-29" y="-23" width="58" height="46" fill="${bridgeOn ? '#c9dfef' : '#a8b7c1'}" stroke="${bridgeOn ? '#175ea8' : '#61798c'}" stroke-width="2"/><path d="M-28-17h56M-28 17h56M-14-16v32M0-16v32M14-16v32" stroke="${bridgeOn ? '#6d9fc8' : '#879ba9'}"/>${label(0, 5, bridgeOn ? '桥 · 通' : '桥 · 停')}`);
  }
  for (const at of level.gates) {
    drawing += piece(at, `<rect x="-29" y="-25" width="58" height="50" fill="${gateOpen ? '#dfede5' : '#d4dce1'}" stroke="${gateOpen ? '#5e8d76' : '#788c99'}" stroke-width="2"/>${gateOpen ? '<path d="M-26-19h52M-26 19h52" stroke="#5e8d76" stroke-width="2"/>' : '<rect x="-9" y="-23" width="18" height="46" fill="url(#safety)"/>'}${label(0, gateOpen ? 5 : 42, gateOpen ? '通道' : '关闭')}`);
  }
  for (const at of level.shelves) drawing += piece(at, '<rect x="-23" y="-20" width="46" height="41" rx="2" fill="#9aabb7" stroke="#6e8596"/><path d="M-20-8h40M-20 8h40M-8-18v36M8-18v36" stroke="#c3ced6" stroke-width="2"/>');
  drawing += piece(level.exit, `<rect x="-23" y="-23" width="46" height="46" rx="4" fill="#e4eee9" stroke="#71998a" stroke-width="1.5" stroke-dasharray="4 3"/><path d="M-10 0h20M-3-7l-7 7 7 7" stroke="#236c60" stroke-width="2" fill="none"/>${label(0, 39, '人员出口')}`);
  drawing += piece(level.dock, `<rect x="-25" y="-23" width="50" height="46" rx="3" fill="#e6edf2" stroke="#7e99ad" stroke-width="1.5"/><path d="M-16-9h32v19h-32Z" fill="none" stroke="#9fb2c0" stroke-dasharray="4 3"/>${label(0, 39, '核心接收区')}`);
  drawing += piece(level.loadSlot, `<rect x="-25" y="-25" width="50" height="50" rx="2" fill="none" stroke="#b68735" stroke-width="2" stroke-dasharray="4 3"/>${label(0, 42, '吊装区')}`);
  drawing += piece(level.crane, `<path d="M-18 17V-19h36M-18-19 18-12M12-16v24l-6 5 6 4 6-4" fill="none" stroke="${powered(state, level, 'crane') ? '#175ea8' : '#7e8f9c'}" stroke-width="3"/>${label(0, 37, '起重机')}`);
  if (!state.cart.loaded) drawing += piece(level.core, `<path d="m0-14 15 8v17L0 19-15 11V-6Z" fill="#e4bf70" stroke="#946000" stroke-width="1.5"/><path d="m-15-6 15 8 15-8M0 2v17" stroke="#946000" fill="none"/>${label(0, 36, '核心')}`);
  if (level.lever) drawing += piece(level.lever, `<rect x="-17" y="-16" width="34" height="32" rx="4" fill="${state.gateOpen ? '#d4e7dd' : '#f1e5c8'}" stroke="${state.gateOpen ? '#236c60' : '#946000'}" stroke-width="1.5"/><path d="M0 8V-4l${state.gateOpen ? '9-7' : '-9-7'}" stroke="#536e7b" stroke-width="3" fill="none"/><circle cx="${state.gateOpen ? 9 : -9}" cy="-11" r="4" fill="${state.gateOpen ? '#236c60' : '#946000'}"/>${label(0, 34, '维修开关')}`);
  for (const socket of level.sockets) {
    const installed = state.battery?.socketId === socket.id;
    drawing += piece(socket.at, `<rect x="-20" y="-19" width="40" height="38" rx="4" fill="${installed ? '#e5edce' : '#e6e9e4'}" stroke="${installed ? '#6b813e' : '#9aa99b'}" stroke-width="1.5"/>${installed ? batterySymbol() : '<path d="M-7-5v9M7-5v9M-11 10h22" stroke="#7d8e7d" stroke-width="2"/>'}${label(0, 34, socket.name, 'map-caption')}`);
  }
  if (state.battery?.at) drawing += piece(state.battery.at, `${batterySymbol()}${label(0, 29, '备用电池', 'map-caption')}`);
  for (const at of state.boxes) drawing += piece(at, `<rect x="-20" y="-21" width="40" height="42" rx="2" fill="#d5c5a6" stroke="#8c7652" stroke-width="2"/><path d="m-16-16 32 32m0-32-32 32M-17-17h34v34h-34Z" stroke="#a28b65" stroke-width="2" fill="none"/>${label(0, 35, same(at, level.wedge) ? '支撑就位' : '支撑箱', 'map-caption')}`);
  if (level.wedge && !wedged(state, level)) drawing += piece(level.wedge, '<rect x="-19" y="-19" width="38" height="38" fill="none" stroke="#946000" stroke-dasharray="3 3"/><text y="4" text-anchor="middle" font-size="10" fill="#775019">支撑位</text>');
  drawing += piece(state.cart, `<rect x="-23" y="-14" width="46" height="30" rx="4" fill="${state.cart.delivered ? '#d6e6de' : '#b4c4d0'}" stroke="#476375" stroke-width="2"/><circle cx="-14" cy="18" r="4" fill="#476375"/><circle cx="14" cy="18" r="4" fill="#476375"/>${state.cart.loaded ? '<path d="m0-23 13 6v15L0 5-13-2v-15Z" fill="#e4bf70" stroke="#946000" stroke-width="1.5"/><path d="m-13-17 13 6 13-6M0-11V5" stroke="#946000" fill="none"/>' : '<path d="M-14-7h28M-14 1h28" stroke="#dbe5ed" stroke-width="2"/>'}${label(0, 38, state.cart.delivered ? '核心已抵达' : state.cart.loaded ? '已装载' : '运输车', 'map-caption')}`);
  const robotCenter = center(state.robot);
  drawing += `<g class="robot-piece" transform="translate(${robotCenter.x} ${robotCenter.y})"><ellipse cy="21" rx="19" ry="5" fill="#20334220"/><rect x="-18" y="-18" width="36" height="36" rx="10" fill="#236c60" stroke="#174b43" stroke-width="2"/><rect x="-12" y="-11" width="24" height="15" rx="5" fill="#e9f5f0"/><path d="M-7-4h4M3-4h4M-6 11H6" stroke="#236c60" stroke-width="2"/>${state.battery?.carried ? '<rect x="13" y="4" width="13" height="18" rx="2" fill="#f4dfaa" stroke="#946000" stroke-width="1.5"/>' : ''}</g>`;
  let highlightPositions = [];
  if (spotlight === 'bridge') highlightPositions = level.bridges;
  if (spotlight === 'gate') highlightPositions = level.gates;
  if (spotlight === 'crane') highlightPositions = [level.crane, level.loadSlot];
  if (spotlight === 'rail') highlightPositions = [state.cart, level.dock];
  for (const at of highlightPositions) drawing += piece(at, '<rect x="-27" y="-27" width="54" height="54" rx="4" fill="none" stroke="#175ea8" stroke-width="2.5"/>');
  if (selected) drawing += piece(selected, '<path d="M-25-15v-10h10M15-25h10v10M25 15v10H15M-15 25h-10V15" stroke="#175ea8" stroke-width="2" fill="none"/>');
  if (ping) {
    const at = center(ping.at);
    const x = Math.max(100, Math.min(654, at.x));
    const y = at.y < 115 ? at.y + 47 : at.y - 41;
    drawing += `<path d="M${x} ${y}L${at.x} ${at.y}" stroke="#175ea8" stroke-width="1.5" stroke-dasharray="3 3"/><rect x="${x - 64}" y="${y - 14}" width="128" height="28" rx="5" fill="#175ea8"/><text x="${x}" y="${y + 5}" fill="white" text-anchor="middle" font-size="12">${esc(ping.text)}</text>`;
  }
  drawing += label(64, 499, '上方为高架货轨；机器人只走有地板的格子。', 'map-caption', 'start');
  svg.querySelector('#map-content').innerHTML = drawing;
  svg.querySelector('#map-title').textContent = `${level.name}设施地图`;
  svg.querySelector('#map-description').textContent = `${describeState(state, level)} 西侧是出口，东侧是仓库，中间沟槽通过电桥或下方通道连接。点击地图只选择标记位置，方向键移动。`;
}
