// Procedural vehicles. The auto-rickshaw has exactly THREE wheels: one steerable front wheel on the
// centre line and two rear wheels on the rear axle (see the technical drawing reference).
// Local vehicle frame: +z forward, +x left, y up. Templates are built once and cloned.
import { T } from './three-ref.js';
import { Builder } from './geom.js';
import { addBuffers } from './meshutil.js';
import { plateTexture } from './textures.js';
import { archZ, archX } from './geom.js';

export const AUTO = { wheelR: 0.36, wheelW: 0.17, front: { x: 0, z: 1.12 }, rear: { x: 0.68, z: -0.62 }, wheelbase: 1.74, hw: 0.78, hd: 1.55 };
export const BUS = { len: 10.4, width: 2.5, hw: 1.3, hd: 5.3, frontAxle: 3.3, rearAxle: -2.15, wheelR: 0.5 };
const URL_BASE = (p) => new URL('../assets/textures/vehicles/' + p, import.meta.url).href;

let M = null; // shared materials
function mat(o) { const m = new T.MeshStandardMaterial({ vertexColors: true, ...o }); return m; }
export function materials() {
  if (M) return M;
  M = {
    paint: mat({ roughness: 0.38, metalness: 0.3 }),
    black: mat({ roughness: 0.55, metalness: 0.25 }),
    canvas: mat({ roughness: 0.95, metalness: 0, side: T.DoubleSide }),
    glass: mat({ roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.38, depthWrite: false }),
    chrome: mat({ roughness: 0.25, metalness: 0.85 }),
    rubber: mat({ roughness: 0.95, metalness: 0 }),
    seat: mat({ roughness: 0.85, metalness: 0 }),
    dark: mat({ roughness: 0.9, metalness: 0.1 }),
    lamp: new T.MeshBasicMaterial({ vertexColors: true }),
    lampRed: new T.MeshBasicMaterial({ vertexColors: true }),
    plate: new T.MeshStandardMaterial({ map: plateTexture(), roughness: 0.6 })
  };
  M.glass.userData.noShadow = true;
  return M;
}

// ---- wheels ---------------------------------------------------------------------------------
export function wheelGroup(r, w, name) {
  const b = new Builder(0);
  b.cylX('rubber', 0x141414, 0, 0, 0, r, w, 16);
  b.cylX('dark', 0x2a2a2a, 0, 0, 0, r * 0.72, w + 0.012, 14);
  b.cylX('chrome', 0xc4c8cc, 0, 0, 0, r * 0.55, w + 0.024, 14);
  b.cylX('dark', 0x333333, 0, 0, 0, r * 0.3, w + 0.036, 10);
  for (let i = 0; i < 5; i++) { const a = (i / 5) * 6.283; b.cylX('chrome', 0x9ea3a8, 0, Math.sin(a) * r * 0.42, Math.cos(a) * r * 0.42, r * 0.06, w + 0.04, 6); }
  const g = new T.Group(); g.name = name;
  addBuffers(g, b.toBuffers(), materials(), { receive: false });
  return g;
}

