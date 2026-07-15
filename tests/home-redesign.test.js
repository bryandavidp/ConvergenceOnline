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
    'home-daily-progress', 'home-weekly-progress', 'home-chests-state', 'home-streak-state',
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
  assert.match(topbar, /img\/ui-generated\/home\/nav-settings\.png/, 'la cabecera debe usar el engranaje generado');
  for (const icon of ['pencil', 'coin', 'gem', 'plus', 'fire']) {
    assert.match(topbar, new RegExp(`img/ui-v2/home/${icon}\\.png`), `la cabecera debe usar ${icon} de V2`);
  }
  assert.doesNotMatch(topbar, /img\/ui\//, 'la cabecera no debe consumir iconos del pack anterior');
  assert.doesNotMatch(topbar, /img\/icons-v2\//, 'la cabecera no debe mezclar la familia SVG plana');
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
