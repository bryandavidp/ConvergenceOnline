# Sistema de Rareza + Rediseño de Colecciones

> Documento de trabajo (WIP). Registra el plan, hallazgos y progreso de la tarea
> "añadir sistema de rareza a iconos/bordes/tableros y rediseñar la pantalla de
> Colecciones para que sea idéntica a los mockups adjuntos".
>
> **Objetivo:** que otra persona pueda continuar esta tarea si no se termina.
> Rama de trabajo: `claude/rarity-system-icons-boards-x6pi4t`.

## 1. Qué se pide (resumen del encargo)

1. Añadir un **sistema de "rareza"** a **iconos, bordes y tableros** (y por
   coherencia también temas y logros): Común / Raro / Épico / Legendario.
2. Rediseñar la pantalla **Colecciones** para que sea **idéntica** al mockup 1:
   cabecera con mascota + 5 "pills" de categoría + 5 tarjetas grandes
   (Tableros, Temas, Iconos, Bordes, Logros) con contador `x/y` y flecha.
3. Dentro de cada categoría, una pantalla de detalle **idéntica** a los mockups
   2 (Iconos) y 3 (Bordes): cabecera + panel de progreso con 4 mini-tarjetas de
   rareza + barra de filtros (Todos/Comunes/Raros/Épicos/Legendarios + orden) +
   rejilla agrupada por rareza + banner inferior con CTA.
4. Visualizar **cada ítem del inventario ordenado por rareza**.

**Interpretación / decisión de alcance:** los mockups muestran ~36 iconos y ~28
bordes con arte 3D (dragones, calaveras, etc.) que **no existe como asset en el
repo**. El repo tiene 10 iconos y 10 bordes PNG reales (temática espacial
abstracta), 11 tableros (swatches CSS) y 6 temas. Por tanto se reproduce el
**diseño/chrome al 100%** (cabeceras de rareza, marcos de color, panel de
progreso, mini-tarjetas, pills, banners, slots bloqueados, insignia "Equipado")
usando el **inventario real**; los contadores reflejan el inventario real, no los
números inventados del mockup. Esto respeta "visualizar cada ítem de nuestro
inventario ordenado por rareza".

## 2. Hallazgos del código (dónde está cada cosa)

- **`game.js`** (~12.4k líneas, un IIFE). Módulos relevantes:
  - `PlayerIcons` (línea ~3073): 10 iconos PNG en `img/player-icons/`. `DEFS`,
    `order`, `html(id,cls)`. Default `nova`.
  - `PlayerBorders` (línea ~3095): 10 bordes PNG en `img/player-borders/`.
    Default `starlight`.
  - `playerAvatarHtml(iconId, borderId, cls)` (línea ~3117): compone icono+borde.
  - `Themes` (línea ~4607): 6 temas de color (swatch = gradiente CSS de vars).
  - `Boards` (línea ~4637): 11 tableros cosméticos (swatch gradiente; se aplican
    vía `data-board`, thumbnails con `.board-thumb[data-board]`).
  - `ACH` (línea ~3368): 11 logros (`{id,name,desc,t}`, nombres ES hardcodeados).
  - `Meta` (línea ~3125): propiedad/equipado.
    - Iconos: `ownsAvatarIcon`, `avatarIcon()`, `equipAvatarIcon(id)`, `avatarIconOwnedCount()`.
    - Bordes: `ownsAvatarBorder`, `avatarBorder()`, `equipAvatarBorder(id)`, `avatarBorderOwnedCount()`.
    - Tableros: `ownsBoard`, `equippedBoard()`, `equipBoard(id)`.
    - Temas: `owns(id)`, `cosmetics().theme`, `equip('theme', id)`.
    - Logros: `achievements()` → `[{id,name,desc,unlocked}]`.
  - `HubViews` (línea ~2241): router de vistas del hub. Se abre con
    `HubViews.open(name, {nav})`. Las vistas son `<section data-hub-view="X">`
    dentro de `#hub-views`; se montan en `init()`.
  - `buildCollections()` (línea ~10660) y `openCollections()` (línea ~10773):
    construcción vieja de la vista (se reemplaza).
  - `TOPBAR_HTML` (línea ~10166): appbar (monedas/gemas/energía/ajustes/perfil/
    cofre). Ya coincide razonablemente con la barra superior de los mockups.
  - Wiring de `data-act` en `init()` (~línea 12279: `nav-collections`).
- **`index.html`**: vista `#view-collections` (línea ~816). Bottom nav con
  `data-act="nav-collections"` (línea 138).
- **`styles.css`**: estilos viejos de colecciones (línea ~9123). `.board-thumb`
  (~2892). `.m-head/.m-emblem` de cabecera de vista (~8065).
- **Existe ya** un concepto `rarity` en los cofres (chests) — independiente de
  este sistema cosmético; no se toca.

## 3. Diseño del sistema de rareza

Rarezas y colores (derivados de los mockups):

| Rareza | id | Acento | Uso |
|---|---|---|---|
| Común | `common` | plata/gris azulado `#9fb0d6` | por defecto |
| Raro | `rare` | azul/cian `#3fb2ff` | |
| Épico | `epic` | púrpura `#b46bff` | |
| Legendario | `legendary` | oro/ámbar `#ffc23d` | |

Módulo nuevo `Rarity` en `game.js` (orden + colores + claves i18n). Cada def de
icono/borde/tablero/tema/logro recibe un campo `rarity`.

