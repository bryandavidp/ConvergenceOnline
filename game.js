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

  const VERSION = '2.5.0';

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
  window.addEventListener('error', (e) => { ErrLog.push('error', e.message, { src: e.filename, line: e.lineno }); showFatalError(); });
  window.addEventListener('unhandledrejection', (e) => { ErrLog.push('promise', (e.reason && e.reason.message) || e.reason); showFatalError(); });
  // Banner de recuperación: un fallo de JS no debe dejar una pantalla muerta. Se muestra
  // una sola vez (anti-bucle) con un botón para recargar. Texto en fallback si I18n aún
  // no existe (error muy temprano en el arranque).
  let _fatalShown = false;
  function showFatalError() {
    if (_fatalShown || !document.body) return;
    _fatalShown = true;
    const tt = (k, fb) => { try { return (typeof I18n !== 'undefined' && I18n.t(k)) || fb; } catch (_) { return fb; } };
    const box = document.createElement('div');
    box.className = 'fatal-error';
    box.setAttribute('role', 'alert');
    const msg = document.createElement('span');
    msg.textContent = tt('err_fatal', 'Algo ha fallado.');
    const btn = document.createElement('button');
    btn.className = 'btn btn-primary btn-sm';
    btn.textContent = tt('err_reload', 'Recargar');
    btn.addEventListener('click', () => location.reload());
    box.appendChild(msg); box.appendChild(btn);
    document.body.appendChild(box);
  }
  // Banner de navegador no soportado (sin color-mix): texto plano, sin depender de la
  // feature que falta. Detiene el arranque del juego.
  function showBrowserWarn() {
    if (!document.body) return;
    const box = document.createElement('div');
    box.className = 'browser-warn';
    box.setAttribute('role', 'alert');
    try { box.textContent = I18n.t('browser_old'); } catch (_) { box.textContent = 'Your browser is too old to play. Please update it.'; }
    document.body.appendChild(box);
  }
  // Aviso accionable de nueva versión del Service Worker: botón "Actualizar" que recarga
  // para servir los assets nuevos (RunSave conserva la partida en curso al recargar).
  let _updateShown = false;
  function showUpdateBanner(reg) {
    if (_updateShown || !document.body) return;
    _updateShown = true;
    const box = document.createElement('div');
    box.className = 'update-banner'; box.setAttribute('role', 'status');
    const msg = document.createElement('span');
    msg.textContent = I18n.t('update_ready');
    const btn = document.createElement('button');
    btn.className = 'btn btn-primary btn-sm';
    btn.textContent = I18n.t('update_btn');
    btn.addEventListener('click', () => {
      try { if (reg && reg.waiting) reg.waiting.postMessage('skipWaiting'); } catch (_) {}
      location.reload();
    });
    box.appendChild(msg); box.appendChild(btn);
    document.body.appendChild(box);
  }

  /* ===================== Config ===================== */
  const Config = {
    SIZE: 8,
    // Los iconos ya no son emojis: se generan por SVG (ver el módulo Icons).
    COMBO_MULTIPLIERS: [[30,10],[20,8],[15,5],[10,3],[6,2],[3,1.5]], // [umbral, multiplicador], desc
    MILESTONES: { 10: 500, 20: 1000, 30: 2000 },
    EMPTY_BOARD_BONUS: 500,   // bonus por dejar el tablero vacío
    // Ayuda de vaciado: con el tablero casi vacío (<= threshold iconos), sesga el icono
    // que aparece hacia los que ya están (prioriza solitarios) para no alargar el vaciado.
    CLEAR_ASSIST: { threshold: 6, pMax: 0.9, decay: 0.1, pMin: 0.25 },
    // Estrellas del nivel (Clásico): máximo de ERRORES permitidos para 3★ y 2★.
    // 0 errores -> 3★ · hasta 2 errores -> 2★ · más -> 1★.
    STAR_ERR: [0, 2],
    FEVER_COMBO: 10,          // combo para entrar en modo Fever
    FEVER_BOOST: 1.25,        // multiplicador extra de puntos en Fever
    // Contrarreloj (score attack): el reloj tiene TOPE -> el tiempo ganado no se
    // acumula sin límite (evita partidas infinitas a base de combos).
    TIMED_START: 60,          // s reloj inicial
    TIMED_CAP: 90,            // s máximo en el reloj (tope duro)
    TIMED_MISTAKE_S: 3,       // GM-11: el error en score-attack cuesta segundos, no iconos
    SPRINT_WINDOW: 10,        // GM-10: sprint final — con <=10s en el reloj...
    SPRINT_MULT: 1.5,         // ...todos los puntos ×1.5 (riesgo-recompensa: cabalgar el borde)
    // GM-26: warm-up de apertura — el intervalo de spawn se multiplica ×0.55 los
    // primeros 10s del nivel (o hasta la 3ª convergencia) y sale con rampa de 2s.
    // Material temprano => primer combo antes (ataca el "arranque frío", D2 del plan).
    WARMUP: { ms: 10000, convs: 3, factor: 0.55, rampMs: 2000 },
    // GM-02: continuar con gemas al llenarse el tablero (Clásico/Aventura) — 1 oferta
    // por nivel, despeja el 40%. Primer sumidero de gemas de gameplay.
    CONTINUE_GEMS: 15,
    CONTINUE_CLEAR: 0.40,
    // GM-03: potenciadores pre-nivel de Clásico (coste en monedas, máx. 2 por nivel,
    // desde el 2º mundo). Recupera los costes históricos de Boosters.DEFS.
    PRELEVEL_BOOSTERS: { bomb: 80, freeze: 60, clearLine: 90 },
    PRELEVEL_MAX: 2,
    PRELEVEL_FROM_WORLD: 1,   // índice de mundo (0 = Bosque juega sin fricción)
    HINTS_PER_LEVEL: 3,
    HINT_COOLDOWN: 10000,     // ms
    HINT_DURATION: 2000,      // ms
    DIFFICULTY: {
      facil:   { label: 'Fácil',   initialIcons: 12, comboWindow: 5000, spawnStart: 6000, spawnMin: 2000, scoreMult: 0.8, penaltyBase: 1 },
      normal:  { label: 'Normal',  initialIcons: 18, comboWindow: 3500, spawnStart: 5000, spawnMin: 1400, scoreMult: 1.0, penaltyBase: 2 },
      dificil: { label: 'Difícil', initialIcons: 24, comboWindow: 2500, spawnStart: 3800, spawnMin: 900,  scoreMult: 1.3, penaltyBase: 3 },
    },
    MODES: {
      tutorial:      { name: 'Tutorial',     emoji: '🎓', timed: false, penalties: false, mult: 0.5, single: true, fixedDiff: 'facil', accent: '#ffd23f', goal: 'Junta dos iguales', desc: 'Aprende la mecánica sin prisa ni penalizaciones.' },
      clasico:       { name: 'Clásico',      emoji: '🗺️', timed: false, penalties: true,  mult: 1.0, accent: '#2f6bff', goal: 'Vacía el tablero', desc: 'Supera niveles con diferentes mapas y desafíos únicos.',
        onSetupLevel(ctx) { Classic.setup(ctx.level); },
        // GM-03: los potenciadores pre-nivel (congelar) también pausan el spawn aquí.
        blockSpawn() { return Survival.frozen() || Survival.locked(); } },
      aventura:      { name: 'Aventura',     emoji: '🚀', timed: false, penalties: true,  mult: 1.1, accent: '#7a5cff', desc: 'Viaje infinito por biomas con reglas propias, objetivos y mini-jefes. ¿Hasta dónde llegarás?',
        onSetupLevel(ctx) { Adventure.setup(ctx.level); },
        onTick(dt) { Adventure.onTick(dt); },
        winCheck() { Adventure.refreshGoal(State.level); return Adventure.winCheck(); },
        // El objetivo MANDA: solo en niveles 'clear' se gana vaciando el tablero;
        // en score/survive/boss vaciar NO completa el nivel antes de tiempo.
        boardClearWins() { return Adventure.objective === 'clear'; } },
      contrarreloj:  { name: 'Contrarreloj', emoji: '⏱️', timed: true,  scoreAttack: true, penalties: true,  mult: 1.2, accent: '#ff6cb0', goal: 'Suma puntos a contrarreloj', desc: 'Un solo tablero: cada convergencia suma algo de tiempo (con tope), pero la presión crece. ¡Puntúa todo lo posible antes de que el reloj llegue a cero!' },
      supervivencia: { name: 'Supervivencia',emoji: '❤️', timed: false, penalties: true,  mult: 1.5, fast: true, endless: true, accent: '#ff5b6e', desc: 'Aguanta oleadas crecientes con vidas, trampas, jefes y potenciadores. ¿Cuánto sobrevivirás?',
        onSetupLevel(ctx) { Survival.setup(ctx.level); },
        onTick(dt) { Survival.onTick(dt); },
        onConverge(ctx) { Survival.onConverge(ctx); },
        onOverflow() { Survival.onOverflow(); },
        blockSpawn() { return Survival.blockSpawn(); },
        spawnFactor() { return Survival.spawnFactor(); } },
      zen:           { name: 'Zen',          emoji: '☯️', timed: false, penalties: false, mult: 0.8, relaxed: true, endless: true, noFever: true, accent: '#9be15d', goal: 'Sin fallos ni prisa',
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
      // Figuras desbloqueables (mockup): siluetas limpias, mismo estilo plano + contorno.
      pentagon: c => `<path d="M50 14 L84 39 L71 81 L29 81 L16 39 Z" fill="${c}" ${ST}/>`,
      moon:     c => `<path d="M64 16 A36 36 0 1 0 64 84 A28 28 0 1 1 64 16 Z" fill="${c}" ${ST}/>`,
      sun:      c => `<path d="M50 8 L58 28 L80 20 L72 42 L92 50 L72 58 L80 80 L58 72 L50 92 L42 72 L20 80 L28 58 L8 50 L28 42 L20 20 L42 28 Z" fill="${c}" ${ST}/>`,
      flower:   c => `<g fill="${c}" ${ST}><circle cx="50" cy="28" r="15"/><circle cx="72" cy="44" r="15"/><circle cx="64" cy="70" r="15"/><circle cx="36" cy="70" r="15"/><circle cx="28" cy="44" r="15"/></g><circle cx="50" cy="52" r="12" fill="#ffe9a8" ${ST}/>`,
      clover:   c => `<g fill="${c}" ${ST}><circle cx="50" cy="32" r="16"/><circle cx="34" cy="50" r="16"/><circle cx="66" cy="50" r="16"/></g><path d="M48 58 L52 58 L54 86 L46 86 Z" fill="${c}" ${ST}/>`,
      spiral:   c => `<path d="M50 50 C50 43 59 43 59 50 C59 62 41 62 41 50 C41 34 67 34 67 50 C67 72 33 72 33 50 C33 25 75 25 75 50" fill="none" stroke="${c}" stroke-width="9" stroke-linecap="round"/>`,
    };
    const SNAME = { circle:'círculo', square:'cuadrado', triangle:'triángulo', diamond:'rombo',
      star:'estrella', heart:'corazón', hexagon:'hexágono', plus:'cruz', droplet:'gota', ring:'anillo',
      pentagon:'pentágono', moon:'luna', sun:'sol', flower:'flor', clover:'trébol', spiral:'espiral' };

    // Pares [forma, color]. ORDENADOS EN CICLOS de las 10 formas EN EL MISMO
    // ORDEN (3 ciclos = 30 iconos, múltiplo de 10). Cada forma aparece 3 veces
    // con colores distintos. Como cada nivel toma una "ventana" contigua de <=8
    // iconos (ver Engine.poolForLevel) y el periodo del ciclo es 10, CUALQUIER
    // ventana tiene SIEMPRE formas distintas: dos iconos sólo coinciden si son
    // idénticos (misma forma y color), eliminando convergencias "que parecen
    // válidas" por colores parecidos de una misma forma. La longitud múltiplo de
    // 10 conserva la propiedad incluso al dar la vuelta al catálogo.
    // Catálogo generado: ciclos de TODAS las formas en el MISMO orden (período = nº de
    // formas, 16 > 8). Cada forma aparece 3 veces con colores distintos. Como cada nivel
    // toma una ventana contigua de <=8 (Engine.poolForLevel), cualquier ventana tiene
    // siempre formas distintas → dos iconos solo coinciden si son idénticos (forma+color).
    const SHAPE_ORDER = ['circle', 'square', 'triangle', 'star', 'heart', 'diamond', 'hexagon', 'plus', 'droplet', 'ring', 'pentagon', 'moon', 'sun', 'flower', 'clover', 'spiral'];
    const COLOR_ORDER = ['red', 'blue', 'green', 'yellow', 'purple', 'cyan', 'orange', 'pink', 'lime', 'white', 'teal', 'indigo'];
    const PAIRS = [];
    for (let cyc = 0; cyc < 3; cyc++) {
      for (let i = 0; i < SHAPE_ORDER.length; i++) {
        PAIRS.push([SHAPE_ORDER[i], COLOR_ORDER[(i + cyc * 7) % COLOR_ORDER.length]]);
      }
    }
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
    get survDiff() { return localStorage.getItem('cv_surv_diff') || 'normal'; },
    set survDiff(v) { localStorage.setItem('cv_surv_diff', v || 'normal'); },
    get zenDiff() { return localStorage.getItem('cv_zen_diff') || 'normal'; },
    set zenDiff(v) { localStorage.setItem('cv_zen_diff', v || 'normal'); },
    get preboostSeen() { return localStorage.getItem('cv_preboost') === '1'; },
    set preboostSeen(v) { localStorage.setItem('cv_preboost', v ? '1' : '0'); },
    get lastMode() { return localStorage.getItem('cv_last_mode') || ''; },
    set lastMode(v) { v ? localStorage.setItem('cv_last_mode', v) : localStorage.removeItem('cv_last_mode'); },
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
        play: 'Jugar', reward: 'Recompensa diaria', menu_profile: 'Logros', menu_shop: 'Tienda',
        menu_settings: 'Ajustes', how: '¿Cómo se juega?', install: 'Instalar app', sound: 'Sonido', best: 'Mejor puntuación:',
        tab_log: 'Logros', tab_shop: 'Tienda', tab_home: 'Inicio', tab_guide: 'Guía', tab_set: 'Ajustes', missions_title: '🎯 Misiones',
        modes_title: 'Elige tu modo', modes_sub: 'Cada modo, una forma diferente de jugar', group_mode: 'Modo', group_diff: 'Dificultad',
        card_surv: 'Supervivencia', card_surv_badge: 'OLEADAS INFINITAS', card_surv_desc: 'Aguanta oleadas cada vez más intensas y supera tu mejor marca.',
        card_classic: 'Clásico', card_classic_badge: 'POR NIVELES', card_classic_desc: 'Supera mapas con objetivos, obstáculos y desafíos nuevos.',
        group_prog: 'Progresión', group_score: 'Puntuación', group_relax: 'Relax',
        card_adv_badge: 'INFINITO', card_contra_badge: 'CONTRARRELOJ', card_zen_badge: 'RELAX', card_contra_daily: 'Incluye el Reto del día',
        card_multi: 'Multijugador', card_multi_badge: 'PRÓXIMAMENTE', card_multi_desc: 'Desafía a otros jugadores en línea cuando esté disponible.',
        card_feat_locks: 'Bloqueos', card_feat_objects: 'Objetos', card_feat_events: 'Eventos', card_feat_more: '¡Y mucho más!',
        card_feat_first: 'Termina primero el tablero', card_feat_best: 'Mejor puntuación', card_feat_online: 'Partidas en línea',
        how_card_desc: 'Repasa las reglas, consejos y todo lo que necesitas saber para dominar el juego.', how_card_cta: 'Ver información', multi_soon: 'Multijugador en línea: ¡muy pronto!',
        classic_title: 'Modo Clásico', world_news: 'Novedades de este mundo', worlds_label: 'Mundos', all_rewards: '🎁 Ver recompensas',
        to_map: 'Volver al mapa', classic_lvl_sub: 'Nivel {n} · {w}', classic_next: 'Siguiente nivel →',
        locked_level: '🔒 Completa el nivel anterior', locked_world: '🔒 Mundo bloqueado', reward_locked: 'Completa todos los niveles del mundo', reward_claimed: 'Recompensa ya reclamada', reward_got: '¡Recompensa del mundo! 🎁 +1 cofre · 💎 +20',
        stars_label: 'Estrellas del nivel', stars_help: '3★ sin errores · 2★ hasta 2 errores · 1★ más errores', star_lost: '−1 estrella · ¡evita los errores!',
        star_c3: 'Sin errores', star_c2: 'Hasta {n} errores', star_c1: 'Más errores', star_mine: 'Tus errores: {n}',
        coming_soon: 'Próximamente', tab_missions: 'Misiones', tab_play: 'Jugar', tab_chests: 'Cofres', tab_rank: 'Clasificación',
        powerup_empty: 'No te quedan de este power-up',
        equipped: 'Equipado', equip: 'Equipar', free: 'Gratis', no_coins: 'Monedas insuficientes',
        shop_boards: 'Tableros visuales', shop_themes: 'Temas de color', shop_hint2: 'Los tableros son solo cambios visuales: no dan ventajas ni desventajas. Equipa tu estilo favorito para jugar.', board_unlocked: '¡Tablero desbloqueado!',
        chests_title: '🎁 Cofres', chests_have: 'Tienes {n} cofre(s)', chests_hint: 'Cada cofre contiene monedas, gemas o tickets.', chests_none: 'No tienes cofres', chest_reward: '¡Recompensa! {r}', open_chest: '🎁 Abrir cofre',
        soon_badge: 'Próximamente', notify_me: 'Avísame', notify_ok: '¡Te avisaremos cuando esté listo!',
        edit_name: 'Tu nombre', daily_banner_title: 'Recompensa diaria', daily_banner_sub: '¡Vuelve cada día y gana premios!', claim: 'Reclamar',
        home_classic: 'Partida clásica', home_classic_sub: 'Supera niveles y gana estrellas', home_surv_sub: 'Sobrevive a oleadas infinitas',
        q_missions: 'Misiones', q_daily: 'Diario', q_chests: 'Cofres', q_league: 'Liga', q_friends: 'Amigos', best_score: 'Mejor puntuación', play_word: 'Jugar',
        hud_record: 'Récord', hud_points: 'Puntos', hud_level: 'Nivel', hud_time: 'Tiempo', hud_speed: 'Velocidad', hud_occ: 'Ocupación',
        how_title: '¿Cómo se juega?', how1: 'Toca una <strong>casilla vacía</strong>.', how2: 'Se mira el icono más cercano en cada dirección (arriba, abajo, izquierda, derecha).',
        how3: 'Si <strong>2 o más coinciden</strong>, ¡convergen y desaparecen!', how4: 'Encadena eliminaciones rápidas para subir el <strong>combo</strong> y multiplicar puntos.',
        how5: 'Los iconos aparecen solos: vacía el tablero antes de que se llene.',
        tutorial_btn: 'Tutorial interactivo', understood: 'Entendido',
        pause: 'Pausa', resume: 'Reanudar', restart: 'Reiniciar', menu: 'Menú', close: 'Cerrar', back: 'Volver', retry: 'Reintentar', share: 'Compartir',
        settings_title: '⚙️ Ajustes', shop_title: '🛍️ Tienda', shop_hint: 'Temas del tablero. Pulsa para previsualizar.',
        profile_title: '📊 Perfil', best_by_mode: 'Mejores marcas por modo', achievements: 'Logros',
        adventure_title: '🚀 Aventura', adventure_sub: 'Viaje infinito por biomas. Cada capítulo cambia las reglas y termina con un mini-jefe.',
        revive_title: '💔 ¡Última oportunidad!', revive_sub: 'Te has quedado sin vidas. ¿Revivir y seguir sobreviviendo?', giveup: 'Rendirse',
        coach_skip: 'Saltar tutorial',
        coach1: '👆 Toca la casilla VACÍA que brilla, entre dos iconos iguales, para juntarlos.',
        coach2: '✨ ¡Eso es! Si coinciden en varias direcciones, eliminas más de golpe.',
        coach3: '⚡ Ahora encadena: junta las dos parejas rápido, antes de que se agote el círculo, para subir el combo.',
        coach_done: '¡Listo! Ya sabes jugar 🎉', coach_play1: 'Jugar nivel 1', coach_menu: 'Ir al menú',
        quit_confirm: '¿Salir? Toca de nuevo para confirmar', confirm_buy: '¿Confirmar?',
        resume_run: 'Continuar partida', run_resumed: 'Partida recuperada',
        premium_chest: 'Cofre premium', no_gems: '¡No tienes gemas suficientes!',
        reroll_mission: 'Cambiar misión (1)', mission_rerolled: '¡Misión nueva!',
        daily_challenge: 'Reto del día', daily_play: 'Jugar', daily_best: 'Mejor de hoy: {n}',
        daily_pending: 'Tablero de hoy · ¡juégalo!', daily_done_state: '✅ Hecho · Mejor: {n}',
        daily_done_medal: '{m} · Mejor: {n}', daily_medal_none: 'Sin medalla', daily_medal_bronze: 'Bronce', daily_medal_silver: 'Plata', daily_medal_gold: 'Oro',
        daily_medal_result: 'Medalla diaria: {m}', daily_next_medal: 'Siguiente medalla: supera {n}',
        mode_note_clasico: 'Maestría: termina sin errores para 3★', mode_note_clasico_streak: 'Racha perfecta: ×{n}',
        mode_note_aventura: 'Descubre: {m}', mode_note_contrarreloj: 'Cada convergencia compra segundos', mode_note_daily: 'Reto diario: bronce, plata u oro', mode_note_zen: 'Respira: sin castigo',
        mode_brief_clasico: 'Clásico · busca 3 estrellas', mode_brief_aventura: 'Aventura · lee el bioma y adapta la ruta',
        mode_brief_contrarreloj: 'Contrarreloj · prioriza combos para comprar tiempo', mode_brief_supervivencia: 'Supervivencia · carga boosters antes de la oleada', mode_brief_zen: 'Zen · calma, limpieza y colección',
        result_focus_clasico: 'Repite niveles sin errores para encadenar perfectos.', result_focus_aventura: 'El siguiente bioma cambia el objetivo: mira el banner antes de actuar.',
        result_focus_contrarreloj: 'El mejor ritmo nace de combos cortos y constantes.', result_focus_supervivencia: 'Guarda un booster para el tramo final de cada oleada.', result_focus_zen: 'Buen modo para practicar rutas largas sin presión.',
        classic_streak: 'Racha perfecta ×{n}', classic_best_streak: 'Mejor racha: ×{n}', classic_streak_lost: 'Racha perfecta reiniciada',
        time_pressure: '¡Últimos segundos!', surv_wave_soon: 'Oleada en camino',
        next_title: 'Siguiente paso', next_open_chest: 'Abrir cofre', next_open_chest_sub: 'Tienes recompensa guardada lista para abrir.',
        next_missions: 'Ver misiones', next_missions_sub: 'Hay progreso o recompensa cerca en misiones.',
        next_daily: 'Mejorar reto diario', next_daily_sub: 'Busca la siguiente medalla del día con el mismo tablero.',
        next_shop: 'Elegir cosmético', next_shop_sub: 'Ya puedes desbloquear o equipar algo visual.',
        next_classic: 'Volver al mapa', next_classic_sub: 'Sigue una ruta de 3★ y racha perfecta.',
        next_surv: 'Ir a Supervivencia', next_surv_sub: 'Gana cofres cada 10 oleadas y prueba boosters.',
        next_adventure: 'Continuar Aventura', next_adventure_sub: 'Descubre el siguiente bioma y su objetivo.',
        next_modes: 'Probar otro modo', next_modes_sub: 'Completa tu variedad de modos para desbloquear mastery.',
        progress_title: 'Progreso cercano', progress_daily: 'Misión diaria', progress_weekly: 'Reto semanal',
        progress_variety: 'Variedad de modos', progress_chests: 'Cofres listos', progress_cosmetic: 'Cosmético cercano',
        progress_ready: 'Listo', progress_left: 'faltan {n}', progress_modes_left: '{n} por probar',
        empty_chests_title: 'Aún no tienes cofres', empty_chests_sub: 'Gana un cofre cada 10 oleadas en Supervivencia', empty_cta_surv: 'Jugar Supervivencia',
        empty_medals_title: 'Tu primera medalla te espera', empty_medals_sub: 'Juega una partida para empezar a desbloquear logros',
        empty_lb_title: 'Sin marcas todavía', empty_lb_sub: 'Juega cualquier modo para registrar tu primera marca', empty_cta_play: 'Elegir modo',
        err_fatal: 'Algo ha fallado.', err_reload: 'Recargar', browser_old: 'Tu navegador es demasiado antiguo para jugar. Actualízalo, por favor.',
        update_ready: '✨ Nueva versión disponible', update_btn: 'Actualizar',
        sr_combo: 'Combo de {n}', sr_converge: '{n} iconos convergen', sr_wave: 'Oleada {n}', sr_life: 'Vida perdida, quedan {n}',
        sr_over: 'Fin de la partida, {n} puntos', sr_level: 'Nivel completado, {n} puntos', sr_stars: 'Nivel completado, {s} de 3 estrellas, {n} puntos',
        surv_sys_title: 'Cómo funciona', surv_sys_charge: 'Encadena convergencias para llenar el anillo interior y ganar un potenciador gratis.', surv_sys_frenzy: 'Llena el anillo de frenesí para multiplicar tus puntos un rato.', surv_sys_lives: 'Pierdes una vida si el tablero se desborda; revivir cuesta monedas y sube de precio con cada uso.',
        pause_no_save: 'Este modo no guarda la partida al salir.',
        ci_tap: 'Toca para empezar', ci_no_mods: 'Sin modificadores especiales',
        daily_first_reward: '+5 💎 · primer intento del día', daily_new_best: '¡Nueva marca del día! {n}',
        no_moves_wait: 'Sin jugadas ahora mismo: espera al siguiente icono',
        challenge_start: 'Reto compartido: ¡mismo tablero!',
        diff_facil: 'Fácil', diff_normal: 'Normal', diff_dificil: 'Difícil',
        set_sfx: 'Efectos de sonido', set_music: 'Música', set_haptics: 'Vibración', set_reduced: 'Reducir efectos', set_large: 'Texto grande', set_lang: 'Idioma',
        perf_suggest: 'Toca aquí para activar el modo ligero y ganar fluidez', perf_light_on: 'Modo ligero activado',
        st_points: 'Puntos', st_level: 'Nivel', st_combo: 'Combo máx.', st_removed: 'Eliminados', st_time: 'Tiempo', st_record: 'Récord', st_wave: 'Oleada', st_surv: 'Sobreviviste', st_best: 'Mejor',
        st_games: 'Partidas', st_bestcombo: 'Mejor combo', st_totaltime: 'Tiempo total',
        surv_new_icons: '¡Nuevos iconos! Sube la dificultad',
        aim_hint: 'Toca dónde aplicarlo', pu_freeze: 'Spawns congelados', pu_x2: '¡Puntos x2!', pu_bomb: '¡Boom!', pu_ray: '¡Rayo!', pu_icons: 'iconos', chain_boom: 'Cadena ×{n}',
        surv_meteor: '¡Lluvia de iconos!', surv_quake: '¡Terremoto!', surv_frost: 'Frente helado', surv_life_lost: 'Vida liberada · -1',
        surv_boss_soon: '⚠ Jefe', surv_boss_meteor_warn: '¡Lluvia de iconos inminente!', surv_boss_quake_warn: '¡Terremoto inminente!', surv_boss_frost_warn: '¡Frente helado inminente!',
        near_miss: '¡Te quedaste a {n} figuras de lograrlo!', peak_moment: 'Tu mejor momento: +{p} con combo ×{c}',
        sprint_on: '¡Sprint final! Puntos ×1.5', mistake_time: 'Error · −{n}s',
        boon_title: '¡Bendición!', boon_sub: 'Superaste al jefe: elige una mejora',
        boon_life: 'Vida extra', boon_life_d: '+1 corazón (puede superar el máximo)',
        boon_charge: 'Sobrecarga', boon_charge_d: '+50 de carga de potenciador',
        boon_pack: 'Arsenal', boon_pack_d: '+1 bomba y +1 rayo',
        boon_slow: 'Calma', boon_slow_d: 'Figuras más lentas durante 2 oleadas',
        boon_frenzy: 'Furia', boon_frenzy_d: '¡Frenesí activado al instante!',
        route_title: 'Elige tu ruta', route_dense: 'Ruta exigente', route_dense_d: 'Más obstáculos · puntos ×1.25 este capítulo',
        route_calm: 'Ruta serena', route_calm_d: 'Figuras más lentas · sin bonus',
        relic_title: 'Reliquia de jefe', relic_sub: 'Pasiva para el resto de la expedición (máx. 3)',
        relic_combo: 'Reloj de arena', relic_combo_d: 'Ventana de combo +0.4s',
        relic_crystal: 'Prisma', relic_crystal_d: 'Los cristales valen +30 extra',
        relic_hint: 'Brújula', relic_hint_d: '+1 pista en cada nivel',
        relic_shield: 'Escudo', relic_shield_d: 'La 1ª derrota del capítulo despeja el 30% en vez de terminar',
        relic_shield_fired: '¡El escudo te salvó! Tablero despejado',
        continue_title: 'Tablero lleno…', continue_sub: '¿Continuar por {n} gemas? Despeja el 40% del tablero (1 vez por nivel)',
        continue_yes: 'Continuar ({n}💎)', continue_yes_d: 'Despeja el 40% y sigue jugando',
        continue_no: 'Terminar partida', continue_done: '¡Continúas! Tablero despejado',
        classic_win_streak: 'Racha de victorias ×{n} · +{p}% monedas',
        zen_pace_title: 'Ritmo zen', zen_pace_slow: 'Sereno', zen_pace_slow_d: 'Figuras muy lentas, para respirar',
        zen_pace_normal: 'Fluido', zen_pace_normal_d: 'Ritmo tranquilo estándar',
        pl_sub: 'Lleva hasta 2 potenciadores (opcional)', pl_play: 'Jugar', pl_play_cost: 'Jugar · {c} monedas',
        pl_skip: 'Sin potenciadores', pl_first: 'Nuevo: puedes llevar potenciadores a los niveles. Se usan tocando su botón en partida.',
        pl_max: 'Máximo {n} potenciadores', pl_no_coins: 'Monedas insuficientes',
        surv_tide: '¡Marea de figuras!', surv_boss_tide_warn: '¡Marea inminente: despeja los bordes!',
        survmut_ice: 'Semana del hielo: trampas heladas · monedas ×1.15', survmut_chaos: 'Semana del caos: el terremoto ha vuelto', survmut_frenzy: 'Semana de la furia: frenesí +30%',
        dmut_ice: 'Reto de hoy: tablero helado', dmut_window: 'Reto de hoy: combos más exigentes', dmut_variety: 'Reto de hoy: más variedad de figuras', dmut_rocks: 'Reto de hoy: campo de rocas', dmut_fast: 'Reto de hoy: ritmo veloz', dmut_crystal: 'Reto de hoy: cristales dobles', dmut_nohints: 'Reto de hoy: sin pistas',
        dmut_ice_n: 'Hielo', dmut_window_n: 'Combos exigentes', dmut_variety_n: 'Variedad', dmut_rocks_n: 'Rocas', dmut_fast_n: 'Veloz', dmut_crystal_n: 'Cristales', dmut_nohints_n: 'Sin pistas',
        daily_streak_chest: '¡{n} días de medalla seguidos! +1 cofre', daily_cal_al: 'Calendario de medallas de los últimos 14 días',
        timecap_hint: 'Cápsula de tiempo: detónala por adyacencia (+5s)',
        advboss_warn: 'El jefe carga su ataque…',
        advboss_nebula: '¡Andanada del jefe!', advboss_asteroid: '¡El jefe lanza rocas!', advboss_ice: '¡El jefe congela!', advboss_core: '¡El jefe acelera el núcleo!', advboss_void: '¡El vacío devora una pista!', advboss_crystal: '¡El jefe se regenera!',
        exped_title: 'Tu expedición',
        garden_10: '¡10 flores en tu jardín! +1 cofre', garden_50: '¡50 flores! Skin «Jardín Zen» desbloqueado',
        board_excl: 'Exclusivo',
        pick_back: 'Volver',
        pu_row: '¡Fila despejada!', pu_col: '¡Columna despejada!', pu_no_target: 'Sin objetivo', pu_wild_emergency: 'Comodín · despeje de emergencia', pu_wild_icons: 'Comodín · {n} iconos',
        surv_diff_title: 'Supervivencia', surv_diff_sub: 'Elige el ritmo de la partida', surv_start: 'Empezar supervivencia',
        surv_frenzy: 'Frenesí', surv_frenzy_ready: '¡Frenesí activado!', surv_wave_reward: 'Oleada {w} · +{c} monedas',
        surv_milestone: 'Hito de oleada {w}', surv_wave_record: '¡Récord! Oleada {w}', surv_best_wave: 'Mejor oleada',
        surv_rewards: 'Recompensas', surv_reward_line: '+{c} monedas · +{g} gemas · +{ch} cofres', surv_time_record: '¡Récord de supervivencia!',
        coins: 'monedas', daily_done: '¡Misión diaria completada!', weekly_done: '¡Reto semanal completado!', lvl: 'Nivel',
        next: 'Próximo', new_icons: 'Nuevos iconos', chapter: 'Capítulo', next_to: 'Ir al nivel {n} →', lets_play: '¡A jugar!',
        obj_clear: 'Vacía el tablero', obj_score: 'Consigue {n} pts', obj_survive: 'Sobrevive {n}s', obj_boss: 'JEFE · rompe los 💎', obj_boss_live: 'JEFE · rompe los 💎 ({n})',
        biomemod_nebula: '', biomemod_asteroid: '🪨 Aparecen rocas que estorban', biomemod_ice: '🧊 Casillas heladas: tócalas para romperlas', biomemod_core: '🔥 Los iconos aparecen más rápido', biomemod_void: '🕳️ Menos pistas disponibles', biomemod_crystal: '💎 Cristales con puntos extra',
        sum_level: 'Nivel alcanzado {n}', sum_time: 'Tiempo {t}', sum_wave: 'Oleada {w} · {s}s sobrevividos', sum_chapter: 'Capítulo {c} · Nivel {n}',
        level_done: '¡Nivel completado!', perfect_done: '¡Tablero perfecto!', level_sub: 'Nivel {n} superado', perfect_sub: 'Tablero limpio · bonus +{b}', boss_next: '¡Jefe a la vista!',
        over_victory: '🏆 ¡Victoria!', over_surv: '🛡️ Fin de la supervivencia', over_fail: '¡Misión fallida!',
        reason_time: '¡Se acabó el tiempo!', reason_nomoves: 'Sin movimientos posibles · {n}% del tablero ocupado.', reason_full: 'El tablero se ha llenado.', reason_end: 'Fin de la partida.', reason_surv: 'Sobreviviste {s}s', ach_unlocked: '🏅 Logro: {n}',
      },
      en: {
        welcome_sub: 'Match equal icons across space', name_q: "What's your name?", optional: '(optional)',
        begin: 'Start!', guest: 'Play as guest', start_sub: 'Ready to conquer the board?',
        play: 'Play', reward: 'Daily reward', menu_profile: 'Profile', menu_shop: 'Shop',
        menu_settings: 'Settings', how: 'How to play?', install: 'Install app', sound: 'Sound', best: 'Best score:',
        tab_log: 'Trophies', tab_shop: 'Shop', tab_home: 'Home', tab_guide: 'Guide', tab_set: 'Settings', missions_title: '🎯 Missions',
        modes_title: 'Choose your mode', modes_sub: 'Each mode, a different way to play', group_mode: 'Mode', group_diff: 'Difficulty',
        card_surv: 'Survival', card_surv_badge: 'ENDLESS WAVES', card_surv_desc: 'Survive rising waves and beat your best run.',
        card_classic: 'Classic', card_classic_badge: 'BY LEVELS', card_classic_desc: 'Clear maps with fresh goals, obstacles and challenges.',
        group_prog: 'Progression', group_score: 'Score', group_relax: 'Relax',
        card_adv_badge: 'ENDLESS', card_contra_badge: 'TIME ATTACK', card_zen_badge: 'RELAX', card_contra_daily: 'Includes the Daily challenge',
        card_multi: 'Multiplayer', card_multi_badge: 'COMING SOON', card_multi_desc: 'Challenge other players online when it is available.',
        card_feat_locks: 'Locks', card_feat_objects: 'Objects', card_feat_events: 'Events', card_feat_more: 'And much more!',
        card_feat_first: 'Finish the board first', card_feat_best: 'Best score', card_feat_online: 'Online matches',
        how_card_desc: 'Review the rules, tips and everything you need to master the game.', how_card_cta: 'See info', multi_soon: 'Online multiplayer: coming soon!',
        classic_title: 'Classic Mode', world_news: "This world's news", worlds_label: 'Worlds', all_rewards: '🎁 See rewards',
        to_map: 'Back to map', classic_lvl_sub: 'Level {n} · {w}', classic_next: 'Next level →',
        locked_level: '🔒 Complete the previous level', locked_world: '🔒 World locked', reward_locked: 'Complete all levels in the world', reward_claimed: 'Reward already claimed', reward_got: 'World reward! 🎁 +1 chest · 💎 +20',
        stars_label: 'Level stars', stars_help: '3★ no mistakes · 2★ up to 2 mistakes · 1★ more mistakes', star_lost: '−1 star · avoid mistakes!',
        star_c3: 'No mistakes', star_c2: 'Up to {n} mistakes', star_c1: 'More mistakes', star_mine: 'Your mistakes: {n}',
        coming_soon: 'Coming soon', tab_missions: 'Missions', tab_play: 'Play', tab_chests: 'Chests', tab_rank: 'Leaderboard',
        powerup_empty: 'No more of this power-up',
        equipped: 'Equipped', equip: 'Equip', free: 'Free', no_coins: 'Not enough coins',
        shop_boards: 'Visual boards', shop_themes: 'Color themes', shop_hint2: 'Boards are visual-only cosmetics: no advantages or disadvantages. Equip your favorite style before playing.', board_unlocked: 'Board unlocked!',
        chests_title: '🎁 Chests', chests_have: 'You have {n} chest(s)', chests_hint: 'Each chest contains coins, gems or tickets.', chests_none: 'You have no chests', chest_reward: 'Reward! {r}', open_chest: '🎁 Open chest',
        soon_badge: 'Coming soon', notify_me: 'Notify me', notify_ok: "We'll let you know when it's ready!",
        edit_name: 'Your name', daily_banner_title: 'Daily reward', daily_banner_sub: 'Come back every day and win prizes!', claim: 'Claim',
        home_classic: 'Classic game', home_classic_sub: 'Beat levels and earn stars', home_surv_sub: 'Survive endless waves',
        q_missions: 'Missions', q_daily: 'Daily', q_chests: 'Chests', q_league: 'League', q_friends: 'Friends', best_score: 'Best score', play_word: 'Play',
        hud_record: 'Best', hud_points: 'Score', hud_level: 'Level', hud_time: 'Time', hud_speed: 'Speed', hud_occ: 'Fill',
        how_title: 'How to play?', how1: 'Tap an <strong>empty cell</strong>.', how2: 'It looks at the nearest icon in each direction (up, down, left, right).',
        how3: 'If <strong>2 or more match</strong>, they converge and vanish!', how4: 'Chain quick clears to raise the <strong>combo</strong> and multiply points.',
        how5: 'Icons spawn on their own: clear the board before it fills up.',
        tutorial_btn: 'Interactive tutorial', understood: 'Got it',
        pause: 'Paused', resume: 'Resume', restart: 'Restart', menu: 'Menu', close: 'Close', back: 'Back', retry: 'Retry', share: 'Share',
        settings_title: '⚙️ Settings', shop_title: '🛍️ Shop', shop_hint: 'Board themes. Tap to preview.',
        profile_title: '📊 Profile', best_by_mode: 'Best by mode', achievements: 'Achievements',
        adventure_title: '🚀 Adventure', adventure_sub: 'Endless journey across biomes. Each chapter changes the rules and ends with a mini-boss.',
        revive_title: '💔 Last chance!', revive_sub: 'You ran out of lives. Revive and keep surviving?', giveup: 'Give up',
        coach_skip: 'Skip tutorial',
        coach1: '👆 Tap the glowing EMPTY cell between two matching icons to merge them.',
        coach2: "✨ That's it! If they match in several directions, you clear more at once.",
        coach3: '⚡ Now chain them: clear both pairs quickly, before the ring runs out, to build your combo.',
        coach_done: 'Done! You know how to play 🎉', coach_play1: 'Play level 1', coach_menu: 'Go to menu',
        quit_confirm: 'Leave the game? Tap again to confirm', confirm_buy: 'Confirm?',
        resume_run: 'Resume game', run_resumed: 'Game restored',
        premium_chest: 'Premium chest', no_gems: 'Not enough gems!',
        reroll_mission: 'Swap mission (1)', mission_rerolled: 'New mission!',
        daily_challenge: 'Daily challenge', daily_play: 'Play', daily_best: "Today's best: {n}",
        daily_pending: "Today's board · play it!", daily_done_state: '✅ Done · Best: {n}',
        daily_done_medal: '{m} · Best: {n}', daily_medal_none: 'No medal', daily_medal_bronze: 'Bronze', daily_medal_silver: 'Silver', daily_medal_gold: 'Gold',
        daily_medal_result: 'Daily medal: {m}', daily_next_medal: 'Next medal: beat {n}',
        mode_note_clasico: 'Mastery: finish with no mistakes for 3★', mode_note_clasico_streak: 'Perfect streak: ×{n}',
        mode_note_aventura: 'Discover: {m}', mode_note_contrarreloj: 'Every convergence buys seconds', mode_note_daily: 'Daily run: bronze, silver or gold', mode_note_zen: 'Breathe: no punishment',
        mode_brief_clasico: 'Classic · chase 3 stars', mode_brief_aventura: 'Adventure · read the biome and adapt',
        mode_brief_contrarreloj: 'Time Attack · use combos to buy time', mode_brief_supervivencia: 'Survival · charge boosters before the wave', mode_brief_zen: 'Zen · calm, clearing and collection',
        result_focus_clasico: 'Replay levels with no mistakes to chain perfect clears.', result_focus_aventura: 'The next biome changes the goal: read the banner before acting.',
        result_focus_contrarreloj: 'The best pace comes from short, steady combos.', result_focus_supervivencia: 'Keep one booster for the final stretch of each wave.', result_focus_zen: 'A good mode for practicing long routes without pressure.',
        classic_streak: 'Perfect streak ×{n}', classic_best_streak: 'Best streak: ×{n}', classic_streak_lost: 'Perfect streak reset',
        time_pressure: 'Last seconds!', surv_wave_soon: 'Wave incoming',
        next_title: 'Next step', next_open_chest: 'Open chest', next_open_chest_sub: 'You have a saved reward ready to open.',
        next_missions: 'View missions', next_missions_sub: 'Mission progress or a reward is close.',
        next_daily: 'Improve daily run', next_daily_sub: 'Chase the next daily medal on the same board.',
        next_shop: 'Choose cosmetic', next_shop_sub: 'You can unlock or equip something visual.',
        next_classic: 'Back to map', next_classic_sub: 'Keep building 3★ clears and perfect streaks.',
        next_surv: 'Play Survival', next_surv_sub: 'Earn chests every 10 waves and try boosters.',
        next_adventure: 'Continue Adventure', next_adventure_sub: 'Discover the next biome and its goal.',
        next_modes: 'Try another mode', next_modes_sub: 'Complete mode variety to unlock mastery.',
        progress_title: 'Nearby progress', progress_daily: 'Daily mission', progress_weekly: 'Weekly challenge',
        progress_variety: 'Mode variety', progress_chests: 'Ready chests', progress_cosmetic: 'Nearby cosmetic',
        progress_ready: 'Ready', progress_left: '{n} left', progress_modes_left: '{n} to try',
        empty_chests_title: 'No chests yet', empty_chests_sub: 'Earn a chest every 10 waves in Survival', empty_cta_surv: 'Play Survival',
        empty_medals_title: 'Your first medal awaits', empty_medals_sub: 'Play a game to start unlocking achievements',
        empty_lb_title: 'No scores yet', empty_lb_sub: 'Play any mode to set your first score', empty_cta_play: 'Choose a mode',
        err_fatal: 'Something went wrong.', err_reload: 'Reload', browser_old: 'Your browser is too old to play. Please update it.',
        update_ready: '✨ New version available', update_btn: 'Update',
        sr_combo: 'Combo of {n}', sr_converge: '{n} icons converge', sr_wave: 'Wave {n}', sr_life: 'Life lost, {n} remaining',
        sr_over: 'Game over, {n} points', sr_level: 'Level complete, {n} points', sr_stars: 'Level complete, {s} of 3 stars, {n} points',
        surv_sys_title: 'How it works', surv_sys_charge: 'Chain convergences to fill the inner ring and earn a free power-up.', surv_sys_frenzy: 'Fill the frenzy ring to multiply your points for a while.', surv_sys_lives: 'You lose a life if the board overflows; reviving costs coins and gets pricier each use.',
        pause_no_save: 'This mode does not save your game when you leave.',
        ci_tap: 'Tap to start', ci_no_mods: 'No special modifiers',
        daily_first_reward: '+5 💎 · first try of the day', daily_new_best: 'New daily best! {n}',
        no_moves_wait: 'No moves right now: wait for the next icon',
        challenge_start: 'Shared challenge: same board!',
        diff_facil: 'Easy', diff_normal: 'Normal', diff_dificil: 'Hard',
        set_sfx: 'Sound effects', set_music: 'Music', set_haptics: 'Vibration', set_reduced: 'Reduce effects', set_large: 'Large text', set_lang: 'Language',
        perf_suggest: 'Tap here to turn on light mode for smoother play', perf_light_on: 'Light mode on',
        st_points: 'Score', st_level: 'Level', st_combo: 'Max combo', st_removed: 'Cleared', st_time: 'Time', st_record: 'Best', st_wave: 'Wave', st_surv: 'Survived', st_best: 'Best',
        st_games: 'Games', st_bestcombo: 'Best combo', st_totaltime: 'Total time',
        surv_new_icons: 'New icons! Difficulty up',
        aim_hint: 'Tap where to use it', pu_freeze: 'Spawns frozen', pu_x2: 'Double points!', pu_bomb: 'Boom!', pu_ray: 'Ray!', pu_icons: 'icons', chain_boom: 'Chain ×{n}',
        surv_meteor: 'Icon rain!', surv_quake: 'Quake!', surv_frost: 'Frozen front', surv_life_lost: 'Life blast · -1',
        surv_boss_soon: '⚠ Boss', surv_boss_meteor_warn: 'Icon rain incoming!', surv_boss_quake_warn: 'Quake incoming!', surv_boss_frost_warn: 'Frozen front incoming!',
        near_miss: 'You were just {n} icons away!', peak_moment: 'Your best moment: +{p} with a ×{c} combo',
        sprint_on: 'Final sprint! Points ×1.5', mistake_time: 'Miss · −{n}s',
        boon_title: 'Blessing!', boon_sub: 'You beat the boss: pick an upgrade',
        boon_life: 'Extra life', boon_life_d: '+1 heart (can exceed the max)',
        boon_charge: 'Overcharge', boon_charge_d: '+50 power-up charge',
        boon_pack: 'Arsenal', boon_pack_d: '+1 bomb and +1 ray',
        boon_slow: 'Calm', boon_slow_d: 'Slower icons for 2 waves',
        boon_frenzy: 'Fury', boon_frenzy_d: 'Frenzy activated instantly!',
        route_title: 'Choose your route', route_dense: 'Demanding route', route_dense_d: 'More obstacles · points ×1.25 this chapter',
        route_calm: 'Serene route', route_calm_d: 'Slower icons · no bonus',
        relic_title: 'Boss relic', relic_sub: 'Passive for the rest of the expedition (max 3)',
        relic_combo: 'Hourglass', relic_combo_d: 'Combo window +0.4s',
        relic_crystal: 'Prism', relic_crystal_d: 'Crystals are worth +30 extra',
        relic_hint: 'Compass', relic_hint_d: '+1 hint every level',
        relic_shield: 'Shield', relic_shield_d: 'First defeat of the chapter clears 30% instead of ending',
        relic_shield_fired: 'The shield saved you! Board cleared',
        continue_title: 'Board full…', continue_sub: 'Continue for {n} gems? Clears 40% of the board (once per level)',
        continue_yes: 'Continue ({n}💎)', continue_yes_d: 'Clear 40% and keep playing',
        continue_no: 'End game', continue_done: 'You continue! Board cleared',
        classic_win_streak: 'Win streak ×{n} · +{p}% coins',
        zen_pace_title: 'Zen pace', zen_pace_slow: 'Serene', zen_pace_slow_d: 'Very slow icons, room to breathe',
        zen_pace_normal: 'Flowing', zen_pace_normal_d: 'Standard calm pace',
        pl_sub: 'Bring up to 2 power-ups (optional)', pl_play: 'Play', pl_play_cost: 'Play · {c} coins',
        pl_skip: 'No power-ups', pl_first: 'New: you can bring power-ups into levels. Tap their button in-game to use them.',
        pl_max: 'Max {n} power-ups', pl_no_coins: 'Not enough coins',
        surv_tide: 'Icon tide!', surv_boss_tide_warn: 'Tide incoming: clear the edges!',
        survmut_ice: 'Ice week: frozen traps · coins ×1.15', survmut_chaos: 'Chaos week: the quake is back', survmut_frenzy: 'Fury week: frenzy +30%',
        dmut_ice: "Today's twist: frozen board", dmut_window: "Today's twist: tighter combos", dmut_variety: "Today's twist: more icon variety", dmut_rocks: "Today's twist: rock field", dmut_fast: "Today's twist: fast pace", dmut_crystal: "Today's twist: double crystals", dmut_nohints: "Today's twist: no hints",
        dmut_ice_n: 'Ice', dmut_window_n: 'Tight combos', dmut_variety_n: 'Variety', dmut_rocks_n: 'Rocks', dmut_fast_n: 'Fast', dmut_crystal_n: 'Crystals', dmut_nohints_n: 'No hints',
        daily_streak_chest: '{n} medal days in a row! +1 chest', daily_cal_al: 'Medal calendar for the last 14 days',
        timecap_hint: 'Time capsule: detonate it by adjacency (+5s)',
        advboss_warn: 'The boss is charging its attack…',
        advboss_nebula: 'Boss volley!', advboss_asteroid: 'The boss hurls rocks!', advboss_ice: 'The boss freezes!', advboss_core: 'The boss speeds up the core!', advboss_void: 'The void devours a hint!', advboss_crystal: 'The boss regenerates!',
        exped_title: 'Your expedition',
        garden_10: '10 flowers in your garden! +1 chest', garden_50: '50 flowers! "Zen Garden" skin unlocked',
        board_excl: 'Exclusive',
        pick_back: 'Back',
        pu_row: 'Row cleared!', pu_col: 'Column cleared!', pu_no_target: 'No target', pu_wild_emergency: 'Wildcard · emergency clear', pu_wild_icons: 'Wildcard · {n} icons',
        surv_diff_title: 'Survival', surv_diff_sub: 'Choose the run pace', surv_start: 'Start survival',
        surv_frenzy: 'Frenzy', surv_frenzy_ready: 'Frenzy active!', surv_wave_reward: 'Wave {w} · +{c} coins',
        surv_milestone: 'Wave {w} milestone', surv_wave_record: 'Record! Wave {w}', surv_best_wave: 'Best wave',
        surv_rewards: 'Rewards', surv_reward_line: '+{c} coins · +{g} gems · +{ch} chests', surv_time_record: 'Survival record!',
        coins: 'coins', daily_done: 'Daily mission complete!', weekly_done: 'Weekly challenge complete!', lvl: 'Level',
        next: 'Next', new_icons: 'New icons', chapter: 'Chapter', next_to: 'Go to level {n} →', lets_play: "Let's play!",
        obj_clear: 'Clear the board', obj_score: 'Reach {n} pts', obj_survive: 'Survive {n}s', obj_boss: 'BOSS · break the 💎', obj_boss_live: 'BOSS · break the 💎 ({n})',
        biome_nebula: 'Nebula', biome_asteroid: 'Asteroid Belt', biome_ice: 'Ice Field', biome_core: 'Burning Core', biome_void: 'The Void', biome_crystal: 'Crystalia',
        biomemod_nebula: '', biomemod_asteroid: '🪨 Rocks block the board', biomemod_ice: '🧊 Frozen cells: tap to break', biomemod_core: '🔥 Icons spawn faster', biomemod_void: '🕳️ Fewer hints available', biomemod_crystal: '💎 Crystals worth extra points',
        sum_level: 'Reached level {n}', sum_time: 'Time {t}', sum_wave: 'Wave {w} · {s}s survived', sum_chapter: 'Chapter {c} · Level {n}',
        level_done: 'Level complete!', perfect_done: 'Perfect board!', level_sub: 'Level {n} cleared', perfect_sub: 'Clean board · bonus +{b}', boss_next: 'Boss ahead!',
        over_victory: '🏆 Victory!', over_surv: '🛡️ Survival over', over_fail: 'Mission failed!',
        reason_time: "Time's up!", reason_nomoves: 'No moves left · {n}% of the board filled.', reason_full: 'The board filled up.', reason_end: 'Game over.', reason_surv: 'Survived {s}s', ach_unlocked: '🏅 Achievement: {n}',
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
      DICT, // expuesto para QA/tests (paridad de claves ES/EN)
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
        r.querySelectorAll('.m-head h2[data-i18n]').forEach((el) => { el.textContent = el.textContent.replace(/^[^A-Za-z0-9¿¡]+/, '').trim(); });
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
    ice() { this.fire([6, 18, 8]); },
    quake() { this.fire([28, 28, 34, 28, 42]); },
    life() { this.fire([18, 36, 18, 22]); },
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
    match(removed, combo, mult) {
      this.eliminate(combo);
      const tier = removed >= 4 ? 4 : removed >= 3 ? 3 : mult >= 2 ? 2 : combo >= 3 ? 1 : 0;
      if (tier >= 2) this.combo(Math.min(4, tier - 1));
      if (removed >= 4) this.tone(1760, 0.07, 'sine', 0.055, 0.11);
    },
    combo(l) { const roots = [523, 587, 659, 784, 988]; const r = roots[clamp(l, 0, 4)]; this.chord([r, r * 1.26, r * 1.5], 0.14, 'sine', 0.10, 0.02); },
    rank() { this.chord([784, 1047, 1319], 0.2, 'sine', 0.12, 0.05); },
    fever() { this.chord([330, 415, 554, 659], 0.3, 'sawtooth', 0.06, 0.04); },
    milestone() { this.chord([659, 988, 1319], 0.25, 'square', 0.07, 0.06); },
    record() { this.chord([784, 988, 1175, 1568], 0.3, 'sine', 0.12, 0.07); },
    boardClear() { this.tone(196, 0.12, 'triangle', 0.08); [523, 784, 1047, 1568, 2093].forEach((f, i) => this.tone(f, 0.18, 'sine', 0.105, i * 0.045)); },
    miss() { this.tone(160, 0.12, 'sawtooth', 0.09); },
    danger() { this.tone(120, 0.09, 'sine', 0.08); },
    level() { [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.16, 'sine', 0.13, i * 0.08)); },
    over() { [392, 311, 247, 196].forEach((f, i) => this.tone(f, 0.22, 'sine', 0.15, i * 0.12)); },
    iceCrack(stage = 1) {
      const base = 820 + clamp(stage, 0, 3) * 80;
      this.tone(base, 0.045, 'square', 0.055);
      this.tone(260, 0.06, 'triangle', 0.045, 0.025);
    },
    iceBreak() { this.chord([740, 980, 1320], 0.12, 'triangle', 0.08, 0.018); this.tone(1700, 0.05, 'sine', 0.05, 0.06); },
    quake() { [72, 58, 82, 64, 94].forEach((f, i) => this.tone(f, 0.16, 'sawtooth', 0.07, i * 0.08)); },
    rain() { [988, 784, 659, 523, 392].forEach((f, i) => this.tone(f, 0.08, 'triangle', 0.07, i * 0.045)); },
    lifeBlast() { this.tone(92, 0.18, 'sawtooth', 0.08); this.chord([392, 587, 784, 1175], 0.24, 'sine', 0.09, 0.035); },
    booster(id) {
      if (id === 'freeze') { this.chord([880, 1175, 1568], 0.16, 'triangle', 0.07, 0.025); return; }
      if (id === 'bomb') { this.tone(96, 0.16, 'sawtooth', 0.10); this.tone(520, 0.08, 'square', 0.06, 0.04); return; }
      if (id === 'x2') { this.chord([659, 988, 1319], 0.14, 'square', 0.055, 0.018); return; }
      if (id === 'clearLine') { [660, 760, 860, 960].forEach((f, i) => this.tone(f, 0.055, 'triangle', 0.055, i * 0.035)); return; }
      if (id === 'wild') { this.chord([523, 784, 1047, 1568], 0.18, 'sine', 0.08, 0.03); return; }
      this.rank();
    },
  };

  /* ===================== Helpers ===================== */
  const $ = (s) => document.querySelector(s);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  /* PRNG seedeable (mulberry32). El GAMEPLAY (spawns, trampas, bonus) tira de
   * RNG.random() para que un mismo seed reproduzca el mismo tablero (reto diario,
   * replays, validación anti-trampas futura). Los efectos visuales (FX) y la
   * economía meta (cofres) siguen usando Math.random a propósito: no son reglas
   * de partida y un cofre seedeable sería explotable. */
  const RNG = {
    _s: (Math.random() * 0xffffffff) >>> 0,
    seed(v) {
      if (typeof v === 'string') { let h = 0; for (let i = 0; i < v.length; i++) h = (Math.imul(h, 31) + v.charCodeAt(i)) | 0; v = h; }
      this._s = v >>> 0;
    },
    random() {
      let t = (this._s += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
  const rand = (n) => (RNG.random() * n) | 0;
  // Hash polinomial de 32 bits (mismo algoritmo que el hashStr interno de Meta):
  // elección determinista de mutadores diarios/semanales sin servidor (GM-15/22).
  const hash32 = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0; return Math.abs(h); };
  const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  // Escapado HTML único para TODO texto interpolado en template strings que acaben en
  // innerHTML. Cualquier dato de usuario o texto variable debe pasar por aquí.
  const esc = (s) => String(s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
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
    minIcons: 99,           // mínimo de iconos alcanzado en el nivel (near-miss, GM-01)
    bestPlay: null,         // jugada pico de la partida {points, combo, removed, wave, level} (GM-28)
    spawnHoldUntil: 0,      // pausa breve de spawns (entrada en Fiebre, GM-27)
    warmupUntil: 0, warmupConvs: 0, warmupEndAt: 0, warmupDone: true, // warm-up de apertura (GM-26)
    sprintToastAt: 0,       // throttle del aviso de sprint final (GM-10)
    emptyBonusClaimed: false, emptyBoards: 0, lastActionCell: null,
    lastDangerAt: 0,        // throttle del aviso de peligro
    timePressure: 0,        // 0 normal, 1 presion, 2 critico (Contrarreloj)
    pool: [], // iconos disponibles este nivel
    tiles: [],              // capa de casillas especiales (paralela a board): null=normal
    coinsRun: 0,            // monedas ganadas en la partida en curso
  };

  /* ===================== Engine (lógica pura del tablero) ===================== */
  const Engine = {
    idx: (r, c) => r * State.size + c,
    inside: (r, c) => r >= 0 && c >= 0 && r < State.size && c < State.size,

    // Nº de iconos distintos del nivel (variedad creciente => más difícil)
    // Sube 1 icono cada 3 niveles (antes cada 2) para un ritmo más suave.
    varietyFor(level) {
      return clamp(4 + Math.floor((level - 1) / 3), 4, Math.min(8, Icons.CATALOG.length));
    },
    _window(off, n) {
      const L = Icons.CATALOG.length, a = [];
      for (let i = 0; i < n; i++) a.push(Icons.CATALOG[(off + i) % L]);
      return a;
    },
    // Ventana deslizante aditiva: avanza 1 posición por nivel, por lo que comparte
    // (n-1) iconos con el nivel anterior → introducción GRADUAL (entra 1 nuevo,
    // sale 1 viejo). Mantiene formas distintas dentro de la ventana (período 16 > 8).
    poolForLevel(level) {
      const n = this.varietyFor(level);
      const off = (level - 1) % Icons.CATALOG.length;
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
      let base = d.spawnStart * Math.pow(0.95, level - 1);
      if (m.relaxed) base *= 1.25;    // zen: más lento
      return Math.round(clamp(base, d.spawnMin, 6000));
    },

    emptyCells() {
      const out = [];
      // Una casilla sólida (roca/bloqueada/helada) NO es colocable: nunca debe recibir
      // un icono nuevo (spawnOne/placeInitial/addPenalty).
      for (let i = 0; i < State.board.length; i++) {
        if (State.board[i] === null && !State.tiles[i]) out.push(i);
      }
      return out;
    },

    /* Iconos que convergen al tocar la casilla vacía `i`.
       Devuelve los índices a eliminar (grupos con 2+ del mismo tipo). */
    converging(i) {
      // Una casilla sólida (roca/bloqueada/helada) no se puede activar.
      const ti = State.tiles[i];
      if (State.board[i] !== null || (ti && (ti.solid || ti.trigger))) return [];
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

    // Elige el id del próximo icono a aparecer. Con el tablero casi vacío sesga hacia
    // un icono igual a los presentes (prioriza el de menor count = solitarios) para
    // facilitar la convergencia; en el resto de casos, aleatorio del pool del nivel.
    _pickSpawnId() {
      const pool = State.pool;
      const randomId = () => pool[rand(pool.length)];
      const cfg = Config.CLEAR_ASSIST;
      if (State.iconCount <= 0 || State.iconCount > cfg.threshold) return randomId();
      // Cuenta los iconos presentes (ignora celdas con tile sólido por seguridad).
      const counts = Object.create(null);
      for (let i = 0; i < State.board.length; i++) {
        const v = State.board[i];
        if (v !== null && !(State.tiles[i] && State.tiles[i].solid)) counts[v] = (counts[v] || 0) + 1;
      }
      const ids = Object.keys(counts);
      if (!ids.length) return randomId();
      const p = clamp(cfg.pMax - (State.iconCount - 1) * cfg.decay, cfg.pMin, cfg.pMax);
      if (RNG.random() >= p) return randomId();
      // Elige entre los id presentes con el MENOR count (empates al azar): empareja
      // primero los solitarios, que son los que bloquean el vaciado.
      let min = Infinity;
      for (const id of ids) if (counts[id] < min) min = counts[id];
      const candidates = ids.filter((id) => counts[id] === min);
      return candidates[rand(candidates.length)];
    },

    spawnOne() {
      const empties = this.emptyCells();
      if (!empties.length) return -1;
      const idx = empties[rand(empties.length)];
      State.board[idx] = this._pickSpawnId();
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
      this.popupsEl.style.setProperty('--size', State.size); // para dimensionar .fly-glyph
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

    // Overlay de casilla especial (roca/helada/cristal/cadenas/portal…) por clase, con caché.
    setTile(i) {
      const t = State.tiles[i], type = t ? t.type : '', def = t ? Tiles.DEFS[type] : null;
      const key = t ? type + ':' + (t.taps != null ? t.taps : '') + ':' + (t.hits != null ? t.hits : '') : '';
      if (this._cellTile[i] === key) return;
      this._cellTile[i] = key;
      const el = this.cells[i];
      const cls = def ? def.cls : '';
      Tiles.CLASSES.forEach((c) => el.classList.toggle(c, c === cls));
      el.classList.remove('ice-1', 'ice-2', 'ice-3');
      if (type === 'frozen') el.classList.add('ice-' + clamp(t.taps || 1, 1, 3));
      if (type !== 'rock') el.classList.remove('rock-cracked');
      // Glifo de objetos especiales/obstáculos con etiqueta propia (p. ej. "+30").
      el.dataset.tileGlyph = (def && def.trigger) ? def.glyph : '';
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

    spawnAnim(i) {
      const el = this.cells[i];
      // Limpia un posible estado de "clear" en curso: si un icono aparece en una
      // casilla que se acaba de vaciar (carrera spawn↔convergencia a alta velocidad),
      // el icono nuevo NO debe heredar la animación glyph-out ni quedar invisible.
      el.classList.remove('spawn', 'clear');
      void el.offsetWidth;
      el.classList.add('spawn');
    },
    clearAnim(indices, target) {
      // Vuelo de convergencia: si se conoce la casilla tocada, los iconos "viajan"
      // hacia ella antes del estallido (visualiza la metáfora del juego).
      if (target != null) this.convergeFly(indices, target);
      // La explosión del icono crece con la racha de combo (frenesí en el tablero):
      // suave en combos bajos y cada vez más violenta/llamativa al subir. SIN giro,
      // solo escala de "boom" (estallido) y overshoot.
      const combo = Math.max(1, State.combo || 1);
      const t = clamp((combo - 1) / 19, 0, 1);        // 0..1 ramp sobre combo 1..20
      const snap = (0.45 - t * 0.38).toFixed(2);      // colapso del pop 0.45 → 0.07 (más seco a más combo)
      indices.forEach(i => {
        const el = this.cells[i];
        el.style.setProperty('--clear-snap', snap);
        // El fondo se vacía YA, a la vez que el icono inicia su pop (sin delay): la
        // casilla pasa a 'empty' al instante; el glyph (icono) sigue presente y se
        // borra al terminar la animación de salida. Race-safe: si entre medias
        // aparece un icono nuevo, su syncCell vuelve a poner has-icon.
        if (State.board[i] === null) { el.classList.remove('has-icon'); el.classList.toggle('empty', !State.tiles[i]); }
        el.classList.add('clear');
        el.addEventListener('animationend', () => {
          el.classList.remove('clear');
          // Borra el glyph al acabar el pop. Race-safe: si entre medias apareció un
          // icono nuevo (spawn/penalización), board[i]!==null y NO se toca.
          if (State.board[i] === null) this.setGlyph(i, null);
        }, { once: true });
      });
    },
    // Clones de los iconos convergentes volando hacia la casilla tocada (WAAPI,
    // compositor-only: solo transform/opacity). Pool propio en la capa de popups.
    _flyPool: null, _flyNext: 0,
    convergeFly(indices, target) {
      if (Settings.reducedFx) return;
      if (!this._flyPool) {
        this._flyPool = [];
        for (let k = 0; k < 8; k++) {
          const s = document.createElement('span');
          s.className = 'fly-glyph';
          s.setAttribute('aria-hidden', 'true');
          this.popupsEl.appendChild(s);
          this._flyPool.push(s);
        }
      }
      const size = State.size;
      const w = this.popupsEl.clientWidth || 0; if (!w) return;
      const cellPx = w / size;
      const tr = (target / size | 0), tc = target % size;
      indices.forEach((i) => {
        const id = this._cellId[i]; if (!id) return;   // aún no borrado (se borra al final del pop)
        const r = (i / size | 0), c = i % size;
        const s = this._flyPool[this._flyNext = (this._flyNext + 1) % this._flyPool.length];
        s.innerHTML = Icons.svg(id);
        s.style.left = ((c + 0.5) / size * 100) + '%';
        s.style.top = ((r + 0.5) / size * 100) + '%';
        const dx = (tc - c) * cellPx, dy = (tr - r) * cellPx;
        s.getAnimations().forEach((a) => a.cancel());
        s.animate([
          { opacity: .95, transform: 'translate(-50%,-50%) scale(.92)' },
          { opacity: .8, transform: `translate(calc(-50% + ${dx * 0.85}px), calc(-50% + ${dy * 0.85}px)) scale(.5)`, offset: .8 },
          { opacity: 0, transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.2)` },
        ], { duration: 230, easing: 'cubic-bezier(.3,.7,.4,1)', fill: 'forwards' });
      });
    },

    miss(i) { const el = this.cells[i]; el.classList.remove('miss'); void el.offsetWidth; el.classList.add('miss'); },

    iceHit(i) {
      const el = this.cells[i];
      el.classList.remove('ice-hit'); void el.offsetWidth; el.classList.add('ice-hit');
      setTimeout(() => el.classList.remove('ice-hit'), 360);
    },
    iceBreak(i) {
      const el = this.cells[i];
      el.classList.remove('ice-hit', 'ice-shatter'); void el.offsetWidth; el.classList.add('ice-shatter');
      setTimeout(() => el.classList.remove('ice-shatter'), 520);
    },
    cellPulse(i, cls, ms = 700) {
      const el = this.cells[i]; if (!el) return;
      el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
      setTimeout(() => el.classList.remove(cls), ms);
    },
    boardEvent(cls, ms = 900) {
      const w = document.querySelector('.board-wrap'); if (!w) return;
      w.classList.remove(cls); void w.offsetWidth; w.classList.add(cls);
      setTimeout(() => w.classList.remove(cls), ms);
    },
    impact(tier = 1) {
      if (Settings.reducedFx) return;
      const cls = tier >= 3 ? 'impact-heavy' : tier >= 2 ? 'impact-mid' : 'impact-soft';
      this.boardEvent(cls, tier >= 3 ? 360 : 260);
    },
    lifeClear(indices) {
      this.boardEvent('life-blast', 900);
      indices.forEach(i => this.cellPulse(i, 'life-cleared', 820));
    },
    meteor(indices) { indices.forEach(i => this.cellPulse(i, 'surv-meteor', 820)); },
    boosterPulse(id) {
      this.boardEvent('boost-' + id, id === 'freeze' || id === 'x2' ? 1100 : 780);
      const b = document.querySelector(`.booster[data-b="${id}"]`);
      if (b) { b.classList.remove('fired'); void b.offsetWidth; b.classList.add('fired'); setTimeout(() => b.classList.remove('fired'), 520); }
    },
    boosterReady(id) {
      if (Settings.reducedFx) return;
      const bar = $('#booster-bar');
      if (bar) { bar.classList.remove('grant'); void bar.offsetWidth; bar.classList.add('grant'); setTimeout(() => bar.classList.remove('grant'), 720); }
      const b = document.querySelector(`.booster[data-b="${id}"]`);
      if (b) { b.classList.remove('just-granted'); void b.offsetWidth; b.classList.add('just-granted'); setTimeout(() => b.classList.remove('just-granted'), 760); }
    },

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
      const timed = Config.MODES[State.mode].timed;
      timeEl.textContent = timed ? fmtTime(State.timeLeft) : fmtTime(State.elapsed);
      const pressure = timed && State.status === 'playing' ? (State.timeLeft <= 10 ? 2 : State.timeLeft <= 20 ? 1 : 0) : 0;
      if (pressure !== State.timePressure) {
        State.timePressure = pressure;
        document.body.classList.toggle('time-pressure', pressure > 0);
        document.body.classList.toggle('time-critical', pressure === 2);
        if (pressure === 2) {
          this.boardEvent('time-pressure', 520); Sound.danger();
          // Sprint final (GM-10): anunciar el ×1.5 al entrar en zona crítica. Con
          // throttle: cabalgar el borde hace oscilar la presión y no debe spamear.
          const now = performance.now();
          if (Config.MODES[State.mode].scoreAttack && now - State.sprintToastAt > 6000) {
            State.sprintToastAt = now;
            Toasts.show(I18n.t('sprint_on'), 'warn', 1700, 'fire');
          }
        }
      }
      if (timeEl.parentElement) timeEl.parentElement.classList.toggle('urgent', pressure === 2);
      // Ghost personal (GM-12): ¿vas por delante o por detrás de tu mejor intento?
      { const gEl = $('#hud-ghost');
        if (gEl) {
          let show = false;
          if (Config.MODES[State.mode].scoreAttack && State.status === 'playing' && State.elapsed >= 10) {
            const ref = State.isDaily ? Meta.dailyGhost() : Meta.modeGhost(State.mode);
            if (ref && ref.length) {
              const gi = Math.min(ref.length - 1, Math.max(0, Math.floor(State.elapsed / 10) - 1));
              const diff = State.score - ref[gi];
              gEl.textContent = (diff >= 0 ? '▲ +' : '▼ −') + Math.abs(diff);
              gEl.classList.toggle('up', diff >= 0);
              show = true;
            }
          }
          gEl.hidden = !show;
        } }
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
      this.multChip();
    },
    // Chip del multiplicador TOTAL (combo × fiebre × temporal): un único número
    // legible junto al score que responde "¿por cuánto vale ahora cada jugada?" (GM-16).
    _lastMult: 1,
    multChip() {
      const el = $('#hud-mult'); if (!el) return;
      const v = State.comboMult * Game.feverBoost() * (State.tempMult || 1) * Game.sprintMult();
      const txt = '×' + (v % 1 === 0 ? v : +v.toFixed(1));
      const on = v > 1.001 && State.status === 'playing';
      if (el.textContent !== txt) {
        el.textContent = txt;
        if (on && v > this._lastMult && !Settings.reducedFx) {
          el.getAnimations().forEach(a => a.cancel());
          el.animate([{}, { transform: 'scale(1.24)', offset: .5 }, {}], { duration: 260, easing: 'ease' });
        }
      }
      el.classList.toggle('on', on);
      el.classList.toggle('hot', on && v >= 6);
      this._lastMult = v;
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
      this.multChip();
      const el = $('#combo');
      if (State.combo < 3) { el.hidden = true; el.setAttribute('aria-hidden', 'true'); el.classList.remove('urgent'); return; }
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
      const el = $('#combo');
      if (el) el.classList.toggle('urgent', State.combo >= 3 && frac < 0.24);
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
      // El aro de combo "arde" mientras dura la Fiebre (GM-27).
      const c = $('#combo'); if (c && c.classList) c.classList.toggle('fever', on);
    },
    // Entrada en Fiebre (GM-27): zoom + barrido de acento del tablero, una sola vez.
    feverBurst() {
      if (Settings.reducedFx) return;
      const w = document.querySelector('.board-wrap'); if (!w) return;
      w.classList.remove('fever-burst'); void w.offsetWidth; w.classList.add('fever-burst');
      setTimeout(() => w.classList.remove('fever-burst'), 640);
    },
    // Salida de Fiebre (GM-27): "exhalación" breve (desaturación de vuelta a la calma).
    feverOut() {
      if (Settings.reducedFx) return;
      const w = document.querySelector('.board-wrap'); if (!w) return;
      w.classList.remove('fever-out'); void w.offsetWidth; w.classList.add('fever-out');
      setTimeout(() => w.classList.remove('fever-out'), 360);
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
  // Variante con throttle para eventos de juego frecuentes (convergencias): evita saturar
  // al lector de pantalla en cadenas rápidas. Los hitos importantes usan announce() directo.
  let _srLast = 0;
  const announceGame = (msg, ms = 1400) => { const t = Date.now(); if (t - _srLast < ms) return; _srLast = t; announce(msg); };
  const Toasts = {
    ICON: { info: 'info', good: 'check', warn: 'warning', bad: 'close' },
    show(msg, kind = 'info', ms = 2800, iconArg, onClick) {
      const el = $('#toasts'); if (!el) return;
      // Si el mensaje empieza por un emoji (y no se pasó icono), úsalo como icono del toast.
      if (iconArg == null) {
        const m = msg.match(/^(\p{Extended_Pictographic}️?)\s+/u);
        if (m) { iconArg = m[1]; msg = msg.slice(m[0].length); }
      }
      const ic = iconArg != null ? iconArg : (this.ICON[kind] || '');
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
      if (ic) {
        const s = document.createElement('span'); s.className = 'toast-ic';
        const tok = EMOJI_IMG[ic] || (/^(v2:)?[a-z][a-z0-9-]*$/.test(ic) ? ic : null);
        if (tok) s.innerHTML = iconAny(tok); else s.textContent = ic;
        t.appendChild(s);
      }
      const tx = document.createElement('span'); tx.className = 'toast-tx'; tx.textContent = msg; t.appendChild(tx);
      // Toast accionable: un toque ejecuta la acción y lo cierra (auto-sugerencia de FX).
      if (typeof onClick === 'function') {
        t.classList.add('actionable');
        t.addEventListener('click', () => { clearTimeout(t._t); this._out(t); onClick(); });
      }
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
      document.body.classList.add('modal-open');
      $('#overlay').hidden = false;
      document.querySelectorAll('.modal').forEach(m => m.hidden = m.id !== id);
      const m = $('#' + id);
      const focusable = m.querySelector('button:not([disabled]), [href], input');
      if (focusable) focusable.focus();
    },
    close() {
      document.body.classList.remove('modal-open');
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
    _emit(x, y, vx, vy, g, life, size, color, shape, spin, delay) {
      if (!this.supported || this.active >= this.cap) return;
      const p = this._slot(); if (!p) return;
      const el = p.el;
      el.style.width = size + 'px';
      el.style.height = (shape === 1 ? size * 0.6 : size) + 'px';
      el.style.background = color;
      el.style.borderRadius = shape === 1 ? '1px' : '50%';
      // Partículas redondas/cuadradas: sin estrella ni glow. Se resetea SIEMPRE
      // para no contaminar ranuras reutilizadas por las estrellas (burst, confeti…).
      this._setStar(el, false); el.style.filter = 'none'; el.style.transformOrigin = '50% 50%';
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
      try { anim = el.animate(frames, { duration: life * 1000, delay: delay || 0, easing: 'linear', fill: delay ? 'both' : 'forwards' }); }
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
    // Bonus de tablero limpio en modos de tablero continuo: explosión radial
    // desde el tablero, no lluvia desde arriba, para comunicar "lo vaciaste aquí".
    boardClear(centerIdx, color) {
      if (Settings.reducedFx || !this.supported) return;
      this.syncBoardRect();
      const r = this.boardRect;
      if (!r || !r.width) return;
      const C = ['#ffd84d', '#34e29b', '#00d0ff', '#ff5cf0', '#ffb24d', '#eaf0ff'];
      const origin = centerIdx != null ? this.cellXY(centerIdx) : { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const radius = Math.max(r.width, r.height) * 0.72;
      if (this.wave) {
        const w = Math.round(r.width * 1.1);
        this.wave.style.width = w + 'px'; this.wave.style.height = w + 'px';
        this.wave.style.borderColor = color || '#ffd84d';
        this.wave.style.boxShadow = '0 0 18px ' + (color || '#ffd84d') + ', inset 0 0 18px ' + (color || '#ffd84d');
        const wt = (sc) => 'translate3d(' + (cx - w / 2).toFixed(1) + 'px,' + (cy - w / 2).toFixed(1) + 'px,0) scale(' + sc + ')';
        try {
          this.wave.animate([
            { transform: wt(0.1), opacity: 0, offset: 0, easing: 'ease-out' },
            { transform: wt(0.34), opacity: 0.9, offset: 0.18, easing: 'cubic-bezier(.15,.6,.3,1)' },
            { transform: wt(1.18), opacity: 0, offset: 1 },
          ], { duration: 760, fill: 'forwards' });
        } catch (_) {}
      }
      const n = Math.min(34, this.cap);
      for (let k = 0; k < n; k++) {
        const a = (k / n) * 6.283 + (Math.random() - 0.5) * 0.22;
        const dist = radius * (0.62 + Math.random() * 0.48);
        const tx = cx + Math.cos(a) * dist, ty = cy + Math.sin(a) * dist;
        const col = C[k % C.length];
        if (k % 3 === 0) this._flyStar(origin.x, origin.y, tx, ty, 8 + Math.random() * 5, col, Math.random() * 70, 720 + Math.random() * 180);
        else this._emit(origin.x, origin.y, Math.cos(a) * (260 + Math.random() * 280), Math.sin(a) * (260 + Math.random() * 280) - 80, 520, 0.82 + Math.random() * 0.32, 6 + Math.random() * 5, col, 1, (Math.random() - 0.5) * 720);
      }
    },
    // Duración del efecto ambiental (onda + camino), sincronizado con styles.css.
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
      this._setStar(el, true); el.style.filter = 'none'; el.style.transformOrigin = '50% 50%';
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
      this._setStar(el, true); el.style.filter = 'drop-shadow(0 0 3px ' + color + ')'; el.style.transformOrigin = '50% 50%';
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
    _beam(x0, y0, x1, y1, color, delay, dur) {
      if (!this.supported || this.active >= this.cap) return;
      const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy);
      if (len < 8) return;
      const p = this._slot(); if (!p) return;
      const el = p.el;
      el.style.width = len.toFixed(1) + 'px';
      el.style.height = '3px';
      el.style.borderRadius = '999px';
      el.style.background = 'linear-gradient(90deg, rgba(255,255,255,.08), ' + color + ', rgba(255,255,255,.04))';
      el.style.transformOrigin = '0 50%';
      el.style.filter = 'drop-shadow(0 0 5px ' + color + ')';
      this._setStar(el, false);
      const angle = Math.atan2(dy, dx) * 180 / Math.PI;
      const tr = (sc) => 'translate3d(' + x0.toFixed(1) + 'px,' + y0.toFixed(1) + 'px,0) rotate(' + angle.toFixed(2) + 'deg) scaleX(' + sc + ')';
      p.busy = true; this.active++;
      let anim;
      try {
        anim = el.animate([
          { transform: tr(0.05), opacity: 0, offset: 0 },
          { transform: tr(1), opacity: .9, offset: .18, easing: 'ease-out' },
          { transform: tr(1), opacity: .35, offset: .58 },
          { transform: tr(.98), opacity: 0, offset: 1 },
        ], { duration: dur || this.DUR_CLEAR, delay: delay || 0, fill: 'both' });
      } catch (_) { p.busy = false; this.active--; return; }
      p.anim = anim;
      const done = () => { if (p.busy) { p.busy = false; this.active = Math.max(0, this.active - 1); } el.style.opacity = '0'; };
      anim.onfinish = done; anim.oncancel = done;
    },
    // Estallido del icono al "reventar": esquirlas que salen disparadas en todas
    // direcciones. La cantidad y la velocidad CRECEN con la racha de combo (suave
    // en combos bajos, violento al subir). delay = momento del chasquido del icono.
    _iconBurst(x, y, color) {
      const t = clamp(((State.combo || 1) - 1) / 19, 0, 1);   // 0..1 sobre combo 1..20
      const n = Math.round(7 + t * 13);                       // 7 → 20 esquirlas (bien visibles)
      const spMax = 150 + t * 320;                            // velocidad crece con el combo
      const life = 0.26 + t * 0.08;
      for (let k = 0; k < n; k++) {
        const a = Math.random() * 6.283, sp = spMax * (0.4 + Math.random() * 0.6);
        this._emit(x, y, Math.cos(a) * sp, Math.sin(a) * sp, 280, life, 4 + Math.random() * 4, color, 0, 0);
      }
    },
    scoreToHud(centerIdx, color, tier) {
      if (Settings.reducedFx || !this.supported) return;
      this.syncBoardRect();
      const hud = $('#hud-score');
      if (!hud) return;
      const hr = hud.getBoundingClientRect();
      if (!hr.width) return;
      const from = this.cellXY(centerIdx);
      const tx = hr.left + hr.width / 2, ty = hr.top + hr.height / 2;
      const n = Math.min(6, 2 + Math.max(0, tier || 0));
      for (let k = 0; k < n; k++) {
        this._flyStar(
          from.x + (Math.random() - 0.5) * 10,
          from.y + (Math.random() - 0.5) * 10,
          tx + (Math.random() - 0.5) * 20,
          ty + (Math.random() - 0.5) * 14,
          5 + Math.random() * 4,
          color || '#ffd84d',
          80 + k * 36,
          460 + Math.random() * 120
        );
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

      // 2) Estallido de esquirlas en cada icono eliminado (la "explosión"; tiene
      // PRIORIDAD de ranuras) + camino de estrellitas hacia el icono. El icono se
      // elimina con su propio "pop seco" (glyph-out), no crece.
      for (const idx of cells) {
        const ir = (idx / sz) | 0, ic = idx % sz;
        const ip = rcXY(ir, ic);
        this._beam(C.x, C.y, ip.x, ip.y, color, 0, this.DUR_CLEAR * 0.78);
        this._iconBurst(ip.x, ip.y, color);
        const dr = Math.sign(ir - cr), dc = Math.sign(ic - cc);
        const N = Math.max(Math.abs(ir - cr), Math.abs(ic - cc));  // distancia en celdas
        for (let d = 0.6; d <= N - 0.4 + 1e-6; d += 0.5) {
          const pos = rcXY(cr + dr * d, cc + dc * d);
          this._spark(pos.x, pos.y, tiny, color, (d / N) * SWEEP);
        }
      }

      // 3) Toque de "celebración": mini-estrellitas desde el centro (secundario).
      this._miniBurst(C.x, C.y, color, cellPx);
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
    const SCHEMA = 3;
    const def = { _v: SCHEMA, xp: 0, level: 1, games: 0, totalRemoved: 0, coins: 0, gems: 0, tickets: 0, chests: 0, achievements: {}, daily: { date: '' }, streak: { count: 0, date: '' }, reward: { date: '', day: 0 }, adventure: { maxLevel: 1 }, worlds: {}, boards: { owned: { classic: 1 }, equipped: 'classic' }, survBest: 0, survBestWave: 0, stats: { totalScore: 0, bestCombo: 0, totalTime: 0 }, modes: {}, weekly: { week: '', id: '', progress: 0, done: false }, mastery: { classicPerfect: 0, bestClassicPerfect: 0 }, cosmetics: { owned: {}, theme: 'default', skin: 'default', fx: 'default' } };
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
    if (!m.mastery) m.mastery = { classicPerfect: 0, bestClassicPerfect: 0 };
    if (typeof m.mastery.classicPerfect !== 'number') m.mastery.classicPerfect = 0;
    if (typeof m.mastery.bestClassicPerfect !== 'number') m.mastery.bestClassicPerfect = 0;
    if (!m.dailyRun) m.dailyRun = { date: '', best: 0, plays: 0 }; // reto diario (tablero seedeado por fecha)
    if (typeof m.coins !== 'number') m.coins = 0;
    if (typeof m.survBestWave !== 'number') m.survBestWave = 0;
    // Esquema 3: economía ampliada (gemas/tickets/cofres), tableros de tienda y mundos del modo Clásico.
    if (typeof m.gems !== 'number') m.gems = 0;
    if (typeof m.tickets !== 'number') m.tickets = 0;
    if (typeof m.chests !== 'number') m.chests = 0;
    if (!m.worlds || typeof m.worlds !== 'object') m.worlds = {};
    if (!m.boards || typeof m.boards !== 'object') m.boards = { owned: { classic: 1 }, equipped: 'classic' };
    if (!m.boards.owned) m.boards.owned = { classic: 1 };
    m.boards.owned.classic = 1; // el tablero Clásico es siempre propiedad (gratis)
    if (!m.boards.equipped || !m.boards.owned[m.boards.equipped]) m.boards.equipped = 'classic';
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
      { id: 'variety5', name: 'Explorador', desc: 'Juega los 5 modos principales', t: () => ['clasico', 'aventura', 'contrarreloj', 'supervivencia', 'zen'].every(k => ((m.modes[k] && m.modes[k].plays) || 0) > 0) },
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
      // Racha de VICTORIAS de Clásico (GM-05): niveles seguidos completados; solo la
      // derrota la reinicia (salir/pausar no castiga). Bonus de monedas +10%/nivel
      // de racha desde la 2ª victoria seguida, tope +50%.
      classicWinStreak: () => m.mastery.winStreak || 0,
      recordClassicWin(won) {
        if (!m.mastery) m.mastery = {};
        m.mastery.winStreak = won ? (m.mastery.winStreak || 0) + 1 : 0;
        save();
        return m.mastery.winStreak;
      },
      classicPerfectStreak: () => m.mastery.classicPerfect || 0,
      classicBestPerfectStreak: () => m.mastery.bestClassicPerfect || 0,
      recordClassicPerfect(perfect) {
        const before = m.mastery.classicPerfect || 0;
        m.mastery.classicPerfect = perfect ? before + 1 : 0;
        if (m.mastery.classicPerfect > (m.mastery.bestClassicPerfect || 0)) m.mastery.bestClassicPerfect = m.mastery.classicPerfect;
        save();
        return { streak: m.mastery.classicPerfect, best: m.mastery.bestClassicPerfect || 0, changed: before !== m.mastery.classicPerfect, perfect: !!perfect };
      },
      // ---- Economía (monedas) ----
      coins: () => m.coins || 0,
      addCoins(n) { m.coins = (m.coins || 0) + Math.max(0, n | 0); save(); return m.coins; },
      spend(n) { n = n | 0; if ((m.coins || 0) < n) return false; m.coins -= n; save(); return true; },
      // ---- Economía (gemas: divisa premium) ----
      gems: () => m.gems || 0,
      addGems(n) { m.gems = (m.gems || 0) + Math.max(0, n | 0); save(); return m.gems; },
      spendGems(n) { n = n | 0; if ((m.gems || 0) < n) return false; m.gems -= n; save(); return true; },
      // ---- Economía (tickets: entradas a partidas especiales) ----
      tickets: () => m.tickets || 0,
      addTickets(n) { m.tickets = (m.tickets || 0) + Math.max(0, n | 0); save(); return m.tickets; },
      spendTicket(n) { n = (n | 0) || 1; if ((m.tickets || 0) < n) return false; m.tickets -= n; save(); return true; },
      // ---- Cofres (se acumulan sin abrir; openChest entrega recompensa) ----
      chests: () => m.chests || 0,
      addChest(n) { m.chests = (m.chests || 0) + Math.max(1, n | 0); save(); return m.chests; },
      openChest() {
        if ((m.chests || 0) <= 0) return null;
        m.chests--;
        // Recompensa ponderada: la mayoría monedas, a veces gemas, raro un ticket.
        const roll = Math.random();
        let reward;
        if (roll < 0.62) reward = { kind: 'coins', amount: 60 + Math.floor(Math.random() * 140) };
        else if (roll < 0.92) reward = { kind: 'gems', amount: 3 + Math.floor(Math.random() * 8) };
        else reward = { kind: 'ticket', amount: 1 };
        if (reward.kind === 'coins') m.coins = (m.coins || 0) + reward.amount;
        else if (reward.kind === 'gems') m.gems = (m.gems || 0) + reward.amount;
        else m.tickets = (m.tickets || 0) + reward.amount;
        save();
        return reward;
      },
      // ---- Cofre premium: sumidero de gemas. Mejor tabla, sin gemas (sería circular). ----
      PREMIUM_CHEST_GEMS: 25,
      openPremiumChest() {
        if (!this.spendGems(this.PREMIUM_CHEST_GEMS)) return null;
        const roll = Math.random();
        let reward;
        if (roll < 0.55) reward = { kind: 'coins', amount: 200 + Math.floor(Math.random() * 300) };
        else if (roll < 0.85) reward = { kind: 'ticket', amount: 2 };
        else reward = { kind: 'coins', amount: 600 + Math.floor(Math.random() * 400) }; // jackpot
        if (reward.kind === 'coins') m.coins = (m.coins || 0) + reward.amount;
        else m.tickets = (m.tickets || 0) + reward.amount;
        save();
        return reward;
      },
      // ---- Reto diario: mismo tablero para todos (semilla = fecha). ----
      DAILY_FIRST_GEMS: 5,
      dailyMedal(score) {
        score = Math.max(0, score | 0);
        return score >= 2500 ? 'gold' : score >= 1500 ? 'silver' : score >= 750 ? 'bronze' : 'none';
      },
      dailyRunInfo() {
        const d = today();
        if (m.dailyRun.date !== d) return { date: d, best: 0, plays: 0 };
        const info = Object.assign({}, m.dailyRun);
        info.medal = this.dailyMedal(info.best);
        return info;
      },
      recordDailyRun(score) {
        const d = today();
        const fresh = m.dailyRun.date !== d;
        // El historial y el ghost sobreviven al cambio de día (GM-14/12).
        const hist = m.dailyRun.history || {};
        const rewarded = m.dailyRun.streakRewarded || 0;
        if (fresh) m.dailyRun = { date: d, best: 0, plays: 0, history: hist, streakRewarded: rewarded };
        if (!m.dailyRun.history) m.dailyRun.history = hist;
        m.dailyRun.plays++;
        const newBest = score > m.dailyRun.best;
        if (newBest) m.dailyRun.best = score | 0;
        if (fresh) m.gems = (m.gems || 0) + this.DAILY_FIRST_GEMS; // premio por el primer intento del día
        // Calendario de medallas (GM-14): la mejor medalla de cada día, tope 60 días FIFO.
        m.dailyRun.history[d] = this.dailyMedal(m.dailyRun.best);
        const keys = Object.keys(m.dailyRun.history).sort();
        while (keys.length > 60) delete m.dailyRun.history[keys.shift()];
        // Racha de medallas: hito cada 7 días seguidos → +1 cofre (una sola vez por hito).
        const streak = this.dailyStreak();
        let streakChest = false;
        if (streak < (m.dailyRun.streakRewarded || 0)) m.dailyRun.streakRewarded = 0; // racha nueva: re-armar hitos
        if (streak > 0 && streak % 7 === 0 && (m.dailyRun.streakRewarded || 0) < streak) {
          m.dailyRun.streakRewarded = streak;
          m.chests = (m.chests || 0) + 1;
          streakChest = true;
        }
        save();
        return { firstToday: fresh, newBest, best: m.dailyRun.best, medal: this.dailyMedal(score), bestMedal: this.dailyMedal(m.dailyRun.best), streak, streakChest };
      },
      // Racha de medallas del reto (GM-14): días consecutivos con medalla ≥ bronce.
      // ÉTICA: 1 "congelación" de regalo + 1 extra por cada 7 días de racha — un día
      // perdido no borra la racha (se pausa); dos seguidos sin margen, sí.
      dailyStreak() {
        const h = (m.dailyRun && m.dailyRun.history) || {};
        const key = (dt) => dt.toISOString().slice(0, 10);
        let day = new Date();
        const todayMedal = h[key(day)];
        if (!todayMedal || todayMedal === 'none') day = new Date(day.getTime() - 86400000);
        let streak = 0, freezes = 1;
        for (let i = 0; i < 90; i++) {
          const med = h[key(day)];
          if (med && med !== 'none') { streak++; if (streak % 7 === 0) freezes++; }
          else if (freezes > 0) freezes--;
          else break;
          day = new Date(day.getTime() - 86400000);
        }
        return streak;
      },
      // Últimos `n` días como [{date, medal}] para el calendario compacto (GM-14).
      dailyCalendar(n) {
        const h = (m.dailyRun && m.dailyRun.history) || {};
        const out = [];
        for (let i = (n || 14) - 1; i >= 0; i--) {
          const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
          out.push({ date: d, medal: h[d] || 'none' });
        }
        return out;
      },
      // ---- Ghost personal (GM-12): línea de tiempo de score del mejor intento. ----
      modeGhost: (mode) => (m.modes[mode] && m.modes[mode].ghost) || null,
      setModeGhost(mode, samples) { const md = m.modes[mode] || (m.modes[mode] = { best: 0, plays: 0 }); md.ghost = (samples || []).slice(0, 60); save(); },
      dailyGhost() { return (m.dailyRun && m.dailyRun.date === today() && m.dailyRun.ghost) || null; },
      setDailyGhost(samples) { m.dailyRun.ghost = (samples || []).slice(0, 60); save(); },
      // ---- Jardín zen (GM-23): colección sin fallo posible — cada tablero limpio
      // en Zen suma una flor; los hitos regalan (cofre a las 10, skin a las 50). ----
      zenFlowers: () => (m.zen && m.zen.flowers) || 0,
      addZenFlower() { if (!m.zen) m.zen = { flowers: 0 }; m.zen.flowers++; save(); return m.zen.flowers; },
      grantBoard(id) { if (!m.boards.owned[id]) { m.boards.owned[id] = 1; save(); return true; } return false; },
      // ---- Reroll de la misión diaria: sumidero de tickets (1 por cambio). ----
      rerollDaily() {
        const cur = dailyMission(); // asegura que exista la misión de hoy
        if (cur.done || !this.spendTicket(1)) return null;
        const idx = MISSIONS.findIndex((x) => x.id === cur.id);
        const next = MISSIONS[(idx + 1) % MISSIONS.length];
        m.daily = { date: today(), id: next.id, progress: 0, done: false };
        save();
        return Object.assign({}, next, m.daily);
      },
      // ---- Cosméticos (propiedad y equipado) ----
      cosmetics: () => m.cosmetics,
      owns: (id) => id === 'default' || !!(m.cosmetics.owned && m.cosmetics.owned[id]),
      buy(id, cost) { if (this.owns(id)) return true; if (!this.spend(cost)) return false; m.cosmetics.owned[id] = today(); save(); return true; },
      equip(slot, id) { if (!this.owns(id)) return false; m.cosmetics[slot] = id; save(); return true; },
      // ---- Tableros de la tienda (propiedad y equipado) ----
      boardsOwned: () => m.boards.owned,
      ownsBoard: (id) => id === 'classic' || !!(m.boards.owned && m.boards.owned[id]),
      equippedBoard: () => m.boards.equipped || 'classic',
      buyBoard(id, cost) {
        if (this.ownsBoard(id)) return true;
        if (!this.spend(cost)) return false;
        m.boards.owned[id] = 1; save(); return true;
      },
      equipBoard(id) { if (!this.ownsBoard(id)) return false; m.boards.equipped = id; save(); return true; },
      // ---- Progresión del modo Clásico (mundos × niveles, estrellas 0..3) ----
      worldData: (wid) => (m.worlds[wid] || (m.worlds[wid] = { levels: {} })),
      levelStars(wid, lvl) { const w = m.worlds[wid]; return (w && w.levels && w.levels[lvl]) || 0; },
      worldStars(wid) { const w = m.worlds[wid]; if (!w || !w.levels) return 0; let s = 0; for (const k in w.levels) s += w.levels[k] || 0; return s; },
      worldCleared(wid) { const w = m.worlds[wid]; if (!w || !w.levels) return 0; let n = 0; for (const k in w.levels) if (w.levels[k] > 0) n++; return n; },
      worldMaxLevel(wid) { const w = m.worlds[wid]; if (!w || !w.levels) return 1; let mx = 0; for (const k in w.levels) if (w.levels[k] > 0 && +k > mx) mx = +k; return Math.min(mx + 1, 50); },
      setLevelStars(wid, lvl, stars) {
        const w = m.worlds[wid] || (m.worlds[wid] = { levels: {} });
        if (!w.levels) w.levels = {};
        const prev = w.levels[lvl] || 0;
        if (stars > prev) { w.levels[lvl] = stars; save(); return stars - prev; }
        return 0;
      },
      // ---- Recompensa diaria ----
      rewardReady: () => m.reward.date !== today(),
      rewardDay: () => m.reward.day || 0,
      advMax: () => (m.adventure && m.adventure.maxLevel) || 1,
      advReach(level) { if (level > ((m.adventure && m.adventure.maxLevel) || 1)) { m.adventure.maxLevel = level; save(); } },
      // Intro de capítulo vista (una vez por capítulo). Campo nuevo tolerante a esquema.
      advChapterSeen(ch) { return !!(m.adventure && m.adventure.seen && m.adventure.seen[ch]); },
      markAdvChapterSeen(ch) { if (!m.adventure.seen) m.adventure.seen = {}; if (!m.adventure.seen[ch]) { m.adventure.seen[ch] = 1; save(); } },
      survBest: () => m.survBest || 0,
      survRecord(sec) { sec = Math.floor(sec); if (sec > (m.survBest || 0)) { m.survBest = sec; save(); return true; } return false; },
      survBestWave: () => m.survBestWave || 0,
      survWaveRecord(wave) { wave = Math.max(0, wave | 0); if (wave > (m.survBestWave || 0)) { m.survBestWave = wave; save(); return true; } return false; },
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

  /* ===================== Econ (barra de economía reutilizable) =====================
   * Actualiza CUALQUIER elemento con data-econ="coins|gems|streak|tickets|chests"
   * en toda la app (home, selección de modo, mapa Clásico, juego). Una sola llamada
   * Econ.refresh() sincroniza todas las píldoras visibles con el estado de Meta.
   */
  const Econ = {
    ICONS: { coins: 'coin', gems: 'gem', streak: 'fire', tickets: 'ticket', chests: 'chest' },
    valueOf(kind) {
      switch (kind) {
        case 'coins': return Meta.coins();
        case 'gems': return Meta.gems();
        case 'streak': return Meta.streak();
        case 'tickets': return Meta.tickets();
        case 'chests': return Meta.chests();
        default: return 0;
      }
    },
    refresh(root) {
      const scope = root || document;
      scope.querySelectorAll('[data-econ]').forEach((el) => {
        const kind = el.dataset.econ;
        el.innerHTML = (this.ICONS[kind] ? iconInline(this.ICONS[kind]) + ' ' : '') + this.valueOf(kind);
      });
      // Pills del nuevo sistema base: solo el número (el icono es un SVG aparte).
      scope.querySelectorAll('[data-econ-num]').forEach((el) => { el.textContent = this.valueOf(el.dataset.econNum); });
      updateSinkBadges();
    },
  };
  // Badges de descubribilidad de sumideros de economía: avisan de que puedes gastar gemas
  // (cofre premium, 25💎) o tickets (reroll de misión diaria). Se recalculan en cada
  // Econ.refresh, así que reaccionan a cualquier cambio de la economía sin cableado extra.
  function updateSinkBadges() {
    const md = $('#missions-dot');
    if (md) {
      const d = Meta.dailyMission(), w = Meta.weeklyChallenge();
      const rerollable = d && !d.done && Meta.tickets() > 0;
      md.hidden = !((d && d.done) || (w && w.done) || rerollable);
    }
    const cd = $('#chests-dot');
    if (cd) cd.hidden = Meta.gems() < Meta.PREMIUM_CHEST_GEMS;
  }

  /* ===================== Iconos PNG (pack "Free Icon Pack" de @gvesster, en img/ui) =====================
   * Reemplazan a los emojis por toda la UI. `icon()` rellena su contenedor (data-art,
   * .econ-ic, emblemas de modal…); `iconInline()` se mete dentro de texto (precios,
   * toasts, leaderboard). Las fichas del tablero siguen siendo SVG (ver Icons).
   */
  const ICONS_DIR = 'img/ui';
  const icon = (name, cls) => `<img class="ic${cls ? ' ' + cls : ''}" src="${ICONS_DIR}/${name}.png" alt="" draggable="false">`;
  const iconInline = (name) => icon(name, 'ic-inline');
  const ICONS_V2_DIR = 'img/icons-v2';
  const V2_ICONS = {
    'mode-classic': '8-ui/grid',
    'mode-survival': '3-gear/shield',
    'mode-multi': '8-ui/user-group',
    cactus: '4-nature/cactus',
    mountain: '4-nature/mountain',
    town: '6-buildings/town',
    meteor: '4-nature/meteor',
    snowflake: '4-nature/snowflake',
    'circle-ring': '8-ui/circle-ring',
    rest: '8-ui/rest',
    brush: '10-editing/brush',
    double: '1-game/double',
    'mobile-phone': '9-media/mobile-phone',
    font: '10-editing/font',
    radiation: '12-misc/radiation',
    link: '9-media/link',
    connection: '9-media/connection',
    prohibited: '8-ui/prohibited',
    drought: '4-nature/drought',
    download: '9-media/download',
    share: '9-media/share',
    notification: '9-media/notification',
    'wi-fi': '9-media/wi-fi',
    'four-pointed-star': '12-misc/four-pointed-star',
    flag: '6-buildings/flag',
    'arrow-left': '8-ui/arrow-left',
    play: '9-media/play',
    pause: '9-media/pause',
    refresh: '8-ui/refresh',
    cross: '8-ui/cross',
  };
  const iconV2Path = (name) => `${ICONS_V2_DIR}/${V2_ICONS[name] || name}.svg`;
  const iconV2 = (name, cls) => `<span class="icv2${cls ? ' ' + cls : ''}" style="--icv2-url:url('${iconV2Path(name)}')" aria-hidden="true"></span>`;
  const iconV2Inline = (name) => iconV2(name, 'icv2-inline');
  const isV2Icon = (name) => typeof name === 'string' && name.startsWith('v2:');
  const iconAny = (name, cls) => isV2Icon(name) ? iconV2(name.slice(3), cls) : icon(name, cls);
  const iconAnyInline = (name) => isV2Icon(name) ? iconV2Inline(name.slice(3)) : iconInline(name);
  // Estructuras que guardan un glyph emoji: si la id tiene equivalente PNG se usa; si no, se mantiene el emoji.
  const MODE_IMG    = { tutorial: 'book', clasico: 'pin', aventura: 'rocket', contrarreloj: 'clock', supervivencia: 'heart', zen: 'v2:rest' };
  const BIOME_IMG   = { nebula: 'planet', asteroid: 'v2:meteor', ice: 'v2:snowflake', core: 'planet-hell', void: 'v2:circle-ring', crystal: 'crystal' };
  const WORLD_IMG   = { bosque: 'leaf', desierto: 'v2:cactus', montana: 'v2:mountain', cueva: 'potion', neon: 'v2:town' };
  const BOOSTER_IMG = { bomb: 'bomb', freeze: 'v2:snowflake', clearLine: 'bolt', wild: 'v2:brush', x2: 'v2:double' };
  // Emojis sueltos (novedades de mundo, toasts, resúmenes) con icono equivalente en el pack.
  const EMOJI_IMG   = { '🎯': 'target', '💎': 'crystal', '🌀': 'teleporter', '💣': 'bomb', '🎁': 'gift', '⚡': 'bolt', '➕': 'plus', '🔒': 'lock', '🏆': 'trophy', '🪙': 'coin', '🏅': 'medal', '⬆️': 'upgrade', '🗓️': 'calendar', '✅': 'check', '🔥': 'fire', '⭐': 'star', '🌟': 'star', '👑': 'crown', '🧊': 'v2:snowflake', '❄️': 'v2:snowflake', '☣️': 'v2:radiation', '⛓️': 'v2:link', '🕸️': 'v2:connection', '🚧': 'v2:prohibited', '🟫': 'v2:drought', '🏜️': 'v2:cactus', '🏔️': 'v2:mountain', '🏙️': 'v2:town', '🪨': 'v2:meteor', '🕳️': 'v2:circle-ring', '🧹': 'v2:brush', '🃏': 'v2:double', '📳': 'v2:mobile-phone', '🔠': 'v2:font', '📲': 'v2:download', '📤': 'v2:share', '🔔': 'v2:notification', '📶': 'v2:wi-fi', '🎉': 'v2:four-pointed-star', '✨': 'v2:four-pointed-star', '🏁': 'v2:flag' };
  // <img> en línea si el emoji tiene equivalente; si no, el propio emoji (texto).
  const emojiIcon = (e) => EMOJI_IMG[e] ? iconAnyInline(EMOJI_IMG[e]) : e;

  /* ===================== Art (ilustraciones SVG hechas a mano, 0 imágenes externas) =====================
   * Librería de SVGs fieles a los mockups: avatar robot, cohete, regalo, trofeo,
   * tableros, VS, isla, corazón+enemigos, libro e iconos de navegación. Cada función
   * devuelve un <svg> inline que rellena su contenedor. Se reutilizan en Inicio,
   * Selección de modo y (a futuro) el resto del juego.
   */
  const Art = {
    _s(inner, vb) { return `<svg viewBox="${vb || '0 0 100 100'}" width="100%" height="100%" fill="none" aria-hidden="true" focusable="false">${inner}</svg>`; },
    // --- Tokens de 1 concepto: ahora PNG del pack (img/ui) ---
    avatar() { return icon('player'); },
    plus() { return icon('plus'); },
    coin() { return icon('coin'); },
    gem() { return icon('gem'); },
    fire() { return icon('fire'); },
    pencil() { return icon('pencil'); },
    gift() { return icon('gift'); },
    rocket() { return icon('rocket'); },
    trophy() { return icon('trophy'); },
    chest() { return icon('chest'); },
    book() { return icon('book'); },
    target() { return icon('target'); },
    calendar() { return icon('calendar'); },
    crownLock() { return icon('crown'); },
    friends() { return icon('friend'); },
    medal() { return icon('medal'); },
    cart() { return icon('cart'); },
    home() { return icon('house'); },
    gear() { return icon('settings'); },
    // --- Sin equivalente de 1 icono en el pack: se mantienen como SVG propio ---
    bell() { return this._s(`<path d="M50 18 C36 18 30 28 30 42 C30 60 22 64 22 70 H78 C78 64 70 60 70 42 C70 28 64 18 50 18 Z" fill="#d7e2ff" stroke="#9fb0e0" stroke-width="3"/><circle cx="50" cy="78" r="7" fill="#d7e2ff"/><rect x="46" y="10" width="8" height="8" rx="4" fill="#d7e2ff"/>`); },
    // Ilustraciones compuestas (tarjetas de modo / inicio): se mantienen como SVG
    boardMini() { return iconV2('mode-classic'); },
    island() { return iconV2('mode-classic'); },
    heartFoes() { return iconV2('mode-survival'); },
    vsBalls() { return iconV2('mode-multi'); },
    vsPeople() { return iconV2('mode-multi'); },
    // (target/calendar/crownLock/friends/medal/cart/home/gear → ya definidos arriba como icon())
  };


  const Tiles = {
    DEFS: {
      rock:     { glyph: '🪨', solid: true,  cls: 'tile-rock',     desc: 'Roca: estorba y no converge' },
      locked:   { glyph: '🔒', solid: true,  cls: 'tile-locked',   desc: 'Bloqueada' },
      frozen:   { glyph: '🧊', solid: true,  cls: 'tile-frozen', taps: 2, breakable: true, desc: 'Helada: toca para descongelar' },
      // `infected` retirado en V1 (nunca tuvo lógica de propagación). Reintroducir con ROADMAP 3.4.
      crystal:  { glyph: '💎', solid: false, cls: 'tile-crystal', bonus: 3, desc: 'Vale puntos extra' },
      // --- Obstáculos del mockup ---
      chains:   { glyph: '⛓️', solid: true,  cls: 'tile-chains', taps: 2, breakable: true, desc: 'Cadenas: toca 2 veces para liberar' },
      web:      { glyph: '🕸️', solid: true,  cls: 'tile-web',    taps: 2, breakable: true, desc: 'Telaraña: toca 2 veces para liberar' },
      barrier:  { glyph: '🚧', solid: true,  cls: 'tile-barrier', desc: 'Barrera: sólo se quita con objetos especiales' },
      mud:      { glyph: '🟫', solid: false, cls: 'tile-mud',    taps: 2, breakable: true, desc: 'Lodo: ralentiza y cuesta limpiar' },
      // --- Objetos especiales del mockup (tap = efecto) ---
      bonus:    { glyph: '+30', trigger: 'bonus',    cls: 'tile-bonus',    desc: 'Bonus: +30 puntos al instante' },
      portal:   { glyph: '🌀',  trigger: 'portal',   cls: 'tile-portal',   desc: 'Portal: teletransporta una figura' },
      magicbox: { glyph: '🎁',  trigger: 'magicbox', cls: 'tile-magicbox', desc: 'Caja mágica: libera figuras cercanas' },
      bomb:      { glyph: '💣',  trigger: 'bomb',      cls: 'tile-bomb',      desc: 'Bomba oculta: detona figuras cercanas' },
      slowdown:  { glyph: '⏳',  trigger: 'slowdown',  cls: 'tile-slowdown',  desc: 'Ralentizador: reduce la velocidad de aparición' },
      timecap:   { glyph: '⏰',  trigger: 'timecap',   cls: 'tile-timecap',   desc: 'Cápsula: +5s al detonarla por adyacencia' },
    },
    // Lista de clases CSS de casilla (para limpiar/aplicar en Render.setTile).
    CLASSES: ['tile-rock', 'tile-locked', 'tile-frozen', 'tile-crystal', 'tile-chains', 'tile-web', 'tile-barrier', 'tile-mud', 'tile-bonus', 'tile-portal', 'tile-magicbox', 'tile-bomb', 'tile-slowdown', 'tile-timecap'],
    make(type) { const d = this.DEFS[type]; return d ? Object.assign({ type }, d) : null; },
  };

  /* ===================== Boosters (potenciadores) =====================
   * Catálogo de potenciadores. `apply(ctx)` se conecta en la Fase 5 (Supervivencia).
   */
  const Boosters = {
    DEFS: {
      bomb:      { name: 'Bomba',       glyph: '💣', start: 2, desc: 'Elimina una zona 3×3' },
      freeze:    { name: 'Congelación', glyph: '❄️', start: 2, desc: 'Pausa la aparición de figuras' },
      clearLine: { name: 'Rayo',        glyph: '⚡', start: 3, desc: 'Elimina una fila o columna' },
      wild:      { name: 'Escoba',       glyph: '🧹', start: 2, desc: 'Limpia el grupo más repetido' },
      x2:        { name: 'Comodín',      glyph: '🃏', start: 1, desc: 'Duplica los puntos un tiempo' },
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

  /* ===================== Boards (tableros comprables de la tienda) =====================
   * Son cosmeticos puros: cambian marco, patron y color de casillas, sin tocar reglas,
   * puntuacion, economia, spawns, dificultad ni power-ups.
   */
  const Boards = {
    DEFS: {
      classic:   { name: 'Tablero Clásico',    cost: 0,    sw: 'linear-gradient(135deg,#1b2a52,#2f6bff)', chars: ['Marco espacial azul', 'Casillas limpias y legibles'] },
      // Exclusivo del Jardín Zen (GM-23): se gana con 50 flores, no se compra.
      jardin:    { name: 'Jardín Zen',        cost: 0, exclusive: true, sw: 'linear-gradient(135deg,#1d3a24,#9be15d 60%,#ffb7d5)', chars: ['Se gana con 50 flores zen', 'Pétalos y musgo en calma'] },
      madera:    { name: 'Tablero de Madera',  cost: 500,  sw: 'linear-gradient(135deg,#5a3a1e,#a86a36)', chars: ['Vetas cálidas de madera', 'Marco artesanal'] },
      hielo:     { name: 'Tablero de Hielo',   cost: 800,  sw: 'linear-gradient(135deg,#2a6a9e,#9fe6ff)', chars: ['Cristal frío y brillo polar', 'Casillas translúcidas'] },
      lava:      { name: 'Tablero de Lava',    cost: 1200, sw: 'linear-gradient(135deg,#7a1e10,#ff5b2e)', chars: ['Roca oscura y magma', 'Borde incandescente'] },
      cristal:   { name: 'Tablero de Cristal', cost: 1500, sw: 'linear-gradient(135deg,#5a2a8e,#c08bff)', chars: ['Prismas violetas', 'Destellos de vidrio'] },
      magico:    { name: 'Tablero Mágico',     cost: 2000, sw: 'linear-gradient(135deg,#3a1e6e,#8a5cff)', chars: ['Runas arcanas sutiles', 'Brillo encantado'] },
      futurista: { name: 'Tablero Futurista',  cost: 2500, sw: 'linear-gradient(135deg,#0e3a4a,#19f0d0)', chars: ['Circuitos neón', 'Paneles tecnológicos'] },
      dorado:    { name: 'Tablero Dorado',     cost: 3000, sw: 'linear-gradient(135deg,#7a5a10,#ffd84d)', chars: ['Oro pulido', 'Detalles premium'] },
      bosque:    { name: 'Tablero del Bosque', cost: 1800, sw: 'linear-gradient(135deg,#1e4a2a,#6bd36b)', chars: ['Textura de hojas', 'Tonos naturales'] },
      cosmico:   { name: 'Tablero Cósmico',    cost: 2200, sw: 'linear-gradient(135deg,#2a1a5e,#a06bff)', chars: ['Nebulosa profunda', 'Estrellas en el marco'] },
    },
    order: ['classic', 'madera', 'hielo', 'lava', 'cristal', 'magico', 'futurista', 'dorado', 'bosque', 'cosmico', 'jardin'],
    apply(id) {
      const current = id || Meta.equippedBoard();
      ['#screen-game', '.board-wrap', '#board'].forEach((sel) => {
        const el = $(sel);
        if (el) el.dataset.board = current;
      });
    },
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

    /* ---- Rutas de capítulo (GM-06) y reliquias de jefe (GM-07) ----
     * La identidad "expedición": el jugador COMPONE su run. Ruta = trade-off del
     * capítulo (más obstáculos por más puntos, o calma sin bonus). Reliquia =
     * pasiva de run ganada al superar un jefe (máx. 3, FIFO). Estado de run
     * volátil: no persiste en RunSave/Meta (una expedición interrumpida retoma
     * el nivel, no las elecciones). */
    ROUTES: [
      { id: 'dense', icon: '🪨' },   // +obstáculos → puntos ×1.25 (visible en el chip)
      { id: 'calm', icon: '🌿' },    // spawn ×1.15 más lento, sin bonus
    ],
    RELICS: [
      { id: 'combo', icon: '⏱️' },   // ventana de combo +400ms
      { id: 'crystal', icon: '💎' }, // cristales valen +30 extra
      { id: 'hint', icon: '🔍' },    // +1 pista por nivel
      { id: 'shield', icon: '🛡️' },  // 1ª derrota del capítulo: despeje 30% en vez de fin
    ],
    route: null, relics: [], shieldUsed: false, _routeChapter: -1, log: [],
    resetRun() { this.route = null; this.relics = []; this.shieldUsed = false; this._routeChapter = -1; this.log = []; this.bossAcc = 0; this._bossWarned = false; },
    hasRelic(id) { return this.relics.indexOf(id) !== -1; },
    _applyRoute() {
      if (this.route === 'calm') State.spawnRate = Math.round(State.spawnRate * 1.15);
      else if (this.route === 'dense') {
        State.tempMult = 1.25; // bonus legible en el chip de multiplicador (GM-16)
        const biome = this.biomeOf(State.level);
        if (biome.mods.includes('rocks')) this._placeOnEmpty('rock', 0.05);
        else if (biome.mods.includes('ice')) this._placeFrozen(0.05);
        else if (biome.mods.includes('crystals')) this._placeCrystals(2);
        else this._placeOnEmpty('rock', 0.04);
        Render.syncAll();
      }
    },
    maybeOfferRoute(level) {
      if (this.licOf(level) !== 0) return;
      const ch = this.chapterOf(level);
      if (this._routeChapter === ch) return;
      this._routeChapter = ch;
      const biome = this.biomeOf(level);
      Picker.open({
        title: I18n.t('route_title'), sub: I18n.t('chapter') + ' ' + (ch + 1) + ' · ' + this.biomeName(biome), accent: biome.accent,
        options: this.ROUTES.map((r) => ({ id: r.id, icon: r.icon, name: I18n.t('route_' + r.id), desc: I18n.t('route_' + r.id + '_d') })),
        onPick: (id) => {
          this.route = id;
          this._applyRoute();
          this.log.push({ t: 'ch', n: ch + 1, biome: biome.id, route: id }); // registro (GM-09)
          Toasts.show(I18n.t('route_' + id), 'good', 1600, '🧭');
          this.banner(level);
        },
      });
    },
    offerRelic(then) {
      const have = new Set(this.relics);
      const pool = this.RELICS.filter((r) => !have.has(r.id));
      if (!pool.length) { if (then) then(); return; }
      const opts = []; const bag = pool.slice();
      while (opts.length < 3 && bag.length) opts.push(bag.splice(rand(bag.length), 1)[0]);
      Sound.milestone();
      Picker.open({
        title: I18n.t('relic_title'), sub: I18n.t('relic_sub'), accent: '#b46cff',
        options: opts.map((r) => ({ id: r.id, icon: r.icon, name: I18n.t('relic_' + r.id), desc: I18n.t('relic_' + r.id + '_d') })),
        onPick: (id) => {
          if (this.relics.length >= 3) this.relics.shift(); // se sustituye la más antigua
          this.relics.push(id);
          if (id === 'combo') State.comboWindow += 400; // efecto inmediato; setup lo re-deriva por nivel
          this.log.push({ t: 'relic', id }); // registro (GM-09)
          Toasts.show(I18n.t('relic_' + id), 'good', 1900, '🏺');
          Sound.record(); Haptics.milestone();
          if (then) then();
        },
      });
    },
    // Registro de expedición (GM-09): la run como historia contable en el resumen.
    expeditionHtml() {
      if (!this.log.length) return '';
      const parts = this.log.map((e) => {
        if (e.t === 'ch') {
          const bi = this.BIOMES.find((b) => b.id === e.biome) || {};
          return `${bi.glyph || ''} C${e.n} · ${esc(I18n.t('route_' + e.route))}`;
        }
        const relic = this.RELICS.find((r) => r.id === e.id) || {};
        return `${relic.icon || '🏺'} ${esc(I18n.t('relic_' + e.id))}`;
      });
      return `<b>${esc(I18n.t('exped_title'))}</b><span>${parts.join(' → ')}</span>`;
    },
    // Jefe con comportamiento (GM-08): en niveles jefe, cada 20s el bioma ACTÚA
    // (telegrafiado 3s antes). El jefe deja de ser "más cristales": hace cosas.
    BOSS_MS: 20000, bossAcc: 0, _bossWarned: false,
    onTick(dt) {
      if (this.objective !== 'boss' || State.status !== 'playing') return;
      this.bossAcc += dt;
      if (!this._bossWarned && this.bossAcc >= this.BOSS_MS - 3000) {
        this._bossWarned = true;
        Toasts.show(I18n.t('advboss_warn'), 'warn', 1900, '⚠️');
        Render.boardEvent('surv-wave-soon', 620);
        Sound.danger();
      }
      if (this.bossAcc >= this.BOSS_MS) { this.bossAcc -= this.BOSS_MS; this._bossWarned = false; this.bossAction(); }
    },
    _placeK(type, k) { const e = this._emptyIdx(); for (let x = 0; x < k && e.length; x++) State.tiles[e.splice(rand(e.length), 1)[0]] = Tiles.make(type); },
    _freezeK(k) { const f = this._filledIdx(); for (let x = 0; x < k && f.length; x++) State.tiles[f.splice(rand(f.length), 1)[0]] = Tiles.make('frozen'); },
    bossAction() {
      const b = this.biomeOf(State.level).id;
      if (b === 'asteroid') this._placeK('rock', 2);
      else if (b === 'ice') this._freezeK(2);
      else if (b === 'core') State.spawnRate = Math.max(300, Math.round(State.spawnRate * 0.9));
      else if (b === 'void') { State.hintsLeft = Math.max(0, State.hintsLeft - 1); Render.hud(); }
      else if (b === 'crystal') { if (this.crystalsLeft() < 6) { this._placeCrystals(1); this.refreshGoal(); } }
      else { for (let k = 0; k < 3; k++) Engine.spawnOne(); } // nebulosa: andanada
      Render.syncAll(); Render.boardShake();
      Toasts.show(I18n.t('advboss_' + b), 'bad', 1800, this.biomeOf(State.level).glyph);
      Sound.quake(); Haptics.quake();
      if (State.status === 'playing') Game.evaluate();
    },

    setup(level) {
      const biome = this.biomeOf(level), lic = this.licOf(level), chapter = this.chapterOf(level), boss = this.isBoss(level);
      this.levelScore0 = State.score; this.levelStart = State.elapsed;
      this.bossAcc = 0; this._bossWarned = false; // reloj del jefe activo (GM-08)
      // Frontera de capítulo: la ruta anterior caduca (se vuelve a elegir) y el
      // escudo de reliquia se recarga (es "1ª derrota DEL CAPÍTULO", GM-06/07).
      if (lic === 0 && chapter !== this._routeChapter) { this.route = null; State.tempMult = 1; this.shieldUsed = false; }
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
      // Efectos de run elegidos por el jugador (GM-06/07), tras los del bioma.
      if (this.route) this._applyRoute();
      if (this.hasRelic('combo')) State.comboWindow += 400;
      if (this.hasRelic('hint')) State.hintsLeft = Math.min(9, State.hintsLeft + 1);
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
      const relicsHtml = this.relics.length
        ? `<span class="obj-relics" aria-label="${esc(I18n.t('relic_title'))}">${this.relics.map((id) => ((this.RELICS.find((r) => r.id === id) || {}).icon || '')).join('')}</span>`
        : '';
      el.innerHTML = `<span class="obj-biome">${BIOME_IMG[biome.id] ? iconAnyInline(BIOME_IMG[biome.id]) : biome.glyph} ${I18n.t('chapter')} ${this.chapterOf(level) + 1} · ${this.biomeName(biome)}</span><span class="obj-goal" id="obj-goal">${this.objectiveText()}</span>${relicsHtml}${ModeSignals.noteHtml('aventura')}`;
    },
    refreshGoal() { const g = $('#obj-goal'); if (g) g.textContent = this.objectiveText(); },
    // Intro de capítulo: una tarjeta de bioma (nombre, modificadores, objetivo) mostrada
    // una sola vez la primera vez que se entra en un capítulo. Congela el juego hasta
    // descartarla (tap). Se salta si ya se vio o si no es el primer nivel del capítulo.
    maybeChapterIntro(level, then) {
      const ov = $('#chapter-intro'); if (!ov) return false;
      if (this.licOf(level) !== 0) return false;
      const chapter = this.chapterOf(level);
      if (Meta.advChapterSeen(chapter)) return false;
      Meta.markAdvChapterSeen(chapter);
      const biome = this.biomeOf(level);
      ov.style.setProperty('--mode-accent', biome.accent);
      const set = (sel, html) => { const e = ov.querySelector(sel); if (e) e.innerHTML = html; };
      set('.ci-glyph', BIOME_IMG[biome.id] ? iconAnyInline(BIOME_IMG[biome.id]) : biome.glyph);
      set('.ci-chapter', esc(I18n.t('chapter') + ' ' + (chapter + 1)));
      set('.ci-name', esc(this.biomeName(biome)));
      set('.ci-mods', esc(this.biomeModText(biome) || I18n.t('ci_no_mods')));
      set('.ci-goal', esc(this.objectiveText()));
      ov.hidden = false;
      State.status = 'paused'; // congela spawns/reloj mientras se lee la intro
      const close = () => {
        ov.hidden = true;
        ov.removeEventListener('click', close);
        if (State.status === 'paused') State.status = 'playing';
        // Tras la intro, la cadena de elecciones del capítulo (reliquia/ruta, GM-06/07).
        if (then) then(); else this.maybeOfferRoute(level);
      };
      ov.addEventListener('click', close);
      return true;
    },
  };

  /* ===================== Survival (Supervivencia 2.0: oleadas, vidas, boosters, trampas) ===================== */
  const Survival = {
    WAVE_MS: 22000, MAX_LIVES: 3, CHARGE_PER: 9, BOOSTERS: ['bomb', 'freeze', 'clearLine', 'wild', 'x2'],
    ROCK_CAP: 10, ROCK_HITS: 2,   // las rocas NO son permanentes: tope de cobertura + se rompen por convergencia adyacente
    // Tabla de escalado por dificultad (curva "perfecta", iterable desde un solo sitio).
    // waveMs: duración de oleada · lives: vidas · spawnDecay/Floor: aceleración de spawns ·
    // trapBase/Cap: densidad de trampas (·oleada) · varEvery: cada cuántas oleadas suben los iconos ·
    // bossEvery: cadencia de jefe · coinMult: multiplicador de recompensa.
    TUNE: {
      facil:   { waveMs: 32000, lives: 4, spawnDecay: 0.985, spawnFloor: 2000, trapBase: 0.008, trapCap: 0.05, varEvery: 8, bossEvery: 8, coinMult: 0.85 },
      normal:  { waveMs: 28000, lives: 3, spawnDecay: 0.975, spawnFloor: 1400, trapBase: 0.010, trapCap: 0.07, varEvery: 6, bossEvery: 6, coinMult: 1.0 },
      dificil: { waveMs: 22000, lives: 3, spawnDecay: 0.960, spawnFloor: 900,  trapBase: 0.016, trapCap: 0.10, varEvery: 5, bossEvery: 5, coinMult: 1.3 },
    },
    tune() { return this.TUNE[State.diff] || this.TUNE.normal; },
    // Nivel efectivo de dificultad: sube con las oleadas y MANDA sobre el catálogo de
    // iconos (Engine.poolForLevel/varietyFor) → entran iconos más difíciles y se dejan
    // atrás los fáciles; además escala la puntuación base.
    dlevel() { return 1 + Math.floor((this.wave - 1) / this.tune().varEvery); },
    lives: 3, wave: 1, waveAcc: 0, survSec: 0, charge: 0, frenzy: 0, frenzyUntil: 0, freezeUntil: 0, x2Until: 0, lockUntil: 0,
    runCoins: 0, runGems: 0, runChests: 0, newWaveRecord: false,
    inv: {},
    _r: {},
    start() {
      const tn = this.tune();
      this.WAVE_MS = tn.waveMs; this.MAX_LIVES = tn.lives;
      this.lives = this.MAX_LIVES; this.wave = 1; this.waveAcc = 0; this.survSec = 0; this.charge = 0; this.frenzy = 0;
      this.freezeUntil = 0; this.x2Until = 0; this.frenzyUntil = 0; this.lockUntil = 0; this.runCoins = 0; this.runGems = 0; this.runChests = 0; this.newWaveRecord = false; this.revives = 0; State.tempMult = 1; this._r = { waveWarned: false, bossWarned: false };
      this.armed = null; this._preview = null; document.body.classList.remove('aiming');
      this.slowWaves = 0; this._boonAt = 0;
      this.mut = this.weeklyMut(); // mutador semanal (GM-22)
      if (this.mut.id !== 'none') Toasts.show(I18n.t('survmut_' + this.mut.id), 'info', 2400, '📅');
      this._planBoss();
      this._setFrenzyClass();
      // Progresión de iconos desde la oleada 1: la puntuación base usa State.level (= dlevel).
      State.level = this.dlevel();
      State.pool = Engine.poolForLevel(State.level);
      // Inventario inicial de power-ups (consumibles por partida), según el mockup.
      this.inv = {}; this.BOOSTERS.forEach((id) => { this.inv[id] = Boosters.DEFS[id].start || 0; });
      this.buildBar(); this.render();
    },
    cleanup() {
      this.disarm();
      this.frenzyUntil = 0; this.x2Until = 0; this.freezeUntil = 0; this.lockUntil = 0;
      State.tempMult = 1;
      document.body.classList.remove('aiming', 'surv-frenzy-active', 'surv-frenzy-1', 'surv-frenzy-2', 'surv-frenzy-3');
    },
    // Telegrafiado del jefe (GM-18): si la PRÓXIMA oleada trae evento jefe, se decide
    // ya el tipo (pre-roll) para poder avisar de forma específica antes de que llegue.
    // La anticipación es la mitad del valor emocional del jefe; sin aviso solo hay susto.
    bossNext: false, _nextBoss: null,
    // Pool de eventos jefe (GM-20): la Marea sustituye al terremoto — amenaza
    // legible con counterplay (despejar las filas marcadas) en vez de azar
    // bidireccional. El quake solo vuelve en la "semana del caos" (GM-22).
    _bossPool() {
      const pool = ['meteor', 'tide', 'frost'];
      if (this.weeklyMut().id === 'chaos') pool.push('quake');
      return pool;
    },
    _planBoss() {
      this.bossNext = (this.wave + 1) % this.tune().bossEvery === 0;
      const pool = this._bossPool();
      this._nextBoss = this.bossNext ? pool[rand(pool.length)] : null;
    },
    // Mutador semanal (GM-22): hashStr(semana ISO) elige un tema determinista sin
    // servidor — cada semana el modo tiene una razón nueva de visita.
    WEEKLY_MUTS: [
      { id: 'none' },
      { id: 'ice', coinMult: 1.15 },   // trampas siempre heladas · monedas ×1.15
      { id: 'chaos' },                 // el terremoto vuelve al pool de jefes
      { id: 'frenzy', frenzyDur: 1.3 },// frenesí +30% de duración
    ],
    _mutOverride: null,                // el simulador fija 'none' (reproducibilidad)
    _weekKey() { const d = new Date(); const day = (d.getDay() + 6) % 7; return new Date(d - day * 86400000).toISOString().slice(0, 10); },
    weeklyMut() {
      if (this._mutOverride) return this.WEEKLY_MUTS.find((x) => x.id === this._mutOverride) || this.WEEKLY_MUTS[0];
      return this.WEEKLY_MUTS[hash32('survmut:' + this._weekKey()) % this.WEEKLY_MUTS.length];
    },
    // Bendiciones post-jefe (GM-17): sobrevivir a un evento jefe abre una elección
    // de 1 entre 3 mejoras. El jefe pasa de molestia aleatoria a ciclo miedo→codicia,
    // y la run gana dirección de build (la decisión estratégica que faltaba al modo).
    BOONS: [
      { id: 'life', icon: '❤️' },     // +1 vida (tope MAX+1)
      { id: 'charge', icon: '⚡' },   // +50 de carga
      { id: 'pack', icon: '💣' },     // +1 bomba y +1 rayo
      { id: 'slow', icon: '🐌' },     // spawn ×1.15 más lento 2 oleadas
      { id: 'frenzy', icon: '🔥' },   // frenesí instantáneo
    ],
    slowWaves: 0, _boonAt: 0, mut: { id: 'none' },
    spawnFactor() { return this.slowWaves > 0 ? 1.15 : 1; },
    offerBoons() {
      const pool = this.BOONS.filter((b) => b.id !== 'life' || this.lives < this.MAX_LIVES + 1);
      const opts = []; const bag = pool.slice();
      while (opts.length < 3 && bag.length) opts.push(bag.splice(rand(bag.length), 1)[0]);
      if (!opts.length) return;
      Sound.milestone(); Haptics.milestone();
      Picker.open({
        title: I18n.t('boon_title'), sub: I18n.t('boon_sub'), accent: '#ffd24d',
        options: opts.map((b) => ({ id: b.id, icon: b.icon, name: I18n.t('boon_' + b.id), desc: I18n.t('boon_' + b.id + '_d') })),
        onPick: (id) => this.applyBoon(id),
      });
    },
    applyBoon(id) {
      if (id === 'life') this.lives = Math.min(this.MAX_LIVES + 1, this.lives + 1);
      else if (id === 'charge') { this.charge += 50; if (this.charge >= 100) { this.charge -= 100; this.grantRandom(); } }
      else if (id === 'pack') { this.inv.bomb = (this.inv.bomb || 0) + 1; this.inv.clearLine = (this.inv.clearLine || 0) + 1; this.buildBar(); }
      else if (id === 'slow') this.slowWaves = 2;
      else if (id === 'frenzy') this.activateFrenzy();
      Toasts.show(I18n.t('boon_' + id), 'good', 1800, '✨');
      Sound.record(); Haptics.milestone();
      this.render();
    },
    frenzyTier() { return clamp(Math.floor((this.wave - 1) / 4) + 1, 1, 3); },
    frenzyActive() { return performance.now() < this.frenzyUntil; },
    frenzyMult() { return this.frenzyActive() ? 1.55 + this.frenzyTier() * 0.1 : 1; },
    _syncMult() { State.tempMult = (this.x2Active() ? 2 : 1) * this.frenzyMult(); Render.multChip(); },
    _syncIntensity() {
      if (!Settings.music) return;
      const base = 0.12 + Math.min(0.55, (this.wave - 1) * 0.045);
      Music.setIntensity(clamp(base + (this.frenzyActive() ? 0.35 : 0), 0, 1));
    },
    _setFrenzyClass() {
      const inSurv = State.mode === 'supervivencia' && State.status === 'playing';
      const active = inSurv && this.frenzyActive();
      document.body.classList.toggle('surv-frenzy-active', active);
      for (let i = 1; i <= 3; i++) document.body.classList.toggle('surv-frenzy-' + i, inSurv && this.frenzyTier() === i);
      Render.fever(!!(State.fever || active));
    },
    addFrenzy(n) {
      if (this.frenzyActive()) return;
      this.frenzy = Math.min(100, this.frenzy + Math.max(0, n || 0));
      if (this.frenzy >= 100) this.activateFrenzy();
    },
    activateFrenzy() {
      this.frenzy = 0;
      this.frenzyUntil = performance.now() + (7200 + this.frenzyTier() * 900) * (this.mut.frenzyDur || 1);
      this._syncMult(); this._setFrenzyClass(); this._syncIntensity();
      for (let k = 0; k < 2 + this.frenzyTier(); k++) Engine.spawnOne();
      Render.syncAll(); Render.fever(true); Render.flash(); FX.confetti(36);
      Toasts.show(I18n.t('surv_frenzy_ready'), 'warn', 1800, 'fire');
      Sound.fever(); Haptics.fever(); this.render();
    },
    _waveReward(clearedWave) {
      if (clearedWave <= 0) return;
      const coins = Math.max(3, Math.round((4 + clearedWave * 1.45) * this.tune().coinMult * (this.mut.coinMult || 1)));
      Meta.addCoins(coins); State.coinsRun += coins; this.runCoins += coins; Econ.refresh();
      Toasts.show(I18n.t('surv_wave_reward').replace('{w}', clearedWave).replace('{c}', coins), 'good', 1700, 'coin');
      if (clearedWave % 5 === 0) {
        let txt;
        if (clearedWave % 10 === 0) { Meta.addChest(1); this.runChests++; txt = '+1 ' + I18n.t('tab_chests'); Toasts.show(I18n.t('surv_milestone').replace('{w}', clearedWave) + ' · ' + txt, 'good', 2300, 'chest'); }
        else { const gems = 2 + Math.floor(clearedWave / 5); Meta.addGems(gems); this.runGems += gems; txt = '+' + gems; Toasts.show(I18n.t('surv_milestone').replace('{w}', clearedWave) + ' · ' + txt, 'good', 2300, 'gem'); }
        Render.flash(); FX.confetti(70); Sound.record(); Haptics.record(); Econ.refresh();
      }
    },
    _checkWaveRecord() {
      if (this.wave <= 1) return;
      if (Meta.survWaveRecord(this.wave)) {
        this.newWaveRecord = true;
        Toasts.show(I18n.t('surv_wave_record').replace('{w}', this.wave), 'good', 2200, 'trophy');
        Render.flash(); FX.confetti(80); Sound.record(); Haptics.record();
      }
    },
    // Goteo de power-ups: al llenarse la barra de carga, regala uno aleatorio.
    grantRandom() {
      const id = this.BOOSTERS[rand(this.BOOSTERS.length)];
      this.inv[id] = (this.inv[id] || 0) + 1;
      Toasts.show(`+1 ${Boosters.DEFS[id].name}`, 'good', 1500, BOOSTER_IMG[id] || Boosters.DEFS[id].glyph);
      Sound.milestone(); this.buildBar(); Render.boosterReady(id);
    },
    // Convierte iconos huérfanos (del pool anterior) a iconos del pool actual para que
    // el tablero siempre sea 100% vaciable tras un cambio de tanda.
    _reconcileOrphans() {
      const set = new Set(State.pool);
      for (let i = 0; i < State.board.length; i++) {
        const v = State.board[i];
        if (v !== null && !set.has(v)) { State.board[i] = State.pool[rand(State.pool.length)]; Render.syncCell(i); }
      }
    },
    setup() { const tn = this.tune(); if (this.wave >= 3) this._traps(Math.min(tn.trapCap, tn.trapBase * (this.wave - 2))); this._placeBombs(1); },
    frozen() { return performance.now() < this.freezeUntil; },
    locked() { return performance.now() < this.lockUntil; },
    blockSpawn() { return this.frozen() || this.locked(); },
    _lock(ms, cls) {
      this.lockUntil = Math.max(this.lockUntil || 0, performance.now() + ms);
      if (cls) Render.boardEvent(cls, ms);
    },
    x2Active() { return performance.now() < this.x2Until; },
    _emptyIdx() { const a = []; for (let i = 0; i < State.board.length; i++) if (State.board[i] === null && !State.tiles[i]) a.push(i); return a; },
    _filledIdx() { const a = []; for (let i = 0; i < State.board.length; i++) if (State.board[i] !== null && !State.tiles[i]) a.push(i); return a; },
    _rockIdx() { const a = []; for (let i = 0; i < State.board.length; i++) { const t = State.tiles[i]; if (t && t.type === 'rock') a.push(i); } return a; },
    BOMB_CAP: 6,
    _bombIdx() { const a = []; for (let i = 0; i < State.tiles.length; i++) { const t = State.tiles[i]; if (t && t.trigger === 'bomb') a.push(i); } return a; },
    // Coloca pickups-bomba en casillas vacías (tope para no saturar). Detonan al
    // eliminar un icono adyacente (encadenan) o al tocarlas.
    _placeBombs(n) {
      const room = this.BOMB_CAP - this._bombIdx().length; if (room <= 0) return;
      const e = this._emptyIdx(), k = Math.min(n, room, e.length); const placed = [];
      for (let x = 0; x < k; x++) { const idx = e.splice(rand(e.length), 1)[0]; State.tiles[idx] = Tiles.make('bomb'); placed.push(idx); }
      if (placed.length) { Render.syncAll(); placed.forEach((i) => Render.cellPulse(i, 'bomb-cleared', 600)); }
    },
    SLOWDOWN_CAP: 1,
    _slowdownIdx() { return State.tiles.map((t, i) => (t && t.type === 'slowdown' ? i : -1)).filter((i) => i >= 0); },
    _placeSlowdown() {
      if (this._slowdownIdx().length >= this.SLOWDOWN_CAP) return;
      const e = this._emptyIdx(); if (!e.length) return;
      const idx = e[rand(e.length)];
      State.tiles[idx] = Tiles.make('slowdown');
      Render.syncAll(); Render.cellPulse(idx, 'slowdown-placed', 700);
    },
    _traps(density) {
      const e = this._emptyIdx(); let n = Math.floor(e.length * density);
      let rocks = this._rockIdx().length;   // tope de cobertura: el tablero nunca se "brickea"
      for (let k = 0; k < n && e.length; k++) {
        const idx = e.splice(rand(e.length), 1)[0];
        // Las rocas (ahora ROMPIBLES, con hits) bajan de proporción a ~45% y respetan el tope.
        // Semana del hielo (GM-22): todas las trampas son heladas.
        if (this.mut.id !== 'ice' && rocks < this.ROCK_CAP && RNG.random() < 0.45) {
          const t = Tiles.make('rock'); t.hits = this.ROCK_HITS; State.tiles[idx] = t; rocks++;
        } else { State.tiles[idx] = Tiles.make('frozen'); State.board[idx] = State.pool[rand(State.pool.length)]; State.iconCount++; }
      }
      Render.syncAll();
    },
    onTick(dt) {
      if (State.status !== 'playing') return;
      this.survSec = State.elapsed;
      const wasFrenzy = this._r.frenzyActive;
      if (this.x2Until && !this.x2Active()) { this.x2Until = 0; this._syncMult(); }
      if (this.frenzyUntil && !this.frenzyActive()) { this.frenzyUntil = 0; this._syncMult(); }
      this.waveAcc += dt;
      if (this.waveAcc >= this.WAVE_MS) { this.waveAcc -= this.WAVE_MS; this.newWave(); }
      else if (!this._r.waveWarned && this.waveAcc / this.WAVE_MS >= 0.78) {
        this._r.waveWarned = true;
        Toasts.show(I18n.t('surv_wave_soon'), 'warn', 1400, 'fire');
        Render.boardEvent('surv-wave-soon', 560);
        Sound.danger();
      }
      // Aviso ESPECÍFICO del jefe entrante ~3s antes (GM-18): da tiempo a reaccionar
      // (guardar un freeze, despejar zona) y convierte el susto en tensión anticipada.
      if (this.bossNext && !this._r.bossWarned && this.WAVE_MS - this.waveAcc <= 3000) {
        this._r.bossWarned = true;
        const WARNS = {
          meteor: ['surv_boss_meteor_warn', 'v2:meteor'],
          tide: ['surv_boss_tide_warn', '🌊'],
          quake: ['surv_boss_quake_warn', 'teleporter'],
          frost: ['surv_boss_frost_warn', 'v2:snowflake'],
        };
        const warn = WARNS[this._nextBoss] || WARNS.meteor;
        Toasts.show(I18n.t(warn[0]), 'bad', 2400, warn[1]);
        announce(I18n.t(warn[0]));
        Render.boardEvent('surv-wave-soon', 700);
        Sound.danger(); Haptics.fire(14);
      }
      // Bendición post-jefe pendiente (GM-17): se ofrece cuando el evento se asentó.
      if (this._boonAt && performance.now() >= this._boonAt) { this._boonAt = 0; this.offerBoons(); }
      const isFrenzy = this.frenzyActive();
      if (wasFrenzy !== isFrenzy || this._r.intWave !== this.wave) {
        this._r.frenzyActive = isFrenzy; this._r.intWave = this.wave;
        this._setFrenzyClass(); this._syncIntensity();
      }
      this.render();
    },
    newWave() {
      const clearedWave = this.wave;
      this._waveReward(clearedWave);
      this.wave++;
      this._r.waveWarned = false;
      this._r.bossWarned = false;
      if (this.slowWaves > 0) this.slowWaves--; // bendición de ralentización (GM-17)
      const tn = this.tune();
      State.spawnRate = Math.max(tn.spawnFloor, Math.round(State.spawnRate * tn.spawnDecay));
      // Progresión de iconos: al subir el nivel efectivo, avanza la ventana del catálogo
      // (entran iconos nuevos/más difíciles, se dejan atrás los iniciales) y crece la variedad.
      const lvl = this.dlevel();
      if (lvl !== State.level) {
        State.level = lvl;
        State.pool = Engine.poolForLevel(lvl);
        this._reconcileOrphans();
        Toasts.show(I18n.t('surv_new_icons'), 'info', 1500, 'v2:four-pointed-star');
      }
      Toasts.show(I18n.t('st_wave') + ' ' + this.wave, 'warn', 1400, 'fire'); Sound.danger();
      announce(I18n.t('sr_wave').replace('{n}', this.wave));
      this.addFrenzy(8 + this.frenzyTier() * 3);
      this._traps(Math.min(tn.trapCap, tn.trapBase * Math.max(0, this.wave - 2)));
      this._placeBombs(1 + Math.floor(this.wave / 6));
      if (this.wave >= 2 && RNG.random() < 0.25) this._placeSlowdown();
      if (this.wave % tn.bossEvery === 0) this.bossEvent();
      this._planBoss(); // decide ya si la PRÓXIMA oleada trae jefe (telegrafiado GM-18)
      this._checkWaveRecord();
      this._setFrenzyClass(); this._syncIntensity();
      Render.boardEvent('surv-wave-up', 900);
      this.render();
    },
    bossEvent() {
      // Usa el evento pre-decidido por _planBoss (para que el aviso previo coincida).
      const pool = this._bossPool();
      const ev = this._nextBoss != null ? this._nextBoss : pool[rand(pool.length)];
      this._nextBoss = null;
      if (ev === 'meteor') this.meteorRain();
      else if (ev === 'tide') this.tideSurge();
      else if (ev === 'quake') this.quake();
      else this.frostSurge();
      Haptics.milestone();
      // Sobrevivir al jefe premia con una elección (GM-17), tras asentarse el evento.
      this._boonAt = performance.now() + 1700;
    },
    // Marea (GM-20): marca las 2 filas exteriores y 1.2s después las llena de
    // iconos. Amenaza legible con counterplay: despeja esas zonas antes.
    tideSurge() {
      this._lock(900, 'surv-rain');
      const size = State.size, cells = [];
      [0, size - 1].forEach((r) => { for (let c = 0; c < size; c++) cells.push(r * size + c); });
      cells.forEach((j) => Render.cellPulse(j, 'tide-warn', 1200));
      Toasts.show(I18n.t('surv_tide'), 'bad', 1800, '🌊');
      Sound.rain();
      setTimeout(() => {
        if (State.status !== 'playing') return;
        let filled = 0;
        cells.forEach((j) => {
          if (State.board[j] === null && !State.tiles[j]) {
            State.board[j] = State.pool[rand(State.pool.length)];
            State.iconCount++; filled++;
            Render.syncCell(j); Render.spawnAnim(j);
          }
        });
        if (filled) { Render.hudSoon(); if (State.status === 'playing') Game.evaluate(); }
      }, 1200);
    },
    meteorRain() {
      this._lock(900, 'surv-rain');
      const placed = [];
      for (let k = 0; k < 8; k++) { const idx = Engine.spawnOne(); if (idx >= 0) placed.push(idx); }
      Render.syncAll(); Render.meteor(placed);
      Toasts.show(I18n.t('surv_meteor'), 'bad', 1800, 'v2:meteor');
      Sound.rain();
    },
    quake() {
      this._lock(1150, 'surv-quake');
      Toasts.show(I18n.t('surv_quake'), 'bad', 1800, 'teleporter');
      Sound.quake(); Haptics.quake();
      setTimeout(() => {
        if (State.status !== 'playing') return;
        this._shuffle();
        Render.boardEvent('surv-quake-settle', 420);
      }, 620);
    },
    frostSurge() {
      this._lock(760, 'surv-frost');
      const f = this._filledIdx(), placed = [];
      const n = Math.min(3 + Math.floor(this.wave / 4), f.length);
      for (let k = 0; k < n && f.length; k++) {
        const idx = f.splice(rand(f.length), 1)[0];
        if (!State.tiles[idx]) { State.tiles[idx] = Tiles.make('frozen'); placed.push(idx); }
      }
      Render.syncAll(); placed.forEach(i => Render.iceHit(i));
      Toasts.show(I18n.t('surv_frost'), 'warn', 1600, 'v2:snowflake');
      Sound.booster('freeze'); Haptics.ice();
    },
    _shuffle() {
      const idx = [], vals = [];
      for (let i = 0; i < State.board.length; i++) if (State.board[i] !== null && !State.tiles[i]) { idx.push(i); vals.push(State.board[i]); }
      for (let i = vals.length - 1; i > 0; i--) { const j = rand(i + 1); const t = vals[i]; vals[i] = vals[j]; vals[j] = t; }
      idx.forEach((p, k) => State.board[p] = vals[k]); Render.syncAll();
    },
    onConverge(ctx) {
      const combo = ctx ? ctx.combo : 0;
      this.charge += this.CHARGE_PER + Math.min(combo || 0, 6);
      if (this.charge >= 100) { this.charge -= 100; this.grantRandom(); }
      const removed = ctx ? (ctx.removed || 0) : 0;
      this.addFrenzy(4 + Math.min(22, removed * 2 + Math.min(combo || 0, 10)));
      if (this.frenzyActive()) this.charge = Math.min(100, this.charge + 4);
      // Romper rocas (con hits) ortogonalmente adyacentes a la acción: la casilla
      // central tocada + cada icono eliminado. Da agencia y evita el bloqueo permanente.
      if (ctx) {
        const seen = new Set();
        const mark = (idx) => {
          const r = idx / 8 | 0, c = idx % 8;
          const nb = [[r-1,c],[r+1,c],[r,c-1],[r,c+1]];
          for (const [rr, cc] of nb) {
            if (rr < 0 || cc < 0 || rr > 7 || cc > 7) continue;
            const j = rr * 8 + cc, t = State.tiles[j];
            if (t && t.type === 'rock' && t.hits != null && !seen.has(j)) seen.add(j);
          }
        };
        if (ctx.center != null) mark(ctx.center);
        if (ctx.cells) ctx.cells.forEach(mark);
        seen.forEach((j) => this._crackRock(j));
      }
      this.render();
    },
    _crackRock(j) {
      const t = State.tiles[j]; if (!t || t.type !== 'rock') return;
      t.hits = (t.hits || 1) - 1;
      if (t.hits > 0) { Render.cells[j].classList.add('rock-cracked'); Sound.tap(); return; }
      // Rota: desaparece (libera la casilla) con estallido.
      FX.burst(j, '#c2cbe0', 5);
      Render.cells[j].classList.remove('rock-cracked');
      State.tiles[j] = null; Render.syncCell(j);
      Sound.eliminate(1); Haptics.tap();
    },
    onOverflow() {
      this.lives--;
      if (this.lives <= 0) { this.lastChance(); return; }
      Toasts.show(I18n.t('surv_life_lost'), 'bad', 1700, 'heart');
      announce(I18n.t('sr_life').replace('{n}', this.lives));
      Sound.lifeBlast(); Haptics.life(); this._lock(880, 'life-blast');
      this._relief(0.4); this.render();
      if (State.status === 'playing') Game.evaluate();
    },
    _relief(frac) {
      const f = [];
      for (let i = 0; i < State.board.length; i++) if (State.board[i] !== null) f.push(i);
      let n = Math.floor(f.length * frac);
      const cleared = [];
      for (let k = 0; k < n && f.length; k++) {
        const idx = f.splice(rand(f.length), 1)[0];
        this._powerClear(idx, cleared, 4);
      }
      // El alivio también ROMPE bloqueos: quita ~la mitad de las rocas para dar respiro real.
      const rocks = this._rockIdx(); let rn = Math.ceil(rocks.length * 0.5);
      for (let k = 0; k < rn && rocks.length; k++) {
        const idx = rocks.splice(rand(rocks.length), 1)[0];
        this._powerClear(idx, cleared, 4);
      }
      Render.syncAll();
      Render.lifeClear(cleared);
      if (cleared.length) State.lastActionCell = cleared[0];
    },
    // GM-19: el precio de revivir CRECE con cada uso en la misma run (120→240→480,
    // máx. 3). Plano a 120 trivializaba la muerte en runs largas (a oleada 20+ se
    // recupera en ~4 oleadas); la escalada restaura el peso emocional de morir sin
    // castigar la primera muerte del jugador nuevo.
    REVIVE_BASE: 120, REVIVE_CAP: 480, REVIVE_MAX: 3,
    revives: 0,
    reviveCost() { return Math.min(this.REVIVE_CAP, this.REVIVE_BASE * Math.pow(2, this.revives)); },
    lastChance() {
      if (this.revives >= this.REVIVE_MAX) { this.giveUp(); return; }
      State.status = 'paused'; Loop.stop(); Music.stop(true);
      const cost = this.reviveCost(); const cc = $('#revive-cost'); if (cc) cc.textContent = cost;
      const rb = $('#btn-revive'); if (rb) rb.disabled = Meta.coins() < cost;
      Modal.open('modal-revive');
    },
    revive() {
      const cost = this.reviveCost();
      if (!Meta.spend(cost)) { Toasts.show('Monedas insuficientes', 'warn', 1500); return; }
      this.revives++;
      this.lives = 1; Sound.lifeBlast(); Haptics.life(); this._lock(900, 'life-blast'); this._relief(0.6);
      Modal.close(); State.status = 'playing'; Loop.start(); if (Settings.music) Music.start();
      this.render();
    },
    giveUp() { Modal.close(); Game.gameOver(I18n.t('reason_surv').replace('{s}', Math.floor(this.survSec))); },
    // Power-ups ESPACIALES (el jugador elige dónde) vs GLOBALES (efecto instantáneo).
    SPATIAL: ['bomb', 'clearLine', 'wild'],
    isSpatial(id) { return this.SPATIAL.indexOf(id) !== -1; },
    // Pulsar un power-up: los globales se aplican ya; los espaciales entran en
    // "modo apuntar" (toca una casilla para aplicarlo ahí).
    armBooster(id) {
      if ((this.inv[id] || 0) <= 0) { Toasts.show(I18n.t('powerup_empty'), 'warn', 1100); Sound.ui(); return; }
      if (this.locked()) { Sound.ui(); return; }
      if (!this.isSpatial(id)) { this._applyGlobal(id); return; }
      if (this.armed === id) { this.disarm(); return; }   // volver a pulsar = cancelar
      this.armed = id;
      document.body.classList.add('aiming');
      this.buildBar();
      Toasts.show(I18n.t('aim_hint'), 'info', 1600, BOOSTER_IMG[id] || Boosters.DEFS[id].glyph);
      Sound.ui();
    },
    disarm() {
      if (!this.armed) return;
      this.armed = null;
      document.body.classList.remove('aiming');
      this._clearPreview();
      this.buildBar();
    },
    _applyGlobal(id) {
      this.inv[id]--;
      Render.boosterPulse(id);
      if (id === 'freeze') { this.freezeUntil = performance.now() + 7000; Toasts.show(I18n.t('pu_freeze'), 'info', 1500, BOOSTER_IMG.freeze); Render.boardEvent('boost-freeze', 1200); }
      else if (id === 'x2') { this.x2Until = performance.now() + 11000; this._syncMult(); Toasts.show(I18n.t('pu_x2'), 'good', 1500, BOOSTER_IMG.x2); Render.boardEvent('boost-x2', 1200); }
      Sound.booster(id); Haptics.combo(); this.buildBar(); this.render();
      if (State.status === 'playing') Game.evaluate();
    },
    // Celdas afectadas por un power-up espacial centrado en `i` (para previsualizar y aplicar).
    _affectedCells(id, i) {
      const size = State.size, r = i / size | 0, c = i % size, out = [];
      if (id === 'bomb') {
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { const rr = r + dr, cc = c + dc; if (rr >= 0 && cc >= 0 && rr < size && cc < size) out.push(rr * size + cc); }
      } else if (id === 'clearLine') {
        this._lineCells('row', r).forEach((j) => out.push(j));
        this._lineCells('col', c).forEach((j) => { if (out.indexOf(j) === -1) out.push(j); });
      } else if (id === 'wild') {
        const type = State.board[i];
        if (type != null) for (let j = 0; j < State.board.length; j++) if (State.board[j] === type) out.push(j);
      }
      return out;
    },
    previewAt(i) {
      this._clearPreview();
      if (!this.armed || i == null) return;
      const cells = this._affectedCells(this.armed, i);
      this._preview = cells;
      cells.forEach((j) => { const el = Render.cells[j]; if (el) el.classList.add('aim-target'); });
    },
    _clearPreview() {
      if (this._preview) this._preview.forEach((j) => { const el = Render.cells[j]; if (el) el.classList.remove('aim-target'); });
      this._preview = null;
    },
    // Aplica el power-up espacial armado en la casilla elegida por el jugador.
    applyBoosterAt(id, i) {
      if ((this.inv[id] || 0) <= 0) { this.disarm(); return; }
      // Escoba sobre casilla vacía: barrido automático del grupo más repetido.
      if (id === 'wild' && State.board[i] == null) {
        this.inv[id]--; Render.boosterPulse(id); this._lock(420, 'boost-wild'); this._wild();
        Sound.booster(id); Haptics.combo(); this.disarm(); this.render();
        if (State.status === 'playing') Game.evaluate();
        return;
      }
      const cells = this._affectedCells(id, i);
      this.inv[id]--; Render.boosterPulse(id); this._lock(420, 'boost-' + id);
      const cleared = []; let icons = 0;
      const fxN = id === 'bomb' ? 5 : id === 'clearLine' ? 4 : 6;
      cells.forEach((j) => { icons += this._powerClear(j, cleared, fxN); });
      State.removedTotal += icons; State.lastActionCell = i;
      Render.syncAll();
      const msg = id === 'bomb' ? I18n.t('pu_bomb') : id === 'clearLine' ? I18n.t('pu_ray') : icons + ' ' + I18n.t('pu_icons');
      Toasts.show(msg, 'good', 1200, BOOSTER_IMG[id]);
      this.addFrenzy(Math.min(24, 6 + icons * 3));
      const pulse = id === 'bomb' ? 'bomb-cleared' : id === 'clearLine' ? 'line-cleared' : 'wild-cleared';
      cleared.forEach((j) => Render.cellPulse(j, pulse, 760));
      Sound.booster(id); Haptics.combo(); this.disarm(); this.render();
      if (State.status === 'playing') Game.evaluate();
    },
    _powerClear(j, cleared, fxN = 5) {
      const t = State.tiles[j], hadIcon = State.board[j] !== null;
      if (!hadIcon && !t) return 0;
      if (hadIcon) {
        FX.burst(j, Icons.colorOf(State.board[j]), fxN);
        State.board[j] = null;
        State.iconCount = Math.max(0, State.iconCount - 1);
      } else {
        FX.burst(j, t && t.type === 'rock' ? '#c2cbe0' : '#dffbff', Math.max(3, fxN - 1));
      }
      if (t) {
        if (t.type === 'frozen') Render.iceBreak(j);
        if (t.type === 'rock') Render.cells[j].classList.remove('rock-cracked');
        State.tiles[j] = null;
      }
      cleared.push(j);
      return hadIcon ? 1 : 0;
    },
    _lineCells(axis, n) {
      const cells = [], size = State.size;
      for (let k = 0; k < size; k++) cells.push(axis === 'row' ? n * size + k : k * size + n);
      return cells;
    },
    _lineScore(cells) {
      return cells.reduce((sum, j) => {
        const t = State.tiles[j];
        return sum + (State.board[j] !== null ? 2 : 0) + (t ? (t.type === 'rock' ? 1.35 : 1) : 0);
      }, 0);
    },
    _bomb() {
      let best = 0, bestN = -1, size = State.size;
      for (let i = 0; i < State.board.length; i++) {
        const r = i / size | 0, c = i % size; let n = 0;
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
          const rr = r + dr, cc = c + dc;
          if (rr >= 0 && cc >= 0 && rr < size && cc < size) {
            const j = rr * size + cc;
            n += (State.board[j] !== null ? 2 : 0) + (State.tiles[j] ? 1 : 0);
          }
        }
        if (n > bestN) { bestN = n; best = i; }
      }
      const r = best / size | 0, c = best % size;
      State.lastActionCell = best;
      const cleared = []; let icons = 0;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        const rr = r + dr, cc = c + dc;
        if (rr >= 0 && cc >= 0 && rr < size && cc < size) icons += this._powerClear(rr * size + cc, cleared, 5);
      }
      State.removedTotal += icons;
      Render.syncAll(); Toasts.show(I18n.t('pu_bomb'), 'good', 1300, BOOSTER_IMG.bomb);
      this.addFrenzy(Math.min(24, 8 + icons * 3));
      cleared.forEach(i => Render.cellPulse(i, 'bomb-cleared', 760));
    },
    _clearLine() {
      let best = { axis: 'row', n: 0, cells: this._lineCells('row', 0), score: -1 };
      for (const axis of ['row', 'col']) {
        for (let n = 0; n < State.size; n++) {
          const cells = this._lineCells(axis, n), score = this._lineScore(cells);
          if (score > best.score || (score === best.score && RNG.random() < 0.5)) best = { axis, n, cells, score };
        }
      }
      const cleared = []; let icons = 0;
      State.lastActionCell = best.cells[Math.floor(best.cells.length / 2)];
      best.cells.forEach(j => { icons += this._powerClear(j, cleared, 4); });
      State.removedTotal += icons;
      Render.syncAll(); Toasts.show(best.axis === 'row' ? I18n.t('pu_row') : I18n.t('pu_col'), 'good', 1300, BOOSTER_IMG.wild);
      this.addFrenzy(Math.min(24, 8 + icons * 2));
      cleared.forEach(i => Render.cellPulse(i, 'line-cleared', 760));
    },
    _wild() {
      const by = new Map();
      for (let i = 0; i < State.board.length; i++) {
        const v = State.board[i], t = State.tiles[i];
        if (v !== null && !(t && t.type === 'rock')) {
          if (!by.has(v)) by.set(v, []);
          by.get(v).push(i);
        }
      }
      let best = null;
      by.forEach((arr, id) => { if (!best || arr.length > best.arr.length) best = { id, arr }; });
      if (!best || best.arr.length < 2) {
        const fallback = [];
        for (let i = 0; i < State.board.length; i++) if (State.board[i] !== null) fallback.push(i);
        if (!fallback.length) { Toasts.show(I18n.t('pu_no_target'), 'warn', 1200, BOOSTER_IMG.x2); return; }
        const cleared = [], idx = fallback[rand(fallback.length)];
        State.lastActionCell = idx;
        State.removedTotal += this._powerClear(idx, cleared, 6);
        Render.syncAll(); cleared.forEach(i => Render.cellPulse(i, 'wild-cleared', 820));
        this.addFrenzy(10);
        Toasts.show(I18n.t('pu_wild_emergency'), 'good', 1300, BOOSTER_IMG.x2);
        return;
      }
      const cleared = best.arr.slice(0, 8);
      State.lastActionCell = cleared[0];
      const pulsed = []; let icons = 0;
      cleared.forEach(i => { icons += this._powerClear(i, pulsed, 6); });
      State.removedTotal += icons;
      Render.syncAll(); pulsed.forEach(i => Render.cellPulse(i, 'wild-cleared', 820));
      this.addFrenzy(Math.min(26, 8 + icons * 3));
      Toasts.show(I18n.t('pu_wild_icons').replace('{n}', icons), 'good', 1400, BOOSTER_IMG.x2);
    },
    buildBar() {
      const el = $('#boosters'); if (!el) return;
      // Clásico (GM-03): solo los consumibles comprados pre-nivel; sin stock => barra fuera.
      const list = State.mode === 'clasico'
        ? Object.keys(Config.PRELEVEL_BOOSTERS).filter((id) => (this.inv[id] || 0) > 0)
        : this.BOOSTERS;
      if (State.mode === 'clasico') { const bb = $('#booster-bar'); if (bb) bb.hidden = list.length === 0; }
      el.innerHTML = list.map((id) => {
        const d = Boosters.DEFS[id], n = this.inv[id] || 0;
        const arming = this.armed === id ? ' arming' : '';
        return `<button class="booster${n <= 0 ? ' empty' : ''}${arming}" data-b="${id}" aria-label="${d.name}: ${n}" ${n <= 0 ? 'aria-disabled="true"' : ''}><span class="b-ic">${BOOSTER_IMG[id] ? iconAnyInline(BOOSTER_IMG[id]) : d.glyph}</span><span class="b-count" data-bc="${id}">${n}</span></button>`;
      }).join('');
      el.querySelectorAll('.booster').forEach((b) => b.addEventListener('click', () => this.armBooster(b.dataset.b)));
    },
    render() {
      const r = this._r;
      if (r.lives !== this.lives) { r.lives = this.lives; const lv = $('#surv-lives'); if (lv) lv.innerHTML = this.lives > 0 ? iconInline('heart').repeat(this.lives) : iconInline('skull'); }
      if (r.wave !== this.wave) { r.wave = this.wave; const w = $('#surv-wave'); if (w) w.textContent = I18n.t('st_wave') + ' ' + this.wave; }
      const tier = this.dlevel(); if (r.tier !== tier) { r.tier = tier; const tEl = $('#surv-tier'); if (tEl) tEl.textContent = 'N' + tier; }
      const sec = Math.floor(this.survSec); if (r.sec !== sec) { r.sec = sec; const t = $('#surv-time'); if (t) t.textContent = sec + 's'; }
      // Progreso a la siguiente oleada (telegrafía que la presión va a subir).
      const wp = Math.min(100, Math.round(this.waveAcc / this.WAVE_MS * 100));
      if (r.wp !== wp) {
        r.wp = wp;
        const wf = $('#surv-waveprog-fill'); if (wf) wf.style.width = wp + '%';
        const sb = $('#surv-bar'); if (sb) sb.classList.toggle('soon', wp >= 78);
      }
      // Bandera de jefe entrante (GM-18): visible durante TODA la oleada previa.
      if (r.bossNext !== this.bossNext) {
        r.bossNext = this.bossNext;
        const sb = $('#surv-bar'); if (sb) sb.classList.toggle('boss-soon', this.bossNext);
        const bf = $('#surv-boss-flag'); if (bf) { bf.hidden = !this.bossNext; bf.textContent = I18n.t('surv_boss_soon'); }
      }
      const bestWave = Meta.survBestWave();
      const bestTxt = bestWave > 0 ? I18n.t('surv_best_wave') + ' ' + bestWave : '';
      if (r.bestWave !== bestTxt) { r.bestWave = bestTxt; const bw = $('#surv-best-wave'); if (bw) { bw.textContent = bestTxt; bw.hidden = !bestTxt; } }
      // Anillos concéntricos (GM-21): interior = carga (→ potenciador), exterior =
      // frenesí (→ furia). Un solo widget en vez de dos barras que subían a la par.
      const C_CHARGE = 106.8, C_FRENZY = 150.8; // 2π·r (r=17 / r=24 del SVG)
      const ch = Math.round(this.charge);
      if (r.charge !== ch) { r.charge = ch; const c = $('#pr-charge'); if (c) c.style.strokeDashoffset = (C_CHARGE * (1 - Math.min(ch, 100) / 100)).toFixed(1); }
      const fActive = this.frenzyActive();
      const fVal = fActive ? 100 : Math.round(this.frenzy);
      if (r.frenzyVal !== fVal || r.frenzyOn !== fActive) {
        r.frenzyVal = fVal; r.frenzyOn = fActive;
        const f = $('#pr-frenzy'); if (f) f.style.strokeDashoffset = (C_FRENZY * (1 - Math.min(fVal, 100) / 100)).toFixed(1);
        const pr = $('#power-rings'); if (pr) pr.classList.toggle('on', fActive);
      }
      const ready = this.charge >= 100;
      if (r.ready !== ready) {
        r.ready = ready;
        const bb = $('#booster-bar'); if (bb) bb.classList.toggle('ready', ready);
        const pr = $('#power-rings'); if (pr) pr.classList.toggle('ready', ready);
      }
    },
  };

  /* ===================== Worlds (modo Clásico: mundos × niveles) =====================
   * Datos de los 5 mundos del mockup + render del mapa serpenteante (nodos 1..50 con
   * estrellas/candados, cofre de recompensa, novedades) y panel de mundos. Cada nivel
   * se lanza como una partida 'clasico' que reutiliza los obstáculos de Adventure
   * (Classic.setup) escalando por mundo y número de nivel.
   */
  const Worlds = {
    PER_WORLD: 50,
    REWARD_EVERY: 50,            // cofre de recompensa al completar el mundo
    LIST: [
      { id: 'bosque',   name: 'Bosque Verde',     glyph: '🌲', accent: '#3ad07f', mods: ['chains'],
        nov: [['⛓️', 'Cadenas', 'Toca la figura 2 veces para liberarla'], ['➕', 'Bonus +30', 'Tócalo para puntos extra'], ['🎯', 'Nuevos objetivos', 'Alcanza la meta en cada nivel']] },
      { id: 'desierto', name: 'Desierto Dorado',  glyph: '🏜️', accent: '#ffb24d', mods: ['rocks'],
        nov: [['🪨', 'Rocas', 'Estorban y no convergen'], ['☀️', 'Calor', 'El tablero se llena más rápido'], ['💰', 'Tesoros', 'Más monedas por combo']] },
      { id: 'montana',  name: 'Montaña Helada',   glyph: '🏔️', accent: '#7ad7ff', mods: ['ice', 'web'],
        nov: [['🧊', 'Hielo', 'Casillas heladas: tócalas para romperlas'], ['🕸️', 'Telaraña', 'Toca 2 veces para liberar'], ['🎯', 'Objetivos', 'Despeja el tablero helado']] },
      { id: 'cueva',    name: 'Cueva Misteriosa', glyph: '🔮', accent: '#a06bff', mods: ['crystals', 'portal', 'barrier'],
        nov: [['💎', 'Cristales', 'Valen puntos extra'], ['🌀', 'Portales', 'Teletransportan figuras'], ['🚧', 'Barreras', 'Sólo objetos especiales las quitan']] },
      { id: 'neon',     name: 'Ciudad Neón',      glyph: '🏙️', accent: '#ff5cf0', mods: ['rush', 'bomb', 'magicbox'],
        nov: [['⚡', 'Sobrecarga', 'Los iconos aparecen más rápido'], ['💣', 'Bomba oculta', 'Detona figuras cercanas'], ['🎁', 'Caja mágica', 'Libera figuras cercanas']] },
    ],
    sel: 'bosque',
    idx(wid) { return this.LIST.findIndex(w => w.id === wid); },
    get(wid) { return this.LIST.find(w => w.id === wid) || this.LIST[0]; },
    // Desbloqueo de mundo: el primero siempre; el resto al limpiar >=25 niveles del previo.
    unlocked(wid) {
      const i = this.idx(wid); if (i <= 0) return true;
      return Meta.worldCleared(this.LIST[i - 1].id) >= 25;
    },
    // Desbloqueo de nivel: el 1 siempre; el resto si el anterior tiene >=1 estrella.
    levelUnlocked(wid, n) { return n <= 1 || Meta.levelStars(wid, n - 1) > 0; },
    rewardClaimed(wid) { return !!(Meta.worldData(wid).reward); },
    open() {
      if (!this.unlocked(this.sel)) this.sel = 'bosque';
      this.render(); Screens.show('worlds'); Econ.refresh();
    },
    starsRow(n) { return iconInline('star').repeat(n) + iconInline('star-empty').repeat(3 - n); },
    render() {
      const w = this.get(this.sel);
      const root = document.documentElement; root.style.setProperty('--world-accent', w.accent);
      // Cabecera del mundo
      const stars = Meta.worldStars(this.sel), maxStars = this.PER_WORLD * 3;
      { const t = $('#world-name'); if (t) t.textContent = w.name; }
      { const g = $('#world-glyph'); if (g) g.innerHTML = WORLD_IMG[w.id] ? iconAnyInline(WORLD_IMG[w.id]) : w.glyph; }
      { const s = $('#world-stars'); if (s) s.innerHTML = `${iconInline('star')} ${stars}/${maxStars}`; }
      // Mapa de niveles (serpenteante: filas de 5, alternas)
      const map = $('#world-map'); if (map) {
        const cur = Meta.worldMaxLevel(this.sel);
        let html = '';
        for (let n = 1; n <= this.PER_WORLD; n++) {
          const unlocked = this.levelUnlocked(this.sel, n);
          const st = Meta.levelStars(this.sel, n);
          const isCur = n === cur && unlocked && st === 0;
          const cls = `lvl-node${unlocked ? '' : ' locked'}${isCur ? ' current' : ''}${st > 0 ? ' done' : ''}`;
          html += `<button type="button" class="${cls}" data-lvl="${n}" ${unlocked ? '' : 'aria-disabled="true"'} aria-label="Nivel ${n}">
            <span class="ln-num">${unlocked ? n : iconInline('lock')}</span>
            <span class="ln-stars" aria-hidden="true">${st > 0 ? this.starsRow(st) : ''}</span>
          </button>`;
        }
        // Nodo de recompensa del mundo (al final)
        const rc = Meta.worldCleared(this.sel) >= this.PER_WORLD;
        html += `<button type="button" class="lvl-reward${rc && !this.rewardClaimed(this.sel) ? ' ready' : ''}" data-reward="1" aria-label="Recompensa del mundo">${iconInline('crown')}</button>`;
        map.innerHTML = html;
      }
      // Novedades del mundo
      const nov = $('#world-nov'); if (nov) {
        nov.innerHTML = w.nov.map(([ic, t, d]) => `<div class="nov-item"><span class="nov-ic">${emojiIcon(ic)}</span><div class="nov-tx"><b>${esc(t)}</b><small>${esc(d)}</small></div></div>`).join('');
      }
      // Panel lateral de mundos
      const rail = $('#world-rail'); if (rail) {
        rail.innerHTML = this.LIST.map((x, i) => {
          const unl = this.unlocked(x.id);
          const cleared = Meta.worldCleared(x.id);
          return `<button type="button" class="wr-item${x.id === this.sel ? ' sel' : ''}${unl ? '' : ' locked'}" data-world="${x.id}" style="--wa:${x.accent}" ${unl ? '' : 'aria-disabled="true"'}>
            <span class="wr-glyph">${WORLD_IMG[x.id] ? iconAnyInline(WORLD_IMG[x.id]) : x.glyph}</span>
            <span class="wr-tx"><b>${i + 1} · ${esc(x.name)}</b><small>${unl ? iconInline('star') + ' ' + cleared + '/' + this.PER_WORLD : iconInline('lock') + ' Bloqueado'}</small></span>
          </button>`;
        }).join('');
      }
      this.wire();
    },
    wire() {
      const map = $('#world-map');
      if (map && !map._wired) {
        map._wired = true;
        map.addEventListener('click', (e) => {
          const node = e.target.closest('.lvl-node'); const rew = e.target.closest('.lvl-reward');
          if (node) {
            const n = +node.dataset.lvl;
            if (!this.levelUnlocked(this.sel, n)) { Sound.tap(); Toasts.show(I18n.t('locked_level'), 'warn', 1300); return; }
            Sound.ui(); PreLevel.open(this.sel, n);
          } else if (rew) { this.claimReward(); }
        });
      }
      const rail = $('#world-rail');
      if (rail && !rail._wired) {
        rail._wired = true;
        rail.addEventListener('click', (e) => {
          const it = e.target.closest('.wr-item'); if (!it) return;
          const id = it.dataset.world;
          if (!this.unlocked(id)) { Sound.tap(); Toasts.show(I18n.t('locked_world'), 'warn', 1500); return; }
          Sound.ui(); this.sel = id; this.render(); Econ.refresh();
        });
      }
    },
    claimReward() {
      const cleared = Meta.worldCleared(this.sel) >= this.PER_WORLD;
      if (!cleared) { Toasts.show(I18n.t('reward_locked'), 'warn', 1600); return; }
      if (this.rewardClaimed(this.sel)) { Toasts.show(I18n.t('reward_claimed'), 'info', 1400); return; }
      Meta.worldData(this.sel).reward = today2();
      Meta.addChest(1); Meta.addGems(20);
      Toasts.show(I18n.t('reward_got'), 'good', 2200, '👑');
      Sound.milestone(); FX.confetti(80); Econ.refresh(); this.render();
    },
    // Llamado por Game al completar un nivel Clásico: guarda estrellas y desbloqueos.
    recordLevel(stars) {
      Meta.setLevelStars(State.world, State.worldLevel, stars);
    },
  };
  // Fecha corta reutilizable (Meta usa una privada; aquí una equivalente para Worlds).
  function today2() { return new Date().toISOString().slice(0, 10); }

  /* ===================== Classic (setup de nivel del modo Clásico) =====================
   * Reutiliza los colocadores de obstáculos de Adventure escalando por mundo (bioma)
   * y número de nivel. Objetivo: vaciar el tablero (regla por defecto de Game).
   */
  const Classic = {
    _onEmpty(type, k) {
      const e = []; for (let i = 0; i < State.board.length; i++) if (State.board[i] === null && !State.tiles[i]) e.push(i);
      for (let x = 0; x < k && e.length; x++) State.tiles[e.splice(rand(e.length), 1)[0]] = Tiles.make(type);
    },
    _onFilled(type, k, init) {
      const f = []; for (let i = 0; i < State.board.length; i++) if (State.board[i] !== null && !State.tiles[i]) f.push(i);
      for (let x = 0; x < k && f.length; x++) { const j = f.splice(rand(f.length), 1)[0]; const t = Tiles.make(type); if (init) init(t); State.tiles[j] = t; }
    },
    // setupLevel ya fijó pool/spawn y colocó iconos iniciales desde State.level (= n).
    // Aqui anadimos los obstaculos y objetos especiales propios del mundo; los tableros de tienda no alteran reglas.
    setup() {
      const w = Worlds.get(State.world), wi = Worlds.idx(State.world), n = State.worldLevel || 1;
      const dens = Math.min(0.13, 0.015 + n * 0.0021 + wi * 0.008);
      const k = (base) => base + Math.floor(n / 12);   // escala suave con el nivel
      (w.mods || []).forEach((mod) => {
        if (mod === 'rocks') Adventure._placeOnEmpty('rock', dens);
        else if (mod === 'ice') Adventure._placeFrozen(dens);
        else if (mod === 'crystals') Adventure._placeCrystals(2 + Math.min(8, Math.floor(n / 6)));
        else if (mod === 'chains') this._onFilled('chains', k(1));
        else if (mod === 'web') this._onFilled('web', k(1));
        else if (mod === 'barrier') this._onEmpty('barrier', k(1));
        else if (mod === 'portal') this._onEmpty('portal', 1);
        else if (mod === 'magicbox') this._onEmpty('magicbox', 1);
        else if (mod === 'bomb') this._onEmpty('bomb', 1);
        else if (mod === 'rush') State.spawnRate = Math.max(420, Math.round(State.spawnRate * 0.85));
      });
      if (n >= 2 && RNG.random() < 0.6) this._onEmpty('bonus', 1);
      Render.syncAll();
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

  /* ===================== ModeSignals (identidad emocional por modo) =====================
   * Capa fina de feedback: no cambia reglas ni economía, solo hace más legible qué
   * persigue cada modo y qué debería intentar el jugador en la siguiente partida.
   */
  const ModeSignals = {
    classes: Config.MODE_ORDER.map((k) => 'mode-' + k).concat(['mode-daily', 'mode-surv', 'mode-timed', 'time-pressure', 'time-critical']),
    clear() {
      document.body.classList.remove(...this.classes);
      State.timePressure = 0;
      const time = $('#hud-time');
      if (time && time.parentElement) time.parentElement.classList.remove('urgent');
    },
    apply(mode) {
      this.clear();
      const m = Config.MODES[mode];
      if (!m) return;
      document.body.classList.add('mode-' + mode);
      document.documentElement.style.setProperty('--mode-accent', m.accent || 'var(--accent-2)');
    },
    markDaily(on) { document.body.classList.toggle('mode-daily', !!on); },
    icon(mode) {
      const key = MODE_IMG[mode];
      return key ? iconAnyInline(key) : esc((Config.MODES[mode] && Config.MODES[mode].emoji) || '');
    },
    dailyMedalLabel(medal) { return I18n.t('daily_medal_' + (medal || 'none')); },
    noteText(mode) {
      if (mode === 'clasico') {
        const streak = Meta.classicPerfectStreak();
        return streak > 0 ? I18n.t('mode_note_clasico_streak').replace('{n}', streak) : I18n.t('mode_note_clasico');
      }
      if (mode === 'aventura') {
        const bi = Adventure.biomeOf(State.level);
        const mod = Adventure.biomeModText(bi) || Adventure.previewObjective(State.level);
        return I18n.t('mode_note_aventura').replace('{m}', mod);
      }
      if (mode === 'contrarreloj') return State.isDaily ? I18n.t('mode_note_daily') : I18n.t('mode_note_contrarreloj');
      if (mode === 'zen') {
        const fl = Meta.zenFlowers();
        return I18n.t('mode_note_zen') + (fl > 0 ? ' · 🌸 ' + fl : '');
      }
      return '';
    },
    noteHtml(mode) {
      const text = this.noteText(mode || State.mode);
      return text ? `<span class="obj-mode-note">${esc(text)}</span>` : '';
    },
    brief(mode) {
      if (mode === 'tutorial') return;
      const key = 'mode_brief_' + mode;
      const msg = I18n.t(key);
      if (msg && msg !== key) Toasts.show(msg, 'info', 1700, MODE_IMG[mode] || (Config.MODES[mode] && Config.MODES[mode].emoji));
    },
    resultHtml() {
      const key = 'result_focus_' + State.mode;
      const msg = I18n.t(key);
      if (!msg || msg === key) return '';
      return `<div class="mode-result-note">${this.icon(State.mode)} <span>${esc(msg)}</span></div>`;
    },
    dailyResultHtml(result) {
      if (!State.isDaily || !result) return '';
      const medal = result.medal || 'none';
      const next = State.score < 750 ? 750 : State.score < 1500 ? 1500 : State.score < 2500 ? 2500 : 0;
      const medalLine = I18n.t('daily_medal_result').replace('{m}', this.dailyMedalLabel(medal));
      const nextLine = next ? `<small>${esc(I18n.t('daily_next_medal').replace('{n}', next))}</small>` : '';
      return `<div class="daily-medal-result medal-${medal}"><strong>${esc(medalLine)}</strong>${nextLine}</div>`;
    },
  };

  const NextActions = {
    mainModes: ['clasico', 'aventura', 'contrarreloj', 'supervivencia', 'zen'],
    shopGoal() {
      const coins = Meta.coins();
      const goals = [];
      if (typeof Boards !== 'undefined') {
        Boards.order.forEach((id) => {
          const b = Boards.DEFS[id];
          if (b && !Meta.ownsBoard(id) && b.cost > 0) goals.push({ name: b.name, cost: b.cost, kind: 'board' });
        });
      }
      if (typeof Themes !== 'undefined') {
        Themes.order.forEach((id) => {
          const t = Themes.DEFS[id];
          if (t && !Meta.owns(id) && t.cost > 0) goals.push({ name: t.name, cost: t.cost, kind: 'theme' });
        });
      }
      goals.sort((a, b) => a.cost - b.cost);
      const goal = goals[0];
      return goal ? Object.assign(goal, { have: coins, ready: coins >= goal.cost, left: Math.max(0, goal.cost - coins) }) : null;
    },
    variety() {
      const played = this.mainModes.filter((k) => Meta.modePlays(k) > 0);
      return { played: played.length, total: this.mainModes.length, left: this.mainModes.length - played.length };
    },
    progressRow(iconName, label, value, current, target, act) {
      const pct = target > 0 ? clamp(current / target * 100, 0, 100) : 0;
      const body = `<span class="npr-ic">${iconAnyInline(iconName)}</span><span class="npr-main"><span class="npr-top"><b>${esc(label)}</b><small>${esc(value)}</small></span><span class="npr-bar"><span style="width:${pct.toFixed(0)}%"></span></span></span>`;
      return act ? `<button class="next-progress-row" data-act="${act}" type="button">${body}</button>` : `<div class="next-progress-row">${body}</div>`;
    },
    progressHtml() {
      const rows = [];
      const dm = Meta.dailyMission(), wk = Meta.weeklyChallenge();
      const dCur = dm.done ? dm.target : Math.min(dm.progress || 0, dm.target || 1);
      const wCur = wk.done ? wk.target : Math.min(wk.progress || 0, wk.target || 1);
      rows.push(this.progressRow('target', I18n.t('progress_daily'), dm.done ? I18n.t('progress_ready') : `${dCur}/${dm.target}`, dCur, dm.target || 1, 'open-missions'));
      rows.push(this.progressRow('calendar', I18n.t('progress_weekly'), wk.done ? I18n.t('progress_ready') : `${wCur}/${wk.target}`, wCur, wk.target || 1, 'open-missions'));
      const variety = this.variety();
      rows.push(this.progressRow('medal', I18n.t('progress_variety'), variety.left <= 0 ? I18n.t('progress_ready') : I18n.t('progress_modes_left').replace('{n}', variety.left), variety.played, variety.total, variety.left > 0 ? 'go-play' : 'profile'));
      if (Meta.chests() > 0) rows.push(this.progressRow('chest', I18n.t('progress_chests'), I18n.t('progress_ready') + ' · ' + Meta.chests(), 1, 1, 'open-chests'));
      const shop = this.shopGoal();
      if (shop) rows.push(this.progressRow('cart', I18n.t('progress_cosmetic'), shop.ready ? I18n.t('progress_ready') : I18n.t('progress_left').replace('{n}', shop.left), Math.min(shop.have, shop.cost), shop.cost, 'open-shop'));
      return `<div class="next-progress"><h3>${esc(I18n.t('progress_title'))}</h3>${rows.slice(0, 4).join('')}</div>`;
    },
    recommendation(ctx = {}) {
      const dm = Meta.dailyMission(), wk = Meta.weeklyChallenge();
      if (Meta.chests() > 0) return { icon: 'chest', title: I18n.t('next_open_chest'), sub: I18n.t('next_open_chest_sub'), act: 'open-chests' };
      if (ctx.missionDone || ctx.weeklyDone || dm.done || wk.done || (!dm.done && Meta.tickets() > 0)) return { icon: 'target', title: I18n.t('next_missions'), sub: I18n.t('next_missions_sub'), act: 'open-missions' };
      if (State.isDaily && Meta.dailyMedal(State.score) !== 'gold') return { icon: 'medal', title: I18n.t('next_daily'), sub: I18n.t('next_daily_sub'), act: 'go-daily' };
      const shop = this.shopGoal();
      if (shop && shop.ready) return { icon: 'cart', title: I18n.t('next_shop'), sub: I18n.t('next_shop_sub'), act: 'open-shop' };
      if (State.mode === 'clasico') return { icon: 'pin', title: I18n.t('next_classic'), sub: I18n.t('next_classic_sub'), act: 'go-classic' };
      if (State.mode === 'aventura') return { icon: 'rocket', title: I18n.t('next_adventure'), sub: I18n.t('next_adventure_sub'), act: 'go-adventure' };
      if (State.mode === 'supervivencia') return { icon: 'heart', title: I18n.t('next_surv'), sub: I18n.t('next_surv_sub'), act: 'go-surv' };
      const variety = this.variety();
      if (variety.left > 0) return { icon: 'target', title: I18n.t('next_modes'), sub: I18n.t('next_modes_sub'), act: 'go-play' };
      return { icon: MODE_IMG[State.mode] || 'v2:play', title: I18n.t('next_modes'), sub: I18n.t('next_modes_sub'), act: 'go-play' };
    },
    html(ctx) {
      const r = this.recommendation(ctx);
      const card = `<div class="next-card"><span class="next-card-ic">${iconAnyInline(r.icon)}</span><span class="next-card-copy"><b>${esc(I18n.t('next_title'))}: ${esc(r.title)}</b><small>${esc(r.sub)}</small></span><button class="btn btn-primary btn-sm" data-act="${r.act}">${esc(r.title)}</button></div>`;
      return card + this.progressHtml();
    },
  };

  /* ===================== Picker (elección en partida) =====================
   * Overlay único de "elige 1 de N" reutilizado por las bendiciones post-jefe
   * (Supervivencia), las rutas de capítulo y reliquias (Aventura), el continuar
   * con gemas (Clásico/Aventura) y el ritmo de Zen. Pausa suave mientras se
   * decide y restaura el estado al elegir/cancelar. La elección es el latido
   * de agencia de la Fase GM-γ: una decisión significativa por sesión y modo.
   */
  const Picker = {
    pending: null, _wasPlaying: false,
    open({ title, sub, accent, options, cancelLabel, onPick, onCancel }) {
      const ov = $('#pick-overlay');
      if (!ov) { if (options && options[0] && onPick) onPick(options[0].id); return; }
      this.pending = { options, onPick, onCancel };
      this._wasPlaying = State.status === 'playing';
      if (this._wasPlaying) State.status = 'paused';
      ov.style.setProperty('--pick-accent', accent || 'var(--accent-2)');
      { const t = $('#pick-title'); if (t) t.textContent = title || ''; }
      { const s = $('#pick-sub'); if (s) { s.hidden = !sub; s.textContent = sub || ''; } }
      { const box = $('#pick-options'); if (box) box.innerHTML = (options || []).map((o) => `
        <button class="pick-opt" data-pick="${esc(o.id)}" type="button">
          <span class="po-ic" aria-hidden="true">${o.icon || ''}</span>
          <span class="po-tx"><b>${esc(o.name)}</b><small>${esc(o.desc || '')}</small></span>
        </button>`).join(''); }
      { const cb = $('#pick-cancel'); if (cb) { cb.hidden = !cancelLabel; cb.textContent = cancelLabel || ''; } }
      this._wire(ov);
      ov.hidden = false;
      announce(title || '');
    },
    _wire(ov) {
      if (ov._wired) return; ov._wired = true;
      ov.addEventListener('click', (e) => {
        const opt = e.target.closest && e.target.closest('[data-pick]');
        if (opt) { Sound.ui(); this.pick(opt.dataset.pick); return; }
        if (e.target.closest && e.target.closest('#pick-cancel')) { Sound.ui(); this.cancel(); }
      });
    },
    pick(id) {
      const p = this.pending; if (!p) return;
      this._close();
      if (p.onPick) p.onPick(id);
    },
    cancel() {
      const p = this.pending; if (!p) return;
      this._close();
      if (p.onCancel) p.onCancel();
    },
    // B-06: cierre DEFENSIVO sin callbacks ni cambios de status — para fin de
    // partida/salida externa con una elección abierta (hoy ninguna ruta legítima
    // lo provoca, pero cualquier feature futura que llame gameOver()/quit() con
    // un Picker pendiente dejaría el overlay pegado sobre el menú).
    dismiss() {
      this.pending = null; this._wasPlaying = false;
      const ov = $('#pick-overlay'); if (ov) ov.hidden = true;
    },
    _close() {
      const ov = $('#pick-overlay'); if (ov) ov.hidden = true;
      this.pending = null;
      if (this._wasPlaying && State.status === 'paused') { State.status = 'playing'; Loop.kick(); }
      this._wasPlaying = false;
    },
  };

  /* ===================== PreLevel (lanzador de nivel de Clásico, GM-03) =====================
   * Desde el 2º mundo, tocar un nivel abre una hoja con hasta 2 potenciadores
   * comprables con monedas (bomba 80 / congelar 60 / rayo 90 — los costes
   * históricos de Boosters.DEFS). Decisión estratégica pre-nivel + sumidero de
   * monedas permanente. Son consumibles POR INTENTO: reintentar no los devuelve
   * (estándar del género). El mundo 1 arranca directo (cero fricción al aprender).
   */
  const PreLevel = {
    world: null, n: 1, sel: {},
    open(worldId, n) {
      const ov = $('#prelevel');
      if (!ov || Worlds.idx(worldId) < Config.PRELEVEL_FROM_WORLD) { Game.startClassic(worldId, n); return; }
      this.world = worldId; this.n = n; this.sel = {};
      { const t = $('#pl-title'); if (t) t.textContent = `${I18n.t('lvl')} ${n} · ${Worlds.get(worldId).name}`; }
      this._render();
      this._wire(ov);
      ov.style.setProperty('--pick-accent', Worlds.get(worldId).accent);
      ov.hidden = false;
      if (!Storage.preboostSeen) { Storage.preboostSeen = '1'; Toasts.show(I18n.t('pl_first'), 'info', 3400, '💡'); }
    },
    _selIds() { return Object.keys(this.sel).filter((id) => this.sel[id]); },
    _selCost() { return this._selIds().reduce((s, id) => s + Config.PRELEVEL_BOOSTERS[id], 0); },
    _render() {
      const box = $('#pl-items'); if (!box) return;
      box.innerHTML = Object.keys(Config.PRELEVEL_BOOSTERS).map((id) => {
        const d = Boosters.DEFS[id], cost = Config.PRELEVEL_BOOSTERS[id], on = !!this.sel[id];
        return `<button type="button" class="pl-chip${on ? ' on' : ''}" data-pl="${id}" aria-pressed="${on}">
          <span class="po-ic" aria-hidden="true">${BOOSTER_IMG[id] ? iconAnyInline(BOOSTER_IMG[id]) : d.glyph}</span>
          <span class="po-tx"><b>${esc(d.name)}</b><small>${iconInline('coin')} ${cost}</small></span>
        </button>`;
      }).join('');
      const play = $('#pl-play');
      if (play) {
        const cost = this._selCost();
        play.textContent = cost > 0 ? I18n.t('pl_play_cost').replace('{c}', cost) : I18n.t('pl_play');
        play.disabled = cost > Meta.coins();
      }
    },
    toggle(id) {
      if (this.sel[id]) this.sel[id] = false;
      else {
        if (this._selIds().length >= Config.PRELEVEL_MAX) { Toasts.show(I18n.t('pl_max').replace('{n}', Config.PRELEVEL_MAX), 'warn', 1300); return; }
        this.sel[id] = true;
      }
      Sound.ui();
      this._render();
    },
    _wire(ov) {
      if (ov._wired) return; ov._wired = true;
      ov.addEventListener('click', (e) => {
        const chip = e.target.closest && e.target.closest('[data-pl]');
        if (chip) { this.toggle(chip.dataset.pl); return; }
        if (e.target.closest && e.target.closest('#pl-play')) this._start(true);
        else if (e.target.closest && e.target.closest('#pl-skip')) this._start(false);
      });
    },
    _start(withBoosters) {
      const ov = $('#prelevel');
      const picked = withBoosters ? this._selIds() : [];
      const cost = withBoosters ? this._selCost() : 0;
      if (cost > 0 && !Meta.spend(cost)) { Toasts.show(I18n.t('pl_no_coins'), 'warn', 1500); return; }
      if (cost > 0) Econ.refresh();
      if (ov) ov.hidden = true;
      Sound.ui();
      Game.startClassic(this.world, this.n);
      // El inventario se fija DESPUÉS de start() (que lo limpia para no-Supervivencia).
      if (picked.length) {
        Survival.inv = {};
        picked.forEach((id) => { Survival.inv[id] = 1; });
        Survival.buildBar();
        const bb = $('#booster-bar'); if (bb) bb.hidden = false;
      }
    },
  };

  /* ===================== DailyMut (mutador del Reto del día, GM-15) =====================
   * La fecha elige (hash determinista, sin servidor) 1 de 8 variantes del tablero
   * diario: cada día tiene tema, conversación y screenshot distintos, y el reto
   * sigue siendo idéntico para todos. Se aplican tras montar el nivel (consumen
   * RNG seedeado ⇒ mismas posiciones para todo el mundo). Las medallas no cambian:
   * unos días son más duros que otros, como un crucigrama.
   */
  const DailyMut = {
    LIST: ['pure', 'ice', 'window', 'variety', 'rocks', 'fast', 'crystal', 'nohints'],
    pick(dateStr) { return this.LIST[hash32('mut:' + dateStr) % this.LIST.length]; },
    apply(id) {
      if (id === 'ice') this._onFilled('frozen', 4);
      else if (id === 'window') State.comboWindow = Math.max(1500, State.comboWindow - 500);
      else if (id === 'variety') State.pool = Engine.poolForLevel(7); // ventana de 6 iconos
      else if (id === 'rocks') this._onEmpty('rock', 3);
      else if (id === 'fast') State.mutFast = true; // doSpawn acelera la curva un 10%
      else if (id === 'crystal') this._onFilled('crystal', 2);
      else if (id === 'nohints') { State.hintsLeft = 0; Render.hud(); }
      if (id !== 'pure') Render.syncAll();
    },
    _onEmpty(type, k) {
      const e = []; for (let i = 0; i < State.board.length; i++) if (State.board[i] === null && !State.tiles[i]) e.push(i);
      for (let x = 0; x < k && e.length; x++) State.tiles[e.splice(rand(e.length), 1)[0]] = Tiles.make(type);
    },
    _onFilled(type, k) {
      const f = []; for (let i = 0; i < State.board.length; i++) if (State.board[i] !== null && !State.tiles[i]) f.push(i);
      for (let x = 0; x < k && f.length; x++) State.tiles[f.splice(rand(f.length), 1)[0]] = Tiles.make(type);
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
                  showUpdateBanner(reg);
                }
              });
            });
          }).catch((e) => ErrLog.push('sw', e && e.message));
        });
      }
      
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
      const btn = $('#btn-install');
      if (btn && !isStandalone) btn.hidden = false;

      // Captura del prompt de instalación para ofrecer "Instalar" en el menú.
      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault(); this.deferredPrompt = e;
        if (btn) btn.hidden = false;
      });
      window.addEventListener('appinstalled', () => {
        this.deferredPrompt = null; if (btn) btn.hidden = true;
      });
    },
    promptInstall() {
      if (this.deferredPrompt) {
        this.deferredPrompt.prompt();
        this.deferredPrompt.userChoice.finally(() => { 
          this.deferredPrompt = null; 
          const btn = $('#btn-install'); if (btn) btn.hidden = true; 
        });
      } else {
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        if (isIOS) {
          Toasts.show('Para instalar: toca Compartir y "Añadir a inicio"', 'info', 4500, 'v2:share');
        } else {
          Toasts.show('Instala desde el menú de opciones del navegador (⋮)', 'info', 4500);
        }
      }
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
        // Duelo por semilla: en modos de puntuación el enlace reproduce EXACTAMENTE
        // el mismo tablero (misma semilla → mismos spawns) para retar al receptor.
        const url = Config.MODES[State.mode].scoreAttack && State.seed != null
          ? `${location.origin}${location.pathname}?challenge=${encodeURIComponent(State.seed)}` : undefined;
        const file = blob ? new File([blob], 'convergencia.png', { type: 'image/png' }) : null;
        if (file && navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text, title: 'Convergencia', url }); return; }
        if (navigator.share) { await navigator.share({ text, title: 'Convergencia', url }); return; }
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
    active: false, step: 0, targets: [], tIdx: 0,
    STEPS: [
      { textKey: 'coach1',
        build() { State.board[26] = 'circle_red'; State.board[28] = 'circle_red'; State.iconCount = 2; return 27; } },
      { textKey: 'coach2',
        build() { State.board[19] = 'star_yellow'; State.board[35] = 'star_yellow'; State.board[26] = 'star_yellow'; State.board[28] = 'star_yellow'; State.iconCount = 4; return 27; } },
      // Paso 3: dos parejas independientes (fila 1 y fila 6, sin columnas compartidas para
      // que no se crucen las líneas de visión); encadenarlas rápido enseña la ventana de combo.
      { textKey: 'coach3',
        build() { State.board[10] = 'circle_red'; State.board[12] = 'circle_red'; State.board[53] = 'circle_red'; State.board[55] = 'circle_red'; State.iconCount = 4; return [11, 54]; } },
    ],
    start() {
      this.active = true; this.step = 0; this.targets = []; this.tIdx = 0;
      Loop.stop(); Music.stop(true);
      State.mode = 'tutorial'; State.diff = 'facil'; State.level = 1;
      State.comboWindow = Config.DIFFICULTY.facil.comboWindow; // para que el paso 3 encadene combo
      State.score = 0; State.displayScore = 0; State.combo = 0; State.comboMult = 1; State.comboAt = 0;
      State.maxCombo = 0; State.removedTotal = 0; State.mistakes = 0; State.elapsed = 0; State.timeLeft = 0;
      State.fever = false; State.recordHit = false;
      Render.fever(false); Render.danger(0);
      Game.ended = false; State.status = 'playing';
      Screens.show('game'); FX.resize();
      { const c = $('#coach'); if (c) c.hidden = false; }
      { const pl = $('#coach-play'); if (pl) pl.hidden = true; }
      { const sk = $('#coach-skip'); if (sk) { sk.hidden = false; sk.textContent = I18n.t('coach_skip'); } }
      this._render();
    },
    _clearHint() { const t = this.targets[this.tIdx]; if (t != null && t >= 0) Render.hint([t], false); },
    _render() {
      const s = this.STEPS[this.step];
      State.board = new Array(State.size * State.size).fill(null);
      State.tiles = new Array(State.size * State.size).fill(null);
      State.iconCount = 0; State.combo = 0; State.comboMult = 1;
      const r = s.build();
      this.targets = Array.isArray(r) ? r : [r];
      this.tIdx = 0;
      State.displayScore = State.score;
      Render.syncAll(); Render.combo(); Render.hud();
      Render.hint([this.targets[0]], true);
      $('#coach-text').textContent = I18n.t(s.textKey);
    },
    notify() {
      if (!this.active) return;
      this._clearHint();
      this.tIdx++;
      // ¿Quedan más objetivos en este paso? (encadenar dentro de la ventana de combo)
      if (this.tIdx < this.targets.length) {
        const nx = this.targets[this.tIdx];
        setTimeout(() => { if (this.active) Render.hint([nx], true); }, 220);
        return;
      }
      this.step++;
      if (this.step >= this.STEPS.length) { setTimeout(() => this.finish(), 950); return; }
      setTimeout(() => { State.displayScore = State.score; this._render(); }, 800);
    },
    // Fin del tutorial: en vez de soltar al jugador en el menú, ofrecer arrancar ya en
    // el nivel 1 de Clásico (arranque dirigido) o ir al menú.
    finish() {
      if (!this.active) return;
      this.active = false;
      this._clearHint();
      State.status = 'idle'; Game.ended = true;
      Storage.tutorialDone = true;
      Sound.success();
      { const ct = $('#coach-text'); if (ct) ct.textContent = I18n.t('coach_done'); }
      { const pl = $('#coach-play'); if (pl) { pl.hidden = false; pl.textContent = I18n.t('coach_play1'); } }
      { const sk = $('#coach-skip'); if (sk) sk.textContent = I18n.t('coach_menu'); }
    },
    // CTA "Jugar nivel 1": lanza Clásico mundo 1, nivel 1.
    play1() {
      { const c = $('#coach'); if (c) c.hidden = true; }
      { const pl = $('#coach-play'); if (pl) pl.hidden = true; }
      { const sk = $('#coach-skip'); if (sk) sk.textContent = I18n.t('coach_skip'); }
      Game.startClassic(Worlds.LIST[0].id, 1);
    },
    // Saltar (durante los pasos) o "Ir al menú" (al terminar): cerrar y volver al inicio.
    skip() {
      this.active = false;
      this._clearHint();
      { const c = $('#coach'); if (c) c.hidden = true; }
      { const pl = $('#coach-play'); if (pl) pl.hidden = true; }
      { const sk = $('#coach-skip'); if (sk) sk.textContent = I18n.t('coach_skip'); }
      State.status = 'idle'; Game.ended = true; Storage.tutorialDone = true;
      refreshStart(); Screens.show('start');
    },
  };

  /* ===================== Gobernador de rendimiento (Perf, QP-2 P1) =====================
   * Degradación POR CAPAS con histéresis, en vez de perder frames a lo bruto. Loop.tick le
   * pasa cada frame el EMA del tiempo de frame (ms) y el dt; Perf decide un "nivel":
   *   0 = todo · 1 = sin ambientales de tablero (tope 28) · 2 = sin pulsos de tiles y popups
   *   sin escala (tope 18). El nivel se aplica con una clase en <body> (perf-1 / perf-2) ->
   *   el corte de animaciones es CSS puro (styles.css). Subir de nivel (peor) exige el umbral
   *   SOSTENIDO 2s; bajar (mejor) exige 10s buenos: nunca oscila. En móvil de alta densidad
   *   arranca en nivel 1 hasta acumular EMA bueno (evita el primer minuto tartamudo). */
  const Perf = {
    level: 0,
    CAP: [50, 28, 18],            // techo de partículas (FX.cap) por nivel
    UP: [20, 26],                 // EMA(ms) para subir a nivel 1 / a nivel 2
    GOOD: 16,                     // EMA(ms) considerado "bueno" (para bajar de nivel)
    UP_MS: 2000, DOWN_MS: 10000,  // ms sostenidos requeridos para subir / bajar
    FLOOR: 12,                    // tope mínimo de partículas
    _badMs: 0, _goodMs: 0, _l2Ms: 0, _bootGuard: false, suggested: false,
    init() {
      try { this.suggested = localStorage.getItem('cv_perf_suggested') === '1'; } catch (_) {}
      const hiDpiTouch = (navigator.maxTouchPoints || 0) > 0 && (window.devicePixelRatio || 1) >= 3;
      this._bootGuard = hiDpiTouch;   // el primer descenso desde el arranque móvil pide solo 5s
      this.level = -1;                // fuerza a apply() a escribir la clase aunque el nivel sea 0
      this.apply(hiDpiTouch ? 1 : 0);
    },
    apply(lvl) {
      lvl = lvl < 0 ? 0 : lvl > 2 ? 2 : lvl;
      if (lvl !== this.level) {
        this.level = lvl;
        const b = document.body && document.body.classList;
        if (b) { b.toggle('perf-1', lvl >= 1); b.toggle('perf-2', lvl >= 2); }
      }
      if (FX.cap > this.CAP[lvl]) FX.cap = this.CAP[lvl]; // baja YA; el EMA lo re-sube dentro del nivel
      this._badMs = 0; this._goodMs = 0;
    },
    // Un paso por frame: EMA (ms) y dt (ms) del frame.
    step(ema, dt) {
      const ceil = this.CAP[this.level];
      // Tope de partículas DENTRO del nivel (clamp correcto: nunca supera el techo — B-08).
      if (ema > 22) { if (FX.cap > this.FLOOR) FX.cap = Math.max(this.FLOOR, FX.cap - 6); }
      else if (ema < 17 && FX.cap < ceil) FX.cap = Math.min(ceil, FX.cap + 3);
      if (FX.cap > ceil) FX.cap = ceil; // invariante dura: el tope jamás rebasa el techo del nivel
      // Acumuladores de histéresis para el cambio de nivel.
      if (this.level < 2 && ema > this.UP[this.level]) { this._badMs += dt; this._goodMs = 0; }
      else if (ema < this.GOOD) { this._goodMs += dt; this._badMs = 0; }
      else { this._badMs = 0; this._goodMs = 0; }
      if (this.level < 2 && this._badMs >= this.UP_MS) this.apply(this.level + 1);
      else if (this.level > 0 && this._goodMs >= (this._bootGuard ? 5000 : this.DOWN_MS)) { this._bootGuard = false; this.apply(this.level - 1); }
      // Auto-sugerencia de modo ligero (P1-e): nivel 2 sostenido >30s, una sola vez por dispositivo.
      if (this.level >= 2) { this._l2Ms += dt; if (this._l2Ms > 30000) this.suggestLight(); }
      else this._l2Ms = 0;
    },
    suggestLight() {
      if (this.suggested) return;
      this.suggested = true;                                   // "toast único": no volver a preguntar
      try { localStorage.setItem('cv_perf_suggested', '1'); } catch (_) {}
      if (Settings.reducedFx) return;
      Toasts.show(I18n.t('perf_suggest'), 'info', 7000, 'aura', () => {
        Settings.reducedFx = true; applyReducedFx(); buildSettings();
        Toasts.show(I18n.t('perf_light_on'), 'good', 2200, 'check');
      });
    },
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

      // Gobernador de rendimiento: EMA del tiempo de frame -> nivel de FX + tope de partículas.
      L.ema += (dt - L.ema) * 0.1;
      Perf.step(L.ema, dt);

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
          if (Config.MODES[State.mode].scoreAttack && State.status === 'playing') {
            Game.maybeTimecap(); // cápsula de tiempo (GM-13)
            // Ghost personal (GM-12): muestra de score cada 10s de partida.
            const gi = Math.floor(State.elapsed / 10);
            while (gi > 0 && State.ghostSamples.length < gi) State.ghostSamples.push(State.score);
          }
          Render.hud();
        }
        L.spawnAcc += dt;
        // Intervalo efectivo = spawnRate × warm-up (GM-26) × factor del modo
        // (GM-17: la bendición de ralentización de Supervivencia dura 2 oleadas).
        const sr = Math.max(120, Math.round(State.spawnRate * Game.warmupFactor(now) * (Rules.call('spawnFactor') || 1)));
        if (L.spawnAcc >= sr) { L.spawnAcc -= sr; Game.doSpawn(); }
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

  /* ===================== RunSave (guardado de partida en curso) =====================
   * Snapshot de la partida activa a localStorage para poder reanudar tras cerrar la
   * app (interrupciones de móvil). Se guarda al ocultarse la pestaña/página y se
   * limpia al terminar/abandonar. v1: excluye supervivencia (su estado de oleadas/
   * boosters/timers no es serializable de forma fiable todavía) y el tutorial.
   * Nota: no se guarda la posición del stream del RNG; al reanudar se re-seedea con
   * la semilla original (los spawns futuros divergen — no se exige replay exacto). */
  const RunSave = {
    KEY: 'cv_run',
    // B-01: Contrarreloj (y el Reto del día, que es Contrarreloj seedeado) NO se
    // guarda: son runs de 2-4 min y reanudar rompía la integridad del reto
    // (isDaily/mutador/cápsula no viven en el snapshot). load() rechaza además
    // cualquier guardado antiguo de un modo hoy excluido.
    EXCLUDED: { supervivencia: 1, tutorial: 1, contrarreloj: 1 },
    save() {
      try {
        const playing = State.status === 'playing' || State.status === 'paused';
        if (!playing || Coach.active || this.EXCLUDED[State.mode]) { this.clear(); return; }
        const s = {
          v: 1, t: Date.now(),
          mode: State.mode, diff: State.diff, level: State.level, seed: State.seed,
          world: State.world, worldLevel: State.worldLevel,
          score: State.score, board: State.board, tiles: State.tiles,
          iconCount: State.iconCount, spawnRate: State.spawnRate,
          elapsed: State.elapsed, timeLeft: State.timeLeft,
          hintsLeft: State.hintsLeft, mistakes: State.mistakes,
          maxCombo: State.maxCombo, removedTotal: State.removedTotal,
          emptyBoards: State.emptyBoards, coinsRun: State.coinsRun,
        };
        // B-02: progreso del objetivo de nivel de Aventura (sin esto, un nivel de
        // score reanudado se ganaba al instante: levelScore0 se re-derivaba a 0).
        if (State.mode === 'aventura') { s.advScore0 = Adventure.levelScore0; s.advStart = Adventure.levelStart; }
        // B-03: consumibles pre-nivel de Clásico (reanudar ES el mismo intento).
        if (State.mode === 'clasico') s.inv = Survival.inv;
        localStorage.setItem(this.KEY, JSON.stringify(s));
      } catch (e) { /* cuota llena o similar: nunca romper el juego por guardar */ }
    },
    load() {
      try {
        const raw = localStorage.getItem(this.KEY);
        if (!raw) return null;
        const s = JSON.parse(raw);
        if (!s || s.v !== 1 || !Config.MODES[s.mode] || this.EXCLUDED[s.mode]) return null;
        if (!Array.isArray(s.board) || s.board.length !== Config.SIZE * Config.SIZE) return null;
        return s;
      } catch (e) { return null; }
    },
    clear() { try { localStorage.removeItem(this.KEY); } catch (e) { /* no-op */ } },
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
      // Contrarreloj (score attack): reloj inicial fijo; se extiende con tope al jugar.
      if (m.timed) State.timeLeft = Config.TIMED_START;
      // Cápsula de tiempo (GM-13): 1 por partida, en un momento seedeado (40-80s).
      if (m.scoreAttack) { State.capAt = 40 + rand(40); State.capPlaced = false; }
      // Tablero fresco con la variedad de iconos del nivel actual
      State.board = new Array(State.size * State.size).fill(null);
      State.tiles = new Array(State.size * State.size).fill(null);
      State.iconCount = 0;
      State.combo = 0; State.comboMult = 1;
      Engine.placeInitial(Config.DIFFICULTY[State.diff].initialIcons);
      State.minIcons = State.iconCount; // referencia near-miss del nivel (GM-01)
      // Warm-up de apertura (GM-26): por nivel, se desactiva solo en modos de calma.
      State.warmupUntil = performance.now() + Config.WARMUP.ms;
      State.warmupConvs = 0; State.warmupEndAt = 0;
      State.warmupDone = !!(m.relaxed || m.single);
      State.continueUsed = false; // oferta de continuar (GM-02): 1 por nivel
      // Hook de modo: permite a Aventura/Supervivencia sembrar tiles/objetivos.
      Rules.call('onSetupLevel', { level: State.level, mode: m });
      Render.syncAll();
      Render.combo();
      Render.hud();
    },

    // Lanza un nivel concreto del modo Clásico desde el mapa de mundos.
    startClassic(worldId, n) {
      State.world = worldId; State.worldLevel = n;
      this.start('clasico', 'normal', n);
    },

    start(mode, diff, startLevel, seed) {
      State.mode = mode;
      if (mode !== 'tutorial') Storage.lastMode = mode; // para marcar el modo actual en el catálogo
      State.diff = Config.MODES[mode].fixedDiff || diff;
      // Semilla de partida: reproducible si viene dada (reto diario/replay), aleatoria si no.
      // Normaliza semillas numéricas que llegan como string (p. ej. desde ?challenge= en
      // la URL): "12345" debe producir el mismo tablero que 12345.
      if (typeof seed === 'string' && /^\d+$/.test(seed)) seed = +seed;
      State.seed = seed != null ? seed : (Math.random() * 0xffffffff) >>> 0;
      RNG.seed(State.seed);
      State.score = 0; State.displayScore = 0; State.level = 1; State.elapsed = 0; State.timeLeft = 0;
      State.combo = 0; State.comboMult = 1; State.comboAt = 0;
      State.maxCombo = 0; State.removedTotal = 0; State.mistakes = 0; State.coinsRun = 0; State.tempMult = 1;
      State.emptyBonusClaimed = false; State.emptyBoards = 0; State.lastActionCell = null;
      State.fever = false; State.feverEver = false; State.perfectEver = false; State.recordHit = false;
      State.timePressure = 0;
      State.minIcons = 99; State.bestPlay = null; State.spawnHoldUntil = 0;
      State.mutFast = false; State.ghostSamples = []; // mutador diario (GM-15) · ghost (GM-12)
      State.isDaily = false; // startDaily() lo activa tras llamar aquí
      State.status = 'playing'; this.ended = false; this.dailyRunResult = null; this.classicMastery = null; this._nearMiss = null;
      ModeSignals.apply(mode);
      // Aventura: reanuda en el nivel más lejano alcanzado; el resto empieza en 1.
      if (mode === 'aventura') State.level = Meta.advMax();
      // Clásico: arranca en el nivel elegido del mundo (HUD y escalado usan State.level).
      if (mode === 'clasico' && startLevel) State.level = startLevel;
      // Supervivencia 2.0: vidas, oleadas, boosters.
      const isSurv = mode === 'supervivencia';
      document.body.classList.toggle('mode-surv', isSurv);
      if (isSurv) Storage.survDiff = State.diff;
      // Tiempo en HUD solo cuando importa (Contrarreloj): top minimalista.
      document.body.classList.toggle('mode-timed', !!Config.MODES[mode].timed);
      { const sb = $('#surv-bar'); if (sb) sb.hidden = !isSurv; const bb = $('#booster-bar'); if (bb) bb.hidden = !isSurv; }
      if (isSurv) Survival.start();
      // No-Supervivencia: limpiar residuos de potenciadores (GM-03 los reintroduce
      // en Clásico tras el lanzador; reiniciar = consumibles del intento perdidos).
      else { Survival.disarm(); Survival.freezeUntil = 0; Survival.lockUntil = 0; Survival.inv = {}; }
      // Aventura: limpiar elecciones de run ANTES de montar el nivel (setup las lee).
      if (mode === 'aventura') Adventure.resetRun();
      Render.fever(false); Render.danger(0);
      this.clearHintHighlight();
      this.setupLevel();
      this.showGoalBanner();
      Render.combo();
      Boards.apply();
      Screens.show('game');
      FX.resize();
      Loop.start();
      if (Settings.music) Music.start();
      announce(`Partida iniciada. Modo ${Config.MODES[mode].name}.`);
      Toasts.show(I18n.t('lets_play'), 'good', 1400);
      ModeSignals.brief(mode);
      // Aventura: intro de bioma una vez por capítulo (congela hasta descartar) y,
      // al entrar en capítulo, elección de ruta (GM-06; encadenada tras la intro).
      if (mode === 'aventura') {
        const introShown = Adventure.maybeChapterIntro(State.level);
        if (!introShown) Adventure.maybeOfferRoute(State.level);
      }
    },

    // Reto del día: tablero de Contrarreloj idéntico para todos (semilla = fecha).
    // El primer intento del día premia gemas; se guarda la mejor marca diaria.
    startDaily() {
      const d = new Date().toISOString().slice(0, 10);
      this.start('contrarreloj', 'normal', undefined, 'daily:' + d);
      State.isDaily = true;
      ModeSignals.markDaily(true);
      // Mutador del día (GM-15): mismo tema para todos, elegido por la fecha.
      const mut = DailyMut.pick(d);
      DailyMut.apply(mut);
      this.showGoalBanner();
      Toasts.show(I18n.t('daily_challenge'), 'info', 1800, '🎯');
      if (mut !== 'pure') Toasts.show(I18n.t('dmut_' + mut), 'warn', 2800, '🎲');
    },

    // Reanuda la partida guardada por RunSave (si existe). Devuelve true si lo hizo.
    resumeSaved() {
      const s = RunSave.load();
      if (!s) return false;
      RunSave.clear();
      if (s.mode === 'clasico') { State.world = s.world; State.worldLevel = s.worldLevel; }
      // start() monta el nivel desde cero (objetivos/hooks de modo incluidos)...
      this.start(s.mode, s.diff, s.mode === 'clasico' ? s.worldLevel : undefined, s.seed);
      // ...y el snapshot pisa tablero y progreso con lo que había al interrumpirse.
      State.level = s.level;
      State.pool = Engine.poolForLevel(s.level);
      State.board = s.board; State.tiles = s.tiles; State.iconCount = s.iconCount;
      State.score = s.score; State.displayScore = s.score;
      State.spawnRate = s.spawnRate; State.elapsed = s.elapsed; State.timeLeft = s.timeLeft;
      State.hintsLeft = s.hintsLeft; State.mistakes = s.mistakes;
      State.maxCombo = s.maxCombo; State.removedTotal = s.removedTotal;
      State.emptyBoards = s.emptyBoards; State.coinsRun = s.coinsRun;
      // B-02: restaurar el progreso del objetivo de Aventura. Fallback para guardados
      // antiguos sin estos campos: tratar el estado actual como inicio del nivel
      // (conservador — jamás regala la victoria instantánea).
      if (s.mode === 'aventura') {
        Adventure.levelScore0 = typeof s.advScore0 === 'number' ? s.advScore0 : State.score;
        Adventure.levelStart = typeof s.advStart === 'number' ? s.advStart : State.elapsed;
        Adventure.refreshGoal(State.level);
      }
      // B-03: restaurar los consumibles pre-nivel de Clásico y su barra.
      if (s.mode === 'clasico' && s.inv && typeof s.inv === 'object') {
        Survival.inv = s.inv;
        Survival.buildBar();
      }
      Render.syncAll(); Render.hud(); this.showGoalBanner();
      Toasts.show(I18n.t('run_resumed'), 'good', 1600);
      return true;
    },

    restart() { if (Coach.active) return Coach.skip(); Modal.close(); if (State.isDaily) return this.startDaily(); this.start(State.mode, State.diff); },
    quit() {
      if (Coach.active) return Coach.skip();
      Picker.dismiss(); // B-06: ídem al salir al menú
      { const pl = $('#prelevel'); if (pl) pl.hidden = true; }
      Loop.stop(); Music.stop(); State.status = 'idle'; Modal.close();
      ModeSignals.clear(); this.clearHintHighlight();
      if (typeof Survival !== 'undefined') Survival.cleanup();
      // Clásico: salir devuelve al mapa de mundos (su hub natural).
      if (State.mode === 'clasico') { Worlds.open(); return; }
      refreshStart(); Screens.show('start');
    },

    pause() {
      if (Coach.active) return Coach.skip();
      if (State.status !== 'playing') return;
      // Aviso: Supervivencia no se guarda al salir (RunSave excluye este modo). Se muestra
      // solo aquí para que el jugador sepa que salir pierde la oleada en curso.
      // B-01: el aviso "no se guarda" aplica a TODO modo excluido de RunSave
      // (Supervivencia y Contrarreloj/Reto), no solo a Supervivencia.
      { const pn = $('#pause-note'); if (pn) pn.hidden = !RunSave.EXCLUDED[State.mode]; }
      State.status = 'paused'; Music.stop(true); Modal.open('modal-pause'); announce('Juego en pausa.');
    },
    resume() {
      if (State.status !== 'paused') return;
      State.status = 'playing'; Modal.close(); Loop.last = performance.now(); Loop.kick();
      if (Settings.music) Music.start();
    },

    /* Activación de una casilla (clic/tecla) */
    feverNeed() {
      // Zen (GM-24): sin Fiebre — el modo santuario no evalúa ni acelera.
      if (Config.MODES[State.mode].noFever) return Infinity;
      if (State.mode !== 'supervivencia') return Config.FEVER_COMBO;
      return Math.max(6, Config.FEVER_COMBO - Survival.frenzyTier());
    },
    feverBoost() {
      if (!State.fever) return 1;
      return Config.FEVER_BOOST + (State.mode === 'supervivencia' ? Survival.frenzyTier() * 0.06 : 0);
    },
    // Sprint final (GM-10): en score-attack, con el reloj a <=10s todos los puntos
    // van ×1.5. Como el tiempo puede volver a subir, el jugador puede ELEGIR
    // cabalgar el borde del abismo (riesgo-recompensa continuo).
    sprintMult() {
      const m = Config.MODES[State.mode];
      return m && m.scoreAttack && State.timeLeft > 0 && State.timeLeft <= Config.SPRINT_WINDOW ? Config.SPRINT_MULT : 1;
    },
    // Warm-up de apertura (GM-26): factor del intervalo de spawn. ×0.55 los
    // primeros 10s del nivel (o hasta la 3ª convergencia), con rampa de salida
    // de 2s hacia el ritmo normal. No aplica a Zen/tutorial (calma).
    warmupFactor(now) {
      if (State.warmupDone) return 1;
      const W = Config.WARMUP;
      if (now < State.warmupUntil && State.warmupConvs < W.convs) return W.factor;
      if (!State.warmupEndAt) State.warmupEndAt = now;
      const k = (now - State.warmupEndAt) / W.rampMs;
      if (k >= 1) { State.warmupDone = true; return 1; }
      return W.factor + (1 - W.factor) * k;
    },

    activate(i) {
      if (State.status !== 'playing') return;
      if ((State.mode === 'supervivencia' || State.mode === 'clasico') && Survival.locked()) return;
      this.clearHintHighlight();
      const ti = State.tiles[i];
      // Objeto especial con efecto al tocar (bonus/portal/caja mágica/bomba oculta).
      if (ti && ti.trigger) { Sound.tap(); return; }
      // Casilla rompible: tocar para liberar (helada/cadenas/telaraña/lodo). No es error.
      if (ti && ti.breakable) {
        ti.taps = (ti.taps != null ? ti.taps : (Tiles.DEFS[ti.type].taps || 1)) - 1;
        if (ti.type === 'frozen') Render.iceHit(i);
        else Render.boardShake();
        if (ti.taps <= 0) {
          State.tiles[i] = null;
          if (ti.type === 'frozen') { Sound.iceBreak(); Render.iceBreak(i); } else Sound.eliminate(3);
        } else {
          if (ti.type === 'frozen') Sound.iceCrack(ti.taps); else Sound.tap();
        }
        Render.setTile(i); Render.syncCell(i); Haptics.ice();
        // B6: en Supervivencia, el esfuerzo de romper hielo/bloqueos alimenta la
        // carga (+2 por toque) — el "busywork" pasa a contribuir al build.
        if (State.mode === 'supervivencia') {
          Survival.charge += 2;
          if (Survival.charge >= 100) { Survival.charge -= 100; Survival.grantRandom(); }
          Survival.render();
        }
        return;
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

      // FEVER: entrar al encadenar combo alto. La entrada es un ESPECTÁCULO (GM-27):
      // micro-pausa de spawns (aspiración) + zoom/barrido del tablero + aro en llamas.
      if (!State.fever && State.combo >= this.feverNeed()) {
        State.fever = true; State.feverEver = true;
        State.spawnHoldUntil = performance.now() + 500;
        Render.fever(true); Render.feverBurst(); Sound.fever(); Haptics.fever();
        if (Settings.music) Music.setIntensity(1);
        Toasts.show('¡FEVER!', 'warn', 1400, 'fire');
      }

      // Puntos (icono×10×nivel × combo × dificultad × modo × fever)
      const removed = conv.length;
      State.removedTotal += removed;
      State.lastActionCell = i;
      const d = Config.DIFFICULTY[State.diff], m = Config.MODES[State.mode];
      const base = removed * 10 * State.level;
      const points = Math.floor(base * State.comboMult * d.scoreMult * m.mult * this.feverBoost() * (State.tempMult || 1) * this.sprintMult());
      State.score += points;
      State.warmupConvs++; // el warm-up (GM-26) termina antes si el jugador ya fluye
      // Jugada pico de la partida (GM-28): se muestra en el resumen de fin (regla pico-final).
      if (!State.bestPlay || points > State.bestPlay.points) {
        State.bestPlay = { points, combo: State.combo, removed, wave: State.mode === 'supervivencia' ? Survival.wave : 0, level: State.level };
      }
      if (Config.MILESTONES[State.combo]) { State.score += Config.MILESTONES[State.combo]; Toasts.show(`¡Combo ×${State.combo}! +${Config.MILESTONES[State.combo]}`, 'good'); Sound.milestone(); Haptics.milestone(); }

      // Contrarreloj: bonus de tiempo por convergencia (los combos suman más)
      if (m.timed) {
        // Tiempo ganado MODESTO, con TOPE de reloj y RENDIMIENTO DECRECIENTE: los
        // combos ya recompensan con puntos; el tiempo no se acumula sin límite ni
        // hace la partida infinita. (Antes: hasta +20s por convergencia, sin tope.)
        const decay = clamp(1 - State.elapsed / 150, 0.4, 1);      // 100% -> 40% hacia el min ~150s
        const raw = (2 + Math.min(removed, 4) + Math.min(State.combo, 4)) * decay;  // ~2..10s, decreciente
        const before = State.timeLeft;
        State.timeLeft = Math.min(Config.TIMED_CAP, State.timeLeft + raw);
        const got = Math.round(State.timeLeft - before);
        if (got > 0) Render.bump($('#hud-time'));
        Toasts.show(got > 0 ? `+${got}s` : '⏱️ tope', 'info', 1100);
      }

      // Estrellas de convergencia: estrella en la casilla central + una estrella
      // sobre cada icono eliminado + camino de estrellitas, TODO sincronizado con
      // la desaparición de los iconos (glyph-out). Se lanza en el mismo frame que
      // Render.clearAnim para que empiecen y terminen exactamente a la vez.
      FX.converge(i, conv, color);
      const rewardTier = removed >= 4 ? 3 : removed >= 3 ? 2 : (State.comboMult >= 2 || State.combo >= 3 ? 1 : 0);
      if (rewardTier) Render.impact(rewardTier);
      FX.scoreToHud(i, color, rewardTier);

      // Aplicar al tablero (limpia también la casilla especial; cristal = bonus)
      conv.forEach(idx => {
        const t = State.tiles[idx];
        // Cristal: +50 base; la reliquia de Aventura (GM-07) añade +30.
        if (t) { if (t.type === 'crystal') State.score += 50 + (State.mode === 'aventura' && Adventure.hasRelic('crystal') ? 30 : 0); State.tiles[idx] = null; }
        State.board[idx] = null; State.iconCount--;
      });
      Render.clearAnim(conv, i);
      conv.forEach(idx => { Render.setTile(idx); Render.cells[idx].setAttribute('aria-label', Render.cellLabel(idx)); });

      // Popup con el multiplicador TOTAL (combo × fiebre × temporal × sprint), no
      // solo el de combo: lo que ves es lo que multiplicó de verdad (GM-16).
      const totMult = State.comboMult * this.feverBoost() * (State.tempMult || 1) * this.sprintMult();
      Render.popup(i, totMult > 1.001 ? `+${points} ×${totMult % 1 === 0 ? totMult : totMult.toFixed(1)}` : `+${points}`, color);
      Render.bump($('#hud-score'));
      Render.combo();

      // Subida de rango → flash + sonido
      if (State.comboMult > prevMult && State.combo >= 3) {
        const labels = { 1.5: '¡BIEN!', 2: '¡GENIAL!', 3: '¡INCREÍBLE!', 5: '¡ÉPICO!', 8: '¡LEGENDARIO!', 10: '¡MÍTICO!' };
        Render.rankFlash(labels[State.comboMult] || '¡COMBO!', color); Sound.rank();
      }

      // Sonido + háptica de eliminación
      Sound.match(removed, State.combo, State.comboMult);
      if (removed >= 4) Haptics.milestone(); else if (State.combo >= 3) Haptics.combo(); else Haptics.tap();
      if (Settings.music) Music.setIntensity(clamp(State.combo / 18, 0, 1));

      // Récord en vivo (una sola vez por partida): confeti desde la última
      // eliminación, saliendo hacia fuera y cayendo al fondo de la pantalla.
      if (!State.recordHit && Storage.best > 0 && State.score > Storage.best) {
        State.recordHit = true; Render.flash(); Sound.record(); Haptics.record(); FX.celebrate(i);
        Toasts.show('¡Nuevo récord!', 'good', 1600, 'trophy');
      }

      Render.hudSoon();
      // Anuncio a lector de pantalla: los hitos de combo (10/20/30) siempre; las
      // convergencias grandes (≥3 iconos) con throttle; las sueltas se omiten (spam).
      if (Config.MILESTONES[State.combo] != null) announce(I18n.t('sr_combo').replace('{n}', State.combo));
      else if (removed >= 3) announceGame(I18n.t('sr_converge').replace('{n}', removed));
      if (Coach.active) { Coach.notify(); return; }
      // Pickups-bomba del tablero: detonan si una eliminación queda adyacente (encadenan).
      this._chainDetonate(conv);
      Rules.call('onConverge', { removed, combo: State.combo, cells: conv, center: i });
      this.evaluate();
    },

    /* Error del jugador: penalización (salvo modos sin penalización) */
    mistake(i) {
      const prevStars = State.mode === 'clasico' ? this.starsForMistakes(State.mistakes) : 0;
      Render.miss(i); Sound.miss(); Haptics.error(); State.mistakes++;
      // Clásico: refresca estrellas en vivo y avisa si se ha perdido una (transparencia).
      if (State.mode === 'clasico') {
        this.updateLiveStars();
        const now = this.starsForMistakes(State.mistakes);
        if (now < prevStars) {
          const el = $('#obj-stars'); if (el) { el.classList.remove('lost'); void el.offsetWidth; el.classList.add('lost'); }
          Toasts.show(I18n.t('star_lost'), 'bad', 1600, '★');
        }
      }
      const m = Config.MODES[State.mode];
      if (!m.penalties) return;
      Render.boardShake();
      // GM-11: en score-attack (Contrarreloj/Reto) el error cuesta TIEMPO, la moneda
      // real del modo. Añadir iconos ahí era un castigo-regalo: los iconos son la
      // materia prima de puntuar. Sin iconos extra y sin acelerar el spawn.
      if (m.scoreAttack) {
        State.timeLeft = Math.max(0, State.timeLeft - Config.TIMED_MISTAKE_S);
        Render.bump($('#hud-time'));
        Toasts.show(I18n.t('mistake_time').replace('{n}', Config.TIMED_MISTAKE_S), 'bad', 1500);
        Render.hud();
        if (State.timeLeft <= 0) { this.gameOver(I18n.t('reason_time')); return; }
        this.evaluate();
        return;
      }
      if (State.mode === 'supervivencia') Render.boardEvent('surv-penalty', 520);
      // Añadir iconos de penalización (escala con dificultad y nivel)
      const d = Config.DIFFICULTY[State.diff];
      const n = clamp(d.penaltyBase + Math.floor((State.level - 1) / 3), 1, 5);
      const placed = Engine.addPenalty(n);
      if (placed.length) Render.penalty(placed);
      // Subir velocidad de aparición
      State.spawnRate = Math.max(d.spawnMin, Math.round(State.spawnRate * 0.95));
      Toasts.show(`Error · +${placed.length} iconos · más rápido`, 'bad', 1800);
      Render.hud();
      this.evaluate();
    },

    // Casillas ortogonalmente adyacentes a `i` dentro del tablero.
    _adjacent(i) {
      const r = i / State.size | 0, c = i % State.size, s = State.size, out = [];
      [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].forEach(([rr, cc]) => { if (rr >= 0 && cc >= 0 && rr < s && cc < s) out.push(rr * s + cc); });
      return out;
    },
    // Cuadrado (2·rad+1) centrado en `i`.
    _area(i, rad) {
      const r = i / State.size | 0, c = i % State.size, s = State.size, out = [];
      for (let dr = -rad; dr <= rad; dr++) for (let dc = -rad; dc <= rad; dc++) { const rr = r + dr, cc = c + dc; if (rr >= 0 && cc >= 0 && rr < s && cc < s) out.push(rr * s + cc); }
      return out;
    },
    // Elimina las figuras de `cells` (sin convergencia) actualizando contador y render.
    _removeCells(cells) {
      cells.forEach((idx) => { if (State.board[idx] !== null) { State.board[idx] = null; State.iconCount--; } });
      Render.clearAnim(cells);
      cells.forEach((idx) => { Render.setTile(idx); Render.syncCell(idx); });
    },
    // Pickups-bomba del tablero: si una eliminación (convergencia/detonación) queda
    // adyacente a una bomba, esta detona limpiando su 3×3, y encadena con otras bombas
    // que alcance. Reutiliza _adjacent/_area/_removeCells.
    _chainDetonate(seedCells) {
      const isPowerup = (j) => { const t = State.tiles[j]; return !!(t && t.trigger); };
      const seen = new Set(), queue = [];
      const enqueueAdj = (cells) => cells.forEach((idx) => this._adjacent(idx).forEach((j) => { if (isPowerup(j) && !seen.has(j)) { seen.add(j); queue.push(j); } }));
      enqueueAdj(seedCells);
      if (!queue.length) return;
      const triggered = [];
      let bombs = 0;
      while (queue.length) {
        const p = queue.shift();
        const ti = State.tiles[p];
        if (!ti || !ti.trigger) continue;
        if (ti.trigger === 'bomb') bombs++;
        triggered.push(p);
        const touched = this._triggerTile(p, ti, { defer: true }) || [p];
        enqueueAdj(touched);
      }
      if (triggered.length && State.lastActionCell == null) State.lastActionCell = triggered[0];
      Render.syncAll(); Render.bump($('#hud-score'));
      if (bombs) {
        Sound.booster('bomb'); Haptics.milestone();
        Toasts.show(I18n.t('chain_boom').replace('{n}', bombs), 'good', 1300, BOOSTER_IMG.bomb);
      }
    },
    // Objeto especial: efecto al tocar (bonus +30 / portal / caja mágica / bomba oculta).
    _triggerTile(i, ti, opts = {}) {
      const eff = ti.trigger;
      let touched = [i];
      State.tiles[i] = null;
      if (eff === 'bonus') {
        State.score += 30; Render.popup(i, '+30', 'var(--good)'); Render.bump($('#hud-score'));
        Sound.milestone(); Haptics.milestone();
      } else if (eff === 'portal') {
        const filled = [], empties = [];
        for (let k = 0; k < State.board.length; k++) {
          if (State.board[k] !== null && !State.tiles[k]) filled.push(k);
          else if (State.board[k] === null && !State.tiles[k]) empties.push(k);
        }
        if (filled.length && empties.length) {
          const from = filled[rand(filled.length)], to = empties[rand(empties.length)];
          State.board[to] = State.board[from]; State.board[from] = null;
          Render.syncCell(from); Render.syncCell(to);
          touched = [i, from, to];
        }
        Sound.booster('freeze'); Render.boardEvent('boost-freeze', 700);
      } else if (eff === 'magicbox') {
        touched = this._adjacent(i).concat(i);
        this._adjacent(i).forEach((j) => { const t = State.tiles[j]; if (t && t.solid) { State.tiles[j] = null; Render.setTile(j); Render.syncCell(j); } });
        FX.confetti(40); Sound.milestone(); Haptics.milestone();
      } else if (eff === 'bomb') {
        touched = this._area(i, 1);
        const cells = touched.filter((j) => State.board[j] !== null && !(State.tiles[j] && State.tiles[j].solid));
        const pts = cells.length * 10 * State.level;
        this._removeCells(cells); State.score += pts; State.removedTotal += cells.length;
        if (State.mode === 'supervivencia') Survival.addFrenzy(Math.min(28, 8 + cells.length * 2));
        if (cells.length) Render.popup(i, '+' + pts, 'var(--warn)');
        FX.celebrate(i); Sound.booster('bomb'); Haptics.milestone();
      } else if (eff === 'slowdown') {
        const d = Config.DIFFICULTY[State.diff];
        State.spawnRate = Math.min(d.spawnStart, Math.round(State.spawnRate * 1.6));
        Render.popup(i, '⏳ −Vel', 'var(--accent-2)'); Render.bump($('#hud-speed'));
        Sound.booster('freeze'); Haptics.milestone();
        Toasts.show('⏳ ¡Ralentizado!', 'good', 1200, 'v2:hourglass');
      } else if (eff === 'timecap') {
        // Cápsula de tiempo (GM-13, Contrarreloj): +5s con el tope de reloj de siempre.
        const before = State.timeLeft;
        State.timeLeft = Math.min(Config.TIMED_CAP, State.timeLeft + 5);
        const got = Math.round(State.timeLeft - before);
        Render.popup(i, got > 0 ? `+${got}s` : '⏱️', 'var(--time)'); Render.bump($('#hud-time'));
        Sound.milestone(); Haptics.milestone();
      }
      Render.setTile(i); Render.syncCell(i); Render.hud();
      if (!opts.defer) this.evaluate();
      return touched;
    },

    doSpawn() {
      // Micro-pausa de la entrada en Fiebre (GM-27): 500ms de "aspiración" sin spawns.
      if (State.spawnHoldUntil && performance.now() < State.spawnHoldUntil) return;
      if (Rules.call('blockSpawn')) return;   // potenciador de congelación (Supervivencia)
      const m = Config.MODES[State.mode];
      const idx = Engine.spawnOne();
      if (idx < 0) { // no queda casilla vacía colocable: el tablero está lleno
        if (m.endless) { Rules.call('onOverflow'); return; }     // surv/zen lo gestionan
        if (m.scoreAttack) return;                                // contrarreloj: el reloj decide
        // Clásico/Aventura: tablero lleno = atasco real (sin huecos no hay jugada).
        // 1) Reliquia escudo de Aventura (GM-07): la 1ª derrota del capítulo se
        //    convierte en un despeje del 30% — gratis, la reliquia hace su trabajo.
        if (State.mode === 'aventura' && Adventure.hasRelic('shield') && !Adventure.shieldUsed) {
          Adventure.shieldUsed = true;
          this.softClear(0.30);
          Toasts.show(I18n.t('relic_shield_fired'), 'good', 2200, '🛡️');
          Render.hudSoon();
          return;
        }
        // 2) Continuar con gemas (GM-02): 1 oferta por nivel, precio visible, rechazar
        //    igual de fácil que aceptar, sin cuenta atrás. Ética antes que ingresos.
        if (!State.continueUsed && Meta.gems() >= Config.CONTINUE_GEMS) {
          State.continueUsed = true; // se consume la OFERTA, no solo la compra
          Sound.danger();
          Picker.open({
            title: I18n.t('continue_title'),
            sub: I18n.t('continue_sub').replace('{n}', Config.CONTINUE_GEMS),
            accent: '#b46cff',
            options: [{ id: 'yes', icon: '💎', name: I18n.t('continue_yes').replace('{n}', Config.CONTINUE_GEMS), desc: I18n.t('continue_yes_d') }],
            cancelLabel: I18n.t('continue_no'),
            onPick: () => {
              if (!Meta.spendGems(Config.CONTINUE_GEMS)) { this._overflowLose(); return; }
              Econ.refresh();
              this.softClear(Config.CONTINUE_CLEAR);
              Toasts.show(I18n.t('continue_done'), 'good', 1800, '💎');
              Render.hudSoon();
            },
            onCancel: () => this._overflowLose(),
          });
          return;
        }
        this._overflowLose(); return;
      }
      Render.syncCell(idx); Render.spawnAnim(idx);
      if (m.scoreAttack) {
        // Contrarreloj: presión CRECIENTE con el tiempo => la partida es finita
        // aunque ganes tiempo (los spawns acaban superando al jugador).
        // `mutFast` = mutador diario "veloz" (GM-15): toda la curva un 10% más rápida.
        const d = Config.DIFFICULTY[State.diff];
        State.spawnRate = clamp(Math.round(d.spawnStart * (State.mutFast ? 0.9 : 1) * Math.pow(0.92, State.elapsed / 10)), 300, d.spawnStart);
      } else {
        // Aceleración progresiva suave dentro del nivel
        State.spawnRate = Math.max(Config.DIFFICULTY[State.diff].spawnMin, State.spawnRate - 3);
      }
      Render.hudSoon();
      this.evaluate();
      // Aviso anti-desconcierto: si tras el spawn sigue sin haber jugada posible,
      // dilo (el jugador no sabe si está ciego o atascado). Throttle de 9s.
      if (State.status === 'playing' && State.iconCount >= 2 && !Engine.hasMoves()) {
        const now = performance.now();
        if (now - (this._stuckAt || 0) > 9000) {
          this._stuckAt = now;
          Toasts.show(I18n.t('no_moves_wait'), 'info', 2200, '⏳');
          announce(I18n.t('no_moves_wait'));
        }
      }
    },

    // Cápsula de tiempo (GM-13): coloca el pickup ⏰ cuando llega su momento seedeado.
    maybeTimecap() {
      if (State.capPlaced || State.elapsed < State.capAt) return;
      const e = [];
      for (let i = 0; i < State.board.length; i++) if (State.board[i] === null && !State.tiles[i]) e.push(i);
      if (!e.length) return; // sin hueco: reintenta el próximo segundo
      State.capPlaced = true;
      const idx = e[rand(e.length)];
      State.tiles[idx] = Tiles.make('timecap');
      Render.setTile(idx); Render.syncCell(idx); Render.cellPulse(idx, 'slowdown-placed', 700);
      Toasts.show(I18n.t('timecap_hint'), 'info', 1800, '⏰');
    },

    // Derrota real por tablero lleno (Clásico/Aventura), con el encuadre near-miss
    // de GM-01. Separada de doSpawn porque el escudo (GM-07) y el continuar (GM-02)
    // pueden interceptar el desbordamiento antes de llegar aquí.
    _overflowLose() {
      if (State.minIcons <= 10 && State.elapsed > 45) this._nearMiss = State.minIcons;
      this.gameOver(I18n.t('reason_full'));
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
      const stars = State.mode === 'clasico'
        ? `<span class="obj-stars" id="obj-stars" title="${I18n.t('stars_help')}" aria-label="${I18n.t('stars_label')}"></span>` : '';
      el.innerHTML = `<span class="obj-biome" style="color:${m.accent || 'var(--accent-2)'}">${MODE_IMG[State.mode] ? iconAnyInline(MODE_IMG[State.mode]) : m.emoji} ${I18n.modeT(State.mode, 'name')}</span><span class="obj-goal">${I18n.modeT(State.mode, 'goal')}</span>${stars}${ModeSignals.noteHtml(State.mode)}`;
      this.updateLiveStars();
    },

    // Estrellas según errores cometidos (criterio único y transparente).
    starsForMistakes(mistakes) {
      const e = Config.STAR_ERR;
      return mistakes <= e[0] ? 3 : mistakes <= e[1] ? 2 : 1;
    },
    // Refresca el indicador de estrellas en vivo del banner (solo Clásico).
    updateLiveStars() {
      if (State.mode !== 'clasico') return;
      const el = $('#obj-stars'); if (!el) return;
      const s = this.starsForMistakes(State.mistakes);
      el.innerHTML = [1, 2, 3].map((k) => `<span class="ols${k <= s ? ' on' : ''}">★</span>`).join('');
      el.dataset.stars = s;
    },

    /* Win/Lose: se evalúa tras cada cambio del tablero */
    evaluate() {
      if (State.status !== 'playing' || Coach.active) return;
      // Mínimo de iconos del nivel: mide "lo cerca que estuviste" para el near-miss (GM-01).
      if (State.iconCount < State.minIcons) State.minIcons = State.iconCount;
      // Hooks de modo: pueden forzar victoria/derrota propias (objetivos, oleadas…).
      // Devuelven 'win' | 'lose' | un texto de derrota, o nada para usar la regla base.
      const wc = Rules.call('winCheck', State);
      if (wc) { this.levelComplete(wc === 'perfect'); return; }
      const lc = Rules.call('loseCheck', State);
      if (lc) { this.gameOver(typeof lc === 'string' ? lc : I18n.t('reason_end')); return; }
      const m = Config.MODES[State.mode];
      // Modos sin progresión por niveles: la gestionan sus hooks/temporizador
      // (Supervivencia y Zen = endless; Contrarreloj = score attack).
      if (m.endless || m.scoreAttack) {
        if (State.iconCount > 0) State.emptyBonusClaimed = false;
        else if (!State.emptyBonusClaimed) this.emptyBoardBonus();
        return;
      }
      // VICTORIA = vaciar el tablero (si el objetivo del modo lo admite). NO hay
      // "victoria por estancamiento": si en un instante no hay jugada válida, se
      // espera al siguiente spawn (el spawn continuo creará nuevas convergencias).
      // La DERROTA real llega por overflow (tablero lleno) en doSpawn().
      const bcw = Rules.call('boardClearWins', State);
      if (State.iconCount === 0 && (bcw === undefined || bcw)) { this.levelComplete(true); return; }
    },

    emptyBoardBonus() {
      if (State.emptyBonusClaimed || State.iconCount !== 0) return;
      const m = Config.MODES[State.mode], d = Config.DIFFICULTY[State.diff];
      if (!m || !(m.endless || m.scoreAttack)) return;
      State.emptyBonusClaimed = true;
      State.emptyBoards = (State.emptyBoards || 0) + 1;
      State.perfectEver = true;

      const chain = State.emptyBoards;
      const wave = State.mode === 'supervivencia' ? Survival.wave : 1;
      const combo = Math.min(State.combo || 1, 12);
      const raw = Config.EMPTY_BOARD_BONUS + chain * 90 + combo * 28 + (State.mode === 'supervivencia' ? wave * 45 : 0);
      const points = Math.max(250, Math.round(raw * d.scoreMult * m.mult * this.feverBoost() * (State.tempMult || 1) * this.sprintMult()));
      const coins = clamp(Math.round(points / 220), 3, 16);
      const extra = [];
      const center = State.lastActionCell != null
        ? State.lastActionCell
        : (Math.floor(State.size / 2) * State.size + Math.floor(State.size / 2));

      State.score += points;
      State.coinsRun += coins;
      Meta.addCoins(coins);

      if (State.mode === 'supervivencia') {
        Survival.charge = Math.min(100, Survival.charge + 25);
        Survival.addFrenzy(24);
        Survival._lock(760, 'board-clear-bonus');
        Survival.render();
        extra.push('+25% carga', '+24% ' + I18n.t('surv_frenzy'));
      } else {
        Render.boardEvent('board-clear-bonus', 950);
      }
      if (m.scoreAttack) {
        const add = Math.min(8, Math.max(0, Math.round(Config.TIMED_CAP - State.timeLeft)));
        if (add > 0) { State.timeLeft += add; extra.push('+' + add + 's'); }
      }
      if (State.mode === 'zen') {
        State.hintsLeft = Math.min(9, State.hintsLeft + 1);
        extra.push('+1 pista');
        // Jardín zen (GM-23): cada tablero limpio hace crecer una flor (para siempre).
        const fl = Meta.addZenFlower();
        extra.push('🌸 ' + fl);
        if (fl === 10) { Meta.addChest(1); Toasts.show(I18n.t('garden_10'), 'good', 2800, 'chest'); Econ.refresh(); }
        if (fl === 50 && Meta.grantBoard('jardin')) { Toasts.show(I18n.t('garden_50'), 'good', 3400, '🌸'); Sound.record(); FX.confetti(90); }
      }

      const msg = `Tablero limpio · +${points} · +${coins} ${I18n.t('coins')}${extra.length ? ' · ' + extra.join(' · ') : ''}`;
      Toasts.show(msg, 'good', 2400, 'v2:four-pointed-star');
      Render.popup(center, `+${points} BONUS`, '#ffd84d');
      Render.bump($('#hud-score'));
      Render.flash();
      Sound.boardClear(); Haptics.level();
      if (!State.recordHit && Storage.best > 0 && State.score > Storage.best) {
        State.recordHit = true; Sound.record(); Haptics.record(); Toasts.show('¡Nuevo récord!', 'good', 1600, 'trophy');
      }
      this.saveBest();
      Render.hudSoon();
      announce(`Tablero limpio. Bonus ${points} puntos y ${coins} monedas.`);
      setTimeout(() => FX.boardClear(center, '#ffd84d'), Settings.reducedFx ? 0 : 220);
    },

    resetCombo() {
      State.combo = 0; State.comboMult = 1;
      if (State.fever) {
        State.fever = false;
        Render.feverOut(); // "exhalación" breve al salir de Fiebre (GM-27)
        if (State.mode === 'supervivencia') { Survival._setFrenzyClass(); Survival._syncIntensity(); }
        else { Render.fever(false); if (Settings.music) Music.setIntensity(0.15); }
      }
      Render.combo();
    },

    levelComplete(perfect) {
      State.status = 'levelComplete'; this.clearHintHighlight();
      if (perfect) { State.perfectEver = true; State.score += Config.EMPTY_BOARD_BONUS; Toasts.show(`¡Tablero limpio! +${Config.EMPTY_BOARD_BONUS}`, 'good'); Render.flash(); }
      this.saveBest(); Render.hud(); Render.fever(false); State.fever = false;
      const m = Config.MODES[State.mode];
      if (m.single) { this.win(perfect ? '¡Tutorial completado con tablero perfecto!' : '¡Tutorial completado!'); return; }
      Sound.level(); Haptics.level(); FX.confetti(perfect ? 90 : 60);
      // Modo Clásico: nivel del mapa. Calcula estrellas, guarda progreso y ofrece
      // "Siguiente nivel" / "Volver al mapa" (el mapa es el hub, no se auto-encadena).
      if (State.mode === 'clasico') { this._classicComplete(); return; }

      const next = State.level + 1;
      // Acento del modal: color del bioma siguiente (Aventura) o del modo.
      const accent = State.mode === 'aventura' ? Adventure.biomeOf(next).accent : (m.accent || '#00d0ff');
      const modal = $('#modal-level'); if (modal) modal.style.setProperty('--modal-accent', accent);
      const emb = $('#level-emblem'); if (emb) emb.innerHTML = perfect ? icon('star') : (State.mode === 'aventura' ? (BIOME_IMG[Adventure.biomeOf(State.level).id] ? iconAny(BIOME_IMG[Adventure.biomeOf(State.level).id]) : Adventure.biomeOf(State.level).glyph) : (MODE_IMG[State.mode] ? iconAny(MODE_IMG[State.mode]) : (m.emoji || '⭐')));

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

      { const mb = $('#btn-level-map'); if (mb) mb.hidden = true; }
      { const nb = $('#btn-next-level'); if (nb) nb.hidden = false; }
      Modal.open('modal-level');
      announce(I18n.t('sr_level').replace('{n}', State.score));
    },

    // Fin de nivel del modo Clásico: estrellas (según errores), recompensa y desbloqueo.
    _classicComplete() {
      const n = State.worldLevel || 1, w = Worlds.get(State.world);
      const stars = this.starsForMistakes(State.mistakes);
      const mastery = Meta.recordClassicPerfect(stars >= 3);
      this.classicMastery = mastery;
      const gained = Meta.setLevelStars(State.world, n, stars);
      // Racha de victorias (GM-05): +10% de monedas por nivel de racha desde la 2ª
      // victoria seguida, tope +50% — recompensa el "una más" sin castigar el fallo.
      const winStreak = Meta.recordClassicWin(true);
      const streakPct = Math.min(5, Math.max(0, winStreak - 1)) * 10;
      const coins = Math.round((20 + stars * 10 + Math.round(State.score / 60)) * (1 + streakPct / 100));
      Meta.addCoins(coins);
      const modal = $('#modal-level'); if (modal) modal.style.setProperty('--modal-accent', w.accent);
      const emb = $('#level-emblem'); if (emb) emb.innerHTML = stars >= 3 ? icon('star') : (WORLD_IMG[w.id] ? iconAny(WORLD_IMG[w.id]) : w.glyph);
      $('#level-title').textContent = I18n.t('level_done');
      $('#level-sub').textContent = I18n.t('classic_lvl_sub').replace('{n}', n).replace('{w}', w.name);
      const e = Config.STAR_ERR;
      // Criterio de cada estrella, resaltando la que el jugador NO logró por errores.
      const crit = [
        { s: 3, txt: I18n.t('star_c3') },
        { s: 2, txt: I18n.t('star_c2').replace('{n}', e[1]) },
        { s: 1, txt: I18n.t('star_c1') },
      ].map((c) => `<span class="sc-row${c.s === stars ? ' got' : ''}${c.s > stars ? ' missed' : ''}"><span class="sc-st">${'★'.repeat(c.s)}</span>${c.txt}</span>`).join('');
      const starsHtml = `<div class="classic-stars" aria-label="${stars}/3">` +
        [1, 2, 3].map(k => `<span class="cs${k <= stars ? ' on' : ''}">${k <= stars ? iconInline('star') : iconInline('star-empty')}</span>`).join('') + '</div>' +
        `<div class="star-criteria">${crit}<span class="sc-mine">${I18n.t('star_mine').replace('{n}', State.mistakes)}</span></div>`;
      $('#level-stats').innerHTML = starsHtml + statRow([
        [State.score, I18n.t('st_points'), 'var(--score)'],
        ['×' + State.maxCombo, I18n.t('st_combo'), 'var(--gold)'],
        [State.removedTotal, I18n.t('st_removed'), 'var(--good)'],
      ]);
      const masteryHtml = mastery.streak > 0
        ? `<div class="classic-mastery">${iconInline('star')} ${esc(I18n.t('classic_streak').replace('{n}', mastery.streak))}<small>${esc(I18n.t('classic_best_streak').replace('{n}', mastery.best))}</small></div>`
        : `<div class="classic-mastery reset">${esc(I18n.t('classic_streak_lost'))}<small>${esc(I18n.t('classic_best_streak').replace('{n}', mastery.best))}</small></div>`;
      const streakHtml = streakPct > 0
        ? `<div class="win-streak-line">${esc(I18n.t('classic_win_streak').replace('{n}', winStreak).replace('{p}', streakPct))}</div>`
        : '';
      $('#level-next').innerHTML = `<div class="m-card-h">${iconInline('coin')} +${coins}${gained > 0 ? ' · ' + iconInline('star') + ' +' + gained : ''}</div>${streakHtml}${masteryHtml}`;
      if (mastery.streak >= 2) Toasts.show(I18n.t('classic_streak').replace('{n}', mastery.streak), 'good', 1700, 'star');
      const last = n >= Worlds.PER_WORLD;
      { const nb = $('#btn-next-level'); if (nb) { nb.hidden = last; nb.textContent = I18n.t('classic_next'); } }
      { const mb = $('#btn-level-map'); if (mb) mb.hidden = false; }
      Modal.open('modal-level');
      announce(I18n.t('sr_stars').replace('{s}', stars).replace('{n}', State.score));
    },

    // Vuelve al mapa de mundos desde el modal de fin de nivel.
    toWorldsMap() {
      Loop.stop(); Music.stop(); State.status = 'idle'; this.ended = true;
      Modal.close(); ModeSignals.clear(); this.clearHintHighlight();
      Worlds.open();
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
        head = `${BIOME_IMG[bi.id] ? iconAnyInline(BIOME_IMG[bi.id]) : bi.glyph} ${I18n.t('chapter')} ${ch + 1} · ${Adventure.biomeName(bi)}`;
        extra = `<div class="m-goal${boss ? ' boss' : ''}">${boss ? iconInline('warning') + ' ' : iconInline('target') + ' '}${Adventure.previewObjective(next)}</div>`;
        if (newChapter && bi.mods.length) extra += `<div class="m-mod">${Adventure.biomeModText(bi)}</div>`;
      } else {
        head = `${I18n.t('next')} · ${I18n.t('lvl')} ${next}`;
      }
      // (Contrarreloj ya no progresa por niveles, así que no hay preview de tiempo.)
      const deltas = `<span class="delta">${iconInline('bolt')} ${curSpawn.toFixed(1)}s → <strong>${nxtSpawn.toFixed(1)}s</strong></span>` +
        `<span class="delta">${iconInline('dice')} ${curVar} → <strong>${nxtVar}</strong></span>`;
      return `<div class="m-card-h">${head}</div>` +
        `<div class="ic-label">${I18n.t('new_icons')}</div>` +
        `<div class="ic-row">${icons}</div>` +
        `<div class="deltas">${deltas}</div>${extra}`;
    },

    nextLevel() {
      // Clásico: avanza al siguiente nivel del mundo (ya desbloqueado) y sigue jugando.
      if (State.mode === 'clasico') {
        State.worldLevel = (State.worldLevel || 1) + 1;
        State.level = State.worldLevel;
        // Estadísticas POR NIVEL: cada nivel se puntúa/valora desde cero (las estrellas
        // dependen solo de los errores de ESE nivel, no de los acumulados del mundo).
        State.score = 0; State.displayScore = 0; State.mistakes = 0;
        State.combo = 0; State.comboMult = 1; State.comboAt = 0; State.maxCombo = 0; State.removedTotal = 0;
        State.bestPlay = null; // el pico se puntúa por nivel, igual que el score (GM-28)
        State.fever = false; Render.fever(false);
        State.status = 'playing'; Modal.close();
        this.setupLevel(); this.showGoalBanner(); Loop.start();
        Toasts.show(`${I18n.t('lvl')} ${State.worldLevel}`, 'info', 1300);
        return;
      }
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
        if (ch !== prevChapter) { const bi = Adventure.biomeOf(State.level); Toasts.show(`${I18n.t('chapter')} ${ch + 1}: ${Adventure.biomeName(bi)}`, 'good', 2200, BIOME_IMG[bi.id] || bi.glyph); }
        else Toasts.show(`${I18n.t('lvl')} ${State.level}`, 'info', 1200);
        // Entrada de capítulo: reliquia por el jefe superado (GM-07) y luego la
        // ruta del capítulo nuevo (GM-06) — recompensa primero, plan después.
        if (Adventure.licOf(State.level) === 0) {
          const chain = () => Adventure.offerRelic(() => Adventure.maybeOfferRoute(State.level));
          if (!Adventure.maybeChapterIntro(State.level, chain)) chain();
        }
      } else {
        Toasts.show(`${I18n.t('lvl')} ${State.level}`, 'info', 1400);
      }
    },

    // Aplica emblema y color de acento al modal de fin de partida.
    _overChrome(iconName, accent, fallbackEmoji) {
      const e = $('#over-emblem'); if (e) { if (iconName) e.innerHTML = iconAny(iconName); else e.textContent = fallbackEmoji || ''; }
      const mo = $('#modal-over'); if (mo) mo.style.setProperty('--modal-accent', this.newRecord || this._survNew || this._survWaveNew ? 'var(--gold)' : accent);
    },

    win(reason) {
      this.endGame();
      Sound.level(); Haptics.level(); FX.confetti(110);
      $('#over-title').textContent = I18n.t('over_victory').replace(/^[^A-Za-z0-9¿¡]+/, '').trim();
      this._overChrome('trophy', 'var(--gold)');
      $('#over-reason').textContent = reason;
      this.fillStats(); Modal.open('modal-over');
      announce(`¡Victoria! Puntuación ${State.score}.`);
    },

    gameOver(reason) {
      if (this.ended) return;
      // Supervivencia: registra el récord de tiempo sobrevivido.
      this._survNew = false; this._survWaveNew = false;
      if (State.mode === 'supervivencia') {
        this._survNew = Meta.survRecord(Survival.survSec);
        this._survWaveNew = Survival.newWaveRecord || Meta.survWaveRecord(Survival.wave);
      }
      // Reto diario: registra la marca y premia el primer intento del día.
      if (State.isDaily) {
        const r = Meta.recordDailyRun(State.score);
        this.dailyRunResult = r;
        if (r.firstToday) Toasts.show(I18n.t('daily_first_reward'), 'good', 2400, '💎');
        else if (r.newBest) Toasts.show(I18n.t('daily_new_best').replace('{n}', r.best), 'good', 2200, '🎯');
        if (r.medal !== 'none') Toasts.show(I18n.t('daily_medal_result').replace('{m}', ModeSignals.dailyMedalLabel(r.medal)), 'good', 2200, 'medal');
        if (r.streakChest) { Toasts.show(I18n.t('daily_streak_chest').replace('{n}', r.streak), 'good', 2800, 'chest'); Sound.record(); FX.confetti(70); }
        // Ghost del día (GM-12): si es la mejor marca de hoy, guarda su línea de tiempo.
        if (r.newBest) { State.ghostSamples.push(State.score); Meta.setDailyGhost(State.ghostSamples); }
      } else if (Config.MODES[State.mode].scoreAttack && State.score > Meta.modeBest(State.mode)) {
        // Ghost de Contrarreloj libre (GM-12): línea de tiempo del récord del modo.
        State.ghostSamples.push(State.score);
        Meta.setModeGhost(State.mode, State.ghostSamples);
      }
      if (State.mode === 'clasico') { this.classicMastery = Meta.recordClassicPerfect(false); Meta.recordClassicWin(false); }
      this.endGame();
      Sound.over(); Haptics.error(); Render.boardShake();
      const m = Config.MODES[State.mode];
      $('#over-title').textContent = (State.mode === 'supervivencia' ? I18n.t('over_surv') : I18n.t('over_fail')).replace(/^[^A-Za-z0-9¿¡]+/, '').trim();
      this._overChrome(State.mode === 'supervivencia' ? 'shield' : MODE_IMG[State.mode], m.accent || '#ff5d73', m.emoji || '🏁');
      $('#over-reason').textContent = reason;
      this.fillStats(); Modal.open('modal-over');
      announce(reason + ' ' + I18n.t('sr_over').replace('{n}', State.score));
    },

    endGame() {
      Picker.dismiss(); // B-06: ninguna elección puede sobrevivir al fin de partida
      { const pl = $('#prelevel'); if (pl) pl.hidden = true; }
      Loop.stop(); Music.stop(); State.status = 'over'; this.ended = true; this.clearHintHighlight();
      Render.fever(false); State.fever = false; Render.danger(0);
      if (State.mode === 'supervivencia') { Survival.cleanup(); document.body.classList.remove('mode-surv'); }
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
      const rec = $('#over-record');
      if (rec) {
        rec.hidden = !this.newRecord && !this._survNew && !this._survWaveNew;
        if (this._survWaveNew) rec.innerHTML = iconInline('trophy') + ' ' + I18n.t('surv_wave_record').replace('{w}', Survival.wave);
        else if (this._survNew) rec.innerHTML = iconInline('shield') + ' ' + I18n.t('surv_time_record');
        else if (this.newRecord) rec.innerHTML = iconInline('trophy') + ' ¡Nuevo récord!';
      }
      // Near-miss (GM-01): "te quedaste a {n} figuras" — solo cuando aplica (derrota por
      // tablero lleno en Clásico/Aventura habiendo estado realmente cerca de vaciar).
      { const nm = $('#over-near'); if (nm) {
        nm.hidden = this._nearMiss == null;
        if (this._nearMiss != null) nm.textContent = I18n.t('near_miss').replace('{n}', this._nearMiss);
        this._nearMiss = null;
      } }
      // Momento destacado (GM-28): la mejor jugada de la partida (regla pico-final).
      { const pk = $('#over-peak'); if (pk) {
        const bp = State.bestPlay;
        const show = !!bp && bp.points >= 50;
        pk.hidden = !show;
        if (show) {
          const where = State.mode === 'supervivencia'
            ? ` · ${I18n.t('st_wave')} ${bp.wave}`
            : (State.mode === 'clasico' || State.mode === 'aventura' ? ` · ${I18n.t('lvl')} ${bp.level}` : '');
          pk.innerHTML = iconInline('star') + ' ' + esc(I18n.t('peak_moment').replace('{p}', bp.points).replace('{c}', bp.combo) + where);
        }
      } }
      const m = Config.MODES[State.mode];
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
        [Meta.survBestWave(), I18n.t('surv_best_wave'), 'var(--warn)'],
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
      const survRewards = State.mode === 'supervivencia'
        ? `<div class="mission-done surv-rewards">${iconInline('coin')} ${I18n.t('surv_reward_line').replace('{c}', Survival.runCoins).replace('{g}', Survival.runGems).replace('{ch}', Survival.runChests)}</div>`
        : '';
      const dailyResult = ModeSignals.dailyResultHtml(this.dailyRunResult);
      const modeResult = ModeSignals.resultHtml();
      $('#over-xp').innerHTML =
        `<div class="xp-line"><span class="xp-gain">+${r.xpGained} XP</span><span class="xp-coins">${iconInline('coin')} <span class="xp-coins-n">+${r.coinsGained || 0}</span></span><span class="xp-rank">${Meta.rank()} · ${I18n.t('lvl')} ${lvl}</span></div>` +
        `<div class="xpbar"><div class="xpbar-fill" style="width:${Math.min(100, have / need * 100).toFixed(0)}%"></div></div>` +
        (r.leveledUp ? `<div class="xp-up">${iconInline('upgrade')} ${I18n.t('lvl')} ${lvl}!</div>` : '') +
        (r.missionDone ? `<div class="mission-done">${iconInline('check')} ${I18n.t('daily_done')} · +150 XP</div>` : '') +
        (r.weeklyDone ? `<div class="mission-done">${iconInline('calendar')} ${I18n.t('weekly_done')} · +400 XP</div>` : '') +
        survRewards + dailyResult + modeResult;
      countUp($('#over-xp .xp-gain'), r.xpGained, 700, '+', ' XP');
      countUp($('#over-xp .xp-coins-n'), r.coinsGained || 0, 700, '+', '');
      $('#over-ach').innerHTML = r.newAch.length
        ? '<div class="ach-new">' + iconInline('medal') + ' ' + r.newAch.map(a => a.name).join(' · ') + '</div>' : '';
      // Registro de expedición (GM-09): la run de Aventura como historia contable.
      { const ex = $('#over-exped'); if (ex) {
        const html = State.mode === 'aventura' ? Adventure.expeditionHtml() : '';
        ex.hidden = !html; ex.innerHTML = html;
      } }
      { const nx = $('#over-next'); if (nx) nx.innerHTML = NextActions.html(r); }
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
      // Los potenciadores apuntables funcionan en Supervivencia y en Clásico (GM-03).
      const armed = () => (State.mode === 'supervivencia' || State.mode === 'clasico') && Survival.armed;
      // Activación rápida por pointerdown (sin retardo)
      board.addEventListener('pointerdown', (e) => {
        const cell = e.target.closest('.cell');
        if (!cell) return;
        e.preventDefault();
        Sound.ensure();
        // Power-up apuntado armado: aplicar en la casilla elegida en vez de jugar.
        if (armed()) { Survival.applyBoosterAt(Survival.armed, +cell.dataset.i); return; }
        Game.activate(+cell.dataset.i);
      });
      // Previsualización del área afectada mientras se apunta (hover ratón / arrastre táctil).
      board.addEventListener('pointermove', (e) => {
        if (!armed()) return;
        const cell = e.target.closest('.cell');
        Survival.previewAt(cell ? +cell.dataset.i : null);
      });
      board.addEventListener('pointerleave', () => { if (armed()) Survival.previewAt(null); });
      // Teclado: roving tabindex + flechas + Enter/Espacio
      board.addEventListener('keydown', (e) => {
        const cell = e.target.closest('.cell'); if (!cell) return;
        let i = +cell.dataset.i; const s = State.size;
        let n = i;
        if (e.key === 'ArrowRight') n = i % s === s - 1 ? i : i + 1;
        else if (e.key === 'ArrowLeft') n = i % s === 0 ? i : i - 1;
        else if (e.key === 'ArrowUp') n = i - s < 0 ? i : i - s;
        else if (e.key === 'ArrowDown') n = i + s >= s * s ? i : i + s;
        else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); Sound.ensure(); if (armed()) { Survival.applyBoosterAt(Survival.armed, i); } else { Game.activate(i); } return; }
        else return;
        e.preventDefault();
        if (n !== i) { Render.cells[i].tabIndex = -1; Render.cells[n].tabIndex = 0; Render.cells[n].focus(); }
      });
    },
  };

  /* ===================== Construcción de menús ===================== */
  // Lanzador de Zen (GM-24): elegir ritmo (sereno = tabla fácil, más lento; normal).
  // Es el único punto del juego donde elegir ritmo encaja sin romper comparabilidad.
  function launchZen() {
    Modal.close();
    const last = Storage.zenDiff;
    const opts = [
      { id: 'facil', icon: '🍃', name: I18n.t('zen_pace_slow'), desc: I18n.t('zen_pace_slow_d') },
      { id: 'normal', icon: '☯️', name: I18n.t('zen_pace_normal'), desc: I18n.t('zen_pace_normal_d') },
    ];
    if (last === 'normal') opts.reverse(); // el último ritmo elegido, primero
    Picker.open({
      title: I18n.t('zen_pace_title'), accent: '#9be15d',
      options: opts,
      cancelLabel: I18n.t('pick_back'), // B-05: tocar Zen por error no debe atrapar
      onPick: (d) => { Storage.zenDiff = d; Game.start('zen', d); },
    });
  }
  // Catálogo completo de la pantalla "Elige tu modo": los 5 modos jugables agrupados
  // (Progresión / Puntuación / Relax). El Tutorial NO es una tarjeta aquí — vive en el
  // modal "¿Cómo se juega?". Multijugador queda fuera de V1 (volverá con la capa online).
  const MODE_CARDS = [
    { group: 'group_prog', key: 'clasico', accent: '#2f6bff', svg: 'island', art: 'classic',
      i18n: 'card_classic', badge: 'card_classic_badge', desc: 'card_classic_desc',
      feats: [['lock', 'card_feat_locks'], ['target', 'card_feat_objects'], ['bolt', 'card_feat_events'], ['v2:four-pointed-star', 'card_feat_more']],
      action: () => openWorldsMap() },
    { group: 'group_prog', key: 'aventura', accent: '#7a5cff', mode: 'aventura',
      badge: 'card_adv_badge', feats: [],
      action: () => openAdventure() },
    { group: 'group_score', key: 'supervivencia', accent: '#ff5b6e', svg: 'heartFoes', art: 'surv',
      i18n: 'card_surv', badge: 'card_surv_badge', desc: 'card_surv_desc', feats: [],
      action: () => openSurvivalDiff() },
    { group: 'group_score', key: 'contrarreloj', accent: '#ff6cb0', mode: 'contrarreloj',
      badge: 'card_contra_badge', feats: [['target', 'card_contra_daily']],
      action: () => { Modal.close(); Game.start('contrarreloj', 'normal'); } },
    { group: 'group_relax', key: 'zen', accent: '#9be15d', mode: 'zen',
      badge: 'card_zen_badge', feats: [],
      action: () => launchZen() },
  ];
  const MODE_GROUPS = ['group_prog', 'group_score', 'group_relax'];
  function buildModeMenu() {
    const cont = $('#mode-cards'); if (!cont) return;
    const cardTitle = (c) => c.i18n ? I18n.t(c.i18n) : I18n.modeT(c.mode, 'name');
    const cardDesc = (c) => c.desc ? I18n.t(c.desc) : I18n.modeT(c.mode, 'desc');
    const featIcon = (tok) => {
      const mapped = EMOJI_IMG[tok] || (/^(v2:)?[a-z][a-z0-9-]*$/.test(tok) ? tok : null);
      return mapped ? iconAnyInline(mapped) : tok;
    };
    const featsHTML = (feats) => feats && feats.length
      ? `<span class="mc-feats">${feats.map(f => `<span class="mc-feat"><span class="mc-feat-ic">${featIcon(f[0])}</span>${esc(I18n.t(f[1]))}</span>`).join('')}</span>` : '';
    const artHTML = (c) => (c.svg && Art[c.svg])
      ? `<span class="mc-art mc-art-${c.art}" aria-hidden="true">${Art[c.svg]()}</span>`
      : `<span class="mc-art mc-art-icon" aria-hidden="true">${MODE_IMG[c.key] ? iconAnyInline(MODE_IMG[c.key]) : ''}</span>`;
    const current = Storage.lastMode;
    const cardHTML = (c) => `<button type="button" class="mode-hero${c.key === current ? ' mode-current' : ''}" role="listitem" data-mode="${c.key}" style="--mode-accent:${c.accent}" aria-label="${esc(cardTitle(c))}"${c.key === current ? ' aria-current="true"' : ''}>
        ${artHTML(c)}
        <span class="mc-body">
          <span class="mc-titlerow"><span class="mc-title">${esc(cardTitle(c))}</span><span class="mc-badge">${esc(I18n.t(c.badge))}</span></span>
          <span class="mc-desc">${esc(cardDesc(c))}</span>
          ${featsHTML(c.feats)}
        </span>
        <span class="mc-go" aria-hidden="true">›</span>
      </button>`;
    const groupsHTML = MODE_GROUPS.map((g) => {
      const cards = MODE_CARDS.filter((c) => c.group === g);
      if (!cards.length) return '';
      return `<h3 class="group-title mode-group-title">${esc(I18n.t(g))}</h3>${cards.map(cardHTML).join('')}`;
    }).join('');
    const howHTML = `<button type="button" class="mode-how" role="listitem" data-mode="how">
        <span class="mc-how-ic" aria-hidden="true">${Art.book()}</span>
        <span class="mc-body">
          <span class="mc-title">${esc(I18n.t('how_title'))}</span>
          <span class="mc-desc">${esc(I18n.t('how_card_desc'))}</span>
        </span>
        <span class="mc-how-cta">${esc(I18n.t('how_card_cta'))} ›</span>
      </button>`;
    cont.innerHTML = groupsHTML + howHTML;
    MODE_CARDS.forEach((c) => {
      const el = cont.querySelector(`[data-mode="${c.key}"]`);
      if (el) el.addEventListener('click', () => { Sound.ui(); c.action(); });
    });
    const hb = cont.querySelector('[data-mode="how"]');
    if (hb) hb.addEventListener('click', () => { Sound.ui(); Modal.open('modal-how'); });
    Econ.refresh();
  }
  // Aventura → mapa de capítulos (modal-adventure); su botón "Continuar" lanza la partida.
  function openAdventure() { buildAdventureMap(); Modal.open('modal-adventure'); }
  // Estado vacío reutilizable: icono (opcional) + título + subtítulo + CTA (data-act delegado).
  // Evita que cofres/logros/clasificación se vean "rotos" cuando aún no hay datos.
  function emptyState(icon, title, sub, ctaText, ctaAct) {
    const ic = icon ? `<span class="empty-ic" aria-hidden="true">${iconAnyInline(icon)}</span>` : '';
    const cta = ctaText ? `<button class="btn btn-primary btn-sm empty-cta" data-act="${ctaAct}">${esc(ctaText)}</button>` : '';
    return `<div class="empty-state">${ic}<p class="empty-title">${esc(title)}</p><p class="empty-sub">${esc(sub)}</p>${cta}</div>`;
  }
  // Clásico → mapa de mundos (Fase 2 lo sustituye por la pantalla dedicada).
  function openWorldsMap() {
    if (typeof Worlds !== 'undefined' && Worlds.open) { Worlds.open(); return; }
    buildAdventureMap(); Modal.open('modal-adventure');
  }
  // Multijugador: fuera de V1 (volverá con la capa online, ROADMAP §8). El modal-multi
  // queda latente en el HTML pero ninguna superficie de V1 lo abre.
  let survDiff = Config.DIFF_ORDER.indexOf(Storage.survDiff) >= 0 ? Storage.survDiff : 'normal';
  function renderSurvivalDiff() {
    document.querySelectorAll('[data-surv-diff]').forEach((btn) => {
      const on = btn.dataset.survDiff === survDiff;
      btn.classList.toggle('on', on);
      btn.setAttribute('aria-checked', String(on));
    });
    const start = $('#btn-surv-start');
    if (start) start.dataset.diff = survDiff;
  }
  function openSurvivalDiff() {
    survDiff = Config.DIFF_ORDER.indexOf(Storage.survDiff) >= 0 ? Storage.survDiff : 'normal';
    renderSurvivalDiff();
    Modal.open('modal-surv-diff');
  }
  function startSurvivalSelected() {
    Storage.survDiff = survDiff;
    Modal.close();
    Game.start('supervivencia', survDiff);
  }

  /* ===================== Top bar reutilizable (sistema base) ===================== */
  const TOPBAR_HTML = `
    <div class="appbar-profile">
      <button class="appbar-profile-main" type="button" data-act="profile" aria-label="Perfil">
        <span class="avatar"><span class="avatar-art">${Art.avatar()}</span><span class="avatar-badge">1</span></span>
        <span class="appbar-id">
          <span class="appbar-name-row"><b class="appbar-name">Jugador</b></span>
          <span class="appbar-lvl">
            <span class="appbar-lvl-star">⭐</span><span class="appbar-lvl-txt">Nivel 1</span>
            <span class="appbar-xp"><span class="appbar-xp-fill"></span></span>
            <span class="appbar-xp-num">0 / 0</span>
          </span>
        </span>
      </button>
      <button class="appbar-edit" type="button" data-act="edit-name" aria-label="Editar nombre">${Art.pencil()}</button>
    </div>
    <div class="appbar-econ">
      <span class="econ-pill econ-coins"><span class="econ-ic">${Art.coin()}</span><b data-econ-num="coins">0</b><span class="econ-plus" data-act="buy-coins" role="button" aria-label="Conseguir monedas">${Art.plus()}</span></span>
      <span class="econ-pill econ-gems"><span class="econ-ic">${Art.gem()}</span><b data-econ-num="gems">0</b></span>
    </div>`;
  function mountTopBars() { document.querySelectorAll('[data-topbar]').forEach((el) => { el.innerHTML = TOPBAR_HTML; }); }
  // Rellena los placeholders <span data-art="nombre"> con el SVG de Art (una sola vez).
  function fillArt(root) {
    (root || document).querySelectorAll('[data-art]').forEach((el) => {
      const name = el.dataset.art;
      if (typeof Art[name] === 'function' && el.dataset.arted !== '1') { el.innerHTML = Art[name](); el.dataset.arted = '1'; }
    });
  }
  function updateTopBars() {
    const prof = Storage.profile || { name: 'Jugador', color: '#00d0ff' };
    const lvl = Meta.level(), need = Meta.xpForLevel(lvl), have = Meta.xp();
    document.querySelectorAll('[data-topbar]').forEach((bar) => {
      const n = bar.querySelector('.appbar-name'); if (n) n.textContent = prof.name;
      const l = bar.querySelector('.appbar-lvl-txt'); if (l) l.textContent = I18n.t('lvl') + ' ' + lvl;
      const xf = bar.querySelector('.appbar-xp-fill'); if (xf) xf.style.width = Math.min(100, have / need * 100).toFixed(0) + '%';
      const xn = bar.querySelector('.appbar-xp-num'); if (xn) xn.textContent = have + ' / ' + need;
      const bd = bar.querySelector('.avatar-badge'); if (bd) bd.textContent = lvl;
    });
    Econ.refresh();
  }
  function renameProfile() {
    const cur = (Storage.profile && Storage.profile.name) || 'Jugador';
    const name = (window.prompt(I18n.t('edit_name'), cur) || '').trim().slice(0, 16);
    if (name) { const p = Storage.profile || { color: '#00d0ff' }; p.name = name; Storage.profile = p; Storage.user = name; updateTopBars(); refreshStart(); }
  }

  function refreshStart() {
    updateTopBars();
    { const sb = $('#start-best'); if (sb) sb.textContent = Storage.best; }
    // Banner de recompensa diaria: visible siempre; badge/botón activos si toca reclamar.
    { const ready = Meta.rewardReady(); const bn = $('#btn-reward'); if (bn) bn.classList.toggle('claimed', !ready);
      const bd = bn && bn.querySelector('.db-badge'); if (bd) bd.hidden = !ready; }
    // Botón "Continuar partida": solo si hay un snapshot reanudable.
    { const rr = $('#btn-resume-run'); if (rr) rr.hidden = !RunSave.load(); }
    // Tarjeta "Reto del día" del home: estado (sin jugar / hecho + mejor marca de hoy).
    { const card = $('#home-daily-card'), st = $('#home-daily-state');
      if (card && st) {
        const dr = Meta.dailyRunInfo();
        const played = (dr.plays || 0) > 0;
        const medal = Meta.dailyMedal(dr.best || 0);
        card.classList.toggle('done', played);
        card.classList.remove('medal-bronze', 'medal-silver', 'medal-gold');
        if (played && medal !== 'none') card.classList.add('medal-' + medal);
        // Racha de medallas (GM-14) y mutador del día (GM-15) en la tarjeta.
        const streak = Meta.dailyStreak();
        const streakTxt = streak > 0 ? ' · 🔥' + streak : '';
        const mut = DailyMut.pick(new Date().toISOString().slice(0, 10));
        const mutTxt = mut !== 'pure' ? ' · 🎲 ' + I18n.t('dmut_' + mut + '_n') : '';
        if (played) {
          const key = medal !== 'none' ? 'daily_done_medal' : 'daily_done_state';
          st.textContent = I18n.t(key).replace('{n}', dr.best).replace('{m}', ModeSignals.dailyMedalLabel(medal)) + streakTxt;
          st.removeAttribute('data-i18n');
        }
        else { st.textContent = I18n.t('daily_pending') + mutTxt + streakTxt; st.removeAttribute('data-i18n'); }
      } }
    // Cabecera compacta: perfil (izq) + economía (der), sin tarjeta.
    const prof = Storage.profile || { name: 'Jugador', color: '#00d0ff' };
    const lvl = Meta.level(), need = Meta.xpForLevel(lvl), have = Meta.xp();
    { const a = $('#home-avatar'); if (a) a.style.setProperty('--av', prof.color); }
    { const n = $('#home-name'); if (n) n.textContent = prof.name; }
    { const l = $('#home-level'); if (l) l.textContent = I18n.t('lvl') + ' ' + lvl; }
    { const xf = $('#home-xp-fill'); if (xf) xf.style.width = Math.min(100, have / need * 100).toFixed(0) + '%'; }
    Econ.refresh(); // recalcula pills y badges de sumideros (misiones/cofres) vía updateSinkBadges
    // Misiones (gancho de retención) con barra de progreso visible, en el panel lateral.
    const mi = $('#start-missions');
    if (mi) {
      const row = (cls, icon, m, doneTxt) => {
        const tgt = m.target || 1, cur = Math.min(m.progress || 0, tgt);
        const pct = m.done ? 100 : Math.min(100, cur / tgt * 100);
        const prog = m.done ? '✅' : `${cur}/${tgt}`;
        return `<div class="daily ${cls} ${m.done ? 'done' : ''}"><span class="daily-icon">${icon}</span><div class="daily-main"><span class="daily-text">${m.done ? doneTxt : esc(m.text)}</span><div class="daily-bar"><div class="daily-bar-fill" style="width:${pct.toFixed(0)}%"></div></div></div><span class="daily-prog">${prog}</span></div>`;
      };
      // Reto del día (tablero seedeado por fecha, igual para todos los jugadores).
      const dr = Meta.dailyRunInfo();
      const medal = Meta.dailyMedal(dr.best || 0);
      const medalText = medal !== 'none' ? ModeSignals.dailyMedalLabel(medal) + ' · ' : '';
      const drBest = dr.best > 0 ? `<small class="daily-run-best medal-${medal}">${esc(medalText + I18n.t('daily_best').replace('{n}', dr.best))}</small>` : '';
      // Calendario compacto de medallas (GM-14): 14 días + racha con congelación ética.
      const streak = Meta.dailyStreak();
      const calDots = Meta.dailyCalendar(14).map((c) => `<span class="cal-dot m-${c.medal}" title="${c.date}"></span>`).join('');
      const calHtml = `<span class="daily-cal" aria-label="${esc(I18n.t('daily_cal_al'))}">${calDots}${streak > 0 ? `<b class="daily-streak-n">🔥${streak}</b>` : ''}</span>`;
      const daily = `<div class="daily daily-run medal-${medal}"><span class="daily-icon">🎯</span><div class="daily-main"><span class="daily-text">${esc(I18n.t('daily_challenge'))}</span>${drBest}${calHtml}</div><button class="btn btn-primary btn-sm" data-daily-run>${esc(I18n.t('daily_play'))}</button></div>`;
      const dm = Meta.dailyMission();
      // Reroll de misión diaria (sumidero de tickets): solo si no está hecha y hay ticket.
      const reroll = (!dm.done && Meta.tickets() > 0)
        ? `<button class="btn btn-ghost btn-sm mission-reroll" data-reroll>🎟️ ${esc(I18n.t('reroll_mission'))}</button>` : '';
      mi.innerHTML = daily + row('', '🎯', dm, I18n.t('daily_done')) + reroll + row('weekly', '🗓️', Meta.weeklyChallenge(), I18n.t('weekly_done'));
      const db = mi.querySelector('[data-daily-run]');
      if (db) db.addEventListener('click', () => { Sound.ensure(); Modal.close(); Game.startDaily(); });
      const rb = mi.querySelector('[data-reroll]');
      if (rb) rb.addEventListener('click', () => {
        const next = Meta.rerollDaily();
        if (!next) { Sound.miss(); return; }
        Sound.ui(); Toasts.show(I18n.t('mission_rerolled'), 'good', 1800, '🎯');
        refreshStart();
      });
    }
    // Hint de continuar Aventura (gancho de progresión) bajo el botón Jugar.
    const ph = $('#play-hint');
    if (ph) {
      const am = (Meta.advMax && Meta.advMax()) || 1;
      if (am > 1) { ph.hidden = false; ph.textContent = '🚀 ' + I18n.t('lvl') + ' ' + am; }
      else ph.hidden = true;
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
    renderSurvivalDiff();
    if (State.status === 'playing' || State.status === 'paused') Game.showGoalBanner();
  }

  // Panel de ajustes (toggles persistentes)
  function buildSettings() {
    const rows = [
      { k: 'sfx', label: I18n.t('set_sfx'), icon: Settings.sfx ? 'sound-on' : 'sound-off' },
      { k: 'music', label: I18n.t('set_music'), icon: Settings.music ? 'music-on' : 'music-off' },
      { k: 'haptics', label: I18n.t('set_haptics'), show: Haptics.ok, icon: 'v2:mobile-phone' },
      { k: 'reducedFx', label: I18n.t('set_reduced'), icon: 'aura' },
      { k: 'largeText', label: I18n.t('set_large'), icon: 'v2:font' },
    ];
    const list = $('#settings-list'); if (!list) return;
    let html = rows.filter(r => r.show !== false).map(r =>
      `<div class="set-row"><span class="set-row-l"><span class="set-ic">${r.icon ? iconAny(r.icon) : (r.emoji || '')}</span><span>${r.label}</span></span><button class="switch" role="switch" data-set="${r.k}" aria-checked="${Settings[r.k]}" aria-label="${r.label}"><span class="switch-dot"></span></button></div>`
    ).join('');
    html += `<div class="set-row"><span class="set-row-l"><span class="set-ic">${icon('planet')}</span><span>${I18n.t('set_lang')}</span></span><div class="lang-pick">` +
      `<button class="lang-btn${Settings.lang !== 'en' ? ' on' : ''}" data-lang="es">ES</button>` +
      `<button class="lang-btn${Settings.lang === 'en' ? ' on' : ''}" data-lang="en">EN</button></div></div>`;
    list.innerHTML = html;
    list.querySelectorAll('[data-set]').forEach(btn => btn.addEventListener('click', () => {
      const k = btn.dataset.set; Settings[k] = !Settings[k]; btn.setAttribute('aria-checked', String(Settings[k]));
      if (k === 'sfx' && Settings.sfx) { Sound.ensure(); Sound.ui(); }
      if (k === 'music') { Settings.music && State.status === 'playing' ? Music.start() : Music.stop(); }
      if (k === 'reducedFx') applyReducedFx();
      if (k === 'largeText') applyLargeText();
      if (k === 'sfx' || k === 'music') { const si = btn.closest('.set-row').querySelector('.set-ic'); if (si) si.innerHTML = icon(k === 'sfx' ? (Settings.sfx ? 'sound-on' : 'sound-off') : (Settings.music ? 'music-on' : 'music-off')); }
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
    // Leaderboard local por modo (mejor marca). Estado vacío si nunca se ha jugado.
    const lbEl = $('#profile-lb');
    if (lbEl) {
      const modes = Config.MODE_ORDER.filter(k => k !== 'tutorial');
      const totalPlays = modes.reduce((s, k) => s + Meta.modePlays(k), 0);
      if (totalPlays === 0) {
        lbEl.innerHTML = emptyState('trophy', I18n.t('empty_lb_title'), I18n.t('empty_lb_sub'), I18n.t('empty_cta_play'), 'go-play');
      } else {
        lbEl.innerHTML = modes.map(k => {
          const mo = Config.MODES[k];
          const best = k === 'supervivencia' ? (Meta.survBest() + 's · ' + I18n.t('st_wave') + ' ' + Meta.survBestWave()) : Meta.modeBest(k);
          const plays = Meta.modePlays(k);
          return `<div class="lb-row"><span class="lb-mode">${MODE_IMG[k] ? iconAnyInline(MODE_IMG[k]) : mo.emoji} ${I18n.modeT(k, 'name')}</span><span class="lb-best">${best}</span><span class="lb-plays">${plays}</span></div>`;
        }).join('');
      }
    }
    // Logros: lista completa (bloqueados incluidos); si no hay ninguno desbloqueado,
    // una guía en la cabecera en vez de una parrilla de candados sin contexto.
    const list = $('#medals-list');
    if (list) {
      const achs = Meta.achievements();
      const noneUnlocked = !achs.some(a => a.unlocked);
      const hint = noneUnlocked ? emptyState('medal', I18n.t('empty_medals_title'), I18n.t('empty_medals_sub'), I18n.t('empty_cta_play'), 'go-play') : '';
      list.innerHTML = hint + achs.map(a =>
        `<div class="medal ${a.unlocked ? 'on' : ''}"><span class="medal-ic">${a.unlocked ? iconInline('medal') : iconInline('lock')}</span><span class="medal-tx"><strong>${a.name}</strong><small>${a.desc}</small></span></div>`
      ).join('');
    }
    Modal.open('modal-medals');
  }

  // Tienda de temas (compra/equipa con monedas; previsualización en vivo)
  function buildShop() {
    const list = $('#shop-list'); if (!list) return;
    Econ.refresh();
    { const co = $('#shop-coins'); if (co) co.textContent = Meta.coins(); }
    // --- Tableros (principal, mockup 5) ---
    const eqB = Meta.equippedBoard();
    const boardsHTML = Boards.order.map((id) => {
      const b = Boards.DEFS[id], owned = Meta.ownsBoard(id), eq = eqB === id;
      // Skins exclusivos (GM-23): no comprables — se GANAN (p. ej. Jardín Zen, 50 flores).
      const btn = eq ? `<button class="btn btn-ghost btn-sm" disabled>${esc(I18n.t('equipped'))}</button>`
        : owned ? `<button class="btn btn-primary btn-sm" data-beq="${id}">${esc(I18n.t('equip'))}</button>`
        : b.exclusive ? `<button class="btn btn-ghost btn-sm" disabled>${esc(I18n.t('board_excl'))}</button>`
        : (b.cost === 0 ? `<button class="btn btn-primary btn-sm" data-beq="${id}">${esc(I18n.t('free'))}</button>`
          : `<button class="btn btn-primary btn-sm" data-bbuy="${id}">${iconInline('coin')} ${b.cost}</button>`);
      return `<div class="board-card${eq ? ' on' : ''}" data-board="${id}">
        <span class="board-thumb" data-board="${id}" aria-hidden="true"></span>
        <span class="board-name">${esc(b.name)}</span>
        <span class="board-chars">${b.chars.map((c) => `<span class="board-char">✦ ${esc(c)}</span>`).join('')}</span>
        ${btn}
      </div>`;
    }).join('');
    // --- Temas de color (secundario, sistema previo) ---
    const curT = Meta.cosmetics().theme;
    const themesHTML = Themes.order.map((id) => {
      const t = Themes.DEFS[id], owned = Meta.owns(id), eq = curT === id;
      const btn = eq ? `<button class="btn btn-ghost btn-sm" disabled>${esc(I18n.t('equipped'))}</button>`
        : owned ? `<button class="btn btn-primary btn-sm" data-equip="${id}">${esc(I18n.t('equip'))}</button>`
        : `<button class="btn btn-primary btn-sm" data-buy="${id}">${iconInline('coin')} ${t.cost}</button>`;
      return `<div class="shop-item${eq ? ' on' : ''}" data-theme="${id}" role="button" tabindex="0"><span class="shop-sw" style="background:${Themes.swatch(id)}"></span><span class="shop-name">${t.name}</span>${btn}</div>`;
    }).join('');
    list.innerHTML =
      `<h3 class="group-title">${esc(I18n.t('shop_boards'))}</h3><div class="board-grid">${boardsHTML}</div>` +
      `<h3 class="group-title">${esc(I18n.t('shop_themes'))}</h3><div class="themes-grid">${themesHTML}</div>`;
    // Compra en dos toques: el primero arma el botón (muestra confirmación con el precio
    // visible), el segundo dentro de 3s compra de verdad. Evita gastos accidentales.
    const armBuy = (b) => {
      if (b.dataset.armed) return true;
      b.dataset.armed = '1';
      b.classList.add('confirming');
      const prev = b.innerHTML;
      b.innerHTML = `${esc(I18n.t('confirm_buy'))} ${prev}`;
      setTimeout(() => { if (b.isConnected && b.dataset.armed) { delete b.dataset.armed; b.classList.remove('confirming'); b.innerHTML = prev; } }, 3000);
      return false;
    };
    // Tableros: comprar / equipar. Son cosmeticos puros.
    list.querySelectorAll('[data-bbuy]').forEach((b) => b.addEventListener('click', () => {
      if (!armBuy(b)) { Sound.ui(); return; }
      const id = b.dataset.bbuy;
      if (Meta.buyBoard(id, Boards.DEFS[id].cost)) { Sound.success(); Meta.equipBoard(id); Boards.apply(); buildShop(); Toasts.show(I18n.t('board_unlocked'), 'good', 1600); }
      else { Sound.miss(); Toasts.show(I18n.t('no_coins'), 'warn', 1600); }
    }));
    list.querySelectorAll('[data-beq]').forEach((b) => b.addEventListener('click', () => {
      Meta.equipBoard(b.dataset.beq); Boards.apply(); Sound.ui(); buildShop();
    }));
    // Temas: preview / comprar / equipar
    list.querySelectorAll('.shop-item').forEach((it) => it.addEventListener('click', () => Cosmetics.previewTheme(it.dataset.theme)));
    list.querySelectorAll('[data-buy]').forEach((b) => b.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!armBuy(b)) { Sound.ui(); return; }
      const id = b.dataset.buy;
      if (Meta.buy(id, Themes.DEFS[id].cost)) { Sound.success(); Meta.equip('theme', id); Cosmetics.apply(); refreshStart(); buildShop(); Toasts.show('¡Tema desbloqueado!', 'good', 1600); }
      else { Sound.miss(); Toasts.show(I18n.t('no_coins'), 'warn', 1600); }
    }));
    list.querySelectorAll('[data-equip]').forEach((b) => b.addEventListener('click', (e) => {
      e.stopPropagation(); Meta.equip('theme', b.dataset.equip); Cosmetics.apply(); Sound.ui(); refreshStart(); buildShop();
    }));
  }
  function openShop() { buildShop(); Modal.open('modal-shop'); }

  // --- Cofres: abrir y entregar recompensa aleatoria ---
  function buildChests() {
    const el = $('#chests-body'); if (!el) return;
    Econ.refresh();
    const n = Meta.chests();
    // Sin cofres: en vez de solo el contador a 0, una guía accionable de cómo ganarlos.
    const guide = n <= 0
      ? emptyState('', I18n.t('empty_chests_title'), I18n.t('empty_chests_sub'), I18n.t('empty_cta_surv'), 'go-surv')
      : `<p class="chest-hint">${I18n.t('chests_hint')}</p>`;
    el.innerHTML = `<div class="chest-big${n > 0 ? ' ready' : ''}">${iconInline('chest')}</div>
      <p class="chest-count">${I18n.t('chests_have').replace('{n}', n)}</p>${guide}`;
    const ob = $('#btn-open-chest'); if (ob) ob.disabled = n <= 0;
    const pb = $('#btn-open-premium');
    if (pb) {
      pb.innerHTML = `💎 ${esc(I18n.t('premium_chest'))} (${Meta.PREMIUM_CHEST_GEMS})`;
      pb.disabled = Meta.gems() < Meta.PREMIUM_CHEST_GEMS;
    }
  }
  function doOpenPremiumChest() {
    const r = Meta.openPremiumChest();
    if (!r) { Sound.miss(); Toasts.show(I18n.t('no_gems'), 'warn', 1600); return; }
    Sound.success(); FX.confetti(140);
    const txt = r.kind === 'coins' ? `🪙 +${r.amount}` : `🎟️ +${r.amount}`;
    Toasts.show(I18n.t('chest_reward').replace('{r}', txt), 'good', 2400, '💎');
    Econ.refresh(); buildChests();
  }
  function openChests() { buildChests(); Modal.open('modal-chests'); }
  function doOpenChest() {
    const r = Meta.openChest();
    if (!r) { Sound.miss(); Toasts.show(I18n.t('chests_none'), 'warn', 1400); return; }
    Sound.success(); FX.confetti(90);
    const txt = r.kind === 'coins' ? `🪙 +${r.amount}` : r.kind === 'gems' ? `💎 +${r.amount}` : `🎟️ +${r.amount}`;
    Toasts.show(I18n.t('chest_reward').replace('{r}', txt), 'good', 2200, '🎁');
    Econ.refresh(); buildChests();
  }

  // Mapa de capítulos de Aventura (nodos hasta el capítulo alcanzado + el siguiente)
  function buildAdventureMap() {
    const wrap = $('#adventure-map'); if (!wrap) return;
    const max = Meta.advMax(), curCh = Adventure.chapterOf(max);
    let html = '';
    for (let ch = 0; ch <= curCh + 1; ch++) {
      const bi = Adventure.BIOMES[ch % Adventure.BIOMES.length];
      const cls = ch < curCh ? 'done' : (ch === curCh ? 'cur' : 'next');
      if (ch > 0) html += '<span class="adv-link"></span>';
      html += `<div class="adv-node ${cls}"><span class="adv-glyph">${BIOME_IMG[bi.id] ? iconAnyInline(BIOME_IMG[bi.id]) : bi.glyph}</span><span class="adv-name">Cap. ${ch + 1}<small>${bi.name}</small></span></div>`;
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
    // Puerta de compatibilidad: la app usa color-mix() sin fallback (ver DESIGN_SYSTEM §9).
    // En navegadores sin soporte (Safari <16.2) los acentos se romperían: mejor avisar y
    // no arrancar que mostrar una UI a medias.
    if (!(window.CSS && window.CSS.supports && window.CSS.supports('color', 'color-mix(in srgb, red 50%, blue)'))) {
      showBrowserWarn();
      return;
    }
    // Inmersión: bloquear zoom por gestos (iOS Safari ignora user-scalable=no a veces).
    document.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });
    document.addEventListener('gesturechange', (e) => e.preventDefault(), { passive: false });
    document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });
    Render.buildBoard();
    FX.init();
    applyReducedFx();
    Perf.init();
    applyLargeText();
    mountTopBars();
    fillArt();
    I18n.apply();
    Cosmetics.apply();
    Boards.apply();
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
    { const cp = $('#coach-play'); if (cp) cp.addEventListener('click', () => { Sound.ensure(); Coach.play1(); }); }
    // "Novedades" al actualizar de versión (no en el primer arranque).
    if (Storage.user && Storage.lastVersion && Storage.lastVersion !== VERSION) {
      setTimeout(() => Toasts.show('✨ Actualizado a v' + VERSION, 'info', 3000), 900);
    }
    Storage.lastVersion = VERSION;

    // Acciones del sistema base (top bar reutilizable + atajos): delegación por data-act.
    document.addEventListener('click', (e) => {
      const el = e.target.closest('[data-act]'); if (!el) return;
      const a = el.dataset.act;
      if (a === 'settings') { Sound.ensure(); openSettings(); }
      else if (a === 'profile') { Sound.ensure(); openMedals(); }
      else if (a === 'edit-name') { e.preventDefault(); e.stopPropagation(); Sound.ui(); renameProfile(); }
      else if (a === 'buy-coins') { Sound.ensure(); openShop(); }
      else if (a === 'bell') { Sound.ui(); Toasts.show(I18n.t('coming_soon'), 'info', 1400); }
      else if (a === 'play') { Sound.ensure(); Screens.show('modes'); }
      else if (a === 'home-classic') { Sound.ui(); Worlds.open(); }
      else if (a === 'home-surv') { Sound.ensure(); openSurvivalDiff(); }
      else if (a === 'home-daily') { Sound.ensure(); Game.startDaily(); }
      else if (a === 'go-surv') { Sound.ensure(); Modal.close(); openSurvivalDiff(); }
      else if (a === 'go-play') { Sound.ensure(); Modal.close(); Screens.show('modes'); }
      else if (a === 'go-daily') { Sound.ensure(); Modal.close(); Game.startDaily(); }
      else if (a === 'go-classic') { Sound.ensure(); Modal.close(); Worlds.open(); }
      else if (a === 'go-adventure') { Sound.ensure(); Modal.close(); openAdventure(); }
      else if (a === 'open-chests') { Sound.ensure(); Modal.close(); openChests(); }
      else if (a === 'open-shop') { Sound.ensure(); Modal.close(); openShop(); }
      else if (a === 'open-missions') { Sound.ui(); refreshStart(); Modal.close(); Modal.open('modal-missions'); }
      else if (a === 'claim-daily') claimDailyReward();
      else if (a === 'nav-medals') { Sound.ensure(); openMedals(); }
      else if (a === 'nav-shop') { Sound.ensure(); openShop(); }
      else if (a === 'nav-missions') { Sound.ui(); Modal.open('modal-missions'); }
      else if (a === 'nav-home') Sound.ui();
    });

    // Inicio (el grueso del cableado vive en el handler delegado data-act de arriba).
    { const bp = $('#btn-play'); if (bp) bp.addEventListener('click', () => { Sound.ensure(); Screens.show('modes'); }); }
    { const rr = $('#btn-resume-run'); if (rr) rr.addEventListener('click', () => { Sound.ensure(); if (!Game.resumeSaved()) { rr.hidden = true; Sound.miss(); } }); }
    { const bi = $('#btn-install'); if (bi) bi.addEventListener('click', () => PWA.promptInstall()); }
    // Al cerrar la tienda, revertir cualquier previsualización al tema equipado.
    { const sc = $('#shop-close'); if (sc) sc.addEventListener('click', () => Cosmetics.apply()); }

    // Modos
    $('#modes-back').addEventListener('click', () => Screens.show('start'));
    { const ms = $('#modes-settings'); if (ms) ms.addEventListener('click', () => { Sound.ui(); openSettings(); }); }
    { const ac = $('#adventure-continue'); if (ac) ac.addEventListener('click', () => { Modal.close(); Game.start('aventura', 'normal'); }); }
    document.querySelectorAll('[data-surv-diff]').forEach((b) => b.addEventListener('click', () => {
      survDiff = b.dataset.survDiff || 'normal';
      Storage.survDiff = survDiff;
      Sound.ui();
      renderSurvivalDiff();
    }));
    { const ss = $('#btn-surv-start'); if (ss) ss.addEventListener('click', () => { Sound.ensure(); startSurvivalSelected(); }); }

    // Modo Clásico (mapa de mundos)
    { const wb = $('#worlds-back'); if (wb) wb.addEventListener('click', () => Screens.show('modes')); }
    { const ws = $('#worlds-settings'); if (ws) ws.addEventListener('click', () => { Sound.ui(); openSettings(); }); }
    { const wr = $('#world-rewards'); if (wr) wr.addEventListener('click', () => Worlds.claimReward()); }
    { const b = $('#wt-shop'); if (b) b.addEventListener('click', () => { Sound.ui(); openShop(); }); }
    { const b = $('#wt-missions'); if (b) b.addEventListener('click', () => { Sound.ui(); Modal.open('modal-missions'); }); }
    { const b = $('#wt-play'); if (b) b.addEventListener('click', () => Sound.ui()); }
    { const b = $('#wt-chests'); if (b) b.addEventListener('click', () => { Sound.ui(); openChests(); }); }
    { const oc = $('#btn-open-chest'); if (oc) oc.addEventListener('click', doOpenChest); }
    { const op = $('#btn-open-premium'); if (op) op.addEventListener('click', doOpenPremiumChest); }
    { const b = $('#wt-rank'); if (b) b.addEventListener('click', () => { Sound.ui(); openMedals(); }); }
    { const lm = $('#btn-level-map'); if (lm) lm.addEventListener('click', () => Game.toWorldsMap()); }
    { const mn = $('#btn-multi-notify'); if (mn) mn.addEventListener('click', () => { Sound.success(); Toasts.show(I18n.t('notify_ok'), 'good', 1800); Modal.close(); }); }

    // Juego
    $('#btn-hint').addEventListener('click', () => Game.hint());
    $('#btn-pause').addEventListener('click', () => Game.pause());
    $('#btn-restart').addEventListener('click', () => Game.restart());
    { // Salir en plena partida: doble toque para evitar abandonos accidentales.
      let quitArm = 0;
      $('#btn-quit').addEventListener('click', () => {
        if (State.status !== 'playing' && State.status !== 'paused') return Game.quit();
        const now = performance.now();
        if (now - quitArm < 2500) { quitArm = 0; Game.quit(); }
        else { quitArm = now; Toasts.show(I18n.t('quit_confirm'), 'warn', 2200); Sound.ui(); }
      });
    }

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

    // Pausar al ocultar la pestaña + snapshot de la partida (reanudable al volver)
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) return;
      if (State.status === 'playing') Game.pause();
      RunSave.save();
    });
    window.addEventListener('pagehide', () => RunSave.save());

    // Enlace de duelo (?challenge=SEED): arranca Contrarreloj con el MISMO tablero
    // que el retador (misma semilla → mismos spawns). Solo si ya hay perfil creado.
    {
      const ch = new URLSearchParams(location.search).get('challenge');
      if (ch && Storage.user) {
        Toasts.show(I18n.t('challenge_start'), 'info', 2200, '🎯');
        Game.start('contrarreloj', 'normal', undefined, ch);
      }
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  // Hook opcional para pruebas/QA (solo con ?dev en la URL). No afecta al juego normal.
  if (location.search.indexOf('dev') !== -1) window.__cv = { State, Engine, Game, Render, Config, FX, Meta, Econ, Settings, Music, Loop, Sound, Tiles, Boosters, Modifiers, Rules, Themes, Cosmetics, Boards, Worlds, Classic, Coach, Adventure, Survival, Share, I18n, Toasts, RNG, RunSave, Picker, PreLevel, Perf, refreshStart, applyLanguage };
})();
