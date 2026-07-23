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

const { makeEl } = require('./dom-stub.js');
require('../game.js');

const cv = globalThis.window.__cv;
const { Perf, Render } = cv;

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

test('RS-4: los pulsos de celda concurrentes se acotan (tope por nivel del gobernador)', () => {
  Render.cells = Array.from({ length: 64 }, () => makeEl('div'));
  // Nivel 0: tope 28. Una "cascada" de 64 celdas no debe promover más de 28 capas a la vez.
  Perf.level = 0; Render._pulseActive = 0;
  for (let i = 0; i < 64; i++) Render.cellPulse(i, 'bomb-cleared', 700);
  assert.ok(Render._pulseActive <= 28, `nivel 0: ${Render._pulseActive} pulsos activos <= 28`);
  assert.ok(Render._pulseActive >= 20, 'sí llega a pulsar un lote grande (no se queda corto)');
  // Nivel 2 (gama baja / bajo presión): tope 10.
  Perf.level = 2; Render._pulseActive = 0;
  for (let i = 0; i < 64; i++) Render.cellPulse(i, 'bomb-cleared', 700);
  assert.ok(Render._pulseActive <= 10, `nivel 2: ${Render._pulseActive} pulsos activos <= 10`);
  Perf.level = 0; Render._pulseActive = 0;
});

test('RS-10: spawnAnim usa WAAPI (sin reflujo por celda ni clase .spawn)', () => {
  let animated = 0;
  const g = makeEl('span');
  g.getAnimations = () => [];
  g.animate = () => { animated++; return { cancel() { }, onfinish: null, oncancel: null }; };
  const cell = makeEl('button');
  Render.cells = [cell]; Render.glyphs = [g];
  Render.spawnAnim(0);
  assert.equal(animated, 1, 'anima el glifo por WAAPI (arranca sin reflujo)');
  assert.ok(!cell.classList.contains('spawn'), 'ya NO añade la clase .spawn que reiniciaba la animación CSS con void offsetWidth');
});

test('RS-7: dispositivo de poca RAM arranca conservador aunque el dpr sea bajo', () => {
  const dprBak = window.devicePixelRatio, mtpBak = navigator.maxTouchPoints, memBak = navigator.deviceMemory;
  window.devicePixelRatio = 1; navigator.maxTouchPoints = 1; navigator.deviceMemory = 2;
  Perf.init();
  assert.equal(Perf.level, 1, 'táctil con deviceMemory≤4 arranca en nivel 1');
  window.devicePixelRatio = dprBak; navigator.maxTouchPoints = mtpBak; navigator.deviceMemory = memBak;
});

/* ===== Grupo A (Supervivencia bajo estrés) — RS-11 / RS-12 ===== */

test('A1 (RS-11): el pulso de frenesí no anima filter sobre el tablero (solo transform)', () => {
  const m = css.match(/@keyframes surv-frenzy-pulse \{[^\n]*\}/);
  assert.ok(m, 'existe @keyframes surv-frenzy-pulse');
  assert.ok(!/filter/.test(m[0]), 'no anima filter (re-rasterizaba full-board a dpr× cada frame)');
  assert.ok(/transform/.test(m[0]), 'conserva el "latido" con transform (compositor)');
});

test('A2 (RS-11): el gobernador degrada las infinitas de estrés de Supervivencia (no solo reduced-fx)', () => {
  assert.ok(/body\.perf-1 \.board-wrap\.danger \{[^}]*animation:\s*none/.test(css),
    'perf-1 corta el borde de peligro (dangerBorder repinta border-color full-board)');
  assert.ok(/body\.perf-2\.surv-frenzy-active \.board-wrap \{[^}]*animation:\s*none/.test(css),
    'perf-2 corta el latido de frenesí (queda el glow estático + aura #fever)');
});

test('A3 (RS-12): aria-label memoizado — no reescribe el atributo si no cambia icono/pack/idioma', () => {
  const { Render, State } = cv;
  const cell = makeEl('button'), glyph = makeEl('span');
  let ariaWrites = 0;
  const origSet = cell.setAttribute.bind(cell);
  cell.setAttribute = (k, v) => { if (k === 'aria-label') ariaWrites++; return origSet(k, v); };
  Render.cells = [cell]; Render.glyphs = [glyph];
  State.board = [null]; State.tiles = [null];
  Render._cellId = []; Render._cellPack = []; Render._cellTile = []; Render._cellAria = [];
  Render.syncCell(0);
  assert.equal(ariaWrites, 1, 'el primer sync escribe el aria-label');
  Render.syncCell(0);
  assert.equal(ariaWrites, 1, 'un sync repetido SIN cambios no reescribe el atributo');
  Render._cellAria[0] = 'STALE';            // clave distinta = cambió icono/pack/idioma
  Render.syncCell(0);
  assert.equal(ariaWrites, 2, 'una clave distinta sí fuerza la reescritura');
});

test('A3 (RS-12): syncCells sincroniza SOLO las celdas dadas (no barre las 64)', () => {
  const { Render, State } = cv;
  Render.cells = Array.from({ length: 64 }, () => makeEl('button'));
  Render.glyphs = Array.from({ length: 64 }, () => makeEl('span'));
  State.board = Array(64).fill(null); State.tiles = Array(64).fill(null);
  Render._cellId = []; Render._cellPack = []; Render._cellTile = []; Render._cellAria = [];
  let synced = 0; const orig = Render.syncCell.bind(Render);
  Render.syncCell = (i) => { synced++; return orig(i); };
  Render.syncCells([3, 7, 40]);
  Render.syncCell = orig;
  assert.equal(synced, 3, 'solo sincroniza las 3 celdas indicadas, no las 64');
});
