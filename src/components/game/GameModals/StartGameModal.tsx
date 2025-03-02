import React, { useCallback, useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../../store';
import { setGameStatus, setGameMode } from '../../../store/slices/gameSlice';
import { audioManager } from '../../../utils/audioManager';
import logger from '../../../utils/logger';
import './GameModals.css';

interface StartGameModalProps {
  isVisible: boolean;
}

type GameMode = 'easy' | 'normal' | 'hard';

const StartGameModal: React.FC<StartGameModalProps> = ({ isVisible }) => {
  const dispatch = useDispatch();
  const { currentMode } = useSelector((state: RootState) => state.game);
  
  // Iniciar juego
  const handleStartGame = useCallback(() => {
    // Usar modo normal por defecto
    const modeToUse = 'normal';
    
    logger.info('StartGameModal', 'Juego iniciado en modo: ' + modeToUse);
    audioManager.play('start');
    
    // Actualizar el modo en el store si es necesario
    if (modeToUse !== currentMode) {
      dispatch(setGameMode(modeToUse));
    }
    
    // Cambiar el estado del juego a "playing" con un breve retraso
    setTimeout(() => {
      dispatch(setGameStatus('playing'));
    }, 300);
  }, [dispatch, currentMode]);
  
  if (!isVisible) return null;
  
  return (
    <div className="game-modal start-game">
      <div className="modal-content">
        <h1>Convergencia</h1>
        <p className="subtitle">Conecta y combina iconos iguales</p>
        
        <div className="game-icon-preview">
          {['🍎', '🍊', '🍇', '🍓'].map(icon => (
            <div key={icon} className="preview-icon">{icon}</div>
          ))}
        </div>
        
        <button className="start-button" onClick={handleStartGame}>
          Jugar
        </button>
      </div>
    </div>
  );
};

export default StartGameModal; 