'use strict';

// ECO-4: sumideros recurrentes — tienda rotatoria de estilo (ECO-40), precios de
// boosters (ECO-41), revives (ECO-42) y venta directa por gemas (ECO-43).

const test = require('node:test');
const assert = require('node:assert/strict');

require('./dom-stub.js');
require('../game.js');

const cv = globalThis.window.__cv;
const { Meta, StyleShop, Economy, EconomyConfig, Config, PlayerIcons, PlayerBorders } = cv;

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

test('ECO-40: la rotación es determinista por fecha y sale del pool de bases poseídas', () => withRestoredMeta(() => {
  Meta.state.cosmetics.avatarIcons = { nova: 1, comet: 1 };
  Meta.state.cosmetics.avatarBorders = { starlight: 1 };
  Meta.state.cosmetics.avatarIconTints = {};
  Meta.state.cosmetics.avatarBorderTints = {};
  const a = StyleShop.offersFor('2026-03-05');
  const b = StyleShop.offersFor('2026-03-05');
  assert.deepEqual(a, b, 'misma fecha ⇒ misma rotación');
  assert.equal(a.length, EconomyConfig.styleRotation.slots);
  a.forEach((offer) => {
    assert.ok(['icon', 'border'].includes(offer.kind));
    const owned = offer.kind === 'icon' ? Meta.ownsAvatarIcon(offer.base) : Meta.ownsAvatarBorder(offer.base);
    assert.ok(owned, 'solo variantes de bases poseídas');
    assert.ok(offer.price.coins || offer.price.gems, 'toda oferta tiene precio');
  });
  const c = StyleShop.offersFor('2026-03-06');
  assert.notDeepEqual(a, c, 'otro día ⇒ otra selección');
}));

test('ECO-40: comprar una variante exige que esté en la rotación de HOY y cobra según rareza', () => withRestoredMeta(() => {
  Meta.state.cosmetics.avatarIconTints = {};
  Meta.state.cosmetics.avatarBorderTints = {};
  Meta.state.coins = 5000; Meta.state.gems = 500;
  const offers = StyleShop.todayOffers();
  assert.ok(offers.length > 0);
  const offer = offers[0];
  const coinsBefore = Meta.coins(), gemsBefore = Meta.gems();
  assert.ok(Meta.buyStyleVariant(offer.kind, offer.base, offer.tint));
  if (offer.price.coins) {
    assert.equal(Meta.coins(), coinsBefore - offer.price.coins);
    assert.equal(Meta.gems(), gemsBefore);
  } else {
    assert.equal(Meta.gems(), gemsBefore - offer.price.gems);
    assert.equal(Meta.coins(), coinsBefore);
  }
  const owns = offer.kind === 'icon' ? Meta.ownsAvatarIconTint(offer.base, offer.tint) : Meta.ownsAvatarBorderTint(offer.base, offer.tint);
  assert.ok(owns, 'la variante queda en la colección');
  // Fuera de rotación: una variante inventada no se puede comprar.
  assert.equal(Meta.buyStyleVariant('icon', 'nova', 'no-existe'), false);
  // La variante comprada sale del pool: la rotación de hoy ya no la ofrece.
  assert.ok(!StyleShop.todayOffers().some((o) => o.kind === offer.kind && o.base === offer.base && o.tint === offer.tint));
}));

test('ECO-40: equipar tintes exige propiedad y se limpia al cambiar de base sin variante', () => withRestoredMeta(() => {
  Meta.state.cosmetics.avatarIcons = { nova: 1, comet: 1 };
  Meta.state.cosmetics.avatarIconTints = { 'nova:jade': '2026-01-01' };
  Meta.state.cosmetics.avatarIcon = 'nova';
  Meta.state.cosmetics.avatarIconTint = '';
  assert.equal(Meta.equipAvatarIconTint('crimson'), false, 'sin propiedad no se equipa');
  assert.ok(Meta.equipAvatarIconTint('jade'));
  assert.equal(Meta.avatarIconTint(), 'jade');
  // Cambiar a un icono sin esa variante limpia el tinte (nunca luce algo no comprado).
  assert.ok(Meta.equipAvatarIcon('comet'));
  assert.equal(Meta.avatarIconTint(), '');
}));

