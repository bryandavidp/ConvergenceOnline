'use strict';

// ECO-0 (ECO-02): contrato del ledger de auditoría económica (EconomyAudit) y de
// la centralización de números en EconomyConfig (ECO-01).
// Puertas del plan (ECONOMY_REBALANCE_README.md · Fase ECO-0):
//   - Cero cambios en recompensas reales (los valores de EconomyConfig son los de 2.9.3).
//   - Todas las mutaciones de monedas/gemas/tickets de gameplay aparecen en el ledger.
//   - Una misma seed produce un informe económico idéntico.

const test = require('node:test');
const assert = require('node:assert/strict');

require('./dom-stub.js');
require('../game.js');

const cv = globalThis.window.__cv;
const { Meta, EconomyAudit, EconomyConfig, Storefront, Config } = cv;

function metaSnapshot() { return JSON.parse(JSON.stringify(Meta.state)); }
function restoreMeta(snapshot) {
  const state = Meta.state;
  for (const key of Object.keys(state)) delete state[key];
  Object.assign(state, JSON.parse(JSON.stringify(snapshot)));
  localStorage.setItem('cv_meta', JSON.stringify(state));
}
function withRestoredMeta(run) {
  const snapshot = metaSnapshot();
  EconomyAudit.reset();
  try { return run(); }
  finally { restoreMeta(snapshot); EconomyAudit.reset(); }
}
function mulberry32(seed) {
  let s = seed >>> 0;
  return () => {
    let t = (s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('EconomyConfig centraliza los números económicos', () => {
  // ECO-1: la liquidación es un presupuesto con rendimiento decreciente.
  assert.ok(EconomyConfig.settlement.perActiveMinute > 0);
  assert.ok(EconomyConfig.settlement.comboCap > 0);
  assert.ok(EconomyConfig.settlement.modes.default.scoreCoef > 0);
  assert.equal(EconomyConfig.missions.dailyCoins, 60);
  assert.equal(EconomyConfig.missions.weeklyCoins, 200);
  assert.equal(EconomyConfig.loginReward.base, 20);
  assert.equal(EconomyConfig.dailyRun.firstGems, 5);
  assert.equal(EconomyConfig.continueGems, Config.CONTINUE_GEMS);
  assert.deepEqual(Config.BOOSTER_PRICES, EconomyConfig.boosterPrices);
  assert.equal(EconomyConfig.survival.revive.base, 120);
  assert.equal(EconomyConfig.survival.revive.cap, 480);
  assert.equal(EconomyConfig.chests.premiumGems, Meta.PREMIUM_CHEST_GEMS);
  assert.equal(EconomyConfig.chests.slotGems, Meta.CHEST_SLOT_GEMS);
  assert.equal(EconomyConfig.chests.levelScale.cap, 2.5);
  // Las ofertas de la tienda se derivan de EconomyConfig (una sola fuente de verdad).
  assert.equal(Storefront.CURRENCY_OFFERS.length, EconomyConfig.shop.currencyOffers.length);
  assert.equal(Storefront.CURRENCY_OFFERS[0].amount, EconomyConfig.shop.currencyOffers[0].amount);
  assert.equal(Storefront.XP_BOOST_OFFERS[0].durationMs, EconomyConfig.shop.xpOffers[0].hours * 3600000);
  assert.equal(Storefront.CHEST_OFFERS[0].gemCost, EconomyConfig.shop.chestOffers[0].gemCost);
  // Tablas de cofres consumidas por CHEST_TYPES sin duplicación.
  assert.equal(cv.CHEST_TYPES.wood.reward, EconomyConfig.chests.rewards.wood);
  assert.equal(cv.CHEST_TYPES.divine.reward, EconomyConfig.chests.rewards.divine);
});

test('el ledger apagado no registra nada y encendido no altera saldos', () => withRestoredMeta(() => {
  EconomyAudit.enable(false);
  Meta.addCoins(120, 'test');
  assert.equal(EconomyAudit.entries().length, 0);
  EconomyAudit.enable();
  const before = Meta.coins();
  Meta.addCoins(80, 'test-grant');
  assert.equal(Meta.coins(), before + 80);
  const entries = EconomyAudit.entries();
  assert.equal(entries.length, 1);
  assert.equal(entries[0].currency, 'coins');
  assert.equal(entries[0].direction, 'source');
  assert.equal(entries[0].reason, 'test-grant');
  assert.equal(entries[0].amount, 80);
}));

test('las primitivas de gasto registran sinks con motivo (y los fallidos no)', () => withRestoredMeta(() => {
  EconomyAudit.enable();
  Meta.addCoins(500, 'seed');
  Meta.addGems(50, 'seed');
  Meta.addTickets(3, 'seed');
  EconomyAudit.reset();
  assert.ok(Meta.spend(200, 'shop-board'));
  assert.ok(Meta.spendGems(25, 'premium-chest'));
  assert.ok(Meta.spendTicket(1, 'mission-reroll'));
  assert.ok(!Meta.spend(10 ** 9, 'imposible')); // saldo insuficiente: no registra
  const rows = EconomyAudit.summary().rows;
  assert.deepEqual(rows.map((r) => `${r.currency}|${r.direction}|${r.reason}|${r.amount}`), [
    'coins|sink|shop-board|200',
    'gems|sink|premium-chest|25',
    'tickets|sink|mission-reroll|1',
  ]);
}));

test('ganar y abrir un cofre queda auditado de punta a punta', () => withRestoredMeta(() => {
  EconomyAudit.enable();
  EconomyAudit.reset();
  const originalRandom = Math.random;
  try {
    Math.random = mulberry32(0xec0);
    Meta.addChest(1, 'gold', 'test-source');
    const chest = Meta.chestInventory().find((c) => c.type === 'gold' && c.source === 'test-source');
    assert.ok(chest);
    const reward = Meta.openChest(chest.uid);
    assert.ok(reward);
  } finally { Math.random = originalRandom; }
  const summary = EconomyAudit.summary();
  const keys = summary.rows.map((r) => `${r.currency}|${r.direction}|${r.reason}`);
  assert.ok(keys.includes('chests|source|test-source'));
  assert.ok(keys.some((k) => k.startsWith('chests|sink|open:')));
  // La ceremonia siempre incluye las monedas garantizadas.
  assert.ok(keys.includes('coins|source|chest-guaranteed'));
  assert.ok(summary.byCurrency.chests.minted >= 1);
  assert.ok(summary.byCurrency.chests.burned >= 1);
}));

test('recordGame audita la liquidación y claimReward el login diario', () => withRestoredMeta(() => {
  EconomyAudit.enable();
  EconomyAudit.reset();
  Meta.state.daily = { date: new Date().toISOString().slice(0, 10), id: 'm_combo', progress: 0, done: true };
  Meta.state.weekly.done = true;
  Meta.recordGame({ score: 4000, level: 3, maxCombo: 5, removed: 40, elapsed: 120, mode: 'contrarreloj', perfect: false, daily: false });
  const keys = EconomyAudit.summary().rows.map((r) => `${r.currency}|${r.direction}|${r.reason}`);
  assert.ok(keys.includes('coins|source|settlement'));
  EconomyAudit.reset();
  Meta.state.reward = { date: '', day: 0 };
  const amount = Meta.claimReward();
  assert.ok(amount > 0);
  const rows = EconomyAudit.summary().rows;
  assert.deepEqual(rows.map((r) => `${r.currency}|${r.direction}|${r.reason}|${r.amount}`), [
    `coins|source|daily-login|${amount}`,
  ]);
}));

test('misma seed ⇒ informe económico idéntico (determinismo del laboratorio)', () => {
  const runOnce = () => withRestoredMeta(() => {
    EconomyAudit.enable();
    EconomyAudit.reset();
    const originalRandom = Math.random;
    try {
      Math.random = mulberry32(0xdecaf);
      Meta.state.level = 12;
      Meta.addChest(1, 'magic', 'seeded');
      const chest = Meta.chestInventory().find((c) => c.source === 'seeded');
      Meta.openChest(chest.uid);
      Meta.addCoins(123, 'seeded-grant');
      Meta.spend(23, 'seeded-sink');
    } finally { Math.random = originalRandom; }
    const summary = EconomyAudit.summary();
    delete summary.session;
    return JSON.stringify(summary);
  });
  assert.equal(runOnce(), runOnce());
});

test('summary agrega por divisa y reset limpia todo', () => withRestoredMeta(() => {
  EconomyAudit.enable();
  EconomyAudit.reset();
  Meta.addCoins(100, 'a');
  Meta.addCoins(50, 'a');
  Meta.spend(30, 'b');
  const s = EconomyAudit.summary();
  assert.equal(s.byCurrency.coins.minted, 150);
  assert.equal(s.byCurrency.coins.burned, 30);
  assert.equal(s.byCurrency.coins.net, 120);
  assert.equal(s.rows.find((r) => r.reason === 'a').count, 2);
  EconomyAudit.reset();
  assert.equal(EconomyAudit.entries().length, 0);
  assert.deepEqual(EconomyAudit.summary().rows, []);
}));
