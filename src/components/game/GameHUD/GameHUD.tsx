import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../../store';
import { setGameStatus, resetCombo } from '../../../store/slices/gameSlice';
import ComboTimer from '../ComboTimer/ComboTimer';
import * as config from '../../../utils/config';
import './GameHUD.css';
import { speedController } from '../../../utils/speedController';

// Mapa de iconos para los niveles de dificultad (usando emojis espaciales)
const DIFFICULTY_EMOJIS = {
  'tutorial': '🚀',
  'easy': '🌟',
  'normal': '🌗',
  'hard': '🔥'
};

// Mapa de nombres para los modos de juego
const MODE_NAMES = {
  'classic': 'Clásico',
  'timed': 'Tiempo',
  'survival': 'Superv.',
  'zen': 'Zen',
  'tutorial': 'Tutorial'
};

// Mapa de nombres para las dificultades
const DIFFICULTY_NAMES = {
  'tutorial': 'Tutorial',
  'easy': 'Fácil',
  'normal': 'Normal',
  'hard': 'Difícil'
};

const GameHUD: React.FC = () => {
  const dispatch = useDispatch();
  const { 
    score, 
    level,
    timer,
    timeRemaining,
    survivalTime,
    currentDifficulty,
    currentPlayMode,
    status,
    spawnRate,
    highScore,
    levelScoreTarget,
    levelOccupationTarget,
    iconCount,
    boardSize
  } = useSelector((state: RootState) => state.game);
  
  // Estado para animaciones
  const [animateScore, setAnimateScore] = useState(false);
  const [animateLevel, setAnimateLevel] = useState(false);
  const prevScore = useRef(score);
  const prevLevel = useRef(level);
  
  // Estado para modal de configuración
  const [showConfigModal, setShowConfigModal] = useState(false);
  
  // Estado para mostrar/ocultar los controles de desarrollo
  const [showDevControls, setShowDevControls] = useState(false);
  
  // Estado para mostrar/ocultar el contador de FPS
  const [showFpsCounter, setShowFpsCounter] = useState<boolean>(true);
  
  // Determinar si estamos en vista móvil
  const isMobile = useRef(window.innerWidth <= 768);
  
  useEffect(() => {
    const handleResize = () => {
      isMobile.current = window.innerWidth <= 768;
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Efecto para detectar cambios de puntuación y nivel y animar
  useEffect(() => {
    if (prevScore.current !== score && prevScore.current > 0) {
      setAnimateScore(true);
      const timer = setTimeout(() => setAnimateScore(false), 300);
      return () => clearTimeout(timer);
    }
    prevScore.current = score;
  }, [score]);
  
  useEffect(() => {
    if (prevLevel.current !== level && prevLevel.current > 0) {
      setAnimateLevel(true);
      const timer = setTimeout(() => setAnimateLevel(false), 300);
      return () => clearTimeout(timer);
    }
    prevLevel.current = level;
  }, [level]);
  
  // Formatear tiempo para mostrar minutos:segundos
  const formatTime = (seconds: number): string => {
    if (typeof seconds !== 'number' || isNaN(seconds)) {
      return '0:00';
    }
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Determinar qué tiempo mostrar según el modo de juego
  const getDisplayTime = () => {
    if (currentPlayMode === 'timed' && typeof timeRemaining === 'number') {
      return formatTime(timeRemaining);
    } else if (currentPlayMode === 'survival' && typeof survivalTime === 'number') {
      return formatTime(survivalTime);
    } else if (typeof timer === 'number') {
      return formatTime(timer);
    }
    return '0:00';
  };
  
  // Calcular velocidad como multiplicador basado en la configuración actual
  const getSpeedValue = () => {
    if (typeof spawnRate !== 'number' || spawnRate <= 0) {
      return 'x1.0';
    }
    
    // Usar el SpeedController para obtener el multiplicador actual
    const multiplier = speedController.getCurrentMultiplier(spawnRate, currentDifficulty);
    
    // Formatear el multiplicador con un decimal
    return `x${multiplier.toFixed(1)}`;
  };
  
  // Obtener el nombre del modo para mostrar
  const getModeName = () => {
    return MODE_NAMES[currentPlayMode] || 'Clásico';
  };

  // Calcular progreso según el modo de juego
  const getProgress = () => {
    if (currentPlayMode === 'classic' && levelScoreTarget > 0) {
      const scoreProgress = Math.min(100, Math.round((score / levelScoreTarget) * 100));
      return `${scoreProgress}%`;
    } else if (currentPlayMode === 'timed') {
      return getDisplayTime(); // En modo tiempo, mostramos el tiempo restante
    } else if (currentPlayMode === 'zen' || currentPlayMode === 'tutorial') {
      // Para zen y tutorial calculamos ocupación del tablero
      const totalCells = boardSize * boardSize;
      if (totalCells > 0 && typeof iconCount === 'number') {
        const occupationPercentage = Math.round((iconCount / totalCells) * 100);
        return `${occupationPercentage}%`;
      }
    }
    return '0%';
  };
  
  // Obtener el porcentaje visual para la barra de progreso
  const getProgressPercentage = useCallback(() => {
    if (currentPlayMode === 'classic' && levelScoreTarget > 0) {
      return Math.min(100, Math.round((score / levelScoreTarget) * 100));
    } else if (currentPlayMode === 'timed' && timeRemaining !== undefined && typeof timeRemaining === 'number') {
      // En modo tiempo, mostramos el tiempo consumido como progreso
      const timeLimit = config.LEVEL_REQUIREMENTS.timed?.baseTime || 120;
      return Math.max(0, Math.min(100, (timeRemaining / timeLimit) * 100));
    } else if (currentPlayMode === 'survival') {
      // En modo supervivencia, el progreso es la ocupación inversa del tablero
      if (iconCount > 0 && boardSize > 0) {
        const totalCells = boardSize * boardSize;
        const clearedPercentage = ((totalCells - iconCount) / totalCells) * 100;
        return Math.min(100, clearedPercentage);
      }
    }
    return 0;
  }, [currentPlayMode, score, timeRemaining, levelScoreTarget, iconCount, boardSize]);
  
  // Determina si el objetivo de puntuación se ha logrado en modo clásico
  const hasReachedScoreTarget = useCallback(() => {
    if (currentPlayMode === 'classic' && levelScoreTarget > 0) {
      return score >= levelScoreTarget;
    }
    return false;
  }, [currentPlayMode, score, levelScoreTarget]);

  // Obtener tooltip según el modo de juego
  const getProgressTooltip = () => {
    if (currentPlayMode === 'classic') {
      return `Progreso hacia el objetivo de ${levelScoreTarget} puntos (solo informativo)`;
    } else if (currentPlayMode === 'timed') {
      return 'Tiempo restante';
    } else if (currentPlayMode === 'zen' || currentPlayMode === 'tutorial') {
      return 'Ocupación actual del tablero';
    }
    return '';
  };

  // Obtener el label de progreso según el modo de juego
  const getProgressLabel = () => {
    if (currentPlayMode === 'classic') {
      return 'OBJETIVO';
    } else if (currentPlayMode === 'timed') {
      return 'TIEMPO';
    } else {
      return 'PROGRESO';
    }
  };

  // Obtener la clase CSS según si se ha alcanzado el objetivo
  const getProgressClass = () => {
    if (currentPlayMode === 'classic' && score >= levelScoreTarget) {
      return 'progress-achieved';
    }
    return '';
  };

  // Obtener el emoji y nombre de la dificultad
  const getDifficultyDisplay = () => {
    const emoji = DIFFICULTY_EMOJIS[currentDifficulty] || '🌗';
    const name = DIFFICULTY_NAMES[currentDifficulty] || 'Normal';
    return `${emoji} ${name}`;
  };

  // Manejadores para los botones
  const handlePauseResume = () => {
    if (status === 'playing') {
      dispatch(setGameStatus('paused'));
    } else if (status === 'paused') {
      dispatch(setGameStatus('playing'));
    }
  };

  const handleRestart = () => {
    // Reiniciar el juego: volver a la pantalla de inicio y resetear el combo
    dispatch(resetCombo());
    dispatch(setGameStatus('startScreen'));
  };

  const toggleDevControls = () => {
    setShowDevControls(!showDevControls);
  };

  const toggleFpsCounter = () => {
    setShowFpsCounter(!showFpsCounter);
  };
  
  // Renderizar la barra de progreso en todos los modos que apliquen
  const renderProgressBar = () => {
    const progressPercentage = getProgressPercentage();
    
    return (
      <div className="hud-value">
        <div className="progress-bar">
          <div 
            className={`progress-fill ${hasReachedScoreTarget() ? 'progress-achieved' : ''}`} 
            style={{ width: `${progressPercentage}%` }}
          ></div>
        </div>
        <div className="progress-text">
          {currentPlayMode === 'classic' && levelScoreTarget > 0 
            ? `${score}/${levelScoreTarget}` 
            : `${Math.round(progressPercentage)}%`
          }
        </div>
      </div>
    );
  };
  
  // Renderizado condicional basado en el dispositivo
  return (
    <>
      {/* Barra superior con puntuación máxima y botones */}
      <div className="top-bar">
        {/* Puntuación máxima en esquina superior izquierda */}
        <div className="max-score-container">
          <div className="max-score-label">MÁXIMA</div>
          <div className="max-score-value">{highScore || 0}</div>
        </div>

        {/* Botones en esquina superior derecha */}
        <div className="control-buttons">
          <button 
            className="control-button pause-button"
            onClick={handlePauseResume}
            aria-label={status === 'playing' ? 'Pausar juego' : 'Reanudar juego'}
          >
            {status === 'playing' ? '⏸️' : '▶️'}
          </button>
          
          <button 
            className="control-button restart-button"
            onClick={handleRestart}
            aria-label="Reiniciar juego"
          >
            🔄
          </button>
          
          <button 
            className="control-button settings-button"
            onClick={() => setShowConfigModal(!showConfigModal)}
            aria-label="Configuración"
          >
            ⚙️
          </button>
        </div>
      </div>

      {/* HUD de información del juego - Grid Layout Responsivo */}
      <div className="game-hud">
        <div className="hud-item score">
          <div className="hud-label">PUNTUACIÓN</div>
          <div className={`hud-value ${animateScore ? 'score-change' : ''}`}>{score || 0}</div>
        </div>
        
        <div className="hud-item level">
          <div className="hud-label">NIVEL</div>
          <div className={`hud-value ${animateLevel ? 'score-change' : ''}`}>{level || 1}</div>
        </div>
        
        <div className="hud-item time">
          <div className="hud-label">TIEMPO</div>
          <div className="hud-value">{getDisplayTime()}</div>
        </div>
        
        <div className="hud-item speed">
          <div className="hud-label">VELOCIDAD</div>
          <div className="hud-value">{getSpeedValue()}</div>
        </div>
        
        <div className="hud-item mode">
          <div className="hud-label">MODO</div>
          <div className="hud-value">{getModeName()}</div>
        </div>
        
        <div className="hud-item difficulty">
          <div className="hud-label">DIFICULTAD</div>
          <div className="hud-value">{getDifficultyDisplay()}</div>
        </div>
        
        <div className="hud-item progress">
          <div className="hud-label">{getProgressLabel()}</div>
          {renderProgressBar()}
        </div>
      </div>
      
      {/* Combo Timer (Directamente en el componente, no en wrapper) */}
      <ComboTimer />

      {/* Modal de configuración */}
      {showConfigModal && (
        <div className="config-modal">
          <div className="config-modal-content">
            <h3>Configuración</h3>
            
            <div className="config-section">
              <h4>Sonido</h4>
              <div className="config-option">
                <span>Música</span>
                <label className="toggle-switch">
                  <input type="checkbox" defaultChecked />
                  <span className="toggle-slider"></span>
                </label>
              </div>
              <div className="config-option">
                <span>Efectos</span>
                <label className="toggle-switch">
                  <input type="checkbox" defaultChecked />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            </div>
            
            <div className="config-section">
              <h4>Apariencia</h4>
              <div className="config-option">
                <span>Modo oscuro</span>
                <label className="toggle-switch">
                  <input type="checkbox" defaultChecked />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            </div>
            
            <div className="config-section">
              <h4>Rendimiento</h4>
              <div className="config-option">
                <span>Animaciones reducidas</span>
                <label className="toggle-switch">
                  <input type="checkbox" />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            </div>
            
            <div className="config-section dev-controls-section">
              <h4>Desarrollador</h4>
              <div className="config-option">
                <span>Mostrar FPS</span>
                <label className="toggle-switch">
                  <input 
                    type="checkbox" 
                    checked={showFpsCounter}
                    onChange={toggleFpsCounter}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
              <div className="config-option">
                <span>Controles Dev</span>
                <label className="toggle-switch">
                  <input 
                    type="checkbox"
                    checked={showDevControls}
                    onChange={toggleDevControls}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            </div>
            
            <button 
              className="close-modal-btn"
              onClick={() => setShowConfigModal(false)}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default GameHUD; 