// Turns the generated world data into a THREE scene: sky, lights, ground, merged town meshes.
import { T } from './three-ref.js';
import * as TX from './textures.js';
import { addBuffers } from './meshutil.js';

export function createRenderer(isMobile) {
  const renderer = new T.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.domElement.id = 'game-canvas';
  return renderer;
}

export function buildScene(renderer, world, isMobile) {
  const aniso = Math.min(renderer.capabilities.getMaxAnisotropy(), isMobile ? 4 : 8);
  const scene = new T.Scene();
  scene.fog = new T.Fog(0xcfe3ea, 90, 330);
  const skyTex = TX.skyTexture();
  scene.background = new T.Color(0xcfe3ea);

  // lights: soft sky/ground fill + sun with shadows that follow the player
  scene.add(new T.HemisphereLight(0xdff0ff, 0x6b7a50, 1.15));
  const sun = new T.DirectionalLight(0xfff0d2, 2.7);
  sun.castShadow = true;
  const sm = isMobile ? 1024 : 2048;
  sun.shadow.mapSize.set(sm, sm);
  const sc = sun.shadow.camera; sc.left = -58; sc.right = 58; sc.top = 58; sc.bottom = -58; sc.near = 1; sc.far = 260; sc.updateProjectionMatrix();
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.05;
  scene.add(sun, sun.target);
  const sunDir = new T.Vector3(-0.45, 0.78, 0.42).normalize();

  // image-based light from a small sky scene, so glass/paint/chrome reflect something
  try {
    const pm = new T.PMREMGenerator(renderer), es = new T.Scene();
    es.add(new T.Mesh(new T.SphereGeometry(10, 16, 8), new T.MeshBasicMaterial({ map: skyTex, side: T.BackSide })));
    scene.environment = pm.fromScene(es, 0.04).texture; scene.environmentIntensity = 0.55; pm.dispose();
  } catch (e) { console.warn('Environment map skipped:', e); }

  // sky dome, sun glow and drifting clouds
  const dome = new T.Mesh(new T.SphereGeometry(520, 24, 16), new T.MeshBasicMaterial({ map: skyTex, side: T.BackSide, fog: false, depthWrite: false }));
  dome.renderOrder = -10; scene.add(dome);
  const glow = new T.Sprite(new T.SpriteMaterial({ map: TX.sunTexture(), fog: false, depthWrite: false, transparent: true }));
  glow.scale.set(120, 120, 1); glow.renderOrder = -9; scene.add(glow);
  const clouds = [], cloudMap = TX.cloudTexture();
  for (let i = 0; i < 12; i++) {
    const s = new T.Sprite(new T.SpriteMaterial({ map: cloudMap, fog: false, depthWrite: false, transparent: true, opacity: 0.85 }));
    const a = Math.random() * 6.283, r = 160 + Math.random() * 280;
    s.position.set(Math.cos(a) * r, 120 + Math.random() * 80, Math.sin(a) * r); s.scale.set(150 + Math.random() * 120, 70 + Math.random() * 40, 1);
    s.renderOrder = -8; scene.add(s); clouds.push(s);
  }

  // textures + materials for generated geometry (keys match the Builder keys)
  const grass = TX.grassTexture(aniso), asphalt = TX.asphaltTexture(aniso);
  const frond = TX.leafTexture('palm', aniso), bleaf = TX.leafTexture('banana', aniso);
  const paving = TX.pavingTexture(aniso); paving.repeat.set(17, 11);
  const atlas = TX.signAtlasTexture(aniso);
  const std = (o) => new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0, ...o });
  const road = (o) => std({ polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, ...o });
  const materials = {
    paint: std({}), wood: std({ roughness: 0.7 }), fabric: std({ roughness: 1, side: T.DoubleSide }),
    metal: std({ roughness: 0.45, metalness: 0.55 }),
    glass: std({ roughness: 0.08, metalness: 0.3, transparent: true, opacity: 0.6, depthWrite: false }),
    lamp: new T.MeshBasicMaterial({ vertexColors: true }),
    roof: std({ map: TX.roofTileTexture(aniso), roughness: 0.75, side: T.DoubleSide }),
    frond: std({ map: frond, alphaTest: 0.5, side: T.DoubleSide, roughness: 0.7 }),
    banana: std({ map: bleaf, alphaTest: 0.5, side: T.DoubleSide, roughness: 0.7 }),
    signs: std({ map: atlas, roughness: 0.55 }),
    paving: std({ map: paving, roughness: 0.9 }),
    paddy: std({ roughness: 0.95 }),
    water: new T.MeshStandardMaterial({ color: 0x2c8ea0, roughness: 0.12, metalness: 0.25, vertexColors: true }),
    asphalt: road({ map: asphalt, roughness: 0.95 }),
    soil: road({ color: 0xa4764f, roughness: 1, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
    drain: road({ map: TX.concreteTexture(aniso, '#6f716f'), roughness: 0.95, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }),
    kerb: std({ map: TX.concreteTexture(aniso, '#c7c4bb'), roughness: 0.9 }),
    walk: std({ map: TX.concreteTexture(aniso, '#b5b2a9'), roughness: 0.92 }),
    mark: road({ color: 0xf2f0e6, roughness: 0.7, polygonOffsetFactor: -5, polygonOffsetUnits: -5 }),
    markYellow: road({ color: 0xf2c230, roughness: 0.7, polygonOffsetFactor: -5, polygonOffsetUnits: -5 })
  };
  materials.paddy.userData.noShadow = true; materials.water.userData.noShadow = true; materials.glass.userData.noShadow = true;
  [materials.asphalt, materials.soil, materials.drain, materials.mark, materials.markYellow].forEach((m) => { m.userData.noShadow = true; });

  // ground
  grass.repeat.set(180, 180);
  const ground = new T.Mesh(new T.PlaneGeometry(1440, 1440), new T.MeshStandardMaterial({ map: grass, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

  const town = new T.Group(); scene.add(town);
  addBuffers(town, world.roadBuffers, materials, { cast: false, receive: true });
  addBuffers(town, world.buffers, materials, { cast: true, receive: true });

  // overhead cables
  if (world.cables.length) {
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(world.cables, 3));
    scene.add(new T.LineSegments(g, new T.LineBasicMaterial({ color: 0x15181a })));
  }
  // distant green hills ring the town; fog softens them
  const hillMat = new T.MeshStandardMaterial({ color: 0x5f8f57, roughness: 1 });
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * 6.283 + Math.sin(i * 7.3) * 0.12, r = 300 + ((i * 37) % 50), h = new T.Mesh(new T.SphereGeometry(1, 14, 8), hillMat), s = 55 + ((i * 53) % 40);
    h.scale.set(s * 1.6, s * 0.4, s * 1.6); h.position.set(Math.cos(a) * r, -s * 0.12, Math.sin(a) * r); scene.add(h);
  }

  // Malayalam shop signs: redraw the atlas once a Malayalam font is confirmed loaded
  TX.loadMalayalamFont().then((ok) => { if (ok) { TX.paintSignAtlas(atlas.userData.canvas, true); atlas.needsUpdate = true; } });

  const update = (dt, cam, player) => {
    dome.position.copy(cam.position);
    glow.position.copy(cam.position).addScaledVector(sunDir, 440);
    for (const c of clouds) { c.position.x += dt * 1.2; if (c.position.x > 460) c.position.x = -460; }
    sun.position.set(player.x + sunDir.x * 90, sunDir.y * 90, player.z + sunDir.z * 90);
    sun.target.position.set(player.x, 0, player.z); sun.target.updateMatrixWorld();
  };
  return { scene, sun, materials, update, aniso };
}
