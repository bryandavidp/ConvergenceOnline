'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { makeEl, getMemoEl } = require('./dom-stub.js');
require('../game.js');

const cv = globalThis.window.__cv;
const { FX, State, Config, I18n, Settings, Adventure, Meta, ModeSignals, Game, Toasts, Boards, Themes, Modal } = cv;
const root = path.join(__dirname, '..');

function withRandomSequence(seq, fn) {
  const prev = Math.random;
  let idx = 0;
  Math.random = () => seq[Math.min(idx++, seq.length - 1)];
  try { return fn(); }
  finally { Math.random = prev; }
}

function snapshotEconomy() {
  const m = Meta.state;
  return {
    coins: m.coins,
    gems: m.gems,
    tickets: m.tickets,
    chests: m.chests,
    boards: JSON.parse(JSON.stringify(m.boards)),
    cosmetics: JSON.parse(JSON.stringify(m.cosmetics)),
  };
}

function restoreEconomy(snap) {
  const m = Meta.state;
  m.coins = snap.coins;
  m.gems = snap.gems;
  m.tickets = snap.tickets;
  m.chests = snap.chests;
  m.boards = snap.boards;
  m.cosmetics = snap.cosmetics;
}

test('FB-5: Picker y PreLevel son capas globales, no hijas de screen-game', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const gameStart = html.indexOf('id="screen-game"');
  const gameEnd = html.indexOf('</section>', gameStart);
  const picker = html.indexOf('id="pick-overlay"');
  const prelevel = html.indexOf('id="prelevel"');
  const mainEnd = html.indexOf('</main>');

  assert.ok(gameStart >= 0, 'screen-game debe existir');
  assert.ok(gameEnd > gameStart, 'screen-game debe cerrarse');
  assert.ok(picker > gameEnd, 'pick-overlay debe quedar fuera de screen-game');
  assert.ok(prelevel > gameEnd, 'prelevel debe quedar fuera de screen-game');
  assert.ok(picker < mainEnd, 'pick-overlay debe seguir dentro de main');
  assert.ok(prelevel < mainEnd, 'prelevel debe seguir dentro de main');
});

test('FB-3: Modal.open resetea scroll y enfoca el CTA del footer sin desplazar', () => {
  const body = getMemoEl('q:.modal-body');
  const footerCta = getMemoEl('q:.modal-actions button:not([disabled])');
  body.scrollTop = 240;
  document.activeElement = null;

  cv.Modal.open('modal-over');

  assert.equal(body.scrollTop, 0, 'el body scrolleable del modal debe abrir arriba');
  assert.equal(document.activeElement, footerCta, 'el foco debe preferir el CTA del footer');
  assert.deepEqual(footerCta._lastFocusOptions, { preventScroll: true });
});

function resetFxPool() {
  FX.pool = Array.from({ length: FX.POOL }, () => ({ el: makeEl('span'), anim: null, busy: false }));
  FX.idx = 0;
  FX.active = 0;
  FX.supported = true;
  FX.wave = makeEl('span');
}

test('FB-1: la convergencia emite el mismo plan con cap 18 que con cap 50', () => {
  const prevCombo = State.combo;
  State.size = 8;
  State.combo = 20;
  const cells = [24, 30, 3, 59];

  resetFxPool();
  FX.cap = 18;
  FX.converge(27, cells, '#ffd84d');
  const lowCap = FX.active;

  resetFxPool();
  FX.cap = 50;
  FX.converge(27, cells, '#ffd84d');
  const highCap = FX.active;

  State.combo = prevCombo;
  assert.equal(lowCap, highCap, 'el burst de convergencia no debe depender de FX.cap');
  assert.ok(lowCap > 18, 'el caso debe superar el cap móvil antiguo para detectar regresiones');
  assert.ok(lowCap <= FX.ABS_MAX, 'la convergencia debe respetar el backstop absoluto');
});

test('FB-1: los emisores forzados respetan ABS_MAX', () => {
  resetFxPool();
  FX.cap = 1;
  FX.active = FX.ABS_MAX - 1;
  FX._emit(0, 0, 0, 0, 0, 0.2, 4, '#fff', 0, 0, 0, true);
  assert.equal(FX.active, FX.ABS_MAX);
  FX._emit(0, 0, 0, 0, 0, 0.2, 4, '#fff', 0, 0, 0, true);
  assert.equal(FX.active, FX.ABS_MAX, 'force no puede rebasar ABS_MAX');
});

test('FB-1: aviso reduced-fx heredado y limpieza de popup.show quedan protegidos', () => {
  const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
  const langBak = Settings.lang;
  for (const lang of ['es', 'en']) {
    Settings.lang = lang;
    assert.ok(I18n.t('rfx_system_notice') !== 'rfx_system_notice');
    assert.ok(/settings|ajustes/i.test(I18n.t('perf_light_on')));
  }
  Settings.lang = langBak;
  assert.ok(!/\.popup\.show/.test(css), 'la ruta muerta .popup.show no debe volver');
  assert.ok(!/popup-float-flat/.test(css), 'el override muerto de perf-2 no debe volver');
});

