// VOIDSTORM tuning: arena, palette and the numbers every other file shares.

export const ARENA = { width: 1280, height: 800 };

export const COLORS = {
  bg: '#070b18',
  grid: '#12203c',
  player: '#37f4e4',
  playerCore: '#eafffb',
  bullet: '#a5fff4',
  enemyBolt: '#ff5d8f',
  drifter: '#ff5d8f',
  weaver: '#ffb84d',
  splitter: '#5dff8a',
  mini: '#b6ffc7',
  stinger: '#c792ff',
  boss: '#ff3860',
  pickupStar: '#ffe74d',
  pickupHeart: '#ff7d9c',
  text: '#e8f4ff',
  muted: '#8fa8cc',
  accent: '#37f4e4',
  danger: '#ff3860',
};

export const PLAYER = {
  radius: 14,
  speed: 265,
  hp: 100,
  fireInterval: 0.16,
  bulletSpeed: 640,
  bulletDamage: 34,
  dashTime: 0.16,
  dashCooldown: 1.6,
  dashSpeed: 1150,
};

export const WAVES = {
  // Enemies in wave n: base + growth per wave, capped so late waves stay playable.
  count: (n) => Math.min(6 + n * 3, 34),
  hpScale: (n) => 1 + (n - 1) * 0.22,
  speedScale: (n) => 1 + Math.min(0.5, (n - 1) * 0.045),
  bossEvery: 5,
  victoryWave: 10,
};

export const SCORE = {
  drifter: 100,
  weaver: 150,
  splitter: 200,
  mini: 50,
  stinger: 250,
  boss: 2500,
  star: 300,
  comboWindow: 2.5,
  comboMax: 8,
};
