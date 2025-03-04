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
  setIconCount
} from '../../../../store/slices/gameSlice';
import { findConvergences } from '../utils/convergenceUtils';
import { findHintPosition, getHighlightedCells, canUseHint, findConvergingIcons as findConvergingIconsUtil } from '../utils/hintUtils';
import { audioManager } from '../../../../utils/audioManager';
import logger from '../../../../utils/logger';
import * as config from '../../../../utils/config';

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
  
  // Referencias para las celdas del tablero (DOM)
  const cellRefs = useRef<Record<string, HTMLElement>>({});
  
  // Referencias para los temporizadores
  const spawnIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const hintTimerRef = useRef<NodeJS.Timeout | null>(null);
  const animationTimersRef = useRef<NodeJS.Timeout[]>([]);
  
  // Estado para controlar alertas visuales
  const [showSpeedAlert, setShowSpeedAlert] = useState(false);
  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  const [showPenaltyAlert, setShowPenaltyAlert] = useState(false);
  
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
    animationTimersRef.current.forEach(timer => clearTimeout(timer));
    animationTimersRef.current = [];
    
    // Limpiar alertas visuales
    setShowSpeedAlert(false);
    setShowPenaltyAlert(false);
  }, []);
  
  /**
   * Agregar un temporizador a la lista de temporizadores de animación
   */
  const addAnimationTimer = useCallback((timer: NodeJS.Timeout) => {
    animationTimersRef.current.push(timer);
  }, []);
  
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
  
  /**
   * Obtener el elemento DOM para una celda
   */
  const getCellElement = useCallback((row: number, col: number) => {
    const key = `${row}-${col}`;
    return cellRefs.current[key] || null;
  }, []);
  
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
   * Animar puntos ganados
   */
  const animatePointsEarned = useCallback((targetElement: HTMLElement | null, points: number) => {
    if (!targetElement) return;
    
    // Crear elemento de animación
    const pointsElement = document.createElement('div');
    pointsElement.className = 'points-animation';
    pointsElement.textContent = `+${points}`;
    
    // Posicionar sobre la celda objetivo
    const rect = targetElement.getBoundingClientRect();
    pointsElement.style.left = `${rect.left + rect.width / 2}px`;
    pointsElement.style.top = `${rect.top + rect.height / 2}px`;
    
    // Añadir al DOM
    document.body.appendChild(pointsElement);
    
    // Animar y luego eliminar
    const animateTimer = setTimeout(() => {
      pointsElement.classList.add('animate');
      
      const removeTimer = setTimeout(() => {
        document.body.removeChild(pointsElement);
      }, 1000);
      addAnimationTimer(removeTimer);
    }, 10);
    addAnimationTimer(animateTimer);
  }, [addAnimationTimer]);
  
  /**
   * Animar celda con error
   */
  const animateErrorCell = useCallback((row: number, col: number) => {
    const cellElement = getCellElement(row, col);
    if (!cellElement) return;
    
    cellElement.classList.add('error');
    const timer = setTimeout(() => {
      cellElement.classList.remove('error');
    }, 500);
    addAnimationTimer(timer);
  }, [getCellElement, addAnimationTimer]);
  
  /**
   * Animar sacudida del tablero
   */
  const animateBoard = useCallback(() => {
    const boardElement = document.querySelector('.game-board-grid');
    if (!boardElement) return;
    
    boardElement.classList.add('shake');
    const timer = setTimeout(() => {
      boardElement.classList.remove('shake');
    }, 500);
    addAnimationTimer(timer);
  }, [addAnimationTimer]);
  
  /**
   * Mostrar alerta de penalización
   */
  const showPenaltyAlertUI = useCallback(() => {
    setShowPenaltyAlert(true);
    const timer = setTimeout(() => {
      setShowPenaltyAlert(false);
    }, 2000);
    addAnimationTimer(timer);
  }, [addAnimationTimer]);
  
  /**
   * Mostrar alerta de aumento de velocidad
   */
  const showSpeedAlertUI = useCallback((multiplier: number) => {
    setSpeedMultiplier(multiplier);
    setShowSpeedAlert(true);
    const timer = setTimeout(() => {
      setShowSpeedAlert(false);
    }, 2000);
    addAnimationTimer(timer);
  }, [addAnimationTimer]);
  
  /**
   * Penalizar al jugador por un clic erróneo
   */
  const penalize = useCallback((row: number, col: number) => {
    // Destacar la celda como error y animar el tablero
    animateErrorCell(row, col);
    animateBoard();
    
    // Aumentar la velocidad como penalización
    const baseSpeed = config.INITIAL_SPAWN_RATE;
    const maxSpeedMultiplier = 3; // Asumir un valor por defecto
    const minSpeed = baseSpeed / maxSpeedMultiplier;
    
    // Reducir el tiempo entre spawns (aumentar velocidad)
    const newSpawnRate = Math.max(minSpeed, spawnRate * 0.95);
    
    // Actualizar el intervalo de spawn
    // Esto se manejaría con Redux y los efectos
    dispatch(setSpawnRate(newSpawnRate));
    
    // Mostrar alerta de penalización
    showPenaltyAlertUI();
    
    // Añadir iconos de penalización
    // Esto se manejaría con acciones de Redux
    const penaltyIcons = 2; // Asumir un valor por defecto
    for (let i = 0; i < penaltyIcons; i++) {
      setTimeout(() => {
        // Aquí se añadirían los iconos de penalización
        // dispatch(addRandomIcon());
      }, i * 200);
    }
  }, [animateErrorCell, animateBoard, spawnRate, dispatch, showPenaltyAlertUI]);
  
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
    
    // Mostrar alerta de aumento de velocidad
    showSpeedAlertUI(currentSpeedMultiplier);
    
    // Registrar el cambio de velocidad
    console.log(`Velocidad aumentada a ${currentSpeedMultiplier}x (${newSpawnRate}ms)`);
    
    return currentSpeedMultiplier; // Devolver el nuevo multiplicador para verificación
  }, [spawnRate, dispatch, showSpeedAlertUI]);
  
  /**
   * Manejar clic en una celda - optimizado para rendimiento competitivo
   */
  const handleCellClick = useCallback((row: number, col: number) => {
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
    
    // Optimización: Limpieza más eficiente del resaltado previo
    if (highlightedCells.length > 0) {
      dispatch(setHighlightedCells([]));
    }
    
    // Sonido optimizado para menor latencia
    setTimeout(() => audioManager.play("click"), 0);
    
    // Buscar iconos convergentes
    const convergingIcons = findConvergingIcons(row, col);
    
    if (convergingIcons.length > 0) {
      // Hay convergencia
      setTimeout(() => audioManager.play("convergingFound"), 0);
      
      // Obtener el elemento DOM de la celda objetivo
      const targetCell = getCellElement(row, col);
      
      // Resaltar las celdas que tienen convergencia
      if (convergingIcons.length > 0) {
        dispatch(setHighlightedCells(convergingIcons.map(icon => ({ row: icon.row, col: icon.col }))));
      }
      
      // Eliminar los iconos convergentes - tiempo optimizado
      removeConvergingIcons(convergingIcons, row, col)
        .then((removedCount) => {
          // Reproducir sonido de eliminación en segundo plano
          setTimeout(() => audioManager.play("removeIcon"), 0);
          
          // Calcular y añadir puntos (multiplicador basado en nivel)
          const currentLevel = store.getState().game.level;
          const pointsEarned = removedCount * 10 * currentLevel;
          dispatch(incrementScore(pointsEarned));
          
          // Animar puntos ganados
          if (targetCell) {
            animatePointsEarned(targetCell, pointsEarned);
          }
          
          // Limpiar las celdas destacadas después de finalizar
          dispatch(setHighlightedCells([]));
          
          // Verificar si el jugador ha eliminado todos los iconos requeridos para este nivel
          const { score, levelScoreTarget, currentPlayMode } = store.getState().game;
          if (score >= levelScoreTarget && currentPlayMode === 'classic') {
            // Nivel completado por puntuación objetivo
            dispatch(setGameStatus('levelCompleted'));
            audioManager.play('levelComplete');
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
        });
    } else {
      // No hay convergencia, feedback inmediato
      audioManager.play("invalidMove");
      
      // Velocidad de penalización (opcional)
      const MIN_SPAWN_RATE = 500; // Valor mínimo (más rápido) para el spawn rate
      const APPLY_PENALTY = true; // Si queremos aplicar penalización
      
      if (APPLY_PENALTY) {
        // Reducir el spawn rate (aumentar velocidad) como penalización
        const newRate = Math.max(spawnRate * 0.9, MIN_SPAWN_RATE);
        dispatch(setSpawnRate(newRate));
        
        // Mostrar alerta visual de penalización
        setShowPenaltyAlert(true);
        const penaltyTimer = setTimeout(() => setShowPenaltyAlert(false), 1000);
        addAnimationTimer(penaltyTimer);
      }
    }
  }, [
    status, 
    board, 
    dispatch, 
    findConvergingIcons, 
    getCellElement, 
    removeConvergingIcons,
    animatePointsEarned,
    hasValidMoves,
    setShowPenaltyAlert,
    spawnRate,
    highlightedCells,
    addAnimationTimer
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
    
    // No necesitamos ajustar las celdas individualmente ya que 
    // están configuradas con CSS para adaptarse automáticamente
  }, [boardSize]);
  
  // Añadir una función específica para detectar situaciones especiales como la de la imagen
  const detectSpecialGameOverCases = useCallback(() => {
    if (!board || board.length === 0) return;
    
    // Verificar el estado del tablero
    const { iconCount, status } = store.getState().game;
    
    if (status !== 'playing') return;
    
    // Contar tipos de iconos diferentes en el tablero
    const uniqueIcons = new Set<string>();
    let singleIconCounts: Record<string, number> = {};
    
    for (let row = 0; row < boardSize; row++) {
      for (let col = 0; col < boardSize; col++) {
        const cell = board[row][col];
        if (cell !== null) {
          uniqueIcons.add(cell);
          singleIconCounts[cell] = (singleIconCounts[cell] || 0) + 1;
        }
      }
    }
    
    // Si hay muy pocos iconos y son todos diferentes, no hay convergencia posible
    if (uniqueIcons.size >= 2 && uniqueIcons.size === iconCount && iconCount <= 3) {
      // Verificar si hay algún icono con al menos 3 instancias (podría formar convergencia)
      const hasConvergencePossibility = Object.values(singleIconCounts).some(count => count >= 3);
      
      if (!hasConvergencePossibility) {
        logger.info('GameBoard', `Caso especial detectado: ${iconCount} iconos diferentes sin posibilidad de convergencia.`);
        
        // Determinar si completar nivel o game over según cantidad de iconos
        if (iconCount <= 2) {
          logger.info('GameBoard', 'Solo quedan 2 o menos iconos diferentes. Avanzando al siguiente nivel.');
          dispatch(setGameStatus('levelCompleted'));
        } else {
          const totalCells = boardSize * boardSize;
          const occupationPercentage = (iconCount / totalCells) * 100;
          
          if (occupationPercentage <= 30) {
            logger.info('GameBoard', `Pocos iconos (${iconCount}) sin posibilidad de convergencia. Nivel completado.`);
            dispatch(setGameStatus('levelCompleted'));
          } else {
            logger.info('GameBoard', `No hay convergencias posibles. Game over.`);
            dispatch(setGameStatus('gameOver'));
          }
        }
      }
    }
  }, [board, boardSize, dispatch]);
  
  // Verificación inmediata del estado del tablero
  const checkBoardStateImmediately = useCallback(() => {
    // Verificar si el juego está en curso
    if (status !== 'playing' || !board) return;
    
    const hasMovesAvailable = hasValidMoves();
    
    if (!hasMovesAvailable) {
      // Verificar casos especiales primero (tablero con pocos iconos)
      const { iconCount } = store.getState().game;
      const totalCells = boardSize * boardSize;
      
      // Contar tipos de iconos diferentes
      const uniqueIcons = new Set<string>();
      for (let row = 0; row < boardSize; row++) {
        for (let col = 0; col < boardSize; col++) {
          const cell = board[row][col];
          if (cell !== null) {
            uniqueIcons.add(cell);
          }
        }
      }
      
      // Si hay 2 o menos iconos y todos son diferentes
      if (iconCount <= 2 && uniqueIcons.size === iconCount) {
        logger.info('GameBoard', `Detección inmediata: ${iconCount} iconos sin convergencia posible. Nivel completado.`);
        dispatch(setGameStatus('levelCompleted'));
        return;
      }
      
      // Calcular ocupación para otros casos
      const occupationPercentage = (iconCount / totalCells) * 100;
      
      if (occupationPercentage <= 30) {
        logger.info('GameBoard', `Detección inmediata: Pocos iconos (${occupationPercentage.toFixed(1)}%) sin movimientos válidos. Nivel completado.`);
        dispatch(setGameStatus('levelCompleted'));
      } else {
        logger.info('GameBoard', `Detección inmediata: Tablero sin movimientos válidos. Game over.`);
        dispatch(setGameStatus('gameOver'));
      }
    }
  }, [board, boardSize, status, hasValidMoves, dispatch]);
  
  // Efecto para detener temporizadores cuando cambia el estado del juego
  useEffect(() => {
    // Si el juego no está en estado 'playing', detener los temporizadores
    if (status !== 'playing') {
      stopTimers();
    }
    
    // Limpiar temporizadores al desmontar
    return () => {
      stopTimers();
    };
  }, [status, stopTimers]);
  
  // Añadir un efecto para ejecutar la detección de casos especiales
  useEffect(() => {
    if (status === 'playing') {
      const checkInterval = setInterval(() => {
        detectSpecialGameOverCases();
      }, 100); // Comprobar cada 100ms en lugar de 1500ms
      
      return () => {
        clearInterval(checkInterval);
      };
    }
  }, [status, detectSpecialGameOverCases]);
  
  // Añadir un efecto que verifique el estado después de cada actualización del tablero
  useEffect(() => {
    if (status === 'playing' && board) {
      // Pequeño retraso para asegurar que el tablero esté actualizado
      const timeoutId = setTimeout(() => {
        checkBoardStateImmediately();
      }, 0);
      
      return () => clearTimeout(timeoutId);
    }
  }, [board, status, checkBoardStateImmediately]);
  
  return {
    handleCellClick,
    registerCellRef,
    getCellElement,
    showHint,
    highlightedCells,
    adjustBoardSize,
    increaseSpeed,
    showSpeedAlert,
    speedMultiplier,
    showPenaltyAlert,
    hasValidMoves,
    stopTimers,
    showSpeedAlertUI
  };
};

export default useBoardInteraction; 