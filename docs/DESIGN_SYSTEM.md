# Sistema de diseño — Convergence

> Extracción exhaustiva de `styles.css` (2258 líneas, CSS plano sin preprocesador) cruzada con `index.html`. Objetivo: que cualquier stack (React, Flutter, Unity UI, SwiftUI, etc.) pueda reproducir el look & feel exacto sin necesidad de ver el CSS original. Todos los valores son verbatim del código fuente.

## 1. Design tokens (CSS Custom Properties)

Definidos en `:root` (bloque 1, líneas 10-44):

```css
--bg-0: #070b1c;   --bg-1: #0a1128;   --bg-2: #101a3e;
--panel: #131e44;  --panel-2: #18244f;
--line: rgba(120,150,255,.18);   --line-strong: rgba(142,177,255,.34);
--text: #eaf0ff;   --muted: #9fb0e0;
--accent: #2f6bff; --accent-2: #00d0ff;
--score: #18e6e6;  --level: #8f7bff;  --time: #ff6cb0;  --speed: #ffe14d;
--good: #34e29b;   --warn: #ffb24d;   --bad: #ff5d73;   --gold: #ffd84d;
--surface-hi: rgba(42,58,124,.96); --surface-mid: rgba(18,29,72,.98); --surface-low: rgba(8,13,34,.42);
--shadow-deep: 0 28px 74px rgba(0,0,0,.62), inset 0 1px 0 rgba(255,255,255,.10);
/* z-index scale */
--z-board:1; --z-popup:5; --z-combo:30; --z-toast:40; --z-overlay:100;
--radius: 16px;
--tap: 44px;     /* tamaño mínimo de toque accesible (Apple HIG) */
--tap-lg: 52px;  /* CTA primario (≥ 48dp Material) */
```

Segundo bloque `:root` ("SISTEMA BASE 2.0", línea ~228) — gradientes por modo:
```css
--card-blue:   linear-gradient(160deg, #20428f, #122152);
--card-green:  linear-gradient(160deg, #1f7a45, #0f3a26);
--card-orange: linear-gradient(160deg, #9a5a22, #543012);
--card-red:    linear-gradient(160deg, #8a2331, #45141d);
--card-purple: linear-gradient(160deg, #4a2a8a, #25134e);
--grad-play:   linear-gradient(180deg, #38bdff, #1f6fe0 58%, #1657c6);
```

Propiedades custom **scoped por componente** (se declaran en el elemento y las heredan sus hijos — funcionan como "tokens locales"):
- `.board-wrap`: `--board-frame`, `--board-pattern`, `--board-pattern-opacity`, `--board-pattern-size`, `--board-bg-animation`, `--board-border`, `--board-trim`, `--board-glow`, `--cell-empty-bg`, `--cell-empty-border`, `--cell-filled-bg`, `--cell-filled-border`, `--cell-hover-bg`, `--clear-animation`, `--clear-burst`, `--clear-burst-animation` — re-definidas por completo por cada skin de tablero (ver §7).
- `.modal`: `--modal-accent` (por defecto `var(--accent-2)`, sobreescrito por id de modal, ver §5).
- `.toast`: `--tc` (por defecto `var(--accent-2)`, sobreescrito por `.info/.good/.warn/.bad`).
- `.mode-hero`/`.mode-card`: `--mode-accent` (inyectado inline por JS, fallback `#00d0ff`/`#1f5be6`).
- `.world-head`/`.wr-item`: `--world-accent`/`--wa` (inyectado por JS, fallback `#3ad07f`).
- `.avatar-dot`: `--av` (inyectado por JS, fallback `#00d0ff`).
- `.screen-game`: `--board-size` (ver §7).

Uso extensivo de `color-mix(in srgb, ...)` como mecanismo de "tinte en runtime" (derivar variantes tintadas de un color de acento sin precalcular cada combinación) — **requiere navegadores con soporte de `color-mix()`** (Safari 16.2+/Chrome 111+/Firefox 113+), sin fallback para navegadores más viejos.

## 2. Paleta de color

