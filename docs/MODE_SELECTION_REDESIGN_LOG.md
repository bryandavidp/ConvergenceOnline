# Rediseño de selección de modo — registro de trabajo

Fecha de inicio: 2026-07-16  
Referencia visual: `Foto 1.jpg`, 853 × 1280 px  
Estado: registro histórico; sustituido por el hub unificado de Inicio (`2.6.54`)

> Desde `2.6.54`, `#screen-modes` y `buildModeMenu()` ya no existen. Sus cinco
> lanzadores reales y el anticipo de Multijugador viven en el carrusel
> cilíndrico de `#screen-start`. El diseño descrito debajo se conserva como
> historial de la fase anterior, no como arquitectura vigente.
> En `2.6.59`, las caras del cilindro adoptaron un cuerpo vertical más estrecho
> y un arte superior sobresaliente, con composición propia por modo.

## Objetivo

Reproducir la pantalla de selección de modo de la referencia con HTML/CSS real,
datos y controles verificables, sin usar la captura como fondo. El mockup
aprobado enlaza directamente `styles.css` y la misma estructura visual ya está
integrada en `#screen-modes` con datos, navegación e i18n reales.

## Reglas de fidelidad

- La referencia 853 × 1280 es la fuente de verdad para geometría, jerarquía,
  color y densidad.
- Se reutilizan los assets e iconos existentes cuando representan el mismo
  concepto con fidelidad suficiente.
- Solo se generan ilustraciones compuestas que no tienen equivalente en el
  repositorio; nunca se sustituyen iconos existentes por emojis.
- El texto se toma del producto y se corrigen artefactos o ambigüedades de la
  imagen, sin inventar funciones que no existan.
- Los modos ausentes de la captura conservan su función real y reciben una
  variante visual derivada del mismo sistema de tarjetas.

## Hallazgos confirmados

| ID | Hallazgo | Decisión |
| --- | --- | --- |
| H-01 | El proyecto es una PWA vanilla, sin build ni dependencias externas. | El mockup será HTML estático y cargará `../../styles.css`. |
| H-02 | `#screen-modes` y `buildModeMenu()` ya contienen los cinco modos jugables. | No se altera gameplay durante la fase de mockup. |
| H-03 | La cabecera reutilizable ya expone perfil, nivel, monedas, gemas y racha. | Se reutiliza su marcado y se crea una variante visual específica para modos. |
| H-04 | Existen equivalentes para avatar, moneda, gema, fuego, ajustes, flechas, libro, candado, objetivo, rayo, trofeo, medalla y wifi. | Se consumen desde `img/ui-v2`, `img/ui-generated/home` e `img/icons-v2`. |
| H-05 | No existen equivalentes fieles de las ilustraciones compuestas de Supervivencia, Clásico y Multijugador de la referencia. | Se generan como assets de juego aislados y sin texto. |
| H-06 | Aventura, Contrarreloj y Zen están implementados, pero no aparecen en la captura. | Se diseñan tarjetas propias con la misma retícula, relieve y código cromático. |
| H-07 | El repositorio ya contiene cambios sin confirmar del rediseño de Inicio. | Todos los cambios nuevos serán aditivos y se preservarán esas modificaciones. |
| H-08 | Multijugador aparece como disponible en la referencia, pero el producto todavía lo excluye de los modos V1. | La etiqueta visible replica `COMPITE EN LÍNEA`; el botón sigue deshabilitado y su nombre accesible indica `próximamente`, de modo que el mockup es fiel sin fingir una función activa. |
| H-09 | La referencia mide 853 × 1280 y deja exactamente 55 px de margen lateral en las tarjetas. | Se usa un catálogo de 740 px, centrado por la misma coordenada, y los modos adicionales continúan por scroll interno. |
| H-10 | Una reducción uniforme conserva mejor la referencia entre 684 y 852 px; por debajo de 684 px deja de garantizar objetivos táctiles cómodos. | Se usa escala proporcional en 684–852 px y un reflow nativo, sin `transform`, entre 320 y 683 px. |

## Inventario de assets del mockup

| Pieza | Fuente | Estado |
| --- | --- | --- |
| Avatar robot | `img/ui-generated/home/avatar-robot.png` | Reutilizado |
| Moneda, gema, fuego, ajustes y `+` | `img/ui-v2/home/` + CSS del proyecto | Reutilizados |
| Flechas | `img/icons-v2/8-ui/` | Reutilizadas |
| Libro y microiconos de características | Librerías `img/ui/`, `img/ui-v2/` e `img/icons-v2/` | Reutilizados |
| Arte Supervivencia | `img/ui-generated/modes/mode-survival.png` | Generado, RGBA 512 × 317 |
| Arte Clásico | `img/ui-generated/modes/mode-classic.png` | Generado, RGBA 512 × 463 |
| Arte Multijugador | `img/ui-generated/modes/mode-multiplayer.png` | Generado, RGBA 512 × 456 |
| Arte Aventura | `img/ui-generated/home/hero-rocket.png` | Reutilizado |
| Arte Contrarreloj | `img/ui-generated/modes/mode-timed.png` | Generado, RGBA 512 × 448 |
| Arte Zen | `img/ui-generated/modes/mode-zen.png` | Generado, RGBA 512 × 475 |

