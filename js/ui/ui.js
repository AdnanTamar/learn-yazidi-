import { CHARACTERS } from '../data/characters.js';
import { ABILITIES } from '../data/abilities.js';
import { MAPS } from '../data/maps.js';
import { MODES } from '../data/modes.js';
import { ENEMIES } from '../data/enemies.js';
import { xpForNext } from '../systems/progression.js';
import { drawShape } from '../render/shapes.js';
import { sfx } from '../core/audio.js';
import { store } from '../core/util.js';

const $ = (id) => document.getElementById(id);
const SCREENS = ['menu', 'pause', 'levelup', 'gameover'];

// DOM-side UI: menu, HUD, overlays. Talks to the game only via its public methods.
export class UI {
  constructor() {
    this.game = null;
    this.sel = { char: 'knight', map: 'meadow', mode: 'survival', ...store.get('selection', {}) };
    if (!CHARACTERS[this.sel.char]) this.sel.char = 'knight';
    if (!MAPS[this.sel.map]) this.sel.map = 'meadow';
    if (!MODES[this.sel.mode]) this.sel.mode = 'survival';
    this.cache = {};
    this.toastTimer = 0;
  }

  bind(game) {
    this.game = game;
    this.buildMenu();
    const on = (id, fn) => $(id).addEventListener('click', () => { sfx.play('click'); fn(); });
    on('btn-start', () => game.start(this.sel));
    on('btn-help', () => $('help').classList.toggle('hidden'));
    on('btn-pause', () => game.pause());
    on('btn-resume', () => game.resume());
    on('btn-restart-pause', () => game.restart());
    on('btn-menu-pause', () => game.toMenu());
    on('btn-restart', () => game.restart());
    on('btn-menu', () => game.toMenu());
    on('btn-daynight', () => game.toggleDayNight());
    on('btn-mute', () => this.toggleMute());
    $('btn-ability').addEventListener('click', () => { if (game.state === 'playing') game.abilityQueued = true; });
    // keep HUD buttons from stealing keyboard focus (space would re-click them)
    document.querySelectorAll('button').forEach((b) => b.addEventListener('mouseup', () => b.blur()));
    this.onState('menu', game);
  }

  toggleMute() { const m = sfx.toggleMute(); $('btn-mute').textContent = m ? '🔇' : '🔊'; }

  buildMenu() {
    const chars = $('chars'), maps = $('maps'), modes = $('modes');
    chars.innerHTML = maps.innerHTML = modes.innerHTML = '';
    for (const c of Object.values(CHARACTERS)) {
      const b = el('button', 'card', chars);
      b.dataset.id = c.id;
      const cv = el('canvas', '', b); cv.width = cv.height = 48;
      drawShape(cv.getContext('2d'), c, 24, 24, 17, -Math.PI / 2);
      el('strong', '', b).textContent = c.name;
      el('em', '', b).textContent = c.role;
      el('small', '', b).textContent = `${c.desc} [${ABILITIES[c.ability].icon} ${ABILITIES[c.ability].name}]`;
      b.addEventListener('click', () => this.select('char', c.id));
    }
    for (const m of Object.values(MAPS)) {
      const b = el('button', 'card', maps);
      b.dataset.id = m.id;
      const cv = el('canvas', 'mapicon', b); cv.width = 96; cv.height = 56;
      drawMapIcon(cv.getContext('2d'), m);
      el('strong', '', b).textContent = m.name;
      el('small', '', b).textContent = m.desc;
      b.addEventListener('click', () => this.select('map', m.id));
    }
    for (const m of Object.values(MODES)) {
      const b = el('button', 'card wide', modes);
      b.dataset.id = m.id;
      el('strong', '', b).textContent = m.name;
      el('small', '', b).textContent = m.desc;
      b.addEventListener('click', () => this.select('mode', m.id));
    }
    const foes = $('foes');
    foes.innerHTML = '';
    for (const e of Object.values(ENEMIES)) {
      const s = el('span', 'foe', foes);
      const cv = el('canvas', '', s); cv.width = cv.height = 28;
      drawShape(cv.getContext('2d'), e, 14, 14, 9);
      s.append(' ' + e.name);
    }
    this.refreshSelection();
  }

  select(kind, id) {
    this.sel[kind] = id;
    store.set('selection', this.sel);
    sfx.play('click');
    this.refreshSelection();
  }

  refreshSelection() {
    for (const [kind, host] of [['char', 'chars'], ['map', 'maps'], ['mode', 'modes']]) {
      for (const b of $(host).children) b.classList.toggle('selected', b.dataset.id === this.sel[kind]);
    }
    $('best').textContent = `Best score (${MODES[this.sel.mode].name}): ${store.get('best:' + this.sel.mode, 0)}`;
  }

