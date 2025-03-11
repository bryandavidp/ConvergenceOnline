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
} from '../utils/gameUtils';
import { audioManager } from '../utils/audioManager';
import * as boardUtils from '../utils/boardUtils';
import { adjustBoardVisuals } from '../utils/boardUtils';
import * as levelAdapter from '../utils/levelAdapter';
import { useNotifications } from '../components/game/GameNotifications/GameNotificationManager';
import { NotificationType } from '../components/game/GameNotifications/GameNotification';

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
  const timerIntervalRef = useRef<NodeJS.Timeout | number | null>(null);
  const iconTimerIntervalRef = useRef<NodeJS.Timeout | number | null>(null);
  const isRemovingIconsRef = useRef<boolean>(false);
  const isSpawningRef = useRef<boolean>(false);
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
  const levelTransitionGraceRef = useRef<number>(0);
  
  // Referencia para controlar intentos frecuentes de iniciar temporizadores
  const lastStartTimersAttemptRef = useRef<number>(0);
  
  // Referencia para controlar la frecuencia de aparición de iconos
  const lastIconAddedTimeRef = useRef<number>(0);
  
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
    var difficultyConfig = config.getDifficultyConfig(currentDifficulty);
    
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
    
    // Actualizar la velocidad basada en la dificultad actual
    const currentState = store.getState().game;
    const difficulty = currentState.currentDifficulty;
    const currentMode = currentState.currentPlayMode;
    difficultyConfig = config.getDifficultyConfig(difficulty as GameMode);
    
    if (difficultyConfig) {
      let effectiveSpawnRate = difficultyConfig.spawnRate;
      
      // Ajustes específicos por modo de juego
      if (currentMode === 'survival') {
        // En supervivencia, comienza ligeramente más lento que el spawn base
        effectiveSpawnRate = Math.round(effectiveSpawnRate * 1.1);
      } else if (currentMode === 'timed') {
        // En contrarreloj, comienza ligeramente más rápido
        effectiveSpawnRate = Math.round(effectiveSpawnRate * 0.9);
      }
      
      // Verificar que la velocidad esté en rangos razonables
      const minRate = config.MIN_SPAWN_RATE;
      const maxRate = 6000; // Valor máximo razonable para la velocidad de spawn (6 segundos)
      effectiveSpawnRate = Math.max(minRate, Math.min(maxRate, effectiveSpawnRate));
      
      // Si hay una configuración específica de dificultad, la usamos directamente
      console.log(`Aplicando configuración específica de dificultad ${difficulty}: spawnRate=${effectiveSpawnRate}ms`);
      dispatch(setSpawnRate(effectiveSpawnRate));
      
      // Verificar que se haya aplicado correctamente
      setTimeout(() => {
        const updatedState = store.getState().game;
        console.log(`[SPAWN RATE] Verificación: El spawn rate actual es ${updatedState.spawnRate}ms`);
      }, 0);
    } else {
      console.log(`No se encontró configuración específica para dificultad ${difficulty}, manteniendo spawnRate=${INITIAL_SPAWN_RATE}ms`);
    }
    
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

    // Llamar a la función de actualización de ventana de combo
    updateComboTimeWindow();

    console.log("**********************************************************\n");
    console.log(`FIN DEL FLUJO: TABLERO INICIALIZADO CORRECTAMENTE PARA NIVEL ${targetLevel}`);
    
    return newBoard;
  }, [dispatch, level, currentPlayMode, currentDifficulty, addNotification]);
  
  // Añadir un icono aleatorio al tablero
  const addRandomIcon = useCallback(() => {
    // Obtenemos el estado actual directamente del store para asegurar valores actualizados
    const gameState = store.getState().game;
    console.log("\n**********************************************************");
    console.log("INICIO DEL FLUJO: AÑADIR ICONO ALEATORIO");
    console.log(`Nivel: ${gameState.level}, Modo: ${gameState.currentPlayMode}`);
    console.log(`Contador de iconos actual: ${gameState.iconCount}`);
    console.log(`Iconos disponibles: ${gameState.availableIcons.join(', ')}`);
    console.log("**********************************************************");
    
    // Si ya estamos en proceso de añadir un icono, evitar la recursión
    if (isSpawningRef.current) {
      console.log("Saltando spawn porque ya hay uno en proceso...");
      return;
    }
    
    // Control de velocidad para prevenir que los iconos aparezcan demasiado rápido
    // Esto es una medida de seguridad contra múltiples intervalos activos
    const currentTime = performance.now(); // Usar performance.now para mayor precisión
    const lastAddTime = lastIconAddedTimeRef.current || 0;
    const timeSinceLastAdd = currentTime - lastAddTime;
    
    // Usar exactamente la tasa de spawn configurada como intervalo mínimo
    // No permitir que se añadan iconos más rápido que la tasa configurada
    const configuredSpawnRate = gameState.spawnRate;
    
    // Como medida de seguridad, asegurar un valor mínimo razonable
    // Reducir a 75% para mayor fluidez pero manteniendo la protección
    const minimumInterval = Math.max(300, configuredSpawnRate * 0.75);
    
    if (timeSinceLastAdd < minimumInterval) {
      console.log(`Protección de velocidad: Ignorando addRandomIcon, último añadido hace ${timeSinceLastAdd.toFixed(0)}ms (mínimo ${minimumInterval.toFixed(0)}ms)`);
      return;
    }
    
    isSpawningRef.current = true;
    console.log("Fase 1: Marcando estado de spawning como activo");
    
    try {
      const { 
        board: currentBoard, 
        status: gameStatus,
        iconCount: currentIconCount,
        boardSize: currentBoardSize,
        level: currentLevel,
        availableIcons: currentAvailableIcons
      } = store.getState().game;
      
      // Verificar que el estado sea válido
      if (gameStatus !== 'playing') {
        console.log(`Cancelando spawn: estado=${gameStatus} no es 'playing'`);
        console.log("**********************************************************\n");
        isSpawningRef.current = false;
        return;
      }
      
      // Actualizar el timestamp del último icono añadido
      lastIconAddedTimeRef.current = currentTime;
      
      // Verificar que el tablero sea válido
      if (!currentBoard || !currentBoard.length) {
        console.log(`Cancelando spawn: tablero no es válido`);
        console.log("**********************************************************\n");
        isSpawningRef.current = false;
        return;
      }
      
      console.log(`Fase 2: Estado y tablero verificados (válidos)`);
      
      // Verificar si hay espacio en el tablero
      const totalCells = currentBoardSize * currentBoardSize;
      const occupationPercentage = (currentIconCount / totalCells) * 100;
      
      // Si el tablero está muy lleno, no añadir más iconos
      if (occupationPercentage >= MAX_OCCUPATION_PERCENTAGE) {
        console.log(`Cancelando spawn: tablero demasiado lleno (${occupationPercentage.toFixed(1)}%)`);
        console.log("**********************************************************\n");
        isSpawningRef.current = false;
        return;
      }
      
      // Verificar si hay movimientos válidos
      const hasMovesAvailable = checkBoardForValidMoves(currentBoard, currentBoardSize, currentAvailableIcons);
      
      if (!hasMovesAvailable) {
        console.log(`Fase 3: No hay movimientos válidos disponibles, comprobando condiciones para completar nivel`);
        
        // Si el tablero está relativamente vacío, consideramos el nivel completado
        if (occupationPercentage <= 30) {
          console.log(`Fase 3: Tablero con baja ocupación (${occupationPercentage.toFixed(1)}%) y sin movimientos - Completando nivel`);
          dispatch(setGameStatus('levelCompleted'));
          isSpawningRef.current = false;
          return;
        } else {
          console.log(`Fase 4: No hay movimientos válidos pero el tablero no está lleno (${occupationPercentage.toFixed(1)}%) - Continuando juego`);
        }
      }
      
      console.log(`Fase 4: Buscando celdas vacías para colocar nuevo icono`);
      
      // Encontrar todas las celdas vacías
      const emptyCells: [number, number][] = [];
      for (let row = 0; row < currentBoardSize; row++) {
        for (let col = 0; col < currentBoardSize; col++) {
          if (currentBoard[row][col] === null) {
            emptyCells.push([row, col]);
          }
        }
      }
      
      console.log(`Celdas vacías encontradas: ${emptyCells.length}`);
      
      // Si no hay celdas vacías, no podemos añadir un icono
      if (emptyCells.length === 0) {
        console.log(`Cancelando spawn: no hay celdas vacías`);
        console.log("**********************************************************\n");
        isSpawningRef.current = false;
        return;
      }
      
      // Elegir una celda vacía aleatoria
      const randomIndex = getRandomInt(0, emptyCells.length);
      const [row, col] = emptyCells[randomIndex];
      
      console.log(`Fase 5: Seleccionando celda aleatoria y colocando icono`);
      
      // CAMBIO IMPORTANTE: Solo usar iconos del conjunto disponible para el nivel
      // Esto garantiza que los iconos que aparecen sean consistentes con el nivel
      const availableIconsList = currentAvailableIcons;
      if (!availableIconsList || availableIconsList.length === 0) {
        console.log(`Error: No hay iconos disponibles para el nivel ${currentLevel}`);
        isSpawningRef.current = false;
        return;
      }
      
      // Elegir un icono aleatorio del conjunto disponible
      const randomIconIndex = getRandomInt(0, availableIconsList.length);
      const selectedIcon = availableIconsList[randomIconIndex];
      
      console.log(`Icono elegido: ${selectedIcon} en posición [${row},${col}]`);
      
      // IMPORTANTE: Verificar que el icono elegido esté en la lista de disponibles
      if (!availableIconsList.includes(selectedIcon)) {
        console.log(`Error: El icono ${selectedIcon} no está en la lista de disponibles: ${availableIconsList.join(', ')}`);
        isSpawningRef.current = false;
        return;
      }
      
      // Actualizar el tablero con el nuevo icono
      dispatch(addIcon({ 
        row, 
        col, 
        icon: selectedIcon,
        isPenalty: false
      }));
      
      // Reproducir sonido de nuevo icono
      audioManager.play('newIcon');
      
      // Verificar que se agregó correctamente
      setTimeout(() => {
        const updatedState = store.getState().game;
        const newIconCount = updatedState.iconCount;
        
        if (newIconCount > currentIconCount) {
          console.log(`Fase 7: Icono añadido correctamente. Nuevo contador: ${newIconCount}`);

          // Decrementar el período de gracia si está activo
          if (levelTransitionGraceRef.current > 0) {
            levelTransitionGraceRef.current--;
            console.log(`Período de gracia decrementado: ${levelTransitionGraceRef.current} movimientos restantes`);
          }
        } else {
          console.log(`Advertencia: El contador de iconos no aumentó (${currentIconCount} -> ${newIconCount})`);
        }
        
        // Marcar que ya no estamos añadiendo un icono
        isSpawningRef.current = false;
        console.log(`Fase final: Estado de spawning restablecido`);
        console.log("**********************************************************\n");
      }, 50);
      
    } catch (error) {
      console.error(`Error al añadir icono aleatorio:`, error);
      isSpawningRef.current = false;
    }
  }, [dispatch, addNotification, level]);

  // Detener todos los temporizadores del juego
  const stopTimers = useCallback(() => {
    console.log("\n**********************************************************");
    console.log("INICIO DEL FLUJO: DETENER TEMPORIZADORES");
    console.log(`Estado: ${status}, Temporizadores activos: ${timersActiveRef.current ? 'Sí' : 'No'}`);
    console.log("**********************************************************");
    
    logger.info('Deteniendo todos los temporizadores', ' [' + status + ']');
    
    // Detener intervalo de spawn
    if (timerIntervalRef.current) {
      // Si es un número, es un ID de requestAnimationFrame
      if (typeof timerIntervalRef.current === 'number') {
        cancelAnimationFrame(timerIntervalRef.current);
      } else {
        clearInterval(timerIntervalRef.current);
      }
      timerIntervalRef.current = null;
      console.log("Fase 1: Temporizador de tiempo de juego detenido");
    }
    
    // Detener temporizador de pistas
    if (iconTimerIntervalRef.current) {
      // Si es un número, es un ID de requestAnimationFrame
      if (typeof iconTimerIntervalRef.current === 'number') {
        cancelAnimationFrame(iconTimerIntervalRef.current);
      } else {
        clearInterval(iconTimerIntervalRef.current);
      }
      iconTimerIntervalRef.current = null;
      console.log("Fase 2: Temporizador de spawn de iconos detenido");
    }
    
    // Marcar que los temporizadores están inactivos
    timersActiveRef.current = false;
    console.log("Fase 3: Referencias de temporizadores reiniciadas");
    
    console.log("**********************************************************\n");
    console.log("FIN DEL FLUJO: TEMPORIZADORES DETENIDOS CORRECTAMENTE");
  }, [status]);

  // Iniciar los temporizadores del juego
  const startTimers = useCallback((forceStart = false) => {
    // Obtener el estado más reciente del store para garantizar datos actualizados
    const {
      level: currentLevel,
      spawnRate: currentSpawnRate,
      currentPlayMode: currentMode,
      status: currentStatus,
      timer: currentTimer
    } = store.getState().game;
    
    console.log("\n**********************************************************");
    console.log("INICIO DEL FLUJO: INICIAR TEMPORIZADORES");
    console.log(`Nivel: ${currentLevel}, SpawnRate: ${currentSpawnRate}ms, Modo: ${currentMode}`);
    console.log(`Forzar inicio: ${forceStart ? 'Sí' : 'No'}, Temporizadores activos: ${timersActiveRef.current ? 'Sí' : 'No'}`);
    console.log(`Estado actual del juego: ${currentStatus}`);
    console.log("**********************************************************");
    
    // Verificar si el juego está en estado válido para iniciar temporizadores
    if (currentStatus !== 'playing') {
      logger.debug('GameLogic', `No se inician temporizadores porque el juego no está en estado playing (${currentStatus})`);
      console.log(`Temporizadores no iniciados - Estado inválido: ${currentStatus}`);
      console.log("**********************************************************\n");
      return;
    }
    
    // PROTECCIÓN ADICIONAL: Si hay múltiples llamadas cercanas a startTimers
    // usamos un timestamp para evitar inicializaciones demasiado seguidas
    const currentTime = Date.now();
    const lastStartAttempt = lastStartTimersAttemptRef.current || 0;
    const timeSinceLastAttempt = currentTime - lastStartAttempt;
    
    if (timeSinceLastAttempt < 300 && !forceStart) { // Reducir a 300ms para mayor responsividad
      logger.debug('GameLogic', `Ignorando intento de iniciar temporizadores, último intento hace ${timeSinceLastAttempt}ms`);
      console.log(`PROTECCIÓN: Ignorando inicio de temporizadores, último intento hace ${timeSinceLastAttempt}ms`);
      console.log("**********************************************************\n");
      return;
    }
    
    // Actualizar timestamp del último intento
    lastStartTimersAttemptRef.current = currentTime;
    
    // Si ya hay temporizadores activos, siempre limpiarlos primero para evitar duplicados
    if (timersActiveRef.current) {
      logger.debug('GameLogic', 'Limpiando temporizadores existentes antes de iniciar nuevos');
      console.log("Fase 1: Deteniendo temporizadores existentes para prevenir duplicados");
      stopTimers();
    }
    
    logger.info('GameLogic', `Iniciando temporizadores. SpawnRate: ${currentSpawnRate}ms, Nivel: ${currentLevel}`);
    
    // Marcar que los temporizadores están activos
    timersActiveRef.current = true;
    lastSpawnRateRef.current = currentSpawnRate;
    
    // Reiniciar el tiempo para el incremento de velocidad
    lastSpeedIncreaseTimeRef.current = currentTimer;
    console.log(`Reiniciando contador de incremento de velocidad en tiempo: ${currentTimer}s`);
    
    console.log("Fase 2: Referencias de temporizadores establecidas");
    
    // Temporizador para incrementar el tiempo de juego usando requestAnimationFrame para mejor rendimiento
    let lastTimestamp = performance.now();
    let accumulatedTime = 0;
    
    const gameTimerLoop = (timestamp: number) => {
      // Verificar que el juego siga activo
      const gameStatus = store.getState().game.status;
      if (gameStatus !== 'playing' || !timersActiveRef.current) {
        return;
      }
      
      // Calcular tiempo transcurrido desde el último frame
      const elapsed = timestamp - lastTimestamp;
      lastTimestamp = timestamp;
      
      // Acumular tiempo hasta completar 1 segundo
      accumulatedTime += elapsed;
      if (accumulatedTime >= 1000) {
        // Incrementar el contador de tiempo y reiniciar acumulador
        dispatch(incrementTimer());
        accumulatedTime -= 1000;
        
        // Manejar el incremento de velocidad
        handleSpeedIncrease();
        
        // Manejar el modo contrareloj - decrementar el tiempo restante
        if (currentMode === 'timed') {
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
              console.log("\n");
              console.log("\n**********************************************************");
              console.log("INICIO DEL FLUJO: GAME OVER POR TIEMPO AGOTADO");
              console.log(`Nivel: ${currentLevel}, Modo: ${currentMode}`);
              console.log("**********************************************************");
              console.log("Tiempo agotado en modo contrareloj");
              console.log("**********************************************************\n");
              logger.info('Game', 'Tiempo agotado en modo contrareloj - Game Over');
              console.log("\n");
              return; // Salir del loop cuando el juego termina
            }
          }
        }
        
        // Manejar el modo supervivencia - aumentar velocidad con el tiempo
        if (currentMode === 'survival' && !speedLimitReachedRef.current) {
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
      }
      
      // Continuar el loop
      timerIntervalRef.current = requestAnimationFrame(gameTimerLoop);
    };
    
    // Iniciar el loop del temporizador
    timerIntervalRef.current = requestAnimationFrame(gameTimerLoop);
    console.log("Fase 3: Temporizador de tiempo de juego iniciado");
    
    // Temporizador para añadir iconos aleatorios usando sistema basado en requestAnimationFrame
    let lastIconSpawnTime = performance.now();
    
    const iconSpawnLoop = (timestamp: number) => {
      // Verificar que el juego siga activo
      const gameStatus = store.getState().game.status;
      if (gameStatus !== 'playing' || !timersActiveRef.current) {
        return;
      }
      
      // Obtener velocidad actualizada desde el estado
      const currentGameState = store.getState().game;
      const currentSpawnRate = currentGameState.spawnRate;
      
      // Calcular tiempo transcurrido
      const elapsed = timestamp - lastIconSpawnTime;
      
      // Si es tiempo de generar un nuevo icono
      if (elapsed >= currentSpawnRate) {
        lastIconSpawnTime = timestamp;
        
        // Evitar añadir iconos si ya se está procesando uno
        if (!isSpawningRef.current) {
          // Añadir un icono aleatorio al tablero
          addRandomIcon();
          
          // Log para depuración
          logger.debug('GameLogic', `Intervalo de spawn activado (${currentSpawnRate}ms)`);
        }
      }
      
      // Continuar el loop
      iconTimerIntervalRef.current = requestAnimationFrame(iconSpawnLoop);
    };
    
    // Verificar que la velocidad sea válida
    if (!currentSpawnRate || currentSpawnRate <= 0) {
      logger.error('GameLogic', `Error: velocidad de spawn inválida (${currentSpawnRate}ms)`);
      console.log(`ERROR: Velocidad de spawn inválida (${currentSpawnRate}ms). Usando valor por defecto (2000ms)`);
      // Usar un valor por defecto si la velocidad es inválida
      lastIconSpawnTime = performance.now() - 2000; // Forzar spawn inmediato
    } else {
      // Usar la velocidad correcta del nivel
      console.log(`Configurando temporizador de iconos con velocidad exacta del nivel: ${currentSpawnRate}ms`);
      lastIconSpawnTime = performance.now(); // Iniciar el contador
    }
    
    // Iniciar el loop de spawn de iconos
    iconTimerIntervalRef.current = requestAnimationFrame(iconSpawnLoop);
    console.log("Fase 4: Temporizador de spawn de iconos iniciado (cada " + currentSpawnRate + "ms)");
    
    console.log("**********************************************************");
    console.log("FIN DEL FLUJO: TEMPORIZADORES INICIADOS CORRECTAMENTE");
    console.log("\n");
    return () => {
      // Limpiar temporizadores al desmontar
      stopTimers();
    };
  }, [dispatch, stopTimers, addRandomIcon]);


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
    // Solo actualizar si el juego está en curso y los temporizadores están activos
    if (status === 'playing' && timersActiveRef.current && 
        (lastSpawnRateRef.current === null || lastSpawnRateRef.current !== spawnRate)) {
      
      // Actualizar la referencia a la última tasa de spawn
      lastSpawnRateRef.current = spawnRate;
      
      console.log(`\n**********************************************************`);
      console.log(`ACTUALIZACIÓN DE VELOCIDAD: ${spawnRate}ms`);
      console.log(`**********************************************************`);
      
      // Si hay un temporizador de iconos activo, limpiarlo y crear uno nuevo
      if (iconTimerIntervalRef.current) {
        // Usar el método correcto según el tipo de temporizador
        if (typeof iconTimerIntervalRef.current === 'number') {
          cancelAnimationFrame(iconTimerIntervalRef.current);
        } else {
          clearInterval(iconTimerIntervalRef.current);
        }
        iconTimerIntervalRef.current = null;
        
        // Forzar un reinicio completo de los temporizadores para aplicar la nueva velocidad
        console.log(`Reiniciando temporizadores con nueva velocidad: ${spawnRate}ms`);
        startTimers(true);
      }
    }
  }, [spawnRate, status, startTimers]);

  // Efecto para detección de tablero lleno o sin movimientos válidos
  useEffect(() => {
    // Solo comprobar cuando el juego está activo y hay iconos en el tablero
    if (status !== 'playing' || !board || board.length === 0 || iconCount === 0) {
      return;
    }

    // Si estamos en período de gracia, no hacer game over
    if (levelTransitionGraceRef.current > 0) {
      console.log(`Período de gracia activo: ${levelTransitionGraceRef.current} movimientos restantes`);
      return;
    }

    // Evitar múltiples evaluaciones por ciclo
    const timeoutId = setTimeout(() => {
      // Si está cambiando de nivel, no evaluar
      if (store.getState().game.status !== 'playing') {
        return;
      }

      // Verificar si hay movimientos válidos en el tablero
      const hasMovesAvailable = hasValidMoves();

      if (!hasMovesAvailable) {
        // Optimización: usar Set para contar iconos únicos
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
        
        // Obtener el modo de juego actual
        const { currentPlayMode } = store.getState().game;
        const totalCells = boardSize * boardSize;
        const occupationPercentage = (iconCount / totalCells) * 100;
        
        logger.info('Game', `Evaluación de fin de nivel: Modo ${currentPlayMode}, ${iconCount} iconos (${occupationPercentage.toFixed(1)}%), ${uniqueIcons.size} tipos diferentes`);
        
        // Evitar detección rápida en modo supervivencia
        if (currentPlayMode === 'survival') {
          logger.info('Game', `En modo supervivencia no se completa el nivel automáticamente con la detección rápida`);
          // Sólo completar nivel en supervivencia si el tablero está completamente vacío
          if (iconCount === 0) {
            dispatch(setGameStatus('levelCompleted'));
          }
          return;
        }
        
        // Verificación super rápida para casos especiales (2 o menos iconos diferentes)
        if (iconCount <= 2 && uniqueIcons.size === iconCount) {
          logger.info('Game', `⚡ Detección rápida: ${iconCount} iconos diferentes sin convergencia posible. Nivel completado.`);
          
          // Establecer el motivo del nivel completado
          dispatch(setGameEndReason(`¡Has eliminado casi todos los iconos! Solo quedan ${iconCount} iconos sin posibilidad de convergencia.`));
          dispatch(setGameStatus('levelCompleted'));
          return true;
        }
        
        // Para otros casos, calcular porcentaje de ocupación
        if (occupationPercentage <= 10) {
          logger.info('Game', `⚡ Detección rápida: Pocos iconos (${occupationPercentage.toFixed(1)}%) sin movimientos válidos. Nivel completado.`);
          
          // Establecer el motivo del nivel completado
          dispatch(setGameEndReason(`¡Has despejado gran parte del tablero! Solo queda un ${occupationPercentage.toFixed(1)}% de ocupación sin movimientos válidos.`));
          dispatch(setGameStatus('levelCompleted'));
          return true;
        } else {
          logger.info('Game', `⚡ Detección rápida: No hay movimientos válidos (${occupationPercentage.toFixed(1)}%). Game over.`);
          
          // Establecer el motivo del game over
          const spawnRateSeconds = (store.getState().game.spawnRate / 1000).toFixed(1);
          const difficultyName = store.getState().game.currentDifficulty;
          const modeName = store.getState().game.currentPlayMode;
          dispatch(setGameEndReason(`No hay movimientos válidos disponibles con ${occupationPercentage.toFixed(1)}% de ocupación del tablero. Modo: ${modeName}, Dificultad: ${difficultyName}, Velocidad: ${spawnRateSeconds}s/icono.`));
          dispatch(setGameStatus('gameOver'));
          return true;
        }
      }
    }, 100); // Usar un pequeño retraso para permitir que otras operaciones se completen
    
    return () => clearTimeout(timeoutId);
  }, [board, status, boardSize, hasValidMoves, dispatch, iconCount]);

  // Cambiar configuración del juego
  const changeGameConfig = useCallback((difficulty: GameDifficulty, mode: GamePlayMode) => {
    // Registrar el cambio de configuración
    console.log("\n**********************************************************");
    console.log("INICIO DEL FLUJO: CAMBIO DE CONFIGURACIÓN DEL JUEGO");
    console.log(`Cambiando a dificultad: ${difficulty}, modo: ${mode}`);
    console.log("**********************************************************");
    
    // Detener temporizadores para evitar conflictos durante el cambio
    stopTimers();
    
    // Limpiar estado y referencias para evitar inconsistencias
    isInitializedRef.current = false;
    
    // Actualizar el estado de Redux con la nueva configuración
    dispatch(setGameMode(difficulty));
    dispatch(setPlayMode(mode));
    
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
      const difficultyConfig = config.getDifficultyConfig(difficulty as GameMode);
      if (difficultyConfig) {
        console.log(`Aplicando configuración de dificultad ${difficulty}:`);
        console.log(`- SpawnRate: ${difficultyConfig.spawnRate}ms`);
        console.log(`- Íconos iniciales: ${difficultyConfig.initialIconCount}`);
        console.log(`- Penalización: ${difficultyConfig.penaltyIcons} íconos`);
        
        // Aplicar velocidad de spawn según la dificultad
        dispatch(setSpawnRate(difficultyConfig.spawnRate));
      }
      
      // Obtener la configuración completa combinada
      const gameConfig = config.getGameConfig(difficulty, mode);
      
      // Configurar objetivos específicos según el modo
      if (mode === 'classic') {
        // Configurar objetivos de puntuación y ocupación para el modo clásico
        const scoreTarget = Math.round(gameConfig.initialScoreTarget * 
                        Math.pow(gameConfig.scoreTargetMultiplier || 1.5, currentLevel - 1));
        
        // Ajustar los objetivos según la dificultad
        const difficultyMod = config.LEVEL_REQUIREMENT_MULTIPLIERS[difficulty as GameMode] || 
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
      } else if (mode === 'timed') {
        // Configuración específica para modo contrarreloj
        let timeLimit = gameConfig.initialTimeLimit - 
                       (currentLevel - 1) * (gameConfig.timeDecreasePerLevel || 10);
                       
        // Ajustar tiempo según dificultad
        const difficultyMod = config.LEVEL_REQUIREMENT_MULTIPLIERS[difficulty as GameMode] || 
                             config.LEVEL_REQUIREMENT_MULTIPLIERS.normal;
        
        timeLimit = Math.round(timeLimit * difficultyMod.timeRequirement);
        
        console.log(`Configurando tiempo límite para nivel ${currentLevel}: ${timeLimit} segundos`);
        dispatch(setLevelTimeLimit(Math.max(30, timeLimit)));
      }
      
      // Configurar ventana de tiempo para los combos según la dificultad
      const comboTimeWindow = config.COMBO_SYSTEM.TIME_WINDOWS[difficulty as GameMode] || 
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
    
  }, [dispatch, stopTimers, initializeBoard, startTimers]);

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
    lastSpeedIncreaseTimeRef.current = 0;
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

  // Añadir una nueva función para manejar el incremento automático de velocidad
  const handleSpeedIncrease = useCallback(() => {
    // Obtener estado actual del juego
    const gameState = store.getState().game;
    const { 
      currentPlayMode, 
      currentDifficulty, 
      spawnRate, 
      timer, 
      status 
    } = gameState;
    
    // Solo aplicar en estado playing
    if (status !== 'playing') {
      return;
    }
    
    // Obtener configuración de dificultad actual
    const difficultyConfig = config.DIFFICULTY_CONFIG[currentDifficulty as GameMode];
    
    // Si no hay configuración, no hacer nada
    if (!difficultyConfig) {
      return;
    }
    
    // Calcular si es momento de incrementar la velocidad
    const currentTime = timer;
    const speedIncreaseInterval = difficultyConfig.speedIncreaseInterval;
    
    // Verificar si pasó suficiente tiempo desde el último incremento
    if (currentTime - lastSpeedIncreaseTimeRef.current >= speedIncreaseInterval) {
      // Calcular nueva velocidad
      const speedIncreaseAmount = difficultyConfig.speedIncreaseAmount;
      const minSpawnRate = difficultyConfig.minSpawnRate;
      
      // Reducir el spawn rate (más rápido) pero no menor que el mínimo
      const newSpawnRate = Math.max(minSpawnRate, spawnRate - speedIncreaseAmount);
      
      // Si hay un cambio en la velocidad, actualizarlo
      if (newSpawnRate < spawnRate) {
        logger.info('GameLogic', `Incremento automático de velocidad: ${spawnRate}ms → ${newSpawnRate}ms`);
        
        // Aplicar nueva velocidad
        dispatch(setSpawnRate(newSpawnRate));
        
        // Mostrar notificación al jugador con información más clara
        if (addNotification) {
          const speedLabel = currentPlayMode === 'survival' ? 'Supervivencia+' : `Nivel ${level}`;
          addNotification({
            message: `¡Velocidad aumentada! ${speedLabel}: ${(newSpawnRate/1000).toFixed(1)}s`,
            type: 'warning',
            duration: 2500
          });
          
          // Reproducir sonido para indicar el aumento de velocidad
          audioManager.play('speedUp');
        }
        
        // Actualizar el tiempo del último incremento
        lastSpeedIncreaseTimeRef.current = currentTime;
        
        // Log para debugging
        console.log(`[VELOCIDAD] Incrementada de ${spawnRate}ms a ${newSpawnRate}ms (${(100 - (newSpawnRate/spawnRate)*100).toFixed(1)}% más rápido)`);
      }
    }
  }, [dispatch, addNotification, level]);
  
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
    handleSpeedIncrease, // Exportamos la función por si se quiere usar manualmente
  };
};

export default useGameLogic;