# Plan maestro de cierre de V1 — Convergence

> **Rol de este documento:** definición ejecutable de qué significa "V1 cerrada" para Convergence y plan completo para llegar ahí. Producido tras lectura íntegra de toda la carpeta `docs/` + `CLAUDE.md` + verificación puntual contra el código real (`v1.9.0`). **No es una v2 imaginada**: todo lo propuesto mejora, completa, simplifica o recorta lo que ya existe o ya estaba previsto en la documentación.
>
> Documentos hermanos: [`ARCHITECTURE.md`](./ARCHITECTURE.md) · [`REQUIREMENTS.md`](./REQUIREMENTS.md) · [`MIGRATION_SPEC.md`](./MIGRATION_SPEC.md) · [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md) · [`ROADMAP.md`](./ROADMAP.md).

---

# 1. Inventario de documentación leída

Carpeta `docs/` completa (5 archivos, sin subcarpetas) + `CLAUDE.md` en la raíz. No existe ningún otro `.md` en el repositorio (verificado con `find`).

| Archivo | Propósito | Qué aporta | Importancia | Fiabilidad percibida |
|---|---|---|---|---|
| `docs/ARCHITECTURE.md` (167 líneas) | "¿Dónde está cada cosa?" | Mapa de los ~39 módulos internos de `game.js` con líneas aproximadas, stack, flujo de arranque, modelo de renderizado, máquina de pantallas/modales, PWA/SW, convención de versionado, cómo ejecutar/testear | Crítica para cualquier implementación (evita releer 4000 líneas) | Alta, pero **anclada a v1.7.1**: el código real está en v1.9.0. §8 aún documenta el hallazgo `ui-system` en `sw.js` que ya fue limpiado (Fase A). §10 sí fue actualizado con tests/CI. Los números de línea sirven como guía, no como verdad |
| `docs/REQUIREMENTS.md` (97 líneas) | Checklist de aceptación (RF/RNF) reconstruido por ingeniería inversa | 40+ requisitos funcionales (mecánica core, 7 modos, progresión, economía, cosméticos, ajustes, i18n, audio, PWA, accesibilidad), 9 no funcionales, y la lista §4 de "intención sin implementación" (multijugador, sumideros de gemas/tickets, `infected`, `ui-system`, `cost` de boosters) | Crítica para producto: es la definición implícita de "qué debería pasar" | Alta como foto de v1.7.1. §4 está **parcialmente obsoleto**: los sumideros de gemas (cofre premium 25💎) y tickets (reroll de misión 1🎫) ya existen desde v1.8.0; `ui-system` y `cost` ya fueron saneados |
| `docs/MIGRATION_SPEC.md` (654 líneas) | Fuente de verdad de reglas, fórmulas exactas, modelo de datos y constantes verbatim | Algoritmo de convergencia, tablas de dificultad/combos/tuning de Supervivencia, esquema completo de `cv_meta` (`_v:3`), economía con precios exactos, progresión (misiones/semanal/logros/mundos/biomas), boosters, i18n, audio sintetizado, catálogo de 48 iconos con invariante anti-confusión, checklist de paridad | Crítica: cualquier cambio de balance debe validarse contra este doc (regla de `CLAUDE.md`) | Muy alta para lo que cubre, pero **no cubre nada de Fase B/B+** (v1.8.0–1.9.0): `RNG`/`State.seed`, `RunSave` (reanudar partida), `Meta.dailyRun` (Reto del día), cofre premium, reroll con ticket, `?challenge=SEED`. Es la desviación documental más importante del repo |
| `docs/DESIGN_SYSTEM.md` (207 líneas) | Extracción exhaustiva del sistema visual (`styles.css` + `index.html`) | Tokens (color, z-index, radius, tap targets), paleta completa por modo/mundo/bioma/moneda, tipografía fluida con `clamp()`, layout/breakpoints/safe-areas, inventario de ~30 componentes, ~50 animaciones agrupadas por trigger, sistema de 3 tecnologías de icono, decisiones de rendimiento documentadas, accesibilidad en CSS | Crítica para UX/UI: define qué existe y qué convenciones respetar | Alta; coherente con el CSS actual. No documenta los estilos añadidos en Fase B (`.fly-glyph`, botón "Continuar partida", UI del Reto del día) |
| `docs/ROADMAP.md` (190 líneas) | Plan de trabajo priorizado con dificultad/beneficio/prioridad + arquitectura de nube propuesta | 8 bloques (bugs P0, arquitectura, funcional, visual, usabilidad, seguridad, operaciones, nube en 4 fases), orden de ejecución A→D, y un bloque de **Estado** que confirma: Fase A ✅ (v1.7.2), Fase B ✅ (v1.8.0), Fase B ampliada ✅ (v1.9.0) | Crítica: es la lista priorizada previa — este plan maestro la respeta y la refina hacia "cierre de V1" en vez de duplicarla | Muy alta y la más actualizada de todas (única que refleja v1.9.0). Marca explícitamente qué está bloqueado por decisión del propietario (telemetría, hosting/nube) |
| `CLAUDE.md` (raíz) | Reglas operativas del repo para el asistente | Stack (vanilla, sin build), comandos (tests/lint/CI/servidor), mapa de archivos, protocolo de release (`tools/bump-version.sh`), reglas de trabajo (no releer `game.js` entero, i18n obligatorio, retrocompatibilidad de `cv_meta`) | Crítica operativa | Muy alta; verificada contra el repo (script, tests y CI existen) |

**Cómo encajan entre sí:** forman una cadena deliberada — `ARCHITECTURE` (dónde) → `MIGRATION_SPEC` (qué exactamente) → `REQUIREMENTS` (qué debe cumplirse) → `DESIGN_SYSTEM` (cómo se ve) → `ROADMAP` (qué falta y en qué orden) → `CLAUDE.md` (cómo trabajar). Se citan entre sí correctamente y no se contradicen en reglas de juego. La única fractura es **temporal**: cuatro de los cinco docs son una foto de v1.7.1 mientras el código y el ROADMAP van por v1.9.0.

**Contradicciones, huecos y ambigüedades detectadas (resumen; detalle en §5 y §13):**
1. **Desfase documental v1.7.1 vs v1.9.0** — MIGRATION_SPEC/REQUIREMENTS/ARCHITECTURE no documentan RunSave, RNG seedeado, Reto del día, cofre premium, reroll, ni el vuelo de convergencia. Quien tome estos docs como "única fuente de verdad" (su propósito declarado) reimplementaría un juego incompleto.
2. **Copy del home falso** (verificado en `index.html:89`): la tarjeta de Clásico dice "Juega en el tablero **contra amigos o bots**" — no existen ni amigos ni bots. Existe además una string muerta `home_tourneys` ("Torneos") en ambos idiomas que promete otra feature inexistente.
3. **Multijugador**: REQUIREMENTS RF-26 lo define como placeholder, ROADMAP lo pone en P2/P3 (bloqueado por nube), pero la UI de V1 le dedica 1 de las 3 tarjetas del home + 1 modal + copy. Contradicción producto/alcance: la V1 promete en su pantalla principal algo que no entra en V1.
4. **Solape de modos**: Clásico (250 niveles con estrellas) y Aventura (progresión infinita por biomas) compiten por el mismo rol de "modo de progresión"; Contrarreloj y el nuevo Reto del día son mecánicamente el mismo juego (el reto ES un tablero de Contrarreloj seedeado). Ningún doc define jerarquía entre modos ni cuál es "el principal".
5. **`infected`**: definido en `Tiles.DEFS` con CSS listo, sin lógica (REQUIREMENTS §4, ROADMAP 1.3/3.4 P2). Sigue siendo un cabo suelto en v1.9.0.
6. **Ambigüedad "ConvergenceOnline"**: el repo se llama *Online* pero la app es deliberadamente offline-first sin backend (RNF-02/03). La parte "online" está toda en ROADMAP §8 bloqueada por decisión del propietario. La V1 real es offline; hay que asumirlo explícitamente.
7. **Hosting sin formalizar**: ROADMAP §8.1 dice que formalizar hosting estático "debería hacerse YA" y sigue pendiente — un juego sin URL pública no es una V1 lanzada.
8. **Heurística menor**: los `?v=` de `index.html` divergen entre sí (`styles.css?v=v141`, `game.js?v=v133`) — es **por diseño** (el script incrementa cada uno solo cuando cambia ese archivo), pero ningún doc lo aclara y parece un bug a primera vista.

# 2. Instrucciones y reglas del repositorio

Extraídas de `CLAUDE.md` (no hay otros docs de workflow/convenciones):

