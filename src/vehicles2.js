// More Kerala road vehicles, modelled from the reference sheets: Tata 1210 decorated lorry, Tata LPK 3118 tipper,
// Mahindra 4x4 jeep, Maruti 800, HM Ambassador, Honda Titan 160 and Vespa PX 125.
// Same frame as vehicles.js: +z forward, +x left, y up. Every create*() returns { root, spin, wheelR }.
import { T } from './three-ref.js';
import { Builder, archX } from './geom.js';
import { addBuffers } from './meshutil.js';
import { plateTexture } from './textures.js';
import { materials, wheelGroup } from './vehicles.js';

let X = null; // extra textured materials, built once
function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function tex(c, rep) { const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; if (rep) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rep[0], rep[1]); } t.anisotropy = 4; return t; }
function tm(map, o = {}) { return new T.MeshStandardMaterial({ map, vertexColors: true, roughness: 0.6, metalness: 0.05, ...o }); }

// Hand-painted lorry art: bands of rosettes, stripes and diamonds in the bright enamel colours of Kerala trucks.
function artCanvas() {
  const c = cv(256, 256), g = c.getContext('2d'), P = ['#e63a2e', '#f4b400', '#1e88c9', '#2e9e5b', '#f06292', '#ffffff'];
  g.fillStyle = '#0f6b6b'; g.fillRect(0, 0, 256, 256);
  for (let r = 0; r < 4; r++) for (let q = 0; q < 4; q++) {
    const cx = 32 + q * 64, cy = 32 + r * 64;
    for (let k = 0; k < 5; k++) { g.fillStyle = P[(k + r + q) % P.length]; g.beginPath(); g.arc(cx, cy, 28 - k * 5, 0, 6.283); g.fill(); }
    g.fillStyle = '#7b1e12'; for (let a = 0; a < 8; a++) { g.beginPath(); g.arc(cx + Math.cos(a * 0.785) * 22, cy + Math.sin(a * 0.785) * 22, 3, 0, 6.283); g.fill(); }
  }
  g.strokeStyle = '#f4b400'; g.lineWidth = 3; for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(0, i * 64); g.lineTo(256, i * 64); g.stroke(); }
  return c;
}
function signCanvas(text, bg, fg, w = 512, h = 128, font = 'bold 76px "Noto Sans Malayalam", Arial, sans-serif') {
  const c = cv(w, h), g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#f4b400'; g.lineWidth = 8; g.strokeRect(6, 6, w - 12, h - 12);
  g.fillStyle = fg; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + 4);
  return c;
}
function grilleCanvas() { // tricolour chevron grille with the Tata badge
  const c = cv(256, 192), g = c.getContext('2d');
  g.fillStyle = '#2a1f1a'; g.fillRect(0, 0, 256, 192);
  const bands = ['#ff9933', '#ffffff', '#138808'];
  bands.forEach((col, i) => { g.fillStyle = col; g.beginPath(); g.moveTo(0, 20 + i * 44); g.lineTo(128, 70 + i * 44); g.lineTo(256, 20 + i * 44); g.lineTo(256, 58 + i * 44); g.lineTo(128, 108 + i * 44); g.lineTo(0, 58 + i * 44); g.fill(); });
  g.fillStyle = '#d8dade'; g.beginPath(); g.arc(128, 72, 20, 0, 6.283); g.fill(); g.strokeStyle = '#222'; g.lineWidth = 3; g.stroke();
  g.fillStyle = '#222'; g.font = 'bold 22px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('T', 128, 73);
  return c;
}
function woodCanvas() {
  const c = cv(128, 128), g = c.getContext('2d');
  g.fillStyle = '#8a5a2e'; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 6; i++) { g.fillStyle = i % 2 ? '#80532a' : '#93622f'; g.fillRect(0, i * 21, 128, 20); g.fillStyle = '#4a2c12'; g.fillRect(0, i * 21 + 20, 128, 2); }
  for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(60,35,15,.25)'; g.fillRect(Math.random() * 128, Math.random() * 128, 18 + Math.random() * 30, 1); }
  return c;
}
function stripeCanvas() { const c = cv(128, 32), g = c.getContext('2d'); for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#fff' : '#ff8c1a'; g.fillRect(i * 16, 0, 16, 32); } return c; }
function ambGrilleCanvas() { const c = cv(128, 64), g = c.getContext('2d'); g.fillStyle = '#d8dadc'; g.fillRect(0, 0, 128, 64); g.fillStyle = '#2b2b2b'; for (let i = 0; i < 12; i++) g.fillRect(6, 6 + i * 4.6, 116, 2.6); return c; }
function extra() {
  if (X) return X;
  const base = materials();
  X = {
    ...base,
    art: tm(tex(artCanvas())),
    roofSign: tm(tex(signCanvas('ദൈവം തുണ', '#1e88c9', '#fff4c8'))),
    thanks: tm(tex(signCanvas('നന്ദി', '#5a2f12', '#ffcc33'))),
    welcome: tm(tex(signCanvas('WELCOME KERALA', '#101010', '#ffd23a', 512, 128, 'bold 56px Arial, sans-serif'))),
    grille: tm(tex(grilleCanvas())),
    wood: tm(tex(woodCanvas())),
    stripe: tm(tex(stripeCanvas())),
    ambGrille: tm(tex(ambGrilleCanvas()), { metalness: 0.4 }),
    plateW: new T.MeshStandardMaterial({ map: plateTexture('KL 21 C 9424'), roughness: 0.6 })
  };
  X.plateW.vertexColors = false;
  return X;
}
const WHITE = 0xffffff;
const tails = (b, y, z, x, w = 0.2) => { for (const s of [-1, 1]) b.box('lampRed', 0xd01818, s * x, y, z, w, w * 0.6, 0.05); };
const lamps = (b, y, z, x, r = 0.1) => { for (const s of [-1, 1]) { b.cylZ('chrome', 0xd8dade, s * x, y, z, r * 1.25, 0.08, 14); b.cylZ('lamp', 0xfff4c8, s * x, y, z + 0.03, r, 0.06, 14); } };
function finish(root, b, M, wheels, wheelR) {
  addBuffers(root, b.toBuffers(), M);
  const spin = [];
  wheels.forEach(([x, z, r, w], i) => { const g = wheelGroup(r, w, 'sp' + i); g.position.set(x, r, z); root.add(g); spin.push(g); });
  return { root, spin, wheelR };
}
function cached(map, key, build) {
  if (!map.has(key)) map.set(key, build());
  const root = map.get(key).clone(true);
  return root;
}
function grab(root, n) { return Array.from({ length: n }, (_, i) => root.getObjectByName('sp' + i)); }

// ---- Tata 1210 decorated lorry ----------------------------------------------------------------
const tpl = { truck: new Map(), dump: new Map(), jeep: new Map(), amb: new Map(), maruti: new Map(), titan: new Map(), vespa: new Map() };
export const DIMS = { truck: [1.15, 3.95], dump: [1.25, 4.15], jeep: [0.9, 1.95], amb: [0.85, 2.15], maruti: [0.72, 1.7], titan: [0.38, 1.0], vespa: [0.36, 0.9] };

export function createLorry(cab = 0xf2b705) {
  const M = extra(), R = cached(tpl.truck, cab, () => {
    const root = new T.Group(), b = new Builder(0), red = 0xa81e18, K = 0x141414;
    b.box('black', K, 0, 0.85, -0.5, 1.5, 0.22, 7.6);                       // chassis frame
    b.box('dark', 0x0c0c0c, 0, 0.62, 0.1, 1.0, 0.2, 5.5);                  // underbody
    for (const z of [2.7, -1.9]) b.cylX('dark', 0x202020, 0, 0.52, z, 0.09, 1.9, 8); // axles
    // bonnet + tricolour grille + painted sides
    b.box('paint', cab, 0, 1.62, 3.0, 1.7, 0.95, 1.55);
    b.box('paint', cab, 0, 2.15, 2.95, 1.5, 0.12, 1.45);
    b.quad('grille', WHITE, 0, 1.55, 3.785, 1.25, 0.8, 0);
    for (const s of [-1, 1]) b.quad('art', WHITE, s * 0.855, 1.6, 3.0, 1.2, 0.7, s * Math.PI / 2);
    lamps(b, 1.35, 3.8, 0.78, 0.12);
    for (const s of [-1, 1]) b.box('lamp', 0xff9a1a, s * 0.82, 1.12, 3.77, 0.12, 0.1, 0.05);
    b.box('paint', 0x2a5fb0, 0, 0.78, 3.85, 2.2, 0.22, 0.2);                 // blue bumper
    b.quad('stripe', WHITE, 0, 0.5, 3.97, 2.2, 0.3, 0);                      // hazard board
    b.quad('plateW', WHITE, 0, 1.02, 3.96, 0.5, 0.17, 0);
    // fenders, cab, windscreen and decorated roof box
    for (const s of [-1, 1]) b.geo('paint', red, archX(0.64, 0.64, 0.32, 12, -1.75, 1.75), s * 1.0, 0.52, 2.7, 1, 1, 1);
    b.box('paint', cab, 0, 1.5, 1.55, 1.9, 0.8, 1.2);                        // cab lower shell
    for (const s of [-1, 1]) b.quad('art', WHITE, s * 0.955, 2.05, 0.95, 0.9, 1.9, s * Math.PI / 2); // decorated cab-back panel
    b.box('dark', 0x1b1a1a, 0, 2.2, 1.05, 1.7, 1.2, 0.8);                    // dark open cab interior
    b.box('glass', 0xa6d7dc, 0, 2.55, 2.12, 1.72, 0.9, 0.04, 0, -0.18);       // windscreen
    for (const s of [-1, 1]) for (const z of [0.5, 2.15]) b.box('black', K, s * 0.93, 2.55, z, 0.07, 1.1, 0.07);
    b.box('paint', 0x7a1b13, 0, 3.12, 1.4, 2.1, 0.12, 2.3);                  // roof deck
    b.quad('roofSign', WHITE, 0, 3.45, 2.56, 2.1, 0.62, 0);                  // front sign: Malayalam prayer
    b.quad('art', WHITE, 0, 3.45, 0.24, 2.1, 0.62, Math.PI);
    for (const s of [-1, 1]) b.quad('art', WHITE, s * 1.06, 3.45, 1.4, 2.3, 0.62, s * Math.PI / 2);
    for (const [x, c] of [[-0.8, 0xd02020], [0.8, 0x2e9e5b]]) b.sph('lamp', c, x, 3.78, 2.5, 0.07, 0.07, 0.07, 6, 5);
    // mirrors + antennae
    for (const s of [-1, 1]) { b.box('black', K, s * 1.1, 2.4, 2.1, 0.05, 0.5, 0.05); b.box('black', K, s * 1.17, 2.5, 2.1, 0.1, 0.35, 0.05); b.cyl('black', K, s * 0.85, 2.7, 3.3, 0.01, 0.01, 0.8, 4, 0, 0.2, s * -0.2); }
    // wooden cargo bed with headboard, side boards and decorated tailgate
    b.box('wood', WHITE, 0, 1.12, -1.75, 2.3, 0.12, 4.3);
    b.box('wood', WHITE, 0, 2.45, 0.38, 2.3, 2.0, 0.1);
    for (const s of [-1, 1]) b.box('wood', WHITE, s * 1.14, 1.58, -1.75, 0.08, 0.82, 4.3);
    b.box('wood', WHITE, 0, 1.58, -3.87, 2.3, 0.82, 0.08);
    for (const z of [-3.6, -2.4, -1.2, 0]) for (const s of [-1, 1]) b.box('black', K, s * 1.19, 1.58, z, 0.04, 0.9, 0.08);
    b.quad('thanks', WHITE, 0, 1.62, -3.925, 1.5, 0.5, Math.PI);
    b.quad('welcome', WHITE, 0, 0.98, -3.93, 1.6, 0.26, Math.PI);
    for (const s of [-1, 1]) b.quad('art', WHITE, s * 0.95, 0.62, -3.95, 0.5, 0.55, Math.PI); // mudflaps
    tails(b, 1.0, -3.92, 0.95, 0.24);
    b.quad('plateW', WHITE, 0, 0.78, -3.95, 0.5, 0.15, Math.PI);
    b.cylZ('chrome', 0xb8bcc0, 1.0, 0.8, -0.7, 0.28, 1.1, 12);                // fuel tank
    b.box('black', K, -1.0, 0.82, -0.7, 0.3, 0.3, 0.6);                      // battery box
    return finish(root, b, M, [[1, 2.7, 0.52, 0.26], [-1, 2.7, 0.52, 0.26], [1, -1.9, 0.52, 0.24], [-1, -1.9, 0.52, 0.24], [0.72, -1.9, 0.52, 0.24], [-0.72, -1.9, 0.52, 0.24]], 0.52).root;
  });
  return { root: R, spin: grab(R, 6), wheelR: 0.52 };
}

// ---- Tata LPK 3118 tipper ---------------------------------------------------------------------
export function createDumpTruck(body = 0x5f6b3a) {
  const M = extra(), R = cached(tpl.dump, body, () => {
    const root = new T.Group(), b = new Builder(0), K = 0x141414, cream = 0xe6e0c8;
    b.box('black', K, 0, 0.95, -0.4, 1.5, 0.24, 8.0);
    for (const z of [2.9, -1.2, -2.5]) b.cylX('dark', 0x202020, 0, 0.52, z, 0.09, 2.0, 8);
    // forward-control cab with flat tricolour-less grille
    b.box('paint', cream, 0, 2.05, 2.95, 2.3, 2.1, 1.35);
    b.quad('grille', WHITE, 0, 1.5, 3.63, 1.5, 0.75, 0);
    b.box('glass', 0xa6d7dc, 0, 2.6, 3.63, 1.9, 0.85, 0.04);
    b.box('dark', 0x202020, 0, 1.12, 3.68, 2.35, 0.26, 0.3);
    lamps(b, 1.3, 3.66, 0.95, 0.11);
    for (const s of [-1, 1]) { b.box('lamp', 0xff9a1a, s * 1.08, 1.05, 3.66, 0.12, 0.1, 0.05); b.box('dark', 0x202020, s * 1.22, 2.35, 3.2, 0.06, 0.6, 0.1); }
    b.quad('plateW', WHITE, 0, 1.12, 3.84, 0.5, 0.17, 0);
    for (const s of [-1, 1]) b.geo('paint', cream, archX(0.64, 0.64, 0.34, 12, -1.75, 1.75), s * 1.0, 0.52, 2.9, 1, 1, 1);
    // tipping body: green steel tub with ribs and a cab guard
    b.box('paint', body, 0, 1.45, -1.05, 2.5, 0.16, 6.0);
    for (const s of [-1, 1]) { b.box('paint', body, s * 1.24, 2.05, -1.05, 0.1, 1.1, 6.0); b.box('paint', body, s * 1.28, 2.62, -1.05, 0.14, 0.08, 6.0); }
    b.box('paint', body, 0, 2.35, 1.95, 2.5, 1.65, 0.12);
    b.box('paint', body, 0, 3.35, 2.45, 2.5, 0.1, 1.1, 0, -0.12);              // cab guard canopy
    b.box('paint', body, 0, 2.0, -4.03, 2.5, 0.95, 0.1);
    for (let i = 0; i < 5; i++) for (const s of [-1, 1]) b.box('paint', 0x4a5530, s * 1.31, 2.05, 1.5 - i * 1.25, 0.05, 1.05, 0.1);
    b.cyl('chrome', 0xc4c8cc, 0, 1.9, 1.75, 0.08, 0.08, 1.0, 8, 0, -0.2);      // hydraulic ram
    tails(b, 1.2, -4.0, 1.0, 0.24);
    b.quad('plateW', WHITE, 0, 1.0, -4.03, 0.5, 0.15, Math.PI);
    b.cylZ('chrome', 0xb8bcc0, 1.0, 1.0, 0.6, 0.3, 1.0, 12);
    return finish(root, b, M, [[1, 2.9, 0.52, 0.3], [-1, 2.9, 0.52, 0.3], [1, -1.2, 0.52, 0.3], [-1, -1.2, 0.52, 0.3], [1, -2.5, 0.52, 0.3], [-1, -2.5, 0.52, 0.3]], 0.52).root;
  });
  return { root: R, spin: grab(R, 6), wheelR: 0.52 };
}

// ---- Mahindra 4x4 jeep -------------------------------------------------------------------------
export function createJeep(color = 0xa9aba8) {
  const M = extra(), R = cached(tpl.jeep, color, () => {
    const root = new T.Group(), b = new Builder(0), K = 0x141414, CV = 0x1c1c1e;
    b.box('black', K, 0, 0.62, 0, 1.3, 0.16, 3.8);                          // chassis
    b.box('paint', color, 0, 1.0, -0.55, 1.62, 0.5, 2.5);                    // tub
    b.box('paint', color, 0, 1.08, 1.38, 1.5, 0.52, 1.05);                  // bonnet
    b.box('paint', color, 0, 1.36, 1.38, 1.46, 0.06, 1.0);
    b.box('dark', 0x181818, 0, 1.08, 1.92, 1.04, 0.4, 0.05);                // grille
    for (let i = 0; i < 7; i++) b.box('chrome', 0xc4c8cc, -0.42 + i * 0.14, 1.08, 1.945, 0.035, 0.36, 0.03);
    lamps(b, 1.24, 1.9, 0.62, 0.11);
    for (const s of [-1, 1]) { b.box('lamp', 0xff9a1a, s * 0.72, 0.88, 1.9, 0.1, 0.1, 0.05); }
    b.box('black', K, 0, 0.62, 1.98, 1.8, 0.18, 0.16); b.box('black', K, 0, 0.64, -2.0, 1.7, 0.16, 0.14);
    for (const s of [-1, 1]) for (const z of [1.25, -1.15]) b.geo('paint', color, archX(0.5, 0.5, 0.3, 12, -1.75, 1.75), s * 0.85, 0.42, z, 1, 1, 1);
    // black soft-top with raked windscreen, rear window and roof rack
    b.box('canvas', CV, 0, 1.92, -0.8, 1.6, 1.0, 2.1);
    b.box('canvas', CV, 0, 2.45, -0.8, 1.64, 0.05, 2.15);
    b.box('glass', 0xa6d7dc, 0, 1.78, 0.35, 1.45, 0.75, 0.035, 0, -0.35);
    b.box('glass', 0xb8d8dc, 0, 2.0, -1.875, 1.0, 0.45, 0.02);
    for (const s of [-1, 1]) b.box('glass', 0xb8d8dc, s * 0.805, 2.05, -1.1, 0.02, 0.45, 0.9);
    b.box('seat', 0x2b2b2e, 0, 1.4, -0.4, 1.3, 0.2, 0.5); b.box('seat', 0x2b2b2e, 0, 1.65, -1.1, 1.3, 0.5, 0.12);
    for (const s of [-1, 1]) b.box('black', K, s * 0.8, 2.52, -0.8, 0.04, 0.04, 2.2);
    for (let i = 0; i < 4; i++) b.box('black', K, 0, 2.54, -1.6 + i * 0.6, 1.6, 0.03, 0.04);
    for (const s of [-1, 1]) b.box('black', K, s * 0.8, 1.78, 0.5, 0.05, 0.9, 0.05);
    b.cylZ('rubber', 0x141414, 0, 1.15, -2.14, 0.4, 0.26, 14); b.cylZ('dark', 0x2a2a2a, 0, 1.15, -2.275, 0.2, 0.02, 10); // spare wheel
    for (const s of [-1, 1]) { b.box('lampRed', 0xd01818, s * 0.7, 0.95, -1.84, 0.12, 0.24, 0.05); b.box('black', K, s * 0.95, 1.5, 0.6, 0.06, 0.2, 0.05); }
    b.quad('plate', WHITE, 0, 0.62, 2.07, 0.4, 0.12, 0);
    return finish(root, b, M, [[0.85, 1.25, 0.42, 0.28], [-0.85, 1.25, 0.42, 0.28], [0.85, -1.15, 0.42, 0.28], [-0.85, -1.15, 0.42, 0.28]], 0.42).root;
  });
  return { root: R, spin: grab(R, 4), wheelR: 0.42 };
}

// ---- Maruti Suzuki 800 --------------------------------------------------------------------------
export function createMaruti(color = 0x4a4e55) {
  const M = extra(), R = cached(tpl.maruti, color, () => {
    const root = new T.Group(), b = new Builder(0);
    b.box('paint', color, 0, 0.7, 0, 1.4, 0.5, 3.3);
    b.box('paint', color, 0, 0.86, 1.3, 1.36, 0.22, 0.75, 0, 0.12);         // sloping bonnet
    b.box('paint', color, 0, 1.18, -0.2, 1.3, 0.56, 1.55);                  // cabin
    b.box('glass', 0x8fb4ba, 0, 1.2, -0.2, 1.33, 0.42, 1.38);
    b.box('glass', 0x8fb4ba, 0, 1.2, 0.74, 1.2, 0.5, 0.04, 0, -0.78);       // windscreen
    b.box('glass', 0x8fb4ba, 0, 1.2, -1.14, 1.2, 0.5, 0.04, 0, 0.7);        // hatch glass
    b.box('paint', color, 0, 1.46, -0.2, 1.24, 0.05, 1.5);
    for (const s of [-1, 1]) { b.box('paint', color, s * 0.66, 1.18, -0.2, 0.04, 0.5, 0.04); b.box('lamp', 0xfff3c8, s * 0.5, 0.82, 1.68, 0.3, 0.14, 0.05); b.box('lampRed', 0xd01818, s * 0.56, 0.82, -1.66, 0.14, 0.26, 0.05); b.box('lamp', 0xff9a1a, s * 0.68, 0.7, 1.67, 0.1, 0.08, 0.05); b.box('dark', 0x151515, s * 0.74, 1.0, 0.75, 0.12, 0.1, 0.1); }
    b.box('dark', 0x151515, 0, 0.78, 1.69, 0.5, 0.1, 0.04);                  // grille
    b.box('black', 0x101010, 0, 0.5, 1.68, 1.4, 0.16, 0.1); b.box('black', 0x101010, 0, 0.5, -1.66, 1.4, 0.16, 0.1);
    b.box('dark', 0x151515, 0, 0.42, 0, 1.3, 0.14, 3.2);
    b.quad('plate', WHITE, 0, 0.5, 1.74, 0.34, 0.1, 0); b.quad('plate', WHITE, 0, 0.64, -1.72, 0.34, 0.1, Math.PI);
    return finish(root, b, M, [[0.7, 1.0, 0.28, 0.16], [-0.7, 1.0, 0.28, 0.16], [0.7, -1.0, 0.28, 0.16], [-0.7, -1.0, 0.28, 0.16]], 0.28).root;
  });
  return { root: R, spin: grab(R, 4), wheelR: 0.28 };
}

// ---- HM Ambassador -----------------------------------------------------------------------------
export function createAmbassador(color = 0xf0efe8) {
  const M = extra(), R = cached(tpl.amb, color, () => {
    const root = new T.Group(), b = new Builder(0);
    b.box('paint', color, 0, 0.8, 0, 1.64, 0.62, 3.9);
    b.box('paint', color, 0, 0.98, 1.55, 1.34, 0.2, 0.9);                   // bonnet
    for (const s of [-1, 1]) { b.sph('paint', color, s * 0.68, 0.98, 1.5, 0.3, 0.3, 0.6, 10, 8); b.sph('paint', color, s * 0.7, 0.98, -1.6, 0.3, 0.3, 0.62, 10, 8); }
    b.sph('paint', color, 0, 0.98, -1.7, 0.8, 0.32, 0.5, 12, 8);            // boot bulge
    b.box('paint', color, 0, 1.38, -0.2, 1.4, 0.5, 2.0);                    // cabin
    b.sph('paint', color, 0, 1.6, -0.2, 0.7, 0.2, 1.05, 12, 8);              // domed roof
    b.box('glass', 0x7c9aa0, 0, 1.4, -0.2, 1.43, 0.36, 1.82);
    b.box('glass', 0x7c9aa0, 0, 1.4, 0.88, 1.28, 0.5, 0.04, 0, -0.6);
    b.box('glass', 0x7c9aa0, 0, 1.4, -1.28, 1.26, 0.46, 0.04, 0, 0.5);
    lamps(b, 1.05, 1.92, 0.58, 0.12);
    for (const s of [-1, 1]) {
      b.box('lamp', 0xff9a1a, s * 0.7, 0.86, 1.95, 0.1, 0.1, 0.05);
      b.box('lampRed', 0xd01818, s * 0.7, 1.0, -1.98, 0.12, 0.3, 0.05);
      b.box('dark', 0x151515, s * 0.84, 1.28, 0.7, 0.14, 0.12, 0.06);       // mirrors
      b.box('black', 0x101010, s * 0.55, 0.55, 2.08, 0.12, 0.2, 0.14); b.box('black', 0x101010, s * 0.55, 0.55, -2.08, 0.12, 0.2, 0.14);
    }
    b.quad('ambGrille', WHITE, 0, 0.92, 2.03, 0.88, 0.34, 0);
    b.box('chrome', 0xd2d5d8, 0, 0.55, 2.04, 1.74, 0.06, 0.08); b.box('chrome', 0xd2d5d8, 0, 0.55, -2.04, 1.74, 0.06, 0.08);
    b.quad('plate', WHITE, 0, 0.54, 2.12, 0.4, 0.1, 0); b.quad('plate', WHITE, 0, 0.84, -2.0, 0.4, 0.12, Math.PI);
    b.box('dark', 0x151515, 0, 0.4, 0, 1.4, 0.14, 3.7);
    return finish(root, b, M, [[0.8, 1.35, 0.34, 0.18], [-0.8, 1.35, 0.34, 0.18], [0.8, -1.12, 0.34, 0.18], [-0.8, -1.12, 0.34, 0.18]], 0.34).root;
  });
  return { root: R, spin: grab(R, 4), wheelR: 0.34 };
}

// ---- two-wheelers: Honda Titan 160 and Vespa PX 125, with riders ------------------------------------------
function rider(b, y, z, lean, shirt, helmet) {
  b.box('paint', shirt, 0, y + 0.45, z, 0.34, 0.5, 0.2, 0, lean);
  b.sph('paint', helmet, 0, y + 0.92, z + lean * 0.5, 0.15, 0.15, 0.17, 8, 6);
  b.box('paint', 0x2b3a55, 0, y + 0.08, z + 0.1, 0.3, 0.2, 0.5);
  for (const s of [-1, 1]) { b.box('paint', 0x2b3a55, s * 0.18, y - 0.08, z + 0.35, 0.12, 0.12, 0.5); b.box('paint', shirt, s * 0.22, y + 0.5, z + 0.35, 0.09, 0.09, 0.5, 0, 0.5); }
}
export function createTitan(withRider = true) {
  const M = extra(), R = cached(tpl.titan, withRider ? 1 : 0, () => {
    const root = new T.Group(), b = new Builder(0), O = 0xe8590c, K = 0x151515;
    b.box('black', K, 0, 0.55, 0.02, 0.2, 0.3, 0.55);                       // engine
    for (let i = 0; i < 4; i++) b.box('chrome', 0xb8bcc0, 0.12, 0.62, -0.1 + i * 0.1, 0.06, 0.2, 0.05);
    b.box('paint', O, 0, 0.98, 0.3, 0.3, 0.3, 0.5, 0, 0.0);                 // tank
    b.box('paint', O, 0, 0.9, 0.62, 0.18, 0.28, 0.2); b.box('paint', O, 0.17, 0.95, 0.4, 0.06, 0.22, 0.4); b.box('paint', O, -0.17, 0.95, 0.4, 0.06, 0.22, 0.4);
    b.box('seat', 0x1a1a1a, 0, 0.92, -0.32, 0.26, 0.1, 0.7);
    b.box('paint', O, 0, 1.0, -0.75, 0.2, 0.14, 0.45, 0, 0.18);             // tail cowl
    b.box('lampRed', 0xd01818, 0, 0.95, -0.98, 0.14, 0.08, 0.04);
    b.box('black', K, 0, 1.18, 0.55, 0.78, 0.035, 0.035);                    // handlebar
    b.cylZ('lamp', 0xfff4c8, 0, 1.1, 0.74, 0.1, 0.1, 10); b.box('paint', O, 0, 1.2, 0.64, 0.2, 0.18, 0.12);
    b.box('chrome', 0xb8bcc0, 0, 0.7, 0.6, 0.07, 0.85, 0.06, 0, -0.34);     // fork, top leaning back
    b.box('black', K, 0, 0.35, -0.4, 0.07, 0.6, 0.07, 0, 0.45);             // swingarm
    b.box('paint', O, 0, 0.42, -0.55, 0.22, 0.05, 0.4);
    b.cylZ('chrome', 0xb8bcc0, -0.15, 0.42, -0.4, 0.06, 0.8, 8);            // exhaust
    b.box('paint', O, 0, 0.62, 0.72, 0.16, 0.06, 0.3);                       // front fender
    if (withRider) rider(b, 0.97, -0.25, -0.05, 0x2d6aa8, 0x222222);
    return finish(root, b, M, [[0, 0.65, 0.31, 0.1], [0, -0.65, 0.31, 0.11]], 0.31).root;
  });
  return { root: R, spin: grab(R, 2), wheelR: 0.31 };
}
export function createVespa(color = 0x6b7a47, withRider = true) {
  const M = extra(), R = cached(tpl.vespa, color + (withRider ? 1 : 0), () => {
    const root = new T.Group(), b = new Builder(0), K = 0x151515;
    b.box('paint', color, 0, 0.62, 0.38, 0.44, 0.7, 0.07, 0, -0.18);        // leg shield
    b.box('paint', color, 0, 0.28, 0.0, 0.5, 0.06, 0.8);                    // floorboard
    b.box('paint', color, 0, 0.55, -0.38, 0.46, 0.4, 0.62);                  // engine cover
    b.box('seat', 0xd9c9a0, 0, 0.85, -0.2, 0.3, 0.1, 0.7);                   // cream seat
    b.box('paint', color, 0, 0.5, -0.78, 0.3, 0.3, 0.2);
    b.box('lampRed', 0xd01818, 0, 0.55, -0.9, 0.12, 0.08, 0.04);
    b.cylZ('rubber', 0x141414, -0.3, 0.55, -0.38, 0.16, 0.08, 10);          // spare wheel
    b.box('black', K, 0, 1.12, 0.5, 0.66, 0.035, 0.035);                    // handlebar
    b.box('paint', color, 0, 1.12, 0.5, 0.2, 0.2, 0.2);                      // headset
    b.cylZ('chrome', 0xd8dade, 0, 1.12, 0.62, 0.1, 0.07, 12); b.cylZ('lamp', 0xfff4c8, 0, 1.12, 0.655, 0.075, 0.04, 12);
    b.box('chrome', 0xb8bcc0, 0.08, 0.5, 0.58, 0.05, 0.68, 0.05, 0, -0.2);
    b.box('paint', color, 0, 0.5, 0.6, 0.2, 0.05, 0.3);
    b.cylZ('chrome', 0xb8bcc0, 0.12, 0.25, -0.55, 0.04, 0.6, 8);
    if (withRider) rider(b, 0.88, -0.2, 0.0, 0xb4432d, 0xf2f2f2);
    return finish(root, b, M, [[0, 0.58, 0.2, 0.1], [0, -0.52, 0.2, 0.11]], 0.2).root;
  });
  return { root: R, spin: grab(R, 2), wheelR: 0.2 };
}
