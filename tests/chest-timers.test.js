'use strict';

// CH-3 (docs/CHEST_SYSTEM_MASTER_PLAN.md §5): duraciones consolidadas con tarifa
// plana de gemas, cofres listos que no bloquean y auto-encadenado del siguiente
// temporizador (también offline, anclado al instante exacto de la finalización).

const test = require('node:test');
const assert = require('node:assert/strict');

require('./dom-stub.js');
require('../game.js');

const { Meta, CHEST_TYPES, CHEST_TYPE_ORDER } = globalThis.window.__cv;

const HOUR = 60 * 60 * 1000;

function fullSnapshot() { return JSON.parse(JSON.stringify(Meta.state)); }
function restore(snap) {
  const m = Meta.state;
  for (const k of Object.keys(m)) delete m[k];
  Object.assign(m, snap);
}
function resetChests(m) {
  m.chests = 0; m.chestInventory = []; m.chestUnlock = null; m.chestReady = [];
}
function withRandomSequence(sequence, fn) {
  const previous = Math.random;
  let index = 0;
  Math.random = () => sequence[Math.min(index++, sequence.length - 1)];
  try { return fn(); }
  finally { Math.random = previous; }
}

test('timers: duraciones consolidadas (3/8/12/24/36 h) y tarifa plana de 3 gemas/hora', () => {
  const allowed = new Set([3, 8, 12, 24, 36]);
  for (const id of CHEST_TYPE_ORDER) {
    const defn = CHEST_TYPES[id];
    const hours = defn.durationMs / HOUR;
    assert.ok(allowed.has(hours), `${id}: ${hours}h fuera del set legible`);
    assert.equal(defn.instantCost, hours * 3, `${id}: la tarifa debe ser exactamente 3 gemas/hora`);
  }
});

test('timers: al completarse un desbloqueo, el más corto en espera se encadena solo (offline)', () => {
  const snap = fullSnapshot(), m = Meta.state;
  try {
    resetChests(m);
    Meta.addChest(1, 'silver', 'test'); // 8 h
    Meta.addChest(1, 'wood', 'test');   // 3 h (el más corto: debe encadenarse primero)
    Meta.addChest(1, 'gold', 'test');   // 8 h
    const [silver, wood, gold] = Meta.chestInventory().map((c) => c.uid);
    Meta.startChestUnlock(silver);
    // Simula que terminó hace 4 h: madera encadena en ese instante (3 h → también
    // terminada hace 1 h) y oro arranca hace 1 h.
    m.chestUnlock.startedAt = Date.now() - 12 * HOUR;
    m.chestUnlock.endsAt = Date.now() - 4 * HOUR;
    const ready = Meta.chestReadyUids();
    assert.deepEqual(ready.sort(), [silver, wood].sort());
    const unlock = Meta.chestUnlock();
    assert.equal(unlock.uid, gold);
    assert.equal(unlock.auto, true, 'el encadenado queda marcado como automático');
    assert.ok(Math.abs(unlock.remainingMs - 7 * HOUR) < 5000, `restante ≈7h, fue ${unlock.remainingMs}`);
  } finally { restore(snap); }
});

test('timers: recoger un cofre arranca solo el siguiente más corto', () => {
  const snap = fullSnapshot(), m = Meta.state;
  try {
    resetChests(m);
    Meta.addChest(1, 'gold', 'test');
    Meta.addChest(1, 'wood', 'test');
    const [gold, wood] = Meta.chestInventory().map((c) => c.uid);
    withRandomSequence([0, 0], () => Meta.openChest(gold));
    const unlock = Meta.chestUnlock();
    assert.ok(unlock, 'tras recoger debe quedar un temporizador en curso');
    assert.equal(unlock.uid, wood);
    assert.equal(unlock.auto, true);
  } finally { restore(snap); }
});

test('timers: un cofre listo cuesta 0 y uno en espera con otro en curso cobra tarifa completa', () => {
  const snap = fullSnapshot(), m = Meta.state;
  try {
    resetChests(m);
    Meta.addChest(1, 'wood', 'test');
    Meta.addChest(1, 'magic', 'test');
    const [wood, magic] = Meta.chestInventory().map((c) => c.uid);
    Meta.startChestUnlock(wood);
    m.chestUnlock.endsAt = Date.now() - 1; // madera lista → mágico encadena
    assert.equal(Meta.chestInstantCost(wood), 0);
    assert.equal(Meta.chestTimerState(magic), 'running');
    // El mágico acaba de arrancar: la omisión ronda la tarifa completa.
    const cost = Meta.chestInstantCost(magic);
    assert.ok(cost >= CHEST_TYPES.magic.instantCost - 1 && cost <= CHEST_TYPES.magic.instantCost, String(cost));
  } finally { restore(snap); }
});
