import React, { useEffect, useRef, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../../store';
import GameCell from '../GameCell/GameCell';
import { useGameLogic } from '../../../hooks/useGameLogic';
import logger from '../../../utils/logger';
import './GameBoard.css';

const GameBoard: React.FC = () => {
  const { board, boardSize, status } = useSelector((state: RootState) => state.game);
  const { handleCellClick } = useGameLogic();
  const boardRef = useRef<HTMLDivElement>(null);
  
  // Ajustar tamaño del tablero
  const adjustBoardSize = useCallback(() => {
    if (!boardRef.current) return;
    
    const boardContainer = boardRef.current.parentElement;
    if (!boardContainer) return;
    
    const containerWidth = boardContainer.clientWidth;
    const containerHeight = boardContainer.clientHeight;
    const size = Math.min(containerWidth, containerHeight) - 10;
    
    boardRef.current.style.width = `${size}px`;
    boardRef.current.style.height = `${size}px`;
    
    // Ajustar tamaño de celda
    const cellSize = (size / boardSize) - 2;
    document.documentElement.style.setProperty('--cell-size', `${cellSize}px`);
    
    logger.debug('GameBoard', 'Tamaño del tablero ajustado', { size, cellSize });
  }, [boardSize]);
  
  // Ajustar tamaño al cambiar dimensiones o tamaño
  useEffect(() => {
    logger.component.mount('GameBoard');
    
    // Ajuste inicial
    adjustBoardSize();
    
    // Ajuste en resize
    window.addEventListener('resize', adjustBoardSize);
    
    return () => {
      logger.component.unmount('GameBoard');
      window.removeEventListener('resize', adjustBoardSize);
    };
  }, [adjustBoardSize]);
  
  // Re-ajustar al cambiar el tamaño del tablero
  useEffect(() => {
    adjustBoardSize();
  }, [boardSize, adjustBoardSize]);
  
  // Registrar renderización
  useEffect(() => {
    logger.component.render('GameBoard');
  }, [board]);

  const onCellClick = useCallback((row: number, col: number) => {
    if (status === 'playing') {
      handleCellClick(row, col);
    }
  }, [status, handleCellClick]);

  return (
    <div 
      ref={boardRef}
      className="board"
      style={{
        gridTemplateColumns: `repeat(${boardSize}, var(--cell-size))`,
        gridTemplateRows: `repeat(${boardSize}, var(--cell-size))`
      }}
    >
      {board.map((row, rowIndex) => 
        row.map((icon, colIndex) => (
          <GameCell
            key={`${rowIndex}-${colIndex}`}
            icon={icon}
            row={rowIndex}
            col={colIndex}
            onClick={() => onCellClick(rowIndex, colIndex)}
            isEven={(rowIndex + colIndex) % 2 === 0}
          />
        ))
      )}
    </div>
  );
};

export default React.memo(GameBoard); 