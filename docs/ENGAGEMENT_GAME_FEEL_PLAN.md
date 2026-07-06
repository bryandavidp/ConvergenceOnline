# Plan de mejora de retencion y game feel

> Documento vivo de implementacion. Mantenerlo actualizado cada vez que una fase cambie reglas, feedback, economia, audio, animacion o navegacion.

## Principio de diseno

El objetivo es aumentar retencion, claridad y placer de juego con patrones eticos: feedback inmediato, metas cortas, dominio progresivo, sorpresa controlada y recompensas legibles. No se implementaran patrones hostiles como castigos fuertes por no volver, escasez falsa, friccion para salir, monetizacion agresiva o llamadas compulsivas.

## Estado de partida

Convergence ya ofrece:

- Mecanica central 8x8 de convergencia por rayos cardinales.
- Modos Tutorial, Clasico, Aventura, Contrarreloj, Supervivencia, Zen y Reto del dia.
- Combo, Fever, bonus de tablero limpio, misiones, XP, monedas, gemas, tickets, cofres, tienda cosmetica y racha diaria.
- Audio WebAudio, haptica, particulas DOM/WAAPI con gobernador de rendimiento y modo `reduced-fx`.
- Home V1 con Reto del dia, Clasico y Supervivencia; multijugador fuera de V1.

## Escalera emocional

Cada sesion debe tener recompensas en tres ventanas:

1. **0-1 segundos:** cada toque correcto debe responder con movimiento, sonido, haptica, score y color.
2. **10-60 segundos:** combo, Fever, booster, oleada, mision parcial o medalla diaria deben dar sensacion de avance.
3. **2-10 minutos:** nivel, cofre, reto diario, record, cosmetico o recomendacion contextual deben indicar que hacer despues.

## Matriz de feedback por evento

| Evento | Visual | Audio | Haptica | Estado |
|---|---|---|---|---|
| Convergencia x2 | Pop, puntos, vuelo al centro, motas al HUD | Nota limpia | Pulso suave | Hecho Fase 1 |
| Convergencia x3 | Rayos hacia objetivo, pulso tablero, motas al HUD | Arpegio ascendente | Combo | Hecho Fase 1 |
| Convergencia x4 | Onda fuerte, burst mayor, score al HUD | Acorde brillante | Milestone | Hecho Fase 1 |
| Subida de tier de combo | Rank flash y color de combo | Fanfarria corta | Milestone | Parcial |
| Combo casi agotado | Aro urgente y pulso final | Sin audio por defecto | No | Hecho Fase 1 |
| Fever | Aura, flash, cambio musical | Acorde energetico | Patron Fever | Existente |
| Tablero limpio | Onda, confeti, score popup | Recompensa mayor | Patron level | Existente |
| Booster listo | Boton y barra celebran | Milestone | Combo | Hecho Fase 1 |

## Plan completo

### Fase 1 - Game feel inmediato

Objetivo: subir la satisfaccion por jugada sin cambiar balance.

- Recompensas diferenciadas para x2/x3/x4 y combos altos.
- Rayos o lineas visuales del punto tocado a las piezas que convergen.
- Particulas de recompensa que vuelan hacia el marcador.
- Aro de combo con estado urgente cuando esta a punto de expirar.
- Pulso de impacto en tablero para convergencias grandes.
- Booster listo con celebracion clara.
- Mantener todo bajo `reduced-fx` y el gobernador de particulas.

### Fase 2 - Identidad por modo

- Clasico: maestria, estrellas, objetivos secundarios y rachas perfectas. Estado: implementada racha perfecta persistente y senal de mastery en banner/modal.
- Aventura: descubrimiento, capitulos, modificadores elegibles y mini-jefes mas claros. Estado: implementada nota de modificador/objetivo en banner.
- Contrarreloj: adrenalina, ultimos segundos, ghost personal y capsulas de tiempo. Estado: implementada presion visual/audio de ultimos segundos; ghost/capsulas quedan pendientes.
- Supervivencia: intensidad, sinergias de boosters, oleadas mas telegrafiadas. Estado: implementada alerta de oleada entrante y estado visual `soon`.
- Zen: calma, coleccion cosmetica y feedback menos agresivo. Estado: implementada identidad calmada en banner.
- Reto del dia: medallas bronce/plata/oro y comparacion con marca personal. Estado: implementadas medallas visuales de marca diaria; comparacion social queda fuera de V1.

### Fase 3 - Retencion etica y siguiente accion

- Final de partida con recomendacion contextual.
- Progreso visible hacia misiones y recompensas cercanas.
- Maestria por modo y recompensas por variedad.
- Descubribilidad de cofres, tickets, gemas y cosmeticos sin popups agresivos.

### Fase 4 - Audio y musica por intensidad

- Motivos sonoros por modo.
- Capas musicales por combo, Fever, peligro y ultimos segundos.
- Efectos sinteticos diferenciados para reward, error, record, mision y cofre.

### Fase 5 - Datos, QA y balance

- Checklist visual mobile/desktop.
- Tests de reglas sin tocar balance numerico a ciegas.
- Si hay backend futuro: telemetria opt-in y anonima para balancear, no para presionar.

