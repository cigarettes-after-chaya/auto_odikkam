// Vegetation, street furniture and small props. Everything is emitted into a Builder (merged,
// chunked meshes) and registers simple colliders in ctx so the player cannot drive through it.
import { unitQuad, cylGeo, leafGeo, trunkGeo, sphereGeo } from './geom.js';
import { signUV } from './signs.js';

// Builds parts in a rotated local frame: local +z = building front, local +x = building left.
export class Local {
  constructor(b, x, z, ry) { this.b = b; this.x = x; this.z = z; this.ry = ry; this.c = Math.cos(ry); this.s = Math.sin(ry); }
  w(lx, lz) { return [this.x + lx * this.c + lz * this.s, this.z - lx * this.s + lz * this.c]; }
  at(lx, lz, dy = 0) { const [X, Z] = this.w(lx, lz); return new Local(this.b, X, Z, this.ry + dy); }
  box(k, col, lx, y, lz, w, h, d, ry = 0, rx = 0, rz = 0) { const [X, Z] = this.w(lx, lz); this.b.box(k, col, X, y, Z, w, h, d, this.ry + ry, rx, rz); }
  cyl(k, col, lx, y, lz, rt, rb, h, seg = 8, rx = 0, rz = 0) { const [X, Z] = this.w(lx, lz); this.b.cyl(k, col, X, y, Z, rt, rb, h, seg, this.ry, rx, rz); }
  cylX(k, col, lx, y, lz, r, len, seg = 10) { const [X, Z] = this.w(lx, lz); this.b.cylX(k, col, X, y, Z, r, len, seg, this.ry); }
  cylZ(k, col, lx, y, lz, r, len, seg = 10) { const [X, Z] = this.w(lx, lz); this.b.cylZ(k, col, X, y, Z, r, len, seg, this.ry); }
  sph(k, col, lx, y, lz, rx, ry, rz, ws = 8, hs = 6) { const [X, Z] = this.w(lx, lz); this.b.sph(k, col, X, y, Z, rx, ry, rz, ws, hs, this.ry); }
  quad(k, col, lx, y, lz, w, h, ry = 0, rx = 0, rz = 0, uv = null) { const [X, Z] = this.w(lx, lz); this.b.quad(k, col, X, y, Z, w, h, this.ry + ry, rx, rz, uv); }
  flat(k, col, lx, y, lz, w, d) { const [X, Z] = this.w(lx, lz); this.b.geo(k, col, unitQuad(), X, y, Z, w, d, 1, -Math.PI / 2, this.ry, 0); }
  hip(k, col, lx, y, lz, w, d, h, ridge) { const [X, Z] = this.w(lx, lz); this.b.hip(k, col, X, y, Z, w, d, h, ridge, this.ry); }
  gable(k, col, ek, ecol, lx, y, lz, w, d, h) { const [X, Z] = this.w(lx, lz); this.b.gable(k, col, ek, ecol, X, y, Z, w, d, h, this.ry); }
  shed(k, col, lx, y, lz, w, d, h0, h1) { const [X, Z] = this.w(lx, lz); this.b.shed(k, col, X, y, Z, w, d, h0, h1, this.ry); }
  // Registers an oriented box in the world (footprint and/or solid collider), centred at local (lx,lz).
  obb(ctx, list, lx, lz, hw, hd, extra = {}) {
    const [X, Z] = this.w(lx, lz);
    ctx[list].push({ x: X, z: Z, hw, hd, a: this.ry, c: this.c, s: this.s, ...extra });
  }
}

