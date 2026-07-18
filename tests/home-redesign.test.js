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
  'avatar-robot', 'classic-board', 'daily-gift', 'header-coin-star', 'header-plus', 'hero-rocket',
  'multiplayer-versus', 'tournament-trophy', 'nav-achievements', 'nav-chest',
  'nav-collections', 'nav-daily', 'nav-events', 'nav-friends', 'nav-guide',
  'nav-home', 'nav-home-redesign', 'nav-league', 'nav-missions', 'nav-settings', 'nav-shop',
];

test('home: concentra accesos, modos y navegación en un hub fijo', () => {
  const html = read('index.html');
  const main = html.indexOf('<div class="home-main">');
  const modes = html.indexOf('class="home-mode-stage"');
  const context = html.indexOf('class="home-context"');
  const nav = html.indexOf('<nav class="bottom-nav"');

  assert.ok(main >= 0, 'debe existir el contenedor fijo de Inicio');
  assert.ok(modes > main && context > modes && nav > context,
    'carrusel, contexto y navegación deben respetar la jerarquía del hub');
  assert.doesNotMatch(html.slice(main, nav), /home-quick-dock|home-quick-item|id="btn-reward"/,
    'los accesos diarios deben vivir en Eventos, no duplicarse sobre Inicio');
  assert.doesNotMatch(html, /class="home-scroll"|id="btn-play"|id="screen-modes"/,
    'no debe quedar scroll, CTA Jugar ni pantalla intermedia');
  assert.match(html, /id="mode-cards"[^>]*role="group"/,
    'el catálogo de modos debe vivir directamente en Inicio');
});

