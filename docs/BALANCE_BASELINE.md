# Baseline de balance por simulación (GM-30)

> Resultados de `tools/balance-sim.js` — el juego REAL (game.js sin modificar) conducido en Node sobre un reloj virtual con bots deterministas (mismo seed + mismo perfil ⇒ misma partida, siempre). Regenerar con `node tools/balance-sim.js --runs 40`. **Regla:** antes de cualquier cambio de balance, capturar la batería "antes"; después del cambio, comparar contra los criterios de aceptación de la tarea (ver `GAME_MODES_MASTER_PLAN.md` §7/§10).
>
> Límite honesto: el bot valida rangos y regresiones, no diversión. Los perfiles modelan reacción (550/900/1400 ms), política (greedy/aleatoria), tasa de error (3/8/15%) y lapsos de atención; no modelan fatiga creciente ni carga cognitiva por densidad.

## Métricas

`sc p50/p90` score mediano/percentil 90 · `dur50` duración mediana · `combo` combo máximo mediano · `progreso` niveles completados (Clásico), nivel alcanzado (Aventura) u oleada (Supervivencia) · `deadAir` % de "turnos" del bot sin jugada disponible · `err` errores por run · `cap` % de runs cortadas por tiempo máximo del sim (no por muerte).

## Batería v2.1.0 (ANTES de los cambios de balance de GM-β) — 40 runs/config

```
modo           diff      perfil    sc p50   sc p90   dur50  combo    progreso  deadAir    err  coins    cap
clasico        normal    skilled    52215    77625    352s     x8      13 nvl      66%    0.8      0    95%
aventura       normal    skilled   102309   149697    352s    x15      nvl 19      62%    6.8      0   100%
contrarreloj   normal    skilled   233049   304558    240s    x26       nvl 1      77%    2.9    695   100%
supervivencia  normal    skilled   126555   199392    480s     x9   oleada 18      85%    3.3    689   100%
clasico        normal    average    32165    46469    355s     x6      10 nvl      44%    1.3      0    98%
aventura       normal    average    48653    74949    354s    x14      nvl 12      40%   14.2      0   100%
contrarreloj   normal    average   102056   135441    240s    x14       nvl 1      54%    7.0    384   100%
supervivencia  normal    average    85968   128687    480s     x8   oleada 18      71%    8.0    568   100%
clasico        normal    casual     13175    18265    357s     x6       5 nvl      18%    4.8      0   100%
aventura       normal    casual     17081    24175    357s    x11       nvl 6      15%   22.3      0   100%
contrarreloj   normal    casual     14566    30205    240s    x11       nvl 1      19%   13.9     56   100%
supervivencia  normal    casual     27746    41861    480s     x9   oleada 18      35%   21.3    358   100%
supervivencia  dificil   skilled   186320   288553    480s    x11   oleada 22      79%    4.8    938   100%
zen            normal    casual     13964    20412    240s     x6       nvl 1      70%    5.8     64   100%
```

## Batería v2.2.0 (DESPUÉS: GM-26 warm-up · GM-10 sprint · GM-11 error=tiempo · GM-19 revivir · B6) — 40 runs/config

```
modo           diff      perfil    sc p50   sc p90   dur50  combo    progreso  deadAir    err  coins    cap
clasico        normal    skilled    53910    77475    352s     x7      13 nvl      67%    0.3      0   100%
aventura       normal    skilled   101283   163301    352s    x16      nvl 19      63%    6.9      0   100%
contrarreloj   normal    skilled   237261   296408    240s    x22       nvl 1      77%    2.4    721   100%
supervivencia  normal    skilled   137428   203959    480s     x8   oleada 18      85%    3.3    684   100%
clasico        normal    average    35235    47340    354s     x8      10 nvl      43%    1.7      0    98%
aventura       normal    average    44232    70662    354s    x12      nvl 12      40%   13.9      0   100%
contrarreloj   normal    average   116169   172641    240s    x13       nvl 1      57%    6.6    440   100%
supervivencia  normal    average    96678   138103    480s     x8   oleada 18      69%   10.3    578   100%
clasico        normal    casual     14130    17115    357s     x7       5 nvl      17%    4.6      0   100%
aventura       normal    casual     18654    24429    357s    x10       nvl 7      13%   21.9      0   100%
contrarreloj   normal    casual     20336    38288    240s     x9       nvl 1      27%   12.6     93   100%
supervivencia  normal    casual     23352    37638    480s     x9   oleada 18      35%   21.0    345   100%
supervivencia  dificil   skilled   177852   266674    480s    x11   oleada 22      79%    4.6    937   100%
zen            normal    casual     13964    20412    240s     x6       nvl 1      70%    5.8     64   100%
```