export const PAL = {
  wall: [0xf0e0b0, 0xe9d29a, 0xf3e9d2, 0xd9e8d0, 0xbfe0d6, 0xf2c9b0, 0xf5d7da, 0xcfe2f0, 0xf7efc8, 0xe8b98a],
  modern: [0xf2f2ee, 0xfbe3c0, 0xd9efe6, 0xd5e3f4, 0xf6d3d0, 0xe9e3f3, 0xffe8a8, 0xd8e8b8],
  shop: [0xf2c14e, 0x6fb7a8, 0xe07a7a, 0xe8dcc0, 0x7ea6d8, 0xf19a4d, 0xa3c97a, 0xd96a8a, 0xf5f0e0],
  roof: [0xb5472a, 0xa83e22, 0xc25a32, 0x9f3b27, 0xbc5030],
  green: [0x2f7a3a, 0x3d8a40, 0x4b9a45, 0x2a6b36, 0x56a24a, 0x35803f],
  stripe: [[0xd0332b, 0xffffff], [0x1e63b8, 0xffffff], [0x2f8f4b, 0xfff3b0], [0xf2a01e, 0xffffff]]
};

// ---- Vegetation -----------------------------------------------------------------------------
const PALM_VARIANTS = [
  { h: 7.5, bx: 0.8, bz: 0.3 }, { h: 9, bx: -0.7, bz: 0.5 }, { h: 10.5, bx: 0.4, bz: -0.8 }, { h: 12, bx: -0.5, bz: -0.4 }
];
export function palm(b, ctx, x, z, rng, scale = 1) {
  const v = PALM_VARIANTS[rng.int(0, 3)], sc = scale * rng.range(0.85, 1.15), yaw = rng() * 6.28;
  const tg = trunkGeo(v.h, 0.26, 0.14, v.bx, v.bz);
  const trunk = rng.pick([0x8c7a62, 0x7d6e58, 0x968468]);
  b.geo('paint', trunk, tg, x, 0, z, sc, sc, sc, 0, yaw, 0);
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const tx = x + (tg.top[0] * cy + tg.top[2] * sy) * sc, tz = z + (-tg.top[0] * sy + tg.top[2] * cy) * sc, ty = tg.top[1] * sc;
  const long = leafGeo(3.7, 1.15, 0.7, 1.1, 4), short = leafGeo(2.7, 1.0, 1.0, 0.8, 4);
  const tint = rng.pick(PAL.green);
  const n = 9;
  for (let i = 0; i < n; i++) {
    const g = i % 3 === 0 ? short : long;
    b.geo('frond', tint, g, tx, ty, tz, sc, sc, sc, i % 3 === 0 ? -0.15 : 0.05, yaw + (i / n) * 6.283 + rng.range(-0.2, 0.2), 0);
  }
  b.sph('paint', 0x6f8f2a, tx, ty - 0.35, tz, 0.2 * sc, 0.2 * sc, 0.2 * sc, 5, 4);
  b.sph('paint', 0x8a9a30, tx + 0.28 * sc, ty - 0.5, tz + 0.1 * sc, 0.18 * sc, 0.18 * sc, 0.18 * sc, 5, 4);
  ctx.circles.push({ x, z, r: 0.32 * sc, type: 'palm' });
}

export function broadleaf(b, ctx, x, z, rng, scale = 1) {
  const sc = scale * rng.range(0.8, 1.35);
  const bark = rng.pick([0x6a4a32, 0x5b4331, 0x74543a]);
  b.cyl('paint', bark, x, 1.5 * sc, z, 0.17 * sc, 0.3 * sc, 3 * sc, 6);
  const greens = [0x2c6e35, 0x3b8441, 0x4a9644, 0x2f7a3a, 0x58a14a];
  const blobs = rng.int(3, 4);
  for (let i = 0; i < blobs; i++) {
    const a = rng() * 6.28, r = i === 0 ? 0 : rng.range(0.9, 1.5) * sc, rr = rng.range(1.5, 2.1) * sc;
    b.sph('paint', rng.pick(greens), x + Math.cos(a) * r, (3.9 + (i === 0 ? 1.0 : rng.range(-0.3, 0.5))) * sc, z + Math.sin(a) * r, rr, rr * 0.8, rr, 7, 5);
  }
  ctx.circles.push({ x, z, r: 0.36 * sc, type: 'tree' });
}

