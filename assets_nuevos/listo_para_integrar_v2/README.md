# Iconografia lista para integrar V2

Todos los iconos estan en PNG RGBA de 512x512, con fondo transparente, margen
visual normalizado y hash SHA-256 en `manifest.json`.

| Carpeta | Cantidad | Uso |
| --- | ---: | --- |
| `01_gvesster_core_ui_512` | 55 | UI, HUD, economia y navegacion |
| `02_gvesster_survival_512` | 31 | Inventario, herramientas, comida y amenazas |
| `03_gvesster_match3_food_512` | 9 | Variante de tablero o coleccionables |
| `04_gvesster_events_halloween_512` | 10 | Evento Halloween |
| `05_gvesster_progression_512` | 12 | Logros, rangos y recompensas |
| `06_akami_status_cc0_512` | 20 | Buffs y debuffs en slots aislados |
| `07_vektyr_buttons_512` | 48 | Superficies de botones |

## Reglas de integracion

1. Gvesster es la familia de pictogramas de produccion.
2. Akami se usa solo para estados y siempre dentro de un marco comun.
3. Vektyr aporta la superficie; no sustituye el icono de la accion.
4. Los controles pequenos mantienen los SVG monocromos actuales.
5. Las piezas SVG generadas del tablero siguen siendo la opcion principal.
6. No copiar `_source_extract*` al build; usar solo esta carpeta.

## Licencias

- Gvesster Free y Events: uso comercial y en trabajo para clientes permitido;
  credito opcional; prohibido reclamar autoria, revender o redistribuir como pack.
- Akami Buff/Debuff: CC0 1.0, incluida en el ZIP original. El autor declara uso
  de IA asistida.
- Vektyr: uso personal/comercial permitido; no revender los archivos fuente.

Conservar `manifest.json` y este README en la documentacion del proyecto.

