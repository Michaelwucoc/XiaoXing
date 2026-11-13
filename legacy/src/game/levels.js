const point = (x, y) => ({ x, y });
export const key = ({ x, y }) => `${x},${y}`;

function makeLevel(config) {
  const floor = [];
  for (let y = 1; y <= 7; y++) {
    for (let x = 1; x <= 11; x++) {
      if (x !== 6) floor.push(point(x, y));
    }
  }
  floor.push(...config.bridges, ...config.gates);
  return {
    width: 13, height: 9, floor,
    start: point(2, 5), exit: point(2, 5), dock: point(2, 3),
    cart: point(9, 3), loadSlot: point(10, 3), core: point(11, 3),
    crane: point(11, 2), buffer: point(11, 6),
    shelves: [point(2, 1), point(3, 1), point(4, 1), point(9, 1), point(10, 1)],
    ...config,
  };
}

export const levels = [
  makeLevel({
    id: 'transfer', number: '01', name: '断电中转站', theme: '跨越，然后留下另一条路。',
    description: '一份电力，三台设备。把核心送回西侧，再让机器人回到出口。',
    mechanic: '共享电源 · 维修通道',
    bridges: [point(6, 3)], gates: [point(6, 7)],
    gateKind: 'latch', lever: point(8, 6),
    devices: ['bridge', 'crane', 'rail'], sockets: [], battery: null, boxes: [],
    routes: [{ id: 'direct', name: '出口直达', description: '沿高架货轨，将核心送到西侧。' }],
    hints: [
      '先给电桥供电。机器人从上方的电桥进入东侧仓库。',
      '从东侧启动维修开关，打开下方不需要电力的返回通道。把运输车向右推一格，停进吊装区。',
      '机器人站在运输车旁：起重机供电后装载核心，再切换货轨供电并发车。机器人从下方通道回到出口。',
    ],
  }),
  makeLevel({
    id: 'reserve', number: '02', name: '双路供电', theme: '电力放在哪里，路就长在哪里。',
    description: '带上一块备用电池。桥和起重机，哪一个值得留下一份独立电力？',
    mechanic: '备用电池 · 双向货轨',
    bridges: [point(6, 2), point(6, 6)], gates: [], gateKind: null, lever: null,
    devices: ['bridge', 'crane', 'rail'], battery: point(3, 5), boxes: [],
    sockets: [
      { id: 'bridge-socket', at: point(8, 5), device: 'bridge', name: '电桥插座' },
      { id: 'crane-socket', at: point(10, 5), device: 'crane', name: '起重机插座' },
    ],
    routes: [
      { id: 'buffer', name: '东侧缓存', description: '先送到东侧缓存位；仍可重新发往出口。' },
      { id: 'direct', name: '出口直达', description: '切换分轨，送往西侧出口。' },
    ],
    hints: [
      '先在出口旁拿起备用电池，再给桥供电。上下两座桥都能通行。',
      '电池可以放进东侧任一插座。给桥留电，便于返程；给起重机留电，则能把主电源用在别处。两种方法都成立。',
      '将运输车向右推入吊装位并装载。把分轨改为“出口直达”，给货轨供电后发车。最后保证电桥有电，回到西侧出口。',
    ],
  }),
  makeLevel({
    id: 'bypass', number: '03', name: '旁路计划', theme: '看起来是障碍，也可能是一把钥匙。',
    description: '直达线穿过隔离门，旁路线借道电桥。你们决定用电池，还是用一个箱子。',
    mechanic: '机械支撑 · 两条运输路线',
    bridges: [point(6, 2)], gates: [point(6, 6), point(6, 7)],
    gateKind: 'powered', lever: null, wedge: point(6, 6),
    devices: ['bridge', 'gate', 'crane', 'rail'], battery: point(3, 3),
    boxes: [point(4, 6)],
    sockets: [
      { id: 'gate-socket', at: point(4, 5), device: 'gate', name: '隔离门插座' },
      { id: 'bridge-socket', at: point(8, 5), device: 'bridge', name: '电桥插座' },
    ],
    routes: [
      { id: 'direct', name: '隔离门直达', description: '隔离门必须保持开启。箱子支撑或备用电池都可以。' },
      { id: 'bypass', name: '电桥旁路', description: '电桥必须保持供电，货轨才能通过旁路线。' },
    ],
    hints: [
      '直达线经过下方隔离门；旁路线经过上方电桥。货轨运作时，它经过的设施也要保持可用。',
      '一种方法：隔离门供电，将箱子推到门上方的支撑位，下方人行口就能保持开启。另一种方法：带电池过桥，放进电桥插座，走旁路线。',
      '箱子路线：从箱子左侧向右推两格，把箱子留在支撑位，走下方门口。电池路线：从上桥携电池进入东侧，为电桥留电。两条路线最后都需要起重机装载、货轨发车、机器人返程。',
    ],
  }),
];

export const deviceInfo = {
  bridge: { name: '电桥', short: '桥', detail: '为跨越沟槽的桥面供电。断电前，桥上必须无人、无箱。' },
  gate: { name: '隔离门', short: '门', detail: '开启下方双通道。支撑位留有箱子时，断电也能保持开启。' },
  crane: { name: '起重机', short: '吊', detail: '运输车位于吊装区、机器人在车旁时，可装载核心。' },
  rail: { name: '货运轨道', short: '轨', detail: '为已装载的运输车供电。现场操作员在车旁确认发车。' },
};

export const getLevel = (id) => levels.find((level) => level.id === id) || levels[0];
