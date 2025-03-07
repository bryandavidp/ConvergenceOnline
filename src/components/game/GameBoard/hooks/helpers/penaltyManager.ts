import { Dispatch } from 'redux';
import { addIcon } from '../../../../../store/slices/gameSlice';
import logger from '../../../../../utils/logger';

/**
 * Función para añadir iconos de penalización al tablero
 * 
 * @param level - Nivel actual del juego
 * @param board - Estado actual del tablero
 * @param boardSize - Tamaño del tablero
 * @param availableIcons - Iconos disponibles para colocar
 * @param dispatch - Función dispatch de Redux
 * @param getCellElement - Función para obtener el elemento DOM de una celda
 * @param addAnimationTimer - Función para registrar temporizadores
 * @returns - Número de iconos añadidos como penalización
 */
export const addPenaltyIcons = (
  level: number,
  board: (string | null)[][],
  boardSize: number,
  availableIcons: string[],
  dispatch: Dispatch,
  getCellElement: (row: number, col: number) => HTMLElement | null,
  addAnimationTimer: (timer: NodeJS.Timeout) => void
): number => {
  try {
    // Número de iconos de penalización escalado por nivel
    const penaltyIconCount = Math.min(4, Math.max(1, Math.floor(level / 2)));
    
    if (penaltyIconCount <= 0 || !board || !availableIcons.length) {
      return 0;
    }
    
    logger.info('PenaltyManager', `Aplicando penalización: añadiendo ${penaltyIconCount} iconos`);
    
    // Lista para almacenar las posiciones vacías
    const emptyCells: { row: number, col: number }[] = [];
    
    // Encontrar todas las celdas vacías
    for (let r = 0; r < boardSize; r++) {
      for (let c = 0; c < boardSize; c++) {
        if (board[r] && board[r][c] === null) {
          emptyCells.push({ row: r, col: c });
        }
      }
    }
    
    // Si no hay celdas vacías, no podemos añadir penalización
    if (emptyCells.length === 0) {
      return 0;
    }
    
    // Mezclar el array para seleccionar posiciones aleatorias
    for (let i = emptyCells.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [emptyCells[i], emptyCells[j]] = [emptyCells[j], emptyCells[i]];
    }
    
    // Determinar cuántos iconos podemos añadir
    const iconsToAdd = Math.min(penaltyIconCount, emptyCells.length);
    let addedCount = 0;
    
    // Añadir los iconos al tablero
    for (let i = 0; i < iconsToAdd; i++) {
      const cell = emptyCells[i];
      // Seleccionar un icono aleatorio
      const randomIcon = availableIcons[Math.floor(Math.random() * availableIcons.length)];
      
      // Dispatchar acción para añadir el icono
      dispatch(addIcon({
        row: cell.row,
        col: cell.col,
        icon: randomIcon,
        isPenalty: true
      }));
      
      addedCount++;
      
      // Aplicar efectos visuales a la celda
      const cellElement = getCellElement(cell.row, cell.col);
      if (cellElement) {
        // Marcar como icono de penalización con una clase CSS
        cellElement.classList.add('penalty-icon');
        
        // Eliminar la clase después de 3.5 segundos
        const animTimer = setTimeout(() => {
          cellElement.classList.remove('penalty-icon');
        }, 3500);
        
        // Registrar el temporizador
        addAnimationTimer(animTimer);
      }
    }
    
    return addedCount;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('PenaltyManager', `Error al aplicar penalización: ${errorMessage}`);
    return 0;
  }
}; 