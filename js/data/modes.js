import { ENEMIES } from './enemies.js';
import { pick, shuffle } from '../core/util.js';

// Game modes: hooks the Game calls. Add a mode by adding an entry.
//   init(game)   - reset mode state
//   update(game, dt)
//   label(game)  - HUD text
//   result(game) - 'won' | null  (death is handled by the game itself)

const UNLOCK = { grunt: 1, archer: 2, wraith: 3, bomber: 4, brute: 5 };

function composeGroup(budget, tier) {
  const pool = Object.keys(ENEMIES).filter((id) => UNLOCK[id] <= tier);
  const out = [];
  let left = budget;
  while (left > 0 && out.length < 40) {
    const options = pool.filter((id) => ENEMIES[id].cost <= left);
    if (!options.length) break;
    // Cheap enemies are more common.
    const id = Math.random() < 0.45 ? 'grunt' : pick(options);
    const e = ENEMIES[options.includes(id) ? id : options[0]];
    out.push(e.id);
    left -= e.cost;
  }
  return shuffle(out);
}

export const MODES = {
  survival: {
    id: 'survival', name: 'Survival', desc: 'Endless waves of tougher enemies. How long can you last?',
    init(g) {
      g.wave = 0;
      g.modeState = { queue: [], spawnT: 0, nextWaveT: 1.5 };
    },
    update(g, dt) {
      const s = g.modeState;
      if (s.queue.length) {
        s.spawnT -= dt;
        if (s.spawnT <= 0 && g.aliveEnemies() < 35) { g.spawnEnemy(s.queue.pop()); s.spawnT = 0.35; }
      } else if (g.aliveEnemies() === 0) {
        s.nextWaveT -= dt;
        if (s.nextWaveT <= 0) {
          g.wave++;
          s.queue = composeGroup(3 + g.wave * 2.5, g.wave);
          s.nextWaveT = 3;
          g.toast(g.wave % 5 === 0 ? `Wave ${g.wave} — Brutes incoming!` : `Wave ${g.wave}`);
        }
      }
    },
    label: (g) => `Wave ${g.wave}`,
    result: () => null,
  },

  hunt: {
    id: 'hunt', name: 'Hunt', desc: 'Defeat 40 enemies in a steady stream to win.',
    target: 40,
    init(g) {
      g.wave = 1;
      g.modeState = { spawnT: 1 };
    },
    update(g, dt) {
      const s = g.modeState;
      g.wave = 1 + Math.floor(g.kills / 8);
      s.spawnT -= dt;
      const want = Math.min(16, 5 + Math.floor(g.kills / 4));
      if (s.spawnT <= 0 && g.aliveEnemies() < want && g.kills + g.aliveEnemies() < this.target) {
        const group = composeGroup(1 + g.wave, g.wave);
        g.spawnEnemy(group[0]);
        s.spawnT = 0.7;
      }
    },
    label(g) { return `Defeated ${g.kills}/${this.target}`; },
    result(g) { return g.kills >= this.target ? 'won' : null; },
  },
};
