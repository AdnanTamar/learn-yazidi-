import { circleOverlapsRect, clamp, resolveCircleRect } from '../core/util.js';
import { dealDamage } from './combat.js';
import { dist } from '../core/util.js';

// Applies desired movement, knockback and dashes, then resolves collisions with the arena.
export function updateMovement(g, e, dt) {
  if (e.dead) return;
  const map = g.map;

  if (e.dash) {
    e.x += e.dash.vx * dt; e.y += e.dash.vy * dt;
    for (const t of g.entities) {
      if (t.team === e.team || t.dead || e.dash.hit.has(t) || dist(e.x, e.y, t.x, t.y) > e.r + t.r + 6) continue;
      e.dash.hit.add(t);
      dealDamage(g, t, e.dash.damage, e, { knock: 200, angle: Math.atan2(e.dash.vy, e.dash.vx) });
    }
    if ((e.dash.t -= dt) <= 0) e.dash = null;
    if (Math.random() < 0.6) g.fx.burst(e.x, e.y, 1, e.def.color, 30);
  } else {
    const speed = e.speed ?? e.def.speed;
    const mult = e.mods.speed * (e.isPlayer ? 1 : g.daynight.enemySpeedMult);
    e.x += (e.moveX * speed * mult + e.kx) * dt;
    e.y += (e.moveY * speed * mult + e.ky) * dt;
  }
  const decay = Math.exp(-9 * dt);
  e.kx *= decay; e.ky *= decay;

  if (!e.def.ghost) {
    for (const o of map.obstacles) resolveCircleRect(e, o);
    // Hazards (lava) tick damage.
    e.hazT -= dt;
    if (e.hazT <= 0 && !e.dash) {
      for (const h of map.hazards) {
        if (circleOverlapsRect(e.x, e.y, e.r * 0.6, h)) {
          e.hazT = 0.25;
          dealDamage(g, e, h.dps * 0.25, null, { silent: true });
          if (!e.dead) { g.fx.burst(e.x, e.y, 2, '#ff8a3d', 80); e.flash = 0.06; }
          break;
        }
      }
    }
  }
  e.x = clamp(e.x, e.r, map.w - e.r);
  e.y = clamp(e.y, e.r, map.h - e.r);
}

/** Soft push so enemies don't stack on top of each other. */
export function separate(g) {
  const list = g.entities;
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    if (a.dead) continue;
    for (let j = i + 1; j < list.length; j++) {
      const b = list[j];
      if (b.dead || (a.isPlayer && b.isPlayer)) continue;
      const dx = b.x - a.x, dy = b.y - a.y, min = a.r + b.r;
      const d2 = dx * dx + dy * dy;
      if (d2 >= min * min || d2 === 0) continue;
      const d = Math.sqrt(d2), push = (min - d) / 2;
      const nx = dx / d, ny = dy / d;
      // The player is never shoved by enemies; enemies absorb the full overlap.
      if (a.isPlayer) { b.x += nx * push * 2; b.y += ny * push * 2; }
      else if (b.isPlayer) { a.x -= nx * push * 2; a.y -= ny * push * 2; }
      else { a.x -= nx * push; a.y -= ny * push; b.x += nx * push; b.y += ny * push; }
    }
  }
}
