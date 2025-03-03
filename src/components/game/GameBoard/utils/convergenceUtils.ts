import { isValidCell } from '../../../../utils/gameUtils';
import logger from '../../../../utils/logger';

/**
 * Encuentra convergencias para una celda específica
 * @param board El tablero actual
 * @param row Fila de la celda
 * @param col Columna de la celda
 * @param size Tamaño del tablero
 * @returns Objeto que indica si hay convergencia y las celdas que convergen
 */
export const findConvergences = (
  board: (string | null)[][], 
  row: number, 
  col: number, 
  size: number
): { hasConvergence: boolean; convergingCells: { row: number; col: number }[] } => {
  // Verificar que la celda tenga un icono
  if (!board[row][col] || typeof board[row][col] !== 'string') {
    logger.debug('findConvergences: celda vacía o inválida [', row + ', ' + col + ']');
    return { hasConvergence: false, convergingCells: [] };
  }
  
  // Ignorar si la celda tiene un icono que ya está siendo eliminado
  const icon = board[row][col];
  if (icon.includes('_removing')) {
    logger.debug('findConvergences: ignorando icono en eliminación', ' [' + row + ', ' + col + '] ' + icon);
    return { hasConvergence: false, convergingCells: [] };
  }
  
  logger.debug('findConvergences: buscando convergencias para ', ' [' + row + ', ' + col + '] ' + icon);
  
  const directions = [
    { dr: -1, dc: 0 }, // arriba
    { dr: 0, dc: 1 },  // derecha
    { dr: 1, dc: 0 },  // abajo
    { dr: 0, dc: -1 }  // izquierda
  ];
  
  // Recolectar iconos por dirección
  const positions: { row: number; col: number }[] = [{ row, col }]; // Incluir la posición actual
  const iconMatches: { [direction: string]: { row: number; col: number }[] } = {};
  
  for (const { dr, dc } of directions) {
    const dirKey = `${dr},${dc}`;
    iconMatches[dirKey] = [];
    
    let r = row + dr;
    let c = col + dc;
    
    // Seguir en esa dirección hasta encontrar un icono o salir del tablero
    while (isValidCell(r, c, size)) {
      // Verificar si encontramos el mismo icono
      if (board[r][c] === icon) {
        const match = { row: r, col: c };
        iconMatches[dirKey].push(match);
        positions.push(match);
        break; // Solo necesitamos encontrar el primer icono en cada dirección
      } else if (board[r][c] !== null) {
        break; // Encontramos un icono diferente, detenemos la búsqueda
      }
      r += dr;
      c += dc;
    }
  }
  
  // Verificar si tenemos al menos 3 iconos iguales (el actual + 2 más)
  const hasConvergence = positions.length >= 3;
  
  if (hasConvergence) {
    logger.debug('findConvergences: convergencia encontrada', 
      `celdas: ${positions.length}, posiciones: ${JSON.stringify(positions)}`
    );
  } else {
    logger.debug('findConvergences: sin convergencia', 
      `celdas: ${positions.length}, direcciones: ${Object.keys(iconMatches).filter(dir => iconMatches[dir].length > 0)}`
    );
  }
  
  return { 
    hasConvergence, 
    convergingCells: hasConvergence ? positions : [] 
  };
};

/**
 * Verifica si una posición tiene convergencia (tres o más iconos iguales)
 * @param board El tablero actual
 * @param row Fila de la celda
 * @param col Columna de la celda
 * @param size Tamaño del tablero
 * @returns true si hay convergencia, false en caso contrario
 */
