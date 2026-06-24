# Convergence Online - Documento de Especificación del Juego

## Descripción General

Convergence Online es un juego de puzle basado en la mecánica de convergencia de iconos. El juego genera y coloca automáticamente iconos en el tablero, y los jugadores deben eliminarlos estratégicamente formando grupos de iconos idénticos antes de que el tablero se llene por completo. El juego combina elementos de juegos match-4 con gestión estratégica del tiempo y el espacio.

## Mecánicas Principales del Juego

### Mecánicas del Tablero
- El juego se desarrolla en un tablero cuadrado
- El tamaño del tablero varía según el nivel y la dificultad (típicamente 8x8)
- Los iconos aparecen automáticamente en el tablero a intervalos regulares
- Los jugadores no colocan iconos, sino que deben eliminarlos formando patrones de convergencia
- El juego termina si el tablero se llena y no hay movimientos disponibles

### Reglas de Convergencia
- Los iconos deben ser del mismo tipo para converger y eliminarse
- La convergencia ocurre cuando hay 3 o más iconos idénticos adyacentes
- Las convergencias pueden ser horizontales, verticales o combinadas
- Todos los iconos que forman parte de una convergencia desaparecen simultáneamente
- No hay límite en el número de iconos que pueden converger a la vez

### Sistema de Puntuación
- Se otorgan puntos por cada convergencia exitosa
- Puntos extra por patrones de convergencia más grandes
- Multiplicadores de combo por convergencias rápidas consecutivas
- Bonificación por nivel completado (500 puntos por tablero vacío)
- Los objetivos de puntuación aumentan con cada nivel

## Modos de Juego

### 1. Modo Clásico
- Objetivo: Vaciar el tablero o alcanzar la puntuación objetivo
- Características:
  - Dificultad progresiva
  - Objetivos de puntuación por nivel
  - Objetivos de ocupación del tablero
  - Aparición periódica de iconos
- Configuración:
  - Puntuación inicial objetivo: 1000 puntos
  - Multiplicador de puntuación por nivel: 1.5x
  - Objetivo inicial de ocupación: 70%
  - Penalización base: 1 icono añadido por error
  - Aumento de velocidad cada 20000ms
  - Multiplicador máximo de velocidad: 3x

### 2. Modo Contrarreloj
- Objetivo: Conseguir la máxima puntuación antes de que se acabe el tiempo
- Características:
  - Tiempo fijo por nivel
  - Bonificaciones de tiempo por combos
  - Velocidad de aparición creciente
  - Límites de tiempo decrecientes por nivel
- Configuración:
  - Tiempo inicial: 120 segundos
  - Bonificación de tiempo por nivel: 30 segundos
  - Bonificación de tiempo por combo: 5 segundos
  - Reducción de tiempo por nivel: 10 segundos
  - Aumento de velocidad cada 15000ms
  - Multiplicador máximo de velocidad: 2.5x

### 3. Modo Supervivencia
- Objetivo: Sobrevivir el mayor tiempo posible
- Características:
  - Dificultad progresivamente creciente
  - Aparición de iconos especiales
  - Aceleración continua de la velocidad
- Configuración:
  - Iconos iniciales: 50
  - Movimientos antes de nueva aparición: 1
  - Intervalo de aumento de velocidad: 20 segundos
  - Probabilidad de iconos especiales: 10%
  - Intervalo de iconos especiales: 60 segundos
  - Multiplicador máximo de velocidad: 4x
  - Aumento de velocidad cada 10000ms

### 4. Modo Zen
- Objetivo: Jugar sin presión
- Características:
  - Sin límites de tiempo
  - Sin condiciones de derrota
  - Entorno de práctica libre
  - Movimientos ilimitados

## Niveles de Dificultad

### Muy Fácil
- Velocidad de aparición más lenta
- Tablero más pequeño
- Menos tipos de iconos
- Más tiempo en modos cronometrados
- Objetivos de puntuación más bajos

