import React, { useState, useEffect, useRef, useCallback, forwardRef } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../../store';
import useGameLogic from '../../../hooks/useGameLogic';
import logger from '../../../utils/logger';
import { audioManager } from '../../../utils/audioManager';
import * as config from '../../../utils/config';
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
  const isRemoving = value?.includes('_removing') || false;
  
  // Extraer el icono base en caso de que incluya "_removing"
  const displayValue = isRemoving && value ? value.split('_')[0] : value;

  // Registrar la referencia de la celda al montar el componente
  useEffect(() => {
    if (registerCellRef && cellRef.current) {
      registerCellRef(row, col, cellRef.current);
    }
    
    return () => {
      // Limpiar la referencia al desmontar
      if (registerCellRef) {
        registerCellRef(row, col, null);
      }
    };
  }, [row, col, registerCellRef]);

  // Manejador de clics específico para esta celda
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault(); // Prevenir comportamiento por defecto
    e.stopPropagation(); // Evitar propagación
    onClick(row, col);
  };

  return (
    <div 
      className={`cell ${isHighlighted ? 'highlighted' : ''} ${value ? 'occupied' : 'empty'} ${isRemoving ? 'removing' : ''}`} 
      data-row={row} 
      data-col={col} 
      onClick={handleClick}
      ref={cellRef}
    >
      {displayValue}
    </div>
  );
});

Cell.displayName = 'Cell';

// Usar forwardRef para poder pasar la referencia desde el componente padre
const GameBoard = forwardRef<HTMLDivElement, {}>((props, ref) => {
  const { 
    board, 
    handleCellClick, 
    highlightedCells, 
    adjustBoardSize, 
    registerCellRef,
    showHint 
  } = useGameLogic();
  
  const { 
    status, 
    boardSize, 
    hintsRemaining, 
    hintCooldown, 
    level,
    iconCount
  } = useSelector((state: RootState) => state.game);
  
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
  
  // Manejar clic en el botón de pista
  const handleHintClick = useCallback(() => {
    if (status === 'playing' && !hintCooldown && hintsRemaining > 0) {
      showHint();
    } else if (hintCooldown) {
      logger.info('Pista', 'No se puede usar la pista: en período de enfriamiento');
    } else if (hintsRemaining <= 0) {
      logger.info('Pista', 'No quedan pistas disponibles para este nivel');
    }
  }, [status, hintCooldown, hintsRemaining, showHint]);
  
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
    <div ref={boardContainerRef} className="board-container">
      <div className="board-controls">
        <div className="board-info">
          <span className="level-indicator">Nivel {level}</span>
          <span className="icon-count-indicator">Iconos: {iconCount}</span>
        </div>
        
        <button 
          className={`hint-button ${hintCooldown ? 'cooldown' : ''} ${hintsRemaining <= 0 ? 'disabled' : ''}`}
          onClick={handleHintClick}
          disabled={hintCooldown || hintsRemaining <= 0 || status !== 'playing'}
        >
          <span role="img" aria-label="pista">💡</span>
          <span className="hint-count">{hintsRemaining}</span>
        </button>
      </div>
      
      <div ref={ref} className={boardClass}>
        {renderBoard()}
      </div>
      
      {status === 'levelCompleted' && (
        <div className="level-complete-indicator">
          ¡Nivel Completado!
        </div>
      )}
    </div>
  );
});

// Añadir nombre para depuración
GameBoard.displayName = 'GameBoard';

export default GameBoard; 