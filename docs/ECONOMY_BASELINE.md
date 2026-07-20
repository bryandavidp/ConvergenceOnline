# Baseline económico longitudinal (ECO-7)

> Forecast de la economía completa a 30/90/180 días con partidas REALES
> (bots deterministas de `tools/balance-sim.js`) + políticas de gasto por las
> APIs de producción, calendario virtual y ledger `EconomyAudit`.
> Documento requerido por `ECONOMY_REBALANCE_README.md` · Fase ECO-7.

- **Versión**: economía post ECO-0…ECO-6 (base v2.9.3, rama `claude/economy-rebalance-readme-wthx1b`).
- **Seed**: `15467792` (0xEC0510). Misma seed ⇒ mismo informe (test `economy-forecast`).
- **Simulaciones**: 6 perfiles del plan × horizontes 30/90 (180 para medio y no-gastador).
- **Reproducir**: `node tools/balance-sim.js --economy --days N --dayspw D --sessions S --minutes M --policy P --profile X --checkpoints 30,90,180 [--json out.json]`

## Tabla de resultados

| Perfil (plan) | Config sim | Día | Monedas saldo (+minted/−burned) | Gemas saldo (+/−) | Tickets | Cosméticos | Reserva cofres / cola | Nivel | Catálogo |
|---|---|---:|---|---|---:|---:|---|---:|---|
| Casual (saver) | casual · 1×8 min · 4 d/sem | 30 | 3.292 (+3.292/−0) | 54 (+204/−150) | 2 | 0 | 0 / 0 h | 9 | no |
| | | 90 | 10.730 (+10.730/−0) | 432 (+582/−150) | 6 | 1 | 0 / 0 h | 16 | no |
| Medio (strategic) | average · 2×10 min · 6 d/sem | 30 | 4.218 (+42.168/−37.950) | 28 (+268/−240) | 5 | 32 | 2 / 16 h | 59 | **día 27** |
| | | 90 | 67.949 (+126.369/−58.420) | 53 (+803/−750) | 33 | 32 | 1 / 22 h | 104 | |
| | | 180 | 197.840 (+256.980/−59.140) | 93 (+1.563/−1.470) | 85 | 32 | 0 / 0 h | 148 | |
| Hábil (strategic) | skilled · 3×10 min · 7 d/sem | 30 | 30.214 (+76.724/−46.510) | 2 (+302/−300) | 18 | 32 | 13 / 291 h | 125 | día 17 (†1) |
| | | 90 | 167.486 (+231.246/−63.760) | 18 (+918/−900) | 31 | 32 | 36 / 915 h (†2) | 216 | |
| Intensivo (saver) | skilled · 6×10 min · 7 d/sem | 30 | 138.809 (+138.809/−0) | 414 (+564/−150) | 27 | 12 | 17 / 310 h | 184 | no |
| | | 90 | 416.710 (+416.710/−0) | 1.605 (+1.755/−150) | 98 | 27 | 41 / 858 h (†2) | 320 | no |
| Coleccionista (collector) | average · 2×10 min · 6 d/sem | 30 | 2.113 (+41.643/−39.530) | 41 (+431/−390) | 2 | 32 | 1 / 6 h | 59 | **día 30** |
| | | 90 | 69.823 (+127.453/−57.630) | 63 (+1.263/−1.200) | 1 | 32 | 1 / 15 h | 104 | |
| No gastador (saver) | average · 2×10 min · 6 d/sem | 30 | 40.303 (+40.303/−0) | 310 (+460/−150) | 22 | 9 | 1 / 6 h | 59 | día 93 (‡) |
| | | 90 | 124.741 (+124.741/−0) | 1.182 (+1.332/−150) | 62 | 31 | 1 / 15 h | 104 | |
| | | 180 | 256.302 (+256.302/−0) | 2.362 (+2.512/−150) | 114 | 32 | 0 / 0 h | 148 | |

