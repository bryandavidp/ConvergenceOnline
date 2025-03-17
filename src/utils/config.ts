// src/utils/config.ts
// Configuración unificada del juego Convergence Online

// ==========================================
// CONFIGURACIÓN DE DIMENSIONES Y TAMAÑOS
// ==========================================
export const BOARD_MIN_SIZE = 8;
export const BOARD_MAX_SIZE = 8; // Limitado a 8 para todos los niveles y modos
export const DEFAULT_BOARD_SIZE = 8;

// Configuración para el tablero
export const BOARD_SIZE = {
  SMALL: 8,
  MEDIUM: 8,
  LARGE: 8
};

// Configuración de tamaños de tablero por nivel (siempre 8x8)
export const BOARD_SIZES = Array(10).fill(8);

// Configuración de velocidades de spawn (en milisegundos)
export const SPAWN_RATES = {
  VERY_SLOW: 5000,  // 5 segundos
  SLOW: 4000,       // 4 segundos
  MEDIUM: 3000,     // 3 segundos
  FAST: 2000,       // 2 segundos
  VERY_FAST: 1000   // 1 segundo
};

// Velocidad mínima permitida (ms)
export const MIN_SPAWN_RATE = 500;  // 0.5 segundos mínimo absoluto

// Velocidad inicial por defecto
export const INITIAL_SPAWN_RATE = 3000;  // 3 segundos por defecto

// ==========================================
// TIPOS Y CONSTANTES GENERALES
// ==========================================
export type GameMode = 'easy' | 'normal' | 'hard' | 'tutorial';
export type GameLevel = number;
export type GameStatus = 'idle' | 'playing' | 'paused' | 'levelCompleted' | 'gameOver' | 'startScreen';

// ==========================================
// INTERFACES DE CONFIGURACIÓN
// ==========================================
// Interfaz para la configuración del tablero
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
  penaltyIcons: number;             // Iconos añadidos como penalización
  maxIconsOnBoard: number;          // Máximo de iconos que pueden estar en el tablero
  initialIconCount: number;         // Cantidad de iconos al inicio del nivel
  maxLevel: number;                 // Nivel máximo para esta dificultad
}

// ==========================================
// CONFIGURACIÓN POR DEFECTO
// ==========================================
// Valores predeterminados para la configuración del tablero
export const DEFAULT_BOARD_CONFIG: BoardConfig = {
  size: DEFAULT_BOARD_SIZE,
  spawnRate: 2000,
  icons: ["🍎", "🍇", "🍊", "🍓"],
  minCellSize: 30,
  maxCellSize: 80,
  cellMargin: 8
};

// ==========================================
// ICONOS Y SETS
// ==========================================
import { IconSystem } from './iconSystem';

// Obtener el sistema de iconos
export const iconSystem = IconSystem.getInstance();

// Función para obtener iconos para un nivel específico
export function getIconsForLevel(level: number, difficulty: GameMode): string[] {
  const icons = iconSystem.getIconsForLevel(level, difficulty, 'classic');
  return icons.map(icon => icon.display);
}

// Función para compatibilidad con código existente
export function getIconSetForLevel(level: number): string[] {
  return getIconsForLevel(level, 'normal');
}

// ==========================================
// CONFIGURACIÓN DE DIFICULTAD Y GAMEPLAY
// ==========================================
// Configuración de dificultad ampliada
export const DIFFICULTY_CONFIG: Record<GameMode, DifficultyConfig> = {
  easy: {
    penaltyIcons: 1,
    maxIconsOnBoard: 48,
    initialIconCount: 20,
    maxLevel: 5
  },
  normal: {
    penaltyIcons: 2,
    maxIconsOnBoard: 60,
    initialIconCount: 45,
    maxLevel: 7
  },
  hard: {
    penaltyIcons: 3,
    maxIconsOnBoard: 60,
    initialIconCount: 45,
    maxLevel: 10
  },
  tutorial: {
    penaltyIcons: 0,
    maxIconsOnBoard: 32,
    initialIconCount: 6,
    maxLevel: 1
  }
};

// Número de iconos iniciales (valor por defecto si no se especifica en el modo de juego)
export const INITIAL_ICONS = 5;  
// Número máximo de niveles
export const MAX_LEVELS = 999999;
// Porcentaje máximo de ocupación del tablero
export const MAX_OCCUPATION_PERCENTAGE = 95; 
// Tiempo mínimo para validar nivel completado
export const MIN_TIME_TO_VALIDATE_LEVEL = 5;
// Duración base del juego en segundos para modo temporizado
export const BASE_GAME_DURATION = 120; // 2 minutos

// Sistema de pistas
export const HINT_SYSTEM = {
  COOLDOWN: 10000,         
  DURATION: 2000,          
  MAX_HINTS_PER_LEVEL: 3,  
};

