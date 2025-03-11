/**
 * speedController.ts
 * 
 * Este módulo contiene la lógica para gestionar la velocidad del juego,
 * incluyendo los incrementos automáticos y las restricciones basadas en
 * la dificultad y el modo de juego.
 */

import { MutableRefObject, useCallback } from 'react';
import { store } from '../store';
import { setSpawnRate } from '../store/slices/gameSlice';
import * as config from './config';
import logger from './logger';
import { GameMode } from './config';

export interface SpeedIncrementConfig {
  minSpawnRate: number;            // Velocidad mínima permitida
  speedIncreaseAmount: number;     // Cantidad de reducción en ms por incremento
  speedIncreaseInterval: number;   // Intervalo entre incrementos en segundos
}

export interface SpeedControllerResult {
  handleSpeedIncrease: () => void;
  resetSpeedIncreaseTime: () => void;
}

// Constante para asegurar que el multiplicador máximo se respete
const MAX_MULTIPLIER = 3.0;  // Multiplicador máximo permitido (3x)
const DEFAULT_BASE_RATE = 4000; // Tasa base estándar para referencia

/**
 * Hook para gestionar el incremento automático de velocidad durante el juego
 * 
 * @param lastSpeedIncreaseTimeRef Referencia al tiempo del último incremento de velocidad
 * @param addNotification Función para mostrar notificaciones al usuario (opcional)
 * @returns Objeto con funciones para gestionar la velocidad
 */
export const useSpeedController = (
  lastSpeedIncreaseTimeRef: MutableRefObject<number>,
  addNotification?: (notification: any) => void
): SpeedControllerResult => {
  
  // Función para reiniciar el contador de incremento de velocidad
  const resetSpeedIncreaseTime = useCallback(() => {
    lastSpeedIncreaseTimeRef.current = 0;
    logger.debug('SpeedController', 'Contador de incremento de velocidad reiniciado');
  }, [lastSpeedIncreaseTimeRef]);
  
  /**
   * Gestiona el incremento automático de velocidad basado en el tiempo transcurrido
   */
  const handleSpeedIncrease = useCallback(() => {
    // Obtener estado actual del juego
    const gameState = store.getState().game;
    const { 
      currentPlayMode, 
      currentDifficulty, 
      spawnRate, 
      timer, 
      status 
    } = gameState;
    
    // Solo aplicar en estado playing
    if (status !== 'playing') {
      return;
    }
    
    // Obtener configuración de dificultad actual
    const difficultyMode = currentDifficulty as GameMode;
    const difficultyConfig = config.DIFFICULTY_CONFIG[difficultyMode];
    
    // Si no hay configuración, no hacer nada
    if (!difficultyConfig) {
      return;
    }
    
    // Calcular si es momento de incrementar la velocidad
    const currentTime = timer;
    const speedIncreaseInterval = difficultyConfig.speedIncreaseInterval;
    
    // Verificar si pasó suficiente tiempo desde el último incremento
    if (currentTime - lastSpeedIncreaseTimeRef.current >= speedIncreaseInterval) {
      // Calcular nueva velocidad
      const speedIncreaseAmount = difficultyConfig.speedIncreaseAmount;
      
      // Calcular el límite basado en el multiplicador máximo, no en el minSpawnRate
      const baseSpawnRate = difficultyConfig.spawnRate;
      const absoluteMinSpawnRate = Math.ceil(baseSpawnRate / MAX_MULTIPLIER);
      
      // Asegurar que nunca se baje del mínimo absoluto (velocidad sería demasiado rápida)
      const effectiveMinRate = Math.max(absoluteMinSpawnRate, 800); 
      
      // Asegurar que tampoco se pase por debajo del minSpawnRate configurado por dificultad
      // Solo si este es mayor que el mínimo absoluto
      const finalMinRate = Math.max(effectiveMinRate, difficultyConfig.minSpawnRate);
      
      // Calcular nueva velocidad considerando el mínimo ajustado
      const newSpawnRate = Math.max(finalMinRate, spawnRate - speedIncreaseAmount);
      
      // Si hay un cambio en la velocidad, actualizarlo
      if (newSpawnRate < spawnRate) {
        // Calcular el multiplicador de velocidad (base/actual)
        const speedMultiplier = parseFloat((baseSpawnRate / newSpawnRate).toFixed(1));
        
        const reduccionPorcentaje = ((spawnRate - newSpawnRate) / spawnRate * 100).toFixed(1);
        console.log("\n**********************************************************");
        console.log(`INCREMENTO AUTOMÁTICO DE VELOCIDAD (TIEMPO: ${currentTime}s)`);
        console.log(`- Velocidad anterior: ${spawnRate}ms (${(spawnRate/1000).toFixed(1)}s)`);
        console.log(`- Nueva velocidad: ${newSpawnRate}ms (${(newSpawnRate/1000).toFixed(1)}s)`);
        console.log(`- Multiplicador actual: ${speedMultiplier}x (Base: ${baseSpawnRate}ms)`);
        console.log(`- Reducción: ${reduccionPorcentaje}% más rápido`);
        console.log(`- Mínimo permitido: ${finalMinRate}ms (para asegurar multiplicador máximo de ${MAX_MULTIPLIER}x)`);
        console.log("**********************************************************");
        
        logger.info('GameLogic', `Incremento automático de velocidad: ${spawnRate}ms → ${newSpawnRate}ms (${speedMultiplier}x)`);
        store.dispatch(setSpawnRate(newSpawnRate));
        
        // Mostrar notificación al jugador
        if (addNotification) {
          addNotification({
            message: `¡Velocidad aumentada a ${speedMultiplier}x!`,
            type: 'warning',
            icon: '⚡',
            duration: 2500
          });
        }
        
        // Actualizar el tiempo del último incremento
        lastSpeedIncreaseTimeRef.current = currentTime;
      }
    }
  }, [lastSpeedIncreaseTimeRef, addNotification]);

  return {
    handleSpeedIncrease,
    resetSpeedIncreaseTime
  };
}; 