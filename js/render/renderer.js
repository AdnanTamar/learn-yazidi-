import { clamp, seededRng } from '../core/util.js';
import { drawShape } from './shapes.js';

// Canvas renderer. The static map is pre-rendered once into an offscreen canvas.
export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.light = document.createElement('canvas');
    this.lctx = this.light.getContext('2d');
    this.mapCache = null;
    this.w = 800; this.h = 600; this.dpr = 1;
  }

  resize(w, h) {
    this.dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    this.w = w; this.h = h;
    this.canvas.width = Math.round(w * this.dpr); this.canvas.height = Math.round(h * this.dpr);
    this.light.width = Math.round(w * this.dpr); this.light.height = Math.round(h * this.dpr);
  }

  setMap(map) { this.mapCache = buildMapCache(map); }

  draw(g) {
    const { ctx, dpr } = this;
    const cam = g.camera;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#05060a';
    ctx.fillRect(0, 0, this.w, this.h);
    ctx.save();
    ctx.translate(-Math.round(cam.x + cam.shx), -Math.round(cam.y + cam.shy));
    ctx.drawImage(this.mapCache, 0, 0);
    this.drawHazards(g);
    this.drawPickups(g);
    this.drawTelegraphs(g);
    const list = g.entities.slice().sort((a, b) => a.y - b.y);
    for (const e of list) this.drawEntity(e, g);
    this.drawProjectiles(g);
    this.drawEffects(g);
    ctx.restore();
    this.drawLighting(g);
    this.drawOffscreenMarkers(g);
  }

  drawHazards(g) {
    const ctx = this.ctx, t = g.time;
    for (const h of g.map.hazards) {
      ctx.fillStyle = `rgba(255,${90 + Math.sin(t * 3 + h.x) * 30 | 0},30,0.9)`;
      ctx.fillRect(h.x, h.y, h.w, h.h);
      ctx.fillStyle = 'rgba(255,220,120,0.35)';
      for (let i = 0; i < 4; i++) {
        const px = h.x + ((i * 53 + t * 20) % h.w), py = h.y + ((i * 37 + Math.sin(t + i) * 10 + h.h) % h.h);
        ctx.fillRect(px, py, 14, 6);
      }
    }
  }

  drawPickups(g) {
    const ctx = this.ctx, t = g.time;
    ctx.fillStyle = '#ffe14d';
    for (const o of g.orbs) {
      ctx.beginPath(); ctx.arc(o.x, o.y, 5 + Math.sin(t * 8 + o.x) * 0.8, 0, Math.PI * 2); ctx.fill();
    }
    for (const k of g.pickups) {
      if (k.life < 4 && Math.floor(k.life * 6) % 2) continue;
      ctx.font = '20px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('❤️', k.x, k.y + Math.sin(t * 4) * 3);
    }
  }

  drawTelegraphs(g) {
    const ctx = this.ctx;
    for (const e of g.entities) {
      if (e.dead) continue;
      if (e.state === 'windup') { // charger lane
        const c = e.def.charge, len = (c.speed * c.time);
        ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.angle);
        ctx.fillStyle = `rgba(255,60,60,${0.15 + 0.3 * Math.min(1, e.stateT / c.windup)})`;
        ctx.fillRect(0, -e.r, len, e.r * 2);
        ctx.restore();
      } else if (e.state === 'fuse') {
        ctx.strokeStyle = `rgba(255,210,60,${0.4 + 0.4 * Math.sin(e.stateT * 30)})`;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(e.x, e.y, e.def.blast.radius, 0, Math.PI * 2); ctx.stroke();
      }
    }
  }

  drawEntity(e, g) {
    const ctx = this.ctx;
    let scale = 1, alpha = 1;
    if (e.dead) { const k = clamp(e.deathT / 0.4, 0, 1); scale = 1 - k * 0.6; alpha = 1 - k; }
    if (e.invuln > 0 && !e.dead && e.isPlayer) alpha = 0.55 + 0.25 * Math.sin(g.time * 40);
    if (e.invuln > 0 && !e.isPlayer) alpha = 0.5;
    ctx.globalAlpha = alpha;
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(e.x, e.y + e.r * 0.8, e.r * scale, e.r * 0.45 * scale, 0, 0, Math.PI * 2); ctx.fill();
    const fuse = e.state === 'fuse' && Math.floor(e.stateT * 14) % 2;
    const fill = e.flash > 0 || fuse ? '#ffffff' : e.def.color;
    const rot = e.def.shape === 'circle' ? 0 : e.angle;
    drawShape(ctx, e.def, e.x, e.y, e.r * scale, rot, fill);
    if (!e.dead) {
      // facing marker (weapon / eye)
      ctx.fillStyle = '#111';
      ctx.beginPath(); ctx.arc(e.x + Math.cos(e.angle) * e.r * 0.55, e.y + Math.sin(e.angle) * e.r * 0.55, Math.max(2.5, e.r * 0.2), 0, Math.PI * 2); ctx.fill();
      if (!e.isPlayer && e.hp < e.maxHp) {
        const w = Math.max(26, e.r * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(e.x - w / 2, e.y - e.r - 12, w, 5);
        ctx.fillStyle = '#e55'; ctx.fillRect(e.x - w / 2, e.y - e.r - 12, w * e.hpRatio, 5);
      }
    }
    ctx.globalAlpha = 1;
  }

  drawProjectiles(g) {
    const ctx = this.ctx;
    for (const p of g.projectiles) {
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = p.team === 'player' ? 'rgba(255,255,255,0.35)' : 'rgba(255,60,60,0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03); ctx.stroke();
    }
  }

  drawEffects(g) {
    const ctx = this.ctx, fx = g.fx;
    for (const a of fx.arcs) {
      ctx.globalAlpha = a.life / a.max * 0.7;
      ctx.fillStyle = a.color;
      ctx.beginPath(); ctx.moveTo(a.x, a.y);
      ctx.arc(a.x, a.y, a.range, a.angle - a.arc / 2, a.angle + a.arc / 2); ctx.closePath(); ctx.fill();
    }
    for (const r of fx.rings) {
      const k = 1 - r.life / r.max;
      ctx.globalAlpha = 1 - k; ctx.strokeStyle = r.color; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(r.x, r.y, r.r * (0.3 + 0.7 * k), 0, Math.PI * 2); ctx.stroke();
    }
    for (const p of fx.particles) {
      ctx.globalAlpha = p.life / p.max; ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const t of fx.texts) {
      ctx.globalAlpha = clamp(t.life / 0.4, 0, 1);
      ctx.font = 'bold 15px system-ui, sans-serif';
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.strokeText(t.str, t.x, t.y);
      ctx.fillStyle = t.color; ctx.fillText(t.str, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }

  /** Night: dark overlay with a soft light around the player. */
  drawLighting(g) {
    const dark = 1 - g.daynight.light;
    const { ctx, lctx, dpr } = this;
    if (dark <= 0.01) return;
    const cam = g.camera, p = g.player;
    lctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    lctx.globalCompositeOperation = 'source-over';
    lctx.clearRect(0, 0, this.w, this.h);
    lctx.fillStyle = `rgba(6,10,38,${0.8 * dark})`;
    lctx.fillRect(0, 0, this.w, this.h);
    lctx.globalCompositeOperation = 'destination-out';
    const x = p.x - cam.x - cam.shx, y = p.y - cam.y - cam.shy, r = 340;
    const grad = lctx.createRadialGradient(x, y, 40, x, y, r);
    grad.addColorStop(0, 'rgba(0,0,0,1)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
    lctx.fillStyle = grad;
    lctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.light, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /** Arrows at the screen edge pointing at off-screen enemies (keeps night play fair). */
  drawOffscreenMarkers(g) {
    const ctx = this.ctx, cam = g.camera, p = g.player;
    if (p.dead) return;
    const cx = this.w / 2, cy = this.h / 2;
    let n = 0;
    for (const e of g.entities) {
      if (e.isPlayer || e.dead) continue;
      const sx = e.x - cam.x, sy = e.y - cam.y;
      if (sx > -20 && sx < this.w + 20 && sy > -20 && sy < this.h + 20) continue;
      if (++n > 12) break;
      const a = Math.atan2(sy - cy, sx - cx);
      const k = Math.min((cx - 24) / Math.abs(Math.cos(a) || 1e-6), (cy - 24) / Math.abs(Math.sin(a) || 1e-6));
      const x = cx + Math.cos(a) * k, y = cy + Math.sin(a) * k;
      ctx.fillStyle = e.def.color; ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * 9, y + Math.sin(a) * 9);
      ctx.lineTo(x + Math.cos(a + 2.5) * 8, y + Math.sin(a + 2.5) * 8);
      ctx.lineTo(x + Math.cos(a - 2.5) * 8, y + Math.sin(a - 2.5) * 8);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

function buildMapCache(map) {
  const c = document.createElement('canvas');
  c.width = map.w; c.height = map.h;
  const ctx = c.getContext('2d');
  const th = map.theme, rng = seededRng(map.seed);
  ctx.fillStyle = th.ground; ctx.fillRect(0, 0, map.w, map.h);
  // checker tiles
  ctx.fillStyle = th.ground2;
  for (let y = 0; y < map.h; y += 100) for (let x = (y / 100) % 2 ? 0 : 100; x < map.w; x += 200) ctx.fillRect(x, y, 100, 100);
  // decoration
  ctx.strokeStyle = th.decor; ctx.fillStyle = th.decor; ctx.lineWidth = 2;
  for (let i = 0; i < 420; i++) {
    const x = rng() * map.w, y = rng() * map.h;
    ctx.beginPath();
    if (map.decor === 'grass') { ctx.moveTo(x, y); ctx.lineTo(x - 3, y - 9); ctx.moveTo(x, y); ctx.lineTo(x + 3, y - 8); ctx.moveTo(x, y); ctx.lineTo(x, y - 11); ctx.stroke(); }
    else if (map.decor === 'cracks') { ctx.moveTo(x, y); ctx.lineTo(x + 14, y + 6); ctx.lineTo(x + 22, y + 2); ctx.stroke(); }
    else { ctx.arc(x, y, 1 + rng() * 2.5, 0, Math.PI * 2); ctx.fill(); }
  }
  // lava glow rims
  if (th.hazard) for (const h of map.hazards) { ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(h.x - 6, h.y - 6, h.w + 12, h.h + 12); }
  // obstacles
  for (const o of map.obstacles) {
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(o.x + 6, o.y + 8, o.w, o.h);
    ctx.fillStyle = th.obstacle; ctx.fillRect(o.x, o.y, o.w, o.h);
    ctx.fillStyle = th.obstacleTop; ctx.fillRect(o.x, o.y, o.w, Math.min(10, o.h / 3));
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2; ctx.strokeRect(o.x, o.y, o.w, o.h);
  }
  // border
  ctx.strokeStyle = th.border; ctx.lineWidth = 24; ctx.strokeRect(0, 0, map.w, map.h);
  return c;
}
