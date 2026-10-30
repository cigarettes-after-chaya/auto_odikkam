// Driving physics and traffic AI. Pure JS (no THREE) so it can be unit-tested in Node.
// Conventions: heading h => forward = (sin h, cos h); vehicle LEFT = (cos h, -sin h); +heading turns left.
import { circleObb, prep } from './collide.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
export const LIMITS = { maxSpeed: 29, maxReverse: -7, wheelbase: 1.74 };

// Feel tuning. Change these numbers to adjust the drive without touching the physics below.
const TUNE = {
  launchAccel: 6.5,   // m/s^2 from standstill, tapers to 0 near top speed (about 16 s to reach top speed)
  throttleRamp: 3.5,  // how fast the pedal "builds" when you press it (per second)
  grip: 14,           // how fast the travel direction follows the nose when NOT drifting
  driftGrip: 1.8,     // same, while drifting (low = more slide)
  driftYawBoost: 0.6, // extra turning while drifting
  driftBleed: 0.15,   // speed lost to sliding while drifting
  maxSlip: 0.95,      // max angle (radians, about 54 deg) between nose and travel direction
};

// Three collision circles along the auto's length.
const CIRCLES = [{ dz: 0.95, r: 0.78 }, { dz: 0, r: 0.8 }, { dz: -0.95, r: 0.78 }];

export function createPlayer(spawn) {
  return { x: spawn.x, z: spawn.z, heading: spawn.heading, course: spawn.heading, speed: 0, thr: 0, steer: 0, delta: 0, omega: 0, accel: 0, pitch: 0, roll: 0, kick: 0, hit: 0, onRoad: true, inBreaker: false, drifting: false, driftAmt: 0, slip: 0 };
}

