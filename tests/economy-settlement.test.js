'use strict';

// ECO-1: contrato de la liquidación de monedas (Economy.settlementCoins),
// de la recompensa por nivel de Clásico (ECO-11) y del presupuesto anti doble
// pago de las runs (ECO-12). Ver docs/ECONOMY_REBALANCE_README.md · Fase ECO-1.

const test = require('node:test');
const assert = require('node:assert/strict');

require('./dom-stub.js');
require('../game.js');

const cv = globalThis.window.__cv;
const { Meta, Economy, EconomyConfig, EconomyAudit } = cv;

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

const baseCtx = { mode: 'contrarreloj', elapsed: 240, maxCombo: 12, perfect: false, diff: 'normal' };

test('ECO-10: el score tiene rendimiento decreciente (x4 score < x2 monedas)', () => {
  const one = Economy.settlementCoins(Object.assign({}, baseCtx, { score: 10000 }));
  const four = Economy.settlementCoins(Object.assign({}, baseCtx, { score: 40000 }));
  assert.ok(four > one, 'más score debe pagar más');
  assert.ok(four < 2 * one, `rendimiento decreciente: ${four} debe ser < 2×${one}`);
});

test('ECO-10: el combo está acotado y la duración activa paga por minuto', () => {
  const combo10 = Economy.settlementCoins(Object.assign({}, baseCtx, { score: 5000, maxCombo: 10 }));
  const combo99 = Economy.settlementCoins(Object.assign({}, baseCtx, { score: 5000, maxCombo: 99 }));
  assert.equal(combo99 - combo10, EconomyConfig.settlement.comboCap - 10, 'el combo satura en comboCap');
  const short = Economy.settlementCoins(Object.assign({}, baseCtx, { score: 5000, elapsed: 60 }));
  const long = Economy.settlementCoins(Object.assign({}, baseCtx, { score: 5000, elapsed: 600 }));
  assert.equal(long - short, Math.round(9 * EconomyConfig.settlement.perActiveMinute), 'el tiempo activo paga lineal');
});

test('ECO-10: la dificultad multiplica y los modos sin fin no cobran bonus de perfect', () => {
  const normal = Economy.settlementCoins(Object.assign({}, baseCtx, { mode: 'supervivencia', score: 20000 }));
  const hard = Economy.settlementCoins(Object.assign({}, baseCtx, { mode: 'supervivencia', score: 20000, diff: 'dificil' }));
  assert.ok(hard > normal, 'difícil paga más');
  const perfectEndless = Economy.settlementCoins(Object.assign({}, baseCtx, { mode: 'zen', score: 5000, perfect: true }));
  const noPerfectEndless = Economy.settlementCoins(Object.assign({}, baseCtx, { mode: 'zen', score: 5000, perfect: false }));
  assert.equal(perfectEndless, noPerfectEndless, 'zen/contrarreloj/supervivencia ya pagan el tablero limpio en la run');
  const perfectAdv = Economy.settlementCoins(Object.assign({}, baseCtx, { mode: 'aventura', score: 5000, perfect: true }));
  const noPerfectAdv = Economy.settlementCoins(Object.assign({}, baseCtx, { mode: 'aventura', score: 5000, perfect: false }));
  assert.ok(perfectAdv > noPerfectAdv, 'aventura sí cobra el objetivo');
});

test('ECO-12: lo pagado durante la run se descuenta y la liquidación nunca es negativa', () => withRestoredMeta(() => {
  // Misiones fuera: sus bonus se miden aparte (puerta ECO-1).
  Meta.state.daily = { date: new Date().toISOString().slice(0, 10), id: 'm_combo', progress: 0, done: true };
  Meta.weeklyChallenge(); Meta.state.weekly.done = true;
  const ctx = { score: 20000, level: 1, maxCombo: 10, removed: 100, elapsed: 300, mode: 'supervivencia', perfect: false, daily: true, diff: 'normal' };
  const budget = Economy.settlementCoins(ctx);
  assert.ok(budget > 100, 'presupuesto razonable para la comparación');
  const clean = Meta.recordGame(Object.assign({}, ctx));
  assert.equal(clean.coinsGained, budget, 'sin pagos en run, la liquidación es el presupuesto completo');
  const partial = Meta.recordGame(Object.assign({}, ctx, { paidDuringRun: 100 }));
  assert.equal(partial.coinsGained, budget - 100, 'lo ya pagado se descuenta');
  const overpaid = Meta.recordGame(Object.assign({}, ctx, { paidDuringRun: budget + 5000 }));
  assert.equal(overpaid.coinsGained, 0, 'nunca negativa');
}));

test('ECO-11: Clásico paga por nivel con término de score acotado, racha ≤25% y factor de tiempo', () => {
  const c = EconomyConfig.classic;
  const slow = Economy.classicLevelCoins({ stars: 3, score: 4000, winStreak: 1, elapsed: 120 });
  const fast = Economy.classicLevelCoins({ stars: 3, score: 4000, winStreak: 1, elapsed: 10 });
  assert.ok(fast.coins < slow.coins, 'farmear niveles triviales paga menos');
  assert.equal(fast.coins, Math.round((c.base + 3 * c.perStar + Math.min(c.scoreCap, 4000 / c.scoreDiv)) * c.timeFactor.floor));
  const capped = Economy.classicLevelCoins({ stars: 3, score: 10 ** 9, winStreak: 99, elapsed: 600 });
  const uncapped = Economy.classicLevelCoins({ stars: 3, score: 10 ** 9, winStreak: 1, elapsed: 600 });
  assert.equal(capped.streakPct, c.streakPctCap, 'racha saturada en el tope');
  assert.equal(capped.coins, Math.round(uncapped.coins * (1 + c.streakPctCap / 100)));
  assert.equal(uncapped.coins, Math.round(c.base + 3 * c.perStar + c.scoreCap), 'score acotado en scoreCap');
});

test('ECO-1: awardBaseCoins=false (Clásico) sigue sin liquidar el presupuesto global', () => withRestoredMeta(() => {
  Meta.state.daily = { date: new Date().toISOString().slice(0, 10), id: 'm_combo', progress: 0, done: true };
  Meta.weeklyChallenge(); Meta.state.weekly.done = true;
  const r = Meta.recordGame({ score: 50000, level: 5, maxCombo: 20, removed: 100, elapsed: 300, mode: 'clasico', perfect: true, daily: true, awardBaseCoins: false, diff: 'normal' });
  assert.equal(r.coinsGained, 0);
}));
