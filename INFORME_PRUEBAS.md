# Informe de pruebas de estrés — Convergence Online (juego `/game`)

Pruebas automatizadas con Playwright (Chromium headless) sobre el servidor de desarrollo
(`vite`, `http://localhost:5173/ConvergenceOnline/`). Login mockeado (cualquier email/pass).
Se jugó como "jugador profesional": ráfagas masivas de clicks sobre el tablero, pausas/reanudaciones
y pistas, en varias iteraciones y modos.

## Metodología

- 5 modos recorridos (clásico, zen, contrarreloj, supervivencia, tutorial), recargando la app entre
  cada uno (estado limpio).
- **~6.900 clicks** totales sobre celdas (todas las vacías en cada iteración + ocupadas para
  estresar el debounce), ~22 s de juego intensivo por modo.
- Captura de: excepciones no controladas (`pageerror`), `console.error`/`warning`, peticiones
  fallidas, evolución de puntuación y ocupación del tablero, y capturas de pantalla por modo.

## Resultados (resumen)

| Modo | Arrancó | Clicks | Score | Ocupación tablero | Excepciones |
|------|---------|--------|-------|-------------------|-------------|
| Clásico | ✅ | 1645 | 0→190 | 33→52 / 64 | 3 |
| Zen | ✅ | 2377 | 0→100 | 20→45 / 64 | 3 |
| Contrarreloj | ✅ | 1505 | 0→60 | 32→59 / 64 | 3 |
| Supervivencia | ✅ | 1360 | 0→100 | 32→59 / 64 | 3 |
| Tutorial | — | — | — | — | — |

**Total: 15 excepciones no controladas, 7 peticiones fallidas, múltiples warnings.**

---

## Errores detectados (por severidad)

### 🔴 ALTA — `ReferenceError: process is not defined` (15 excepciones durante el juego)
- **Origen**: `src/utils/audioManager.ts:59`, función `getDefaultSoundUrl`:
  `const basePath = process.env.PUBLIC_URL || '';`
- **Disparador**: se ejecuta desde `audio.onerror` (`audioManager.ts:16`) **cada vez que un sonido
  falla al cargar**. En el navegador `process` no existe (Vite no lo define salvo `NODE_ENV`), así
  que lanza una excepción no controlada.
- **Impacto**: excepciones repetidas en runtime durante la partida; el sonido de respaldo nunca se
  asigna. Ruido grave y síntoma de audio roto.
- **Relacionado**: las rutas de respaldo incluyen `/public/...` (p.ej.
  `${basePath}/public/assets/audio/pops/click.wav`), que tampoco existen en producción.
- **Fix sugerido**: usar `import.meta.env.BASE_URL` (o el helper `resolveAssetUrl` ya creado) y
  quitar el segmento `/public/` de las rutas.

### 🔴 ALTA — Archivos de audio referenciados que NO existen
- **Origen**: cargadores en `audioManager.ts` / `audio.ts` / `useAudio.ts`.
- **Faltan** (referenciados pero ausentes en `public/assets/audio/`):
  - `pops/resume.wav`, `pops/start.wav`, `pops/gameover.wav`
  - `positives/bell-up.wav`, `positives/time-bonus.wav`
- **Impacto**: cada carga fallida (`net::ERR_ABORTED`) dispara `onerror` → y con ello el crash de
  `process is not defined` (punto anterior). Sonidos clave (combo `convergingFound`→bell-up,
  `timeBonus`, `resume`) nunca suenan.
- **Fix sugerido**: apuntar a archivos existentes (p.ej. `positives/chime-up.wav`, `pops/pause.wav`)
  o añadir los archivos que faltan.

### 🟠 MEDIA — El modo **Zen** (y Tutorial) no existen en la config de modos → juegan como Clásico
- **Origen**: `src/utils/config.ts:187` `GAME_MODES` solo define `CLASSIC`, `TIMED`, `SURVIVAL`.
  `getGameModeConfig('zen')` (`config.ts:314-318`) no lo encuentra y hace fallback a `CLASSIC`
  (warning en consola: *"Modo de juego 'zen' no encontrado, usando modo clásico"*).