- **Stack intocable en V1:** 100% vanilla HTML+CSS+JS, sin framework, sin bundler, sin `package.json`, sin dependencias. Los tests (`node --test`) y el lint (`npx eslint@9`) funcionan sin package.json a propósito.
- **Comandos:** servidor `python3 -m http.server 8080`; tests `node --test 'tests/*.test.js'`; lint `npx --yes eslint@9 .`; CI en `.github/workflows/ci.yml` en cada push. Debug con `?dev` → `window.__cv`.
- **Protocolo de release obligatorio:** todo cambio a `styles.css`/`game.js` exige `tools/bump-version.sh X.Y.Z` (sube a la vez `VERSION`, `CACHE` de `sw.js` y los `?v=` de `index.html`). Nunca a mano. Commit tipo "Bump version to X.Y.Z; update cache version and asset links".
- **Método de trabajo:** no releer `game.js`/`styles.css` completos; usar la tabla de módulos de ARCHITECTURE §4 y `Read` acotado. Cambios de gameplay → validar fórmula en MIGRATION_SPEC antes de tocar. Cambios visuales → localizar token/clase en DESIGN_SYSTEM antes de grepear.
- **i18n obligatorio:** ninguna string nueva hardcodeada; añadir clave ES+EN en `I18n.DICT` y usar `data-i18n`/`I18n.t()`. El español vive embebido en `Config.MODES`, el inglés en claves `m_{modeId}_{n|d|g}`.
- **Retrocompatibilidad de datos:** cualquier cambio al esquema `cv_meta` debe rellenar campos faltantes al cargar (patrón `MetaData._v`); prohibido romper partidas guardadas de usuarios reales.
- **Criterios de corte del ROADMAP:** no empezar Fase C (online) sin tests en verde en CI; no empezar multijugador sin la validación por replay diseñada.

# 3. Qué es realmente el proyecto hoy

**Producto:** Convergence es un puzzle casual mobile-first, instalable como PWA, 100% offline tras la primera carga, sin cuentas ni backend. Mecánica única y original: tocas una celda **vacía** de un tablero 8×8; el juego mira el icono más cercano en las 4 direcciones; si 2+ coinciden, convergen y puntúan. Encima de esa mecánica hay combos con ventana temporal, modo Fiebre, tiles especiales (14 tipos), y una meta-capa completa: XP/niveles/rangos, misión diaria + desafío semanal determinísticos, 10 logros, racha diaria, 3 monedas, cofres, tienda de 10 skins de tablero + 6 temas.

**A quién sirve:** jugador casual de móvil (sesiones de 2–10 min, interrupciones constantes — de ahí el valor del RunSave añadido en v1.8), que aprecia jugar sin conexión, sin anuncios, sin cuenta y sin fricción. El perfil "puzzle arcade" (Supervivencia/Contrarreloj) es el segundo público.

**Loop principal:** jugar partida → ganar puntos/monedas/XP → progresar (misión diaria, racha, estrellas de mundo, mejor oleada) → gastar (skins/temas/cofre premium/revivir) → volver mañana (recompensa diaria + Reto del día).

**Pantallas:** `login` (alta), `start` (hub con recompensa diaria, récord, 3 tarjetas, nav inferior), `modes` (selector de 6 modos), `worlds` (mapa de Clásico), `game`. Más 13 modales.

**Modos existentes:** Tutorial (Coach de 2 pasos), Clásico (5 mundos × 50 niveles, estrellas), Aventura (infinita, 6 biomas, jefes), Contrarreloj (60s, reposición decreciente), Supervivencia (oleadas, vidas, 5 boosters, frenesí, 3 dificultades), Zen (sin derrota), Multijugador (placeholder), y desde v1.9.0 el **Reto del día** (Contrarreloj seedeado por fecha, igual para todos).

**Estado de madurez:**
- **Maduro:** mecánica core (con tests), Supervivencia (el modo más profundo y pulido), sistema de progresión/economía (con sumideros desde v1.8), design system (coherente y documentado), PWA/offline, i18n, accesibilidad base (tap targets, aria-live, reduced-fx, teclado en tablero), pipeline (tests+lint+CI+script de release).
- **Incompleto:** presentación/jerarquía de modos (home confuso, copy falso), onboarding más allá del Coach de 2 pasos (los objetivos de Aventura y los sistemas de Supervivencia no se explican), estados vacíos (ROADMAP 5.5), auditoría de contraste (4.4) y texto grande (5.7), anuncios a lector de pantalla parciales (5.2), hosting/deploy (8.1), documentación desfasada.
- **Contradictorio:** tarjeta Multijugador en el home de una V1 offline; subtítulo "contra amigos o bots"; dos modos de progresión compitiendo; `infected` definido sin lógica.

**Clasificación de certeza:**
- **Confirmado explícitamente:** todo lo de MIGRATION_SPEC §1–14 (reglas, fórmulas, datos); el estado de fases del ROADMAP; las reglas operativas de CLAUDE.md.
- **Implícito pero no totalmente definido:** jerarquía de modos (cuál es el principal); el rol del Reto del día dentro del menú; el criterio de "V1 lista" (ningún doc lo define — este documento lo cierra en §6).
- **Ambiguo:** el "Online" del nombre vs. la filosofía offline-first; si los skins podrían dar bonus (el bug 1.1 lo insinuó y el ROADMAP lo marca como decisión de diseño abierta); telemetría (bloqueada por decisión del propietario).
- **Fuera de alcance de V1 (por decisión documental previa, ROADMAP fases C/D):** multijugador real, leaderboard online, sync de progreso, push, ES modules, mundo 6, mecánica `infected`, tema claro.

# 4. Qué falta para cerrar una V1 real

En una frase: **el juego está hecho; lo que falta es coherencia de producto, pulido de presentación y salida a producción.** Concretamente, cinco brechas:

1. **Promesas falsas en la superficie del producto** — el home promete multijugador, "amigos o bots" y (en strings muertas) torneos. Una V1 no puede mentir en su pantalla principal. Coste de arreglo: horas.
2. **Jerarquía de modos inexistente** — 6 modos + reto diario presentados sin foco. El jugador nuevo no sabe por dónde empezar ni qué diferencia a Aventura de Clásico. Coste: reorganización de home/modes + copy, sin tocar gameplay.
3. **Onboarding y legibilidad sistémica** — el Coach cubre la mecánica core, pero nada explica objetivos de Aventura, sistemas de Supervivencia (frenesí/carga/boosters) ni la economía. Coste: bajo (patrones ya existentes: banner de objetivo, `world-nov`, modal how).
4. **Acabado transversal** — estados vacíos (5.5), contraste (4.4), texto grande (5.7), anuncios SR (5.2), intro de bioma (4.5). Todo ya identificado en el ROADMAP como pendiente barato.
5. **Producción** — hosting estático formal con HTTPS+cabeceras+deploy automático (8.1/7.3). Sin URL pública no hay V1. Además: sincronizar la documentación a v1.9.0 para que el corpus vuelva a ser fiable.

# 5. Auditoría crítica orientada a V1

Severidad: 🔴 bloquea V1 · 🟠 daña V1 · 🟡 pulido. Acción: **M**ejorar / **S**implificar / **F**usionar / **E**liminar / **P**ostergar.

### Alcance del producto
| Problema | Evidencia | Impacto en V1 | Sev. | Acción |
|---|---|---|---|---|
| El home dedica 1/3 de su espacio principal a Multijugador, que no entra en V1 (bloqueado por nube, ROADMAP §8) | REQUIREMENTS RF-26; ROADMAP 3.5 P2/P3; `index.html:96` | El producto promete lo que no da; primera impresión de "app a medias" | 🔴 | **E** de la UI de V1 (código puede quedar latente) |
| Subtítulo de Clásico: "contra amigos o bots" — falso | `index.html:89`, claves `home_classic_sub` ES/EN | Mentira directa en el CTA principal | 🔴 | **M** (copy) |
| Strings muertas `home_tourneys*` ("Torneos") en ambos idiomas | `game.js` I18n.DICT (líneas ~228/295) | Ruido; riesgo de que alguien las cablee | 🟡 | **E** |
| El nombre "ConvergenceOnline" vs producto offline-first | RNF-02/03; ROADMAP §8 | Confusión de expectativas; irrelevante para el usuario final (la app se llama "Convergence") | 🟡 | Asumir: V1 = offline. Documentado aquí |