### Fácil
- Velocidad de aparición estándar
- Tamaño de tablero regular
- Variedad estándar de iconos
- Límites de tiempo normales
- Objetivos alcanzables

### Normal
- Velocidad de aparición más rápida
- Tablero más grande
- Más variedades de iconos
- Límites de tiempo más estrictos
- Objetivos más altos

### Difícil
- Velocidad de aparición rápida
- Tamaño máximo de tablero
- Variedad completa de iconos
- Límites de tiempo ajustados
- Objetivos desafiantes

### Muy Difícil
- Velocidad de aparición máxima
- Tablero más grande
- Todos los tipos de iconos activos
- Límites de tiempo mínimos
- Objetivos más altos

## Sistema de Niveles

### Progresión de Niveles
1. Cada nivel aumenta en dificultad
2. El tamaño del tablero puede cambiar entre niveles
3. Aumenta el número de iconos disponibles
4. Las velocidades de aparición se aceleran
5. Los objetivos de puntuación aumentan exponencialmente
6. Los límites de tiempo disminuyen (en modos cronometrados)

### Estructura de Niveles
- Niveles 1-5: Configurados manualmente con progresión cuidadosa
- Niveles 6+: Generados dinámicamente con dificultad escalable
- Cada nivel tiene requisitos específicos por modo:
  - Clásico: Objetivos de puntuación y ocupación
  - Contrarreloj: Requisitos de tiempo de supervivencia
  - Supervivencia: Escalado progresivo de dificultad

## Sistema de Power-Ups

### Tipos de Power-Ups
- Diferentes power-ups aparecen durante el juego
- Los efectos varían según el modo y dificultad
- Iconos especiales con propiedades únicas
- La probabilidad de power-ups aumenta con la dificultad

### Duración de Efectos
- Los efectos de power-ups son temporales
- La duración varía según el tipo
- Los efectos pueden acumularse o combinarse
- Indicadores visuales muestran la duración restante

## Ciclo Principal del Juego

1. Inicialización del Juego
   - Selección de modo de juego
   - Elección de dificultad
   - Inicialización del tablero
   - Configuración inicial

2. Bucle de Juego
   - Los iconos aparecen en intervalos definidos
   - El jugador busca y elimina convergencias
   - El sistema verifica las convergencias
   - Actualización de puntuación y combos
   - Aparición y activación de power-ups
   - Verificación de progresión de nivel

3. Finalización de Nivel
   - Verificación de condiciones de victoria
   - Cálculo de puntuación final
   - Aplicación de bonificaciones
   - Actualización de récords
   - Progresión al siguiente nivel

4. Condiciones de Game Over
   - Tablero completamente lleno
   - Tiempo agotado (en modos cronometrados)
   - Sin movimientos válidos disponibles
   - Objetivo de nivel alcanzado

## Requisitos de Implementación

### Gestión de Estado
- Control del estado del juego (jugando, pausado, terminado)
- Mantenimiento de puntuación e información de nivel
- Monitoreo de ocupación del tablero
- Seguimiento de power-ups activos
- Gestión de temporizadores e intervalos

### Gestión del Tablero
- Inicialización y reinicio del tablero
- Verificación de movimientos válidos
- Procesamiento de convergencias
- Gestión de aparición de iconos
- Control de ocupación del tablero

### Interfaz de Usuario
- Visualización del tablero de juego
- Mostrar puntuación actual
- Indicar progreso del nivel
- Presentar tiempo restante
- Mostrar efectos de power-ups

### Sistema de Audio
- Música de fondo
- Efectos de sonido para:
  - Eliminación de iconos
  - Convergencias
  - Finalización de nivel
  - Game over
  - Activación de power-ups

### Sistema de Guardado
- Puntuaciones más altas
- Progreso del juego
- Preferencias de usuario
- Seguimiento de estadísticas
- Datos de logros

Este documento sirve como una especificación completa para implementar el juego Convergence Online, cubriendo todos los aspectos principales del juego, mecánicas y sistemas sin atarse a ningún lenguaje de programación o framework específico.
