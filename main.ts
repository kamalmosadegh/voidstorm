// VOIDSTORM — packaging program (Node 22, standard library only).
//
// The game itself is the static site in game/ (index.html and its ES modules, no
// library, no network). This program packages the game: it copies game/ and
// screenshots/ into /output and writes /output/summary.json — a deterministic
// manifest of the package (path, size and SHA-256 of every file). Before
// writing anything it validates the package: a missing game, the wrong
// number of screenshots, or a screenshot over the size cap all stop the run.
//
// Local run:  mkdir -p out && OUTPUT_DIR=out node main.ts

import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.OUTPUT_DIR ?? '/output';

/** Package caps, checked here so a bad package fails with a plain reason. */
const CAPS = {
  screenshots: { max: 4, max_bytes: 262_144 },
  game_max_files: 993,
  game_max_bytes: 50_331_648,
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

/** One file in the package manifest. */
interface ManifestFile {
  path: string;
  bytes: number;
  sha256: string;
}

/**
 * Write summary.json into `dir`: a deterministic manifest (path, size,
 * SHA-256) of every packaged file, after enforcing the package caps.
 */
function writeSummary(dir: string): void {
  const files: ManifestFile[] = [];
  const walk = (from: string, prefix: string): void => {
    for (const name of readdirSync(from).sort()) {
      if (prefix === '' && name === 'summary.json') continue;
      const path = join(from, name);
      if (statSync(path).isDirectory()) {
        walk(path, `${prefix}${name}/`);
        continue;
      }
      const data = readFileSync(path);
      files.push({ path: `${prefix}${name}`, bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') });
    }
  };
  walk(dir, '');
  if (files.length > CAPS.game_max_files + CAPS.screenshots.max) {
    refuse(`the package holds ${files.length} files: the cap is ${CAPS.game_max_files + CAPS.screenshots.max}`);
  }
  const total = files.reduce((n, f) => n + f.bytes, 0);
  if (total > CAPS.game_max_bytes) {
    refuse(`the package is ${total} bytes: the cap is ${CAPS.game_max_bytes}`);
  }
  writeFileSync(join(dir, 'summary.json'), `${JSON.stringify({ schema: 'summary/v1', files }, null, 2)}\n`);
}

writeSummary(out);

process.stdout.write(`voidstorm: packaged game/ and ${shots.length} screenshots; summary.json written to ${out}\n`);
