# SOUND_SYSTEM_INVENTORY.md

Inventario exhaustivo del **sistema de sonido activo** de Convergence (v2.12.0).
Objetivo: tener a la vista *todo* el audio del juego —qué sonidos existen, dónde
están definidos, cuándo se disparan, cómo suenan y qué se solapa— para poder
rediseñarlo entero con criterio.

> Todas las referencias de línea son sobre `game.js` en la versión actual; el
> archivo es un único IIFE, así que las líneas se desplazan entre versiones.
> Úsalas como guía de búsqueda, no como verdad absoluta.

---

## 1. Resumen ejecutivo

- **100 % sintetizado con Web Audio API.** No hay ni un solo archivo de audio
  (`.mp3/.wav/.ogg`), ni `<audio>`, ni `decodeAudioData`. Todo son osciladores
  (`OscillatorNode`) generados en runtime. El único `createBufferSource` que
  existe (`game.js:1171`) es un búfer **silencioso** de 1 muestra para desbloquear
  el audio en iOS.
- **Tres módulos** componen el sistema:
  1. `Sound` (`game.js:1144-1240`) — infraestructura + 2 primitivas + **31 firmas SFX**.
  2. `Music` (`game.js:2985-3016`) — música de fondo generativa (off por defecto).
  3. `Feedback` (`game.js:2253-2285`) — despachador de eventos que enruta a
     `Sound[snd]()` de forma dinámica (usado por los eventos de Supervivencia).
- **2 canales de mezcla**: `sfxGain` (efectos, ganancia 0.9) y `musicGain`
  (música, arranca en 0 y sube a 0.14). Ambos cuelgan directo de `ctx.destination`.
- **Interruptores independientes**: `Settings.sfx` (**ON** por defecto) y
  `Settings.music` (**OFF** por defecto). No hay control de volumen para el usuario,
  solo on/off.
- **31 firmas SFX definidas**, pero **~24 realmente en uso**. Hay dos métodos
  muertos (`rain`, `grant`) y bastante solapamiento semántico (un mismo sonido
  para acciones muy distintas). Ver §7.

---

## 2. Arquitectura y ciclo de vida del audio

### 2.1 Grafo de nodos (`Sound.ensure`, `game.js:1148-1175`)

```
                 ┌──────────────► sfxGain (gain 0.9) ──┐
AudioContext ────┤                                     ├──► ctx.destination
                 └──────────────► musicGain (gain 0.0→0.14) ┘
```

- `ctx`: se crea **perezosamente** dentro del primer gesto de usuario (iOS lo exige).
- `sfxGain.gain = 0.9` fijo (no se automatiza salvo por cada envelope de nota).
- `musicGain.gain = 0.0` al crear; `Music.start()` lo sube a `0.14`.

### 2.2 Desbloqueo iOS/móvil (`Sound.ensure`)

`ensure()` **debe** llamarse dentro de un gesto de usuario. Hace, en orden:

1. Comprueba `navigator.userActivation.isActive` (si no hay gesto activo y no hay
   `ctx`, aborta).
2. `navigator.audioSession.type = 'playback'` — enruta al canal *playback* para
   que el audio suene **aunque el interruptor físico de silencio del iPhone esté
   activado** (causa nº 1 de "no hay sonido en iPhone").
3. Crea `ctx`, `sfxGain`, `musicGain`.
4. Si `ctx.state !== 'running'` (estados `suspended`/`interrupted` tras Siri o
   llamada), hace `ctx.resume()`.
5. Reproduce un búfer silencioso 1×1 una sola vez (`_unlocked`) para el unlock iOS.

**Dónde se llama `ensure()`**: en decenas de handlers de interacción de la capa de
menús y en el wiring de `init()` (clúster `game.js:12660-12821`), además de en
`Music.start()` y en el toggle de SFX de Ajustes (`game.js:11129`). Es el "primer
toque desbloquea el sonido".

### 2.3 Gating

- Cada SFX pasa por `tone()`, que corta de entrada si `!Settings.sfx || !this.ctx`
  (`game.js:1177`). El getter `Sound.enabled` (`game.js:1146`) devuelve `Settings.sfx`
  pero **no** se usa para gatear (está de adorno).
- La música se gatea con `Settings.music` en `Music.start()`/`setIntensity()`/
  `_syncIntensity()`.

