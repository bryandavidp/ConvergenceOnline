import React, { useState, useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useGameContext } from '../../../contexts/GameContext';
import { GamePlayMode, GameDifficulty } from '../../../types/game';
import { useGameSound } from '../../../hooks/useGameSound';
import { useDarkMode } from '../../../hooks/useDarkMode';
import useGameLogic from '../../../hooks/useGameLogic';
import { ICONS } from '../../../constants/icons';
import { RootState } from '../../../store';
import './ModeSelectionModal.css';
import { FaInfoCircle, FaLock, FaGraduationCap, FaChessBoard, FaStopwatch, FaHeartbeat, FaYinYang, FaFeather, FaStar, FaCircle, FaFire, FaSkull, FaQuestionCircle, FaTimes } from 'react-icons/fa';

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

// Títulos para los modos de juego
const MODE_TITLES = {
  [GamePlayMode.CLASSIC]: 'Clásico',
  [GamePlayMode.TIME_ATTACK]: 'Contrarreloj',
  [GamePlayMode.SURVIVAL]: 'Supervivencia',
  [GamePlayMode.ZEN]: 'Zen',
  [GamePlayMode.TUTORIAL]: 'Tutorial'
};

// Función auxiliar para comprobar si el modo seleccionado es el tutorial
const isTutorialMode = (mode: ExtendedGameMode | null): boolean => {
  return mode !== null && mode === GamePlayMode.TUTORIAL;
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

// Texto unificado de descripción que combina modo y dificultad
const getUnifiedDescription = (mode: GamePlayMode | null, difficulty: GameDifficulty | null): string => {
  // Si no hay modo seleccionado, mostrar mensaje instructivo
  if (!mode) {
    return '👈 Selecciona un modo de juego para comenzar';
  }
  
  // Para el tutorial solo mostramos la descripción del modo
  if (isTutorialMode(mode)) {
    return 'Aprende los conceptos básicos del juego paso a paso. El tutorial te guiará con instrucciones simples para dominar las mecánicas.';
  }
  
  // Para modo Zen no necesitamos dificultad
  if (mode === GamePlayMode.ZEN) {
    return 'Modo relajado sin presión. Juega a tu ritmo, sin límites de tiempo ni objetivos específicos. Perfecto para practicar y disfrutar.';
  }
  
  // Para los demás modos necesitamos una dificultad seleccionada
  if (!difficulty) {
    return '👈 Selecciona una dificultad para este modo';
  }
  
  // Descripción base del modo
  let modeDesc = '';
  switch (mode) {
    case GamePlayMode.CLASSIC:
      modeDesc = 'Modo tradicional donde debes alcanzar objetivos específicos para avanzar de nivel.';
      break;
    case GamePlayMode.TIME_ATTACK:
      modeDesc = 'Contrarreloj: acumula la mayor cantidad de puntos antes de que se acabe el tiempo.';
      break;
    case GamePlayMode.SURVIVAL:
      modeDesc = 'Sobrevive el mayor tiempo posible con dificultad creciente.';
      break;
    default:
      modeDesc = MODE_DESCRIPTIONS[mode];
  }
  
  // Descripción de la dificultad
  let diffDesc = '';
  switch (difficulty) {
    case GameDifficulty.VERY_EASY:
      diffDesc = 'Nivel muy accesible, ideal para principiantes.';
      break;
    case GameDifficulty.EASY:
      diffDesc = 'Dificultad baja, buen punto de partida.';
      break;
    case GameDifficulty.MEDIUM:
      diffDesc = 'Dificultad equilibrada, recomendada para la mayoría de jugadores.';
      break;
    case GameDifficulty.HARD:
      diffDesc = 'Desafiante, para jugadores experimentados.';
      break;
    case GameDifficulty.VERY_HARD:
      diffDesc = 'Extremadamente difícil, solo para expertos.';
      break;
  }
  
  return `${modeDesc} ${diffDesc}`;
};

// Componente para mostrar el icono de cada modo de juego
const ModeIcon: React.FC<{ mode: GamePlayMode }> = ({ mode }) => {
  const getIcon = () => {
    switch (mode) {
      case GamePlayMode.TUTORIAL:
        return <FaGraduationCap className="mode-icon tutorial-icon" />;
      case GamePlayMode.CLASSIC:
        return <FaChessBoard className="mode-icon classic-icon" />;
      case GamePlayMode.TIME_ATTACK:
        return <FaStopwatch className="mode-icon timed-icon" />;
      case GamePlayMode.SURVIVAL:
        return <FaHeartbeat className="mode-icon survival-icon" />;
      case GamePlayMode.ZEN:
        return <FaYinYang className="mode-icon zen-icon" />;
      default:
        return null;
    }
  };

  return <div className="mode-icon-container">{getIcon()}</div>;
};

// Componente para mostrar el icono de cada nivel de dificultad
const DifficultyIcon: React.FC<{ difficulty: GameDifficulty }> = ({ difficulty }) => {
  const getIcon = () => {
    switch (difficulty) {
      case GameDifficulty.VERY_EASY:
        return <FaFeather className="difficulty-icon very-easy-icon" />;
      case GameDifficulty.EASY:
        return <FaStar className="difficulty-icon easy-icon" />;
      case GameDifficulty.MEDIUM:
        return <FaCircle className="difficulty-icon medium-icon" />;
      case GameDifficulty.HARD:
        return <FaFire className="difficulty-icon hard-icon" />;
      case GameDifficulty.VERY_HARD:
        return <FaSkull className="difficulty-icon very-hard-icon" />;
      default:
        return null;
    }
  };

  return <div className="difficulty-icon-container">{getIcon()}</div>;
};

// Reemplazar el componente DifficultyOption
const DifficultyOption: React.FC<{
  difficulty: GameDifficulty;
  selected: boolean;
  onClick: () => void;
}> = ({ difficulty, selected, onClick }) => {
  // Etiquetas para cada nivel de dificultad
  const difficultyLabels = {
    [GameDifficulty.VERY_EASY]: 'Muy Fácil',
    [GameDifficulty.EASY]: 'Fácil',
    [GameDifficulty.MEDIUM]: 'Normal',
    [GameDifficulty.HARD]: 'Difícil',
    [GameDifficulty.VERY_HARD]: 'Muy Difícil'
  };

  return (
    <div 
      className={`difficulty-option ${difficulty.toLowerCase().replace('_', '-')} ${selected ? 'active' : ''}`}
      onClick={onClick}
    >
      <DifficultyIcon difficulty={difficulty} />
      <div className="difficulty-shine-effect"></div>
    </div>
  );
};

// Componente para el tooltip informativo
const InfoTooltip: React.FC<{ children?: React.ReactNode; title: string; content: React.ReactNode; position?: 'top' | 'right' | 'bottom' | 'left' }> = ({ children, title, content, position = 'bottom' }) => {
  const [isVisible, setIsVisible] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Función para cerrar el tooltip cuando se hace clic fuera de él
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(event.target as Node)) {
        setIsVisible(false);
      }
    };

    if (isVisible) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isVisible]);

  return (
    <div className="tooltip-container" ref={tooltipRef}>
      <div 
        className="info-icon-container" 
        onClick={() => setIsVisible(!isVisible)}
      >
        {children || <FaInfoCircle className="info-icon" />}
      </div>
      {isVisible && (
        <div className={`tooltip tooltip-${position}`}>
          <div className="tooltip-header">
            <span className="tooltip-title">{title}</span>
            <button 
              className="tooltip-close-btn" 
              onClick={() => setIsVisible(false)}
            >
              <FaTimes />
            </button>
          </div>
          <div className="tooltip-content">
            {content}
          </div>
        </div>
      )}
    </div>
  );
};

