import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../../store';
import useGameLogic from '../../../hooks/useGameLogic';
import logger from '../../../utils/logger';
import { audioManager } from '../../../utils/audioManager';
import * as gameConfig from '../../../config/gameConfig';
import './GameBoard.css';

// Componente para una celda individual
const Cell = React.memo(({ 
  row, 
  col, 
  value, 
  onClick,
  isHighlighted,
  registerCellRef
}: { 
  row: number; 
  col: number; 
  value: string | null; 
  onClick: (row: number, col: number) => void;
  isHighlighted?: boolean;
  registerCellRef?: (row: number, col: number, element: HTMLDivElement | null) => void;
}) => {
  const cellRef = useRef<HTMLDivElement>(null);

  // Registrar la referencia de la celda al montar el componente
  useEffect(() => {
    if (registerCellRef && cellRef.current) {
      registerCellRef(row, col, cellRef.current);
    }
  }, [row, col, registerCellRef]);

  return (
    <div 
      className={`cell ${isHighlighted ? 'highlighted' : ''} ${value ? 'occupied' : 'empty'}`} 
      data-row={row} 
      data-col={col} 
      onClick={() => onClick(row, col)}
      ref={cellRef}
    >
      {value}
    </div>
  );
});

Cell.displayName = 'Cell';

const GameBoard: React.FC = () => {
  const { board, boardSize, status } = useSelector((state: RootState) => state.game);
  const { 
    handleCellClick, 
    highlightedCells, 
    registerCellRef,
    adjustBoardSize
  } = useGameLogic();
  
  // Referencias
  const boardRef = useRef<HTMLDivElement>(null);
  const boardContainerRef = useRef<HTMLDivElement>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  
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
    if (boardRef.current && boardContainerRef.current) {
      adjustBoardSize(boardContainerRef.current, boardRef.current);
    }
    
    // Crear un observador de cambio de tamaño
    if (!resizeObserverRef.current && boardContainerRef.current) {
      resizeObserverRef.current = new ResizeObserver(() => {
        if (boardRef.current && boardContainerRef.current) {
          adjustBoardSize(boardContainerRef.current, boardRef.current);
        }
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
    if (boardRef.current && boardContainerRef.current) {
      adjustBoardSize(boardContainerRef.current, boardRef.current);
    }
  }, [board, boardSize, adjustBoardSize]);

  // Verificar si una celda está resaltada (para pistas)
  const isCellHighlighted = useCallback((row: number, col: number) => {
    return highlightedCells?.some(cell => cell.row === row && cell.col === col) || false;
  }, [highlightedCells]);
  
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
              isHighlighted={isCellHighlighted(rowIndex, colIndex)}
              registerCellRef={registerCellRef}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default GameBoard; 