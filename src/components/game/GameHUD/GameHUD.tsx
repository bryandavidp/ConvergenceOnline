import React from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../../store';
import './GameHUD.css';

const GameHUD: React.FC = () => {
  const { score, level, timer, currentPlayMode, timeRemaining, survivalTime } = useSelector((state: RootState) => state.game);
  
  // Formatear tiempo para mostrar minutos:segundos
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };
  
  return (
    <div className="game-hud">
      <div className="hud-section">
        <span className="hud-label">Puntuación</span>
        <span className="hud-value score">{score}</span>
      </div>
      
      <div className="hud-section">
        <span className="hud-label">Nivel</span>
        <span className="hud-value level">{level}</span>
      </div>
      
      {currentPlayMode === 'timed' ? (
        <div className="hud-section">
          <span className="hud-label">Tiempo Restante</span>
          <span className="hud-value timer">{formatTime(timeRemaining)}</span>
        </div>
      ) : currentPlayMode === 'survival' ? (
        <div className="hud-section">
          <span className="hud-label">Tiempo Supervivencia</span>
          <span className="hud-value timer">{formatTime(survivalTime)}</span>
        </div>
      ) : (
        <div className="hud-section">
          <span className="hud-label">Tiempo</span>
          <span className="hud-value timer">{formatTime(timer)}</span>
        </div>
      )}
      
      <div className="hud-section">
        <span className="hud-label">Modo</span>
        <span className="hud-value mode">
          {currentPlayMode === 'classic' && 'Clásico'}
          {currentPlayMode === 'timed' && 'Contrarreloj'}
          {currentPlayMode === 'survival' && 'Supervivencia'}
        </span>
      </div>
    </div>
  );
};

export default GameHUD; 