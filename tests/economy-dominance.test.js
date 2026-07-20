'use strict';

// ECO-5: reprecio coherente de tienda — ratio interno (ECO-50), packs de monedas
// (ECO-51), cofre premium (ECO-52), precios de cofres por EV (ECO-53) y tests de
// dominancia: ninguna oferta puede quedar estrictamente dominada por otra más barata.

const test = require('node:test');
const assert = require('node:assert/strict');

require('./dom-stub.js');
require('../game.js');

const cv = globalThis.window.__cv;
const { Meta, Economy, EconomyConfig, Storefront } = cv;

function mulberry32(seed) {
  let s = seed >>> 0;
  return () => {
    let t = (s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function metaSnapshot() { return JSON.parse(JSON.stringify(Meta.state)); }
function restoreMeta(snapshot) {
  const state = Meta.state;
  for (const key of Object.keys(state)) delete state[key];
  Object.assign(state, JSON.parse(JSON.stringify(snapshot)));
  localStorage.setItem('cv_meta', JSON.stringify(state));
}

test('ECO-50: el ratio interno de valor es 1 gema = 10 monedas', () => {
  assert.equal(EconomyConfig.valuation.gem, 10);
});

test('ECO-51: dentro de cada divisa, más precio ⇒ más cantidad y mejor eficiencia, pero ≤ +35%', () => {
  ['coins', 'gems'].forEach((kind) => {
    const offers = Storefront.CURRENCY_OFFERS.filter((offer) => offer.kind === kind)
      .slice().sort((a, b) => a.priceEur - b.priceEur);
    assert.ok(offers.length >= 2);
    const baseEff = offers[0].amount / offers[0].priceEur;
    for (let i = 1; i < offers.length; i++) {
      assert.ok(offers[i].amount > offers[i - 1].amount, `${kind}: más caro debe dar más cantidad`);
      const eff = offers[i].amount / offers[i].priceEur;
      const prevEff = offers[i - 1].amount / offers[i - 1].priceEur;
      assert.ok(eff >= prevEff, `${kind}: la eficiencia nunca empeora al subir (${offers[i].id})`);
      assert.ok(eff <= baseEff * 1.35, `${kind}: ${offers[i].id} mejora ${(eff / baseEff - 1) * 100 | 0}% > 35% sobre el pack base`);
    }
  });
});

test('ECO-53: los cofres vendidos tienen EV/gema no decreciente y mejora total moderada', () => {
  const offers = Storefront.CHEST_OFFERS;
  const perGem = offers.map((offer) => Economy.chestEv(offer.id, 1) / offer.gemCost);
  for (let i = 1; i < perGem.length; i++) {
    assert.ok(perGem[i] >= perGem[i - 1] - 0.01, `${offers[i].id}: valor/gema no puede empeorar (${perGem[i].toFixed(2)} < ${perGem[i - 1].toFixed(2)})`);
  }
  const improvement = perGem[perGem.length - 1] / perGem[0];
  assert.ok(improvement <= 1.6, `mejora total ${improvement.toFixed(2)}x debe ser moderada (≤1.6x)`);
  // Y ninguna oferta de cofre queda dominada: el precio absoluto siempre sube.
  for (let i = 1; i < offers.length; i++) assert.ok(offers[i].gemCost > offers[i - 1].gemCost);
});

test('ECO-52: el premium cuesta 60, nunca suelta gemas y no domina (ni es dominado por) las alternativas', () => {
  assert.equal(Meta.PREMIUM_CHEST_GEMS, 60);
  const snapshot = metaSnapshot();
  const originalRandom = Math.random;
  const v = EconomyConfig.valuation;
  let totalEquiv = 0;
  const opens = 300;
  try {
    Math.random = mulberry32(0x5e5e);
    const m = Meta.state;
    m.level = 1;
    // Colección completa: medimos solo el valor en recursos (peor caso, sin cosmético).
    cv.Boards.order.forEach((id) => { m.boards.owned[id] = 1; });
    cv.Themes.order.forEach((id) => { if (id !== 'default') m.cosmetics.owned[id] = 'x'; });
    cv.PlayerIcons.order.forEach((id) => { m.cosmetics.avatarIcons[id] = 'x'; });
    cv.PlayerBorders.order.forEach((id) => { m.cosmetics.avatarBorders[id] = 'x'; });
    for (let i = 0; i < opens; i++) {
      m.gems = 60;
      const before = { coins: Meta.coins(), tickets: Meta.tickets() };
      const reward = Meta.openPremiumChest();
      assert.ok(reward, 'con 60 gemas siempre abre');
      assert.ok(!reward.items.some((item) => item.kind === 'gems'), 'el premium jamás devuelve gemas');
      const boosters = reward.items.filter((item) => item.kind === 'booster').length;
      totalEquiv += (Meta.coins() - before.coins) + (Meta.tickets() - before.tickets) * v.ticket + boosters * v.booster;
    }
  } finally {
    Math.random = originalRandom;
    restoreMeta(snapshot);
  }
  const avgEquiv = totalEquiv / opens;
  const coinsFor60Gems = 60 * v.gem; // vía alternativa: comprar monedas directas
  assert.ok(avgEquiv >= coinsFor60Gems * 0.7, `EV premium ${avgEquiv.toFixed(0)} no puede quedar dominado (<70% de ${coinsFor60Gems})`);
  assert.ok(avgEquiv <= coinsFor60Gems * 1.15, `EV premium ${avgEquiv.toFixed(0)} no puede dominar claramente comprar monedas (>115%)`);
  // Y contra el cofre mágico vendido (mismo orden de precio): ninguna vía aplasta a la otra.
  const magicOffer = Storefront.CHEST_OFFERS.find((offer) => offer.id === 'magic');
  const magicPerGem = Economy.chestEv('magic', 1) / magicOffer.gemCost;
  const premiumPerGem = avgEquiv / 60;
  const ratio = premiumPerGem / magicPerGem;
  assert.ok(ratio >= 0.65 && ratio <= 1.35, `premium/mágico = ${ratio.toFixed(2)} debe quedar en [0.65, 1.35]`);
});

test('ECO-54: los boosters de XP se comunican como progresión (nota visible ES/EN)', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const js = fs.readFileSync(path.join(__dirname, '..', 'game.js'), 'utf8');
  assert.match(js, /xp_progression_note/, 'la tarjeta de XP lleva la nota de progresión');
  assert.match(js, /resource-xp-note/, 'nota renderizada en la tarjeta');
});