---

## 3. Primitivas de síntesis

Todo SFX se construye con **dos** funciones. Entender estas dos es entender el 100 %
del timbre del juego.

### 3.1 `tone(freq, dur, type='sine', vol=0.2, when=0)` — `game.js:1176-1187`

Una nota = 1 oscilador + 1 envelope de ganancia:

- Ataque exponencial de `0.0001 → vol` en **12 ms**.
- Decaimiento exponencial de `vol → 0.0001` a lo largo de `dur`.
- `type` ∈ `sine | triangle | square | sawtooth`.
- `when` = retardo en segundos desde "ahora" (para escalonar arpegios).

### 3.2 `chord(freqs, dur, type, vol=0.12, stagger=0)` — `game.js:1188`

Llama `tone()` por cada frecuencia, retardando cada una `i * stagger` segundos.
`stagger=0` → acorde simultáneo; `stagger>0` → arpegio.

### 3.3 `Music._note(f, dur, t, vol, type)` — `game.js:3003`

Gemela de `tone()` pero conectada a `musicGain` en vez de `sfxGain`, con ataque de
20 ms. La usa solo el secuenciador de música.

---

## 4. Catálogo completo de SFX

Cada fila: **síntesis exacta**, **timbre percibido** y **disparadores** (con línea).
Volúmenes relativos a `sfxGain=0.9`.

### 4.1 Interacción / UI genérica

| Método | Síntesis | Cómo suena | Cuándo / dónde |
|---|---|---|---|
| `tap()` | `tone(420, 0.05, triangle, 0.10)` | Click corto, medio-agudo | Comodín de "toque sin efecto o bloqueado": celda ocupada (`8254`), objeto *trigger* al tocar (`8233`), tablero bloqueado en Supervivencia (`8229`), romper roca/cadena parcial (`8243`), tick de cuenta atrás 3·2·1 de Supervivencia (`5210`), agrietar bloque parcial (`5839`), agrietar ancla/jaula de jefe (`6686`, `6691`), nivel/mundo bloqueado en el mapa (`7172`, `7183`), usar **pista** (`9250`) |
| `ui()` | `tone(380, 0.05, sine, 0.08)` | Blip suave, plano | Navegación y toques de menú/HUD (decenas de sitios): abrir nivel/mundo (`7173`, `7184`), Picker elegir/cancelar (`7457`, `7458`), toggles del pre-nivel (`7560`, `7579`), toggle de Ajustes (`11129`), botones de tienda/perfil/cofres/topbar, revelar objeto **común** de cofre (`11950`), botón "siguiente" de cofre (`11959`). **También** "potenciador vacío" y "bloqueado" en Supervivencia (`5925`, `5926`) y armar potenciador espacial (`5933`) |
| `success()` | `tone(660,0.09,sine,0.15)` + `tone(990,0.09,sine,0.09,@0.03)` | Ding ascendente de 2 notas | Confirmaciones "positivas" de menú: fin del tutorial/Coach (`7795`), equipar cosmético (`11966`), compras/reclamos en tienda y clúster de topbar (múltiples entre `11022`–`12793`) |
| `miss()` | `tone(160, 0.12, sawtooth, 0.09)` | Buzz grave, áspero | **Error del jugador** en partida (`mistake`, `8400`); y estados denegados en menús: monedas insuficientes, acción inválida, etc. (clúster `9536`–`12768`) |

### 4.2 Convergencia y combo (núcleo del gameplay)

| Método | Síntesis | Cómo suena | Cuándo / dónde |
|---|---|---|---|
| `eliminate(n)` | `base=520+min(n,24)*16`; `tone(base,0.07,triangle,0.12)` + `tone(base*1.5,0.08,sine,0.07,@0.03)`. Throttle 30 ms | Doble nota; el **tono sube con el combo** | Sonido base de cada convergencia (vía `match`). También reutilizado para destrucción de tiles: romper hielo del todo (`8241`, con `n=3`), bloque roto (`5844`), jaula rota (`6695`) — estos con `n=1/3` |
| `match(removed,combo,mult)` | Compuesto: llama `eliminate(combo)`; si tier≥2 añade `combo(tier-1)`; si `removed≥4` añade `tone(1760,0.07,sine,0.055,@0.11)` | Convergencia con "cola" brillante en convergencias grandes | Único punto que la llama: al converger (`activate`, `8374`) |
| `combo(l)` | `roots=[523,587,659,784,988][l]`; `chord([r, r*1.26, r*1.5], 0.14, sine, 0.10, 0.02)` | Acorde mayor arpegiado; sube de altura por tier | Solo desde `match()` cuando el tier de recompensa ≥2 |
| `rank()` | `chord([784,1047,1319], 0.2, sine, 0.12, 0.05)` | Arpegio ascendente brillante | Subida de **rango de combo** (¡BIEN!/¡GENIAL!/…) (`8370`). También es el *fallback* de `booster()` para ids no reconocidos (`1227`) |

