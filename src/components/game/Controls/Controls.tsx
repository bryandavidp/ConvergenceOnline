// src/components/game/Controls/Controls.tsx
import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../../store';
import { 
  resetGame, 
  setGameStatus 
} from '../../../store/slices/gameSlice';
import useGameLogic from '../../../hooks/useGameLogic';
import { useAudio } from '../../../hooks/useAudio';
import './Controls.css';

const Controls: React.FC = () => {
  const dispatch = useDispatch();
  const { status } = useSelector((state: RootState) => state.game);
  const { showHint } = useGameLogic();
  const { 
    toggleSound, 
    toggleMusic, 
    isSoundEnabled, 
    isMusicEnabled 
  } = useAudio();
  
  const handleNewGame = () => {
    dispatch(resetGame());
  };
  
  const handlePause = () => {
    dispatch(setGameStatus(status === 'playing' ? 'paused' : 'playing'));
  };
  
  return (
    <div className="controls">
      <button 
        className="control-button" 
        onClick={handleNewGame}
      >
        Nueva Partida
      </button>
      
      {status === 'playing' && (
        <button 
          className="control-button" 
          onClick={showHint}
        >
          Pista
        </button>
      )}
      
      {(status === 'playing' || status === 'paused') && (
        <button 
          className="control-button" 
          onClick={handlePause}
        >
          {status === 'playing' ? '⏸️ Pausa' : '▶️ Reanudar'}
        </button>
      )}
      
      <button 
        className="control-button" 
        onClick={toggleSound}
      >
        {isSoundEnabled ? '🔊' : '🔇'}
      </button>
      
      <button 
        className="control-button" 
        onClick={toggleMusic}
      >
        {isMusicEnabled ? '🎵' : '🎵🚫'}
      </button>
    </div>
  );
};

export default Controls;
