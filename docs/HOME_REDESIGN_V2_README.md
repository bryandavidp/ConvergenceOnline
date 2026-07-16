# Inicio arcade espacial — plan, implementación y QA

## Objetivo

Reconstruir `#screen-start` para reproducir el mockup recibido, conservando el
estado y los flujos reales de Convergence. La referencia y las capturas de QA se
guardan en `docs/mockups/`; la pantalla final sigue siendo HTML/CSS interactivo,
no una imagen plana.

## Estado del plan

| Fase | Estado | Resultado |
| --- | --- | --- |
| 1. Auditoría de la home existente | Completada | IDs, eventos, persistencia, i18n y PWA inventariados |
| 2. Sistema visual | Completada | Tokens, fondos, relieve, escala y arte alineados con la referencia 854×1280 |
| 3. Reconstrucción | Completada | Geometría principal cerrada dentro de ±4 px y navegación encajada al borde inferior |
| 4. Funcionalidad | Completada | 22 comprobaciones interactivas en Chrome; 22 resultados correctos |
| 5. QA visual | Completada | 16 auditorías entre 360 y 1024 px, incluido estrés de cabecera, sin overflow ni solapes |
| 6. QA técnico | Completada | Sintaxis, 139 tests, QA interactivo, caché `2.6.45` y diff verificados |

## Iteración de acabado visual y recompensa · 2026-07-15

Esta fase cierra los detalles que todavía separaban Inicio de la captura: la
voz tipográfica, el volumen del CTA, la escala continua de la cabecera, la
economía y el estado reclamado de la recompensa. No introduce rutas nuevas ni
cambia la fuente de verdad de los datos.

| Trabajo | Estado | Contrato de implementación y prueba |
| --- | --- | --- |
| Tipografía | Completado | Inicio declara una familia redondeada propia; nombre, recompensa, CTA, tarjetas y navegación comparten familia y mantienen una jerarquía de pesos 700–900 |
| CTA `Jugar` | Completado | Pieza azul dominante con doble contorno cian/violeta, labio, brillo superior, triángulo blanco y texto pesado; se miden borde, fondo, sombra y geometría real |
| Botón `Inicio` | Completado | El icono existente vive dentro de un disco 1:1, `border-radius:50%`, aro cian, halo azul y elevación sobre la barra |
| Recompensa diaria | Completado | Transición `disponible → is-popping → is-claimed`; la explosión termina antes de ocultar el contenido y `visibility:hidden` conserva la caja reservada |
| Avatar | Completado | Tamaño fluido con `clamp()`, relación 1:1 y badge proporcional; se eliminan el óvalo móvil y los saltos de escala de tamaño entre breakpoints |
| Monedas y gemas | Completado | Cápsulas oscuras con borde y relieve, moneda de estrella, números tabulares y botones `+` circulares verdes; no se usa `transform:scale()` para falsear sus cajas |
| Regresión responsive | Validado | Viewports fuente 390, 720, 854 y 1024 px, más pares limítrofes 719/720, 819/820, 900/901, 853/854 y 1023/1024 |

Resultado de cierre: los siete veredictos del QA visual (`layouts`, `design`,
`continuity`, `interactions`, `semantics`, `disabled` y `runtime`) son
positivos; pasaron 23 interacciones reales, cinco pares de continuidad y la
suite completa de 139 tests. Aplicación, recursos y service worker quedan
sincronizados en `2.6.45`.

### Ciclo de vida de la recompensa

1. Mientras `Meta.rewardReady()` es verdadero, el banner está visible y el
   botón de reclamar acepta una única activación.
2. La activación bloquea inmediatamente el botón y añade `is-popping`. La
   animación `dailyRewardBubblePop` comprime, expande y fragmenta visualmente la
   superficie como una burbuja; economía, persistencia y ARIA se actualizan en
   el mismo flujo.
3. `animationend` —con timeout de seguridad— retira `is-popping` y aplica
   `is-claimed`. Este estado usa `visibility:hidden`, `opacity:0` y
   `pointer-events:none`, nunca `display:none`: el rectángulo del banner, el CTA
   y las tarjetas deben conservar exactamente sus coordenadas.
4. Con movimiento reducido se salta la coreografía, pero se alcanza el mismo
   estado final y se conserva el hueco. El foco sale del control oculto hacia
   `Jugar` cuando seguía perteneciendo al banner.

### Cobertura añadida

- `tests/home-redesign.test.js` protege la familia tipográfica local, las capas
  del CTA, el círculo de Inicio, el avatar cuadrado fluido, las pills de
  economía, los `+` circulares y los dos estados de la recompensa.
