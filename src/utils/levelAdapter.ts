import { GameDifficulty, GamePlayMode } from '../store/slices/gameSlice';
import * as levels from './levels';
import * as config from './config';
import logger from './logger';
import { store } from '../store';
import { setGameEndReason } from '../store/slices/gameSlice';

// Tipo de seguridad para acceder a las propiedades de los niveles
type ModeKey = keyof typeof levels.PREDEFINED_LEVELS[0]['requirements'];

/**
 * Verifica si se ha completado un nivel
 */
export function isLevelCompleted(
  level: number,
  playMode: GamePlayMode,
  score: number,
  iconCount: number,
  boardSize: number,
  timeRemaining?: number,
  survivalTime?: number,
  gameTimer?: number,
  hasMovesAvailable?: boolean
): boolean {
  // Para el modo zen, nunca se completa automáticamente
  if (playMode === 'zen') {
    return false;
  }
  
  // Si no hay tablero o está vacío, evitar errores
  if (!boardSize || boardSize <= 0) {
    return false;
  }
  
  try {
    // Obtener la configuración del nivel actual
    const levelConfig = levels.getLevelConfig(level, playMode, 'normal');
    if (!levelConfig || !levelConfig.requirements) {
      return false;
    }
    
    // Para evitar completado prematuro, verificar que haya pasado al menos el tiempo mínimo
    const minTimeToValidate = config.MIN_TIME_TO_VALIDATE_LEVEL;
    const hasMinimumPlayTime = gameTimer !== undefined && gameTimer >= minTimeToValidate;
    
    // Calcular el porcentaje de ocupación del tablero
    const totalCells = boardSize * boardSize;
    const occupationPercentage = (iconCount / totalCells) * 100;
    
    // NUEVA LÓGICA: Si no hay movimientos válidos y hay pocos iconos, completar nivel
    if (hasMovesAvailable === false) {
      logger.info('LevelAdapter', `No hay movimientos válidos. Ocupación: ${occupationPercentage.toFixed(1)}%, Iconos: ${iconCount}`);
      
      // Si hay 2 o menos iconos, completar nivel
      if (iconCount <= 2) {
        logger.info('LevelAdapter', `Solo quedan ${iconCount} iconos sin movimientos válidos. Nivel completado.`);
        store.dispatch(setGameEndReason(`¡Casi has limpiado el tablero! Solo quedan ${iconCount} iconos sin posibilidad de movimientos.`));
        return true;
      }
      
      // Si hay pocos iconos (menos del 30% del tablero ocupado), completar nivel
      if (occupationPercentage <= 30) {
        logger.info('LevelAdapter', `Pocos iconos sin movimientos (${occupationPercentage.toFixed(1)}%). Nivel completado.`);
        store.dispatch(setGameEndReason(`¡Has despejado gran parte del tablero! Solo queda un ${occupationPercentage.toFixed(1)}% de ocupación sin movimientos disponibles.`));
        return true;
      }
      
      // Si no se cumplen las condiciones anteriores, seguir jugando
      // hasta que el tablero esté completamente lleno (Game Over) o se cumpla otro criterio
      logger.info('LevelAdapter', `No hay movimientos pero los iconos son muchos (${occupationPercentage.toFixed(1)}%). Continuando juego.`);
    }
    
    // En modo clásico, se pueden cumplir varios criterios
    if (playMode === 'classic') {
      // Verificar requisitos disponibles
      const classicRequirements = levelConfig.requirements.classic;
      if (!classicRequirements || !Array.isArray(classicRequirements)) {
        return false;
      }
      
      // Verificar puntuación (este criterio siempre es válido)
      const scoreReq = classicRequirements.find(req => req.type === 'score');
      if (scoreReq && score >= scoreReq.value) {
        logger.info('LevelAdapter', `Nivel completado por puntuación: ${score}/${scoreReq.value}`);
        const spawnRateSeconds = (store.getState().game.spawnRate / 1000).toFixed(1);
        store.dispatch(setGameEndReason(`¡Has alcanzado la puntuación objetivo de ${scoreReq.value} puntos! Velocidad de aparición: ${spawnRateSeconds}s por icono.`));
        return true;
      }
      
      // Criterio por ocupación: solo válido después de tiempo mínimo de juego
      if (hasMinimumPlayTime) {
        const occupationReq = classicRequirements.find(req => req.type === 'occupation');
        if (occupationReq && occupationPercentage <= occupationReq.value) {
          logger.info('LevelAdapter', `Nivel completado por ocupación: ${occupationPercentage.toFixed(1)}%/${occupationReq.value}%`);
          const spawnRateSeconds = (store.getState().game.spawnRate / 1000).toFixed(1);
          store.dispatch(setGameEndReason(`¡Has despejado el tablero por debajo del ${occupationReq.value}% de ocupación requerido! Ocupación actual: ${occupationPercentage.toFixed(1)}%. Velocidad de aparición: ${spawnRateSeconds}s por icono.`));
          return true;
        }
      }
    } 
    // En modo contrarreloj, completado si se acaba el tiempo
    else if (playMode === 'timed') {
      if (timeRemaining !== undefined && timeRemaining <= 0) {
        store.dispatch(setGameEndReason(`¡Se ha agotado el tiempo! Has conseguido ${score} puntos en el tiempo límite.`));
        return true;
      }
    } 
    // En modo supervivencia, no hay completado automático excepto casos específicos
    else if (playMode === 'survival') {
      logger.info('LevelAdapter', `Verificación de nivel en modo supervivencia. Nivel: ${level}, Iconos: ${iconCount}, ¿Sin movimientos?: ${!hasMovesAvailable}`);
      
      // CORREGIR: En modo supervivencia nunca debe completarse automáticamente excepto si no hay iconos en el tablero o no hay movimientos
      if (iconCount <= 0) {
        logger.info('LevelAdapter', `Tablero completamente vacío en modo supervivencia. Nivel completado.`);
        const spawnRateSeconds = (store.getState().game.spawnRate / 1000).toFixed(1);
        store.dispatch(setGameEndReason(`¡Increíble! Has limpiado completamente el tablero eliminando todos los iconos. Velocidad de aparición: ${spawnRateSeconds}s por icono.`));
        return true;
      }
      
      // Si no hay más movimientos y muy pocos iconos (1-2), considerar completado
      if (!hasMovesAvailable && iconCount <= 2) {
        logger.info('LevelAdapter', `No hay movimientos y quedan muy pocos iconos (${iconCount}). Nivel supervivencia completado.`);
        const spawnRateSeconds = (store.getState().game.spawnRate / 1000).toFixed(1);
        store.dispatch(setGameEndReason(`¡Excelente estrategia! Quedan solo ${iconCount} iconos sin posibilidad de movimientos. Velocidad de aparición: ${spawnRateSeconds}s por icono.`));
        return true;
      }
      
      // Para cualquier otro caso, no completar nivel
      return false;
    }
    
    return false;
  } catch (error) {
    logger.error('LevelAdapter', 'Error verificando completado de nivel:', error);
    return false;
  }
}

