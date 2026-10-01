import { Camera } from './core/camera.js';
import { Input } from './core/input.js';
import { angleTo, circleOverlapsRect, clamp, dist, rand, store } from './core/util.js';
import { sfx } from './core/audio.js';
import { CHARACTERS } from './data/characters.js';
import { ENEMIES } from './data/enemies.js';
import { MAPS } from './data/maps.js';
import { MODES } from './data/modes.js';
import { Entity } from './entities/entity.js';
import { updateAI } from './systems/ai.js';
import { heal, tryAbility, tryAttack, updateProjectiles } from './systems/combat.js';
import { DayNight } from './systems/daynight.js';
import { Effects } from './systems/effects.js';
import { separate, updateMovement } from './systems/movement.js';
import { gainXp, rollUpgrades } from './systems/progression.js';

// Game owns the world state and the frame loop. States:
//   menu | playing | paused | levelup | gameover | victory
export class Game {
  constructor(canvas, renderer, ui) {
    this.canvas = canvas;
    this.renderer = renderer;
    this.ui = ui;
    this.input = new Input(canvas);
    this.camera = new Camera();
    this.fx = new Effects();
    this.daynight = new DayNight();
    this.state = 'menu';
    this.cfg = null;
    this.entities = []; this.projectiles = []; this.orbs = []; this.pickups = [];
    this.player = null;
    this.map = MAPS.meadow;
    this.mode = MODES.survival;
    this.time = 0;
    this.input.onPressed = (code) => this.onKey(code);
    this.abilityQueued = false;
  }

  // ---------- lifecycle ----------
  start(cfg) {
    this.cfg = { ...cfg };
    this.map = MAPS[cfg.map];
    this.mode = MODES[cfg.mode];
    this.entities = []; this.projectiles = []; this.orbs = []; this.pickups = [];
    this.fx.clear();
    this.daynight.reset();
    this.kills = 0; this.xp = 0; this.level = 1; this.pendingLevelUps = 0; this.time = 0;
    this.endTimer = 0; this.wave = 0; this.upgradeCounts = {}; this.choices = [];
    const p = new Entity(CHARACTERS[cfg.char], 'player', this.map.spawn.x, this.map.spawn.y);
    p.isPlayer = true;
    this.player = p;
    this.entities.push(p);
    this.mode.init(this);
    this.camera.snap(p.x, p.y, this.map);
    this.renderer.setMap(this.map);
    this.input.reset();
    this.abilityQueued = false;
    this.setState('playing');
  }

  restart() { this.start(this.cfg); }
  toMenu() { this.setState('menu'); }

  setState(s) {
    this.state = s;
    this.ui.onState(s, this);
  }

  pause() { if (this.state === 'playing') { this.input.reset(); this.setState('paused'); } }
  resume() { if (this.state === 'paused') { this.input.reset(); this.setState('playing'); } }

  onKey(code) {
    if (code === 'Escape' || code === 'KeyP') {
      if (this.state === 'playing') this.pause(); else if (this.state === 'paused') this.resume();
    } else if (this.state === 'playing') {
      if (code === 'KeyN') this.toggleDayNight();
      if (code === 'KeyM') this.ui.toggleMute();
    } else if (this.state === 'levelup' && ['Digit1', 'Digit2', 'Digit3'].includes(code)) {
      this.chooseUpgrade(+code.slice(-1) - 1);
    }
  }

  toggleDayNight() {
    if (this.state !== 'playing') return;
    if (this.daynight.toggle()) { sfx.play('toggle'); this.toast(this.daynight.isNight ? 'Night falls — enemies are stronger, XP +50%' : 'Day breaks — health regenerates'); }
  }

  // ---------- world helpers ----------
  aliveEnemies() { let n = 0; for (const e of this.entities) if (!e.isPlayer && !e.dead) n++; return n; }

  toast(msg) { this.ui.toast(msg); }

  findSpawn() {
    const { map, player } = this;
    for (let i = 0; i < 20; i++) {
      const a = rand(0, Math.PI * 2), d = rand(420, 700);
      const x = clamp(player.x + Math.cos(a) * d, 40, map.w - 40);
      const y = clamp(player.y + Math.sin(a) * d, 40, map.h - 40);
      if (dist(x, y, player.x, player.y) < 350) continue;
      if (map.obstacles.some((o) => circleOverlapsRect(x, y, 40, o))) continue;
      if (map.hazards.some((h) => circleOverlapsRect(x, y, 40, h))) continue;
      return { x, y };
    }
    return { x: clamp(map.w - player.x, 40, map.w - 40), y: clamp(map.h - player.y, 40, map.h - 40) };
  }

  spawnEnemy(id) {
    const def = ENEMIES[id];
    const lvl = Math.max(0, this.wave - 1);
    const e = new Entity(def, 'enemy', 0, 0, { hp: 1 + lvl * 0.14, dmg: 1 + lvl * 0.07 });
    const s = this.findSpawn();
    e.x = s.x; e.y = s.y;
    e.invuln = 0.5;
    this.entities.push(e);
    this.fx.ring(e.x, e.y, 30, def.color);
    return e;
  }

  onEnemyKilled(e) {
    this.kills++;
    this.orbs.push({ x: e.x, y: e.y, value: e.def.xp, vx: rand(-80, 80), vy: rand(-80, 80) });
    if (Math.random() < 0.08) this.pickups.push({ x: e.x + rand(-20, 20), y: e.y + rand(-20, 20), kind: 'heart', life: 15 });
    sfx.play('kill');
  }

