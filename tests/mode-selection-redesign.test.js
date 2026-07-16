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

const screenStart = html.indexOf('<section class="screen screen-modes"');
const screenEnd = html.indexOf('<section class="screen screen-worlds"', screenStart);
const modesScreen = html.slice(screenStart, screenEnd);

const sourceBetween = (source, start, end) => {
  const from = source.indexOf(start);
  assert.ok(from >= 0, `falta el marcador inicial: ${start}`);
  const to = source.indexOf(end, from + start.length);
  assert.ok(to > from, `falta el marcador final: ${end}`);
  return source.slice(from, to);
};

const catalogSource = sourceBetween(js, 'const MODE_CARDS = [', 'function buildModeMenu()');
const buildSource = sourceBetween(js, 'function buildModeMenu()', 'function openModeMenu()');

function cardSource(key) {
  const from = catalogSource.indexOf(`key: '${key}'`);
  assert.ok(from >= 0, `falta la configuración del modo ${key}`);
  const tail = catalogSource.slice(from);
  const candidates = [tail.indexOf('\n    },'), tail.indexOf('\n  };')].filter((n) => n >= 0);
  assert.ok(candidates.length, `no se pudo delimitar la configuración de ${key}`);
  return tail.slice(0, Math.min(...candidates));
}

function assertOrder(source, tokens, label) {
  let cursor = -1;
  for (const token of tokens) {
    const next = source.indexOf(token, cursor + 1);
    assert.ok(next > cursor, `${label}: ${token} debe aparecer en el orden contractual`);
    cursor = next;
  }
}

/* Carga real de game.js sobre el stub compartido: buildModeMenu() se ejecuta
 * durante init y deja el HTML dinámico observable sin duplicar su lógica aquí. */
const { getMemoEl } = require('./dom-stub.js');
require('../game.js');
const cv = globalThis.window.__cv;

test('modos: index monta la variante de producción y conserva controles reales', () => {
  assert.ok(screenStart >= 0 && screenEnd > screenStart, 'debe existir #screen-modes antes del mapa Clásico');
  for (const token of [
    'class="mode-mock-shell"',
    'class="mode-mock-header"',
    'data-mode-topbar',
    'class="mode-mock-main"',
    'class="mode-mock-heading"',
    'class="mode-mock-catalog"',
    'id="mode-cards"',
    'id="modes-back"',
    'id="modes-settings"',
  ]) assert.ok(modesScreen.includes(token), `falta ${token} en la pantalla productiva`);

  assert.match(modesScreen, /<h1\b[^>]*id="modes-title"[^>]*data-i18n="modes_title"[^>]*tabindex="-1"[^>]*>/,
    'el título debe ser localizable y enfocable por programa al entrar');
  assert.match(modesScreen, /<button\b[^>]*id="modes-back"[^>]*data-i18n-al="back"[^>]*>/,
    'Volver debe localizar su nombre accesible');

  const settings = modesScreen.match(/<button\b[^>]*id="modes-settings"[^>]*>/)?.[0] || '';
  assert.match(settings, /data-i18n-al="menu_settings"/);
  assert.doesNotMatch(settings, /data-act=/,
    'Ajustes usa su listener directo; data-act lo abriría dos veces y rompería la restauración de foco');

  assert.match(modesScreen, /class="mode-mock-profile"[^>]*data-act="profile"[^>]*data-i18n-al="profile_action"/);
  assert.match(modesScreen, /class="mode-mock-pill mode-mock-coins"[^>]*data-act="buy-coins"[^>]*data-i18n-al="get_coins"/);
  assert.match(modesScreen, /class="mode-mock-pill mode-mock-gems"[^>]*data-act="buy-gems"[^>]*data-i18n-al="get_gems"/);
  assert.match(modesScreen, /data-econ-num="coins"[^>]*data-econ-compact/);
  assert.match(modesScreen, /data-econ-num="gems"[^>]*data-econ-compact/);
  assert.match(modesScreen, /class="mode-mock-pill mode-mock-fire"[^>]*data-i18n-al="home_streak"/,
    'Racha no puede conservar un aria-label fijo en español');
  assert.match(modesScreen, /class="mode-mock-header"[^>]*data-mode-topbar[^>]*data-i18n-al="modes_profile_resources"/);
  assert.match(modesScreen, /class="mode-mock-wallet"[^>]*data-i18n-al="modes_resources"/);
  assert.match(modesScreen, /class="mode-mock-main"[^>]*data-i18n-al="modes_catalog"/);
  assert.match(modesScreen, /class="mode-mock-catalog"[^>]*id="mode-cards"[^>]*role="group"[^>]*aria-labelledby="modes-title"/,
    'el catálogo debe tomar como nombre accesible el título ya localizado');

  assert.match(modesScreen, /<div\b[^>]*id="mode-cards"[^>]*>\s*<\/div>/,
    'las tarjetas deben proceder de buildModeMenu, sin una segunda copia estática');
  assert.doesNotMatch(modesScreen, /body\.mode-selection-mockup|\.\.\/\.\.\/img\//,
    'producción no debe depender del body o las rutas del documento de mockup');
});

