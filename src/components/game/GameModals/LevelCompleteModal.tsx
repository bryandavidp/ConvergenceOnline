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
  onReturnToMenu?: () => void;
  stars?: number;
  rewards?: {type: string, amount: number, rarity?: string}[] | string[];
}

const LevelCompleteModal: React.FC<LevelCompleteModalProps> = ({ 
  isVisible = false, 
  onContinue,
  onReturnToMenu,
  stars = 3,
  rewards = [
    {type: 'monedas', amount: 150, rarity: 'common'}, 
    {type: 'gemas', amount: 5, rarity: 'rare'}, 
    {type: 'vidas', amount: 1, rarity: 'epic'}
  ]
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
    spawnRate,
    iconCount
  } = useSelector((state: RootState) => state.game);
  const { playSound } = useGameSound();
  const modalContentRef = useRef<HTMLDivElement>(null);
  const confettiContainerRef = useRef<HTMLDivElement>(null);
  
  // Estados para controlar animaciones y visibilidad
  const [modalVisible, setModalVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [showRewards, setShowRewards] = useState(false);

  // Ajustar altura de la ventana para dispositivos móviles
  const setViewportHeight = () => {
    // Cálculo más preciso de la altura real disponible
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
  };

  // Crear partículas flotantes doradas y ajustar altura
  useEffect(() => {
    // Configuración inicial
    setViewportHeight();
    
    // Recalcular en cambios de orientación o redimensionamiento
    window.addEventListener('resize', setViewportHeight);
    window.addEventListener('orientationchange', setViewportHeight);
    
    // Recalcular después de cargar completamente (para barras de navegación móviles)
    window.addEventListener('load', setViewportHeight);
    
    // Limpiar event listeners
    return () => {
      window.removeEventListener('resize', setViewportHeight);
      window.removeEventListener('orientationchange', setViewportHeight);
      window.removeEventListener('load', setViewportHeight);
    };
  }, []);

  // Efectos para manejar la visibilidad del modal
  useEffect(() => {
    if (isVisible) {
      setModalVisible(true);
      setIsClosing(false);
      // playSound('levelComplete');
      createConfetti();
      
      // Mostrar recompensas con un pequeño retraso para crear efecto
      const rewardsTimer = setTimeout(() => {
        setShowRewards(true);
      }, 600);
      
      return () => clearTimeout(rewardsTimer);
    } else {
      setIsClosing(true);
      setShowRewards(false);
      const timer = setTimeout(() => {
        setModalVisible(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isVisible, playSound]);

  // Crear efecto de confeti
  const createConfetti = () => {
    if (!confettiContainerRef.current) return;
    
    const container = confettiContainerRef.current;
    container.innerHTML = '';
    
    const colors = ['#FFD700', '#FF5722', '#3F51B5', '#4CAF50', '#9C27B0'];
    
    for (let i = 0; i < 50; i++) {
      const confetti = document.createElement('div');
      confetti.className = 'confetti';
      
      // Posición aleatoria horizontal
      const leftPos = Math.random() * 100;
      confetti.style.left = `${leftPos}%`;
      
      // Agregar delay para que no aparezcan todos a la vez
      const delay = Math.random() * 3;
      confetti.style.animationDelay = `${delay}s`;
      
      // Color aleatorio
      const randomColor = colors[Math.floor(Math.random() * colors.length)];
      confetti.style.backgroundColor = randomColor;
      
      // Forma aleatoria
      const shapes = ['square', 'circle', 'triangle'];
      const shape = shapes[Math.floor(Math.random() * shapes.length)];
      
      if (shape === 'circle') {
        confetti.style.borderRadius = '50%';
      } else if (shape === 'triangle') {
        confetti.style.width = '0';
        confetti.style.height = '0';
        confetti.style.backgroundColor = 'transparent';
        confetti.style.borderLeft = '5px solid transparent';
        confetti.style.borderRight = '5px solid transparent';
        confetti.style.borderBottom = `10px solid ${randomColor}`;
      }
      
      // Tamaño aleatorio
      const size = Math.random() * 8 + 5;
      confetti.style.width = `${size}px`;
      confetti.style.height = `${size}px`;
      
      container.appendChild(confetti);
    }
  };

  // Manejo de continuar al siguiente nivel
  const handleContinue = () => {
    setIsClosing(true);
    // playSound('buttonClick');
    
    setTimeout(() => {
      if (onContinue) {
        onContinue();
      }
    }, 300);
  };

  // Manejo de volver al menú principal
  const handleReturnToMenuClick = () => {
    setIsClosing(true);
    // playSound('buttonClick');
    
    setTimeout(() => {
      if (onReturnToMenu) {
        onReturnToMenu();
      }
    }, 300);
  };

  // Función para obtener el icono según el tipo de victoria
  const getVictoryIcon = () => {
    if (gameEndReason?.includes('limpiado completamente el tablero')) {
      return '✨🏆✨';
    } else if (gameEndReason?.match(/Solo quedan (\d+) iconos/)) {
      return '🎯';
    } else if (gameEndReason?.match(/tiene (\d+) iconos/)) {
      return '📊';
    } else if (gameEndReason?.includes('ocupación')) {
      return '📉';
    } else {
      return '🎉';
    }
  };

  // Función para obtener el título según el tipo de victoria
  const getVictoryTitle = () => {
    if (gameEndReason?.includes('limpiado completamente el tablero')) {
      return '¡Tablero Vacío!';
    } else if (gameEndReason?.match(/Solo quedan (\d+) iconos/)) {
      const iconCount = gameEndReason.match(/Solo quedan (\d+) iconos/)?.[1] || '0';
      return `Casi Perfecto - ${iconCount} iconos restantes`;
    } else if (gameEndReason?.match(/tiene (\d+) iconos/)) {
      const iconCount = gameEndReason.match(/tiene (\d+) iconos/)?.[1] || '0';
      return `Nivel Completado - ${iconCount} iconos restantes`;
    } else if (gameEndReason?.includes('ocupación')) {
      const percentage = gameEndReason.match(/(\d+\.\d+)% de ocupación/)?.[1] || '0';
      return `Tablero Despejado - ${percentage}% ocupación`;
    } else {
      return '¡Nivel Completado!';
    }
  };

  // Clase de combo según nivel
  const getComboClass = () => {
    if (comboCount >= 30) return 'combo-legendary-text';
    if (comboCount >= 20) return 'combo-epic-text';
    if (comboCount >= 10) return 'combo-rare-text';
    if (comboCount >= 5) return 'combo-uncommon-text';
    return 'combo-basic-text';
  };

  // Traducir nombres de modos de juego
  const getPlayModeName = (mode: string): string => {
    switch (mode) {
      case 'classic': return 'Clásico';
      case 'timed': return 'Contrarreloj';
      case 'survival': return 'Supervivencia';
      case 'zen': return 'Zen';
      case 'tutorial': return 'Tutorial';
      default: return mode;
    }
  };

  // Traducir nombres de dificultad
  const getDifficultyName = (difficulty: string): string => {
    switch (difficulty) {
      case 'easy': return 'Fácil';
      case 'normal': return 'Normal';
      case 'hard': return 'Difícil';
      case 'very_easy': return 'Muy Fácil';
      case 'very_hard': return 'Muy Difícil';
      default: return difficulty;
    }
  };

  // Formatear velocidad de spawn
  const formatSpawnRate = (rate: number): string => {
    const seconds = rate / 1000;
    return `${seconds.toFixed(1)}s/icon`;
  };

  // Obtener el porcentaje de victoria si existe
  const getVictoryPercentage = (): string | null => {
    if (gameEndReason?.includes('ocupación')) {
      return gameEndReason.match(/(\d+\.\d+)% de ocupación/)?.[1] || null;
    }
    return null;
  };

  // Extraer la información de iconos restantes
  const getRemainingIcons = (): string | null => {
    if (gameEndReason?.match(/Solo quedan (\d+) iconos/)) {
      return gameEndReason.match(/Solo quedan (\d+) iconos/)?.[1] || null;
    } else if (gameEndReason?.match(/tiene (\d+) iconos/)) {
      return gameEndReason.match(/tiene (\d+) iconos/)?.[1] || null;
    }
    return null;
  };

  // Obtener icono para cada tipo de recompensa
  const getRewardIcon = (type: string): string => {
    const lowerType = type.toLowerCase();
    
    if (lowerType.includes('moned') || lowerType.includes('coin') || lowerType === 'oro' || lowerType === 'gold') {
      return '🪙';
    } else if (lowerType.includes('gema') || lowerType.includes('gem') || lowerType.includes('diam')) {
      return '💎';
    } else if (lowerType.includes('vida') || lowerType.includes('life') || lowerType.includes('heart')) {
      return '❤️';
    } else if (lowerType.includes('energ')) {
      return '⚡';
    } else if (lowerType.includes('poder') || lowerType.includes('power')) {
      return '✨';
    } else if (lowerType.includes('llave') || lowerType.includes('key')) {
      return '🔑';
    } else if (lowerType.includes('cofre') || lowerType.includes('chest') || lowerType.includes('tesoro')) {
      return '🎁';
    } else if (lowerType.includes('trofeo') || lowerType.includes('trophy')) {
      return '🏆';
    } else if (lowerType.includes('ticket') || lowerType.includes('entra')) {
      return '🎫';
    } else if (lowerType.includes('boost')) {
      return '🚀';
    } else if (lowerType.includes('scroll') || lowerType.includes('pergam')) {
      return '📜';
    } else if (lowerType.includes('potion') || lowerType.includes('poción')) {
      return '🧪';
    } else if (lowerType.includes('skin') || lowerType.includes('apar')) {
      return '👕';
    } else {
      return '🎮';
    }
  };
  
  // Normalizar las recompensas al formato estándar
  const normalizeRewards = () => {
    if (!rewards || rewards.length === 0) return [];
    
    // Si ya tienen el formato de objeto
    if (typeof rewards[0] !== 'string' && 'type' in rewards[0]) {
      return rewards as {type: string, amount: number, rarity?: string}[];
    }
    
    // Si son solo strings, convertir a formato de objeto
    return (rewards as string[]).map(type => ({
      type,
      amount: Math.floor(Math.random() * 5) + 1,
      rarity: ['common', 'uncommon', 'rare', 'epic', 'legendary'][Math.floor(Math.random() * 5)]
    }));
  };

  // Normalizar recompensas
  const normalizedRewards = normalizeRewards();

  if (!modalVisible) return null;

  return (
    <div className={`game-modal fullscreen-modal ${isVisible ? 'visible' : ''} ${isClosing ? 'closing' : ''}`}>
      <div className="level-complete-background"></div>
      <div className="confetti-container" ref={confettiContainerRef}></div>
      
      <div className="modal-content level-complete-content" ref={modalContentRef}>
        {/* Cabecera con título y estrellas */}
        <div className="level-header">
          <h1>¡Nivel Completado!</h1>
          
          <div className="stars-container">
            {[...Array(3)].map((_, index) => (
              <svg
                key={index}
                className={`level-star ${index < stars ? 'earned' : ''}`}
                style={{ '--delay': `${index * 0.1}s` } as React.CSSProperties}
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
              </svg>
            ))}
          </div>
        </div>
        
        {/* Nueva estructura de contenido más compacta */}
        <div className="results-container">
          {/* Tarjeta de victoria visual */}
          <div className="victory-banner">
            <div className="victory-icon">{getVictoryIcon()}</div>
            <div className="victory-content">
              <div className="victory-title">{getVictoryTitle()}</div>
              {getVictoryPercentage() && (
                <div className="victory-metric">
                  <div className="progress-bar">
                    <div 
                      className="progress-fill" 
                      style={{ width: `${100 - parseFloat(getVictoryPercentage() || '0')}%` }}
                    ></div>
                  </div>
                  <span>{getVictoryPercentage()}% ocupación</span>
                </div>
              )}
              {getRemainingIcons() && (
                <div className="victory-metric">
                  <span className="remaining-icons">{getRemainingIcons()}</span>
                  <span>iconos restantes</span>
                </div>
              )}
            </div>
          </div>
          
          {/* Stats en formato compacto */}
          <div className="stats-grid">
            <div className="stat-item">
              <div className="stat-icon mode-icon">🎮</div>
              <div className="stat-data">
                <div className="stat-label">Modo</div>
                <div className="stat-value">{getPlayModeName(currentPlayMode)}</div>
              </div>
            </div>
            
            <div className="stat-item">
              <div className="stat-icon level-icon">🏆</div>
              <div className="stat-data">
                <div className="stat-label">Nivel</div>
                <div className="stat-value level-value">{level}</div>
              </div>
            </div>
            
            <div className="stat-item">
              <div className="stat-icon difficulty-icon">🔥</div>
              <div className="stat-data">
                <div className="stat-label">Dificultad</div>
                <div className="stat-value">{getDifficultyName(currentDifficulty)}</div>
              </div>
            </div>
            
            <div className="stat-item">
              <div className="stat-icon speed-icon">⚡</div>
              <div className="stat-data">
                <div className="stat-label">Velocidad</div>
                <div className="stat-value">{formatSpawnRate(spawnRate)}</div>
              </div>
            </div>
            
            <div className="stat-item">
              <div className="stat-icon score-icon">🎯</div>
              <div className="stat-data">
                <div className="stat-label">Puntuación</div>
                <div className="stat-value score-value">{score}</div>
              </div>
            </div>
            
            <div className="stat-item">
              <div className="stat-icon combo-icon">🔄</div>
              <div className="stat-data">
                <div className="stat-label">Combo</div>
                <div className={`stat-value combo-value ${getComboClass()}`}>
                  {comboMultiplier.toFixed(1)}x
                </div>
              </div>
            </div>
          </div>
          
          {/* Nueva sección de recompensas */}
          {normalizedRewards.length > 0 && (
            <div className={`rewards-section ${showRewards ? 'visible' : ''}`}>
              <div className="rewards-header">
                <div className="rewards-title">Recompensas</div>
                <div className="rewards-shine"></div>
              </div>
              <div className="rewards-container">
                {normalizedRewards.map((reward, index) => (
                  <div 
                    key={`reward-${index}`} 
                    className={`reward-item ${reward.rarity || 'common'}`}
                    style={{ '--delay': `${index * 0.15 + 0.3}s` } as React.CSSProperties}
                  >
                    <div className="reward-icon">
                      {getRewardIcon(reward.type)}
                    </div>
                    <div className="reward-details">
                      <div className="reward-amount">+{reward.amount}</div>
                      <div className="reward-type">{reward.type}</div>
                    </div>
                    <div className="reward-glow"></div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        
        {/* Botones de acción */}
        <div className="action-buttons">
          <button className="continue-button" onClick={handleContinue}>
            Continuar
          </button>
          <button className="menu-button" onClick={handleReturnToMenuClick}>
            Menú Principal
          </button>
        </div>
      </div>
    </div>
  );
};

export default LevelCompleteModal;