### Arquitectura
| Problema | Evidencia | Impacto | Sev. | Acción |
|---|---|---|---|---|
| IIFE único de ~4000 líneas | ARCHITECTURE §4; ROADMAP 2.2 | Mantenibilidad, no funcionalidad. Partirlo ahora es riesgo sin beneficio de V1 | 🟡 | **P** (Fase C, como ya decidió el ROADMAP) |
| Docs anclados a v1.7.1 con código en v1.9.0 | Cabeceras de ARCHITECTURE/MIGRATION_SPEC; Estado del ROADMAP | El corpus documental pierde su propósito declarado ("única fuente de verdad") | 🟠 | **M** (sync documental) |
| `infected` definido sin lógica | Tiles.DEFS; REQUIREMENTS §4; ROADMAP 1.3/3.4 | Código muerto visible en el registro | 🟡 | **E** del registro en V1 (reintroducir con 3.4 en v1.x post-lanzamiento) |
| Sin JSDoc/@ts-check en State/Meta/Engine | ROADMAP 2.4 pendiente | Previene regresiones tipo bug 1.1, pero no bloquea | 🟡 | **P** parcial (anotar solo `cv_meta` y `State`, lo demás post-V1) |

### Requisitos
| Problema | Evidencia | Impacto | Sev. | Acción |
|---|---|---|---|---|
| REQUIREMENTS §4 lista como "no implementado" cosas ya resueltas (sumideros, ui-system, cost) | REQUIREMENTS §4 vs ROADMAP Estado v1.8/1.9 | Checklist de aceptación desactualizado → auditorías futuras fallan | 🟠 | **M** (actualizar §4) |
| No existe criterio escrito de "V1 terminada" | Ausente en los 5 docs | Sin línea de meta, el alcance deriva | 🔴 | **M** (§6 de este doc) |

### UX
| Problema | Evidencia | Impacto | Sev. | Acción |
|---|---|---|---|---|
| Sin jerarquía de modos: `modes` lista 6 tarjetas planas; el home 3 tarjetas de peso idéntico | MIGRATION_SPEC §12; MODE_CARDS §14 | Parálisis de elección en el momento más crítico (primer minuto) | 🟠 | **S** (reordenar + CTA único "Jugar" → continúa donde estabas) |
| Objetivos de Aventura (score/survive/boss) solo se comunican con un banner breve | ROADMAP 4.5 | Jugador pierde sin entender por qué; frustración evitable | 🟠 | **M** (intro de capítulo reutilizando `world-nov`) |
| Sistemas de Supervivencia (carga, frenesí, boosters) sin explicación in-game | MIGRATION_SPEC §7; modal how solo cubre la core | El modo más profundo es ilegible para nuevos | 🟠 | **M** (1 pantalla pre-partida en `modal-surv-diff`, ya existente) |
| Reto del día (v1.9) sin lugar claro en la navegación | ROADMAP Estado B+ | Feature de retención estrella invisible | 🟠 | **M** (slot fijo en home) |
| RunSave excluye Supervivencia/tutorial sin comunicarlo | ROADMAP Estado (2.5 "v1 excluye supervivencia") | Usuario pierde una run larga y no sabe que era esperable | 🟡 | **M** (aviso en pausa de Supervivencia) |

### UI visual
| Problema | Evidencia | Impacto | Sev. | Acción |
|---|---|---|---|---|
| Contraste de los 12 colores de icono × 9 skins sin auditar (ej. `white #e8eefc` sobre hielo/dorado) | ROADMAP 4.4; DESIGN_SYSTEM §2/§7 | Legibilidad del gameplay en skins que el usuario paga | 🟠 | **M** (auditar y ajustar `--cell-filled-bg` por skin) |
| `largeText` sin auditoría de overflow (`.g-chip`, `.econ-pill`) | ROADMAP 5.7 | Rompe layout para quien más lo necesita | 🟡 | **M** |

### Design system
| Problema | Evidencia | Impacto | Sev. | Acción |
|---|---|---|---|---|
| Componentes de Fase B (`.fly-glyph`, botón continuar, UI reto diario) fuera del inventario | DESIGN_SYSTEM §5 vs código v1.9 | Inventario incompleto | 🟡 | **M** (sync documental, mismo ítem que arquitectura) |
| Sin fallback `color-mix()` (Safari <16.2) | DESIGN_SYSTEM §1/§9; ROADMAP 1.6 (no marcado hecho) | Acentos invisibles en navegadores viejos; nicho | 🟡 | **S**: en vez de fallbacks masivos, detectar soporte una vez y mostrar aviso "navegador no soportado" (RNF-08 ya asume evergreen) |

### Arquitectura de información y navegación
| Problema | Evidencia | Impacto | Sev. | Acción |
|---|---|---|---|---|
| Doble vía de acceso a jugar (tarjetas home + pantalla `modes` + botón play) sin regla clara | MIGRATION_SPEC §12 (`data-act` play/home-classic/home-surv/home-multi) | Redundancia que confunde; dos rutas a lo mismo con distinta profundidad | 🟠 | **S** (home = accesos directos; `modes` = catálogo completo; play = continuar) |
| Sin historial de pantallas (back = ?) | ARCHITECTURE §7 "No hay historial" | Aceptable en 5 pantallas; Android back cierra la PWA | 🟡 | **P** (aceptar para V1; documentado) |

### Modos de juego
Ver §8 (análisis modo a modo). Resumen de problemas: Multijugador visible (🔴 E), Aventura/Clásico sin diferenciación de rol (🟠 M copy/posicionamiento), Contrarreloj/Reto del día duplicados conceptualmente (🟡 F de presentación), Tutorial listado como "modo" cuando es onboarding (🟡 S).

### Meta / profundidad estratégica
| Problema | Evidencia | Impacto | Sev. | Acción |
|---|---|---|---|---|
| Economía ya tiene sumideros (v1.8) pero nadie los descubre: cofre premium y reroll viven enterrados en modales | ROADMAP Estado B; MIGRATION_SPEC §4 (pre-B) | Los sumideros no cumplen su función si no se ven | 🟠 | **M** (badge/hint contextual cuando puedes pagarlos) |
| Botón "comprar gemas" → toast "pronto" | REQUIREMENTS §4 | Otra promesa vacía (¿monetización futura?) en V1 | 🟠 | **E** del botón en V1 |
| Precio de revivir fijo (120) vs recompensas crecientes de oleada | MIGRATION_SPEC §4 | Trivializa el final de runs largas; balance, no bug | 🟡 | **P** (decisión de balance post-datos; no tocar números sin evidencia, regla CLAUDE.md) |

### Feedback del sistema
| Problema | Evidencia | Impacto | Sev. | Acción |
|---|---|---|---|---|
| Anuncios a lector de pantalla parciales (combos/oleadas/fin no siempre anunciados) | ROADMAP 5.2 "parcial" | Accesibilidad AA incompleta | 🟡 | **M** (auditoría de `announce()` en 6 eventos clave) |
| Señal de peligro = solo ocupación ≥85%; ya existe aviso "sin jugadas" (v1.9) | MIGRATION_SPEC §13.4; ROADMAP 5.6 ✅ | Cubierto; verificar que ambos conviven sin solaparse | 🟡 | Verificación, no cambio |

### Onboarding
| Problema | Evidencia | Impacto | Sev. | Acción |
|---|---|---|---|---|
| Coach de 2 pasos enseña la mecánica pero no el loop (combo→fiebre→monedas→tienda) | MIGRATION_SPEC §2.1 | Retención D1: el jugador no sabe "para qué" juega | 🟠 | **M** (paso 3 de coach: un combo; + tooltip primera moneda ganada) |
| Tutorial presentado como modo en el selector | Config.MODE_ORDER | Ruido en el menú | 🟡 | **S** (sacarlo del grid; accesible desde "¿Cómo se juega?") |

### Estados vacíos / errores / loading
| Problema | Evidencia | Impacto | Sev. | Acción |
|---|---|---|---|---|
| Cofres a 0, logros vacíos, leaderboard local vacío → listas vacías sin CTA | ROADMAP 5.5 | Pantallas secundarias parecen rotas la primera semana | 🟠 | **M** (estado vacío con CTA por pantalla) |
| Sin pantalla de error global (JS falla → pantalla negra); `ErrLog` captura pero no informa | ARCHITECTURE módulo 1 | Un crash real deja al usuario sin salida | 🟡 | **M** barato: `window.onerror` → toast + botón recargar |
| Loading: no aplica (estático, sin red); primer paint rápido por diseño | RNF-07 | — | — | Nada |

### Responsive
| Problema | Evidencia | Impacto | Sev. | Acción |
|---|---|---|---|---|
| Sistema de breakpoints sólido y documentado; sin container queries (aceptado) | DESIGN_SYSTEM §4/§9 | Bien cubierto | 🟡 | Solo smoke-test manual en la matriz de §6 |

### Accesibilidad
Cubierto arriba (contraste 4.4, largeText 5.7, SR 5.2). Base fuerte: tap targets, focus-visible, reduced-motion + reduced-fx propio, teclado en tablero (confirmado implementado, corrección del propio ROADMAP).

