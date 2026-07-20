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

/* ---------- Calendario virtual (ECO-03) ----------
 * El juego usa Date.now()/new Date() para timers de cofres, misiones diarias y
 * rachas. Para simular DÍAS de economía se instala un Date virtual anclado a un
 * lunes fijo (determinismo total) que solo avanza cuando el forecast lo pide.
 * Se instala de forma PEREZOSA (solo dentro de runEconomyForecast) para que la
 * batería de gameplay histórica siga siendo bit a bit idéntica. */
const RealDate = Date;
const VDATE = { baseMs: RealDate.UTC(2026, 0, 5, 8, 0, 0), offsetMs: 0 };
class VirtualDate extends RealDate {
  constructor(...args) {
    if (args.length === 0) super(VDATE.baseMs + VDATE.offsetMs);
    else super(...args);
  }
  static now() { return VDATE.baseMs + VDATE.offsetMs; }
}
function installVirtualDate() { globalThis.Date = VirtualDate; }
function uninstallVirtualDate() { globalThis.Date = RealDate; }

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
/* Mutador semanal de Supervivencia (GM-22): fijar 'none' para que la batería sea
 * reproducible en cualquier semana del calendario. */
cv.Survival._mutOverride = 'none';

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
  //           reacción(ms)  política   errores        lapsos                      caza de anclas (JF-04, B-J2)
  skilled: { reaction: 550, policy: 'greedy', errorRate: 0.03, lapse: { p: 0.04, ms: 2200 }, bossAware: 0.7 },
  average: { reaction: 900, policy: 'greedy', errorRate: 0.08, lapse: { p: 0.10, ms: 2800 }, bossAware: 0.35 },
  casual:  { reaction: 1400, policy: 'random', errorRate: 0.15, lapse: { p: 0.18, ms: 3400 }, bossAware: 0.1 },
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
  // Bot boss-aware (JF-04, B-J2): con un encuentro activo, prioriza con prob.
  // `bossAware` las jugadas que golpean un ancla del jefe (converger un icono que
  // vive sobre un tile `boss` expuesto). Sin esto el sim no ve el sistema de jefes.
  if (cv.Bosses && cv.Bosses.enc && profile.bossAware && rng() < profile.bossAware) {
    const { State } = cv;
    let bestA = null;
    for (const p of plays) {
      const hits = cv.Engine.converging(p[0]).some((j) => { const t = State.tiles[j]; return t && t.type === 'boss'; });
      if (hits && (!bestA || p[1] > bestA[1])) bestA = p;
    }
    if (bestA) { cv.Game.activate(bestA[0]); return; }
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
  // Reto del día (ECO-03): la primera sesión diaria del forecast puntúa como
  // reto (gemas del primer intento + medalla), por el mismo camino que producción.
  if (cfg.daily && cfg.mode === 'contrarreloj') State.isDaily = true;
  if (cfg.mode === 'aventura') { // aislar runs: advMax crece entre runs del mismo proceso
    if (cv.Picker.pending) cv.Picker.cancel(); // ruta ofrecida para el nivel de reanudación: descartar
    State.status = 'playing'; State.level = cfg.level || 1;
    cv.Adventure.resetRun();
    Game.setupLevel();
    cv.Adventure.maybeOfferRoute(State.level); // el bot elegirá en el bucle
  }

  const stats = { polls: 0, noMove: 0 };
  const coinsBefore = cv.Meta.coins();
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
      // Supervivencia: modal de revivir → por defecto el bot no paga; las
      // políticas de gasto (ECO-03) pueden financiar hasta cfg.reviveBudget
      // revives por el código REAL de Survival.revive() (paga con Meta.spend).
      if (cfg.mode === 'supervivencia') {
        if ((cfg.reviveBudget | 0) > 0 && Survival.revives < Survival.REVIVE_MAX
          && cv.Meta.coins() >= Survival.reviveCost()) {
          cfg.reviveBudget--;
          Survival.revive();
          continue;
        }
        Survival.giveUp();
      }
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
  // ECO-1: los modos sin fin no liquidan nunca dentro del sim (el bot no muere a
  // tiempo). settleOnCutoff modela "fin de la sesión": la run se liquida por el
  // camino REAL (gameOver → recordGame) para poder medir monedas por minuto.
  if (cfg.settleOnCutoff && timedOut) Game.gameOver('sim-cutoff');

  return {
    score: (cfg.mode === 'clasico' ? sessionScore : 0) + State.score,
    elapsed: State.elapsed,
    maxCombo: State.maxCombo,
    mistakes: State.mistakes,
    fever: State.feverEver,
    progress: cfg.mode === 'supervivencia' ? Survival.wave : (cfg.mode === 'clasico' ? levelsCleared : State.level),
    // Encuentros de jefe (JF-γ): visibles para las puertas B-J1/B-J2 (no se imprimen
    // en la tabla; los consume el análisis de gates y el JSON).
    kills: cfg.mode === 'supervivencia' ? (Survival._bossesDefeated || 0) : 0,
    encounters: cfg.mode === 'supervivencia' ? (Survival._bossesSurvived || 0) : 0,
    minis: cfg.mode === 'supervivencia' ? (Survival._minisSeen || 0) : 0,
    miniKills: cfg.mode === 'supervivencia' ? (Survival._minisKilled || 0) : 0,
    deadAir: stats.polls ? stats.noMove / stats.polls : 0,
    coins: State.coinsRun + ((Game.metaResult && Game.metaResult.coinsGained) || 0),
    // Ingreso REAL de la run: delta del saldo persistente (captura niveles de
    // Clásico, oleadas, liquidación, misiones — todo lo que el jugador cobró).
    coinsDelta: cv.Meta.coins() - coinsBefore,
    activeMs: VCLOCK.t,
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
  rows.forEach((r) => { r.coinsPer10Min = r.activeMs > 0 ? r.coinsDelta / (r.activeMs / 60000) * 10 : 0; });
  return {
    cfg, runs,
    score: agg(rows, 'score'), elapsed: agg(rows, 'elapsed'), maxCombo: agg(rows, 'maxCombo'),
    progress: agg(rows, 'progress'),
    coinsPer10Min: agg(rows, 'coinsPer10Min'),
    deadAir: agg(rows, 'deadAir').avg, mistakes: agg(rows, 'mistakes').avg, coins: agg(rows, 'coins').avg,
    feverRate: rows.filter((r) => r.fever).length / rows.length,
    timedOutRate: timedOut / rows.length,
    rows,
  };
}

/* ---------- Economía de cofres (CH-4/CH-5, aislada de las partidas) ----------
 * Usa las APIs reales de Meta para que tier-ups, multi-tiradas, fallbacks y futuros
 * drops persistentes pasen por exactamente el mismo código que en producción.
 * Cada muestra parte del mismo perfil canónico (sin cosméticos poseídos) y cada
 * fila tipo/nivel recibe un stream RNG propio: cambiar el orden de las filas no
 * cambia sus resultados. El estado Meta, localStorage y Math.random se restauran
 * incluso si una apertura lanza una excepción. */
function cloneJson(value) { return JSON.parse(JSON.stringify(value)); }

function restoreMetaState(snapshot) {
  const state = cv.Meta.state;
  for (const key of Object.keys(state)) delete state[key];
  Object.assign(state, cloneJson(snapshot));
}

function mixChestSeed(seed, type, level) {
  let h = (seed >>> 0) ^ Math.imul(Math.max(1, level | 0), 0x9e3779b1);
  for (let i = 0; i < type.length; i++) {
    h ^= type.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function sumNumericLeaves(value) {
  if (Number.isFinite(value)) return Math.max(0, Number(value));
  if (!value || typeof value !== 'object') return 0;
  return Object.values(value).reduce((sum, child) => sum + sumNumericLeaves(child), 0);
}

function metaBoosterTotal(state) {
  const candidates = [
    state && state.boosterStock,
    state && state.boosterInventory,
    state && state.boosters,
    state && state.inventory && state.inventory.boosters,
  ];
  return candidates.reduce((sum, candidate) => sum + sumNumericLeaves(candidate), 0);
}

function rewardItems(reward) {
  return reward && Array.isArray(reward.items) && reward.items.length ? reward.items : (reward ? [reward] : []);
}

function rewardBoosterUnits(items) {
  const defs = (cv.Boosters && cv.Boosters.DEFS) || {};
  return items.reduce((sum, item) => {
    if (!item || typeof item !== 'object') return sum;
    const kind = String(item.kind || '').toLowerCase();
    const id = item.id || item.boosterId;
    const isBooster = kind === 'booster' || kind === 'boosters'
      || item.category === 'booster' || (kind === 'item' && id && defs[id]);
    if (!isBooster) return sum;
    const units = Number(item.amount ?? item.count ?? item.quantity ?? 1);
    return sum + (Number.isFinite(units) ? Math.max(0, units) : 1);
  }, 0);
}

function resetChestSample(baseSnapshot, level) {
  restoreMetaState(baseSnapshot);
  const state = cv.Meta.state;
  state.level = Math.max(1, level | 0);
  state.coins = 0;
  state.gems = 0;
  state.tickets = 0;
  state.chests = 0;
  state.chestInventory = [];
  state.chestUnlock = null;
  state.chestReady = [];
  state.chestNotifiedReady = [];
  state.chestSeq = 0;
  // Perfil canónico: evita que el EV dependa del localStorage de quien ejecuta
  // el sim y mantiene disponible el mismo pool cosmético en cada apertura.
  state.cosmetics = { owned: {}, theme: 'default', skin: 'default', fx: 'default' };
  state.boards = { owned: { classic: 1 }, equipped: 'classic' };
  if (state.boosterStock && typeof state.boosterStock === 'object') {
    state.boosterStock = Object.fromEntries(Object.keys(state.boosterStock).map((id) => [id, 0]));
  }
  if (Object.prototype.hasOwnProperty.call(state, 'boosterInventory')) state.boosterInventory = {};
  if (Object.prototype.hasOwnProperty.call(state, 'boosters')) state.boosters = {};
  if (state.inventory && typeof state.inventory === 'object' && Object.prototype.hasOwnProperty.call(state.inventory, 'boosters')) {
    state.inventory = Object.assign({}, state.inventory, { boosters: {} });
  }
}

function normalizeList(value, fallback) {
  if (Array.isArray(value)) return value.slice();
  if (typeof value === 'string') return value.split(',').map((part) => part.trim()).filter(Boolean);
  return fallback.slice();
}

function runChestEconomy(options = {}) {
  const runs = Math.max(1, Number(options.runs) | 0 || 40);
  const seed = Number.isFinite(Number(options.seed)) ? Number(options.seed) >>> 0 : 0xc0ffee;
  const types = normalizeList(options.types, cv.CHEST_TYPE_ORDER)
    .filter((type, index, all) => cv.CHEST_TYPES[type] && all.indexOf(type) === index);
  const levels = normalizeList(options.levels, [1, 10, 20, 31])
    .map((level) => Math.max(1, Number(level) | 0))
    .filter((level, index, all) => Number.isFinite(level) && all.indexOf(level) === index);
  if (!types.length) throw new Error('runChestEconomy: ningún tipo de cofre válido');
  if (!levels.length) throw new Error('runChestEconomy: ningún nivel válido');

  const originalRandom = Math.random;
  const originalMeta = cloneJson(cv.Meta.state);
  const storage = typeof localStorage !== 'undefined' ? localStorage : null;
  const originalStoredMeta = storage ? storage.getItem('cv_meta') : null;
  const rows = [];

  try {
    for (const type of types) {
      for (const level of levels) {
        Math.random = mulberry32(mixChestSeed(seed, type, level));
        const total = { coins: 0, gems: 0, tickets: 0, boosters: 0, prizes: 0, tierUps: 0 };
        for (let sample = 0; sample < runs; sample++) {
          resetChestSample(originalMeta, level);
          // En producción los cofres event siempre nacen de una fuente semanal
          // real y llevan un snapshot con booster temático garantizado (CH-5).
          if (type === 'event') cv.Meta.addEventChest('balance-sim');
          else cv.Meta.addChest(1, type, 'balance-sim');
          const chest = cv.Meta.chestInventory()[0];
          const before = {
            coins: cv.Meta.coins(), gems: cv.Meta.gems(), tickets: cv.Meta.tickets(),
            boosters: metaBoosterTotal(cv.Meta.state),
          };
          const reward = cv.Meta.openChest(chest && chest.uid);
          if (!reward) throw new Error(`runChestEconomy: openChest devolvió null para ${type} L${level}`);
          const items = rewardItems(reward);
          const afterBoosters = metaBoosterTotal(cv.Meta.state);
          const appliedBoosters = Math.max(0, afterBoosters - before.boosters);
          total.coins += Math.max(0, cv.Meta.coins() - before.coins);
          total.gems += Math.max(0, cv.Meta.gems() - before.gems);
          total.tickets += Math.max(0, cv.Meta.tickets() - before.tickets);
          total.boosters += appliedBoosters || rewardBoosterUnits(items);
          total.prizes += items.length;
          total.tierUps += reward.tierUp ? 1 : 0;
        }
        rows.push({
          type, level, samples: runs,
          ev: {
            coins: total.coins / runs,
            gems: total.gems / runs,
            tickets: total.tickets / runs,
            boosters: total.boosters / runs,
          },
          avgPrizes: total.prizes / runs,
          tierUps: total.tierUps,
          tierUpRate: total.tierUps / runs,
        });
      }
    }
  } finally {
    Math.random = originalRandom;
    restoreMetaState(originalMeta);
    if (storage) {
      if (originalStoredMeta === null) storage.removeItem('cv_meta');
      else storage.setItem('cv_meta', originalStoredMeta);
    }
  }

  return { seed, runs, types, levels, rows };
}

/* ---------- Forecast económico con políticas de gasto (ECO-03) ----------
 * Juega DÍAS de calendario virtual con partidas reales (runOne) y una política
 * de usuario que gasta por las APIs de producción (Meta.buy*, commitBoosterLoadout,
 * Survival.revive, spendGems). Mide minted/burned por motivo vía EconomyAudit,
 * saldos, compras, cofres ganados/abiertos, horas de cola y reserva.
 *
 * Políticas (plan ECO-03):
 *  - saver:     nunca gasta salvo desbloqueos permanentes (4ª ranura).
 *  - strategic: compra 1 booster para Supervivencia y revive 1 vez.
 *  - spender:   loadout completo, hasta 3 revives y aceleración diaria de cofres.
 *  - collector: prioriza cosméticos (compra directa, de barato a caro).
 */
const POLICIES = {
  saver: { reviveBudget: 0, loadout: [], buysCosmetics: false, accelerate: false, choicePick: 'gems' },
  strategic: { reviveBudget: 1, loadout: ['freeze'], buysCosmetics: false, accelerate: false, choicePick: 'coins' },
  spender: { reviveBudget: 3, loadout: ['bomb', 'freeze', 'x2'], buysCosmetics: true, accelerate: true, choicePick: 'coins' },
  collector: { reviveBudget: 0, loadout: [], buysCosmetics: true, accelerate: false, choicePick: 'gems' },
};

const FORECAST_ROTATION = ['contrarreloj', 'supervivencia', 'clasico', 'aventura'];
const DAY_MS = 24 * 60 * 60 * 1000;

// Catálogo comprable con monedas (tableros + temas + iconos + bordes), por coste
// ascendente. Es el "catálogo de 33.080 monedas" del plan.
function coinCatalog() {
  const items = [];
  cv.Boards.order.forEach((id) => {
    const d = cv.Boards.DEFS[id];
    if (d && d.cost > 0 && !d.exclusive) items.push({ kind: 'board', id, cost: d.cost, owned: () => cv.Meta.ownsBoard(id), buy: () => cv.Meta.buyBoard(id, d.cost) });
  });
  cv.Themes.order.forEach((id) => {
    const d = cv.Themes.DEFS[id];
    if (d && d.cost > 0) items.push({ kind: 'theme', id, cost: d.cost, owned: () => cv.Meta.owns(id), buy: () => cv.Meta.buy(id, d.cost) });
  });
  cv.PlayerIcons.order.forEach((id) => {
    const d = cv.PlayerIcons.DEFS[id];
    if (d && d.cost > 0) items.push({ kind: 'avatarIcon', id, cost: d.cost, owned: () => cv.Meta.ownsAvatarIcon(id), buy: () => cv.Meta.buyAvatarIcon(id) });
  });
  cv.PlayerBorders.order.forEach((id) => {
    const d = cv.PlayerBorders.DEFS[id];
    if (d && d.cost > 0) items.push({ kind: 'avatarBorder', id, cost: d.cost, owned: () => cv.Meta.ownsAvatarBorder(id), buy: () => cv.Meta.buyAvatarBorder(id) });
  });
  items.sort((a, b) => a.cost - b.cost || (a.id < b.id ? -1 : 1));
  return items;
}

function chestQueueHours() {
  const running = cv.Meta.chestUnlock();
  const waiting = cv.Meta.chestAutoQueue();
  let ms = running ? Math.max(0, running.remainingMs) : 0;
  waiting.forEach((chest) => { ms += cv.Meta.chestDurationMs(chest.uid); });
  return ms / 3600000;
}

function forecastCurrencies(summary) {
  const out = {};
  ['coins', 'gems', 'tickets', 'chests'].forEach((currency) => {
    const c = (summary.byCurrency && summary.byCurrency[currency]) || { minted: 0, burned: 0, net: 0 };
    out[currency] = { minted: c.minted, burned: c.burned, net: c.net };
  });
  return out;
}

function runEconomyForecast(options = {}) {
  const days = Math.max(1, options.days | 0 || 7);
  const sessionsPerDay = Math.max(1, options.sessionsPerDay | 0 || 2);
  const minutes = Math.max(1, Number(options.minutesPerSession) || 8);
  const profile = PROFILES[options.profile] ? options.profile : 'average';
  const policyId = POLICIES[options.policy] ? options.policy : 'saver';
  const policy = POLICIES[policyId];
  const seed = Number.isFinite(Number(options.seed)) ? Number(options.seed) >>> 0 : 0xec0510;
  const checkpoints = Array.isArray(options.checkpoints) && options.checkpoints.length
    ? options.checkpoints.slice() : [days];
  const diff = options.diff || 'normal';

  const originalRandom = Math.random;
  const originalMeta = cloneJson(cv.Meta.state);
  const storage = typeof localStorage !== 'undefined' ? localStorage : null;
  const originalStoredMeta = storage ? storage.getItem('cv_meta') : null;
  const auditWasEnabled = cv.EconomyAudit.enabled;

  const catalogItems = coinCatalog();
  const catalogTotal = catalogItems.reduce((sum, item) => sum + item.cost, 0);
  const report = {
    policy: policyId, profile, days, sessionsPerDay, minutesPerSession: minutes, seed, diff,
    catalogTotal, catalogDoneDay: null,
    start: null, end: null, checkpoints: [],
  };

  try {
    installVirtualDate();
    VDATE.offsetMs = 0;
    Math.random = mulberry32(seed);
    // Perfil canónico: economía a cero, sin cosméticos, nivel 1 (progresa jugando).
    resetChestSample(originalMeta, 1);
    cv.Meta.state.xp = 0;
    cv.Meta.state.games = 0;
    cv.Meta.state.daily = { date: '' };
    cv.Meta.state.weekly = { week: '', id: '', progress: 0, done: false };
    cv.Meta.state.reward = { date: '', day: 0 };
    cv.Meta.state.dailyRun = { date: '', best: 0, plays: 0 };
    cv.Meta.state.dailyChest = { date: '' };
    cv.Meta.state.chestPipeline = { wins: 0, cycle: 0 };
    cv.EconomyAudit.enable();
    cv.EconomyAudit.reset();
    cv.EconomyAudit.setSession(`forecast-${policyId}-${profile}-${seed}`);
    report.start = { coins: cv.Meta.coins(), gems: cv.Meta.gems(), tickets: cv.Meta.tickets(), chests: cv.Meta.chests() };

    let itemsBought = 0;
    let chestsAccelerated = 0;
    let revivesPaid = 0;

    for (let day = 1; day <= days; day++) {
      // Ritual diario: login + sesiones de juego.
      cv.Meta.claimReward();
      for (let s = 0; s < sessionsPerDay; s++) {
        const globalSession = (day - 1) * sessionsPerDay + s;
        const mode = s === 0 ? 'contrarreloj' : FORECAST_ROTATION[globalSession % FORECAST_ROTATION.length];
        const cfg = {
          mode, profile, diff: mode === 'supervivencia' ? diff : 'normal',
          maxMinutes: minutes, seed: (seed + globalSession * 7919) >>> 0,
          daily: s === 0, reviveBudget: mode === 'supervivencia' ? policy.reviveBudget : 0,
          settleOnCutoff: true,
        };
        // Preparación (política): loadout de Supervivencia por la API real (stock
        // primero, monedas después). El bot no usa los boosters: es el peor caso
        // económico (gasto sin retorno de gameplay).
        if (mode === 'supervivencia' && policy.loadout.length) {
          cv.Meta.commitBoosterLoadout(policy.loadout, cv.Config.SURVIVAL_LOADOUT_MAX);
        }
        runOne(cfg);
        if (mode === 'supervivencia') revivesPaid += cv.Survival.revives | 0;
        VDATE.offsetMs += minutes * 60000 + 5 * 60000; // sesión + descanso
      }

      // Gasto post-sesión (política).
      if (policy.buysCosmetics) {
        for (const item of catalogItems) {
          if (!item.owned() && cv.Meta.coins() >= item.cost && item.buy()) itemsBought++;
        }
      }
      if (cv.Meta.chestSlotLimit() < 4 && cv.Meta.gems() >= cv.Meta.CHEST_SLOT_GEMS) {
        cv.Meta.unlockChestSlot(); // desbloqueo permanente: lo hacen TODAS las políticas
      }
      if (report.catalogDoneDay === null && catalogItems.every((item) => item.owned())) {
        report.catalogDoneDay = day;
      }

      // Gestión de cofres: arrancar el temporizador si no hay ninguno en curso.
      if (!cv.Meta.chestUnlock()) {
        const next = cv.Meta.chestAutoQueue()[0];
        if (next) cv.Meta.startChestUnlock(next.uid);
      }
      // Aceleración (spender): abre YA el cofre en curso una vez al día si puede pagarlo.
      if (policy.accelerate) {
        const running = cv.Meta.chestUnlock();
        if (running) {
          const cost = cv.Meta.chestInstantCost(running.uid);
          if (cost > 0 && cv.Meta.spendGems(cost, 'chest-skip')) {
            const choice = cv.Meta.chestChoiceInfo(running.uid);
            if (choice) { cv.Meta.makeChestChoiceReady(running.uid); cv.Meta.claimChestChoice(running.uid, policy.choicePick); }
            else cv.Meta.openChest(running.uid);
            chestsAccelerated++;
          }
        }
      }

      // Fin del día: pasa el resto del día de reloj y se recogen los listos.
      VDATE.offsetMs = day * DAY_MS;
      for (const uid of cv.Meta.chestReadyUids()) {
        const choice = cv.Meta.chestChoiceInfo(uid);
        if (choice) {
          const pick = choice.choice.options.some((o) => o.id === policy.choicePick) ? policy.choicePick : choice.choice.options[0].id;
          cv.Meta.claimChestChoice(uid, pick);
        } else cv.Meta.openChest(uid);
      }
      if (!cv.Meta.chestUnlock()) {
        const next = cv.Meta.chestAutoQueue()[0];
        if (next) cv.Meta.startChestUnlock(next.uid);
      }

      if (checkpoints.includes(day)) {
        const summary = cv.EconomyAudit.summary();
        report.checkpoints.push({
          day,
          balances: { coins: cv.Meta.coins(), gems: cv.Meta.gems(), tickets: cv.Meta.tickets() },
          flows: forecastCurrencies(summary),
          itemsBought, revivesPaid, chestsAccelerated,
          chestReserve: cv.Meta.chests(),
          chestQueueHours: Math.round(chestQueueHours() * 10) / 10,
          boosterStock: cv.Meta.boosterInventory(),
          cosmeticsOwned: catalogItems.filter((item) => item.owned()).length,
          catalogDoneDay: report.catalogDoneDay,
          level: cv.Meta.level(),
        });
      }
    }

    const summary = cv.EconomyAudit.summary();
    report.end = {
      balances: { coins: cv.Meta.coins(), gems: cv.Meta.gems(), tickets: cv.Meta.tickets() },
      flows: forecastCurrencies(summary),
      reasons: summary.rows,
      itemsBought, revivesPaid, chestsAccelerated,
      chestReserve: cv.Meta.chests(),
      chestQueueHours: Math.round(chestQueueHours() * 10) / 10,
      cosmeticsOwned: catalogItems.filter((item) => item.owned()).length,
      level: cv.Meta.level(),
    };
    return report;
  } finally {
    Math.random = originalRandom;
    uninstallVirtualDate();
    VDATE.offsetMs = 0;
    restoreMetaState(originalMeta);
    if (storage) {
      if (originalStoredMeta === null) storage.removeItem('cv_meta');
      else storage.setItem('cv_meta', originalStoredMeta);
    }
    cv.EconomyAudit.enable(auditWasEnabled);
    cv.EconomyAudit.reset();
    cv.EconomyAudit.setSession('local');
  }
}

function printForecast(report) {
  console.log(`economy-forecast · ${report.days} días · ${report.sessionsPerDay} sesión(es)/día × ${report.minutesPerSession} min · política ${report.policy} · perfil ${report.profile} · seed ${report.seed}`);
  console.log(`catálogo comprable: ${report.catalogTotal} monedas · completado: ${report.catalogDoneDay ? 'día ' + report.catalogDoneDay : 'no'}`);
  for (const cp of report.checkpoints) {
    const f = cp.flows;
    console.log([
      `día ${String(cp.day).padStart(3)}`,
      `monedas ${String(cp.balances.coins).padStart(7)} (+${f.coins.minted}/-${f.coins.burned})`,
      `gemas ${String(cp.balances.gems).padStart(5)} (+${f.gems.minted}/-${f.gems.burned})`,
      `tickets ${String(cp.balances.tickets).padStart(3)}`,
      `cosméticos ${cp.cosmeticsOwned}`,
      `reserva ${cp.chestReserve} cofres/${cp.chestQueueHours}h`,
      `nivel ${cp.level}`,
    ].join(' · '));
  }
  const reasons = (report.end && report.end.reasons) || [];
  if (reasons.length) {
    console.log('flujos por motivo (divisa|dirección|motivo → cantidad):');
    reasons.forEach((row) => console.log(`  ${row.currency}|${row.direction}|${row.reason} → ${row.amount} (${row.count}×)`));
  }
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

function fmtChestValue(value) {
  if (Math.abs(value) >= 100) return value.toFixed(0);
  if (Math.abs(value) >= 10) return value.toFixed(1);
  return value.toFixed(2);
}

function printChestSummary(report) {
  console.log(`chest-economy · ${report.runs} aperturas/tipo-nivel · seed ${report.seed}`);
  console.log('C/G/T/B = EV monedas/gemas/tickets/boosters · P = premios/cofre · U = tier-ups');
  for (const type of report.types) {
    const cells = report.rows.filter((row) => row.type === type).map((row) => {
      const ev = row.ev;
      return `L${row.level} C${fmtChestValue(ev.coins)} G${fmtChestValue(ev.gems)} T${fmtChestValue(ev.tickets)} B${fmtChestValue(ev.boosters)} P${row.avgPrizes.toFixed(2)} U${(row.tierUpRate * 100).toFixed(1)}%`;
    });
    console.log(type.padEnd(9) + ' ' + cells.join(' | '));
  }
}

/* Exportable para tests (guardarraíl de medallas del reto diario + forecast ECO). */
module.exports = { runOne, runBatch, runChestEconomy, runEconomyForecast, PROFILES, POLICIES, cv, VCLOCK, VDATE };

if (require.main === module) {
  const args = process.argv.slice(2);
  const opt = (name, dflt) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : dflt; };
  const runs = +opt('runs', 40);
  const modes = opt('modes', '').split(',').filter(Boolean);
  const jsonOut = opt('json', '');
  const chestMode = args.includes('--chests');
  const economyMode = args.includes('--economy');
  const ratesMode = args.includes('--rates');

  if (ratesMode) {
    // ECO-1: monedas por 10 minutos de juego activo, con liquidación al corte.
    // Es la métrica de las puertas §3.1 del plan de reequilibrio.
    const configs = STANDARD.filter((c) => !modes.length || modes.includes(c.mode));
    console.log(`coin-rates · ${runs} runs/config · liquidación al corte de sesión · monedas/10 min (p50 · p90 · media)`);
    const results = [];
    for (const cfg of configs) {
      const r = runBatch(Object.assign({ settleOnCutoff: true }, cfg), runs);
      results.push({ cfg: r.cfg, coinsPer10Min: r.coinsPer10Min, progress: r.progress.p50 });
      console.log([
        cfg.mode.padEnd(13), (cfg.diff || 'normal').padEnd(8), cfg.profile.padEnd(8),
        String(Math.round(r.coinsPer10Min.p50)).padStart(6),
        String(Math.round(r.coinsPer10Min.p90)).padStart(6),
        String(Math.round(r.coinsPer10Min.avg)).padStart(6),
      ].join('  '));
    }
    if (jsonOut) { require('fs').writeFileSync(jsonOut, JSON.stringify(results, null, 2)); console.log('\nJSON → ' + jsonOut); }
  } else if (economyMode) {
    const report = runEconomyForecast({
      days: +opt('days', 7),
      sessionsPerDay: +opt('sessions', 2),
      minutesPerSession: +opt('minutes', 8),
      profile: opt('profile', 'average'),
      policy: opt('policy', 'saver'),
      diff: opt('diff', 'normal'),
      seed: +opt('seed', 0xec0510),
      checkpoints: opt('checkpoints', '').split(',').filter(Boolean).map(Number),
    });
    printForecast(report);
    if (jsonOut) { require('fs').writeFileSync(jsonOut, JSON.stringify(report, null, 2)); console.log('\nJSON → ' + jsonOut); }
  } else if (chestMode) {
    const types = opt('chest-types', '').split(',').filter(Boolean);
    const levels = opt('chest-levels', '').split(',').filter(Boolean);
    const report = runChestEconomy({
      runs,
      seed: +opt('seed', 0xc0ffee),
      types: types.length ? types : undefined,
      levels: levels.length ? levels : undefined,
    });
    printChestSummary(report);
    if (jsonOut) { require('fs').writeFileSync(jsonOut, JSON.stringify(report, null, 2)); console.log('\nJSON → ' + jsonOut); }
  } else {
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
}
