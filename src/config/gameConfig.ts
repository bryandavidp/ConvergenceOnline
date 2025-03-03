// src/config/gameConfig.ts
// Configuración del juego Convergence Online

import logger from '../utils/logger';

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

// Configuración de tablero
export const BOARD_SIZE: BoardSize = {
  SMALL: 6,
  MEDIUM: 8,
  LARGE: 10
};

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

// Configuración de dificultad por modo
export const DIFFICULTY_CONFIG: Record<GameMode, DifficultyConfig> = {
  easy: {
    spawnRate: 4000,                // 4 segundos
    speedIncreaseInterval: 30,      // Cada 30 segundos
    speedIncreaseAmount: 200,       // Reducir 200ms
    minSpawnRate: 2000,             // No baja de 2 segundos
    penaltyIcons: 1,                // Añade 1 icono por error
    maxIconsOnBoard: 48,            // 75% del tablero 8x8
    initialIconCount: 10,           // Inicia con 10 iconos
    maxLevel: 5                     // Llega hasta nivel 5
  },
  normal: {
    spawnRate: 3000,                // 3 segundos
    speedIncreaseInterval: 20,      // Cada 20 segundos
    speedIncreaseAmount: 250,       // Reducir 250ms
    minSpawnRate: 1500,             // No baja de 1.5 segundos
    penaltyIcons: 2,                // Añade 2 iconos por error
    maxIconsOnBoard: 56,            // 87.5% del tablero 8x8
    initialIconCount: 12,           // Inicia con 12 iconos
    maxLevel: 7                     // Llega hasta nivel 7
  },
  hard: {
    spawnRate: 2000,                // 2 segundos
    speedIncreaseInterval: 15,      // Cada 15 segundos
    speedIncreaseAmount: 300,       // Reducir 300ms
    minSpawnRate: 1000,             // No baja de 1 segundo
    penaltyIcons: 3,                // Añade 3 iconos por error
    maxIconsOnBoard: 60,            // 93.75% del tablero 8x8
    initialIconCount: 16,           // Inicia con 16 iconos
    maxLevel: 10                    // Llega hasta nivel 10
  },
  tutorial: {
    spawnRate: 5000,                // 5 segundos
    speedIncreaseInterval: 60,      // Muy lento
    speedIncreaseAmount: 100,       // Reducir 100ms
    minSpawnRate: 3000,             // No baja de 3 segundos
    penaltyIcons: 0,                // Sin penalización
    maxIconsOnBoard: 32,            // 50% del tablero 8x8
    initialIconCount: 6,            // Inicia con pocos iconos
    maxLevel: 1                     // Solo un nivel
  }
};

// Configuración de puntuación
export const SCORE_CONFIG: ScoreConfig = {
  basePoints: 10,
  levelMultiplier: 1.5,
  clearBonusPoints: 500, // Bonus por limpiar todo el tablero
  minimumConvergence: 3, // Mínimo de iconos para una convergencia
  penaltyPoints: 5 // Puntos que se pierden por movimiento inválido
};

// Configuración de animaciones (en ms)
export const ANIMATION_CONFIG: AnimationConfig = {
  iconAppear: 300,
  iconDisappear: 300,
  levelTransition: 1000,
  hint: 800
};

// Velocidades de spawn precalculadas
export const SPAWN_RATES = {
  TUTORIAL: 5.0,
  VERY_SLOW: 4.0,
  SLOW: 3.0,
  MEDIUM: 2.0,
  FAST: 1.0,
  SUPER_FAST: 0.5
};

// Direcciones para verificar convergencias
export const CONVERGENCE_DIRECTIONS: ConvergenceDirection[] = [
  // Horizontal (izquierda y derecha)
  { rowStep: 0, colStep: -1 }, { rowStep: 0, colStep: 1 },
  // Vertical (arriba y abajo)
  { rowStep: -1, colStep: 0 }, { rowStep: 1, colStep: 0 },
  // Diagonal descendente (arriba-izquierda y abajo-derecha)
  { rowStep: -1, colStep: -1 }, { rowStep: 1, colStep: 1 },
  // Diagonal ascendente (arriba-derecha y abajo-izquierda)
  { rowStep: -1, colStep: 1 }, { rowStep: 1, colStep: -1 }
];

