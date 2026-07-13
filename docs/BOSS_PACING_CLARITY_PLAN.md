# Plan de pacing y claridad de jefes

> Objetivo: que los jefes de Supervivencia tengan un ritmo legible. El jugador debe
> poder responder cuatro preguntas sin leer una wiki: quien ha llegado, que va a
> hacer, que me acaba de hacer y que he ganado al vencerlo o sobrevivirlo.
>
> Este plan amplifica el sistema ya implementado en `BOSS_SYSTEM_MASTER_PLAN.md`.
> No cambia la fantasia central ni la economia base: ordena la puesta en escena.

## 1. Diagnostico del estado actual

El sistema tecnico esta solido: encuentros activos, anclas, PV, fases, niveles,
minijefes, bestiario y tests verdes. La friccion viene del ritmo.

Problemas observados:

- Entrada comprimida: al empezar una oleada de jefe, la recompensa de la oleada
  anterior, el cambio de oleada, la boss card, las anclas y el marco del tablero
  compiten en menos de un segundo.
- Primer ataque demasiado temprano: el ataque llega a unos 6s, pero el tell empieza
  a unos 3.5s. Como la card dura 2.6s, queda poco espacio limpio para leer jefe y
  anclas.
- Banner incompleto: muestra cuenta atras e icono, pero no el nombre del ataque.
- Telegraph generico: casi todo usa `tide-warn`, asi que las amenazas no tienen
  vocabulario visual propio.
- Fase 2 brusca: al romper media vida, el jefe cambia de patron sin una ventana de
  lectura garantizada antes del siguiente ataque.
- Resolucion solapada: ultimo golpe, regalo del jefe, toast, rank flash, confeti,
  flyer de monedas, Ronda Maestra y bendicion se pisan.
- Playtest incompleto: el checklist valida bandera de jefe, pero no comprension de
  identidad, ataque, dano, fase, recompensa y bendicion.

Principio rector tipo PvZ: un evento importante por vez. El juego puede ser infinito,
pero cada pico debe tener anticipacion, ejecucion y cierre con aire.

## 2. Reglas de direccion de escena

Prioridad de beats:

1. `bossIntro`: entrada, boss card, anclas, banner.
2. `bossAttackTell`: nombre del ataque + premarca.
3. `bossAttackImpact`: efecto del ataque y resumen breve.
4. `bossPhase`: fase 2, cambio de patron, pausa.
5. `bossResolve`: derrotado o retirada.
6. `bossReward`: botin visual, Ronda Maestra, efecto-regalo.
7. `boon`: eleccion de bendicion.
8. `waveChatter`: monedas de oleada, record, nuevos iconos.

Reglas duras:

- En frontera de jefe, el cambio de oleada no debe animar el mismo marco del tablero
  que la entrada del jefe.
- Las recompensas de oleada previas a jefe se pagan, pero se celebran en bajo perfil.
- El primer tell del jefe no debe aparecer hasta que la card haya salido y el jugador
  haya visto las anclas.
- La fase 2 siempre concede una nueva ventana de lectura.
- La bendicion no aparece hasta que el cierre visual del jefe haya terminado.
- El banner no desaparece al ultimo golpe: se queda en estado de resolucion.

## 3. Timings propuestos

Entrada de jefe:

- 0.0s: frontera de oleada. Se apaga bandera previa.
- 0.0-1.2s: lock corto de entrada + frame del jefe.
- 0.0-2.6s: boss card con nombre, epiteto y nivel.
- 2.6-6.5s: ventana limpia para mirar anclas y banner.
- 6.5-9.5s: tell del primer ataque.
- 9.5s: primer ataque.

Durante encuentro:

- Ataques normales: cada 11-14s segun jefe.
- Tell: 2.5s minimo.
- Despues de impacto: 1.2-1.8s de resumen en banner.
- Fase 2: minimo 6.2s hasta el siguiente impacto, por tanto unos 3.7s antes de un
  nuevo tell.

Resolucion:

- 0.0s: ultimo ancla rota o retirada.
- 0.0-0.7s: colapso/regalo del jefe.
- 0.7-2.5s: banner en `DERROTADO` o `SE RETIRA`.
- 1.3s: beat principal de derrota/superado.
- 3.0-3.6s: bendicion.

## 4. Cambios por subsistema

### 4.1 `Bosses`

- Crear constantes de pacing (`FIRST_ATTACK_MS`, `PHASE_ATTACK_GRACE_MS`,
  `RESOLVE_FACE_MS`).
