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
   módulo `Icons`, formas SVG × colores). Hoy sólo existe **un set** → sólo
   habrá **un pack** ("Cosmos") por ahora; el sistema queda preparado para
   añadir más.
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
- **`IconPacks`** (nuevo módulo, tras `Icons`):
  - `DEFAULT: 'cosmos'`, `DEFS: { cosmos: { name, rarity:'common', cost:0, descKey } }`,
    `order: ['cosmos']`.
  - `iconsOf(id)`: ids de icono representativos del pack (uno por forma → 16).
  - `svg(packId, iconId)`: render de un icono del pack (hoy delega en `Icons.svg`).
  - `previewHtml(id, n)`: collage de n iconos (emblema/portada del pack).
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

## 5. Cómo quedó (referencia de mantenimiento)

- **`IconPacks`** (game.js, tras `Icons`): `DEFAULT`, `DEFS`, `order`, `iconsOf`,
  `svg`, `previewHtml`. Añadir un pack nuevo = entrada en `DEFS`/`order` (con su
  `rarity`/`cost`) y, si trae figuras propias, ajustar `iconsOf`/`svg`.
- **Meta**: `ownsIconPack`, `equippedIconPack`, `equipIconPack`, `buyIconPack`,
  `iconPackOwnedCount`; estado en `cosmetics.iconPack` / `cosmetics.iconPacks`.
- **Colecciones**: categoría `iconpacks` en `COLLECTION_CATS` (con `packModal:true`
  y `emblemHtml`); `collItems('iconpacks')`, `collEquip`. Tile de pack → abre
  `openIconPackModal(id, { onChange })`.
- **Modal de pack**: `openIconPackModal` / `fillIconPackModal` sobre
  `#modal-icon-pack` (index.html). Muestra las 16 figuras + equipar/comprar.
- **Tienda**: sección `shop_iconpacks` en `buildShop`; `data-ipack-view/eq/buy`.
- **Renombrado**: `col_cat_icons` ahora = packs de tablero; `col_cat_avatars`
  (nuevo) = avatares de perfil. i18n de perfil/tienda/cofres actualizado.

### Fidelidad / decisiones
- Un solo pack real (`cosmos`) porque sólo existe un set de figuras (`Icons`).
  El sistema es extensible: al añadir packs, cada uno puede traer su propio
  render sin tocar el resto.
- El pack por defecto es gratuito y viene equipado; la lógica de compra
  (confirmación en dos toques) queda lista para packs de pago futuros.
- Equipar un pack persiste en Meta; el swap del renderer del tablero por pack se
  hará cuando exista un segundo pack (hoy `svg()` delega en `Icons`).

## 6. Verificación

- `node --test`: 265 pass / 2 fail. Los 2 fallos (`board themes V4 …`) son
  **preexistentes** (fallan en la base). Se actualizó
  `tests/hub-views-redesign.test.js` para incluir `modal-icon-pack` en la lista
  blanca de diálogos transitorios permitidos.
- `eslint`: 0 errores.
- Playwright (ES, 412×892): hub con 6 categorías (Iconos rosa con collage,
  Avatares turquesa con robot), detalle de Iconos, modal con las 16 figuras y
  sección "Iconos de tablero" en la tienda. Todo verificado.

## 7. Registro

- 2026-07-20: F0. Documento inicial y decisiones de diseño.
- 2026-07-20: F1–F5. Sistema de packs de iconos + renombrado a Avatares
  completado y verificado. Versión 2.12.0.