## Generación de ilustraciones

Modo: generación integrada de imágenes, usando la captura únicamente como
referencia de estilo y composición. Se solicitaron objetos 3D aislados, sin
texto ni interfaz, sobre chroma uniforme; después se eliminó el chroma, se
recortó al alfa útil y se verificaron bordes/canales RGBA.

Prompts normalizados:

- Supervivencia: corazón rojo con electrocardiograma, enemigo morado espinoso,
  enemigo cúbico verde y partículas.
- Clásico: isla flotante con río y cascada, bandera con estrella, árboles,
  rocas y pieza de puzle amarilla.
- Multijugador: esfera azul amistosa, esfera roja rival, `VS` visual y tablero
  en perspectiva con fichas de colores.
- Contrarreloj: cronómetro rosa, rayo dorado y partículas energéticas.
- Zen: jardín bonsái flotante, piedras, musgo, suculenta/loto y partículas.

## Iteraciones

| Iteración | Evidencia | Resultado | Diferencias pendientes |
| --- | --- | --- | --- |
| 0 — auditoría | Referencia original + inspección de repo | Arquitectura, componentes reutilizables y faltantes identificados. | Construir mockup base y medirlo. |
| 1 — estructura | Mockup HTML + reglas aisladas en `styles.css` | Cabecera, título, tres tarjetas y ayuda ocupan el primer viewport; extras por scroll. | Ajustar tamaños y assets. |
| 2 — assets | Cinco PNG transparentes + hoja de inspección sobre fondo oscuro | Ilustraciones compuestas coherentes con la captura, sin texto incrustado. | Afinar escala dentro de cada tarjeta. |
| 3 — geometría | Captura 853 × 1280 y lectura de `getBoundingClientRect()` | Márgenes, alturas, gaps, títulos y etiquetas encajados en la retícula de referencia. | Revisar texto inferior y responsive. |
| 4 — contenido extendido | Captura de Aventura, Contrarreloj y Zen | Tres diseños derivados, con copy real y sin solapamiento con flechas/rasgos. | QA final. |
| 5 — QA inicial | Capturas 853 × 1280 y 390 × 844, consola y suite Node | Sin imágenes fallidas, sin overflow horizontal y 146/146 tests correctos. | Segunda pasada solicitada de tamaños y responsive. |
| 6 — fidelidad geométrica | Medición de píxeles y `getBoundingClientRect()` a 853 × 1280 | Se fijaron cabecera, título, cuatro cajas y banda de Multijugador en las coordenadas canónicas; se afinaron tipografía, flechas, arte y espaciados internos. | Validar los extremos responsive. |
| 7 — responsive | Inspección visual y geométrica en 853, 760, 684, 607, 390 y 320 px | Sin overflow horizontal ni colisiones; a 320 px también se verificaron ayuda, CTA, características y modos adicionales. | Integración en producción, después de aprobar el mockup. |
| 8 — integración productiva | `#screen-modes`, `buildModeMenu()`, PWA, prueba contractual y navegador real | La pantalla usa el diseño aprobado, cinco acciones reales, Ayuda funcional y Multijugador deshabilitado con estado visible. La geometría canónica permanece exacta y el reflow fue validado en seis anchos. | Ninguna. |

## Comparación geométrica final

Las lecturas de la referencia son aproximadas por tratarse de JPEG; las del
mockup proceden del navegador.

| Bloque | Referencia (x, y, ancho, alto) | Mockup (x, y, ancho, alto) |
| --- | --- | --- |
| Cabecera | 0, 0, 853, 111 | 0, 0, 853, 111 |
| Título y subtítulo | 0, 111, 853, 148 | 0, 111, 853, 148 |
| Supervivencia | 55, 259, 740, 220 | 55, 259, 740, 220 |
| Clásico | 55, 503, 740, 289 | 55, 503, 740, 289 |
| Multijugador | 55, 816, 740, 291 | 55, 816, 740, 291 |
| Ayuda | 55, 1131, 740, 132 | 55, 1131, 740, 132 |
| Banda de Multijugador | 334, 1015, 433, 73 | 334, 1015, 433, 73 |

