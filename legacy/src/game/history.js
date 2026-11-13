import { createState } from './state.js';
import { transition } from './rules.js';

export function createSession(level) {
  let state = createState(level);
  let past = [];
  return {
    get state() { return state; },
    get canUndo() { return past.length > 0 && !state.paused && !state.won; },
    dispatch(action) {
      if (action?.type === 'undo') {
        if (!past.length || state.paused || state.won) return { ok: false, state, message: '当前没有可以撤销的操作。' };
        state = past.pop();
        return { ok: true, state, message: '已撤销上一步，所有设备与物品同步恢复。' };
      }
      const result = transition(state, level, action);
      if (result.ok) {
        if (result.record) past.push(state);
        state = result.state;
      }
      return result;
    },
    reset() {
      state = createState(level);
      past = [];
      return state;
    },
  };
}
