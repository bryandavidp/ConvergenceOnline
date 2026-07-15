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
  'medal', 'cart', 'house', 'settings', 'bolt', 'clock', 'upgrade',
];

test('home: mantiene un CTA primario inferior antes de la navegación', () => {
  const html = read('index.html');
  const scroll = html.indexOf('<div class="home-scroll">');
  const foot = html.indexOf('<div class="home-foot">');
  const play = html.indexOf('id="btn-play"');
  const nav = html.indexOf('<nav class="bottom-nav"');

  assert.ok(scroll >= 0, 'debe existir una zona desplazable');
  assert.ok(foot > scroll, 'el pie debe declararse después del contenido desplazable');
  assert.ok(play > foot && play < nav, 'JUGAR debe estar en el pie, justo antes de la navegación');
  assert.equal((html.match(/id="btn-play"/g) || []).length, 1, 'debe existir un único CTA JUGAR');
});

test('home: expone estados vitales y usa iconos V2 reales en tarjetas', () => {
  const html = read('index.html');
  const home = html.slice(html.indexOf('<section class="screen home"'), html.indexOf('<!-- ============ PANTALLA: SELECCIÓN DE MODO'));
  for (const id of [
    'btn-resume-run', 'home-daily-state', 'home-classic-state', 'home-surv-state',
    'home-daily-progress', 'home-weekly-progress', 'home-chests-state', 'home-streak-state',
  ]) assert.match(html, new RegExp(`id="${id}"`), `falta el estado ${id}`);

  for (const icon of ['target', 'star', 'heart', 'shield', 'calendar', 'chest', 'fire']) {
    assert.match(html, new RegExp(`img/ui-v2/home/${icon}\\.png`), `falta el asset V2 ${icon}`);
  }
  for (const icon of ['bolt', 'clock', 'upgrade']) {
    assert.match(home, new RegExp(`img/ui-v2/home/${icon}\\.png`), `falta el asset de acción V2 ${icon}`);
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
    assert.equal(png.readUInt32BE(16), 256, `${rel} debe medir 256 px de ancho`);
    assert.equal(png.readUInt32BE(20), 256, `${rel} debe medir 256 px de alto`);
    total += png.length;
  }

  assert.ok(total < 1024 * 1024, `el subconjunto V2 pesa ${total} bytes; debe quedar por debajo de 1 MiB`);
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
  for (const icon of ['player', 'pencil', 'coin', 'gem', 'plus']) {
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
