# Rediseño del sistema de cofres — registro de trabajo

Última actualización: 2026-07-18

## Objetivo

Recrear la pantalla y el sistema de cofres de las referencias adjuntas dentro de Convergence Online, manteniendo la economía existente y añadiendo tipos, ranuras, temporizadores, catálogo, recompensas y aperturas animadas.

## Referencias

- `Foto 1.jpg`: composición de la pantalla principal, cofre seleccionado, acciones de apertura, ranuras y recompensas posibles.
- `Foto 2.jpg`: familia visual y ficha de los diez tipos de cofres.

Las referencias guían la composición, jerarquía, materiales y lenguaje visual; los assets del juego serán originales.

## Invariantes de los assets

1. Cada cofre tendrá un atlas 2×2 con cuatro estados: cerrado, cierre activado, tapa a medio recorrido y abierto.
2. La cámara, escala, posición, proporciones y ornamentos deben ser idénticos en los cuatro estados.
3. **La placa de la cerradura está unida físicamente a la tapa. Al abrirse, rota y sube con la tapa. Nunca debe duplicarse ni quedarse otra placa en la base/frontal.**
4. La base no puede cambiar de geometría entre fotogramas.
5. Fondo cromático uniforme para extracción local; resultado final con alfa validado.
6. Sin texto, etiquetas, monedas, gemas ni objetos adicionales dentro del atlas.

## Tipos previstos

| ID | Nombre | Tamaño | Rareza | Duración base |
| --- | --- | --- | --- | --- |
| `wood` | Cofre de madera | Pequeño | Básico | 3 h |
| `bronze` | Cofre de bronce | Pequeño | Común | 4 h |
| `silver` | Cofre de plata | Mediano | Raro | 6 h |
| `gold` | Cofre de oro | Mediano | Épico | 8 h |
| `magic` | Cofre mágico | Grande | Épico | 12 h |
| `royal` | Cofre real | Grande | Legendario | 16 h |
| `supreme` | Cofre supremo | Muy grande | Legendario | 20 h |
| `champion` | Cofre de campeones | Muy grande | Mítico | 24 h |
| `divine` | Cofre divino | Enorme | Mítico | 36 h |
| `event` | Cofre de evento | Variable | Especial | 6 h |

## Arquitectura acordada

- Conservar `Meta.chests()` y la economía actual para no romper compatibilidad ni pruebas existentes.
- Añadir inventario persistente tipado con identificadores estables, normalizando cofres antiguos cuando sea necesario.
- Mostrar tres ranuras iniciales y una cuarta desbloqueable.
- Permitir una apertura temporal activa, omitir el tiempo con gemas y recoger al finalizar.
- Mantener apertura premium instantánea como compatibilidad del sistema actual.
- Añadir catálogo de los diez tipos y una banda de recompensas posibles.
- Usar los cuatro estados del atlas durante la apertura, no una deformación de una sola imagen.

## Estado actual

- [x] Auditoría inicial de HTML, CSS, persistencia y flujo de recompensas.
- [x] Identificado que la implementación actual usa un único cofre y una sola imagen abierta.
- [x] Detectados cambios locales previos; se trabajará de forma aditiva.
- [x] Regenerado y validado el atlas de madera con una sola cerradura unida a la tapa. El único archivo canónico es `img/ui-generated/chests/atlas/wood.png`; la copia binaria temporal `wood-v2.png` se retiró tras verificar que era idéntica.
- [x] Generados y validados los diez atlas: `wood`, `bronze`, `silver`, `gold`, `magic`, `royal`, `supreme`, `champion`, `divine` y `event`.
- [x] Implementado el inventario tipado, migración de partidas antiguas, ranuras, desbloqueo de cuarta ranura, temporizador único activo, coste de omisión y tablas de recompensas por tipo.
- [x] Rediseñadas la vista principal y la cuadrícula del catálogo siguiendo la jerarquía y lenguaje visual de las referencias.
- [x] Añadidas pruebas específicas del sistema y ampliadas las pruebas de vistas/assets.
- [x] Pruebas parciales superadas: `core` 25/25, `fb-regression` 22/22, `hub-views-redesign` 3/3 y `chests-redesign` 4/4.
- [x] QA funcional, responsive y visual completado en navegador a 1280×900 y 390×844.
- [x] Suite completa ejecutada tras la iteración responsive: 174/176 pruebas pasan; las dos fallas restantes pertenecen a `board-themes-redesign.test.js` (selector V4 y schema esperado 4 frente a 4.1), fuera del cambio de cofres. `node --check game.js` y `git diff --check` pasan.

## Corrección crítica de la cerradura

- La primera fuente generada para madera se descartó porque duplicaba la placa de cierre.
- `wood.png` fue sustituido por la versión corregida; ya no contiene el error.
- Los diez atlas finales respetan la misma construcción: una única cerradura/medallón pertenece a la tapa, sube con ella y deja el frontal de la base limpio.
- La tanda inicial que podía repetir el fallo no se integró.

## Hallazgos relevantes

- `game.js` contiene `Meta.openChest()`, `Meta.openPremiumChest()`, `buildChests()`, `revealChestReward()` y `showChestReward()`.
- El contador de cofres se proyecta también en Inicio/Eventos mediante `syncHomeChests()`.
- El asset abierto anterior es `img/ui-generated/chests/chest-open.png`.
- La pantalla actual está en `index.html` como `#view-chests`; sus estilos principales empiezan en el bloque `COFRES` de `styles.css`.
- El proyecto no parte de un árbol limpio; no se deben sobrescribir cambios ajenos.
- QA responsive detectó que el `flex-shrink` heredado reducía el showcase móvil a 20 px; se corrigió fijando los hijos directos de `.chests-scroll` como bloques no encogibles para que el desbordamiento ocurra en el scroll vertical.
- QA de caché detectó que reutilizar una versión previa podía servir una compilación anterior; la versión actual se incrementó a `2.6.85`.

