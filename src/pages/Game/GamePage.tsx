import React, { useEffect, useState, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store';
import { setGameStatus, setLevel } from '../../store/slices/gameSlice';
import logger from '../../utils/logger';
import useGameLogic from '../../hooks/useGameLogic';
import GameBoard from '../../components/game/GameBoard/GameBoard';
import GameHUD from '../../components/game/GameHUD/GameHUD';
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
  const { status, level, boardSize, currentPlayMode, score, timer, spawnRate } = useSelector((state: RootState) => state.game);
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
    if (status === 'playing') {
      // Evitar inicializaciones múltiples
      if (isInitializingRef.current) {
        logger.warn('GamePage', 'Se intentó inicializar el tablero mientras ya hay una inicialización en curso');
        return;
      }
      
      // Solo inicializar si no está inicializado
      if (!isBoardInitializedRef.current) {
        isInitializingRef.current = true;
        logger.info('GamePage', `Inicializando tablero con tamaño ${boardSize}x${boardSize}`);
        
        // Detener temporizadores primero para prevenir reinicios continuos
        stopTimers();
        
        // Inicializar el tablero con el tamaño actual
        setTimeout(() => {
          initializeBoard(boardSize);
          
          // Marcar como inicializado después de un breve retraso
          setTimeout(() => {
            isBoardInitializedRef.current = true;
            isInitializingRef.current = false;
          }, 300);
        }, 100);
      }
    } else {
      // Reiniciar el estado de inicialización cuando no estamos jugando
      isBoardInitializedRef.current = false;
    }
  }, [boardSize, initializeBoard, status, stopTimers]);
  
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
      
      // Establecer el estado de inicialización
      isInitializingRef.current = true;
      
      // Detener temporizadores temporalmente
      stopTimers();
      
      const oldSize = boardSize;
      const newConfig = configureBoardForLevel(level, true);
      
      // Pequeña pausa antes de continuar para permitir que terminen procesos pendientes
      setTimeout(() => {
        // Si el tamaño del tablero cambió, no necesitamos hacer nada ya que
        // el cambio de boardSize activará el useEffect correspondiente
        if (newConfig.size !== oldSize) {
          logger.info('GamePage', `El tamaño del tablero cambiará de ${oldSize}x${oldSize} a ${newConfig.size}x${newConfig.size}`);
          // La inicialización la manejará el useEffect que observa boardSize
        } else {
          // Si el tamaño no cambió, necesitamos reinicializar manualmente
          logger.info('GamePage', `Reinicializando tablero sin cambio de tamaño`);
          
          // Reiniciar el flag de inicialización
          isBoardInitializedRef.current = false;
          
          // Inicializar el tablero (esto activará el useEffect que observa boardSize)
          // porque cambiamos isBoardInitializedRef
          setTimeout(() => {
            // Asegurarnos de que seguimos en estado de juego
            if (status === 'playing') {
              isInitializingRef.current = false;
            } else {
              isInitializingRef.current = false;
            }
          }, 300);
        }
      }, 200);
    }
  }, [level, boardSize, status, initializeBoard, stopTimers]);
  
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
        <GameHUD />
        
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