- Inicializar el primer ataque con retraso perceptivo en vez de los 6s actuales.
- Al entrar en fase 2, recortar `atkAcc` para garantizar gracia antes del siguiente
  ataque.
- Introducir `Bosses.face`: estado visual temporal posterior al encuentro, separado
  de `Bosses.enc`, para mantener el banner vivo aunque ya no haya mecanica activa.
- Asegurar que `startEncounter`, `startMini`, `abort` y `cleanup` limpian estados
  visuales residuales.

### 4.2 `Survival.render`

- Renderizar `Bosses.enc || Bosses.face`.
- En jefes activos, mostrar nombre de ataque en la pildora: `Marea completa 3s`.
- En resolucion, mostrar `Nubarron DERROTADO` o `se retira`.
- Anadir clases `resolved`, `defeated`, `retreating` para CSS.

### 4.3 `Survival.newWave` y recompensas

- En oleada de jefe, suprimir `surv-wave-up` para no competir con la entrada.
- En oleada previa que acaba justo antes de jefe, pagar monedas/gemas/cofre pero no
  lanzar confeti/toast grande.
- A futuro: cola de beat para record vivo y nuevos iconos, con prioridad inferior a
  jefe.

### 4.4 Feedback de ataques

- Fase 1: banner con nombre de ataque.
- Fase 2: premarca especifica por familia:
  - meteor: rojo/impacto.
  - tide: azul/borde.
  - frost: hielo compacto.
  - lockdown: acero/candado.
  - quake: ambar/onda.
  - crystalid: cian/esquirlas.
  - void: purpura/succion.
  - puppeteer: rosa/hilos.
- Despues de impacto, resumen corto en banner o toast serial: `Devora: 2 iconos`,
  `Jaula: Barrido`, `Hilos activos`.

### 4.5 Audio

- Separar cuatro stings:
  - entrada de jefe;
  - fase 2;
  - derrota;
  - recompensa del jefe/Ronda Maestra.
- No reutilizar `Sound.record()` como unico sonido de derrota. Puede quedarse como
  fallback, pero el jefe necesita una firma emocional propia.

### 4.6 Tests y playtest

Tests automaticos:

- Primer ataque no antes de `FIRST_ATTACK_MS`.
- Fase 2 garantiza `PHASE_ATTACK_GRACE_MS`.
- Banner persiste en resolucion y se apaga al expirar.
- Bendicion post-jefe no aparece antes del cierre visual.
- Oleada de jefe no dispara frame de `surv-wave-up`.

Checklist manual:

- Quien era el jefe?
- Que ataque estaba preparando?
- Que cambio en fase 2?
- Que te hizo el ultimo ataque?
- Lo derrotaste o se retiro?
- Que recompensa recibiste antes de la bendicion?

## 5. Fases de ejecucion

### BP-0: Director de escena minimo

Estado: ejecutado en v2.6.31.

- Crear este plan.
- Retrasar primer ataque.
- Garantizar gracia de fase 2.
- Mantener banner durante resolucion.
- Mostrar nombre del ataque en el banner.
- Suprimir celebracion de oleada en frontera de jefe.
- Bump de version y tests.

### BP-1: Lenguaje visual de ataques

Estado: ejecutado en v2.6.32.

- Sustituir `tide-warn` generico por clases por familia.
- Ajustar CSS y `reduced-fx`.
- Probar en movil estrecho y desktop.

### BP-2: Recompensa de jefe como momento

Estado: ejecutado en v2.6.32.

- Secuenciar colapso, regalo, monedas/Ronda Maestra y bendicion.
- Crear sting de derrota y reward.
- Hacer que el botin vuele desde el jefe/anclas, no solo desde el HUD.

### BP-3: Cola de beats transversal

Estado: ejecutado parcialmente en v2.6.32, con foco en la secuencia de jefe.

- Formalizar un scheduler de beats grandes para reemplazar `setTimeout` sueltos.
- Prioridades por canal: tablero, banner, toast, reward, modal.
- Aplicar a record, nuevos iconos, hito de oleada y boss reward.

### BP-4: Playtest y ajuste fino

Estado: ejecutado en v2.6.32.

- Actualizar checklist.
- Ejecutar run normal hasta primer jefe y run dificil corta.
- Ajustar timings si el usuario aun no puede narrar lo ocurrido.

## 6. Riesgos y mitigacion

- Menos ataques por encuentro: los cambios iniciales desplazan ataques, pero no
  deberian reducir el numero total en normal/dificil. Si el sim detecta bajada fuerte,
  se compensa con `durMs` o cadencia, no con tells mas cortos.
