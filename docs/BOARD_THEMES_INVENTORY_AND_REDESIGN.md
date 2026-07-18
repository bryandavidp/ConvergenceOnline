# Sistema de temas de tablero — inventario y propuesta de rediseño

> Estado auditado: `v2.6.52`, 16 de julio de 2026.  
> Alcance: estado real del *worktree* local, incluidos los cambios previos que ya estaban presentes.  
> Decisión de producto vinculante: **todos los tableros son cosméticos puros**.

## 1. Resumen ejecutivo

Convergence ya tiene dos sistemas de personalización diferentes:

1. **Temas globales de interfaz**: seis paletas que modifican variables de `:root` y recolorean la aplicación completa.
2. **Temas o skins de tablero**: once diseños que modifican variables locales de `.board-wrap` y de las celdas.

Los diez tableros de la imagen de referencia ya existen con los mismos conceptos, IDs y precios: Clásico, Madera, Hielo, Lava, Cristal, Mágico, Futurista, Dorado, Bosque y Cósmico. El juego añade un undécimo, Jardín Zen, desbloqueable por progreso.

La arquitectura actual ya separa correctamente el aspecto del tablero de sus reglas. La propuesta no debe reemplazar esa frontera: debe **formalizarla, hacerla validable y enriquecer la dirección artística**.

La referencia se interpreta así:

- Sí: material, marco, celdas, color, ambiente, ornamentos y efectos visuales diferenciados.
- No: ventajas, desventajas, bonus, spawns, probabilidades, portales, duración, puntuación o cambios de velocidad.
- No: copiar la topología aparente de 5×5 de las tarjetas; el tablero real sigue siendo 8×8.
- No: ampliar el marco fuera del rectángulo actual ni desplazar el tablero para hacer sitio a decoración.

Resultado recomendado:

- Mantener `data-board`, los IDs, precios, propiedad y equipado actuales.
- Convertir `Boards` en una fachada compatible sobre un `BoardThemeCatalog` validado.
- Declarar un contrato de tokens visuales permitido y una lista explícita de propiedades prohibidas.
- Sustituir las previews aproximadas por previews 8×8 reales y reversibles.
- Añadir assets decorativos sin rejilla ni fichas horneadas, siempre detrás de la interacción.
- Congelar tamaño y posición mediante pruebas automáticas de geometría.
- Tratar las once skins como una matriz visual frente a seis temas globales, todos los modos, tiles y estados.

## 2. Fuentes de verdad consultadas

| Área | Fuente principal |
|---|---|
| Reglas y tamaño lógico | `game.js:89-120`, `game.js:1071`, `game.js:1341-1445` |
| DOM del tablero | `index.html:269-386` |
| Geometría y capas | `styles.css:884-1104`, `styles.css:1684-1714`, `styles.css:1977-1985`, `styles.css:2231-2277`, `styles.css:5251-5293` |
| Persistencia | `game.js:2602-2649`, `game.js:2844-2903` |
| Temas globales | `game.js:3281-3309` |
| Skins de tablero | `game.js:3311-3338`, `styles.css:2857-3043` |
| Tienda y preview | `game.js:8309-8377`, `styles.css:2793-2855` |
| Contrato de producto | `docs/REQUIREMENTS.md:43-46` |
| Esquema/economía | `docs/MIGRATION_SPEC.md:233-304` |
| Rendimiento | `docs/QA_PERF_PLAN.md`, `tests/qp2-perf.test.js` |
| Design system | `docs/DESIGN_SYSTEM.md:253-288` |

## 3. Terminología recomendada

El código usa “theme”, “skin”, “board” y “cosmetics” para conceptos que se solapan. Para evitar futuras colisiones:

| Nombre recomendado | Nombre actual | Alcance |
|---|---|---|
| **Tema de interfaz** | `Themes` + `Cosmetics` | Paleta global de toda la aplicación |
| **Tema de tablero** | `Boards`, “skin de tablero” | Apariencia del tablero jugable |
| **Tema activo** | `boards.equipped` | Tema de tablero persistido y equipado |
| **Preview temporal** | No existe para tableros | Tema aplicado sin persistencia |
| **Estado de gameplay** | Clases de celdas/wrapper | Hint, peligro, tile, jefe, Fever, etc.; nunca parte de un tema |

En UI se puede seguir mostrando “Tableros” porque es comprensible para el jugador. En arquitectura conviene usar `BoardTheme*` para distinguirlo de los temas globales.

---

## 4. Inventario del sistema actual

### 4.1 Arquitectura general

La aplicación es HTML, CSS y JavaScript vanilla, sin framework, bundler ni `package.json`. `game.js` es un único IIFE que expone objetos internos con `?dev`.

Objetos relevantes:

- `Meta`: store persistente cerrado sobre un objeto mutable `m`.
- `Themes`: catálogo de paletas globales.
- `Cosmetics`: aplica o previsualiza esas paletas sobre `<html>`.
- `Boards`: catálogo y aplicación del tema de tablero.
- `State.board`: matriz de gameplay, completamente independiente del tema.
- `Render`: crea y actualiza el DOM real de las celdas.
- `FX`: efectos y clones que dependen de la geometría real del tablero.

No existen tipos compilados, schema runtime, manifest de assets ni validación de consistencia entre catálogo y CSS.

### 4.2 Catálogo actual de tableros

Definido en `game.js:3315-3330`.

| ID persistente | Nombre actual | Coste | Obtención | Coincide con la referencia |
|---|---|---:|---|---|
| `classic` | Tablero Clásico | 0 | Siempre poseído | Sí |
| `madera` | Tablero de Madera | 500 | Compra o cofre | Sí |
| `hielo` | Tablero de Hielo | 800 | Compra o cofre | Sí |
| `lava` | Tablero de Lava | 1 200 | Compra o cofre | Sí |
| `cristal` | Tablero de Cristal | 1 500 | Compra o cofre | Sí |
| `magico` | Tablero Mágico | 2 000 | Compra o cofre | Sí |
| `futurista` | Tablero Futurista | 2 500 | Compra o cofre | Sí |
| `dorado` | Tablero Dorado | 3 000 | Compra o cofre | Sí |
| `bosque` | Tablero del Bosque | 1 800 | Compra o cofre | Sí |
| `cosmico` | Tablero Cósmico | 2 200 | Compra o cofre | Sí |
| `jardin` | Jardín Zen | 0 | Exclusivo: 50 flores Zen | No; es propio del juego |

`jardin` está marcado como `exclusive: true`: no entra en compra ni en el pool de cofres. Se concede mediante progreso Zen.

Los campos actuales de cada definición son:

```js
{
  name: 'Tablero de Madera',
  cost: 500,
  sw: 'linear-gradient(...)',
  chars: ['Vetas cálidas de madera', 'Marco artesanal'],
  exclusive: false // solo aparece en jardin
}
```

`sw` no tiene consumidor actual. `name` y `chars` están escritos en español dentro del catálogo.

### 4.3 Catálogo actual de temas globales

