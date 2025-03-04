import React, { useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../../store';
import useBoardInteraction from './hooks/useBoardInteraction';
import './GameBoard.css';

const GameBoard: React.FC = () => {
  const { 
    board, 
    boardSize, 
    status, 
    highlightedCells
  } = useSelector((state: RootState) => state.game);
  
  const { 
    handleCellClick, 
    registerCellRef
  } = useBoardInteraction();
  
  // Verificar si una celda está resaltada
  const isCellHighlighted = useCallback((row: number, col: number) => {
    return highlightedCells.some(cell => cell.row === row && cell.col === col);
  }, [highlightedCells]);
  
  // Procesar el contenido de la celda para manejar estados especiales
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
  
  // Renderizar el tablero como una grid
  const renderBoard = () => {
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
    
    // Crear un array de filas y columnas para la estructura del grid
    const rows = [];
    
    for (let row = 0; row < boardSize; row++) {
      const cells = [];
      
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
        
        cells.push(
          <div
            key={`cell-${row}-${col}`}
            className={cellClasses}
            onClick={() => handleCellClick(row, col)}
            ref={(el) => registerCellRef(row, col, el)}
            data-row={row}
            data-col={col}
          >
            {icon && <span className="cell-content">{icon}</span>}
          </div>
        );
      }
      
      rows.push(
        <div key={`row-${row}`} className="board-row" style={{ display: 'contents' }}>
          {cells}
        </div>
      );
    }
    
    // Calcular el estilo del grid basado en el tamaño del tablero
    const gridStyle = {
      gridTemplateColumns: `repeat(${boardSize}, 1fr)`,
      gridTemplateRows: `repeat(${boardSize}, 1fr)`
    };
    
    return (
      <div className="game-board-grid" style={gridStyle}>
        {rows}
      </div>
    );
  };
  
  return (
    <div className="game-board-wrapper">
      {renderBoard()}
    </div>
  );
};

export default GameBoard; 