import React, {
  useCallback,
  useState,
  useMemo,
  useRef,
  useEffect,
} from "react";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "../../../store";
import useBoardInteraction from "./hooks/useBoardInteraction";
import "./styles/index.css";
import {
  setHighlightedCells,
  setBoardSize,
  setSpawnRate,
  setLevel,
  setGameStatus,
  setAvailableIcons,
  updateBoard,
  setIconCount,
} from "../../../store/slices/gameSlice";
import * as config from "../../../utils/config";
import { audioManager } from "../../../utils/audioManager";
import FpsCounter from "../FpsCounter/FpsCounter";
import { NotificationProvider } from "../GameNotifications/GameNotificationManager";
import * as levelUtils from "../../../utils/levels";
import useGameLogic from "../../../hooks/useGameLogic";

const GameBoard: React.FC = () => {
  const dispatch = useDispatch();
  const {
    board,
    boardSize,
    status,
    highlightedCells,
    currentDifficulty,
    level,
    spawnRate,
    currentPlayMode,
    availableIcons,
  } = useSelector((state: RootState) => state.game);

  const {
    handleCellClick,
    registerCellRef,
    showHint,
    increaseSpeed,
    showSpeedAlert,
    speedMultiplier,
    showPenaltyAlert,
    showSpeedAlertUI,
  } = useBoardInteraction();
  
  // Importar las funciones necesarias de useGameLogic
  const gameLogic = useGameLogic();
  const { startTimers, stopTimers } = gameLogic;

  // Referencias para el tablero
  const gridRef = useRef<HTMLDivElement>(null);

  // Rastreamos las celdas que son nuevas (para animación)
  const newIconCells = useRef<Set<string>>(new Set<string>());

  // Estado para mostrar/ocultar los controles de desarrollo
  const [showDevControls, setShowDevControls] = useState(false);

  // Estado para la velocidad personalizada
  const [customSpeedMultiplier, setCustomSpeedMultiplier] = useState(1);

  // Estado para mostrar/ocultar el contador de FPS
  const [showFpsCounter, setShowFpsCounter] = useState(false);

  // Para mantener la compatibilidad con la UI mientras eliminamos useAnimationsLoader
  const [usingLiteMode, setUsingLiteMode] = useState(false);

  // Estado para detección de rendimiento
  const [lowPerformanceMode, setLowPerformanceMode] = useState<boolean>(false);

  // Referencia para el control de notificaciones - corregida para permitir activación
  const performanceActivatedRef = useRef<boolean>(false);

  // Umbral de FPS bajo el cual activamos el modo de bajo rendimiento
  const LOW_FPS_THRESHOLD = 40;

  // Verificar si una celda está resaltada - memoizada para evitar recálculos
  const isCellHighlighted = useCallback(
    (row: number, col: number) => {
      return highlightedCells.some(
        (cell) => cell.row === row && cell.col === col
      );
    },
    [highlightedCells]
  );

  // Procesar el contenido de la celda para manejar estados especiales - memoizado
  const processCellContent = useCallback((content: string | null) => {
    if (!content) return { icon: null, isRemoving: false };

    // Comprobar si el icono está marcado para eliminación
    if (content.includes("_removing")) {
      return {
        icon: content.replace("_removing", ""),
        isRemoving: true,
      };
    }

    // Icono normal
    return {
      icon: content,
      isRemoving: false,
    };
  }, []);

  // Manejadores de eventos optimizados - sin animaciones
  const handleCellClickOptimized = useCallback(
    (row: number, col: number) => {
      // Verificar si la celda tiene un ícono
      const cellContent = board[row]?.[col];

      // Solo reproducir sonido si hay un icono
      if (cellContent) {
        audioManager.play("click");
      }

      // Llamar al manejador original
      handleCellClick(row, col);
    },
    [handleCellClick, board]
  );

  // Optimización: pre-calcular las celdas para reducir el tiempo de renderizado
  const cells = useMemo(() => {
    if (
      !board ||
      board.length === 0 ||
      (status !== "playing" && status !== "paused")
    ) {
      return [];
    }

    const cellsArray = [];

    // Optimización: En modo de bajo rendimiento, simplificar las celdas vacías
    const shouldRenderEmptyCells = !lowPerformanceMode || boardSize <= 6;

    for (let row = 0; row < boardSize; row++) {
      for (let col = 0; col < boardSize; col++) {
        const cellContent = board[row] ? board[row][col] : null;

        // Optimización: En dispositivos de bajo rendimiento y tableros grandes, solo renderizar celdas con contenido
        if (!cellContent && !shouldRenderEmptyCells) {
          // Usar una representación mínima para celdas vacías
          cellsArray.push(
            <div
              key={`cell-${row}-${col}`}
              className="board-cell empty performance-mode"
              onClick={() => handleCellClickOptimized(row, col)}
              data-row={row}
              data-col={col}
            />
          );
          continue;
        }

        const { icon, isRemoving } = processCellContent(cellContent);

        // Optimización: reducir el número de clases aplicadas
        let cellClasses = "board-cell";

        if (isCellHighlighted(row, col)) cellClasses += " highlighted";
        if (isRemoving) cellClasses += " removing";
        if (icon && !isRemoving) cellClasses += " has-icon";
        if (!icon) cellClasses += " empty";
        if (lowPerformanceMode) cellClasses += " performance-mode";

        // Detectar si es un icono recién añadido
        const cellKey = `${row}-${col}`;
        // Garantizar que siempre hay un Set válido
        const currentNewIconCells = newIconCells.current || new Set<string>();
        const isNewIcon =
          icon && !isRemoving && !currentNewIconCells.has(cellKey);

        // Si es un icono nuevo, añadir la clase new-icon
        if (isNewIcon && icon) {
          cellClasses += " new-icon";
          currentNewIconCells.add(cellKey);

          // Mantener la clase new-icon durante más tiempo para proteger el icono
          // de ser eliminado durante operaciones de eliminación de convergencias
          const protectionDuration = lowPerformanceMode ? 1500 : 2000; // Tiempo suficiente para cualquier animación

          const timerId = setTimeout(() => {
            const cellElement = document.querySelector(
              `[data-row="${row}"][data-col="${col}"]`
            );
            if (cellElement) {
              // Eliminar la clase new-icon de forma segura
              cellElement.classList.remove("new-icon");

              // Log para depuración
              console.log(
                `GameBoard: Eliminada protección de icono nuevo en [${row},${col}]`
              );
            }
          }, protectionDuration);

          // Guardar referencia al Set actualizado
          newIconCells.current = currentNewIconCells;
        }

        cellsArray.push(
          <div
            key={`cell-${row}-${col}`}
            className={cellClasses}
            onClick={() => handleCellClickOptimized(row, col)}
            ref={(el) => {
              registerCellRef(row, col, el);

              // Eliminamos los efectos de animación para mejor rendimiento
              // Ya no creamos estrellas ni efectos visuales
            }}
            data-row={row}
            data-col={col}
          >
            {icon && <span className="cell-content">{icon}</span>}
          </div>
        );
      }
    }

    return cellsArray;
  }, [
    board,
    boardSize,
    status,
    processCellContent,
    isCellHighlighted,
    handleCellClickOptimized,
    registerCellRef,
    lowPerformanceMode,
  ]);

  // Detección de eventos táctiles vs mouse
  useEffect(() => {
    if (gridRef.current) {
      const grid = gridRef.current;
      let isTouchDevice = false;

      const touchStartHandler = () => {
        isTouchDevice = true;
        grid.classList.add("touch-device");
      };

      grid.addEventListener("touchstart", touchStartHandler, { passive: true });

      return () => {
        grid.removeEventListener("touchstart", touchStartHandler);
      };
    }
  }, []);

  // Asegurar que el Set de newIconCells existe al iniciar el componente
  useEffect(() => {
    if (!newIconCells.current) {
      newIconCells.current = new Set<string>();
    }

    // Limpiar al desmontar
    return () => {
      if (newIconCells.current) {
        newIconCells.current.clear();
      }
    };
  }, []);

  // Funciones de manejo de eventos
  const handleBoardSizeChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    const newSize = parseInt(event.target.value, 10);
    if (isNaN(newSize)) return;
    
    if (status !== "playing") {
      dispatch(setBoardSize(newSize));
    }
  }, [dispatch, status]);

  // Botón para mostrar pista
  const handleShowHint = useCallback(() => {
    showHint();
  }, [showHint]);

  // Función para cambiar la velocidad del juego
  const handleSpeedChange = useCallback(
    (multiplierOrEvent: number | React.ChangeEvent<HTMLInputElement>, isIncrease?: boolean) => {
      // Determinar si estamos recibiendo un evento o un valor directo
      let multiplier: number;
      
      if (typeof multiplierOrEvent === 'number') {
        multiplier = multiplierOrEvent;
      } else {
        multiplier = parseFloat(multiplierOrEvent.target.value);
      }
      
      if (isNaN(multiplier) || multiplier <= 0) return;
      
      // Calcular nueva velocidad basada en el multiplicador
      const baseRate = config.SPAWN_RATES.MEDIUM; // Usar un valor consistente
      const newRate = Math.round(baseRate / multiplier);
      
      // Actualizar estado y dispatch
      dispatch(setSpawnRate(newRate));
      setCustomSpeedMultiplier(multiplier);
      
      // Mostrar UI de alerta de velocidad
      showSpeedAlertUI(multiplier);
      
      console.log(`Velocidad cambiada a ${multiplier}x (${newRate}ms)`);

      if (isIncrease) {
        handleStepSpeed(multiplier);
      }
    },
    [dispatch, showSpeedAlertUI]
  );

  // Función para avanzar o retroceder la velocidad paso a paso
  const handleStepSpeed = useCallback(
    (direction: number) => {
      const baseRate = config.SPAWN_RATES.MEDIUM;
      const currentMultiplier = Number((baseRate / spawnRate).toFixed(1));

      // Definir los incrementos para cambios de velocidad más suaves
      const speedSteps = [
        0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 3.5, 4,
      ];

      // Encontrar el índice más cercano al multiplicador actual
      let closestIndex = 0;
      let minDiff = Math.abs(speedSteps[0] - currentMultiplier);

      for (let i = 1; i < speedSteps.length; i++) {
        const diff = Math.abs(speedSteps[i] - currentMultiplier);
        if (diff < minDiff) {
          minDiff = diff;
          closestIndex = i;
        }
      }

      // Determinar el nuevo índice basado en la dirección
      let newIndex;
      if (direction > 0) {
        newIndex = Math.min(closestIndex + 1, speedSteps.length - 1);
      } else {
        newIndex = Math.max(closestIndex - 1, 0);
      }

      // Aplicar el nuevo multiplicador
      const newMultiplier = speedSteps[newIndex];
      handleSpeedChange(newMultiplier, direction > 0);
    },
    [spawnRate, handleSpeedChange]
  );

  // Función para pausar/reanudar la generación de iconos
  const [iconGenPaused, setIconGenPaused] = useState(false);

  const toggleIconGeneration = useCallback(() => {
    const newState = !iconGenPaused;
    setIconGenPaused(newState);

    // Si estamos pausando, guardamos la velocidad actual
    if (newState) {
      // Establecer una velocidad extremadamente lenta (prácticamente detenida)
      const pausedRate = 100000; // 100 segundos entre iconos
      dispatch(setSpawnRate(pausedRate));
      audioManager.play("pause");
    } else {
      // Restaurar la velocidad basada en el multiplicador actual
      const baseRate = config.SPAWN_RATES.MEDIUM;
      const newRate = Math.round(baseRate / customSpeedMultiplier);
      dispatch(setSpawnRate(newRate));
      audioManager.play("resume");
    }

    console.log(`Generación de iconos ${newState ? "pausada" : "reanudada"}`);
  }, [iconGenPaused, dispatch, customSpeedMultiplier]);

  // Función para pasar al siguiente nivel
  const handleNextLevel = useCallback(() => {
    // Aumentar el nivel actual
    dispatch(setLevel(level + 1));

    // Si el juego está en pausa o completado, cambiarlo a 'playing'
    if (status !== "playing") {
      dispatch(setGameStatus("playing"));
    }

    // Mostrar mensaje en consola
    console.log(`[DEV TOOLS] Avanzando al nivel ${level + 1}`);
  }, [dispatch, level, status]);

  // Calculamos el valor actual del multiplicador de velocidad
  const currentSpeedMultiplier = useMemo(() => {
    const baseRate = config.INITIAL_SPAWN_RATE || 3000;
    return Number((baseRate / spawnRate).toFixed(1));
  }, [spawnRate]);

  // Renderizar controles de desarrollo
  const renderDevControls = useCallback(() => {
    if (!showDevControls) return null;

    return (
      <div className="dev-controls">
        <h3>Controles de Desarrollo</h3>
        <div className="dev-controls-container">
          <div className="control-group">
            <label>Tamaño del tablero</label>
            <select
              value={boardSize}
              onChange={handleBoardSizeChange}
              disabled={status === "playing"}
            >
              <option value={4}>4x4</option>
              <option value={5}>5x5</option>
              <option value={6}>6x6</option>
              <option value={7}>7x7</option>
              <option value={8}>8x8</option>
            </select>
          </div>

          <div className="control-group">
            <label>Velocidad de juego ({currentSpeedMultiplier.toFixed(1)}x)</label>
            <div className="speed-controls">
              <button onClick={() => handleSpeedChange(0.5)}>-</button>
              <input
                type="range"
                min="0.1"
                max="3"
                step="0.1"
                value={customSpeedMultiplier || currentSpeedMultiplier}
                onChange={handleSpeedChange}
              />
              <button onClick={() => handleSpeedChange(0.5, true)}>+</button>
            </div>
            <div className="speed-buttons">
              <button onClick={() => handleStepSpeed(0.5)}>0.5x</button>
              <button onClick={() => handleStepSpeed(1)}>1x</button>
              <button onClick={() => handleStepSpeed(1.5)}>1.5x</button>
              <button onClick={() => handleStepSpeed(2)}>2x</button>
            </div>
          </div>

          <div className="control-group">
            <label>Generación de iconos</label>
            <button onClick={toggleIconGeneration} className="action-button">
              {iconGenPaused ? "Reanudar" : "Pausar"} generación
            </button>
          </div>

          <div className="control-group">
            <label>Contador FPS</label>
            <div className="speed-buttons">
              <button
                className={!showFpsCounter ? "active" : ""}
                onClick={() => setShowFpsCounter(false)}
              >
                Oculto
              </button>
              <button
                className={showFpsCounter ? "active" : ""}
                onClick={() => setShowFpsCounter(true)}
              >
                Visible
              </button>
            </div>
          </div>

          <div className="control-group">
            <label>Modo de animaciones</label>
            <div className="speed-buttons">
              <button
                className={!usingLiteMode ? "active" : ""}
                onClick={() => {
                  setUsingLiteMode(false);
                  document.documentElement.classList.remove('lite-animations');
                }}
              >
                Completas
              </button>
              <button
                className={usingLiteMode ? "active" : ""}
                onClick={() => {
                  setUsingLiteMode(true);
                  document.documentElement.classList.add('lite-animations');
                }}
              >
                Reducidas
              </button>
            </div>
          </div>

          <div className="control-actions">
            <button
              onClick={handleShowHint}
              className="dev-action-button hint-button"
            >
              Mostrar Pista
            </button>
            <button
              onClick={handleNextLevel}
              className="dev-action-button next-level-button"
            >
              Pasar al Nivel {level + 1}
            </button>
          </div>
        </div>
      </div>
    );
  }, [
    showDevControls,
    boardSize,
    level,
    currentSpeedMultiplier,
    customSpeedMultiplier,
    iconGenPaused,
    showFpsCounter,
    handleBoardSizeChange,
    handleShowHint,
    handleSpeedChange,
    handleStepSpeed,
    toggleIconGeneration,
    handleNextLevel,
    usingLiteMode
  ]);

  // Renderizar el tablero como una grid
  const renderBoard = useCallback(() => {
    // Si el tablero está vacío o status no es 'playing', mostrar mensaje
    if (!board || board.length === 0) {
      return <div className="empty-board-message">Cargando tablero...</div>;
    }

    // Mostrar mensajes según el estado del juego
    if (status !== "playing" && status !== "paused") {
      return (
        <div className="empty-board-message">
          {status === "startScreen" &&
            "Selecciona la configuración para comenzar"}
          {status === "gameOver" && "Juego terminado"}
          {status === "levelCompleted" && "Nivel completado"}
          {status === "idle" && "Inicializando..."}
        </div>
      );
    }

    return (
      <div
        ref={gridRef}
        className={`game-board-grid grid-${boardSize}`}
        style={{
          gridTemplateColumns: `repeat(${boardSize}, 1fr)`,
          gridTemplateRows: `repeat(${boardSize}, 1fr)`,
        }}
      >
        {cells}
      </div>
    );
  }, [board, boardSize, cells, status]);

  // Efecto para inicializar el tablero cuando cambia el nivel o el modo de juego
  useEffect(() => {
    if (status === 'playing' && board.length > 0) {
      // Obtener los iconos para el nivel actual según dificultad y modo de juego
      const levelIcons = levelUtils.getLevelIcons(level, currentPlayMode);
      
      // Verificar si los iconos actuales son diferentes de los que deberían estar
      const shouldUpdateIcons = !availableIcons.every(icon => levelIcons.includes(icon)) || 
                              !levelIcons.every(icon => availableIcons.includes(icon));
      
      if (shouldUpdateIcons) {
        // Actualizar los iconos disponibles en el estado
        dispatch(setAvailableIcons(levelIcons));
        console.log(`GameBoard: Actualizados iconos para nivel ${level}, modo ${currentPlayMode}`);
      }
      
      // Obtener la tasa de spawn adecuada para el nivel
      const levelSpawnRate = levelUtils.getLevelSpawnRate(level, currentPlayMode, currentDifficulty);
      if (spawnRate !== levelSpawnRate) {
        dispatch(setSpawnRate(levelSpawnRate));
        console.log(`GameBoard: Actualizada tasa de spawn para nivel ${level}: ${levelSpawnRate}ms`);
      }
      
      // Asegurar que el tablero está inicializado correctamente
      const boardEmpty = board.flat().every(cell => cell === null);
      if (boardEmpty) {
        console.log("GameBoard: Tablero vacío detectado, inicializando...");
        gameLogic.initializeBoard(boardSize, true, level);
      }
      
      // IMPORTANTE: Ya NO iniciamos los temporizadores desde aquí
      // Esto evita tener múltiples temporizadores activos simultáneamente
    }
  }, [level, currentPlayMode, currentDifficulty, status, board, availableIcons, spawnRate, dispatch, gameLogic, boardSize]);
  
  // Efecto para detener timers cuando el juego no está en 'playing'
  useEffect(() => {
    if (status !== 'playing') {
      stopTimers();
    }
  }, [status, stopTimers]);

  return (
    <NotificationProvider>
      {showFpsCounter && (
        <FpsCounter
          performanceThreshold={35}
        />
      )}
      <div
        className={`game-board-wrapper ${
          lowPerformanceMode ? "performance-mode" : ""
        }`}>
        {renderBoard()}
        {showDevControls && renderDevControls()}
      </div>
    </NotificationProvider>
  );
};

export default GameBoard;
