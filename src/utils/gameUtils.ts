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

/**
 * Calcula la velocidad inicial para un nivel específico según el modo de juego
 */
export const calculateInitialSpeedForLevel = (levelNum: number, mode: string, 
  gameModesConfig: any, minSpawnRate: number = 300): number => {
    
  const modeConfig = mode.toUpperCase() === 'CLASSIC' 
    ? gameModesConfig.CLASSIC
    : mode.toUpperCase() === 'TIMED'
      ? gameModesConfig.TIMED
      : gameModesConfig.SURVIVAL;
  
  const baseSpeed = modeConfig.initialSpawnRate;
  let levelReduction = 0;
  
  if (levelNum <= 2) {
    levelReduction = 0;
  } else if (levelNum <= 4) {
    levelReduction = 0.15;
  } else {
    levelReduction = 0.25;
  }
  
  return Math.round(Math.max(minSpawnRate, baseSpeed * (1 - levelReduction)));
};

/**
 * Verifica si hay movimientos válidos en el tablero
 */
export const checkBoardForValidMoves = (
  board: (string | null)[][],
  size: number, 
  availableIcons: string[]
): boolean => {
  // Comprobaciones de seguridad
  if (!board || !Array.isArray(board) || board.length === 0 || 
      !availableIcons || availableIcons.length === 0 || size <= 0) {
    return false;
  }
  
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      // Verificar que la celda actual existe y está vacía
      if (!board[row] || board[row][col] !== null) {
        continue;
      }
      
      if (isValidPlacement(board, row, col, size, availableIcons)) {
        return true;
      }
    }
  }
  
  return false;
};

/**
 * Verifica si una celda podría generar una convergencia
 */
export const isValidPlacement = (
  board: (string | null)[][], 
  row: number, 
  col: number, 
  size: number,
  availableIcons: string[]
): boolean => {
  // Comprobación de seguridad para evitar errores
  if (!board || !availableIcons || availableIcons.length === 0 || size <= 0) {
    return false;
  }
  
  const directions = [
    { dr: -1, dc: 0 }, // arriba
    { dr: 0, dc: 1 },  // derecha
    { dr: 1, dc: 0 },  // abajo
    { dr: 0, dc: -1 }  // izquierda
  ];
  
  for (const icon of availableIcons) {
    let convergingDirections = 0;
    const iconsByDirection: Record<string, boolean> = {};
    
    for (const { dr, dc } of directions) {
      let r = row + dr;
      let c = col + dc;
      
      while (isValidCell(r, c, size)) {
        // Comprobación adicional para evitar acceso a undefined
        if (!board[r] || board[r][c] === undefined) {
          break; // Salir del bucle si la fila no existe o la celda es undefined
        }
        
        if (board[r][c] !== null) {
          if (board[r][c] === icon) {
            const dirKey = `${dr},${dc}`;
            iconsByDirection[dirKey] = true;
            convergingDirections++;
            
            if (convergingDirections >= 2) {
              return true;
            }
          }
          break;
        }
        
        r += dr;
        c += dc;
      }
    }
  }
  
  return false;
};

/**
 * Encuentra convergencias en un tablero (iconos iguales alineados)
 */
export const findConvergences = (
  board: (string | null)[][], 
  row: number, 
  col: number, 
  size: number
): { hasConvergence: boolean; convergingCells: { row: number; col: number }[] } => {
  if (!board[row][col] || typeof board[row][col] !== 'string') {
    return { hasConvergence: false, convergingCells: [] };
  }
  
  const icon = board[row][col];
  if (icon.includes('_removing')) {
    return { hasConvergence: false, convergingCells: [] };
  }
  
  const directions = [
    { dr: -1, dc: 0 }, // arriba
    { dr: 0, dc: 1 },  // derecha
    { dr: 1, dc: 0 },  // abajo
    { dr: 0, dc: -1 }  // izquierda
  ];
  
  const positions: { row: number; col: number }[] = [{ row, col }];
  const iconMatches: { [direction: string]: { row: number; col: number }[] } = {};
  
  for (const { dr, dc } of directions) {
    const dirKey = `${dr},${dc}`;
    iconMatches[dirKey] = [];
    
    let r = row + dr;
    let c = col + dc;
    
    while (isValidCell(r, c, size)) {
      if (board[r][c] === icon) {
        const match = { row: r, col: c };
        iconMatches[dirKey].push(match);
        positions.push(match);
        break;
      } else if (board[r][c] !== null) {
        break;
      }
      r += dr;
      c += dc;
    }
  }
  
  const hasConvergence = positions.length >= 3;
  
  return { 
    hasConvergence, 
    convergingCells: hasConvergence ? positions : [] 
  };
};

