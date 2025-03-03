import { isValidCell } from '../../../../utils/gameUtils';
import { isValidPlacement } from './convergenceUtils';

/**
 * Busca un movimiento válido en el tablero para mostrar como pista
 * @param board El tablero actual
 * @param boardSize Tamaño del tablero
 * @param availableIcons Iconos disponibles
 * @returns Un objeto con la posición de la pista o null si no hay pistas disponibles
 */
export const findHintPosition = (
  board: (string | null)[][],
  boardSize: number,
  availableIcons: string[]
): { row: number; col: number } | null => {
  if (!board || board.length === 0) return null;

  // Buscar la primera celda vacía que pueda crear una convergencia
  for (let row = 0; row < boardSize; row++) {
    for (let col = 0; col < boardSize; col++) {
      if (board[row][col] === null) {
        // Si esta posición puede crear una convergencia, es una buena pista
        if (isValidPlacement(board, row, col, boardSize, availableIcons)) {
          return { row, col };
        }
      }
    }
  }

  return null;
};

/**
 * Resalta celdas específicas para mostrar una pista
 * @param hintPosition Posición de la celda para mostrar la pista
 * @returns Un array con las celdas a resaltar
 */
export const getHighlightedCells = (
  hintPosition: { row: number; col: number }
): { row: number; col: number }[] => {
  if (!hintPosition) return [];
  
  return [hintPosition];
};

/**
 * Verifica si se puede usar una pista basado en el cooldown y pistas restantes
 * @param hintsRemaining Número de pistas restantes
 * @param hintCooldown Estado del cooldown de pistas
 * @param gameStatus Estado actual del juego
 * @returns true si se puede usar una pista, false en caso contrario
 */
export const canUseHint = (
  hintsRemaining: number,
  hintCooldown: boolean,
  gameStatus: string
): boolean => {
  return gameStatus === 'playing' && !hintCooldown && hintsRemaining > 0;
}; 