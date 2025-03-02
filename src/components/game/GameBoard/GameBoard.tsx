import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../../store';
import useGameLogic from '../../../hooks/useGameLogic';
import logger from '../../../utils/logger';
import * as config from '../../../utils/originalGame/js/config';
import { audioManager } from '../../../utils/audioManager';
import './GameBoard.css';

interface CellProps {
  row: number;
  col: number;
  value: string | null;
  onClick: (row: number, col: number) => void;
}

// Componente para una celda individual
const Cell: React.FC<CellProps> = React.memo(({ row, col, value, onClick }) => {
  const isLight = (row + col) % 2 === 0;
  const cellClass = `cell ${isLight ? 'light' : 'dark'}`;
  
  return (
    <div 
      className={cellClass} 
      data-row={row} 
      data-col={col} 
      onClick={() => onClick(row, col)}
    >
      {value}
    </div>
  );
});

const GameBoard: React.FC = () => {
  const dispatch = useDispatch();
  const { board, boardSize, status } = useSelector((state: RootState) => state.game);
  const { handleCellClick, showHint } = useGameLogic();
  
  // Referencias
  const boardRef = useRef<HTMLDivElement>(null);
  const boardContainerRef = useRef<HTMLDivElement>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const [highlightedCells, setHighlightedCells] = useState<{[key: string]: string}>({});
  
  // Ajustar el tamaño del tablero según el contenedor
  const adjustBoardSize = useCallback(() => {
    if (!boardRef.current || !boardContainerRef.current) return;
    
    const containerWidth = boardContainerRef.current.clientWidth;
    const containerHeight = boardContainerRef.current.clientHeight;
    
    // Calcular el tamaño disponible (el mínimo entre ancho y alto)
    const size = Math.min(containerWidth, containerHeight) - 20; // Margen
    
    // Establecer el tamaño como variable CSS para el grid
    document.documentElement.style.setProperty('--board-size', boardSize.toString());
    
    // Calcular y establecer el tamaño de celda
    const cellSize = Math.max(30, Math.min(80, Math.floor(size / boardSize) - 2));
    document.documentElement.style.setProperty('--cell-size', `${cellSize}px`);
    
    logger.debug('GameBoard', 'Tablero ajustado', { containerSize: { width: containerWidth, height: containerHeight }, boardSize: size, cellSize });
  }, [boardSize]);
  
  // Función para limpiar destacados
  const clearHighlights = useCallback(() => {
    setHighlightedCells({});
  }, []);
  
  // Función para destacar celdas
  const highlightCells = useCallback((cells: {row: number, col: number}[], className: string) => {
    const newHighlights = {...highlightedCells};
    
    cells.forEach(({row, col}) => {
      const key = `${row},${col}`;
      newHighlights[key] = className;
    });
    
    setHighlightedCells(newHighlights);
  }, [highlightedCells]);
  
  // Manejar click en celda
  const onCellClick = useCallback((row: number, col: number) => {
    if (status !== 'playing') return;
    
    try {
      handleCellClick(row, col);
      clearHighlights();
    } catch (error) {
      logger.error('GameBoard', 'Error al hacer clic en celda', { row, col, error });
      // No propagar el error para evitar que se rompa la UI
    }
  }, [status, handleCellClick, clearHighlights]);
  
  // Mostrar una pista cuando se solicita
  const handleShowHint = useCallback(() => {
    if (status !== 'playing') return;
    
    const hint = showHint();
    if (hint) {
      clearHighlights();
      
      // Destacar las celdas que convergen
      if (hint.convergingIcons && hint.convergingIcons.length > 0) {
        highlightCells(hint.convergingIcons, 'hint');
      }
      
      // Si hay una celda objetivo, destacarla diferente
      if (hint.targetCell) {
        highlightCells([hint.targetCell], 'hint-target');
      }
      
      // Limpiar después de un tiempo
      setTimeout(clearHighlights, config.ANIMATION_DURATIONS.HINT);
    }
  }, [status, showHint, clearHighlights, highlightCells]);
  
  // Efecto para detectar solicitudes de pista globales
  useEffect(() => {
    const checkForHintRequest = () => {
      if ((window as any).gameHintRequested) {
        handleShowHint();
        (window as any).gameHintRequested = false;
      }
    };
    
    const intervalId = setInterval(checkForHintRequest, 100);
    
    return () => {
      clearInterval(intervalId);
    };
  }, [handleShowHint]);
  
  // Configurar observador de redimensionamiento
  useEffect(() => {
    if (!boardContainerRef.current) return;
    
    // Inicializar el ResizeObserver
    resizeObserverRef.current = new ResizeObserver(() => {
      adjustBoardSize();
    });
    
    // Observar el contenedor del tablero
    resizeObserverRef.current.observe(boardContainerRef.current);
    
    // Ajustar tamaño inicial
    adjustBoardSize();
    
    // También ajustar en cambios de orientación
    const handleOrientationChange = () => {
      setTimeout(adjustBoardSize, 300); // Pequeño retraso para asegurar que los valores sean correctos
    };
    
    window.addEventListener('resize', handleOrientationChange);
    window.addEventListener('orientationchange', handleOrientationChange);
    
    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
      window.removeEventListener('resize', handleOrientationChange);
      window.removeEventListener('orientationchange', handleOrientationChange);
    };
  }, [adjustBoardSize]);
  
  // Ajustar cuando cambia el tamaño del tablero
  useEffect(() => {
    adjustBoardSize();
  }, [boardSize, adjustBoardSize]);
  
  return (
    <div className="board-container" ref={boardContainerRef}>
      <div 
        className="board" 
        ref={boardRef}
      >
        {board.map((row, rowIndex) => 
          row.map((cell, colIndex) => (
            <Cell
              key={`${rowIndex}-${colIndex}`}
              row={rowIndex}
              col={colIndex}
              value={cell}
              onClick={onCellClick}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default GameBoard; 