export function banana(b, ctx, x, z, rng) {
  const sc = rng.range(0.85, 1.2);
  b.cyl('paint', 0x9bb35a, x, 1.1 * sc, z, 0.1 * sc, 0.15 * sc, 2.2 * sc, 6);
  const g = leafGeo(2.7, 1.25, 0.6, 1.25, 4), tint = rng.pick([0x4f9a3a, 0x5aa840, 0x479033]);
  for (let i = 0; i < 7; i++) b.geo('banana', tint, g, x, 2.15 * sc, z, sc, sc, sc, i % 2 ? -0.1 : 0.1, (i / 7) * 6.283 + rng(), 0);
  if (rng.chance(0.5)) b.sph('paint', 0xc9d65a, x + 0.28 * sc, 1.5 * sc, z, 0.14, 0.32, 0.14, 5, 4);
  ctx.circles.push({ x, z, r: 0.25, type: 'banana' });
}

export function bush(b, ctx, x, z, rng, flowers = false) {
  const s = rng.range(0.7, 1.3);
  b.sph('paint', rng.pick(PAL.green), x, 0.45 * s, z, 0.85 * s, 0.6 * s, 0.85 * s, 6, 4);
  if (flowers) {
    const col = rng.pick([0xe53935, 0xff7043, 0xfdd835, 0xec407a, 0xffffff]);
    for (let i = 0; i < 4; i++) { const a = rng() * 6.28, r = rng.range(0.1, 0.6) * s; b.box('paint', col, x + Math.cos(a) * r, (0.75 + rng() * 0.2) * s, z + Math.sin(a) * r, 0.22, 0.18, 0.22, a); }
  }
}

// ---- Street furniture -----------------------------------------------------------------------
export function streetLight(b, ctx, x, z, towardX, towardZ) {
  const L = Math.hypot(towardX, towardZ) || 1, dx = towardX / L, dz = towardZ / L, yaw = Math.atan2(dx, dz);
  b.cyl('metal', 0x7d8480, x, 3.4, z, 0.06, 0.1, 6.8, 6);
  b.box('metal', 0x7d8480, x + dx * 0.9, 6.75, z + dz * 0.9, 0.08, 0.08, 1.9, yaw);
  b.box('paint', 0x4f5552, x + dx * 1.7, 6.7, z + dz * 1.7, 0.3, 0.1, 0.55, yaw);
  b.box('lamp', 0xfff3c0, x + dx * 1.7, 6.63, z + dz * 1.7, 0.22, 0.04, 0.45, yaw);
  ctx.circles.push({ x, z, r: 0.2, type: 'pole' });
}

export function utilityPole(b, ctx, x, z, yaw, tops) {
  b.box('paint', 0x9a9a92, x, 3.5, z, 0.2, 7, 0.2, yaw);
  b.box('wood', 0x5a4632, x, 6.6, z, 0.08, 0.08, 1.7, yaw + Math.PI / 2);
  b.box('wood', 0x5a4632, x, 6.05, z, 0.08, 0.08, 1.3, yaw + Math.PI / 2);
  for (const o of [-0.7, 0.7]) {
    const px = x + Math.cos(yaw) * o, pz = z - Math.sin(yaw) * o;
    b.cyl('paint', 0x333a3f, px, 6.72, pz, 0.04, 0.04, 0.14, 5);
  }
  ctx.circles.push({ x, z, r: 0.2, type: 'pole' });
  tops.push({ x, y: 6.7, z, yaw });
}