### Mantenibilidad
| Problema | Evidencia | Impacto | Sev. | Acción |
|---|---|---|---|---|
| Sync documental (el ítem transversal nº1) | Todo §1 | La ventaja competitiva del repo (docs exhaustivos) se está pudriendo | 🟠 | **M** — tarea V1-02 |
| CI verde ya exigido para avanzar de fase | ROADMAP §9 criterio de corte | Cumplido (32 tests) | — | Mantener |

# 6. Definición exacta del alcance V1

### 6.1 Debe estar sí o sí (bloquea el lanzamiento)
1. Home sin promesas falsas: fuera tarjeta Multijugador + modal `modal-multi` de la navegación, copy de Clásico corregido, strings muertas eliminadas, botón "comprar gemas" retirado.
2. Jerarquía de modos: home reorganizado (CTA principal "Jugar/Continuar", Reto del día visible, accesos a Clásico y Supervivencia), pantalla `modes` con los 5 modos jugables agrupados y Tutorial fuera del grid.
3. Onboarding mínimo completo: coach actual + explicación de objetivos de Aventura (intro de capítulo) + pantalla de sistemas en `modal-surv-diff`.
4. Estados vacíos en cofres/logros/leaderboard + handler global de error con recuperación.
5. Auditoría de contraste (celdas × skins) y de `largeText` corregidas.
6. Anuncios SR de los 6 eventos clave (convergencia múltiple, hito de combo, oleada, vida perdida, fin de partida, nivel completado).
7. Sync documental: MIGRATION_SPEC/REQUIREMENTS/ARCHITECTURE/DESIGN_SYSTEM al día con v1.9.0+ (incluyendo lo que este plan cambie).
8. Producción: hosting estático formal con HTTPS, cabeceras de seguridad (ROADMAP 6.4), deploy automático desde `main` (7.3), y smoke-test de instalación PWA en iOS+Android.
9. Release final con `tools/bump-version.sh`, tests y lint en verde.

### 6.2 Debería estar si el coste es razonable
- Aviso "Supervivencia no guarda la partida" en su pausa.
- Descubribilidad de sumideros (badge en cofre premium/reroll cuando son pagables).
- Paso 3 del coach (encadena un combo).
- Detección de `color-mix()` sin soporte → aviso de navegador.
- Previsualización animada de skins en tienda (ROADMAP 4.3) — barata y "vende" el sumidero principal.

### 6.3 No debe entrar en V1
Multijugador (3.5), leaderboard online (3.6), sync de progreso (3.7), push (3.8), telemetría con endpoint (7.1 — bloqueada por decisión del propietario), ES modules (2.2), tema claro (4.2), mundo 6 (3.10), mecánica `infected` (3.4), cualquier cambio de balance numérico sin datos.

### 6.4 Debe eliminarse o postergarse
- **Eliminar de la UI de V1:** tarjeta+modal Multijugador, strings de torneos, botón comprar gemas, `infected` del registro de tiles.
- **Postergar explícitamente:** todo §6.3; refactor de arquitectura; monetización.

### 6.5 Criterio de cierre — "V1 está cerrada cuando…"
1. Todos los ítems de §6.1 completados y desplegados en la URL pública.
2. CI en verde (tests + lint + `node --check`).
3. Checklist de paridad de MIGRATION_SPEC §16 pasa **contra la app desplegada** (no contra local).
4. Smoke-test manual de la matriz mínima: iPhone Safari (instalado y browser), Android Chrome (instalado y browser), escritorio ≥720px — flujo completo: alta → tutorial → 1 nivel de Clásico → 1 run de Supervivencia → compra en tienda → reto del día → cierre/reapertura offline con progreso intacto y RunSave funcionando.
5. Ninguna pantalla contiene texto que prometa una feature no incluida.
6. Los 5 docs de `docs/` reflejan la versión desplegada.

# 7. Mejoras sobre lo ya existente

(Esfuerzo: 🟢 horas · 🟡 días. Prioridad: P0 bloquea release · P1 debería · P2 pulido. Todas las tareas tienen ID de backlog en §11.)

| # | Elemento | Problema actual | Doc origen | Solución propuesta | Impacto | Esf. | Prio | Dep. | ¿Bloquea? |
|---|---|---|---|---|---|---|---|---|---|
| M1 | Home (`screen-start`) | Copy falso + tarjeta multi + sin reto diario | REQUIREMENTS §4, ROADMAP 3.5, index.html:88-97 | 3 slots: **Jugar** (continúa RunSave o último modo), **Reto del día** (con estado hecho/pendiente), **Supervivencia**; fila secundaria: Clásico (mapa), Zen, Contrarreloj vía `modes`. Copy honesto ES/EN | Primera impresión coherente | 🟡 | P0 | — | Sí |
| M2 | Pantalla `modes` | 6 tarjetas planas, tutorial mezclado | MIGRATION_SPEC §2/§12 | Agrupar: "Progresión" (Clásico, Aventura), "Puntuación" (Contrarreloj + Reto del día como variante), "Relax" (Zen). Tutorial fuera, enlazado desde modal-how | Elección informada | 🟢 | P0 | M1 | Sí |
| M3 | Shell / navegación | Doble vía home-cards vs modes sin regla | MIGRATION_SPEC §12 | Regla única: home = "qué hago ahora" (3 CTA), modes = catálogo, bottom-nav sin cambios | Menos ambigüedad | 🟢 | P1 | M1 | No |
| M4 | Flujo core primera vez | Coach termina y suelta al jugador en el home sin dirección | MIGRATION_SPEC §2.1 | Al acabar coach: CTA directo "Jugar nivel 1" (Clásico M1L1). +Paso 3 de coach (combo) | Retención D0 | 🟢 | P1 | — | No |
| M5 | `modal-surv-diff` | Solo elige dificultad; sistemas sin explicar | MIGRATION_SPEC §7 | Añadir bloque compacto: 3 líneas ilustradas (carga→booster, frenesí, vidas) reutilizando `iconV2` | Legibilidad del modo estrella | 🟢 | P1 | — | No |
| M6 | Aventura | Objetivo del nivel solo en banner | ROADMAP 4.5 | Intro de capítulo (tarjeta bioma + mods + objetivo) patrón `world-nov`, 1 vez por capítulo | Menos derrotas incomprendidas | 🟢 | P1 | — | No |
| M7 | Estados vacíos | Cofres/logros/leaderboard vacíos sin CTA | ROADMAP 5.5 | Estado vacío con icono + texto + CTA por pantalla ("Gana cofres cada 10 oleadas → Jugar Supervivencia") | Pantallas secundarias vivas | 🟢 | P0 | — | Sí |
| M8 | Errores | Crash JS = pantalla muerta | ARCHITECTURE mod.1 | `window.onerror`/`unhandledrejection` → toast persistente + botón recargar; ErrLog ya persiste | Recuperabilidad | 🟢 | P0 | — | Sí |
| M9 | Loading | — (estático); pero SW nuevo avisa por toast sin acción | ARCHITECTURE §8 | Toast de versión nueva con botón "Actualizar" (skipWaiting+reload) | Updates que llegan | 🟢 | P1 | — | No |
| M10 | Claridad del sistema | Sumideros invisibles | ROADMAP Estado B, 3.1/3.2 | Badge "•" en Cofres cuando ≥25💎, y en Misiones cuando hay ticket y misión incompleta | Economía circulando | 🟢 | P1 | — | No |
| M11 | Contraste | 12 colores × 9 skins sin auditar | ROADMAP 4.4, DESIGN_SYSTEM §2 | Script una-vez de ratios (docs/tools), ajustar `--cell-filled-bg` de skins que fallen | Gameplay legible | 🟢 | P0 | — | Sí |
| M12 | Texto grande | Overflow en chips/pills | ROADMAP 5.7 | Auditar con 18.5px raíz; `flex-wrap`/`min-width:0` donde rompa | Accesibilidad real | 🟢 | P0 | — | Sí |
| M13 | Lector de pantalla | `announce()` parcial | ROADMAP 5.2 | Auditar 6 eventos clave y añadir claves i18n de anuncio | AA | 🟢 | P0 | — | Sí |
| M14 | Consistencia visual | Componentes Fase B fuera del design system | DESIGN_SYSTEM §5 | Documentarlos (parte de V1-02) y verificar que usan tokens existentes | Sistema íntegro | 🟢 | P1 | V1-02 | No |
| M15 | Responsive | Sin verificación formal reciente | DESIGN_SYSTEM §4 | Smoke-test matriz §6.5; corregir solo lo que falle | Confianza de release | 🟢 | P0 | todo | Sí |
| M16 | Tienda | Compra confirmada (✅ Fase A) pero preview estática | ROADMAP 4.3 | Activar animación ambiental en `.board-thumb` on focus/hover | Vende el sumidero | 🟢 | P2 | — | No |

# 8. Propuesta final de modos/sistemas para V1

### Análisis por modo