Definido en `game.js:3285-3297`.

| ID | Nombre | Coste | Variables modificadas |
|---|---|---:|---|
| `default` | Cosmos | 0 | Ninguna; usa la base CSS |
| `neon` | Neón | 150 | 9 variables |
| `sunset` | Ocaso | 200 | 9 variables |
| `forest` | Bosque | 200 | 9 variables |
| `aurora` | Aurora | 300 | 9 variables |
| `mono` | Eclipse | 250 | 9 variables |

Variables:

```text
--bg-0 --bg-1 --bg-2 --panel --panel-2
--accent --accent-2 --level --score
```

Estos temas son ortogonales a los tableros. Cambiar un tablero no debe equipar ni alterar un tema global.

### 4.4 Persistencia y migración actual

Todo se guarda en `localStorage.cv_meta`, esquema `_v: 3`.

```js
boards: {
  owned: { classic: 1, madera: 1 },
  equipped: 'madera'
},
cosmetics: {
  owned: { neon: '2026-07-16' },
  theme: 'default',
  skin: 'default',
  fx: 'default'
}
```

Hechos relevantes:

- `boards.owned` usa `1`; `cosmetics.owned` usa fecha ISO.
- `classic` se fuerza como poseído al cargar.
- Si el equipado falta o no está poseído, se vuelve a `classic`.
- El tema de tablero es global, no depende del modo.
- `RunSave` no guarda un tablero: una partida reanudada usa el que esté equipado en ese momento.
- `cosmetics.skin` y `cosmetics.fx` están reservados pero no tienen consumidor.
- Los IDs son parte del save real; no se deben renombrar sin alias permanente.

API actual de `Meta`:

```text
grantBoard(id)
boardsOwned()
ownsBoard(id)
equippedBoard()
buyBoard(id, cost)
equipBoard(id)
```

### 4.5 Flujo de aplicación

```text
localStorage.cv_meta
        │
        ▼
      Meta
        │ equippedBoard()
        ▼
 Boards.apply(id)
        │
        ├── data-board en #screen-game
        ├── data-board en .board-wrap   ← consumidor CSS real
        └── data-board en #board
```

Secuencia:

1. `Meta` carga y migra el save al evaluar `game.js`.
2. `init()` construye las 64 celdas.
3. `Cosmetics.apply()` aplica la paleta global.
4. `Boards.apply()` aplica el tablero equipado.
5. Al iniciar cualquier partida se repite `Boards.apply()`.
6. Comprar un tablero lo guarda, equipa y reaplica.
7. Un cofre puede concederlo y ofrecer una acción para equipar.

No existe ninguna llamada desde `Boards` a `Engine`, `Rules`, RNG, puntuación, timers, spawns, dificultad, oleadas o power-ups.

### 4.6 Contrato CSS actual

La base vive en `.board-wrap`, `styles.css:1017-1046`.

Tokens efectivos:

```css
--board-frame
--board-pattern
--board-pattern-opacity
--board-pattern-size
--board-bg-animation
--board-border
--board-trim
--board-glow
--cell-empty-bg
--cell-empty-border
--cell-filled-bg
--cell-filled-border
--cell-hover-bg
--clear-animation
--clear-burst
--clear-burst-animation
```

Capas actuales:

| Capa | Implementación | Función |
|---|---|---|
| Marco/base | Fondo de `.board-wrap` | Material general |
| Ambiente | `.board-wrap::before` | Patrón animado |
| Trim | `.board-wrap::after` | Borde interior |
| Grid | `#board` | Geometría 8×8 |
| Superficie | `.cell` | Vacía/ocupada/hover |
| Limpieza auxiliar | `.cell.clear .glyph` y `::after` | Salida y burst temáticos |

Las animaciones ambientales actuales solo usan `transform` y `opacity`. Es una decisión deliberada de rendimiento: animar `background-position` volvió a rasterizar todo el tablero cada frame en móvil.

Las convergencias normales animan clones en `FX`, no `.cell.clear`; por eso la personalidad temática de los clear FX se aprecia principalmente en limpiezas auxiliares, bombas y objetos.

### 4.7 Geometría inmutable

DOM canónico:

```text
#screen-game
└─ .board-area
   └─ .board-column
      ├─ .board-shell
      │  └─ .board-wrap
      │     ├─ #board.board
      │     ├─ #popups.popups
      │     ├─ #fever.fever
      │     └─ #rank.rank
      └─ .occ
```

Reglas:

- `Config.SIZE = 8`.
- `Render.buildBoard()` crea `State.size²` botones y publica `--size`.
- `.screen-game` usa tres bandas verticales y el tablero ocupa siempre la banda central.
- `.board-shell` posee ancho, alto y `aspect-ratio: 1 / 1`.
- `.board-wrap` ocupa el 100 % del shell.
- `#board` usa `repeat(var(--size, 8))` en filas y columnas.
- El gap se calcula con viewport, pero no depende del tema.
- Supervivencia usa una región flexible propia; el shell se reduce solo cuando falta altura, nunca por el tema.

Mediciones verificadas en navegador sobre el juego real, modo Zen:

| Viewport | `.board-wrap` | Posición relativa a pantalla | `#board` interior | `.occ` |
|---|---:|---:|---:|---:|
| 390×844 | 382,19×382,19 | x 3,91 · y 260,52 | 364,19×364,19 | y 650,70 |
| 360×640 | 352,80×352,80 | x 3,61 · y 155,31 | 334,80×334,80 | y 516,11 |
| 854×1280 | 640×640 | x 107 · y 364 | 618×618 | y 1 012 |
| 1280×720 | 604,80×604,80 | x 337,59 · y 49,11 | 582,80×582,80 | y 661,91 |

La medida de 390×844 se usa como guardarraíl visible del mockup. Los once cambios arrojan `Δ 0,00 px` en x, y, ancho y alto relativos al viewport del dispositivo.

### 4.8 Dependencias funcionales de la geometría

No se puede “hornear” el tablero dentro de una imagen. La grid real contiene botones y estado dinámico.

Dependen del rectángulo real y del gap calculado:

- Input de puntero y navegación por teclado.
- Centro de cada vuelo de convergencia.
- Clones de celdas completas.
- Popups de puntuación.
- Ondas, bursts y partículas.
- Combo, Fever y rango.
- Objetivos de boosters.
- Eventos de jefe y Supervivencia.

Cambiar padding, gap, DOM o tamaño desalinearía efectos e interacción aunque visualmente el tablero pareciera correcto.

### 4.9 Estados y tiles que todo tema debe soportar

Estados de celda relevantes:

```text
empty · has-icon · hover · focus-visible · hint · spawn · clear · miss
penalty · threaded · aim-target · tide-warn · tide-fill · lock-stamp
surv-meteor · life-cleared · bomb-cleared · line-cleared · wild-cleared
```

Tiles registrados:

```text
rock · locked · frozen · crystal · chains · web · barrier · mud
bonus · portal · magicbox · bomb · slowdown · timecap · boss · cage
```

