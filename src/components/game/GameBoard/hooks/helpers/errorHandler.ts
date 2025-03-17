import { Dispatch } from 'redux';
import { audioManager } from '../../../../../utils/audioManager';
import logger from '../../../../../utils/logger';
import { speedController } from '../../../../../utils/speedController';
import { store } from '../../../../../store';
import { setSpawnRate } from '../../../../../store/slices/gameSlice';

/**
 * Función para animar una celda con error
 * 
 * @param cellElement - Elemento DOM de la celda
 * @param addAnimationTimer - Función para registrar temporizadores
 */
export const animateCellError = (
  cellElement: HTMLElement | null,
  addAnimationTimer: (timer: NodeJS.Timeout) => void
) => {
  if (!cellElement) return;
  
  // Añadir clase de error
  cellElement.classList.add('error');
  
  // Reproducir sonido de error
  audioManager.play("invalidMove");
  
  // Eliminar la clase después de la animación
  const timer = setTimeout(() => {
    cellElement.classList.remove('error');
  }, 500);
  
  // Registrar el temporizador
  addAnimationTimer(timer);
};

/**
 * Función para animar la sacudida del tablero
 * 
 * @param addAnimationTimer - Función para registrar temporizadores
 */
export const animateBoardShake = (
  addAnimationTimer: (timer: NodeJS.Timeout) => void
) => {
  const boardElement = document.querySelector('.game-board-grid');
  if (!boardElement) return;
  
  // Añadir clase de sacudida
  boardElement.classList.add('shake');
  
  // Eliminar la clase después de la animación
  const timer = setTimeout(() => {
    boardElement.classList.remove('shake');
  }, 500);
  
  // Registrar el temporizador
  addAnimationTimer(timer);
};

/**
 * Función para actualizar la velocidad como penalización
 * 
 * @param currentSpawnRate - Velocidad actual de aparición
 * @param dispatch - Función dispatch de Redux
 * @param addNotification - Función para mostrar notificaciones
 * @returns - La nueva velocidad
 */
export const increaseSpeedAsPenalty = (
  currentSpawnRate: number,
  dispatch: Dispatch,
  addNotification?: (notification: any) => void
): number => {
  const { currentDifficulty } = store.getState().game;
  const newSpawnRate = speedController.calculatePenaltyRate(currentSpawnRate, currentDifficulty);
  
  // Solo aplicar si hay un cambio significativo
  if (Math.abs(currentSpawnRate - newSpawnRate) >= 50) {
    // Calcular el cambio de velocidad
    const speedChange = ((currentSpawnRate - newSpawnRate) / currentSpawnRate * 100).toFixed(1);
    const spawnTimeOld = (currentSpawnRate / 1000).toFixed(1);
    const spawnTimeNew = (newSpawnRate / 1000).toFixed(1);
    
    // Actualizar la velocidad
    dispatch(setSpawnRate(newSpawnRate));
    
    // Mostrar notificación si está disponible
    if (addNotification) {
      addNotification({
        message: '¡Penalización por error!',
        type: 'error',
        icon: '⚡',
        duration: 3000,
        value: `${spawnTimeOld}s → ${spawnTimeNew}s (${speedChange}% más rápido)`
      });
    }
    
    // Log para depuración
    logger.info('Game', `Penalización de velocidad aplicada: ${currentSpawnRate}ms → ${newSpawnRate}ms (${speedChange}% más rápido)`);
  }
  
  return newSpawnRate;
}; 