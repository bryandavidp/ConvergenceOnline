# Propuesta de coherencia de iconografia V2

Fecha de revision: 2026-07-14

## Decision

La nueva direccion recomendada es usar **Gvesster como unico lenguaje visual de
produccion** para UI, supervivencia, recompensas, piezas de fruta y eventos. El
objetivo no es acumular mas packs, sino reducir la mezcla de autores, grosores,
perspectivas y tipos de sombreado.

La composicion final queda asi:

| Capa | Familia | Regla |
| --- | --- | --- |
| UI principal, economia y navegacion | Gvesster Free | Siempre Gvesster Outline |
| Supervivencia, inventario y objetos | Gvesster Free | Misma escala y margen que la UI |
| Halloween y eventos | Gvesster Events | Sustituye por completo CraftPix Halloween |
| Progresion, logros y recompensas | Gvesster Free | Sustituye CraftPix Achievements y Rhos Ranks |
| Buffs y debuffs | Akami Buff/Debuff CC0 | Modulo aislado; no mezclar dentro del HUD base |
| Superficies de boton | Vektyr | Solo fondos/botones; el pictograma sigue siendo Gvesster |
| Controles pequenos | SVG monocromo actual | Conservar para play, pausa, flechas, cerrar, refresh, etc. |
| Piezas principales del tablero | SVG generado actual | Conservar por legibilidad; Gvesster Food queda como variante |

## Sustitucion de los packs actuales

| Pack actual | Decision | Sustituto V2 | Motivo |
| --- | --- | --- | --- |
| `primary_gvesster_ui_512` | Conservar | `01_gvesster_core_ui_512` | Es la referencia visual del proyecto. |
| `secondary_craftpix_fruit_512` | Retirar de produccion | `03_gvesster_match3_food_512` | Las frutas pasan a compartir borde y sombreado con el HUD. |
| `secondary_craftpix_liquid_loot_512` | Retirar | `02_gvesster_survival_512` + `potion.png` del core | CraftPix es mas ilustrado, oscuro y organico. |
| `secondary_craftpix_halloween_512` | Retirar | `04_gvesster_events_halloween_512` | Mismo autor y lenguaje que la UI principal. |
| `secondary_craftpix_achievements_512` | Retirar | `05_gvesster_progression_512` | Simplifica medallas, premios y recompensas. |
| `secondary_rhos_ranks_sample_512` | Retirar de produccion | `05_gvesster_progression_512` | Rhos es mucho mas plano; conservar solo como prototipo CC0. |
| `ui_buttons_vektyr_512` | Conservar con limite | `07_vektyr_buttons_512` | Funciona como superficie, no como familia de pictogramas. |

## Mapa de la iconografia activa

### `img/ui`: conservar los 55 PNG

No sustituiria ninguno de los iconos actuales de `img/ui`. Son la base correcta:

`aura`, `bolt`, `bomb`, `book`, `calendar`, `cart`, `check`, `chest`, `clock`,
`close`, `coin`, `crown`, `crystal`, `dice`, `fire`, `friend`, `gem`, `gift`,
`heart`, `house`, `info`, `leaf`, `lock`, `luckyblock`, `magnet`, `medal`,
`minus`, `music-off`, `music-on`, `pencil`, `pin`, `planet`, `planet-hell`,
`player`, `players`, `plus`, `potion`, `question`, `rocket`, `search`,
`settings`, `shield`, `skull`, `sound-off`, `sound-on`, `star`, `star-empty`,
`stats`, `target`, `teleporter`, `ticket`, `trophy`, `upgrade`, `verify`,
`warning`.

La accion correcta es expandir esta familia, no reemplazarla.

### `img/icons-v2`: dividir por funcion

Los SVG monocromos actuales siguen siendo mejores para controles de 12-24 px.
No se deben cambiar por ilustraciones a color cuando funcionan como mascara,
boton compacto o indicador funcional.

| Uso actual | Decision | Sustituto cuando sea grande o ilustrativo |
| --- | --- | --- |
| Play, pausa, stop | Conservar SVG | Ninguno |
| Flechas, chevrons, volver | Conservar SVG | Ninguno |
| Cerrar, mas, menos | Conservar SVG | Gvesster solo en botones destacados |
| Refresh, undo, redo | Conservar SVG | Ninguno |
| Menu, grid, lista, link | Conservar SVG | Ninguno |
| Ojo/visibilidad | Conservar SVG en controles | `search.png` para descubrir/inspeccionar |
| Gamepad | Sustituir si es ilustrativo | Requiere icono Gvesster dedicado o custom |
| Corazon, fuego, estrella | Sustituir si es ilustrativo | `heart.png`, `fire.png`, `star.png` |
| Regalo, gema, moneda | Sustituir | `gift.png`, `gem.png`/`crystal.png`, `coin.png` |
| Corona, medalla, trofeo | Sustituir | Set `05_gvesster_progression_512` |
| Espada, escudo, objetivo | Sustituir | `sword.png`, `shield.png`, `target.png` |
| Alerta, bloqueo, muerte | Sustituir | `warning.png`, `lock.png`, `skull.png` |

### Emojis y simbolos de texto visibles

