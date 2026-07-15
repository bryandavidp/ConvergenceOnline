# Rediseño de Inicio con iconografía V2

## Objetivo

Convertir `screen-start` en una home llamativa, comprensible en menos de tres
segundos y usable con una mano, sin alterar el lenguaje visual existente de
Convergence. El CTA `JUGAR` debe permanecer en la zona inferior del pulgar y la
pantalla debe exponer el estado útil que hoy permanece oculto en modales.

## Principios no negociables

- Conservar los tokens, tipografía, paneles y navegación del design system.
- Usar PNG reales del paquete `assets_nuevos/listo_para_integrar_v2` en las
  tarjetas; no recrear ni recolorear sus ilustraciones.
- Mantener un solo CTA primario: `JUGAR`, inmediatamente sobre la navegación.
- Comunicar estados con icono + texto; nunca solo mediante color.
- Objetivos táctiles de 44 px como mínimo y CTA primario de 52 px o más.
- Mantener compatibilidad ES/EN, texto grande, movimiento reducido y PWA offline.

## Arquitectura de información

1. Perfil, nivel, XP y economía.
2. Recompensa diaria (se compacta al reclamarla).
3. Contexto: partida recuperable o mejor puntuación.
4. Accesos directos: Reto del día, Clásico y Supervivencia.
5. Panel `HOY`: misión diaria, reto semanal, cofres y racha.
6. CTA inferior `JUGAR`.
7. Navegación: Logros, Tienda, Inicio, Misiones y Ajustes.

## Información vital añadida

- Resumen de una partida recuperable mediante `RunSave`.
- Mutador, medalla y mejor marca del Reto del día.
- Mundo, nivel y estrellas actuales de Clásico.
- Mejor oleada y mutador semanal de Supervivencia.
- Progreso de misión diaria y reto semanal.
- Número de cofres listos y racha de juego.
- Día actual de la recompensa diaria.

## Integración de assets

Los originales de 512 px permanecen en `assets_nuevos`. La home consume un
subconjunto canónico copiado a `img/ui-v2/home/`, que se añade al precache del
Service Worker.

| Superficie | Asset |
| --- | --- |
| Reto del día | `target.png` |
| Clásico | `star.png` |
| Supervivencia | `heart.png`, `shield.png` |
| Panel Hoy | `target.png`, `calendar.png`, `chest.png`, `fire.png` |
| Contexto y recursos | `player.png`, `pencil.png`, `coin.png`, `gem.png`, `plus.png`, `gift.png`, `rocket.png`, `trophy.png` |
| Acciones de Inicio | `bolt.png`, `clock.png`, `upgrade.png` |
| Navegación | `medal.png`, `cart.png`, `house.png`, `target.png`, `settings.png` |

## Fases y avance

| Fase | Estado | Alcance |
| --- | --- | --- |
| 1. Auditoría y documentación | Completada | Estado real, restricciones y hallazgos |
| 2. Assets V2 | Completada | Subconjunto de producción + precache |
| 3. Layout | Completada | HTML y CSS responsive |
| 4. Datos y accesibilidad | Completada | Estados dinámicos, i18n y ARIA |
| 5. Validación y release | Completada | Tests, lint, responsive, versión y caché |

## Hallazgos

### H-01 · La base ya separa contenido desplazable y pie anclado

`screen-start` ya usa `.home-scroll` y `.home-foot`. No se necesita `position:
fixed`; mover `JUGAR` al último bloque del pie conserva safe areas y evita
solapamientos con la navegación.

### H-02 · La home ya calcula más información de la que muestra

`refreshStart()` ya conoce el Reto diario, la racha, `RunSave`, el nivel de
Aventura, misiones y economía. El rediseño debe exponer esos datos mediante
helpers pequeños, no crear un segundo estado persistente.

### H-03 · El CTA y los accesos directos tienen roles distintos

`JUGAR` abre el catálogo completo; las tarjetas son atajos. Se conserva esta
regla para evitar que cinco modos compitan simultáneamente en la home.

### H-04 · Supervivencia no genera `RunSave`

El guardado excluye Supervivencia y Contrarreloj. El resumen de partida
recuperable solo debe aparecer para Clásico, Aventura y otros modos admitidos,
sin prometer recuperación donde no existe.

