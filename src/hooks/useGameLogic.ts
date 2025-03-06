import { useCallback, useEffect, useRef, useState } from 'react';
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
  setPlayMode,
/*   changeBoardSize,
  changeSpawnRate,
  addScore, 
  removeIcon, 
  addIcon,  */
  GameState, 
/*   setScore, 
  resetBoard, 
  highlightCells, 
  setHintCooldown */
} from '../store/slices/gameSlice';
import { RootState } from '../store';
import { store } from '../store';
import logger from '../utils/logger';
import * as config from '../utils/config';
import { 
  isValidCell, 
  getRandomInt, 
  shuffleArray, 
  calculateBoardOccupation,
  calculateInitialSpeedForLevel,
  checkBoardForValidMoves,
  findConvergences,
  findConvergingIcons,
/*   getCellsInSpiral, 
  areCellsAdjacent, 
  getRandomEmptyCell */
} from '../utils/gameUtils';
import { audioManager } from '../utils/audioManager';
import * as boardUtils from '../utils/boardUtils';
import { adjustBoardVisuals } from '../utils/boardUtils';
import * as levelAdapter from '../utils/levelAdapter';

// Constantes de configuración del juego - Obtenidas directamente de config.ts
const MIN_SPAWN_RATE = config.MIN_SPAWN_RATE;
const INITIAL_SPAWN_RATE = config.INITIAL_SPAWN_RATE;
const MAX_OCCUPATION_PERCENTAGE = config.MAX_OCCUPATION_PERCENTAGE;
const INITIAL_ICONS = config.INITIAL_ICONS;

