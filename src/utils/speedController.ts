/**
 * speedController.ts
 * 
 * Sistema de control de velocidad del juego con soporte para
 * escalado dinámico y límites configurables por nivel y dificultad.
 */

import { MutableRefObject, useCallback } from 'react';
import { store } from '../store';
import { setSpawnRate } from '../store/slices/gameSlice';
import { GameDifficulty } from '../store/slices/gameSlice';
import * as config from './config';
import logger from './logger';

// Tipos
export interface SpeedConfig {
  baseRate: number;          // Velocidad base en ms
  minRate: number;          // Velocidad mínima permitida en ms
  maxMultiplier: number;    // Multiplicador máximo de velocidad
  penaltyReduction: number; // Porcentaje de reducción por penalización (0-1)
  levelScaling: number;     // Factor de escalado por nivel (0-1)
}

export type GamePlayMode = 'classic' | 'timed' | 'survival' | 'zen' | 'tutorial';

// Configuración por dificultad
const DIFFICULTY_SPEED_CONFIG: Record<GameDifficulty, SpeedConfig> = {
  easy: {
    baseRate: 4000,         // 4 segundos base
    minRate: 2000,         // No más rápido que 2 segundos
    maxMultiplier: 2.0,    // Máximo 2x la velocidad base
    penaltyReduction: 0.15, // 15% más rápido por error
    levelScaling: 0.05     // 5% más rápido por nivel
  },
  normal: {
    baseRate: 3000,         // 3 segundos base
    minRate: 1000,         // No más rápido que 1 segundo
    maxMultiplier: 3.0,    // Máximo 3x la velocidad base
    penaltyReduction: 0.20, // 20% más rápido por error
    levelScaling: 0.07     // 7% más rápido por nivel
  },
  hard: {
    baseRate: 2500,         // 2.5 segundos base
    minRate: 500,          // No más rápido que 0.5 segundos
    maxMultiplier: 5.0,    // Máximo 5x la velocidad base
    penaltyReduction: 0.30, // 30% más rápido por error
    levelScaling: 0.15     // 15% más rápido por nivel
  },
  tutorial: {
    baseRate: 5000,         // 5 segundos base
    minRate: 3000,         // No más rápido que 3 segundos
    maxMultiplier: 1.5,    // Máximo 1.5x la velocidad base
    penaltyReduction: 0.05, // 5% más rápido por error
    levelScaling: 0.03     // 3% más rápido por nivel
  }
};

// Ajustes por modo de juego
const MODE_SPEED_MODIFIERS: Record<GamePlayMode, number> = {
  classic: 1.0,
  timed: 0.85,    // 15% más rápido
  survival: 1.15, // 15% más lento
  zen: 1.0,
  tutorial: 1.0
};

class SpeedController {
  private static instance: SpeedController;
  private lastSpeedIncreaseTime: number = 0;
  
  private constructor() {}
  
  public static getInstance(): SpeedController {
    if (!SpeedController.instance) {
      SpeedController.instance = new SpeedController();
    }
    return SpeedController.instance;
  }

  /**
   * Reinicia el temporizador de incremento de velocidad
   */
  public resetSpeedIncreaseTime(): void {
    this.lastSpeedIncreaseTime = Date.now();
  }

  /**
   * Obtiene el tiempo desde el último incremento de velocidad
   */
  public getTimeSinceLastSpeedIncrease(): number {
    return Date.now() - this.lastSpeedIncreaseTime;
  }

  /**
   * Obtiene la configuración de velocidad para una dificultad específica
   */
  public getSpeedConfigForDifficulty(difficulty: GameDifficulty): SpeedConfig {
    const config = DIFFICULTY_SPEED_CONFIG[difficulty];
    if (!config) {
      logger.warn('SpeedController', `Dificultad ${difficulty} no encontrada, usando normal`);
      return DIFFICULTY_SPEED_CONFIG.normal;
    }
    return config;
  }

  /**
   * Calcula el multiplicador actual de velocidad
   */
  public getCurrentMultiplier(spawnRate: number, difficulty: GameDifficulty): number {
    const config = this.getSpeedConfigForDifficulty(difficulty);
    
    if (isNaN(spawnRate) || spawnRate <= 0) {
      return 1.0;
    }
    
    const multiplier = Number((config.baseRate / spawnRate).toFixed(1));
    return Math.min(multiplier, config.maxMultiplier);
  }

  /**
   * Calcula la velocidad para un nivel específico
   */
  public calculateLevelSpeed(
    level: number,
    playMode: GamePlayMode,
    difficulty: GameDifficulty
  ): number {
    const config = this.getSpeedConfigForDifficulty(difficulty);
    const modeModifier = MODE_SPEED_MODIFIERS[playMode];
    
    // Calcular reducción por nivel usando el factor de escalado
    const levelReduction = Math.min(
      config.baseRate * 0.8, // Máximo 80% de reducción total (era 70%)
      (level - 1) * (config.baseRate * config.levelScaling)
    );
    
    // Calcular velocidad base ajustada
    let baseRate = config.baseRate - levelReduction;
    
    // Aplicar modificador de modo de juego
    baseRate *= modeModifier;
    
    // Asegurar que no exceda los límites
    const safeRate = Math.max(config.minRate, Math.round(baseRate));
    
    logger.debug('SpeedController', `Velocidad calculada para nivel ${level}:
      - Base: ${config.baseRate}ms
      - Reducción por nivel: ${levelReduction}ms (${(config.levelScaling * 100).toFixed(1)}% × ${level - 1})
      - Modificador de modo: ${modeModifier}
      - Velocidad final: ${safeRate}ms
      - Multiplicador actual: ${this.getCurrentMultiplier(safeRate, difficulty).toFixed(2)}x`);
    
    return safeRate;
  }

