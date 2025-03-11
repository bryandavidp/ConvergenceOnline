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
  setGameEndReason 
} from '../store/slices/gameSlice';
import { audioManager } from './audioManager';
import logger from './logger';
import { 
  getCurrentTimestamp, 
  getLogTimestamp,
  formatTimeDifference 
} from './timestamp';
import { decrementLevelTransitionGrace } from './gameEndConditions';

// Tipos e interfaces para el sistema de spawn de iconos
export interface IconSpawnerConfig {
  minIntervalPercentage: number;  // Porcentaje mínimo del spawnRate que debe pasar entre iconos (ej: 0.95)
  minAbsoluteInterval: number;    // Intervalo mínimo absoluto en ms (ej: 500)
  maxSpawningTimeout: number;     // Tiempo máximo que puede estar activo el estado isSpawning (ms)
}

export interface IconSpawnerHookResult {
  addRandomIcon: () => void;
  isSpawningRef: MutableRefObject<boolean>;
  lastIconAddedTimeRef: MutableRefObject<number>;
  resetSpawningState: () => void;
}

// Configuración por defecto
const DEFAULT_CONFIG: IconSpawnerConfig = {
  minIntervalPercentage: 0.95,
  minAbsoluteInterval: 500,
  maxSpawningTimeout: 5000  // 5 segundos máximo para el proceso de spawn
};

/**
 * Hook que proporciona la funcionalidad para añadir iconos al tablero
 * 
 * @param levelTransitionGraceRef Referencia al período de gracia después de un cambio de nivel
 * @param hasValidMoves Función que verifica si hay movimientos válidos en el tablero
 * @param config Configuración personalizada (opcional)
 * @returns Objeto con funciones y referencias para controlar el spawn de iconos
 */
