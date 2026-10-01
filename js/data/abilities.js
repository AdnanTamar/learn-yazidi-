import { damageCircle, spawnProjectile, attackDamage, heal } from '../systems/combat.js';

// Active abilities. cast(game, caster, aimAngle). Cooldown in seconds.
export const ABILITIES = {
  slam: {
    id: 'slam', name: 'Slam', icon: '💥', cooldown: 6,
    cast(g, e) {
      damageCircle(g, e, e.x, e.y, 125, attackDamage(e) * 2.2, { knock: 560 });
      g.fx.ring(e.x, e.y, 125, e.def.color);
      g.fx.burst(e.x, e.y, 18, e.def.color, 260);
      g.camera.addShake(10);
    },
  },
  volley: {
    id: 'volley', name: 'Volley', icon: '🏹', cooldown: 5,
    cast(g, e, angle) {
      const a = e.def.attack;
      for (let i = -3; i <= 3; i++) {
        spawnProjectile(g, e, { angle: angle + i * 0.15, speed: a.speed, damage: attackDamage(e) * 0.8, life: a.range / a.speed, radius: a.radius, color: a.color, pierce: 1 });
      }
    },
  },
  nova: {
    id: 'nova', name: 'Nova', icon: '🌀', cooldown: 7,
    cast(g, e) {
      for (let i = 0; i < 16; i++) {
        spawnProjectile(g, e, { angle: (i / 16) * Math.PI * 2, speed: 430, damage: attackDamage(e) * 1.2, life: 0.9, radius: 9, color: '#e2c8ff', pierce: 3 });
      }
      g.fx.ring(e.x, e.y, 90, e.def.color);
      g.camera.addShake(6);
    },
  },
  dash: {
    id: 'dash', name: 'Shadow Dash', icon: '💨', cooldown: 3.5,
    cast(g, e, angle) {
      e.dash = { t: 0.22, vx: Math.cos(angle) * 860, vy: Math.sin(angle) * 860, damage: attackDamage(e) * 2, hit: new Set() };
      e.invuln = Math.max(e.invuln, 0.3);
      g.fx.burst(e.x, e.y, 10, e.def.color, 150);
    },
  },
  heal: {
    id: 'heal', name: 'Radiance', icon: '✨', cooldown: 8,
    cast(g, e) {
      heal(g, e, e.maxHp * 0.35);
      damageCircle(g, e, e.x, e.y, 135, attackDamage(e) * 1.6, { knock: 200 });
      g.fx.ring(e.x, e.y, 135, '#fff6a8');
      g.fx.burst(e.x, e.y, 16, '#fff6a8', 200);
    },
  },
};