Estados del wrapper:

```text
shake · impact-soft · impact-mid · impact-heavy · time-pressure
surv-penalty · surv-quake · surv-rain · surv-tide · surv-lockdown
surv-damage · surv-frost · life-blast · boss-reward · board-clear-bonus
boost-* · fever-* · warn · danger
```

La semántica de gameplay siempre debe ganar al tema. Focus, hint, peligro, tile, jefe y objetivo de booster no se recolorean hasta perder significado.

### 4.10 Tienda y previsualización actuales

`buildShop()` genera:

- Tableros primero, en grid de dos columnas.
- Temas globales después, como filas.
- Estados comprado, equipado, comprable y exclusivo.
- Compra confirmada con dos toques durante tres segundos.
- Compra de tablero con autoequipado.
- Equipado desde recompensa de cofre.

Limitaciones:

- Las previews de tablero no son WYSIWYG.
- `.board-thumb::after` dibuja solo tres bloques, no una grid 8×8.
- No muestra iconos, tiles, foco, peligro ni FX.
- No existe preview temporal del tablero real.
- Los temas globales sí tienen preview en vivo, pero los tableros no.
- Todas las miniaturas pueden mantener su ambiente animado simultáneamente.

### 4.11 Assets disponibles

Reutilizables:

- `img/ui/`: 55 PNG de UI; incluye moneda, fuego, cristal, gema, hoja, planeta, estrella, teletransportador, candado y bomba.
- `img/icons-v2/`: 815 SVG monocromos tintables por CSS mask.
- Iconos temáticos ya presentes: `wood`, `snowflake`, `snowy`, `fire`, `volcano`, `diamond`, `crystal-ball`, `microchip`, `forest`, `tree`, `flower`, `clover`, `planet`, `meteor`, etc.
- Iconos de las figuras del tablero: SVG generado en runtime; 16 formas y 12 colores.

No aptos como skin jugable:

- `img/ui-generated/home/classic-board.png`: ilustración promocional en perspectiva, no grid frontal interactiva.
- `img/icons/OtherTiles/`: texturas pixel-art útiles para un estilo retro, pero no para igualar la dirección material/pintada de la referencia.

Faltantes productivos:

- Marcos frontales por material.
- Ambiente/textura sin perspectiva y sin rejilla horneada.
- Ornamentación de borde contenida.
- Superficies vacía/ocupada coherentes.
- Thumbnails reales de tienda.
- Assets estáticos/reducidos para accesibilidad y governor de rendimiento.

Para el mockup se creó un sprite SVG original de ornamentos de las once identidades. Se coloca **debajo de la grid**, nunca encima de iconos o interacción.

### 4.12 Accesibilidad y rendimiento actuales

Contratos que se conservan:

- `role="grid"` y 64 botones `role="gridcell"`.
- Tabindex itinerante y flechas de teclado.
- Focus visible.
- `aria-live` para feedback.
- `prefers-reduced-motion`.
- Ajuste propio `body.reduced-fx`.
- Governor `body.perf-1`.
- `contain` en tablero y celdas.
- Sin transición de fondos durante cascadas.

Riesgos actuales:

- Las etiquetas de celda siguen en español incluso con idioma inglés.
- Un tile sin icono puede anunciarse como “vacía”.
- No existen `aria-rowcount`, `aria-colcount`, `aria-rowindex` ni `aria-colindex`.
- En pantallas pequeñas una celda puede quedar por debajo de 44 px.
- El focus usa acento global y debe contrastar sobre once materiales.
- Muchos móviles DPR ≥3 arrancan en `perf-1`; el tema debe seguir leyendo bien estático.

### 4.13 PWA y offline

Los temas actuales son CSS, por lo que no añaden fetches. Si se introducen assets:

- Deben ser same-origin.
- El equipado debe precargarse.
- Las miniaturas se cargan bajo demanda.
- Los assets deben añadirse al precache best-effort de `sw.js`.
- Un fetch runtime después de la primera visualización no garantiza que todos los tableros estén disponibles offline.
- Cualquier alta implica sincronizar `VERSION`, query strings de `index.html` y `CACHE` de `sw.js`.

---

## 5. Problemas y deuda confirmados

| Prioridad | Problema | Impacto |
|---|---|---|
| P0 | No hay prueba de invariancia geométrica entre temas | Un nuevo skin podría mover o redimensionar el tablero sin detectar la regresión |
| P0 | La referencia mezcla cosmético y pay-to-win | Contradice RF-40 y rompería compatibilidad/balance |
| P0 | Catálogo JS y estilos CSS están desacoplados | Es posible dar de alta un tema incompleto |
| P0 | No hay validador ni allowlist de tokens | Un tema podría introducir propiedades de layout o gameplay |
| P1 | `jardin` no redefine el contrato completo | Hereda celdas y clear FX base; menor calidad y previsibilidad |
| P1 | Preview de tres bloques no representa el tablero real | Compra/equipado con expectativa visual incorrecta |
| P1 | No hay saneamiento canónico de IDs de catálogo | Un ID persistido desconocido puede sobrevivir y caer a apariencia base |
| P1 | Nombres y rasgos están hardcodeados en español | Incumple la UI bilingüe |
| P1 | No hay test continuo de contraste | 12 colores × 11 temas × texturas/gradientes |
| P1 | Assets futuros no tienen manifest offline | Un cosmético comprado puede faltar sin conexión |
| P2 | `Cosmetics._set(default)` no restaura siempre `meta theme-color` | El navegador conserva el color del tema anterior |
| P2 | `sw` de `Boards.DEFS` no se usa | Metadato muerto |
| P2 | `cosmetics.skin` y `cosmetics.fx` no se usan | Namespace ambiguo |
| P2 | Un nuevo tablero gratis no poseído generaría CTA de equipar que falla | La UI no concede el item antes de equiparlo |
| P2 | Tarjetas/filas de tema tienen semántica de botón imperfecta | Teclado y botones anidados |
| P2 | Documentación habla de 9 o 10 skins | El código real tiene 11 |

---

## 6. Traducción de la referencia a Convergence

### 6.1 Elementos que se adoptan

- Identidad material fuerte y reconocible a primera vista.
- Marco, superficie de celda y ambiente coordinados.
- Ornamentos temáticos en esquinas/borde.
- Efectos visuales específicos de aparición/limpieza.
- Catálogo visual completo con precio, estado y preview.
- Nombres claros y orden estable.

### 6.2 Elementos que no se adoptan

- “Las cadenas duran menos”, “más puntos”, “más portales”, “oleadas rápidas”, etc.
- Cualquier texto que sugiera ventaja competitiva.
- Rejilla 5×5 de la ilustración.
- Gemas/fichas horneadas en un bitmap.
- Decoración que sobresalga del rectángulo del tablero.
- Celdas más grandes/pequeñas por material.
- Un tema global de UI ligado automáticamente a un tablero.

### 6.3 Sustitución del bloque “Características”

