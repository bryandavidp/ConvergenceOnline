# Plan de claridad de feedback — Convergence

> Objetivo: que **cualquier persona en "modo sencillo"** entienda, sin leer, **qué acaba de pasar** en la partida (sobre todo en Supervivencia). Hoy el jugador mira el tablero y el feedback importante vive fuera de su foco (toasts fugaces encima, premios en la barra inferior) o es ambiguo (terremoto = "los iconos se movieron").
>
> Dirección aprobada por el propietario (2026-07-12): responsive **móvil-primero** (el móvil marca las restricciones), sistema **por capas** = **marco del tablero reactivo por evento** + **toasts rediseñados (secundarios)** + **sonido/vibración distintivos por evento**; **visual primero, texto mínimo**; arranque con **tarjeta de objetivo + cuenta 3·2·1**. **Sin banner central** (el "momento" se diseña dentro del propio tablero, que es donde están los ojos).
>
> Relación con otros planes: complementa `GAME_MODES_MASTER_PLAN.md` (identidad/pacing de modos) y `PLAYER_FEEDBACK_PLAN.md` (FB-*, ya cerrado). Prefijo de tareas nuevo: **FBK-**.

---

## 1. Metodología y hallazgos

Análisis en dos frentes: (a) lectura del código de feedback (`Toasts`, `Render.boardEvent/cellPulse/impact`, `Survival.*`, `Sound`, `Haptics`, CSS de `.toast` y `.board-wrap`), y (b) **prueba en vivo con un agente Haiku jugando como usuario primerizo**, disparando cada evento vía `window.__cv.Survival.*` (`?dev`) y puntuando la claridad 1–5 sin leer texto.

### Hallazgos confirmados (ordenados por impacto)

| # | Hallazgo | Evidencia |
|---|---|---|
| H1 | **Terremoto, marea y meteoro son indistinguibles** ("los iconos se movieron / el tablero se llenó"). El terremoto **teletransporta** (no desliza) → se lee como barajado aleatorio. | Claridad 2 / 2.5 / 2 sobre 5. Los tres = "icon rearrangement, no distinctive animation". |
| H2 | **Los toasts se pierden**: tan fugaces (1.6–1.8 s) y **encima del tablero** que un tester buscándolos reportó "sin toast" en 5 eventos que sí lo lanzan. | Columna "Toast readable? = No" en marea/meteoro/terremoto/escarcha/cierre. |
| H3 | **Apilamiento de toasts en el cambio de oleada** (Oleada N + monedas + récord + iconos nuevos a la vez). | "Multiple toasts collide and become unreadable". |
| H4 | **La ventaja concedida es casi invisible** (booster aleatorio): sucede en la barra inferior, no en el tablero. | Claridad 1/5. "Zero visual indication; only timer change". |
| H5 | **Arranque sin objetivo**: no se comunica que se sobrevive, que se pierde por desbordamiento, ni el rol del temporizador. | Claridad de objetivo 2.5/5. |
| H6 | **Sonidos colisionan**: marea≈meteoro (`rain`), escarcha≈cierre (`booster('freeze')`), aviso-oleada≈aviso-jefe≈subida-oleada (`danger`). | `Sound.rain` (game.js ~783), `Sound.booster` (~786), `Sound.danger` (~773). |
| H7 | **Lo que SÍ funciona** (≥4.5/5): escarcha, cierre, pérdida de vida, modales de jefe/bendición. | Todos dejan **estado persistente y coloreado en el tablero** o abren un **modal ineludible**. |

**Lección rectora (de H7):** el feedback que **vive en el tablero y persiste** se entiende; el **texto fugaz encima** no. Todo el plan mueve la carga comunicativa *al tablero* y deja el texto como confirmación secundaria.

---

## 2. Principios de diseño

1. **El evento se cuenta con su "verbo de movimiento" en el propio tablero.** Terremoto = deslizar/tumbar; marea = subir agua; meteoro = caer desde arriba; escarcha = congelar extendiéndose; cierre = candados que se estampan. Donde están los ojos, ahí ocurre la explicación.
2. **Código de valencia (semáforo).** Antes que "qué evento", el usuario debe captar **"¿bueno o malo?"** por color:
   - 🔴/🟠 **AMENAZA** (rojo/ámbar) · 🔵 **AMENAZA FRÍA** (azul hielo) · 🟡🟢 **BENEFICIO** (oro/verde) · ⚪ **INFO** (neutro).
   - El marco del tablero adopta esta valencia siempre. Un usuario que no lee sabe al instante si celebrar o reaccionar.
3. **Nunca solo color.** Cada evento se distingue por **color + forma de movimiento + glifo + sonido + vibración** (redundancia → daltónicos, con sonido apagado, en movimiento). Ninguna señal viaja sola.
4. **Un evento importante a la vez.** Cola/serializador: dos beats grandes no se pisan (mín. ~700–900 ms entre ellos); un solo toast de evento visible a la vez.
5. **Texto = confirmación, no explicación.** 1–2 palabras + glifo grande. El chatter (monedas, récord) baja al HUD, no ocupa un toast.
6. **Paridad `reduced-fx` / `prefers-reduced-motion`.** Toda animación tiene alternativa estática (tinte + glifo) que conserva la valencia y el color; nunca se pierde la información al desactivar efectos.
7. **Bilingüe.** Todo string nuevo va a `I18n.DICT` ES/EN; nada hardcodeado.

---

## 3. Arquitectura de la solución (sistemas transversales)