### 4.3 Estados de euforia / hitos

| Método | Síntesis | Cómo suena | Cuándo / dónde |
|---|---|---|---|
| `fever()` | `chord([330,415,554,659], 0.3, sawtooth, 0.06, 0.04)` | Acorde sawtooth grave, "energético" | Entrar en **Fiebre** (Clásico/otros, `8277`); activar **Frenesí** de Supervivencia (`5405`) |
| `milestone()` | `chord([659,988,1319], 0.25, square, 0.07, 0.06)` | Arpegio *square* estilo chiptune | Hito de combo con bonus (×10/20/30, `8318`); aparición de selector de **reliquia** (Aventura, `4867`) y de **bendición** (Supervivencia, `5336`); recompensa de **mundo** (`7195`); pickups de tablero: bonus +30 (`8490`), caja mágica (`8507`), cápsula de tiempo (`8528`); **logro** desbloqueado (`9230`) |
| `record()` | `chord([784,988,1175,1568], 0.3, sine, 0.12, 0.07)` | Fanfarria ascendente de 4 notas, limpia | El sonido **más reutilizado** (§7.1). Nuevo récord en vivo (`8381`), récord en tablero limpio (`8771`), reliquia elegida (`4877`), hazaña/medalla (`5110`), bendición elegida (`5360`), hito de oleada (`5430`), récord de oleada (`5442`), jefe-oleada superado (`5712`), minijefe derrotado (`6442`), tablero jardín 50 flores (`8751`), cofre de racha diaria (`9011`), subida de nivel de jugador (`9229`), cofre de pipeline (`10373`), revelar objeto **raro+** de cofre (`11952`), *tier-up* de cofre (`12000`) |
| `level()` | `[523,659,784,1047,1319]` → `tone(f,0.16,sine,0.13,i*0.08)` | Escala ascendente de 5 notas | **Completar nivel** (`8796`); **victoria** de misión (`win`, `8980`) |
| `boardClear()` | `tone(196,0.12,triangle,0.08)` + `[523,784,1047,1568,2093]` → `tone(f,0.18,sine,0.105,i*0.045)` | Cascada ascendente larga y brillante | **Tablero completamente limpio** / bonus de vaciado (`8769`) |
| `over()` | `[392,311,247,196]` → `tone(f,0.22,sine,0.15,i*0.12)` | Escala **descendente** melancólica | **Game over** (`gameOver`, `9022`) |

### 4.4 Jefes (Aventura + Supervivencia)

| Método | Síntesis | Cómo suena | Cuándo / dónde |
|---|---|---|---|
| `bossWarn()` | `[196,220,247,277]` → `tone(f,0.15,sawtooth,0.06,i*0.09)` | Tensión creciente, sawtooth grave | Aviso de entrada de jefe (vía `Feedback 'bossWarn'`, `6541`/`5551`) |
| `bossDefeat()` | `tone(176,0.16,sawtooth,0.09)` + `chord([523,784,1047,1568],0.32,sine,0.10,0.045)` + `tone(2093,0.12,triangle,0.055,@0.30)` | Golpe grave → fanfarria → campanilla final | **Derrotar** un jefe por anclas en Supervivencia (`5674`) |
| `bossReward()` | `chord([659,880,1175,1568],0.18,triangle,0.085,0.055)` + `tone(1976,0.12,sine,0.055,@0.30)` | Campanilla de premio | Beat de botín tras derrotar jefe (`5684`) |

> Nota: los **avisos** de amenaza de jefe (fase 2, ataques de bioma, minijefe que
> entra) usan `danger()` o `quake()`, no firmas propias — ver §4.5 y §7.2.

