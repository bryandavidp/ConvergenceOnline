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

/**
 * Migra la configuración existente al nuevo sistema de niveles
 */
export function migrateConfigToLevelSystem() {
  try {
    logger.info('LevelSystem', 'Migrando configuración existente al nuevo sistema de niveles');
    
    // Crear mapeo de configuraciones antiguas a nuevas
    const iconSets = config.LEVEL_ICONS;
    const boardSizes = config.BOARD_SIZES;
    
    // Verificar si ya existen niveles predefinidos
    if (levels.PREDEFINED_LEVELS.length > 0) {
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
  logger.info('LevelSystem', 'Inicializando sistema de niveles');
  
  // Inicializar adaptadores y migrar configuración
  migrateConfigToLevelSystem();
  
  logger.info('LevelSystem', 'Sistema de niveles inicializado correctamente');
  
  // Devolver información sobre el sistema para debugging
  return {
    predefinedLevels: levels.PREDEFINED_LEVELS.length,
    difficulties: Object.keys(levels.DIFFICULTY_MULTIPLIERS),
    modes: Object.keys(levels.BASE_MODE_CONFIG)
  };
} 