  onPlayerDeath() { this.endTimer = 0; this.camera.addShake(14); }

  chooseUpgrade(i) {
    const u = this.choices[i];
    if (!u) return;
    u.apply(this, this.player);
    this.upgradeCounts[u.id] = (this.upgradeCounts[u.id] || 0) + 1;
    this.pendingLevelUps--;
    sfx.play('pickup');
    if (this.pendingLevelUps > 0) { this.choices = rollUpgrades(); this.ui.onState('levelup', this); }
    else { this.input.reset(); this.setState('playing'); }
  }

  score() { return this.kills * 10 + this.level * 50 + this.wave * 100; }

  finish(result) {
    const key = 'best:' + this.cfg.mode;
    const best = store.get(key, 0);
    this.newBest = this.score() > best;
    if (this.newBest) store.set(key, this.score());
    this.setState(result);
  }

  // ---------- frame ----------
  update(dt) {
    const p = this.player;
    this.time += dt;
    this.controlPlayer(dt);
    if (this.daynight.update(dt)) this.toast(this.daynight.isNight ? 'Night falls — enemies are stronger, XP +50%' : 'Day breaks — health regenerates');
    this.mode.update(this, dt);

    for (const e of this.entities) {
      e.atkCd = Math.max(0, e.atkCd - dt);
      e.abCd = Math.max(0, e.abCd - dt);
      e.invuln = Math.max(0, e.invuln - dt);
      e.flash = Math.max(0, e.flash - dt);
      if (e.dead) { e.deathT += dt; continue; }
      if (!e.isPlayer) updateAI(this, e, dt);
      updateMovement(this, e, dt);
    }
    separate(this);
    updateProjectiles(this, dt);
    this.updatePickups(dt);
    this.fx.update(dt);

    this.entities = this.entities.filter((e) => e.isPlayer || !e.dead || e.deathT < 0.4);

    if (!p.dead) {
      const regen = p.mods.regen + this.daynight.playerRegen;
      if (regen > 0) p.hp = Math.min(p.maxHp, p.hp + regen * dt);
      this.camera.follow(p.x, p.y, this.map, dt);
      if (this.mode.result(this) === 'won') this.finish('victory');
      else if (this.pendingLevelUps > 0) { this.choices = rollUpgrades(); this.input.reset(); this.setState('levelup'); }
    } else {
      this.camera.follow(p.x, p.y, this.map, dt);
      if ((this.endTimer += dt) > 1.1) this.finish('gameover');
    }
  }

  controlPlayer() {
    const p = this.player, inp = this.input;
    if (p.dead) { p.moveX = p.moveY = 0; return; }
    const mv = inp.moveVector();
    p.moveX = mv.x; p.moveY = mv.y;
    const aim = this.camera.toWorld(inp.mouse.x, inp.mouse.y);
    this.aim = aim;
    p.angle = angleTo(p.x, p.y, aim.x, aim.y);
    if (inp.mouse.down) tryAttack(this, p, p.angle);
    else if (inp.isDown('KeyJ')) {
      // Keyboard-only attack: auto-aim at nearest enemy (or current facing).
      let best = null, bd = 1e9;
      for (const e of this.entities) if (!e.isPlayer && !e.dead) { const d = dist(p.x, p.y, e.x, e.y); if (d < bd) { bd = d; best = e; } }
      tryAttack(this, p, best ? angleTo(p.x, p.y, best.x, best.y) : p.angle);
    }
    if (inp.consume('Space') || inp.consume('MouseRight') || inp.consume('KeyE') || this.abilityQueued) {
      this.abilityQueued = false;
      tryAbility(this, p, p.angle);
    }
  }

  updatePickups(dt) {
    const p = this.player;
    const magnet = 100 * p.mods.magnet;
    for (let i = this.orbs.length - 1; i >= 0; i--) {
      const o = this.orbs[i];
      const d = dist(o.x, o.y, p.x, p.y);
      if (!p.dead && d < magnet) {
        const a = angleTo(o.x, o.y, p.x, p.y), s = 260 + (magnet - d) * 4;
        o.vx = Math.cos(a) * s; o.vy = Math.sin(a) * s;
      } else { o.vx *= 0.9; o.vy *= 0.9; }
      o.x += o.vx * dt; o.y += o.vy * dt;
      if (!p.dead && d < p.r + 8) {
        gainXp(this, o.value);
        this.fx.text(p.x, p.y - 20, '+' + Math.round(o.value * this.daynight.xpMult) + ' XP', '#ffe14d');
        sfx.play('pickup');
        this.orbs.splice(i, 1);
      }
    }
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const k = this.pickups[i];
      k.life -= dt;
      if (k.life <= 0) { this.pickups.splice(i, 1); continue; }
      if (!p.dead && dist(k.x, k.y, p.x, p.y) < p.r + 14) {
        heal(this, p, p.maxHp * 0.2);
        sfx.play('pickup');
        this.pickups.splice(i, 1);
      }
    }
  }

  frame(dt) {
    if (this.state === 'playing') this.update(dt);
    if (this.state !== 'menu') {
      this.renderer.draw(this);
      this.ui.updateHud(this);
    }
  }
}