- `tools/home-visual-qa.js` registra estilos tipográficos computados y cajas de
  avatar, economía, CTA e Inicio. La reclamación comprueba tanto el cambio de
  monedas como la secuencia de clases y compara antes/después los rectángulos
  de recompensa, CTA y tarjetas con tolerancia de 1 px.
- La auditoría de continuidad compara componentes a ambos lados de cada
  breakpoint. Un cambio de un solo píxel de viewport no puede producir un
  salto superior al 12 % en tamaño; posición, límites y solapes se verifican
  de forma independiente en cada composición responsive.
- El veredicto final separa `layouts`, `design`, `continuity`, `interactions`,
  `semantics`, `disabled` y `runtime`, de modo que una pantalla sin overflow no
  pueda darse por correcta si pierde la fidelidad visual.

## Iteración de coherencia funcional · 2026-07-15

Esta pasada corrige las regresiones detectadas después del rediseño sin
desmontar la composición aprobada. El plan y su resultado final son:

| Trabajo | Estado | Implementación |
| --- | --- | --- |
| Cabecera horizontal | Completado | Economía compacta, nombre con elipsis solo al agotar espacio y breakpoints separados 720–819 / 820–900 px |
| Acciones duplicadas | Completado | Eliminados el engranaje superior y la campana flotante; Ajustes y Misiones conservan una única entrada cada uno |
| Resumen central | Completado | El chip muestra exclusivamente `Mejor puntuación`, sin repetir el nivel de la cabecera |
| Rutas de menú | Completado | `Logros` abre una vista de logros; Perfil mantiene estadísticas y récords; ya no comparten presentación |
| Funciones futuras | Completado | Multijugador, Liga y Amigos son controles nativos desactivados, grises, accesibles y sin handlers ficticios |
| Cofres en tiempo real | Completado | `syncHomeChests()` actualiza contador, badge, estado y ARIA en el mismo tick de cada apertura, incluido el paso a cero |
| Aviso PWA | Completado | Cuando hay actualización, el pie reserva espacio y el aviso no tapa ningún menú |
| Regresión | Completado | Tests estáticos, interacciones reales, aperturas consecutivas de cofres y geometría responsive automatizadas |

### Hallazgos de esta pasada

- El solape no procedía de un único tamaño: entre 720 y 819 px heredábamos
  simultáneamente cotas pensadas para 1024 y para el lienzo 854. Ahora ese
  intervalo tiene una escala propia y 820–900 conserva la referencia 2:3.
- Los saldos largos ensanchaban las pills indefinidamente. En Inicio se muestran
  como `10K`/`1M`, mientras el resto del producto conserva el número completo.
- `Liga` reutilizaba el handler de Perfil/Logros y Multijugador/Amigos simulaban
  disponibilidad mediante avisos. Se retiraron esas rutas hasta que exista una
  función real.
- El modelo de cofres sí persistía el decremento; el defecto estaba en la
  proyección de Inicio, que solo se refrescaba al volver a entrar. La fuente de
  verdad no cambió: se centralizó su render.
- El aviso de nueva versión podía cubrir los accesos rápidos en móvil. Inicio
  ahora amplía temporalmente el pie y mantiene todos los targets visibles.

### Cobertura de aceptación

- Viewports: 360×640, 390×844, 601×900, 719×1024, 720×1024,
  768×1024, 819×1180, 820×1180, 854×1280 y 1024×1536.
- Auditoría adicional a 720×1024 con nombre de 16 caracteres y monedas/gemas
  de ocho cifras.
- Cero controles recortados, cero solapes no intencionales y ancho documental
  igual al viewport.
- Multijugador, Liga y Amigos verificados como `disabled`; Ajustes verificado
  como entrada única; puntuación verificada sin texto de nivel.
- Dos cofres abiertos de forma consecutiva: `2 → 1 → 0`, badge oculto al final
  y estado de Inicio actualizado antes de cerrar el modal.
- Navegador integrado: inspección visual a 854×1280, 390×844 y 768×1024;
  `Logros` validado como diálogo independiente y las tres funciones futuras
  comprobadas como no activables.

## Iteración de fidelidad 854×1280 · 2026-07-15

La nueva referencia `Foto 1.jpg` reabre el cierre visual. Su relación 2:3 es
la fuente de verdad de esta iteración y se auditará a su resolución nativa,
además de los viewports compactos ya cubiertos.

### Plan ejecutado y diferencias cerradas