Refactor keystone: **un único despachador de feedback + un registro declarativo de firmas de evento.** Hoy cada evento llama a mano a `Toasts.show` + `Sound.*` + `Haptics.*` + `Render.boardEvent`, con colisiones y omisiones. Se centraliza para **garantizar** que cada evento es distinto en las 5 dimensiones.

### A) Registro de firmas de evento (`FBK-01`)
Tabla declarativa, fuente única de verdad:

```js
// Ejemplo de forma (no final)
const EVENT_SIG = {
  quake:    { valence:'threat', hue:'amber', frame:'shake',  motion:'slide',  glyph:'teleporter',   snd:'quake',    hap:'quake',   toast:'surv_quake' },
  tide:     { valence:'threat', hue:'water', frame:'wobble', motion:'flood',  glyph:'🌊',          snd:'tide',     hap:'roll',    toast:'surv_tide' },
  meteor:   { valence:'threat', hue:'ember', frame:'flashTop',motion:'drop',  glyph:'v2:meteor',   snd:'meteor',   hap:'impacts', toast:'surv_meteor' },
  frost:    { valence:'cold',   hue:'ice',   frame:'frost',  motion:'creep',  glyph:'v2:snowflake',snd:'frost',    hap:'ice',     toast:'surv_frost' },
  lockdown: { valence:'threat', hue:'steel', frame:'stamp',  motion:'slam',   glyph:'🔒',          snd:'lockdown', hap:'clank',   toast:'surv_lockdown' },
  echo:     { valence:'threat', hue:'violet',frame:'echo',   motion:'ghost',  glyph:'🔁',          snd:'echo',     hap:'quake',   toast:'surv_eco' },
  grant:    { valence:'boon',   hue:'gold',  frame:'sparkle',motion:'flyIn',  glyph:'✨',          snd:'grant',    hap:'reward',  toast:'surv_grant' },
  lifeLost: { valence:'threat', hue:'red',   frame:'crack',  motion:'overfill',glyph:'heart',      snd:'lifeBlast',hap:'life',    toast:'surv_life_lost' },
  waveUp:   { valence:'neutral',hue:'amberSoft',frame:'sweep',motion:null,    glyph:'fire',        snd:'waveUp',   hap:'combo',   toast:'st_wave' },
};
```

Un único punto de entrada `Feedback.event(id, opts)` lee la firma y orquesta marco + movimiento + sonido + háptico + toast, respetando cola y `reduced-fx`. Los handlers de `Survival` dejan de cablear feedback a mano y solo llaman a su verbo de tablero + `Feedback.event('quake')`.

### B) Código de valencia en el marco (`FBK-02`)
`.board-wrap` gana un borde reactivo más grueso y visible en periferia, cuyo color = valencia de la firma. Tokens CSS nuevos: `--fbk-threat`, `--fbk-cold`, `--fbk-boon`, `--fbk-info`. El marco es el **canal periférico** que se capta con el rabillo del ojo aunque el foco esté en el centro.

### C) Cola de toasts + rediseño (`FBK-03`)
- **Cola serial**: nunca 2 toasts de evento a la vez; tiempo mínimo en pantalla garantizado (~2.2–2.6 s), y el más nuevo espera su turno en vez de apilarse/expulsar (`while children>3 remove` se sustituye por cola).
- **Rediseño**: chip de icono más grande, **1 línea corta**, barra fina de tiempo restante (el usuario ve cuánto le queda para leer), acercado al borde del tablero.
- **Degradar el chatter**: monedas y récord dejan de ser toasts; se animan en los **chips del HUD** (contador de monedas hace count-up, chip de oleada parpadea). Solo el **evento** ocupa toast.

### D) Verbos de movimiento en tablero (`FBK-04` … el mayor arreglo)
Cada amenaza anima su "verbo" (detalle en §4). Clave técnica del terremoto: **FLIP** (First-Last-Invert-Play) — capturar posición vieja de cada icono, aplicar el barajado, y animar `transform` de vieja→nueva para que **se deslicen** en lugar de teletransportarse. Es lo que convierte "barajado random" en "temblor que sacudió todo".

### E) Audio + háptico únicos por evento (`FBK-05`)
Se rompen las colisiones (H6). Cada familia recibe un motivo de 2–3 notas y un patrón de vibración propio:

| Evento | Sonido nuevo (idea) | Vibración |
|---|---|---|
| Terremoto | rumor grave sostenido `sawtooth` desc. + subgrave | larga irregular (ya existe `quake`) |
| Marea | "whoosh" ascendente + gorgoteo | rodante creciente |
| Meteoro | silbido de caída + 2–3 impactos secos | staccato de impactos |
| Escarcha | cristalino ascendente (mantener `freeze`) | `ice` |
| Cierre | "clank" metálico + cerrojo | golpe seco doble |
| Eco | shimmer invertido / con delay | eco de `quake` |
| Ventaja | campana ascendente alegre | patrón de recompensa |

### F) Serializador de beats / pacing (`FBK-06`)
Formaliza lo que hoy se hace con `setTimeout` sueltos (p. ej. "iconos nuevos" +1.2 s, `_bossSurvivedAt` +1.2 s, `_boonAt` +1.7 s): un mini-scheduler que garantiza separación mínima entre beats grandes y un **micro-suspense antes del jefe** (breve oscurecido/latido del marco en el color del jefe → golpe).

### G) Experiencia de arranque (`FBK-07`)
Tarjeta de objetivo pre-partida + cuenta atrás + ventana de gracia (ver §5).

