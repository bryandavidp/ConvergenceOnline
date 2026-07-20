# Progreso del reequilibrio económico (ECONOMY_REBALANCE_README.md)

> **Documento de traspaso.** Registra el estado real de ejecución del plan
> [`ECONOMY_REBALANCE_README.md`](./ECONOMY_REBALANCE_README.md) para que cualquier
> agente/persona pueda continuar exactamente donde se quedó el anterior.
> Actualizar SIEMPRE al cerrar (o dejar a medias) cada tarea `ECO-*`.
>
> Rama de trabajo: `claude/economy-rebalance-readme-wthx1b` · Baseline: v2.9.3

## Estado por fase

| Fase | Estado | Commit | Notas |
|---|---|---|---|
| ECO-0 Medición/configuración | ✅ HECHA | (ver git log: "ECO-0") | EconomyConfig + EconomyAudit + forecast con políticas. Sims idénticos bit a bit al baseline |
| ECO-1 Monedas | ✅ HECHA | (ver git log: "ECO-1") | settlementCoins con sqrt · Clásico con factor de tiempo · presupuesto anti doble pago |
| ECO-2 Gemas/tickets | ✅ HECHA | (ver git log: "ECO-2") | Tope 6💎/día · escalado separado · Choice sin nivel · swap/regen con tickets |
| ECO-3 Cofres/cosméticos | ✅ HECHA | (ver git log: "ECO-3") | Rareza por tier · fallback consumible · EV analítico creciente · monedas de cofres ×0,5 |
| ECO-4 Sumideros | ⬜ pendiente | — | |
| ECO-5 Tienda | ⬜ pendiente | — | |
| ECO-6 Cola de cofres | ⬜ pendiente | — | |
| ECO-7 Forecast 30/90/180 | ⬜ pendiente | — | |
| ECO-8 UX y release | ⬜ pendiente | — | |

## Batería "ANTES" (v2.9.3, congelada 2026-07-20)

`node tools/balance-sim.js --runs 40` sobre `1739884` (HEAD al empezar):

```
modo           diff      perfil    sc p50   sc p90   dur50  combo    progreso  deadAir    err  coins    cap
clasico        normal    skilled    53910    77475     14s     x7      13 nvl      67%    0.3      0   100%
aventura       normal    skilled    47806    97319    354s    x12      nvl 12      72%    4.8    759    95%
contrarreloj   normal    skilled   150442   171249    225s   x121       nvl 1      25%    8.0   3991     5%
supervivencia  normal    skilled   197410   398436    480s    x26   oleada 18      61%    8.2   5397   100%
clasico        normal    average    35660    46080     31s     x8       9 nvl      43%    1.8      0   100%
aventura       normal    average    27517    51661    356s    x10       nvl 8      53%   10.8      0   100%
contrarreloj   normal    average    29419    43389    168s    x27       nvl 1      14%    9.7    871     0%
supervivencia  normal    average   114359   191780    480s    x20   oleada 18      36%   20.8   1634   100%
clasico        normal    casual     13490    18090     53s     x7       5 nvl      17%    6.0      0   100%
aventura       normal    casual     19272    28186    356s    x11       nvl 6      16%   21.9     33    98%
contrarreloj   normal    casual      3857     6583    113s    x10       nvl 1       3%    7.9    175     0%
supervivencia  normal    casual     33483    40800    480s    x14   oleada 18      13%   29.3    594   100%
supervivencia  dificil   skilled   625841   901784    480s    x41   oleada 22      42%   12.3   1492   100%
zen            normal    casual      6294     8122    240s    x10       nvl 1      23%   12.7    195   100%
```

`node tools/balance-sim.js --chests --runs 40` (EV por cofre, seed 0xc0ffee):

