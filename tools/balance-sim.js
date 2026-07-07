#!/usr/bin/env node
/* Simulador de balance headless (GM-30, ver docs/GAME_MODES_MASTER_PLAN.md §10).
 *
 * Carga game.js REAL sobre el stub de DOM de tests con un RELOJ VIRTUAL
 * (performance.now parcheado) y conduce el Loop del juego tick a tick, con un
 * bot parametrizable (política, tiempo de reacción, tasa de error) que juega
 * partidas seedeadas. Mismo seed + mismo perfil ⇒ misma partida, siempre:
 * el gameplay entero tira de RNG (mulberry32 seedeado) y del reloj virtual.
 *
 * Uso:
 *   node tools/balance-sim.js                       # batería estándar (baseline)
 *   node tools/balance-sim.js --runs 60             # más runs por configuración
 *   node tools/balance-sim.js --modes contrarreloj  # solo un modo
 *   node tools/balance-sim.js --json out.json       # además, volcado JSON
 *
 * Límites honestos (documentados): el bot no siente — valida rangos y
 * regresiones, no diversión. Los setTimeout reales del juego (p. ej. el
 * asentamiento del terremoto) disparan en tiempo real, no virtual: sus efectos
 * se aplican igualmente porque el estado se comprueba al disparar.
 */
'use strict';

/* ---------- Reloj virtual: DEBE instalarse antes de cargar el juego ---------- */
const VCLOCK = { t: 0 };
Object.defineProperty(globalThis, 'performance', {
  value: { now: () => VCLOCK.t },
  configurable: true, writable: true,
});

require('../tests/dom-stub.js');
require('../game.js');

const cv = globalThis.window.__cv;
if (!cv) throw new Error('game.js no expuso window.__cv (¿location.search sin ?dev en el stub?)');

/* Arranque mínimo (init() del juego no corre en Node: DOMContentLoaded nunca dispara). */
cv.Render.buildBoard();
if (typeof cv.FX.init === 'function') cv.FX.init();
/* FX y Sound son visual/audio puro (cero reglas): se anulan por velocidad y robustez. */
for (const k of Object.keys(cv.FX)) if (typeof cv.FX[k] === 'function') cv.FX[k] = () => {};
for (const k of Object.keys(cv.Sound)) if (typeof cv.Sound[k] === 'function') cv.Sound[k] = () => {};
/* Aventura: las intros de capítulo pausan esperando un tap que en Node no llega. */
for (let c = 0; c < 120; c++) cv.Meta.markAdvChapterSeen(c);