test('FB-6: el objetivo score de Aventura escala y muestra progreso vivo', () => {
  const prev = {
    objective: Adventure.objective,
    target: Adventure.target,
    levelScore0: Adventure.levelScore0,
    score: State.score,
    lang: Settings.lang,
  };
  Settings.lang = 'es';
  Adventure.objective = 'score';
  Adventure.target = Adventure.scoreTarget(3);
  Adventure.levelScore0 = 1200;
  State.score = 1500;

  assert.equal(Adventure.scoreTarget(3), 900, 'L3 debe requerir 900 puntos');
  assert.equal(Adventure.scoreTarget(8), 2800, 'L8 debe escalar con capítulo/nivel');
  assert.equal(Adventure.objectiveText(), 'Puntos: 300/900');
  assert.equal(Adventure.completionReason(), 'Objetivo cumplido: 900 pts');

  Adventure.objective = prev.objective;
  Adventure.target = prev.target;
  Adventure.levelScore0 = prev.levelScore0;
  State.score = prev.score;
  Settings.lang = prev.lang;
});

test('FB-4: el reto diario centraliza umbrales y actualiza siguiente medalla', () => {
  const prev = {
    score: State.score,
    isDaily: State.isDaily,
    lang: Settings.lang,
    show: Toasts.show,
    seen: Game._dailyMedalSeen,
  };
  const note = getMemoEl('q:#daily-note');
  const calls = [];
  Toasts.show = (msg, type, duration, icon) => calls.push({ msg, type, duration, icon });
  Settings.lang = 'es';
  State.isDaily = true;
  State.score = 0;
  Game._dailyMedalSeen = Object.create(null);

  try {
    assert.deepEqual(Meta.DAILY_MEDALS, [750, 1500, 2500]);
    assert.equal(Meta.dailyNextMedal(0), 750);
    assert.equal(Meta.dailyNextMedal(750), 1500);
    assert.equal(Meta.dailyNextMedal(2500), null);
    assert.match(ModeSignals.dailyNoteText(0), /750/);

    State.score = 800;
    Game.updateDailyObjective(700);

    assert.match(note.textContent, /1500/);
    assert.equal(calls.length, 1);
    assert.match(calls[0].msg, /Bronce/);
    assert.match(calls[0].msg, /1500/);
    assert.equal(calls[0].icon, '🥉');
  } finally {
    Toasts.show = prev.show;
    Game._dailyMedalSeen = prev.seen;
    State.score = prev.score;
    State.isDaily = prev.isDaily;
    Settings.lang = prev.lang;
  }
});

test('FB-4: textos del reto diario no vuelven a usar ellipsis ni ocultar chips', () => {
  const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
  const badge = css.match(/^\.mc-badge \{[^}]+\}/m);
  assert.ok(badge, 'la regla .mc-badge debe existir');
  assert.match(badge[0], /white-space: normal/);
  assert.doesNotMatch(badge[0], /ellipsis/);
  assert.doesNotMatch(css, /\.mc-feats \{ display: none; \}/);
  assert.match(css, /\.ac-daily-state span/);
  assert.match(css, /#modal-daily/);
});

