import React, { useState, useEffect } from 'react';
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
  const [selectedDifficulty, setSelectedDifficulty] = useState<GameDifficulty>('normal');
  const [selectedMode, setSelectedMode] = useState<GamePlayMode>('classic');
  const [isClosing, setIsClosing] = useState(false);
  const [showDescription, setShowDescription] = useState<string | null>(null);
  
  // Estados para la configuración
  const [soundEnabled, setSoundEnabled] = useState<boolean>(
    localStorage.getItem('soundEnabled') !== 'false'
  );
  const [musicEnabled, setMusicEnabled] = useState<boolean>(
    localStorage.getItem('musicEnabled') !== 'false'
  );
  const [showSettings, setShowSettings] = useState<boolean>(false);
  
  useEffect(() => {
    // Reiniciar el estado de cierre cuando el modal vuelve a ser visible
    if (isVisible) {
      setIsClosing(false);
    }
    
    // Aplicar la configuración de sonido y música
    // Solo actualizamos si el estado no coincide con el audioManager
    if (audioManager.enabled !== soundEnabled) {
      audioManager.toggleSound(); // Esto cambiará el estado en el audioManager
    }
    
    if (audioManager.musicEnabled !== musicEnabled) {
      audioManager.toggleMusic(); // Esto cambiará el estado en el audioManager
    }
    
    // No necesitamos guardar en localStorage porque audioManager ya lo hace
  }, [isVisible, soundEnabled, musicEnabled]);
  
  const handleStartGame = () => {
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
      
      // Reproducir sonido de inicio
      audioManager.play('start');
      
      // Llamar a la función onStart si se proporcionó
      if (onStart) {
        onStart();
      }
    }, 500);
  };
  
  const toggleDescription = (type: string, id: string) => {
    if (showDescription === id) {
      setShowDescription(null);
    } else {
      setShowDescription(id);
    }
  };
  
  const getDifficultyDescription = (difficulty: GameDifficulty): string => {
    switch (difficulty) {
      case 'easy': return 'Ritmo lento, penalizaciones mínimas. Ideal para principiantes.';
      case 'normal': return 'Equilibrio entre desafío y diversión. Recomendado para la mayoría de jugadores.';
      case 'hard': return 'Mayor velocidad y penalizaciones. Para jugadores experimentados.';
      case 'tutorial': return 'Modo de aprendizaje con instrucciones paso a paso.';
      default: return '';
    }
  };
  
  const getModeDescription = (mode: GamePlayMode): string => {
    switch (mode) {
      case 'classic': 
        return 'El tablero comienza pequeño y crece con los niveles. La velocidad aumenta progresivamente. Gana puntos eliminando iconos y avanza limpiando el tablero.';
      case 'timed': 
        return 'Contrarreloj con tiempo limitado por nivel. El tablero tiene tamaño fijo. Consigue tiempo extra haciendo combos. Pasa de nivel completando objetivos antes de que se acabe el tiempo.';
      case 'survival': 
        return 'Tablero grande con generación de iconos que acelera gradualmente. Incluye iconos especiales que limpian filas o columnas enteras. ¿Cuánto tiempo puedes sobrevivir?';
      default: return '';
    }
  };
  
  // Maneja el cambio en la configuración de sonido
  const toggleSound = () => {
    // Actualizar el estado del componente
    setSoundEnabled(!soundEnabled);
    
    // Reproducir un sonido al activar
    if (!soundEnabled) {
      audioManager.play('click');
    }
  };
  
  // Maneja el cambio en la configuración de música
  const toggleMusic = () => {
    setMusicEnabled(!musicEnabled);
  };
  
  // Maneja mostrar/ocultar el panel de configuración
  const toggleSettings = () => {
    setShowSettings(!showSettings);
    audioManager.play('click');
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
          
          {/* Panel de configuraciones */}
          <div className="game-settings-panel">
            <button 
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
            <div className="settings-panel">
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
        
        <div className="start-game-body">
          <div className="form-group">
            <div className="form-label">Selecciona un modo de juego:</div>
            <div className="mode-options">
              <div 
                className={`game-option ${selectedMode === 'classic' ? 'active' : ''}`}
                onClick={() => setSelectedMode('classic')}
                onMouseEnter={() => toggleDescription('mode', 'classic')}
                onMouseLeave={() => toggleDescription('mode', 'classic')}
              >
                <span className="option-icon">🏆</span>
                <span>Clásico</span>
              </div>
              <div 
                className={`game-option ${selectedMode === 'timed' ? 'active' : ''}`}
                onClick={() => setSelectedMode('timed')}
                onMouseEnter={() => toggleDescription('mode', 'timed')}
                onMouseLeave={() => toggleDescription('mode', 'timed')}
              >
                <span className="option-icon">⏱️</span>
                <span>Contrarreloj</span>
              </div>
              <div 
                className={`game-option ${selectedMode === 'survival' ? 'active' : ''}`}
                onClick={() => setSelectedMode('survival')}
                onMouseEnter={() => toggleDescription('mode', 'survival')}
                onMouseLeave={() => toggleDescription('mode', 'survival')}
              >
                <span className="option-icon">🔥</span>
                <span>Supervivencia</span>
              </div>
            </div>
            {showDescription && showDescription.match(/classic|timed|survival/) && (
              <div className="option-description">
                {getModeDescription(showDescription as GamePlayMode)}
              </div>
            )}
          </div>
          
          <div className="form-group">
            <div className="form-label">Selecciona la dificultad:</div>
            <div className="difficulty-options">
              <div 
                className={`game-option ${selectedDifficulty === 'easy' ? 'active' : ''}`}
                onClick={() => setSelectedDifficulty('easy')}
                onMouseEnter={() => toggleDescription('difficulty', 'easy')}
                onMouseLeave={() => toggleDescription('difficulty', 'easy')}
              >
                <span className="option-icon">😊</span>
                <span>Fácil</span>
              </div>
              <div 
                className={`game-option ${selectedDifficulty === 'normal' ? 'active' : ''}`}
                onClick={() => setSelectedDifficulty('normal')}
                onMouseEnter={() => toggleDescription('difficulty', 'normal')}
                onMouseLeave={() => toggleDescription('difficulty', 'normal')}
              >
                <span className="option-icon">😐</span>
                <span>Normal</span>
              </div>
              <div 
                className={`game-option ${selectedDifficulty === 'hard' ? 'active' : ''}`}
                onClick={() => setSelectedDifficulty('hard')}
                onMouseEnter={() => toggleDescription('difficulty', 'hard')}
                onMouseLeave={() => toggleDescription('difficulty', 'hard')}
              >
                <span className="option-icon">😈</span>
                <span>Difícil</span>
              </div>
            </div>
            {showDescription && showDescription.match(/easy|normal|hard|tutorial/) && (
              <div className="option-description">
                {getDifficultyDescription(showDescription as GameDifficulty)}
              </div>
            )}
          </div>
        </div>
        
        <div className="start-game-footer">
          <button className="start-button" onClick={handleStartGame}>
            ¡Jugar Ahora!
          </button>
        </div>
      </div>
    </div>
  );
};

export default StartGameModal; 