// src/utils/config.ts
// Configuración del juego de Convergencia

// Dimensiones y visuales
export const BOARD_MIN_SIZE = 5;
export const BOARD_MAX_SIZE = 12;
export const DEFAULT_BOARD_SIZE = 8;

// Configuración de tamaños de tablero por nivel
export const BOARD_SIZES = [
  8, // Nivel 1: 8x8
  8, // Nivel 2: 8x8
  8, // Nivel 3: 8x8
  8, // Nivel 4: 8x8
  9, // Nivel 5: 9x9
];

// Conjuntos de iconos por nivel
export const LEVEL_ICONS = [
  // Nivel 1: Frutas
  ["🍎", "🍇", "🍊", "🍓"],
  // Nivel 2: Animales
  ["🐶", "🐱", "🐭", "🐹"],
  // Nivel 3: Símbolos
  ["⭐", "💫", "🔥", "🌈", "🌪️"],
  // Nivel 4: Deportes
  ["⚽", "🏀", "🏉", "🎱", "🏓"],
  // Nivel 5: Vehículos
  ["🚗", "🏎️", "🚓", "🚑", "✈️"],
];

// Velocidades de aparición de iconos (en milisegundos)
export const SPAWN_RATES = {
  TUTORIAL: 4500,     // Muy lento para principiantes
  VERY_SLOW: 3500,    // Muy lento para nivel bajo
  SLOW: 2500,         // Lento para nivel medio-bajo
  MEDIUM: 2000,       // Velocidad equilibrada (corregido de 1000)
  FAST: 1500,         // Rápido para nivel medio-alto
  SUPER_FAST: 1000,   // Muy rápido para nivel alto
  EXTREME: 750        // Extremadamente rápido para expertos
};

// Parámetros de configuración generales
export const INITIAL_ICONS = 5;  // Número de iconos iniciales al comenzar
export const MAX_LEVELS = 5;     // Máximo número de niveles
export const PENALTY_ICONS = 2;  // Número de iconos que aparecen como penalización (reducido de 3)

// Configuración básica de velocidad
export const INITIAL_SPAWN_RATE = 2500; // Tiempo inicial entre spawns (2.5 segundos, más jugable)
export const SPEED_INCREASE_TIME = 20000; // Aumentar velocidad cada 20 segundos (aumentado de 15s)
export const MAX_SPEED_MULTIPLIER = 2.5; // Velocidad máxima (2.5x la inicial, más razonable)

// Configuración de modos de juego
export const GAME_MODES = {
  CLASSIC: {
    name: 'classic',
    initialSpawnRate: SPAWN_RATES.SLOW,       // 2500ms, más jugable
    speedIncreaseTime: 25000,                 // Incremento más gradual: 25 segundos
    maxSpeedMultiplier: 2,                    // Velocidad máxima reducida a 2x
    speedIncreaseAmount: 0.1,                 // Incremento del 10% cada vez
    iconVariety: 5,                           // Cantidad de iconos diferentes
    baseScoreTarget: 1000                     // Puntuación objetivo base
  },
  TIMED: {
    name: 'timed',
    initialSpawnRate: SPAWN_RATES.MEDIUM,     // 2000ms, moderado
    speedIncreaseTime: 20000,                 // Incremento cada 20 segundos
    maxSpeedMultiplier: 2.2,                  // Velocidad máxima moderada
    speedIncreaseAmount: 0.15,                // Incremento del 15% cada vez
    iconVariety: 4,                           // Cantidad de iconos diferentes
    initialTimeLimit: 120,                    // 2 minutos
    timeBonusPerLevel: 30                     // Segundos añadidos al pasar nivel
  },
  SURVIVAL: {
    name: 'survival',
    initialSpawnRate: SPAWN_RATES.VERY_SLOW,  // 3500ms, inicio muy lento
    speedIncreaseTime: 15000,                 // Incremento más rápido: 15 segundos
    maxSpeedMultiplier: 3,                    // Velocidad máxima mayor: 3x
    speedIncreaseAmount: 0.2,                 // Incremento del 20% cada vez (más agresivo)
    iconVariety: 6,                           // Más variedad de iconos
    specialIconProbability: 0.1               // 10% de probabilidad de icono especial
  }
};

