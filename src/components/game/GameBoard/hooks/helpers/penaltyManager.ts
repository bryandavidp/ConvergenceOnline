import { Dispatch } from 'redux';
import { addIcon } from '../../../../../store/slices/gameSlice';
import logger from '../../../../../utils/logger';
import { audioManager } from '../../../../../utils/audioManager';

/**
 * Función para añadir iconos de penalización al tablero con animaciones mejoradas
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
    
    // Lista para almacenar referencias a las celdas y sus coordenadas
    const cellsToAnimate: { element: HTMLElement, row: number, col: number }[] = [];
    
    // Añadir los iconos al tablero primero
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
    }
    
    // Ahora aplicamos las animaciones con un pequeño retraso
    // para asegurar que Redux haya actualizado el DOM
    setTimeout(() => {
      // Añadir efectos visuales a las celdas después de que se hayan creado los iconos
      for (let i = 0; i < iconsToAdd; i++) {
        const cell = emptyCells[i];
        
        // Crear un closure para mantener la referencia a la celda actual
        const animateCellWithDelay = (cellIndex: number) => {
          setTimeout(() => {
            // Obtener la referencia al elemento DOM después de que el icono exista
            const cellElement = getCellElement(cell.row, cell.col);
            
            if (cellElement) {
              // Eliminar cualquier clase penalty-icon anterior por si acaso
              cellElement.classList.remove('penalty-icon');
              
              // Forzar un reflow del DOM para asegurar que la clase se vuelva a aplicar
              void cellElement.offsetWidth;
              
              // Añadir la clase para la animación
              cellElement.classList.add('penalty-icon');
              
              // Reproducir un sonido adicional por cada icono (opcional)
              if (cellIndex % 2 === 0) {
                audioManager.play("invalidMove");
              }
              
              // Log para confirmar que se aplicó la clase
              logger.info('PenaltyManager', `Aplicando animación a celda [${cell.row},${cell.col}]`);
              
              // Eliminar la clase después para terminar la animación
              const animTimer = setTimeout(() => {
                cellElement.classList.remove('penalty-icon');
              }, 1200); // Reducido de 3500ms a 1200ms para animaciones más cortas
              
              // Registrar el temporizador
              addAnimationTimer(animTimer);
            } else {
              logger.warn('PenaltyManager', `No se encontró el elemento para la celda [${cell.row},${cell.col}]`);
            }
          }, cellIndex * 150); // Reducido de 250ms a 150ms para que aparezcan más rápido
        };
        
        // Ejecutar la función con el índice actual
        animateCellWithDelay(i);
      }
    }, 50); // Reducido de 100ms a 50ms para empezar las animaciones antes
    
    return addedCount;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('PenaltyManager', `Error al aplicar penalización: ${errorMessage}`);
    return 0;
  }
}; 