// Contenido para el tooltip de modos de juego
const GameModesTooltipContent = () => {
  return (
    <div className="tooltip-modes">
      <div className="tooltip-mode-item">
        <span className="tooltip-mode-name">
          <FaGraduationCap className="tooltip-icon" /> Tutorial
        </span>
        Aprende los controles básicos y mecánicas del juego paso a paso en un entorno seguro.
      </div>
      <div className="tooltip-mode-item">
        <span className="tooltip-mode-name">
          <FaChessBoard className="tooltip-icon" /> Clásico
        </span>
        Completa niveles con objetivos específicos. El modo tradicional para disfrutar del juego.
      </div>
      <div className="tooltip-mode-item">
        <span className="tooltip-mode-name">
          <FaStopwatch className="tooltip-icon" /> Contrarreloj
        </span>
        Consigue la mayor puntuación posible antes de que se acabe el tiempo. ¡Cada segundo cuenta!
      </div>
      <div className="tooltip-mode-item">
        <span className="tooltip-mode-name">
          <FaHeartbeat className="tooltip-icon" /> Supervivencia
        </span>
        Sobrevive el mayor tiempo posible mientras la dificultad aumenta gradualmente. El verdadero desafío.
      </div>
      <div className="tooltip-mode-item">
        <span className="tooltip-mode-name">
          <FaYinYang className="tooltip-icon" /> Zen
        </span>
        Juega sin presión, sin límites de tiempo ni objetivos específicos. Ideal para relajarse.
      </div>
    </div>
  );
};

