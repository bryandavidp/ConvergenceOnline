import React, { useState, useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useGameContext } from '../../../contexts/GameContext';
import { GamePlayMode, GameDifficulty } from '../../../types/game';
import { useGameSound } from '../../../hooks/useGameSound';
import { useDarkMode } from '../../../hooks/useDarkMode';
import useGameLogic from '../../../hooks/useGameLogic';
import { ICONS } from '../../../constants/icons';
import { RootState } from '../../../store';
import './StartGameModal.css';
import { FaInfoCircle, FaLock } from 'react-icons/fa';

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
  [GameDifficulty.VERY_EASY]: '😄',
  [GameDifficulty.EASY]: '😊',
  [GameDifficulty.MEDIUM]: '😐',
  [GameDifficulty.HARD]: '😰',
  [GameDifficulty.VERY_HARD]: '😱',
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
  [GameDifficulty.VERY_EASY]: 'Extremadamente sencillo. Ideal para principiantes absolutos.',
  [GameDifficulty.EASY]: 'Para principiantes. Tableros más pequeños y objetivos simples.',
  [GameDifficulty.MEDIUM]: 'Desafío moderado con objetivos más exigentes.',
  [GameDifficulty.HARD]: 'Para expertos. Tableros grandes con objetivos muy desafiantes.',
  [GameDifficulty.VERY_HARD]: 'Dificultad extrema. Solo para los más hábiles.',
};

// Configuración inicial para animación de la entrada del modal
const START_ANIMATIONS = {
  title: { opacity: 0, transform: 'translateY(-20px)' },
  options: { opacity: 0, transform: 'translateY(20px)' },
  button: { opacity: 0, transform: 'scale(0.8)' },
};

// Función para obtener la descripción del modo de juego
const getModeDescription = (mode: GamePlayMode | null) => {
  if (!mode) return <p></p>;

  if (mode === GamePlayMode.TUTORIAL) {
    return (
      <div className="tutorial-description">
        <p>{MODE_DESCRIPTIONS[mode]}</p>
        <p className="tutorial-difficulty-note">El tutorial siempre usa dificultad fácil para una mejor experiencia de aprendizaje.</p>
      </div>
    );
  }
  return <p>{MODE_DESCRIPTIONS[mode]}</p>;
};

// Función para obtener la descripción de la dificultad
const getDifficultyDescription = (difficulty: GameDifficulty | null): string => {
  switch (difficulty) {
    case GameDifficulty.VERY_EASY:
      return "Ideal para principiantes o niños pequeños. Tiempo generoso y cartas sencillas.";
    case GameDifficulty.EASY:
      return "Un desafío ligero con tiempo suficiente para encontrar las coincidencias.";
    case GameDifficulty.MEDIUM:
      return "El equilibrio perfecto entre desafío y diversión. Recomendado para la mayoría de jugadores.";
    case GameDifficulty.HARD:
      return "Para jugadores experimentados. Requiere buena memoria y decisiones rápidas.";
    case GameDifficulty.VERY_HARD:
      return "El máximo desafío. Límites de tiempo estrictos y patrones complejos.";
    default:
      return "Selecciona una dificultad para ver su descripción";
  }
};