(‡) El "no gastador" completa cosméticos solo vía cofres — día 93 sin gastar una moneda.

## Lectura contra las puertas del plan

| Puerta | Resultado |
|---|---|
| Catálogo medio en 30–45 días | ✅ strategic día 27 · collector día 30 |
| Medio no completa antes de 25 días | ✅ (guardarraíl de CI `economy-guardrail`) |
| Intensivo ≤20 gemas/día (30 días) | ✅ 564/30 = 18,8 · a 90 días 19,5 |
| Gemas en circulación (no acumulación premium) | ✅ medio 94% quemadas · coleccionista 95% · hábil 98% |
| Reserva P50 estable 14 días (jugador medio) | ✅ 0–2 cofres en medio/coleccionista/no-gastador |
| 1 h/día Supervivencia ≤24 h de cola generada | ✅ escalera 1/tier/día + pipeline ≤4/día |
| Ratio tickets strategic 0,9–1,2 | ⚠️ ver desviación †3 |
| Ninguna oferta dominada | ✅ tests `economy-dominance` |
| Fallback de colección no imprime divisa | ✅ tests `chest-rarity` |
| Saldo P90 monedas >20%/mes tras día 90 | ⚠️ ver desviación †4 |

## Desviaciones conocidas (aceptadas y vigiladas)

- **†1 Hábil completa catálogo en 17 días**: un jugador de percentil alto con
  30 min/día gana 600–900/10 min (banda §3.1 respetada) — con un catálogo FIJO
  de 33.080, la aritmética no da para 20+ días. El objetivo de producto (30–45
  días) se define para el jugador medio de 1–2 sesiones y SÍ se cumple. Mitigación
  ya activa: la rotación de estilo añade ~30-40k de catálogo vivo. Revisar si se
  añade contenido premium (ECO-43 ya da sumidero de gemas).
- **†2 Reserva creciente en hábil/intensivo** (36–41 cofres a 90 días): son
  acumuladores que nunca aceleran ni compran. El goteo diario (pipeline ≤4 +
  escalera 1/tier) limita la generación; la cola se procesa a ~5-6 cofres/día.
  El jugador medio es estable. Aceptado: la reserva no caduca ni castiga.
- **†3 Tickets del strategic crecen a largo plazo** (85 a 180 días): el sumidero
  regen (2🎟️) absorbe el flujo cuando se usa (el coleccionista termina con 1–2
  tickets), pero la política strategic solo usa swap (1/día). Capacidad de
  sumidero existe; el guardarraíl de CI acota el corto plazo (≤12 a 21 días).
  Vigilar en playtest; palanca disponible: más usos de regen o coste dinámico.
- **†4 El saldo de monedas del medio crece tras completar catálogo+rotación**
  (~43k/mes entre día 90 y 180): con todo comprado, quedan boosters/revives/
  aceleraciones como únicos sumideros repetibles de monedas. Es la señal
  esperada de "falta contenido nuevo", no de fórmulas rotas (el ingreso por
  10 min sigue en banda §3.1). La palanca de producto es añadir catálogo
  rotatorio nuevo por temporadas.

## Decisiones aceptadas en esta fase

- Prioridad de compra realista en las políticas del sim: la rotación diaria
  (caduca hoy) se compra ANTES que el catálogo permanente.
- Recorte de tickets en cofres altos (gold [1,3] · magic [2,3] · royal [2,4] ·
  supreme [3,5] · champion [4,6] · divine [5,8] · event [1,3]) para acercar el
  ratio ganado/gastado al objetivo semanal 4–8.
- Guardarraíles de CI en `tests/economy-guardrail.test.js` (≈40 s): catálogo
  ≥25 días (collector medio), ≤21 gemas/día (proxy 14 días del intensivo),
  tickets/reserva/gasto bajo strategic a 21 días. Los de horizonte largo (†4)
  se verifican con esta matriz, no en CI.
