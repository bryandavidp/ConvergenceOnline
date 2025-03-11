import React, { useState, useEffect, useRef } from 'react';
import { useGameContext } from '../../../contexts/GameContext';
import { useGameSound } from '../../../hooks/useGameSound';
import { useSelector } from 'react-redux';
import { RootState } from '../../../store';
import './GameOverModal.css';

interface GameOverModalProps {
  isVisible?: boolean;
  onRestart?: () => void;
  onReturnToMenu?: () => void;
}

// Configuración inicial para animación de la entrada del modal
const GAME_OVER_ANIMATIONS = {
  title: { opacity: 0, transform: 'translateY(-20px)' },
  content: { opacity: 0, transform: 'translateY(20px)' },
  button: { opacity: 0, transform: 'scale(0.8)' },
};

// Iconos flotantes para el efecto espacial (limitamos a menos iconos para rendimiento)
const FLOATING_ICONS = ['🪐', '💫', '✨', '🌟'];

const GameOverModal: React.FC<GameOverModalProps> = ({ isVisible = false, onRestart, onReturnToMenu }) => {
  const { gameState } = useGameContext();
  const { 
    score, 
    level, 
    comboCount, 
    comboMultiplier, 
    highScore, 
    gameEndReason, 
    currentPlayMode, 
    currentDifficulty,
    spawnRate
  } = useSelector((state: RootState) => state.game);
  const { playSound } = useGameSound();
  const modalContentRef = useRef<HTMLDivElement>(null);
  
  // Estados para controlar animaciones y visibilidad
  const [animations, setAnimations] = useState(GAME_OVER_ANIMATIONS);
  const [modalVisible, setModalVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isNewHighScore, setIsNewHighScore] = useState(false);
  const [floatingIcons, setFloatingIcons] = useState<{icon: string, style: React.CSSProperties}[]>([]);
  
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
  
  // Efecto para crear iconos flotantes en el espacio (limitados en dispositivos pequeños)
  useEffect(() => {
    if (isVisible && modalVisible) {
      const icons = [];
      // Reducimos la cantidad de iconos en pantallas pequeñas
      const isSmallScreen = window.innerWidth < 400 || window.innerHeight < 700;
      const iconCount = isSmallScreen ? 3 : Math.min(5, Math.floor(window.innerWidth / 120));
      
      for (let i = 0; i < iconCount; i++) {
        // Valores aleatorios para posición y animación
        const top = Math.random() * 100;
        const left = Math.random() * 100;
        const size = Math.random() * (isSmallScreen ? 1 : 1.5) + 0.8; // Tamaño entre 0.8 y 1.8em o 2.3em
        const duration = Math.random() * 15 + 20; // Duración entre 20 y 35s
        const delay = Math.random() * 5; // Retraso aleatorio hasta 5s
        const icon = FLOATING_ICONS[Math.floor(Math.random() * FLOATING_ICONS.length)];
        
        icons.push({
          icon,
          style: {
            position: 'absolute',
            top: `${top}%`,
            left: `${left}%`,
            fontSize: `${size}em`,
            opacity: isSmallScreen ? 0.3 : 0.5, // Menor opacidad en pantallas pequeñas
            filter: 'blur(0.5px)',
            animation: `float ${duration}s ease-in-out ${delay}s infinite`,
            zIndex: 1
          } as React.CSSProperties
        });
      }
      
      setFloatingIcons(icons);
    }
  }, [isVisible, modalVisible]);
  
  // Efecto para manejar la animación de entrada cuando el modal es visible
  useEffect(() => {
    let animationTimeout: NodeJS.Timeout;
    const timeouts: NodeJS.Timeout[] = [];

    if (isVisible) {
      setModalVisible(true);
      setIsClosing(false);
      document.body.classList.add('modal-open');
      
      // Verificar si hay nuevo récord
      setIsNewHighScore(score > highScore);
      
      // Reproducir sonido de game over
      playSound('gameOver');

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
              button: { opacity: 1, transform: 'scale(1)' }
            }));
          }, 150)); // Acortamos los tiempos para una experiencia más fluida
        }, 150));
      }, 100));
    } else {
      setIsClosing(true);
      animationTimeout = setTimeout(() => {
        setModalVisible(false);
        setAnimations(GAME_OVER_ANIMATIONS);
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
      setAnimations(GAME_OVER_ANIMATIONS);
    };
  }, [isVisible, playSound, score, highScore]);
  
  const handleRestartClick = () => {
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
  
  // Manejar el clic en volver al menú principal
  const handleReturnToMenuClick = () => {
    if (onReturnToMenu) {
      setIsClosing(true);
      
      // Reproducir sonido de clic
      playSound('uiClick');
      
      // Cerrar el modal con animación y luego llamar al callback
      setTimeout(() => {
        setModalVisible(false);
        onReturnToMenu();
      }, 300);
    }
  };
  
  // Función para obtener la clase de estilo según el nivel de combo
  const getComboClass = () => {
    if (comboMultiplier >= 5.0) return 'combo-legendary-text';
    if (comboMultiplier >= 3.0) return 'combo-epic-text';
    if (comboMultiplier >= 2.0) return 'combo-rare-text';
    if (comboMultiplier >= 1.5) return 'combo-uncommon-text';
    return 'combo-basic-text';
  };
  
  // Función para obtener color según nivel de combo
  const getComboColor = () => {
    if (comboMultiplier >= 5.0) return '#FFD700'; // Dorado para legendario
    if (comboMultiplier >= 3.0) return '#FF2D55'; // Rojo para épico
    if (comboMultiplier >= 2.0) return '#8E2DE2'; // Púrpura para raro
    if (comboMultiplier >= 1.5) return '#36D1DC'; // Azul para poco común
    return '#FFFFFF'; // Blanco para básico
  };
  
  // Función para obtener el nombre del modo de juego en español
  const getPlayModeName = (mode: string): string => {
    const modeNames: {[key: string]: string} = {
      'classic': 'Clásico',
      'timed': 'Contrarreloj',
      'survival': 'Supervivencia',
      'zen': 'Zen',
      'tutorial': 'Tutorial'
    };
    return modeNames[mode] || mode;
  };
  
  // Función para obtener el nombre de la dificultad en español
  const getDifficultyName = (difficulty: string): string => {
    const difficultyNames: {[key: string]: string} = {
      'easy': 'Fácil',
      'normal': 'Normal',
      'hard': 'Difícil',
      'tutorial': 'Tutorial'
    };
    return difficultyNames[difficulty] || difficulty;
  };
  
  // Función para formatear la velocidad de spawn
  const formatSpawnRate = (rate: number): string => {
    return (rate / 1000).toFixed(1) + 's';
  };

  // Función para determinar si mostrar las pills de sesión como flex o grid según el espacio
  const getSessionInfoClassName = () => {
    // En pantallas muy pequeñas, usamos una organización más compacta
    return `game-session-info ${window.innerWidth <= 375 ? 'compact-layout' : ''}`;
  };
  
  // Si el modal no está visible, no renderizamos nada
  if (!modalVisible && !isVisible) {
    return null;
  }
  
  return (
    <div className={`game-modal fullscreen-modal ${modalVisible ? 'visible' : ''} ${isClosing ? 'closing' : ''}`}>
      {/* Iconos flotantes de fondo para efecto espacial */}
      {floatingIcons.map((item, index) => (
        <div key={`floating-icon-${index}`} style={item.style}>
          {item.icon}
        </div>
      ))}
      
      <div className="modal-content game-over-content" ref={modalContentRef}>
        <div 
          className="game-over-header"
          style={{
            transition: 'all 0.5s ease',
            ...animations.title
          }}
        >
          <h1>¡MISIÓN FALLIDA!</h1>
          <h2>{isNewHighScore ? '¡Nuevo récord galáctico!' : '¡Has perdido esta batalla espacial!'}</h2>
          
          {/* Sección para mostrar el modo, dificultad y velocidad */}
          <div className={getSessionInfoClassName()}>
            <div className="info-pill">
              <span className="info-label">🎮</span>
              <span className="info-value">{getPlayModeName(currentPlayMode)}</span>
            </div>
            <div className="info-pill">
              <span className="info-label">🚀</span>
              <span className="info-value">{level}</span>
            </div>
            <div className="info-pill">
              <span className="info-label">🔥</span>
              <span className="info-value">{getDifficultyName(currentDifficulty)}</span>
            </div>
            <div className="info-pill">
              <span className="info-label">⚡</span>
              <span className="info-value">{formatSpawnRate(spawnRate)}</span>
            </div>
          </div>
          
          {/* Mostrar el motivo del fin del juego */}
          {gameEndReason && (
            <div className="game-end-reason">
              <p>{gameEndReason}</p>
            </div>
          )}
        </div>
        
        <div 
          className="game-over-body"
          style={{
            transition: 'all 0.5s ease',
            transitionDelay: '0.15s',
            ...animations.content
          }}
        >
          <div className="main-stats">
            <div className="record-score-container">
              <div className="record-badge">
                <div className="record-icon">👑</div>
                <div className="record-value">{highScore}</div>
              </div>
              <div className="current-score">
                <div className="score-label">Puntuación</div>
                <div className={`score-value ${isNewHighScore ? 'new-high-score' : ''}`}>
                  {score}
                </div>
              </div>
            </div>
            
            <div className="compact-stats-grid">
              <div className="compact-stat-item">
                <div className="compact-stat-icon">🚀</div>
                <div className="compact-stat-value">{level}</div>
                <div className="compact-stat-label">Nivel</div>
              </div>
              
              <div className="compact-stat-item">
                <div className="compact-stat-icon">🔥</div>
                <div className={`compact-stat-value ${getComboClass()}`} style={{ color: getComboColor() }}>
                  {comboCount}
                </div>
                <div className="compact-stat-label">
                  Combo {comboMultiplier > 1 ? `${comboMultiplier.toFixed(1)}x` : ''}
                </div>
              </div>
              
              <div className="compact-stat-item">
                <div className="compact-stat-icon">⭐</div>
                <div className="compact-stat-value">+{Math.floor(score * 0.1)}</div>
                <div className="compact-stat-label">EXP</div>
              </div>
            </div>
          </div>
          
          <div className="game-over-message">
            <p>{isNewHighScore 
              ? '¡Has establecido un nuevo récord en la galaxia! ¿Podrás superarlo?' 
              : 'No te rindas, tu aventura espacial continúa. ¡Mejora y conquista las estrellas!'}
            </p>
          </div>
        </div>
        
        <div className="game-over-buttons">
          <button 
            className="game-button primary-button"
            onClick={handleRestartClick}
            style={{
              transition: 'all 0.5s ease',
              ...animations.button
            }}
          >
            Reintentar
          </button>
          
          {onReturnToMenu && (
            <button 
              className="game-button secondary-button"
              onClick={handleReturnToMenuClick}
              style={{
                transition: 'all 0.5s ease',
                ...animations.button
              }}
            >
              Menú
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default GameOverModal; 