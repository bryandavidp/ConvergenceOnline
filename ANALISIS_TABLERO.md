# Análisis del tablero y el motor de juego — Convergence Online

> Documento de análisis de los fallos de UI/UX y de comportamiento del tablero en tiempo real,
> con causa raíz (archivo:línea), severidad e impacto. Las correcciones aplicadas se marcan con ✅.
>
> Nota: este informe vive en la raíz del repo (no en `docs/`, que se regenera y vacía en cada build).

Ruta del juego: `/game` (requiere login con email/contraseña cualquiera).
Pila: Vite 6 + React 19 + TypeScript + Redux Toolkit. Animaciones por CSS keyframes
(framer-motion solo en modales; react-spring instalado pero sin uso real).

## Arquitectura relevante

- **Path vivo de juego al hacer clic**: `GameBoard` → `useBoardInteraction.handleCellClick`
  → `removeConvergingIcons` (puntuación/combos) → `.then()` → `showPointsEarned` (popup).
- `GamePage` usa `useGameLogic` **solo** para `startTimers/stopTimers/initializeBoard`.
- ⚠️ Existe lógica **duplicada** (`useGameLogic.ts` también tiene `removeConvergingIcons` y
  `showPointsEarned`, líneas 713/1144) que NO es la usada al puntuar por clic. Riesgo de
  mantenimiento; recomendable consolidar en el futuro.
- El popup de puntos se crea con **DOM imperativo** (`document.createElement`), fuera de React.

---

## 1. UI/UX — Tablero y HUD

### 1.1 El HUD/score se desplaza al puntuar — Severidad: ALTA ✅
- **Causa**: `.game-hud` es `grid-template-columns: repeat(7, 1fr)` (`GameHUD.css:171`). `1fr`
  equivale a `minmax(auto, 1fr)`: cuando el valor de PUNTUACIÓN crece de dígitos, su `min-content`
  puede superar el reparto equitativo y **redistribuye todas las columnas**, desplazando los items.
- **Agravantes**: tamaños fijos en `rem` sin números tabulares (`GameHUD.css:242-248`) y cambios
  bruscos de columnas en los breakpoints (7→4→3→2).
- **Fix**: `repeat(N, minmax(0, 1fr))` (columnas de ancho fijo, ignoran el contenido) +
  `font-variant-numeric: tabular-nums` + tamaños con `clamp()`.

### 1.2 Los números flotantes de puntos no son consistentes entre pantallas — ALTA ✅
- **Causa**: tamaños hardcodeados en px en `GameBoard/styles/animations.css`:
  `.points-value` 24px, `.combo-display` 26px, `.base-points-text` 32px, `.result-text` 36px,
  `.combo-count` 20px. El tablero sí usa `clamp()`, de ahí la incoherencia: en móvil los números
  salen desproporcionados.
- **Fix**: sustituir px por `clamp(min, vmin, max)` coherente con el tablero (también en el
  ComboTimer: `.combo-multiplier` y `.combo-count`).

### 1.3 La animación del popup de puntos se corta — MEDIA ✅
- **Causa**: `.points-popup.clean-style` animaba `pointsFloat 2s` (`animations.css`) pero el JS
  elimina el nodo a **1500 ms** (`useBoardInteraction.ts:305-309`).
- **Fix**: alinear ambos a 1.5 s.

---

## 2. UI/UX — Alertas y marcadores

### 2.1 Las notificaciones/alertas se solapan — ALTA ✅
- **Causa**: cada `.game-notification` era `position:absolute; top:20px; left:50%`
  (`GameNotification.css`). El contenedor `.notification-manager.top` es `flex column` con
  `gap:10px`, pero al ser hijas absolutas el `.notification-wrapper` colapsa a 0 px de alto y el
  `gap` no apila nada → **todas se dibujaban en el mismo `top:20px`**.
- **Duplicidad**: hay dos sistemas (`GameNotificationManager` y `NotificationProvider`) en el mismo
  archivo; el vivo es `NotificationProvider` (envuelve `GameBoard`).
- **Fix**: `.game-notification` pasa a `position:relative` (parte del flujo) con `margin:0 auto`,
  para que el `flex`+`gap` las apile; animaciones de entrada/salida usan solo `translateY`.

### 2.2 Marcadores y multiplicadores (ComboTimer) se solapan con el HUD — ALTA ✅
- **Causa**: `.combo-indicator` era `position:fixed; top:75px; right:15px` (`ComboTimer.css`),
  justo encima del HUD/controles; en móvil solo bajaba a `top:65px` (insuficiente). Además compartía
  `z-index:1000` con los popups de puntos.
- **Nota**: hay una clase `.combo-timer-wrapper` (fixed, abajo-centro) en `GameHUD.css:319` que
  quedó sin usar (el componente usa `.combo-indicator`).
- **Fix**: reanclado a abajo-derecha (`bottom:20px; right:20px`, responsive) y `z-index:1500`.