- **Fondo:** reforzar la nebulosa radial bajo `Jugar`, rayos horizontales,
  estrellas y objetos espaciales laterales sin restar contraste al contenido.
- **Cabecera:** compactar el avatar y su badge, acercar identidad y XP y alinear
  la economía al margen derecho; Misiones vive en su acceso de la banda.
- **Recompensa:** ajustar altura, radio, degradado violeta/rosa, escala del
  regalo y posición del cohete para que el fuego conecte con el CTA.
- **CTA:** igualar proporción, doble contorno cian/violeta, labio inferior,
  brillo interno, triángulo y escala tipográfica.
- **Puntuación:** centrar bajo el CTA un chip dedicado únicamente al récord; el
  nivel y el XP permanecen en la cabecera.
- **Tarjetas:** reducir el aire superior, hacer que tablero/trofeo/versus ocupen
  el tercio inferior correcto y ajustar los degradados azul/verde/naranja.
- **Navegación:** afinar radios, divisores, iconos, etiquetas y halo elevado de
  `Inicio`; las dos bandas deben cerrar exactamente el borde inferior.
- **Responsive:** mantener la jerarquía en 390×844 y scroll alcanzable en
  360×640, sin ocultar acciones ni crear overflow horizontal.

### Criterios de aceptación

1. Captura Chrome a 854×1280 sin recortes, overflow horizontal ni errores JS.
2. Regiones principales dentro de ±4 px respecto a las cajas de la referencia,
   salvo arte orgánico y valores derivados del estado real.
3. Todas las acciones implementadas responden; las futuras están desactivadas
   de forma explícita y los datos persistidos siguen siendo la única fuente de verdad.
4. Los 16 assets protagonistas y de navegación proceden de
   `img/ui-generated/home/`; la
   captura objetivo no se utiliza como sprite ni fondo.
5. Capturas y reporte JSON actualizados, caché versionada y suite completa verde.

## Referencias y evidencia

- Objetivo activo 854×1280: [`mockups/home-target-reference-854x1280.jpg`](mockups/home-target-reference-854x1280.jpg)
- Objetivo anterior 1024×1536: [`mockups/home-target-reference.png`](mockups/home-target-reference.png)
- Captura Chrome 854×1280: [`mockups/home-actual-854x1280.png`](mockups/home-actual-854x1280.png)
- Captura Chrome 1024×1536: [`mockups/home-actual-1024x1536.png`](mockups/home-actual-1024x1536.png)
- Captura Chrome 390×844: [`mockups/home-actual-390x844.png`](mockups/home-actual-390x844.png)
- Captura Chrome 360×640: [`mockups/home-actual-360x640.png`](mockups/home-actual-360x640.png)
- Final del scroll 360×640: [`mockups/home-actual-360x640-bottom.png`](mockups/home-actual-360x640-bottom.png)
- Informe geométrico: [`mockups/home-visual-qa-report.json`](mockups/home-visual-qa-report.json)
- Runner reproducible: [`../tools/home-visual-qa.js`](../tools/home-visual-qa.js)

Ejecutar la auditoría desde la raíz:

```powershell
node tools/home-visual-qa.js
```

El runner abre Chrome headless real mediante DevTools, fija estados válidos en
`localStorage`, prueba diez viewports, captura la parte inferior del scroll
corto, añade un caso de estrés, ejecuta 22 comprobaciones de Inicio y escribe
`docs/mockups/home-visual-qa-report.json`. El auditor distingue el desplazamiento
vertical deliberado de un overflow horizontal real y excluye únicamente los
solapes estructurales documentados entre contenido desplazable y cromo fijo.

## Contrato visual implementado

- Lienzo azul noche con nebulosa, estrellas y acentos cian/violeta.
- Cabecera con avatar robot, nombre editable, nivel/XP, monedas, gemas y racha;
  Ajustes permanece únicamente en la navegación inferior.
- Banner de recompensa diaria con regalo, CTA y cohete superpuesto.
- CTA `Jugar` como pieza dominante, con volumen, borde luminoso y foco visible.
- Chip exclusivo de mejor puntuación debajo del CTA.
- Tarjetas azul, verde y naranja para Clásico, Torneos y Multijugador.
- Banda contextual de cinco acciones y navegación global de cinco acciones con
  `Inicio` elevado.
- Tipografía pesada, números tabulares, targets táctiles y estados accesibles.
- En 1024×1536 la composición usa el ancho completo de la referencia; en móvil
  se comprime sin overflow horizontal y en pantallas bajas conserva scroll.

