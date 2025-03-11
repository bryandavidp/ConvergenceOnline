import React, { useState, useEffect, useRef } from 'react';
import { useGameContext } from '../../../contexts/GameContext';
import { useGameSound } from '../../../hooks/useGameSound';
import { ICONS } from '../../../constants/icons';
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
          }, 200));
        }, 200));
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
      
      console.log('GameOverModal desmontado y recursos liberados');
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
    if (comboMultiplier >= 3.0) return '#FF00FF'; // Magenta para épico
    if (comboMultiplier >= 2.0) return '#9932CC'; // Púrpura para raro
    if (comboMultiplier >= 1.5) return '#1E90FF'; // Azul para poco común
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
  
  // Si el modal no está visible, no renderizamos nada
  if (!modalVisible && !isVisible) {
    return null;
  }
  
  return (
    <div className={`game-modal fullscreen-modal ${modalVisible ? 'visible' : ''} ${isClosing ? 'closing' : ''}`}>
      <div className="modal-content game-over-content" ref={modalContentRef}>
        <div 
          className="game-over-header"
          style={{
            transition: 'all 0.6s ease',
            ...animations.title
          }}
        >
          <h1>¡Juego Terminado!</h1>
          <h2>{isNewHighScore ? '¡Nuevo récord!' : 'No te preocupes, ¡inténtalo de nuevo!'}</h2>
          
          {/* Mostrar el motivo del fin del juego */}
          {gameEndReason && (
            <div className="game-end-reason">
              <p>{gameEndReason}</p>
            </div>
          )}
          
          {/* Nueva sección para mostrar el modo, dificultad y velocidad */}
          <div className="game-session-info">
            <div className="info-pill">
              <span className="info-label">🎮 Modo:</span>
              <span className="info-value">{getPlayModeName(currentPlayMode)}</span>
            </div>
            <div className="info-pill">
              <span className="info-label">🏆 Nivel:</span>
              <span className="info-value">{level}</span>
            </div>
            <div className="info-pill">
              <span className="info-label">🔥 Dificultad:</span>
              <span className="info-value">{getDifficultyName(currentDifficulty)}</span>
            </div>
            <div className="info-pill">
              <span className="info-label">⚡ Velocidad:</span>
              <span className="info-value">{formatSpawnRate(spawnRate)}/icon</span>
            </div>
          </div>
        </div>
        
        <div 
          className="game-over-body"
          style={{
            transition: 'all 0.5s ease',
            transitionDelay: '0.2s',
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
                <div className="compact-stat-icon">🏆</div>
                <div className="compact-stat-value">{level}</div>
                <div className="compact-stat-label">Nivel</div>
              </div>
              
              <div className="compact-stat-item">
                <div className="compact-stat-icon">🔥</div>
                <div className={`compact-stat-value ${getComboClass()}`} style={{ color: getComboColor() }}>
                  {comboCount}
                </div>
                <div className="compact-stat-label">
                  Combo ({comboMultiplier.toFixed(1)}x)
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
              ? '¡Increíble! Has superado tu mejor puntuación. ¿Puedes ir aún más lejos?' 
              : '¡Has hecho un gran esfuerzo! Practica y mejora tu estrategia para obtener una puntuación más alta.'}
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
              Menú Principal
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default GameOverModal; 