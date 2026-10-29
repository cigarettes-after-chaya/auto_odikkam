// Kerala town generator (pure JS, seeded). Produces road/building geometry buffers plus all the
// data the game needs: colliders, traffic routes, missions, minimap data and a road-clearance query.
// World coordinates: x east, z south, y up. Vehicles drive on the LEFT, as in India.
import { makeRng } from './rng.js';
import { Builder, Geo } from './geom.js';
import { circleObb, obbOverlap, obbCorners, prep } from './collide.js';
import { signUV } from './signs.js';
import { palm, broadleaf, banana, bush, streetLight, utilityPole, signPost, stringCables, compoundWall, motorbike, vendorStall, PAL } from './props.js';
import { planBuilding, buildBuilding, busStop, policeStation } from './buildings.js';

export const WORLD = { limit: 220, ring: 170 };

// Kadakkal-centred playable district. Known POI coordinates and local road names are based on
// public OpenStreetMap/place references; centre-lines are hand-aligned low-poly approximations,
// not a direct import of surveyed OSM way geometry. Local coordinates use the town centre as origin.

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

// ---- world generator (generator function so the UI can show progress) ---------------------------
export function* generateWorld(seed = 20241) {
  const rng = makeRng(seed);
  const roadBuilder = new Builder(0), sb = new Builder(100);
  const ctx = { obbs: [], circles: [], footprints: [], lots: [], cables: [], minimap: [], rng };

  yield 'Laying out Kerala roads…';
  // Curving, connected local road network inspired by Kadakkal's real street pattern.
  // Main east-west spine represents the Varkala–Madathara Road through the market junction;
  // branches represent the Chengamanadu/Kadakkal and Attupuram/Missionkunnu directions.
  const defs = [
    { id: 'ring', name: 'Kadakkal Outer Link', w: 7.5, pts: [[-158,-92],[-122,-116],[-76,-128],[-26,-132],[28,-126],[76,-108],[116,-78],[139,-36],[145,12],[129,58],[99,91],[55,116],[5,128],[-45,123],[-91,106],[-127,75],[-148,34],[-158,-12],[-158,-92]], closed: true, sidewalk: false, lights: false, center: false, density: 0.35 },
    { id: 'A', name: 'Varkala–Madathara Road', w: 10, pts: [[-175,18],[-142,12],[-111,8],[-78,5],[-48,2],[-20,0],[0,0],[28,-3],[56,-7],[82,-10],[111,-14],[143,-20],[174,-28]], sidewalk: true, lights: true, center: true, density: 1 },
    { id: 'B', name: 'Chengamanadu Road', w: 8, pts: [[-8,158],[-10,129],[-8,104],[-3,78],[3,54],[7,31],[5,13],[0,0],[-6,-22],[-10,-47],[-12,-75],[-7,-104],[2,-132], [10,-160]], sidewalk: true, lights: true, center: true, density: 0.8 },
    { id: 'G', name: 'Kadakkal Market Road', w: 7, pts: [[-112,-68],[-88,-54],[-64,-39],[-42,-25],[-20,-11],[0,0],[18,12],[37,27],[57,43],[76,61],[96,78]], sidewalk: true, lights: true, center: true, density: 0.9 },
    { id: 'H', name: 'Attupuram–Missionkunnu Road', w: 7, pts: [[-146,86],[-117,72],[-91,57],[-65,43],[-39,28],[-18,13],[0,0],[22,-16],[44,-31],[69,-45],[95,-59],[123,-73]], sidewalk: false, lights: true, center: true, density: 0.8 },
    { id: 'E', name: 'Temple Approach Road', w: 5.5, pts: [[28,-185],[34,-150],[39,-91],[43,-67],[46,-45],[48,-23],[45,-5],[38,14],[34,35],[37,58],[45,81],[54,105],[66,130],[80,151]], sidewalk: false, lights: false, center: false, density: 0.7, poles: 1 },
    { id: 'F', name: 'Kilimarthukavu Lane', w: 5.5, pts: [[108,-142],[100,-132],[86,-120],[72,-98],[62,-77],[57,-56],[61,-37],[72,-18],[86,0],[99,20],[108,41],[110,63],[104,85]], sidewalk: false, lights: false, center: false, density: 0.65, poles: -1 },
    { id: 'D1', name: 'Residential Lane West', w: 4.5, pts: [[-136,-25],[-117,-18],[-99,-11],[-82,-3],[-67,8],[-58,23],[-55,42],[-60,61],[-71,79]], sidewalk: false, lights: false, center: false, density: 0.65 },
    { id: 'D2', name: 'Rubber Estate Lane', w: 4.5, pts: [[-90,128],[-71,108],[-56,91],[-42,74],[-31,57],[-25,40],[-25,24],[-31,10]], sidewalk: false, lights: false, center: false, density: 0.6 },
    { id: 'J', name: 'Bus Stand Access Road', w: 5, pts: [[-2,48],[3,53],[9,58],[18,64],[27,69]], sidewalk: false, lights: false, center: false, density: 0.25 },
    { id: 'K', name: 'Town Hall Access Road', w: 4.5, pts: [[75,-10],[81,-16],[87,-23],[92,-31]], sidewalk: false, lights: false, center: false, density: 0.25 }
  ];
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
  const inTown = (x, z) => Math.max(Math.abs(x), Math.abs(z)) <= 122;

  // ---- asphalt, kerbs, drains, markings -------------------------------------------------------
  yield 'Paving roads and junctions…';
  const gAsphalt = new Geo(), gShoulder = new Geo(), gDrain = new Geo(), gKerb = new Geo(), gWalk = new Geo(), gMark = new Geo(), gYellow = new Geo();
  const merge = (dst, src) => { const base = dst.p.length / 3; dst.p.push(...src.p); dst.n.push(...src.n); dst.uv.push(...src.uv); src.i.forEach((k) => dst.i.push(k + base)); };
  for (const r of roads) {
    merge(gAsphalt, stripGeo(r, r.w / 2, -r.w / 2, 0.02, null, 0.11));
    if (r.sidewalk) {
      const skipWalk = (x, z) => nearOther(r, x, z, 0.4) || !(r.id === 'A' || r.id === 'B' ? inTown(x, z) : Math.abs(x) < 62);
      for (const side of [1, -1]) {
        const o0 = r.w / 2 + 0.25, o1 = r.w / 2 + 2.45;
        merge(gWalk, side > 0 ? stripGeo(r, o1, o0, 0.17, skipWalk, 0.2) : stripGeo(r, -o0, -o1, 0.17, skipWalk, 0.2));
        merge(gKerb, wallGeo(r, side * o0, 0.02, 0.17, side < 0, skipWalk)); // faces the road
        merge(gKerb, wallGeo(r, side * o1, 0.0, 0.17, side > 0, skipWalk));
      }
    }
    const skipDrain = (x, z) => nearOther(r, x, z, 0.6) || (r.sidewalk && (r.id === 'A' || r.id === 'B' ? inTown(x, z) : Math.abs(x) < 62));
    for (const side of [1, -1]) {
      const a = r.w / 2 + 0.05, c = r.w / 2 + 0.75, e = r.w / 2 + 2.2;
      merge(gShoulder, side > 0 ? stripGeo(r, e, a, 0.012, (x, z) => nearOther(r, x, z, 0.2), 0.2) : stripGeo(r, -a, -e, 0.012, (x, z) => nearOther(r, x, z, 0.2), 0.2));
      merge(gDrain, side > 0 ? stripGeo(r, c, a, 0.03, skipDrain, 0.4) : stripGeo(r, -a, -c, 0.03, skipDrain, 0.4));
    }
    const skipMark = (x, z) => nearOther(r, x, z, 1.4);
    for (const side of [1, -1]) merge(gMark, side > 0 ? stripGeo(r, r.w / 2 - 0.2, r.w / 2 - 0.36, 0.035, skipMark, 0.5) : stripGeo(r, -(r.w / 2 - 0.36), -(r.w / 2 - 0.2), 0.035, skipMark, 0.5));
    if (r.center) merge(r.w >= 7 ? gMark : gYellow, dashGeo(r, 0, 0.16, 3.2, 4.8, 0.036, skipMark));
  }
  // zebra crossings around the central junction
  for (const [cx, cz, alongX] of [[10.2, 0, true], [-10.2, 0, true], [0, 10.2, false], [0, -10.2, false]]) {
    for (let i = -4; i <= 4; i++) {
      const g = new Geo(), x0 = alongX ? cx - 1.5 : cz * 0 + i * 1.2 - 0.3, hx = alongX ? 3 : 0.6, hz = alongX ? 0.6 : 3;
      const px = alongX ? cx : i * 1.2, pz = alongX ? i * 1.2 : cz;
      const ids = [[px - hx / 2, pz - hz / 2], [px - hx / 2, pz + hz / 2], [px + hx / 2, pz + hz / 2], [px + hx / 2, pz - hz / 2]].map(([x, z]) => g.v(x, 0.036, z, 0, 1, 0, 0, 0));
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
  for (const [id, s] of [['E', 40], ['E', 255], ['F', 40], ['F', 255], ['D1', 28], ['H', 30], ['ring', 260], ['ring', 860]]) {
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
  // Recognizable Kadakkal anchors. Positions are approximate game-space placements; the
  // central market junction is the origin and the bus stand sits just off the main road.
  const police = policeStation(sb, ctx, 38, 38, 0, rng);
  lotOf({ x: 38, z: 54, hw: 12, hd: 12, a: 0, hard: true });
  const stopSpots = [[18, 64, Math.PI / 2], [-54, 30, 0], [55, -8, Math.PI]];
  const busStops = [];
  for (const [x, z, ry] of stopSpots) {
    busStop(sb, ctx, x, z, ry, rng); busStops.push({ x, z });
    lotOf({ x, z, hw: 3.4, hd: 2.2, a: ry, hard: true });
    signPost(sb, ctx, x + Math.cos(ry) * 3.6, z - Math.sin(ry) * 3.6, ry, 'busstop', 1.4);
  }
  const signSpots = [
    [-8, 18, 'market', Math.PI], [92, -31, 'temple', 0], [108, -142, 'temple', Math.PI / 2],
    [-152, 14, 'welcome', 0], [150, -20, 'kollam', Math.PI], [42, -89, 'slow', Math.PI],
    [-72, 44, 'speed30', Math.PI / 2], [92, 72, 'hotel', -Math.PI / 2]
  ];
  for (const [x, z, id, yaw] of signSpots) {
    signPost(sb, ctx, x, z, yaw, id, id === 'speed30' || id === 'slow' ? 1.0 : id === 'welcome' ? 3.2 : 2.4);
    lotOf({ x, z, hw: 1.6, hd: 1.6, a: 0, hard: true });
  }
  // Lightweight landmark silhouettes: town-hall frontage, memorial plinth, and a Kerala temple roof.
  // They are deliberately simple meshes to keep mobile rendering smooth.
  sb.box('paint', 0xe2d4b8, 104, 1.8, -37, 14, 3.6, 8, -0.12);
  sb.box('paint', 0x9d3028, 104, 3.9, -37, 14.4, 0.55, 8.4, -0.12);
  sb.box('paint', 0x77736c, -13, 0.6, 9, 3.6, 1.2, 2.4, 0.1);
  sb.box('paint', 0xc5b89b, -13, 1.5, 9, 2.4, 0.8, 1.2, 0.1);
  sb.box('paint', 0xd9c5a1, 108, 2.0, -142, 10, 4.0, 9);
  sb.hip('roof', 0x8d3027, 108, 4.5, -142, 11, 10, 2.0, 2.0);
  lotOf({ x: 104, z: -37, hw: 9, hd: 6, a: -0.12, hard: true });
  lotOf({ x: -13, z: 9, hw: 3, hd: 2, a: 0.1, hard: true });
  lotOf({ x: 108, z: -142, hw: 7, hd: 6, a: 0, hard: true });

  // ---- generic placement checks ---------------------------------------------------------------
  const blockedByBuilding = (x, z, r) => {
    for (const f of ctx.footprints) { if (circleObb(x, z, r, f)) return true; }
    for (const l of ctx.lots) { if (l.hard && circleObb(x, z, r, l)) return true; }
    return false;
  };
  const freeSpot = (x, z, r, roadClear) => Math.abs(x) < 236 && Math.abs(z) < 236 && clearance(x, z) >= roadClear && !blockedByBuilding(x, z, r);
  const lotFree = (o) => {
    prep(o);
    for (const [x, z] of obbCorners(o)) { if (clearance(x, z) < 1.6 || Math.abs(x) > 190 || Math.abs(z) > 190) return false; }
    for (const l of ctx.lots) if (obbOverlap(o, l, 0.4)) return false;
    for (const f of ctx.footprints) if (obbOverlap(o, f, 0.2)) return false;
    return true;
  };

  // ---- frontage: shops/houses along every road ------------------------------------------------
  yield 'Placing houses, shops and tea stalls…';
  const zoneAt = (x, z) => {
    const ax = Math.abs(x), az = Math.abs(z);
    if ((az < 22 && ax < 122) || (ax < 22 && az < 122)) return 'core';
    if ((Math.abs(az - 75) < 18 && ax < 58) || (az < 120 && Math.abs(ax - 78) < 12 && az < 40)) return 'mixed';
    return 'res';
  };
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
        const walkway = r.sidewalk && (r.id === 'A' || r.id === 'B' ? inTown(mid.x, mid.z) : Math.abs(mid.x) < 62);
        const edge = r.w / 2 + (walkway ? 2.45 : 1.1);
        const frontDist = res ? edge + rng.range(6, 9.5) : edge + 0.7;
        const lotW = plan.fw + (res ? rng.range(4, 9) : rng.range(0, 0.6));
        const C = pointAt(r, s + lotW / 2);
        const nx = C.fz * side, nz = -C.fx * side; // outward from the road on this side
        const depthToCenter = frontDist + plan.fe + plan.d / 2;
        const ox = C.x + nx * depthToCenter, oz = C.z + nz * depthToCenter, ry = Math.atan2(-nx, -nz);
        const lotDepth = res ? depthToCenter + plan.d / 2 + 4 - (edge + 1.0) : plan.fe + plan.d;
        const lotC = res ? edge + 1.0 + lotDepth / 2 : frontDist + lotDepth / 2 - 0.0;
        const lot = { x: C.x + nx * lotC, z: C.z + nz * lotC, hw: lotW / 2, hd: lotDepth / 2, a: ry };
        if (!lotFree(lot)) { if (globalThis.__dbg) { const k = res ? 'res' : 'com'; globalThis.__dbg[k] = (globalThis.__dbg[k] || 0) + 1; } s += res ? 4 : 2.5; continue; }
        buildBuilding(plan, sb, ctx, ox, oz, ry, rng);
        ctx.lots.push(lot); placed++;
        if (res) {
          // compound wall along the road with a gate in front of the door, plus garden plants
          const wallOff = edge + 1.0, p0 = pointAt(r, s), p1 = pointAt(r, s + lotW);
          compoundWall(sb, ctx, p0.x + p0.fz * side * wallOff, p0.z - p0.fx * side * wallOff, p1.x + p1.fz * side * wallOff, p1.z - p1.fx * side * wallOff, rng, Math.hypot(p1.x - p0.x, p1.z - p0.z) / 2);
          const back = depthToCenter + plan.d / 2 + 2.5;
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
    const x = rng.range(-146, 146), z = rng.range(-146, 146);
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
    if (r.poles || r.id === 'ring') {
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
  const L2 = roundedLoop([[-62, -38], [42, -60], [91, -10], [65, 48], [-18, 58], [-72, 12]], 7);
  const L4 = roundedLoop([[-145, 18], [-65, 5], [0, 0], [74, -9], [132, -18], [96, 70], [12, 100], [-72, 62]], 7);
  const routes = [
    makeRoute('ring', byId.ring.pts, true, 1.8, 'ring'),
    makeRoute('inner', L2, true, 1.6, 'inner'),
    makeRoute('cross', L4, true, 1.7, 'cross')
  ];

  const missions = [
    { from: [-17, 7], to: [108, -142], name: 'Kadakkal Market Junction', destination: 'Kadakkal Devi Temple' },
    { from: [42, 1], to: [104, -37], name: 'Varkala–Madathara Road', destination: 'Kadakkal Town Hall' },
    { from: [-54, 32], to: [18, 64], name: 'Residential Lane', destination: 'Kadakkal Bus Stand' },
    { from: [19, -9], to: [38, 38], name: 'Market Junction', destination: 'Kadakkal Police Station' },
    { from: [72, 45], to: [108, -142], name: 'Temple Approach Road', destination: 'Kadakkal Devi Temple' },
    { from: [-112, 12], to: [92, 72], name: 'West Kadakkal Road', destination: 'Local Tea Shop' }
  ];

  yield 'Finishing touches…';
  return {
    seed, roads, byId, routes, missions, breakers, busStops, policeAt: { x: 38, z: 38 },
    obbs: ctx.obbs.map(prep), circles: ctx.circles, minimapRects: ctx.minimap,
    spawn: { x: -10, z: 1, heading: Math.PI / 2 },
    cables: new Float32Array(ctx.cables),
    buffers: sb.toBuffers(), roadBuffers: roadBuilder.toBuffers(),
    stats: { buildings: placed, triangles: sb.triangles + roadBuilder.triangles, obbs: ctx.obbs.length, circles: ctx.circles.length },
    roadClearance: (x, z) => clearance(x, z),
    pointAt, distToRoad
  };
}
