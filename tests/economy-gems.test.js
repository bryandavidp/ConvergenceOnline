'use strict';

// ECO-2: contrato de gemas y tickets — tope diario de gemas de Supervivencia
// (ECO-20), escalado separado de monedas/gemas en cofres (ECO-21), Choice Chest
// sin escalado de gemas (ECO-22) y nuevos usos de tickets (ECO-23).

const test = require('node:test');
const assert = require('node:assert/strict');

require('./dom-stub.js');
require('../game.js');

const cv = globalThis.window.__cv;
const { Meta, EconomyConfig, EconomyAudit } = cv;

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
// Crea el Choice Chest del día (listo para elegir) y devuelve su info.
function freshDailyChoice() {
  Meta.state.dailyChest = { date: '' };
  const result = Meta.recordChestProgress('test');
  assert.ok(result.dailyChoice, 'el primer objetivo del día crea el Choice Chest');
  return result.dailyChoice;
}

test('ECO-20: las gemas de Supervivencia respetan el tope diario y se renuevan al cambiar de día', () => withRestoredMeta(() => {
  const cap = EconomyConfig.survival.gemMilestone.dailyCap;
  Meta.state.economyDaily = { date: '', survivalGems: 0, survivalChestTiers: {} };
  const before = Meta.gems();
  assert.equal(Meta.addSurvivalGems(2), 2);
  assert.equal(Meta.addSurvivalGems(2), 2);
  assert.equal(Meta.addSurvivalGems(4), cap - 4, 'la última concesión se recorta al cupo restante');
  assert.equal(Meta.survivalGemsLeftToday(), 0);
  assert.equal(Meta.addSurvivalGems(2), 0, 'tope alcanzado: no concede nada');
  assert.equal(Meta.gems(), before + cap);
  // Día nuevo: cupo íntegro otra vez.
  Meta.state.economyDaily.date = '2020-01-01';
  assert.equal(Meta.survivalGemsLeftToday(), cap);
}));

test('ECO-20: la migración inicializa economyDaily sin castigar el día de actualización', () => {
  assert.ok(Meta.state.economyDaily);
  assert.equal(typeof Meta.state.economyDaily.survivalGems, 'number');
  assert.ok(Meta.survivalGemsLeftToday() >= 0);
});

test('ECO-21: en cofres, las monedas escalan hasta ×2.0 y las gemas no escalan', () => {
  const woodBase = EconomyConfig.chests.rewards.wood;
  const oddsL1 = cv.chestOdds('wood', 1);
  const oddsL31 = cv.chestOdds('wood', 31);
  assert.equal(oddsL1.coins.max, woodBase.coins[1]);
  assert.equal(oddsL31.coins.max, Math.round(woodBase.coins[1] * 2.0), 'monedas topadas en ×2.0');
  assert.equal(oddsL31.gems.min, woodBase.gems[0], 'gemas sin escalado');
  assert.equal(oddsL31.gems.max, woodBase.gems[1], 'gemas sin escalado');
  assert.equal(oddsL31.tickets.max, woodBase.tickets[1], 'tickets sin escalado');
});

test('ECO-22: la opción de gemas del Choice Chest usa rango fijo por tier, sin nivel', () => withRestoredMeta(() => {
  Meta.state.level = 31;
  const [lo, hi] = EconomyConfig.chests.choiceGems.bronze;
  for (let i = 0; i < 6; i++) {
    const choice = freshDailyChoice();
    const gems = choice.choice.options.find((option) => option.id === 'gems');
    assert.ok(gems, 'siempre existe la opción de gemas');
    assert.ok(gems.amount >= lo && gems.amount <= hi, `gemas ${gems.amount} fuera de [${lo},${hi}] a nivel 31`);
    Meta.claimChestChoice(choice.uid, 'coins');
  }
}));

test('ECO-23: sustituir una opción cuesta 1 ticket, añade la clase que falta y solo funciona una vez', () => withRestoredMeta(() => {
  const choice = freshDailyChoice();
  Meta.state.tickets = 5;
  const kinds = new Set(choice.choice.options.map((option) => option.kind));
  const missing = ['coins', 'gems', 'ticket', 'booster'].find((kind) => !kinds.has(kind));
  const updated = Meta.swapChestChoiceOption(choice.uid, 'coins');
  assert.ok(updated, 'swap válido');
  assert.equal(Meta.tickets(), 5 - EconomyConfig.tickets.choiceSwap);
  const newKinds = updated.choice.options.map((option) => option.kind);
  assert.ok(newKinds.includes(missing), 'la opción nueva es la clase ausente');
  assert.ok(!updated.choice.options.some((option) => option.id === 'coins'), 'la opción sustituida desaparece');
  assert.equal(new Set(updated.choice.options.map((o) => o.id)).size, 3, 'ids únicos: el cofre sigue siendo válido');
  assert.equal(Meta.swapChestChoiceOption(choice.uid, updated.choice.options[0].id), null, 'máximo un swap por cofre');
  assert.equal(Meta.tickets(), 5 - EconomyConfig.tickets.choiceSwap, 'el swap rechazado no cobra');
}));

test('ECO-23: regenerar las tres opciones cuesta 2 tickets y solo una vez por cofre', () => withRestoredMeta(() => {
  const choice = freshDailyChoice();
  Meta.state.tickets = 3;
  const updated = Meta.regenerateChestChoice(choice.uid);
  assert.ok(updated);
  assert.equal(Meta.tickets(), 3 - EconomyConfig.tickets.choiceRegen);
  assert.equal(updated.choice.options.length, 3);
  assert.equal(new Set(updated.choice.options.map((o) => o.id)).size, 3);
  assert.equal(Meta.regenerateChestChoice(choice.uid), null, 'máximo una regeneración');
  assert.equal(Meta.tickets(), 3 - EconomyConfig.tickets.choiceRegen);
}));

test('ECO-23: sin tickets suficientes las acciones fallan sin mutar el cofre', () => withRestoredMeta(() => {
  const choice = freshDailyChoice();
  Meta.state.tickets = 0;
  const before = JSON.stringify(choice.choice.options);
  assert.equal(Meta.swapChestChoiceOption(choice.uid, 'coins'), null);
  assert.equal(Meta.regenerateChestChoice(choice.uid), null);
  const after = Meta.chestChoiceInfo(choice.uid);
  assert.equal(JSON.stringify(after.choice.options), before, 'opciones intactas');
  assert.ok(!after.choice.swapped && !after.choice.regenerated);
  // Y el cofre sigue siendo reclamable con normalidad.
  assert.ok(Meta.claimChestChoice(choice.uid, 'gems'));
}));
