# Plan maestro de Supervivencia — siguiente iteración (post-GM-δ)

> **Rol:** plan de mejora exhaustivo del modo Supervivencia tras el cierre de las fases GM-α…δ. Parte de una auditoría del **código real (v2.6.2, rama `clon-vanilla`)**, no solo de la documentación — porque el código ya va por delante de los docs (§1.1). Hermano de [`GAME_MODES_MASTER_PLAN.md`](./GAME_MODES_MASTER_PLAN.md) (marco, §3.5/§5/§9/§12), [`SURVIVAL_INVENTORY.md`](./SURVIVAL_INVENTORY.md) (inventario técnico), [`BALANCE_BASELINE.md`](./BALANCE_BASELINE.md) (simulación) y [`QA_PERF_PLAN.md`](./QA_PERF_PLAN.md) (presupuesto de FX móvil).
>
> **Reglas heredadas que este plan respeta en cada propuesta:** sin dark patterns (sin cuentas atrás en derrota, sin escasez falsa) · cada sistema nuevo pertenece SOLO a Supervivencia (§5 del plan de modos) · ningún número cambia sin batería antes/después de `tools/balance-sim.js` · todo FX pasa por `FX.cap` + variante `reduced-fx` · toda string nueva en ES+EN en el mismo commit.

## Índice

