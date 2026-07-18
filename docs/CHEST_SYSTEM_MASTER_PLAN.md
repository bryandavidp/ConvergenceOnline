# Sistema de cofres — análisis, benchmark contra Clash Royale y plan de mejora

Fecha de análisis: 2026-07-18 · Versión de la app analizada: 2.6.85 (rama `clon-vanilla`)

Complementa a `docs/CHEST_REDESIGN_WORKLOG.md` (registro del rediseño visual ya entregado). Este documento
analiza el **sistema** (economía, funcionalidad, pacing, UX) y lo compara con el sistema de recompensas de
Clash Royale **a día de hoy (julio 2026)**, que ha cambiado mucho desde el modelo clásico de 2016: Lucky Drops
(2024) → Lucky Chests con estrellas (oct 2025) → Choice Chests y catch-up rewards (2026).

---

## §1 · Sistema actual de Convergence (verificado contra el código)

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

## §4 · Puntos de mejora

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
> → schema 5 con migración retrocompatible (patrón `MetaData._v`, MIGRATION_SPEC §3.4).

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

### CH-3 · Tiempos, auto-inicio y avisos (P1 · esfuerzo medio)

1. Consolidar duraciones y tarifa plana de salto (U7, E1) — cuidado: cofres ya en inventario conservan su `durationMs`.
2. Auto-inicio del siguiente cofre más corto al completarse el activo (F5).
3. Badging API + estado listo en Home + notificación local best-effort (F6).
4. Reserva como cola visible que alimenta el auto-inicio (E2).
- *Pruebas:* transición de temporizadores con reloj simulado; compat de `chestUnlock` previo.

### CH-4 · Ceremonia de apertura (P1 · esfuerzo medio-alto)

1. Multi-tirada por tamaño con reveals encadenados por toque (U3) — reduced-motion: revelado inmediato en lista.
2. Ruleta de mejora de tier con odds visibles (U4).
3. Drops de potenciadores/objetos reales con inventario (F8; desbloquea ROADMAP 3.2).
4. Escalado de rangos con nivel meta (F7) — pasar balance-sim antes/después.
- *Pruebas:* distribución de multi-tirada, inventario de boosters, guardarraíl de medallas.

### CH-5 · Agencia y eventos (P2 · esfuerzo medio)

1. Choice Chest diario: 3 recompensas visibles, elige 1 (U5).
2. Catch-up del cofre diario (E4).
3. Cofre `event` ligado a eventos/temporadas reales cuando exista el sistema de eventos (dep.: ROADMAP).

### Fuera de alcance deliberado

- Push server-side (no hay backend), compra de gemas con dinero real, duplicados de cosméticos (nuestra ventaja),
  pérdida de cofres por ranuras llenas (crueldad innecesaria: CR mismo se aleja de eso).

---

## §6 · Bitácora

- 2026-07-18 — Documento creado: auditoría del sistema v2.6.85, benchmark CR (jul 2026) con fuentes, plan CH-1…CH-5. Sin código tocado.
