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
  decrementTimeRemaining,
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
// Importar funciones para manejo de condiciones de fin de juego
import { 
  checkGameEndCondition, 
  setLevelTransitionGrace, 
  decrementLevelTransitionGrace 
} from '../utils/gameEndConditions';
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
  
  // Obtener funciones de notificación
  const { addNotification } = useNotifications();
  
  // Referencias para temporizadores y estados del juego
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const iconTimerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isRemovingIconsRef = useRef<boolean>(false);
  // Ya no necesitamos isSpawningRef ni lastIconAddedTimeRef aquí, vienen del useIconSpawner
  const speedLimitReachedRef = useRef<boolean>(false);
  const hintTimerRef = useRef<NodeJS.Timeout | null>(null);
  const cellRefs = useRef<Record<string, HTMLElement>>({});
  const timersActiveRef = useRef<boolean>(false);
  const isInitializedRef = useRef<boolean>(false);
  const lastSpawnRateRef = useRef<number | null>(null);
  const timerRef = useRef<number>(0);
  // Nueva referencia para el sistema de aumento de velocidad
  const lastSpeedIncreaseTimeRef = useRef<number>(0);
  
  // Añadir un nuevo ref para rastrear un período de gracia después de cambiar de nivel
  // Evita game over inmediato cuando se inicia un nivel nuevo
  const levelTransitionGraceRef = useRef<number>(0);
  
  // Añadir una nueva referencia para controlar el tiempo del último icono añadido
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
    const gameState = store.getState().game;
    const { board, boardSize, availableIcons } = gameState;
    
    return checkBoardForValidMoves(board, boardSize, availableIcons);
  }, []);
  
  // Verificar si una celda específica causaría una convergencia
  const checkCellForConvergence = (board: (string | null)[][], row: number, col: number): boolean => {
    // Solo verificar celdas vacías
    if (board[row][col] !== null) {
      console.log(`[CONVERGENCE] La celda [${row},${col}] no está vacía, saltando verificación`);
      return false;
    }
    
    // Mapeo para rastrear iconos por tipo
    const iconCounts: { [key: string]: {count: number, positions: {row: number, col: number}[]} } = {};
    
    // Buscar iconos en las cuatro direcciones
    const directions = [
      { dr: -1, dc: 0, name: 'arriba' }, 
      { dr: 1, dc: 0, name: 'abajo' }, 
      { dr: 0, dc: -1, name: 'izquierda' }, 
      { dr: 0, dc: 1, name: 'derecha' }
    ];
    
    // Iteramos por cada dirección para encontrar el primer icono
    directions.forEach(({ dr, dc, name }) => {
      let r = row + dr;
      let c = col + dc;
      
      // Avanzar en esta dirección hasta encontrar un icono o salir del tablero
      while (r >= 0 && r < boardSize && c >= 0 && c < boardSize) {
        const currentCell = board[r][c];
        
        // Si encontramos un icono
        if (currentCell !== null && !currentCell.includes('_removing')) {
          // Rastrear este icono
          if (!iconCounts[currentCell]) {
            iconCounts[currentCell] = { count: 0, positions: [] };
          }
          
          iconCounts[currentCell].count++;
          iconCounts[currentCell].positions.push({row: r, col: c});
          
          // Solo queremos el primer icono en esta dirección
          break;
        }
        
        // Avanzar en la dirección
        r += dr;
        c += dc;
      }
    });
    
    // Verificar si hay al menos un tipo de icono con 2 o más ocurrencias
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
    
    // Log detallado sobre la convergencia encontrada (solo si hay posibilidad)
    if (convergencePossible) {
      console.log(`[CONVERGENCE] Convergencia posible en celda [${row},${col}]:`);
      convergenceIcons.forEach(item => {
        console.log(`[CONVERGENCE] - Icono ${item.icon}: ${item.count} ocurrencias en posiciones: ${JSON.stringify(item.positions)}`);
      });
    }
    
    return convergencePossible;
  };
  
  // Función para inicializar el tablero con iconos
  const initializeBoard = useCallback((
    size = boardSize,
    forceInitialization = false,
    levelOverride?: number
  ) => {
    // Obtener valores actuales del estado
    const { 
      currentDifficulty, 
      currentPlayMode, 
      level,
      boardSize: currentBoardSize 
    } = store.getState().game;

    // Determinar el nivel objetivo
    const targetLevel = levelOverride !== undefined ? levelOverride : level;
    
    console.log("\n**********************************************************");
    console.log("INICIO DEL FLUJO: INICIALIZAR TABLERO");
    console.log(`Tamaño: ${size}, Nivel: ${targetLevel}, Modo: ${currentPlayMode}`);
    console.log(`Estado: ${status}, Dificultad: ${currentDifficulty}`);
    
    // Obtener los iconos disponibles para el nivel
    const availableIcons = store.getState().game.availableIcons;
    console.log(`Iconos para nivel ${targetLevel}: ${availableIcons.join(', ').substring(0, 100)}${availableIcons.length > 10 ? '...' : ''}`);
    console.log("**********************************************************");

    // Si el nivel no es válido o no estamos forzando la inicialización
    if (targetLevel <= 0 || (!forceInitialization && isInitializedRef.current && currentBoardSize === size)) {
      console.log(`ADVERTENCIA: Tablero ya inicializado o condiciones no válidas para inicialización`);
      return board;
    }

    // Marcar el tablero como no inicializado durante el proceso
    isInitializedRef.current = false;
    
    // Configuración específica para el nivel
    // Tamaño real del tablero
    const actualSize = size || config.getLevelBoardSize(targetLevel);
    
    // Crear un nuevo tablero vacío
    const newBoard: (string | null)[][] = Array(actualSize).fill(null).map(() => Array(actualSize).fill(null));
    
    // Obtener la configuración de dificultad
    const difficultyConfig = config.getDifficultyConfig(currentDifficulty);
    
    // Calcular cuántos iconos iniciales poner según la dificultad
    let totalIcons: number;
    
    // Si la dificultad tiene configuración específica de iconos iniciales, usarla
    if (difficultyConfig && difficultyConfig.initialIconCount !== undefined) {
      totalIcons = difficultyConfig.initialIconCount;
      console.log(`Usando initialIconCount de dificultad ${currentDifficulty}: ${totalIcons} iconos`);
    } else {
      // Si no, usar un valor calculado basado en el tamaño del tablero y nivel
      const baseIconCount = Math.floor(actualSize * actualSize * 0.33); // 33% del tablero
      totalIcons = Math.max(12, baseIconCount);
      console.log(`Calculando iconos iniciales: ${totalIcons} (33% del tablero)`);
    }
    
    // Para nivel 2 y superiores, asegurarnos de que se coloquen suficientes iconos
    if (targetLevel >= 2) {
      // Aumentar el número de iconos iniciales en un 25% para niveles superiores
      const levelMultiplier = 1 + (targetLevel - 1) * 0.1; // Incremento del 10% por nivel
      totalIcons = Math.min(
        Math.floor(totalIcons * levelMultiplier), 
        Math.floor(actualSize * actualSize * 0.5) // Máximo 50% del tablero
      );
      console.log(`Nivel ${targetLevel}: Ajustando iconos iniciales a ${totalIcons} (incremento nivel ${levelMultiplier.toFixed(1)}x)`);
    }
    
    console.log(`Fase 1: Calculados ${totalIcons} iconos iniciales para nivel ${targetLevel}`);
    
    // Limitar la cantidad de iconos iniciales a un porcentaje máximo del tablero
    const maxInitialIcons = Math.floor(actualSize * actualSize * 0.5); // Máximo 50% del tablero
    if (totalIcons > maxInitialIcons) {
      console.log(`Limitando iconos: ${totalIcons} > ${maxInitialIcons} (50% del tablero)`);
      totalIcons = maxInitialIcons;
    }
    
    logger.info(`Inicializando tablero con ${totalIcons} iconos iniciales`, 
               `Modo: ${currentPlayMode}, Dificultad: ${currentDifficulty}, Nivel: ${targetLevel}`);
    
    // Primero colocamos unos pocos iconos en posiciones estratégicas para garantizar
    // que el jugador tenga al menos un movimiento válido disponible
    const shuffledIcons = shuffleArray([...availableIcons]);
    const icon1 = shuffledIcons[0];
    
    console.log("Fase 2: Colocando iconos iniciales garantizados");
    
    // Colocar grupo inicial de 3 iconos iguales en forma de L o T
    const centerRow = getRandomInt(2, actualSize - 3);
    const centerCol = getRandomInt(2, actualSize - 3);
    
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
    
    console.log(`Fase 3: Grupo inicial garantizado colocado (${placedIcons} iconos)`);
    
    // Colocar otro grupo garantizado con un icono diferente para asegurar variedad
    if (shuffledIcons.length > 1 && totalIcons >= 6) {
      const icon2 = shuffledIcons[1];
      let placed = false;
      
      // Intentar varias veces para encontrar una ubicación válida
      for (let attempt = 0; attempt < 10 && !placed; attempt++) {
        const row = getRandomInt(2, actualSize - 3);
        const col = getRandomInt(2, actualSize - 3);
        
        // Verificar que no esté demasiado cerca del primer grupo
        if (Math.abs(row - centerRow) + Math.abs(col - centerCol) >= 4) {
          // Centro del segundo grupo
          newBoard[row][col] = icon2;
          
          // Dos posiciones adyacentes
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
    
    // Añadir iconos aleatorios adicionales hasta alcanzar totalIcons
    console.log(`Fase 5: Colocando iconos aleatorios adicionales hasta ${totalIcons}`);
    let maxAttempts = totalIcons * 5; // Limitar número máximo de intentos
    
    while (placedIcons < totalIcons && maxAttempts > 0) {
      maxAttempts--;
      const row = getRandomInt(0, actualSize);
      const col = getRandomInt(0, actualSize);
      
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
          
          // Verificar manualmente si causaría una convergencia
          const hasConvergence = checkCellForConvergence(newBoard, row, col);
          
          if (!hasConvergence) {
            validIcon = true;
            placedIcons++;
          } else {
            // Si causa convergencia, vaciar la celda y probar otro icono
            newBoard[row][col] = null;
          }
          
          attempts++;
        }
        
        // Si no encontramos un icono válido después de varios intentos, dejamos la celda vacía
        if (!validIcon) {
          newBoard[row][col] = null;
        }
      }
    }
    
    // Verificar que haya al menos un movimiento válido
    const hasMovesAvailable = checkBoardForValidMoves(newBoard, actualSize, availableIcons);
    console.log(`Fase 6: Verificación de movimientos válidos: ${hasMovesAvailable ? 'OK' : 'Sin movimientos'}`);
    
    if (!hasMovesAvailable) {
      console.log("ADVERTENCIA: Tablero inicializado sin movimientos válidos. Corrigiendo...");
      
      // Forzar al menos un movimiento válido
      // Buscar una celda vacía
      let emptyCellFound = false;
      for (let row = 0; row < actualSize && !emptyCellFound; row++) {
        for (let col = 0; col < actualSize && !emptyCellFound; col++) {
          if (newBoard[row][col] === null) {
            // Encontrar una celda adyacente con un icono
            for (const dir of directions) {
              const newRow = row + dir.dr;
              const newCol = col + dir.dc;
              
              if (newRow >= 0 && newRow < actualSize && newCol >= 0 && newCol < actualSize && 
                  newBoard[newRow][newCol] !== null) {
                // Colocar el mismo icono en otra celda adyacente para crear un movimiento válido
                const icon = newBoard[newRow][newCol];
                
                for (const dir2 of directions) {
                  if (dir.dr !== dir2.dr || dir.dc !== dir2.dc) { // Dirección diferente
                    const targetRow = row + dir2.dr;
                    const targetCol = col + dir2.dc;
                    
                    if (targetRow >= 0 && targetRow < actualSize && targetCol >= 0 && targetCol < actualSize && 
                        newBoard[targetRow][targetCol] === null) {
                      // Colocar el mismo icono
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
    
    // Contar el número real de iconos colocados
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
    
    // Asegurarse de que el tablero se actualiza en el estado
    dispatch(updateBoard(newBoard));
    console.log("Fase 9: Tablero actualizado en el estado global");
    
    // Actualizar el conteo de iconos en el estado
    dispatch(setIconCount(actualIconCount));
    
    // Configurar objetivos de nivel según el modo de juego
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
    
    // Marcar la inicialización como completada (siempre se marca como verdadero)
    isInitializedRef.current = true;
    console.log("Fase 11: Tablero marcado como inicializado");
    
    // Actualizamos la velocidad basada en la dificultad actual
    const updateSpawnRateFromDifficulty = () => {
      const currentState = store.getState().game;
      const difficulty = currentState.currentDifficulty;
      const difficultyConfig = config.getDifficultyConfig(difficulty as GameMode);
      
      if (difficultyConfig) {
        const currentSpawnRate = store.getState().game.spawnRate;
        // Si hay una configuración específica de dificultad, la usamos directamente
        console.log(`\n[VELOCIDAD] Configuración de dificultad ${difficulty}:`);
        console.log(`- SpawnRate actual: ${currentSpawnRate}ms`);
        console.log(`- SpawnRate configurado: ${difficultyConfig.spawnRate}ms`);
        
        if (currentSpawnRate !== difficultyConfig.spawnRate) {
          console.log(`[VELOCIDAD] Actualizando velocidad: ${currentSpawnRate}ms → ${difficultyConfig.spawnRate}ms`);
          dispatch(setSpawnRate(difficultyConfig.spawnRate));
        } else {
          console.log(`[VELOCIDAD] Manteniendo velocidad actual: ${currentSpawnRate}ms`);
        }
        
        // Verificar que se haya aplicado correctamente
        setTimeout(() => {
          const updatedState = store.getState().game;
          console.log(`[SPAWN RATE] Verificación: El spawn rate actual es ${updatedState.spawnRate}ms`);
        }, 0);
      } else {
        console.log(`[VELOCIDAD] No se encontró configuración específica para dificultad ${difficulty}, manteniendo velocidad actual`);
      }
    };
    
    // Llamar a la función de actualización de velocidad
    updateSpawnRateFromDifficulty();
    
    // Mejorar función para establecer la ventana de tiempo de combo según la dificultad
    const updateComboTimeWindow = () => {
      const gameState = store.getState().game;
      const difficulty = gameState.currentDifficulty;
      
      // Obtener la ventana de tiempo apropiada desde la configuración
      const timeWindow = config.COMBO_SYSTEM.TIME_WINDOWS[difficulty] || config.COMBO_SYSTEM.TIME_WINDOWS.normal;
      
      console.log(`[COMBO CONFIG] Actualizando ventana de tiempo de combo para dificultad ${difficulty}: ${timeWindow}ms`);
      
      // Asegurar que se actualice la ventana de tiempo
      dispatch({ type: 'game/setComboTimeWindow', payload: timeWindow });
      
      // Verificar que se actualizó correctamente
      setTimeout(() => {
        const updatedState = store.getState().game;
        console.log(`[COMBO CONFIG] Verificación: La ventana de tiempo actual es ${updatedState.comboTimeWindow}ms`);
      }, 0);
    };

    // Actualizar la ventana de tiempo para combos según la dificultad actual
    updateComboTimeWindow();

    console.log("**********************************************************\n");
    console.log(`FIN DEL FLUJO: TABLERO INICIALIZADO CORRECTAMENTE PARA NIVEL ${targetLevel}`);
    
    return newBoard;
  }, [dispatch]);
  
  // Configuración personalizada para el iconSpawner
  const iconSpawnerConfig: IconSpawnerConfig = {
    minIntervalPercentage: 0.95,
    minAbsoluteInterval: 500,
    maxSpawningTimeout: 0
  };

  // Usar el hook refactorizado para el spawn de iconos
  const { 
    addRandomIcon, 
    isSpawningRef, 
    lastIconAddedTimeRef,
    resetSpawningState 
  } = useIconSpawner(
    levelTransitionGraceRef,
    hasValidMoves,
    addNotification,
    iconSpawnerConfig
  );
  
  // Usar el hook para control de velocidad
  const {
    handleSpeedIncrease,
    resetSpeedIncreaseTime
  } = useSpeedController(
    lastSpeedIncreaseTimeRef,
    addNotification
  );
  
  // Detener todos los temporizadores del juego
  const stopTimers = useCallback(() => {
    const timeFormatted = getLogTimestamp();
    
    console.log(`\n[${timeFormatted}] **********************************************************`);
    console.log(`[${timeFormatted}] INICIO DEL FLUJO: DETENER TEMPORIZADORES`);
    console.log(`[${timeFormatted}] Estado: ${status}, Temporizadores activos: ${timersActiveRef.current ? 'Sí' : 'No'}`);
    console.log(`[${timeFormatted}] **********************************************************`);
    
    // Si los temporizadores ya están detenidos, no hacer nada
    if (!timersActiveRef.current) {
      logger.debug('GameLogic', 'Los temporizadores ya estaban detenidos');
    }
    
    // Marcar que los temporizadores ya no están activos
    timersActiveRef.current = false;
    
    // Detener intervalo de tiempo
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
      console.log(`[${timeFormatted}] Fase 1: Temporizador de tiempo de juego detenido`);
    }
    
    // Detener temporizador de pistas
    if (iconTimerIntervalRef.current) {
      clearInterval(iconTimerIntervalRef.current);
      iconTimerIntervalRef.current = null;
      console.log(`[${timeFormatted}] Fase 2: Temporizador de spawn de iconos detenido`);
    }
    
    console.log(`[${timeFormatted}] Fase 3: Referencias de temporizadores reiniciadas`);
    console.log(`[${timeFormatted}] **********************************************************`);
    console.log(`\n[${timeFormatted}] FIN DEL FLUJO: TEMPORIZADORES DETENIDOS CORRECTAMENTE`);
  }, [status]);

  // Iniciar todos los temporizadores del juego
  const startTimers = useCallback((forceStart = false) => {
    // Obtener timestamp para los logs
    const timeFormatted = getLogTimestamp();
    
    // Obtener estado actual del juego
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
    
    // Si los temporizadores ya están activos y no se fuerza el inicio, no hacer nada
    if (timersActiveRef.current && !forceStart) {
      console.log(`[${timeFormatted}] Los temporizadores ya están activos.`);
      return;
    }
    
    // Si el estado no es playing y no se fuerza el inicio, no hacer nada
    if (gameStatus !== 'playing' && !forceStart) {
      console.log(`[${timeFormatted}] Fase 1: No se inician temporizadores porque el estado es ${gameStatus}`);
      return;
    }
    
    // Limpiar temporizadores existentes antes de crear otros nuevos
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
    
    // Reiniciar conteo para el incremento de velocidad
    resetSpeedIncreaseTime();
    console.log(`[${timeFormatted}] Reiniciando contador de incremento de velocidad en tiempo: ${lastSpeedIncreaseTimeRef.current}s`);
    
    console.log(`[${timeFormatted}] Fase 2: Referencias de temporizadores establecidas`);
    
    // Importante: Reiniciar el estado de spawning al iniciar temporizadores
    resetSpawningState();
    
    // Temporizador general del juego (aumenta el contador de tiempo)
    timerIntervalRef.current = setInterval(() => {
      // Verificar que el juego siga activo
      const gameStatus = store.getState().game.status;
      if (gameStatus !== 'playing') {
        return;
      }
      
      // Para depuración, incrementar contador local
      timerRef.current++;
      
      // Incrementar contador de tiempo en el estado global 
      dispatch(incrementTimer());
      
      // Actualizar tiempo restante en modo contrarreloj si corresponde
      if (currentPlayMode === 'timed') {
        const currentTimeRemaining = store.getState().game.timeRemaining;
        if (currentTimeRemaining > 0) {
          dispatch(decrementTimeRemaining());
          
          // Verificar si se acabó el tiempo
          if (currentTimeRemaining === 1) {
            dispatch(setGameEndReason('¡Se acabó el tiempo! Modo contrarreloj finalizado.'));
            dispatch(setGameStatus('gameOver'));
            return;
          }
          
          // Alerta para tiempos bajos
          if (currentTimeRemaining === 10) {
            audioManager.play('timeWarning');
            addNotification({
              message: '¡10 segundos restantes!',
              type: 'info',
              icon: '⏱️',
              duration: 3000
            });
          }
        }
      }
      
      // En modo supervivencia, aumentar el tiempo de supervivencia
      if (currentPlayMode === 'survival') {
        dispatch(decrementTimeRemaining());
        
        // Cada 10 segundos, mostrar el tiempo actual
        const currentSurvivalTime = store.getState().game.survivalTime;
        if (currentSurvivalTime % 30 === 0 && currentSurvivalTime > 0) {
          addNotification({
            message: `Tiempo: ${formatTimestamp(currentSurvivalTime * 1000)}`,
            type: 'info',
            icon: '⏱️',
            duration: 2000
          });
        }
      }
      
      // Verificar si es momento de incrementar la velocidad automáticamente
      handleSpeedIncrease();
      
      // Manejar el modo supervivencia - aumentar velocidad con el tiempo
      if (currentPlayMode === 'survival' && !speedLimitReachedRef.current) {
        const currentTimer = store.getState().game.timer;
        
        const newSpawnRate = Math.max(
          MIN_SPAWN_RATE,
          INITIAL_SPAWN_RATE * Math.pow(0.99, Math.floor(currentTimer / 3))
        );
        
        if (newSpawnRate <= MIN_SPAWN_RATE) {
          speedLimitReachedRef.current = true;
        }
        
        if (Math.abs(newSpawnRate - currentSpawnRate) > 50) {
          dispatch(setSpawnRate(newSpawnRate));
        }
      }
    }, 1000);
    console.log(`[${timeFormatted}] Fase 3: Temporizador de tiempo de juego iniciado`);
    
    // Temporizador para añadir iconos aleatorios al tablero
    const effectiveSpawnRate = Math.max(MIN_SPAWN_RATE, Math.min(10000, currentSpawnRate));
    if (effectiveSpawnRate !== currentSpawnRate) {
      console.log(`[${timeFormatted}] Ajuste de seguridad en startTimers: spawnRate ${currentSpawnRate}ms → ${effectiveSpawnRate}ms`);
    }
    
    iconTimerIntervalRef.current = setInterval(() => {
      // Verificar que el juego siga activo
      const gameStatus = store.getState().game.status;
      if (gameStatus !== 'playing') {
        return;
      }
      
      // La lógica de tiempo mínimo entre iconos ya se maneja en addRandomIcon
      addRandomIcon();
      
      // Log para depuración
      logger.debug('GameLogic', `Intervalo de spawn activado (${effectiveSpawnRate}ms)`);
    }, effectiveSpawnRate);
    console.log(`[${timeFormatted}] Fase 4: Temporizador de spawn de iconos iniciado (cada ${effectiveSpawnRate}ms)`);
    
    // Resetear el tiempo del último icono para permitir que aparezca el primero inmediatamente
    lastIconAddedTimeRef.current = 0;
    
    // Marcar temporizadores como activos
    timersActiveRef.current = true;
    
    console.log(`[${timeFormatted}] **********************************************************`);
    console.log(`[${timeFormatted}] FIN DEL FLUJO: TEMPORIZADORES INICIADOS CORRECTAMENTE`);
  }, [dispatch, addNotification, status, currentPlayMode, addRandomIcon, resetSpeedIncreaseTime, resetSpawningState]);

  // Añadir también el useEffect para limpiar recursos
  useEffect(() => {
    return () => {
      // Limpiar temporizadores al desmontar
      stopTimers();
      // Asegurarse de reiniciar el estado de spawning
      resetSpawningState();
    };
  }, [stopTimers, resetSpawningState]);

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
        
        // ---------- NUEVA LÓGICA DE COMBOS MEJORADA ----------
        // Obtenemos el estado actual para verificar el combo
        const { comboTimestamp, comboTimeWindow, comboMultiplier, comboCount } = store.getState().game;
        const currentTime = Date.now();
        
        console.log("\n[COMBO DEBUG] ===== Inicio de análisis de combo =====");
        console.log(`[COMBO DEBUG] Iconos eliminados: ${removedCount}`);
        console.log(`[COMBO DEBUG] Estado actual: Combo: ${comboCount}, Multiplicador: ${comboMultiplier.toFixed(1)}x`);
        console.log(`[COMBO DEBUG] Timestamp actual: ${currentTime}`);
        console.log(`[COMBO DEBUG] Timestamp última eliminación: ${comboTimestamp}`);
        console.log(`[COMBO DEBUG] Ventana de tiempo: ${comboTimeWindow}ms`);
        
        // FIX: Asegurarse de que el cálculo de tiempo transcurrido se haga correctamente
        // Solo calcular el tiempo transcurrido si el timestamp anterior no es 0
        const elapsedTime = comboTimestamp === 0 ? 0 : currentTime - comboTimestamp;
        console.log(`[COMBO DEBUG] Tiempo transcurrido: ${elapsedTime}ms`);
        console.log(`[COMBO DEBUG] ¿Dentro de ventana de tiempo?: ${elapsedTime <= comboTimeWindow ? 'SÍ' : 'NO'}`);
        
        // FIX: Lógica mejorada para el primer combo y combos subsecuentes
        if (comboTimestamp === 0 || comboCount === 0) {
          console.log(`[COMBO DEBUG] Primer combo detectado, iniciando secuencia`);
          dispatch(incrementCombo());
        }
        // Verificar si estamos dentro de la ventana de combo
        else if (elapsedTime <= comboTimeWindow) {
          // Incrementar combo si estamos dentro de la ventana de tiempo
          console.log(`[COMBO DEBUG] Tiempo dentro de ventana, incrementando combo`);
          dispatch(incrementCombo());
        } else {
          // Reiniciar combo si ha pasado demasiado tiempo
          console.log(`[COMBO DEBUG] Tiempo fuera de ventana, reiniciando combo`);
          dispatch(resetCombo());
          // Y comenzar un nuevo combo
          setTimeout(() => {
            console.log(`[COMBO DEBUG] Iniciando nuevo combo después del reset`);
            dispatch(incrementCombo());
          }, 0);
        }
        
        // Obtener el multiplicador actualizado después del incremento/reseteo
        const updatedState = store.getState().game;
        const activeMultiplier = updatedState.comboMultiplier;
        
        // Aplicar el multiplicador de combo a los puntos base
        const basePoints = removedCount * 10 * level;
        const pointsWithCombo = Math.floor(basePoints * activeMultiplier);
        
        // Primero asegurarnos que se actualice lastComboPoints con el valor correcto
        // y luego enviar los puntos base al incrementCombo
        dispatch(incrementCombo(basePoints));
        
        // Mostrar información detallada sobre los puntos
        console.log(`[COMBO DEBUG] Puntos base: ${basePoints} (${removedCount} iconos × 10 × nivel ${level})`);
        console.log(`[COMBO DEBUG] Multiplicador aplicado: ${activeMultiplier.toFixed(1)}x`);
        console.log(`[COMBO DEBUG] Puntos finales con combo: ${pointsWithCombo}`);
        
        // Incrementar la puntuación con el nuevo multiplicador
        dispatch(incrementScore(pointsWithCombo));
        
        // Mostrar animación de puntos pasando los puntos base, no lastComboPoints
        // ya que lastComboPoints podría estar desactualizado en este momento
        showPointsEarned(basePoints, iconsToRemove[0].row, iconsToRemove[0].col);
        
        // Verificar si se alcanzaron hitos importantes
        console.log(`[COMBO DEBUG] Combo actual: ${updatedState.comboCount}, verificando hitos`);
        
        // Bonificaciones por hitos de combo importantes
        if (updatedState.comboCount === 10) {
          // Bonus por alcanzar 10 combos
          const bonus = config.COMBO_SYSTEM.MILESTONE_BONUSES[10];
          dispatch(incrementScore(bonus));
          console.log(`[COMBO DEBUG] ¡HITO! Combo x10 alcanzado. +${bonus} puntos extra`);
          /* addNotification({
            message: '¡COMBO x10!',
            type: 'success',
            duration: 2000,
            value: `+${bonus} puntos`
          }); */
        } else if (updatedState.comboCount === 20) {
          // Bonus mayor por alcanzar 20 combos
          const bonus = config.COMBO_SYSTEM.MILESTONE_BONUSES[20];
          dispatch(incrementScore(bonus));
          console.log(`[COMBO DEBUG] ¡HITO! Combo x20 alcanzado. +${bonus} puntos extra`);
          /* addNotification({
            message: '¡COMBO x20!',
            type: 'success',
            duration: 2000,
            value: `+${bonus} puntos`
          }); */
        } else if (updatedState.comboCount === 30) {
          // Bonus mayor por alcanzar 30 combos
          const bonus = config.COMBO_SYSTEM.MILESTONE_BONUSES[30];
          dispatch(incrementScore(bonus));
          console.log(`[COMBO DEBUG] ¡HITO! Combo x30 alcanzado. +${bonus} puntos extra`);
          /* addNotification({
            message: '¡COMBO x30!',
            type: 'success',
            duration: 2000,
            value: `+${bonus} puntos`
          }); */
        }
        
        // Mostrar notificación de combo si es relevante
        if (activeMultiplier > 1.0) {
          console.log(`[COMBO DEBUG] Mostrar notificación de combo: x${updatedState.comboCount} (${activeMultiplier.toFixed(1)}x)`);
          /* addNotification({
            message: `¡COMBO x${updatedState.comboCount}!`,
            type: 'success',
            duration: 1500,
            value: `x${activeMultiplier.toFixed(1)}`
          }); */
          
          // Reproducir sonido de combo según el nivel
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
        // ---------- FIN NUEVA LÓGICA DE COMBOS MEJORADA ----------
        
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
          
          console.log(`Bonus de tiempo añadido: +${timeBonus} segundos`);
        }
        
        audioManager.play('removeIcon');

        // Animación de puntos - NOTA: No necesitamos calcular los puntos aquí, 
        // ya que la función showPointsEarned va a usar lastComboPoints
        showPointsEarned(basePoints, iconsToRemove[0].row, iconsToRemove[0].col);
      }, 50);
    });
  }, [board, dispatch, iconCount, currentPlayMode, level]);

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
    
    // Establecer el período de gracia
    setLevelTransitionGrace(3);
    console.log(`PERÍODO DE GRACIA: Establecido a 3 iconos para reinicio de nivel ${level}`);
    
    setTimeout(() => {
      initializeBoard();
      dispatch(rechargeHint());
      startTimers();
    }, 100);
    
    return true;
  }, [dispatch, stopTimers, initializeBoard, startTimers, level]);
  
  // Avanzar al siguiente nivel
  const advanceToNextLevel = useCallback(() => {
    dispatch(setLevel(level + 1));
    stopTimers();
    
    // Establecer el período de gracia
    setLevelTransitionGrace(3);
    console.log(`PERÍODO DE GRACIA: Establecido a 3 iconos para nivel ${level + 1}`);
    
    initializeBoard();
    dispatch(rechargeHint());
    dispatch(setGameStatus('playing'));
  }, [dispatch, level, initializeBoard, stopTimers]);

  // Efecto para detección de tablero lleno o sin movimientos válidos
  useEffect(() => {
    // Solo comprobar cuando el juego está activo y hay iconos en el tablero
    if (status !== 'playing' || !board || board.length === 0 || iconCount === 0) {
      return;
    }

    // Evitar múltiples evaluaciones por ciclo
    const timeoutId = setTimeout(() => {
      // Si está cambiando de nivel, no evaluar
      if (store.getState().game.status !== 'playing') {
        return;
      }

      // REFACTORIZADO: Usar la nueva función modular de checkGameEndCondition
      // La lógica completa ahora está en el módulo gameEndConditions.ts
      checkGameEndCondition(board, boardSize, availableIcons);

    }, 100); // Usar un pequeño retraso para permitir que otras operaciones se completen
    
    return () => clearTimeout(timeoutId);
  }, [board, status, boardSize, hasValidMoves, dispatch, iconCount]);

  // Cambiar configuración del juego
  const changeGameConfig = useCallback((newConfig: { difficulty: GameDifficulty, mode: GamePlayMode }) => {
    // Registrar el cambio de configuración
    console.log("\n**********************************************************");
    console.log("INICIO DEL FLUJO: CAMBIO DE CONFIGURACIÓN DEL JUEGO");
    console.log(`Cambiando a dificultad: ${newConfig.difficulty}, modo: ${newConfig.mode}`);
    console.log("**********************************************************");
    
    // Detener temporizadores para evitar conflictos durante el cambio
    stopTimers();
    
    // Limpiar estado y referencias para evitar inconsistencias
    isInitializedRef.current = false;
    
    // Actualizar el estado de Redux con la nueva configuración
    dispatch(setGameMode(newConfig.difficulty));
    dispatch(setPlayMode(newConfig.mode));
    
    // Sincronizar todo el estado para evitar referencias a configuraciones antiguas
    const syncGameState = () => {
      const { level: currentLevel, status } = store.getState().game;
      
      // Configurar iconos para el nivel actual
      const iconSet = config.getIconSetForLevel(currentLevel);
      dispatch(setAvailableIcons(iconSet));
      
      // Configurar tamaño del tablero
      const boardSize = config.getBoardSizeForLevel(currentLevel);
      dispatch(setBoardSize(boardSize));
      
      // Aplicar configuración de dificultad
      const difficultyConfig = config.getDifficultyConfig(newConfig.difficulty as GameMode);
      if (difficultyConfig) {
        console.log(`Aplicando configuración de dificultad ${newConfig.difficulty}:`);
        console.log(`- SpawnRate: ${difficultyConfig.spawnRate}ms`);
        console.log(`- Íconos iniciales: ${difficultyConfig.initialIconCount}`);
        console.log(`- Penalización: ${difficultyConfig.penaltyIcons} íconos`);
        
        // Aplicar velocidad de spawn según la dificultad
        dispatch(setSpawnRate(difficultyConfig.spawnRate));
      }
      
      // Obtener la configuración completa combinada
      const gameConfig = config.getGameConfig(newConfig.difficulty, newConfig.mode);
      
      // Configurar objetivos específicos según el modo
      if (newConfig.mode === 'classic') {
        // Configurar objetivos de puntuación y ocupación para el modo clásico
        const scoreTarget = Math.round(gameConfig.initialScoreTarget * 
                        Math.pow(gameConfig.scoreTargetMultiplier || 1.5, currentLevel - 1));
        
        // Ajustar los objetivos según la dificultad
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
        // Configuración específica para modo contrarreloj
        let timeLimit = gameConfig.initialTimeLimit - 
                       (currentLevel - 1) * (gameConfig.timeDecreasePerLevel || 10);
                       
        // Ajustar tiempo según dificultad
        const difficultyMod = config.LEVEL_REQUIREMENT_MULTIPLIERS[newConfig.difficulty as GameMode] || 
                             config.LEVEL_REQUIREMENT_MULTIPLIERS.normal;
        
        timeLimit = Math.round(timeLimit * difficultyMod.timeRequirement);
        
        console.log(`Configurando tiempo límite para nivel ${currentLevel}: ${timeLimit} segundos`);
        dispatch(setLevelTimeLimit(Math.max(30, timeLimit)));
      }
      
      // Configurar ventana de tiempo para los combos según la dificultad
      const comboTimeWindow = config.COMBO_SYSTEM.TIME_WINDOWS[newConfig.difficulty as GameMode] || 
                             config.COMBO_SYSTEM.TIME_WINDOWS.normal;
      
      console.log(`Configurando ventana de tiempo para combos: ${comboTimeWindow}ms`);
      dispatch({ type: 'game/setComboTimeWindow', payload: comboTimeWindow });
      
      // Inicializar un nuevo tablero con los ajustes actualizados
      initializeBoard(boardSize, true);
      
      // Verificar que toda la configuración se haya aplicado correctamente
      setTimeout(() => {
        const updatedState = store.getState().game;
        console.log("Verificación de configuración aplicada:");
        console.log(`- Dificultad: ${updatedState.currentDifficulty}`);
        console.log(`- Modo: ${updatedState.currentPlayMode}`);
        console.log(`- SpawnRate: ${updatedState.spawnRate}ms`);
        console.log(`- Ventana de combo: ${updatedState.comboTimeWindow}ms`);
      }, 50);
      
      // Reiniciar temporizadores si el juego estaba en progreso
      if (status === 'playing') {
        startTimers(true);
      }
    };
    
    // Ejecutar sincronización después de un pequeño retraso para permitir 
    // que las actualizaciones del estado de Redux se completen
    setTimeout(syncGameState, 50);
    
    console.log("**********************************************************");
    console.log("FIN DEL FLUJO: CONFIGURACIÓN DEL JUEGO ACTUALIZADA");
    
    // Actualizar el período de gracia para evitar game over inmediato
    // REFACTORIZADO: Usar la función del nuevo módulo
    setLevelTransitionGrace(3);
    logger.info('GameLevel', `Período de gracia establecido: 3 iconos`);
    
  }, [dispatch, stopTimers, initializeBoard, startTimers, addNotification]);

  // Método auxiliar para mantener compatibilidad con el formato anterior de llamada
  const changeGameConfigLegacy = useCallback((difficulty: GameDifficulty, mode: GamePlayMode) => {
    return changeGameConfig({ difficulty, mode });
  }, [changeGameConfig]);

  // En la función checkLevelCompleted, reemplazar la lógica actual con el adaptador:
  const checkLevelCompleted = () => {
    if (status !== 'playing' || iconCount === 0) return false;
    
    // Comprobar si hay movimientos válidos disponibles
    const movesAvailable = hasValidMoves();
    
    // Usar el nuevo sistema de niveles a través del adaptador
    return levelAdapter.isLevelCompleted(
      level,
      currentPlayMode,
      score,
      iconCount,
      boardSize,
      timeRemaining,
      survivalTime,
      timerRef.current, // Pasar el timer actual para verificar tiempo mínimo de juego
      movesAvailable  // Pasar si hay movimientos disponibles
    );
  };
  
  // En la función configureBoardForNewLevel, utilizar el nuevo sistema:
  const configureBoardForNewLevel = useCallback(() => {
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
    
    // Establecer período de gracia para evitar game over inmediato
    levelTransitionGraceRef.current = 3;
    setLevelTransitionGrace(3);
    logger.info('Game', `Período de gracia establecido a ${levelTransitionGraceRef.current} iconos para el nuevo nivel`);
  }, [currentPlayMode, level, dispatch, addNotification]);

  /**
   * Reinicia completamente todos los sistemas del juego para un nuevo nivel
   */
  const resetSystemsForNewLevel = useCallback(() => {
    const { level, currentPlayMode, spawnRate, iconCount } = store.getState().game;
    
    console.log("\n**********************************************************");
    console.log("INICIO DEL FLUJO: REINICIAR SISTEMAS PARA NUEVO NIVEL");
    console.log(`Nivel actual: ${level}, Modo: ${currentPlayMode}`);
    console.log(`SpawnRate: ${spawnRate}ms, Iconos en tablero: ${iconCount}`);
    console.log("**********************************************************");
    
    // Detener temporizadores si están activos
    stopTimers();
    console.log("Fase 1: Temporizadores detenidos");
    
    // Reiniciar referencias
    isRemovingIconsRef.current = false;
    isSpawningRef.current = false;
    speedLimitReachedRef.current = false;
    console.log("Fase 2: Referencias de estado reiniciadas");
    
    // Limpiar cualquier intervalo residual
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (iconTimerIntervalRef.current) {
      clearInterval(iconTimerIntervalRef.current);
      iconTimerIntervalRef.current = null;
    }
    console.log("Fase 3: Intervalos residuales limpiados");
    
    // Obtener estado actual para aplicar configuraciones específicas del nivel
    const { level: currentLevel, spawnRate: currentSpawnRate } = store.getState().game;
    console.log(`Fase 4: Estado actual obtenido: nivel=${currentLevel}, spawnRate=${currentSpawnRate}ms`);
    
    // Actualizar el spawn rate para el nuevo nivel
    dispatch(setSpawnRate(currentSpawnRate));
    console.log(`Fase 5: SpawnRate actualizado a ${currentSpawnRate}ms`);
    
    // Reiniciar el contador de incremento de velocidad
    resetSpeedIncreaseTime();
    console.log(`Fase 6: Contador de incremento de velocidad reiniciado`);
    
    // Mantener el tiempo transcurrido en modo supervivencia
    if (currentPlayMode === 'survival') {
      console.log(`Fase 7: Manteniendo tiempo de supervivencia (modo ${currentPlayMode})`);
    }
    
    // Limpiar celdas resaltadas
    dispatch(setHighlightedCells([]));
    console.log("Fase 8: Celdas resaltadas limpiadas");
    
    // Establecer período de gracia para evitar game over inmediato
    levelTransitionGraceRef.current = 3;
    console.log(`Fase 9: Período de gracia establecido para los próximos ${levelTransitionGraceRef.current} iconos`);
    
    console.log("**********************************************************\n");
    console.log("FIN DEL FLUJO: SISTEMAS REINICIADOS CORRECTAMENTE");
    
    return true;
  }, [dispatch, stopTimers]);

  // Obtener la función showPointsEarned del componente de tablero
  const showPointsEarned = useCallback((points: number, row?: number, col?: number) => {
    // Implementación básica para mostrar puntos si no podemos acceder a la del GameBoard
    const { comboCount, comboMultiplier, lastComboPoints } = store.getState().game;
    const hasActiveCombo = comboCount >= 3;
    
    // Usar el sistema de notificaciones para mostrar puntos, pero no para combos
    if (!hasActiveCombo) {
      addNotification({
        message: '¡Puntos!',
        type: 'success',
        icon: '💰',
        duration: 1000,
        value: `+${points}`
      });
    }
    // Los combos ya no muestran notificaciones
  }, [addNotification]);

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
  };
};

export default useGameLogic;