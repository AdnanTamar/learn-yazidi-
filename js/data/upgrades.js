// Level-up choices. apply(game, player) mutates the player's mods.
export const UPGRADES = [
  { id: 'power', icon: '⚔️', name: 'Power', desc: '+15% damage', apply: (g, p) => { p.mods.dmg *= 1.15; } },
  { id: 'swift', icon: '👟', name: 'Swiftness', desc: '+10% move speed', apply: (g, p) => { p.mods.speed *= 1.1; } },
  { id: 'vital', icon: '❤️', name: 'Vitality', desc: '+25 max HP and heal 25', apply: (g, p) => { p.maxHp += 25; p.hp = Math.min(p.maxHp, p.hp + 25); } },
  { id: 'frenzy', icon: '⚡', name: 'Frenzy', desc: '+15% attack speed', apply: (g, p) => { p.mods.atkSpeed *= 1.15; } },
  { id: 'focus', icon: '🔮', name: 'Focus', desc: '-15% ability cooldown', apply: (g, p) => { p.mods.cd *= 0.85; } },
  { id: 'regen', icon: '🌿', name: 'Regeneration', desc: '+1 HP regenerated per second', apply: (g, p) => { p.mods.regen += 1; } },
  { id: 'magnet', icon: '🧲', name: 'Magnet', desc: '+50% pickup range', apply: (g, p) => { p.mods.magnet *= 1.5; } },
];
