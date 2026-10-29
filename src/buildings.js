// Kerala building generators. Each builder works in a local frame (front = +z) and returns nothing;
// planBuilding() decides the footprint first so the layout code can place it safely beside a road.
import { Local, PAL, bush, palm, teaSeating, vendorStall } from './props.js';
import { signUV } from './signs.js';

const WOOD = 0x4a2f1f;

function win(m, lx, ly, lz, w, h, frame = WOOD) {
  m.box('paint', frame, lx, ly, lz + 0.03, w + 0.2, h + 0.2, 0.1);
  m.box('glass', 0x23363c, lx, ly, lz + 0.08, w, h, 0.06);
  m.box('paint', 0xe8e2d4, lx, ly - h / 2 - 0.14, lz + 0.1, w + 0.4, 0.08, 0.22);
}
function sideWins(m, w, d, ly, zs, ww, wh, frame) {
  for (const z of zs) { win(m.at(w / 2, z, Math.PI / 2), 0, ly, 0, ww, wh, frame); win(m.at(-w / 2, z, -Math.PI / 2), 0, ly, 0, ww, wh, frame); }
}

export function planBuilding(type, rng) {
  switch (type) {
    case 'kerala': { const w = rng.range(9, 12), d = rng.range(7.5, 9.5); return { type, w, d, fe: 3.4, fw: w + 2.6 }; }
    case 'modern': { const w = rng.range(8, 11), d = rng.range(8, 10); return { type, w, d, fe: 2.2, fw: w + 1.6 }; }
    case 'twoStorey': { const w = rng.range(9, 11), d = rng.range(8, 9.5); return { type, w, d, fe: 3, fw: w + 2.4 }; }
    case 'tea': return { type, w: rng.range(4.6, 6), d: 6.5, fe: 2.6, fw: 6 };
    case 'grocery': return { type, w: rng.range(5, 7), d: 7, fe: 2.2, fw: 7 };
    case 'hotel': { const w = rng.range(7.5, 10); return { type, w, d: 9, fe: 1.8, fw: w }; }
    case 'commercial': { const w = rng.range(7.5, 11); return { type, w, d: rng.range(9, 11), fe: 0.8, fw: w }; }
    default: return { type: 'shop', w: rng.range(4.5, 7), d: rng.range(6, 8), fe: 1.8, fw: 7 };
  }
}

export function buildBuilding(plan, b, ctx, x, z, ry, rng) {
  const m = new Local(b, x, z, ry);
  ({ kerala, modern, twoStorey, tea: shop, grocery: shop, hotel, commercial, shop }[plan.type] || shop)(m, plan, ctx, rng);
  // solid block + whole footprint (porch/awning included) used for placement checks
  m.obb(ctx, 'obbs', 0, 0, plan.w / 2 + 0.2, plan.d / 2 + 0.2, { type: plan.type, solid: true });
  m.obb(ctx, 'footprints', 0, plan.fe / 2, plan.fw / 2, plan.d / 2 + plan.fe / 2, { type: plan.type });
  ctx.minimap.push({ x: m.x, z: m.z, hw: plan.w / 2, hd: plan.d / 2, a: ry, type: plan.type });
}