// Configuración de modos de juego
export const GAME_MODES: Record<string, GameModeConfig> = {
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
    timeLimit: 180, // 3 minutos
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

// Función para calcular puntuación
export function calculateScore(convergedIcons: number, level: number, modeMultiplier: number = 1.0): number {
  // Fórmula base: iconos * 10 * nivel
  const baseScore = convergedIcons * 10 * level;
  
  // Bonificación por combos
  let comboMultiplier = 1.0;
  if (convergedIcons >= 4) comboMultiplier = 1.5;
  if (convergedIcons >= 6) comboMultiplier = 2.0;
  if (convergedIcons >= 8) comboMultiplier = 3.0;
  
  // Puntuación final considerando modo de juego
  const finalScore = Math.floor(baseScore * comboMultiplier * modeMultiplier);
  
  logger.debug('Calculador de puntuación', {
    iconos: convergedIcons,
    nivel: level,
    puntuaciónBase: baseScore,
    multiplicadorCombo: comboMultiplier,
    multiplicadorModo: modeMultiplier,
    puntuaciónFinal: finalScore
  } as unknown as string);
  
  return finalScore;
}

// Funcion para obtener iconos para un nivel y dificultad
export function getIconsForLevel(level: number, difficulty: GameMode): string[] {
  try {
    // Asegurar que el nivel esté dentro de los límites
    const safeLevel = Math.min(Math.max(level, 1), DIFFICULTY_CONFIG[difficulty].maxLevel);
    
    // Obtener el conjunto de niveles para esta dificultad
    const difficultyLevels = LEVEL_ICON_SETS[difficulty];
    
    // Si no hay configuración para esta dificultad, usar la normal
    if (!difficultyLevels) {
      logger.warn('Config', `No se encontró configuración de iconos para la dificultad ${difficulty}, usando 'normal'`);
      return getIconsForLevel(level, 'normal');
    }
    
    // Normalizar el nivel para la dificultad si excede el máximo
    const maxLevelForDifficulty = Object.keys(difficultyLevels).length;
    const normalizedLevel = safeLevel > maxLevelForDifficulty 
      ? (safeLevel % maxLevelForDifficulty) || maxLevelForDifficulty
      : safeLevel;
    
    // Obtener las categorías de iconos para este nivel y dificultad
    const iconCategories = difficultyLevels[normalizedLevel];
    
    // Si no hay categorías definidas para este nivel, usar el nivel 1
    if (!iconCategories || !Array.isArray(iconCategories) || iconCategories.length === 0) {
      logger.warn('Config', `No se encontraron categorías para el nivel ${normalizedLevel} en dificultad ${difficulty}, usando nivel 1`);
      return getIconsForLevel(1, difficulty);
    }
    
    // Crear un conjunto con todos los iconos de las categorías seleccionadas
    let allIcons: string[] = [];
    
    iconCategories.forEach((category: string) => {
      if (ICON_SETS[category]) {
        allIcons = [...allIcons, ...ICON_SETS[category]];
      } else {
        logger.warn('Config', `Categoría de iconos no encontrada: ${category}`);
      }
    });
    
    // Si no se encontraron iconos, usar un conjunto predeterminado
    if (allIcons.length === 0) {
      logger.warn('Config', 'No se encontraron iconos, usando conjunto predeterminado');
      return ["🍎", "🍇", "🍊", "🍓", "🍉", "🍌", "🍍", "🥝", "🐶", "🐱", "🐭", "🐹"];
    }
    
    // Si hay pocos iconos, repetir algunos para asegurar variedad
    if (allIcons.length < 8) {
      allIcons = [...allIcons, ...allIcons.slice(0, 8 - allIcons.length)];
    }
    
    // Mezclar los iconos para mayor variedad
    return shuffleArray([...allIcons]);
  } catch (error) {
    logger.error('Config', 'Error al obtener iconos para el nivel', error);
    // Devolver un conjunto básico de iconos en caso de error
    return ["😀", "😎", "🤔", "😍", "😴", "🤯", "😱", "🥳"];
  }
}

// Función para obtener tamaño de tablero para un nivel
export function getBoardSizeForLevel(level: number): number {
  return level > 5 ? BOARD_SIZE.LARGE : (level > 3 ? BOARD_SIZE.MEDIUM : BOARD_SIZE.SMALL);
}

// Función para obtener configuración de dificultad
export function getDifficultyConfig(mode: GameMode): DifficultyConfig {
  return DIFFICULTY_CONFIG[mode];
}

// Función auxiliar para mezclar un array
function shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
} 