**Fondos/neutros:** `#070b1c` (bg-0), `#0a1128` (bg-1), `#101a3e` (bg-2), panel `#131e44`→`#18244f`. El body pinta 3 gradientes radiales "nebulosa" (`rgba(47,107,255,.20)`, `rgba(0,208,255,.16)`, `rgba(143,123,255,.18)`) sobre un radial `bg-2→bg-1→bg-0`. `.stars` son puntos blancos/`#cfe`/`#9bf`/`#bdf` en un tile de 320×320px, opacidad .5.

**Texto:** `--text:#eaf0ff` (primario), `--muted:#9fb0e0` (secundario/labels).

**Marca/acento:** `--accent:#2f6bff` (azul, acción primaria/Clásico), `--accent-2:#00d0ff` (cian, CTA/foco), `--level:#8f7bff` (morado, XP), `--score:#18e6e6` (score HUD), `--time:#ff6cb0` (Contrarreloj), `--speed:#ffe14d`, `--gold:#ffd84d` (moneda/recompensas/estrellas).

**Semántico:** `--good:#34e29b`, `--warn:#ffb24d`, `--bad:#ff5d73`.

**Tarjetas de acceso rápido (home, `.app-card`):** blue `#20428f→#122152`, green `#1f7a45→#0f3a26`, orange `#9a5a22→#543012`, red `#8a2331→#45141d`, purple `#4a2a8a→#25134e`.

**Colores de acento por modo** (inyectados inline por JS como `--mode-accent`): tutorial `#ffd23f` · clasico `#2f6bff` · aventura `#7a5cff` · contrarreloj `#ff6cb0` · supervivencia `#ff5b6e` · zen `#9be15d`.

**Colores de acento por mundo (Clásico, `--world-accent`):** Bosque Verde `#3ad07f` · Desierto Dorado `#ffb24d` · Montaña Helada `#7ad7ff` · Cueva Misteriosa `#a06bff` · Ciudad Neón `#ff5cf0`.

**Colores de acento por bioma (Aventura):** Nebulosa `#7a5cff` · Cinturón de Asteroides `#ff9838` · Campo de Hielo `#2bd4e6` · Núcleo Ardiente `#ff5b6e` · El Vacío `#a06bff` · Cristalia `#19f0d0`.

**Economía (pills):** coins borde `rgba(255,216,77,.40)` / glow `rgba(255,216,77,.10)` · gems borde `rgba(0,208,255,.42)` / glow `rgba(0,208,255,.12)` · tickets borde `rgba(160,107,255,.42)` / glow `rgba(160,107,255,.12)`.

**Skins de tablero** (9, ver tabla completa en §7): classic (azul), madera/wood, hielo/ice, lava, cristal/crystal, magico/magic, futurista, dorado/gold, bosque/forest, cosmico/cosmic.

**Anillo de combo por nivel:** base `--gold`, `.lv2 #00d0ff`, `.lv3 #b46cff`, `.lv4 #ff5cf0`.

**Tiles especiales:** bonus `--good`, portal `--accent-2`, magicbox `--gold`, bomb `--bad`, slowdown `#00e5cc`; frozen azul hielo `rgba(140,220,255,…)`/`#c8f4ff`; rock `#2b3144`/`#1d2335` (SVG de cadenas `#0d1224`/`#c2cbe0`); locked `#2a2f3c`; chains `#c2cbe0`; web `#dce6f5`; barrier rayado `#2a2f3c`/`#3a4150` con icono `#ffb24d`; mud `#c0844f`; infected `#78e678`.

**Multijugador (placeholder):** player1 `#4b8bff`, player2 `#ff5b6e`.

## 3. Tipografía