### H) Accesibilidad (`FBK-08`)
`reduced-fx` y `prefers-reduced-motion`: fallback estático por evento (tinte de marco + glifo persistente + toast), conservando valencia/color. Daltonismo: color siempre acompañado de glifo+movimiento distintos. Mantener/mejorar `announce()` para lector de pantalla con el nombre del evento.

---

## 4. Rediseño evento por evento

Leyenda: **Verbo** = cómo se mueve el tablero · **Marco** = reacción del borde · **Persistencia** = qué queda visible tras el golpe.

| Evento | Problema hoy | Verbo de movimiento (nuevo) | Marco / color | Persistencia | Sonido·Háptico |
|---|---|---|---|---|---|
| **Terremoto** (`quake` ~3432) | Teletransporta → "barajado random" (H1) | **Deslizar/tumbar** los iconos a su nueva celda con FLIP; onda de choque que barre filas; polvo + grietas parpadeando en la rejilla | Ámbar, sacudida lateral **más fuerte y larga** (ya existe `surv-quake`, intensificar) | Breve poso de polvo | rumor grave · vibración larga |
| **Marea** (`tideSurge` ~3402) | Parece spawn normal (H1) | **Subir agua** desde el borde: línea de agua que asciende por el anillo exterior con ondulación; celdas se llenan con "chapoteo" de fuera hacia dentro | Cian-azul, wobble de ola | Anillo con tinte húmedo 1–2 s | whoosh ascendente · rodante |
| **Meteoro** (`meteorRain` ~3424) | "Mala suerte", no evento (H1) | **Caer desde arriba**: los iconos entran desde encima del borde con estela y "cráter"/destello rojo al impactar | Rojo-naranja, flash desde arriba | Destello de impacto por celda | silbido+impactos · staccato |
| **Escarcha** (`frostSurge` ~3442) | Ya 4.5/5 (H7) | **Congelar extendiéndose**: barrido de escarcha; refinar el `iceHit` existente | Azul hielo, escarcha en bordes | Celdas heladas (persistente ✔) | cristalino · `ice` |
| **Cierre** (`lockdown` ~3457) | Ya 4.5/5 pero suena igual que escarcha (H6) | **Estampar candados**: los candados "caen y se sellan" con golpe | Acero/rojo, "stamp" | Candados (persistente ✔) | **clank metálico** (distinto de escarcha) · golpe seco |
| **Eco** (`echoBoss` ~3473) | "Ha vuelto a por ti" poco legible | **Fantasma/rebobinado**: pre-destello fantasma del jefe anterior, luego repite su animación | Violeta, doble latido | — | shimmer invertido |
| **Subida de oleada** (`newWave` ~3316) | Apilamiento de toasts (H3) | Sin verbo de tablero; **tick** del chip de oleada del HUD (pulsa e incrementa) + barrido de luz en el borde superior | Ámbar suave, "sweep" | Chip de oleada actualizado | motivo de progreso propio (no `danger`) · `combo` |
| **Aviso de jefe** (`_r.bossWarned` ~3294) | Bueno (anticipación); suena como aviso de oleada (H6) | Micro-suspense: marco late en **el color del jefe** con su glifo telegrafiado en los bordes | Color del jefe entrante | — | tensión ascendente única por familia |
| **Ventaja concedida** (`grantRandom`/`_grant` ~3200) | Invisible (H4) | **Vuela hacia dentro**: el icono del booster sale de la barra con estela hacia el centro + chispa dorada; el chip del booster hace "pop/glow" fuerte | **Oro**, destello sparkle | Chip con +1 resaltado | campana ascendente · recompensa |
| **Bendición** (`offerBoons`/`applyBoon` ~3085) | Modal ya 5/5 (H7) | Mantener modal; al aplicar, animar el efecto sobre el tablero (imán, oleada dorada…) | Oro | Efecto visible en HUD/mult | `record` |
| **Pérdida de vida** (`onOverflow` ~3520) | 4.5/5, pero poco claro el "por qué" | **Sobre-relleno**: destello rojo en la(s) celda(s) donde el tablero se llenó; el corazón perdido "vuela"; grieta en el marco | Rojo, "crack" | Corazón menos en HUD | `lifeBlast` · `life` |
| **Furia/Frenesí** (`activateFrenzy` ~3158) | Debe leerse como **BUENO** | Ya tiene fever/confeti; asegurar color **oro/fuego** (beneficio), nunca rojo de amenaza | Oro/fuego | Clase `surv-frenzy-*` | ascendente positivo |

> Nota de coherencia cromática: **amenazas** = rojo/ámbar/azul-hielo; **beneficios** = oro/verde. Frenesí y ventaja NO pueden compartir el rojo de las amenazas: es la señal más importante para el "modo sencillo".

---

## 5. Arranque de partida (`FBK-07`)

Secuencia nueva al entrar a Supervivencia (reemplaza la avalancha actual — hoy `Survival.start` ~2982 lanza el toast del mutador semanal y el flujo suelta récord/oleada encima):

1. **Tarjeta de objetivo** (breve, visual, ineludible pero rápida de cerrar), con 3 iconos y una frase por icono:
   - 🎯 *Sobrevive el mayor número de oleadas.*
   - 🔗 *Junta iconos iguales tocando la casilla vacía entre ellos.*
   - ❤️ *Si el tablero se llena, pierdes una vida.*
