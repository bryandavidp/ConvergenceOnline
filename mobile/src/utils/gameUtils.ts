import { Cell, GameDifficulty, GamePlayMode } from '../store/slices/gameSlice';
import { gameIcons, levelConfig } from './theme';

/**
 * Genera un tablero con íconos aleatorios según el nivel
 * @param boardSize Tamaño del tablero (filas y columnas)
 * @param level Nivel actual del juego
 * @returns Un tablero con celdas e íconos
 */
export const generateBoard = (boardSize: number, level: number): Cell[][] => {
  // Obtener configuración del nivel
  const currentLevel = levelConfig[level as keyof typeof levelConfig] || levelConfig[1];
  // Asegurarnos de tener un mínimo de iconos en el tablero (dependiendo del tamaño)
  const minPairs = Math.max(Math.floor(boardSize * boardSize / 4), 6);
  const { iconTypes = 4, pairs = minPairs } = currentLevel;
  
  // Crear tablero vacío
  const board: Cell[][] = [];
  for (let i = 0; i < boardSize; i++) {
    const row: Cell[] = [];
    for (let j = 0; j < boardSize; j++) {
      row.push({
        id: `${i}-${j}`,
        iconId: null,
        row: i,
        col: j,
      });
    }
    board.push(row);
  }
  
  // Seleccionar íconos aleatorios para este nivel
  const levelIcons = selectRandomIcons(iconTypes);
  
  // Colocar pares de íconos en posiciones aleatorias
  const positions = getFlatPositions(boardSize);
  shuffleArray(positions);
  
  // Limitar el número de pares al tamaño del tablero disponible
  // Asegurarnos de poner suficientes pares para que el juego sea jugable
  const maxPairs = Math.min(pairs, Math.floor(positions.length / 2));
  const numPairsToPlace = Math.max(maxPairs, Math.min(minPairs, Math.floor(positions.length / 2)));
  
  console.log(`Generando tablero: Nivel=${level}, Tamaño=${boardSize}, Pares a colocar=${numPairsToPlace}, Posiciones disponibles=${positions.length}`);
  
  // Colocar los pares en el tablero
  let pairsPlaced = 0;
  for (let i = 0; i < numPairsToPlace && i * 2 + 1 < positions.length; i++) {
    const iconIndex = i % iconTypes;
    const iconId = levelIcons[iconIndex];
    
    // Posiciones para el par
    const pos1 = positions[i * 2];
    const pos2 = positions[i * 2 + 1];
    
    if (pos1 && pos2) {
      board[pos1.row][pos1.col].iconId = iconId;
      board[pos2.row][pos2.col].iconId = iconId;
      pairsPlaced++;
    }
  }
  
  console.log(`Pares colocados: ${pairsPlaced}`);
  
  // Verificar que el tablero tiene al menos un ícono
  const hasIcons = board.flat().some(cell => cell.iconId !== null);
  if (!hasIcons) {
    console.warn('¡ADVERTENCIA! Se generó un tablero sin íconos. Añadiendo un par forzado.');
    if (board.length > 0 && board[0].length > 0) {
      board[0][0].iconId = levelIcons[0];
      if (board.length > 1 && board[1].length > 0) {
        board[1][0].iconId = levelIcons[0];
      } else if (board[0].length > 1) {
        board[0][1].iconId = levelIcons[0];
      }
    }
  }
  
  // Contar cuántos iconos se colocaron
  const iconCount = getRemainingIcons(board);
  console.log(`Tablero generado para nivel ${level}. Iconos colocados: ${iconCount}`);
  
  // Verificación de seguridad: si no hay iconos, volver a intentar
  if (iconCount === 0) {
    console.error("Error crítico: tablero generado sin iconos a pesar de failsafe. Regenerando...");
    return generateBoard(boardSize, level);
  }
  
  return board;
};

/**
 * Selecciona íconos aleatorios del conjunto disponible
 * @param count Número de íconos a seleccionar
 * @returns Array de índices de íconos seleccionados
 */
