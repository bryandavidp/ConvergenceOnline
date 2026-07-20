'use strict';

// ECO-6: control de la cola de cofres — escalera de Supervivencia limitada por
// día (ECO-60), 4ª ranura = +15% de velocidad de cola (ECO-61) y métricas de
// cola honestas (ECO-62).

const test = require('node:test');
const assert = require('node:assert/strict');

require('./dom-stub.js');
require('../game.js');

const cv = globalThis.window.__cv;
const { Meta, EconomyConfig, State, Survival, CHEST_TYPES } = cv;

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

test('ECO-60: cada tier de la escalera solo entrega su cofre directo una vez al día', () => withRestoredMeta(() => {
  Meta.state.economyDaily = { date: '', survivalGems: 0, survivalChestTiers: {} };
  assert.ok(Meta.claimSurvivalChestTier('wood'), 'primera oleada 10 del día: cae el cofre');
  assert.ok(!Meta.claimSurvivalChestTier('wood'), 'repetir el hito el mismo día: sin cofre directo');
  assert.ok(Meta.claimSurvivalChestTier('bronze'), 'otro tier el mismo día sí cae');
  // Día nuevo: la escalera se rearma entera.
  Meta.state.economyDaily.date = '2020-01-01';
  assert.ok(Meta.claimSurvivalChestTier('wood'));
}));

test('ECO-60: _waveReward reparte cofre directo la primera vez y progreso de pipeline después', () => withRestoredMeta(() => {
  const prev = {
    mode: State.mode, diff: State.diff, coinsRun: State.coinsRun,
    runChests: Survival.runChests, runCoins: Survival.runCoins, runGems: Survival.runGems,
    mut: Survival.mut, golden: Survival.goldenWaveWaves,
  };
  try {
    State.mode = 'supervivencia'; State.diff = 'normal'; State.coinsRun = 0;
    Survival.mut = { id: 'none' }; Survival.runChests = 0; Survival.runCoins = 0; Survival.runGems = 0;
    Survival.goldenWaveWaves = 0;
    Meta.state.economyDaily = { date: new Date().toISOString().slice(0, 10), survivalGems: 0, survivalChestTiers: {} };
    Meta.state.chestPipeline = { wins: 0, cycle: 0 };
    Meta.state.dailyChest = { date: new Date().toISOString().slice(0, 10) }; // sin choice chest de por medio
    const chests0 = Meta.chests();
    Survival._waveReward(10);
    assert.equal(Meta.chests(), chests0 + 1, 'primera oleada 10: +1 cofre directo');
    assert.equal(Meta.state.chestPipeline.wins, 0, 'el cofre directo no toca el pipeline');
    const chests1 = Meta.chests();
    Survival._waveReward(10);
    assert.equal(Meta.chests(), chests1, 'segunda oleada 10 del día: sin cofre directo');
    assert.equal(Meta.state.chestPipeline.wins, 1, 'el hito repetido avanza el pipeline');
  } finally {
    State.mode = prev.mode; State.diff = prev.diff; State.coinsRun = prev.coinsRun;
    Survival.runChests = prev.runChests; Survival.runCoins = prev.runCoins; Survival.runGems = prev.runGems;
    Survival.mut = prev.mut; Survival.goldenWaveWaves = prev.golden;
  }
}));

test('ECO-61: la 4ª ranura acelera los temporizadores un 15% (y sin ella no)', () => withRestoredMeta(() => {
  const m = Meta.state;
  m.chests = 0; m.chestInventory = []; m.chestUnlock = null; m.chestReady = []; m.chestSeq = 0;
  m.chestSlots = 3;
  Meta.addChest(1, 'silver', 'test');
  const chest = Meta.chestInventory()[0];
  const base = CHEST_TYPES.silver.durationMs;
  const started = Meta.startChestUnlock(chest.uid);
  assert.equal(started.durationMs, base, 'con 3 ranuras, duración completa');
  m.chestUnlock = null;
  m.chestSlots = 4;
  const boosted = Meta.startChestUnlock(chest.uid);
  assert.equal(boosted.durationMs, Math.round(base * (1 - EconomyConfig.chests.slotSpeedBonus)), 'con la 4ª ranura, −15%');
  // El coste de "abrir ahora" también parte de la duración efectiva.
  m.chestUnlock = null;
  const skipCost = Meta.chestInstantCost(chest.uid);
  assert.equal(skipCost, Math.max(1, Math.ceil(3 * Math.round(base * 0.85) / 3600000)));
}));

test('ECO-62: chestQueueSummary expone horas pendientes, siguiente cofre y bonus', () => withRestoredMeta(() => {
  const m = Meta.state;
  m.chests = 0; m.chestInventory = []; m.chestUnlock = null; m.chestReady = []; m.chestSeq = 0;
  m.chestSlots = 3;
  const empty = Meta.chestQueueSummary();
  assert.equal(empty.pendingCount, 0);
  assert.equal(empty.nextType, null);
  Meta.addChest(1, 'wood', 'test');
  Meta.addChest(1, 'silver', 'test');
  const summary = Meta.chestQueueSummary();
  assert.equal(summary.pendingCount, 2);
  assert.ok(summary.pendingHours > 0);
  assert.equal(summary.speedBonus, 0);
  // El más corto encabeza la cola automática.
  assert.equal(summary.nextType, 'wood');
  m.chestSlots = 4;
  assert.equal(Meta.chestQueueSummary().speedBonus, EconomyConfig.chests.slotSpeedBonus);
}));

test('ECO-6: el pipeline respeta el tope diario sin perder objetivos', () => withRestoredMeta(() => {
  const m = Meta.state;
  const today = new Date().toISOString().slice(0, 10);
  m.economyDaily = { date: today, survivalGems: 0, survivalChestTiers: {}, pipelineChests: 0 };
  m.chestPipeline = { wins: 0, cycle: 0 };
  m.dailyChest = { date: today }; // el choice diario no interfiere
  const cap = EconomyConfig.chests.pipelineDailyCap;
  const target = Meta.CHEST_PIPELINE_TARGET;
  const chests0 = Meta.chests();
  // Suficientes objetivos para superar el tope del día.
  for (let i = 0; i < (cap + 2) * target; i++) Meta.recordChestProgress('test');
  assert.equal(Meta.chests(), chests0 + cap, 'hoy caen como máximo `cap` cofres del pipeline');
  assert.equal(m.chestPipeline.wins, 2 * target, 'los objetivos sobrantes se conservan');
  // Día nuevo: el primer objetivo drena lo pendiente de uno en uno.
  m.economyDaily.date = '2020-01-01';
  const r = Meta.recordChestProgress('test');
  assert.ok(r.chest, 'mañana, el primer objetivo libera un cofre retenido');
  assert.equal(m.chestPipeline.wins, 2 * target - target + 1, 'consumió un ciclo y contó el objetivo nuevo');
}));

test('ECO-61: unlockChestSlot sigue cobrando y el beneficio queda comunicado en la UI', () => withRestoredMeta(() => {
  Meta.state.chestSlots = 3; Meta.state.gems = 150;
  assert.ok(Meta.unlockChestSlot());
  assert.equal(Meta.chestSlotLimit(), 4);
  assert.equal(Meta.gems(), 0);
  const fs = require('node:fs');
  const path = require('node:path');
  const js = fs.readFileSync(path.join(__dirname, '..', 'game.js'), 'utf8');
  assert.match(js, /chest_queue_boosted/);
  assert.match(js, /15% más rápida para siempre/, 'el coste comunica el beneficio ANTES de pagar');
}));
