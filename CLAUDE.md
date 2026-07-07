# CLAUDE.md

Contexto de proyecto para Claude Code. **Léelo antes de explorar el repo** — evita releer `game.js` o `styles.css` completos; casi todo lo que necesitas ya está indexado abajo o en `docs/`.

## Qué es esto

**Convergence** ("Convergencia"): juego de puzzle PWA, **100% vanilla** (HTML+CSS+JS), sin framework, sin bundler, sin `package.json`, sin dependencias externas. Mecánica: tocar una celda vacía del tablero 8×8 hace que el juego mire el icono más cercano en las 4 direcciones; si 2+ coinciden, convergen y suman puntos.

## Stack y comandos

- **Sin build.** Se sirve estático. Servidor de desarrollo: `python3 -m http.server 8080` (config en `.claude/launch.json`), abrir `http://localhost:8080/index.html`.
- **Tests:** `node --test 'tests/*.test.js'` (núcleo puro vía stub de DOM en `tests/dom-stub.js` + hook `?dev`). **Lint:** `npx --yes eslint@9 .` (config en `eslint.config.mjs`, sin package.json a propósito). Ambos corren en CI (`.github/workflows/ci.yml`) en cada push.
- **Simulación de balance:** `node tools/balance-sim.js` — juega partidas reales headless con bots deterministas (reloj virtual + RNG seedeado). **Obligatorio antes/después de cualquier cambio de balance** (comparar contra `docs/BALANCE_BASELINE.md`); el guardarraíl de medallas (`tests/balance-guardrail.test.js`) corre en CI.
- Debug en consola del navegador: abrir con `?dev` en la URL → expone todos los módulos internos en `window.__cv`.
- **Release / cache-busting:** al cambiar `styles.css` o `game.js`, ejecutar `tools/bump-version.sh X.Y.Z` — sube a la vez `VERSION` (game.js), `CACHE` (sw.js) y los `?v=` de `index.html`. No hacerlo a mano: olvidar uno de los tres deja a los usuarios con la versión vieja. Commit habitual: "Bump version to X.Y.Z; update cache version and asset links".

## Mapa de archivos

| Archivo/carpeta | Contenido |
|---|---|
| `index.html` (459 líneas) | Todo el DOM estático: 5 pantallas + 13 modales |
| `styles.css` (2258 líneas) | Todo el CSS — tokens, componentes, animaciones, 9 skins de tablero |
| `game.js` (3969 líneas) | Toda la lógica, un único IIFE — ver tabla de módulos abajo |
| `sw.js` | Service Worker (cache-first offline) |
| `manifest.webmanifest` | Metadata PWA |
| `img/icons-v2/` | Pack de iconos SVG por categoría (consumido vía CSS mask `--icv2-url`) |
| `img/ui/` | Pack de iconos PNG plano |
| `img/icons/` | Pack legacy PNG (con licencia en `img/icons/License.txt`, no redistribuible como asset pack propio) |
| `img/ui-system/` | ⚠️ Referenciado por `sw.js` pero **ausente del repo** y sin uso en CSS — no perder tiempo buscándolo |
| `.claude/launch.json` | Config de lanzamiento (servidor local) |

## Documentación exhaustiva (leer bajo demanda, no de entrada)

Estos documentos existen precisamente para que **no tengas que releer el código fuente completo** en cada iteración. Consúltalos primero; solo baja a `game.js`/`styles.css` para el detalle de implementación puntual una vez sepas qué buscas.

- **`docs/ARCHITECTURE.md`** — dónde está cada cosa, mapa de los ~39 módulos internos de `game.js` con línea aproximada, flujo de arranque, modelo de renderizado, máquina de estados de pantallas/modales, notas de PWA.
- **`docs/REQUIREMENTS.md`** — requisitos funcionales/no funcionales derivados del código (útil para saber "qué debería pasar" sin adivinar).
- **`docs/MIGRATION_SPEC.md`** — especificación exhaustiva y autocontenida de reglas de juego, fórmulas exactas, modelo de datos (`localStorage`), economía, progresión, combos, boosters, i18n, con checklist de paridad. Es la fuente de verdad para valores numéricos exactos.
- **`docs/DESIGN_SYSTEM.md`** — tokens de color/tipografía, inventario de componentes CSS, las ~50 animaciones (`@keyframes`) con su trigger, sistema de iconografía, accesibilidad.
- **`docs/ROADMAP.md`** — plan de trabajo priorizado (bugs conocidos, deuda pendiente, mejoras por dificultad/beneficio, arquitectura de nube). Consultarlo antes de proponer trabajo nuevo: probablemente ya esté priorizado ahí.
- **`docs/GAME_MODES_MASTER_PLAN.md`** — auditoría profunda de los 7 modos de juego (fortalezas/debilidades verificadas contra el código, psicología aplicada, referentes del género) + plan de mejora por fases (tareas GM-*): identidad por modo, pacing/frenesí, balance, potenciadores/penalizadores y validación por simulación. Consultarlo antes de tocar reglas, dificultad o sistemas de cualquier modo.

## Cómo trabajar eficientemente en este repo

1. **Antes de grepear/leer `game.js` completo**, revisa la tabla de módulos en `docs/ARCHITECTURE.md` §4 y usa `Read` con `offset`/`limit` acotado (± 100 líneas) al módulo relevante. El archivo es un único IIFE de ~4000 líneas: leerlo entero es el error más caro que se puede cometer aquí.
2. **Cambios de gameplay** (reglas, fórmulas, economía, modos) → casi siempre en `Config`, `Engine`, `Game`, `Survival`, `Adventure`, `Worlds`, `Classic` (ver tabla de líneas en ARCHITECTURE.md). Verifica la fórmula exacta en `MIGRATION_SPEC.md` antes de tocar el código, para no romper el balance existente.
3. **Cambios visuales** (color, animación, componente) → casi siempre en `styles.css`. Ubica el token/clase en `DESIGN_SYSTEM.md` antes de grepear el CSS a ciegas.
4. **No busques** `package.json`, `node_modules`, imports/exports de módulos ES, config de bundler ni tests — no existen en este repo.
5. **Idioma:** la app es bilingüe ES/EN vía `I18n.DICT` (dentro de `game.js`). No hardcodear strings nuevas — añadir la clave en ambos idiomas y usar `data-i18n`/`I18n.t()`.
6. **No hay versionado semántico automático:** si tu cambio afecta `styles.css`/`game.js`, recuerda subir manualmente los `?v=` en `index.html` y el `CACHE` en `sw.js` (ver arriba), si no el Service Worker seguirá sirviendo la versión vieja a los usuarios.
7. **Persistencia:** cualquier cambio al esquema de `cv_meta` (perfil de progresión) debe mantenerse retrocompatible — el código actual rellena campos faltantes al cargar (ver `MetaData._v` en `MIGRATION_SPEC.md` §3.4); no rompas partidas guardadas de usuarios reales.
