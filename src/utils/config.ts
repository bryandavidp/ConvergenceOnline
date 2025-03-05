// src/utils/config.ts
// Configuración unificada del juego Convergence Online

// Dimensiones y visuales
export const BOARD_MIN_SIZE = 5;
export const BOARD_MAX_SIZE = 12;
export const DEFAULT_BOARD_SIZE = 8;

// Tipos para la configuración del juego
export type GameMode = 'easy' | 'normal' | 'hard' | 'tutorial';
export type GameLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
export type GameStatus = 'idle' | 'playing' | 'paused' | 'levelCompleted' | 'gameOver' | 'startScreen';

// Interfaz para la configuración del tablero
export interface BoardSize {
  SMALL: number;
  MEDIUM: number;
  LARGE: number;
}

// Interfaz para las opciones de configuración del tablero
export interface BoardConfig {
  size?: number;
  spawnRate?: number;
  icons?: string[];
  minCellSize?: number;
  maxCellSize?: number;
  cellMargin?: number;
}

// Interfaz para la configuración de dificultad
export interface DifficultyConfig {
  spawnRate: number;                // Velocidad de generación de iconos (ms)
  speedIncreaseInterval: number;    // Intervalo para aumentar la velocidad (segundos)
  speedIncreaseAmount: number;      // Cantidad de reducción en cada aumento (ms)
  minSpawnRate: number;             // Velocidad mínima de spawn (ms)
  penaltyIcons: number;             // Iconos añadidos como penalización
  maxIconsOnBoard: number;          // Máximo de iconos que pueden estar en el tablero
  initialIconCount: number;         // Cantidad de iconos al inicio del nivel
  maxLevel: number;                 // Nivel máximo para esta dificultad
}

// Interfaz para la configuración de modo de juego
export interface GameModeConfig {
  name: string;
  description: string;
  timeLimit?: number;               // Límite de tiempo en segundos (para modo contrarreloj)
  scoreMultiplier: number;          // Multiplicador de puntuación para este modo
  iconDiversity: number;            // Cantidad de tipos diferentes de iconos en el tablero
  specialFeatures: string[];        // Características especiales de este modo
}

// Interfaz para la configuración de puntuación
export interface ScoreConfig {
  basePoints: number;
  levelMultiplier: number;
  clearBonusPoints: number;
  minimumConvergence: number;
  penaltyPoints: number;
}

// Interfaz para la configuración de animaciones
export interface AnimationConfig {
  iconAppear: number;
  iconDisappear: number;
  levelTransition: number;
  hint: number;
}

// Interfaz para dirección de verificación de convergencia
export interface ConvergenceDirection {
  rowStep: number;
  colStep: number;
}

// Valores predeterminados para la configuración del tablero
export const DEFAULT_BOARD_CONFIG: BoardConfig = {
  size: DEFAULT_BOARD_SIZE,
  spawnRate: 2000, // SPAWN_RATES.MEDIUM
  icons: ["🍎", "🍇", "🍊", "🍓"],
  minCellSize: 30,
  maxCellSize: 80,
  cellMargin: 8
};

// Configuración de tablero
export const BOARD_SIZE: BoardSize = {
  SMALL: 6,
  MEDIUM: 7,
  LARGE: 8
};

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

