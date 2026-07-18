'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

require('./dom-stub.js');
require('../game.js');

const { Meta, CHEST_TYPES, CHEST_TYPE_ORDER } = globalThis.window.__cv;
const styles = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');

function snapshot() {
  const m = Meta.state;
  return JSON.parse(JSON.stringify({
    coins: m.coins,
    gems: m.gems,
    tickets: m.tickets,
    chests: m.chests,
    chestInventory: m.chestInventory,
    chestUnlock: m.chestUnlock,
    chestSlots: m.chestSlots,
    chestSeq: m.chestSeq,
    boards: m.boards,
    cosmetics: m.cosmetics,
  }));
}

function restore(snap) { Object.assign(Meta.state, snap); }

function withRandomSequence(sequence, fn) {
  const previous = Math.random;
  let index = 0;
  Math.random = () => sequence[Math.min(index++, sequence.length - 1)];
  try { return fn(); }
  finally { Math.random = previous; }
}

test('cofres: catálogo completo con diez atlas y cuatro niveles visuales', () => {
  assert.deepEqual(CHEST_TYPE_ORDER, ['wood', 'bronze', 'silver', 'gold', 'magic', 'royal', 'supreme', 'champion', 'divine', 'event']);
  for (const id of CHEST_TYPE_ORDER) {
    const chest = CHEST_TYPES[id];
    assert.equal(chest.id, id);
    assert.match(chest.asset, new RegExp(`/atlas/${id}\\.png$`));
    assert.ok(chest.durationMs >= 3 * 60 * 60 * 1000);
    assert.ok(chest.instantCost > 0);
    assert.ok(chest.reward.ticketCut <= 1);
  }
});

test('cofres: migra el contador histórico a inventario de madera sin tiradas aleatorias', () => {
  const snap = snapshot(), m = Meta.state;
  try {
    m.chests = 2;
    m.chestInventory = [];
    m.chestUnlock = null;
    let randomCalls = 0;
    const previous = Math.random;
    Math.random = () => { randomCalls++; return .5; };
    try {
      const inventory = Meta.chestInventory();
      assert.equal(inventory.length, 2);
      assert.deepEqual(inventory.map((chest) => chest.type), ['wood', 'wood']);
      assert.equal(randomCalls, 0);
    } finally { Math.random = previous; }
  } finally { restore(snap); }
});

test('cofres: un desbloqueo persiste, calcula omisión proporcional y queda listo', () => {
  const snap = snapshot(), m = Meta.state;
  try {
    m.chests = 0; m.chestInventory = []; m.chestUnlock = null; m.chestSeq = 0;
    Meta.addChest(1, 'wood', 'test');
    const chest = Meta.chestInventory()[0];
    const started = Meta.startChestUnlock(chest.uid);
    assert.equal(started.uid, chest.uid);
    assert.equal(started.ready, false);
    assert.equal(Meta.chestInstantCost(chest.uid), CHEST_TYPES.wood.instantCost);

    m.chestUnlock.endsAt = Date.now() - 1;
    const ready = Meta.chestUnlock();
    assert.equal(ready.ready, true);
    assert.equal(ready.remainingMs, 0);
    assert.equal(Meta.chestInstantCost(chest.uid), 0);

    const reward = withRandomSequence([0, 0], () => Meta.openChest(chest.uid));
    assert.equal(reward.kind, 'coins');
    assert.equal(reward.amount, 60);
    assert.equal(reward.chestType, 'wood');
    assert.equal(Meta.chests(), 0);
    assert.equal(Meta.chestUnlock(), null);
  } finally { restore(snap); }
});

test('cofres: las tablas de alto nivel escalan premio y la cuarta ranura cuesta gemas', () => {
  const snap = snapshot(), m = Meta.state;
  try {
    m.chests = 0; m.chestInventory = []; m.chestUnlock = null; m.chestSlots = 3; m.chestSeq = 0;
    m.coins = 0; m.gems = Meta.CHEST_SLOT_GEMS; m.tickets = 0;
    Meta.addChest(1, 'divine', 'test');
    const divine = Meta.chestInventory()[0];
    const reward = withRandomSequence([0, 0], () => Meta.openChest(divine.uid));
    assert.equal(reward.kind, 'coins');
    assert.equal(reward.amount, 1000);
    assert.equal(reward.rarity, 'mythic');
    assert.equal(reward.chestType, 'divine');

    assert.equal(Meta.unlockChestSlot(), true);
    assert.equal(Meta.chestSlotLimit(), 4);
    assert.equal(m.gems, 0);
    assert.equal(Meta.unlockChestSlot(), true, 'desbloquear de nuevo debe ser idempotente');
  } finally { restore(snap); }
});

test('cofres: el layout móvil prioriza cofre y acciones desde iPhone SE', () => {
  assert.match(styles, /COFRES 3\.1 · responsive móvil orientado a tarea/);
  assert.match(styles, /@media \(max-width: 599px\)/);
  assert.match(styles, /min-height:\s*clamp\(250px,\s*32svh,\s*288px\)/);
  assert.match(styles, /@media \(max-width: 359px\), \(max-width: 480px\) and \(max-height: 700px\)/);
  assert.match(styles, /min-height:\s*220px;\s*\n\s*height:\s*220px/);
  assert.match(styles, /#screen-start \.chest-main-button \{\s*\n\s*min-height:\s*58px/);
  assert.match(styles, /#screen-start \.chest-catalog-card button \{ min-height: 44px/);
});

test('cofres: carruseles y tablet conservan jerarquía, snap y objetivos táctiles', () => {
  assert.match(styles, /scroll-snap-type:\s*x mandatory/);
  assert.match(styles, /grid-auto-columns:\s*clamp\(150px,\s*48vw,\s*176px\)/);
  assert.match(styles, /grid-auto-columns:\s*clamp\(104px,\s*31vw,\s*124px\)/);
  assert.match(styles, /@media \(min-width: 600px\) and \(max-width: 760px\)/);
  assert.match(styles, /grid-template-columns:\s*minmax\(128px,\s*158px\) minmax\(240px,\s*1fr\) minmax\(128px,\s*154px\)/);
  assert.match(styles, /@media \(max-width: 350px\)[\s\S]*?\.chest-catalog-grid \{ grid-template-columns: 1fr; \}/);
});
