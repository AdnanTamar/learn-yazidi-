// One class for every combatant (player and enemies). Behaviour lives in systems/*.
export class Entity {
  constructor(def, team, x, y, scale = { hp: 1, dmg: 1 }) {
    this.def = def;
    this.team = team;                 // 'player' | 'enemy'
    this.isPlayer = false;
    this.x = x; this.y = y; this.r = def.radius;
    this.maxHp = Math.round(def.hp * scale.hp);
    this.hp = this.maxHp;
    this.dmgScale = scale.dmg;
    this.angle = 0;
    this.moveX = 0; this.moveY = 0;   // desired direction (-1..1)
    this.kx = 0; this.ky = 0;         // knockback velocity
    this.dash = null;
    this.atkCd = 0; this.abCd = 0;
    this.state = 'idle';              // idle | chase | attack | windup | charge | recover | fuse | dead
    this.stateT = 0;
    this.dead = false; this.deathT = 0;
    this.flash = 0; this.invuln = 0; this.hazT = 0;
    this.mods = { dmg: 1, speed: 1, atkSpeed: 1, cd: 1, regen: 0, magnet: 1 };
    this.ai = { dir: Math.random() < 0.5 ? 1 : -1, lastX: x, lastY: y, stuckT: 0, steer: 0, steerT: 0 };
  }

  setState(s) { if (this.state !== s) { this.state = s; this.stateT = 0; } }
  get hpRatio() { return this.hp / this.maxHp; }
}
