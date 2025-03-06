import React, { useEffect, useCallback, forwardRef } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../../../store';
import '../GameBoard.css';
import Cell from './Cell';
import useBoardInteraction from '../hooks/useBoardInteraction';
import * as config from '../../../../utils/config';
import * as boardUtils from '../../../../utils/boardUtils';

interface BoardUIProps {
  // Propiedades adicionales si son necesarias
}

/**
 * Componente que renderiza el tablero de juego
 */
const BoardUI = forwardRef<HTMLDivElement, BoardUIProps>((props, ref) => {
  const { 
    board, 
    status, 
    boardSize, 
    level,
    iconCount
  } = useSelector((state: RootState) => state.game);
  
  const { 
    handleCellClick, 
    highlightedCells, 
    adjustBoardSize, 
    registerCellRef,
    showHint 
  } = useBoardInteraction();
  
  // Comprobar si una celda está resaltada
  const isCellHighlighted = useCallback((row: number, col: number): boolean => {
    return highlightedCells.some((cell: { row: number, col: number }) => cell.row === row && cell.col === col);
  }, [highlightedCells]);
  
  // Aplicar variables CSS para el tamaño de las celdas según la configuración
  useEffect(() => {
    // Obtener tamaño de celda basado en la configuración centralizada
    const cellSize = config.CSS_VARIABLES.cellSizeFormula(boardSize);
    
    // Aplicar variables CSS
    document.documentElement.style.setProperty('--cell-size', `${cellSize}px`);
    document.documentElement.style.setProperty('--board-size', `${boardSize}`);
    document.documentElement.style.setProperty('--cell-gap', `${config.DEFAULT_BOARD_CONFIG.cellMargin}px`);
    
    // También aplicar ajuste de tamaño del tablero
    const boardContainer = document.querySelector('.board-container') as HTMLElement;
    const boardElement = document.querySelector('.game-board') as HTMLElement;
    
    if (boardContainer && boardElement) {
      // Usar la configuración centralizada
      boardUtils.adjustBoardVisuals(boardContainer, boardElement, {
        size: boardSize,
        minCellSize: config.DEFAULT_BOARD_CONFIG.minCellSize,
        maxCellSize: config.DEFAULT_BOARD_CONFIG.maxCellSize,
        cellMargin: config.DEFAULT_BOARD_CONFIG.cellMargin
      });
    }
  }, [boardSize]);
  
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
  const boardClass = `game-board ${status === 'playing' ? 'active' : ''} ${boardSize > 8 ? 'large' : ''}`;
  
  return (
    <div ref={ref} className={boardClass}>
      {renderBoard()}
      
      {status === 'levelCompleted' && (
        <div className="level-complete-indicator">
          ¡Nivel Completado!
        </div>
      )}
    </div>
  );
});

BoardUI.displayName = 'BoardUI';

export default BoardUI; 