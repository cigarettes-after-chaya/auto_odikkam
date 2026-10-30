// Small seeded random-number helper so the Kerala town is identical on every load.
export function makeRng(seed = 1) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rng = () => next();
  rng.range = (lo, hi) => lo + (hi - lo) * next();
  rng.int = (lo, hi) => Math.floor(lo + (hi - lo + 1) * next());
  rng.pick = (arr) => arr[Math.floor(next() * arr.length)];
  rng.chance = (p) => next() < p;
  rng.sign = () => (next() < 0.5 ? -1 : 1);
  return rng;
}
