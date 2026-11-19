// VOIDSTORM — entry program for best-game-01 (Node 22, standard library only).
//
// The game itself is the static site in game/ (index.html and its ES modules, no
// library, no network). This program hands it in: it copies game/ and
// screenshots/ into /output and writes /output/dossier.json with the vendored
// make.fun library, byte for byte the way the gate rebuilds it. Before writing
// anything it refuses work the gate would refuse anyway: a missing game, the
// wrong number of screenshots, or a screenshot over the size cap.
//
// Local run:  mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

/** The gate's caps, mirrored so a bad hand-in fails here with a plain reason. */
const CAPS = {
  text_max_bytes: 163_840,
  screenshots: { max: 4, max_bytes: 262_144 },
  game_max_files: 993,
  game_max_bytes: 50_331_648,
  game_path_max_bytes: 1000,
};

function refuse(message: string): never {
  process.stderr.write(`voidstorm: ${message}\n`);
  process.exit(1);
}

if (!existsSync(join(here, 'game', 'index.html'))) {
  refuse('game/index.html is missing: the game is the static site under game/');
}
const shotsDir = join(here, 'screenshots');
const shots = existsSync(shotsDir) ? readdirSync(shotsDir).filter((n) => !n.startsWith('.')) : [];
if (shots.length < 3 || shots.length > CAPS.screenshots.max) {
  refuse(`screenshots/ holds ${shots.length} images: hand in 3 or 4 (title, play, end)`);
}
for (const name of shots) {
  const size = statSync(join(shotsDir, name)).size;
  if (size > CAPS.screenshots.max_bytes) {
    refuse(`screenshots/${name} is ${size} bytes: the cap is ${CAPS.screenshots.max_bytes}`);
  }
}

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
cpSync(shotsDir, join(out, 'screenshots'), { recursive: true });
writeFileSync(join(out, 'dossier.json'), buildDossier(out, CAPS));

process.stdout.write(`voidstorm: handed in game/ and ${shots.length} screenshots; dossier.json written to ${out}\n`);