En producto, las tarjetas deben mostrar **Rasgos visuales**:

```text
Madera
• Veta artesanal
• Hojas de borde
• Polvo de astilla

Lava
• Roca volcánica
• Grietas de magma
• Chispa ardiente
```

Así se conserva la riqueza narrativa sin prometer gameplay distinto.

---

## 7. Principios del rediseño

1. **Cosmético puro por construcción**, no solo por comentario.
2. **Geometría propiedad del núcleo**, nunca del tema.
3. **Un único registro validado** para catálogo, i18n, unlock, tokens y assets.
4. **Fallback clásico seguro** ante ID, asset o token inválido.
5. **Preview reversible** sin persistir hasta equipar.
6. **Estados semánticos por encima del arte**.
7. **Una sola animación ambiental viva en gameplay**.
8. **Experiencia estática completa** en reduced/perf.
9. **Offline-first** también para cosméticos.
10. **Compatibilidad incremental** con la API pública actual.

---

## 8. Arquitectura propuesta

### 8.1 Responsabilidades

```text
BoardThemeCatalog
  ├─ definiciones e IDs
  ├─ i18n
  ├─ unlock/precio
  ├─ tokens permitidos
  ├─ assets
  └─ presets de motion

BoardThemeRenderer
  ├─ resolve/fallback
  ├─ preload
  ├─ applyLive
  └─ applyTo(previewHost)

BoardThemePreview
  ├─ preview
  ├─ commit
  └─ revert

BoardThemeValidator
  ├─ schema
  ├─ allowlist/denylist
  ├─ i18n
  ├─ assets
  ├─ motion
  └─ cosmetic-only assertion

Boards (fachada legacy)
  ├─ DEFS
  ├─ order
  └─ apply(id)
```

En la arquitectura actual sin módulos, estos objetos pueden introducirse dentro del IIFE de `game.js`. No hace falta refactorizar toda la aplicación ni adoptar un framework.

### 8.2 Contrato de datos sugerido

```js
{
  schema: 1,
  id: 'madera',
  revision: 1,

  i18n: {
    nameKey: 'board_madera_name',
    descriptionKey: 'board_madera_desc',
    traitKeys: [
      'board_madera_trait_1',
      'board_madera_trait_2',
      'board_madera_trait_3'
    ]
  },

  icon: 'v2:4-nature/wood',

  unlock: {
    type: 'purchase',      // default | purchase | achievement
    currency: 'coins',
    amount: 500,
    achievement: null
  },

  assets: {
    rail: 'img/board-themes/madera/rail.svg',
    ambient: 'img/board-themes/madera/ambient.webp',
    cell: 'img/board-themes/madera/cell.webp',
    thumbnail: 'img/board-themes/madera/thumbnail.webp'
  },

  tokens: {
    '--board-frame': 'linear-gradient(...)',
    '--board-pattern': 'image-set(...)',
    '--board-pattern-opacity': '.72',
    '--board-border': 'rgba(...)',
    '--board-trim': 'rgba(...)',
    '--board-glow': 'rgba(...)',
    '--cell-empty-bg': '...',
    '--cell-empty-border': '...',
    '--cell-filled-bg': '...',
    '--cell-filled-border': '...',
    '--cell-hover-bg': '...',
    '--clear-burst': '...'
  },

  motion: {
    ambientPreset: 'wood',
    ambientDurationMs: 24000,
    clearPreset: 'wood',
    burstPreset: 'dust'
  },

  compatibility: {
    layout: 'board-v1',
    modes: 'all',
    minGrid: 6,
    maxGrid: 10
  },

  flags: {
    cosmeticOnly: true,
    exclusive: false
  }
}
```

El schema no admite funciones, callbacks ni referencias a `State`, `Rules`, `Engine`, RNG o economía de partida.

### 8.3 API sugerida

```js
BoardThemes.get(id)
BoardThemes.list()
BoardThemes.resolve(id)              // fallback a classic
BoardThemes.preload(id)
BoardThemes.applyLive(id)
BoardThemes.applyTo(host, id)        // thumbnail/modal
BoardThemes.preview(id)
BoardThemes.commitPreview()
BoardThemes.revertPreview()
BoardThemes.validate()
```

`applyLive(id)`:

1. Resuelve el ID o usa `classic`.
2. Precarga assets críticos o mantiene fallback CSS.
3. Escribe tokens en el host y `data-board`.
4. Mantiene temporalmente el atributo en los tres nodos actuales.
5. No reconstruye `#board`.
6. No toca `State`, RNG, timers, score, tiles ni celdas.

### 8.4 Fachada de compatibilidad

Durante la transición:

```js
const Boards = {
  get DEFS() { return BoardThemes.legacyDefs(); },
  get order() { return BoardThemes.ids(); },
  apply(id) { return BoardThemes.applyLive(id); }
};
```

Esto mantiene operativos tienda, cofres, arranque, tests y hook `?dev`.

---

## 9. Contrato visual

### 9.1 Tokens que se conservan

```text
Marco:
--board-frame --board-border --board-trim --board-glow

Ambiente:
--board-pattern --board-pattern-size --board-pattern-opacity
--board-bg-animation

Celdas:
--cell-empty-bg --cell-empty-border
--cell-filled-bg --cell-filled-border
--cell-hover-bg

Limpieza:
--clear-animation --clear-burst --clear-burst-animation
```

### 9.2 Tokens visuales nuevos permitidos

```text
--board-pattern-inset
--board-pattern-blend
--board-rail-image
--board-rail-opacity
--board-shadow
--board-fx-accent
--cell-radius
```

`--cell-radius` puede variar dentro de un rango porque no cambia la caja. El ancho de borde debe seguir incluido en `box-sizing` y no alterar la grid.

### 9.3 Propiedades y tokens prohibidos

Un tema no puede declarar:

```text
--board-size
width / height / min-* / max-*
top / right / bottom / left
margin / padding
display / position
grid-template-* / gap
aspect-ratio
z-index
overflow / contain
pointer-events
transform persistente del wrapper
font-size/padding de celda o glyph
```

Tampoco puede declarar campos como:

```text
scoreMultiplier · spawnMultiplier · timer · comboWindow · waveSpeed
portalChance · bonusChance · rules · modifiers · effects.gameplay
```

### 9.4 Capas propuestas

| Orden | Capa | Propiedad |
|---:|---|---|
| 0 | Marco/ambiente | Tema |
| 0 | Ornamento bajo grid | Tema, `pointer-events:none` |
| 1 | Grid y celdas | Núcleo + superficie temática |
| 2 | Trim interior | Tema |
| 3 | Fever | Gameplay |
| 5 | Popups y convergencia | Gameplay |
| 6 | Estado de jefe | Gameplay |
| 8 | Rank | Gameplay |
| 30 | Combo externo | Gameplay |

Los ornamentos no deben cubrir glyphs, tiles, foco o hit targets. Si se usa un rail visible, su centro tiene que ser transparente y terminar exactamente en la abertura jugable.

