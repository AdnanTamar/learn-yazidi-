// Playable characters. Add an entry here (and an ability in abilities.js) to add a hero.
// attack.type: 'melee' (arc) | 'projectile'
export const CHARACTERS = {
  knight: {
    id: 'knight', name: 'Knight', role: 'Bruiser', color: '#4da3ff', shape: 'square', radius: 16,
    desc: 'Tough sword fighter. Slam knocks back everything nearby.',
    hp: 140, speed: 190,
    attack: { type: 'melee', damage: 18, range: 74, arc: 1.7, cooldown: 0.45, knock: 260 },
    ability: 'slam',
  },
  ranger: {
    id: 'ranger', name: 'Ranger', role: 'Marksman', color: '#5ee08a', shape: 'triangle', radius: 14,
    desc: 'Fast bow shots from range. Volley fires a wide fan of arrows.',
    hp: 90, speed: 215,
    attack: { type: 'projectile', damage: 12, speed: 650, range: 540, cooldown: 0.36, radius: 5, color: '#c8ffd8' },
    ability: 'volley',
  },
  mage: {
    id: 'mage', name: 'Mage', role: 'Caster', color: '#b278ff', shape: 'diamond', radius: 14,
    desc: 'Piercing arcane bolts. Nova blasts a ring of magic in all directions.',
    hp: 80, speed: 195,
    attack: { type: 'projectile', damage: 20, speed: 480, range: 480, cooldown: 0.6, radius: 8, pierce: 1, color: '#e2c8ff' },
    ability: 'nova',
  },
  rogue: {
    id: 'rogue', name: 'Rogue', role: 'Assassin', color: '#ffb84d', shape: 'hex', radius: 13,
    desc: 'Lightning-fast daggers. Shadow Dash makes you untouchable while slicing through foes.',
    hp: 100, speed: 245,
    attack: { type: 'melee', damage: 11, range: 56, arc: 1.3, cooldown: 0.22, knock: 120 },
    ability: 'dash',
  },
  cleric: {
    id: 'cleric', name: 'Cleric', role: 'Support', color: '#f2f2c4', shape: 'circle', radius: 15,
    desc: 'Steady light bolts. Radiance heals you and burns enemies around you.',
    hp: 115, speed: 200,
    attack: { type: 'projectile', damage: 14, speed: 540, range: 500, cooldown: 0.45, radius: 6, color: '#fffbe0' },
    ability: 'heal',
  },
};