export const selectRandomIcons = (count: number): number[] => {
  const availableIcons = [...Array(gameIcons.length).keys()]; // [0, 1, 2, ...] índices de íconos
  shuffleArray(availableIcons);
  return availableIcons.slice(0, count);
};

/**
 * Obtiene todas las posiciones posibles en el tablero como array plano
 * @param boardSize Tamaño del tablero
 * @returns Array de posiciones {row, col}
 */
export const getFlatPositions = (boardSize: number): { row: number; col: number }[] => {
  const positions: { row: number; col: number }[] = [];
  for (let i = 0; i < boardSize; i++) {
    for (let j = 0; j < boardSize; j++) {
      positions.push({ row: i, col: j });
    }
  }
  return positions;
};

/**
 * Mezcla un array aleatoriamente (algoritmo Fisher-Yates)
 * @param array Array a mezclar
 */
export const shuffleArray = <T>(array: T[]): void => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
};

/**
 * Verifica si dos celdas forman una coincidencia válida
 * @param cell1 Primera celda
 * @param cell2 Segunda celda
 * @returns true si las celdas coinciden (mismo iconId)
 */
export const isMatch = (cell1: Cell, cell2: Cell): boolean => {
  return (
    cell1.id !== cell2.id && 
    cell1.iconId !== null && 
    cell2.iconId !== null && 
    cell1.iconId === cell2.iconId
  );
};

/**
 * Encuentra todas las coincidencias potenciales en el tablero
 * @param board El tablero de juego
 * @returns Array de pares de celdas que coinciden
 */
export const findAllMatches = (board: Cell[][]): { cell1: Cell; cell2: Cell }[] => {
  const matches: { cell1: Cell; cell2: Cell }[] = [];
  const cells = board.flat().filter(cell => cell.iconId !== null);
  
  // Comparar cada celda con las demás para encontrar coincidencias
  for (let i = 0; i < cells.length; i++) {
    for (let j = i + 1; j < cells.length; j++) {
      if (isMatch(cells[i], cells[j])) {
        matches.push({ cell1: cells[i], cell2: cells[j] });
      }
    }
  }
  
  return matches;
};

/**
 * Encuentra una coincidencia aleatoria en el tablero (para pistas)
 * @param board El tablero de juego
 * @returns Un par de celdas que coinciden, o null si no hay coincidencias
 */
export const findRandomMatch = (board: Cell[][]): { cell1: Cell; cell2: Cell } | null => {
  const matches = findAllMatches(board);
  if (matches.length === 0) {
    return null;
  }
  
  // Seleccionar una coincidencia aleatoria
  const randomIndex = Math.floor(Math.random() * matches.length);
  return matches[randomIndex];
};

/**
 * Calcula el número de íconos restantes en el tablero
 * @param board El tablero de juego
 * @returns Número de íconos restantes
 */
export const getRemainingIcons = (board: Cell[][]): number => {
  return board.flat().filter(cell => cell.iconId !== null).length;
};

/**
 * Calcula la puntuación por eliminar un par según el nivel y dificultad
 * @param level Nivel actual
 * @param difficultyMultiplier Multiplicador de dificultad
 * @returns Puntuación base para el par
 */
export const getMatchScore = (level: number, difficultyMultiplier: number = 1): number => {
  const baseScore = 10;
  const levelBonus = level * 2;
  return Math.floor((baseScore + levelBonus) * difficultyMultiplier);
};

/**
 * Obtiene un ícono por su ID
 * @param iconId ID del ícono
 * @returns El ícono correspondiente o string vacío si no existe
 */
export const getIconById = (iconId: number | null): string => {
  if (iconId === null || iconId < 0 || iconId >= gameIcons.length) {
    return '';
  }
  return gameIcons[iconId];
};

/**
 * Formatea el tiempo para mostrar (mm:ss)
 * @param seconds Tiempo en segundos
 * @returns Tiempo formateado como string
 */