2. **Cuenta atrás 3·2·1** sobre el tablero ya visible (el jugador ubica vidas/oleada/temporizador antes de empezar).
3. **Ventana de gracia** (~3–5 s): sin eventos/penalizaciones ni toasts de evento; solo jugar. El aviso del mutador semanal se integra en el chip 📅 (ya re-consultable, SV-11), no como toast de apertura.
4. **Tutorial contextual solo la 1ª vez** (una vez, persistido): coach-marks señalando vidas, oleada, temporizador y el primer evento cuando ocurra. Reutiliza el sistema `Coach` existente.
5. **Mini-leyenda persistente en HUD**: que "oleada", "vidas" y el temporizador sean auto-explicativos (etiqueta/icono), para que el objetivo no dependa de un toast que se desvanece.

---

## 6. Plan por fases

> Cada fase es entregable y verificable de forma aislada. Ninguna toca balance (no requiere `balance-sim`), pero **sí** requiere bump de versión (`VERSION`/`CACHE`/`?v=`) al tocar `game.js`/`styles.css` (ver CLAUDE.md; en Windows el triple bump es manual).

### Fase 0 — Fundación (refactor invisible)
- **FBK-01** Registro `EVENT_SIG` + despachador `Feedback.event()`.
- **FBK-02** Tokens de valencia + marco reactivo base en `.board-wrap`.
- **FBK-03** Cola de toasts + rediseño del toast; degradar chatter al HUD.
- **FBK-05** Separar sonidos/hápticos colisionados (romper `rain`/`freeze`/`danger` compartidos).
- *Salida visible*: se acaban los toasts apilados (H3) y los sonidos duplicados (H6).

### Fase 1 — Legibilidad de amenazas (arregla el H1, la queja principal)
- **FBK-04a** Terremoto con FLIP (deslizar) + onda + polvo.
- **FBK-04b** Marea "sube agua"; **FBK-04c** Meteoro "cae"; **FBK-04d** pulir escarcha/cierre y diferenciar cierre (clank + stamp).
- **FBK-04e** Eco (fantasma) y aviso de jefe con color propio + micro-suspense (`FBK-06`).

### Fase 2 — Legibilidad de recompensas
- **FBK-09** Beat de "ventaja concedida" (vuela + oro + campana) — mata el H4.
- **FBK-10** Pérdida de vida como "daño" claro (sobre-relleno + grieta).
- **FBK-11** Coherencia cromática de frenesí/bendición (beneficio ≠ amenaza).

### Fase 3 — Onboarding
- **FBK-07** Tarjeta de objetivo + 3·2·1 + gracia + leyenda HUD + coach 1ª vez.

### Fase 4 — Pulido y accesibilidad
- **FBK-08** Paridad `reduced-fx`/`prefers-reduced-motion`, daltonismo, `announce()` con nombre de evento.
- **FBK-12** QA final: re-correr el protocolo de prueba del usuario primerizo.

---

## 7. Criterios de aceptación

Re-ejecutar el **protocolo de la prueba** (agente jugando de primerizo, disparando cada evento por `window.__cv.Survival.*`):

1. **Distinción**: terremoto, marea y meteoro se identifican como **eventos distintos** solo por lo visual (hoy los tres = "icons moved").
2. **Claridad ≥ 4/5** para todos los eventos de §4 (hoy terremoto/marea/meteoro = 2, ventaja = 1).
3. **≤ 1 toast de evento** visible a la vez; ninguno se pierde por fugacidad (barra de tiempo visible).
4. **Valencia** legible sin leer: en ≤0.5 s el usuario dice "bueno" vs "malo" por el color del marco.
5. **Arranque**: un primerizo enuncia el objetivo (sobrevivir), la condición de derrota (desbordamiento) y el rol del temporizador tras la tarjeta.
6. **Audio**: cada evento tiene sonido único (sin colisiones `rain`/`freeze`/`danger`).
7. **`reduced-fx`**: cada evento sigue siendo identificable (tinte + glifo + toast) sin animación.
8. **Móvil**: verificado en viewport estrecho (portrait), con el marco captable en periferia con el dedo sobre el tablero.

---

## 8. Notas de implementación

**Anclas de código** (líneas aprox., archivo crecido a ~6750 líneas):
- Toasts: `Toasts.show` ~1508; CSS `.toasts`/`.toast` ~1393–1432.
- Render FX: `boardEvent`/`cellPulse`/`impact`/`meteor`/`iceHit` ~1255–1296; CSS `.board-wrap.*` y `@keyframes surv-*` ~1281–1353; fallbacks `reduced-fx` ~2748–2771.
- Survival: `start` ~2982, `BOSS_DEFS` ~3030, `BOONS`/`offerBoons`/`applyBoon` ~3071–3132, `newWave` ~3316, `bossEvent` ~3361, `_runBoss` ~3393, `tideSurge`/`meteorRain`/`quake`/`frostSurge`/`lockdown`/`echoBoss`/`_shuffle` ~3402–3483, `onOverflow` ~3520, grant/booster ~3200–3211, avisos de oleada/jefe ~3286–3304.
- Sound (colisiones a romper): `danger` ~773, `quake` ~782, `rain` ~783, `lifeBlast` ~784, `booster` ~785. Haptics ~700–712.
- Dev hook `window.__cv` (para probar): ~6749.