/**
 * Proporciona los objetivos de un nivel específico
 */
export function getLevelObjectives(
  level: number, 
  playMode: GamePlayMode, 
  difficulty: GameDifficulty
): string[] {
  try {
    const levelConfig = levels.getLevelConfig(level, playMode, difficulty);
    
    if (levelConfig && levelConfig.requirements) {
      const reqs = levelConfig.requirements[playMode as keyof typeof levelConfig.requirements];
      
      if (reqs && Array.isArray(reqs)) {
        return reqs.map(req => req.description);
      }
    }
    
    // Si no hay requisitos válidos
    return [];
  } catch (error) {
    logger.error('LevelAdapter', `Error al obtener objetivos de nivel: ${error}`);
    return [];
  }
}

/**
 * Obtiene información para mostrar del siguiente nivel
 */
export function getNextLevelDisplay(
  currentLevel: number,
  playMode: GamePlayMode,
  difficulty: GameDifficulty
): {
  level: number;
  boardSize: number;
  icons: string[];
  objectives: string[];
  rewards: string[];
  specialFeatures: string[];
} {
  const nextLevel = currentLevel + 1;
  
  try {
    const nextLevelConfig = levels.getLevelConfig(nextLevel, playMode, difficulty);
    
    // Extraer objetivos y recompensas
    const objectives: string[] = [];
    
    // Manejar objetivos de nivel
    if (nextLevelConfig && nextLevelConfig.requirements) {
      const requirementsForMode = nextLevelConfig.requirements[playMode as keyof typeof nextLevelConfig.requirements];
      if (requirementsForMode && Array.isArray(requirementsForMode)) {
        requirementsForMode.forEach(req => {
          if (req && typeof req.description === 'string') {
            objectives.push(req.description);
          }
        });
      }
    }
    
    // Las recompensas pueden no estar definidas para todos los modos
    const rewards: string[] = [];
    
    // Verificar si existen recompensas para este modo
    if (nextLevelConfig && nextLevelConfig.rewards) {
      const modeRewards = nextLevelConfig.rewards[playMode as keyof typeof nextLevelConfig.rewards];
      if (modeRewards && Array.isArray(modeRewards)) {
        modeRewards.forEach(rew => {
          if (rew && typeof rew.description === 'string') {
            rewards.push(rew.description);
          }
        });
      }
    }
    
    // Características especiales
    const specialFeatures: string[] = [];
    
    if (nextLevelConfig && nextLevelConfig.specialFeatures) {
      if (nextLevelConfig.specialFeatures.specialIcons?.enabled) {
        specialFeatures.push('Iconos especiales');
      }
      if (nextLevelConfig.specialFeatures.bonusItems?.enabled) {
        specialFeatures.push('Items bonus');
      }
      if (nextLevelConfig.specialFeatures.powerUps?.enabled) {
        specialFeatures.push('Power-ups');
      }
      if (nextLevelConfig.specialFeatures.obstacles?.enabled) {
        specialFeatures.push('Obstáculos');
      }
    }
    
    return {
      level: nextLevel,
      boardSize: nextLevelConfig ? nextLevelConfig.boardSize : config.BOARD_SIZE.SMALL,
      icons: nextLevelConfig ? nextLevelConfig.icons : config.DEFAULT_BOARD_CONFIG.icons || ["🍎", "🍇", "🍊", "🍓"],
      objectives,
      rewards,
      specialFeatures
    };
  } catch (error) {
    console.error("Error al obtener información del siguiente nivel:", error);
    // Devolver valores por defecto
    return {
      level: nextLevel,
      boardSize: config.BOARD_SIZE.SMALL,
      icons: config.DEFAULT_BOARD_CONFIG.icons || ["🍎", "🍇", "🍊", "🍓"],
      objectives: [],
      rewards: [],
      specialFeatures: []
    };
  }
}

