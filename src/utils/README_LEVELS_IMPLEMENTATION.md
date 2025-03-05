# Implementación del Sistema de Niveles

## Estructura del Sistema

El sistema de niveles ha sido implementado siguiendo una arquitectura modular y escalable, compuesta por los siguientes componentes:

### 1. Definición de Niveles (`src/utils/levels.ts`)

Este archivo contiene:
- Interfaces para la configuración de niveles
- Niveles predefinidos (1-5)
- Lógica para generar niveles dinámicamente
- Funciones para acceder a la configuración de niveles

### 2. Adaptador de Niveles (`src/utils/levelAdapter.ts`)

Proporciona compatibilidad con el código existente:
- Funciones para verificar si un nivel se ha completado
- Obtención de información para la interfaz de usuario
- Compatibilidad con las funciones antiguas

### 3. Inicialización del Sistema (`src/utils/initLevelSystem.ts`)

Maneja la inicialización del sistema:
- Migración de configuraciones existentes
- Inicialización del nivel actual
- Configuración global del sistema

## Características Principales

### Niveles Predefinidos y Dinámicos

- **Niveles 1-5**: Configurados manualmente con progresión cuidadosamente diseñada
- **Niveles 6+**: Generados dinámicamente con escalado progresivo de dificultad

### Configuración por Modo de Juego

Cada nivel tiene requisitos específicos según el modo:
- **Clásico**: Basado en puntuación y ocupación del tablero
- **Contrarreloj**: Basado en sobrevivir un tiempo determinado
- **Supervivencia**: Basado en cuánto tiempo puede sobrevivir el jugador

### Ajuste por Dificultad

Los niveles se ajustan automáticamente según la dificultad:
- **Fácil**: Requisitos más bajos, velocidad más lenta
- **Normal**: Configuración estándar
- **Difícil**: Requisitos más altos, velocidad más rápida
- **Tutorial**: Extremadamente fácil para aprender

### Características Especiales

Los niveles desbloquean progresivamente:
- **Iconos Especiales**: Desde nivel 3
- **Items Bonus**: Desde nivel 4
- **Power-Ups**: Desde nivel 5
- **Obstáculos**: Desde nivel 6

## Integración con el Juego

### Inicialización

El sistema se inicializa al cargar la aplicación:
```typescript
// En GamePage.tsx
useEffect(() => {
  const levelSystemInfo = initLevelSystem();
  logger.info('GamePage', 'Sistema de niveles inicializado', levelSystemInfo);
}, []);
```

### Verificación de Nivel Completado

Se utiliza el adaptador para verificar si un nivel se ha completado:
```typescript
// En useGameLogic.ts
const checkLevelCompleted = () => {
  return levelAdapter.isLevelCompleted(
    level,
    currentPlayMode,
    score,
    iconCount,
    boardSize,
    timeRemaining,
    survivalTime,
    timerRef.current
  );
};
```

### Configuración de Nivel

Al avanzar de nivel, se obtiene la configuración del nuevo nivel:
```typescript
// En GamePage.tsx
const handleNextLevel = () => {
  const nextLevel = level + 1;
  const nextLevelInfo = levelAdapter.getNextLevelDisplay(
    level,
    currentPlayMode,
    currentDifficulty
  );
  
  dispatch(setLevel(nextLevel));
  initializeBoard();
  dispatch(setGameStatus('playing'));
};
```

### Interfaz de Usuario

El modal de nivel completado muestra información del siguiente nivel:
```typescript
// En LevelCompleteModal.tsx
const nextLevelInfo = levelAdapter.getNextLevelDisplay(
  level,
  currentPlayMode,
  currentDifficulty
);

const rewards = levelAdapter.getLevelRewards(
  level,
  currentPlayMode,
  currentDifficulty
);
```

## Extensibilidad

### Añadir Nuevos Modos de Juego

1. Actualizar el tipo `GamePlayMode` en `gameSlice.ts`
2. Añadir configuración en `BASE_MODE_CONFIG` en `levels.ts`
3. Actualizar los niveles predefinidos con requisitos para el nuevo modo

### Añadir Nuevas Características Especiales

1. Actualizar la interfaz `SpecialFeature` en `levels.ts`
2. Modificar la función `generateDynamicLevel` para incluir la nueva característica
3. Actualizar `hasSpecialFeature` para detectar la nueva característica

### Añadir Nuevos Niveles Predefinidos

Añadir al array `PREDEFINED_LEVELS` en `levels.ts`:
```typescript
{
  id: 6,
  boardSize: 10,
  icons: ["🎮", "🎲", "🎯", "🎪", "🎨", "🎭"],
  spawnRate: 1500,
  speedMultiplier: 1.6,
  requirements: {
    classic: [{ type: 'score', value: 6000, description: 'Alcanza 6000 puntos' }],
    timed: [{ type: 'time', value: 60, description: 'Sobrevive 1 minuto' }],
    survival: [{ type: 'time', value: 360, description: 'Sobrevive 6 minutos' }]
  },
  rewards: {
    // Recompensas específicas
  },
  specialFeatures: {
    // Características especiales
  }
}
```

## Consideraciones de Rendimiento

- Las configuraciones de nivel se calculan bajo demanda
- La generación dinámica es eficiente incluso para niveles altos
- Se evitan cálculos redundantes al verificar niveles completados

## Solución de Problemas

### Nivel Completado Prematuramente

El sistema incluye protección contra la detección prematura:
- Tiempo mínimo de validación (3 segundos)
- Verificación condicional de ocupación
- Protección durante inicialización

### Dificultad Incorrecta

Verificar los multiplicadores en `DIFFICULTY_MULTIPLIERS` en `levels.ts`.

### Progresión No Guardada

El sistema gestiona la configuración y verificación, pero no el guardado.
Verificar la lógica de guardado en el sistema de persistencia. 