test('ECO-41/42: loadout máximo 20–35% y 3 revives 50–90% del premio de una run media', () => {
  // Premio esperado de una run media de Supervivencia (perfil medio, 8 min, post-ECO-1).
  const expectedRun = Economy.settlementCoins({ mode: 'supervivencia', score: 114000, elapsed: 480, maxCombo: 20, perfect: false, diff: 'normal' });
  const prices = Object.values(Config.BOOSTER_PRICES).sort((a, b) => b - a);
  const maxLoadout = prices.slice(0, Config.SURVIVAL_LOADOUT_MAX).reduce((a, b) => a + b, 0);
  assert.ok(maxLoadout >= expectedRun * 0.20 && maxLoadout <= expectedRun * 0.35,
    `loadout máx ${maxLoadout} debe caer en [${Math.round(expectedRun * .2)}, ${Math.round(expectedRun * .35)}] (run ${expectedRun})`);
  const rv = EconomyConfig.survival.revive;
  let total = 0;
  for (let i = 0; i < rv.max; i++) total += Math.min(rv.cap, rv.base * Math.pow(2, i));
  assert.ok(total >= expectedRun * 0.5 && total <= expectedRun * 0.9,
    `3 revives ${total} deben caer en [${Math.round(expectedRun * .5)}, ${Math.round(expectedRun * .9)}]`);
  assert.ok(rv.base <= expectedRun * 0.2, 'el primer revive es accesible (≤20% de la run)');
});

test('ECO-43: los iconos/bordes raro+ tienen precio directo en gemas dentro de las bandas del plan', () => withRestoredMeta(() => {
  const bands = { rare: [60, 90], epic: [120, 180], legendary: [120, 180], mythic: [220, 320] };
  [...PlayerIcons.order, ...PlayerBorders.order].forEach(() => {}); // orden estable
  PlayerIcons.order.forEach((id) => {
    const item = PlayerIcons.DEFS[id];
    const price = Meta.avatarIconGemPrice(id);
    if (item.rarity === 'common') assert.equal(price, 0, `${id}: común sin precio en gemas`);
    else assert.ok(price >= bands[item.rarity][0] && price <= bands[item.rarity][1], `${id}: ${price} fuera de banda ${item.rarity}`);
  });
  // Compra real: cobra gemas exactas y concede el asset elegido.
  Meta.state.gems = 500;
  Meta.state.cosmetics.avatarIcons = { nova: 1 };
  const cost = Meta.avatarIconGemPrice('void');
  assert.ok(cost > 0);
  assert.ok(Meta.buyAvatarIconGems('void'));
  assert.equal(Meta.gems(), 500 - cost);
  assert.ok(Meta.ownsAvatarIcon('void'));
  // Sin gemas: falla sin conceder.
  Meta.state.gems = 0;
  assert.equal(Meta.buyAvatarIconGems('pulse'), false);
  assert.ok(!Meta.ownsAvatarIcon('pulse'));
}));

test('ECO-4: existe al menos un sumidero repetible por divisa', () => {
  // Monedas: rotación de estilo (común-épico) + boosters + revives.
  assert.ok(EconomyConfig.styleRotation.price.common.coins > 0);
  assert.ok(Object.keys(Config.BOOSTER_PRICES).length >= 5);
  // Gemas: rotación legendaria/mítica + cofres de tienda + aceleración + premium.
  assert.ok(EconomyConfig.styleRotation.price.legendary.gems > 0);
  assert.ok(EconomyConfig.chests.premiumGems > 0);
  // Tickets: reroll de misión + swap/regen del Choice Chest.
  assert.ok(EconomyConfig.tickets.missionReroll > 0 && EconomyConfig.tickets.choiceSwap > 0 && EconomyConfig.tickets.choiceRegen > 0);
});
