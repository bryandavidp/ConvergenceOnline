# Assets gratuitos de iconografia para Convergence Online

Investigacion y paquete preparado para un videojuego web match-3/survival con look `Casual Game 3D Cartoon`: bordes gruesos, colores saturados, lectura rapida en mobile y sombreado tipo juguete.

## Decision rapida

Usar `listo_para_integrar/primary_gvesster_ui_512` como familia principal. Es el set que mas se parece a la UI actual del proyecto y mantiene iconos legibles, brillantes y con volumen cartoon.

Complementos recomendados:

| Uso | Carpeta lista | Motivo |
| --- | --- | --- |
| UI/base del juego | `listo_para_integrar/primary_gvesster_ui_512` | Mejor match visual. 55 PNG normalizados. |
| Piezas match-3 | `listo_para_integrar/secondary_craftpix_fruit_512` | Frutas saturadas, utiles como tiles/recompensas. |
| Supervivencia/consumibles | `listo_para_integrar/secondary_craftpix_liquid_loot_512` | Pociones, liquidos y objetos de loot. |
| Eventos/amenazas | `listo_para_integrar/secondary_craftpix_halloween_512` | Buen material para efectos oscuros, maldiciones y eventos. |
| Logros | `listo_para_integrar/secondary_craftpix_achievements_512` | Medallas RPG/casual ya recortadas. |
| Rangos/badges CC0 | `listo_para_integrar/secondary_rhos_ranks_sample_512` | Reserva legalmente limpia para rankings. |
| Botones UI | `listo_para_integrar/ui_buttons_vektyr_512` | Botones jugosos, utiles para CTA o estados. |

No mezclaria todos los estilos en una misma barra de HUD sin una pasada de direccion artistica. La combinacion mas limpia es: Gvesster para UI principal, CraftPix solo para piezas/loot, Vektyr para botones.

## Estructura entregada

| Ruta | Contenido |
| --- | --- |
| `_downloads/` | Zips y descargas originales. |
| `_source_extract/` | Packs extraidos completos, sin tocar. |
| `previews/` | Preview global, preview por pack e indice HTML. |
| `listo_para_integrar/` | Seleccion normalizada para integrar en el juego. |
| `listo_para_integrar/manifest.json` | Manifiesto con origen, licencia, recomendaciones y hashes. |
| `listo_para_integrar/preview_liste_para_integrar.png` | Preview visual de la seleccion final. |

Todos los PNG de `listo_para_integrar` estan normalizados a `512x512`, RGBA, fondo transparente y margen interno estable.

## Previews

Abrir:

- `previews/index.html`
- `previews/preview_all_packs.png`
- `listo_para_integrar/preview_liste_para_integrar.png`

Tambien hay preview individual para cada pack en `previews/preview_<pack>.png`.

## Packs investigados y descargados

| Pack | Fuente / descarga | Licencia declarada | Assets detectados | Encaje visual | Decision |
| --- | --- | --- | ---: | --- | --- |
| Gvesster Free Icon Pack | https://gvesster.itch.io/free-icon-pack | Comercial permitido, credito opcional, no reventa/redistribucion como pack | 2044 | Excelente | Principal recomendado |
| Gvesster Events Icon Pack | https://gvesster.itch.io/events-icon-pack | Comercial permitido, credito opcional, no reventa/redistribucion como pack | 128 | Muy bueno | Usar para eventos |
| Gvesster Eggs Icon Pack | https://gvesster.itch.io/eggs-icon-pack | Comercial permitido, credito opcional, no reventa/redistribucion como pack | 236 | Bueno, tematico | Usar si aparecen huevos/capsulas |
| Rhos Vector Ranks | https://rhosgfx.itch.io/vector-ranks | CC0 1.0 | 1788 | Bueno, mas flat | Reserva para rangos |
| Rhos Vector Emojis | https://rhosgfx.itch.io/vector-emojis | CC0 1.0 | 672 | Bueno, mas flat | Reserva para emociones/status |
| Mozert Free Cartoon Icon Pack | https://mozert.itch.io/cartoon-vectors-free-icon-pack | Uso permitido, restricciones de compartir/revender assets | 21 | Muy bueno pero pequeno | Candidato puntual, no base |
| Vektyr Juicy Casual Game Buttons | https://realvektyr.itch.io/juicy-casual-game-buttons | Personal/comercial permitido, no revender fuentes | 49 | Muy bueno para UI | Recomendado para botones |
| CraftPix Halloween Icons | https://free-game-assets.itch.io/free-halloween-game-icons | CraftPix freebies: comercial permitido, sin atribucion, no redistribuir fuentes | 48 | Bueno, mas oscuro | Uso puntual |
| CraftPix Fruit Icons | https://free-game-assets.itch.io/free-fruit-vector-icon-pack-for-rpg | CraftPix freebies | 97 | Bueno para match-3 | Recomendado para piezas |
| CraftPix Liquid Loot Icons | https://free-game-assets.itch.io/free-liquid-loot-vector-game-icons | CraftPix freebies | 97 | Bueno para supervivencia | Recomendado para loot |
| CraftPix Achievement Icons | https://free-game-assets.itch.io/free-game-achievement-vector-rpg-icons | CraftPix freebies | 30 | Bueno para logros | Recomendado para logros |
| Kenney Game Icons | https://kenney.nl/assets/game-icons | CC0 | 427 | Correcto, plano | Prototipado/fallback |
| Kenney Game Icons Expansion | https://kenney.nl/assets/game-icons-expansion | CC0 | 794 | Correcto, plano | Prototipado/fallback |
| Kenney Board Game Icons | https://kenney.nl/assets/board-game-icons | CC0 | 769 | Correcto, tablero | Prototipado/fallback |
| Kenney UI Pack | https://kenney.nl/assets/ui-pack | CC0 | 1304 | UI generica | Fallback UI |
| Game-icons.net SVG archive | https://github.com/game-icons/icons | CC BY 3.0, requiere atribucion | 4239 | Monocromo/no casual 3D | Solo fallback con atribucion |
| Nieobie Game Icon Pack | https://github.com/Nieobie/Game-Icon-Pack | CC0 1.0 | 1630 | Flat/lineal | Solo fallback |
| Match3 local/free | Sin fuente fiable recuperada en esta ronda | No verificada | 31 | Match-3 pero incompleto | No usar en produccion hasta trazar licencia |

