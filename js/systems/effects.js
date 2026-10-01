import { rand } from '../core/util.js';

// Purely visual effects: particles, floating text, rings, melee arcs.
const MAX_PARTICLES = 220;

export class Effects {
  constructor() { this.clear(); }

  clear() { this.particles = []; this.texts = []; this.rings = []; this.arcs = []; }

  burst(x, y, n, color, speed = 160) {
    for (let i = 0; i < n && this.particles.length < MAX_PARTICLES; i++) {
      const a = rand(0, Math.PI * 2), s = rand(speed * 0.3, speed);
      const life = rand(0.25, 0.55);
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life, max: life, color, size: rand(2, 4) });
    }
  }

  text(x, y, str, color = '#fff', big = false) {
    if (this.texts.length > 40) this.texts.shift();
    this.texts.push({ x: x + rand(-8, 8), y, str, color, life: 0.8, big });
  }

  ring(x, y, r, color) { this.rings.push({ x, y, r, color, life: 0.35, max: 0.35 }); }
  arc(x, y, angle, arc, range, color) { this.arcs.push({ x, y, angle, arc, range, color, life: 0.14, max: 0.14 }); }

  update(dt) {
    const step = (list, fn) => {
      for (let i = list.length - 1; i >= 0; i--) {
        const f = list[i];
        f.life -= dt;
        if (f.life <= 0) { list[i] = list[list.length - 1]; list.pop(); } else fn?.(f);
      }
    };
    step(this.particles, (p) => { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.92; p.vy *= 0.92; });
    step(this.texts, (t) => { t.y -= 40 * dt; });
    step(this.rings);
    step(this.arcs);
  }
}