  /**
   * Aplica una penalización de velocidad
   */
  public calculatePenaltyRate(spawnRate: number, difficulty: GameDifficulty): number {
    const config = this.getSpeedConfigForDifficulty(difficulty);
    
    // Calcular nueva velocidad con la penalización
    const newRate = Math.round(spawnRate * (1 - config.penaltyReduction));
    
    // Asegurar que no baje del mínimo permitido
    const safeRate = Math.max(config.minRate, newRate);
    
    // Log detallado
    logger.info('SpeedController', `[VELOCIDAD] Penalización aplicada:
      - Dificultad: ${difficulty}
      - Velocidad actual: ${spawnRate}ms
      - Multiplicador: ${(1 - config.penaltyReduction).toFixed(2)}
      - Nueva velocidad: ${safeRate}ms
      - Reducción: ${((spawnRate - safeRate) / spawnRate * 100).toFixed(1)}%`);
    
    return safeRate;
  }

  /**
   * Calcula la nueva velocidad al incrementar manualmente
   */
  public calculateIncreasedSpeed(spawnRate: number, difficulty: GameDifficulty): number {
    const config = this.getSpeedConfigForDifficulty(difficulty);
    
    // Calcular nueva velocidad con el incremento
    const newRate = Math.round(spawnRate * (1 - config.levelScaling));
    
    // Asegurar que no baje del mínimo permitido
    const safeRate = Math.max(config.minRate, newRate);
    
    // Log detallado
    logger.info('SpeedController', `[VELOCIDAD] Incremento automático:
      - Dificultad: ${difficulty}
      - Velocidad actual: ${spawnRate}ms
      - Reducción: ${(config.levelScaling * 100).toFixed(1)}%
      - Nueva velocidad: ${safeRate}ms`);
    
    return safeRate;
  }

  /**
   * Obtiene la velocidad inicial para una dificultad
   */
  public getInitialSpeed(difficulty: GameDifficulty, playMode: GamePlayMode): number {
    try {
      const config = this.getSpeedConfigForDifficulty(difficulty);
      const modeModifier = MODE_SPEED_MODIFIERS[playMode] || 1.0;
      
      // Calcular velocidad inicial
      const initialRate = Math.round(config.baseRate * modeModifier);
      
      // Validación y límites
      if (isNaN(initialRate) || initialRate <= 0) {
        logger.warn('SpeedController', `Velocidad inicial inválida para ${difficulty}/${playMode}`);
        return config.baseRate;
      }
      
      const safeRate = Math.max(config.minRate, Math.min(config.baseRate, initialRate));
      
      logger.info('SpeedController', `Velocidad inicial calculada:
        - Dificultad: ${difficulty}
        - Modo: ${playMode}
        - Base: ${config.baseRate}ms
        - Modificador: ${modeModifier}
        - Final: ${safeRate}ms`);
      
      return safeRate;
    } catch (error) {
      logger.error('SpeedController', `Error calculando velocidad inicial: ${error}`);
      return DIFFICULTY_SPEED_CONFIG.normal.baseRate;
    }
  }
}

/**
 * Hook personalizado para controlar la velocidad del juego
 */
export const useSpeedController = () => {
  const controller = SpeedController.getInstance();

  return {
    getCurrentMultiplier: useCallback((spawnRate: number, difficulty: GameDifficulty) => 
      controller.getCurrentMultiplier(spawnRate, difficulty), []),
    
    calculatePenaltyRate: useCallback((spawnRate: number, difficulty: GameDifficulty) => 
      controller.calculatePenaltyRate(spawnRate, difficulty), []),
    
    calculateLevelSpeed: useCallback((
      level: number,
      playMode: GamePlayMode,
      difficulty: GameDifficulty
    ) => controller.calculateLevelSpeed(level, playMode, difficulty), []),
    
    calculateIncreasedSpeed: useCallback((spawnRate: number, difficulty: GameDifficulty) => 
      controller.calculateIncreasedSpeed(spawnRate, difficulty), []),

    resetSpeedIncreaseTime: useCallback(() => 
      controller.resetSpeedIncreaseTime(), []),

    getTimeSinceLastSpeedIncrease: useCallback(() => 
      controller.getTimeSinceLastSpeedIncrease(), []),

    getInitialSpeed: useCallback((difficulty: GameDifficulty, playMode: GamePlayMode) => 
      controller.getInitialSpeed(difficulty, playMode), [])
  };
};

// Exportar una instancia única
export const speedController = SpeedController.getInstance(); 