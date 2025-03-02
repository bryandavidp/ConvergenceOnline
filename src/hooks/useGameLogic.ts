import { useCallback, useEffect, useRef, useState } from 'react';
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
import { isValidCell, getRandomInt, shuffleArray, hasValidMoves } from '../utils/gameUtils';
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
    currentMode,
    level,
    score
  } = useSelector((state: RootState) => state.game);
  
  // Usar estado React en lugar de useRef para que persista entre renderizados
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  
  // Referencias para los intervalos de tiempo
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const spawnIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const speedIncreaseIntervalRef = useRef<NodeJS.Timeout | null>(null);

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
      { dr: -1, dc: 0 }, // Arriba
      { dr: 0, dc: 1 },  // Derecha
      { dr: 1, dc: 0 },  // Abajo
      { dr: 0, dc: -1 }, // Izquierda
    ];
    
    // Agrupar por tipo de icono
    const iconsByType: Record<string, {row: number, col: number}[]> = {};
    
    // Para cada dirección, buscar el primer icono
    for (const { dr, dc } of directions) {
      let r = row + dr;
      let c = col + dc;
      
      // Seguir en esa dirección hasta encontrar un icono o salir del tablero
      while (isValidCell(r, c, boardSize)) {
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
  
  // Función para iniciar todos los temporizadores del juego
  const startTimers = useCallback(() => {
    // Evitar iniciar temporizadores si ya están activos
    if (timerIntervalRef.current || spawnIntervalRef.current) {
      logger.debug('useGameLogic', 'Los temporizadores ya están activos, no se inician de nuevo');
      return;
    }
    
    logger.info('useGameLogic', 'Iniciando temporizadores del juego');
    
    if (!isInitialized || !board || board.length === 0) {
      logger.warn('useGameLogic', 'No se pueden iniciar temporizadores: tablero no inicializado');
      return;
    }
    
    // Temporizador para incrementar el tiempo de juego
    timerIntervalRef.current = setInterval(() => {
      dispatch(incrementTimer());
    }, 1000);
    
    // Temporizador para añadir nuevos iconos
    spawnIntervalRef.current = setInterval(() => {
      // Añadir un nuevo icono aleatorio
      if (status === 'playing') {
        _addRandomIcon();
      }
    }, Math.min(1000, spawnRate));
    
    // Temporizador para aumentar la velocidad gradualmente
    const speedIncreaseTime = config.DIFFICULTY_LEVELS[currentMode === 'tutorial' ? 'TUTORIAL' : currentMode.toUpperCase()]?.speedIncreaseTime || 30000;
    
    speedIncreaseIntervalRef.current = setInterval(() => {
      if (status === 'playing') {
        _increaseSpeed();
      }
    }, speedIncreaseTime);
    
  }, [dispatch, spawnRate, status, currentMode, board, isInitialized]);
  
  // Función para detener todos los temporizadores
  const stopTimers = useCallback(() => {
    // Solo registrar si hay temporizadores activos
    if (timerIntervalRef.current || spawnIntervalRef.current || speedIncreaseIntervalRef.current) {
      logger.info('useGameLogic', 'Deteniendo temporizadores del juego');
    }
    
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
  
  // Funciones internas para evitar dependencias circulares
  // Estas funciones no son memoizadas para evitar referencias circulares
  const _increaseSpeed = () => {
    try {
      // Reproducir sonido
      audioManager.play('speedUp');
      
      // Calcular la nueva velocidad (más rápido = valor más bajo)
      const baseSpeed = config.INITIAL_SPAWN_RATE;
      const maxSpeedMultiplier = config.DIFFICULTY_LEVELS[currentMode.toUpperCase()]?.maxSpeedMultiplier || 2;
      const minSpeed = baseSpeed / maxSpeedMultiplier;
      
      // Reducir el tiempo entre spawns, pero no más allá del mínimo
      const newSpawnRate = Math.max(minSpeed, spawnRate * 0.9);
      
      // Actualizar la velocidad en el store
      dispatch(setSpawnRate(newSpawnRate));
      
      // Reiniciar el intervalo de spawn con la nueva velocidad
      if (spawnIntervalRef.current) {
        clearInterval(spawnIntervalRef.current);
        spawnIntervalRef.current = setInterval(() => {
          if (status === 'playing') {
            _addRandomIcon();
          }
        }, newSpawnRate);
      }
      
      // Calcular y mostrar el multiplicador actual
      const currentSpeedMultiplier = (baseSpeed / newSpawnRate).toFixed(1);
      logger.info('useGameLogic', `Velocidad incrementada a ${currentSpeedMultiplier}x`);
      
    } catch (error) {
      logger.error('useGameLogic', 'Error al aumentar la velocidad', { error });
    }
  };
  
  // Función para añadir un icono aleatorio al tablero
  const _addRandomIcon = () => {
    try {
      if (!board || board.length === 0 || !isInitialized) {
        logger.warn('useGameLogic', 'El tablero no está inicializado');
        return false;
      }
      
      // Verificar que el estado del juego sea 'playing'
      if (status !== 'playing') {
        logger.debug('useGameLogic', 'No se puede añadir icono, juego no está en curso', { status });
        return false;
      }
      
      // Encontrar todas las celdas vacías
      const emptyCells: {row: number, col: number}[] = [];
      for (let row = 0; row < boardSize; row++) {
        for (let col = 0; col < boardSize; col++) {
          if (board[row][col] === null) {
            emptyCells.push({ row, col });
          }
        }
      }
      
      // Si no hay celdas vacías, el juego termina
      if (emptyCells.length === 0) {
        logger.info('useGameLogic', 'Tablero lleno. Game Over.');
        dispatch(setGameStatus('gameOver'));
        stopTimers();
        return false;
      }
      
      // Seleccionar una celda vacía aleatoria
      const randomIndex = Math.floor(Math.random() * emptyCells.length);
      const { row, col } = emptyCells[randomIndex];
      
      // Seleccionar un icono aleatorio
      const randomIcon = availableIcons[Math.floor(Math.random() * availableIcons.length)];
      
      // Crear una copia del tablero y añadir el nuevo icono
      const newBoard = board.map(row => [...row]);
      newBoard[row][col] = randomIcon;
      
      // Actualizar el tablero y el contador de iconos
      dispatch(updateBoard(newBoard));
      dispatch(setIconCount(iconCount + 1));
      
      // Reproducir sonido de nuevo icono
      audioManager.play('newIcon');
      
      logger.debug('useGameLogic', 'Nuevo icono añadido', { posición: {row, col}, icono: randomIcon, total: iconCount + 1 });
      
      // Verificar si todavía hay movimientos posibles
      if (!hasValidMoves(newBoard, boardSize)) {
        logger.info('useGameLogic', 'No hay movimientos válidos después de añadir un icono.');
        
        // Verificar si el juego está en curso para evitar cambios de estado incorrectos
        if (status === 'playing') {
          dispatch(setGameStatus('gameOver'));
          stopTimers();
          audioManager.play('gameOver');
        }
        
        return false;
      }
      
      return true;
    } catch (error) {
      logger.error('useGameLogic', 'Error al añadir icono aleatorio', { error });
      return false;
    }
  };
  
  // Versiones memoizadas para usar externamente
  const increaseSpeed = useCallback(() => _increaseSpeed(), []);
  const addRandomIcon = useCallback(() => _addRandomIcon(), []);
  
  // Implementación completa de initializeBoard
  const initializeBoard = useCallback((size: number) => {
    try {
      // Detener temporizadores existentes
      stopTimers();
      
      // Marcar como no inicializado mientras se configura
      setIsInitialized(false);
      
      logger.info('useGameLogic', `Inicializando tablero de tamaño ${size}x${size}`);
      
      // Crear un tablero vacío
      const newBoard: (string | null)[][] = Array(size).fill(null).map(() => Array(size).fill(null));
      
      // Actualizar el tablero en Redux
      dispatch(updateBoard(newBoard));
      dispatch(setIconCount(0));
      
      // Colocar iconos iniciales para garantizar movimientos válidos
      const boardWithIcons = [...newBoard.map(row => [...row])];
      
      // Añadir iconos iniciales estratégicamente
      const initialIconsCount = config.INITIAL_ICONS || 2;
      const placedIcons: {row: number, col: number}[] = [];
      
      // Asegurarse de colocar al menos un par del mismo tipo para garantizar un movimiento válido
      const randomIcon = availableIcons[Math.floor(Math.random() * availableIcons.length)];
      
      // Colocar iconos del mismo tipo en posiciones opuestas
      const centerRow = Math.floor(size / 2);
      const centerCol = Math.floor(size / 2);
      
      // Primer icono: arriba del centro
      if (centerRow > 0) {
        boardWithIcons[centerRow - 1][centerCol] = randomIcon;
        placedIcons.push({ row: centerRow - 1, col: centerCol });
      }
      
      // Segundo icono: abajo del centro
      if (centerRow < size - 1) {
        boardWithIcons[centerRow + 1][centerCol] = randomIcon;
        placedIcons.push({ row: centerRow + 1, col: centerCol });
      }
      
      // Colocar iconos adicionales aleatoriamente
      for (let i = placedIcons.length; i < initialIconsCount; i++) {
        // Encontrar una celda vacía aleatoria
        const emptyCells: {row: number, col: number}[] = [];
        for (let row = 0; row < size; row++) {
          for (let col = 0; col < size; col++) {
            if (boardWithIcons[row][col] === null) {
              emptyCells.push({ row, col });
            }
          }
        }
        
        if (emptyCells.length === 0) break;
        
        // Seleccionar una celda vacía aleatoria
        const randomIndex = Math.floor(Math.random() * emptyCells.length);
        const { row, col } = emptyCells[randomIndex];
        
        // Seleccionar un icono aleatorio
        const icon = availableIcons[Math.floor(Math.random() * availableIcons.length)];
        
        // Colocar el icono
        boardWithIcons[row][col] = icon;
        placedIcons.push({ row, col });
      }
      
      // Actualizar el tablero con los iconos iniciales
      dispatch(updateBoard(boardWithIcons));
      dispatch(setIconCount(placedIcons.length));
      
      // Marcar como inicializado
      setIsInitialized(true);
      logger.info('useGameLogic', 'Tablero inicializado correctamente');
      
      // Los temporizadores se iniciarán automáticamente por el efecto que observa status e isInitialized
      
      // Generar algunos iconos adicionales al inicio para asegurar que el tablero tenga suficientes iconos
      if (status === 'playing') {
        setTimeout(() => {
          // Verificar que el juego siga en curso cuando se ejecute el timeout
          if (status === 'playing' && isInitialized) {
            // Añadir 3 iconos aleatorios con un pequeño retraso entre ellos
            for (let i = 0; i < 3; i++) {
              setTimeout(() => {
                if (status === 'playing' && isInitialized) {
                  _addRandomIcon(); // Usar función interna directamente
                }
              }, i * 300);
            }
          }
        }, 800);
      }
      
      return true;
    } catch (error) {
      logger.error('useGameLogic', 'Error al inicializar el tablero', { error });
      setIsInitialized(false);
      return false;
    }
  }, [dispatch, availableIcons, status, stopTimers]);
  
  // Función para manejar clics en celdas
  const handleCellClick = useCallback((row: number, col: number) => {
    try {
      // Verificar si el juego está en curso y el tablero está inicializado
      if (status !== 'playing' || !isInitialized) {
        logger.debug('useGameLogic', 'Clic ignorado, juego no está en curso o tablero no inicializado', { status, isInitialized });
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
      
      // Reproducir sonido de clic
      audioManager.play('click');
      
      // Encontrar iconos convergentes
      const convergingIcons = findConvergingIcons(row, col);
      
      // Si no hay iconos convergentes, reproducir error y aplicar penalización
      if (convergingIcons.length === 0) {
        logger.debug('useGameLogic', 'Intento fallido', { posición: {row, col}, mensaje: 'No hay iconos convergentes' });
        audioManager.play('error');
        
        // Penalizar al jugador añadiendo un nuevo icono
        addRandomIcon(); // Usar la versión memoizada
        
        return;
      }
      
      // Si hay iconos convergentes, reproducir sonido de éxito
      audioManager.play('converge');
      
      // Crear una copia del tablero para modificar
      const newBoard = board.map(row => [...row]);
      
      // Eliminar los iconos convergentes
      for (const { row: r, col: c } of convergingIcons) {
        newBoard[r][c] = null;
      }
      
      // Actualizar el tablero
      dispatch(updateBoard(newBoard));
      
      // Incrementar la puntuación (10 puntos por cada icono)
      const pointsEarned = convergingIcons.length * 10 * (1 + (level * 0.1));
      dispatch(incrementScore(Math.floor(pointsEarned)));
      
      // Actualizar el contador de iconos
      const newIconCount = iconCount - convergingIcons.length;
      dispatch(setIconCount(newIconCount));
      
      // Mostrar log con información de la jugada
      logger.info('useGameLogic', 'Jugada exitosa', { 
        posición: {row, col}, 
        iconosConvergentes: convergingIcons.length,
        puntosGanados: Math.floor(pointsEarned),
        iconosRestantes: newIconCount
      });

      // Verificar si hay movimientos válidos después de la convergencia
      if (!hasValidMoves(newBoard, boardSize)) {
        // Si no hay movimientos válidos pero aún hay iconos, es game over
        if (newIconCount > 0) {
          logger.info('useGameLogic', 'Fin del juego: no hay movimientos posibles', { iconosRestantes: newIconCount });
          dispatch(setGameStatus('gameOver'));
          stopTimers();
          audioManager.play('gameOver');
        } else {
          // Si se han eliminado todos los iconos, nivel completado
          logger.info('useGameLogic', 'Nivel completado');
          dispatch(setGameStatus('levelCompleted'));
          stopTimers();
          audioManager.play('levelComplete');
        }
      } else if (newIconCount <= 0) {
        // Si se han eliminado todos los iconos pero aún hay posibles movimientos, nivel completado
        logger.info('useGameLogic', 'Nivel completado');
        dispatch(setGameStatus('levelCompleted'));
        stopTimers();
        audioManager.play('levelComplete');
      }
    } catch (error) {
      logger.error('useGameLogic', 'Error al procesar clic', { row, col, error });
      // No propagar el error para que la UI no se rompa
    }
  }, [status, board, boardSize, iconCount, dispatch, findConvergingIcons, level, stopTimers, isInitialized, addRandomIcon]);

  // Efecto para reiniciar el estado cuando cambia el status
  useEffect(() => {
    if (status === 'playing' && isInitialized) {
      // Solo iniciar temporizadores si el juego está en curso y el tablero inicializado
      startTimers();
    } else if (status !== 'playing') {
      // Si el juego no está en curso, detener los temporizadores
      stopTimers();
    }
  }, [status, isInitialized, startTimers, stopTimers]);

  // Función para mostrar una pista al jugador
  const showHint = useCallback(() => {
    try {
      if (status !== 'playing' || !isInitialized) {
        logger.debug('useGameLogic', 'No se puede mostrar pista, juego no está en curso o tablero no inicializado');
        return false;
      }
      
      // Buscar un movimiento válido
      for (let row = 0; row < boardSize; row++) {
        for (let col = 0; col < boardSize; col++) {
          if (board[row][col] === null) {
            const convergingIcons = findConvergingIcons(row, col);
            
            if (convergingIcons.length > 0) {
              logger.debug('useGameLogic', 'Pista encontrada', { row, col, icons: convergingIcons });
              
              // Reproducir sonido de pista
              audioManager.play('hint');
              
              // Retornar la información de la pista para que la UI pueda mostrarla
              return { 
                targetCell: { row, col }, 
                convergingIcons 
              };
            }
          }
        }
      }
      
      logger.debug('useGameLogic', 'No se encontraron pistas disponibles');
      return null;
    } catch (error) {
      logger.error('useGameLogic', 'Error al buscar pista', { error });
      return null;
    }
  }, [status, boardSize, board, findConvergingIcons, isInitialized]);

  return {
    handleCellClick,
    showHint,
    findConvergingIcons,
    initializeBoard,
    startTimers,
    stopTimers,
    addRandomIcon,
    increaseSpeed,
    isInitialized
  };
};