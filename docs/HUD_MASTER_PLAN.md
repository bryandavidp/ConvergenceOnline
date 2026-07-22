# HUD Master Plan — Feedback en partida por modo

> **Estado:** 🟡 En progreso — **F1 ✅** (Tutorial, Zen) · **F2 ✅** (héroe + Clásico/Contrarreloj/Diario) · **F3 ✅** (Aventura adaptativa) · **F4 pendiente** (Supervivencia). Este documento es a la vez **plan** y **bitácora**: cada tarea completada se anota en §9 con el cambio real, los `id`/funciones tocadas y los hallazgos. Si no puedo terminar, otra persona retoma leyendo §9 (qué se hizo) + §5 (qué falta y en qué orden).
>
> **Versiones:** F1 → v2.20.0 · F2 → v2.21.0 · F3 → v2.22.0.
>
> **Alcance:** rediseño del HUD *en partida* de los 7 modos (Tutorial, Clásico, Aventura, Contrarreloj, Reto del día, Supervivencia, Zen). Basado en la auditoría de feedback aportada por el propietario, **verificada y aterrizada contra el código real** (no contra la documentación, que está desactualizada: `game.js` tiene ~13 300 líneas y `styles.css` ~14 300, no las cifras del CLAUDE.md).
>
> **Naturaleza de los cambios:** el HUD es **presentacional**. Ninguna tarea de este plan cambia reglas, fórmulas ni economía → **no hay riesgo de balance** (no requiere `balance-sim`). Pero sí obliga a: (1) subir versión triple (`VERSION`/`CACHE`/`?v=`), (2) añadir claves i18n en **ES y EN**, (3) pasar `node --test` + `eslint`.

---

## 1. Principio rector

El HUD debe responder en todo momento a cuatro preguntas: **¿Qué hago? · ¿Cómo voy? · ¿Qué va a pasar? · ¿Estoy en peligro o cerca de ganar?**

La regla de oro que guía cada decisión:

> **Un dato permanece en el HUD únicamente cuando puede cambiar la siguiente decisión del jugador.**

El problema de fondo no es la *cantidad* de información, sino que **datos de distinta importancia compiten con la misma intensidad visual**. La solución no es un HUD por modo hecho a mano, sino **un sistema de slots reutilizables** donde cada modo elige (a) qué slot es dominante y (b) qué slots se ocultan.

### Las 5 capas de feedback

| Capa | Qué es | Cómo debe vivir en el HUD |
|---|---|---|
| **A · Estado permanente** | objetivo, progreso, tiempo, vidas, oleada, puntuación | Posición estable, cambia poco. Solo el **dato dominante** del modo tiene jerarquía de héroe. |
| **B · Estado temporal** | combo, fiebre, multiplicador, booster, bendición, escudo | Aparece, se intensifica y desaparece. **Nunca** ocupa espacio permanente en ×1/inactivo. |
| **C · Eventos inmediatos** | convergencia, puntos, combo++, error, obstáculo dañado | Animación breve **cerca de la acción** (tablero/popup), no un bloque nuevo del HUD. |
| **D · Anticipación** | próxima oleada, jefe cercano, últimos 10 s, tablero casi lleno | Solo cuando es **accionable**. |
| **E · Resultado / hito** | objetivo completado, nivel superado, récord, medalla, jefe derrotado | Presentación **central breve**, no permanece. |

---

## 2. Auditoría del estado ACTUAL (⚠️ leer antes de tocar nada)

Buena parte de las recomendaciones de la auditoría **ya están implementadas**. Esta tabla evita rehacer trabajo. Referencias a `game.js`/`index.html`/`styles.css` sobre v2.19.2.

### 2.1 Sistemas transversales

