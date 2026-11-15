// Campaign: 5 chapters x 6 nights. Levels are hand-placed with a tiny builder.
// World is 360 units wide; y grows downward (the fall). The flake starts
// around y = 240 and lands at y = length - 30.

export const CHAPTERS = [
  { id: 1, key: 'cimes', theme: 'peaks' },
  { id: 2, key: 'foret', theme: 'forest' },
  { id: 3, key: 'village', theme: 'village' },
  { id: 4, key: 'blizzard', theme: 'blizzard' },
  { id: 5, key: 'aurore', theme: 'aurora' },
];

function level(id, opts, build) {
  const [ch, idx] = id.split('-').map(Number);
  const def = {
    id,
    chapter: ch,
    index: idx,
    theme: CHAPTERS[ch - 1].theme,
    length: opts.length,
    speed: opts.speed,
    startX: opts.startX ?? 180,
    landing: opts.landing ?? { x: 180, w: 100, kind: 'mitten' },
    objectives: opts.objectives,
    target: opts.target ?? null,
    zones: [],
    hazards: [],
    shards: [],
    winds: [],
    drafts: [],
    obstacles: [],
    hints: [],
  };
  const b = {
    z(type, x, y, rx, ry, extra = {}) {
      def.zones.push({ type, x, y, rx, ry, ...extra });
      return b;
    },
    shard(...pts) {
      for (let i = 0; i < pts.length; i += 2) def.shards.push({ x: pts[i], y: pts[i + 1] });
      return b;
    },
    pellets(from, to, every, extra = {}) {
      def.hazards.push({ type: 'pellet', from, to, every, ...extra });
      return b;
    },
    hail(from, to, every, extra = {}) {
      def.hazards.push({ type: 'hail', from, to, every, ...extra });
      return b;
    },
    flakes(from, to, every, extra = {}) {
      def.hazards.push({ type: 'flake', from, to, every, ...extra });
      return b;
    },
    twin(at, x) {
      def.hazards.push({ type: 'flake', at, x, twin: true, size: [10, 11], slow: 0.55 });
      return b;
    },
    bird(at, dir, speed = 95) {
      def.hazards.push({ type: 'bird', at, dir, speed });
      return b;
    },
    wind(from, to, dir, power, gust) {
      def.winds.push({ from, to, dir, power, gust });
      return b;
    },
    draft(x, y, rx, ry, power) {
      def.drafts.push({ x, y, rx, ry, power });
      return b;
    },
    branch(x1, y1, x2, y2, r = 5) {
      def.obstacles.push({ x1, y1, x2, y2, r });
      return b;
    },
    hint(trigger, key, dur) {
      if (typeof trigger === 'number') def.hints.push({ at: trigger, key, dur });
      else def.hints.push({ on: trigger, key, dur });
      return b;
    },
  };
  build(b, def);
  return def;
}

const L = (kind, x = 180, w = 100) => ({ kind, x, w });