### H-05 · El estado actual del Reto diario ya incluye mutador y racha

La tarjeta existente contiene dos líneas muy pequeñas. La implementación
mantendrá el contenido, pero lo dividirá en una línea de estado legible y un
badge textual accesible.

### H-06 · Los originales V2 necesitaban un derivado de producción

Los PNG originales de 512 px se conservaron intactos en `assets_nuevos` y se
generó el subconjunto `img/ui-v2/home` a 256×256 px con canal alfa. El conjunto
final contiene 22 iconos y pesa 998.029 bytes; queda por debajo de 1 MiB para
reducir el coste de la primera carga y del precache offline.

### H-07 · Misión diaria y Reto del día no son el mismo objetivo

La tarjeta principal abre el tablero diario competitivo (mutador, mejor marca y
medalla). El panel `HOY` muestra la misión diaria de progreso. Se mantienen
separados y con etiquetas distintas para no hacer creer que completar uno
completa automáticamente el otro.

### H-08 · La validación responsive requiere emulación de viewport real

El navegador headless aplica un ancho mínimo a la ventana normal y puede
producir capturas recortadas engañosas. La validación final se hizo con métricas
de dispositivo mediante CDP: `innerWidth` y `scrollWidth` coincidieron en 360,
390 y 430 px. En 360×640 el contenido central conserva scroll propio mientras
`JUGAR` y la navegación permanecen visibles en la zona inferior.

## Matriz de validación

- Viewports: 360×640, 390×844, 430×932 y escritorio ≥720 px.
- Estados: usuario nuevo, recompensa pendiente/reclamada, RunSave presente,
  reto pendiente/bronce/plata/oro, misión completa, semanal completa, 0/1/N
  cofres y racha 0/N.
- Preferencias: ES/EN, texto grande y movimiento reducido.
- Navegación por teclado y foco visible.
- Recarga offline con todos los assets V2 disponibles.

## Registro de avance

### 2026-07-14 · Inicio

- Plan trasladado al repositorio.
- Revisados `index.html`, `styles.css`, `game.js`, `sw.js` y las APIs de `Meta`,
  `RunSave`, `Worlds`, `DailyMut` y `Survival`.
- Confirmado que no se tocarán las carpetas de descargas sin seguimiento que ya
  existían en el árbol de trabajo.

### 2026-07-14 · Implementación

- Reordenada la home: recompensa, contexto recuperable/récord, tres modos
  prioritarios, resumen `HOY`, CTA inferior y navegación.
- Sustituida la iconografía de tarjetas, cabecera y navegación por 22 assets V2
  reales; añadidos al Service Worker.
- Añadidos estados derivados de `Meta`, `RunSave`, `Worlds`, `DailyMut` y
  `Survival`, sin duplicar estado persistente.
- Localizados ES/EN los textos nuevos y los nombres de mundo expuestos en la
  home. El control de compra de monedas ahora es un botón nativo.
- Añadido foco visible de 3 px, objetivos táctiles mínimos, estados por texto +
  color, CTA con animación finita y soporte de movimiento reducido.
- Añadidas cuatro pruebas específicas del rediseño: jerarquía del CTA, contenido
  vital, integridad/peso/precache de assets y contrato i18n/ARIA.
- Validada visualmente la home en 360×640, 390×844 y 430×932 sin overflow
  horizontal.
- Corregido el cálculo del próximo día de recompensa: una ausencia de más de un
  día vuelve a `Día 1`, igual que la lógica real de concesión.

### 2026-07-14 · Cierre

- Versión de app, recursos y caché PWA sincronizada en `2.6.34`.
- Suite completa: 135/135 pruebas superadas.
- ESLint, `node --check` y `git diff --check`: sin errores.
- Subconjunto V2 verificado: 22/22 PNG, 256×256 px y 998.029 bytes en total.

### 2026-07-14 · Auditoría final de iconografía

- Eliminadas de `screen-start` las tres referencias restantes a la familia SVG:
  reproducir, refrescar y descargar.
- `JUGAR`, partida guardada e instalación usan ahora `bolt.png`, `clock.png` y
  `upgrade.png` del mismo pack casual V2 que las tarjetas.
- Añadida una prueba que impide volver a introducir rutas `img/ui/` o
  `img/icons-v2/` dentro de la pantalla de Inicio.
