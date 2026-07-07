/* Sonda de rendimiento (QP-2, ver docs/QA_PERF_PLAN.md §3).
 * Uso: servir la app (python3 -m http.server 8080) y `node tools/perf-probe.js`.
 * Requiere `playwright` disponible para Node (tooling de desarrollo; el repo
 * sigue sin package.json a propósito).
 *
 * Medición de rendimiento con CPU emulada de móvil (throttling ×6 vía CDP).
 * Mide FPS reales del rAF durante juego activo de Supervivencia (con fiebre y
 * confeti forzados) en 3 configuraciones: normal, reduced-fx, y normal sin
 * animaciones ambientales del tablero. También cuenta animaciones CSS/WAAPI vivas. */
const { chromium } = require('playwright');

async function measure(page, label, secs = 6) {
  return await page.evaluate(async ({ label, secs }) => {
    const cv = window.__cv;
    // bot-lite: una convergencia válida cada ~350ms para generar carga real de FX
    const bot = setInterval(() => {
      if (cv.State.status !== 'playing') return;
      for (let i = 0; i < 64; i++) {
        if (cv.State.board[i] === null && !cv.State.tiles[i] && cv.Engine.converging(i).length >= 2) { cv.Game.activate(i); return; }
      }
    }, 350);
    // forzar picos: fiebre + confeti periódico
    cv.State.combo = 12; cv.State.comboAt = performance.now();
    cv.Render.fever(true); cv.FX.confetti(80);
    const conf = setInterval(() => cv.FX.confetti(60), 1500);
    let frames = 0; let long = 0; let last = performance.now();
    const t0 = performance.now();
    await new Promise((res) => {
      function tick(t) {
        frames++;
        if (t - last > 34) long++; // frame >2× presupuesto de 60Hz
        last = t;
        if (t - t0 < secs * 1000) requestAnimationFrame(tick); else res();
      }
      requestAnimationFrame(tick);
    });
    clearInterval(bot); clearInterval(conf);
    const fps = (frames / secs).toFixed(1);
    const anims = document.getAnimations().length;
    return { label, fps: +fps, longFrames: long, liveAnimations: anims, fxCap: cv.FX.cap };
  }, { label, secs });
}

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 }); // gama media iOS aprox.
  await page.goto('http://localhost:8080/index.html?dev', { waitUntil: 'load' });
  await page.waitForTimeout(600);

  const results = [];
  // 1) Configuración normal
  await page.evaluate(() => window.__cv.Game.start('supervivencia', 'normal'));
  await page.waitForTimeout(400);
  results.push(await measure(page, 'normal (CPU ×6)'));

  // 2) reduced-fx activo
  await page.evaluate(() => { document.body.classList.add('reduced-fx'); window.__cv.Settings.reducedFx = true; });
  await page.evaluate(() => window.__cv.Game.start('supervivencia', 'normal'));
  await page.waitForTimeout(400);
  results.push(await measure(page, 'reduced-fx (CPU ×6)'));

  // 3) normal pero sin animación ambiental del tablero ni pulsos infinitos de tiles
  await page.evaluate(() => {
    document.body.classList.remove('reduced-fx'); window.__cv.Settings.reducedFx = false;
    const st = document.createElement('style');
    st.textContent = '.board-wrap::before,.board-thumb::before{animation:none!important}' +
      '.cell.tile-bonus,.cell.tile-portal,.cell.tile-magicbox,.cell.tile-bomb,.cell.tile-slowdown,.cell.tile-timecap{animation:none!important}' +
      '.cell.tile-slowdown::after,.cell.tile-timecap::after{animation:none!important}';
    document.head.appendChild(st);
  });
  await page.evaluate(() => window.__cv.Game.start('supervivencia', 'normal'));
  await page.waitForTimeout(400);
  results.push(await measure(page, 'normal sin ambientales (CPU ×6)'));

  // 4) referencia sin throttling
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await page.evaluate(() => window.__cv.Game.start('supervivencia', 'normal'));
  await page.waitForTimeout(400);
  results.push(await measure(page, 'normal (CPU ×1, referencia PC)'));

  console.log(JSON.stringify(results, null, 2));
  await browser.close();
})().catch((e) => { console.error('PERF FAILED:', e); process.exit(2); });
