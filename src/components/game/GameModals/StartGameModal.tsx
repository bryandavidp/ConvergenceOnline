import React, { useState, useEffect, useRef } from 'react';
import { useGameSound } from '../../../hooks/useGameSound';
import './StartGameModal.css';

// Propiedades del modal
interface StartGameModalProps {
  isVisible?: boolean;
  onPlay?: () => void;
  onOptions?: () => void;
  onCredits?: () => void;
}

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

  // Estados locales para animaciones y UI
  const [animations, setAnimations] = useState(START_ANIMATIONS);
  const [modalVisible, setModalVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  // Efecto para manejar la animación de entrada cuando el modal es visible
  useEffect(() => {
    let animationTimeout: NodeJS.Timeout;

    if (isVisible) {
      setModalVisible(true);
      setIsClosing(false);
      document.body.classList.add('modal-open');

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
        document.body.classList.remove('modal-open');
      }, 300);
    }

    return () => {
      if (animationTimeout) {
        clearTimeout(animationTimeout);
      }
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

  // Manejadores de eventos para los botones
  const handlePlayClick = () => {
    playSound('uiSelect');
    if (onPlay) onPlay();
  };

  const handleOptionsClick = () => {
    playSound('uiSelect');
    if (onOptions) onOptions();
  };

  const handleCreditsClick = () => {
    playSound('uiSelect');
    if (onCredits) onCredits();
  };

  // Si el modal no es visible, no renderizar nada
  if (!modalVisible) return null;

  return (
    <div className={`start-game ${isClosing ? 'closing' : ''}`}>
      <div className="start-game-body">
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
      </div>
    </div>
  );
};

export default StartGameModal;