import { clone } from './state.js';
import { key, deviceInfo } from './levels.js';

export const same = (a, b) => Boolean(a && b && a.x === b.x && a.y === b.y);
export const distance = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
export const near = (a, b) => Boolean(a && b && distance(a, b) <= 1);
export const atAny = (at, positions) => positions.some((position) => same(at, position));

export function powered(state, level, device) {
  if (state.power === device) return true;
  const socket = level.sockets.find((item) => item.id === state.battery?.socketId);
  return socket?.device === device;
}

export const wedged = (state, level) => Boolean(level.wedge && atAny(level.wedge, state.boxes));
export const gateIsOpen = (state, level) => level.gateKind === 'latch'
  ? state.gateOpen
  : level.gateKind === 'powered' && (powered(state, level, 'gate') || wedged(state, level));

export function terrainError(state, level, at) {
  if (!level.floor.some((floor) => same(floor, at))) return '这里没有可通行的地面。';
  if (atAny(at, level.shelves)) return '这里是固定货架，请换一条路。';
  if (atAny(at, level.bridges) && !powered(state, level, 'bridge')) return '电桥尚未供电。请在调度台给电桥供电。';
  if (atAny(at, level.gates) && !gateIsOpen(state, level)) return level.gateKind === 'latch'
    ? '维修通道未开启。需要从东侧操作维修开关。'
    : '隔离门关闭。供电、备用电池或支撑箱都能使它保持开启。';
  if (same(at, level.core) && !state.cart.loaded) return '核心太重，不能直接搬运。用起重机装到运输车上。';
  return null;
}

function safetyError(state, next, level) {
  const occupied = [next.robot, ...next.boxes];
  if (powered(state, level, 'bridge') && !powered(next, level, 'bridge') && occupied.some((at) => atAny(at, level.bridges))) {
    return '桥上仍有机器人或箱子，不能撤掉最后一份电力。先离开桥面。';
  }
  if (gateIsOpen(state, level) && !gateIsOpen(next, level) && occupied.some((at) => atAny(at, level.gates))) {
    return '门口仍有机器人或箱子，不能关闭隔离门。先离开通道。';
  }
  return null;
}

function mutate(state, level, action) {
  switch (action.type) {
    case 'move': {
      const vectors = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
      const vector = vectors[action.direction];
      if (!vector) return '未知的移动方向。';
      const target = { x: state.robot.x + vector[0], y: state.robot.y + vector[1] };
      const error = terrainError(state, level, target);
      if (error) return error;
      const boxIndex = state.boxes.findIndex((box) => same(box, target));
      const cartThere = same(target, state.cart);
      if (boxIndex >= 0 || cartThere) {
        if (cartThere && state.cart.loaded) return '运输车已装载，不能手推。请为货轨供电并发车。';
        const beyond = { x: target.x + vector[0], y: target.y + vector[1] };
        if (cartThere && !(same(beyond, level.cart) || same(beyond, level.loadSlot))) return '空车只能沿吊装位的短轨道左右移动。';
        const blocked = terrainError(state, level, beyond);
        if (blocked || atAny(beyond, state.boxes) || same(beyond, state.cart)) return '前方没有足够空间推动，请从另一侧尝试。';
        if (boxIndex >= 0) state.boxes[boxIndex] = beyond;
        else Object.assign(state.cart, beyond);
        state.event = boxIndex >= 0
          ? (same(beyond, level.wedge) ? '支撑箱就位。隔离门的下方人行口现在无需电力也能开启。' : '支撑箱向前移动了一格。')
          : '运输车推入吊装区。给起重机供电，就可以装载核心。';
      } else {
        state.event = same(target, level.exit) ? '机器人已到出口。还需要让数据核心也到达西侧。' : '机器人移动了一格。';
      }
      state.robot = target;
      return null;
    }
    case 'power': {
      if (!level.devices.includes(action.device)) return '这间设施里没有该设备。';
      if (state.power === action.device) return '主电源已经接到这里。';
      state.power = action.device;
      state.event = `主电源已接到${deviceInfo[action.device].name}。其他设备可由备用电池继续供电。`;
      return null;
    }
    case 'open-gate': {
      if (level.gateKind !== 'latch' || !near(state.robot, level.lever)) return '请先移动到东侧维修开关旁。';
      if (state.gateOpen) return '维修通道已经开启。';
      state.gateOpen = true;
      state.event = '维修通道已开启。这条返回路线不需要电力。';
      return null;
    }
    case 'take-battery': {
      if (!state.battery || state.battery.carried) return '目前没有可以拿起的备用电池。';
      const socket = level.sockets.find((item) => item.id === state.battery.socketId);
      const location = socket?.at || state.battery.at;
      if (!near(state.robot, location)) return '请先移动到电池或插座旁。';
      state.battery = { at: null, carried: true, socketId: null };
      state.event = '已拿起备用电池。带到插座旁，即可为对应设备保留电力。';
      return null;
    }
    case 'drop-battery': {
      if (!state.battery?.carried) return '机器人没有携带电池。';
      state.battery = { carried: false, socketId: null, at: { ...state.robot } };
      state.event = '电池留在脚下，可随时重新拿起。';
      return null;
    }
    case 'insert-battery': {
      const socket = level.sockets.find((item) => item.id === action.socketId);
      if (!socket || !near(state.robot, socket.at)) return '请先走到对应插座旁。';
      if (!state.battery?.carried) return '需要先拿起备用电池。';
      state.battery = { carried: false, at: null, socketId: socket.id };
      state.event = `电池已插入${socket.name}。主电源可以调去别处。`;
      return null;
    }
    case 'load': {
      if (!near(state.robot, state.cart)) return '现场操作员需要站在运输车旁确认吊装。';
      if (state.cart.loaded) return '核心已经装载。';
      if (!same(state.cart, level.loadSlot)) return '先从运输车左侧向右推一格，让车停进吊装区。';
      if (!powered(state, level, 'crane')) return '起重机尚未供电。请先分配电力。';
      state.cart.loaded = true;
      state.event = '核心已装载。检查分轨与供电，再由现场操作员确认发车。';
      return null;
    }
    case 'route': {
      if (!level.routes.some((route) => route.id === action.route)) return '未知的货运路线。';
      if (state.route === action.route) return '分轨已经指向这条路线。';
      state.route = action.route;
      state.event = `分轨已设为${level.routes.find((route) => route.id === action.route).name}。`;
      return null;
    }
    case 'ship': {
      if (!near(state.robot, state.cart)) return '现场操作员需要站在运输车旁确认发车。';
      if (!state.cart.loaded) return '先用起重机装载核心。';
      if (state.cart.delivered) return '核心已经抵达出口。';
      if (!powered(state, level, 'rail')) return '货运轨道尚未供电。';
      if (level.id === 'bypass') {
        if (state.route === 'direct' && !gateIsOpen(state, level)) return '直达线的隔离门未开启。给门留一块电池，或把箱子放在支撑位。';
        if (state.route === 'bypass' && !powered(state, level, 'bridge')) return '旁路线经过电桥，需要为桥保留一份独立电力。';
      }
      if (state.route === 'buffer') {
        if (same(state.cart, level.buffer)) return '运输车已在缓存位。将分轨改为出口，就能继续发车。';
        Object.assign(state.cart, level.buffer);
        state.event = '核心抵达东侧缓存位。它还没到出口；可切换分轨，走到车旁再次发车。';
      } else {
        Object.assign(state.cart, level.dock, { delivered: true });
        state.event = '数据核心抵达西侧。现在让机器人也回到出口。';
      }
      return null;
    }
    default: return '未知操作，关卡没有改变。';
  }
}