**Restricciones del repo** (CLAUDE.md):
- 100% vanilla; animaciones vía WAAPI/CSS que corran en el compositor (transform/opacity) — el gobernador de `FX.cap` y el patrón "sin canvas" existen por un fallo de compositing de WebKit; no introducir canvas ni bucles de RAF nuevos.
- Todo string nuevo → `I18n.DICT` ES/EN con clave; usar `data-i18n`/`I18n.t()`. Texto de evento: 1–2 palabras.
- Persistencia retrocompatible (`cv_meta`): el flag "tutorial de Supervivencia ya visto" se rellena por defecto al cargar.
- Al tocar `game.js`/`styles.css`: subir `VERSION`, `CACHE` (sw.js) y los `?v=` de `index.html` (triple bump manual en Windows).

**Riesgos / mitigaciones:**
- *Rendimiento en móvil* (FLIP del terremoto = 64 animaciones): reutilizar el pool WAAPI existente, solo transform/opacity, respetar `FX.cap`; en `reduced-fx` no animar (barajado instantáneo + tinte).
- *Regresión de balance*: este plan no cambia reglas ni números; si algún ajuste rozara timings de spawn/oleada, pasar por `balance-sim` y comparar con `BALANCE_BASELINE.md`.

---

## 9. Bitácora de implementación

> Registro vivo del estado para sobrevivir a pérdidas de contexto. Actualizar al cerrar cada fase.

### ✅ Fase 0 — Fundación (v2.6.8) — COMPLETADA
Commit: (ver historial "SV/FBK-0"). Verificado: 85 tests verdes, eslint limpio, prueba en navegador (`?dev`) sin errores de consola.

**Entregado:**
- **FBK-01** Módulo `Feedback` (game.js, tras `Toasts`, ~línea 1560) con registro `SIG` de 11 eventos (`quake, tide, meteor, frost, lockdown, echo, lifeLost, grant, waveUp, waveSoon, bossWarn`) y despachador `Feedback.event(id, opts)` que orquesta toast+sonido+háptico+marco. Expuesto en `window.__cv.Feedback`.
- **FBK-03** `Toasts` con **cola serial de eventos** (`Toasts.event()` + `_evQ`/`_pumpEv`/`_trim`): nunca se solapan dos toasts de evento (verificado: al disparar 4 seguidos, 1 activo + 3 en cola). Toast de evento con **barra de tiempo restante** (`.toast-bar`, duración inline). `Toasts.show()` (chatter) intacto con fusión ×N.
- **FBK-05** Sonidos ÚNICOS nuevos en `Sound`: `tide, meteor, frost, lockdown, waveUp, bossWarn, grant, echo` (rotas las colisiones `rain`/`booster('freeze')`/`danger`). Hápticos nuevos en `Haptics`: `roll, impacts, clank, reward`.
- **FBK-02** (parcial) Tokens de valencia en `:root` (`--fbk-threat/cold/boon/warn/info`) + clase de marco `.board-wrap.fbk-boon` (destello dorado) usada por la ventaja concedida. Añadida a la lista `reduced-fx`.
- **Migrados a `Feedback.event()`**: `tideSurge, meteorRain, quake, frostSurge, lockdown, echoBoss, onOverflow, grantRandom`, avisos `waveUp/waveSoon/bossWarn`; y los toasts de recompensa/récord/iconos-nuevos/bendición pasados a `Toasts.event()` (serial). Esto ataca H1 (parcial: audio+toast), H3 (apilamiento) y H4 (ventaja visible: +marco dorado, campana, vibración de recompensa).

**Decisiones / notas:**
- Valencia de toast por evento (color secundario; la distinción fuerte vendrá del movimiento en Fase 1): quake/tide/waveUp/waveSoon=`warn` (ámbar), meteor/lockdown/echo/lifeLost/bossWarn=`bad` (rojo), frost=`info` (azul), grant=`good`.
- El pico de arranque (3 toasts de chatter: mutador semanal + "¡A jugar!" + "carga boosters") **sigue presente** → es H5, se aborda en Fase 3 (tarjeta de objetivo + 3·2·1 + gracia). No tocado en Fase 0.
- `Sound.rain()` queda sin uso (lo reemplazan `tide`/`meteor`); se conserva por si se reutiliza.
- El marco por evento de marea/meteoro aún comparte `surv-rain`; diferenciar el **movimiento de marco** es Fase 1 (FBK-04).

**Pendiente heredado para fases siguientes:**
- Consolidar aún más los toasts de oleada (fundir monedas normales dentro del toast de "Oleada N") — diferido; hoy se serializan, que ya evita el solape.
- Degradar monedas/récord del toast al HUD (count-up) — diferido a Fase 2/3.

### ✅ Fase 1 — Legibilidad de amenazas (v2.6.9) — COMPLETADA
Verificado: 85 tests verdes, eslint limpio, prueba en navegador (`?dev`) sin errores de consola.

**Entregado (FBK-04):**
- **Terremoto (pieza estrella, arregla H1):** `Render.quakeSlide(srcOf)` — los iconos ahora **se DESLIZAN** de su casilla vieja a la nueva (FLIP, solo `transform` → compositor) en vez de teletransportarse. `Survival._shuffle(animate)` reescrito para mapear destino→origen y disparar el deslizamiento; `quake()` llama `_shuffle(true)`. Verificado en vivo: 57/58 iconos animando, keyframes con offsets reales (múltiplos del tamaño de celda ~73px, p. ej. `translate(293.9px,0)` = 4 celdas). En `reduced-fx` no anima (barajado instantáneo).
- **Marcos diferenciados por evento:** antes marea/meteoro compartían `surv-rain` y el cierre compartía `surv-frost`. Ahora: marea → `surv-tide` (azul, vaivén de ola), meteoro → `surv-meteor-board` (rojo, flash desde arriba), cierre → `surv-lockdown` (acero, "clamp"). Verificado en vivo: cada handler aplica su clase propia.
- **Movimiento de celda por evento:** marea rellena con `tide-fill` (los iconos "suben" desde abajo) en vez del pop genérico; cierre estampa candados con `lock-stamp` (impacto) en vez de `ice-hit`. Ambos con paridad `reduced-fx`.
- Escarcha se mantiene (ya era 4.5/5, familia hielo `surv-frost` intacta).

