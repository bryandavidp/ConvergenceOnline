# Inventario de iconografía - Convergence

> Última actualización: 14 julio 2026  
> Alcance: iconografía activa del juego en `index.html`, `game.js`, `styles.css`, `manifest.webmanifest` y `sw.js`.  
> Fuera de alcance: mockups en `docs/mockups/` y la librería completa no usada de `img/icons-v2/`.

Este archivo existe para dar seguimiento a los iconos de pantallas, modales, HUD, tablero y sistemas dinámicos. Úsalo como lista viva: cuando se rediseñe un icono, rellena `Reemplazo propuesto`, `Estado` y `Notas`.

## Leyenda

| Tipo | Qué significa | Cómo se renderiza |
|---|---|---|
| `PNG` | Icono legacy del pack `img/ui/*.png` | `<img class="ic">` o `iconInline()` |
| `SVG v2` | Icono monocromo del pack `img/icons-v2/*.svg` | `.icv2` con `mask` y `currentColor` |
| `SVG generado` | Fichas del tablero creadas por código | `Icons.svg(id)` en `game.js` |
| `Art inline` | SVG propio de UI/tarjetas | `Art.*()` en `game.js` |
| `Emoji/texto` | Glifo directo en HTML/JS/CSS | Texto visible, sin asset externo |
| `CSS` | Pseudo-elemento, máscara o data URI | `styles.css` |

Estados sugeridos:

| Estado | Uso |
|---|---|
| `OK` | Se mantiene tal cual por ahora |
| `Revisar` | Coherencia visual, legibilidad o prioridad pendiente |
| `Migrar` | Cambiar emoji/texto/PNG por asset nuevo o SVG v2 |
| `Reservado` | Asset disponible pero sin uso activo |
| `Retirar` | Quitar del precache o del repo si se confirma que no se usará |
| `Pendiente` | Trabajo propuesto, todavía sin análisis o implementación |

## Resumen rápido

| Sistema | Cantidad / fuente | Estado | Notas de seguimiento |
|---|---:|---|---|
| App icons/PWA | 4 PNG + 1 favicon SVG data | Revisar | Favicon usa emoji de galaxia; los PNG `icon-*` y `apple-touch-icon` están en manifest/SW. |
| Pack `img/ui` | 55 PNG | Revisar | Todos se precachean; la mayoría se usa por helpers. `minus` y `verify` no tienen uso activo en juego. |
| Pack `img/icons-v2` | 815 SVG disponibles | OK | Solo una selección pequeña está conectada vía `V2_ICONS`, HTML o CSS. |
| Fichas del tablero | 48 SVG generados | OK | 16 formas x 3 ciclos de color. Es el sistema más importante para legibilidad. |
| Iconos emoji/texto | Varias decenas | Migrar | Concentrados en jefes, bendiciones, reliquias, tutoriales, economía inicial y estados. |
| Iconos CSS de tile | 14+ estados | Revisar | Mezcla PNG, SVG v2, texto (`+30`, `⏳`, `⏰`, `◆`) y data URI. |

## Backlog visual

| Prioridad | Tema | Superficies afectadas | Estado | Reemplazo propuesto | Notas |
|---|---|---|---|---|---|
| P0 | Unificar iconos emoji visibles de UI | Clásico tabs, Cómo jugar, Supervivencia diff, cofres, economía inicial | Migrar |  | Hay varios emojis estáticos (`🎮`, `👀`, `✨`, `⚡`, `🔥`, `❤️`, `🎁`, `💎`) mezclados con PNG/SVG. |
| P0 | Jefes y minijefes con lenguaje propio | HUD jefe, toasts, ledger final, boss warnings | Revisar |  | Algunos ya usan v2 (`meteor`, `snowflake`), otros siguen emoji (`🌊`, `🔒`, `🕳️`, `🎭`, etc.). |
| P1 | Bendiciones y reliquias | Picker global, hoja de run, modal fin | Migrar |  | Son una de las capas más repetidas y todavía dependen mucho de emoji. |
| P1 | Iconos de modo consistentes | Home, selección de modo, leaderboard, modal fin | Revisar |  | `MODE_IMG` usa PNG para casi todo y `v2:rest` para Zen. Tarjetas usan a veces Art/v2. |
| P1 | Estados de tablero especiales | Board cells, warnings de boss | Revisar |  | Son críticos para jugabilidad. Mantener alto contraste antes que estilo decorativo. |
| P2 | Limpiar assets sin uso | `img/ui/minus.png`, `img/ui/verify.png`, `sw.js` | Retirar |  | `verify` aparece en mockup de jefes, no en juego activo; `minus` solo se precachea. |
| P2 | Favicon/PWA coherente con marca | `index.html`, manifest, icon PNG | Revisar |  | El favicon inline usa emoji; los iconos PWA son PNG independientes. |
| P3 | Crear hoja visual de referencia | Docs/QA | Pendiente |  | Una página HTML con todos los iconos activos ayudaría a comparar estilos. |

