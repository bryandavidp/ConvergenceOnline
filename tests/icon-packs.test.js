'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

require('./dom-stub.js');
require('../game.js');

const { IconPacks, Engine, Meta, Render } = globalThis.window.__cv;

function snapshotMeta() { return JSON.parse(JSON.stringify(Meta.state)); }
function restoreMeta(snapshot) {
  const state = Meta.state;
  Object.keys(state).forEach((key) => delete state[key]);
  Object.assign(state, JSON.parse(JSON.stringify(snapshot)));
  localStorage.setItem('cv_meta', JSON.stringify(state));
}
function isolated(run) {
  const snapshot = snapshotMeta();
  try { return run(); } finally { restoreMeta(snapshot); }
}

function assertPngAsset(packId, fileName) {
  const def = IconPacks.DEFS[packId];
  const file = path.join(__dirname, '..', 'img', 'icon-packs', def.dir, fileName);
  const png = fs.readFileSync(file);
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], `${fileName}: firma PNG`);
  assert.equal(png.readUInt32BE(16), 512, `${fileName}: ancho`);
  assert.equal(png.readUInt32BE(20), 512, `${fileName}: alto`);
  assert.equal(png[25], 6, `${fileName}: debe conservar RGBA`);
}

test('Joyas Prisma registra los diez PNG transparentes del diseño', () => {
  assert.equal(IconPacks.DEFS.prismatic.rarity, 'legendary');
  assert.equal(IconPacks.DEFS.prismatic.cost, 1800);
  assert.equal(IconPacks.PRISMATIC_ASSETS.length, 10);
  assert.equal(IconPacks.iconsOf('prismatic').length, 10);

  for (const asset of IconPacks.PRISMATIC_ASSETS) {
    assertPngAsset('prismatic', asset.file);
  }
});

test('los packs raster registran precios, rareza y todos sus PNG', () => {
  const expected = [
    ['nature-basic', 'rare', 800, 8],
    ['nature-advanced', 'epic', 1600, 10],
    ['neon', 'epic', 1200, 8],
  ];
  assert.deepEqual(IconPacks.order, ['cosmos', 'nature-basic', 'neon', 'nature-advanced', 'prismatic']);
  for (const [packId, rarity, cost, count] of expected) {
    assert.equal(IconPacks.DEFS[packId].rarity, rarity);
    assert.equal(IconPacks.DEFS[packId].cost, cost);
    assert.equal(IconPacks.CATALOGS[packId].length, count);
    assert.equal(IconPacks.iconsOf(packId).length, count);
    for (const asset of IconPacks.CATALOGS[packId]) assertPngAsset(packId, asset.file);
    assertPngAsset(packId, 'thumbnail.png');
  }
});

test('el renderer conserva SVG para Cosmos y usa IMG para Joyas Prisma', () => {
  const iconId = IconPacks.iconsOf('prismatic')[0];
  assert.match(IconPacks.svg('cosmos', iconId), /^<svg\b/);
  assert.match(IconPacks.svg('prismatic', iconId), /^<img\b/);
  assert.match(IconPacks.svg('prismatic', iconId), /violet-diamond\.png/);
});

test('el renderer resuelve cada pack raster desde su propia carpeta', () => {
  const iconId = IconPacks.iconsOf('nature-basic')[0];
  assert.match(IconPacks.svg('nature-basic', iconId), /nature-basic\/green-leaf\.png/);
  assert.match(IconPacks.svg('nature-advanced', iconId), /nature-advanced\/hibiscus\.png/);
  assert.match(IconPacks.svg('neon', iconId), /neon\/neon-square\.png/);
  assert.equal(IconPacks.iconName('nature-basic', iconId, 'es'), 'Hoja verde');
  assert.equal(IconPacks.iconName('nature-advanced', iconId, 'en'), 'Hibiscus');
  assert.equal(IconPacks.iconName('neon', iconId, 'es'), 'Cuadrado neón');
  assert.equal(IconPacks.iconName('neon', iconId, 'en'), 'Neon square');
});