| Modo | Propósito | Valor V1 | Claridad | Coste restante | Profundidad | Rejugabilidad | Solape | Recomendación |
|---|---|---|---|---|---|---|---|---|
| **Clásico** | Progresión curada (mundos/estrellas/obstáculos) | Alto — es la columna vertebral | Alta (mapa, estrellas) | 0 (hecho) | Media-alta | Alta (250 niveles + 3★) | Con Aventura | **Mantener como modo principal** |
| **Supervivencia** | Skill/arcade infinito con sistemas propios | Alto — el más profundo | Media (sistemas sin explicar → M5) | 0 | Alta | Muy alta | Bajo | **Mantener como modo secundario destacado** |
| **Contrarreloj** | Puntuación pura en 1-2 min | Medio | Alta | 0 | Baja-media | Media | Con Reto del día | **Mantener; fusionar presentación** con el Reto del día ("Contrarreloj → juega el reto de hoy o partida libre") |
| **Reto del día** (v1.9) | Retención diaria, tablero igual para todos | Alto | Media (invisible → M1) | 0 | = Contrarreloj | Diaria | Es Contrarreloj seedeado | **Mantener, promover a slot fijo del home** |
| **Aventura** | Progresión infinita por biomas con jefes | Medio — funcional y única en objetivos variables | Baja (objetivos → M6) | 0 | Media-alta | Alta | **Alto con Clásico** | **Mantener pero reposicionar**: "el modo infinito para cuando dominas Clásico". No invertir más en él en V1 aparte de M6. Fusionarlo/eliminarlo costaría más que mantenerlo y perdería contenido funcional |
| **Zen** | Relax sin derrota | Medio-bajo pero barato y diferenciado | Alta | 0 | Baja (a propósito) | Media | Bajo | **Mantener** (audiencia casual; coste 0) |
| **Tutorial** | Onboarding | Alto como onboarding, nulo como "modo" | — | 0 | — | — | — | **Sacar del grid de modos**; vive en primer arranque + modal-how |
| **Multijugador** | Placeholder | **Negativo** (promesa vacía) | — | Enorme (Fase C/D) | — | — | — | **Eliminar de la UI de V1**; volverá con ROADMAP 8.4 |

### Estructura final de modos V1

- **Modo principal:** Clásico — el CTA "Jugar" del home continúa aquí (RunSave o siguiente nivel).
- **Secundario:** Supervivencia (tarjeta propia en home).
- **Retención diaria:** Reto del día (slot fijo en home, junto a recompensa diaria).
- **Catálogo completo** en `modes`: Progresión (Clásico, Aventura) · Puntuación (Contrarreloj + reto) · Relax (Zen).
- **Onboarding:** Coach al primer arranque, repetible desde "¿Cómo se juega?".
- **Fuera:** Multijugador, Torneos (string muerta), Tutorial-como-modo.

### Sistemas (evaluación pedida en Fase 7 del encargo)

- **¿Comunica bien las decisiones?** La mecánica sí (feedback multicapa: visual/sonoro/háptico, documentado en DESIGN_SYSTEM §6). La meta no del todo: sumideros y reto diario invisibles (M10/M1).
- **¿Suficiente profundidad?** Sí para V1: combos+fiebre+tiles+boosters+3 dificultades. No añadir sistemas.
- **¿Evita confusión?** El invariante anti-confusión de iconos (MIGRATION_SPEC §11) es excelente diseño. La confusión está en la capa de presentación, no en las reglas.
- **¿Fomenta variedad?** Sí (misión diaria determinística + semanal + reto del día + 5 modos).
- **¿Aprendizaje progresivo?** A medias: variedad de iconos crece 1/3 niveles (bien), pero los sistemas de modos no se enseñan (M4/M5/M6 lo cierran).
- **¿Se mantiene vivo sin sobrecomplicar?** Sí: misión/semanal/reto son determinísticos sin servidor — cero coste operativo.
- **Marcos de equilibrio:** no tocar números en V1 (regla CLAUDE.md: validar contra MIGRATION_SPEC; sin telemetría no hay datos para rebalancear). Única excepción permitida: los ajustes que ya decidió el ROADMAP y están hechos.

# 9. Rediseño visual y UX para V1

**Principio:** el design system actual (tokens, componentes arcade, 9 skins, 50 animaciones con gobernador de rendimiento) es un activo maduro — **se conserva entero**. No hay rediseño de identidad; hay cierre de coherencia.

**Conservar:** paleta oscura + acentos por modo/mundo/bioma; botones "chunky" 3D; sistema de skins por custom properties; animaciones compositor-only; tipografía de sistema con `clamp()`; safe-areas; z-index scale.

**Corregir:** contraste celda×skin (M11); overflow con texto grande (M12); copy del home (M1).

**Simplificar:** home a 3 decisiones; selector de modos agrupado; retirar CTA muertos (comprar gemas, multi).

**Estandarizar:** patrón único de **estado vacío** (icono `iconV2` + título + subtítulo + CTA — hoy no existe como componente) y patrón de **badge de notificación** en bottom-nav (para M10). Son los **dos únicos componentes nuevos** que faltan para cerrar V1.

**Evolución del design system:** documentar ambos componentes nuevos + los de Fase B en DESIGN_SYSTEM §5 (tarea V1-02); ninguna decisión de tokens cambia.

### Pantalla a pantalla

**`login` (alta)** — Objetivo: entrar en <10s. Contenido: nombre + avatar. CTA: "Empezar". Layout actual válido. Estados: validación de nombre vacío (existe). Móvil: teclado no debe tapar el CTA (verificar en matriz M15). A11y: label del input + focus inicial. Mejora exacta: ninguna estructural; solo verificación.

**`start` (home)** — Objetivo: decidir "qué hago ahora" en 1 vistazo. Prioridad: (1) CTA **Jugar/Continuar** (mantiene `#btn-play` con `ctaPulse`), (2) Reto del día con estado (pendiente/completado + mejor marca `Meta.dailyRun`), (3) recompensa diaria (existente), (4) tarjetas Clásico y Supervivencia con copy honesto. Secundarios: bottom-nav (medallas/tienda/misiones) con badges M10. Layout: appbar + hero CTA + fila de 2 tarjetas + nav (reutiliza `.app-card`, `.btn-reward`). Estados: reto hecho → check + marca. Móvil: sin scroll vertical en ≥640px de alto. A11y: `aria-label` con estado del reto. Mejoras: M1, M3, M10.

**`modes`** — Objetivo: catálogo informado. 3 grupos con encabezado (claves i18n nuevas), tarjetas `.mode-card` existentes, sin tutorial ni multi. CTA principal: la tarjeta del último modo jugado marcada `[aria-checked]`. Mejoras: M2.

**`worlds`** — Objetivo: progresión visible de Clásico. Ya maduro (nodos, rail, tabs, recompensa de mundo). Única mejora: estado vacío no aplica; verificar contraste de nodos bloqueados (parte de M11). Sin cambios estructurales.

**`game`** — Objetivo: jugar sin distracción. Grid 3fr/auto/2fr se conserva. Mejoras: M13 (anuncios SR), aviso RunSave en pausa de Supervivencia (§6.2), intro de capítulo en Aventura (M6). Nada más — es la pantalla más pulida.

**Modales** — `modal-multi`: se retira de la navegación (el nodo puede quedar en HTML latente). `modal-surv-diff`: bloque de sistemas (M5). `modal-chests`/`modal-medals`: estado vacío (M7). `modal-over`: ya completo (stats, XP, logros, compartir con semilla). Resto sin cambios.

# 10. Roadmap de implementación

Fases pensadas para ejecutarse en orden por un modelo ejecutor barato, con release al final de cada fase (siempre vía `tools/bump-version.sh` + tests + lint).

- **Fase V1-α — Verdad y coherencia (bloqueante, ~1 semana):** V1-01 → V1-03 → V1-04 → V1-05 → V1-06 → V1-02. Elimina promesas falsas, reordena home/modes, sincroniza docs.
- **Fase V1-β — Acabado UX (bloqueante, ~1 semana):** V1-07 → V1-08 → V1-09 → V1-10 → V1-11 → V1-12.
- **Fase V1-γ — Onboarding y descubribilidad (no bloqueante, días):** V1-13 → V1-14 → V1-15 → V1-16 → V1-17.
- **Fase V1-δ — Producción y cierre (bloqueante, días):** V1-18 → V1-19 → V1-20 → checklist §6.5.

**Tareas bloqueantes del lanzamiento:** V1-01, 03, 04, 05, 06, 02, 07, 08, 09, 10, 11, 12, 18, 19, 20.
**No bloqueantes:** V1-13…17, 21, 22.
**Recortes para no romper alcance:** si el tiempo aprieta, V1-γ entera pasa a v1.x.1; nunca recortar V1-α ni V1-δ.