// Equivalencias para compatibilidad
export const classic = GAME_MODES.CLASSIC;
export const timed = GAME_MODES.TIMED;
export const survival = GAME_MODES.SURVIVAL;
export const normal = GAME_MODES.CLASSIC; // Alias para compatibilidad

// Configuración por dificultad
export const DIFFICULTY_LEVELS = {
  EASY: {
    name: 'easy',
    initialSpawnRate: 3000,
    speedIncreaseTime: 20000, // 30 segundos
    maxSpeedMultiplier: 2,
    penaltyIcons: 1,
    initialIcons: 4,
    maxLevel: 3,
  },
  NORMAL: {
    name: 'normal',
    initialSpawnRate: 3000,
    speedIncreaseTime: 15000, // 20 segundos
    maxSpeedMultiplier: 3,
    penaltyIcons: 3,
    initialIcons: 5,
    maxLevel: 5,
  },
  HARD: {
    name: 'hard',
    initialSpawnRate: 2000,
    speedIncreaseTime: 15000, // 15 segundos
    maxSpeedMultiplier: 4,
    penaltyIcons: 3,
    initialIcons: 6,
    maxLevel: 5,
  },
  TUTORIAL: {
    name: 'tutorial',
    initialSpawnRate: 5000,
    speedIncreaseTime: 60000, // 60 segundos
    maxSpeedMultiplier: 1.5,
    penaltyIcons: 0,
    initialIcons: 3,
    maxLevel: 1,
  },
};

// Configuración específica para cada modo de juego
export const GAME_MODE_CONFIG = {
  CLASSIC: {
    name: 'classic',
    initialBoardSize: 8,
    maxBoardSize: 8,
    initialSpawnRate: SPAWN_RATES.MEDIUM,
    initialScoreTarget: 1000,
    scoreTargetMultiplier: 1.5, // Multiplica el objetivo por nivel
    initialOccupationTarget: 70, // Porcentaje
    occupationDecreasePerLevel: 3, // Disminución del objetivo por nivel
    basePenalty: 1, // Iconos añadidos por error
    // Compatibilidad con GAME_MODES
    speedIncreaseTime: 20000,
    maxSpeedMultiplier: 3,
  },
  TIMED: {
    name: 'timed',
    boardSize: 7, // Fijo
    initialSpawnRate: SPAWN_RATES.MEDIUM,
    initialTimeLimit: 120, // 2 minutos
    timeBonusPerLevel: 30, // Segundos añadidos al pasar de nivel
    comboBonusTime: 5, // Segundos añadidos por combo
    timeDecreasePerLevel: 10, // Segundos menos en cada nivel
    // Compatibilidad con GAME_MODES
    speedIncreaseTime: 15000,
    maxSpeedMultiplier: 2.5,
  },
  SURVIVAL: {
    name: 'survival',
    boardSize: 10, // Fijo y grande
    initialSpawnRate: SPAWN_RATES.VERY_SLOW,
    speedIncreaseInterval: 30, // Segundos entre aumento de velocidad
    specialIconProbability: 0.1, // 10% de probabilidad de icono especial
    specialIconInterval: 60, // Aparece aproximadamente cada 60 segundos
    maxSpeedMultiplier: 4, // Velocidad máxima x4
    // Compatibilidad con GAME_MODES
    speedIncreaseTime: 10000,
  }
};

// Puntuación
export const SCORE_VALUES = {
  BASE_CONVERGENCE: 10,    // Puntos base por convergencia (por icono)
  LEVEL_MULTIPLIER: 2,     // Multiplicador por nivel
  COMBO_MULTIPLIER: 1.5,   // Multiplicador por combo
  TIME_BONUS: 5,           // Puntos extra por segundo restante
  EMPTY_BOARD_BONUS: 500,  // Bonificación por vaciar tablero
  SPECIAL_ICON_BONUS: 100, // Bonificación por eliminar icono especial
  DIFFICULTY_MULTIPLIERS: {
    easy: 0.8,
    normal: 1.0,
    hard: 1.5,
    tutorial: 0.5
  },
  // Multiplicadores por modo de juego
  MODE_MULTIPLIERS: {
    classic: 1.0,
    timed: 1.2,
    survival: 1.5
  }
};