| Sistema | Estado | Dónde / notas |
|---|---|---|
| **Wallet fija** (monedas/gemas/run) con `+` de compra | ✅ Hecho | `index.html` `.hud-wallet` (`#hud-coins`, `#hud-gems`, `#hud-run-coins-wrap`, `#hud-xp-boost`). Botones `data-act="buy-coins/buy-gems"`. |
| **Pausa como único control persistente** | ✅ Hecho | `#btn-pause` en `.controls`. Reinicio/salir viven en el modal de pausa. |
| **Dock de eventos estable** (cola serial, altura reservada) | ✅ Hecho | `.event-dock > #toasts`. `Toasts.event()` (cola serial, máx 2 visibles en surv / 3 resto). Altura fija por CSS. |
| **Multiplicador unificado** (combo × fiebre × temporal × frenesí × bendición) en un solo chip | ✅ Hecho (GM-16) | `Render.multChip()` (`#hud-mult`) junto al score. Ya colapsa las 4 fuentes en un número. **Falta**: desglose al pausar/tap (§HUD-S4). |
| **Ocupación = medidor de peligro con %** y umbrales 65/85 | ✅ Hecho | `.occ` (`#occ-percent`, `#hud-progress-fill`, `#occ-label`). `Render.hud()` aplica `.warn`/`.danger` y cambia label a "Peligro". |
| **Peligro ambiental** (marco del tablero pulsa, sonido, haptic) | ✅ Hecho | `Render.danger()` togglea `.warn`/`.danger` en `.board-wrap`; `Sound.danger()` + `Haptics.fire()`. |
| **Separadores numéricos** (`fmtNum`) en score/best/economía | ✅ Hecho | `fmtNum` aplicado en `Render.hud()`, count-up del loop y popups. |
| **Ghost personal** (¿vas por delante de tu mejor intento?) | ✅ Hecho (GM-12) | `#hud-ghost` en modos scoreAttack. |
| **Toolbelt de objetos** con stock/estado/pista integrada | ✅ Hecho | `.booster-bar > #boosters` + `#btn-hint-tool`. `Boosters.buildBar()`. |
| **Presión temporal ambiental** (<20 s, <10 s) | ✅ Hecho | `Render.hud()` togglea `time-pressure`/`time-critical` en `<body>`. |

### 2.2 Por modo

| Modo | Estado | Qué ya hace / qué falta |
|---|---|---|
| **Tutorial** | ✅ Hecho (F1) | `Coach.start()` ahora aplica `mode-tutorial`; CSS oculta wallet/objetivo/score/combo/ocupación/toolbelt; overlay `#coach` con contador "Paso X de 3". HUD más limpio del juego. → **HUD-T** completado. |
| **Clásico** | 🟡 Parcial | `obj-banner` muestra objetivo textual + estrellas en vivo (`#obj-stars`, `updateLiveStars()`). Pero el **dato dominante es el score** (héroe en `.score-row`), no las "figuras restantes", que **no se muestran como número**. → **HUD-C**. |
| **Aventura** | 🟡 Parcial | `Adventure.banner()` es adaptativo (bioma, cara de jefe, texto de objetivo `objectiveText()`). Pero el objetivo vive como **texto pequeño** en el banner sin barra de progreso, y el **dato dominante no cambia** según misión (score sigue siendo héroe siempre). → **HUD-A**. |
| **Contrarreloj** | 🟡 Parcial | Tiempo es un **chip pequeño** (`.time-chip` en `.gctx`) mientras el score es héroe → jerarquía invertida respecto a lo deseado. Récord solo vía ghost. → **HUD-TA**. |
| **Reto del día** | 🟡 Parcial | `updateDailyObjective()` actualiza `#daily-note` (texto "próxima medalla") y lanza toasts de medalla. **Falta** barra de progreso a la siguiente medalla en el HUD y "primer intento" como intro efímera. → **HUD-D**. |
| **Supervivencia** | 🟡 Avanzado | `surv-bar` (vidas/oleada/tier/tiempo + subfila + build), `power-rings` (frenesí exterior + carga interior = **2 anillos concéntricos**, ya mejor que 2 barras), banner de jefe (`#surv-boss`), `boss-soon` flag, secuenciación de fin de oleada (cola serial). **Falta**: consolidar frenesí+carga en 1 medidor de energía (o distinguirlos mejor), desglose de multiplicador, timers de duración en efectos activos. → **HUD-S**. |
| **Zen** | 🟡 Mejorado (F1) | Además de lo previo, ahora **oculta wallet, ocupación y chip de Nivel**, y el tablero lleno es **calmado** (sin rojo, mensaje "Liberando espacio…"). Pendiente: score oculto-por-defecto (Z2) y combo ambiental (Z4). → **HUD-Z** parcial. |

---

## 3. Sistema de slots (aterrizado al DOM real)

En lugar de un HUD por modo, seis slots reutilizables. Cada modo declara qué slot domina y cuáles oculta (vía clase `body.mode-*` en CSS + lógica en `Render`/`Game`).

