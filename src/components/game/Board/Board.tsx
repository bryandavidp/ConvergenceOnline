// src/components/game/Board/Board.tsx (optimizado)
import React, { useEffect, useRef, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../../store';
import Cell from '../Cell/Cell';
import useGameLogic from '../../../hooks/useGameLogic';
import './Board.css';

interface BoardProps {
  size: number;
}

const Board: React.FC<BoardProps> = React.memo(({ size }) => {
  const { board } = useSelector((state: RootState) => state.game);
  const { handleCellClick } = useGameLogic();
  const boardRef = useRef<HTMLDivElement>(null);
  
  // Memoizar la función de clic
  const onCellClick = useCallback((row: number, col: number) => {
    handleCellClick(row, col);
  }, [handleCellClick]);
  
  // Ajustar tamaño del tablero
  useEffect(() => {
    const adjustBoardSize = () => {
      if (!boardRef.current) return;
      
      const boardContainer = boardRef.current.parentElement;
      if (!boardContainer) return;
      
      const containerWidth = boardContainer.clientWidth;
      const containerHeight = boardContainer.clientHeight;
      const boardSize = Math.min(containerWidth, containerHeight) - 10;
      
      boardRef.current.style.width = `${boardSize}px`;
      boardRef.current.style.height = `${boardSize}px`;
      
      // Ajustar tamaño de celda
      const cellSize = (boardSize / size) - 2;
      document.documentElement.style.setProperty('--cell-size', `${cellSize}px`);
    };
    
    adjustBoardSize();
    
    window.addEventListener('resize', adjustBoardSize);
    return () => window.removeEventListener('resize', adjustBoardSize);
  }, [size]);
  
  return (
    <div 
      ref={boardRef}
      className="board"
      style={{
        gridTemplateColumns: `repeat(${size}, var(--cell-size))`,
        gridTemplateRows: `repeat(${size}, var(--cell-size))`
      }}
    >
      {board.map((row, rowIndex) => 
        row.map((icon, colIndex) => (
          <Cell
            key={`${rowIndex}-${colIndex}`}
            icon={icon}
            row={rowIndex}
            col={colIndex}
            onClick={() => onCellClick(rowIndex, colIndex)}
          />
        ))
      )}
    </div>
  );
});

export default Board;
