# README — Ruta de implementación del reequilibrio económico

Fecha: 2026-07-20 · Baseline analizado: Convergence 2.9.3

> **Objetivo:** transformar la economía actual en un sistema sostenible a largo plazo, donde jugar siempre produzca progreso, pero monedas, gemas, tickets y cofres no se acumulen más rápido de lo que el jugador encuentra decisiones atractivas para gastarlos.
>
> **Fuera de alcance en este plan:** abandonar `localStorage`, cuentas online, ledger de servidor, validación de recibos, sincronización cloud, anticheat y pasarela de pago real. Todo eso pertenece a la fase final de infraestructura del juego. Esta ruta mantiene la arquitectura local actual y se centra exclusivamente en diseño económico, balance, UX y pruebas.

---

## 1. Resultado esperado

Al terminar este plan, la economía debe cumplir simultáneamente estas condiciones:

1. Una sesión de 10 minutos entrega progreso visible, pero no permite completar el catálogo en horas.
2. Ningún modo repetible permite farmear gemas premium sin un límite diario razonable.
3. Las monedas conservan utilidad después de completar los cosméticos iniciales.
4. Los tickets tienen al menos tres usos voluntarios y repetibles.
5. Los cofres ganados por un jugador activo no generan una reserva que crece indefinidamente.
6. Toda oferta de pago tiene mejor valor absoluto al subir de precio y ninguna queda dominada por otra más barata.
7. Los iconos y bordes espectaculares pueden obtenerse en cofres o comprarse directamente, pero su rareza y precio coinciden con el cofre que los entrega.
8. Los premios escalan con la progresión sin que sus sumideros pierdan relevancia.
9. El balance se verifica a 30, 90 y 180 días mediante simulaciones deterministas.
10. Cada cambio numérico queda documentado y protegido por tests.

---

## 2. Baseline que debe conservarse antes de tocar números

La auditoría de 2.9.3 deja los siguientes valores de referencia:

| Indicador | Estado actual |
|---|---:|
| Catálogo de iconos comprables | 7.550 monedas |
| Catálogo de bordes comprables | 8.930 monedas |
| Catálogo de temas comprables | 1.100 monedas |
| Catálogo de tableros comprables | 15.500 monedas |
| Catálogo comprable total | **33.080 monedas** |
| Gemas del primer Reto diario | 5/día |
| Choice Chest nivel 1, opción gemas | 8 gemas de media |
| Choice Chest nivel 31, opción gemas | 20 gemas de media |
| Supervivencia hasta oleada 18 | 8 gemas/run |
| Supervivencia media, 8 min | ~3.718 monedas/run |
| Supervivencia hábil, 8 min | ~6.789 monedas/run |
| Supervivencia difícil hábil, 8 min | ~16.055 monedas/run |
| Pipeline completo, nivel 1 | 8.103 monedas + 112 gemas/32 cofres |
| Pipeline completo, nivel 31 | 20.267 monedas + 286 gemas/32 cofres |
| Tiempo total del ciclo de 32 cofres | 252 horas |

Estos valores no son objetivos: son la batería **antes** contra la que se comparará cada fase.

### 2.1 Causas raíz que el plan debe corregir

- `Meta.recordGame()` convierte score en monedas mediante `score / 40`, sin rendimiento decreciente.
- Supervivencia entrega gemas en oleadas 5, 15, 25, 35... sin límite de run o día.
- Monedas y gemas de cofres escalan hasta ×2,5, mientras los precios permanecen fijos.
- El catálogo de 33.080 monedas es finito y los mismos objetos pueden caer gratis en cofres.
- Al agotarse el pool cosmético, el fallback aumenta las monedas justo cuando desaparece el principal sumidero.
- La cuarta ranura cuesta 150 gemas, pero no aumenta el número de temporizadores activos.
- El único uso de tickets es el reroll de misión diaria.
- El cofre premium de 25 gemas domina varias ofertas de monedas y cofres.

