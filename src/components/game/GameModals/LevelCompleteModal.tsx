import React, { useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../../store';
import { setGameStatus, setLevel } from '../../../store/slices/gameSlice';
import { audioManager } from '../../../utils/audioManager';
import logger from '../../../utils/logger';
import './GameModals.css';

interface LevelCompleteModalProps {
  isVisible: boolean;
}

const LevelCompleteModal: React.FC<LevelCompleteModalProps> = ({ isVisible }) => {
  const dispatch = useDispatch();
  const { level, timer, score } = useSelector((state: RootState) => state.game);
  
  useEffect(() => {
    if (isVisible) {
      logger.info('LevelCompleteModal', 'Nivel completado mostrado', { level, timer });
      createConfetti();
    }
  }, [isVisible, level, timer]);
  
  const handleNextLevel = useCallback(() => {
    logger.info('LevelCompleteModal', 'Avanzando al siguiente nivel');
    audioManager.play('levelTransition');
    
    const nextLevel = level + 1;
    dispatch(setLevel(nextLevel));
    
    // Cambiar el estado después de un breve retraso para permitir la animación
    setTimeout(() => {
      dispatch(setGameStatus('playing'));
    }, 500);
  }, [dispatch, level]);
  
  // Función para crear efecto de confeti
  const createConfetti = () => {
    const container = document.getElementById('confetti-container');
    if (!container) return;
    
    container.innerHTML = '';
    const colors = ['#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#03a9f4'];
    
    // Crear 150 piezas de confeti
    for (let i = 0; i < 150; i++) {
      const confetti = document.createElement('div');
      confetti.className = 'confetti';
      confetti.style.left = `${Math.random() * 100}%`;
      confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      confetti.style.animationDelay = `${Math.random() * 3}s`;
      container.appendChild(confetti);
    }
  };
  
  if (!isVisible) return null;
  
  return (
    <div className="game-modal level-complete">
      <div className="modal-content">
        <h2>¡Nivel Completado!</h2>
        <p>Has superado el nivel {level}</p>
        <p>Tiempo: <span className="highlight">{timer} segundos</span></p>
        <p>Puntuación: <span className="highlight">{score} puntos</span></p>
        
        <button className="modal-button" onClick={handleNextLevel}>
          Siguiente Nivel
        </button>
        
        <div id="confetti-container" className="confetti-container"></div>
      </div>
    </div>
  );
};

export default LevelCompleteModal; 