// Kerala town generator (pure JS, seeded). Produces road/building geometry buffers plus all the
// data the game needs: colliders, traffic routes, missions, minimap data and a road-clearance query.
// World coordinates: x east, z south, y up. Vehicles drive on the LEFT, as in India.
import { makeRng } from './rng.js';
import { Builder, Geo } from './geom.js';
import { circleObb, obbOverlap, obbCorners, prep } from './collide.js';
import { signUV } from './signs.js';
import { palm, broadleaf, banana, bush, streetLight, utilityPole, signPost, stringCables, compoundWall, motorbike, vendorStall, PAL } from './props.js';
import { planBuilding, buildBuilding, busStop, policeStation } from './buildings.js';
import { OSM } from './osmdata.js';

export const WORLD = { limit: 220, ring: 170 };

// Nilamel–Madathara corridor built from real OpenStreetMap road geometry (© OpenStreetMap contributors, ODbL),
// converted and compressed by tools/osm_to_game.py into src/osmdata.js. Road positions, names and classes are real;
// widths, buildings and scenery are stylised. Origin is the middle of the corridor between Kadakkal and Chithara.

// ---- path utilities -------------------------------------------------------------------------
function line(x0, z0, x1, z1) { return [[x0, z0], [x1, z1]]; }
function arc(cx, cz, r, a0, a1, n = 24) { const o = []; for (let i = 0; i <= n; i++) { const a = a0 + ((a1 - a0) * i) / n; o.push([cx + r * Math.cos(a), cz + r * Math.sin(a)]); } return o; }
function ringPts() {
  const P = Math.PI;
  return [].concat(line(-110, -150, 110, -150), arc(110, -110, 40, -P / 2, 0), line(150, -110, 150, 110), arc(110, 110, 40, 0, P / 2), line(110, 150, -110, 150), arc(-110, 110, 40, P / 2, P), line(-150, 110, -150, -110), arc(-110, -110, 40, P, 1.5 * P));
}
function uniform(pts, closed, target = 3) {
  const src = closed ? pts.concat([pts[0]]) : pts, cum = [0];
  for (let i = 1; i < src.length; i++) cum.push(cum[i - 1] + Math.hypot(src[i][0] - src[i - 1][0], src[i][1] - src[i - 1][1]));
  const len = cum[cum.length - 1], n = Math.max(2, Math.ceil(len / target)), step = len / n, out = [];
  let k = 1;
  for (let i = 0; i <= (closed ? n - 1 : n); i++) {
    const t = i * step;
    while (k < cum.length - 1 && cum[k] < t) k++;
    const f = (t - cum[k - 1]) / ((cum[k] - cum[k - 1]) || 1);
    out.push([src[k - 1][0] + (src[k][0] - src[k - 1][0]) * f, src[k - 1][1] + (src[k][1] - src[k - 1][1]) * f]);
  }
  return { pts: out, len, step };
}

function makeRoad(def) {
  const u = uniform(def.pts, !!def.closed, 3);
  const r = { ...def, pts: u.pts, len: u.len, step: u.step };
  const n = r.pts.length;
  r.nx = new Float32Array(n); r.nz = new Float32Array(n); // left normals (vehicle left = (fz,-fx))
  for (let i = 0; i < n; i++) {
    const a = r.pts[r.closed ? (i + n - 1) % n : Math.max(0, i - 1)], c = r.pts[r.closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
    const dx = c[0] - a[0], dz = c[1] - a[1], l = Math.hypot(dx, dz) || 1;
    r.nx[i] = dz / l; r.nz[i] = -dx / l;
  }
  let minx = 1e9, maxx = -1e9, minz = 1e9, maxz = -1e9;
  r.pts.forEach(([x, z]) => { minx = Math.min(minx, x); maxx = Math.max(maxx, x); minz = Math.min(minz, z); maxz = Math.max(maxz, z); });
  Object.assign(r, { minx, maxx, minz, maxz });
  return r;
}
function pointAt(r, s) {
  const n = r.pts.length;
  let t = r.closed ? ((s % r.len) + r.len) % r.len : Math.max(0, Math.min(r.len, s));
  const i = Math.min(Math.floor(t / r.step), r.closed ? n - 1 : n - 2), f = (t - i * r.step) / r.step;
  const a = r.pts[i], c = r.pts[(i + 1) % n], dx = c[0] - a[0], dz = c[1] - a[1], l = Math.hypot(dx, dz) || 1;
  return { x: a[0] + dx * f, z: a[1] + dz * f, fx: dx / l, fz: dz / l };
}
function distToRoad(r, x, z) {
  const n = r.pts.length, segs = r.closed ? n : n - 1;
  let best = 1e9;
  for (let i = 0; i < segs; i++) {
    const a = r.pts[i], c = r.pts[(i + 1) % n], dx = c[0] - a[0], dz = c[1] - a[1];
    let t = ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1); t = t < 0 ? 0 : t > 1 ? 1 : t;
    const px = a[0] + dx * t - x, pz = a[1] + dz * t - z, d = px * px + pz * pz;
    if (d < best) best = d;
  }
  return Math.sqrt(best);
}