// Iconos por temática (más variedad y dificultad progresiva)
export const ICON_SETS: Record<string, string[]> = {
  // Sets básicos (fáciles de distinguir)
  fruits: ["🍎", "🍇", "🍊", "🍓", "🍉", "🍌", "🍍", "🥝"],
  animals: ["🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼"],
  faces: ["😀", "😎", "🤔", "😍", "😴", "🤯", "😱", "🥳"],
  
  // Sets intermedios
  sports: ["⚽", "🏀", "🏈", "⚾", "🎾", "🏐", "🏉", "🎱"],
  vehicles: ["🚗", "🚕", "🚙", "🚌", "🚎", "🏎️", "🚓", "🚑"],
  weather: ["☀️", "🌤️", "⛅", "🌦️", "☁️", "🌧️", "⛈️", "❄️"],
  
  // Sets avanzados (más difíciles de distinguir rápidamente)
  symbols: ["⭐", "💫", "✨", "🌟", "🔥", "💥", "⚡", "🌈"],
  geometric: ["🔴", "🟠", "🟡", "🟢", "🔵", "🟣", "⚫", "⚪"],
  tools: ["🔨", "🪓", "🔧", "🪚", "🔩", "⚙️", "🗜️", "🪛"],
  
  // Sets muy difíciles (formas y colores similares)
  flowers: ["🌸", "🌹", "🌺", "🌻", "🌼", "🌷", "💐", "🪷"],
  hearts: ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍"],
  music: ["🎵", "🎶", "🎼", "🎤", "🎧", "🎷", "🎸", "🎹"]
};

// Mapeo de conjuntos de iconos por nivel y dificultad
export const LEVEL_ICON_SETS: Record<GameMode, Record<number, string[]>> = {
  easy: {
    1: ["fruits", "animals"],
    2: ["fruits", "faces"],
    3: ["animals", "sports"],
    4: ["vehicles", "sports"],
    5: ["faces", "weather"]
  },
  normal: {
    1: ["fruits", "animals", "faces"],
    2: ["sports", "vehicles", "weather"],
    3: ["symbols", "geometric", "animals"],
    4: ["tools", "vehicles", "symbols"],
    5: ["flowers", "sports", "geometric"],
    6: ["hearts", "tools", "weather"],
    7: ["music", "symbols", "faces"]
  },
  hard: {
    1: ["fruits", "animals", "faces", "sports"],
    2: ["vehicles", "weather", "symbols", "geometric"],
    3: ["tools", "flowers", "hearts", "music"],
    4: ["symbols", "geometric", "hearts", "weather"],
    5: ["flowers", "tools", "music", "vehicles"],
    6: ["hearts", "symbols", "fruits", "tools"],
    7: ["music", "flowers", "geometric", "animals"],
    8: ["vehicles", "hearts", "symbols", "faces"],
    9: ["tools", "music", "weather", "geometric"],
    10: ["flowers", "hearts", "music", "symbols"]
  },
  tutorial: {
    1: ["fruits"]
  }
};

// Velocidades de aparición de iconos (en milisegundos)
export const SPAWN_RATES = {
  TUTORIAL: 4500,     // Muy lento para principiantes
  VERY_SLOW: 3500,    // Muy lento para nivel bajo
  SLOW: 2500,         // Lento para nivel medio-bajo
  MEDIUM: 2000,       // Velocidad equilibrada
  FAST: 1500,         // Rápido para nivel medio-alto
  SUPER_FAST: 1000,   // Muy rápido para nivel alto
  EXTREME: 750        // Extremadamente rápido para expertos
};

// Parámetros de configuración generales
export const INITIAL_ICONS = 5;  // Número de iconos iniciales al comenzar
export const MAX_LEVELS = 5;     // Máximo número de niveles
export const PENALTY_ICONS = 2;  // Número de iconos que aparecen como penalización

// Configuración básica de velocidad
export const INITIAL_SPAWN_RATE = 2500; // Tiempo inicial entre spawns (2.5 segundos)
export const SPEED_INCREASE_TIME = 20000; // Aumentar velocidad cada 20 segundos
export const MAX_SPEED_MULTIPLIER = 2.5; // Velocidad máxima (2.5x la inicial)

