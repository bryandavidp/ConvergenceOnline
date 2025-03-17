# Módulos de Utilidad para Convergence Online

Este directorio contiene módulos de utilidad modularizados para mejorar la mantenibilidad y reusabilidad del código.

## Estructura de Archivos

- `timestamp.ts`: Gestión de timestamps precisos y formateo de tiempo
- `iconSpawner.ts`: Sistema para añadir iconos al tablero
- `speedController.ts`: Control de la velocidad de juego
- `gameEndConditions.ts`: Lógica para detectar fin de partida
- `audioManager.ts`: Gestión de efectos de sonido
- `logger.ts`: Sistema de logs centralizados
- `config.ts`: Configuración global del juego

## Módulos Principales

### Sistema de Spawn de Iconos (`iconSpawner.ts`)

Este módulo proporciona una forma modular de añadir nuevos iconos al tablero con:

- Control de velocidad para evitar apariciones demasiado rápidas
- Detección de condiciones de fin de partida
- Validación de movimientos disponibles

Ejemplo de uso:

```typescript
const { 
  addRandomIcon, 
  isSpawningRef, 
  lastIconAddedTimeRef,
  resetSpawningState 
} = useIconSpawner(
  hasValidMoves,
  addNotification
);

// Añadir un nuevo icono
addRandomIcon();

// Reiniciar estado de spawning
resetSpawningState();
```

### Control de Velocidad (`speedController.ts`)

Gestiona el incremento automático de velocidad durante la partida:

- Aumenta la velocidad basado en el tiempo de juego
- Respeta los límites según la dificultad
- Muestra notificaciones al usuario cuando la velocidad cambia
- Permite reconfiguración al cambiar de nivel

Ejemplo de uso:

```typescript
const {
  handleSpeedIncrease,
  resetSpeedIncreaseTime
} = useSpeedController(
  lastSpeedIncreaseTimeRef,
  addNotification
);

// Verificar si debe incrementar la velocidad
handleSpeedIncrease();

// Reiniciar contador al cambiar de nivel
resetSpeedIncreaseTime();
```

### Condiciones de Fin de Partida (`gameEndConditions.ts`)

Controla la lógica para determinar si una partida ha terminado:

- Detección de tablero lleno
- Comprobación de movimientos válidos
- Diferentes condiciones según el modo de juego

## Configuración

Cada módulo incluye interfaces de configuración que permiten personalizar su comportamiento sin modificar su implementación interna, siguiendo el principio de inversión de dependencias. 