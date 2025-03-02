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
import * as config from '../utils/config';
import { isValidCell, getRandomInt, shuffleArray } from '../utils/gameUtils';
import { audioManager } from '../utils/audioManager';

const useGameLogic = () => {
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

  // Función para verificar si hay iconos convergentes
  const findConvergingIcons = useCallback((row: number, col: number): {row: number, col: number}[] => {
    if (!board || board.length === 0 || !isValidCell(row, col, boardSize)) {
      return [];
    }
    
    // Si la celda no está vacía, no se puede hacer convergencia
    if (board[row][col] !== null) {
      return [];
    }
    
    const visited = new Set<string>();
    const convergingIcons: {row: number, col: number}[] = [];
    
    // Direcciones: arriba, derecha, abajo, izquierda
    const directions = [
      { dr: -1, dc: 0 },  // Arriba
      { dr: 0, dc: 1 },   // Derecha
      { dr: 1, dc: 0 },   // Abajo
      { dr: 0, dc: -1 },  // Izquierda
    ];

    // Para cada dirección, buscar iconos del mismo tipo
    const iconsByType: Record<string, {row: number, col: number}[]> = {};

    for (const { dr, dc } of directions) {
      let r = row + dr;
      let c = col + dc;

      // Seguir en esa dirección hasta encontrar un icono o salir del tablero
      while (isValidCell(r, c, boardSize) && board[r] && board[r][c] !== undefined) {
        const key = `${r},${c}`;
        
        // Si encontramos un ícono y no lo hemos visitado antes
        if (board[r][c] !== null && !visited.has(key)) {
          const icon = board[r][c] as string;
          visited.add(key);
          
          // Inicializar el array para este tipo de ícono si no existe
          if (!iconsByType[icon]) {
            iconsByType[icon] = [];
          }
          
          // Agregar esta celda a las celdas de este tipo de ícono
          iconsByType[icon].push({ row: r, col: c });
          
          // No seguir buscando en esta dirección después de encontrar un ícono
          break;
        }
        
        // Si la celda está vacía, continuar en esa dirección
        r += dr;
        c += dc;
      }
    }

    // Buscar el tipo de ícono con más de una ocurrencia (convergencia)
    for (const icon in iconsByType) {
      if (iconsByType[icon].length > 1) {
        // Agregar todas las celdas de este tipo a la lista de convergencia
        convergingIcons.push(...iconsByType[icon]);
      }
    }

    return convergingIcons;
  }, [board, boardSize]);
  
  // Función para detener los temporizadores
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
    
    logger.debug('useGameLogic', 'Temporizadores detenidos');
  }, []);

  // Función para iniciar/detener los temporizadores
  const startTimers = useCallback(() => {
    stopTimers();
    
    // Temporizador de tiempo de juego
    timerIntervalRef.current = setInterval(() => {
      dispatch(incrementTimer());
    }, 1000);
    
    // Temporizador para generar nuevos iconos
    spawnIntervalRef.current = setInterval(() => {
      // Lógica para generar nuevos iconos
      if (status === 'playing' && board && board.length > 0) {
        // Buscar celdas vacías
        const emptyCells: {row: number, col: number}[] = [];
        for (let r = 0; r < boardSize; r++) {
          for (let c = 0; c < boardSize; c++) {
            if (board[r][c] === null) {
              emptyCells.push({ row: r, col: c });
            }
          }
        }
        
        // Si hay celdas vacías, colocar un icono nuevo
        if (emptyCells.length > 0) {
          // Elegir una celda aleatoria
          const randomIndex = Math.floor(Math.random() * emptyCells.length);
          const { row, col } = emptyCells[randomIndex];
          
          // Elegir un icono aleatorio
          const randomIcon = availableIcons[Math.floor(Math.random() * availableIcons.length)];
          
          // Crear una copia del tablero y añadir el nuevo icono
          const newBoard = board.map(row => [...row]);
          newBoard[row][col] = randomIcon;
          
          // Actualizar el tablero y el contador de iconos
          dispatch(updateBoard(newBoard));
          dispatch(setIconCount(iconCount + 1));
          
          // Reproducir sonido
          audioManager.play('newIcon');
          
          logger.debug('useGameLogic', 'Nuevo icono generado', { row, col, icon: randomIcon });
        }
      }
    }, spawnRate * 1000);
    
    // Temporizador para incrementar la velocidad gradualmente (solo en modo normal)
    if (currentMode === 'normal' && speedIncreaseIntervalRef.current === null) {
      speedIncreaseIntervalRef.current = setInterval(() => {
        if (status === 'playing') {
          // Aumentar la velocidad cada cierto tiempo
          const newSpawnRate = Math.max(spawnRate * 0.95, config.SPAWN_RATES.SUPER_FAST);
          
          if (newSpawnRate !== spawnRate) {
            dispatch(setSpawnRate(newSpawnRate));
            audioManager.play('speedUp');
            
            // Reiniciar el temporizador de spawn con la nueva velocidad
            if (spawnIntervalRef.current) {
              clearInterval(spawnIntervalRef.current);
              spawnIntervalRef.current = setInterval(() => {
                // La misma lógica que arriba pero con la nueva velocidad
                if (status === 'playing' && board && board.length > 0) {
                  const emptyCells: {row: number, col: number}[] = [];
                  for (let r = 0; r < boardSize; r++) {
                    for (let c = 0; c < boardSize; c++) {
                      if (board[r][c] === null) {
                        emptyCells.push({ row: r, col: c });
                      }
                    }
                  }
                  
                  if (emptyCells.length > 0) {
                    const randomIndex = Math.floor(Math.random() * emptyCells.length);
                    const { row, col } = emptyCells[randomIndex];
                    const randomIcon = availableIcons[Math.floor(Math.random() * availableIcons.length)];
                    const newBoard = board.map(row => [...row]);
                    newBoard[row][col] = randomIcon;
                    dispatch(updateBoard(newBoard));
                    dispatch(setIconCount(iconCount + 1));
                    audioManager.play('newIcon');
                  }
                }
              }, newSpawnRate * 1000);
            }
          }
        }
      }, 30000); // Aumentar velocidad cada 30 segundos
    }
    
    logger.debug('useGameLogic', 'Temporizadores iniciados', { spawnRate });
  }, [dispatch, spawnRate, status, board, boardSize, availableIcons, iconCount, currentMode, stopTimers]);

  // Efecto para detener temporizadores al desmontar o cambiar de estado
  useEffect(() => {
    // Iniciar temporizadores cuando el juego está en curso
    if (status === 'playing') {
      startTimers();
    } else {
      stopTimers();
    }
    
    // Limpiar temporizadores al desmontar el componente
    return () => {
      stopTimers();
    };
  }, [status, startTimers, stopTimers]);

  // Función para mostrar una pista
  const showHint = useCallback(() => {
    try {
      // Verificar si el juego está en curso
      if (status !== 'playing' || !board || board.length === 0) {
        return null;
      }
      
      // Buscar todas las celdas vacías
      const emptyCells: {row: number, col: number}[] = [];
      for (let r = 0; r < boardSize; r++) {
        for (let c = 0; c < boardSize; c++) {
          if (board[r][c] === null) {
            emptyCells.push({ row: r, col: c });
          }
        }
      }
      
      // Mezclar para dar una pista aleatoria si hay varias posibilidades
      shuffleArray(emptyCells);
      
      // Buscar la primera celda vacía que tenga convergencia
      for (const { row, col } of emptyCells) {
        const convergingIcons = findConvergingIcons(row, col);
        if (convergingIcons.length > 0) {
          return {
            targetCell: { row, col },
            convergingIcons
          };
        }
      }
      
      // Si no hay pistas disponibles
      return null;
    } catch (error) {
      logger.error('useGameLogic', 'Error al buscar pista', { error });
      return null;
    }
  }, [status, board, boardSize, findConvergingIcons]);

  // Implementación completa de initializeBoard
  const initializeBoard = useCallback((size: number) => {
    // Detener temporizadores existentes
    stopTimers();
    
    logger.info('useGameLogic', `Inicializando tablero de tamaño ${size}x${size}`);
    
    try {
      // Crear un tablero vacío
      const newBoard: (string | null)[][] = Array(size).fill(null).map(() => Array(size).fill(null));
      
      // Actualizar el tablero en Redux
      dispatch(updateBoard(newBoard));
      dispatch(setIconCount(0));
      
      // Añadir algunos iconos iniciales para que haya movimientos válidos
      setTimeout(() => {
        // Colocar al menos dos iconos del mismo tipo para garantizar un movimiento inicial
        const centerRow = Math.floor(size / 2);
        const centerCol = Math.floor(size / 2);
        
        // Elegir un icono aleatorio
        const randomIcon = availableIcons[Math.floor(Math.random() * availableIcons.length)];
        
        // Crear una copia del tablero
        const boardWithIcons = newBoard.map(row => [...row]);
        
        // Colocar dos iconos del mismo tipo en posiciones estratégicas
        if (centerRow > 0) boardWithIcons[centerRow - 1][centerCol] = randomIcon;
        if (centerRow < size - 1) boardWithIcons[centerRow + 1][centerCol] = randomIcon;
        
        // Actualizar el tablero con los iconos iniciales
        dispatch(updateBoard(boardWithIcons));
        dispatch(setIconCount(2)); // Al menos 2 iconos colocados
        
        // Iniciar temporizadores si el juego está en estado 'playing'
        if (status === 'playing') {
          startTimers();
        }
      }, 300);
    } catch (error) {
      logger.error('useGameLogic', 'Error al inicializar el tablero', { error });
    }
  }, [dispatch, availableIcons, status, startTimers, stopTimers]);

  // Función para manejar clics en celdas
  const handleCellClick = useCallback((row: number, col: number) => {
    try {
      // Verificar si el juego está en curso
      if (status !== 'playing') {
        logger.debug('useGameLogic', 'Clic ignorado, juego no está en curso', { status });
        return;
      }
      
      // Verificar validez de la celda
      if (!isValidCell(row, col, boardSize)) {
        logger.debug('useGameLogic', 'Celda inválida', { row, col, boardSize });
        return;
      }
      
      // Verificar si la celda ya está ocupada
      if (board[row][col] !== null) {
        logger.debug('useGameLogic', 'Celda ocupada', { row, col, value: board[row][col] });
        return;
      }
      
      // Encontrar iconos convergentes
      const convergingIcons = findConvergingIcons(row, col);
      
      // Si no hay iconos convergentes, reproducir error y aplicar penalización
      if (convergingIcons.length === 0) {
        logger.debug('useGameLogic', 'No hay iconos convergentes', { row, col });
        audioManager.play('error');
        
        // Generar un nuevo icono como penalización
        const emptyCells: {row: number, col: number}[] = [];
        for (let r = 0; r < boardSize; r++) {
          for (let c = 0; c < boardSize; c++) {
            if (board[r][c] === null && !(r === row && c === col)) {
              emptyCells.push({ row: r, col: c });
            }
          }
        }
        
        if (emptyCells.length > 0) {
          const randomIndex = Math.floor(Math.random() * emptyCells.length);
          const { row: penaltyRow, col: penaltyCol } = emptyCells[randomIndex];
          const randomIcon = availableIcons[Math.floor(Math.random() * availableIcons.length)];
          
          const newBoard = board.map(row => [...row]);
          newBoard[penaltyRow][penaltyCol] = randomIcon;
          
          // Actualizar el tablero y el contador de iconos
          dispatch(updateBoard(newBoard));
          dispatch(setIconCount(iconCount + 1));
          
          // Reproducir sonido de penalización
          audioManager.play('penalty');
          
          logger.debug('useGameLogic', 'Penalización aplicada', { 
            row: penaltyRow, col: penaltyCol, icon: randomIcon 
          });
        }
        
        return;
      }
      
      // Crear una copia del tablero para modificar
      const newBoard = board.map(row => [...row]);
      
      // Eliminar los iconos convergentes
      for (const { row: r, col: c } of convergingIcons) {
        newBoard[r][c] = null;
      }
      
      // Reproducir sonido de éxito
      audioManager.play('converge');
      
      // Actualizar el tablero
      dispatch(updateBoard(newBoard));
      
      // Incrementar la puntuación
      dispatch(incrementScore(convergingIcons.length * 10));
      
      // Actualizar el contador de iconos
      const newIconCount = iconCount - convergingIcons.length;
      dispatch(setIconCount(newIconCount));
      
      // Si se han eliminado todos los iconos, nivel completado
      if (newIconCount <= 0) {
        logger.info('useGameLogic', 'Nivel completado');
        dispatch(setGameStatus('levelCompleted'));
        stopTimers();
      }
      
      logger.debug('useGameLogic', 'Iconos convergentes eliminados', { 
        row, col, count: convergingIcons.length, remaining: newIconCount 
      });
    } catch (error) {
      logger.error('useGameLogic', 'Error al procesar clic', { row, col, error });
      // No propagar el error para que la UI no se rompa
    }
  }, [status, board, boardSize, iconCount, dispatch, findConvergingIcons, availableIcons]);

  return {
    handleCellClick,
    showHint,
    findConvergingIcons,
    initializeBoard,
    startTimers,
    stopTimers
  };
};

export default useGameLogic; 