// Sistema de pistas
export const HINT_SYSTEM = {
  COOLDOWN: 10000,         // Tiempo de espera entre pistas (10 segundos)
  DURATION: 2000,          // Duración de la visualización de la pista
  MAX_HINTS_PER_LEVEL: 3,  // Número máximo de pistas por nivel
};

// Configuración de CSS
export const CSS_VARIABLES = {
  cellSizeFormula: (boardSize: number): number => {
    // Calcula el tamaño de celda en función del tamaño del tablero
    return Math.max(35, 60 - (boardSize - 8) * 5);
  }
};

// Configuración de animaciones
export const ANIMATION_DURATIONS = {
  newIcon: 400,           // Aparición de nuevo icono
  removeIcon: 300,        // Eliminación de icono
  pointsDisplay: 1000,    // Mostrar puntos ganados
  hint: 3000,             // Duración de pista
  levelTransition: 1000,  // Transición entre niveles
  speedAlert: 2500,       // Alerta de cambio de velocidad
  penaltyAlert: 2000,     // Alerta de penalización
  CELL_CLICK: 300,        // Para compatibilidad con código original
  ICON_SPAWN: 400,        // Para compatibilidad con código original
  ICON_REMOVE: 300,       // Para compatibilidad con código original
  HINT: 800,              // Para compatibilidad con código original
  LEVEL_TRANSITION: 1200  // Para compatibilidad con código original
};

// Iconos disponibles en el juego (mantener para compatibilidad)
export const AVAILABLE_ICONS = [
  '🍎', '🍊', '🍇', '🍓', '🍐', 
  '🍌', '🍉', '🍑', '🍒', '🍍',
  '🥝', '🥑', '🥕', '🌽', '🍅', 
  '🫐', '🍆', '🥔', '🥦', '🥭',
  // Añadir los nuevos iconos
  '🐶', '🐱', '🐭', '🐹',
  '⭐', '💫', '🔥', '🌈', '🌪️',
  '⚽', '🏀', '🏉', '🎱', '🏓',
  '🚗', '🏎️', '🚓', '🚑', '✈️'
];

// Obtener conjunto de iconos para un nivel específico
export function getIconSetForLevel(level: number): string[] {
  // Ajustar el nivel para indexación base 0
  const adjustedLevel = level - 1;
  
  // Si tenemos un conjunto específico para este nivel
  if (adjustedLevel >= 0 && adjustedLevel < LEVEL_ICONS.length) {
    return LEVEL_ICONS[adjustedLevel];
  }
  
  // Fallback a conjunto básico si no hay definición específica
  return ["🍎", "🍇", "🍊", "🍓"];
}

// Obtener tamaño del tablero para un nivel específico
export function getBoardSizeForLevel(level: number): number {
  // Ajustar el nivel para indexación base 0
  const adjustedLevel = level - 1;
  
  // Si tenemos un tamaño específico para este nivel
  if (adjustedLevel >= 0 && adjustedLevel < BOARD_SIZES.length) {
    return BOARD_SIZES[adjustedLevel];
  }
  
  // Valor por defecto
  return DEFAULT_BOARD_SIZE;
}

