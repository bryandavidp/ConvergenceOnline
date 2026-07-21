# Sistema de packs de iconos de tablero + renombrado Iconos→Avatares

> Documento de trabajo. Continúa el trabajo de `docs/RARITY_COLLECTIONS_PLAN.md`
> (sistema de rareza + rediseño de Colecciones). Rama:
> `claude/rarity-system-icons-boards-x6pi4t`.

## 1. Encargo

1. **Renombrar "Iconos" → "Avatares"** en todo lo visible: la categoría de
   Colecciones y la sección de tienda que hoy muestran los PNG de perfil
   (`PlayerIcons`: Nova, Cometa, …) son en realidad **avatares**. Los IDs
   internos (`avatarIcon`, `avatarIcons`, `PlayerIcons`) NO se tocan.
2. **Implementar el sistema de "Iconos"** = **packs de iconos de tablero**
   comprables. Los "iconos" son las figuras que aparecen en el tablero (el
   módulo `Icons`, formas SVG × colores). El sistema incluye **Cosmos**,
   **Naturaleza Básico**, **Naturaleza Avanzado**, **Pack Neón** y **Joyas Prisma**, y queda
   preparado para añadir más.
3. El pack de iconos tiene **su sección en la Tienda** y **su panel en
   Colecciones**.
4. Se debe **poder visualizar todos los iconos de un pack**, tanto en la tienda
   como en la colección del usuario.

## 2. Hallazgos del código

- **`Icons`** (game.js ~línea 194): IIFE que genera las figuras del tablero.
  `CATALOG` (48 ids `forma_color`, 16 formas × 3 ciclos de color), `svg(id)`,
  `name(id)`, `colorOf(id)`. **Éste es el único "set" de iconos existente.**
  Las 16 formas: circle, square, triangle, star, heart, diamond, hexagon, plus,
  droplet, ring, pentagon, moon, sun, flower, clover, spiral.
- **`PlayerIcons`** (~línea 3131): 10 avatares PNG de perfil (`img/player-icons/`).
  Equip/propiedad en `Meta.avatarIcon/avatarIcons`. → categoría **Avatares**.
- **`Boards`** (~línea 4700): modelo de referencia para cosméticos comprables
  con propiedad/equipado (`Meta.ownsBoard/equipBoard/buyBoard`). El nuevo
  `IconPacks` lo imita.
- **`buildShop()`** (~línea 11470): tienda de personalización (avatares, bordes,
  tableros, temas). Aquí se añade la sección **Iconos** (packs).
- **Colecciones** (game.js, buscar `Colecciones (rareza)`): `COLLECTION_CATS`,
  `collItems()`, `collEquip()`, `buildCollectionDetail()`, `collTileHtml()`.
- **`Modal`** (~línea 2411): `Modal.open(id)` / `Modal.close()` sobre un
  `.modal` estático de `index.html`. Se añade `#modal-icon-pack`.

## 3. Diseño

### 3.1 Modelo de datos
- **`IconPacks`** (módulo tras `Icons`):
  - `DEFAULT: 'cosmos'`; `DEFS` registra los cinco packs y `order` mantiene su
    orden visible por precio.
  - `CATALOGS`: catálogo de 8 figuras para Naturaleza Básico y Pack Neón, y de
    10 para Naturaleza Avanzado y Joyas Prisma.
  - `iconsOf(id)`: 16 ids representativos para Cosmos o tantos como artes
    declare el catálogo raster.
  - `svg(packId, iconId)`: conserva SVG para Cosmos y devuelve el PNG RGBA
    correspondiente para cualquier pack raster.
  - `iconName`/`colorOf`: alinean accesibilidad y FX con el pack equipado.
  - `previewHtml(id, n)`: usa la miniatura dedicada del pack cuando existe y,
    como fallback, un collage de n iconos (emblema/portada del pack).
- **`Meta.cosmetics`** += `iconPack` (equipado, def `cosmos`) y `iconPacks`
  (mapa de propiedad, def `{cosmos:1}`). Migración retrocompatible.
  Funciones espejo de tableros: `ownsIconPack`, `equippedIconPack`,
  `equipIconPack`, `buyIconPack`, `iconPackOwnedCount`.

### 3.2 Colecciones
- Categoría `icons` **renombrada a `avatars`** (etiqueta "Avatares").
- Nueva categoría `iconpacks` (etiqueta "Iconos"): tiles = packs, agrupados por
  rareza como el resto. `emblemHtml` = collage de figuras (no hay PNG). Tocar un
  pack abre el **modal de contenido del pack** (`packModal:true`) en vez de
  equipar directamente.
- Orden del hub (6): Tableros, Temas, Iconos, Avatares, Bordes, Logros.

### 3.3 Modal de contenido del pack (reutilizable)
- `openIconPackModal(packId, { onChange })`: nombre + chip de rareza + rejilla
  con **todas** las figuras del pack + botón Equipar/Equipado/Comprar + cerrar.
  Se usa desde la tienda y desde Colecciones. Al equipar/comprar refresca la
  vista que lo abrió.

