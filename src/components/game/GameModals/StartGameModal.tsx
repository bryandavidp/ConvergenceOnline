import React, { useState, useEffect, useRef } from 'react';
import { useGameSound } from '../../../hooks/useGameSound';
import { useGameContext } from '../../../contexts/GameContext';
import './StartGameModal.css';

// Propiedades del modal
interface StartGameModalProps {
  isVisible?: boolean;
  onPlay?: () => void;
  onOptions?: () => void;
  onCredits?: () => void;
}

// Tipos de pantallas disponibles
type ScreenType = 'main' | 'options' | 'credits';

// Configuración inicial para animación de la entrada del modal
const START_ANIMATIONS = {
  title: { opacity: 0, transform: 'translateY(-20px)' },
  options: { opacity: 0, transform: 'translateY(20px)' },
  button: { opacity: 0, transform: 'scale(0.8)' },
};

const StartGameModal: React.FC<StartGameModalProps> = ({
  isVisible = true,
  onPlay,
  onOptions,
  onCredits
}) => {
  // Referencias al contenido del modal
  const modalContentRef = useRef<HTMLDivElement>(null);
  const { playSound } = useGameSound();
  const { 
    isSoundEnabled, 
    setIsSoundEnabled, 
    isMusicEnabled, 
    setIsMusicEnabled 
  } = useGameContext();

  // Estados locales para animaciones y UI
  const [animations, setAnimations] = useState(START_ANIMATIONS);
  const [modalVisible, setModalVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [currentScreen, setCurrentScreen] = useState<ScreenType>('main');

  // Efecto para manejar la animación de entrada cuando el modal es visible
  useEffect(() => {
    let animationTimeout: NodeJS.Timeout;
    const timeouts: NodeJS.Timeout[] = [];

    if (isVisible) {
      setModalVisible(true);
      setIsClosing(false);
      document.body.classList.add('modal-open');

      // Animación secuencial para los elementos del modal
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
      
      console.log('StartGameModal desmontado y recursos liberados');
    };
  }, [isVisible, playSound]);

  // Modificar la función setViewportHeight para que se ejecute también en eventos táctiles
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
    
    // Añadir eventos táctiles para actualizar la altura
    window.addEventListener('touchstart', setViewportHeight);
    window.addEventListener('touchend', setViewportHeight);

    // Limpiar los event listeners al desmontar
    return () => {
      window.removeEventListener('resize', setViewportHeight);
      window.removeEventListener('orientationchange', setViewportHeight);
      window.removeEventListener('load', setViewportHeight);
      window.removeEventListener('touchstart', setViewportHeight);
      window.removeEventListener('touchend', setViewportHeight);
    };
  }, []);

  // Navegación entre pantallas
  const navigateTo = (screen: ScreenType) => {
    playSound('uiSelect');
    setCurrentScreen(screen);
  };

  // Genera estrellas para el fondo
  const generateStars = () => {
    const stars = [];
    const count = 15;
    
    for (let i = 0; i < count; i++) {
      const size = Math.random() * 3 + 1;
      const top = Math.random() * 100;
      const left = Math.random() * 100;
      const animationDuration = Math.random() * 15 + 10;
      const delay = Math.random() * 10;
      
      stars.push(
        <div
          key={i}
          className="floating-star"
          style={{
            width: `${size}px`,
            height: `${size}px`,
            top: `${top}%`,
            left: `${left}%`,
            animationDuration: `${animationDuration}s`,
            animationDelay: `${delay}s`
          }}
        />
      );
    }
    
    return stars;
  };

  // Manejadores de eventos para los botones
  const handlePlayClick = () => {
    playSound('uiSelect');
    if (onPlay) onPlay();
  };

  const handleOptionsClick = () => {
    playSound('uiSelect');
    navigateTo('options');
    if (onOptions) onOptions();
  };

  const handleCreditsClick = () => {
    playSound('uiSelect');
    navigateTo('credits');
    if (onCredits) onCredits();
  };

  // Manejadores para cambios en configuración
  const toggleSound = () => {
    playSound('uiSelect');
    setIsSoundEnabled(!isSoundEnabled);
    localStorage.setItem('soundEnabled', String(!isSoundEnabled));
  };

  const toggleMusic = () => {
    playSound('uiSelect');
    setIsMusicEnabled(!isMusicEnabled);
    localStorage.setItem('musicEnabled', String(!isMusicEnabled));
  };

  // Renderizar pantalla principal
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
            onClick={handlePlayClick}
          >
            JUGAR
          </button>

          <button
            className="main-button options-button"
            onClick={handleOptionsClick}
          >
            OPCIONES
          </button>

          <button
            className="main-button credits-button"
            onClick={handleCreditsClick}
          >
            CRÉDITOS
          </button>
        </div>
      </div>
    );
  };

  // Renderizar pantalla de opciones
  const renderOptionsScreen = () => {
    return (
      <div className="options-screen">
        <div className="screen-header">
          <h2 className="screen-title">Opciones</h2>
          <button
            className="back-button"
            onClick={() => navigateTo('main')}
          >
            ⬅️ Volver
          </button>
        </div>

        <div className="settings-content">
          <div className="settings-option">
            <span className="setting-label">Música</span>
            <button
              className={`setting-toggle ${isMusicEnabled ? 'active' : ''}`}
              onClick={toggleMusic}
            >
              {isMusicEnabled ? 'ON' : 'OFF'}
            </button>
          </div>

          <div className="settings-option">
            <span className="setting-label">Sonido</span>
            <button
              className={`setting-toggle ${isSoundEnabled ? 'active' : ''}`}
              onClick={toggleSound}
            >
              {isSoundEnabled ? 'ON' : 'OFF'}
            </button>
          </div>

          <div className="settings-section">
            <h3 className="settings-section-title">Información del Juego</h3>
            <div className="settings-info">
              <p>
                Convergencia es un juego de rompecabezas donde debes combinar iconos del mismo tipo para ganar puntos.
                Experimenta diferentes modos de juego y dificultades para desafiar tus habilidades.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Renderizar pantalla de créditos
  const renderCreditsScreen = () => {
    return (
      <div className="credits-screen">
        <div className="screen-header">
          <h2 className="screen-title">Créditos</h2>
          <button
            className="back-button"
            onClick={() => navigateTo('main')}
          >
            ⬅️ Volver
          </button>
        </div>

        <div className="credits-content">
          <h3 className="credits-title">Convergencia</h3>
          <p className="credits-subtitle">Diseñado y desarrollado por:</p>
          <p className="credits-name">Equipo de Desarrollo</p>

          <h4 className="credits-section">Programación</h4>
          <p className="credits-name">Desarrollador Principal</p>

          <h4 className="credits-section">Diseño Gráfico</h4>
          <p className="credits-name">Diseñador de UI/UX</p>

          <h4 className="credits-section">Música y Sonido</h4>
          <p className="credits-name">Compositor</p>

          <h4 className="credits-section">Agradecimientos Especiales</h4>
          <p className="credits-text">A todos los que hicieron posible este juego</p>

          <div className="version-info">
            <p>Versión 1.0.0</p>
            <p>© 2023 Todos los derechos reservados</p>
          </div>
        </div>
      </div>
    );
  };

  // Renderizar el contenido adecuado según la pantalla actual
  const renderContent = () => {
    switch (currentScreen) {
      case 'options':
        return renderOptionsScreen();
      case 'credits':
        return renderCreditsScreen();
      default:
        return renderMainScreen();
    }
  };

  // Si el modal no es visible, no renderizar nada
  if (!modalVisible) return null;

  return (
    <div className={`start-game ${isClosing ? 'closing' : ''}`}>
      <div className="start-game-body">
        {generateStars()}
        {renderContent()}
      </div>
    </div>
  );
};

export default StartGameModal;