/**
 * iconSpawner.ts
 * 
 * Este módulo contiene la lógica para añadir iconos aleatorios al tablero
 * de forma controlada, respetando las reglas del juego y las restricciones
 * de velocidad.
 */

import { useCallback, useRef, MutableRefObject, useEffect } from 'react';
import { store } from '../store';
import { 
  addIcon, 
  updateBoard, 
  setGameStatus, 
  setGameEndReason,
  setIconCount
} from '../store/slices/gameSlice';
import { audioManager } from './audioManager';
import logger from './logger';
import { 
  getCurrentTimestamp, 
  getLogTimestamp,
  formatTimeDifference 
} from './timestamp';
import { checkGameEndCondition } from './gameEndConditions';
import { checkBoardForValidMoves } from './gameUtils';

// Tipos e interfaces para el sistema de spawn de iconos
export interface IconSpawnerConfig {
  minIntervalPercentage: number;  // Porcentaje mínimo del spawnRate que debe pasar entre iconos (ej: 0.95)
  minAbsoluteInterval: number;    // Intervalo mínimo absoluto en ms (ej: 500)
  maxSpawningTimeout: number;     // Tiempo máximo que puede estar activo el estado isSpawning (ms)
  maxIcons: number;
  maxAttempts: number;
  maxIconsPerRow: number;
  maxIconsPerColumn: number;
  maxConsecutiveIcons: number;
}

export interface IconSpawnerHookResult {
  addRandomIcon: () => void;
  isSpawningRef: MutableRefObject<boolean>;
  lastIconAddedTimeRef: MutableRefObject<number>;
  resetSpawningState: () => void;
}

// Configuración por defecto
export const DEFAULT_CONFIG: IconSpawnerConfig = {
  minIntervalPercentage: 0.25,    // 25% del intervalo configurado para permitir más variación
  minAbsoluteInterval: 25,        // 25ms mínimo absoluto para permitir velocidades muy altas
  maxSpawningTimeout: 250,        // 250ms máximo para el proceso de spawn
  maxIcons: 100,
  maxAttempts: 10,
  maxIconsPerRow: 3,
  maxIconsPerColumn: 3,
  maxConsecutiveIcons: 2,
};

/**
 * Hook que proporciona la funcionalidad para añadir iconos al tablero
 * 
 * @param hasValidMoves Función que verifica si hay movimientos válidos en el tablero
 * @param config Configuración personalizada (opcional)
 * @returns Objeto con funciones y referencias para controlar el spawn de iconos
 */
