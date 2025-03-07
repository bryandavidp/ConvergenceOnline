import { useCallback, useRef, useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../../../store';
import { store } from '../../../../store';
import { 
  setHighlightedCells, 
  useHint, 
  resetHintCooldown, 
  incrementScore,
  setSpawnRate,
  setGameStatus,
  updateBoard,
  setIconCount,
  addIcon
} from '../../../../store/slices/gameSlice';
import { findConvergences } from '../utils/convergenceUtils';
import { findHintPosition, getHighlightedCells, canUseHint, findConvergingIcons as findConvergingIconsUtil } from '../utils/hintUtils';
import { audioManager } from '../../../../utils/audioManager';
import logger from '../../../../utils/logger';
import * as config from '../../../../utils/config';
import * as levelAdapter from '../../../../utils/levelAdapter';
import * as gameUtils from '../../../../utils/gameUtils';
import { useNotifications } from '../../GameNotifications/GameNotificationManager';
import { animateCellError, animateBoardShake, increaseSpeedAsPenalty } from './helpers/errorHandler';
import { addPenaltyIcons } from './helpers/penaltyManager';

/**
 * Hook para gestionar la interacción con el tablero
 */
const useBoardInteraction = () => {
  const dispatch = useDispatch();
  const { 
    board, 
    status, 
    boardSize, 
    availableIcons,
    highlightedCells,
    hintsRemaining,
    hintCooldown,
    score,
    spawnRate,
    iconCount
  } = useSelector((state: RootState) => state.game);
  
  const { addNotification } = useNotifications();
  
  // Referencias para las celdas del tablero (DOM)
  const cellRefs = useRef<Record<string, HTMLElement>>({});
  
  // Referencias para los temporizadores
  const spawnIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const hintTimerRef = useRef<NodeJS.Timeout | null>(null);
  const animationTimers = useRef<NodeJS.Timeout[]>([]);
  
  // Estado para controlar alertas visuales
  const [showSpeedAlert, setShowSpeedAlert] = useState(false);
  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  const [showPenaltyAlert, setShowPenaltyAlert] = useState(false);
  
  // Referencia para controlar el debounce de clics
  const isProcessingClickRef = useRef(false);
  const lastClickedCellRef = useRef<string | null>(null);
  
  /**
   * Detener todos los temporizadores
   */
  const stopTimers = useCallback(() => {
    logger.info('Deteniendo todos los temporizadores', ' [' + status + ']');
    
    // Detener intervalo de spawn
    if (spawnIntervalRef.current) {
      clearInterval(spawnIntervalRef.current);
      spawnIntervalRef.current = null;
    }
    
    // Detener temporizador de pistas
    if (hintTimerRef.current) {
      clearTimeout(hintTimerRef.current);
      hintTimerRef.current = null;
    }
    
    // Detener temporizadores de animación
    animationTimers.current.forEach(timer => clearTimeout(timer));
    animationTimers.current = [];
    
    // Limpiar alertas visuales
    setShowPenaltyAlert(false);
    setShowSpeedAlert(false);
  }, []);
  
  /**
   * Registrar un temporizador de animación para limpieza
   */
  const addAnimationTimer = useCallback((timer: NodeJS.Timeout) => {
    animationTimers.current.push(timer);
  }, []);
  
  /**
   * Obtener el elemento DOM para una celda específica
   */
  const getCellElement = useCallback((row: number, col: number): HTMLElement | null => {
    return cellRefs.current[`${row}-${col}`] || null;
  }, []);
  
  /**
   * Mostrar animación de puntos flotantes ganados sobre una celda
   */
  const showPointsEarned = useCallback((points: number, row?: number, col?: number) => {
    // Si tenemos coordenadas de celda, mostrar animación en esa posición
    if (row !== undefined && col !== undefined) {
      // Obtener el elemento de la celda
      const cellElement = getCellElement(row, col);
      
      if (cellElement) {
        // Crear elemento de puntos flotantes
        const pointsPopup = document.createElement('div');
        pointsPopup.className = points > 50 ? 'points-popup special' : 'points-popup';
        
        // Añadir el valor de los puntos
        const pointsValue = document.createElement('span');
        pointsValue.className = 'points-value';
        pointsValue.textContent = `${points}`;
        pointsPopup.appendChild(pointsValue);
        
        // Posicionar el elemento en la celda
        pointsPopup.style.top = '50%';
        pointsPopup.style.left = '50%';
        pointsPopup.style.transform = 'translate(-50%, -50%)';
        
        // Si tenemos version completa de animaciones, añadir partículas
        if (!document.documentElement.classList.contains('performance-mode')) {
          // Añadir partículas alrededor (solo versión completa)
          for (let i = 0; i < 6; i++) {
            const particle = document.createElement('div');
            particle.className = 'points-particle';
            particle.style.setProperty('--angle', `${i * 60}deg`);
            pointsPopup.appendChild(particle);
          }
        }
        
        // Añadir al DOM
        cellElement.appendChild(pointsPopup);
        
        // Reproducir sonido
        audioManager.play('points');
        
        // Eliminar después de que termine la animación
        const removeTimer = setTimeout(() => {
          if (pointsPopup && pointsPopup.parentNode) {
            pointsPopup.parentNode.removeChild(pointsPopup);
          }
        }, 1500);
        
        // Registrar el temporizador
        addAnimationTimer(removeTimer);
      }
    }
    
    // También usar el sistema de notificaciones para puntos importantes o si no tenemos coordenadas
    if (points > 100 || row === undefined || col === undefined) {
      addNotification({
        message: '¡Puntos conseguidos!',
        type: 'success',
        icon: '🏆',
        duration: 1500,
        value: `+${points}`
      });
    }
  }, [addNotification, getCellElement, addAnimationTimer]);
  
  /**
   * Mostrar notificación y animación de bonificación por tablero vacío
   */
  const showEmptyBoardBonus = useCallback(() => {
    // Notificación estándar
    addNotification({
      message: '¡Tablero limpio!',
      type: 'success',
      icon: '🎉',
      duration: 2000,
      value: 'Bonificación'
    });
    
    // Animación central para la bonificación
    const gameBoard = document.querySelector('.game-board');
    if (gameBoard) {
      // Crear elemento de bonificación
      const bonusPopup = document.createElement('div');
      bonusPopup.className = 'points-popup bonus';
      
      // Añadir texto de bonificación
      const bonusValue = document.createElement('span');
      bonusValue.className = 'points-value';
      bonusValue.textContent = '100';
      bonusPopup.appendChild(bonusValue);
      
      // Posicionar en el centro del tablero
      bonusPopup.style.top = '50%';
      bonusPopup.style.left = '50%';
      bonusPopup.style.transform = 'translate(-50%, -50%)';
      
      // Añadir al DOM
      gameBoard.appendChild(bonusPopup);
      
      // Reproducir sonido de bonificación
      audioManager.play('levelComplete');
      
      // Eliminar después de que termine la animación
      const removeTimer = setTimeout(() => {
        if (bonusPopup && bonusPopup.parentNode) {
          bonusPopup.parentNode.removeChild(bonusPopup);
        }
      }, 2000);
      
      // Registrar el temporizador
      addAnimationTimer(removeTimer);
    }
  }, [addNotification, addAnimationTimer]);
  
  /**
   * Verificar si hay movimientos válidos en el tablero
   */
  const hasValidMoves = useCallback(() => {
    if (!board || board.length === 0) return false;
    
    // Verificar cada celda vacía
    for (let row = 0; row < boardSize; row++) {
      for (let col = 0; col < boardSize; col++) {
        if (board[row][col] === null) {
          // Verificar si hay convergencia potencial
          const adjacentIconsCount = findAdjacentSameIcons(row, col, availableIcons);
          if (adjacentIconsCount >= 2) {
            return true;
          }
        }
      }
    }
    
    return false;
  }, [board, boardSize, availableIcons]);
  
  /**
   * Encuentra iconos adyacentes del mismo tipo para una celda
   */
  const findAdjacentSameIcons = useCallback((row: number, col: number, icons: string[]) => {
    if (!board) return 0;
    
    const directions = [
      { dr: -1, dc: 0 }, // arriba
      { dr: 0, dc: 1 },  // derecha
      { dr: 1, dc: 0 },  // abajo
      { dr: 0, dc: -1 }  // izquierda
    ];
    
    const iconMatches: Record<string, number> = {};
    
    // Para cada tipo de icono disponible
    for (const icon of icons) {
      let matchCount = 0;
      
      // Buscar en las cuatro direcciones
      for (const { dr, dc } of directions) {
        let r = row + dr;
        let c = col + dc;
        
        // Buscar hasta encontrar un icono o salir del tablero
        while (r >= 0 && r < boardSize && c >= 0 && c < boardSize) {
          if (board[r][c] === icon) {
            matchCount++;
            break;
          } else if (board[r][c] !== null) {
            break; // Encontramos un icono diferente
          }
          r += dr;
          c += dc;
        }
      }
      
      if (matchCount >= 2) {
        iconMatches[icon] = matchCount;
      }
    }
    
    // Devolver el máximo de coincidencias
    return Math.max(0, ...Object.values(iconMatches));
  }, [board, boardSize]);
  
  /**
   * Encontrar iconos que convergen hacia una posición
   */
  const findConvergingIcons = useCallback((row: number, col: number) => {
    if (!board) return [];
    
    // Utilizar la implementación mejorada de hintUtils
    return findConvergingIconsUtil(board, row, col, boardSize);
  }, [board, boardSize]);
  
  /**
   * Eliminar iconos convergentes del tablero - versión optimizada para rendimiento
   */
  const removeConvergingIcons = useCallback((
    convergingIcons: { row: number; col: number; icon: string }[],
    targetRow: number,
    targetCol: number
  ) => {
    return new Promise<number>(resolve => {
      if (!convergingIcons.length || !board) {
        resolve(0);
        return;
      }
      
      // Crear copia del tablero para modificación - optimizada con map más eficiente
      const newBoard = board.map(row => [...row]);
      
      // Agrupar los iconos por tipo
      const iconsByType: Record<string, { row: number; col: number; icon: string }[]> = {};
      for (const icon of convergingIcons) {
        if (!iconsByType[icon.icon]) {
          iconsByType[icon.icon] = [];
        }
        iconsByType[icon.icon].push(icon);
      }
      
      // Solo procesar grupos con al menos 2 iconos del mismo tipo
      let totalIconsToRemove: { row: number; col: number; icon: string }[] = [];
      for (const iconType in iconsByType) {
        if (iconsByType[iconType].length >= 2) {
          totalIconsToRemove = [...totalIconsToRemove, ...iconsByType[iconType]];
        }
      }
      
      // Si no hay nada que eliminar, salir
      if (totalIconsToRemove.length === 0) {
        resolve(0);
        return;
      }
      
      // Marcar los iconos a eliminar
      totalIconsToRemove.forEach(({ row, col }) => {
        if (newBoard[row][col]) {
          newBoard[row][col] = newBoard[row][col] + '_removing';
        }
      });
      
      // Actualizar tablero con animación de eliminación
      dispatch(updateBoard(newBoard));
      
      // Reproducir sonido en segundo plano
      setTimeout(() => audioManager.play("convergingFound"), 0);
      
      // Tiempo reducido para que se complete la animación 
      const removeTimer = setTimeout(() => {
        // Eliminar los iconos marcados - optimizado
        const finalBoard = newBoard.map(row => 
          row.map(cell => cell && cell.includes('_removing') ? null : cell)
        );
        
        // Actualizar tablero final
        dispatch(updateBoard(finalBoard));
        
        // Actualizar el contador de iconos
        dispatch(setIconCount(iconCount - totalIconsToRemove.length));
        
        // Resolver con el número de iconos eliminados
        resolve(totalIconsToRemove.length);
      }, 300); // Reducido para experiencia más rápida
      
      addAnimationTimer(removeTimer);
    });
  }, [board, dispatch, iconCount, addAnimationTimer]);
  
  /**
   * Mostrar alerta de penalización
   */
  const showPenaltyAlertUI = useCallback(() => {
    // Usar el nuevo sistema de notificaciones en lugar de las alertas directas
    addNotification({
      message: '¡Penalización!',
      type: 'error',
      icon: '⚠️',
      duration: 2000,
      value: 'Velocidad aumentada'
    });
    
    // Mantenemos el estado actual para compatibilidad, pero lo eliminaremos en el futuro
    setShowPenaltyAlert(true);
    const timer = setTimeout(() => {
      setShowPenaltyAlert(false);
    }, 2000);
    addAnimationTimer(timer);
  }, [addNotification, addAnimationTimer]);
  
  /**
   * Mostrar alerta de aumento de velocidad
   */
  const showSpeedAlertUI = useCallback((multiplier: number) => {
    // Usar el nuevo sistema de notificaciones con animación del valor
    addNotification({
      message: '¡Velocidad aumentada!',
      type: 'warning',
      icon: '⚡',
      duration: 2500,
      value: `x${multiplier}`,
      animateValue: true
    });
    
    // Mantenemos el estado actual para compatibilidad, pero lo eliminaremos en el futuro
    setSpeedMultiplier(multiplier);
    setShowSpeedAlert(true);
    const timer = setTimeout(() => {
      setShowSpeedAlert(false);
    }, 2000);
    addAnimationTimer(timer);
  }, [addNotification, addAnimationTimer]);
  
  /**
   * Limpiar las animaciones y temporizadores asociados
   */
  const cleanupEffects = useCallback(() => {
    // Limpiar todas las celdas destacadas
    dispatch(setHighlightedCells([]));
    
    // Detener cualquier animación en curso
    animationTimers.current.forEach(clearTimeout);
    animationTimers.current = [];
    
    // Reiniciar las alertas
    setShowPenaltyAlert(false);
    setShowSpeedAlert(false);
  }, [dispatch]);
  
  /**
   * Penalizar al jugador por un clic erróneo
   */
  const penalize = useCallback((row: number, col: number) => {
    // Obtener el elemento de la celda para la animación
    const cellElement = getCellElement(row, col);
    
    // Animaciones visuales de error
    animateCellError(cellElement, addAnimationTimer);
    animateBoardShake(addAnimationTimer);
    
    // Aumentar velocidad como penalización e informar al usuario
    const newMultiplier = increaseSpeedAsPenalty(spawnRate, dispatch);
    
    // Mostrar solo la notificación del cambio de velocidad (quitamos la de penalización)
    setTimeout(() => {
      showSpeedAlertUI(newMultiplier);
    }, 200);
    
    // Añadir iconos de penalización al tablero con mejor animación visual
    const currentLevel = store.getState().game.level;
    addPenaltyIcons(
      currentLevel,
      board,
      boardSize,
      availableIcons,
      dispatch,
      getCellElement,
      addAnimationTimer
    );
  }, [
    dispatch, 
    spawnRate, 
    board, 
    boardSize, 
    availableIcons,
    getCellElement,
    addAnimationTimer,
    showSpeedAlertUI
  ]);
  
  /**
   * Aumentar la velocidad del juego
   */
  const increaseSpeed = useCallback(() => {
    audioManager.play("speedUp");
    
    // Calcular la nueva velocidad (más rápido = valor más bajo)
    const baseSpeed = config.INITIAL_SPAWN_RATE;
    const maxSpeedMultiplier = 3; // Asumir un valor por defecto
    const minSpeed = baseSpeed / maxSpeedMultiplier;
    
    // Reducir el tiempo entre spawns, pero no más allá del mínimo
    const newSpawnRate = Math.max(minSpeed, spawnRate * 0.9);
    
    // Actualizar el intervalo de spawn
    dispatch(setSpawnRate(newSpawnRate));
    
    // Calcular y mostrar el multiplicador actual
    const currentSpeedMultiplier = Number((baseSpeed / newSpawnRate).toFixed(1));
    
    // Mostrar alerta de aumento de velocidad con un pequeño retraso
    // para asegurar que el estado se actualice correctamente
    setTimeout(() => {
      showSpeedAlertUI(currentSpeedMultiplier);
    }, 50);
    
    // Registrar el cambio de velocidad
    console.log(`Velocidad aumentada a ${currentSpeedMultiplier}x (${newSpawnRate}ms)`);
    
    return currentSpeedMultiplier; // Devolver el nuevo multiplicador para verificación
  }, [spawnRate, dispatch, showSpeedAlertUI]);
  
  /**
   * Manejar clic en una celda - optimizado para rendimiento competitivo
   */
  const handleCellClick = useCallback((row: number, col: number) => {
    // Crear un identificador único para esta celda
    const cellId = `${row}-${col}`;
    
    // Verificar si ya estamos procesando un clic o si se hizo clic en la misma celda recientemente
    if (isProcessingClickRef.current || lastClickedCellRef.current === cellId) {
      logger.debug('Interacción', 'handleCellClick: ignorando clic porque ya se está procesando otro o es un multi-clic en la misma celda');
      return;
    }
    
    // Verificar si el juego está en estado de juego
    if (status !== 'playing') {
      logger.debug('handleCellClick: ignorando clic porque el juego no está en estado "playing"', ' [' + status + ']');
      return;
    }
    
    // Mejora: Comprobar rápidamente si la celda está vacía antes de procesar más lógica
    if (!board || !board[row] || board[row][col] !== null) {
      logger.debug('handleCellClick: celda no está vacía', ' [' + row + ', ' + col + '] ' + board?.[row]?.[col]);
      return;
    }
    
    // Activar el debounce
    isProcessingClickRef.current = true;
    lastClickedCellRef.current = cellId;
    
    // Desactivar el debounce después de un tiempo razonable (500ms)
    const debounceTimer = setTimeout(() => {
      isProcessingClickRef.current = false;
      lastClickedCellRef.current = null;
    }, 500);
    
    // Añadir el timer a la lista de timers para limpieza
    addAnimationTimer(debounceTimer);
    
    // Optimización: Limpieza más eficiente del resaltado previo
    if (highlightedCells.length > 0) {
      dispatch(setHighlightedCells([]));
    }
    
    // Sonido optimizado para menor latencia
    setTimeout(() => audioManager.play("click"), 0);
    
    // Buscar iconos convergentes
    const convergingIcons = findConvergingIcons(row, col);
    
    if (convergingIcons.length > 0) {
      // Hay convergencia, eliminar los iconos y actualizar la puntuación
      removeConvergingIcons(convergingIcons, row, col);
      
      // Calcular puntos basados en el número de iconos y multiplicadores
      const basePoints = convergingIcons.length * 10;
      const pointsEarned = Math.ceil(basePoints);
      
      // Actualizar puntuación
      dispatch(incrementScore(pointsEarned));
      
      // Mostrar animación de puntos ganados con el nuevo sistema
      showPointsEarned(pointsEarned, row, col);
      
      // Verificar si el tablero está vacío para mostrar bonificación
      setTimeout(() => {
        const boardEmpty = board.flat().every(cell => cell === '');
        if (boardEmpty) {
          // Mostrar bonificación por tablero vacío
          showEmptyBoardBonus();
          
          // Añadir puntos extra por tablero vacío
          const emptyBoardBonus = 100;
          dispatch(incrementScore(emptyBoardBonus));
        }
      }, 200);
      
      // Obtener el elemento DOM de la celda objetivo
      const targetCell = getCellElement(row, col);
      
      // Resaltar las celdas que tienen convergencia
      if (convergingIcons.length > 0) {
        dispatch(setHighlightedCells(convergingIcons.map(icon => ({ row: icon.row, col: icon.col }))));
      }
      
      // Eliminar el highlight instantáneamente, no después de un timeout
      dispatch(setHighlightedCells([]));
      
      // Verificar si no hay más movimientos válidos o si el tablero está vacío
      const currentIconCount = store.getState().game.iconCount;
      
      if (currentIconCount === 0) {
        // Tablero vacío, nivel completado - INSTANTÁNEO
        logger.info("¡Tablero vacío! Completando nivel...", ' [' + status + ']');
        dispatch(setGameStatus('levelCompleted'));
        audioManager.play('levelComplete');
      } else if (!hasValidMoves()) {
        // No hay movimientos válidos
        // Calcular el porcentaje de ocupación para determinar si se pasa al siguiente nivel
        const totalCells = boardSize * boardSize;
        const occupationPercentage = (currentIconCount / totalCells) * 100;
        
        // Si hay pocos iconos en el tablero, considerar nivel completado
        if (occupationPercentage <= 30) {
          // Nivel completado con pocos iconos - INSTANTÁNEO
          logger.info(`Pocos iconos sin convergencias (${occupationPercentage.toFixed(1)}%). Nivel completado.`, ' [' + status + ']');
          dispatch(setGameStatus('levelCompleted'));
          audioManager.play('levelComplete');
        } else {
          // Game over - INSTANTÁNEO
          logger.info(`No hay movimientos válidos (${occupationPercentage.toFixed(1)}%). Game over.`, ' [' + status + ']');
          dispatch(setGameStatus('gameOver'));
          audioManager.play('gameOver');
        }
      }
      
      // Nota: No liberamos el debounce aquí, se libera automáticamente después del tiempo establecido
    } else {
      // No hay convergencia, feedback inmediato
      audioManager.play("invalidMove");
      
      // Si no hay convergencia, liberar el debounce después de mostrar el error
      // Esto permite que la animación de error se muestre pero evita múltiples clics
      const errorDebounceTime = 300; // Tiempo suficiente para mostrar la animación de error
      setTimeout(() => {
        isProcessingClickRef.current = false;
        lastClickedCellRef.current = null;
      }, errorDebounceTime);
      
      // Llamar a la función de penalización unificada - evitando duplicidad de código
      penalize(row, col);
    }
  }, [
    status, 
    board, 
    dispatch, 
    findConvergingIcons, 
    getCellElement, 
    removeConvergingIcons,
    hasValidMoves,
    setShowPenaltyAlert,
    spawnRate,
    highlightedCells,
    addAnimationTimer,
    boardSize,
    availableIcons,
    animateCellError,
    animateBoardShake,
    showPointsEarned
  ]);
  
  /**
   * Mostrar una pista
   */
  const showHint = useCallback(() => {
    if (!canUseHint(hintsRemaining, hintCooldown)) {
      if (hintCooldown) {
        logger.info('showHint: pista en cooldown', ' [' + status + ']');
      } else if (hintsRemaining <= 0) {
        logger.info('showHint: no quedan pistas', ' [' + status + ']');
      }
      return;
    }
    
    // Buscar posición para la pista
    const hintPosition = findHintPosition(board || [], boardSize);
    
    if (hintPosition) {
      // Resaltar la celda como pista
      const cellsToHighlight = getHighlightedCells(hintPosition);
      
      logger.info('showHint: mostrando pista', ' [' + status + '] ' + `posición: ${JSON.stringify(hintPosition)}`);
      
      // Actualizar celdas resaltadas en el store
      dispatch(setHighlightedCells(cellsToHighlight));
      
      // Reproducir sonido de pista
      audioManager.play('hint');
      
      // Usar una pista
      dispatch(useHint());
      
      // Programar reinicio del cooldown
      if (hintTimerRef.current) {
        clearTimeout(hintTimerRef.current);
      }
      
      hintTimerRef.current = setTimeout(() => {
        dispatch(resetHintCooldown());
        hintTimerRef.current = null;
      }, 5000); // 5 segundos de cooldown
    } else {
      logger.warn('showHint: no se encontró una posición válida para la pista', ' [' + status + ']');
    }
  }, [board, boardSize, hintsRemaining, hintCooldown, status, dispatch]);
  
  /**
   * Ajustar el tamaño visual del tablero
   */
  const adjustBoardSize = useCallback((boardContainer: HTMLElement, boardElement: HTMLElement) => {
    if (!boardContainer || !boardElement) return;
    
    const containerWidth = boardContainer.offsetWidth;
    const containerHeight = boardContainer.offsetHeight;
    
    // Calcular el tamaño óptimo
    const size = Math.min(containerWidth, containerHeight) * 0.9;
    
    // Aplicar tamaño
    boardElement.style.width = `${size}px`;
    boardElement.style.height = `${size}px`;
    
    // Ajustar el grid según el tamaño del tablero
    const gridElement = boardElement.querySelector('.game-board-grid');
    if (gridElement) {
      (gridElement as HTMLElement).style.gridTemplateColumns = `repeat(${boardSize}, 1fr)`;
      (gridElement as HTMLElement).style.gridTemplateRows = `repeat(${boardSize}, 1fr)`;
    }
  }, [boardSize]);
  
  /**
   * Registrar referencia para una celda
   */
  const registerCellRef = useCallback((row: number, col: number, element: HTMLElement | null) => {
    const key = `${row}-${col}`;
    if (element) {
      cellRefs.current[key] = element;
    } else {
      delete cellRefs.current[key];
    }
  }, []);
  
  return {
    stopTimers,
    addAnimationTimer,
    registerCellRef,
    getCellElement,
    hasValidMoves,
    findAdjacentSameIcons,
    findConvergingIcons,
    removeConvergingIcons,
    showPenaltyAlertUI,
    showSpeedAlertUI,
    penalize,
    increaseSpeed,
    handleCellClick,
    showHint,
    adjustBoardSize,
    showPointsEarned,
    showEmptyBoardBonus,
    cleanupEffects,
    showSpeedAlert,
    speedMultiplier,
    showPenaltyAlert
  };
};

export default useBoardInteraction;