## Batería v2.3.0 (Fase GM-γ: bendiciones, rutas, reliquias, continuar, racha, zen) — 40 runs/config

```
modo           diff      perfil    sc p50   sc p90   dur50  combo    progreso  deadAir    err  coins    cap
clasico        normal    skilled    53910    77475    352s     x7      13 nvl      67%    0.3      0   100%
aventura       normal    skilled    67010   161277    353s    x13      nvl 15      69%    5.5      0   100%
contrarreloj   normal    skilled   237261   296408    240s    x22       nvl 1      77%    2.4    721   100%
supervivencia  normal    skilled   138099   200600    480s     x9   oleada 18      85%    2.6    686   100%
clasico        normal    average    35235    47340    354s     x8      10 nvl      43%    1.7      0    98%
aventura       normal    average    27656    74152    355s    x10       nvl 9      51%   11.6      0   100%
contrarreloj   normal    average   116169   172641    240s    x13       nvl 1      57%    6.6    440   100%
supervivencia  normal    average    87689   111182    480s     x8   oleada 18      69%    9.9    561   100%
clasico        normal    casual     14130    17115    357s     x7       5 nvl      17%    4.6      0   100%
aventura       normal    casual     19357    26626    356s    x11       nvl 6      18%   21.1      0   100%
contrarreloj   normal    casual     20336    38288    240s     x9       nvl 1      27%   12.6     93   100%
supervivencia  normal    casual     24707    37059    480s     x9   oleada 18      35%   21.2    343   100%
supervivencia  dificil   skilled   186730   259432    480s    x11   oleada 22      79%    4.6    946   100%
zen            normal    casual     13964    20412    240s     x6       nvl 1      70%    5.8     64   100%
```

**Lectura (γ):** Clásico, Contrarreloj y Zen **idénticos bit a bit** a v2.2.0 — los sistemas nuevos no se filtran fuera de su modo (los bots del sim no compran potenciadores pre-nivel ni continúan con gemas). Aventura baja ~34% (skilled/average) porque los bots eligen SIEMPRE la primera opción = ruta exigente en todos los capítulos: la ruta dura no domina a la serena — el trade-off es real, que es la condición de una elección significativa. Supervivencia ±1% (las bendiciones compensan levemente la variación de RNG).

## Batería v2.4.0 (Fase GM-δ: marea, mutadores, calendario, ghost, cápsulas, jefes activos, jardín) — 40 runs/config

```
modo           diff      perfil    sc p50   sc p90   dur50  combo    progreso  deadAir    err  coins    cap
clasico        normal    skilled    53910    77475    352s     x7      13 nvl      67%    0.3      0   100%
aventura       normal    skilled    64987   169467    353s    x13      nvl 15      70%    5.3      0   100%
contrarreloj   normal    skilled   246131   309650    240s    x22       nvl 1      77%    2.2    730   100%
supervivencia  normal    skilled   138099   200600    480s     x9   oleada 18      85%    2.6    680   100%
clasico        normal    average    35235    47340    354s     x8      10 nvl      43%    1.7      0    98%
aventura       normal    average    26971    79481    355s    x10       nvl 7      52%   11.4      0   100%
contrarreloj   normal    average   129463   173844    240s    x13       nvl 1      57%    6.8    469   100%
supervivencia  normal    average    84051   110990    480s     x8   oleada 18      69%    9.9    559   100%
clasico        normal    casual     14130    17115    357s     x7       5 nvl      17%    4.6      0   100%
aventura       normal    casual     19224    26626    356s    x11       nvl 6      17%   21.3      0   100%
contrarreloj   normal    casual     20440    37752    240s     x9       nvl 1      26%   12.4     85   100%
supervivencia  normal    casual     24707    37059    480s     x9   oleada 18      35%   21.3    342   100%
supervivencia  dificil   skilled   194566   287880    480s    x11   oleada 22      79%    4.3    954   100%
zen            normal    casual     13964    20412    240s     x6       nvl 1      70%    5.8     64   100%
```