| Semantica actual | Sustituto propuesto |
| --- | --- |
| Brillo / recompensa | `star.png`, `aura.png` o `buff_energy_burst.png` segun contexto |
| Fuego / racha | `fire.png` |
| Vida | `heart.png` |
| Regalo / drop | `gift.png` |
| Gema / premium | `crystal.png` o `gem.png` |
| Bloqueo | `lock.png` |
| Tiempo | `clock.png` |
| Poder / energia | `bolt.png` o `lightning.png` |
| Busqueda / pista | `search.png` |
| Mejora | `upgrade.png` |
| Teletransporte / vacio | `teleporter.png` o `aura.png` |
| Grupo / aliados | `players.png` |
| Objetivo | `target.png` |

### Buffs, debuffs y boons

| Concepto | Icono V2 |
| --- | --- |
| Fuerza | `06_akami_status_cc0_512/buff_strength.png` |
| Velocidad | `06_akami_status_cc0_512/buff_speed.png` |
| Regeneracion | `06_akami_status_cc0_512/buff_regen_potion.png` |
| Escudo natural | `06_akami_status_cc0_512/buff_nature_shield.png` |
| Suerte | `06_akami_status_cc0_512/buff_luck.png` |
| Subida de nivel | `06_akami_status_cc0_512/buff_levelup.png` |
| Energia | `06_akami_status_cc0_512/buff_energy_burst.png` |
| Congelacion | `06_akami_status_cc0_512/debuff_freeze.png` |
| Veneno | `06_akami_status_cc0_512/debuff_poison_cloud.png` |
| Aturdimiento | `06_akami_status_cc0_512/debuff_stun.png` |
| Lentitud | `06_akami_status_cc0_512/debuff_slow.png` |
| Maldicion | `06_akami_status_cc0_512/debuff_curse.png` |
| Sangrado | `06_akami_status_cc0_512/debuff_bleed.png` |
| Confusion | `06_akami_status_cc0_512/debuff_confusion.png` |
| Frenesi | `fire.png` |
| Magnetismo | `magnet.png` |
| Bomba / pack explosivo | `bomb.png` |
| Multiplicador de score | `stats.png` o `upgrade.png` |

Akami no debe aparecer mezclado con Gvesster en una misma fila de botones base.
Debe vivir en slots de estado con un marco comun de la app; asi la diferencia de
autor se percibe como una categoria del juego y no como una inconsistencia.

### Reliquias y progresion

| Concepto | Icono V2 |
| --- | --- |
| Combo / racha | `fire.png` |
| Cristal | `crystal.png` |
| Pista | `search.png` |
| Escudo | `shield.png` |
| Logro comun | `medal.png` |
| Logro especial | `trophy.png` |
| Rango alto | `crown.png` |
| Objetivo completado | `verify.png` |
| Recompensa | `gift.png` o `chest.png` |
| Pase / entrada | `ticket.png` |
| Recompensa aleatoria | `luckyblock.png` |

### Jefes y amenazas

| Concepto | Propuesta | Estado |
| --- | --- | --- |
| Lockdown | `lock.png` | Cubierto |
| Crystalid | `crystal.png` | Cubierto |
| Void | `teleporter.png` | Cubierto por aproximacion |
| Sentinel | `shield.png` | Cubierto |
| Firefly | `aura.png` o `star.png` | Cubierto por aproximacion |
| Magpie | `Twitter`/ave de Gvesster | No recomendable; hacer custom |
| Tide / marea | Ninguno | Icono custom necesario |
| Quake / terremoto | `hammer.png` temporal | Icono custom necesario |
| Puppeteer / titiritero | Ninguno | Icono custom necesario |
| Herald / heraldo | `warning.png` temporal | Icono custom necesario |
| Web / telarana | Mantener SVG actual | Icono custom si pasa a color |
| Mud / barro | Mantener SVG actual | Icono custom si pasa a color |

Los seis conceptos marcados como custom no deben forzarse con stock. Son los
unicos huecos reales de la nueva familia.

## Piezas match-3

La recomendacion principal es conservar las 48 piezas SVG generadas por codigo:
son el sistema mas legible y consistente a escala de tablero. El set Gvesster Food
se entrega como modo alternativo o para recompensas/coleccionables.

Si se activa un tablero de frutas, la correspondencia sugerida es:

| Color/tipo | Icono |
| --- | --- |
| Azul | `blueberry.png` |
| Verde | `avocado.png` |
| Rojo | `strawberry.png` o `apple.png` |
| Amarillo | `lemon.png` o `banana.png` |
| Naranja | `orange.png` o `carrot.png` |
| Especial | `cookie.png` |

## Resultado esperado

La V1 tenia seis lenguajes visibles: Gvesster, CraftPix fruta, CraftPix loot,
CraftPix Halloween, CraftPix logros y Rhos. La V2 reduce la produccion normal a
un lenguaje principal, un sublenguaje de estados y una familia de superficies.

El cambio prioritario es:

1. Sustituir Liquid Loot por Gvesster Survival.
2. Sustituir Halloween por Gvesster Events.
3. Unificar logros/rangos en Gvesster Progression.
4. Eliminar emojis visibles a favor de iconos Gvesster.
5. Mantener SVG monocromo donde la funcion exige precision pequena.
6. Encargar solo los seis conceptos custom que no tienen equivalente honesto.

