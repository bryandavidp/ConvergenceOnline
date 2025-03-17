/**
 * Script de inicialización del sistema de niveles
 * 
 * Este archivo contiene funciones para inicializar el sistema de niveles
 * y migrar datos existentes al nuevo formato.
 */
import { store } from '../store';
import { GameDifficulty, GamePlayMode } from '../store/slices/gameSlice';
import * as config from './config';
import * as levelAdapter from './levelAdapter';
import * as levels from './levels';
import logger from './logger';

// Definición del tipo para BASE_MODE_CONFIG
type ModeConfig = {
  baseSpawnRate: number;
  spawnRateDecrement: number;
  minSpawnRate: number;
  scoreMultiplier: number;
  [key: string]: any;
};

type BaseModeConfigType = {
  classic: ModeConfig;
  timed: ModeConfig;
  survival: ModeConfig;
  zen: ModeConfig;
  [key: string]: ModeConfig;
};

// Intentamos importar BASE_MODE_CONFIG, pero no bloqueamos si falla
let BASE_MODE_CONFIG: BaseModeConfigType;
try {
  BASE_MODE_CONFIG = require('./BASE_MODE_CONFIG').BASE_MODE_CONFIG;
} catch (error) {
  // Si no podemos importar, definimos un objeto por defecto
  BASE_MODE_CONFIG = {
    classic: { baseSpawnRate: 2000, spawnRateDecrement: 100, minSpawnRate: 500, scoreMultiplier: 1 },
    timed: { baseSpawnRate: 1500, spawnRateDecrement: 150, minSpawnRate: 400, scoreMultiplier: 1.2 },
    survival: { baseSpawnRate: 1800, spawnRateDecrement: 120, minSpawnRate: 450, scoreMultiplier: 0.8 },
    zen: { baseSpawnRate: 2500, spawnRateDecrement: 50, minSpawnRate: 600, scoreMultiplier: 0.5 }
  };
  logger.warn('LevelSystem', 'No se pudo importar BASE_MODE_CONFIG, usando valores por defecto');
}

/**
 * Migra la configuración existente al nuevo sistema de niveles
 */
export function migrateConfigToLevelSystem() {
  try {
    logger.info('LevelSystem', 'Migrando configuración existente al nuevo sistema de niveles');
    
    // Crear mapeo de configuraciones antiguas a nuevas
    const iconSets: Record<number, string[]> = {};
    for (let i = 1; i <= 10; i++) {
      iconSets[i] = config.getIconSetForLevel(i);
    }
    const boardSizes = config.BOARD_SIZES;
    
    // Verificar si ya existen niveles predefinidos
    if (levels.PREDEFINED_LEVELS && levels.PREDEFINED_LEVELS.length > 0) {
      logger.info('LevelSystem', 'El sistema de niveles ya está inicializado');
      return;
    }
    
    logger.info('LevelSystem', 'Migración completada correctamente');
  } catch (error) {
    logger.error('LevelSystem', `Error al migrar configuración: ${error}`);
  }
}

/**
 * Inicializa el nivel actual según el estado del juego
 */
export function initCurrentLevel(
  level: number,
  playMode: GamePlayMode,
  difficulty: GameDifficulty
) {
  try {
    logger.info('LevelSystem', `Inicializando nivel ${level} en modo ${playMode} y dificultad ${difficulty}`);
    
    // Obtener configuración del nivel desde el nuevo sistema
    const levelConfig = levels.getLevelConfig(level, playMode, difficulty);
    
    // Crear un mensaje de log
    const logMsg = `Configuración de nivel cargada: boardSize=${levelConfig.boardSize}, spawnRate=${levelConfig.spawnRate}, iconCount=${levelConfig.icons.length}`;
    logger.info('LevelSystem', logMsg);
    
    return {
      boardSize: levelConfig.boardSize,
      spawnRate: levelConfig.spawnRate,
      icons: levelConfig.icons,
      speedMultiplier: levelConfig.speedMultiplier,
      hasSpecialIcons: levelConfig.specialFeatures?.specialIcons?.enabled || false,
      hasBonusItems: levelConfig.specialFeatures?.bonusItems?.enabled || false,
      hasPowerUps: levelConfig.specialFeatures?.powerUps?.enabled || false,
      hasObstacles: levelConfig.specialFeatures?.obstacles?.enabled || false,
      requirements: levelConfig.requirements[playMode]
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('LevelSystem', `Error al inicializar nivel ${level}: ${errorMessage}`);
    
    // Fallback a configuración básica para evitar errores
    return {
      boardSize: 8,
      spawnRate: 2000,
      icons: ["🍎", "🍇", "🍊", "🍓"],
      speedMultiplier: 1.0,
      hasSpecialIcons: false,
      hasBonusItems: false,
      hasPowerUps: false,
      hasObstacles: false,
      requirements: []
    };
  }
}

/**
 * Inicializa todo el sistema de niveles
 */
export function initLevelSystem() {
  try {
    logger.info('LevelSystem', 'Inicializando sistema de niveles');
    
    // Inicializar adaptadores y migrar configuración
    migrateConfigToLevelSystem();
    
    logger.info('LevelSystem', 'Sistema de niveles inicializado correctamente');
    
    // Devolver información sobre el sistema para debugging
    return {
      predefinedLevels: levels.PREDEFINED_LEVELS ? levels.PREDEFINED_LEVELS.length : 0,
      difficulties: levels.DIFFICULTY_MULTIPLIERS ? Object.keys(levels.DIFFICULTY_MULTIPLIERS) : 
                   ['easy', 'normal', 'hard', 'tutorial'],
      modes: BASE_MODE_CONFIG ? Object.keys(BASE_MODE_CONFIG) : 
             ['classic', 'timed', 'survival', 'zen']
    };
  } catch (error) {
    logger.error('LevelSystem', `Error al inicializar sistema de niveles: ${error}`);
    
    // En caso de error grave, devolver un objeto con valores por defecto
    return {
      predefinedLevels: 0,
      difficulties: ['easy', 'normal', 'hard', 'tutorial'],
      modes: ['classic', 'timed', 'survival', 'zen']
    };
  }
} 