// Multiplicadores para requisitos de nivel según dificultad
export const LEVEL_REQUIREMENT_MULTIPLIERS = {
  easy: {
    scoreRequirement: 0.7,
    timeRequirement: 0.8
  },
  normal: {
    scoreRequirement: 1.0,
    timeRequirement: 1.0
  },
  hard: {
    scoreRequirement: 1.3,
    timeRequirement: 1.2
  },
  tutorial: {
    scoreRequirement: 0.5,
    timeRequirement: 0.5
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

// Configuración de modos de juego original (versión básica)
export const GAME_MODES = {
  CLASSIC: {
    name: 'classic',
    iconVariety: 5,                           
    baseScoreTarget: 1000                     
  },
  TIMED: {
    name: 'timed',
    iconVariety: 4,                           
    initialTimeLimit: 120,                    
    timeBonusPerLevel: 30                     
  },
  SURVIVAL: {
    name: 'survival',
    iconVariety: 4,                           
    specialIconProbability: 0.1               
  }
};

// Objetivos de nivel por modo de juego
export const LEVEL_REQUIREMENTS = {
  classic: {
    baseScore: 1000,             // Puntuación base para nivel 1
    scoreMultiplier: 1.5,        // Multiplica por nivel
    baseOccupation: 70,          // % ocupación objetivo nivel 1
    occupationDecrease: 5        // Reduce % por nivel
  },
  timed: {
    baseTime: 120,               // Tiempo inicial (segundos)
    timeDecreasePerLevel: 10,    // Reducción de tiempo por nivel
    timeBonusPerConvergence: 5   // Segundos añadidos por convergencia
  },
  survival: {
    baseTime: 60,                // Tiempo mínimo para nivel 1 (segundos)
    timeIncreasePerLevel: 30     // Segundos adicionales por nivel
  },
  zen: {
    // Sin requisitos específicos
  }
};

// Configuración para modos de juego
export const GAME_MODE_CONFIG = {
  CLASSIC: {
    name: 'classic',
    displayName: 'Clásico',
    description: 'Alcanza objetivos de puntuación y ocupación para avanzar de nivel',
    initialIcons: 45,
    initialScoreTarget: 1000,
    scoreTargetMultiplier: 1.5,
    initialOccupationTarget: 70, 
    occupationDecreasePerLevel: 0, 
    basePenalty: 1
  },
  TIMED: {
    name: 'timed',
    displayName: 'Contrarreloj',
    description: 'Consigue la mayor puntuación posible antes de que se acabe el tiempo',
    initialIcons: 25,
    initialTimeLimit: 120,
    timeBonusPerLevel: 30, 
    comboBonusTime: 5, 
    timeDecreasePerLevel: 10
  },
  SURVIVAL: {
    name: 'survival',
    displayName: 'Supervivencia',
    description: 'Sobrevive el mayor tiempo posible sin llenar el tablero',
    initialIcons: 50,
    movesBeforeSpawn: 1,
    specialIconProbability: 0.1, 
    specialIconInterval: 60
  },
  TUTORIAL: {
    name: 'tutorial',
    displayName: 'Tutorial',
    description: 'Aprende a jugar con instrucciones paso a paso',
    initialIcons: 6,
    penaltyIcons: 0,
    maxLevel: 1
  }
};

// ==========================================
// FUNCIONES DE UTILIDAD
// ==========================================
// Obtener tamaño del tablero para un nivel específico
export function getBoardSizeForLevel(level: number): number {
  // Siempre devolver 8x8 para todos los niveles
  return 8;
}

// Obtener el tamaño del tablero para un nivel específico (alias para compatibilidad)
export function getLevelBoardSize(level: number): number {
  return getBoardSizeForLevel(level);
}

// Obtener el número de iconos para un nivel específico
export function iconCountByLevel(level: number): number {
  const baseCount = 4; 
  const increase = Math.floor((level - 1) / 2); 
  
  const iconCount = baseCount + increase;
  
  return Math.min(8, Math.max(3, iconCount));
}

// Obtener configuración de dificultad
export function getDifficultyConfig(mode: GameMode): DifficultyConfig {
  return DIFFICULTY_CONFIG[mode];
}

// Obtener configuración completa basada en dificultad y modo
export function getGameConfig(difficulty: string, mode: string): any {
  const difficultyConfig = DIFFICULTY_CONFIG[difficulty as GameMode] || DIFFICULTY_CONFIG['normal'];
  const modeConfig = GAME_MODE_CONFIG[mode.toUpperCase() as keyof typeof GAME_MODE_CONFIG] || GAME_MODE_CONFIG.CLASSIC;
  
  return {
    ...difficultyConfig,
    ...modeConfig
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

// ==========================================
// CONFIGURACIÓN PARA EL SISTEMA DE COMBOS
// ==========================================
export const COMBO_SYSTEM = {
  // Ventana de tiempo para combos por dificultad (ms)
  TIME_WINDOWS: {
    easy: 5000,
    normal: 3500,
    hard: 2500,
    tutorial: 10000
  },
  
  // Multiplicadores según número de combos
  MULTIPLIERS: [
    { threshold: 3, multiplier: 1.5 },
    { threshold: 6, multiplier: 2.0 },
    { threshold: 10, multiplier: 3.0 },
    { threshold: 15, multiplier: 5.0 },
    { threshold: 20, multiplier: 8.0 },
    { threshold: 30, multiplier: 10.0 }
  ],
  
  // Bonificaciones por alcanzar ciertos hitos de combo
  MILESTONE_BONUSES: {
    10: 500,
    20: 1000,
    30: 2000
  },
  
  // Colores para los diferentes niveles de combo
  COLORS: {
    basic: 'rgba(60, 60, 60, 0.7)',
    uncommon: 'rgba(30, 144, 255, 0.7)',
    rare: 'rgba(138, 43, 226, 0.7)',
    epic: 'rgba(255, 127, 0, 0.7)',
    legendary: 'rgba(255, 215, 0, 0.7)'
  }
};

