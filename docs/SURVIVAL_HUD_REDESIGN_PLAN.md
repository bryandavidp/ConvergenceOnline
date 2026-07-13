# Plan de rediseño HUD - Supervivencia

## Objetivo

Rediseñar la pantalla de Supervivencia para que el jugador entienda en todo momento:

- cuanto lleva: puntuación, mejor puntuación, tiempo, oleada, mejor oleada;
- cuanto puede gastar o ha ganado: monedas disponibles, gemas disponibles y monedas de la run;
- en que estado esta la partida: vidas, progreso de oleada, peligro del tablero, efectos activos;
- que acaba de pasar: errores, combos, hitos, jefe, recompensas, sin solaparse con oleada/vida/tiempo.

La mejora debe sentirse mas elegante y mas precisa en detalles pequenos: paddings, alineaciones, separadores numericos, zonas fijas para eventos, tamano minimo de botones y estabilidad del tablero.

## Problemas detectados

- La puntuacion se muestra sin separadores. Cuando sube a cientos de miles o millones, se vuelve lenta de leer.
- `Render.hud()` escribe `State.displayScore`, y el count-up del loop tambien escribe directamente `#hud-score`. El formateo debe aplicarse en ambos caminos.
- Los eventos/toasts compiten visualmente con la banda de Supervivencia. Aunque estan encima del tablero, en pantallas moviles el area puede sentirse como un bloque unico y ruidoso.
- La `surv-bar` mezcla vidas, oleada y tiempo en una sola fila. Funciona, pero no jerarquiza bien los estados mas importantes.
- La ocupacion del tablero no muestra porcentaje visible. El jugador ve una barra, pero no sabe rapidamente si esta al 60%, 75% o 90%.
- Las monedas y gemas no son una pieza estable del HUD de partida, pese a que revivir, compras y recompensas dependen de ellas.
- Los chips de build/efectos activos son utiles, pero conviene agruparlos como "estado pasivo" y no como eventos.

## Propuesta de jerarquia

### 1. Cabecera de economia, puntuacion y controles

Cabecera fija de recursos, para que la economia no desplace el marcador:

- Parte superior: barra economica con monedas totales (`690 892`), gemas (`1 240`) y ganancia de la run (`+320`). Monedas y gemas son botones con `+`. Pausa queda a la derecha como unico control persistente.
- Zona tactica, cerca del tablero: carga/frenesi a la izquierda y puntuacion centrada como dato heroe, siempre con separadores por espacios (`1 284 560`), mejor puntuacion debajo (`Mejor 2 450 000`) y multiplicador al lado. Va entre el panel de Supervivencia y la barra de ocupacion/peligro.

Regla: la puntuacion no debe moverse por la wallet ni por pausa, y debe quedar cerca del foco visual de partida: tablero, peligro y oleada. Si el numero crece, reduce fuente dentro de limites y mantiene `font-variant-numeric: tabular-nums`. Los botones de moneda/gema deben tener hit area tactil clara y el `+` debe comunicar compra con un trazo fino, elegante y secundario, sin convertirse en el protagonista del pill.

Interaccion esperada:

- Tap/click en monedas: abre compra de monedas o la tienda filtrada a monedas.
- Tap/click en gemas: abre compra de gemas o la tienda filtrada a gemas.
- Si la compra se abre durante una run, debe pausar la partida o usar modal seguro para evitar perdidas accidentales.
- Tap/click en pausa: abre modal de pausa con acciones secundarias (`Continuar`, `Reiniciar`, `Salir`, `Ajustes`). El HUD solo conserva pausa para liberar espacio y evitar salidas accidentales.

### 2. Dock fijo de sucesos

Debajo de la cabecera, crear un carril estable para sucesos:

- Un evento principal visible, con icono, color semantico y texto corto.
- Un contador pequeño si hay repeticion (`x5`) o cola.
- Altura reservada para que no invada oleada, vidas ni tablero.
- Eventos de partida (`Toasts.event`) van aqui; chatter menor puede seguir fusionandose, pero siempre dentro del dock.

Ejemplos:

- `Combo x10 · +500`
- `Error · +3 iconos · mas rapido`
- `Oleada 7 superada · +320 monedas`
- `Jefe inminente`

### 3. Panel de Supervivencia

Reemplazar la barra plana por una tarjeta compacta de 2 niveles:

- Izquierda: vidas con estado critico claro.
- Centro: oleada + tier + progreso a siguiente oleada.
- Derecha: tiempo sobrevivido.
- Subfila: mejor oleada y proximo evento relevante (`Jefe en 1 oleada`, `Nuevo pool`, `Record vivo`).

El usuario debe poder escanear: "tengo 3 vidas, voy por oleada 7, faltan 72% de la oleada, llevo 148s".

### 4. Estado activo de run

Una fila compacta integrada dentro del panel de Supervivencia, bajo vidas/oleada/tiempo:

- Mutador semanal.
- Bendiciones con duracion o efecto persistente.
- Frenesi/boost relevante si esta activo.

No debe competir con sucesos. Es informacion pasiva, no notificacion. Tampoco debe ocupar el tablero: el tablero queda limpio para el juego.

### 5. Peligro pegado al tablero

Mantener la barra de ocupacion cerca del tablero, pero hacerla mas informativa:

- Label dinamica: `Tablero` / `Peligro`.
- Porcentaje visible (`72%`).
- Thresholds visuales:
  - 0-64: cian/verde.
  - 65-84: ambar.
  - 85-100: rojo.
- Altura maxima pequena; no mover tablero.

### 6. Tablero

- El tablero debe permanecer anclado y estable. El HUD no debe hacerlo saltar cuando aparecen eventos.
- El tablero queda limpio para el juego: sin chips de combo, objetos, pista ni estados encima.

### 7. Bandeja de objetos

La zona bajo el tablero debe sentirse como una barra de herramientas usable, no como botones sueltos:

- Contenedor unico (`toolbelt`) con borde, fondo y padding propio.
- Objetos en grid estable, con objetivos tactiles grandes y espaciado constante.
- Iconos especificos del set visual del juego (`bomb`, `snowflake`, `lightning`, `brush`, `double`, `search`) en lugar de emojis genericos.
- Nombre corto bajo cada icono: `Bomba`, `Hielo`, `Rayo`, `Barrido`, `Doble`, `Pista`.
- Stock dentro del boton, en badge interno (`1`, `3`, `4`), nunca sobresaliendo fuera del contenedor.
- Estado usable/listo con borde cian o brillo discreto.
- Estado recien ganado con etiqueta `+1` dentro del boton y glow dorado temporal.
- Pista integrada como un objeto mas para evitar solapes con el ultimo booster.

## Numeros y separadores

Crear helpers unicos para que la lectura sea consistente:

```js
const fmtGrouped = (n) => new Intl.NumberFormat('es-ES').format(Math.floor(+n || 0)).replace(/\./g, ' ');
const fmtEconomy = (n) => fmtGrouped(n);
```

Aplicar a:

- `#hud-score`
- `#hud-best`
- monedas del HUD
- gemas del HUD
- recompensas de oleada
- popups de puntuacion si superan 999
- resumen final
- leaderboard y perfil cuando toque

Importante: el loop de count-up debe escribir `fmtNum(State.displayScore)`, no el numero crudo.

## Plan de implementacion

1. Reorganizar DOM en `index.html`

- Añadir `#hud-coins`, `#hud-gems`, `#hud-run-coins` y `#surv-event-dock`.
- Convertir monedas/gemas en botones con `+` y handlers hacia compra/tienda contextual.
- Sustituir los tres botones permanentes por `#btn-pause`; mover reinicio/salida al modal de pausa con confirmacion.
- Convertir `#surv-bar` en estructura de panel: vidas, oleada/progreso, tiempo y subfila.
- Reemplazar la barra actual de boosters y el FAB de pista por `#toolbelt`: grid de objetos + pista integrada.
- Mover el anillo de carga/frenesi junto a la puntuacion, a la izquierda del marcador.
- Añadir `#occ-percent` dentro de `.occ`.

2. CSS del nuevo layout

- Definir alturas fijas para cabecera, dock de eventos, panel de supervivencia, puntuacion, peligro y toolbelt.
- Usar grid/flex con `min-width: 0`, `white-space: nowrap` solo donde sea seguro y `overflow-wrap` en eventos.
- Ajustar paddings a escala de 4/6/8/10/12 px.
- Revisar `@media (max-width: 380px)` con numeros largos.

3. Render y datos

- Añadir `fmtNum`.
- Actualizar `Render.hud()` y el count-up del loop.
- Exponer monedas totales (`Meta.coins()` o fuente actual) y `Survival.runCoins`.
- Actualizar `Survival.render()` para poblar mejor oleada, proximo jefe/hito y estado activo.
- Actualizar `Boosters.buildBar()` para renderizar stock, estado listo y estado recien ganado sin badges externos.
- Redirigir eventos importantes de `Toasts.event()` al dock fijo en modo Supervivencia.

4. Accesibilidad y feedback

- Mantener `aria-live="polite"` en el dock.
- Anunciar hitos importantes via `announce()`.
- Botones tactiles minimo 42 px.
- Objetos tactiles minimo 52 px de alto, con label y stock accesibles en `aria-label`.
- En `reduced-fx`, conservar color/jerarquia sin depender de animaciones.

5. QA

- Capturas a 360x780, 390x844, 430x932 y desktop estrecho.
- Casos con puntuacion `9.999`, `999.999`, `12.345.678`, `1.234.567.890`.
- Eventos encadenados: error + combo + cambio de oleada + recompensa.
- Ultima vida, peligro rojo y jefe inminente simultaneos.
- Verificar que tablero, toolbelt y pista no cambian de posicion por el texto.
- Verificar estados de objeto: stock 0, stock alto, usable, recien ganado `+1`, armado/listo.

## Criterios de aceptacion

- Ningun evento se solapa con vidas, oleada, tiempo, peligro ni tablero.
- La puntuacion y monedas siempre usan separadores claros.
- El jugador ve monedas disponibles durante toda la partida.
- El estado de partida se entiende en menos de un segundo: vidas, oleada, tiempo, peligro y efectos activos.
- Los objetos bajo el tablero se entienden como acciones usables, muestran stock sin solaparse y comunican cuando se gana uno nuevo.
- En pantalla pequena, ningun texto queda cortado de forma incoherente ni empuja controles fuera de la vista.
- La pantalla se siente mas cuidada: paddings consistentes, chips alineados, controles estables y marcadores con jerarquia visual.
