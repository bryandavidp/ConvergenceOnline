// src/config/gameConfig.ts
// Configuración del juego Convergence Online

// Tipos para mejorar la seguridad y el autocompletado
export type GameMode = 'easy' | 'normal' | 'hard' | 'tutorial';
export type GameLevel = 1 | 2 | 3 | 4 | 5;

// Interfaz para la configuración del tablero
export interface BoardSize {
  SMALL: number;
  MEDIUM: number;
  LARGE: number;
}

// Interfaz para la configuración de dificultad
export interface DifficultyConfig {
  spawnRate: number;
  speedIncreaseInterval: number;
  penaltyIcons: number;
  maxLevel: number;
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

// Iconos por nivel (temáticos)
export const LEVEL_ICONS: Record<GameLevel, string[]> = {
  1: ["🍎", "🍇", "🍊", "🍓"],                      // Frutas
  2: ["🐶", "🐱", "🐭", "🐹"],                      // Animales
  3: ["⭐", "💫", "🔥", "🌈", "🌪️"],                // Símbolos
  4: ["⚽", "🏀", "🏉", "🎱", "🏓"],                 // Deportes
  5: ["🚗", "🏎️", "🚓", "🚑", "✈️"]                 // Vehículos
};

// Tamaño de tablero por nivel
export const LEVEL_BOARD_SIZE: Record<GameLevel, number> = {
  1: BOARD_SIZE.SMALL,
  2: BOARD_SIZE.SMALL,
  3: BOARD_SIZE.MEDIUM,
  4: BOARD_SIZE.MEDIUM,
  5: BOARD_SIZE.LARGE
};

// Configuración de dificultad por modo
export const DIFFICULTY_CONFIG: Record<GameMode, DifficultyConfig> = {
  easy: {
    spawnRate: 4000, // segundos
    speedIncreaseInterval: 30, // segundos
    penaltyIcons: 1,
    maxLevel: 3
  },
  normal: {
    spawnRate: 3000,
    speedIncreaseInterval: 20,
    penaltyIcons: 2,
    maxLevel: 4
  },
  hard: {
    spawnRate: 2000,
    speedIncreaseInterval: 15,
    penaltyIcons: 3,
    maxLevel: 5
  },
  tutorial: {
    spawnRate: 5000,
    speedIncreaseInterval: 0, // Sin aumento de velocidad
    penaltyIcons: 0, // Sin penalización
    maxLevel: 1
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

// Funcion para obtener iconos para un nivel
export function getIconsForLevel(level: number): string[] {
  const safeLevel = Math.min(Math.max(level, 1), 5) as GameLevel;
  return LEVEL_ICONS[safeLevel];
}

// Función para obtener tamaño de tablero para un nivel
export function getBoardSizeForLevel(level: number): number {
  const safeLevel = Math.min(Math.max(level, 1), 5) as GameLevel;
  return LEVEL_BOARD_SIZE[safeLevel];
}

// Función para obtener configuración de dificultad
export function getDifficultyConfig(mode: GameMode): DifficultyConfig {
  return DIFFICULTY_CONFIG[mode];
}

// Función para calcular puntuación basada en el nivel y número de iconos
export function calculateScore(iconCount: number, level: number): number {
  const basePoints = SCORE_CONFIG.basePoints * iconCount;
  const levelMultiplier = 1 + ((level - 1) * 0.1); // 10% más por nivel
  return Math.floor(basePoints * levelMultiplier);
} 