/**
 * gameEndConditions.ts
 * 
 * Este módulo contiene la lógica para evaluar las condiciones de finalización del juego,
 * incluyendo tanto las condiciones de victoria (nivel completado) como las de derrota (game over).
 * Se ha extraído a un módulo separado para mejorar la modularidad y facilitar el mantenimiento.
 */

import { store } from '../store';
import { setGameStatus, setGameEndReason } from '../store/slices/gameSlice';
import logger from './logger';
import { checkBoardForValidMoves } from './gameUtils';
import { audioManager } from './audioManager';

// Variable para controlar el período de gracia al iniciar un nivel
// Evita game over inmediato cuando se inicia un nivel nuevo
let levelTransitionGrace = 0;

/**
 * Establece el período de gracia para la detección de fin de partida
 * @param value - Número de iconos de gracia antes de evaluar condiciones de game over
 */
export const setLevelTransitionGrace = (value: number): void => {
  levelTransitionGrace = value;
  logger.info('Game', `PERÍODO DE GRACIA: Establecido a ${value} iconos para prevenir game over inmediato`);
};

/**
 * Decrementa el período de gracia cuando se añade un nuevo icono
 * @returns El valor actualizado del período de gracia
 */
export const decrementLevelTransitionGrace = (): number => {
  if (levelTransitionGrace > 0) {
    levelTransitionGrace--;
    logger.info('Game', `PERÍODO DE GRACIA: Decrementado a ${levelTransitionGrace} iconos restantes`);
  }
  return levelTransitionGrace;
};

/**
 * Función principal para verificar si el juego debe terminar
 * @param board - El tablero actual
 * @param boardSize - El tamaño del tablero
 * @param availableIcons - Lista de iconos disponibles para el nivel actual
 * @returns true si el juego debe continuar, false si debe terminar
 */
export const checkGameEndCondition = (
  board: (string | null)[][],
  boardSize: number, 
  availableIcons: string[]
): boolean => {
  // Si hay un período de gracia activo, no evaluar fin de partida
  if (levelTransitionGrace > 0) {
    logger.info('Game', `PERÍODO DE GRACIA: Activo con ${levelTransitionGrace} iconos restantes. Ignorando comprobación de fin de partida.`);
    return true; // El juego continúa
  }
  
  // Verificar si hay movimientos válidos en el tablero
  const hasMovesAvailable = checkBoardForValidMoves(board, boardSize, availableIcons);

  // Si hay movimientos disponibles, el juego continúa
  if (hasMovesAvailable) {
    return true;
  }

  // No hay movimientos válidos, evaluar condiciones para determinar si nivel completado o game over
  
  // Calcular estadísticas del tablero
  const { iconCount, uniqueIconsCount, occupationPercentage } = calculateBoardStats(board, boardSize);
  const gameState = store.getState().game;
  const { currentPlayMode, currentDifficulty, spawnRate } = gameState;
  
  logger.info('Game', `Evaluación de fin de nivel: Modo ${currentPlayMode}, ${iconCount} iconos (${occupationPercentage.toFixed(1)}%), ${uniqueIconsCount} tipos diferentes`);
  
  // Casos especiales según el modo de juego
  if (currentPlayMode === 'survival') {
    handleSurvivalModeEndCondition(iconCount);
    return false; // Devolver false porque ya hemos manejado la condición
  }
  
  // Verificar si el tablero está completamente lleno (100% ocupación)
  // NUEVA LÓGICA: Solo game over si el tablero está completo
  if (occupationPercentage >= 100) {
    handleGameOverByFullBoard(currentPlayMode, currentDifficulty, spawnRate);
    return false;
  }
  
  // Para otros casos donde no hay movimientos válidos pero el tablero no está lleno,
  // considerar como nivel completado en lugar de game over
  handleLevelCompletedEndCondition(iconCount, occupationPercentage);
  return false;
};

/**
 * Calcula estadísticas del tablero actual
 * @param board - El tablero actual
 * @param boardSize - El tamaño del tablero
 * @returns Objeto con estadísticas del tablero (recuento de iconos, iconos únicos y porcentaje de ocupación)
 */
