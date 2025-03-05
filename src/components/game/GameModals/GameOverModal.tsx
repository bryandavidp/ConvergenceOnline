import React, { useEffect, useState, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../../store';
import { resetGame, setGameStatus } from '../../../store/slices/gameSlice';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSkull, faRedo, faHome, faTrophy, faGamepad, faMedal, faChartLine } from '@fortawesome/free-solid-svg-icons';
import { playSound } from '../../../utils/audio';
import './GameModals.css';

interface GameOverModalProps {
  isVisible?: boolean;
  onRestart?: () => void;
}

const GameOverModal: React.FC<GameOverModalProps> = ({ isVisible = false, onRestart }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { score, highScore, level, currentPlayMode } = useSelector((state: RootState) => state.game);
  const [showEffects, setShowEffects] = useState(false);
  const [animationStage, setAnimationStage] = useState(0);
  const [scoreAnimationStage, setScoreAnimationStage] = useState(0);
  const [currentScore, setCurrentScore] = useState(0);
  const [isHighlighted, setIsHighlighted] = useState(false);
  const effectsContainerRef = useRef<HTMLDivElement>(null);
  const isNewHighScore = score > highScore;

  // Efecto para mostrar el modal y reproducir sonidos
  useEffect(() => {
    if (isVisible) {
      // Reproducir sonido de game over
      playSound('gameOver');
      
      // Iniciar secuencia de animación
      setShowEffects(true);
      
      // Secuencia de animaciones
      setTimeout(() => {
        setAnimationStage(1); // Mostrar título
      }, 300);
      
      setTimeout(() => {
        setAnimationStage(2); // Mostrar estadísticas
      }, 800);
      
      setTimeout(() => {
        setAnimationStage(3); // Mostrar puntuación
        
        // Iniciar animación de contador de puntuación
        const duration = 2000; // 2 segundos
        const interval = 30; // 30ms entre actualizaciones
        const steps = duration / interval;
        const increment = Math.max(1, Math.floor(score / steps));
        
        let current = 0;
        const timer = setInterval(() => {
          current += increment;
          if (current >= score) {
            current = score;
            clearInterval(timer);
            
            // Destacar la puntuación si es un nuevo récord
            if (isNewHighScore) {
              setTimeout(() => {
                setIsHighlighted(true);
                playSound('highScore');
              }, 300);
            }
            
            // Mostrar botones después de completar la animación
            setTimeout(() => {
              setAnimationStage(4);
            }, 800);
          }
          setCurrentScore(current);
        }, interval);
      }, 1500);
      
      // Crear efectos visuales
      if (effectsContainerRef.current) {
        createEffects();
      }
    } else {
      // Resetear estados cuando el modal no es visible
      setShowEffects(false);
      setAnimationStage(0);
      setScoreAnimationStage(0);
      setCurrentScore(0);
      setIsHighlighted(false);
    }
  }, [isVisible, score, highScore, isNewHighScore]);

  // Función para crear efectos visuales (partículas y estrellas)
  const createEffects = () => {
    if (!effectsContainerRef.current) return;
    
    const container = effectsContainerRef.current;
    const containerWidth = window.innerWidth;
    const containerHeight = window.innerHeight;
    const isMobile = window.innerWidth <= 768;
    
    // Colores para las partículas (tonos rojos y naranjas para game over)
    const colors = ['#ff5959', '#ff7070', '#ff8c8c', '#ffaa70', '#ff6347'];
    
    // Crear pulso de fondo
    const pulse = document.createElement('div');
    pulse.className = 'game-over-pulse';
    container.appendChild(pulse);
    
    // Número de partículas basado en el tamaño de la pantalla
    const particleCount = isMobile ? 30 : 50;
    
    // Crear partículas
    for (let i = 0; i < particleCount; i++) {
      setTimeout(() => {
        // Crear partícula
        const particle = document.createElement('div');
        particle.className = 'game-over-particle';
        
        // Posición aleatoria
        const posX = Math.random() * containerWidth;
        particle.style.left = `${posX}px`;
        
        // Tamaño aleatorio
        const size = Math.random() * (isMobile ? 6 : 10) + 2;
        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;
        
        // Color aleatorio
        const color = colors[Math.floor(Math.random() * colors.length)];
        particle.style.backgroundColor = color;
        
        // Velocidad aleatoria
        const duration = Math.random() * 3 + 2;
        particle.style.animationDuration = `${duration}s`;
        
        // Añadir al contenedor
        container.appendChild(particle);
        
        // Eliminar después de la animación
        setTimeout(() => {
          if (container.contains(particle)) {
            container.removeChild(particle);
          }
        }, duration * 1000);
      }, Math.random() * 2000); // Retraso aleatorio para la creación
    }
    
    // Crear estrellas (menos que partículas)
    const starCount = isMobile ? 10 : 20;
    for (let i = 0; i < starCount; i++) {
      setTimeout(() => {
        // Crear estrella
        const star = document.createElement('div');
        star.className = 'game-over-particle star-particle';
        star.innerHTML = '★';
        star.style.color = '#ffde59';
        
        // Posición aleatoria
        const posX = Math.random() * containerWidth;
        star.style.left = `${posX}px`;
        
        // Tamaño aleatorio
        const size = Math.random() * (isMobile ? 16 : 24) + 10;
        star.style.fontSize = `${size}px`;
        
        // Velocidad aleatoria
        const duration = Math.random() * 4 + 3;
        star.style.animationDuration = `${duration}s`;
        
        // Añadir al contenedor
        container.appendChild(star);
        
        // Eliminar después de la animación
        setTimeout(() => {
          if (container.contains(star)) {
            container.removeChild(star);
          }
        }, duration * 1000);
      }, Math.random() * 3000); // Retraso aleatorio para la creación
    }
  };

  // Función para reiniciar el juego
  const handleRestart = () => {
    playSound('buttonClick');
    if (onRestart) {
      onRestart();
    } else {
      dispatch(resetGame());
    }
  };

  // Función para volver al menú principal
  const handleGoHome = () => {
    playSound('buttonClick');
    dispatch(resetGame());
    navigate('/');
  };

  // Renderizar estadísticas del juego
  const renderGameStats = () => {
    return (
      <div className={`game-stats ${animationStage >= 2 ? 'animated' : ''}`}>
        <div className="stats-header">
          <h3>Estadísticas del Juego</h3>
          <FontAwesomeIcon icon={faChartLine} className="stats-icon" />
        </div>
        <div className="stats-container">
          <div className="stat-item">
            <FontAwesomeIcon icon={faMedal} className="stat-icon level-icon" />
            <div className="stat-details">
              <span className="stat-label">Nivel Alcanzado</span>
              <span className="stat-value">{level}</span>
            </div>
          </div>
          <div className="stat-item">
            <FontAwesomeIcon icon={faGamepad} className="stat-icon mode-icon" />
            <div className="stat-details">
              <span className="stat-label">Modo de Juego</span>
              <span className="stat-value">
                {currentPlayMode === 'classic' ? 'Clásico' : 
                 currentPlayMode === 'timed' ? 'Contrarreloj' : 
                 currentPlayMode === 'survival' ? 'Supervivencia' : 'Zen'}
              </span>
            </div>
          </div>
          <div className="stat-item">
            <FontAwesomeIcon icon={faTrophy} className="stat-icon highscore-icon" />
            <div className="stat-details">
              <span className="stat-label">Mejor Puntuación</span>
              <span className={`stat-value ${isNewHighScore ? 'new-record' : ''}`}>
                {isNewHighScore ? score : highScore}
                {isNewHighScore && <span className="new-record-badge">¡NUEVO!</span>}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Renderizar sección de puntuación final
  const renderFinalScore = () => {
    return (
      <div className={`final-score-section ${animationStage >= 3 ? 'animated' : ''}`}>
        <div className="score-header">
          <h3>Puntuación Final</h3>
        </div>
        <div className="score-display">
          <div className="score-value-container">
            <div className={`score-value ${isHighlighted ? 'highlight' : ''}`}>
              {currentScore}
            </div>
            <div className="score-effects"></div>
          </div>
          {isHighlighted && (
            <div className="new-highscore-badge">
              <FontAwesomeIcon icon={faTrophy} className="trophy-icon" />
              <span className="highscore-text">¡NUEVO RÉCORD!</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (!isVisible) return null;

  return (
    <div className={`game-modal ${isVisible ? 'visible' : 'hidden'}`}>
      <div className="game-over-content">
        {/* Contenedor de efectos visuales */}
        <div ref={effectsContainerRef} className="effects-container"></div>
        
        {/* Título del Game Over */}
        <div className={`game-over-title ${animationStage >= 1 ? 'animated' : ''}`}>
          <FontAwesomeIcon icon={faSkull} className="game-over-icon" />
          <span>GAME OVER</span>
        </div>
        
        {/* Estadísticas del juego */}
        {renderGameStats()}
        
        {/* Puntuación final */}
        {renderFinalScore()}
        
        {/* Botones de acción */}
        <div className={`game-over-buttons ${animationStage >= 4 ? 'animated' : ''}`}>
          <button className="game-over-button restart-button" onClick={handleRestart}>
            <FontAwesomeIcon icon={faRedo} className="button-icon" />
            Reintentar
          </button>
          <button className="game-over-button home-button" onClick={handleGoHome}>
            <FontAwesomeIcon icon={faHome} className="button-icon" />
            Menú Principal
          </button>
        </div>
      </div>
    </div>
  );
};

export default GameOverModal; 