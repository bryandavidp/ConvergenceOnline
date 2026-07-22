/* Regresión de estabilidad de render / presupuesto de capas del compositor
 * (docs/RENDER_STABILITY_PLAN.md). Fija las correcciones del parpadeo a negro en Android
 * hi-dpi: sin filter animado sobre el tablero (RS-1), sin mix-blend-mode en el patrón del
 * tablero (RS-2), sin will-change permanente en el pool de la tienda (RS-3), decoding async
 * en imágenes (RS-5) y arranque conservador del gobernador en táctil hi-dpi (RS-7). */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

require('./dom-stub.js');
require('../game.js');

const cv = globalThis.window.__cv;
const { Perf } = cv;

const css = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');
const gamejs = fs.readFileSync(path.join(__dirname, '..', 'game.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

test('RS-1: la Fiebre no anima filter sobre todo el tablero (solo transform)', () => {
  const m = css.match(/@keyframes fever-burst \{[\s\S]*?\n\}/);
  assert.ok(m, 'debe existir @keyframes fever-burst');
  assert.ok(!/filter/.test(m[0]), 'fever-burst no debe animar filter (re-rasteriza full-board)');
  assert.ok(/transform:\s*scale/.test(m[0]), 'conserva el zoom del espectáculo');
  const out = css.match(/@keyframes fever-out \{[\s\S]*?\}/);
  assert.ok(out && !/filter/.test(out[0]), 'fever-out tampoco anima filter');
});

test('RS-2: el patrón del tablero ya no usa mix-blend-mode (grupo aislado + readback)', () => {
  const m = css.match(/\.board-wrap::before \{[\s\S]*?\n\}/);
  assert.ok(m, 'debe existir .board-wrap::before');
  // Ignorar comentarios (el texto explicativo menciona la propiedad a propósito).
  const body = m[0].replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(!/mix-blend-mode\s*:/.test(body), '.board-wrap::before no debe declarar mix-blend-mode');
});

test('RS-3: el pool de la tienda no tiene will-change permanente', () => {
  const m = css.match(/\.shop-fx > span \{[^}]*\}/);
  assert.ok(m, 'debe existir .shop-fx > span');
  assert.ok(!/will-change/.test(m[0]), '.shop-fx > span no debe declarar will-change permanente');
});

test('RS-5: las imágenes decodifican en async (helper icon + index.html)', () => {
  assert.ok(/const icon =[^\n]*decoding="async"/.test(gamejs), 'el helper icon() emite decoding="async"');
  const imgs = html.match(/<img\b/g) || [];
  const withDecoding = html.match(/<img decoding="async"/g) || [];
  assert.ok(imgs.length > 0, 'hay imágenes en index.html');
  assert.equal(withDecoding.length, imgs.length, 'TODAS las <img> de index.html llevan decoding="async"');
});

test('RS-7: arranque conservador en táctil de alta densidad (dpr≥2)', () => {
  const dprBak = window.devicePixelRatio, mtpBak = navigator.maxTouchPoints;
  window.devicePixelRatio = 2; navigator.maxTouchPoints = 1;
  Perf.init();
  assert.equal(Perf.level, 1, 'táctil con dpr≥2 arranca en nivel 1 (antes solo dpr≥3)');
  // Escritorio sin táctil sigue arrancando en 0.
  navigator.maxTouchPoints = 0; window.devicePixelRatio = 1;
  Perf.init();
  assert.equal(Perf.level, 0, 'escritorio arranca en nivel 0');
  window.devicePixelRatio = dprBak; navigator.maxTouchPoints = mtpBak;
});

test('RS-7: dispositivo de poca RAM arranca conservador aunque el dpr sea bajo', () => {
  const dprBak = window.devicePixelRatio, mtpBak = navigator.maxTouchPoints, memBak = navigator.deviceMemory;
  window.devicePixelRatio = 1; navigator.maxTouchPoints = 1; navigator.deviceMemory = 2;
  Perf.init();
  assert.equal(Perf.level, 1, 'táctil con deviceMemory≤4 arranca en nivel 1');
  window.devicePixelRatio = dprBak; navigator.maxTouchPoints = mtpBak; navigator.deviceMemory = memBak;
});
