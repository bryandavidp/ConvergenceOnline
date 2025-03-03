import React, { useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../../store';
import useGameLogic from '../../../hooks/useGameLogic';
import * as config from '../../../utils/config';
import { formatTime, calculateBoardOccupation } from '../../../utils/gameUtils';
import { audioManager } from '../../../utils/audioManager';
import './GameHUD.css';

const GameHUD: React.FC = () => {
  const { 
    score, 
    level, 
    timer, 
    status, 
    boardSize, 
    iconCount, 
    speedMultiplier,
    hintsRemaining, 
    hintCooldown 
  } = useSelector((state: RootState) => state.game);
  
  const { showHint, resetCurrentLevel } = useGameLogic();
  
  // Manejar clic en el botón de pista
  const handleHintClick = useCallback(() => {
    if (status === 'playing' && !hintCooldown && hintsRemaining > 0) {
      audioManager.play('hint');
      showHint();
    }
  }, [status, hintCooldown, hintsRemaining, showHint]);
  
  // Manejar clic en el botón de reiniciar nivel
  const handleResetLevel = useCallback(() => {
    if (status === 'playing') {
      audioManager.play('click');
      resetCurrentLevel();
    }
  }, [status, resetCurrentLevel]);
  
  // Calcular porcentaje de ocupación del tablero usando la función auxiliar
  const occupationPercentage = calculateBoardOccupation(iconCount, boardSize);
  
  return (
    <div className="game-hud">
      <div className="game-info-section main-info">
        <div className="info-item score">
          <span className="info-label">Puntuación</span>
          <span className="info-value">{score}</span>
        </div>
        
        <div className="info-item level">
          <span className="info-label">Nivel</span>
          <span className="info-value">{level}</span>
        </div>
        
        <div className="info-item timer">
          <span className="info-label">Tiempo</span>
          <span className="info-value">{formatTime(timer)}</span>
        </div>
      </div>
      
      <div className="game-info-section board-info">
        <div className="info-item board-size">
          <span className="info-label">Tablero</span>
          <span className="info-value">{boardSize}×{boardSize}</span>
        </div>
        
        <div className="info-item occupation">
          <span className="info-label">Ocupación</span>
          <div className="occupation-bar">
            <div 
              className="occupation-fill" 
              style={{width: `${occupationPercentage}%`}}
              data-status={occupationPercentage > 80 ? 'critical' : occupationPercentage > 60 ? 'warning' : 'normal'}
            ></div>
            <span className="occupation-text">{occupationPercentage}%</span>
          </div>
        </div>
        
        <div className="info-item speed">
          <span className="info-label">Velocidad</span>
          <span className="info-value">{speedMultiplier}×</span>
        </div>
      </div>
      
      <div className="game-controls">
        <button 
          className={`hint-button control-button ${hintCooldown ? 'cooldown' : ''} ${hintsRemaining <= 0 ? 'disabled' : ''}`}
          onClick={handleHintClick}
          disabled={hintCooldown || hintsRemaining <= 0 || status !== 'playing'}
        >
          <span role="img" aria-label="pista">💡</span>
          <span className="hint-count">{hintsRemaining}</span>
        </button>
        
        <button 
          className="reset-level-button control-button"
          onClick={handleResetLevel}
          disabled={status !== 'playing'}
        >
          <span role="img" aria-label="reiniciar">🔄</span>
        </button>
      </div>
    </div>
  );
};

export default GameHUD; 