### 9.5 FX de convergencia

Para dar identidad a las convergencias normales sin cambiar reglas:

- `FX` puede leer `--board-fx-accent` como color terciario decorativo.
- El color real de la figura y los colores semánticos conservan prioridad.
- No cambia cantidad, trayectoria, duración lógica ni puntuación.
- Bajo `reduced-fx` se elimina la capa adicional sin perder información.

---

## 10. Dirección visual del catálogo

| ID | Dirección visual | Rasgos mostrables |
|---|---|---|
| `classic` | Azul real, esmalte, espacio | Casillas biseladas · Destello cian · Roca y vegetación |
| `madera` | Veta cálida, tallado | Veta artesanal · Hojas de borde · Polvo de astilla |
| `hielo` | Cristal polar, escarcha | Facetas heladas · Escarcha suave · Fragmentos luminosos |
| `lava` | Basalto y magma | Roca volcánica · Grietas de magma · Chispa ardiente |
| `cristal` | Prismas violetas | Celdas facetadas · Racimos de cristal · Burst prismático |
| `magico` | Runas y estrellas | Runas orbitales · Brillo arcano · Estela violeta |
| `futurista` | Circuitos cian | Trazas de circuito · Nodos neón · Barrido de escáner |
| `dorado` | Metal premium | Oro pulido · Esquinas ornamentales · Chispa premium |
| `bosque` | Musgo y piedra viva | Superficie musgosa · Enredaderas · Ráfaga vegetal |
| `cosmico` | Nebulosa y planetas | Starfield profundo · Planetas de borde · Implosión estelar |
| `jardin` | Musgo, pétalos, piedras | Pétalos flotantes · Bambú y musgo · Ritmo contemplativo |

Precios y desbloqueos se mantienen exactamente como hoy.

---

## 11. Propuesta de UX

### 11.1 Catálogo

Cada tarjeta incluye:

- Thumbnail real 8×8 estático.
- Nombre localizado.
- Tres rasgos visuales.
- Precio o condición de desbloqueo.
- Estado: equipado, poseído, bloqueado o exclusivo.
- CTA con nombre accesible completo.

No se muestran ventajas de gameplay.

### 11.2 Preview

Flujo recomendado:

```text
Abrir tienda
  → elegir tarjeta
  → preview temporal sobre tablero 8×8 de muestra
  → probar FX visual
  → comprar/equipar o cancelar
  → cerrar restaura el equipado si no se confirmó
```

La preview debe usar un host separado o aplicar/revertir tokens, nunca mutar el tablero de una partida activa sin confirmación.

### 11.3 Rendimiento de la tienda

- Thumbnails bloqueados: imagen estática.
- Tarjeta enfocada/hover: una preview animada como máximo.
- Modal de preview: una ambiental activa.
- `reduced-fx` y `perf-1`: todo estático.
- No ejecutar once loops ambientales a la vez.

### 11.4 Accesibilidad

- Tarjetas como botones nativos, sin botones anidados.
- `aria-pressed` para selección temporal.
- `aria-current` o texto “Equipado” para el persistido.
- Enter/Espacio y navegación lógica.
- Nombre, coste y estado dentro del nombre accesible.
- No depender solo del color para comprado/equipado.
- Preview y cambios anunciados con `aria-live` no intrusivo.

---

## 12. Assets productivos propuestos

```text
img/board-themes/
  classic/
    rail.svg
    ambient.webp
    cell.webp
    thumbnail.webp
  madera/
    ...
```

Contrato:

- `rail.svg`: transparente, sin grid ni figuras, solo borde/ornamento.
- `ambient.webp`: material frontal o tileable, sin perspectiva.
- `cell.webp`: textura pequeña compartida; no se anima por celda.
- `thumbnail.webp`: preview estática 8×8 optimizada.
- Fallback CSS completo si cualquier asset falla.

Presupuesto recomendado por tema:

| Asset | Medida orientativa | Presupuesto |
|---|---:|---:|
| Rail SVG/WebP | 768–1024 px master | ≤120 KB |
| Ambient WebP | 768–1024 px | ≤160 KB |
| Cell WebP | 128–256 px | ≤24 KB |
| Thumbnail WebP | 320–400 px | ≤45 KB |
| Total cargado en gameplay | — | ≤300 KB por tema |

No se deben copiar assets de la imagen de referencia. Los nuevos materiales han de ser originales.

---

## 13. Migración y compatibilidad

### 13.1 Persistencia

Migración aditiva sugerida a schema 4:

```js
boards: {
  v: 1,
  owned: { classic: 1, madera: 1 },
  equipped: 'madera'
}
```

Pasos:

1. Conservar `owned` y `equipped` sin reinterpretar compras.
2. Forzar `classic: 1`.
3. Mantener los once IDs actuales.
4. Resolver aliases antiguos si se añaden en el futuro.
5. Conservar IDs desconocidos dentro de `owned`, pero no equiparlos hasta volver al catálogo.
6. Si `equipped` es inválido o no poseído, usar `classic`.
7. No tocar `cosmetics.theme`.
8. No revocar Jardín Zen ni drops de cofres.

No es obligatorio subir schema si la primera fase mantiene exactamente la forma actual; puede introducirse cuando se añada versionado del catálogo/assets.

### 13.2 Compatibilidad de API

Se mantienen hasta completar la migración:

```text
Boards.DEFS
Boards.order
Boards.apply(id)
Meta.ownsBoard(id)
Meta.equippedBoard()
Meta.buyBoard(id, cost)
Meta.equipBoard(id)
```

### 13.3 Compatibilidad visual

- Mantener `data-board` en `.board-wrap` como contrato principal.
- Mantener temporalmente los atributos redundantes en `#screen-game` y `#board`.
- Mantener los tokens existentes como API pública.
- Completar `jardin`, no eliminar sus herencias de golpe sin regresión visual.
- No cambiar `Render.buildBoard()` ni la identidad de los 64 nodos al cambiar tema.

---

## 14. Validación automática propuesta

### 14.1 Validador de catálogo

Debe fallar si:

- Hay ID duplicado o inválido.
- `order` y el registro no coinciden.
- Falta `classic`.
- Falta una clave ES o EN.
- Un exclusivo tiene precio monetario.
- Falta un token obligatorio.
- Aparece un token de geometría prohibido.
- Aparece un campo de gameplay.
- Un asset sale de `img/board-themes/` o no existe.
- Una animación no está en el allowlist.
- Una ambiental infinita anima algo distinto de `transform`/`opacity`.
- Una one-shot supera el presupuesto.
- Falta variante reduced/perf.

### 14.2 Test de cosmetic-only

```js
const before = snapshotGameplay(State);
const cellsBefore = [...Render.cells];

BoardThemes.applyLive('lava');

assert.deepEqual(snapshotGameplay(State), before);
assert.deepEqual(Render.cells, cellsBefore);
assert.equal(document.querySelectorAll('#board > .cell').length, 64);
```

