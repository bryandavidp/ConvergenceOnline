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

test('Joyas Prisma registra los diez PNG transparentes del diseño', () => {
  assert.equal(IconPacks.DEFS.prismatic.rarity, 'legendary');
  assert.equal(IconPacks.DEFS.prismatic.cost, 1800);
  assert.equal(IconPacks.PRISMATIC_ASSETS.length, 10);
  assert.equal(IconPacks.iconsOf('prismatic').length, 10);

  for (const asset of IconPacks.PRISMATIC_ASSETS) {
    const file = path.join(__dirname, '..', 'img', 'icon-packs', 'prismatic-jewels', asset.file);
    const png = fs.readFileSync(file);
    assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], `${asset.file}: firma PNG`);
    assert.equal(png.readUInt32BE(16), 512, `${asset.file}: ancho`);
    assert.equal(png.readUInt32BE(20), 512, `${asset.file}: alto`);
    assert.equal(png[25], 6, `${asset.file}: debe conservar RGBA`);
  }
});

test('el renderer conserva SVG para Cosmos y usa IMG para Joyas Prisma', () => {
  const iconId = IconPacks.iconsOf('prismatic')[0];
  assert.match(IconPacks.svg('cosmos', iconId), /^<svg\b/);
  assert.match(IconPacks.svg('prismatic', iconId), /^<img\b/);
  assert.match(IconPacks.svg('prismatic', iconId), /violet-diamond\.png/);
});

test('Joyas Prisma usa su miniatura generada en tienda y coleccion', () => {
  const file = path.join(__dirname, '..', 'img', 'icon-packs', 'prismatic-jewels', 'thumbnail.png');
  const png = fs.readFileSync(file);
  assert.equal(png.readUInt32BE(16), 512, 'ancho de miniatura');
  assert.equal(png.readUInt32BE(20), 512, 'alto de miniatura');
  assert.equal(png[25], 6, 'la miniatura conserva RGBA');
  assert.match(IconPacks.previewHtml('prismatic'), /class="iconpack-thumbnail"/);
  assert.match(IconPacks.previewHtml('prismatic'), /prismatic-jewels\/thumbnail\.png/);
  assert.match(IconPacks.previewHtml('cosmos'), /class="iconpack-collage"/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8'), /'golden-star','thumbnail'/);
});

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

test('ningún nivel muestra dos ids distintos con la misma joya', () => {
  for (let level = 1; level <= 160; level++) {
    const rendered = Engine.poolForLevel(level).map((iconId) => {
      const html = IconPacks.svg('prismatic', iconId);
      return html.match(/\/([^/]+\.png)"/)[1];
    });
    assert.equal(new Set(rendered).size, rendered.length, `nivel ${level}: joya visual duplicada`);
  }
});