export const LEVELS = [
  // ------------------------------------------------------------ Les Cimes
  level('1-1', {
    length: 3000,
    speed: 58,
    landing: L('mitten', 180, 120),
    objectives: [{ kind: 'land' }, { kind: 'shards', n: 3 }, { kind: 'size', mm: 4 }],
  }, (b) => {
    b.hint(0, 'hint.steer', 5)
      .hint('zone:brume', 'hint.brume')
      .hint(620, 'hint.motes')
      .hint('shard', 'hint.shard')
      .hint('final', 'hint.final');
    b.z('brume', 180, 560, 120, 170)
      .z('brume', 105, 1040, 85, 150)
      .z('brume', 258, 1420, 90, 150)
      .z('brume', 170, 1930, 125, 210);
    b.shard(105, 860, 262, 1260, 180, 1700, 110, 2230, 250, 2330);
  }),

  level('1-2', {
    length: 3200,
    speed: 60,
    landing: L('mitten', 200, 110),
    objectives: [{ kind: 'land' }, { kind: 'type', type: ['plate', 'sectored'] }, { kind: 'shards', n: 4 }],
  }, (b) => {
    b.hint('zone:sec', 'hint.sec').hint(250, 'hint.choose', 5);
    b.z('sec', 180, 560, 120, 160)
      .z('brume', 92, 1030, 78, 140)
      .z('sec', 272, 1030, 80, 140)
      .z('sec', 175, 1540, 115, 170)
      .z('brume', 285, 1990, 70, 130)
      .z('sec', 120, 2040, 95, 150)
      .z('sec', 230, 2470, 85, 110);
    b.shard(180, 780, 272, 1230, 60, 1300, 175, 1760, 300, 2240, 120, 2300);
  }),

  level('1-3', {
    length: 3400,
    speed: 60,
    landing: L('mitten', 150, 110),
    objectives: [{ kind: 'land' }, { kind: 'type', type: 'stellar_plate' }, { kind: 'beauty', n: 650 }],
  }, (b) => {
    b.hint(80, 'hint.order', 6);
    b.z('brume', 140, 540, 110, 180)
      .z('brume', 235, 1080, 100, 175)
      .z('sec', 95, 1560, 80, 140)
      .z('brume', 270, 1560, 75, 130)
      .z('sec', 200, 2060, 120, 170)
      .z('sec', 120, 2500, 90, 120);
    b.shard(140, 820, 300, 1300, 60, 1760, 200, 2280, 260, 2560);
  }),

  level('1-4', {
    length: 3600,
    speed: 61,
    landing: L('mitten', 210, 100),
    objectives: [{ kind: 'land' }, { kind: 'intact' }, { kind: 'size', mm: 5 }],
  }, (b) => {
    b.hint(360, 'hint.pellet', 5).hint('hit', 'hint.hit');
    b.z('brume', 180, 600, 115, 170)
      .z('sec', 95, 1120, 80, 140)
      .z('brume', 262, 1180, 88, 160)
      .z('brume', 150, 1720, 110, 190)
      .z('sec', 250, 2240, 95, 150)
      .z('brume', 120, 2650, 90, 130);
    b.pellets(300, 1300, 2.4, { x: [30, 330] }).pellets(1300, 3000, 1.9, { x: [30, 330] });
    b.shard(180, 900, 262, 1420, 60, 1500, 150, 2000, 290, 2480, 110, 2880);
  }),

  level('1-5', {
    length: 3700,
    speed: 60,
    landing: L('mitten', 180, 110),
    target: [['plate', 4.2, 0.75], ['dendrite', 18, 0.75], ['plate', 6, 0.75]],
    objectives: [{ kind: 'land' }, { kind: 'match', pct: 70 }, { kind: 'match', pct: 88 }],
  }, (b) => {
    b.hint(0, 'hint.target', 7);
    b.z('sec', 180, 480, 110, 125)
      .z('brume', 125, 960, 105, 210)
      .z('sec', 295, 1060, 55, 120)
      .z('brume', 235, 1500, 105, 220)
      .z('sec', 65, 1760, 55, 140)
      .z('brume', 130, 1990, 80, 120)
      .z('sec', 200, 2330, 125, 170)
      .z('brume', 175, 2800, 100, 110);
    b.pellets(1200, 2700, 2.4);
    b.shard(180, 720, 295, 1270, 125, 1250, 65, 1950, 200, 2560);
  }),

  level('1-6', {
    length: 4000,
    speed: 62,
    landing: L('mitten', 120, 95),
    objectives: [{ kind: 'land' }, { kind: 'beauty', n: 950 }, { kind: 'shards', n: 6 }],
  }, (b) => {
    b.z('sec', 180, 560, 100, 130)
      .z('brume', 85, 1000, 75, 160)
      .z('brume', 275, 1040, 75, 160)
      .z('sec', 180, 1480, 90, 150)
      .z('brume', 100, 1960, 95, 180)
      .z('brume', 270, 2300, 85, 170)
      .z('sec', 150, 2800, 115, 150)
      .z('sec', 260, 3150, 70, 90);
    b.pellets(400, 1500, 1.7).pellets(1500, 3300, 1.25, { x: 'aim' });
    b.shard(180, 800, 50, 1180, 310, 1230, 180, 1690, 100, 2160, 300, 2520, 150, 3020, 40, 3150);
  }),

  // ------------------------------------------------------------- La Forêt
  level('2-1', {
    length: 3600,
    speed: 62,
    landing: L('scarf', 200, 100),
    objectives: [{ kind: 'land' }, { kind: 'type', type: 'needle_star' }, { kind: 'shards', n: 5 }],
  }, (b) => {
    b.hint('zone:froid', 'hint.froid');
    b.z('froid', 180, 560, 115, 170)
      .z('brume', 80, 1080, 70, 150)
      .z('froid', 250, 1100, 95, 170)
      .z('froid', 130, 1640, 100, 170)
      .z('sec', 290, 1700, 60, 120)
      .z('froid', 220, 2200, 110, 180)
      .z('brume', 120, 2700, 85, 110);
    b.pellets(1500, 3000, 1.9);
    b.shard(180, 800, 250, 1350, 40, 1250, 130, 1880, 300, 1900, 220, 2450, 120, 2850);
  }),

  level('2-2', {
    length: 3700,
    speed: 63,
    landing: L('scarf', 160, 100),
    objectives: [{ kind: 'land' }, { kind: 'type', type: 'rimed' }, { kind: 'size', mm: 5 }],
  }, (b) => {
    b.hint('zone:givre', 'hint.givre');
    b.z('brume', 180, 560, 110, 160)
      .z('givre', 110, 1050, 85, 150)
      .z('froid', 270, 1060, 75, 150)
      .z('givre', 200, 1560, 110, 170)
      .z('brume', 100, 2050, 90, 160)
      .z('givre', 260, 2350, 90, 150)
      .z('sec', 160, 2800, 100, 110);
    b.pellets(800, 3100, 1.8);
    b.shard(180, 820, 110, 1300, 270, 1300, 200, 1800, 100, 2300, 300, 2600, 160, 3000);
  }),

  level('2-3', {
    length: 3800,
    speed: 63,
    landing: L('scarf', 250, 90),
    objectives: [{ kind: 'land' }, { kind: 'intact' }, { kind: 'beauty', n: 900 }],
  }, (b, d) => {
    b.hint(d.length - 1100, 'hint.branches', 5);
    b.z('froid', 140, 560, 100, 150)
      .z('brume', 245, 1000, 95, 170)
      .z('sec', 110, 1480, 85, 150)
      .z('brume', 230, 1900, 110, 190)
      .z('givre', 120, 2400, 80, 110)
      .z('brume', 220, 2700, 90, 120);
    b.pellets(600, 2600, 2.2);
    b.bird(2300, 1, 90).bird(2900, -1, 100);
    const g = d.length;
    b.branch(0, g - 340, 150, g - 310, 5)
      .branch(360, g - 250, 300, g - 235, 5)
      .branch(0, g - 170, 105, g - 145, 4);
    b.shard(140, 800, 245, 1260, 110, 1700, 230, 2150, 60, 2600, 300, g - 280);
  }),

  level('2-4', {
    length: 3800,
    speed: 64,
    landing: L('scarf', 140, 100),
    objectives: [{ kind: 'land' }, { kind: 'type', type: 'fernlike' }, { kind: 'shards', n: 6 }],
  }, (b) => {
    b.hint(150, 'hint.dense', 6);
    b.z('brume', 180, 580, 120, 170, { density: 1 })
      .z('brume', 95, 1120, 80, 170, { density: 1 })
      .z('brume', 265, 1160, 80, 160, { density: 0.6 })
      .z('froid', 180, 1640, 80, 120)
      .z('brume', 110, 2050, 100, 190, { density: 1 })
      .z('brume', 260, 2550, 90, 170, { density: 1 })
      .z('sec', 140, 3000, 90, 90);
    b.pellets(500, 3000, 1.6);
    b.bird(2900, 1, 85);
    b.shard(180, 860, 95, 1400, 265, 1430, 180, 1640, 110, 2300, 260, 2800, 40, 2100, 330, 2450);
  }),

  level('2-5', {
    length: 3900,
    speed: 63,
    landing: L('scarf', 180, 100),
    target: [['needle', 6, 0.75], ['dendrite', 18, 1], ['plate', 5, 0.75]],
    objectives: [{ kind: 'land' }, { kind: 'match', pct: 70 }, { kind: 'match', pct: 88 }],
  }, (b) => {
    b.z('froid', 180, 510, 110, 140)
      .z('sec', 50, 760, 50, 110)
      .z('brume', 125, 1040, 100, 210, { density: 1 })
      .z('givre', 290, 1080, 60, 140)
      .z('brume', 240, 1540, 100, 220, { density: 1 })
      .z('froid', 70, 1850, 55, 130)
      .z('brume', 140, 1990, 70, 110, { density: 1 })
      .z('sec', 200, 2380, 120, 160)
      .z('brume', 200, 2860, 100, 110);
    b.pellets(700, 3100, 1.9);
    b.bird(2700, -1, 95);
    b.shard(180, 740, 125, 1300, 290, 1330, 240, 1800, 70, 2080, 200, 2600);
  }),

  level('2-6', {
    length: 4200,
    speed: 65,
    landing: L('scarf', 100, 90),
    objectives: [{ kind: 'land' }, { kind: 'beauty', n: 1100 }, { kind: 'shards', n: 7 }],
  }, (b, d) => {
    b.z('sec', 180, 560, 100, 130)
      .z('froid', 80, 980, 70, 150)
      .z('brume', 260, 1000, 90, 170, { density: 1 })
      .z('givre', 180, 1500, 80, 120)
      .z('brume', 100, 1950, 95, 190, { density: 1 })
      .z('froid', 270, 2300, 80, 160)
      .z('sec', 170, 2800, 120, 150)
      .z('brume', 260, 3250, 80, 120);
    b.pellets(400, 1800, 1.5).pellets(1800, 3500, 1.15, { x: 'aim' });
    b.bird(2200, 1, 100).bird(3000, -1, 110);
    const g = d.length;
    b.branch(360, g - 300, 215, g - 275, 5).branch(0, g - 240, 40, g - 228, 4);
    b.shard(180, 800, 30, 1150, 330, 1150, 180, 1500, 100, 2200, 270, 2560, 170, 3050, 320, 3300, 40, g - 230);
  }),

  // ----------------------------------------------------------- Le Village
  level('3-1', {
    length: 3800,
    speed: 64,
    landing: L('sleeve', 180, 100),
    objectives: [{ kind: 'land' }, { kind: 'nomelt' }, { kind: 'size', mm: 6 }],
  }, (b) => {
    b.hint('zone:redoux', 'hint.redoux');
    b.z('brume', 180, 560, 110, 160)
      .z('redoux', 90, 1050, 45, 230)
      .z('sec', 230, 1050, 90, 150)
      .z('brume', 120, 1600, 85, 160)
      .z('redoux', 255, 1650, 45, 260)
      .z('redoux', 180, 2150, 40, 200)
      .z('brume', 70, 2250, 60, 160)
      .z('froid', 290, 2250, 60, 160)
      .z('brume', 180, 2800, 110, 130);
    b.pellets(1200, 3100, 1.9);
    b.shard(180, 820, 230, 1300, 90, 1350, 120, 1850, 255, 1950, 70, 2500, 290, 2500, 180, 3000);
  }),

  level('3-2', {
    length: 4000,
    speed: 65,
    landing: L('sleeve', 230, 95),
    objectives: [{ kind: 'land' }, { kind: 'shards', n: 7 }, { kind: 'intact' }],
  }, (b) => {
    b.hint(600, 'hint.wind', 5);
    b.wind(700, 1500, 1, 75, { period: 4, duty: 0.6 })
      .wind(1700, 2500, -1, 85, { period: 3.5, duty: 0.6, offset: 1 })
      .wind(2700, 3400, 1, 95, { period: 3, duty: 0.55 });
    b.z('brume', 180, 560, 110, 150)
      .z('sec', 120, 1100, 90, 160)
      .z('brume', 260, 1500, 80, 150)
      .z('redoux', 70, 1850, 40, 180)
      .z('brume', 200, 2050, 100, 170)
      .z('froid', 120, 2600, 85, 150)
      .z('brume', 250, 3050, 90, 140);
    b.pellets(1000, 3400, 1.8);
    b.shard(180, 800, 300, 1000, 40, 1300, 260, 1700, 60, 2050, 320, 2250, 120, 2850, 250, 3250, 330, 3300);
  }),

  level('3-3', {
    length: 4000,
    speed: 65,
    landing: L('sleeve', 130, 100),
    objectives: [{ kind: 'land' }, { kind: 'type', type: 'sectored' }, { kind: 'intact' }],
  }, (b) => {
    b.hint(120, 'hint.sectored', 6);
    b.z('sec', 180, 580, 120, 170)
      .z('brume', 70, 1040, 55, 140)
      .z('sec', 230, 1100, 100, 180)
      .z('redoux', 110, 1650, 45, 220)
      .z('sec', 250, 1700, 90, 180)
      .z('sec', 150, 2300, 110, 170)
      .z('froid', 290, 2600, 60, 120)
      .z('sec', 150, 2950, 100, 120);
    b.wind(1500, 2500, -1, 70, { period: 4.5, duty: 0.5 });
    b.pellets(700, 3300, 1.6);
    b.shard(180, 840, 230, 1350, 40, 1300, 250, 1950, 150, 2550, 290, 2800, 150, 3150);
  }),

  level('3-4', {
    length: 4000,
    speed: 64,
    landing: L('sleeve', 200, 100),
    target: [['plate', 10, 0.75], ['needle', 8, 0.75], ['plate', 6, 0.75]],
    objectives: [{ kind: 'land' }, { kind: 'match', pct: 70 }, { kind: 'match', pct: 88 }],
  }, (b) => {
    b.z('sec', 180, 560, 115, 180)
      .z('redoux', 305, 760, 38, 170)
      .z('sec', 140, 1060, 100, 170)
      .z('froid', 255, 1540, 100, 210)
      .z('brume', 70, 1560, 55, 150)
      .z('redoux', 150, 1990, 40, 150)
      .z('froid', 290, 2000, 50, 120)
      .z('sec', 95, 2300, 85, 170)
      .z('sec', 265, 2420, 80, 150)
      .z('brume', 180, 2950, 110, 110);
    b.wind(1200, 2400, 1, 65, { period: 4, duty: 0.5 });
    b.pellets(900, 3200, 1.8);
    b.shard(180, 800, 305, 1060, 140, 1320, 255, 1820, 70, 1800, 95, 2560, 265, 2660);
  }),

  level('3-5', {
    length: 4200,
    speed: 66,
    landing: L('sleeve', 170, 95),
    objectives: [{ kind: 'land' }, { kind: 'shards', n: 11 }, { kind: 'beauty', n: 1100 }],
  }, (b) => {
    b.z('brume', 180, 560, 110, 160)
      .z('froid', 90, 1050, 75, 150)
      .z('brume', 265, 1080, 80, 170, { density: 1 })
      .z('redoux', 180, 1450, 40, 160)
      .z('sec', 90, 1800, 80, 170)
      .z('brume', 270, 1850, 80, 170)
      .z('givre', 180, 2350, 100, 130)
      .z('brume', 110, 2850, 90, 160, { density: 1 })
      .z('sec', 270, 3200, 80, 120);
    b.wind(2400, 3300, -1, 80, { period: 3.5, duty: 0.55 });
    b.pellets(500, 1800, 1.4).pellets(1800, 3500, 1.05, { x: 'aim' });
    for (let i = 0; i < 14; i++) {
      const y = 760 + i * 210;
      b.shard(180 + Math.sin(i * 1.3) * 140, y);
    }
  }),

  level('3-6', {
    length: 4400,
    speed: 67,
    landing: L('sleeve', 260, 90),
    objectives: [{ kind: 'land' }, { kind: 'intact' }, { kind: 'beauty', n: 1300 }],
  }, (b, d) => {
    b.z('sec', 180, 580, 105, 140)
      .z('brume', 80, 1040, 70, 170, { density: 1 })
      .z('redoux', 180, 1060, 38, 200)
      .z('froid', 280, 1060, 70, 160)
      .z('brume', 180, 1600, 120, 180, { density: 1 })
      .z('givre', 80, 2100, 60, 130)
      .z('sec', 250, 2150, 95, 170)
      .z('redoux', 130, 2650, 45, 200)
      .z('brume', 270, 2750, 80, 180, { density: 1 })
      .z('sec', 150, 3300, 110, 120);
    b.wind(1300, 2000, 1, 80, { period: 3.5, duty: 0.55 }).wind(2400, 3200, -1, 90, { period: 3, duty: 0.5 });
    b.pellets(400, 2000, 1.6).pellets(2000, 3700, 1.35, { x: 'aim' });
    b.bird(3300, -1, 110);
    b.shard(180, 820, 80, 1300, 280, 1300, 180, 1880, 80, 2350, 250, 2400, 270, 3000, 150, 3500, 40, d.length - 300);
  }),

  // ---------------------------------------------------------- Le Blizzard
  level('4-1', {
    length: 4200,
    speed: 68,
    landing: L('sled', 190, 110),
    objectives: [{ kind: 'land' }, { kind: 'intact' }, { kind: 'shards', n: 7 }],
  }, (b) => {
    b.hint(400, 'hint.gusts', 5);
    b.wind(500, 1300, 1, 110, { period: 3, duty: 0.5 })
      .wind(1400, 2200, -1, 120, { period: 2.6, duty: 0.55 })
      .wind(2300, 3100, 1, 125, { period: 2.4, duty: 0.5, offset: 0.7 })
      .wind(3150, 3700, -1, 100, { period: 2.8, duty: 0.5 });
    b.z('brume', 180, 560, 110, 150)
      .z('sec', 110, 1100, 90, 170)
      .z('brume', 260, 1650, 90, 180, { density: 1 })
      .z('froid', 120, 2200, 90, 160)
      .z('brume', 230, 2750, 100, 170)
      .z('sec', 150, 3250, 100, 110);
    b.pellets(800, 3500, 1.8);
    b.shard(180, 800, 300, 1150, 60, 1400, 260, 1900, 30, 2300, 300, 2500, 230, 3000, 150, 3450);
  }),

  level('4-2', {
    length: 4200,
    speed: 69,
    landing: L('sled', 140, 100),
    objectives: [{ kind: 'land' }, { kind: 'intact' }, { kind: 'size', mm: 7 }],
  }, (b) => {
    b.hint(500, 'hint.hail', 5);
    b.z('brume', 180, 580, 115, 160, { density: 1 })
      .z('sec', 90, 1100, 80, 160)
      .z('brume', 260, 1150, 85, 170, { density: 1 })
      .z('froid', 160, 1700, 100, 170)
      .z('brume', 100, 2250, 90, 180, { density: 1 })
      .z('brume', 260, 2700, 90, 170)
      .z('sec', 180, 3250, 110, 110);
    b.hail(600, 2000, 3.0, { x: [30, 330] }).hail(2000, 3500, 2.4, { x: 'aim' });
    b.pellets(1000, 3500, 2.4);
    b.wind(1800, 2600, 1, 80, { period: 3.2, duty: 0.5 });
    b.shard(180, 820, 90, 1350, 260, 1400, 160, 1950, 100, 2500, 260, 2950, 180, 3450);
  }),

  level('4-3', {
    length: 4400,
    speed: 70,
    landing: L('sled', 210, 100),
    objectives: [{ kind: 'land' }, { kind: 'size', mm: 9 }, { kind: 'shards', n: 6 }],
  }, (b) => {
    b.hint('zone:brume', 'hint.draft', 6);
    b.z('brume', 180, 600, 120, 200, { density: 1 })
      .draft(180, 600, 120, 200, -45)
      .z('froid', 80, 1200, 70, 150)
      .draft(270, 1250, 70, 200, 70)
      .z('brume', 220, 1650, 110, 210, { density: 1 })
      .draft(220, 1650, 110, 210, -50)
      .z('sec', 100, 2250, 85, 170)
      .z('brume', 250, 2750, 100, 200, { density: 1 })
      .draft(250, 2750, 100, 200, -50)
      .draft(90, 3000, 80, 200, 70)
      .z('sec', 180, 3350, 100, 120);
    b.hail(900, 3600, 2.4);
    b.pellets(600, 3600, 1.7);
    b.shard(180, 900, 270, 1150, 80, 1450, 220, 2000, 100, 2450, 30, 2750, 250, 3050, 180, 3550);
  }),

  level('4-4', {
    length: 4200,
    speed: 68,
    landing: L('sled', 180, 110),
    objectives: [{ kind: 'land' }, { kind: 'type', type: 'aggregate' }, { kind: 'beauty', n: 1000 }],
  }, (b) => {
    b.hint(350, 'hint.crowd', 6).hint('merge', 'hint.merge');
    b.z('brume', 180, 580, 115, 160)
      .z('sec', 100, 1100, 85, 170)
      .z('brume', 260, 1120, 80, 170, { density: 1 })
      .z('froid', 180, 1700, 110, 170)
      .z('brume', 110, 2250, 95, 180, { density: 1 })
      .z('sec', 260, 2700, 90, 160)
      .z('brume', 170, 3200, 110, 120);
    b.flakes(400, 3400, 2.3, { size: [6, 12] });
    b.pellets(1500, 3500, 2.0);
    b.shard(180, 820, 100, 1350, 260, 1380, 180, 1950, 110, 2500, 260, 2950);
  }),

  level('4-5', {
    length: 4500,
    speed: 69,
    landing: L('sled', 150, 100),
    target: [['dendrite', 10, 0.75], ['needle', 8, 0.75], ['dendrite', 10, 1], ['plate', 5, 0.75]],
    objectives: [{ kind: 'land' }, { kind: 'match', pct: 70 }, { kind: 'match', pct: 88 }],
  }, (b) => {
    b.z('brume', 180, 600, 110, 210)
      .z('sec', 305, 820, 50, 120)
      .z('froid', 115, 1180, 95, 190)
      .z('brume', 285, 1250, 60, 150)
      .z('brume', 185, 1760, 110, 220, { density: 1 })
      .z('froid', 305, 2150, 50, 130)
      .z('sec', 115, 2380, 100, 170)
      .z('brume', 265, 2850, 85, 150, { density: 1 })
      .z('sec', 170, 3300, 110, 110);
    b.wind(1400, 2300, -1, 80, { period: 3.2, duty: 0.5 });
    b.hail(1300, 3500, 3.2);
    b.flakes(900, 3200, 4);
    b.pellets(600, 3500, 2.0);
    b.shard(180, 860, 115, 1420, 285, 1460, 185, 2020, 115, 2600, 265, 3080);
  }),

  level('4-6', {
    length: 4600,
    speed: 72,
    landing: L('sled', 260, 95),
    objectives: [{ kind: 'land' }, { kind: 'intact' }, { kind: 'beauty', n: 1300 }],
  }, (b, d) => {
    b.z('brume', 180, 580, 105, 150, { density: 1 })
      .z('sec', 80, 1050, 70, 160)
      .z('froid', 270, 1080, 80, 160)
      .draft(180, 1400, 90, 160, 80)
      .z('brume', 120, 1750, 100, 190, { density: 1 })
      .draft(120, 1750, 100, 190, -45)
      .z('givre', 270, 2150, 70, 130)
      .z('sec', 180, 2600, 110, 160)
      .z('redoux', 60, 2700, 40, 150)
      .z('brume', 260, 3150, 85, 170, { density: 1 })
      .z('sec', 140, 3600, 100, 110);
    b.wind(900, 1700, 1, 110, { period: 2.8, duty: 0.5 })
      .wind(2300, 3100, -1, 120, { period: 2.6, duty: 0.55 })
      .wind(3300, 3900, 1, 100, { period: 3, duty: 0.5 });
    b.hail(700, 4000, 3.0, { x: 'aim' });
    b.pellets(500, 4000, 1.8);
    b.flakes(1500, 3500, 5);
    b.shard(180, 820, 80, 1300, 270, 1330, 120, 2000, 270, 2400, 180, 2850, 260, 3400, 140, 3800, 330, d.length - 300);
  }),

  // ------------------------------------------------------------- L'Aurore
  level('5-1', {
    length: 4000,
    speed: 66,
    landing: L('glass', 180, 110),
    objectives: [{ kind: 'land' }, { kind: 'type', type: 'boreal' }, { kind: 'shards', n: 6 }],
  }, (b) => {
    b.hint('zone:aurore', 'hint.aurore');
    b.z('aurore', 180, 580, 120, 170)
      .z('brume', 80, 1100, 70, 150)
      .z('aurore', 250, 1120, 90, 180)
      .z('aurore', 130, 1700, 100, 180)
      .z('sec', 280, 1760, 60, 130)
      .z('aurore', 220, 2300, 100, 180)
      .z('brume', 120, 2850, 90, 130);
    b.pellets(900, 3300, 1.7);
    b.shard(180, 840, 250, 1380, 40, 1400, 130, 1960, 300, 2000, 220, 2560, 120, 3050);
  }),

  level('5-2', {
    length: 4000,
    speed: 67,
    landing: L('glass', 140, 100),
    objectives: [{ kind: 'land' }, { kind: 'type', type: 'triangular' }, { kind: 'intact' }],
  }, (b) => {
    b.hint('zone:tourbillon', 'hint.tourbillon');
    b.z('tourbillon', 180, 600, 110, 180)
      .z('brume', 70, 1120, 60, 150)
      .z('tourbillon', 230, 1150, 95, 190)
      .z('aurore', 120, 1720, 90, 160)
      .z('tourbillon', 250, 2200, 95, 190)
      .z('sec', 100, 2700, 85, 150)
      .z('tourbillon', 200, 3100, 100, 120);
    b.pellets(700, 3400, 1.5);
    b.hail(1800, 3300, 3.2);
    b.shard(180, 880, 230, 1420, 70, 1380, 120, 1960, 250, 2480, 100, 2950, 200, 3300);
  }),

  level('5-3', {
    length: 4000,
    speed: 66,
    landing: L('glass', 200, 100),
    objectives: [{ kind: 'land' }, { kind: 'type', type: 'twelve' }, { kind: 'beauty', n: 1400 }],
  }, (b) => {
    b.hint(300, 'hint.twin', 6);
    b.z('brume', 180, 580, 115, 170, { density: 1 })
      .z('sec', 90, 1080, 80, 160)
      .z('aurore', 260, 1120, 85, 170)
      .z('brume', 180, 1650, 110, 180, { density: 1 })
      .z('froid', 90, 2200, 75, 150)
      .z('brume', 260, 2250, 80, 160)
      .z('sec', 180, 2800, 110, 140);
    b.twin(1450, 180).twin(2500, 120);
    b.pellets(800, 3300, 1.6);
    b.shard(180, 840, 90, 1330, 260, 1380, 180, 1950, 90, 2450, 260, 2500);
  }),

  level('5-4', {
    length: 4500,
    speed: 67,
    landing: L('glass', 170, 100),
    target: [['plate', 5, 0.75], ['aurora', 16, 0.75], ['dendrite', 8, 1], ['plate', 4, 0.75]],
    objectives: [{ kind: 'land' }, { kind: 'match', pct: 70 }, { kind: 'match', pct: 88 }],
  }, (b) => {
    b.z('sec', 180, 520, 110, 140)
      .z('froid', 305, 720, 48, 120)
      .z('aurore', 125, 1040, 100, 210)
      .z('aurore', 250, 1520, 95, 220)
      .z('brume', 70, 1560, 55, 130)
      .z('aurore', 120, 1930, 70, 110)
      .z('redoux', 230, 2010, 38, 150)
      .z('brume', 95, 2330, 90, 190, { density: 1 })
      .z('tourbillon', 285, 2380, 60, 140)
      .z('sec', 205, 2880, 110, 150)
      .z('brume', 140, 3380, 100, 110);
    b.wind(2600, 3300, 1, 80, { period: 3.2, duty: 0.5 });
    b.pellets(700, 3600, 1.7);
    b.hail(1600, 3400, 3.4);
    b.shard(180, 760, 125, 1300, 250, 1800, 70, 1800, 95, 2600, 285, 2620, 205, 3100);
  }),

  level('5-5', {
    length: 4500,
    speed: 69,
    landing: L('glass', 110, 95),
    objectives: [{ kind: 'land' }, { kind: 'nomelt' }, { kind: 'shards', n: 9 }],
  }, (b, d) => {
    b.z('aurore', 180, 580, 110, 150)
      .z('redoux', 70, 1000, 40, 200)
      .z('brume', 200, 1050, 100, 180, { density: 1 })
      .z('redoux', 320, 1400, 38, 200)
      .z('froid', 150, 1650, 90, 160)
      .z('redoux', 230, 2150, 42, 220)
      .z('aurore', 100, 2250, 80, 170)
      .z('sec', 300, 2350, 50, 130)
      .z('brume', 200, 2850, 100, 170, { density: 1 })
      .z('redoux', 60, 3300, 40, 180)
      .z('sec', 210, 3450, 100, 110);
    b.wind(1100, 1900, 1, 95, { period: 3, duty: 0.5 }).wind(2600, 3400, -1, 100, { period: 2.8, duty: 0.55 });
    b.pellets(500, 3800, 1.3);
    b.hail(1500, 3800, 2.8);
    b.shard(180, 800, 70, 1250, 200, 1300, 320, 1700, 150, 1900, 230, 2450, 100, 2500, 300, 2600, 200, 3100, 60, 3550, 330, d.length - 320);
  }),

  level('5-6', {
    length: 4800,
    speed: 70,
    landing: L('glass', 180, 100),
    objectives: [{ kind: 'land' }, { kind: 'badge', badge: 'masterpiece' }, { kind: 'beauty', n: 1500 }],
  }, (b, d) => {
    b.hint(150, 'hint.masterpiece', 7);
    b.z('sec', 180, 580, 110, 140)
      .z('brume', 90, 1050, 80, 180, { density: 1 })
      .z('aurore', 270, 1080, 80, 170)
      .z('redoux', 180, 1500, 40, 180)
      .z('froid', 80, 1700, 70, 160)
      .z('brume', 260, 1750, 85, 190, { density: 1 })
      .z('aurore', 160, 2350, 110, 180)
      .z('givre', 300, 2700, 50, 120)
      .z('brume', 110, 2950, 90, 180, { density: 1 })
      .draft(110, 2950, 90, 180, -40)
      .z('sec', 250, 3500, 95, 160)
      .z('sec', 150, 3950, 90, 100);
    b.wind(1300, 2100, -1, 95, { period: 3, duty: 0.5 }).wind(2800, 3600, 1, 110, { period: 2.6, duty: 0.55 });
    b.pellets(500, 4200, 2.0, { x: 'aim' });
    b.hail(1400, 4100, 3.8);
    b.flakes(1800, 3800, 6);
    b.bird(3700, 1, 110);
    b.shard(180, 820, 90, 1300, 270, 1350, 80, 1950, 260, 2000, 160, 2600, 110, 3200, 250, 3750, 150, d.length - 330);
  }),
];

export const LEVEL_BY_ID = Object.fromEntries(LEVELS.map((l) => [l.id, l]));

export function levelsOfChapter(ch) {
  return LEVELS.filter((l) => l.chapter === ch);
}

export function nextLevelId(id) {
  const i = LEVELS.findIndex((l) => l.id === id);
  return i >= 0 && i < LEVELS.length - 1 ? LEVELS[i + 1].id : null;
}