---

## 3. Objetivos cuantitativos iniciales

Son objetivos de calibración, no constantes definitivas. Solo se consolidan cuando las simulaciones y el playtest los validen.

### 3.1 Monedas

| Segmento | Objetivo por 10 min |
|---|---:|
| Casual | 250–450 monedas |
| Medio | 400–650 monedas |
| Hábil | 600–900 monedas |
| Difícil hábil | máximo 1.200 monedas |

- Tiempo objetivo para comprar todo el catálogo inicial: **30–45 días activos** con 1–2 sesiones diarias.
- Un loadout completo debe representar entre 20% y 45% del ingreso esperado de la partida donde se utiliza.
- Usar tres revives debe ser una decisión costosa: 50%–90% de la recompensa esperada de una run media, nunca menos del 20%.
- Ningún modo debe generar más del doble de monedas por minuto que otro con habilidad y duración comparables, salvo bonificación de dificultad explícita.

### 3.2 Gemas

- Ritual diario sin Supervivencia: objetivo de **10–14 gemas eventuales/día**.
- Jugador muy activo incluyendo Supervivencia: objetivo de **16–20 gemas/día**.
- Gemas repetibles de Supervivencia: máximo recomendado de **6 al día**.
- Ninguna actividad ilimitada puede superar 15 gemas/hora líquidas.
- Las gemas procedentes de cofres no deben escalar ×2,5 con el nivel.

### 3.3 Tickets

- Jugador medio: 4–8 tickets ganados por semana.
- Ratio semanal objetivo `tickets ganados / tickets gastados`: 0,9–1,2 para jugadores que usan sistemas opcionales.
- Deben existir usos de 1, 2 y 3 tickets para decisiones de distinto valor.

### 3.4 Cofres

- Jugador activo medio: 12–18 horas de desbloqueo generadas al día.
- Jugador intensivo de una hora diaria: máximo 24 horas de desbloqueo generadas al día.
- La mediana de la reserva no debe crecer durante 14 días consecutivos.
- Acelerar debe ser útil, pero nunca obligatorio para evitar una cola infinita.

---

## 4. Orden obligatorio de implementación

No se deben cambiar fuentes, sumideros, precios y recompensas de cofres a la vez. El orden correcto permite atribuir cualquier desviación a una causa concreta:

1. Medición y configuración centralizada.
2. Reducción de fuentes inflacionarias de monedas.
3. Reducción de fuentes inflacionarias de gemas.
4. Corrección del contenido de cofres y cosméticos.
5. Creación de sumideros recurrentes.
6. Reprecio de tienda y ofertas.
7. Corrección de throughput de cofres y cuarta ranura.
8. Simulación longitudinal y tuning final.
9. Pulido de UX, documentación y release.

Cada fase debe entrar en una versión separada o, como mínimo, en un commit aislado con batería antes/después.

---

# Fase ECO-0 — Congelar baseline y crear el laboratorio económico

## Objetivo

Poder medir la economía completa sin depender de impresiones subjetivas ni del saldo acumulado durante pruebas manuales.

## Tareas

### ECO-01 · Centralizar configuración

Crear un objeto `EconomyConfig` en `game.js` y mover allí, sin cambiar comportamiento:

- Fórmula de liquidación de monedas.
- Precios de boosters y revives.
- Recompensas diaria/semanal.
- Límites y recompensas de Supervivencia.
- Escalado de cofres.
- Precios de cofres, XP y cuarta ranura.
- Parámetros de conversión usados por la tienda.

El objetivo es que ningún número económico importante quede disperso por `Meta`, `Survival`, `Storefront`, `Worlds` o la UI.

### ECO-02 · Ledger de auditoría local

Añadir un módulo `EconomyAudit` orientado a debug y simulación:

```js
EconomyAudit.record({
  currency: 'coins',
  amount: 120,
  direction: 'source',
  reason: 'survival-wave',
  mode: 'supervivencia',
});
```