| Slot | Rol | DOM actual | Contenido según modo |
|---|---|---|---|
| **1 · Objetivo central** | El dato dominante (solo uno) | `.obj-banner` / `.gscore` | figuras restantes · score objetivo · tiempo · medalla · oleada · jefe |
| **2 · Supervivencia (vitales)** | Recurso de derrota | `.surv-bar` (vidas), `#obj-stars` (estrellas) | vidas · estrellas · movimientos · escudo. Solo si el modo lo necesita. |
| **3 · Rendimiento temporal** | combo/fiebre/mult unificados | `#hud-mult`, `#combo` | Estados: Oculto → Combo → Combo alto → Fiebre → Caducidad. |
| **4 · Efectos activos** | Iconos con duración | `#surv-build`, `.booster-bar` | boosters, bendiciones, trampas, penalizaciones. Máx 3 + `+N`. |
| **5 · Eventos** | Área central no persistente | `.event-dock`, `#rank`, `bossCard()` | nueva oleada, jefe, objetivo completado, récord, medalla, estrella perdida. |
| **6 · Alerta ambiental** | No es tarjeta; modifica entorno | `.board-wrap.warn/.danger`, `body.time-pressure` | peligro, últimos segundos, jefe. |

**Jerarquía dominante objetivo por modo** (lo que este plan persigue):

```
TUTORIAL       Instrucción > tablero > paso
CLÁSICO        Figuras restantes > estrellas > peligro > combo > puntuación
AVENTURA       Objetivo > restricción > progreso > regla especial > puntuación
CONTRARRELOJ   Tiempo > combo/fiebre > puntuación > peligro > récord
RETO DEL DÍA   Tiempo > siguiente medalla > puntuación > combo > mejor marca
SUPERVIVENCIA  Vidas > oleada/jefe > progreso > energía > combo > puntuación
ZEN            Tablero > sensación > pista
```

---

## 4. Backlog de tareas (HUD-*)

Convención: `HUD-<letra><n>`. `X`=transversal, `T`=tutorial, `C`=clásico, `A`=aventura, `TA`=contrarreloj, `D`=diario, `S`=supervivencia, `Z`=zen. Estado: ⬜ pendiente · 🟡 en curso · ✅ hecho.

### HUD-X · Transversal

- **HUD-X1** ⬜ Formalizar la "gramática de slots" en CSS: revisar que cada `body.mode-*` declara explícitamente qué slots muestra/oculta, evitando estados heredados entre modos. Documentar el contrato en comentario de `styles.css`.
- **HUD-X2** ⬜ Auditar que **ningún dato meta/no accionable** vive en el HUD permanente (ver lista §7 de la auditoría). Mover a pre-partida/pausa/resultados: nombre completo del modo, récord lejano, texto "combo", ×1, fiebre inactiva, boosters pasivos, recompensas futuras, monedas por oleada, próximo jefe lejano.
- **HUD-X3** ✅ Componente único de "métrica dominante" reutilizable (`.hud-hero` en `.gscore`; `Render.hero()`/`_heroInfo()`) que cualquier modo puebla con `{val, sub?, frac?, urgent?}`. `.gscore.hero-on` degrada la puntuación. Usado ya por Clásico, Contrarreloj y Diario; Aventura lo consumirá en F3.

### HUD-T · Tutorial (HUD más limpio de todo el juego) ✅

- **HUD-T1** ✅ Aplicar `body.mode-tutorial` en `Coach.start()` (hoy no se aplica) y limpiarlo en `Coach.finish()/skip()`.
- **HUD-T2** ✅ CSS `body.mode-tutorial`: ocultar `.hud-wallet`, `.event-dock`, `.obj-banner`, `.score-row` (score/best/mult/level/time), `#combo`, `.occ`, `.booster-bar`, `.hint-fab`. Dejar solo `#btn-pause` + tablero + overlay coach.
- **HUD-T3** ✅ Añadir contador de paso "Paso X de 3" al overlay `#coach` (nuevo `#coach-step`), poblado desde `Coach._render()`. Clave i18n `coach_step` = "Paso {n} de {t}" / "Step {n} of {t}".
- **HUD-T4** ✅ Verificado con Playwright: tablero sigue enseñando (halo de casilla) y sin residuo de HUD al salir a un modo normal (ver bitácora §9).

### HUD-C · Clásico (figuras restantes = héroe) 🟡

- **HUD-C1** ✅ **Figuras restantes** es ahora el dato dominante vía el héroe reutilizable (`Render.hero()` → `_heroInfo()` devuelve `{val: State.iconCount, sub: "restantes"}`); la puntuación se degrada a línea secundaria (`.gscore.hero-on`). Pulso `urgent` cuando quedan ≤5.
- **HUD-C2** ⬜ *(Deferido F2.1)* "Estrella perdida" como destello efímero al fallar. Las estrellas en vivo ya viven en `#obj-stars` del banner (`updateLiveStars()`). Clave i18n `star_lost` aún no añadida.
- **HUD-C3** ⬜ *(Deferido)* Revisar duplicación estrellas/errores; de momento no se muestra contador de errores (solo estrellas), así que el solape es menor.
- **HUD-C4** ✅ Combo oculto en ×1 (ya lo hacía `Render.combo()`); verificado que no compite con "restantes" (el mult-chip queda junto al score degradado).

