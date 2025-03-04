import { createLogger } from '../../../../utils/logUtils';

const logger = createLogger('hintUtils');

/**
 * Busca un movimiento válido en el tablero para mostrar como pista
 * @param board El tablero actual
 * @param boardSize Tamaño del tablero
 * @returns Un objeto con la posición de la pista y los iconos convergentes o null si no hay pistas disponibles
 */
export function findHintPosition(
  board: (string | null)[][], 
  boardSize: number
): { row: number; col: number; icons: { row: number; col: number; icon: string }[] } | null {
  // Verificar cada celda vacía
  for (let row = 0; row < boardSize; row++) {
    for (let col = 0; col < boardSize; col++) {
      // Solo verificar celdas vacías
      if (board[row][col] === null) {
        // Buscar iconos que convergen en esta posición
        const convergingIcons = findConvergingIcons(board, row, col, boardSize);
        
        // Si hay al menos 2 iconos del mismo tipo, tenemos una pista
        if (convergingIcons.length >= 2) {
          logger.debug('Encontrada posición para pista', { row, col, iconos: convergingIcons });
          return { row, col, icons: convergingIcons };
        }
      }
    }
  }
  
  // No se encontró ninguna posición para pista
  logger.debug('No se encontró posición para pista');
  return null;
}

/**
 * Encuentra los iconos que convergen en una posición específica
 */
export function findConvergingIcons(
  board: (string | null)[][], 
  row: number, 
  col: number, 
  boardSize: number
): { row: number; col: number; icon: string }[] {
  // Verificar si la celda está vacía
  if (board[row][col] !== null) {
    logger.debug('findConvergingIcons: la celda no está vacía', { row, col });
    return [];
  }
  
  // Direcciones: arriba, derecha, abajo, izquierda
  const directions = [
    { dr: -1, dc: 0 }, // arriba
    { dr: 0, dc: 1 },  // derecha
    { dr: 1, dc: 0 },  // abajo
    { dr: 0, dc: -1 }  // izquierda
  ];
  
  // Mapear iconos por tipo para encontrar convergencias
  const iconsByType: Record<string, { row: number; col: number; icon: string }[]> = {};
  
  // Buscar en las cuatro direcciones
  for (const { dr, dc } of directions) {
    let r = row + dr;
    let c = col + dc;
    
    // Continuar en esa dirección hasta encontrar un icono o salir del tablero
    while (r >= 0 && r < boardSize && c >= 0 && c < boardSize) {
      // Si encontramos un icono en esta dirección
      if (board[r][c] !== null) {
        const icon = board[r][c] as string;
        
        // Inicializar array para este tipo de icono si no existe
        if (!iconsByType[icon]) {
          iconsByType[icon] = [];
        }
        
        // Añadir esta posición
        iconsByType[icon].push({ row: r, col: c, icon });
        
        // Hemos encontrado un icono, no necesitamos seguir en esta dirección
        break;
      }
      
      // Avanzar a la siguiente celda en esta dirección
      r += dr;
      c += dc;
    }
  }
  
  // Encontrar el tipo de icono con más convergencias (al menos 2)
  let bestIcon = '';
  let maxCount = 1; // Necesitamos al menos 2 para convergencia
  
  for (const icon in iconsByType) {
    if (iconsByType[icon].length > maxCount) {
      maxCount = iconsByType[icon].length;
      bestIcon = icon;
    }
  }
  
  // Si encontramos convergencia, devolver los iconos
  if (maxCount >= 2) {
    logger.debug('Convergencia encontrada', { 
      icon: bestIcon, 
      cuenta: maxCount, 
      posiciones: iconsByType[bestIcon] 
    });
    return iconsByType[bestIcon];
  }
  
  // No hay convergencia
  return [];
}

/**
 * Resalta celdas específicas para mostrar una pista
 * @param hintPosition Posición de la celda para mostrar la pista
 * @returns Un array con las celdas a resaltar
 */
export function getHighlightedCells(
  hintPosition: { row: number; col: number; icons: { row: number; col: number; icon: string }[] }
): { row: number; col: number }[] {
  if (!hintPosition) return [];
  
  return hintPosition.icons.map(({ row, col }) => ({ row, col }));
}

/**
 * Verifica si se puede usar una pista
 */
export function canUseHint(
  hintsRemaining: number, 
  hintCooldown: boolean
): boolean {
  return hintsRemaining > 0 && !hintCooldown;
} 