Debe registrar como mínimo:

- Recurso.
- Cantidad.
- Fuente o sumidero.
- Motivo estable.
- Modo.
- Nivel meta.
- Identificador de sesión.

En producción local puede mantenerse desactivado; el simulador y `?dev` lo activan. No requiere servidor.

### ECO-03 · Simulación de sesiones con gasto

Extender `tools/balance-sim.js` con políticas de usuario:

- `saver`: nunca gasta salvo desbloqueos permanentes.
- `strategic`: compra boosters en niveles difíciles y revive una vez.
- `spender`: usa loadout completo, revives y aceleración ocasional.
- `collector`: prioriza cosméticos y ofertas directas.

La simulación debe medir saldo inicial, minted, burned, saldo final, objetos comprados, cofres ganados, horas de cola y reservas.

## Archivos previstos

- `game.js`
- `tools/balance-sim.js`
- `tests/economy-audit.test.js`
- `tests/economy-forecast.test.js`
- `docs/BALANCE_BASELINE.md`
- `docs/MIGRATION_SPEC.md`

## Puerta de aceptación

- Cero cambios en recompensas reales.
- La batería de gameplay permanece dentro del baseline previo.
- Todas las mutaciones de monedas, gemas y tickets usadas por gameplay aparecen en el ledger.
- Una misma seed produce un informe económico idéntico.

---

# Fase ECO-1 — Reequilibrar las monedas generadas jugando

## Objetivo

Eliminar la relación lineal entre score extremo y monedas sin castigar el progreso del jugador casual.

## Tareas

### ECO-10 · Sustituir `score / 40`

Crear una única función:

```js
Economy.settlementCoins(context)
```

Debe considerar:

- Duración activa.
- Objetivo completado.
- Dificultad.
- Score con rendimiento decreciente.
- Combo como bonus pequeño, no como segundo motor principal.
- Bonificaciones de misión/semanal por separado.

Fórmula candidata para empezar la simulación:

```text
baseModo
+ minutosActivos × 25
+ 8 × sqrt(score / 100)
+ min(combo, 30)
+ bonusObjetivo
```

No se debe consolidar esta fórmula sin comparar los cinco modos. Lo obligatorio es el rendimiento decreciente y los objetivos de monedas/10 min de §3.1.

### ECO-11 · Recalibrar Clásico por nivel

Clásico ya tiene una recompensa propia y no debe recibir la fórmula general duplicada.

Punto de partida recomendado:

```text
35
+ estrellas × 10
+ min(80, score / 150)
+ bonusRacha
```

- Reducir el tope de la racha económica de +50% a +25% si la simulación supera el objetivo.
- Medir monedas por nivel, por mundo y por diez minutos.
- Mantener `awardBaseCoins: false` en la liquidación global.

### ECO-12 · Separar score de premios secundarios

Las monedas de oleada, jefe, suministro y tablero vacío deben seguir visibles, pero contar dentro del presupuesto total del modo. La liquidación final de Supervivencia debe restar o tener en cuenta lo ya pagado durante la run para evitar doble pago.

Implementación recomendada:

```text
presupuestoTotalRun - monedasYaPagadasDuranteRun = liquidaciónFinal
```

La liquidación nunca puede ser negativa.

## Puerta de aceptación

- Casual: 250–450 monedas/10 min.
- Medio: 400–650 monedas/10 min.
- Hábil: 600–900 monedas/10 min.
- Difícil hábil: ≤1.200 monedas/10 min.
- Ningún perfil compra el catálogo de 33.080 monedas en menos de 20 días activos simulados.
- Misiones y login permanecen fuera de estos rangos para poder medirse aparte.

---

# Fase ECO-2 — Controlar gemas y tickets

## Objetivo

Conservar la sensación de generosidad diaria eliminando el farming premium infinito.

## Tareas

### ECO-20 · Límite diario de gemas en Supervivencia

Añadir estado diario retrocompatible:

```js
economyDaily: {
  date: 'YYYY-MM-DD',
  survivalGems: 0,
  survivalChestTiers: {},
}
```

Regla recomendada:

- Oleada 5: +1 gema.
- Oleada 15: +1 gema.
- Hitos posteriores: tickets, suministro, fragmentos o progreso de cofre.
- Tope global: 6 gemas de Supervivencia por día.
- Tras alcanzar el tope, el hito nunca queda vacío: cambia a una recompensa no premium.

### ECO-21 · Separar escalado de monedas y gemas de cofres

Sustituir `chestLevelScale()` por:

```js
chestCoinScale(level)
chestGemScale(level)
```

Recomendación inicial:

- Monedas: escalan hasta ×2,0.
- Gemas: ×1,0 constante o máximo ×1,15.
- Tickets: no escalan.
- Cosméticos: escalan por rareza, no por cantidad.

### ECO-22 · Recalibrar Choice Chest

La opción de gemas no debe pasar de 8 a 20 solo por nivel.

Rangos recomendados:

- Bronce: 4–8 gemas.
- Plata catch-up: 6–10 gemas.
- Sin escalado por nivel.

La elección de monedas sí puede escalar moderadamente.

### ECO-23 · Ampliar utilidad de tickets

Implementar en este orden:

1. Reroll de misión diaria: 1 ticket, comportamiento actual.
2. Sustituir una opción del Choice Chest: 1 ticket.
3. Regenerar las tres opciones del Choice Chest: 2 tickets, máximo una vez por cofre.
4. Intento bonus de reto/evento: 2–3 tickets, sin bloquear el intento gratuito.

Los tickets deben dar agencia, no convertirse en una llave obligatoria para jugar.

## Puerta de aceptación

- Un jugador intensivo no supera 20 gemas/día de media a 30 días.
- Supervivencia no supera 15 gemas líquidas/hora.
- El nivel 31 no produce más del 25% de gemas que el nivel 1 para la misma actividad.
- Los tickets presentan ratio semanal ganado/gastado de 0,9–1,2 bajo política `strategic`.

---

# Fase ECO-3 — Rehacer el valor de cofres y cosméticos

## Objetivo

Hacer que cada cofre tenga una identidad económica clara y que los iconos/bordes mantengan valor de colección y venta.

## Tareas

### ECO-30 · Añadir rareza económica a cosméticos

Extender iconos, bordes, temas y tableros con:

```js
{
  rarity: 'common' | 'rare' | 'epic' | 'legendary' | 'mythic',
  coinCost: 900,
  gemCost: 120,
  chestMinTier: 'magic',
}
```

Distribución recomendada:

- Madera/Bronce: comunes.
- Plata/Oro: comunes y raros.
- Mágico/Real: raros, épicos y legendarios.
- Supremo/Campeón/Divino: épicos, legendarios y míticos.

Un cofre Divino no debe entregar como premio principal un objeto barato de tier bajo.

### ECO-31 · Mantener doble vía: cofre o compra directa

- Todos los iconos y bordes monetizables pueden caer en cofres compatibles.
- La tienda directa vende certeza: el jugador elige exactamente qué compra.
- El cofre vende sorpresa y mejor valor agregado, no selección exacta.
- Los objetos míticos pueden tener precio directo en gemas y seguir disponibles en cofres altos.
- La tienda debe mostrar `También disponible en: Cofre Mágico+`.

### ECO-32 · Sustituir fallback inflacionario

Eliminar el jackpot automático de monedas cuando no quedan cosméticos elegibles.

Crear `fragmentos de estilo`, visibles únicamente en Colecciones:

- Se obtienen cuando una tirada cosmética no puede entregar un objeto nuevo.
- Se gastan en una tienda rotatoria de variantes, recolores, auras o acabados del icono/borde.
- No aparecen en la barra superior para evitar una quinta divisa protagonista.
- Los precios rotatorios garantizan un sumidero permanente.