- **Impacto**: Zen no se comporta como Zen (debería ser relajado/sin fin); Tutorial tampoco tiene
  config propia. Experiencia incorrecta en 2 de 5 modos.
- **Fix sugerido**: añadir entradas `ZEN` y `TUTORIAL` a `GAME_MODES`/`GAME_MODE_CONFIG`.

### 🟠 MEDIA — `BASE_MODE_CONFIG` nunca se carga (require en navegador)
- **Origen**: `src/utils/initLevelSystem.ts:34` usa `require('./BASE_MODE_CONFIG')` (CommonJS) dentro
  de código que corre en el navegador (ESM/Vite). Siempre falla → `catch` → valores por defecto
  (warning: *"No se pudo importar BASE_MODE_CONFIG, usando valores por defecto"*).
- **Impacto**: el sistema de niveles usa SIEMPRE el fallback, ignorando la configuración real de
  modos por nivel. El mismo archivo se importa correctamente vía `import` en `levels.ts:2`.
- **Fix sugerido**: sustituir `require(...)` por `import` estático (ya disponible).

### 🟡 BAJA — El bloqueo de modos por tutorial no funciona (flag siempre activo)
- **Origen**: `src/components/game/GameModals/ModeSelectionModal.tsx:397-400`: el inicializador del
  estado hace `localStorage.setItem('tutorialCompleted','true')` **incondicionalmente**, de modo que
  `tutorialCompleted` siempre es `true` y `areModesBeyondTutorialLocked` siempre es `false`.
- **Impacto**: la mecánica de "desbloquear modos tras el tutorial" está anulada (los candados nunca
  aparecen). Es un side-effect dentro de un inicializador `useState` (anti-patrón).
- **Fix sugerido**: leer el flag sin escribirlo; marcar `tutorialCompleted` solo al completar el
  tutorial (ya se hace en `GameTutorial.tsx:65` y `ModeSelectionModal.tsx:691`).

### 🟡 BAJA — `process.env` latente en otros módulos (riesgo de crash si se ejecutan)
- **Origen**: `src/services/api/apiService.ts:4` (`process.env.REACT_APP_API_URL`),
  `src/services/websocket/socketService.ts:12` (`process.env.REACT_APP_SOCKET_URL`).
- **Impacto**: si esos servicios se inicializan en el navegador, lanzarían `process is not defined`.
  (`process.env.NODE_ENV` en `main.tsx`/`ComboTimer.tsx` sí lo resuelve Vite, no crashea.)
- **Fix sugerido**: migrar a `import.meta.env.VITE_*`.

---

## Observaciones (no errores, pero puntos a vigilar)

- **Ocupación del tablero al alza**: con clicks aleatorios masivos la ocupación sube (p.ej. 32→59/64
  en contrarreloj/supervivencia). El spawn supera a las convergencias encontradas al azar; un jugador
  real las encuentra mejor, pero conviene validar el balance de spawn vs. tamaño de tablero para que
  no se llene de forma frustrante.
- **Fuente remota bloqueada**: `@import` de `fonts.googleapis.com` (Baloo 2) falla en entorno sin red
  (`ERR_CERT_AUTHORITY_INVALID`). Cae a fuente del sistema; conviene autoalojar la fuente para no
  depender de red externa y evitar el FOUT.
- **Tutorial en automatización**: la tarjeta de Tutorial no se ofreció al recargar con
  `tutorialCompleted=true`; no se pudo probar su flujo guiado de forma automática (revisar a mano).
- **Logging excesivo**: gran volumen de `console.log`/`[COMBO DEBUG]` en producción; conviene reducir
  el nivel de log para no degradar rendimiento en sesiones largas.

## Estado tras las correcciones (verificado con la misma batería de pruebas)