### 2.3 Escala de z-index incoherente — MEDIA ✅
- Valores dispersos con empate 1000/1000 entre popups y ComboTimer.
- **Fix**: jerarquía explícita: tablero (1/5) < HUD (10) < popups (1200) < ComboTimer (1500) <
  notificaciones (2000).

---

## 3. Motor de juego

### 3.1 Multiplicador obsoleto al reiniciar combo — ALTA ✅
- **Causa**: en `removeConvergingIcons` (`useBoardInteraction.ts`), cuando expiraba la ventana de
  combo se hacía `dispatch(resetCombo())` y el nuevo `incrementCombo()` se difería con
  `setTimeout(...,0)`, pero `activeMultiplier` se leía **síncrono** justo después (`getState()`).
  El conteo/visualización del combo quedaba desincronizado del score.
- **Fix**: `resetCombo()` + `incrementCombo()` **síncrono** (sin `setTimeout`).

### 3.2 Puntos mostrados ≠ puntos sumados — ALTA ✅
- **Causa**: el score real usa `basePoints = actualIconsRemoved * 10 * level`, pero el popup recibía
  `convergingIcons.length * 10` (`useBoardInteraction.ts:848`), **sin el factor `level`** y con un
  conteo potencialmente distinto.
- **Fix**: se propaga el `basePoints` real (vía `lastBasePointsRef`) al `showPointsEarned`.

### 3.3 Tablas de multiplicadores divergentes — MEDIA ✅
- `incrementCombo` (`gameSlice.ts`) usaba umbrales hardcodeados 3/6/10/15 → 1.5/2/3/5 (topaba en
  5x), mientras `config.COMBO_SYSTEM.MULTIPLIERS` define 3/6/10/15/20/30 → 1.5/2/3/5/8/10 y los
  `MILESTONE_BONUSES` ya premiaban 20 y 30. Los niveles 8x/10x nunca se aplicaban.
- **Fix**: el reducer ahora deriva el multiplicador de `config.COMBO_SYSTEM.MULTIPLIERS` (única
  fuente de verdad), eligiendo el umbral más alto alcanzado. Esto **mejora el balance** premiando
  combos largos (8x a partir de 20, 10x a partir de 30); coherente con los bonus de hito existentes.

### 3.4 Posible doble spawn al cambiar la velocidad — BAJA ✅ (no era un bug)
- Tras revisión: `setupIconTimer` (`useGameLogic.ts:671-694`) **sí** limpia y recrea el intervalo
  cuando `spawnRate` cambia (compara `lastSpawnRateRef` en cada tick y llama recursivamente a
  `setupIconTimer`). El ritmo antiguo no se conserva. No requiere cambios.

### 3.5 Redundancias / código muerto — BAJA ✅ (parcial)
- **Eliminado** (código muerto confirmado, sin imports vivos):
  - `src/utils/audio.ts` (0 referencias).
  - `src/hooks/useAudio.ts` (solo lo usaba `Controls.tsx`).
  - `src/components/game/Controls/Controls.tsx` (no se renderiza en ningún sitio; incluso importaba
    un `Controls.css` inexistente).
  - El componente default `GameNotificationManager` (sin imports; vivían solo `NotificationProvider`
    y `useNotifications`).
- **Audio vivo**: `audioManager` (juego) y `useGameSound` (modales). Se mantienen.
- **Pendiente (no tocado, riesgo alto)**: `useGameLogic.ts` contiene `removeConvergingIcons`/
  `showPointsEarned` paralelos al path vivo (`useBoardInteraction`). Siguen cableados en el `return`
  del hook (por eso compila con `noUnusedLocals`), así que su eliminación requiere un refactor
  mayor y verificación dedicada; se deja documentado para una fase futura.

---

## Resumen de severidad

| # | Problema | Severidad | Estado |
|---|----------|-----------|--------|
| 1.1 | HUD/score se desplaza | Alta | ✅ Corregido |
| 1.2 | Números flotantes inconsistentes | Alta | ✅ Corregido |
| 1.3 | Animación del popup cortada | Media | ✅ Corregido |
| 2.1 | Notificaciones solapadas | Alta | ✅ Corregido |
| 2.2 | ComboTimer solapa el HUD | Alta | ✅ Corregido |
| 2.3 | z-index incoherente | Media | ✅ Corregido |
| 3.1 | Multiplicador obsoleto al reiniciar combo | Alta | ✅ Corregido |
| 3.2 | Puntos mostrados ≠ sumados | Alta | ✅ Corregido |
| 3.3 | Tablas de multiplicador divergentes | Media | ✅ Corregido (unificado con config) |
| 3.4 | Posible doble spawn | Baja | ✅ Verificado: no era bug |
| 3.5 | Código muerto (audio/notif/Controls) | Baja | ✅ Eliminado (parcial; ver 3.5) |
