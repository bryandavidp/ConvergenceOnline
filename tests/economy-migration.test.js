'use strict';

// ECO-81: compatibilidad local — un perfil guardado en v2.9.3 (SIN los campos
// del reequilibrio) debe migrar conservando saldos y propiedad, con los límites
// diarios inicializados a cupo completo (actualizar nunca castiga).
// CLAVE: el cv_meta viejo se siembra ANTES de cargar game.js, que es exactamente
// lo que ocurre en el dispositivo de un jugador real al actualizar.

const test = require('node:test');
const assert = require('node:assert/strict');

require('./dom-stub.js');

const OLD_PROFILE = {
  _v: 9,
  xp: 1234, level: 17, games: 210, totalRemoved: 9000,
  coins: 5432, gems: 321, tickets: 7, chests: 2,
  cosmetics: {
    owned: { neon: '2026-01-01' }, theme: 'neon', skin: 'default', fx: 'default',
    avatarIcon: 'comet', avatarBorder: 'starlight',
    avatarIcons: { nova: 1, comet: '2026-01-02' }, avatarBorders: { starlight: 1 },
  },
  boards: { owned: { classic: 1, madera: 1 }, equipped: 'madera' },
  chestSlots: 3,
  daily: { date: '' }, weekly: { week: '', id: '', progress: 0, done: false },
  reward: { date: '', day: 3 },
};

localStorage.setItem('cv_meta', JSON.stringify(OLD_PROFILE));
require('../game.js');

const cv = globalThis.window.__cv;
const { Meta, EconomyConfig } = cv;

test('ECO-81: los saldos y la propiedad del perfil viejo se conservan intactos', () => {
  assert.equal(Meta.coins(), 5432);
  assert.equal(Meta.gems(), 321);
  assert.equal(Meta.tickets(), 7);
  assert.equal(Meta.level(), 17);
  assert.equal(Meta.chests(), 2, 'los cofres del contador antiguo migran al inventario');
  assert.ok(Meta.owns('neon'), 'temas comprados se conservan');
  assert.ok(Meta.ownsBoard('madera'), 'tableros comprados se conservan');
  assert.ok(Meta.ownsAvatarIcon('comet'), 'iconos comprados se conservan');
  assert.equal(Meta.avatarIcon(), 'comet', 'el equipado se respeta');
});

test('ECO-81: los campos nuevos se inicializan sin castigar el día de la actualización', () => {
  const m = Meta.state;
  assert.ok(m.economyDaily && typeof m.economyDaily === 'object');
  assert.equal(Meta.survivalGemsLeftToday(), EconomyConfig.survival.gemMilestone.dailyCap, 'cupo diario íntegro');
  assert.ok(Meta.claimSurvivalChestTier('wood'), 'la escalera diaria está disponible desde el primer día');
  assert.deepEqual(typeof m.cosmetics.avatarIconTints, 'object', 'mapas de tintes creados');
  assert.equal(Meta.avatarIconTint(), '', 'sin tinte fantasma equipado');
  assert.equal(m._v, 10, 'esquema al día');
});

test('ECO-81: el perfil migrado opera con la economía nueva sin errores', () => {
  const coins0 = Meta.coins();
  const r = Meta.recordGame({ score: 5000, level: 2, maxCombo: 8, removed: 50, elapsed: 200, mode: 'contrarreloj', perfect: false, daily: true, diff: 'normal' });
  assert.ok(r.coinsGained >= 0);
  assert.ok(Meta.coins() >= coins0, 'jugar nunca reduce el saldo');
  // Sumideros nuevos disponibles de inmediato para su colección existente.
  const offers = cv.StyleShop.todayOffers();
  assert.ok(offers.length > 0, 'la rotación ofrece variantes de sus bases poseídas');
});