export const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Verifica si una celda vacía es convergente con íconos en el tablero.
 * Una celda es convergente cuando está en la misma fila o columna que 
 * al menos dos íconos del mismo tipo.
 * 
 * @param board Tablero de juego
 * @param cell Celda vacía a verificar
 * @returns Mapa de convergencias por tipo de ícono
 */
export const checkCellConvergence = (board: Cell[][], cell: Cell): Map<number, Cell[]> => {
  if (cell.iconId !== null) {
    return new Map(); // La celda no está vacía, no puede haber convergencia
  }
  
  const convergenceMap = new Map<number, Cell[]>();
  const { row, col } = cell;
  
  // Verificar convergencia en la misma fila
  const rowCells = board[row].filter(c => c.iconId !== null && c.id !== cell.id);
  
  // Verificar convergencia en la misma columna
  const colCells = board.map(r => r[col]).filter(c => c.iconId !== null && c.id !== cell.id);
  
  // Combinar celdas de fila y columna
  const allCells = [...rowCells, ...colCells];
  
  // Agrupar por tipo de ícono
  allCells.forEach(c => {
    if (c.iconId !== null) {
      if (!convergenceMap.has(c.iconId)) {
        convergenceMap.set(c.iconId, []);
      }
      convergenceMap.get(c.iconId)?.push(c);
    }
  });
  
  // Filtrar para mantener solo los grupos de 2 o más del mismo ícono
  for (const [iconId, cells] of convergenceMap.entries()) {
    if (cells.length < 2) {
      convergenceMap.delete(iconId);
    }
  }
  
  return convergenceMap;
};

/**
 * Encuentra todas las celdas vacías que son convergentes en el tablero.
 * 
 * @param board Tablero de juego
 * @returns Mapa de celdas convergentes por posición
 */
export const findAllConvergentCells = (board: Cell[][]): Map<string, Map<number, Cell[]>> => {
  const convergentCells = new Map<string, Map<number, Cell[]>>();
  
  // Iterar sobre todas las celdas vacías
  board.forEach(row => {
    row.forEach(cell => {
      if (cell.iconId === null) {
        const convergence = checkCellConvergence(board, cell);
        if (convergence.size > 0) {
          convergentCells.set(cell.id, convergence);
        }
      }
    });
  });
  
  return convergentCells;
};

/**
 * Procesa la eliminación de íconos convergentes en una celda vacía.
 * 
 * @param board Tablero de juego
 * @param cell Celda vacía donde se produce la convergencia
 * @param iconIdToRemove ID del ícono a eliminar (si hay varios tipos convergentes)
 * @returns Número de íconos eliminados y tablero actualizado
 */
export const processConvergence = (
  board: Cell[][], 
  cell: Cell,
  iconIdToRemove?: number
): { 
  removedCount: number, 
  updatedBoard: Cell[][], 
  removedCells: Cell[] 
} => {
  // Verificar convergencias en la celda
  const convergenceMap = checkCellConvergence(board, cell);
  
  if (convergenceMap.size === 0) {
    return { removedCount: 0, updatedBoard: board, removedCells: [] };
  }
  
  // Si no se especificó un iconId y hay múltiples opciones, usar el primero
  const iconId = iconIdToRemove ?? Array.from(convergenceMap.keys())[0];
  
  if (!convergenceMap.has(iconId)) {
    return { removedCount: 0, updatedBoard: board, removedCells: [] };
  }
  
  // Obtener las celdas a eliminar
  const cellsToRemove = convergenceMap.get(iconId) || [];
  const removedCount = cellsToRemove.length;
  
  // Clonar el tablero para no modificar el original
  const updatedBoard = board.map(row => row.map(c => ({ ...c })));
  
  // Eliminar los íconos (poner iconId a null)
  cellsToRemove.forEach(cellToRemove => {
    const { row, col } = cellToRemove;
    updatedBoard[row][col].iconId = null;
  });
  
  return { 
    removedCount, 
    updatedBoard,
    removedCells: cellsToRemove
  };
};