// ---- Houses ---------------------------------------------------------------------------------
function kerala(m, p, ctx, rng) {
  const { w, d } = p, wall = rng.pick(PAL.wall), roof = rng.pick(PAL.roof);
  m.box('paint', 0x8c8478, 0, 0.35, 0, w + 0.8, 0.7, d + 0.8);
  m.box('paint', 0x3f3a36, 0, 1.0, 0, w + 0.06, 0.6, d + 0.06);
  m.box('paint', wall, 0, 2.65, 0, w, 2.7, d);
  m.box('paint', 0xf6f1e4, 0, 3.95, 0, w + 0.1, 0.12, d + 0.1);
  m.hip('roof', roof, 0, 4.0, 0.9, w + 2.6, d + 3.4, 2.1, (w + 2.6) * 0.5);
  m.flat('paint', 0x9a9186, 0, 0.86, d / 2 + 1.1, w * 0.74, 2.2);
  for (const lx of [-0.3, -0.1, 0.1, 0.3]) m.cyl('wood', 0x5a3a22, lx * w, 2.43, d / 2 + 1.95, 0.12, 0.12, 3.14, 6);
  m.box('paint', 0x5a3a22, 0, 3.85, d / 2 + 1.95, w * 0.7, 0.3, 0.25);
  m.box('paint', 0x4a2f1f, 0, 1.9, d / 2 + 0.04, 1.2, 2.2, 0.08);
  m.box('paint', 0xe8e2d4, 0, 3.1, d / 2 + 0.06, 1.5, 0.14, 0.12);
  for (const s of [-1, 1]) win(m, s * w * 0.3, 2.45, d / 2, 1.0, 1.3);
  sideWins(m, w, d, 2.45, [-d * 0.25, d * 0.2], 0.9, 1.2);
  m.box('paint', 0xa59d90, 0, 0.2, d / 2 + 2.5, w * 0.45, 0.4, 0.6);
  m.box('paint', 0xa59d90, 0, 0.1, d / 2 + 2.9, w * 0.45, 0.2, 0.5);
  m.sph('lamp', 0xfff2b0, 0, 3.4, d / 2 + 0.25, 0.1, 0.1, 0.1, 5, 4);
  garden(m, p, rng);
}
function twoStorey(m, p, ctx, rng) {
  const { w, d } = p, wall = rng.pick([0xf4efe2, 0xf0e6cc, 0xefe3d0]), roof = rng.pick(PAL.roof), wood = 0x5a3a22;
  m.box('paint', 0x8c8478, 0, 0.3, 0, w + 0.8, 0.6, d + 0.8);
  m.box('paint', wall, 0, 2.2, 0, w, 3.2, d);
  m.hip('roof', roof, 0, 3.8, 0.8, w + 2.4, d + 3, 1.4, (w + 2.4) * 0.5);
  m.box('paint', wall, 0, 5.4, 0, w * 0.82, 3.0, d * 0.82);
  m.box('paint', wood, 0, 4.0, d * 0.41 + 0.05, w * 0.84, 0.18, 0.14);
  m.hip('roof', roof, 0, 6.9, 0, w * 0.82 + 2.2, d * 0.82 + 2.2, 2.0, w * 0.5);
  for (const s of [-1, 1]) { win(m, s * w * 0.28, 2.5, d / 2, 1.0, 1.4, wood); win(m, s * w * 0.25, 5.4, d * 0.41, 0.9, 1.3, wood); }
  m.box('paint', wood, 0, 1.9, d / 2 + 0.05, 1.2, 2.3, 0.1);
  m.box('paint', wood, 0, 4.9, d * 0.41 + 0.6, w * 0.5, 0.1, 1.2); // balcony slab
  for (let i = 0; i <= 8; i++) m.box('paint', wood, -w * 0.25 + (i * w * 0.5) / 8, 5.4, d * 0.41 + 1.15, 0.05, 0.9, 0.05);
  m.box('paint', wood, 0, 5.85, d * 0.41 + 1.15, w * 0.5, 0.07, 0.07);
  for (const lx of [-0.3, 0.3]) m.cyl('wood', wood, lx * w, 1.95, d / 2 + 1.9, 0.12, 0.12, 3.2, 6);
  m.flat('paint', 0x9a9186, 0, 0.62, d / 2 + 1.1, w * 0.7, 2.2);
  m.box('paint', 0xa59d90, 0, 0.25, d / 2 + 2.4, w * 0.4, 0.5, 0.6);
  sideWins(m, w, d, 2.5, [0], 0.9, 1.3, wood);
  garden(m, p, rng);
}
function modern(m, p, ctx, rng) {
  const { w, d } = p, c1 = rng.pick(PAL.modern), c2 = rng.pick([0xd9a441, 0x6e8fa8, 0xb85c4a, 0x8aa87a, 0x444b52]);
  m.box('paint', 0xb9b4aa, 0, 0.25, 0, w + 0.6, 0.5, d + 0.6);
  m.box('paint', c1, 0, 2.2, 0, w, 3.4, d);
  m.box('paint', c1, 0, 5.4, 0.5, w + 0.4, 3.0, d);
  m.box('paint', c2, -w * 0.25, 5.4, d / 2 + 0.55, w * 0.34, 3.0, 0.12);
  m.box('paint', 0xffffff, 0, 3.98, d / 2 + 0.55, w + 0.6, 0.25, 1.2);
  m.box('paint', 0xffffff, 0, 6.98, 0.5, w + 0.8, 0.25, d + 0.8);
  m.box('paint', 0xffffff, 0, 7.3, 0.5, w + 0.6, 0.45, d + 0.6); // parapet block
  m.cyl('paint', 0x1c1f22, w * 0.3, 7.9, -d * 0.2, 0.7, 0.7, 1.2, 10);
  m.box('paint', 0xe6e2d8, -w * 0.3, 7.7, d * 0.2, 1.6, 0.9, 1.6);
  win(m, w * 0.22, 2.6, d / 2, 2.0, 1.6, 0x333a3f); win(m, -w * 0.22, 2.6, d / 2, 1.2, 1.6, 0x333a3f);
  m.box('paint', 0x3a2a1f, w * 0.02, 1.7, d / 2 + 0.04, 1.1, 2.2, 0.08);
  for (const s of [-1, 1]) win(m, s * w * 0.28, 5.5, d / 2 + 0.5, 1.5, 1.7, 0x333a3f);
  for (let i = 0; i <= 10; i++) m.box('metal', 0x2f3532, -w * 0.5 + 0.2 + (i * (w - 0.4)) / 10, 4.7, d / 2 + 1.05, 0.04, 0.8, 0.04);
  m.box('metal', 0x2f3532, 0, 5.12, d / 2 + 1.05, w - 0.3, 0.05, 0.05);
  sideWins(m, w, d, 2.6, [-d * 0.2, d * 0.2], 1.0, 1.4, 0x333a3f);
  m.flat('paint', 0xa8a39a, 0, 0.52, d / 2 + 1.5, w * 0.5, 1.8);
  garden(m, p, rng);
}
function garden(m, p, rng) {
  const [bx, bz] = m.w(-p.w * 0.5 - 1.2, p.d / 2 + 1);
  bush(m.b, m.ctxSafe || { circles: [] }, bx, bz, rng, true);
  const [cx, cz] = m.w(p.w * 0.5 + 1.2, p.d / 2 + 1);
  bush(m.b, m.ctxSafe || { circles: [] }, cx, cz, rng, rng.chance(0.6));
}

