import React, { useState, useEffect, useRef } from 'react';
import { useGameContext } from '../../../contexts/GameContext';
import { useGameSound } from '../../../hooks/useGameSound';
import { ICONS } from '../../../constants/icons';
import './GameModals.css';

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
  const { playSound } = useGameSound();
  const modalContentRef = useRef<HTMLDivElement>(null);
  const confettiContainerRef = useRef<HTMLDivElement>(null);
  
  // Estados para controlar animaciones y visibilidad
  const [animations, setAnimations] = useState(LEVEL_COMPLETE_ANIMATIONS);
  const [modalVisible, setModalVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  
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
    
    // Minimizamos el modal
    setIsClosing(true);
    
    // Quitamos la clase modal-active para permitir ver el tablero de juego
    const gamePageElement = document.querySelector('.game-page');
    if (gamePageElement) {
      gamePageElement.classList.remove('modal-active');
    }
    
    setTimeout(() => {
      if (onContinue) {
        onContinue();
      }
    }, 300);
  };
  
  // Renderiza las recompensas del nivel
  const renderRewards = () => {
    return rewards.map((reward, index) => (
      <div key={index} className="reward-item">
        <span className="reward-icon">{getFeatureIcon(reward)}</span>
        <span className="reward-name">{reward}</span>
      </div>
    ));
  };
  
  // Obtiene un ícono para cada tipo de recompensa
  const getFeatureIcon = (feature: string): string => {
    const icons: Record<string, string> = {
      'monedas': ICONS.COIN,
      'gemas': '💎',
      'vidas': ICONS.HEART,
      'energia': ICONS.ENERGY,
      'poderes': '🔮',
      'llave': ICONS.KEY,
    };
    
    return icons[feature.toLowerCase()] || '🎁';
  };
  
  // Si el modal no está visible, no renderizamos nada
  if (!modalVisible && !isVisible) {
    return null;
  }
  
  return (
    <div className={`game-modal ${modalVisible ? 'visible' : ''} ${isClosing ? 'closing' : ''}`}>
      {showConfetti && (
        <div ref={confettiContainerRef} className="confetti-container">
          {createConfetti()}
        </div>
      )}
      
      <div className="modal-content level-complete-content" ref={modalContentRef}>
        <div 
          className="level-complete-header"
          style={{
            transition: 'all 0.6s ease',
            ...animations.title
          }}
        >
          <h1>¡Nivel Completado!</h1>
          <h2>¡Excelente trabajo!</h2>
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
              {ICONS.STAR}
            </div>
          ))}
        </div>
        
        <div className="modal-content-inner">
          <div 
            className="score-container"
            style={{
              transition: 'all 0.5s ease',
              transitionDelay: '0.4s',
              ...animations.content
            }}
          >
            <span className="coin-icon">{ICONS.COIN}</span>
            <span className="score-value">{gameState.score}</span>
          </div>
          
          <div 
            className="rewards-section"
            style={{
              transition: 'all 0.5s ease',
              transitionDelay: '0.4s',
              ...animations.content
            }}
          >
            <h3>Recompensas</h3>
            <div className="rewards-list">
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
            {ICONS.NEXT} Siguiente Nivel
          </button>
        </div>
      </div>
    </div>
  );
};

export default LevelCompleteModal;