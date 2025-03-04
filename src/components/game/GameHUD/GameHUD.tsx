import React, { useRef, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../../store';
import './GameHUD.css';

const GameHUD: React.FC = () => {
  const { 
    score, 
    level,
    timer,
    timeRemaining,
    survivalTime,
    currentDifficulty,
    currentPlayMode,
    status,
    spawnRate
  } = useSelector((state: RootState) => state.game);
  
  // Determinar si estamos en vista móvil
  const isMobile = useRef(window.innerWidth <= 768);
  useEffect(() => {
    const handleResize = () => {
      isMobile.current = window.innerWidth <= 768;
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
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
  
  // Renderizado condicional basado en el dispositivo
  return (
    <div className={`game-hud ${isMobile.current ? 'mobile' : ''}`}>
      <div className="hud-item score">
        <div className="hud-label">PUNTUACIÓN</div>
        <div className="hud-value">{score}</div>
      </div>
      
      <div className="hud-item level">
        <div className="hud-label">NIVEL</div>
        <div className="hud-value">{level}</div>
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
        <div className="hud-value">
          {currentPlayMode === 'classic' && 'Clásico'}
          {currentPlayMode === 'timed' && 'Tiempo'}
          {currentPlayMode === 'survival' && 'Superv.'}
        </div>
      </div>
    </div>
  );
};

export default GameHUD; 