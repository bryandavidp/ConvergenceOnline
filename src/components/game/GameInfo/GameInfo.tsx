import React from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../../store';
import './GameInfo.css';

const GameInfo: React.FC = () => {
  const { score, highScore, level, timer, spawnRate } = useSelector((state: RootState) => state.game);
  
  // Calcular el multiplicador de velocidad
  const baseSpeed = 3000; // ms
  const speedMultiplier = (baseSpeed / spawnRate).toFixed(1);
  
  return (
    <div className="game-info">
      <div className="stat-card">
        <div className="stat-icon">🏆</div>
        <div className="stat-value">{score}</div>
        <div className="stat-label">Puntuación</div>
      </div>
      
      <div className="stat-card">
        <div className="stat-icon">🥇</div>
        <div className="stat-value">{highScore}</div>
        <div className="stat-label">Máximo</div>
      </div>
      
      <div className="stat-card">
        <div className="stat-icon">⏱️</div>
        <div className="stat-value">{timer}</div>
        <div className="stat-label">Tiempo</div>
      </div>
      
      <div className="stat-card">
        <div className="stat-icon">🚀</div>
        <div className="stat-value">{speedMultiplier}x</div>
        <div className="stat-label">Velocidad</div>
      </div>
      
      <div className="stat-card">
        <div className="stat-icon">📊</div>
        <div className="stat-value">{level}</div>
        <div className="stat-label">Nivel</div>
      </div>
    </div>
  );
};

export default GameInfo; 