- Stack: `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` — **sin webfonts propias, sin `@font-face`**, 100% fuentes del sistema.
- Sin `font-size` base explícito en `html`/`body` (16px por defecto del navegador).
- Escala tipográfica (selección representativa, usa `clamp()` fluido en casi todos los casos):
  - Logo: `clamp(2rem, 8vw, 3rem)` / home hero `clamp(2.2rem, 11vw, 3.4rem)`, peso 800.
  - Títulos de sección (`#modes-title`, `.worlds-title`): `clamp(1.3-1.4rem, 5.3-5.5vw, 1.75-1.9rem)`, peso 800.
  - Score HUD (`.gscore .hud-value`): `clamp(1.4rem, 7vw, 2.4rem)`, peso 900.
  - Stats de modal: `clamp(1.1rem, 4.5vw, 1.4rem)`; "hero stat" (score): `clamp(2rem, 9vw, 2.8rem)`.
  - Glyph de celda (fallback texto): `clamp(0.9rem, 5.2vmin, 2rem)`.
  - Popup flotante: `clamp(1rem, 4.4vmin, 1.6rem)`.
  - Texto de "rank" de combo: `clamp(1.5rem, 7vmin, 2.6rem)`.
  - Meta/labels pequeños: entre `.52rem` y `.98rem`.
- Pesos usados: 400, 500, 600, 700, 800 (el más común — headings, botones, valores de stats), 900 (CTA hero, score, combo, cifras destacadas).
- `font-variant-numeric: tabular-nums` en todos los valores numéricos de HUD/score/XP/stats (ancho de dígito estable, evita "saltos" al cambiar el número).
- Técnica de "texto en gradiente" (`background: linear-gradient(...); background-clip: text; color: transparent;`) en `.logo`, `#modes-title`, `.worlds-title`.

## 4. Sistema de layout

**App shell:** `html, body { height:100% }`; `body` usa cadena de fallback `min-height: 100vh; min-height: 100dvh; min-height: -webkit-fill-available;`, `overflow:hidden`, `overscroll-behavior:none`, `touch-action:manipulation`. `#app`: `height:100vh/100dvh`, `overflow:hidden`.

**Sistema de pantallas:** cada pantalla es `<section class="screen" id="screen-...">`; visibilidad vía atributo nativo `hidden`, reforzado globalmente con `[hidden]{display:none!important}`. `.screen` base: `position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;` + padding con `env(safe-area-inset-*)`, animación de entrada `screen-in .25s ease both` (fade + slide desde abajo). **No hay animación de salida** — el cambio de pantalla es instantáneo al alternar `hidden`. Variantes (`.screen.home`, `.screen-modes`, `.screen-worlds`, `.screen-game`) sobreescriben el `justify-content`/`align-items`, y `.screen-game` cambia a CSS Grid (ver §7).

**Uso de grid:** `.appbar` (grid 2 columnas "profile econ"), `.home-cards`/`.mode-grid`/`.world-map`/`.board-grid`/`.stats`/`.surv-diff-pick` (grid), `.screen-game` (grid 3 filas `3fr auto 2fr`), `.worlds-body` en ≥720px (`1fr 250px`).

**Breakpoints (mobile-first):**
- `max-width:460px` / `max-width:380px` — compactación progresiva de appbar/avatar/modal.
- `max-width:719px` — breakpoint "teléfono" general (tamaño de board, HUD compacto), con sub-breakpoints por `max-height` (760px, 680px).
- `min-width:720px` — "tablet/escritorio": layout de 2 columnas en mundos, tablero fijo más grande.
- `min-width:720px and max-width:900px` — lienzo 2:3 específico de Inicio para reproducir 854×1280 sin heredar las cotas de 1024×1536.
- `min-width:720px and max-height:760px` — modo compacto de selección de modo en escritorio.
- `min-height:900px and max-width:719px` — teléfonos altos → tablero más grande.
- `hover:hover` — gatea `:hover` en celdas para no dejar estados "pegados" en touch.
- `prefers-reduced-motion:reduce` — interruptor global de animaciones (ver §10).

**Safe areas:** `max(Npx, env(safe-area-inset-top/bottom))` usado en `.screen`, `.overlay`, `.coach`, `.home-tabs`, `.bottom-nav`, `.worlds-tabs`, FAB de pista, y en el `max-height` calculado de `.modal`.

