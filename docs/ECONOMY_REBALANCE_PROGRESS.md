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
| ECO-1 Monedas | ⬜ pendiente | — | |
| ECO-2 Gemas/tickets | ⬜ pendiente | — | |
| ECO-3 Cofres/cosméticos | ⬜ pendiente | — | |
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
