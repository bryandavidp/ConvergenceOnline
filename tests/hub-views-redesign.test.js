'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

const HUB_VIEWS = ['missions', 'how', 'settings', 'surv-diff', 'daily', 'adventure', 'shop', 'chests', 'multi', 'medals'];

test('hub views: las secciones de metajuego ya no tienen semántica de modal', () => {
  const html = read('index.html');
  assert.equal((html.match(/<nav class="bottom-nav"/g) || []).length, 1,
    'la navegación inferior debe seguir siendo una sola instancia');
  assert.match(html, /id="hub-views"/);

  for (const name of HUB_VIEWS) {
    const tag = html.match(new RegExp(`<section class="[^"]*hub-view[^"]*" id="view-${name}" data-hub-view="${name}"[^>]*>`));
    assert.ok(tag, `falta la vista completa ${name}`);
    assert.doesNotMatch(tag[0], /role="dialog"|aria-modal="true"|class="[^"]*\bmodal\b/,
      `${name} no debe seguir comportándose como modal`);
  }

  const transient = [...html.matchAll(/<div class="[^"]*\bmodal\b[^"]*" id="([^"]+)" role="dialog"/g)].map((m) => m[1]).sort();
  assert.deepEqual(transient, ['modal-level', 'modal-over', 'modal-pause', 'modal-revive'],
    'solo pausa, reanimación y resultados pueden seguir siendo modales');
});

test('hub views: todos los lanzadores cambian de vista sin abrir overlays', () => {
  const js = read('game.js');
  assert.match(js, /const HubViews = \{/);
  assert.match(js, /HubViews\.init\(\)/);
  assert.match(js, /function openSettings\(\)[^\n]+HubViews\.open\('settings'/);
  assert.match(js, /function openShop\(\)[^\n]+HubViews\.open\('shop'/);
  assert.match(js, /function openChests\(\)[^\n]+HubViews\.open\('chests'/);
  assert.match(js, /a === 'open-guide'[^\n]+HubViews\.open\('how'/);
  assert.match(js, /a === 'nav-missions'[^\n]+HubViews\.open\('missions'/);
  assert.doesNotMatch(js, /Modal\.open\('modal-(?:missions|how|settings|surv-diff|daily|adventure|shop|chests|multi|medals)'\)/);
});

test('cofres: asset abierto con alfa, layout propio y secuencia apertura → premio', () => {
  const html = read('index.html');
  const css = read('styles.css');
  const js = read('game.js');
  const sw = read('sw.js');
  const rel = 'img/ui-generated/chests/chest-open.png';
  const asset = path.join(ROOT, rel);

  assert.ok(fs.existsSync(asset), `falta ${rel}`);
  const png = fs.readFileSync(asset);
  assert.equal(png.toString('ascii', 1, 4), 'PNG');
  assert.ok(png.readUInt32BE(16) >= 1000 && png.readUInt32BE(20) >= 1000, 'el hero necesita resolución suficiente');
  assert.equal(png[25] & 4, 4, 'el cofre abierto debe conservar canal alfa');
  assert.match(sw, /img\/ui-generated\/chests\/chest-open\.png/);

  assert.match(html, /class="hub-view view-chests"/);
  assert.match(html, /class="chest-progress-card"/);
  assert.match(html, /class="chest-open-options"/);
  assert.match(js, /img\/ui-generated\/chests\/chest-open\.png/);

  assert.match(css, /@keyframes chestHeroRattle/);
  assert.match(css, /@keyframes chestHeroOpen/);
  assert.match(css, /@keyframes chestPrizeRise/);
  assert.match(js, /classList\.add\('is-opening'\)[\s\S]*?classList\.add\('is-open'\)[\s\S]*?setTimeout\(finish, reduceMotion \? 0 : 1120\)/);
  assert.match(js, /matchMedia\('\(prefers-reduced-motion: reduce\)'\)/);
  assert.match(js, /function showChestReward\(r\)[\s\S]*?class="chest-reward-stage/);
});
