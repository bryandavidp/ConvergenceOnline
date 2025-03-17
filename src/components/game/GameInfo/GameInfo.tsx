import React from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../../store';
import { speedController } from '../../../utils/speedController';
import * as config from '../../../utils/config';
import './GameInfo.css';

const GameInfo: React.FC = () => {
  const { 
    score, 
    highScore, 
    level, 
    timer, 
    spawnRate, 
    currentDifficulty, 
    currentPlayMode 
  } = useSelector((state: RootState) => state.game);
  
  // Obtener velocidad inicial para la dificultad actual
  const initialSpeed = speedController.getInitialSpeed(currentDifficulty, currentPlayMode || 'classic');
  
  // Asegurar que tenemos un spawnRate válido
  const safeSpawnRate = (!spawnRate || isNaN(spawnRate)) ? initialSpeed : spawnRate;
  
  // Calcular el multiplicador de velocidad y tiempo de spawn
  const speedMultiplier = speedController.getCurrentMultiplier(safeSpawnRate, currentDifficulty);
  const spawnTimeInSeconds = (safeSpawnRate / 1000).toFixed(1);
  
  // Formatear el tiempo para mostrar minutos:segundos
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Obtener el color del multiplicador basado en su valor
  const getMultiplierColor = (multiplier: number): string => {
    if (multiplier >= 4.0) return 'var(--color-legendary)';
    if (multiplier >= 3.0) return 'var(--color-epic)';
    if (multiplier >= 2.0) return 'var(--color-rare)';
    if (multiplier >= 1.5) return 'var(--color-uncommon)';
    return 'var(--color-basic)';
  };
  
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
        <div className="stat-value">{formatTime(timer)}</div>
        <div className="stat-label">Tiempo</div>
      </div>
      
      <div className="stat-card">
        <div className="stat-icon">🚀</div>
        <div className="stat-value" style={{ color: getMultiplierColor(speedMultiplier) }}>
          {speedMultiplier}x ({spawnTimeInSeconds}s)
        </div>
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