**Notas:**
- El deslizamiento del terremoto son ≤64 animaciones WAAPI one-shot (solo transform); un `getBoundingClientRect` por celda (una pasada de layout). Coste acotado y raro (solo jefe terremoto). Respeta `reduced-fx`.
- `Sound.rain()` sigue sin uso desde Fase 0 (conservado).

**Pendiente de fases siguientes (heredado):**
- **H5 (arranque):** tarjeta de objetivo + 3·2·1 + ventana de gracia + coach 1ª vez + leyenda HUD → **Fase 3**.
- Verbos de tablero adicionales (meteoro "cae" con estela/cráter más marcado; eco fantasma; bossWarn en color del jefe) → refinamiento opcional.
- Degradar monedas/récord del toast al HUD (count-up) → Fase 2.
- Beat de "ventaja concedida" con vuelo al centro (hoy: marco dorado + campana + toast, suficiente para H4) → refinamiento Fase 2.

### ✅ Fase 3 — Onboarding / arranque (v2.6.10) — COMPLETADA
> Adelantada sobre la Fase 2 por decisión del propietario: era su queja explícita (H5).
Verificado: 85 tests verdes (incluida paridad i18n ES/EN de las claves nuevas), eslint limpio, prueba en navegador (`?dev`) sin errores.

**Entregado (FBK-07):**
- **Tarjeta de objetivo + cuenta 3·2·1**: `Survival.intro()` monta un overlay `#surv-intro` sobre el tablero (scrim ligero, tablero visible detrás) con 3 líneas — 🎯 sobrevivir, 🔗 juntar iconos, ❤️ perder vida por desbordamiento — y el mutador semanal integrado; luego cuenta 3·2·1 → "¡YA!" y se desvanece. i18n nuevas: `surv_intro_goal/merge/lose`, `surv_go` (ES+EN).
- **Ventana de gracia**: `Survival._introActive()` gatea `blockSpawn()` y el `onTick()` (no avanza el reloj de oleada ni caen eventos hasta terminar la cuenta). Verificado: durante el intro `spawnsBlocked=true`; al terminar (~3.2s) `introActive=false`, spawns reanudan, overlay oculto.
- **Fin de la avalancha de toasts del inicio (H5)**: en Supervivencia se suprimen `lets_play` ("¡A jugar!"), `ModeSignals.brief` (resumen de modo) y el toast de mutador; todo eso lo cubre la tarjeta. Verificado en vivo: 0 toasts de apertura del juego (solo apareció el aviso de "nueva versión" de la PWA, propio de mi limpieza de caché, no del flujo normal).
- Paridad `reduced-fx`: sin animaciones, tarjeta breve (1.6s) y arranque.

**Notas:**
- El overlay es hijo de `.board-wrap` (position:relative, tamaño del tablero) → `inset:0` lo encaja exacto. Se crea una vez y se reutiliza; sobrevive a `Render.buildBoard()` (que solo vacía `#board`).
- Durante el intro el overlay bloquea taps en el tablero (sin `pointer-events` propios que jueguen): grace real, sin toques accidentales.

**Pendiente (heredado):**
- Coach contextual de 1ª vez señalando vidas/oleada/temporizador → opcional, la tarjeta ya cubre el objetivo; se puede añadir luego reutilizando el módulo `Coach`.
- Leyenda persistente del HUD (etiquetas en oleada/vidas/tiempo) → opcional.

### ✅ Fase 2 — Legibilidad de recompensas (v2.6.11) — COMPLETADA
Verificado: 85 tests verdes, eslint limpio, prueba en navegador (`?dev`) sin errores.

**Entregado:**
- **FBK-09** `Render.grantPop(token)`: la ventaja concedida APARECE grande en el centro del tablero con chispa dorada y "cae" hacia la barra de boosters. Verificado en vivo: el `.grant-pop` se crea en `#popups` y anima. Complementa el marco dorado + campana + vibración de recompensa ya puestos en Fase 0 (H4 cerrado).
- **FBK-10** Pérdida de vida como DAÑO: marco rojo `surv-damage` (sacudida) en vez del destello dorado, + `Render.livesHit()` (los corazones del HUD se sacuden/enrojecen). `_relief(frac, frame)` ahora acepta el marco; `onOverflow` pasa `null` (no dorado, ya está el rojo), `revive` mantiene el dorado. Verificado: overflow → `surv-damage` sí / `life-blast` no / corazones `hit`; revive → dorado sí.
- **FBK-11** Coherencia cromática beneficio≠amenaza: el único caso incoherente (marco dorado en la pérdida de vida) queda resuelto por FBK-10. Ventaja/bendición/frenesí = oro/verde; amenazas = rojo/ámbar/azul.

