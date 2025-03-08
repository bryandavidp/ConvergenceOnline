import React, { useRef, useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../../store';
import { setGameStatus } from '../../../store/slices/gameSlice';
import ComboTimer from '../ComboTimer/ComboTimer';
import './GameHUD.css';

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
    highScore
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
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Determinar qué tiempo mostrar según el modo de juego
  const getDisplayTime = () => {
    if (currentPlayMode === 'timed') {
      return formatTime(timeRemaining);
    } else if (currentPlayMode === 'survival') {
      return formatTime(survivalTime);
    } else {
      return formatTime(timer);
    }
  };
  
  // Calcular velocidad como porcentaje inverso (más bajo = más rápido)
  const getSpeedValue = () => {
    // Base: Inicio en 3000ms (valor típico), más rápido aproxima a 1000ms
    const baseRate = 3000; 
    const minRate = 1000;
    
    // Velocidad en porcentaje relativo (100% = velocidad normal, >100% = más rápido)
    const speedPercentage = Math.round((baseRate / Math.max(spawnRate, minRate)) * 100);
    
    return `x${(speedPercentage / 100).toFixed(1)}`;
  };
  
  // Obtener el nombre del modo para mostrar
  const getModeName = () => {
    switch(currentPlayMode) {
      case 'classic': return 'Clásico';
      case 'timed': return 'Tiempo';
      case 'survival': return 'Superv.';
      default: return 'Clásico';
    }
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
    // Implementar reinicio del juego
    dispatch(setGameStatus('startScreen'));
    // Aquí podrías resetear otros estados del juego si es necesario
  };

  const toggleDevControls = () => {
    setShowDevControls(!showDevControls);
  };

  const toggleFpsCounter = () => {
    setShowFpsCounter(!showFpsCounter);
  };
  
  // Renderizado condicional basado en el dispositivo
  return (
    <>
      {/* Barra superior con puntuación máxima y botones */}
      <div className="top-bar">
        {/* Puntuación máxima en esquina superior izquierda */}
        <div className="max-score-container">
          <div className="max-score-label">MÁXIMA</div>
          <div className="max-score-value">{highScore || 33340}</div>
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

      {/* HUD de información del juego */}
      <div className={`game-hud ${isMobile.current ? 'mobile' : ''}`}>
        <div className="hud-item score">
          <div className="hud-label">PUNTUACIÓN</div>
          <div className={`hud-value ${animateScore ? 'score-change' : ''}`}>{score || 620}</div>
        </div>
        
        <div className="hud-item level">
          <div className="hud-label">NIVEL</div>
          <div className={`hud-value ${animateLevel ? 'score-change' : ''}`}>{level || 2}</div>
        </div>
        
        <div className="hud-item time">
          <div className="hud-label">TIEMPO</div>
          <div className="hud-value">{getDisplayTime() || '1:08'}</div>
        </div>
        
        <div className="hud-item speed">
          <div className="hud-label">VELOCIDAD</div>
          <div className="hud-value">{getSpeedValue() || 'x1.2'}</div>
        </div>
        
        <div className="hud-item mode">
          <div className="hud-label">MODO</div>
          <div className="hud-value">{getModeName()}</div>
        </div>
      </div>
      
      {/* Contenedor para el ComboTimer */}
      <div className="combo-timer-wrapper">
        <ComboTimer />
      </div>

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
                  <input type="checkbox" />
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