test('FB-7: el drop cosmético concede no poseídos y grantTheme es idempotente', () => {
  const snap = snapshotEconomy();
  const m = Meta.state;
  try {
    m.coins = 0; m.gems = 0; m.tickets = 0; m.chests = 1;
    m.boards = { owned: { classic: 1 }, equipped: 'classic' };
    m.cosmetics = { owned: {}, theme: 'default', skin: 'default', fx: 'default' };

    const r = withRandomSequence([0.99, 0], () => Meta.openChest());
    assert.equal(r.kind, 'cosmetic');
    assert.equal(r.cosmeticKind, 'board');
    assert.equal(Meta.ownsBoard(r.id), true);
    assert.equal(m.boards.owned[r.id], 1);
    assert.ok(!Meta.chestCosmeticPool().some((x) => x.cosmeticKind === r.cosmeticKind && x.id === r.id));

    assert.equal(Meta.grantTheme('neon'), true);
    assert.match(m.cosmetics.owned.neon, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(Meta.grantTheme('neon'), false);
  } finally {
    restoreEconomy(snap);
  }
});

test('FB-7: pool cosmético vacío cae a gemas normales o jackpot premium', () => {
  const snap = snapshotEconomy();
  const m = Meta.state;
  try {
    m.coins = 0; m.gems = Meta.PREMIUM_CHEST_GEMS; m.tickets = 0; m.chests = 1;
    m.boards = { owned: { classic: 1 }, equipped: 'classic' };
    Boards.order.forEach((id) => { if (id !== 'classic' && !Boards.DEFS[id].exclusive) m.boards.owned[id] = 1; });
    m.cosmetics = { owned: {}, theme: 'default', skin: 'default', fx: 'default' };
    Themes.order.forEach((id) => { if (id !== 'default') m.cosmetics.owned[id] = '2026-01-01'; });

    const normal = withRandomSequence([0.99, 0], () => Meta.openChest());
    assert.deepEqual({ kind: normal.kind, amount: normal.amount, fallback: normal.fallback }, { kind: 'gems', amount: 8, fallback: 'cosmetic' });
    assert.equal(m.gems, Meta.PREMIUM_CHEST_GEMS + 8);

    const premium = withRandomSequence([0.99, 0], () => Meta.openPremiumChest());
    assert.deepEqual({ kind: premium.kind, amount: premium.amount, rarity: premium.rarity, fallback: premium.fallback }, { kind: 'coins', amount: 600, rarity: 'jackpot', fallback: 'cosmetic' });
    assert.equal(m.gems, 8);
    assert.equal(m.coins, 600);
  } finally {
    restoreEconomy(snap);
  }
});

test('FB-7: UI de cofres conserva feedback clicable y tarjeta persistente', () => {
  const js = fs.readFileSync(path.join(root, 'game.js'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
  const prevLang = Settings.lang;
  assert.doesNotMatch(js, /ob\.disabled = n <= 0/);
  assert.doesNotMatch(js, /pb\.disabled = Meta\.gems\(\) < Meta\.PREMIUM_CHEST_GEMS/);
  assert.match(js, /classList\.toggle\('is-poor'/);
  assert.match(css, /\.chest-big\.opening/);
  assert.match(css, /\.chest-reveal/);
  try {
    for (const lang of ['es', 'en']) {
      Settings.lang = lang;
      ['chest_reveal_title', 'chest_cosmetic_title', 'chest_continue', 'chest_equip', 'chest_reward_board', 'chest_reward_theme'].forEach((key) => {
        assert.notEqual(I18n.t(key), key);
      });
    }
  } finally {
    Settings.lang = prevLang;
  }
});

test('FB-8: cerrar un modal secundario tras game over vuelve al inicio', () => {
  const prev = {
    status: State.status,
    mode: State.mode,
    screen: document.body.dataset.screen,
    modalId: Modal._id,
  };
  try {
    State.status = 'over';
    State.mode = 'supervivencia';
    document.body.dataset.screen = 'game';

    Modal.open('modal-over');
    Modal.close();
    assert.equal(State.status, 'over', 'cerrar el resumen no debe saltar antes de abrir la opcion');
    assert.equal(document.body.dataset.screen, 'game');

    Modal.open('modal-chests');
    Modal.close();

    assert.equal(State.status, 'idle');
    assert.equal(document.body.dataset.screen, 'start');
    assert.equal(document.querySelector('#overlay').hidden, true);
  } finally {
    document.querySelector('#overlay').hidden = true;
    document.body.classList.remove('modal-open');
    Modal._last = null;
    State.status = prev.status;
    State.mode = prev.mode;
    document.body.dataset.screen = prev.screen;
    Modal._id = prev.modalId;
  }
});

test('SV-HUD: el banner de jefe no se apila sobre las filas secundarias', () => {
  const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
  assert.match(css, /\.surv-bar\.encounter\s+\.surv-subrow\s*\{\s*display:\s*none;\s*\}/);
  assert.match(css, /body\.mode-surv\s+\.surv-build\[hidden\]\s*\{[\s\S]*display:\s*flex\s*!important;[\s\S]*min-height:\s*25px;[\s\S]*visibility:\s*hidden;/);
  assert.match(css, /body\.mode-surv\s+\.surv-bar\.encounter\s+\.surv-build\s*\{[\s\S]*display:\s*none\s*!important;[\s\S]*visibility:\s*hidden;/);
});

test('FB-2: Contrarreloj tiene material inicial propio y DDA de hambre acotado', () => {
  const prev = { elapsed: State.elapsed, iconCount: State.iconCount };
  const mode = Config.MODES.contrarreloj;
  try {
    assert.equal(mode.initialIcons, 22);

    State.elapsed = 5;
    State.iconCount = 6;
    assert.equal(mode.spawnFactor(), 1, 'el DDA no debe apilarse durante el warm-up');

    State.elapsed = 12;
    State.iconCount = 10;
    assert.equal(mode.spawnFactor(), 0.65);
    State.iconCount = 16;
    assert.equal(mode.spawnFactor(), 0.85);
    State.iconCount = 24;
    assert.equal(mode.spawnFactor(), 1);
    State.iconCount = 30;
    assert.equal(mode.spawnFactor(), 1.1);
  } finally {
    State.elapsed = prev.elapsed;
    State.iconCount = prev.iconCount;
  }
});
