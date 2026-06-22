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

  const VERSION = '1.0.0';

  /* ===================== Telemetría de errores (local, sin red) =====================
   * Guarda los últimos errores en localStorage para diagnóstico, sin enviar nada.
   */
  const ErrLog = {
    KEY: 'cv_errlog', MAX: 20,
    push(kind, msg, extra) {
      try {
        const a = JSON.parse(localStorage.getItem(this.KEY) || '[]');
        a.push({ t: Date.now(), v: VERSION, kind, msg: String(msg).slice(0, 300), extra });
        while (a.length > this.MAX) a.shift();
        localStorage.setItem(this.KEY, JSON.stringify(a));
      } catch (_) {}
    },
  };
  window.addEventListener('error', (e) => ErrLog.push('error', e.message, { src: e.filename, line: e.lineno }));
  window.addEventListener('unhandledrejection', (e) => ErrLog.push('promise', (e.reason && e.reason.message) || e.reason));

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
      tutorial:      { name: 'Tutorial',     emoji: '🎓', timed: false, penalties: false, mult: 0.5, single: true, fixedDiff: 'facil', accent: '#ffd23f', goal: 'Junta dos iguales', desc: 'Aprende la mecánica sin prisa ni penalizaciones.' },
      clasico:       { name: 'Clásico',      emoji: '♟️', timed: false, penalties: true,  mult: 1.0, accent: '#00d0ff', goal: 'Vacía el tablero', desc: 'Vacía el tablero para superar el nivel. Cuidado: errar añade iconos.' },
      aventura:      { name: 'Aventura',     emoji: '🚀', timed: false, penalties: true,  mult: 1.1, accent: '#7a5cff', desc: 'Viaje infinito por biomas con reglas propias, objetivos y mini-jefes. ¿Hasta dónde llegarás?',
        onSetupLevel(ctx) { Adventure.setup(ctx.level); },
        winCheck() { Adventure.refreshGoal(State.level); return Adventure.winCheck(); } },
      contrarreloj:  { name: 'Contrarreloj', emoji: '⏱️', timed: true,  penalties: true,  mult: 1.2, accent: '#ff6cb0', goal: 'Combos = más tiempo', desc: 'Cada convergencia suma tiempo; los combos suman aún más. ¡No dejes que el reloj llegue a cero!' },
      supervivencia: { name: 'Supervivencia',emoji: '❤️', timed: false, penalties: true,  mult: 1.5, fast: true, endless: true, accent: '#ff5b6e', desc: 'Aguanta oleadas crecientes con vidas, trampas, jefes y potenciadores. ¿Cuánto sobrevivirás?',
        onSetupLevel(ctx) { Survival.setup(ctx.level); },
        onTick(dt) { Survival.onTick(dt); },
        onConverge(ctx) { Survival.onConverge(ctx.removed, ctx.combo); },
        onOverflow() { Survival.onOverflow(); },
        blockSpawn() { return Survival.frozen(); } },
      zen:           { name: 'Zen',          emoji: '☯️', timed: false, penalties: false, mult: 0.8, relaxed: true, endless: true, accent: '#9be15d', goal: 'Sin fallos ni prisa',
        onOverflow() { Game.softClear(0.45); }, desc: 'Ritmo relajado, sin penalizaciones ni fin de partida. Juega y respira.' },
    },
    MODE_ORDER: ['tutorial', 'clasico', 'aventura', 'contrarreloj', 'supervivencia', 'zen'],
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

    // Pares [forma, color]. ORDENADOS EN CICLOS de las 10 formas EN EL MISMO
    // ORDEN (3 ciclos = 30 iconos, múltiplo de 10). Cada forma aparece 3 veces
    // con colores distintos. Como cada nivel toma una "ventana" contigua de <=8
    // iconos (ver Engine.poolForLevel) y el periodo del ciclo es 10, CUALQUIER
    // ventana tiene SIEMPRE formas distintas: dos iconos sólo coinciden si son
    // idénticos (misma forma y color), eliminando convergencias "que parecen
    // válidas" por colores parecidos de una misma forma. La longitud múltiplo de
    // 10 conserva la propiedad incluso al dar la vuelta al catálogo.
    const PAIRS = [
      ['circle','red'],['square','blue'],['triangle','green'],['star','yellow'],['heart','pink'],['diamond','cyan'],['hexagon','orange'],['plus','purple'],['droplet','lime'],['ring','white'],
      ['circle','teal'],['square','orange'],['triangle','indigo'],['star','pink'],['heart','purple'],['diamond','lime'],['hexagon','red'],['plus','cyan'],['droplet','blue'],['ring','yellow'],
      ['circle','blue'],['square','purple'],['triangle','cyan'],['star','orange'],['heart','lime'],['diamond','indigo'],['hexagon','teal'],['plus','green'],['droplet','yellow'],['ring','pink'],
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
    get profile() { try { return JSON.parse(localStorage.getItem('cv_profile') || 'null'); } catch (_) { return null; } },
    set profile(v) { try { localStorage.setItem('cv_profile', JSON.stringify(v)); } catch (_) {} },
    get tutorialDone() { return localStorage.getItem('cv_tut') === '1'; },
    set tutorialDone(v) { localStorage.setItem('cv_tut', v ? '1' : '0'); },
    get lastVersion() { return localStorage.getItem('cv_ver') || ''; },
    set lastVersion(v) { localStorage.setItem('cv_ver', v); },
  };

  /* ===================== Settings (persistentes) ===================== */
  const Settings = (() => {
    const reduced = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
    const lang0 = (typeof navigator !== 'undefined' && /^en/i.test(navigator.language || '')) ? 'en' : 'es';
    const def = { sfx: true, music: false, haptics: true, reducedFx: reduced, lang: lang0, largeText: false };
    let s; try { s = Object.assign({}, def, JSON.parse(localStorage.getItem('cv_settings') || '{}')); } catch (_) { s = { ...def }; }
    const save = () => { try { localStorage.setItem('cv_settings', JSON.stringify(s)); } catch (_) {} };
    return {
      get sfx() { return s.sfx; }, set sfx(v) { s.sfx = v; save(); },
      get music() { return s.music; }, set music(v) { s.music = v; save(); },
      get haptics() { return s.haptics; }, set haptics(v) { s.haptics = v; save(); },
      get reducedFx() { return s.reducedFx; }, set reducedFx(v) { s.reducedFx = v; save(); },
      get lang() { return s.lang; }, set lang(v) { s.lang = v; save(); },
      get largeText() { return s.largeText; }, set largeText(v) { s.largeText = v; save(); },
    };
  })();

  /* ===================== I18n (ES / EN) =====================
   * Diccionario para la UI. apply() traduce el HTML estático por atributos
   * data-i18n (texto), data-i18n-ph (placeholder) y data-i18n-al (aria-label).
   * t(key) sirve para textos generados por JS (menús, resultados, ajustes…).
   */
  const I18n = (() => {
    const DICT = {
      es: {
        welcome_sub: 'Junta iconos iguales en el espacio', name_q: '¿Cómo te llamas?', optional: '(opcional)',
        begin: '¡Empezar!', guest: 'Jugar como invitado', start_sub: '¿List@ para conquistar el tablero?',
        play: '▶ Jugar', reward: '🎁 Recompensa diaria', menu_profile: '🏅 Logros', menu_shop: '🛍️ Tienda',
        menu_settings: '⚙️ Ajustes', how: '¿Cómo se juega?', install: '📲 Instalar app', sound: 'Sonido', best: 'Mejor puntuación:',
        modes_title: 'Elige tu misión', group_mode: 'Modo', group_diff: 'Dificultad',
        hud_record: 'Récord', hud_points: 'Puntos', hud_level: 'Nivel', hud_time: 'Tiempo', hud_speed: 'Velocidad', hud_occ: 'Ocupación',
        how_title: '¿Cómo se juega?', how1: 'Toca una <strong>casilla vacía</strong>.', how2: 'Se mira el icono más cercano en cada dirección (arriba, abajo, izquierda, derecha).',
        how3: 'Si <strong>2 o más coinciden</strong>, ¡convergen y desaparecen!', how4: 'Encadena eliminaciones rápidas para subir el <strong>combo</strong> y multiplicar puntos.',
        how5: 'Los iconos aparecen solos: vacía el tablero antes de que se llene.',
        tutorial_btn: '▶ Tutorial interactivo', understood: 'Entendido',
        pause: 'Pausa', resume: '▶ Reanudar', restart: '↻ Reiniciar', menu: '✕ Menú', close: 'Cerrar', back: 'Volver', retry: '↻ Reintentar', share: '📤 Compartir',
        settings_title: '⚙️ Ajustes', shop_title: '🛍️ Tienda', shop_hint: 'Temas del tablero. Pulsa para previsualizar.',
        profile_title: '📊 Perfil', best_by_mode: 'Mejores marcas por modo', achievements: 'Logros',
        adventure_title: '🚀 Aventura', adventure_sub: 'Viaje infinito por biomas. Cada capítulo cambia las reglas y termina con un mini-jefe.',
        revive_title: '💔 ¡Última oportunidad!', revive_sub: 'Te has quedado sin vidas. ¿Revivir y seguir sobreviviendo?', giveup: 'Rendirse',
        coach_skip: 'Saltar tutorial',
        diff_facil: 'Fácil', diff_normal: 'Normal', diff_dificil: 'Difícil',
        set_sfx: '🔊 Efectos de sonido', set_music: '🎵 Música', set_haptics: '📳 Vibración', set_reduced: '✨ Reducir efectos', set_large: '🔠 Texto grande', set_lang: '🌐 Idioma',
        st_points: 'Puntos', st_level: 'Nivel', st_combo: 'Combo máx.', st_removed: 'Eliminados', st_time: 'Tiempo', st_record: 'Récord', st_wave: 'Oleada', st_surv: 'Sobreviviste', st_best: 'Mejor',
        st_games: 'Partidas', st_bestcombo: 'Mejor combo', st_totaltime: 'Tiempo total',
        coins: 'monedas', daily_done: '¡Misión diaria completada!', weekly_done: '¡Reto semanal completado!', lvl: 'Nivel',
        next: 'Próximo', new_icons: 'Nuevos iconos', chapter: 'Capítulo', next_to: 'Ir al nivel {n} →', lets_play: '¡A jugar!',
        obj_clear: 'Vacía el tablero', obj_score: 'Consigue {n} pts', obj_survive: 'Sobrevive {n}s', obj_boss: 'JEFE · rompe los 💎', obj_boss_live: 'JEFE · rompe los 💎 ({n})',
        biomemod_nebula: '', biomemod_asteroid: '🪨 Aparecen rocas que estorban', biomemod_ice: '🧊 Casillas heladas: tócalas para romperlas', biomemod_core: '🔥 Los iconos aparecen más rápido', biomemod_void: '🕳️ Menos pistas disponibles', biomemod_crystal: '💎 Cristales con puntos extra',
        sum_level: 'Nivel alcanzado {n}', sum_time: 'Tiempo {t}', sum_wave: 'Oleada {w} · {s}s sobrevividos', sum_chapter: 'Capítulo {c} · Nivel {n}',
        level_done: '¡Nivel completado!', perfect_done: '¡Tablero perfecto!', level_sub: 'Nivel {n} superado', perfect_sub: 'Tablero limpio · bonus +{b}', boss_next: '¡Jefe a la vista!',
        over_victory: '🏆 ¡Victoria!', over_surv: '🛡️ Fin de la supervivencia', over_fail: '¡Misión fallida!',
        reason_time: '¡Se acabó el tiempo!', reason_nomoves: 'Sin movimientos posibles · {n}% del tablero ocupado.', reason_end: 'Fin de la partida.', reason_surv: 'Sobreviviste {s}s', ach_unlocked: '🏅 Logro: {n}',
      },
      en: {
        welcome_sub: 'Match equal icons across space', name_q: "What's your name?", optional: '(optional)',
        begin: 'Start!', guest: 'Play as guest', start_sub: 'Ready to conquer the board?',
        play: '▶ Play', reward: '🎁 Daily reward', menu_profile: '🏅 Profile', menu_shop: '🛍️ Shop',
        menu_settings: '⚙️ Settings', how: 'How to play?', install: '📲 Install app', sound: 'Sound', best: 'Best score:',
        modes_title: 'Choose your mission', group_mode: 'Mode', group_diff: 'Difficulty',
        hud_record: 'Best', hud_points: 'Score', hud_level: 'Level', hud_time: 'Time', hud_speed: 'Speed', hud_occ: 'Fill',
        how_title: 'How to play?', how1: 'Tap an <strong>empty cell</strong>.', how2: 'It looks at the nearest icon in each direction (up, down, left, right).',
        how3: 'If <strong>2 or more match</strong>, they converge and vanish!', how4: 'Chain quick clears to raise the <strong>combo</strong> and multiply points.',
        how5: 'Icons spawn on their own: clear the board before it fills up.',
        tutorial_btn: '▶ Interactive tutorial', understood: 'Got it',
        pause: 'Paused', resume: '▶ Resume', restart: '↻ Restart', menu: '✕ Menu', close: 'Close', back: 'Back', retry: '↻ Retry', share: '📤 Share',
        settings_title: '⚙️ Settings', shop_title: '🛍️ Shop', shop_hint: 'Board themes. Tap to preview.',
        profile_title: '📊 Profile', best_by_mode: 'Best by mode', achievements: 'Achievements',
        adventure_title: '🚀 Adventure', adventure_sub: 'Endless journey across biomes. Each chapter changes the rules and ends with a mini-boss.',
        revive_title: '💔 Last chance!', revive_sub: 'You ran out of lives. Revive and keep surviving?', giveup: 'Give up',
        coach_skip: 'Skip tutorial',
        diff_facil: 'Easy', diff_normal: 'Normal', diff_dificil: 'Hard',
        set_sfx: '🔊 Sound effects', set_music: '🎵 Music', set_haptics: '📳 Vibration', set_reduced: '✨ Reduce effects', set_large: '🔠 Large text', set_lang: '🌐 Language',
        st_points: 'Score', st_level: 'Level', st_combo: 'Max combo', st_removed: 'Cleared', st_time: 'Time', st_record: 'Best', st_wave: 'Wave', st_surv: 'Survived', st_best: 'Best',
        st_games: 'Games', st_bestcombo: 'Best combo', st_totaltime: 'Total time',
        coins: 'coins', daily_done: 'Daily mission complete!', weekly_done: 'Weekly challenge complete!', lvl: 'Level',
        next: 'Next', new_icons: 'New icons', chapter: 'Chapter', next_to: 'Go to level {n} →', lets_play: "Let's play!",
        obj_clear: 'Clear the board', obj_score: 'Reach {n} pts', obj_survive: 'Survive {n}s', obj_boss: 'BOSS · break the 💎', obj_boss_live: 'BOSS · break the 💎 ({n})',
        biome_nebula: 'Nebula', biome_asteroid: 'Asteroid Belt', biome_ice: 'Ice Field', biome_core: 'Burning Core', biome_void: 'The Void', biome_crystal: 'Crystalia',
        biomemod_nebula: '', biomemod_asteroid: '🪨 Rocks block the board', biomemod_ice: '🧊 Frozen cells: tap to break', biomemod_core: '🔥 Icons spawn faster', biomemod_void: '🕳️ Fewer hints available', biomemod_crystal: '💎 Crystals worth extra points',
        sum_level: 'Reached level {n}', sum_time: 'Time {t}', sum_wave: 'Wave {w} · {s}s survived', sum_chapter: 'Chapter {c} · Level {n}',
        level_done: 'Level complete!', perfect_done: 'Perfect board!', level_sub: 'Level {n} cleared', perfect_sub: 'Clean board · bonus +{b}', boss_next: 'Boss ahead!',
        over_victory: '🏆 Victory!', over_surv: '🛡️ Survival over', over_fail: 'Mission failed!',
        reason_time: "Time's up!", reason_nomoves: 'No moves left · {n}% of the board filled.', reason_end: 'Game over.', reason_surv: 'Survived {s}s', ach_unlocked: '🏅 Achievement: {n}',
        m_tutorial_n: 'Tutorial', m_tutorial_d: 'Learn the mechanic, no rush or penalties.', m_tutorial_g: 'Match two equal',
        m_clasico_n: 'Classic', m_clasico_d: 'Clear the board to pass the level. Careful: mistakes add icons.', m_clasico_g: 'Clear the board',
        m_aventura_n: 'Adventure', m_aventura_d: 'Endless journey across biomes with their own rules, goals and mini-bosses. How far will you go?',
        m_contrarreloj_n: 'Time Attack', m_contrarreloj_d: 'Each convergence adds time; combos add even more. Do not let the clock hit zero!', m_contrarreloj_g: 'Combos = more time',
        m_supervivencia_n: 'Survival', m_supervivencia_d: 'Endure rising waves with lives, traps, bosses and boosters. How long will you last?',
        m_zen_n: 'Zen', m_zen_d: 'Relaxed pace, no penalties or game over. Play and breathe.', m_zen_g: 'No mistakes, no rush',
      },
    };
    const FIELD = { name: 'n', desc: 'd', goal: 'g' };
    return {
      get lang() { return Settings.lang === 'en' ? 'en' : 'es'; },
      t(key) { const d = DICT[this.lang] || DICT.es; return d[key] != null ? d[key] : (DICT.es[key] != null ? DICT.es[key] : key); },
      modeT(id, field) {
        const m = Config.MODES[id] || {};
        if (this.lang === 'es') return m[field] || '';
        const k = 'm_' + id + '_' + (FIELD[field] || field);
        return DICT.en[k] != null ? DICT.en[k] : (m[field] || '');
      },
      apply(root) {
        const r = root || document;
        r.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = this.t(el.getAttribute('data-i18n')); });
        r.querySelectorAll('[data-i18n-html]').forEach((el) => { el.innerHTML = this.t(el.getAttribute('data-i18n-html')); });
        r.querySelectorAll('[data-i18n-ph]').forEach((el) => { el.setAttribute('placeholder', this.t(el.getAttribute('data-i18n-ph'))); });
        r.querySelectorAll('[data-i18n-al]').forEach((el) => { el.setAttribute('aria-label', this.t(el.getAttribute('data-i18n-al'))); });
        document.documentElement.setAttribute('lang', this.lang);
      },
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
    ctx: null, sfxGain: null, musicGain: null, _unlocked: false,
    get enabled() { return Settings.sfx; },
    // Debe llamarse DENTRO de un gesto de usuario (iOS lo exige).
    ensure() {
      if (!this.ctx) {
        try {
          // iOS 16.4+: enrutar al canal "playback" para que el audio suene aunque
          // el interruptor físico de silencio esté activado (la causa más común de
          // "no hay sonido en iPhone" mientras sí funciona en Android).
          try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (_) {}
          this.ctx = new (window.AudioContext || window.webkitAudioContext)();
          this.sfxGain = this.ctx.createGain(); this.sfxGain.gain.value = 0.9; this.sfxGain.connect(this.ctx.destination);
          this.musicGain = this.ctx.createGain(); this.musicGain.gain.value = 0.0; this.musicGain.connect(this.ctx.destination);
        } catch (_) {}
      }
      // iOS usa también el estado 'interrupted' (tras Siri/llamada), no solo 'suspended'.
      if (this.ctx && this.ctx.state !== 'running') { const r = this.ctx.resume(); if (r && r.catch) r.catch(() => {}); }
      // Desbloqueo iOS: reproducir un búfer silencioso una vez dentro del gesto.
      if (this.ctx && !this._unlocked) {
        try {
          const buf = this.ctx.createBuffer(1, 1, 22050), src = this.ctx.createBufferSource();
          src.buffer = buf; src.connect(this.ctx.destination); src.start(0); this._unlocked = true;
        } catch (_) {}
      }
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
    tiles: [],              // capa de casillas especiales (paralela a board): null=normal
    coinsRun: 0,            // monedas ganadas en la partida en curso
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
      // Una casilla sólida (roca/bloqueada/helada) no se puede activar.
      const ti = State.tiles[i];
      if (State.board[i] !== null || (ti && ti.solid)) return [];
      const r = (i / State.size) | 0, c = i % State.size;
      const groups = Object.create(null);
      for (let d = 0; d < 8; d += 2) {
        let rr = r + DIRS[d], cc = c + DIRS[d + 1];
        while (this.inside(rr, cc)) {
          const j = this.idx(rr, cc);
          // Casilla sólida: corta la línea de visión (no se ve ni converge tras ella).
          const t = State.tiles[j];
          if (t && t.solid) break;
          const v = State.board[j];
          if (v !== null) { (groups[v] || (groups[v] = [])).push(j); break; }
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
      this.cells = []; this.glyphs = []; this._cellId = []; this._cellTile = [];
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

    // Overlay de casilla especial (roca/helada/cristal…) por clase, con caché.
    setTile(i) {
      const t = State.tiles[i], type = t ? t.type : '';
      if (this._cellTile[i] === type) return;
      this._cellTile[i] = type;
      const el = this.cells[i];
      el.classList.toggle('tile-rock', type === 'rock');
      el.classList.toggle('tile-frozen', type === 'frozen');
      el.classList.toggle('tile-crystal', type === 'crystal');
      el.classList.toggle('tile-locked', type === 'locked');
      el.classList.toggle('tile-infected', type === 'infected');
    },

    syncCell(i) {
      const el = this.cells[i], v = State.board[i];
      this.setGlyph(i, v);
      this.setTile(i);
      el.classList.toggle('empty', v === null && !State.tiles[i]);
      el.classList.toggle('has-icon', v !== null);
      el.setAttribute('aria-label', this.cellLabel(i));
    },

    syncAll() { for (let i = 0; i < State.board.length; i++) this.syncCell(i); },

    spawnAnim(i) { const el = this.cells[i]; el.classList.remove('spawn'); void el.offsetWidth; el.classList.add('spawn'); },
    clearAnim(indices) {
      // La explosión del icono se vuelve más AGRESIVA con la racha de combo
      // (frenesí en el tablero): más escala de "boom", más overshoot y más giro.
      const combo = Math.max(1, State.combo || 1);
      const t = clamp((combo - 1) / 19, 0, 1);        // 0..1 ramp sobre combo 1..20
      const boom = (1.45 + t * 0.95).toFixed(2);      // 1.45 → 2.40
      const pop = (1.1 + t * 0.22).toFixed(2);        // 1.10 → 1.32
      const rotMag = 10 + t * 44;                     // 10° → 54°
      indices.forEach(i => {
        const el = this.cells[i];
        el.style.setProperty('--clear-pop', pop);
        el.style.setProperty('--clear-boom', boom);
        el.style.setProperty('--clear-rot', ((Math.random() < 0.5 ? -1 : 1) * rotMag).toFixed(0) + 'deg');
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
      // WAAPI en lugar de reiniciar una animación CSS con `void offsetWidth`, que
      // fuerza un reflujo sincrónico del documento en CADA eliminación (acumulado
      // en combos rápidos, saturaba el hilo principal de iOS -> congelación).
      p.getAnimations().forEach(a => a.cancel());
      p.animate([
        { opacity: 0, transform: 'translate(-50%,-50%) scale(.6)' },
        { opacity: 1, transform: 'translate(-50%,-90%) scale(1.05)', offset: .18 },
        { opacity: 0, transform: 'translate(-50%,-180%) scale(.95)' },
      ], { duration: 1000, easing: 'ease-out', fill: 'forwards' });
    },

    bump(el) { el.getAnimations().forEach(a => a.cancel()); el.animate([{}, { transform: 'scale(1.18)', color: '#ffd84d', offset: .5 }, {}], { duration: 300, easing: 'ease' }); },

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
    // Coalescer: marca el HUD como "sucio"; el bucle lo refresca UNA vez por frame.
    // Evita rehacer occupation()+~10 escrituras del DOM en cada tap durante combos
    // rápidos (lo que saturaba el hilo principal en iOS).
    _hudDirty: false,
    hudSoon() { this._hudDirty = true; },

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
      el.getAnimations().forEach(a => a.cancel());
      el.animate([{}, { transform: 'scale(1.14)', offset: .5 }, {}], { duration: 300, easing: 'ease' });
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
      // Clase en el propio tablero (no en <body>): evita invalidar el árbol entero.
      const w = document.querySelector('.board-wrap'); if (w) w.classList.toggle('fever-on', on);
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
    ICON: { info: 'ℹ️', good: '✅', warn: '⚠️', bad: '✖️' },
    show(msg, kind = 'info', ms = 2200, icon) {
      const el = $('#toasts'); if (!el) return;
      const ic = icon != null ? icon : (this.ICON[kind] || '');
      // Fusión de repetidos aún visibles: incrementa ×N y reinicia el temporizador.
      const dup = Array.prototype.find.call(el.children, c => c.dataset.msg === msg && !c.classList.contains('out'));
      if (dup) {
        const n = (+dup.dataset.n || 1) + 1; dup.dataset.n = n;
        let x = dup.querySelector('.toast-x');
        if (!x) { x = document.createElement('span'); x.className = 'toast-x'; dup.appendChild(x); }
        x.textContent = '×' + n;
        clearTimeout(dup._t); dup._t = setTimeout(() => this._out(dup), ms);
        dup.classList.remove('pop'); void dup.offsetWidth; dup.classList.add('pop');
        return;
      }
      const t = document.createElement('div');
      t.className = 'toast ' + kind; t.dataset.msg = msg; t.dataset.n = '1';
      if (ic) { const s = document.createElement('span'); s.className = 'toast-ic'; s.textContent = ic; t.appendChild(s); }
      const tx = document.createElement('span'); tx.className = 'toast-tx'; tx.textContent = msg; t.appendChild(tx);
      el.appendChild(t);
      t._t = setTimeout(() => this._out(t), ms);
      while (el.children.length > 3) el.firstChild.remove();
    },
    _out(t) { if (!t) return; t.classList.add('out'); t.addEventListener('animationend', () => t.remove(), { once: true }); },
  };

  // Cuenta ascendente de un número en un elemento (recompensa visual barata).
  function countUp(el, to, ms, prefix, suffix) {
    if (!el) return; to = +to || 0; prefix = prefix || ''; suffix = suffix || '';
    if (Settings.reducedFx || to <= 0) { el.textContent = prefix + to + suffix; return; }
    const t0 = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - t0) / ms);
      el.textContent = prefix + Math.round(to * (1 - Math.pow(1 - k, 3))) + suffix;
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

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
    _last: null,
    open(id) {
      this._last = document.activeElement;
      $('#overlay').hidden = false;
      document.querySelectorAll('.modal').forEach(m => m.hidden = m.id !== id);
      const m = $('#' + id);
      const focusable = m.querySelector('button:not([disabled]), [href], input');
      if (focusable) focusable.focus();
    },
    close() {
      $('#overlay').hidden = true; document.querySelectorAll('.modal').forEach(m => m.hidden = true);
      // Accesibilidad: devolver el foco al elemento que abrió el modal.
      if (this._last && this._last.focus) { try { this._last.focus(); } catch (_) {} }
      this._last = null;
    },
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
    layer: null, pool: [], idx: 0, active: 0, cap: 40, w: 0, h: 0, boardRect: null, supported: true, wave: null,
    POOL: 56,                 // capas DOM máximas (acotado para no saturar el compositor)
    // Estrella REDONDEADA (5 puntas con esquinas suaves) como máscara SVG: escala
    // a cualquier tamaño (mask-size 100%) y el fondo/gradiente se ve a través.
    STAR_MASK: "url(\"data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%2024%2024'%3E%3Cpath%20fill='%23fff'%20d='M12%202.5c.5%200%20.9.3%201.1.7l2.4%205%205.4.8c1%20.1%201.4%201.3.7%202l-3.9%203.8.9%205.4c.2%201-.9%201.8-1.8%201.3L12%2018.9l-4.8%202.5c-.9.5-2-.3-1.8-1.3l.9-5.4L3.4%2011c-.7-.7-.3-1.9.7-2l5.4-.8%202.4-5c.2-.4.6-.7%201.1-.7z'/%3E%3C/svg%3E\")",
    // Aplica (on) o quita (off) la forma de estrella sobre un elemento del pool.
    _setStar(el, on) {
      const m = on ? this.STAR_MASK : 'none';
      el.style.webkitMaskImage = m; el.style.maskImage = m;
      if (on) {
        el.style.webkitMaskSize = el.style.maskSize = '100% 100%';
        el.style.webkitMaskRepeat = el.style.maskRepeat = 'no-repeat';
        el.style.webkitMaskPosition = el.style.maskPosition = 'center';
      }
      el.style.clipPath = 'none';
    },
    init() {
      this.layer = $('#fx'); if (!this.layer) return;
      this.supported = typeof Element !== 'undefined' && !!Element.prototype.animate;
      const frag = document.createDocumentFragment();
      for (let i = 0; i < this.POOL; i++) {
        const s = document.createElement('span');
        s.className = 'fxp';
        this.pool.push({ el: s, anim: null, busy: false });
        frag.appendChild(s);
      }
      // Onda expansiva del punto de convergencia (elemento dedicado: anillo con
      // glow propio vía CSS, así no contamina el pool con filtros costosos).
      this.wave = document.createElement('span'); this.wave.id = 'fx-wave';
      frag.appendChild(this.wave);
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
    // Busca una ranura LIBRE (sin cancelar las activas: cero churn de capas).
    _slot() {
      const N = this.pool.length;
      for (let k = 0; k < N; k++) {
        const p = this.pool[this.idx]; this.idx = (this.idx + 1) % N;
        if (!p.busy) return p;
      }
      return null; // todas ocupadas -> se descarta la partícula (mejor que blanquear)
    },
    // Lanza una partícula con velocidad (vx,vy) px/s y gravedad g px/s^2 durante life s.
    // Si se alcanza el tope de concurrencia, se DESCARTA (nunca se cancela una activa),
    // así el nº de capas del compositor queda acotado y no hay parpadeo blanco.
    _emit(x, y, vx, vy, g, life, size, color, shape, spin) {
      if (!this.supported || this.active >= this.cap) return;
      const p = this._slot(); if (!p) return;
      const el = p.el;
      el.style.width = size + 'px';
      el.style.height = (shape === 1 ? size * 0.6 : size) + 'px';
      el.style.background = color;
      el.style.borderRadius = shape === 1 ? '1px' : '50%';
      // Partículas redondas/cuadradas: sin estrella ni glow. Se resetea SIEMPRE
      // para no contaminar ranuras reutilizadas por las estrellas (burst, confeti…).
      this._setStar(el, false); el.style.filter = 'none';
      // Muestreo parabólico de la trayectoria -> keyframes (el compositor interpola).
      const N = 5, frames = [];
      for (let k = 0; k <= N; k++) {
        const t = life * k / N;
        const px = x + vx * t, py = y + vy * t + 0.5 * g * t * t;
        const rot = spin ? ' rotate(' + (spin * t) + 'deg)' : '';
        frames.push({ transform: 'translate3d(' + px.toFixed(1) + 'px,' + py.toFixed(1) + 'px,0)' + rot, opacity: k >= N - 1 ? 0 : 1, offset: k / N });
      }
      p.busy = true; this.active++;
      let anim;
      try { anim = el.animate(frames, { duration: life * 1000, easing: 'linear', fill: 'forwards' }); }
      catch (_) { p.busy = false; this.active--; return; }
      p.anim = anim;
      const done = () => { if (p.busy) { p.busy = false; this.active = Math.max(0, this.active - 1); } el.style.opacity = '0'; };
      anim.onfinish = done; anim.oncancel = done;
    },
    // Estallido en la celda eliminada (sale del centro hacia fuera).
    // OJO: usa el rect del tablero CACHEADO (no se llama a getBoundingClientRect
    // aquí: leerlo por cada eliminación, intercalado con las escrituras del DOM,
    // provoca "layout thrashing" y bloquea el hilo principal en iOS).
    burst(i, color, n) {
      if (Settings.reducedFx || !this.supported) return;
      const { x, y } = this.cellXY(i); n = Math.min(n, 5);
      for (let k = 0; k < n; k++) { const a = Math.random() * 6.283, sp = 70 + Math.random() * 170; this._emit(x, y, Math.cos(a) * sp, Math.sin(a) * sp - 70, 780, 0.42 + Math.random() * 0.28, 5 + Math.random() * 4, color, 0, 0); }
    },
    // Celebración de récord: brota de la última eliminación, sube/se abre y cae al fondo
    celebrate(i) {
      if (Settings.reducedFx || !this.supported) return;
      const { x, y } = this.cellXY(i), C = ['#ffd23f', '#ff5b6e', '#4b8bff', '#3ad07f', '#a06bff', '#2bd4e6', '#ff9838'];
      const n = Math.min(36, this.cap);
      for (let k = 0; k < n; k++) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2, sp = 260 + Math.random() * 320;
        // vida suficiente para que la parábola alcance el fondo de la pantalla
        this._emit(x, y, Math.cos(a) * sp, Math.sin(a) * sp, 900, 1.7 + Math.random() * 1.1, 6 + Math.random() * 4, C[k % C.length], 1, (Math.random() - 0.5) * 720);
      }
    },
    // Confeti que cae desde arriba (nivel/victoria)
    confetti(n) {
      if (Settings.reducedFx || !this.supported) return;
      n = Math.min(n, this.cap);
      const C = ['#ff5b6e', '#4b8bff', '#3ad07f', '#ffd23f', '#a06bff', '#2bd4e6', '#ff9838'];
      for (let k = 0; k < n; k++) this._emit(Math.random() * this.w, -14, (Math.random() - 0.5) * 110, 150 + Math.random() * 170, 360, 1.8 + Math.random() * 1.1, 6 + Math.random() * 4, C[k % C.length], 1, (Math.random() - 0.5) * 540);
    },
    // Duración del efecto = EXACTAMENTE la de glyph-out (styles.css:299), para que
    // estrellas y camino aparezcan/desaparezcan en SINCRONÍA con la desaparición de
    // los iconos (sin retraso). Algo más lento (460 ms) para que se perciba bien.
    DUR_CLEAR: 460,
    // Estrellita de "camino": pop en (x,y) tras `delay` ms; se mantiene y se
    // desvanece junto con TODO el efecto al terminar DUR_CLEAR (mismo final).
    // Reutiliza el pool y el gobernador. Sin glow (son muchas).
    _spark(x, y, size, color, delay) {
      if (!this.supported || this.active >= this.cap) return;
      const p = this._slot(); if (!p) return;
      const el = p.el;
      el.style.width = size + 'px'; el.style.height = size + 'px';
      el.style.background = color;
      this._setStar(el, true); el.style.filter = 'none';
      const ox = (x - size / 2).toFixed(1), oy = (y - size / 2).toFixed(1);
      const tr = (sc, rot) => 'translate3d(' + ox + 'px,' + oy + 'px,0) scale(' + sc + ') rotate(' + rot + 'deg)';
      const dur = Math.max(140, this.DUR_CLEAR - delay);
      const oin = Math.min(0.5, 100 / dur);
      const ohold = Math.min(0.8, Math.max(oin + 0.05, (260 - delay) / dur));
      const frames = [
        { transform: tr(0.3, 0), opacity: 0, offset: 0, easing: 'ease-out' },
        { transform: tr(1, 0), opacity: 1, offset: oin, easing: 'linear' },
        { transform: tr(1, 0), opacity: 1, offset: ohold, easing: 'ease-out' },
        // Salida "pop" explotando, igual que las estrellas grandes.
        { transform: tr(1.6, 16), opacity: 0, offset: 1 },
      ];
      p.busy = true; this.active++;
      let anim;
      try { anim = el.animate(frames, { duration: dur, delay: delay || 0, fill: 'both' }); }
      catch (_) { p.busy = false; this.active--; return; }
      p.anim = anim;
      const done = () => { if (p.busy) { p.busy = false; this.active = Math.max(0, this.active - 1); } el.style.opacity = '0'; };
      anim.onfinish = done; anim.oncancel = done;
    },
    // Mini-estrella que sale volando de (x0,y0) hacia (x1,y1): pop + viaje hacia
    // afuera con desaceleración elegante y desvanecido. Reutiliza el pool.
    _flyStar(x0, y0, x1, y1, size, color, delay, dur) {
      if (!this.supported || this.active >= this.cap) return;
      const p = this._slot(); if (!p) return;
      const el = p.el;
      el.style.width = size + 'px'; el.style.height = size + 'px';
      el.style.background = color;
      this._setStar(el, true); el.style.filter = 'drop-shadow(0 0 3px ' + color + ')';
      const tr = (x, y, sc, rot) => 'translate3d(' + (x - size / 2).toFixed(1) + 'px,' + (y - size / 2).toFixed(1) + 'px,0) scale(' + sc + ') rotate(' + rot + 'deg)';
      const mx = x0 + (x1 - x0) * 0.62, my = y0 + (y1 - y0) * 0.62;
      const frames = [
        { transform: tr(x0, y0, 0.2, 0), opacity: 0, offset: 0, easing: 'ease-out' },
        { transform: tr(mx, my, 1, 18), opacity: 1, offset: 0.4, easing: 'ease-out' },
        { transform: tr(x1, y1, 0.4, 40), opacity: 0, offset: 1 },
      ];
      p.busy = true; this.active++;
      let anim;
      try { anim = el.animate(frames, { duration: dur, delay: delay || 0, fill: 'both' }); }
      catch (_) { p.busy = false; this.active--; return; }
      p.anim = anim;
      const done = () => { if (p.busy) { p.busy = false; this.active = Math.max(0, this.active - 1); } el.style.opacity = '0'; };
      anim.onfinish = done; anim.oncancel = done;
    },
    // Estallido sutil de mini-estrellitas en todas direcciones desde (cx,cy),
    // sincronizado con la explosión de la estrella central → toque de "celebración".
    _miniBurst(cx, cy, color, cellPx) {
      const n = 6 + ((State.combo || 0) >= 6 ? 2 : 0);   // sutil (no exagerado)
      const size = Math.max(4, cellPx * 0.16);
      const dist = cellPx * 0.78;
      const delay = this.DUR_CLEAR * 0.5;                // estalla con la explosión central
      const dur = this.DUR_CLEAR - delay;                // termina junto con todo
      const base = Math.random() * 6.283;
      for (let k = 0; k < n; k++) {
        const a = base + k / n * 6.283 + (Math.random() - 0.5) * 0.35;
        const d = dist * (0.8 + Math.random() * 0.4);
        this._flyStar(cx, cy, cx + Math.cos(a) * d, cy + Math.sin(a) * d, size, color, delay, dur);
      }
    },
    // Convergencia (un solo efecto, SINCRONIZADO con glyph-out = DUR_CLEAR):
    // estrella contenida en la casilla central (la "X") + una estrella IGUAL sobre
    // cada icono eliminado (el icono "se convierte" en estrella al desaparecer) +
    // un camino de estrellitas mucho más pequeñas dibujado del centro hacia afuera.
    // Todo aparece y desaparece a la vez. color = color por tier de combo.
    converge(centerIdx, cells, color) {
      if (Settings.reducedFx || !this.supported) return;
      this.syncBoardRect();
      const r = this.boardRect, sz = State.size;
      if (!r || !r.width) return;
      const cellPx = r.width / sz;
      const rcXY = (row, col) => ({ x: r.left + (col + 0.5) / sz * r.width, y: r.top + (row + 0.5) / sz * r.height });
      const cr = (centerIdx / sz) | 0, cc = centerIdx % sz;
      const C = rcXY(cr, cc);
      const tiny = Math.max(4, cellPx * 0.15);        // estrellitas de camino (mucho menores)
      const SWEEP = 170;                              // barrido del camino (dentro de DUR_CLEAR)

      // 1) Onda expansiva elegante en el punto de convergencia: un anillo que crece
      // desde el centro y se desvanece, a la misma velocidad que la eliminación.
      if (this.wave) {
        const w = Math.round(cellPx * 1.7);           // diámetro base del anillo
        this.wave.style.width = w + 'px'; this.wave.style.height = w + 'px';
        this.wave.style.borderColor = color;
        this.wave.style.boxShadow = '0 0 7px ' + color + ', inset 0 0 7px ' + color;
        const wt = (sc) => 'translate3d(' + (C.x - w / 2).toFixed(1) + 'px,' + (C.y - w / 2).toFixed(1) + 'px,0) scale(' + sc + ')';
        try {
          this.wave.animate([
            { transform: wt(0.18), opacity: 0, offset: 0, easing: 'ease-out' },
            { transform: wt(0.42), opacity: 0.95, offset: 0.16, easing: 'cubic-bezier(.15,.6,.3,1)' },
            { transform: wt(1.0), opacity: 0, offset: 1 },
          ], { duration: this.DUR_CLEAR, fill: 'forwards' });
        } catch (_) {}
      }

      // 1b) Toque de "celebración": mini-estrellitas saliendo en todas direcciones
      // desde el centro, estallando junto con la onda expansiva.
      this._miniBurst(C.x, C.y, color, cellPx);

      // 2) Camino de estrellitas (centro→afuera) hacia cada icono eliminado. El
      // icono se elimina con su PROPIA animación (glyph-out: pop del icono real),
      // no con una estrella encima.
      for (const idx of cells) {
        const ir = (idx / sz) | 0, ic = idx % sz;
        const dr = Math.sign(ir - cr), dc = Math.sign(ic - cc);
        const N = Math.max(Math.abs(ir - cr), Math.abs(ic - cc));  // distancia en celdas
        for (let d = 0.6; d <= N - 0.4 + 1e-6; d += 0.5) {
          const pos = rcXY(cr + dr * d, cc + dc * d);
          this._spark(pos.x, pos.y, tiny, color, (d / N) * SWEEP);
        }
      }
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
    const SCHEMA = 2;
    const def = { _v: SCHEMA, xp: 0, level: 1, games: 0, totalRemoved: 0, coins: 0, achievements: {}, daily: { date: '' }, streak: { count: 0, date: '' }, reward: { date: '', day: 0 }, adventure: { maxLevel: 1 }, survBest: 0, stats: { totalScore: 0, bestCombo: 0, totalTime: 0 }, modes: {}, weekly: { week: '', id: '', progress: 0, done: false }, cosmetics: { owned: {}, theme: 'default', skin: 'default', fx: 'default' } };
    let m;
    try { m = Object.assign({}, def, JSON.parse(localStorage.getItem(KEY) || '{}')); }
    catch (_) { m = JSON.parse(JSON.stringify(def)); }
    // Migración de esquema (rellena campos nuevos sin perder progreso previo).
    if (!m.cosmetics) m.cosmetics = JSON.parse(JSON.stringify(def.cosmetics));
    if (!m.reward) m.reward = { date: '', day: 0 };
    if (!m.adventure) m.adventure = { maxLevel: 1 };
    if (!m.stats) m.stats = { totalScore: 0, bestCombo: 0, totalTime: 0 };
    if (!m.modes) m.modes = {};
    if (!m.weekly) m.weekly = { week: '', id: '', progress: 0, done: false };
    if (typeof m.coins !== 'number') m.coins = 0;
    m._v = SCHEMA;
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
    // Reto semanal (acumulativo durante la semana)
    const WEEKLY = [
      { id: 'w_games', text: 'Juega 12 partidas esta semana', target: 12, kind: 'games' },
      { id: 'w_remove', text: 'Elimina 800 iconos esta semana', target: 800, kind: 'remove' },
      { id: 'w_score', text: 'Suma 20.000 puntos esta semana', target: 20000, kind: 'score' },
      { id: 'w_combo', text: 'Consigue un combo ×15', target: 15, kind: 'combo' },
    ];
    function weekId(dt) { const t = dt || new Date(); const o = new Date(t); o.setHours(0, 0, 0, 0); o.setDate(o.getDate() - ((o.getDay() + 6) % 7)); return o.toISOString().slice(0, 10); }
    function weeklyChallenge() {
      const w = weekId();
      if (m.weekly.week !== w) { const idx = Math.abs(hashStr(w)) % WEEKLY.length; m.weekly = { week: w, id: WEEKLY[idx].id, progress: 0, done: false }; save(); }
      return Object.assign({}, WEEKLY.find(x => x.id === m.weekly.id), m.weekly);
    }
    return {
      get state() { return m; },
      level: () => m.level, xp: () => m.xp, xpForLevel, streak: () => m.streak.count,
      rank: () => RANKS[Math.min(RANKS.length - 1, Math.floor((m.level - 1) / 3))],
      dailyMission, weeklyChallenge,
      // ---- Estadísticas / leaderboard local ----
      stats: () => ({ games: m.games || 0, totalRemoved: m.totalRemoved || 0, totalScore: m.stats.totalScore || 0, bestCombo: m.stats.bestCombo || 0, totalTime: m.stats.totalTime || 0 }),
      modeBest: (mode) => (m.modes[mode] && m.modes[mode].best) || 0,
      modePlays: (mode) => (m.modes[mode] && m.modes[mode].plays) || 0,
      // ---- Economía (monedas) ----
      coins: () => m.coins || 0,
      addCoins(n) { m.coins = (m.coins || 0) + Math.max(0, n | 0); save(); return m.coins; },
      spend(n) { n = n | 0; if ((m.coins || 0) < n) return false; m.coins -= n; save(); return true; },
      // ---- Cosméticos (propiedad y equipado) ----
      cosmetics: () => m.cosmetics,
      owns: (id) => id === 'default' || !!(m.cosmetics.owned && m.cosmetics.owned[id]),
      buy(id, cost) { if (this.owns(id)) return true; if (!this.spend(cost)) return false; m.cosmetics.owned[id] = today(); save(); return true; },
      equip(slot, id) { if (!this.owns(id)) return false; m.cosmetics[slot] = id; save(); return true; },
      // ---- Recompensa diaria ----
      rewardReady: () => m.reward.date !== today(),
      rewardDay: () => m.reward.day || 0,
      advMax: () => (m.adventure && m.adventure.maxLevel) || 1,
      advReach(level) { if (level > ((m.adventure && m.adventure.maxLevel) || 1)) { m.adventure.maxLevel = level; save(); } },
      survBest: () => m.survBest || 0,
      survRecord(sec) { sec = Math.floor(sec); if (sec > (m.survBest || 0)) { m.survBest = sec; save(); return true; } return false; },
      claimReward() {
        if (m.reward.date === today()) return 0;
        const y = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
        m.reward.day = (m.reward.date === y) ? (m.reward.day + 1) : 1;
        const amount = 20 + 10 * Math.min(m.reward.day, 7);
        m.reward.date = today(); m.coins = (m.coins || 0) + amount; save();
        return amount;
      },
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
        // Reto semanal (acumulativo)
        const wk = weeklyChallenge(); let weeklyDone = false;
        if (!m.weekly.done) {
          const inc = wk.kind === 'games' ? 1 : wk.kind === 'remove' ? ctx.removed : wk.kind === 'score' ? ctx.score : 0;
          if (wk.kind === 'combo') m.weekly.progress = Math.max(m.weekly.progress || 0, ctx.maxCombo);
          else m.weekly.progress = (m.weekly.progress || 0) + inc;
          if (m.weekly.progress >= wk.target) { m.weekly.done = true; weeklyDone = true; }
        }
        // Estadísticas de por vida + mejor por modo (leaderboard local)
        m.stats.totalScore = (m.stats.totalScore || 0) + ctx.score;
        m.stats.totalTime = (m.stats.totalTime || 0) + (ctx.elapsed || 0);
        if (ctx.maxCombo > (m.stats.bestCombo || 0)) m.stats.bestCombo = ctx.maxCombo;
        const md = m.modes[ctx.mode] || (m.modes[ctx.mode] = { best: 0, plays: 0 });
        md.plays = (md.plays || 0) + 1;
        if (ctx.score > (md.best || 0)) md.best = ctx.score;
        let xpGained = Math.round(ctx.score / 10 + ctx.maxCombo * 5 + ctx.level * 20 + (ctx.perfect ? 100 : 0));
        if (missionDone) xpGained += 150;
        if (weeklyDone) xpGained += 400;
        const leveledUp = this.addXp(xpGained);
        // Monedas de la partida (motor de economía/tienda).
        let coinsGained = Math.round(ctx.score / 40 + ctx.maxCombo * 2 + ctx.level * 5 + (ctx.perfect ? 40 : 0));
        if (missionDone) coinsGained += 60;
        if (weeklyDone) coinsGained += 200;
        m.coins = (m.coins || 0) + coinsGained;
        const cctx = Object.assign({ games: m.games }, ctx);
        const newAch = [];
        ACH.forEach(a => { if (!m.achievements[a.id] && a.t(cctx)) { m.achievements[a.id] = d; newAch.push(a); } });
        save();
        return { xpGained, coinsGained, leveledUp, newAch, missionDone, weeklyDone };
      },
    };
  })();

  /* ===================== Tiles (casillas especiales) =====================
   * Registro de tipos de casilla. `solid` corta la línea de visión y no converge
   * (lo consulta Engine.converging). El resto de propiedades las usan los modos
   * que las emplean (Aventura/Supervivencia) y Render para el overlay visual.
   */
  const Tiles = {
    DEFS: {
      rock:     { glyph: '🪨', solid: true,  cls: 'tile-rock',     desc: 'Roca: estorba y no converge' },
      locked:   { glyph: '🔒', solid: true,  cls: 'tile-locked',   desc: 'Bloqueada' },
      frozen:   { glyph: '🧊', solid: true,  cls: 'tile-frozen', taps: 2, desc: 'Helada: toca para descongelar' },
      infected: { glyph: '☣️', solid: false, cls: 'tile-infected', desc: 'Se propaga si no la limpias' },
      crystal:  { glyph: '💎', solid: false, cls: 'tile-crystal', bonus: 3, desc: 'Vale puntos extra' },
    },
    make(type) { const d = this.DEFS[type]; return d ? Object.assign({ type }, d) : null; },
  };

  /* ===================== Boosters (potenciadores) =====================
   * Catálogo de potenciadores. `apply(ctx)` se conecta en la Fase 5 (Supervivencia).
   */
  const Boosters = {
    DEFS: {
      bomb:      { name: 'Bomba',    glyph: '💣', cost: 80,  charge: 12, desc: 'Limpia una zona' },
      freeze:    { name: 'Congelar', glyph: '❄️', cost: 60,  charge: 10, desc: 'Pausa los spawns' },
      x2:        { name: 'Doble',    glyph: '⚡', cost: 70,  charge: 14, desc: 'Puntos x2 temporal' },
      clearLine: { name: 'Limpiar',  glyph: '🧹', cost: 90,  charge: 16, desc: 'Vacía fila o columna' },
      wild:      { name: 'Comodín',  glyph: '🃏', cost: 100, charge: 18, desc: 'Convergencia garantizada' },
    },
    order: ['bomb', 'freeze', 'x2', 'clearLine', 'wild'],
  };

  /* ===================== Modifiers (reglas de bioma/oleada) =====================
   * Bloques reutilizables que combinan los modos Aventura/Supervivencia (Fases 4/5).
   */
  const Modifiers = {
    DEFS: {
      rocks:  { name: 'Asteroides', tile: 'rock',   density: 0.06 },
      ice:    { name: 'Hielo',      tile: 'frozen', density: 0.05 },
      rush:   { name: 'Núcleo',     spawnMult: 0.8 },
      scarce: { name: 'Vacío',      hints: 1 },
      crystals:{ name: 'Cristales', tile: 'crystal', density: 0.04 },
    },
  };

  /* ===================== Themes + Cosmetics (tienda) =====================
   * Cada tema = sobrescritura de variables CSS (coste de runtime cero). Se aplican
   * en :root; el equipado se guarda en Meta.cosmetics.theme.
   */
  const Themes = {
    DEFS: {
      default: { name: 'Cosmos', cost: 0, vars: {} },
      neon:    { name: 'Neón',    cost: 150, vars: { '--bg-0': '#0a0420', '--bg-1': '#12063a', '--bg-2': '#1e0a5c', '--panel': '#1a1052', '--panel-2': '#241466', '--accent': '#b14bff', '--accent-2': '#19f0d0', '--level': '#ff5cf0', '--score': '#19f0d0' } },
      sunset:  { name: 'Ocaso',   cost: 200, vars: { '--bg-0': '#1a0a14', '--bg-1': '#2e0f1e', '--bg-2': '#4a1530', '--panel': '#34122a', '--panel-2': '#451a38', '--accent': '#ff7a59', '--accent-2': '#ffd23f', '--level': '#ff5b6e', '--score': '#ffb24d' } },
      forest:  { name: 'Bosque',  cost: 200, vars: { '--bg-0': '#04140f', '--bg-1': '#08231a', '--bg-2': '#0e3a2b', '--panel': '#0c3024', '--panel-2': '#114433', '--accent': '#2fbf71', '--accent-2': '#9be15d', '--level': '#27b6a0', '--score': '#9be15d' } },
      aurora:  { name: 'Aurora',  cost: 300, vars: { '--bg-0': '#04101c', '--bg-1': '#082236', '--bg-2': '#0c3a52', '--panel': '#0b2c45', '--panel-2': '#103a59', '--accent': '#19f0d0', '--accent-2': '#7a5cff', '--level': '#3ad07f', '--score': '#19f0d0' } },
      mono:    { name: 'Eclipse', cost: 250, vars: { '--bg-0': '#0c0c10', '--bg-1': '#16161c', '--bg-2': '#24242e', '--panel': '#1c1c24', '--panel-2': '#26262f', '--accent': '#8a90a6', '--accent-2': '#cfd6ea', '--level': '#aeb6cc', '--score': '#cfd6ea' } },
    },
    order: ['default', 'neon', 'sunset', 'forest', 'aurora', 'mono'],
    allVars() { const s = {}; this.order.forEach((id) => Object.keys(this.DEFS[id].vars).forEach((k) => s[k] = 1)); return Object.keys(s); },
    swatch(id) { const v = this.DEFS[id].vars; return `linear-gradient(135deg, ${v['--bg-2'] || '#101a3e'}, ${v['--accent-2'] || '#00d0ff'})`; },
  };
  const Cosmetics = {
    _set(id) {
      const root = document.documentElement;
      Themes.allVars().forEach((k) => root.style.removeProperty(k));
      const t = Themes.DEFS[id] || Themes.DEFS.default;
      Object.keys(t.vars).forEach((k) => root.style.setProperty(k, t.vars[k]));
      const tm = document.querySelector('meta[name=theme-color]');
      if (tm && t.vars['--bg-1']) tm.setAttribute('content', t.vars['--bg-1']);
    },
    apply() { this._set(Meta.cosmetics().theme); },
    previewTheme(id) { this._set(id); },
  };

  /* ===================== Adventure (modo Aventura: biomas procedurales infinitos) =====================
   * Capítulos infinitos; cada capítulo = `perChapter` niveles de un bioma (paleta +
   * modificadores + objetivo) y termina en un nodo de mini-jefe. La dificultad escala
   * sin fin con el capítulo. Usa los registros Tiles/Modifiers de la Fase 0.
   */
  const Adventure = {
    perChapter: 5,
    BIOMES: [
      { id: 'nebula',   name: 'Nebulosa',               glyph: '🌌', mods: [],           accent: '#7a5cff' },
      { id: 'asteroid', name: 'Cinturón de Asteroides', glyph: '🪨', mods: ['rocks'],    accent: '#ff9838' },
      { id: 'ice',      name: 'Campo de Hielo',         glyph: '🧊', mods: ['ice'],      accent: '#2bd4e6' },
      { id: 'core',     name: 'Núcleo Ardiente',        glyph: '🔥', mods: ['rush'],     accent: '#ff5b6e' },
      { id: 'void',     name: 'El Vacío',               glyph: '🕳️', mods: ['scarce'],   accent: '#a06bff' },
      { id: 'crystal',  name: 'Cristalia',              glyph: '💎', mods: ['crystals'], accent: '#19f0d0' },
    ],
    objective: 'clear', target: 0, levelScore0: 0, levelStart: 0,
    chapterOf(level) { return Math.floor((level - 1) / this.perChapter); },
    licOf(level) { return (level - 1) % this.perChapter; },
    biomeOf(level) { return this.BIOMES[this.chapterOf(level) % this.BIOMES.length]; },
    isBoss(level) { return this.licOf(level) === this.perChapter - 1; },
    resumeLevel() { return Meta.advMax(); },

    setup(level) {
      const biome = this.biomeOf(level), lic = this.licOf(level), chapter = this.chapterOf(level), boss = this.isBoss(level);
      this.levelScore0 = State.score; this.levelStart = State.elapsed;
      // Escalada infinita: más presión de spawn por capítulo.
      State.spawnRate = Math.max(360, Math.round(State.spawnRate / (1 + chapter * 0.12)));
      // Objetivo del nivel
      this.objective = boss ? 'boss' : (lic === 2 ? 'score' : (lic === 3 && chapter > 0 ? 'survive' : 'clear'));
      this.target = 0;
      // Modificadores de bioma (densidad creciente con el capítulo)
      if (biome.mods.includes('rocks')) this._placeOnEmpty('rock', Math.min(0.16, 0.06 + chapter * 0.012));
      if (biome.mods.includes('ice')) this._placeFrozen(Math.min(0.14, 0.05 + chapter * 0.012));
      if (biome.mods.includes('rush')) State.spawnRate = Math.max(340, Math.round(State.spawnRate * 0.8));
      if (biome.mods.includes('scarce')) State.hintsLeft = 1;
      if (biome.mods.includes('crystals') && !boss) this._placeCrystals(2 + Math.min(chapter, 3));
      if (this.objective === 'score') this.target = 250 + chapter * 120 + lic * 40;
      if (this.objective === 'survive') this.target = 18 + chapter * 4;
      if (this.objective === 'boss') this._placeCrystals(2 + Math.min(chapter, 4));
      this.banner(level);
    },

    _emptyIdx() { const a = []; for (let i = 0; i < State.board.length; i++) if (State.board[i] === null && !State.tiles[i]) a.push(i); return a; },
    _filledIdx() { const a = []; for (let i = 0; i < State.board.length; i++) if (State.board[i] !== null && !State.tiles[i]) a.push(i); return a; },
    _placeOnEmpty(type, density) { const e = this._emptyIdx(), n = Math.floor(e.length * density); for (let k = 0; k < n && e.length; k++) State.tiles[e.splice(rand(e.length), 1)[0]] = Tiles.make(type); },
    _placeFrozen(density) { const f = this._filledIdx(), n = Math.floor(State.board.length * density); for (let k = 0; k < n && f.length; k++) State.tiles[f.splice(rand(f.length), 1)[0]] = Tiles.make('frozen'); },
    _placeCrystals(k) { const f = this._filledIdx(); for (let x = 0; x < k && f.length; x++) State.tiles[f.splice(rand(f.length), 1)[0]] = Tiles.make('crystal'); },
    crystalsLeft() { let n = 0; for (let i = 0; i < State.tiles.length; i++) if (State.tiles[i] && State.tiles[i].type === 'crystal') n++; return n; },

    winCheck() {
      if (this.objective === 'score') return (State.score - this.levelScore0) >= this.target ? 'win' : undefined;
      if (this.objective === 'survive') return (State.elapsed - this.levelStart) >= this.target ? 'win' : undefined;
      if (this.objective === 'boss') return this.crystalsLeft() === 0 ? 'win' : undefined;
      return undefined; // 'clear' => regla por defecto (tablero vacío)
    },
    objectiveText() {
      if (this.objective === 'boss') return I18n.t('obj_boss_live').replace('{n}', this.crystalsLeft());
      if (this.objective === 'score') return I18n.t('obj_score').replace('{n}', this.target);
      if (this.objective === 'survive') return I18n.t('obj_survive').replace('{n}', this.target);
      return I18n.t('obj_clear');
    },
    // Objetivo del nivel `level` SIN mutar estado (para previsualizar el siguiente).
    previewObjective(level) {
      const lic = this.licOf(level), chapter = this.chapterOf(level), boss = this.isBoss(level);
      const obj = boss ? 'boss' : (lic === 2 ? 'score' : (lic === 3 && chapter > 0 ? 'survive' : 'clear'));
      if (obj === 'boss') return I18n.t('obj_boss');
      if (obj === 'score') return I18n.t('obj_score').replace('{n}', 250 + chapter * 120 + lic * 40);
      if (obj === 'survive') return I18n.t('obj_survive').replace('{n}', 18 + chapter * 4);
      return I18n.t('obj_clear');
    },
    biomeName(bi) { return I18n.lang === 'en' ? (I18n.t('biome_' + bi.id) || bi.name) : bi.name; },
    biomeModText(bi) { return bi.mods.length ? I18n.t('biomemod_' + bi.id) : ''; },
    banner(level) {
      const el = $('#obj-banner'); if (!el) return;
      const biome = this.biomeOf(level);
      el.hidden = false; el.style.borderColor = '';
      el.innerHTML = `<span class="obj-biome">${biome.glyph} ${I18n.t('chapter')} ${this.chapterOf(level) + 1} · ${this.biomeName(biome)}</span><span class="obj-goal" id="obj-goal">${this.objectiveText()}</span>`;
    },
    refreshGoal() { const g = $('#obj-goal'); if (g) g.textContent = this.objectiveText(); },
  };

  /* ===================== Survival (Supervivencia 2.0: oleadas, vidas, boosters, trampas) ===================== */
  const Survival = {
    WAVE_MS: 22000, MAX_LIVES: 3, CHARGE_PER: 9, BOOSTERS: ['bomb', 'freeze', 'x2', 'clearLine'],
    lives: 3, wave: 1, waveAcc: 0, survSec: 0, charge: 0, freezeUntil: 0, x2Until: 0,
    _r: {},
    start() {
      this.lives = this.MAX_LIVES; this.wave = 1; this.waveAcc = 0; this.survSec = 0; this.charge = 0;
      this.freezeUntil = 0; this.x2Until = 0; State.tempMult = 1; this._r = {};
      this.buildBar(); this.render();
    },
    setup() { if (this.wave >= 2) this._traps(Math.min(0.10, 0.02 * this.wave)); },
    frozen() { return performance.now() < this.freezeUntil; },
    x2Active() { return performance.now() < this.x2Until; },
    _emptyIdx() { const a = []; for (let i = 0; i < State.board.length; i++) if (State.board[i] === null && !State.tiles[i]) a.push(i); return a; },
    _filledIdx() { const a = []; for (let i = 0; i < State.board.length; i++) if (State.board[i] !== null && !State.tiles[i]) a.push(i); return a; },
    _traps(density) {
      const e = this._emptyIdx(); let n = Math.floor(e.length * density);
      for (let k = 0; k < n && e.length; k++) {
        const idx = e.splice(rand(e.length), 1)[0];
        if (Math.random() < 0.6) State.tiles[idx] = Tiles.make('rock');
        else { State.tiles[idx] = Tiles.make('frozen'); State.board[idx] = State.pool[rand(State.pool.length)]; State.iconCount++; }
      }
      Render.syncAll();
    },
    onTick(dt) {
      if (State.status !== 'playing') return;
      this.survSec = State.elapsed;
      if (this.x2Until && !this.x2Active()) { this.x2Until = 0; State.tempMult = 1; }
      this.waveAcc += dt;
      if (this.waveAcc >= this.WAVE_MS) { this.waveAcc -= this.WAVE_MS; this.newWave(); }
      this.render();
    },
    newWave() {
      this.wave++;
      State.spawnRate = Math.max(360, Math.round(State.spawnRate * 0.88));
      Toasts.show('🌊 ' + I18n.t('st_wave') + ' ' + this.wave, 'warn', 1400); Sound.danger();
      this._traps(Math.min(0.12, 0.02 * this.wave));
      if (this.wave % 4 === 0) this.bossEvent();
    },
    bossEvent() {
      if (rand(2) === 0) { for (let k = 0; k < 8; k++) Engine.spawnOne(); Render.syncAll(); Toasts.show('☄️ ¡Lluvia de iconos!', 'bad', 1800); }
      else { this._shuffle(); Toasts.show('🌀 ¡Terremoto!', 'bad', 1800); }
      Sound.fever(); Haptics.milestone();
    },
    _shuffle() {
      const idx = [], vals = [];
      for (let i = 0; i < State.board.length; i++) if (State.board[i] !== null && !State.tiles[i]) { idx.push(i); vals.push(State.board[i]); }
      for (let i = vals.length - 1; i > 0; i--) { const j = rand(i + 1); const t = vals[i]; vals[i] = vals[j]; vals[j] = t; }
      idx.forEach((p, k) => State.board[p] = vals[k]); Render.syncAll();
    },
    onConverge(removed, combo) { this.charge = Math.min(100, this.charge + this.CHARGE_PER + Math.min(combo || 0, 6)); this.render(); },
    onOverflow() {
      this.lives--;
      if (this.lives <= 0) { this.lastChance(); return; }
      Toasts.show('💔 -1 vida', 'bad', 1600); Sound.miss(); Haptics.error(); Render.boardShake();
      this._relief(0.4); this.render();
    },
    _relief(frac) {
      const f = this._filledIdx(); let n = Math.floor(f.length * frac);
      for (let k = 0; k < n && f.length; k++) { const idx = f.splice(rand(f.length), 1)[0]; FX.burst(idx, Icons.colorOf(State.board[idx]), 4); State.board[idx] = null; State.iconCount--; }
      Render.syncAll();
    },
    lastChance() {
      State.status = 'paused'; Loop.stop(); Music.stop(true);
      const cost = 120; const cc = $('#revive-cost'); if (cc) cc.textContent = cost;
      const rb = $('#btn-revive'); if (rb) rb.disabled = Meta.coins() < cost;
      Modal.open('modal-revive');
    },
    revive() {
      if (!Meta.spend(120)) { Toasts.show('Monedas insuficientes', 'warn', 1500); return; }
      this.lives = 1; this._relief(0.6);
      Modal.close(); State.status = 'playing'; Loop.start(); if (Settings.music) Music.start();
      Sound.success(); this.render();
    },
    giveUp() { Modal.close(); Game.gameOver(I18n.t('reason_surv').replace('{s}', Math.floor(this.survSec))); },
    useBooster(id) {
      if (this.charge < 100) { Toasts.show('Potenciador cargando…', 'warn', 1000); Sound.ui(); return; }
      this.charge = 0;
      if (id === 'bomb') this._bomb();
      else if (id === 'freeze') { this.freezeUntil = performance.now() + 6000; Toasts.show('❄️ Spawns congelados', 'info', 1500); }
      else if (id === 'x2') { this.x2Until = performance.now() + 10000; State.tempMult = 2; Toasts.show('⚡ ¡Puntos x2!', 'good', 1500); }
      else if (id === 'clearLine') this._clearLine();
      Sound.rank(); Haptics.combo(); this.render();
    },
    _bomb() {
      let best = 0, bestN = -1;
      for (let i = 0; i < 64; i++) { const r = i / 8 | 0, c = i % 8; let n = 0; for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { const rr = r + dr, cc = c + dc; if (rr >= 0 && cc >= 0 && rr < 8 && cc < 8 && State.board[rr * 8 + cc] !== null) n++; } if (n > bestN) { bestN = n; best = i; } }
      const r = best / 8 | 0, c = best % 8;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { const rr = r + dr, cc = c + dc; if (rr >= 0 && cc >= 0 && rr < 8 && cc < 8) { const j = rr * 8 + cc; if (State.board[j] !== null && !(State.tiles[j] && State.tiles[j].solid)) { FX.burst(j, Icons.colorOf(State.board[j]), 5); State.board[j] = null; State.iconCount--; if (State.tiles[j]) State.tiles[j] = null; } } }
      Render.syncAll(); Toasts.show('💣 ¡Boom!', 'good', 1300);
    },
    _clearLine() {
      const row = rand(8);
      for (let c = 0; c < 8; c++) { const j = row * 8 + c; if (State.board[j] !== null) { FX.burst(j, Icons.colorOf(State.board[j]), 4); State.board[j] = null; State.iconCount--; if (State.tiles[j] && !State.tiles[j].solid) State.tiles[j] = null; } }
      Render.syncAll(); Toasts.show('🧹 ¡Fila despejada!', 'good', 1300);
    },
    buildBar() {
      const el = $('#boosters'); if (!el) return;
      el.innerHTML = this.BOOSTERS.map((id) => { const d = Boosters.DEFS[id]; return `<button class="booster" data-b="${id}" aria-label="${d.name}"><span class="b-ic">${d.glyph}</span></button>`; }).join('');
      el.querySelectorAll('.booster').forEach((b) => b.addEventListener('click', () => this.useBooster(b.dataset.b)));
    },
    render() {
      const r = this._r;
      if (r.lives !== this.lives) { r.lives = this.lives; const lv = $('#surv-lives'); if (lv) lv.textContent = this.lives > 0 ? '❤️'.repeat(this.lives) : '💀'; }
      if (r.wave !== this.wave) { r.wave = this.wave; const w = $('#surv-wave'); if (w) w.textContent = I18n.t('st_wave') + ' ' + this.wave; }
      const sec = Math.floor(this.survSec); if (r.sec !== sec) { r.sec = sec; const t = $('#surv-time'); if (t) t.textContent = sec + 's'; }
      const ch = Math.round(this.charge); if (r.charge !== ch) { r.charge = ch; const cf = $('#charge-fill'); if (cf) cf.style.width = ch + '%'; }
      const ready = this.charge >= 100; if (r.ready !== ready) { r.ready = ready; const bb = $('#booster-bar'); if (bb) bb.classList.toggle('ready', ready); }
    },
  };

  /* ===================== Rules (hooks por modo) =====================
   * Punto de extensión: un modo puede definir funciones (onSetupLevel, onTick,
   * onActivate, winCheck, loseCheck, objective...) en su descriptor de Config.MODES
   * y Game/Loop las invocan si existen. Sin hooks => comportamiento clásico.
   */
  const Rules = {
    call(name, ctx) {
      const mode = Config.MODES[State.mode];
      const fn = mode && mode[name];
      return typeof fn === 'function' ? fn(ctx) : undefined;
    },
  };

  /* ===================== PWA (instalable + offline + actualización) ===================== */
  const PWA = {
    deferredPrompt: null,
    init() {
      if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
          navigator.serviceWorker.register('sw.js').then((reg) => {
            reg.addEventListener('updatefound', () => {
              const nw = reg.installing; if (!nw) return;
              nw.addEventListener('statechange', () => {
                if (nw.state === 'installed' && navigator.serviceWorker.controller) {
                  Toasts.show('✨ Nueva versión lista — reábrela para actualizar', 'info', 5000);
                }
              });
            });
          }).catch((e) => ErrLog.push('sw', e && e.message));
        });
      }
      // Captura del prompt de instalación para ofrecer "Instalar" en el menú.
      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault(); this.deferredPrompt = e;
        const btn = $('#btn-install'); if (btn) btn.hidden = false;
      });
      window.addEventListener('appinstalled', () => {
        this.deferredPrompt = null; const btn = $('#btn-install'); if (btn) btn.hidden = true;
      });
    },
    promptInstall() {
      const e = this.deferredPrompt; if (!e) { Toasts.show('Usa el menú del navegador para instalar', 'info', 2600); return; }
      e.prompt(); e.userChoice.finally(() => { this.deferredPrompt = null; const btn = $('#btn-install'); if (btn) btn.hidden = true; });
    },
  };

  /* ===================== Share (tarjeta de resultado + Web Share API) =====================
   * Genera una imagen (canvas fuera del DOM -> blob, sin riesgo de compositing) y la
   * comparte con navigator.share; si no hay soporte, descarga la imagen.
   */
  const Share = {
    card() {
      const W = 600, H = 600, c = document.createElement('canvas'); c.width = W; c.height = H;
      const x = c.getContext('2d');
      const g = x.createRadialGradient(W / 2, H * 0.34, 30, W / 2, H * 0.4, W);
      g.addColorStop(0, '#1a2a5e'); g.addColorStop(1, '#070b1c'); x.fillStyle = g; x.fillRect(0, 0, W, H);
      x.textAlign = 'center';
      // Deco: 4 figuras del juego
      const C = ['#ff5b6e', '#4b8bff', '#3ad07f', '#ffd23f'];
      C.forEach((col, i) => { x.fillStyle = col; x.beginPath(); x.arc(150 + i * 100, 90, 16, 0, 6.283); x.fill(); });
      x.fillStyle = '#eaf0ff'; x.font = '800 52px system-ui,-apple-system,sans-serif'; x.fillText('Convergencia', W / 2, 185);
      x.fillStyle = '#9fb0e0'; x.font = '600 26px system-ui,sans-serif'; x.fillText('Modo ' + Config.MODES[State.mode].name, W / 2, 228);
      x.fillStyle = '#18e6e6'; x.font = '900 150px system-ui,sans-serif'; x.fillText(String(State.score), W / 2, 380);
      x.fillStyle = '#9fb0e0'; x.font = '600 28px system-ui,sans-serif'; x.fillText('PUNTOS', W / 2, 420);
      x.fillStyle = '#ffd84d'; x.font = '800 36px system-ui,sans-serif'; x.fillText('Combo ×' + State.maxCombo + '  ·  ' + Meta.rank(), W / 2, 490);
      x.fillStyle = '#6c7bff'; x.font = '600 26px system-ui,sans-serif'; x.fillText('¿Puedes superarlo?', W / 2, 545);
      return new Promise((res) => c.toBlob(res, 'image/png'));
    },
    async go() {
      try {
        const blob = await this.card();
        const text = `¡${State.score} puntos en Convergencia (${Config.MODES[State.mode].name})! Combo ×${State.maxCombo}. ¿Puedes superarlo?`;
        const file = blob ? new File([blob], 'convergencia.png', { type: 'image/png' }) : null;
        if (file && navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text, title: 'Convergencia' }); return; }
        if (navigator.share) { await navigator.share({ text, title: 'Convergencia' }); return; }
        if (blob) { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'convergencia.png'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 2000); Toasts.show('Imagen guardada 📥', 'good', 1800); }
      } catch (e) { if (e && e.name === 'AbortError') return; ErrLog.push('share', e && e.message); Toasts.show('No se pudo compartir', 'warn', 1800); }
    },
  };

  /* ===================== Coach (tutorial interactivo, coach-marks) =====================
   * Secuencia guiada con tableros deterministas: el jugador realiza sus primeras
   * convergencias reales (mismo motor/feedback) con una casilla resaltada y texto.
   * Se auto-lanza en el primer arranque y es rejugable desde "¿Cómo se juega?".
   */
  const Coach = {
    active: false, step: 0, target: -1,
    STEPS: [
      {
        text: '👆 Toca la casilla VACÍA que brilla, entre dos iconos iguales, para juntarlos.',
        build() { State.board[26] = 'circle_red'; State.board[28] = 'circle_red'; State.iconCount = 2; return 27; },
      },
      {
        text: '✨ ¡Eso es! Si coinciden en varias direcciones, eliminas más de golpe. Encadénalas rápido para subir el combo.',
        build() { State.board[19] = 'star_yellow'; State.board[35] = 'star_yellow'; State.board[26] = 'star_yellow'; State.board[28] = 'star_yellow'; State.iconCount = 4; return 27; },
      },
    ],
    start() {
      this.active = true; this.step = 0; this.target = -1;
      Loop.stop(); Music.stop(true);
      State.mode = 'tutorial'; State.diff = 'facil'; State.level = 1;
      State.score = 0; State.displayScore = 0; State.combo = 0; State.comboMult = 1; State.comboAt = 0;
      State.maxCombo = 0; State.removedTotal = 0; State.mistakes = 0; State.elapsed = 0; State.timeLeft = 0;
      State.fever = false; State.recordHit = false;
      Render.fever(false); Render.danger(0);
      Game.ended = false; State.status = 'playing';
      Screens.show('game'); FX.resize();
      $('#coach').hidden = false;
      this._render();
    },
    _render() {
      const s = this.STEPS[this.step];
      State.board = new Array(State.size * State.size).fill(null);
      State.tiles = new Array(State.size * State.size).fill(null);
      State.iconCount = 0; State.combo = 0; State.comboMult = 1;
      this.target = s.build();
      State.displayScore = State.score;
      Render.syncAll(); Render.combo(); Render.hud();
      Render.hint([this.target], true);
      $('#coach-text').textContent = s.text;
    },
    notify() {
      if (!this.active) return;
      if (this.target >= 0) { Render.hint([this.target], false); this.target = -1; }
      this.step++;
      if (this.step >= this.STEPS.length) { setTimeout(() => this.finish(), 950); return; }
      setTimeout(() => { State.displayScore = State.score; this._render(); }, 800);
    },
    finish() {
      if (!this.active) return;
      this.active = false;
      if (this.target >= 0) { Render.hint([this.target], false); this.target = -1; }
      $('#coach').hidden = true;
      State.status = 'idle'; Game.ended = true;
      Storage.tutorialDone = true;
      Toasts.show('¡Listo! Ya sabes jugar 🎉', 'good', 2400);
      refreshStart(); Screens.show('start');
    },
    skip() { this.finish(); },
  };

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
      if (L.ema > 22 && FX.cap > 18) FX.cap -= 6;
      else if (L.ema < 17 && FX.cap < 50) FX.cap += 3;

      if (State.status === 'playing') {
        L.clockAcc += dt;
        if (L.clockAcc >= 1000) {
          const secs = Math.floor(L.clockAcc / 1000); L.clockAcc -= secs * 1000;
          State.elapsed += secs;
          if (Config.MODES[State.mode].timed) {
            State.timeLeft -= secs;
            if (State.timeLeft <= 0) { State.timeLeft = 0; Render.hud(); Game.gameOver(I18n.t('reason_time')); }
          }
          // Aventura: revisar objetivos por tiempo (sobrevivir) cada segundo.
          if (State.mode === 'aventura' && State.status === 'playing') Game.evaluate();
          Render.hud();
        }
        L.spawnAcc += dt;
        if (L.spawnAcc >= State.spawnRate) { L.spawnAcc -= State.spawnRate; Game.doSpawn(); }
        if (State.combo > 0) {
          const left = State.comboWindow - (now - State.comboAt);
          if (left <= 0) Game.resetCombo();
          else Render.comboRing(left / State.comboWindow);
        }
        // Hook de modo por frame (oleadas/jefes/eventos de Aventura y Supervivencia)
        Rules.call('onTick', dt);
        // HUD coalescido: como máximo una actualización por frame
        if (Render._hudDirty) { Render._hudDirty = false; Render.hud(); }
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
      State.tiles = new Array(State.size * State.size).fill(null);
      State.iconCount = 0;
      State.combo = 0; State.comboMult = 1;
      Engine.placeInitial(Config.DIFFICULTY[State.diff].initialIcons);
      // Hook de modo: permite a Aventura/Supervivencia sembrar tiles/objetivos.
      Rules.call('onSetupLevel', { level: State.level, mode: m });
      Render.syncAll();
      Render.combo();
      Render.hud();
    },

    start(mode, diff) {
      State.mode = mode;
      State.diff = Config.MODES[mode].fixedDiff || diff;
      State.score = 0; State.displayScore = 0; State.level = 1; State.elapsed = 0; State.timeLeft = 0;
      State.combo = 0; State.comboMult = 1; State.comboAt = 0;
      State.maxCombo = 0; State.removedTotal = 0; State.mistakes = 0; State.coinsRun = 0; State.tempMult = 1;
      State.fever = false; State.feverEver = false; State.perfectEver = false; State.recordHit = false;
      State.status = 'playing'; this.ended = false;
      // Aventura: reanuda en el nivel más lejano alcanzado; el resto empieza en 1.
      if (mode === 'aventura') State.level = Meta.advMax();
      // Supervivencia 2.0: vidas, oleadas, boosters.
      const isSurv = mode === 'supervivencia';
      document.body.classList.toggle('mode-surv', isSurv);
      { const sb = $('#surv-bar'); if (sb) sb.hidden = !isSurv; const bb = $('#booster-bar'); if (bb) bb.hidden = !isSurv; }
      if (isSurv) Survival.start();
      Render.fever(false); Render.danger(0);
      this.clearHintHighlight();
      this.setupLevel();
      this.showGoalBanner();
      Render.combo();
      Screens.show('game');
      FX.resize();
      Loop.start();
      if (Settings.music) Music.start();
      announce(`Partida iniciada. Modo ${Config.MODES[mode].name}.`);
      Toasts.show(I18n.t('lets_play'), 'good', 1400);
    },

    restart() { if (Coach.active) return Coach.skip(); Modal.close(); this.start(State.mode, State.diff); },
    quit() { if (Coach.active) return Coach.skip(); Loop.stop(); Music.stop(); State.status = 'idle'; Modal.close(); document.body.classList.remove('mode-surv'); this.clearHintHighlight(); refreshStart(); Screens.show('start'); },

    pause() {
      if (Coach.active) return Coach.skip();
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
      const ti = State.tiles[i];
      // Casilla helada: tocar para descongelar (no es un error).
      if (ti && ti.type === 'frozen') {
        ti.taps = (ti.taps || 2) - 1;
        if (ti.taps <= 0) { State.tiles[i] = null; Sound.success(); } else Sound.tap();
        Render.setTile(i); Render.syncCell(i); Haptics.tap(); return;
      }
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

      // Color por tier de combo (blanco→teal→morado→rosa→oro). Se calcula aquí
      // para tintar la animación de estrellas y se reutiliza en popup/rango.
      const color = State.comboMult >= 8 ? '#ffd84d' : State.comboMult >= 5 ? '#ff5cf0' : State.comboMult >= 3 ? '#b46cff' : State.comboMult >= 2 ? '#00d0ff' : State.comboMult >= 1.5 ? '#34e29b' : '#fff';

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
      const points = Math.floor(base * State.comboMult * d.scoreMult * m.mult * (State.fever ? Config.FEVER_BOOST : 1) * (State.tempMult || 1));
      State.score += points;
      if (Config.MILESTONES[State.combo]) { State.score += Config.MILESTONES[State.combo]; Toasts.show(`¡Combo ×${State.combo}! +${Config.MILESTONES[State.combo]}`, 'good'); Sound.milestone(); Haptics.milestone(); }

      // Contrarreloj: bonus de tiempo por convergencia (los combos suman más)
      if (m.timed) { const bonus = Math.max(5, removed * 3) + Math.min(State.combo, 6); State.timeLeft += bonus; Toasts.show(`+${bonus}s`, 'info', 1100); }

      // Estrellas de convergencia: estrella en la casilla central + una estrella
      // sobre cada icono eliminado + camino de estrellitas, TODO sincronizado con
      // la desaparición de los iconos (glyph-out). Se lanza en el mismo frame que
      // Render.clearAnim para que empiecen y terminen exactamente a la vez.
      FX.converge(i, conv, color);

      // Aplicar al tablero (limpia también la casilla especial; cristal = bonus)
      conv.forEach(idx => {
        const t = State.tiles[idx];
        if (t) { if (t.type === 'crystal') State.score += 50; State.tiles[idx] = null; }
        State.board[idx] = null; State.iconCount--;
      });
      Render.clearAnim(conv);
      conv.forEach(idx => { Render.setTile(idx); Render.cells[idx].setAttribute('aria-label', Render.cellLabel(idx)); });

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

      Render.hudSoon();
      announce(`+${points} puntos.${State.combo >= 3 ? ' Combo ' + State.combo + '.' : ''}`);
      if (Coach.active) { Coach.notify(); return; }
      Rules.call('onConverge', { removed, combo: State.combo });
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
      if (Rules.call('blockSpawn')) return;   // potenciador de congelación (Supervivencia)
      const idx = Engine.spawnOne();
      if (idx < 0) { // tablero lleno
        if (Config.MODES[State.mode].endless) { Rules.call('onOverflow'); return; }
        this.evaluate(); return;
      }
      Render.syncCell(idx); Render.spawnAnim(idx);
      // Aceleración progresiva suave dentro del nivel
      State.spawnRate = Math.max(Config.DIFFICULTY[State.diff].spawnMin, State.spawnRate - 6);
      Render.hudSoon();
      this.evaluate();
    },

    // Limpieza suave de una fracción de iconos (Zen: respiro sin fin de partida).
    softClear(frac) {
      const f = [];
      for (let i = 0; i < State.board.length; i++) if (State.board[i] !== null && !State.tiles[i]) f.push(i);
      let n = Math.floor(f.length * frac);
      for (let k = 0; k < n && f.length; k++) { const idx = f.splice(rand(f.length), 1)[0]; FX.burst(idx, Icons.colorOf(State.board[idx]), 4); State.board[idx] = null; State.iconCount--; }
      Render.syncAll();
    },

    // Banner de objetivo/identidad por modo (Aventura y Supervivencia usan su propia UI).
    showGoalBanner() {
      const el = $('#obj-banner'); if (!el) return;
      if (State.mode === 'aventura') return;            // lo gestiona Adventure.banner
      const m = Config.MODES[State.mode];
      if (State.mode === 'supervivencia' || !m.goal) { el.hidden = true; el.style.borderColor = ''; return; }
      el.hidden = false;
      el.style.borderColor = m.accent || '';
      el.innerHTML = `<span class="obj-biome" style="color:${m.accent || 'var(--accent-2)'}">${m.emoji} ${I18n.modeT(State.mode, 'name')}</span><span class="obj-goal">${I18n.modeT(State.mode, 'goal')}</span>`;
    },

    /* Win/Lose: se evalúa tras cada cambio del tablero */
    evaluate() {
      if (State.status !== 'playing' || Coach.active) return;
      // Hooks de modo: pueden forzar victoria/derrota propias (objetivos, oleadas…).
      // Devuelven 'win' | 'lose' | un texto de derrota, o nada para usar la regla base.
      const wc = Rules.call('winCheck', State);
      if (wc) { this.levelComplete(wc === 'perfect'); return; }
      const lc = Rules.call('loseCheck', State);
      if (lc) { this.gameOver(typeof lc === 'string' ? lc : I18n.t('reason_end')); return; }
      // Modos infinitos (Supervivencia): la victoria/derrota la gestionan sus hooks.
      if (Config.MODES[State.mode].endless) return;
      if (State.iconCount === 0) { this.levelComplete(true); return; }
      if (!Engine.hasMoves()) {
        const occ = Engine.occupation();
        if (occ <= Config.WIN_OCCUPATION) this.levelComplete(false);
        else this.gameOver(I18n.t('reason_nomoves').replace('{n}', Math.round(occ)));
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

      const next = State.level + 1;
      // Acento del modal: color del bioma siguiente (Aventura) o del modo.
      const accent = State.mode === 'aventura' ? Adventure.biomeOf(next).accent : (m.accent || '#00d0ff');
      const modal = $('#modal-level'); if (modal) modal.style.setProperty('--modal-accent', accent);
      const emb = $('#level-emblem'); if (emb) emb.textContent = perfect ? '✨' : (State.mode === 'aventura' ? Adventure.biomeOf(State.level).glyph : (m.emoji || '⭐'));

      $('#level-title').textContent = perfect ? I18n.t('perfect_done') : I18n.t('level_done');
      $('#level-sub').textContent = perfect
        ? I18n.t('perfect_sub').replace('{b}', Config.EMPTY_BOARD_BONUS)
        : I18n.t('level_sub').replace('{n}', State.level);

      // Resumen de la partida hasta ahora (chips premium)
      $('#level-stats').innerHTML = statRow([
        [State.score, I18n.t('st_points'), 'var(--score)'],
        ['×' + State.maxCombo, I18n.t('st_combo'), 'var(--gold)'],
        [State.removedTotal, I18n.t('st_removed'), 'var(--good)'],
      ]);

      // Preview coherente del siguiente nivel (iconos que vienen + deltas + objetivo)
      $('#level-next').innerHTML = this._nextPreview(next, m);
      $('#btn-next-level').textContent = I18n.t('next_to').replace('{n}', next);

      Modal.open('modal-level');
      announce(`Nivel ${State.level} completado. ${State.score} puntos. Siguiente: nivel ${next}.`);
    },

    // Construye el HTML del preview del siguiente nivel, consciente del modo.
    _nextPreview(next, m) {
      const pool = Engine.poolForLevel(next);
      const curSpawn = Engine.spawnRateForLevel(State.level) / 1000, nxtSpawn = Engine.spawnRateForLevel(next) / 1000;
      const curVar = Engine.poolForLevel(State.level).length, nxtVar = pool.length;
      const icons = pool.map(id => `<span class="ic-chip" title="${Icons.name(id)}">${Icons.svg(id)}</span>`).join('');
      let head, extra = '';
      if (State.mode === 'aventura') {
        const bi = Adventure.biomeOf(next), ch = Adventure.chapterOf(next), boss = Adventure.isBoss(next);
        const newChapter = ch !== Adventure.chapterOf(State.level);
        head = `${bi.glyph} ${I18n.t('chapter')} ${ch + 1} · ${Adventure.biomeName(bi)}`;
        extra = `<div class="m-goal${boss ? ' boss' : ''}">${boss ? '⚠️ ' : '🎯 '}${Adventure.previewObjective(next)}</div>`;
        if (newChapter && bi.mods.length) extra += `<div class="m-mod">${Adventure.biomeModText(bi)}</div>`;
      } else {
        head = `${I18n.t('next')} · ${I18n.t('lvl')} ${next}`;
      }
      let deltas = `<span class="delta">⚡ ${curSpawn.toFixed(1)}s → <strong>${nxtSpawn.toFixed(1)}s</strong></span>` +
        `<span class="delta">🎲 ${curVar} → <strong>${nxtVar}</strong></span>`;
      if (m.timed) { const nt = Math.max(Config.TIMED_MIN, Config.TIMED_DURATION - (next - 1) * Config.TIMED_DECREASE); deltas += `<span class="delta">⏱️ <strong>${fmtTime(nt)}</strong></span>`; }
      return `<div class="m-card-h">${head}</div>` +
        `<div class="ic-label">${I18n.t('new_icons')}</div>` +
        `<div class="ic-row">${icons}</div>` +
        `<div class="deltas">${deltas}</div>${extra}`;
    },

    nextLevel() {
      const prevChapter = State.mode === 'aventura' ? Adventure.chapterOf(State.level) : -1;
      State.level++;
      State.status = 'playing';
      Modal.close();
      this.setupLevel(); // tablero fresco con la variedad/velocidad/tiempo del nuevo nivel
      // El bucle se detuvo al mostrarse el modal (status != playing); hay que reiniciarlo.
      Loop.start();
      if (State.mode === 'aventura') {
        Meta.advReach(State.level);
        const ch = Adventure.chapterOf(State.level);
        if (ch !== prevChapter) { const bi = Adventure.biomeOf(State.level); Toasts.show(`${I18n.t('chapter')} ${ch + 1}: ${Adventure.biomeName(bi)}`, 'good', 2200, bi.glyph); }
        else Toasts.show(`${I18n.t('lvl')} ${State.level}`, 'info', 1200);
      } else {
        Toasts.show(`${I18n.t('lvl')} ${State.level}`, 'info', 1400);
      }
    },

    // Aplica emblema y color de acento al modal de fin de partida.
    _overChrome(emoji, accent) {
      const e = $('#over-emblem'); if (e) e.textContent = emoji;
      const mo = $('#modal-over'); if (mo) mo.style.setProperty('--modal-accent', this.newRecord || this._survNew ? 'var(--gold)' : accent);
    },

    win(reason) {
      this.endGame();
      Sound.level(); Haptics.level(); FX.confetti(110);
      $('#over-title').textContent = I18n.t('over_victory');
      this._overChrome('🏆', 'var(--gold)');
      $('#over-reason').textContent = reason;
      this.fillStats(); Modal.open('modal-over');
      announce(`¡Victoria! Puntuación ${State.score}.`);
    },

    gameOver(reason) {
      if (this.ended) return;
      // Supervivencia: registra el récord de tiempo sobrevivido.
      this._survNew = false;
      if (State.mode === 'supervivencia') { this._survNew = Meta.survRecord(Survival.survSec); document.body.classList.remove('mode-surv'); }
      this.endGame();
      Sound.over(); Haptics.error(); Render.boardShake();
      const m = Config.MODES[State.mode];
      $('#over-title').textContent = State.mode === 'supervivencia' ? I18n.t('over_surv') : I18n.t('over_fail');
      this._overChrome(State.mode === 'supervivencia' ? '🛡️' : (m.emoji || '🏁'), m.accent || '#ff5d73');
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
      $('#over-record').hidden = !this.newRecord && !this._survNew;
      if (this._survNew) { const rec = $('#over-record'); if (rec) rec.textContent = '🛡️ ¡Récord de supervivencia!'; }
      const m = Config.MODES[State.mode], d = Config.DIFFICULTY[State.diff];
      // Resumen coherente por modo
      let summary;
      if (State.mode === 'supervivencia') summary = I18n.t('sum_wave').replace('{w}', Survival.wave).replace('{s}', Math.floor(Survival.survSec));
      else if (State.mode === 'aventura') summary = I18n.t('sum_chapter').replace('{c}', Adventure.chapterOf(State.level) + 1).replace('{n}', State.level);
      else if (m.timed) summary = I18n.t('sum_time').replace('{t}', fmtTime(State.elapsed));
      else summary = I18n.t('sum_level').replace('{n}', State.level);
      $('#over-meta').textContent = `${I18n.modeT(State.mode, 'name')} · ${I18n.t('diff_' + State.diff)} · ${summary}`;
      const rows = State.mode === 'supervivencia' ? [
        [State.score, I18n.t('st_points'), 'var(--score)'],
        [Survival.wave, I18n.t('st_wave'), 'var(--level)'],
        ['×' + State.maxCombo, I18n.t('st_combo'), 'var(--gold)'],
        [State.removedTotal, I18n.t('st_removed'), 'var(--good)'],
        [Math.floor(Survival.survSec) + 's', I18n.t('st_surv'), 'var(--time)'],
        [Meta.survBest() + 's', I18n.t('st_best'), 'var(--gold)'],
      ] : [
        [State.score, I18n.t('st_points'), 'var(--score)'],
        [State.level, I18n.t('st_level'), 'var(--level)'],
        ['×' + State.maxCombo, I18n.t('st_combo'), 'var(--gold)'],
        [State.removedTotal, I18n.t('st_removed'), 'var(--good)'],
        [fmtTime(State.elapsed), I18n.t('st_time'), 'var(--time)'],
        [Storage.best, I18n.t('st_record'), 'var(--gold)'],
      ];
      $('#over-stats').innerHTML = statRow(rows);
      // Progresión: XP ganada, barra de perfil, misión y logros nuevos
      const r = this.metaResult || { xpGained: 0, coinsGained: 0, leveledUp: 0, newAch: [], missionDone: false };
      const lvl = Meta.level(), need = Meta.xpForLevel(lvl), have = Meta.xp();
      $('#over-xp').innerHTML =
        `<div class="xp-line"><span class="xp-gain">+${r.xpGained} XP</span><span class="xp-coins">🪙 +${r.coinsGained || 0}</span><span class="xp-rank">${Meta.rank()} · ${I18n.t('lvl')} ${lvl}</span></div>` +
        `<div class="xpbar"><div class="xpbar-fill" style="width:${Math.min(100, have / need * 100).toFixed(0)}%"></div></div>` +
        (r.leveledUp ? `<div class="xp-up">⬆️ ${I18n.t('lvl')} ${lvl}!</div>` : '') +
        (r.missionDone ? `<div class="mission-done">✅ ${I18n.t('daily_done')} · +150 XP</div>` : '') +
        (r.weeklyDone ? `<div class="mission-done">🗓️ ${I18n.t('weekly_done')} · +400 XP</div>` : '');
      countUp($('#over-xp .xp-gain'), r.xpGained, 700, '+', ' XP');
      countUp($('#over-xp .xp-coins'), r.coinsGained || 0, 700, '🪙 +', '');
      $('#over-ach').innerHTML = r.newAch.length
        ? '<div class="ach-new">🏅 ' + r.newAch.map(a => a.name).join(' · ') + '</div>' : '';
      if (r.leveledUp) { setTimeout(() => { Sound.record(); FX.confetti(60); }, 350); }
      if (r.newAch.length) { setTimeout(() => { Sound.milestone(); Toasts.show(I18n.t('ach_unlocked').replace('{n}', r.newAch[0].name), 'good', 2400); }, 600); }
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
      b.innerHTML = `<span class="emoji" aria-hidden="true">${m.emoji}</span><span class="name">${I18n.modeT(key, 'name')}</span>`;
      b.addEventListener('click', () => selectMode(key));
      grid.appendChild(b);
    });
    const row = $('#diff-row'); row.innerHTML = '';
    Config.DIFF_ORDER.forEach(key => {
      const b = document.createElement('button');
      b.className = 'diff-chip'; b.type = 'button';
      b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(key === selDiff));
      b.dataset.diff = key; b.textContent = I18n.t('diff_' + key);
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
    $('#mode-desc').textContent = I18n.modeT(selMode, 'desc') + (fixed ? ' (' + I18n.t('diff_' + m.fixedDiff) + ')' : '');
    $('#btn-start-game').disabled = false;
  }

  function refreshStart() {
    $('#start-best').textContent = Storage.best;
    const sw = $('#btn-sound'); if (sw) sw.setAttribute('aria-checked', String(Settings.sfx));
    const br = $('#btn-reward'); if (br) br.hidden = !Meta.rewardReady();
    const el = $('#start-meta');
    if (el) {
      const esc = (s) => String(s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
      const prof = Storage.profile || { name: 'Jugador', color: '#00d0ff' };
      const lvl = Meta.level(), need = Meta.xpForLevel(lvl), have = Meta.xp(), dm = Meta.dailyMission(), wk = Meta.weeklyChallenge();
      const prog = dm.done ? '✅' : `${Math.min(dm.progress || 0, dm.target)}/${dm.target}`;
      const wprog = wk.done ? '✅' : `${Math.min(wk.progress || 0, wk.target)}/${wk.target}`;
      el.innerHTML =
        `<div class="profile">
          <div class="profile-id"><span class="avatar-dot mini" style="--av:${esc(prof.color)}"></span><span class="pname">${esc(prof.name)}</span><span class="coins" title="Monedas">🪙 ${Meta.coins()}</span></div>
          <div class="profile-top"><span class="rank">${Meta.rank()}</span><span class="plevel">${I18n.t('lvl')} ${lvl}</span><span class="streak" title="Racha diaria">🔥 ${Meta.streak()}</span></div>
          <div class="xpbar"><div class="xpbar-fill" style="width:${Math.min(100, have / need * 100).toFixed(0)}%"></div></div>
          <div class="xp-sub">${have} / ${need} XP</div>
        </div>
        <div class="daily ${dm.done ? 'done' : ''}"><span class="daily-icon">🎯</span><span class="daily-text">${dm.done ? I18n.t('daily_done') : dm.text}</span><span class="daily-prog">${prog}</span></div>
        <div class="daily weekly ${wk.done ? 'done' : ''}"><span class="daily-icon">🗓️</span><span class="daily-text">${wk.done ? I18n.t('weekly_done') : wk.text}</span><span class="daily-prog">${wprog}</span></div>`;
    }
  }

  function applyReducedFx() {
    document.body.classList.toggle('reduced-fx', Settings.reducedFx);
  }
  function applyLargeText() {
    document.documentElement.style.fontSize = Settings.largeText ? '18.5px' : '';
    document.body.classList.toggle('large-text', Settings.largeText);
  }
  // Aplica el idioma: re-traduce el HTML estático y reconstruye lo dinámico.
  function applyLanguage() {
    I18n.apply();
    buildModeMenu(); refreshStart(); buildSettings();
    if (State.status === 'playing' || State.status === 'paused') Game.showGoalBanner();
  }

  // Panel de ajustes (toggles persistentes)
  function buildSettings() {
    const rows = [
      { k: 'sfx', label: I18n.t('set_sfx') },
      { k: 'music', label: I18n.t('set_music') },
      { k: 'haptics', label: I18n.t('set_haptics'), show: Haptics.ok },
      { k: 'reducedFx', label: I18n.t('set_reduced') },
      { k: 'largeText', label: I18n.t('set_large') },
    ];
    const list = $('#settings-list'); if (!list) return;
    let html = rows.filter(r => r.show !== false).map(r =>
      `<div class="set-row"><span>${r.label}</span><button class="switch" role="switch" data-set="${r.k}" aria-checked="${Settings[r.k]}" aria-label="${r.label}"><span class="switch-dot"></span></button></div>`
    ).join('');
    html += `<div class="set-row"><span>${I18n.t('set_lang')}</span><div class="lang-pick">` +
      `<button class="lang-btn${Settings.lang !== 'en' ? ' on' : ''}" data-lang="es">ES</button>` +
      `<button class="lang-btn${Settings.lang === 'en' ? ' on' : ''}" data-lang="en">EN</button></div></div>`;
    list.innerHTML = html;
    list.querySelectorAll('[data-set]').forEach(btn => btn.addEventListener('click', () => {
      const k = btn.dataset.set; Settings[k] = !Settings[k]; btn.setAttribute('aria-checked', String(Settings[k]));
      if (k === 'sfx' && Settings.sfx) { Sound.ensure(); Sound.ui(); }
      if (k === 'music') { Settings.music && State.status === 'playing' ? Music.start() : Music.stop(); }
      if (k === 'reducedFx') applyReducedFx();
      if (k === 'largeText') applyLargeText();
      const sw = $('#btn-sound'); if (sw) sw.setAttribute('aria-checked', String(Settings.sfx));
    }));
    list.querySelectorAll('[data-lang]').forEach(btn => btn.addEventListener('click', () => {
      if (Settings.lang === btn.dataset.lang) return; Settings.lang = btn.dataset.lang; Sound.ui(); applyLanguage();
    }));
  }
  function openSettings() { buildSettings(); Modal.open('modal-settings'); }

  function openMedals() {
    // Estadísticas de por vida
    const st = Meta.stats();
    const sEl = $('#profile-stats');
    if (sEl) sEl.innerHTML = statRow([
      [st.games, I18n.t('st_games'), 'var(--accent-2)'],
      ['×' + st.bestCombo, I18n.t('st_bestcombo'), 'var(--gold)'],
      [st.totalRemoved, I18n.t('st_removed'), 'var(--good)'],
      [fmtTime(st.totalTime), I18n.t('st_totaltime'), 'var(--time)'],
    ]);
    // Leaderboard local por modo (mejor marca)
    const lbEl = $('#profile-lb');
    if (lbEl) {
      const rows = Config.MODE_ORDER.filter(k => k !== 'tutorial').map(k => {
        const mo = Config.MODES[k];
        const best = k === 'supervivencia' ? (Meta.survBest() + 's') : Meta.modeBest(k);
        const plays = Meta.modePlays(k);
        return `<div class="lb-row"><span class="lb-mode">${mo.emoji} ${I18n.modeT(k, 'name')}</span><span class="lb-best">${best}</span><span class="lb-plays">${plays}</span></div>`;
      }).join('');
      lbEl.innerHTML = rows;
    }
    // Logros
    const list = $('#medals-list');
    if (list) list.innerHTML = Meta.achievements().map(a =>
      `<div class="medal ${a.unlocked ? 'on' : ''}"><span class="medal-ic">${a.unlocked ? '🏅' : '🔒'}</span><span class="medal-tx"><strong>${a.name}</strong><small>${a.desc}</small></span></div>`
    ).join('');
    Modal.open('modal-medals');
  }

  // Tienda de temas (compra/equipa con monedas; previsualización en vivo)
  function buildShop() {
    const list = $('#shop-list'); if (!list) return;
    const co = $('#shop-coins'); if (co) co.textContent = Meta.coins();
    const cur = Meta.cosmetics().theme;
    list.innerHTML = Themes.order.map((id) => {
      const t = Themes.DEFS[id], owned = Meta.owns(id), eq = cur === id;
      const btn = eq ? `<button class="btn btn-ghost" disabled>Equipado</button>`
        : owned ? `<button class="btn btn-primary" data-equip="${id}">Equipar</button>`
        : `<button class="btn btn-primary" data-buy="${id}">🪙 ${t.cost}</button>`;
      return `<div class="shop-item${eq ? ' on' : ''}" data-theme="${id}" role="button" tabindex="0"><span class="shop-sw" style="background:${Themes.swatch(id)}"></span><span class="shop-name">${t.name}</span>${btn}</div>`;
    }).join('');
    list.querySelectorAll('.shop-item').forEach((it) => it.addEventListener('click', () => Cosmetics.previewTheme(it.dataset.theme)));
    list.querySelectorAll('[data-buy]').forEach((b) => b.addEventListener('click', (e) => {
      e.stopPropagation(); const id = b.dataset.buy;
      if (Meta.buy(id, Themes.DEFS[id].cost)) { Sound.success(); Meta.equip('theme', id); Cosmetics.apply(); refreshStart(); buildShop(); Toasts.show('¡Tema desbloqueado!', 'good', 1600); }
      else { Sound.miss(); Toasts.show('Monedas insuficientes', 'warn', 1600); }
    }));
    list.querySelectorAll('[data-equip]').forEach((b) => b.addEventListener('click', (e) => {
      e.stopPropagation(); Meta.equip('theme', b.dataset.equip); Cosmetics.apply(); Sound.ui(); refreshStart(); buildShop();
    }));
  }
  function openShop() { buildShop(); Modal.open('modal-shop'); }

  // Mapa de capítulos de Aventura (nodos hasta el capítulo alcanzado + el siguiente)
  function buildAdventureMap() {
    const wrap = $('#adventure-map'); if (!wrap) return;
    const max = Meta.advMax(), curCh = Adventure.chapterOf(max);
    let html = '';
    for (let ch = 0; ch <= curCh + 1; ch++) {
      const bi = Adventure.BIOMES[ch % Adventure.BIOMES.length];
      const cls = ch < curCh ? 'done' : (ch === curCh ? 'cur' : 'next');
      if (ch > 0) html += '<span class="adv-link"></span>';
      html += `<div class="adv-node ${cls}"><span class="adv-glyph">${bi.glyph}</span><span class="adv-name">Cap. ${ch + 1}<small>${bi.name}</small></span></div>`;
    }
    wrap.innerHTML = html;
    const btn = $('#adventure-continue');
    if (btn) btn.textContent = max > 1 ? `Continuar · Nivel ${max}` : 'Empezar la aventura';
  }
  function claimDailyReward() {
    if (!Meta.rewardReady()) return;
    const amt = Meta.claimReward();
    Sound.success(); FX.confetti(28);
    Toasts.show(`🎁 +${amt} monedas · día ${Meta.rewardDay()}`, 'good', 2600);
    refreshStart();
  }

  /* ===================== init / wiring ===================== */
  function init() {
    Render.buildBoard();
    FX.init();
    applyReducedFx();
    applyLargeText();
    I18n.apply();
    Cosmetics.apply();
    Input.init();
    buildModeMenu();
    PWA.init();
    const vEl = $('#app-version'); if (vEl) vEl.textContent = VERSION;

    // Audio iOS: red de seguridad. Desbloquea/reanuda el contexto con el primer
    // gesto en cualquier parte y al volver a primer plano (iOS suspende el audio).
    const unlockAudio = () => { Sound.ensure(); };
    ['pointerdown', 'touchend', 'keydown'].forEach(ev => document.addEventListener(ev, unlockAudio, { passive: true }));
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && Sound.ctx && Sound.ctx.state !== 'running') { const r = Sound.ctx.resume(); if (r && r.catch) r.catch(() => {}); }
    });

    // Bienvenida sin fricción: nombre opcional + color de avatar + invitado.
    const AV_COLORS = ['#00d0ff', '#ff5b6e', '#3ad07f', '#ffd23f', '#a06bff', '#ff9838'];
    (function buildAvatars() {
      const wrap = $('#avatar-pick'); if (!wrap) return;
      const cur = (Storage.profile && Storage.profile.color) || AV_COLORS[0];
      wrap.innerHTML = AV_COLORS.map((c, i) =>
        `<button type="button" class="avatar-dot${c === cur ? ' sel' : ''}" role="radio" aria-checked="${c === cur}" data-color="${c}" style="--av:${c}" aria-label="Color ${i + 1}"></button>`).join('');
      wrap.querySelectorAll('.avatar-dot').forEach(d => d.addEventListener('click', () => {
        wrap.querySelectorAll('.avatar-dot').forEach(x => { x.classList.remove('sel'); x.setAttribute('aria-checked', 'false'); });
        d.classList.add('sel'); d.setAttribute('aria-checked', 'true');
      }));
    })();
    function enterApp(name) {
      const wrap = $('#avatar-pick'); const sel = wrap && wrap.querySelector('.avatar-dot.sel');
      const color = sel ? sel.dataset.color : AV_COLORS[0];
      Storage.profile = { name: name || 'Jugador', color };
      Storage.user = name || 'Jugador';
      Sound.ensure(); refreshStart();
      if (!Storage.tutorialDone) Coach.start(); else Screens.show('start');
    }
    if (Storage.user) Screens.show('start'); else Screens.show('login');
    refreshStart();
    { const ni = $('#player-name'), pr = Storage.profile; if (ni && pr && pr.name && pr.name !== 'Invitado') ni.value = pr.name; }
    $('#login-form').addEventListener('submit', (e) => { e.preventDefault(); enterApp($('#player-name').value.trim()); });
    { const g = $('#btn-guest'); if (g) g.addEventListener('click', () => enterApp('Invitado')); }
    { const bt = $('#btn-tutorial'); if (bt) bt.addEventListener('click', () => { Modal.close(); Coach.start(); }); }
    { const cs = $('#coach-skip'); if (cs) cs.addEventListener('click', () => Coach.skip()); }
    // "Novedades" al actualizar de versión (no en el primer arranque).
    if (Storage.user && Storage.lastVersion && Storage.lastVersion !== VERSION) {
      setTimeout(() => Toasts.show('✨ Actualizado a v' + VERSION, 'info', 3000), 900);
    }
    Storage.lastVersion = VERSION;

    // Inicio
    $('#btn-play').addEventListener('click', () => { Sound.ensure(); Screens.show('modes'); });
    $('#btn-how').addEventListener('click', () => Modal.open('modal-how'));
    { const bi = $('#btn-install'); if (bi) bi.addEventListener('click', () => PWA.promptInstall()); }
    $('#btn-sound').addEventListener('click', () => {
      Settings.sfx = !Settings.sfx;
      $('#btn-sound').setAttribute('aria-checked', String(Settings.sfx));
      if (Settings.sfx) { Sound.ensure(); Sound.ui(); }
    });
    const bs = $('#btn-settings'); if (bs) bs.addEventListener('click', () => { Sound.ensure(); openSettings(); });
    const bm = $('#btn-medals'); if (bm) bm.addEventListener('click', openMedals);
    { const bsh = $('#btn-shop'); if (bsh) bsh.addEventListener('click', () => { Sound.ensure(); openShop(); }); }
    { const br = $('#btn-reward'); if (br) br.addEventListener('click', claimDailyReward); }
    // Al cerrar la tienda, revertir cualquier previsualización al tema equipado.
    { const sc = $('#shop-close'); if (sc) sc.addEventListener('click', () => Cosmetics.apply()); }

    // Modos
    $('#modes-back').addEventListener('click', () => Screens.show('start'));
    $('#btn-start-game').addEventListener('click', () => {
      if (selMode === 'aventura') { buildAdventureMap(); Modal.open('modal-adventure'); }
      else if (selMode === 'tutorial') Coach.start();
      else Game.start(selMode, selDiff);
    });
    { const ac = $('#adventure-continue'); if (ac) ac.addEventListener('click', () => { Modal.close(); Game.start('aventura', selDiff); }); }

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
    { const bsh = $('#btn-share'); if (bsh) bsh.addEventListener('click', () => Share.go()); }
    $('#btn-over-quit').addEventListener('click', () => Game.quit());
    { const rv = $('#btn-revive'); if (rv) rv.addEventListener('click', () => Survival.revive()); }
    { const gu = $('#btn-giveup'); if (gu) gu.addEventListener('click', () => Survival.giveUp()); }
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
  if (location.search.indexOf('dev') !== -1) window.__cv = { State, Engine, Game, Render, Config, FX, Meta, Settings, Music, Loop, Sound, Tiles, Boosters, Modifiers, Rules, Themes, Cosmetics, Coach, Adventure, Survival, Share, I18n, Toasts, refreshStart, applyLanguage };
})();