export function stepPlayer(p, input, dt, world, obstacles = []) {
  const prevSpeed = p.speed;
  const throttle = input.accelerate ? 1 : 0, brake = input.brake ? 1 : 0;

  // gradual throttle: the pedal builds up, and acceleration tapers as speed rises
  p.thr = damp(p.thr || 0, throttle, TUNE.throttleRamp, dt);
  if (throttle) {
    const room = Math.max(0, 1 - Math.max(0, p.speed) / (LIMITS.maxSpeed * 1.03));
    p.speed += TUNE.launchAccel * room * p.thr * dt * (p.speed < 0 ? 2 : 1);
  }
  if (brake) p.speed -= (p.speed > 0.4 ? 24 : 9) * dt;
  if (!throttle && !brake) { const d = Math.min(Math.abs(p.speed), (1.6 + 0.012 * p.speed * p.speed) * dt); p.speed -= Math.sign(p.speed) * d; }
  p.speed = clamp(p.speed, LIMITS.maxReverse, LIMITS.maxSpeed);

  const clear = world.roadClearance(p.x, p.z);
  p.onRoad = clear < 2.3;
  if (!p.onRoad) { p.speed -= p.speed * 0.7 * dt; if (p.speed > 15) p.speed -= 18 * dt; } // grass / shoulder drag

  // steering input
  const target = (input.left ? 1 : 0) - (input.right ? 1 : 0) + (input.steerAxis || 0);
  p.steer = damp(p.steer, clamp(target, -1, 1), 6.5, dt);
  p.delta = p.steer * (0.62 - 0.38 * clamp(Math.abs(p.speed) / LIMITS.maxSpeed, 0, 1));

  // drift state: needs the handbrake, some speed, and steering to start; holds until released or too slow
  if (input.drift && p.speed > 6 && (p.drifting || Math.abs(p.steer) > 0.25)) p.drifting = true;
  else if (!input.drift || p.speed < 5) p.drifting = false;
  p.driftAmt = damp(p.driftAmt || 0, p.drifting ? 1 : 0, p.drifting ? 8 : 4, dt);

  // bicycle steering model with a lateral-grip limit so fast turns understeer instead of snapping
  let omega = ((p.speed * Math.tan(p.delta)) / LIMITS.wheelbase) * (1 + TUNE.driftYawBoost * p.driftAmt);
  const sp = Math.abs(p.speed);
  if (sp > 1) { const lim = (11 + 5 * p.driftAmt) / sp; omega = clamp(omega, -lim, lim); }
  p.omega = omega;
  p.heading += omega * dt;

  // travel direction (course) chases the nose. Low grip while drifting means the body points more than the car travels.
  if (p.speed < 1) p.course = p.heading;
  else {
    const grip = TUNE.grip + (TUNE.driftGrip - TUNE.grip) * p.driftAmt;
    p.course += angDiff(p.course, p.heading) * (1 - Math.exp(-grip * dt));
  }
  let slip = angDiff(p.course, p.heading);
  if (Math.abs(slip) > TUNE.maxSlip) { p.course = p.heading - Math.sign(slip) * TUNE.maxSlip; slip = angDiff(p.course, p.heading); }
  p.slip = slip;
  if (p.speed > 0) p.speed -= p.speed * Math.min(1, Math.abs(Math.sin(slip))) * (p.drifting ? TUNE.driftBleed : 0.6) * dt;

  p.x += Math.sin(p.course) * p.speed * dt;
  p.z += Math.cos(p.course) * p.speed * dt;

  // speed breakers
  let inB = false;
  for (const b of world.breakers) if (circleObb(p.x, p.z, 0.35, { x: b.x, z: b.z, hw: b.hw, hd: b.hd, a: b.a })) { inB = true; break; }
  if (inB && !p.inBreaker) { p.kick = clamp(sp / 12, 0.15, 1); if (sp > 9) p.speed *= 0.94; }
  p.inBreaker = inB;
  p.kick = damp(p.kick, 0, 5, dt);

  // collisions: solid world colliders then traffic
  p.hit = Math.max(0, p.hit - dt * 3);
  for (let pass = 0; pass < 2; pass++) {
    const fx = Math.sin(p.heading), fz = Math.cos(p.heading);
    for (const c of CIRCLES) {
      const cx = p.x + fx * c.dz, cz = p.z + fz * c.dz;
      const resolve = (nx, nz, pen) => {
        p.x += nx * pen; p.z += nz * pen;
        const into = -(fx * nx + fz * nz) * p.speed;
        if (into > 0.3) {
          p.speed *= 1 - clamp(into / 14, 0.25, 0.7) * 0.9; p.hit = Math.max(p.hit, clamp(into / 12, 0.2, 1));
          p.course += angDiff(p.course, p.heading) * 0.5; // a hit straightens the slide
        }
      };
      for (const o of world.obbs) { const h = circleObb(cx, cz, c.r, o); if (h) resolve(h.nx, h.nz, h.pen); }
      for (const o of obstacles) { const h = circleObb(cx, cz, c.r, o); if (h) { resolve(h.nx, h.nz, h.pen); o.hitByPlayer = true; } }
      for (const o of world.circles) {
        const dx = cx - o.x, dz = cz - o.z, d = Math.hypot(dx, dz), rr = c.r + o.r;
        if (d < rr && d > 1e-4) resolve(dx / d, dz / d, rr - d);
      }
    }
  }
  const L = 200;
  if (Math.abs(p.x) > L || Math.abs(p.z) > L) { p.x = clamp(p.x, -L, L); p.z = clamp(p.z, -L, L); p.speed *= 0.92; }

  p.accel = (p.speed - prevSpeed) / Math.max(dt, 1e-4);
  p.pitch = damp(p.pitch, clamp(-p.accel * 0.004, -0.05, 0.05) + p.kick * 0.02, 8, dt);
  p.roll = damp(p.roll, clamp(-p.omega * sp * 0.006, -0.12, 0.12), 7, dt);
  return p;
}