// Configuración de modos de juego original (versión básica)
export const GAME_MODES = {
  CLASSIC: {
    name: 'classic',
    initialSpawnRate: SPAWN_RATES.SLOW,       
    speedIncreaseTime: 25000,                 
    maxSpeedMultiplier: 2,                    
    speedIncreaseAmount: 0.1,                 
    iconVariety: 5,                           
    baseScoreTarget: 1000                     
  },
  TIMED: {
    name: 'timed',
    initialSpawnRate: SPAWN_RATES.MEDIUM,     
    speedIncreaseTime: 20000,                 
    maxSpeedMultiplier: 2.2,                  
    speedIncreaseAmount: 0.15,                
    iconVariety: 4,                           
    initialTimeLimit: 120,                    
    timeBonusPerLevel: 30                     
  },
  SURVIVAL: {
    name: 'survival',
    initialSpawnRate: SPAWN_RATES.VERY_SLOW,  
    speedIncreaseTime: 15000,                 
    maxSpeedMultiplier: 3,                    
    speedIncreaseAmount: 0.2,                 
    iconVariety: 6,                           
    specialIconProbability: 0.1               
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
    speedIncreaseTime: 20000, 
    maxSpeedMultiplier: 2,
    penaltyIcons: 1,
    initialIcons: 30,
    maxLevel: 3,
  },
  NORMAL: {
    name: 'normal',
    initialSpawnRate: 3000,
    speedIncreaseTime: 15000, 
    maxSpeedMultiplier: 3,
    penaltyIcons: 3,
    initialIcons: 45,
    maxLevel: 5,
  },
  HARD: {
    name: 'hard',
    initialSpawnRate: 2000,
    speedIncreaseTime: 15000, 
    maxSpeedMultiplier: 4,
    penaltyIcons: 3,
    initialIcons: 6,
    maxLevel: 55,
  },
  TUTORIAL: {
    name: 'tutorial',
    initialSpawnRate: 5000,
    speedIncreaseTime: 60000, 
    maxSpeedMultiplier: 1.5,
    penaltyIcons: 0,
    initialIcons: 20,
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
    scoreTargetMultiplier: 1.5, 
    initialOccupationTarget: 70, 
    occupationDecreasePerLevel: 3, 
    basePenalty: 1, 
    speedIncreaseTime: 20000,
    maxSpeedMultiplier: 3,
  },
  TIMED: {
    name: 'timed',
    boardSize: 7, 
    initialSpawnRate: SPAWN_RATES.MEDIUM,
    initialTimeLimit: 120, 
    timeBonusPerLevel: 30, 
    comboBonusTime: 5, 
    timeDecreasePerLevel: 10, 
    speedIncreaseTime: 15000,
    maxSpeedMultiplier: 2.5,
  },
  SURVIVAL: {
    name: 'survival',
    boardSize: 8, 
    initialSpawnRate: SPAWN_RATES.VERY_SLOW,
    speedIncreaseInterval: 20, 
    specialIconProbability: 0.1, 
    specialIconInterval: 60, 
    maxSpeedMultiplier: 4, 
    speedIncreaseTime: 10000,
  }
};

// Configuración de dificultad ampliada
export const DIFFICULTY_CONFIG: Record<GameMode, DifficultyConfig> = {
  easy: {
    spawnRate: 4000,                
    speedIncreaseInterval: 30,      
    speedIncreaseAmount: 200,       
    minSpawnRate: 2000,             
    penaltyIcons: 1,                
    maxIconsOnBoard: 48,            
    initialIconCount: 10,           
    maxLevel: 5                     
  },
  normal: {
    spawnRate: 3000,                
    speedIncreaseInterval: 20,      
    speedIncreaseAmount: 250,       
    minSpawnRate: 1500,             
    penaltyIcons: 2,                
    maxIconsOnBoard: 56,            
    initialIconCount: 12,           
    maxLevel: 7                     
  },
  hard: {
    spawnRate: 2000,                
    speedIncreaseInterval: 15,      
    speedIncreaseAmount: 300,       
    minSpawnRate: 1000,             
    penaltyIcons: 3,                
    maxIconsOnBoard: 60,            
    initialIconCount: 16,           
    maxLevel: 10                    
  },
  tutorial: {
    spawnRate: 5000,                
    speedIncreaseInterval: 60,      
    speedIncreaseAmount: 100,       
    minSpawnRate: 3000,             
    penaltyIcons: 0,                
    maxIconsOnBoard: 32,            
    initialIconCount: 6,            
    maxLevel: 1                     
  }
};