// ---- auto-rickshaw --------------------------------------------------------------------------
let autoTemplate = null;
function buildAuto() {
  const Y = 0xf4b400, K = 0x141414, CV = 0x1c1c1e, M_ = materials();
  const root = new T.Group();
  const body = new T.Group(); body.name = 'body'; root.add(body);
  const b = new Builder(0);
  // floor, underbody and rear engine cover
  b.box('black', K, 0, 0.5, -0.15, 1.3, 0.12, 2.6);
  b.box('dark', 0x0d0d0d, 0, 0.38, -0.2, 0.9, 0.2, 2.0);
  b.box('black', K, 0, 0.9, -1.13, 1.46, 0.72, 0.6);
  for (let i = 0; i < 4; i++) b.box('dark', 0x060606, 0, 0.72 + i * 0.1, -1.435, 1.0, 0.035, 0.02);
  b.box('paint', Y, 0, 1.3, -1.13, 1.48, 0.06, 0.62);
  b.quad('plate', 0xffffff, 0, 0.78, -1.45, 0.44, 0.14, Math.PI);
  for (const s of [-1, 1]) b.box('lampRed', 0xd01818, s * 0.52, 1.02, -1.44, 0.16, 0.1, 0.05);
  // rear quarter panels: black lower, yellow trim
  for (const s of [-1, 1]) {
    b.box('black', K, s * 0.73, 0.85, -0.62, 0.06, 0.42, 1.2);
    b.box('paint', Y, s * 0.73, 1.1, -0.62, 0.075, 0.07, 1.2);
    b.box('black', K, s * 0.79, 0.4, 0.3, 0.22, 0.04, 0.56); // side step
  }
  // nose / front cowl (yellow upper, black apron) with single central headlamp
  b.box('paint', Y, 0, 1.0, 0.86, 1.1, 0.6, 0.62, 0, -0.1);
  b.box('paint', Y, 0, 0.98, 1.12, 0.9, 0.5, 0.3, 0, -0.1);
  b.box('black', K, 0, 0.7, 0.96, 1.16, 0.2, 0.64);
  b.cylZ('chrome', 0xd8dade, 0, 1.08, 1.29, 0.14, 0.08, 14);
  b.cylZ('lamp', 0xfff4c8, 0, 1.08, 1.335, 0.105, 0.05, 14);
  for (const s of [-1, 1]) b.box('lamp', 0xff9a1a, s * 0.47, 0.98, 1.24, 0.1, 0.09, 0.05);
  b.box('dark', 0x111111, 0, 0.82, 1.285, 0.4, 0.1, 0.03); // horn grille
  b.quad('plate', 0xffffff, 0, 0.62, 1.31, 0.34, 0.1, 0);
  // windscreen, frame, wiper
  b.box('glass', 0x9fd3d8, 0, 1.62, 0.62, 1.12, 0.64, 0.035, 0, -0.28);
  b.box('paint', Y, 0, 1.97, 0.49, 1.24, 0.09, 0.12);
  for (const s of [-1, 1]) b.box('paint', Y, s * 0.58, 1.58, 0.63, 0.06, 0.78, 0.06, 0, -0.28);
  b.box('paint', Y, 0, 1.3, 0.76, 1.2, 0.07, 0.2);
  b.box('black', K, 0.1, 1.47, 0.665, 0.5, 0.02, 0.02, 0, -0.28, 0.12);
  // black canvas canopy (rounded) + front visor + rear flap with window
  b.geo('canvas', CV, archZ(0.82, 0.24, 2.15, 12, -Math.PI / 2, Math.PI / 2), 0, 1.84, -0.52, 1, 1, 1);
  b.box('canvas', CV, 0, 1.97, 0.58, 1.5, 0.045, 0.3, 0, 0.18);
  b.box('canvas', CV, 0, 1.45, -1.56, 1.6, 0.86, 0.05, 0, 0.04);
  b.box('glass', 0xb8d8dc, 0, 1.55, -1.585, 0.72, 0.3, 0.02);
  // posts and side rails (open sides)
  for (const s of [-1, 1]) for (const z of [-0.05, -1.25]) b.box('black', K, s * 0.76, 1.4, z, 0.05, 1.0, 0.05);
  for (const s of [-1, 1]) b.cylZ('chrome', 0xc4c8cc, s * 0.76, 1.22, -0.62, 0.018, 1.2, 6);
  // seats: driver (centre) and rear bench
  b.box('seat', 0x23304f, 0, 0.78, 0.1, 0.5, 0.14, 0.44);
  b.box('seat', 0x23304f, 0, 1.05, -0.12, 0.5, 0.4, 0.1, 0, 0.08);
  b.box('seat', 0x2c3a5c, 0, 0.78, -0.72, 1.2, 0.18, 0.62);
  b.box('seat', 0x2c3a5c, 0, 1.13, -1.06, 1.2, 0.56, 0.12, 0, 0.1);
  b.cylX('chrome', 0xc4c8cc, 0, 1.46, -0.98, 0.02, 1.2, 6);
  // mudguards over the three wheels
  b.geo('paint', Y, archX(0.47, 0.47, 0.26, 12, -1.75, 1.75), AUTO.front.x, 0.36, AUTO.front.z, 1, 1, 1);
  for (const s of [-1, 1]) b.geo('black', K, archX(0.46, 0.46, 0.22, 12, -1.7, 1.7), s * AUTO.rear.x, 0.36, AUTO.rear.z, 1, 1, 1);
  // mirrors on stalks
  for (const s of [-1, 1]) {
    b.cyl('chrome', 0xc4c8cc, s * 0.66, 1.78, 0.62, 0.016, 0.016, 0.42, 6, 0, 0, s * -0.25);
    b.cylZ('chrome', 0xdfe3e6, s * 0.72, 1.98, 0.6, 0.075, 0.03, 12);
    b.cylZ('black', 0x222222, s * 0.72, 1.98, 0.585, 0.082, 0.02, 12);
  }
  // front fork legs (static part of the fork shown on the body)
  addBuffers(body, b.toBuffers(), M_);

  // handlebar assembly rotates with the steering
  const bar = new T.Group(); bar.name = 'bar'; bar.position.set(0, 1.36, 0.52); body.add(bar);
  const hb = new Builder(0);
  hb.box('chrome', 0xc4c8cc, 0, 0, 0, 0.8, 0.035, 0.035);
  for (const s of [-1, 1]) hb.cylX('black', 0x111111, s * 0.4, 0, 0, 0.03, 0.15, 8);
  hb.cyl('dark', 0x151515, 0, 0.05, 0.08, 0.09, 0.09, 0.07, 12, -0.5);
  hb.cyl('chrome', 0xc4c8cc, 0, -0.14, -0.05, 0.025, 0.025, 0.4, 6, 0.55);
  addBuffers(bar, hb.toBuffers(), M_, { receive: false });

  // wheels: front (steers, centred), rear left/right (fixed)
  const fork = new T.Group(); fork.name = 'fork'; fork.position.set(AUTO.front.x, AUTO.wheelR, AUTO.front.z); root.add(fork);
  const sp = wheelGroup(AUTO.wheelR, AUTO.wheelW, 'spinF'); fork.add(sp);
  const fb = new Builder(0);
  for (const s of [-1, 1]) fb.box('chrome', 0xb8bcc0, s * 0.13, 0.22, -0.02, 0.035, 0.6, 0.05, 0, 0.12);
  addBuffers(fork, fb.toBuffers(), M_, { receive: false });
  for (const [name, s] of [['spinL', 1], ['spinR', -1]]) { const w = wheelGroup(AUTO.wheelR, AUTO.wheelW, name); w.position.set(s * AUTO.rear.x, AUTO.wheelR, AUTO.rear.z); root.add(w); }
  return root;
}