export function signPost(b, ctx, x, z, yaw, signId, w = 2.4) {
  const h = signId === 'speed30' ? w : w / 4;
  b.cyl('metal', 0x6d746f, x, 1.6, z, 0.045, 0.045, 3.2, 6);
  b.quad('signs', 0xffffff, x + Math.sin(yaw) * 0.06, 3.2 + h / 2, z + Math.cos(yaw) * 0.06, w, h, yaw, 0, 0, signUV(signId));
  b.box('paint', 0x555b57, x - Math.sin(yaw) * 0.01, 3.2 + h / 2, z - Math.cos(yaw) * 0.01, w + 0.06, h + 0.06, 0.04, yaw);
  ctx.circles.push({ x, z, r: 0.15, type: 'pole' });
}

// Parked motorcycle (scooter = false) or scooter; local frame so it can sit at any angle.
export function motorbike(b, ctx, x, z, yaw, rng, scooter = false) {
  const m = new (class extends Object {})();
  const L = (lx, lz) => [x + lx * Math.cos(yaw) + lz * Math.sin(yaw), z - lx * Math.sin(yaw) + lz * Math.cos(yaw)];
  const col = rng.pick([0xc62828, 0x1565c0, 0x212121, 0xf9a825, 0x2e7d32, 0xeeeeee]);
  const part = (k, c, lx, y, lz, w, h, d, ry = 0, rx = 0) => { const [X, Z] = L(lx, lz); b.box(k, c, X, y, Z, w, h, d, yaw + ry, rx, 0); };
  for (const lz of [0.62, -0.62]) { const [X, Z] = L(0, lz); b.cylX('paint', 0x151515, X, 0.3, Z, 0.3, 0.09, 8, yaw); }
  part('paint', col, 0, 0.62, scooter ? 0.05 : 0.0, 0.26, scooter ? 0.3 : 0.28, scooter ? 0.95 : 0.7);
  part('paint', 0x1b1b1b, 0, 0.84, -0.25, 0.28, 0.1, 0.62);
  part('metal', 0xb8bcc0, 0, 0.98, 0.5, 0.62, 0.04, 0.04);
  part('paint', col, 0, 0.76, 0.52, 0.12, 0.5, 0.1, 0, -0.3);
  const [hx, hz] = L(0, 0.65); b.sph('lamp', 0xfff2c0, hx, 0.95, hz, 0.1, 0.1, 0.08, 5, 4);
  ctx.obbs.push({ x, z, hw: 0.3, hd: 0.95, a: yaw, c: Math.cos(yaw), s: Math.sin(yaw), type: 'bike' });
}

export function vendorStall(b, ctx, x, z, yaw, rng) {
  const m = new Local(b, x, z, yaw), st = rng.pick(PAL.stripe);
  for (const sx of [-1.1, 1.1]) for (const sz of [-0.8, 0.8]) m.cyl('wood', 0x6a4a2c, sx, 1.1, sz, 0.04, 0.04, 2.2, 5);
  m.box('paint', 0x8b5a2b, 0, 0.8, 0.55, 2.4, 0.1, 0.9);
  m.box('paint', 0x6a4a2c, 0, 0.4, 0.55, 2.2, 0.8, 0.8);
  for (let i = 0; i < 6; i++) m.box('fabric', i % 2 ? st[1] : st[0], -1.0 + i * 0.4, 2.25, 0, 0.4, 0.05, 2.0, 0, 0.12);
  const fruit = rng.pick([0xe53935, 0xfdd835, 0xff9800, 0x7cb342]);
  for (let i = 0; i < 5; i++) m.sph('paint', fruit, -0.8 + i * 0.4, 0.95, 0.55, 0.14, 0.14, 0.14, 5, 4);
  m.obb(ctx, 'obbs', 0, 0.3, 1.2, 0.9, { type: 'stall' });
}