/* ---------- PRNG propio del bot (independiente del RNG del juego) ---------- */
function mulberry32(seed) {
  let s = seed >>> 0;
  return () => {
    let t = (s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- Perfiles de bot (modelan niveles de habilidad) ----------
 * lapse = lapsos de atención (prob. por acción de "quedarse mirando" ~ms):
 * es lo que rompe combos y mata partidas en humanos; sin lapsos, cualquier
 * bot consistente es inmortal en Contrarreloj/Supervivencia (hallazgo del
 * primer baseline: la dificultad de esos modos es cognitiva, no mecánica). */
const PROFILES = {
  //           reacción(ms)  política   errores        lapsos
  skilled: { reaction: 550, policy: 'greedy', errorRate: 0.03, lapse: { p: 0.04, ms: 2200 } },
  average: { reaction: 900, policy: 'greedy', errorRate: 0.08, lapse: { p: 0.10, ms: 2800 } },
  casual:  { reaction: 1400, policy: 'random', errorRate: 0.15, lapse: { p: 0.18, ms: 3400 } },
};

/* ---------- Bot ---------- */
function listPlays() {
  const { State, Engine } = cv;
  const plays = [];
  for (let i = 0; i < State.board.length; i++) {
    if (State.board[i] !== null || State.tiles[i]) continue;
    const n = Engine.converging(i).length;
    if (n >= 2) plays.push([i, n]);
  }
  return plays;
}
function listBadTaps() {
  const { State, Engine } = cv;
  const bad = [];
  for (let i = 0; i < State.board.length; i++) {
    if (State.board[i] !== null || State.tiles[i]) continue;
    if (Engine.converging(i).length < 2) bad.push(i);
  }
  return bad;
}
function botAct(profile, rng, stats) {
  const { State } = cv;
  const plays = listPlays();
  stats.polls++;
  if (!plays.length) {
    stats.noMove++;
    // Sin convergencia posible: liberar un tile rompible si lo hay (hielo/cadenas/
    // telaraña) — imprescindible para poder vaciar tableros de Clásico/biomas.
    for (let i = 0; i < State.tiles.length; i++) {
      const t = State.tiles[i];
      if (t && t.breakable) { cv.Game.activate(i); return; }
    }
    return;
  }
  // Error humano: con prob. errorRate toca una casilla que no converge.
  if (rng() < profile.errorRate) {
    const bad = listBadTaps();
    if (bad.length) { cv.Game.activate(bad[(rng() * bad.length) | 0]); return; }
  }
  let pick;
  if (profile.policy === 'random') pick = plays[(rng() * plays.length) | 0][0];
  else { // greedy: la convergencia que más iconos elimina
    let best = plays[0];
    for (const p of plays) if (p[1] > best[1]) best = p;
    pick = best[0];
  }
  cv.Game.activate(pick);
}

/* ---------- Una partida ---------- */
const STEP = 100; // ms por tick (el dt del Loop clampa a 100)
function runOne(cfg) {
  const { Game, State, Loop, Survival } = cv;
  const profile = PROFILES[cfg.profile];
  const rng = mulberry32((cfg.seed ^ 0x9e3779b9) >>> 0);
  VCLOCK.t = 0;

  if (cfg.mode === 'clasico') { State.world = cfg.world || 'bosque'; State.worldLevel = cfg.level || 1; }
  Game.start(cfg.mode, cfg.diff || 'normal', cfg.mode === 'clasico' ? (cfg.level || 1) : undefined, cfg.seed);
  if (cfg.mode === 'aventura') { // aislar runs: advMax crece entre runs del mismo proceso
    if (cv.Picker.pending) cv.Picker.cancel(); // ruta ofrecida para el nivel de reanudación: descartar
    State.status = 'playing'; State.level = cfg.level || 1;
    cv.Adventure.resetRun();
    Game.setupLevel();
    cv.Adventure.maybeOfferRoute(State.level); // el bot elegirá en el bucle
  }

  const stats = { polls: 0, noMove: 0 };
  const maxMs = (cfg.maxMinutes || 6) * 60000;
  let nextActAt = profile.reaction;
  let sessionScore = 0, levelsCleared = 0;

  while (VCLOCK.t < maxMs) {
    VCLOCK.t += STEP;
    Loop.tick(VCLOCK.t);
    if (State.status === 'levelComplete') { // Clásico/Aventura: encadenar niveles
      sessionScore += cv.State.score;
      levelsCleared++;
      if (cfg.mode === 'clasico' && (State.worldLevel || 1) >= 50) break;
      Game.nextLevel();
      continue;
    }
    if (State.status === 'paused') {
      // Elecciones en partida (GM-γ): el bot rechaza gastos (continuar con gemas,
      // ofertas con cancelar) y toma la PRIMERA opción en bendiciones/rutas/reliquias.
      const pk = cv.Picker && cv.Picker.pending;
      if (pk) {
        if (pk.onCancel) cv.Picker.cancel();
        else if (pk.options && pk.options.length) cv.Picker.pick(pk.options[0].id);
        else cv.Picker.cancel();
        continue;
      }
      // Supervivencia: modal de revivir → el bot no paga
      if (cfg.mode === 'supervivencia') { Survival.giveUp(); }
      else break;
    }
    if (State.status !== 'playing') break;
    if (VCLOCK.t >= nextActAt) {
      // Lapso de atención: el bot "se queda mirando" (rompe combos, drena el reloj).
      if (profile.lapse && rng() < profile.lapse.p) nextActAt += profile.lapse.ms * (0.6 + 0.8 * rng());
      else { nextActAt += profile.reaction; botAct(profile, rng, stats); }
    }
  }
  const timedOut = State.status === 'playing'; // Zen o bot "inmortal": corte por tiempo

  return {
    score: (cfg.mode === 'clasico' ? sessionScore : 0) + State.score,
    elapsed: State.elapsed,
    maxCombo: State.maxCombo,
    mistakes: State.mistakes,
    fever: State.feverEver,
    progress: cfg.mode === 'supervivencia' ? Survival.wave : (cfg.mode === 'clasico' ? levelsCleared : State.level),
    deadAir: stats.polls ? stats.noMove / stats.polls : 0,
    coins: State.coinsRun + ((Game.metaResult && Game.metaResult.coinsGained) || 0),
    timedOut,
  };
}

/* ---------- Batería ---------- */
function pct(sorted, p) { return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))]; }
function agg(rows, key) {
  const v = rows.map((r) => +r[key]).sort((a, b) => a - b);
  return { p50: pct(v, 0.5), p90: pct(v, 0.9), avg: v.reduce((a, b) => a + b, 0) / v.length };
}