### 3.4 Tienda
- Nueva sección "Iconos" en `buildShop`: tarjetas de pack (collage + nombre +
  rareza) con "Ver iconos" (abre el modal) y Equipar/Comprar.
- Renombrado de etiquetas de avatares (`shop_player_icons`, `profile_icons_title`,
  `chest_reward_avatar_icon`, `shop_player_hint`).

## 4. Estado / progreso

- [x] F0. Exploración + este documento.
- [x] F1. `IconPacks` + Meta (`iconPack`/`iconPacks`, owns/equip/buy/count + migración).
- [x] F2. Renombrado Iconos→Avatares (i18n perfil/tienda/cofres + categoría `icons`→`avatars`).
- [x] F3. Categoría `iconpacks` (tiles de pack, `emblemHtml` collage) + modal `#modal-icon-pack`.
- [x] F4. Sección "Iconos de tablero" en la tienda + wiring (ver/equipar/comprar).
- [x] F5. CSS + bump 2.12.0 + tests + lint + verificación visual (Playwright).
- [x] F6. Joyas Prisma: 10 artes PNG + miniatura de pack, compra/equipado,
  renderer real del tablero, FX, accesibilidad, precache offline, pruebas y bump
  2.13.0.
- [x] F7. Naturaleza Básico y Avanzado: 18 artes PNG + 2 miniaturas, catálogos
  raster genéricos, precios 800/1600, precache, pruebas y bump 2.14.0.
- [x] F8. Pack Neón: 8 artes PNG transparentes + miniatura, precio 1200,
  catálogo bilingüe, precache, pruebas y bump 2.15.0.

## 5. Cómo quedó (referencia de mantenimiento)

- **`IconPacks`** (game.js, tras `Icons`): `DEFAULT`, `DEFS`, `order`,
  `CATALOGS`, `iconsOf`, `svg`, `iconName`, `colorOf`, `previewHtml`.
  Añadir un pack nuevo = entrada en `DEFS`/`order` (con `rarity`/`cost`) y su
  catálogo/render.
- **Meta**: `ownsIconPack`, `equippedIconPack`, `equipIconPack`, `buyIconPack`,
  `iconPackOwnedCount`; estado en `cosmetics.iconPack` / `cosmetics.iconPacks`.
- **Colecciones**: categoría `iconpacks` en `COLLECTION_CATS` (con `packModal:true`
  y `emblemHtml`); `collItems('iconpacks')`, `collEquip`. Tile de pack → abre
  `openIconPackModal(id, { onChange })`.
- **Modal de pack**: `openIconPackModal` / `fillIconPackModal` sobre
  `#modal-icon-pack` (index.html). Muestra todas las figuras reales de cada pack
  (16 en Cosmos, 8 en Naturaleza Básico y Pack Neón, y 10 en los otros dos) +
  equipar/comprar.
- **Tienda**: sección `shop_iconpacks` en `buildShop`; `data-ipack-view/eq/buy`.
- **Renombrado**: `col_cat_icons` ahora = packs de tablero; `col_cat_avatars`
  (nuevo) = avatares de perfil. i18n de perfil/tienda/cofres actualizado.

### Fidelidad / decisiones
- Cosmos sigue siendo gratuito y equipado por defecto. Naturaleza Básico es
  raro y cuesta 800 monedas; Naturaleza Avanzado es épico y cuesta 1.600;
  Pack Neón es épico y cuesta 1.200; Joyas Prisma es legendario y cuesta 1.800.
  Todos usan confirmación en dos toques.
- Los ids lógicos no cambian al equipar un pack: se preservan reglas, dificultad
  y partidas guardadas. La ventana máxima de ocho fichas se mapea sobre diez
  joyas, por lo que no hay duplicados visuales dentro de un nivel.
- Los 36 iconos raster y sus cuatro miniaturas cuadradas son RGBA 512×512 y se
  precachean para uso offline. La misma miniatura identifica cada pack en
  Tienda, Colecciones y el modal de detalle.

## 6. Verificación

- Suite global: 274 pass / 2 fail. Los 2 fallos (`board themes V4 …`) son
  **preexistentes** (fallan en la base). La selección de 65 pruebas de motor,
  convergencia, Inicio y packs pasa completa.
- `node --check game.js` y `node --check sw.js`: sin errores de sintaxis.
- Navegador integrado (ES): cinco tarjetas en Tienda y Colecciones; modales de
  Naturaleza y Neón con 8/10 iconos, precios 800/1200/1600, dimensiones
  naturales 512×512 y cero errores de consola. Todo verificado.

## 7. Registro

- 2026-07-20: F0. Documento inicial y decisiones de diseño.
- 2026-07-20: F1–F5. Sistema de packs de iconos + renombrado a Avatares
  completado y verificado. Versión 2.12.0.
- 2026-07-21: F6. Pack Joyas Prisma y su miniatura generados e integrados de
  extremo a extremo. Versión 2.13.0.
- 2026-07-21: F7. Packs Naturaleza Básico y Naturaleza Avanzado generados e
  integrados de extremo a extremo. Versión 2.14.0.
- 2026-07-21: F8. Pack Neón generado e integrado de extremo a extremo. Versión
  2.15.0.
