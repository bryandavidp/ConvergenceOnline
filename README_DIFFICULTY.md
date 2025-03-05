# Sistema de Dificultad en Convergence Online

Este documento técnico explica en detalle cómo funcionan las dificultades en el juego Convergence Online, dónde se aplican y cómo afectan a la experiencia del jugador.

## 1. Niveles de Dificultad

El juego cuenta con 4 niveles de dificultad predefinidos:

| Dificultad | Descripción |
|------------|-------------|
| **Tutorial** | Diseñado para principiantes, con configuraciones muy amigables y sin penalizaciones |
| **Fácil** | Para jugadores casuales, con ritmo moderado y penalizaciones leves |
| **Normal** | Experiencia estándar equilibrada |
| **Difícil** | Desafío para jugadores experimentados, con ritmo acelerado y penalizaciones severas |

## 2. Configuración de Dificultad

Cada nivel de dificultad modifica múltiples aspectos del juego:

### Tutorial

```typescript
{
  initialSpawnRate: 5000,      // 5 segundos entre apariciones
  speedIncreaseTime: 60000,    // Aumento de velocidad cada 60 segundos
  maxSpeedMultiplier: 1.5,     // Velocidad máxima: 1.5x la inicial
  penaltyIcons: 0,             // Sin iconos de penalización
  initialIcons: 3,             // Comienza con 3 iconos en el tablero
  maxLevel: 1,                 // Solo permite jugar el primer nivel
  spawnRate: 2.0,              // Multiplicador de velocidad (más lento)
  scoreRequirement: 0.5,       // Requisitos de puntuación reducidos
  timeRequirement: 0.5         // Requisitos de tiempo reducidos
}
```

### Fácil

```typescript
{
  initialSpawnRate: 3000,      // 3 segundos entre apariciones
  speedIncreaseTime: 20000,    // Aumento de velocidad cada 20 segundos
  maxSpeedMultiplier: 2,       // Velocidad máxima: 2x la inicial
  penaltyIcons: 1,             // 1 icono de penalización por error
  initialIcons: 4,             // Comienza con 4 iconos en el tablero
  maxLevel: 3,                 // Permite jugar hasta el nivel 3
  spawnRate: 1.3,              // Multiplicador de velocidad (más lento)
  scoreRequirement: 0.7,       // Requisitos de puntuación reducidos
  timeRequirement: 0.8         // Requisitos de tiempo ligeramente reducidos
}
```

### Normal

```typescript
{
  initialSpawnRate: 3000,      // 3 segundos entre apariciones
  speedIncreaseTime: 15000,    // Aumento de velocidad cada 15 segundos
  maxSpeedMultiplier: 3,       // Velocidad máxima: 3x la inicial
  penaltyIcons: 3,             // 3 iconos de penalización por error
  initialIcons: 5,             // Comienza con 5 iconos en el tablero
  maxLevel: 5,                 // Permite jugar hasta el nivel 5
  spawnRate: 1.0,              // Multiplicador de velocidad estándar
  scoreRequirement: 1.0,       // Requisitos de puntuación estándar
  timeRequirement: 1.0         // Requisitos de tiempo estándar
}
```

### Difícil

```typescript
{
  initialSpawnRate: 2000,      // 2 segundos entre apariciones
  speedIncreaseTime: 15000,    // Aumento de velocidad cada 15 segundos
  maxSpeedMultiplier: 4,       // Velocidad máxima: 4x la inicial
  penaltyIcons: 3,             // 3 iconos de penalización por error
  initialIcons: 6,             // Comienza con 6 iconos en el tablero
  maxLevel: 5,                 // Permite jugar hasta el nivel 5
  spawnRate: 0.7,              // Multiplicador de velocidad (más rápido)
  scoreRequirement: 1.3,       // Requisitos de puntuación aumentados
  timeRequirement: 1.2         // Requisitos de tiempo aumentados
}
```

## 3. Implementación y Aplicación

El sistema de dificultad se aplica en diferentes partes del código:

### 3.1 Configuración del Tablero por Nivel

La función `configureBoardForLevel()` en `boardUtils.ts` es la responsable principal de ajustar el tablero según el nivel y la dificultad:

