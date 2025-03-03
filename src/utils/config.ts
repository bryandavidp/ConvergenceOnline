// src/utils/config.ts
// Configuración del juego de Convergencia

// Dimensiones y visuales
export const BOARD_MIN_SIZE = 5;
export const BOARD_MAX_SIZE = 12;
export const DEFAULT_BOARD_SIZE = 8;

// Velocidades de aparición de iconos (en milisegundos)
export const SPAWN_RATES = {
  TUTORIAL: 4000,
  VERY_SLOW: 3000,
  SLOW: 2000,
  MEDIUM: 1500,
  FAST: 1000,
  SUPER_FAST: 750,
  EXTREME: 500
};

// Niveles de dificultad
export const DIFFICULTY_LEVELS: Record<string, any> = {
  EASY: {
    name: 'easy',
    initialSpawnRate: 3000, // 3 segundos
    maxSpeedMultiplier: 1.5,
    speedIncreaseTime: 45000, // 45 segundos
    penaltyIcons: 1
  },
  NORMAL: {
    name: 'normal',
    initialSpawnRate: 2000, // 2 segundos
    maxSpeedMultiplier: 2,
    speedIncreaseTime: 30000, // 30 segundos
    penaltyIcons: 2
  },
  HARD: {
    name: 'hard',
    initialSpawnRate: 1500, // 1.5 segundos
    maxSpeedMultiplier: 3,
    speedIncreaseTime: 20000, // 20 segundos
    penaltyIcons: 3
  },
  TUTORIAL: {
    name: 'tutorial',
    initialSpawnRate: 4000, // 4 segundos
    maxSpeedMultiplier: 1.2,
    speedIncreaseTime: 60000, // 60 segundos
    penaltyIcons: 1
  }
};

// Modos de juego
export const GAME_MODES = {
  CLASSIC: 'classic',
  TIMED: 'timed',
  SURVIVAL: 'survival',
};

// Configuración específica para cada modo de juego
export const GAME_MODE_CONFIG = {
  CLASSIC: {
    name: 'classic',
    initialBoardSize: 5,
    maxBoardSize: 10,
    initialSpawnRate: SPAWN_RATES.SLOW,
    initialScoreTarget: 1000,
    scoreTargetMultiplier: 1.5, // Multiplica el objetivo por nivel
    initialOccupationTarget: 70, // Porcentaje
    occupationDecreasePerLevel: 3, // Disminución del objetivo por nivel
    basePenalty: 1, // Iconos añadidos por error
  },
  TIMED: {
    name: 'timed',
    boardSize: 7, // Fijo
    initialSpawnRate: SPAWN_RATES.MEDIUM,
    initialTimeLimit: 120, // 2 minutos
    timeBonusPerLevel: 30, // Segundos añadidos al pasar de nivel
    comboBonusTime: 5, // Segundos añadidos por combo
    timeDecreasePerLevel: 10, // Segundos menos en cada nivel
  },
  SURVIVAL: {
    name: 'survival',
    boardSize: 10, // Fijo y grande
    initialSpawnRate: SPAWN_RATES.VERY_SLOW,
    speedIncreaseInterval: 30, // Segundos entre aumento de velocidad
    specialIconProbability: 0.1, // 10% de probabilidad de icono especial
    specialIconInterval: 60, // Aparece aproximadamente cada 60 segundos
    maxSpeedMultiplier: 4, // Velocidad máxima x4
  }
};

// Duración base del juego en segundos para modo temporizado
export const BASE_GAME_DURATION = 120; // 2 minutos

// Velocidad inicial de aparición de iconos
export const INITIAL_SPAWN_RATE = SPAWN_RATES.MEDIUM;

// Número de iconos iniciales en el tablero
export const INITIAL_ICONS = 5;

// Número de iconos de penalización al fallar
export const PENALTY_ICONS = 1;