function runBatch(cfg, runs) {
  const rows = [];
  for (let i = 0; i < runs; i++) rows.push(runOne(Object.assign({ seed: (cfg.seedBase || 1000) + i * 7919 }, cfg)));
  const timedOut = rows.filter((r) => r.timedOut).length;
  return {
    cfg, runs,
    score: agg(rows, 'score'), elapsed: agg(rows, 'elapsed'), maxCombo: agg(rows, 'maxCombo'),
    progress: agg(rows, 'progress'),
    deadAir: agg(rows, 'deadAir').avg, mistakes: agg(rows, 'mistakes').avg, coins: agg(rows, 'coins').avg,
    feverRate: rows.filter((r) => r.fever).length / rows.length,
    timedOutRate: timedOut / rows.length,
    rows,
  };
}

const STANDARD = [];
for (const profile of ['skilled', 'average', 'casual']) {
  STANDARD.push({ mode: 'clasico', diff: 'normal', profile, maxMinutes: 6 });
  STANDARD.push({ mode: 'aventura', diff: 'normal', profile, maxMinutes: 6 });
  STANDARD.push({ mode: 'contrarreloj', diff: 'normal', profile, maxMinutes: 4 });
  STANDARD.push({ mode: 'supervivencia', diff: 'normal', profile, maxMinutes: 8 });
}
STANDARD.push({ mode: 'supervivencia', diff: 'dificil', profile: 'skilled', maxMinutes: 8 });
STANDARD.push({ mode: 'zen', diff: 'normal', profile: 'casual', maxMinutes: 4 });

function fmtRow(r) {
  const c = r.cfg;
  const prog = c.mode === 'supervivencia' ? `oleada ${r.progress.p50}` : c.mode === 'clasico' ? `${r.progress.p50} nvl` : `nvl ${r.progress.p50}`;
  return [
    c.mode.padEnd(13), (c.diff || 'normal').padEnd(8), c.profile.padEnd(8),
    String(r.score.p50).padStart(6), String(r.score.p90).padStart(7),
    String(Math.round(r.elapsed.p50)).padStart(5) + 's',
    ('x' + r.maxCombo.p50).padStart(5),
    prog.padStart(10),
    (r.deadAir * 100).toFixed(0).padStart(6) + '%',
    r.mistakes.toFixed(1).padStart(5),
    String(Math.round(r.coins)).padStart(5),
    (r.timedOutRate * 100).toFixed(0).padStart(4) + '%',
  ].join('  ');
}

/* Exportable para tests (guardarraíl de medallas del reto diario). */
module.exports = { runOne, runBatch, PROFILES, cv, VCLOCK };

if (require.main === module) {
  const args = process.argv.slice(2);
  const opt = (name, dflt) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : dflt; };
  const runs = +opt('runs', 40);
  const modes = opt('modes', '').split(',').filter(Boolean);
  const jsonOut = opt('json', '');

  const configs = STANDARD.filter((c) => !modes.length || modes.includes(c.mode));
  const header = ['modo'.padEnd(13), 'diff'.padEnd(8), 'perfil'.padEnd(8), 'sc p50'.padStart(6), 'sc p90'.padStart(7), 'dur50'.padStart(6), 'combo'.padStart(5), 'progreso'.padStart(10), 'deadAir'.padStart(7), 'err'.padStart(5), 'coins'.padStart(5), 'cap'.padStart(5)].join('  ');
  console.log(`balance-sim · ${runs} runs/config · versión ${(() => { try { return require('fs').readFileSync(__dirname + '/../game.js', 'utf8').match(/VERSION = '([^']+)'/)[1]; } catch (_) { return '?'; } })()}`);
  console.log(header);
  console.log('-'.repeat(header.length));
  const results = [];
  for (const cfg of configs) {
    const r = runBatch(cfg, runs);
    delete r.rows; // el volcado agregado basta
    results.push(r);
    console.log(fmtRow(r));
  }
  if (jsonOut) { require('fs').writeFileSync(jsonOut, JSON.stringify(results, null, 2)); console.log('\nJSON → ' + jsonOut); }
}
