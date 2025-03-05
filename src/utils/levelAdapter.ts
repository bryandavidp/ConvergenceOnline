import { GameDifficulty, GamePlayMode } from '../store/slices/gameSlice';
import * as levels from './levels';

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
  gameTimer?: number
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
    const minTimeToValidate = levels.minTimeToValidate;
    const hasMinimumPlayTime = gameTimer !== undefined && gameTimer >= minTimeToValidate;
    
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
        return true;
      }
      
      // Criterio por ocupación: solo válido después de tiempo mínimo de juego
      if (hasMinimumPlayTime) {
        const totalCells = boardSize * boardSize;
        const occupationPercentage = (iconCount / totalCells) * 100;
        
        // El tablero está completamente vacío
        if (iconCount === 0) {
          return true;
        }
        
        // Verificar requisito de ocupación
        const occupationReq = classicRequirements.find(req => req.type === 'occupation');
        if (occupationReq && occupationPercentage <= occupationReq.value) {
          return true;
        }
      }
    }
    
    // En modo contrarreloj
    if (playMode === 'timed' && timeRemaining !== undefined) {
      // El nivel se completa cuando se llega a 0 y el jugador sigue vivo
      return timeRemaining <= 0;
    }
    
    // En modo supervivencia
    if (playMode === 'survival' && survivalTime !== undefined) {
      const survivalRequirements = levelConfig.requirements.survival;
      if (!survivalRequirements || !Array.isArray(survivalRequirements)) {
        return false;
      }
      
      const timeReq = survivalRequirements.find(req => req.type === 'time');
      if (timeReq && survivalTime >= timeReq.value) {
        return true;
      }
    }
    
    return false;
  } catch (error) {
    // En caso de error, no completar el nivel
    console.error("Error al verificar nivel completado:", error);
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
  const levelConfig = levels.getLevelConfig(level, playMode, difficulty);
  return levelConfig.requirements[playMode].map(req => req.description);
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
      boardSize: nextLevelConfig ? nextLevelConfig.boardSize : 5,
      icons: nextLevelConfig ? nextLevelConfig.icons : ["🍎", "🍇", "🍊", "🍓"],
      objectives,
      rewards,
      specialFeatures
    };
  } catch (error) {
    console.error("Error al obtener información del siguiente nivel:", error);
    // Devolver valores por defecto
    return {
      level: nextLevel,
      boardSize: 5,
      icons: ["🍎", "🍇", "🍊", "🍓"],
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
 * Compatibilidad con config.ts - Obtener el tamaño del tablero
 */
export function getBoardSizeForLevel(level: number): number {
  return levels.getLevelBoardSize(level);
}

/**
 * Compatibilidad con config.ts - Obtener iconos para un nivel
 */
export function getIconSetForLevel(level: number): string[] {
  return levels.getLevelIcons(level);
}

/**
 * Compatibilidad con config.ts - Obtener velocidad de spawn
 */
export function getLevelSpawnRate(level: number, gameMode: string = 'classic', difficulty: string = 'normal'): number {
  return levels.getLevelSpawnRate(
    level, 
    gameMode as GamePlayMode, 
    difficulty as GameDifficulty
  );
}

/**
 * Calcula la cantidad de iconos diferentes para un nivel
 */
export function iconCountByLevel(level: number): number {
  const icons = levels.getLevelIcons(level);
  return icons.length;
}

/**
 * Determina si un nivel tiene características especiales habilitadas
 */
export function hasLevelSpecialFeatures(level: number, featureType: string): boolean {
  return levels.hasSpecialFeature(level, featureType);
} 