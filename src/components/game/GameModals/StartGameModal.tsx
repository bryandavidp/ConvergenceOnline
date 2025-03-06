import React, { useState, useEffect, useRef, memo, useCallback } from 'react';
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

// Optimizado: Componente para partículas en movimiento con límite reducido y memo
const ParticlesEffect: React.FC<{lowPerformance?: boolean}> = memo(({lowPerformance = false}) => {
  // Reducir cantidad de partículas en modo de bajo rendimiento
  const particleCount = lowPerformance ? 5 : 15;
  
  // No renderizar nada si estamos en modo de muy bajo rendimiento
  if (lowPerformance === true) {
    return null;
  }
  
  return (
    <div className="particles-container">
      {[...Array(particleCount)].map((_, i) => (
        <div 
          key={i} 
          className="particle"
          style={{
            top: `${Math.random() * 100}%`,
            left: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 5}s`,
            animationDuration: `${6 + Math.random() * 4}s`, // Duración reducida
            width: `${2 + Math.random() * 2}px`, // Tamaño reducido
            height: `${2 + Math.random() * 2}px`, // Tamaño reducido
            opacity: 0.1 + Math.random() * 0.3, // Opacidad reducida
          }}
        />
      ))}
    </div>
  );
});

// Optimizado: Componente para estrellas brillantes con límite reducido y memo
const StarsEffect: React.FC<{lowPerformance?: boolean}> = memo(({lowPerformance = false}) => {
  // Reducir cantidad de estrellas en modo de bajo rendimiento
  const starCount = lowPerformance ? 7 : 20;
  
  // No renderizar nada si estamos en modo de muy bajo rendimiento
  if (lowPerformance === true) {
    return null;
  }
  
  return (
    <div className="stars-container">
      {[...Array(starCount)].map((_, i) => (
        <div 
          key={i} 
          className="star"
          style={{
            top: `${Math.random() * 100}%`,
            left: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 5}s`, // Menor delay
            animationDuration: `${1 + Math.random() * 2}s`, // Duración reducida
            width: `${1 + Math.random() * 1}px`, // Tamaño reducido
            height: `${1 + Math.random() * 1}px`, // Tamaño reducido
          }}
        />
      ))}
    </div>
  );
});

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
  
  // Estado para detección de rendimiento
  const [lowPerformanceMode, setLowPerformanceMode] = useState<boolean>(false);
  
  // Detectar si el dispositivo es de baja potencia
  useEffect(() => {
    // Verificar primero si ya está activado a nivel global
    if (document.documentElement.classList.contains('performance-mode')) {
      setLowPerformanceMode(true);
      return;
    }
    
    // Estado para rastrear la activación
    const activated = { value: false };
    
    // Detección de dispositivo móvil - menos restrictiva
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    // Si es dispositivo móvil o la ventana es pequeña (criterios menos restrictivos)
    if (isMobile || window.innerWidth < 768 || window.innerHeight < 600) {
      setLowPerformanceMode(true);
      document.documentElement.classList.add('performance-mode');
      activated.value = true;
      console.log('StartGameModal: Activando modo de rendimiento por detección de dispositivo móvil o pantalla pequeña');
      return;
    }
    
    // Verificación de rendimiento inicial
    const start = performance.now();
    
    // Crear un temporizador que se ejecute después de que el componente se haya renderizado
    const checkPerformanceTimer = setTimeout(() => {
      const end = performance.now();
      const renderTime = end - start;
      
      // Si el tiempo de renderizado es alto, activar modo de bajo rendimiento
      if (renderTime > 100 && !activated.value) {
        setLowPerformanceMode(true);
        document.documentElement.classList.add('performance-mode');
        activated.value = true;
        console.log(`StartGameModal: Activando modo de rendimiento por tiempo de renderizado lento: ${renderTime}ms`);
      }
    }, 500);
    
    return () => clearTimeout(checkPerformanceTimer);
  }, []);
  
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
  
  // Descripción del modo de juego seleccionado
  const getModeDescription = () => {
    switch (selectedMode) {
      case 'classic':
        return 'Completa niveles a tu ritmo. Sin límite de tiempo.';
      case 'timed':
        return 'Completa niveles contrarreloj. ¡El tiempo es crucial!';
      case 'survival':
        return 'Sobrevive el mayor tiempo posible. Aumenta la dificultad progresivamente.';
      default:
        return '';
    }
  };
  
  // Descripción de la dificultad seleccionada
  const getDifficultyDescription = () => {
    switch (selectedDifficulty) {
      case 'easy':
        return 'Ritmo relajado. Ideal para principiantes.';
      case 'normal':
        return 'Equilibrio entre desafío y diversión.';
      case 'hard':
        return 'Mayor desafío y estrategia. Para jugadores experimentados.';
      default:
        return '';
    }
  };
  
  return (
    <div className={`game-modal start-game ${isVisible ? 'visible' : 'hidden'} ${isClosing ? 'closing' : ''} ${lowPerformanceMode ? 'performance-mode' : ''}`}>
      {/* Efectos visuales - solo mostrar si no estamos en modo de bajo rendimiento */}
      <ParticlesEffect lowPerformance={lowPerformanceMode} />
      <StarsEffect lowPerformance={lowPerformanceMode} />
      
      {/* Decoración adicional con luces de neón */}
      <div className="neon-glow top-left"></div>
      <div className="neon-glow bottom-right"></div>
      <div className="corner-decoration top-right"></div>
      <div className="corner-decoration bottom-left"></div>
      
      <div className="modal-content">
        <div className="start-game-header">
          <h1>Convergencia</h1>
          <h2>Un juego de estrategia</h2>
          
          {/* Controles de configuración movidos al header */}
          <div className="header-settings-container">
            <div className="settings-buttons">
              <button 
                ref={settingsButtonRef}
                className={`setting-button ${showSettings ? 'active' : ''}`} 
                onClick={toggleSettings}
                aria-label="Configuración"
              >
                ⚙️
              </button>
            </div>
          </div>
          
          <div className="game-icon-preview">
            {["🍎", "🍊", "🍇", "🍓", "🍐"].map((icon, index) => (
              <div key={index} className="preview-icon" style={{ animationDelay: `${index * 0.2}s` }}>
                {icon}
                <div className="icon-shine"></div>
              </div>
            ))}
          </div>
          
          {/* Panel de configuración expandido - ahora fuera de settings-container */}
          {showSettings && (
            <div className="settings-panel" ref={settingsPanelRef}>
              <h3>Configuración</h3>
              <div className="settings-options">
                <div className="settings-option">
                  <span>Efectos de sonido</span>
                  <div 
                    className={`setting-toggle ${soundEnabled ? 'active' : ''}`}
                    onClick={toggleSound}
                  >
                    {soundEnabled ? 'ON' : 'OFF'}
                  </div>
                </div>
                <div className="settings-option">
                  <span>Música de fondo</span>
                  <div 
                    className={`setting-toggle ${musicEnabled ? 'active' : ''}`}
                    onClick={toggleMusic}
                  >
                    {musicEnabled ? 'ON' : 'OFF'}
                  </div>
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
                onClick={() => handleModeSelect('classic')}
              >
                <span className="option-icon">🏅</span>
                <span>Clásico</span>
                <div className="option-glow"></div>
              </div>
              <div 
                className={`game-option ${selectedMode === 'timed' ? 'active' : ''}`}
                onClick={() => handleModeSelect('timed')}
              >
                <span className="option-icon">⏳</span>
                <span>Contrarreloj</span>
                <div className="option-glow"></div>
              </div>
              <div 
                className={`game-option ${selectedMode === 'survival' ? 'active' : ''}`}
                onClick={() => handleModeSelect('survival')}
              >
                <span className="option-icon">🔥</span>
                <span>Supervivencia</span>
                <div className="option-glow"></div>
              </div>
            </div>
            {selectedMode && (
              <div className="mode-description">{getModeDescription()}</div>
            )}
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
                <div className="option-glow"></div>
              </div>
              <div 
                className={`game-option ${selectedDifficulty === 'normal' ? 'active' : ''}`}
                onClick={() => handleDifficultySelect('normal')}
              >
                <span className="option-icon">🌟</span>
                <span>Normal</span>
                <div className="option-glow"></div>
              </div>
              <div 
                className={`game-option ${selectedDifficulty === 'hard' ? 'active' : ''}`}
                onClick={() => handleDifficultySelect('hard')}
              >
                <span className="option-icon">🔮</span>
                <span>Difícil</span>
                <div className="option-glow"></div>
              </div>
            </div>
            {selectedDifficulty && (
              <div className="difficulty-description">{getDifficultyDescription()}</div>
            )}
          </div>
          
          {/* Botón de comenzar con estilo destacado para mejor visibilidad */}
          <div className="fixed-start-button-container">
            <button 
              className="start-button"
              onClick={handleStartGame}
              aria-label="Iniciar juego"
            >
              ¡Comenzar!
              <span className="button-energy"></span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Exportar componente memorizado para evitar renderizados innecesarios
export default memo(StartGameModal); 