## Inventario por pantalla

| Superficie | Iconos | Fuente | Estado | Reemplazo propuesto | Notas |
|---|---|---|---|---|---|
| `screen-login` Bienvenida | Logo textual, órbita CSS, avatar dots | CSS / color dots | OK |  | No usa iconos de pack salvo el avatar cuando aparece en topbar tras login. |
| `screen-start` Inicio - appbar | `player`, `pencil`, `coin`, `gem`, `plus`, estrella de nivel `⭐` | PNG + emoji | Revisar |  | Topbar generada por `TOPBAR_HTML`. La estrella de nivel sigue como emoji. |
| Inicio - recompensa diaria | `gift`, `rocket` | PNG vía `data-art` | OK |  | Buen uso de PNG consistente. |
| Inicio - récord | `trophy` | PNG | OK |  | Directo en HTML. |
| Inicio - tarjetas | `target`, `mode-classic`, `mode-survival` | PNG + SVG v2 | Revisar |  | Clásico/Supervivencia usan `Art.boardMini()` y `Art.heartFoes()` que apuntan a v2. |
| Inicio - CTA | `download`, `refresh`, `play` | SVG v2 | OK |  | Botones principales ya están en v2. |
| Inicio - bottom nav | `medal`, `cart`, `house`, `target`, `settings` | PNG vía `data-art` | OK |  | Badges `q-dot` sin icono. |
| `screen-modes` Selección | `arrow-left`, modo cards, `book` | SVG v2 + PNG | Revisar |  | Ver tabla de `MODE_CARDS`; algunos features usan PNG y `v2:four-pointed-star`. |
| `screen-worlds` Clásico | `arrow-left`, `coin`, `gem`, `settings`, mundo actual, `star`, `lock`, `crown` | SVG v2 + PNG + emoji inicial | Revisar |  | Los spans iniciales de economía contienen emoji hasta que `Econ.update()` los sustituye. |
| Clásico - mundos | `leaf`, `v2:cactus`, `v2:mountain`, `potion`, `v2:town` | `WORLD_IMG` | OK |  | Mundo `neon` usa edificio v2. |
| Clásico - tabs | `cart`, `target`, `🎮`, `chest`, `trophy` | PNG + emoji | Migrar |  | Tab central `Jugar` sigue como emoji de mando. |
| `screen-game` HUD economía | `coin`, `gem`, plus CSS | PNG + CSS | OK |  | Plus del wallet se pinta con CSS, no asset. |
| HUD pausa | `pause` | SVG v2 | OK |  | También se reutiliza en modal pausa. |
| HUD supervivencia | `heart`, `skull`, `fire`, `shield`, boss portraits | PNG + emoji/SVG v2 | Revisar |  | Vidas usan `heart`/`skull` por `iconInline`; flag jefe usa `⚠`. |
| HUD score/frenesí | llama `🔥`, flor Zen `🌸`, ghost `▲` | Emoji/texto | Migrar |  | Muy visible durante partida. |
| HUD ocupación | `grid`, `exclamation` | SVG v2 | OK |  | Cambia dinámicamente según peligro. |
| Tablero | 48 fichas generadas, tiles especiales, warnings | SVG generado + CSS | Revisar |  | Ver secciones de tablero y tiles. |
| Booster bar | `bomb`, `snowflake`, `bolt`, `brush`, `double`, `search` | PNG + SVG v2 | Revisar |  | Cinco boosters por `BOOSTER_IMG`; pista usa PNG `search`. |
| `chapter-intro` Aventura | bioma actual | `BIOME_IMG` | OK |  | `planet`, `v2:meteor`, `v2:snowflake`, `planet-hell`, `v2:circle-ring`, `crystal`. |
| `pick-overlay` global | rutas, reliquias, bendiciones, continuar, Zen | Emoji/PNG/SVG según payload | Migrar |  | Es el principal contenedor de iconos dinámicos no normalizados. |
| `prelevel` | `bomb`, `snowflake`, `bolt` | `BOOSTER_IMG` | OK |  | Coste usa `coin`. |