// ---- Shops ----------------------------------------------------------------------------------
function shopSign(m, id, w, y, z) {
  const sw = Math.min(w * 0.94, 5.2), sh = sw / 4;
  m.box('paint', 0x2b2f2c, 0, y, z - 0.02, sw + 0.12, sh + 0.12, 0.08);
  m.quad('signs', 0xffffff, 0, y, z + 0.03, sw, sh, 0, 0, 0, signUV(id));
}
function awning(m, w, y, z, rng) {
  const st = rng.pick(PAL.stripe), n = Math.max(4, Math.round(w / 0.7));
  for (let i = 0; i < n; i++) m.box('fabric', i % 2 ? st[1] : st[0], -w / 2 + (i + 0.5) * (w / n), y, z, w / n, 0.05, 1.4, 0, 0.22);
}
function shop(m, p, ctx, rng) {
  const { w, d } = p, wall = rng.pick(PAL.shop), kind = p.type;
  const id = kind === 'tea' ? 'tea' : kind === 'grocery' ? 'grocery' : rng.pick(['medical', 'bakery', 'textiles', 'jewellery', 'vegetable', 'stationery', 'mobiles', 'fruits']);
  m.box('paint', wall, 0, 2.0, 0, w, 4.0, d);
  m.box('paint', 0xe9e5da, 0, 4.1, 0, w + 0.2, 0.3, d + 0.2);
  m.box('paint', 0xd8d4c8, 0, 0.1, d / 2 + 0.6, w, 0.2, 1.2); // raised threshold
  const sw = w * 0.76;
  m.box('paint', 0xa5a9a1, 0, 1.3, d / 2 + 0.03, sw, 2.5, 0.08); // rolling shutter
  for (let i = 0; i < 9; i++) m.box('paint', 0x8f948c, 0, 0.3 + i * 0.27, d / 2 + 0.08, sw, 0.03, 0.03);
  if (kind === 'tea') { m.box('glass', 0x23363c, 0, 1.5, d / 2 + 0.05, sw, 1.8, 0.06); m.box('paint', 0x8b5a2b, 0, 0.9, d / 2 + 0.5, sw, 0.1, 0.6); }
  shopSign(m, id, w, 3.3, d / 2 + 0.02);
  awning(m, w * 0.92, 2.85, d / 2 + 0.7, rng);
  if (kind === 'tea') {
    teaSeating(m.b, ctx, ...m.w(-w * 0.2, d / 2 + 1.7), m.ry);
    for (let i = 0; i < 4; i++) m.sph('paint', 0xe8c53a, w * 0.34, 2.55 - i * 0.14, d / 2 + 0.5, 0.07, 0.2, 0.07, 5, 4); // hanging bananas
  } else if (kind === 'grocery') {
    const cols = [0xe53935, 0xfdd835, 0x7cb342, 0xff9800];
    for (let i = 0; i < 4; i++) { m.box('paint', 0x8b5a2b, -w * 0.3 + i * 0.7, 0.3, d / 2 + 1.1, 0.6, 0.6, 0.5); m.sph('paint', cols[i], -w * 0.3 + i * 0.7, 0.7, d / 2 + 1.1, 0.26, 0.14, 0.2, 6, 4); }
  } else if (rng.chance(0.3)) vendorStall(m.b, ctx, ...m.w(w * 0.55 + 1.2, d / 2 + 0.6), m.ry, rng);
}
function hotel(m, p, ctx, rng) {
  const { w, d } = p, wall = rng.pick([0xf2dca0, 0xe9c9a0, 0xdfeadf]);
  m.box('paint', wall, 0, 3.6, 0, w, 7.2, d);
  m.box('paint', 0xe9e5da, 0, 7.3, 0, w + 0.2, 0.3, d + 0.2);
  m.box('glass', 0x23363c, 0, 1.5, d / 2 + 0.04, w * 0.7, 2.2, 0.06);
  m.box('paint', 0x3a2f28, 0, 1.5, d / 2 + 0.02, w * 0.74, 2.4, 0.05);
  m.box('glass', 0x23363c, 0, 1.5, d / 2 + 0.07, w * 0.68, 2.1, 0.05);
  shopSign(m, 'hotel', w, 3.4, d / 2 + 0.02);
  awning(m, w * 0.9, 2.9, d / 2 + 0.7, rng);
  for (let i = 0; i < 3; i++) win(m, -w * 0.3 + i * w * 0.3, 5.5, d / 2, 1.3, 1.5, 0x333a3f);
  m.box('paint', 0xdedad0, 0, 4.6, d / 2 + 0.5, w * 0.95, 0.12, 1.0);
  m.cyl('paint', 0x1c1f22, w * 0.25, 8.0, 0, 0.7, 0.7, 1.2, 10);
  sideWins(m, w, d, 5.4, [-d * 0.2, d * 0.2], 1.1, 1.4, 0x333a3f);
}
function commercial(m, p, ctx, rng) {
  const { w, d } = p, floors = rng.int(3, 4), fh = 3.2, c1 = rng.pick(PAL.modern), c2 = rng.pick([0xd9a441, 0x6e8fa8, 0xb85c4a, 0x8aa87a, 0x7a62a8]);
  const H = 4.2 + (floors - 1) * fh;
  m.box('paint', c1, 0, H / 2, 0, w, H, d);
  m.box('paint', 0xe9e5da, 0, H + 0.15, 0, w + 0.3, 0.3, d + 0.3);
  m.box('paint', c2, 0, 4.4, d / 2 + 0.04, w + 0.05, 0.5, 0.12);
  const ids = rng.pick([['textiles', 'jewellery'], ['mobiles', 'medical'], ['bakery', 'stationery'], ['fruits', 'grocery']]);
  for (let i = 0; i < 2; i++) {
    const cx = (i - 0.5) * (w / 2);
    m.box('glass', 0x23363c, cx, 1.6, d / 2 + 0.05, w * 0.4, 2.3, 0.06);
    shopSign(m.at(cx, 0), ids[i], w * 0.5, 3.45, d / 2 + 0.02);
  }
  for (let f = 0; f < floors - 1; f++) {
    const y = 4.2 + f * fh + 1.5;
    for (let i = 0; i < 3; i++) win(m, -w * 0.3 + i * w * 0.3, y, d / 2, 1.4, 1.5, 0x4a5258);
    m.box('paint', c2, 0, y - 1.5, d / 2 + 0.08, w + 0.05, 0.14, 0.2);
  }
  m.box('paint', 0x1c1f22, w * 0.3, H + 1.0, -d * 0.2, 0.7, 0.7, 1.2); m.cyl('paint', 0x1c1f22, w * 0.3, H + 0.9, -d * 0.2, 0.7, 0.7, 1.2, 10);
  sideWins(m, w, d, 6, [-d * 0.2, d * 0.2], 1.2, 1.4, 0x4a5258);
  awning(m, w * 0.9, 2.95, d / 2 + 0.7, rng);
}

