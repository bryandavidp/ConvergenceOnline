'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const html = read('index.html');
const js = read('game.js');
const css = read('styles.css');
const sw = read('sw.js');

const homeStart = html.indexOf('<section class="screen home"');
const homeEnd = html.indexOf('<section class="screen screen-worlds"', homeStart);
const home = html.slice(homeStart, homeEnd);

const sourceBetween = (source, start, end) => {
  const from = source.indexOf(start);
  assert.ok(from >= 0, `falta el marcador inicial: ${start}`);
  const to = source.indexOf(end, from + start.length);
  assert.ok(to > from, `falta el marcador final: ${end}`);
  return source.slice(from, to);
};

function assertOrder(source, tokens, label) {
  let cursor = -1;
  for (const token of tokens) {
    const next = source.indexOf(token, cursor + 1);
    assert.ok(next > cursor, `${label}: ${token} debe aparecer en el orden contractual`);
    cursor = next;
  }
}

const { getMemoEl } = require('./dom-stub.js');
require('../game.js');
const cv = globalThis.window.__cv;

test('modos: el catálogo vive en Inicio y desaparece la pantalla intermedia', () => {
  assert.ok(homeStart >= 0 && homeEnd > homeStart, 'Inicio debe existir antes del mapa Clásico');
  assert.doesNotMatch(html, /id="screen-modes"|class="screen screen-modes"/,
    'la selección ya no puede existir como pantalla separada');
  assert.doesNotMatch(home, /id="btn-play"/, 'Inicio no debe conservar el CTA Jugar redundante');
  assert.doesNotMatch(js, /Screens\.show\('modes'\)|openModeMenu|closeModeMenu|modes-back|modes-settings/,
    'ninguna ruta productiva debe apuntar al selector eliminado');

  for (const token of [
    'class="home-main"', 'class="home-quick-dock"', 'class="home-mode-stage"',
    'id="home-mode-carousel"', 'id="home-mode-viewport"', 'id="mode-cards"',
    'id="home-mode-dots"', 'id="home-mode-status"', 'class="home-foot"',
  ]) assert.ok(home.includes(token), `falta ${token} en Inicio`);

  assert.doesNotMatch(home, /home-mode-(?:prev|next)|home-carousel-arrow/,
    'el gesto horizontal no debe duplicarse con flechas laterales visibles');

  assert.match(home, /id="home-mode-carousel"[^>]*role="region"[^>]*aria-roledescription="carousel"/);
  assert.match(home, /id="mode-cards"[^>]*role="group"[^>]*aria-labelledby="home-modes-title"/);
  assert.match(home, /id="home-mode-status"[^>]*aria-live="polite"[^>]*aria-atomic="true"/);
});

test('modos: el render dinámico monta el anillo completo con Clásico primero', () => {
  cv.Settings.lang = 'es';
  cv.applyLanguage();
  const rendered = getMemoEl('q:#mode-cards').innerHTML;

  assertOrder(rendered, [
    'data-mode-card="clasico"',
    'data-mode-card="aventura"',
    'data-mode-card="contrarreloj"',
    'data-mode-card="supervivencia"',
    'data-mode-card="zen"',
    'data-mode-card="multijugador"',
  ], 'anillo de modos');
  assert.equal((rendered.match(/class="home-mode-slot"/g) || []).length, 6);
  assert.equal((rendered.match(/data-mode-card=/g) || []).length, 6);
  assert.match(rendered, /data-mode-slot="clasico"[^>]*--card-angle:0deg/,
    'Clásico debe ocupar la cara frontal inicial');
  assert.match(rendered, /data-mode-card="multijugador"[^>]*disabled[^>]*aria-disabled="true"/,
    'Multijugador sigue siendo un anticipo nativamente deshabilitado');
  assert.match(rendered, /data-mode-card="clasico"[^>]*aria-label="Seleccionar Clásico"[^>]*aria-describedby="home-mode-clasico-desc"/,
    'las cards deben exponer una acción accesible sin que aria-labelledby la oculte');
  assert.doesNotMatch(rendered, /data-mode-card="[^"]+"[^>]*aria-labelledby=/);
  assert.doesNotMatch(rendered, /home-mode-enter|arrow-right-03/,
    'la propia card completa es la acción y no necesita un icono de flecha');
  assert.doesNotMatch(rendered, /data-mode="how"|mode-mock-help/,
    'la Guía vive en la navegación global, no como falsa card de modo');
  assert.match(rendered, /id="home-classic-state"/);
  assert.match(rendered, /id="home-classic-badge"/);
  assert.match(rendered, /data-mode-card="supervivencia"[\s\S]*?Vidas[\s\S]*?Oleadas[\s\S]*?Jefes/,
    'Supervivencia debe comunicar su identidad con tres rasgos propios');
});