### HUD-A · Aventura (HUD adaptativo por objetivo) ✅

- **HUD-A1** ✅ Slot de objetivo **único que cambia de contenido** vía `Adventure.heroInfo()` (consumido por `Render._heroInfo()`):
  - `clear` → `{val: iconCount, sub: "restantes"}`.
  - `score` → `{val: "6 450 / 10 000", frac}` (el score ES el objetivo → dominante + barra).
  - `survive` → `{val: fmtTime(restante), sub: "Sobrevive", frac, urgent≤5s}`.
  - `boss` → `{val: "◆ N", sub: "Jefe", frac (destrucción de cristales), urgent≤2}`.
- **HUD-A2** ✅ **Barra de progreso** en el héroe para `score`/`survive`/`boss` (`#hud-hero-bar`). El banner ya no repite el progreso: `Adventure.banner()`/`refreshGoal()` muestran solo la **etiqueta corta estática** (`objectiveLabel()`: Limpiar/Puntuar/Sobrevivir/Jefe), evitando duplicar el dato.
- **HUD-A3** 🟡 El slot de objetivo pasa a **progreso del jefe** (héroe "◆ N" + barra). *Pendiente refinamiento*: durante el jefe la cara del banner (`#adv-boss-hp` pips) también muestra cristales → leve duplicación; opción futura: ocultar los pips del banner cuando el héroe está activo. Atenuar el resto de métricas es opcional.
- **HUD-A4** ✅ Modificador de bioma como estado pasivo compacto (`ModeSignals.noteHtml('aventura')` en el banner); no compite con el héroe.

### HUD-TA · Contrarreloj (tiempo = héroe) ✅

- **HUD-TA1** ✅ **Tiempo dominante y centrado** vía héroe (`_heroInfo()` para modos `timed` → `{val: fmtTime(timeLeft)}`); score degradado. Se ocultó el `.time-chip` lateral (ya redundante).
- **HUD-TA2** ✅ El héroe muestra el tiempo sin etiqueta "Tiempo"; el score degradado tampoco lleva etiqueta "Puntos".
- **HUD-TA3** ✅ Combo/fiebre ya unificados en `#hud-mult` (GM-16); al entrar en fiebre el mismo chip cambia de estado. Sin elemento nuevo.
- **HUD-TA4** ✅ Récord contextual: "¡Nuevo récord!" ya existía al superar `Storage.best`; **añadido** "A {n} del récord" al alcanzar el 85 %, una vez por partida, solo en modos `scoreAttack` (`State.recordNear`). El "Mejor" permanente se ocultó (`.score-meta` en hero-on). Claves i18n `rec_close`/`rec_new`.

### HUD-D · Reto del día (siguiente medalla = progreso) 🟡

- **HUD-D1** ⬜ *(Deferido)* Explicación completa solo pre-partida. Hoy el banner de identidad ("Combos = more time") sigue durante la partida; es breve y no cortado, así que baja prioridad.
- **HUD-D2** ✅ Medalla como **progreso a la siguiente** en el héroe: `hero-sub` = "🥈 1 120 / 1 500" + `hero-bar` con fracción entre medalla previa y siguiente (`Meta.DAILY_MEDALS`). Sin fila de 3 medallas.
- **HUD-D3** ⬜ *(Deferido)* "Primer intento · +N gemas" como intro efímera.
- **HUD-D4** ✅ Reutiliza el héroe de HUD-TA (tiempo dominante) + la capa de medalla propia del Diario.

### HUD-S · Supervivencia (vidas > oleada > energía; reducir barras)

> Existe además `docs/SURVIVAL_HUD_REDESIGN_PLAN.md` (plan previo, parcialmente implementado). Este bloque lo **absorbe y actualiza**.

