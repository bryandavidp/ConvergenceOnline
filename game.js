/* =========================================================================
 * Convergencia — clon vanilla (sin frameworks, sin assets externos).
 *
 * Mecánica: toca una casilla VACÍA; se mira el icono más cercano en cada una
 * de las 4 direcciones; si 2 o más coinciden, convergen y se eliminan.
 *
 * Arquitectura modular (objetos independientes) pensada para poder dividir
 * cada bloque en su propio archivo o migrar a otro lenguaje:
 *   Config · Storage · Sound · State · Engine · Render · Toasts · Screens ·
 *   Loop · Game · Input · init
 *
 * Rendimiento (móvil): un único bucle rAF, celdas DOM reutilizadas (se
 * actualiza solo lo que cambia), animaciones por transform/opacity, pool de
 * popups, entrada por pointerdown (sin retardo de 300 ms).
 * ========================================================================= */
(() => {
  'use strict';

  /* ===================== Config ===================== */
  const Config = {
    SIZE: 8,
    // Iconos por niveles de complejidad (se van añadiendo con el nivel)
    ICON_POOL: ['🍎','🍇','🍊','🍓','🐶','🐱','🐭','🐰','⭐','✨','🔥','🌈','🍕','🍔','🍣','🍜'],
    COMBO_MULTIPLIERS: [[30,10],[20,8],[15,5],[10,3],[6,2],[3,1.5]], // [umbral, multiplicador], desc
    MILESTONES: { 10: 500, 20: 1000, 30: 2000 },
    BASE_TARGET: 1000,
    TARGET_GROWTH: 1.5,
    TIMED_DURATION: 120,      // s
    TIMED_LEVEL_BONUS: 15,    // s al subir de nivel
    DIFFICULTY: {
      facil:   { label: 'Fácil',   initialIcons: 16, comboWindow: 5000, spawnStart: 3200, spawnMin: 1000, scoreMult: 0.8 },
      normal:  { label: 'Normal',  initialIcons: 26, comboWindow: 3500, spawnStart: 2600, spawnMin: 700,  scoreMult: 1.0 },
      dificil: { label: 'Difícil', initialIcons: 34, comboWindow: 2500, spawnStart: 2100, spawnMin: 500,  scoreMult: 1.3 },
    },
    MODES: {
      tutorial:      { name: 'Tutorial',     emoji: '🎓', timed: false, target: 150,  fixedDiff: 'facil', desc: 'Aprende la mecánica sin prisa.' },
      clasico:       { name: 'Clásico',      emoji: '♟️', timed: false, target: null, desc: 'Alcanza el objetivo de puntos para subir de nivel.' },
      contrarreloj:  { name: 'Contrarreloj', emoji: '⏱️', timed: true,  target: null, desc: 'Consigue la máxima puntuación antes de que se acabe el tiempo.' },
      supervivencia: { name: 'Supervivencia',emoji: '❤️', timed: false, target: null, fast: true, desc: 'Los iconos llegan más rápido. Aguanta sin llenar el tablero.' },
      zen:           { name: 'Zen',          emoji: '☯️', timed: false, target: null, relaxed: true, desc: 'Ritmo relajado, sin presión. Juega y respira.' },
    },
    MODE_ORDER: ['tutorial', 'clasico', 'contrarreloj', 'supervivencia', 'zen'],
    DIFF_ORDER: ['facil', 'normal', 'dificil'],
  };

  /* ===================== Storage ===================== */
  const Storage = {
    get best() { return +(localStorage.getItem('cv_best') || 0); },
    set best(v) { localStorage.setItem('cv_best', String(v)); },
    get sound() { return localStorage.getItem('cv_sound') !== 'off'; },
    set sound(v) { localStorage.setItem('cv_sound', v ? 'on' : 'off'); },
    get user() { return localStorage.getItem('cv_user'); },
    set user(v) { v ? localStorage.setItem('cv_user', v) : localStorage.removeItem('cv_user'); },
  };

  /* ===================== Sound (WebAudio, sin archivos) ===================== */
  const Sound = {
    ctx: null, enabled: Storage.sound,
    ensure() {
      if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (_) {} }
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    },
    tone(freq, dur, type = 'sine', vol = 0.2, when = 0) {
      if (!this.enabled || !this.ctx) return;
      const t = this.ctx.currentTime + when;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = type; osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g).connect(this.ctx.destination);
      osc.start(t); osc.stop(t + dur + 0.02);
    },
    tap()    { this.tone(420, 0.06, 'triangle', 0.12); },
    success(){ this.tone(660, 0.10, 'sine', 0.18); this.tone(990, 0.10, 'sine', 0.12, 0.04); },
    combo(l) { const base = 520 + l * 90; this.tone(base, 0.10, 'square', 0.12); this.tone(base * 1.5, 0.12, 'sine', 0.12, 0.05); },
    miss()   { this.tone(160, 0.14, 'sawtooth', 0.10); },
    level()  { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.16, 'sine', 0.16, i * 0.09)); },
    over()   { [392, 311, 247, 196].forEach((f, i) => this.tone(f, 0.22, 'sine', 0.18, i * 0.12)); },
  };

  /* ===================== Helpers ===================== */
  const $ = (s) => document.querySelector(s);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (n) => (Math.random() * n) | 0;
  const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const DIRS = [-1, 0, 1, 0, 0, 1, 0, -1]; // pares (dr,dc): arriba, derecha, abajo, izquierda

  /* ===================== State ===================== */
  const State = {
    board: [], size: Config.SIZE,
    score: 0, level: 1, iconCount: 0,
    combo: 0, comboMult: 1, comboAt: 0, comboWindow: 3500,
    spawnRate: 2600, elapsed: 0, timeLeft: 0,
    status: 'idle', // idle|playing|paused|over|levelComplete
    mode: 'clasico', diff: 'normal',
    target: 1000,
    pool: [], // iconos disponibles este nivel
  };

  /* ===================== Engine (lógica pura del tablero) ===================== */
  const Engine = {
    idx: (r, c) => r * State.size + c,
    inside: (r, c) => r >= 0 && c >= 0 && r < State.size && c < State.size,

    poolForLevel(level) {
      const variety = clamp(4 + Math.floor((level - 1) / 2), 4, Config.ICON_POOL.length);
      return Config.ICON_POOL.slice(0, variety);
    },

    targetForLevel(level) {
      const m = Config.MODES[State.mode];
      if (m.target != null) return m.target;
      return Math.round(Config.BASE_TARGET * Math.pow(Config.TARGET_GROWTH, level - 1));
    },

    spawnRateForLevel(level) {
      const d = Config.DIFFICULTY[State.diff];
      const m = Config.MODES[State.mode];
      let base = d.spawnStart * Math.pow(0.9, level - 1);
      if (m.fast) base *= 0.8;        // supervivencia: más rápido
      if (m.relaxed) base *= 1.25;    // zen: más lento
      return Math.round(clamp(base, d.spawnMin, 6000));
    },

    emptyCells() {
      const out = [];
      for (let i = 0; i < State.board.length; i++) if (State.board[i] === null) out.push(i);
      return out;
    },

    /* Iconos que convergen al tocar la casilla vacía `i`.
       Devuelve los índices a eliminar (grupos con 2+ del mismo tipo). */
    converging(i) {
      if (State.board[i] !== null) return [];
      const r = (i / State.size) | 0, c = i % State.size;
      const groups = Object.create(null);
      for (let d = 0; d < 8; d += 2) {
        let rr = r + DIRS[d], cc = c + DIRS[d + 1];
        while (this.inside(rr, cc)) {
          const v = State.board[this.idx(rr, cc)];
          if (v !== null) { (groups[v] || (groups[v] = [])).push(this.idx(rr, cc)); break; }
          rr += DIRS[d]; cc += DIRS[d + 1];
        }
      }
      const out = [];
      for (const k in groups) if (groups[k].length >= 2) out.push(...groups[k]);
      return out;
    },

    /* ¿Queda algún movimiento posible? (alguna casilla vacía que converja) */
    hasMoves() {
      for (let i = 0; i < State.board.length; i++) {
        if (State.board[i] === null && this.converging(i).length >= 2) return true;
      }
      return false;
    },

    placeInitial(n) {
      const empties = this.emptyCells();
      for (let k = 0; k < n && empties.length; k++) {
        const j = rand(empties.length);
        const idx = empties.splice(j, 1)[0];
        State.board[idx] = State.pool[rand(State.pool.length)];
        State.iconCount++;
      }
    },

    spawnOne() {
      const empties = this.emptyCells();
      if (!empties.length) return -1;
      const idx = empties[rand(empties.length)];
      State.board[idx] = State.pool[rand(State.pool.length)];
      State.iconCount++;
      return idx;
    },
  };

  /* ===================== Render (DOM) ===================== */
  const Render = {
    boardEl: null, cells: [], glyphs: [],
    popupsEl: null, popupPool: [], popupNext: 0,

    buildBoard() {
      this.boardEl = $('#board');
      this.popupsEl = $('#popups');
      this.boardEl.style.setProperty('--size', State.size);
      this.boardEl.innerHTML = '';
      this.cells = []; this.glyphs = [];
      const frag = document.createDocumentFragment();
      for (let i = 0; i < State.size * State.size; i++) {
        const b = document.createElement('button');
        b.className = 'cell empty';
        b.dataset.i = i;
        b.setAttribute('role', 'gridcell');
        b.tabIndex = i === 0 ? 0 : -1;
        const g = document.createElement('span');
        g.className = 'glyph'; g.setAttribute('aria-hidden', 'true');
        b.appendChild(g);
        frag.appendChild(b);
        this.cells.push(b); this.glyphs.push(g);
      }
      this.boardEl.appendChild(frag);
      // pool de popups
      this.popupsEl.innerHTML = '';
      this.popupPool = [];
      for (let i = 0; i < 14; i++) {
        const p = document.createElement('div');
        p.className = 'popup';
        this.popupsEl.appendChild(p);
        this.popupPool.push(p);
      }
    },

    cellLabel(i) {
      const r = (i / State.size | 0) + 1, c = (i % State.size) + 1;
      const v = State.board[i];
      return `Fila ${r}, columna ${c}: ${v ? v : 'vacía'}`;
    },

    syncCell(i) {
      const el = this.cells[i], v = State.board[i];
      const g = this.glyphs[i];
      if (g.textContent !== (v || '')) g.textContent = v || '';
      el.classList.toggle('empty', v === null);
      el.classList.toggle('has-icon', v !== null);
      el.setAttribute('aria-label', this.cellLabel(i));
    },

    syncAll() { for (let i = 0; i < State.board.length; i++) this.syncCell(i); },

    spawnAnim(i) { const el = this.cells[i]; el.classList.remove('spawn'); void el.offsetWidth; el.classList.add('spawn'); },
    clearAnim(indices) {
      indices.forEach(i => {
        const el = this.cells[i];
        el.classList.add('clear');
        const g = this.glyphs[i];
        el.addEventListener('animationend', () => {
          el.classList.remove('clear');
          g.textContent = '';
        }, { once: true });
      });
    },
    miss(i) { const el = this.cells[i]; el.classList.remove('miss'); void el.offsetWidth; el.classList.add('miss'); },

    hint(indices, on) { indices.forEach(i => this.cells[i].classList.toggle('hint', on)); },

    popup(i, text, color) {
      const r = (i / State.size | 0), c = i % State.size;
      const p = this.popupPool[this.popupNext = (this.popupNext + 1) % this.popupPool.length];
      p.textContent = text;
      p.style.color = color || '#fff';
      p.style.left = ((c + 0.5) / State.size * 100) + '%';
      p.style.top = ((r + 0.5) / State.size * 100) + '%';
      p.classList.remove('show'); void p.offsetWidth; p.classList.add('show');
    },

    bump(el) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); },

    hud() {
      $('#hud-score').textContent = State.score;
      $('#hud-level').textContent = State.level;
      $('#hud-best').textContent = Storage.best;
      $('#hud-speed').textContent = (State.spawnRate / 1000).toFixed(1) + 's';
      const timeEl = $('#hud-time');
      timeEl.textContent = Config.MODES[State.mode].timed ? fmtTime(State.timeLeft) : fmtTime(State.elapsed);
      const pct = State.target ? clamp(State.score / State.target * 100, 0, 100) : 0;
      $('#hud-progress-fill').style.width = pct + '%';
    },

    combo() {
      const el = $('#combo');
      if (State.combo < 3) { el.hidden = true; el.setAttribute('aria-hidden', 'true'); return; }
      el.hidden = false;
      $('#combo-mult').textContent = 'x' + (State.comboMult % 1 === 0 ? State.comboMult : State.comboMult.toFixed(1));
      $('#combo-count').textContent = State.combo;
      el.classList.toggle('lv2', State.comboMult >= 2 && State.comboMult < 3);
      el.classList.toggle('lv3', State.comboMult >= 3 && State.comboMult < 5);
      el.classList.toggle('lv4', State.comboMult >= 5);
      el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse');
    },
    comboRing(frac) {
      const C = 119.38;
      $('#combo-ring-fill').style.strokeDashoffset = (C * (1 - clamp(frac, 0, 1))).toFixed(1);
    },
  };

  /* ===================== Toasts y lector de pantalla ===================== */
  const announce = (msg) => { $('#sr-status').textContent = msg; };
  const Toasts = {
    show(msg, kind = 'info', ms = 2200) {
      const el = $('#toasts');
      const t = document.createElement('div');
      t.className = 'toast ' + kind; t.textContent = msg;
      el.appendChild(t);
      setTimeout(() => { t.classList.add('out'); t.addEventListener('animationend', () => t.remove(), { once: true }); }, ms);
      // limitar a 3
      while (el.children.length > 3) el.firstChild.remove();
    },
  };

  /* ===================== Screens ===================== */
  const Screens = {
    show(name) {
      document.body.dataset.screen = name;
      document.querySelectorAll('.screen').forEach(s => { s.hidden = s.id !== 'screen-' + name; });
    },
  };
  const Modal = {
    open(id) {
      $('#overlay').hidden = false;
      document.querySelectorAll('.modal').forEach(m => m.hidden = m.id !== id);
      const m = $('#' + id);
      const focusable = m.querySelector('button, [href], input');
      if (focusable) focusable.focus();
    },
    close() { $('#overlay').hidden = true; document.querySelectorAll('.modal').forEach(m => m.hidden = true); },
  };

  /* ===================== Loop (un único requestAnimationFrame) ===================== */
  const Loop = {
    raf: 0, last: 0, spawnAcc: 0, clockAcc: 0,
    start() { this.last = performance.now(); this.spawnAcc = 0; this.clockAcc = 0; cancelAnimationFrame(this.raf); this.raf = requestAnimationFrame(this.tick); },
    stop() { cancelAnimationFrame(this.raf); this.raf = 0; },
    tick: (now) => {
      const L = Loop;
      const dt = Math.min(100, now - L.last); L.last = now;
      if (State.status === 'playing') {
        // reloj
        L.clockAcc += dt;
        if (L.clockAcc >= 1000) {
          const secs = Math.floor(L.clockAcc / 1000); L.clockAcc -= secs * 1000;
          State.elapsed += secs;
          if (Config.MODES[State.mode].timed) {
            State.timeLeft -= secs;
            if (State.timeLeft <= 0) { State.timeLeft = 0; Render.hud(); Game.gameOver('¡Se acabó el tiempo!'); }
          }
          Render.hud();
        }
        // spawn
        L.spawnAcc += dt;
        if (L.spawnAcc >= State.spawnRate) {
          L.spawnAcc -= State.spawnRate;
          Game.doSpawn();
        }
        // combo: expirar + anillo
        if (State.combo > 0) {
          const left = State.comboWindow - (now - State.comboAt);
          if (left <= 0) Game.resetCombo();
          else Render.comboRing(left / State.comboWindow);
        }
      }
      L.raf = requestAnimationFrame(L.tick);
    },
  };

  /* ===================== Game (orquestador) ===================== */
  const Game = {
    hintTimer: 0, hintCells: [],

    setupLevel(firstLevel) {
      State.pool = Engine.poolForLevel(State.level);
      State.spawnRate = Engine.spawnRateForLevel(State.level);
      State.target = Engine.targetForLevel(State.level);
      if (firstLevel) {
        State.board = new Array(State.size * State.size).fill(null);
        State.iconCount = 0;
        Engine.placeInitial(Config.DIFFICULTY[State.diff].initialIcons);
      }
      Render.syncAll();
      Render.hud();
      $('#hud-progress-label').textContent = 'Objetivo';
    },

    start(mode, diff) {
      State.mode = mode;
      State.diff = Config.MODES[mode].fixedDiff || diff;
      State.score = 0; State.level = 1; State.elapsed = 0;
      State.combo = 0; State.comboMult = 1; State.comboAt = 0;
      State.comboWindow = Config.DIFFICULTY[State.diff].comboWindow;
      State.timeLeft = Config.MODES[mode].timed ? Config.TIMED_DURATION : 0;
      State.status = 'playing';
      this.clearHint();
      this.setupLevel(true);
      Render.combo();
      Screens.show('game');
      Loop.start();
      announce(`Partida iniciada. Modo ${Config.MODES[mode].name}.`);
      Toasts.show('¡A jugar!', 'good', 1400);
      this.scheduleHint();
    },

    restart() { Modal.close(); this.start(State.mode, State.diff); },
    quit() { Loop.stop(); State.status = 'idle'; Modal.close(); this.clearHint(); refreshStart(); Screens.show('start'); },

    pause() {
      if (State.status !== 'playing') return;
      State.status = 'paused'; this.clearHint(); Modal.open('modal-pause'); announce('Juego en pausa.');
    },
    resume() {
      if (State.status !== 'paused') return;
      State.status = 'playing'; Modal.close(); Loop.last = performance.now(); this.scheduleHint();
    },

    /* Activación de una casilla (clic/tecla) */
    activate(i) {
      if (State.status !== 'playing') return;
      this.clearHint();
      if (State.board[i] !== null) { Sound.tap(); return; } // ocupada: nada
      const conv = Engine.converging(i);
      if (conv.length < 2) { Render.miss(i); Sound.miss(); this.scheduleHint(); return; }

      // Combo
      const now = performance.now();
      if (State.combo > 0 && now - State.comboAt <= State.comboWindow) State.combo++;
      else State.combo = 1;
      State.comboAt = now;
      State.comboMult = 1;
      for (const [thr, mult] of Config.COMBO_MULTIPLIERS) { if (State.combo >= thr) { State.comboMult = mult; break; } }

      // Puntos
      const removed = conv.length;
      const d = Config.DIFFICULTY[State.diff];
      const base = removed * 10 * State.level;
      const points = Math.floor(base * State.comboMult * d.scoreMult);
      State.score += points;

      // Hitos de combo
      if (Config.MILESTONES[State.combo]) { State.score += Config.MILESTONES[State.combo]; Toasts.show(`¡Combo x${State.combo}! +${Config.MILESTONES[State.combo]}`, 'good'); }

      // Aplicar al tablero
      conv.forEach(idx => { State.board[idx] = null; State.iconCount--; });
      Render.clearAnim(conv);
      conv.forEach(idx => Render.cells[idx].setAttribute('aria-label', Render.cellLabel(idx)));

      // Feedback
      const color = State.comboMult >= 5 ? '#ffd84d' : State.comboMult >= 3 ? '#ff5cf0' : State.comboMult >= 2 ? '#b46cff' : State.comboMult >= 1.5 ? '#00d0ff' : '#fff';
      Render.popup(i, State.comboMult > 1 ? `+${points} ×${State.comboMult}` : `+${points}`, color);
      Render.bump($('#hud-score'));
      Render.combo();
      if (State.combo >= 3) Sound.combo(State.combo >= 15 ? 4 : State.combo >= 10 ? 3 : State.combo >= 6 ? 2 : 1);
      else Sound.success();

      Render.hud();
      announce(`+${points} puntos. ${State.combo >= 3 ? 'Combo ' + State.combo + '. ' : ''}`);

      // ¿Nivel completado?
      if (State.target && State.score >= State.target) { this.levelComplete(); return; }
      this.scheduleHint();
    },

    doSpawn() {
      const idx = Engine.spawnOne();
      if (idx < 0) { this.gameOver('El tablero se llenó.'); return; }
      Render.syncCell(idx); Render.spawnAnim(idx);
      Render.hud();
      // Aceleración progresiva suave dentro del nivel
      const d = Config.DIFFICULTY[State.diff];
      State.spawnRate = Math.max(d.spawnMin, State.spawnRate - 6);
      // Game over si se llena o no hay jugadas posibles (salvo zen, más indulgente)
      if (Engine.emptyCells().length === 0) { this.gameOver('El tablero se llenó.'); }
    },

    resetCombo() { State.combo = 0; State.comboMult = 1; Render.combo(); },

    levelComplete() {
      State.status = 'levelComplete'; this.clearHint();
      const m = Config.MODES[State.mode];
      if (m.target != null) { // tutorial / objetivo único
        this.win('¡Has completado el tutorial!');
        return;
      }
      Sound.level();
      $('#level-sub').textContent = `Nivel ${State.level} superado · ${State.score} puntos`;
      Modal.open('modal-level');
      announce(`Nivel ${State.level} completado.`);
    },

    nextLevel() {
      State.level++;
      State.comboWindow = Config.DIFFICULTY[State.diff].comboWindow;
      if (Config.MODES[State.mode].timed) { State.timeLeft += Config.TIMED_LEVEL_BONUS; Toasts.show(`+${Config.TIMED_LEVEL_BONUS}s`, 'info', 1400); }
      State.status = 'playing';
      Modal.close();
      this.setupLevel(false);
      Loop.last = performance.now();
      Toasts.show(`Nivel ${State.level}`, 'info', 1400);
      this.scheduleHint();
    },

    win(reason) {
      Loop.stop(); State.status = 'over'; this.saveBest();
      Sound.level();
      $('#over-title').textContent = '🏆 ¡Victoria!';
      $('#over-title').className = '';
      $('#over-reason').textContent = reason;
      this.fillStats();
      Modal.open('modal-over');
    },

    gameOver(reason) {
      if (State.status === 'over') return;
      Loop.stop(); State.status = 'over'; this.clearHint(); this.saveBest();
      Sound.over();
      $('#over-title').textContent = '¡Misión fallida!';
      $('#over-reason').textContent = reason;
      this.fillStats();
      Modal.open('modal-over');
      announce(`Fin de la partida. ${reason} Puntuación ${State.score}.`);
    },

    fillStats() {
      $('#over-stats').innerHTML =
        `<div class="stat"><span class="v" style="color:var(--score)">${State.score}</span><span class="k">Puntos</span></div>` +
        `<div class="stat"><span class="v" style="color:var(--level)">${State.level}</span><span class="k">Nivel</span></div>` +
        `<div class="stat"><span class="v" style="color:var(--gold)">${Storage.best}</span><span class="k">Récord</span></div>`;
    },

    saveBest() { if (State.score > Storage.best) { Storage.best = State.score; } },

    /* Pistas tras inactividad */
    scheduleHint() {
      this.clearHint();
      this.hintTimer = setTimeout(() => {
        if (State.status !== 'playing') return;
        for (let i = 0; i < State.board.length; i++) {
          if (State.board[i] === null) {
            const conv = Engine.converging(i);
            if (conv.length >= 2) { this.hintCells = conv; Render.hint(conv, true); return; }
          }
        }
      }, 6000);
    },
    clearHint() { clearTimeout(this.hintTimer); if (this.hintCells.length) { Render.hint(this.hintCells, false); this.hintCells = []; } },
  };

  /* ===================== Input ===================== */
  const Input = {
    init() {
      const board = $('#board');
      // Activación rápida por pointerdown (sin retardo)
      board.addEventListener('pointerdown', (e) => {
        const cell = e.target.closest('.cell');
        if (!cell) return;
        e.preventDefault();
        Sound.ensure();
        Game.activate(+cell.dataset.i);
      });
      // Teclado: roving tabindex + flechas + Enter/Espacio
      board.addEventListener('keydown', (e) => {
        const cell = e.target.closest('.cell'); if (!cell) return;
        let i = +cell.dataset.i; const s = State.size;
        let n = i;
        if (e.key === 'ArrowRight') n = i % s === s - 1 ? i : i + 1;
        else if (e.key === 'ArrowLeft') n = i % s === 0 ? i : i - 1;
        else if (e.key === 'ArrowUp') n = i - s < 0 ? i : i - s;
        else if (e.key === 'ArrowDown') n = i + s >= s * s ? i : i + s;
        else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); Sound.ensure(); Game.activate(i); return; }
        else return;
        e.preventDefault();
        if (n !== i) { Render.cells[i].tabIndex = -1; Render.cells[n].tabIndex = 0; Render.cells[n].focus(); }
      });
    },
  };

  /* ===================== Construcción de menús ===================== */
  let selMode = 'clasico', selDiff = 'normal';
  function buildModeMenu() {
    const grid = $('#mode-grid'); grid.innerHTML = '';
    Config.MODE_ORDER.forEach(key => {
      const m = Config.MODES[key];
      const b = document.createElement('button');
      b.className = 'mode-card'; b.type = 'button';
      b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(key === selMode));
      b.dataset.mode = key;
      b.innerHTML = `<span class="emoji" aria-hidden="true">${m.emoji}</span><span class="name">${m.name}</span>`;
      b.addEventListener('click', () => selectMode(key));
      grid.appendChild(b);
    });
    const row = $('#diff-row'); row.innerHTML = '';
    Config.DIFF_ORDER.forEach(key => {
      const b = document.createElement('button');
      b.className = 'diff-chip'; b.type = 'button';
      b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(key === selDiff));
      b.dataset.diff = key; b.textContent = Config.DIFFICULTY[key].label;
      b.addEventListener('click', () => selectDiff(key));
      row.appendChild(b);
    });
    updateModeUI();
  }
  function selectMode(key) { selMode = key; updateModeUI(); }
  function selectDiff(key) { selDiff = key; updateModeUI(); }
  function updateModeUI() {
    const m = Config.MODES[selMode];
    document.querySelectorAll('.mode-card').forEach(c => c.setAttribute('aria-checked', String(c.dataset.mode === selMode)));
    const fixed = !!m.fixedDiff;
    document.querySelectorAll('.diff-chip').forEach(c => {
      const active = c.dataset.diff === (m.fixedDiff || selDiff);
      c.setAttribute('aria-checked', String(active));
      c.disabled = fixed;
    });
    $('#mode-desc').textContent = m.desc + (fixed ? ' (dificultad fija: ' + Config.DIFFICULTY[m.fixedDiff].label + ')' : '');
    $('#btn-start-game').disabled = false;
  }

  function refreshStart() {
    $('#start-best').textContent = Storage.best;
    const sw = $('#btn-sound'); sw.setAttribute('aria-checked', String(Sound.enabled));
  }

  /* ===================== init / wiring ===================== */
  function init() {
    Render.buildBoard();
    Input.init();
    buildModeMenu();

    // Login (demo)
    if (Storage.user) Screens.show('start'); else Screens.show('login');
    refreshStart();
    $('#login-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const email = $('#email').value.trim() || 'jugador@demo';
      Storage.user = email; Sound.ensure();
      refreshStart(); Screens.show('start');
    });

    // Inicio
    $('#btn-play').addEventListener('click', () => { Sound.ensure(); Screens.show('modes'); });
    $('#btn-how').addEventListener('click', () => Modal.open('modal-how'));
    $('#btn-sound').addEventListener('click', () => {
      Sound.enabled = !Sound.enabled; Storage.sound = Sound.enabled;
      $('#btn-sound').setAttribute('aria-checked', String(Sound.enabled));
      if (Sound.enabled) { Sound.ensure(); Sound.tap(); }
    });

    // Modos
    $('#modes-back').addEventListener('click', () => Screens.show('start'));
    $('#btn-start-game').addEventListener('click', () => Game.start(selMode, selDiff));

    // Juego
    $('#btn-pause').addEventListener('click', () => Game.pause());
    $('#btn-restart').addEventListener('click', () => Game.restart());
    $('#btn-quit').addEventListener('click', () => Game.quit());

    // Modales
    $('#btn-resume').addEventListener('click', () => Game.resume());
    $('#btn-pause-restart').addEventListener('click', () => Game.restart());
    $('#btn-pause-quit').addEventListener('click', () => Game.quit());
    $('#btn-next-level').addEventListener('click', () => Game.nextLevel());
    $('#btn-retry').addEventListener('click', () => Game.restart());
    $('#btn-over-quit').addEventListener('click', () => Game.quit());
    document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => Modal.close()));

    // Teclas globales
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (State.status === 'playing') Game.pause();
        else if (State.status === 'paused') Game.resume();
      } else if (e.key.toLowerCase() === 'p' && (State.status === 'playing' || State.status === 'paused')) {
        State.status === 'playing' ? Game.pause() : Game.resume();
      }
    });

    // Pausar al ocultar la pestaña
    document.addEventListener('visibilitychange', () => { if (document.hidden && State.status === 'playing') Game.pause(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