test('home: refleja la arquitectura del mockup y conserva estados reales', () => {
  const html = read('index.html');
  const home = html.slice(html.indexOf('<section class="screen home"'), html.indexOf('<section class="screen screen-worlds"'));
  const events = html.slice(html.indexOf('<section class="hub-view view-events"'), html.indexOf('<section class="hub-view view-missions"'));
  for (const id of [
    'btn-resume-run', 'home-mode-carousel', 'home-mode-status',
  ]) assert.match(html, new RegExp(`id="${id}"`), `falta el estado ${id}`);
  for (const id of ['events-reward-state', 'events-mission-progress', 'events-daily-status', 'events-chests-status']) {
    assert.match(events, new RegExp(`id="${id}"`), `Eventos debe conservar el estado ${id}`);
  }

  for (const art of ['nav-events', 'nav-guide', 'nav-home-redesign', 'nav-collections', 'nav-shop']) {
    assert.match(home, new RegExp(`img/ui-generated/home/${art}\\.png`), `falta el arte generado ${art}`);
  }
  for (const art of ['daily-gift', 'nav-chest', 'nav-daily', 'nav-missions']) {
    assert.match(events, new RegExp(`img/ui-generated/home/${art}\\.png`), `Eventos debe conservar el arte ${art}`);
  }
  for (const icon of ['clock', 'upgrade']) {
    assert.match(home, new RegExp(`img/ui-v2/home/${icon}\\.png`), `falta el asset de acción V2 ${icon}`);
  }
  assert.match(home, /data-act="open-guide"/, 'la navegación global debe exponer Guía');
  assert.match(home, /data-act="nav-events"/, 'Eventos debe tener una acción propia');
  assert.match(home, /data-act="nav-collections"/, 'Colecciones debe tener una acción propia');
  assert.equal((home.match(/data-act="settings"/g) || []).length, 0, 'Ajustes debe salir del menú inferior y vivir en la cabecera compartida');
  assert.doesNotMatch(home, /home-bell/, 'Misiones no debe duplicarse como botón flotante');
  assert.doesNotMatch(home, /id="home-(?:today-daily|daily-card|today-chests)"|data-act="claim-daily"/,
    'recompensa, misión, reto diario y cofres no deben duplicarse en Inicio');
  assert.doesNotMatch(home, /home-mode-heading|home-mode-kicker|home-carousel-hint/,
    'Inicio no debe mostrar el rótulo redundante de selección de modos');
  assert.match(home, /<h2 class="sr-only" id="home-modes-title"/,
    'el carrusel debe conservar un nombre accesible aunque el rótulo no sea visible');
  assert.doesNotMatch(home, /home-record-card|id="start-best"|data-i18n="best_score"|Mejor puntuación/,
    'Inicio no debe mostrar ni mantener el indicador de mejor puntuación');
  assert.doesNotMatch(home, /home-multi-card|home-today-league|home-today-friends|home-weekly-progress/,
    'el hub no debe conservar atajos duplicados del diseño anterior');
  assert.doesNotMatch(home, /img\/ui\//, 'Inicio no debe consumir iconos del pack anterior');
  assert.doesNotMatch(home, /home-carousel-arrow|arrow-(?:left|right)-0[23]\.svg/,
    'el carrusel debe comunicar el scroll sin flechas visuales redundantes');
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
  assert.match(js, /button\.setAttribute\('aria-label',[\s\S]*?home_mode_(?:play|select)/,
    'la card activa debe describir su acción');
  assert.match(js, /home-mode-status[\s\S]*?home_mode_position/,
    'los cambios del carrusel deben anunciarse en su live region');
  assert.match(topbar, /<button class="hub-header-plus"[^>]+data-i18n-al="get_coins"/);
  assert.match(js, /world_bosque: 'Green Forest'/, 'los nombres de mundo deben localizarse en inglés');
  assert.match(topbar, /img\/ui-generated\/home\/avatar-robot\.png/, 'la cabecera debe usar el avatar generado');
  assert.match(topbar, /img\/ui-generated\/home\/header-coin-star\.png/, 'la moneda de cabecera debe llevar la estrella de la referencia');
  assert.match(topbar, /img\/ui-generated\/home\/header-plus\.png/, 'la compra debe usar el botón + 3D dedicado de la referencia');
  assert.match(topbar, /img\/ui-generated\/home\/nav-settings\.png/, 'Ajustes debe vivir al final de la cabecera');
  assert.equal((topbar.match(/data-act="settings"/g) || []).length, 1, 'Ajustes no puede duplicarse dentro de la cabecera');
  for (const icon of ['star', 'gem']) {
    assert.match(topbar, new RegExp(`img/ui-v2/home/${icon}\\.png`), `la cabecera debe usar ${icon} de V2`);
  }
  assert.doesNotMatch(topbar, /class="(?:econ-|appbar-profile|avatar)/,
    'la cabecera aislada no debe heredar las clases antiguas que duplicaban y solapaban recursos');
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

test('home: fija el contrato visual del hub, cilindro, avatar y economía', () => {
  const css = read('styles.css');
  const proportional = css.slice(css.lastIndexOf('CABECERA + MENÚ 4.2'));

  assert.match(css, /#screen-start[^\{]*\{[^}]*font-family\s*:/s,
    'Inicio debe declarar una familia tipográfica propia y coherente');
  assert.match(css, /#screen-start \.home-main\s*\{[^}]*overflow:\s*hidden/s,
    'el contenido principal debe quedar fijo sin scroll vertical');
  assert.match(css, /#screen-start \.home-mode-track\s*\{[^}]*transform-style:\s*preserve-3d[^}]*translateZ\([^}]*rotateY\(/s,
    'el carrusel debe rotar como un cilindro en profundidad');
  assert.match(css, /#screen-start \.home-mode-slot\s*\{[^}]*rotateY\(var\(--card-angle\)\)\s*translateZ\(var\(--home-mode-radius\)\)/s,
    'cada modo debe ocupar una cara del anillo');
  assert.match(css, /#screen-start \.home-mode-card\s*\{[^}]*backface-visibility:\s*hidden/s,
    'las caras traseras no deben atravesar el cilindro');
  assert.match(css, /\.bnav-center \.bn-ic\s*\{[^}]*border-radius:\s*50%/s,
    'el icono de Inicio debe vivir en un botón realmente circular');

  assert.match(proportional, /#screen-start \.appbar\s*\{[^}]*width:\s*min\(470\.5px,\s*100%,\s*110svh\)[^}]*height:\s*auto[^}]*aspect-ratio:\s*941\s*\/\s*161/s,
    'la cabecera debe escalar como el lienzo 941×161 sin un alto mínimo fijo');
  assert.match(proportional, /#screen-start \.hub-header-avatar\s*\{[^}]*width:\s*44\.7%[^}]*aspect-ratio:\s*1/s,
    'el avatar debe conservar su tamaño relativo y su proporción circular');
  assert.match(proportional, /#screen-start \.hub-header-wallets\s*\{[^}]*left:\s*44\.2%[^}]*top:\s*28%[^}]*width:\s*43\.5%[^}]*height:\s*44\.7%/s,
    'las dos carteras deben ocupar las coordenadas medidas de la referencia');
  assert.match(proportional, /#screen-start \.hub-header-settings\s*\{[^}]*left:\s*90\.3%[^}]*width:\s*7\.45%[^}]*height:\s*7\.45cqw/s,
    'Ajustes debe conservar un disco cuadrado al final de la cabecera');
  assert.match(proportional, /#screen-start \.hub-header-wallet\s*\{[^}]*border-radius:\s*999px[^}]*background:\s*linear-gradient[^}]*box-shadow/s,
    'monedas y gemas deben usar una sola cápsula oscura con relieve');
  assert.match(proportional, /#screen-start \.hub-header-wallet\s*\{[^}]*overflow:\s*hidden/s,
    'ningún icono de economía puede sobresalir de su cápsula');
  assert.match(proportional, /#screen-start \.hub-header-currency\s*\{[^}]*left:\s*\.75cqw/s,
    'moneda y gema deben conservar margen interior respecto al borde izquierdo');
  assert.match(proportional, /#screen-start \.hub-header-plus\s*\{[^}]*border-radius:\s*50%[^}]*background:\s*transparent[^}]*box-shadow:\s*none/s,
    'el relieve completo del botón + debe proceder de un único bitmap dedicado');
  assert.match(proportional, /#screen-start \.hub-header-plus\s*\{[^}]*right:\s*\.75cqw/s,
    'el botón + debe conservar margen interior respecto al borde derecho');
  assert.match(proportional, /#screen-start \.hub-header-plus img\s*\{[^}]*filter:\s*none/s,
    'el asset + no debe volver a recolorearse ni perder su acabado 3D');
  assert.match(proportional, /#screen-start \.home-foot\s*\{[^}]*width:\s*min\(425\.5px,\s*100%,\s*83svh\)[^}]*aspect-ratio:\s*851\s*\/\s*256[^}]*margin:\s*0 auto;/s,
    'el pie debe conservar su escala sin añadir margen bajo el dock');
  assert.match(proportional, /#screen-start \.bottom-nav\s*\{[^}]*left:\s*2\.35%[^}]*top:\s*auto;[^}]*bottom:\s*0;[^}]*width:\s*95\.18%[^}]*aspect-ratio:\s*810\s*\/\s*202/s,
    'el dock debe quedar anclado al borde inferior en cualquier altura');
  assert.match(proportional, /body\.has-update-banner\[data-screen="start"\] #screen-start \.home-foot\s*\{[^}]*padding-bottom:\s*0/s,
    'el aviso de actualización tampoco puede levantar el menú inferior');
  assert.match(proportional, /#screen-start \.bnav-center \.bn-ic\s*\{[^}]*top:\s*-\.85cqw[^}]*width:\s*23\.3cqw[^}]*height:\s*23\.3cqw/s,
    'Inicio no puede volver a ser más alto que el dock ni despegarse de su borde');
  assert.match(proportional, /#screen-start \.bnav-center \.bn-ic img\s*\{[^}]*translateY\(-\.7cqw\)\s*scale\(\.9\)/s,
    'la casa debe reservar espacio real para la etiqueta dentro del círculo');
  assert.match(proportional, /#screen-start \.bnav-center small\s*\{[^}]*bottom:\s*5\.2cqw[^}]*font-size:\s*2\.65cqw/s,
    'la etiqueta Inicio debe quedar contenida dentro del círculo activo');
});

test('home: recompensa, misión, reto diario y cofres viven exclusivamente en Eventos', () => {
  const html = read('index.html');
  const js = read('game.js');
  const home = html.slice(html.indexOf('<section class="screen home"'), html.indexOf('<section class="screen screen-worlds"'));
  const events = html.slice(html.indexOf('<section class="hub-view view-events"'), html.indexOf('<section class="hub-view view-missions"'));

  assert.doesNotMatch(home, /home-quick-dock|home-quick-item|id="btn-reward"|id="home-(?:today-daily|daily-card|today-chests)"/,
    'Inicio debe quedar libre de accesos diarios duplicados');
  for (const action of ['claim-daily', 'open-missions', 'home-daily', 'open-chests']) {
    assert.match(events, new RegExp(`data-act="${action}"`), `Eventos debe exponer la acción ${action}`);
  }
  assert.match(js, /function refreshEvents\(\)[\s\S]*?events-reward-state[\s\S]*?events-mission-progress[\s\S]*?events-daily-status[\s\S]*?events-chests-status/,
    'Eventos debe proyectar el estado real de sus cuatro apartados');
  assert.match(js, /function claimDailyReward\(\)[\s\S]*?Meta\.claimReward\(\)[\s\S]*?refreshStart\(\)/,
    'la recompensa debe seguir siendo funcional desde Eventos');
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