## Inventario por modal

| Modal | Icono de cabecera | Iconos internos / acciones | Estado | Reemplazo propuesto | Notas |
|---|---|---|---|---|---|
| `modal-missions` | `target` PNG | misión diaria `🎯`, semanal `🗓️`, streak `🔥`, reroll ticket | Revisar |  | Constructor `refreshStart()` mezcla emoji y assets. |
| `modal-how` | `question` PNG | `target`, `👀`, `✨`, `fire`, `warning`, botón `play` | Migrar |  | Muy buen candidato para pasar a set unificado. |
| `modal-pause` | `pause` SVG v2 | `play`, `refresh`, `cross` | OK |  | Todo v2. |
| `modal-level` | `star` PNG o modo/bioma dinámico | estrellas, `coin`, `star`, `map`, `warning`/`target`, `bolt`, `dice` | Revisar |  | Emblema cambia según perfecto/modo/bioma. |
| `modal-over` | `flag` SVG v2 o modo/`shield` | `four-pointed-star`, `refresh`, `share`, `cross`, rewards, boons, bosses | Revisar |  | Modal con más iconografía dinámica del juego. |
| `modal-settings` | `settings` PNG | `sound-on/off`, `music-on/off`, `v2:mobile-phone`, `aura`, `v2:font` | OK |  | Bien centralizado en `buildSettings()`. |
| `modal-revive` | `heart` PNG | `coin` | OK |  | Simple y claro. |
| `modal-surv-diff` | `heart` PNG | semanal `📅`, sistema `⚡/🔥/❤️`, servicio/hazañas | Migrar |  | Contiene varios emoji explicativos. |
| `modal-daily` | `target` PNG | mutador `🎲`, medallas, streak `🔥`, botón `target` | Revisar |  | La ficha diaria combina iconos textuales y medallas por clase. |
| `modal-adventure` | `rocket` PNG | nodos por bioma, reliquias/rutas | Revisar |  | Depende de `BIOME_IMG` y emojis de rutas/reliquias. |
| `modal-shop` | `cart` PNG | `coin`, `gem`, `ticket`, swatches de tablero/tema | OK |  | Los productos visuales usan swatches, no iconos. |
| `modal-chests` | `chest` PNG | `coin`, `gem`, `ticket`, `chest`, reward icons emoji | Revisar |  | Botones `Abrir cofre`/premium todavía tienen emoji en texto. |
| `modal-multi` | `players` PNG | `user`, `trophy`, `star`, `wi-fi`, `prohibited`, `notification` | OK |  | Modal está en HTML pero no parece entrada principal activa en V1. |
| `modal-medals` Perfil | `player` PNG | `medal`, `lock`, iconos de modo en leaderboard | OK |  | Logros no tienen icono individual, solo medalla/candado. |

## Sistemas dinámicos de iconos

### Fichas del tablero

| Campo | Valor |
|---|---|
| Fuente | `Icons` en `game.js` |
| Cantidad activa | 48 IDs (`16 formas x 3 ciclos`) |
| Formas | `circle`, `square`, `triangle`, `star`, `heart`, `diamond`, `hexagon`, `plus`, `droplet`, `ring`, `pentagon`, `moon`, `sun`, `flower`, `clover`, `spiral` |
| Colores | `red`, `blue`, `green`, `yellow`, `purple`, `cyan`, `orange`, `pink`, `lime`, `white`, `teal`, `indigo` |
| Estado | OK |
| Seguimiento | La regla más importante es legibilidad: cada ventana de nivel evita repetir forma, por eso un rediseño debe conservar diferencia fuerte de silueta. |