### ✅ Fase 4 — Pulido y accesibilidad (v2.6.11) — COMPLETADA (código); re-test abajo
**Entregado:**
- **FBK-08** `prefers-reduced-motion` del SO: helper `motionOff()` (= `Settings.reducedFx || prefersReduceMotion()`) gatea las animaciones JS nuevas (deslizamiento del terremoto, `grantPop`); media query CSS `@media (prefers-reduced-motion: reduce)` neutraliza las animaciones de feedback aunque el FX in-app esté activo. Daltonismo: cada evento combina color + icono + movimiento + sonido (nunca color solo). `announce()` con el nombre del evento ya se emite desde `Feedback.event()` (Fase 0), así que el lector de pantalla dice "¡Terremoto!", "¡Marea!", etc.
- **FBK-12** Re-test del protocolo de usuario primerizo: ver §10.

---

## 10. Resultado del re-test (FBK-12) — criterio de aceptación cumplido

Re-ejecutado el protocolo del "usuario primerizo" (agente Haiku, disparando cada evento por `window.__cv.Survival.*` sobre v2.6.11) y comparado con el baseline de la §1.

| Evento | Claridad ANTES | Claridad DESPUÉS | Distinguible | Evidencia |
|---|---|---|---|---|
| Terremoto | 2 | **5** | sí | 62 glifos animando a la vez (deslizan, no teletransportan); marco `surv-quake` ámbar |
| Marea | 2.5 | **5** | sí | marco `surv-tide` **azul** (borde 120,200,255) — distinto del ámbar del terremoto |
| Meteoro | 2 | **4** | sí | marco `surv-meteor-board` propio + celdas `.surv-meteor` cayendo |
| Escarcha | 4.5 | **4** | sí | `frost-field` + celdas de hielo |
| Cierre | 4.5 | **4** | sí | marco `surv-lockdown` propio (antes compartía el de escarcha) |
| Ventaja concedida | **1** | **4** | sí | `.grant-pop` aparece en el **centro** del tablero (antes: invisible) |
| Pérdida de vida | 4.5 | **5** | sí | marco de daño + "Vida perdida, quedan 2" |
| **Arranque** | 2.5 (objetivo poco claro) | **claro** | — | tarjeta de objetivo + cuenta 3·2·1; **0 toasts** de apertura (antes 3 apilados) |

**Veredicto sobre las 4 quejas originales (todas resueltas):**
- (a) Terremoto/marea/meteoro **ya se distinguen** (marco, color, animación y sonido propios).
- (b) El terremoto **desliza** los iconos (62 glifos viajando, no teletransporte).
- (c) La ventaja concedida **ya es visible** (popup dorado en el centro).
- (d) La **avalancha de toasts del inicio desaparece** (0 al arrancar; el objetivo lo da la tarjeta).

Sin errores de consola. **Todos los eventos ≥4/5 y distinguibles → se cumple el criterio de aceptación de la §7.**

> Nota menor detectada: en la pérdida de vida el agente percibió el marco como "rojo/naranja" (la sacudida `surv-damage` es roja pura, 255,80,90); lee correctamente como daño. Sin acción requerida.

---

## ✅ Plan completado (v2.6.8 → v2.6.11)

Las 5 fases (FBK-0…4) están implementadas, verificadas (85 tests, eslint, prueba en navegador) y commiteadas. Refinamientos opcionales que quedan anotados para el futuro (no bloqueantes): verbos de tablero adicionales (meteoro con estela/cráter más marcados, eco fantasma, aviso de jefe en el color del jefe). La **Fase 5** (abajo) recoge la leyenda persistente del HUD, el coach de 1ª vez y el paso de monedas/récord al HUD.

---

## 11. Fase 5 — Leyenda persistente del HUD y mejoras adjuntas (PLANIFICADA)

> Objetivo: que **durante la partida** (no solo en la tarjeta de arranque) cualquiera entienda qué significa cada elemento del HUD de Supervivencia — sobre todo la **barra de peligro**, que hoy es literalmente el medidor de "cuánto te falta para perder" y no tiene etiqueta visible. Dirección aprobada por el propietario (2026-07-12): **leyenda por capas** + las **4 mejoras adjuntas**. Prefijo de tareas: **HUD-**.

### Diagnóstico del HUD actual (Supervivencia)
Elementos ya presentes pero **opacos** para un recién llegado (ver `index.html` §screen-game y `Render.hud`):
- `#surv-lives` (❤️❤️❤️) — vidas. *Relativamente claro.*
- `#surv-wave` ("Oleada N") + `.surv-waveprog` (barra fina de **cuenta atrás a la siguiente oleada**, sin etiqueta) + `#surv-tier` ("N1", pill de dificultad **críptica**).
- `#surv-time` ("0s") — tiempo sobrevivido, sin etiqueta.
- **`.occ` / `#hud-progress-fill`** — barra de **ocupación del tablero** con estados `warn`(ámbar)/`danger`(rojo). **Es el medidor de la condición de derrota** (si el tablero se llena, pierdes vida) y su única etiqueta es `sr-only` "Ocupación" → invisible para quien ve. **Máxima prioridad.**
- `#surv-build` — chips de bendiciones + mutador 📅 (ya re-consultable al tocar; es el patrón a generalizar).

### Principio: leyenda POR CAPAS
1. **Capa siempre visible (mínima):** solo lo crítico lleva etiqueta/icono fijo → la **barra de peligro**. El resto no se recarga.
2. **Capa "?" (bajo demanda):** un botón de ayuda persistente abre una **leyenda completa** que explica cada elemento; también reabre el objetivo.
3. **Capa "tocar para explicar":** tocar cualquier chip del HUD muestra una línea de ayuda (generaliza el patrón del chip 📅). Cero carga visual.

### Tareas