test('modos: todas las cards conservan su lanzador real', () => {
  const catalog = sourceBetween(js, 'const MODE_CARDS = [', 'const MULTIPLAYER_CARD =');
  const carousel = sourceBetween(js, 'const HomeModeCarousel = {', 'function buildHomeModeCarousel()');

  assert.match(catalog, /key: 'clasico'[\s\S]*?action:\s*\(\)\s*=>\s*openWorldsMap\(\)/);
  assert.match(catalog, /key: 'aventura'[\s\S]*?action:\s*\(\)\s*=>\s*openAdventure\(\)/);
  assert.match(catalog, /key: 'contrarreloj'[\s\S]*?Game\.start\('contrarreloj',\s*'normal'\)/);
  assert.match(catalog, /key: 'supervivencia'[\s\S]*?action:\s*\(\)\s*=>\s*openSurvivalDiff\(\)/);
  assert.match(catalog, /key: 'zen'[\s\S]*?action:\s*\(\)\s*=>\s*launchZen\(\)/);
  assert.match(js, /const MULTIPLAYER_CARD = \{[\s\S]*?disabled:\s*true/);
  assert.doesNotMatch(sourceBetween(js, 'const MULTIPLAYER_CARD = {', 'const HOME_MODE_CARDS'), /\baction\s*:/);
  assert.match(carousel, /activate\(key = this\.key\)[\s\S]*?card\.action\(\)/);
  assert.match(js, /worlds-back'[\s\S]{0,180}?showHome\('clasico', true\)/,
    'volver del mapa debe regresar al carrusel con Clásico enfocado');
  assert.match(js, /a === 'go-play'[^\n]+showHome\(State\.mode, true\)/,
    'los CTA internos deben volver directamente al hub unificado');
});

test('modos: el anillo es infinito y resuelve el último modo realmente jugado', () => {
  const carousel = cv.HomeModeCarousel;
  assert.equal(carousel.normalize(6), 0);
  assert.equal(carousel.normalize(-1), 5);
  assert.equal(carousel.deltaTo(0, 5), 1, 'del último al primero debe avanzar una sola cara');
  assert.equal(carousel.deltaTo(5, 0), -1, 'del primero al último debe retroceder una sola cara');

  assert.equal(carousel.initialMode(''), 'clasico');
  assert.equal(carousel.initialMode('tutorial'), 'clasico');
  assert.equal(carousel.initialMode('multijugador'), 'clasico');
  assert.equal(carousel.initialMode('zen'), 'zen');
  assert.match(js, /if \(mode !== 'tutorial'\) Storage\.lastMode = mode/,
    'la persistencia debe escribirse al arrancar una partida, no al hojear cards');
  assert.doesNotMatch(carousel.select.toString(), /Storage\.lastMode/,
    'mover el carrusel no puede falsear el último modo jugado');
});

test('modos: gesto, teclado y foco comparten la misma selección', () => {
  const carousel = sourceBetween(js, 'const HomeModeCarousel = {', 'function buildHomeModeCarousel()');
  for (const event of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) {
    assert.match(carousel, new RegExp(`addEventListener\\('${event}'`), `falta soporte ${event}`);
  }
  assert.match(carousel, /event\.key === 'ArrowLeft'/);
  assert.match(carousel, /event\.key === 'ArrowRight'/);
  assert.doesNotMatch(carousel, /home-mode-(?:prev|next)/,
    'el soporte de teclado no debe depender de botones laterales');
  assert.match(carousel, /button\.tabIndex = selected && !button\.disabled \? 0 : -1/,
    'solo la card activa debe entrar en el orden de tabulación');
  assert.match(carousel, /home-mode-status[\s\S]*?home_mode_position/,
    'cada giro debe anunciar posición y modo');
});

test('modos: el CSS construye un cilindro 3D fijo y respeta movimiento reducido', () => {
  assert.match(css, /#screen-start \.home-main\s*\{[^}]*overflow:\s*hidden/s,
    'el hub debe permanecer fijo sin scroll vertical');
  assert.match(css, /#screen-start \.home-mode-track\s*\{[^}]*transform-style:\s*preserve-3d[^}]*translateZ\([^}]*rotateY\(/s,
    'el track debe rotar en profundidad');
  assert.match(css, /#screen-start \.home-mode-slot\s*\{[^}]*rotateY\(var\(--card-angle\)\)\s*translateZ\(var\(--home-mode-radius\)\)/s,
    'cada card debe ocupar una cara real del cilindro');
  assert.match(css, /#screen-start \.home-mode-card\s*\{[^}]*backface-visibility:\s*hidden/s);
  assert.match(css, /\.home-mode-track\.is-dragging[\s\S]{0,160}?transition:\s*none/);
  assert.match(css, /body\.reduced-fx #screen-start \.home-mode-track[\s\S]{0,220}?transition:\s*none/);
  assert.match(css, /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*?#screen-start \.home-mode-track/);
});

test('modos: las cards son estrechas, verticales y dejan sobresalir el arte', () => {
  assert.match(css, /INICIO 3\.1[^\n]*CARDS VERTICALES CON ARTE SOBRESALIENTE/);
  assert.match(css, /--home-mode-card-w:\s*clamp\(236px,\s*62vw,\s*340px\)/,
    'la card frontal debe ser sensiblemente más estrecha que el carrusel');
  assert.match(css, /--home-mode-card-h:\s*clamp\(220px,\s*29svh,\s*290px\)/,
    'el cuerpo debe usar una proporción vertical compacta');
  assert.match(css, /#screen-start \.home-mode-card\s*\{[^}]*top:\s*58%[^}]*overflow:\s*visible/s,
    'el cuerpo no puede recortar el objeto superior');
  assert.match(css, /#screen-start \.home-mode-art\s*\{[^}]*top:\s*calc\(0px - var\(--home-mode-overhang\)\)[^}]*width:\s*120%/s,
    'el arte debe romper el borde superior con un overhang explícito');
  for (const mode of ['classic', 'adventure', 'timed', 'survival', 'zen', 'multi']) {
    assert.match(css, new RegExp(`home-mode-card-${mode} \\.home-mode-art`),
      `${mode} debe disponer de una composición de arte individual`);
  }
});

test('modos: i18n ES/EN cubre controles, estado y ayuda del carrusel', () => {
  const keys = [
    'home_modes_label', 'home_carousel_hint', 'home_mode_pages', 'home_mode_play',
    'home_mode_select', 'home_mode_position',
    'home_quick_actions', 'card_feat_lives', 'card_feat_waves', 'card_feat_bosses',
  ];
  for (const lang of ['es', 'en']) {
    for (const key of keys) {
      assert.equal(typeof cv.I18n.DICT[lang][key], 'string', `${lang}.${key} debe existir`);
      assert.ok(cv.I18n.DICT[lang][key].trim(), `${lang}.${key} no puede estar vacía`);
    }
  }
  assert.doesNotMatch(cv.I18n.DICT.es.home_carousel_hint, /flechas?/i);
  assert.doesNotMatch(cv.I18n.DICT.en.home_carousel_hint, /arrows?/i);
});

test('modos: artes, precache y versión quedan sincronizados', () => {
  for (const name of ['mode-survival', 'mode-classic', 'mode-multiplayer', 'mode-timed', 'mode-zen']) {
    const rel = `img/ui-generated/modes/${name}.png`;
    const file = path.join(ROOT, rel);
    assert.ok(fs.existsSync(file), `falta ${rel}`);
    const png = fs.readFileSync(file);
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(png[25] & 4, 4, `${rel} debe conservar transparencia`);
    assert.match(sw, new RegExp(`['"]${name}['"]`));
  }
  assert.match(sw, /c\.addAll\(MODE_GENERATED_ART\)/);

  const version = js.match(/const VERSION = '([^']+)'/)?.[1];
  assert.ok(version);
  assert.match(html, new RegExp(`styles\\.css\\?v=${version.replaceAll('.', '\\.')}`));
  assert.match(html, new RegExp(`game\\.js\\?v=${version.replaceAll('.', '\\.')}`));
  assert.match(sw, new RegExp(`cv-cache-v${version.replaceAll('.', '\\.')}`));
});
