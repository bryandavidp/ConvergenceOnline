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

test('SV-20: bossEvent programa el beat de superación y NO celebra al llegar', () => {
  Survival.start(); // resetea flags
  State.mode = 'supervivencia'; State.status = 'playing';
  Survival.wave = 6; Survival._nextBoss = 'meteor'; Survival.lives = 3;
  Survival.bossEvent();
  assert.ok(Survival._bossSurvivedAt > 0, 'programa el beat ¡SUPERADO!');
  assert.ok(Survival._boonAt > 0, 'programa la bendición');
  assert.equal(Survival._noBoosterSinceBoss, true, 'arranca la hazaña sin-potenciadores');
});

test('SV-20/21: _bossSurvived cuenta jefe y respeta game over; hazaña sin-booster', () => {
  Survival.start();
  State.mode = 'supervivencia'; State.status = 'playing'; Survival.lives = 2;
  Survival._bossesSurvived = 0; Survival._noBoosterSinceBoss = true;
  Survival._bossSurvived();
  assert.equal(Survival._bossesSurvived, 1, 'suma jefe superado');
  // Con game over no cuenta
  State.status = 'over';
  Survival._bossSurvived();
  assert.equal(Survival._bossesSurvived, 1, 'no cuenta si no sigues vivo');
  State.status = 'playing';
});

test('SV-22: applyBoon registra la hoja de la run (_boonLog)', () => {
  Survival.start();
  Survival._boonLog = [];
  Survival.applyBoon('slow');
  Survival.applyBoon('magnet');
  assert.equal(Survival._boonLog.length, 2);
  assert.deepEqual(Survival._boonLog.map((b) => b.id), ['slow', 'magnet']);
  assert.ok(Survival._boonLog[0].icon, 'cada entrada tiene icono');
});

test('SV-02/20/21/22: claves i18n nuevas en ES y EN', () => {
  const keys = ['magnet_done', 'new_record', 'revive_btn', 'revive_gets', 'revive_count', 'revive_short',
    'survmut_none', 'surv_week_label', 'surv_diff_normal_d', 'surv_launch_record',
    'boon_golden_wave_d', 'boon_score_boost_d',
    'surv_boss_cleared', 'surv_boss_cleared_clean', 'surv_frenzy_max', 'surv_wave_record_live',
    'surv_over_wave_new', 'surv_over_wave_near', 'surv_over_record', 'surv_run_bosses'];
  for (const lang of ['es', 'en']) {
    for (const k of keys) {
      assert.ok(cv.I18n.DICT[lang][k], `falta ${k} en ${lang}`);
    }
  }
  // El copy de golden_wave ya no promete "x3" ni "próxima oleada" a secas
  assert.ok(!/x3|×3/.test(cv.I18n.DICT.es.boon_golden_wave_d), 'ES: golden ya no dice x3');
  assert.ok(!/3x|×3/.test(cv.I18n.DICT.en.boon_golden_wave_d), 'EN: golden ya no dice 3x');
});
