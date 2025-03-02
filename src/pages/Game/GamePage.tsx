import React, { useEffect, useState, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store';
import { setGameStatus, setLevel, setBoardSize, setAvailableIcons, setSpawnRate } from '../../store/slices/gameSlice';
import logger from '../../utils/logger';
import { useGameLogic } from '../../hooks/useGameLogic';
import GameBoard from '../../components/game/GameBoard/GameBoard';
import GameOverModal from '../../components/game/GameModals/GameOverModal';
import LevelCompleteModal from '../../components/game/GameModals/LevelCompleteModal';
import StartGameModal from '../../components/game/GameModals/StartGameModal';
import { audioManager } from '../../utils/audioManager';
import * as config from '../../utils/config';
import './GamePage.css';

const GamePage: React.FC = () => {
  const dispatch = useDispatch();
  const { status, level, boardSize, currentMode, score, timer, spawnRate } = useSelector((state: RootState) => state.game);
  const { initializeBoard, stopTimers, isInitialized, startTimers } = useGameLogic();
  // Referencia para controlar las inicializaciones repetidas
  const isInitializingRef = useRef<boolean>(false);
  const lastBoardSizeRef = useRef<number>(0);
  
  // Cargar configuración y preparar el juego
  useEffect(() => {
    logger.component.mount('GamePage');
    
    // Cargar sonidos
    audioManager.play('pageLoad');
    
    // Configurar nivel inicial
    const initialLevel = 1;
    dispatch(setLevel(initialLevel));
    
    // Configurar tamaño del tablero basado en el nivel
    const size = config.getLevelBoardSize(initialLevel);
    dispatch(setBoardSize(size));
    
    // Configurar velocidad inicial basada en el nivel
    const initialSpawnRate = config.getLevelSpawnRate(initialLevel);
    dispatch(setSpawnRate(initialSpawnRate));
    
    // Seleccionar iconos para el nivel
    const iconCount = config.iconCountByLevel(initialLevel);
    const shuffledIcons = [...config.AVAILABLE_ICONS].sort(() => Math.random() - 0.5);
    const selectedIcons = shuffledIcons.slice(0, iconCount);
    dispatch(setAvailableIcons(selectedIcons));
    
    // Estado inicial
    dispatch(setGameStatus('startScreen'));
    
    return () => {
      logger.component.unmount('GamePage');
      stopTimers(); // Asegurarse de detener todos los temporizadores
      audioManager.stopMusic();
    };
  }, [dispatch, stopTimers]);
  
  // Inicializar el tablero cuando cambia el estatus a 'playing'
  useEffect(() => {
    if (status === 'playing') {
      // Evitar inicializaciones repetidas
      if (isInitializingRef.current) {
        logger.debug('GamePage', 'Inicialización ya en progreso, se omite la solicitud');
        return;
      }

      // Verificar si el tablero necesita ser reinicializado (cambio de nivel/tamaño)
      const needsReinitialization = !isInitialized || lastBoardSizeRef.current !== boardSize;
      
      if (needsReinitialization) {
        // Establecer bandera de inicialización
        isInitializingRef.current = true;
        
        logger.info('GamePage', `Inicializando tablero: Nivel ${level}, Tamaño ${boardSize}x${boardSize}`);
        
        // Actualizar referencia del tamaño
        lastBoardSizeRef.current = boardSize;
        
        // Inicializar el tablero
        initializeBoard(boardSize);
        
        // Restablecer bandera después de la inicialización
        setTimeout(() => {
          isInitializingRef.current = false;
        }, 200);
      } else {
        logger.debug('GamePage', 'No es necesario reinicializar el tablero, solo los temporizadores');
      }
      
      // Asegurarnos de que los temporizadores se inicien
      if (isInitialized && !isInitializingRef.current) {
        startTimers();
      }
    }
  }, [status, level, boardSize, initializeBoard, isInitialized, startTimers]);
  
  // Reiniciar temporizadores cuando el estado cambia
  useEffect(() => {
    // Detener temporizadores cuando el juego se pausa o termina
    if (status === 'paused' || status === 'gameOver' || status === 'levelCompleted') {
      stopTimers();
    }
    
    // Pausar música cuando el juego se pausa o termina
    if (status === 'paused') {
      audioManager.pauseMusic();
    } else if (status === 'gameOver') {
      audioManager.stopMusic();
      audioManager.play('gameOver');
    } else if (status === 'levelCompleted') {
      audioManager.play('levelComplete');
    }
  }, [status, stopTimers]);
  
  // Configuración al cambiar de nivel
  useEffect(() => {
    if (level > 1 && status === 'playing') { // No cambiar en el nivel inicial ni cuando no está jugando
      // Obtener nuevo tamaño del tablero
      const newSize = config.getLevelBoardSize(level);
      
      // Obtener nueva velocidad de spawn
      const newSpawnRate = config.getLevelSpawnRate(level);
      
      // Seleccionar iconos para el nivel
      const iconCount = config.iconCountByLevel(level);
      const shuffledIcons = [...config.AVAILABLE_ICONS].sort(() => Math.random() - 0.5);
      const selectedIcons = shuffledIcons.slice(0, iconCount);
      
      // Actualizar configuración
      if (newSize !== boardSize) {
        logger.info('GamePage', `Ajustando tamaño del tablero para el nivel ${level}: ${newSize}x${newSize}`);
        dispatch(setBoardSize(newSize));
        
        // El tablero se reiniciará automáticamente a través del otro useEffect
        // cuando detecte el cambio en boardSize
      } else {
        // Si el tamaño no cambia, pero necesitamos reiniciar para el nuevo nivel
        // sin causar bucles, lo hacemos solo si no hay una inicialización en curso
        if (!isInitializingRef.current && isInitialized) {
          isInitializingRef.current = true;
          logger.info('GamePage', `Reinicializando tablero para nivel ${level} sin cambio de tamaño`);
          
          // Detener temporizadores
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
      
      dispatch(setSpawnRate(newSpawnRate));
      dispatch(setAvailableIcons(selectedIcons));
    }
  }, [level, boardSize, dispatch, status, isInitialized, isInitializingRef, initializeBoard, stopTimers]);
  
  // Calcular el multiplicador de velocidad para mostrar
  const speedMultiplier = (config.SPAWN_RATES.MEDIUM / spawnRate).toFixed(1);
  
  return (
    <div className="game-page">
      {/* Barra superior minimalista con estadísticas */}
      <div className="game-header">
        <div className="game-stats">
          <div className="stat-item">
            <div className="stat-icon">🏆</div>
            <div className="stat-value">{score}</div>
          </div>
          <div className="stat-item">
            <div className="stat-icon">🏅</div>
            <div className="stat-value">{level}</div>
          </div>
          <div className="stat-item">
            <div className="stat-icon">⏱️</div>
            <div className="stat-value">{timer}</div>
          </div>
          <div className="stat-item">
            <div className="stat-icon">🚀</div>
            <div className="stat-value">{speedMultiplier}x</div>
          </div>
        </div>
      </div>
      
      <div className="game-container">
        <div className="game-area">
          <GameBoard />
        </div>
      </div>
      
      {/* Modales del juego */}
      <StartGameModal isVisible={status === 'startScreen'} />
      <GameOverModal isVisible={status === 'gameOver'} />
      <LevelCompleteModal isVisible={status === 'levelCompleted'} />
    </div>
  );
};

export default GamePage;