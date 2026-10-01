import { ABILITIES } from '../data/abilities.js';
import { angleDiff, circleOverlapsRect, dist } from '../core/util.js';
import { sfx } from '../core/audio.js';

// Everything that deals damage goes through dealDamage() so health/death rules live in one place.

export const attackDamage = (e) => (e.def.attack?.damage ?? 10) * e.mods.dmg * e.dmgScale;
const opposing = (a, b) => a.team !== b.team && !b.dead;

export function heal(g, e, amount) {
  const before = e.hp;
  e.hp = Math.min(e.maxHp, e.hp + amount);
  if (e.hp > before) g.fx.text(e.x, e.y - e.r, '+' + Math.round(e.hp - before), '#6dff9a');
}

export function dealDamage(g, target, amount, source, opts = {}) {
  if (target.dead || target.invuln > 0) return false;
  if (source && source.team === 'enemy') amount *= g.daynight.enemyDamageMult;
  amount = Math.max(1, Math.round(amount));
  target.hp -= amount;
  target.flash = 0.12;
  if (opts.knock && opts.angle != null) {
    const k = opts.knock / (target.def.heavy ? 3 : 1);
    target.kx += Math.cos(opts.angle) * k;
    target.ky += Math.sin(opts.angle) * k;
  }
  if (!opts.silent) {
    g.fx.text(target.x, target.y - target.r, amount, target.isPlayer ? '#ff7b7b' : '#fff');
    g.fx.burst(target.x, target.y, 4, target.def.color, 120);
  }
  if (target.isPlayer) {
    if (!opts.silent) { target.invuln = 0.25; g.camera.addShake(5); sfx.play('hurt'); }
  } else sfx.play('hit');
  if (target.hp <= 0) killEntity(g, target, source);
  return true;
}

export function killEntity(g, target, source) {
  if (target.dead) return;
  target.hp = 0; target.dead = true; target.deathT = 0; target.setState('dead');
  target.dash = null;
  g.fx.burst(target.x, target.y, target.isPlayer ? 30 : 12, target.def.color, 220);
  if (target.isPlayer) g.onPlayerDeath();
  else g.onEnemyKilled(target, source);
}

/** Damage every living opponent of `source` inside a circle. Returns hit count. */
export function damageCircle(g, source, x, y, radius, amount, { knock = 0 } = {}) {
  let hits = 0;
  for (const e of g.entities) {
    if (!opposing(source, e)) continue;
    if (dist(x, y, e.x, e.y) <= radius + e.r) {
      const angle = Math.atan2(e.y - y, e.x - x);
      if (dealDamage(g, e, amount, source, { knock, angle })) hits++;
    }
  }
  return hits;
}

export function spawnProjectile(g, owner, o) {
  g.projectiles.push({
    x: o.x ?? owner.x + Math.cos(o.angle) * owner.r, y: o.y ?? owner.y + Math.sin(o.angle) * owner.r,
    vx: Math.cos(o.angle) * o.speed, vy: Math.sin(o.angle) * o.speed,
    r: o.radius, damage: o.damage, team: owner.team, owner, life: o.life, color: o.color,
    pierce: o.pierce || 0, knock: o.knock ?? 90, hit: new Set(),
  });
}

export function updateProjectiles(g, dt) {
  const list = g.projectiles;
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i];
    p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
    let remove = p.life <= 0 || p.x < 0 || p.y < 0 || p.x > g.map.w || p.y > g.map.h;
    if (!remove) {
      for (const o of g.map.obstacles) if (circleOverlapsRect(p.x, p.y, p.r, o)) { remove = true; g.fx.burst(p.x, p.y, 3, p.color, 80); break; }
    }
    if (!remove) {
      for (const e of g.entities) {
        if (e.team === p.team || e.dead || p.hit.has(e) || dist(p.x, p.y, e.x, e.y) > p.r + e.r) continue;
        p.hit.add(e);
        dealDamage(g, e, p.damage, p.owner, { knock: p.knock, angle: Math.atan2(p.vy, p.vx) });
        if (p.pierce-- <= 0) { remove = true; break; }
      }
    }
    if (remove) { list[i] = list[list.length - 1]; list.pop(); }
  }
}

export function tryAttack(g, e, angle) {
  const a = e.def.attack;
  if (!a || e.atkCd > 0 || e.dead || e.dash) return false;
  e.atkCd = a.cooldown / e.mods.atkSpeed;
  e.angle = angle;
  if (a.type === 'melee') {
    g.fx.arc(e.x, e.y, angle, a.arc, a.range + e.r, e.def.color);
    e.kx += Math.cos(angle) * 110; e.ky += Math.sin(angle) * 110; // small lunge
    for (const t of g.entities) {
      if (!opposing(e, t)) continue;
      const d = dist(e.x, e.y, t.x, t.y);
      if (d > a.range + e.r + t.r) continue;
      if (Math.abs(angleDiff(angle, Math.atan2(t.y - e.y, t.x - e.x))) <= a.arc / 2 || d < e.r + t.r)
        dealDamage(g, t, attackDamage(e), e, { knock: a.knock, angle });
    }
    sfx.play('swing');
  } else {
    spawnProjectile(g, e, { angle, speed: a.speed, damage: attackDamage(e), life: a.range / a.speed, radius: a.radius, color: a.color, pierce: a.pierce, knock: a.knock });
    sfx.play('shoot');
  }
  return true;
}

export function tryAbility(g, e, angle) {
  const ab = ABILITIES[e.def.ability];
  if (!ab || e.abCd > 0 || e.dead || e.dash) return false;
  e.abCd = ab.cooldown * e.mods.cd;
  e.angle = angle;
  ab.cast(g, e, angle);
  sfx.play('ability');
  return true;
}