```
wood      L1 C94.9 G1.95 T0.15 | L10 C155 G2.40 | L20 C217 G3.15 | L31 C271 G6.15
bronze    L1 C168 G2.33 | L10 C205 G3.60 | L20 C324 G5.42 | L31 C361 G5.92
silver    L1 C216 G2.92 | L10 C277 G6.20 | L20 C360 G6.72 | L31 C513 G10.1
gold      L1 C296 G3.17 | L10 C358 G6.15 | L20 C498 G7.47 | L31 C646 G13.0
magic     L1 C342 G3.05 | L10 C537 G7.95 | L20 C786 G10.6 | L31 C859 G9.65
royal     L1 C499 G6.58 | L10 C477 G9.40 | L20 C1024 G6.55 | L31 C998 G15.5
supreme   L1 C580 G8.40 | L10 C875 G7.72 | L20 C1359 G14.3 | L31 C1424 G16.5
champion  L1 C658 G6.97 | L10 C993 G8.53 | L20 C1272 G12.7 | L31 C1763 G16.5
divine    L1 C907 G8.28 | L10 C957 G16.9 | L20 C1911 G13.2 | L31 C1893 G35.0
event     L1 C272 G1.35 | L10 C403 G5.50 | L20 C515 G3.50 | L31 C576 G10.3
```

**Lectura del ANTES (la inflación que denuncia el plan, ahora medida):**
Contrarreloj hábil genera ~3.991 monedas en ~4 min (≈1.000/min) y Supervivencia
hábil ~5.397 en 8 min — hasta ×20 sobre el objetivo de §3.1 del plan (600–900/10 min
para hábil). Supervivencia difícil hábil ~1.492 en el sim (el bot no revive). El
catálogo completo (33.080 monedas) se compraría en ~2 días de juego hábil.

## Hallazgos del arranque (leer antes de tocar nada)

1. **2 tests fallan YA en el baseline** y son ajenos a la economía:
   `tests/board-themes-redesign.test.js` (tests 4 y 5, aislamiento de CSS
   `.board-wrap::before` y conteo de assets). No intentar arreglarlos como parte
   de este plan; no usarlos como señal de regresión propia.
2. `game.js` tiene ~12.270 líneas (la tabla de ARCHITECTURE.md §4 está desfasada
   en números de línea, pero el orden de módulos sigue siendo válido).
3. **Mapa real de la economía en v2.9.3** (líneas aproximadas en game.js al inicio):
   - `Config` (l.90): `BOOSTER_PRICES`, `PRELEVEL_BOOSTERS`, `CONTINUE_GEMS: 15`.
   - Cofres (l.2940–3070): `CHEST_TYPES` (tablas reward por tier),
     `CHEST_SKIP_GEMS_PER_HOUR=3`, `chestLevelScale()` = ×(1+0.05·(nivel−1)), tope ×2.5
     — escala monedas Y gemas, `CHEST_GUARANTEED_COIN_SHARE=0.25`,
     `CHEST_UPGRADE_CHANCE=0.10`, `CHEST_BONUS_ODDS`.
   - `Meta` (l.3123–4277): `recordGame()` → monedas = `score/40 + maxCombo*2 +
     level*5 + perfect*40` (+60 misión, +200 semanal); `claimReward()` (login) =
     `20+10·min(día,7)`; `DAILY_FIRST_GEMS=5`; `PREMIUM_CHEST_GEMS=25` (tabla en
     `openPremiumChest`); `CHEST_SLOT_GEMS=150`; `CHEST_PIPELINE_TARGET=3`;
     fallback cosmético agotado = jackpot de monedas ×1.35 del máximo (l.3803).
   - `Storefront` (l.4324): `CURRENCY_OFFERS` (100/330/1200 gemas · 1000/6000/18000
     monedas), `XP_BOOST_OFFERS` (25/80/160 gemas), `CHEST_OFFERS` (30→900 gemas).
   - `Survival` (l.4938+): `_waveReward()` (l.5279) → monedas por oleada
     `(4+w·1.45)·coinMult` + kicker `(w−14)^1.5·2` desde w≥15; gemas en w%5
     (`2+floor(w/5)`); cofre directo en w%10 (escalera wood→divine);
     `redeemSupply()` (2 monedas/carga); `REVIVE_BASE/CAP/MAX = 120/480/3` (l.5755);
     `TUNE.coinMult` = 0.85/1.0/1.3 por dificultad.
   - `Game._classicComplete()` (l.8707): monedas Clásico = `(20+stars*10+score/60)
     ·(1+racha·10%, tope 50%)` con `awardBaseCoins:false` en recordGame.
   - `Game.boardCleared` (l.~8590): bonus de tablero vacío también paga monedas.
   - `Worlds.claimReward()` (l.7060): mundo completo → +1 cofre royal +20 gemas.
   - Zen (l.8613): flor por tablero limpio; 10 flores → cofre magic; 50 → tablero.
   - Reto diario: `recordDailyRun()` (l.3902) — 5 gemas primer intento del día.
