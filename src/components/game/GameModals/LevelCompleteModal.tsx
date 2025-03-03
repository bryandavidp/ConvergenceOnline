import React, { useEffect, useCallback, useState } from 'react';
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
  const [isClosing, setIsClosing] = useState(false);
  
  useEffect(() => {
    if (isVisible) {
      setIsClosing(false);
      logger.info('LevelCompleteModal', 'Nivel completado mostrado', { level, timer, score });
      audioManager.play('levelComplete');
      createConfetti();
    }
  }, [isVisible, level, timer, score]);
  
  const handleNextLevel = useCallback(() => {
    setIsClosing(true);
    logger.info('LevelCompleteModal', 'Avanzando al siguiente nivel', { 
      nivelActual: level,
      siguienteNivel: level + 1,
      puntuación: score,
      tiempo: timer
    });
    
    setTimeout(() => {
      audioManager.play('levelTransition');
      
      // Solo incrementamos el nivel, manteniendo puntuación, tiempo y velocidad
      const nextLevel = level + 1;
      dispatch(setLevel(nextLevel));
      
      // Cambiar el estado después de un breve retraso para permitir la animación
      setTimeout(() => {
        dispatch(setGameStatus('playing'));
      }, 200);
    }, 300);
  }, [dispatch, level, score, timer]);
  
  const handleRestart = useCallback(() => {
    setIsClosing(true);
    logger.info('LevelCompleteModal', 'Reiniciando juego en el mismo nivel');
    
    setTimeout(() => {
      audioManager.play('start');
      
      // Cambiar el estado después de un breve retraso para permitir la animación
      setTimeout(() => {
        // Reiniciar el nivel actual, pero manteniendo la puntuación y el tiempo
        dispatch(setGameStatus('playing'));
      }, 200);
    }, 300);
  }, [dispatch]);
  
  // Función para crear efecto de confeti
  const createConfetti = () => {
    const container = document.getElementById('confetti-container');
    if (!container) {
      logger.error('LevelCompleteModal', 'No se encontró el contenedor de confeti');
      return;
    }
    
    // Limpiar el contenedor antes de añadir nuevo confeti
    container.innerHTML = '';
    
    // Colores vibrantes para el confeti
    const colors = ['#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4', '#009688', '#4CAF50', '#8BC34A', '#CDDC39', '#FFEB3B', '#FFC107', '#FF9800', '#FF5722'];
    
    // Crear 150 piezas de confeti
    for (let i = 0; i < 150; i++) {
      const confetti = document.createElement('div');
      confetti.className = 'confetti';
      
      // Posición aleatoria
      confetti.style.left = `${Math.random() * 100}%`;
      
      // Color aleatorio
      confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      
      // Retraso aleatorio para la animación
      confetti.style.animationDelay = `${Math.random() * 3}s`;
      
      // Duración aleatoria para la animación
      confetti.style.animationDuration = `${3 + Math.random() * 2}s`;
      
      // Tamaño aleatorio
      const size = 5 + Math.random() * 10;
      confetti.style.width = `${size}px`;
      confetti.style.height = `${size * 1.5}px`;
      
      // Añadir al contenedor
      container.appendChild(confetti);
    }
    
    logger.info('LevelCompleteModal', 'Efecto de confeti creado con éxito');
  };
  
  if (!isVisible) return null;
  
  return (
    <div className={`game-modal level-complete ${isClosing ? 'closing' : ''}`}>
      <div className="modal-content">
        <h2>¡Nivel Completado!</h2>
        <p>Has superado el nivel {level}</p>
        <p>Tiempo: <span className="highlight">{timer} segundos</span></p>
        <p>Puntuación: <span className="highlight">{score} puntos</span></p>
        
        <div className="modal-buttons">
          <button className="modal-button primary" onClick={handleNextLevel}>
            Siguiente Nivel
          </button>
          <button className="modal-button secondary" onClick={handleRestart}>
            Reintentar Nivel
          </button>
        </div>
        
        <div id="confetti-container" className="confetti-container"></div>
      </div>
    </div>
  );
};

export default LevelCompleteModal; 