**Unidades de viewport:** uso intensivo de `vw/vh/svh/dvh/vmin` para tamaños fluidos; patrón consistente "declarar con `vh`, luego sobreescribir con `dvh`/`svh`" para evitar saltos de layout cuando la barra de navegador móvil aparece/desaparece.

## 5. Inventario de componentes

- **`.btn`** (botón base, estilo "arcade chunky"): `min-height:44px`, `border-radius:16px`, sombra 3D tipo "labio" (`0 4px 0 rgba(0,0,0,.45), 0 8px 14px rgba(0,0,0,.35)`), `:active` → `translateY(3px)` + colapso de sombra (efecto de "botón presionado"), `:disabled` → opacidad .45.
  - `.btn-primary`: gradiente azul `#3d7bff→#1f5be6`, brillo superior vía `::after`.
  - `.btn-ghost`: translúcido blanco.
  - `.btn-lg`/`.btn-sm`: variantes de tamaño (font 1.15rem/.88rem).
  - `.btn-icon`/`.btn-ic`: fila flex icono+label.
  - `#btn-play` (CTA home): botón héroe central azul/cian con doble aro neón, relieve 3D y triángulo blanco; `homePlayGlow` se limita a 2 ciclos y se elimina con movimiento reducido.
  - `.btn-hero`: variante ancha dentro de modal/home, gradiente `--grad-play`.
  - `.btn-reward`: CTA de recompensa diaria, gradiente dorado, `animation: rewardPulse 1.8s infinite`.
- **`.icon-btn`** — cuadrado 44×44, esquinas redondeadas (o circular en `.controls`), hover ilumina, active `scale(.94)`.
- **`.modal`** — layout flex columna (header fijo / body scrollable / footer fijo), `max-height: min(90dvh, calc(100dvh - insets - 24px))`, ancho `min(456px,100%)`, radio 22px, barra de acento superior vía `::before` coloreada por `--modal-accent`, animación de entrada `modal-in .26s cubic-bezier(.2,.9,.3,1.2)`. Cada modal define su propio `--modal-accent` (how=good, pause/adventure=level, settings=accent-2, missions/shop=gold, revive/surv-diff=bad, medals=good).
- **`.appbar`** — grid reutilizado en home/modos/mundos: avatar circular con glow cian, barra de XP, pills de economía.
- **`.bottom-nav`/`.worlds-tabs`** — barras de tabs ancladas abajo con safe-area; en Inicio hay cinco destinos globales (`Logros`, `Tienda`, `Inicio`, `Guía`, `Ajustes`) y el item central se eleva como un FAB circular cian.
- **`.board`/`.board-wrap`** — ver §7.
- **`.toasts`/`.toast`** — columna anclada encima del tablero, crece hacia arriba; acento `--tc` por tipo (info/good/warn/bad).
- **`.combo`** — anillo SVG de progreso + texto de multiplicador + contador, 4 tiers de color escalonados.
- **`.surv-bar`** — HUD de Supervivencia: vidas (emoji), nombre de oleada + badge de tier, barra de progreso de oleada, mejor oleada, tiempo transcurrido.
- **`.booster-bar`** — bandeja inferior de potenciadores: medidor de carga, medidor de frenesí (gradiente naranja→rojo→morado), fila de botones `.booster` (58×56, icono + contador).
- **`.app-card`** — tarjetas arcade de acceso rápido del home, con borde saturado, relieve 3D y gradiente por variante. La home prioriza Clásico, Torneos/Reto diario y Multijugador (este último comunica `Próximamente`; no simula matchmaking).
- **`.home-context`** — muestra una partida recuperable cuando existe `RunSave`; en su ausencia muestra la mejor puntuación. Los dos estados son mutuamente excluyentes.
- **`.home-today`/`.today-grid`** — banda contextual de cinco accesos: Misiones, Diario, Cofres, Liga y Amigos. Usa cinco columnas `minmax(0,1fr)` y conserva texto además de color para comunicar estado.
- **`.diff-chip`** — pills de selección de dificultad, estado `[aria-checked="true"]` con borde/fondo verde.
- **`.econ-pill`** — chip de moneda, borde/glow por tipo de divisa.
- **`.level-chip`/`.record-chip`** — pill de nivel/mejor puntuación, variante "record" con brillo radial dorado.