// ---- Bus shelter ----------------------------------------------------------------------------
export function busStop(b, ctx, x, z, ry, rng) {
  const m = new Local(b, x, z, ry);
  m.flat('paint', 0xb9b4aa, 0, 0.2, 0, 5.2, 2.2);
  for (const lx of [-2.4, 2.4]) m.cyl('metal', 0x2d4f8a, lx, 1.5, 0.9, 0.07, 0.07, 3, 6);
  m.box('paint', 0x2d4f8a, 0, 3.05, 0.1, 5.4, 0.14, 2.3, 0, 0.06);
  m.box('paint', 0xf3e6a0, 0, 1.6, -0.9, 5.0, 2.7, 0.1);
  m.box('paint', 0xc41e24, 0, 0.55, -0.84, 5.0, 0.8, 0.06);
  m.quad('signs', 0xffffff, 0, 2.55, -0.82, 3.2, 0.8, 0, 0, 0, signUV('busstop'));
  m.box('wood', 0x7a5230, 0, 0.62, -0.5, 3.6, 0.07, 0.5);
  for (const lx of [-1.6, 1.6]) m.box('metal', 0x333a3f, lx, 0.4, -0.5, 0.07, 0.4, 0.4);
  ctx.obbs.push({ ...m.obbData(0, -0.9, 2.6, 0.2), type: 'busstop' });
  ctx.footprints.push({ ...m.obbData(0, 0, 2.8, 1.3), type: 'busstop' });
  ctx.minimap.push({ x, z, hw: 2.6, hd: 1.1, a: ry, type: 'busstop' });
}
Local.prototype.obbData = function (lx, lz, hw, hd) { const [X, Z] = this.w(lx, lz); return { x: X, z: Z, hw, hd, a: this.ry, c: this.c, s: this.s }; };