export const hasConvergence = (
  board: (string | null)[][], 
  row: number, 
  col: number, 
  size: number
): boolean => {
  if (!board[row][col]) return false; // Celda vacía no tiene convergencia
  
  const icon = board[row][col];
  const directions = [
    { dr: -1, dc: 0 }, // arriba
    { dr: 0, dc: 1 },  // derecha
    { dr: 1, dc: 0 },  // abajo
    { dr: 0, dc: -1 }  // izquierda
  ];
  
  // Buscar iconos iguales en direcciones opuestas
  let totalCount = 1; // Incluye el propio icono
  
  for (let i = 0; i < directions.length; i += 2) {
    let count = 0;
    
    // Búsqueda en una dirección
    let r1 = row + directions[i].dr;
    let c1 = col + directions[i].dc;
    while (isValidCell(r1, c1, size) && board[r1][c1] === icon) {
      count++;
      r1 += directions[i].dr;
      c1 += directions[i].dc;
    }
    
    // Búsqueda en dirección opuesta
    let r2 = row + directions[i+1].dr;
    let c2 = col + directions[i+1].dc;
    while (isValidCell(r2, c2, size) && board[r2][c2] === icon) {
      count++;
      r2 += directions[i+1].dr;
      c2 += directions[i+1].dc;
    }
    
    // Si hay al menos 2 iconos adicionales en direcciones opuestas, hay convergencia
    if (count >= 2) {
      return true;
    }
  }
  
  return false;
};

/**
 * Verifica si hay movimientos válidos en el tablero
 * @param currentBoard El tablero actual
 * @param size Tamaño del tablero
 * @param availableIcons Lista de iconos disponibles
 * @param gameStatus Estado del juego
 * @returns true si hay movimientos válidos, false en caso contrario
 */
export const checkValidMoves = (
  currentBoard: (string | null)[][], 
  size: number,
  availableIcons: string[],
  gameStatus: string
): boolean => {
  let hasValidMoves = false;
  
  // Verificar cada celda vacía
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (currentBoard[row][col] === null) {
        // Verificar si colocar un icono aquí generaría una convergencia
        if (isValidPlacement(currentBoard, row, col, size, availableIcons)) {
          hasValidMoves = true;
          return true; // Terminar temprano si encontramos al menos un movimiento válido
        }
      }
    }
  }
  
  // Contar iconos en el tablero
  let iconCount = 0;
  let totalCells = size * size;
  
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (currentBoard[row][col] !== null) {
        iconCount++;
      }
    }
  }
  
  // Si no hay iconos en el tablero, considerar como victoria
  if (iconCount === 0 && gameStatus === 'playing') {
    logger.info('Tablero vacío, nivel completado', ' [' + gameStatus + ']');
    return true;
  }
  
  // Si el tablero está casi lleno y no hay movimientos, considerar victoria
  const occupationPercentage = (iconCount / totalCells) * 100;
  if (!hasValidMoves && occupationPercentage > 80 && gameStatus === 'playing') {
    logger.info(`Tablero casi lleno sin movimientos válidos, ocupación: ${occupationPercentage.toFixed(2)}%`, ' [' + gameStatus + ']');
    return true;
  }
  
  return hasValidMoves;
};

/**
 * Verifica si colocar un icono en una celda podría generar una convergencia
 * @param board El tablero actual
 * @param row Fila de la celda
 * @param col Columna de la celda
 * @param size Tamaño del tablero
 * @param availableIcons Lista de iconos disponibles
 * @returns true si colocar un icono generaría convergencia, false en caso contrario
 */
export const isValidPlacement = (
  board: (string | null)[][], 
  row: number, 
  col: number, 
  size: number,
  availableIcons: string[]
): boolean => {
  // Verificar las cuatro direcciones
  const directions = [
    { dr: -1, dc: 0 }, // arriba
    { dr: 0, dc: 1 },  // derecha
    { dr: 1, dc: 0 },  // abajo
    { dr: 0, dc: -1 }  // izquierda
  ];
  
  // Para cada tipo de icono, comprobar si podría haber convergencia
  const icons = availableIcons;
  
  for (const icon of icons) {
    // Para cada icono, verificar si colocarlo generaría convergencia
    const iconsByDirection: Record<string, boolean> = {};
    let convergingDirections = 0;
    
    for (const { dr, dc } of directions) {
      let r = row + dr;
      let c = col + dc;
      
      // Buscar en esa dirección
      while (isValidCell(r, c, size)) {
        if (board[r][c] !== null) {
          // Si encontramos el mismo icono que estamos probando
          if (board[r][c] === icon) {
            iconsByDirection[`${dr},${dc}`] = true;
            convergingDirections++;
          }
          break;
        }
        r += dr;
        c += dc;
      }
    }
    
    // Si hay al menos 2 direcciones con el mismo icono, es un movimiento válido
    if (convergingDirections >= 2) {
      return true;
    }
  }
  
  return false;
}; 