Si se decide no añadir fragmentos, el fallback alternativo debe ser un `boosterChoice` consumible, nunca monedas o gemas escaladas.

### ECO-33 · Recalcular EV de todos los cofres

Para cada cofre, calcular:

```text
EV equivalente = monedas
+ gemas × ratioMonedaGema
+ tickets × valorTicket
+ boosters × costeMedioBooster
+ probCosmético × valorCosméticoDelTier
+ fragmentos × valorFragmento
```

El valor absoluto debe subir con cada tier. El valor por gema puede mejorar ligeramente en bundles grandes, pero nunca empeorar de forma extrema.

## Puerta de aceptación

- EV absoluto estrictamente creciente de Madera a Divino.
- Ningún cofre de tier alto tiene como cosmético principal un objeto de tier bajo.
- Completar la colección no aumenta monedas o gemas por cofre.
- Una tirada cosmética siempre entrega objeto nuevo o progreso de estilo útil.
- Tests deterministas con pool completo, parcial y agotado.

---

# Fase ECO-4 — Construir sumideros recurrentes

## Objetivo

Dar valor permanente a monedas, gemas y tickets sin usar pérdida de saldo, caducidad artificial ni castigos por ausencia.

## Tareas

### ECO-40 · Tienda rotatoria de estilo

Añadir una sección diaria/semanal con:

- Variantes de color de iconos poseídos.
- Auras y efectos del marco.
- Acabados animados o partículas.
- Bundles icono + borde compatibles.
- Oferta comprable con monedas, gemas o fragmentos según rareza.

La rotación debe ser determinista por fecha mientras no exista servidor. No debe usar falsos contadores de escasez.

### ECO-41 · Ajustar boosters después de corregir faucets

No subir precios antes de completar ECO-1. Después:

- Calcular coste como porcentaje del ingreso esperado del modo.
- Clásico: loadout máximo objetivo 25%–45% del premio esperado del nivel.
- Supervivencia: loadout máximo objetivo 20%–35% del premio esperado de la run media.
- Difícil puede aplicar un multiplicador de coste solo si también comunica una recompensa económica superior.
- El stock ganado en cofres conserva prioridad y evita el pago.

### ECO-42 · Revisar revives

Mantener la curva 120/240/480 como estructura, pero recalibrar la base después de ECO-1.

Puerta específica:

- Primer revive: accesible.
- Tres revives: 50%–90% de la recompensa media de la run.
- Tres revives nunca deben autofinanciarse solo por prolongar la partida.

### ECO-43 · Venta directa de iconos y bordes premium

Crear tres bandas provisionales:

| Rareza | Precio directo sugerido |
|---|---:|
| Raro | 60–90 gemas |
| Épico/legendario | 120–180 gemas |
| Mítico | 220–320 gemas |

La compra directa entrega el asset exacto. El cofre mantiene una ruta alternativa, más lenta y aleatoria.

## Puerta de aceptación

- La política `strategic` gasta al menos 45% de las monedas obtenidas semanalmente sin sentirse obligada.
- Tras completar el catálogo base siguen existiendo tres sumideros útiles de monedas.
- Existe al menos un sumidero repetible y atractivo para cada divisa.
- Ningún sistema elimina saldo por inactividad.

---

# Fase ECO-5 — Reprecio coherente de tienda

## Objetivo

Definir una unidad de valor y eliminar arbitrajes u ofertas dominadas.

## Tareas

### ECO-50 · Fijar ratio interno

Punto de partida recomendado:

```text
1 gema = 10 monedas de valor base
```

Este ratio se usa para comparar ofertas y EV, no para permitir conversión directa entre carteras.

### ECO-51 · Corregir packs de monedas

Si se mantienen precios actuales, los importes iniciales recomendados son:

| Oferta | Actual | Propuesta inicial | Mejora real aproximada |
|---|---:|---:|---:|
| 1,09 € | 1.000 | 1.000 | base |
| 3,39 € | 6.000 | 3.600 | +16% |
| 5,99 € | 18.000 | 7.000 | +27% |