- **HUD-S1** ⬜ **Zona vital** como núcleo: `Oleada N · ♥♥♡` + barra de progreso de oleada juntas y dominantes. (Ya en `.surv-bar`; reforzar jerarquía: vidas primero.)
- **HUD-S2** ⬜ **Zona rendimiento**: score + multiplicador **total** visible (`×3,4`), sin 4 indicadores sueltos. Ya vía `#hud-mult`.
- **HUD-S3** ⬜ **Zona poder especial**: reconsiderar carga+frenesí. Opción recomendada: **un solo medidor de energía**. Opción conservadora (menos riesgo): mantener ambos pero **nunca dos barras horizontales iguales** — hoy son 2 anillos concéntricos (`power-rings`), aceptable; documentar decisión. Etiquetar el anillo para que el jugador entienda qué llena qué.
- **HUD-S4** ⬜ **Desglose del multiplicador** bajo demanda (tap en `#hud-mult` o en pausa): "Combo ×2 · Fiebre ×1,25 · Frenesí ×1,35 · Total ×3,4". Información de consulta, no de combate. Claves i18n `mult_breakdown_*`.
- **HUD-S5** ⬜ **Efectos activos** como fila de iconos con **duración circular**, máx 3, pasivos ocultos tras info, consumidos desaparecen, `+N` si hay más. Hoy `#surv-build` muestra chips sin timer. Añadir countdown.
- **HUD-S6** ⬜ **Anticipación de jefe**: "⚠ Jefe en la próxima oleada" al empezar la oleada anterior (ya hay `surv-boss-flag`/`bossWarn`); reforzar que **construya expectación** y luego deje un marcador pequeño.
- **HUD-S7** ⬜ **Estado de jefe**: durante el encuentro, progreso de oleada → **vida del jefe**; suministro a segundo plano; monedas reducidas; "Ataque en 3" domina. (Parcial: `#surv-boss` existe.)
- **HUD-S8** ⬜ **Cambio de oleada secuencial** (no todo a la vez): oleada superada → recompensa → bendición → "Oleada 9 · Jefe" → tablero. (Parcial vía cola serial; verificar orden y que no se pisen.)

### HUD-Z · Zen (casi sin HUD) 🟡

- **HUD-Z1** 🟡 Estado normal decluttered: ocultos `.hud-wallet`, `.occ`, `.lvl-chip`, combo y `mult-chip` (ya). Score **atenuado** (opacity .55) — no oculto del todo (ver Z2). Quedan tablero + pista + pausa + jardín (flores).
- **HUD-Z2** ⬜ *(Deferido)* Puntuación oculta por defecto; aparece solo al pausar / finalizar / tras convergencia destacada. Decisión: por ahora se mantiene atenuada (menos disruptiva que ocultarla y re-mostrarla). El `obj-banner` de identidad calmada ("Sin fallos ni prisa") también se conserva; evaluar si retirarlo.
- **HUD-Z3** ✅ Tablero lleno **calmado**: `Render.hud()` fuerza `dl=0` en Zen (sin ámbar/rojo, sin sonido de peligro, label "Tablero"); `onOverflow` de Zen muestra "Liberando espacio…" antes del `softClear`. Clave i18n `zen_release` (ES/EN). Verificado a 91–95 % de ocupación sin peligro (ver §9).
- **HUD-Z4** ⬜ Combo como recompensa ambiental (aparece y se desvanece, sin barra de caducidad agresiva). En Zen el combo ya está oculto (`display:none`); pendiente decidir si mostrarlo como destello ambiental efímero.

---

## 5. Priorización / fases

Orden por **impacto ÷ riesgo**. Fase 1 = quick wins autocontenidos (bajo riesgo, alto impacto perceptual). Fase 2 = adaptación de objetivo (medio). Fase 3 = Supervivencia (mayor, más superficie).

| Fase | Tareas | Justificación |
|---|---|---|
| **F1 — Limpieza y quick wins** | HUD-T (✅), HUD-Z (🟡 Z1/Z3 hechos; Z2/Z4 deferidos), HUD-X1 (⬜) | Tutorial y Zen son los HUD que deben *quitar* cosas; cambios contenidos vía `body.mode-*` + CSS. Impacto inmediato, riesgo mínimo. **Estado: mayoritariamente completada.** |
| **F2 — Métrica dominante por modo** ✅ | HUD-X3 ✅, HUD-C1/C4 ✅, HUD-TA (todo) ✅, HUD-D2/D4 ✅ | El corazón de la auditoría: "cada modo, una sola métrica dominante". Héroe reutilizable + Clásico/Contrarreloj/Diario. Sub-tareas menores deferidas (C2/C3, D1/D3). |
| **F3 — Aventura adaptativa** ✅ | HUD-A1/A2/A4 ✅, A3 🟡 | Héroe por objetivo (clear/score/survive/boss) + barra; banner con etiqueta corta. |
| **F4 — Supervivencia** | HUD-S1–S8, HUD-X2 | Mayor superficie; se hace al final con el sistema de slots ya maduro. |

---

