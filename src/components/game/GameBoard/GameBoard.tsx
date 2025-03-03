import React, { useState, useEffect, useRef, useCallback, forwardRef } from 'react';
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

// Usar forwardRef para poder pasar la referencia desde el componente padre
const GameBoard = forwardRef<HTMLDivElement, {}>((props, ref) => {
  const { board, handleCellClick, highlightedCells, adjustBoardSize, registerCellRef } = useGameLogic();
  const { status, boardSize } = useSelector((state: RootState) => state.game);
  
  // Referencia al contenedor del tablero
  const boardContainerRef = useRef<HTMLDivElement>(null);
  
  // Efecto para ajustar el tamaño del tablero cuando cambia su dimensión
  useEffect(() => {
    const boardElement = ref as React.RefObject<HTMLDivElement>;
    if (boardContainerRef.current && boardElement && boardElement.current) {
      adjustBoardSize(boardContainerRef.current, boardElement.current);
    }
  }, [boardSize, adjustBoardSize, ref]);
  
  // Comprobar si una celda está resaltada
  const isCellHighlighted = useCallback((row: number, col: number): boolean => {
    return highlightedCells.some(cell => cell.row === row && cell.col === col);
  }, [highlightedCells]);
  
  // Renderizar el contenido del tablero
  const renderBoard = () => {
    const boardContent = [];
    
    for (let row = 0; row < boardSize; row++) {
      const rowContent = [];
      
      for (let col = 0; col < boardSize; col++) {
        const cellValue = board && board[row] ? board[row][col] : null;
        const isHighlighted = isCellHighlighted(row, col);
        
        rowContent.push(
          <Cell 
            key={`cell-${row}-${col}`}
            row={row}
            col={col}
            value={cellValue}
            onClick={handleCellClick}
            isHighlighted={isHighlighted}
            registerCellRef={registerCellRef}
          />
        );
      }
      
      boardContent.push(
        <div key={`row-${row}`} className="board-row">
          {rowContent}
        </div>
      );
    }
    
    return boardContent;
  };
  
  // Determinar clases adicionales para el tablero basadas en su estado
  const boardClass = `game-board ${status === 'playing' ? 'active' : ''}`;
  
  return (
    <div ref={boardContainerRef} className="board-container">
      <div ref={ref} className={boardClass}>
        {renderBoard()}
      </div>
    </div>
  );
});

// Añadir nombre para depuración
GameBoard.displayName = 'GameBoard';

export default GameBoard; 