Debe incluir RNG, score, tiempos, combo, tiles, modo, dificultad, oleada y economía de run.

### 14.3 Test de geometría

Para cada viewport, modo y tema:

1. Capturar rectángulos de `screen`, `board-area`, `board-shell`, `board-wrap`, `#board`, `.occ` y las 64 celdas con `classic`.
2. Aplicar cada uno de los once temas.
3. Comparar x, y, ancho y alto.
4. Tolerancia máxima: 0,5 px; objetivo real: 0 px.

Viewports mínimos:

```text
320×568 · 360×640 · 375×667 · 390×844 · 430×932
768×1024 · 1024×768 · 1280×720 · landscape móvil
```

Modos:

```text
Clásico · Aventura · Contrarreloj · Supervivencia · Zen · Tutorial/Reto diario
```

### 14.4 Matriz visual

```text
11 temas de tablero
× 6 temas globales
× modos/biomas
× estados de ocupación
× 16 tiles
× normal/reduced/perf
```

No es necesario guardar cada combinación como golden. Sí conviene:

- Golden por tablero en `default`.
- Golden de estados semánticos críticos.
- Muestreo de los seis temas globales.
- Test programático de contraste para todas las superficies.

### 14.5 Rendimiento

- Máximo una ambiental viva en gameplay.
- Cero ambientales en `perf-1` y `reduced-fx`.
- No animar fondos por celda.
- No transicionar backgrounds en cascada.
- Regresión relativa por tema <3 % frente a `classic`.
- Mantener el objetivo actual de 55 FPS; no rebajar el guardarraíl.
- Assets decodificados antes del swap o fallback CSS sin flash.

### 14.6 Offline

- Manifest de assets validado.
- Precache del tema equipado y thumbnails esenciales.
- Prueba offline tras primera visita.
- Fallback clásico si falta un asset.
- Versión de cache actualizada junto con código/CSS.

---

## 15. Plan de implementación recomendado

### Fase 0 — congelar comportamiento

- Añadir test de geometría y cosmetic-only.
- Capturar golden del estado actual.
- Documentar los once IDs como permanentes.

**Salida:** ninguna diferencia visual ni de save.

### Fase 1 — registro y validador

- Introducir `BoardThemeCatalog`, renderer y fachada `Boards`.
- Migrar metadatos actuales al registro.
- Añadir i18n ES/EN.
- Sanear IDs y fallback.

**Salida:** misma apariencia actual, arquitectura verificable.

### Fase 2 — contrato completo

- Completar todos los tokens de los once temas.
- Eliminar diferencias de fallback entre juego y thumbnail.
- Corregir `jardin`.
- Añadir reduced/perf por tema.

**Salida:** catálogo homogéneo.

### Fase 3 — assets y dirección artística

- Producir rail, ambient, cell y thumbnail por tema.
- Empezar con Clásico, Madera y Hielo.
- Validar contraste/tiles/FX antes de continuar.
- Completar Lava, Cristal, Mágico, Futurista, Dorado, Bosque, Cósmico y Jardín.

**Salida:** riqueza visual comparable a la referencia, sin geometría nueva.

### Fase 4 — tienda y preview

- Preview 8×8 real.
- Probar FX visual.
- Preview reversible.
- Estados accesibles y localizados.
- Una única animación activa.

**Salida:** experiencia de selección completa.

### Fase 5 — cierre

- Matriz responsive/modos/tiles.
- Contraste y reduced motion.
- Perfil de rendimiento.
- Offline y cache bust.
- Actualizar `DESIGN_SYSTEM`, `MIGRATION_SPEC`, `REQUIREMENTS` y `ARCHITECTURE`.

---

## 16. Criterios de aceptación

- [ ] Los once IDs actuales siguen funcionando y conservan propiedad/equipado.
- [ ] Los precios y Jardín Zen no cambian.
- [ ] Ningún tema contiene reglas o modificadores de gameplay.
- [ ] Cambiar tema produce 0 px de diferencia geométrica en la matriz principal.
- [ ] Los 64 nodos de celda conservan identidad.
- [ ] Todos los modos y 16 tiles siguen siendo legibles.
- [ ] Focus, hint, danger, boss y booster ganan sobre el tema.
- [ ] Los 12 colores de figuras alcanzan al menos 3:1 sobre todas las superficies ocupadas.
- [ ] Textos ES/EN completos.
- [ ] Preview, compra, equipado, cancelar y cofre funcionan con teclado.
- [ ] Máximo una ambiental viva; cero en reduced/perf.
- [ ] Assets disponibles offline o fallback clásico inmediato.
- [ ] No se modifica `--board-size`, grid, abertura efectiva, gap ni posición.

---

## 17. Mockup entregado

Archivo interactivo:

```text
docs/mockups/board-themes-redesign/board-themes-interactive-mockup.html
```

Asset original del mockup:

```text
img/board-themes/mockup/board-theme-ornaments.svg
```

Capturas:

```text
docs/mockups/board-themes-redesign/current-board-390x844.png
docs/mockups/board-themes-redesign/board-theme-lava-390x844.png
docs/mockups/board-themes-redesign/board-themes-catalog-mockup-1280.png
```

Uso:

```powershell
python -m http.server 8080 --bind 127.0.0.1
```

Abrir:

```text
http://127.0.0.1:8080/docs/mockups/board-themes-redesign/board-themes-interactive-mockup.html
```

Parámetros útiles:

```text
?theme=lava
?embed=1&theme=lava
```

Interacciones:

- Los once botones del dispositivo o las tarjetas laterales cambian el diseño.
- “Probar FX” ejecuta una demostración puramente visual.
- “Reducir movimiento” desactiva ambientes.
- El indicador `Δ` verifica la geometría relativa después de cada cambio.

El mockup es una especificación visual aislada: no modifica `game.js`, `styles.css`, economía, save ni gameplay productivo.

---

## 18. Decisión final recomendada

Conservar los tableros como cosméticos puros y convertir el sistema actual en un registro validado. La referencia es una dirección artística excelente, pero sus “características especiales” no deben convertirse en reglas. La personalidad debe venir de material, luz, ornamento y FX; la partida debe seguir siendo exactamente la misma bajo cualquier diseño.

---

## 19. Addendum — revisión visual V2

La segunda revisión sustituye el enfoque plano basado solo en gradientes por un pack rasterizado inspirado directamente en la referencia aportada.

### Entregables incorporados

- 11 escenas de tablero a 1024×1024.
- 11 texturas de superficie de celda a 256×256.
- 11 previews de catálogo a 256×256.
- Mockup actualizado con selector de los 11 diseños.
- Control `Superficie vacía` / `Con figuras` para comparar material y legibilidad.
- Lámina comparativa generada desde el tablero DOM real.

Rutas:

```text
img/board-themes/v2/<tema>/scene.jpg
img/board-themes/v2/<tema>/scene-clean.jpg
img/board-themes/v2/<tema>/cell-surface.jpg
img/board-themes/v2/<tema>/preview.jpg
img/board-themes/v2/README.md
docs/mockups/board-themes-redesign/board-themes-v2-contact-sheet.png
docs/mockups/board-themes-redesign/board-theme-lava-v2-390x844.png
docs/mockups/board-themes-redesign/board-themes-v2-catalog-1280.png
```

### Resultado de validación

- 11/11 escenas cargadas a 1024 px.
- 11/11 texturas de celda aplicadas.
- 11/11 previews de catálogo presentes.
- 64 celdas reales, 8 filas y 8 columnas.
- Variación geométrica entre temas: `Δ 0,00 px`.
- Tablero móvil de referencia: 382,19×382,19 px en x 3,91, y 260,52; interior 364,19×364,19 px.
- Sin errores ni avisos de consola en el mockup.

Las escenas no contienen cuadrículas horneadas, piezas falsas ni texto. Todo el contenido jugable sigue perteneciendo al DOM y las capas artísticas conservan `pointer-events: none`. Las propiedades especiales descritas en la captura permanecen explícitamente fuera del sistema.

Revisión V2.1: el tablero consume `scene-clean.jpg`, recortado desde la abertura interior de cada master. La escena dejó de dibujarse por segunda vez encima de las celdas y se eliminó el trim CSS a 4 px. El resultado conserva un único borde exterior y evita el efecto de dos tableros solapados.

---

## 20. Addendum — rediseño integral V4

V4 convierte cada tema en una composición intercambiable de cuatro capas coordinadas. El fondo y las casillas proceden del mismo master material; el rail estructural y los ornamentos exteriores son assets RGBA independientes. Ya no existe decoración aplastada dentro del marco ni un contorno genérico compartido entre temas.

### Pack activo por tema

```text
img/board-themes/v2/<tema>/board-surface-v3.jpg
img/board-themes/v2/<tema>/cell-surface-v3.jpg
img/board-themes/v2/<tema>/frame-base-v4.png
img/board-themes/v2/<tema>/decor-v4.png
```

- `board-surface-v3.jpg`: superficie continua 1024×1024 extraída de la zona limpia del master.
- `cell-surface-v3.jpg`: respaldo de 256×256 con exactamente el mismo material y color grading.
- `frame-base-v4.png`: rail exterior 1024×1024 sin figuras, con anillo nominal de 24 px y alfa real.
- `decor-v4.png`: ornamentos independientes 1024×1088, con 32 px de reserva exterior arriba y abajo.

V4 se compila de forma determinista con Pillow y registra checksums en `board-theme-v4-manifest.json`. Los once rails se regeneran; Madera, Hielo, Cristal, Mágico, Futurista, Dorado, Bosque, Cósmico y Jardín reciben además una capa decorativa. Clásico y Lava no contienen figuras separables y usan un overlay transparente. Las superficies y celdas permanecen intactas.

### Composición runtime del mockup

1. `.board-wrap` conserva exactamente `382,19×382,19 px`, x `3,91`, y `260,52`; sus antiguos `8 px` de padding más `1 px` de borde se consolidan en un borde estructural de `9 px`, sin cambiar la abertura.
2. `.board` pinta `board-surface-v3.jpg` detrás de la cuadrícula 8×8.
3. Cada `.cell::before` muestra la región equivalente del mismo master con coordenadas por fila y columna; la capa es translúcida para mantener continuidad.
4. `.board-wrap::before` dibuja `frame-base-v4.png` y perfora su centro mediante máscara. `.board-wrap::after` dibuja exclusivamente `decor-v4.png`, con reserva exterior y detrás del tablero. `.board` añade una junta redondeada de `2–3 px` antes del rail.
5. Los `.glyph` continúan siendo SVG DOM reales. El estado inicial muestra 32 de 64 casillas, exactamente el 50 %.

`applyTheme()` precarga e intercambia las cuatro URLs visuales. No reconstruye casillas, no modifica estado de juego y no dispara automáticamente el FX de eliminación. El botón `Superficie vacía` continúa disponible únicamente como herramienta de comparación manual.

### Entregables V4

```text
docs/mockups/board-themes-redesign/board-themes-interactive-mockup.html
docs/mockups/board-themes-redesign/build_board_theme_v4_assets.py
docs/mockups/board-themes-redesign/board-theme-v4-manifest.json
docs/mockups/board-themes-redesign/board-themes-v4-layered-contact-sheet.jpg
docs/mockups/board-themes-redesign/board-themes-v4-catalog-1280.png
docs/mockups/board-themes-redesign/v4-layered/<tema>-full.png
img/board-themes/v2/<tema>/frame-base-v4.png
img/board-themes/v2/<tema>/decor-v4.png
```

### Contrato V4

- Cambian: superficie, textura coordinada, marco, color de celda, resplandor y FX decorativo.
- Permanecen: 64 botones, 32 figuras de muestra, orden DOM, foco, clic, tamaño de celda, posición, abertura efectiva y gap.
- Alineación V4: radio del tablero `13 px`; radio de abertura `13 px + junta`; radio exterior `13 px + junta + 9 px`. Los tres radios son concéntricos y el rail tiene exactamente `9 px` en cualquier viewport. El marco crece solo hacia fuera y la geometría del tablero no cambia.
- Nunca cambian: puntuación, spawns, tiempo, oleadas, obstáculos, probabilidades, combos, economía o guardado.
- Las características especiales descritas en la referencia continúan excluidas: los temas son exclusivamente visuales.

---

## 21. Addendum — corrección de fidelidad y esquinas V4.1

V4.1 sustituye el método de generación artística descrito en el addendum V4. La arquitectura de cuatro capas se conserva, pero los rails y ornamentos dejan de ser reinterpretaciones procedurales: su única autoridad visual vuelve a ser cada `frame-v3.png` consolidado, creado a partir de los masters de referencia.

### Problemas corregidos

1. El radio fijo de `13 px` del tablero era mayor que todos los radios de tile (`6–10 px`). El clip del tablero recortaba las cuatro casillas de esquina y hacía parecer que el marco entraba en la cuadrícula.
2. El generador V4 mezclaba el V3 con blur, gradiente y ruido, reutilizaba un único tramo para cuatro direcciones y añadía bevels/motivos comunes. Esto eliminó la identidad de hielo, cristal, lava, futurista, dorado y bosque.
3. `decor-v4.png` se dibujaba con primitivas nuevas y un canvas 1024×1088. Aunque el CSS conservaba su ratio, los motivos ya no eran los aprobados y algunos parecían aplanados.
4. Dorado y Futurista recibieron gemas/módulos decorativos que no pertenecían a sus marcos de referencia.

### Fuente autoritativa y separación

