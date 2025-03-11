import React, { useState, useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../../store';
import { setGameStatus } from '../../../store/slices/gameSlice';
import { useGameSound } from '../../../hooks/useGameSound';
import './PauseModal.css';

interface PauseModalProps {
  isVisible?: boolean;
  onResume?: () => void;
  onRestart?: () => void;
  onExit?: () => void;
  onSettings?: () => void;
}

// Configuración inicial para animación de la entrada del modal
const PAUSE_ANIMATIONS = {
  title: { opacity: 0, transform: 'translateY(-20px)' },
  content: { opacity: 0, transform: 'translateY(20px)' },
  buttons: { opacity: 0, transform: 'scale(0.8)' },
};

const PauseModal: React.FC<PauseModalProps> = ({ 
  isVisible = false, 
  onResume,
  onRestart,
  onExit,
  onSettings
}) => {
  const { level, score, highScore, currentPlayMode, currentDifficulty } = useSelector((state: RootState) => state.game);
  const { playSound } = useGameSound();
  const modalContentRef = useRef<HTMLDivElement>(null);
  
  // Estados para controlar animaciones y visibilidad
  const [animations, setAnimations] = useState(PAUSE_ANIMATIONS);
  const [modalVisible, setModalVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  
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
  
  // Efecto para manejar la animación de entrada cuando el modal es visible
  useEffect(() => {
    let animationTimeout: NodeJS.Timeout;
    const timeouts: NodeJS.Timeout[] = [];

    if (isVisible) {
      setModalVisible(true);
      setIsClosing(false);
      document.body.classList.add('modal-open');
      
      // Reproducir sonido de pausa
      playSound('uiOpen');

      // Animación secuencial para los elementos del modal
      timeouts.push(setTimeout(() => {
        setAnimations(prev => ({
          ...prev,
          title: { opacity: 1, transform: 'translateY(0)' }
        }));

        timeouts.push(setTimeout(() => {
          setAnimations(prev => ({
            ...prev,
            content: { opacity: 1, transform: 'translateY(0)' }
          }));

          timeouts.push(setTimeout(() => {
            setAnimations(prev => ({
              ...prev,
              buttons: { opacity: 1, transform: 'scale(1)' }
            }));
          }, 200));
        }, 200));
      }, 100));
    } else {
      setIsClosing(true);
      animationTimeout = setTimeout(() => {
        setModalVisible(false);
        setAnimations(PAUSE_ANIMATIONS);
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
      setAnimations(PAUSE_ANIMATIONS);
      
      console.log('PauseModal desmontado y recursos liberados');
    };
  }, [isVisible, playSound]);
  
  // Manejar el clic en reanudar
  const handleResume = () => {
    if (onResume) {
      setIsClosing(true);
      
      // Reproducir sonido de clic
      playSound('uiClick');
      
      // Cerrar el modal con animación y luego llamar al callback
      setTimeout(() => {
        setModalVisible(false);
        onResume();
      }, 300);
    }
  };
  
  // Manejar el clic en reiniciar
  const handleRestart = () => {
    if (onRestart) {
      setIsClosing(true);
      
      // Reproducir sonido de clic
      playSound('uiClick');
      
      // Cerrar el modal con animación y luego llamar al callback
      setTimeout(() => {
        setModalVisible(false);
        onRestart();
      }, 300);
    }
  };
  
  // Manejar el clic en salir
  const handleExit = () => {
    if (onExit) {
      setIsClosing(true);
      
      // Reproducir sonido de clic
      playSound('uiClick');
      
      // Cerrar el modal con animación y luego llamar al callback
      setTimeout(() => {
        setModalVisible(false);
        onExit();
      }, 300);
    }
  };
  
  // Manejar el clic en configuración
  const handleSettings = () => {
    if (onSettings) {
      playSound('uiClick');
      onSettings();
    }
  };
  
  // Función para formatear el nombre del modo de juego
  const getModeName = () => {
    switch (currentPlayMode) {
      case 'classic': return 'Clásico';
      case 'timed': return 'Contrarreloj';
      case 'survival': return 'Supervivencia';
      case 'zen': return 'Zen';
      default: return 'Clásico';
    }
  };
  
  // Función para formatear el nombre de la dificultad
  const getDifficultyName = () => {
    switch (currentDifficulty) {
      case 'easy': return 'Fácil';
      case 'normal': return 'Normal';
      case 'hard': return 'Difícil';
      case 'tutorial': return 'Tutorial';
      default: return 'Normal';
    }
  };
  
  // Si el modal no está visible, no renderizamos nada
  if (!modalVisible && !isVisible) {
    return null;
  }
  
  return (
    <div className={`game-modal fullscreen-modal ${modalVisible ? 'visible' : ''} ${isClosing ? 'closing' : ''}`}>
      <div className="modal-content pause-content" ref={modalContentRef}>
        <div 
          className="pause-header"
          style={{
            transition: 'all 0.6s ease',
            ...animations.title
          }}
        >
          <h1>Juego en Pausa</h1>
          <h2>¡Tómate un descanso!</h2>
        </div>
        
        <div 
          className="pause-body"
          style={{
            transition: 'all 0.5s ease',
            transitionDelay: '0.2s',
            ...animations.content
          }}
        >
          <div className="game-status-info">
            <div className="info-row">
              <div className="info-label">Nivel</div>
              <div className="info-value">{level}</div>
            </div>
            
            <div className="info-row">
              <div className="info-label">Puntuación</div>
              <div className="info-value">{score}</div>
            </div>
            
            <div className="info-row">
              <div className="info-label">Récord</div>
              <div className="info-value">{highScore}</div>
            </div>
            
            <div className="info-row">
              <div className="info-label">Modo</div>
              <div className="info-value">{getModeName()}</div>
            </div>
            
            <div className="info-row">
              <div className="info-label">Dificultad</div>
              <div className="info-value">{getDifficultyName()}</div>
            </div>
          </div>
        </div>
        
        <div 
          className="pause-buttons"
          style={{
            transition: 'all 0.4s ease',
            transitionDelay: '0.4s',
            ...animations.buttons
          }}
        >
          <button 
            className="pause-button resume-button"
            onClick={handleResume}
          >
            ▶️ Reanudar
          </button>
          
          <div className="secondary-buttons">
            <button 
              className="pause-button secondary restart-button"
              onClick={handleRestart}
            >
              🔄 Reiniciar
            </button>
            
            <button 
              className="pause-button secondary settings-button"
              onClick={handleSettings}
            >
              ⚙️ Ajustes
            </button>
            
            <button 
              className="pause-button secondary exit-button"
              onClick={handleExit}
            >
              🏠 Salir
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PauseModal; 