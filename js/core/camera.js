import { clamp } from './util.js';

// Smooth-follow camera clamped to the arena, with screen shake.
export class Camera {
  constructor() {
    this.x = 0; this.y = 0; this.w = 800; this.h = 600;
    this.shake = 0; this.shx = 0; this.shy = 0;
  }

  resize(w, h) { this.w = w; this.h = h; }

  _target(tx, ty, map) {
    const fit = (t, view, size) => (size <= view ? (size - view) / 2 : clamp(t - view / 2, 0, size - view));
    return { x: fit(tx, this.w, map.w), y: fit(ty, this.h, map.h) };
  }

  snap(tx, ty, map) { const t = this._target(tx, ty, map); this.x = t.x; this.y = t.y; }

  follow(tx, ty, map, dt) {
    const t = this._target(tx, ty, map);
    const k = 1 - Math.exp(-9 * dt);
    this.x += (t.x - this.x) * k;
    this.y += (t.y - this.y) * k;
    this.shake = Math.max(0, this.shake - dt * 30);
    this.shx = (Math.random() - 0.5) * this.shake;
    this.shy = (Math.random() - 0.5) * this.shake;
  }

  addShake(a) { this.shake = Math.min(18, this.shake + a); }
  toWorld(sx, sy) { return { x: sx + this.x, y: sy + this.y }; }
}