// Función para obtener una descripción unificada basada en el modo y dificultad
const getUnifiedDescription = (mode: GamePlayMode | null, difficulty: GameDifficulty | null): string => {
  if (!mode || !difficulty) {
    return "Selecciona un modo de juego y una dificultad para comenzar.";
  }

  // Descripción base según el modo
  let baseDescription = "";
  switch (mode) {
    case GamePlayMode.CLASSIC:
      baseDescription = "Encuentra todas las parejas de cartas en el menor tiempo posible.";
      break;
    case GamePlayMode.TIME_ATTACK:
      baseDescription = "Una carrera contra el reloj para encontrar todas las parejas antes de que el tiempo se agote.";
      break;
    case GamePlayMode.SURVIVAL:
      baseDescription = "El juego continúa con niveles cada vez más difíciles hasta que se acaben tus vidas.";
      break;
    case GamePlayMode.ZEN:
      baseDescription = "Juega sin presión de tiempo, perfecto para relajarse y disfrutar del juego.";
      break;
    case GamePlayMode.TUTORIAL:
      return "Aprende los conceptos básicos del juego con instrucciones paso a paso.";
    default:
      baseDescription = "";
  }

  // Añadir detalles según la dificultad
  let difficultyInfo = "";
  switch (difficulty) {
    case GameDifficulty.VERY_EASY:
      difficultyInfo = " Con cartas sencillas y tiempo generoso.";
      break;
    case GameDifficulty.EASY:
      difficultyInfo = " Con tiempo suficiente para principiantes.";
      break;
    case GameDifficulty.MEDIUM:
      difficultyInfo = " Con un nivel de desafío equilibrado.";
      break;
    case GameDifficulty.HARD:
      difficultyInfo = " Con un tiempo limitado para un buen desafío.";
      break;
    case GameDifficulty.VERY_HARD:
      difficultyInfo = " Con el máximo nivel de dificultad para expertos.";
      break;
  }

  return baseDescription + difficultyInfo;
};

