// Procedural canvas textures (no external image files needed) + the shop/sign atlas.
import { T } from './three-ref.js';
import { ATLAS, SIGNS } from './signs.js';

const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
function tex(c, { repeat = false, srgb = true, aniso = 4 } = {}) {
  const t = new T.CanvasTexture(c);
  if (srgb) t.colorSpace = T.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = T.RepeatWrapping; }
  t.anisotropy = aniso;
  return t;
}
function noise(ctx, w, h, base, spread, count, size = 1) {
  ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < count; i++) {
    const v = Math.floor((Math.random() - 0.5) * spread);
    ctx.fillStyle = `rgba(${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${Math.abs(v) / 255})`;
    ctx.fillRect(Math.random() * w, Math.random() * h, size, size);
  }
}

export function asphaltTexture(aniso) {
  const c = canvas(256, 256), x = c.getContext('2d');
  noise(x, 256, 256, '#3f4246', 70, 5200, 2);
  x.strokeStyle = 'rgba(20,20,20,.35)'; x.lineWidth = 1;
  for (let i = 0; i < 6; i++) { x.beginPath(); let px = Math.random() * 256, py = Math.random() * 256; x.moveTo(px, py); for (let k = 0; k < 5; k++) { px += (Math.random() - 0.5) * 40; py += (Math.random() - 0.5) * 40; x.lineTo(px, py); } x.stroke(); }
  return tex(c, { repeat: true, aniso });
}
export function grassTexture(aniso) {
  const c = canvas(256, 256), x = c.getContext('2d');
  noise(x, 256, 256, '#6f9a58', 60, 4500, 2);
  for (let i = 0; i < 700; i++) { x.fillStyle = `rgba(${60 + Math.random() * 40},${110 + Math.random() * 60},${40 + Math.random() * 30},.5)`; x.fillRect(Math.random() * 256, Math.random() * 256, 1, 3 + Math.random() * 3); }
  for (let i = 0; i < 10; i++) { x.fillStyle = 'rgba(160,110,70,.12)'; x.beginPath(); x.ellipse(Math.random() * 256, Math.random() * 256, 12 + Math.random() * 18, 6 + Math.random() * 10, 0, 0, 7); x.fill(); }
  return tex(c, { repeat: true, aniso });
}
export function concreteTexture(aniso, base = '#b9b7b0') {
  const c = canvas(128, 128), x = c.getContext('2d');
  noise(x, 128, 128, base, 40, 1800, 2);
  x.strokeStyle = 'rgba(60,60,60,.35)'; x.strokeRect(0.5, 0.5, 127, 127);
  return tex(c, { repeat: true, aniso });
}
export function pavingTexture(aniso) { // interlocking paver bricks (police forecourt)
  const c = canvas(128, 128), x = c.getContext('2d');
  x.fillStyle = '#8c8d8a'; x.fillRect(0, 0, 128, 128);
  for (let r = 0; r < 4; r++) for (let q = 0; q < 4; q++) {
    const ox = (r % 2) * 16, v = 150 + ((r * 7 + q * 13) % 3) * 12;
    x.fillStyle = `rgb(${v},${v},${v - 4})`; x.fillRect(q * 32 + ox + 1, r * 32 + 1, 30, 30);
  }
  return tex(c, { repeat: true, aniso });
}
export function roofTileTexture(aniso) { // greyscale pattern; colour comes from vertex colours
  const c = canvas(128, 128), x = c.getContext('2d');
  x.fillStyle = '#c9c9c9'; x.fillRect(0, 0, 128, 128);
  for (let r = 0; r < 8; r++) for (let q = 0; q < 8; q++) {
    const ox = (r % 2) * 8, v = 205 + Math.floor(Math.random() * 40);
    x.fillStyle = `rgb(${v},${v},${v})`; x.fillRect(q * 16 + ox, r * 16, 15, 15);
    x.fillStyle = 'rgba(0,0,0,.28)'; x.fillRect(q * 16 + ox, r * 16 + 12, 16, 3);
    x.fillStyle = 'rgba(0,0,0,.14)'; x.fillRect(q * 16 + ox, r * 16, 2, 15);
  }
  return tex(c, { repeat: true, aniso });
}
// Leaf with alpha cut-out leaflets: kind 'palm' (narrow fringe) or 'banana' (broad blade).
export function leafTexture(kind, aniso) {
  const w = 128, h = 256, c = canvas(w, h), x = c.getContext('2d');
  x.clearRect(0, 0, w, h);
  if (kind === 'palm') {
    x.lineCap = 'round';
    for (let k = 0; k < 46; k++) {
      const y = 4 + (k / 46) * (h - 10), len = 58 * (1 - Math.abs(k / 46 - 0.35) * 0.55), drop = 16;
      for (const s of [-1, 1]) {
        x.strokeStyle = k % 2 ? '#2f7d32' : '#3c9440'; x.lineWidth = 4.2;
        x.beginPath(); x.moveTo(w / 2, y); x.quadraticCurveTo(w / 2 + s * len * 0.55, y + 2, w / 2 + s * len, y + drop); x.stroke();
      }
    }
    x.strokeStyle = '#5b7f2a'; x.lineWidth = 4; x.beginPath(); x.moveTo(w / 2, 0); x.lineTo(w / 2, h); x.stroke();
  } else {
    const g = x.createLinearGradient(0, 0, w, 0); g.addColorStop(0, '#3f8b34'); g.addColorStop(0.5, '#59a443'); g.addColorStop(1, '#3f8b34');
    x.fillStyle = g; x.beginPath(); x.moveTo(w / 2, 0); x.bezierCurveTo(w, 40, w * 0.98, 180, w / 2, h); x.bezierCurveTo(w * 0.02, 180, 0, 40, w / 2, 0); x.fill();
    x.strokeStyle = '#c4d98a'; x.lineWidth = 3; x.beginPath(); x.moveTo(w / 2, 0); x.lineTo(w / 2, h); x.stroke();
    x.clearRect(w * 0.1, 90, 6, 30); x.clearRect(w * 0.82, 160, 6, 36); // torn edges
  }
  const t = tex(c, { aniso });
  return t;
}
export function skyTexture() {
  const c = canvas(8, 256), x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#3f8fd8'); g.addColorStop(0.45, '#8cc4ee'); g.addColorStop(0.5, '#d3e8f2'); g.addColorStop(0.56, '#dde7d6'); g.addColorStop(1, '#cddcc4');
  x.fillStyle = g; x.fillRect(0, 0, 8, 256);
  return tex(c);
}
export function cloudTexture() {
  const c = canvas(256, 128), x = c.getContext('2d');
  for (let i = 0; i < 16; i++) {
    const px = 40 + Math.random() * 176, py = 50 + Math.random() * 30, r = 22 + Math.random() * 26, g = x.createRadialGradient(px, py, 2, px, py, r);
    g.addColorStop(0, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.beginPath(); x.arc(px, py, r, 0, 7); x.fill();
  }
  return tex(c);
}
export function sunTexture() {
  const c = canvas(128, 128), x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 2, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,250,225,1)'); g.addColorStop(0.18, 'rgba(255,240,190,.95)'); g.addColorStop(0.5, 'rgba(255,225,150,.22)'); g.addColorStop(1, 'rgba(255,220,140,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  return tex(c);
}
export function plateTexture(text = 'KL 01 AD 1234') {
  const c = canvas(256, 80), x = c.getContext('2d');
  x.fillStyle = '#f2c400'; x.fillRect(0, 0, 256, 80); x.strokeStyle = '#111'; x.lineWidth = 5; x.strokeRect(3, 3, 250, 74);
  x.fillStyle = '#111'; x.font = 'bold 44px Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 128, 42);
  return tex(c);
}

// Malayalam shaping needs a real font. Returns true only when a Malayalam face loaded.
export async function loadMalayalamFont(timeoutMs = 3500) {
  try {
    if (!document.fonts || !document.fonts.load) return false;
    const load = document.fonts.load('800 40px "Noto Sans Malayalam"', 'പോലീസ് സ്റ്റേഷൻ');
    const faces = await Promise.race([load, new Promise((r) => setTimeout(() => r([]), timeoutMs))]);
    return Array.isArray(faces) && faces.length > 0;
  } catch (e) { return false; }
}

function rr(x, ...a) { if (x.roundRect) x.roundRect(...a); else x.rect(...a); }
function fitText(x, text, maxW, size, weight, family) {
  let s = size;
  for (; s > 14; s -= 2) { x.font = `${weight} ${s}px ${family}`; if (x.measureText(text).width <= maxW) break; }
  return s;
}
export function paintSignAtlas(canvasEl, withMalayalam) {
  const x = canvasEl.getContext('2d'), cw = ATLAS.w / ATLAS.cols, ch = ATLAS.h / ATLAS.rows;
  const ML = '"Noto Sans Malayalam","Manjari","Gayathri","Noto Sans",sans-serif', EN = '"Manrope",Arial,sans-serif';
  x.clearRect(0, 0, ATLAS.w, ATLAS.h);
  SIGNS.forEach((s, i) => {
    const ox = (i % ATLAS.cols) * cw, oy = Math.floor(i / ATLAS.cols) * ch, [bg, fg, ac] = s.style;
    x.save(); x.translate(ox, oy);
    if (s.round) { // round regulatory sign drawn in the centre square
      const cx = cw / 2, cy = ch / 2, R = ch / 2 - 4;
      x.fillStyle = bg; x.beginPath(); x.arc(cx, cy, R, 0, 7); x.fill();
      x.strokeStyle = ac; x.lineWidth = 12; x.beginPath(); x.arc(cx, cy, R - 7, 0, 7); x.stroke();
      x.fillStyle = fg; x.font = `900 ${s.id === 'speed30' ? 58 : 26}px ${EN}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(s.en, cx, cy + 2);
      x.restore(); return;
    }
    x.fillStyle = bg; rr(x, 3, 3, cw - 6, ch - 6, 14); x.fill();
    x.strokeStyle = ac; x.lineWidth = 4; x.beginPath(); rr(x, 9, 9, cw - 18, ch - 18, 10); x.stroke();
    x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle';
    const left = s.emblem ? 92 : 0, mid = left + (cw - left) / 2, maxW = cw - left - 30;
    if (s.emblem) { // simple round emblem (not an official crest)
      x.fillStyle = '#ffffff'; x.beginPath(); x.arc(52, ch / 2, 36, 0, 7); x.fill();
      x.fillStyle = '#1d3f8f'; x.beginPath(); x.arc(52, ch / 2, 29, 0, 7); x.fill();
      x.fillStyle = '#f2c14e'; x.beginPath(); for (let k = 0; k < 10; k++) { const a = (k * Math.PI) / 5 - Math.PI / 2, r = k % 2 ? 9 : 20; x.lineTo(52 + Math.cos(a) * r, ch / 2 + Math.sin(a) * r); } x.fill();
      x.fillStyle = fg;
    }
    if (withMalayalam && s.ml) {
      const ms = fitText(x, s.ml, maxW, 54, 800, ML); x.font = `800 ${ms}px ${ML}`; x.fillText(s.ml, mid, ch * 0.34);
      const es = fitText(x, s.en, maxW, 36, 800, EN); x.font = `800 ${es}px ${EN}`; x.fillText(s.en, mid, ch * 0.74);
    } else {
      const es = fitText(x, s.en, maxW, 62, 800, EN); x.font = `800 ${es}px ${EN}`; x.fillText(s.en, mid, ch / 2 + 2);
    }
    x.restore();
  });
}
export function signAtlasTexture(aniso) {
  const c = canvas(ATLAS.w, ATLAS.h);
  paintSignAtlas(c, false);
  const t = tex(c, { aniso: Math.min(aniso, 8) });
  t.userData = { canvas: c };
  return t;
}