# 11. Backlog listo para ejecutar

Formato por tarea: **ID · Título** — Objetivo / Problema / Fuente / Área / Cambio exacto / Aceptación / Dep. / Prio / Complejidad / ¿Bloquea? (El prompt ejecutor de cada una está en §14.)

---

**V1-01 · Retirar Multijugador y promesas falsas de la UI**
- Objetivo: que ninguna superficie de V1 prometa features inexistentes. Problema: tarjeta home multi, `modal-multi`, `home_tourneys*`, botón "comprar gemas". Fuente: REQUIREMENTS §4, ROADMAP 3.5, auditoría §5.
- Área: `index.html` (tarjeta `data-act="home-multi"`), `game.js` (I18n.DICT: eliminar `home_tourneys*`; listener `home-multi`/`buy-gems`), sin tocar `Config.MODES` (multi no está ahí).
- Cambio exacto: eliminar la tarjeta del home; desregistrar `modal-multi` de la navegación (nodo HTML puede quedar); eliminar claves muertas ES+EN; retirar el pill/CTA de comprar gemas (dejar solo el contador).
- Aceptación: grep de `home_tourneys` sin resultados; ningún elemento visible abre `modal-multi`; tests y lint verdes. Dep: — · P0 · 🟢 · **Bloquea: sí**

**V1-02 · Sincronización documental a la versión actual**
- Objetivo: que los docs vuelvan a ser fuente de verdad. Problema: MIGRATION_SPEC/REQUIREMENTS/ARCHITECTURE/DESIGN_SYSTEM anclados a v1.7.1. Fuente: §1 de este plan.
- Área: `docs/*.md`. Cambio: añadir a MIGRATION_SPEC secciones para `RNG`/`State.seed`, `RunSave`, `Meta.dailyRun` + reto del día, cofre premium (25💎), reroll (1🎫), `?challenge=SEED`; actualizar REQUIREMENTS §4 (quitar lo resuelto, añadir RF del reto diario); actualizar ARCHITECTURE §8 (ui-system ya limpio) y tabla de módulos; añadir componentes Fase B + estado-vacío + badge a DESIGN_SYSTEM §5.
- Aceptación: ningún doc afirma algo falsificable contra el código actual; checklist §16 de MIGRATION_SPEC incluye las features nuevas. Dep: idealmente tras V1-01/03/04 (documentar el estado final) · P0 · 🟡 · **Bloquea: sí**

**V1-03 · Home reorganizado (3 decisiones + reto del día)**
- Objetivo: jerarquía clara en la pantalla principal. Problema/Fuente: §5 UX, M1. Área: `index.html` (screen-start), `game.js` (constructores de menú ~3476+, I18n.DICT), `styles.css` si hace falta variante de tarjeta.
- Cambio: CTA "Jugar/Continuar" (usa RunSave si existe, si no siguiente nivel de Clásico); slot Reto del día con estado (`Meta.dailyRun`, check si jugado hoy, mejor marca); tarjetas Clásico (copy nuevo: ES "Supera niveles y gana estrellas" / EN equivalente) y Supervivencia; recompensa diaria donde está.
- Aceptación: home muestra exactamente jugar/reto/clásico/supervivencia/recompensa; copy honesto en ES y EN; reto refleja estado real; navegable por teclado. Dep: V1-01 · P0 · 🟡 · **Bloquea: sí**

**V1-04 · Selector de modos agrupado, sin tutorial**
- Objetivo: catálogo legible. Fuente: M2. Área: constructor `buildModeMenu()` + I18n.DICT.
- Cambio: 3 encabezados de grupo (Progresión/Puntuación/Relax, claves nuevas ES+EN); orden Clásico, Aventura · Contrarreloj (con nota "incluye el Reto del día") · Zen; tutorial fuera del grid (queda en modal-how); último modo jugado marcado.
- Aceptación: 5 tarjetas en 3 grupos; tutorial accesible solo vía "¿Cómo se juega?"; i18n completo. Dep: V1-03 · P0 · 🟢 · **Bloquea: sí**

**V1-05 · Estados vacíos con CTA (cofres, logros, leaderboard)**
- Objetivo: pantallas secundarias nunca "rotas". Fuente: ROADMAP 5.5, M7. Área: constructores de `modal-chests`/`modal-medals`, `styles.css` (componente `.empty-state` nuevo: icono `iconV2` + título + sub + botón).
- Cambio: si `chests===0` → "Gana un cofre cada 10 oleadas" + CTA a Supervivencia; logros 0 → "Tu primera medalla te espera" + CTA jugar; leaderboard sin marcas → texto guía.
- Aceptación: las 3 superficies muestran estado vacío con CTA funcional en perfil recién creado; componente documentado en DESIGN_SYSTEM (via V1-02). Dep: — · P0 · 🟢 · **Bloquea: sí**

**V1-06 · Handler global de error con recuperación**
- Objetivo: ningún crash deja pantalla muerta. Fuente: §5 errores, ARCHITECTURE mod.1. Área: `game.js` (junto a ErrLog).
- Cambio: `window.onerror` + `unhandledrejection` → ErrLog (ya existe) + toast persistente `.bad` con botón "Recargar" (i18n ES+EN), máx. 1 visible.
- Aceptación: lanzar excepción desde consola en `?dev` muestra el toast y recarga limpia; sin bucles de toast. Dep: — · P0 · 🟢 · **Bloquea: sí**

**V1-07 · Auditoría y corrección de contraste celda × skin**
- Objetivo: iconos legibles en los 9 skins. Fuente: ROADMAP 4.4, M11. Área: `styles.css` (tokens `--cell-filled-bg` por skin).
- Cambio: calcular ratio de los 12 colores de icono sobre cada `--cell-filled-bg`; donde <3:1, oscurecer/aclarar el fondo de celda del skin (no tocar los 12 colores: son identidad del catálogo).
- Aceptación: tabla de ratios en el PR; ningún par <3:1; skins visualmente intactos en preview de tienda. Dep: — · P0 · 🟢 · **Bloquea: sí**

**V1-08 · Auditoría de texto grande**
- Objetivo: `largeText` sin roturas. Fuente: ROADMAP 5.7, M12. Área: `styles.css`.
- Cambio: revisar con ajuste activo: `.g-chip`, `.econ-pill`, appbar, modales; aplicar `min-width:0`/`flex-wrap`/truncado donde desborde.
- Aceptación: capturas antes/después de home+game+modales con largeText en 360px de ancho; sin overflow horizontal. Dep: — · P0 · 🟢 · **Bloquea: sí**

**V1-09 · Anuncios completos a lector de pantalla**
- Objetivo: eventos clave anunciados. Fuente: ROADMAP 5.2, M13. Área: `game.js` (`announce()` en Game/Survival), I18n.DICT.
- Cambio: anunciar convergencia ≥3, hito de combo, nueva oleada, vida perdida, fin de partida (con score), nivel completado (con estrellas). Claves ES+EN nuevas.
- Aceptación: los 6 eventos escriben en `#sr-status` (verificable en `?dev`); sin spam (throttle en convergencias). Dep: — · P0 · 🟢 · **Bloquea: sí**

**V1-10 · Retirar `infected` del registro de tiles**
- Objetivo: cero código muerto visible en V1. Fuente: ROADMAP 1.3, REQUIREMENTS §4. Área: `game.js` (Tiles.DEFS), `styles.css` (clase queda, inofensiva).
- Cambio: eliminar la entrada `infected` de `Tiles.DEFS` (ningún modo la usa — confirmado en docs); dejar comentario apuntando a ROADMAP 3.4.
- Aceptación: grep `infected` solo en CSS/roadmap; tests verdes. Dep: — · P1 · 🟢 · **Bloquea: sí** (criterio §6.5.5 en su variante de código prometido)

**V1-11 · Toast de actualización accionable**
- Objetivo: updates del SW que llegan de verdad. Fuente: ARCHITECTURE §8, M9. Área: `game.js` (PWA), `sw.js` (mensaje skipWaiting).
- Cambio: al detectar SW nuevo instalado, toast con botón "Actualizar" → `postMessage('skipWaiting')` + reload on `controllerchange`.
- Aceptación: desplegar bump de versión → toast aparece → botón actualiza sin perder RunSave. Dep: — · P1 · 🟢 · **Bloquea: sí** (sin esto, los fixes de V1 no llegan a instalados)

**V1-12 · Smoke-test responsive/matriz de dispositivos**
- Objetivo: verificación formal pre-release. Fuente: M15, §6.5.4. Área: sin código salvo fixes que surjan.
- Cambio: ejecutar la matriz §6.5.4 y corregir hallazgos menores.
- Aceptación: checklist firmada en el PR con capturas. Dep: V1-α+β completas · P0 · 🟢 · **Bloquea: sí**

