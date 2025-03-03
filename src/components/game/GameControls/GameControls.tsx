import React, { useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../../store';
import { setGameStatus, resetGame } from '../../../store/slices/gameSlice';
import useGameLogic from '../../../hooks/useGameLogic';
import { audioManager } from '../../../utils/audioManager';
import { createLogger } from '../../../utils/logUtils';
import * as gameConfig from '../../../config/gameConfig';
import './GameControls.css';

// Crear un logger específico para este componente
const logger = createLogger('GameControls');

const GameControls: React.FC = () => {
  const dispatch = useDispatch();
  const { status, boardSize, spawnRate } = useSelector((state: RootState) => state.game);
  const { showHint, stopTimers, startTimers } = useGameLogic();
  const [isMusicMuted, setIsMusicMuted] = useState<boolean>(false);
  const [isSoundMuted, setIsSoundMuted] = useState<boolean>(false);
  const [isDarkTheme, setIsDarkTheme] = useState<boolean>(false);
  
  // Manejar botón nueva partida
  const handleNewGame = useCallback(() => {
    const transaction = logger.transaction('iniciar-nueva-partida');
    
    logger.userAction('Nueva partida iniciada', {
      prevStatus: status,
      boardSize
    });
    
    audioManager.play('start');
    dispatch(resetGame());
    
    setTimeout(() => {
      dispatch(setGameStatus('playing'));
      transaction.success('Juego iniciado correctamente');
    }, 300);
  }, [dispatch, status, boardSize]);
  
  // Manejar botón de pausa/continuar
  const handlePauseToggle = useCallback(() => {
    if (status === 'playing') {
      logger.userAction('Juego pausado', { 
        tiempoTranscurrido: document.querySelector('.timer-value')?.textContent 
      });
      audioManager.play('pause');
      dispatch(setGameStatus('paused'));
    } else if (status === 'paused') {
      logger.userAction('Juego reanudado', { 
        tiempoPausado: document.querySelector('.timer-value')?.textContent 
      });
      audioManager.play('resume');
      dispatch(setGameStatus('playing'));
    }
  }, [dispatch, status]);
  
  // Manejar botón de pista
  const handleHint = useCallback(() => {
    const timer = logger.timer('mostrar-pista');
    
    logger.userAction('Pista solicitada', {
      estadoJuego: status,
      tablero: `${boardSize}x${boardSize}`
    });
    
    showHint();
    
    logger.debug('Pista solicitada correctamente');
    
    timer.end();
    // La animación de la pista se maneja en el componente GameBoard a través del estado highlightedCells
  }, [showHint, status, boardSize]);
  
  // Manejar toggle de música
  const handleToggleMusic = useCallback(() => {
    const newState = audioManager.toggleMusic();
    setIsMusicMuted(!newState);
    
    logger.userAction(`Música ${newState ? 'activada' : 'desactivada'}`, {
      estadoPrevio: !newState
    });
  }, []);
  
  // Manejar toggle de sonidos
  const handleToggleSound = useCallback(() => {
    const newState = audioManager.toggleSound();
    setIsSoundMuted(!newState);
    
    logger.userAction(`Efectos de sonido ${newState ? 'activados' : 'desactivados'}`, {
      estadoPrevio: !newState
    });
  }, []);
  
  // Manejar toggle del tema
  const handleToggleTheme = useCallback(() => {
    setIsDarkTheme(!isDarkTheme);
    const html = document.documentElement;
    
    if (isDarkTheme) {
      html.classList.remove('dark-theme');
      html.classList.add('light-theme');
      logger.userAction('Tema claro activado');
    } else {
      html.classList.remove('light-theme');
      html.classList.add('dark-theme');
      logger.userAction('Tema oscuro activado');
    }
  }, [isDarkTheme]);
  
  // Efecto para inicializar temas
  useEffect(() => {
    const lifecycleLog = logger.subcontext('Inicialización');
    lifecycleLog.lifecycle('Montando componente');
    
    // Detectar preferencia de tema del sistema
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    lifecycleLog.debug('Preferencia de tema detectada', { prefersDark });
    
    if (prefersDark) {
      setIsDarkTheme(true);
      document.documentElement.classList.add('dark-theme');
    } else {
      document.documentElement.classList.add('light-theme');
    }
    
    // Leer preferencias guardadas
    const savedMusicPref = localStorage.getItem('musicEnabled');
    const savedSoundPref = localStorage.getItem('soundEnabled');
    
    lifecycleLog.debug('Preferencias de usuario cargadas', {
      musicaGuardada: savedMusicPref,
      sonidoGuardado: savedSoundPref
    });
    
    if (savedMusicPref) {
      const isEnabled = savedMusicPref !== 'false';
      setIsMusicMuted(!isEnabled);
    }
    
    if (savedSoundPref) {
      const isEnabled = savedSoundPref !== 'false';
      setIsSoundMuted(!isEnabled);
    }
    
    logger.component.mount();
    return () => {
      logger.component.unmount();
      lifecycleLog.lifecycle('Componente desmontado');
    };
  }, []);
  
  // Efecto para guardar preferencias
  useEffect(() => {
    localStorage.setItem('isMusicMuted', isMusicMuted.toString());
    localStorage.setItem('isSoundMuted', isSoundMuted.toString());
    
    logger.debug('Preferencias de usuario guardadas', {
      isMusicMuted,
      isSoundMuted
    });
  }, [isMusicMuted, isSoundMuted]);
  
  // Calcular velocidad para mostrar
  const baseSpawnRate = gameConfig.SPAWN_RATES.MEDIUM; // Usamos el MEDIUM como base
  const speedMultiplier = baseSpawnRate / spawnRate;
  const speedDisplay = speedMultiplier.toFixed(1) + 'x';
  
  // Renderizar el componente
  logger.component.render();
  
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