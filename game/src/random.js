// A tiny seeded random generator (mulberry32): the demo scenes and the title
// screen's drifting enemies are built from a fixed seed, so a screenshot taken
// today shows the same rich scene as one taken tomorrow.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Random float in [min, max) from a generator. */
export function range(rng, min, max) {
  return min + rng() * (max - min);
}

/** Random integer in [min, max] from a generator. */
export function int(rng, min, max) {
  return Math.floor(range(rng, min, max + 1));
}

/** Pick one element of a list with a generator. */
export function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}
