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
import { store } from '../store';
import { createLogger } from '../utils/logUtils';
import * as config from '../utils/config';
import * as gameConfig from '../config/gameConfig';
import { isValidCell, getRandomInt, shuffleArray, hasValidMoves as checkValidMoves } from '../utils/gameUtils';
import { audioManager } from '../utils/audioManager';
import { 
  adjustBoardVisuals,
  changeSpawnRate
} from '../utils/boardUtils';

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
  
  // Referencias para las celdas del tablero (DOM)
  const cellRefs = useRef<Record<string, HTMLElement>>({});
  
  // Referencia para controlar si los temporizadores están activos
  const timersActiveRef = useRef<boolean>(false);
  
  // Referencia para marcar si el tablero ha sido inicializado
  const isInitializedRef = useRef<boolean>(false);
  
  // Registrar referencia para una celda
  const registerCellRef = useCallback((row: number, col: number, element: HTMLElement | null) => {
    const key = `${row}-${col}`;
    if (element) {
      cellRefs.current[key] = element;
    } else {
      delete cellRefs.current[key];
    }
  }, []);
  
  // Obtener el elemento DOM para una celda
  const getCellElement = useCallback((row: number, col: number) => {
    const key = `${row}-${col}`;
    return cellRefs.current[key] || null;
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
      const newBoard = JSON.parse(JSON.stringify(board));
      newBoard[row][col] = randomIcon;
      
      // Actualizar en el store
      dispatch(updateBoard(newBoard));
      dispatch(setIconCount(iconCount + 1));
      
      // Reproducir sonido de nuevo icono
      audioManager.play('newIcon');
      
      // Añadir la clase de animación al elemento DOM
      setTimeout(() => {
        const cellElement = getCellElement(row, col);
        if (cellElement) {
          cellElement.classList.add('new-icon');
          // Eliminar la clase después de la animación
          setTimeout(() => {
            cellElement.classList.remove('new-icon');
          }, 500);
        }
      }, 50);
      
      gameStateLogger.debug('Icono generado aleatoriamente', { 
        posición: { row, col }, 
        icono: randomIcon 
      });
      
      // Verificar si hay movimientos válidos después de añadir el icono
      if (checkMoves) {
        // Usamos setTimeout para asegurar que el tablero ha sido actualizado
        setTimeout(() => {
          const currentBoard = JSON.parse(JSON.stringify(store.getState().game.board));
          if (!checkValidMoves(currentBoard, boardSize)) {
            gameStateLogger.info('No hay movimientos válidos después de añadir un icono. Verificando condiciones de fin de juego...');
            
            // Verificar si el tablero está lleno
            let iconCount = 0;
            for (let r = 0; r < boardSize; r++) {
              for (let c = 0; c < boardSize; c++) {
                if (currentBoard[r][c] !== null) {
                  iconCount++;
                }
              }
            }
            
            if (iconCount >= boardSize * boardSize) {
              // El tablero está lleno y no hay movimientos válidos: fin del juego
              gameStateLogger.info('Tablero lleno y sin movimientos válidos, juego terminado');
              audioManager.play('gameOver');
              dispatch(setGameStatus('gameOver'));
            } else {
              // Aún hay espacio, intentar forzar un movimiento válido
              forceValidMove();
            }
          }
        }, 100);
      }
      
      return true;
    } catch (error) {
      gameStateLogger.error('Error al generar icono aleatorio', error);
      return false;
    }
  }, [board, boardSize, availableIcons, iconCount, status, forceValidMove, dispatch]);
  
  // Encontrar iconos que convergen en una celda vacía
  const findConvergingIcons = useCallback((row: number, col: number): {row: number, col: number, icon: string}[] => {
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
    
    // Crear una copia del tablero actual
    const newBoard = JSON.parse(JSON.stringify(board));
    let iconsAdded = 0;
    
    // Encontrar todas las celdas vacías
    const emptyCells: {row: number, col: number}[] = [];
    for (let row = 0; row < boardSize; row++) {
      for (let col = 0; col < boardSize; col++) {
        if (!newBoard[row][col]) {
          emptyCells.push({ row, col });
        }
      }
    }
    
    // Si no hay celdas vacías, no podemos añadir penalización
    if (emptyCells.length === 0) {
      penaltyLogger.info('No hay celdas vacías para aplicar penalización');
      return;
    }
    
    // Mezclar las celdas vacías para seleccionarlas aleatoriamente
    shuffleArray(emptyCells);
    
    // Añadir los iconos de penalización (tantos como sea posible)
    const iconCount = store.getState().game.iconCount;
    let totalToAdd = Math.min(penaltyIcons, emptyCells.length);
    totalToAdd = Math.min(totalToAdd, boardSize * boardSize - iconCount);
    
    if (totalToAdd <= 0) {
      penaltyLogger.info('No se pueden añadir más iconos de penalización');
      return;
    }
    
    for (let i = 0; i < totalToAdd; i++) {
      const { row, col } = emptyCells[i];
      const randomIcon = availableIcons[Math.floor(Math.random() * availableIcons.length)];
      newBoard[row][col] = randomIcon;
      iconsAdded++;
      
      // Añadir la clase de animación al elemento DOM
      setTimeout(() => {
        const cellElement = getCellElement(row, col);
        if (cellElement) {
          cellElement.classList.add('new-icon');
          // Eliminar la clase después de la animación
          setTimeout(() => {
            cellElement.classList.remove('new-icon');
          }, 500);
        }
      }, i * 300);
    }
    
    // Actualizar el tablero y el contador de iconos
    dispatch(updateBoard(newBoard));
    dispatch(setIconCount(iconCount + iconsAdded));
    
    // Reproducir sonido para cada icono añadido
    for (let i = 0; i < iconsAdded; i++) {
      setTimeout(() => {
        audioManager.play('newIcon');
      }, i * 300);
    }
    
    penaltyLogger.info(`Se añadieron ${iconsAdded} iconos de penalización al tablero`);
    
    // Verificar si hay movimientos válidos después de la penalización
    setTimeout(() => {
      if (!checkValidMoves(newBoard, boardSize)) {
        penaltyLogger.warn('No hay movimientos válidos después de aplicar la penalización');
        
        // Si el tablero está lleno, es game over
        if (iconCount + iconsAdded >= boardSize * boardSize) {
          audioManager.play('gameOver');
          dispatch(setGameStatus('gameOver'));
        } else {
          // Intentar forzar un movimiento válido
          forceValidMove();
        }
      }
    }, totalToAdd * 300 + 100);
  }, [board, boardSize, currentMode, getCellElement, forceValidMove]);
  
  // Mostrar pista resaltando celdas con movimientos válidos
  const showHint = useCallback(() => {
    const hintLogger = logger.subcontext('Pista');
    
    // Primero limpiar cualquier resaltado anterior
    setHighlightedCells([]);
    
    // Buscar convergencias posibles
    for (let row = 0; row < boardSize; row++) {
      for (let col = 0; col < boardSize; col++) {
        if (!board[row][col]) {
          const convergences = findConvergingIcons(row, col);
          if (convergences.length > 0) {
            // Añadir la celda objetivo también
            const cellsToHighlight = [...convergences.map(({ row, col }) => ({ row, col })), { row, col }];
            setHighlightedCells(cellsToHighlight);
            
            hintLogger.info('Pista mostrada', { 
              celdaObjetivo: { row, col }, 
              iconosConvergentes: convergences.length 
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
    const convergences = findConvergingIcons(row, col);
    
    if (convergences.length > 0) {
      // Limpiar cualquier resaltado anterior
      setHighlightedCells([]);
      
      // Reproducir sonido de convergencia
      audioManager.play('convergence');
      
      // Crear una copia profunda del tablero
      const newBoard = JSON.parse(JSON.stringify(board));
      
      // Eliminar los iconos convergentes - Simplemente eliminarlos, no colocar uno nuevo
      convergences.forEach(({ row: r, col: c }) => {
        // Añadir la clase de animación antes de eliminar el icono
        const cellElement = getCellElement(r, c);
        if (cellElement) {
          cellElement.classList.add('removing-icon');
        }
        
        // Programar la eliminación real después de la animación
        setTimeout(() => {
          if (cellElement) {
            cellElement.classList.remove('removing-icon');
          }
          // Eliminar el icono del tablero (será efectivo en la siguiente actualización)
          newBoard[r][c] = null;
          
          // Actualizar el tablero después de la última eliminación
          if (r === convergences[convergences.length - 1].row && c === convergences[convergences.length - 1].col) {
            // Actualizar el tablero
            dispatch(updateBoard(newBoard));
            
            // Decrementar el contador de iconos por los eliminados
            dispatch(setIconCount(iconCount - convergences.length));
            
            // Calcular y añadir puntuación
            const pointsEarned = gameConfig.calculateScore(convergences.length, level);
            dispatch(incrementScore(pointsEarned));
            
            // Verificar si el tablero está vacío (victoria)
            setTimeout(() => {
              const currentBoard = JSON.parse(JSON.stringify(store.getState().game.board));
              let remainingIcons = 0;
              
              for (let r = 0; r < boardSize; r++) {
                for (let c = 0; c < boardSize; c++) {
                  if (currentBoard[r][c] !== null) {
                    remainingIcons++;
                  }
                }
              }
              
              if (remainingIcons === 0) {
                // Tablero vacío: nivel completado
                clickLogger.info('Tablero vacío, nivel completado');
                audioManager.play('levelComplete');
                dispatch(setGameStatus('levelCompleted'));
              } else if (!checkValidMoves(currentBoard, boardSize)) {
                // No hay movimientos válidos pero quedan iconos: fin del juego
                clickLogger.info('No hay movimientos válidos disponibles y quedan iconos, juego terminado');
                audioManager.play('gameOver');
                dispatch(setGameStatus('gameOver'));
              }
            }, 100);
          }
        }, 300); // Tiempo para completar la animación de desaparición
      });
      
      clickLogger.info('Convergencia exitosa', { 
        iconosEliminados: convergences.length,
        puntos: gameConfig.calculateScore(convergences.length, level)
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
          
          // Usar la función modularizada para cambiar la velocidad
          changeSpawnRate(newSpawnRate);
          
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
    
    // Reiniciar el tablero
    const newBoard = Array(boardSize).fill(null).map(() => Array(boardSize).fill(null));
    
    // Obtener todas las posiciones disponibles del tablero
    const allPositions: {row: number, col: number}[] = [];
    for (let r = 0; r < boardSize; r++) {
      for (let c = 0; c < boardSize; c++) {
        allPositions.push({row: r, col: c});
      }
    }
    
    // Mezclar las posiciones para obtener ubicaciones aleatorias
    shuffleArray(allPositions);
    
    // Reservar posiciones para los iconos iniciales (máximo INITIAL_ICONS)
    const selectedPositions = allPositions.slice(0, INITIAL_ICONS);
    
    // Crear una copia del tablero para trabajar con ella
    let workingBoard = JSON.parse(JSON.stringify(newBoard));
    
    // Asegurarnos de tener al menos dos posiciones que podrían converger
    let guaranteedValidMove = false;
    
    if (selectedPositions.length >= 2) {
      // Buscar dos posiciones que podrían formar una convergencia (en la misma fila o columna)
      for (let i = 0; i < selectedPositions.length - 1 && !guaranteedValidMove; i++) {
        for (let j = i + 1; j < selectedPositions.length && !guaranteedValidMove; j++) {
          const pos1 = selectedPositions[i];
          const pos2 = selectedPositions[j];
          
          // Si están en la misma fila o columna y no son adyacentes, podemos usar el mismo icono
          if ((pos1.row === pos2.row && Math.abs(pos1.col - pos2.col) >= 2) || 
              (pos1.col === pos2.col && Math.abs(pos1.row - pos2.row) >= 2)) {
            // Seleccionar un icono aleatorio para ambas posiciones
            const randomIcon = availableIcons[Math.floor(Math.random() * availableIcons.length)];
            workingBoard[pos1.row][pos1.col] = randomIcon;
            workingBoard[pos2.row][pos2.col] = randomIcon;
            
            // Marcar estas posiciones como usadas
            selectedPositions[i] = { row: -1, col: -1 }; // Marcamos como usada
            selectedPositions[j] = { row: -1, col: -1 }; // Marcamos como usada
            
            guaranteedValidMove = true;
            initLogger.debug('Movimiento válido garantizado', { pos1, pos2, icon: randomIcon });
          }
        }
      }
    }
    
    // Llenar el resto de posiciones seleccionadas con iconos aleatorios
    for (const pos of selectedPositions) {
      // Saltar posiciones ya usadas para la convergencia garantizada
      if (pos.row === -1 && pos.col === -1) continue;
      
      // Añadir un icono aleatorio en esta posición
      const randomIcon = availableIcons[Math.floor(Math.random() * availableIcons.length)];
      workingBoard[pos.row][pos.col] = randomIcon;
    }
    
    // Contar cuántos iconos hemos colocado realmente
    let iconCount = 0;
    for (let r = 0; r < boardSize; r++) {
      for (let c = 0; c < boardSize; c++) {
        if (workingBoard[r][c] !== null) {
          iconCount++;
        }
      }
    }
    
    // Actualizar el tablero una sola vez con todos los iconos añadidos
    dispatch(updateBoard(workingBoard));
    dispatch(setIconCount(iconCount));
    
    // Usando una referencia al tablero actual para verificar los movimientos válidos
    const currentBoard = workingBoard;
    
    // Verificar si hay movimientos válidos después de la inicialización
    // Primero actualizamos el tablero y luego verificamos los movimientos
    setTimeout(() => {
      const boardToCheck = JSON.parse(JSON.stringify(store.getState().game.board));
      if (!hasValidMoves()) {
        initLogger.warn('No hay movimientos válidos después de la inicialización. Forzando movimiento...');
        
        // Si no hay movimientos válidos, añadir un par de iconos iguales en posiciones estratégicas
        const emptyPositions: {row: number, col: number}[] = [];
        for (let r = 0; r < boardSize; r++) {
          for (let c = 0; c < boardSize; c++) {
            if (boardToCheck[r][c] === null) {
              emptyPositions.push({row: r, col: c});
            }
          }
        }
        
        if (emptyPositions.length >= 2) {
          shuffleArray(emptyPositions);
          const randomIcon = availableIcons[Math.floor(Math.random() * availableIcons.length)];
          
          // Colocar el mismo icono en las dos primeras posiciones vacías
          const pos1 = emptyPositions[0];
          const pos2 = emptyPositions[1];
          
          // Crear una nueva copia del tablero para evitar modificar el original (que puede ser de solo lectura)
          const updatedBoard = JSON.parse(JSON.stringify(boardToCheck));
          
          // Ahora modificar la copia
          updatedBoard[pos1.row][pos1.col] = randomIcon;
          updatedBoard[pos2.row][pos2.col] = randomIcon;
          
          // Actualizar el tablero y el contador
          dispatch(updateBoard(updatedBoard));
          dispatch(setIconCount(iconCount + 2));
          
          initLogger.debug('Iconos adicionales añadidos para garantizar jugabilidad', {
            posiciones: [pos1, pos2],
            icono: randomIcon
          });
        }
      }
    }, 100); // Pequeño retraso para asegurar que el estado se haya actualizado
  }, [boardSize, availableIcons, hasValidMoves, dispatch]);
  
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
    // Usar la función modularizada para ajustar el tamaño visual del tablero
    adjustBoardVisuals(boardContainer, boardElement);
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