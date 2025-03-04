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
  rechargeHint,
  GameDifficulty,
  GamePlayMode,
  setGameMode,
  setPlayMode
} from '../store/slices/gameSlice';
import { RootState } from '../store';
import { store } from '../store';
import { createLogger } from '../utils/logUtils';
import * as config from '../utils/config';
import * as gameConfig from '../config/gameConfig';
import { isValidCell, getRandomInt, shuffleArray, calculateBoardOccupation } from '../utils/gameUtils';
import { audioManager } from '../utils/audioManager';
import { 
  adjustBoardVisuals,
  changeSpawnRate,
  configureBoardForLevel
} from '../utils/boardUtils';
import { useBoardInteraction } from '../components/game/GameBoard/hooks';

// Crear un logger específico para este hook
const logger = createLogger('useGameLogic');

// Constantes para la configuración (si no están definidas en gameConfig)
const MIN_SPAWN_RATE = 800; // ms - Velocidad máxima (valores más bajos = más rápido)
const SPAWN_RATE_STEP = 100; // ms - Cuánto aumenta la velocidad en cada paso
const SPAWN_RATE_INCREASE_INTERVAL = 8000; // ms - Cada cuánto aumenta la velocidad
const INITIAL_ICONS = 5; // Número de iconos iniciales al comenzar el juego

