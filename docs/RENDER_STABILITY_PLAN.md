# Estabilidad de render y 60 FPS en todos los dispositivos: análisis y plan

> **Rol:** documento vivo derivado de fallos **graves** reportados en **Xiaomi Mi Pad 7** (tablet
> Android de pantalla ~3.2K, `devicePixelRatio` alto): jugando y navegando por menús **hay imágenes
> que cargan a medias**; con mucho movimiento en el tablero **el fondo glitchea y las fichas
> parpadean a NEGRO PURO**. Objetivo pedido: **60 FPS estables en todos los dispositivos bajo alta
> carga, sin eliminar ninguna animación**.
>
> Tercer documento de la familia de rendimiento, y el de raíz más profunda:
> - [`QA_PERF_PLAN.md`](./QA_PERF_PLAN.md) §3 — FPS del **gameplay** (coste de CPU/paint). QP-*.
> - [`ANIMATION_PERF_PLAN.md`](./ANIMATION_PERF_PLAN.md) — **acumulación de nodos** en menús/tienda. AP-*.
> - **Este** — **presupuesto de capas del compositor y memoria de GPU** (el parpadeo a negro). RS-*.
>
> Tareas con prefijo **RS-\*** (Render Stability). Cada afirmación va anclada a `archivo:línea`.

---

## 1. El síntoma clave y su causa raíz

**"Fichas parpadeando a negro puro" = desalojo de backing stores del compositor por presión de
memoria de GPU.** Cuando el número y tamaño de las **capas compuestas** (composited layers) supera
el presupuesto de memoria de texturas del proceso de GPU, Chromium/Android **descarta** tiles de
capa y las pinta de **negro** hasta que puede re-rasterizarlas. Es exactamente el mismo fallo que
este código **ya combatió en iOS/WebKit**, donde se manifiesta en **blanco** (de ahí los comentarios
"evita el blanco por compositing de WebKit", `styles.css:2062`, y el rechazo histórico al canvas).

Diferencia de plataforma → mismo bug:
| | iOS/WebKit | Android/Chromium |
|---|---|---|
| Capa sin backing store | flash **blanco** | flash **NEGRO** |
| Defensa existente | sin canvas, `will-change` transitorio, pool de partículas | — (no adaptada a la densidad Android) |

En la Mi Pad 7 el presupuesto es **más ajustado** que en un iPhone porque (a) la resolución es
altísima (cada capa a pantalla completa pesa decenas de MB), y (b) hemos **sumado capas persistentes**
nuevas. Cuando además re-rasterizamos una textura enorme por frame (filtro sobre todo el tablero),
el pico tira el presupuesto → negro.

**"Imágenes que cargan a medias"** es el mismo problema de memoria por otra cara: bajo presión, el
navegador **desaloja bitmaps decodificados** y los vuelve a decodificar progresivamente; y como las
`<img>` de menús **no** declaran `decoding="async"` ni dimensiones, decodifican en el hilo principal
al pintar. Liberar memoria de capas y sanear la decodificación ataca ambas caras.

---

## 2. Inventario de capas del compositor (dónde se va el presupuesto)

Contadas en `styles.css`: **62** usos de propiedades que promueven/encarecen capas (`will-change`,
`mix-blend-mode`, `backdrop-filter`, `isolation`, `backface-visibility`, `contain`).

**Capas PERSISTENTES sobre el tablero (siempre vivas durante el juego):**
1. `.board-wrap` — `contain: layout paint` + descendientes animados → capa de tablero completo (`styles.css:1088`).
2. `.board-wrap::before` — patrón con **`mix-blend-mode: screen`** + animación `infinite` (`board-drift`…): fuerza render de grupo aislado + readback, **siempre** (`styles.css:1118-1128`). Full-board.
3. `.board-wrap::after` — trim/borde interior (`styles.css:1130`). Full-board.
4. `.converge-layer` — `inset:0`, capa de coreografía (`styles.css:2071`). Full-board.

