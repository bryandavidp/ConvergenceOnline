import { GameDifficulty, GamePlayMode } from '../store/slices/gameSlice';
import * as levels from './levels';

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
  // Obtener la configuración del nivel actual
  const levelConfig = levels.getLevelConfig(level, playMode, 'normal'); // La dificultad no afecta a la verificación
  const requirements = levelConfig.requirements[playMode];
  
  // Para evitar completado prematuro, verificar que haya pasado al menos el tiempo mínimo
  const minTimeToValidate = levels.minTimeToValidate;
  const hasMinimumPlayTime = gameTimer !== undefined && gameTimer >= minTimeToValidate;
  
  // En modo clásico, se pueden cumplir varios criterios
  if (playMode === 'classic') {
    // Verificar puntuación (este criterio siempre es válido)
    const scoreReq = requirements.find(req => req.type === 'score');
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
      const occupationReq = requirements.find(req => req.type === 'occupation');
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
    const timeReq = requirements.find(req => req.type === 'time');
    if (timeReq && survivalTime >= timeReq.value) {
      return true;
    }
  }
  
  return false;
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
  const nextLevelConfig = levels.getLevelConfig(nextLevel, playMode, difficulty);
  
  // Extraer objetivos y recompensas
  const objectives = nextLevelConfig.requirements[playMode].map(req => req.description);
  
  // Las recompensas pueden no estar definidas para todos los modos
  const rewards = nextLevelConfig.rewards[playMode] 
    ? nextLevelConfig.rewards[playMode]?.map(rew => rew.description) || []
    : [];
  
  // Características especiales
  const specialFeatures: string[] = [];
  
  if (nextLevelConfig.specialFeatures) {
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
    boardSize: nextLevelConfig.boardSize,
    icons: nextLevelConfig.icons,
    objectives,
    rewards,
    specialFeatures
  };
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
  const levelConfig = levels.getLevelConfig(level, playMode, difficulty);
  
  // Valores predeterminados
  let points = 0;
  let hints = 0;
  let powerups = 0;
  
  // Extraer recompensas si existen para este modo
  if (levelConfig.rewards[playMode]) {
    levelConfig.rewards[playMode]?.forEach(reward => {
      if (reward.type === 'points') {
        points += reward.value;
      } else if (reward.type === 'hint') {
        hints += reward.value;
      } else if (reward.type === 'powerup') {
        powerups += reward.value;
      }
    });
  }
  
  return { points, hints, powerups };
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