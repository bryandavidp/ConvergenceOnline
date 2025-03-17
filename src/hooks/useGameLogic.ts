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
  addIcon,
  incrementCombo,
  resetCombo,
  GameState,
  setGameEndReason,
  decrementTimeRemaining
} from '../store/slices/gameSlice';
import { RootState } from '../store';
import { store } from '../store';
import logger from '../utils/logger';
import * as config from '../utils/config';
import { GameMode } from '../utils/config';
import { 
  isValidCell, 
  getRandomInt, 
  shuffleArray, 
  calculateBoardOccupation,
  calculateInitialSpeedForLevel,
  checkBoardForValidMoves,
  findConvergences,
  findConvergingIcons,
  hasValidMoves as hasValidMovesUtil,
  calculateScore,
  placePenaltyIcons,
} from '../utils/gameUtils';
import { audioManager } from '../utils/audioManager';
import * as boardUtils from '../utils/boardUtils';
import { adjustBoardVisuals } from '../utils/boardUtils';
import * as levelAdapter from '../utils/levelAdapter';
import { useNotifications } from '../components/game/GameNotifications/GameNotificationManager';
import { NotificationType } from '../components/game/GameNotifications/GameNotification';
import { checkGameEndCondition } from '../utils/gameEndConditions';
import { 
  getCurrentTimestamp, 
  formatTimestamp, 
  formatTimeDifference,
  getLogTimestamp
} from '../utils/timestamp';
import { 
  useIconSpawner, 
  IconSpawnerConfig 
} from '../utils/iconSpawner';
import {
  useSpeedController
} from '../utils/speedController';

const MIN_SPAWN_RATE = config.MIN_SPAWN_RATE;
const INITIAL_SPAWN_RATE = config.INITIAL_SPAWN_RATE;
const MAX_OCCUPATION_PERCENTAGE = config.MAX_OCCUPATION_PERCENTAGE;
const INITIAL_ICONS = config.INITIAL_ICONS;

type GameStatus = GameState['status'];