4. El sim (`tools/balance-sim.js`) NO parchea `Date.now`/`new Date` (solo
   `performance.now`): los timers de cofres y las fechas de misiones usan tiempo
   real. Para forecast multi-día hay que virtualizar `Date` (hecho en ECO-0).
5. El bot del sim nunca revive ni compra: la columna `coins` del baseline es
   ingreso puro sin gasto.

## ECO-0 — qué se hizo y cómo verificarlo (2026-07-20)

- **ECO-01 `EconomyConfig`** (game.js, justo antes de `Config`): centraliza
  liquidación (`settlement`), misiones, login, Clásico, precios de boosters,
  `continueGems`, toda la economía de Supervivencia (oleadas/gemas/escalera/
  suministro/revive/coinMult), cofres (tablas reward por tier, escalado por nivel,
  skip, premium, ranura, pipeline) y las 3 listas de ofertas de la tienda.
  `Config.BOOSTER_PRICES`/`PRELEVEL_BOOSTERS`/`CONTINUE_GEMS`, `CHEST_TYPES.*.reward`,
  `Storefront.*_OFFERS`, `Survival.REVIVE_*`/`SUPPLY_COIN_*`/`TUNE.*.coinMult`,
  `Meta.PREMIUM_CHEST_GEMS`/`CHEST_SLOT_GEMS`/`DAILY_FIRST_GEMS`/`CHEST_PIPELINE_TARGET`
  ahora REFERENCIAN EconomyConfig (mismos valores, cero cambio de balance).
- **ECO-02 `EconomyAudit`**: ledger en memoria (tope 4.000 entradas + totales sin
  tope), apagado por defecto, se enciende con `?dev` (y por tanto en tests/sim vía
  dom-stub). Instrumentado: `addCoins/spend/addGems/spendGems/addTickets/spendTicket`
  aceptan `reason` opcional; `addChest`/`openChest`/`claimChestChoice`/`_applyChestReward`
  auditan cofres y su contenido; `recordGame` desglosa `settlement`/`mission-daily`/
  `mission-weekly`; motivos estables en todos los call sites (survival-wave,
  survival-milestone, survival-supply, survival-revive, survival-boss, survival-mini,
  classic-level, board-clear, daily-login, daily-first-try, continue, chest-skip,
  chest-slot, premium-chest, xp-boost, chest-shop, shop-pack, shop-theme, shop-board,
  shop-avatar-icon, shop-avatar-border, booster-loadout, mission-reroll, world-reward).
- **ECO-03 forecast**: `tools/balance-sim.js` ahora tiene `runEconomyForecast()` y
  CLI `--economy --days N --sessions N --minutes M --policy saver|strategic|spender|collector
  --profile skilled|average|casual [--seed S --json out.json]`. Usa un `Date` virtual
  (anclado a 2026-01-05, instalación perezosa que se restaura al terminar) para
  simular días de calendario: misiones diarias, login, choice chest diario, timers
  de cofres. El bot puede REVIVIR de verdad (`Survival.revive()` con `Meta.spend`)
  según la política. Mide: saldos, minted/burned por motivo, objetos comprados,
  revives, aceleraciones, reserva de cofres y horas de cola, día de catálogo completo.
