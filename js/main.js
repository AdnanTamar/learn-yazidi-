import { Game } from './game.js';
import { Renderer } from './render/renderer.js';
import { UI } from './ui/ui.js';

const canvas = document.getElementById('game');
const renderer = new Renderer(canvas);
const ui = new UI();
const game = new Game(canvas, renderer, ui);
ui.bind(game);

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
  renderer.resize(w, h);
  game.camera.resize(w, h);
}
window.addEventListener('resize', resize);
resize();

// Auto-pause when the tab loses focus.
document.addEventListener('visibilitychange', () => { if (document.hidden) game.pause(); });

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  game.frame(dt);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
window.__game = game; // handy for debugging in the console