/**
 * Genera puntuación basada en el número de íconos eliminados, nivel y dificultad
 * 
 * @param removedCount Número de íconos eliminados
 * @param level Nivel actual
 * @param difficultyMultiplier Multiplicador de dificultad
 * @returns Puntuación obtenida
 */
export const getConvergenceScore = (
  removedCount: number, 
  level: number, 
  difficultyMultiplier: number = 1
): number => {
  // Puntuación base por ícono eliminado
  const baseScorePerIcon = 5;
  
  // Puntuación extra por eliminar más de 2 íconos a la vez
  const bonusMultiplier = removedCount > 2 ? (removedCount - 1) : 1;
  
  // Aplicar nivel y dificultad
  const levelBonus = level * 0.5;
  
  return Math.floor((baseScorePerIcon * removedCount * bonusMultiplier * (1 + levelBonus)) * difficultyMultiplier);
};

/**
 * Verifica si hay movimientos disponibles en el tablero
 * 
 * @param board Tablero de juego
 * @returns true si hay al menos una celda convergente
 */
export const hasAvailableMoves = (board: Cell[][]): boolean => {
  const convergentCells = findAllConvergentCells(board);
  return convergentCells.size > 0;
};

/**
 * Encuentra una pista (celda convergente) aleatoria en el tablero
 * 
 * @param board Tablero de juego
 * @returns Celda con convergencia o null si no hay
 */
export const findRandomHint = (board: Cell[][]): { 
  cell: Cell, 
  iconId: number, 
  convergingCells: Cell[] 
} | null => {
  const convergentCells = findAllConvergentCells(board);
  
  if (convergentCells.size === 0) {
    return null;
  }
  
  // Obtener celdas convergentes como array
  const cellIds = Array.from(convergentCells.keys());
  const randomCellId = cellIds[Math.floor(Math.random() * cellIds.length)];
  
  // Encontrar la celda correspondiente
  const cellParts = randomCellId.split('-');
  const row = parseInt(cellParts[0]);
  const col = parseInt(cellParts[1]);
  const cell = board[row][col];
  
  // Obtener un tipo de ícono convergente aleatorio
  const convergenceMap = convergentCells.get(randomCellId);
  if (!convergenceMap || convergenceMap.size === 0) {
    return null;
  }
  
  const iconIds = Array.from(convergenceMap.keys());
  const randomIconId = iconIds[Math.floor(Math.random() * iconIds.length)];
  const convergingCells = convergenceMap.get(randomIconId) || [];
  
  return {
    cell,
    iconId: randomIconId,
    convergingCells
  };
};

/**
 * Define el multiplicador de puntuación según dificultad
 * @param difficulty Nivel de dificultad
 * @returns Multiplicador de puntuación
 */
export const getDifficultyMultiplier = (difficulty: GameDifficulty): number => {
  switch (difficulty) {
    case GameDifficulty.EASY: return 0.8;
    case GameDifficulty.MEDIUM: return 1.0;
    case GameDifficulty.HARD: return 1.5;
    case GameDifficulty.EXPERT: return 2.0;
    default: return 1.0;
  }
};

/**
 * Obtiene el tiempo inicial para un nivel en modo contrarreloj
 * @param level Nivel actual
 * @param difficulty Dificultad
 * @returns Tiempo en segundos
 */
export const getInitialTimeForLevel = (level: number, difficulty: GameDifficulty): number => {
  // Tiempo base según nivel
  let baseTime = 180 - ((level - 1) * 10);
  
  // Ajuste según dificultad
  switch (difficulty) {
    case GameDifficulty.EASY:
      baseTime += 60;
      break;
    case GameDifficulty.HARD:
      baseTime -= 30;
      break;
    case GameDifficulty.EXPERT:
      baseTime -= 60;
      break;
  }
  
  // Nunca menos de 60 segundos
  return Math.max(60, baseTime);
};

/**
 * Obtiene el ritmo de aparición de nuevos iconos para Modo Supervivencia
 * @param level Nivel actual
 * @param difficulty Dificultad
 * @returns Milisegundos entre apariciones
 */