- **Tests nuevos**: `tests/economy-audit.test.js` (7 tests) y
  `tests/economy-forecast.test.js` (4 tests). Test tocado:
  `tests/chest-pipeline.test.js` (la regex de la escalera apunta ahora a EconomyConfig).
- **Puertas ECO-0 verificadas**: sims de gameplay y cofres IDÉNTICOS bit a bit al
  baseline "antes"; suite 276 pass / 2 fail preexistentes; lint 0 errores
  (5 warnings preexistentes); misma seed ⇒ mismo informe (test).
- **Hallazgo para ECO-4/ECO-43**: el `collector` no tiene NADA en qué gastar gemas
  en 2.9.3 (no hay ofertas directas de cosméticos): las gemas solo suben. Confirmado
  por forecast (3 días: +71 gemas, 0 quemadas).

## ECO-1 — qué se hizo y cómo verificarlo (2026-07-20)

- **ECO-10 `Economy.settlementCoins(ctx)`** (game.js, módulo `Economy` tras EconomyConfig):
  `round((base_modo + minutos×15 + scoreCoef×√(score/100) + min(combo,20) + bonusObjetivo) × diffMult)`.
  Calibración final en `EconomyConfig.settlement`: perMinute 15, comboCap 20,
  objectiveBonus 30 (y **0 en contrarreloj/supervivencia/zen**, que ya cobran cada
  tablero limpio en la run), diffMult 0.9/1.0/1.1, scoreCoef por modo:
  aventura 8.5 · contrarreloj 4 · supervivencia 7.5 · zen 5 · default 6.
- **ECO-11 Clásico** (`Economy.classicLevelCoins`): `(28 + estrellas×10 +
  min(70, score/150)) × (1+racha·10%, tope 25%) × factorTiempo`, con
  `factorTiempo = clamp(segundos/90, 0.18, 1)` — **anti-farmeo**: repetir niveles
  triviales en 15 s paga ~1/5; un nivel normal de ≥90 s cobra completo.
- **ECO-12 anti doble pago**: `recordGame` recibe `paidDuringRun` (=`State.coinsRun`:
  oleadas, suministro, jefes, tablero vacío) y liquida `max(0, presupuesto − pagado)`.
  Fuentes en-run recortadas: oleada `(3+0.9w)` (antes `4+1.45w`), kicker ×1.5 (antes ×2),
  coinMult difícil 1.15 (antes 1.3), tablero vacío `clamp(pts/220, 2, 10)` (antes 3–16).
- **Medición nueva**: `node tools/balance-sim.js --rates --runs 25` → monedas/10 min
  con liquidación al corte de sesión (nueva métrica de las puertas §3.1). Resultado:

```
              casual   medio   hábil          objetivo
clasico          450     645     765          (250-450/400-650/600-900)
aventura         445     472     545 (†)
contrarreloj     380     479     631
supervivencia    383     578     709
zen              288       -       -
superv. difícil hábil   1114                  (≤1200) ✅
```
  († ) **Desviación aceptada:** Aventura hábil 545 < 600. Subir su scoreCoef rompería
  el techo casual (445→>450). Se decidió priorizar el techo casual; revisar en ECO-7.
- **Puerta de catálogo (≥20 días) NO se cumple todavía — a propósito:** el forecast
  45 días collector hábil completa el catálogo el **día 11**, pero la fuente dominante
  ya NO es gameplay (dentro de rangos): son los COFRES — el jugador llega a nivel 55
  en 10 días y el escalado ×2,5 de monedas/gemas de cofres + ~10 cofres/día disparan
  el ingreso (+30k monedas y +566 gemas en 10 días). Ese grifo es exactamente lo que
  corrigen ECO-2 (escalado de gemas) y ECO-3 (EV de cofres). **Re-verificar esta
  puerta al cerrar ECO-3.** Datos: scratchpad `eco1-catalog-forecast.txt` (sesión) y
  cifras citadas aquí.
