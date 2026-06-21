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
    // Los iconos ya no son emojis: se generan por SVG (ver el módulo Icons).
    COMBO_MULTIPLIERS: [[30,10],[20,8],[15,5],[10,3],[6,2],[3,1.5]], // [umbral, multiplicador], desc
    MILESTONES: { 10: 500, 20: 1000, 30: 2000 },
    EMPTY_BOARD_BONUS: 500,   // bonus por dejar el tablero vacío
    FEVER_COMBO: 10,          // combo para entrar en modo Fever
    FEVER_BOOST: 1.25,        // multiplicador extra de puntos en Fever
    WIN_OCCUPATION: 30,       // % de ocupación: sin movimientos y por debajo => nivel superado
    TIMED_DURATION: 120,      // s (contrarreloj)
    TIMED_MIN: 30,            // s mínimo de límite por nivel
    TIMED_DECREASE: 10,       // s menos por nivel
    HINTS_PER_LEVEL: 3,
    HINT_COOLDOWN: 10000,     // ms
    HINT_DURATION: 2000,      // ms
    DIFFICULTY: {
      facil:   { label: 'Fácil',   initialIcons: 16, comboWindow: 5000, spawnStart: 3200, spawnMin: 1000, scoreMult: 0.8, penaltyBase: 1 },
      normal:  { label: 'Normal',  initialIcons: 26, comboWindow: 3500, spawnStart: 2600, spawnMin: 700,  scoreMult: 1.0, penaltyBase: 2 },
      dificil: { label: 'Difícil', initialIcons: 34, comboWindow: 2500, spawnStart: 2100, spawnMin: 500,  scoreMult: 1.3, penaltyBase: 3 },
    },
    MODES: {
      tutorial:      { name: 'Tutorial',     emoji: '🎓', timed: false, penalties: false, mult: 0.5, single: true, fixedDiff: 'facil', desc: 'Aprende la mecánica sin prisa ni penalizaciones.' },
      clasico:       { name: 'Clásico',      emoji: '♟️', timed: false, penalties: true,  mult: 1.0, desc: 'Vacía el tablero para superar el nivel. Cuidado: errar añade iconos.' },
      contrarreloj:  { name: 'Contrarreloj', emoji: '⏱️', timed: true,  penalties: true,  mult: 1.2, desc: 'Cada convergencia suma tiempo. ¡No dejes que el reloj llegue a cero!' },
      supervivencia: { name: 'Supervivencia',emoji: '❤️', timed: false, penalties: true,  mult: 1.5, fast: true, desc: 'Los iconos llegan más rápido y los errores penalizan más. Aguanta.' },
      zen:           { name: 'Zen',          emoji: '☯️', timed: false, penalties: false, mult: 0.8, relaxed: true, desc: 'Ritmo relajado, sin penalizaciones. Juega y respira.' },
    },
    MODE_ORDER: ['tutorial', 'clasico', 'contrarreloj', 'supervivencia', 'zen'],
    DIFF_ORDER: ['facil', 'normal', 'dificil'],
  };

  /* ===================== Icons (SVG propios, sin emojis) =====================
   * Catálogo ordenado por DIFICULTAD DE DISTINCIÓN (forma+color muy distintos →
   * formas repetidas con colores parecidos). Cada nivel toma una "ventana" del
   * catálogo (ver Engine.poolForLevel) que nunca repite el nivel anterior.
   */
  const Icons = (() => {
    const COLORS = {
      red:'#ff5b6e', blue:'#4b8bff', green:'#3ad07f', yellow:'#ffd23f', purple:'#a06bff',
      cyan:'#2bd4e6', orange:'#ff9838', pink:'#ff79c6', lime:'#b6e64a', white:'#e8eefc',
      teal:'#27b6a0', indigo:'#6c7bff',
    };
    const CNAME = { red:'rojo', blue:'azul', green:'verde', yellow:'amarillo', purple:'morado',
      cyan:'cian', orange:'naranja', pink:'rosa', lime:'lima', white:'blanco', teal:'turquesa', indigo:'índigo' };
    const ST = 'stroke="rgba(0,0,0,.30)" stroke-width="3" stroke-linejoin="round"';
    const SHAPES = {
      circle:   c => `<circle cx="50" cy="50" r="33" fill="${c}" ${ST}/>`,
      square:   c => `<rect x="18" y="18" width="64" height="64" rx="12" fill="${c}" ${ST}/>`,
      triangle: c => `<path d="M50 16 L85 80 L15 80 Z" fill="${c}" ${ST}/>`,
      diamond:  c => `<path d="M50 13 L87 50 L50 87 L13 50 Z" fill="${c}" ${ST}/>`,
      star:     c => `<path d="M50 13 L61 39 L88 41 L67 59 L74 86 L50 71 L26 86 L33 59 L12 41 L39 39 Z" fill="${c}" ${ST}/>`,
      heart:    c => `<path d="M50 84 C12 58 20 26 44 26 C50 26 50 33 50 36 C50 33 50 26 56 26 C80 26 88 58 50 84 Z" fill="${c}" ${ST}/>`,
      hexagon:  c => `<path d="M50 14 L84 32 L84 68 L50 86 L16 68 L16 32 Z" fill="${c}" ${ST}/>`,
      plus:     c => `<path d="M40 15 H60 V40 H85 V60 H60 V85 H40 V60 H15 V40 H40 Z" fill="${c}" ${ST}/>`,
      droplet:  c => `<path d="M50 13 C50 13 77 49 77 65 A27 27 0 1 1 23 65 C23 49 50 13 50 13 Z" fill="${c}" ${ST}/>`,
      ring:     c => `<circle cx="50" cy="50" r="30" fill="none" stroke="${c}" stroke-width="15"/>`,
    };
    const SNAME = { circle:'círculo', square:'cuadrado', triangle:'triángulo', diamond:'rombo',
      star:'estrella', heart:'corazón', hexagon:'hexágono', plus:'cruz', droplet:'gota', ring:'anillo' };

    // Pares [forma, color] ordenados de más fácil a más difícil de distinguir.
    const PAIRS = [
      // Fácil: forma y color únicos y muy contrastados
      ['circle','red'],['square','blue'],['triangle','green'],['star','yellow'],['heart','pink'],
      ['diamond','cyan'],['hexagon','orange'],['plus','purple'],['droplet','lime'],['ring','white'],
      // Medio: formas reutilizadas con colores distintos
      ['circle','orange'],['square','purple'],['triangle','cyan'],['star','red'],['heart','blue'],
      ['diamond','lime'],['hexagon','pink'],['plus','teal'],['droplet','yellow'],['ring','indigo'],
      // Difícil: misma forma con colores parecidos (hay que fijarse en el matiz)
      ['circle','blue'],['circle','indigo'],['circle','teal'],['square','red'],['square','orange'],
      ['triangle','lime'],['triangle','teal'],['diamond','purple'],['diamond','indigo'],['star','orange'],
      ['heart','purple'],['hexagon','teal'],
    ];
    const CATALOG = [], DEFS = {}, cache = {};
    for (const [shape, color] of PAIRS) { const id = `${shape}_${color}`; CATALOG.push(id); DEFS[id] = { shape, color }; }

    return {
      CATALOG,
      svg(id) {
        if (cache[id]) return cache[id];
        const d = DEFS[id];
        return cache[id] = `<svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true" focusable="false">${SHAPES[d.shape](COLORS[d.color])}</svg>`;
      },
      name(id) { const d = DEFS[id]; return `${SNAME[d.shape]} ${CNAME[d.color]}`; },
      colorOf(id) { const d = DEFS[id]; return d ? COLORS[d.color] : '#fff'; },
    };
  })();

  /* ===================== Storage ===================== */
  const Storage = {
    get best() { return +(localStorage.getItem('cv_best') || 0); },
    set best(v) { localStorage.setItem('cv_best', String(v)); },
    get sound() { return localStorage.getItem('cv_sound') !== 'off'; },
    set sound(v) { localStorage.setItem('cv_sound', v ? 'on' : 'off'); },
    get user() { return localStorage.getItem('cv_user'); },
    set user(v) { v ? localStorage.setItem('cv_user', v) : localStorage.removeItem('cv_user'); },
  };

  /* ===================== Settings (persistentes) ===================== */
  const Settings = (() => {
    const reduced = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
    const def = { sfx: true, music: false, haptics: true, reducedFx: reduced };
    let s; try { s = Object.assign({}, def, JSON.parse(localStorage.getItem('cv_settings') || '{}')); } catch (_) { s = { ...def }; }
    const save = () => { try { localStorage.setItem('cv_settings', JSON.stringify(s)); } catch (_) {} };
    return {
      get sfx() { return s.sfx; }, set sfx(v) { s.sfx = v; save(); },
      get music() { return s.music; }, set music(v) { s.music = v; save(); },
      get haptics() { return s.haptics; }, set haptics(v) { s.haptics = v; save(); },
      get reducedFx() { return s.reducedFx; }, set reducedFx(v) { s.reducedFx = v; save(); },
    };
  })();

  /* ===================== Haptics (vibración móvil) ===================== */
  const Haptics = {
    ok: typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function',
    fire(p) { if (this.ok && Settings.haptics) { try { navigator.vibrate(p); } catch (_) {} } },
    tap() { this.fire(8); },
    combo() { this.fire(14); },
    milestone() { this.fire([12, 30, 14]); },
    error() { this.fire(40); },
    level() { this.fire([18, 40, 18, 40]); },
    record() { this.fire([12, 28, 12, 28, 36]); },
    fever() { this.fire([20, 30, 20]); },
  };

  /* ===================== Sound (WebAudio, sin archivos) ===================== */
  const Sound = {
    ctx: null, sfxGain: null, musicGain: null,
    get enabled() { return Settings.sfx; },
    ensure() {
      if (!this.ctx) {
        try {
          this.ctx = new (window.AudioContext || window.webkitAudioContext)();
          this.sfxGain = this.ctx.createGain(); this.sfxGain.gain.value = 0.9; this.sfxGain.connect(this.ctx.destination);
          this.musicGain = this.ctx.createGain(); this.musicGain.gain.value = 0.0; this.musicGain.connect(this.ctx.destination);
        } catch (_) {}
      }
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    },
    tone(freq, dur, type = 'sine', vol = 0.2, when = 0) {
      if (!Settings.sfx || !this.ctx) return;
      const t = this.ctx.currentTime + when;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = type; osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g).connect(this.sfxGain || this.ctx.destination);
      osc.start(t); osc.stop(t + dur + 0.02);
    },
    chord(freqs, dur, type = 'sine', vol = 0.12, stagger = 0) { freqs.forEach((f, i) => this.tone(f, dur, type, vol, i * stagger)); },
    tap() { this.tone(420, 0.05, 'triangle', 0.10); },
    ui() { this.tone(380, 0.05, 'sine', 0.08); },
    success() { this.tone(660, 0.09, 'sine', 0.15); this.tone(990, 0.09, 'sine', 0.09, 0.03); },
    // Pitch sube con el combo (eliminaciones encadenadas). Throttle anti-acumulación.
    eliminate(n) { const t = performance.now(); if (t - (this._lastElim || 0) < 30) return; this._lastElim = t; const base = 520 + Math.min(n, 24) * 16; this.tone(base, 0.07, 'triangle', 0.12); this.tone(base * 1.5, 0.08, 'sine', 0.07, 0.03); },
    combo(l) { const roots = [523, 587, 659, 784, 988]; const r = roots[clamp(l, 0, 4)]; this.chord([r, r * 1.26, r * 1.5], 0.14, 'sine', 0.10, 0.02); },
    rank() { this.chord([784, 1047, 1319], 0.2, 'sine', 0.12, 0.05); },
    fever() { this.chord([330, 415, 554, 659], 0.3, 'sawtooth', 0.06, 0.04); },
    milestone() { this.chord([659, 988, 1319], 0.25, 'square', 0.07, 0.06); },
    record() { this.chord([784, 988, 1175, 1568], 0.3, 'sine', 0.12, 0.07); },
    miss() { this.tone(160, 0.12, 'sawtooth', 0.09); },
    danger() { this.tone(120, 0.09, 'sine', 0.08); },
    level() { [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.16, 'sine', 0.13, i * 0.08)); },
    over() { [392, 311, 247, 196].forEach((f, i) => this.tone(f, 0.22, 'sine', 0.15, i * 0.12)); },
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
    hintsLeft: 3, hintReadyAt: 0,
    maxCombo: 0, removedTotal: 0, mistakes: 0, // estadísticas de la partida
    displayScore: 0,        // marcador animado (count-up)
    fever: false, feverEver: false, perfectEver: false,
    recordHit: false,       // récord superado en vivo (una vez por partida)
    lastDangerAt: 0,        // throttle del aviso de peligro
    pool: [], // iconos disponibles este nivel
  };

  /* ===================== Engine (lógica pura del tablero) ===================== */
  const Engine = {
    idx: (r, c) => r * State.size + c,
    inside: (r, c) => r >= 0 && c >= 0 && r < State.size && c < State.size,

    // Nº de iconos distintos del nivel (variedad creciente => más difícil)
    varietyFor(level) {
      return clamp(4 + Math.floor((level - 1) / 2), 4, Math.min(8, Icons.CATALOG.length));
    },
    // Desplazamiento acumulado en el catálogo (ventanas contiguas por nivel)
    _offset(level) {
      let o = 0; for (let lv = 1; lv < level; lv++) o += this.varietyFor(lv);
      return o % Icons.CATALOG.length;
    },
    _window(off, n) {
      const L = Icons.CATALOG.length, a = [];
      for (let i = 0; i < n; i++) a.push(Icons.CATALOG[(off + i) % L]);
      return a;
    },
    // Conjunto de iconos del nivel: ventana del catálogo (dificultad creciente)
    // garantizando que NO comparte ningún icono con el nivel anterior.
    poolForLevel(level) {
      const L = Icons.CATALOG.length, n = this.varietyFor(level);
      const prev = level > 1 ? new Set(this._window(this._offset(level - 1), this.varietyFor(level - 1))) : new Set();
      let off = this._offset(level);
      for (let t = 0; t < L; t++) {
        const w = this._window(off, n);
        if (!w.some(id => prev.has(id))) return w;
        off = (off + 1) % L;
      }
      return this._window(off, n);
    },

    occupation() {
      let n = 0;
      for (let i = 0; i < State.board.length; i++) if (State.board[i] !== null) n++;
      return n / State.board.length * 100;
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

    // Coloca n iconos de penalización en celdas vacías; devuelve sus índices.
    addPenalty(n) {
      const empties = this.emptyCells();
      const placed = [];
      const k = Math.min(n, empties.length);
      for (let x = 0; x < k; x++) {
        const j = rand(empties.length);
        const idx = empties.splice(j, 1)[0];
        State.board[idx] = State.pool[rand(State.pool.length)];
        State.iconCount++;
        placed.push(idx);
      }
      return placed;
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
      this.cells = []; this.glyphs = []; this._cellId = [];
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
      return `Fila ${r}, columna ${c}: ${v ? Icons.name(v) : 'vacía'}`;
    },

    // Pinta el SVG del icono solo cuando cambia (cache por celda para rendimiento)
    setGlyph(i, id) {
      if (this._cellId[i] === id) return;
      this._cellId[i] = id;
      this.glyphs[i].innerHTML = id ? Icons.svg(id) : '';
    },

    syncCell(i) {
      const el = this.cells[i], v = State.board[i];
      this.setGlyph(i, v);
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
        el.addEventListener('animationend', () => {
          el.classList.remove('clear');
          this.setGlyph(i, null);
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
      $('#hud-score').textContent = State.displayScore;
      $('#hud-level').textContent = State.level;
      $('#hud-best').textContent = Storage.best;
      $('#hud-speed').textContent = (State.spawnRate / 1000).toFixed(1) + 's';
      const timeEl = $('#hud-time');
      timeEl.textContent = Config.MODES[State.mode].timed ? fmtTime(State.timeLeft) : fmtTime(State.elapsed);
      // Barra de ocupación = medidor de peligro (cuanto más llena, peor)
      const occ = Engine.occupation();
      const fill = $('#hud-progress-fill');
      fill.style.width = occ.toFixed(1) + '%';
      const dl = occ >= 85 ? 2 : occ >= 65 ? 1 : 0;
      fill.classList.toggle('warn', dl === 1);
      fill.classList.toggle('danger', dl === 2);
      this.danger(dl);
      if (dl === 2 && State.status === 'playing') {
        const t = performance.now();
        if (t - State.lastDangerAt > 900) { State.lastDangerAt = t; Sound.danger(); Haptics.fire(10); }
      }
      // Pistas
      $('#hint-badge').textContent = State.hintsLeft;
      $('#btn-hint').disabled = State.hintsLeft <= 0 || performance.now() < State.hintReadyAt;
    },

    penalty(indices) {
      indices.forEach(i => {
        this.syncCell(i); this.spawnAnim(i);
        const el = this.cells[i];
        el.classList.add('penalty');
        setTimeout(() => el.classList.remove('penalty'), 1400);
      });
    },
    boardShake() {
      const w = document.querySelector('.board-wrap');
      w.classList.remove('shake'); void w.offsetWidth; w.classList.add('shake');
      setTimeout(() => w.classList.remove('shake'), 320);
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

    // Flash de rango central (¡BIEN!, ¡GENIAL!…)
    rankFlash(text, color) {
      if (Settings.reducedFx) return;
      const el = $('#rank'); if (!el) return;
      el.textContent = text; el.style.color = color || '#fff';
      el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    },
    // Activar/desactivar el aura de Fever
    fever(on) {
      const f = $('#fever'); if (f) f.classList.toggle('on', on);
      document.body.classList.toggle('fever', on);
    },
    // Destello breve de pantalla (récord / perfecto)
    flash() {
      if (Settings.reducedFx) return;
      const el = $('#flash'); if (!el) return;
      el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    },
    // Pulso de peligro del tablero según ocupación
    danger(level) { // 0 ninguno, 1 warn, 2 danger
      const w = document.querySelector('.board-wrap'); if (!w) return;
      w.classList.toggle('warn', level === 1);
      w.classList.toggle('danger', level === 2);
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

  // Construye una fila de estadísticas: items = [ [valor, etiqueta, color?], ... ]
  function statRow(items) {
    return items.map(([v, k, c]) =>
      `<div class="stat"><span class="v"${c ? ` style="color:${c}"` : ''}>${v}</span><span class="k">${k}</span></div>`
    ).join('');
  }

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

  /* ===================== FX (partículas DOM, animadas por el compositor) =======
   * Capa <div> a pantalla completa con un pool fijo de <span> reutilizables.
   * Cada partícula se anima con la Web Animations API (transform/opacity), que
   * corre en el hilo del compositor (off-main-thread) -> coste de CPU casi nulo
   * por frame y SIN canvas (evita el fallo de compositing de WebKit que dejaba
   * la pantalla en blanco con secuencias largas de combos). La trayectoria con
   * "gravedad" se precalcula como keyframes parabólicos.
   */
  const FX = {
    layer: null, pool: [], idx: 0, active: 0, cap: 90, w: 0, h: 0, boardRect: null, supported: true,
    init() {
      this.layer = $('#fx'); if (!this.layer) return;
      this.supported = typeof Element !== 'undefined' && !!Element.prototype.animate;
      const frag = document.createDocumentFragment();
      for (let i = 0; i < 110; i++) {
        const s = document.createElement('span');
        s.className = 'fxp';
        s.style.opacity = '0';
        this.pool.push({ el: s, anim: null, busy: false });
        frag.appendChild(s);
      }
      this.layer.appendChild(frag);
      this.resize();
      window.addEventListener('resize', () => this.resize(), { passive: true });
      window.addEventListener('scroll', () => this.syncBoardRect(), { passive: true });
    },
    resize() { this.w = window.innerWidth; this.h = window.innerHeight; this.syncBoardRect(); },
    syncBoardRect() { const el = $('#board'); this.boardRect = el ? el.getBoundingClientRect() : null; },
    // Coordenadas (viewport) del centro de la celda i
    cellXY(i) {
      const s = State.size, r = this.boardRect;
      if (!r || !r.width) return { x: this.w / 2, y: this.h / 2 };
      return { x: r.left + ((i % s) + 0.5) / s * r.width, y: r.top + ((i / s | 0) + 0.5) / s * r.height };
    },
    _slot() {
      // Coge la siguiente del pool (round-robin); recicla la más antigua si está ocupada.
      const p = this.pool[this.idx]; this.idx = (this.idx + 1) % this.pool.length;
      if (p.busy) {
        p.busy = false; this.active = Math.max(0, this.active - 1);
        if (p.anim) { p.anim.onfinish = null; p.anim.oncancel = null; try { p.anim.cancel(); } catch (_) {} }
      }
      return p;
    },
    // Lanza una partícula con velocidad (vx,vy) px/s y gravedad g px/s^2 durante life s.
    _emit(x, y, vx, vy, g, life, size, color, shape, spin) {
      if (!this.supported) return;
      const p = this._slot(), el = p.el;
      el.style.width = size + 'px';
      el.style.height = (shape === 1 ? size * 0.6 : size) + 'px';
      el.style.background = color;
      el.style.borderRadius = shape === 1 ? '1px' : '50%';
      // Muestreo parabólico de la trayectoria -> keyframes (el compositor interpola).
      const N = 5, frames = [];
      for (let k = 0; k <= N; k++) {
        const t = life * k / N;
        const px = x + vx * t, py = y + vy * t + 0.5 * g * t * t;
        const rot = spin ? ' rotate(' + (spin * t) + 'deg)' : '';
        frames.push({ transform: 'translate3d(' + px.toFixed(1) + 'px,' + py.toFixed(1) + 'px,0)' + rot, opacity: k >= N - 1 ? 0 : 1, offset: k / N });
      }
      p.busy = true;
      const anim = el.animate(frames, { duration: life * 1000, easing: 'linear', fill: 'forwards' });
      p.anim = anim;
      this.active++;
      const done = () => { if (p.busy) { p.busy = false; this.active = Math.max(0, this.active - 1); } el.style.opacity = '0'; };
      anim.onfinish = done; anim.oncancel = done;
    },
    // Estallido en la celda eliminada (sale del centro hacia fuera)
    burst(i, color, n) {
      if (Settings.reducedFx || !this.supported) return;
      this.syncBoardRect();
      const { x, y } = this.cellXY(i); n = Math.min(n, 10);
      for (let k = 0; k < n; k++) { const a = Math.random() * 6.283, sp = 70 + Math.random() * 180; this._emit(x, y, Math.cos(a) * sp, Math.sin(a) * sp - 70, 760, 0.5 + Math.random() * 0.35, 5 + Math.random() * 5, color, 0, 0); }
    },
    // Celebración de récord: brota de la última eliminación, sube/se abre y cae al fondo
    celebrate(i) {
      if (Settings.reducedFx || !this.supported) return;
      this.syncBoardRect();
      const { x, y } = this.cellXY(i), C = ['#ffd23f', '#ff5b6e', '#4b8bff', '#3ad07f', '#a06bff', '#2bd4e6', '#ff9838'];
      const n = Math.min(70, this.cap);
      for (let k = 0; k < n; k++) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2, sp = 260 + Math.random() * 320;
        // vida suficiente para que la parábola alcance el fondo de la pantalla
        this._emit(x, y, Math.cos(a) * sp, Math.sin(a) * sp, 900, 1.7 + Math.random() * 1.1, 6 + Math.random() * 5, C[k % C.length], 1, (Math.random() - 0.5) * 720);
      }
    },
    // Confeti que cae desde arriba (nivel/victoria)
    confetti(n) {
      if (Settings.reducedFx || !this.supported) return;
      n = Math.min(n, this.cap);
      const C = ['#ff5b6e', '#4b8bff', '#3ad07f', '#ffd23f', '#a06bff', '#2bd4e6', '#ff9838'];
      for (let k = 0; k < n; k++) this._emit(Math.random() * this.w, -14, (Math.random() - 0.5) * 110, 150 + Math.random() * 170, 360, 1.8 + Math.random() * 1.1, 6 + Math.random() * 5, C[k % C.length], 1, (Math.random() - 0.5) * 540);
    },
    // Conservado por compatibilidad con el bucle; las partículas son autónomas (WAAPI).
    step() { return false; },
  };

  /* ===================== Music (procedural, sin archivos; off por defecto) ===================== */
  const Music = {
    timer: 0, next: 0, step: 0, intensity: 0,
    scale: [220, 247, 294, 330, 392, 440, 494, 587],
    start() {
      if (!Settings.music) return;
      Sound.ensure(); if (!Sound.ctx) return;
      const t = Sound.ctx.currentTime;
      Sound.musicGain.gain.cancelScheduledValues(t);
      Sound.musicGain.gain.setValueAtTime(0.0001, t);
      Sound.musicGain.gain.linearRampToValueAtTime(0.14, t + 0.8);
      this.next = t + 0.1; this.step = 0;
      if (!this.timer) this.timer = setInterval(() => this._sched(), 60);
    },
    stop(fast) {
      if (Sound.ctx && Sound.musicGain) { const t = Sound.ctx.currentTime; Sound.musicGain.gain.cancelScheduledValues(t); Sound.musicGain.gain.linearRampToValueAtTime(0.0001, t + (fast ? 0.05 : 0.4)); }
      if (this.timer) { clearInterval(this.timer); this.timer = 0; }
    },
    setIntensity(v) { this.intensity = clamp(v, 0, 1); if (this.timer && Sound.ctx) Sound.musicGain.gain.linearRampToValueAtTime(0.12 + 0.14 * this.intensity, Sound.ctx.currentTime + 0.3); },
    _note(f, dur, t, vol, type) { const o = Sound.ctx.createOscillator(), g = Sound.ctx.createGain(); o.type = type || 'triangle'; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g).connect(Sound.musicGain); o.start(t); o.stop(t + dur + 0.02); },
    _sched() {
      if (!Sound.ctx) return;
      const tempo = 0.30 - 0.12 * this.intensity, ahead = Sound.ctx.currentTime + 0.2;
      while (this.next < ahead) {
        const s = this.step;
        if (s % 4 === 0) this._note(this.scale[0] / 2, tempo * 3.6, this.next, 0.5, 'sine');
        const idx = (s * 3) % this.scale.length;
        this._note(this.scale[idx], tempo * 0.9, this.next, 0.32 + 0.3 * this.intensity, 'triangle');
        if (this.intensity > 0.5 && s % 2 === 0) this._note(this.scale[(idx + 4) % this.scale.length] * 2, tempo * 0.5, this.next, 0.16, 'sine');
        this.next += tempo; this.step++;
      }
    },
  };

  /* ===================== Meta (progresión persistente) ===================== */
  const Meta = (() => {
    const KEY = 'cv_meta';
    const def = { xp: 0, level: 1, games: 0, totalRemoved: 0, achievements: {}, daily: { date: '' }, streak: { count: 0, date: '' } };
    let m; try { m = Object.assign({}, def, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (_) { m = JSON.parse(JSON.stringify(def)); }
    const save = () => { try { localStorage.setItem(KEY, JSON.stringify(m)); } catch (_) {} };
    const today = () => new Date().toISOString().slice(0, 10);
    const hashStr = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; };
    const xpForLevel = (lvl) => 300 + (lvl - 1) * 250;
    const RANKS = ['Novato', 'Aprendiz', 'Hábil', 'Experto', 'Maestro', 'Leyenda', 'Mítico'];
    const ACH = [
      { id: 'first', name: 'Primer paso', desc: 'Completa tu primera partida', t: c => c.games >= 1 },
      { id: 'combo10', name: 'En racha', desc: 'Consigue un combo ×10', t: c => c.maxCombo >= 10 },
      { id: 'combo20', name: 'Imparable', desc: 'Consigue un combo ×20', t: c => c.maxCombo >= 20 },
      { id: 'perfect', name: 'Impecable', desc: 'Deja el tablero vacío', t: c => c.perfect },
      { id: 'score3k', name: 'Triple millar', desc: 'Supera 3000 puntos', t: c => c.score >= 3000 },
      { id: 'score8k', name: 'Leyenda viva', desc: 'Supera 8000 puntos', t: c => c.score >= 8000 },
      { id: 'level5', name: 'Escalador', desc: 'Alcanza el nivel 5', t: c => c.level >= 5 },
      { id: 'remove200', name: 'Demoledor', desc: 'Elimina 200 iconos (total)', t: c => m.totalRemoved >= 200 },
      { id: 'fever', name: '¡Fiebre!', desc: 'Entra en modo Fever', t: c => c.fever },
      { id: 'streak3', name: 'Constante', desc: 'Juega 3 días seguidos', t: c => m.streak.count >= 3 },
    ];
    const MISSIONS = [
      { id: 'm_combo', text: 'Consigue un combo ×8', target: 8, kind: 'combo' },
      { id: 'm_remove', text: 'Elimina 80 iconos en una partida', target: 80, kind: 'remove' },
      { id: 'm_score', text: 'Haz 2500 puntos en una partida', target: 2500, kind: 'score' },
      { id: 'm_perfect', text: 'Deja el tablero vacío una vez', target: 1, kind: 'perfect' },
    ];
    function dailyMission() {
      const d = today();
      if (m.daily.date !== d) { const idx = Math.abs(hashStr(d)) % MISSIONS.length; m.daily = { date: d, id: MISSIONS[idx].id, progress: 0, done: false }; save(); }
      return Object.assign({}, MISSIONS.find(x => x.id === m.daily.id), m.daily);
    }
    return {
      get state() { return m; },
      level: () => m.level, xp: () => m.xp, xpForLevel, streak: () => m.streak.count,
      rank: () => RANKS[Math.min(RANKS.length - 1, Math.floor((m.level - 1) / 3))],
      dailyMission,
      achievements: () => ACH.map(a => ({ id: a.id, name: a.name, desc: a.desc, unlocked: !!m.achievements[a.id] })),
      addXp(n) { m.xp += n; let up = 0; while (m.xp >= xpForLevel(m.level)) { m.xp -= xpForLevel(m.level); m.level++; up++; } save(); return up; },
      recordGame(ctx) {
        m.games = (m.games || 0) + 1;
        m.totalRemoved = (m.totalRemoved || 0) + ctx.removed;
        const d = today(), y = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
        if (m.streak.date !== d) { m.streak.count = (m.streak.date === y) ? (m.streak.count + 1) : 1; m.streak.date = d; }
        const dm = dailyMission(); let missionDone = false;
        if (!m.daily.done) {
          const val = dm.kind === 'combo' ? ctx.maxCombo : dm.kind === 'remove' ? ctx.removed : dm.kind === 'score' ? ctx.score : (ctx.perfect ? 1 : 0);
          m.daily.progress = Math.max(m.daily.progress || 0, val);
          if (m.daily.progress >= dm.target) { m.daily.done = true; missionDone = true; }
        }
        let xpGained = Math.round(ctx.score / 10 + ctx.maxCombo * 5 + ctx.level * 20 + (ctx.perfect ? 100 : 0));
        if (missionDone) xpGained += 150;
        const leveledUp = this.addXp(xpGained);
        const cctx = Object.assign({ games: m.games }, ctx);
        const newAch = [];
        ACH.forEach(a => { if (!m.achievements[a.id] && a.t(cctx)) { m.achievements[a.id] = d; newAch.push(a); } });
        save();
        return { xpGained, leveledUp, newAch, missionDone };
      },
    };
  })();

  /* ===================== Loop (un único requestAnimationFrame) ===================== */
  const Loop = {
    raf: 0, last: 0, spawnAcc: 0, clockAcc: 0, ema: 16,
    start() { this.last = performance.now(); this.spawnAcc = 0; this.clockAcc = 0; cancelAnimationFrame(this.raf); this.raf = requestAnimationFrame(this.tick); },
    stop() { cancelAnimationFrame(this.raf); this.raf = 0; },
    // Reinicia el rAF si está parado (para animar celebraciones aunque el juego no corra)
    kick() { if (!this.raf) { this.last = performance.now(); this.raf = requestAnimationFrame(this.tick); } },
    tick: (now) => {
      const L = Loop;
      const dt = Math.min(100, now - L.last); L.last = now;

      // Gobernador de rendimiento: EMA del tiempo de frame -> ajusta el tope de partículas
      L.ema += (dt - L.ema) * 0.1;
      if (L.ema > 22 && FX.cap > 30) FX.cap -= 6;
      else if (L.ema < 17 && FX.cap < 90) FX.cap += 3;

      if (State.status === 'playing') {
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
        L.spawnAcc += dt;
        if (L.spawnAcc >= State.spawnRate) { L.spawnAcc -= State.spawnRate; Game.doSpawn(); }
        if (State.combo > 0) {
          const left = State.comboWindow - (now - State.comboAt);
          if (left <= 0) Game.resetCombo();
          else Render.comboRing(left / State.comboWindow);
        }
      }

      // Count-up del marcador (sensación de recompensa creciente)
      if (State.displayScore !== State.score) {
        const diff = State.score - State.displayScore;
        const stepv = Math.max(1, Math.ceil(Math.abs(diff) * 0.18));
        State.displayScore += diff > 0 ? Math.min(stepv, diff) : Math.max(-stepv, diff);
        $('#hud-score').textContent = State.displayScore;
      }

      // Las partículas se animan solas en el compositor (WAAPI); el bucle solo
      // necesita seguir vivo mientras hay juego activo o en pausa.
      const alive = State.status === 'playing' || State.status === 'paused';
      L.raf = alive ? requestAnimationFrame(L.tick) : 0;
    },
  };

  /* ===================== Game (orquestador) ===================== */
  const Game = {
    hintCells: [], hintHideTimer: 0, ended: false,

    setupLevel() {
      const m = Config.MODES[State.mode];
      State.pool = Engine.poolForLevel(State.level);
      State.spawnRate = Engine.spawnRateForLevel(State.level);
      State.comboWindow = Config.DIFFICULTY[State.diff].comboWindow;
      State.hintsLeft = Config.HINTS_PER_LEVEL;
      State.hintReadyAt = 0;
      // Contrarreloj: límite de tiempo por nivel (decrece con el nivel)
      if (m.timed) State.timeLeft = Math.max(Config.TIMED_MIN, Config.TIMED_DURATION - (State.level - 1) * Config.TIMED_DECREASE);
      // Tablero fresco con la variedad de iconos del nivel actual
      State.board = new Array(State.size * State.size).fill(null);
      State.iconCount = 0;
      State.combo = 0; State.comboMult = 1;
      Engine.placeInitial(Config.DIFFICULTY[State.diff].initialIcons);
      Render.syncAll();
      Render.combo();
      Render.hud();
    },

    start(mode, diff) {
      State.mode = mode;
      State.diff = Config.MODES[mode].fixedDiff || diff;
      State.score = 0; State.displayScore = 0; State.level = 1; State.elapsed = 0; State.timeLeft = 0;
      State.combo = 0; State.comboMult = 1; State.comboAt = 0;
      State.maxCombo = 0; State.removedTotal = 0; State.mistakes = 0;
      State.fever = false; State.feverEver = false; State.perfectEver = false; State.recordHit = false;
      State.status = 'playing'; this.ended = false;
      Render.fever(false); Render.danger(0);
      this.clearHintHighlight();
      this.setupLevel();
      Render.combo();
      Screens.show('game');
      FX.resize();
      Loop.start();
      if (Settings.music) Music.start();
      announce(`Partida iniciada. Modo ${Config.MODES[mode].name}.`);
      Toasts.show('¡A jugar!', 'good', 1400);
    },

    restart() { Modal.close(); this.start(State.mode, State.diff); },
    quit() { Loop.stop(); Music.stop(); State.status = 'idle'; Modal.close(); this.clearHintHighlight(); refreshStart(); Screens.show('start'); },

    pause() {
      if (State.status !== 'playing') return;
      State.status = 'paused'; Music.stop(true); Modal.open('modal-pause'); announce('Juego en pausa.');
    },
    resume() {
      if (State.status !== 'paused') return;
      State.status = 'playing'; Modal.close(); Loop.last = performance.now(); Loop.kick();
      if (Settings.music) Music.start();
    },

    /* Activación de una casilla (clic/tecla) */
    activate(i) {
      if (State.status !== 'playing') return;
      this.clearHintHighlight();
      if (State.board[i] !== null) { Sound.tap(); return; }     // ocupada: nada
      const conv = Engine.converging(i);
      if (conv.length < 2) { this.mistake(i); return; }          // error → penalización

      // Combo (registrar tier anterior para detectar subidas de rango)
      const prevMult = State.comboMult;
      const now = performance.now();
      if (State.combo > 0 && now - State.comboAt <= State.comboWindow) State.combo++;
      else State.combo = 1;
      State.comboAt = now;
      State.comboMult = 1;
      for (const [thr, mult] of Config.COMBO_MULTIPLIERS) { if (State.combo >= thr) { State.comboMult = mult; break; } }
      if (State.combo > State.maxCombo) State.maxCombo = State.combo;

      // FEVER: entrar al encadenar combo alto
      if (!State.fever && State.combo >= Config.FEVER_COMBO) {
        State.fever = true; State.feverEver = true; Render.fever(true); Sound.fever(); Haptics.fever();
        if (Settings.music) Music.setIntensity(1);
        Toasts.show('🔥 ¡FEVER!', 'warn', 1400);
      }

      // Puntos (icono×10×nivel × combo × dificultad × modo × fever)
      const removed = conv.length;
      State.removedTotal += removed;
      const d = Config.DIFFICULTY[State.diff], m = Config.MODES[State.mode];
      const base = removed * 10 * State.level;
      const points = Math.floor(base * State.comboMult * d.scoreMult * m.mult * (State.fever ? Config.FEVER_BOOST : 1));
      State.score += points;
      if (Config.MILESTONES[State.combo]) { State.score += Config.MILESTONES[State.combo]; Toasts.show(`¡Combo ×${State.combo}! +${Config.MILESTONES[State.combo]}`, 'good'); Sound.milestone(); Haptics.milestone(); }

      // Contrarreloj: bonus de tiempo por convergencia
      if (m.timed) { const bonus = Math.max(5, removed * 3); State.timeLeft += bonus; Toasts.show(`+${bonus}s`, 'info', 1100); }

      // Partículas con el color real de cada icono (antes de borrarlos)
      const burstN = 6 + Math.min(State.combo, 14);
      for (const idx of conv) FX.burst(idx, Icons.colorOf(State.board[idx]), burstN);

      // Aplicar al tablero
      conv.forEach(idx => { State.board[idx] = null; State.iconCount--; });
      Render.clearAnim(conv);
      conv.forEach(idx => Render.cells[idx].setAttribute('aria-label', Render.cellLabel(idx)));

      // Color por tier de combo
      const color = State.comboMult >= 8 ? '#ffd84d' : State.comboMult >= 5 ? '#ff5cf0' : State.comboMult >= 3 ? '#b46cff' : State.comboMult >= 2 ? '#00d0ff' : State.comboMult >= 1.5 ? '#34e29b' : '#fff';
      Render.popup(i, State.comboMult > 1 ? `+${points} ×${State.comboMult}` : `+${points}`, color);
      Render.bump($('#hud-score'));
      Render.combo();

      // Subida de rango → flash + sonido
      if (State.comboMult > prevMult && State.combo >= 3) {
        const labels = { 1.5: '¡BIEN!', 2: '¡GENIAL!', 3: '¡INCREÍBLE!', 5: '¡ÉPICO!', 8: '¡LEGENDARIO!', 10: '¡MÍTICO!' };
        Render.rankFlash(labels[State.comboMult] || '¡COMBO!', color); Sound.rank();
      }

      // Sonido + háptica de eliminación
      Sound.eliminate(State.combo);
      if (State.combo >= 3) Haptics.combo(); else Haptics.tap();
      if (Settings.music) Music.setIntensity(clamp(State.combo / 18, 0, 1));

      // Récord en vivo (una sola vez por partida): confeti desde la última
      // eliminación, saliendo hacia fuera y cayendo al fondo de la pantalla.
      if (!State.recordHit && Storage.best > 0 && State.score > Storage.best) {
        State.recordHit = true; Render.flash(); Sound.record(); Haptics.record(); FX.celebrate(i);
        Toasts.show('🏆 ¡Nuevo récord!', 'good', 1600);
      }

      Render.hud();
      announce(`+${points} puntos.${State.combo >= 3 ? ' Combo ' + State.combo + '.' : ''}`);
      this.evaluate();
    },

    /* Error del jugador: penalización (salvo modos sin penalización) */
    mistake(i) {
      Render.miss(i); Sound.miss(); Haptics.error(); State.mistakes++;
      const m = Config.MODES[State.mode];
      if (!m.penalties) return;
      Render.boardShake();
      // Añadir iconos de penalización (escala con dificultad y nivel)
      const d = Config.DIFFICULTY[State.diff];
      const n = clamp(d.penaltyBase + Math.floor((State.level - 1) / 3), 1, 5);
      const placed = Engine.addPenalty(n);
      if (placed.length) Render.penalty(placed);
      // Subir velocidad de aparición
      State.spawnRate = Math.max(d.spawnMin, Math.round(State.spawnRate * 0.9));
      Toasts.show(`Error · +${placed.length} iconos · más rápido`, 'bad', 1800);
      Render.hud();
      this.evaluate();
    },

    doSpawn() {
      const idx = Engine.spawnOne();
      if (idx < 0) { this.evaluate(); return; }
      Render.syncCell(idx); Render.spawnAnim(idx);
      // Aceleración progresiva suave dentro del nivel
      State.spawnRate = Math.max(Config.DIFFICULTY[State.diff].spawnMin, State.spawnRate - 6);
      Render.hud();
      this.evaluate();
    },

    /* Win/Lose: se evalúa tras cada cambio del tablero */
    evaluate() {
      if (State.status !== 'playing') return;
      if (State.iconCount === 0) { this.levelComplete(true); return; }
      if (!Engine.hasMoves()) {
        const occ = Engine.occupation();
        if (occ <= Config.WIN_OCCUPATION) this.levelComplete(false);
        else this.gameOver(`Sin movimientos posibles · ${Math.round(occ)}% del tablero ocupado.`);
      }
    },

    resetCombo() {
      State.combo = 0; State.comboMult = 1;
      if (State.fever) { State.fever = false; Render.fever(false); if (Settings.music) Music.setIntensity(0.15); }
      Render.combo();
    },

    levelComplete(perfect) {
      State.status = 'levelComplete'; this.clearHintHighlight();
      if (perfect) { State.perfectEver = true; State.score += Config.EMPTY_BOARD_BONUS; Toasts.show(`¡Tablero limpio! +${Config.EMPTY_BOARD_BONUS}`, 'good'); Render.flash(); }
      this.saveBest(); Render.hud(); Render.fever(false); State.fever = false;
      const m = Config.MODES[State.mode];
      if (m.single) { this.win(perfect ? '¡Tutorial completado con tablero perfecto!' : '¡Tutorial completado!'); return; }
      Sound.level(); Haptics.level(); FX.confetti(perfect ? 90 : 60);

      $('#level-title').textContent = perfect ? '✨ ¡Tablero perfecto!' : '⭐ ¡Nivel completado!';
      $('#level-sub').textContent = perfect
        ? `Has limpiado el tablero por completo. ¡Bonus +${Config.EMPTY_BOARD_BONUS}!`
        : `Nivel ${State.level} superado sin jugadas restantes.`;

      // Resumen de la partida hasta ahora
      $('#level-stats').innerHTML = statRow([
        [State.score, 'Puntos', 'var(--score)'],
        ['×' + State.maxCombo, 'Combo máx.', 'var(--gold)'],
        [State.removedTotal, 'Eliminados', 'var(--good)'],
      ]);

      // Preview del siguiente nivel
      const next = State.level + 1;
      const nextSpawn = (Engine.spawnRateForLevel(next) / 1000).toFixed(1);
      const nextVariety = Engine.poolForLevel(next).length;
      let preview = `<h3>Nivel ${next}</h3><ul>` +
        `<li>⚡ Aparición cada <strong>${nextSpawn}s</strong></li>` +
        `<li>🎲 <strong>${nextVariety}</strong> iconos distintos</li>`;
      if (m.timed) {
        const nextTime = Math.max(Config.TIMED_MIN, Config.TIMED_DURATION - (next - 1) * Config.TIMED_DECREASE);
        preview += `<li>⏱️ Tiempo del nivel: <strong>${fmtTime(nextTime)}</strong></li>`;
      }
      preview += '</ul>';
      $('#level-next').innerHTML = preview;
      $('#btn-next-level').textContent = `Ir al nivel ${next} →`;

      Modal.open('modal-level');
      announce(`Nivel ${State.level} completado. ${State.score} puntos. Siguiente: nivel ${next}.`);
    },

    nextLevel() {
      State.level++;
      State.status = 'playing';
      Modal.close();
      this.setupLevel(); // tablero fresco con la variedad/velocidad/tiempo del nuevo nivel
      // El bucle se detuvo al mostrarse el modal (status != playing); hay que reiniciarlo.
      Loop.start();
      Toasts.show(`Nivel ${State.level}`, 'info', 1400);
    },

    win(reason) {
      this.endGame();
      Sound.level(); Haptics.level(); FX.confetti(110);
      $('#over-title').textContent = '🏆 ¡Victoria!';
      $('#over-reason').textContent = reason;
      this.fillStats(); Modal.open('modal-over');
      announce(`¡Victoria! Puntuación ${State.score}.`);
    },

    gameOver(reason) {
      if (this.ended) return;
      this.endGame();
      Sound.over(); Haptics.error(); Render.boardShake();
      $('#over-title').textContent = '¡Misión fallida!';
      $('#over-reason').textContent = reason;
      this.fillStats(); Modal.open('modal-over');
      announce(`Fin de la partida. ${reason} Puntuación ${State.score}.`);
    },

    endGame() {
      Loop.stop(); Music.stop(); State.status = 'over'; this.ended = true; this.clearHintHighlight();
      Render.fever(false); State.fever = false; Render.danger(0);
      this.newRecord = State.score > Storage.best && State.score > 0;
      this.saveBest();
      // Progresión persistente (XP, logros, misión diaria, racha)
      this.metaResult = Meta.recordGame({
        score: State.score, level: State.level, maxCombo: State.maxCombo,
        removed: State.removedTotal, elapsed: State.elapsed, mode: State.mode,
        perfect: State.perfectEver, fever: State.feverEver,
      });
    },

    fillStats() {
      $('#over-record').hidden = !this.newRecord;
      const m = Config.MODES[State.mode], d = Config.DIFFICULTY[State.diff];
      $('#over-meta').textContent = `Modo ${m.name} · ${d.label}`;
      $('#over-stats').innerHTML = statRow([
        [State.score, 'Puntos', 'var(--score)'],
        [State.level, 'Nivel', 'var(--level)'],
        ['×' + State.maxCombo, 'Combo máx.', 'var(--gold)'],
        [State.removedTotal, 'Eliminados', 'var(--good)'],
        [fmtTime(State.elapsed), 'Tiempo', 'var(--time)'],
        [Storage.best, 'Récord', 'var(--gold)'],
      ]);
      // Progresión: XP ganada, barra de perfil, misión y logros nuevos
      const r = this.metaResult || { xpGained: 0, leveledUp: 0, newAch: [], missionDone: false };
      const lvl = Meta.level(), need = Meta.xpForLevel(lvl), have = Meta.xp();
      $('#over-xp').innerHTML =
        `<div class="xp-line"><span class="xp-gain">+${r.xpGained} XP</span><span class="xp-rank">${Meta.rank()} · Nivel ${lvl}</span></div>` +
        `<div class="xpbar"><div class="xpbar-fill" style="width:${Math.min(100, have / need * 100).toFixed(0)}%"></div></div>` +
        (r.leveledUp ? `<div class="xp-up">⬆️ ¡Subiste a nivel ${lvl}!</div>` : '') +
        (r.missionDone ? `<div class="mission-done">✅ Misión diaria completada · +150 XP</div>` : '');
      $('#over-ach').innerHTML = r.newAch.length
        ? '<div class="ach-new">🏅 Nuevos logros: ' + r.newAch.map(a => a.name).join(' · ') + '</div>' : '';
      if (r.leveledUp) { setTimeout(() => { Sound.record(); FX.confetti(60); }, 350); }
      if (r.newAch.length) { setTimeout(() => { Sound.milestone(); Toasts.show('🏅 Logro: ' + r.newAch[0].name, 'good', 2400); }, 600); }
    },

    saveBest() { if (State.score > Storage.best) Storage.best = State.score; },

    /* Pista manual: 3 por nivel, con enfriamiento */
    hint() {
      if (State.status !== 'playing') return;
      if (State.hintsLeft <= 0) { Toasts.show('Sin pistas en este nivel', 'warn', 1400); return; }
      if (performance.now() < State.hintReadyAt) { Toasts.show('Pista recargando…', 'warn', 1200); return; }
      for (let i = 0; i < State.board.length; i++) {
        if (State.board[i] === null) {
          const conv = Engine.converging(i);
          if (conv.length >= 2) {
            this.clearHintHighlight();
            this.hintCells = conv.concat(i);
            Render.hint(this.hintCells, true);
            State.hintsLeft--; State.hintReadyAt = performance.now() + Config.HINT_COOLDOWN;
            Render.hud();
            this.hintHideTimer = setTimeout(() => this.clearHintHighlight(), Config.HINT_DURATION);
            Sound.tap();
            return;
          }
        }
      }
      Toasts.show('No hay jugadas ahora mismo', 'warn', 1400);
    },
    clearHintHighlight() { clearTimeout(this.hintHideTimer); if (this.hintCells.length) { Render.hint(this.hintCells, false); this.hintCells = []; } },
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
    const sw = $('#btn-sound'); if (sw) sw.setAttribute('aria-checked', String(Settings.sfx));
    const el = $('#start-meta');
    if (el) {
      const lvl = Meta.level(), need = Meta.xpForLevel(lvl), have = Meta.xp(), dm = Meta.dailyMission();
      const prog = dm.done ? '✅' : `${Math.min(dm.progress || 0, dm.target)}/${dm.target}`;
      el.innerHTML =
        `<div class="profile">
          <div class="profile-top"><span class="rank">${Meta.rank()}</span><span class="plevel">Nivel ${lvl}</span><span class="streak" title="Racha diaria">🔥 ${Meta.streak()}</span></div>
          <div class="xpbar"><div class="xpbar-fill" style="width:${Math.min(100, have / need * 100).toFixed(0)}%"></div></div>
          <div class="xp-sub">${have} / ${need} XP</div>
        </div>
        <div class="daily ${dm.done ? 'done' : ''}"><span class="daily-icon">🎯</span><span class="daily-text">${dm.done ? '¡Misión diaria completada!' : dm.text}</span><span class="daily-prog">${prog}</span></div>`;
    }
  }

  function applyReducedFx() {
    document.body.classList.toggle('reduced-fx', Settings.reducedFx);
  }

  // Panel de ajustes (toggles persistentes)
  function buildSettings() {
    const rows = [
      { k: 'sfx', label: '🔊 Efectos de sonido' },
      { k: 'music', label: '🎵 Música' },
      { k: 'haptics', label: '📳 Vibración', show: Haptics.ok },
      { k: 'reducedFx', label: '✨ Reducir efectos' },
    ];
    const list = $('#settings-list'); if (!list) return;
    list.innerHTML = rows.filter(r => r.show !== false).map(r =>
      `<div class="set-row"><span>${r.label}</span><button class="switch" role="switch" data-set="${r.k}" aria-checked="${Settings[r.k]}" aria-label="${r.label}"><span class="switch-dot"></span></button></div>`
    ).join('');
    list.querySelectorAll('[data-set]').forEach(btn => btn.addEventListener('click', () => {
      const k = btn.dataset.set; Settings[k] = !Settings[k]; btn.setAttribute('aria-checked', String(Settings[k]));
      if (k === 'sfx' && Settings.sfx) { Sound.ensure(); Sound.ui(); }
      if (k === 'music') { Settings.music && State.status === 'playing' ? Music.start() : Music.stop(); }
      if (k === 'reducedFx') applyReducedFx();
      const sw = $('#btn-sound'); if (sw) sw.setAttribute('aria-checked', String(Settings.sfx));
    }));
  }
  function openSettings() { buildSettings(); Modal.open('modal-settings'); }

  function openMedals() {
    const list = $('#medals-list');
    if (list) list.innerHTML = Meta.achievements().map(a =>
      `<div class="medal ${a.unlocked ? 'on' : ''}"><span class="medal-ic">${a.unlocked ? '🏅' : '🔒'}</span><span class="medal-tx"><strong>${a.name}</strong><small>${a.desc}</small></span></div>`
    ).join('');
    Modal.open('modal-medals');
  }

  /* ===================== init / wiring ===================== */
  function init() {
    Render.buildBoard();
    FX.init();
    applyReducedFx();
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
      Settings.sfx = !Settings.sfx;
      $('#btn-sound').setAttribute('aria-checked', String(Settings.sfx));
      if (Settings.sfx) { Sound.ensure(); Sound.ui(); }
    });
    const bs = $('#btn-settings'); if (bs) bs.addEventListener('click', () => { Sound.ensure(); openSettings(); });
    const bm = $('#btn-medals'); if (bm) bm.addEventListener('click', openMedals);

    // Modos
    $('#modes-back').addEventListener('click', () => Screens.show('start'));
    $('#btn-start-game').addEventListener('click', () => Game.start(selMode, selDiff));

    // Juego
    $('#btn-hint').addEventListener('click', () => Game.hint());
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
      } else if (e.key.toLowerCase() === 'h' && State.status === 'playing') {
        Game.hint();
      }
    });

    // Pausar al ocultar la pestaña
    document.addEventListener('visibilitychange', () => { if (document.hidden && State.status === 'playing') Game.pause(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  // Hook opcional para pruebas/QA (solo con ?dev en la URL). No afecta al juego normal.
  if (location.search.indexOf('dev') !== -1) window.__cv = { State, Engine, Game, Render, Config, FX, Meta, Settings, Music, Loop };
})();