**Reparto de rareza (inventario real):**
- Iconos (10): común `nova, comet, prism`; raro `sentinel, nebula, orbit`; épico
  `flare, crystal`; legendario `void, pulse`.
- Bordes (10): común `starlight, plasma, royal`; raro `aurora, comet, crystal`;
  épico `eclipse, circuit, bloom`; legendario `mythic`.
- Tableros (11): común `classic, madera`; raro `hielo, lava, bosque`; épico
  `cristal, magico, futurista, cosmico`; legendario `dorado, jardin`.
- Temas (6): común `default, mono`; raro `neon, sunset, forest`; épico `aurora`.
- Logros (11): común `first, combo10, streak3`; raro `perfect, level5, variety5`;
  épico `combo20, score3k, remove200`; legendario `score8k, fever`.

## 4. Plan de implementación (fases)

- [x] F0. Explorar código, documentar (este doc).
- [x] F1. Modelo de datos: módulo `Rarity` + campos `rarity` + helper de conteos.
- [x] F2. i18n ES/EN.
- [x] F3. HTML: `#view-collections` (hub) + `#view-collection-detail` (detalle).
- [x] F4. JS: hub + detalle + filtros/orden + equipar + `COLLECTION_CATS`.
- [x] F5. CSS: chrome completo para clavar los 3 mockups.
- [x] F6. Cache-bust (2.11.0), `node --test`, `eslint`.

## 5. Cómo quedó implementado (referencia para mantenimiento)

Todo el código nuevo vive en un bloque contiguo de `game.js` (buscar
`Colecciones (rareza)`), en `index.html` (`view-collections` +
`view-collection-detail`) y en `styles.css` (buscar `SISTEMA DE RAREZA`).

- **`Rarity`** (game.js, buscar `Rarity (rareza cosmética)`): `ORDER`, `DEFS`
  (acento por rareza), `of/label/plural/accent/tally`.
- **Campos `rarity`** añadidos a `PlayerIcons.DEFS`, `PlayerBorders.DEFS`,
  `Boards.DEFS`, `Themes.DEFS` y `ACH` (expuesto en `Meta.achievements()`).
- **`COLLECTION_CATS`** + `COLLECTION_CAT_ORDER`: config declarativa por
  categoría (acento, emblema, claves i18n, `showNames`, `equippable`, `banner`).
  Añadir una categoría nueva = añadir una entrada aquí + un caso en `collItems()`
  y `collEquip()`.
- **`collItems(catId)`**: normaliza cualquier categoría a
  `{id,name,rarity,owned,equipped,index,art}`.
- **`buildCollections()`**: pinta el hub (5 pills + 5 tarjetas). Se sigue
  llamando desde `refreshStart()`.
- **`openCollectionDetail(catId)` / `buildCollectionDetail()`**: pantalla de
  detalle (progreso + 4 mini-tarjetas de rareza + filtros + orden + secciones
  por rareza + banner). Estado en `collectionDetailCat/Filter/Sort`.
- **`refreshColDots()`**: puntos de paginación por fila (según scroll real).
- **Equipar** reutiliza `Meta.equipAvatarIcon/Border`, `equipBoard`,
  `equip('theme',id)` vía `collEquip()`.

Notas de fidelidad:
- El detalle usa cuerpo con lavado oscuro (`view-collection-detail > .view-body`)
  para enmascarar los glows ambientales del `body` y clavar el fondo navy plano
  del mockup. El hub conserva el panel con borde (como la maqueta 1).
- El equipado siempre encabeza su sección (`sortCollItems`).
- Los contadores reflejan el **inventario real** (10 iconos, 10 bordes, 11
  tableros, 6 temas, 11 logros), no los números inventados de la maqueta.

## 6. Verificación

- Verificado con Playwright (Chromium) en 412×892: hub, detalle de
  Iconos/Bordes/Tableros, filtro por rareza y banner CTA, en ES y EN.
  Coincide con las 3 capturas al ~100% en estructura, color y componentes.
- `node --test 'tests/*.test.js'`: 265 pass / 2 fail. Los 2 fallos
  (`board themes V4 …`) son **preexistentes** (fallan también en la base, sin
  relación con este cambio). Se actualizó `tests/store-xp-boosters.test.js` (test
  "enrutan recursos y estilos") para reflejar la nueva navegación por tarjetas
  (`data-col-open`) + CTA `open-style-shop` del detalle.
- `eslint`: 0 errores (5 warnings preexistentes de vars sin usar ajenas).

## 7. Pendiente / posibles mejoras futuras

- El arte de iconos/bordes es el inventario real (temática espacial); el mockup
  fabrica ~36 iconos/28 bordes con arte 3D que no existe como asset. Si se desea
  ampliar el catálogo, añadir PNGs a `img/player-icons/` · `img/player-borders/`
  y sus entradas en `PlayerIcons/PlayerBorders.DEFS` con su `rarity`.
- Orden "Más reciente": no se registra fecha de adquisición real; se aproxima con
  equipado→propietario→índice inverso. Si en el futuro se guarda timestamp de
  desbloqueo, usarlo en `sortCollItems`.

## 8. Registro de progreso

- 2026-07-20: F0 completada. Exploración y decisión de alcance documentadas.
- 2026-07-20: F1–F6 completadas. Sistema de rareza + rediseño de Colecciones
  implementado, verificado con capturas y test/lint. Versión 2.11.0.