### 4.5 Eventos de Supervivencia (despachados por `Feedback`, §6)

Estos se disparan **dinámicamente** con `Sound[snd]()` desde `Feedback.event()`.
El comentario en el código (`game.js:1229-1231`, FBK-05) dice que se crearon como
**firmas únicas por evento** para poder reconocerlos sin mirar el texto.

| Método | Síntesis | Cómo suena | Evento(s) que lo disparan |
|---|---|---|---|
| `tide()` | `[392,523,659,784,988]` → `tone(f,0.09,triangle,0.06,i*0.05)` + `tone(180,0.22,sine,0.05,@0.02)` | *Whoosh* ascendente + gorgoteo grave | Marea (`Feedback 'tide'`: `5732`, `6956`) |
| `meteor()` | `tone(1250,0.14,sine,0.05)` + `tone(720,0.12,sine,0.05,@0.07)` + `tone(88,0.16,sawtooth,0.10,@0.18)` + `tone(120,0.10,square,0.06,@0.28)` | Silbido que **cae** + dos impactos graves | Lluvia de meteoros (`Feedback 'meteor'`: `5751`, `6949`) |
| `frost()` | `chord([880,1175,1568],0.16,triangle,0.07,0.025)` + `tone(2100,0.05,sine,0.04,@0.08)` | Cristalino agudo | Frente helado (`Feedback 'frost'`: `5771`, `6963`, `6990`) |
| `lockdown()` | `tone(300,0.05,square,0.08)` + `tone(170,0.13,sawtooth,0.08,@0.05)` + `tone(120,0.14,square,0.06,@0.12)` | *Clank* metálico + cerrojo | Cierre/bloqueo (`Feedback 'lockdown'`: `5787`, `6978`, `7004`) + evento `quake` de "hilos" con override `snd:'lockdown'` (`7020`) |
| `quake()` | `[72,58,82,64,94]` → `tone(f,0.16,sawtooth,0.07,i*0.08)` | Retumbo grave e irregular | Terremoto (`Feedback 'quake'`: `5755`, `7033`); acción de jefe de bioma en Aventura (`4931`) |
| `echo()` | `[1319,988,784,659,523]` → `tone(f,0.10,sine,0.05,i*0.05)` | *Shimmer* **descendente** | Eco de jefe (`Feedback 'echo'`: `5793`, `6503`) |
| `waveUp()` | `tone(523,0.10,triangle,0.09)` + `tone(784,0.13,sine,0.08,@0.06)` | Dos notas ascendentes (progreso) | Nueva oleada normal (`Feedback 'waveUp'`: `5603`); "¡YA!" de la cuenta atrás de intro (`5213`) |
| `danger()` | `tone(120,0.09,sine,0.08)` | Pulso grave corto (aviso) | Comodín de amenaza (§7.2): presión de tiempo en Contrarreloj (`1955`, `2014`), aviso de ataque de jefe de bioma (`4909`), próxima oleada (`Feedback 'waveSoon'`, `5540`), fase 2 de jefe (`Feedback 'bossPhase'`, `6650`), minijefe entra (`6359`), Titiritero se cura (`6677`), y otro aviso en `8558` |
| `lifeBlast()` | `tone(92,0.18,sawtooth,0.08)` + `chord([392,587,784,1175],0.24,sine,0.09,0.035)` | Explosión grave + acorde de alivio | Perder una vida (`Feedback 'lifeLost'`, `5851`); **revivir** (`5905`) |

### 4.6 Tiles de hielo / rotura

| Método | Síntesis | Cómo suena | Cuándo / dónde |
|---|---|---|---|
| `iceCrack(stage)` | `base=820+min(stage,3)*80`; `tone(base,0.045,square,0.055)` + `tone(260,0.06,triangle,0.045,@0.025)` | Crujido corto (sube con el nº de golpes) | Golpear una celda **helada** sin romperla (`8243`) |
| `iceBreak()` | `chord([740,980,1320],0.12,triangle,0.08,0.018)` + `tone(1700,0.05,sine,0.05,@0.06)` | Cristal que se rompe | Romper del todo una celda helada (`8241`) |

### 4.7 Potenciadores (`booster(id)`, `game.js:1221-1228`)

Un único método con `switch` por id; el `default` cae en `rank()`.

