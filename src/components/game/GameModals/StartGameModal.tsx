import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { setGameStatus, setGameMode } from '../../../store/slices/gameSlice';
import { audioManager } from '../../../utils/audioManager';
import logger from '../../../utils/logger';
import './GameModals.css';

interface StartGameModalProps {
  isVisible: boolean;
}

// Definir tipos de acuerdo con GameState
type GameMode = 'easy' | 'normal' | 'hard' | 'tutorial';

const StartGameModal: React.FC<StartGameModalProps> = ({ isVisible }) => {
  const dispatch = useDispatch();
  const [selectedDifficulty, setSelectedDifficulty] = useState<GameMode>('normal');
  const [selectedMode, setSelectedMode] = useState<string>('normal');
  
  const handleStartGame = () => {
    // Registrar inicio del juego
    logger.info('StartGameModal', `Juego iniciado en modo: ${selectedMode}`);
    
    // Actualizar el estado global con la dificultad y modo seleccionados
    dispatch(setGameMode(selectedDifficulty));
    
    // Cambiar el estado del juego a 'playing'
    dispatch(setGameStatus('playing'));
    
    // Reproducir sonido de inicio
    audioManager.play('start');
    
    // Esperar un momento antes de iniciar la música
    setTimeout(() => {
      // Reproducir música de fondo si está habilitada
      audioManager.startMusic();
    }, 500);
  };
  
  if (!isVisible) return null;
  
  return (
    <div className="modal-container">
      <div className="modal-content">
        <h2>¡Convergencia!</h2>
        <p>Une los mismos iconos desde direcciones opuestas.</p>
        
        <div className="form-group">
          <label>Dificultad:</label>
          <div className="button-group">
            <button 
              className={selectedDifficulty === 'easy' ? 'active' : ''} 
              onClick={() => setSelectedDifficulty('easy')}
            >
              Fácil
            </button>
            <button 
              className={selectedDifficulty === 'normal' ? 'active' : ''} 
              onClick={() => setSelectedDifficulty('normal')}
            >
              Normal
            </button>
            <button 
              className={selectedDifficulty === 'hard' ? 'active' : ''} 
              onClick={() => setSelectedDifficulty('hard')}
            >
              Difícil
            </button>
          </div>
        </div>
        
        <div className="form-group">
          <label>Modo de juego:</label>
          <div className="button-group">
            <button 
              className={selectedMode === 'normal' ? 'active' : ''} 
              onClick={() => setSelectedMode('normal')}
            >
              Normal
            </button>
            <button 
              className={selectedMode === 'timed' ? 'active' : ''} 
              onClick={() => setSelectedMode('timed')}
            >
              Contrarreloj
            </button>
            <button 
              className={selectedMode === 'zen' ? 'active' : ''} 
              onClick={() => setSelectedMode('zen')}
            >
              Zen
            </button>
          </div>
        </div>
        
        <button className="start-button" onClick={handleStartGame}>
          ¡Jugar Ahora!
        </button>
      </div>
    </div>
  );
};

export default StartGameModal; 