test('Joyas Prisma usa su miniatura generada en tienda y coleccion', () => {
  const file = path.join(__dirname, '..', 'img', 'icon-packs', 'prismatic-jewels', 'thumbnail.png');
  const png = fs.readFileSync(file);
  assert.equal(png.readUInt32BE(16), 512, 'ancho de miniatura');
  assert.equal(png.readUInt32BE(20), 512, 'alto de miniatura');
  assert.equal(png[25], 6, 'la miniatura conserva RGBA');
  assert.match(IconPacks.previewHtml('prismatic'), /class="iconpack-thumbnail"/);
  assert.match(IconPacks.previewHtml('prismatic'), /prismatic-jewels\/thumbnail\.png/);
  assert.match(IconPacks.previewHtml('nature-basic'), /nature-basic\/thumbnail\.png/);
  assert.match(IconPacks.previewHtml('nature-advanced'), /nature-advanced\/thumbnail\.png/);
  assert.match(IconPacks.previewHtml('neon'), /neon\/thumbnail\.png/);
  assert.match(IconPacks.previewHtml('cosmos'), /class="iconpack-collage"/);
  const sw = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
  assert.match(sw, /'golden-star','thumbnail'/);
  assert.match(sw, /NATURE_BASIC_PACK_ASSETS/);
  assert.match(sw, /NATURE_ADVANCED_PACK_ASSETS/);
  assert.match(sw, /NEON_PACK_ASSETS/);
  assert.match(sw, /'neon-diamond','neon-hexagon','neon-heart','neon-drop','thumbnail'/);
});

test('los nuevos packs raster se compran por el precio indicado y se equipan', () => isolated(() => {
  for (const [packId, cost, firstFile] of [
    ['nature-basic', 800, 'green-leaf.png'],
    ['nature-advanced', 1600, 'hibiscus.png'],
    ['neon', 1200, 'neon-square.png'],
  ]) {
    Meta.state.coins = 3000;
    Meta.state.cosmetics.iconPack = IconPacks.DEFAULT;
    delete Meta.state.cosmetics.iconPacks[packId];
    assert.equal(Meta.buyIconPack(packId), true);
    assert.equal(Meta.coins(), 3000 - cost);
    assert.equal(Meta.ownsIconPack(packId), true);
    assert.equal(Meta.equipIconPack(packId), true);
    assert.equal(Meta.equippedIconPack(), packId);
    assert.match(IconPacks.svg(packId, IconPacks.iconsOf(packId)[0]), new RegExp(firstFile.replace('.', '\\.')));
  }
}));

test('Joyas Prisma se compra, descuenta monedas y queda equipado', () => isolated(() => {
  Meta.state.coins = 2000;
  Meta.state.cosmetics.iconPack = IconPacks.DEFAULT;
  delete Meta.state.cosmetics.iconPacks.prismatic;
  assert.equal(Meta.buyIconPack('prismatic'), true);
  assert.equal(Meta.coins(), 200);
  assert.equal(Meta.ownsIconPack('prismatic'), true);
  assert.equal(Meta.equipIconPack('prismatic'), true);
  assert.equal(Meta.equippedIconPack(), 'prismatic');
  assert.match(IconPacks.svg(Meta.equippedIconPack(), IconPacks.iconsOf('prismatic')[0]), /violet-diamond\.png/);
}));

test('cambiar de pack repinta la misma ficha sin alterar su id lógico', () => isolated(() => {
  const prev = { glyphs: Render.glyphs, cellId: Render._cellId, cellPack: Render._cellPack };
  try {
    const iconId = IconPacks.iconsOf('prismatic')[0];
    Render.glyphs = [{ innerHTML: '' }];
    Render._cellId = [];
    Render._cellPack = [];
    Meta.state.cosmetics.iconPack = IconPacks.DEFAULT;
    Render.setGlyph(0, iconId);
    assert.match(Render.glyphs[0].innerHTML, /^<svg\b/);
    Meta.state.cosmetics.iconPacks.prismatic = 1;
    assert.equal(Meta.equipIconPack('prismatic'), true);
    Render.setGlyph(0, iconId);
    assert.match(Render.glyphs[0].innerHTML, /violet-diamond\.png/);
    assert.equal(Render._cellId[0], iconId);
  } finally {
    Render.glyphs = prev.glyphs;
    Render._cellId = prev.cellId;
    Render._cellPack = prev.cellPack;
  }
}));

test('ningún pack raster duplica figuras distintas dentro de un nivel', () => {
  for (const packId of ['nature-basic', 'nature-advanced', 'neon', 'prismatic']) {
    for (let level = 1; level <= 160; level++) {
      const rendered = Engine.poolForLevel(level).map((iconId) => {
        const html = IconPacks.svg(packId, iconId);
        return html.match(/\/([^/]+\.png)"/)[1];
      });
      assert.equal(new Set(rendered).size, rendered.length, `${packId}, nivel ${level}: figura visual duplicada`);
    }
  }
});
