const movement = { arrowup: 'up', w: 'up', arrowdown: 'down', s: 'down', arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right' };

export function actionForKey(event, devices = [], routes = [], currentRoute = '') {
  if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return null;
  const key = event.key.toLowerCase();
  if (movement[key]) return { type: 'move', direction: movement[key] };
  if (event.repeat) return null;
  if (key === 'e' || key === 'enter' && event.target?.tagName === 'svg') return { type: 'primary' };
  if (key === 'z') return { type: 'undo' };
  if (key === 'escape' || key === 'p') return { type: 'rest' };
  if (key === 'r' && routes.length > 1) {
    const index = routes.findIndex((route) => route.id === currentRoute);
    return { type: 'route', route: routes[(index + 1) % routes.length].id };
  }
  const number = Number(key);
  if (number >= 1 && number <= devices.length) return { type: 'power', device: devices[number - 1] };
  return null;
}

export function installKeyboard({ getContext, onAction, root = document }) {
  let lastMove = 0;
  const handler = (event) => {
    const target = event.target;
    if (target?.matches?.('input, textarea, select, [contenteditable="true"]') || getContext().blocked) return;
    const context = getContext();
    const action = actionForKey(event, context.devices, context.routes, context.route);
    if (!action) return;
    event.preventDefault();
    if (action.type === 'move') {
      const now = performance.now();
      if (event.repeat && now - lastMove < 160) return;
      lastMove = now;
    }
    onAction(action);
  };
  root.addEventListener('keydown', handler);
  return () => root.removeEventListener('keydown', handler);
}
