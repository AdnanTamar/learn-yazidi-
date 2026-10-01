// Arena definitions. Obstacles block movement/projectiles; hazards damage over time.
// To add a map: append an entry here — nothing else needs to change.
const rect = (x, y, w, h) => ({ x, y, w, h });

export const MAPS = {
  meadow: {
    id: 'meadow', name: 'Sunlit Meadow', w: 2000, h: 1400,
    desc: 'Wide open fields with a few boulders. Room to kite.',
    spawn: { x: 1000, y: 700 }, seed: 11, decor: 'grass',
    theme: { ground: '#5a9a47', ground2: '#4f8c3e', decor: '#6fb35a', obstacle: '#7d8590', obstacleTop: '#a4acb6', border: '#2f5a26' },
    obstacles: [
      rect(300, 250, 110, 90), rect(1600, 300, 120, 110), rect(500, 1000, 130, 100), rect(1500, 1050, 110, 110),
      rect(900, 350, 90, 90), rect(950, 960, 100, 80), rect(250, 650, 70, 110), rect(1700, 650, 70, 110),
      rect(1250, 560, 80, 80), rect(700, 620, 80, 80),
    ],
    hazards: [],
  },
  ruins: {
    id: 'ruins', name: 'Sandstone Ruins', w: 1800, h: 1300,
    desc: 'Crumbling walls and pillars create tight corridors.',
    spawn: { x: 900, y: 650 }, seed: 23, decor: 'cracks',
    theme: { ground: '#c9ae78', ground2: '#bd9f68', decor: '#a98a55', obstacle: '#8a6d46', obstacleTop: '#b08f5e', border: '#5b4527' },
    obstacles: [
      rect(300, 220, 40, 40), rect(600, 220, 40, 40), rect(1160, 220, 40, 40), rect(1460, 220, 40, 40),
      rect(300, 1040, 40, 40), rect(600, 1040, 40, 40), rect(1160, 1040, 40, 40), rect(1460, 1040, 40, 40),
      rect(300, 620, 40, 40), rect(1460, 620, 40, 40),
      rect(760, 360, 280, 36), rect(760, 904, 280, 36),
      rect(500, 440, 36, 180), rect(1264, 440, 36, 180), rect(500, 680, 36, 180), rect(1264, 680, 36, 180),
    ],
    hazards: [],
  },
  embers: {
    id: 'embers', name: 'Ember Caverns', w: 2000, h: 1500,
    desc: 'Lava pools burn anyone who steps in — you and the enemy.',
    spawn: { x: 1000, y: 750 }, seed: 37, decor: 'embers',
    theme: { ground: '#3a2f33', ground2: '#32282c', decor: '#52403f', obstacle: '#5c4a50', obstacleTop: '#7c6a70', border: '#150f12', hazard: '#ff5a1f' },
    obstacles: [
      rect(400, 300, 100, 100), rect(1500, 300, 100, 100), rect(400, 1100, 100, 100), rect(1500, 1100, 100, 100),
      rect(930, 220, 140, 70), rect(930, 1210, 140, 70), rect(180, 700, 70, 100), rect(1750, 700, 70, 100),
    ],
    hazards: [
      { x: 650, y: 500, w: 220, h: 160, dps: 14 }, { x: 1130, y: 840, w: 220, h: 160, dps: 14 },
      { x: 1250, y: 380, w: 160, h: 160, dps: 14 }, { x: 590, y: 960, w: 160, h: 160, dps: 14 },
    ],
  },
};
