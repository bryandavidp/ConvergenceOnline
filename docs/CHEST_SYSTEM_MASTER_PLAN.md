# Sistema de cofres — análisis, benchmark contra Clash Royale y plan de mejora

Fecha de análisis: 2026-07-18 · Versión de la app analizada: 2.6.85 (rama `clon-vanilla`)

Complementa a `docs/CHEST_REDESIGN_WORKLOG.md` (registro del rediseño visual ya entregado). Este documento
analiza el **sistema** (economía, funcionalidad, pacing, UX) y lo compara con el sistema de recompensas de
Clash Royale **a día de hoy (julio 2026)**, que ha cambiado mucho desde el modelo clásico de 2016: Lucky Drops
(2024) → Lucky Chests con estrellas (oct 2025) → Choice Chests y catch-up rewards (2026).

> **Nota de lectura / baseline histórico.** Las secciones §1–§4 quedan congeladas como auditoría verificable de
> Convergence **2.6.85**: describen qué existía y qué brechas motivaron el plan, no el estado posterior. Los cierres
> contra el código vigente se registran en §5–§6 y el contrato de persistencia actual en `MIGRATION_SPEC.md`.
> **Estado actual:** CH-1…CH-5 están cerradas y la corrección UX posterior está verificada en Convergence
> **2.7.0**. CH-5 cerró el submodelo de cofres en schema **8**; el perfil vigente es schema **9** por el
> `xpBoostUntil` añadido después, sin cambios adicionales al formato de los cofres.

---

## §1 · Sistema de Convergence en el baseline 2.6.85 (verificado contra el código de esa entrega)

### 1.1 Catálogo de tipos (`game.js` ≈2817–2869, `CHEST_TYPES`)

| Tipo | Rareza | Duración | Abrir ya (💎) | 💎/hora | Monedas | Gemas | Tickets | % monedas | % gemas | % tickets | % cosmético |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `wood` Madera | Básico | 3 h | 10 | 3,33 | 60–199 | 3–10 | 1 | 60% | 30% | 8% | **2%** |
| `bronze` Bronce | Común | 4 h | 12 | 3,00 | 90–260 | 4–12 | 1 | 56% | 30% | 10% | **4%** |
| `silver` Plata | Raro | 6 h | 18 | 3,00 | 140–360 | 5–15 | 1–2 | 50% | 28% | 14% | **8%** |
| `gold` Oro | Épico | 8 h | 24 | 3,00 | 200–500 | 7–18 | 2–3 | 46% | 26% | 15% | **13%** |
| `magic` Mágico | Épico | 12 h | 30 | 2,50 | 280–700 | 10–24 | 2–4 | 40% | 24% | 14% | **22%** |
| `royal` Real | Legendario | 16 h | 40 | 2,50 | 400–950 | 14–30 | 3–5 | 36% | 19% | 13% | **32%** |
| `supreme` Supremo | Legendario | 20 h | 50 | 2,50 | 550–1250 | 18–38 | 4–6 | 30% | 16% | 12% | **42%** |
| `champion` Campeones | Mítico | 24 h | 60 | 2,50 | 750–1600 | 24–48 | 5–8 | 25% | 15% | 10% | **50%** |
| `divine` Divino | Mítico | 36 h | 75 | 2,08 | 1000–2400 | 35–70 | 7–10 | 20% | 12% | 8% | **60%** |
| `event` Evento | Especial | 6 h | 20 | 3,33 | 180–520 | 8–22 | 2–4 | 38% | 25% | 15% | **22%** |

- **Cada apertura entrega UN solo ítem** (tirada única: monedas O gemas O tickets O cosmético) — `Meta.openChest()` ≈3104.
- Cosméticos sin duplicados: `_rollCosmetic()` solo sortea tableros/temas **no poseídos**; con el pool agotado cae a
  jackpot de monedas (o gemas en madera) etiquetado `fallback` (≈3119–3121).
- **Cofre premium**: 25 💎, instantáneo, tabla propia (52% monedas 200–499, 30% 2 tickets, 10% jackpot 600–999, 8% cosmético) — ≈3131.

### 1.2 Ranuras y temporizador (≈3050–3103)

- 3 ranuras iniciales; 4ª desbloqueable por **150 💎** (tope duro 4, `chestSlots` clamp 3–4).
- **Un solo temporizador activo a la vez** (como CR). `endsAt` es timestamp: progresa con la app cerrada.
- Coste de "abrir ya" **prorrateado** por tiempo restante: `ceil(instantCost · restante/duración)` — paridad con CR.
- El excedente por encima de las ranuras se guarda en **reserva ilimitada** ("+n en reserva"); nunca se pierden cofres.
- Al terminar un temporizador **no se auto-inicia el siguiente**: si el jugador no vuelve, la cola está muerta (mismo dolor que CR).

### 1.3 Fuentes de obtención (todas pasan tipo explícito)

| Fuente | Cadencia | Tipo | Ref |
|---|---|---|---|
| Supervivencia | cada 10 oleadas | escalera por oleada: 10→wood, 20→bronze, 30→silver, 40→gold, 50→magic, 60→royal, 70→supreme, 80→champion, 90+→divine | ≈4342 |
| Mundo de Clásico completado (50 niveles) | una vez por mundo | `royal` + 20 💎 | ≈6096 |
| Racha del Reto diario | cada 7 días con medalla | `event` | ≈3185 |
| Jardín Zen | hito de 10 flores (una vez) | `magic` | ≈7582 |

