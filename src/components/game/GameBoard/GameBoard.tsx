import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../../store';
import useGameLogic from '../../../hooks/useGameLogic';
import logger from '../../../utils/logger';
import { audioManager } from '../../../utils/audioManager';
import './GameBoard.css';

// Componente para una celda individual
const Cell = React.memo(({ 
  row, 
  col, 
  value, 
  onClick 
}: { 
  row: number; 
  col: number; 
  value: string | null; 
  onClick: (row: number, col: number) => void;
}) => {
  return (
    <div 
      className="cell" 
      data-row={row} 
      data-col={col} 
      onClick={() => onClick(row, col)}
    >
      {value}
    </div>
  );
});

Cell.displayName = 'Cell';

const GameBoard: React.FC = () => {
  const { board, boardSize, status } = useSelector((state: RootState) => state.game);
  const { handleCellClick } = useGameLogic();
  
  // Referencias
  const boardRef = useRef<HTMLDivElement>(null);
  const boardContainerRef = useRef<HTMLDivElement>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  
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
    const cellSize = Math.max(30, Math.min(80, Math.floor(size / boardSize) - 8));
    document.documentElement.style.setProperty('--cell-size', `${cellSize}px`);
    
    logger.debug('GameBoard', 'Tablero ajustado', { containerSize: { width: containerWidth, height: containerHeight }, boardSize: size, cellSize });
  }, [boardSize]);
  
  // Manejar click en celda
  const onCellClick = useCallback((row: number, col: number) => {
    if (status !== 'playing') return;
    
    try {
      // Reproducir sonido de clic
      audioManager.play('click');
      handleCellClick(row, col);
    } catch (error) {
      logger.error('GameBoard', 'Error al hacer clic en celda', { row, col, error });
    }
  }, [status, handleCellClick]);
  
  // Configurar el observador de tamaño
  useEffect(() => {
    // Ajustar el tamaño inicialmente
    adjustBoardSize();
    
    // Crear un observador de cambio de tamaño
    if (!resizeObserverRef.current && boardContainerRef.current) {
      resizeObserverRef.current = new ResizeObserver(() => {
        adjustBoardSize();
      });
      
      resizeObserverRef.current.observe(boardContainerRef.current);
    }
    
    // Limpiar
    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }
    };
  }, [adjustBoardSize]);
  
  // Ajustar el tamaño cuando cambia el tablero
  useEffect(() => {
    adjustBoardSize();
  }, [board, boardSize, adjustBoardSize]);
  
  return (
    <div className="board-container" ref={boardContainerRef}>
      <div 
        className="board" 
        ref={boardRef}
        style={{
          gridTemplateColumns: `repeat(${boardSize}, var(--cell-size))`,
          gridTemplateRows: `repeat(${boardSize}, var(--cell-size))`
        }}
      >
        {board && board.map((row, rowIndex) => 
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