| id | Síntesis | Cómo suena | Cuándo / dónde |
|---|---|---|---|
| `freeze` | `chord([880,1175,1568],0.16,triangle,0.07,0.025)` | Cristalino (idéntico a la base de `frost()`) | Congelar spawns (`5949`); **también** portal (`8503`) y ralentización *slowdown* (`8520`) |
| `bomb` | `tone(96,0.16,sawtooth,0.10)` + `tone(520,0.08,square,0.06,@0.04)` | Estallido grave + click | Bomba potenciador (`6006`); bomba oculta de tablero (`8515`); **encadenado** de bombas (`8479`) |
| `x2` | `chord([659,988,1319],0.14,square,0.055,0.018)` | Arpegio *square* (casi igual a `milestone`) | Multiplicador ×2 (`5949`) |
| `clearLine` | `[660,760,860,960]` → `tone(f,0.055,triangle,0.055,i*0.035)` | Barrido rápido ascendente | Rayo limpia-línea (`6006`) |
| `wild` | `chord([523,784,1047,1568],0.18,sine,0.08,0.03)` | Acorde amplio brillante | Comodín/escoba (`5986`, `6006`) |

### 4.8 Firmas **muertas** (definidas, nunca invocadas)

| Método | Síntesis | Estado |
|---|---|---|
| `rain()` (`1219`) | `[988,784,659,523,392]` → `tone(f,0.08,triangle,0.07,i*0.045)` | **Código muerto.** No hay ninguna llamada `Sound.rain()` ni `Feedback` que la use. Las coincidencias de "rain" en el código son el `atk:'rain'` del jefe meteoro y strings i18n, no el sonido. Sustituida por `meteor()` en FBK-05 |
| `grant()` (`1238`) | `chord([784,1047,1319,1568],0.16,sine,0.08,0.05)` | **Inalcanzable.** Existe la entrada `Feedback.SIG.grant` (`snd:'grant'`) pero **nadie llama `Feedback.event('grant')`**. Las recompensas usan sus propias animaciones de "grant flyer" sin este sonido |

---

## 5. Música de fondo (`Music`, `game.js:2985-3016`)

- **Generativa, sin archivos.** Secuenciador propio con `setInterval` cada 60 ms
  que agenda notas ~0.2 s por delante (`_sched`).
- **OFF por defecto** (`Settings.music=false`, `game.js:323`).
- Escala pentatónica-ish: `[220,247,294,330,392,440,494,587]`.
- **Volumen**: `musicGain` sube de `0.0001→0.14` en 0.8 s al arrancar
  (`linearRampToValueAtTime`, `2994`); al parar baja a `0.0001` en 0.4 s (o 0.05 s si
  `fast`).
- **Patrón por paso** (`_sched`, `3004-3014`):
  - `tempo = 0.30 - 0.12*intensity` (más intensidad → más rápido).
  - Cada 4 pasos: nota grave de bajo `scale[0]/2` (110 Hz), `sine`.
  - Cada paso: melodía `scale[(step*3) % 8]`, `triangle`, vol `0.32 + 0.3*intensity`.
  - Si `intensity>0.5` y paso par: armonía aguda una octava arriba, `sine`.
- **`setIntensity(v)`** (`3002`) — sube ganancia a `0.12 + 0.14*v` y acelera el tempo.

**Quién controla la intensidad de la música:**

| Disparador | Intensidad | Línea |
|---|---|---|
| Entrar en Fiebre | `1.0` | `8278` |
| Cada convergencia | `clamp(combo/18, 0, 1)` | `8376` |
| Salir de Fiebre (reset de combo) | `0.15` | `8785` |
| Supervivencia (por oleada + frenesí) | `0.12 + min(0.55,(wave-1)*0.045) + (frenesí?0.35:0)` | `5375` |

**Ciclo start/stop de la música:**

| Acción | Método | Línea |
|---|---|---|
| Empezar partida | `Music.start()` | `8089` |
| Reanudar tras pausa | `Music.start()` | `8193` |
| Reanudar tras revivir | `Music.start()` | `5906` |
| Toggle de Ajustes | `start()`/`stop()` | `11130` |
| Pausar | `Music.stop()` | `8162`, `8171`, `8188` |
| Cambiar de pantalla | `Music.stop()` | `2377` |
| Modal de revivir | `Music.stop()` (fade) | `5888`, `5890` |
| Fin de partida | `Music.stop()` | `8900`, `9041` |
| Coach/tutorial | `Music.stop()` | `7745` |