## Geometría verificada a 854×1280

| Región | Implementación Chrome | Referencia aproximada | Desviación |
| --- | --- | --- | --- |
| Cabecera | x 27, y 12, 800×194 | contenido x 20–840, y 20–206 | arte dentro de ±3 px |
| Recompensa | x 27, y 226, 600×142 | x 28, y 226, 600×142 | 1 px en x |
| CTA `Jugar` | x 143,5, y 396, 567×194 | x 145, y 396, 567×193 | ≤1,5 px |
| Tarjetas | x 36, y 681, 782×314 | x 36, y 681, 782×314 | 0 px |
| Banda contextual | x 34, y 1013, 786×138 | x 34, y 1013, 786×138 | 0 px |
| Navegación | x 34, y 1168, 786×112 | x 34, y 1168, 786×112 | 0 px |

La captura nativa termina exactamente en `y=1280`: la navegación no queda
recortada y el documento conserva el mismo ancho que el viewport. Fondo,
nebulosa, rayos, planetas, diamante, cruz, cohete y halos se pintan como capas
decorativas independientes para no bloquear interacción ni lectura.

## Geometría verificada a 1024×1536

| Región | Implementación Chrome | Referencia aproximada |
| --- | --- | --- |
| Cabecera | x 32, y 12, 960×220 | ancho útil completo |
| Recompensa | x 44, y 270, 730×177 | x 34, y 270, ~720×171 |
| CTA `Jugar` | x 172, y 487, 680×220 | x 174, y 488, ~676×222 |
| Tarjetas | x 44, y 818, 936×374 | x 44, y 818, ~936×374 |
| Banda contextual | x 44, y 1210, 936×165 | x 40, y 1214, ~944×165 |
| Navegación | x 40, y 1395, 944×141 | x 40, y 1395, ~944×141 |

Resultado automático: ancho documental igual al viewport, cero controles con
overflow horizontal, cero solapamientos no intencionales y cero errores
JavaScript en las cinco capturas auditadas (incluido el final del scroll). En
360×640 el contenido central mide 580 px dentro de una zona de 469 px y llega
íntegro al hacer scroll; la navegación queda anclada.

## Mapa funcional

| Superficie | Acción real |
| --- | --- |
| Perfil | Abrir perfil |
| Lápiz | Renombrar jugador |
| `+` de monedas/gemas | Flujo de economía correspondiente |
| Ajustes (navegación inferior) | Abrir ajustes |
| Misiones (banda contextual) | Abrir misiones |
| Recompensa diaria | Reclamar si está disponible; estado real en ARIA |
| `Jugar` | Abrir selector completo de modos |
| Partida clásica | Abrir mapa de mundos |
| Torneos | Abrir Reto del día |
| Multijugador | Desactivado y gris hasta disponer de matchmaking real |
| Liga / Amigos | Desactivados y grises hasta su implementación |
| Cofres | Abrir inventario; contador de Inicio sincronizado en cada apertura |
| Logros | Abrir la vista exclusiva de logros |
| Tienda / Guía | Abrir sus flujos existentes |

El texto visible del banner se mantiene estable como en el mockup. El día y el
estado reclamado siguen expuestos mediante el nombre accesible del botón. Las
métricas de la banda contextual también siguen actualizándose, aunque se
ocultan visualmente para respetar la referencia y permanecen en sus etiquetas
accesibles.

## Assets

`img/ui-v2/home/` conserva los microiconos reutilizables de economía y estado.
Las 16 ilustraciones originales creadas para esta pantalla viven en
`img/ui-generated/home/`:

- `avatar-robot.png`
- `daily-gift.png`
- `hero-rocket.png`
- `classic-board.png`
- `tournament-trophy.png`
- `multiplayer-versus.png`
- `nav-missions.png`, `nav-daily.png`, `nav-chest.png`
- `nav-league.png`, `nav-friends.png`, `nav-achievements.png`
- `nav-shop.png`, `nav-home.png`, `nav-guide.png`, `nav-settings.png`

Todos se generaron individualmente en modo creación con ImageGen, con prompts
de icono 3D casual, vista frontal, luz de borde y croma plano. Después se
convirtieron a PNG con alfa, se recortaron al contenido transparente y se
optimizaron a un máximo de 512 px (384 px para navegación). No se usa ningún
recorte de la captura objetivo como asset de producto. `HOME_GENERATED_ART`
precarga los 16 archivos desde `sw.js` para funcionamiento offline.

## Hallazgos resueltos