export const useIconSpawner = (
  levelTransitionGraceRef: MutableRefObject<number>,
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
    const currentTime = getCurrentTimestamp();
    const timeFormatted = getLogTimestamp();
    
    // Obtenemos el estado actual directamente del store para asegurar valores actualizados
    const gameState = store.getState().game;
    console.log(`\n[${timeFormatted}] **********************************************************`);
    console.log(`[${timeFormatted}] INICIO DEL FLUJO: AÑADIR ICONO ALEATORIO`);
    console.log(`[${timeFormatted}] Nivel: ${gameState.level}, Modo: ${gameState.currentPlayMode}`);
    console.log(`[${timeFormatted}] Contador de iconos actual: ${gameState.iconCount}`);
    console.log(`[${timeFormatted}] Iconos disponibles: ${gameState.availableIcons.join(', ')}`);
    console.log(`[${timeFormatted}] Velocidad configurada: ${gameState.spawnRate}ms`);
    console.log(`[${timeFormatted}] **********************************************************`);
    
    // Si ya estamos en proceso de añadir un icono, evitar la recursión
    if (isSpawningRef.current) {
      console.log(`[${timeFormatted}] Saltando spawn porque ya hay uno en proceso...`);
      
      // Verificar cuánto tiempo ha estado activo el estado y resetearlo si es demasiado
      const gameState = store.getState().game;
      const lastSpawnTime = lastIconAddedTimeRef.current || 0;
      const timeSinceLastSpawn = currentTime - lastSpawnTime;
      
      // Si ha pasado demasiado tiempo desde el último spawn y seguimos en isSpawning=true,
      // probablemente está bloqueado. Resetearlo automáticamente.
      if (timeSinceLastSpawn > config.maxSpawningTimeout) {
        console.log(`[${timeFormatted}] PROTECCIÓN: Reseteando estado de spawn bloqueado después de ${Math.round(timeSinceLastSpawn)}ms`);
        isSpawningRef.current = false;
        
        // Intentar nuevamente el spawn después del reset
        setTimeout(() => {
          addRandomIcon();
        }, 100);
      }
      
      return;
    }
    
    // Control de velocidad para prevenir que los iconos aparezcan demasiado rápido
    const lastAddTime = lastIconAddedTimeRef.current || 0;
    const timeSinceLastAdd = currentTime - lastAddTime;
    
    // Usar exactamente la tasa de spawn configurada como intervalo mínimo
    const configuredSpawnRate = gameState.spawnRate;
    
    // Como medida de seguridad, asegurar un valor mínimo razonable
    const minimumInterval = Math.max(
      config.minAbsoluteInterval, 
      configuredSpawnRate * config.minIntervalPercentage
    );
    
    if (timeSinceLastAdd < minimumInterval) {
      console.log(`[${timeFormatted}] PROTECCIÓN DE VELOCIDAD: Iconos demasiado rápidos`);
      console.log(`[${timeFormatted}] - Último spawn: hace ${formatTimeDifference(currentTime, lastAddTime)}`);
      console.log(`[${timeFormatted}] - Tiempo mínimo requerido: ${minimumInterval}ms`);
      console.log(`[${timeFormatted}] - Velocidad configurada: ${configuredSpawnRate}ms`);
      console.log(`[${timeFormatted}] **********************************************************`);
      return;
    }
    
    isSpawningRef.current = true;
    // Configurar el timeout de seguridad
    setSpawningTimeout();
    
    console.log(`[${timeFormatted}] Fase 1: Marcando estado de spawning como activo`);
    
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
        console.log(`[${timeFormatted}] Cancelando spawn: estado=${gameStatus} no es 'playing'`);
        console.log(`[${timeFormatted}] **********************************************************`);
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
      
      // Calcular el tamaño total del tablero y la ocupación actual
      const totalCells = currentBoardSize * currentBoardSize;
      const occupationPercentage = (currentIconCount / totalCells) * 100;
      
      // Comprobar si el tablero está lleno
      const isBoardFull = currentIconCount >= totalCells;
      
      // Si estamos en el período de gracia después de un cambio de nivel,
      // no verificar condiciones de finalización para evitar game over prematuro
      if (levelTransitionGraceRef.current > 0) {
        levelTransitionGraceRef.current--;
        console.log(`Fase 3: En período de gracia (${levelTransitionGraceRef.current} restantes), omitiendo verificaciones de fin de juego`);
      } else {
        // LÓGICA PARA GAME OVER: 
        // Solo si el tablero está COMPLETAMENTE LLENO
        if (isBoardFull) {
          console.log(`Fase 3: Tablero 100% lleno (${currentIconCount}/${totalCells}) - Game Over`);
          // Establecer el motivo del game over
          const spawnRateSeconds = (store.getState().game.spawnRate / 1000).toFixed(1);
          const difficultyName = store.getState().game.currentDifficulty;
          store.dispatch(setGameEndReason(`El tablero está completamente lleno. No hay espacio para más iconos. Dificultad: ${difficultyName}, Velocidad: ${spawnRateSeconds}s/icono.`));
          store.dispatch(setGameStatus('gameOver'));
          console.log("**********************************************************\n");
          isSpawningRef.current = false;
          return;
        }
        
        // LÓGICA PARA COMPLETAR NIVEL:
        // Si no hay movimientos válidos Y (hay pocos iconos O solo quedan 2)
        const movesAvailable = hasValidMoves();
        if (!movesAvailable) {
          console.log("Fase 3: No hay movimientos válidos disponibles, comprobando condiciones para completar nivel");
          
          // Verificar si hay 2 o menos iconos en el tablero
          if (currentIconCount <= 2) {
            console.log("Fase 4: Solo quedan 2 o menos iconos sin movimientos válidos - Nivel completado");
            logger.info('Game', `Solo quedan ${currentIconCount} iconos sin movimientos válidos. Nivel completado.`);
            // Establecer el motivo del nivel completado
            store.dispatch(setGameEndReason(`¡Has eliminado casi todos los iconos! Solo quedan ${currentIconCount} iconos sin posibilidad de convergencia.`));
            store.dispatch(setGameStatus('levelCompleted'));
            console.log("**********************************************************\n");
            isSpawningRef.current = false;
            return; // Importante: prevenir la aparición del nuevo icono
          }
          // Si hay pocos iconos (menos del 5% del tablero ocupado), pasar al siguiente nivel
          else if (occupationPercentage <= 5) {
            console.log(`Fase 4: Pocos iconos sin movimientos válidos (${occupationPercentage.toFixed(1)}%) - Nivel completado`);
            logger.info('Game', `Tablero con pocos iconos sin movimientos válidos (${occupationPercentage.toFixed(1)}%). Nivel completado.`);
            // Establecer el motivo del nivel completado
            store.dispatch(setGameEndReason(`¡Has despejado gran parte del tablero! Solo queda un ${occupationPercentage.toFixed(1)}% de ocupación sin movimientos válidos.`));
            store.dispatch(setGameStatus('levelCompleted'));
            console.log("**********************************************************\n");
            isSpawningRef.current = false;
            return; // Prevenir la aparición del nuevo icono
          }
          // Si no se cumplen las condiciones para completar nivel, 
          // continuar jugando (el jugador deberá esperar a que se llene el tablero)
          else {
            console.log(`Fase 4: No hay movimientos válidos pero el tablero no está lleno (${occupationPercentage.toFixed(1)}%) - Continuando juego`);
          }
        }
      }
      
      // Si llegamos aquí, buscamos celdas vacías para colocar un nuevo icono
      console.log("Fase 4: Buscando celdas vacías para colocar nuevo icono");
      const emptyCells: {row: number, col: number}[] = [];
      
      // Simplificar la búsqueda de celdas vacías - buscar todas las celdas vacías
      for (let row = 0; row < currentBoardSize; row++) {
        for (let col = 0; col < currentBoardSize; col++) {
          if (currentBoard[row][col] === null) {
            emptyCells.push({ row, col });
          }
        }
      }
      
      console.log(`Celdas vacías encontradas: ${emptyCells.length}`);
      
      // Si no hay celdas vacías, el tablero está lleno
      if (emptyCells.length === 0) {
        console.log("Fase 5: No hay celdas vacías disponibles - Tablero lleno");
        
        // Si estamos en período de gracia, no verificar condiciones de finalización
        if (levelTransitionGraceRef.current > 0) {
          console.log("En período de gracia, omitiendo verificación de Game Over por tablero lleno");
        } else {
          // GAME OVER si el tablero está lleno
          console.log("Fase 6: Tablero completamente lleno - Game Over");
          // Establecer el motivo del game over
          const spawnRateSeconds = (store.getState().game.spawnRate / 1000).toFixed(1);
          const difficultyName = store.getState().game.currentDifficulty;
          store.dispatch(setGameEndReason(`El tablero está completamente lleno. No hay espacio para más iconos. Dificultad: ${difficultyName}, Velocidad: ${spawnRateSeconds}s/icono.`));
          store.dispatch(setGameStatus('gameOver'));
        }
        
        console.log("**********************************************************\n");
        isSpawningRef.current = false;
        return;
      }
      
      // Colocar un nuevo icono en una celda vacía aleatoria
      console.log("Fase 5: Seleccionando celda aleatoria y colocando icono");
      const randomIndex = Math.floor(Math.random() * emptyCells.length);
      const { row, col } = emptyCells[randomIndex];
      
      // Usar los iconos disponibles actuales del estado global en lugar de la variable del ámbito
      const randomIcon = currentAvailableIcons[Math.floor(Math.random() * currentAvailableIcons.length)];
      console.log(`Icono elegido: ${randomIcon} en posición [${row},${col}]`);
      
      // Usar el método addIcon para añadir un icono individual sin afectar al resto del tablero
      store.dispatch(addIcon({
        row,
        col,
        icon: randomIcon,
        isPenalty: false
      }));
      
      // Como respaldo, también actualizamos el tablero completo si es necesario
      const updatedBoard = currentBoard.map(r => [...r]);
      if (updatedBoard[row][col] === null) {
        updatedBoard[row][col] = randomIcon;
        // Solo enviamos updateBoard si realmente necesitamos actualizar
        if (JSON.stringify(updatedBoard) !== JSON.stringify(currentBoard)) {
          store.dispatch(updateBoard(updatedBoard));
        }
      }
      
      // Reproducir sonido de nuevo icono
      audioManager.play('newIcon');
      
      // Verificar que se agregó correctamente
      const updatedState = store.getState().game;
      const newIconCount = updatedState.iconCount;
      
      if (newIconCount > currentIconCount) {
        // Decrementar el período de gracia si está activo
        if (levelTransitionGraceRef.current > 0) {
          levelTransitionGraceRef.current--;
          logger.info('Game', `PERÍODO DE GRACIA: Decrementado a ${levelTransitionGraceRef.current} iconos restantes`);
        }
        // También llamar a la función externa por si se está usando en otra parte del código
        decrementLevelTransitionGrace();
      } else {
        console.log(`[${timeFormatted}] Advertencia: El contador de iconos no aumentó (${currentIconCount} -> ${newIconCount})`);
      }
      
      // Registrar el éxito de la operación
      logger.debug('Game', `Icono aleatorio añadido exitosamente en [${row},${col}]: ${randomIcon}`);
      console.log(`Fase 7: Icono añadido correctamente. Nuevo contador: ${store.getState().game.iconCount}`);
      console.log(`[${timeFormatted}] - Tiempo desde último spawn: ${formatTimeDifference(currentTime, lastAddTime)}`);
      console.log(`[${timeFormatted}] Fase final: Estado de spawning restablecido`);
      console.log(`[${timeFormatted}] **********************************************************`);
    } catch (error) {
      console.error(`[${timeFormatted}] Error al añadir icono aleatorio:`, error);
    } finally {
      // CORRECCIÓN: Asegurarse de que isSpawningRef siempre se restablece al finalizar
      isSpawningRef.current = false;
      
      // Limpiar el timeout de seguridad
      if (spawningTimeoutRef.current) {
        clearTimeout(spawningTimeoutRef.current);
        spawningTimeoutRef.current = null;
      }
    }
  }, [hasValidMoves, levelTransitionGraceRef, config, setSpawningTimeout]);
  
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