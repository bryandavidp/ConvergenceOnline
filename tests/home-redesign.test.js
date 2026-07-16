'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

const HOME_ICONS = [
  'player', 'pencil', 'coin', 'gem', 'plus', 'gift', 'rocket', 'trophy',
  'target', 'star', 'heart', 'shield', 'calendar', 'chest', 'fire',
  'medal', 'cart', 'house', 'settings', 'bolt', 'clock', 'upgrade', 'robot',
];
const HOME_GENERATED_ART = [
  'avatar-robot', 'classic-board', 'daily-gift', 'hero-rocket',
  'multiplayer-versus', 'tournament-trophy', 'nav-achievements', 'nav-chest',
  'nav-daily', 'nav-friends', 'nav-guide', 'nav-home', 'nav-league',
  'nav-missions', 'nav-settings', 'nav-shop',
];

test('home: coloca el CTA primario entre la recompensa y los modos', () => {
  const html = read('index.html');
  const scroll = html.indexOf('<div class="home-scroll">');
  const reward = html.indexOf('id="btn-reward"');
  const play = html.indexOf('id="btn-play"');
  const cards = html.indexOf('<div class="home-cards">');
  const nav = html.indexOf('<nav class="bottom-nav"');

  assert.ok(scroll >= 0, 'debe existir una zona desplazable');
  assert.ok(play > reward && play < cards, 'JUGAR debe dominar el centro, antes de los modos');
  assert.ok(nav > cards, 'la navegación global debe cerrar la composición');
  assert.equal((html.match(/id="btn-play"/g) || []).length, 1, 'debe existir un único CTA JUGAR');
});