### Modos

| ID | Icono actual | Fuente | Estado | Reemplazo propuesto | Notas |
|---|---|---|---|---|---|
| `tutorial` | `book` | PNG | OK |  | Vive dentro de Cómo jugar. |
| `clasico` | `pin` / `mode-classic` | PNG + SVG v2 | Revisar |  | Home/mode card no siempre usan el mismo token. |
| `aventura` | `rocket` | PNG | OK |  | Coherente en home/modal/fin. |
| `contrarreloj` | `clock` | PNG | OK |  | Feature diaria usa `target`. |
| `supervivencia` | `heart` / `shield` | PNG + SVG v2 | Revisar |  | Fin de partida usa `shield`; selector usa `heartFoes` (`mode-survival`). |
| `zen` | `v2:rest` / `☯️` | SVG v2 + emoji fallback | Migrar |  | Dificultad Zen usa `🍃` y `☯️`. |

### Biomas y mundos

| Grupo | IDs | Iconos actuales | Estado | Notas |
|---|---|---|---|---|
| Biomas aventura | `nebula`, `asteroid`, `ice`, `core`, `void`, `crystal` | `planet`, `v2:meteor`, `v2:snowflake`, `planet-hell`, `v2:circle-ring`, `crystal` | OK | Usados en banner, intro, modal level y mapa aventura. |
| Mundos clásico | `bosque`, `desierto`, `montana`, `cueva`, `neon` | `leaf`, `v2:cactus`, `v2:mountain`, `potion`, `v2:town` | OK | Usados en cabecera y rail de mundos. |

### Potenciadores

| ID | Icono actual | Fuente | Estado | Reemplazo propuesto | Notas |
|---|---|---|---|---|---|
| `bomb` | `bomb` | PNG | OK |  | Toolbelt, prelevel, toasts. |
| `freeze` | `v2:snowflake` | SVG v2 | OK |  | También tile frozen. |
| `clearLine` | `bolt` | PNG | OK |  | Nombre de gameplay: Rayo. |
| `wild` | `v2:brush` | SVG v2 | OK |  | Nombre visible: Escoba. |
| `x2` | `v2:double` | SVG v2 | OK |  | Nombre visible: Comodín. |
| `hint` | `search` | PNG | OK |  | Botón fijo fuera de `BOOSTER_IMG`. |

### Tiles y obstáculos

| Tile / estado | Icono actual | Fuente | Estado | Reemplazo propuesto | Notas |
|---|---|---|---|---|---|
| `rock` | patrón de cadenas data URI | CSS | Revisar |  | No usa glyph para no confundirse con ficha. |
| `locked` | `lock` | PNG/CSS | OK |  | También `cage`. |
| `frozen` | `snowflake` | SVG v2 mask | OK |  | Overlay de baja opacidad. |
| `crystal` | `crystal` | PNG/CSS | OK |  | Badge pequeño sobre ficha. |
| `chains` | `link` | SVG v2 mask | OK |  | Obstáculo sólido. |
| `web` | `connection` | SVG v2 mask | Revisar |  | Semántica visual de telaraña puede no ser obvia. |
| `barrier` | `prohibited` | SVG v2 mask | OK |  | Alta claridad. |
| `mud` | `drought` | SVG v2 mask | Revisar |  | Podría leerse como grieta/sequía, no lodo. |
| `bonus` | `+30` | Texto CSS | Revisar |  | No tiene asset. |
| `portal` | `teleporter` | PNG/CSS | OK |  | |
| `magicbox` | `luckyblock` | PNG/CSS | OK |  | |
| `bomb` tile | `bomb` | PNG/CSS | OK |  | |
| `slowdown` | `⏳` | Emoji/texto CSS | Migrar |  | Visible en tablero. |
| `timecap` | `⏰` | Emoji/texto CSS | Migrar |  | Visible en Contrarreloj. |
| `boss` | `◆` / `◈` | Texto CSS | Revisar |  | Buena lectura mecánica, pero muy abstracto. |
| `boss warn` | clases de color por ataque | CSS | OK |  | No todos tienen icono, se comunican por color/animación. |

### Jefes y minijefes