// Obtener configuración completa basada en dificultad y modo
export function getGameConfig(difficulty: string, mode: string): any {
  // Normalizar entradas
  const normalizedDifficulty = difficulty.toUpperCase();
  const normalizedMode = mode.toUpperCase();
  
  // Obtener configuración base de dificultad
  const difficultyConfig = DIFFICULTY_LEVELS[normalizedDifficulty as keyof typeof DIFFICULTY_LEVELS] || DIFFICULTY_LEVELS.NORMAL;
  
  // Obtener configuración base de modo
  const modeConfig = GAME_MODE_CONFIG[normalizedMode as keyof typeof GAME_MODE_CONFIG] || GAME_MODE_CONFIG.CLASSIC;
  
  // Multiplicadores de puntuación basados en dificultad y modo
  const difficultyMultiplier = 
    SCORE_VALUES.DIFFICULTY_MULTIPLIERS[difficultyConfig.name as keyof typeof SCORE_VALUES.DIFFICULTY_MULTIPLIERS] || 1;
  const modeMultiplier = 
    SCORE_VALUES.MODE_MULTIPLIERS[modeConfig.name as keyof typeof SCORE_VALUES.MODE_MULTIPLIERS] || 1;
  
  // Combinar configuraciones
  return {
    ...difficultyConfig,
    ...modeConfig,
    scoreMultiplier: difficultyMultiplier * modeMultiplier
  };
}

// Función auxiliar para mezclar array (para compatibilidad)
export function shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

// Duración base del juego en segundos para modo temporizado
export const BASE_GAME_DURATION = 120; // 2 minutos

// Obtener el tamaño del tablero para un nivel específico (alias para compatibilidad)
export function getLevelBoardSize(level: number): number {
  return getBoardSizeForLevel(level);
}

// Obtener la velocidad de spawn para un nivel específico
export function getLevelSpawnRate(level: number, gameMode: string = 'CLASSIC'): number {
  return calculateSpawnRate(level, gameMode);
}

// Obtener el número de iconos diferentes para un nivel específico
export function iconCountByLevel(level: number): number {
  // A medida que aumenta el nivel, aumenta la variedad de iconos
  const baseCount = 4; // Número base de iconos
  const increase = Math.floor((level - 1) / 2); // Aumentar cada 2 niveles
  
  // El número de iconos aumenta con los niveles
  const iconCount = baseCount + increase;
  
  // Limitar a un rango razonable
  return Math.min(8, Math.max(3, iconCount));
}

// Obtener la configuración para un modo de juego específico
export function getGameModeConfig(mode: string): any {
  // Normalizar el nombre del modo (convertir a mayúsculas)
  const normalizedMode = mode.toUpperCase();
  
  // Intentar obtener del objeto GAME_MODES
  const modeConfig = GAME_MODES[normalizedMode as keyof typeof GAME_MODES];
  
  // Si no existe, usar el modo clásico como fallback
  if (!modeConfig) {
    console.warn(`Modo de juego '${mode}' no encontrado, usando modo clásico`);
    return GAME_MODES.CLASSIC;
  }
  
  return modeConfig;
}

// Calcular la velocidad de aparición de iconos según el nivel y modo de juego
export function calculateSpawnRate(level: number, gameMode: string, currentSpawnRate?: number): number {
  // Obtener configuración del modo de juego
  const modeConfig = getGameModeConfig(gameMode);
  
  // Si estamos actualizando una velocidad existente (aumento gradual)
  if (currentSpawnRate) {
    // Reducir el tiempo (aumentar velocidad)
    const reductionFactor = 0.9; // Reducción del 10%
    
    // Calcular nueva velocidad
    const newSpawnRate = currentSpawnRate * reductionFactor;
    
    // Calcular el límite mínimo basado en el multiplicador máximo
    const minSpawnRate = modeConfig.initialSpawnRate / modeConfig.maxSpeedMultiplier;
    
    // No permitir que baje del límite mínimo
    return Math.max(minSpawnRate, newSpawnRate);
  }
  
  // Si estamos calculando la velocidad inicial para un nivel
  // A mayor nivel, menor tiempo entre spawns (más rápido)
  const levelReduction = (level - 1) * 0.1; // 10% de reducción por nivel
  const maxReduction = 0.6; // Máximo 60% de reducción
  
  // Aplicar la reducción, pero no exceder el máximo
  const reduction = Math.min(maxReduction, levelReduction);
  
  // Calcular velocidad base para el nivel
  const baseSpawnRate = modeConfig.initialSpawnRate * (1 - reduction);
  
  // Asegurar que no baje del mínimo permitido
  const minSpawnRate = modeConfig.initialSpawnRate / modeConfig.maxSpeedMultiplier;
  return Math.max(minSpawnRate, baseSpawnRate);
}