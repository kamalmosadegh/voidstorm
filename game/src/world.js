// The world: every entity and the rules that move them. The player ship,
// five enemy kinds (one a boss), bullets, particles, pickups, the wave
// director, the combo scorer and the between-wave upgrade draft live here;
// render.js only draws what this file decides.

import { ARENA, COLORS, PLAYER, SCORE, WAVES } from './config.js';
import { mulberry32, range } from './random.js';

let nextId = 1;
const TAU = Math.PI * 2;

function dist2(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

export class World {
  constructor(sound) {
    this.sound = sound;
    this.rng = mulberry32((Math.random() * 1e9) | 0);
    this.reset();
  }

  reset() {
    this.state = 'title'; // title | playing | upgrade | over | win
    this.time = 0;
    this.score = 0;
    this.best = Number(localStorage.getItem('voidstorm-best') || 0);
    this.wave = 0;
    this.kills = 0;
    this.combo = 1;
    this.comboTimer = 0;
    this.shake = 0;
    this.flash = 0;
    this.slowmo = 0;
    this.enemies = [];
    this.bullets = [];
    this.bolts = [];
    this.particles = [];
    this.popups = [];
    this.pickups = [];
    this.spawnQueue = [];
    this.spawnTimer = 0;
    this.upgradeChoices = [];
    this.endless = false;
    this.player = this.freshPlayer();
    this.buildTitleScene();
  }

  freshPlayer() {
    return {
      id: nextId++,
      x: ARENA.width / 2,
      y: ARENA.height / 2,
      vx: 0,
      vy: 0,
      angle: -Math.PI / 2,
      radius: PLAYER.radius,
      hp: PLAYER.hp,
      maxHp: PLAYER.hp,
      fireTimer: 0,
      fireInterval: PLAYER.fireInterval,
      damage: PLAYER.bulletDamage,
      multishot: 1,
      speed: PLAYER.speed,
      dashTimer: 0,
      dashCooldown: 0,
      invuln: 0,
      shield: 0,
      magnet: 0,
      alive: true,
    };
  }

  /** Decorative enemies drifting behind the title screen. */
  buildTitleScene() {
    const rng = mulberry32(20261117);
    this.titleDrifters = [];
    for (let i = 0; i < 14; i++) {
      this.titleDrifters.push({
        kind: ['drifter', 'weaver', 'splitter', 'stinger'][i % 4],
        x: range(rng, 60, ARENA.width - 60),
        y: range(rng, 90, ARENA.height - 60),
        angle: range(rng, 0, TAU),
        spin: range(rng, -0.8, 0.8),
        speed: range(rng, 14, 40),
        radius: 16,
        t: range(rng, 0, 10),
      });
    }
  }

  startGame() {
    this.score = 0;
    this.kills = 0;
    this.wave = 0;
    this.endless = false;
    this.player = this.freshPlayer();
    this.enemies = [];
    this.bullets = [];
    this.bolts = [];
    this.pickups = [];
    this.state = 'playing';
    this.nextWave();
  }

  continueEndless() {
    this.endless = true;
    this.state = 'playing';
    this.nextWave();
  }

  nextWave() {
    this.wave++;
    const n = this.wave;
    const isBoss = n % WAVES.bossEvery === 0;
    const count = isBoss ? 6 : WAVES.count(n);
    this.spawnQueue = [];
    for (let i = 0; i < count; i++) this.spawnQueue.push(this.pickKind(n));
    if (isBoss) this.spawnQueue.push('boss');
    this.spawnTimer = 0.5;
    this.popup(ARENA.width / 2, 150, isBoss ? `WAVE ${n} — VOID TITAN` : `WAVE ${n}`, COLORS.accent, 34);
  }

  pickKind(wave) {
    const r = this.rng();
    if (wave >= 4 && r < 0.14) return 'stinger';
    if (wave >= 3 && r < 0.36) return 'splitter';
    if (wave >= 2 && r < 0.62) return 'weaver';
    return 'drifter';
  }

  spawnPoint() {
    // Spawn on the arena edge farthest from the player.
    const p = this.player;
    const corners = [
      { x: 40, y: 40 }, { x: ARENA.width - 40, y: 40 },
      { x: 40, y: ARENA.height - 40 }, { x: ARENA.width - 40, y: ARENA.height - 40 },
    ];
    corners.sort((a, b) => dist2(b, p) - dist2(a, p));
    const c = corners[this.rng() < 0.7 ? 0 : 1];
    return { x: c.x + range(this.rng, -24, 24), y: c.y + range(this.rng, -24, 24) };
  }

  makeEnemy(kind, x, y) {
    const scale = WAVES.hpScale(this.wave);
    const speed = WAVES.speedScale(this.wave);
    const base = {
      id: nextId++, kind, x, y, vx: 0, vy: 0, t: range(this.rng, 0, 10),
      angle: 0, flash: 0, shootTimer: range(this.rng, 1, 2.4),
    };
    switch (kind) {
      case 'drifter': return { ...base, radius: 16, hp: 40 * scale, maxHp: 40 * scale, speed: 118 * speed };
      case 'weaver': return { ...base, radius: 15, hp: 34 * scale, maxHp: 34 * scale, speed: 142 * speed };
      case 'splitter': return { ...base, radius: 21, hp: 85 * scale, maxHp: 85 * scale, speed: 82 * speed };
      case 'mini': return { ...base, radius: 10, hp: 18 * scale, maxHp: 18 * scale, speed: 168 * speed };
      case 'stinger': return { ...base, radius: 16, hp: 55 * scale, maxHp: 55 * scale, speed: 104 * speed };
      case 'boss': return { ...base, radius: 52, hp: 1500 * scale, maxHp: 1500 * scale, speed: 46 * speed, burstTimer: 2.2 };
      default: return base;
    }
  }

  burst(x, y, color, n, speed = 260, life = 0.55, size = 3) {
    for (let i = 0; i < n; i++) {
      const a = this.rng() * TAU;
      const s = range(this.rng, speed * 0.25, speed);
      this.particles.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: range(this.rng, life * 0.4, life), maxLife: life,
        color, size: range(this.rng, size * 0.5, size * 1.4),
      });
    }
  }

  popup(x, y, text, color = COLORS.text, size = 16) {
    this.popups.push({ x, y, text, color, size, life: 1.1 });
  }

  addScore(kind, x, y) {
    const base = SCORE[kind] || 0;
    const gained = Math.round(base * this.combo);
    this.score += gained;
    if (base >= 100) this.popup(x, y - 18, `+${gained}`, COLORS.pickupStar, 15);
    this.combo = Math.min(SCORE.comboMax, this.combo + (kind === 'boss' ? 2 : 0.25));
    this.comboTimer = SCORE.comboWindow;
  }

  killEnemy(e) {
    this.kills++;
    this.addScore(e.kind, e.x, e.y);
    const color = COLORS[e.kind] || '#fff';
    this.burst(e.x, e.y, color, e.kind === 'boss' ? 90 : 16, e.kind === 'boss' ? 420 : 280);
    this.sound.explode(e.kind === 'boss');
    if (e.kind === 'boss') {
      this.shake = Math.max(this.shake, 16);
      this.dropPickup(e.x, e.y, 'heart');
      this.dropPickup(e.x + 30, e.y + 10, 'star');
    }
    if (e.kind === 'splitter') {
      for (let i = 0; i < 3; i++) {
        const m = this.makeEnemy('mini', e.x + range(this.rng, -16, 16), e.y + range(this.rng, -16, 16));
        const a = (i / 3) * TAU + this.rng();
        m.vx = Math.cos(a) * 190;
        m.vy = Math.sin(a) * 190;
        this.enemies.push(m);
      }
    }
    if (this.rng() < 0.055) this.dropPickup(e.x, e.y, this.rng() < 0.4 ? 'heart' : 'star');
  }

  dropPickup(x, y, kind) {
    this.pickups.push({ id: nextId++, kind, x, y, radius: 11, t: 0, life: 11 });
  }

  damagePlayer(amount) {
    const p = this.player;
    if (!p.alive || p.invuln > 0 || p.dashTimer > 0) return;
    if (p.shield > 0) {
      p.shield--;
      p.invuln = 0.8;
      this.popup(p.x, p.y - 26, 'SHIELD DOWN', COLORS.accent, 14);
      this.burst(p.x, p.y, COLORS.accent, 12, 200);
      return;
    }
    p.hp -= amount;
    p.invuln = 0.9;
    this.shake = Math.max(this.shake, 9);
    this.flash = 0.35;
    this.sound.playerHit();
    this.burst(p.x, p.y, COLORS.danger, 18, 300);
    if (p.hp <= 0) {
      p.hp = 0;
      p.alive = false;
      this.slowmo = 0.9;
      this.burst(p.x, p.y, COLORS.player, 70, 430, 0.9, 4);
      this.sound.explode(true);
      setTimeout(() => this.finishRun(false), 850);
    }
  }

  finishRun(won) {
    if (this.state !== 'playing') return;
    this.state = won ? 'win' : 'over';
    if (this.score > this.best) {
      this.best = this.score;
      localStorage.setItem('voidstorm-best', String(this.best));
    }
    if (won) this.sound.victory(); else this.sound.gameOver();
  }

  /** Three upgrades drawn for the draft between waves. */
  rollUpgrades() {
    const pool = [
      { id: 'damage', name: 'Heavy Rounds', desc: '+35% bullet damage', apply: (p) => { p.damage *= 1.35; } },
      { id: 'rate', name: 'Overclock', desc: '+22% fire rate', apply: (p) => { p.fireInterval *= 0.82; } },
      { id: 'multi', name: 'Split Cannon', desc: '+1 bullet per shot', apply: (p) => { p.multishot += 1; } },
      { id: 'speed', name: 'Ion Thrusters', desc: '+14% move speed', apply: (p) => { p.speed *= 1.14; } },
      { id: 'hp', name: 'Reinforced Hull', desc: '+30 max hull, heal 30', apply: (p) => { p.maxHp += 30; p.hp = Math.min(p.maxHp, p.hp + 30); } },
      { id: 'dash', name: 'Phase Drive', desc: 'Dash recharges 35% faster', apply: (p) => { p.dashCdScale = (p.dashCdScale || 1) * 0.65; } },
      { id: 'shield', name: 'Aegis Cell', desc: '+1 shield charge', apply: (p) => { p.shield += 1; } },
      { id: 'magnet', name: 'Tractor Field', desc: 'Pickups fly to you', apply: (p) => { p.magnet += 130; } },
    ];
    const picks = [];
    const copy = [...pool];
    for (let i = 0; i < 3; i++) {
      const at = Math.floor(this.rng() * copy.length);
      picks.push(copy.splice(at, 1)[0]);
    }
    return picks;
  }

  chooseUpgrade(index) {
    const choice = this.upgradeChoices[index];
    if (!choice) return;
    choice.apply(this.player);
    this.sound.upgrade();
    this.upgradeChoices = [];
    this.state = 'playing';
    this.nextWave();
  }

  waveCleared() {
    if (!this.endless && this.wave >= WAVES.victoryWave) {
      this.finishRun(true);
      return;
    }
    this.sound.waveClear();
    this.upgradeChoices = this.rollUpgrades();
    this.state = 'upgrade';
  }

  update(dt, input) {
    this.time += dt;
    if (this.slowmo > 0) {
      this.slowmo -= dt;
      dt *= 0.35;
    }
    this.shake = Math.max(0, this.shake - dt * 30);
    this.flash = Math.max(0, this.flash - dt * 1.4);
    this.updateParticles(dt);
    this.updatePopups(dt);

    if (this.state === 'title') {
      for (const d of this.titleDrifters) {
        d.t += dt;
        d.x += Math.cos(d.angle) * d.speed * dt;
        d.y += Math.sin(d.angle) * d.speed * dt;
        if (d.x < 30 || d.x > ARENA.width - 30) d.angle = Math.PI - d.angle;
        if (d.y < 30 || d.y > ARENA.height - 30) d.angle = -d.angle;
      }
      return;
    }
    if (this.state !== 'playing') return;

    this.updatePlayer(dt, input);
    this.updateSpawning(dt);
    this.updateEnemies(dt);
    this.updateBullets(dt);
    this.updatePickups(dt);

    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 1;
    }
    if (this.spawnQueue.length === 0 && this.enemies.length === 0 && this.player.alive) {
      this.waveCleared();
    }
  }

  updatePlayer(dt, input) {
    const p = this.player;
    if (!p.alive) return;
    const axes = input.moveAxes();
    const len = Math.hypot(axes.x, axes.y) || 1;
    const dashing = p.dashTimer > 0;
    const speed = dashing ? PLAYER.dashSpeed : p.speed;
    p.vx = (axes.x / len) * speed * (axes.x !== 0 || axes.y !== 0 ? 1 : 0);
    p.vy = (axes.y / len) * speed * (axes.x !== 0 || axes.y !== 0 ? 1 : 0);
    if (input.dashHeld && p.dashCooldown <= 0 && (axes.x !== 0 || axes.y !== 0)) {
      p.dashTimer = PLAYER.dashTime;
      p.dashCooldown = PLAYER.dashCooldown * (p.dashCdScale || 1);
      this.sound.dash();
      this.burst(p.x, p.y, COLORS.player, 8, 140, 0.3, 2);
    }
    p.x = Math.min(ARENA.width - p.radius, Math.max(p.radius, p.x + p.vx * dt));
    p.y = Math.min(ARENA.height - p.radius, Math.max(p.radius, p.y + p.vy * dt));
    p.angle = Math.atan2(input.mouse.y - p.y, input.mouse.x - p.x);
    p.dashTimer = Math.max(0, p.dashTimer - dt);
    p.dashCooldown = Math.max(0, p.dashCooldown - dt);
    p.invuln = Math.max(0, p.invuln - dt);

    p.fireTimer -= dt;
    if (input.firing && p.fireTimer <= 0) {
      p.fireTimer = p.fireInterval;
      const spreadStep = 0.09;
      for (let i = 0; i < p.multishot; i++) {
        const offset = (i - (p.multishot - 1) / 2) * spreadStep;
        const a = p.angle + offset;
        this.bullets.push({
          id: nextId++, x: p.x + Math.cos(p.angle) * 18, y: p.y + Math.sin(p.angle) * 18,
          vx: Math.cos(a) * PLAYER.bulletSpeed, vy: Math.sin(a) * PLAYER.bulletSpeed,
          radius: 4, damage: p.damage, life: 0.9,
        });
      }
      this.sound.shoot();
    }
  }

  updateSpawning(dt) {
    if (this.spawnQueue.length === 0) return;
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 0.55;
      const kind = this.spawnQueue.shift();
      const at = this.spawnPoint();
      this.enemies.push(this.makeEnemy(kind, at.x, at.y));
      this.burst(at.x, at.y, '#ffffff', 6, 120, 0.3, 2);
    }
  }

  updateEnemies(dt) {
    const p = this.player;
    for (const e of this.enemies) {
      e.t += dt;
      e.flash = Math.max(0, e.flash - dt * 8);
      const toPlayer = Math.atan2(p.y - e.y, p.x - e.x);
      e.angle = toPlayer;
      let mx = Math.cos(toPlayer);
      let my = Math.sin(toPlayer);
      if (e.kind === 'weaver') {
        const side = Math.sin(e.t * 4.2) * 0.9;
        mx += Math.cos(toPlayer + Math.PI / 2) * side;
        my += Math.sin(toPlayer + Math.PI / 2) * side;
      }
      if (e.kind === 'stinger') {
        const d = Math.hypot(p.x - e.x, p.y - e.y);
        const hold = d < 300 ? -1 : d > 380 ? 1 : 0;
        mx *= hold;
        my *= hold;
        e.shootTimer -= dt;
        if (e.shootTimer <= 0 && p.alive) {
          e.shootTimer = 2.3;
          this.bolts.push({
            id: nextId++, x: e.x, y: e.y,
            vx: Math.cos(toPlayer) * 265, vy: Math.sin(toPlayer) * 265,
            radius: 6, life: 3.4,
          });
          this.sound.enemyHit();
        }
      }
      if (e.kind === 'boss') {
        e.burstTimer -= dt;
        if (e.burstTimer <= 0 && p.alive) {
          e.burstTimer = 2.6;
          for (let i = 0; i < 14; i++) {
            const a = (i / 14) * TAU + e.t;
            this.bolts.push({
              id: nextId++, x: e.x, y: e.y,
              vx: Math.cos(a) * 175, vy: Math.sin(a) * 175,
              radius: 6, life: 4.2,
            });
          }
          this.sound.explode(false);
        }
      }
      const mLen = Math.hypot(mx, my) || 1;
      e.vx += ((mx / mLen) * e.speed - e.vx) * Math.min(1, dt * 3);
      e.vy += ((my / mLen) * e.speed - e.vy) * Math.min(1, dt * 3);
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      e.x = Math.min(ARENA.width - e.radius, Math.max(e.radius, e.x));
      e.y = Math.min(ARENA.height - e.radius, Math.max(e.radius, e.y));

      if (p.alive && dist2(e, p) < (e.radius + p.radius) ** 2) {
        this.damagePlayer(e.kind === 'boss' ? 26 : 14);
        if (e.kind !== 'boss') {
          e.hp = 0;
          this.burst(e.x, e.y, COLORS[e.kind], 10, 220);
        }
      }
    }
    this.enemies = this.enemies.filter((e) => e.hp > 0);
  }

  updateBullets(dt) {
    for (const b of this.bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      for (const e of this.enemies) {
        if (e.hp > 0 && dist2(b, e) < (e.radius + b.radius) ** 2) {
          e.hp -= b.damage;
          e.flash = 1;
          b.life = 0;
          this.sound.enemyHit();
          this.burst(b.x, b.y, COLORS[e.kind], 3, 160, 0.25, 2);
          if (e.hp <= 0) this.killEnemy(e);
          break;
        }
      }
    }
    this.bullets = this.bullets.filter((b) => b.life > 0 && b.x > -20 && b.x < ARENA.width + 20 && b.y > -20 && b.y < ARENA.height + 20);
    for (const b of this.bolts) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      const p = this.player;
      if (p.alive && dist2(b, p) < (b.radius + p.radius) ** 2) {
        b.life = 0;
        this.damagePlayer(11);
      }
    }
    this.bolts = this.bolts.filter((b) => b.life > 0 && b.x > -20 && b.x < ARENA.width + 20 && b.y > -20 && b.y < ARENA.height + 20);
  }

  updatePickups(dt) {
    const p = this.player;
    for (const pk of this.pickups) {
      pk.t += dt;
      pk.life -= dt;
      const d = Math.hypot(p.x - pk.x, p.y - pk.y);
      if (p.alive && p.magnet > 0 && d < p.magnet + pk.radius) {
        pk.x += ((p.x - pk.x) / d) * 320 * dt;
        pk.y += ((p.y - pk.y) / d) * 320 * dt;
      }
      if (p.alive && d < p.radius + pk.radius + 4) {
        pk.life = 0;
        this.sound.pickup();
        if (pk.kind === 'heart') {
          p.hp = Math.min(p.maxHp, p.hp + 26);
          this.popup(p.x, p.y - 24, '+26 HULL', COLORS.pickupHeart, 15);
        } else {
          this.score += SCORE.star * this.combo;
          this.popup(pk.x, pk.y - 14, `+${SCORE.star * this.combo}`, COLORS.pickupStar, 15);
        }
        this.burst(pk.x, pk.y, pk.kind === 'heart' ? COLORS.pickupHeart : COLORS.pickupStar, 10, 170, 0.35, 2);
      }
    }
    this.pickups = this.pickups.filter((pk) => pk.life > 0);
  }

  updateParticles(dt) {
    for (const pt of this.particles) {
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= 0.92;
      pt.vy *= 0.92;
      pt.life -= dt;
    }
    this.particles = this.particles.filter((pt) => pt.life > 0);
  }

  updatePopups(dt) {
    for (const pp of this.popups) {
      pp.y -= 34 * dt;
      pp.life -= dt;
    }
    this.popups = this.popups.filter((pp) => pp.life > 0);
  }
}