export function createAuto() {
  if (!autoTemplate) autoTemplate = buildAuto();
  const root = autoTemplate.clone(true);
  const find = (n) => root.getObjectByName(n);
  return { root, body: find('body'), bar: find('bar'), fork: find('fork'), spin: [find('spinF'), find('spinL'), find('spinR')], wheelR: AUTO.wheelR };
}

// ---- KSRTC Super Fast bus -------------------------------------------------------------------
function drawBusFallback(kind) {
  const w = kind === 'front' || kind === 'rear' ? 160 : 673, h = kind === 'front' || kind === 'rear' ? 200 : 184;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d');
  x.fillStyle = '#f3e29a'; x.fillRect(0, 0, w, h);
  x.fillStyle = '#c8141b'; x.fillRect(0, h * 0.72, w, h * 0.28);
  if (kind === 'front' || kind === 'rear') {
    x.fillStyle = '#101010'; x.fillRect(w * 0.08, h * 0.12, w * 0.84, h * 0.45);
    x.fillStyle = '#fff'; x.font = 'bold 18px Arial'; x.textAlign = 'center'; x.fillText(kind === 'front' ? 'KSRTC' : 'SUPER FAST', w / 2, h * 0.75);
  } else {
    x.fillStyle = '#101010';
    for (let i = 0; i < 9; i++) x.fillRect(20 + i * 72, h * 0.14, 56, h * 0.28);
    x.fillStyle = '#c8141b'; x.font = 'italic bold 30px Arial'; x.textAlign = 'center'; x.fillText('Super Fast', w / 2, h * 0.58);
    x.fillStyle = '#101010';
    for (const u of [0.29, 0.817]) { x.beginPath(); x.arc(u * w, h, 31, Math.PI, 0); x.fill(); }
  }
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
}
let busMats = null;
function busMaterials(maxAniso) {
  if (busMats) return busMats;
  busMats = {};
  const files = { busLeft: 'ksrtc-left.jpg', busRight: 'ksrtc-right.jpg', busFront: 'ksrtc-front.jpg', busRear: 'ksrtc-rear.jpg' };
  const kinds = { busLeft: 'left', busRight: 'right', busFront: 'front', busRear: 'rear' };
  for (const key of Object.keys(files)) {
    const m = new T.MeshStandardMaterial({ map: drawBusFallback(kinds[key]), roughness: 0.55, metalness: 0.1 });
    busMats[key] = m;
    try { // real livery cropped from the supplied reference; keeps the canvas fallback if it fails to load
      new T.TextureLoader().load(URL_BASE(files[key]), (t) => { t.colorSpace = T.SRGBColorSpace; t.anisotropy = maxAniso; m.map = t; m.needsUpdate = true; }, undefined, () => {});
    } catch (e) { /* keep fallback */ }
  }
  return busMats;
}