1. La implementación previa limitaba Inicio a 720 px incluso en el lienzo de
   1024 px. Se creó un layout de escritorio de 960 px.
2. La versión compacta dejaba huecos grandes y recortaba Ajustes. Se corrigieron
   grid, escalas, espaciado y safe area.
3. El instalador PWA rompía la composición. Se oculta solo en Inicio; el resto
   de la aplicación conserva su flujo.
4. Datos antiguos podían guardar `streak` como número y producir `undefined
   días`. La migración normaliza el valor a `{count,date}`.
5. La primera semilla visual usaba `350/300`, un estado imposible. El QA usa
   ahora `105/300`, equivalente al 35 % de progreso visual.
6. Clásico y Torneos reemplazaban el copy del mockup por estados dinámicos. El
   copy visible queda estable y el detalle real pasa a `aria-label`.
7. En 360×640 no cabe toda la composición sin perder legibilidad. Se eligió
   scroll central con cabecera y navegación persistentes, y se verificó el
   extremo inferior con una captura separada.
8. Los iconos secundarios provisionales no reproducían el volumen del mockup.
   Se generaron diez piezas originales nuevas y se sustituyeron Misiones,
   Diario, Cofres, Liga, Amigos, Logros, Tienda, Inicio, Guía y Ajustes.
9. La referencia 854×1280 necesitaba una escala propia entre móvil y el lienzo
   1024×1536. El breakpoint 820–900 px fija la composición 2:3 y 720–819 px usa
   una transición fluida que evita el solape horizontal.

## Registro

### 2026-07-14 — Reconstrucción inicial

- Auditados DOM, eventos, estados persistidos, i18n y assets.
- Reorganizada la home según la jerarquía del mockup.
- Conectadas las nuevas superficies a handlers existentes.
- Añadidos iconos casuales V2, tests específicos y documentación del sistema.

### 2026-07-15 — Inspección completa en navegador

- Intentado el navegador integrado; su runtime no pudo inicializarse por un
  error de redefinición de `process`.
- Activada la alternativa reproducible con Chrome real y DevTools Protocol.
- Capturadas resoluciones 854×1280, 1024×1536, 390×844 y 360×640.
- Corregidos ancho, alturas, alineación, clipping, scroll corto, copy, XP de QA,
  avatar, regalo, cohete, tablero, trofeo y versus.
- Verificados por interacción `Jugar`, Clásico, Torneos, Guía y Ajustes.
- Sustituidos los recortes provisionales por seis assets originales generados:
  robot, regalo, cohete, tablero, trofeo y versus.
- Eliminado `img/ui-v3/`; ningún recorte de la referencia permanece conectado
  ni almacenado como asset de producción.
- Convertidos los cromas a alfa, optimizados los PNG e incorporados al caché
  offline como `HOME_GENERATED_ART`.
- Incorporada la referencia nativa 854×1280 y cerradas sus cajas principales:
  banner 600×142, CTA 567×194, tarjetas 782×314 y navegación 786×112.
- Generados e integrados diez iconos de navegación originales adicionales; el
  inventario offline pasa de seis a 16 assets.
- Ampliada la regresión interactiva de cinco a 18 comprobaciones; todas pasan.
- Validado el scroll 360×640 tanto arriba como abajo, sin overflow horizontal,
  solapes no intencionales ni errores JavaScript.
- Sincronizados app, recursos y service worker en la versión `2.6.38`.

### 2026-07-15 — Corrección de coherencia y estados

- Repetida la inspección con el navegador integrado ya operativo y con Chrome
  headless reproducible; se cubrieron escritorio, tablet, móvil y nombres/saldos
  extremos.
- Eliminados la campana flotante y el Ajustes superior; la navegación conserva
  una sola entrada funcional por destino.
- Rediseñado el chip central como mejor puntuación exclusiva.
- Separados Perfil y Logros, con título, emblema y contenido propios.
- Desactivados de forma nativa Multijugador, Liga y Amigos, sin handlers ni
  modales engañosos.
- Centralizada la proyección de cofres y verificada la secuencia `2 → 1 → 0` en
  tiempo real.
- Añadida protección contra overflow con formato compacto de economía y
  breakpoint específico 720–819 px.
- El aviso PWA reserva espacio en el pie de Inicio para no cubrir acciones.
- Ampliado el runner a 12 auditorías geométricas y 22 comprobaciones
  interactivas; todos los veredictos quedan en verde.
- Sincronizados aplicación, recursos y service worker en `2.6.40`.
