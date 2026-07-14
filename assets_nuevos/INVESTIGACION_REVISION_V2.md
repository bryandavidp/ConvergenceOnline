# Investigacion de packs gratuitos - revision V2

Fecha de comprobacion: 2026-07-14

## Criterios

- Descarga real sin pago obligatorio.
- Permiso de uso comercial verificable.
- Borde grueso, color saturado, silueta simple y sombreado mobile/toy.
- Transparencia PNG y resolucion suficiente para normalizar a 512 px.
- Coherencia con los 55 iconos Gvesster ya activos en `img/ui`.
- Se penalizan packs flat, painterly, dark RPG, con procedencia dudosa o sin
  licencia explicita.

## Seleccion final

| Pack | Descarga oficial | Licencia | Contenido comprobado | Encaje | Decision |
| --- | --- | --- | ---: | --- | --- |
| Gvesster Free Icon Pack v3.1 | https://gvesster.itch.io/free-icon-pack | Comercial permitido; credito opcional; sin reventa como pack | 2044 PNG locales contando variantes/tamanos | 10/10 | Familia principal |
| Gvesster Events v3 | https://gvesster.itch.io/events-icon-pack | Mismas condiciones de Gvesster | 128 PNG locales; 10 Halloween seleccionados | 10/10 | Reemplazo de CraftPix Halloween |
| Akami Buff & Debuff Free Vol.1 | https://akami666.itch.io/buff-debuff-icon-pack-free-vol1 | CC0 1.0 explicita en pagina y ZIP | 20 conceptos, 3 tamanos | 8/10 | Complemento aislado de estados |
| Vektyr Juicy Casual Buttons | https://realvektyr.itch.io/juicy-casual-game-buttons | Uso personal/comercial; no reventa de fuentes | 48 PNG normalizados | 8/10 | Solo superficies de boton |

Gvesster declara uso comercial, credito opcional, versiones Outline y ausencia
de IA generativa. Akami declara CC0, 20 iconos, fondo transparente, tres tamanos
y uso de IA asistida. Estas condiciones tambien estan copiadas en el manifiesto
local y en los archivos de licencia descargados.

## Candidatos descargados y evaluados

| Pack | Descarga | Licencia/procedencia | Evaluacion | Decision |
| --- | --- | --- | --- | --- |
| Akami Cozy Witchcraft Sample | https://akami666.itch.io/cozy-witchcraft-icons-free-sample-pack-20-game-icons | Pagina marcada royalty-free, pero el ZIP no incluye licencia explicita; AI-assisted | Visualmente cercano, algo mas detallado que Gvesster | No integrar hasta confirmar licencia por escrito |
| Deyeshi Shiny Game Icons | https://deyeshi.itch.io/sgi | La pagina no quedo accesible de forma estable y el PNG no adjunta licencia | 126 iconos brillantes en una sola lamina; buen tablero, fondos inconsistentes | Alternativa visual, no produccion |
| Deyeshi Vibrant Game Icons | https://deyeshi.itch.io/vgi | CC BY-SA 4.0; comercial; sin IA | 90 iconos 512, regular/outline; grueso pero mas plano | Fallback no-AI con atribucion y ShareAlike |
| GOBI Shiny Gems | https://gobistudio.itch.io/free-shiny-gems-icon-pack | CC BY 4.0; sin IA | 400+ PNG; gemas pintadas, mucho volumen y fondo/sombra variable | Demasiado detallado y realista para el HUD |
| Sudoja Free Game Icons Sampler | https://sudoja.itch.io/free-game-icons-sampler | El README describe contenido, pero no concede licencia | 40 PNG 256; UI, sci-fi, match-3, spells y achievements | Excluido por licencia y estilo flat |
| AssetSmithy Fantasy Loot Sampler | https://assetsmithy.itch.io/50-free-fantasy-items-loot-icons-rpg-inventory-pack-sampler | Comercial permitido; AI-generated y refinado | 50 conceptos x 4 tamanos | Coherente internamente, demasiado RPG y detallado |
| Marco RPG Consumables | https://marcomyly.itch.io/free-rpg-consumables-icons-pack-png-8-icons-4-styles-4-sizes | Comercial permitido; AI-assisted | 8 conceptos x 4 estilos x 4 tamanos | Los cuatro estilos rompen coherencia con la UI |

Los archivos originales estan en `_downloads_revision/` y las extracciones en
`_source_extract_revision/`. Las previews estan en `previews_revision/`.

## Candidatos investigados pero no incorporados

| Fuente | Enlace | Resultado |
| --- | --- | --- |
| LayerLab 2D Casual Icon Pack | https://layerlab.io/products/2d-casual-icon-pack | 15 iconos gratuitos y visualmente compatibles, pero el flujo de tienda y la pagina no muestran condiciones completas de licencia. No aporta cobertura suficiente frente a Gvesster. |
| Roundicons Free | https://roundicons.com/vector-free-icons/ | Gran cobertura y licencia comercial clara, pero son familias line/solid/duotone de producto, no iconos de juego 3D cartoon. |
| Coffee Beans Casual UI | https://coffee-beans-studio.itch.io/casual-game-ui-pack-icons-buttons | Solo las imagenes demo son gratuitas; el pack util requiere pago minimo. |
| DDG Cartoon RPG Icons | https://ddgstudio.itch.io/cartoon-rpg-icons | El autor indica que se construyo con PNG gratuitos encontrados en la web. Procedencia insuficiente. |
| Ultimate Fantasy RPG Icons | https://gaspardani87.itch.io/fantasy-rpg-icons | Mucho detalle painterly/Blizzard y uso de IA; no encaja con casual toy. |
| Pixarts RPG/survival freebies | https://itch.io/profile/pixarts | Las muestras encontradas son flat, blanco/negro o painterly; no mejoran la coherencia. |
| Kenney / Game-icons.net / Nieobie | Ver README V1 | Licencias limpias y cobertura alta, pero lenguaje monocromo/flat. Mantener como fallback funcional. |

## Ranking visual

1. Gvesster Free + Events: mejor continuidad y menor coste de direccion artistica.
2. Akami Buff/Debuff: el mejor especialista, solo dentro de slots de estado.
3. Deyeshi Shiny: alternativa para un tablero completo, no para UI general.
4. Akami Cozy: encaje alto, bloqueado por falta de texto de licencia explicito.
5. Vektyr: util para botones, no para iconografia semantica.
6. Deyeshi Vibrant: limpio y no-AI, pero demasiado plano.
7. Sudoja: coherente pero flat y sin permiso local suficiente.
8. AssetSmithy, Marco y GOBI: demasiado RPG, realistas o variables.

## Archivos de revision

- `previews_revision/index.html`: indice de todos los candidatos nuevos.
- `previews_revision/comparison_craftpix_vs_gvesster_v2.png`: antes/despues.
- `listo_para_integrar_v2/preview_listo_para_integrar_v2.png`: seleccion final.
- `listo_para_integrar_v2/manifest.json`: origen, licencia y SHA-256 por archivo.
- `download_results_revision.json`: trazabilidad de las descargas de itch.io.

