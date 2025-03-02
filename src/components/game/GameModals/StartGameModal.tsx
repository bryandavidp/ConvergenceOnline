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

// Definir los tipos de modo de juego
type GameMode = 'easy' | 'normal' | 'hard' | 'tutorial';

const StartGameModal: React.FC<StartGameModalProps> = ({ isVisible }) => {
  const dispatch = useDispatch();
  const { currentMode } = useSelector((state: RootState) => state.game);
  const [selectedMode, setSelectedMode] = useState<GameMode>('normal');
  
  // Sincronizar el estado local con el del store cuando cambia
  useEffect(() => {
    if (currentMode) {
      setSelectedMode(currentMode as GameMode);
    }
  }, [currentMode]);
  
  // Iniciar juego
  const handleStartGame = useCallback(() => {
    // Asegurar que el modo sea válido antes de iniciar
    const modeToUse = selectedMode || 'normal';
    
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
  }, [dispatch, selectedMode, currentMode]);
  
  // Cambiar modo de juego
  const handleModeChange = useCallback((mode: GameMode) => {
    logger.info('StartGameModal', 'Modo de juego cambiado a: ' + mode);
    audioManager.play('button');
    
    // Actualizar primero el estado local para una respuesta inmediata en la UI
    setSelectedMode(mode);
    
    // Luego actualizar el estado global
    dispatch(setGameMode(mode));
  }, [dispatch]);
  
  if (!isVisible) return null;
  
  return (
    <div className="game-modal start-game">
      <div className="modal-content">
        <h1>Juego de Convergencia</h1>
        <p className="subtitle">Un juego de lógica y estrategia</p>
        
        <div className="game-instructions">
          <h3>Cómo jugar:</h3>
          <p>Haz clic en una celda vacía para eliminar los iconos que convergen hacia ella.</p>
          <p>Los iconos convergen si son del mismo tipo y están en la misma fila, columna o diagonal.</p>
          <p>¡Elimina todos los iconos para avanzar al siguiente nivel!</p>
        </div>
        
        <div className="game-modes">
          <h3>Modos de juego:</h3>
          <div className="mode-buttons">
            <button 
              className={`mode-button ${selectedMode === 'easy' ? 'active' : ''}`} 
              onClick={() => handleModeChange('easy')}
              aria-pressed={selectedMode === 'easy'}
            >
              Fácil
            </button>
            <button 
              className={`mode-button ${selectedMode === 'normal' ? 'active' : ''}`} 
              onClick={() => handleModeChange('normal')}
              aria-pressed={selectedMode === 'normal'}
            >
              Normal
            </button>
            <button 
              className={`mode-button ${selectedMode === 'hard' ? 'active' : ''}`} 
              onClick={() => handleModeChange('hard')}
              aria-pressed={selectedMode === 'hard'}
            >
              Difícil
            </button>
          </div>
        </div>
        
        <button className="start-button" onClick={handleStartGame}>
          ¡Comenzar Juego!
        </button>
      </div>
    </div>
  );
};

export default StartGameModal; 