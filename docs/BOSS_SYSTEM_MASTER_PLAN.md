# Plan maestro del Sistema de Jefes — minijefes, jefes y encuentros

> **Rol:** plan exhaustivo para transformar el sistema de jefes de **Supervivencia** (y su pariente en **Aventura**, el otro modo con jefes) desde el modelo actual de "jefe-evento instantáneo" a un sistema de **encuentros** con minijefes y jefes: entidades con identidad, cuerpo en el tablero, puntos de vida, fases, niveles y presencia visual permanente sobre el panel de vidas/oleada/tiempo. Diseñado extrapolando los sistemas de jefes de **Enter the Gungeon** y **Hollow Knight: Silksong** (§2).
>
> **Hermano de:** [`SURVIVAL_MASTER_PLAN.md`](./SURVIVAL_MASTER_PLAN.md) (fase SV-ε, que este plan absorbe y sustituye en parte — §1.6), [`SURVIVAL_INVENTORY.md`](./SURVIVAL_INVENTORY.md), [`GAME_MODES_MASTER_PLAN.md`](./GAME_MODES_MASTER_PLAN.md) (GM-08/17/18), [`BALANCE_BASELINE.md`](./BALANCE_BASELINE.md) y [`QA_PERF_PLAN.md`](./QA_PERF_PLAN.md) (presupuesto FX móvil).
>
> **Reglas heredadas que este plan respeta en cada propuesta:** sin dark patterns · ningún número cambia sin batería antes/después de `tools/balance-sim.js` · todo FX one-shot <700ms, transform/opacity, con variante `reduced-fx` · toda string nueva en ES+EN en el mismo commit · `cv_meta` retrocompatible con relleno tolerante · triple bump manual de versión en Windows.
>
> **Estado:** ✅ **COMPLETADO (v2.6.20)** — las 6 fases JF-α…ζ implementadas, con encuentros en producción. El transcurso detallado está en la bitácora (§12). **Prerequisito de arranque de la fase visual (JF-β):** el rediseño del HUD de Supervivencia en curso ([`SURVIVAL_HUD_REDESIGN_PLAN.md`](./SURVIVAL_HUD_REDESIGN_PLAN.md), working tree v2.6.12 sin commitear) debe quedar commiteado — el banner del jefe vive en el mismo contenedor DOM.

## Índice