// ---- Police station (reference: olive-green ground floor, white concrete frame, covered porch) -
export function policeStation(b, ctx, x, z, ry, rng) {
  const m = new Local(b, x, z, ry), W = 26, D = 9;
  const olive = 0x8e8a2e, white = 0xf2f1ec, grey = 0xa6a7a3;
  m.box('paint', 0xb3b4af, 0, 0.3, 0, W + 1, 0.6, D + 1);
  m.box('paint', olive, 0, 3.4, 0, W, 5.6, D); // ground floor + first-floor body
  m.box('paint', white, 0, 4.2, -0.2, W + 0.2, 4.0, D - 0.4); // white upper volume
  m.box('paint', white, 0, 8.3, 0, W + 0.5, 0.6, D + 0.5); // roof slab
  for (let i = 0; i < 6; i++) m.box('paint', white, -10 + i * 4, 8.9, D / 2 - 0.1, 2.4, 0.9, 0.3); // parapet blocks
  // covered entrance porch
  m.box('paint', white, 0, 4.9, D / 2 + 2.2, 9.5, 0.45, 4.6);
  for (const lx of [-4.3, 4.3]) m.box('paint', white, lx, 2.65, D / 2 + 3.9, 0.7, 4.1, 0.7);
  m.box('paint', white, 0, 3.0, D / 2 + 0.2, 9.5, 5.4, 0.4);
  m.box('paint', 0x6b4a2a, -1.0, 2.0, D / 2 + 0.44, 1.2, 2.5, 0.08);
  m.box('paint', 0x6b4a2a, 1.0, 2.0, D / 2 + 0.44, 1.2, 2.5, 0.08);
  m.box('glass', 0x23363c, 0, 2.0, D / 2 + 0.5, 2.8, 2.3, 0.05);
  // red/blue signboard (Malayalam + English) above the porch
  m.box('paint', 0x222222, 0, 6.2, D / 2 + 4.3, 8.0, 2.1, 0.12);
  m.quad('signs', 0xffffff, 0, 6.2, D / 2 + 4.38, 7.8, 1.95, 0, 0, 0, signUV('police'));
  // steps
  for (let i = 0; i < 4; i++) m.box('paint', grey, 0, 0.15 + i * 0.15, D / 2 + 4.6 + (3 - i) * 0.55, 10.5, 0.3 + i * 0.15 - 0.15, 0.55);
  m.box('metal', 0xd7d9d6, -5.4, 0.9, D / 2 + 5.6, 0.06, 1.0, 2.4); m.box('metal', 0xd7d9d6, 5.4, 0.9, D / 2 + 5.6, 0.06, 1.0, 2.4);
  // wings: windows and shuttered annex
  for (const s of [-1, 1]) for (let i = 0; i < 2; i++) {
    win(m, s * (7.8 + i * 3.4), 2.4, D / 2, 1.5, 1.4, 0xf2f1ec);
    win(m, s * (7.8 + i * 3.4), 6.3, D / 2 - 0.2, 1.5, 1.4, 0xf2f1ec);
  }
  m.box('paint', grey, 10.2, 1.8, D / 2 + 0.06, 4.0, 3.2, 0.08);
  m.box('lamp', 0xfff2c0, 0, 4.4, D / 2 + 4.3, 0.5, 0.18, 0.3);
  m.box('lamp', 0xfff2c0, -8, 5.0, D / 2 + 0.3, 0.4, 0.15, 0.25);
  for (const lx of [-W / 2, W / 2]) win(m.at(lx, 0, lx < 0 ? -Math.PI / 2 : Math.PI / 2), 0, 2.4, 0, 1.5, 1.4, 0xf2f1ec);
  // forecourt: paved parking with railings and an entrance gap
  m.flat('paving', 0xffffff, 0, 0.03, 15.5, 34, 22);
  for (let i = 0; i < 12; i++) { const lx = -12 + i * 2; if (Math.abs(lx) < 4) continue; m.box('metal', 0xd7d9d6, lx, 0.55, D / 2 + 21.6, 0.08, 1.1, 0.08); }
  for (const s of [-1, 1]) m.box('metal', 0xd7d9d6, s * 8.6, 0.95, D / 2 + 21.6, 8.2, 0.07, 0.07);
  m.quad('signs', 0xffffff, 0, 2.2, D / 2 + 21.7, 2.4, 0.6, 0, 0, 0, signUV('parking'));
  m.cyl('metal', 0xd7d9d6, -4.2, 3.0, D / 2 + 21.5, 0.06, 0.06, 6, 6);
  // flagpole
  m.cyl('metal', 0xd7d9d6, -14.5, 5.0, D / 2 + 9, 0.06, 0.06, 10, 6);
  m.box('paint', 0xff9933, -14.2, 9.5, D / 2 + 9, 0.7, 0.14, 0.04); m.box('paint', 0xffffff, -14.2, 9.36, D / 2 + 9, 0.7, 0.14, 0.04); m.box('paint', 0x138808, -14.2, 9.22, D / 2 + 9, 0.7, 0.14, 0.04);
  for (const lx of [-13, 13]) { const [px, pz] = m.w(lx, D / 2 + 8); palm(b, ctx, px, pz, rng, 0.8); }
  ctx.obbs.push({ ...m.obbData(0, 0, W / 2 + 0.3, D / 2 + 0.3), type: 'police', solid: true });
  ctx.obbs.push({ ...m.obbData(-4.3, D / 2 + 3.9, 0.4, 0.4), type: 'police' }, { ...m.obbData(4.3, D / 2 + 3.9, 0.4, 0.4), type: 'police' });
  ctx.footprints.push({ ...m.obbData(0, 9, 18, 18.3), type: 'police', hard: true });
  ctx.minimap.push({ x, z, hw: W / 2, hd: D / 2, a: ry, type: 'police' });
  return m;
}
