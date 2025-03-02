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
import { createLogger } from '../utils/logUtils';
import * as config from '../utils/config';
import * as gameConfig from '../config/gameConfig';
import { isValidCell, getRandomInt, shuffleArray, hasValidMoves as checkValidMoves } from '../utils/gameUtils';
import { audioManager } from '../utils/audioManager';

// Crear un logger específico para este hook
const logger = createLogger('useGameLogic');

// Constantes para la configuración (si no están definidas en gameConfig)
const MIN_SPAWN_RATE = 800; // ms - Velocidad máxima (valores más bajos = más rápido)
const SPAWN_RATE_STEP = 100; // ms - Cuánto aumenta la velocidad en cada paso
const SPAWN_RATE_INCREASE_INTERVAL = 8000; // ms - Cada cuánto aumenta la velocidad
const INITIAL_ICONS = 3; // Número de iconos iniciales al comenzar el juego

const useGameLogic = () => {
  const dispatch = useDispatch();
  const { 
    board, 
    iconCount, 
    status, 
    spawnRate, 
    boardSize, 
    availableIcons,
    currentMode,
    score,
    level
  } = useSelector((state: RootState) => state.game);
  
  // Estado para celdas resaltadas durante una pista
  const [highlightedCells, setHighlightedCells] = useState<{row: number, col: number}[]>([]);
  
  // Referencias para los intervalos de tiempo
  const spawnTimerRef = useRef<NodeJS.Timeout | null>(null);
  const speedIncreaseTimerRef = useRef<NodeJS.Timeout | null>(null);
  const gameTimerRef = useRef<NodeJS.Timeout | null>(null);
  const timersActiveRef = useRef<boolean>(false);
  const isInitializedRef = useRef<boolean>(false);
  
  // Referencias para las celdas (similar a cellRefs en la clase Board)
  const cellRefsMapRef = useRef<Map<string, HTMLDivElement>>(new Map());
  
  // Registrar una celda para acceso rápido
  const registerCellRef = useCallback((row: number, col: number, element: HTMLDivElement | null) => {
    if (element) {
      const key = `${row},${col}`;
      cellRefsMapRef.current.set(key, element);
    }
  }, []);
  
  // Obtener el elemento DOM de una celda (similar a getCellElement)
  const getCellElement = useCallback((row: number, col: number): HTMLDivElement | null => {
    const key = `${row},${col}`;
    if (cellRefsMapRef.current.has(key)) {
      return cellRefsMapRef.current.get(key) || null;
    }
    
    // Fallback si no se encontró la referencia
    const element = document.querySelector(`[data-row="${row}"][data-col="${col}"]`) as HTMLDivElement;
    return element;
  }, []);
  
  // Calcular el tamaño de celda según el tamaño del tablero
  const calculateCellSize = useCallback((size: number) => {
    // Función simplificada, la lógica real estaría en CSS o en un util
    return Math.max(30, Math.min(80, Math.floor(500 / size) - 8));
  }, []);
  
  // Detectar si hay movimientos válidos
  const hasValidMoves = useCallback(() => {
    if (!board || board.length === 0) return false;
    
    return checkValidMoves(board, boardSize);
  }, [board, boardSize]);
  
  // Forzar la creación de un movimiento válido
  const forceValidMove = useCallback(() => {
    if (!board || board.length === 0) return;
    
    const moveLogger = logger.subcontext('ForzarMovimiento');
    moveLogger.info('Forzando la creación de un movimiento válido');
    
    // Buscar celdas vacías
    const emptyCells: {row: number, col: number}[] = [];
    for (let row = 0; row < boardSize; row++) {
      for (let col = 0; col < boardSize; col++) {
        if (!board[row][col]) {
          emptyCells.push({ row, col });
        }
      }
    }
    
    if (emptyCells.length === 0) {
      moveLogger.warn('No hay celdas vacías para forzar un movimiento');
      return;
    }
    
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
    const newBoard = [...board];
    
    for (const { dr, dc } of directions) {
      const newRow = row + dr;
      const newCol = col + dc;
      
      if (isValidCell(newRow, newCol, boardSize) && !board[newRow][newCol] && iconPlaced < 2) {
        // Actualizar el tablero en memoria
        newBoard[newRow] = [...newBoard[newRow]];
        newBoard[newRow][newCol] = randomIcon;
        
        // Efectos visuales se manejarán cuando React actualice el DOM
        iconPlaced++;
      }
    }
    
    if (iconPlaced > 0) {
      // Actualizar el estado global
      dispatch(updateBoard(newBoard));
      dispatch(setIconCount(iconCount + iconPlaced));
      moveLogger.info(`Colocados ${iconPlaced} iconos para crear un movimiento válido`);
      
      // Reproducir sonido
      audioManager.play('newIcon');
    }
  }, [board, boardSize, availableIcons, iconCount, dispatch]);
  
  // Generar un icono aleatorio en el tablero con verificación de movimientos
  const generateRandomIcon = useCallback((checkMoves = true) => {
    if (board.length === 0) return false;
    
    const gameStateLogger = logger.subcontext('Generador');
    
    try {
      // Verificar si el tablero está lleno
      if (iconCount >= boardSize * boardSize) {
        gameStateLogger.info('Tablero lleno, juego terminado', { 
          iconCount, 
          capacidadTotal: boardSize * boardSize 
        });
        
        if (status === 'playing') {
          audioManager.play('gameOver');
          dispatch(setGameStatus('gameOver'));
        }
        return false;
      }
      
      // Encontrar todas las celdas vacías
      const emptyCells: {row: number, col: number}[] = [];
      for (let row = 0; row < boardSize; row++) {
        for (let col = 0; col < boardSize; col++) {
          if (!board[row][col]) {
            emptyCells.push({ row, col });
          }
        }
      }
      
      // Si no hay celdas vacías, el juego termina
      if (emptyCells.length === 0) {
        gameStateLogger.info('No hay celdas vacías para colocar un icono. Game Over.');
        if (status === 'playing') {
          audioManager.play('gameOver');
          dispatch(setGameStatus('gameOver'));
        }
        return false;
      }
      
      // Seleccionar una celda vacía aleatoria
      const randomIndex = Math.floor(Math.random() * emptyCells.length);
      const { row, col } = emptyCells[randomIndex];
      
      // Seleccionar un icono aleatorio
      const randomIcon = availableIcons[Math.floor(Math.random() * availableIcons.length)];
      
      // Crear una copia del tablero y actualizar la celda
      const newBoard = [...board];
      newBoard[row] = [...newBoard[row]];
      newBoard[row][col] = randomIcon;
      
      // Actualizar en el store
      dispatch(updateBoard(newBoard));
      dispatch(setIconCount(iconCount + 1));
      
      // Reproducir sonido de nuevo icono
      audioManager.play('newIcon');
      
      gameStateLogger.debug('Nuevo icono generado', { 
        row, 
        col, 
        icon: randomIcon,
        iconosRestantes: (boardSize * boardSize) - (iconCount + 1)
      });
      
      // Verificar si hay movimientos válidos después de añadir el icono
      if (checkMoves && !hasValidMoves()) {
        gameStateLogger.info('No hay movimientos válidos después de añadir un icono. Forzando movimiento...');
        forceValidMove();
      }
      
      return true;
    } catch (error) {
      gameStateLogger.error('Error al generar icono aleatorio', error);
      return false;
    }
  }, [board, boardSize, availableIcons, iconCount, status, hasValidMoves, forceValidMove, dispatch]);
  
  // Encontrar iconos que convergen en una celda vacía
  const findConvergingIcons = useCallback((row: number, col: number) => {
    if (!board || board.length === 0 || !isValidCell(row, col, boardSize) || board[row][col] !== null) {
      return [];
    }
    
    const convergingIcons: {row: number, col: number, icon: string}[] = [];
    const visited = new Set<string>();
    
    // Buscar en las cuatro direcciones (arriba, derecha, abajo, izquierda)
    const directions = [
      { dr: -1, dc: 0 }, // Arriba
      { dr: 0, dc: 1 },  // Derecha
      { dr: 1, dc: 0 },  // Abajo
      { dr: 0, dc: -1 }, // Izquierda
    ];
    
    // Para cada dirección, buscar el primer icono
    const iconsByType: Record<string, {row: number, col: number}[]> = {};
    
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
        // Agregar el tipo de icono a cada objeto para facilitar la referencia
        iconsByType[icon].forEach(pos => {
          convergingIcons.push({ ...pos, icon });
        });
      }
    }
    
    return convergingIcons;
  }, [board, boardSize]);
  
  // Mostrar pista resaltando celdas con movimientos válidos
  const showHint = useCallback(() => {
    const hintLogger = logger.subcontext('Pista');
    
    // Primero limpiar cualquier resaltado anterior
    setHighlightedCells([]);
    
    // Buscar convergencias posibles
    for (let row = 0; row < boardSize; row++) {
      for (let col = 0; col < boardSize; col++) {
        if (!board[row][col]) {
          const convergingIcons = findConvergingIcons(row, col);
          if (convergingIcons.length > 0) {
            // Añadir la celda objetivo también
            const cellsToHighlight = [...convergingIcons.map(({ row, col }) => ({ row, col })), { row, col }];
            setHighlightedCells(cellsToHighlight);
            
            hintLogger.info('Pista mostrada', { 
              celdaObjetivo: { row, col }, 
              iconosConvergentes: convergingIcons.length 
            });
            
            // Reproducir sonido de pista
            audioManager.play('hint');
            
            // Solo mostrar la primera pista que encontremos
            return true;
          }
        }
      }
    }
    
    hintLogger.warn('No se encontraron movimientos para mostrar como pista');
    return false;
  }, [board, boardSize, findConvergingIcons]);
  
  // Aplicar penalización (añadir iconos aleatorios)
  const applyPenalty = useCallback(() => {
    const penaltyLogger = logger.subcontext('Penalización');
    
    // Obtener el número de iconos a añadir como penalización según la dificultad
    const penaltyIcons = gameConfig.DIFFICULTY_CONFIG[currentMode]?.penaltyIcons || 0;
    
    if (penaltyIcons <= 0) {
      penaltyLogger.debug('No hay penalización para este modo de juego', { mode: currentMode });
      return;
    }
    
    penaltyLogger.info(`Aplicando penalización: añadir ${penaltyIcons} iconos`, { mode: currentMode });
    
    // Añadir los iconos de penalización
    for (let i = 0; i < penaltyIcons; i++) {
      setTimeout(() => {
        generateRandomIcon(true);
      }, i * 300); // Añadir retardo para visualizar mejor la penalización
    }
  }, [currentMode, generateRandomIcon]);
  
  // Manejar click en celda
  const handleCellClick = useCallback((row: number, col: number) => {
    // Verificar si el juego está en curso y si la celda está dentro de los límites
    if (status !== 'playing' || !board || !isValidCell(row, col, boardSize)) {
      return;
    }
    
    const clickLogger = logger.subcontext('Click');
    
    // Verificar si la celda está vacía
    if (board[row][col] !== null) {
      clickLogger.debug('Click en celda ocupada, ignorando', { row, col, value: board[row][col] });
      return;
    }
    
    // Buscar iconos convergentes
    const convergingIcons = findConvergingIcons(row, col);
    
    if (convergingIcons.length > 0) {
      // Limpiar cualquier resaltado anterior
      setHighlightedCells([]);
      
      // Reproducir sonido de convergencia
      audioManager.play('convergence');
      
      // Crear una copia profunda del tablero
      const newBoard = JSON.parse(JSON.stringify(board));
      
      // Eliminar los iconos convergentes
      convergingIcons.forEach(({ row: r, col: c }) => {
        newBoard[r][c] = null;
      });
      
      // Colocar el icono en la celda objetivo
      const icon = convergingIcons[0].icon;
      newBoard[row][col] = icon;
      
      // Actualizar el tablero
      dispatch(updateBoard(newBoard));
      
      // Decrementar el contador de iconos por los eliminados (se eliminan los convergentes pero se añade uno nuevo)
      dispatch(setIconCount(iconCount - convergingIcons.length + 1));
      
      // Calcular y añadir puntuación
      const pointsEarned = gameConfig.calculateScore(convergingIcons.length, level);
      dispatch(incrementScore(pointsEarned));
      
      clickLogger.info('Convergencia exitosa', { 
        iconosEliminados: convergingIcons.length,
        iconoColocado: icon,
        puntos: pointsEarned
      });
      
      return true;
    } else {
      // No hay convergencia, aplicar penalización
      clickLogger.info('No hay convergencia posible en esta celda, aplicando penalización', { row, col });
      
      // Reproducir sonido de error y aplicar penalización
      audioManager.play('error');
      applyPenalty();
      
      // Resaltar brevemente la celda como inválida
      setHighlightedCells([{ row, col }]);
      
      // Quitar el resaltado después de un tiempo
      setTimeout(() => {
        setHighlightedCells([]);
      }, gameConfig.ANIMATION_CONFIG.hint);
      
      return false;
    }
  }, [board, boardSize, status, iconCount, level, findConvergingIcons, applyPenalty, dispatch]);
  
  // Iniciar los temporizadores del juego
  const startTimers = useCallback(() => {
    const timerLogger = logger.subcontext('Temporizadores');
    
    // Detener cualquier temporizador existente primero
    if (spawnTimerRef.current) clearInterval(spawnTimerRef.current);
    if (speedIncreaseTimerRef.current) clearInterval(speedIncreaseTimerRef.current);
    if (gameTimerRef.current) clearInterval(gameTimerRef.current);
    
    timerLogger.info('Iniciando temporizadores de juego', { 
      velocidadInicial: spawnRate,
      incrementoVelocidad: SPAWN_RATE_INCREASE_INTERVAL
    });
    
    // Activar flag para temporizadores
    timersActiveRef.current = true;
    
    // Temporizador para generar iconos aleatorios
    spawnTimerRef.current = setInterval(() => {
      if (status === 'playing' && timersActiveRef.current) {
        generateRandomIcon();
      }
    }, spawnRate);
    
    // Temporizador para incrementar la velocidad gradualmente
    speedIncreaseTimerRef.current = setInterval(() => {
      if (status === 'playing' && timersActiveRef.current) {
        // Solo reducir si no hemos llegado al mínimo
        if (spawnRate > MIN_SPAWN_RATE) {
          const newSpawnRate = Math.max(MIN_SPAWN_RATE, spawnRate - SPAWN_RATE_STEP);
          dispatch(setSpawnRate(newSpawnRate));
          
          timerLogger.info('Velocidad incrementada', {
            anterior: spawnRate,
            nueva: newSpawnRate
          });
          
          // Actualizar el temporizador de spawn con la nueva velocidad
          if (spawnTimerRef.current) {
            clearInterval(spawnTimerRef.current);
            spawnTimerRef.current = setInterval(() => {
              if (status === 'playing' && timersActiveRef.current) {
                generateRandomIcon();
              }
            }, newSpawnRate);
          }
        }
      }
    }, SPAWN_RATE_INCREASE_INTERVAL);
    
    // Temporizador para el tiempo de juego
    gameTimerRef.current = setInterval(() => {
      if (status === 'playing' && timersActiveRef.current) {
        dispatch(incrementTimer());
      }
    }, 1000);
  }, [status, spawnRate, generateRandomIcon, dispatch]);
  
  // Detener todos los temporizadores
  const stopTimers = useCallback(() => {
    const timerLogger = logger.subcontext('Temporizadores');
    timerLogger.info('Deteniendo todos los temporizadores');
    
    if (spawnTimerRef.current) {
      clearInterval(spawnTimerRef.current);
      spawnTimerRef.current = null;
    }
    
    if (speedIncreaseTimerRef.current) {
      clearInterval(speedIncreaseTimerRef.current);
      speedIncreaseTimerRef.current = null;
    }
    
    if (gameTimerRef.current) {
      clearInterval(gameTimerRef.current);
      gameTimerRef.current = null;
    }
    
    timersActiveRef.current = false;
  }, []);
  
  // Añadir iconos iniciales al tablero
  const addInitialIcons = useCallback(() => {
    const initLogger = logger.subcontext('Inicialización');
    initLogger.info(`Añadiendo ${INITIAL_ICONS} iconos iniciales`);
    
    let attempts = 0;
    const maxAttempts = 10;
    
    do {
      // Reiniciar el tablero
      const newBoard = Array(boardSize).fill(null).map(() => Array(boardSize).fill(null));
      dispatch(updateBoard(newBoard));
      dispatch(setIconCount(0));
      
      // Añadir iconos iniciales
      for (let i = 0; i < INITIAL_ICONS; i++) {
        generateRandomIcon(false);
      }
      
      attempts++;
      
      if (!hasValidMoves()) {
        initLogger.warn(`No hay movimientos válidos. Reintento ${attempts}/${maxAttempts}`);
      }
      
    } while (!hasValidMoves() && attempts < maxAttempts);
    
    if (!hasValidMoves()) {
      initLogger.warn('No se pudo generar un tablero con movimientos válidos. Forzando movimiento...');
      forceValidMove();
    }
  }, [boardSize, generateRandomIcon, hasValidMoves, forceValidMove, dispatch]);
  
  // Inicializar el tablero
  const initializeBoard = useCallback((size: number) => {
    const boardLogger = logger.subcontext('Inicialización');
    
    // Crear un tablero vacío
    const newBoard = Array(size).fill(null).map(() => Array(size).fill(null));
    
    // Actualizar el tablero en el store
    dispatch(updateBoard(newBoard));
    
    // Restablecer el contador de iconos
    dispatch(setIconCount(0));
    
    // Restablecer la velocidad de spawn inicial según el modo de juego
    let initialSpawnRate = 3000; // Valor por defecto
    
    switch(currentMode) {
      case 'easy':
        initialSpawnRate = gameConfig.DIFFICULTY_CONFIG.easy.spawnRate;
        break;
      case 'normal':
        initialSpawnRate = gameConfig.DIFFICULTY_CONFIG.normal.spawnRate;
        break;
      case 'hard':
        initialSpawnRate = gameConfig.DIFFICULTY_CONFIG.hard.spawnRate;
        break;
      case 'tutorial':
        initialSpawnRate = gameConfig.DIFFICULTY_CONFIG.tutorial.spawnRate;
        break;
    }
    
    dispatch(setSpawnRate(initialSpawnRate));
    
    boardLogger.info('Tablero inicializado', { 
      size,
      celdas: size * size,
      nivel: level,
      modo: currentMode,
      velocidadInicial: initialSpawnRate
    });
    
    // Añadir iconos iniciales
    setTimeout(() => {
      addInitialIcons();
    }, 500);
    
    return newBoard;
  }, [dispatch, level, currentMode, addInitialIcons]);
  
  // Efecto para manejar el inicio y parada de temporizadores basado en el estado del juego
  useEffect(() => {
    const timerLogger = logger.subcontext('Temporizadores');
    
    if (status === 'playing') {
      timerLogger.info('Iniciando temporizadores debido al cambio de estado', { 
        estadoActual: status,
        modoJuego: currentMode,
        nivel: level,
        velocidad: spawnRate
      });
      startTimers();
      
      // Añadir iconos iniciales si el tablero está vacío y no se ha inicializado
      if (!isInitializedRef.current && board.every(row => row.every(cell => cell === null))) {
        isInitializedRef.current = true;
        addInitialIcons();
      }
    } else if (status === 'paused' || status === 'gameOver' || status === 'levelCompleted') {
      timerLogger.info('Deteniendo temporizadores debido al cambio de estado', { 
        estadoActual: status
      });
      stopTimers();
    }
    
    // Limpiar al desmontar
    return () => {
      timerLogger.debug('Limpiando temporizadores en la limpieza del efecto');
      stopTimers();
    };
  }, [status, startTimers, stopTimers, currentMode, level, spawnRate, board, addInitialIcons]);
  
  // Reiniciar el flag cuando cambia el estado del juego
  useEffect(() => {
    if (status === 'startScreen' || status === 'gameOver') {
      isInitializedRef.current = false;
    }
  }, [status]);
  
  // Calcular y ajustar el tamaño del tablero basado en el contenedor
  const adjustBoardSize = useCallback((boardContainer: HTMLElement, boardElement: HTMLElement) => {
    if (!boardContainer || !boardElement) return;
    
    // Calcular el tamaño disponible
    const containerWidth = boardContainer.clientWidth;
    const containerHeight = boardContainer.clientHeight;
    const size = Math.min(containerWidth, containerHeight) - 20; // Margen
    
    // Ajustar el tamaño del tablero
    boardElement.style.width = `${size}px`;
    boardElement.style.height = `${size}px`;
    
    // Calcular y establecer el tamaño de celda
    const cellSize = Math.max(30, Math.min(80, Math.floor(size / boardSize) - 8));
    document.documentElement.style.setProperty('--cell-size', `${cellSize}px`);
    
    logger.debug('Tablero ajustado', { 
      containerSize: { width: containerWidth, height: containerHeight }, 
      boardSize: size, 
      cellSize 
    });
  }, [boardSize]);
  
  return {
    board,
    highlightedCells,
    handleCellClick,
    initializeBoard,
    showHint,
    startTimers,
    stopTimers,
    generateRandomIcon,
    findConvergingIcons,
    iconCount,
    registerCellRef,
    getCellElement,
    adjustBoardSize,
    hasValidMoves,
    forceValidMove,
    addInitialIcons
  };
};

export default useGameLogic; 