| ID | Icono actual | Fuente | Estado | Reemplazo propuesto | Notas |
|---|---|---|---|---|---|
| `meteor` | `v2:meteor` | SVG v2 | OK |  | |
| `tide` | `🌊` | Emoji | Migrar |  | Necesita icono de ola/marea consistente. |
| `frost` | `v2:snowflake` | SVG v2 | OK |  | |
| `lockdown` | `🔒` | Emoji | Migrar |  | Se podría mapear a `lock` o SVG v2. |
| `eco` | `🔁` | Emoji | Migrar |  | |
| `quake` | `teleporter` | PNG | Revisar |  | Funciona como caos/teletransporte; quizá necesita icono propio de terremoto. |
| `crystalid` | `💠` | Emoji | Migrar |  | Relacionado con cristales. |
| `void` | `🕳️` | Emoji | Migrar |  | Puede mapearse a `v2:circle-ring` si encaja. |
| `puppeteer` | `🎭` | Emoji | Migrar |  | Necesita identidad fuerte. |
| `magpie` | `🐦` | Emoji | Migrar |  | Minijefe; no usar icono animal genérico si se rehace. |
| `firefly` | `✨` | Emoji / v2 mapping parcial | Migrar |  | `EMOJI_IMG` mapea `✨` a `four-pointed-star` en algunos contextos. |
| `sentinel` | `🗼` | Emoji | Migrar |  | |
| `herald` | `📯` | Emoji | Migrar |  | |

### Bendiciones, hazañas y reliquias

| Sistema | IDs | Iconos actuales | Estado | Notas |
|---|---|---|---|---|
| Bendiciones | `life`, `charge`, `slow`, `pack`, `frenzy`, `magnet`, `score_boost`, `golden_wave` | `❤️`, `⚡`, `🐌`, `💣`, `🔥`, `🧲`, `📈`, `👑` | Migrar | Se muestran en picker, hoja de run y modal fin. |
| Hazañas superviviente | `impecable`, `purista`, `fenix`, `coleccionista`, `semana_completa`, `frenetico`, `al_limite`, `economo`, `cazador`, `ronda_maestra`, `domaecos` | emoji variados | Migrar | Se celebran con toast `medal`, pero el catálogo usa emoji. |
| Rutas aventura | `dense`, `calm` | `🪨`, `🌿` | Migrar | Picker de ruta por capítulo. |
| Reliquias aventura | `combo`, `crystal`, `hint`, `shield` | `⏱️`, `💎`, `🔍`, `🛡️` | Migrar | Picker post-jefe y log de expedición. |

### Economía, progreso y feedback

| Sistema | Iconos | Fuente | Estado | Notas |
|---|---|---|---|---|
| Economía | `coin`, `gem`, `ticket`, `chest`, `fire` | PNG vía `Econ.ICONS` | OK | Algunos HTML iniciales todavía usan emoji hasta que JS re-renderiza. |
| Toasts base | `info`, `check`, `warning`, `close` | PNG | OK | `Toasts.ICON` centraliza `info/good/warn/bad`. |
| Siguiente acción | `chest`, `target`, `medal`, `cart`, `pin`, `rocket`, `heart`, modos | PNG/SVG | OK | `NextActions.recommendation()`. |
| Logros perfil | `medal`, `lock` | PNG | OK | No hay icono por logro individual. |
| Medallas diarias | `🏅` o `medal`, clases `medal-*` | PNG/emoji/texto | Revisar | Resultados y calendario diario mezclan icono y color. |

## Inventario de assets

### App/PWA

| Asset | Uso | Estado | Notas |
|---|---|---|---|
| `index.html` favicon data SVG | Pestaña del navegador | Revisar | Contiene emoji galaxia. |
| `icon-192.png` | Manifest/SW | OK | |
| `icon-512.png` | Manifest/OG/SW | OK | |
| `icon-maskable.png` | Manifest/SW | OK | |
| `apple-touch-icon.png` | iOS/SW | OK | |

### PNG `img/ui`

