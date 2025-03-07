import { Dispatch } from 'redux';
import { setSpawnRate } from '../../../../../store/slices/gameSlice';
import * as config from '../../../../../utils/config';
import { audioManager } from '../../../../../utils/audioManager';
import logger from '../../../../../utils/logger';

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
 * @returns - El nuevo multiplicador de velocidad
 */
export const increaseSpeedAsPenalty = (
  currentSpawnRate: number,
  dispatch: Dispatch
) => {
  // Calcular nueva velocidad
  const baseSpeed = config.INITIAL_SPAWN_RATE;
  const maxSpeedMultiplier = 3; // Valor máximo de multiplicador
  const minSpeed = baseSpeed / maxSpeedMultiplier;
  
  // Reducir el tiempo entre apariciones (aumentar velocidad)
  // Usamos un factor más pequeño (0.95) para que sea menos brusco
  const newSpawnRate = Math.max(minSpeed, currentSpawnRate * 0.95);
  
  // Actualizar en el store
  dispatch(setSpawnRate(newSpawnRate));
  
  // Calcular y devolver el nuevo multiplicador
  const newMultiplier = Number((baseSpeed / newSpawnRate).toFixed(1));
  logger.info('ErrorHandler', `Velocidad aumentada a ${newMultiplier}x (${newSpawnRate}ms)`);
  
  return newMultiplier;
}; 