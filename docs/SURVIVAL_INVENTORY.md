# 🎮 Inventario del Modo Supervivencia — Convergence

> **Última actualización**: 11 julio 2026  
> **Versión del juego**: v2.6.6  
> **Código fuente**: [game.js](file:///c:/Users/bryandavidp/Desktop/ConvergenceOnline/game.js) módulo `Survival`  
> **Estado general**: Funcional con todas las tareas GM completadas. Rebalance de bendiciones **validado por simulación** en SV-01 (fase α del [`SURVIVAL_MASTER_PLAN.md`](./SURVIVAL_MASTER_PLAN.md)); batería y bisección en [`BALANCE_BASELINE.md`](./BALANCE_BASELINE.md).

---

## 1. Concepto y Enganche

### Filosofía de diseño
Supervivencia es el modo **"endless replayable"** del juego, diseñado como contraparte del modo Aventura (progresión finita). La fantasía del jugador es **"Superviviente: poder contra el caos"**. Las bendiciones post-jefe se inspiran en *Slay the Spire* para dar dirección de build por run. Tres dificultades seleccionables antes de empezar (`cv_surv_diff`).

### Registro del modo (Config, [línea 158](file:///c:/Users/bryandavidp/Desktop/ConvergenceOnline/game.js#L158))
```js
supervivencia: { name: 'Supervivencia', emoji: '❤️', timed: false, penalties: true, mult: 1.5, fast: true, endless: true }
```
- **Multiplicador de score**: ×1.5 (el más alto de todos los modos)
- **Endless**: sin "nivel completo" — dura hasta morir
- **Penalties**: sí (errores aceleran spawns)
- **Not timed**: sin cuenta atrás (se registra el tiempo pero no es restricción)

### Hooks de engagement
| Hook | Mecánica | Psicología |
|---|---|---|
| "¿Puedo superar mi récord de oleadas?" | `cv_meta.survBestWave` persistido | Anchoring (oleada como referencia) |
| "¿Qué bendición me tocará tras el jefe?" | Pick 1 de 3 post-boss | Fear→Greed cycle |
| "¡Estaba a 1 oleada del cofre!" | Cofre cada 10 oleadas | Near-miss / variable reinforcement |
| Encadenar combos → Fiebre | Combo ×10→Fever, Frenesí→×1.85 | Flow state |
| "Una vida más y lo habría logrado" | 3 vidas, alivio al morir | Tensión dramática peak |
| Mutador semanal | Variante nueva cada lunes | Razón de revisita periódica |

### Loop principal
```
Inicio (3 vidas, pool N5) → Oleada temporal (22-32s)
  → Iconos caen → Convergencias = puntos + carga + frenesí
  → Oleada completa = monedas (+gemas/cofre en hitos)
  → Cada bossEvery oleadas = Evento jefe → Bendición (pick 1/3)
  → Spawn se acelera, iconos nuevos entran, trampas crecen
  → Tablero lleno = overflow → -1 vida (+40% alivio)
  → 0 vidas = Revivir? (120→240→480 monedas) o Game Over
```

---

## 2. Tabla de Dificultad (TUNE)

### [Survival.TUNE](file:///c:/Users/bryandavidp/Desktop/ConvergenceOnline/game.js#L2792-L2795)

| Parámetro | Fácil | Normal | Difícil | Descripción |
|---|---|---|---|---|
| `waveMs` | 32,000 | 28,000 | 22,000 | Duración de oleada (ms) |
| `lives` | 4 | 3 | 3 | Vidas iniciales |
| `spawnDecay` | 0.985 | 0.975 | 0.960 | Factor de aceleración de spawn por oleada |
| `spawnFloor` | 2,000 | 1,400 | 900 | Intervalo mínimo de spawn (ms) |
| `trapBase` | 0.008 | 0.010 | 0.016 | Densidad base de trampas |
| `trapCap` | 0.05 | 0.07 | 0.10 | Densidad máxima de trampas |
| `varEvery` | 8 | 6 | 5 | Oleadas entre bump de iconos |
| `bossEvery` | 8 | 6 | 5 | Oleadas entre eventos jefe |
| `coinMult` | 0.85 | 1.0 | 1.3 | Multiplicador de monedas por oleada |

### Caps de tiles especiales ([líneas 2785–2787](file:///c:/Users/bryandavidp/Desktop/ConvergenceOnline/game.js#L2785-L2787))

| Cap | Fácil | Normal | Difícil |
|---|---|---|---|
| `SPECIAL_CAP` (total especiales) | 6 | 7 | 8 |
| `BLOCK_CAP` (locks/rocks) | 4 | 5 | 6 |
| `BOMB_CAP` (bombas pickup) | 2 | 2 | 3 |

### Hits de bloques ([línea 2975–2978](file:///c:/Users/bryandavidp/Desktop/ConvergenceOnline/game.js#L2975-L2978))
- Antes de oleada 5/7/9 (difícil/normal/fácil): 1 hit
- Después: 2 hits

---

## 3. Sistema de Oleadas

### Timer y progresión ([newWave, línea 3056](file:///c:/Users/bryandavidp/Desktop/ConvergenceOnline/game.js#L3056-L3085))

Cada tick, `waveAcc += dt`. Cuando `waveAcc >= WAVE_MS`:
1. **Recompensa de oleada** (monedas + gemas/cofre en hitos)
2. `wave++`
3. Bendición `slow` se decrementa si activa
4. **Spawn se acelera**: `spawnRate = max(spawnFloor, round(spawnRate × spawnDecay))`
5. **Progresión de iconos**: `dlevel()` = `1 + floor((wave-1) / varEvery)` — si sube, nuevo pool + reconciliación de huérfanos
6. **Frenesí +=** `8 + frenzyTier() × 3`
7. **Trampas colocadas**: densidad `= min(trapCap, trapBase × max(0, wave-2))`
8. **Bombas pickup**: `1 + floor(wave/6)`
9. 25% chance de slowdown pickup (oleada ≥ 2)
10. **Evento jefe** si `wave % bossEvery === 0`
11. **Plan del próximo jefe** (telegrafiado GM-18)
12. Check de récord de oleada

### Avisos pre-oleada
- **78%** del timer → toast de aviso + sonido ([línea 3025](file:///c:/Users/bryandavidp/Desktop/ConvergenceOnline/game.js#L3025))
- **3 segundos antes del jefe** → aviso ESPECÍFICO del tipo de jefe ([línea 3033](file:///c:/Users/bryandavidp/Desktop/ConvergenceOnline/game.js#L3033-L3046))

### Recompensas por oleada ([_waveReward, línea 2925](file:///c:/Users/bryandavidp/Desktop/ConvergenceOnline/game.js#L2925-L2936))

| Frecuencia | Recompensa | Fórmula |
|---|---|---|
| **Cada oleada** | Monedas | `max(3, round((4 + wave × 1.45) × coinMult × mutCoinMult))` + kicker v2.6.4: `+round((wave−14)^1.5 × 2)` desde la oleada 15 (validado B-S2: coins/run −10% vs v2.4.0 por el refill) |
| **Cada 5 oleadas** (no múltiplo de 10) | Gemas | `2 + floor(wave/5)` |
| **Cada 10 oleadas** | Cofre | +1 cofre |

---

## 4. Eventos Jefe

### Pool ([_bossPool, línea 2837](file:///c:/Users/bryandavidp/Desktop/ConvergenceOnline/game.js#L2837-L2841))
Default: `['meteor', 'tide', 'frost']`  
Semana del caos: se añade `'quake'`

### Telegrafiado (GM-18, [línea 2830](file:///c:/Users/bryandavidp/Desktop/ConvergenceOnline/game.js#L2830-L2846))
- `_planBoss()` pre-decide el tipo al inicio de la oleada anterior
- Bandera ⚠ Boss visible toda la oleada previa
- Aviso específico ~3s antes con toast + sonido + haptics

### Descripción de eventos

| Evento | Efecto | Lock | Código |
|---|---|---|---|
| **Meteor Rain** | 8 spawns forzados | 900ms | [L3122](file:///c:/Users/bryandavidp/Desktop/ConvergenceOnline/game.js#L3122-L3128) |
| **Tide Surge** (GM-20) | Marca 2 filas externas, 1.2s después las llena | 900ms | [L3102](file:///c:/Users/bryandavidp/Desktop/ConvergenceOnline/game.js#L3102-L3121) |
| **Frost Surge** | Congela `min(3 + floor(wave/4), filled, room)` celdas | 760ms | [L3140](file:///c:/Users/bryandavidp/Desktop/ConvergenceOnline/game.js#L3140-L3151) |
| **Quake** (solo chaos) | Fisher-Yates shuffle de valores | 1150ms | [L3130](file:///c:/Users/bryandavidp/Desktop/ConvergenceOnline/game.js#L3130-L3138) |

### Post-jefe: Bendición
~1.7s después del evento → `offerBoons()` ([línea 3098](file:///c:/Users/bryandavidp/Desktop/ConvergenceOnline/game.js#L3098))

---

## 5. Sistema de Bendiciones (Boons) — rediseño v2.6.4 (validado SV-01)

### Mecánica de obtención (`Survival.offerBoons`)
- Se ofrece **tras cada evento jefe** (~1.7s después)
- Se presentan **3 opciones** muestreadas **por peso de rareza, sin reemplazo**, con **RNG seedeado** (`RNG.random()` — el `Math.random()` original rompía el determinismo del simulador y se corrigió en SV-01)
- El jugador elige **1** (Picker con `safe-delay` y borde por rareza `.pick-opt.rarity-*`)
- Exclusiones de pool: `life` si `lives >= MAX_LIVES + 1` · `score_boost` si ya está en `SCORE_BOOST_CAP`
- Sin límite de bendiciones acumulables (los duplicados de `score_boost` apilan hasta el tope)

### Catálogo completo (8 bendiciones)

| ID | Icono | Rareza | Peso | Nombre ES/EN | Efecto (post-nerf SV-01) | Durabilidad |
|---|---|---|---|---|---|---|
| `life` | ❤️ | común | 45 | Vida extra / Extra life | +1 vida (tope MAX+1) | Hasta perderla |
| `charge` | ⚡ | común | 45 | Sobrecarga / Overcharge | +50 carga (≥100 ⇒ booster + remanente) | Instantáneo |
| `slow` | 🐌 | común | 45 | Calma / Calm | Spawn ×1.25 más lento | 3 oleadas |
| `pack` | 💣 | infrecuente | 35 | Arsenal / Arsenal | +1 bomba y +1 rayo | Hasta usarlos |
| `frenzy` | 🔥 | infrecuente | 35 | Furia / Fury | Frenesí instantáneo | ~8-10s |
| `magnet` | 🧲 | rara | 15 | Imán / Magnet | 5 convergencias atraen +1 la figura **más cercana** al toque; sin consumo si no hay nada que atraer (fix SV-03) | 5 usos |
| `score_boost` | 📈 | rara | 15 | Impulso de Puntos / Score Boost | +0.25× permanente a `scoreMult()`, **tope +0.5×** (nerf: era 1.0) | Toda la run |
| `golden_wave` | 👑 | épica | 4 | Oleada Dorada / Golden Wave | `scoreMult()` **×2** (nerf: era ×3) en lo que queda de esta oleada + la siguiente | ~1-2 oleadas |

`Survival.scoreMult() = (1 + scoreBoost) × (goldenWave ? 2 : 1)` — helper centralizado (SV-04): entra en la fórmula de puntos, en el chip GM-16 (`Render.multChip`) y en el popup. Si algún cambio futuro los hace divergir, el multiplicador visible miente (regresión N1).

---

## 6. Boosters (Potenciadores)

### Inventario inicial por run ([línea 2821](file:///c:/Users/bryandavidp/Desktop/ConvergenceOnline/game.js#L2821))

| ID | Nombre | Icono | Cantidad inicial | Tipo | Efecto |
|---|---|---|---|---|---|
| `bomb` | Bomba | 💣 | 2 | Espacial | Limpia área 3×3 |
| `freeze` | Congelación | ❄️ | 2 | Global | Bloquea spawns 7s |
| `clearLine` | Rayo | ⚡ | 3 | Global→Espacial | Limpia fila + columna del objetivo |
| `wild` | Escoba | 🧹 | 2 | Espacial | Limpia grupo más repetido (max 8) |
| `x2` | Comodín | 🃏 | 1 | Global | Doble `tempMult` durante 11s |

**Total inicial**: 10 boosters (2+2+3+2+1)

### Obtención durante la run
- **Barra de carga**: llena con `CHARGE_PER(9) + min(combo, 6)` por convergencia (+4 si frenesí activo, +2 por romper hielo)
- Al llegar a 100 → `grantRandom()`: 1 booster aleatorio, carga se resetea con remainder
- **Bendición `charge`**: +50 carga directa
- **Bendición `pack`**: +1 bomba, +1 rayo
- **Tablero vacío**: +25 carga

---

## 7. Sistema de Frenesí

### Meter (0–100) ([línea 2911](file:///c:/Users/bryandavidp/Desktop/ConvergenceOnline/game.js#L2911-L2924))

**Fuentes de carga:**
| Fuente | Cantidad |
|---|---|
| Convergencia | `4 + min(22, removed×2 + min(combo, 10))` |
| Inicio de oleada | `8 + frenzyTier() × 3` |
| Booster espacial | `min(24, 6 + icons×3)` |
| Tablero vacío | +24 |

### Tiers ([línea 2895](file:///c:/Users/bryandavidp/Desktop/ConvergenceOnline/game.js#L2895))
`frenzyTier() = clamp(floor((wave-1)/4) + 1, 1, 3)`

| Oleadas | Tier | Duración | Score mult | Fever combo need |
|---|---|---|---|---|
| 1–4 | 1 | 8,100ms | ×1.65 | 9 |
| 5–8 | 2 | 9,000ms | ×1.75 | 8 |
| 9+ | 3 | 9,900ms | ×1.85 | 7 |

### Activación
- Meter a 100 → `activateFrenzy()`
- Resetea meter, spawna `2 + tier` iconos extra, confeti, multiplicador activo
- Mutador semanal `frenzy`: duración ×1.3

---

## 8. Scoring Completo

### Fórmula por convergencia (v2.6.4)
```
base = removed × 10 × dlevel
survMult = Survival.scoreMult()   // (1 + scoreBoost) × (goldenWave ? 2 : 1)
points = floor(base × comboMult × diff.scoreMult × 1.5 × feverBoost × tempMult × sprintMult × survMult)
```
El chip GM-16 y el popup muestran `comboMult × feverBoost × tempMult × sprintMult × survMult` (SV-04).

### Tabla de combo ([Config.COMBO_MULTIPLIERS](file:///c:/Users/bryandavidp/Desktop/ConvergenceOnline/game.js#L4581))
| Cadena ≥ | Multiplicador |
|---|---|
| 30 | ×10 |
| 20 | ×8 |
| 15 | ×5 |
| 10 | ×3 |
| 6 | ×2 |
| 3 | ×1.5 |

### Milestones de combo ([Config.MILESTONES](file:///c:/Users/bryandavidp/Desktop/ConvergenceOnline/game.js#L4612))
| Combo | Bonus |
|---|---|
| 10 | +500 |
| 20 | +1,000 |
| 30 | +2,000 |

### Fever boost (Supervivencia): `1.25 + frenzyTier() × 0.06`
### tempMult: `(x2Active ? 2 : 1) × frenzyMult()`

### Multiplicador máximo teórico
```
×10 (combo30) × ×1.3 (difícil) × ×1.5 (modo) × ×1.85 (frenzy T3) × ×2 (x2) × ×1.43 (fever+T3)
= ~×97 base score
```

### Empty board bonus ([línea 4996](file:///c:/Users/bryandavidp/Desktop/ConvergenceOnline/game.js#L4996-L5027))
```
raw = 500 + chain×90 + combo×28 + wave×45
points = max(250, round(raw × scoreMult × 1.5 × feverBoost × tempMult))
coins = clamp(round(points/220), 3, 16)
```
+ Supervivencia: +25 carga, +24 frenesí

---

## 9. Vidas, Overflow y Revivir

### Overflow ([onOverflow, línea 3194](file:///c:/Users/bryandavidp/Desktop/ConvergenceOnline/game.js#L3194-L3201))
- Se dispara cuando el tablero está lleno y un spawn no cabe
- `lives--`; si > 0: **alivio** (40% celdas + 50% bloques rotos), 880ms lock

### Alivio ([_relief, línea 3203](file:///c:/Users/bryandavidp/Desktop/ConvergenceOnline/game.js#L3203-L3221))
- Limpia `frac` (40%) de celdas ocupadas al azar
- Rompe ~50% de bloques (locks/rocks)
- Suena/vibra + animación de limpieza

### Revivir ([líneas 3222–3244](file:///c:/Users/bryandavidp/Desktop/ConvergenceOnline/game.js#L3222-L3244))

| Uso | Coste | Fórmula |
|---|---|---|
| 1° revive | 120 monedas | `min(480, 120 × 2^0)` |
| 2° revive | 240 monedas | `min(480, 120 × 2^1)` |
| 3° revive | 480 monedas | `min(480, 120 × 2^2)` |
| 4° muerte | No se ofrece | `REVIVE_MAX = 3` |

- Revivir restaura 1 vida, alivio del 60%, 900ms lock

---

## 10. Mutador Semanal (GM-22)

### [WEEKLY_MUTS, línea 2849](file:///c:/Users/bryandavidp/Desktop/ConvergenceOnline/game.js#L2849-L2860)

Determinístico: `hash32('survmut:' + mondayISO) % 4`

| # | ID | Efecto |
|---|---|---|
| 0 | `none` | Sin modificador |
| 1 | `ice` | Todas las trampas son heladas (sin locks) + monedas ×1.15 |
| 2 | `chaos` | Quake vuelve al pool de jefes |
| 3 | `frenzy` | Duración de frenesí ×1.3 |

Se anuncia con toast al inicio de la run. Override para simulador: `Survival._mutOverride`.

---

## 11. Problemas de Balance — estado tras SV-01 (v2.6.4)

### Sistema de Bendiciones (rediseño validado)

| # | Problema original | Estado |
|---|---|---|
| BAL-1 | Pool demasiado pequeño (5) | ✅ Resuelto: pool de 8 |
| BAL-2 | Sin rareza ni pesos | ✅ Resuelto: común/infrecuente/rara/épica con pesos 45/35/15/4 y CSS por rareza |
| BAL-3 | Desequilibrio de valor (`slow` inútil) | ✅ Mitigado: `slow` ×1.25/3 oleadas; exclusiones de opciones muertas (vida/impulso al tope) |
| BAL-4 | Solo efectos instantáneos | ✅ Resuelto: `score_boost` (permanente), `magnet` (5 usos), `golden_wave` (2 oleadas) |
| BAL-5 | Sin sinergia / builds | 🟡 Parcial — las mejoras por duplicado son SV-42 (fase ε del plan) |
| BAL-7 | `slow` insignificante | ✅ (ver BAL-3) |
| BAL-8 | `charge` = RNG sobre RNG | 🟡 Sin cambio (candidato a upgrade SV-42) |

### Scoring

| # | Problema | Estado |
|---|---|---|
| BAL-6 | Stacking de multiplicadores extremo | 🟡 Contenido: los nerfs SV-01 (golden ×2, impulso ≤0.5) dejan el techo teórico en ~×290 (pre-nerf ~×582); el chip GM-16 vuelve a mostrar el producto completo (SV-04). p90 de bots +23.5% sobre el estado pre-bendiciones — aceptado como "momentos épicos" (nota en `BALANCE_BASELINE.md`) |

### Baseline vigente de simulación (v2.6.4, 40 runs/config — sustituye al v2.4.0)

| diff | profile | score p50 | score p90 | wave | combo | dead-air% | coins |
|---|---|---|---|---|---|---|---|
| normal | skilled | 203,577 | 336,751 | 18 | ×26 | 62% | 610 |
| normal | average | 113,796 | 160,368 | 18 | ×21 | 38% | 494 |
| normal | casual | 29,648 | 44,246 | 18 | ×14 | 13% | 341 |
| difícil | skilled | 563,237 | 887,041 | 22 | ×41 | 44% | 1,015 |

> [!NOTE]
> **Cambio de época respecto a v2.4.0** (bisección completa en `BALANCE_BASELINE.md`): el refill de tablero vacío (v2.6.1) y los candados (v2.6.2) elevan el p50 estructuralmente ~+47% y hunden el dead-air (85%→62% skilled — el objetivo D2). La oleada alcanzada no cambia. Sigue vigente el hallazgo clave: la dificultad es cognitiva; ningún bot muere.

---

## 12. Tareas Completadas (GM-*)

| Tarea | Descripción | Versión |
|---|---|---|
| GM-16 | Chip de multiplicador total legible | ✅ v2.1.0 |
| GM-17 | Bendiciones post-jefe (pick 1 de 3) | ✅ v2.3.0 |
| GM-18 | Telegrafiado de jefe en barra de oleada | ✅ v2.1.0 |
| GM-19 | Precio de revivir escalante (120→240→480, max 3) | ✅ v2.2.0 |
| GM-20 | Tide Surge reemplaza quake | ✅ v2.4.0 |
| GM-21 | Fusión visual de carga+frenesí (anillos concéntricos) | ✅ v2.1.0 |
| GM-22 | Mutador semanal (ice/chaos/frenzy/none) | ✅ v2.4.0 |
| GM-26 | Warm-up universal (×0.55 primeros 10s) | ✅ v2.2.0 |
| GM-28 | Highlight de jugada pico en resultados | ✅ v2.1.0 |
| GM-30 | Simulador de balance | ✅ v2.2.0 |
| B-06 | Ice tap → +2 carga | ✅ v2.2.0 |
| SV-01 | Validación por sim del rebalance de bendiciones + nerfs (golden ×2, impulso ≤0.5, épico peso 4) + RNG seedeado en `offerBoons` | ✅ v2.6.4 |
| SV-02 | Barrido i18n (imán, monedas, récord, FEVER, botón revivir) + copy de `golden_wave` | ✅ v2.6.4 |
| SV-03 | Imán: atrae la figura más cercana, sin consumo en vacío | ✅ v2.6.4 |
| SV-04 | `Survival.scoreMult()` centralizado en puntos + chip GM-16 + popup | ✅ v2.6.4 |
| SV-10/11 | Fila de build `#surv-build`: chips de bendiciones con estado + mutador semanal (re-consultable) | ✅ v2.6.5 |
| SV-12 | Lanzador enriquecido: tarjeta de mutador + récord por dificultad (`survBestWaves`) + descriptores | ✅ v2.6.5 |
| SV-13 | Coreografía de toasts en frontera de oleada (fusión recompensa+hito, supresión en jefe, retraso de iconos) | ✅ v2.6.5 |
| SV-14 | Polish del modal de revivir: qué recibes, «te faltan {n}», contador n/3, fade de música | ✅ v2.6.5 |
| SV-20 | Pico del jefe: beat «¡SUPERADO!», confeti movido del instante del jefe, ganchos audio QP-4 | ✅ v2.6.6 |
| SV-21 | Celebraciones de hito: récord vivo, furia máxima, última vida, reveal épico, hazaña sin-booster | ✅ v2.6.6 |
| SV-22 | Modal de fin: héroe=oleada + near-miss de récord + hoja de la run (bendiciones + jefes) | ✅ v2.6.6 (cierra R-18) |

---

## 13. Mejoras Pendientes (Roadmap)

> El plan detallado y priorizado de todo lo siguiente vive en [`SURVIVAL_MASTER_PLAN.md`](./SURVIVAL_MASTER_PLAN.md) (IDs SV-*).

| ID | Tarea | Prioridad | Versión target |
|---|---|---|---|
| R-17 / GM-21* | **Rebalancear bendiciones** | ✅ Hecho (SV-01, v2.6.4) | — |
| R-18 | Polish de pantalla Game Over → SV-22 | ✅ Hecho (v2.6.6) | — |
| R-23 / GM-22* | Eventos mid-oleada → SV-41 (oleadas de élite, fase ε) | 🟡 MED | v2.8+ |
| R-24 / GM-23 | Late-game hazard modifiers → SV-41/SV-43 (fase ε) | 🟡 MED | v2.8+ |
| R-31 / GM-25 | Meta-progresión de Supervivencia → SV-30/31/32 (fase δ) | 🟢 LOW | long-term |
| R-32 | Leaderboard (requiere backend) | 🟢 LOW | long-term |
| EGF-08 | Efecto visual "última vida" | ✅ Hecho (SV-21, v2.6.6) | — |
| EGF-09 | Celebración de oleada completada | 🟡 Parcial (coreografía SV-13); celebración grande en hitos 5/10 | — |
| EGF-10 | Reveal dramático de bendición | ✅ Hecho (SV-21, v2.6.6) | — |

*Nota: algunos IDs de GM se reutilizaron para tareas diferentes en el plan original vs roadmap.

---

## 14. Bugs Conocidos

| ID | Descripción | Impacto |
|---|---|---|
| B-04 | ~~`.pick-overlay` con backdrop-filter caro en iOS~~ | ✅ Fixed v2.4.1 |
| B-09 | Bomb/lightning/broom destruyen cápsula de tiempo sin efecto | Aceptado (regla) |

---

## 15. Persistencia (localStorage)

| Key | Tipo | Descripción |
|---|---|---|
| `cv_meta.survBest` | number | Mejor tiempo de supervivencia (segundos) |
| `cv_meta.survBestWave` | number | Mayor oleada alcanzada (global, todas las dificultades) |
| `cv_meta.survBestWaves` | `{facil,normal,dificil}` | Mayor oleada por dificultad (SV-12; retrocompatible, se auto-rellena a 0) |
| `cv_meta.modes.supervivencia.best` | number | Mejor score |
| `cv_meta.modes.supervivencia.plays` | number | Total de partidas |
| `cv_surv_diff` | string | Última dificultad elegida |

---

## 16. Protecciones de Balance (No Tocar Sin Simulación)

> [!WARNING]
> Según GAME_MODES_MASTER_PLAN §9, lo siguiente NO debe cambiarse sin evidencia de simulación:

- La **tabla TUNE** y sus 3 dificultades
- La **estructura de recompensas por oleada** (monedas/gemas/cofres a 1/5/10)
- La tabla de combos, milestones, fórmula base de score
- El `CLEAR_ASSIST`
