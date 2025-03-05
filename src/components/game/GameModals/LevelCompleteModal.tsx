import React, { useEffect, useState, useRef } from 'react';
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
  const confettiContainerRef = useRef<HTMLDivElement>(null);
  
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
  
  useEffect(() => {
    if (isVisible) {
      audioManager.play('levelComplete');
      setShowConfetti(true);
      createConfetti();
    }
  }, [isVisible]);
  
  const handleContinue = () => {
    setIsClosing(true);
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
    
    // Crear piezas de confeti
    for (let i = 0; i < 100; i++) {
      const confetti = document.createElement('div');
      confetti.className = 'confetti';
      confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      confetti.style.left = `${Math.random() * 100}%`;
      confetti.style.animationDelay = `${Math.random() * 3}s`;
      confetti.style.animationDuration = `${Math.random() * 2 + 2}s`;
      container.appendChild(confetti);
    }
  };
  
  // Renderizar información del siguiente nivel
  const renderNextLevelInfo = () => {
    return (
      <div className="next-level-info">
        <h3>Nivel {nextLevelInfo.level}</h3>
        
        <div className="level-details">
          <div className="detail-item">
            <span className="detail-label">Tablero:</span>
            <span className="detail-value">{nextLevelInfo.boardSize}x{nextLevelInfo.boardSize}</span>
          </div>
          
          <div className="detail-item">
            <span className="detail-label">Objetivos:</span>
            <span className="detail-value">
              {nextLevelInfo.objectives.map((obj, index) => (
                <div key={index}>{obj}</div>
              ))}
            </span>
          </div>
          
          {nextLevelInfo.specialFeatures.length > 0 && (
            <div className="detail-item">
              <span className="detail-label">Características:</span>
              <span className="detail-value">
                {nextLevelInfo.specialFeatures.map((feature, index) => (
                  <div key={index} className="bonus-badge">{feature}</div>
                ))}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };
  
  return (
    <div className={`game-modal level-complete ${isVisible ? 'visible' : 'hidden'} ${isClosing ? 'closing' : ''}`}>
      <div className="modal-content">
        <h2>¡Nivel Completado!</h2>
        
        {rewards.points > 0 && (
          <div className="bonus-badge">
            +{rewards.points} puntos de bonificación
          </div>
        )}
        
        {rewards.hints > 0 && (
          <div className="bonus-badge">
            +{rewards.hints} pista{rewards.hints !== 1 ? 's' : ''} adicional{rewards.hints !== 1 ? 'es' : ''}
          </div>
        )}
        
        {renderNextLevelInfo()}
        
        <div className="modal-buttons">
          <button className="modal-button primary" onClick={handleContinue}>
            Continuar
          </button>
        </div>
      </div>
      
      {showConfetti && (
        <div className="confetti-container" ref={confettiContainerRef}></div>
      )}
    </div>
  );
};

export default LevelCompleteModal; 