// Contenido para el tooltip de dificultades
const DifficultyTooltipContent = () => {
  return (
    <div className="tooltip-difficulties">
      <div className="tooltip-difficulty-item">
        <span className="tooltip-difficulty-name">
          <FaFeather className="tooltip-icon" /> Muy Fácil
        </span>
        Ritmo lento con pocas piezas en pantalla. Ideal para principiantes y para aprender el juego.
      </div>
      <div className="tooltip-difficulty-item">
        <span className="tooltip-difficulty-name">
          <FaStar className="tooltip-icon" /> Fácil
        </span>
        Un desafío ligero con movimientos predecibles. Perfecto para jugadores novatos.
      </div>
      <div className="tooltip-difficulty-item">
        <span className="tooltip-difficulty-name">
          <FaCircle className="tooltip-icon" /> Normal
        </span>
        Dificultad equilibrada para la mayoría de jugadores. El ritmo estándar del juego.
      </div>
      <div className="tooltip-difficulty-item">
        <span className="tooltip-difficulty-name">
          <FaFire className="tooltip-icon" /> Difícil
        </span>
        Ritmo acelerado con más piezas y menos tiempo. Para jugadores experimentados.
      </div>
      <div className="tooltip-difficulty-item">
        <span className="tooltip-difficulty-name">
          <FaSkull className="tooltip-icon" /> Muy Difícil
        </span>
        Un verdadero reto incluso para expertos. Requiere reflejos rápidos y estrategia avanzada.
      </div>
    </div>
  );
};