- Se regeneran los 22 PNG activos (`frame-base-v4.png` y `decor-v4.png` de once temas).
- `frame-v3.png` aporta directamente color, relieve, textura, highlight, sombra y antialias.
- Un anillo concéntrico separa rail y silhouette exterior. Madera, Hielo, Cristal, Mágico y Cósmico añaden zonas semánticas para mover a decoración sus remates completos.
- Los huecos estructurales se rellenan desde el píxel V3 válido más cercano del mismo tema; no se sintetizan materiales nuevos.
- El rail pasa de 48 a 24 px. Las esquinas se escalan uniformemente y solo los tramos rectos se prolongan longitudinalmente.
- La decoración usa canvas 1024×1024, transformación identidad y el mismo rectángulo CSS que el rail. No hay filtros cromáticos ni escalado independiente por eje.
- Jardín no aparece en la última captura; conserva su `frame-v3.png` y `scene.jpg` previos como autoridad, sin inventar una nueva dirección.

### Geometría final de esquinas

```text
radio de tile            = --cell-radius (6–10 px según tema)
radio del tablero        = radio de tile
junta exterior           = clamp(3px, 1vw, 3.8px)
radio interior del rail  = radio de tile + junta
grosor del rail          = 9px hacia fuera
radio exterior del rail  = radio de tile + junta + 9px
```

Las cuatro curvas comparten centro. La tile deja de ser recortada por un radio mayor, la junta crea distancia visible y el rail empieza siempre fuera de la superficie jugable. No se añade padding de layout: los 64 rectángulos, hitboxes, gap, posición y tamaño del tablero siguen intactos.

### Contrato actualizado de assets

```text
frame-base-v4.png  1024 × 1024 RGBA  rail de 24 px
decor-v4.png       1024 × 1024 RGBA  píxeles V3 separados, sin axis stretch
```

El manifiesto V4.1 registra `sourceV3Sha256`, `semanticZones`, `separation: whole-authored-pixel`, radios raster por tema y `decorTransform: identity-square-no-axis-stretch`. La QA se recompila con `render_board_theme_v41_previews.py`: mantiene las figuras de ejemplo sobre un tablero al 50 % y genera `board-themes-v41-corner-audit.png` con las 44 esquinas ampliadas.

---

## 22. Addendum — fondo de partida y tiles V5

### Objetivo de la fase

El tablero comprable pasa a controlar dos capas visuales adicionales: el fondo
de toda la pantalla de partida y el material individual de las tiles. Ambas
pertenecen al SKU de `Boards`, no a `Themes`, y siguen siendo cosmética pura.

La primera entrega artística cubre únicamente `classic` y `lava`. Madera, Hielo,
Cristal, Mágico, Futurista, Dorado, Bosque, Cósmico y Jardín permanecen en
`fallback-css` hasta recibir sus propios masters. Este fallback es intencionado:
un tema pendiente no reutiliza el fondo ni las tiles de Clásico, porque eso
rompería su identidad visual.

### Contrato productivo

`BoardVisualAssets` registra los once IDs y `Boards.resolveAssets(id)` devuelve:

```text
status                  ready-v2 | fallback-css
gameBackground          URL o cadena vacía
boardBackground         URL estática o cadena vacía
tileVariants            array de cuatro URL o array vacío
backgroundOverlay       gradiente de legibilidad | none
boardBackgroundOverlay  gradiente de contraste | none
```

`Boards.apply()` continúa siendo el único punto de aplicación. Mantiene los
`data-board` existentes y solo escribe variables CSS de pintura sobre
`#screen-game`; no cambia `width`, `height`, `top`, `left`, padding, gap, grid,
orden DOM ni listeners. Compra, propiedad, equipamiento, cofres y desbloqueo de
Jardín conservan la implementación anterior.

La carga se memoriza por SKU con `Promise.allSettled`. Solo se solicitan los
assets del tablero activo. Si una imagen falla, las variables inferiores de CSS
siguen produciendo un tablero funcional y legible.

### Clásico

- Fondo vertical `780×1688`: espacio navy sereno, starfield poco denso y bruma
  cobalto periférica. No contiene bosque, vegetación, rocas, planetas ni una
  cuadrícula. Se reserva deliberadamente el espectáculo violeta, los planetas y
  la nebulosa profunda para Cósmico.
- Cuatro tiles runtime `256×256`: starfields navy/cobalto sobrios, sin bisel,
  contorno ni aspecto plástico. Cada imagen es full-bleed y se coloca únicamente
  debajo de una figura; los slots vacíos siguen limpios.
- Fondo interior `1024×1024`: espacio cobalto de brillo medio y baja frecuencia,
  estático y más luminoso que las cuatro tiles para separar sus siluetas.

### Lava

- Fondo vertical `780×1688`: caverna de basalto con magma y brasas concentrados
  en los extremos, más una zona central oscura para HUD, iconos y tablero.
- Cuatro tiles runtime `256×256`: variantes independientes de basalto, obsidiana
  y grietas de magma, siempre full-bleed y sin un marco rasterizado.
- Fondo interior `1024×1024`: magma naranja-rojo continuo con islas de basalto;
  se ve solo detrás de las celdas y en el gap real, sin animación.
- La QA de composición mide también el slot vacío final: separación mínima de
  15,46 puntos en Clásico y 16,96 en Lava frente a la tile ocupada más próxima.
- El `board-underlay` rojo oscuro se ve únicamente en el gap real y en las
  esquinas alfa de las tiles; no añade padding ni una segunda cuadrícula.

### Estados y precedencia

Solo `.has-icon` selecciona una de las cuatro imágenes
`tile-variant-{1..4}-v2.png`. No existe overlay de borde ni atlas runtime: la
imagen ocupa el 100 % de la celda y el borde CSS pasa a transparente. `.empty`
mantiene exclusivamente su color/borde de slot y no carga ni pinta una tile.
Ambos estados conservan el mismo rectángulo. Los estados
especiales que ya declaran `background:` (`rock`, `frozen`, `locked`, cadenas,
barrier, etc.) continúan ganando por cascada. Focus, hint, danger, boss warnings,
portales, boosters y FX conservan su semántica y su z-index.

### Assets y trazabilidad

```text
img/board-themes/v2/{classic,lava}/game-background-v1.webp
img/board-themes/v2/{classic,lava}/board-background-v2.webp
img/board-themes/v2/{classic,lava}/tile-variant-1-v2.png
img/board-themes/v2/{classic,lava}/tile-variant-2-v2.png
img/board-themes/v2/{classic,lava}/tile-variant-3-v2.png
img/board-themes/v2/{classic,lava}/tile-variant-4-v2.png
docs/mockups/board-themes-redesign/build_board_theme_environment_v2_assets.py
docs/mockups/board-themes-redesign/board-theme-environment-v2-manifest.json
docs/mockups/board-themes-redesign/board-theme-tile-variants-v2-prompts.md
docs/mockups/board-themes-redesign/board-theme-board-backgrounds-v2-prompts.md
tests/board-theme-environment-assets.test.js
```

El manifiesto registra dimensiones, hashes, alfa, método de generación y estado
de los once SKU. Los ocho masters se generaron por separado con el flujo
integrado de imágenes; el recorte exacto `390×844 @2x`, la compresión WebP y las
ocho tiles opacas se construyen de forma determinista con Pillow.