## Implementación integrada

- `game.js`: catálogo de diez tipos, persistencia schema 4, migración, distribución por modos, ranuras, temporización, recompensas y animación de cuatro estados.
- `index.html`: nueva composición de cofre seleccionado, acciones, ranuras, recompensas posibles, premium y catálogo.
- `styles.css`: acabado azul/púrpura, ribbon, paneles, sprites 2×2 y adaptación desktop/móvil.
- `sw.js`: precache best-effort de los diez atlas y versión de caché `2.6.85`.
- Fixture explícito de QA solo en `?dev&qaChests=1`; no afecta a sesiones normales.

## Próxima acción inmediata

Entrega lista. Si se continúa el trabajo, preservar las invariantes de cerradura, el schema 4 y la sincronización de versión entre `game.js`, `index.html` y `sw.js`.

## QA final

- Desktop 1280×900: showcase de 346 px, una sola cerradura visible, acciones, ranuras y scroll interno estables; sin errores fatales.
- Móvil 390×844: showcase de 422 px tras la corrección responsive, cofre/fichas completos y catálogo de 10 tarjetas en dos columnas.
- Flujo probado: selección de plata → temporizador de 6 h → omisión por 18 gemas → animación de cuatro estados → recompensa → inventario 3→2 y temporizador limpiado.
- Catálogo probado en desktop y móvil; los diez tipos aparecen con ficha, rareza, tamaño, descripción y disponibilidad real.
- El atlas canónico de madera se reinspeccionó a resolución original: una sola placa acompaña a la tapa en los dos estados abiertos y la base queda limpia.

## Iteración responsive y usabilidad — 2026-07-18

### Problema reportado

- En móviles la pantalla conserva demasiado alto de cabecera y showcase; las acciones y las ranuras aparecen demasiado tarde en el flujo.
- La segunda fila del showcase apila fichas de 176 px bajo un héroe de 218 px, creando un bloque de 422 px que se siente denso incluso en teléfonos altos.
- La adaptación no reproduce suficientemente la jerarquía del mock: cofre dominante, acciones inmediatamente disponibles y ranuras visibles como siguiente paso natural.
- Debe cubrirse explícitamente desde 320×568/375×667 (iPhone SE) hasta 430×932, además de tablet y escritorio.

### Dirección acordada

1. Mantener el cofre como foco visual y comprimir las dos fichas informativas a una fila secundaria de unos 82–96 px.
2. Reducir cabecera/ribbon y héroe en pantallas bajas sin reducir objetivos táctiles por debajo de 44 px.
3. Colocar las dos acciones principales inmediatamente después del showcase, con jerarquía y separación inequívocas.
4. Hacer ranuras y recompensas carruseles horizontales con snap, tarjeta parcialmente visible y espaciado suficiente para comunicar desplazamiento.
5. Aumentar respiración entre secciones mientras se reduce contenido redundante dentro de cada tarjeta.
6. Validar 320×568, 375×667, 390×844 y 430×932; conservar la composición de tres columnas desde tablet.

### Estado de esta iteración

- [x] Auditoría visual y de geometría en los cuatro tamaños.
- [x] Implementación CSS móvil orientada a tarea.
- [x] QA funcional y visual.
- [x] Pruebas y cierre.

### Resultados de geometría y usabilidad

| Viewport | Showcase | Acciones | Resultado inicial |
| --- | ---: | ---: | --- |
| 320×568 | 220 px | y=405–459, 54 px | Ambas acciones completas antes del fold; antes empezaban en y=615. |
| 375×667 | 220 px | y=414–468, 54 px | Acciones y título de ranuras visibles; primera fila queda sugerida. |
| 390×844 | 270 px | y=473–531, 58 px | Dos ranuras visibles y siguiente sección alcanzable con un gesto. |
| 430×932 | 288 px | y=498–556, 58 px | Dos ranuras completas y una tercera parcialmente visible como affordance. |
| 768×1024 | 389 px | y=644–732, 88 px | Recupera la composición del mock: ficha izquierda, cofre central y contenido a la derecha. |

- El showcase del iPhone SE bajó de 422 a 220 px sin reducir acciones por debajo de 54 px.
- Nombre/rareza y contenido pasan a fichas flotantes compactas que flanquean el cofre; el cierre sigue siendo parte de la tapa del asset y no se alteró.
- Ranuras: `scrollWidth 682 / clientWidth 288` en 320 px y `783 / 398` en 430 px; snap horizontal obligatorio y tarjeta siguiente parcialmente visible.
- Recompensas: `scrollWidth 822 / clientWidth 288` en 320 px.
- Catálogo: una columna legible hasta 350 px, dos columnas desde 351 px y CTA de selección de 44 px.
- Pruebas focalizadas de cofres/home/vistas: 18/18; `node --check game.js` y `git diff --check` correctos.

## Validación del atlas ancla

- Top-left: cerrado, una placa en el labio frontal de la tapa.
- Top-right: cerrado/desbloqueado, la misma placa iluminada.
- Bottom-left: tapa a medio recorrido; una sola placa inclinada y unida a la tapa; base limpia.
- Bottom-right: tapa abierta; una sola placa elevada con la tapa; base limpia.
- Alfa generado correctamente mediante extracción cromática local.