1. [Inventario del sistema actual](#1-inventario-del-sistema-actual-v2612)
2. [Referentes: Gungeon y Silksong extrapolados](#2-referentes-qué-resuelven-gungeon-y-silksong-y-cómo-se-extrapola)
3. [Diseño del sistema nuevo](#3-diseño-del-sistema-nuevo)
4. [Bestiario](#4-bestiario)
5. [UI/UX: la cara del jefe](#5-uiux-la-cara-del-jefe)
6. [Integración con Aventura](#6-integración-con-aventura)
7. [Cómo mejora la partida](#7-cómo-mejora-la-partida-del-usuario)
8. [Balance y validación](#8-balance-y-validación-b-j)
9. [Roadmap por fases](#9-roadmap-por-fases-jf-)
10. [Qué NO cambiar](#10-qué-no-cambiar)
11. [Riesgos y guardarraíles](#11-riesgos-y-guardarraíles)
12. [Registro de implementación (bitácora)](#12-registro-de-implementación-bitácora)

---

# 1. Inventario del sistema actual (v2.6.12)

> Auditado sobre el working tree de la rama `clon-vanilla` (v2.6.12, rediseño HUD sin commitear). Las líneas citadas corresponden a ese estado y se moverán; usar como guía de búsqueda.

## 1.1 Supervivencia: el jefe-evento

Hoy un "jefe" en Supervivencia **no es una entidad: es un efecto instantáneo** que ocurre en la frontera de oleada.

| Pieza | Dónde | Qué hace |
|---|---|---|
| Cadencia | `TUNE.bossEvery` (game.js:3271-3273) | Jefe cada 8/6/5 oleadas (fácil/normal/difícil), determinista: `wave % bossEvery === 0` |
| Registro declarativo (SV-40) | `Survival.BOSS_DEFS` (game.js:3404-3411) | 6 entradas: `meteor`, `tide`, `frost`, `lockdown` (base), `eco` (repite el último, forzado enfurecido), `quake` (solo semana del caos) |
| Selección | `_bossPool()` + `_planBoss()` (game.js:3412-3433) | Tipo elegido al azar del pool **al inicio de la oleada previa** (para que el aviso coincida); override `_bossOverride` para sim/tests |
| Telegrafiado (GM-18) | game.js:3675-3684 + bandera 4182-4186 | Bandera «⚠ Jefe» visible TODA la oleada previa + aviso específico del tipo ~3s antes (`Feedback.event('bossWarn')`) |
| Ejecución | `bossEvent()` → `_runBoss(id, enraged)` (game.js:3742-3779) | El efecto dura **1-2 segundos** (lock de input de 760-1150ms) y termina |
| Enfurecidos (SV-43) | `ENRAGE_WAVE = 24` (game.js:3399) | Desde la oleada 24 todos salen con intensidad +1 (booleano, no niveles) |
| Beat «¡SUPERADO!» (SV-20) | `_bossSurvived()` (game.js:3761-3771) | +1.2s tras el evento, si sigues vivo: toast + rankFlash + confeti + hazaña `impecable` |
| Bendición (GM-17) | `_boonAt` +1.7s (game.js:3755) | Pick 1 de 3 bendiciones — el mejor momento documentado del modo |
| Persistencia | `Meta.surv.totalBosses` (game.js:2344, 2698) | Contador vitalicio; hoja de la run en el modal de fin (game.js:6149-6161) |

**Los 5 efectos actuales** (game.js:3783-3853): `meteorRain` (8→10 spawns forzados), `tideSurge` (marca 2 filas exteriores, 1.2s después las llena; enfurecida añade columnas), `frostSurge` (congela 3+⌊oleada/4⌋ celdas), `lockdown` (siembra 3-4 candados de 1 golpe sobre huecos), `quake` (baraja el tablero con deslizamiento FLIP). `echoBoss` repite el último con intensidad +1.

## 1.2 Aventura: el nivel-jefe con comportamiento (GM-08)

El otro modo con jefes. Cada capítulo (4 niveles) termina en un **nivel-jefe** (`Adventure.isBoss`, game.js:3032): objetivo = destruir los cristales 💎 colocados (`objective: 'boss'`, game.js:3168/3190), y **cada 20 s el bioma ACTÚA** (`BOSS_MS`, game.js:3120; `bossAction()` 3134-3146, telegrafiado 3s antes): nebulosa lanza andanada, asteroide pone rocas, hielo congela, núcleo acelera spawns, vacío devora una pista, cristal se regenera. Recompensa: **reliquia de jefe** al entrar al capítulo siguiente (GM-07, game.js:6024).

Es decir: Aventura ya tiene el embrión de "jefe con PV en el tablero" (cristales = vida del jefe) + "jefe que actúa periódicamente". Supervivencia tiene lo contrario: identidad de evento pero sin cuerpo ni duración.

## 1.3 Qué comparten hoy los dos modos, y qué no

| Concepto | Supervivencia | Aventura |
|---|---|---|
| El jefe tiene nombre/identidad | 🟡 solo `bossname_*` en avisos | ❌ es "el bioma" |
| Cuerpo visible en el tablero | ❌ | ✅ cristales |
| PV / se le puede derrotar | ❌ (solo se le sobrevive) | ✅ (romper todos los cristales) |
| Actúa repetidamente durante el encuentro | ❌ (efecto único) | ✅ (cada 20s) |
| Telegrafiado | ✅ (el mejor del juego, GM-18) | 🟡 (3s antes de cada acción) |
| Recompensa al superarlo | ✅ bendición | ✅ reliquia |
| Presencia en el HUD | 🟡 bandera ⚠ pre-evento | ❌ |
| Niveles / escalado | 🟡 booleano `enraged` | 🟡 densidad por capítulo |

**Conclusión del inventario:** las piezas del sistema nuevo ya existen repartidas entre los dos modos. Este plan las unifica en un framework compartido y las eleva.

## 1.4 Infraestructura reutilizable (activos verificados)

- **Mecánica de daño sobre tile:** el cristal es un tile no-sólido; converger el icono que está encima lo destruye y puntúa (game.js:5448). Sirve tal cual como "ancla de PV" del jefe.
- **Mecánica de romper por adyacencia:** candados/rocas se agrietan al converger en celdas ortogonalmente adyacentes (game.js:3873-3888). Sirve para anclas "blindadas".
- **Registro de tiles extensible:** `Tiles` (game.js:~2914) con clases CSS por tipo; añadir `boss`/`cage` es 1 entrada + CSS.
- **Despachador de feedback (FBK-0):** `Feedback.event()` con cola de toasts, firmas de sonido/haptics/marcos por evento (`bossWarn` ya registrado, game.js:1836).
- **Render con diffing:** `Survival.render()` memoiza por firma (`this._r.*`) — patrón a seguir para el banner.
- **Overrides de sim:** `_bossOverride` / `_mutOverride` (game.js:3431/3442) + RNG seedeado + reloj virtual en `tools/balance-sim.js`.
- **Hoja de Servicio (SV-30):** `Meta.surv` con relleno tolerante — sitio natural del bestiario.
- **Ganchos de audio QP-4:** documentados en `_bossSurvived` y el aviso; el sistema de stings por jefe se cuelga ahí.

## 1.5 Diagnóstico: por qué el sistema actual se queda corto

1. **El jefe es clima, no criatura.** Dura 1-2 segundos y el jugador solo puede *encajarlo*; no hay verbo de respuesta. Toda la agencia está ANTES (despejar bordes pre-marea) y ninguna DURANTE. El mejor momento del modo (documentado en SURVIVAL_MASTER_PLAN §1.4) es en realidad el *ritual alrededor* del jefe, no el jefe.
2. **Sin identidad visual.** No hay cara, nombre en pantalla, ni presencia: la amenaza es un toast. El HUD tiene bandera de "viene algo", pero durante el evento no hay NADA que mirar salvo el tablero sacudiéndose.
3. **Sin niveles reales.** `enraged` es un booleano global por oleada ≥24; no hay progresión legible de "jefes de nivel bajo → alto" ni pools por tramo.
4. **Sin minijefes.** Entre jefes hay 5-7 oleadas de rutina documentada como "peaje" (oleadas 1-5) y "rutina" (12+). SV-41 (oleadas de élite) se diseñó para esto y nunca se implementó.
5. **Derrotar no existe.** Solo se sobrevive. No hay kill, no hay flawless por jefe (la hazaña `impecable` es vitalicia y se agota), no hay coleccionismo (¿a cuántos Nubarrones has vencido?).
6. **Aventura desaprovechada.** Su jefe SÍ tiene cuerpo y acciones, pero cero identidad ni presencia — y ningún código compartido con Supervivencia pese a ser el mismo concepto.

## 1.6 Deuda documental detectada (se salda con este plan)

El commit `e22ae3c` («Add new boss types and enraged mechanics», entre v2.6.7 y v2.6.8) implementó **SV-40** (registro `BOSS_DEFS` + overrides) y **SV-43** (`lockdown`, `eco`, enfurecidos) **sin registrar la entrada en la bitácora de `SURVIVAL_MASTER_PLAN.md`** — su fase ε figura como abierta. Estado real de la fase SV-ε: SV-40 ✅ · SV-43 ✅ · SV-41 (élites) ❌ · SV-42 (upgrades de bendición) ❌ · SV-44 (mutadores 4→6) ❌. Este plan: **absorbe SV-41** (los minijefes cumplen su objetivo con más identidad — JF-δ), **se apoya en SV-40/43** como cimiento, y **no toca** SV-42/SV-44 (siguen en el plan de Supervivencia).

---

# 2. Referentes: qué resuelven Gungeon y Silksong (y cómo se extrapola)

Convergence es un puzzle casual de tablero 8×8 donde el único verbo es **converger** (tocar una celda vacía). No hay esquivar ni moverse. La extrapolación correcta no es copiar patrones de balas o plataformeo: es traducir los **principios** que hacen memorables a esos jefes al vocabulario del tablero — espacio, orden, tipos de icono, tiles y recursos.

| # | Principio en el referente | Cómo lo resuelve el referente | Traducción a Convergence |
|---|---|---|---|
| P1 | **Pool de jefes por piso** (Gungeon: cada planta elige 1 jefe al azar entre ~3 propios) | Variedad con curva de dificultad controlada: nunca sabes CUÁL, siempre sabes CUÁNDO y de qué calibre | **Actos**: pools de jefes por tramo de oleada (§3.5). La identidad es aleatoria; la cadencia sigue siendo la de `bossEvery` — igual que Gungeon pone el jefe al final del piso, no en un momento aleatorio |
| P2 | **Tarjeta de presentación** (Gungeon: splash con nombre + epíteto; HK: título + rugido) | El jefe es ALGUIEN antes de ser un peligro; ritual de entrada | **Boss card** de ~1.1s: nombre + epíteto + nivel, con acento de color propio (§5.2) |
| P3 | **Ataques nombrados y telegrafiados que se aprenden** (Gungeon: patrones legibles; Silksong: wind-ups con tell claro y ventana de castigo) | La dificultad es de LECTURA, no de reflejos ciegos; morir enseña | Cada jefe ataca cada 10-14s con **pre-marca en el tablero 2.5s antes** (la marea ya lo hace: generalizar) + cuenta atrás en el banner (§5.3). El "castigo" es la ventana entre ataques para golpear anclas |
| P4 | **Fases que cambian el comportamiento, no solo los números** (Silksong: fase 2 = ataque nuevo; HK: arena cambia) | La pelea se re-aprende a mitad; pico de tensión | Al caer la mitad de las anclas → **fase 2**: ataque nuevo o twist del mismo (§3.4). El tablero ES la arena: el jefe la reforma |
| P5 | **El cuerpo del jefe está en la arena** (se le golpea, tiene barra de vida visible) | Feedback de progreso constante durante la pelea | **Anclas** en el tablero (tiles tipo cristal con el motivo del jefe) = sus PV; pips de vida en el banner (§3.3, §5.1) |
| P6 | **Flawless premiado** (Gungeon: Master Round = corazón extra por jefe sin daño) | Expresión de maestría opcional, no obligatoria | **Ronda maestra** por jefe derrotado sin perder vida ni usar potenciador: recompensa extra acotada (§3.8), gated por sim |
| P7 | **Minijefes que vertebran el camino** (Silksong: gatean zonas, reaparecen como enemigos normales después; Gungeon: mimics, Resourceful Rat que te roba) | Ritmo entre picos; enseñan mecánicas del jefe grande | **Minijefes** de 1 ancla y 1 mecánica en oleadas normales, aparición aleatoria con pity (§3.7). El Heraldo y la Urraca son homenajes directos |
| P8 | **Variantes soñadas / enfurecidas** (HK: Dream bosses = mismo jefe, nivel superior; Gungeon: jefes con corona en curse) | Rejugabilidad del mismo contenido a nivel mayor | `eco` + `enraged` actuales se generalizan a **Nv. I/II/III** por jefe (§3.5); «ha vuelto a por ti» sube de nivel, no solo de intensidad |
| P9 | **Identidad audiovisual por jefe** (música, silueta, paleta) | Memoria: "me mató X", no "perdí" | Nombre + icono + color de acento + sting de 2 notas por jefe (ganchos QP-4); el banner tiñe su borde (§5) |
| P10 | **Recompensa que cambia la build** (Gungeon: cofre/objeto post-jefe; Silksong: herramientas/crests) | El jefe es la puerta del poder | Ya existe (bendición GM-17 / reliquia GM-07) — **no se toca**; derrotar (vs solo sobrevivir) mejora el botín, no lo sustituye (§3.8) |

**Anti-patrones que NO se importan:** peleas obligatorias largas (aquí un encuentro dura ~2 oleadas y se resuelve solo si el jugador quiere), castigo por ignorar al jefe más allá de sus ataques normales (jugar "como hoy" sigue siendo viable — §3.2), barras de vida de esponja, y aleatoriedad del CUÁNDO del jefe grande (el telegrafiado GM-18 es la mitad del valor emocional; los referentes también fijan el cuándo y aleatorizan el cuál).

---

# 3. Diseño del sistema nuevo

## 3.1 El cambio de paradigma: de clima a criatura

> Hoy: `oleada % bossEvery === 0` → efecto de 1.5s → bendición.
> Nuevo: `oleada % bossEvery === 0` → **ENCUENTRO** de ~45-60s (≈2 oleadas) con una criatura que tiene nombre, cuerpo, vida, ataques y final — y que se ve **encima del panel de vidas/oleada/tiempo** todo el rato.

**Garantía de diseño nº1 (compatibilidad con el jugador actual):** un jugador que ignore por completo al jefe y juegue exactamente como hoy vive una experiencia equivalente a la actual — encaja los ataques (que son los efectos de hoy, con la misma cadencia de daño total esperado) y al retirarse el jefe recibe su bendición como siempre. **Derrotarlo es upside opcional**, no un requisito nuevo. Esto protege a los jugadores casuales y el balance base.

## 3.2 Anatomía de un encuentro (máquina de estados)

```
              (oleada previa completa)                    (frontera de oleada jefe)
TELEGRAFIADO ────────────────────────────▶ ENTRADA ────────────────────────────▶ ACTIVO
 bandera ⚠ + aviso específico 3s antes     boss card 1.1s + banner aparece       bucle: [pre-marca 2.5s → ATAQUE → ventana]
 (GM-18, sin cambios)                      + anclas se materializan               daño del jugador: converger sobre anclas
                                                                                        │
                        ┌───────────────────────────────┬──────────────────────────────┤
                        ▼                               ▼                              ▼
                   DERROTADO                        RETIRADA                       (muerte del jugador)
              todas las anclas rotas          endsAt alcanzado (~2 oleadas)       vidas/revivir normales;
              beat «¡DERROTADO!» + botín      beat «SUPERADO» (el actual)         el encuentro persiste
              + bendición (+ Ronda maestra    + bendición (idéntico a hoy)        tras el alivio
                si flawless)                  banner se despide en gris
```

- **Un solo encuentro activo a la vez** (jefe O minijefe, nunca ambos). Invariante duro, verificado por test de propiedad.
- El encuentro **cruza fronteras de oleada** (la oleada sigue corriendo debajo: recompensas de oleada, spawns y récords no se pausan). `endsAt = inicio + ~1.8 × waveMs` del tune activo.
- Los **ataques** usan el vocabulario existente (`meteorRain`, `tideSurge`, `frostSurge`, `lockdown`, `quake`) parametrizado por nivel y fase, más los nuevos por jefe (§4). Intensidad total esperada del encuentro ≈ intensidad del evento único de hoy (repartida en 3-4 ataques más pequeños) — validado por sim (B-J3).
- La bendición se ofrece al **cerrar** el encuentro (derrota o retirada), no a los 1.7s del estallido — el ciclo miedo→codicia se conserva, solo se estira.

## 3.3 El cuerpo en el tablero: anclas y daño

- Nuevo tile `boss` (registro `Tiles`, clase `tile-boss` + variante por jefe vía acento CSS): **no-sólido, como el cristal** — los iconos aparecen encima; **converger el icono que está sobre un ancla = 1 golpe** (misma mecánica que game.js:5448, que además ya puntúa el extra).
- **Ancla blindada** (Acto II+): primero hay que agrietarla por adyacencia (mecánica de candados, game.js:3873-3888) y luego golpearla — composición de dos mecánicas ya probadas, cero física nueva.
- PV del jefe = nº de anclas (2-4 según jefe y nivel). Las anclas se colocan al ENTRAR (celdas visibles, pulso de materialización) y respetan `SPECIAL_CAP`/`BLOCK_CAP`.
- Minijefe = **1 ancla** (a veces móvil — se recoloca a celda vecina cada X s, patrón "patrulla").
- Las anclas **no** pueden destruirse con bombas/rayo/escoba (regla B-09 ya acepta ese precedente con la cápsula): el jefe se vence jugando, no gastando. Excepción diseñada: la bomba SÍ agrieta blindaje (1 nivel), para que el arsenal siga teniendo rol.

## 3.4 Fases

- **Fase 1 → Fase 2** al caer ⌈mitad⌉ de las anclas: el banner cambia de tinte, sting corto, y el patrón de ataque **cambia** (P4: comportamiento nuevo, no solo números). Ejemplos en §4.
- Los jefes de Acto III añaden un twist de fase propio (regeneración, crecimiento, inversión).
- En `reduced-fx`: el cambio de fase se comunica por texto/color estático del banner (sin pulso).

## 3.5 Niveles (Nv. I–III) y actos (pools por tramo)

**Nivel del encuentro** — entero visible que sustituye y generaliza el booleano `enraged`:

```
nivel = 1 + ⌊oleada / 12⌋            (I en oleadas <12, II en 12-23, III en 24+)
      + 1 si es un eco («ha vuelto»)  + 1 si el Heraldo sigue vivo al llegar el jefe
      (cap: III normalmente; IV solo por acumulación eco+heraldo — «PESADILLA», raro por diseño)
```

El nivel escala parámetros ya existentes por jefe (nº de spawns del ataque, celdas congeladas, candados, anclas blindadas o no) — tabla por jefe en su entrada del registro. `ENRAGE_WAVE=24` deja de ser un caso especial: es simplemente "nivel ≥ III". El aviso «⚠ ¡Jefe ENFURECIDO inminente!» se conserva para nivel > I con eco.

**Actos** — pools de identidad por tramo de oleada (P1), de más bajos a más altos como pide todo el sistema:

| Acto | Oleadas | Pool de jefes | Pool de minijefes | Sabor |
|---|---|---|---|---|
| **I — La Intemperie** | hasta 11 | Nubarrón · La Corriente · Boreal | Urraca · Luciérnaga Dorada | Amenazas de clima puro, counterplay evidente |
| **II — El Asedio** | 12-23 | Cerrajero · Tectónico (+ los de Acto I a Nv. II) | Centinela · Heraldo (+ los de Acto I) | El tablero mismo se vuelve hostil; roba recursos |
| **III — La Corte Profunda** | 24+ | Cristálido · El Vacío · Titiritero (+ cualquiera anterior a Nv. III) | los anteriores a nivel alto | Twists mentales; regeneración, crecimiento, inversión |

Reglas del pool: sin repetición inmediata (el último jefe real sale del sorteo salvo vía `eco`), pesos uniformes dentro del acto, los jefes de actos anteriores permanecen disponibles a nivel superior (P8: el Nubarrón a Nv. III es contenido nuevo gratis). La semana del caos (mutador GM-22) mantiene su regla: promueve a Tectónico (quake) al pool desde el Acto I.

## 3.6 Aleatoriedad: qué es aleatorio y qué no (decisión de diseño)

La petición es «su aparición es aleatoria». Se implementa así, y por estas razones:

- **Aleatorio — la identidad del jefe:** cuál sale se sortea del pool del acto (ya es así con 4-6 tipos; crece a bestiario completo con actos). Es el modelo exacto de Gungeon: piso fijo, jefe sorteado.
- **Aleatorio — los minijefes, también en el cuándo:** probabilidad por oleada no-jefe (§3.7), con pity timer. Aquí sí hay sorpresa temporal, porque su escala no necesita preparación ritual.
- **Determinista — el CUÁNDO del jefe grande:** se mantiene `wave % bossEvery === 0`. El telegrafiado GM-18 («la anticipación es la mitad del valor emocional») depende de saberlo 1 oleada antes; la tabla `TUNE` está protegida por §9 del plan de modos; y los propios referentes fijan el cuándo. Aleatorizar el momento del jefe grande destruiría el mejor ritual del modo para ganar una sorpresa que los minijefes ya aportan.

## 3.7 Minijefes: runtime propio

- **Cuándo:** en cada frontera de oleada no-jefe y no-previa-a-jefe (para no pisar el telegrafiado), desde la oleada 3: `p = 0.22` de que esa oleada traiga minijefe; **pity**: garantizado si han pasado 4 oleadas elegibles sin ninguno; nunca 2 seguidos; nunca con un encuentro activo.
- **Escala:** 1 ancla, 1 mecánica, duración ≤ 1 oleada (si no lo matas, se va él solo — sin beat grande, se despide del banner). Aviso corto 2s antes («algo se acerca…», genérico — el minijefe NO se telegrafía con bandera: es la sorpresa del sistema).
- **Los minijefes enseñan al jefe** (P7): cada uno usa una mecánica-semilla de un jefe de su acto o superior (la Urraca roba como la Urraca Real variante del Cerrajero; el Centinela ancla filas como La Corriente). El jugador aprende el vocabulario en versión pequeña.
- **Recompensa al matarlo:** su efecto-firma (tabla §4.3) + monedas pequeñas. Al escapar: nada (sin castigo — la presión ya la puso él).

## 3.8 Recompensas: derrotar ≥ sobrevivir (nunca menos que hoy)

| Resultado | Recompensa | Nota de balance |
|---|---|---|
| **Retirada** (sobrevivir, = hoy) | Bendición pick 1/3 (idéntico a hoy) + beat «SUPERADO» | Línea base intocable: nadie pierde nada respecto al sistema actual |
| **Derrotado** | Bendición + **botín del jefe**: monedas `8 + 4×nivel` + entrada de bestiario (kill) + FX propio de colapso | Gated B-J1 (≤ +10% monedas/run esperadas) |
| **Ronda maestra** (derrotado sin perder vida NI usar potenciador en el encuentro) | Botín + **+1 vida** (respetando tope MAX+1; si al tope: +50 carga) + sello ✦ en bestiario | Homenaje directo a Gungeon (P6); reutiliza `_noBoosterSinceBoss` y `_livesLostThisWave` ya existentes |
| **Minijefe muerto** | Efecto-firma + `3+nivel` monedas | Acotado, B-J4 |
| **Minijefe escapado** | — | — |

Las hazañas existentes (`impecable`) no cambian; se añaden 3 nuevas sobre el bestiario (JF-44).

---

# 4. Bestiario

> Criterios de diseño de cada entrada: (1) TODO efecto es visible en el tablero — nada pasa "en los números" sin marca espacial; (2) counterplay enunciable en una frase; (3) es impedimento, bonus o mixto — el sistema también da jefes "buenos" que premian gestionarlos; (4) coste marginal bajo: cada uno = 1 entrada de registro + claves i18n + test (pipeline SV-40).

## 4.1 Los Cinco Señores (los efectos actuales, re-encarnados como jefes con cuerpo)

Los 5 efectos de hoy pasan a ser los ataques-firma de 5 jefes con nombre. Cero contenido se tira: se le pone cara.

| Jefe (epíteto) | Acto | Anclas | Ataque fase 1 (cada ~12s) | Fase 2 (≤mitad de anclas) | Counterplay | Al derrotarlo |
|---|---|---|---|---|---|---|
| **NUBARRÓN** — el cielo a pedazos (`meteor`) | I | 3 | Lluvia: 4-6 spawns forzados (pre-marca las celdas destino 2.5s) | Lluvia + 1 roca en el centro de la zona marcada | Despeja las zonas marcadas antes del impacto | Limpia el 15% del tablero (el cielo escampa) |
| **LA CORRIENTE** — señora de los bordes (`tide`) | I | 3 (en el anillo exterior) | Marea: llena media banda exterior (pre-marca, como hoy) | Marea completa: anillo entero | Mantén los bordes despejados; sus anclas VIVEN ahí — matarla exige jugar donde ataca | Vacía las 2 filas exteriores |
| **BOREAL** — el aliento blanco (`frost`) | I | 2 | Escarcha: congela 3+nivel iconos dispersos | Congela un clúster 2×2 compacto | Rompe hielos pronto (+2 carga c/u ya existe, B-06) | Descongela todo + 25 de carga |
| **EL CERRAJERO** — guardián de candados (`lockdown`) | II | 3 (1 blindada) | Cierre: siembra 2-3 candados de 1 golpe | **Roba 1 potenciador** y lo enjaula en un tile `cage` visible — romper la jaula (adyacencia) lo devuelve | Convergencias adyacentes rompen candados y jaulas | Devuelve lo enjaulado ×2 (el robado + 1 regalo) |
| **TECTÓNICO** — el que baraja el mundo (`quake`) | II (Acto I en semana del caos) | 3 | Terremoto parcial: baraja 2 filas (deslizamiento FLIP ya existente) | Terremoto total + 2 rocas | Memoriza clústeres antes del temblor; convergencias grandes ANTES del ataque | Ordena 8 iconos: agrupa pares adyacentes (regalo de combo) |

## 4.2 Jefes nuevos — Acto III, La Corte Profunda

| Jefe (epíteto) | Anclas | Ataque fase 1 | Fase 2 (twist propio) | Counterplay | Al derrotarlo |
|---|---|---|---|---|---|
| **CRISTÁLIDO** — el corazón que rebrota | 4 | Esquirlas: 3 spawns + 1 cristal normal (puntúa, pero ocupa) | **Regenera 1 ancla cada 12s** si no están todas rotas — hay que rematarlo con tempo (mecánica ya escrita en Aventura: `advboss_crystal`) | Concentra el daño en ráfaga; el frenesí es tu ventana | Todos los cristales del tablero estallan en puntos |
| **EL VACÍO** — la boca paciente | 2 (celdas de vacío) | Devora 1 icono adyacente a cada ancla (se lo TRAGA, animación hacia el ancla) | **Crece**: +1 ancla nueva (cap 4) — el vacío se extiende si lo ignoras | Priorízalo: es el único jefe que empeora con el tiempo | Colapsa: convergencia en cadena gratis de los iconos que devoró (los devuelve agrupados) |
| **EL TITIRITERO** — amo de los hilos | 3 | Enhebra: marca 2 TIPOS de icono con hilos visibles (overlay). Converger tipos marcados **le cura 1 ancla**; los demás le dañan normal | Re-enhebra otros 2 tipos + 1 candado | Inversión mental: juega los tipos libres, purga los marcados con bombas (las bombas ignoran la curación) | Corta hilos: los tipos marcados convergen solos (mini-cascada) |

## 4.3 Minijefes

| Minijefe | Acto | Mecánica visible (mientras vive) | Counterplay | Al matarlo (efecto-firma) | Semilla de |
|---|---|---|---|---|---|
| **LA URRACA** — la ladrona | I | Se posa (1 ancla); cada 7s **roba 1 icono** del tablero y lo guarda bajo su celda (contador visible ×n) | 3 golpes de adyacencia o converger encima | Devuelve TODO lo robado agrupado junto a su celda (convergencia servida) + monedas | Cerrajero/Urraca Real |
| **LUCIÉRNAGA DORADA** — la fugaz *(minijefe-BONUS)* | I | Vaga 1 celda cada 3s (ancla móvil, estela dorada); no ataca; se va a los 15s | Converger el icono donde se posa | Toque dorado: esa convergencia ×2 + 20 de frenesí | (recompensa pura: P6 en pequeño) |
| **EL CENTINELA** — el vigía | II | Ancla-candado que patrulla 1 celda por oleada; su fila y columna spawnnean +25% más rápido (tinte visible en fila/columna) | 2 golpes de adyacencia (blindado ligero) | Limpia su fila y columna | La Corriente/Cerrajero |
| **EL HERALDO** — el que anuncia | II | Aparece SOLO en la oleada previa a jefe (sustituye al aviso genérico): si vive cuando llega el jefe, **el jefe entra a nivel +1**; el banner lo dice | Mátalo antes de la frontera (3 golpes) | El jefe entra a nivel −1 (mín. I) + aviso «el heraldo ha caído» | El ritual pre-jefe se vuelve jugable (P7) |

**Banquillo** (diseñados, no planificados — entran por el pipeline cuando toque contenido nuevo): Polilla Boreal (congela 1/8s; al morir descongela todo), El Topo (intercambia 2 iconos/9s; al morir deja 2 portales), Sanguijuela (combo window −25%; al morir +30 frenesí), El Mímico (icono disfrazado con shimmer; converger sin identificarlo = ráfaga de spawns, identificarlo = botín).

## 4.4 Sistema de retorno («ha vuelto a por ti»)

`eco` deja de ser un tipo de jefe y pasa a ser **regla del sorteo**: 15% de los sorteos de jefe (si hay un derrotado/sobrevivido previo esta run) devuelven al último jefe real a **nivel +1** con el aviso actual `surv_eco`. Un eco derrotado cuenta doble en el bestiario. Los strings y la lógica actual (game.js:3849-3853) se reutilizan tal cual.

---

# 5. UI/UX: la cara del jefe

## 5.1 El banner del jefe — encima del panel de vidas/oleada/tiempo

Requisito del propietario: el jefe debe aparecer visualmente **en la parte superior del contenedor de vidas, oleadas y tiempo** — es decir, primera fila DENTRO de `#surv-bar` (index.html:218), encima de `.surv-grid`:

```html
<div class="surv-bar" id="surv-bar" hidden>
  <div class="surv-boss" id="surv-boss" hidden>                    <!-- NUEVO: solo visible en encuentro -->
    <span class="sbx-portrait" id="surv-boss-icon"></span>          <!-- icono v2 con --icv2-url + tinte acento del jefe -->
    <div class="sbx-mid">
      <span class="sbx-name" id="surv-boss-name">NUBARRÓN <i class="sbx-lvl">Nv. II</i></span>
      <span class="sbx-hp" id="surv-boss-hp" aria-label="Vida del jefe">◆◆◇</span>   <!-- pips = anclas -->
    </div>
    <span class="sbx-next" id="surv-boss-next">🌩 3s</span>          <!-- próximo ataque (cuenta atrás) -->
  </div>
  <div class="surv-grid"> … vidas · oleada · tiempo … </div>
  <div class="surv-subrow"> … </div>
  <div class="surv-build"> … </div>
</div>
```

- **Altura presupuestada:** ~32px, SOLO durante encuentros. Para no crecer el panel en móviles ≤380px, mientras el banner está visible la `surv-subrow` (récord/próximo evento) se colapsa — el banner ES el "próximo evento". Fuera de encuentros: `hidden`, coste cero.
- **Estados visuales:** entrada (pop one-shot), fase 2 (cambio de tinte + sting), nivel ≥III/eco (borde rojizo estático — no pulso infinite), derrotado (colapso 500ms), retirada (desvanecido gris 400ms). Todo transform/opacity.
- **Render:** dentro de `Survival.render()` con firma diffing (`this._r.boss = id|phase|hp|next`) — máx. 1 escritura DOM por cambio, como el resto del panel. La cuenta atrás `sbx-next` se actualiza con granularidad de 1s (no por frame).
- **Relación con la bandera ⚠ (GM-18):** la bandera sigue siendo el PRE (oleada previa); el banner es el DURANTE. Nunca coexisten: al entrar el jefe, la bandera se apaga y el banner se enciende — relevo limpio.
- El contenedor recibe `#surv-bar.encounter` para el tinte de borde que hoy da `boss-soon` (game.js:4185), reutilizando ese patrón.

## 5.2 Tarjeta de presentación (boss card)

Franja horizontal sobre el tablero (no modal, no bloquea más allá del lock de entrada ya existente de ~900ms): **nombre grande + epíteto + Nv.**, con el acento del jefe, ~1.1s y salida sola. Reutiliza el patrón `rankFlash` (game.js:3768) con una variante de dos líneas. En `reduced-fx`: no hay card; el banner aparece directamente (la información nunca se pierde, solo el adorno). Minijefes NO tienen card (solo banner compacto) — la jerarquía visual distingue calibres (P2).

## 5.3 Telegrafiado de ataques (durante el encuentro)

Generaliza lo que la marea ya hace (game.js:3789: `cellPulse('tide-warn')` 1.2s antes):

1. El banner muestra el ataque entrante y su cuenta atrás («🌩 en 3s»).
2. **2.5s antes**, las celdas objetivo se pre-marcan en el tablero (`cellPulse` con la clase del jefe).
3. El ataque ejecuta con su lock breve (760-1150ms, como hoy).
4. Ventana de castigo: ~8-10s libres para golpear anclas antes del siguiente.

Accesibilidad: cada ataque se `announce()` («Nubarrón prepara Lluvia»); `aria-live=polite` en `sbx-next` está prohibido (spamearía) — se anuncia solo el evento, no la cuenta.

## 5.4 Beats de resolución

- **DERROTADO:** nuevo beat (hermano del «¡SUPERADO!» SV-20): rankFlash «¡{JEFE} DERROTADO!» + colapso de anclas en cadena + confeti (presupuesto actual, sin subirlo) + sting. Luego bendición a +1.7s como siempre.
- **RETIRADA:** exactamente el beat «¡SUPERADO!» actual (game.js:3761-3771) — sin cambios, es la línea base.
- **RONDA MAESTRA:** línea extra dorada en el beat («Ronda maestra ✦ +1 vida») — reutiliza el slot del «sin potenciadores ✦» actual.
- Ganchos de audio QP-4: sting de entrada por jefe (leitmotiv 2 notas sobre `Sound`), impacto de fase, fanfarria de derrota (la de superación ya está hookeada).

## 5.5 i18n, reduced-fx, a11y

- Claves por jefe: `bossdex_{id}` (nombre), `bossdex_{id}_e` (epíteto), `bossdex_{id}_atk1/_atk2` (nombres de ataque para banner/announce), + minijefes `minidex_*`. ES+EN en el mismo commit (regla CLAUDE.md). Las claves existentes `bossname_*`/`surv_boss_*_warn` se conservan y remapean.
- `reduced-fx`: sin card, sin pulsos; banner estático con texto/color; pre-marcas de celdas se mantienen (son información, no adorno) pero sin animación (borde estático).
- Lector de pantalla: entrada («Jefe: Nubarrón, nivel 2, 3 anclas»), fase, resolución — vía `announce()` ya existente.

## 5.6 Presupuesto de rendimiento (QP-2 sigue abierto: ~34.7 FPS CPU×6)

Prohibido: animaciones `infinite` nuevas (el borde de nivel III es estático), partículas extra sobre el cap actual, box-shadow animado >700ms. El banner escribe DOM solo en cambio de firma + 1 tick/s de cuenta atrás. Las anclas usan el pipeline de tiles existente (`Render.syncCell`). Re-medir con `tools/perf-probe.js` tras JF-β y JF-γ (escena: encuentro fase 2 + frenesí + tablero 80%).

---

# 6. Integración con Aventura

Aventura ya es un encuentro (cristales=PV, acción cada 20s) sin identidad. El adaptador (fase JF-ζ) le da la misma cara con coste mínimo y **cero cambio de balance**:

- Los 6 jefes de bioma reciben **nombre y entrada de registro** (mismo `Bosses.DEX`, flag `mode:'aventura'`): p. ej. Corazón de Nebulosa, El Magnetar (asteroide), Aurora Hambrienta (hielo), El Fundidor (núcleo), La Nada (vacío), Matriarca Cristal (crystal). Sus ataques SON los `bossAction` actuales (game.js:3134-3146), sin tocar números.
- El **banner** se monta sobre el `obj-banner` existente (index.html:216) en niveles jefe: retrato + nombre + cristales restantes como pips (dato que ya se muestra en texto) + cuenta del próximo ataque (`BOSS_MS` ya existe).
- **Boss card** al entrar al nivel jefe (reutiliza el prelevel ya existente como ancla temporal).
- Fases: con ≤2 cristales restantes, `BOSS_MS` efectivo 20s→15s (única variación mecánica, gated por sim en modo aventura — si el sim no cubre aventura aún, se pospone y JF-ζ queda 100% presentacional).
- Los minijefes y las anclas de Supervivencia NO van a Aventura (regla §5 del plan de modos: cada sistema pertenece a un modo; lo compartido es el framework y la presentación).

---

# 7. Cómo mejora la partida del usuario

| Dolor documentado | Mecanismo de este plan | Efecto esperado en la partida |
|---|---|---|
| «El jefe es el mejor momento del modo… y dura 2 segundos» (SURVIVAL_MASTER_PLAN §1.4) | Encuentro de 45-60s con arco A-P-E completo y verbo de respuesta (golpear anclas) | El pico emocional pasa de 1 beat a un ciclo con tensión sostenida; de "me pasó algo" a "vencí a alguien" |
| Oleadas 1-5 «peaje» y 12+ «rutina» (§1.4); SV-41 nunca implementada | Minijefes aleatorios con pity (§3.7) | La fase de acumulación gana sorpresa y micro-decisiones sin tocar TUNE; cada run tiene textura distinta |
| Cero agencia DURANTE el peligro (solo antes) | Anclas + ventana de castigo entre ataques telegrafiados | Competencia (SDT): el jugador puede elegir pelear; el casual puede seguir ignorándolo (§3.1, garantía nº1) |
| La amenaza no tiene cara (toast + sacudida) | Banner sobre vidas/oleada/tiempo + boss card + acento/sting por jefe (P2/P9) | Legibilidad e identidad: «me mató el Titiritero en fase 2» es una historia; «perdí en la oleada 18» es un dato |
| `enraged` binario; escalado tardío solo numérico | Niveles I-III visibles + actos con pools + retornos eco a nivel+1 (P1/P8) | Progresión "de más bajos a más altos" legible; contenido de Acto III da razón para empujar récords |
| Derrotar no existe; maestría sin expresión por-jefe | Kill opcional + Ronda maestra (P6) + bestiario con sellos | Refuerzo variable legible y coleccionismo ético (nada caduca); el mejor jugador tiene algo que demostrar cada encuentro |
| Aventura: jefe sin identidad pese a tener la mecánica | Adaptador JF-ζ (nombres, banner, card) | Coherencia entre modos; el vocabulario aprendido en un modo se reconoce en el otro |
| Hoja de Servicio sin dimensión de jefes | Bestiario en `Meta.surv.bossDex` + 3 hazañas | Meta a semanas vista: ver/derrotar/perfeccionar cada entrada del bestiario |

**Forma de la sesión resultante** (normal, `bossEvery=6`): oleadas 1-2 calma → minijefe sorpresa (~ol. 3-5) → telegrafiado + Heraldo (Acto II+) → ENCUENTRO (ol. 6-7) → bendición → acumulación con minijefe → encuentro Nv. superior… La curva de tensión pasa de dientes de sierra aislados a ondas solapadas — exactamente el pacing por capas de los referentes.

---

# 8. Balance y validación (B-J*)

Protocolo heredado: batería `node tools/balance-sim.js --runs 40` antes/después de CADA ítem contra `BALANCE_BASELINE.md` (baseline vigente v2.6.4); guardarraíl de medallas en CI verde; overrides por jefe (`_bossOverride` se extiende a `{id, nivel}`).

| # | Cambio | Criterio de aceptación (sim) | Riesgo |
|---|---|---|---|
| B-J1 | Botín de derrota + Ronda maestra | Monedas/run skilled ≤ +10% vs baseline; vidas medias en ol. 15 ≤ +0.4 | Medio: la vida de Ronda maestra es lo más caliente — si infla, degradar a +50 carga |
| B-J2 | Bot «boss-aware» en el sim (política: prioriza celdas-ancla con p=0.7 skilled / 0.35 average / 0.1 casual cuando hay encuentro) | Kill-rate emergente razonable (skilled Acto I ≥70%, casual ≤25%); sin esto el sim no ve el sistema | Bloqueante de todo lo demás: sin bot que golpee anclas, ningún criterio B-J* mide nada |
| B-J3 | Intensidad de encuentro ≈ evento actual (3-4 ataques pequeños ≈ 1 grande) | `iconCount` p90 post-encuentro ≤ 58 (mismo proxy que B-S6); oleada alcanzada p50 sin cambio ±1; dead-air no peor | Alto: es el corazón del rebalance — iterar por jefe |
| B-J4 | Frecuencia/recompensa de minijefes (p=0.22, pity 4) | Monedas/run ≤ +8% adicional; ≥1 minijefe por run p50; ≤4 p90 | Bajo (acotado) |
| B-J5 | Escalado por nivel (tabla por jefe) | Por cada jefe × nivel: 20 runs forzadas sin excepción; `iconCount` p90 post-ataque ≤ 58; muerte-por-overflow en la oleada del encuentro < 60% en perfil average | Medio |
| B-J6 | Aventura fase (BOSS_MS 20→15 con ≤2 cristales) | Win-rate de niveles jefe de bots sin cambio >5%; si el sim no cubre aventura: posponer (JF-ζ queda presentacional) | Bajo |
| B-J7 | Test de propiedad en CI (matriz jefes × niveles × mutadores + minijefes) | Invariantes: `iconCount ∈ [0,64]`, especiales ≤ caps, **un solo encuentro activo**, todo encuentro termina (derrota/retirada/gameover), anclas nunca sobre tiles previos | — (es la red del pipeline) |

**No se toca sin excepción aprobada:** `TUNE` completo (incluido `bossEvery`), recompensas de oleada 1/5/10, precio de revivir, bendiciones (pool/pesos/efectos — B-S1 ya validado), fórmula de score, `CLEAR_ASSIST`.

---

# 9. Roadmap por fases (JF-*)

Esfuerzo: 🟢 horas · 🟡 días · 🟡🟡 semana. Cada fase cierra con: tests+lint verdes, batería sim si tocó números, `PLAYTEST_CHECKLIST.md` (sección nueva «Jefes»), triple bump manual, y actualización de **este doc (§12)** + `SURVIVAL_INVENTORY.md` + `MIGRATION_SPEC.md`.

### Fase JF-α — Cimientos (🟡🟡, bloqueante de todo)
> El framework sin apariencia: registro, runtime, daño, niveles, sim. Al cerrar α el juego se comporta EXACTAMENTE igual que hoy para el jugador (flag interno `Bosses.ENCOUNTERS=false` hasta JF-γ) — α solo prepara.

| ID | Tarea | Esf. | Dep. | Guardarraíl |
|---|---|---|---|---|
| JF-01 | Módulo `Bosses`: registro `DEX` (metadata: acto, anclas, ataques, escalado por nivel, i18n keys, acento) + runtime `Encounter` (FSM §3.2: telegrafiado→entrada→activo→derrota/retirada) montado sobre los hooks `onTick`/`newWave` de Survival. `BOSS_DEFS` actual migra a `DEX` conservando ids y `_bossOverride` | 🟡🟡 | — | Suite actual verde sin cambios de comportamiento (flag off) |
| JF-02 | Tiles `boss` (no-sólido, golpe por convergencia encima — vía game.js:5448) y `cage`; variante blindada (agrieta por adyacencia — game.js:3873); regla «bombas no destruyen anclas, sí agrietan» | 🟡 | JF-01 | Caps `SPECIAL_CAP`/`BLOCK_CAP` respetados; test unitario por mecánica |
| JF-03 | Niveles (fórmula §3.5) + actos/pools + no-repetición + eco como regla de sorteo (§4.4) | 🟢 | JF-01 | `ENRAGE_WAVE` remapeado sin cambiar comportamiento actual |
| JF-04 | Sim: bot boss-aware (B-J2) + override `{id, nivel}` + test de propiedad B-J7 en CI | 🟡 | JF-01/02 | Batería de control idéntica con flag off |
| JF-05 | Contrato documentado en `MIGRATION_SPEC.md` (esquema DEX, FSM, fórmulas) | 🟢 | JF-01..04 | — |

### Fase JF-β — La cara del jefe (🟡) — requiere HUD v2.6.12 commiteado
| ID | Tarea | Esf. | Dep. | Guardarraíl |
|---|---|---|---|---|
| JF-10 | Banner `#surv-boss` (§5.1): DOM + CSS + render diffing + colapso de subrow en móvil + relevo con bandera ⚠ | 🟡 | JF-01 | ≤32px; hidden fuera de encuentro; 1 escritura DOM por cambio |
| JF-11 | Boss card (§5.2) sobre patrón `rankFlash`; sin card en `reduced-fx` y para minijefes | 🟢 | JF-10 | One-shot ≤1.2s, transform/opacity |
| JF-12 | Telegrafiado de ataque: cuenta atrás en banner + pre-marca de celdas generalizada (patrón tide) + `announce()` | 🟡 | JF-10 | Sin `aria-live` en la cuenta; tick 1s |
| JF-13 | Beats: DERROTADO + Ronda maestra + retirada (reusa SV-20); ganchos de audio QP-4 (sting por jefe, fase, derrota) | 🟢 | JF-10 | Confeti dentro del cap actual |
| JF-14 | Barrido i18n (bossdex/minidex ES+EN) + a11y + `reduced-fx` completo | 🟢 | JF-10..13 | Test de paridad de claves |

### Fase JF-γ — Los Cinco Señores (🟡🟡) — aquí se enciende el sistema
| ID | Tarea | Esf. | Dep. | Guardarraíl |
|---|---|---|---|---|
| JF-20..24 | Nubarrón, La Corriente, Boreal, Cerrajero (+jaula), Tectónico — cada uno: entrada DEX + ataques por fase + counterplay + efecto de derrota (§4.1). Flag `ENCOUNTERS=on` al cerrar los 5 | 🟡🟡 | JF-α/β | B-J3 por jefe; B-J1 al activar botín |
| JF-25 | Retornos eco a nivel+1 + aviso enfurecido remapeado | 🟢 | JF-20..24 | B-J5 |
| JF-26 | Playtest GM-31 + perf-probe del encuentro (§5.6) + registro batería en BALANCE_BASELINE | 🟢 | JF-20..25 | FPS no peor que baseline QP-2 |

### Fase JF-δ — Minijefes (🟡🟡)
| ID | Tarea | Esf. | Dep. | Guardarraíl |
|---|---|---|---|---|
| JF-30 | Runtime de minijefes: sorteo p=0.22 + pity 4 + exclusiones (§3.7) + banner compacto | 🟡 | JF-γ | B-J4; jamás coexiste con encuentro; jamás en oleada previa a jefe |
| JF-31..34 | Urraca, Luciérnaga Dorada, Centinela, Heraldo (§4.3) — nota: Heraldo toca el nivel del jefe entrante (§3.5) | 🟡🟡 | JF-30 | B-J4/B-J5; Heraldo: test del ±1 nivel |
| JF-35 | Absorción formal de SV-41: marcar en `SURVIVAL_MASTER_PLAN.md` §6 fase ε la sustitución (con enlace aquí) | 🟢 | JF-30 | Evitar doble roadmap (riesgo «IDs duplicados») |

### Fase JF-ε — La Corte Profunda y el bestiario (🟡🟡)
| ID | Tarea | Esf. | Dep. | Guardarraíl |
|---|---|---|---|---|
| JF-40..42 | Cristálido, El Vacío, Titiritero (§4.2) | 🟡🟡 | JF-γ | B-J3/B-J5 por jefe; el Titiritero además test de curación |
| JF-43 | Bestiario: `Meta.surv.bossDex = {id:{seen,kills,flawless,maxLvl}}` (relleno tolerante) + vitrina en lanzador y hoja de la run | 🟡 | JF-γ | Retrocompatible; nada decae |
| JF-44 | 3 hazañas nuevas: `cazador` (derrota a los 5 Señores), `ronda_maestra` (3 rondas maestras vitalicias), `domaecos` (derrota un eco Nv. III) | 🟢 | JF-43 | Test de detección por hazaña |

### Fase JF-ζ — Aventura (🟡)
| ID | Tarea | Esf. | Dep. | Guardarraíl |
|---|---|---|---|---|
| JF-50 | Adaptador: banner + card en niveles jefe (crystals=pips, BOSS_MS=cuenta) | 🟡 | JF-β | Cero cambio mecánico |
| JF-51 | Identidad de los 6 jefes de bioma (nombres/epítetos/acentos, i18n) | 🟢 | JF-50 | — |
| JF-52 | Fase 2 de Aventura (BOSS_MS 20→15 con ≤2 cristales) — **solo si** el sim cubre aventura (B-J6) | 🟢 | JF-50 | B-J6 o posponer |

Si hay que recortar: se recorta de ζ hacia α, nunca al revés — α/β son el esqueleto, γ es el valor visible mínimo (los 5 Señores solos ya cumplen la visión), δ/ε son crecimiento, ζ es paridad.

---

# 10. Qué NO cambiar

1. **`TUNE` completo y la cadencia `bossEvery`** — el CUÁNDO del jefe sigue determinista (§3.6); protegido por §9 del plan de modos.
2. **El ritual GM-18 → GM-17** (bandera → aviso → peligro → bendición): se ESTIRA, no se altera; la bendición se ofrece siempre (derrota o retirada).
3. **Bendiciones** (pool/pesos/efectos, validadas en SV-01) y **reliquias de Aventura**.
4. **Revivir** (120→240→480, máx 3, sin cuenta atrás) y toda la ética del modo: nada caduca, sin ofertas en derrota, near-miss solo informativo.
5. **El beat «¡SUPERADO!» (SV-20)** — pasa a ser el beat de RETIRADA, intacto.
6. **Presupuesto HUD de 3 bloques**: el banner vive DENTRO de `surv-bar`, solo en encuentro, colapsando la subrow — el panel no crece de forma neta.
7. **Fórmula de score, combos, milestones, `CLEAR_ASSIST`, frenesí** — transversales, fuera de alcance.
8. **Hazañas y rangos existentes** — solo se AÑADEN entradas.
9. **La regla de exclusividad por modo (§5 del plan de modos):** anclas/minijefes/bestiario son de Supervivencia; Aventura comparte framework y presentación, no sistemas.

# 11. Riesgos y guardarraíles

| Riesgo | Mitigación |
|---|---|
| **Sobrecarga cognitiva para casuales** (el modo ya rozó el límite) | Garantía nº1 (§3.1): ignorar al jefe = experiencia actual. El banner sustituye información (subrow), no se suma. Playtest GM-31 con usuario primerizo antes de cerrar JF-γ |
| **Inflación de economía** (botín + Ronda maestra + minijefes) | B-J1/B-J4 con umbrales duros; degradaciones pre-acordadas (vida→carga; monedas −50%) para no negociar en caliente |
| **El encuentro alarga el peligro y mata más** (3-4 ataques vs 1) | B-J3: intensidad total equivalente repartida; cada ataque individual es MENOR que el evento actual; validar `iconCount` p90 por fase |
| **Regresión de rendimiento móvil** (QP-2 abierto) | §5.6: cero `infinite`, DOM por firma, tick 1s, perf-probe tras β y γ |
| **Doble roadmap con SURVIVAL_MASTER_PLAN ε** | §1.6 + JF-35: SV-41 absorbida explícitamente; SV-42/44 intactas en su plan |
| **El sim no ve el sistema** (los bots actuales no golpean anclas) | B-J2 es bloqueante de γ: primero el bot, luego el contenido |
| **Choque con el rediseño HUD en curso** (mismo DOM, working tree sucio) | JF-β gated a commit del HUD v2.6.12; JF-α no toca DOM |
| **Explosión de i18n** (~16 entidades × 4-6 claves × 2 idiomas) | Test de paridad de claves en CI (ya existe patrón); claves generadas por convención `bossdex_*` |
| **Romper partidas guardadas** | `bossDex` con relleno tolerante `_v`; `totalBosses` no se renombra |
| **El documento se pudre** (ya pasó con SV-ε, §1.6) | Regla dura: NINGÚN commit de fase JF sin su entrada en §12 en el mismo commit |

---

# 12. Registro de implementación (bitácora)

> Formato: entradas en orden cronológico inverso. Cada fase cerrada añade: qué se hizo, desviaciones del plan, verificación (tests/sim/playtest), versión y claves i18n nuevas.

### 2026-07-13 — Fase JF-ζ implementada (v2.6.20) · Aventura + cierre del plan

- **JF-50 · Adaptador de presentación**: en niveles jefe de Aventura (`isBoss`), el banner de objetivo (`obj-banner`) pinta la **cara del jefe** — nombre + epíteto + cristales como pips `◆` + cuenta atrás del próximo ataque (`▲ Ns`), con el acento del bioma tintando el borde. Diffing de 1s en `onTick` (`_rHp`/`_rNext`, mismo presupuesto que Supervivencia). Boss card al montar el nivel (`Render.bossCard`, reutilizada de JF-β) + `announce` accesible. **Cero cambio de reglas**: la mecánica GM-08 (acción cada 20s, cristales = objetivo) queda intacta.
- **JF-51 · Identidad de los 6 jefes de bioma** (i18n `advdex_*`, ES+EN): Corazón de Nebulosa, El Magnetar, Aurora Hambrienta, El Fundidor, La Nada, Matriarca Cristal. Separados del bestiario de Supervivencia (`bossdex_*`) — regla de exclusividad por modo (§5 del plan de modos): Aventura comparte el *framework de presentación*, no el sistema de anclas/bestiario.
- **JF-52 · Fase 2 (gated B-J6)**: con ≤2 cristales restantes, el reloj de ataque del jefe acelera **20s→15s** (`_bossMsFor`) — el remate se disputa. **B-J6 verde**: nivel alcanzado por los bots idéntico con y sin fase 2 (skilled p50 12/p90 16 en ambos; average 10 vs 9, dentro de ±1) — no altera la dificultad del modo.
- **Detalle pulido**: `--boss-accent` residual se limpia en `Adventure.resetRun` y en `Game.start` (cualquier modo) — evita que el acento de un jefe quede pegado tras salir (inofensivo, nada lo consume fuera de contexto de jefe, pero más limpio).
- **Verificación**: `node --check` ✅ · suite **123/123** (+5 en `tests/boss-adventure.test.js`: paridad i18n de los 6 biomas, niveles jefe con identidad, fase 2 20→15s gated, banner pinta la cara solo en niveles jefe, separación advdex/bossdex) ✅ · eslint ✅ · **navegador**: banner «Corazón de Nebulosa · late entre el polvo · ◆◆ · ▲ 15s» con borde acentuado, fase 2 a 15s con 2 cristales, card montada, acento limpio al salir, cero errores de consola ✅ · B-J6 con sim ✅ · triple bump 2.6.19→**2.6.20**.
- i18n nuevas (ES+EN): `advdex_{nebula,asteroid,ice,core,void,crystal}(+_e)`.

**— PLAN COMPLETADO —** El sistema de jefes pasó de "efecto instantáneo de 1-2s" a **encuentros con criatura, cuerpo en el tablero, PV, fases, niveles y actos**, con minijefes sorpresa, bestiario vitalicio y presentación coherente en los dos modos con jefes. 8 jefes + 4 minijefes, 118+5 tests, 7 puertas de balance validadas por simulación.

### 2026-07-13 — Fase JF-ε implementada (v2.6.19) · La Corte Profunda + bestiario + hazañas

- **JF-40 · Cristálido** (Acto III, 4 anclas, acento `#19f0d0`): ataque «Esquirlas» (2-3 spawns + 1 cristal normal que puntúa pero ocupa, cap 4 en tablero); twist de fase 2: **rebrota** — regenera 1 ancla cada `regenMs` (12s) si no están todas rotas (counterplay: remátalo con tempo/frenesí). Derrota: **todos los cristales del tablero estallan en puntos**.
- **JF-41 · El Vacío** (2 anclas, `#a06bff`): ataque «Devorar» — se TRAGA 1 icono ortogonalmente adyacente a cada ancla (los guarda en `e.devoured`, conteo consistente); fase 2: **CRECE** (+1 ancla nueva, cap `growCap=4`) — el único jefe que empeora si lo ignoras. Derrota: **colapsa y devuelve TODO lo devorado agrupado junto al centro** (cascada servida).
- **JF-42 · El Titiritero** (3 anclas, 1 blindada, `#ff6cb0`): ataque «Enhebrar» — marca 2 TIPOS de icono presentes; **converger un tipo enhebrado LE CURA 1 ancla** (`onThreadedConverge`, hookeado en `Game.converge` ANTES de vaciar celdas) — inversión mental; los objetos no convergen = purga segura (counterplay). Los tipos enhebrados se pintan en TODA celda vía `Render.syncCell` (`.threaded`, overlay CSS estático — presupuesto QP-2). Fase 2: re-enhebra + 1 candado. Derrota: **corta los hilos** (libera los tipos marcados, con el suelo anti-inflación).
- **JF-43 · Bestiario**: `Meta.surv.bossDex = {id: {seen, kills, flawless, maxLvl}}` + `masterRounds` (relleno tolerante `_v`, vitalicio, nada decae); `survBossSeen` al arrancar encuentro, `survBossKill` en el beat de derrota. Vitrina compacta en el lanzador (línea de hazañas: `🏅 n/11 · ⚔️ kills · ✦ rondas maestras`) — la cuadrícula completa del bestiario queda como polish futuro (anotado).
- **JF-44 · 3 hazañas** (total 11): `cazador` (derrotar a los 5 Señores), `ronda_maestra` (3 Rondas maestras vitalicias), `domaecos` (derrotar un eco Nv. III+ — `e.eco` viaja por `_lastDefeat`).
- **Hallazgo (destapado por el gate forzado)**: los jefes de Acto III no tenían entrada en `BOSS_DEFS` → el aviso de 3s (GM-18) caía al texto del meteoro y el override de sim los rechazaba. Añadidas entradas con **`base:false`** (JAMÁS entran al pool del jefe-evento clásico con flag apagado) + avisos i18n propios + `fn` legacy afín para el fallback sin sustrato.
- **Puertas (B-J3/B-J5, cada jefe FORZADO 40 runs vía `_bossOverride`, normal·skilled)**: crystalid 666 monedas · oleada 18 · deadAir 60% · kill-rate 86% — void 666/18/60%/84% — puppeteer 655/18/61%/**65%** (el más duro, por diseño: el puzzle-boss) — control mixto 672/18/59%/75%. Todo dentro de límites; la regeneración/crecimiento/curación no crean jefes inmortales ni inflación.
- **Verificación**: `node --check` ✅ · suite **118/118** (+5: Acto III en pool desde oleada 24 y nunca antes, rebrote del Cristálido por tempo, Vacío devora/crece/devuelve con conteo, Titiritero enhebra/cura/corta hilos, bestiario + 3 hazañas con detección) ✅ · eslint ✅ · triple bump 2.6.18→**2.6.19**. Smoke de navegador de los hilos pendiente de re-intento (herramienta de browser temporalmente caída al cierre de la fase; mecánica cubierta por tests y el patrón visual `.threaded` es CSS estático del mockup).
- i18n nuevas (ES+EN): `bossdex_{crystalid,void,puppeteer}(+_e)`, `bossatk_*_1/_2` ×3, `surv_boss_{shards,regrow,devour,grow,threads,heal}`, `surv_boss_{crystalid,void,puppeteer}_warn`, `feat_{cazador,ronda_maestra,domaecos}(+_d)`.

### 2026-07-13 — Fase JF-δ implementada (v2.6.18) · minijefes en producción

- **JF-30 · Runtime de minijefes** (`Bosses.maybeMini`, llamado desde `newWave` tras `_planBoss`): sorteo `p=0.22` desde la oleada 3 con **pity 4** (garantizado tras 4 oleadas elegibles secas), exclusiones duras — jamás en oleada de jefe, jamás 2 seguidos, jamás con encuentro activo; la oleada previa a jefe queda reservada al Heraldo (Acto II+, p=0.35). `MINIDEX` declarativo (acento/icono/latido/vida/blindaje/acto). El minijefe usa el runtime del encuentro (`enc.kind='mini'`): 1 ancla (a veces móvil), latido propio SIN telegrafiado de celdas, expira solo (`durMs` ≤ 0.9 oleadas / 15s la Luciérnaga), **sin card, sin bendición, sin beat grande** (jerarquía de calibres §5.2). Banner compacto (clase `mini`: retrato 22px, sin nivel, píldora = vida restante).
- **JF-31 · La Urraca** (Acto I): roba 1 icono/7s (lo guarda; conteo consistente) y vaga entre celdas vecinas; cazarla (converger encima) **devuelve TODO lo robado agrupado** alrededor de su celda (convergencia servida) + monedas. Homenaje al Resourceful Rat.
- **JF-32 · Luciérnaga Dorada** (Acto I, minijefe-BONUS): vaga cada 3s, no ataca, se va a los 15s; cazarla = **+24 de frenesí** + monedas extra. *(Desviación: el plan proponía «esa convergencia ×2»; los puntos se calculan antes de resolver tiles en `converge` — frenesí+monedas da el mismo sabor sin re-arquitectura.)*
- **JF-33 · El Centinela** (Acto II): blindado (1 golpe de adyacencia), congela 1 celda de su fila/columna cada 8s (territorio visible); al caer, **limpia su fila y columna** con el suelo anti-inflación de 8 iconos. *(Desviación: el plan decía «su fila/columna spawnean +25% más rápido» — el spawn es global, no por celda; la escarcha territorial comunica lo mismo sin tocar TUNE.)*
- **JF-34 · El Heraldo** (Acto II+, solo oleada previa a jefe): blindado; si **escapa** (expira o el jefe llega), el jefe entra a **nivel +1** («EMPODERADO»); si lo cazas, entra a **nivel −1** (mín. I, «llegará debilitado»). El ritual pre-jefe se vuelve jugable. `startEncounter` consume al mini vivo y lee `_heraldEmpower`/`_heraldSlain`.
- **JF-35 · SV-41 absorbida**: marcada en `SURVIVAL_MASTER_PLAN.md` §6 fase ε con enlace aquí (evita el doble roadmap).
- **Puerta B-J4** (script de gates, 40 runs/config): minis/run **p50 2/2/1/1, p90 ≤3** (✅ ≥1 y ≤4) · cazados/run 1.7/1.7/0.8/1.2 · monedas skilled 672 = **+4.0% adicional** sobre JF-γ (✅ ≤+8%; total +9.1% ≤ tope global) · oleada p50 y deadAir intactos en las 4 configs ✅.
- **Verificación**: `node --check` ✅ · suite **113/113** (+5: pity/exclusiones/no-2-seguidos/Heraldo-solo-Acto-II, Urraca roba-devuelve con conteo, Centinela congela+limpia con suelo, Heraldo ±1 nivel consumido por el jefe, Luciérnaga bonus + expira sin bendición) ✅ · eslint ✅ · navegador: banner compacto «LA URRACA · ✧ 26s» sin nivel, robo 1, caza devuelve +1 icono y paga 4 monedas, banner se apaga, cero errores de consola ✅ · triple bump 2.6.17→**2.6.18**.
- i18n nuevas (ES+EN): `minidex_*` ×8, `mini_steal/return/firefly_gift/sentinel_gift/herald_down/herald_up/gone`, `sr_mini_enter/down`.

### 2026-07-13 — Fase JF-γ implementada (v2.6.17) · ⚡ FLAG ENCENDIDO: los encuentros están EN PRODUCCIÓN

- **JF-20..24 · Los Cinco Señores completos**: fase 2 con twist propio por jefe — Nubarrón: lluvia deja **1 roca** en el centro de la zona marcada · La Corriente: anillo completo (ya en α) · Boreal: **clúster 2×2** compacto (busca bloques de 4 iconos contiguos; fallback disperso) · **El Cerrajero: la JAULA** (`_cageSteal`: roba 1 potenciador CON stock, lo planta como tile `cage` con `loot`; romperla por adyacencia lo devuelve; sin stock cae al cierre normal; `bossatk_lockdown_2` renombrada «Jaula»/«Cage») · Tectónico: terremoto total + **2 rocas** (respetando topes). **Efectos-firma de derrota** (`_defeatEffect`): el cielo escampa (limpia ~12%), la marea se retira (vacía filas exteriores), deshielo total +25 carga, jaulas se abren **×2**, y el Tectónico **ordena el mundo** (`_clusterGift`: agrupa hasta 8 iconos del tipo más común hacia el centro con FLIP — regalo de combo por intercambios puros).
- **Botín y Ronda maestra (§3.8)**: derrota paga `8 + 4×nivel` monedas (flyer de monedas); flawless (sin perder vida NI gastar potenciador en el encuentro) → **+1 vida** o **+50 carga** al tope — homenaje al Master Round de Gungeon.
- **Flag `Bosses.ENCOUNTERS = true`** — con `false` se recupera el jefe-evento clásico intacto (interruptor de emergencia deliberado, cubierto por test).
- **Puertas de balance (B-J1/B-J2/B-J3, batería completa en `BALANCE_BASELINE.md` §v2.6.17)**: monedas +4.9/+7.5/+3.2/+3.3% (✅ ≤+10%) · oleada p50 idéntica en las 4 configs ✅ · deadAir igual o mejor ✅ · kill-rate 75/69/46/37%. **Dos correcciones salieron de las puertas**: (1) los efectos de derrota inflaban +18% monedas y +63% score vía bonus de tablero vacío → **suelo de 8 iconos** en `_defeatEffect` (contribución neta ≈0 tras el suelo); (2) `_bossesDefeated` sin reset entre runs (bug de acumulación destapado por un kill-rate de 1770%). Hallazgo extra: los encuentros **eliminan una contaminación preexistente del sim** (setTimeouts reales de marea/terremoto legacy disparando en la run siguiente) — las filas skilled del baseline son idénticas bit a bit, la del guardarraíl de medallas incluida.
- **B-J5 (simplificación honesta)**: la evidencia por nivel es la matriz de tests 5 jefes × 3 niveles con invariantes (termina, iconos [0,64], especiales acotados) + oleada intacta en batería; no se instrumentó `iconCount` p90 post-ataque por-fase — si el playtest GM-31 señala picos, se instrumenta entonces.
- **Verificación**: `node --check` ✅ · suite **108/108** (+5: flag ON con bossEvent arrancando encuentro, interruptor de emergencia, Jaula roba/devuelve/sin-stock, efectos de derrota (deshielo/jaulas ×2/filas de marea/conteo consistente), botín + Ronda maestra con tope, fase 2 de Nubarrón/Tectónico con rocas y topes) ✅ · eslint ✅ · **navegador end-to-end** (SW obligó al bump antes del smoke — el token viejo servía game.js cacheado): Jaula roba «Barrido» y la celda muestra `tile-cage`, derrota devuelve ×2 y abre jaulas, beat paga botín 12 (8+4×I) y Ronda maestra sube vidas 3→4, banner se apaga, **cero errores de consola** ✅ · triple bump 2.6.16→**2.6.17**.
- i18n nuevas (ES+EN): `surv_boss_cage_steal`, `surv_master_round`, `surv_master_round_charge`; renombrada `bossatk_lockdown_2`.
- **Deuda que pasa a JF-δ/ε**: nombres de potenciadores en el toast de jaula reutilizan el mapa ES del grant (deuda i18n transversal QP-5); `perf-probe` no ejecutable localmente (sin Playwright — QA_PERF_PLAN §3), presupuesto FX cumplido por revisión de regla (cero `infinite` nuevos; banner tick 1s).

### 2026-07-13 — Fase JF-β implementada (v2.6.16) · flag sigue APAGADO

- **JF-10 · Banner `#surv-boss`**: primera fila DENTRO de `#surv-bar` (encima de vidas/oleada/tiempo, como pidió el propietario), según el mockup aprobado (`docs/mockups/boss-system-visual-index.html`, clases `sbx-*`): retrato circular con acento (`--boss-accent` fijado en `:root` por `startEncounter`, heredado por banner/anclas/card vía `color-mix` — convención ya usada 61 veces en styles.css), nombre + `Nv. I-IV` (romanos), pips de PV `◆◆◇`, píldora de próximo ataque con icono por jefe (`atkIcon` en DEX) y cuenta atrás con tick de 1s. Render con **diffing por firma** (`id|lvl|fase|PV|segundos|telegraph`) dentro de `Survival.render()` — 1 escritura DOM por cambio (§5.6). Durante el encuentro `#surv-bar.encounter` tinta el panel y **colapsa la subfila** (presupuesto móvil §5.1: el panel no crece neto). Estados: `phase2` (borde acento), `lvl-high` (Nv. III+: borde rojizo ESTÁTICO, sin pulso). Relevo limpio bandera ⚠ → banner.
- **JF-11 · Boss card**: `Render.bossCard()` — franja one-shot ~1.15s sobre el tablero (patrón Gungeon: NOMBRE + epíteto · nivel), `pointer-events:none` (no bloquea), animación transform/opacity `bossCard`. En `reduced-fx` NO existe (el banner conserva la información). Minijefes no tendrán card (jerarquía de calibres, §5.2).
- **JF-12 · Telegrafiado**: la píldora entra en `.telegraph` (arde en rojo) mientras las celdas objetivo se pre-marcan (`tide-warn` reutilizada, con su variante reduced-fx ya existente); `announce()` dice QUÉ viene («{b} prepara: {a}» con nombre de ataque por fase). Cambio de fase → `Feedback.event('bossPhase')` (firma nueva en SIG: warn + danger + combo).
- **JF-13 · Beats**: derrota = beat «¡{JEFE} DERROTADO!» con nombre propio (toast + rankFlash + confeti 56/70 si flawless + `Sound.record`) que **reemplaza** al «SUPERADO» vía `_defeatBeat` consumido en `_bossSurvived()` (la derrota también cuenta como superado: `_bossesSurvived++`, hazaña impecable intacta); retirada = beat SV-20 intacto + toast informativo «{b} se retira…». `_faceOff()` apaga banner/tinte/acento en resolve/abort. Sting de entrada reutiliza `Sound.bossWarn` + `Haptics.fire` (leitmotivs por jefe quedan como gancho QP-4). Ronda maestra (recompensa) diferida a JF-γ tras B-J1, como planificado.
- **JF-14 · i18n/a11y**: 32 claves nuevas ES+EN (`bossdex_{id}`/`_e`, `bossatk_{id}_1/_2`, `surv_boss_lvl/hp_sr/enter_sr/prep/phase2/defeated/retreat`); announce de entrada («Jefe: {b}, nivel {n}, {k} anclas…»), telegrafiado y derrota; `aria-label` vivo en los pips de PV; celdas ancla con ◆/◈ (blindada) y jaula con candado — todo con acento por jefe. Anclas/jaula estilizadas en `.cell.tile-boss`/`.boss-armored`/`.tile-cage`.
- **Desviación**: `bossatk_lockdown_2` dice «Cierre reforzado» (la Jaula real llega en JF-γ; se renombrará entonces para no prometer UI inexistente).
- **Verificación**: `node --check` ✅ · suite **103/103** (+3: paridad i18n del bestiario, banner on/off con firma y pips, beat DERROTADO consumido una vez) ✅ · eslint ✅ · **navegador** (`?dev`, encuentro forzado `tide` en oleada 14): banner «LA CORRIENTE · Nv. II · ◆◆◆ · ≈ 6s» con acento `#59d6ff`, 3 anclas `tile-boss` con borde tintado y badge ◆ computado, card montada con clase `show`, telegrafiado enciende píldora + 5 celdas pre-marcadas, ataque ejecuta, derrota apaga banner/acento y deja beat pendiente; `reduced-fx`: card NO se crea, banner sí informa, Nv. III con borde estático; **cero errores de consola**. (Captura de pantalla no disponible: el capturador del pane hace timeout con las animaciones ambientales del tablero — limitación ya documentada en SV-γ; verificación por texto/clases computadas.) Triple bump 2.6.15→**2.6.16**.

### 2026-07-13 — Fase JF-α implementada (v2.6.15) · flag APAGADO

- **JF-01 · Módulo `Bosses`** (game.js, tras `Survival`): registro `DEX` con los 5 señores (acto, acento del mockup, anclas, blindaje, `attackMs`, tipo de ataque, marco visual; `quake` con `chaosPromote`, `tide` con `edgeAnchors`) + FSM del encuentro (`startEncounter` → `tick` por **acumuladores de dt** — a prueba de pausas y del reloj virtual del sim — → `resolve('defeat'|'retreat')`/`abort`). El encuentro dura `~1.8×WAVE_MS`, ataca cada 12-14s con pre-marca de celdas 2.5s antes (patrón de la marea generalizado a los 5 ataques: `rain`/`tide`/`frost`/`locks`/`shuffle`, con fase 2 que CAMBIA el patrón), y su primer ataque llega a ~6s (respiro de entrada). `bossEvent()` gatea por `Bosses.ENCOUNTERS`; el cierre comparte ritual con el evento clásico (`_afterBossEvent`/`_encounterEnd`: beat SV-20 +1.2s, bendición +1.7s) — garantía nº1 verificada: con flag OFF el juego es bit a bit el de v2.6.14.
- **JF-02 · Tiles y daño**: tiles `boss` (no-sólido, vive BAJO un icono; converger encima = 1 golpe — rama en `Game.converge`) y `cage` (sólido, `hits`, devuelve `t.loot` al romperse). Blindaje = `hits>0 + solid=true` por instancia: `Engine.converging` ya lo trata como hielo sin tocarlo (icono atrapado + corta línea de visión). Se agrieta por adyacencia (extensión del bucle de `Survival.onConverge`) o por bomba (`applyBoosterAt`); anclas/jaulas **inmunes a `_powerClear`** (objetos/alivio: al jefe se le vence jugando). El imán respeta blindadas (skip solid ya existente) y puede golpear anclas expuestas (tech legítima). **Re-encarnación** (~0.9s): un ancla cuyo icono desapareció por vías indirectas recupera icono — los spawns nunca caen sobre tiles (`Engine.emptyCells`), sin esto quedaría invulnerable. Anclas se colocan bajo iconos existentes respetando `SPECIAL_CAP`; sin sustrato → fallback al jefe-evento clásico con su ritual.
- **JF-03 · Niveles/actos/sorteo**: `actoForWave` (I <12 / II 12-23 / III 24+), `levelForWave = min(3, 1+⌊w/12⌋)` +1 eco +1 heraldo (tope IV «PESADILLA»), `pick()` con pools por acto, promoción del caos, sin repetición inmediata y **eco como regla de sorteo** (15% con jefe previo, `ECO_P`). `_planBoss` usa `Bosses.pick` bajo el flag; `_bossOverride` se respeta. Nivel ≥III blinda +1 ancla (siempre ≥1 expuesta, legibilidad).
- **JF-04 · Sim y tests**: bot **boss-aware** en `tools/balance-sim.js` (`bossAware` 0.7/0.35/0.1 por perfil: prioriza jugadas que golpean anclas vía `Engine.converging`+tile `boss`). Nueva suite `tests/boss-foundation.test.js` (14 tests): registro, actos/niveles/sorteo/eco, golpe por convergencia + fase 2, blindaje (atrapa icono, adyacencia lo rompe), inmunidad a objetos + bomba agrieta + jaula devuelve botín, caps, un-solo-encuentro, fallback sin sustrato, derrota/retirada con ritual, flag OFF intacto, **matriz 5 jefes × 3 niveles** con invariantes (iconos∈[0,64], `iconCount` consistente, especiales acotados, todo encuentro termina, sin anclas huérfanas), re-encarnación.
- **JF-05 · Contrato** documentado en `MIGRATION_SPEC.md` §2.5 (párrafo «Framework de ENCUENTROS»).
- **Desviaciones del plan**: la fase 2 del Cerrajero (robo+jaula) queda para JF-γ como estaba previsto (el tile `cage` y su mecánica ya están); los números de ataque son provisionales hasta B-J3. Hallazgo de test: fuera de `Game.start`, `State.board` no es un array de 64 nulls — el arnés de tests debe construirlo explícitamente (documentado en el propio test).
- **Verificación**: `node --check` ✅ · suite **100/100** (86+14) ✅ · eslint ✅ · batería sim 40 runs **idéntica bit a bit** a v2.6.14 con flag OFF (diff limpio salvo PID de un warning preexistente de Node) ✅ · triple bump manual 2.6.14→**2.6.15** ✅. Sin claves i18n nuevas (llegan en JF-β con `bossdex_*`).

### 2026-07-12 — Plan creado (v2.6.12 working tree)

- Inventario auditado sobre `game.js`/`index.html` del working tree v2.6.12 (rama `clon-vanilla`, rediseño HUD sin commitear): jefe-evento de Supervivencia (`BOSS_DEFS` 6 tipos, enfurecidos ol. 24+, eco, telegrafiado GM-18, beat SV-20, bendición GM-17) y nivel-jefe de Aventura (cristales + `bossAction` por bioma cada 20s). Detalle en §1.
- **Hallazgo de deuda documental:** SV-40/SV-43 implementados en `e22ae3c` sin registrar en la bitácora de `SURVIVAL_MASTER_PLAN.md` (su fase ε figura abierta). SV-41 (élites) sin implementar — este plan la absorbe con los minijefes (JF-35). Registrado en §1.6.
- Diseño completo: encuentros con anclas/PV/fases/niveles I-III, actos con pools aleatorios, minijefes con pity, recompensa derrotar≥sobrevivir con Ronda maestra, banner sobre el panel vidas/oleada/tiempo, boss card, bestiario. Referentes extrapolados en §2 (10 principios). Roster inicial: 5 Señores (re-encarnación de los efectos actuales) + 3 jefes Acto III + 4 minijefes + banquillo.
- Roadmap en 6 fases (JF-α..ζ) con 7 puertas de balance (B-J1..7). Bloqueos declarados: JF-β espera el commit del rediseño HUD; B-J2 (bot boss-aware) bloquea JF-γ.
- Pendiente de decisión del propietario antes de arrancar JF-α: ninguno — el plan es ejecutable tal cual; los números marcados «gated» se validan por sim en su puerta correspondiente.

*Creado el 2026-07-12 a partir de la auditoría del código v2.6.12 y de `SURVIVAL_MASTER_PLAN.md`, `SURVIVAL_INVENTORY.md`, `GAME_MODES_MASTER_PLAN.md` (GM-08/17/18), `QA_PERF_PLAN.md`, `BALANCE_BASELINE.md` y `SURVIVAL_HUD_REDESIGN_PLAN.md`.*
