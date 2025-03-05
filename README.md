# Convergence Online - Guía de Configuración

## Índice
1. [Introducción](#introducción)
2. [Estructura del Juego](#estructura-del-juego)
3. [Modos de Juego](#modos-de-juego)
4. [Sistema de Niveles](#sistema-de-niveles)
5. [Configuración de Dificultad](#configuración-de-dificultad)
6. [Características Especiales](#características-especiales)
7. [Cómo Modificar el Juego](#cómo-modificar-el-juego)
8. [Implementación de Modos Avanzados](#implementación-de-modos-avanzados)
9. [Tips para Desarrolladores](#tips-para-desarrolladores)

## Introducción

Convergence Online es un juego de puzzle basado en la mecánica de convergencia de iconos. El objetivo del juego es eliminar iconos del tablero colocándolos en posiciones donde convergen con otros iconos del mismo tipo. El juego ofrece diferentes modos y niveles de dificultad, así como un sistema de progresión basado en niveles.

Este documento explica cómo está estructurado el juego y cómo se puede modificar o extender para crear nuevas experiencias de juego.

## Estructura del Juego

El juego está desarrollado con React y TypeScript, y utiliza Redux para la gestión del estado. La estructura principal del juego incluye:

- **Redux Store**: Gestiona el estado global del juego, incluyendo el tablero, puntuación, nivel actual, etc.
- **Componentes de React**: Responsables de la interfaz de usuario y la interacción.
- **Hooks Personalizados**: Manejan la lógica de juego, como `useBoardInteraction` para la interacción con el tablero.
- **Archivos de Configuración**: Definen los niveles, modos de juego, dificultades, etc.

## Modos de Juego

El juego ofrece cuatro modos de juego principales:

### 1. Modo Clásico

- **Objetivo**: Dejar el tablero vacío o quedarse sin convergencias disponibles con el tablero casi vacío.
- **Mecánica**: Los iconos aparecen periódicamente en el tablero. El jugador debe colocarlos estratégicamente para formar convergencias y eliminarlos.
- **Progresión**: Al completar un nivel, el jugador avanza al siguiente con mayor dificultad. Si ha dejado el tablero vacío se le suman 500 puntos de bonificacion.

### 2. Modo Contrarreloj (Timed)

- **Objetivo**: Sobrevivir durante un tiempo específico con un tablero que se llena progresivamente.
- **Mecánica**: Similar al modo clásico, pero con un temporizador que marca el tiempo restante para completar el nivel.
- **Progresión**: Cada nivel requiere sobrevivir más tiempo.

### 3. Modo Supervivencia (Survival)

- **Objetivo**: Jugar el mayor tiempo posible sin que el tablero se llene completamente.
- **Mecánica**: El tablero se llena progresivamente más rápido. El juego termina cuando no quedan movimientos válidos o el tablero está demasiado lleno.
- **Progresión**: Desbloqueo de características especiales y aumento progresivo de la dificultad.

### 4. Modo Zen

- **Objetivo**: Jugar sin presión, sin límites de tiempo ni objetivos específicos.
- **Mecánica**: Similar al modo clásico pero sin condiciones de fracaso.
- **Progresión**: No hay progresión estructurada, es un modo para relajarse y disfrutar del juego.

## Sistema de Niveles

Cada nivel en el juego está definido por una configuración específica que incluye:
```typescript
export interface LevelConfig {
  id: number;
  boardSize: number;
  icons: string[];
  spawnRate: number;
  speedMultiplier: number;
  penaltyIcons: number;
  requirements: {
    classic: LevelRequirement[];
    timed: LevelRequirement[];
    survival: LevelRequirement[];
    zen?: LevelRequirement[];
  };
  rewards: {
    classic?: LevelReward[];
    timed?: LevelReward[];
    survival?: LevelReward[];
    zen?: LevelReward[];
  };
  specialFeatures?: {
    specialIcons?: SpecialFeature;
    bonusItems?: SpecialFeature;
    powerUps?: SpecialFeature;
    obstacles?: SpecialFeature;
  };
}
```

Los niveles pueden ser:
- **Predefinidos**: Configurados manualmente en el archivo `levels.ts`
- **Dinámicos**: Generados automáticamente mediante el algoritmo en la función `generateDynamicLevel()`

## Configuración de Dificultad

El juego ofrece cuatro niveles de dificultad:

1. **Tutorial**: Ritmo muy lento, ideal para aprender las mecánicas
2. **Fácil**: Iconos aparecen más lentamente y requisitos reducidos
3. **Normal**: Equilibrado para la mayoría de jugadores
4. **Difícil**: Iconos aparecen más rápidamente y requisitos aumentados

Cada dificultad modifica los siguientes parámetros:
```typescript
export const DIFFICULTY_MULTIPLIERS = {
  easy: {
    spawnRate: 1.3,
    scoreRequirement: 0.7,
    timeRequirement: 0.8
  },
  normal: {
    spawnRate: 1.0,
    scoreRequirement: 1.0,
    timeRequirement: 1.0
  },
  hard: {
    spawnRate: 0.7,
    scoreRequirement: 1.3,
    timeRequirement: 1.2
  },
  tutorial: {
    spawnRate: 2.0,
    scoreRequirement: 0.5,
    timeRequirement: 0.5
  }
};
```

## Características Especiales

El juego incluye varias características especiales que pueden añadirse a los niveles:

### Iconos Especiales

- **Bomba**: Elimina iconos adyacentes
- **Estrella**: Elimina todos los iconos del mismo tipo
- **Arcoíris**: Actúa como comodín, puede combinarse con cualquier icono
- **Reloj**: Añade tiempo extra (en modo contrarreloj)

### Bonificaciones

- **Puntos**: Otorga puntos adicionales
- **Tiempo**: Añade tiempo extra
- **Pista**: Proporciona una pista adicional

### Power-ups

- **Ralentización**: Reduce temporalmente la velocidad de aparición de iconos
- **Limpieza**: Elimina varios iconos del tablero

### Obstáculos

- **Bloqueo**: Bloques que no pueden ser ocupados
- **Hielo**: Celdas congeladas que requieren múltiples coincidencias para desbloquear

## Implementación de Características Especiales

Esta sección explica cómo implementar y personalizar las características especiales del juego.

### 1. Implementación de Iconos Especiales

Los iconos especiales son elementos que proporcionan efectos únicos cuando se eliminan del tablero. Veamos cómo implementar un nuevo icono especial:

```typescript
// 1. Definir el nuevo icono especial en utils/config.ts
export const SPECIAL_ICONS = {
  // ... iconos existentes
  RAINBOW: {
    symbol: '🌈',
    name: 'rainbow',
    probability: 0.05,  // 5% de probabilidad de aparición
    score: 200,         // Puntos base al eliminar
    effectRadius: 0,    // 0 para efecto global
    description: 'Actúa como comodín y puede combinarse con cualquier icono'
  },
  // Nuestro nuevo icono especial
  LIGHTNING: {
    symbol: '⚡',
    name: 'lightning',
    probability: 0.04,  // 4% de probabilidad de aparición
    score: 250,         // Puntos base al eliminar
    effectRadius: 2,    // Afecta a iconos en un radio de 2 celdas
    description: 'Elimina iconos en un área de 5x5'
  }
};

// 2. Añadir al conjunto de iconos disponibles
export const AVAILABLE_SPECIAL_ICONS = [
  SPECIAL_ICONS.BOMB.symbol,
  SPECIAL_ICONS.STAR.symbol,
  SPECIAL_ICONS.RAINBOW.symbol,
  SPECIAL_ICONS.LIGHTNING.symbol  // Añadir el nuevo icono
];
```

Ahora, implementamos la lógica para procesar este icono especial:

```typescript
// En src/hooks/useGameLogic.ts

// En la función que maneja la eliminación de iconos
const processSpecialIconEffect = useCallback((icon: string, row: number, col: number) => {
  // ... código existente para otros iconos especiales
  
  // Implementar efecto para el nuevo icono de rayo
  if (icon === '⚡') {
    const cellsToRemove: {row: number, col: number}[] = [];
    
    // Afecta a un área de 5x5 (radio 2) centrada en la posición del rayo
    for (let r = row - 2; r <= row + 2; r++) {
      for (let c = col - 2; c <= col + 2; c++) {
        if (isValidCell(r, c, boardSize) && board[r][c] !== null) {
          cellsToRemove.push({row: r, col: c});
        }
      }
    }
    
    // Efecto visual de rayo
    cellsToRemove.forEach(({row, col}) => {
      const cellKey = `${row}-${col}`;
      const cellElement = cellRefs.current[cellKey];
      
      if (cellElement) {
        // Añadir clase de animación
        cellElement.classList.add('lightning-effect');
        
        // Eliminar clase después de completar la animación
        setTimeout(() => {
          cellElement.classList.remove('lightning-effect');
        }, 500);
      }
    });
    
    // Eliminar las celdas afectadas después de un breve retraso
    setTimeout(() => {
      removeIconsFromBoard(cellsToRemove);
      
      // Otorgar puntos basados en la cantidad de iconos eliminados
      const pointsPerIcon = 50;
      const scoreGain = cellsToRemove.length * pointsPerIcon;
      dispatch(incrementScore(scoreGain));
      
      // Mostrar puntos ganados
      showFloatingPoints(row, col, scoreGain);
    }, 200);
    
    // Reproducir efecto de sonido
    audioManager.play('specialIconEffect');
    
    return true;
  }
  
  return false;
}, [board, boardSize, dispatch, removeIconsFromBoard, showFloatingPoints]);
```

### 2. Implementación de Bonificaciones (Items Bonus)

Las bonificaciones son elementos que aparecen temporalmente y ofrecen ventajas cuando se recogen. Veamos cómo implementar una nueva bonificación:

```typescript
// 1. Definir la nueva bonificación en utils/config.ts
export const BONUS_ITEMS = {
  // ... bonificaciones existentes
  POINTS: {
    symbol: '💯',
    name: 'points',
    probability: 0.03,
    effectValue: 500,
    duration: 0,      // Efecto inmediato
    description: 'Otorga 500 puntos extra'
  },
  // Nuestra nueva bonificación
  MULTIPLIER: {
    symbol: '✖️',
    name: 'multiplier',
    probability: 0.02,
    effectValue: 2,   // Multiplicador x2
    duration: 15000,  // Dura 15 segundos
    description: 'Duplica los puntos durante 15 segundos'
  }
};

// 2. Añadir al conjunto de bonificaciones disponibles
export const AVAILABLE_BONUS_ITEMS = [
  BONUS_ITEMS.POINTS.symbol,
  BONUS_ITEMS.TIME.symbol,
  BONUS_ITEMS.HINT.symbol,
  BONUS_ITEMS.MULTIPLIER.symbol  // Añadir la nueva bonificación
];
```

Ahora, implementamos la lógica para procesar esta bonificación:

```typescript
// En src/store/slices/gameSlice.ts

// Añadir al estado del juego
export interface GameState {
  // ... propiedades existentes
  scoreMultiplier: number;
  activeBonus: { type: string; endTime: number } | null;
}

// En los reducers
const gameSlice = createSlice({
  name: 'game',
  initialState,
  reducers: {
    // ... reducers existentes
    
    activateBonus: (state, action: PayloadAction<{ type: string; duration: number }>) => {
      const { type, duration } = action.payload;
      
      if (type === 'multiplier') {
        state.scoreMultiplier = 2;
        state.activeBonus = { 
          type, 
          endTime: Date.now() + duration 
        };
        
        logger.info('Game', `Bonificación de multiplicador activada por ${duration/1000} segundos`);
      }
      // ... procesar otros tipos de bonificación
    },
    
    checkActiveBonus: (state) => {
      if (state.activeBonus && Date.now() >= state.activeBonus.endTime) {
        // Restablecer el estado cuando expire el bonus
        if (state.activeBonus.type === 'multiplier') {
          state.scoreMultiplier = 1;
          logger.info('Game', 'Bonificación de multiplicador terminada');
        }
        
        state.activeBonus = null;
      }
    },
    
    // ... otros reducers
  }
});
```

En el hook de lógica de juego:

```typescript
// En src/hooks/useGameLogic.ts

// Función para procesar bonificaciones
const processBonusItem = useCallback((bonusType: string, row: number, col: number) => {
  // ... código existente para otras bonificaciones
  
  // Procesar la nueva bonificación de multiplicador
  if (bonusType === '✖️') {
    // Activar el multiplicador por 15 segundos
    const duration = 15000;
    
    // Enviar acción para activar el multiplicador
    dispatch(activateBonus({ type: 'multiplier', duration }));
    
    // Mostrar efecto visual
    showFloatingText(row, col, 'x2 PUNTOS', 'bonus-text');
    
    // Reproducir sonido
    audioManager.play('bonusCollected');
    
    return true;
  }
  
  return false;
}, [dispatch, showFloatingText]);

// Añadir temporizador para verificar bonificaciones activas
useEffect(() => {
  if (status === 'playing') {
    const bonusCheckInterval = setInterval(() => {
      dispatch(checkActiveBonus());
    }, 1000);
    
    return () => clearInterval(bonusCheckInterval);
  }
}, [dispatch, status]);

// Modificar la lógica de puntuación para aplicar el multiplicador
const calculateScore = useCallback((iconCount: number, isCombo: boolean = false) => {
  const { scoreMultiplier } = store.getState().game;
  
  let baseScore = SCORE_VALUES.BASE_CONVERGENCE * iconCount;
  
  if (isCombo) {
    baseScore *= SCORE_VALUES.COMBO_MULTIPLIER;
  }
  
  // Aplicar el multiplicador de bonificación
  baseScore *= scoreMultiplier;
  
  return Math.round(baseScore);
}, []);
```

### 3. Implementación de Power-ups

Los power-ups son habilidades que el jugador puede activar para obtener ventajas temporales. Veamos cómo implementar un nuevo power-up:

```typescript
// 1. Definir el nuevo power-up en utils/config.ts
export const POWER_UPS = {
  // ... power-ups existentes
  SLOWDOWN: {
    name: 'slowdown',
    icon: '⏱️',
    cooldown: 30000,    // 30 segundos de enfriamiento
    duration: 10000,    // 10 segundos de efecto
    description: 'Reduce la velocidad de aparición de iconos'
  },
  // Nuestro nuevo power-up
  FREEZE: {
    name: 'freeze',
    icon: '❄️',
    cooldown: 60000,    // 1 minuto de enfriamiento
    duration: 5000,     // 5 segundos de efecto
    description: 'Congela todos los iconos en el tablero temporalmente'
  }
};

// 2. Añadir al conjunto de power-ups disponibles
export const AVAILABLE_POWER_UPS = [
  POWER_UPS.SLOWDOWN.name,
  POWER_UPS.CLEAR.name,
  POWER_UPS.FREEZE.name   // Añadir el nuevo power-up
];
```

Ahora, implementamos la lógica del power-up:

```typescript
// En src/store/slices/gameSlice.ts

// Añadir al estado del juego
export interface GameState {
  // ... propiedades existentes
  powerUps: {
    [key: string]: {
      available: boolean;
      cooldownEndTime: number;
      activeEndTime: number | null;
    }
  };
  boardFrozen: boolean;
}

// En el initialState
const initialState: GameState = {
  // ... propiedades existentes
  powerUps: {
    slowdown: { available: true, cooldownEndTime: 0, activeEndTime: null },
    clear: { available: true, cooldownEndTime: 0, activeEndTime: null },
    freeze: { available: true, cooldownEndTime: 0, activeEndTime: null }
  },
  boardFrozen: false
};

// En los reducers
const gameSlice = createSlice({
  name: 'game',
  initialState,
  reducers: {
    // ... reducers existentes
    
    activatePowerUp: (state, action: PayloadAction<string>) => {
      const powerUp = action.payload;
      const now = Date.now();
      
      // Verificar si el power-up está disponible
      if (state.powerUps[powerUp]?.available && now >= (state.powerUps[powerUp]?.cooldownEndTime || 0)) {
        // Configurar el power-up como activo
        const powerUpConfig = POWER_UPS[powerUp.toUpperCase() as keyof typeof POWER_UPS];
        
        if (powerUpConfig) {
          // Activar power-up
          state.powerUps[powerUp] = {
            available: false,
            cooldownEndTime: now + powerUpConfig.cooldown,
            activeEndTime: now + powerUpConfig.duration
          };
          
          // Aplicar efecto específico
          if (powerUp === 'freeze') {
            state.boardFrozen = true;
            logger.info('Game', `Power-up Congelar activado por ${powerUpConfig.duration/1000} segundos`);
          }
          // ... otros power-ups
        }
      }
    },
    
    checkPowerUps: (state) => {
      const now = Date.now();
      
      // Verificar todos los power-ups
      Object.keys(state.powerUps).forEach(powerUp => {
        const powerUpState = state.powerUps[powerUp];
        
        // Verificar si el efecto activo debe terminar
        if (powerUpState.activeEndTime && now >= powerUpState.activeEndTime) {
          // Desactivar efecto
          powerUpState.activeEndTime = null;
          
          // Revertir efectos específicos
          if (powerUp === 'freeze') {
            state.boardFrozen = false;
            logger.info('Game', 'Efecto de congelación terminado');
          }
          // ... otros power-ups
        }
        
        // Actualizar disponibilidad según el enfriamiento
        if (!powerUpState.available && now >= powerUpState.cooldownEndTime) {
          powerUpState.available = true;
        }
      });
    }
    
    // ... otros reducers
  }
});
```

En el componente visual:

```tsx
// En src/components/game/PowerUps/PowerUpButton.tsx
import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../../store';
import { activatePowerUp } from '../../../store/slices/gameSlice';
import * as config from '../../../utils/config';
import './PowerUpButton.css';

interface PowerUpButtonProps {
  type: string;
}

const PowerUpButton: React.FC<PowerUpButtonProps> = ({ type }) => {
  const dispatch = useDispatch();
  const { powerUps } = useSelector((state: RootState) => state.game);
  const powerUpState = powerUps[type];
  
  // Obtener configuración del power-up
  const powerUpConfig = config.POWER_UPS[type.toUpperCase() as keyof typeof config.POWER_UPS];
  if (!powerUpConfig) return null;
  
  const isActive = powerUpState.activeEndTime !== null;
  const isAvailable = powerUpState.available;
  
  // Calcular tiempo restante para el enfriamiento
  const now = Date.now();
  const cooldownRemaining = Math.max(0, powerUpState.cooldownEndTime - now);
  const cooldownPercent = 
    (cooldownRemaining / powerUpConfig.cooldown) * 100;
  
  // Manejar clic en el power-up
  const handleClick = () => {
    if (isAvailable) {
      dispatch(activatePowerUp(type));
    }
  };
  
  return (
    <div 
      className={`power-up-button ${isAvailable ? 'available' : 'cooldown'} ${isActive ? 'active' : ''}`}
      onClick={handleClick}
    >
      <div className="power-up-icon">{powerUpConfig.icon}</div>
      <div className="power-up-name">{powerUpConfig.name}</div>
      
      {!isAvailable && (
        <div className="cooldown-overlay" style={{ height: `${cooldownPercent}%` }}></div>
      )}
    </div>
  );
};

export default PowerUpButton;
```

### 4. Implementación de Obstáculos

Los obstáculos añaden dificultad y estrategia al juego. Vamos a implementar un nuevo tipo de obstáculo:

```typescript
// 1. Definir el nuevo obstáculo en utils/config.ts
export const OBSTACLES = {
  // ... obstáculos existentes
  STONE: {
    symbol: '🪨',
    name: 'stone',
    isPassable: false,      // No se puede colocar un icono en esta celda
    isDestructible: false,  // No se puede destruir
    probability: 0.02,
    description: 'Bloquea una celda permanentemente'
  },
  // Nuestro nuevo obstáculo
  QUICKSAND: {
    symbol: '⏳',
    name: 'quicksand',
    isPassable: true,       // Se puede colocar un icono
    isDestructible: true,   // Se puede destruir
    movePenalty: 2,         // Añade 2 iconos al tablero al colocar un icono aquí
    probability: 0.015,
    description: 'Penaliza con iconos adicionales cuando se coloca un icono aquí'
  }
};

// 2. Añadir al conjunto de obstáculos disponibles
export const AVAILABLE_OBSTACLES = [
  OBSTACLES.STONE.symbol,
  OBSTACLES.ICE.symbol,
  OBSTACLES.QUICKSAND.symbol  // Añadir el nuevo obstáculo
];
```

Implementar la lógica para procesar el nuevo obstáculo:

```typescript
// En src/hooks/useBoardInteraction.ts

// Modificar la función handleCellClick para manejar obstáculos
const handleCellClick = useCallback((row: number, col: number) => {
  // ... código existente
  
  // Verificar obstáculos
  const obstacleType = getCellObstacleType(row, col, board);
  
  if (obstacleType) {
    // Obtener configuración del obstáculo
    const obstacleConfig = OBSTACLES[obstacleType.toUpperCase() as keyof typeof OBSTACLES];
    
    // Si no es pasable, cancelar la acción
    if (obstacleConfig && !obstacleConfig.isPassable) {
      // Reproducir sonido de error
      audioManager.play('error');
      return;
    }
    
    // Para arenas movedizas, añadir penalización
    if (obstacleType === 'quicksand') {
      // Colocar el icono normalmente
      placeIconAtPosition(row, col, selectedIcon);
      
      // Aplicar penalización: añadir 2 iconos aleatorios
      setTimeout(() => {
        for (let i = 0; i < 2; i++) {
          const emptyCell = findRandomEmptyCell(board, boardSize);
          if (emptyCell) {
            const { row, col } = emptyCell;
            const randomIcon = availableIcons[Math.floor(Math.random() * availableIcons.length)];
            
            // Añadir icono con animación especial
            const newBoard = [...board];
            newBoard[row][col] = randomIcon;
            dispatch(updateBoard(newBoard));
            
            // Efecto visual
            const cellKey = `${row}-${col}`;
            const cellElement = cellRefs.current[cellKey];
            if (cellElement) {
              cellElement.classList.add('quicksand-penalty');
              setTimeout(() => {
                cellElement.classList.remove('quicksand-penalty');
              }, 1000);
            }
          }
        }
        
        // Mostrar mensaje de penalización
        showFloatingText(row, col, '¡Penalización!', 'penalty-text');
        
        // Reproducir sonido
        audioManager.play('penaltySound');
      }, 300);
      
      return;
    }
  }
  
  // Continuar con el comportamiento normal si no hay obstáculos o son pasables sin efectos
  placeIconAtPosition(row, col, selectedIcon);
  
}, [/* dependencias */]);

// Función auxiliar para obtener el tipo de obstáculo en una celda
const getCellObstacleType = (row: number, col: number, board: (string | null)[][]): string | null => {
  const cell = board[row][col];
  if (!cell) return null;
  
  // Verificar si la celda contiene un obstáculo conocido
  const obstacleSymbols = Object.values(OBSTACLES).map(obs => obs.symbol);
  if (obstacleSymbols.includes(cell)) {
    // Devolver el nombre del obstáculo
    const obstacle = Object.values(OBSTACLES).find(obs => obs.symbol === cell);
    return obstacle ? obstacle.name : null;
  }
  
  return null;
};
```

### Integración de Características Especiales en Niveles

Para añadir estas características a los niveles, modificamos la configuración de niveles:

```typescript
// En utils/levels.ts

// Nivel con todas las características
{
  id: 10,
  boardSize: 10,
  icons: ["🍎", "🍇", "🍊", "🍓", "🍉", "🍌", "🍋", "🍍", "🍑", "🍒"],
  spawnRate: 800,
  speedMultiplier: 2.0,
  penaltyIcons: 5,
  requirements: {
    classic: [
      { type: 'score', value: 10000, description: 'Alcanza 10000 puntos' }
    ],
    // ... otros modos
  },
  rewards: {
    classic: [
      { type: 'points', value: 5000, description: 'Bonus de nivel' }
    ]
  },
  specialFeatures: {
    specialIcons: {
      type: 'specialIcon',
      enabled: true,
      config: {
        probability: 0.10,
        types: ['bomb', 'star', 'rainbow', 'lightning'] // Incluir nuevo icono
      }
    },
    bonusItems: {
      type: 'bonus',
      enabled: true,
      config: {
        probability: 0.05,
        types: ['points', 'time', 'hint', 'multiplier'] // Incluir nueva bonificación
      }
    },
    powerUps: {
      type: 'powerup',
      enabled: true,
      config: {
        probability: 0.04,
        types: ['slowdown', 'clear', 'freeze'] // Incluir nuevo power-up
      }
    },
    obstacles: {
      type: 'obstacle',
      enabled: true,
      config: {
        probability: 0.03,
        types: ['stone', 'ice', 'quicksand'] // Incluir nuevo obstáculo
      }
    }
  }
}
```

Con esta implementación, has añadido un sistema completo de características especiales que enriquecen la experiencia de juego y ofrecen más posibilidades estratégicas a los jugadores.

## Tips para Desarrolladores

### Depuración

El juego incluye un sistema de depuración que puede activarse durante el desarrollo:

```typescript
// Activar controles de desarrollo
setShowDevControls(true);
```

Esto proporcionará controles adicionales para:
- Ajustar el tamaño del tablero
- Modificar la velocidad de aparición de iconos
- Pasar directamente a otros niveles
- Ver información detallada para depuración

### Rendimiento

Para optimizar el rendimiento, considere:

1. Usar `React.memo` y `useCallback` para componentes que se renderizan frecuentemente
2. Limitar los efectos visuales en dispositivos de gama baja
3. Implementar carga diferida para niveles y recursos
4. Utilizar correctamente `useMemo` para cálculos costosos

### Compatibilidad Móvil

El juego está diseñado para funcionar en dispositivos móviles. Al modificarlo, tenga en cuenta:

1. Controles táctiles adecuados
2. Diseño responsivo para diferentes tamaños de pantalla
3. Optimización para rendimiento en dispositivos móviles

### Extensibilidad

La arquitectura está diseñada para facilitar la extensión:

1. Utilice los tipos e interfaces existentes
2. Mantenga la separación de responsabilidades entre componentes
3. Documente los cambios realizados para facilitar futuras modificaciones
4. Añada tests para nuevas funcionalidades

---

¡Diviértete desarrollando y modificando Convergence Online! Si tienes preguntas adicionales o necesitas más información sobre algún aspecto específico, consulta el código fuente o contacta con el equipo de desarrollo.