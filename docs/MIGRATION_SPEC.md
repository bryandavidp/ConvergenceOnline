# Especificación de migración — Convergence

> **Propósito de este documento:** ser la única fuente de verdad necesaria para reimplementar Convergence, con paridad de funcionalidad al 100%, en **cualquier lenguaje o stack** (nativo, otro framework web, motor de juego, etc.) sin necesidad de leer `game.js`. Contiene reglas, fórmulas exactas, constantes verbatim, estructuras de datos y algoritmos extraídos por ingeniería inversa del código fuente (`game.js` v1.7.1, 3969 líneas). Para dónde vive cada cosa en el repo original ver [`ARCHITECTURE.md`](./ARCHITECTURE.md); para el sistema visual ver [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md); para el checklist de requisitos ver [`REQUIREMENTS.md`](./REQUIREMENTS.md).
>
> Convención: los nombres de campos/funciones se mantienen en su forma original (inglés/español mixto, tal como en el código fuente) porque son identificadores técnicos, no prosa.

## Índice
1. [Mecánica core](#1-mecánica-core)
2. [Modos de juego](#2-modos-de-juego)
3. [Modelo de datos y persistencia](#3-modelo-de-datos-y-persistencia)
4. [Economía](#4-economía)
5. [Progresión](#5-progresión)
6. [Combos y puntuación](#6-combos-y-puntuación)
7. [Power-ups / boosters (Supervivencia)](#7-power-ups--boosters-supervivencia)
8. [Ajustes e internacionalización](#8-ajustes-e-internacionalización)
9. [Audio y háptica](#9-audio-y-háptica)
10. [PWA / instalación / offline](#10-pwa--instalación--offline)
11. [Iconografía del tablero (catálogo de iconos)](#11-iconografía-del-tablero-catálogo-de-iconos)
12. [Pantallas y máquina de estados](#12-pantallas-y-máquina-de-estados)
13. [Algoritmos notables](#13-algoritmos-notables)
14. [Constantes verbatim](#14-constantes-verbatim)
15. [Notas transversales para la reimplementación](#15-notas-transversales-para-la-reimplementación)
16. [Checklist de paridad para la migración](#16-checklist-de-paridad-para-la-migración)

---

## 1. Mecánica core

### 1.1 Tablero
- Grilla de `Config.SIZE = 8` → 8×8 = 64 celdas, representada como un array plano `board[64]` (icono id en string, o `null`), con un array paralelo `tiles[64]` (celda especial/obstáculo, o `null`).
- `idx(r,c) = r*size + c`.

### 1.2 Toque de celda vacía → detección de convergencia
Algoritmo `converging(i)`:
1. Si la celda `i` está ocupada, o su tile es `solid`, o tiene un `trigger` → no-op (devuelve `[]`).
2. Se calculan fila/columna de `i`.
3. `DIRS = [-1,0, 1,0, 0,1, 0,-1]` — 4 vectores de dirección: **arriba, abajo, derecha, izquierda** (en ese orden literal de iteración; no tiene efecto de juego, solo de orden de animación/hint).
4. Para cada una de las 4 direcciones, caminar celda a celda hacia afuera:
   - Si la siguiente celda tiene un tile **sólido** → cortar el rayo (los tiles sólidos bloquean línea de visión).
   - Si la celda tiene un icono (`v !== null`) → registrarlo agrupado por id de icono y cortar esa dirección (solo cuenta el icono **más cercano**).
   - Si está vacía y no sólida → seguir avanzando.
5. Al terminar las 4 direcciones, por cada id de icono visto, si apareció en **≥ 2 direcciones**, todas esas celdas entran en la lista de convergencia.
6. Se devuelve la lista plana de índices a eliminar (puede incluir 2, 3 o las 4 direcciones si coinciden con el mismo icono).

**Regla de match:** mínimo 2 direcciones con el mismo icono más cercano disparan la convergencia; más direcciones coincidentes = más iconos eliminados de una vez (hasta 4).

### 1.3 Al tocar una celda vacía
- Si está ocupada → sonido de "tap", no-op.
- Si `converging(i).length < 2` → camino de **fallo** (ver 1.5).
- Si no:
  1. Actualizar combo (continúa si `ahora - comboAt <= comboWindow`, si no reinicia a 1).
  2. Buscar multiplicador en la tabla de combos.
  3. Comprobar entrada a modo Fiebre.
  4. Calcular puntuación (ver §6).
  5. Si es Contrarreloj, aplicar bono de tiempo.
  6. Disparar feedback (partícula/sonido/háptico).
  7. Vaciar las celdas coincidentes (`board[idx]=null`); limpiar cualquier tile en esas celdas (un tile `crystal` da +50 de bono).
  8. Animación de limpieza.
  9. Detonación en cadena de pickups `trigger` adyacentes (`_chainDetonate`).
  10. Hook de modo `onConverge(ctx)`.
  11. `evaluate()` (chequeo de victoria/derrota).

### 1.4 Generación (spawn) de iconos
- Disparado por el loop principal cada `spawnRate` ms acumulados.
- `Game.doSpawn()`: si el hook de modo `blockSpawn()` devuelve `true` (congelación en Supervivencia), no hace nada.
- `emptyCells()` = celdas con `board[i]===null` y sin tile (los tiles sólidos nunca son destino de spawn).
- Si no hay celda vacía:
  - Modos `endless` → hook `onOverflow()` (Supervivencia pierde una vida; Zen hace un despeje parcial).
  - Modos `scoreAttack` (Contrarreloj) → simplemente se omite el spawn (el reloj decide el fin).
  - Resto (Clásico/Aventura) → **derrota dura** por tablero lleno (`gameOver('reason_full')`).
- Si hay celda vacía: se elige una al azar y un id de icono vía `_pickSpawnId()` (ver §13, sesgo anti-frustración).
- **Auto-aceleración del spawn:**
  - Modos normales: `spawnRate = max(spawnMin, spawnRate - 3)` en cada spawn (aceleración lenta dentro del nivel).
  - Contrarreloj (`scoreAttack`): se recalcula en cada spawn a partir del tiempo transcurrido: `clamp(round(spawnStart * 0.92^(elapsed/10)), 300, spawnStart)` — decaimiento exponencial independiente del reloj de puntuación.

### 1.5 Manejo de fallo (`mistake`)
- Animación/sonido/háptico de "miss"; `mistakes++`; en Clásico actualiza en vivo el indicador de estrellas.
- Si el modo tiene `penalties: true`:
  - Sacude el tablero.
  - `n = clamp(penaltyBase + floor((level-1)/3), 1, 5)` (penaltyBase por dificultad: fácil 1, normal 2, difícil 3).
  - Coloca `n` iconos nuevos vía `addPenalty(n)`.
  - Acelera el spawn 5% (`spawnRate *= 0.95`, con piso `spawnMin`).
  - Muestra un toast.
  - Reevalúa.

### 1.6 `hasMoves()`
Escanea todas las celdas vacías buscando alguna con `converging(i).length >= 2`. **Solo se usa para el sistema de pistas**, no para declarar derrota — el juego evita deliberadamente terminar la partida solo porque no exista un movimiento instantáneo disponible (puede aparecer uno nuevo con el próximo spawn).

### 1.7 Evaluación de victoria/derrota (`evaluate()`)
- Se omite si no se está jugando o si el tutorial guiado está activo.
- Hook de modo `winCheck()` → si es verdadero, `levelComplete(perfect = wc === 'perfect')`.
- Hook de modo `loseCheck()` → si es verdadero, `gameOver(...)`.
- Modos `endless`/`scoreAttack`: sin "nivel completado"; en su lugar se dispara `emptyBoardBonus()` una vez por cada vez que el tablero queda vacío.
- Resto (Clásico/Aventura/Tutorial): victoria por defecto = tablero completamente vacío (`iconCount === 0`), condicionado por el hook `boardClearWins()` (en Aventura solo aplica si el objetivo del nivel es `'clear'`). La derrota por tablero lleno se maneja en el spawn, no aquí.

**Razones de fin de partida:** `reason_full` (tablero lleno sin espacio para spawnear, modos no-endless/no-scoreAttack), `reason_time` (reloj de Contrarreloj llega a 0), razones específicas de Aventura/Supervivencia (ej. `reason_surv`).

---

## 2. Modos de juego

Registro central `Config.MODES` con orden `MODE_ORDER = ['tutorial','clasico','aventura','contrarreloj','supervivencia','zen']` y dificultades `DIFF_ORDER = ['facil','normal','dificil']`.

Campos comunes por modo: `name`, `emoji`, `timed`, `penalties`, `mult` (multiplicador de score), `single`, `fixedDiff`, `accent` (color hex), `goal`/`desc`, `scoreAttack`, `fast`/`endless`/`relaxed`, y hooks opcionales: `onSetupLevel(ctx)`, `onTick(dt)`, `onConverge(ctx)`, `onOverflow()`, `blockSpawn()`, `winCheck()`, `boardClearWins()`. El dispatcher genérico es `Rules.call(name, ctx)`.

### 2.1 Tutorial (`tutorial`)
`timed:false, penalties:false, mult:0.5, single:true, fixedDiff:'facil'`. En la práctica el tutorial real es un módulo separado (`Coach`), una secuencia guiada de 2 pasos con tableros deterministas:
- Paso 1: dos círculos rojos adyacentes a una celda objetivo (demo de 2 direcciones).
- Paso 2: 4 estrellas amarillas alrededor de la celda objetivo (demo de convergencia en las 4 direcciones).

Cada paso resalta la celda objetivo hasta que el jugador la completa; al terminar marca `tutorialDone = true` y vuelve al inicio. El tutorial **bypasea** el flujo normal de `Game.start`.

### 2.2 Clásico (`clasico`)
`timed:false, penalties:true, mult:1.0`, objetivo "vaciar el tablero". Organizado en **mundos** (ver §5.4). Al completar nivel se calculan **estrellas 0-3** según errores: `STAR_ERR = [0, 2]` → 0 errores = 3★, ≤2 errores = 2★, más = 1★. Recompensa: `coins = 20 + stars*10 + round(score/60)`.

Densidad de obstáculos por nivel: `dens = min(0.13, 0.015 + n*0.0021 + worldIndex*0.008)` (`n` = nivel dentro del mundo). El modificador `rush` del mundo multiplica `spawnRate` ×0.85. Desde el nivel 2, 60% de probabilidad de colocar un tile `bonus` (+30 puntos al tocarlo).

### 2.3 Aventura (`aventura`)
`timed:false, penalties:true, mult:1.1`. Progresión infinita por capítulos — ver §5.5.

### 2.4 Contrarreloj (`contrarreloj`)
`timed:true, scoreAttack:true, penalties:true, mult:1.2`, objetivo "sumar puntos a contrarreloj". `TIMED_START = 60`s, `TIMED_CAP = 90`s (tope duro del reloj). Cada convergencia repone tiempo con rendimientos decrecientes (fórmula en §6.4). El spawn se acelera exponencialmente con el tiempo transcurrido (ver §1.4). Termina cuando `timeLeft <= 0`.

### 2.5 Supervivencia (`supervivencia`)
`timed:false, penalties:true, mult:1.5, fast:true, endless:true`. Ver detalle completo en §2.5.1 más abajo y potenciadores en §7.

Antes de empezar, el jugador elige dificultad (fácil/normal/difícil), persistida. Tabla de tuning por dificultad (`Survival.TUNE`):

| diff | waveMs | lives | spawnDecay | spawnFloor | trapBase | trapCap | varEvery | bossEvery | coinMult |
|---|---|---|---|---|---|---|---|---|---|
| facil | 32000 | 4 | 0.985 | 2000 | 0.008 | 0.05 | 8 | 8 | 0.85 |
| normal | 28000 | 3 | 0.975 | 1400 | 0.010 | 0.07 | 6 | 6 | 1.0 |
| dificil | 22000 | 3 | 0.960 | 900 | 0.016 | 0.10 | 5 | 5 | 1.3 |

Constantes clave: `WAVE_MS` base 22000, `MAX_LIVES` base 3, `CHARGE_PER = 9` (carga de booster por convergencia), `BOOSTERS = ['bomb','freeze','clearLine','wild','x2']`, `ROCK_CAP=10`, `ROCK_HITS=2`, `BOMB_CAP=6`, `SLOWDOWN_CAP=1`.

**Oleadas:** `newWave()` se dispara cuando `waveAcc >= WAVE_MS`. En cada oleada: recompensa de oleada (monedas; gemas cada 5 oleadas: `2 + floor(wave/5)`; cofre cada 10 oleadas), `spawnRate = max(spawnFloor, round(spawnRate*spawnDecay))`, se recalcula `dlevel() = 1 + floor((wave-1)/tune.varEvery)` (nivel efectivo de dificultad de iconos) refrescando el pool, se añaden trampas y pickups de bomba, ocasionalmente un pickup de ralentización, y cada `bossEvery` oleadas se dispara un `bossEvent()` — uno de 3 eventos aleatorios. Desde v2.1.0 (GM-18) el tipo de evento se **pre-decide al empezar la oleada anterior** (`_planBoss()`): la oleada previa muestra una bandera «⚠ Jefe» y ~3s antes del evento llega un aviso específico del tipo; `bossEvent()` consume ese pre-roll. Los 3 eventos:
- `meteorRain()` — 8 spawns forzados + bloqueo de 900ms.
- `quake()` — baraja el tablero (Fisher-Yates de valores, no de posiciones-tile) tras 620ms + bloqueo de 1150ms.
- `frostSurge()` — congela `3 + floor(wave/4)` celdas ocupadas + bloqueo de 760ms.

**Vidas:** 3 corazones por defecto; se pierden vía `onOverflow()` cuando el tablero no puede aceptar un spawn; al llegar a 0 → `lastChance()` (modal de revivir, coste fijo **120 monedas**, restaura 1 vida); `giveUp()` termina la partida.

**Medidor de frenesí (0-100):** `addFrenzy(n)` se incrementa por convergencia (`4 + min(22, removed*2 + min(combo,10))`), por inicio de oleada (`8 + tier*3`), por uso de booster, y por bono de tablero vacío. Al llegar a 100 → `activateFrenzy()`: duración `7200 + frenzyTier()*900` ms, spawnea `2+frenzyTier()` iconos extra, multiplica score por `frenzyMult() = 1.55 + tier*0.1`. `frenzyTier() = clamp(floor((wave-1)/4)+1, 1, 3)`.

**Barra de carga de boosters:** se llena `CHARGE_PER(9) + min(combo,6)` por convergencia (+4 si ya está en frenesí); al llegar a 100 → `grantRandom()` otorga 1 booster aleatorio y resetea (con remanente).

**Rocas rompibles:** `_crackRock` reduce `hits` en 1 por cada convergencia adyacente (vecinos ortogonales de la celda tocada + cada celda eliminada); se destruyen al llegar a 0 hits.

### 2.6 Zen (`zen`)
`timed:false, penalties:false, mult:0.8, relaxed:true, endless:true`, objetivo "sin fallos ni prisa". `onOverflow()` → `softClear(0.45)` (elimina el 45% de las celdas ocupadas al azar **en vez de terminar la partida** — literalmente sin game over). El spawn es 1.25× más lento (`relaxed`). El bono de tablero vacío otorga +1 pista (tope 9).

### 2.7 Tabla de dificultades (`Config.DIFFICULTY`)

| diff | initialIcons | comboWindow(ms) | spawnStart(ms) | spawnMin(ms) | scoreMult | penaltyBase |
|---|---|---|---|---|---|---|
| facil | 12 | 5000 | 6000 | 2000 | 0.8 | 1 |
| normal | 18 | 3500 | 5000 | 1400 | 1.0 | 2 |
| dificil | 24 | 2500 | 3800 | 900 | 1.3 | 3 |

---

## 3. Modelo de datos y persistencia

Toda la persistencia usa `localStorage`. Tres capas: claves escalares sueltas, un blob de ajustes, y un blob grande de progresión ("Meta"). No hay backend ni sincronización — el modelo debe reproducirse tal cual (o migrarse a un backend equivalente conservando exactamente estos campos).

### 3.1 Claves escalares (`Storage`)
| Clave | Tipo | Descripción |
|---|---|---|
| `cv_best` | number | Mejor puntuación histórica global (todas las partidas, todos los modos) |
| `cv_sound` | `'on'\|'off'` | (legacy, superpuesto por `Settings.sfx`) |
| `cv_user` | string | Nombre de jugador; su presencia decide pantalla `login` vs `start` |
| `cv_profile` | JSON `{name, color}` | Perfil básico |
| `cv_tut` | `'1'|'0'` | Tutorial completado |
| `cv_ver` | string | Última versión vista (toast de "actualizado") |
| `cv_surv_diff` | `'facil'|'normal'|'dificil'` | Última dificultad de Supervivencia elegida |

### 3.2 Ajustes (`cv_settings`)
```ts
interface SettingsData {
  sfx: boolean;        // default true
  music: boolean;      // default false
  haptics: boolean;    // default true
  reducedFx: boolean;  // default = prefers-reduced-motion del SO
  lang: 'es' | 'en';   // default: 'en' si navigator.language empieza con 'en', si no 'es'
  largeText: boolean;  // default false
}
```

### 3.3 Log de errores (`cv_errlog`)
```ts
type ErrLogEntry = { t: number; v: string; kind: string; msg: string /* máx 300 chars */; extra?: any };
// array con tope de 20 entradas (FIFO)
```

### 3.4 Perfil de progresión (`cv_meta`, versión de esquema `_v: 3`)
```ts
interface MetaData {
  _v: 3;
  xp: number; level: number;
  games: number;
  totalRemoved: number;                 // iconos eliminados de por vida
  coins: number; gems: number; tickets: number; chests: number;
  achievements: Record<string /*achId*/, string /*fecha ISO desbloqueo*/>;
  daily: { date: string; id?: string; progress?: number; done?: boolean };
  streak: { count: number; date: string };          // racha de días jugados consecutivos
  reward: { date: string; day: number };             // racha de recompensa diaria
  adventure: { maxLevel: number };
  worlds: Record<string /*worldId*/, {
    levels: Record<string /*nivel*/, number /*estrellas 0-3*/>;
    reward?: string /*fecha ISO reclamo de recompensa de mundo*/;
  }>;
  boards: { owned: Record<string /*boardId*/, number>; equipped: string };
  survBest: number;       // mejor tiempo de supervivencia (segundos)
  survBestWave: number;   // mejor oleada alcanzada
  stats: { totalScore: number; bestCombo: number; totalTime: number };
  modes: Record<string /*modeId*/, { best: number; plays: number }>;
  weekly: { week: string /*id ISO semana*/; id: string; progress: number; done: boolean };
  cosmetics: { owned: Record<string, string /*fecha ISO*/>; theme: string; skin: string; fx: string };
}
```
Al cargar, cualquier campo faltante se rellena con su valor por defecto (migración tolerante a esquema) y se fuerza `boards.owned.classic = 1` (el tablero Clásico siempre es gratuito).

**Helpers derivados:**
- `xpForLevel(lvl) = 300 + (lvl-1)*250` (curva lineal de XP).
- `RANKS = ['Novato','Aprendiz','Hábil','Experto','Maestro','Leyenda','Mítico']`; `rank() = RANKS[min(RANKS.length-1, floor((level-1)/3))]` (cambia cada 3 niveles de jugador).
- `hashStr(s)` — hash polinomial simple (`h = h*31 + charCode`, coaccionado a 32 bits) usado para elegir determinísticamente la misión/desafío del día/semana a partir de la fecha, sin necesidad de servidor.
- `today() = new Date().toISOString().slice(0,10)`; `weekId(dt)` normaliza al lunes de la semana ISO.

---

## 4. Economía

Tres monedas + cofres, todo dentro de `Meta`.

- **Monedas (coins):** se ganan al final de cada partida (`recordGame()`, fórmula en §6.5), al completar niveles de Clásico, en recompensas de oleada de Supervivencia, en bonos de tablero vacío de Zen, en la recompensa diaria, y al abrir cofres. Se gastan en: skins de tablero (0-3000), temas de color (0-300), revivir en Supervivencia (120 fijo).
- **Gemas (gems):** se ganan en hitos de oleada de Supervivencia (`2 + floor(wave/5)` cada 5 oleadas), en recompensa de mundo completado (+20), y en cofres (3-10). **Sin sumidero de gasto implementado** en el código analizado (el botón correspondiente muestra "disponible pronto").
- **Tickets:** se ganan raramente en cofres (1, con 8% de probabilidad). Sin sumidero de gasto implementado (reservado para una futura función, según comentario del código).
- **Cofres:** se acumulan (no se abren automáticamente). Al abrir un cofre (`openChest()`), tabla de probabilidad:
  - `roll < 0.62` → monedas: `60 + floor(random()*140)` (60-199)
  - `0.62 ≤ roll < 0.92` → gemas: `3 + floor(random()*8)` (3-10)
  - `roll ≥ 0.92` → 1 ticket

**Recompensa diaria de inicio de sesión:** disponible si `reward.date !== today()`. Al reclamar: si el último reclamo fue exactamente ayer, `day++` (la racha continúa); si no, `day = 1`. `amount = 20 + 10*min(day, 7)` monedas (día 1 = 30 … día 7+ = 90, tope 90).

### Catálogos comprables (verbatim)

**Skins de tablero** (`Boards.DEFS`, coste en monedas):
```
classic 0 · madera 500 · hielo 800 · lava 1200 · cristal 1500 · magico 2000
futurista 2500 · dorado 3000 · bosque 1800 · cosmico 2200
```
Puramente cosméticos, sin efecto en el gameplay (explícito en el código fuente).

**Temas de color** (`Themes.DEFS`, coste en monedas):
```
default 0 (Cosmos) · neon 150 · sunset 200 · forest 200 · aurora 300 · mono 250 (Eclipse)
```
Cada tema sobreescribe variables CSS: `--bg-0`, `--bg-1`, `--bg-2`, `--panel`, `--panel-2`, `--accent`, `--accent-2`, `--level`, `--score`.

**Coste de revivir (Supervivencia):** flat **120 monedas**, no escala con oleada/progreso.

---

## 5. Progresión

### 5.1 Misiones diarias (`Meta.MISSIONS`)
```
m_combo   "Consigue un combo ×8"             target 8     kind 'combo'
m_remove  "Elimina 80 iconos en una partida" target 80    kind 'remove'
m_score   "Haz 2500 puntos en una partida"   target 2500  kind 'score'
m_perfect "Deja el tablero vacío una vez"    target 1     kind 'perfect'
```
Selección determinística: `hashStr(today()) % MISSIONS.length` (misma misión para todos los jugadores en la misma fecha calendario, se renueva una vez al día). Progreso = máximo corriente (`max(progress, valorDeLaPartida)`) para todos los `kind`. Recompensa al completar: **+150 XP y +60 monedas**.

### 5.2 Desafío semanal (`Meta.WEEKLY`), acumulativo durante la semana
```
w_games  "Juega 12 partidas esta semana"    target 12     kind 'games'
w_remove "Elimina 800 iconos esta semana"    target 800    kind 'remove'
w_score  "Suma 20.000 puntos esta semana"    target 20000  kind 'score'
w_combo  "Consigue un combo ×15"             target 15     kind 'combo'
```
Id de semana = fecha ISO normalizada al lunes. Progreso acumula (`+= inc`: games=1 por partida, remove=celdas eliminadas, score=puntos) excepto `combo` que usa máximo corriente. Recompensa: **+400 XP y +200 monedas**.

### 5.3 Logros/medallas (`Meta.ACH`) — 10 en total
```
first     "Primer paso"     Completa tu primera partida        games>=1
combo10   "En racha"        Consigue un combo ×10              maxCombo>=10
combo20   "Imparable"       Consigue un combo ×20              maxCombo>=20
perfect   "Impecable"       Deja el tablero vacío              perfect
score3k   "Triple millar"   Supera 3000 puntos                 score>=3000
score8k   "Leyenda viva"    Supera 8000 puntos                 score>=8000
level5    "Escalador"       Alcanza el nivel 5 (de partida)     gameLevel>=5
remove200 "Demoledor"       Elimina 200 iconos (de por vida)    totalRemoved>=200
fever     "¡Fiebre!"        Entra en modo Fever                 feverEver (esta partida)
streak3   "Constante"       Juega 3 días seguidos               streak.count>=3
```
Se comprueban una vez por partida contra el contexto de fin de juego; el desbloqueo muestra un toast y sonido específico, y persiste la fecha de desbloqueo.

### 5.4 XP y nivel de jugador
`xpForLevel(lvl) = 300 + (lvl-1)*250`. `addXp(n)`: bucle `while xp >= umbral { xp -= umbral; level++ }` (puede subir varios niveles en una partida). Fórmulas de recompensa por partida (`recordGame`, ver §6.5 para el detalle completo).

### 5.5 Mundos del modo Clásico (`Worlds`)
`PER_WORLD = 50` niveles por mundo, `REWARD_EVERY = 50`. 5 mundos:
```
bosque    Bosque Verde      🌲 #3ad07f mods:['chains']
desierto  Desierto Dorado   🏜️ #ffb24d mods:['rocks']
montana   Montaña Helada    🏔️ #7ad7ff mods:['ice','web']
cueva     Cueva Misteriosa  🔮 #a06bff mods:['crystals','portal','barrier']
neon      Ciudad Neón       🏙️ #ff5cf0 mods:['rush','bomb','magicbox']
```
Desbloqueo de mundo: el mundo 0 siempre desbloqueado; el mundo *i* se desbloquea cuando el mundo anterior tiene ≥25 niveles con ≥1 estrella (`worldCleared >= 25`, la mitad de 50). Desbloqueo de nivel: nivel 1 siempre desbloqueado; nivel *n* se desbloquea cuando el nivel *n-1* tiene estrellas > 0. Recompensa de mundo completo (requiere las 50 niveles con ≥1 estrella): **+1 cofre, +20 gemas**, reclamable una sola vez.

### 5.6 Estructura de Aventura (biomas/capítulos)
`perChapter = 5` niveles por capítulo. 6 biomas cíclicos (`chapter % 6`):
```
nebula   Nebulosa               🌌 mods:[]         accent #7a5cff
asteroid Cinturón de Asteroides 🪨 mods:['rocks']   accent #ff9838
ice      Campo de Hielo         🧊 mods:['ice']     accent #2bd4e6
core     Núcleo Ardiente        🔥 mods:['rush']    accent #ff5b6e
void     El Vacío               🕳️ mods:['scarce']  accent #a06bff
crystal  Cristalia              💎 mods:['crystals']accent #19f0d0
```
- `chapterOf(level) = floor((level-1)/5)`; `licOf(level)` = índice del nivel dentro del capítulo (0-4); `isBoss(level)` = `licOf===4` (el último nivel de cada capítulo siempre es jefe).
- Objetivo por nivel: jefe → `'boss'`; `lic===2` → `'score'`; `lic===3 && chapter>0` → `'survive'`; resto → `'clear'` (default vaciar tablero).
- Objetivo de puntuación: `250 + chapter*120 + lic*40`. Objetivo de supervivencia: `18 + chapter*4` segundos.
- Niveles jefe colocan `2 + min(chapter,4)` tiles de cristal que deben limpiarse todos para ganar.
- El spawn se acelera por capítulo: `spawnRate = max(360, round(spawnRate/(1+chapter*0.12)))`.
- Densidades/modificadores por bioma escalan con el capítulo (rocks `min(0.16, 0.06+chapter*0.012)`, ice `min(0.14,0.05+chapter*0.012)`, rush ×0.8 spawnRate, scarce fija `hintsLeft=1`).
- El progreso solo avanza (`advReach(level)`, nunca retrocede); Aventura **siempre retoma** en el nivel máximo alcanzado, nunca reinicia desde el nivel 1.

---

## 6. Combos y puntuación

### 6.1 Fórmula de puntuación por convergencia
```
removed = cantidad de iconos eliminados en este toque (2-4)
base    = removed * 10 * level          // "level" = nivel de dificultad efectivo del modo
points  = floor(base * comboMult * diff.scoreMult * mode.mult * feverBoost() * (tempMult||1))
```
(`level` en modos sin niveles explícitos es un "nivel de dificultad sintético": en Supervivencia es `dlevel()`, en Aventura es el nivel real de aventura).

### 6.2 Tabla de multiplicador de combo (`Config.COMBO_MULTIPLIERS`)
Array `[umbral, multiplicador]`, se evalúa de mayor a menor umbral, primera coincidencia gana:
```
[[30,10], [20,8], [15,5], [10,3], [6,2], [3,1.5]]
```
Traducido: combo 1-2 → ×1 (default) · 3-5 → ×1.5 · 6-9 → ×2 · 10-14 → ×3 · 15-19 → ×5 · 20-29 → ×8 · 30+ → ×10.

### 6.3 Continuidad/decaimiento del combo
`comboWindow` = valor de la dificultad activa (fácil 5000ms, normal 3500ms, difícil 2500ms). En cada toque exitoso: si `ahora - comboAt <= comboWindow` → `combo++`; si no → `combo = 1`. `comboAt = ahora`. El loop principal comprueba cada frame: si la ventana restante llega a 0, se resetea el combo (vuelve a 0, multiplicador a 1, y sale de Fiebre si estaba activa).

### 6.4 Bonos de hito (`Config.MILESTONES`)
```
{ 10: 500, 20: 1000, 30: 2000 }
```
Puntos flat añadidos exactamente cuando `combo` es igual a 10, 20 o 30.

### 6.5 Modo Fiebre (Fever)
- Umbral para entrar: `Config.FEVER_COMBO = 10` normalmente; en Supervivencia `max(6, 10 - frenzyTier())` (el tier de frenesí baja el umbral).
- Efecto: `feverBoost() = FEVER_BOOST(1.25) + (frenzyTier()*0.06 si Supervivencia)` — multiplica la puntuación mientras está activo.
- Al ENTRAR en Fiebre los spawns se pausan **500ms** (`State.spawnHoldUntil`, "aspiración" del espectáculo de entrada — v2.1.0, GM-27).
- Sale de Fiebre cuando el combo se resetea a 0.
- `tempMult` (multiplicador temporal) se combina con Fiebre en Supervivencia: `tempMult = (x2Activo?2:1) * frenzyMult()`.

### 6.6 Bono de tiempo en Contrarreloj
```
decay = clamp(1 - elapsed/150, 0.4, 1)                            // 100%→40% hacia los ~150s
raw   = (2 + min(removed,4) + min(combo,4)) * decay                // ~2..10s por convergencia, decayendo
timeLeft = min(TIMED_CAP(90), timeLeft + raw)                       // tope duro
```
Diseño deliberado para impedir alargar la partida indefinidamente encadenando combos.

### 6.7 Callouts de "rank" al subir de tier de combo
Se muestran cuando el multiplicador sube de tier (y `combo >= 3`):
```
1.5 → '¡BIEN!'   2 → '¡GENIAL!'   3 → '¡INCREÍBLE!'   5 → '¡ÉPICO!'   8 → '¡LEGENDARIO!'   10 → '¡MÍTICO!'
```
Color por tier: ≥8 dorado `#ffd84d`, ≥5 rosa `#ff5cf0`, ≥3 morado `#b46cff`, ≥2 cian `#00d0ff`, ≥1.5 verde `#34e29b`, resto blanco.

### 6.8 Bono de tablero vacío (modos endless/scoreAttack)
```
chain = cantidad de veces que el tablero quedó vacío en esta partida
wave  = oleada actual (Supervivencia) o 1
combo = min(combo actual, 12)
raw    = EMPTY_BOARD_BONUS(500) + chain*90 + combo*28 + (Supervivencia ? wave*45 : 0)
points = max(250, round(raw * diff.scoreMult * mode.mult * feverBoost() * tempMult))
coins  = clamp(round(points/220), 3, 16)
```
Además: en Supervivencia +25% de carga de booster y +24 de frenesí; en Contrarreloj hasta +8s de tiempo; en Zen +1 pista (tope 9). En modos no-endless, el bono de "tablero perfecto" es más simple: flat `EMPTY_BOARD_BONUS = 500`.

### 6.9 XP y monedas ganadas por partida (`recordGame`)
```
xpGained   = round(score/10 + maxCombo*5 + level*20 + (perfect ? 100 : 0))
coinsGained= round(score/40 + maxCombo*2 + level*5  + (perfect ? 40  : 0))
```
(más los bonos de misión/desafío semanal descritos en §5.1/§5.2 cuando se completan en esa partida).

---

## 7. Power-ups / boosters (Supervivencia)

Catálogo (`Boosters.DEFS`, orden `['bomb','freeze','x2','clearLine','wild']`):

| id | nombre | glyph | cantidad inicial | efecto |
|---|---|---|---|---|
| bomb | Bomba | 💣 | 2 | Limpia un área de 3×3 |
| freeze | Congelación | ❄️ | 2 | Pausa el spawn de iconos por 7s |
| clearLine | Rayo | ⚡ | 3 | Limpia toda la fila y columna tocadas |
| wild | Escoba | 🧹 | 2 | Limpia el grupo de icono más numeroso del tablero |
| x2 | Comodín | 🃏 | 1 | Duplica los puntos por 11s |

> Nota: existe un campo `cost` en `Boosters.DEFS` (bomb 80, freeze 60, clearLine 90, wild 100, x2 70) pero **no se gasta en ningún lugar del código analizado** — los boosters se obtienen gratis al inicio de la partida (cantidad inicial) y vía la barra de carga/frenesí, no comprados con monedas.

**Categorías de uso:**
- `SPATIAL = ['bomb','clearLine','wild']` — requieren que el jugador apunte una celda destino ("modo puntería", `body.classList.add('aiming')`, con previsualización de celdas afectadas).
- Globales (`freeze`, `x2`) — efecto instantáneo, sin apuntar.

**Detalle de efectos:**
- `bomb`: limpia el área 3×3 centrada en la celda tocada.
- `clearLine`: limpia toda la fila + columna que pasan por la celda tocada.
- `wild` (sobre celda con icono): limpia todas las celdas con ese mismo icono en el tablero completo. `wild` (sobre celda vacía): auto-limpia el grupo de icono más numeroso del tablero, o si ninguno tiene ≥2, hace un "clear de emergencia" de una celda ocupada al azar.
- `freeze` (global): `freezeUntil = ahora + 7000ms` — mientras dure, `blockSpawn()` devuelve `true`.
- `x2` (global): `x2Until = ahora + 11000ms` — duplica `tempMult`.

**Barra de carga:** se llena `CHARGE_PER(9) + min(combo,6)` por convergencia (+4 si ya en frenesí); al llegar a 100 otorga +1 booster aleatorio (uniforme entre los 5 tipos) y resetea con remanente.

**Otros pickups de tablero (tiles con `trigger`, no son "boosters" del jugador sino elementos del tablero):**
| tile | efecto |
|---|---|
| `bonus` | +30 puntos instantáneos al tocarlo |
| `portal` | Teletransporta un icono ocupado al azar a una celda vacía al azar |
| `magicbox` | Libera los tiles sólidos adyacentes |
| `bomb` (tile) | Limpia área 3×3, otorga `celdas*10*level` puntos |
| `slowdown` | Multiplica `spawnRate` ×1.6 (tope = `spawnStart`) |

Estos tiles se **detonan en cadena**: al limpiar celdas adyacentes a un tile trigger, se dispara un BFS (`_chainDetonate`) que puede encadenar múltiples bombas/portales/etc. en una sola jugada.

---

## 8. Ajustes e internacionalización

### 8.1 Ajustes disponibles
`sfx`, `music`, `haptics` (oculto si el dispositivo no soporta vibración), `reducedFx` ("reducir efectos" — desactiva partículas/flash/rank-flash, ver `DESIGN_SYSTEM.md §10`), `largeText` (fuerza `font-size` raíz mayor + clase de texto grande), `lang` (`es`/`en`).

### 8.2 Sistema de i18n
Un único diccionario `DICT` con claves `es`/`en`, cada uno un mapa plano de ~150 claves de mensaje → string (varios con placeholders tipo `{n}`/`{w}`/`{s}`/`{c}`/`{t}`, reemplazados manualmente en cada sitio de uso — no hay motor genérico de pluralización). Un mapa `FIELD = {name:'n', desc:'d', goal:'g'}` traduce campos de un modo (`Config.MODES`) a las claves de inglés equivalentes (`m_{modeId}_{n|d|g}`), porque el español vive directamente embebido en `Config.MODES` mientras el inglés vive en el diccionario.

`I18n.apply(root)` recorre el DOM y aplica:
- `[data-i18n]` → `textContent`
- `[data-i18n-html]` → `innerHTML` (para contenido con `<strong>`, ej. "cómo jugar")
- `[data-i18n-ph]` → `placeholder`
- `[data-i18n-al]` → `aria-label`
- Fija `document.documentElement.lang`

**Importante para la migración:** buena parte del HTML dinámico (tarjetas de modo, HUD, modales) se genera con JS usando `I18n.t()` en el momento del render, no solo vía atributos DOM — cambiar de idioma exige **reconstruir esas vistas**, no solo re-aplicar textos.

Detección de idioma por defecto: `/^en/i.test(navigator.language)` → `en`, si no `es`.

---

## 9. Audio y háptica

**No hay archivos de audio.** Todo se sintetiza en tiempo real con Web Audio API:
- Debe inicializarse dentro de un gesto de usuario (requisito de iOS). Incluye manejo específico de iOS: `navigator.audioSession.type = 'playback'` para sonar incluso con el switch de silencio activado, reproducción de un buffer silencioso para "desbloquear" el contexto, y resume automático si el contexto se suspende.
- `tone(freq, dur, type, vol, when)` — oscilador único con envolvente de ganancia exponencial.
- `chord(freqs, dur, type, vol, stagger)` — varios `tone()` con offset temporal (arpegio).
- Efectos con nombre (frecuencias/formas de onda específicas por evento): `tap`, `ui`, `success`, `eliminate(n)` (el tono sube con el tamaño del combo, limitado a 1 llamada/30ms para no saturar en combos rápidos), `combo(l)` (5 tiers de frecuencia base), `rank`, `fever`, `milestone`, `record`, `boardClear`, `miss`, `danger`, `level`, `over`, `iceCrack(stage)`, `iceBreak`, `quake`, `rain`, `lifeBlast`, `booster(id)` (acorde específico por tipo de booster).
- Todos los efectos se omiten si `Settings.sfx` es falso.

**Música procedural:** escala `[220,247,294,330,392,440,494,587]` Hz (escala tipo A menor). Secuenciador por pasos (`setInterval(60ms)` con look-ahead de 0.2s), tempo `0.30 - 0.12*intensity` (más rápido con más intensidad), nota de bajo cada 4 pasos, melodía cada paso, armonía extra por encima de intensidad 0.5. `setIntensity(v)` (0-1) también ajusta la ganancia general. La intensidad se pilota desde el nivel de combo, el estado de frenesí/oleada de Supervivencia y el modo Fiebre.

**Háptica:** wrapper sobre `navigator.vibrate`, con patrones nombrados (ms, arrays = pulso/pausa): `tap()`=8, `combo()`=14, `milestone()`=[12,30,14], `error()`=40, `level()`=[18,40,18,40], `record()`=[12,28,12,28,36], `fever()`=[20,30,20], `ice()`=[6,18,8], `quake()`=[28,28,34,28,42], `life()`=[18,36,18,22].

---

## 10. PWA / instalación / offline

- Service Worker con caché con nombre versionado (`cv-cache-v1.7.1`) que **debe subirse manualmente** en cada release.
- Precachea assets core (HTML/CSS/JS/manifest/iconos) siempre, más 3 listas best-effort de iconos (PNG legacy, SVG v2, sprites de sistema) que no rompen la instalación si fallan individualmente.
- Estrategia de fetch: navegación → network-first con fallback a caché (y a `index.html` cacheado si no hay red); resto de peticiones GET del mismo origen → cache-first con relleno de red en background.
- Manifest: `display: standalone`, `orientation: portrait`, iconos 192/512 + maskable, categorías `games, puzzle, entertainment`.
- Cliente: maneja `beforeinstallprompt` (guarda el evento, muestra botón de instalar), detecta modo standalone existente, ofrece instrucciones manuales específicas para iOS (sin `beforeinstallprompt` nativo) vía sniffing de user-agent, y notifica por toast cuando detecta una versión nueva del Service Worker instalada (sin recarga automática).

---

## 11. Iconografía del tablero (catálogo de iconos)

Los iconos del tablero **no son imágenes**: son SVG generados por código, combinando:
- 16 formas (`circle, square, triangle, diamond, star, heart, hexagon, plus, droplet, ring, pentagon, moon, sun, flower, clover, spiral`).
- 12 colores (`red #ff5b6e, blue #4b8bff, green #3ad07f, yellow #ffd23f, purple #a06bff, cyan #2bd4e6, orange #ff9838, pink #ff79c6, lime #b6e64a, white #e8eefc, teal #27b6a0, indigo #6c7bff`).

Catálogo = 3 ciclos de las 16 formas = **48 iconos** de la forma `{shape}_{color}` (ej. `circle_red`), generados con la fórmula: `for cyc in 0..3: for i in 0..16: catálogo.push([shape[i], color[(i+cyc*7)%12]])`.

**Invariante de diseño (importante para la migración):** cada nivel usa una "ventana" contigua de como máximo 8 iconos de este catálogo de 48. Como el período de ciclo de formas (16) es mayor que el tamaño máximo de ventana (8), **cualquier ventana contigua contiene 8 formas distintas** — esto garantiza que nunca puedan coexistir dos iconos "parecidos pero distintos" (misma forma, distinto color) que confundan al jugador; solo pueden converger iconos verdaderamente idénticos (misma forma + mismo color).

- `varietyFor(level) = clamp(4 + floor((level-1)/3), 4, min(8, catálogo.length))` — la variedad crece 1 icono cada 3 niveles, piso 4, techo 8.
- `poolForLevel(level)`: offset de ventana `= (level-1) % 48`, tamaño `= varietyFor(level)`, envuelve alrededor del catálogo — ventana deslizante aditiva que avanza exactamente 1 posición por nivel (niveles consecutivos comparan `n-1` iconos: se introduce 1 nuevo y sale 1 viejo por nivel).

---

## 12. Pantallas y máquina de estados

Ver también [`ARCHITECTURE.md` §7](./ARCHITECTURE.md#7-máquina-de-estados-pantallas-y-modales) para el mecanismo genérico (`Screens.show`/`Modal.open`).

**Pantallas:** `login`, `start`, `modes`, `worlds`, `game` (una `<section class="screen">` por cada una, sin historial, sin animación de salida).

**Modales** (overlay, uno activo a la vez, foco capturado/restaurado):

| id | Contenido |
|---|---|
| `modal-missions` | Lista de misiones diarias + desafío semanal |
| `modal-how` | Reglas del juego + botón de tutorial interactivo |
| `modal-pause` | Reanudar / reiniciar / salir |
| `modal-level` | Nivel completado: stats, preview del siguiente nivel, botones siguiente/mapa |
| `modal-over` | Fin de partida: stats, barra de XP, logros desbloqueados, reintentar/compartir/salir |
| `modal-settings` | Toggles de ajustes + selector de idioma |
| `modal-revive` | "Última oportunidad" de Supervivencia — revivir pagando monedas |
| `modal-surv-diff` | Selección de dificultad de Supervivencia + botón empezar |
| `modal-adventure` | Overview del mapa de capítulos de Aventura |
| `modal-shop` | Tienda (skins de tablero + temas) |
| `modal-chests` | Inventario de cofres + botón abrir |
| `modal-multi` | Placeholder "Multijugador — Próximamente" |
| `modal-medals` | Perfil: stats de por vida, mejores marcas por modo, logros |

`Game.pause()`/`resume()` alternan `State.status` entre `'playing'`/`'paused'` junto con abrir/cerrar `modal-pause`. Valores de `State.status`: `'idle'`, `'playing'`, `'paused'`, `'over'`, `'levelComplete'`.

No existe un router genérico más allá de `Screens`/`Modal`: las transiciones son llamadas imperativas repartidas entre `Game`, `Worlds` y los constructores de menú, cableadas en `init()` más un único listener delegado por atributo `data-act` (para acciones reutilizables del top-bar/home: `settings`, `profile`, `edit-name`, `buy-coins`, `buy-gems`, `play`, `home-classic`, `home-surv`, `home-multi`, `claim-daily`, `nav-medals`, `nav-shop`, `nav-missions`, `nav-home`).

---

## 13. Algoritmos notables

### 13.1 Sesgo de spawn "anti-frustración" (clear-assist)
`Config.CLEAR_ASSIST = { threshold: 6, pMax: 0.9, decay: 0.1, pMin: 0.25 }`. Con más de 6 iconos en el tablero, el spawn es 100% aleatorio dentro del pool. Con ≤6 iconos (y >0), se calcula `p = clamp(pMax - (iconCount-1)*decay, pMin, pMax)` y, con probabilidad `p`, el icono generado se elige igual al **icono menos común actualmente en el tablero** (el más "solitario", empates al azar) en vez de puramente aleatorio — ayuda activamente al jugador a emparejar los últimos iconos sueltos y terminar de vaciar el tablero, en vez de alargar la partida al azar.

### 13.2 Sistema de pistas (hint)
Escaneo lineal de todas las celdas vacías buscando la primera con `converging(i).length >= 2`; resalta esa celda + las celdas que emparejaría durante `HINT_DURATION = 2000`ms. Límite de `HINTS_PER_LEVEL = 3` por nivel, cooldown `HINT_COOLDOWN = 10000`ms entre usos. Sin ponderación: gana la primera coincidencia en orden de escaneo (row-major).

### 13.3 Escalado de dificultad por nivel
```
base = diff.spawnStart * 0.95^(level-1)     // decae 5% por nivel
if modo.relaxed: base *= 1.25                 // Zen es más lento
spawnRate = round(clamp(base, diff.spawnMin, 6000))
```
Se combina con: aceleración dentro del nivel (`spawnRate -= 3` por spawn, piso `spawnMin`), aceleración por fallo (`×0.95` por error), y el escalado específico por capítulo/oleada de Aventura/Supervivencia (§2.5, §5.6).

### 13.4 Medidor de ocupación / peligro
`occupation() = celdasOcupadas/celdasTotales*100`. Umbrales de HUD: `>=85%` → peligro (rojo pulsante, sonido/háptico con throttle de 900ms), `>=65%` → advertencia. **Esta es la señal principal de "estás por perder"**, ya que no existe un chequeo activo de "no hay movimientos" — el juego solo termina realmente por desbordamiento del tablero en el momento del spawn.

### 13.5 Gobernador de rendimiento
EMA del frame time (`ema += (dt-ema)*0.1`) que ajusta adaptativamente `FX.cap` (máximo de partículas DOM concurrentes) entre ~18 y ~50 — un sistema simple de "calidad adaptativa" para regular la carga en dispositivos de gama baja sin caer frames de forma abrupta.

### 13.6 Baraja de terremoto (Supervivencia)
Fisher-Yates sobre los **valores** de las celdas no-sólidas con icono (las posiciones no cambian, los valores sí) — usado por el evento "quake" para revolver el tablero sin alterar la cantidad de iconos de cada tipo.

### 13.7 Selección determinística de misión/desafío
`hashStr(fecha) % lista.length` hace que la elección de misión diaria/desafío semanal sea la misma para todos los jugadores en la misma fecha/semana, sin necesidad de servidor — efectivamente una semilla pseudoaleatoria derivada de la fecha.

---

## 14. Constantes verbatim

### `Config` (núcleo)
```js
SIZE: 8
COMBO_MULTIPLIERS: [[30,10],[20,8],[15,5],[10,3],[6,2],[3,1.5]]
MILESTONES: { 10: 500, 20: 1000, 30: 2000 }
EMPTY_BOARD_BONUS: 500
CLEAR_ASSIST: { threshold: 6, pMax: 0.9, decay: 0.1, pMin: 0.25 }
STAR_ERR: [0, 2]
FEVER_COMBO: 10
FEVER_BOOST: 1.25
TIMED_START: 60
TIMED_CAP: 90
HINTS_PER_LEVEL: 3
HINT_COOLDOWN: 10000
HINT_DURATION: 2000
```
(Tablas de `DIFFICULTY` y `MODES` ya detalladas en §2.7 y §2.)

### Tiles especiales (`Tiles.DEFS`)
```
rock     🪨 solid            "Roca: estorba y no converge"
locked   🔒 solid            "Bloqueada"
frozen   🧊 solid taps:2 breakable  "Helada: toca 2 veces para descongelar"
infected ☣️ (definido, sin uso activo confirmado en las reglas leídas)
crystal  💎 bonus:3 (+50 score al limpiar)   "Vale puntos extra"
chains   ⛓️ solid taps:2 breakable  "Cadenas: toca 2 veces para liberar"
web      🕸️ solid taps:2 breakable  "Telaraña: toca 2 veces para liberar"
barrier  🚧 solid              "Barrera: solo se quita con objetos especiales"
mud      🟫 taps:2 breakable   "Lodo: ralentiza y cuesta limpiar"
bonus    trigger:'bonus'    "+30 puntos al instante"
portal   trigger:'portal'  🌀  "Teletransporta una figura"
magicbox trigger:'magicbox' 🎁 "Libera figuras cercanas"
bomb     trigger:'bomb'    💣  "Detona figuras cercanas" (variante tile, distinta del booster)
slowdown trigger:'slowdown' ⏳ "Reduce la velocidad de aparición"
```

### Modificadores genéricos (`Modifiers.DEFS`)
```
rocks     Asteroides  tile:'rock'    density:0.06
ice       Hielo       tile:'frozen'  density:0.05
rush      Núcleo      spawnMult:0.8
scarce    Vacío       hints:1
crystals  Cristales   tile:'crystal' density:0.04
```
(Densidades base — Aventura y Clásico recalculan sus propias densidades por nivel/capítulo, ver §2.2/§5.6, no leen directo de esta tabla en todos los casos).

### Tarjetas de modo del menú (`MODE_CARDS`)
```
supervivencia — accent #ff5b6e, acción → abrir selector de dificultad
clasico       — accent #2f6bff, acción → abrir mapa de mundos
multi         — accent #7a5cff, disabled:true, acción → abrir placeholder multijugador
```
Más una 4ª tarjeta estática "¿Cómo se juega?".

---

## 15. Notas transversales para la reimplementación

- **Aleatoriedad no seedeada:** todo el juego usa `Math.random()` sin PRNG seedeado (`rand(n) = floor(Math.random()*n)`). No hay determinismo ni replay exacto de partidas — una reimplementación es libre de elegir cualquier generador aleatorio salvo que se requiera explícitamente paridad bit-a-bit con sesiones grabadas (el original tampoco la soporta).
- **Sin guardado de partida en curso:** `State` (el estado de una partida activa) se reinicializa por completo en cada `start()`/`setupLevel()`. Solo el perfil de progresión (`Meta`/`Storage`) persiste entre sesiones — no hay resume de un tablero a medias tras cerrar la app.
- **Todo texto es bilingüe (ES/EN)** vía el diccionario de `I18n`; una reimplementación debería mantener esta indirección por clave en vez de hardcodear español, ya que el inglés vive en claves derivadas (`m_{modeId}_{n|d|g}`) mientras el español vive embebido directamente en la config de modos.
- **Orden de direcciones** `DIRS` = arriba, abajo, derecha, izquierda — sin efecto de reglas, solo relevante si se quiere replicar el orden exacto de animaciones/hints.

---

## 16. Checklist de paridad para la migración

Usar esta lista para verificar que una reimplementación cubre el 100% de lo existente:

- [ ] Grilla 8×8 con detección de convergencia por rayo en 4 direcciones, bloqueado por tiles sólidos.
- [ ] Sistema de combo con ventana temporal + tabla de multiplicadores + modo Fiebre.
- [ ] 6 modos de juego (Tutorial, Clásico, Aventura, Contrarreloj, Supervivencia, Zen) con sus reglas y hooks diferenciados.
- [ ] 3 niveles de dificultad global con sus 6 parámetros cada uno.
- [ ] Sistema de tiles especiales (14 tipos) con comportamiento sólido/rompible/trigger y detonación en cadena.
- [ ] Modo Clásico: 5 mundos × 50 niveles, sistema de estrellas, desbloqueo secuencial, densidades de obstáculos por nivel.
- [ ] Modo Aventura: progresión infinita por capítulos/biomas, 4 tipos de objetivo, niveles jefe.
- [ ] Modo Supervivencia: oleadas, vidas, revivir, 3 eventos de jefe, medidor de frenesí, barra de carga de 5 boosters, 3 tuning por dificultad.
- [ ] Modo Contrarreloj: reloj con reposición decreciente y tope, aceleración exponencial de spawn.
- [ ] Modo Zen: despeje parcial en vez de derrota.
- [ ] Economía: 3 monedas, cofres con tabla de probabilidad, recompensa diaria con racha.
- [ ] Progresión: XP/nivel/rangos, misiones diarias determinísticas, desafío semanal determinístico, 10 logros.
- [ ] Tienda: 10 skins de tablero + 6 temas de color, cosméticos puros.
- [ ] Sistema de iconos: 16 formas × 12 colores, ventana deslizante de variedad por nivel, invariante anti-confusión.
- [ ] Sesgo anti-frustración de spawn cuando quedan pocos iconos.
- [ ] Sistema de pistas limitado + cooldown.
- [ ] i18n ES/EN completo, incluyendo contenido generado dinámicamente.
- [ ] Ajustes: sfx, música, háptica, reducir efectos, texto grande, idioma.
- [ ] Audio 100% sintetizado (sin archivos) + música procedural + háptica con patrones.
- [ ] PWA instalable, offline-first, con estrategia de caché network-first (navegación) / cache-first (assets).
- [ ] 5 pantallas + 13 modales con el flujo de navegación descrito.
- [ ] Persistencia tolerante a esquema (migración de campos faltantes) equivalente a `Meta._v`.
