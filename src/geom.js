// Pure geometry helpers (no THREE dependency): primitives plus a Builder that merges thousands of
// small parts into a few chunked meshes. Chunking keeps frustum culling effective on phones, and
// keeping this file THREE-free lets the whole town be generated and tested in plain Node.

export function hexToLinear(hex) {
  const f = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return [f(((hex >> 16) & 255) / 255), f(((hex >> 8) & 255) / 255), f((hex & 255) / 255)];
}

export class Geo {
  constructor() { this.p = []; this.n = []; this.uv = []; this.i = []; }
  v(x, y, z, nx, ny, nz, u, w) { this.p.push(x, y, z); this.n.push(nx, ny, nz); this.uv.push(u, w); return this.p.length / 3 - 1; }
  q(a, b, c, d) { this.i.push(a, b, c, a, c, d); }
  t(a, b, c) { this.i.push(a, b, c); }
  // Flat polygon whose normal is flipped to point away from `inside`.
  face(pts, uvs, inside) {
    const [a, b, c] = pts;
    let nx = (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]);
    let ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
    let nz = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    let cx = 0, cy = 0, cz = 0;
    pts.forEach((p) => { cx += p[0]; cy += p[1]; cz += p[2]; });
    cx /= pts.length; cy /= pts.length; cz /= pts.length;
    const flip = (cx - inside[0]) * nx + (cy - inside[1]) * ny + (cz - inside[2]) * nz < 0;
    if (flip) { nx = -nx; ny = -ny; nz = -nz; }
    const ids = pts.map((p, k) => this.v(p[0], p[1], p[2], nx, ny, nz, uvs[k][0], uvs[k][1]));
    for (let k = 1; k < ids.length - 1; k++) { if (flip) this.t(ids[0], ids[k + 1], ids[k]); else this.t(ids[0], ids[k], ids[k + 1]); }
  }
}

const cache = new Map();
const memo = (key, fn) => { let v = cache.get(key); if (!v) { v = fn(); cache.set(key, v); } return v; };

export function unitBox() {
  return memo('box', () => {
    const g = new Geo();
    const faces = [
      [[0, 0, 1], [[-.5, -.5, .5], [.5, -.5, .5], [.5, .5, .5], [-.5, .5, .5]]],
      [[0, 0, -1], [[.5, -.5, -.5], [-.5, -.5, -.5], [-.5, .5, -.5], [.5, .5, -.5]]],
      [[1, 0, 0], [[.5, -.5, .5], [.5, -.5, -.5], [.5, .5, -.5], [.5, .5, .5]]],
      [[-1, 0, 0], [[-.5, -.5, -.5], [-.5, -.5, .5], [-.5, .5, .5], [-.5, .5, -.5]]],
      [[0, 1, 0], [[-.5, .5, .5], [.5, .5, .5], [.5, .5, -.5], [-.5, .5, -.5]]],
      [[0, -1, 0], [[-.5, -.5, -.5], [.5, -.5, -.5], [.5, -.5, .5], [-.5, -.5, .5]]]
    ];
    const uvs = [[0, 0], [1, 0], [1, 1], [0, 1]];
    faces.forEach(([n, c]) => { const ids = c.map((p, k) => g.v(p[0], p[1], p[2], n[0], n[1], n[2], uvs[k][0], uvs[k][1])); g.q(ids[0], ids[1], ids[2], ids[3]); });
    return g;
  });
}

export function unitQuad() {
  return memo('quad', () => {
    const g = new Geo();
    const a = g.v(-.5, -.5, 0, 0, 0, 1, 0, 0), b = g.v(.5, -.5, 0, 0, 0, 1, 1, 0), c = g.v(.5, .5, 0, 0, 0, 1, 1, 1), d = g.v(-.5, .5, 0, 0, 0, 1, 0, 1);
    g.q(a, b, c, d);
    return g;
  });
}

