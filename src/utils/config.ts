// src/utils/config.ts
// Configuración del juego de Convergencia

// Dimensiones y visuales
export const BOARD_MIN_SIZE = 6;
export const BOARD_MAX_SIZE = 10;
export const DEFAULT_BOARD_SIZE = 6;

// Niveles de dificultad
export const DIFFICULTY_LEVELS = {
  EASY: 'easy',
  NORMAL: 'normal',
  HARD: 'hard',
  TUTORIAL: 'tutorial'
};

// Modos de juego
export const GAME_MODES = {
  NORMAL: 'normal',
  TIMED: 'timed',
  ZEN: 'zen',
};

// Duración base del juego en segundos para modo temporizado
export const BASE_GAME_DURATION = 180; // 3 minutos

// Velocidades de aparición de iconos (en segundos)
export const SPAWN_RATES = {
  TUTORIAL: 3.5,
  VERY_SLOW: 3.0,
  SLOW: 2.5,
  MEDIUM: 1.5,
  FAST: 0.8,
  SUPER_FAST: 0.5,
  EXTREME: 0.3
};

// Velocidad inicial de aparición de iconos
export const INITIAL_SPAWN_RATE = SPAWN_RATES.MEDIUM;

// Animaciones
export const ANIMATION_DURATIONS = {
  CELL_CLICK: 300,
  ICON_SPAWN: 400,
  ICON_REMOVE: 300,
  HINT: 800,
};

// Puntuación
export const SCORE_VALUES = {
  BASE_CONVERGENCE: 10,  // Puntos base por convergencia
  LEVEL_MULTIPLIER: 2,   // Multiplicador por nivel
  COMBO_MULTIPLIER: 1.5, // Multiplicador por combo
  TIME_BONUS: 5,         // Puntos extra por segundo restante
  DIFFICULTY_MULTIPLIERS: {
    easy: 0.8,
    normal: 1.0,
    hard: 1.5,
    tutorial: 0.5
  }
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