**Picos TRANSITORIOS que multiplican capas bajo carga:**
5. `.board-wrap.fever-burst` — **anima `filter: saturate/brightness` sobre TODO el tablero** cada frame (`styles.css:2110-2117`). Re-rasteriza una textura full-board a `dpr×` por frame: el disparador nº1 del parpadeo.
6. Pulsos de celda concurrentes: `special-pulse`, `cellPulse` (bomb/line/wild-cleared), `ice-hit`, `glyph-out`… En una cascada grande, **decenas** de celdas promueven a capa a la vez.
7. `.converge-tile`/`trail`/`particle` — 3 grupos preasignados (acotado, bien).

**Capas FULL-SCREEN fijas:**
8. `.fx` (z80), `.flash` (z90), `.rank`, y **`.shop-fx` (z82)** — esta última con **`will-change`
   permanente en 100 nodos del pool** (`styles.css:11389`), introducida en v2.19.0: una **regresión**
   respecto a `.fxp`, que evita a propósito el `will-change` permanente (`styles.css:2065-2068`).

**Skins de tablero:** `.board-wrap[data-board]::before` anima transform `infinite`; la futurista se
sobredimensiona a `inset:-34px` (`styles.css:1478`) → textura full-board+ extra, siempre.

---

## 3. Por qué "debería ir a 60 y no va" — el modelo mental correcto

No es falta de GPU bruta: la Mi Pad 7 mueve capas de sobra. El cuello es **cuántas capas y de qué
tamaño** hay que mantener en memoria a la vez, y **cuánta re-rasterización** pedimos por frame:
- Cada `mix-blend-mode`/`filter` animado obliga a **re-pintar** (no solo recomponer) una textura.
- Cada `will-change` permanente y cada celda que promueve **reserva** un backing store.
- A `dpr` alto, esas texturas son enormes → el presupuesto se agota → **eviction → negro** + jank.

**Meta realista:** el parpadeo a negro y las imágenes a medias son **bugs de memoria**, no "FPS
bajos" inevitables: se pueden **eliminar** en cualquier dispositivo razonable recortando memoria de
capas. Sostener 60 bajo carga es alcanzable en gama media-alta (Mi Pad 7, iPhone 12+) una vez que
**dejamos de reventar el presupuesto de GPU**. En gama muy baja el gobernador degrada por capas
(nunca pierde el feedback de jugada). Nada de esto elimina animaciones: cambia **cómo** se componen.

---

## 4. Plan de tareas (RS-\*) — orden = prioridad