// Puntuación
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

// Configuración de puntuación ampliada
export const SCORE_CONFIG: ScoreConfig = {
  basePoints: 10,
  levelMultiplier: 1.5,
  clearBonusPoints: 500, 
  minimumConvergence: 3, 
  penaltyPoints: 5 
};

// Sistema de pistas
export const HINT_SYSTEM = {
  COOLDOWN: 10000,         
  DURATION: 2000,          
  MAX_HINTS_PER_LEVEL: 3,  
};

// Configuración de CSS
export const CSS_VARIABLES = {
  cellSizeFormula: (boardSize: number): number => {
    return Math.max(35, 60 - (boardSize - 8) * 5);
  }
};

// Configuración de animaciones
export const ANIMATION_DURATIONS = {
  newIcon: 400,           
  removeIcon: 300,        
  pointsDisplay: 1000,    
  hint: 3000,             
  levelTransition: 1000,  
  speedAlert: 2500,       
  penaltyAlert: 2000,     
  CELL_CLICK: 300,        
  ICON_SPAWN: 400,        
  ICON_REMOVE: 300,       
  HINT: 800,              
  LEVEL_TRANSITION: 1200  
};

// Configuración de animaciones (formato alternativo)
export const ANIMATION_CONFIG: AnimationConfig = {
  iconAppear: 300,
  iconDisappear: 300,
  levelTransition: 1000,
  hint: 800
};

// Iconos disponibles en el juego
export const AVAILABLE_ICONS = [
  '🍎', '🍊', '🍇', '🍓', '🍐', 
  '🍌', '🍉', '🍑', '🍒', '🍍',
  '🥝', '🥑', '🥕', '🌽', '🍅', 
  '🫐', '🍆', '🥔', '🥦', '🥭',
  '🐶', '🐱', '🐭', '🐹',
  '⭐', '💫', '🔥', '🌈', '🌪️',
  '⚽', '🏀', '🏉', '🎱', '🏓',
  '🚗', '🏎️', '🚓', '🚑', '✈️'
];

// Configuración de modos de juego ampliada
export const GAME_MODES_EXTENDED: Record<string, GameModeConfig> = {
  normal: {
    name: "Normal",
    description: "Juego clásico con dificultad progresiva. Los iconos aparecen a un ritmo constante que aumenta con el tiempo.",
    scoreMultiplier: 1.0,
    iconDiversity: 1,
    specialFeatures: ["Penalizaciones por errores", "Aumento de velocidad con el tiempo"]
  },
  timed: {
    name: "Contrarreloj",
    description: "¡Tienes 3 minutos para avanzar tanto como puedas! La velocidad aumenta más rápido, pero cada convergencia exitosa añade tiempo.",
    timeLimit: 180, 
    scoreMultiplier: 1.5,
    iconDiversity: 1.2,
    specialFeatures: ["Límite de tiempo", "+5 segundos por cada convergencia", "Multiplicador de puntuación x1.5"]
  },
  zen: {
    name: "Zen",
    description: "Modo relajado sin presión de tiempo. La velocidad aumenta muy lentamente y las penalizaciones son menores. Perfecto para principiantes.",
    scoreMultiplier: 0.8,
    iconDiversity: 0.8,
    specialFeatures: ["Sin límite de tiempo", "Penalizaciones reducidas", "Velocidad más lenta"]
  },
  chaos: {
    name: "Caos",
    description: "¡Desafío extremo! Mayor variedad de iconos, velocidad muy rápida y sin ayudas. Para expertos del juego.",
    scoreMultiplier: 2.0,
    iconDiversity: 1.5,
    specialFeatures: ["Velocidad extrema", "Mayor diversidad de iconos", "Multiplicador de puntuación x2"]
  }
};

// Direcciones para verificar convergencias
export const CONVERGENCE_DIRECTIONS: ConvergenceDirection[] = [
  { rowStep: 0, colStep: -1 }, { rowStep: 0, colStep: 1 },
  { rowStep: -1, colStep: 0 }, { rowStep: 1, colStep: 0 },
  { rowStep: -1, colStep: -1 }, { rowStep: 1, colStep: 1 },
  { rowStep: -1, colStep: 1 }, { rowStep: 1, colStep: -1 }
];

