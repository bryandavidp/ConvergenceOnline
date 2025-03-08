import React, { useState, useEffect, useRef } from 'react';
import { useGameContext } from '../../../contexts/GameContext';
import { GamePlayMode, GameDifficulty } from '../../../types/game';
import { useGameSound } from '../../../hooks/useGameSound';
import { useDarkMode } from '../../../hooks/useDarkMode';
import { ICONS } from '../../../constants/icons';
import './GameModals.css';

// Propiedades del modal
interface StartGameModalProps {
  isVisible?: boolean;
  onStart?: () => void;
}

// Definición de las pantallas del flujo
type ScreenType = 'main' | 'play' | 'options' | 'credits';

// Tipos de modo de juego ampliados
type ExtendedGameMode = GamePlayMode;

// Íconos específicos para los modos de juego
const MODE_ICONS = {
  [GamePlayMode.CLASSIC]: '🎯',
  [GamePlayMode.TIME_ATTACK]: '⏱️',
  [GamePlayMode.SURVIVAL]: '🔄',
  [GamePlayMode.ZEN]: '🧘',
  [GamePlayMode.TUTORIAL]: '👨‍🏫',
};

// Íconos específicos para los niveles de dificultad
const DIFFICULTY_ICONS = {
  [GameDifficulty.EASY]: '😊',
  [GameDifficulty.MEDIUM]: '😐',
  [GameDifficulty.HARD]: '😰',
};

// Descripciones para los modos de juego
const MODE_DESCRIPTIONS = {
  [GamePlayMode.CLASSIC]: 'Juega a tu ritmo y completa todos los niveles.',
  [GamePlayMode.TIME_ATTACK]: 'Acumula puntos antes que se acabe el tiempo.',
  [GamePlayMode.SURVIVAL]: 'Sobrevive el mayor tiempo posible con dificultad creciente.',
  [GamePlayMode.ZEN]: 'Modo relajado sin presión de tiempo ni objetivos específicos.',
  [GamePlayMode.TUTORIAL]: 'Aprende los conceptos básicos del juego paso a paso.',
};

// Descripciones para los niveles de dificultad
const DIFFICULTY_DESCRIPTIONS = {
  [GameDifficulty.EASY]: 'Para principiantes. Tableros más pequeños y objetivos simples.',
  [GameDifficulty.MEDIUM]: 'Desafío moderado con objetivos más exigentes.',
  [GameDifficulty.HARD]: 'Para expertos. Tableros grandes con objetivos muy desafiantes.',
};

// Configuración inicial para animación de la entrada del modal
const START_ANIMATIONS = {
  title: { opacity: 0, transform: 'translateY(-20px)' },
  options: { opacity: 0, transform: 'translateY(20px)' },
  button: { opacity: 0, transform: 'scale(0.8)' },
};

