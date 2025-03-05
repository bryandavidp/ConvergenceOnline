import React, { useState, useEffect, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { setGameMode, setPlayMode, setGameStatus, GameDifficulty, GamePlayMode } from '../../../store/slices/gameSlice';
import { audioManager } from '../../../utils/audioManager';
import logger from '../../../utils/logger';
import * as config from '../../../utils/config';
import './GameModals.css';

interface StartGameModalProps {
  isVisible?: boolean;
  onStart?: () => void;
}

const StartGameModal: React.FC<StartGameModalProps> = ({ isVisible = true, onStart }) => {
  const dispatch = useDispatch();
  // Recuperar preferencias guardadas o usar valores predeterminados
  const [selectedDifficulty, setSelectedDifficulty] = useState<GameDifficulty>(
    localStorage.getItem('gameDifficulty') as GameDifficulty || 'normal'
  );
  const [selectedMode, setSelectedMode] = useState<GamePlayMode>(
    localStorage.getItem('gamePlayMode') as GamePlayMode || 'classic'
  );
  const [isClosing, setIsClosing] = useState(false);
  
  // Estados para la configuración
  const [soundEnabled, setSoundEnabled] = useState<boolean>(
    localStorage.getItem('soundEnabled') !== 'false'
  );
  const [musicEnabled, setMusicEnabled] = useState<boolean>(
    localStorage.getItem('musicEnabled') !== 'false'
  );
  const [showSettings, setShowSettings] = useState<boolean>(false);
  
  // Referencia para cerrar el panel de configuración al hacer clic fuera
  const settingsPanelRef = useRef<HTMLDivElement>(null);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  
  useEffect(() => {
    // Reiniciar el estado de cierre cuando el modal vuelve a ser visible
    if (isVisible) {
      setIsClosing(false);
    }
    
    // Aplicar la configuración de sonido y música
    if (audioManager.enabled !== soundEnabled) {
      audioManager.toggleSound();
    }
    
    if (audioManager.musicEnabled !== musicEnabled) {
      audioManager.toggleMusic();
    }
  }, [isVisible, soundEnabled, musicEnabled]);
  
  // Efecto para cerrar la configuración al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showSettings && 
          settingsPanelRef.current && 
          settingsButtonRef.current &&
          !settingsPanelRef.current.contains(event.target as Node) && 
          !settingsButtonRef.current.contains(event.target as Node)) {
        setShowSettings(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSettings]);
  
  const handleStartGame = () => {
    // Efectos visuales y auditivos al iniciar el juego
    if (soundEnabled) {
      audioManager.play('start');
    }
    
    // Mostrar animación de cierre
    setIsClosing(true);
    
    // Registrar inicio del juego
    logger.info('StartGameModal', `Juego iniciado en modo: ${selectedMode}, dificultad: ${selectedDifficulty}`);
    
    // Esperar a que termine la animación antes de cambiar el estado
    setTimeout(() => {
      // Actualizar el estado global con la dificultad y modo seleccionados
      dispatch(setGameMode(selectedDifficulty));
      dispatch(setPlayMode(selectedMode));
      
      // Almacenar el modo de juego en localStorage para futuras referencias
      localStorage.setItem('gamePlayMode', selectedMode);
      localStorage.setItem('gameDifficulty', selectedDifficulty);
      
      // Cambiar el estado del juego a 'playing'
      dispatch(setGameStatus('playing'));
      
      // Llamar a la función onStart si se proporcionó
      if (onStart) {
        onStart();
      }
    }, 500);
  };
  
  const handleModeSelect = (mode: GamePlayMode) => {
    setSelectedMode(mode);
    // Reproducir sonido de selección
    if (soundEnabled) {
      audioManager.play('select');
    }
  };
  
  const handleDifficultySelect = (difficulty: GameDifficulty) => {
    setSelectedDifficulty(difficulty);
    // Reproducir sonido de selección
    if (soundEnabled) {
      audioManager.play('select');
    }
  };
  
  const toggleSound = () => {
    const newState = !soundEnabled;
    setSoundEnabled(newState);
    localStorage.setItem('soundEnabled', String(newState));
    if (newState) {
      audioManager.play('click');
    }
  };
  
  const toggleMusic = () => {
    const newState = !musicEnabled;
    setMusicEnabled(newState);
    localStorage.setItem('musicEnabled', String(newState));
    if (soundEnabled) {
      audioManager.play('click');
    }
  };
  
  const toggleSettings = () => {
    setShowSettings(!showSettings);
    if (soundEnabled) {
      audioManager.play('click');
    }
  };
  
  // Si el modal no es visible, no renderizar nada
  if (!isVisible && !isClosing) {
    return null;
  }
  
  return (
    <div className={`game-modal start-game ${isVisible ? 'visible' : 'hidden'} ${isClosing ? 'closing' : ''}`}>
      <div className="modal-content">
        <div className="start-game-header">
          <h1>Convergencia</h1>
          <h2>Un juego de estrategia</h2>
          
          <div className="game-icon-preview">
            {["🍎", "🍊", "🍇", "🍓", "🍐"].map((icon, index) => (
              <div key={index} className="preview-icon" style={{ animationDelay: `${index * 0.2}s` }}>
                {icon}
              </div>
            ))}
          </div>
        </div>
        
        <div className="start-game-body">
          <div className="form-group">
            <div className="form-label">Selecciona un modo de juego:</div>
            <div className="mode-options">
              <div 
                className={`game-option ${selectedMode === 'classic' ? 'active' : ''}`}
                onClick={() => handleModeSelect('classic')}
              >
                <span className="option-icon">🏅</span>
                <span>Clásico</span>
              </div>
              <div 
                className={`game-option ${selectedMode === 'timed' ? 'active' : ''}`}
                onClick={() => handleModeSelect('timed')}
              >
                <span className="option-icon">⏳</span>
                <span>Contrarreloj</span>
              </div>
              <div 
                className={`game-option ${selectedMode === 'survival' ? 'active' : ''}`}
                onClick={() => handleModeSelect('survival')}
              >
                <span className="option-icon">🔥</span>
                <span>Supervivencia</span>
              </div>
            </div>
          </div>
          
          <div className="form-group">
            <div className="form-label">Selecciona la dificultad:</div>
            <div className="difficulty-options">
              <div 
                className={`game-option ${selectedDifficulty === 'easy' ? 'active' : ''}`}
                onClick={() => handleDifficultySelect('easy')}
              >
                <span className="option-icon">🌱</span>
                <span>Fácil</span>
              </div>
              <div 
                className={`game-option ${selectedDifficulty === 'normal' ? 'active' : ''}`}
                onClick={() => handleDifficultySelect('normal')}
              >
                <span className="option-icon">🌟</span>
                <span>Normal</span>
              </div>
              <div 
                className={`game-option ${selectedDifficulty === 'hard' ? 'active' : ''}`}
                onClick={() => handleDifficultySelect('hard')}
              >
                <span className="option-icon">🔮</span>
                <span>Difícil</span>
              </div>
            </div>
          </div>
          
          {/* Panel de configuraciones movido debajo de la dificultad */}
          <div className="settings-container">
            <div className="settings-buttons">
              <button 
                ref={settingsButtonRef}
                className={`setting-button ${showSettings ? 'active' : ''}`} 
                onClick={toggleSettings}
                aria-label="Configuración"
              >
                ⚙️
              </button>
              <button 
                className={`setting-button ${soundEnabled ? 'active' : ''}`} 
                onClick={toggleSound}
                aria-label={soundEnabled ? "Desactivar sonidos" : "Activar sonidos"}
              >
                {soundEnabled ? '🔊' : '🔇'}
              </button>
              <button 
                className={`setting-button ${musicEnabled ? 'active' : ''}`} 
                onClick={toggleMusic}
                aria-label={musicEnabled ? "Desactivar música" : "Activar música"}
              >
                {musicEnabled ? '🎵' : '🔇'}
              </button>
            </div>
            
            {/* Panel de configuración expandido */}
            {showSettings && (
              <div className="settings-panel" ref={settingsPanelRef}>
                <h3>Configuración</h3>
                <div className="settings-options">
                  <div className="settings-option">
                    <span>Música</span>
                    <button 
                      className={`setting-toggle ${musicEnabled ? 'active' : ''}`}
                      onClick={toggleMusic}
                    >
                      {musicEnabled ? 'ON' : 'OFF'}
                    </button>
                  </div>
                  <div className="settings-option">
                    <span>Sonidos</span>
                    <button 
                      className={`setting-toggle ${soundEnabled ? 'active' : ''}`}
                      onClick={toggleSound}
                    >
                      {soundEnabled ? 'ON' : 'OFF'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        
        <div className="start-game-footer">
          <button 
            className="start-button" 
            onClick={handleStartGame}
            aria-label="Comenzar juego"
          >
            ¡JUGAR AHORA!
          </button>
        </div>
      </div>
    </div>
  );
};

export default StartGameModal; 