### Contrato visual de Inicio

Inicio define tokens locales para no contaminar las superficies de juego:
`--home-cyan:#05c8ff`, `--home-blue:#0867ed`, `--home-violet:#8529ff` y
`--home-ink:#020b2a`. Sus superficies siguen cuatro reglas:

1. Fondo azul noche con nebulosas y estrellas decorativas no interactivas.
2. Borde luminoso + labio oscuro de 4–8 px para comunicar pulsabilidad.
3. Jerarquía por saturación: CTA azul, Clásico azul, Torneos verde y
   Multijugador naranja; estados siguen usando texto y `aria-label`.
4. Dos bandas de navegación: una contextual dentro del scroll y una global
   anclada al safe area. En viewports bajos el contenido central desplaza; la
   cabecera y la navegación global permanecen accesibles.

Las ilustraciones protagonistas de Inicio son PNG originales con alfa bajo
`img/ui-generated/home/`. Comparten render 3D casual, materiales brillantes,
volúmenes redondeados y luz de borde cian/violeta. El conjunto incluye avatar,
recompensa, cohete, tarjetas de modo y los diez destinos de las dos bandas de
navegación. El pack compacto `img/ui-v2/home/` queda reservado a microiconos de
economía y estado. La captura de referencia nunca se usa como sprite ni como
fuente de recortes en producción.
- **`.world-map`** (grid de nodos `.lvl-node`, estilo pill 3D, estado `.locked`/`.current` con pulso) / **`.world-rail`** (lista vertical de mundos).
- **`.shop-list`/`.shop-item`** — fila con swatch de previsualización, nombre, botón comprar/equipar; `.board-grid`/`.board-card` variante enriquecida con preview real del skin (reutiliza las custom properties del tablero).
- **`.chests-body`** — icono grande de cofre con `chestWobble` cuando hay cofres listos, `chestOpen` one-shot al abrir y tarjeta persistente `.chest-reveal` para mostrar la recompensa. `.chest-reveal.rarity-common|jackpot|cosmetic` cambia tinte/borde; cosméticos muestran acción `Equipar`. Con `body.reduced-fx`, se quitan wobble/open/pop, pero la tarjeta queda igual porque es información.
- **`.mode-hero`/`.mode-card`** — tarjetas de selección de modo, glow radial por `--mode-accent`, check en `[aria-checked="true"]`, estado `.mode-disabled`.
- Otros: `.switch` (toggle accesible), `.field input`, `.avatar-pick`/`.avatar-dot`, `.lang-pick`/`.lang-btn`, `.medal`, `.lb-row` (leaderboard), `.multi-vs`, `.adv-node`, `.stat`/`.stats`.

## 6. Animaciones (`@keyframes`)

El archivo define **~50 animaciones**. Las agrupamos por propósito (nombres exactos entre paréntesis para buscarlas en el CSS original):