// ---- road mesh helpers ----------------------------------------------------------------------
function stripGeo(r, oL, oR, y, skip, uvs = 0.125) {
  const g = new Geo(), n = r.pts.length, segs = r.closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const j = (i + 1) % n, p0 = r.pts[i], p1 = r.pts[j];
    if (skip && skip((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2)) continue;
    const P = [[p0[0] + r.nx[i] * oL, p0[1] + r.nz[i] * oL], [p0[0] + r.nx[i] * oR, p0[1] + r.nz[i] * oR], [p1[0] + r.nx[j] * oR, p1[1] + r.nz[j] * oR], [p1[0] + r.nx[j] * oL, p1[1] + r.nz[j] * oL]];
    const ids = P.map(([x, z]) => g.v(x, y, z, 0, 1, 0, x * uvs, z * uvs));
    g.q(ids[0], ids[1], ids[2], ids[3]);
  }
  return g;
}
function wallGeo(r, off, y0, y1, faceLeft, skip) {
  const g = new Geo(), n = r.pts.length, segs = r.closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const j = (i + 1) % n, p0 = r.pts[i], p1 = r.pts[j];
    if (skip && skip((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2)) continue;
    const a = [p0[0] + r.nx[i] * off, p0[1] + r.nz[i] * off], c = [p1[0] + r.nx[j] * off, p1[1] + r.nz[j] * off];
    const sx = faceLeft ? r.nx[i] : -r.nx[i], sz = faceLeft ? r.nz[i] : -r.nz[i];
    const ids = [[a, y0], [c, y0], [c, y1], [a, y1]].map(([p, y]) => g.v(p[0], y, p[1], sx, 0, sz, 0, y));
    if (faceLeft) g.q(ids[1], ids[0], ids[3], ids[2]); else g.q(ids[0], ids[1], ids[2], ids[3]);
  }
  return g;
}
function dashGeo(r, off, width, dash, gap, y, skip) {
  const g = new Geo();
  for (let s = 1; s + dash < r.len - 1; s += dash + gap) {
    const a = pointAt(r, s), c = pointAt(r, s + dash), mx = (a.x + c.x) / 2, mz = (a.z + c.z) / 2;
    if (skip && skip(mx, mz)) continue;
    const nxA = a.fz, nzA = -a.fx, nxC = c.fz, nzC = -c.fx, h = width / 2;
    const P = [[a.x + nxA * (off + h), a.z + nzA * (off + h)], [a.x + nxA * (off - h), a.z + nzA * (off - h)], [c.x + nxC * (off - h), c.z + nzC * (off - h)], [c.x + nxC * (off + h), c.z + nzC * (off + h)]];
    const ids = P.map(([x, z]) => g.v(x, y, z, 0, 1, 0, 0, 0));
    g.q(ids[0], ids[1], ids[2], ids[3]);
  }
  return g;
}
// Traffic loop: rounded polygon, resampled uniformly.
function roundedLoop(vs, rad) {
  const pts = [], n = vs.length;
  for (let i = 0; i < n; i++) {
    const v = vs[i], p = vs[(i + n - 1) % n], q = vs[(i + 1) % n];
    let u1 = [p[0] - v[0], p[1] - v[1]], u2 = [q[0] - v[0], q[1] - v[1]];
    const l1 = Math.hypot(...u1), l2 = Math.hypot(...u2); u1 = [u1[0] / l1, u1[1] / l1]; u2 = [u2[0] / l2, u2[1] / l2];
    const th = Math.acos(Math.max(-1, Math.min(1, u1[0] * u2[0] + u1[1] * u2[1]))), t = rad / Math.tan(th / 2);
    const bis = [u1[0] + u2[0], u1[1] + u2[1]], bl = Math.hypot(...bis), cd = rad / Math.sin(th / 2);
    const cx = v[0] + (bis[0] / bl) * cd, cz = v[1] + (bis[1] / bl) * cd;
    const s = [v[0] + u1[0] * t, v[1] + u1[1] * t], e = [v[0] + u2[0] * t, v[1] + u2[1] * t];
    let a0 = Math.atan2(s[1] - cz, s[0] - cx), a1 = Math.atan2(e[1] - cz, e[0] - cx), da = a1 - a0;
    while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
    for (let k = 0; k <= 8; k++) { const a = a0 + (da * k) / 8; pts.push([cx + rad * Math.cos(a), cz + rad * Math.sin(a)]); }
  }
  return pts;
}
function makeRoute(name, pts, closed, laneOff, kind) {
  const u = uniform(pts, closed, 1.5), n = u.pts.length, out = [];
  for (let i = 0; i < n; i++) {
    const a = u.pts[(i + n - 2) % n], c = u.pts[(i + 2) % n], dx = c[0] - a[0], dz = c[1] - a[1], l = Math.hypot(dx, dz) || 1;
    out.push([u.pts[i][0] + (dz / l) * laneOff, u.pts[i][1] - (dx / l) * laneOff]); // offset to the vehicle's left
  }
  return { name, pts: out, len: u.len, step: u.step, n, kind };
}