test('modos: buildModeMenu renderiza el orden aprobado con semántica nativa', () => {
  const originalLang = cv.Settings.lang;
  try {
    cv.Settings.lang = 'es';
    cv.applyLanguage();
    const rendered = getMemoEl('q:#mode-cards').innerHTML;

    assertOrder(rendered, [
      'data-mode="supervivencia"',
      'data-mode="clasico"',
      'data-mode="multijugador"',
      'data-mode="how"',
      'class="mode-mock-extra-heading"',
      'data-mode="aventura"',
      'data-mode="contrarreloj"',
      'data-mode="zen"',
    ], 'catálogo');

    assert.equal((rendered.match(/data-mode="/g) || []).length, 7,
      'debe haber cinco modos reales, Multijugador deshabilitado y Ayuda');
    for (const mode of ['supervivencia', 'clasico', 'multijugador', 'how', 'aventura', 'contrarreloj', 'zen']) {
      assert.equal((rendered.match(new RegExp(`data-mode="${mode}"`, 'g')) || []).length, 1,
        `${mode} debe renderizarse exactamente una vez`);
      assert.match(rendered, new RegExp(`<button\\b[^>]*data-mode="${mode}"`),
        `${mode} debe conservar el rol nativo de botón`);
    }

    assert.doesNotMatch(rendered, /role="listitem"/,
      'no se debe sustituir el rol nativo de los botones por listitem');
    assert.doesNotMatch(rendered, /<br\s*\/?\s*>/i,
      'los saltos de línea deben responder al ancho y al idioma, no estar fijados en HTML');
    assert.match(rendered, /aria-labelledby="mode-card-supervivencia-title"[^>]*aria-describedby="mode-card-supervivencia-desc"/);
    assert.match(rendered, /aria-labelledby="mode-how-title"[^>]*aria-describedby="mode-how-desc"/);

    const multiButton = rendered.match(/<button\b[^>]*data-mode="multijugador"[^>]*>/)?.[0] || '';
    assert.match(multiButton, /\sdisabled(?:\s|$)/, 'Multijugador debe usar disabled nativo');
    assert.match(multiButton, /aria-disabled="true"/);
    assert.match(multiButton, /aria-labelledby="mode-card-multijugador-title mode-card-multijugador-status"/);
    assert.match(rendered, /class="mode-mock-status"[^>]*id="mode-card-multijugador-status"[^>]*>[^<]*Próximamente/i,
      'el estado no disponible debe quedar visible y expuesto al lector de pantalla');
  } finally {
    cv.Settings.lang = originalLang;
    cv.applyLanguage();
  }
});

test('modos: el render dinámico cambia completo a inglés y no filtra claves i18n', () => {
  const originalLang = cv.Settings.lang;
  try {
    cv.Settings.lang = 'en';
    cv.applyLanguage();
    const rendered = getMemoEl('q:#mode-cards').innerHTML;

    for (const text of ['Survival', 'Classic', 'Multiplayer', 'How to play?', 'More modes', 'Adventure', 'Time Attack', 'Zen']) {
      assert.ok(rendered.includes(text), `falta la traducción inglesa: ${text}`);
    }
    assert.doesNotMatch(rendered, /modes_more|card_multi_tag|card_feat_(?:biomes|goals|minibosses|time|pressure|no_penalties|no_limit|relaxed)/,
      'ninguna clave sin traducir puede llegar al catálogo');
    assert.doesNotMatch(rendered, /Supervivencia|Clásico|Más modos|Contrarreloj|Próximamente/,
      'el HTML reconstruido en inglés no debe conservar copy español');
  } finally {
    cv.Settings.lang = originalLang;
    cv.applyLanguage();
  }
});

test('modos: todas las claves propias de la integración existen en ES y EN', () => {
  const keys = [
    'modes_more', 'modes_profile_resources', 'modes_resources', 'modes_catalog', 'econ_balance', 'card_multi_tag',
    'card_feat_biomes', 'card_feat_goals', 'card_feat_minibosses',
    'card_feat_time', 'card_feat_pressure',
    'card_feat_no_penalties', 'card_feat_no_limit', 'card_feat_relaxed',
  ];
  for (const lang of ['es', 'en']) {
    for (const key of keys) {
      assert.equal(typeof cv.I18n.DICT[lang][key], 'string', `${lang}.${key} debe existir`);
      assert.ok(cv.I18n.DICT[lang][key].trim(), `${lang}.${key} no puede estar vacía`);
      assert.notEqual(cv.I18n.DICT[lang][key], key, `${lang}.${key} no puede caer al nombre de la clave`);
    }
  }
});

test('modos: cada tarjeta disponible conserva su acción real y Multi no tiene ninguna', () => {
  assert.match(cardSource('supervivencia'), /action:\s*\(\)\s*=>\s*openSurvivalDiff\(\)/);
  assert.match(cardSource('clasico'), /action:\s*\(\)\s*=>\s*openWorldsMap\(\)/);
  assert.match(cardSource('aventura'), /action:\s*\(\)\s*=>\s*openAdventure\(\)/);
  assert.match(cardSource('contrarreloj'), /action:\s*\(\)\s*=>\s*\{[^}]*Game\.start\('contrarreloj',\s*'normal'\)/s);
  assert.match(cardSource('zen'), /action:\s*\(\)\s*=>\s*launchZen\(\)/);

  const multiplayer = cardSource('multijugador');
  assert.match(multiplayer, /disabled:\s*true/);
  assert.doesNotMatch(multiplayer, /\baction\s*:/,
    'Multijugador no debe abrir el modal latente ni simular una función online');

  assert.match(buildSource, /MODE_CARDS\.forEach\(\(c\)\s*=>\s*\{[\s\S]*?c\.action\(\)/,
    'solo las cinco tarjetas reales deben recibir listeners');
  assert.doesNotMatch(buildSource, /MULTIPLAYER_CARD\.action|data-mode="multijugador"[^\n]*addEventListener/);
  assert.match(buildSource, /data-mode="how"[\s\S]*?Modal\.open\('modal-how'\)/,
    'Ayuda debe abrir el tutorial existente');

  assert.match(js, /function openModeMenu\(\)[\s\S]*?buildModeMenu\(\)[\s\S]*?updateTopBars\(\)[\s\S]*?Screens\.show\('modes'\)[\s\S]*?#modes-title[\s\S]*?\.focus\(/,
    'entrar debe reconstruir, sincronizar recursos, mostrar y enfocar la pantalla');
  assert.match(js, /function closeModeMenu\(\)[\s\S]*?Screens\.show\('start'\)[\s\S]*?#btn-play[\s\S]*?\.focus\(/,
    'Volver debe restaurar pantalla y foco');
  assert.match(js, /on\('modes-back',\s*'click',\s*\(\)\s*=>\s*closeModeMenu\(\)\)/);
  assert.match(js, /const ms = \$\('#modes-settings'\)[\s\S]{0,180}?addEventListener\('click',[\s\S]{0,120}?openSettings\(\)/,
    'Ajustes debe conservar su acción real');
  assert.match(js, /const bp = \$\('#btn-play'\)[\s\S]{0,180}?addEventListener\('click',[\s\S]{0,120}?openModeMenu\(\)/,
    'Jugar debe entrar mediante el flujo centralizado');
  assert.match(js, /a === 'go-play'\)[\s\S]{0,180}?Modal\.close\(\)[\s\S]{0,100}?openModeMenu\(\)/,
    'los CTA internos deben reutilizar el mismo flujo de entrada');
  assert.match(js, /const wb = \$\('#worlds-back'\)[\s\S]{0,180}?addEventListener\('click',[\s\S]{0,120}?openModeMenu\(\)/,
    'volver desde Clásico debe reconstruir y enfocar el catálogo');
});

test('modos: los cinco artes PNG existen, tienen resolución y canal alfa', () => {
  const names = ['mode-survival', 'mode-classic', 'mode-multiplayer', 'mode-timed', 'mode-zen'];
  for (const name of names) {
    const rel = `img/ui-generated/modes/${name}.png`;
    const file = path.join(ROOT, rel);
    assert.ok(fs.existsSync(file), `falta ${rel}`);
    assert.ok(js.includes(rel), `${rel} debe estar referenciado por el render productivo`);

    const png = fs.readFileSync(file);
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', `${rel} debe ser PNG`);
    assert.ok(png.readUInt32BE(16) >= 300, `${rel} necesita anchura suficiente`);
    assert.ok(png.readUInt32BE(20) >= 300, `${rel} necesita altura suficiente`);
    assert.equal(png[25] & 4, 4, `${rel} debe conservar transparencia`);
  }
});

test('modos: CSS expone un puente productivo, disabled visible y ambos regímenes responsive', () => {
  for (const selector of [
    '#screen-modes .mode-mock-shell',
    '#screen-modes .mode-mock-header',
    '#screen-modes .mode-mock-main',
    '#screen-modes .mode-mock-catalog',
    '#screen-modes .mode-mock-card',
    '#screen-modes .mode-mock-help',
    '#screen-modes #modes-title',
    '#screen-modes button:focus-visible',
  ]) assert.ok(css.includes(selector), `falta el selector productivo ${selector}`);

  assert.match(css, /#screen-modes\s+\.mode-mock-card(?::disabled|\[disabled\]|\[aria-disabled=["']true["']\])[^\{]*\{[\s\S]{0,350}?(?:opacity|filter|cursor)/,
    'Multijugador debe parecer deshabilitado también visualmente');
  assert.match(css, /#screen-modes\s+button:focus-visible\s*\{[^}]*outline\s*:/,
    'todos los controles deben conservar foco visible');

  const mediaStarts = [...css.matchAll(/@media\s*[^\{]+\{/g)].map((m) => m.index);
  const mediaBlocks = mediaStarts.map((start, i) => css.slice(start, mediaStarts[i + 1] || css.length));
  const tablet = mediaBlocks.find((block) => /min-width:\s*684px/.test(block) && /max-width:\s*852px/.test(block) && /body\[data-screen=["']modes["']\]/.test(block));
  assert.ok(tablet, 'falta el régimen proporcional de producción 684–852 px');
  assert.match(tablet, /#screen-modes\s+\.mode-mock-shell/);

  const mobile = mediaBlocks.find((block) => /max-width:\s*683px/.test(block) && /#screen-modes\s+\.mode-mock-shell/.test(block));
  assert.ok(mobile, 'falta el reflow productivo de 320–683 px');
});

test('modos: versión 2.6.52 y precache offline quedan sincronizados', () => {
  assert.match(js, /const VERSION = '2\.6\.52'/);
  assert.match(html, /styles\.css\?v=2\.6\.52/);
  assert.match(html, /game\.js\?v=2\.6\.52/);
  assert.match(sw, /const CACHE = 'cv-cache-v2\.6\.52'/);
  assert.match(sw, /'\.\/styles\.css\?v=2\.6\.52'/);
  assert.match(sw, /'\.\/game\.js\?v=2\.6\.52'/);

  const modePrecache = sourceBetween(sw, 'const MODE_GENERATED_ART = [', 'const V2_ICONS = [');
  for (const name of ['mode-survival', 'mode-classic', 'mode-multiplayer', 'mode-timed', 'mode-zen']) {
    assert.match(modePrecache, new RegExp(`['"]${name}['"]`), `${name} debe estar en MODE_GENERATED_ART`);
  }
  assert.match(modePrecache, /\.\/img\/ui-generated\/modes\//);
  assert.match(sw, /c\.addAll\(MODE_GENERATED_ART\)\.catch\(\(\)\s*=>\s*\{\}\)/);
  assert.match(sw, /'\.\/img\/icons-v2\/8-ui\/arrow-left-02\.svg'/);
  assert.match(sw, /'\.\/img\/icons-v2\/8-ui\/arrow-right-03\.svg'/);

  assert.doesNotMatch([html, js, sw].join('\n'), /2\.6\.(?:47|48|49|50|51)/,
    'ningún entrypoint puede conservar una versión anterior');
});