- HUD estrecho: mostrar nombres de ataque puede apretar el banner. CSS debe permitir
  ellipsis sin romper vidas/oleada/tiempo.
- Recompensas invisibles: pagar en bajo perfil antes de jefe no significa perderlas.
  El HUD/run coins debe actualizarse; solo se elimina ruido.
- `Bosses.face` residual: `startEncounter`, `startMini`, `abort` y expiracion deben
  limpiarlo siempre.

## 7. Registro

### 2026-07-13 - BP-0 ejecutado en v2.6.31

- Plan creado.
- Primer ataque retrasado a `FIRST_ATTACK_MS = 9500` para que la card y las anclas
  tengan lectura antes del primer tell.
- Fase 2 protege `PHASE_ATTACK_GRACE_MS = 6200` y cancela tells/targets viejos si el
  jugador rompe anclas justo antes de un ataque.
- `Bosses.face` mantiene el banner en estado de resolucion durante `RESOLVE_FACE_MS`
  tras derrota o retirada.
- El banner nombra el ataque entrante, no solo el icono y la cuenta atras.
- La recompensa de oleada previa a jefe se paga en bajo perfil y la frontera de jefe
  ya no dispara el frame `surv-wave-up`.
- Bendicion post-encuentro separada del cierre visual: derrota a 3.6s, retirada a 3.0s.
- Checklist de playtest ampliado con preguntas de identidad, ataque, fase, resolucion
  y recompensa.
- Verificacion: `node --test tests/*.test.js` 127/127, `npx --yes eslint@9 .` limpio,
  `node tools/balance-sim.js --runs 40` exit 0 (oleada supervivencia normal 18,
  dificil 22; warning no bloqueante `TimeoutNaNWarning` al cierre del simulador).

### 2026-07-13 - BP-1/BP-2/BP-3 ejecutados en v2.6.32

- BP-1: el telegraph de encuentros deja de usar siempre `tide-warn`. Cada familia de
  ataque tiene clase propia: meteoro, marea, escarcha, candado, terremoto, esquirlas,
  vacio y titiritero.
- Hallazgo BP-1: no todos los ataques tienen celdas objetivo. Terremoto total y
  Titiritero son amenazas de tablero/tipo, asi que ahora disparan `boss-warn-board`
  en vez de inventar objetivos falsos.
- BP-1: `reduced-fx` y `prefers-reduced-motion` apagan los pulsos nuevos y mantienen
  la marca estatica.
- BP-2: la derrota de jefe usa `Sound.bossDefeat()`, el botin usa `Sound.bossReward()`
  y el marco `boss-reward`; asi el kill y el pago dejan de sonar/verse como record
  generico.
- BP-2: las monedas de derrota vuelan desde la zona de anclas/jefe hacia el HUD de
  monedas. El pago economico sigue siendo inmediato para no tocar balance; el feedback
  visual se separa 620ms.
- BP-2: la Ronda maestra conserva su efecto mecanico inmediato, pero el toast se
  retrasa 1120ms para no pisar el botin.
- BP-3: se introduce `_scheduleBeat`, `_pumpBeats` y `_clearBeats` en Supervivencia.
  Primeros usos: reward de jefe y toast de nuevos iconos. La cola usa `performance.now`
  y se procesa en `Survival.onTick`, evitando timers sueltos en la secuencia critica.
- Riesgo aceptado BP-3: aun quedan `setTimeout` historicos fuera de la secuencia de
  jefe. Se priorizo no reescribir feedback global no relacionado con el problema
  principal de claridad de jefes.
- Hallazgo colateral: la Urraca podia no devolver un icono robado si moria junto a un
  borde con su radio cercano lleno. Se corrigio con fallback al hueco libre mas
  proximo para que el botin prometido siempre vuelva.

### 2026-07-13 - BP-4 verificado en v2.6.32

- Checklist manual ya incluye preguntas de identidad del jefe, ataque, fase,
  resolucion y recompensa.
- Verificacion automatica:
  - `node --check game.js` OK.
  - `node --test tests/*.test.js` 130/130.
  - `npx --yes eslint@9 .` limpio.
  - `node tools/balance-sim.js --runs 40` exit 0. Supervivencia normal mantiene
    oleada 18 y dificil oleada 22; persiste el `TimeoutNaNWarning` no bloqueante
    conocido al cierre del simulador.
- Verificacion local: `http://localhost:8090/index.html` responde 200.
