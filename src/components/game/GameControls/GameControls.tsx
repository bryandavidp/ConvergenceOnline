import React, { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { 
  resetGame, 
  setGameStatus, 
  setGameMode,
  GameState
} from '../../../store/slices/gameSlice';
import { RootState } from '../../../store';
import { useGameLogic } from '../../../hooks/useGameLogic';
import { audioManager } from '../../../utils/audioManager';
import logger from '../../../utils/logger';
import './GameControls.css';

const GameControls: React.FC = () => {
  const dispatch = useDispatch();
  const { status, currentMode } = useSelector((state: RootState) => state.game);
  const { showHint, stopTimers } = useGameLogic();
  
  // Estado para el sonido y la música
  const [soundEnabled, setSoundEnabled] = React.useState(audioManager.enabled);
  const [musicEnabled, setMusicEnabled] = React.useState(audioManager.musicEnabled);
  
  // Iniciar nuevo juego
  const handleNewGame = useCallback(() => {
    logger.info('GameControls', 'Iniciando nueva partida');
    audioManager.play('start');
    dispatch(resetGame(currentMode));
  }, [dispatch, currentMode]);
  
  // Mostrar pista
  const handleShowHint = useCallback(() => {
    logger.info('GameControls', 'Mostrando pista');
    const hint = showHint();
    return hint; // Para poder usar en animaciones u otros componentes
  }, [showHint]);
  
  // Pausar o reanudar el juego
  const handlePauseToggle = useCallback(() => {
    if (status === 'playing') {
      logger.info('GameControls', 'Pausando juego');
      dispatch(setGameStatus('paused'));
      audioManager.pauseMusic();
    } else if (status === 'paused') {
      logger.info('GameControls', 'Reanudando juego');
      dispatch(setGameStatus('playing'));
      if (musicEnabled) {
        audioManager.resumeMusic();
      }
    }
  }, [dispatch, status, musicEnabled]);
  
  // Activar/desactivar sonido
  const handleToggleSound = useCallback(() => {
    const newState = audioManager.toggleSound();
    setSoundEnabled(newState);
    logger.info('GameControls', `Sonido ${newState ? 'activado' : 'desactivado'}`);
  }, []);
  
  // Activar/desactivar música
  const handleToggleMusic = useCallback(() => {
    const newState = audioManager.toggleMusic();
    setMusicEnabled(newState);
    logger.info('GameControls', `Música ${newState ? 'activada' : 'desactivada'}`);
  }, []);

  return (
    <div className="game-controls">
      <button 
        className="control-button new-game"
        onClick={handleNewGame}
        aria-label="Nuevo juego"
      >
        <span role="img" aria-label="Nuevo juego">🔄</span>
      </button>
      
      <button 
        className="control-button hint"
        onClick={handleShowHint}
        disabled={status !== 'playing'}
        aria-label="Mostrar pista"
      >
        <span role="img" aria-label="Pista">💡</span>
      </button>
      
      <button 
        className="control-button pause-toggle"
        onClick={handlePauseToggle}
        disabled={status !== 'playing' && status !== 'paused'}
        aria-label={status === 'playing' ? 'Pausar' : 'Reanudar'}
      >
        <span role="img" aria-label={status === 'playing' ? 'Pausar' : 'Reanudar'}>
          {status === 'playing' ? '⏸️' : '▶️'}
        </span>
      </button>
      
      <button 
        className="control-button sound"
        onClick={handleToggleSound}
        aria-label={soundEnabled ? 'Desactivar sonido' : 'Activar sonido'}
      >
        <span role="img" aria-label="Sonido">
          {soundEnabled ? '🔊' : '🔇'}
        </span>
      </button>
      
      <button 
        className="control-button music"
        onClick={handleToggleMusic}
        aria-label={musicEnabled ? 'Desactivar música' : 'Activar música'}
      >
        <span role="img" aria-label="Música">
          {musicEnabled ? '🎵' : '🎵🚫'}
        </span>
      </button>
      
      <div className="theme-toggle">
        <input type="checkbox" id="theme-switch" className="theme-switch" />
        <label htmlFor="theme-switch" className="theme-switch-label">
          <span className="sun-icon">☀️</span>
          <span className="moon-icon">🌙</span>
          <span className="toggle-thumb"></span>
        </label>
      </div>
    </div>
  );
};

export default GameControls; 