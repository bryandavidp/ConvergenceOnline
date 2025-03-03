import React, { useEffect, useRef, forwardRef } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../../store';
import useBoardInteraction from './hooks/useBoardInteraction';
import BoardUI from './components/BoardUI';
import './GameBoard.css';

// Usar forwardRef para poder pasar la referencia desde el componente padre
const GameBoard = forwardRef<HTMLDivElement, {}>((props, ref) => {
  const { 
    status, 
    boardSize, 
    hintsRemaining, 
    hintCooldown, 
    level,
    iconCount
  } = useSelector((state: RootState) => state.game);
  
  const { 
    adjustBoardSize, 
    showHint, 
    showSpeedAlert, 
    speedMultiplier, 
    showPenaltyAlert 
  } = useBoardInteraction();
  
  // Referencia al contenedor del tablero
  const boardContainerRef = useRef<HTMLDivElement>(null);
  
  // Efecto para ajustar el tamaño del tablero cuando cambia su dimensión
  useEffect(() => {
    const boardElement = ref as React.RefObject<HTMLDivElement>;
    if (boardContainerRef.current && boardElement && boardElement.current) {
      adjustBoardSize(boardContainerRef.current, boardElement.current);
    }
  }, [boardSize, adjustBoardSize, ref]);
  
  return (
    <div ref={boardContainerRef} className="board-container">
      <div className="board-controls">
        <div className="board-info">
          <span className="level-indicator">Nivel {level}</span>
          <span className="icon-count-indicator">Iconos: {iconCount}</span>
        </div>
        
        <button 
          className={`hint-button ${hintCooldown ? 'cooldown' : ''} ${hintsRemaining <= 0 ? 'disabled' : ''}`}
          onClick={showHint}
          disabled={hintCooldown || hintsRemaining <= 0 || status !== 'playing'}
        >
          <span role="img" aria-label="pista">💡</span>
          <span className="hint-count">{hintsRemaining}</span>
        </button>
      </div>
      
      <BoardUI ref={ref} />
      
      {/* Alertas visuales */}
      <div className={`speed-alert ${showSpeedAlert ? 'visible' : ''}`}>
        ¡Velocidad x{speedMultiplier}!
      </div>
      
      <div className={`penalty-alert ${showPenaltyAlert ? 'visible' : ''}`}>
        ¡Penalización! Velocidad aumentada
      </div>
    </div>
  );
});

// Añadir nombre para depuración
GameBoard.displayName = 'GameBoard';

export default GameBoard; 