interface GameEndResult {
  isGameOver: boolean;
  isVictory: boolean;
  reason: string;
}

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
  
  const { addNotification } = useNotifications();
  
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const iconTimerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isRemovingIconsRef = useRef<boolean>(false);
  const speedLimitReachedRef = useRef<boolean>(false);
  const hintTimerRef = useRef<NodeJS.Timeout | null>(null);
  const cellRefs = useRef<Record<string, HTMLElement>>({});
  const timersActiveRef = useRef<boolean>(false);
  const isInitializedRef = useRef<boolean>(false);
  const lastSpawnRateRef = useRef<number | null>(null);
  const timerRef = useRef<number>(0);
  const lastSpeedIncreaseTimeRef = useRef<number>(0);
  
  const registerCellRef = useCallback((row: number, col: number, element: HTMLElement | null) => {
    const key = `${row}-${col}`;
    if (element) {
      cellRefs.current[key] = element;
    } else {
      delete cellRefs.current[key];
    }
  }, []);
  
  const hasValidMoves = useCallback(() => {
    const gameState = store.getState().game;
    const { board, boardSize, availableIcons } = gameState;
    
    return checkBoardForValidMoves(board, boardSize, availableIcons);
  }, []);
  
  const checkCellForConvergence = (board: (string | null)[][], row: number, col: number): boolean => {
    if (board[row][col] !== null) {
      console.log(`[CONVERGENCE] La celda [${row},${col}] no está vacía, saltando verificación`);
      return false;
    }
    
    const iconCounts: { [key: string]: {count: number, positions: {row: number, col: number}[]} } = {};
    
    const directions = [
      { dr: -1, dc: 0, name: 'arriba' }, 
      { dr: 1, dc: 0, name: 'abajo' }, 
      { dr: 0, dc: -1, name: 'izquierda' }, 
      { dr: 0, dc: 1, name: 'derecha' }
    ];
    
    directions.forEach(({ dr, dc, name }) => {
      let r = row + dr;
      let c = col + dc;
      
      while (r >= 0 && r < boardSize && c >= 0 && c < boardSize) {
        const currentCell = board[r][c];
        
        if (currentCell !== null && !currentCell.includes('_removing')) {
          if (!iconCounts[currentCell]) {
            iconCounts[currentCell] = { count: 0, positions: [] };
          }
          
          iconCounts[currentCell].count++;
          iconCounts[currentCell].positions.push({row: r, col: c});
          
          break;
        }
        
        r += dr;
        c += dc;
      }
    });
    
    let convergencePossible = false;
    let convergenceIcons = [];
    
    for (const icon in iconCounts) {
      if (iconCounts[icon].count >= 2) {
        convergencePossible = true;
        convergenceIcons.push({ 
          icon, 
          count: iconCounts[icon].count,
          positions: iconCounts[icon].positions
        });
      }
    }
    
    if (convergencePossible) {
      console.log(`[CONVERGENCE] Convergencia posible en celda [${row},${col}]:`);
      convergenceIcons.forEach(item => {
        console.log(`[CONVERGENCE] - Icono ${item.icon}: ${item.count} ocurrencias en posiciones: ${JSON.stringify(item.positions)}`);
      });
    }
    
    return convergencePossible;
  };
  
  const initializeBoard = useCallback((
    size = boardSize,
    forceInitialization = false,
    levelOverride?: number
  ) => {
    const { 
      currentDifficulty, 
      currentPlayMode, 
      level,
      boardSize: currentBoardSize 
    } = store.getState().game;

    const targetLevel = levelOverride !== undefined ? levelOverride : level;
    
    console.log("\n**********************************************************");
    console.log("INICIO DEL FLUJO: INICIALIZAR TABLERO");
    console.log(`Tamaño: ${size}, Nivel: ${targetLevel}, Modo: ${currentPlayMode}`);
    console.log(`Estado: ${status}, Dificultad: ${currentDifficulty}`);
    
    const availableIcons = store.getState().game.availableIcons;
    console.log(`Iconos para nivel ${targetLevel}: ${availableIcons.join(', ').substring(0, 100)}${availableIcons.length > 10 ? '...' : ''}`);
    console.log("**********************************************************");

    if (targetLevel <= 0 || (!forceInitialization && isInitializedRef.current && currentBoardSize === size)) {
      console.log(`ADVERTENCIA: Tablero ya inicializado o condiciones no válidas para inicialización`);
      return board;
    }

    isInitializedRef.current = false;
    
    const actualSize = size || config.getLevelBoardSize(targetLevel);
    
    const newBoard: (string | null)[][] = Array(actualSize).fill(null).map(() => Array(actualSize).fill(null));
    
    const difficultyConfig = config.getDifficultyConfig(currentDifficulty);
    
    let totalIcons: number;
    
    if (difficultyConfig && difficultyConfig.initialIconCount !== undefined) {
      totalIcons = difficultyConfig.initialIconCount;
      console.log(`Usando initialIconCount de dificultad ${currentDifficulty}: ${totalIcons} iconos`);
    } else {
      const baseIconCount = Math.floor(actualSize * actualSize * 0.33);
      totalIcons = Math.max(12, baseIconCount);
      console.log(`Calculando iconos iniciales: ${totalIcons} (33% del tablero)`);
    }
    
    if (targetLevel >= 2) {
      const levelMultiplier = 1 + (targetLevel - 1) * 0.1;
      totalIcons = Math.min(
        Math.floor(totalIcons * levelMultiplier), 
        Math.floor(actualSize * actualSize * 0.5)
      );
      console.log(`Nivel ${targetLevel}: Ajustando iconos iniciales a ${totalIcons} (incremento nivel ${levelMultiplier.toFixed(1)}x)`);
    }
    
    console.log(`Fase 1: Calculados ${totalIcons} iconos iniciales para nivel ${targetLevel}`);
    
    const maxInitialIcons = Math.floor(actualSize * actualSize * 0.5);
    if (totalIcons > maxInitialIcons) {
      console.log(`Limitando iconos: ${totalIcons} > ${maxInitialIcons} (50% del tablero)`);
      totalIcons = maxInitialIcons;
    }
    
    logger.info(`Inicializando tablero con ${totalIcons} iconos iniciales`, 
               `Modo: ${currentPlayMode}, Dificultad: ${currentDifficulty}, Nivel: ${targetLevel}`);
    
    const shuffledIcons = shuffleArray([...availableIcons]);
    const icon1 = shuffledIcons[0];
    
    console.log("Fase 2: Colocando iconos iniciales garantizados");
    
    const centerRow = getRandomInt(2, actualSize - 3);
    const centerCol = getRandomInt(2, actualSize - 3);
    
    newBoard[centerRow][centerCol] = icon1;
    
    const directions = [
      { dr: -1, dc: 0 },
      { dr: 0, dc: 1 },
      { dr: 1, dc: 0 },
      { dr: 0, dc: -1 }
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
    
    let placedIcons = 3;
    
    console.log(`Fase 3: Grupo inicial garantizado colocado (${placedIcons} iconos)`);
    
    if (shuffledIcons.length > 1 && totalIcons >= 6) {
      const icon2 = shuffledIcons[1];
      let placed = false;
      
      for (let attempt = 0; attempt < 10 && !placed; attempt++) {
        const row = getRandomInt(2, actualSize - 3);
        const col = getRandomInt(2, actualSize - 3);
        
        if (Math.abs(row - centerRow) + Math.abs(col - centerCol) >= 4) {
          newBoard[row][col] = icon2;
          
          const dir1Index = getRandomInt(0, 4);
          let dir2Index = getRandomInt(0, 4);
          while (Math.abs(dir1Index - dir2Index) === 2) {
            dir2Index = getRandomInt(0, 4);
          }
          
          const dir1 = directions[dir1Index];
          newBoard[row + dir1.dr][col + dir1.dc] = icon2;
          
          const dir2 = directions[dir2Index];
          newBoard[row + dir2.dr][col + dir2.dc] = icon2;
          
          placedIcons += 3;
          placed = true;
        }
      }
      
      if (placed) {
        console.log(`Fase 4: Segundo grupo garantizado colocado (total: ${placedIcons} iconos)`);
      }
    }
    
    console.log(`Fase 5: Colocando iconos aleatorios adicionales hasta ${totalIcons}`);
    let maxAttempts = totalIcons * 5;
    
    while (placedIcons < totalIcons && maxAttempts > 0) {
      maxAttempts--;
      const row = getRandomInt(0, actualSize);
      const col = getRandomInt(0, actualSize);
      
      if (newBoard[row][col] === null) {
        let validIcon = false;
        let attempts = 0;
        
        while (!validIcon && attempts < 10) {
          const iconIndex = getRandomInt(0, availableIcons.length);
          const icon = availableIcons[iconIndex];
          
          newBoard[row][col] = icon;
          
          const hasConvergence = checkCellForConvergence(newBoard, row, col);
          
          if (!hasConvergence) {
            validIcon = true;
            placedIcons++;
          } else {
            newBoard[row][col] = null;
          }
          
          attempts++;
        }
        
        if (!validIcon) {
          newBoard[row][col] = null;
        }
      }
    }
    
    const hasMovesAvailable = checkBoardForValidMoves(newBoard, actualSize, availableIcons);
    console.log(`Fase 6: Verificación de movimientos válidos: ${hasMovesAvailable ? 'OK' : 'Sin movimientos'}`);
    
    if (!hasMovesAvailable) {
      console.log("ADVERTENCIA: Tablero inicializado sin movimientos válidos. Corrigiendo...");
      
      let emptyCellFound = false;
      for (let row = 0; row < actualSize && !emptyCellFound; row++) {
        for (let col = 0; col < actualSize && !emptyCellFound; col++) {
          if (newBoard[row][col] === null) {
            for (const dir of directions) {
              const newRow = row + dir.dr;
              const newCol = col + dir.dc;
              
              if (newRow >= 0 && newRow < actualSize && newCol >= 0 && newCol < actualSize && 
                  newBoard[newRow][newCol] !== null) {
                const icon = newBoard[newRow][newCol];
                
                for (const dir2 of directions) {
                  if (dir.dr !== dir2.dr || dir.dc !== dir2.dc) {
                    const targetRow = row + dir2.dr;
                    const targetCol = col + dir2.dc;
                    
                    if (targetRow >= 0 && targetRow < actualSize && targetCol >= 0 && targetCol < actualSize && 
                        newBoard[targetRow][targetCol] === null) {
                      newBoard[targetRow][targetCol] = icon;
                      emptyCellFound = true;
                      console.log(`Fase 7: Corrección aplicada, movimiento válido creado en [${row},${col}]`);
                      break;
                    }
                  }
                }
                
                if (emptyCellFound) break;
              }
            }
          }
        }
      }
    }
    
    let actualIconCount = 0;
    for (let r = 0; r < actualSize; r++) {
      for (let c = 0; c < actualSize; c++) {
        if (newBoard[r][c] !== null) {
          actualIconCount++;
        }
      }
    }
    
    logger.info(`Tablero inicializado con ${actualIconCount} iconos`, 
               `Objetivo: ${totalIcons}, Tamaño tablero: ${actualSize}x${actualSize}, Nivel: ${targetLevel}`);
    console.log(`Fase 8: Tablero final con ${actualIconCount}/${totalIcons} iconos (${(actualIconCount/(actualSize*actualSize)*100).toFixed(1)}% ocupación)`);
    
    dispatch(updateBoard(newBoard));
    console.log("Fase 9: Tablero actualizado en el estado global");
    
    dispatch(setIconCount(actualIconCount));
    
    if (currentPlayMode === 'classic') {
      const scoreTarget = config.GAME_MODE_CONFIG.CLASSIC.initialScoreTarget * 
                         Math.pow(config.GAME_MODE_CONFIG.CLASSIC.scoreTargetMultiplier, targetLevel - 1);
      
      const occupationTarget = Math.max(
        30, 
        config.GAME_MODE_CONFIG.CLASSIC.initialOccupationTarget - 
        (targetLevel * config.GAME_MODE_CONFIG.CLASSIC.occupationDecreasePerLevel)
      );
      
      dispatch(setLevelTarget({
        score: Math.round(scoreTarget),
        occupation: Math.round(occupationTarget)
      }));
    } else if (currentPlayMode === 'timed') {
      const timeLimit = config.GAME_MODE_CONFIG.TIMED.initialTimeLimit - 
                       (targetLevel - 1) * config.GAME_MODE_CONFIG.TIMED.timeDecreasePerLevel;
      
      dispatch(setLevelTimeLimit(Math.max(30, timeLimit)));
    }
    
    const initialSpawnRate = calculateInitialSpeedForLevel(targetLevel, currentPlayMode, config.GAME_MODES, MIN_SPAWN_RATE);
    dispatch(setSpawnRate(initialSpawnRate));
    console.log(`Fase 10: SpawnRate configurado a ${initialSpawnRate}ms para nivel ${targetLevel}`);
    
    isInitializedRef.current = true;
    console.log("Fase 11: Tablero marcado como inicializado");
    
    const updateSpawnRateFromDifficulty = () => {
      const { currentDifficulty, currentPlayMode } = store.getState().game;
      const difficultyConfig = config.DIFFICULTY_CONFIG[currentDifficulty];
      const currentSpawnRate = store.getState().game.spawnRate;
      
      console.log(`[VELOCIDAD] Verificando configuración de velocidad:`);
      console.log(`- SpawnRate actual: ${currentSpawnRate}ms`);
      
      const initialSpeed = speedController.getInitialSpeed(currentDifficulty, currentPlayMode);
      console.log(`- Velocidad inicial calculada: ${initialSpeed}ms`);
      
      if (currentSpawnRate !== initialSpeed) {
        console.log(`[VELOCIDAD] Actualizando velocidad: ${currentSpawnRate}ms → ${initialSpeed}ms`);
        dispatch(setSpawnRate(initialSpeed));
      } else {
        console.log(`[VELOCIDAD] Manteniendo velocidad actual: ${currentSpawnRate}ms`);
      }
    };
    
    updateSpawnRateFromDifficulty();
    
    const updateComboTimeWindow = () => {
      const gameState = store.getState().game;
      const difficulty = gameState.currentDifficulty;
      
      const timeWindow = config.COMBO_SYSTEM.TIME_WINDOWS[difficulty] || config.COMBO_SYSTEM.TIME_WINDOWS.normal;
      
      console.log(`[COMBO CONFIG] Actualizando ventana de tiempo de combo para dificultad ${difficulty}: ${timeWindow}ms`);
      
      dispatch({ type: 'game/setComboTimeWindow', payload: timeWindow });
      
      setTimeout(() => {
        const updatedState = store.getState().game;
        console.log(`[COMBO CONFIG] Verificación: La ventana de tiempo actual es ${updatedState.comboTimeWindow}ms`);
      }, 0);
    };

    updateComboTimeWindow();

    console.log("**********************************************************\n");
    console.log(`FIN DEL FLUJO: TABLERO INICIALIZADO CORRECTAMENTE PARA NIVEL ${targetLevel}`);
    
    return newBoard;
  }, [dispatch]);
  
  const iconSpawnerConfig: IconSpawnerConfig = {
    minIntervalPercentage: 0.95,
    minAbsoluteInterval: 500,
    maxSpawningTimeout: 0,
    maxIcons: 100,
    maxAttempts: 3,
    maxIconsPerRow: 8,
    maxIconsPerColumn: 8,
    maxConsecutiveIcons: 3
  };

  const { 
    addRandomIcon, 
    isSpawningRef, 
    lastIconAddedTimeRef,
    resetSpawningState 
  } = useIconSpawner(
    hasValidMoves,
    addNotification,
    iconSpawnerConfig
  );
  
  const speedController = useSpeedController();

  const handleSpeedIncrease = useCallback(() => {
    const currentTime = Date.now();
    const timeSinceLastIncrease = currentTime - lastSpeedIncreaseTimeRef.current;
    const { spawnRate: currentSpawnRate, currentDifficulty } = store.getState().game;
    
    if (timeSinceLastIncrease >= 30000) {
      const newSpawnRate = speedController.calculateIncreasedSpeed(currentSpawnRate, currentDifficulty);
      
      if (Math.abs(currentSpawnRate - newSpawnRate) >= 50) {
        const speedChange = ((currentSpawnRate - newSpawnRate) / currentSpawnRate * 100).toFixed(1);
        const spawnTimeOld = (currentSpawnRate / 1000).toFixed(1);
        const spawnTimeNew = (newSpawnRate / 1000).toFixed(1);
        
        dispatch(setSpawnRate(newSpawnRate));
        lastSpeedIncreaseTimeRef.current = currentTime;
        
        addNotification({
          message: '¡Aumento de velocidad!',
          type: 'warning',
          icon: '⚡',
          duration: 3000,
          value: `${spawnTimeOld}s → ${spawnTimeNew}s (${speedChange}% más rápido)`
        });
        
        console.log(`[VELOCIDAD] Aumento automático: ${currentSpawnRate}ms → ${newSpawnRate}ms (${speedChange}% más rápido)`);
      }
    }
  }, [dispatch, addNotification, speedController]);

  const resetSpeedIncreaseTime = useCallback(() => {
    lastSpeedIncreaseTimeRef.current = Date.now();
    console.log(`[VELOCIDAD] Temporizador de aumento reiniciado en: ${new Date(lastSpeedIncreaseTimeRef.current).toLocaleTimeString()}`);
  }, []);
  
  const stopTimers = useCallback(() => {
    const timeFormatted = getLogTimestamp();
    
    console.log(`\n[${timeFormatted}] **********************************************************`);
    console.log(`[${timeFormatted}] INICIO DEL FLUJO: DETENER TEMPORIZADORES`);
    console.log(`[${timeFormatted}] Estado: ${status}, Temporizadores activos: ${timersActiveRef.current ? 'Sí' : 'No'}`);
    console.log(`[${timeFormatted}] **********************************************************`);
    
    if (!timersActiveRef.current) {
      logger.debug('GameLogic', 'Los temporizadores ya estaban detenidos');
    }
    
    timersActiveRef.current = false;
    
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
      console.log(`[${timeFormatted}] Fase 1: Temporizador de tiempo de juego detenido`);
    }
    
    if (iconTimerIntervalRef.current) {
      clearInterval(iconTimerIntervalRef.current);
      iconTimerIntervalRef.current = null;
      console.log(`[${timeFormatted}] Fase 2: Temporizador de spawn de iconos detenido`);
    }
    
    console.log(`[${timeFormatted}] Fase 3: Referencias de temporizadores reiniciadas`);
    console.log(`[${timeFormatted}] **********************************************************`);
    console.log(`\n[${timeFormatted}] FIN DEL FLUJO: TEMPORIZADORES DETENIDOS CORRECTAMENTE`);
  }, [status]);

  const startTimers = useCallback((forceStart = false) => {
    const timeFormatted = getLogTimestamp();
    
    const gameState = store.getState().game;
    const { 
      status: gameStatus,
      currentPlayMode,
      level,
      spawnRate: currentSpawnRate
    } = gameState;
    
    console.log(`\n[${timeFormatted}] **********************************************************`);
    console.log(`[${timeFormatted}] INICIO DEL FLUJO: INICIAR TEMPORIZADORES`);
    console.log(`[${timeFormatted}] Nivel: ${level}, SpawnRate: ${currentSpawnRate}ms, Modo: ${currentPlayMode}`);
    console.log(`[${timeFormatted}] Forzar inicio: ${forceStart ? 'Sí' : 'No'}, Temporizadores activos: ${timersActiveRef.current ? 'Sí' : 'No'}`);
    console.log(`[${timeFormatted}] Estado actual del juego: ${gameStatus}`);
    console.log(`[${timeFormatted}] **********************************************************`);
    
    if (timersActiveRef.current && !forceStart) {
      console.log(`[${timeFormatted}] Los temporizadores ya están activos.`);
      return;
    }
    
    if (gameStatus !== 'playing' && !forceStart) {
      console.log(`[${timeFormatted}] Fase 1: No se inician temporizadores porque el estado es ${gameStatus}`);
      return;
    }
    
    if (timerIntervalRef.current) {
      console.log(`[${timeFormatted}] Deteniendo temporizador de tiempo existente`);
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    
    if (iconTimerIntervalRef.current) {
      console.log(`[${timeFormatted}] Deteniendo temporizador de íconos existente`);
      clearInterval(iconTimerIntervalRef.current);
      iconTimerIntervalRef.current = null;
    }
    
    resetSpeedIncreaseTime();
    console.log(`[VELOCIDAD] Temporizador de velocidad iniciado. Próximo aumento en 30 segundos.`);
    
    console.log(`[${timeFormatted}] Fase 2: Referencias de temporizadores establecidas`);
    
    resetSpawningState();
    
    timerIntervalRef.current = setInterval(() => {
      const gameStatus = store.getState().game.status;
      if (gameStatus !== 'playing') {
        return;
      }
      
      timerRef.current++;
      
      dispatch(incrementTimer());
      
      if (currentPlayMode === 'timed') {
        const currentTimeRemaining = store.getState().game.timeRemaining;
        if (currentTimeRemaining > 0) {
          dispatch(decrementTimeRemaining());
          
          if (currentTimeRemaining === 1) {
            dispatch(setGameEndReason('¡Se acabó el tiempo! Modo contrarreloj finalizado.'));
            dispatch(setGameStatus('gameOver'));
            return;
          }
        }
      }
      
      if (currentPlayMode === 'survival') {
        dispatch(decrementTimeRemaining());
      }
      
      handleSpeedIncrease();
      
    }, 1000);
    console.log(`[${timeFormatted}] Fase 3: Temporizador de tiempo de juego iniciado`);
    
    const effectiveSpawnRate = currentSpawnRate;
    
    setTimeout(() => {
      if (store.getState().game.status === 'playing') {
        addRandomIcon();
      }
    }, 0);
    
    const setupIconTimer = () => {
      if (iconTimerIntervalRef.current) {
        clearInterval(iconTimerIntervalRef.current);
      }
      
      iconTimerIntervalRef.current = setInterval(() => {
        const gameState = store.getState().game;
        if (gameState.status !== 'playing') {
          return;
        }

        if (lastSpawnRateRef.current !== currentSpawnRate) {
          lastSpawnRateRef.current = currentSpawnRate;
          setupIconTimer();
          return;
        }
        
        addRandomIcon();
        
        logger.debug('GameLogic', `Intervalo de spawn activado (${currentSpawnRate}ms)`);
      }, effectiveSpawnRate);
    };
    
    setupIconTimer();
    console.log(`[${timeFormatted}] Fase 4: Temporizador de spawn de iconos iniciado (cada ${effectiveSpawnRate}ms)`);
    
    lastIconAddedTimeRef.current = 0;
    lastSpawnRateRef.current = effectiveSpawnRate;
    
    timersActiveRef.current = true;
    
    console.log(`[${timeFormatted}] **********************************************************`);
    console.log(`[${timeFormatted}] FIN DEL FLUJO: TEMPORIZADORES INICIADOS CORRECTAMENTE`);
  }, [dispatch, addNotification, status, currentPlayMode, addRandomIcon, resetSpeedIncreaseTime, resetSpawningState, handleSpeedIncrease]);

  useEffect(() => {
    return () => {
      stopTimers();
      resetSpawningState();
    };
  }, [stopTimers, resetSpawningState]);

  const removeConvergingIcons = useCallback((iconsToRemove: Array<{row: number, col: number}>) => {
    if (iconsToRemove.length === 0) return;
    
    const currentBoard = board.map(row => [...row]);
    dispatch(setHighlightedCells(iconsToRemove));
    
    const markingBoard = currentBoard.map(row => [...row]);
    for (const cell of iconsToRemove) {
      const cellIcon = markingBoard[cell.row][cell.col];
      if (cellIcon !== null) {
        markingBoard[cell.row][cell.col] = `${cellIcon}_removing`;
      }
    }
    
    dispatch(updateBoard(markingBoard));
    
    requestAnimationFrame(() => {
      setTimeout(() => {
        const finalBoard = markingBoard.map(row => [...row]);
        let removedCount = 0;
        
        for (const cell of iconsToRemove) {
          finalBoard[cell.row][cell.col] = null;
          removedCount++;
        }
        
        dispatch(updateBoard(finalBoard));
        
        const { comboTimestamp, comboTimeWindow, comboMultiplier, comboCount } = store.getState().game;
        const currentTime = Date.now();
        
        console.log("\n[COMBO DEBUG] ===== Inicio de análisis de combo =====");
        console.log(`[COMBO DEBUG] Iconos eliminados: ${removedCount}`);
        console.log(`[COMBO DEBUG] Estado actual: Combo: ${comboCount}, Multiplicador: ${comboMultiplier.toFixed(1)}x`);
        console.log(`[COMBO DEBUG] Timestamp actual: ${currentTime}`);
        console.log(`[COMBO DEBUG] Timestamp última eliminación: ${comboTimestamp}`);
        console.log(`[COMBO DEBUG] Ventana de tiempo: ${comboTimeWindow}ms`);
        
        const elapsedTime = comboTimestamp === 0 ? 0 : currentTime - comboTimestamp;
        console.log(`[COMBO DEBUG] Tiempo transcurrido: ${elapsedTime}ms`);
        console.log(`[COMBO DEBUG] ¿Dentro de ventana de tiempo?: ${elapsedTime <= comboTimeWindow ? 'SÍ' : 'NO'}`);
        
        if (comboTimestamp === 0 || comboCount === 0) {
          console.log(`[COMBO DEBUG] Primer combo detectado, iniciando secuencia`);
          dispatch(incrementCombo());
        }
        else if (elapsedTime <= comboTimeWindow) {
          console.log(`[COMBO DEBUG] Tiempo dentro de ventana, incrementando combo`);
          dispatch(incrementCombo());
        } else {
          console.log(`[COMBO DEBUG] Tiempo fuera de ventana, reiniciando combo`);
          dispatch(resetCombo());
          setTimeout(() => {
            console.log(`[COMBO DEBUG] Iniciando nuevo combo después del reset`);
            dispatch(incrementCombo());
          }, 0);
        }
        
        const updatedState = store.getState().game;
        const activeMultiplier = updatedState.comboMultiplier;
        
        const basePoints = removedCount * 10 * level;
        const pointsWithCombo = Math.floor(basePoints * activeMultiplier);
        
        dispatch(incrementCombo(basePoints));
        
        console.log(`[COMBO DEBUG] Puntos base: ${basePoints} (${removedCount} iconos × 10 × nivel ${level})`);
        console.log(`[COMBO DEBUG] Multiplicador aplicado: ${activeMultiplier.toFixed(1)}x`);
        console.log(`[COMBO DEBUG] Puntos finales con combo: ${pointsWithCombo}`);
        
        dispatch(incrementScore(pointsWithCombo));
        
        showPointsEarned(basePoints, iconsToRemove[0].row, iconsToRemove[0].col);
        
        console.log(`[COMBO DEBUG] Combo actual: ${updatedState.comboCount}, verificando hitos`);
        
        if (updatedState.comboCount === 10) {
          const bonus = config.COMBO_SYSTEM.MILESTONE_BONUSES[10];
          dispatch(incrementScore(bonus));
          console.log(`[COMBO DEBUG] ¡HITO! Combo x10 alcanzado. +${bonus} puntos extra`);
        } else if (updatedState.comboCount === 20) {
          const bonus = config.COMBO_SYSTEM.MILESTONE_BONUSES[20];
          dispatch(incrementScore(bonus));
          console.log(`[COMBO DEBUG] ¡HITO! Combo x20 alcanzado. +${bonus} puntos extra`);
        } else if (updatedState.comboCount === 30) {
          const bonus = config.COMBO_SYSTEM.MILESTONE_BONUSES[30];
          dispatch(incrementScore(bonus));
          console.log(`[COMBO DEBUG] ¡HITO! Combo x30 alcanzado. +${bonus} puntos extra`);
        }
        
        if (activeMultiplier > 1.0) {
          console.log(`[COMBO DEBUG] Mostrar notificación de combo: x${updatedState.comboCount} (${activeMultiplier.toFixed(1)}x)`);
          
          if (activeMultiplier >= 5.0) {
            audioManager.play('comboLarge');
            console.log(`[COMBO DEBUG] Reproduciendo sonido: comboLarge`);
          } else if (activeMultiplier >= 3.0) {
            audioManager.play('comboMedium');
            console.log(`[COMBO DEBUG] Reproduciendo sonido: comboMedium`);
          } else if (activeMultiplier >= 1.5) {
            audioManager.play('comboSmall');
            console.log(`[COMBO DEBUG] Reproduciendo sonido: comboSmall`);
          }
        }
        
        console.log(`[COMBO DEBUG] ===== Fin de análisis de combo =====\n`);
        
        const newIconCount = iconCount - removedCount;
        dispatch(setIconCount(newIconCount));
        
        if (currentPlayMode === 'timed') {
          const timeBonus = Math.max(5, removedCount * 3);
          
          dispatch({
            type: 'game/addTimeBonus',
            payload: timeBonus
          });
          
          audioManager.play('timeBonus');
          
          console.log(`Bonus de tiempo añadido: +${timeBonus} segundos`);
        }
        
        audioManager.play('removeIcon');

        showPointsEarned(basePoints, iconsToRemove[0].row, iconsToRemove[0].col);
      }, 50);
    });
  }, [board, dispatch, iconCount, currentPlayMode, level]);

  const adjustBoardSize = useCallback((container: HTMLElement, boardElement: HTMLElement) => {
    adjustBoardVisuals(container, boardElement);
  }, []);

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
  
  const resetCurrentLevel = useCallback(() => {
    stopTimers();
    
    setTimeout(() => {
      initializeBoard();
      dispatch(rechargeHint());
      startTimers();
    }, 100);
    
    return true;
  }, [dispatch, stopTimers, initializeBoard, startTimers, level]);
  
  const advanceToNextLevel = useCallback(() => {
    dispatch(setLevel(level + 1));
    stopTimers();
    
    initializeBoard();
    dispatch(rechargeHint());
    dispatch(setGameStatus('playing'));
  }, [dispatch, level, initializeBoard, stopTimers]);

  useEffect(() => {
    if (status !== 'playing' || !board || board.length === 0 || iconCount === 0) {
      return;
    }

    const timeoutId = setTimeout(() => {
      if (store.getState().game.status !== 'playing') {
        return;
      }

      checkGameEndCondition(board, boardSize, availableIcons);

    }, 100);
    
    return () => clearTimeout(timeoutId);
  }, [board, status, boardSize, hasValidMoves, dispatch, iconCount]);

  const changeGameConfig = useCallback((newConfig: { difficulty: GameDifficulty, mode: GamePlayMode }) => {
    console.log("\n**********************************************************");
    console.log("INICIO DEL FLUJO: CAMBIO DE CONFIGURACIÓN DEL JUEGO");
    console.log(`Cambiando a dificultad: ${newConfig.difficulty}, modo: ${newConfig.mode}`);
    console.log("**********************************************************");
    
    stopTimers();
    
    isInitializedRef.current = false;
    
    dispatch(setGameMode(newConfig.difficulty));
    dispatch(setPlayMode(newConfig.mode));
    
    const syncGameState = () => {
      const { level: currentLevel, status } = store.getState().game;
      
      const iconSet = config.getIconSetForLevel(currentLevel);
      dispatch(setAvailableIcons(iconSet));
      
      const boardSize = config.getBoardSizeForLevel(currentLevel);
      dispatch(setBoardSize(boardSize));
      
      const difficultyConfig = config.getDifficultyConfig(newConfig.difficulty as GameMode);
      if (difficultyConfig) {
        const initialSpeed = speedController.getInitialSpeed(newConfig.difficulty, currentPlayMode);
        console.log(`Aplicando configuración de dificultad ${newConfig.difficulty}:`);
        console.log(`- SpawnRate inicial: ${initialSpeed}ms`);
        console.log(`- Íconos iniciales: ${difficultyConfig.initialIconCount}`);
        console.log(`- Penalización: ${difficultyConfig.penaltyIcons} íconos`);
        console.log(`- Nivel máximo: ${difficultyConfig.maxLevel}`);
        
        dispatch(setSpawnRate(initialSpeed));
      }
      
      const gameConfig = config.getGameConfig(newConfig.difficulty, newConfig.mode);
      
      if (newConfig.mode === 'classic') {
        const scoreTarget = Math.round(gameConfig.initialScoreTarget * 
                        Math.pow(gameConfig.scoreTargetMultiplier || 1.5, currentLevel - 1));
        
        const difficultyMod = config.LEVEL_REQUIREMENT_MULTIPLIERS[newConfig.difficulty as GameMode] || 
                             config.LEVEL_REQUIREMENT_MULTIPLIERS.normal;
        
        const adjustedScoreTarget = Math.round(scoreTarget * difficultyMod.scoreRequirement);
        
        const occupationTarget = Math.max(
          30, 
          gameConfig.initialOccupationTarget - 
          (currentLevel * (gameConfig.occupationDecreasePerLevel || 0))
        );
        
        console.log(`Configurando objetivos para nivel ${currentLevel}:`);
        console.log(`- Puntuación objetivo: ${adjustedScoreTarget} puntos`);
        console.log(`- Ocupación objetivo: ${Math.round(occupationTarget)}%`);
        
        dispatch(setLevelTarget({
          score: adjustedScoreTarget,
          occupation: Math.round(occupationTarget)
        }));
      } else if (newConfig.mode === 'timed') {
        let timeLimit = gameConfig.initialTimeLimit - 
                       (currentLevel - 1) * (gameConfig.timeDecreasePerLevel || 10);
                       
        const difficultyMod = config.LEVEL_REQUIREMENT_MULTIPLIERS[newConfig.difficulty as GameMode] || 
                             config.LEVEL_REQUIREMENT_MULTIPLIERS.normal;
        
        timeLimit = Math.round(timeLimit * difficultyMod.timeRequirement);
        
        console.log(`Configurando tiempo límite para nivel ${currentLevel}: ${timeLimit} segundos`);
        dispatch(setLevelTimeLimit(Math.max(30, timeLimit)));
      }
      
      const comboTimeWindow = config.COMBO_SYSTEM.TIME_WINDOWS[newConfig.difficulty as GameMode] || 
                             config.COMBO_SYSTEM.TIME_WINDOWS.normal;
      
      console.log(`Configurando ventana de tiempo para combos: ${comboTimeWindow}ms`);
      dispatch({ type: 'game/setComboTimeWindow', payload: comboTimeWindow });
      
      initializeBoard(boardSize, true);
      
      setTimeout(() => {
        const updatedState = store.getState().game;
        console.log("Verificación de configuración aplicada:");
        console.log(`- Dificultad: ${updatedState.currentDifficulty}`);
        console.log(`- Modo: ${updatedState.currentPlayMode}`);
        console.log(`- SpawnRate: ${updatedState.spawnRate}ms`);
        console.log(`- Ventana de combo: ${updatedState.comboTimeWindow}ms`);
      }, 50);
      
      if (status === 'playing') {
        startTimers(true);
      }
    };
    
    setTimeout(syncGameState, 50);
    
    console.log("**********************************************************");
    console.log("FIN DEL FLUJO: CONFIGURACIÓN DEL JUEGO ACTUALIZADA");
    
  }, [dispatch, stopTimers, initializeBoard, startTimers, addNotification]);

  const changeGameConfigLegacy = useCallback((difficulty: GameDifficulty, mode: GamePlayMode) => {
    return changeGameConfig({ difficulty, mode });
  }, [changeGameConfig]);

  const checkLevelCompleted = () => {
    if (status !== 'playing' || iconCount === 0) return false;
    
    const movesAvailable = hasValidMoves();
    
    return levelAdapter.isLevelCompleted(
      level,
      currentPlayMode,
      score,
      iconCount,
      boardSize,
      timeRemaining,
      survivalTime,
      timerRef.current,
      movesAvailable
    );
  };
  
  const configureBoardForNewLevel = useCallback(() => {
    logger.info(`Configurando tablero para nivel ${level}`, `Tamaño: ${boardSize}, Modo: ${currentPlayMode}`);
    
    const newBoardSize = config.getBoardSizeForLevel(level + 1);
    
    const newSpawnRate = speedController.calculateLevelSpeed(level + 1, currentPlayMode, currentDifficulty);
    
    const newIcons = config.getIconSetForLevel(level + 1);
    
    dispatch(setBoardSize(newBoardSize));
    dispatch(setSpawnRate(newSpawnRate));
    dispatch(setAvailableIcons(newIcons));
    
    if (currentPlayMode === 'classic') {
      const baseScoreTarget = config.LEVEL_REQUIREMENTS.classic.baseScore;
      const scoreMultiplier = config.LEVEL_REQUIREMENTS.classic.scoreMultiplier;
      const newScoreTarget = Math.floor(baseScoreTarget * Math.pow(scoreMultiplier, level));
      
      const baseOccupation = config.LEVEL_REQUIREMENTS.classic.baseOccupation;
      const occupationDecrease = config.LEVEL_REQUIREMENTS.classic.occupationDecrease;
      const newOccupationTarget = Math.max(20, baseOccupation - (level * occupationDecrease));
      
      dispatch(setLevelTarget({
        score: newScoreTarget,
        occupation: newOccupationTarget
      }));
    } else if (currentPlayMode === 'timed') {
      const baseTime = config.LEVEL_REQUIREMENTS.timed.baseTime;
      const timeDecrease = config.LEVEL_REQUIREMENTS.timed.timeDecreasePerLevel;
      const newTimeLimit = Math.max(30, baseTime - (level * timeDecrease));
      
      dispatch(setLevelTimeLimit(newTimeLimit));
    }
    
    dispatch(rechargeHint());
    
    logger.debug('Configuración de nuevo nivel aplicada', {
      nivel: level + 1,
      tamañoTablero: newBoardSize,
      velocidad: newSpawnRate,
      iconos: newIcons.length
    } as unknown as string);
  }, [currentPlayMode, level, dispatch, addNotification, currentDifficulty, speedController]);

  const resetSystemsForNewLevel = useCallback(() => {
    const { level, currentPlayMode, spawnRate, iconCount } = store.getState().game;
    
    console.log("\n**********************************************************");
    console.log("INICIO DEL FLUJO: REINICIAR SISTEMAS PARA NUEVO NIVEL");
    console.log(`Nivel actual: ${level}, Modo: ${currentPlayMode}`);
    console.log(`SpawnRate: ${spawnRate}ms, Iconos en tablero: ${iconCount}`);
    console.log("**********************************************************");
    
    stopTimers();
    console.log("Fase 1: Temporizadores detenidos");
    
    isRemovingIconsRef.current = false;
    isSpawningRef.current = false;
    speedLimitReachedRef.current = false;
    console.log("Fase 2: Referencias de estado reiniciadas");
    
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (iconTimerIntervalRef.current) {
      clearInterval(iconTimerIntervalRef.current);
      iconTimerIntervalRef.current = null;
    }
    console.log("Fase 3: Intervalos residuales limpiados");
    
    const { level: currentLevel, spawnRate: currentSpawnRate } = store.getState().game;
    console.log(`Fase 4: Estado actual obtenido: nivel=${currentLevel}, spawnRate=${currentSpawnRate}ms`);
    
    dispatch(setSpawnRate(currentSpawnRate));
    console.log(`Fase 5: SpawnRate actualizado a ${currentSpawnRate}ms`);
    
    resetSpeedIncreaseTime();
    console.log(`Fase 6: Contador de incremento de velocidad reiniciado`);
    
    if (currentPlayMode === 'survival') {
      console.log(`Fase 7: Manteniendo tiempo de supervivencia (modo ${currentPlayMode})`);
    }
    
    dispatch(setHighlightedCells([]));
    console.log("Fase 8: Celdas resaltadas limpiadas");
    
    console.log("**********************************************************\n");
    console.log("FIN DEL FLUJO: SISTEMAS REINICIADOS CORRECTAMENTE");
    
    return true;
  }, [dispatch, stopTimers]);

  const showPointsEarned = useCallback((points: number, row?: number, col?: number) => {
    const { comboCount, comboMultiplier, lastComboPoints } = store.getState().game;
    const hasActiveCombo = comboCount >= 3;
    
    if (!hasActiveCombo) {
      addNotification({
        message: '¡Puntos!',
        type: 'success',
        icon: '💰',
        duration: 1000,
        value: `+${points}`
      });
    }
  }, [addNotification]);

  const checkGameState = useCallback((board: string[][], boardSize: number, availableIcons: string[]) => {
    const hasValidMoves = checkBoardForValidMoves(board, boardSize, availableIcons);
    
    if (!hasValidMoves) {
      // Calcular estadísticas del tablero
      let iconCount = 0;
      for (let row = 0; row < boardSize; row++) {
        for (let col = 0; col < boardSize; col++) {
          if (board[row][col] !== null) {
            iconCount++;
          }
        }
      }
      
      const totalCells = boardSize * boardSize;
      const occupationPercentage = (iconCount / totalCells) * 100;
      
      // VICTORIA PERFECTA: Tablero completamente vacío
      if (iconCount === 0) {
        dispatch(setGameEndReason('¡VICTORIA PERFECTA! Has limpiado completamente el tablero.'));
        dispatch(setGameStatus('levelCompleted'));
        audioManager.play('perfectClear');
        return;
      }
      
      // VICTORIA NORMAL: No hay movimientos y quedan 2 o menos iconos
      if (iconCount <= 2) {
        dispatch(setGameEndReason(`¡Nivel completado! Solo quedan ${iconCount} iconos sin posibilidad de convergencia.`));
        dispatch(setGameStatus('levelCompleted'));
        audioManager.play('levelComplete');
        const { level } = store.getState().game;
        dispatch(setLevel(level + 1));
        return;
      }
      
      // GAME OVER: Tablero lleno sin movimientos posibles
      if (occupationPercentage >= 100) {
        const { currentPlayMode, currentDifficulty, spawnRate } = store.getState().game;
        const spawnRateSeconds = (spawnRate / 1000).toFixed(1);
        const reason = `El tablero está completamente lleno sin movimientos posibles. Modo: ${currentPlayMode}, Dificultad: ${currentDifficulty}, Velocidad: ${spawnRateSeconds}s/icono.`;
        dispatch(setGameEndReason(reason));
        dispatch(setGameStatus('gameOver'));
        audioManager.play('gameOver');
        return;
      }
    }
  }, [dispatch]);

  return {
    board,
    boardSize,
    status,
    iconCount,
    level,
    score,
    highlightedCells,
    initializeBoard,
    adjustBoardSize,
    stopTimers,
    startTimers,
    registerCellRef,
    showHint,
    resetCurrentLevel,
    advanceToNextLevel,
    resetSystemsForNewLevel,
    findConvergingIcons: useCallback((row: number, col: number) => {
      return findConvergingIcons(board, row, col, boardSize);
    }, [board, boardSize]),
    changeGameConfig,
    checkLevelCompleted,
    configureBoardForNewLevel,
    checkGameState,
  };
};

export default useGameLogic;