// Cylinder / cone along Y, height 1, centred at the origin.
export function cylGeo(rt, rb, seg = 8, caps = true) {
  return memo(`cyl${rt}_${rb}_${seg}_${caps}`, () => {
    const g = new Geo();
    const slope = rb - rt;
    for (let i = 0; i <= seg; i++) {
      const th = (i / seg) * Math.PI * 2, s = Math.sin(th), c = Math.cos(th);
      const l = Math.hypot(1, slope);
      g.v(s * rb, -.5, c * rb, s / l, slope / l, c / l, i / seg, 0);
      g.v(s * rt, .5, c * rt, s / l, slope / l, c / l, i / seg, 1);
    }
    for (let i = 0; i < seg; i++) { const a = i * 2; g.q(a, a + 2, a + 3, a + 1); }
    const cap = (y, r, ny) => {
      const ctr = g.v(0, y, 0, 0, ny, 0, .5, .5), ring = [];
      for (let i = 0; i <= seg; i++) { const th = (i / seg) * Math.PI * 2; ring.push(g.v(Math.sin(th) * r, y, Math.cos(th) * r, 0, ny, 0, .5 + Math.sin(th) * .5, .5 + Math.cos(th) * .5)); }
      for (let i = 0; i < seg; i++) { if (ny > 0) g.t(ctr, ring[i], ring[i + 1]); else g.t(ctr, ring[i + 1], ring[i]); }
    };
    if (caps && rt > 0) cap(.5, rt, 1);
    if (caps && rb > 0) cap(-.5, rb, -1);
    return g;
  });
}

// Unit UV-sphere (radius 1) scaled into ellipsoids with the transform.
export function sphereGeo(ws = 8, hs = 6) {
  return memo(`sph${ws}_${hs}`, () => {
    const g = new Geo();
    for (let i = 0; i <= hs; i++) {
      const ph = (i / hs) * Math.PI;
      for (let j = 0; j <= ws; j++) {
        const th = (j / ws) * Math.PI * 2;
        const x = Math.sin(ph) * Math.sin(th), y = Math.cos(ph), z = Math.sin(ph) * Math.cos(th);
        g.v(x, y, z, x, y, z, j / ws, 1 - i / hs);
      }
    }
    for (let i = 0; i < hs; i++) for (let j = 0; j < ws; j++) {
      const a = i * (ws + 1) + j, b = a + 1, d = a + ws + 1, c = d + 1;
      g.q(a, d, c, b);
    }
    return g;
  });
}

// Open elliptical arch with its axis along Z (canvas roofs, bus roofs). theta measured from +Y.
export function archZ(rx, ry, len, seg, a0, a1) {
  return memo(`archZ${rx}_${ry}_${len}_${seg}_${a0}_${a1}`, () => {
    const g = new Geo();
    for (let i = 0; i <= seg; i++) {
      const th = a0 + (a1 - a0) * (i / seg), s = Math.sin(th), c = Math.cos(th);
      const nl = Math.hypot(s / rx, c / ry), nx = s / rx / nl, ny = c / ry / nl;
      g.v(rx * s, ry * c, -len / 2, nx, ny, 0, i / seg, 0);
      g.v(rx * s, ry * c, len / 2, nx, ny, 0, i / seg, 1);
    }
    for (let i = 0; i < seg; i++) { const a = i * 2; g.q(a, a + 1, a + 3, a + 2); }
    return g;
  });
}

// Open arch with its axis along X (mudguards over wheels). Profile in the Z/Y plane, theta from +Y.
export function archX(rz, ry, width, seg, a0, a1) {
  return memo(`archX${rz}_${ry}_${width}_${seg}_${a0}_${a1}`, () => {
    const g = new Geo();
    for (let i = 0; i <= seg; i++) {
      const th = a0 + (a1 - a0) * (i / seg), s = Math.sin(th), c = Math.cos(th);
      const nl = Math.hypot(s / rz, c / ry), nz = s / rz / nl, ny = c / ry / nl;
      g.v(-width / 2, ry * c, rz * s, 0, ny, nz, i / seg, 0);
      g.v(width / 2, ry * c, rz * s, 0, ny, nz, i / seg, 1);
    }
    for (let i = 0; i < seg; i++) { const a = i * 2; g.q(a, a + 2, a + 3, a + 1); }
    return g;
  });
}

