import React, { useEffect, useState, useRef, useLayoutEffect } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../../store';
import { audioManager } from '../../../utils/audioManager';
import * as levelAdapter from '../../../utils/levelAdapter';
import './GameModals.css';

interface LevelCompleteModalProps {
  isVisible?: boolean;
  onContinue?: () => void;
}

/**
 * Modal que se muestra cuando se completa un nivel
 */
const LevelCompleteModal: React.FC<LevelCompleteModalProps> = ({ isVisible = true, onContinue }) => {
  const { level, score, currentPlayMode, currentDifficulty } = useSelector((state: RootState) => state.game);
  const [isClosing, setIsClosing] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [animationStage, setAnimationStage] = useState(0);
  const [pointsAnimationStage, setPointsAnimationStage] = useState(0);
  const [currentPoints, setCurrentPoints] = useState(0);
  const [isHighlighted, setIsHighlighted] = useState(false);
  const confettiContainerRef = useRef<HTMLDivElement>(null);
  const modalContentRef = useRef<HTMLDivElement>(null);
  const featureContainerRef = useRef<HTMLDivElement>(null);
  const [contentOverflow, setContentOverflow] = useState(false);
  
  // Obtener información del siguiente nivel
  const nextLevelInfo = levelAdapter.getNextLevelDisplay(
    level,
    currentPlayMode,
    currentDifficulty
  );
  
  // Obtener recompensas del nivel actual
  const rewards = levelAdapter.getLevelRewards(
    level,
    currentPlayMode,
    currentDifficulty
  );
  
  // Verificar si hay demasiado contenido para la pantalla
  useLayoutEffect(() => {
    if (isVisible && modalContentRef.current) {
      // Evaluar si hay overflow y necesitamos optimizar más
      const checkOverflow = () => {
        if (modalContentRef.current) {
          const hasOverflow = modalContentRef.current.scrollHeight > modalContentRef.current.clientHeight;
          setContentOverflow(hasOverflow);
        }
      };
      
      // Comprobar inicialmente y después de cada animación
      checkOverflow();
      setTimeout(checkOverflow, 1500); // Comprobar después de las animaciones
      
      // También comprobar si hay cambios de tamaño
      const resizeObserver = new ResizeObserver(checkOverflow);
      resizeObserver.observe(modalContentRef.current);
      
      return () => {
        if (modalContentRef.current) {
          resizeObserver.unobserve(modalContentRef.current);
        }
      };
    }
  }, [isVisible]);
  
  // Inicia la animación de puntos
  useEffect(() => {
    if (isVisible && animationStage >= 1) {
      // Iniciar con la puntuación actual del juego
      setCurrentPoints(score - rewards.points);
      
      // Secuencia de animación de puntos
      const timer1 = setTimeout(() => setPointsAnimationStage(1), 500); // Mostrar bonificación
      const timer2 = setTimeout(() => setPointsAnimationStage(2), 1200); // Iniciar fusión
      const timer3 = setTimeout(() => {
        // Iniciar conteo
        let startValue = score - rewards.points;
        const endValue = score;
        const duration = 1500; // ms
        const frameRate = 24;
        const totalFrames = Math.round(duration / (1000 / frameRate));
        const increment = (endValue - startValue) / totalFrames;
        let currentFrame = 0;
        
        const counterInterval = setInterval(() => {
          currentFrame++;
          const newValue = Math.round(startValue + (increment * currentFrame));
          setCurrentPoints(newValue);
          
          // Reproducir sonido de incremento y activar highlight
          if (currentFrame % 4 === 0) {
            audioManager.play('coinCollect');
            setIsHighlighted(true);
            setTimeout(() => setIsHighlighted(false), 150);
          }
          
          if (currentFrame >= totalFrames) {
            clearInterval(counterInterval);
            setPointsAnimationStage(3); // Animación completa
            
            // Sonido de finalización
            audioManager.play('powerUp');
            
            // Destacar una última vez con más intensidad
            setTimeout(() => {
              setIsHighlighted(true);
              setTimeout(() => setIsHighlighted(false), 300);
            }, 200);
          }
        }, 1000 / frameRate);
        
      }, 1700); // Comenzar conteo
      
      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
        clearTimeout(timer3);
      };
    }
  }, [isVisible, animationStage, rewards.points, score]);
  
  useEffect(() => {
    if (isVisible) {
      // Reproducir sonido
      audioManager.play('levelComplete');
      
      // Iniciar secuencia de animación
      setShowConfetti(true);
      createConfetti();
      
      // Secuencia de animación por etapas
      setAnimationStage(0);
      const timer1 = setTimeout(() => setAnimationStage(1), 450);
      const timer2 = setTimeout(() => setAnimationStage(2), 900);
      const timer3 = setTimeout(() => setAnimationStage(3), 1350);
      
      // Reiniciar animación de puntos
      setPointsAnimationStage(0);
      setIsHighlighted(false);
      
      // Asegurar que el scroll esté en la parte superior
      if (modalContentRef.current) {
        modalContentRef.current.scrollTop = 0;
      }
      
      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
        clearTimeout(timer3);
      };
    }
  }, [isVisible]);
  
  const handleContinue = () => {
    setIsClosing(true);
    audioManager.play('buttonClick');
    setTimeout(() => {
      setIsClosing(false);
      if (onContinue) onContinue();
    }, 300);
  };
  
  // Crear efecto de confeti
  const createConfetti = () => {
    if (!confettiContainerRef.current) return;
    
    const container = confettiContainerRef.current;
    const colors = ['#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4', '#009688', '#4CAF50', '#8BC34A', '#CDDC39', '#FFEB3B', '#FFC107', '#FF9800', '#FF5722'];
    
    // Limpiar confeti existente
    container.innerHTML = '';
    
    // Crear piezas de confeti (cantidad ajustable según el dispositivo)
    const isMobile = window.innerWidth <= 480;
    const isSmallHeight = window.innerHeight <= 667;
    const confettiCount = isMobile ? (isSmallHeight ? 50 : 70) : 100;
    
    for (let i = 0; i < confettiCount; i++) {
      const confetti = document.createElement('div');
      confetti.className = 'confetti';
      confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      confetti.style.left = `${Math.random() * 100}%`;
      confetti.style.animationDelay = `${Math.random() * 1.5}s`;
      confetti.style.animationDuration = `${Math.random() * 2 + 1.5}s`;
      const size = isSmallHeight ? 3 : 5;
      confetti.style.width = `${Math.random() * size + 2}px`;
      confetti.style.height = `${Math.random() * (size * 2) + 2}px`;
      container.appendChild(confetti);
    }
  };
  
  // Renderizar las bonificaciones/recompensas
  const renderRewards = () => {
    if (!rewards.points && !rewards.hints) return null;
    
    return (
      <div className={`rewards-section ${animationStage >= 1 ? 'animated' : ''}`}>
        <h3>¡Bonificaciones!</h3>
        <div className="rewards-container">
          {rewards.points > 0 && (
            <div className="reward-item points-reward" key="points">
              <div className="reward-icon points-icon">🏆</div>
              <div className="reward-details">
                <div className="points-animation-container">
                  <span className={`current-points ${isHighlighted ? 'highlight' : ''}`}>{currentPoints.toLocaleString()}</span>
                  
                  {/* Bonificación con animación */}
                  {pointsAnimationStage >= 1 && pointsAnimationStage < 3 && (
                    <div className={`bonus-points ${pointsAnimationStage >= 2 ? 'merging' : ''}`}>
                      <span className="bonus-sign">+</span>
                      <span className="bonus-value">{rewards.points.toLocaleString()}</span>
                    </div>
                  )}
                  
                  {/* Destellos durante animación final */}
                  {pointsAnimationStage === 3 && (
                    <div className="points-celebration-effects">
                      <div className="celebration-spark spark1"></div>
                      <div className="celebration-spark spark2"></div>
                      <div className="celebration-spark spark3"></div>
                      <div className="celebration-glow"></div>
                    </div>
                  )}
                </div>
                <span className="reward-label">puntos</span>
              </div>
            </div>
          )}
          
          {rewards.hints > 0 && (
            <div className="reward-item" key="hints">
              <div className="reward-icon hint-icon">💡</div>
              <div className="reward-details">
                <span className="reward-value">+{rewards.hints}</span>
                <span className="reward-label">pista{rewards.hints !== 1 ? 's' : ''}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };
  
  // Renderizar información del siguiente nivel
  const renderNextLevelInfo = () => {
    return (
      <div className={`next-level-info ${animationStage >= 2 ? 'animated' : ''}`}>
        <div className="level-header">
          <h3>Siguiente Nivel</h3>
          <span className="level-number">{nextLevelInfo.level}</span>
        </div>
        
        <div className="level-details">
          <div className="detail-item">
            <span className="detail-label">Tablero:</span>
            <span className="detail-value">{nextLevelInfo.boardSize}×{nextLevelInfo.boardSize}</span>
          </div>
          
          <div className="objectives-container">
            <span className="detail-label">Objetivos:</span>
            <div className="objectives-list">
              {nextLevelInfo.objectives.map((obj, index) => (
                <div key={`objective-${index}`} className="objective-item">
                  <span className="objective-icon">🎯</span>
                  <span className="objective-text">{obj}</span>
                </div>
              ))}
            </div>
          </div>
          
          {nextLevelInfo.specialFeatures.length > 0 && (
            <div className="features-container" ref={featureContainerRef}>
              <span className="detail-label">Características:</span>
              <div className={`features-list ${contentOverflow ? 'compact' : ''}`}>
                {nextLevelInfo.specialFeatures.map((feature, index) => (
                  <div key={`feature-${index}`} className="feature-badge">
                    {getFeatureIcon(feature)} {feature}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };
  
  // Función para obtener iconos para características especiales
  const getFeatureIcon = (feature: string): string => {
    const featureLower = feature.toLowerCase();
    if (featureLower.includes('especial')) return '✨';
    if (featureLower.includes('bonus')) return '🎁';
    if (featureLower.includes('power')) return '⚡';
    return '🔥';
  };
  
  return (
    <div className={`game-modal level-complete ${isVisible ? 'visible' : 'hidden'} ${isClosing ? 'closing' : ''}`}>
      <div className="level-complete-content">
        <div className={`modal-content-inner ${contentOverflow ? 'content-overflow' : ''}`} ref={modalContentRef}>
          <h2 className={`level-complete-title ${animationStage >= 0 ? 'animated' : ''}`}>
            <span className="level-crown">👑</span>
            ¡Nivel Completado!
          </h2>
          
          {renderRewards()}
          {renderNextLevelInfo()}
        </div>
        
        <div className={`continue-button-container ${animationStage >= 3 ? 'animated' : ''}`}>
          <button className="pulse-button" onClick={handleContinue}>
            <span className="button-icon">▶️</span>
            Continuar
          </button>
        </div>
        
        {showConfetti && (
          <div className="confetti-container" ref={confettiContainerRef}></div>
        )}
      </div>
    </div>
  );
};

export default LevelCompleteModal;