  onState(state, game) {
    $('menu').classList.toggle('hidden', state !== 'menu');
    $('pause').classList.toggle('hidden', state !== 'paused');
    $('levelup').classList.toggle('hidden', state !== 'levelup');
    $('gameover').classList.toggle('hidden', state !== 'gameover' && state !== 'victory');
    $('hud').classList.toggle('hidden', state === 'menu');
    if (state === 'menu') this.refreshSelection();
    if (state === 'levelup') this.showLevelUp(game);
    if (state === 'gameover' || state === 'victory') this.showEnd(state, game);
    if (state === 'playing') this.cache = {};
    if (state === 'menu') $('btn-start').focus();
  }

  showLevelUp(game) {
    const host = $('upgrade-choices');
    host.innerHTML = '';
    $('lu-level').textContent = `Level ${game.level}`;
    game.choices.forEach((u, i) => {
      const b = el('button', 'card upgrade', host);
      el('span', 'icon', b).textContent = u.icon;
      el('strong', '', b).textContent = `${i + 1}. ${u.name}`;
      el('small', '', b).textContent = u.desc + (game.upgradeCounts[u.id] ? ` (owned ×${game.upgradeCounts[u.id]})` : '');
      b.addEventListener('click', () => game.chooseUpgrade(i));
    });
  }

  showEnd(state, g) {
    const won = state === 'victory';
    $('end-title').textContent = won ? 'Victory!' : 'You Were Defeated';
    $('end-title').className = won ? 'win' : 'lose';
    const t = Math.floor(g.time);
    $('end-stats').innerHTML =
      `<div><b>${g.score()}</b><span>Score${g.newBest ? ' — NEW BEST!' : ''}</span></div>` +
      `<div><b>${g.kills}</b><span>Enemies defeated</span></div>` +
      `<div><b>${g.level}</b><span>Level reached</span></div>` +
      `<div><b>${g.mode.id === 'survival' ? g.wave : Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0')}</b><span>${g.mode.id === 'survival' ? 'Wave' : 'Time'}</span></div>`;
  }

  toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
  }

  /** Update HUD text only when a value actually changed. */
  updateHud(g) {
    const p = g.player, c = this.cache;
    const set = (key, val, fn) => { if (c[key] !== val) { c[key] = val; fn(val); } };
    const hp = Math.ceil(p.hp);
    set('hp', hp + '/' + p.maxHp, (v) => { $('hp-text').textContent = v; $('hp-fill').style.width = (p.hp / p.maxHp * 100) + '%'; });
    $('hp-fill').style.width = (p.hp / p.maxHp * 100).toFixed(1) + '%';
    const need = xpForNext(g.level);
    $('xp-fill').style.width = (g.xp / need * 100).toFixed(1) + '%';
    set('lvl', `${p.def.name} · Lv ${g.level} · XP ${g.xp}/${need}`, (v) => { $('xp-text').textContent = v; });
    set('mode', g.mode.label(g), (v) => { $('mode-label').textContent = v; });
    set('kills', g.kills, (v) => { $('kills').textContent = `Kills ${v}`; });
    const night = g.daynight.isNight;
    set('dn', night + ':' + Math.ceil(g.daynight.remaining), () => {
      $('btn-daynight').textContent = `${night ? '🌙 Night' : '☀️ Day'} ${Math.ceil(g.daynight.remaining)}s`;
      $('btn-daynight').title = night ? 'Night: enemies +25% damage, +10% speed, XP +50%. Click or press N to switch.' : 'Day: you regenerate health. Click or press N to switch.';
    });
    const ab = ABILITIES[p.def.ability];
    const total = ab.cooldown * p.mods.cd;
    $('ab-cd').style.height = (p.abCd > 0 ? (p.abCd / total) * 100 : 0).toFixed(0) + '%';
    set('ab', ab.id + Math.ceil(p.abCd), () => {
      $('ab-icon').textContent = ab.icon;
      $('ab-name').textContent = p.abCd > 0 ? p.abCd.toFixed(1) + 's' : ab.name;
    });
    $('ab-name').textContent = p.abCd > 0 ? p.abCd.toFixed(1) + 's' : ab.name;
    $('btn-ability').classList.toggle('ready', p.abCd <= 0);
  }
}

function el(tag, cls, parent) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  parent.appendChild(e);
  return e;
}

function drawMapIcon(ctx, m) {
  const k = 96 / m.w;
  ctx.fillStyle = m.theme.ground; ctx.fillRect(0, 0, 96, 56);
  ctx.fillStyle = m.theme.obstacle;
  for (const o of m.obstacles) ctx.fillRect(o.x * k, o.y * k, Math.max(2, o.w * k), Math.max(2, o.h * k));
  ctx.fillStyle = m.theme.hazard || 'transparent';
  for (const h of m.hazards) ctx.fillRect(h.x * k, h.y * k, h.w * k, h.h * k);
}
