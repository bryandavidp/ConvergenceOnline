import { useCallback, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { 
  incrementScore, 
  updateBoard, 
  setIconCount,
  setGameStatus,
  setSpawnRate,
  incrementTimer,
  useHint,
  resetHintCooldown,
  setHighlightedCells,
  setAvailableIcons,
  setLevel,
  setBoardSize,
  setLevelTarget,
  setLevelTimeLimit,
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
import { 
  isValidCell, 
  getRandomInt, 
  shuffleArray, 
  calculateBoardOccupation,
  calculateInitialSpeedForLevel,
  checkBoardForValidMoves,
  findConvergences,
  findConvergingIcons
} from '../utils/gameUtils';
import { audioManager } from '../utils/audioManager';
import { adjustBoardVisuals } from '../utils/boardUtils';

// Logger específico para este hook
const logger = createLogger('useGameLogic');

// Constantes de configuración del juego
const MIN_SPAWN_RATE = 300; // Velocidad máxima (tiempo mínimo entre iconos)
const INITIAL_SPAWN_RATE = 3000; // Velocidad inicial (tiempo entre iconos)
const MAX_OCCUPATION_PERCENTAGE = 80; // Porcentaje máximo de ocupación del tablero
const INITIAL_ICONS = 5; // Número de iconos iniciales al comenzar el juego

// Constantes para el manejo de fin de partida
const OCCUPATION_THRESHOLD_GAME_OVER = 60; // % de ocupación para Game Over cuando no hay movimientos
const OCCUPATION_THRESHOLD_NEXT_LEVEL = 30; // % de ocupación para pasar al siguiente nivel cuando no hay movimientos

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
    hintCooldown
  } = useSelector((state: RootState) => state.game);
  
  // Referencias para temporizadores y estados del juego
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const iconTimerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isRemovingIconsRef = useRef<boolean>(false);
  const isSpawningRef = useRef<boolean>(false);
  const speedLimitReachedRef = useRef<boolean>(false);
  const hintTimerRef = useRef<NodeJS.Timeout | null>(null);
  const cellRefs = useRef<Record<string, HTMLElement>>({});
  const timersActiveRef = useRef<boolean>(false);
  const isInitializedRef = useRef<boolean>(false);
  const lastSpawnRateRef = useRef<number | null>(null);
  
  // Función para registrar celda en el DOM (referencias)
  const registerCellRef = useCallback((row: number, col: number, element: HTMLElement | null) => {
    const key = `${row}-${col}`;
    if (element) {
      cellRefs.current[key] = element;
    } else {
      delete cellRefs.current[key];
    }
  }, []);
  
  // Verificar si hay movimientos válidos en el tablero
  const hasValidMoves = useCallback(() => {
    return checkBoardForValidMoves(board, boardSize, availableIcons);
  }, [board, boardSize, availableIcons]);
  
  // Encontrar posiciones iniciales válidas para el tablero
  const findValidInitialPositions = useCallback(() => {
    const boardArray = Array(boardSize).fill(null).map(() => Array(boardSize).fill(null));
    
    if (availableIcons.length < 4) {
      logger.error('No hay suficientes iconos disponibles para crear un tablero inicial válido');
      return [];
    }
    
    const shuffledIcons = shuffleArray([...availableIcons]);
    const icon1 = shuffledIcons[0];
    const icon2 = shuffledIcons[1];
    
    const positions: Array<{ row: number; col: number; icon: string }> = [];
    
    const directions = [
      { dr: -1, dc: 0 }, // arriba
      { dr: 0, dc: 1 },  // derecha
      { dr: 1, dc: 0 },  // abajo
      { dr: 0, dc: -1 }  // izquierda
    ];
    
    const centerRow = getRandomInt(2, boardSize - 2);
    const centerCol = getRandomInt(2, boardSize - 2);
    
    const dir1Index = getRandomInt(0, 4);
    let dir2Index = getRandomInt(0, 4);
    while (Math.abs(dir1Index - dir2Index) === 2) {
      dir2Index = getRandomInt(0, 4);
    }
    
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
    
    const centerPos = { row: centerRow, col: centerCol, icon: icon1 };
    positions.push(centerPos);
    boardArray[centerRow][centerCol] = icon1;
    
    for (let i = 0; i < Math.min(8, boardSize); i++) {
      let row, col;
      let attempts = 0;
      let validPosition = false;
      
      while (!validPosition && attempts < 20) {
        row = getRandomInt(0, boardSize);
        col = getRandomInt(0, boardSize);
        attempts++;
        
        if (boardArray[row][col] === null) {
          boardArray[row][col] = icon2;
          
          const result = findConvergences(boardArray, row, col, boardSize);
          
          if (!result.hasConvergence) {
            positions.push({ row, col, icon: icon2 });
            validPosition = true;
          } else {
            boardArray[row][col] = null;
          }
        }
      }
    }
    
    return positions;
  }, [boardSize, availableIcons]);
  
  // Inicializar tablero con iconos iniciales
  const initializeBoard = useCallback((size: number = boardSize) => {
    logger.info('Inicializando tablero', { tamaño: size, modoJuego: currentPlayMode });
    
    const newBoard = Array(size).fill(null).map(() => Array(size).fill(null));
    
    let totalIcons = INITIAL_ICONS;
    
    if (currentPlayMode === 'classic') {
      totalIcons = 7;
    } else if (currentPlayMode === 'timed') {
      totalIcons = 10;
    } else if (currentPlayMode === 'survival') {
      totalIcons = 15;
    }
    
    totalIcons = Math.min(totalIcons, Math.floor(size * size * 0.4));
    
    const validPositions = findValidInitialPositions();
    
    if (validPositions.length > 0) {
      for (const { row, col, icon } of validPositions) {
        newBoard[row][col] = icon;
      }
    }
    
    dispatch(updateBoard(newBoard));
    
    let actualIconCount = 0;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (newBoard[r][c] !== null) {
          actualIconCount++;
        }
      }
    }
    
    dispatch(setIconCount(actualIconCount));
    
    if (currentPlayMode === 'classic') {
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
      const timeLimit = config.GAME_MODE_CONFIG.TIMED.initialTimeLimit - 
                       (level - 1) * config.GAME_MODE_CONFIG.TIMED.timeDecreasePerLevel;
      
      dispatch(setLevelTimeLimit(Math.max(30, timeLimit)));
    }
    
    isInitializedRef.current = true;
    
    const initialSpawnRate = calculateInitialSpeedForLevel(level, currentPlayMode, config.GAME_MODES, MIN_SPAWN_RATE);
    dispatch(setSpawnRate(initialSpawnRate));
    
    return newBoard;
  }, [dispatch, boardSize, currentPlayMode, level, findValidInitialPositions]);
  
  // Añadir un icono aleatorio al tablero
  const addRandomIcon = useCallback(() => {
    isSpawningRef.current = true;
    
    try {
      const { 
        board: currentBoard, 
        status: gameStatus,
        iconCount: currentIconCount,
        boardSize: currentBoardSize,
      } = store.getState().game;
      
      if (gameStatus !== 'playing' || !currentBoard || !currentBoard.length) {
        return;
      }
      
      const totalCells = currentBoardSize * currentBoardSize;
      const maxIconsAllowed = Math.floor(totalCells * MAX_OCCUPATION_PERCENTAGE / 100);
      
      if (currentIconCount >= maxIconsAllowed) {
        if (!hasValidMoves()) {
          const ocupacionPorcentaje = (currentIconCount / totalCells) * 100;
          
          if (ocupacionPorcentaje > OCCUPATION_THRESHOLD_GAME_OVER) {
            dispatch(setGameStatus('gameOver'));
          }
        }
        return;
      }
      
      const emptyCells: {row: number, col: number}[] = [];
      
      if (totalCells > 100) {
        let attempts = 0;
        const maxAttempts = Math.min(50, totalCells / 2);
        
        while (emptyCells.length < 10 && attempts < maxAttempts) {
          const randomRow = Math.floor(Math.random() * currentBoardSize);
          const randomCol = Math.floor(Math.random() * currentBoardSize);
          
          if (currentBoard[randomRow][randomCol] === null) {
            emptyCells.push({ row: randomRow, col: randomCol });
          }
          attempts++;
        }
        
        if (emptyCells.length < 3) {
          emptyCells.length = 0;
          
          for (let row = 0; row < currentBoardSize; row++) {
            for (let col = 0; col < currentBoardSize; col++) {
              if (currentBoard[row][col] === null) {
                emptyCells.push({ row, col });
                if (emptyCells.length >= 20) break;
              }
            }
            if (emptyCells.length >= 20) break;
          }
        }
      } else {
        for (let row = 0; row < currentBoardSize; row++) {
          for (let col = 0; col < currentBoardSize; col++) {
            if (currentBoard[row][col] === null) {
              emptyCells.push({ row, col });
            }
          }
        }
      }
      
      if (emptyCells.length === 0) {
        const hasMovesLeft = hasValidMoves();
        
        if (!hasMovesLeft) {
          const ocupacionPorcentaje = (currentIconCount / totalCells) * 100;
          
          if (ocupacionPorcentaje > OCCUPATION_THRESHOLD_GAME_OVER) {
            dispatch(setGameStatus('gameOver'));
          } else {
            dispatch(setGameStatus('levelCompleted'));
          }
        }
        
        return;
      }
      
      const randomIndex = Math.floor(Math.random() * emptyCells.length);
      const { row, col } = emptyCells[randomIndex];
      
      const randomIcon = availableIcons[Math.floor(Math.random() * availableIcons.length)];
      
      const updatedBoard = currentBoard.map(r => [...r]);
      updatedBoard[row][col] = randomIcon;
      
      dispatch(updateBoard(updatedBoard));
      dispatch(setIconCount(currentIconCount + 1));
      
      audioManager.play('newIcon');
      
      if (!hasValidMoves()) {
        const newOcupacionPorcentaje = ((currentIconCount + 1) / totalCells) * 100;
        
        if (newOcupacionPorcentaje > OCCUPATION_THRESHOLD_GAME_OVER || 
            currentPlayMode === 'survival') {
          dispatch(setGameStatus('gameOver'));
        }
      }
    } finally {
      isSpawningRef.current = false;
    }
  }, [dispatch, hasValidMoves, currentPlayMode, availableIcons]);

  // Detener todos los temporizadores del juego
  const stopTimers = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    
    if (iconTimerIntervalRef.current) {
      clearInterval(iconTimerIntervalRef.current);
      iconTimerIntervalRef.current = null;
    }
    
    timersActiveRef.current = false;
  }, []);

  // Iniciar los temporizadores del juego
  const startTimers = useCallback(() => {
    if (timersActiveRef.current) {
      return;
    }
    
    timersActiveRef.current = true;
    lastSpawnRateRef.current = spawnRate;
    
    timerIntervalRef.current = setInterval(() => {
      dispatch(incrementTimer());
      
      if (currentPlayMode === 'survival' && !speedLimitReachedRef.current) {
        const currentTimer = store.getState().game.timer;
        
        const newSpawnRate = Math.max(
          MIN_SPAWN_RATE,
          INITIAL_SPAWN_RATE * Math.pow(0.99, Math.floor(currentTimer / 3))
        );
        
        if (newSpawnRate <= MIN_SPAWN_RATE) {
          speedLimitReachedRef.current = true;
        }
        
        if (Math.abs(newSpawnRate - spawnRate) > 50) {
          dispatch(setSpawnRate(newSpawnRate));
        }
      }
    }, 1000);
    
    iconTimerIntervalRef.current = setInterval(() => {
      if (isSpawningRef.current) {
        return;
      }
      
      const gameStatus = store.getState().game.status;
      if (gameStatus !== 'playing') {
        return;
      }
      
      addRandomIcon();
    }, spawnRate);
    
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      if (iconTimerIntervalRef.current) {
        clearInterval(iconTimerIntervalRef.current);
      }
    };
  }, [spawnRate, currentPlayMode, dispatch, addRandomIcon]);

  // Manejar clic en una celda del tablero
  const handleIconClick = useCallback((row: number, col: number) => {
    if (status !== 'playing' || isRemovingIconsRef.current) {
      return;
    }
    
    audioManager.play('click');
    dispatch(setHighlightedCells([]));
    
    if (board[row][col] === null) {
      // Obtener todos los iconos en las cuatro direcciones
      const directIcons: { row: number; col: number; icon: string }[] = [];
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
        
        while (r >= 0 && r < boardSize && c >= 0 && c < boardSize) {
          if (board[r][c] !== null) {
            const icon = board[r][c] as string;
            if (!icon.includes('_removing')) {
              directIcons.push({ row: r, col: c, icon });
            }
            break;
          }
          r += dr;
          c += dc;
        }
      }
      
      // Agrupar por tipo de icono
      const iconsByType: { [iconType: string]: { row: number; col: number }[] } = {};
      for (const item of directIcons) {
        if (!iconsByType[item.icon]) {
          iconsByType[item.icon] = [];
        }
        iconsByType[item.icon].push({ row: item.row, col: item.col });
      }
      
      // Recopilar todos los grupos de iconos con 2 o más del mismo tipo
      const iconsToRemove: { row: number; col: number }[] = [];
      for (const icon in iconsByType) {
        if (iconsByType[icon].length >= 2) {
          iconsToRemove.push(...iconsByType[icon]);
        }
      }
      
      if (iconsToRemove.length >= 2) {
        audioManager.play('convergingFound');
        isRemovingIconsRef.current = true;
        
        const currentBoard = board.map(row => [...row]);
        dispatch(setHighlightedCells(iconsToRemove));
        
        // Marcar los iconos que se eliminarán
        const markingBoard = currentBoard.map(row => [...row]);
        for (const cell of iconsToRemove) {
          const cellIcon = markingBoard[cell.row][cell.col];
          if (cellIcon !== null) {
            markingBoard[cell.row][cell.col] = `${cellIcon}_removing`;
          }
        }
        
        dispatch(updateBoard(markingBoard));
        
        setTimeout(() => {
          const finalBoard = markingBoard.map(row => [...row]);
          let removedCount = 0;
          
          // Eliminar todos los iconos marcados
          for (const cell of iconsToRemove) {
            finalBoard[cell.row][cell.col] = null;
            removedCount++;
          }
          
          dispatch(updateBoard(finalBoard));
          
          const pointsEarned = removedCount * 10 * level;
          dispatch(incrementScore(pointsEarned));
          
          const newIconCount = iconCount - removedCount;
          dispatch(setIconCount(newIconCount));
          
          audioManager.play('removeIcon');
          dispatch(setHighlightedCells([]));
          
          if (newIconCount === 0) {
            dispatch(incrementScore(config.SCORE_VALUES.EMPTY_BOARD_BONUS));
            dispatch(setGameStatus('levelCompleted'));
            audioManager.play('levelComplete');
          } else if (!hasValidMoves()) {
            const ocupacionPorcentaje = calculateBoardOccupation(newIconCount, boardSize);
            
            if (ocupacionPorcentaje < OCCUPATION_THRESHOLD_NEXT_LEVEL) {
              dispatch(setGameStatus('levelCompleted'));
            } else if (ocupacionPorcentaje > OCCUPATION_THRESHOLD_GAME_OVER || currentPlayMode === 'survival') {
              dispatch(setGameStatus('gameOver'));
            }
          }
          
          isRemovingIconsRef.current = false;
        }, 150);
        
        return;
      }
    }
    
    audioManager.play('invalid');
    
    const emptyCell = { row, col };
    dispatch(setHighlightedCells([emptyCell]));
    
    setTimeout(() => {
      dispatch(setHighlightedCells([]));
    }, 300);
    
  }, [
    board, 
    status, 
    boardSize, 
    iconCount, 
    level, 
    currentPlayMode,
    dispatch, 
    hasValidMoves
  ]);

  // Ajustar el tamaño visual del tablero
  const adjustBoardSize = useCallback((container: HTMLElement, boardElement: HTMLElement) => {
    adjustBoardVisuals(container, boardElement);
  }, []);

  // Función para mostrar pistas (destacar convergencias potenciales)
  const showHint = useCallback(() => {
    if (hintsRemaining <= 0 || hintCooldown === true) {
      return false;
    }
    
    let foundConvergence = false;
    let convergingCells: {row: number, col: number}[] = [];
    
    for (let row = 0; row < boardSize && !foundConvergence; row++) {
      for (let col = 0; col < boardSize && !foundConvergence; col++) {
        if (board[row][col] !== null) {
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
      dispatch(useHint());
      dispatch(setHighlightedCells(convergingCells));
      audioManager.play('hint');
      
      if (hintTimerRef.current) {
        clearTimeout(hintTimerRef.current);
      }
      
      hintTimerRef.current = setTimeout(() => {
        dispatch(setHighlightedCells([]));
        hintTimerRef.current = null;
      }, 2000);
      
      dispatch(resetHintCooldown());
      return true;
    } else {
      return false;
    }
  }, [board, boardSize, hintsRemaining, hintCooldown, dispatch]);
  
  // Reiniciar el nivel actual
  const resetCurrentLevel = useCallback(() => {
    stopTimers();
    
    setTimeout(() => {
      initializeBoard();
      dispatch(rechargeHint());
      startTimers();
    }, 100);
    
    return true;
  }, [dispatch, stopTimers, initializeBoard, startTimers]);
  
  // Avanzar al siguiente nivel
  const advanceToNextLevel = useCallback(() => {
    dispatch(setLevel(level + 1));
    stopTimers();
    initializeBoard();
    dispatch(rechargeHint());
    dispatch(setGameStatus('playing'));
  }, [dispatch, level, initializeBoard, stopTimers]);

  // Efecto para manejar cambios en la velocidad
  useEffect(() => {
    if (status === 'playing' && timersActiveRef.current && 
        (lastSpawnRateRef.current === null || lastSpawnRateRef.current !== spawnRate)) {
      
      lastSpawnRateRef.current = spawnRate;
      
      if (iconTimerIntervalRef.current) {
        clearInterval(iconTimerIntervalRef.current);
        iconTimerIntervalRef.current = null;
      }
      
      setTimeout(() => {
        if (status === 'playing' && timersActiveRef.current) {
          iconTimerIntervalRef.current = setInterval(() => {
            const state = store.getState().game;
            
            if (state.status !== 'playing') {
              return;
            }
            
            addRandomIcon();
          }, spawnRate);
        }
      }, 50);
    }
  }, [spawnRate, status, addRandomIcon]);

  // Cambiar configuración del juego
  const changeGameConfig = useCallback((difficulty: GameDifficulty, mode: GamePlayMode) => {
    dispatch(setGameMode(difficulty));
    dispatch(setPlayMode(mode));
    
    const { level: currentLevel } = store.getState().game;
    const iconSet = config.getIconSetForLevel(currentLevel);
    const boardSize = config.getBoardSizeForLevel(currentLevel);
    const gameConfig = config.getGameConfig(difficulty, mode);
    
    stopTimers();
    
    dispatch(setBoardSize(boardSize));
    dispatch(setAvailableIcons(iconSet));
    dispatch(setSpawnRate(gameConfig.initialSpawnRate));
    
    if (mode === 'classic') {
      dispatch(setLevelTarget({ 
        score: gameConfig.initialScoreTarget || 1000,
        occupation: gameConfig.initialOccupationTarget || 70
      }));
    } else if (mode === 'timed') {
      dispatch(setLevelTimeLimit(gameConfig.initialTimeLimit || 120));
    }
    
    initializeBoard(gameConfig.initialIcons || config.INITIAL_ICONS);
    
    if (status === 'playing') {
      startTimers();
    }
  }, [dispatch, initializeBoard, startTimers, stopTimers, status]);

  return {
    board,
    boardSize,
    status,
    iconCount,
    level,
    score,
    highlightedCells,
    initializeBoard,
    handleIconClick,
    adjustBoardSize,
    stopTimers,
    startTimers,
    registerCellRef,
    showHint,
    resetCurrentLevel,
    advanceToNextLevel,
    findConvergingIcons: useCallback((row: number, col: number) => {
      return findConvergingIcons(board, row, col, boardSize);
    }, [board, boardSize]),
    changeGameConfig
  };
};

export default useGameLogic;