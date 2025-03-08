import React, { useCallback, useState, useMemo, useRef, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../../store';
import useBoardInteraction from './hooks/useBoardInteraction';
import useAnimationsLoader from './hooks/useAnimationsLoader';
import './styles/index.css';
import { setHighlightedCells, setBoardSize, setSpawnRate, setLevel, setGameStatus } from '../../../store/slices/gameSlice';
import * as config from '../../../utils/config';
import { audioManager } from '../../../utils/audioManager';
import FpsCounter from '../FpsCounter/FpsCounter';
import { NotificationProvider } from '../GameNotifications/GameNotificationManager';

const GameBoard: React.FC = () => {
  const dispatch = useDispatch();
  const { 
    board, 
    boardSize, 
    status, 
    highlightedCells,
    currentDifficulty,
    level,
    spawnRate
  } = useSelector((state: RootState) => state.game);
  
  const { 
    handleCellClick, 
    registerCellRef,
    showHint,
    increaseSpeed,
    showSpeedAlert,
    speedMultiplier,
    showPenaltyAlert,
    showSpeedAlertUI
  } = useBoardInteraction();
  
  // Referencias para el tablero
  const gridRef = useRef<HTMLDivElement>(null);
  
  // Rastreamos las celdas que son nuevas (para animación)
  const newIconCells = useRef<Set<string>>(new Set<string>());
  
  // Estado para mostrar/ocultar los controles de desarrollo
  const [showDevControls, setShowDevControls] = useState(false);
  
  // Estado para la velocidad personalizada
  const [customSpeedMultiplier, setCustomSpeedMultiplier] = useState(1);
  
  // Estado para mostrar/ocultar el contador de FPS
  const [showFpsCounter, setShowFpsCounter] = useState<boolean>(true);
  
  // Estado para detección de rendimiento
  const [lowPerformanceMode, setLowPerformanceMode] = useState<boolean>(false);
  
  // Referencia para el control de notificaciones - corregida para permitir activación
  const performanceActivatedRef = useRef<boolean>(false);
  
  // Umbral de FPS bajo el cual activamos el modo de bajo rendimiento
  const LOW_FPS_THRESHOLD = 40;
  
  // Verificar si una celda está resaltada - memoizada para evitar recálculos
  const isCellHighlighted = useCallback((row: number, col: number) => {
    return highlightedCells.some(cell => cell.row === row && cell.col === col);
  }, [highlightedCells]);
  
  // Procesar el contenido de la celda para manejar estados especiales - memoizado
  const processCellContent = useCallback((content: string | null) => {
    if (!content) return { icon: null, isRemoving: false };
    
    // Comprobar si el icono está marcado para eliminación
    if (content.includes('_removing')) {
      return {
        icon: content.replace('_removing', ''),
        isRemoving: true
      };
    }
    
    // Icono normal
    return {
      icon: content,
      isRemoving: false
    };
  }, []);
  
  // Manejadores de eventos optimizados - sin animaciones
  const handleCellClickOptimized = useCallback((row: number, col: number) => {
    // Verificar si la celda tiene un ícono
    const cellContent = board[row]?.[col];
    
    // Solo reproducir sonido si hay un icono
    if (cellContent) {
      audioManager.play('click');
    }
    
    // Llamar al manejador original
    handleCellClick(row, col);
  }, [handleCellClick, board]);
  
  // Optimización: pre-calcular las celdas para reducir el tiempo de renderizado
  const cells = useMemo(() => {
    if (!board || board.length === 0 || (status !== 'playing' && status !== 'paused')) {
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
        let cellClasses = 'board-cell';
        
        if (isCellHighlighted(row, col)) cellClasses += ' highlighted';
        if (isRemoving) cellClasses += ' removing';
        if (icon && !isRemoving) cellClasses += ' has-icon';
        if (!icon) cellClasses += ' empty';
        if (lowPerformanceMode) cellClasses += ' performance-mode';
        
        // Detectar si es un icono recién añadido
        const cellKey = `${row}-${col}`;
        // Garantizar que siempre hay un Set válido
        const currentNewIconCells = newIconCells.current || new Set<string>();
        const isNewIcon = icon && !isRemoving && !currentNewIconCells.has(cellKey);
        
        // Si es un icono nuevo, añadir la clase new-icon
        if (isNewIcon && icon) {
          cellClasses += ' new-icon';
          currentNewIconCells.add(cellKey);
          
          // Eliminar la clase después de la animación
          const timerId = setTimeout(() => {
            const cellElement = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
            if (cellElement) {
              cellElement.classList.remove('new-icon');
            }
          }, lowPerformanceMode ? 300 : 450);
          
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
  }, [board, boardSize, status, processCellContent, isCellHighlighted, handleCellClickOptimized, registerCellRef, lowPerformanceMode]);
  
  // Detección de eventos táctiles vs mouse
  useEffect(() => {
    if (gridRef.current) {
      const grid = gridRef.current;
      let isTouchDevice = false;
      
      const touchStartHandler = () => {
        isTouchDevice = true;
        grid.classList.add('touch-device');
      };
      
      grid.addEventListener('touchstart', touchStartHandler, { passive: true });
      
      return () => {
        grid.removeEventListener('touchstart', touchStartHandler);
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
  
  // Función para cambiar el tamaño del tablero (para desarrollo)
  const handleBoardSizeChange = useCallback((newSize: number) => {
    dispatch(setBoardSize(newSize));
  }, [dispatch]);
  
  // Botón para mostrar pista
  const handleShowHint = useCallback(() => {
    showHint();
  }, [showHint]);
  
  // Función para cambiar la velocidad del juego
  const handleSpeedChange = useCallback((multiplier: number) => {
    // Calcular nueva velocidad basada en el multiplicador
    const baseRate = config.SPAWN_RATES.MEDIUM; // Usar un valor consistente
    const newRate = Math.round(baseRate / multiplier);
    
    // Actualizar estado local
    setCustomSpeedMultiplier(multiplier);
    
    // Mostrar feedback visual al usuario
    audioManager.play("speedUp");
    
    // Actualizar el store
    dispatch(setSpawnRate(newRate));
    
    // Mostrar siempre la alerta de cambio de velocidad con un pequeño retraso
    // para asegurar que se actualice después de que Redux haya procesado los cambios
    setTimeout(() => {
      showSpeedAlertUI(multiplier);
    }, 50);
    
    console.log(`Velocidad cambiada a ${multiplier}x (${newRate}ms)`);
  }, [dispatch, showSpeedAlertUI]);
  
  // Función para avanzar o retroceder la velocidad paso a paso
  const handleStepSpeed = useCallback((direction: 'increase' | 'decrease') => {
    const baseRate = config.SPAWN_RATES.MEDIUM;
    const currentMultiplier = Number((baseRate / spawnRate).toFixed(1));
    
    // Definir los incrementos para cambios de velocidad más suaves
    const speedSteps = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 3.5, 4];
    
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
    if (direction === 'increase') {
      newIndex = Math.min(closestIndex + 1, speedSteps.length - 1);
    } else {
      newIndex = Math.max(closestIndex - 1, 0);
    }
    
    // Aplicar el nuevo multiplicador
    const newMultiplier = speedSteps[newIndex];
    handleSpeedChange(newMultiplier);
    
  }, [spawnRate, handleSpeedChange]);
  
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
    
    console.log(`Generación de iconos ${newState ? 'pausada' : 'reanudada'}`);
  }, [iconGenPaused, dispatch, customSpeedMultiplier]);
  
  // Función para pasar al siguiente nivel
  const handleNextLevel = useCallback(() => {
    // Aumentar el nivel actual
    dispatch(setLevel(level + 1));
    
    // Si el juego está en pausa o completado, cambiarlo a 'playing'
    if (status !== 'playing') {
      dispatch(setGameStatus('playing'));
    }
    
    // Mostrar mensaje en consola
    console.log(`[DEV TOOLS] Avanzando al nivel ${level + 1}`);
  }, [dispatch, level, status]);
  
  // Calculamos el valor actual del multiplicador de velocidad
  const currentSpeedMultiplier = useMemo(() => {
    const baseRate = config.INITIAL_SPAWN_RATE || 3000;
    return Number((baseRate / spawnRate).toFixed(1));
  }, [spawnRate]);
  
  // Valores predefinidos de multiplicadores de velocidad (ampliados)
  const speedPresets = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4];
  
  // Manejador para cuando se detecta una caída de rendimiento
  const handlePerformanceDrop = useCallback((avgFps: number) => {
    // Si ya activamos el modo, no volver a hacerlo
    if (performanceActivatedRef.current) {
      return;
    }
    
    // Marcar como activado
    performanceActivatedRef.current = true;
    
    console.log(`GameBoard: Detectada caída de rendimiento. FPS promedio: ${avgFps}`);
    
    // Activar el modo de bajo rendimiento (local)
    setLowPerformanceMode(true);
    
    // Si el FPS es extremadamente bajo, activar el modo de rendimiento alto
    if (avgFps < 20) {
      // Añadir clase de rendimiento alto a nivel de documento
      document.documentElement.classList.add('performance-mode');
      document.documentElement.classList.add('performance-mode-high');
      console.log(`GameBoard: Activando modo de rendimiento ALTO. FPS promedio: ${avgFps}`);
    } else {
      // Añadir clase a nivel de documento para que otros componentes respondan
      document.documentElement.classList.add('performance-mode');
    }
    
    // Aplicar clase al grid para mejorar rendimiento
    setTimeout(() => {
      if (gridRef.current) {
        gridRef.current.classList.add('performance-mode');
      }
    }, 0);
  }, []);
  
  // Hook para gestionar las animaciones según el rendimiento
  const { 
    useLiteAnimations, 
    fps, 
    setAnimationMode, 
    isManualMode 
  } = useAnimationsLoader(35); // 35 FPS como umbral
  
  // Renderizar controles de desarrollo
  const renderDevControls = useCallback(() => {
    if (!showDevControls) return null;
    
    // Describir el impacto de cada velocidad
    const getSpeedDescription = (multiplier: number): string => {
      if (multiplier <= 0.25) return "Ultra lento (debug detallado)";
      if (multiplier <= 0.5) return "Muy lento (para debug)";
      if (multiplier <= 0.75) return "Lento (principiantes)";
      if (multiplier <= 1.1) return "Normal (equilibrado)";
      if (multiplier <= 1.5) return "Rápido (intermedio)";
      if (multiplier <= 2.0) return "Muy rápido (avanzado)";
      if (multiplier <= 3.0) return "Extremo (expertos)";
      return "Ultra rápido (imposible)";
    };
    
    // Convertir multiplicador a milisegundos
    const getSpawnRateMs = (multiplier: number): number => {
      return Math.round(config.SPAWN_RATES.MEDIUM / multiplier);
    };
    
    return (
      <div className="dev-controls">
        <div className="dev-controls-header">
          <span>Controles de Desarrollo</span>
          <button onClick={() => setShowDevControls(false)} className="close-btn">×</button>
        </div>
        <div className="dev-controls-body">
          <div className="control-group">
            <label>Tamaño del Tablero:</label>
            <div className="board-size-buttons">
              {[6, 8, 10, 12].map(size => (
                <button 
                  key={size} 
                  onClick={() => handleBoardSizeChange(size)}
                  className={boardSize === size ? 'active' : ''}
                >
                  {size}×{size}
                </button>
              ))}
            </div>
          </div>
          
          <div className="control-group">
            <label>
              Velocidad: <span className="value-display">x{currentSpeedMultiplier}</span>
              <span className="speed-description">({getSpeedDescription(currentSpeedMultiplier)})</span>
            </label>
            <div className="speed-ms-display">Tiempo entre iconos: {getSpawnRateMs(currentSpeedMultiplier)}ms</div>
            
            {/* Control preciso de velocidad */}
            <div className="speed-step-controls">
              <button onClick={() => handleStepSpeed('decrease')} className="step-button">
                <span>⏪</span> Más lento
              </button>
              <button 
                onClick={toggleIconGeneration} 
                className={`toggle-button ${iconGenPaused ? 'paused' : ''}`}
              >
                {iconGenPaused ? '▶️ Reanudar' : '⏸️ Pausar'}
              </button>
              <button onClick={() => handleStepSpeed('increase')} className="step-button">
                Más rápido <span>⏩</span>
              </button>
            </div>
            
            <div className="speed-buttons">
              {speedPresets.map(speed => (
                <button 
                  key={speed} 
                  onClick={() => handleSpeedChange(speed)}
                  className={Math.abs(currentSpeedMultiplier - speed) < 0.1 ? 'active' : ''}
                >
                  x{speed}
                </button>
              ))}
            </div>
            <div className="speed-slider">
              <input 
                type="range" 
                min="0.25" 
                max="4" 
                step="0.05" 
                value={customSpeedMultiplier}
                onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
              />
            </div>
          </div>
          
          <div className="control-group">
            <label>Herramientas de Diagnóstico:</label>
            <div className="diagnostic-tools">
              <button 
                onClick={() => setShowFpsCounter(!showFpsCounter)}
                className={showFpsCounter ? 'active' : ''}
              >
                {showFpsCounter ? 'Ocultar FPS' : 'Mostrar FPS'}
              </button>
            </div>
          </div>
          
          <div className="control-group">
            <label>Modo de animaciones</label>
            <div className="speed-buttons">
              <button 
                className={!useLiteAnimations ? "active" : ""} 
                onClick={() => setAnimationMode(false)}
              >
                Completas
              </button>
              <button 
                className={useLiteAnimations ? "active" : ""} 
                onClick={() => setAnimationMode(true)}
              >
                Reducidas
              </button>
            </div>
            {fps && (
              <div className="value-display">
                FPS detectados: {fps}
              </div>
            )}
          </div>
          
          <div className="control-actions">
            <button onClick={handleShowHint} className="dev-action-button hint-button">
              Mostrar Pista
            </button>
            <button onClick={handleNextLevel} className="dev-action-button next-level-button">
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
    useLiteAnimations,
    fps,
    setAnimationMode,
    isManualMode
  ]);
  
  // Renderizar el tablero como una grid
  const renderBoard = useCallback(() => {
    // Si el tablero está vacío o status no es 'playing', mostrar mensaje
    if (!board || board.length === 0 || (status !== 'playing' && status !== 'paused')) {
      return (
        <div className="empty-board-message">
          {status === 'startScreen' && 'Selecciona la configuración para comenzar'}
          {status === 'gameOver' && 'Juego terminado'}
          {status === 'levelCompleted' && 'Nivel completado'}
          {status === 'paused' && 'Juego en pausa'}
          {!board || board.length === 0 ? 'Cargando tablero...' : ''}
        </div>
      );
    }
    
    return (
      <div 
        ref={gridRef}
        className="game-board-grid"
        style={{ 
          gridTemplateColumns: `repeat(${boardSize}, 1fr)`,
          gridTemplateRows: `repeat(${boardSize}, 1fr)`
        }}
      >
        {cells}
      </div>
    );
  }, [board, boardSize, cells, status]);
  
  return (
    <NotificationProvider>
      {showFpsCounter && <FpsCounter onPerformanceDrop={handlePerformanceDrop} performanceThreshold={35} />}
      <div className={`game-board-wrapper ${lowPerformanceMode ? 'performance-mode' : ''}`}>
        {renderBoard()}
        {showDevControls && renderDevControls()}
      </div>
    </NotificationProvider>
  );
};

export default GameBoard; 