// Duración base del juego en segundos para modo temporizado
export const BASE_GAME_DURATION = 120; // 2 minutos

// Cambiar el tamaño del tablero
export function changeBoardSize(size: number): number {
  const safeSize = Math.max(
    BOARD_MIN_SIZE, 
    Math.min(BOARD_MAX_SIZE, size)
  );
  
  return safeSize;
}

// Cambia la velocidad de aparición de iconos
export function changeSpawnRate(newSpawnRate: number): number {
  const minRate = 200; 
  const maxRate = 5000; 
  
  return Math.max(minRate, Math.min(maxRate, newSpawnRate));
}

// Obtener conjunto de iconos para un nivel específico
export function getIconSetForLevel(level: number): string[] {
  const adjustedLevel = level - 1;
  
  if (adjustedLevel >= 0 && adjustedLevel < LEVEL_ICONS.length) {
    return LEVEL_ICONS[adjustedLevel];
  }
  
  return ["🍎", "🍇", "🍊", "🍓"];
}

// Obtener tamaño del tablero para un nivel específico
export function getBoardSizeForLevel(level: number): number {
  const adjustedLevel = level - 1;
  
  if (adjustedLevel >= 0 && adjustedLevel < BOARD_SIZES.length) {
    return BOARD_SIZES[adjustedLevel];
  }
  
  return DEFAULT_BOARD_SIZE;
}

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
  const baseCount = 4; 
  const increase = Math.floor((level - 1) / 2); 
  
  const iconCount = baseCount + increase;
  
  return Math.min(8, Math.max(3, iconCount));
}

// Obtener tamaño de tablero para un nivel (versión alternativa)
export function getBoardSizeForLevelV2(level: number): number {
  return level > 5 ? BOARD_SIZE.LARGE : (level > 3 ? BOARD_SIZE.MEDIUM : BOARD_SIZE.SMALL);
}

// Obtener iconos para un nivel y dificultad
export function getIconsForLevel(level: number, difficulty: GameMode): string[] {
  try {
    const safeLevel = Math.min(Math.max(level, 1), DIFFICULTY_CONFIG[difficulty].maxLevel);
    
    const difficultyLevels = LEVEL_ICON_SETS[difficulty];
    
    if (!difficultyLevels) {
      console.warn(`No se encontró configuración de iconos para la dificultad ${difficulty}, usando 'normal'`);
      return getIconsForLevel(level, 'normal');
    }
    
    const maxLevelForDifficulty = Object.keys(difficultyLevels).length;
    const normalizedLevel = safeLevel > maxLevelForDifficulty 
      ? (safeLevel % maxLevelForDifficulty) || maxLevelForDifficulty
      : safeLevel;
    
    const iconCategories = difficultyLevels[normalizedLevel];
    
    if (!iconCategories || !Array.isArray(iconCategories) || iconCategories.length === 0) {
      console.warn(`No se encontraron categorías para el nivel ${normalizedLevel} en dificultad ${difficulty}, usando nivel 1`);
      return getIconsForLevel(1, difficulty);
    }
    
    let allIcons: string[] = [];
    
    iconCategories.forEach((category: string) => {
      if (ICON_SETS[category]) {
        allIcons = [...allIcons, ...ICON_SETS[category]];
      } else {
        console.warn(`Categoría de iconos no encontrada: ${category}`);
      }
    });
    
    if (allIcons.length === 0) {
      console.warn('No se encontraron iconos, usando conjunto predeterminado');
      return ["🍎", "🍇", "🍊", "🍓", "🍉", "🍌", "🍍", "🥝", "🐶", "🐱", "🐭", "🐹"];
    }
    
    if (allIcons.length < 8) {
      allIcons = [...allIcons, ...allIcons.slice(0, 8 - allIcons.length)];
    }
    
    return shuffleArray([...allIcons]);
  } catch (error) {
    console.error('Error al obtener iconos para el nivel', error);
    return ["😀", "😎", "🤔", "😍", "😴", "🤯", "😱", "🥳"];
  }
}

