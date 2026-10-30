// Auto Driver — Kerala: game loop, camera, HUD, minimap, missions, music controls.
import { T } from './three-ref.js';
import { generateWorld } from './map.js';
import { createRenderer, buildScene } from './scene.js';
import { createAuto, createBus, createCar, createPassenger, createDestination } from './vehicles.js';
import { createLorry, createDumpTruck, createJeep, createMaruti, createAmbassador, createTitan, createVespa, DIMS } from './vehicles2.js';
import { createPlayer, stepPlayer, Traffic } from './sim.js';
import { MusicPlayer, CollisionSound } from './audio.js';

export function startGameApp() {
  window.__autoDriverBooted = true;
  const $ = (id) => document.getElementById(id);
  const loadingScreen = $('loading-screen'), menuScreen = $('menu-screen'), gameUI = $('game-ui'), pauseScreen = $('pause-screen'), errorPanel = $('error-panel');
  const isMobile = matchMedia('(pointer:coarse)').matches || /Android|iPhone|iPad/i.test(navigator.userAgent);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  let selectedMode = 'missions', running = false, paused = false, ready = false;
  let world, renderer, scene, camera, sceneApi, player, autoV, traffic, trafficMeshes = [];
  let passenger, destination, money = 0, phase = 'pickup', missionIndex = 0, toastTimer = null;
  let camMode = 0, camHeading = Math.PI, fov = 62, time = 0, quality = 2, perfFrames = 0, perfTime = 0, perfWarm = 0;
  const input = { left: false, right: false, accelerate: false, brake: false, drift: false, steerAxis: 0 };
  let lookYaw = 0, lookPitch = 0, lookIdle = 0, lookDrag = false, smoke = null; // free-look camera + tyre smoke state
  const music = new MusicPlayer();
  const collisionSound = new CollisionSound();

  // ---------------- UI helpers ----------------
  function showToast(text) {
    const el = $('toast'); el.textContent = text; el.classList.add('visible');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('visible'), 2600);
  }
  let npTimer = null;
  function showNowPlaying(s) {
    const el = $('now-playing'); if (!el || !s.playing && !s.muted) return;
    el.textContent = '♫  ' + s.title + '  ·  ' + (s.index + 1) + '/' + s.total + (s.muted ? '  ·  muted' : '');
    el.classList.add('visible'); clearTimeout(npTimer); npTimer = setTimeout(() => el.classList.remove('visible'), 3200);
  }
  let lastIndex = -1;
  music.onChange = (s) => {
    const mb = $('music-button');
    if (mb) { mb.classList.toggle('muted', s.muted); mb.title = s.muted ? 'Unmute music' : 'Mute music'; mb.setAttribute('aria-label', mb.title); }
    if (s.index !== lastIndex || s.muted) { lastIndex = s.index; showNowPlaying(s); }
  };
  music.onMessage = (t) => showToast(t);

  // ---------------- missions ----------------
  const missions = () => world.missions.map((m) => ({ from: { x: m.from[0], z: m.from[1] }, to: { x: m.to[0], z: m.to[1] }, name: m.name, destination: m.destination }));
  let missionList = [];
  const currentMission = () => missionList[missionIndex % missionList.length];
  function updateMission() {
    if (selectedMode === 'free') { $('mission-panel').classList.add('hidden'); passenger.visible = false; destination.visible = false; return; }
    $('mission-panel').classList.remove('hidden');
    const m = currentMission();
    if (phase === 'pickup') {
      $('mission-phase').textContent = 'NEXT PICKUP'; $('mission-title').textContent = 'Passenger at ' + m.name;
      $('mission-subtitle').textContent = 'Stop near the person in yellow.'; $('mission-progress').style.width = '25%';
      passenger.visible = true; passenger.position.set(m.from.x, 0, m.from.z); destination.visible = false;
    } else {
      $('mission-phase').textContent = 'PASSENGER ON BOARD'; $('mission-title').textContent = 'Head to ' + m.destination;
      $('mission-subtitle').textContent = 'Drive into the glowing ring.'; $('mission-progress').style.width = '65%';
      passenger.visible = false; destination.visible = true; destination.position.set(m.to.x, 0, m.to.z);
    }
  }
  function checkMission() {
    if (selectedMode !== 'missions') return;
    const m = currentMission();
    if (phase === 'pickup' && Math.hypot(player.x - m.from.x, player.z - m.from.z) < 4.2 && Math.abs(player.speed) < 5) {
      phase = 'destination'; player.speed = 0; showToast('Passenger aboard! Take them to ' + m.destination + '.'); updateMission();
    } else if (phase === 'destination' && Math.hypot(player.x - m.to.x, player.z - m.to.z) < 4.4 && Math.abs(player.speed) < 7) {
      money += 120 + Math.max(0, Math.round(45 - Math.abs(player.speed)));
      $('money').textContent = money; showToast('Trip complete! ₹' + money + ' in your wallet.');
      missionIndex++; phase = 'pickup'; updateMission();
    }
  }

  // ---------------- minimap ----------------
  let mapBase = null, mapCtx = null;
  const MAP_S = 2, MAP_HALF = 240;
  function prerenderMinimap() {
    mapBase = document.createElement('canvas'); mapBase.width = mapBase.height = MAP_HALF * 2 * MAP_S;
    const x = mapBase.getContext('2d');
    x.fillStyle = '#6f9a58'; x.fillRect(0, 0, mapBase.width, mapBase.height);
    const P = (wx, wz) => [(wx + MAP_HALF) * MAP_S, (wz + MAP_HALF) * MAP_S];
    x.lineCap = 'round'; x.lineJoin = 'round';
    const wMap = { primary: 5, secondary: 4, tertiary: 3.2 };
    for (const pass of [0, 1]) for (const r of world.roads) {
      x.beginPath(); r.pts.forEach(([wx, wz], i) => { const [px, pz] = P(wx, wz); i ? x.lineTo(px, pz) : x.moveTo(px, pz); }); if (r.closed) x.closePath();
      x.lineWidth = ((wMap[r.hw] || 2.2) + (pass ? 0 : 1.4)) * MAP_S; x.strokeStyle = pass ? (r.hw === 'primary' ? '#fff2b8' : '#e9e6dc') : '#2b2f33'; x.stroke();
    }
    const col = { police: '#2d5be3', busstop: '#ffd23f' };
    for (const q of world.minimapRects) { // only the places a driver needs: police station and bus stops
      if (q.type !== 'police' && q.type !== 'busstop') continue;
      const [px, pz] = P(q.x, q.z); x.fillStyle = '#101010'; x.beginPath(); x.arc(px, pz, 4.4 * MAP_S, 0, 7); x.fill();
      x.fillStyle = col[q.type]; x.beginPath(); x.arc(px, pz, 3.2 * MAP_S, 0, 7); x.fill();
    }
    mapCtx = $('minimap').getContext('2d');
  }
  let mapTick = 0;
  function drawMinimap() {
    if (!mapCtx || (++mapTick & 1)) return;
    const W = 264, c = mapCtx, R = 132, k = W / 2 / R;
    c.clearRect(0, 0, W, W); c.save(); c.beginPath(); c.arc(W / 2, W / 2, W / 2 - 2, 0, 7); c.clip();
    c.fillStyle = '#6f9a58'; c.fillRect(0, 0, W, W);
    c.translate(W / 2, W / 2); c.rotate(player.heading + Math.PI); c.scale(k, k);
    c.save(); c.scale(1 / MAP_S, 1 / MAP_S); c.drawImage(mapBase, -(player.x + MAP_HALF) * MAP_S, -(player.z + MAP_HALF) * MAP_S); c.restore();
    const dot = (wx, wz, r, color) => { c.fillStyle = color; c.beginPath(); c.arc(wx - player.x, wz - player.z, r, 0, 7); c.fill(); };
    if (traffic) for (const v of traffic.list) {
      if (Math.hypot(v.x - player.x, v.z - player.z) > 70) continue; // declutter: only vehicles close enough to matter
      const heavy = v.kind === 'bus' || v.kind === 'lorry' || v.kind === 'dump';
      dot(v.x, v.z, heavy ? 2.1 : 1.3, heavy ? '#ff8f00' : '#ffffffcc');
    }
    if (selectedMode === 'missions') {
      const m = currentMission(), t = phase === 'pickup' ? m.from : m.to;
      c.strokeStyle = '#ffd43b'; c.lineWidth = 2.5; c.beginPath(); c.arc(t.x - player.x, t.z - player.z, 6 + Math.sin(time * 5) * 1.2, 0, 7); c.stroke(); dot(t.x, t.z, 3, '#ffd43b');
      const tx = t.x - player.x, tz = t.z - player.z, td = Math.hypot(tx, tz);
      if (td > R * 0.86) { const ux = tx / td, uz = tz / td, ex = ux * R * 0.9, ez = uz * R * 0.9; c.fillStyle = '#ffd43b'; c.strokeStyle = '#101010'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(ex + ux * 7, ez + uz * 7); c.lineTo(ex - ux * 5 - uz * 6, ez - uz * 5 + ux * 6); c.lineTo(ex - ux * 5 + uz * 6, ez - uz * 5 - ux * 6); c.closePath(); c.fill(); c.stroke(); }
    }
    c.restore();
    c.fillStyle = '#fff'; c.strokeStyle = '#111'; c.lineWidth = 2; c.beginPath(); c.moveTo(W / 2, W / 2 - 14); c.lineTo(W / 2 + 9, W / 2 + 10); c.lineTo(W / 2, W / 2 + 5); c.lineTo(W / 2 - 9, W / 2 + 10); c.closePath(); c.fill(); c.stroke();
  }

  // ---------------- init (runs during the loading screen) ----------------
  async function initWorld() {
    const status = (t, p) => { $('loading-status').textContent = t; $('loading-fill').style.width = p + '%'; };
    const frame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
    status('Warming up the engine…', 5); await frame();
    const it = generateWorld(20241); let step, n = 0;
    while (!(step = it.next()).done) { n++; status(step.value, 8 + n * 9); await frame(); }
    world = step.value;
    status('Building the town…', 85); await frame();
    renderer = createRenderer(isMobile);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2));
    document.body.prepend(renderer.domElement);
    bindLook(renderer.domElement);
    camera = new T.PerspectiveCamera(62, innerWidth / innerHeight, 0.3, 700);
    sceneApi = buildScene(renderer, world, isMobile); scene = sceneApi.scene;
    scene.add(camera);
    smoke = createSmoke();
    autoV = createAuto(); scene.add(autoV.root);
    player = createPlayer(world.spawn); camHeading = player.heading;
    passenger = createPassenger(); destination = createDestination(); passenger.visible = destination.visible = false; scene.add(passenger, destination);
    buildTraffic(); prerenderMinimap();
    missionList = missions();
    resize(); status('Ready!', 100); await frame();
    ready = true;
    setTimeout(() => { loadingScreen.classList.add('hidden'); menuScreen.classList.remove('hidden'); }, 250);
  }

  function buildTraffic() {
    const specs = [], colors = [0xf2f2f2, 0xc62828, 0x1e5aa8, 0xb0b4b8, 0x2e7d32, 0xf9a825, 0x6d4c41, 0x212121, 0xf48fb1];
    const add = (route, kind, at, maxSpeed, accel) => {
      const dims = DIMS[kind] || (kind === 'bus' ? [1.3, 5.3] : kind === 'car' ? [0.82, 1.8] : [0.65, 1.35]);
      specs.push({ route, kind, at, maxSpeed, accel, hw: dims[0], hd: dims[1] });
    };
    // Every AI route uses the visible outer road centre-line with lane offsets. The old inner/cross
    // loops cut across scenery, which made vehicles drive through buildings and grass.
    add('ring', 'bus', 0.04, 8.8, 2); add('ring', 'maruti', 0.13, 12, 4); add('ring', 'auto', 0.22, 7.5, 3);
    add('ring', 'jeep', 0.31, 11, 3.5); add('ring', 'titan', 0.39, 13, 4.5); add('ring', 'lorry', 0.48, 8.2, 2.2);
    add('ring', 'amb', 0.6, 10.5, 3.2); add('ring', 'vespa', 0.72, 10, 3.5); add('ring', 'dump', 0.84, 7.6, 2);
    add('inner', 'car', 0.57, 10.5, 3.5); add('inner', 'auto', 0.65, 7.5, 3); add('inner', 'vespa', 0.73, 9.5, 3.5); add('inner', 'jeep', 0.9, 10.5, 3.5);
    add('cross', 'bus', 0.81, 8.5, 2); add('cross', 'lorry', 0.89, 8, 2.2); add('cross', 'maruti', 0.96, 11, 4);
    traffic = new Traffic(world, specs, { x: world.spawn.x, z: world.spawn.z });
    let ci = 0;
    const jeepC = [0xa9aba8, 0xe9e6da, 0x3f5a3a], marC = [0x4a4e55, 0xc62828, 0x1e5aa8, 0xe8e8e8], ambC = [0xf0efe8, 0x1c1c1c, 0xe8dfc0], lorryC = [0xf2b705, 0x1e88c9, 0xd94a2b], vesC = [0x6b7a47, 0xc9b88a, 0x2f6fa8];
    const pick = (arr) => arr[ci++ % arr.length];
    trafficMeshes = traffic.list.map((v) => {
      let m;
      switch (v.kind) {
        case 'bus': m = createBus(sceneApi.aniso); break;
        case 'auto': m = createAuto(); break;
        case 'lorry': m = createLorry(pick(lorryC)); break;
        case 'dump': m = createDumpTruck(); break;
        case 'jeep': m = createJeep(pick(jeepC)); break;
        case 'maruti': m = createMaruti(pick(marC)); break;
        case 'amb': m = createAmbassador(pick(ambC)); break;
        case 'titan': m = createTitan(true); break;
        case 'vespa': m = createVespa(pick(vesC), true); break;
        default: m = createCar(colors[ci++ % colors.length]);
      }
      scene.add(m.root); return m;
    });
  }

  // ---------------- game flow ----------------
  function resize() {
    if (!renderer) return;
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight, false);
  }
  function startGame() {
    window.__continuePortrait = false;
    if (!ready) throw new Error('The town is still loading. Wait a moment and tap again.');
    document.body.classList.add('game-active');
    loadingScreen.classList.add('hidden'); menuScreen.classList.add('hidden'); pauseScreen.classList.add('hidden'); gameUI.classList.remove('hidden');
    $('mode-label').textContent = selectedMode === 'missions' ? 'PASSENGER MISSION' : 'FREE ROAM';
    Object.assign(player, createPlayer(world.spawn)); camHeading = player.heading; resetInput();
    lookYaw = lookPitch = lookIdle = 0; lookDrag = false;
    phase = 'pickup'; updateMission();
    running = true; paused = false; perfWarm = 0;
    showToast(selectedMode === 'free' ? 'Free roam started. Enjoy the drive!' : 'Your passenger is waiting. Find the yellow marker.');
  }
  function backToMenu() {
    running = false; paused = false; music.stop();
    document.body.classList.remove('game-active');
    const ro = $('rotate-overlay'); if (ro) ro.classList.add('hidden');
    exitImmersiveMode(); gameUI.classList.add('hidden'); pauseScreen.classList.add('hidden'); $('settings-screen').classList.add('hidden'); menuScreen.classList.remove('hidden');
  }
  function setPaused(v) {
    paused = v; pauseScreen.classList.toggle('hidden', !paused); $('settings-screen').classList.add('hidden');
    if (paused) music.pause(); else if (running) music.resume();
  }
  function resetInput() {
    Object.keys(input).forEach((k) => (input[k] = k === 'steerAxis' ? 0 : false));
    document.querySelectorAll('.control-button').forEach((b) => b.classList.remove('active'));
    const th = $('steer-thumb'); if (th) th.style.transform = '';
  }
  function cycleCamera() { camMode = (camMode + 1) % 3; showToast('Camera: ' + ['Chase', 'High view', 'Driver view'][camMode]); }


  // ---------------- tyre smoke (drift) ----------------
  function createSmoke() {
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
    const gr = x.createRadialGradient(32, 32, 2, 32, 32, 30); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
    const tex = new T.CanvasTexture(c), pool = [];
    for (let i = 0; i < 36; i++) {
      const m = new T.SpriteMaterial({ map: tex, color: 0xd6d6d6, transparent: true, opacity: 0, depthWrite: false });
      const s = new T.Sprite(m); s.visible = false; scene.add(s);
      pool.push({ s, m, life: 0, max: 1, vx: 0, vy: 0, vz: 0 });
    }
    return { pool, next: 0, acc: 0, side: 1 };
  }
  function updateSmoke(dt) {
    if (!smoke) return;
    const p = player;
    if (p.driftAmt > 0.35 && p.speed > 5) {
      smoke.acc += dt * 28;
      const fx = Math.sin(p.heading), fz = Math.cos(p.heading), lx = Math.cos(p.heading), lz = -Math.sin(p.heading);
      while (smoke.acc >= 1) {
        smoke.acc -= 1; smoke.side = -smoke.side;
        const q = smoke.pool[smoke.next++ % smoke.pool.length];
        q.s.position.set(p.x - fx * 0.62 + lx * 0.68 * smoke.side, 0.3, p.z - fz * 0.62 + lz * 0.68 * smoke.side);
        q.max = q.life = 0.9 + Math.random() * 0.5; q.vx = (Math.random() - 0.5) * 0.8; q.vy = 0.5 + Math.random() * 0.5; q.vz = (Math.random() - 0.5) * 0.8;
        q.s.visible = true;
      }
    }
    for (const q of smoke.pool) {
      if (q.life <= 0) continue;
      q.life -= dt;
      if (q.life <= 0) { q.s.visible = false; continue; }
      const t = 1 - q.life / q.max;
      q.s.position.x += q.vx * dt; q.s.position.y += q.vy * dt; q.s.position.z += q.vz * dt;
      q.s.scale.setScalar(0.8 + t * 2.6); q.m.opacity = (1 - t) * 0.5;
    }
  }

  // ---------------- free-look: drag the screen to look around ----------------
  function bindLook(el) {
    let id = null, lx = 0, ly = 0;
    el.style.touchAction = 'none';
    el.addEventListener('pointerdown', (e) => {
      if (!running || paused || id !== null) return;
      id = e.pointerId; lx = e.clientX; ly = e.clientY; lookDrag = true; lookIdle = 0;
      try { el.setPointerCapture(id); } catch (x) { /* ignore */ }
    });
    el.addEventListener('pointermove', (e) => {
      if (e.pointerId !== id) return;
      lookYaw += (e.clientX - lx) * 0.006; lookPitch += (e.clientY - ly) * 0.005; lx = e.clientX; ly = e.clientY;
      while (lookYaw > Math.PI) lookYaw -= 2 * Math.PI; while (lookYaw < -Math.PI) lookYaw += 2 * Math.PI;
      lookPitch = camMode === 2 ? clamp(lookPitch, -0.5, 0.7) : clamp(lookPitch, -0.2, 1.0);
      lookIdle = 0;
    });
    const end = (e) => { if (e.pointerId !== id) return; id = null; lookDrag = false; lookIdle = 0; };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end); el.addEventListener('lostpointercapture', end);
  }

  // ---------------- steering slider (touch) ----------------
  function bindSteerPad() {
    const pad = $('steer-pad'), thumb = $('steer-thumb'); if (!pad || !thumb) return;
    let id = null;
    const setAxis = (clientX) => {
      const r = pad.getBoundingClientRect(), half = r.width / 2 - 29, off = clamp(clientX - (r.left + r.width / 2), -half, half);
      let a = off / half; const dz = 0.06;
      a = Math.abs(a) < dz ? 0 : Math.sign(a) * (Math.abs(a) - dz) / (1 - dz);
      a = Math.sign(a) * Math.pow(Math.abs(a), 1.25); // finer control near the centre
      input.steerAxis = -a; // slider right = steer right (the sim treats +1 as left)
      thumb.style.transform = 'translateX(' + off + 'px)';
    };
    const release = (e) => { if (e.pointerId !== id) return; id = null; input.steerAxis = 0; thumb.style.transform = ''; pad.classList.remove('active'); };
    pad.addEventListener('pointerdown', (e) => {
      e.preventDefault(); if (id !== null) return; id = e.pointerId; pad.classList.add('active');
      try { pad.setPointerCapture(id); } catch (x) { /* ignore */ } setAxis(e.clientX);
    });
    pad.addEventListener('pointermove', (e) => { if (e.pointerId === id) { e.preventDefault(); setAxis(e.clientX); } });
    pad.addEventListener('pointerup', release); pad.addEventListener('pointercancel', release); pad.addEventListener('lostpointercapture', release);
    pad.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  // ---------------- per-frame ----------------
  const angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
  function update(dt) {
    time += dt;
    const boxes = traffic.boxes();
    stepPlayer(player, input, dt, world, boxes);
    traffic.update(dt, player);
    for (const o of boxes) if (o.hitByPlayer) {
      o.owner.hitTimer = 0.8;
      // Play the impact effect only for heavy vehicles (buses, lorries, tippers).
      if (['bus', 'lorry', 'dump'].includes(o.owner.kind)) collisionSound.playBusImpact(Math.min(1, Math.abs(player.speed) / 14));
      o.hitByPlayer = false;
    }
    checkMission();
    // player visuals
    const a = autoV;
    a.root.position.set(player.x, 0, player.z); a.root.rotation.y = player.heading;
    const spd = Math.abs(player.speed), buzz = Math.sin(time * 46) * 0.004 * Math.min(1, spd / 6);
    a.body.rotation.x = player.pitch; a.body.rotation.z = -player.roll; a.body.position.y = buzz + Math.sin(time * 30) * player.kick * 0.05;
    a.fork.rotation.y = player.delta; a.bar.rotation.y = player.delta * 1.1;
    const spin = (player.speed * dt) / a.wheelR; a.spin.forEach((w) => { w.rotation.x += spin; });
    // traffic visuals (hidden when far away)
    traffic.list.forEach((v, i) => {
      const m = trafficMeshes[i], d = Math.hypot(v.x - player.x, v.z - player.z);
      m.root.visible = d < 170; if (!m.root.visible) return;
      m.root.position.set(v.x, 0, v.z); m.root.rotation.y = v.heading;
      const sp = (v.speed * dt) / m.wheelR; m.spin.forEach((w) => { if (w) w.rotation.x += sp; });
    });
    if (destination.visible) { destination.userData.ring.scale.setScalar(1 + Math.sin(time * 4) * 0.06); destination.rotation.y += dt * 0.8; }
    if (passenger.visible) passenger.position.y = Math.abs(Math.sin(time * 3)) * 0.08;
    updateSmoke(dt);
    updateCamera(dt);
    $('speed').textContent = Math.round(spd * 3.1);
    if (selectedMode === 'missions' && !(mapTick & 7)) { const m = currentMission(), t = phase === 'pickup' ? m.from : m.to, dm = Math.round(Math.hypot(t.x - player.x, t.z - player.z) * 55 / 10) * 10, el = $('mission-dist'); if (el) el.textContent = dm >= 1000 ? (dm / 1000).toFixed(1) + ' km' : dm + ' m'; }
    sceneApi.update(dt, camera, player);
    drawMinimap();
  }
  function updateCamera(dt) {
    const p = player, sp = Math.abs(p.speed), fx = Math.sin(p.heading), fz = Math.cos(p.heading);
    const targetFov = (innerWidth / innerHeight < 1 ? 74 : 62) + clamp(sp / 29, 0, 1) * 7 + p.hit * 2 + (p.driftAmt || 0) * 3;
    fov += (targetFov - fov) * (1 - Math.exp(-dt * 4)); camera.fov = fov; camera.updateProjectionMatrix();
    // free-look eases back behind the vehicle about 1.5 s after the finger is lifted
    if (!lookDrag) {
      lookIdle += dt;
      if (lookIdle > 1.5) { const k = 1 - Math.exp(-dt * 4); lookYaw -= lookYaw * k; lookPitch -= lookPitch * k; }
    }
    const lookBlend = clamp((Math.abs(lookYaw) + Math.abs(lookPitch)) * 2.5, 0, 1);
    if (camMode === 2) { // driver view, inside the cab (drag to look around)
      const ang = p.heading + lookYaw, sx = -Math.cos(p.heading) * p.steer * 1.5 * (1 - lookBlend), sz = Math.sin(p.heading) * p.steer * 1.5 * (1 - lookBlend);
      camera.position.set(p.x + fx * 0.05, 1.48 + p.pitch * 2, p.z + fz * 0.05);
      camera.lookAt(p.x + Math.sin(ang) * 25 + sx, 1.35 + p.pitch * 6 + Math.tan(lookPitch) * 25, p.z + Math.cos(ang) * 25 + sz);
      return;
    }
    // chase camera trails the heading with a gentle lag so steering never feels twitchy; in a drift it leans toward the travel direction
    const follow = p.heading - (p.slip || 0) * 0.7;
    camHeading += angDiff(camHeading, follow) * (1 - Math.exp(-dt * (p.speed < -1 ? 8 : 3.4)));
    const far = camMode === 1, dist = (far ? 14 : 8.2) + sp * (far ? 0.08 : 0.05), h = (far ? 8.5 : 3.6) + sp * 0.02;
    const ang = camHeading + lookYaw, hd = dist * Math.cos(lookPitch), hy = Math.max(0.6, h + dist * Math.sin(lookPitch));
    const cx = p.x - Math.sin(ang) * hd, cz = p.z - Math.cos(ang) * hd;
    const k = 1 - Math.exp(-dt * (lookDrag ? 30 : 9));
    camera.position.x += (cx - camera.position.x) * k; camera.position.z += (cz - camera.position.z) * k; camera.position.y += (hy - camera.position.y) * k;
    const ahead = 6 * (1 - lookBlend);
    camera.lookAt(p.x + Math.sin(camHeading) * ahead, 1.3, p.z + Math.cos(camHeading) * ahead);
  }
  function adaptQuality(dt) { // lower resolution / shadows automatically on slow phones
    perfWarm += dt; if (perfWarm < 3) return;
    perfFrames++; perfTime += dt;
    if (perfFrames >= 90) {
      const avg = perfTime / perfFrames; perfFrames = 0; perfTime = 0;
      if (avg > 0.034 && quality > 0) {
        quality--;
        if (quality === 1) renderer.setPixelRatio(1);
        if (quality === 0) { renderer.setPixelRatio(0.75); sceneApi.sun.castShadow = false; }
        resize();
      }
    }
  }
  let last = performance.now();
  function animate(now) {
    requestAnimationFrame(animate);
    const dt = Math.min((now - last) / 1000, 0.04); last = now;
    updateRotatePrompt();
    if (!ready || !running || document.hidden) return;
    if (!paused) { update(dt); adaptQuality(dt); }
    renderer.render(scene, camera);
  }

  // ---------------- fullscreen / orientation ----------------
  async function requestImmersiveMode() {
    try { if (!document.fullscreenElement && document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen(); } catch (e) { /* optional */ }
    try { if (screen.orientation && screen.orientation.lock) await screen.orientation.lock('landscape'); } catch (e) { /* optional */ }
    updateRotatePrompt();
  }
  function updateRotatePrompt() {
    const overlay = $('rotate-overlay'); if (!overlay) return;
    const mobile = matchMedia('(max-width: 900px)').matches, portrait = matchMedia('(orientation: portrait)').matches;
    overlay.classList.toggle('hidden', !(running && mobile && portrait && window.__continuePortrait !== true));
  }
  function exitImmersiveMode() {
    try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch (e) { /* optional */ }
    try { if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen(); } catch (e) { /* optional */ }
  }

  // ---------------- controls ----------------
  function bindControls() {
    bindSteerPad();
    document.querySelectorAll('[data-mode]').forEach((btn) => btn.addEventListener('click', () => {
      selectedMode = btn.dataset.mode; document.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('selected', b === btn));
    }));
    $('start-button').addEventListener('click', () => {
      music.start(); // inside the tap, so the browser allows audio
      collisionSound.unlock(); // unlock collision sound audio from the same user gesture
      try { startGame(); } catch (err) {
        console.error('Could not start the game:', err);
        errorPanel.textContent = 'The game could not start: ' + (err && err.message ? err.message : String(err)); errorPanel.classList.remove('hidden'); music.stop(); return;
      }
      requestImmersiveMode().catch(() => {});
    });
    $('music-button').addEventListener('click', () => music.toggleMute());
    $('next-song').addEventListener('click', () => music.next());
    $('prev-song').addEventListener('click', () => music.prev());
    $('camera-button').addEventListener('click', cycleCamera);
    $('fullscreen-button').addEventListener('click', requestImmersiveMode);
    $('continue-portrait').addEventListener('click', () => { window.__continuePortrait = true; $('rotate-overlay').classList.add('hidden'); });
    document.addEventListener('fullscreenchange', resize);
    window.addEventListener('orientationchange', () => setTimeout(() => { resize(); updateRotatePrompt(); }, 180));
    window.addEventListener('resize', () => { resize(); updateRotatePrompt(); });
    $('pause-button').addEventListener('click', () => setPaused(true));
    $('resume-button').addEventListener('click', () => setPaused(false));
    $('menu-button').addEventListener('click', backToMenu);
    $('settings-button').addEventListener('click', () => { pauseScreen.classList.add('hidden'); $('settings-screen').classList.remove('hidden'); });
    $('close-settings-button').addEventListener('click', () => { $('settings-screen').classList.add('hidden'); pauseScreen.classList.remove('hidden'); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) { if (running) music.pause(); } else if (running && !paused) music.resume(); });
    window.addEventListener('pagehide', () => music.pause());
    document.addEventListener('touchmove', (e) => { if (running) e.preventDefault(); }, { passive: false });
    window.addEventListener('keydown', (e) => {
      const key = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) e.preventDefault();
      if (key === 'w' || key === 'arrowup') input.accelerate = true;
      if (key === 's' || key === 'arrowdown') input.brake = true;
      if (key === 'a' || key === 'arrowleft') input.left = true;
      if (key === 'd' || key === 'arrowright') input.right = true;
      if (key === ' ') input.drift = true;
      if (!running || e.repeat) return;
      if (key === 'escape') setPaused(!paused);
      if (key === 'n') music.next();
      if (key === 'p') music.prev();
      if (key === 'm') music.toggleMute();
      if (key === 'c') cycleCamera();
    }, { passive: false });
    window.addEventListener('keyup', (e) => {
      const key = e.key.toLowerCase();
      if (key === 'w' || key === 'arrowup') input.accelerate = false;
      if (key === 's' || key === 'arrowdown') input.brake = false;
      if (key === 'a' || key === 'arrowleft') input.left = false;
      if (key === 'd' || key === 'arrowright') input.right = false;
      if (key === ' ') input.drift = false;
    });
    document.querySelectorAll('[data-control]').forEach((btn) => {
      const control = btn.dataset.control;
      const press = (e) => { e.preventDefault(); input[control] = true; btn.classList.add('active'); if (navigator.vibrate) navigator.vibrate(control === 'drift' ? 14 : 7); try { btn.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ } };
      const release = (e) => { e.preventDefault(); input[control] = false; btn.classList.remove('active'); };
      btn.addEventListener('pointerdown', press); btn.addEventListener('pointerup', release); btn.addEventListener('pointercancel', release); btn.addEventListener('lostpointercapture', release);
      btn.addEventListener('contextmenu', (e) => e.preventDefault());
    });
    window.addEventListener('blur', resetInput);
  }

  window.addEventListener('error', (e) => { errorPanel.classList.remove('hidden'); errorPanel.textContent = 'The game encountered an error:\n' + (e.message || 'Unknown error') + '\n\nTry opening this site in Chrome and check your internet connection.'; });
  window.addEventListener('unhandledrejection', (e) => { const r = e.reason; if (r && (r.name === 'AbortError' || r.name === 'NotAllowedError')) return; errorPanel.classList.remove('hidden'); errorPanel.textContent = 'Something went wrong:\n' + (r?.message || r || 'Unknown error'); });
  bindControls();
  requestAnimationFrame(animate);
  initWorld().catch((err) => {
    console.error(err);
    $('loading-status').textContent = 'Could not build the town'; loadingScreen.classList.add('hidden'); menuScreen.classList.remove('hidden');
    errorPanel.classList.remove('hidden'); errorPanel.textContent = 'Could not build the town: ' + (err && err.message ? err.message : err);
  });
}