// Palm / banana leaf: a drooping strip pointing along +Z (textured with leaflets via alpha).
export function leafGeo(len, wid, rise, droop, segs = 4) {
  return memo(`leaf${len}_${wid}_${rise}_${droop}_${segs}`, () => {
    const g = new Geo();
    for (let i = 0; i <= segs; i++) {
      const t = i / segs, z = len * t, y = len * (rise * t - droop * t * t);
      const w = wid * Math.min(1, 0.35 + t * 3) * (1 - 0.88 * Math.pow(t, 2.2)) * 0.5;
      const dy = len * (rise - 2 * droop * t), dl = Math.hypot(dy, len) || 1;
      const nx = 0, ny = len / dl, nz = -dy / dl;
      g.v(-w, y, z, nx, ny, nz, 0, t);
      g.v(w, y, z, nx, ny, nz, 1, t);
    }
    for (let i = 0; i < segs; i++) { const a = i * 2; g.q(a, a + 2, a + 3, a + 1); }
    return g;
  });
}

// Slightly bent, tapered palm trunk. Returns geometry plus the top position.
export function trunkGeo(h, rb, rt, bendX, bendZ, sides = 5, rings = 5) {
  return memo(`trunk${h}_${rb}_${rt}_${bendX}_${bendZ}_${sides}_${rings}`, () => {
    const g = new Geo();
    for (let r = 0; r <= rings; r++) {
      const t = r / rings, y = h * t, cx = bendX * t * t, cz = bendZ * t * t, rad = rb + (rt - rb) * t;
      for (let s = 0; s <= sides; s++) {
        const th = (s / sides) * Math.PI * 2, sn = Math.sin(th), cs = Math.cos(th);
        g.v(cx + sn * rad, y, cz + cs * rad, sn, 0.1, cs, s / sides, t * 4);
      }
    }
    for (let r = 0; r < rings; r++) for (let s = 0; s < sides; s++) {
      const a = r * (sides + 1) + s, b = a + 1, d = a + sides + 1, c = d + 1;
      g.q(a, b, c, d);
    }
    g.top = [bendX, h, bendZ];
    return g;
  });
}