La alternativa es conservar 6.000/18.000 y subir sus precios. No se deben conservar simultáneamente cantidades actuales y precios actuales.

Los packs de gemas actuales pueden mantenerse inicialmente porque su eficiencia solo mejora aproximadamente 6%–9%.

### ECO-52 · Rehacer cofre premium

Problema actual: 25 gemas entregan ~410 monedas en nivel 1 y ~1.020 en nivel 31, además de tickets, booster y 8% de cosmético.

Propuesta inicial para simulación:

- Coste: 60 gemas.
- Sin gemas en la tirada bonus.
- Escalado de monedas limitado a ×1,5.
- 8% de cosmético, respetando rareza.
- Apertura instantánea.

Debe compararse contra comprar monedas y contra cofres Mágico/Real. Ninguna de las tres vías puede dominar por completo a las demás.

### ECO-53 · Recalcular cofres vendidos

No fijar los nuevos precios definitivos antes de ECO-3. Después:

- Precio derivado de EV equivalente.
- Mejora de valor/gema moderada al subir de tier.
- Coste de aceleración mostrado como coste adicional potencial.
- La UI debe separar `Comprar cofre` de `Abrir ahora`.

### ECO-54 · Revisar XP boosters

El XP pierde valor económico cuando el escalado de cofres alcanza su tope. Hasta que exista una progresión duradera:

- Ocultar o marcar los boosters como `progresión`, no como inversión económica.
- No prometer más recompensas si el nivel ya no mejora cofres.
- Revisar 25/80/160 gemas cuando se defina el recorrido completo de niveles.

## Puerta de aceptación

- Ningún pack mejora más de 35% su eficiencia respecto al pack base.
- Ninguna oferta es estrictamente peor que otra en coste, tiempo y EV.
- Comprar gemas para abrir cofres premium no supera claramente comprar monedas directas.
- Tests automáticos de dominancia para todas las ofertas.

---

# Fase ECO-6 — Controlar cola de cofres y dar valor a la cuarta ranura

## Objetivo

Evitar reservas infinitas y convertir las 150 gemas de la cuarta ranura en una mejora real.

## Tareas

### ECO-60 · Limitar cofres directos repetibles de Supervivencia

Mantener la escalera 10/20/30..., pero cada tier solo entrega un cofre directo una vez al día:

- Primera oleada 10 del día: Madera.
- Primera oleada 20: Bronce.
- Primera oleada 30: Plata.
- Etcétera.
- Repetir el hito durante el mismo día entrega progreso de pipeline, tickets o fragmentos.

El pipeline universal permanece repetible y medible.

Con esta regla, una hora de Supervivencia deja de generar más de 40 horas de cola.

### ECO-61 · Reconvertir la cuarta ranura

Recomendación más segura:

- Mantener un solo temporizador activo.
- La cuarta ranura desbloquea una mejora permanente de 15% a la velocidad de cola.
- Comunicarlo antes de comprar: `4ª ranura + cola 15% más rápida`.
- Recalcular el coste de 150 gemas con simulación de 90 días.

Alternativa de mayor riesgo: permitir dos temporizadores concurrentes. Solo debe implementarse si ECO-3 demuestra que duplicar throughput no reactiva la inflación.

### ECO-62 · Métricas visibles de cola

Mostrar:

- Horas totales pendientes.
- Cofre siguiente.
- Beneficio de la cuarta ranura.
- Cuánto tiempo ahorra acelerar.

No se debe ocultar una cola de varios días detrás de un simple `+N en reserva`.

## Puerta de aceptación

- Una hora diaria de Supervivencia genera ≤24 horas de desbloqueo.
- Reserva P50 estable a 14 días.
- La cuarta ranura reduce de forma comprobable el tiempo de vaciado.
- El jugador sin gemas puede procesar su flujo medio sin perder cofres.

---

# Fase ECO-7 — Forecast de 30/90/180 días

