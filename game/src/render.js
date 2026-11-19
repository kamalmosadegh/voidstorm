// Every pixel of VOIDSTORM: the starfield arena, the glowing vector ships and
// enemies, the HUD, and the four screens (title, upgrade draft, game over,
// victory). The world decides; this file only draws.

import { ARENA, COLORS, SCORE } from './config.js';
import { mulberry32 } from './random.js';

const TAU = Math.PI * 2;
const stars = (() => {
  const rng = mulberry32(777);
  return Array.from({ length: 130 }, () => ({
    x: rng() * ARENA.width, y: rng() * ARENA.height,
    r: 0.6 + rng() * 1.6, tw: rng() * TAU,
  }));
})();

function polygon(ctx, x, y, radius, sides, angle) {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const a = angle + (i / sides) * TAU;
    const px = x + Math.cos(a) * radius;
    const py = y + Math.sin(a) * radius;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function glow(ctx, color, blur, draw) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  draw();
  ctx.restore();
}

export class Renderer {
  constructor(ctx) {
    this.ctx = ctx;
  }

  draw(world) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, ARENA.width, ARENA.height);
    ctx.save();
    if (world.shake > 0) {
      ctx.translate((Math.random() - 0.5) * world.shake, (Math.random() - 0.5) * world.shake);
    }
    this.drawArena(world.time);
    if (world.state === 'title') {
      this.drawTitle(world);
    } else {
      this.drawPickups(world);
      this.drawBolts(world);
      this.drawEnemies(world);
      if (world.player.alive) this.drawPlayer(world);
      this.drawBullets(world);
      this.drawParticles(world);
      this.drawPopups(world);
      this.drawHud(world);
      if (world.state === 'upgrade') this.drawUpgrade(world);
      if (world.state === 'over') this.drawEndScreen(world, false);
      if (world.state === 'win') this.drawEndScreen(world, true);
    }
    ctx.restore();
    if (world.flash > 0) {
      ctx.fillStyle = `rgba(255,56,96,${(world.flash * 0.35).toFixed(3)})`;
      ctx.fillRect(0, 0, ARENA.width, ARENA.height);
    }
  }

  drawArena(time) {
    const ctx = this.ctx;
    const grad = ctx.createRadialGradient(ARENA.width / 2, ARENA.height / 2, 120, ARENA.width / 2, ARENA.height / 2, 760);
    grad.addColorStop(0, '#0b1531');
    grad.addColorStop(1, COLORS.bg);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, ARENA.width, ARENA.height);
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 64; x < ARENA.width; x += 64) { ctx.moveTo(x, 0); ctx.lineTo(x, ARENA.height); }
    for (let y = 64; y < ARENA.height; y += 64) { ctx.moveTo(0, y); ctx.lineTo(ARENA.width, y); }
    ctx.stroke();
    for (const s of stars) {
      const a = 0.35 + 0.3 * Math.sin(time * 1.7 + s.tw);
      ctx.fillStyle = `rgba(190,220,255,${a.toFixed(3)})`;
      ctx.fillRect(s.x, s.y, s.r, s.r);
    }
    ctx.strokeStyle = 'rgba(55,244,228,0.5)';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, ARENA.width - 2, ARENA.height - 2);
  }

  drawShip(x, y, angle, color, core, scale = 1) {
    const ctx = this.ctx;
    glow(ctx, color, 16, () => {
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(angle) * 20 * scale, y + Math.sin(angle) * 20 * scale);
      ctx.lineTo(x + Math.cos(angle + 2.5) * 15 * scale, y + Math.sin(angle + 2.5) * 15 * scale);
      ctx.lineTo(x + Math.cos(angle + Math.PI) * 8 * scale, y + Math.sin(angle + Math.PI) * 8 * scale);
      ctx.lineTo(x + Math.cos(angle - 2.5) * 15 * scale, y + Math.sin(angle - 2.5) * 15 * scale);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    });
    ctx.beginPath();
    ctx.arc(x, y, 4.5 * scale, 0, TAU);
    ctx.fillStyle = core;
    ctx.fill();
  }

  drawPlayer(world) {
    const p = world.player;
    if (p.invuln > 0 && p.dashTimer <= 0 && Math.floor(world.time * 14) % 2 === 0) return; // hit flicker
    this.drawShip(p.x, p.y, p.angle, COLORS.player, COLORS.playerCore);
    if (p.shield > 0) {
      const ctx = this.ctx;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius + 9 + Math.sin(world.time * 5) * 1.5, 0, TAU);
      ctx.strokeStyle = 'rgba(55,244,228,0.65)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    if (p.dashTimer > 0) {
      const ctx = this.ctx;
      ctx.beginPath();
      ctx.moveTo(p.x - p.vx * 0.05, p.y - p.vy * 0.05);
      ctx.lineTo(p.x, p.y);
      ctx.strokeStyle = 'rgba(55,244,228,0.5)';
      ctx.lineWidth = 7;
      ctx.stroke();
    }
  }

  drawEnemies(world) {
    const ctx = this.ctx;
    for (const e of world.enemies) {
      const color = e.flash > 0.4 ? '#ffffff' : (COLORS[e.kind] || '#fff');
      glow(ctx, color, 13, () => {
        ctx.fillStyle = color;
        ctx.strokeStyle = color;
        if (e.kind === 'drifter') {
          polygon(ctx, e.x, e.y, e.radius, 3, e.angle);
          ctx.fill();
        } else if (e.kind === 'weaver') {
          polygon(ctx, e.x, e.y, e.radius, 4, e.t * 2.4);
          ctx.fill();
        } else if (e.kind === 'splitter') {
          polygon(ctx, e.x, e.y, e.radius, 6, e.t * 1.2);
          ctx.fill();
        } else if (e.kind === 'mini') {
          polygon(ctx, e.x, e.y, e.radius, 6, e.t * 3);
          ctx.fill();
        } else if (e.kind === 'stinger') {
          polygon(ctx, e.x, e.y, e.radius, 5, e.angle + Math.PI / 2);
          ctx.fill();
        } else if (e.kind === 'boss') {
          polygon(ctx, e.x, e.y, e.radius, 8, e.t * 0.7);
          ctx.fill();
          polygon(ctx, e.x, e.y, e.radius * 0.62, 8, -e.t * 1.1);
          ctx.fillStyle = '#2b0a18';
          ctx.fill();
          ctx.beginPath();
          ctx.arc(e.x, e.y, 13 + Math.sin(e.t * 4) * 2, 0, TAU);
          ctx.fillStyle = '#fff';
          ctx.fill();
        }
      });
      if (e.hp < e.maxHp) {
        const w = e.radius * 2;
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.fillRect(e.x - e.radius, e.y - e.radius - 10, w, 4);
        ctx.fillStyle = COLORS.danger;
        ctx.fillRect(e.x - e.radius, e.y - e.radius - 10, w * Math.max(0, e.hp / e.maxHp), 4);
      }
    }
  }

  drawBullets(world) {
    const ctx = this.ctx;
    glow(ctx, COLORS.bullet, 10, () => {
      ctx.fillStyle = COLORS.bullet;
      for (const b of world.bullets) {
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius, 0, TAU);
        ctx.fill();
      }
    });
  }

  drawBolts(world) {
    const ctx = this.ctx;
    glow(ctx, COLORS.enemyBolt, 12, () => {
      ctx.fillStyle = COLORS.enemyBolt;
      for (const b of world.bolts) {
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius, 0, TAU);
        ctx.fill();
      }
    });
  }

  drawPickups(world) {
    const ctx = this.ctx;
    for (const pk of world.pickups) {
      const bob = Math.sin(pk.t * 5) * 3;
      const blink = pk.life < 3 && Math.floor(pk.t * 6) % 2 === 0;
      if (blink) continue;
      if (pk.kind === 'star') {
        glow(ctx, COLORS.pickupStar, 14, () => {
          polygon(ctx, pk.x, pk.y + bob, 11, 5, pk.t * 1.8);
          ctx.fillStyle = COLORS.pickupStar;
          ctx.fill();
        });
      } else {
        glow(ctx, COLORS.pickupHeart, 14, () => {
          ctx.fillStyle = COLORS.pickupHeart;
          ctx.fillRect(pk.x - 3.5, pk.y - 10 + bob, 7, 20);
          ctx.fillRect(pk.x - 10, pk.y - 3.5 + bob, 20, 7);
        });
      }
    }
  }

  drawParticles(world) {
    const ctx = this.ctx;
    for (const pt of world.particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
    }
    ctx.globalAlpha = 1;
  }

  drawPopups(world) {
    const ctx = this.ctx;
    ctx.textAlign = 'center';
    for (const pp of world.popups) {
      ctx.globalAlpha = Math.min(1, pp.life);
      ctx.font = `700 ${pp.size}px system-ui, sans-serif`;
      ctx.fillStyle = pp.color;
      ctx.fillText(pp.text, pp.x, pp.y);
    }
    ctx.globalAlpha = 1;
  }

  drawHud(world) {
    const ctx = this.ctx;
    const p = world.player;
    ctx.textAlign = 'left';
    ctx.font = '700 26px system-ui, sans-serif';
    ctx.fillStyle = COLORS.text;
    ctx.fillText(`SCORE ${world.score.toLocaleString('en-US')}`, 22, 40);
    ctx.font = '600 15px system-ui, sans-serif';
    ctx.fillStyle = COLORS.muted;
    ctx.fillText(`BEST ${world.best.toLocaleString('en-US')}`, 22, 64);

    ctx.textAlign = 'center';
    ctx.font = '700 22px system-ui, sans-serif';
    ctx.fillStyle = COLORS.accent;
    ctx.fillText(`WAVE ${world.wave}`, ARENA.width / 2, 40);
    ctx.font = '600 14px system-ui, sans-serif';
    ctx.fillStyle = COLORS.muted;
    const left = world.enemies.length + world.spawnQueue.length;
    ctx.fillText(left > 0 ? `${left} HOSTILES LEFT` : 'SECTOR CLEAR', ARENA.width / 2, 63);

    if (world.combo > 1) {
      ctx.font = '800 24px system-ui, sans-serif';
      ctx.fillStyle = COLORS.pickupStar;
      ctx.fillText(`x${Math.floor(world.combo)} COMBO`, ARENA.width / 2, 96);
      ctx.fillStyle = 'rgba(255,231,77,0.35)';
      const w = 120 * Math.max(0, world.comboTimer / SCORE.comboWindow);
      ctx.fillRect(ARENA.width / 2 - 60, 104, w, 4);
    }

    // Hull bar and dash meter, bottom-left.
    ctx.textAlign = 'left';
    ctx.font = '700 13px system-ui, sans-serif';
    ctx.fillStyle = COLORS.muted;
    ctx.fillText('HULL', 22, ARENA.height - 44);
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(22, ARENA.height - 36, 220, 13);
    const hpFrac = Math.max(0, p.hp / p.maxHp);
    ctx.fillStyle = hpFrac > 0.35 ? COLORS.accent : COLORS.danger;
    ctx.fillRect(22, ARENA.height - 36, 220 * hpFrac, 13);
    ctx.fillStyle = COLORS.muted;
    ctx.fillText('DASH', 22, ARENA.height - 12);
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(70, ARENA.height - 20, 172, 8);
    ctx.fillStyle = COLORS.player;
    const dashFrac = 1 - Math.max(0, p.dashCooldown) / 1.6;
    ctx.fillRect(70, ARENA.height - 20, 172 * Math.min(1, dashFrac), 8);
    if (p.shield > 0) {
      ctx.fillStyle = COLORS.accent;
      ctx.fillText(`SHIELD x${p.shield}`, 260, ARENA.height - 24);
    }

    ctx.textAlign = 'right';
    ctx.font = '600 13px system-ui, sans-serif';
    ctx.fillStyle = COLORS.muted;
    ctx.fillText('WASD move · mouse aim · hold to fire · SHIFT dash · M mute', ARENA.width - 22, ARENA.height - 14);
  }

  drawTitle(world) {
    const ctx = this.ctx;
    for (const d of world.titleDrifters) {
      ctx.globalAlpha = 0.55;
      const color = COLORS[d.kind];
      polygon(ctx, d.x, d.y, d.radius, d.kind === 'splitter' || d.kind === 'mini' ? 6 : d.kind === 'stinger' ? 5 : d.kind === 'weaver' ? 4 : 3, d.t * d.spin + d.angle);
      ctx.fillStyle = color;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    this.drawShip(ARENA.width / 2, 300 + Math.sin(world.time * 1.4) * 8, -Math.PI / 2 + Math.sin(world.time * 0.7) * 0.14, COLORS.player, COLORS.playerCore, 1.6);

    ctx.textAlign = 'center';
    glow(ctx, COLORS.accent, 26, () => {
      ctx.font = '900 92px system-ui, sans-serif';
      ctx.fillStyle = COLORS.text;
      ctx.fillText('VOIDSTORM', ARENA.width / 2, 190);
    });
    ctx.font = '600 21px system-ui, sans-serif';
    ctx.fillStyle = COLORS.accent;
    ctx.fillText('A NEON ARENA SURVIVAL SHOOTER', ARENA.width / 2, 228);
    ctx.font = '400 18px system-ui, sans-serif';
    ctx.fillStyle = COLORS.muted;
    ctx.fillText('Blast the swarm, chain combos, draft an upgrade after every wave.', ARENA.width / 2, 392);
    ctx.fillText('Survive the Void Titan on wave 5 — clear wave 10 to win. How long can you last after that?', ARENA.width / 2, 420);

    const pulse = 0.75 + 0.25 * Math.sin(world.time * 4);
    ctx.globalAlpha = pulse;
    ctx.font = '800 27px system-ui, sans-serif';
    ctx.fillStyle = COLORS.pickupStar;
    ctx.fillText('CLICK OR PRESS ENTER TO PLAY', ARENA.width / 2, 500);
    ctx.globalAlpha = 1;

    ctx.font = '600 16px system-ui, sans-serif';
    ctx.fillStyle = COLORS.text;
    ctx.fillText('WASD / arrows — move      Mouse — aim      Hold click / space — fire      SHIFT — dash (brief immunity)', ARENA.width / 2, 556);
    ctx.fillStyle = COLORS.muted;
    ctx.font = '400 15px system-ui, sans-serif';
    ctx.fillText('Pink chasers ram you · orange weavers zigzag · green splitters burst into minis · purple stingers shoot back', ARENA.width / 2, 592);
    if (world.best > 0) {
      ctx.fillStyle = COLORS.pickupStar;
      ctx.font = '700 17px system-ui, sans-serif';
      ctx.fillText(`BEST SCORE ${world.best.toLocaleString('en-US')}`, ARENA.width / 2, 648);
    }
  }

  drawUpgrade(world) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(4,8,20,0.78)';
    ctx.fillRect(0, 0, ARENA.width, ARENA.height);
    ctx.textAlign = 'center';
    ctx.font = '800 38px system-ui, sans-serif';
    ctx.fillStyle = COLORS.text;
    ctx.fillText(`WAVE ${world.wave} CLEAR`, ARENA.width / 2, 218);
    ctx.font = '600 18px system-ui, sans-serif';
    ctx.fillStyle = COLORS.accent;
    ctx.fillText('Choose one upgrade — click a card or press 1, 2, 3', ARENA.width / 2, 254);
    world.upgradeChoices.forEach((choice, i) => {
      const x = ARENA.width / 2 + (i - 1) * 330 - 140;
      const y = 300;
      ctx.fillStyle = '#0d1830';
      ctx.strokeStyle = COLORS.accent;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(x, y, 280, 190, 14);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = COLORS.pickupStar;
      ctx.font = '800 30px system-ui, sans-serif';
      ctx.fillText(String(i + 1), x + 140, y + 52);
      ctx.fillStyle = COLORS.text;
      ctx.font = '800 23px system-ui, sans-serif';
      ctx.fillText(choice.name, x + 140, y + 102);
      ctx.fillStyle = COLORS.muted;
      ctx.font = '400 16px system-ui, sans-serif';
      ctx.fillText(choice.desc, x + 140, y + 138);
    });
  }

  drawEndScreen(world, won) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(4,8,20,0.8)';
    ctx.fillRect(0, 0, ARENA.width, ARENA.height);
    ctx.textAlign = 'center';
    glow(ctx, won ? COLORS.pickupStar : COLORS.danger, 22, () => {
      ctx.font = '900 72px system-ui, sans-serif';
      ctx.fillStyle = won ? COLORS.pickupStar : COLORS.danger;
      ctx.fillText(won ? 'VOID CLEARED!' : 'SHIP DOWN', ARENA.width / 2, 268);
    });
    ctx.font = '600 20px system-ui, sans-serif';
    ctx.fillStyle = COLORS.text;
    ctx.fillText(won ? 'You cleared wave 10 and broke the swarm.' : `Your ship fell on wave ${world.wave}. The void keeps the rest.`, ARENA.width / 2, 316);
    ctx.font = '800 40px system-ui, sans-serif';
    ctx.fillStyle = COLORS.accent;
    ctx.fillText(`SCORE ${world.score.toLocaleString('en-US')}`, ARENA.width / 2, 392);
    ctx.font = '600 19px system-ui, sans-serif';
    ctx.fillStyle = COLORS.muted;
    ctx.fillText(`Waves cleared ${won ? 10 : world.wave - 1} · Kills ${world.kills} · Best ${world.best.toLocaleString('en-US')}`, ARENA.width / 2, 432);
    const pulse = 0.75 + 0.25 * Math.sin(world.time * 4);
    ctx.globalAlpha = pulse;
    ctx.font = '800 24px system-ui, sans-serif';
    ctx.fillStyle = COLORS.pickupStar;
    ctx.fillText(won ? 'PRESS R TO PLAY AGAIN · ENTER FOR ENDLESS MODE' : 'PRESS R OR CLICK TO PLAY AGAIN', ARENA.width / 2, 508);
    ctx.globalAlpha = 1;
  }
}
