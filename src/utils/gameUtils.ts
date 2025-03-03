// src/utils/gameUtils.ts
// Utilidades para el juego de Convergencia

/**
 * Verifica si una celda está dentro de los límites del tablero
 * @param row Fila de la celda
 * @param col Columna de la celda
 * @param boardSize Tamaño del tablero
 * @returns true si la celda es válida, false en caso contrario
 */
export const isValidCell = (row: number, col: number, boardSize: number): boolean => {
  return row >= 0 && row < boardSize && col >= 0 && col < boardSize;
};

/**
 * Genera un número entero aleatorio entre min (inclusive) y max (exclusive)
 * @param min Valor mínimo (inclusive)
 * @param max Valor máximo (exclusive)
 * @returns Número entero aleatorio
 */
export const getRandomInt = (min: number, max: number): number => {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min)) + min;
};

/**
 * Mezcla un array utilizando el algoritmo Fisher-Yates
 * @param array Array a mezclar
 * @returns El mismo array mezclado
 */
export const shuffleArray = <T>(array: T[]): T[] => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

/**
 * Calcula la puntuación para una convergencia
 * @param iconCount Número de iconos convergentes
 * @param level Nivel actual
 * @param timeRemaining Tiempo restante (para modos con tiempo)
 * @returns Puntuación calculada
 */
export const calculateScore = (iconCount: number, level: number, timeRemaining: number = 0): number => {
  // Puntuación base por cada icono
  const baseScore = iconCount * 10;
  
  // Multiplicador por nivel
  const levelMultiplier = 1 + (level * 0.1);
  
  // Bonus por tiempo restante (solo para modos con tiempo)
  const timeBonus = timeRemaining > 0 ? timeRemaining * 0.5 : 0;
  
  return Math.floor(baseScore * levelMultiplier + timeBonus);
};

/**
 * Formatea el tiempo en formato mm:ss
 * @param seconds Tiempo en segundos
 * @returns Tiempo formateado
 */
export const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Verifica si hay movimientos posibles en el tablero
 * @param board Tablero actual
 * @param boardSize Tamaño del tablero
 * @returns true si hay movimientos posibles, false en caso contrario
 */
export const hasValidMoves = (board: (string | null)[][], boardSize: number): boolean => {
  // Para cada celda vacía, verificar si hay convergencia posible
  for (let row = 0; row < boardSize; row++) {
    for (let col = 0; col < boardSize; col++) {
      if (board[row][col] === null) {
        // Verificar las cuatro direcciones
        const iconsByType: Record<string, number> = {};
        
        // Direcciones: arriba, derecha, abajo, izquierda
        const directions = [
          { dr: -1, dc: 0 },  // Arriba
          { dr: 0, dc: 1 },   // Derecha
          { dr: 1, dc: 0 },   // Abajo
          { dr: 0, dc: -1 },  // Izquierda
        ];
        
        for (const { dr, dc } of directions) {
          let r = row + dr;
          let c = col + dc;
          
          // Seguir en esa dirección hasta encontrar un icono o salir del tablero
          while (isValidCell(r, c, boardSize)) {
            if (board[r][c] !== null) {
              const icon = board[r][c] as string;
              iconsByType[icon] = (iconsByType[icon] || 0) + 1;
              break;
            }
            r += dr;
            c += dc;
          }
        }
        
        // Verificar si hay algún tipo de icono con más de una ocurrencia
        for (const icon in iconsByType) {
          if (iconsByType[icon] > 1) {
            return true;
          }
        }
      }
    }
  }
  
  return false;
};

/**
 * Calcula el porcentaje de ocupación del tablero
 * @param iconCount Número de iconos en el tablero
 * @param boardSize Tamaño del tablero
 * @returns Porcentaje de ocupación (0-100)
 */
export const calculateBoardOccupation = (iconCount: number, boardSize: number): number => {
  const boardCapacity = boardSize * boardSize;
  return Math.round((iconCount / boardCapacity) * 100);
}; 