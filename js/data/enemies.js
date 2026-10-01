// Enemy archetypes. `ai` selects a behaviour in systems/ai.js. `cost` is the spawn budget price.
export const ENEMIES = {
  grunt: {
    id: 'grunt', name: 'Grunt', color: '#e05555', shape: 'circle', radius: 14, hp: 40, speed: 105,
    ai: 'chaser', xp: 6, cost: 1,
    attack: { type: 'melee', damage: 8, range: 34, arc: 2.2, cooldown: 0.9, knock: 120 },
  },
  archer: {
    id: 'archer', name: 'Archer', color: '#d98a3d', shape: 'triangle', radius: 12, hp: 28, speed: 95,
    ai: 'shooter', prefDist: 280, xp: 9, cost: 2,
    attack: { type: 'projectile', damage: 7, speed: 330, range: 520, cooldown: 1.5, radius: 5, color: '#ffb36b' },
  },
  wraith: {
    id: 'wraith', name: 'Wraith', color: '#7fd6e8', shape: 'diamond', radius: 12, hp: 24, speed: 165,
    ai: 'chaser', ghost: true, xp: 10, cost: 2,
    attack: { type: 'melee', damage: 6, range: 30, arc: 2.2, cooldown: 0.6, knock: 60 },
  },
  bomber: {
    id: 'bomber', name: 'Bomber', color: '#c6d63a', shape: 'hex', radius: 13, hp: 30, speed: 130,
    ai: 'bomber', blast: { radius: 95, damage: 28 }, xp: 12, cost: 2,
  },
  brute: {
    id: 'brute', name: 'Brute', color: '#a03c8c', shape: 'square', radius: 24, hp: 190, speed: 80,
    ai: 'charger', heavy: true, xp: 30, cost: 5,
    attack: { type: 'melee', damage: 22, range: 52, arc: 2.0, cooldown: 1.1, knock: 420 },
    charge: { windup: 0.8, time: 0.55, speed: 520, recover: 0.9, trigger: 380 },
  },
};