/**
 * Obtiene las recompensas por completar un nivel
 */
export function getLevelRewards(
  level: number,
  playMode: GamePlayMode,
  difficulty: GameDifficulty
): {
  points: number;
  hints: number;
  powerups: number;
} {
  try {
    const levelConfig = levels.getLevelConfig(level, playMode, difficulty);
    
    // Valores predeterminados
    let points = 0;
    let hints = 0;
    let powerups = 0;
    
    // Extraer recompensas si existen para este modo
    if (levelConfig && levelConfig.rewards) {
      const modeRewards = levelConfig.rewards[playMode as keyof typeof levelConfig.rewards];
      if (modeRewards && Array.isArray(modeRewards)) {
        modeRewards.forEach(reward => {
          if (reward && typeof reward === 'object') {
            if (reward.type === 'points') {
              points += reward.value;
            } else if (reward.type === 'hint') {
              hints += reward.value;
            } else if (reward.type === 'powerup') {
              powerups += reward.value;
            }
          }
        });
      }
    }
    
    return { points, hints, powerups };
  } catch (error) {
    console.error("Error al obtener recompensas de nivel:", error);
    return { points: 0, hints: 0, powerups: 0 };
  }
}

/**
 * Obtener el tamaño del tablero para un nivel
 */
export function getBoardSizeForLevel(level: number): number {
  // Usar directamente la configuración central
  return config.getBoardSizeForLevel(level);
}

/**
 * Obtener iconos para un nivel
 */
