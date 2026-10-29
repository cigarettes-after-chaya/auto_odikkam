// Small 2D collision helpers shared by the world generator, the player physics and traffic AI.
// An OBB is { x, z, hw, hd, a } where a is its yaw (Three.js rotation.y); c/s cache cos/sin.
export function prep(o) { o.c = Math.cos(o.a); o.s = Math.sin(o.a); return o; }

// Push a circle out of an OBB. Returns { nx, nz, pen } (normal points from the box to the circle) or null.
export function circleObb(cx, cz, r, o) {
  const dx = cx - o.x, dz = cz - o.z;
  const reach = Math.hypot(o.hw, o.hd) + r;
  if (dx > reach || dx < -reach || dz > reach || dz < -reach) return null;
  const c = o.c ?? Math.cos(o.a), s = o.s ?? Math.sin(o.a);
  const lx = dx * c - dz * s, lz = dx * s + dz * c; // local x axis = (cos,-sin), local z axis = (sin,cos)
  const qx = Math.max(-o.hw, Math.min(o.hw, lx)), qz = Math.max(-o.hd, Math.min(o.hd, lz));
  let ex = lx - qx, ez = lz - qz, d = Math.hypot(ex, ez), nlx, nlz, pen;
  if (d > 1e-6) { if (d >= r) return null; nlx = ex / d; nlz = ez / d; pen = r - d; }
  else { // centre inside the box: leave through the nearest face
    const px = o.hw - Math.abs(lx), pz = o.hd - Math.abs(lz);
    if (px < pz) { nlx = Math.sign(lx) || 1; nlz = 0; pen = px + r; } else { nlx = 0; nlz = Math.sign(lz) || 1; pen = pz + r; }
  }
  return { nx: nlx * c + nlz * s, nz: -nlx * s + nlz * c, pen };
}

export function obbOverlap(a, b, margin = 0) {
  const ra = Math.hypot(a.hw, a.hd), rb = Math.hypot(b.hw, b.hd);
  if (Math.hypot(a.x - b.x, a.z - b.z) > ra + rb + margin) return false;
  const ca = a.c ?? Math.cos(a.a), sa = a.s ?? Math.sin(a.a), cb = b.c ?? Math.cos(b.a), sb = b.s ?? Math.sin(b.a);
  const axes = [[ca, -sa], [sa, ca], [cb, -sb], [sb, cb]];
  const dx = b.x - a.x, dz = b.z - a.z;
  for (const [ax, az] of axes) {
    const pa = a.hw * Math.abs(ax * ca - az * sa) + a.hd * Math.abs(ax * sa + az * ca);
    const pb = b.hw * Math.abs(ax * cb - az * sb) + b.hd * Math.abs(ax * sb + az * cb);
    if (Math.abs(dx * ax + dz * az) > pa + pb + margin) return false;
  }
  return true;
}

export function obbCorners(o) {
  const c = o.c ?? Math.cos(o.a), s = o.s ?? Math.sin(o.a), out = [];
  for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, 0], [0, -1], [0, 1], [-1, 0], [1, 0]]) {
    const lx = u * o.hw, lz = v * o.hd;
    out.push([o.x + lx * c + lz * s, o.z - lx * s + lz * c]);
  }
  return out;
}