| # | Tarea | Prio | Estado |
|---|---|---|---|
| RS-1 | **Quitar el `filter` animado sobre todo el tablero** (fever-burst/fever-out → transform-only; el "espectáculo" se conserva con el zoom + aura) | P0 | ✅ **Hecho v2.26.0** |
| RS-2 | **Eliminar `mix-blend-mode: screen` del `.board-wrap::before`** (a composición normal; sobre fondo oscuro es visualmente idéntico y ahorra el render de grupo aislado) | P0 | ✅ **Hecho v2.26.0** |
| RS-3 | **`will-change` disciplinado** en `.shop-fx` (quitar el permanente de los 100 nodos del pool; promoción transitoria como `.fxp`) — corrige la regresión de v2.19.0 | P0 | ✅ **Hecho v2.26.0** |
| RS-5 | **Higiene de decodificación de imágenes**: `decoding="async"` en el helper `icon()`/`<img>` generados y en las 77 `<img>` de `index.html` | P1 | ✅ **Hecho v2.26.0** (dimensiones/aspect-ratio: pendiente RS-6) |
| RS-7 | **Gobernador consciente del dispositivo**: arranque conservador en táctil `dpr≥2` o `deviceMemory≤4`, no solo iOS `dpr≥3` | P1 | ✅ **Hecho v2.26.0** |
| RS-4 | **Presupuesto de capas de celda**: acotar/coalescer pulsos de celda concurrentes en cascadas grandes (integrado con el gobernador `perf-1/2`) | P1 | ✅ **Hecho v2.27.0** |
| RS-10 | **Reflujo síncrono por celda en el spawn masivo** (`spawnAnim` → WAAPI): eliminar el `void offsetWidth` que causaba layout thrashing al aparecer muchos iconos de golpe (refill tras vaciar el tablero) — pérdida de frames en iOS | P0 | ✅ **Hecho v2.28.0** |
| RS-6 | **Reducir tamaño de capas**: acotar el pseudo sobredimensionado de skins, dimensiones explícitas en imágenes y confirmar que las capas FX full-screen no promueven hijos de más | P2 | ⬜ |
| RS-8 | **Evaluar canvas único para partículas** (1 capa en vez de ~140) detrás de bandera, midiendo el regreso del bug blanco/negro; NO cambio a ciegas | P2 | ⬜ |
| RS-9 | **Instrumentación multi-dispositivo**: `perf-probe` emulando Android hi-dpi + recuento de capas compuestas con presupuesto; validación real en Mi Pad 7 (chrome://inspect → Layers) | P2 | ⬜ (requiere navegador/dispositivo) |

**Invariante (igual que AP-*):** *no se elimina ninguna animación.* Se conservan estética, duración y
coreografía; solo cambia la fontanería de composición (propiedad animada barata, menos capas
persistentes, menor tamaño de textura, decodificación asíncrona).

---

## 5. Bitácora de implementación

### v2.26.0 — primera ola: eliminar los disparadores del parpadeo a negro (RS-1/2/3/5/7)

Cambios en `styles.css` (compositing del tablero + pool de tienda), `game.js` (helper de iconos,
gobernador) e `index.html` (imágenes). Bump 2.25.0 → 2.26.0. **Ninguna animación eliminada.**

- **RS-1 · Fiebre sin `filter` full-board.** `@keyframes fever-burst`/`fever-out` pasan a **solo
  `transform: scale`** (`styles.css`, ~§Capa FX). Antes animaban `filter: saturate/brightness` sobre
  todo `.board-wrap`: cada frame re-rasterizaba una textura de tablero completo a `dpr×`; en la Mi Pad 7
  ese pico agotaba la memoria de GPU y disparaba el parpadeo a negro. El zoom conserva el golpe visual;
  el "calor" lo aporta el aura `.fever` (que sigue pulsando por opacidad).
- **RS-2 · Patrón del tablero sin `mix-blend-mode`.** `.board-wrap::before` deja de usar `screen`
  (`styles.css:1118`). El blend obligaba a renderizar un grupo aislado del tablero y hacer readback cada
  frame (capa full-board **siempre** viva); sobre el fondo oscuro el patrón se ve casi igual con
  composición normal.
- **RS-3 · `will-change` disciplinado en `ShopFX`.** `.shop-fx > span` deja de declarar `will-change`
  permanente (`styles.css`). Marcarlo en los ~100 nodos del pool reservaba backing stores aunque
  estuvieran inertes: una regresión introducida en v2.19.0 respecto al criterio de `.fxp`. La animación
  WAAPI ya promueve la capa solo mientras corre.
- **RS-5 · Decodificación asíncrona.** El helper `icon()` (`game.js`) emite `decoding="async"` (cubre la
  mayoría de iconos in-game generados por JS); el `<img>` del rótulo de la tienda fija `img.decoding`;
  y las **77** `<img>` de `index.html` llevan ya `decoding="async"`. Evita la decodificación síncrona en
  el hilo principal al pintar y las "imágenes a medias" al navegar bajo presión de memoria.
- **RS-7 · Arranque conservador multi-plataforma.** `Perf.init` (`game.js:8044`) activa el `_bootGuard`
  (nivel 1 durante ~5s hasta EMA bueno) en cualquier táctil con `devicePixelRatio ≥ 2` **o**
  `navigator.deviceMemory ≤ 4`, no solo en iOS `dpr≥3`. Cubre tablets Android de alta densidad como la
  Mi Pad 7 y dispositivos de poca RAM.

**Verificación:** `node --check` OK · nuevo `tests/render-stability.test.js` **6/6** (guardarraíles CSS
de RS-1/2/3, decoding en `icon()`+index.html, arranque del gobernador por dpr y por RAM baja) ·
`tests/qp2-perf.test.js` y `tests/animation-perf.test.js` verdes · suite completa 287/289 (los 2 fallos
`board-themes-redesign` y los 3 errores de lint `Buffer` de `icon-packs.test.js` son **preexistentes**,
verificado por `git stash`; ajenos a este trabajo).

**Expectativa:** RS-1/2/3 eliminan los tres picos que reventaban el presupuesto de GPU (filtro
full-board, blend siempre-vivo, 100 capas will-change) → el parpadeo a negro debería desaparecer.
RS-5 ataca las imágenes a medias. RS-7 da colchón durante el arranque. La confirmación definitiva es
RS-9 (dispositivo real).

### v2.27.0 — RS-4: presupuesto de capas de celda

- **RS-4 · Tope de pulsos de celda concurrentes.** `Render.cellPulse` (`game.js`) ahora (a) **acota**
  el nº de pulsos decorativos simultáneos con un tope que escala con el gobernador (28 en nivel 0, 18
  en nivel 1, 10 en nivel 2): pasado el tope se omite **solo el adorno** (el estado de la celda ya lo
  pinta `syncCell`/`syncAll`), invisible en cascadas enormes; y (b) **evita el reflujo síncrono**
  (`void offsetWidth`) salvo al re-disparar sobre una celda que ya pulsa — en el camino común de
  cascada (celda nueva) desaparece la tormenta de layout que además promovía decenas de capas a la vez.
  Es justo el pico que en Android hi-dpi desalojaba backing stores → parpadeo a negro.
  Test: `tests/render-stability.test.js` (tope 28 en nivel 0, 10 en nivel 2). Bump 2.26.0 → 2.27.0.

### v2.28.0 — RS-10: eliminar el reflujo síncrono del spawn masivo (pico de hilo principal en iOS)

> **Síntoma nuevo (iOS):** al aparecer **muchos iconos de golpe** (refill tras vaciar el tablero),
> quizá con otra animación en curso, la interfaz **se laguea y pierde frames**. A diferencia del
> parpadeo a negro (RS-1…RS-7, presupuesto de capas/GPU), esto es un **pico de trabajo en el hilo
> principal**: *layout thrashing*.

- **Causa raíz.** `Render.spawnAnim` reiniciaba la animación CSS `glyph-in` con el truco
  `el.classList.remove('spawn'); void el.offsetWidth; el.classList.add('spawn')`. Ese `void
  offsetWidth` fuerza un **recálculo de layout SÍNCRONO** del documento. Se llamaba **por celda**, y el
  refill masivo lo invoca en bucle (`refilled.forEach((idx) => Render.spawnAnim(idx))`, `game.js:~9433`):
  con 30-40 iconos nuevos eran **30-40 reflujos forzados en un único frame**, intercalados con
  escrituras de clase → el hilo principal se bloquea y caen los frames (peor en Safari/iOS, cuyo layout
  es más lento). La animación en sí (`glyph-in`: `transform: scale` + `opacity`) ya era barata.
- **Corrección.** `spawnAnim` pasa a **WAAPI** (`glyph.animate([...])`): arranca sin `void offsetWidth`
  (cero reflujo forzado), corre en el compositor y no depende de `FX.cap`. Misma animación (mismo
  easing, misma duración 280 ms, mismo scale .2→1 / opacity 0→1). Al ser un cambio en `spawnAnim`,
  **beneficia a TODOS sus llamadores** (refill, penalización, robos de jefe, meteoro…), no solo al
  refill masivo. Ya no se añade la clase `.spawn` (la regla CSS `.cell.spawn .glyph` queda inerte).
  Es el mismo patrón que ya se aplicó a `Render.popup` (WAAPI en vez de `void offsetWidth`) y a
  `cellPulse` en RS-4. Test: `tests/render-stability.test.js` (usa WAAPI, no añade `.spawn`).
  Bump 2.27.0 → 2.28.0.

### Siguiente ola (pendiente)

- **RS-6** — dimensiones explícitas en imágenes + acotar tamaño de pseudos de skin.
- **RS-8** — evaluar (con bandera y medición) un canvas único para partículas.
- **RS-9** — `perf-probe` con recuento de capas + validación en Mi Pad 7 real (chrome://inspect → Layers).

---

## 6. Referencias cruzadas

- `QA_PERF_PLAN.md` §3 y `ANIMATION_PERF_PLAN.md` — hermanos de rendimiento (gameplay y ráfaga).
- `DESIGN_SYSTEM.md` — regla de compositing (transform/opacity-only; sin blend/filter animado en superficies grandes).
- `ARCHITECTURE.md` §4-§5 — módulos `FX`/`ShopFX`, `Render`, modelo de composición y gobernador `Perf`.
