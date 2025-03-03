import React, { useEffect, useState, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store';
import { setGameStatus, setLevel } from '../../store/slices/gameSlice';
import logger from '../../utils/logger';
import useGameLogic from '../../hooks/useGameLogic';
import GameBoard from '../../components/game/GameBoard/GameBoard';
import GameOverModal from '../../components/game/GameModals/GameOverModal';
import LevelCompleteModal from '../../components/game/GameModals/LevelCompleteModal';
import StartGameModal from '../../components/game/GameModals/StartGameModal';
import { audioManager } from '../../utils/audioManager';
import * as config from '../../utils/config';
import {
  configureBoardForLevel,
  changeBoardSize,
  changeSpawnRate,
  adjustBoardVisuals
} from '../../utils/boardUtils';
import './GamePage.css';

const GamePage: React.FC = () => {
  const dispatch = useDispatch();
  const { status, level, boardSize, currentMode, score, timer, spawnRate } = useSelector((state: RootState) => state.game);
  const { initializeBoard, stopTimers, startTimers } = useGameLogic();
  // Referencia para controlar las inicializaciones repetidas
  const isInitializingRef = useRef<boolean>(false);
  // Track if board has been initialized
  const isBoardInitializedRef = useRef<boolean>(false);
  
  // Referencias a los elementos del tablero
  const boardContainerRef = useRef<HTMLDivElement>(null);
  const boardElementRef = useRef<HTMLDivElement>(null);
  
  // Ajustar el tamaño del tablero cuando cambia la ventana
  useEffect(() => {
    const handleResize = () => {
      if (boardContainerRef.current && boardElementRef.current) {
        // Usamos la función adjustBoardVisuals importada al principio del archivo
        adjustBoardVisuals(boardContainerRef.current, boardElementRef.current);
      }
    };

    // Ajustar tamaño inicialmente
    handleResize();
    
    // Escuchar cambios de tamaño
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [boardSize]);
  
  // Inicializar el tablero cuando cambie su tamaño
  useEffect(() => {
    if (!isBoardInitializedRef.current && !isInitializingRef.current && status === 'playing') {
      isInitializingRef.current = true;
      logger.info('GamePage', `Inicializando tablero con tamaño ${boardSize}x${boardSize}`);
      
      initializeBoard(boardSize);
      isBoardInitializedRef.current = true;
      
      setTimeout(() => {
        isInitializingRef.current = false;
      }, 200);
    }
  }, [boardSize, initializeBoard, status]);
  
  // Limpiar al desmontar
  useEffect(() => {
    return () => {
      logger.info('GamePage', 'Componente desmontado, limpiando');
      stopTimers();
    }
  }, [stopTimers]);
  
  // Actualizar configuración cuando cambia el nivel
  useEffect(() => {
    // Ignorar si no estamos en juego o hay una inicialización en curso
    if (status !== 'playing' || isInitializingRef.current) return;
    
    // Solo actualizar si estamos más allá del nivel 1
    if (level > 1) {
      logger.info('GamePage', `Configurando tablero para nivel ${level}`);
      
      // Usar la función modularizada para configurar el tablero según el nivel
      // Mantener la velocidad actual para preservar la dificultad progresiva
      isInitializingRef.current = true;
      
      const oldSize = boardSize;
      const newConfig = configureBoardForLevel(level, true);
      
      // Si el tamaño del tablero cambió, el useEffect de boardSize manejará la inicialización
      if (newConfig.size !== oldSize) {
        logger.info('GamePage', `El tamaño del tablero cambiará de ${oldSize}x${oldSize} a ${newConfig.size}x${newConfig.size}`);
        // La inicialización será manejada por el useEffect que observa cambios en boardSize
      } else {
        // Si no hay cambio de tamaño, reinicializar manualmente
        if (!isInitializingRef.current && isBoardInitializedRef.current) {
          logger.info('GamePage', `Reinicializando tablero sin cambio de tamaño`);
          
          // Detener temporizadores temporalmente
          stopTimers();
          
          // Pequeña pausa antes de reinicializar
          setTimeout(() => {
            // Verificar que seguimos en estado de juego
            if (status === 'playing') {
              initializeBoard(boardSize);
              setTimeout(() => {
                isInitializingRef.current = false;
              }, 200);
            } else {
              isInitializingRef.current = false;
            }
          }, 300);
        }
      }
    }
  }, [level, boardSize, dispatch, status, initializeBoard, stopTimers, spawnRate, timer, score]);
  
  // Calcular el multiplicador de velocidad para mostrar
  const speedMultiplier = (config.SPAWN_RATES.MEDIUM / spawnRate).toFixed(1);
  
  // Manejar cambio manual de velocidad (para depuración o características avanzadas)
  const handleSpeedChange = (multiplier: number) => {
    const baseSpeed = config.SPAWN_RATES.MEDIUM;
    const newSpeed = Math.round(baseSpeed / multiplier);
    
    logger.info('GamePage', `Cambiando velocidad manualmente`, {
      multiplicador: multiplier,
      nuevaVelocidad: newSpeed
    });
    
    // Usar la función modularizada para cambiar la velocidad
    changeSpawnRate(newSpeed);
    
    // Reiniciar los temporizadores para aplicar la nueva velocidad
    stopTimers();
    startTimers();
  };
  
  // Manejar cambio manual de tamaño del tablero
  const handleSizeChange = (newSize: number) => {
    logger.info('GamePage', `Cambiando tamaño del tablero manualmente a ${newSize}x${newSize}`);
    
    // Usar la función modularizada para cambiar el tamaño
    changeBoardSize(newSize);
  };
  
  return (
    <div className="game-page">
      <div className="game-container">
        <div className="game-header">
          <div className="game-info">
            <div className="info-item">
              <span className="label">Nivel</span>
              <span className="value">{level}</span>
            </div>
            <div className="info-item">
              <span className="label">Puntos</span>
              <span className="value">{score}</span>
            </div>
            <div className="info-item">
              <span className="label">Tiempo</span>
              <span className="value">{timer}s</span>
            </div>
            <div className="info-item">
              <span className="label">Velocidad</span>
              <span className="value">{speedMultiplier}x</span>
            </div>
          </div>
        </div>
        
        <div className="board-container" ref={boardContainerRef}>
          <GameBoard ref={boardElementRef} />
        </div>
        
        {/* Modales del juego */}
        <StartGameModal isVisible={status === 'startScreen'} />
        <GameOverModal isVisible={status === 'gameOver'} />
        <LevelCompleteModal isVisible={status === 'levelCompleted'} />
        
        {/* Controles de desarrollo (ocultos en producción) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="dev-controls">
            <div className="dev-section">
              <h4>Velocidad</h4>
              <button onClick={() => handleSpeedChange(0.5)}>0.5x</button>
              <button onClick={() => handleSpeedChange(1)}>1x</button>
              <button onClick={() => handleSpeedChange(2)}>2x</button>
              <button onClick={() => handleSpeedChange(3)}>3x</button>
            </div>
            <div className="dev-section">
              <h4>Tamaño</h4>
              <button onClick={() => handleSizeChange(6)}>6x6</button>
              <button onClick={() => handleSizeChange(8)}>8x8</button>
              <button onClick={() => handleSizeChange(10)}>10x10</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GamePage;