```typescript
export function configureBoardForLevel(level: number, preserveSpeed: boolean = false): BoardConfig {
  // Obtener el estado actual
  const { spawnRate: currentSpawnRate } = store.getState().game;
  
  // Determinar nuevos valores basados en el nivel
  const size = config.getLevelBoardSize(level);
  const spawnRate = preserveSpeed ? currentSpawnRate : config.getLevelSpawnRate(level);
  const iconCount = config.iconCountByLevel(level);
  const icons = getRandomIcons(iconCount);
  
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

### 3.2 Ajuste de Configuración por Nivel y Dificultad

La función `getLevelConfig()` en `levels.ts` aplica los ajustes específicos por dificultad:

```typescript
export function getLevelConfig(
  level: number,
  playMode: GamePlayMode,
  difficulty: GameDifficulty
): LevelConfig {
  // Obtener configuración base
  const baseConfig = predefinedLevel || generateDynamicLevel(level);
  
  // Ajustar según dificultad
  const difficultyMod = DIFFICULTY_MULTIPLIERS[difficulty];
  
  // Aplicar ajustes de dificultad
  const adjustedConfig = {...baseConfig};
  adjustedConfig.spawnRate = Math.round(adjustedConfig.spawnRate * difficultyMod.spawnRate);
  
  // Ajustar requisitos según dificultad
  // ...
}
```

### 3.3 Tamaño del Tablero

El tamaño del tablero aumenta con el nivel, afectando la dificultad general:

```typescript
export const BOARD_SIZES = [
  8, // Nivel 1: 8x8
  8, // Nivel 2: 8x8
  8, // Nivel 3: 8x8
  8, // Nivel 4: 8x8
  9, // Nivel 5: 9x9
];
```

### 3.4 Velocidad de Aparición de Iconos

La velocidad de aparición (spawn rate) es uno de los principales factores de dificultad:

```typescript
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

### 3.5 Variedad de Iconos

La dificultad también escala con la cantidad y tipo de iconos en el tablero:

```typescript
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

## 4. Modos de Juego y Dificultad

La dificultad también interactúa con los diferentes modos de juego:

### 4.1 Modo Clásico

```typescript
{
  initialBoardSize: 8,
  maxBoardSize: 8,
  initialSpawnRate: SPAWN_RATES.MEDIUM,
  initialScoreTarget: 1000,
  scoreTargetMultiplier: 1.5,        // Multiplica el objetivo por nivel
  initialOccupationTarget: 70,       // Porcentaje
  occupationDecreasePerLevel: 3,     // Disminución del objetivo por nivel
  basePenalty: 1,                    // Iconos añadidos por error
  speedIncreaseTime: 20000,
  maxSpeedMultiplier: 3
}
```

### 4.2 Modo Contrarreloj

```typescript
{
  boardSize: 7,                      // Tamaño fijo
  initialSpawnRate: SPAWN_RATES.MEDIUM,
  initialTimeLimit: 120,             // 2 minutos
  timeBonusPerLevel: 30,             // Segundos añadidos al pasar de nivel
  comboBonusTime: 5,                 // Segundos añadidos por combo
  timeDecreasePerLevel: 10,          // Segundos menos en cada nivel
  speedIncreaseTime: 15000,
  maxSpeedMultiplier: 2.5
}
```

### 4.3 Modo Supervivencia

```typescript
{
  boardSize: 8,                      // Fijo y grande
  initialSpawnRate: SPAWN_RATES.VERY_SLOW,
  speedIncreaseInterval: 20,         // Segundos entre aumento de velocidad
  specialIconProbability: 0.1,       // 10% de probabilidad de icono especial
  specialIconInterval: 60,           // Aparece aproximadamente cada 60 segundos
  maxSpeedMultiplier: 4,             // Velocidad máxima x4
  speedIncreaseTime: 10000
}
```

## 5. Sistema de Puntuación y Dificultad

La dificultad también afecta a la puntuación mediante multiplicadores:

```typescript
export const SCORE_VALUES = {
  // ...
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

## 6. Conclusión

El sistema de dificultad de Convergence Online es complejo y multifacético, afectando a:

- Velocidad de aparición de iconos
- Tamaño del tablero
- Número inicial de iconos
- Cantidad de iconos por penalización
- Variedad de iconos disponibles
- Requisitos para completar niveles
- Puntuación obtenida
- Velocidad de aumento de dificultad
- Nivel máximo alcanzable

Esta implementación permite una experiencia escalable que puede satisfacer tanto a jugadores principiantes como a expertos, adaptándose a diferentes niveles de habilidad y estilos de juego. 