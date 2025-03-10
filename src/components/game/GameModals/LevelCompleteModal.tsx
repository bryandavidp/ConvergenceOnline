import React, { useState, useEffect, useRef } from 'react';
import { useGameContext } from '../../../contexts/GameContext';
import { useGameSound } from '../../../hooks/useGameSound';
import { ICONS } from '../../../constants/icons';
import { useSelector } from 'react-redux';
import { RootState } from '../../../store';
import './LevelCompleteModal.css';

interface LevelCompleteModalProps {
  isVisible?: boolean;
  onContinue?: () => void;
  stars?: number;
  rewards?: string[];
}

// Configuración inicial para animación de la entrada del modal
const LEVEL_COMPLETE_ANIMATIONS = {
  title: { opacity: 0, transform: 'translateY(-20px)' },
  stars: { opacity: 0, transform: 'scale(0.8)' },
  content: { opacity: 0, transform: 'translateY(20px)' },
  buttons: { opacity: 0, transform: 'scale(0.8)' },
};

const LevelCompleteModal: React.FC<LevelCompleteModalProps> = ({ 
  isVisible = false, 
  onContinue,
  stars = 3,
  rewards = ['monedas', 'gemas', 'vidas']
}) => {
  const { gameState } = useGameContext();
  const { 
    score, 
    level, 
    comboCount, 
    comboMultiplier, 
    gameEndReason, 
    currentPlayMode, 
    currentDifficulty,
    spawnRate
  } = useSelector((state: RootState) => state.game);
  const { playSound } = useGameSound();
  const modalContentRef = useRef<HTMLDivElement>(null);
  const confettiContainerRef = useRef<HTMLDivElement>(null);
  
  // Estados para controlar animaciones y visibilidad
  const [animations, setAnimations] = useState(LEVEL_COMPLETE_ANIMATIONS);
  const [modalVisible, setModalVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  
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
    
    if (isVisible) {
      setModalVisible(true);
      setIsClosing(false);
      
      // Reproducir sonido de victoria
      playSound('levelUp');
      
      // Mostrar confeti
      setTimeout(() => {
        setShowConfetti(true);
      }, 300);
      
      // Animación secuencial para los elementos del modal
      setTimeout(() => {
        setAnimations(prev => ({
          ...prev,
          title: { opacity: 1, transform: 'translateY(0)' }
        }));
        
        setTimeout(() => {
          setAnimations(prev => ({
            ...prev,
            stars: { opacity: 1, transform: 'scale(1)' }
          }));
          
          setTimeout(() => {
            setAnimations(prev => ({
              ...prev,
              content: { opacity: 1, transform: 'translateY(0)' }
            }));
            
            setTimeout(() => {
              setAnimations(prev => ({
                ...prev,
                buttons: { opacity: 1, transform: 'scale(1)' }
              }));
            }, 200);
          }, 200);
        }, 200);
      }, 100);
    } else {
      setIsClosing(true);
      setShowConfetti(false);
      animationTimeout = setTimeout(() => {
        setModalVisible(false);
        setAnimations(LEVEL_COMPLETE_ANIMATIONS);
      }, 300);
    }
    
    return () => {
      if (animationTimeout) {
        clearTimeout(animationTimeout);
      }
    };
  }, [isVisible, playSound]);
  
  // Crea elementos de confeti
  const createConfetti = () => {
    if (!showConfetti) return null;
    
    const confettiCount = 50;
    const colors = ['#ff6b81', '#5ad95a', '#3ecbff', '#ffaa5a', '#9f6bff'];
    
    return Array.from({ length: confettiCount }).map((_, index) => {
      const delay = Math.random() * 3;
      const color = colors[Math.floor(Math.random() * colors.length)];
      const left = Math.random() * 100;
      const size = 5 + Math.random() * 10;
      const duration = 1 + Math.random() * 2;
      
      return (
        <div
          key={index}
          className="confetti"
          style={{
            backgroundColor: color,
            left: `${left}%`,
            width: `${size}px`,
            height: `${size}px`,
            animationDelay: `${delay}s`,
            animationDuration: `${duration}s`
          }}
        />
      );
    });
  };
  
  const handleContinue = () => {
    playSound('uiSelect');
    
    // Mostrar un mensaje de carga mientras se prepara el nivel
    setAnimations({
      ...animations,
      title: { opacity: 0, transform: 'translateY(-20px)' },
      content: { opacity: 0, transform: 'translateY(20px)' }
    });
    
    // Minimizamos el modal
    setIsClosing(true);
    
    // Esperar a que termine la animación antes de continuar
    setTimeout(() => {
      // Quitamos la clase modal-active para permitir ver el tablero de juego
      const gamePageElement = document.querySelector('.game-page');
      if (gamePageElement) {
        gamePageElement.classList.remove('modal-active');
      }
      
      // Llamar al callback de continuar DESPUÉS de quitar el modal
      setTimeout(() => {
        if (onContinue) {
          onContinue();
        }
      }, 200); // Pequeño retraso para asegurar que la transición visual sea suave
    }, 500);
  };
  
  // Renderiza las recompensas del nivel
  const renderRewards = () => {
    return rewards.map((reward, index) => (
      <div key={index} className="reward-badge">
        <span className="reward-icon">{getFeatureIcon(reward)}</span>
        <span className="reward-name">{reward}</span>
      </div>
    ));
  };
  
  // Obtiene un ícono para cada tipo de recompensa
  const getFeatureIcon = (feature: string): string => {
    const icons: Record<string, string> = {
      'monedas': '💰',
      'gemas': '💎',
      'vidas': '❤️',
      'energia': '⚡',
      'poderes': '🔮',
      'llave': '🔑',
    };
    
    return icons[feature.toLowerCase()] || '🎁';
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
      {showConfetti && (
        <div ref={confettiContainerRef} className="confetti-container">
          {createConfetti()}
        </div>
      )}
      
      <div className="modal-content level-complete-content" ref={modalContentRef}>
        <div className="level-header-stars-container">
          <div 
            className="level-complete-header"
            style={{
              transition: 'all 0.6s ease',
              ...animations.title
            }}
          >
            <h1>¡Nivel Completado!</h1>
            <h2>¡Excelente trabajo!</h2>
            
            {/* Mostrar el motivo de nivel completado */}
            {gameEndReason && (
              <div className="level-end-reason">
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
            className="stars-container"
            style={{
              transition: 'all 0.5s ease',
              transitionDelay: '0.2s',
              ...animations.stars
            }}
          >
            {Array.from({ length: 3 }).map((_, i) => (
              <div 
                key={i} 
                className={`level-star ${i < stars ? 'earned' : 'missed'}`}
              >
                ⭐
              </div>
            ))}
          </div>
        </div>
        
        <div 
          className="compact-body"
          style={{
            transition: 'all 0.5s ease',
            transitionDelay: '0.4s',
            ...animations.content
          }}
        >
          <div className="main-stats">
            <div className="score-highlight">
              <div className="score-icon">💰</div>
              <div className="score-details">
                <div className="score-label">Puntuación</div>
                <div className="score-value">{score}</div>
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
          
          <div className="rewards-container">
            <h3 className="rewards-title">Recompensas</h3>
            <div className="rewards-grid">
              {renderRewards()}
            </div>
          </div>
        </div>
        
        <div 
          className="modal-buttons"
          style={{
            transition: 'all 0.4s ease',
            transitionDelay: '0.6s',
            ...animations.buttons
          }}
        >
          <button 
            className="pulse-button next-level-button"
            onClick={handleContinue}
          >
            ▶️ Siguiente Nivel
          </button>
        </div>
      </div>
    </div>
  );
};

export default LevelCompleteModal;