const StartGameModal: React.FC<StartGameModalProps> = ({ isVisible = true, onStart }) => {
  // Referencias al contenido del modal y al tablero de juego
  const modalContentRef = useRef<HTMLDivElement>(null);
  const { playSound } = useGameSound();
  const { darkMode } = useDarkMode();
  
  // Estado del juego y configuración
  const { 
    gameMode, 
    setGameMode, 
    gameDifficulty, 
    setGameDifficulty,
    isSoundEnabled,
    setIsSoundEnabled,
    isMusicEnabled,
    setIsMusicEnabled
  } = useGameContext();
  
  // Estados locales para animaciones y UI
  const [animations, setAnimations] = useState(START_ANIMATIONS);
  const [showSettings, setShowSettings] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [currentScreen, setCurrentScreen] = useState<ScreenType>('main');
  const [selectedMode, setSelectedMode] = useState<ExtendedGameMode | null>(null);
  const [configReady, setConfigReady] = useState(false);
  
  // Efecto para verificar si la configuración está lista para activar el botón Empezar
  useEffect(() => {
    // Está listo si ha seleccionado:
    // - Un modo Tutorial o Zen (no requieren dificultad)
    // - O un modo normal + dificultad
    if (
      selectedMode === GamePlayMode.TUTORIAL || 
      selectedMode === GamePlayMode.ZEN || 
      (selectedMode && gameDifficulty)
    ) {
      setConfigReady(true);
    } else {
      setConfigReady(false);
    }
  }, [selectedMode, gameDifficulty]);
  
  // Efecto para manejar la animación de entrada cuando el modal es visible
  useEffect(() => {
    let animationTimeout: NodeJS.Timeout;
    
    if (isVisible) {
      setModalVisible(true);
      setIsClosing(false);
      
      // Animación secuencial para los elementos del modal
      setTimeout(() => {
        setAnimations(prev => ({
          ...prev,
          title: { opacity: 1, transform: 'translateY(0)' }
        }));
        
        setTimeout(() => {
          setAnimations(prev => ({
            ...prev,
            options: { opacity: 1, transform: 'translateY(0)' }
          }));
          
          setTimeout(() => {
            setAnimations(prev => ({
              ...prev,
              button: { opacity: 1, transform: 'scale(1)' }
            }));
          }, 200);
        }, 200);
      }, 100);
    } else {
      setIsClosing(true);
      animationTimeout = setTimeout(() => {
        setModalVisible(false);
        setAnimations(START_ANIMATIONS);
        // Resetear a la pantalla principal cuando se cierra el modal
        setCurrentScreen('main');
      }, 300);
    }
    
    return () => {
      if (animationTimeout) {
        clearTimeout(animationTimeout);
      }
    };
  }, [isVisible, playSound]);
  
  // Navegar a otra pantalla
  const navigateTo = (screen: ScreenType) => {
    playSound('uiSelect');
    setCurrentScreen(screen);
  };
  
  // Cierra el modal al hacer clic fuera del contenido
  const handleClickOutside = (event: MouseEvent) => {
    if (
      modalContentRef.current && 
      !modalContentRef.current.contains(event.target as Node) &&
      !showSettings
    ) {
      playSound('uiClose');
      // No cerramos automáticamente, solo mostramos feedback visual
      const modalContent = modalContentRef.current;
      modalContent.style.transform = 'scale(0.98)';
      
      setTimeout(() => {
        if (modalContent) {
          modalContent.style.transform = 'scale(1)';
        }
      }, 150);
    }
  };
  
  // Configura el listener para clicks fuera del modal
  useEffect(() => {
    if (isVisible) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isVisible, showSettings]);
  
  // Inicia el juego con la configuración seleccionada
  const handleStartGame = () => {
    if (!configReady || !selectedMode) return;
    
    playSound('uiSelect');
    
    // Configurar el modo según la selección
    if (selectedMode === GamePlayMode.TUTORIAL) {
      // Iniciar tutorial
      console.log("Iniciando tutorial");
      setGameMode(GamePlayMode.TUTORIAL);
      setGameDifficulty(GameDifficulty.EASY); // Dificultad fácil para tutorial
    } else if (selectedMode === GamePlayMode.ZEN) {
      // Iniciar modo zen
      console.log("Iniciando modo Zen");
      setGameMode(GamePlayMode.ZEN);
      setGameDifficulty(GameDifficulty.EASY); // Default para el backend
    } else {
      // Modo normal
      setGameMode(selectedMode);
    }
    
    // Cerrar el modal con animación
    setIsClosing(true);
    
    // Esperar a que termine la animación antes de iniciar el juego
    setTimeout(() => {
      // Llamar al callback de inicio
      if (onStart) {
        onStart();
      }
      
      // Añade la clase modal-active al elemento game-page
      const gamePageElement = document.querySelector('.game-page');
      if (gamePageElement) {
        gamePageElement.classList.add('modal-active');
      }
    }, 500);
  };
  
  // Selecciona el modo de juego
  const handleModeSelect = (mode: ExtendedGameMode) => {
    playSound('uiTap');
    setSelectedMode(mode);
  };
  
  // Selecciona el nivel de dificultad
  const handleDifficultySelect = (difficulty: GameDifficulty) => {
    if (difficulty !== gameDifficulty) {
      playSound('uiTap');
      setGameDifficulty(difficulty);
    }
  };
  
  // Activa/desactiva el sonido
  const toggleSound = () => {
    playSound('uiTap');
    setIsSoundEnabled(!isSoundEnabled);
  };
  
  // Activa/desactiva la música
  const toggleMusic = () => {
    playSound('uiTap');
    setIsMusicEnabled(!isMusicEnabled);
  };
  
  // Muestra/oculta el panel de configuración
  const toggleSettings = () => {
    playSound(showSettings ? 'uiClose' : 'uiOpen');
    setShowSettings(!showSettings);
  };
  
  // Renderiza la pantalla principal
  const renderMainScreen = () => {
    return (
      <div className="main-screen">
        <div 
          className="logo-container"
          style={{
            transition: 'all 0.6s ease',
            ...animations.title
          }}
        >
          <h1 className="logo-text">Convergencia</h1>
          <div className="logo-pulse"></div>
        </div>
        
        <div 
          className="main-buttons"
          style={{
            transition: 'all 0.5s ease',
            transitionDelay: '0.3s',
            ...animations.options
          }}
        >
          <button 
            className="main-button play-button"
            onClick={() => navigateTo('play')}
          >
            JUGAR
          </button>
          
          <button 
            className="main-button options-button"
            onClick={() => navigateTo('options')}
          >
            OPCIONES
          </button>
          
          <button 
            className="main-button credits-button"
            onClick={() => navigateTo('credits')}
          >
            CRÉDITOS
          </button>
        </div>
      </div>
    );
  };
  
  // Renderiza la pantalla de selección de modo de juego
  const renderPlayScreen = () => {
    return (
      <div className="play-screen">
        <div className="game-modes-container">
          {/* Sección de modos de juego */}
          <div className="game-section modes-section">
            <h3 className="section-title">Modo de Juego</h3>
            <div className="mode-options">
              <div 
                className={`game-option mode-option classic-mode ${selectedMode === GamePlayMode.CLASSIC ? 'active' : ''}`}
                onClick={() => handleModeSelect(GamePlayMode.CLASSIC)}
              >
                <span className="option-icon">{MODE_ICONS[GamePlayMode.CLASSIC]}</span>
                <span>Clásico</span>
              </div>
              
              <div 
                className={`game-option mode-option time-mode ${selectedMode === GamePlayMode.TIME_ATTACK ? 'active' : ''}`}
                onClick={() => handleModeSelect(GamePlayMode.TIME_ATTACK)}
              >
                <span className="option-icon">{MODE_ICONS[GamePlayMode.TIME_ATTACK]}</span>
                <span>Contrarreloj</span>
              </div>
              
              <div 
                className={`game-option mode-option survival-mode ${selectedMode === GamePlayMode.SURVIVAL ? 'active' : ''}`}
                onClick={() => handleModeSelect(GamePlayMode.SURVIVAL)}
              >
                <span className="option-icon">{MODE_ICONS[GamePlayMode.SURVIVAL]}</span>
                <span>Supervivencia</span>
              </div>
              
              <div 
                className={`game-option mode-option zen-mode ${selectedMode === GamePlayMode.ZEN ? 'active' : ''}`}
                onClick={() => handleModeSelect(GamePlayMode.ZEN)}
              >
                <span className="option-icon">{MODE_ICONS[GamePlayMode.ZEN]}</span>
                <span>Zen</span>
              </div>
              
              <div 
                className={`game-option mode-option tutorial-mode ${selectedMode === GamePlayMode.TUTORIAL ? 'active' : ''}`}
                onClick={() => handleModeSelect(GamePlayMode.TUTORIAL)}
              >
                <span className="option-icon">{MODE_ICONS[GamePlayMode.TUTORIAL]}</span>
                <span>Tutorial (para nuevos jugadores)</span>
              </div>
            </div>
          </div>
          
          {/* Sección de dificultad - Solo visible si es necesario */}
          {selectedMode && selectedMode !== GamePlayMode.TUTORIAL && selectedMode !== GamePlayMode.ZEN && (
            <div className="game-section difficulty-section">
              <h3 className="section-title">Dificultad</h3>
              <div className="difficulty-options">
                <div 
                  className={`game-option difficulty-option easy-difficulty ${gameDifficulty === GameDifficulty.EASY ? 'active' : ''}`}
                  onClick={() => handleDifficultySelect(GameDifficulty.EASY)}
                >
                  <span className="option-icon">{DIFFICULTY_ICONS[GameDifficulty.EASY]}</span>
                  <span>Fácil</span>
                </div>
                
                <div 
                  className={`game-option difficulty-option normal-difficulty ${gameDifficulty === GameDifficulty.MEDIUM ? 'active' : ''}`}
                  onClick={() => handleDifficultySelect(GameDifficulty.MEDIUM)}
                >
                  <span className="option-icon">{DIFFICULTY_ICONS[GameDifficulty.MEDIUM]}</span>
                  <span>Normal</span>
                </div>
                
                <div 
                  className={`game-option difficulty-option hard-difficulty ${gameDifficulty === GameDifficulty.HARD ? 'active' : ''}`}
                  onClick={() => handleDifficultySelect(GameDifficulty.HARD)}
                >
                  <span className="option-icon">{DIFFICULTY_ICONS[GameDifficulty.HARD]}</span>
                  <span>Difícil</span>
                </div>
              </div>
            </div>
          )}
        </div>
        
        <div className="fixed-start-button-container">
          <button 
            className={`start-button ${configReady ? 'active' : 'disabled'}`}
            onClick={handleStartGame}
            disabled={!configReady}
          >
            ¡EMPEZAR!
          </button>
        </div>
      </div>
    );
  };
  
  // Renderiza la pantalla de opciones
  const renderOptionsScreen = () => {
    return (
      <div className="options-screen">
        <div className="screen-header">
          <h2>Opciones</h2>
          <button 
            className="back-button"
            onClick={() => navigateTo('main')}
          >
            ⬅️ Volver
          </button>
        </div>
        
        <div className="settings-content">
          <div className="settings-option">
            <span>Música</span>
            <button 
              className={`setting-toggle ${isMusicEnabled ? 'active' : ''}`}
              onClick={toggleMusic}
            >
              {isMusicEnabled ? 'ON' : 'OFF'}
            </button>
          </div>
          
          <div className="settings-option">
            <span>Sonido</span>
            <button 
              className={`setting-toggle ${isSoundEnabled ? 'active' : ''}`}
              onClick={toggleSound}
            >
              {isSoundEnabled ? 'ON' : 'OFF'}
            </button>
          </div>
          
          <div className="settings-option">
            <span>Notificaciones</span>
            <div className="setting-checkbox">✓</div>
          </div>
        </div>
      </div>
    );
  };
  
  // Renderiza la pantalla de créditos
  const renderCreditsScreen = () => {
    return (
      <div className="credits-screen">
        <div className="screen-header">
          <h2>Créditos</h2>
          <button 
            className="back-button"
            onClick={() => navigateTo('main')}
          >
            ⬅️ Volver
          </button>
        </div>
        
        <div className="credits-content">
          <h3>Convergencia</h3>
          <p>Diseñado y desarrollado por:</p>
          <p className="credits-name">Equipo de Desarrollo</p>
          
          <h4>Programación</h4>
          <p className="credits-name">Programador Principal</p>
          
          <h4>Diseño Gráfico</h4>
          <p className="credits-name">Artista Principal</p>
          
          <h4>Música y Sonido</h4>
          <p className="credits-name">Compositor</p>
          
          <h4>Agradecimientos Especiales</h4>
          <p>A todos los que hicieron posible este juego</p>
          
          <div className="version-info">
            <p>Versión 1.0.0</p>
            <p>© 2023 Todos los derechos reservados</p>
          </div>
        </div>
      </div>
    );
  };
  
  // Si el modal no está visible, no renderizamos nada
  if (!modalVisible && !isVisible) {
    return null;
  }
  
  // Renderizar el contenido adecuado según la pantalla actual
  const renderContent = () => {
    switch(currentScreen) {
      case 'play':
        return renderPlayScreen();
      case 'options':
        return renderOptionsScreen();
      case 'credits':
        return renderCreditsScreen();
      default:
        return renderMainScreen();
    }
  };
  
  return (
    <div className={`game-modal start-game ${modalVisible ? 'visible' : ''} ${isClosing ? 'closing' : ''}`}>
      <div className="modal-content" ref={modalContentRef}>
        {/* Cabecera del modal con título y botones de configuración */}
        <div className="start-game-header">
          <div className="header-settings-container">
            <div className="settings-buttons">
              <button 
                className={`setting-button ${showSettings ? 'active' : ''}`} 
                onClick={toggleSettings}
              >
                {ICONS.SETTINGS}
              </button>
            </div>
          </div>
        </div>
        
        {/* Panel de configuración */}
        {showSettings && (
          <div className="settings-panel">
            <div className="settings-option">
              <span>Música</span>
              <button 
                className={`setting-toggle ${isMusicEnabled ? 'active' : ''}`}
                onClick={toggleMusic}
              >
                {isMusicEnabled ? 'ON' : 'OFF'}
              </button>
            </div>
            
            <div className="settings-option">
              <span>Sonido</span>
              <button 
                className={`setting-toggle ${isSoundEnabled ? 'active' : ''}`}
                onClick={toggleSound}
              >
                {isSoundEnabled ? 'ON' : 'OFF'}
              </button>
            </div>
            
            <div className="settings-option">
              <span>Notificaciones</span>
              <div className="setting-checkbox">✓</div>
            </div>
          </div>
        )}
        
        {/* Cuerpo del modal con el contenido según la pantalla actual */}
        <div className="start-game-body">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default StartGameModal; 