**V1-13 · Coach paso 3 (combo) + salida dirigida**
- Fuente: M4, MIGRATION_SPEC §2.1. Cambio: tercer tablero determinista que fuerza 2 convergencias en <5s (enseña ventana de combo); al terminar, CTA "Jugar nivel 1". Aceptación: flujo completo en perfil nuevo; `cv_tut` sigue funcionando. Dep: — · P1 · 🟡 · **Bloquea: no**

**V1-14 · Bloque de sistemas en modal-surv-diff**
- Fuente: M5, MIGRATION_SPEC §7. Cambio: 3 filas icono+texto (carga→booster, frenesí, vidas/revivir), claves ES+EN. Aceptación: visible antes de cada run, no rompe layout 360px. Dep: — · P1 · 🟢 · **Bloquea: no**

**V1-15 · Intro de capítulo en Aventura**
- Fuente: ROADMAP 4.5, M6. Cambio: overlay 1-vez-por-capítulo (patrón `world-nov`): bioma, mods activos, objetivo del capítulo. Aceptación: aparece al entrar a capítulo nuevo, no reaparece, descartable con tap. Dep: — · P1 · 🟢 · **Bloquea: no**

**V1-16 · Badges de descubribilidad de sumideros**
- Fuente: M10, ROADMAP 3.1/3.2. Cambio: punto `--gold` en nav "Cofres" si `gems>=25`, y en "Misiones" si `tickets>=1` y misión de hoy incompleta. Componente badge nuevo (documentar en V1-02). Aceptación: badges reactivos a economía real. Dep: — · P1 · 🟢 · **Bloquea: no**

**V1-17 · Aviso RunSave en pausa de Supervivencia + preview animada de tienda**
- Fuente: §6.2, ROADMAP 4.3. Cambio: línea en `modal-pause` (solo Supervivencia): "Este modo no guarda la partida al salir" (ES+EN); activar animación ambiental de `.board-thumb` en hover/focus. Aceptación: aviso solo en Supervivencia; preview anima sin coste en `reduced-fx`. Dep: — · P2 · 🟢 · **Bloquea: no**

**V1-18 · Hosting formal + deploy automático**
- Objetivo: URL pública con HTTPS. Fuente: ROADMAP 8.1/6.4/7.3. Área: repo (workflow), panel del proveedor.
- Cambio: elegir proveedor estático (recomendación ROADMAP: Cloudflare Pages; GitHub Pages es alternativa 0-config), workflow de deploy on-push-a-main tras CI verde, cabeceras (HSTS, nosniff, Referrer-Policy, Permissions-Policy) vía `_headers` o equivalente.
- Aceptación: URL pública sirve la app; Lighthouse PWA installable; cabeceras verificadas con curl. Dep: decisión de proveedor del propietario (única dependencia externa del plan) · P0 · 🟡 · **Bloquea: sí**

**V1-19 · Aviso de navegador no soportado (color-mix)**
- Fuente: ROADMAP 1.6, DESIGN_SYSTEM §9. Cambio: check una-vez `CSS.supports('color','color-mix(in srgb,red,blue)')` → banner estático "Actualiza tu navegador" (ES+EN). Aceptación: banner solo aparece sin soporte (probar forzando el check). Dep: — · P1 · 🟢 · **Bloquea: sí** (barato y evita V1 "rota" en Safari viejo)

**V1-20 · Release V1 (v2.0.0)**
- Cambio: `tools/bump-version.sh 2.0.0`, tag git, verificación checklist §6.5 completa contra producción. Aceptación: los 6 criterios de §6.5 firmados. Dep: todo lo bloqueante · P0 · 🟢 · **Bloquea: sí**

**V1-21 (opcional) · JSDoc en `cv_meta` y `State`** — Fuente: ROADMAP 2.4. Solo los 2 tipos críticos. P2 · 🟢 · No bloquea.
**V1-22 (opcional) · `@media (prefers-contrast: more)` básico** — Fuente: DESIGN_SYSTEM §10 ("no hay manejo explícito"). Bordes `--line-strong` en componentes clave. P2 · 🟢 · No bloquea.

# 12. Cosas que no deben entrar en V1

- Multijugador en cualquier forma (incl. duelos fantasma 8.4-3A) — requiere backend; el enlace `?challenge=SEED` ya cubre el "jugar contra amigos" mínimo sin servidor.
- Leaderboard online, sync de progreso, push, telemetría remota — toda la Fase C/D del ROADMAP.
- Partición en ES modules (2.2) — refactor grande sin beneficio de usuario; post-V1.
- Contenido nuevo: mundo 6, mecánica `infected`, biomas extra, boosters nuevos, tema claro.
- Cambios de balance numérico (fórmulas, precios, curvas) — sin datos de juego real es ruido; MIGRATION_SPEC es el contrato vigente.
- Monetización (compra de gemas con dinero) — el CTA actual se retira en V1-01.
- Webfonts, dependencias externas, framework — contra la filosofía documentada del repo.

# 13. Riesgos, contradicciones y preguntas abiertas

**Riesgos:**
1. **Actualización de instalados:** los usuarios con PWA instalada reciben V1 solo si el flujo SW funciona — por eso V1-11 es bloqueante y el release final debe probarse sobre una instalación vieja real.
2. **Retirar UI de multi puede sorprender** a algún usuario que pulsó "Avísame". Mitigación: nota en el changelog del toast de versión; la promesa vuelve con Fase C/D.
3. **Deriva documental recurrente:** sin disciplina, V1-02 caduca igual que caducó lo anterior. Mitigación: añadir a CLAUDE.md la regla "todo PR que cambie reglas/UI toca el doc correspondiente" (una línea).
4. **Sesgo del auditor:** este plan se apoya en los docs (como exige el encargo) más verificaciones puntuales; los números de línea de ARCHITECTURE son aproximados en v1.9.0.

**Contradicciones documentales (recapitulación):** docs v1.7.1 vs código v1.9.0 (la mayor); REQUIREMENTS §4 parcialmente obsoleto; ARCHITECTURE §8 describe el hallazgo `ui-system` ya saneado; copy del home contradice el producto real; ningún doc define jerarquía de modos ni criterio de cierre de V1 (este documento cubre ambos).

**Preguntas abiertas (únicas decisiones que necesita tomar el propietario):**
1. **Proveedor de hosting** (V1-18): ¿Cloudflare Pages (recomendación del ROADMAP, alinea con Fases C/D futuras) o GitHub Pages (cero configuración)? Es la única dependencia externa del plan.
2. **Telemetría opt-in (7.1):** sigue bloqueada por decisión de endpoint. No bloquea V1, pero sin ella el rebalanceo post-V1 será a ciegas.
3. **¿Los skins podrían dar bonus algún día?** El fix del bug 1.1 dejó la decisión abierta ("contradice el cosmético puro"). Recomendación: mantener cosmético puro como principio de diseño y cerrarlo por escrito en REQUIREMENTS (RF-40 ya lo dice — ratificarlo).
4. **Nombre:** ¿se mantiene "Convergence" como nombre de cara al usuario (manifest) siendo el repo "ConvergenceOnline"? Recomendación: sí; sin cambio.

# 14. Prompts listos para modelo ejecutor

Instrucción común a TODOS los prompts (anteponer siempre): *"Lee `CLAUDE.md` y respeta sus reglas: no releas `game.js`/`styles.css` completos (usa la tabla de módulos de `docs/ARCHITECTURE.md` §4 con Read acotado), toda string nueva va en `I18n.DICT` en ES y EN, valida cualquier regla de juego contra `docs/MIGRATION_SPEC.md`, no rompas el esquema `cv_meta`, y al terminar ejecuta `node --test 'tests/*.test.js'` y `npx --yes eslint@9 .`. Si tocas `game.js` o `styles.css`, ejecuta `tools/bump-version.sh` con el siguiente parche de versión antes del commit final de la tanda."*

