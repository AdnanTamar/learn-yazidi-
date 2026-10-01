// Tiny WebAudio synth so the game needs no asset files.
let ctx = null;
let muted = false;
const last = {};

const SOUNDS = {
  swing:   [220, 0.08, 'sawtooth', 0.05, -120],
  shoot:   [520, 0.07, 'square',   0.04, -200],
  hit:     [160, 0.08, 'square',   0.06, -60],
  hurt:    [110, 0.18, 'sawtooth', 0.09, -60],
  kill:    [300, 0.14, 'triangle', 0.07, 260],
  ability: [180, 0.25, 'sawtooth', 0.08, 360],
  level:   [440, 0.35, 'triangle', 0.09, 440],
  pickup:  [700, 0.06, 'sine',     0.05, 300],
  toggle:  [330, 0.4,  'sine',     0.07, -150],
  explode: [90,  0.3,  'sawtooth', 0.1,  -50],
  click:   [600, 0.04, 'square',   0.04, 0],
};

export const sfx = {
  get muted() { return muted; },
  toggleMute() { muted = !muted; return muted; },
  play(name) {
    if (muted) return;
    try {
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume();
      const now = ctx.currentTime;
      if (last[name] && now - last[name] < 0.04) return;
      last[name] = now;
      const [f, d, type, vol, slide] = SOUNDS[name];
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f, now);
      o.frequency.linearRampToValueAtTime(Math.max(30, f + slide), now + d);
      g.gain.setValueAtTime(vol, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + d);
      o.connect(g).connect(ctx.destination);
      o.start(now);
      o.stop(now + d);
    } catch { /* audio unavailable */ }
  },
};
