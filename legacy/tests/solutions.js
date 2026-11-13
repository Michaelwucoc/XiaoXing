export const move = (direction, count = 1) => Array.from({ length: count }, () => ({ type: 'move', direction }));
const power = (device) => ({ type: 'power', device });
const action = (type, extra = {}) => ({ type, ...extra });

export const solutions = {
  transfer: [
    power('bridge'), ...move('up', 2), ...move('right', 7),
    ...move('down', 2), ...move('left'), action('open-gate'),
    ...move('up', 2), ...move('right'), power('crane'), action('load'),
    power('rail'), action('ship'), ...move('down', 4), ...move('left', 7), ...move('up', 2),
  ],
  reserveBridge: [
    action('take-battery'), power('bridge'), ...move('up', 3), ...move('right', 6), ...move('down', 2),
    action('insert-battery', { socketId: 'bridge-socket' }), ...move('up'), ...move('right'),
    power('crane'), action('load'), action('route', { route: 'direct' }), power('rail'), action('ship'),
    ...move('down', 3), ...move('left', 7), ...move('up'),
  ],
  reserveCrane: [
    action('take-battery'), power('bridge'), ...move('up', 3), ...move('right', 6), ...move('down', 2), ...move('right', 2),
    action('insert-battery', { socketId: 'crane-socket' }), ...move('left', 2), ...move('up'), ...move('right'),
    action('load'), action('route', { route: 'direct' }), power('rail'), action('ship'), power('bridge'),
    ...move('down', 3), ...move('left', 7), ...move('up'),
  ],
  bypassBox: [
    power('gate'), ...move('down'), ...move('right', 3), ...move('down'), ...move('right', 3),
    ...move('up', 4), ...move('right'), power('crane'), action('load'), power('rail'), action('ship'),
    ...move('down', 4), ...move('left', 7), ...move('up', 2),
  ],
  bypassBattery: [
    ...move('up', 2), action('take-battery'), power('bridge'), ...move('up'), ...move('right', 6), ...move('down', 2),
    action('insert-battery', { socketId: 'bridge-socket' }), ...move('up'), ...move('right'),
    power('crane'), action('load'), power('rail'), action('route', { route: 'bypass' }), action('ship'),
    ...move('up'), ...move('left', 6), ...move('down', 3), ...move('left'),
  ],
  bypassGateBattery: [
    ...move('up', 2), action('take-battery'), ...move('down'), ...move('right', 2),
    action('insert-battery', { socketId: 'gate-socket' }), ...move('left'), ...move('down', 3), ...move('right', 5),
    ...move('up', 4), ...move('right'), power('crane'), action('load'), power('rail'), action('ship'),
    ...move('down', 4), ...move('left', 7), ...move('up', 2),
  ],
};