- **Transiciones de pantalla/UI genérica:** entrada de pantalla (`screen-in`), pulso de CTA home (`ctaPulse`), pulso de recompensa (`rewardPulse`), aparición de modal (`modal-in`), entrada/salida/pop de toast (`toast-in`, `toast-out`, `toast-pop`), aparición de chip de icono (`chipPop`), "bump" de valor numérico (`bump`), spin decorativo del logo (`heroSpin`).
- **Progresión/mapas:** pulso de nodo de nivel actual (`nodepulse`), estrellas apareciendo (`starpop`), estrella perdida (`starShake`), wobble de cofre listo (`chestWobble`), apertura one-shot de cofre (`chestOpen`) y pop de tarjeta de recompensa (`rewardPop`).
- **Ciclo de vida de icono en tablero:** aparición (`glyph-in`), eliminación genérica (`glyph-out` + burst `clear-ring`) y **9 variantes temáticas por skin de tablero** (`clear-wood`, `clear-ice`, `clear-lava`, `clear-crystal`, `clear-magic`, `clear-future`, `clear-gold`, `clear-leaf`, `clear-cosmic`, cada una con su burst a juego: `clear-dust`, `clear-shards`, `clear-magma`, `clear-prism`, `clear-rune`, `clear-scan`, `clear-gold-spark`, `clear-leaf-burst`, `clear-star-burst`).
- **Feedback de error/refuerzo en celda:** shake de fallo (`miss`), pop de penalización (`penalty-pop`), shake de tablero (`board-shake`), impacto/rotura de hielo (`ice-hit`, `ice-shatter`).
- **Ambiente de fondo del tablero por skin** (drift continuo detrás del grid): `board-drift`, `board-wood`, `board-ice`, `board-lava`, `board-prism`, `board-runes`, `board-scan`, `board-gold`, `board-leaf`, `board-stars` (una por cada uno de los 9 skins + genérico).
- **Eventos de Supervivencia** (glow/shake en `.board-wrap`): terremoto (`surv-quake` + `surv-quake-settle`), lluvia de meteoros (`surv-rain`), penalización por vida perdida (`surv-penalty`), nueva oleada (`surv-wave-up`), congelación (`frost-field`), vida extra (`life-blast`), tablero limpiado bonus (`board-clear-bonus`), pulso de frenesí activo (`surv-frenzy-pulse`), caída de meteorito en celda (`surv-meteor`).
- **Boosters (Supervivencia):** activación de cada booster (`bomb-board`, `line-board`, `x2-board`, `wild-board`), botón de booster disparado (`booster-fired`), booster "armado" esperando objetivo (`armPulse`), burst de limpieza especial por tipo (`special-clear`), pulso de atención en tiles especiales (`special-pulse`), bob del icono de ralentización (`slowdown-bob`).
- **Combo/puntuación:** popup flotante de puntos por WAAPI (`Render.popup`, sin `@keyframes` CSS), pulso de combo (`combo-pulse`), callout de "rank" (`rankPop`, ej. "¡GENIAL!"/"¡ÉPICO!"), flash de pantalla completa por récord/tablero perfecto (`flashAnim`), borde de peligro por ocupación alta (`dangerBorder`), pulso de aura Fever (`feverPulse`).
- **Tutorial:** aparición del texto de coach-mark (`coach-in`).

Todas las animaciones "ambientales"/decorativas (drift de fondo, pulsos idle, spin del logo) se desactivan cuando el usuario activa el ajuste propio `reduced-fx` (ver §10) — es un mecanismo más granular que el `prefers-reduced-motion` del SO.

El feedback de convergencia es un contrato visual de juego: con `reduced-fx` desactivado, `FX.converge` y `FX.scoreToHud` no se degradan por el gobernador de rendimiento ni por el `FX.cap` móvil; usan un backstop absoluto común (`FX.ABS_MAX`) para mantener paridad móvil/PC. `reduced-fx` sí puede ocultar partículas/vuelos por ser una elección explícita de accesibilidad o heredada del sistema, en cuyo caso la app muestra un aviso una sola vez.

Las partículas, vuelos de glyph y popups creados con WAAPI se cancelan al terminar después de fijar `opacity:0`; no deben quedar animaciones con `fill:forwards/both` retenidas en `document.getAnimations()`, porque mantienen capas de compositor vivas sin aportar feedback visual.

## 7. Tablero: enfoque de renderizado