Se repitió la prueba de estrés (~6.000 clicks, 4 modos) tras aplicar los arreglos:

| Métrica | Antes | Después |
|---------|-------|---------|
| Excepciones no controladas (`process is not defined`) | 15 | **0** ✅ |
| Warnings "Modo 'zen' no encontrado" | sí | **0** ✅ |
| Warning `BASE_MODE_CONFIG` no importado | sí | **0** ✅ |
| Warnings "Error al cargar el sonido" | sí | **0** ✅ |

Correcciones aplicadas:
- `audioManager.ts`: `getDefaultSoundUrl` ya no usa `process.env` (usa `resolveAssetUrl`) y todas
  las rutas apuntan a archivos existentes; se precargan `points`/`combo*`.
- Referencias a audio inexistentes (`bell-up`, `time-bonus`, `resume`, `start`) repuntadas a
  archivos reales (`chime-up`, `pop-up`, `bleep`).
- `config.ts`: añadidos `ZEN` y `TUTORIAL` a `GAME_MODES`/`GAME_MODE_CONFIG`.
- `initLevelSystem.ts`: `require()` → `import` estático ESM.
- `ModeSelectionModal.tsx`: eliminado el efecto secundario en el inicializador de `useState`.
- `apiService.ts`/`socketService.ts`/`ComboTimer.tsx`/`main.tsx`: `process.env` → `import.meta.env`.
- **Rendimiento**: en producción se silencian `console.log/info/debug` (cientos de logs crudos en
  rutas calientes); `mobile-perf.css` desactiva `backdrop-filter: blur()` y reduce sombras en
  ≤768px, y respeta `prefers-reduced-motion`.

Pendientes ambientales/menores (no bloqueantes): la fuente de Google Fonts falla sin red (cae a
fuente del sistema; conviene autoalojarla); aviso de "detección de FPS agotada" en headless; los
`ERR_ABORTED` de audio son cancelaciones de precarga (los archivos sirven HTTP 200).

## Pruebas en móvil — iPhone 14 Pro Max (430×932 @3x, touch)

Emulación con Playwright (Chromium + GPU por software *swiftshader*, por lo que el FPS real en un
iPhone con GPU hardware será mejor). ~32 s de combos intensivos con `tap`. Métricas:

- **FPS medio ≈ 53** (frame ~18.7 ms), **1.6 %** de frames > 33 ms, **11** *long tasks*, heap **16 MB**,
  **0 excepciones**. Aceptable, mejorable.
- **CLS = 1.024** (objetivo < 0.1) → **muy alto**: la interfaz "salta" bastante.

### Bug "las líneas se abren hacia arriba" (cazado) — Severidad: ALTA
- **Causa raíz**: durante combos, los **popups de puntos** (`.points-popup`, `top:-40px`) y sus **6
  `points-particle`** (`position:absolute`, salen disparadas) se dibujan **por encima** del tablero,
  porque `.game-board-grid` y `.game-board-wrapper` tienen `overflow: visible`
  (`GameBoard/styles/base.css:32,48`). La sonda detectó `.points-particle` en y≈363–401 cuando el
  grid empieza en y≈412 → hasta **~49 px por encima** del tablero. En ráfagas de combos (sobre todo
  en filas altas) el cúmulo de números/partículas "abre" visualmente hacia arriba. Es fugaz porque
  solo ocurre en el pico del combo y desaparece en ~1.5 s.
- **Fix recomendado**: contener los popups dentro de una capa propia del tablero (o limitar el
  recorrido hacia arriba) y **reducir/eliminar partículas en móvil/perf-mode**; alternativamente
  recortar el desbordamiento superior del contenedor del tablero.

### Tablero desborda ~14 px por abajo — Severidad: MEDIA
- `.board-cell` usa `padding-bottom: 100%` (truco de aspecto) **a la vez** que el grid define
  `grid-template-rows: repeat(8, 1fr)` (`GameBoard.tsx:459`). Doble restricción → la última fila
  sobresale ~14 px del grid (la sonda vio `.board-cell` en bottom=816 vs gridBottom=802).