- **`CHEST_DROP_SEQUENCE`** (≈2928): ciclo determinista de 32 cofres al estilo del chest cycle de CR… que hoy es
  **código muerto en la práctica**: todas las fuentes pasan tipo explícito y `nextChestType(preferred)` solo consulta
  la secuencia cuando no hay tipo.
- Modos sin cofres: Clásico por nivel, Contrarreloj, Reto diario (salvo racha), Aventura, misión diaria, reto semanal
  (da solo +400 XP, ≈8006).

### 1.4 UI/UX actual (`index.html` 559–651, `game.js` ≈9317–9585)

- Vista hub `#view-chests`: showcase con atlas 2×2 de 4 estados, ficha del cofre (rareza/tamaño/duración), ficha
  "Contiene", 2 acciones principales (Abrir ahora 💎 / Abrir con temporizador), carrusel de ranuras con countdown en
  vivo, banda "Posibles recompensas", tarjeta de progreso (solo oleadas de Supervivencia), strip premium, catálogo de
  los 10 tipos.
- Revelado: animación de 4 fotogramas + confetti escalado por rareza + tarjeta tintada + CTA "Equipar" para cosméticos.
  Respeta `prefers-reduced-motion`; `aria-live`/`announce` correctos. i18n ES/EN completo.
- Proyección en Home: `syncHomeChests()` actualiza el chip contador; **sin countdown ni estado "listo" visible desde Home**,
  sin badge de PWA, sin notificación local.

### 1.5 Persistencia

Schema 4 de `cv_meta`: `chestInventory` (uids tipados), `chestUnlock`, `chestSlots`, `chestSeq`; `m.chests` sigue siendo
el contador canónico por retrocompatibilidad. Migración legacy → madera determinista (sin consumir `Math.random`).
La economía meta usa `Math.random` a propósito (un cofre seedeable sería explotable, ≈1101).

---

## §2 · Clash Royale a día de hoy (julio 2026)

### 2.1 Cofres de batalla (sistema clásico, sigue vivo)

- **4 ranuras** fijas y gratuitas; cada victoria en escalera otorga el siguiente cofre del **ciclo fijo de 240**
  (180 Silver, 52 Golden, 4 Magical, 4 Giant) + **ciclo especial de 500** independiente (Epic, Legendary, Super Magical,
  por hitos de copas). Con ranuras llenas la victoria **no avanza el ciclo** (cofre perdido → presión de sesión).
- **Un desbloqueo a la vez**. Duraciones: **solo 4 valores** — 3 h (Silver), 8 h (Golden), 12 h (Giant/Magical/Epic),
  24 h (Super Magical/Legendary/Mega Lightning/Royal Wild).
- Saltar con gemas a **tarifa plana legible: 1 💎 por 10 min** (3 h=18, 8 h=48, 12 h=72, 24 h=144), prorrateada por
  tiempo restante. También existen "Chest Keys" como consumible de salto.
- **El contenido escala con la arena** del jugador: el mismo Silver da más cartas/oro a mayor arena. Tocar un cofre
  muestra **contenido exacto previsto** (nº de cartas, rango de oro, rarezas garantizadas).
- Notificación push cuando el cofre termina; las 4 ranuras están **siempre visibles en la pantalla principal**, bajo el
  botón de batalla.

### 2.2 Lucky Chests (octubre 2025, sustituyen a los Lucky Drops de 2024)

- Recompensa diaria principal: **4 Magic Lucky Chests al día** por victorias (estandarizado para todos).
- Tres familias: **Common** (3 "spins": cartas y oro), **Magic** (4 spins: cartas, oro, ítems mágicos, cosméticos),
  **Seasonal** (temáticos por temporada).
- Mecánica estrella: al abrir, cada chest puede **subir de nivel de estrella (1★→5★) con ruleta visible y
  probabilidades publicadas** (p. ej. subir a 5★ Magic: 0,3% → **1%** desde diciembre 2025). Cada estrella multiplica
  la recompensa. Es la mecánica de anticipación central: convierte cada apertura en dos momentos (¿sube? + ¿qué toca?).
- Diciembre 2025: retiraron el oro de los 4★/5★ (redistribuido) para que el tier alto se sienta siempre especial.

### 2.3 Choice Chests (julio 2026, temporada 85)

- Nuevo cofre diario en los Daily Battle Rewards: el jugador **elige su recompensa** entre opciones reveladas
  (agencia en vez de azar puro). 5 tiers (1★–5★) con odds publicadas de tier: 33,4% 2★ · 45,6% 3★ · 19,7% 4★ · 1,3% 5★.

### 2.4 Bondades y transparencia (tendencia 2024→2026)

- **Catch-up rewards** (junio 2026): recompensas diarias perdidas quedan parcialmente recuperables al volver.
- **Probabilidades publicadas** de todos los contenedores en un hub oficial (presión regulatoria UE sobre loot boxes).
- Dirección general: menos castigo (cofres perdidos ↓), más previsibilidad (tablas visibles), más agencia (elección),
  más ceremonia por apertura (spins/estrellas) y **menos tipos de temporizador**.

