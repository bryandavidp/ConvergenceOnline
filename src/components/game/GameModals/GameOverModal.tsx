import React, { useState, useEffect, useRef } from 'react';
import { useGameContext } from '../../../contexts/GameContext';
import { useGameSound } from '../../../hooks/useGameSound';
import { ICONS } from '../../../constants/icons';
import './GameModals.css';

interface GameOverModalProps {
  isVisible?: boolean;
  onRestart?: () => void;
}

// Configuración inicial para animación de la entrada del modal
const GAME_OVER_ANIMATIONS = {
  title: { opacity: 0, transform: 'translateY(-20px)' },
  content: { opacity: 0, transform: 'translateY(20px)' },
  button: { opacity: 0, transform: 'scale(0.8)' },
};

const GameOverModal: React.FC<GameOverModalProps> = ({ isVisible = false, onRestart }) => {
  const { gameState } = useGameContext();
  const { playSound } = useGameSound();
  const modalContentRef = useRef<HTMLDivElement>(null);
  
  // Estados para controlar animaciones y visibilidad
  const [animations, setAnimations] = useState(GAME_OVER_ANIMATIONS);
  const [modalVisible, setModalVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  
  // Efecto para manejar la animación de entrada cuando el modal es visible
  useEffect(() => {
    let animationTimeout: NodeJS.Timeout;
    
    if (isVisible) {
      setModalVisible(true);
      setIsClosing(false);
      
      // Reproducir sonido de game over
      playSound('gameOver');
      
      // Animación secuencial para los elementos del modal
      setTimeout(() => {
        setAnimations(prev => ({
          ...prev,
          title: { opacity: 1, transform: 'translateY(0)' }
        }));
        
        setTimeout(() => {
          setAnimations(prev => ({
            ...prev,
            content: { opacity: 1, transform: 'translateY(0)' }
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
        setAnimations(GAME_OVER_ANIMATIONS);
      }, 300);
    }
    
    return () => {
      if (animationTimeout) {
        clearTimeout(animationTimeout);
      }
    };
  }, [isVisible, playSound]);
  
  const handleRestartClick = () => {
    playSound('uiSelect');
    
    // Minimizamos el modal
    setIsClosing(true);
    
    // Quitamos la clase modal-active para permitir ver el tablero de juego
    const gamePageElement = document.querySelector('.game-page');
    if (gamePageElement) {
      gamePageElement.classList.remove('modal-active');
    }
    
    setTimeout(() => {
      if (onRestart) {
        onRestart();
      }
    }, 300);
  };
  
  // Si el modal no está visible, no renderizamos nada
  if (!modalVisible && !isVisible) {
    return null;
  }
  
  return (
    <div className={`game-modal ${modalVisible ? 'visible' : ''} ${isClosing ? 'closing' : ''}`}>
      <div className="modal-content game-over-content" ref={modalContentRef}>
        <div 
          className="game-over-header"
          style={{
            transition: 'all 0.6s ease',
            ...animations.title
          }}
        >
          <h1>¡Juego Terminado!</h1>
          <h2>No te preocupes, ¡inténtalo de nuevo!</h2>
        </div>
        
        <div 
          className="game-over-body"
          style={{
            transition: 'all 0.5s ease',
            transitionDelay: '0.2s',
            ...animations.content
          }}
        >
          <div className="score-container">
            <div className="final-score">
              <span className="coin-icon">{ICONS.COIN}</span>
              <span className="score-value">{gameState.score}</span>
            </div>
            <div className="level-reached">
              <span className="level-text">Nivel alcanzado:</span>
              <span className="level-value">{gameState.level}</span>
            </div>
          </div>
          
          <div className="game-over-message">
            <p>¡Has hecho un gran esfuerzo! Practica y mejora tu estrategia para obtener una puntuación más alta.</p>
          </div>
        </div>
        
        <div className="modal-buttons">
          <button 
            className="pulse-button play-again-button"
            onClick={handleRestartClick}
            style={{
              transition: 'all 0.4s ease',
              transitionDelay: '0.4s',
              ...animations.button
            }}
          >
            {ICONS.RESTART} Jugar de nuevo
          </button>
        </div>
      </div>
    </div>
  );
};

export default GameOverModal; 