const StartGameModal: React.FC<StartGameModalProps> = ({ isVisible = true, onStart }) => {
  // Referencias al contenido del modal y al tablero de juego
  const modalContentRef = useRef<HTMLDivElement>(null);
  const { playSound } = useGameSound();
  const { darkMode } = useDarkMode();
  const dispatch = useDispatch();
  
  // Estado del juego y configuración
  const {
    gameMode,
    setGameMode,
    gameDifficulty: storedGameDifficulty,
    setGameDifficulty: setStoredGameDifficulty,
    isSoundEnabled,
    setIsSoundEnabled,
    isMusicEnabled,
    setIsMusicEnabled
  } = useGameContext();
  
  // Obtenemos información del estado del juego
  const { highScore } = useSelector((state: RootState) => state.game);
  // const isNewPlayer = highScore <= 0;
  const isNewPlayer = false;
  
  // Verificamos si el tutorial ha sido completado
  const [tutorialCompleted, setTutorialCompleted] = useState<boolean>(() => {
    // Desactivar tutorial para pruebas
    localStorage.setItem('tutorialCompleted', 'true');
    return localStorage.getItem('tutorialCompleted') === 'true';
  });
  
  // Estado para la modal
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [musicEnabled, setMusicEnabled] = useState<boolean>(true);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  
  // Estados para la selección de modo y dificultad
  const [selectedMode, setSelectedMode] = useState<GamePlayMode | null>(null);
  const [localDifficulty, setLocalDifficulty] = useState<GameDifficulty | null>(storedGameDifficulty || null);
  const [prevCompletedLevels, setPrevCompletedLevels] = useState<number[]>([]);
  const [isSettingUp, setIsSettingUp] = useState<boolean>(false);
  
  // Generar estrellas flotantes para efecto espacial
  const [stars, setStars] = useState<React.ReactNode[]>([]);
  
  useEffect(() => {
    const generateStars = () => {
      const newStars = [];
      // Reducimos la cantidad de estrellas para mejorar el rendimiento
      const starCount = 6; 
      
      for (let i = 0; i < starCount; i++) {
        // Tamaño más controlado para mejor rendimiento
        const size = Math.random() * 2.5 + 1;
        const left = Math.random() * 100;
        // Aumentamos la duración para que parezcan más estrellas con menos elementos
        const duration = Math.random() * 20 + 20;
        const delay = Math.random() * 15;
        
        newStars.push(
          <div 
            key={i}
            className="floating-star"
            style={{
              width: `${size}px`,
              height: `${size}px`,
              left: `${left}%`,
              opacity: 0,
              // Usamos will-change en inline style para asegurar que se aplique
              animation: `floatStar ${duration}s linear ${delay}s infinite`,
              backgroundColor: '#FFD700', // Color dorado
              boxShadow: '0 0 4px 1px rgba(255, 215, 0, 0.6)'
            }}
          />
        );
      }
      
      setStars(newStars);
    };
    
    generateStars();
  }, []);

  // Obtener la función changeGameConfig de useGameLogic
  const { changeGameConfig } = useGameLogic();

  // Estados locales para animaciones y UI
  const [animations, setAnimations] = useState(START_ANIMATIONS);
  const [modalVisible, setModalVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [currentScreen, setCurrentScreen] = useState<ScreenType>('main');
  const [configReady, setConfigReady] = useState(isNewPlayer);
  const [enableTutorial, setEnableTutorial] = useState(isNewPlayer);

  // Añadir un efecto para manejar eventos táctiles y prevenir comportamientos no deseados
  useEffect(() => {
    // Fijar el tamaño del viewport para dispositivos móviles
    const setViewportHeight = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };
    
    // Ejecutar inicialmente y cuando cambie el tamaño de la ventana
    setViewportHeight();
    window.addEventListener('resize', setViewportHeight);
    window.addEventListener('orientationchange', setViewportHeight);
    
    // Referencia al contenedor de selección
    const gameSelectionContainer = document.querySelector('.game-selection-container');
    
    if (gameSelectionContainer) {
      // Mejorar el scroll táctil
      const preventDefaultForScrolling = (e: Event) => {
        // Permitir el desplazamiento normal
        e.stopPropagation();
      };
      
      // Añadir listeners
      gameSelectionContainer.addEventListener('touchstart', preventDefaultForScrolling, { passive: true });
      gameSelectionContainer.addEventListener('touchmove', preventDefaultForScrolling, { passive: true });
      
      // Limpiar al desmontar
      return () => {
        window.removeEventListener('resize', setViewportHeight);
        window.removeEventListener('orientationchange', setViewportHeight);
        gameSelectionContainer.removeEventListener('touchstart', preventDefaultForScrolling);
        gameSelectionContainer.removeEventListener('touchmove', preventDefaultForScrolling);
      };
    }
    
    return () => {
      window.removeEventListener('resize', setViewportHeight);
      window.removeEventListener('orientationchange', setViewportHeight);
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
      (selectedMode && localDifficulty)
    ) {
      setConfigReady(true);
    } else {
      setConfigReady(false);
    }
  }, [selectedMode, localDifficulty]);

  // Manejar la aparición/desaparición de la modal
  useEffect(() => {
    let animationTimeout: NodeJS.Timeout;
    const timeouts: NodeJS.Timeout[] = [];

    if (isVisible) {
      setModalVisible(true);
      setIsClosing(false);
      document.body.classList.add('modal-open');
      
      // Para nuevos jugadores, forzar el tutorial
      if (isNewPlayer && !tutorialCompleted) {
        setSelectedMode(GamePlayMode.TUTORIAL);
        setLocalDifficulty(GameDifficulty.EASY);
      }
      
      // Siempre ir a la pantalla de juego al abrir el modal
      setCurrentScreen('play');

      // Animation timeline
      timeouts.push(setTimeout(() => {
        setAnimations(prev => ({
          ...prev,
          title: { opacity: 1, transform: 'translateY(0)' }
        }));

        timeouts.push(setTimeout(() => {
          setAnimations(prev => ({
            ...prev,
            options: { opacity: 1, transform: 'translateY(0)' }
          }));

          timeouts.push(setTimeout(() => {
            setAnimations(prev => ({
              ...prev,
              button: { opacity: 1, transform: 'scale(1)' }
            }));
          }, 200));
        }, 200));
      }, 100));
    } else {
      setIsClosing(true);
      animationTimeout = setTimeout(() => {
        setModalVisible(false);
        setAnimations(START_ANIMATIONS);
        document.body.classList.remove('modal-open');
        // Resetear a la pantalla principal cuando se cierra el modal
        setCurrentScreen('main');
      }, 300);
    }

    return () => {
      // Limpieza exhaustiva de todos los timeouts
      if (animationTimeout) {
        clearTimeout(animationTimeout);
      }
      
      // Limpiar todos los timeouts acumulados
      timeouts.forEach(timeout => clearTimeout(timeout));
      
      // Asegurar que el cuerpo no se quede con la clase modal-open
      document.body.classList.remove('modal-open');
      
      // Reiniciar estados
      setIsClosing(false);
      setAnimations(START_ANIMATIONS);
      
      console.log('ModeSelectionModal desmontado y recursos liberados');
    };
  }, [isVisible, currentScreen, isNewPlayer, tutorialCompleted]);

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
    const convertModeToReduxFormat = (mode: GamePlayMode): 'classic' | 'timed' | 'survival' | 'zen' | 'tutorial' => {
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
          return 'tutorial'; // Ahora usamos 'tutorial' también como modo en el backend
        default:
          return 'classic';
      }
    };

    // Configurar el modo según la selección
    if (isTutorialMode(selectedMode)) {
      // Iniciar tutorial
      console.log("Iniciando tutorial");
      setGameMode(GamePlayMode.TUTORIAL);
      setLocalDifficulty(GameDifficulty.EASY); // Dificultad fácil para tutorial
      
      // Actualizar también el estado Redux - usamos los tipos correctos para Redux
      changeGameConfig({ 
        difficulty: 'tutorial' as any, 
        mode: 'tutorial' as any 
      });

      // Verificar que se ha aplicado correctamente
      console.log("Modo de juego cambiado a tutorial - GameMode:", GamePlayMode.TUTORIAL);
      
      // Marcar el tutorial como completado cuando el usuario lo inicia
      localStorage.setItem('tutorialCompleted', 'true');
      setTutorialCompleted(true);
    } else if (selectedMode === GamePlayMode.ZEN) {
      // Iniciar modo zen
      console.log("Iniciando modo Zen");
      setGameMode(GamePlayMode.ZEN);
      setLocalDifficulty(GameDifficulty.EASY); // Default para el backend
      // Actualizar también el estado Redux
      changeGameConfig({ 
        difficulty: 'easy' as any, 
        mode: 'zen' as any 
      });
    } else {
      // Iniciar otros modos (clásico, contrarreloj, supervivencia)
      console.log(`Iniciando modo ${selectedMode} con dificultad ${localDifficulty}`);
      setGameMode(selectedMode);
      
      // Actualizar también el estado Redux
      changeGameConfig({
        difficulty: localDifficulty ? convertDifficultyToReduxFormat(localDifficulty) as any : 'easy' as any,
        mode: convertModeToReduxFormat(selectedMode) as any
      });
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
    // Si es un nuevo jugador y no ha completado el tutorial, solo permitir seleccionar el tutorial
    if (isNewPlayer && !tutorialCompleted && mode !== GamePlayMode.TUTORIAL) {
      playSound('uiClick');
      // Podríamos mostrar un mensaje de notificación aquí
      return;
    }

    playSound('uiSelect');
    setSelectedMode(mode);
    
    // Si se selecciona el tutorial, establecer dificultad a fácil
    if (isTutorialMode(mode)) {
      setLocalDifficulty(GameDifficulty.EASY);
    }
    
    // Actualizar el estado de configuración listo
    setConfigReady(
      // Un modo y una dificultad seleccionados
      mode !== null && (
        // - Un modo Tutorial o Zen (no requieren dificultad)
        isTutorialMode(mode) ||
        mode === GamePlayMode.ZEN ||
        // - O cualquier otro modo con dificultad seleccionada
        localDifficulty !== null
      )
    );
  };

  // Selecciona el nivel de dificultad
  const handleDifficultySelect = (difficulty: GameDifficulty) => {
    if (!isSettingUp) {
      setLocalDifficulty(difficulty);
      playSound('uiTap');
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
    // Determinar qué modos deben mostrarse
    const shouldShowTutorial = isNewPlayer || !tutorialCompleted;
    const areModesBeyondTutorialLocked = isNewPlayer && !tutorialCompleted;
    
    // Obtener descripción para el modo seleccionado
    const displayModeTitle = selectedMode ? MODE_TITLES[selectedMode] : '';
    const displayModeDescription = selectedMode ? getUnifiedDescription(selectedMode, localDifficulty) : '';
    
    return (
      <div className="play-screen">
        {/* Estrellas flotantes */}
        {stars}
        
        {/* Cabecera con navegación */}
        <div className="game-header">
          <button className="back-button" onClick={() => navigateTo('main')}>
            🏠
          </button>
          <h2 className="header-title">Selecciona el modo de juego</h2>
          <div className="header-spacer"></div>
        </div>
        
        <div className="game-selection-container">
          {/* Mensaje de bienvenida para nuevos jugadores - solo si es nuevo jugador */}
          {isNewPlayer && !tutorialCompleted && (
            <div className="new-player-message">
              <p>¡Completa el tutorial para desbloquear todos los modos!</p>
            </div>
          )}
          
          {/* Sección de modos de juego con tooltip */}
          <div className="modes-section">
            <div className="section-header">
              <h3 className="section-title">Modo de juego</h3>
              <InfoTooltip 
                title="Modos de Juego" 
                content={<GameModesTooltipContent />} 
              />
            </div>
            <div className="modes-grid">
              {shouldShowTutorial && (
                <div 
                  className={`game-option tutorial ${selectedMode === GamePlayMode.TUTORIAL ? 'active' : ''}`}
                  onClick={() => handleModeSelect(GamePlayMode.TUTORIAL)}
                >
                  <div className="game-option-image">
                    <ModeIcon mode={GamePlayMode.TUTORIAL} />
                  </div>
                  <div className="game-option-title">Tutorial</div>
                  <span className="recommended-badge">Recomendado</span>
                  <div className="mode-shine-effect"></div>
                </div>
              )}
              <div 
                className={`game-option classic ${selectedMode === GamePlayMode.CLASSIC ? 'active' : ''} ${areModesBeyondTutorialLocked ? 'locked' : ''}`}
                onClick={() => !areModesBeyondTutorialLocked && handleModeSelect(GamePlayMode.CLASSIC)}
              >
                <div className="game-option-image">
                  <ModeIcon mode={GamePlayMode.CLASSIC} />
                </div>
                <div className="game-option-title">Clásico</div>
                {areModesBeyondTutorialLocked && <FaLock className="mode-lock-icon" />}
                <div className="mode-shine-effect"></div>
              </div>
              <div 
                className={`game-option timed ${selectedMode === GamePlayMode.TIME_ATTACK ? 'active' : ''} ${areModesBeyondTutorialLocked ? 'locked' : ''}`}
                onClick={() => !areModesBeyondTutorialLocked && handleModeSelect(GamePlayMode.TIME_ATTACK)}
              >
                <div className="game-option-image">
                  <ModeIcon mode={GamePlayMode.TIME_ATTACK} />
                </div>
                <div className="game-option-title">Contrarreloj</div>
                {areModesBeyondTutorialLocked && <FaLock className="mode-lock-icon" />}
                <div className="mode-shine-effect"></div>
              </div>
              <div 
                className={`game-option survival ${selectedMode === GamePlayMode.SURVIVAL ? 'active' : ''} ${areModesBeyondTutorialLocked ? 'locked' : ''}`}
                onClick={() => !areModesBeyondTutorialLocked && handleModeSelect(GamePlayMode.SURVIVAL)}
              >
                <div className="game-option-image">
                  <ModeIcon mode={GamePlayMode.SURVIVAL} />
                </div>
                <div className="game-option-title">Supervivencia</div>
                {areModesBeyondTutorialLocked && <FaLock className="mode-lock-icon" />}
                <div className="mode-shine-effect"></div>
              </div>
              <div 
                className={`game-option zen ${selectedMode === GamePlayMode.ZEN ? 'active' : ''} ${areModesBeyondTutorialLocked ? 'locked' : ''}`}
                onClick={() => !areModesBeyondTutorialLocked && handleModeSelect(GamePlayMode.ZEN)}
              >
                <div className="game-option-image">
                  <ModeIcon mode={GamePlayMode.ZEN} />
                </div>
                <div className="game-option-title">Zen</div>
                {areModesBeyondTutorialLocked && <FaLock className="mode-lock-icon" />}
                <div className="mode-shine-effect"></div>
              </div>
            </div>
          </div>
          
          {/* Sección de dificultad con tooltip */}
          <div className="difficulty-section">
            <div className="section-header">
              <h3 className="section-title">Dificultad</h3>
              <InfoTooltip 
                title="Niveles de Dificultad" 
                content={<DifficultyTooltipContent />} 
              />
            </div>
            <div className="difficulty-options">
              <DifficultyOption 
                difficulty={GameDifficulty.VERY_EASY} 
                selected={localDifficulty === GameDifficulty.VERY_EASY}
                onClick={() => handleDifficultySelect(GameDifficulty.VERY_EASY)}
              />
              <DifficultyOption 
                difficulty={GameDifficulty.EASY} 
                selected={localDifficulty === GameDifficulty.EASY}
                onClick={() => handleDifficultySelect(GameDifficulty.EASY)}
              />
              <DifficultyOption 
                difficulty={GameDifficulty.MEDIUM} 
                selected={localDifficulty === GameDifficulty.MEDIUM}
                onClick={() => handleDifficultySelect(GameDifficulty.MEDIUM)}
              />
              <DifficultyOption 
                difficulty={GameDifficulty.HARD} 
                selected={localDifficulty === GameDifficulty.HARD}
                onClick={() => handleDifficultySelect(GameDifficulty.HARD)}
              />
              <DifficultyOption 
                difficulty={GameDifficulty.VERY_HARD} 
                selected={localDifficulty === GameDifficulty.VERY_HARD}
                onClick={() => handleDifficultySelect(GameDifficulty.VERY_HARD)}
              />
            </div>
          </div>

          {/* Descripción del modo seleccionado */}
          {selectedMode && (
            <div className="description-section">
              <div className="unified-description-container">
                <h3 className="mode-title">
                  {displayModeTitle ? `Modo ${displayModeTitle}` : 'Selecciona un modo'}
                </h3>
                <p>{displayModeDescription}</p>
              </div>
            </div>
          )}
        </div>
        
        {/* Botón EMPEZAR fijo en la parte inferior */}
        <div className="fixed-start-button-container">
          <button 
            className={`start-button ${selectedMode && localDifficulty ? 'active' : 'disabled'}`}
            onClick={handleStartGame}
            disabled={!selectedMode || !localDifficulty}
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