---

## 6. `Feedback`: el despachador de eventos (`game.js:2253-2285`)

Fuente única de verdad de cómo se comunica cada evento de Supervivencia
(color + icono + **sonido** + vibración + toast + destello de marco). La tabla
`Feedback.SIG` mapea un `id` de evento a `{snd, hap, ...}` y `Feedback.event(id, opts)`
ejecuta `if (snd && Sound[snd]) Sound[snd]()` (`game.js:2281`).

| `id` de evento | `snd` (método Sound) | Notas |
|---|---|---|
| `quake` | `quake` | terremoto |
| `tide` | `tide` | marea (`toastEn` normal/enraged) |
| `meteor` | `meteor` | lluvia de meteoros |
| `frost` | `frost` | frente helado |
| `lockdown` | `lockdown` | cierre |
| `echo` | `echo` | eco de jefe |
| `lifeLost` | `lifeBlast` | perder vida |
| `grant` | `grant` | **entrada definida pero nunca disparada** (§4.8) |
| `waveUp` | `waveUp` | nueva oleada |
| `waveSoon` | `danger` | próxima oleada (reusa `danger`) |
| `bossWarn` | `bossWarn` | aviso de jefe |
| `bossPhase` | `danger` | fase 2 de jefe (reusa `danger`) |

`opts.snd` puede **sobrescribir** el `snd` de la firma: p. ej. el evento de "hilos"
del Titiritero se manda como `quake` pero con `snd:'lockdown'` (`game.js:7020`).

---

## 7. Análisis de repeticiones (sonidos NO únicos por acción)

El objetivo del rediseño. Hay tres tipos de solapamiento.

### 7.1 Un mismo método para acciones semánticamente distintas

Estos son los que "suenan igual" para cosas diferentes y confunden el feedback.

- **`record()` — el más sobrecargado: ~15 acciones distintas** con exactamente la
  misma fanfarria de 4 notas. Récord de score en vivo, récord de tablero limpio,
  reliquia elegida (Aventura), hazaña/medalla, bendición elegida, hito de oleada,
  récord de oleada, jefe-oleada superado, minijefe derrotado, tablero jardín 50,
  cofre de racha, subida de nivel de jugador, cofre de pipeline, objeto raro de
  cofre, tier-up de cofre. → **Imposible distinguir "batí mi récord" de "abrí un
  cofre raro" solo por el oído.**
- **`milestone()` — ~8 acciones**: hito de combo, aparición de selector de reliquia,
  aparición de selector de bendición, recompensa de mundo, bonus +30, caja mágica,
  cápsula de tiempo, logro. → Mezcla "aparece una elección" con "recogí un bonus"
  con "desbloqueé un logro".
- **`danger()` — ~7 avisos distintos**: presión de tiempo (Contrarreloj), ataque de
  jefe de bioma (Aventura), próxima oleada, fase 2 de jefe, minijefe entra,
  Titiritero se cura, aviso en `8558`. → Un mismo pulso grave para toda amenaza.
- **`tap()` — comodín de "toque neutro/bloqueado"**: celda ocupada, objeto trigger,
  tablero bloqueado, romper roca/cadena parcial, tick de cuenta atrás, agrietar
  ancla/jaula, nivel/mundo bloqueado, usar pista. → No diferencia "no puedes" de
  "diste un toque válido a algo".
- **`ui()`** — además de la navegación de menú (razonable), se usa para
  **"potenciador vacío"** y **"potenciador bloqueado"** (`5925`, `5926`): estados de
  **error** que suenan igual que un click neutro (deberían compartir familia con
  `miss()`).
- **`eliminate()`** — la convergencia real y la **destrucción de tiles** (hielo,
  roca, jaula) comparten sonido. `n` cambia el tono, pero la firma es la misma.
- **`level()`** — completar un nivel y **ganar** la partida (`win`) suenan idéntico.
- **`fever()`** — Fiebre (Clásico) y Frenesí (Supervivencia) comparten firma; son
  conceptualmente lo mismo, pero literalmente el mismo sonido para dos sistemas.