// Closed two-lane loop along a road: out on the left lane, round an elongated U-turn, back on the other lane.
function laneLoop(pts, off) {
  const u = uniform(pts, false, 2).pts, rv = u.slice().reverse();
  const nrm = (a, i) => { const p = a[Math.max(0, i - 2)], q = a[Math.min(a.length - 1, i + 2)], dx = q[0] - p[0], dz = q[1] - p[1], l = Math.hypot(dx, dz) || 1; return [dz / l, -dx / l, dx / l, dz / l]; };
  const lane = (a) => a.map((p, i) => { const [nx, nz] = nrm(a, i); return [p[0] + nx * off, p[1] + nz * off]; });
  const cap = (a) => { // turn at the end of a, bulging 6 units beyond the tip
    const tip = a[a.length - 1], [nx, nz, fx, fz] = nrm(a, a.length - 1), out = [];
    for (let k = 1; k < 11; k++) { const t = (Math.PI * k) / 11; out.push([tip[0] + nx * off * Math.cos(t) + fx * 6 * Math.sin(t), tip[1] + nz * off * Math.cos(t) + fz * 6 * Math.sin(t)]); }
    return out;
  };
  return lane(u).concat(cap(u), lane(rv), cap(rv));
}

// ---- world generator (generator function so the UI can show progress) ---------------------------
export function* generateWorld(seed = 20241) {
  const rng = makeRng(seed);
  const roadBuilder = new Builder(0), sb = new Builder(100);
  const ctx = { obbs: [], circles: [], footprints: [], lots: [], cables: [], minimap: [], rng };

  yield 'Laying out Kerala roads…';
  const defs = OSM.roads.map((r) => ({ ...r, closed: false, poles: r.hw === 'unclassified' ? -1 : 0 }));
  const roads = defs.map(makeRoad);
  const byId = Object.fromEntries(roads.map((r) => [r.id, r]));

  const clearance = (x, z, skip = null) => {
    let best = 1e9;
    for (const r of roads) {
      if (r === skip) continue;
      const dx = Math.max(r.minx - x, 0, x - r.maxx), dz = Math.max(r.minz - z, 0, z - r.maxz);
      if (Math.hypot(dx, dz) - r.w / 2 >= best) continue;
      best = Math.min(best, distToRoad(r, x, z) - r.w / 2);
    }
    return best;
  };
  const nearOther = (r, x, z, pad) => { for (const o of roads) if (o !== r && distToRoad(o, x, z) < o.w / 2 + pad) return true; return false; };
  const townDist = (x, z) => { let d = 1e9; for (const t of OSM.towns) d = Math.min(d, Math.hypot(x - t.x, z - t.z)); return d; };
  const inTown = (x, z) => townDist(x, z) <= 46;
  // nearest road point to (x,z) and a spot beside that road on the same side, facing the road
  const spotBeside = (x, z, gap = 4) => {
    let best = null, bd = 1e9;
    for (const r of roads) for (let i = 0; i < r.pts.length; i++) { const d = Math.hypot(r.pts[i][0] - x, r.pts[i][1] - z); if (d < bd) { bd = d; best = { r, i }; } }
    const { r, i } = best, P = pointAt(r, i * r.step), side = ((x - P.x) * P.fz - (z - P.z) * P.fx) >= 0 ? 1 : -1;
    const nx = P.fz * side, nz = -P.fx * side, off = r.w / 2 + gap;
    return { x: P.x + nx * off, z: P.z + nz * off, yaw: Math.atan2(-nx, -nz), road: r, s: i * r.step, fx: P.fx, fz: P.fz };
  };
  const nearestS = (r, x, z) => { let bi = 0, bd = 1e9; for (let i = 0; i < r.pts.length; i++) { const d = Math.hypot(r.pts[i][0] - x, r.pts[i][1] - z); if (d < bd) { bd = d; bi = i; } } return bi * r.step; };
  const poi = (re, type) => OSM.pois.find((p) => re.test(p.name) && (!type || p.type === type)) || null;

  // ---- asphalt, kerbs, drains, markings -------------------------------------------------------
  yield 'Paving roads and junctions…';
  const gAsphalt = new Geo(), gShoulder = new Geo(), gDrain = new Geo(), gKerb = new Geo(), gWalk = new Geo(), gMark = new Geo(), gYellow = new Geo();
  const merge = (dst, src) => { const base = dst.p.length / 3; dst.p.push(...src.p); dst.n.push(...src.n); dst.uv.push(...src.uv); src.i.forEach((k) => dst.i.push(k + base)); };
  for (const r of roads) {
    merge(gAsphalt, stripGeo(r, r.w / 2, -r.w / 2, 0.02, null, 0.11));
    if (r.sidewalk) {
      const skipWalk = (x, z) => nearOther(r, x, z, 0.4) || !inTown(x, z);
      for (const side of [1, -1]) {
        const o0 = r.w / 2 + 0.25, o1 = r.w / 2 + 2.45;
        merge(gWalk, side > 0 ? stripGeo(r, o1, o0, 0.17, skipWalk, 0.2) : stripGeo(r, -o0, -o1, 0.17, skipWalk, 0.2));
        merge(gKerb, wallGeo(r, side * o0, 0.02, 0.17, side < 0, skipWalk)); // faces the road
        merge(gKerb, wallGeo(r, side * o1, 0.0, 0.17, side > 0, skipWalk));
      }
    }
    const skipDrain = (x, z) => nearOther(r, x, z, 0.6) || (r.sidewalk && inTown(x, z));
    for (const side of [1, -1]) {
      const a = r.w / 2 + 0.05, c = r.w / 2 + 0.75, e = r.w / 2 + 2.2;
      merge(gShoulder, side > 0 ? stripGeo(r, e, a, 0.012, (x, z) => nearOther(r, x, z, 0.2), 0.2) : stripGeo(r, -a, -e, 0.012, (x, z) => nearOther(r, x, z, 0.2), 0.2));
      merge(gDrain, side > 0 ? stripGeo(r, c, a, 0.03, skipDrain, 0.4) : stripGeo(r, -a, -c, 0.03, skipDrain, 0.4));
    }
    const skipMark = (x, z) => nearOther(r, x, z, 1.4);
    for (const side of [1, -1]) merge(gMark, side > 0 ? stripGeo(r, r.w / 2 - 0.2, r.w / 2 - 0.36, 0.035, skipMark, 0.5) : stripGeo(r, -(r.w / 2 - 0.36), -(r.w / 2 - 0.2), 0.035, skipMark, 0.5));
    if (r.center) merge(r.w >= 7 ? gMark : gYellow, dashGeo(r, 0, 0.16, 3.2, 4.8, 0.036, skipMark));
  }
  // zebra crossings on the main road in each town
  const mainRoad = byId[OSM.mainId];
  for (const t of OSM.towns) {
    const P = pointAt(mainRoad, nearestS(mainRoad, t.x, t.z)), yaw = Math.atan2(P.fx, P.fz);
    for (let i = -3; i <= 3; i++) {
      const g = new Geo(), c = Math.cos(yaw), sn = Math.sin(yaw), lat = i * 1.25, hx = 0.55, hz = 1.6, ox = P.x + P.fz * lat, oz = P.z - P.fx * lat;
      const ids = [[-hx, -hz], [-hx, hz], [hx, hz], [hx, -hz]].map(([u, v]) => g.v(ox + u * c + v * sn, 0.036, oz - u * sn + v * c, 0, 1, 0, 0, 0));
      g.q(ids[0], ids[1], ids[2], ids[3]); merge(gMark, g);
    }
  }
  roadBuilder.geo('asphalt', 0xffffff, gAsphalt, 0, 0, 0);
  roadBuilder.geo('soil', 0xffffff, gShoulder, 0, 0, 0);
  roadBuilder.geo('drain', 0xffffff, gDrain, 0, 0, 0);
  roadBuilder.geo('kerb', 0xffffff, gKerb, 0, 0, 0);
  roadBuilder.geo('walk', 0xffffff, gWalk, 0, 0, 0);
  roadBuilder.geo('mark', 0xffffff, gMark, 0, 0, 0);
  roadBuilder.geo('markYellow', 0xffffff, gYellow, 0, 0, 0);

  // speed breakers (visual hump; the game adds a little bounce)
  const breakers = [];
  const breakerSpots = []; for (const t of OSM.towns) { const s0 = nearestS(mainRoad, t.x, t.z); breakerSpots.push([OSM.mainId, s0 - 26], [OSM.mainId, s0 + 26]); }
  for (const [id, s] of breakerSpots) {
    const r = byId[id], P = pointAt(r, s);
    if (nearOther(r, P.x, P.z, 3)) continue;
    const yaw = Math.atan2(P.fx, P.fz);
    sb.box('paint', 0xf2c230, P.x, 0.05, P.z, r.w - 0.2, 0.1, 2.4, yaw);
    for (let k = -3; k <= 3; k += 2) { const lx = (k * (r.w - 0.4)) / 7; sb.box('paint', 0x1b1b1b, P.x + Math.cos(yaw) * lx, 0.055, P.z - Math.sin(yaw) * lx, (r.w - 0.4) / 7, 0.105, 2.42, yaw); }
    breakers.push({ x: P.x, z: P.z, a: yaw, hw: r.w / 2, hd: 1.2 });
  }

  // ---- fixed landmarks first so frontage placement avoids them -------------------------------
  yield 'Building the police station and bus stops…';
  const lotOf = (o) => { prep(o); ctx.lots.push(o); return o; };
  // Civic anchors are placed beside the real road nearest to their OpenStreetMap coordinates.
  const polPoi = poi(/Police Station,\s*Chithara/i, 'police') || poi(/Police/i, 'police') || OSM.towns[2];
  const polSpot = spotBeside(polPoi.x, polPoi.z, 11);
  policeStation(sb, ctx, polSpot.x, polSpot.z, polSpot.yaw, rng);
  lotOf({ x: polSpot.x, z: polSpot.z, hw: 12, hd: 12, a: 0, hard: true });
  const busStops = [];
  for (const q of [poi(/^Kadakkal$/i, 'busstop'), poi(/Madathara/i, 'busstop'), OSM.towns[0], OSM.towns[2]].filter(Boolean)) {
    const sp = spotBeside(q.x, q.z, 3.6);
    busStop(sb, ctx, sp.x, sp.z, sp.yaw, rng); busStops.push({ x: sp.x, z: sp.z });
    lotOf({ x: sp.x, z: sp.z, hw: 3.4, hd: 2.2, a: sp.yaw, hard: true });
    signPost(sb, ctx, sp.x + Math.cos(sp.yaw) * 3.6, sp.z - Math.sin(sp.yaw) * 3.6, sp.yaw, 'busstop', 1.4);
  }
  const sign = (x, z, id, h, gap = 3.4) => { const sp = spotBeside(x, z, gap); signPost(sb, ctx, sp.x, sp.z, sp.yaw, id, h); lotOf({ x: sp.x, z: sp.z, hw: 1.6, hd: 1.6, a: 0, hard: true }); };
  const mp0 = mainRoad.pts[1], mp1 = mainRoad.pts[mainRoad.pts.length - 2];
  sign(mp0[0], mp0[1], 'welcome', 3.2); sign(mp1[0], mp1[1], 'kollam', 2.4);
  sign(OSM.towns[1].x + 8, OSM.towns[1].z, 'market', 2.4); sign(OSM.towns[2].x - 10, OSM.towns[2].z, 'speed30', 1.0);
  sign(OSM.towns[3].x - 8, OSM.towns[3].z, 'hotel', 2.4); sign(OSM.towns[0].x + 14, OSM.towns[0].z, 'slow', 1.0);
  // Lightweight landmark silhouettes: Kadakkal town hall and the Bhadrakali temple roof.
  const hall = poi(/Town Hall/i, 'townhall') || OSM.towns[1], hs = spotBeside(hall.x, hall.z, 9);
  sb.box('paint', 0xe2d4b8, hs.x, 1.8, hs.z, 14, 3.6, 8, hs.yaw); sb.box('paint', 0x9d3028, hs.x, 3.9, hs.z, 14.4, 0.55, 8.4, hs.yaw);
  lotOf({ x: hs.x, z: hs.z, hw: 9, hd: 6, a: hs.yaw, hard: true });
  const tmp = poi(/Bhadhrakali/i, 'temple') || poi(/Temple/i, 'temple') || OSM.towns[1], ts = spotBeside(tmp.x, tmp.z, 12);
  sb.box('paint', 0xd9c5a1, ts.x, 2.0, ts.z, 10, 4.0, 9, ts.yaw); sb.hip('roof', 0x8d3027, ts.x, 4.5, ts.z, 11, 10, 2.0, 2.0, ts.yaw);
  sign(tmp.x, tmp.z, 'temple', 2.4, 5);
  lotOf({ x: ts.x, z: ts.z, hw: 7, hd: 6, a: ts.yaw, hard: true });

  // ---- generic placement checks ---------------------------------------------------------------
  const blockedByBuilding = (x, z, r) => {
    for (const f of ctx.footprints) { if (circleObb(x, z, r, f)) return true; }
    for (const l of ctx.lots) { if (l.hard && circleObb(x, z, r, l)) return true; }
    return false;
  };
  const freeSpot = (x, z, r, roadClear) => Math.abs(x) < 236 && Math.abs(z) < 236 && clearance(x, z) >= roadClear && !blockedByBuilding(x, z, r);
  const lotFree = (o) => {
    prep(o);
    for (const [x, z] of obbCorners(o)) { if (clearance(x, z) < 0.9 || Math.abs(x) > 190 || Math.abs(z) > 190) return false; } // corridor roads sit close together, so keep only a thin verge
    for (const l of ctx.lots) if (obbOverlap(o, l, 0.4)) return false;
    for (const f of ctx.footprints) if (obbOverlap(o, f, 0.2)) return false;
    return true;
  };

  // ---- frontage: shops/houses along every road ------------------------------------------------
  yield 'Placing houses, shops and tea stalls…';
  const zoneAt = (x, z) => { const d = townDist(x, z); return d < 28 ? 'core' : d < 56 ? 'mixed' : 'res'; };
  const pickType = (zone) => {
    const u = rng();
    if (zone === 'core') return u < 0.5 ? 'shop' : u < 0.62 ? 'tea' : u < 0.74 ? 'grocery' : u < 0.84 ? 'hotel' : 'commercial';
    if (zone === 'mixed') return u < 0.28 ? 'shop' : u < 0.35 ? 'tea' : u < 0.43 ? 'commercial' : u < 0.62 ? 'kerala' : u < 0.82 ? 'modern' : 'twoStorey';
    return u < 0.42 ? 'kerala' : u < 0.74 ? 'modern' : 'twoStorey';
  };
  const RES = new Set(['kerala', 'modern', 'twoStorey']);
  let placed = 0;
  const treesToAdd = [];
  for (const r of roads) {
    for (const side of [1, -1]) {
      let s = rng.range(3, 9);
      const end = r.closed ? r.len - 4 : r.len - 3;
      while (s < end) {
        const mid = pointAt(r, s + 6), zone = zoneAt(mid.x, mid.z);
        if (rng() > r.density && !(zone === 'core')) { s += rng.range(14, 26); continue; }
        const type = pickType(zone), plan = planBuilding(type, rng), res = RES.has(type);
        const walkway = r.sidewalk && inTown(mid.x, mid.z);
        const edge = r.w / 2 + (walkway ? 2.45 : 1.1);
        const frontDist = res ? edge + rng.range(3, 5.5) : edge + 0.7; // shallower lots: the corridor is compressed, so parallel roads sit close together
        const lotW = plan.fw + (res ? rng.range(4, 9) : rng.range(0, 0.6));
        const C = pointAt(r, s + lotW / 2);
        const nx = C.fz * side, nz = -C.fx * side; // outward from the road on this side
        const depthToCenter = frontDist + plan.fe + plan.d / 2;
        const ox = C.x + nx * depthToCenter, oz = C.z + nz * depthToCenter, ry = Math.atan2(-nx, -nz);
        const lotDepth = res ? depthToCenter + plan.d / 2 + 1.5 - (edge + 1.0) : plan.fe + plan.d;
        const lotC = res ? edge + 1.0 + lotDepth / 2 : frontDist + lotDepth / 2 - 0.0;
        const lot = { x: C.x + nx * lotC, z: C.z + nz * lotC, hw: lotW / 2, hd: lotDepth / 2, a: ry };
        if (!lotFree(lot)) { if (globalThis.__dbg) { const k = res ? 'res' : 'com'; globalThis.__dbg[k] = (globalThis.__dbg[k] || 0) + 1; } s += res ? 4 : 2.5; continue; }
        buildBuilding(plan, sb, ctx, ox, oz, ry, rng);
        ctx.lots.push(lot); placed++;
        if (res) {
          // compound wall along the road with a gate in front of the door, plus garden plants
          const wallOff = edge + 1.0, p0 = pointAt(r, s), p1 = pointAt(r, s + lotW);
          compoundWall(sb, ctx, p0.x + p0.fz * side * wallOff, p0.z - p0.fx * side * wallOff, p1.x + p1.fz * side * wallOff, p1.z - p1.fx * side * wallOff, rng, Math.hypot(p1.x - p0.x, p1.z - p0.z) / 2);
          const back = depthToCenter + plan.d / 2 + 1.5;
          for (let k = 0; k < rng.int(2, 4); k++) {
            const lat = rng.range(-lotW / 2 + 1.5, lotW / 2 - 1.5), dep = rng.range(back - 3, back + 5);
            treesToAdd.push([C.x + nx * dep + C.fx * lat, C.z + nz * dep + C.fz * lat, rng.pick(['palm', 'palm', 'tree', 'banana', 'bush'])]);
          }
          if (rng.chance(0.4)) { const px = C.x + nx * (edge + 2.2) + C.fx * (lotW * 0.3), pz = C.z + nz * (edge + 2.2) + C.fz * (lotW * 0.3); motorbike(sb, ctx, px, pz, ry + rng.range(-0.3, 0.3), rng, rng.chance(0.4)); }
        } else if (rng.chance(0.18)) {
          const px = C.x + nx * (edge + 1.0) + C.fx * (plan.fw / 2 + 1.2), pz = C.z + nz * (edge + 1.0) + C.fz * (plan.fw / 2 + 1.2);
          motorbike(sb, ctx, px, pz, Math.atan2(C.fx, C.fz) + Math.PI / 2 * (side > 0 ? 1 : -1), rng, rng.chance(0.5));
        }
        s += lotW;
      }
    }
  }

  // ---- vegetation -----------------------------------------------------------------------------
  yield 'Planting coconut palms and banana plants…';
  const dummy = { circles: [], obbs: [] };
  const plant = (kind, x, z, useCtx = ctx) => {
    if (kind === 'palm') palm(sb, useCtx, x, z, rng); else if (kind === 'tree') broadleaf(sb, useCtx, x, z, rng);
    else if (kind === 'banana') banana(sb, useCtx, x, z, rng); else bush(sb, useCtx, x, z, rng, kind === 'flower');
  };
  for (const [x, z, k] of treesToAdd) if (freeSpot(x, z, 1.0, 3.0)) plant(k, x, z);
  for (const r of roads) for (const side of [1, -1]) {
    let s = rng.range(2, 20);
    while (s < r.len) {
      const P = pointAt(r, s), off = r.w / 2 + (r.sidewalk && inTown(P.x, P.z) ? 3.4 : 2.7) + rng.range(0, 1.6);
      const x = P.x + P.fz * side * off, z = P.z - P.fx * side * off;
      if (freeSpot(x, z, 1.2, 2.3)) plant(rng.pick(['palm', 'palm', 'palm', 'tree', 'banana', 'flower', 'bush']), x, z);
      s += rng.range(9, 26);
    }
  }
  let scattered = 0;
  for (let t = 0; t < 2600 && scattered < 330; t++) {
    const x = rng.range(-232, 232), z = rng.range(-232, 232);
    if (!freeSpot(x, z, 1.5, 6)) continue;
    plant(rng.pick(['palm', 'palm', 'palm', 'palm', 'tree', 'tree', 'banana', 'banana', 'bush', 'flower']), x, z, Math.abs(x) > 205 || Math.abs(z) > 205 ? dummy : ctx);
    scattered++;
  }
  let infill = 0; // gardens and groves inside the blocks, away from the roads
  for (let t = 0; t < 4000 && infill < 320; t++) {
    const x = rng.range(-170, 170), z = rng.range(-120, 120);
    if (!freeSpot(x, z, 1.6, 5.5)) continue;
    plant(rng.pick(['palm', 'palm', 'palm', 'tree', 'tree', 'banana', 'banana', 'bush', 'flower']), x, z);
    infill++;
  }
  for (let i = 0; i < 150; i++) { // dense outer groves hide the map edge
    const edgeSide = rng.int(0, 3), t = rng.range(-260, 260), d = rng.range(206, 262);
    const x = edgeSide < 2 ? (edgeSide ? d : -d) : t, z = edgeSide < 2 ? t : (edgeSide === 2 ? d : -d);
    if (z > 210 && z < 236 && Math.abs(x) < 300) continue; // canal
    plant(rng.pick(['palm', 'palm', 'palm', 'tree']), x, z, dummy);
  }

  // ---- street lights, utility poles and cables ------------------------------------------------
  yield 'Adding street lights, signboards and cables…';
  for (const r of roads) {
    if (r.lights) for (const side of [1, -1]) {
      for (let s = side > 0 ? 18 : 38; s < r.len - 8; s += 40) {
        const P = pointAt(r, s), walkway = r.sidewalk && inTown(P.x, P.z), off = r.w / 2 + (walkway ? 0.7 : 1.5);
        const x = P.x + P.fz * side * off, z = P.z - P.fx * side * off;
        if (nearOther(r, x, z, 3.5) || blockedByBuilding(x, z, 0.4)) continue;
        streetLight(sb, ctx, x, z, -P.fz * side, P.fx * side);
      }
    }
    if (r.poles) {
      const side = r.poles || -1, tops = [];
      for (let s = 10; s < r.len - 6; s += 30) {
        const P = pointAt(r, s), off = r.w / 2 + 3.6, x = P.x + P.fz * side * off, z = P.z - P.fx * side * off;
        if (nearOther(r, x, z, 4) || blockedByBuilding(x, z, 0.6) || clearance(x, z, r) < 3) continue;
        utilityPole(sb, ctx, x, z, Math.atan2(P.fz, -P.fx) + Math.PI / 2 * 0, tops);
      }
      stringCables(ctx, tops);
    }
  }
  // paddy fields, canal and tea-shop style details outside the busy core
  const paddies = [];
  for (let t = 0; t < 1500 && paddies.length < 8; t++) {
    const x = rng.range(-190, 190), z = rng.range(-190, 190), hw = rng.range(9, 15), hd = rng.range(6, 9), a = rng.pick([0, Math.PI / 2]);
    const o = { x, z, hw: a ? hd : hw, hd: a ? hw : hd, a: 0 };
    if (!lotFree(o) || ![...obbCorners(o)].every(([px, pz]) => clearance(px, pz) > 5 && !blockedByBuilding(px, pz, 2))) continue;
    ctx.lots.push(prep({ ...o, hard: false })); paddies.push(o);
    sb.flat('paddy', 0x8cc43f, o.x - o.hw, o.z - o.hd, o.x + o.hw, o.z + o.hd, 0.035);
    sb.flat('paint', 0x8a6a3c, o.x - o.hw - 0.35, o.z - o.hd - 0.35, o.x + o.hw + 0.35, o.z - o.hd, 0.03);
    sb.flat('paint', 0x8a6a3c, o.x - o.hw - 0.35, o.z + o.hd, o.x + o.hw + 0.35, o.z + o.hd + 0.35, 0.03);
    sb.flat('paint', 0x8a6a3c, o.x - o.hw - 0.35, o.z - o.hd, o.x - o.hw, o.z + o.hd, 0.03);
    sb.flat('paint', 0x8a6a3c, o.x + o.hw, o.z - o.hd, o.x + o.hw + 0.35, o.z + o.hd, 0.03);
  }
  sb.flat('water', 0xffffff, -330, 214, 330, 232, 0.02);

  // ---- traffic loops (left-hand traffic: lane is offset to the left of travel) --------------------
  yield 'Setting up bus routes…';
  // Traffic paths are derived from the actual visible outer road, not shortcut loops through scenery.
  const routes = ['ring', 'inner', 'cross'].map((k) => makeRoute(k, laneLoop(OSM.routes[k], 1.9), true, 0, k));
  const mpos = (re, type, label) => { const q = poi(re, type); if (!q) return null; const sp = spotBeside(q.x, q.z, -1.6); return { at: [sp.x, sp.z], label }; };
  const pairs = [
    [/Community Health Centre Nilamel/i, 'hospital', 'Nilamel Health Centre', /^Kadakkal$/i, 'busstop', 'Kadakkal Bus Station'],
    [/Bhadhrakali/i, 'temple', 'Bhadrakali Temple', /APRM Central School/i, 'school', 'APRM School Chithara'],
    [/^Kadakkal$/i, 'busstop', 'Kadakkal Bus Station', /Police Station,\s*Chithara/i, 'police', 'Chithara Police Station'],
    [/Panchayath Office, Chithara/i, '', 'Chithara Panchayat Office', /Madathara Bus Stand/i, 'busstop', 'Madathara Bus Stand'],
    [/Madathara Public Market/i, 'market', 'Madathara Market', /NSS College/i, 'school', 'Nilamel NSS College'],
    [/Taluk Hospital Kadakkal/i, 'hospital', 'Kadakkal Taluk Hospital', /Primary Health centre , Madathara/i, 'hospital', 'Madathara Health Centre']
  ];
  let missions = pairs.map(([r1, t1, l1, r2, t2, l2]) => { const a = mpos(r1, t1, l1), b = mpos(r2, t2, l2); return a && b ? { from: a.at, to: b.at, name: a.label, destination: b.label } : null; }).filter(Boolean);
  if (missions.length < 3) missions = [{ from: [mainRoad.pts[8][0], mainRoad.pts[8][1]], to: [mainRoad.pts[60][0], mainRoad.pts[60][1]], name: 'Nilamel', destination: 'Madathara' }];
  const kS = nearestS(mainRoad, OSM.towns[1].x, OSM.towns[1].z), kP = pointAt(mainRoad, kS), dir = kP.fx >= 0 ? 1 : -1;
  const spawn = { x: kP.x + kP.fz * dir * 1.9 - kP.fx * dir * 14, z: kP.z - kP.fx * dir * 1.9 - kP.fz * dir * 14, heading: Math.atan2(kP.fx * dir, kP.fz * dir) };

  yield 'Finishing touches…';
  return {
    seed, roads, byId, routes, missions, breakers, busStops, policeAt: { x: polSpot.x, z: polSpot.z }, attribution: OSM.attribution,
    obbs: ctx.obbs.map(prep), circles: ctx.circles, minimapRects: ctx.minimap,
    spawn,
    cables: new Float32Array(ctx.cables),
    buffers: sb.toBuffers(), roadBuffers: roadBuilder.toBuffers(),
    stats: { buildings: placed, triangles: sb.triangles + roadBuilder.triangles, obbs: ctx.obbs.length, circles: ctx.circles.length },
    roadClearance: (x, z) => clearance(x, z),
    pointAt, distToRoad
  };
}