// Constantes para el manejo de fin de partida
// const OCCUPATION_THRESHOLD_GAME_OVER = 60; // % de ocupación para Game Over cuando no hay movimientos
// const OCCUPATION_THRESHOLD_NEXT_LEVEL = 30; // % de ocupación para pasar al siguiente nivel cuando no hay movimientos

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
    currentDifficulty,
    score,
    level,
    highlightedCells,
    hintsRemaining,
    hintCooldown,
    timeRemaining,
    survivalTime
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
  const timerRef = useRef<number>(0);
  
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
  
  // Inicializar tablero con iconos iniciales
  const initializeBoard = useCallback((size: number = boardSize) => {
    logger.info('Inicializando tablero', `Tamaño: ${size}, Modo: ${currentPlayMode}`);
    
    const newBoard = Array(size).fill(null).map(() => Array(size).fill(null));
    
    // Obtener la cantidad de iconos iniciales según el modo de juego desde la configuración
    const modeConfig = config.getGameModeConfig(currentPlayMode);
    const difficultyConfig = config.getDifficultyConfig(currentDifficulty);
    
    // Priorizar initialIcons de modeConfig, luego initialIconCount de difficultyConfig, 
    // finalmente caer al valor por defecto INITIAL_ICONS
    let totalIcons = modeConfig?.initialIcons || 
                     difficultyConfig?.initialIconCount || 
                     config.INITIAL_ICONS;

    console.log('totalIcons', totalIcons);
    
    // Limitar la cantidad de iconos iniciales a un porcentaje máximo del tablero
    // totalIcons = Math.min(totalIcons, Math.floor(size * size * 0.4));
    // console.log('totalIcons', totalIcons);
    logger.info(`Inicializando tablero con ${totalIcons} iconos iniciales`, 
              `Modo: ${currentPlayMode}, Dificultad: ${currentDifficulty}`);
    
    // Primero colocamos unos pocos iconos en posiciones estratégicas para garantizar
    // que el jugador tenga al menos un movimiento válido disponible
    const shuffledIcons = shuffleArray([...availableIcons]);
    const icon1 = shuffledIcons[0];
    
    // Colocar grupo inicial de 3 iconos iguales en forma de L o T
    const centerRow = getRandomInt(2, size - 3);
    const centerCol = getRandomInt(2, size - 3);
    
    // Centro
    newBoard[centerRow][centerCol] = icon1;
    
    // Dos posiciones adyacentes para formar la L o T
    const directions = [
      { dr: -1, dc: 0 }, // arriba
      { dr: 0, dc: 1 },  // derecha
      { dr: 1, dc: 0 },  // abajo
      { dr: 0, dc: -1 }  // izquierda
    ];
    
    const dir1Index = getRandomInt(0, 4);
    let dir2Index = getRandomInt(0, 4);
    while (Math.abs(dir1Index - dir2Index) === 2) {
      dir2Index = getRandomInt(0, 4);
    }
    
    const dir1 = directions[dir1Index];
    newBoard[centerRow + dir1.dr][centerCol + dir1.dc] = icon1;
    
    const dir2 = directions[dir2Index];
    newBoard[centerRow + dir2.dr][centerCol + dir2.dc] = icon1;
    
    // Contamos cuántos iconos hemos colocado hasta ahora
    let placedIcons = 3;
    
    // Añadir iconos aleatorios adicionales hasta alcanzar totalIcons
    while (placedIcons < totalIcons) {
      const row = getRandomInt(0, size);
      const col = getRandomInt(0, size);
      
      // Solo colocamos en celdas vacías
      if (newBoard[row][col] === null) {
        // Elegir un icono aleatorio, evitando generar convergencias
        let validIcon = false;
        let attempts = 0;
        
        while (!validIcon && attempts < 10) {
          const iconIndex = getRandomInt(0, availableIcons.length);
          const icon = availableIcons[iconIndex];
          
          // Probar si este icono causaría una convergencia
          newBoard[row][col] = icon;
          
          // Verificar manualmente si causaría una convergencia en lugar de usar findConvergences
          let hasConvergence = false;
          const directions = [
            { dr: -1, dc: 0 }, // arriba
            { dr: 0, dc: 1 },  // derecha
            { dr: 1, dc: 0 },  // abajo
            { dr: 0, dc: -1 }  // izquierda
          ];
          
          // Revisar en cada dirección si hay 2+ iconos iguales consecutivos
          for (const dir of directions) {
            let count = 1; // El propio icono
            
            // Contar hacia adelante
            let r = row + dir.dr;
            let c = col + dir.dc;
            while (isValidCell(r, c, size) && newBoard[r][c] === icon) {
              count++;
              r += dir.dr;
              c += dir.dc;
            }
            
            // Contar hacia atrás
            r = row - dir.dr;
            c = col - dir.dc;
            while (isValidCell(r, c, size) && newBoard[r][c] === icon) {
              count++;
              r -= dir.dr;
              c -= dir.dc;
            }
            
            if (count >= 3) {
              hasConvergence = true;
              break;
            }
          }
          
          if (!hasConvergence) {
            validIcon = true;
            placedIcons++;
          } else {
            // Si causa convergencia, eliminarlo y probar otro
            newBoard[row][col] = null;
          }
          
          attempts++;
        }
        
        // Si después de varios intentos no encontramos un icono válido,
        // dejamos la celda vacía y continuamos
        if (!validIcon) {
          newBoard[row][col] = null;
        }
      }
    }
    
    dispatch(updateBoard(newBoard));
    
    // Contar el número real de iconos colocados
    let actualIconCount = 0;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (newBoard[r][c] !== null) {
          actualIconCount++;
        }
      }
    }
    
    logger.info(`Tablero inicializado con ${actualIconCount} iconos`, 
               `Objetivo: ${totalIcons}, Tamaño tablero: ${size}x${size}`);
    
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
  }, [dispatch, boardSize, currentPlayMode, level, currentDifficulty, availableIcons]);
  
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
      
      // Verificar si hay movimientos válidos ANTES de añadir un icono
      const hasMovesAvailable = hasValidMoves();
      if (!hasMovesAvailable) {
        const totalCells = currentBoardSize * currentBoardSize;
        const occupationPercentage = (currentIconCount / totalCells) * 100;
        
        // Verificar si hay 2 o menos iconos en el tablero
        if (currentIconCount <= 2) {
          logger.info('Game', `Solo quedan ${currentIconCount} iconos sin movimientos válidos. Nivel completado.`);
          dispatch(setGameStatus('levelCompleted'));
          return; // Importante: prevenir la aparición del nuevo icono
        }
        // Si hay pocos iconos, pasar al siguiente nivel
        else if (occupationPercentage <= 30) {
          logger.info('Game', `Tablero con pocos iconos sin movimientos válidos (${occupationPercentage.toFixed(1)}%). Nivel completado.`);
          dispatch(setGameStatus('levelCompleted'));
          return; // Prevenir la aparición del nuevo icono
        } 
        // Si no, game over
        else {
          logger.info('Game', `Tablero sin movimientos válidos (${occupationPercentage.toFixed(1)}%). Game over.`);
          dispatch(setGameStatus('gameOver'));
          return; // Prevenir la aparición del nuevo icono
        }
      }
      
      const totalCells = currentBoardSize * currentBoardSize;
      const maxIconsAllowed = totalCells; // Permitir llenar todo el tablero
      
      if (currentIconCount >= maxIconsAllowed) {
        if (!hasValidMoves()) {
          // Si no hay movimientos válidos y estamos en el límite de iconos, es game over
          dispatch(setGameStatus('gameOver'));
        }
        return;
      }
      
      const emptyCells: {row: number, col: number}[] = [];
      
      // Simplificar la búsqueda de celdas vacías - buscar todas las celdas vacías
      for (let row = 0; row < currentBoardSize; row++) {
        for (let col = 0; col < currentBoardSize; col++) {
          if (currentBoard[row][col] === null) {
            emptyCells.push({ row, col });
          }
        }
      }
      
      if (emptyCells.length === 0) {
        const hasMovesLeft = hasValidMoves();
        
        if (!hasMovesLeft) {
          // Calcular el porcentaje de ocupación
          const occupationPercentage = (currentIconCount / totalCells) * 100;
          
          // Si hay pocos iconos, pasar al siguiente nivel
          if (occupationPercentage <= 30) {
            dispatch(setGameStatus('levelCompleted'));
            logger.info(`Tablero con pocos iconos sin movimientos válidos (${occupationPercentage.toFixed(1)}%). Nivel completado.`, `Tamaño: ${currentBoardSize}, Modo: ${currentPlayMode}`);
          } else {
            // Si no, game over
            dispatch(setGameStatus('gameOver'));
            logger.info(`Tablero lleno sin movimientos válidos (${occupationPercentage.toFixed(1)}%). Game over.`, `Tamaño: ${currentBoardSize}, Modo: ${currentPlayMode}`);
          }
        } else {
          // Si hay movimientos válidos, el juego continúa aunque el tablero esté lleno
          return;
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
        // Si después de añadir un icono no hay movimientos válidos, es game over
        dispatch(setGameStatus('gameOver'));
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
      
      // Manejar el modo contrareloj - decrementar el tiempo restante
      if (currentPlayMode === 'timed') {
        const { timeRemaining, status } = store.getState().game;
        
        if (status === 'playing' && timeRemaining > 0) {
          // Decrementar el tiempo
          const newTimeRemaining = timeRemaining - 1;
          
          // Actualizar el estado
          store.dispatch({
            type: 'game/decrementTimeRemaining'
          });
          
          // Si el tiempo llega a cero, game over
          if (newTimeRemaining === 0) {
            dispatch(setGameStatus('gameOver'));
            audioManager.play('gameOver');
            logger.info('Game', 'Tiempo agotado en modo contrareloj - Game Over');
          }
        }
      }
      
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
        
        removeConvergingIcons(iconsToRemove);
        
        isRemovingIconsRef.current = false;
        
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

  // Función optimizada para eliminar iconos en convergencia
  const removeConvergingIcons = useCallback((iconsToRemove: Array<{row: number, col: number}>) => {
    if (iconsToRemove.length === 0) return;
    
    const currentBoard = board.map(row => [...row]);
    dispatch(setHighlightedCells(iconsToRemove));
    
    // Procesamiento en lote: marcamos todos los iconos primero
    const markingBoard = currentBoard.map(row => [...row]);
    for (const cell of iconsToRemove) {
      const cellIcon = markingBoard[cell.row][cell.col];
      if (cellIcon !== null) {
        markingBoard[cell.row][cell.col] = `${cellIcon}_removing`;
      }
    }
    
    // Actualizamos el board una sola vez con todos los iconos marcados
    dispatch(updateBoard(markingBoard));
    
    // Utilizamos requestAnimationFrame para asegurarnos de que la actualización
    // se sincronice con el ciclo de renderizado del navegador
    requestAnimationFrame(() => {
      // Realizamos la eliminación en lote después de un breve retraso
      // para permitir que la animación se muestre
      setTimeout(() => {
        const finalBoard = markingBoard.map(row => [...row]);
        let removedCount = 0;
        
        // Eliminar todos los iconos marcados
        for (const cell of iconsToRemove) {
          finalBoard[cell.row][cell.col] = null;
          removedCount++;
        }
        
        // Actualizar el tablero una sola vez con todos los iconos eliminados
        dispatch(updateBoard(finalBoard));
        
        const pointsEarned = removedCount * 10 * level;
        dispatch(incrementScore(pointsEarned));
        
        const newIconCount = iconCount - removedCount;
        dispatch(setIconCount(newIconCount));
        
        // Añadir tiempo adicional en el modo contrareloj
        if (currentPlayMode === 'timed') {
          // Añadir 3 segundos por cada icono removido, con un mínimo de 5 segundos
          const timeBonus = Math.max(5, removedCount * 3);
          
          // Dispatch para añadir tiempo
          dispatch({
            type: 'game/addTimeBonus',
            payload: timeBonus
          });
          
          // Mostrar feedback visual/auditivo
          audioManager.play('timeBonus');
          
          logger.info('Game', `Bonus de tiempo añadido: +${timeBonus} segundos`);
        }
        
        audioManager.play('removeIcon');
      }, 50); // Reducido de posibles valores mayores a solo 50ms
    });
  }, [board, currentPlayMode, dispatch, iconCount, level]);

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

  // Efecto para verificar continuamente si hay movimientos válidos
  useEffect(() => {
    if (status === 'playing') {
      // Crear un intervalo que verifique periódicamente si hay movimientos válidos
      const checkMovesInterval = setInterval(() => {
        const { 
          status: gameStatus,
          iconCount: currentIconCount,
          boardSize: currentBoardSize 
        } = store.getState().game;
        
        if (gameStatus !== 'playing') {
          return;
        }
        
        const hasMovesAvailable = hasValidMoves();
        
        if (!hasMovesAvailable) {
          logger.info('Game', 'No se detectaron movimientos válidos, verificando fin de partida...');
          
          // Calcular el porcentaje de ocupación
          const totalCells = currentBoardSize * currentBoardSize;
          const occupationPercentage = (currentIconCount / totalCells) * 100;
          
          // Verificar si hay 2 o menos iconos en el tablero
          // Esta es una condición específica para el caso mostrado en la imagen
          if (currentIconCount <= 2) {
            logger.info('Game', `Solo quedan ${currentIconCount} iconos sin movimientos válidos. Nivel completado.`);
            dispatch(setGameStatus('levelCompleted'));
          }
          // Si hay pocos iconos, pasar al siguiente nivel
          else if (occupationPercentage <= 30) {
            logger.info('Game', `Tablero con pocos iconos sin movimientos válidos (${occupationPercentage.toFixed(1)}%). Nivel completado.`);
            dispatch(setGameStatus('levelCompleted'));
          } 
          // Si no, game over
          else {
            logger.info('Game', `Tablero sin movimientos válidos (${occupationPercentage.toFixed(1)}%). Game over.`);
            dispatch(setGameStatus('gameOver'));
          }
        }
      }, 200); // Verificar cada 200ms en lugar de 1000ms para mayor velocidad
      
      return () => {
        clearInterval(checkMovesInterval);
      };
    }
  }, [status, hasValidMoves, dispatch]);

  // Efecto para verificar el estado después de cualquier cambio en el tablero
  useEffect(() => {
    // Verificar solo si el juego está en estado 'playing'
    if (status === 'playing' && board && board.length > 0) {
      // Usar un timeout inmediato para evitar bloquear el renderizado
      const timeoutId = setTimeout(() => {
        // Verificar si hay movimientos válidos
        const hasMovesAvailable = hasValidMoves();
        
        // Si no hay movimientos disponibles, determinar qué hacer
        if (!hasMovesAvailable) {
          // Contar tipos únicos de iconos en el tablero
          const uniqueIcons = new Set<string>();
          let iconCount = 0;
          
          for (let row = 0; row < boardSize; row++) {
            for (let col = 0; col < boardSize; col++) {
              if (board[row][col] !== null) {
                uniqueIcons.add(board[row][col] as string);
                iconCount++;
              }
            }
          }
          
          // Verificación super rápida para casos especiales (2 o menos iconos diferentes)
          if (iconCount <= 2 && uniqueIcons.size === iconCount) {
            logger.info('Game', `⚡ Detección rápida: ${iconCount} iconos diferentes sin convergencia posible. Nivel completado.`);
            dispatch(setGameStatus('levelCompleted'));
            return;
          }
          
          // Para otros casos, calcular porcentaje de ocupación
          const totalCells = boardSize * boardSize;
          const occupationPercentage = (iconCount / totalCells) * 100;
          
          if (occupationPercentage <= 30) {
            logger.info('Game', `⚡ Detección rápida: Pocos iconos (${occupationPercentage.toFixed(1)}%) sin movimientos válidos. Nivel completado.`);
            dispatch(setGameStatus('levelCompleted'));
          } else {
            logger.info('Game', `⚡ Detección rápida: No hay movimientos válidos (${occupationPercentage.toFixed(1)}%). Game over.`);
            dispatch(setGameStatus('gameOver'));
          }
        }
      }, 0);
      
      return () => clearTimeout(timeoutId);
    }
  }, [board, status, boardSize, hasValidMoves, dispatch]);

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
    
    // Inicializar el tablero con el tamaño actual
    initializeBoard(boardSize);
    
    if (status === 'playing') {
      startTimers();
    }
  }, [dispatch, initializeBoard, startTimers, stopTimers, status]);

  // En la función checkLevelCompleted, reemplazar la lógica actual con el adaptador:
  const checkLevelCompleted = () => {
    if (status !== 'playing' || iconCount === 0) return false;
    
    // Usar el nuevo sistema de niveles a través del adaptador
    return levelAdapter.isLevelCompleted(
      level,
      currentPlayMode,
      score,
      iconCount,
      boardSize,
      timeRemaining,
      survivalTime,
      timerRef.current // Pasar el timer actual para verificar tiempo mínimo de juego
    );
  };
  
  // En la función configureBoardForNewLevel, utilizar el nuevo sistema:
  const configureBoardForNewLevel = () => {
    logger.info(`Configurando tablero para nivel ${level}`, `Tamaño: ${boardSize}, Modo: ${currentPlayMode}`);
    
    // Obtener la configuración del nivel utilizando valores centralizados de config.ts
    const newBoardSize = config.getBoardSizeForLevel(level + 1);
    const newSpawnRate = config.calculateSpawnRate(level + 1, currentPlayMode);
    
    // Determinar iconos adecuados para este nivel y dificultad
    let newIcons: string[];
    if (level + 1 <= config.LEVEL_ICONS.length) {
      // Usar conjuntos predefinidos para niveles básicos
      newIcons = config.getIconSetForLevel(level + 1);
    } else {
      // Para niveles avanzados, usar iconos basados en la dificultad
      newIcons = config.getIconsForLevel(level + 1, currentDifficulty);
    }
    
    // Aplicar la configuración al estado global
    dispatch(setBoardSize(newBoardSize));
    dispatch(setSpawnRate(newSpawnRate));
    dispatch(setAvailableIcons(newIcons));
    
    // Configurar nuevos objetivos según el modo de juego
    if (currentPlayMode === 'classic') {
      // En modo clásico, aumentar la puntuación objetivo y reducir el objetivo de ocupación
      const baseScoreTarget = config.LEVEL_REQUIREMENTS.classic.baseScore;
      const scoreMultiplier = config.LEVEL_REQUIREMENTS.classic.scoreMultiplier;
      const newScoreTarget = Math.floor(baseScoreTarget * Math.pow(scoreMultiplier, level));
      
      const baseOccupation = config.LEVEL_REQUIREMENTS.classic.baseOccupation;
      const occupationDecrease = config.LEVEL_REQUIREMENTS.classic.occupationDecrease;
      // Limitar la ocupación mínima a 20%
      const newOccupationTarget = Math.max(20, baseOccupation - (level * occupationDecrease));
      
      dispatch(setLevelTarget({
        score: newScoreTarget,
        occupation: newOccupationTarget
      }));
    } else if (currentPlayMode === 'timed') {
      // En modo contrarreloj, reducir el tiempo disponible según el nivel
      const baseTime = config.LEVEL_REQUIREMENTS.timed.baseTime;
      const timeDecrease = config.LEVEL_REQUIREMENTS.timed.timeDecreasePerLevel;
      // Limitar el tiempo mínimo a 30 segundos
      const newTimeLimit = Math.max(30, baseTime - (level * timeDecrease));
      
      dispatch(setLevelTimeLimit(newTimeLimit));
    }
    
    // Recargar pistas disponibles
    dispatch(rechargeHint());
    
    // Imprimir información de depuración
    logger.debug('Configuración de nuevo nivel aplicada', {
      nivel: level + 1,
      tamañoTablero: newBoardSize,
      velocidad: newSpawnRate,
      iconos: newIcons.length
    } as unknown as string);
  };

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
    changeGameConfig,
    checkLevelCompleted,
    configureBoardForNewLevel
  };
};

export default useGameLogic;