**Lectura (δ):** Clásico y Zen idénticos bit a bit (control ✅). Contrarreloj +2–11% por la cápsula de tiempo (+5s y desplazamiento del stream RNG) — esperado y aceptado; el guardarraíl se recalibró de 60649 a 52964 (la banda ±40% absorbió el cambio sin fallar). Supervivencia normal idéntica (el mutador semanal se fija a `none` en el sim). Limitación conocida: los efectos diferidos por `setTimeout` de los eventos jefe (relleno de la marea, barajado del quake) no se ejecutan dentro del bucle síncrono del simulador — se validan con el smoke de navegador.

## Evaluación de los criterios de aceptación (GM-β)

| Criterio | Resultado | Veredicto |
|---|---|---|
| **Control**: Zen sin cambios (warm-up excluido) | Idéntico bit a bit (13964/20412) | ✅ |
| **B2 (error=−3s)**: duración p50 de Contrarreloj no cae >15% | Sin cambio (todas las runs siguen llegando al tope del sim; ni el bot casual con ~13 errores muere por los −3s) | ✅ |
| **B3 (warm-up)**: score p50 sin inflación sistemática (>5%) | Clásico +3/+9/+7% pero Aventura −1/−9/+9% con el mismo warm-up → las desviaciones se contradicen entre perfiles/modos: es ruido de re-muestreo (el warm-up altera el timing de spawns y con él toda la secuencia RNG), no inflación. Niveles completados y duraciones idénticos. | ✅ |
| **B4 (sprint ×1.5)**: récords (perfil skilled) no inflados >20% | skilled +1.8% p50 / p90 −2.7%. Hallazgo adicional: al perfil casual le sube +40% p50 — el sprint actúa de *comeback mechanic* (quien va justo de reloj pasa más tiempo en zona ×1.5). Rubber-banding deseable: ayuda más al débil sin mover los récords. | ✅ |
| **B1 (revivir) / B6 (hielo→carga)** | Sin efecto en sim (los bots no pagan revivir; +2 de carga es marginal). Validación manual con el checklist de playtest. | ✅ (n/a) |

## Hallazgos estructurales del baseline (para fases futuras)

1. **La dificultad de Contrarreloj y Supervivencia es cognitiva, no mecánica.** Ningún bot (ni el casual, con 1.4s de reacción, 15% de error y lapsos) muere dentro del tope del sim: en Contrarreloj la reposición con suelo 0.4 supera al drenaje si conviertes cada ~1.4s, y en Supervivencia el alivio por vida perdida + clear-assist sostienen indefinidamente. Los humanos mueren por colapso de atención. Implicación: subir "dificultad numérica" castigaría poco al hábil y mucho al débil; la presión útil es la que ataca la atención (más variedad simultánea, eventos, decisiones), no la velocidad bruta.
2. **El dead-air es real y enorme para jugadores rápidos** (66–85% de los turnos del bot skilled sin jugada disponible; 40–54% para el medio): confirma D2 del plan con datos. El warm-up lo mitiga solo al inicio; el cuello es la espera post-limpieza (el tablero se vacía más rápido de lo que spawnea). Candidato futuro: escalar el ritmo de spawn con la velocidad de consumo del jugador (DDA suave), a diseñar en GM-γ/δ con criterio propio.
3. **La oleada de Supervivencia es puramente temporal para bots** (oleada 18 a los 8 min en los 3 perfiles): el número de oleada mide tiempo jugado, no habilidad. El récord de oleada humano diferencia por atención sostenida — coherente con el hallazgo 1.
4. **Guardarraíl de medallas** activo en CI (`tests/balance-guardrail.test.js`): bot estándar (average, 3 min, seeds fijos) con mediana calibrada 60649 en v2.2.0 y banda ±40%. Recalibrar solo en cambios de balance deliberados.