En el texto principal, la segunda medición dejó el H1 en la misma caja útil de
297 px y los títulos/descripciones protagonistas dentro de una diferencia
visual de 0–2 px respecto a los glifos de la referencia. Las pequeñas
diferencias restantes pertenecen al dibujo interno de los PNG generados, no a
la retícula ni a sus cajas.

## Estrategia responsive de la segunda pasada

- 853 px reproduce la retícula de la captura sin escalado.
- 684–852 px conserva esa misma retícula mediante una escala proporcional con
  origen superior centrado; a 760 y 684 px las coordenadas se reducen por el
  mismo factor, sin cambiar saltos de línea ni proporciones.
- 320–683 px usa reflow nativo: tarjetas de altura automática, arte fluido,
  etiquetas replegables, descripciones sin `<br>` forzados y bandas de rasgos a
  ancho completo.
- En 320 px el perfil textual se oculta, la cabecera económica mantiene 44 px
  de alto y el botón Atrás se separa del subtítulo; ningún contenido necesita
  desplazamiento horizontal.

## Evidencias

- [Mockup HTML](mockups/mode-selection-redesign-mockup.html)
- [Referencia normalizada 853 × 1280](mockups/mode-selection-target-853x1280.jpg)
- [Resultado 853 × 1280](mockups/mode-selection-mockup-853x1280.png)
- [Resultado responsive 390 × 844](mockups/mode-selection-mockup-390x844.png)
- [Modos adicionales](mockups/mode-selection-mockup-extra-modes.png)

## Criterios de aceptación del mockup

1. Captura a 853 × 1280 sin overflow horizontal ni errores de carga.
2. Cabecera, título, tres tarjetas protagonistas y tarjeta de ayuda dentro de
   una tolerancia inicial de ±6 px respecto a la referencia.
3. Supervivencia, Clásico y Multijugador ocupan el primer viewport en el mismo
   orden; los demás modos son alcanzables por scroll.
4. Todos los textos son HTML seleccionable y todos los iconos se cargan como
   assets individuales; la referencia no se usa como sprite ni fondo.
5. El mockup mantiene objetivos táctiles de al menos 44 × 44 px y foco visible.

Resultado: los cinco criterios están satisfechos. `failedImages` quedó vacío,
el overflow horizontal fue `0` en todos los tamaños inspeccionados y la consola
de la app quedó vacía. La suite completa terminó con 154/154 pruebas correctas
después de la integración productiva.

## Integración en producción

- `index.html` monta la cabecera, título, catálogo y navegación del mockup dentro
  de `#screen-modes`; no existe una segunda copia estática de las tarjetas.
- `buildModeMenu()` genera Supervivencia, Clásico, Multijugador, Ayuda, Aventura,
  Contrarreloj y Zen con sus textos ES/EN y sus acciones reales.
- Multijugador conserva `disabled` nativo, no recibe ningún handler y muestra
  `Próximamente` de forma visible y accesible; no se simula una función en línea.
- Entrar y salir restaura el foco, reinicia el scroll y sincroniza perfil, nivel,
  monedas, gemas y racha con el estado real.
- El responsive mantiene la escala canónica entre 684–852 px y hace reflow
  nativo entre 320–683 px, con objetivos táctiles ≥44 px, safe areas y soporte
  para la preferencia Texto grande.
- El service worker precachea los cinco artes y las dos flechas nuevas. La app,
  los queries de CSS/JS y la caché quedaron sincronizados en `2.6.52`.
- `tests/mode-selection-redesign.test.js` blinda estructura, orden, acciones,
  estado deshabilitado, i18n, PNG, CSS responsive y precache/versionado.

## QA final de producción

| Viewport | Régimen | Resultado |
| --- | --- | --- |
| 853 × 1280 | Canónico | Cajas en 55/259/740/220, 55/503/740/289, 55/816/740/291 y 55/1131/740/132; consola vacía. |
| 760 × 1140 | Escala proporcional | Todas las coordenadas reducidas por el mismo factor; sin overflow. |
| 684 × 1027 | Límite escalado | Retícula íntegra y sin desplazamiento horizontal. |
| 683 × 1024 | Límite reflow | Cambio nativo sin colisiones y controles táctiles válidos. |
| 390 × 844 | Móvil | Cabecera compacta, tarjetas fluidas y catálogo completo desplazable. |
| 320 × 640 | Mínimo | Sin overflow, texto legible, Ayuda y los tres modos derivados accesibles. |

También se verificaron la variante inglesa, Texto grande, los retornos de foco,
Ayuda, Supervivencia, Clásico y Aventura, además del scroll hasta Zen.