// Animaciones
export const ANIMATION_DURATIONS = {
  CELL_CLICK: 300,
  ICON_SPAWN: 400,
  ICON_REMOVE: 300,
  HINT: 800,
  LEVEL_TRANSITION: 1200,
  newIcon: 500 // Para compatibilidad con código original
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
    // Asegurando que sea cómodo visualmente
    return Math.max(30, Math.min(80, Math.floor(480 / boardSize)));
  }
};

// Límites de nivel
export const LEVEL_LIMITS = {
  MAX_LEVEL: 15,                // Nivel máximo alcanzable
  TUTORIAL_LEVELS: 2,          // Número de niveles de tutorial
  EASY_MAX_LEVEL: 5,            // Nivel máximo para dificultad fácil
  NORMAL_MAX_LEVEL: 10,         // Nivel máximo para dificultad normal
  // Nivel máximo para dificultad difícil es MAX_LEVEL
};

// Iconos disponibles en el juego (frutas y vegetales)
export const AVAILABLE_ICONS = [
  '🍎', '🍊', '🍇', '🍓', '🍐', 
  '🍌', '🍉', '🍑', '🍒', '🍍',
  '🥝', '🥑', '🥕', '🌽', '🍅', 
  '🫐', '🍆', '🥔', '🥦', '🥭'
];

// Conjuntos de iconos por nivel
export const ICON_SETS = [
  ['🍎', '🍊', '🍇', '🍓'],               // Nivel 1 - Frutas básicas
  ['🍐', '🍌', '🍉', '🍑', '🍒'],         // Nivel 2 - Más frutas
  ['🥝', '🥑', '🥕', '🌽', '🍅', '🫐'],   // Nivel 3 - Vegetales y frutas
  ['🍆', '🥔', '🥦', '🥭', '🍍', '🍎'],   // Nivel 4 - Mixto
  // Más conjuntos se pueden añadir para niveles avanzados
];

// Número de iconos a utilizar según el nivel
export const iconCountByLevel = (level: number): number => {
  if (level <= 2) return 4;         // Tutorial y nivel 2
  if (level <= 4) return 5;         // Niveles 3-4
  if (level <= 6) return 6;         // Niveles 5-6
  if (level <= 8) return 7;         // Niveles 7-8
  if (level <= 10) return 8;        // Niveles 9-10
  if (level <= 12) return 9;        // Niveles 11-12
  return 10;                        // Niveles 13+
};

// Calcular tamaño del tablero según el nivel
export const getLevelBoardSize = (level: number): number => {
  if (level <= 3) return 6;         // Tutorial hasta nivel 3
  if (level <= 6) return 7;         // Niveles 4-6
  if (level <= 9) return 8;         // Niveles 7-9
  if (level <= 12) return 9;        // Niveles 10-12
  return 10;                        // Niveles 13+
};

// Calcular velocidad de aparición según el nivel
export const getLevelSpawnRate = (level: number): number => {
  if (level <= 1) return SPAWN_RATES.TUTORIAL;    // Tutorial
  if (level <= 3) return SPAWN_RATES.VERY_SLOW;   // Niveles 2-3
  if (level <= 5) return SPAWN_RATES.SLOW;        // Niveles 4-5
  if (level <= 8) return SPAWN_RATES.MEDIUM;      // Niveles 6-8
  if (level <= 11) return SPAWN_RATES.FAST;       // Niveles 9-11
  if (level <= 13) return SPAWN_RATES.SUPER_FAST; // Niveles 12-13
  return SPAWN_RATES.EXTREME;                     // Niveles 14+
};

// Obtener conjunto de iconos para un nivel específico
export const getIconSetForLevel = (level: number): string[] => {
  // Usar un conjunto predefinido si existe para el nivel
  if (level <= ICON_SETS.length) {
    return ICON_SETS[level - 1];
  }
  
  // Para niveles superiores, seleccionar aleatoriamente de todos los disponibles
  return shuffleArray([...AVAILABLE_ICONS]).slice(0, iconCountByLevel(level));
};

// Función auxiliar para mezclar array (duplicada de gameUtils para evitar dependencia circular)
function shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}