// ---- Roofs (UV scaled in metres / tile) -----------------------------------------------------
export function hipRoofGeo(w, d, h, ridge, tile = 1.3) {
  const g = new Geo(), W = w / 2, D = d / 2, R = Math.min(ridge, w * 0.9) / 2, inside = [0, -1, 0];
  const A = [-W, 0, -D], B = [W, 0, -D], C = [W, 0, D], Dd = [-W, 0, D], R1 = [-R, h, 0], R2 = [R, h, 0];
  const sl = Math.hypot(D, h) / tile;
  g.face([Dd, C, R2, R1], [[-W / tile, 0], [W / tile, 0], [R / tile, sl], [-R / tile, sl]], inside);
  g.face([B, A, R1, R2], [[W / tile, 0], [-W / tile, 0], [-R / tile, sl], [R / tile, sl]], inside);
  const se = Math.hypot(W - R, h) / tile;
  g.face([A, Dd, R1], [[-D / tile, 0], [D / tile, 0], [0, se]], inside);
  g.face([C, B, R2], [[D / tile, 0], [-D / tile, 0], [0, se]], inside);
  return g;
}
export function gableSlopesGeo(w, d, h, tile = 1.3) {
  const g = new Geo(), W = w / 2, D = d / 2, inside = [0, -1, 0], sl = Math.hypot(D, h) / tile;
  g.face([[-W, 0, D], [W, 0, D], [W, h, 0], [-W, h, 0]], [[-W / tile, 0], [W / tile, 0], [W / tile, sl], [-W / tile, sl]], inside);
  g.face([[W, 0, -D], [-W, 0, -D], [-W, h, 0], [W, h, 0]], [[W / tile, 0], [-W / tile, 0], [-W / tile, sl], [W / tile, sl]], inside);
  return g;
}
export function gableEndsGeo(w, d, h) {
  const g = new Geo(), W = w / 2, D = d / 2, inside = [0, 0, 0];
  g.face([[-W, 0, -D], [-W, 0, D], [-W, h, 0]], [[0, 0], [1, 0], [.5, 1]], [0, h / 3, 0]);
  g.face([[W, 0, D], [W, 0, -D], [W, h, 0]], [[0, 0], [1, 0], [.5, 1]], [0, h / 3, 0]);
  return g;
}
// Single-pitch roof sloping from height h0 at z=+d/2 (front) down/up to h1 at z=-d/2.
export function shedRoofGeo(w, d, h0, h1, tile = 1.4) {
  const g = new Geo(), W = w / 2, D = d / 2, inside = [0, -5, 0];
  const sl = Math.hypot(d, h1 - h0) / tile;
  g.face([[-W, h0, D], [W, h0, D], [W, h1, -D], [-W, h1, -D]], [[0, 0], [w / tile, 0], [w / tile, sl], [0, sl]], inside);
  return g;
}

// ---- Transform + Builder --------------------------------------------------------------------
function rotMatrix(rx, ry, rz) {
  const cx = Math.cos(rx), sx = Math.sin(rx), cy = Math.cos(ry), sy = Math.sin(ry), cz = Math.cos(rz), sz = Math.sin(rz);
  // R = Ry * Rx * Rz
  const rxz = [cz, -sz, 0, cx * sz, cx * cz, -sx, sx * sz, sx * cz, cx];
  return [
    cy * rxz[0] + sy * rxz[6], cy * rxz[1] + sy * rxz[7], cy * rxz[2] + sy * rxz[8],
    rxz[3], rxz[4], rxz[5],
    -sy * rxz[0] + cy * rxz[6], -sy * rxz[1] + cy * rxz[7], -sy * rxz[2] + cy * rxz[8]
  ];
}

export class Builder {
  constructor(chunk = 0) { this.chunk = chunk; this.buckets = new Map(); this.triangles = 0; }

  geo(key, color, g, x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0, uvRect = null) {
    const cx = this.chunk ? Math.floor(x / this.chunk) : 0, cz = this.chunk ? Math.floor(z / this.chunk) : 0;
    const bk = key + '|' + cx + '|' + cz;
    let b = this.buckets.get(bk);
    if (!b) { b = { key, cx, cz, pos: [], nor: [], uv: [], col: [], idx: [] }; this.buckets.set(bk, b); }
    const R = (rx || ry || rz) ? rotMatrix(rx, ry, rz) : [1, 0, 0, 0, 1, 0, 0, 0, 1];
    const col = hexToLinear(color), base = b.pos.length / 3, P = g.p, N = g.n, U = g.uv;
    for (let k = 0; k < P.length; k += 3) {
      const px = P[k] * sx, py = P[k + 1] * sy, pz = P[k + 2] * sz;
      b.pos.push(R[0] * px + R[1] * py + R[2] * pz + x, R[3] * px + R[4] * py + R[5] * pz + y, R[6] * px + R[7] * py + R[8] * pz + z);
      let nx = N[k] / sx, ny = N[k + 1] / sy, nz = N[k + 2] / sz;
      const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      b.nor.push(R[0] * nx + R[1] * ny + R[2] * nz, R[3] * nx + R[4] * ny + R[5] * nz, R[6] * nx + R[7] * ny + R[8] * nz);
      b.col.push(col[0], col[1], col[2]);
    }
    for (let k = 0; k < U.length; k += 2) {
      if (uvRect) b.uv.push(uvRect[0] + U[k] * (uvRect[2] - uvRect[0]), uvRect[1] + U[k + 1] * (uvRect[3] - uvRect[1]));
      else b.uv.push(U[k], U[k + 1]);
    }
    const I = g.i;
    for (let k = 0; k < I.length; k++) b.idx.push(I[k] + base);
    this.triangles += I.length / 3;
  }

