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
import GameConfigSelector from '../../components/game/GameConfig';
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
  const { initializeBoard, stopTimers, startTimers, changeGameConfig } = useGameLogic();
  // Referencia para controlar las inicializaciones repetidas
  const isInitializingRef = useRef<boolean>(false);
  // Track if board has been initialized
  const isBoardInitializedRef = useRef<boolean>(false);
  
  // Estado para controlar la visualización del selector de configuración
  const [showConfig, setShowConfig] = useState<boolean>(true);
  // Estado para detectar dispositivo móvil
  const [isMobile, setIsMobile] = useState<boolean>(false);
  
  // Referencias a los elementos del tablero
  const boardContainerRef = useRef<HTMLDivElement>(null);
  const boardElementRef = useRef<HTMLDivElement>(null);
  
  // Efecto para detectar dispositivo móvil
  useEffect(() => {
    const checkIsMobile = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
    };
    
    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);
    
    return () => {
      window.removeEventListener('resize', checkIsMobile);
    };
  }, []);
  
  // Efecto para inicializar el estado de juego
  useEffect(() => {
    // Establecer el estado inicial del juego cuando se carga la página
    if (status === 'idle') {
      dispatch(setGameStatus('startScreen'));
    }
    
    // Mostrar el selector de configuración en la pantalla de inicio
    if (status === 'startScreen' || status === 'paused' || status === 'gameOver' || status === 'levelCompleted') {
      setShowConfig(true);
    } else {
      setShowConfig(false);
    }
  }, [status, dispatch]);
  
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
  
  // Gestionar arranque y parada de temporizadores según estado del juego
  useEffect(() => {
    // Detener temporizadores cuando el juego no está en estado 'playing'
    if (status !== 'playing' && !isInitializingRef.current) {
      logger.info('GamePage', `Deteniendo temporizadores por cambio de estado a: ${status}`);
      stopTimers();
    }
    
    // Iniciar temporizadores cuando el juego está en estado 'playing'
    if (status === 'playing' && isBoardInitializedRef.current && !isInitializingRef.current) {
      logger.info('GamePage', 'Iniciando temporizadores por estado playing');
      startTimers();
    }
  }, [status, startTimers, stopTimers, isInitializingRef]);
  
  // Limpiar recursos al desmontar el componente
  useEffect(() => {
    return () => {
      logger.info('GamePage', 'Componente desmontado, limpiando todos los temporizadores');
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
  
  // Manejar cambio de dificultad y modo
  const handleApplyConfig = (difficulty: any, mode: any) => {
    logger.info('GamePage', `Aplicando configuración: ${difficulty}, ${mode}`);
    if (changeGameConfig) {
      changeGameConfig(difficulty, mode);
    }
  };
  
  // Manejadores para los botones de control
  const handlePlayPauseClick = () => {
    if (status === 'playing') {
      dispatch(setGameStatus('paused'));
      stopTimers();
    } else if (status === 'paused') {
      dispatch(setGameStatus('playing'));
      startTimers();
    }
  };

  const handleRestartClick = () => {
    stopTimers();
    isBoardInitializedRef.current = false;
    dispatch(setGameStatus('startScreen'));
  };

  const handleStartGame = () => {
    dispatch(setGameStatus('playing'));
    startTimers();
  };

  const handleNextLevel = () => {
    stopTimers();
    dispatch(setLevel(level + 1));
    dispatch(setGameStatus('startScreen'));
  };

  return (
    <div className={`game-page ${isMobile ? 'game-fullscreen' : ''}`}>
      {isMobile ? (
        // Vista móvil optimizada con layout 30/70
        <div className="game-content">
          <div className="game-info-section">
            <div className="game-header">
              <h1>Convergence</h1>
              <div className="game-controls">
                {status === 'playing' || status === 'paused' ? (
                  <button 
                    className={`control-button ${status === 'playing' ? 'pause' : 'play'}`}
                    onClick={handlePlayPauseClick}
                  >
                    {status === 'playing' ? 'Pausar' : 'Reanudar'}
                  </button>
                ) : null}
                
                <button 
                  className="control-button restart"
                  onClick={handleRestartClick}
                >
                  {status === 'playing' || status === 'paused' ? 'Reiniciar' : 'Inicio'}
                </button>
              </div>
            </div>
            
            {/* Selector de configuración del juego - lo mostramos explícitamente según el estado */}
            {showConfig && (
              <div className="config-section">
                <GameConfigSelector onApplyConfig={handleApplyConfig} />
              </div>
            )}
            
            {/* HUD en la sección de información */}
            <GameHUD />
          </div>
          
          <div className="game-board-section" ref={boardContainerRef}>
            <div className="game-board-frame" ref={boardElementRef} style={{ width: '100%', height: '100%' }}>
              <GameBoard />
            </div>
          </div>
        </div>
      ) : (
        // Vista de escritorio original
        <div className="game-container">
          <div className="game-header">
            <h1>Convergence</h1>
            <div className="game-controls">
              {status === 'playing' || status === 'paused' ? (
                <button 
                  className={`control-button ${status === 'playing' ? 'pause' : 'play'}`}
                  onClick={handlePlayPauseClick}
                >
                  {status === 'playing' ? 'Pausar' : 'Reanudar'}
                </button>
              ) : null}
              
              <button 
                className="control-button restart"
                onClick={handleRestartClick}
              >
                {status === 'playing' || status === 'paused' ? 'Reiniciar' : 'Inicio'}
              </button>
            </div>
          </div>
          
          {/* Selector de configuración del juego - lo mostramos explícitamente según el estado */}
          {showConfig && (
            <div className="config-section">
              <GameConfigSelector onApplyConfig={handleApplyConfig} />
            </div>
          )}
          
          <div className="game-board-container" ref={boardContainerRef}>
            <GameHUD />
            <div className="game-board-frame" ref={boardElementRef} style={{ width: '100%', height: '100%' }}>
              <GameBoard />
            </div>
          </div>
        </div>
      )}
      
      {/* Modales del juego - funcionan igual en ambas vistas */}
      {status === 'gameOver' && <GameOverModal onRestart={handleRestartClick} />}
      {status === 'levelCompleted' && <LevelCompleteModal onContinue={handleNextLevel} />}
      {status === 'startScreen' && <StartGameModal onStart={handleStartGame} />}
    </div>
  );
};

export default GamePage;