export function teaSeating(b, ctx, x, z, yaw) {
  const m = new Local(b, x, z, yaw);
  m.box('wood', 0x7a5230, 0, 0.45, 0, 1.8, 0.07, 0.4); m.box('wood', 0x5a3a22, -0.7, 0.22, 0, 0.07, 0.44, 0.34); m.box('wood', 0x5a3a22, 0.7, 0.22, 0, 0.07, 0.44, 0.34);
  m.box('wood', 0x7a5230, 0, 0.5, 1.1, 0.6, 0.05, 0.6); m.cyl('wood', 0x5a3a22, 0, 0.25, 1.1, 0.05, 0.05, 0.5, 5);
  m.obb(ctx, 'obbs', 0, 0.5, 1.0, 1.0, { type: 'bench' });
}

// Overhead cables: sagging polylines between neighbouring pole tops, stored as line segments.
export function stringCables(ctx, tops) {
  for (let i = 0; i + 1 < tops.length; i++) {
    const a = tops[i], c = tops[i + 1];
    const d = Math.hypot(c.x - a.x, c.z - a.z);
    if (d > 60 || d < 4) continue;
    for (const o of [-0.7, 0.7, -0.45]) {
      const sag = d * 0.012, segs = 4;
      let prev = null;
      for (let k = 0; k <= segs; k++) {
        const t = k / segs, y = (o === -0.45 ? 6.05 : 6.72) - Math.sin(t * Math.PI) * sag;
        const off = o * (1 - Math.abs(0)), ax = a.x + Math.cos(a.yaw) * off, az = a.z - Math.sin(a.yaw) * off, cx = c.x + Math.cos(c.yaw) * off, cz = c.z - Math.sin(c.yaw) * off;
        const p = [ax + (cx - ax) * t, y, az + (cz - az) * t];
        if (prev) ctx.cables.push(prev[0], prev[1], prev[2], p[0], p[1], p[2]);
        prev = p;
      }
    }
  }
}

// Compound wall with pillars along a straight run; optional gate gap at the centre.
export function compoundWall(b, ctx, x0, z0, x1, z1, rng, gapAt = null, gapW = 3.2, h = 1.25) {
  const dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz);
  if (len < 1) return;
  const ux = dx / len, uz = dz / len, yaw = Math.atan2(ux, uz) + Math.PI / 2;
  const col = rng.pick([0xf1ece0, 0xe8dcc0, 0xd9cdb4, 0xcfd8c6]);
  const piece = (a, c) => {
    const l = c - a; if (l < 0.3) return;
    const m = (a + c) / 2, px = x0 + ux * m, pz = z0 + uz * m;
    b.box('paint', col, px, h / 2, pz, l, h, 0.22, yaw);
    b.box('paint', 0x6e6a60, px, h + 0.04, pz, l + 0.04, 0.08, 0.32, yaw);
    ctx.obbs.push({ x: px, z: pz, hw: l / 2, hd: 0.12, a: yaw, c: Math.cos(yaw), s: Math.sin(yaw), type: 'wall' });
  };
  const pillar = (t) => { const px = x0 + ux * t, pz = z0 + uz * t; b.box('paint', 0xf5f1e6, px, h / 2 + 0.2, pz, 0.42, h + 0.4, 0.42, yaw); b.box('paint', 0x6e6a60, px, h + 0.44, pz, 0.5, 0.08, 0.5, yaw); };
  if (gapAt === null) { piece(0, len); pillar(0); pillar(len); return; }
  const g0 = gapAt - gapW / 2, g1 = gapAt + gapW / 2;
  piece(0, g0); piece(g1, len); pillar(0); pillar(len); pillar(g0); pillar(g1);
  // open metal gate leaves
  const gx = x0 + ux * g0, gz = z0 + uz * g0;
  b.box('metal', 0x2f3532, gx + ux * 0.05 + (-uz) * 0.5, 0.85, gz + uz * 0.05 + ux * 0.5, 1.4, 1.1, 0.05, yaw + 1.2);
  ctx.circles.push({ x: x0 + ux * g0, z: z0 + uz * g0, r: 0.25, type: 'pillar' }, { x: x0 + ux * g1, z: z0 + uz * g1, r: 0.25, type: 'pillar' });
}
