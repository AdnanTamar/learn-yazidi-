import { angleTo, dist, rand } from '../core/util.js';
import { dealDamage, damageCircle, killEntity, tryAttack } from './combat.js';
import { sfx } from '../core/audio.js';

// Enemy behaviours, keyed by def.ai. Each sets e.moveX/moveY and calls attack helpers.
// To add a behaviour: add a function here and reference its key in data/enemies.js.
const BEHAVIOURS = {
  chaser(g, e, t, d, ang, dt) {
    const a = e.def.attack;
    if (d > a.range * 0.7) { e.setState('chase'); steer(e, ang, 1, dt); }
    else { e.setState('attack'); stop(e); }
    if (d <= a.range + t.r) tryAttack(g, e, ang);
  },

  shooter(g, e, t, d, ang, dt) {
    const pref = e.def.prefDist;
    if (d < pref - 70) { e.setState('chase'); steer(e, ang + Math.PI, 1, dt); }
    else if (d > pref + 70) { e.setState('chase'); steer(e, ang, 1, dt); }
    else { e.setState('attack'); steer(e, ang + (Math.PI / 2) * e.ai.dir, 0.55, dt); }
    if (Math.random() < dt * 0.4) e.ai.dir *= -1;
    if (d < e.def.attack.range) tryAttack(g, e, ang + rand(-0.08, 0.08));
  },

  bomber(g, e, t, d, ang, dt) {
    if (e.state === 'fuse') {
      stop(e);
      if (e.stateT >= 0.7) explode(g, e);
      return;
    }
    e.setState('chase');
    steer(e, ang, 1, dt);
    if (d < e.r + t.r + 26) { e.setState('fuse'); sfx.play('click'); }
  },

  charger(g, e, t, d, ang, dt) {
    const c = e.def.charge, a = e.def.attack;
    switch (e.state) {
      case 'windup':
        stop(e); e.angle = ang; e.ai.chargeAng = ang;
        if (e.stateT >= c.windup) { e.setState('charge'); }
        break;
      case 'charge':
        e.moveX = Math.cos(e.ai.chargeAng); e.moveY = Math.sin(e.ai.chargeAng);
        e.speed = c.speed;
        if (d < e.r + t.r + 8) tryAttack(g, e, ang);
        if (e.stateT >= c.time) { e.speed = undefined; e.setState('recover'); }
        break;
      case 'recover':
        stop(e);
        if (e.stateT >= c.recover) e.setState('idle');
        break;
      default:
        e.speed = undefined;
        if (d < c.trigger && d > a.range * 1.5) { e.setState('windup'); break; }
        steer(e, ang, 1, dt);
        if (d <= a.range + t.r) tryAttack(g, e, ang);
    }
  },
};

function stop(e) { e.moveX = 0; e.moveY = 0; }

/** Move along `ang`; if wedged against an obstacle, sidestep for a moment. */
function steer(e, ang, strength, dt) {
  const ai = e.ai;
  ai.stuckT += dt;
  if (ai.stuckT > 0.35) {
    const moved = Math.hypot(e.x - ai.lastX, e.y - ai.lastY);
    if (moved < 6 && strength > 0) { ai.steerT = 0.7; ai.steer = (Math.random() < 0.5 ? 1 : -1) * Math.PI * 0.45; }
    ai.lastX = e.x; ai.lastY = e.y; ai.stuckT = 0;
  }
  if (ai.steerT > 0) { ai.steerT -= dt; ang += ai.steer; }
  e.moveX = Math.cos(ang) * strength;
  e.moveY = Math.sin(ang) * strength;
}

function explode(g, e) {
  const b = e.def.blast;
  damageCircle(g, e, e.x, e.y, b.radius, b.damage * e.dmgScale);
  g.fx.ring(e.x, e.y, b.radius, '#ffd23a');
  g.fx.burst(e.x, e.y, 24, '#ffb13a', 300);
  g.camera.addShake(8);
  sfx.play('explode');
  killEntity(g, e, null);
}

export function updateAI(g, e, dt) {
  if (e.dead) return;
  e.stateT += dt;
  const t = g.player;
  if (t.dead) { stop(e); e.setState('idle'); return; }
  const d = dist(e.x, e.y, t.x, t.y);
  const ang = angleTo(e.x, e.y, t.x, t.y);
  if (e.state !== 'windup' && e.state !== 'charge') e.angle = ang;
  BEHAVIOURS[e.def.ai](g, e, t, d, ang, dt);
}
