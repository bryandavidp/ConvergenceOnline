import React, { useCallback, useState, useMemo, useRef, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../../store';
import useBoardInteraction from './hooks/useBoardInteraction';
import './GameBoard.css';
import { setHighlightedCells, setBoardSize, setSpawnRate, setLevel, setGameStatus } from '../../../store/slices/gameSlice';
import * as config from '../../../utils/config';
import { audioManager } from '../../../utils/audioManager';

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
  
  // Estado para mostrar/ocultar los controles de desarrollo
  const [showDevControls, setShowDevControls] = useState(false);
  
  // Estado para la velocidad personalizada
  const [customSpeedMultiplier, setCustomSpeedMultiplier] = useState(1);
  
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
  
  // Manejadores de eventos optimizados
  const handleCellClickOptimized = useCallback((row: number, col: number) => {
    // Añadir visual feedback inmediato antes de procesar la lógica
    const cellElement = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
    if (cellElement) {
      cellElement.classList.add('clicking');
      setTimeout(() => cellElement.classList.remove('clicking'), 150);
    }
    
    // Llamar al manejador original
    handleCellClick(row, col);
  }, [handleCellClick]);
  
  // Optimización: pre-calcular las celdas para reducir el tiempo de renderizado
  const cells = useMemo(() => {
    if (!board || board.length === 0 || (status !== 'playing' && status !== 'paused')) {
      return [];
    }
    
    const cellsArray = [];
    
    for (let row = 0; row < boardSize; row++) {
      for (let col = 0; col < boardSize; col++) {
        const cellContent = board[row] ? board[row][col] : null;
        const { icon, isRemoving } = processCellContent(cellContent);
        
        // Determinar clases para la celda
        const cellClasses = [
          'board-cell',
          isCellHighlighted(row, col) ? 'highlighted' : '',
          isRemoving ? 'removing' : '',
          icon && !isRemoving ? 'has-icon' : '',
          !icon ? 'empty' : ''
        ].filter(Boolean).join(' ');
        
        cellsArray.push(
          <div
            key={`cell-${row}-${col}`}
            className={cellClasses}
            onClick={() => handleCellClickOptimized(row, col)}
            ref={(el) => registerCellRef(row, col, el)}
            data-row={row}
            data-col={col}
          >
            {icon && <span className="cell-content">{icon}</span>}
          </div>
        );
      }
    }
    
    return cellsArray;
  }, [board, boardSize, status, processCellContent, isCellHighlighted, handleCellClickOptimized, registerCellRef]);
  
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
    
    // Mostrar la alerta de cambio de velocidad
    showSpeedAlertUI(multiplier);
    
    console.log(`Velocidad cambiada a ${multiplier}x (${newRate}ms)`);
  }, [dispatch, showSpeedAlertUI]);
  
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
  
  // Valores predefinidos de multiplicadores de velocidad
  const speedPresets = [0.5, 0.75, 1, 1.5, 2, 3];
  
  // Renderizar controles de desarrollo
  const renderDevControls = useCallback(() => {
    if (!showDevControls) return null;
    
    // Describir el impacto de cada velocidad
    const getSpeedDescription = (multiplier: number): string => {
      if (multiplier <= 0.5) return "Muy lento (para debug)";
      if (multiplier <= 0.75) return "Lento (principiantes)";
      if (multiplier <= 1.1) return "Normal (equilibrado)";
      if (multiplier <= 1.5) return "Rápido (intermedio)";
      if (multiplier <= 2.0) return "Muy rápido (avanzado)";
      return "Extremo (expertos)";
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
                min="0.5" 
                max="3" 
                step="0.1" 
                value={customSpeedMultiplier}
                onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
              />
            </div>
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
    handleBoardSizeChange, 
    handleShowHint, 
    handleSpeedChange,
    handleNextLevel
  ]);
  
  // Botón para mostrar/ocultar controles de desarrollo
  const renderDevToggle = useCallback(() => {
    return (
      <button 
        className="dev-toggle-btn"
        onClick={() => setShowDevControls(!showDevControls)}
      >
        {showDevControls ? 'Ocultar Controles' : 'Controles Dev'}
      </button>
    );
  }, [showDevControls]);
  
  // Renderizar el tablero como una grid
  const renderBoard = useCallback(() => {
    // Si el tablero está vacío o status no es 'playing', mostrar mensaje
    if (!board || board.length === 0 || (status !== 'playing' && status !== 'paused')) {
      return (
        <div className="empty-board-message">
          {status === 'startScreen' && 'Selecciona la configuración para comenzar'}
          {status === 'gameOver' && 'Juego terminado'}
          {status === 'levelCompleted' && '¡Nivel completado!'}
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
    <div className="game-board-wrapper">
      {renderBoard()}
      {renderDevToggle()}
      {renderDevControls()}
      
      {/* Alerta de aumento de velocidad */}
      {showSpeedAlert && (
        <div className="speed-alert visible">
          <div className="speed-alert-content">
            <span className="speed-icon">⚡</span>
            <span className="speed-text">¡Velocidad aumentada!</span>
            <span className="speed-value">x{speedMultiplier}</span>
          </div>
        </div>
      )}
      
      {/* Alerta de penalización */}
      {showPenaltyAlert && (
        <div className="penalty-alert visible">
          <div className="penalty-alert-content">
            <span className="penalty-icon">⚠️</span>
            <span className="penalty-text">¡Penalización! Velocidad aumentada</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default GameBoard; 