- **V1-01:** "Elimina de la UI toda promesa de features inexistentes: (1) en `index.html` borra la tarjeta del home con `data-act='home-multi'`; (2) en `game.js` elimina el listener/data-act `home-multi` y cualquier apertura de `modal-multi` desde UI visible (el nodo del modal puede quedar en HTML); (3) borra las claves i18n `home_tourneys` y `home_tourneys_sub` en ES y EN; (4) retira el CTA de `buy-gems` dejando el contador de gemas visible pero no clicable. Criterio: `grep -rn 'home_tourneys\|home-multi' index.html game.js` sin usos activos; tests y lint verdes."
- **V1-02:** "Sincroniza `docs/` con el código v1.9.0+: añade a `docs/MIGRATION_SPEC.md` secciones para el PRNG seedeable (`RNG`, `State.seed`), guardado de partida (`RunSave`, qué modos excluye), Reto del día (`Meta.dailyRun`, semilla por fecha, recompensa primer intento), cofre premium (25 gemas), reroll de misión (1 ticket) y deep-link `?challenge=SEED` — extrae los detalles del código con lecturas acotadas usando `docs/ARCHITECTURE.md` §4. Actualiza `docs/REQUIREMENTS.md` §4 eliminando lo ya implementado y añadiendo RF para el reto diario. Corrige `docs/ARCHITECTURE.md` §8 (la lista UI_SYSTEM ya no existe en sw.js). Añade al inventario de `docs/DESIGN_SYSTEM.md` §5 los componentes `.fly-glyph`, botón continuar partida, y los nuevos `.empty-state`/badge de nav. Actualiza el checklist §16 de MIGRATION_SPEC. No cambies código."
- **V1-03:** "Reorganiza la pantalla home (`#screen-start` en `index.html` + constructores de menú en `game.js` ~línea 3476+): (1) CTA principal 'Jugar' que continúa la partida guardada de `RunSave` si existe o abre el siguiente nivel de Clásico; (2) slot 'Reto del día' que muestra estado usando `Meta.dailyRun` (pendiente/completado con mejor marca de hoy) y lo lanza al tocarlo; (3) tarjetas de Clásico y Supervivencia con subtítulos honestos — sustituye `home_classic_sub` por 'Supera niveles y gana estrellas' / 'Beat levels and earn stars'; (4) conserva recompensa diaria y bottom-nav. Todo texto nuevo con claves i18n ES+EN. Criterio: home = jugar/reto/clásico/supervivencia/recompensa, navegable por teclado."
- **V1-04:** "En `buildModeMenu()` (game.js): agrupa las tarjetas de modo en 3 secciones con encabezados i18n nuevos — Progresión (clasico, aventura), Puntuación (contrarreloj, con subtítulo que mencione el Reto del día), Relax (zen). Saca `tutorial` del grid (sigue accesible desde el modal '¿Cómo se juega?'). Marca con `aria-checked` el último modo jugado (usa `Meta.modes`). No toques `Config.MODES` ni reglas."
- **V1-05:** "Crea un componente CSS `.empty-state` (icono via `iconV2` + título + subtítulo + botón, siguiendo tokens de docs/DESIGN_SYSTEM.md) y úsalo en: modal de cofres cuando `Meta.chests===0` (texto: gana un cofre cada 10 oleadas de Supervivencia, CTA que abre el selector de dificultad), sección de logros del perfil cuando no hay ninguno desbloqueado, y leaderboard local sin marcas. Claves i18n ES+EN. Criterio: con un perfil recién creado las 3 superficies muestran estado vacío con CTA funcional."
- **V1-06:** "Junto al módulo `ErrLog` (game.js línea ~24): añade `window.addEventListener('error')` y `'unhandledrejection'` que (1) registren en ErrLog como ya hace, (2) muestren un único toast persistente tipo `.bad` con mensaje i18n 'Algo ha fallado' y botón 'Recargar' que hace `location.reload()`. Protege contra bucles (máx 1 toast, flag). Prueba lanzando `throw new Error('x')` desde consola con `?dev`."
- **V1-07:** "Audita contraste: escribe un script Node desechable (scratch, no lo commitees) que calcule el ratio WCAG de los 12 colores de icono (docs/MIGRATION_SPEC.md §11) sobre el `--cell-filled-bg` de cada uno de los 9 skins (búscalos en styles.css por `data-board=`). Para cada par <3:1, ajusta el `--cell-filled-bg` de ese skin (más oscuro o más claro) hasta pasar, sin tocar los 12 colores del catálogo. Incluye la tabla de ratios antes/después en el mensaje de commit o PR."
- **V1-08:** "Activa el ajuste largeText (Settings) y revisa a 360px de ancho: `.g-chip`, `.econ-pill`, appbar, `modal-over`, `modal-level`. Corrige overflows con `min-width:0`, `flex-wrap` o truncado con elipsis según el caso (solo styles.css). Adjunta capturas antes/después."
- **V1-09:** "Completa los anuncios a lector de pantalla vía la función `announce()` existente (game.js ~módulo 13): convergencia de ≥3 iconos (con throttle 1s), hito de combo (10/20/30), nueva oleada de Supervivencia, vida perdida, fin de partida con puntuación, nivel completado con estrellas. Añade las claves i18n ES+EN. Verifica en `?dev` que `#sr-status` recibe cada evento."
- **V1-10:** "Elimina la entrada `infected` de `Tiles.DEFS` (game.js ~línea 1597). Ningún modo la usa (confirmado en docs/REQUIREMENTS.md §4). Deja un comentario de una línea: reintroducir con ROADMAP 3.4. Deja la clase CSS intacta. Tests verdes."
- **V1-11:** "Haz accionable el aviso de nueva versión: en `sw.js` añade listener de `message` para `skipWaiting`; en el módulo `PWA` (game.js ~2486), cuando detectes un SW `installed` con controlador activo, muestra toast con botón 'Actualizar' (i18n) que hace `reg.waiting.postMessage('skipWaiting')` y recarga en `controllerchange`. Cuida no recargar en bucle."
- **V1-13:** "Añade un paso 3 al módulo `Coach` (game.js ~2574): tablero determinista con dos jugadas de convergencia encadenables; el texto enseña la ventana de combo ('encadena antes de que se agote el círculo'). Al completar el coach, ofrece CTA directo 'Jugar nivel 1' que lanza Clásico mundo 1 nivel 1. Mantén `cv_tut` como flag de completado. Sigue el patrón determinista de los pasos 1-2 (docs/MIGRATION_SPEC.md §2.1)."
- **V1-14:** "En `modal-surv-diff` (index.html + su constructor en game.js): añade bajo el selector de dificultad un bloque compacto de 3 filas icono+texto explicando: barra de carga → booster gratis, medidor de frenesí → multiplicador temporal, vidas → se pierden si el tablero se desborda y puedes revivir por 120 monedas. Usa `iconV2` para los iconos y claves i18n ES+EN. Debe caber sin scroll en 360×640."
- **V1-15:** "Implementa la intro de capítulo de Aventura (ROADMAP 4.5): al entrar por primera vez en un capítulo, muestra un overlay descartable (reutiliza el patrón visual de `world-nov` en styles.css) con: nombre y emoji del bioma, modificadores activos y objetivo predominante del capítulo (datos en docs/MIGRATION_SPEC.md §5.6). Persiste 'visto' por capítulo en `Meta` de forma retrocompatible (campo nuevo con default)."
- **V1-16:** "Añade un badge de notificación (punto dorado, componente CSS nuevo pequeño) en la bottom-nav: en 'Cofres' cuando `Meta.gems>=25` (cofre premium pagable), en 'Misiones' cuando `Meta.tickets>=1` y la misión diaria de hoy no está completada (reroll disponible). Reactivo: recalcula al cambiar la economía (engancha donde ya se refrescan los pills de `Econ`)."
- **V1-17:** "Dos retoques: (1) en `modal-pause`, solo cuando el modo activo es supervivencia, muestra una línea i18n 'Este modo no guarda la partida al salir'; (2) en las tarjetas de la tienda de tableros (`.board-card`/`.board-thumb`), activa la animación ambiental del skin en `:hover`/`:focus-visible`, desactivada bajo `body.reduced-fx`."
- **V1-18:** "Configura deploy estático: workflow de GitHub Actions que, tras CI verde en main, publique el sitio en [PROVEEDOR ELEGIDO]. Añade cabeceras de seguridad (HSTS, X-Content-Type-Options: nosniff, Referrer-Policy: strict-origin-when-cross-origin, Permissions-Policy denegando camera/microphone/geolocation) por el mecanismo del proveedor (`_headers` en Cloudflare/Netlify). Verifica con curl y añade la URL al README/CLAUDE.md."
- **V1-19:** "En `init()` (game.js ~3819): si `!CSS.supports('color','color-mix(in srgb,red 50%,blue)')`, muestra un banner fijo simple (HTML+clase nueva, sin color-mix) con texto i18n 'Tu navegador es antiguo; actualízalo para jugar' y no continúes el arranque del juego. Prueba forzando la condición."
- **V1-20:** "Release final: ejecuta `tools/bump-version.sh 2.0.0`, verifica tests+lint, commit 'Bump version to 2.0.0; update cache version and asset links', tag `v2.0.0`. Después recorre el criterio de cierre de docs/V1_MASTER_PLAN.md §6.5 contra la URL de producción y deja el checklist marcado en la descripción del PR/release."

---

*Fin del plan. Mantener este documento vivo: al completar cada tarea, marcarla aquí igual que ROADMAP.md mantiene su bloque de Estado.*