  box(key, color, x, y, z, w, h, d, ry = 0, rx = 0, rz = 0) { this.geo(key, color, unitBox(), x, y, z, w, h, d, rx, ry, rz); }
  cyl(key, color, x, y, z, rt, rb, h, seg = 8, ry = 0, rx = 0, rz = 0, caps = true) { this.geo(key, color, cylGeo(rt, rb, seg, caps), x, y, z, 1, h, 1, rx, ry, rz); }
  // Cylinder lying along the X axis (wheels, bars) or Z axis.
  cylX(key, color, x, y, z, r, len, seg = 10, ry = 0) { this.geo(key, color, cylGeo(r, r, seg), x, y, z, 1, len, 1, 0, ry, Math.PI / 2); }
  cylZ(key, color, x, y, z, r, len, seg = 10, ry = 0) { this.geo(key, color, cylGeo(r, r, seg), x, y, z, 1, len, 1, Math.PI / 2, ry, 0); }
  sph(key, color, x, y, z, rx, ry, rz, ws = 8, hs = 6, yaw = 0) { this.geo(key, color, sphereGeo(ws, hs), x, y, z, rx, ry, rz, 0, yaw, 0); }
  quad(key, color, x, y, z, w, h, ry = 0, rx = 0, rz = 0, uvRect = null) { this.geo(key, color, unitQuad(), x, y, z, w, h, 1, rx, ry, rz, uvRect); }
  // Horizontal rectangle facing up, spanning x0..x1, z0..z1 at height y.
  flat(key, color, x0, z0, x1, z1, y, uvRect = null) { this.geo(key, color, unitQuad(), (x0 + x1) / 2, y, (z0 + z1) / 2, x1 - x0, z1 - z0, 1, -Math.PI / 2, 0, 0, uvRect); }

  // Roofs. (x,y,z) is the centre of the eave rectangle; ry rotates the whole roof.
  hip(roofKey, roofColor, x, y, z, w, d, h, ridge, ry = 0) { this.geo(roofKey, roofColor, hipRoofGeo(w, d, h, ridge), x, y, z, 1, 1, 1, 0, ry, 0); }
  gable(roofKey, roofColor, endKey, endColor, x, y, z, w, d, h, ry = 0) {
    this.geo(roofKey, roofColor, gableSlopesGeo(w, d, h), x, y, z, 1, 1, 1, 0, ry, 0);
    this.geo(endKey, endColor, gableEndsGeo(w - 0.05, d - 0.4, h), x, y, z, 1, 1, 1, 0, ry, 0);
  }
  shed(roofKey, roofColor, x, y, z, w, d, h0, h1, ry = 0) { this.geo(roofKey, roofColor, shedRoofGeo(w, d, h0, h1), x, y, z, 1, 1, 1, 0, ry, 0); }

  // Convert accumulated buckets to typed arrays ready for BufferGeometry.
  toBuffers() {
    const out = [];
    this.buckets.forEach((b) => {
      const n = b.pos.length / 3;
      out.push({
        key: b.key, cx: b.cx, cz: b.cz, vertexCount: n,
        pos: new Float32Array(b.pos), nor: new Float32Array(b.nor), uv: new Float32Array(b.uv), col: new Float32Array(b.col),
        idx: n > 65535 ? new Uint32Array(b.idx) : new Uint16Array(b.idx)
      });
    });
    return out;
  }
}
