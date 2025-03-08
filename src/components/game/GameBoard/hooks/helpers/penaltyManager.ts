import { Dispatch } from 'redux';
import { addIcon } from '../../../../../store/slices/gameSlice';
import logger from '../../../../../utils/logger';
import { audioManager } from '../../../../../utils/audioManager';

/**
 * Función para añadir iconos de penalización al tablero con animaciones optimizadas
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
    // Reproducir sonido de penalización
    audioManager.play("invalidMove");
    
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
    
    // Añadir los iconos al tablero con una sola iteración
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
      
      // Aplicar animación con pequeño retraso para asegurar que el DOM se actualice
      setTimeout(() => {
        const cellElement = getCellElement(cell.row, cell.col);
        
        if (cellElement) {
          // Asegurarnos de que la celda tiene la clase penalty-icon
          cellElement.classList.add('penalty-icon');
          
          // Añadir un temporizador para eliminar la clase después de que finalice la animación
          const cleanupTimer = setTimeout(() => {
            // Eliminar la clase penalty-icon después de que la animación haya terminado
            // para que el borde desaparezca
            cellElement.classList.remove('penalty-icon');
            
            // Agregamos una clase transitoria para una salida suave
            cellElement.classList.add('penalty-fade-out');
            
            // Eliminamos la clase de transición después de completarse
            const fadeOutTimer = setTimeout(() => {
              cellElement.classList.remove('penalty-fade-out');
            }, 500); // 500ms para la transición
            
            // Registrar también este temporizador
            addAnimationTimer(fadeOutTimer);
            
            logger.info('PenaltyManager', `Animación de penalización completada: [${cell.row},${cell.col}]`);
          }, 2000); // Mantenemos el borde durante 2 segundos
          
          // Registrar el temporizador para limpieza
          addAnimationTimer(cleanupTimer);
        }
      }, 50 * i); // Pequeño retraso escalonado para evitar que todas aparezcan exactamente al mismo tiempo
    }
    
    return addedCount;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('PenaltyManager', `Error al aplicar penalización: ${errorMessage}`);
    return 0;
  }
}; 