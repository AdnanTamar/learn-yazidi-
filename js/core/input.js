// Keyboard + mouse input. Gameplay code polls this; it never touches DOM events.
const MOVE_KEYS = {
  left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
  up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'],
};

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set();      // edge-triggered, cleared by consume()/endFrame()
    this.mouse = { x: 0, y: 0, down: false, right: false };
    this.onPressed = null;         // optional hook: (code) => void
    window.addEventListener('keydown', (e) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if (!e.repeat) { this.pressed.add(e.code); this.onPressed?.(e.code); }
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.reset());
    canvas.addEventListener('mousemove', (e) => this._pos(e));
    canvas.addEventListener('mousedown', (e) => {
      this._pos(e);
      if (e.button === 0) this.mouse.down = true;
      if (e.button === 2) { this.mouse.right = true; this.pressed.add('MouseRight'); }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouse.down = false;
      if (e.button === 2) this.mouse.right = false;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  _pos(e) {
    const r = this.canvas.getBoundingClientRect();
    this.mouse.x = e.clientX - r.left;
    this.mouse.y = e.clientY - r.top;
  }

  isDown(code) { return this.keys.has(code); }
  consume(code) { return this.pressed.delete(code); }
  reset() { this.keys.clear(); this.pressed.clear(); this.mouse.down = false; this.mouse.right = false; }

  /** Normalised movement vector from WASD / arrows. */
  moveVector() {
    const any = (list) => list.some((k) => this.keys.has(k));
    let x = (any(MOVE_KEYS.right) ? 1 : 0) - (any(MOVE_KEYS.left) ? 1 : 0);
    let y = (any(MOVE_KEYS.down) ? 1 : 0) - (any(MOVE_KEYS.up) ? 1 : 0);
    if (x && y) { x *= Math.SQRT1_2; y *= Math.SQRT1_2; }
    return { x, y };
  }
}
