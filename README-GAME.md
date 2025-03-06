# Documentación del Juego Convergence Online

## Estructura General

Este documento proporciona una descripción detallada de la estructura y organización del juego Convergence Online tras la refactorización.

### Organización de Archivos

La aplicación está organizada siguiendo un patrón modular con separación clara de responsabilidades:

```
src/
├── components/            # Componentes reutilizables
│   └── game/              # Componentes específicos del juego
│       ├── GameBoard/     # Tablero de juego
│       ├── GameControls/  # Controles del juego
│       ├── GameHUD/       # Interfaz durante el juego
│       ├── GameInfo/      # Información del juego
│       └── GameModals/    # Modales del juego
├── hooks/                 # Hooks personalizados
│   ├── useGameLogic.ts    # Hook principal coordinador
│   ├── useGameBoard.ts    # Lógica del tablero
│   ├── useGameConfig.ts   # Configuración del juego 
│   ├── useGameHints.ts    # Sistema de pistas
│   └── useGameTimers.ts   # Gestión de temporizadores
├── pages/                 # Páginas de la aplicación
│   └── Game/              # Página principal del juego
├── store/                 # Estado global (Redux)
│   └── slices/            # Slices de Redux
│       └── gameSlice.ts   # Estado del juego
└── utils/                 # Utilidades
    ├── audioManager.ts    # Gestión de audio
    ├── boardUtils.ts      # Utilidades para el tablero
    ├── config.ts          # Configuración del juego
    ├── gameUtils.ts       # Utilidades generales
    ├── levelAdapter.ts    # Adaptación de niveles
    └── logger.ts          # Sistema de logging
```

## Componentes Principales

### GamePage (src/pages/Game/GamePage.tsx)

Este es el componente principal que coordina todo el juego. Sus responsabilidades incluyen:

- Inicializar el juego y su estado
- Renderizar los componentes del juego
- Gestionar el ciclo de vida del juego
- Coordinar las transiciones entre estados

### GameBoard (src/components/game/GameBoard/GameBoard.tsx)

Componente responsable de renderizar el tablero de juego y gestionar las interacciones con las celdas.

### GameHUD (src/components/game/GameHUD/GameHUD.tsx)

Muestra la información relevante durante el juego como puntuación, nivel, tiempo, etc.

### GameControls (src/components/game/GameControls/GameControls.tsx)

Muestra los botones de control del juego (pausa, reinicio, etc.) y gestiona sus acciones.

### GameModals (src/components/game/GameModals/)

Contiene los diferentes modales utilizados en el juego:
- `StartGameModal`: Modal inicial para configurar y comenzar el juego
- `LevelCompleteModal`: Modal cuando se completa un nivel
- `GameOverModal`: Modal cuando termina el juego

## Hooks Personalizados

### useGameLogic (src/hooks/useGameLogic.ts)

Hook principal que coordina toda la lógica del juego. Delega responsabilidades específicas a hooks más especializados.

### useGameBoard (src/hooks/useGameBoard.ts)

Gestiona las operaciones relacionadas con el tablero:
- Inicialización del tablero
- Verificación de movimientos válidos
- Colocación de iconos

### useGameTimers (src/hooks/useGameTimers.ts)

Gestiona los temporizadores del juego:
- Temporizador principal del juego
- Temporizador para la aparición de iconos
- Manejo de diferentes modos de juego (contrarreloj, supervivencia)

### useGameConfig (src/hooks/useGameConfig.ts)

Gestiona la configuración del juego:
- Cambio de dificultad
- Cambio de modo de juego
- Aplicación de configuraciones según nivel

### useGameHints (src/hooks/useGameHints.ts)

Gestiona el sistema de pistas del juego:
- Búsqueda de convergencias posibles
- Destacado de celdas
- Gestión de cooldowns

## Estado Global (Redux)

### gameSlice (src/store/slices/gameSlice.ts)

Gestiona todo el estado del juego:
- Tablero
- Puntuación
- Nivel
- Estado de juego (jugando, pausado, etc.)
- Configuración actual
- Temporizadores
- Iconos disponibles

## Utilidades

### gameUtils (src/utils/gameUtils.ts)

Contiene funciones auxiliares para la lógica del juego:
- Verificación de celdas válidas
- Cálculo de puntuación
- Búsqueda de convergencias
- Validación de movimientos

### boardUtils (src/utils/boardUtils.ts)

Gestiona las operaciones específicas del tablero:
- Cambio de tamaño
- Ajuste visual
- Configuración para niveles

### config (src/utils/config.ts)

Contiene toda la configuración del juego:
- Modos de juego
- Niveles
- Dificultades
- Velocidades
- Iconos disponibles

### audioManager (src/utils/audioManager.ts)

Gestiona todos los efectos de sonido y música del juego.

### levelAdapter (src/utils/levelAdapter.ts)

Adapta la configuración según el nivel actual.

## Flujo Principal del Juego

1. **Inicialización**:
   - El usuario accede a `GamePage`
   - Se muestra `StartGameModal` para configurar el juego
   - El usuario selecciona modo y dificultad

2. **Inicio del Juego**:
   - Se inicializa el tablero con `initializeBoard`
   - Se inician los temporizadores con `startTimers`
   - Se establece el estado a 'playing'

3. **Durante el Juego**:
   - Los iconos aparecen a intervalos regulares
   - El usuario selecciona iconos para eliminarlos
   - Se verifican constantemente las condiciones de fin de nivel

4. **Finalización de Nivel**:
   - Si el usuario completa el nivel, se muestra `LevelCompleteModal`
   - Si el usuario no puede continuar, se muestra `GameOverModal`

5. **Progresión**:
   - Si continúa, se avanza al siguiente nivel con `configureNewLevel`
   - Se actualiza la dificultad según el nivel

## Modos de Juego

- **Clásico**: Elimina iconos para alcanzar una puntuación objetivo
- **Contrarreloj**: Elimina la mayor cantidad de iconos antes de que se acabe el tiempo
- **Supervivencia**: Juega el mayor tiempo posible mientras la velocidad aumenta
- **Zen**: Juego sin presión temporal ni objetivos específicos

## Dificultades

- **Fácil**: Menos iconos, más tiempo, tablero más pequeño
- **Normal**: Configuración estándar
- **Difícil**: Más iconos, menos tiempo, tablero más grande
- **Tutorial**: Modo de aprendizaje con ayudas adicionales 