test('home: refleja la arquitectura del mockup y conserva estados reales', () => {
  const html = read('index.html');
  const home = html.slice(html.indexOf('<section class="screen home"'), html.indexOf('<!-- ============ PANTALLA: SELECCIÓN DE MODO'));
  for (const id of [
    'btn-resume-run', 'home-daily-state', 'home-classic-state', 'home-multi-card',
    'home-daily-progress', 'home-weekly-progress', 'home-chests-state',
    'home-today-league', 'home-today-friends',
  ]) assert.match(html, new RegExp(`id="${id}"`), `falta el estado ${id}`);

  for (const art of ['classic-board', 'daily-gift', 'hero-rocket', 'multiplayer-versus', 'tournament-trophy', 'nav-achievements', 'nav-chest', 'nav-daily', 'nav-friends', 'nav-guide', 'nav-home', 'nav-league', 'nav-missions', 'nav-settings', 'nav-shop']) {
    assert.match(home, new RegExp(`img/ui-generated/home/${art}\\.png`), `falta el arte generado ${art}`);
  }
  for (const icon of ['clock', 'upgrade']) {
    assert.match(home, new RegExp(`img/ui-v2/home/${icon}\\.png`), `falta el asset de acción V2 ${icon}`);
  }
  assert.match(home, /class="classic-board"/, 'Clásico debe mostrar el tablero del mockup');
  assert.match(home, /class="multi-art"/, 'Multijugador debe mostrar el versus del mockup');
  assert.match(home, /data-act="open-guide"/, 'la navegación global debe exponer Guía');
  assert.match(home, /data-act="nav-achievements"/, 'Logros debe tener una acción propia');
  assert.equal((home.match(/data-act="settings"/g) || []).length, 1, 'Ajustes debe existir solo en la navegación inferior');
  assert.doesNotMatch(home, /home-bell/, 'Misiones no debe duplicarse como botón flotante');
  assert.doesNotMatch(home, /home-level-value|home-level-line/, 'el resumen central debe mostrar solo la mejor puntuación');
  assert.match(home, /id="home-record-card"[^>]+aria-label="Mejor puntuación: 0"/, 'la puntuación debe tener semántica propia');
  for (const id of ['home-multi-card', 'home-today-league', 'home-today-friends']) {
    assert.match(home, new RegExp(`id="${id}"[^>]+disabled[^>]+aria-disabled="true"`), `${id} debe estar desactivado hasta su implementación`);
  }
  assert.doesNotMatch(home, /img\/ui\//, 'Inicio no debe consumir iconos del pack anterior');
  assert.doesNotMatch(home, /img\/icons-v2\//, 'Inicio no debe mezclar la familia SVG plana con los PNG casuales');
});

test('home: el subconjunto V2 está optimizado, completo y precargado', () => {
  const sw = read('sw.js');
  let total = 0;
  assert.match(sw, /HOME_V2_ICONS[^;]+\.map\(\(n\) => '\.\/img\/ui-v2\/home\/' \+ n \+ '\.png'\)/s);
  assert.match(sw, /c\.addAll\(HOME_V2_ICONS\)/);

  for (const icon of HOME_ICONS) {
    const rel = `img/ui-v2/home/${icon}.png`;
    const file = path.join(ROOT, rel);
    assert.ok(fs.existsSync(file), `falta ${rel}`);
    assert.match(sw, new RegExp(`['"]${icon}['"]`), `${icon} no está en HOME_V2_ICONS`);

    const png = fs.readFileSync(file);
    assert.equal(png.toString('ascii', 1, 4), 'PNG', `${rel} no es PNG`);
    const width = png.readUInt32BE(16), height = png.readUInt32BE(20);
    assert.equal(width, height, `${rel} debe ser cuadrado`);
    assert.ok(width >= 128 && width <= 512, `${rel} debe estar optimizado para UI`);
    total += png.length;
  }

  assert.ok(total < 1024 * 1024, `el subconjunto V2 pesa ${total} bytes; debe quedar por debajo de 1 MiB`);
});

test('home: el arte generado original existe, tiene alfa y se precarga offline', () => {
  const sw = read('sw.js');
  assert.match(sw, /HOME_GENERATED_ART[^;]+\.map\(\(n\) => '\.\/img\/ui-generated\/home\/' \+ n \+ '\.png'\)/s);
  assert.match(sw, /c\.addAll\(HOME_GENERATED_ART\)/);

  for (const art of HOME_GENERATED_ART) {
    const rel = `img/ui-generated/home/${art}.png`;
    const file = path.join(ROOT, rel);
    assert.ok(fs.existsSync(file), `falta ${rel}`);
    assert.match(sw, new RegExp(`['"]${art}['"]`), `${art} no está en HOME_GENERATED_ART`);
    const png = fs.readFileSync(file);
    assert.equal(png.toString('ascii', 1, 4), 'PNG', `${rel} no es PNG`);
    assert.ok(png.readUInt32BE(16) >= 150, `${rel} no tiene resolución suficiente`);
    assert.ok(png.readUInt32BE(20) >= 150, `${rel} no tiene resolución suficiente`);
    assert.equal(png[25] & 4, 4, `${rel} debe conservar canal alfa`);
  }
});

test('home: los estados dinámicos incluyen i18n y etiquetas accesibles', () => {
  const js = read('game.js');
  const topbar = js.slice(js.indexOf('const TOPBAR_HTML'), js.indexOf('function mountTopBars'));
  assert.match(js, /const worldName = \(world\) => I18n\.t\('world_' \+ world\.id\)/);
  assert.match(js, /resume\.setAttribute\('aria-label'/);
  assert.match(js, /card\.setAttribute\('aria-label'/);
  assert.match(js, /play\.setAttribute\('aria-label'/);
  assert.match(js, /<button class="econ-plus"[^>]+data-i18n-al="get_coins"/);
  assert.match(js, /world_bosque: 'Green Forest'/, 'los nombres de mundo deben localizarse en inglés');
  assert.match(topbar, /img\/ui-generated\/home\/avatar-robot\.png/, 'la cabecera debe usar el avatar generado');
  assert.doesNotMatch(topbar, /nav-settings|data-act="settings"/, 'la cabecera no debe duplicar Ajustes');
  for (const icon of ['pencil', 'coin', 'gem', 'plus', 'fire']) {
    assert.match(topbar, new RegExp(`img/ui-v2/home/${icon}\\.png`), `la cabecera debe usar ${icon} de V2`);
  }
  assert.doesNotMatch(topbar, /img\/ui\//, 'la cabecera no debe consumir iconos del pack anterior');
  assert.doesNotMatch(topbar, /img\/icons-v2\//, 'la cabecera no debe mezclar la familia SVG plana');
});

test('home: sincroniza el contador de cofres y separa Perfil de Logros', () => {
  const js = read('game.js');
  assert.match(js, /const fmtCompact = \(n\) =>/, 'la economía debe compactar valores largos para no romper la cabecera');
  assert.match(js, /function syncHomeChests\(\)/, 'debe existir una proyección única del contador de cofres');
  assert.match(js, /function buildChests\(\)[\s\S]*?syncHomeChests\(\)/, 'abrir Cofres debe refrescar Inicio');
  assert.match(js, /function doOpenChest\(\)[\s\S]*?Meta\.openChest\(\)[\s\S]*?syncHomeChests\(\)/, 'cada cofre abierto debe actualizar Inicio al instante');
  assert.match(js, /a === 'nav-achievements'\)[^\n]+openMedals\('achievements'\)/, 'Logros debe abrir su vista específica');
  assert.match(js, /function openMedals\(view = 'profile'\)/, 'Perfil debe conservar su vista completa');
  assert.doesNotMatch(js, /'home-multi'|'home-friends'/, 'las funciones no disponibles no deben conservar handlers engañosos');
});

test('home: fija el contrato visual de tipografía, CTA, avatar, economía e Inicio', () => {
  const css = read('styles.css');

  assert.match(css, /#screen-start[^\{]*\{[^}]*font-family\s*:/s,
    'Inicio debe declarar una familia tipográfica propia y coherente');
  assert.match(css, /#screen-start \.btn-hero\s*\{[^}]*border[^}]*border-radius[^}]*background:\s*linear-gradient[^}]*box-shadow/s,
    'Jugar debe conservar doble borde, volumen, degradado y glow');
  assert.match(css, /#screen-start \.btn-hero::after\s*\{[^}]*linear-gradient/s,
    'Jugar debe incluir su brillo superior de la referencia');
  assert.match(css, /#screen-start \.play-ic\s*\{[^}]*border-left[^}]*#fff/s,
    'Jugar debe mostrar el triángulo blanco construido a escala');
  assert.match(css, /\.bnav-center \.bn-ic\s*\{[^}]*border-radius:\s*50%/s,
    'el icono de Inicio debe vivir en un botón realmente circular');

  const avatarRules = [...css.matchAll(/#screen-start \.avatar\s*\{([^}]*)\}/g)];
  assert.ok(avatarRules.some(([, body]) => /width:\s*clamp\(/.test(body) && /aspect-ratio:\s*1(?:\D|$)/.test(body)),
    'el avatar debe tener escala fluida continua y proporción cuadrada');
  assert.doesNotMatch(css, /#screen-start \.avatar\s*\{[^}]*width:\s*74px[^}]*height:\s*69px/s,
    'ningún breakpoint puede deformar el avatar circular');

  assert.match(css, /#screen-start \.appbar \.econ-pill\s*\{[^}]*linear-gradient[^}]*border[^}]*box-shadow/s,
    'monedas y gemas deben usar la cápsula oscura con relieve del mockup');
  assert.match(css, /#screen-start \.appbar \.econ-plus\s*\{[^}]*border-radius:\s*50%[^}]*background/s,
    'los botones + deben ser discos verdes completos, no cruces flotantes');
  assert.doesNotMatch(css, /#screen-start \.appbar-econ\s*\{[^}]*transform:\s*scale/s,
    'la economía debe dimensionarse de forma fluida sin escalado visual que altere su caja');
});

test('home: la recompensa diaria hace pop y desaparece conservando su hueco', () => {
  const css = read('styles.css');
  const js = read('game.js');

  assert.match(js, /classList\.add\('is-popping'\)/,
    'la reclamación debe entrar en el estado transitorio is-popping');
  assert.match(js, /classList\.add\('is-claimed'\)/,
    'al terminar debe persistir el estado is-claimed');
  assert.match(js, /animationName\s*===\s*'dailyRewardBubblePop'/,
    'el cierre debe esperar a la animación principal y no a una partícula');
  assert.match(css, /\.daily-banner\.is-popping[^\{]*\{[^}]*animation:\s*dailyRewardBubblePop/s,
    'el banner debe explotar como burbuja al reclamar');
  assert.match(css, /@keyframes\s+dailyRewardBubblePop/,
    'debe existir una coreografía pop dedicada');

  const claimed = css.match(/\.daily-banner\.is-claimed[^\{]*\{([^}]*)\}/s);
  assert.ok(claimed, 'falta el estilo final de la recompensa reclamada');
  assert.match(claimed[1], /visibility:\s*hidden/,
    'el contenido reclamado debe desaparecer visualmente');
  assert.doesNotMatch(claimed[1], /display:\s*none/,
    'is-claimed no puede retirar la caja reservada del flujo');
});

test('home: la versión de aplicación, recursos y caché está sincronizada', () => {
  const js = read('game.js');
  const html = read('index.html');
  const sw = read('sw.js');
  const version = js.match(/const VERSION = '([^']+)'/)?.[1];

  assert.ok(version, 'game.js debe declarar VERSION');
  assert.match(html, new RegExp(`styles\\.css\\?v=${version}`));
  assert.match(html, new RegExp(`game\\.js\\?v=${version}`));
  assert.match(sw, new RegExp(`cv-cache-v${version.replaceAll('.', '\\.')}`));
});