- **`booster('freeze')`** — se reusa para tres cosas: congelar, **portal** y
  **slowdown**. **`booster('bomb')`** para tres: bomba, bomba oculta y encadenado.

### 7.2 Métodos distintos con síntesis casi idéntica (colisión de timbre)

Aunque tengan nombres diferentes, suenan casi igual:

- **`x2` ≈ `milestone`**: ambos `chord([659,988,1319], …, 'square', …)`. Mismas 3
  notas, mismo timbre; solo cambian duración/volumen. El multiplicador ×2 y un hito
  de combo son indistinguibles.
- **`booster('freeze')` ≈ `frost()`**: `frost` es literalmente
  `chord([880,1175,1568], triangle)` **+** un `tone(2100)` de brillo. Es decir, el
  potenciador de congelar y el **evento de escarcha del jefe** comparten el 90 % del
  sonido — justo lo que FBK-05 quería evitar.
- **`grant()` ≈ `rank()`**: `grant = chord([784,1047,1319,1568])`, `rank =
  chord([784,1047,1319])`. `grant` es `rank` + una nota. (Y `grant` está muerto.)
- **`echo()` ≈ `rain()`**: los dos son arpegios **descendentes** de `triangle/sine`
  sobre casi el mismo conjunto de notas (`echo` una tercera más arriba). (`rain`
  está muerto.)
- **Familias de "escala corrida"**: `level` (asc), `over` (desc), `rain` (desc),
  `tide` (asc), `boardClear` (asc) son todas escalas/arpegios de 4-5 notas seno-ish;
  a bajo volumen y en móvil varias se confunden entre sí.
- **Familia hielo**: `iceBreak` (`[740,980,1320]`) y `frost`/`freeze`
  (`[880,1175,1568]`) son ambas "cristalinas" y cercanas.

### 7.3 Código muerto / inalcanzable

- **`Sound.rain()`** (`1219`): definido, **nunca llamado**.
- **`Sound.grant()`** (`1238`): definido y referenciado en `Feedback.SIG.grant`,
  pero **`Feedback.event('grant')` no se invoca en ningún sitio** → inalcanzable.
- Ambos ocupan espacio conceptual y confunden el inventario. Candidatos a borrar o
  a **reconectar** (p. ej. usar `grant` para las recompensas que hoy reutilizan
  `record`/`milestone`).

---

## 8. Tabla-resumen para priorizar el rediseño

| Prioridad | Problema | Acción sugerida |
|---|---|---|
| **Alta** | `record()` cubre ~15 acciones | Separar en familias: *récord personal*, *recompensa de cofre*, *progresión de meta* (level-up), *elección tomada* |
| **Alta** | `milestone()` mezcla "aparece elección" / "bonus" / "logro" | Firma propia para apertura de Picker vs. pickup de tablero vs. logro |
| **Alta** | `danger()` para toda amenaza | Firmas por tipo de amenaza (tiempo vs. jefe vs. oleada) o al menos 2-3 variantes |
| **Media** | `x2`≈`milestone`, `freeze`≈`frost` (colisión de timbre) | Reescribir `x2` y `freeze` con timbres propios |
| **Media** | Errores (`booster vacío/bloqueado`) suenan como `ui()` neutro | Familia de "denegado" derivada de `miss()` |
| **Media** | `tap()` como comodín de bloqueado + válido | Distinguir "acción imposible" de "toque válido a tile" |
| **Baja** | `fever()`/Frenesí y `level()`/`win()` comparten firma | Variantes (opcional; son conceptualmente parientes) |
| **Baja** | `rain()` y `grant()` muertos | Borrar o reconectar |
| **Transversal** | Sin control de volumen; envelopes muy cortos (12 ms de ataque) suenan a "beep" | Considerar mezcla maestra, colas/reverb sintética y curvas de envelope por familia |

---

## 9. Índice rápido de referencias

- Módulo `Sound`: `game.js:1144-1240`
- Primitivas `tone`/`chord`: `game.js:1176-1188`
- Módulo `Music`: `game.js:2985-3016`
- Módulo `Feedback` (+ `SIG`): `game.js:2253-2285`
- Gating SFX: `game.js:1177` · Gating música: `Settings.music`
- Defaults de settings: `game.js:323` (`sfx:true, music:false`)
- Desbloqueo iOS: `game.js:1148-1175`
