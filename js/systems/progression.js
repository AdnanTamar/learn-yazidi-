import { UPGRADES } from '../data/upgrades.js';
import { shuffle } from '../core/util.js';
import { heal } from './combat.js';
import { sfx } from '../core/audio.js';

export const xpForNext = (level) => Math.round(20 + (level - 1) * 14 + (level - 1) ** 2 * 2);

/** Add XP (night-boosted). Returns number of level-ups pending. */
export function gainXp(g, amount) {
  g.xp += Math.round(amount * g.daynight.xpMult);
  while (g.xp >= xpForNext(g.level)) {
    g.xp -= xpForNext(g.level);
    g.level++;
    g.pendingLevelUps++;
    heal(g, g.player, g.player.maxHp * 0.25);
    g.fx.ring(g.player.x, g.player.y, 80, '#ffe14d');
    sfx.play('level');
  }
}

export function rollUpgrades(n = 3) {
  return shuffle([...UPGRADES]).slice(0, n);
}