export function transition(state, level, action) {
  if (!action || typeof action !== 'object') return { ok: false, state, message: '无效操作。' };
  if (action.type === 'pause') {
    const next = clone(state);
    next.paused = Boolean(action.value);
    return { ok: true, state: next, message: next.paused ? '已暂停。局面会留在这里。' : '已继续。按自己的节奏来。', record: false };
  }
  if (state.paused) return { ok: false, state, message: '游戏已暂停。继续后再操作。' };
  if (state.won) return { ok: false, state, message: '本关已完成，可以重玩或进入下一关。' };
  const next = clone(state);
  const error = mutate(next, level, action) || safetyError(state, next, level);
  if (error) return { ok: false, state, message: error };
  next.steps++;
  next.won = next.cart.delivered && same(next.robot, level.exit);
  if (next.won) next.event = '核心与机器人均已抵达。你们找到了让两条轨道相遇的方法。';
  return { ok: true, state: next, message: next.event, record: true };
}

export function interactionOptions(state, level) {
  const candidates = [];
  if (level.lever && near(state.robot, level.lever) && !state.gateOpen) candidates.push({ title: '打开维修通道', target: level.lever, action: { type: 'open-gate' } });
  if (state.battery) {
    const socket = level.sockets.find((item) => item.id === state.battery.socketId);
    if (!state.battery.carried && near(state.robot, socket?.at || state.battery.at)) candidates.push({ title: socket ? '取出备用电池' : '拿起备用电池', target: socket?.at || state.battery.at, action: { type: 'take-battery' } });
    if (state.battery.carried) {
      for (const item of level.sockets.filter((item) => near(state.robot, item.at))) candidates.push({ title: `插入${item.name}`, target: item.at, action: { type: 'insert-battery', socketId: item.id } });
      candidates.push({ title: '放下备用电池', target: state.robot, action: { type: 'drop-battery' } });
    }
  }
  if (near(state.robot, state.cart) && !state.cart.delivered) candidates.push({ title: state.cart.loaded ? '确认发车' : '装载核心', target: state.cart, action: { type: state.cart.loaded ? 'ship' : 'load' } });
  return candidates.map((item) => {
    const result = transition(state, level, item.action);
    return { ...item, enabled: result.ok, reason: result.ok ? null : result.message };
  });
}

export function objective(state, level) {
  if (state.won) return '核心与机器人均已抵达';
  if (state.cart.delivered) return '让机器人返回西侧出口';
  if (state.cart.loaded) return state.route === 'buffer' ? '选择出口路线，再确认发车' : '检查货轨供电，在车旁确认发车';
  if (same(state.cart, level.loadSlot)) return '给起重机供电，在车旁装载核心';
  return level.id === 'transfer' && !state.gateOpen ? '进入东侧，打开维修通道' : '规划供电，将运输车推入吊装区';
}

export function describeState(state, level) {
  const location = `机器人位于第 ${state.robot.x + 1} 列、第 ${state.robot.y + 1} 行`;
  const devices = level.devices.filter((device) => powered(state, level, device)).map((device) => deviceInfo[device].name);
  return `${location}。供电设备：${devices.join('、') || '无'}。${objective(state, level)}。`;
}
