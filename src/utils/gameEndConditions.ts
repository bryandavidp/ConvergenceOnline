/**
 * gameEndConditions.ts
 * 
 * Este módulo contiene la lógica para evaluar las condiciones de finalización del juego,
 * incluyendo tanto las condiciones de victoria (nivel completado) como las de derrota (game over).
 * Se ha extraído a un módulo separado para mejorar la modularidad y facilitar el mantenimiento.
 */

import { store } from '../store';
import { setGameStatus, setGameEndReason, addScore } from '../store/slices/gameSlice';
import logger from './logger';
import { checkBoardForValidMoves } from './gameUtils';
import { audioManager } from './audioManager';

// Constantes para las condiciones de victoria
const PERFECT_CLEAR_BONUS = 5000; // Bonus por limpiar completamente el tablero
const MAX_ICONS_FOR_VICTORY = 2; // Máximo de iconos permitidos para victoria normal

/**
 * Función principal para verificar si el juego debe terminar
 */
export const checkGameEndCondition = (
  board: (string | null)[][],
  boardSize: number, 
  availableIcons: string[]
): boolean => {
  // Verificar si hay movimientos válidos
  const hasMovesAvailable = checkBoardForValidMoves(board, boardSize, availableIcons);

  // Calcular estadísticas del tablero
  const { iconCount, occupationPercentage } = calculateBoardStats(board, boardSize);
  const gameState = store.getState().game;
  const { currentPlayMode, currentDifficulty, spawnRate } = gameState;
  
  logger.info('Game', `Evaluación de fin de nivel: Modo ${currentPlayMode}, ${iconCount} iconos (${occupationPercentage.toFixed(1)}%)`);
  
  // VICTORIA PERFECTA: Tablero completamente vacío
  if (iconCount === 0) {
    handlePerfectVictory();
    return false;
  }
  
  // Si hay movimientos disponibles, el juego continúa
  if (hasMovesAvailable) {
    return true;
  }
  
  // VICTORIA NORMAL: No hay movimientos y quedan 2 o menos iconos
  if (iconCount <= MAX_ICONS_FOR_VICTORY) {
    handleNormalVictory(iconCount);
    return false;
  }
  
  // GAME OVER: Tablero lleno sin movimientos posibles
  if (occupationPercentage >= 100) {
    handleGameOverByFullBoard(currentPlayMode, currentDifficulty, spawnRate);
    return false;
  }
  
  // Si no hay movimientos pero hay más de 2 iconos, el juego continúa
  logger.info('Game', `No hay movimientos válidos pero quedan ${iconCount} iconos. El juego continúa.`);
  return true;
};

/**
 * Calcula estadísticas del tablero actual
 */
const calculateBoardStats = (board: (string | null)[][], boardSize: number) => {
  let iconCount = 0;
  
  for (let row = 0; row < boardSize; row++) {
    for (let col = 0; col < boardSize; col++) {
      if (board[row][col] !== null) {
        iconCount++;
      }
    }
  }
  
  const totalCells = boardSize * boardSize;
  const occupationPercentage = (iconCount / totalCells) * 100;
  
  return { iconCount, occupationPercentage };
};

/**
 * Maneja la victoria perfecta (tablero completamente vacío)
 */
const handlePerfectVictory = (): void => {
  logger.info('Game', '¡VICTORIA PERFECTA! Tablero completamente vacío');
  
  // Otorgar bonus por victoria perfecta
  dispatch(addScore(PERFECT_CLEAR_BONUS));
  
  dispatch(setGameEndReason(`¡VICTORIA PERFECTA! Has limpiado completamente el tablero. ¡Bonus de ${PERFECT_CLEAR_BONUS} puntos!`));
  dispatch(setGameStatus('levelCompleted'));
  audioManager.play('perfectClear');
};

/**
 * Maneja la victoria normal (pocos iconos sin movimientos)
 */
const handleNormalVictory = (iconCount: number): void => {
  logger.info('Game', `Victoria normal: ${iconCount} iconos restantes sin movimientos posibles`);
  
  dispatch(setGameEndReason(`¡Nivel completado! Solo quedan ${iconCount} iconos sin posibilidad de convergencia.`));
  dispatch(setGameStatus('levelCompleted'));
  audioManager.play('levelComplete');
};

/**
 * Maneja el game over cuando el tablero está completamente lleno
 */
const handleGameOverByFullBoard = (
  mode: string, 
  difficulty: string, 
  spawnRate: number
): void => {
  logger.info('Game', `Game Over: Tablero completamente lleno sin movimientos posibles`);
  
  const spawnRateSeconds = (spawnRate / 1000).toFixed(1);
  const reason = `El tablero está completamente lleno sin movimientos posibles. Modo: ${mode}, Dificultad: ${difficulty}, Velocidad: ${spawnRateSeconds}s/icono.`;
  
  dispatch(setGameEndReason(reason));
  dispatch(setGameStatus('gameOver'));
  audioManager.play('gameOver');
};

// Helper para acceder a dispatch sin usar hooks
const dispatch = store.dispatch; 