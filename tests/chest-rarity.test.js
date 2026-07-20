'use strict';

// ECO-3: rareza económica de cosméticos (ECO-30), fallback consumible (ECO-32)
// y EV equivalente estrictamente creciente por tier (ECO-33).

const test = require('node:test');
const assert = require('node:assert/strict');

require('./dom-stub.js');
require('../game.js');

const cv = globalThis.window.__cv;
const { Meta, Economy, EconomyConfig, CHEST_TYPE_ORDER, PlayerIcons, PlayerBorders, Themes, Boards } = cv;

function metaSnapshot() { return JSON.parse(JSON.stringify(Meta.state)); }
function restoreMeta(snapshot) {
  const state = Meta.state;
  for (const key of Object.keys(state)) delete state[key];
  Object.assign(state, JSON.parse(JSON.stringify(snapshot)));
  localStorage.setItem('cv_meta', JSON.stringify(state));
}
function withRestoredMeta(run) {
  const snapshot = metaSnapshot();
  try { return run(); }
  finally { restoreMeta(snapshot); }
}
function freshProfile() {
  const m = Meta.state;
  m.boards = { owned: { classic: 1 }, equipped: 'classic' };
  m.cosmetics = { owned: {}, theme: 'default', skin: 'default', fx: 'default', avatarIcon: PlayerIcons.DEFAULT, avatarBorder: PlayerBorders.DEFAULT, avatarIcons: { [PlayerIcons.DEFAULT]: 1 }, avatarBorders: { [PlayerBorders.DEFAULT]: 1 } };
}
function ownEverything() {
  const m = Meta.state;
  Boards.order.forEach((id) => { m.boards.owned[id] = 1; });
  Themes.order.forEach((id) => { if (id !== 'default') m.cosmetics.owned[id] = '2026-01-01'; });
  PlayerIcons.order.forEach((id) => { m.cosmetics.avatarIcons[id] = '2026-01-01'; });
  PlayerBorders.order.forEach((id) => { m.cosmetics.avatarBorders[id] = '2026-01-01'; });
}

test('ECO-30: todos los cosméticos declaran una rareza válida', () => {
  const valid = new Set(['common', 'rare', 'epic', 'legendary', 'mythic']);
  const all = [
    ...PlayerIcons.order.map((id) => PlayerIcons.DEFS[id]),
    ...PlayerBorders.order.map((id) => PlayerBorders.DEFS[id]),
    ...Themes.order.map((id) => Themes.DEFS[id]),
    ...Boards.order.map((id) => Boards.DEFS[id]),
  ];
  all.forEach((item) => assert.ok(valid.has(item.rarity), `${item.name}: rareza '${item.rarity}'`));
});

test('ECO-30: el pool de cada cofre respeta su banda de rarezas', () => withRestoredMeta(() => {
  freshProfile();
  for (const tier of CHEST_TYPE_ORDER) {
    const allowed = new Set(EconomyConfig.cosmetics.rarityByTier[tier]);
    const pool = Meta.chestCosmeticPool(tier);
    assert.ok(pool.length > 0, `${tier}: el pool inicial no está vacío`);
    pool.forEach((item) => assert.ok(allowed.has(item.rarity), `${tier}: ${item.id} (${item.rarity}) fuera de banda`));
  }
  // Un Divino jamás ofrece objetos comunes; un Madera solo comunes.
  assert.ok(Meta.chestCosmeticPool('divine').every((item) => item.rarity !== 'common' && item.rarity !== 'rare'));
  assert.ok(Meta.chestCosmeticPool('wood').every((item) => item.rarity === 'common'));
}));

