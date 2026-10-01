import { clamp } from '../core/util.js';

// Day/night cycle. Auto-switches on a timer and can be toggled manually.
//  Day:   player regenerates a little health.
//  Night: darker, enemies hit harder and move faster, but XP is boosted.
export class DayNight {
  constructor() { this.dayLen = 50; this.nightLen = 35; this.reset(); }

  reset() { this.isNight = false; this.t = 0; this.light = 1; this.lock = 0; }

  get phaseLen() { return this.isNight ? this.nightLen : this.dayLen; }
  get remaining() { return Math.max(0, this.phaseLen - this.t); }
  get xpMult() { return this.isNight ? 1.5 : 1; }
  get enemyDamageMult() { return this.isNight ? 1.25 : 1; }
  get enemySpeedMult() { return this.isNight ? 1.1 : 1; }
  get playerRegen() { return this.isNight ? 0 : 0.5; }

  /** Returns false if switching is still locked (prevents spamming). */
  toggle() {
    if (this.lock > 0) return false;
    this.isNight = !this.isNight;
    this.t = 0; this.lock = 1;
    return true;
  }

  update(dt) {
    this.lock = Math.max(0, this.lock - dt);
    this.t += dt;
    const switched = this.t >= this.phaseLen;
    if (switched) { this.lock = 0; this.toggle(); }
    const target = this.isNight ? 0 : 1;
    this.light += clamp(target - this.light, -dt / 1.5, dt / 1.5);
    return switched;
  }
}