export const getSpawnRate = (level: number, difficulty: GameDifficulty): number => {
  // Tasa base según nivel (menor = más rápido)
  const baseRate = 5000 - ((level - 1) * 200);
  
  // Ajuste según dificultad
  let difficultyAdjustment = 0;
  switch (difficulty) {
    case GameDifficulty.EASY:
      difficultyAdjustment = 1000;
      break;
    case GameDifficulty.HARD:
      difficultyAdjustment = -1000;
      break;
    case GameDifficulty.EXPERT:
      difficultyAdjustment = -1500;
      break;
  }
  
  // Limitar a un mínimo de 1000ms
  return Math.max(1000, baseRate + difficultyAdjustment);
};

/**
 * Encuentra una posición vacía aleatoria en el tablero
 * @param board Tablero actual
 * @returns Posición {row, col} o null si no hay celdas vacías
 */
export const findRandomEmptyCell = (board: Cell[][]): { row: number, col: number } | null => {
  const emptyCells: { row: number, col: number }[] = [];
  
  // Recopilar todas las celdas vacías
  board.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      if (cell.iconId === null) {
        emptyCells.push({ row: rowIndex, col: colIndex });
      }
    });
  });
  
  // Si no hay celdas vacías, devolver null
  if (emptyCells.length === 0) {
    return null;
  }
  
  // Seleccionar una celda vacía aleatoria
  const randomIndex = Math.floor(Math.random() * emptyCells.length);
  return emptyCells[randomIndex];
};

/**
 * Añade un nuevo icono aleatorio al tablero en una posición aleatoria
 * @param board Tablero actual
 * @param iconTypes Número de tipos de iconos disponibles
 * @returns Tablero actualizado o null si no se puede añadir
 */
export const addRandomIcon = (board: Cell[][], iconTypes: number): Cell[][] | null => {
  // Buscar celda vacía
  const emptyCell = findRandomEmptyCell(board);
  if (!emptyCell) {
    return null; // No hay celdas vacías
  }
  
  // Seleccionar un icono aleatorio
  const iconPool = selectRandomIcons(iconTypes);
  const randomIconId = iconPool[Math.floor(Math.random() * iconPool.length)];
  
  // Crear una copia del tablero y añadir el icono
  const updatedBoard = board.map(row => [...row]);
  updatedBoard[emptyCell.row][emptyCell.col] = {
    ...board[emptyCell.row][emptyCell.col],
    iconId: randomIconId
  };
  
  return updatedBoard;
};

/**
 * Verifica si el tablero está lleno (sin celdas vacías)
 * @param board Tablero actual
 * @returns true si el tablero está lleno
 */
export const isBoardFull = (board: Cell[][]): boolean => {
  return board.every(row => row.every(cell => cell.iconId !== null));
};

/**
 * Calcula los requisitos para pasar al siguiente nivel
 * @param level Nivel actual
 * @param playMode Modo de juego
 * @returns Objeto con requisitos (puntuación, iconos eliminados, etc.)
 */
export const getLevelRequirements = (level: number, playMode: GamePlayMode): {
  scoreRequired: number;
  iconsRequired: number;
} => {
  const baseScoreRequired = level * 50;
  const baseIconsRequired = level * 10;
  
  let scoreMultiplier = 1.0;
  let iconsMultiplier = 1.0;
  
  switch (playMode) {
    case GamePlayMode.TIMED:
      scoreMultiplier = 0.8; // Más fácil en contrarreloj
      iconsMultiplier = 0.8;
      break;
    case GamePlayMode.COMPETITIVE:
      scoreMultiplier = 1.2; // Más difícil en modo competitivo
      iconsMultiplier = 1.2;
      break;
  }
  
  return {
    scoreRequired: Math.floor(baseScoreRequired * scoreMultiplier),
    iconsRequired: Math.floor(baseIconsRequired * iconsMultiplier)
  };
}; 