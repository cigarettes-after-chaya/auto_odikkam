// Boot loader: fetch Three.js from a CDN (with fallbacks and timeouts so a stalled network never
// freezes the loading screen), then start the game modules.
import { setThree } from './three-ref.js';

const withTimeout = (promise, ms, label) => Promise.race([
  promise,
  new Promise((_, reject) => setTimeout(() => reject(new Error(label + ' timed out')), ms))
]);

(async function bootGame() {
  try {
    let THREE;
    try {
      THREE = await withTimeout(import('https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js'), 7000, 'jsDelivr');
    } catch (firstError) {
      try {
        THREE = await withTimeout(import('https://unpkg.com/three@0.164.1/build/three.module.js'), 7000, 'unpkg');
      } catch (secondError) {
        THREE = await withTimeout(import('https://esm.sh/three@0.164.1'), 7000, 'esm.sh');
      }
    }
    setThree(THREE);
    window.__autoDriverEngineLoaded = true;
    const game = await import('./game.js');
    game.startGameApp();
  } catch (engineError) {
    window.__autoDriverEngineFailed = true;
    const status = document.getElementById('loading-status');
    const fill = document.getElementById('loading-fill');
    const panel = document.getElementById('error-panel');
    const loading = document.getElementById('loading-screen');
    const menu = document.getElementById('menu-screen');
    if (status) status.textContent = '3D engine failed to load';
    if (fill) { fill.style.width = '100%'; fill.style.background = '#ffcc33'; }
    if (loading) loading.classList.add('hidden');
    if (menu) menu.classList.remove('hidden');
    if (panel) {
      panel.classList.remove('hidden');
      panel.textContent = 'The game could not start. If this says a CDN timed out, check your connection, open the site in Chrome and reload. Technical detail: ' + (engineError?.message || engineError);
    }
  }
})();