export const useIconSpawner = (
  hasValidMoves: () => boolean,
  addNotification?: (notification: any) => void,
  config: IconSpawnerConfig = DEFAULT_CONFIG
): IconSpawnerHookResult => {
  // Referencias para controlar el estado de la aparición de iconos
  const isSpawningRef = useRef<boolean>(false);
  const lastIconAddedTimeRef = useRef<number>(0);
  const spawningTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Función para resetear el estado de spawning
  const resetSpawningState = useCallback(() => {
    isSpawningRef.current = false;
    lastIconAddedTimeRef.current = 0;
    
    // Limpiar cualquier timeout pendiente
    if (spawningTimeoutRef.current) {
      clearTimeout(spawningTimeoutRef.current);
      spawningTimeoutRef.current = null;
    }
    
    logger.debug('IconSpawner', 'Estado de spawning reiniciado');
  }, []);
  
  // Función para establecer un timeout de seguridad para resetear isSpawning
  const setSpawningTimeout = useCallback(() => {
    // Limpiar timeout existente si hay uno
    if (spawningTimeoutRef.current) {
      clearTimeout(spawningTimeoutRef.current);
    }
    
    // Establecer nuevo timeout
    spawningTimeoutRef.current = setTimeout(() => {
      if (isSpawningRef.current) {
        logger.warn('IconSpawner', `Forzando reinicio de isSpawning después de ${config.maxSpawningTimeout}ms para prevenir bloqueo`);
        isSpawningRef.current = false;
        spawningTimeoutRef.current = null;
      }
    }, config.maxSpawningTimeout);
  }, [config.maxSpawningTimeout]);
  
  /**
   * Añade un icono aleatorio al tablero
   */
  const addRandomIcon = useCallback(() => {
    // Obtener timestamp actual para todos los logs y cálculos
    const now = Date.now();
    const timeFormatted = new Date(now).toLocaleTimeString('es-ES', { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3
    });

    console.log("\n**********************************************************");
    console.log(`[${timeFormatted}] INICIO DEL FLUJO: AÑADIR ICONO ALEATORIO`);
    
    // Obtener el estado actual del juego
    const gameState = store.getState().game;
    const { board: currentBoard, boardSize: currentBoardSize, availableIcons: currentAvailableIcons, level, currentPlayMode } = gameState;
    
    console.log(`[${timeFormatted}] Nivel: ${level}, Modo: ${currentPlayMode}`);
    console.log(`[${timeFormatted}] Contador de iconos actual: ${countIcons(currentBoard)}`);
    console.log(`[${timeFormatted}] Iconos disponibles: ${currentAvailableIcons.join(', ')}`);
    console.log(`[${timeFormatted}] Velocidad configurada: ${gameState.spawnRate}ms`);
    console.log("**********************************************************");

    // Fase 1: Marcar estado de spawning como activo
    console.log(`[${timeFormatted}] Fase 1: Marcando estado de spawning como activo`);
    isSpawningRef.current = true;
    setSpawningTimeout();

    // Fase 2: Verificar estado del juego y tablero
    if (gameState.status !== 'playing' || !currentBoard || !currentAvailableIcons.length) {
      console.log("Fase 2: Estado o tablero inválidos - Cancelando spawn");
      isSpawningRef.current = false;
      return;
    }
    console.log("Fase 2: Estado y tablero verificados (válidos)");

    // Verificar si hay movimientos válidos
    const hasMovesAvailable = hasValidMoves();
    console.log(`[${timeFormatted}] Verificación de movimientos válidos: ${hasMovesAvailable ? 'SÍ' : 'NO'}`);

    // Si NO hay movimientos disponibles, verificar fin de juego
    if (!hasMovesAvailable) {
      console.log(`[${timeFormatted}] No hay movimientos válidos disponibles`);
      const shouldContinue = checkGameEndCondition(currentBoard, currentBoardSize, currentAvailableIcons);
      if (!shouldContinue) {
        console.log(`[${timeFormatted}] El juego ha terminado según checkGameEndCondition`);
        isSpawningRef.current = false;
        return;
      }
    }

    // Buscar celdas vacías
    console.log(`[${timeFormatted}] Fase 4: Buscando celdas vacías para colocar nuevo icono`);
    const emptyCells = findEmptyCells(currentBoard);
    console.log(`Celdas vacías encontradas: ${emptyCells.length}`);

    // Si no hay celdas vacías, el tablero está lleno
    if (emptyCells.length === 0) {
      console.log("Fase 5: No hay celdas vacías disponibles - Tablero lleno");
      console.log("Fase 6: Tablero completamente lleno - Game Over");
      // Establecer el motivo del game over
      const spawnRateSeconds = (store.getState().game.spawnRate / 1000).toFixed(1);
      const difficultyName = store.getState().game.currentDifficulty;
      store.dispatch(setGameEndReason(`El tablero está completamente lleno. No hay espacio para más iconos. Dificultad: ${difficultyName}, Velocidad: ${spawnRateSeconds}s/icono.`));
      store.dispatch(setGameStatus('gameOver'));
      console.log("**********************************************************\n");
      isSpawningRef.current = false;
      return;
    }

    // Colocar un nuevo icono en una celda vacía aleatoria
    console.log("Fase 5: Seleccionando celda aleatoria y colocando icono");
    const randomIndex = Math.floor(Math.random() * emptyCells.length);
    const { row, col } = emptyCells[randomIndex];
    const randomIcon = currentAvailableIcons[Math.floor(Math.random() * currentAvailableIcons.length)];

    // Crear una copia del tablero actual y actualizar
    const newBoard = currentBoard.map(row => [...row]);
    newBoard[row][col] = randomIcon;
    store.dispatch(updateBoard(newBoard));

    // Actualizar el contador de iconos
    const newIconCount = countIcons(newBoard);
    console.log(`Icono ${randomIcon} colocado en [${row},${col}]. Total de iconos: ${newIconCount}`);
    console.log("**********************************************************\n");

    // Marcar que el spawning ha terminado
    isSpawningRef.current = false;
    lastIconAddedTimeRef.current = now;

  }, [hasValidMoves, setSpawningTimeout, addNotification, config.maxSpawningTimeout]);
  
  // Cleanup al desmontar el componente
  useEffect(() => {
    return () => {
      // Limpiar timeout al desmontar
      if (spawningTimeoutRef.current) {
        clearTimeout(spawningTimeoutRef.current);
      }
    };
  }, []);

  return {
    addRandomIcon,
    isSpawningRef,
    lastIconAddedTimeRef,
    resetSpawningState
  };
};

// Función auxiliar para contar iconos en el tablero
const countIcons = (board: (string | null)[][]): number => {
  let count = 0;
  for (let row = 0; row < board.length; row++) {
    for (let col = 0; col < board[row].length; col++) {
      if (board[row][col] !== null) {
        count++;
      }
    }
  }
  return count;
};

// Función auxiliar para encontrar celdas vacías
const findEmptyCells = (board: (string | null)[][]): { row: number, col: number }[] => {
  const emptyCells: { row: number, col: number }[] = [];
  for (let row = 0; row < board.length; row++) {
    for (let col = 0; col < board[row].length; col++) {
      if (board[row][col] === null) {
        emptyCells.push({ row, col });
      }
    }
  }
  return emptyCells;
}; 