## 6. Claves i18n nuevas (ES/EN)

Se añadirán en `I18n.DICT` (game.js) conforme se implementen. Lista viva:

| Clave | ES | EN | Tarea |
|---|---|---|---|
| `coach_step` | Paso {n} de {t} | Step {n} of {t} | HUD-T3 |
| `hud_remaining` | {n} restantes | {n} left | HUD-C1 |
| `star_lost` | Estrella perdida | Star lost | HUD-C2 |
| `rec_close` | A {n} del récord | {n} to record | HUD-TA4 |
| `rec_new` | ¡Nuevo récord! | New record! | HUD-TA4 |
| `zen_release` | Liberando espacio… | Freeing space… | HUD-Z3 |
| `mult_breakdown_combo` | Combo | Combo | HUD-S4 |
| `mult_breakdown_fever` | Fiebre | Fever | HUD-S4 |
| `mult_breakdown_frenzy` | Frenesí | Frenzy | HUD-S4 |
| `mult_breakdown_total` | Total | Total | HUD-S4 |

---

## 7. QA · testing · release

**Por cada lote:**
1. `node --test 'tests/*.test.js'` (núcleo puro; el HUD no debe romper paridad i18n → el test de i18n exige claves en ambos idiomas).
2. `npx --yes eslint@9 .`.
3. Bump triple de versión (`VERSION` en game.js, `CACHE` en sw.js, dos `?v=` en index.html) — vía `tools/bump-version.sh X.Y.Z` (o a mano en Git Bash de Windows).
4. QA visual manual a **360×780, 390×844, 430×932 y desktop estrecho** (no hay entorno gráfico en CI; documentar en §9 lo verificable por lectura de código).

**Casos límite:**
- Score `9 999`, `999 999`, `12 345 678`, `1 234 567 890` (separadores, sin desbordar).
- Eventos encadenados: error + combo + cambio de oleada + recompensa (no se pisan en el dock).
- Última vida + peligro rojo + jefe inminente simultáneos (Supervivencia).
- Tablero estable: el texto del HUD no debe hacer saltar el tablero.
- Tutorial: verificar que ningún residuo de HUD (score/combo/wallet) queda visible.
- Zen: tablero lleno no muestra rojo/alarma.

**Criterios de aceptación globales:**
- Cada modo tiene **una sola métrica dominante** clara en <1 s.
- Ningún evento se solapa con vidas/oleada/tiempo/peligro/tablero.
- Información meta/no accionable **fuera** del HUD permanente.
- Contadores de peligro sustituidos por feedback ambiental donde aplica.
- Tutorial = HUD más limpio; Zen = casi sin HUD.

---

## 8. Riesgos y notas de implementación

- **`Render.hud()` es caro** y se llama por frame (coalescido vía `hudSoon`/`_hudDirty`). Cualquier lógica nueva por-modo debe evitar trabajo redundante; preferir togglear clases `body.mode-*` una vez en `start()` y que el CSS haga el resto, en vez de `if (mode===…)` por frame.
- **Retrocompat de guardados**: el HUD no toca el esquema `cv_meta`; sin riesgo de persistencia. Pero `resumeSaved()` reconstruye el HUD → probar reanudar en cada modo.
- **`reduced-fx` y `large-text`**: todo estado nuevo debe leerse por **color/jerarquía**, no solo animación; y no romper con texto grande.
- **Accesibilidad**: mantener `aria-live` en dock, `announce()` en hitos, targets táctiles ≥42 px (objetos ≥52 px alto).
- **i18n**: prohibido hardcodear strings; clave en ES+EN + `data-i18n`/`I18n.t()`.

---

## 9. Registro de progreso (bitácora)

> Formato por entrada: **[HUD-XN] Título** — fecha · versión · qué se cambió (archivos/`id`/funciones) · hallazgos · verificación.

### [HUD-T] Tutorial: HUD mínimo — 2026-07-22 · v2.20.0

**Qué se cambió:**
- `game.js` · `Coach.start()`: añadido `ModeSignals.apply('tutorial')` (antes el tutorial no aplicaba clase de modo, por eso mostraba el HUD completo). `Coach.skip()`: añadido `ModeSignals.clear()` al volver al menú. `Coach.finish()` y `skip()`: limpian `#coach-step`.
- `game.js` · `Coach._render()`: puebla `#coach-step` con `I18n.t('coach_step')` → "Paso {n} de {t}".
- `game.js` · `I18n.DICT` ES/EN: nueva clave `coach_step`.
- `index.html`: nuevo `<span class="coach-step" id="coach-step">` dentro de `#coach`.
- `styles.css`: bloque `body.mode-tutorial` que oculta `.hud-wallet`, `.event-dock`, `.obj-banner`, `.score-row`, `#combo`, `.occ`, `.booster-bar`, `.hint-fab`; estilo de `.coach-step` (chip redondeado, `:empty { display:none }`).