const calculateBoardStats = (board: (string | null)[][], boardSize: number) => {
  // Optimización: usar Set para contar iconos únicos
  const uniqueIcons = new Set<string>();
  let iconCount = 0;
  
  for (let row = 0; row < boardSize; row++) {
    for (let col = 0; col < boardSize; col++) {
      if (board[row][col] !== null) {
        uniqueIcons.add(board[row][col] as string);
        iconCount++;
      }
    }
  }
  
  const totalCells = boardSize * boardSize;
  const occupationPercentage = (iconCount / totalCells) * 100;
  
  return {
    iconCount,
    uniqueIconsCount: uniqueIcons.size,
    occupationPercentage
  };
};

/**
 * Maneja las condiciones de fin específicas para el modo supervivencia
 * @param iconCount - Número de iconos en el tablero
 */
const handleSurvivalModeEndCondition = (iconCount: number): void => {
  logger.info('Game', `En modo supervivencia no se completa el nivel automáticamente con la detección rápida`);
  // Sólo completar nivel en supervivencia si el tablero está completamente vacío
  if (iconCount === 0) {
    dispatch(setGameStatus('levelCompleted'));
  }
};

/**
 * Maneja las condiciones de nivel completado
 * @param iconCount - Número de iconos en el tablero
 * @param occupationPercentage - Porcentaje de ocupación del tablero
 */
const handleLevelCompletedEndCondition = (iconCount: number, occupationPercentage: number): void => {
  logger.info('Game', `⚡ Detección rápida: No hay más movimientos válidos con (${occupationPercentage.toFixed(1)}%) de ocupación. Nivel completado.`);
  
  // Establecer el motivo del nivel completado
  const reason = iconCount <= 2
    ? `¡Has eliminado casi todos los iconos! Solo quedan ${iconCount} iconos sin posibilidad de convergencia.`
    : `¡Has despejado lo suficiente del tablero! Con un ${occupationPercentage.toFixed(1)}% de ocupación sin movimientos válidos, has completado el nivel.`;
  
  dispatch(setGameEndReason(reason));
  dispatch(setGameStatus('levelCompleted'));
};

/**
 * Maneja el game over cuando el tablero está completamente lleno
 * @param mode - Modo de juego actual
 * @param difficulty - Dificultad actual
 * @param spawnRate - Velocidad de aparición de iconos en milisegundos
 */
const handleGameOverByFullBoard = (
  mode: string, 
  difficulty: string, 
  spawnRate: number
): void => {
  logger.info('Game', `⚡ Detección rápida: Tablero completamente lleno (100%). Game over.`);
  
  // Establecer el motivo del game over
  const spawnRateSeconds = (spawnRate / 1000).toFixed(1);
  const reason = `El tablero está completamente lleno. Modo: ${mode}, Dificultad: ${difficulty}, Velocidad: ${spawnRateSeconds}s/icono.`;
  
  dispatch(setGameEndReason(reason));
  dispatch(setGameStatus('gameOver'));
  audioManager.play('gameOver');
};

// Mantener la función original para el modo contrareloj, que será llamada desde otro lugar
export const handleGameOverEndCondition = (
  occupationPercentage: number, 
  mode: string, 
  difficulty: string, 
  spawnRate: number
): void => {
  // Solo se usará para el modo contrareloj cuando se acabe el tiempo
  if (mode === 'timed') {
    logger.info('Game', `⚡ Game Over en modo contrareloj: Tiempo agotado.`);
    
    const spawnRateSeconds = (spawnRate / 1000).toFixed(1);
    const reason = `Se ha agotado el tiempo en modo contrareloj con ${occupationPercentage.toFixed(1)}% de ocupación del tablero. Dificultad: ${difficulty}, Velocidad: ${spawnRateSeconds}s/icono.`;
    
    dispatch(setGameEndReason(reason));
    dispatch(setGameStatus('gameOver'));
    audioManager.play('gameOver');
  } else {
    // Si no es modo contrareloj, verificamos si el tablero está lleno
    if (occupationPercentage >= 100) {
      handleGameOverByFullBoard(mode, difficulty, spawnRate);
    } else {
      // En cualquier otro caso, consideramos que es un nivel completado
      handleLevelCompletedEndCondition(0, occupationPercentage);
    }
  }
};

// Helper para acceder a dispatch sin usar hooks
const dispatch = store.dispatch; 