| Estado | Assets |
|---|---|
| Activos en UI/pantallas | `book`, `cart`, `chest`, `coin`, `fire`, `gem`, `gift`, `heart`, `house`, `medal`, `pencil`, `player`, `players`, `plus`, `question`, `rocket`, `search`, `settings`, `star`, `target`, `trophy`, `warning` |
| Activos en juego/CSS | `bomb`, `crystal`, `lock`, `luckyblock`, `teleporter` |
| Activos por helpers dinámicos | `aura`, `bolt`, `calendar`, `check`, `clock`, `close`, `crown`, `dice`, `info`, `leaf`, `magnet`, `music-off`, `music-on`, `pin`, `planet`, `planet-hell`, `potion`, `shield`, `skull`, `sound-off`, `sound-on`, `star-empty`, `stats`, `ticket`, `upgrade` |
| Disponibles pero sin uso activo confirmado | `friend`, `minus`, `verify` |

Notas:

- `friend` existe como `Art.friends()` pero no aparece en pantallas activas revisadas.
- `verify` aparece en mockups de boss/toolbelt, no en el juego activo.
- `minus` solo aparece en el precache de `sw.js`.
- Todo `img/ui` se precachea en `sw.js`, aunque algunos assets estén reservados.

### SVG v2 conectados

| Grupo | Iconos conectados |
|---|---|
| Modo/UI | `8-ui/grid`, `8-ui/arrow-left`, `8-ui/refresh`, `8-ui/cross`, `8-ui/rest`, `8-ui/user`, `8-ui/user-group`, `8-ui/prohibited`, `8-ui/exclamation`, `8-ui/circle-ring` |
| Media | `9-media/play`, `9-media/pause`, `9-media/download`, `9-media/share`, `9-media/notification`, `9-media/wi-fi`, `9-media/mobile-phone`, `9-media/link`, `9-media/connection`, `9-media/time` |
| Mundo/naturaleza | `4-nature/meteor`, `4-nature/snowflake`, `4-nature/cactus`, `4-nature/mountain`, `4-nature/drought` |
| Juego/gear/editing | `1-game/double`, `3-gear/shield`, `10-editing/brush`, `10-editing/font`, `2-items/map` |
| Misc/buildings | `12-misc/four-pointed-star`, `12-misc/radiation`, `6-buildings/flag`, `6-buildings/town` |

Notas:

- `V2_ICONS` en `game.js` es el mapa canónico para alias lógicos (`v2:meteor`, `v2:double`, etc.).
- `sw.js` precachea el subconjunto conectado, no los 815 SVG.
- Algunos SVG se usan solo en CSS como máscara de tile.

## Checklist para revisar un icono

| Campo | Valor |
|---|---|
| Superficie |  |
| Icono actual |  |
| Problema |  |
| Reemplazo propuesto |  |
| Asset nuevo/ruta |  |
| ¿Necesita versión inline? |  |
| ¿Necesita color por `currentColor`? |  |
| ¿Se usa en HTML estático? |  |
| ¿Se usa en JS dinámico? |  |
| ¿Se usa en CSS pseudo-elemento? |  |
| ¿Actualizar `sw.js`? |  |
| ¿Actualizar `docs/DESIGN_SYSTEM.md`? |  |
| Estado |  |

## Lugares canónicos en código

| Área | Archivo / símbolo |
|---|---|
| Helpers PNG/SVG | `game.js` -> `icon()`, `iconInline()`, `iconV2()`, `iconAny()` |
| Alias SVG v2 | `game.js` -> `V2_ICONS` |
| Mapas de modo/bioma/mundo/booster | `game.js` -> `MODE_IMG`, `BIOME_IMG`, `WORLD_IMG`, `BOOSTER_IMG` |
| Emojis mapeados a assets | `game.js` -> `EMOJI_IMG` |
| Ilustraciones de UI | `game.js` -> `Art` |
| Fichas del tablero | `game.js` -> `Icons` |
| Tiles | `game.js` -> `Tiles.DEFS`; `styles.css` -> `.cell.tile-*` |
| Jefes | `game.js` -> `Survival.BOSS_DEFS`, `Bosses.DEX`, `Bosses.MINIDEX` |
| Bendiciones/hazañas | `game.js` -> `Survival.BOONS`, `Survival.FEATS` |
| Topbar | `game.js` -> `TOPBAR_HTML` |
| Modales estáticos | `index.html` -> bloque `MODALES` |
| Precache | `sw.js` -> `UI_ICONS`, `V2_ICONS` |