test('ECO-32: pool agotado (total o del tier) ⇒ fallback consumible, sin divisa', () => withRestoredMeta(() => {
  freshProfile();
  // Parcial: poseer TODOS los comunes agota el pool de madera pero no el de plata.
  [...PlayerIcons.order, ...PlayerBorders.order].forEach((id) => {
    const icon = PlayerIcons.DEFS[id], border = PlayerBorders.DEFS[id];
    if (icon && icon.rarity === 'common') Meta.state.cosmetics.avatarIcons[id] = '2026-01-01';
    if (border && border.rarity === 'common') Meta.state.cosmetics.avatarBorders[id] = '2026-01-01';
  });
  Themes.order.forEach((id) => { if (Themes.DEFS[id].rarity === 'common' && id !== 'default') Meta.state.cosmetics.owned[id] = '2026-01-01'; });
  Boards.order.forEach((id) => { if (Boards.DEFS[id].rarity === 'common') Meta.state.boards.owned[id] = 1; });
  assert.equal(Meta.chestCosmeticPool('wood').length, 0, 'madera agotado');
  assert.ok(Meta.chestCosmeticPool('silver').length > 0, 'plata sigue teniendo raros');
  const originalRandom = Math.random;
  try {
    Math.random = () => 0.5;
    assert.equal(Meta._rollCosmetic('wood'), null);
    const fallback = Meta._cosmeticFallback();
    assert.equal(fallback.kind, 'booster');
    assert.equal(fallback.fallback, 'cosmetic');
    const silverRoll = Meta._rollCosmetic('silver');
    assert.equal(silverRoll.kind, 'cosmetic');
    assert.equal(silverRoll.itemRarity, 'rare');
  } finally { Math.random = originalRandom; }
  // Agotado total: ninguna tirada cosmética devuelve nada en ningún tier.
  ownEverything();
  CHEST_TYPE_ORDER.forEach((tier) => assert.equal(Meta._rollCosmetic(tier), null, tier));
}));

test('ECO-33: el EV equivalente crece estrictamente de Madera a Divino (nivel 1 y 31)', () => {
  const ladder = CHEST_TYPE_ORDER.filter((type) => type !== 'event');
  for (const level of [1, 31]) {
    const evs = ladder.map((type) => Economy.chestEv(type, level));
    for (let i = 1; i < evs.length; i++) {
      assert.ok(evs[i] > evs[i - 1], `nivel ${level}: EV(${ladder[i]})=${evs[i].toFixed(0)} debe superar EV(${ladder[i - 1]})=${evs[i - 1].toFixed(0)}`);
    }
  }
});

test('ECO-33: completar la colección NO aumenta monedas/gemas por cofre (fallback neutro)', () => withRestoredMeta(() => {
  freshProfile();
  ownEverything();
  Meta.state.chests = 0; Meta.state.chestInventory = [];
  Meta.addChest(1, 'divine', 'test');
  const chest = Meta.chestInventory()[0];
  const coinsBefore = Meta.coins(), gemsBefore = Meta.gems();
  const originalRandom = Math.random;
  let reward;
  try {
    // Divine no tiene ruleta de ascenso (no consume random): 0 fija las monedas
    // garantizadas, .99 fuerza la tirada cosmética; el resto alimenta fallback y bonus.
    const seq = [0, .99, 0, .3, .1, .3, .1];
    let i = 0;
    Math.random = () => (i < seq.length ? seq[i++] : 0.3);
    reward = Meta.openChest(chest.uid);
  } finally { Math.random = originalRandom; }
  assert.equal(reward.kind, 'booster');
  assert.equal(reward.fallback, 'cosmetic');
  // Solo entran las monedas garantizadas/bonus normales; el fallback en sí no paga divisa.
  const paidCoins = reward.items.filter((item) => item.kind === 'coins').reduce((sum, item) => sum + item.amount, 0);
  const paidGems = reward.items.filter((item) => item.kind === 'gems').reduce((sum, item) => sum + item.amount, 0);
  assert.equal(Meta.coins() - coinsBefore, paidCoins);
  assert.equal(Meta.gems() - gemsBefore, paidGems);
  assert.ok(!reward.items.some((item) => item.rarity === 'jackpot'), 'el jackpot inflacionario ya no existe');
}));