let busTemplate = null;
function buildBus(maxAniso) {
  const M_ = { ...materials(), ...busMaterials(maxAniso) };
  const root = new T.Group(), b = new Builder(0), L = BUS.len, H = 3.34;
  b.box('paint', 0xf3e29a, 0, 1.95, 0, BUS.width - 0.02, 2.8, L - 0.2);       // cream body
  b.box('paint', 0xefefea, 0, 3.4, 0, BUS.width - 0.12, 0.14, L - 0.5);        // roof
  for (const z of [-3, 0, 3]) b.box('paint', 0xdcdcd6, 0, 3.5, z, 0.9, 0.1, 0.9); // roof vents
  b.box('dark', 0x151515, 0, 0.36, 0, 2.3, 0.3, L - 0.9);                        // underbody
  const sh = H - 0.5, cy = 0.5 + sh / 2;
  b.quad('busLeft', 0xffffff, BUS.width / 2 + 0.005, cy, 0, L, sh, Math.PI / 2);
  b.quad('busRight', 0xffffff, -BUS.width / 2 - 0.005, cy, 0, L, sh, -Math.PI / 2);
  b.quad('busFront', 0xffffff, 0, 1.85, L / 2 - 0.095, BUS.width - 0.02, 2.98, 0);
  b.quad('busRear', 0xffffff, 0, 1.85, -L / 2 + 0.095, BUS.width - 0.02, 2.98, Math.PI);
  for (const z of [1, -1]) b.box('dark', 0x6c6e70, 0, 0.5, z * (L / 2 - 0.02), BUS.width + 0.06, 0.2, 0.22); // bumpers
  for (const s of [-1, 1]) {
    b.box('dark', 0x151515, s * 1.5, 2.25, 4.75, 0.05, 0.05, 0.4);               // mirror arms
    b.box('dark', 0x1a1a1a, s * 1.6, 2.1, 4.65, 0.06, 0.55, 0.3);               // mirrors
    b.box('lamp', 0xfff3c8, s * 0.85, 0.85, L / 2 + 0.02, 0.22, 0.14, 0.04);     // headlamps
    b.box('lampRed', 0xd01818, s * 0.9, 0.95, -L / 2 - 0.02, 0.2, 0.12, 0.04);   // tail lamps
  }
  addBuffers(root, b.toBuffers(), M_);
  const axles = [[BUS.frontAxle, [1.17]], [BUS.rearAxle, [1.17, 0.85]]];
  let n = 0;
  for (const [z, xs] of axles) for (const s of [-1, 1]) for (const x of xs) {
    const w = wheelGroup(BUS.wheelR, 0.3, 'sp' + n++); w.position.set(s * x, BUS.wheelR, z); root.add(w);
  }
  return root;
}
export function createBus(maxAniso = 4) {
  if (!busTemplate) busTemplate = buildBus(maxAniso);
  const root = busTemplate.clone(true), spin = [];
  for (let i = 0; i < 6; i++) spin.push(root.getObjectByName('sp' + i));
  return { root, spin, wheelR: BUS.wheelR };
}