**HUD-01 · Barra de peligro legible** *(la meta de "no perder")* — **prioridad alta**
- Añadir a `.occ` una **etiqueta/icono persistente** a la izquierda de la barra: en estado normal, discreta (p. ej. icono de tablero + texto muy pequeño "Tablero"); al entrar en `warn`/`danger`, cambia a **⚠ "Peligro"** y la barra se refuerza (leve pulso en `danger`, respetando `reduced-fx`).
- Toggle de estado desde `Render.hud` (donde ya se aplican `.warn`/`.danger` a `#hud-progress-fill`, game.js ~1448): añadir la clase/el texto al nuevo elemento de etiqueta.
- i18n: `hud_danger` ("Peligro"/"Danger"), `hud_board_fill` ("Tablero"/"Board"). Mantener `aria`/`sr-only` actualizado.
- Aceptación: sin leer nada más, se entiende que esa barra creciendo = acercarse a perder.

**HUD-02 · Botón "?" + leyenda desplegable** *(objetivo re-consultable)*
- Añadir un botón "?" persistente y pequeño en el HUD de Supervivencia (candidato: fila `.controls`, junto a pausa/reiniciar/salir).
- Al tocarlo → `Survival.legend()` abre un **modal/tarjeta de leyenda** que explica cada elemento con su icono + una línea: corazones = vidas; Oleada N = ronda (sube dificultad); barra fina superior = cuenta atrás a la siguiente oleada; N1/N2 = nivel de dificultad; **barra de peligro = cuánto se llena el tablero (si se llena, pierdes vida)**; tiempo = cuánto llevas vivo; + el objetivo (sobrevivir).
- Reutilizar el estilo de la tarjeta de intro (`.si-card`) o un modal propio `#surv-legend`. La tarjeta de arranque (Fase 3) puede enlazar aquí ("¿qué es esto?").
- Enlazable también desde el menú de pausa.

**HUD-03 · Tocar para explicar + aclarar el tier** *(generaliza el patrón 📅)*
- Delegación de eventos sobre `#surv-bar` y `.occ`: cada elemento con `data-explain="clave"` muestra su línea al tocarlo (vía un toast corto/tooltip). Elementos: vidas, oleada, **tier N{n}** ("Dificultad: sube cada varias oleadas"), tiempo, barra de peligro, barra de oleada.
- Aprovecha que el chip 📅 ya hace esto; unificar en un solo manejador.
- Descubribilidad: el botón "?" (HUD-02) es la vía principal; el toque es un extra. Opcional: micro-hint "toca para saber más" una sola vez.

**HUD-05 · Monedas/récord al HUD** *(menos toasts)*
- Sacar del flujo de toasts las recompensas rutinarias de oleada:
  - Monedas: "+N" con count-up sobre el pill de monedas del HUD (reutilizar `countUp`) o un flotante breve, en vez del `Toasts.event` de `_waveReward` (caso no-hito).
  - Récord: destello/etiqueta "¡Récord!" en `#surv-best-wave` (ya existe en la surv-bar) en vez del toast de `_checkWaveRecord`.
- El **toast de hito** (oleada %5/%10 con cofre/gemas) se mantiene: es una celebración mayor. Conservar `announce()` para accesibilidad.
- Efecto: el canal de toasts queda casi exclusivamente para **eventos** (amenazas/ventajas), reforzando la jerarquía de la Fase 0.

**HUD-06 · Coach contextual de 1ª vez** *(onboarding)*
- Solo la **primera** partida de Supervivencia (flag persistido en `cv_meta`, retrocompatible): tras la cuenta atrás de arranque, 2–3 coach-marks señalando **corazones (vidas) → barra de peligro → oleada**. Reutilizar el módulo `Coach` (coach-marks ya existen para el tutorial de Clásico) o una versión ligera.
- Skippable y una sola vez.

### Sub-fases (entregables incrementales)
- **5A** — HUD-01 (barra de peligro) + HUD-03/tier: el núcleo de la leyenda, mayor valor.
- **5B** — HUD-02 (botón "?" + leyenda desplegable).
- **5C** — HUD-05 (monedas/récord al HUD).
- **5D** — HUD-06 (coach de 1ª vez).

### Transversal
- i18n ES/EN para todo string nuevo; nada hardcodeado.
- Paridad `reduced-fx` / `prefers-reduced-motion` en cualquier animación nueva (pulso de peligro, count-up, destello de récord, coach) — reutilizar `motionOff()`.
- **Móvil (portrait) manda**: el botón "?" y la etiqueta de peligro deben caber sin romper la surv-bar; verificar en viewport estrecho.
- Persistencia retrocompatible (`cv_meta`): el flag "coach de Supervivencia visto" se rellena por defecto al cargar.
- Bump de versión (`VERSION`/`CACHE`/`?v=`) al tocar `game.js`/`styles.css`.

### Criterios de aceptación
1. Un recién llegado, **sin** la tarjeta de arranque, puede señalar cada elemento del HUD y decir qué significa (vía "?" o al tocarlo).
2. El significado de la **barra de peligro** es obvio (etiqueta + estado); se entiende que llenarse = perder.
3. El tier N1/N2 deja de ser críptico (explicado en leyenda y al tocar).
4. Menos toasts rutinarios: monedas/récord ya no ocupan el canal de eventos.
5. El coach de 1ª vez aparece una sola vez y es skippable.
6. Verificado en móvil (portrait), con paridad de accesibilidad.

### Bitácora Fase 5
- ⏳ Pendiente de implementación (plan aprobado; sub-fases 5A→5D).