export function getIconSetForLevel(level: number): string[] {
  // Usar directamente la configuración central
  return config.getIconSetForLevel(level);
}

/**
 * Obtener velocidad de spawn
 */
export function getLevelSpawnRate(level: number, gameMode: string = 'classic', difficulty: string = 'normal'): number {
  // Usar directamente la configuración central
  return config.getLevelSpawnRate(level, gameMode);
}

/**
 * Calcula la cantidad de iconos diferentes para un nivel
 */
export function iconCountByLevel(level: number): number {
  // Usar directamente la configuración central
  return config.iconCountByLevel(level);
}

/**
 * Determina si un nivel tiene características especiales habilitadas
 */
export function hasLevelSpecialFeatures(level: number, featureType: string): boolean {
  return levels.hasSpecialFeature(level, featureType);
}

/**
 * Obtiene la configuración completa de un nivel
 */
export function getLevelConfig(
  level: number,
  playMode: GamePlayMode,
  difficulty: GameDifficulty
): any {
  try {
    // Intentamos obtener la configuración del nivel desde el módulo de niveles
    const levelConfig = levels.getLevelConfig(level, playMode, difficulty);
    
    // Aplicar configuraciones del archivo config.ts a la configuración del nivel
    if (levelConfig) {
      // Aplicar multiplicadores de dificultad
      const difficultyMod = config.LEVEL_REQUIREMENT_MULTIPLIERS[difficulty];
      
      // Si hay multiplicadores definidos, ajustar la velocidad de spawn
      if (difficultyMod) {
        levelConfig.spawnRate = Math.round(levelConfig.spawnRate * difficultyMod.spawnRate);
      }
      
      // Asegurar que todas las configuraciones tomen en cuenta los límites globales
      levelConfig.spawnRate = Math.max(config.MIN_SPAWN_RATE, levelConfig.spawnRate);
      
      // Para los niveles superiores a la configuración predefinida, usar lógica de config.ts
      if (level > config.MAX_LEVELS) {
        levelConfig.boardSize = config.getBoardSizeForLevelV2(level);
        levelConfig.icons = config.getIconsForLevel(level, difficulty);
      }
    }
    
    return levelConfig;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('LevelAdapter', `Error al obtener configuración de nivel: ${errorMessage}`);
    
    // Usar valores por defecto desde config.ts
    return {
      id: level,
      boardSize: config.BOARD_SIZE.MEDIUM,
      icons: config.DEFAULT_BOARD_CONFIG.icons || ["🍎", "🍇", "🍊", "🍓"],
      spawnRate: config.SPAWN_RATES.MEDIUM,
      speedMultiplier: 1.0,
      penaltyIcons: Math.min(3, Math.max(1, level)),
      requirements: {
        classic: [{ 
          type: 'score', 
          value: config.LEVEL_REQUIREMENTS.classic.baseScore * Math.pow(config.LEVEL_REQUIREMENTS.classic.scoreMultiplier, level-1), 
          description: `Alcanza ${config.LEVEL_REQUIREMENTS.classic.baseScore * Math.pow(config.LEVEL_REQUIREMENTS.classic.scoreMultiplier, level-1)} puntos` 
        }],
        timed: [{ 
          type: 'time', 
          value: config.LEVEL_REQUIREMENTS.timed.baseTime - (level-1) * config.LEVEL_REQUIREMENTS.timed.timeDecreasePerLevel, 
          description: `Sobrevive ${config.LEVEL_REQUIREMENTS.timed.baseTime - (level-1) * config.LEVEL_REQUIREMENTS.timed.timeDecreasePerLevel} segundos` 
        }],
        survival: [{ 
          type: 'time', 
          value: config.LEVEL_REQUIREMENTS.survival.baseTime + (level-1) * config.LEVEL_REQUIREMENTS.survival.timeIncreasePerLevel, 
          description: `Sobrevive ${(config.LEVEL_REQUIREMENTS.survival.baseTime + (level-1) * config.LEVEL_REQUIREMENTS.survival.timeIncreasePerLevel)/60} minutos` 
        }],
        zen: [{ 
          type: 'time', 
          value: 0, 
          description: 'Juega sin presión' 
        }]
      }
    };
  }
} 