**Hallazgos:**
- El tutorial **no** usa `Game.start()` sino `Screens.show('game')` directo, por eso nunca pasaba por `ModeSignals.apply`. La transición de salida es segura: `play1()`→`Game.start()` (que hace `clear()`), `skip()`→`ModeSignals.clear()` explícito.
- El tablero ya enseñaba solo (halo `Render.hint`, líneas de visión); no hizo falta tocar la enseñanza.

**Verificación (Playwright, 390×844):** `body.className="mode-tutorial"`; `#coach-step`="Step 1 of 3"; `.hud-wallet/.score-row/.occ` = `display:none`; `#btn-pause` = `grid`; **0 errores de consola**. Captura confirma HUD limpio (pausa + tablero + paso + instrucción + saltar).

### [HUD-Z] Zen: tablero calmado + declutter — 2026-07-22 · v2.20.0

**Qué se cambió:**
- `game.js` · `Render.hud()`: `dl` (nivel de peligro de ocupación) se fuerza a `0` en Zen → sin clases `warn`/`danger` en `#hud-progress-fill`/`#occ-label`/`.board-wrap`, sin sonido de alarma, label permanece "Tablero".
- `game.js` · `Config.MODES.zen.onOverflow`: muestra `Toasts.show(I18n.t('zen_release'), 'info', 1400)` antes de `Game.softClear(0.45)`.
- `game.js` · `I18n.DICT` ES/EN: nueva clave `zen_release` ("Liberando espacio…" / "Freeing space…").
- `styles.css`: `body.mode-zen` oculta además `.hud-wallet` y `.occ`; nuevo `body.mode-zen .lvl-chip { display:none }`.

**Hallazgos:**
- La ocupación en Zen era engañosa (roja al 85 %) pese a que llenar el tablero solo dispara `softClear` sin derrota. Suprimir el peligro solo en Zen es un cambio de 1 línea de bajo riesgo (el resto de modos conservan su semáforo).
- Decisión pendiente (Z2): score sigue **atenuado** en vez de oculto-por-defecto; ocultarlo y re-mostrarlo al pausar/convergencia es más disruptivo y se difiere.

**Verificación (Playwright, 390×844):** con tablero al 91–95 % → `occFillWarn/Danger=false`, `boardWarn/Danger=false`, `occLabel="Board"`, `scoreOpacity=0.55`, `combo display:none`; **0 errores**. Captura confirma tablero azul calmado, sin wallet ni barra de ocupación.

### [HUD-A] Fase 3: Aventura adaptativa por objetivo — 2026-07-22 · v2.22.0

**Qué se cambió:**
- `game.js` · `Adventure.heroInfo()` (nuevo): resuelve la métrica dominante por `objective` (clear/score/survive/boss) con `{val, sub?, frac?, urgent?}`. Consumido por `Render._heroInfo()` (que ya delegaba en `Adventure.heroInfo` desde F2).
- `game.js` · `Adventure.objectiveLabel()` (nuevo): etiqueta corta estática (`objlabel_*`).
- `game.js` · `Adventure.banner()`: `#obj-goal` ahora muestra `objectiveLabel()` (estático) en vez de `objectiveText()` (vivo) → el progreso vivo vive solo en el héroe, sin duplicar.
- `game.js` · `Adventure.refreshGoal()`: solo reescribe si cambia la etiqueta (ya no por frame).
- `game.js` · `Adventure.setup()`: guarda `this.bossCrystals0 = crystalsLeft()` tras colocar cristales de jefe (referencia para la barra, que clampa ante regeneración).
- `game.js` · `I18n.DICT` ES/EN: `objlabel_clear/score/survive/boss`.

**Hallazgos:**
- El score-objetivo encaja perfecto en el héroe: `val` = "actual / target" es un número distinto de `#hud-score` crudo (que el count-up sigue animando como línea secundaria). Sin colisión.
- Jefe: los cristales pueden regenerarse (`_placeCrystals` al converger uno), por eso la barra usa `1 - min(1, n/bossCrystals0)` (clampada) en vez de un total fijo.
- Duplicación menor jefe: el banner (cara del jefe) y el héroe muestran ambos el conteo de cristales; se deja como refinamiento futuro (HUD-A3).

