import React, { useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../../store';
import { setGameStatus, resetGame } from '../../../store/slices/gameSlice';
import useGameLogic from '../../../hooks/useGameLogic';
import { audioManager } from '../../../utils/audioManager';
import logger from '../../../utils/logger';
import * as config from '../../../utils/config';
import './GameControls.css';

const GameControls: React.FC = () => {
  const dispatch = useDispatch();
  const { status, boardSize, spawnRate } = useSelector((state: RootState) => state.game);
  const { showHint, stopTimers, startTimers } = useGameLogic();
  const [isMusicMuted, setIsMusicMuted] = useState<boolean>(false);
  const [isSoundMuted, setIsSoundMuted] = useState<boolean>(false);
  const [isDarkTheme, setIsDarkTheme] = useState<boolean>(false);
  
  // Manejar botón nueva partida
  const handleNewGame = useCallback(() => {
    logger.info('GameControls', 'Nueva partida iniciada');
    audioManager.play('start');
    dispatch(resetGame());
    setTimeout(() => {
      dispatch(setGameStatus('playing'));
    }, 300);
  }, [dispatch]);
  
  // Manejar botón de pausa/continuar
  const handlePauseToggle = useCallback(() => {
    if (status === 'playing') {
      logger.info('GameControls', 'Juego pausado');
      audioManager.play('pause');
      dispatch(setGameStatus('paused'));
    } else if (status === 'paused') {
      logger.info('GameControls', 'Juego reanudado');
      audioManager.play('resume');
      dispatch(setGameStatus('playing'));
    }
  }, [dispatch, status]);
  
  // Manejar botón de pista
  const handleHint = useCallback(() => {
    logger.info('GameControls', 'Pista solicitada');
    const hint = showHint();
    
    if (!hint) {
      logger.info('GameControls', 'No hay pistas disponibles');
      audioManager.play('error');
    }
    
    // La animación de la pista se maneja en el componente GameBoard
    if (hint) {
      // Indicar globalmente que se ha solicitado una pista
      (window as any).gameHintRequested = true;
    }
  }, [showHint]);
  
  // Manejar toggle de música
  const handleToggleMusic = useCallback(() => {
    const newState = audioManager.toggleMusic();
    setIsMusicMuted(!newState);
    logger.info('GameControls', `Música ${newState ? 'activada' : 'desactivada'}`);
  }, []);
  
  // Manejar toggle de sonidos
  const handleToggleSound = useCallback(() => {
    const newState = audioManager.toggleSound();
    setIsSoundMuted(!newState);
    logger.info('GameControls', `Efectos de sonido ${newState ? 'activados' : 'desactivados'}`);
  }, []);
  
  // Manejar toggle del tema
  const handleToggleTheme = useCallback(() => {
    setIsDarkTheme(!isDarkTheme);
    const html = document.documentElement;
    
    if (isDarkTheme) {
      html.classList.remove('dark-theme');
      html.classList.add('light-theme');
      logger.info('GameControls', 'Tema claro activado');
    } else {
      html.classList.remove('light-theme');
      html.classList.add('dark-theme');
      logger.info('GameControls', 'Tema oscuro activado');
    }
  }, [isDarkTheme]);
  
  // Efecto para inicializar temas
  useEffect(() => {
    // Detectar preferencia de tema del sistema
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (prefersDark) {
      setIsDarkTheme(true);
      document.documentElement.classList.add('dark-theme');
    } else {
      document.documentElement.classList.add('light-theme');
    }
    
    // Leer preferencias guardadas
    const savedMusicPref = localStorage.getItem('musicEnabled');
    const savedSoundPref = localStorage.getItem('soundEnabled');
    
    if (savedMusicPref) {
      const isEnabled = savedMusicPref !== 'false';
      setIsMusicMuted(!isEnabled);
    }
    
    if (savedSoundPref) {
      const isEnabled = savedSoundPref !== 'false';
      setIsSoundMuted(!isEnabled);
    }
    
    logger.component.mount('GameControls');
    return () => {
      logger.component.unmount('GameControls');
    };
  }, []);
  
  // Efecto para guardar preferencias
  useEffect(() => {
    localStorage.setItem('isMusicMuted', isMusicMuted.toString());
    localStorage.setItem('isSoundMuted', isSoundMuted.toString());
  }, [isMusicMuted, isSoundMuted]);
  
  // Calcular velocidad para mostrar
  const speedMultiplier = config.INITIAL_SPAWN_RATE / spawnRate;
  const speedDisplay = speedMultiplier.toFixed(1) + 'x';
  
  return (
    <div className="game-controls">
      <div className="controls action-buttons">
        <button 
          className="action-button" 
          onClick={handleNewGame} 
          title="Nueva partida"
        >
          🔄
        </button>
        
        <button 
          className="action-button" 
          onClick={handleHint} 
          title="Mostrar pista"
          disabled={status !== 'playing'}
        >
          💡
        </button>
        
        <button 
          className="action-button" 
          onClick={handlePauseToggle} 
          title={status === 'playing' ? 'Pausar' : 'Continuar'}
          disabled={status !== 'playing' && status !== 'paused'}
        >
          {status === 'playing' ? '⏸️' : '▶️'}
        </button>
        
        <button 
          className="action-button" 
          onClick={handleToggleSound} 
          title={isSoundMuted ? 'Activar sonidos' : 'Silenciar sonidos'}
        >
          {isSoundMuted ? '🔇' : '🔊'}
        </button>
        
        <button 
          className="action-button" 
          onClick={handleToggleMusic} 
          title={isMusicMuted ? 'Activar música' : 'Silenciar música'}
        >
          {isMusicMuted ? '🔇🎵' : '🔊🎵'}
        </button>
        
        <div className="theme-toggle">
          <input 
            type="checkbox" 
            id="theme-switch" 
            className="theme-switch" 
            checked={isDarkTheme}
            onChange={handleToggleTheme}
          />
          <label htmlFor="theme-switch" className="theme-switch-label">
            <span className="sun-icon">☀️</span>
            <span className="moon-icon">🌙</span>
            <span className="toggle-thumb"></span>
          </label>
        </div>
      </div>
      
      <div className="game-stats">
        <div className="stat speed-stat">
          <span className="stat-label">Velocidad:</span>
          <span className="stat-value">{speedDisplay}</span>
        </div>
        <div className="stat board-stat">
          <span className="stat-label">Tablero:</span>
          <span className="stat-value">{boardSize}x{boardSize}</span>
        </div>
      </div>
    </div>
  );
};

export default GameControls; 