/**
 * Encuentra iconos que convergerían si se colocara un icono en una posición específica
 */
export const findConvergingIcons = (
  board: (string | null)[][],
  row: number, 
  col: number, 
  boardSize: number
): { row: number; col: number }[] => {
  if (board[row][col] !== null) {
    return [];
  }
  
  const iconsByType: { [icon: string]: { row: number; col: number }[] } = {};
  
  const directions = [
    { dr: -1, dc: 0 }, // arriba
    { dr: 1, dc: 0 },  // abajo
    { dr: 0, dc: -1 }, // izquierda
    { dr: 0, dc: 1 }   // derecha
  ];
  
  // Buscar los primeros iconos en cada dirección
  for (const { dr, dc } of directions) {
    let r = row + dr;
    let c = col + dc;
    
    while (isValidCell(r, c, boardSize)) {
      const currentIcon = board[r][c];
      if (currentIcon !== null) {
        if (currentIcon.includes('_removing')) break;
        
        if (!iconsByType[currentIcon]) {
          iconsByType[currentIcon] = [];
        }
        
        iconsByType[currentIcon].push({ row: r, col: c });
        break;
      }
      r += dr;
      c += dc;
    }
  }
  
  // Recopilar todos los iconos de tipos que tienen al menos 2 del mismo tipo
  const convergingIcons: { row: number; col: number }[] = [];
  
  for (const icon in iconsByType) {
    if (iconsByType[icon].length >= 2) {
      convergingIcons.push(...iconsByType[icon]);
    }
  }
  
  return convergingIcons;
};

/**
 * Coloca iconos de penalización en el tablero cuando el usuario hace un clic incorrecto
 * @param board El tablero actual
 * @param size Tamaño del tablero
 * @param availableIcons Iconos disponibles
 * @param count Número de iconos a colocar
 * @returns Un array con las posiciones donde se colocaron los iconos de penalización
 */
export const placePenaltyIcons = (
  board: (string | null)[][], 
  size: number, 
  availableIcons: string[],
  count: number
): { row: number, col: number, icon: string }[] => {
  // Si no hay iconos o el tablero es inválido, retornar un array vacío
  if (!board || !board.length || !availableIcons || !availableIcons.length || count <= 0) {
    return [];
  }
  
  const placedIcons: { row: number, col: number, icon: string }[] = [];
  const emptyCells: { row: number, col: number }[] = [];
  
  // Encontrar todas las celdas vacías
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (board[row] && board[row][col] === null) {
        emptyCells.push({ row, col });
      }
    }
  }
  
  // Si no hay celdas vacías, retornar array vacío
  if (emptyCells.length === 0) {
    return [];
  }
  
  // Colocar la cantidad de iconos solicitada o tantos como haya celdas vacías disponibles
  const iconsToPlace = Math.min(count, emptyCells.length);
  
  // Mezclar las celdas vacías para selección aleatoria
  shuffleArray(emptyCells);
  
  // Colocar los iconos
  for (let i = 0; i < iconsToPlace; i++) {
    const cell = emptyCells[i];
    const randomIcon = availableIcons[Math.floor(Math.random() * availableIcons.length)];
    
    // No modificamos el tablero aquí, solo devolvemos las posiciones
    placedIcons.push({
      row: cell.row,
      col: cell.col,
      icon: randomIcon
    });
  }
  
  return placedIcons;
}; 