Descargas directas guardadas:

- Kenney Game Icons: https://kenney.nl/media/pages/assets/game-icons/1ebf9c14af-1677661579/kenney_game-icons.zip
- Kenney Game Icons Expansion: https://kenney.nl/media/pages/assets/game-icons-expansion/afac4593af-1677661643/kenney_game-icons-expansion.zip
- Kenney Board Game Icons: https://kenney.nl/media/pages/assets/board-game-icons/19cae04050-1721645690/kenney_board-game-icons.zip
- Kenney UI Pack: https://kenney.nl/media/pages/assets/ui-pack/f651646eab-1718203990/kenney_ui-pack.zip
- Game-icons.net archive: https://github.com/game-icons/icons/archive/refs/heads/master.zip
- Nieobie archive: https://github.com/Nieobie/Game-Icon-Pack/archive/refs/heads/main.zip

Los packs de itch.io quedan trazados por pagina, nombre de zip y `upload_id` en `download_results.json`.

## Propuesta de direccion artistica

Prioridad 1: Gvesster.

La UI actual ya usa iconos de esa familia o una muy cercana. Mantenerla evita ruido visual y da una base con cara de mobile/casual: grosor alto, brillos claros, color saturado y silueta simple.

Prioridad 2: CraftPix como contenido de tablero y supervivencia.

Las frutas, liquidos y logros tienen mas detalle y un tinte mas RPG, pero funcionan bien si se usan como objetos del mundo: tiles, recompensas, loot, eventos y misiones. Evitaria usarlos como iconos principales del HUD junto a Gvesster si no hay retoque de color/stroke.

Prioridad 3: CC0 para prototipos y sistemas.

Kenney, Rhos y Nieobie son excelentes para legalidad y cobertura funcional. Visualmente son mas planos, asi que conviene reservarlos para placeholders, paneles secundarios, debug, ranking o elementos donde la coherencia sea menos critica.

## Packs descartados o no priorizados

- Sitios stock/agregadores como Pngtree, Vecteezy, Adobe Stock, Shutterstock y Pinterest: no cumplen el criterio de acceso gratuito 100% y/o introducen condiciones de cuenta, atribucion, suscripcion o licencia menos clara.
- Packs con nota de procedencia tipo "imagenes PNG gratis de la web": no se incluyeron por riesgo de origen/licencia.
- DeviantArt/Google Drive no se priorizo salvo que apunte a fuente oficial verificable, porque no deja una cadena de licencia suficientemente limpia para integracion directa.

## Notas de licencia

Esto no sustituye revision legal antes de publicar, pero deja trazabilidad para cada decision.

- Gvesster: permite uso comercial y credito opcional; no permite reclamar como propio, revender, redistribuir o editar para revender como asset pack.
- CraftPix freebies: permite uso personal/comercial en juegos y obras derivadas; no requiere atribucion; no permite revender/redistribuir los archivos fuente como pack separado.
- Rhos/Kenney/Nieobie: CC0, los mas limpios para redistribucion dentro de un juego.
- Game-icons.net: CC BY 3.0; si se usa, hay que incluir atribucion.
- Mozert/Vektyr: validos para uso en proyectos, pero no para redistribuir como pack de assets independiente.

## Integracion sugerida

1. Copiar solo desde `listo_para_integrar`, no desde `_source_extract`, salvo que se necesiten formatos vectoriales originales.
2. Mantener `manifest.json` junto al build o documentarlo en el repositorio para conservar fuente/licencia.
3. Usar nombres de carpeta como namespace: `gvesster_ui`, `craftpix_fruit`, `craftpix_loot`, `craftpix_achievements`.
4. Si se mezclan Gvesster y CraftPix en una misma pantalla, aplicar una pasada de estilo: mismo tamano visual, contraste de borde parecido y sombra/bisel consistente.