**Verificación (Playwright, 390×844, 0 errores):**
- clear → héroe "8" / "left", banner "Clear".
- score → héroe "6 450 / 10 000", barra 64.5 %, banner "Score".
- survive → héroe "0:26", sub "Survive", barra 18.8 %, banner "Survive".
- boss → héroe "◆ 0", sub "Boss", barra 100 %, banner "Boss".
- `node --test` 285/287, `eslint` 0 errores. Capturas confirman héroe morado (acento Aventura) + barra bajo el número.

### [HUD-X3 · HUD-C · HUD-TA · HUD-D] Fase 2: métrica dominante por modo — 2026-07-22 · v2.21.0

**Qué se cambió:**
- `index.html` · `.gscore`: nuevo bloque `#hud-hero` (`#hud-hero-val`, `#hud-hero-sub`, `#hud-hero-bar` + fill) antes de `.score-main`.
- `game.js` · `Render.hud()`: al final llama `this.hero()`. Nuevos métodos `Render.hero()` (togglea `.gscore.hero-on`, puebla val/sub/bar/urgent) y `Render._heroInfo()` (resuelve la métrica dominante):
  - `clasico` → `{val: iconCount, sub: "restantes", urgent: n≤5}`.
  - `timed` (contrarreloj) → `{val: fmtTime(timeLeft), urgent: timePressure===2}`; si `isDaily`, añade `sub` "🥉/🥈/🥇 score / umbral" y `frac` de progreso entre medalla previa y siguiente.
  - `aventura` → delega en `Adventure.heroInfo()` (aún no existe → null → score-héroe; se implementa en F3).
  - `supervivencia`/`zen` → null (manda `score-main`).
- `game.js` · convergencia (~L8660): añadido aviso "A {n} del récord" al 85 % (`State.recordNear`, una vez, solo `scoreAttack`). Nuevo flag `State.recordNear` (default + reset en `start()`).
- `game.js` · `I18n.DICT` ES/EN: `hud_remaining`, `hud_survive_sub`, `hud_boss_sub`, `rec_close`, `rec_new`, `mult_breakdown_*` (estas últimas para F4).
- `styles.css`: estilos `.hud-hero`/`.hero-val`/`.hero-sub`/`.hero-bar`/`.hero-bar-fill` + `@keyframes hero-pulse`; `.gscore.hero-on` degrada `.hud-value` (1rem) y oculta `.score-meta`; se ocultó `.time-chip` (el tiempo vive en el héroe).
- `tests/pause-redesign.test.js`: el test de "versión de shell sincronizada" se hizo **versión-agnóstico** (deriva VERSION de game.js y exige que CACHE/`?v=` coincidan) — antes fijaba 2.19.2 y rompía en cada bump.

**Hallazgos:**
- `#hud-score` sigue siendo el mismo elemento (el count-up del loop lo escribe); el héroe **no** lo sustituye, solo lo degrada por CSS → sin conflicto con la animación.
- Para el score-objetivo de Aventura (score IS el objetivo) el modelo del héroe encaja: `val` = "actual / target" (número distinto del `#hud-score` crudo), sin colisión. Se hará en F3.
- El "Mejor puntuación" permanente desaparece en modos objetivo-héroe → el récord pasa a contextual (nudge al 85 % + "¡Nuevo récord!"), justo lo que pedía la auditoría.

**Verificación (Playwright, 390×844, 0 errores):**
- Clásico: héroe "12 LEFT" azul dominante, score "0 ×1" pequeño (16px), `.score-meta` oculto.
- Contrarreloj: héroe "0:37" rosa, score "12 480" pequeño.
- Diario: héroe "0:42", sub "🥈 1 120 / 1 500", barra a 49.3 %, score pequeño.
- Supervivencia: héroe OFF, score grande (31.2px), `.score-meta` visible → **sin regresión**.
- Clásico con combo ×3 y Supervivencia con combo: mult-chip legible junto al score. `node --test` 285/287 (2 preexistentes), `eslint` 0 errores.

### [Regresión] Modos normales intactos — 2026-07-22 · v2.20.0

Secuencia `Coach.start()`→`Coach.skip()`→`Game.start('clasico')`: `body.className="mode-clasico"` (sin residuos `mode-tutorial`/`mode-zen`), `.hud-wallet`/`.score-row`/`.occ`/`.lvl-chip` todos visibles; **0 errores**. `node --test` = 285/287 (los 2 fallos son de `board-themes-redesign.test.js`, **preexistentes** al plan, verificado con `git stash`). `eslint` = 0 errores (solo warnings preexistentes de vars sin usar).
