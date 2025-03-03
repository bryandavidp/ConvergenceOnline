import { useCallback, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../../../store';
import { 
  setHighlightedCells, 
  useHint, 
  resetHintCooldown, 
  incrementScore,
  setSpawnRate,
  setGameStatus
} from '../../../../store/slices/gameSlice';
import { findConvergences } from '../utils/convergenceUtils';
import { findHintPosition, getHighlightedCells, canUseHint } from '../utils/hintUtils';
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
  
  // Referencia para el intervalo de spawn
  const spawnIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Estado para controlar alertas visuales
  const [showSpeedAlert, setShowSpeedAlert] = useState(false);
  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  const [showPenaltyAlert, setShowPenaltyAlert] = useState(false);
  
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
    
    const directions = [
      { dr: -1, dc: 0 }, // arriba
      { dr: 0, dc: 1 },  // derecha
      { dr: 1, dc: 0 },  // abajo
      { dr: 0, dc: -1 }  // izquierda
    ];
    
    const convergingCells: { row: number; col: number; icon: string }[] = [];
    const possibleConvergenceIcons: Record<string, { positions: { row: number; col: number }[]; directions: number }> = {};
    
    // Buscar iconos en las cuatro direcciones
    for (let dirIndex = 0; dirIndex < directions.length; dirIndex++) {
      const { dr, dc } = directions[dirIndex];
      let r = row + dr;
      let c = col + dc;
      
      // Buscar hasta encontrar un icono o salir del tablero
      while (r >= 0 && r < boardSize && c >= 0 && c < boardSize) {
        if (board[r][c] !== null) {
          const icon = board[r][c]!;
          
          // Inicializar el objeto para este icono si no existe
          if (!possibleConvergenceIcons[icon]) {
            possibleConvergenceIcons[icon] = {
              positions: [],
              directions: 0
            };
          }
          
          // Añadir esta posición y dirección
          possibleConvergenceIcons[icon].positions.push({ row: r, col: c });
          possibleConvergenceIcons[icon].directions++;
          
          break;
        }
        r += dr;
        c += dc;
      }
    }
    
    // Verificar qué iconos convergen desde al menos dos direcciones
    for (const icon in possibleConvergenceIcons) {
      if (possibleConvergenceIcons[icon].directions >= 2) {
        // Este icono converge, añadir sus posiciones
        possibleConvergenceIcons[icon].positions.forEach(pos => {
          convergingCells.push({ ...pos, icon });
        });
      }
    }
    
    return convergingCells;
  }, [board, boardSize]);
  
  /**
   * Eliminar iconos convergentes del tablero
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
      
      // Crear copia del tablero para modificación
      const newBoard = board.map(row => [...row]);
      
      // Marcar los iconos a eliminar
      convergingIcons.forEach(({ row, col }) => {
        if (newBoard[row][col]) {
          newBoard[row][col] = newBoard[row][col] + '_removing';
        }
      });
      
      // Actualizar tablero con animación de eliminación
      // Esto sería gestionado por el Redux store
      
      // Simular tiempo de animación
      setTimeout(() => {
        // Eliminar los iconos marcados
        const finalBoard = newBoard.map(row => row.map(cell => 
          cell && cell.includes('_removing') ? null : cell
        ));
        
        // Actualizar tablero final
        // Esto sería gestionado por el Redux store
        
        // Resolver con el número de iconos eliminados
        resolve(convergingIcons.length);
      }, 300);
    });
  }, [board]);
  
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
    setTimeout(() => {
      pointsElement.classList.add('animate');
      
      setTimeout(() => {
        document.body.removeChild(pointsElement);
      }, 1000);
    }, 10);
  }, []);
  
  /**
   * Animar celda con error
   */
  const animateErrorCell = useCallback((row: number, col: number) => {
    const cellElement = getCellElement(row, col);
    if (!cellElement) return;
    
    cellElement.classList.add('error');
    setTimeout(() => {
      cellElement.classList.remove('error');
    }, 500);
  }, [getCellElement]);
  
  /**
   * Animar sacudida del tablero
   */
  const animateBoard = useCallback(() => {
    const boardElement = document.querySelector('.game-board');
    if (!boardElement) return;
    
    boardElement.classList.add('shake');
    setTimeout(() => {
      boardElement.classList.remove('shake');
    }, 500);
  }, []);
  
  /**
   * Mostrar alerta de penalización
   */
  const showPenaltyAlertUI = useCallback(() => {
    setShowPenaltyAlert(true);
    setTimeout(() => {
      setShowPenaltyAlert(false);
    }, 2000);
  }, []);
  
  /**
   * Mostrar alerta de aumento de velocidad
   */
  const showSpeedAlertUI = useCallback((multiplier: number) => {
    setSpeedMultiplier(multiplier);
    setShowSpeedAlert(true);
    setTimeout(() => {
      setShowSpeedAlert(false);
    }, 2000);
  }, []);
  
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
  }, [spawnRate, dispatch, showSpeedAlertUI]);
  
  /**
   * Manejar clic en una celda
   */
  const handleCellClick = useCallback((row: number, col: number) => {
    // Verificar si el juego está en estado de juego
    if (status !== 'playing') {
      logger.debug('handleCellClick: ignorando clic porque el juego no está en estado "playing"', ' [' + status + ']');
      return;
    }
    
    // Limpiamos cualquier resaltado previo
    dispatch(setHighlightedCells([]));
    
    // Reproducir sonido de clic
    audioManager.play("click");
    
    // Verificar si la celda está vacía
    if (!board || !board[row] || board[row][col] !== null) {
      logger.debug('handleCellClick: celda no está vacía', ' [' + row + ', ' + col + '] ' + board[row][col]);
      return;
    }
    
    // Buscar iconos convergentes
    const convergingIcons = findConvergingIcons(row, col);
    
    if (convergingIcons.length > 0) {
      // Hay convergencia
      audioManager.play("convergingFound");
      
      // Obtener el elemento DOM de la celda objetivo
      const targetCell = getCellElement(row, col);
      
      // Eliminar los iconos convergentes
      removeConvergingIcons(convergingIcons, row, col)
        .then((removedCount) => {
          // Reproducir sonido de eliminación
          audioManager.play("removeIcon");
          
          // Calcular y añadir puntos
          const pointsEarned = removedCount * 10;
          dispatch(incrementScore(pointsEarned));
          
          // Animar puntos ganados
          if (targetCell) {
            animatePointsEarned(targetCell, pointsEarned);
          }
          
          // Verificar si no hay más movimientos válidos
          if (!hasValidMoves()) {
            logger.info("No hay movimientos válidos. Completando nivel...", ' [' + status + ']');
            setTimeout(() => {
              dispatch(setGameStatus('levelCompleted'));
            }, 500);
          }
        });
    } else {
      // No hay convergencia, penalizar
      audioManager.play("error");
      penalize(row, col);
    }
  }, [
    status, board, dispatch, findConvergingIcons, 
    getCellElement, removeConvergingIcons, 
    animatePointsEarned, hasValidMoves, penalize
  ]);
  
  /**
   * Mostrar una pista
   */
  const showHint = useCallback(() => {
    if (!canUseHint(hintsRemaining, hintCooldown, status)) {
      if (hintCooldown) {
        logger.info('showHint: pista en cooldown', ' [' + status + ']');
      } else if (hintsRemaining <= 0) {
        logger.info('showHint: no quedan pistas', ' [' + status + ']');
      }
      return;
    }
    
    // Buscar posición para la pista
    const hintPosition = findHintPosition(board || [], boardSize, availableIcons);
    
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
      const hintTimer = setTimeout(() => {
        dispatch(resetHintCooldown());
      }, 5000); // 5 segundos de cooldown
      
      return hintTimer;
    } else {
      logger.warn('showHint: no se encontró una posición válida para la pista', ' [' + status + ']');
    }
  }, [board, boardSize, availableIcons, hintsRemaining, hintCooldown, status, dispatch]);
  
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
    
    // Ajustar tamaño de celdas
    const cellSize = size / boardSize;
    const cells = boardElement.querySelectorAll('.cell');
    cells.forEach(cell => {
      (cell as HTMLElement).style.width = `${cellSize}px`;
      (cell as HTMLElement).style.height = `${cellSize}px`;
      (cell as HTMLElement).style.fontSize = `${cellSize * 0.6}px`;
    });
  }, [boardSize]);
  
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
    hasValidMoves
  };
};

export default useBoardInteraction; 