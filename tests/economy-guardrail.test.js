'use strict';

// ECO-7: guardarraíles de CI de la economía (ECONOMY_REBALANCE_README.md · Fase ECO-7).
// Corren forecasts REALES (partidas completas + políticas de gasto) con seed fija,
// en horizontes cortos pero representativos para que CI siga siendo viable:
//   - catálogo (25 días · collector medio)      → no puede completarse antes de 25.
//   - gemas (14 días · intensivo acumulador)    → ≤21/día (proxy del ≤20 a 30 días).
//   - tickets/reserva/gasto (21 días · strategic medio).
// Los guardarraíles de dominancia de ofertas viven en economy-dominance.test.js y
// el de fallback con pool agotado en chest-rarity.test.js. El de crecimiento P90
// post-día-90 es de horizonte largo: se verifica con la matriz documentada en
// docs/ECONOMY_BASELINE.md (comandos CLI incluidos), no en CI.

const test = require('node:test');
const assert = require('node:assert/strict');

const sim = require('../tools/balance-sim.js');

test('guardarraíl: el jugador medio no completa el catálogo antes de 25 días', () => {
  const r = sim.runEconomyForecast({
    days: 25, daysPerWeek: 6, sessionsPerDay: 2, minutesPerSession: 10,
    policy: 'collector', profile: 'average', seed: 0xec07, checkpoints: [25],
  });
  assert.ok(r.catalogDoneDay === null || r.catalogDoneDay >= 25,
    `catálogo completado el día ${r.catalogDoneDay} (<25): las fuentes de monedas se han inflado`);
});

test('guardarraíl: el jugador intensivo no supera ~20 gemas/día de media', () => {
  const r = sim.runEconomyForecast({
    days: 14, daysPerWeek: 7, sessionsPerDay: 6, minutesPerSession: 10,
    policy: 'saver', profile: 'skilled', seed: 0xec07, checkpoints: [14],
  });
  const perDay = r.end.flows.gems.minted / 14;
  // Umbral 21 = gate de 20/día a 30 días + margen por el horizonte corto del proxy.
  assert.ok(perDay <= 21, `gemas/día = ${perDay.toFixed(1)} > 21: alguna fuente premium se ha inflado`);
});

test('guardarraíl: bajo strategic, tickets estables, reserva procesable y gasto real', () => {
  const r = sim.runEconomyForecast({
    days: 21, daysPerWeek: 6, sessionsPerDay: 2, minutesPerSession: 10,
    policy: 'strategic', profile: 'average', seed: 0xec07, checkpoints: [21],
  });
  // Tickets: no crecen sin freno (los sumideros de ECO-23 funcionan).
  assert.ok(r.end.flows.tickets.burned > 0, 'strategic debe gastar tickets');
  assert.ok(r.end.balances.tickets <= 12,
    `tickets acumulados ${r.end.balances.tickets} > 12: los sumideros no absorben el flujo`);
  // Reserva de cofres procesable (proxy de "P50 estable a 14 días").
  assert.ok(r.end.chestReserve <= 8,
    `reserva ${r.end.chestReserve} cofres > 8: la cola vuelve a crecer sin control`);
  // Gasto semanal significativo (puerta ECO-4): al menos 45% de lo ganado.
  const burnRatio = r.end.flows.coins.burned / Math.max(1, r.end.flows.coins.minted);
  assert.ok(burnRatio >= 0.45,
    `strategic solo quema ${(burnRatio * 100).toFixed(0)}% de sus monedas (<45%): faltan sumideros atractivos`);
  // Y nunca saldos negativos.
  assert.ok(r.end.balances.coins >= 0 && r.end.balances.gems >= 0 && r.end.balances.tickets >= 0);
});