## Objetivo

Demostrar que la economía no solo está equilibrada por partida, sino también durante meses.

## Perfiles mínimos

| Perfil | Actividad |
|---|---|
| Casual | 1 sesión de 8 min, 4 días/semana |
| Medio | 2 sesiones de 10 min, 6 días/semana |
| Hábil | 30 min/día |
| Intensivo | 60 min/día |
| Coleccionista | Prioriza tienda y cosméticos |
| No gastador | Acumula todo salvo desbloqueos permanentes |

Cada perfil se cruza con las políticas `saver`, `strategic`, `spender` y `collector`.

## Salida requerida

Para día 30, 90 y 180:

- Monedas ganadas, gastadas y saldo.
- Gemas ganadas, gastadas y saldo.
- Tickets ganados, gastados y saldo.
- Boosters ganados, usados y stock.
- Cosméticos poseídos por rareza.
- Días hasta completar catálogo base.
- Cofres ganados, abiertos y acelerados.
- Horas de cola y tamaño de reserva.
- Compras disponibles pero nunca elegidas.
- Ofertas dominadas detectadas.

## Guardarraíles de CI

Crear tests que fallen si:

- El jugador medio completa el catálogo antes de 25 días.
- El jugador intensivo supera 20 gemas/día de media.
- El saldo P90 de monedas crece más de 20% mensual después del día 90 sin contenido comprable pendiente.
- Los tickets crecen durante ocho semanas bajo política `strategic`.
- La reserva P50 crece durante 14 días.
- Una oferta de menor precio domina otra superior.
- El fallback de colección completa produce más monedas/gemas que el cofre con pool disponible.

## Documentación

Crear `docs/ECONOMY_BASELINE.md` con:

- Versión.
- Seed.
- Número de simulaciones.
- Tabla de resultados.
- Decisiones aceptadas.
- Desviaciones conocidas.

---

# Fase ECO-8 — UX, migración local y cierre

## Objetivo

Hacer que los cambios se entiendan y cerrar la transición sin romper partidas guardadas.

## Tareas

### ECO-80 · Transparencia en UI

- Explicar por qué se gana cada premio.
- Mostrar límites diarios sin mensajes punitivos.
- Al alcanzar un límite, enseñar la recompensa sustituta.
- Mostrar rareza y cofre mínimo de iconos/bordes.
- Mostrar valor de la cuarta ranura antes de pagar.
- Mostrar claramente cuándo una compra es directa y cuándo es aleatoria.

### ECO-81 · Compatibilidad local

Aunque el backend quede fuera de alcance, los campos nuevos deben migrarse de forma retrocompatible:

- Perfiles existentes conservan saldos y propiedad.
- No retirar cosméticos ya obtenidos.
- No reducir saldos guardados.
- Inicializar límites diarios sin castigar el día de actualización.
- Si cambia un precio, no reclamar diferencias de compras anteriores.

### ECO-82 · Actualizar fuentes de verdad

- `docs/MIGRATION_SPEC.md`: fórmulas y constantes definitivas.
- `docs/BALANCE_BASELINE.md`: batería por partida.
- `docs/ECONOMY_BASELINE.md`: forecast longitudinal.
- `docs/CHEST_SYSTEM_MASTER_PLAN.md`: EV y fallbacks nuevos.
- `docs/GAME_MODES_MASTER_PLAN.md`: pagos específicos por modo.
- `DOCUMENTATION_INDEX.md`: enlaces públicos.

### ECO-83 · Release

- Ejecutar suite completa.
- Ejecutar simulación de gameplay antes/después.
- Ejecutar forecast 30/90/180.
- Playtest manual de compra, falta de saldo, límites diarios y pool cosmético agotado.
- Bump coordinado de `game.js`, `sw.js` e `index.html` si cambia código de runtime.

## Puerta final