- **Fix recomendado**: eliminar `padding-bottom:100%` y confiar en el grid cuadrado (o usar
  `aspect-ratio: 1` en la celda), para que filas y pista coincidan exactamente.

### Multiplicador de velocidad disparado — Severidad: ALTA
- Encadenando movimientos inválidos rápidos aparecen avisos **"¡Velocidad aumentada! x533 … x1000"**
  (capado en 1000). El valor mostrado `baseSpeed / spawnRate` no está acotado y las penalizaciones de
  velocidad se acumulan sin tope efectivo. El modal de fin sí muestra una velocidad sensata (1.0 s),
  así que es sobre todo un **bug de cálculo/visualización del aviso** + **spam de notificaciones**.
- **Fix recomendado**: acotar el multiplicador mostrado (p.ej. máx. 5–10x) y *throttlear* el aviso de
  velocidad (no más de uno cada N s).

### Notificaciones tapan el HUD y persisten sobre el modal — Severidad: MEDIA
- El overlay de notificaciones es `position:fixed; top:0; z-index:2000`, por lo que en móvil cubre
  PUNTUACIÓN/NIVEL/TIEMPO, y siguen visibles **encima del modal de Game Over**.
- **Fix recomendado**: en móvil, situarlas bajo el HUD o limitar a 1; ocultarlas al terminar la
  partida.

### Otros
- **CLS alto** agravado por las notificaciones apiladas en flujo (al aparecer/desaparecer empujan a
  sus hermanas). Mejor animarlas con `transform`/reservar espacio.
- **Overlay de FPS de desarrollo visible** ("60 FPS" arriba-izquierda): asegurarse de ocultarlo en
  producción.
- El **modal de Game Over** se ve correcto y legible en móvil (buena base de diseño).

### Estado tras las correcciones de móvil (re-verificado en iPhone 14 Pro Max)

| Métrica | Antes | Después |
|---------|-------|---------|
| Bug "líneas hacia arriba" (anomalías de overflow/Δ de fila) | varias | **0** ✅ |
| Desborde de celdas (~14 px) | sí | **0** ✅ |
| **CLS** (saltos de interfaz) | 1.024 | **0.019** ✅ |
| Multiplicador de velocidad mostrado | x533 … x1000 | **x2.8** (acotado + throttle) ✅ |
| Notificaciones | tapaban HUD/modal | **ancladas abajo, sin spam** ✅ |

Correcciones aplicadas:
- `GameBoard/styles/index.css` + `base.css`: `.game-board-wrapper` con `overflow: hidden` (contiene
  popups y partículas dentro del tablero) y `.board-cell { min-width:0; min-height:0 }` (evita el
  desborde de items de grid). Eliminado el `.game-cell` muerto con `padding-bottom:100%`.
- `useBoardInteraction.ts`: partículas solo en escritorio; `showSpeedAlertUI` con throttle (1/3 s),
  guard de estado `playing` y valor acotado; `penalize` calcula un multiplicador real
  (`INITIAL_SPAWN_RATE / spawnRate`) en vez de pasar el spawn rate en ms.
- `GameNotificationManager.css`: en ≤768 px las notificaciones se anclan abajo (no tapan el HUD).

## Veredicto

El juego **arranca y responde** en todos los modos jugables. Tras las correcciones de motor, audio,
modos, rendimiento y UI móvil, ya **no hay excepciones**, el **CLS** pasó de 1.024 a 0.019, el bug
fugaz de "líneas hacia arriba" en combos está resuelto (popups/partículas contenidos) y el aviso de
velocidad muestra valores coherentes. Quedan como mejora futura los puntos documentados de bajo
impacto (sistemas duplicados restantes, balance de spawn) y autoalojar fuentes ya está hecho.