## Criterios de coherencia

- No cambiar reglas, economia ni dificultad en Fase 1 salvo que se documente aqui.
- Toda string nueva debe ir por i18n ES/EN.
- Todo efecto nuevo debe apagarse o reducirse con `Settings.reducedFx`.
- No romper PWA/cache: si se toca `game.js` o `styles.css`, ejecutar `tools/bump-version.sh`.
- Mantener rendimiento: animar `transform`/`opacity`; evitar animaciones persistentes de `box-shadow`.

## Registro de implementacion

### 2026-07-06 - Inicio

- Se crea este documento como contexto vivo.
- Siguiente paso: ejecutar Fase 1 sin alterar balance numerico.

### 2026-07-06 - Fase 1 implementada

- `Sound.match()` diferencia matches normales, triples, cuádruples y combos altos sin cambiar reglas.
- `FX.converge()` ahora dibuja rayos finos desde la casilla tocada hacia cada pieza convergente.
- `FX.scoreToHud()` envia motas de recompensa desde la jugada al marcador para conectar accion y premio.
- `Render.impact()` añade pulso corto de tablero para convergencias de mayor valor.
- `Render.comboRing()` marca el aro como `urgent` al bajar del 24% de ventana de combo.
- `Render.boosterReady()` celebra visualmente el booster que acaba de concederse en Supervivencia.
- Contrarreloj ahora hace bump del HUD de tiempo cuando una convergencia suma segundos.
- Decision tecnica: no se implementa hit-stop real en el loop; se usa impacto visual para no desincronizar timers, spawns, RunSave ni partidas seedeadas.
- Balance intacto: no se han cambiado puntos, spawn, dificultad, economia, recompensas ni probabilidades.
- Version/cache actualizados a mano por falta de distro WSL disponible para ejecutar `tools/bump-version.sh`: `VERSION = 2.0.1`, `sw.js` cache `cv-cache-v2.0.1`, `styles.css?v=v143` y `game.js?v=v135`.
- Verificacion automatizada completada: `node --check game.js`, `node --check sw.js`, `node --test 'tests/*.test.js'` y `npx --yes eslint@9 .` pasan sin errores.
- Servidor local iniciado y comprobado en `http://localhost:8080/index.html`.
- Smoke visual en navegador completado: carga `screen-login`, no hay errores de consola, y estan activos `styles.css?v=v143` y `game.js?v=v135`.
- Smoke de flujo jugable completado: invitado -> inicio -> modos -> clasico -> nivel 1 -> tablero; una convergencia real de 2 iconos sube el marcador a 20 y deja las celdas objetivo vacias sin errores de consola.
- Fase 1 cerrada. Siguiente bloque recomendado: Fase 2, progresion emocional y goals inmediatos dentro/fuera de partida.

### 2026-07-06 - Fase 2 implementada

- Se crea `ModeSignals` como capa centralizada de identidad por modo: clases `mode-*`, acento CSS `--mode-accent`, notas de banner, brief inicial y nota contextual de resultado.
- Clasico registra `Meta.recordClassicPerfect()` y muestra racha perfecta/mejor racha en el modal de nivel. La racha se reinicia si la partida clasica termina en fallo.
- Aventura muestra en el banner una senal de descubrimiento con modificador de bioma u objetivo del nivel.
- Contrarreloj activa `time-pressure` / `time-critical` al bajar de 20s/10s, con pulso del chip de tiempo, evento visual de tablero y aviso sonoro solo al entrar en estado critico.
- Supervivencia avisa cuando la oleada supera el 78% de progreso con toast, pulso de tablero y estado `.surv-bar.soon`.
- Zen muestra una lectura calmada del modo en el banner sin feedback agresivo.
- Reto del dia calcula medallas visuales bronce/plata/oro segun score (`750/1500/2500`) sin premios extra; se muestran en home, misiones y resultado.
- Se anaden notas contextuales al resultado para orientar el siguiente intento por modo.
- Balance intacto: no se han cambiado puntos, spawn, dificultad, economia, recompensas ni probabilidades.
- Version/cache actualizados a mano por falta de distro WSL disponible para ejecutar `tools/bump-version.sh`: `VERSION = 2.0.2`, `sw.js` cache `cv-cache-v2.0.2`, `styles.css?v=v144` y `game.js?v=v136`.
- Verificacion automatizada completada: `node --check game.js`, `node --check sw.js`, `node --test 'tests/*.test.js'` y `npx --yes eslint@9 .` pasan sin errores.
- Smoke visual en navegador completado: home carga `styles.css?v=v144` y `game.js?v=v136`; Reto diario abre `screen-game` con clases `mode-contrarreloj mode-timed mode-daily`, banner con nota de medallas y sin errores de consola.
- Smoke visual de Clasico completado: flujo modos -> mapa -> nivel 1 abre `screen-game` con `mode-clasico`, estrellas vivas y nota de maestria en banner, sin errores de consola.
- Fase 2 cerrada salvo pendientes explicitamente diferidos: ghost/capsulas de Contrarreloj y comparacion social del Reto diario quedan para una fase posterior porque requieren mas superficie de datos/UX.