// ---- hatchback / sedan traffic ---------------------------------------------------------------
const carTemplates = new Map();
export function createCar(color = 0xf0f0f0) {
  if (!carTemplates.has(color)) {
    const root = new T.Group(), b = new Builder(0), M_ = materials();
    b.box('paint', color, 0, 0.68, 0, 1.7, 0.6, 3.9);
    b.box('paint', color, 0, 0.62, 1.6, 1.66, 0.4, 0.7, 0, -0.05);
    b.box('paint', color, 0, 1.2, -0.25, 1.52, 0.52, 2.0);
    b.box('glass', 0x7fa6ae, 0, 1.23, -0.25, 1.56, 0.4, 1.8);
    b.box('glass', 0x7fa6ae, 0, 1.2, 0.72, 1.4, 0.44, 0.06, 0, -0.9);
    b.box('dark', 0x1a1a1a, 0, 0.38, 0, 1.6, 0.14, 3.9);
    for (const s of [-1, 1]) { b.box('lamp', 0xfff3c8, s * 0.6, 0.78, 1.96, 0.3, 0.14, 0.04); b.box('lampRed', 0xd01818, s * 0.62, 0.8, -1.96, 0.3, 0.12, 0.04); }
    addBuffers(root, b.toBuffers(), M_);
    const spin = [];
    for (const [x, z] of [[0.82, 1.2], [-0.82, 1.2], [0.82, -1.2], [-0.82, -1.2]]) { const w = wheelGroup(0.31, 0.22, 'w' + spin.length); w.position.set(x, 0.31, z); root.add(w); spin.push(w.name); }
    carTemplates.set(color, root);
  }
  const root = carTemplates.get(color).clone(true);
  return { root, spin: [0, 1, 2, 3].map((i) => root.getObjectByName('w' + i)), wheelR: 0.31 };
}

// ---- passenger / destination markers --------------------------------------------------------
function textSprite(text) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = 'rgba(15,24,18,.88)'; if (x.roundRect) { x.beginPath(); x.roundRect(4, 4, 504, 120, 20); x.fill(); } else x.fillRect(4, 4, 504, 120);
  x.font = 'bold 42px Arial'; x.fillStyle = '#fff4b0'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 256, 64);
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace;
  const s = new T.Sprite(new T.SpriteMaterial({ map: t, transparent: true, depthTest: false })); s.scale.set(5.5, 1.35, 1); s.renderOrder = 10;
  return s;
}
export function createPassenger() {
  const g = new T.Group(), b = new Builder(0), M_ = materials();
  b.cyl('paint', 0x4c7d69, 0, 1.05, 0, 0.19, 0.22, 0.65, 10);
  b.sph('paint', 0xb97b54, 0, 1.53, 0, 0.17, 0.17, 0.17, 10, 8);
  b.box('paint', 0x353d3a, 0, 0.68, 0, 0.38, 0.09, 0.23);
  for (const s of [-1, 1]) { b.cyl('paint', 0x353d3a, s * 0.12, 0.36, 0, 0.055, 0.065, 0.55, 8); b.cyl('paint', 0x282c29, s * 0.12, 0.08, 0.04, 0.06, 0.06, 0.12, 8); }
  b.cyl('paint', 0x4c7d69, 0.26, 1.35, 0, 0.055, 0.06, 0.4, 8, 0, 0, -0.7);
  addBuffers(g, b.toBuffers(), M_, { receive: false });
  const marker = new T.Group(); marker.add(g);
  const halo = new T.Mesh(new T.TorusGeometry(0.55, 0.055, 8, 24), new T.MeshStandardMaterial({ color: 0xffd43b, roughness: 0.35, metalness: 0.2, emissive: 0xffa800, emissiveIntensity: 0.4 }));
  halo.rotation.x = Math.PI / 2; halo.position.y = 0.06; marker.add(halo);
  const label = textSprite('PASSENGER'); label.position.y = 2.55; marker.add(label);
  return marker;
}
export function createDestination() {
  const g = new T.Group(), m = new T.MeshStandardMaterial({ color: 0xffd43b, roughness: 0.3, metalness: 0.2, emissive: 0xffa800, emissiveIntensity: 0.5 });
  const ring = new T.Mesh(new T.TorusGeometry(2.2, 0.12, 8, 36), m); ring.rotation.x = Math.PI / 2; ring.position.y = 0.12; g.add(ring);
  const beam = new T.Mesh(new T.CylinderGeometry(0.06, 0.06, 3.4, 8), m); beam.position.y = 1.8; g.add(beam);
  const top = new T.Mesh(new T.ConeGeometry(0.38, 0.8, 12), m); top.position.y = 3.9; top.rotation.x = Math.PI; g.add(top);
  const label = textSprite('DESTINATION'); label.position.y = 5.2; g.add(label);
  g.userData.ring = ring;
  return g;
}
