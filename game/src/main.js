// VOIDSTORM boot: wires the canvas, input, sound, world and renderer into the
// main loop, routes clicks and keys between the title, upgrade draft and end
// screens, and builds the frozen demo scenes the screenshots are taken from
// (#demo=play and #demo=end in the page address).

import { ARENA } from './config.js';
import { Input } from './input.js';
import { Sound } from './audio.js';
import { World } from './world.js';
import { Renderer } from './render.js';
import { mulberry32 } from './random.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const sound = new Sound();
const input = new Input(canvas);
const world = new World(sound);
const renderer = new Renderer(ctx);

/** A stand-in pilot for the play screenshot: hunts the nearest enemy, keeps
 *  its distance, fires constantly and dashes when something gets close. */
class Autopilot {
  constructor(world) {
    this.world = world;
    this.mouse = { x: 0, y: 0, down: true };
  }
  moveAxes() {
    const p = this.world.player;
    let ax = 0;
    let ay = 0;
    let nearest = null;
    let nearestD = Infinity;
    for (const e of this.world.enemies) {
      const d = (e.x - p.x) ** 2 + (e.y - p.y) ** 2;
      if (d < nearestD) { nearestD = d; nearest = e; }
    }
    if (nearest) {
      const d = Math.sqrt(nearestD) || 1;
      const away = d < 240 ? -1 : 0.25;
      ax = ((p.x - nearest.x) / d) * away + (ARENA.width / 2 - p.x) / ARENA.width * 0.4;
      ay = ((p.y - nearest.y) / d) * away + (ARENA.height / 2 - p.y) / ARENA.height * 0.4;
    }
    return { x: Math.sign(ax), y: Math.sign(ay) };
  }
  get firing() { return true; }
  get dashHeld() {
    const p = this.world.player;
    return this.world.enemies.some((e) => (e.x - p.x) ** 2 + (e.y - p.y) ** 2 < 120 ** 2);
  }
  updateAim() {
    const p = this.world.player;
    let nearest = null;
    let nearestD = Infinity;
    for (const e of this.world.enemies) {
      const d = (e.x - p.x) ** 2 + (e.y - p.y) ** 2;
      if (d < nearestD) { nearestD = d; nearest = e; }
    }
    if (nearest) {
      this.mouse.x = nearest.x;
      this.mouse.y = nearest.y;
    }
  }
}

let pilot = null;

/** The rich mid-game scene of the second screenshot: wave 3, a mixed swarm,
 *  a boss-damaged splitter, pickups on the field and a combo running. */
function buildPlayScene() {
  world.startGame();
  world.wave = 3;
  world.best = 18900;
  world.spawnQueue = ['drifter', 'weaver', 'drifter', 'splitter'];
  world.enemies = [];
  const rng = mulberry32(4242);
  const spots = [
    ['drifter', 1080, 180], ['drifter', 990, 620], ['weaver', 240, 150],
    ['weaver', 1120, 480], ['splitter', 880, 300], ['stinger', 180, 640],
    ['drifter', 700, 110], ['mini', 940, 380], ['mini', 980, 420],
    ['weaver', 560, 640], ['drifter', 340, 350], ['stinger', 1150, 120],
  ];
  for (const [kind, x, y] of spots) world.enemies.push(world.makeEnemy(kind, x, y));
  world.enemies[4].hp *= 0.45; // the splitter is already shot up
  world.player.x = 470;
  world.player.y = 430;
  world.player.multishot = 2;
  world.score = 12450;
  world.combo = 4;
  world.comboTimer = 1.8;
  world.dropPickup(620, 300, 'star');
  world.dropPickup(300, 480, 'heart');
  for (let i = 0; i < 26; i++) {
    world.burst(880 + (rng() - 0.5) * 60, 300 + (rng() - 0.5) * 60, '#5dff8a', 1, 200, 0.7, 3);
  }
  pilot = new Autopilot(world);
}

/** The finished-run scene of the third screenshot. */
function buildEndScene() {
  world.startGame();
  world.score = 48750;
  world.kills = 132;
  world.wave = 7;
  world.best = 51200;
  world.player.alive = false;
  world.enemies = [];
  world.spawnQueue = [];
  world.state = 'over';
}

const demo = new URLSearchParams(location.hash.replace(/^#/, '')).get('demo');
if (demo === 'play') buildPlayScene();
if (demo === 'end') buildEndScene();

function handleScreenInput() {
  if (world.state === 'title') {
    if (input.clicked || input.wasPressed('enter')) {
      sound.unlock();
      world.startGame();
    }
  } else if (world.state === 'upgrade') {
    const keys = ['1', '2', '3'];
    for (let i = 0; i < 3; i++) if (input.wasPressed(keys[i])) world.chooseUpgrade(i);
    if (input.clicked) {
      const { x, y } = input.mouse;
      world.upgradeChoices.forEach((choice, i) => {
        const cx = ARENA.width / 2 + (i - 1) * 330 - 140;
        if (x >= cx && x <= cx + 280 && y >= 300 && y <= 490) world.chooseUpgrade(i);
      });
    }
  } else if (world.state === 'over') {
    if (input.clicked || input.wasPressed('r')) {
      sound.unlock();
      world.startGame();
    }
  } else if (world.state === 'win') {
    if (input.wasPressed('r')) world.startGame();
    else if (input.wasPressed('enter')) world.continueEndless();
    else if (input.clicked) world.startGame();
  }
  if (input.wasPressed('m')) sound.toggleMute();
  if (input.clicked) sound.unlock();
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  handleScreenInput();
  if (pilot !== null && world.state === 'playing') {
    pilot.updateAim();
    world.update(dt, pilot);
  } else {
    world.update(dt, input);
  }
  renderer.draw(world);
  input.endFrame();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