// ---- Traffic ---------------------------------------------------------------------------------
export class Traffic {
  constructor(world, specs, avoid) {
    this.world = world;
    this.list = specs.map((s, i) => {
      const route = world.routes.find((r) => r.name === s.route);
      let sPos = (s.at ?? 0) * route.len;
      const v = { id: i, ...s, route, s: sPos, speed: 0, x: 0, z: 0, heading: 0, stuck: 0, ignore: 0, hitTimer: 0 };
      this._place(v);
      // keep newly spawned vehicles away from the player's start
      let guard = 0;
      while (avoid && Math.hypot(v.x - avoid.x, v.z - avoid.z) < 45 && guard++ < 200) { v.s = (v.s + 5) % route.len; this._place(v); }
      v.speed = v.maxSpeed * 0.6;
      return v;
    });
  }
  // Position on the route at arc length t (wraps around the closed loop), linearly interpolated.
  _at(r, t) {
    t = ((t % r.len) + r.len) % r.len;
    const k = t / r.step, i = Math.floor(k) % r.n, j = (i + 1) % r.n, f = k - Math.floor(k), a = r.pts[i], b = r.pts[j];
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
  }
  // Heading follows the chord between a point behind and a point ahead of the centre, so long vehicles
  // (lorries, buses) swing along bends instead of cutting corners or snapping per route segment.
  _heading(v, t) {
    const r = v.route, h = Math.max(1.2, v.hd * 0.8), a = this._at(r, t - h), b = this._at(r, t + h);
    return Math.atan2(b[0] - a[0], b[1] - a[1]);
  }
  _place(v, dt = 0) {
    const r = v.route, p = this._at(r, v.s), want = this._heading(v, v.s);
    v.x = p[0]; v.z = p[1];
    if (!dt) { v.heading = want; return; }
    let d = want - v.heading; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
    v.heading += d * (1 - Math.exp(-dt * 12));
  }
  // obstacle boxes for player collision
  boxes() {
    return this.list.map((v) => { v.obb = v.obb || { hw: v.hw, hd: v.hd, hitByPlayer: false }; v.obb.x = v.x; v.obb.z = v.z; v.obb.a = v.heading; v.obb.c = Math.cos(v.heading); v.obb.s = Math.sin(v.heading); v.obb.owner = v; return v.obb; });
  }
  update(dt, player) {
    const all = this.list;
    for (const v of all) {
      const fx = Math.sin(v.heading), fz = Math.cos(v.heading), lx = Math.cos(v.heading), lz = -Math.sin(v.heading);
      let target = v.maxSpeed, gapMin = 1e9;
      const check = (ox, oz, ohw, ohd, isPlayer) => {
        if (!isPlayer && v.ignore > 0) return;
        const dx = ox - v.x, dz = oz - v.z, ahead = dx * fx + dz * fz, lat = dx * lx + dz * lz;
        const look = 7 + v.speed * 1.5 + v.hd + ohd;
        if (ahead > 0 && ahead < look && Math.abs(lat) < (v.hw + ohw) * 0.9 + 0.7) {
          const gap = ahead - v.hd - ohd; if (gap < gapMin) gapMin = gap;
        }
      };
      for (const o of all) if (o !== v) check(o.x, o.z, o.hw, o.hd, false);
      if (player) check(player.x, player.z, 0.9, 1.5, true);
      // slow for bends: compare the route heading now with the heading ~12 units ahead
      const hn = this._heading(v, v.s + 2), hf = this._heading(v, v.s + 12 + v.speed);
      let turn = Math.abs(hf - hn); while (turn > Math.PI) turn = Math.abs(turn - 2 * Math.PI);
      target = Math.min(target, v.maxSpeed * clamp(1.3 - turn * 1.0, 0.5, 1));
      if (gapMin < 1e8) target = clamp((gapMin - 2.2) * 0.9, 0, v.maxSpeed);
      if (v.hitTimer > 0) { v.hitTimer -= dt; target = 0; }
      const rate = target > v.speed ? v.accel : 9;
      v.speed += clamp(target - v.speed, -rate * dt, rate * dt);
      v.stuck = v.speed < 0.3 ? v.stuck + dt : 0;
      if (v.stuck > 6) { v.ignore = 3; v.stuck = 0; }
      if (v.ignore > 0) v.ignore -= dt;
      v.s += v.speed * dt;
      this._place(v, dt);
    }
  }
}
