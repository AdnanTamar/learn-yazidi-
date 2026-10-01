// Small math/geometry helpers shared by all systems.
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
export const angleTo = (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax);

export function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Push circle `c` ({x,y,r}) out of rect `r` ({x,y,w,h}). Returns true if they overlapped. */
export function resolveCircleRect(c, r) {
  const px = clamp(c.x, r.x, r.x + r.w);
  const py = clamp(c.y, r.y, r.y + r.h);
  const dx = c.x - px;
  const dy = c.y - py;
  const d2 = dx * dx + dy * dy;
  if (d2 >= c.r * c.r) return false;
  if (d2 > 0.0001) {
    const d = Math.sqrt(d2);
    const push = c.r - d;
    c.x += (dx / d) * push;
    c.y += (dy / d) * push;
  } else {
    const l = c.x - r.x, rr = r.x + r.w - c.x, t = c.y - r.y, b = r.y + r.h - c.y;
    const m = Math.min(l, rr, t, b);
    if (m === l) c.x = r.x - c.r;
    else if (m === rr) c.x = r.x + r.w + c.r;
    else if (m === t) c.y = r.y - c.r;
    else c.y = r.y + r.h + c.r;
  }
  return true;
}

export function circleOverlapsRect(x, y, rad, r) {
  const dx = x - clamp(x, r.x, r.x + r.w);
  const dy = y - clamp(y, r.y, r.y + r.h);
  return dx * dx + dy * dy < rad * rad;
}

/** Deterministic PRNG so map decoration is identical every run. */
export function seededRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem('arena:' + key);
      return v === null ? fallback : JSON.parse(v);
    } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem('arena:' + key, JSON.stringify(value)); } catch { /* ignore */ }
  },
};