- El tamaño del tablero se controla con una única custom property `--board-size` en `.screen-game`, calculada con cadenas de `min()` combinando `vw`/`svh`/px, con overrides por breakpoint (móvil, escritorio ≥720px, teléfonos altos ≥900px de alto).
- `.screen-game` es `display:grid; grid-template-rows: 3fr auto 2fr;` — 3 bandas verticales: HUD arriba, área de tablero (auto-ajustada al tamaño intrínseco del tablero) en medio, bandeja de boosters abajo. Esto fija la posición vertical del tablero sin importar cuánto "chrome" añada cada modo (barra de supervivencia, banner de objetivo, bandeja de boosters).
- `.board-wrap` es un cuadrado fijo (`width/height: var(--board-size)`) con marco decorativo (`::before` patrón animado, `::after` borde interior), `overflow:hidden; contain: layout paint;`.
- `.board` es CSS Grid: `grid-template-columns/rows: repeat(var(--size,8), minmax(0,1fr)); gap: min(5px, 1.2vmin);` — `--size` es una custom property (por defecto 8, configurable por nivel).
- Cada `.cell` es un ítem de grid con `min-width:0;min-height:0` (evita "blowout" del grid), radio 11px, `contain: layout style paint`.
- **Ciclo de vida animado de un icono:** aparición (`glyph-in`, scale 0.2→1 + fade), eliminación (`clear-animation` + burst `clear-burst-animation`, ambos tokens intercambiados según el skin activo), fallo (`miss`, shake horizontal), penalización (`penalty-pop`). **No hay animación de "deslizamiento"** — los iconos se re-renderizan instantáneamente por celda (decisión deliberada de rendimiento, documentada en comentarios del CSS: evitar transiciones de `background-color` que disparen repaints masivos durante cascadas de eliminación).
- **Skins de tablero** (`data-board="classic|madera|hielo|lava|cristal|magico|futurista|dorado|bosque|cosmico"` en `.board-wrap`): cada skin redefine el set completo de tokens (`--board-frame`, `--board-pattern`, `--board-bg-animation`, `--board-border`, `--board-trim`, `--board-glow`, `--cell-empty-bg/-border`, `--cell-filled-bg/-border`, `--cell-hover-bg`, `--clear-animation`, `--clear-burst`/`--clear-burst-animation`) — cambiar un único atributo `data-board` re-skinea patrón de fondo, animación ambiental, colores de celda y efecto de eliminación simultáneamente. Reutilizado en `.board-thumb[data-board=...]` para las previsualizaciones de la tienda.

**Decisiones de rendimiento documentadas explícitamente en comentarios del CSS** (relevantes para cualquier reimplementación, especialmente en engines con costo de repaint alto): evitar `backdrop-filter` por completo; pintar `--bg-0` sólido a nivel de `html` como red de seguridad bajo el gradiente decorativo (bug conocido de WebKit que puede dejar caer la capa pintada bajo combos rápidos); no animar `background-color` en `.cell`; pulsos ambientales animan solo `opacity`/`border-color`/`filter`/`transform` (compositor-only, nunca `box-shadow` seguido en loop); `contain: layout paint` en el tablero y `contain: layout style paint` en celdas.

## 8. Sistema de iconografía

Tres tecnologías de icono en paralelo:

1. **Pack PNG legacy** (`img/ui/*.png`, ~55 iconos planos). Clases: `.ic` (llena el 100%/100% de su contenedor, ej. avatar 44×44, icono de settings 22×22) y `.ic-inline` (1em/1em, `vertical-align:-0.16em`, para uso dentro de texto).
2. **Pack SVG v2** (`img/icons-v2/`, 12 carpetas de categoría, ~815 archivos). Consumido vía **CSS mask** con una custom property inline `--icv2-url` (ej. `style="--icv2-url:url('img/icons-v2/9-media/play.svg')"`): `.icv2 { background-color: currentColor; mask: var(--icv2-url) center/contain no-repeat; }` — el color del icono lo controla `color`/`currentColor`, permitiendo tintar el mismo SVG en distintos contextos sin variantes de archivo. `.icv2-inline` es el equivalente inline de `.ic-inline`. `game.js` expone un helper `iconV2(name, cls)` que genera este markup programáticamente.
3. **SVG inline** (`.mc-art svg`, `.appbar svg`) para arte de tarjetas de modo y decoraciones del appbar, con `filter: drop-shadow(...)`.
4. **Pack reservado/sin uso:** `img/ui-system/` (sprites de botones/checkboxes/ventanas/scrollbar con estados hover/pressed) — precacheado por `sw.js` pero **no referenciado en absoluto por `styles.css`** ni presente en el repo; los componentes actuales (botones, modales, toggles) están hechos enteramente con gradientes/box-shadows CSS, no con sprites.