- Todas las puertas ECO-0...ECO-7 verdes.
- Sin regresiones de gameplay o UI.
- Ninguna divisa principal carece de uso recurrente.
- Ningún perfil simulado acumula gemas, monedas, tickets o cofres sin control durante 180 días.

---

## 5. Mapa de dependencias

```text
ECO-0 Medición/configuración
  └─ ECO-1 Monedas
      └─ ECO-2 Gemas/tickets
          └─ ECO-3 Cofres/cosméticos
              ├─ ECO-4 Sumideros
              ├─ ECO-5 Tienda
              └─ ECO-6 Cola de cofres
                  └─ ECO-7 Forecast 180 días
                      └─ ECO-8 UX y release
```

ECO-4, ECO-5 y ECO-6 pueden desarrollarse en paralelo después de estabilizar ECO-3, pero deben integrarse de una en una para medir su impacto.

---

## 6. Orden recomendado de commits

1. `Add economy audit and baseline forecast`
2. `Centralize economy configuration without balance changes`
3. `Rebalance score-based coin settlement`
4. `Cap repeatable Survival gem rewards`
5. `Split chest coin and gem scaling`
6. `Add cosmetic rarity and tiered chest pools`
7. `Replace exhausted cosmetic fallbacks`
8. `Add recurring currency sinks`
9. `Rebalance currency packs and premium chest`
10. `Cap repeatable Survival chest drops`
11. `Give fourth chest slot permanent queue value`
12. `Add 30/90/180-day economy guardrails`
13. `Update economy UX and documentation`

No mezclar en un mismo commit la nueva fórmula de ingresos con un repricing masivo: impediría saber qué cambio corrigió o rompió el balance.

---

## 7. Checklist de cierre por tarea

Cada tarea `ECO-*` se considera terminada solo si cumple:

- [ ] Fórmula y motivo documentados.
- [ ] Test unitario del caso normal.
- [ ] Test de saldo insuficiente o límite alcanzado.
- [ ] Test de perfil nuevo y perfil migrado.
- [ ] Simulación antes/después con seed fija.
- [ ] No aparece una oferta dominada nueva.
- [ ] UI ES/EN actualizada si cambia texto visible.
- [ ] Accesibilidad y reduced-motion revisados si cambia una ceremonia.
- [ ] Fuentes de verdad actualizadas.
- [ ] Versionado/cache actualizado si cambia runtime.

---

## 8. Decisiones de producto que deben aprobarse durante la ejecución

El plan recomienda una opción, pero estas decisiones necesitan validación visual y de playtest:

| Decisión | Recomendación |
|---|---|
| Tiempo para completar catálogo base | 30–45 días activos |
| Gemas gratuitas máximas | 16–20/día en jugador intensivo |
| Fallback cosmético | Fragmentos de estilo |
| Cuarta ranura | +15% velocidad permanente |
| Ratio de referencia | 1 gema = 10 monedas |
| Pack mediano/grande de monedas | 3.600 / 7.000 con precios actuales |
| Cofre premium | 60 gemas, sin refund de gemas |
| Cosméticos premium | Compra directa con gemas + drop en tier compatible |

Cambiar cualquiera de estas decisiones exige recalcular el forecast; no debe resolverse solo modificando una constante de tienda.

---

## 9. Definición de éxito

La economía estará lista para pasar posteriormente a infraestructura de servidor cuando:

- El jugador casual siempre pueda progresar sin pagar.
- El jugador activo tenga decisiones de gasto semanales significativas.
- El coleccionista pueda comprar directamente el asset que desea.
- Los cofres mantengan emoción sin devaluar la tienda.
- Monedas, gemas y tickets tengan velocidad de circulación estable.
- La reserva de cofres sea procesable.
- Los forecasts de 30, 90 y 180 días permanezcan dentro de los guardarraíles.
- Los precios estén ligados a una unidad de valor consistente.

Solo después de cerrar esta ruta tendrá sentido trasladar el ledger local a cuentas y servidores: primero debe existir una economía equilibrada que merezca ser protegida.
