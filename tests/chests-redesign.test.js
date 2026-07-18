'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

require('./dom-stub.js');
require('../game.js');

const { Meta, CHEST_TYPES, CHEST_TYPE_ORDER, chestOdds, I18n } = globalThis.window.__cv;
const styles = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');
const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function snapshot() {
  const m = Meta.state;
  return JSON.parse(JSON.stringify({
    coins: m.coins,
    gems: m.gems,
    tickets: m.tickets,
    chests: m.chests,
    chestInventory: m.chestInventory,
    chestUnlock: m.chestUnlock,
    chestReady: m.chestReady,
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
    m.chests = 0; m.chestInventory = []; m.chestUnlock = null; m.chestReady = []; m.chestSeq = 0;
    Meta.addChest(1, 'wood', 'test');
    const chest = Meta.chestInventory()[0];
    const started = Meta.startChestUnlock(chest.uid);
    assert.equal(started.uid, chest.uid);
    assert.equal(started.ready, false);
    assert.equal(Meta.chestInstantCost(chest.uid), CHEST_TYPES.wood.instantCost);

    // CH-3: al terminar, el cofre pasa a "listo" (no bloquea) y deja de haber
    // desbloqueo en curso; recogerlo es gratis.
    m.chestUnlock.endsAt = Date.now() - 1;
    assert.equal(Meta.chestUnlock(), null);
    assert.deepEqual(Meta.chestReadyUids(), [chest.uid]);
    assert.equal(Meta.chestTimerState(chest.uid), 'ready');
    assert.equal(Meta.chestInstantCost(chest.uid), 0);
    assert.equal(Meta.startChestUnlock(chest.uid), null, 'un cofre listo no se re-inicia');

    const reward = withRandomSequence([0, 0], () => Meta.openChest(chest.uid));
    assert.equal(reward.kind, 'coins');
    assert.equal(reward.amount, 60);
    assert.equal(reward.chestType, 'wood');
    assert.equal(Meta.chests(), 0);
    assert.equal(Meta.chestUnlock(), null);
    assert.deepEqual(Meta.chestReadyUids(), []);
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

test('cofres CH-1: la banda de recompensas solo promete lo que las tablas contienen', () => {
  const band = indexHtml.split('chest-rewards-grid')[1].split('</section>')[0];
  assert.ok(band.includes('coin.png') && band.includes('gem.png') && band.includes('ticket.png'), 'monedas/gemas/tickets presentes');
  assert.ok(band.includes('planet.png') && band.includes('crystal.png'), 'tableros/temas presentes');
  assert.ok(!band.includes('bolt.png') && !band.includes('potion.png'), 'sin potenciadores/objetos fantasma');
  assert.ok(!band.includes('chest_reward_surprise'), 'sin "y más…" vago');
});

test('cofres CH-1: chestOdds expone rangos y porcentajes reales por tipo', () => {
  const wood = chestOdds('wood');
  assert.deepEqual(wood.coins, { min: 60, max: 199, pct: 60 });
  assert.equal(wood.gems.pct, 30);
  assert.equal(wood.tickets.pct, 8);
  assert.equal(wood.cosmetic.pct, 2);
  const divine = chestOdds('divine');
  assert.deepEqual(divine.coins, { min: 1000, max: 2400, pct: 20 });
  assert.equal(divine.gems.pct, 12);
  assert.equal(divine.tickets.pct, 8);
  assert.equal(divine.cosmetic.pct, 60);
  // Un tipo desconocido cae a madera, igual que el resto del sistema.
  assert.deepEqual(chestOdds('nope'), chestOdds('wood'));
  // La suma por tipo debe cubrir el 100% (±1 por redondeo).
  for (const id of CHEST_TYPE_ORDER) {
    const o = chestOdds(id);
    const total = o.coins.pct + o.gems.pct + o.tickets.pct + o.cosmetic.pct;
    assert.ok(Math.abs(total - 100) <= 1, `${id}: ${total}%`);
  }
});

test('cofres CH-1: i18n de transparencia presente en ambos idiomas', () => {
  for (const key of ['chest_odds_title', 'chest_odds_cosmetic', 'home_chest_opening']) {
    assert.ok(I18n.DICT.es[key], `es.${key}`);
    assert.ok(I18n.DICT.en[key], `en.${key}`);
  }
});

test('cofres: carruseles y tablet conservan jerarquía, snap y objetivos táctiles', () => {
  assert.match(styles, /scroll-snap-type:\s*x mandatory/);
  assert.match(styles, /grid-auto-columns:\s*clamp\(150px,\s*48vw,\s*176px\)/);
  assert.match(styles, /grid-auto-columns:\s*clamp\(104px,\s*31vw,\s*124px\)/);
  assert.match(styles, /@media \(min-width: 600px\) and \(max-width: 760px\)/);
  assert.match(styles, /grid-template-columns:\s*minmax\(128px,\s*158px\) minmax\(240px,\s*1fr\) minmax\(128px,\s*154px\)/);
  assert.match(styles, /@media \(max-width: 350px\)[\s\S]*?\.chest-catalog-grid \{ grid-template-columns: 1fr; \}/);
});