**Convención de tamaño:** contenedor-lleno (`.ic`/`.icv2`, 100%/100%, el padre define la caja) vs. inline-en-texto (`.ic-inline`/`.icv2-inline`, 1em/1em con corrección de baseline `vertical-align:-0.16em`).

## 9. Responsive / adaptativo

- Sin container queries (`@container`) — toda la adaptabilidad es por media query de viewport.
- `clamp()` usado extensivamente para tipografía y espaciado fluido (decenas de instancias).
- Sin `prefers-color-scheme` — **tema único fijo oscuro** (`theme-color` en `index.html` coincide con `--bg-1`).
- `color-mix(in srgb, ...)` como mecanismo principal de "tinte adaptativo" (variantes de acento derivadas en runtime) — dependencia dura de navegadores modernos, sin fallback.

## 10. Accesibilidad reflejada en CSS

- `.sr-only` — patrón estándar visualmente-oculto-pero-accesible, usado en `#sr-status` (`role="status" aria-live="polite"`).
- `:focus-visible` en inputs, celdas del tablero (`outline: 3px solid var(--accent-2)`), y tarjetas de modo.
- `prefers-reduced-motion: reduce` — override global: fuerza `animation-duration/transition-duration: .01ms !important`, oculta `.stars`.
- **`body.reduced-fx`** — ajuste propio de la app (controlado desde Ajustes y heredado por defecto de `prefers-reduced-motion` si el usuario no guardó valor): desactiva animaciones caras específicas (partículas, vuelos de convergencia, fever, flash, pulso de peligro, eventos de tablero de Supervivencia, spin decorativo, drift de fondo del tablero, pulso de CTA/recompensa, entrada de toast/coach). Si queda activo solo por el ajuste del sistema, se informa una vez y puede revertirse desde Ajustes.
- Tokens de tamaño de toque `--tap`/`--tap-lg` aplicados a botones/inputs; `touch-action: manipulation` amplio para suprimir zoom por doble-tap.
- Estilos dirigidos por atributos ARIA: `[aria-checked="true"]` (toggles, tarjetas de modo, chips de dificultad), `[aria-current="page"]` (tabs activos).
- No hay manejo explícito de `prefers-contrast`.

## 11. Misceláneos

- Scrollbar: `scrollbar-width: thin; scrollbar-color: color-mix(...)` (Firefox) en `.modal-body`; en WebKit se usa `-webkit-overflow-scrolling: touch` para scroll con momentum en vez de una scrollbar custom.
- Prefijos `-webkit-` usados: `-webkit-fill-available`, `-webkit-tap-highlight-color:transparent`, `-webkit-text-size-adjust:100%`, `-webkit-overflow-scrolling:touch`, `-webkit-background-clip:text` (texto en gradiente), `-webkit-mask` (junto al `mask` sin prefijo), `-webkit-line-clamp`/`-webkit-box-orient` (truncado multilinea), `-webkit-user-select:none` en celdas.
- `100dvh`/`100svh` declarados siempre como fallback-chain junto a `100vh`/`vw`, para evitar saltos de layout con la barra de navegador móvil.
- `env(safe-area-inset-*)` con `max()` en toda la UI para notch/home-indicator.
- Sin `@media print` (no aplica a una PWA de juego fullscreen).
- Sin fallbacks `@supports` — features modernas (`color-mix()`, `dvh`/`svh`) se usan sin condicionar soporte, salvo el propio patrón "declarar vh, override con dvh/svh".
- Un único uso de SVG-como-data-URI inline en CSS: el patrón de remaches/cadenas de `.tile-rock::after` (todo lo demás usa `url()` a archivos externos).
- Versionado: `index.html` invalida caché de assets vía query strings (`styles.css?v=vNNN`, `game.js?v=vNNN`), independiente del contenido real del CSS/JS.
