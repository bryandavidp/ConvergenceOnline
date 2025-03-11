# Sistema de Dificultad en Convergence Online - Guía Detallada

Este documento técnico explica en profundidad cómo funciona el sistema de dificultad en Convergence Online, dónde se implementa cada componente, y cómo se pueden añadir nuevas dificultades al juego.

## Índice

1. [Visión General del Sistema de Dificultad](#1-visión-general-del-sistema-de-dificultad)
2. [Archivos Clave y su Ubicación](#2-archivos-clave-y-su-ubicación)
3. [Niveles de Dificultad Predefinidos](#3-niveles-de-dificultad-predefinidos)
4. [Implementación Técnica](#4-implementación-técnica)
5. [Interacción con Modos de Juego](#5-interacción-con-modos-de-juego)
6. [Sistema de Puntuación y Dificultad](#6-sistema-de-puntuación-y-dificultad)
7. [Cómo Implementar Nuevas Dificultades](#7-cómo-implementar-nuevas-dificultades)
8. [Ejemplos Prácticos](#8-ejemplos-prácticos)
9. [Consideraciones de Rendimiento](#9-consideraciones-de-rendimiento)

## 1. Visión General del Sistema de Dificultad

El sistema de dificultad en Convergence Online está diseñado para proporcionar diferentes experiencias de juego adaptadas a distintos niveles de habilidad. El juego cuenta con cuatro niveles de dificultad principales:

- **Tutorial**: Diseñado para principiantes, con configuraciones muy amigables y sin penalizaciones.
- **Fácil**: Para jugadores casuales, con ritmo moderado y penalizaciones leves.
- **Normal**: Experiencia estándar equilibrada.
- **Difícil**: Desafío para jugadores experimentados, con ritmo acelerado y penalizaciones severas.

Cada nivel de dificultad modifica múltiples aspectos del juego, incluyendo:

- Velocidad de aparición de iconos
- Tamaño del tablero
- Número y variedad de iconos
- Penalizaciones por errores
- Requisitos para completar niveles
- Límites de nivel máximo
- Multiplicadores de puntuación

## 2. Archivos Clave y su Ubicación

El sistema de dificultad está implementado en varios archivos clave:

### 2.1 Configuración Principal

- **`src/utils/config.ts`**: Contiene las definiciones de dificultad, constantes y configuraciones.
  - Líneas 290-340: Definición de `DIFFICULTY_LEVELS`
  - Líneas 400-450: Configuración detallada en `DIFFICULTY_CONFIG`

### 2.2 Sistema de Niveles

- **`src/utils/levels.ts`**: Implementa la lógica para ajustar niveles según la dificultad.
  - Líneas 40-60: Multiplicadores de dificultad en `DIFFICULTY_MULTIPLIERS`
  - Líneas 300-400: Función `getLevelConfig()` que aplica ajustes de dificultad

### 2.3 Componente del Tablero de Juego

- **`src/components/game/GameBoard/GameBoard.tsx`**: Implementa la interfaz del tablero y responde a la dificultad.
  - Líneas 20-30: Obtiene la dificultad actual del estado de Redux
  - Líneas 200-250: Maneja cambios de velocidad basados en dificultad

### 2.4 Utilidades del Tablero

- **`src/utils/boardUtils.ts`**: Funciones para configurar el tablero según nivel y dificultad.

### 2.5 Estado del Juego (Redux)

- **`src/store/slices/gameSlice.ts`**: Almacena y gestiona el estado de dificultad actual.

## 3. Niveles de Dificultad Predefinidos

A continuación se detallan las configuraciones específicas para cada nivel de dificultad:

### 3.1 Tutorial

```typescript
// En src/utils/config.ts - DIFFICULTY_LEVELS.TUTORIAL
{
  name: 'tutorial',
  initialSpawnRate: 5000,      // 5 segundos entre apariciones
  speedIncreaseTime: 60000,    // Aumento de velocidad cada 60 segundos
  maxSpeedMultiplier: 1.5,     // Velocidad máxima: 1.5x la inicial
  penaltyIcons: 0,             // Sin iconos de penalización
  initialIcons: 20,            // Comienza con 20 iconos en el tablero
  maxLevel: 1,                 // Solo permite jugar el primer nivel
}

// En src/utils/config.ts - DIFFICULTY_CONFIG.tutorial
{
  spawnRate: 5000,                
  speedIncreaseInterval: 60,      
  speedIncreaseAmount: 100,       
  minSpawnRate: 1667,             // Exactamente x3 (5000/3)
  penaltyIcons: 0,                
  maxIconsOnBoard: 32,            
  initialIconCount: 6,            
  maxLevel: 1                     
}
```

### 3.2 Fácil

```typescript
// En src/utils/config.ts - DIFFICULTY_LEVELS.EASY
{
  name: 'easy',
  initialSpawnRate: 3000,      // 3 segundos entre apariciones
  speedIncreaseTime: 20000,    // Aumento de velocidad cada 20 segundos
  maxSpeedMultiplier: 2,       // Velocidad máxima: 2x la inicial
  penaltyIcons: 1,             // 1 icono de penalización por error
  initialIcons: 30,            // Comienza con 30 iconos en el tablero
  maxLevel: 3,                 // Permite jugar hasta el nivel 3
}

// En src/utils/config.ts - DIFFICULTY_CONFIG.easy
{
  spawnRate: 4000,                
  speedIncreaseInterval: 30,      
  speedIncreaseAmount: 200,       
  minSpawnRate: 1333,             // Exactamente el mínimo para x3 (4000/3)
  penaltyIcons: 1,                
  maxIconsOnBoard: 48,            
  initialIconCount: 20,           
  maxLevel: 5                     
}
```

### 3.3 Normal

```typescript
// En src/utils/config.ts - DIFFICULTY_LEVELS.NORMAL
{
  name: 'normal',
  initialSpawnRate: 3000,      // 3 segundos entre apariciones
  speedIncreaseTime: 15000,    // Aumento de velocidad cada 15 segundos
  maxSpeedMultiplier: 3,       // Velocidad máxima: 3x la inicial
  penaltyIcons: 3,             // 3 iconos de penalización por error
  initialIcons: 45,            // Comienza con 45 iconos en el tablero
  maxLevel: 5,                 // Permite jugar hasta el nivel 5
}

// En src/utils/config.ts - DIFFICULTY_CONFIG.normal
{
  spawnRate: 3000,                
  speedIncreaseInterval: 20,      
  speedIncreaseAmount: 250,       
  minSpawnRate: 1000,             // Exactamente x3
  penaltyIcons: 2,                
  maxIconsOnBoard: 60,            
  initialIconCount: 45,           
  maxLevel: 7                     
}
```

### 3.4 Difícil

```typescript
// En src/utils/config.ts - DIFFICULTY_LEVELS.HARD
{
  name: 'hard',
  initialSpawnRate: 2000,      // 2 segundos entre apariciones
  speedIncreaseTime: 15000,    // Aumento de velocidad cada 15 segundos
  maxSpeedMultiplier: 4,       // Velocidad máxima: 4x la inicial
  penaltyIcons: 3,             // 3 iconos de penalización por error
  initialIcons: 6,             // Comienza con 6 iconos en el tablero
  maxLevel: 55,                // Permite jugar hasta el nivel 55
}

// En src/utils/config.ts - DIFFICULTY_CONFIG.hard
{
  spawnRate: 2000,                
  speedIncreaseInterval: 15,      
  speedIncreaseAmount: 300,       
  minSpawnRate: 667,              // Exactamente x3 (2000/3)
  penaltyIcons: 3,                
  maxIconsOnBoard: 60,            
  initialIconCount: 45,           
  maxLevel: 10                    
}
```

## 4. Implementación Técnica

### 4.1 Aplicación de Dificultad a Niveles

La función `getLevelConfig()` en `src/utils/levels.ts` es la responsable de aplicar los ajustes de dificultad a cada nivel:

```typescript
export function getLevelConfig(
  level: number,
  playMode: GamePlayMode,
  difficulty: GameDifficulty
): LevelConfig {
  // Primero intentamos obtener un nivel predefinido
  const predefinedLevel = PREDEFINED_LEVELS.find(l => l.id === level);
  
  // Si existe, lo utilizamos como base
  const baseConfig = predefinedLevel || generateDynamicLevel(level);
  
  // Ajustar según dificultad
  const difficultyMod = DIFFICULTY_MULTIPLIERS[difficulty];
  
  // Crear una copia para no modificar el original
  const adjustedConfig = JSON.parse(JSON.stringify(baseConfig)) as LevelConfig;
  
  // Ajustar spawnRate según dificultad
  adjustedConfig.spawnRate = Math.round(adjustedConfig.spawnRate * difficultyMod.spawnRate);
  
  // Ajustar requisitos según dificultad
  // ...
}
```

### 4.2 Multiplicadores de Dificultad

Los multiplicadores de dificultad están definidos en `src/utils/levels.ts`:

```typescript
export const DIFFICULTY_MULTIPLIERS = {
  easy: {
    spawnRate: 1.3,           // 30% más lento
    scoreRequirement: 0.7,     // 30% menos puntos requeridos
    timeRequirement: 0.8       // 20% menos tiempo requerido
  },
  normal: {
    spawnRate: 1.0,           // Velocidad estándar
    scoreRequirement: 1.0,     // Requisitos estándar
    timeRequirement: 1.0       // Requisitos estándar
  },
  hard: {
    spawnRate: 0.7,           // 30% más rápido
    scoreRequirement: 1.3,     // 30% más puntos requeridos
    timeRequirement: 1.2       // 20% más tiempo requerido
  },
  tutorial: {
    spawnRate: 2.0,           // 100% más lento (el doble de tiempo)
    scoreRequirement: 0.5,     // 50% menos puntos requeridos
    timeRequirement: 0.5       // 50% menos tiempo requerido
  }
};
```

### 4.3 Configuración del Tablero por Nivel y Dificultad

La configuración del tablero se ajusta según el nivel y la dificultad en `boardUtils.ts`:

```typescript
export function configureBoardForLevel(level: number, preserveSpeed: boolean = false): BoardConfig {
  // Obtener el estado actual
  const { spawnRate: currentSpawnRate, currentDifficulty } = store.getState().game;
  
  // Determinar nuevos valores basados en el nivel y dificultad
  const size = config.getLevelBoardSize(level);
  const spawnRate = preserveSpeed ? currentSpawnRate : config.getLevelSpawnRate(level, currentDifficulty);
  const iconCount = config.iconCountByLevel(level, currentDifficulty);
  const icons = getRandomIcons(iconCount, currentDifficulty);
  
  // Aplicar los cambios
  changeBoardSize(size);
  if (!preserveSpeed) {
    changeSpawnRate(spawnRate);
  }
  setAvailableBoardIcons(icons);
  
  return {
    size,
    spawnRate: preserveSpeed ? currentSpawnRate : spawnRate,
    icons
  };
}
```

### 4.4 Tamaño del Tablero

El tamaño del tablero aumenta con el nivel, afectando la dificultad general:

```typescript
// En src/utils/config.ts
export const BOARD_SIZES = [
  8, // Nivel 1: 8x8
  8, // Nivel 2: 8x8
  8, // Nivel 3: 8x8
  8, // Nivel 4: 8x8
  9, // Nivel 5: 9x9
  9, // Nivel 6: 9x9
  10, // Nivel 7: 10x10
  10, // Nivel 8: 10x10
  12, // Nivel 9: 12x12
  12, // Nivel 10: 12x12
];
```

### 4.5 Velocidad de Aparición de Iconos

La velocidad de aparición (spawn rate) es uno de los principales factores de dificultad:

```typescript
// En src/utils/config.ts
export const SPAWN_RATES = {
  TUTORIAL: 4500,     // Muy lento para principiantes
  VERY_SLOW: 3500,    // Muy lento para nivel bajo
  SLOW: 2500,         // Lento para nivel medio-bajo
  MEDIUM: 2000,       // Velocidad equilibrada
  FAST: 1500,         // Rápido para nivel medio-alto
  SUPER_FAST: 1000,   // Muy rápido para nivel alto
  EXTREME: 750        // Extremadamente rápido para expertos
};
```

### 4.6 Variedad de Iconos

La dificultad también escala con la cantidad y tipo de iconos en el tablero:

```typescript
// En src/utils/config.ts
export function iconCountByLevel(level: number): number {
  // A medida que aumenta el nivel, aumenta la variedad de iconos
  const baseCount = 4; // Número base de iconos
  const increase = Math.floor((level - 1) / 2); // Aumentar cada 2 niveles
  
  // El número de iconos aumenta con los niveles
  const iconCount = baseCount + increase;
  
  // Limitar a un rango razonable
  return Math.min(8, Math.max(3, iconCount));
}
```

## 5. Interacción con Modos de Juego

La dificultad también interactúa con los diferentes modos de juego:

### 5.1 Modo Clásico

```typescript
// En src/utils/config.ts - GAME_MODE_CONFIG.CLASSIC
{
  name: 'classic',
  displayName: 'Clásico',
  description: 'Alcanza objetivos de puntuación y ocupación para avanzar de nivel',
  initialIcons: 45,
  initialScoreTarget: 1000,
  scoreTargetMultiplier: 1.5,
  initialSpawnRate: SPAWN_RATES.MEDIUM,
  initialOccupationTarget: 70, 
  occupationDecreasePerLevel: 0, 
  basePenalty: 1, 
  speedIncreaseTime: 20000,
  maxSpeedMultiplier: 3,
}
```

### 5.2 Modo Contrarreloj

```typescript
// En src/utils/config.ts - GAME_MODE_CONFIG.TIMED
{
  name: 'timed',
  displayName: 'Contrarreloj',
  description: 'Consigue la mayor puntuación posible antes de que se acabe el tiempo',
  initialIcons: 25,
  initialTimeLimit: 120,
  initialSpawnRate: SPAWN_RATES.MEDIUM,
  timeBonusPerLevel: 30, 
  comboBonusTime: 5, 
  timeDecreasePerLevel: 10, 
  speedIncreaseTime: 15000,
  maxSpeedMultiplier: 2.5,
}
```

### 5.3 Modo Supervivencia

```typescript
// En src/utils/config.ts - GAME_MODE_CONFIG.SURVIVAL
{
  name: 'survival',
  displayName: 'Supervivencia',
  description: 'Sobrevive el mayor tiempo posible sin llenar el tablero',
  initialIcons: 50,
  movesBeforeSpawn: 1,
  initialSpawnRate: SPAWN_RATES.VERY_SLOW,
  speedIncreaseInterval: 20, 
  specialIconProbability: 0.1, 
  specialIconInterval: 60, 
  maxSpeedMultiplier: 4, 
  speedIncreaseTime: 10000,
}
```

## 6. Sistema de Puntuación y Dificultad

La dificultad también afecta a la puntuación mediante multiplicadores:

```typescript
// En src/utils/config.ts - SCORE_VALUES
export const SCORE_VALUES = {
  BASE_CONVERGENCE: 10,    
  LEVEL_MULTIPLIER: 2,     
  COMBO_MULTIPLIER: 1.5,   
  TIME_BONUS: 5,           
  EMPTY_BOARD_BONUS: 500,  
  SPECIAL_ICON_BONUS: 100, 
  DIFFICULTY_MULTIPLIERS: {
    easy: 0.8,
    normal: 1.0,
    hard: 1.5,
    tutorial: 0.5
  },
  MODE_MULTIPLIERS: {
    classic: 1.0,
    timed: 1.2,
    survival: 1.5
  }
};
```

## 7. Cómo Implementar Nuevas Dificultades

Para implementar una nueva dificultad en el juego, sigue estos pasos:

### 7.1 Añadir la Nueva Dificultad en config.ts

1. Primero, añade la nueva dificultad en `DIFFICULTY_LEVELS` en `src/utils/config.ts`:

```typescript
// En src/utils/config.ts - DIFFICULTY_LEVELS
export const DIFFICULTY_LEVELS = {
  // Dificultades existentes...
  
  NEW_DIFFICULTY: {
    name: 'new_difficulty',
    initialSpawnRate: 1500,      // Ajusta según necesidad
    speedIncreaseTime: 12000,    // Ajusta según necesidad
    maxSpeedMultiplier: 5,       // Ajusta según necesidad
    penaltyIcons: 4,             // Ajusta según necesidad
    initialIcons: 50,            // Ajusta según necesidad
    maxLevel: 15,                // Ajusta según necesidad
  },
};
```

2. Luego, añade la configuración detallada en `DIFFICULTY_CONFIG`:

```typescript
// En src/utils/config.ts - DIFFICULTY_CONFIG
export const DIFFICULTY_CONFIG = {
  // Configuraciones existentes...
  
  new_difficulty: {
    spawnRate: 1500,                
    speedIncreaseInterval: 12,      
    speedIncreaseAmount: 350,       
    minSpawnRate: 500,              
    penaltyIcons: 4,                
    maxIconsOnBoard: 70,            
    initialIconCount: 50,           
    maxLevel: 15                    
  }
};
```

### 7.2 Actualizar los Multiplicadores en levels.ts

Añade los multiplicadores para la nueva dificultad en `src/utils/levels.ts`:

```typescript
// En src/utils/levels.ts - DIFFICULTY_MULTIPLIERS
export const DIFFICULTY_MULTIPLIERS = {
  // Multiplicadores existentes...
  
  new_difficulty: {
    spawnRate: 0.5,           // 50% más rápido
    scoreRequirement: 1.5,     // 50% más puntos requeridos
    timeRequirement: 1.3       // 30% más tiempo requerido
  }
};
```

### 7.3 Actualizar el Sistema de Puntuación

Añade el multiplicador de puntuación para la nueva dificultad:

```typescript
// En src/utils/config.ts - SCORE_VALUES.DIFFICULTY_MULTIPLIERS
DIFFICULTY_MULTIPLIERS: {
  easy: 0.8,
  normal: 1.0,
  hard: 1.5,
  tutorial: 0.5,
  new_difficulty: 2.0  // Nuevo multiplicador
}
```

### 7.4 Actualizar el Tipo GameDifficulty en gameSlice.ts

Actualiza la definición del tipo en `src/store/slices/gameSlice.ts`:

```typescript
// En src/store/slices/gameSlice.ts
export type GameDifficulty = 'easy' | 'normal' | 'hard' | 'tutorial' | 'new_difficulty';
```

### 7.5 Añadir Conjuntos de Iconos para la Nueva Dificultad

Si es necesario, añade configuraciones específicas de iconos para la nueva dificultad:

```typescript
// En src/utils/config.ts - LEVEL_ICON_SETS
export const LEVEL_ICON_SETS: Record<GameMode, Record<number, string[]>> = {
  // Configuraciones existentes...
  
  new_difficulty: {
    1: ["fruits", "animals", "faces", "sports", "vehicles"],
    2: ["vehicles", "weather", "symbols", "geometric", "tools"],
    // Añadir más niveles según sea necesario
  }
};
```

## 8. Ejemplos Prácticos

### 8.1 Ejemplo: Implementación de Dificultad "Extrema"

A continuación se muestra un ejemplo completo de cómo implementar una nueva dificultad "Extrema":

```typescript
// En src/utils/config.ts - DIFFICULTY_LEVELS
EXTREME: {
  name: 'extreme',
  initialSpawnRate: 1000,      // 1 segundo entre apariciones
  speedIncreaseTime: 10000,    // Aumento de velocidad cada 10 segundos
  maxSpeedMultiplier: 6,       // Velocidad máxima: 6x la inicial
  penaltyIcons: 5,             // 5 iconos de penalización por error
  initialIcons: 60,            // Comienza con 60 iconos en el tablero
  maxLevel: 20,                // Permite jugar hasta el nivel 20
}

// En src/utils/config.ts - DIFFICULTY_CONFIG
extreme: {
  spawnRate: 1000,                
  speedIncreaseInterval: 10,      
  speedIncreaseAmount: 400,       
  minSpawnRate: 333,              // Exactamente x3 (1000/3)
  penaltyIcons: 5,                
  maxIconsOnBoard: 80,            
  initialIconCount: 60,           
  maxLevel: 20                    
}

// En src/utils/levels.ts - DIFFICULTY_MULTIPLIERS
extreme: {
  spawnRate: 0.5,           // 50% más rápido
  scoreRequirement: 2.0,     // 100% más puntos requeridos
  timeRequirement: 1.5       // 50% más tiempo requerido
}

// En src/utils/config.ts - SCORE_VALUES.DIFFICULTY_MULTIPLIERS
DIFFICULTY_MULTIPLIERS: {
  easy: 0.8,
  normal: 1.0,
  hard: 1.5,
  tutorial: 0.5,
  extreme: 2.5  // Mayor recompensa por mayor dificultad
}
```

### 8.2 Ejemplo: Ajuste de Dificultad Existente

Si deseas ajustar una dificultad existente, puedes modificar sus valores. Por ejemplo, para hacer la dificultad "Hard" aún más desafiante:

```typescript
// En src/utils/config.ts - DIFFICULTY_LEVELS.HARD
HARD: {
  name: 'hard',
  initialSpawnRate: 1800,      // Reducido de 2000 a 1800
  speedIncreaseTime: 12000,    // Reducido de 15000 a 12000
  maxSpeedMultiplier: 5,       // Aumentado de 4 a 5
  penaltyIcons: 4,             // Aumentado de 3 a 4
  initialIcons: 8,             // Aumentado de 6 a 8
  maxLevel: 55,                // Sin cambios
}
```

## 9. Consideraciones de Rendimiento

Al implementar o modificar dificultades, ten en cuenta estas consideraciones de rendimiento:

### 9.1 Optimización para Dispositivos de Bajo Rendimiento

El componente `GameBoard.tsx` incluye optimizaciones para dispositivos de bajo rendimiento:

```typescript
// En src/components/game/GameBoard/GameBoard.tsx
const [lowPerformanceMode, setLowPerformanceMode] = useState<boolean>(false);

// Umbral de FPS bajo el cual activamos el modo de bajo rendimiento
const LOW_FPS_THRESHOLD = 40;

// Manejador para cuando se detecta una caída de rendimiento
const handlePerformanceDrop = useCallback((avgFps: number) => {
  // Si ya activamos el modo, no volver a hacerlo
  if (performanceActivatedRef.current) {
    return;
  }

  // Marcar como activado
  performanceActivatedRef.current = true;

  console.log(
    `GameBoard: Detectada caída de rendimiento. FPS promedio: ${avgFps}`
  );

  // Activar el modo de bajo rendimiento (local)
  setLowPerformanceMode(true);

  // Si el FPS es extremadamente bajo, activar el modo de rendimiento alto
  if (avgFps < 20) {
    // Añadir clase de rendimiento alto a nivel de documento
    document.documentElement.classList.add("performance-mode");
    document.documentElement.classList.add("performance-mode-high");
  } else {
    // Añadir clase a nivel de documento para que otros componentes respondan
    document.documentElement.classList.add("performance-mode");
  }
});
```

### 9.2 Ajuste Automático de Dificultad

Considerar implementar un sistema de ajuste automático de dificultad basado en el rendimiento del dispositivo:

```typescript
// Ejemplo conceptual
function adjustDifficultyForPerformance(fps: number, currentDifficulty: GameDifficulty): GameDifficulty {
  if (fps < 30 && currentDifficulty === 'hard') {
    return 'normal';
  } else if (fps < 20 && currentDifficulty === 'normal') {
    return 'easy';
  }
  return currentDifficulty;
}
```
```