- **Tests**: nuevo `tests/economy-settlement.test.js` (6). Actualizados:
  `economy-audit.test.js` (forma nueva de settlement) y
  `booster-economy-integration.test.js` (coinMult difícil ahora sale de EconomyConfig).
- **Suite**: 282 pass / 2 fail preexistentes. Batería gameplay: score/progresión
  IDÉNTICOS al baseline; columna coins baja como se esperaba (contrarreloj hábil
  3991→232/run, superviv. difícil 1492→929, aventura hábil 759→266).

## ECO-2 — qué se hizo y cómo verificarlo (2026-07-20)

- **ECO-20 tope diario**: `Meta.economyDaily()` (`cv_meta.economyDaily`, retrocompatible,
  cupo íntegro el día de la actualización) + `Meta.addSurvivalGems(n)`. Hitos de
  gemas de Supervivencia: **+1 gema** por hito (antes `2+w/5` creciente e ilimitado),
  tope global **6/día**; alcanzado el tope el hito paga 30 monedas visibles
  (`survival-milestone-fallback`, toast con `surv_gem_cap` ES/EN).
- **ECO-21 escalado separado**: `chestCoinScale` (tope ×2.0) y `chestGemScale`
  (×1.0 — las gemas de cofres YA NO escalan con el nivel). `chestOdds`, `openChest`,
  `_chestBonusRoll`, `openPremiumChest` y el Choice Chest usan el escalado que toca.
- **Recorte de gemas de cofres** (dos pasadas medidas): wood 3-10→1-3, bronze 4-12→1-4,
  silver 5-15→2-5, gold 7-18→2-6, magic 10-24→3-8, royal 14-30→5-11, supreme 18-38→6-13,
  champion 24-48→8-17, divine 35-70→12-24, event 8-22→2-7.
- **ECO-22 Choice Chest**: opción de gemas con rango fijo por tier
  (`choiceGems`: bronce 4–8, plata catch-up 6–10), sin escalado por nivel; la de
  monedas escala moderado (coinScale).
- **ECO-23 tickets**: `Meta.swapChestChoiceOption(uid, optionId)` (1 🎟️, sustituye
  la opción por la CLASE de premio ausente, máx. 1/cofre) y
  `Meta.regenerateChestChoice(uid)` (2 🎟️, re-sortea las 3, máx. 1/cofre). UI real
  en el picker del Choice Chest (entradas extra `__swap`/`__regen` + segundo picker
  para elegir qué sustituir; i18n `choice_*` ES/EN). El reroll de misión sigue a 1 🎟️.
  El punto 4 del plan (intento bonus de reto por tickets) **no aplica**: el Reto del
  día ya permite reintentos gratuitos ilimitados — documentado como N/A.
- **Puertas medidas** (forecast 30 días, seed 15467792):
  - Intensivo (skilled, 6×10 min/día, saver): **19,4 gemas/día** ✅ (≤20).
    Desglose: 5 reto + 6,2 choice (elige gemas) + 5,1 cofres + 3 supervivencia.
  - Medio (average, 2×10 min, strategic): ~10 gemas/día ✅ (ritual 10–14).
  - Supervivencia ≤15 gemas/hora: trivial con tope 6/día ✅.
  - Nivel 31 vs nivel 1: +0% gemas ✅ (test `economy-gems`).
  - Tickets strategic: ganados 26 / gastados 23 → ratio 1,13 ✅ (0,9–1,2).
- **Tests**: nuevo `tests/economy-gems.test.js` (7). Actualizados: `chest-ceremony`
  (escala ×2.0/plano), `chests-redesign` (divine L31), `economy-audit` (forma nueva).
- **Hallazgo medido para ECO-6**: el intensivo acumula **397 cofres / 3.830 h de cola**
  en 30 días (reserva creciente sin tope) — el problema exacto de ECO-6, ya cuantificado.

## ECO-3 — qué se hizo y cómo verificarlo (2026-07-20)

