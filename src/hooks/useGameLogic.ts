import { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { 
  incrementScore, 
  updateBoard, 
  setIconCount,
  setGameStatus,
  setSpawnRate,
  incrementTimer,
  increaseSpeed,
  useHint,
  resetHintCooldown,
  setHighlightedCells,
  GameState,
  setAvailableIcons,
  setLevel,
  setBoardSize,
  setLevelTarget,
  setLevelTimeLimit,
  addTimeBonus,
  decrementTimeRemaining,
  rechargeHint
} from '../store/slices/gameSlice';
import { RootState } from '../store';
import { store } from '../store';
import { createLogger } from '../utils/logUtils';
import * as config from '../utils/config';
import * as gameConfig from '../config/gameConfig';
import { isValidCell, getRandomInt, shuffleArray } from '../utils/gameUtils';
import { audioManager } from '../utils/audioManager';
import { 
  adjustBoardVisuals,
  changeSpawnRate,
  configureBoardForLevel
} from '../utils/boardUtils';

// Crear un logger específico para este hook
const logger = createLogger('useGameLogic');

// Constantes para la configuración (si no están definidas en gameConfig)
const MIN_SPAWN_RATE = 800; // ms - Velocidad máxima (valores más bajos = más rápido)
const SPAWN_RATE_STEP = 100; // ms - Cuánto aumenta la velocidad en cada paso
const SPAWN_RATE_INCREASE_INTERVAL = 8000; // ms - Cada cuánto aumenta la velocidad
const INITIAL_ICONS = 5; // Número de iconos iniciales al comenzar el juego

// Funciones de ayuda para determinar el modo de juego actual
const isTimedMode = () => {
  const state = store.getState().game;
  return state.currentPlayMode === 'timed';
};

const isClassicMode = () => {
  const state = store.getState().game;
  return state.currentPlayMode === 'classic';
};

const isSurvivalMode = () => {
  const state = store.getState().game;
  return state.currentPlayMode === 'survival';
};

const useGameLogic = () => {
  const dispatch = useDispatch();
  const { 
    board, 
    iconCount, 
    status, 
    spawnRate, 
    boardSize, 
    availableIcons,
    currentPlayMode,
    score,
    level,
    highlightedCells,
    hintsRemaining,
    hintCooldown,
    lastHintTime
  } = useSelector((state: RootState) => state.game);
  
  // Referencias para los intervalos de tiempo
  const spawnTimerRef = useRef<NodeJS.Timeout | null>(null);
  const speedIncreaseTimerRef = useRef<NodeJS.Timeout | null>(null);
  const gameTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hintTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Referencias para las celdas del tablero (DOM)
  const cellRefs = useRef<Record<string, HTMLElement>>({});
  
  // Referencia para controlar si los temporizadores están activos
  const timersActiveRef = useRef<boolean>(false);
  
  // Referencia para marcar si el tablero ha sido inicializado
  const isInitializedRef = useRef<boolean>(false);
  
  // Referencias para controlar los temporizadores
  const iconTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Referencia para controlar si estamos eliminando iconos
  const isRemovingIconsRef = useRef<boolean>(false);
  
  // Registrar referencia para una celda
  const registerCellRef = useCallback((row: number, col: number, element: HTMLElement | null) => {
    const key = `${row}-${col}`;
    if (element) {
      cellRefs.current[key] = element;
    } else {
      delete cellRefs.current[key];
    }
  }, []);
  
  // Obtener el elemento DOM para una celda
  const getCellElement = useCallback((row: number, col: number) => {
    const key = `${row}-${col}`;
    return cellRefs.current[key] || null;
  }, []);
  
  // Verificar si hay movimientos válidos en el tablero
  const checkValidMoves = useCallback((currentBoard: (string | null)[][], size: number) => {
    let hasValidMoves = false;
    
    // Verificar cada celda vacía
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        if (currentBoard[row][col] === null) {
          // Verificar si colocar un icono aquí generaría una convergencia
          if (isValidPlacement(currentBoard, row, col, size)) {
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
    if (iconCount === 0 && status === 'playing') {
      logger.info('Tablero vacío, nivel completado');
      dispatch(setGameStatus('levelCompleted'));
      return true;
    }
    
    // Si el tablero está casi lleno y no hay movimientos, considerar victoria
    const occupationPercentage = (iconCount / totalCells) * 100;
    if (!hasValidMoves && occupationPercentage > 80 && status === 'playing') {
      logger.info('Tablero casi lleno sin movimientos válidos, nivel completado', {
        ocupación: occupationPercentage.toFixed(2) + '%'
      });
      dispatch(setGameStatus('levelCompleted'));
      return true;
    }
    
    return hasValidMoves;
  }, [dispatch, status]);
  
  // Verificar si una celda podría generar una convergencia
  const isValidPlacement = useCallback((board: (string | null)[][], row: number, col: number, size: number) => {
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
  }, [availableIcons]);
  
  // Detectar si hay movimientos válidos
  const hasValidMoves = useCallback(() => {
    if (!board || board.length === 0) return false;
    
    return checkValidMoves(board, boardSize);
  }, [board, boardSize, checkValidMoves]);
  
  // Buscar convergencias en un tablero
  const findConvergences = useCallback((
    board: (string | null)[][], 
    row: number, 
    col: number, 
    size: number
  ): { hasConvergence: boolean; convergingCells: { row: number; col: number }[] } => {
    // Verificar que la celda tenga un icono
    if (!board[row][col] || typeof board[row][col] !== 'string') {
      logger.debug('findConvergences: celda vacía o inválida', { row, col });
      return { hasConvergence: false, convergingCells: [] };
    }
    
    // Ignorar si la celda tiene un icono que ya está siendo eliminado
    const icon = board[row][col];
    if (icon.includes('_removing')) {
      logger.debug('findConvergences: ignorando icono en eliminación', { row, col, icon });
      return { hasConvergence: false, convergingCells: [] };
    }
    
    logger.debug('findConvergences: buscando convergencias para', { row, col, icon });
    
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
      logger.debug('findConvergences: convergencia encontrada', { 
        celdas: positions.length,
        posiciones: positions 
      });
    } else {
      logger.debug('findConvergences: sin convergencia', { 
        celdas: positions.length,
        direcciones: Object.keys(iconMatches).filter(dir => iconMatches[dir].length > 0)
      });
    }
    
    return { 
      hasConvergence, 
      convergingCells: hasConvergence ? positions : [] 
    };
  }, []);

  // Verificar si una posición tiene convergencia (tres o más iconos iguales)
  const hasConvergence = useCallback((board: (string | null)[][], row: number, col: number, size: number) => {
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
  }, []);

  // Forzar la creación de un movimiento válido
  const findValidInitialPositions = useCallback(() => {
    // Mapear el tablero a un array bidimensional para facilitar su manipulación
    const boardArray = Array(boardSize).fill(null).map(() => Array(boardSize).fill(null));
    
    // Verificar que tenemos suficientes iconos disponibles
    if (availableIcons.length < 4) {
      logger.error('No hay suficientes iconos disponibles para crear un tablero inicial válido');
      return [];
    }
    
    // Seleccionar dos iconos diferentes aleatorios
    const shuffledIcons = shuffleArray([...availableIcons]);
    const icon1 = shuffledIcons[0];
    const icon2 = shuffledIcons[1];
    
    // Generar posiciones aleatorias para los iconos
    const positions: Array<{ row: number; col: number; icon: string }> = [];
    
    // Intentar crear una configuración válida (con al menos 3 iconos iguales en patrón de convergencia)
    
    // 1. Colocar dos iconos iguales en posiciones que puedan generar convergencia
    const directions = [
      { dr: -1, dc: 0 }, // arriba
      { dr: 0, dc: 1 },  // derecha
      { dr: 1, dc: 0 },  // abajo
      { dr: 0, dc: -1 }  // izquierda
    ];
    
    // Encontrar un punto central válido
    const centerRow = getRandomInt(2, boardSize - 2);
    const centerCol = getRandomInt(2, boardSize - 2);
    
    // Elegir dos direcciones aleatorias (no opuestas)
    const dir1Index = getRandomInt(0, 4);
    let dir2Index = getRandomInt(0, 4);
    while (Math.abs(dir1Index - dir2Index) === 2) { // Evitar direcciones opuestas
      dir2Index = getRandomInt(0, 4);
    }
    
    // Colocar dos iconos del mismo tipo en estas direcciones
    const dir1 = directions[dir1Index];
    const pos1Row = centerRow + dir1.dr;
    const pos1Col = centerCol + dir1.dc;
    positions.push({ row: pos1Row, col: pos1Col, icon: icon1 });
    boardArray[pos1Row][pos1Col] = icon1;
    
    const dir2 = directions[dir2Index];
    const pos2Row = centerRow + dir2.dr;
    const pos2Col = centerCol + dir2.dc;
    positions.push({ row: pos2Row, col: pos2Col, icon: icon1 });
    boardArray[pos2Row][pos2Col] = icon1;
    
    // Colocar un tercer icono del mismo tipo para crear la convergencia
    const centerPos = { row: centerRow, col: centerCol, icon: icon1 };
    positions.push(centerPos);
    boardArray[centerRow][centerCol] = icon1;
    
    // 2. Añadir otros iconos aleatorios del segundo tipo en posiciones que no generen convergencia
    for (let i = 0; i < Math.min(8, boardSize); i++) {
      let row, col;
      let attempts = 0;
      let validPosition = false;
      
      while (!validPosition && attempts < 20) {
        row = getRandomInt(0, boardSize);
        col = getRandomInt(0, boardSize);
        attempts++;
        
        // Verificar si la celda está vacía
        if (boardArray[row][col] === null) {
          // Verificar que no cause convergencia
          boardArray[row][col] = icon2; // Colocar temporalmente
          
          // Comprobar si hay convergencia
          const result = findConvergences(boardArray, row, col, boardSize);
          
          if (!result.hasConvergence) {
            positions.push({ row, col, icon: icon2 });
            validPosition = true;
          } else {
            // Si causa convergencia, revertir
            boardArray[row][col] = null;
          }
        }
      }
    }
    
    return positions;
  }, [boardSize, availableIcons, findConvergences]);
  
  // Inicializar tablero con iconos iniciales
  const initializeBoard = useCallback((size: number = boardSize) => {
    logger.info('Inicializando tablero', { tamaño: size, modoJuego: currentPlayMode });
    
    // Crear un tablero vacío inicial
    const newBoard = Array(size).fill(null).map(() => Array(size).fill(null));
    
    // Determinar número de iconos iniciales según modo de juego
    let totalIcons = INITIAL_ICONS; // Usar constante definida al inicio
    
    if (currentPlayMode === 'classic') {
      totalIcons = 7;
    } else if (currentPlayMode === 'timed') {
      totalIcons = 10;
    } else if (currentPlayMode === 'survival') {
      totalIcons = 15;
    }
    
    // Asegurarnos de no exceder la capacidad del tablero
    totalIcons = Math.min(totalIcons, Math.floor(size * size * 0.4));
    
    // Usar la función findValidInitialPositions para obtener posiciones iniciales válidas
    const validPositions = findValidInitialPositions();
    
    // Si se encontraron posiciones válidas, usarlas
    if (validPositions.length > 0) {
      for (const { row, col, icon } of validPositions) {
        newBoard[row][col] = icon;
      }
      logger.info('Usando posiciones iniciales calculadas', { 
        posiciones: validPositions.length 
      });
    } else {
      // Si no hay posiciones válidas, usar el método de distribución original
      logger.info('Usando método de distribución de iconos alternativo');
      // Código existente para posiciones aleatorias...
    }
    
    // Actualizar el tablero en el estado
    dispatch(updateBoard(newBoard));
    
    // Contar cuántos iconos realmente se colocaron
    let actualIconCount = 0;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (newBoard[r][c] !== null) {
          actualIconCount++;
        }
      }
    }
    
    dispatch(setIconCount(actualIconCount));
    
    // Configurar objetivos según el modo de juego
    if (currentPlayMode === 'classic') {
      // En modo clásico, establecer objetivos de puntuación y ocupación
      const scoreTarget = config.GAME_MODE_CONFIG.CLASSIC.initialScoreTarget * 
                         Math.pow(config.GAME_MODE_CONFIG.CLASSIC.scoreTargetMultiplier, level - 1);
      
      const occupationTarget = Math.max(
        30, 
        config.GAME_MODE_CONFIG.CLASSIC.initialOccupationTarget - 
        (level * config.GAME_MODE_CONFIG.CLASSIC.occupationDecreasePerLevel)
      );
      
      dispatch(setLevelTarget({
        score: Math.round(scoreTarget),
        occupation: Math.round(occupationTarget)
      }));
    } else if (currentPlayMode === 'timed') {
      // En modo contrarreloj, establecer límite de tiempo
      const timeLimit = config.GAME_MODE_CONFIG.TIMED.initialTimeLimit - 
                       (level - 1) * config.GAME_MODE_CONFIG.TIMED.timeDecreasePerLevel;
      
      // Mínimo 30 segundos por nivel
      dispatch(setLevelTimeLimit(Math.max(30, timeLimit)));
    }
    
    // Marcar como inicializado
    isInitializedRef.current = true;
    
    // Establecer velocidad según modo y nivel
    let spawnRate = config.SPAWN_RATES.MEDIUM;
    
    if (currentPlayMode === 'classic') {
      // Velocidad gradual en clásico
      spawnRate = Math.max(
        config.SPAWN_RATES.EXTREME,
        config.GAME_MODE_CONFIG.CLASSIC.initialSpawnRate - ((level - 1) * 100)
      );
    } else if (currentPlayMode === 'timed') {
      // Velocidad moderada en contrarreloj
      spawnRate = Math.max(
        config.SPAWN_RATES.FAST,
        config.GAME_MODE_CONFIG.TIMED.initialSpawnRate - ((level - 1) * 50)
      );
    } else if (currentPlayMode === 'survival') {
      // Velocidad lenta inicialmente en supervivencia
      spawnRate = config.GAME_MODE_CONFIG.SURVIVAL.initialSpawnRate;
    }
    
    // Actualizar spawn rate
    dispatch(setSpawnRate(spawnRate));
    
    logger.info('Tablero inicializado', { 
      tamaño: size,
      iconosIniciales: totalIcons
    });
    
    return newBoard;
  }, [dispatch, boardSize, currentPlayMode, availableIcons, level, findValidInitialPositions]);
  
  // Función auxiliar para encontrar posiciones alineadas
  const getAlignedPositions = useCallback((
    positions: { row: number; col: number }[],
    size: number
  ): { row: number; col: number }[] => {
    if (positions.length === 0) return [];
    
    // Obtener la posición inicial y el icono
    const startPos = positions[0];
    const icon = board[startPos.row][startPos.col];
    
    if (!icon) return [];
    
    // Definir las direcciones a verificar (horizontal, vertical y diagonales)
    const directions = [
      { dr: 0, dc: 1 },   // horizontal
      { dr: 1, dc: 0 },   // vertical
      { dr: 1, dc: 1 },   // diagonal descendente
      { dr: 1, dc: -1 }   // diagonal ascendente
    ];
    
    let bestResult: { row: number; col: number }[] = [];
    
    // Verificar en cada dirección
    for (const { dr, dc } of directions) {
      const foundPositions: { row: number; col: number }[] = [startPos];
      
      // Buscar en una dirección
      let r1 = startPos.row + dr;
      let c1 = startPos.col + dc;
      
      while (
        r1 >= 0 && r1 < size && 
        c1 >= 0 && c1 < size && 
        board[r1][c1] === icon
      ) {
        foundPositions.push({ row: r1, col: c1 });
        r1 += dr;
        c1 += dc;
      }
      
      // Buscar en la dirección opuesta
      let r2 = startPos.row - dr;
      let c2 = startPos.col - dc;
      
      while (
        r2 >= 0 && r2 < size && 
        c2 >= 0 && c2 < size && 
        board[r2][c2] === icon
      ) {
        foundPositions.push({ row: r2, col: c2 });
        r2 -= dr;
        c2 -= dc;
      }
      
      // Si encontramos al menos 3 iconos alineados, guardar el resultado
      if (foundPositions.length >= 3 && foundPositions.length > bestResult.length) {
        bestResult = foundPositions;
      }
    }
    
    return bestResult;
  }, [board]);
  
  // Añadir un icono aleatorio en una celda vacía
  const addRandomIcon = useCallback(() => {
    logger.debug('Agregando icono aleatorio al tablero');
    
    try {
      // Verificar que el tablero sea válido
      if (!board || board.length === 0) {
        logger.error('Tablero no válido');
        return false;
      }
      
      // Obtener el estado más reciente del tablero (evita trabajar con una versión antigua)
      const currentBoard = store.getState().game.board;
      const currentIconCount = store.getState().game.iconCount;
      
      // Buscar celdas vacías
      const emptyCells: { row: number; col: number }[] = [];
      
      for (let row = 0; row < boardSize; row++) {
        for (let col = 0; col < boardSize; col++) {
          if (currentBoard[row][col] === null) {
            emptyCells.push({ row, col });
          }
        }
      }
      
      // Si no hay celdas vacías, el juego termina
      if (emptyCells.length === 0) {
        logger.info('Tablero lleno, no se pueden agregar más iconos');
        if (status === 'playing') {
          dispatch(setGameStatus('gameOver'));
        }
        return false;
      }
      
      // Seleccionar una celda vacía aleatoria
      const randomIndex = Math.floor(Math.random() * emptyCells.length);
      const { row, col } = emptyCells[randomIndex];
      
      // Seleccionar un icono aleatorio del conjunto disponible
      const randomIcon = availableIcons[Math.floor(Math.random() * availableIcons.length)];
      
      // Crear una copia del tablero actual
      const newBoard = JSON.parse(JSON.stringify(currentBoard));
      
      // Colocar el icono en el tablero
      newBoard[row][col] = randomIcon;
      
      // Actualizar el tablero en el estado
      dispatch(updateBoard(newBoard));
      
      // Incrementar el contador de iconos
      dispatch(setIconCount(currentIconCount + 1));
      
      // Reproducir sonido de nuevo icono (si está disponible)
      audioManager.play('newIcon');
      
      // Verificar si aún hay movimientos válidos
      setTimeout(() => {
        const hasValidMovesLeft = hasValidMoves();
        if (!hasValidMovesLeft && status === 'playing') {
          logger.info('No hay movimientos válidos después de añadir un icono');
          
          // Dependiendo del modo de juego, puede ser fin de juego o nivel completado
          if (currentPlayMode === 'survival') {
            dispatch(setGameStatus('gameOver'));
          } else {
            dispatch(setGameStatus('levelCompleted'));
          }
        }
      }, 100); // Pequeño retraso para permitir que el estado se actualice
      
      return true;
    } catch (error) {
      logger.error('Error al añadir icono aleatorio', error);
      return false;
    }
  }, [board, boardSize, availableIcons, dispatch, iconCount, status, currentPlayMode, hasValidMoves]);

  // Función de iniciar temporizadores definida antes del useEffect que la usa
  const startTimers = useCallback(() => {
    const currentSpawnRate = store.getState().game.spawnRate;
    const currentMode = store.getState().game.currentPlayMode;
    
    // Evitar inicializar los temporizadores más de una vez
    if (timersActiveRef.current) {
      logger.warn('Se intentó iniciar los temporizadores cuando ya estaban activos');
      return;
    }
    
    logger.info('Iniciando temporizadores del juego', { 
      spawnRate: currentSpawnRate,
      modoJuego: currentMode
    });

    // Marcar que los temporizadores están activos
    timersActiveRef.current = true;
    
    // 1. Temporizador principal del juego (incrementa timer cada segundo)
    gameTimerRef.current = setInterval(() => {
      if (isTimedMode()) {
        // En modo contrarreloj, decrementar el tiempo restante
        dispatch(decrementTimeRemaining());
        
        // Verificar si se acabó el tiempo
        const { timeRemaining } = store.getState().game;
        if (timeRemaining <= 0) {
          logger.info('Tiempo agotado en modo contrarreloj');
          stopTimers();
          dispatch(setGameStatus('gameOver'));
        }
      } else {
        // En otros modos, incrementar el contador de tiempo
        dispatch(incrementTimer());
        
        // En modo supervivencia, incrementar también el contador de tiempo de supervivencia
        if (isSurvivalMode()) {
          // Aquí se podría implementar la lógica específica para supervivencia
        }
      }
    }, 1000);
    
    // 2. Temporizador para añadir nuevos iconos
    iconTimerRef.current = setInterval(() => {
      // Obtener el estado más reciente
      const state = store.getState().game;
      
      if (state.status !== 'playing') {
        return; // No añadir iconos si el juego no está en curso
      }
      
      // Añadir icono
      addRandomIcon();
    }, currentSpawnRate);
    
    // 3. Temporizador para aumentar la velocidad
    // Este temporizador es diferente según el modo de juego
    if (currentMode === 'classic' || currentMode === 'timed') {
      // En modos clásico y contrarreloj, la velocidad aumenta gradualmente
      const speedIncreaseInterval = currentMode === 'classic' 
        ? SPAWN_RATE_INCREASE_INTERVAL // Usar la constante definida al inicio
        : SPAWN_RATE_INCREASE_INTERVAL; // Se podría personalizar para el modo contrarreloj
      
      speedIncreaseTimerRef.current = setInterval(() => {
        // Reducir el tiempo entre spawns (incrementar velocidad)
        dispatch(increaseSpeed(0.1)); // Usar un argumento para el método
        
        // Obtener el spawn rate actualizado
        const { spawnRate } = store.getState().game;
        logger.info('Velocidad aumentada', { nuevoSpawnRate: spawnRate });
        
        // Si estamos mostrando efectos visuales, hacerlo
        // (Implementación específica depende de la UI)
      }, speedIncreaseInterval);
    } else if (currentMode === 'survival') {
      // En modo supervivencia, la velocidad aumenta más rápido con el tiempo
      speedIncreaseTimerRef.current = setInterval(() => {
        // Lógica especial para modo supervivencia
        // Aumenta más rápido cuanto más tiempo pasa
        dispatch(increaseSpeed(0.2)); // Mayor incremento en modo supervivencia
        
        // Obtener el spawn rate actualizado
        const { spawnRate } = store.getState().game;
        logger.info('Velocidad aumentada en modo supervivencia', { nuevoSpawnRate: spawnRate });
      }, SPAWN_RATE_INCREASE_INTERVAL / 2); // Más frecuente en supervivencia
    }
    
    // 4. Temporizador para recargar pistas (si están habilitadas)
    const HINT_RECHARGE_ENABLED = true; // Esto debería estar en config
    const MAX_HINTS = 3; // Esto debería estar en config
    const HINT_RECHARGE_TIME = 60000; // 60 segundos
    
    if (HINT_RECHARGE_ENABLED) {
      hintTimerRef.current = setInterval(() => {
        const { hintsRemaining } = store.getState().game;
        if (hintsRemaining < MAX_HINTS) {
          dispatch(rechargeHint());
        }
      }, HINT_RECHARGE_TIME);
    }
  }, [dispatch, addRandomIcon]);

  // Detener los temporizadores
  const stopTimers = useCallback(() => {
    logger.info('Deteniendo temporizadores del juego');
    
    // Limpiar todos los intervalos
    if (gameTimerRef.current) {
      clearInterval(gameTimerRef.current);
      gameTimerRef.current = null;
    }
    
    if (iconTimerRef.current) {
      clearInterval(iconTimerRef.current);
      iconTimerRef.current = null;
    }
    
    if (speedIncreaseTimerRef.current) {
      clearInterval(speedIncreaseTimerRef.current);
      speedIncreaseTimerRef.current = null;
    }
    
    if (hintTimerRef.current) {
      clearInterval(hintTimerRef.current);
      hintTimerRef.current = null;
    }
    
    // Marcar que los temporizadores ya no están activos
    timersActiveRef.current = false;
    
    logger.info('Temporizadores detenidos');
  }, []);

  // Añadir función para buscar iconos convergentes
  const findConvergingIcons = useCallback((row: number, col: number): { row: number; col: number }[] => {
    if (board[row][col] !== null) {
      logger.debug('findConvergingIcons: la celda no está vacía', { row, col });
      return [];
    }
    
    const convergingIcons: { row: number; col: number }[] = [];
    const visited = new Set<string>();
    
    // Buscar en las cuatro direcciones (arriba, derecha, abajo, izquierda)
    const directions = [
      { dr: -1, dc: 0 }, // Arriba
      { dr: 0, dc: 1 },  // Derecha
      { dr: 1, dc: 0 },  // Abajo
      { dr: 0, dc: -1 }, // Izquierda
    ];
    
    // Para cada dirección, buscar el primer icono
    const iconsByType: Record<string, { row: number; col: number }[]> = {};
    
    for (const { dr, dc } of directions) {
      let r = row + dr;
      let c = col + dc;
      
      // Seguir en esa dirección hasta encontrar un icono o salir del tablero
      while (isValidCell(r, c, boardSize)) {
        if (board[r][c]) {
          const icon = board[r][c] as string;
          const key = `${r},${c}`;
          
          // Si no hemos visitado esta celda antes
          if (!visited.has(key)) {
            visited.add(key);
            
            // Agrupar por tipo de icono
            if (!iconsByType[icon]) {
              iconsByType[icon] = [];
            }
            
            iconsByType[icon].push({ row: r, col: c });
          }
          break;
        }
        
        r += dr;
        c += dc;
      }
    }
    
    // Verificar si hay al menos 2 iconos del mismo tipo que convergen
    for (const icon in iconsByType) {
      if (iconsByType[icon].length >= 2) {
        convergingIcons.push(...iconsByType[icon]);
      }
    }
    
    logger.debug('findConvergingIcons resultado', { 
      encontrados: convergingIcons.length,
      porTipo: Object.entries(iconsByType).map(([icon, positions]) => ({
        icon,
        count: positions.length
      }))
    });
    
    return convergingIcons;
  }, [board, boardSize]);

  // Manejar el clic en una celda
  const handleCellClick = useCallback((row: number, col: number) => {
    // Ignorar clics si el juego no está activo o si estamos procesando una eliminación
    if (status !== 'playing' || isRemovingIconsRef.current) {
      logger.info('Clic ignorado: estado del juego no es "playing" o hay una eliminación en curso', {
        status,
        isRemovingIcons: isRemovingIconsRef.current
      });
      return;
    }
    
    logger.info('Procesando clic en celda', { row, col });
    audioManager.play('click');
    
    // Limpiar cualquier resaltado previo
    dispatch(setHighlightedCells([]));
    
    // Lógica mejorada basada en el archivo HTML
    // Solo se pueden hacer convergencias en celdas vacías
    if (board[row][col] === null) {
      logger.info('Verificando convergencias en celda vacía', { row, col });
      
      // Buscar iconos que convergen en esta celda vacía
      const convergingIcons = findConvergingIcons(row, col);
      
      if (convergingIcons.length >= 2) {
        // Hay al menos 2 iconos convergentes
        logger.info('Convergencia encontrada', { 
          celdas: convergingIcons.length,
          posiciones: convergingIcons 
        });
        
        audioManager.play('convergingFound');
        
        // Marcar que estamos procesando una eliminación
        isRemovingIconsRef.current = true;
        
        // Crear copia del tablero actual
        const currentBoard = JSON.parse(JSON.stringify(board));
        
        // Resaltar las celdas que se van a eliminar
        dispatch(setHighlightedCells(convergingIcons));
        
        // Animar la eliminación
        setTimeout(() => {
          // Marcar los iconos para animación de eliminación
          const markingBoard = JSON.parse(JSON.stringify(currentBoard));
          
          // Obtener el tipo de icono (todos son iguales)
          const icon = currentBoard[convergingIcons[0].row][convergingIcons[0].col];
          
          // Verificar todos los iconos y marcarlos
          logger.info('Marcando iconos para eliminación', {
            icon,
            convergingIcons: convergingIcons.map(cell => ({
              row: cell.row,
              col: cell.col,
              valor: markingBoard[cell.row][cell.col]
            }))
          });
          
          for (const cell of convergingIcons) {
            if (markingBoard[cell.row][cell.col] === icon) {
              markingBoard[cell.row][cell.col] = `${icon}_removing`;
            } else {
              logger.error('Inconsistencia en animación de convergencia', { 
                esperado: icon, 
                encontrado: markingBoard[cell.row][cell.col]
              });
            }
          }
          
          // Actualizar el tablero con las marcas visuales
          dispatch(updateBoard(markingBoard));
          
          // Completar la eliminación después de la animación
          setTimeout(() => {
            // Obtener el estado más reciente del tablero desde Redux
            const latestBoard = store.getState().game.board;
            const finalBoard = JSON.parse(JSON.stringify(latestBoard));
            
            // Log del estado actual del tablero antes de la eliminación
            logger.info('Estado del tablero antes de eliminar iconos', {
              iconosAEliminar: convergingIcons.map(cell => ({
                row: cell.row,
                col: cell.col,
                valor: finalBoard[cell.row][cell.col]
              }))
            });
            
            // Eliminar los iconos marcados
            let removedCount = 0;
            for (const cell of convergingIcons) {
              const cellContent = finalBoard[cell.row][cell.col];
              if (cellContent && (cellContent.includes('_removing') || cellContent === icon)) {
                // Asegurarse de que la celda se limpie correctamente
                finalBoard[cell.row][cell.col] = null;
                removedCount++;
                
                // Añadir un log para verificar que se eliminó
                logger.debug('Eliminando icono en celda', { row: cell.row, col: cell.col, valor: cellContent });
              }
            }
            
            logger.info('Iconos eliminados en convergencia', { cantidad: removedCount, total: convergingIcons.length });
            
            // Actualizar el tablero sin los iconos
            dispatch(updateBoard(finalBoard));
            
            // Actualizar puntuación según el número de iconos eliminados
            const pointsEarned = removedCount * 10 * level;
            logger.info('Puntos ganados', { puntos: pointsEarned, multiplicador: level });
            dispatch(incrementScore(pointsEarned));
            
            // Actualizar el contador de iconos
            dispatch(setIconCount(iconCount - removedCount));
            
            // Reproducir sonido de eliminación completada
            audioManager.play('removeIcon');
            
            // Limpiar las celdas destacadas después de un tiempo para evitar restos visuales
            setTimeout(() => {
              dispatch(setHighlightedCells([]));
            }, 700); // Esperar un poco más que la animación para asegurar que se complete
            
            // Verificar si el tablero está vacío (victoria inmediata)
            if (iconCount - removedCount === 0) {
              logger.info('Tablero vacío. ¡Nivel completado!');
              dispatch(setGameStatus('levelCompleted'));
              audioManager.play('levelComplete');
            }
            // Verificar si no hay más movimientos válidos
            else if (!hasValidMoves()) {
              logger.info('No hay más movimientos válidos. Nivel completado.');
              setTimeout(() => {
                dispatch(setGameStatus('levelCompleted'));
              }, 500);
            }
            
            // Finalizar el proceso de eliminación
            isRemovingIconsRef.current = false;
          }, 500); // Duración de la animación de eliminación
        }, 200); // Pequeña pausa antes de iniciar la animación
      } else {
        // No hay convergencia, penalizar al jugador
        logger.info('No hay convergencia. Penalizando al jugador.');
        audioManager.play('error');
        
        // Animar error
        // animateErrorCell(row, col);
        // animateBoard();
        
        // Aumentar la velocidad como penalización
        const currentSpawnRate = store.getState().game.spawnRate;
        const newSpawnRate = Math.max(
          MIN_SPAWN_RATE, // Usar la constante definida al inicio
          currentSpawnRate * 0.95
        );
        
        // Actualizar el spawn rate
        dispatch(setSpawnRate(newSpawnRate));
        
        // Añadir iconos de penalización
        for (let i = 0; i < 3; i++) {
          setTimeout(() => {
            addRandomIcon();
          }, i * 200);
        }
      }
    } else {
      // La celda no está vacía, no se puede realizar una convergencia
      logger.info('Celda ocupada, no se puede hacer convergencia', { 
        row, col, 
        icono: board[row][col] 
      });
      audioManager.play('error');
    }

    // Limpiar las celdas destacadas después de eliminar los iconos
    setTimeout(() => {
      // Asegurarnos que no queden celdas destacadas después de la eliminación
      dispatch(setHighlightedCells([]));
    }, 700); // Tiempo ligeramente más largo que la animación
  }, [
    board, 
    status, 
    boardSize, 
    level, 
    iconCount, 
    dispatch, 
    findConvergingIcons, 
    hasValidMoves, 
    addRandomIcon
  ]);

  // Ajustar el tamaño visual del tablero
  const adjustBoardSize = useCallback((container: HTMLElement, boardElement: HTMLElement) => {
    adjustBoardVisuals(container, boardElement);
  }, []);

  // Función para mostrar pistas (destacar convergencias potenciales)
  const showHint = useCallback(() => {
    // Verificar si hay pistas disponibles
    if (hintsRemaining <= 0 || hintCooldown === true) {
      logger.info('No se pueden mostrar pistas: no quedan disponibles o cooldown activo');
      return false;
    }
    
    // Buscar posibles convergencias
    let foundConvergence = false;
    let convergingCells: {row: number, col: number}[] = [];
    
    // Verificar cada celda ocupada
    for (let row = 0; row < boardSize && !foundConvergence; row++) {
      for (let col = 0; col < boardSize && !foundConvergence; col++) {
        if (board[row][col] !== null) {
          // Verificar si esta celda forma parte de una convergencia
          const result = findConvergences(board, row, col, boardSize);
          
          if (result.hasConvergence) {
            foundConvergence = true;
            convergingCells = result.convergingCells;
            break;
          }
        }
      }
    }
    
    if (foundConvergence && convergingCells.length > 0) {
      // Registrar uso de pista
      dispatch(useHint());
      
      // Destacar celdas
      dispatch(setHighlightedCells(convergingCells));
      
      // Reproducir sonido
      audioManager.play('hint');
      
      // Configurar temporizador para ocultar destacado
      if (hintTimerRef.current) {
        clearTimeout(hintTimerRef.current);
      }
      
      hintTimerRef.current = setTimeout(() => {
        dispatch(setHighlightedCells([]));
        hintTimerRef.current = null;
      }, 2000);
      
      // Iniciar cooldown
      dispatch(resetHintCooldown());
      
      return true;
    } else {
      // No se encontraron convergencias
      logger.info('No se encontraron convergencias para mostrar como pista');
      return false;
    }
  }, [board, boardSize, hintsRemaining, hintCooldown, dispatch, findConvergences]);
  
  // Resetear nivel actual
  const resetCurrentLevel = useCallback(() => {
    logger.info('Reseteando nivel actual', { nivel: level });
    
    // Detener temporizadores existentes
    stopTimers();
    
    // Inicializar tablero con estado limpio
    initializeBoard();
    
    // Establecer estado a "jugando"
    dispatch(setGameStatus('playing'));
    
    // Iniciar temporizadores de nuevo
    setTimeout(() => {
      startTimers();
    }, 100);
    
    return true;
  }, [dispatch, level, stopTimers, initializeBoard, startTimers]);
  
  // Avanzar al siguiente nivel
  const advanceToNextLevel = useCallback(() => {
    logger.info('Avanzando al siguiente nivel', { nivelActual: level });
    
    // Incrementar nivel
    dispatch(setLevel(level + 1));
    
    // Detener temporizadores actuales
    stopTimers();
    
    // Inicializar tablero para el nuevo nivel
    initializeBoard();
    
    // Recargar las pistas disponibles
    dispatch(rechargeHint());
    
    // Establecer estado a "jugando"
    dispatch(setGameStatus('playing'));
  }, [dispatch, level, initializeBoard, stopTimers]);

  // Devolver funciones y estado necesarios
  return {
    board,
    boardSize,
    status,
    iconCount,
    level,
    score,
    highlightedCells,
    initializeBoard,
    handleCellClick,
    adjustBoardSize,
    stopTimers,
    startTimers,
    registerCellRef,
    showHint,
    resetCurrentLevel,
    advanceToNextLevel,
    findConvergingIcons
  };
}; // fin del hook

// Exportar el hook
export default useGameLogic;