// Obtener configuración completa basada en dificultad y modo
export function getGameConfig(difficulty: string, mode: string): any {
  const normalizedDifficulty = difficulty.toUpperCase();
  const normalizedMode = mode.toUpperCase();
  
  const difficultyConfig = DIFFICULTY_LEVELS[normalizedDifficulty as keyof typeof DIFFICULTY_LEVELS] || DIFFICULTY_LEVELS.NORMAL;
  
  const modeConfig = GAME_MODE_CONFIG[normalizedMode as keyof typeof GAME_MODE_CONFIG] || GAME_MODE_CONFIG.CLASSIC;
  
  const difficultyMultiplier = 
    SCORE_VALUES.DIFFICULTY_MULTIPLIERS[difficultyConfig.name as keyof typeof SCORE_VALUES.DIFFICULTY_MULTIPLIERS] || 1;
  const modeMultiplier = 
    SCORE_VALUES.MODE_MULTIPLIERS[modeConfig.name as keyof typeof SCORE_VALUES.MODE_MULTIPLIERS] || 1;
  
  return {
    ...difficultyConfig,
    ...modeConfig,
    scoreMultiplier: difficultyMultiplier * modeMultiplier
  };
}

// Obtener la configuración para un modo de juego específico
export function getGameModeConfig(mode: string): any {
  const normalizedMode = mode.toUpperCase();
  
  const modeConfig = GAME_MODES[normalizedMode as keyof typeof GAME_MODES];
  
  if (!modeConfig) {
    console.warn(`Modo de juego '${mode}' no encontrado, usando modo clásico`);
    return GAME_MODES.CLASSIC;
  }
  
  return modeConfig;
}

// Obtener configuración de dificultad
export function getDifficultyConfig(mode: GameMode): DifficultyConfig {
  return DIFFICULTY_CONFIG[mode];
}

// Calcular la velocidad de aparición de iconos según el nivel y modo de juego
export function calculateSpawnRate(level: number, gameMode: string, currentSpawnRate?: number): number {
  const modeConfig = getGameModeConfig(gameMode);
  
  if (currentSpawnRate) {
    const reductionFactor = 0.9; 
    
    const newSpawnRate = currentSpawnRate * reductionFactor;
    
    const minSpawnRate = modeConfig.initialSpawnRate / modeConfig.maxSpeedMultiplier;
    
    return Math.max(minSpawnRate, newSpawnRate);
  }
  
  const levelReduction = (level - 1) * 0.1; 
  const maxReduction = 0.6; 
  
  const reduction = Math.min(maxReduction, levelReduction);
  
  const baseSpawnRate = modeConfig.initialSpawnRate * (1 - reduction);
  
  const minSpawnRate = modeConfig.initialSpawnRate / modeConfig.maxSpeedMultiplier;
  return Math.max(minSpawnRate, baseSpawnRate);
}

// Funcion para calcular puntuación
export function calculateScore(convergedIcons: number, level: number, modeMultiplier: number = 1.0): number {
  const baseScore = convergedIcons * 10 * level;
  
  let comboMultiplier = 1.0;
  if (convergedIcons >= 4) comboMultiplier = 1.5;
  if (convergedIcons >= 6) comboMultiplier = 2.0;
  if (convergedIcons >= 8) comboMultiplier = 3.0;
  
  const finalScore = Math.floor(baseScore * comboMultiplier * modeMultiplier);
  
  console.debug('Calculador de puntuación', {
    iconos: convergedIcons,
    nivel: level,
    puntuaciónBase: baseScore,
    multiplicadorCombo: comboMultiplier,
    multiplicadorModo: modeMultiplier,
    puntuaciónFinal: finalScore
  });
  
  return finalScore;
}

// Función auxiliar para mezclar un array
export function shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}