const StartGameModal: React.FC<StartGameModalProps> = ({ isVisible = true, onStart }) => {
  // Referencias al contenido del modal y al tablero de juego
  const modalContentRef = useRef<HTMLDivElement>(null);
  const { playSound } = useGameSound();
  const { darkMode } = useDarkMode();
  const dispatch = useDispatch();

  // Obtenemos la puntuación máxima para determinar si es un nuevo jugador
  const { highScore } = useSelector((state: RootState) => state.game);
  const isNewPlayer = highScore <= 0;

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

  // Obtener la función changeGameConfig de useGameLogic
  const { changeGameConfig } = useGameLogic();

  // Estados locales para animaciones y UI
  const [animations, setAnimations] = useState(START_ANIMATIONS);
  const [showSettings, setShowSettings] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [currentScreen, setCurrentScreen] = useState<ScreenType>('main');
  const [selectedMode, setSelectedMode] = useState<ExtendedGameMode | null>(isNewPlayer ? GamePlayMode.TUTORIAL : null);
  const [configReady, setConfigReady] = useState(isNewPlayer);
  const [enableTutorial, setEnableTutorial] = useState(isNewPlayer);

  // Establecer la variable CSS --vh para altura real del viewport
  useEffect(() => {
    // Función para establecer la altura real del viewport
    const setViewportHeight = () => {
      // El viewport height real en píxeles
      const vh = window.innerHeight * 0.01;
      // Establecer la variable CSS --vh
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };

    // Establecer la altura inicialmente
    setViewportHeight();

    // Actualizar la altura cuando cambie el tamaño de la ventana
    window.addEventListener('resize', setViewportHeight);

    // Para dispositivos móviles, actualizar también al cambiar la orientación
    window.addEventListener('orientationchange', setViewportHeight);

    // Actualizar después de cargar completamente (para iOS Safari)
    window.addEventListener('load', setViewportHeight);

    // Limpiar los event listeners al desmontar
    return () => {
      window.removeEventListener('resize', setViewportHeight);
      window.removeEventListener('orientationchange', setViewportHeight);
      window.removeEventListener('load', setViewportHeight);
    };
  }, []);

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

    // Función para convertir el enum GameDifficulty a string para Redux
    const convertDifficultyToReduxFormat = (difficulty: GameDifficulty): 'easy' | 'normal' | 'hard' | 'tutorial' => {
      switch (difficulty) {
        case GameDifficulty.VERY_EASY:
        case GameDifficulty.EASY:
          return 'easy';
        case GameDifficulty.MEDIUM:
          return 'normal';
        case GameDifficulty.HARD:
        case GameDifficulty.VERY_HARD:
          return 'hard';
        default:
          return 'normal';
      }
    };

    // Función para convertir el enum GamePlayMode a string para Redux
    const convertModeToReduxFormat = (mode: GamePlayMode): 'classic' | 'timed' | 'survival' | 'zen' => {
      switch (mode) {
        case GamePlayMode.CLASSIC:
          return 'classic';
        case GamePlayMode.TIME_ATTACK:
          return 'timed';
        case GamePlayMode.SURVIVAL:
          return 'survival';
        case GamePlayMode.ZEN:
          return 'zen';
        case GamePlayMode.TUTORIAL:
          return 'classic'; // El tutorial usa el modo clásico en el backend
        default:
          return 'classic';
      }
    };

    // Configurar el modo según la selección
    if (selectedMode === GamePlayMode.TUTORIAL) {
      // Iniciar tutorial
      console.log("Iniciando tutorial");
      setGameMode(GamePlayMode.TUTORIAL);
      setGameDifficulty(GameDifficulty.EASY); // Dificultad fácil para tutorial
      // Actualizar también el estado Redux
      changeGameConfig('tutorial', 'classic');
    } else if (selectedMode === GamePlayMode.ZEN) {
      // Iniciar modo zen
      console.log("Iniciando modo Zen");
      setGameMode(GamePlayMode.ZEN);
      setGameDifficulty(GameDifficulty.EASY); // Default para el backend
      // Actualizar también el estado Redux
      changeGameConfig('easy', 'zen');
    } else {
      // Modo normal
      setGameMode(selectedMode);
      // Actualizar también el estado Redux
      changeGameConfig(
        convertDifficultyToReduxFormat(gameDifficulty),
        convertModeToReduxFormat(selectedMode)
      );
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

    // Si se selecciona el tutorial, establecer dificultad a fácil
    if (mode === GamePlayMode.TUTORIAL) {
      setGameDifficulty(GameDifficulty.EASY);
    }
  };

  // Selecciona el nivel de dificultad
  const handleDifficultySelect = (difficulty: GameDifficulty) => {
    // No cambiar la dificultad si estamos en modo tutorial
    if (selectedMode === GamePlayMode.TUTORIAL) return;

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

  // Renderiza la pantalla de selección de juego
  const renderPlayScreen = () => {
    return (
      <div className="play-screen">
        {/* Cabecera con navegación */}
        <div className="game-header">
          <button className="back-button" onClick={() => navigateTo('main')}>
            🏠
          </button>
          <h2 className="header-title">Selecciona el modo de juego</h2>
          {/* Eliminado el botón de configuración */}
          <div className="header-spacer"></div> {/* Espacio para mantener centrado el título */}
        </div>
        
        <div className="game-selection-container">
          {/* Sección de modos de juego */}
          <div className="modes-section">
            <h3 className="section-title">Modo de juego</h3>
            <div className="modes-grid">
              <div 
                className={`game-option tutorial ${selectedMode === GamePlayMode.TUTORIAL ? 'active' : ''}`}
                onClick={() => handleModeSelect(GamePlayMode.TUTORIAL)}
                data-mode="Tutorial"
              >
                <span className="recommended-badge">Recomendado</span>
              </div>
              <div 
                className={`game-option classic ${selectedMode === GamePlayMode.CLASSIC ? 'active' : ''}`}
                onClick={() => handleModeSelect(GamePlayMode.CLASSIC)}
                data-mode="Clásico"
              >
              </div>
              <div 
                className={`game-option timed ${selectedMode === GamePlayMode.TIME_ATTACK ? 'active' : ''}`}
                onClick={() => handleModeSelect(GamePlayMode.TIME_ATTACK)}
                data-mode="Contrarreloj"
              >
              </div>
              <div 
                className={`game-option survival ${selectedMode === GamePlayMode.SURVIVAL ? 'active' : ''}`}
                onClick={() => handleModeSelect(GamePlayMode.SURVIVAL)}
                data-mode="Supervivencia"
              >
              </div>
              <div 
                className={`game-option zen ${selectedMode === GamePlayMode.ZEN ? 'active' : ''}`}
                onClick={() => handleModeSelect(GamePlayMode.ZEN)}
                data-mode="Zen"
              >
              </div>
            </div>
          </div>
          
          {/* Sección de dificultad */}
          <div className="difficulty-section">
            <h3 className="section-title">Dificultad</h3>
            <div className="difficulty-options">
              <div 
                className={`difficulty-option very-easy ${gameDifficulty === GameDifficulty.VERY_EASY ? 'active' : ''}`}
                onClick={() => handleDifficultySelect(GameDifficulty.VERY_EASY)}
              >
                <div className="difficulty-emoji">😄</div>
                <div>Muy Fácil</div>
              </div>
              <div 
                className={`difficulty-option easy ${gameDifficulty === GameDifficulty.EASY ? 'active' : ''}`}
                onClick={() => handleDifficultySelect(GameDifficulty.EASY)}
              >
                <div className="difficulty-emoji">😊</div>
                <div>Fácil</div>
              </div>
              <div 
                className={`difficulty-option normal ${gameDifficulty === GameDifficulty.MEDIUM ? 'active' : ''}`}
                onClick={() => handleDifficultySelect(GameDifficulty.MEDIUM)}
              >
                <div className="difficulty-emoji">😐</div>
                <div>Normal</div>
              </div>
              <div 
                className={`difficulty-option hard ${gameDifficulty === GameDifficulty.HARD ? 'active' : ''}`}
                onClick={() => handleDifficultySelect(GameDifficulty.HARD)}
              >
                <div className="difficulty-emoji">😥</div>
                <div>Difícil</div>
              </div>
              <div 
                className={`difficulty-option very-hard ${gameDifficulty === GameDifficulty.VERY_HARD ? 'active' : ''}`}
                onClick={() => handleDifficultySelect(GameDifficulty.VERY_HARD)}
              >
                <div className="difficulty-emoji">😱</div>
                <div>Muy Difícil</div>
              </div>
            </div>
          </div>

          {/* Descripción del modo seleccionado */}
          {selectedMode && (
            <div className="description-section">
              {gameDifficulty && (
                <div className="unified-description-container">
                  <div className="mode-title">
                    {selectedMode === GamePlayMode.TUTORIAL ? 'Modo Tutorial' :
                      selectedMode === GamePlayMode.CLASSIC ? 'Modo Clásico' :
                        selectedMode === GamePlayMode.TIME_ATTACK ? 'Modo Contrarreloj' :
                          selectedMode === GamePlayMode.SURVIVAL ? 'Modo Supervivencia' :
                            selectedMode === GamePlayMode.ZEN ? 'Modo Zen' : ''}
                  </div>
                  <div>{getUnifiedDescription(selectedMode, gameDifficulty)}</div>
                </div>
              )}
            </div>
          )}
          
          {/* Contenedor para botón EMPEZAR */}
          <div className="fixed-start-button-container">
            <button 
              className={`start-button ${selectedMode && gameDifficulty ? 'active' : 'disabled'}`}
              onClick={handleStartGame}
              disabled={!selectedMode || !gameDifficulty}
            >
              ¡EMPEZAR!
            </button>
          </div>
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
    switch (currentScreen) {
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
    <div className={`game-modal-start start-game ${modalVisible ? 'visible' : ''} ${isClosing ? 'closing' : ''}`}>
      <div className="modal-content" ref={modalContentRef}>
        {/* Eliminamos completamente la cabecera del modal y el panel de configuración
            Todo se gestiona dentro de cada pantalla específica */}

        {/* Contenido principal */}
        <div className={`start-game-body ${currentScreen}`}>
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

// Re-exportar el componente
export default StartGameModal; 