// Constantes para el manejo de fin de partida
const OCCUPATION_THRESHOLD_GAME_OVER = 60; // Porcentaje de ocupación para Game Over cuando no hay movimientos
const OCCUPATION_THRESHOLD_NEXT_LEVEL = 30; // Porcentaje de ocupación para pasar al siguiente nivel cuando no hay movimientos

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
  const speedIncreaseTimerRef = useRef<NodeJS.Timeout | null>(null);
  const gameTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hintTimerRef = useRef<NodeJS.Timeout | null>(null);
  const iconTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Referencias para las celdas del tablero (DOM)
  const cellRefs = useRef<Record<string, HTMLElement>>({});
  
  // Referencia para controlar si los temporizadores están activos
  const timersActiveRef = useRef<boolean>(false);
  
  // Referencia para marcar si el tablero ha sido inicializado
  const isInitializedRef = useRef<boolean>(false);
  
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
              const dirKey = `${dr},${dc}`;
              iconsByDirection[dirKey] = true;
              convergingDirections++;
              
              // Verificar si hay suficientes direcciones con el mismo icono
              if (convergingDirections >= 2) {
                return true;
              }
            }
            break; // Hay un icono diferente, terminamos la búsqueda en esta dirección
          }
          r += dr;
          c += dc;
        }
      }
    }
    
    return false;
  }, [availableIcons]);
  
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
    
    return hasValidMoves;
  }, [isValidPlacement]);
  
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
    const initialSpawnRate = calculateInitialSpeedForLevel(level, currentPlayMode);
    dispatch(setSpawnRate(initialSpawnRate));
    
    logger.info('Nivel inicializado con configuración', {
      nivel: level,
      modo: currentPlayMode,
      velocidadInicial: initialSpawnRate,
      multiplicador: config.SPAWN_RATES.MEDIUM / initialSpawnRate
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
    // Eliminado: logger.debug('Agregando icono aleatorio al tablero');
    
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
      
      // Si no hay celdas vacías, el juego termina (tablero lleno - Game Over)
      if (emptyCells.length === 0) {
        // Análisis del fin de partida: tablero lleno
        const validMoves = countValidMoves();
        logger.info('🎮 FIN DE PARTIDA: Tablero lleno', { 
          motivo: 'TABLERO_LLENO',
          modo: currentPlayMode,
          nivel: level,
          iconosTotales: currentIconCount,
          movimientosDisponibles: validMoves,
          ocupacion: '100%',
          distribucionIconos: countIconTypes(currentBoard)
        });
        
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
      
      // Verificar si aún hay movimientos válidos después de añadir el icono
      setTimeout(() => {
        const validMovesCount = countValidMoves();
        const hasValidMovesLeft = validMovesCount > 0;
        
        if (!hasValidMovesLeft && status === 'playing') {
          // Calcular ocupación actual del tablero
          const newIconCount = currentIconCount + 1;
          const ocupacionPorcentaje = calculateBoardOccupation(newIconCount, boardSize);
          
          // Determinar si es Game Over o Siguiente Nivel según la ocupación
          if (ocupacionPorcentaje > OCCUPATION_THRESHOLD_GAME_OVER) {
            // Game Over: Ocupación > 60% y sin movimientos
            logger.info('🎮 FIN DE PARTIDA: Sin movimientos y alta ocupación', { 
              motivo: 'SIN_MOVIMIENTOS_ALTA_OCUPACION',
              modo: currentPlayMode,
              nivel: level,
              iconosTotales: newIconCount,
              ocupacion: `${ocupacionPorcentaje}%`,
              umbralGameOver: `${OCCUPATION_THRESHOLD_GAME_OVER}%`,
              celdasVacias: emptyCells.length - 1,
              distribucionIconos: countIconTypes(newBoard)
            });
            
            dispatch(setGameStatus('gameOver'));
          } else if (ocupacionPorcentaje < OCCUPATION_THRESHOLD_NEXT_LEVEL) {
            // Siguiente nivel: Ocupación < 30% y sin movimientos
            logger.info('🎮 FIN DE NIVEL: Sin movimientos y baja ocupación', { 
              motivo: 'SIN_MOVIMIENTOS_BAJA_OCUPACION',
              modo: currentPlayMode,
              nivel: level,
              iconosTotales: newIconCount,
              ocupacion: `${ocupacionPorcentaje}%`,
              umbralNextLevel: `${OCCUPATION_THRESHOLD_NEXT_LEVEL}%`,
              celdasVacias: emptyCells.length - 1,
              distribucionIconos: countIconTypes(newBoard)
            });
            
            dispatch(setGameStatus('levelCompleted'));
          } else {
            // Caso especial para modos específicos
            // En modo supervivencia siempre es Game Over
            if (currentPlayMode === 'survival') {
              logger.info('🎮 FIN DE PARTIDA: Sin movimientos en modo supervivencia', { 
                motivo: 'SIN_MOVIMIENTOS_SUPERVIVENCIA',
                nivel: level,
                iconosTotales: newIconCount,
                ocupacion: `${ocupacionPorcentaje}%`
              });
              dispatch(setGameStatus('gameOver'));
            } else {
              // En otros modos, sigue intentando (no cambia el estado)
              logger.info('⚠️ AVISO: Sin movimientos disponibles, pero continuando juego', { 
                motivo: 'SIN_MOVIMIENTOS_CONTINUA',
                modo: currentPlayMode,
                nivel: level,
                iconosTotales: newIconCount,
                ocupacion: `${ocupacionPorcentaje}%`
              });
              // Añadir icono aleatorio para intentar dar nuevas posibilidades
              addRandomIcon();
            }
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
          // Log detallado para fin de juego por tiempo agotado
          const { board: currentBoard, iconCount: currentIcons, level: currentLevel } = store.getState().game;
          
          logger.info('🎮 FIN DE PARTIDA: Tiempo agotado', {
            motivo: 'TIEMPO_AGOTADO',
            modo: 'timed',
            nivel: currentLevel,
            iconosTotales: currentIcons,
            puntuacion: store.getState().game.score,
            ocupacion: `${calculateBoardOccupation(currentIcons, boardSize)}%`,
            movimientosDisponibles: countValidMoves(),
            distribucionIconos: countIconTypes(currentBoard)
          });
          
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
    
    // 2. Temporizador para añadir nuevos iconos (eliminar spawnTimerRef completamente)
    iconTimerRef.current = setInterval(() => {
      try {
        // Obtener el estado más reciente
        const state = store.getState().game;
        
        if (state.status !== 'playing') {
          return; // No añadir iconos si el juego no está en curso
        }
        
        // Verificar que el tablero existe
        if (!state.board || !Array.isArray(state.board) || state.board.length === 0) {
          logger.warn('Temporizador activo pero tablero no válido', {
            boardExists: !!state.board,
            isArray: Array.isArray(state.board),
            length: state.board ? state.board.length : 0
          });
          return;
        }
        
        // Añadir icono
        addRandomIcon();
      } catch (error) {
        logger.error('Error en temporizador de spawn', error);
      }
    }, currentSpawnRate);
    
    // 3. Temporizador para aumentar la velocidad
    // Este temporizador es diferente según el modo de juego
    const modeConfig = currentMode.toUpperCase() === 'CLASSIC' 
      ? config.GAME_MODES.CLASSIC 
      : currentMode.toUpperCase() === 'TIMED'
        ? config.GAME_MODES.TIMED
        : config.GAME_MODES.SURVIVAL;

    const speedIncreaseInterval = modeConfig.speedIncreaseTime || SPAWN_RATE_INCREASE_INTERVAL;
    const maxSpeedMultiplier = modeConfig.maxSpeedMultiplier || config.MAX_SPEED_MULTIPLIER;
    const speedIncreaseAmount = modeConfig.speedIncreaseAmount || 0.1;

    // Marcador para evitar múltiples aumentos
    const speedLimitReachedRef = {current: false};

    speedIncreaseTimerRef.current = setInterval(() => {
      if (store.getState().game.status !== 'playing') {
        return; // No aumentar la velocidad si el juego no está en curso
      }
      
      // Obtener el spawn rate y multiplicador actuales
      const { spawnRate: currentSpawnRate, speedMultiplier: currentMultiplier } = store.getState().game;
      const baseSpeed = config.SPAWN_RATES.MEDIUM;
      
      // Verificar si ya alcanzamos la velocidad máxima
      // Nota: También comprobamos un límite mínimo absoluto para evitar velocidades imposibles
      const minSpawnRateAllowed = 300; // Milisegundos (velocidad máxima permitida)
      
      if (currentMultiplier >= maxSpeedMultiplier || currentSpawnRate <= minSpawnRateAllowed) {
        if (!speedLimitReachedRef.current) {
          logger.info('Velocidad máxima alcanzada', { 
            multiplicador: currentMultiplier,
            maxMultiplicador: maxSpeedMultiplier,
            spawnRate: currentSpawnRate
          });
          speedLimitReachedRef.current = true;
        }
        return; // No aumentar más la velocidad
      }
      
      // Reiniciar la bandera si estamos por debajo del límite
      speedLimitReachedRef.current = false;
      
      // Incrementar velocidad usando el factor específico del modo
      dispatch(increaseSpeed(speedIncreaseAmount));
      
      // Obtener el spawn rate actualizado después del cambio
      const { spawnRate, speedMultiplier } = store.getState().game;
      
      logger.info('Velocidad aumentada automáticamente', { 
        modoJuego: currentMode,
        nuevoSpawnRate: spawnRate,
        multiplicador: speedMultiplier,
        incremento: speedIncreaseAmount
      });
    }, speedIncreaseInterval);
    
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

  /**
   * Detener todos los temporizadores
   */
  const stopTimers = useCallback(() => {
    logger.info('Deteniendo todos los temporizadores', { status });
    
    // Detener temporizador principal
    if (gameTimerRef.current) {
      clearInterval(gameTimerRef.current);
      gameTimerRef.current = null;
    }
    
    // Detener temporizador de spawn
    if (iconTimerRef.current) {
      clearInterval(iconTimerRef.current);
      iconTimerRef.current = null;
      logger.debug('Temporizador de spawn detenido');
    }
    
    // Detener temporizador de aumento de velocidad
    if (speedIncreaseTimerRef.current) {
      clearInterval(speedIncreaseTimerRef.current);
      speedIncreaseTimerRef.current = null;
      logger.info('Temporizador de aumento de velocidad detenido');
    }
    
    // Detener temporizador de pistas
    if (hintTimerRef.current) {
      clearTimeout(hintTimerRef.current);
      hintTimerRef.current = null;
    }
    
    // Marcar temporizadores como inactivos
    timersActiveRef.current = false;
    
    logger.debug('Todos los temporizadores del juego han sido detenidos');
  }, [status]);

  // Encontrar iconos que convergerían si se colocara un icono en una posición específica
  const findConvergingIcons = useCallback((row: number, col: number) => {
    // Verificar que la celda esté vacía
    if (board[row][col] !== null) {
      // Eliminar este log de debug
      // logger.debug('findConvergingIcons: la celda no está vacía', { row, col });
      return [];
    }
    
    // Iconos que pueden converger, organizados por tipo
    const iconsByType: { [icon: string]: { row: number; col: number }[] } = {};
    
    // Para cada dirección, buscar iconos del mismo tipo
    const directions = [
      { dr: -1, dc: 0 }, // arriba
      { dr: 1, dc: 0 },  // abajo
      { dr: 0, dc: -1 }, // izquierda
      { dr: 0, dc: 1 },  // derecha
      { dr: -1, dc: -1 }, // diagonal superior izquierda
      { dr: -1, dc: 1 },  // diagonal superior derecha
      { dr: 1, dc: -1 },  // diagonal inferior izquierda
      { dr: 1, dc: 1 }    // diagonal inferior derecha
    ];
    
    const convergingIcons: { row: number; col: number }[] = [];
    
    // Buscar en todas las direcciones
    for (const { dr, dc } of directions) {
      let r = row + dr;
      let c = col + dc;
      
      // Buscar el primer icono en esta dirección
      while (isValidCell(r, c, boardSize)) {
        const currentIcon = board[r][c];
        if (currentIcon !== null) {
          // Ignorar iconos ya marcados para eliminación
          if (currentIcon.includes('_removing')) break;
          
          // Inicializar el array para este tipo de icono si no existe
          if (!iconsByType[currentIcon]) {
            iconsByType[currentIcon] = [];
          }
          
          // Añadir este icono a la lista de posibles convergencias
          iconsByType[currentIcon].push({ row: r, col: c });
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
    
    // Eliminar este log de debug
    /* logger.debug('findConvergingIcons resultado', { 
      encontrados: convergingIcons.length,
      porTipo: Object.entries(iconsByType).map(([icon, positions]) => ({
        icon,
        count: positions.length
      }))
    }); */
    
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
              const currentTimer = store.getState().game.timer;
              logger.info('🎮 FIN DE NIVEL: Tablero vacío', {
                motivo: 'TABLERO_VACIO',
                modo: currentPlayMode,
                nivel: level,
                puntosBonificacion: config.SCORE_VALUES.EMPTY_BOARD_BONUS,
                tiempoTotal: currentTimer,
                iconosEliminados: iconCount
              });
              
              // Dar bonificación por vaciar tablero
              dispatch(incrementScore(config.SCORE_VALUES.EMPTY_BOARD_BONUS));
              
              // Pasar al siguiente nivel
              dispatch(setGameStatus('levelCompleted'));
              audioManager.play('levelComplete');
            }
            // Verificar si no hay más movimientos válidos
            else if (!hasValidMoves()) {
              // Calcular la ocupación actual del tablero
              const iconosRestantes = iconCount - removedCount;
              const ocupacionPorcentaje = calculateBoardOccupation(iconosRestantes, boardSize);
              
              // Determinar si es fin de nivel o fin de partida
              if (ocupacionPorcentaje < OCCUPATION_THRESHOLD_NEXT_LEVEL) {
                // Ocupación baja, pasar al siguiente nivel
                logger.info('🎮 FIN DE NIVEL: Sin movimientos y baja ocupación', {
                  motivo: 'SIN_MOVIMIENTOS_BAJA_OCUPACION',
                  modo: currentPlayMode,
                  nivel: level,
                  iconosRestantes: iconosRestantes,
                  ocupacion: `${ocupacionPorcentaje}%`,
                  umbralNextLevel: `${OCCUPATION_THRESHOLD_NEXT_LEVEL}%`,
                  distribucionIconos: countIconTypes(finalBoard)
                });
                
                setTimeout(() => {
                  dispatch(setGameStatus('levelCompleted'));
                }, 500);
              } else if (ocupacionPorcentaje > OCCUPATION_THRESHOLD_GAME_OVER) {
                // Alta ocupación, fin de partida
                logger.info('🎮 FIN DE PARTIDA: Sin movimientos y alta ocupación', {
                  motivo: 'SIN_MOVIMIENTOS_ALTA_OCUPACION',
                  modo: currentPlayMode,
                  nivel: level,
                  iconosRestantes: iconosRestantes,
                  ocupacion: `${ocupacionPorcentaje}%`,
                  umbralGameOver: `${OCCUPATION_THRESHOLD_GAME_OVER}%`,
                  distribucionIconos: countIconTypes(finalBoard)
                });
                
                setTimeout(() => {
                  dispatch(setGameStatus('gameOver'));
                }, 500);
              } else {
                // Caso intermedio - depende del modo de juego
                if (currentPlayMode === 'survival') {
                  // En supervivencia siempre es game over si no hay movimientos
                  logger.info('🎮 FIN DE PARTIDA: Sin movimientos en modo supervivencia', {
                    motivo: 'SIN_MOVIMIENTOS_SUPERVIVENCIA',
                    nivel: level,
                    iconosRestantes: iconosRestantes,
                    ocupacion: `${ocupacionPorcentaje}%`
                  });
                  
                  setTimeout(() => {
                    dispatch(setGameStatus('gameOver'));
                  }, 500);
                } else {
                  // En otros modos, añadir un icono aleatorio e intentar seguir jugando
                  logger.info('⚠️ AVISO: Sin movimientos disponibles, añadiendo icono aleatorio', {
                    motivo: 'SIN_MOVIMIENTOS_CONTINUA',
                    modo: currentPlayMode,
                    nivel: level,
                    iconosRestantes: iconosRestantes,
                    ocupacion: `${ocupacionPorcentaje}%`
                  });
                  
                  // Esperar a que termine la animación y añadir icono
                  setTimeout(() => {
                    addRandomIcon();
                  }, 1000);
                }
              }
            }
            
            // Finalizar el proceso de eliminación
            isRemovingIconsRef.current = false;
          }, 500); // Duración de la animación de eliminación
        }, 200); // Pequeña pausa antes de iniciar la animación
      } else {
        // No hay convergencia, penalizar al jugador
        logger.info('🎮 PENALIZACIÓN: No hay convergencia', {
          motivo: 'SIN_CONVERGENCIA',
          posicion: { row, col },
          modo: currentPlayMode,
          nivel: level,
          iconosEnTablero: iconCount,
          ocupacion: `${calculateBoardOccupation(iconCount, boardSize)}%`,
          movimientosDisponibles: countValidMoves(),
          distribucionIconos: countIconTypes(board)
        });
        
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

  // Añadir un efecto específico para manejar cambios en la velocidad
  useEffect(() => {
    // Solo reiniciar los temporizadores si el juego está activo
    if (status === 'playing' && timersActiveRef.current) {
      // Convertir a multiplicador para incluirlo en los logs
      const baseSpeed = config.SPAWN_RATES.MEDIUM;
      const speedMultiplier = (baseSpeed / spawnRate).toFixed(1);
      
      logger.info('Velocidad de spawn cambiada, reiniciando temporizadores', { 
        nuevaVelocidad: spawnRate,
        multiplicador: `x${speedMultiplier}`,
        modo: currentPlayMode
      });
      
      // Detener solo el temporizador de spawn
      if (iconTimerRef.current) {
        clearInterval(iconTimerRef.current);
        iconTimerRef.current = null; // Limpiar la referencia
      }
      
      // Reiniciar temporizador con la nueva velocidad después de una breve pausa
      // Esto evita posibles condiciones de carrera
      setTimeout(() => {
        if (status === 'playing') {
          iconTimerRef.current = setInterval(() => {
            // Obtener el estado más reciente
            const state = store.getState().game;
            
            if (state.status !== 'playing') {
              return; // No añadir iconos si el juego no está en curso
            }
            
            // Añadir icono
            addRandomIcon();
          }, spawnRate);
          
          logger.debug('Temporizador de iconos reiniciado con nueva velocidad', { 
            spawnRate,
            timerActive: iconTimerRef.current !== null
          });
        }
      }, 50);
    }
  }, [spawnRate, status, addRandomIcon, currentPlayMode]);

  // Función auxiliar para contar movimientos válidos
  const countValidMoves = useCallback((): number => {
    // Si no hay tablero, no hay movimientos
    if (!board || board.length === 0) return 0;
    
    // Obtener el tablero más actualizado
    const currentBoard = store.getState().game.board;
    let validMovesCount = 0;
    
    // Revisar cada celda vacía
    for (let row = 0; row < boardSize; row++) {
      for (let col = 0; col < boardSize; col++) {
        if (currentBoard[row][col] === null) {
          // Buscar convergencias en esta celda
          const convergingIcons = findConvergingIcons(row, col);
          if (convergingIcons.length >= 2) {
            validMovesCount++;
          }
        }
      }
    }
    
    return validMovesCount;
  }, [board, boardSize, findConvergingIcons]);
  
  // Función auxiliar para contar tipos de iconos en el tablero
  const countIconTypes = useCallback((currentBoard: (string | null)[][]): Record<string, number> => {
    const iconCounts: Record<string, number> = {};
    
    // Contar cada tipo de icono
    for (let row = 0; row < boardSize; row++) {
      for (let col = 0; col < boardSize; col++) {
        const icon = currentBoard[row][col];
        if (icon !== null) {
          // Eliminar cualquier sufijo de animación (_removing)
          const baseIcon = icon.replace('_removing', '');
          iconCounts[baseIcon] = (iconCounts[baseIcon] || 0) + 1;
        }
      }
    }
    
    return iconCounts;
  }, [boardSize]);

  // Calcular la velocidad inicial para un nivel específico
  const calculateInitialSpeedForLevel = useCallback((levelNum: number, mode: string): number => {
    // Obtener la configuración del modo
    const modeConfig = mode.toUpperCase() === 'CLASSIC' 
      ? config.GAME_MODES.CLASSIC
      : mode.toUpperCase() === 'TIMED'
        ? config.GAME_MODES.TIMED
        : config.GAME_MODES.SURVIVAL;
    
    // Velocidad base del modo
    const baseSpeed = modeConfig.initialSpawnRate;
    
    // Reducción por nivel (más nivel = más velocidad = menos ms)
    // Niveles 1-2: normal, 3-4: más rápido, 5+: muy rápido
    let levelReduction = 0;
    
    if (levelNum <= 2) {
      levelReduction = 0; // Sin reducción
    } else if (levelNum <= 4) {
      levelReduction = 0.15; // 15% más rápido
    } else {
      levelReduction = 0.25; // 25% más rápido 
    }
    
    // Aplicar reducción
    return Math.round(baseSpeed * (1 - levelReduction));
  }, []);

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
    findConvergingIcons,
    // Nueva función para cambiar la configuración del juego
    changeGameConfig: useCallback((difficulty: GameDifficulty, mode: GamePlayMode) => {
      logger.info('Cambiando configuración del juego', { dificultad: difficulty, modo: mode });
      
      // Actualizar el modo y la dificultad en el estado
      dispatch(setGameMode(difficulty));
      dispatch(setPlayMode(mode));
      
      // Obtener la configuración para el nivel actual con esta dificultad y modo
      const { level: currentLevel } = store.getState().game;
      
      // Obtener el conjunto de iconos para el nivel actual
      const iconSet = config.getIconSetForLevel(currentLevel);
      
      // Obtener el tamaño del tablero para el nivel actual basado en la configuración
      const boardSize = config.getBoardSizeForLevel(currentLevel);
      
      // Obtener la configuración completa de juego
      const gameConfig = config.getGameConfig(difficulty, mode);
      
      // Detener temporizadores existentes
      stopTimers();
      
      // Actualizar el estado según la nueva configuración
      dispatch(setBoardSize(boardSize));
      dispatch(setAvailableIcons(iconSet));
      dispatch(setSpawnRate(gameConfig.initialSpawnRate));
      
      // Actualizar objetivos y límites según el modo de juego
      if (mode === 'classic') {
        dispatch(setLevelTarget({ 
          score: gameConfig.initialScoreTarget || 1000,
          occupation: gameConfig.initialOccupationTarget || 70
        }));
      } else if (mode === 'timed') {
        dispatch(setLevelTimeLimit(gameConfig.initialTimeLimit || 120));
      }
      
      // Reiniciar el tablero con la nueva configuración
      initializeBoard(gameConfig.initialIcons || config.INITIAL_ICONS);
      
      // Reiniciar temporizadores con la nueva configuración
      if (status === 'playing') {
        startTimers();
      }
      
      logger.info('Configuración de juego actualizada', {
        dificultad: difficulty,
        modo: mode,
        nivel: currentLevel,
        tamaño: boardSize,
        iconos: iconSet.length
      });
    }, [dispatch, initializeBoard, startTimers, stopTimers, status])
  };
}; // fin del hook

// Exportar el hook
export default useGameLogic;