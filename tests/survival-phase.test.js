/* Regresión de las fases SV-α/SV-β de Supervivencia (docs/SURVIVAL_MASTER_PLAN.md).
 * Fija la lógica pura de los rebalances y correcciones; si alguien la rompe,
 * este archivo lo grita con el identificador de la tarea SV-*. */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

require('./dom-stub.js');
require('../game.js');

const cv = globalThis.window.__cv;
const { State, Survival, Meta } = cv;
cv.Render.buildBoard();

test('SV-01: nerfs de bendiciones (golden ×2, impulso tope 0.5, peso épico 4)', () => {
  assert.equal(Survival.SCORE_BOOST_CAP, 0.5, 'impulso topado a +0.5×');
  const golden = Survival.BOONS.find((b) => b.id === 'golden_wave');
  assert.equal(golden.weight, 4, 'peso épico bajado a 4');
  assert.equal(golden.rarity, 'epic');
  // scoreMult: impulso al tope + oleada dorada = (1+0.5) × 2 = 3
  Survival.scoreBoost = 0.5; Survival.goldenWaveWaves = 1;
  assert.equal(Survival.scoreMult(), 3, 'golden es ×2, no ×3');
  Survival.scoreBoost = 0; Survival.goldenWaveWaves = 0;
  assert.equal(Survival.scoreMult(), 1, 'sin bendiciones, ×1');
});

test('SV-01: applyBoon(score_boost) respeta el tope', () => {
  Survival.scoreBoost = 0;
  Survival.applyBoon('score_boost'); assert.equal(Survival.scoreBoost, 0.25);
  Survival.applyBoon('score_boost'); assert.equal(Survival.scoreBoost, 0.5);
  Survival.applyBoon('score_boost'); assert.equal(Survival.scoreBoost, 0.5, 'no supera el tope');
  Survival.scoreBoost = 0;
});

test('SV-01: offerBoons excluye vida al tope e impulso al tope', () => {
  // Impulso al tope: score_boost fuera del pool
  Survival.scoreBoost = Survival.SCORE_BOOST_CAP;
  Survival.lives = 1; Survival.MAX_LIVES = 3;
  let pool = Survival.BOONS.filter((b) =>
    (b.id !== 'life' || Survival.lives < Survival.MAX_LIVES + 1) &&
    (b.id !== 'score_boost' || (Survival.scoreBoost || 0) < Survival.SCORE_BOOST_CAP));
  assert.ok(!pool.some((b) => b.id === 'score_boost'), 'impulso al tope excluido');
  assert.ok(pool.some((b) => b.id === 'life'), 'vida disponible con 1 vida');
  // Vida al tope: life fuera
  Survival.scoreBoost = 0; Survival.lives = Survival.MAX_LIVES + 1;
  pool = Survival.BOONS.filter((b) =>
    (b.id !== 'life' || Survival.lives < Survival.MAX_LIVES + 1) &&
    (b.id !== 'score_boost' || (Survival.scoreBoost || 0) < Survival.SCORE_BOOST_CAP));
  assert.ok(!pool.some((b) => b.id === 'life'), 'vida al tope excluida');
  Survival.lives = 3;
});

test('SV-12: survBestWaveFor por dificultad, retrocompatible con survBestWave', () => {
  // Récord en normal no debe contar como récord en difícil
  State.diff = 'normal';
  Meta.survWaveRecord(15);
  assert.equal(Meta.survBestWaveFor('normal'), 15);
  assert.ok(Meta.survBestWave() >= 15, 'el global también sube');
  State.diff = 'dificil';
  assert.equal(Meta.survBestWaveFor('dificil'), 0, 'difícil arranca en 0 pese al récord de normal');
  Meta.survWaveRecord(8);
  assert.equal(Meta.survBestWaveFor('dificil'), 8);
  assert.equal(Meta.survBestWaveFor('normal'), 15, 'normal intacto');
  State.diff = 'normal';
});

test('SV-02: claves i18n nuevas en ES y EN', () => {
  const keys = ['magnet_done', 'new_record', 'revive_btn', 'revive_gets', 'revive_count', 'revive_short',
    'survmut_none', 'surv_week_label', 'surv_diff_normal_d', 'surv_launch_record',
    'boon_golden_wave_d', 'boon_score_boost_d'];
  for (const lang of ['es', 'en']) {
    for (const k of keys) {
      assert.ok(cv.I18n.DICT[lang][k], `falta ${k} en ${lang}`);
    }
  }
  // El copy de golden_wave ya no promete "x3" ni "próxima oleada" a secas
  assert.ok(!/x3|×3/.test(cv.I18n.DICT.es.boon_golden_wave_d), 'ES: golden ya no dice x3');
  assert.ok(!/3x|×3/.test(cv.I18n.DICT.en.boon_golden_wave_d), 'EN: golden ya no dice 3x');
});