1. [Auditoría del estado actual](#1-auditoría-del-estado-actual)
2. [UX y feedback al jugador](#2-ux-y-feedback-al-jugador)
3. [Bucle de retención y escalabilidad infinita](#3-bucle-de-retención-y-escalabilidad-infinita)
4. [Recompensas visuales y momentos de pico](#4-recompensas-visuales-y-momentos-de-pico)
5. [Balance: cambios numéricos y validación](#5-balance-cambios-numéricos-y-validación)
6. [Roadmap por fases](#6-roadmap-por-fases)
7. [Qué NO cambiar](#7-qué-no-cambiar)
8. [Integración futura con GM-04](#8-integración-futura-con-gm-04)
9. [Riesgos y guardarraíles](#9-riesgos-y-guardarraíles)

---

# 1. Auditoría del estado actual

## 1.1 El código va por delante de los docs (deuda de verdad documental)

La rama `clon-vanilla` contiene un **rebalance de bendiciones ya implementado y SIN validar por simulación** (es el R-17 del inventario, a medio cerrar). Verificado en `game.js` v2.6.2:

| Cambio en código | Detalle | Documentado | Validado con sim |
|---|---|---|---|
| Pool de bendiciones 5 → **8** | `magnet` (raro), `score_boost` (raro), `golden_wave` (épico) — `Survival.BOONS`, game.js:2887 | ❌ (inventario dice "5, sin rareza") | ❌ |
| **Rareza y pesos** | common 45 / uncommon 35 / rare 15 / epic 5; selección ponderada sin reemplazo (`offerBoons`) | ❌ | ❌ |
| CSS de rareza en Picker | `.pick-opt.rarity-*` con acento por tier + `safe-delay` anti-mis-tap | ❌ | n/a |
| Buff de `slow` | ×1.15/2 oleadas → **×1.25/3 oleadas** (`spawnFactor`, game.js:2899) | ❌ | ❌ |
| **Kicker de monedas** oleada 15+ | `+round((w−14)^1.5 × 2)` monedas por oleada (`_waveReward`, game.js:2969) | ❌ | ❌ |
| Candados con hits + topes de bomba | `locked` 1→2 hits desde oleada 5/7/9, `BOMB_CAP` 2/2/3 | Parcial (inventario) | ❌ |

Consecuencias directas: **BAL-6 (stacking de multiplicadores) ha empeorado, no mejorado** — `golden_wave` multiplica ×3 TODO el stack y `score_boost` apila hasta +100% permanente: techo teórico pasa de ~×97 a **~×582** (game.js:4689-4690). Y la batería de `BALANCE_BASELINE.md` se detiene en v2.4.0: hoy no sabemos cuánto inflan los récords estas bendiciones. **Nada de este plan debe construirse encima hasta cerrar SV-01…SV-05 (fase α).**

## 1.2 Debilidades del diagnóstico original (§3.5): estado real tras 4 fases

| # §3.5 | Debilidad original | Estado | Evidencia |
|---|---|---|---|
| 1 | Sobrecarga cognitiva sin jerarquía | 🟡 **Parcial y en regresión** | El chip GM-16 y los anillos GM-21 la resolvieron para combo/carga/frenesí… pero las bendiciones nuevas añaden 4 estados invisibles (§1.3-N1/N2) y el chip **ya no dice la verdad** en Supervivencia |
| 2 | Carga y frenesí gemelos redundantes | 🟡 Parcial | Fusión **visual** hecha (anillos). Funcionalmente siguen siendo dos relojes pasivos que nadie gestiona; ninguna decisión los toca. Aceptable a corto plazo; SV-42 (mejoras de bendición) es la vía barata de darles gestión sin tocar su balance |
| 3 | Cero decisiones estratégicas | ✅ Resuelta en cadencia de jefe | 1 decisión cada `bossEvery` oleadas (~2,8 min en normal). Entre jefes sigue sin haber ninguna — las oleadas de élite (SV-41) añaden micro-decisión de riesgo sin nuevo sistema |
| 4 | Jefes sin anticipación ni recompensa | ✅ Resuelta | GM-18 + GM-17. Es hoy **el mejor momento del modo** (§1.4) |
| 5 | Revivir plano | ✅ Resuelta | GM-19 (120→240→480, máx 3) |
| 6 | `quake` ruido | ✅ Resuelta | GM-20 (marea); quake solo en semana del caos |
| D7 | Fin sin pico emocional | 🟡 Parcial | `#over-peak` (GM-28) existe, pero el héroe del modal sigue siendo una tabla de stats; sin contexto de récord ni historia de la run (R-18 abierto, §2.3) |

## 1.3 Debilidades NUEVAS (auditoría v2.6.2 de esta sesión)

Ordenadas por impacto. Las N1–N4 son consecuencia directa de apilar bendiciones+mutador sin cerrar el bucle de feedback.

| # | Hallazgo | Evidencia | Efecto en el jugador |
|---|---|---|---|
| N1 | **El chip de multiplicador (GM-16) miente en Supervivencia** | `Render.multChip()` calcula `combo × fiebre × temp × sprint` (game.js:1345) pero los puntos reales usan además `survMult = (1+scoreBoost) × (golden ? 3 : 1)` (game.js:4689) | El quick-win más importante del plan de modos, revertido: con Oleada Dorada activa el jugador ve ×4 y cobra ×12. D1 vuelve |
| N2 | **El build es invisible: ninguna bendición activa tiene indicador persistente** | Tras el toast de 1,8s no queda rastro de `slow` (3 oleadas), `magnet` (5 usos), `golden_wave` (2 oleadas) ni `score_boost` (permanente). Aventura SÍ muestra sus reliquias en el banner | La fantasía "poder contra caos" no se ve; el jugador olvida qué eligió y no puede jugar alrededor de su build |
| N3 | **El imán se siente como un bug** | Atrae el primer icono en orden de índice (barrido desde arriba-izquierda, game.js:4670-76), no el más cercano; sin línea de conexión visual; y **consume uso aunque no atraiga nada** (4681, fuera del `if`) | Una figura arbitraria de la otra punta del tablero desaparece sin explicación — feedback de error, no de poder |
| N4 | **Texto de `golden_wave` no coincide con su efecto** | i18n dice "próxima oleada" (game.js:417/567); el código cubre el resto de la actual + toda la siguiente (`goldenWaveWaves = 2`, decremento en `_waveReward`) | Recompensa ilegible = refuerzo desperdiciado |
| N5 | **Strings hardcodeadas solo-ES** (viola regla CLAUDE.md) | `'Imán agotado'` (4682), `'Monedas insuficientes'` (3283), `'¡Nuevo récord!'` (5390), botón `Revivir (` sin `data-i18n` (index.html:404); `'¡FEVER!'` (4664) — decidir si es marca o se traduce | Jugador EN ve español en momentos de alta emoción |
| N6 | **Confeti al llegar el jefe, no al superarlo** | `bossEvent()` lanza `FX.confetti(40)` en el mismo instante del evento (game.js:3143) | Celebra la amenaza: tono invertido. El momento "sobreviví" (1,7s después, la bendición) llega sin fanfarria propia. También hay `Haptics.milestone()` duplicado (3139+3142) |
| N7 | **Atasco de toasts en frontera de oleada** | `newWave()` puede encolar 4–5 toasts casi simultáneos: recompensa + hito 5/10 + "Oleada N" + "nuevos iconos" + récord — justo cuando además puede caer el jefe | El canal de feedback se satura en el momento de mayor carga cognitiva |
| N8 | **El lanzador es el momento peor informado del modo** | `modal-surv-diff` = título + 3 chips (index.html:410). No muestra mutador semanal, ni récord, ni qué cambia cada dificultad (vidas/ritmo/monedas) | La primera decisión de la sesión se toma a ciegas; el mutador semanal —la razón de revisita— no se ve hasta un toast de 2,4s ya en partida |
| N9 | **Mutador semanal ilegible en partida** | Solo toast inicial de 2,4s (game.js:2837). Si entras a mitad de semana o te lo pierdes, no hay forma de saber qué está activo | La variedad semanal existe pero no se percibe → no genera la conversación/ritual que buscaba GM-22 |
| N10 | **La derrota habla en la moneda equivocada** | `giveUp()` → razón "Sobreviviste {s}s" (game.js:3289); el ancla psicológica del modo es la OLEADA (récord, HUD, recompensas) | Mensaje final desalineado con la identidad; el modal tampoco dice "te quedaste a 2 de tu récord" |
| N11 | **Deuda documental** | `SURVIVAL_INVENTORY.md` §5/§11 describe el pool viejo; `MIGRATION_SPEC.md` sin kicker ni bendiciones nuevas | Cualquier próxima sesión de trabajo partirá de datos falsos |

## 1.4 Flujo de sesión: mapa de momentos

Recorrido verificado (dificultad normal): lanzador → oleadas 1–2 (sin trampas) → oleada 3+ (trampas/bombas) → **oleada 6: primer jefe (~2:20)** → ciclo acumulación/jefe cada 6 → overflow→vidas→revivir → resumen.

| Momento | Calidad de feedback | Diagnóstico |
|---|---|---|
| Lanzador | 🔴 El peor | Cero contexto (N8). Es además el único lugar natural para el rango/hazañas de §3 |
| Oleadas 1–5 | 🟡 Plano para veteranos | ~2,3 min sin ningún evento distintivo. Es onboarding correcto para nuevos; para el que vuelve cada semana es un peaje. No tocar TUNE (§7) — la válvula es dar identidad temprana barata (mutador visible N9, rango en lanzador) y variedad a partir de la 12 (SV-41) |
| Aviso 78% + bandera jefe | 🟢 Bueno | Anticipación correcta (GM-18) |
| **Jefe → bendición** | 🟢🟢 **El mejor momento del juego** | Secuencia anticipación→peligro→elección (miedo→codicia). El patrón a replicar en todo lo nuevo: **A-P-E** (Anticipación, Peligro/reto, Elección/recompensa). Único defecto: el clímax "sobreviví" no tiene beat propio (N6) |
| Frontera de oleada | 🟡 Saturada | N7: 4–5 toasts apilados |
| Última vida / overflow | 🟡 Correcto pero mudo después | `life-blast` + alivio están bien; pero el estado "estás a 1 overflow de morir" no se sostiene visualmente (EGF-08 pendiente) |
| Modal de revivir | 🟡 Brusco | Música cortada en seco (`Music.stop(true)`), botón deshabilitado sin decir cuántas monedas faltan; correcto éticamente (sin cuenta atrás — conservar) |
| Resumen | 🟡 Información sin relato | Stats completos + peak + NextActions, pero el héroe es el score (el número más ruidoso, ×582 teórico) y no la oleada; sin near-miss de récord; sin la cadena de bendiciones de la run |

**Dónde pierde el hilo el jugador:** (1) al volver de la bendición — 5 segundos después ya no hay rastro de lo elegido (N2); (2) al leer puntos con golden/x2/frenesí apilados — el chip no cuadra con los popups (N1); (3) en la frontera de oleada con jefe — toasts pisándose (N7).

---

# 2. UX y feedback al jugador

## 2.1 HUD: jerarquía e información oculta

Estado: `surv-bar` (vidas + oleada + tier + progreso + récord + bandera jefe) arriba; anillos carga/frenesí + boosters abajo; chip ×N y ghost junto al score. La fusión GM-21 dejó el HUD en 3 bloques — correcto. Problemas residuales:

1. **Información crítica oculta** (la más grave): las 4 bendiciones con estado (N2) y el `survMult` (N1). El jugador tiene MÁS estado invisible hoy que antes de GM-16.
2. **Jerarquía correcta, densidad al límite**: no añadir ningún medidor nuevo al HUD. Todo lo que este plan añade en partida son **chips pasivos de solo lectura** (build + mutador) en una única fila nueva bajo `surv-bar`, ocultable y fuera del área del tablero.
3. El `#surv-tier` ("N3") es criptico — nadie sabe qué significa "N3". Mini-fix: tooltip/`aria-label` ya existe; añadir al toast de "nuevos iconos" el dato («Tanda N3: iconos nuevos») para enseñar el vocabulario en contexto.

**SV-10 · Fila de build** (la corrección de N2): chips `icono+contador` bajo la barra de oleada — `🐌×2` (oleadas restantes), `🧲×3` (usos), `👑×1`, `📈+50%`. Aparecen solo si hay bendición con estado activa (lo instantáneo — vida, carga, pack — no genera chip: ya se ve en vidas/anillo/inventario). Espejo del patrón de reliquias de Aventura, pero contenido 100% del modo (sin violar §5: el *sistema* bendiciones ya es exclusivo; esto es su feedback). `reduced-fx`: sin animación de entrada, chips estáticos.

## 2.2 Feedback negativo que estamos dando sin darnos cuenta (casos específicos)

| Caso | Qué recibe el jugador | Corrección (tarea) |
|---|---|---|
| Confeti + haptics al CAER el jefe (N6) | "El peligro se celebra" — tono invertido | Mover confeti/fanfarria al beat "¡Superado!" previo a la bendición (SV-22) |
| Imán atrae una figura arbitraria lejana (N3) | "El juego me ha quitado una pieza / esto es un bug" | Atraer la más CERCANA al punto tocado + trazo visual reutilizando `FX.converge`; no consumir uso si no atrae (SV-03) |
| Chip ×4 mientras el popup paga ×12 (N1) | "Los números son aleatorios" | `survMult` dentro de `multChip()` y del popup (SV-04) |
| "Oleada 7" + "+14 monedas" + "¡Jefe!" en <1s (N7) | Ruido; se pierde el importante | Coreografía de toasts: fusionar recompensa+hito en uno, suprimir el toast "Oleada N" cuando esa frontera trae jefe (la bandera ya lo dice), retrasar "nuevos iconos" 1,2s (SV-13) |
| "Sobreviviste 214s" al morir (N10) | Mide en una unidad que el modo nunca usa como meta | Razón de fin en oleadas + segundos; near-miss de récord en el modal (SV-22) |
| Botón de revivir deshabilitado sin motivo | "¿Por qué no puedo?" | Sub-línea «Te faltan {n} monedas» cuando no alcanza (SV-14) |
| Corte seco de música en `lastChance()` | Sensación de error técnico, no de dramatismo | Fade-out corto (~300ms) en vez de stop; gancho de audio para QP-4 (SV-14) |
| Texto de Oleada Dorada ≠ efecto (N4) | Promesa incumplida (aunque a favor) — erosiona confianza | Copy «×3 en lo que queda de esta oleada y toda la siguiente» (SV-02) |
| Strings en español para usuarios EN (N5) | Ruptura de inmersión en momentos calientes | Barrido i18n (SV-02) |

## 2.3 Modales del modo: qué falta, qué sobra, CTA

**Lanzador (`modal-surv-diff`) — SV-12.** Falta todo el contexto (N8). Rediseño (mismo modal, sin pantalla nueva):
- **Tarjeta del mutador semanal** arriba: icono + nombre + efecto + «hasta el lunes» (`survmut_*` ya existen; añadir claves de efecto corto). Si `none`: «Semana clásica».
- **Récord por dificultad** bajo cada chip: «Récord: oleada 19» (requiere `Meta.survBestWaves = {facil, normal, dificil}` nuevo, retrocompatible; el global `survBestWave` se conserva).
- **Descriptor concreto por chip** (1 línea): «4 vidas · ritmo suave · monedas ×0.85» / «3 · estándar · ×1» / «3 · ritmo alto · ×1.3» — la elección de dificultad pasa de etiqueta a decisión informada (autonomía SDT).
- CTA único «Jugar» (hoy el tap en el chip lanza directamente — conservar si se prefiere una pulsación menos, pero entonces los chips deben parecer botones de lanzamiento, no radio buttons).
- (Tras SV-30) rango + hazañas: es la vitrina natural del Superviviente.

**Fin de partida (`modal-over`) — SV-22, aplica regla pico-final (R-18).** Sobra: nada (los stats son correctos). Falta y se reordena:
1. **Héroe = oleada, no score**: «Oleada 17» grande con contexto inmediato debajo — si récord: «¡Nuevo récord! +2 sobre tu marca» (dorado, confeti ya existente); si no: «Récord: 19 — te quedaste a 2» (near-miss ético GM-01 aplicado al modo; hoy esa información se tira).
2. **La run como relato en una línea**: fila de iconos de bendiciones elegidas en orden + «{n} jefes superados» + causa del fin. No es el registro de expedición de Aventura (ese narra ruta+reliquias de un viaje): es la "hoja de la run" del Superviviente; comparte solo el patrón visual de fila de iconos.
3. `#over-peak` (existente) queda como tercer bloque.
4. **CTA primario «Reintentar»** (misma dificultad, re-lanza directo sin pasar por el lanzador — el momento de mayor intención de reintento es ESTE); secundario «Cambiar ritmo» → lanzador. NextActions se conserva debajo.
5. Score y tabla de stats pasan a bloque compacto (siguen visibles: son la referencia de misiones/logros).

**Bendición (Picker) — SV-21.** Ya tiene rareza visual y `safe-delay`. Falta: (a) **reveal del épico**: si aparece `golden_wave`, un barrido dorado one-shot (<600ms, transform/opacity) sobre esa carta al abrir — el 5% de peso merece momento (refuerzo variable legible: EGF-10); (b) mostrar el **estado que provoca** en la descripción («🐌 ×1.25 · 3 oleadas» con los números vivos, no prosa); (c) micro-texto de contexto arriba: «Jefe superado · Oleada 12» — ancla la causa (refuerzo que no se atribuye no condiciona).

**Revivir (`modal-revive`) — SV-14.** Correcto éticamente (precio visible, sin cuenta atrás, tope 3 — **no tocar**). Mejoras: falta «te faltan {n}» cuando no alcanza (arriba); falta decir qué recibes: «1 vida + tablero despejado al 60%»; el contador «revivir {usados}/3» hace visible el tope (evita el "me estafaron" en el 4º); fade de música (arriba). CTA bien priorizado ya (revivir primario, rendirse ghost).

## 2.4 Mutador semanal legible en partida — SV-11

- **Chip 📅 persistente** en la fila de build (§2.1) mientras el mutador ≠ none: `📅❄` / `📅🌀` / `📅🔥`. Tap → toast con el texto completo `survmut_*` (re-consultable, resuelve N9).
- El lanzador ya lo anuncia (SV-12); la tarjeta del modo en el selector ya lo hace hoy — con esto el mutador se ve en los 3 puntos del ciclo: elegir → jugar → volver.
- Cuando el mutador altera un evento (semana del caos → quake), el aviso del jefe ya usa el texto específico correcto (verificado, `WARNS` game.js:3078) — sin cambio.

---

# 3. Bucle de retención y escalabilidad infinita

## 3.1 Meta-progresión exclusiva: **la Hoja de Servicio del Superviviente** (SV-30, R-31)

Fantasía: «cada run suma a mi leyenda, incluso las que pierdo». Ningún otro modo tiene acumulación vitalicia de este tipo (Clásico=mapa, Aventura=capítulo máximo, Zen=jardín, Reto=racha) — encaja en §5 sin solape.

- **Datos** (`Meta.surv`, relleno tolerante `_v` como siempre): `{ totalWaves, totalBosses, runs, feats: {id: fecha}, weekBest: {week, wave}, bestByDiff: {facil, normal, dificil} }`. Todo suma, nada caduca ni decae (aversión a pérdida, versión ética).
- **Rango del Superviviente**: título derivado de `totalWaves` acumuladas (p. ej. 0/50/150/400/900/2000 → Recluta / Explorador / Curtido / Veterano / Élite / Leyenda; ES+EN; umbrales a calibrar con el sim: oleada media × runs esperadas). Visible en el lanzador y en el resumen («+9 oleadas de servicio → Veterano: 640/900»). Es un **gradiente de meta a semanas vista** que convierte cada derrota en progreso.
- **Psicología**: progreso sin fallo posible (como el Jardín zen pero con sabor de guerra) + anchoring del récord + identidad («soy Élite en Supervivencia»). Cero economía: el rango no compra nada — es señal de maestría pura (competencia SDT); si más adelante se quiere un premio, 1 cofre por subida de rango (mismo patrón que las flores).

## 3.2 Hazañas (insignias de hito) — SV-31

~8 hazañas verificables con el estado que ya existe, persistidas en `Meta.surv.feats`, celebradas 1 sola vez (toast + medalla en el lanzador):

| ID | Hazaña | Detección |
|---|---|---|
| `impecable` | Superar un jefe sin perder vida en esa oleada | flag por oleada en `bossEvent`/`onOverflow` |
| `purista` | Llegar a oleada 10 sin usar ningún booster | contador de usos ya implícito (`inv` inicial − actual) |
| `fenix` | Batir tu récord en una run en la que reviviste | `revives > 0 && newWaveRecord` |
| `coleccionista` | Haber elegido las 8 bendiciones (vitalicio) | set acumulado en `feats` |
| `semana_completa` | Récord semanal en 3 mutadores distintos (vitalicio) | `weekBest` + id de mutador |
| `frenetico` | 3 frenesíes tier 3 en una run | contador en `activateFrenzy` |
| `al_limite` | Sobrevivir 2 oleadas completas con 1 vida | contador en `onTick` |
| `economo` | Oleada 15 sin revivir | `revives === 0 && wave >= 15` |

Las hazañas dan **objetivos ortogonales a la dificultad numérica** — exactamente la "presión que ataca la atención" que el hallazgo estructural nº1 del baseline pide (los bots no mueren; los humanos sí, por atención — dar metas de estilo, no de velocidad).

## 3.3 Récord semanal ligado al mutador — SV-32

`Meta.surv.weekBest` se resetea cada lunes **junto con el mutador** (misma `weekKey`): «Esta semana (❄ hielo): tu mejor marca, oleada 14». Se muestra en lanzador y resumen. La marca de la semana pasada no se "pierde": alimenta `semana_completa` y el rango. Razonamiento: el mutador semanal (GM-22) da variedad pero no da **meta**; el récord semanal convierte cada lunes en una carrera nueva y alcanzable (el récord absoluto se vuelve inalcanzable con el tiempo — el semanal siempre está vivo). FOMO ético: perderse una semana no rompe nada; la siguiente empieza igual para todos.

## 3.4 Pipeline de contenido barato (escalabilidad de desarrollo) — SV-40

Los tres catálogos del modo ya son casi data-driven; falta formalizarlos para que añadir contenido sea "1 entrada + 2 claves i18n + 1 test":

1. **Jefes**: extraer `Survival.BOSS_DEFS = { id: { warnKey, icon, run() } }` (hoy: if/else en `bossEvent` + tabla `WARNS` duplicada en `onTick`). Añadir `_bossOverride` (espejo de `_mutOverride`) para forzar cada jefe en sim/tests.
2. **Bendiciones**: `BOONS` ya es tabla con pesos ✅ — añadir campo opcional `upgrade` (SV-42) y estandarizar que todo efecto con duración registre su chip en la fila de build (SV-10) vía una mini-tabla `{icon, remaining()}`.
3. **Mutadores**: `WEEKLY_MUTS` ya es tabla ✅ — los efectos van por campos (`coinMult`, `frenzyDur`) y hooks existentes; documentar el contrato en MIGRATION_SPEC.
4. **Test de propiedad** (en CI): para cada jefe × bendición × mutador forzados, 20 runs de sim sin excepción y con invariantes (`iconCount ∈ [0,64]`, especiales ≤ `SPECIAL_CAP`). Es la red que permite a cualquier sesión futura añadir contenido sin re-auditar el modo.

Con esto, el coste marginal de un jefe/bendición/mutador nuevo baja a horas, y la validación es automática.

## 3.5 Anti-repetición en oleada 30+ (variedad, no solo números)

Dos mecanismos concretos, ambos reutilizando primitivas:

**SV-41 · Oleadas de élite** (variedad de REGLAS): a partir de la oleada 12, cada 4 oleadas que no toquen jefe, la oleada entra "cargada" con 1 modificador visible de una tabla (~6): «Marea baja (spawn +15%)», «Niebla de iconos (pool −2)», «Terreno minado (+2 bombas pickup)», «Escarcha (+3 hielos)», «Muro (2 candados de 2 golpes)», «Corriente (slowdown garantizado)». Telegrafiada como el jefe pero en ámbar (bandera «◆ élite» + tinte de barra); superarla (completarla sin perder vida) paga **+50% de monedas de esa oleada**. Todo son parámetros/tiles existentes; misma mecánica de pre-roll que `_planBoss`. *Justificación: aplica el patrón A-P-E a la fase de acumulación, que es donde el modo se vuelve rutina; riesgo-recompensa legible sin sistema nuevo (es la tabla de mutadores en versión micro).* Exclusiva de Supervivencia (§5).

**SV-42 · Mejoras de bendición (duplicado = upgrade)**: si en el Picker sale una bendición **con estado ya activo o ya elegida esta run**, la carta se ofrece en versión mejorada (borde de rareza +1): `slow`→5 oleadas · `pack`→+2/+2 · `magnet`→8 usos · `score_boost`→ paso +0.25 (tope igual) · `frenzy`→ duración ×1.5 · `life`→ tope +2 (solo una vez). *Justificación: mata BAL-5 (cero sinergia) creando builds reales («esta run me especializo en calma») sin añadir NI UNA bendición nueva; convierte el duplicado —hoy una decepción— en el momento de mayor codicia.* Números gated por sim (§5).

**Escalada de jefes a largo plazo** (más barato que jefes nuevos, complementario): a partir de la oleada 24, el evento sube una intensidad ya parametrizada (meteor 8→10, marea 2 filas→2 filas+2 esquinas, frost `n+2`) — el telegrafiado dice «jefe enfurecido». Solo números en `BOSS_DEFS`, gated por sim (B-S6). Los jefes genuinamente nuevos (SV-43: p. ej. `lockdown` — siembra 3 candados de 1 golpe sobre huecos clave; `eco` — repite el último jefe superado con intensidad +1, "ha vuelto a por ti") quedan detrás del registro SV-40 para costar horas y no días.

---

# 4. Recompensas visuales y momentos de pico

> **Restricción dura previa** (de `QA_PERF_PLAN.md` §3, nota FB-1): el modo sigue en ~34,7 FPS con CPU ×6 en la escena de estrés; QP-2/P2 está abierto. Por tanto TODO lo visual de esta sección: one-shot <700ms, transform/opacity-only, reutilizando keyframes existentes donde sea posible (`flash`, `confetti` gobernado, `cellPulse`, `boardEvent`), jamás una animación `infinite` nueva, y siempre con variante `reduced-fx` (los chips/textos informativos se quedan; el adorno se va).

## 4.1 El pico emocional ideal: «he sobrevivido al jefe» (SV-22)

El pico ya casi existe; falta el beat central. Secuencia completa (~20s), con los ganchos de audio para la Fase 4 (QP-4) marcados:

1. **Anticipación larga** (oleada previa, ya existe): bandera «⚠ Jefe» + tinte de barra. *Audio: la música pierde una capa — silencio dramático creciente (`Music.setIntensity` −0.15).*
2. **Anticipación aguda** (−3s, ya existe): aviso específico + haptics. *Audio: sting corto por tipo de jefe (leitmotiv de 2 notas).*
3. **Peligro** (evento, ya existe): lock + shake/FX por tipo. *Audio: impacto + silencio de 300ms.*
4. **★ NUEVO — beat «¡Superado!»** (+1,2s, si no hubo game over): micro-banner tipo `rankPop` («¡SUPERADO!», one-shot 600ms) + el confeti que HOY se dispara al caer el jefe (N6) se mueve aquí + `Haptics.record`. *Audio: fanfarria corta — el gancho más importante de la Fase 4 en este modo.*
5. **Codicia** (+1,7s, ya existe): Picker de bendición, con reveal de rareza épica (§2.3) y contexto «Jefe superado · Oleada 12».
6. **Cierre del arco** (+0,5s tras elegir): el chip del build aparece/actualiza en la fila SV-10 con un pop — el jugador VE su poder crecer. La música vuelve con la capa recuperada.

Coste: reordenar lo que ya existe + 1 banner + 2 claves i18n. Es la aplicación literal de la regla pico-final al ciclo central del modo.

## 4.2 Celebraciones de hito (tabla evento → respuesta) — SV-21 (EGF-08/09/10)

| Evento | Hoy | Respuesta propuesta (todo one-shot, reduced-fx→solo texto/color) |
|---|---|---|
| **Récord de oleada superado (en vivo)** | Toast + confeti 80 + flash | Añadir: `#surv-best-wave` pasa a estado dorado persistente («Récord: 17 ¡y subiendo!») el resto de la run — el récord batido se saborea cada segundo, no 2,2s |
| **Primera vez frenesí tier 3 (por run)** | Nada distinto de otro frenesí | Callout `rankPop` «FURIA MÁXIMA» 1 vez por run + hazaña `frenetico` si es la 3ª. NO subir partículas (presupuesto) |
| **Jefe superado sin booster en esa oleada** | Nada | Línea extra en el beat «¡Superado!»: «Sin potenciadores ✦» + progreso de hazaña `impecable`/`purista` |
| **Oleada completada** (EGF-09) | 1–2 toasts | La coreografía SV-13 la deja en UN toast compuesto («Oleada 12 ✓ · +21 🪙») + tick de audio corto (QP-4). Menos es más: la celebración grande se reserva a hitos 5/10 (ya existe, correcta) |
| **Última vida** (EGF-08) | Nada persistente | Corazón restante con pulso lento (transform/opacity, en el chip de vidas — elemento diminuto, coste ~0) + borde del tablero en `dangerBorder` SOLO si además ocupación >75% (ya existe esa señal — se le añade el caso vidas=1). Sin countdown, sin oscurecer el juego: tensión, no pánico |
| **Bendición épica en el Picker** (EGF-10) | Borde dorado estático | Barrido dorado one-shot en la carta (§2.3) + sting (QP-4) |
| **Oleada de élite superada** (con SV-41) | — | Mismo toast compuesto con «◆ élite ✓ +50%» — el patrón ya queda establecido |

## 4.3 Fin de partida memorable (pico-final aplicado al resumen) — SV-22

Diseñado en §2.3. El resumen debe contar, en este orden: **cuán lejos llegué** (oleada + distancia al récord) → **qué build llevaba** (fila de bendiciones) → **mi mejor momento** (peak GM-28) → **qué gané** (recompensas) → **volver a intentarlo** (CTA directo). El near-miss de récord es el motor del reintento inmediato: «a 2 oleadas de tu récord» convierte la derrota en asunto pendiente. Si hubo récord: el modal abre con el flash dorado ya existente y el bloque héroe en dorado — el final de la sesión ES el pico cuando hay marca nueva.

---

# 5. Balance: cambios numéricos y validación

Protocolo: batería `node tools/balance-sim.js --runs 40` antes/después de CADA ítem, comparando contra la última batería registrada en `BALANCE_BASELINE.md`; guardarraíl de medallas en CI debe seguir verde (no toca Contrarreloj, pero el stream RNG compartido puede moverse — la banda ±40% existe para eso). El sim fija `_mutOverride='none'`; para validar mutadores/jefes usar los overrides de SV-40.

| # | Cambio | Valores | Criterio de aceptación (sim) | Riesgo |
|---|---|---|---|---|
| B-S1 | **Validar el rebalance de bendiciones v2.6.x ya en código** (bloqueante, es R-17) | Pool 8 + pesos 45/35/15/5 + golden ×3 + score_boost ≤ +100% | Supervivencia skilled p50/p90 ≤ +15% vs batería v2.4.0; si falla → tabla de nerf pre-acordada: golden ×3→×2, score_boost tope 1.0→0.5, peso épico 5→4, y re-run | Alto hoy (sin datos); el bot elige 1ª opción → forzar además runs con política "greedy-boon" que elija siempre la mayor rareza para acotar el techo |
| B-S2 | **Validar el kicker de monedas 15+** (ya en código) | `+((w−14)^1.5)·2` | `coins` por run skilled ≤ +20% vs v2.4.0 (hoy ~680-690); documentar en MIGRATION_SPEC | Medio: toca economía global (cofres no, tienda sí) |
| B-S3 | Recompensa de oleada de élite (SV-41) | +50% monedas de ESA oleada si se supera sin perder vida | coins/run ≤ +10% adicional; frecuencia élite = cada 4 oleadas desde la 12 | Bajo (acotado por oleada) |
| B-S4 | Números de upgrades de bendición (SV-42) | slow 3→5 ol. · pack 2→4 · magnet 5→8 · frenzy dur ×1.5 · life tope +2 | p90 skilled ≤ +10% adicional; uptime de frenesí ≤ +15% | Medio: interactúa con B-S1 — ejecutar DESPUÉS de que B-S1 quede verde |
| B-S5 | Rango del Superviviente: umbrales | 0/50/150/400/900/2000 oleadas vitalicias (propuesta) | No es balance de partida — calibrar con `progreso` del sim (oleada 18/8min ⇒ Veterano ≈ 22 runs medias). Sin guardarraíl duro | Nulo (cosmético) |
| B-S6 | Jefes «enfurecidos» oleada 24+ | meteor 8→10 · tide +2 esquinas · frost +2 | Distribución de causa de muerte del sim sin colapso (overflow post-jefe < 60% de muertes en perfiles débiles… nota: los bots no mueren — usar como proxy `iconCount` p90 post-evento ≤ 58) | Medio; solo tras SV-40 (overrides) |
| B-S7 | (Opcional, experimento) Primer jefe en oleada 4 | `bossEvery` intacto; solo adelantar el primero | Ataca la apertura plana (§1.4) PERO toca TUNE-adyacente protegido por §9 → exige sim + playtest GM-31 y puede descartarse sin coste | Medio-alto; el último de la cola |

**No se toca** (además de §7): `TUNE` completo, cadencia bossEvery, recompensas 1/5/10, precio de revivir, fórmula base, `CHARGE_PER`, tabla de frenesí (duración/mult/tiers).

---

# 6. Roadmap por fases

Esfuerzo: 🟢 horas · 🟡 días · 🟡🟡 semana. Cada fase cierra con: tests+lint verdes, batería sim si tocó números, checklist `PLAYTEST_CHECKLIST.md` (añadiendo sección Supervivencia-2), triple bump de versión a mano (Windows), y actualización de `SURVIVAL_INVENTORY.md` + `MIGRATION_SPEC.md` + este doc.

### Fase SV-α — Verdad primero (🟢, bloqueante de todo lo demás)
> Principio QA: no construir encima de números sin validar ni de feedback que miente.
>
> ✅ **Fase completada el 2026-07-11 (v2.6.4).** Detalle en el registro al final de este documento. Hallazgo mayor no previsto: la inflación de score vs v2.4.0 venía sobre todo del refill de tablero vacío (v2.6.1, p50 +19%) y de los candados (v2.6.2, p50 +17%), no de las bendiciones (p50 ≈0, p90 +33% pre-nerf); además `offerBoons` usaba `Math.random()` y rompía el determinismo del simulador (corregido).

| ID | Tarea | Esf. | Justificación | Dep. | Guardarraíl |
|---|---|---|---|---|---|
| SV-01 | Ejecutar **B-S1 + B-S2** (validar bendiciones v2.6.x y kicker); aplicar tabla de nerf si falla; registrar batería v2.6.x en BALANCE_BASELINE | 🟢 | Regla operativa nº1 del proyecto violada por el trabajo en curso | — | El propio sim |
| SV-02 | Barrido i18n (N5) + copy de `golden_wave` (N4) | 🟢 | Regla CLAUDE.md; confianza | — | Test de claves ES/EN |
| SV-03 | Imán: más cercano + trazo visual + no consumir en vacío (N3) | 🟢 | Feedback de poder, no de bug | — | Sim: sin cambio de score p50 >2% |
| SV-04 | `survMult` en `multChip()` y popups (N1) | 🟢 | Restaura GM-16, el quick-win estrella | — | Solo lectura, sin balance |
| SV-05 | Sincronizar SURVIVAL_INVENTORY/MIGRATION_SPEC con v2.6.x (N11) | 🟢 | Ninguna sesión futura debe partir de datos falsos | SV-01 | — |

### Fase SV-β — Legibilidad del build y del ritual (🟢–🟡)
> ✅ **Fase completada el 2026-07-11 (v2.6.5).** Detalle en el registro al final. Batería de control del sim idéntica bit a bit a v2.6.4 (los cambios son UI/feedback puros, no tocan RNG ni lógica).

| ID | Tarea | Esf. | Justificación | Dep. | Guardarraíl |
|---|---|---|---|---|---|
| SV-10 | Fila de build: chips de bendiciones activas (N2) | 🟡 | Una barra, una promesa; fantasía de poder visible | SV-04 | Sin medidores nuevos; reduced-fx estático |
| SV-11 | Chip 📅 de mutador semanal en partida (N9) | 🟢 | El ritual semanal debe verse mientras se juega | SV-10 | — |
| SV-12 | Lanzador enriquecido: mutador + récord por dificultad + descriptores (N8) | 🟡 | Decisión informada (autonomía); vitrina del rango futuro | — | `Meta.survBestWaves` retrocompatible |
| SV-13 | Coreografía de toasts en frontera de oleada (N7) | 🟢 | Proteger el canal de feedback en el momento de más carga | — | — |
| SV-14 | Polish de revivir: «te faltan {n}», qué recibes, contador /3, fade de música | 🟢 | Claridad sin presión (ética intacta) | — | Prohibido añadir cuenta atrás (§12) |

### Fase SV-γ — Pico y final (🟡) — cierra R-18 y EGF-08/09/10
> ✅ **Fase completada el 2026-07-11 (v2.6.6).** Detalle en el registro al final. Batería de control del sim idéntica bit a bit a v2.6.5 (los FX/feedback no tocan RNG). perf-probe no ejecutable localmente (sin Playwright, documentado en QA_PERF_PLAN §3); cumplimiento del presupuesto verificado por revisión de la regla del design system (infinite = transform/opacity + reduced-fx; one-shot box-shadow <700ms).

| ID | Tarea | Esf. | Justificación | Dep. | Guardarraíl |
|---|---|---|---|---|---|
| SV-20 | Secuencia del pico del jefe: beat «¡Superado!», confeti movido (N6), ganchos de audio documentados para QP-4 | 🟡 | Regla pico-final en el ciclo central; A-P-E completo | SV-13 | FX one-shot <700ms; reduced-fx = solo texto |
| SV-21 | Celebraciones de hito (tabla §4.2: récord vivo, furia máxima, última vida, épica) | 🟡 | Refuerzo variable legible; tensión ética | SV-20 | Sin animaciones infinite salvo pulso del chip de vidas (elemento mínimo, en lista reduced-fx) |
| SV-22 | Modal de fin reordenado: héroe=oleada + near-miss de récord + fila de build + CTA Reintentar directo (N10) | 🟡 | Pico-final + near-miss = máximo predictor de "una más" | SV-10 | Sin monetizar la derrota (nada de ofertas aquí) |

### Fase SV-δ — La Hoja de Servicio (🟡🟡) — cierra R-31

| ID | Tarea | Esf. | Justificación | Dep. | Guardarraíl |
|---|---|---|---|---|---|
| SV-30 | `Meta.surv` + Rango del Superviviente (§3.1, B-S5) | 🟡 | Acumulación vitalicia sin decaimiento; identidad | SV-12 | Relleno tolerante `_v`; sin economía |
| SV-31 | 8 hazañas (§3.2) | 🟡 | Metas ortogonales a la velocidad (hallazgo sim nº1) | SV-30 | Cada hazaña con test unitario de detección |
| SV-32 | Récord semanal ligado al mutador (§3.3) | 🟢 | Meta viva cada lunes; el récord absoluto no compite | SV-30 | Reset solo positivo (nada se muestra como pérdida) |

### Fase SV-ε — Variedad infinita (🟡🟡) — cierra R-23/R-24

| ID | Tarea | Esf. | Justificación | Dep. | Guardarraíl |
|---|---|---|---|---|---|
| SV-40 | Registro declarativo BOSS_DEFS + overrides de test + test de propiedad (§3.4) | 🟡 | Baja el coste marginal de contenido a horas | SV-01 | CI: matriz jefes×boons×muts sin excepciones |
| SV-41 | Oleadas de élite (§3.5, B-S3) | 🟡🟡 | A-P-E en la fase de rutina; riesgo-recompensa opcional | SV-40, SV-13 | B-S3; élite jamás coincide con oleada de jefe |
| SV-42 | Mejoras de bendición duplicada (§3.5, B-S4) | 🟡 | Builds reales (mata BAL-5); duplicado→codicia | SV-01, SV-10 | B-S4 tras B-S1 verde |
| SV-43 | 1–2 jefes nuevos (`lockdown`, `eco`) + «enfurecidos» 24+ (B-S6) | 🟡 | Variedad de amenaza a coste marginal | SV-40 | B-S6; cada jefe con counterplay legible y aviso propio |
| SV-44 | Mutadores semanales 4→6 (p. ej. «marea alta»: jefes tide más frecuentes; «arsenal»: +2 boosters iniciales, monedas ×0.9) | 🟢 | Más semanas distintas con la tabla existente | SV-40 | Sim con `_mutOverride` por cada uno |

Si hay que recortar: se recorta de ε hacia α, nunca al revés — α es deuda de verdad, β/γ son percepción (el mayor valor por euro), δ/ε son crecimiento.

# 7. Qué NO cambiar (fortalezas a proteger)

1. **La tabla `TUNE` y sus 3 dificultades** — validada por uso real y protegida por §9 del plan de modos. (B-S7 es la única excepción propuesta, opcional y gated.)
2. **Estructura de recompensas 1/5/10** (monedas/gemas/cofre) — el ritmo de refuerzo variable correcto.
3. **Revivir 120→240→480, máx 3, sin cuenta atrás** — el equilibrio ético/dramático ya está bien.
4. **El ciclo jefe telegrafiado → bendición (GM-17/18)** — es el mejor momento del juego; este plan lo amplifica (SV-20), no lo altera.
5. **Anillos concéntricos (GM-21) y el HUD de 3 bloques** — no añadir medidores; solo chips pasivos.
6. **Alivio del 40% + mitad de bloques al perder vida** — piedad bien calibrada (los bots del sim la confirman como sostén).
7. **`CLEAR_ASSIST`, tabla de combos, milestones, fórmula base** — esqueleto transversal, fuera del alcance de este plan.
8. **El principio del Picker con `safe-delay` y rechazo simétrico** — cero presión en las elecciones.
9. **La dirección del rebalance de bendiciones v2.6.x** (rareza+pesos+efectos con estado): es la respuesta correcta a BAL-1…BAL-5 — lo que falta es validarla (SV-01), no revertirla.

# 8. Integración futura con GM-04 (niveles estrella, diferido)

GM-04 pertenece a Clásico (§5) y su bloqueante es el generador de puzles solventables (QP-3). Puntos de contacto reales de este plan cuando se retome:

- **El bot resolutor sin spawns** de QP-3 y los overrides/invariantes de SV-40 comparten infraestructura de sim: construir SV-40 primero deja a QP-3 la mitad del andamiaje de test hecho.
- **La tabla de modificadores de oleada de élite (SV-41)** («pool −2», «muro de candados», «terreno minado») es exactamente el vocabulario de reglas especiales que los niveles estrella necesitan («tablero prellenado, solo 4 iconos, sin spawns») — diseñar ambas tablas con el mismo formato declarativo permite reutilizar la validación.
- **El patrón A-P-E y el beat «¡Superado!»** (SV-20) aplican tal cual al momento de resolver un puzle estrella (anticipación=nodo bloqueado, peligro=intentos, elección=recompensa única).
- Contraindicación explícita: NO llevar bendiciones, élites ni rango a los niveles estrella — son de Supervivencia (§5); los puzles compiten en pureza mecánica, no en build.

# 9. Riesgos y guardarraíles

| Riesgo | Mitigación |
|---|---|
| **Construir sobre balance sin validar** (bendiciones v2.6.x) | SV-01 es bloqueante formal de TODAS las demás tareas; tabla de nerf pre-acordada para no negociar en caliente |
| **Inflación de complejidad del HUD** (el modo ya estuvo ahí) | Presupuesto duro: cero medidores nuevos; solo la fila de chips SV-10/11, oculta cuando está vacía |
| **Regresión de rendimiento móvil** (QP-2 sigue abierto: 34,7 FPS CPU ×6) | Regla §4: one-shot <700ms, transform/opacity, reutilizar keyframes; el pulso de última vida es la única excepción `infinite` (elemento mínimo + reduced-fx); re-medir con `perf-probe` tras SV-21 |
| **Deriva hacia dark patterns** (SV-14/22 tocan derrota y dinero) | Límites escritos: sin cuenta atrás en revivir, sin ofertas en el modal de fin, near-miss solo informativo, rango/hazañas/récord semanal jamás decaen ni caducan |
| **Romper partidas guardadas** | `Meta.surv`/`survBestWaves` con relleno tolerante `_v`; prohibido renombrar `survBest`/`survBestWave` |
| **El sim no ve lo que importa** (bots no mueren; boons ±1%) | Complementar cada fase con el checklist GM-31 manual; añadir política "greedy-boon" al bot (B-S1) y overrides (SV-40) para acotar techos, no para "probar diversión" |
| **IDs duplicados entre planes** (ya pasó con GM-2x) | Este plan usa el prefijo SV-xx en exclusiva; mapeo: SV-01→R-17 · SV-22→R-18 · SV-41→R-23 · SV-43→R-24 · SV-30/31/32→R-31 · SV-21→EGF-08/09/10 |
| **El documento se pudre** | Cada tarea SV-* cierra actualizando su línea en §6 con fecha y versión, igual que el registro del plan de modos |

---

# Registro de implementación

### 2026-07-11 — Fase SV-γ implementada (v2.6.6)

- **SV-20 · Pico del jefe**: `bossEvent()` ya no lanza confeti/haptics al CAER el jefe (celebraba la amenaza, N6). Nueva secuencia A-P-E: anticipación (bandera + aviso, ya existía) → peligro (evento) → **beat «¡JEFE SUPERADO!»** (`_bossSurvived()`, +1.2s vía `_bossSurvivedAt` en `onTick`, solo si sigues vivo — el jefe pudo desbordar y matarte) → codicia (bendición, +1.7s). El confeti + `rankFlash` + `Sound.record` viven ahora en el beat de superación. Gancho de audio para QP-4 documentado en el método. Eliminado el `Haptics.milestone()` duplicado.
- **SV-21 · Celebraciones de hito**: (a) **récord de oleada vivo** — al batirlo, `#surv-best-wave` pasa a estado dorado «Récord: oleada N ¡y subiendo!» el resto de la run (`_liveRecord` + `.record-live`); (b) **furia máxima** — primer frenesí tier 3 de la run dispara callout `rankFlash` «¡FURIA MÁXIMA!» una sola vez (`_frenzyT3Seen`); (c) **última vida** — `#surv-lives.last-life` con pulso lento (única animación `infinite` del modo: elemento diminuto, transform/opacity, en `reduced-fx`); (d) **reveal épico** — `.pick-opt.rarity-epic` con glow one-shot (.6s box-shadow, <700ms) + barrido dorado compositado (transform), anulados en `reduced-fx`. Además la hazaña "sin potenciadores": `_noBoosterSinceBoss` se rompe en `_applyGlobal`/`applyBoosterAt` y el beat muestra «sin potenciadores ✦» si se mantuvo.
- **SV-22 · Modal de fin reordenado** (cierra R-18): héroe `#over-hero` con la **OLEADA** como protagonista (no el score) + contexto de récord — «¡Nuevo récord de oleada!» (dorado), «A {k} de tu récord (oleada {best})» (near-miss, solo si k≤3) o «Tu récord: oleada {best}». Fila `#over-run` con la **hoja de la run**: iconos de las bendiciones elegidas en orden (`_boonLog`) + «{n} jefes superados» (`_bossesSurvived`). El badge `#over-record` deja de mostrar el récord de oleada (el héroe lo posee, sin duplicar el trofeo). El CTA «Reintentar» ya relanzaba directo con la misma dificultad (`restart()` → `start('supervivencia', diff)`), cumpliendo la regla pico-final sin cambios. Sin ofertas en la derrota (ética intacta).
- Verificación: `node --check` ✅ · suite 78/78 ✅ (+3 tests nuevos en `survival-phase.test.js`: beat programado, conteo de jefes con guarda de game-over, `_boonLog`, claves i18n) · eslint ✅ · batería sim supervivencia idéntica a v2.6.5 (control ✅) · smoke navegador vía inspección JS: reveal épico con `epicGlow`/`epicSweep`, héroe «Oleada 27 · A 2 de tu récord (oleada 29)» clase `near`, fila de run «👑🐌🧲 · 2 jefes superados». (Captura de pantalla no disponible: el capturador del pane hace timeout con las animaciones ambientales del tablero; verificación por texto/clases computadas en su lugar.)
- i18n nuevas (ES+EN): `surv_boss_cleared`, `surv_boss_cleared_clean`, `surv_frenzy_max`, `surv_wave_record_live`, `surv_over_wave_new`, `surv_over_wave_near`, `surv_over_record`, `surv_run_bosses`.

### 2026-07-11 — Fase SV-β implementada (v2.6.5)

- **SV-10/11**: nueva fila `#surv-build` bajo la `surv-bar` — chips de SOLO LECTURA con las bendiciones que tienen estado (`🐌×n` oleadas, `🧲×n` usos, `👑×n` oleadas, `📈+n%`) y el mutador semanal (`📅❄️`/`📅🌀`/`📅🔥`). Lo instantáneo (vida/carga/pack) no genera chip: ya se ve en vidas/anillo/inventario. Render con diffing por firma (`_r.build`) en `Survival.render()`; se oculta al no haber build y en `cleanup()`; tocar el chip 📅 repite el toast del mutador (N9 cerrado). CSS: `.sb-chip` con `chipPop` (en `reduced-fx` sin animación), acentos por rareza `.sb-rare`/`.sb-epic`. El build deja de ser invisible (N2).
- **SV-12**: `modal-surv-diff` enriquecido — tarjeta del mutador semanal arriba (icono + «Esta semana» + efecto, `survmut_none` nuevo para la semana clásica), récord por dificultad bajo cada chip (`Meta.survBestWaveFor(diff)` + `m.survBestWaves` retrocompatible, actualizado en `survWaveRecord`), y descriptor concreto por dificultad (`surv_diff_{diff}_d`: vidas·ritmo·monedas). La primera decisión de la sesión pasa de ciega a informada (N8). Verificado en navegador: tarjeta «Semana del hielo», récords oleada 12/19/—, descriptor «3 vidas · estándar · monedas ×1».
- **SV-13**: coreografía de toasts en `newWave`/`_waveReward` — la recompensa de monedas se FUSIONA con el toast de hito (5/10) en uno solo (antes dos pisándose); el toast «Oleada N» se SUPRIME en frontera de jefe (la bandera ⚠ y el aviso específico ya lo anuncian; se mantienen sonido y `announce`); «nuevos iconos» se retrasa 1.2s con guarda de estado/oleada. Cero consumo de RNG nuevo → batería de control idéntica (N7 cerrado).
- **SV-14**: `modal-revive` — línea «Recibes 1 vida y despeja el 60% del tablero», «Te faltan {n} monedas» (rojo) cuando el saldo no llega y el botón está deshabilitado, contador «Revivir n/3» (hace visible el tope, evita el "me estafaron" al 4º), y fade de música (`Music.stop()` en vez de `stop(true)` — el corte seco se leía como fallo técnico). Sin cuenta atrás (ética intacta). Verificado: coste 240, faltan 140, «REVIVIR 2/3», botón deshabilitado.
- Verificación: `node --check` ✅ · suite 70/70 ✅ · eslint ✅ · batería sim supervivencia idéntica a v2.6.4 (control ✅) · smoke navegador de las 4 tareas sin errores de consola.
- i18n nuevas (ES+EN): `surv_week_label`, `survmut_none`, `surv_diff_facil_d`/`normal_d`/`dificil_d`, `surv_launch_record`, `surv_launch_norecord`, `revive_gets`, `revive_count`, `revive_short`.
- Deuda i18n conocida (transversal, a QP-5): toast de tablero limpio y callouts de rango siguen hardcodeados (fuera del alcance de Supervivencia).

### 2026-07-11 — Fase SV-α implementada (v2.6.4)

- **SV-01 (B-S1/B-S2)**: bisección de la inflación por worktree (probe supervivencia·normal·skilled, 40 runs/commit): v2.4.0→v2.6.0 idéntico bit a bit (QP/FB sin efecto de balance ✅ control); refill v2.6.1 p50 +19%/p90 +35% y dead-air 85%→62%; candados v2.6.2 p50 +17%; bendiciones+kicker p50 ≈0/p90 +33% (no determinista). Se aplicó la tabla de nerf pre-acordada: `golden_wave` ×3→**×2**, `score_boost` tope 1.0→**0.5** (`SCORE_BOOST_CAP`, ahora también excluido del pool al tope), peso épico 5→**4**. `offerBoons` pasa de `Math.random()` a `RNG.random()` (dos baterías consecutivas idénticas ⇒ determinismo verificado). Batería final y evaluación de criterios en `BALANCE_BASELINE.md`: p50 +6.3% sobre pre-bendiciones ✅; p90 +23.5% ⚠️ aceptado como cola épica intencional (tabla de nerf agotada — endurecer más exige playtest/decisión de propietario); coins −10% vs v2.4.0 ✅; oleada 18/22 sin cambio ✅; guardarraíl de medallas verde sin recalibrar ✅. El baseline de Supervivencia cambia de época: los récords de score previos quedan superados estructuralmente (~+47% p50 por refill+candados); el récord de oleada no se mueve.
- **SV-02**: i18n — nuevas claves ES/EN `magnet_done`, `new_record` (sustituye 3 hardcodes), `fever_on` (FEVER se mantiene como palabra de marca en ambos idiomas), `revive_btn` (botón de `modal-revive` con `data-i18n`); `no_coins` reutilizada en `Survival.revive()`. Copy corregido: `boon_golden_wave_d` dice «esta oleada y la siguiente» y «×2» (antes prometía «próxima oleada» y «x3»); `boon_score_boost_d` explicita el tope. Deuda i18n detectada y NO abordada (transversal, va a QP-5): callouts de rango (`'¡GENIAL!'`…), toast de tablero limpio (`'Tablero limpio · …'`, `'+25% carga'`, `'+1 pista'`) y `announce()` del bonus.
- **SV-03**: el imán atrae la figura **más cercana** al toque (distancia Manhattan; antes: primera por índice — parecía un bug) y **no consume uso** si no hay nada que atraer; el rayo de conexión sale gratis al entrar la celda en `conv` antes de `FX.converge`. Toast por i18n.
- **SV-04**: `Survival.scoreMult()` centraliza `(1+scoreBoost)×(golden?2:1)`; lo comparten la fórmula de puntos, `Render.multChip()` (chip GM-16) y el popup — el chip vuelve a decir la verdad (N1). Refresh del chip al aplicar bendición y al expirar la oleada dorada.
- **SV-05**: sincronizados `MIGRATION_SPEC.md` (§2.5 topes/candados/kicker/bendiciones con tabla, §6.1 survMult, §6.8 refill documentado con su coste medido, economía de revivir), `SURVIVAL_INVENTORY.md` (catálogo de 8 con rareza, BAL-1…8 con estado, baseline v2.6.4, roadmap→SV-*) y `BALANCE_BASELINE.md` (batería v2.6.4 + bisección + criterios). Versión 2.6.2→**2.6.4** (triple bump manual). ⚠️ Se saltó el 2.6.3 a propósito: el commit `3b8eb3e` hizo el bump a medias (solo `game.js?v=2.6.3` en index.html, sin `VERSION` ni `CACHE`) y sirvió el código pre-nerf bajo ese token — reutilizarlo habría dejado a clientes con caché HTTP la versión vieja para siempre. Regla derivada: un token `?v=` usado alguna vez con otro contenido está quemado; la release siguiente debe saltárselo.
- Verificación: `node --check` ✅ · suite 70/70 ✅ (incluye guardarraíl de medallas) · eslint ✅ · smoke en navegador (chip ×N con bendiciones activas, boons por RNG seedeado, imán al más cercano) ✅.

*Creado el 2026-07-11 a partir de la auditoría de `game.js` v2.6.2 (rama `clon-vanilla`), `GAME_MODES_MASTER_PLAN.md`, `SURVIVAL_INVENTORY.md`, `BALANCE_BASELINE.md`, `ENGAGEMENT_GAME_FEEL_PLAN.md`, `QA_PERF_PLAN.md` y `DESIGN_SYSTEM.md`.*
