'use strict';

// ECO-0 (ECO-03): contrato del forecast económico con políticas de gasto.
// Puertas del plan: el sim mide saldo inicial, minted, burned, saldo final,
// objetos comprados, cofres ganados, horas de cola y reservas; y una misma seed
// produce un informe idéntico. Runs cortas a propósito: esto es CI, no el
// forecast de 180 días (ese vive en ECO-7 / tools).

const test = require('node:test');
const assert = require('node:assert/strict');

const sim = require('../tools/balance-sim.js');

const SMALL = { days: 2, sessionsPerDay: 2, minutesPerSession: 3, profile: 'average', seed: 0xe0f0 };

test('misma seed ⇒ forecast económico idéntico', () => {
  const a = sim.runEconomyForecast(Object.assign({ policy: 'strategic' }, SMALL));
  const b = sim.runEconomyForecast(Object.assign({ policy: 'strategic' }, SMALL));
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

test('saver no quema monedas; collector compra cosméticos si puede', () => {
  const saver = sim.runEconomyForecast(Object.assign({ policy: 'saver' }, SMALL));
  assert.equal(saver.end.flows.coins.burned, 0);
  assert.equal(saver.end.itemsBought, 0);
  assert.ok(saver.end.flows.coins.minted > 0, 'jugar produce monedas');

  const collector = sim.runEconomyForecast(Object.assign({ policy: 'collector' }, SMALL));
  // Con las fuentes de 2.9.3 el collector medio ya puede permitirse compras en 2 días.
  assert.ok(collector.end.itemsBought > 0, 'collector compra objetos del catálogo');
  assert.ok(collector.end.flows.coins.burned > 0, 'collector quema monedas');
  assert.ok(collector.end.balances.coins >= 0 && collector.end.balances.gems >= 0, 'sin saldos negativos');
});

test('el informe expone las medidas requeridas por ECO-03', () => {
  const r = sim.runEconomyForecast(Object.assign({ policy: 'spender' }, SMALL));
  assert.ok(r.start && typeof r.start.coins === 'number');
  assert.ok(r.end && r.end.balances && typeof r.end.balances.coins === 'number');
  ['coins', 'gems', 'tickets', 'chests'].forEach((currency) => {
    assert.ok(r.end.flows[currency], `flujo de ${currency}`);
    assert.ok(r.end.flows[currency].minted >= r.end.flows[currency].net, 'minted ≥ net');
  });
  assert.ok(typeof r.end.chestReserve === 'number');
  assert.ok(typeof r.end.chestQueueHours === 'number');
  assert.ok(typeof r.catalogTotal === 'number' && r.catalogTotal > 0);
  assert.ok(Array.isArray(r.end.reasons) && r.end.reasons.length > 0, 'ledger con motivos');
  // La coherencia contable se sostiene: saldo final = inicial + net del ledger.
  assert.equal(r.end.balances.coins, r.start.coins + r.end.flows.coins.net);
  assert.equal(r.end.balances.gems, r.start.gems + r.end.flows.gems.net);
  assert.equal(r.end.balances.tickets, r.start.tickets + r.end.flows.tickets.net);
});

test('el forecast restaura Meta y el reloj al terminar', () => {
  const before = JSON.stringify(sim.cv.Meta.state);
  sim.runEconomyForecast(Object.assign({ policy: 'spender' }, SMALL, { days: 1 }));
  assert.equal(JSON.stringify(sim.cv.Meta.state), before);
  assert.equal(globalThis.Date.now === undefined, false);
  assert.ok(Math.abs(Date.now() - new Date().getTime()) < 1000, 'Date real restaurado');
});