### Fuentes

- Supercell — [ALL ABOUT DROP RATES](https://supercell.com/en/games/clashroyale/blog/news/clash-royale-chest-info-2/) ·
  [December Update 2025](https://supercell.com/en/games/clashroyale/blog/release-notes/december-update-2025/) ·
  [June Update 2026](https://supercell.com/en/games/clashroyale/blog/release-notes/june-update-2026/)
- [GamingOnPhone — October 2025 update (Lucky Chests)](https://gamingonphone.com/news/clash-royale-october-2025-update-is-bringing-lucky-chests-champion-cycle-rework/)
- [ClashDecks — Chest Mechanics Guide](https://clashdecks.com/guides/beginner/chest-mechanics-guide) ·
  [Theria Games — Chest Guide](https://theriagames.com/guide/clash-royale-chest/) ·
  [esports.net — Chest Cycle](https://www.esports.net/news/mobile-games/clash-royale-chest-cycle/) ·
  [LDShop — July 2026 Season 85 (Choice Chests)](https://www.ldshop.gg/blog/clash-royale-gp/july-event-guide.html)

---

## §3 · Comparativa dimensión a dimensión

> Comparativa histórica congelada en 2.6.85. Los «No existe» y las brechas de esta tabla son el punto de partida;
> no se reescriben después de implementar una fase porque perderían valor como evidencia del cambio.

| Dimensión | Clash Royale 2026 | Convergence 2.6.85 | Veredicto |
|---|---|---|---|
| Conexión con el bucle central | Cada victoria alimenta el pipeline | Solo Supervivencia c/10 oleadas + 3 fuentes puntuales | ❌ **Brecha crítica** |
| Cadencia de rareza | Ciclo determinista: los raros LLEGAN seguro | Escalera por habilidad: el jugador medio nunca ve tiers altos | ❌ Brecha |
| Ranuras | 4 gratis, pérdida si llenas | 3+1 (150💎), reserva infinita sin pérdida | ✅ Más amable (pero resta tensión/urgencia) |
| Temporizadores | 4 duraciones (3/8/12/24 h) | **10 duraciones** (3–36 h), poco legibles | ⚠️ Simplificar |
| Coste de salto | Tarifa plana 1💎/10 min, aprendible | 2,08–3,33 💎/h según tipo | ⚠️ Hacer legible |
| Prorrateo del salto | Sí | Sí | ✅ Paridad |
| Progreso offline del timer | Sí + push al terminar | Sí, **sin aviso alguno** | ⚠️ Brecha |
| Auto-inicio del siguiente | No (dolor histórico de CR) | No | 💡 Oportunidad de superar a CR |
| Contenido por apertura | Multi-ítem con reveals encadenados / spins | **1 solo ítem** | ❌ Brecha de ceremonia |
| Anticipación extra | Ruleta de estrellas 1★–5★ con odds | No existe | ❌ Brecha (es SU mejor mecánica actual) |
| Agencia | Choice Chest diario (elige tu premio) | No existe | ❌ Brecha |
| Vista previa del contenido | Exacta por cofre (nº ítems, rangos) | Descripciones genéricas; banda global **que promete potenciadores y objetos que NINGUNA tabla contiene** | ❌ **Bug de honestidad** |
| Odds publicadas | Hub oficial con tablas | No | ⚠️ Fácil de superar (mostrarlas in-game) |
| Escalado con progresión | Contenido escala con arena | Rangos fijos: madera da 60–199 🪙 igual a nivel 1 que a nivel 30 | ❌ Brecha |
| Duplicados | Cartas repetidas constantes | Cosméticos sin duplicados | ✅ **Mejor que CR** |
| Pipeline visible en Home | 4 ranuras siempre en pantalla | Chip contador sin estado | ⚠️ Brecha |
| Catch-up / bondad | Recuperación de días perdidos | Congelación de racha ya existe (GM-14) | ✅ Base buena, extender |
| Cofre diario | 4 Magic Lucky Chests/día | No hay cofre diario | ❌ Brecha |
| Apertura de pago | Ofertas de tienda | Premium 25💎 instantáneo | ✅ Paridad razonable |

---

## §4 · Puntos de mejora detectados en el baseline

### Funcionales

- **F1. Pipeline universal.** Que TODOS los modos alimenten cofres (victoria de Clásico, sesión de Contrarreloj, medalla
  del Reto, capítulo de Aventura…) mediante un contador unificado de "victorias/objetivos" que consuma
  `CHEST_DROP_SEQUENCE` — el ciclo ya está escrito y hoy no lo usa nadie. La escalera de Supervivencia se conserva
  como *bonus* de hito, no como única puerta.
- **F2. Cadencia garantizada de tiers altos.** El ciclo de 32 ya garantiza 1 divine/32 y 1 champion/32. Ajustar la
  secuencia con la simulación de balance y añadir contador visible tipo "cofre mítico en ≤ N cofres" (pity explícito).
- **F3. Cofre diario.** Primera victoria del día (en cualquier modo) → cofre pequeño; integra el hueco del dock "Siguiente paso".
- **F4. Reto semanal → cofre `event`.** Hoy paga solo 400 XP; es la fuente natural del tipo evento (hoy casi huérfano).
- **F5. Auto-inicio del siguiente temporizador** (superar a CR): al completarse un desbloqueo, empieza solo el cofre
  más corto en espera. Elimina el "timer muerto durante la noche" sin tocar la monetización de saltos.
- **F6. Aviso de cofre listo.** Badging API (`navigator.setAppBadge`) + estado "¡Listo!" con countdown en el chip de
  Home; opcional Notification API local al reabrir. Sin servidor push no hay push real: no prometerlo.
- **F7. Escalado con progresión.** Multiplicar rangos de monedas/gemas por nivel meta (p. ej. ×(1+0,05·nivel), tope ×2,5)
  para que madera no sea basura en late game. Igual que el escalado por arena de CR.
- **F8. Drops de potenciadores/objetos reales** (cierra F-bug H1 y el ítem 3.2 del ROADMAP): añadir a las tablas
  boosters de Supervivencia / tickets de reroll como ítems droppables con inventario.

### Diseño / UX

- **U1. Bug de honestidad (arreglo inmediato):** la banda "Posibles recompensas" (`index.html` ≈609–610) muestra
  "Potenciadores x1–x5" y "Objetos x1–x5" que **no existen** en ninguna tabla. O se implementan (F8) o se retiran ya.
- **U2. Vista previa exacta por cofre:** sustituir descripciones de sabor por rangos reales del tipo seleccionado
  (ya están en `CHEST_TYPES`) + probabilidades por categoría. Supera a CR en transparencia in-game.
- **U3. Apertura multi-ítem con reveals encadenados:** 2–4 "tiradas" por cofre según tamaño (monedas garantizadas +
  tirada secundaria + posible cosmético), reveladas por toque con pacing por rareza. El tamaño (Pequeño→Enorme), hoy
  puramente cosmético, pasa a significar nº de tiradas.
- **U4. Ruleta de mejora de tier (mecánica estrella de Lucky Chests):** al abrir, probabilidad visible de que el cofre
  suba 1 tier (wood→bronze→…): anticipación doble por apertura, con odds publicadas en el propio catálogo.
- **U5. Choice Chest de Convergence:** el cofre diario (F3) muestra 3 recompensas boca arriba y el jugador elige 1.
  Agencia pura, cero azar oscuro; es la novedad CR de julio 2026 y encaja con la ética del proyecto.
- **U6. Pipeline visible en Home:** mini-strip de ranuras (o al menos "⏱ 2h 13m" / "¡Listo!" en el chip de cofres).
- **U7. Legibilidad de tiempos:** consolidar a 4–5 duraciones (3/8/12/24 h + 24–36 h para divine) y tarifa de salto
  plana (p. ej. 3 💎/h exactos en todos) para que el jugador pueda calcular de cabeza.

### Economía / ética

- **E1. Tarifa de salto uniforme** (ver U7) con la simulación de balance como guardarraíl (`tools/balance-sim.js` +
  `docs/BALANCE_BASELINE.md`).
- **E2. Reserva con propósito:** mantener la bondad (no perder cofres jamás — mejor que CR), pero mostrar la reserva
  como cola ordenada y usarla para el auto-inicio (F5). Evaluar tope blando (p. ej. 12) con conversión del exceso en
  monedas para que la reserva no anule las ranuras.
- **E3. Odds in-game:** tabla de probabilidades por tipo dentro del catálogo (CR las publica solo en el blog;
  mostrarlas dentro de la app es superarlos y va con la tendencia regulatoria).
- **E4. Catch-up de racha del Reto:** ya existe congelación (1 + 1/7 días); extender el patrón catch-up de CR 2026 al
  cofre diario (si faltaste ayer, el cofre de hoy sube un tier).

---

## §5 · Plan de mejora por fases

> Regla general: cada fase termina con `node --test`, `node tools/balance-sim.js` comparado contra
> `docs/BALANCE_BASELINE.md`, lint, y triple bump de versión (game.js/index.html/sw.js). Cambios de `cv_meta`
> usan migración retrocompatible (patrón `MetaData._v`, MIGRATION_SPEC §3.4). Historial del plan: schema 5 en
> CH-2, schema 6 en CH-3, schema 7 en CH-4 y **schema 8** al cerrar CH-5. El perfil global vigente es schema 9
> por `xpBoostUntil`; la corrección visual 2.7.0 no añade ni migra datos.

### CH-1 · Honestidad y transparencia (P0 · esfuerzo bajo · sin riesgo de balance)

1. Retirar (o marcar "próximamente" real) Potenciadores/Objetos de la banda de recompensas (U1).
2. Ficha del cofre seleccionado con rangos reales + % por categoría desde `CHEST_TYPES` (U2).
3. Odds por tipo en el catálogo (E3).
4. Countdown/estado "listo" en el chip de cofres de Home (parte de U6).
- *Pruebas:* extender `tests/chests-redesign.test.js` (la banda no promete categorías sin tabla; la ficha refleja `CHEST_TYPES`).

### CH-2 · Pipeline universal (P0 · esfuerzo medio · CORAZÓN del plan)

1. Contador unificado `chestPipeline` (schema 5): victorias/objetivos de cualquier modo suman; a N puntos → siguiente
   cofre del ciclo (`CHEST_DROP_SEQUENCE` reequilibrada con balance-sim) (F1, F2).
2. Cofre diario de primera victoria (F3) + reto semanal → `event` (F4).
3. Contador de pity visible ("mítico garantizado en ≤ N") (F2).
4. Supervivencia conserva su escalera como bonus de hito.
- *Pruebas:* unitarias del ciclo (determinismo, distribución por 32), guardarraíl en balance-sim (cofres/hora por bot).

### CH-3 · Tiempos, auto-inicio y avisos (P1 · esfuerzo medio) — ✅ cerrada tras auditoría (v2.6.92)

1. Consolidar duraciones y tarifa plana de salto (U7, E1) — cuidado: cofres ya en inventario conservan su `durationMs`.
2. Auto-inicio del siguiente cofre más corto al completarse el activo (F5).
3. Badging API + estado listo en Home + notificación local best-effort (F6).
4. Reserva como cola visible que alimenta el auto-inicio (E2).
- *Pruebas:* transición de temporizadores con reloj simulado; compat de `chestUnlock` previo.

### CH-4 · Ceremonia de apertura (P1 · esfuerzo medio-alto) — ✅ cerrada (schema 7; auditada sobre schema 8; UX endurecida en v2.7.0)

1. **Multi-tirada real por tamaño.** El tier final determina 2 premios (pequeño), 3
   (mediano/grande/variable) o 4 (extragrande/enorme). Siempre hay monedas garantizadas (25% de una tirada del
   rango), después la tirada principal histórica y, si corresponde, extras con tabla publicada
   52% monedas / 23% gemas / 13% ticket / 12% booster. `reward.items` es serializable y no se autorreferencia.
2. **Ascenso sorpresa, solo cuando ocurre.** Cada cofre salvo `divine` publica un 10% de convertirse en el siguiente
   tier de `CHEST_UPGRADE_PATH` (`event→royal` incluido). El 90% sin ascenso pasa directamente a revelar premios:
   no muestra una pantalla de «comprobación» ni una falsa mejora. Solo el resultado positivo interpone una transición
   breve con origen, destino y efecto; la pantalla de premios conserva además esa explicación. `reducedFx` y
   `prefers-reduced-motion` eliminan la espera sin perder la información.
3. **Arsenal persistente.** Schema 7 añadió `boosterStock` para `bomb`, `freeze`, `clearLine`, `wild` y `x2`, con
   APIs acotadas `boosterInventory/boosterCount/addBooster/spendBooster`. Los drops entran en ese stock, pero una
   partida nunca lo mezcla ni lo drena implícitamente: `quoteBoosterLoadout`/`commitBoosterLoadout` transfieren solo
   el loadout confirmado. En Clásico lo hace PreLevel (máximo 2) y en Supervivencia su lanzador (máximo 3); una
   unidad poseída sustituye el pago en monedas y el runtime consume después únicamente `Survival.inv`.
4. **Escalado con progresión.** Monedas y gemas —incluidos garantizado y extras— usan
   `min(2.5, 1 + 0.05·(nivel−1))`: nivel 1 conserva el baseline y nivel 31+ queda limitado a ×2,5. Los tickets no
   escalan. `chestOdds(type, Meta.level())` proyecta los rangos efectivos en ficha y catálogo.
5. **Guardarraíl de economía aislado.** `runChestEconomy(options)` en `tools/balance-sim.js` abre cofres mediante
   `Meta.addChest`/`Meta.openChest`, usa streams deterministas por tipo/nivel y restaura `Meta.state`, `cv_meta` y
   `Math.random` incluso ante error. `--chests` resume EV de monedas/gemas/tickets/boosters, premios y tier-ups.
6. **Flujo visual exclusivo y animación fluida.** La muestra cerrada (`chest-preview`) y la ceremonia
   (`chest-ceremony`) son regiones hermanas y mutuamente excluyentes mediante `hidden`/`inert`; al abrir se ocultan
   ficha, acciones, ranuras, banda y catálogo. «Tipo de cofre» y «Qué puede contener» viven en flujo normal, en dos
   columnas o una según ancho, sin capas absolutas. La apertura separa los cuatro frames discretos del atlas
   (`chestAtlasFrames`) del movimiento continuo (`chestOpenMotion`, 720 ms), limitado a `transform`/`opacity`, y
   predecodifica el atlas de origen/destino antes de animarlo. El foco vuelve al CTA tras «Seguir».
- *Pruebas focales:* `tests/chest-ceremony.test.js` + `tests/balance-guardrail.test.js`.

### CH-5 · Agencia y eventos (P2 · esfuerzo medio) — ✅ cerrada (v2.6.98; schema 8)

1. **Choice Chest diario inmediato.** El primer objetivo UTC del día fija y persiste tres opciones visibles
   (monedas, gemas y ticket o booster), crea un cofre Bronce y lo deja `ready` en el mismo acto: coste de salto 0,
   no ocupa el temporizador ni bloquea la cola. `openChest()` no puede consumirlo; solo
   `claimChestChoice(uid, optionId)` concede una opción y elimina el cofre. Copias defensivas, opción inválida y
   doble claim protegen la economía; elecciones pendientes de días distintos pueden coexistir.
2. **Catch-up acotado y bondadoso.** Usuario nuevo o que jugó ayer recibe Bronce; si la última fecha registrada
   queda dos o más días atrás, el nuevo Choice sube **exactamente a Plata**, sin acumular más tiers ni añadir
   espera. El payload persiste `date`, `tier`, `catchUp` y las tres opciones.
3. **Evento semanal offline con snapshot.** `addEventChest(source)` captura al ganar el cofre
   `{id, week, challengeId, featuredBooster, source}`; el booster destacado se deriva de semana+reto y no cambia
   aunque rote la semana. La última tirada menor garantiza ese booster en el arsenal. Cofres `event` legacy sin
   snapshot válido se completan una vez al migrar; el ciclo genérico de 32 ya no fabrica eventos sin contexto.
4. **Agencia visible.** Eventos mantiene una tarjeta del Choice pendiente y abre un `Picker` de tres caras; la
   ficha de cofre muestra opciones/evento literalmente, con estados listo/en apertura y paridad i18n ES/EN.
- *Pruebas focales:* `tests/chest-agency.test.js` + `tests/balance-guardrail.test.js`.

#### Criterios de aceptación de cierre CH-4/CH-5

| ID | Criterio verificable | Evidencia automatizada | Estado |
|---|---|---|---|
| AC-4.1 | Cada tipo entrega 2–4 `items`, monedas garantizadas y un payload JSON sin ciclos. | `chest-ceremony`: tamaños/payload | ✅ |
| AC-4.2 | Tier-up estricto `<0.10`, ruta correcta, odds visibles y escala nivel 1→31 limitada a ×2,5. | `chest-ceremony`: tier + escala | ✅ |
| AC-4.3 | Bonus 52/23/13/12; booster válido entra y sale del arsenal sin saldo negativo. | `chest-ceremony`: 25.000 tiradas + stock | ✅ |
| AC-4.4 | Reveal secuencial y alternativa reduced-motion; medallas 750/1500/2500 no derivan. | `chest-ceremony` + `balance-guardrail` | ✅ |
| AC-4.5 | Preview y ceremonia son exclusivas; ficha/contenido no se superponen; el ascenso solo interrumpe si ocurre y atlas/movimiento usan animaciones separadas. | `chest-ceremony` + `chests-redesign` + `hub-views-redesign`/`fb-regression` | ✅ |
| AC-5.1 | Choice nace listo, no concede nada al generarse y aplica solo una opción una sola vez. | `chest-agency`: persistencia/claim/idempotencia | ✅ |
| AC-5.2 | Catch-up concede Plata solo con hueco ≥2 días y conserva Choices pendientes previos. | `chest-agency`: matriz de fechas | ✅ |
| AC-5.3 | Event conserva snapshot al rotar semana, garantiza su booster y no aparece en el ciclo genérico. | `chest-agency`: snapshot/ciclo | ✅ |
| AC-X.1 | Sim de cofres es determinista, usa APIs reales y no deja mutado estado, storage ni RNG. | `balance-guardrail` + CLI `--chests` | ✅ |

### Fuera de alcance deliberado

- Push server-side (no hay backend), compra de gemas con dinero real, duplicados de cosméticos (nuestra ventaja),
  pérdida de cofres por ranuras llenas (crueldad innecesaria: CR mismo se aleja de eso).

---

## §6 · Bitácora

- 2026-07-18 — Documento creado: auditoría del sistema v2.6.85, benchmark CR (jul 2026) con fuentes, plan CH-1…CH-5. Sin código tocado.
- 2026-07-18 — **CH-1 completado (v2.6.87).** (1) Banda "Posibles recompensas" honesta: fuera potenciadores/objetos/"y más" fantasma,
  dentro tickets; (2) ficha "Contiene" rellena por `buildChests()` con rangos y % reales vía nuevo helper `chestOdds(type)`
  (expuesto en `__cv`); (3) catálogo con filas de probabilidades (monedas/gemas/cosmético) por tipo; (4) la tarjeta de cofres de
  Eventos muestra cuenta atrás del desbloqueo activo o "¡Listo!" — la lógica se unificó en `syncHomeChests()` (el chip antiguo de
  Inicio ya no existía en el DOM: era un no-op silencioso) y `refreshEvents()` delega en ella; refresco de 30 s en `init()`.
  Claves i18n nuevas ES/EN: `chest_odds_title`, `chest_odds_cosmetic`, `home_chest_opening`. Tests: +3 en `chests-redesign`
  (banda honesta, chestOdds exactos y suma ≈100%, paridad i18n) y ajuste del test de Eventos en `home-redesign`. Suite 179/181
  (los 2 fallos son de board-themes, preexistentes). QA en navegador: estados Abriendo/Listo/contador verificados en Eventos y
  ficha con datos reales en la vista. Ojo QA local: el SW cache-first sirve copias viejas bajo el mismo `?v=`; purgar SW al probar.
- 2026-07-18 — **CH-2 completado (v2.6.88).** Schema `cv_meta` 4→5 (aditivo): `chestPipeline{wins,cycle}` + `dailyChest{date}`.
  `Meta.recordChestProgress(source)`: cada objetivo suma; cada 3 cae el siguiente cofre de `CHEST_DROP_SEQUENCE` (el ciclo por fin
  se usa; garantiza 1 champion + 1 divine por vuelta de 32). Objetivos cableados: nivel de Clásico (`_classicComplete`), nivel de
  Aventura (`levelComplete`), tablero limpio en Zen, Contrarreloj libre con score ≥1000 (en `recordGame`, excluye Reto), primera
  medalla del día del Reto (`recordDailyRun`, 1/día), run de Supervivencia con oleada ≥5 (`recordSurvivalRun`; su escalera 10/20/…
  sigue intacta como bonus). Cofre diario: primer objetivo del día → +1 bronce. Reto semanal → +1 cofre de evento (antes solo XP).
  UI: tarjeta de progreso = pipeline (n/3) + línea de pity ("Siguiente del ciclo: X · Mítico o mejor en ≤ N cofres");
  `chestProgressToast()` unifica el feedback. Strings ES/EN actualizadas (regla, vacíos) + 5 claves nuevas. Tests: nuevo
  `tests/chest-pipeline.test.js` (8 tests: ciclo determinista, diario 1/día, pity, semanal→event, contrarreloj/reto/supervivencia,
  escalera intacta). Suite 187/189; balance-sim sin cambios en partida (el pipeline es meta-economía; guardarraíl de medallas OK).
  QA navegador: 3 objetivos → cofre de madera, pity avanza a "bronce · ≤23".
- 2026-07-18 — **CH-3, entrega inicial (el commit dejó v2.6.90; cierre auditado en v2.6.92).** (1) Duraciones consolidadas a 5 valores legibles — wood/bronze 3 h,
  silver/gold/event 8 h, magic/royal 12 h, supreme/champion 24 h, divine 36 h — y **tarifa plana de salto: 3 💎/h exactos**
  (9/24/36/72/108; el salto total del divine sube 75→108, pero la regla es aprendible y el prorrateo hace barato el caso real de
  "afeitar las últimas horas"). (2) Modelo de temporizadores nuevo: los cofres terminados pasan a `chestReady[]` (recogida gratis,
  NO bloquean) y **el siguiente cofre más corto se auto-encadena anclado al instante exacto de la finalización anterior, también
  offline** (cadena multi-cofre con la app cerrada) — mejora deliberada sobre CR; recoger también auto-arranca el siguiente.
  API: `advanceChestTimers()`, `chestTimerState(uid)`, `chestReadyUids()`; `chestUnlock()` queda como vista del EN CURSO;
  `m.chestUnlock` legacy migra solo vía advance. (3) Badging API: el icono PWA marca el nº de cofres listos (best-effort,
  sin push server — documentado como no-objetivo). (4) La selección por defecto prioriza el cofre LISTO; la reserva explica el
  auto-encadenado; "abrir ahora" ya no se bloquea con otro en curso (tarifa completa). Tests: `tests/chest-timers.test.js`
  (4: tarifa plana, cadena offline, auto-arranque al recoger, costes por estado) y actualización del test de desbloqueo a la
  semántica nueva. Suite 191/193. QA navegador: cadena plata→madera→oro con reloj simulado, recogida gratis con recompensa
  y auto-arranque verificados; chip de Eventos "¡Listo!".
- 2026-07-18 — **CH-3 cerrada tras auditoría contra código (v2.6.92, schema 6).** La revisión del commit anterior encontró
  cuatro incumplimientos que la etiqueta «completado» ocultaba: (1) `chestInventory` no persistía `durationMs`, así que un cofre
  ya ganado cambiaba de duración con el catálogo; ahora cada entrada captura su duración y la migración asigna el mapa pre-CH-3
  (3/4/6/8/12/16/20/24/36/6 h), sin tocar `startedAt`/`endsAt` del `chestUnlock` activo; el salto se calcula directamente como
  `ceil(3 × horas restantes)`, también para timers legacy. (2) El catch-up offline tenía un tope fijo de 12 transiciones pese a
  que la reserva es ilimitada; el límite seguro ahora deriva de `inventory.length`. (3) La reserva era solo «+n»: ahora muestra
  una cola horizontal ordenada por la misma prioridad real del motor (duración guardada → `earnedAt` → orden estable), permite
  seleccionar cofres fuera de las ranuras y mantiene visible un timer auto-iniciado desde la reserva. (4) Se añadió permiso
  explícito y notificación local best-effort una vez por UID listo (Service Worker con fallback `Notification`), reentrada por
  `visibilitychange`, gestión de clic y `.catch()` para rechazos de Badging; no se promete push con la app cerrada. El Home
  proyecta «Abriendo/¡Listo!» en un chip compacto sobre Eventos, sin duplicar la tarjeta que la arquitectura reserva a esa vista.
  Cobertura nueva en `tests/chest-timers.test.js` y `tests/chests-redesign.test.js`: duración nueva/legacy, compat del unlock
  activo, tarifa plana, >12 cofres offline, orden por snapshot, auto-inicio desde fuera de ranuras, aviso idempotente, cola UI,
  Home y APIs best-effort. Verificación final: suite focalizada 30/30; suite global 200/202 (los 2 fallos restantes de
  `board-themes-redesign` son preexistentes y ajenos a cofres); sintaxis y ESLint sin errores; `balance-sim` exit 0. QA real
  390×844: cola +2 sin overflow, selección de Oro en reserva, timer de 8 h visible fuera de ranuras y chip `8h 00m` en Eventos;
  consola limpia.
- 2026-07-18 — **CH-4 cerrada contra código (schema 7, sin reescribir el baseline §1–§4).** `openChest()` pasó de una
  recompensa a ceremonia de 2–4 `items`: monedas garantizadas, tirada principal y extras 52/23/13/12; tier-up visible
  del 10% antes de revelar; monedas/gemas escalan +5% por nivel con tope ×2,5. `boosterStock` persiste cinco boosters,
  recibe drops y sustituye el coste en monedas únicamente cuando el jugador confirma ese booster en una preparación.
  `tests/chest-ceremony.test.js` certifica número/serialización, límites del tier, escala, distribución de 25.000 bonus,
  stock, reduced-motion y medallas sin deriva.
- 2026-07-18 — **CH-5 cerrada contra código (schema 8).** El primer objetivo del día crea un Choice Bronce de tres
  opciones ya persistidas y **listo inmediatamente**; un hueco de ≥2 días eleva solo el nuevo cofre a Plata. La ruta
  aleatoria no puede abrirlo y el claim válido es único/idempotente. El cofre de evento captura semana, reto y booster
  destacado al ganarse; rotar semana no altera el snapshot y la apertura garantiza ese booster. La migración conserva
  cofres pero degrada Choices manipulados a su cofre normal y completa eventos legacy. `tests/chest-agency.test.js`
  cubre opciones defensivas, economía antes/después, cola, catch-up, pendientes simultáneos, snapshot y ciclo sin `event`.
- 2026-07-18 — **Guardarraíl CH-4/CH-5 documentado y ejecutable.** `tools/balance-sim.js --chests` y la API exportada
  `runChestEconomy({runs, seed, types, levels})` recorren las APIs reales sobre un perfil canónico, informan EV por
  tipo/nivel y restauran estado/storage/RNG. Los comandos y resultados de la verificación focal quedan en los criterios
  de aceptación de §5.
- 2026-07-18 — **Plan CH-1…CH-5 concluido y verificado en v2.6.98 (schema 8).** Verificación focal CH-4/CH-5 y
  regresiones relacionadas: **63/63**. Suite global: **224/226**; los únicos dos fallos son los ya existentes y ajenos a
  cofres en `tests/board-themes-redesign.test.js` (aislamiento de `.board-wrap::before` y contrato de versión de tema
  `4` frente a `4.1`). Sintaxis y `git diff --check`, correctos; ESLint: 0 errores y 5 avisos preexistentes por símbolos
  sin uso. `balance-sim` estándar (40 runs/config) y `balance-sim --chests` (200 aperturas/tipo-nivel) terminan con exit 0;
  el primero conserva su `TimeoutNaNWarning` preexistente; el evento mantiene EV de booster 1,00 y `divine` tier-up 0%.
  QA real en navegador: escritorio y 390×844, partida de Clásico hasta generar un Choice real, elección y reveal
  verificados, CTA único, confinamiento/restauración de foco, sin overflow horizontal y consola limpia. La ruta
  reduced-motion queda cubierta por la suite focal. Versión sincronizada en `game.js`, `index.html` y `sw.js`.
- 2026-07-18 — **Corrección UX post-cierre de CH-4 (v2.7.0; schema global 9, sin cambio de datos de cofres).** Una QA
  de estrés posterior detectó que la ceremonia se renderizaba dentro del contenedor de muestra cerrada y que las
  tarjetas «Tipo de cofre»/«Qué puede contener» seguían como overlays, recortando y solapando estados en móvil.
  Preview y ceremonia pasan a secciones hermanas exclusivas; cofre, acciones e información quedan en flujo normal y
  la ceremonia obtiene su propio escenario. «Mejora de cofre» se reformula como posibilidad de ascenso del 10%, el
  90% negativo deja de interrumpir y el éxito persiste explicado en la pantalla de premios, también con movimiento
  reducido. La apertura separa frames discretos del atlas y desplazamiento continuo de 720 ms, elimina filtros del
  tramo animado y predecodifica el atlas antes de empezar. Selección, catálogo y ceremonia conservan/recuperan foco.
  Fixture local aislada: 24 cofres y 100.000 gemas, con snapshot restaurado al salir. QA real: **21 aperturas**
  consecutivas —incluido ascenso Evento→Real— en 390×844 y 1280×800; 0 solapes medidos, 0 overflow horizontal y
  consola sin warnings/errores. Verificación focal de cofres: **82/82**. Suite global: **253/255**; solo permanecen
  los dos fallos preexistentes de `board-themes-redesign` ya documentados. Versión sincronizada en
  `game.js`, `index.html` y `sw.js`.
- 2026-07-18 — **El arsenal se conecta a la economía (v2.7.1).** Supervivencia elimina las 10 unidades gratuitas
  iniciales y ofrece un loadout opcional de hasta 3 tipos: stock primero y compra con monedas para faltantes, todo en
  un único commit. Cerrar el lanzador no gasta; reintentar vuelve a preparación; las unidades no usadas son por intento;
  Daily permanece neutral. El anillo interior ya no imprime boosters: cada 100 de suministro paga 2 monedas en Normal
  (~3 en Difícil), mientras `pack` conserva su papel de premio raro y exclusivo de la run. A/B con 40 runs/config:
  +12,9%…+19,8% monedas/run, dentro del guardarraíl de +20%. El stock persistente es inaccesible y no robable durante
  la run; el Cerrajero devuelve exactamente lo enjaulado.
