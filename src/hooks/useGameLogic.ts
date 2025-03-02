import { useCallback, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { 
  incrementScore, 
  updateBoard, 
  setIconCount,
  setGameStatus,
  setSpawnRate,
  incrementTimer,
  GameState
} from '../store/slices/gameSlice';
import { RootState } from '../store';
import logger from '../utils/logger';
import * as config from '../utils/originalGame/js/config.js';
import { isValidCell } from '../utils/originalGame/js/utils.js';
import { audioManager } from '../utils/audioManager';

export const useGameLogic = () => {
  const dispatch = useDispatch();
  const { 
    board, 
    iconCount, 
    status, 
    spawnRate, 
    boardSize, 
    availableIcons,
    currentMode
  } = useSelector((state: RootState) => state.game);
  
  // Referencias para los intervalos de tiempo
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const spawnIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const speedIncreaseIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Referencia para rastrear si el tablero está inicializado
  const isInitializedRef = useRef<boolean>(false);

  // Verificar si una celda tiene iconos convergentes
  const findConvergingIcons = useCallback((row: number, col: number): { row: number, col: number }[] => {
    const convergingIcons: { row: number, col: number }[] = [];
    
    // Verificar que el tablero exista
    if (!board || !board.length) {
      logger.warn('Game', 'Tablero no inicializado al buscar iconos convergentes');
      return convergingIcons;
    }
    
    const visited = new Set<string>();

    // Direcciones: arriba, derecha, abajo, izquierda
    const directions = [
      { dr: -1, dc: 0 },
      { dr: 0, dc: 1 },
      { dr: 1, dc: 0 },
      { dr: 0, dc: -1 },
    ];

    // Para cada dirección, buscar el primer icono
    const iconsByType: Record<string, { row: number, col: number }[]> = {};

    for (const { dr, dc } of directions) {
      let r = row + dr;
      let c = col + dc;

      // Seguir en esa dirección hasta encontrar un icono o salir del tablero
      while (isValidCell(r, c, boardSize) && board[r] && board[r][c] !== undefined) {
        if (board[r][c]) {
          const icon = board[r][c] as string;
          const key = `${r},${c}`;

          // Si no hemos visitado esta celda antes
          if (!visited.has(key)) {
            visited.add(key);

            // Agrupar por tipo de icono
            if (!iconsByType[icon]) {
              iconsByType[icon] = [];
            }

            iconsByType[icon].push({ row: r, col: c });
          }
          break;
        }

        r += dr;
        c += dc;
      }
    }

    // Verificar si hay al menos 2 iconos del mismo tipo que convergen
    for (const icon in iconsByType) {
      if (iconsByType[icon].length >= 2) {
        convergingIcons.push(...iconsByType[icon]);
      }
    }

    return convergingIcons;
  }, [board, boardSize]);

  // Verificar si hay movimientos válidos
  const hasValidMoves = useCallback((): boolean => {
    // Verificar que el tablero esté inicializado
    if (!board || !board.length) {
      logger.warn('Game', 'Tablero no inicializado al verificar movimientos válidos');
      return false;
    }
    
    for (let row = 0; row < boardSize; row++) {
      if (!board[row]) continue;
      
      for (let col = 0; col < boardSize; col++) {
        if (board[row][col] === undefined) continue;
        
        if (!board[row][col]) {
          const convergingIcons = findConvergingIcons(row, col);
          if (convergingIcons.length > 0) {
            return true;
          }
        }
      }
    }
    return false;
  }, [board, boardSize, findConvergingIcons]);

  // Agregar un icono aleatorio al tablero
  const addRandomIcon = useCallback(() => {
    // Solo permitir añadir iconos si el estado es 'playing' y el tablero está inicializado
    if (status !== 'playing' || !board || !board.length || !isInitializedRef.current) {
      logger.debug('Game', 'No se puede añadir icono, tablero no inicializado o juego no en curso', {
        status,
        boardExists: !!board,
        boardLength: board?.length,
        isInitialized: isInitializedRef.current
      });
      return;
    }

    try {
      // Verificar si hay celdas vacías
      const emptyCells: { row: number, col: number }[] = [];
      
      for (let row = 0; row < boardSize; row++) {
        if (!board[row]) continue;
        
        for (let col = 0; col < boardSize; col++) {
          if (board[row][col] === undefined) continue;
          
          if (!board[row][col]) {
            emptyCells.push({ row, col });
          }
        }
      }

      // Si no hay celdas vacías, terminar el juego
      if (emptyCells.length === 0) {
        logger.info('Game', 'Tablero lleno. Juego terminado.');
        dispatch(setGameStatus('gameOver'));
        return;
      }

      // Seleccionar una celda vacía aleatoria
      const randomIndex = Math.floor(Math.random() * emptyCells.length);
      const { row, col } = emptyCells[randomIndex];

      // Seleccionar un icono aleatorio
      const randomIcon = availableIcons[Math.floor(Math.random() * availableIcons.length)];

      // Actualizar el tablero
      const newBoard = Array.isArray(board) ? 
        [...board.map(r => Array.isArray(r) ? [...r] : [])] : 
        Array(boardSize).fill(null).map(() => Array(boardSize).fill(null));
        
      // Asegurar que la posición existe antes de modificarla
      if (newBoard[row] && newBoard[row][col] !== undefined) {
        newBoard[row][col] = randomIcon;
        
        dispatch(updateBoard(newBoard));
        dispatch(setIconCount(iconCount + 1));
        
        // Reproducir sonido
        audioManager.play('newIcon');
      }

      // Verificar si hay movimientos válidos
      if (!hasValidMoves()) {
        logger.info('Game', 'No hay movimientos válidos. Nivel completado.');
        dispatch(setGameStatus('levelCompleted'));
      }

    } catch (error) {
      logger.error('Game', 'Error al añadir icono aleatorio', error);
    }
  }, [board, boardSize, availableIcons, iconCount, status, dispatch, hasValidMoves]);

  // Manejar click en celda
  const handleCellClick = useCallback((row: number, col: number) => {
    if (status !== 'playing' || !board || !board.length) return;
    
    logger.info('Game', `Click en celda [${row}, ${col}]`);
    
    // Si la celda no existe o no está vacía, no hacer nada
    if (!board[row] || board[row][col] === undefined || board[row][col]) return;
    
    // Reproducir sonido de click
    audioManager.play('click');
    
    // Buscar iconos convergentes
    const convergingIcons = findConvergingIcons(row, col);
    
    if (convergingIcons.length > 0) {
      // Reproducir sonido de éxito
      audioManager.play('convergingFound');
      
      // Crear una copia del tablero
      const newBoard = [...board.map(r => Array.isArray(r) ? [...r] : [])];
      
      // Eliminar los iconos convergentes
      convergingIcons.forEach(({row, col}) => {
        if (newBoard[row] && newBoard[row][col] !== undefined) {
          newBoard[row][col] = null;
        }
      });
      
      // Reproducir sonido de eliminación
      audioManager.play('removeIcon');
      
      // Calcular puntos ganados (10 por icono)
      const pointsEarned = convergingIcons.length * 10;
      
      // Actualizar el tablero y la puntuación
      dispatch(updateBoard(newBoard));
      dispatch(incrementScore(pointsEarned));
      dispatch(setIconCount(iconCount - convergingIcons.length));
      
      // Verificar si el tablero está vacío
      if (iconCount - convergingIcons.length === 0) {
        audioManager.play('emptyBoard');
        // Añadir bonus por tablero vacío
        dispatch(incrementScore(500));
        // Completar nivel
        setTimeout(() => {
          dispatch(setGameStatus('levelCompleted'));
        }, 500);
      } 
      // Verificar si no hay más movimientos válidos
      else if (!hasValidMoves()) {
        setTimeout(() => {
          dispatch(setGameStatus('levelCompleted'));
        }, 500);
      }
    } else {
      // Reproducir sonido de error
      audioManager.play('error');
      
      // Aplicar penalización
      penalize(row, col);
    }
  }, [board, status, iconCount, dispatch, findConvergingIcons, hasValidMoves]);

  // Aplicar penalización por click erróneo
  const penalize = useCallback((row: number, col: number) => {
    // Aumentar la velocidad como penalización
    const baseSpeed = config.INITIAL_SPAWN_RATE;
    const modeConfig = config.GAME_MODES[currentMode as keyof typeof config.GAME_MODES] || config.GAME_MODES.normal;
    const minSpeed = baseSpeed / modeConfig.maxSpeedMultiplier;

    // Reducir el tiempo entre spawns (aumentar velocidad)
    const newSpawnRate = Math.max(minSpeed, spawnRate * 0.95);
    dispatch(setSpawnRate(newSpawnRate));

    // Actualizar el intervalo de spawn
    if (spawnIntervalRef.current) {
      clearInterval(spawnIntervalRef.current);
      spawnIntervalRef.current = setInterval(addRandomIcon, newSpawnRate);
    }

    // Añadir iconos de penalización
    for (let i = 0; i < config.PENALTY_ICONS; i++) {
      setTimeout(() => {
        addRandomIcon();
      }, i * 200);
    }
  }, [spawnRate, currentMode, dispatch, addRandomIcon]);

  // Iniciar los temporizadores
  const startTimers = useCallback(() => {
    // Limpiar temporizadores existentes
    stopTimers();

    // Temporizador para el tiempo de juego
    timerIntervalRef.current = setInterval(() => {
      dispatch(incrementTimer());
    }, 1000);

    // Temporizador para generar nuevos iconos
    spawnIntervalRef.current = setInterval(addRandomIcon, spawnRate);

    // Temporizador para aumentar la velocidad
    const modeConfig = config.GAME_MODES[currentMode as keyof typeof config.GAME_MODES] || config.GAME_MODES.normal;
    speedIncreaseIntervalRef.current = setInterval(() => {
      // Calcular la nueva velocidad
      const baseSpeed = config.INITIAL_SPAWN_RATE;
      const minSpeed = baseSpeed / modeConfig.maxSpeedMultiplier;

      // Reducir el tiempo entre spawns, pero no más allá del mínimo
      const newSpawnRate = Math.max(minSpeed, spawnRate * 0.9);
      dispatch(setSpawnRate(newSpawnRate));

      // Actualizar el intervalo de spawn
      if (spawnIntervalRef.current) {
        clearInterval(spawnIntervalRef.current);
        spawnIntervalRef.current = setInterval(addRandomIcon, newSpawnRate);
      }

      // Reproducir sonido de aumento de velocidad
      audioManager.play('speedUp');
    }, modeConfig.speedIncreaseTime);
  }, [dispatch, addRandomIcon, spawnRate, currentMode]);

  // Detener los temporizadores
  const stopTimers = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    
    if (spawnIntervalRef.current) {
      clearInterval(spawnIntervalRef.current);
      spawnIntervalRef.current = null;
    }
    
    if (speedIncreaseIntervalRef.current) {
      clearInterval(speedIncreaseIntervalRef.current);
      speedIncreaseIntervalRef.current = null;
    }
  }, []);

  // Mostrar pista
  const showHint = useCallback(() => {
    // Verificar que el tablero exista
    if (!board || !board.length) return null;
    
    // Buscar un movimiento válido
    for (let row = 0; row < boardSize; row++) {
      if (!board[row]) continue;
      
      for (let col = 0; col < boardSize; col++) {
        if (board[row][col] === undefined) continue;
        
        if (!board[row][col]) {
          const convergingIcons = findConvergingIcons(row, col);

          if (convergingIcons.length > 0) {
            // Reproducir sonido de pista
            audioManager.play('hint');
            
            // Devolver la pista encontrada
            return { 
              targetCell: { row, col }, 
              convergingIcons 
            };
          }
        }
      }
    }
    return null;
  }, [board, boardSize, findConvergingIcons]);

  // Inicializar tablero
  const initializeBoard = useCallback((size: number) => {
    // Marcar que el tablero no está inicializado
    isInitializedRef.current = false;
    
    // Crear tablero vacío
    const newBoard: (string | null)[][] = Array(size).fill(null).map(() => Array(size).fill(null));
    
    // Actualizar el tablero en Redux
    dispatch(updateBoard(newBoard));
    dispatch(setIconCount(0));
    
    // Ahora marcar el tablero como inicializado para que addRandomIcon pueda funcionar
    isInitializedRef.current = true;
    
    // Añadir iconos iniciales
    let attempts = 0;
    const maxAttempts = 10;
    
    // Solo intentar añadir iconos si el tablero está correctamente inicializado
    setTimeout(() => {
      try {
        do {
          // Limpiar el tablero
          const emptyBoard: (string | null)[][] = Array(size).fill(null).map(() => Array(size).fill(null));
          dispatch(updateBoard(emptyBoard));
          dispatch(setIconCount(0));
          
          // Añadir iconos iniciales
          for (let i = 0; i < config.INITIAL_ICONS; i++) {
            addRandomIcon();
          }
          
          attempts++;
          
        } while (!hasValidMoves() && attempts < maxAttempts);
        
        // Si no hay movimientos válidos después de varios intentos, forzar movimientos
        if (!hasValidMoves()) {
          logger.warn('Game', 'No se pudo generar un tablero con movimientos válidos.');
          forceValidMove();
        }
      } catch (error) {
        logger.error('Game', 'Error durante la inicialización del tablero', error);
      }
    }, 100);
  }, [dispatch, addRandomIcon, hasValidMoves]);

  // Forzar un movimiento válido
  const forceValidMove = useCallback(() => {
    // Verificar que el tablero exista
    if (!board || !board.length) return;
    
    // Buscar una celda vacía
    const emptyCells: { row: number, col: number }[] = [];
    
    for (let row = 0; row < boardSize; row++) {
      if (!board[row]) continue;
      
      for (let col = 0; col < boardSize; col++) {
        if (board[row][col] === undefined) continue;
        
        if (!board[row][col]) {
          emptyCells.push({ row, col });
        }
      }
    }
    
    if (emptyCells.length === 0) return;
    
    // Seleccionar una celda vacía aleatoria
    const randomIndex = Math.floor(Math.random() * emptyCells.length);
    const { row, col } = emptyCells[randomIndex];
    
    // Buscar celdas adyacentes
    const directions = [
      { dr: -1, dc: 0 }, // Arriba
      { dr: 0, dc: 1 },  // Derecha
      { dr: 1, dc: 0 },  // Abajo
      { dr: 0, dc: -1 }, // Izquierda
    ];
    
    // Colocar iconos iguales en al menos dos direcciones adyacentes
    let iconPlaced = 0;
    const randomIcon = availableIcons[Math.floor(Math.random() * availableIcons.length)];
    const newBoard = [...board.map(r => Array.isArray(r) ? [...r] : [])];
    
    for (const { dr, dc } of directions) {
      const newRow = row + dr;
      const newCol = col + dc;
      
      if (isValidCell(newRow, newCol, boardSize) && 
          newBoard[newRow] && 
          newBoard[newRow][newCol] !== undefined && 
          !newBoard[newRow][newCol] && 
          iconPlaced < 2) {
        newBoard[newRow][newCol] = randomIcon;
        iconPlaced++;
      }
    }
    
    // Actualizar el tablero si se colocaron iconos
    if (iconPlaced > 0) {
      dispatch(updateBoard(newBoard));
      dispatch(setIconCount(iconCount + iconPlaced));
    }
  }, [board, boardSize, availableIcons, iconCount, dispatch]);

  // Control de los estados del juego
  useEffect(() => {
    if (status === 'playing') {
      startTimers();
      // Iniciar música de fondo
      audioManager.startMusic();
    } else {
      stopTimers();
      if (status === 'gameOver') {
        // Detener música de fondo
        audioManager.pauseMusic();
      }
    }
    
    return () => {
      stopTimers();
    };
  }, [status, startTimers, stopTimers]);

  return {
    handleCellClick,
    addRandomIcon,
    showHint,
    initializeBoard,
    startTimers,
    stopTimers,
    hasValidMoves,
    findConvergingIcons
  };
};

export default useGameLogic; 