- **ECO-30 rareza**: todos los cosméticos (iconos, bordes, temas, tableros) declaran
  `rarity` (common/rare/epic/legendary/mythic, asignada por coste).
  `EconomyConfig.cosmetics.rarityByTier` define la banda de cada cofre
  (madera/bronce=común · plata/oro=común+raro · mágico/real=raro+épico+legendario ·
  supremo/campeón/divino=épico+legendario+mítico · evento=raro+épico) y
  `minTierByRarity` el cofre mínimo por rareza. `Meta.chestCosmeticPool(tier)`
  filtra por banda; sin argumento devuelve el pool completo (compatibilidad).
- **ECO-32 fallback**: `Meta._cosmeticFallback()` — cuando la tirada cosmética no
  puede entregar objeto nuevo, cae un **booster consumible** (arsenal), nunca
  monedas/gemas escaladas. Eliminados el jackpot ×1,35 y las gemas de madera.
  ⚠️ **Decisión de producto**: el plan recomendaba "fragmentos de estilo"; se
  implementó la alternativa sancionada por el plan (`boosterChoice`) por alcance.
  Si el propietario prefiere fragmentos, se construyen sobre este mismo punto
  (`_cosmeticFallback`) + la tienda rotatoria de ECO-40.
- **ECO-31 doble vía**: la tienda de personalización muestra en cada objeto no
  poseído su rareza y "También en: {cofre mínimo} o superior"
  (`cosmeticDualHint`, i18n `shop_also_in_chest`/`shop_rarity_*` ES/EN, CSS
  `.shop-dual-hint`/`.shop-rarity-*` en styles.css).
- **ECO-33 EV**: `Economy.chestEv(type, level)` — EV equivalente analítico
  (valoración interna `EconomyConfig.valuation`: 1💎=10, ticket=40, booster=80,
  cosmético por rareza 250→2200). Test de monotonía estricta madera→divino en
  niveles 1 y 31. Además, **tablas de monedas de cofres ×0,5** (wood 30–100 …
  divine 500–1200): el valor de los cofres altos vive en sus cosméticos raros,
  no en imprimir divisa.
- **Puerta de catálogo re-medida** (collector, 2×10 min/día): hábil día 16,
  medio **día 19** (antes 11). La puerta "≥20 días" queda al borde para medio y
  no alcanzada para hábil: con el suelo de ingreso de gameplay (§3.1) + ritual,
  el catálogo FIJO de 33.080 se agota en ~16–20 días sí o sí. **Estirar a 30–45
  días requiere ampliar catálogo** (tienda rotatoria ECO-40 + venta directa
  ECO-43) — re-verificar en ECO-7 con esos sumideros activos.
- **Tests**: nuevo `tests/chest-rarity.test.js` (5: rarezas válidas, bandas por
  tier, pool parcial/agotado→fallback, EV monotónico, fallback neutro).
  Actualizados: `fb-regression` (FB-7→ECO-32), `chests-redesign`, `chest-ceremony`.
- Suite: 294 pass / 2 preexistentes. EV sim "después" en scratchpad
  `eco3-chests-final.txt` (números citados arriba quedan en este doc como registro).

## Registro de decisiones tomadas

- (2026-07-20) El baseline "antes" queda congelado en este documento y en
  `scratchpad` de la sesión; la comparación de cada fase se hace contra la tabla
  de arriba, no contra `docs/BALANCE_BASELINE.md` (que documenta eras anteriores).

## Cómo continuar si retomas este trabajo

1. Lee `docs/ECONOMY_REBALANCE_README.md` (el plan) y este documento (el estado).
2. `git log --oneline` sobre la rama para ver qué commits de la lista §6 del plan
   ya existen.
3. Ejecuta `node --test 'tests/*.test.js'` (recuerda: 2 fallos preexistentes de
   board-themes) y `node tools/balance-sim.js --runs 40` para reproducir la batería.
4. Toma la primera fase no completada de la tabla de estado y sigue el plan.
