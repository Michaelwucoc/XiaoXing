export const clone = (value) => JSON.parse(JSON.stringify(value));

export function createState(level) {
  return {
    levelId: level.id,
    robot: { ...level.start },
    power: null,
    gateOpen: false,
    battery: level.battery ? { at: { ...level.battery }, carried: false, socketId: null } : null,
    boxes: level.boxes.map((box) => ({ ...box })),
    cart: { ...level.cart, loaded: false, delivered: false },
    route: level.routes[0].id,
    paused: false,
    won: false,
    steps: 0,
    event: '先观察设施。你们可以慢慢商量，也可以直接标记想法。',
  };
}
