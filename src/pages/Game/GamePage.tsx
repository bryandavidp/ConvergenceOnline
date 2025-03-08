import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store';
import { store } from '../../store';
import { setGameStatus, setLevel, setDarkMode, setHighlightedCells, incrementScore, resetGame, setAvailableIcons } from '../../store/slices/gameSlice';
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
import { useGameContext } from '../../contexts/GameContext';
import { useGameSound } from '../../hooks/useGameSound';
import { useDarkMode } from '../../hooks/useDarkMode';
import {
  configureBoardForLevel,
  changeBoardSize,
  changeSpawnRate,
  adjustBoardVisuals
} from '../../utils/boardUtils';
import { initLevelSystem } from '../../utils/initLevelSystem';
import * as levelAdapter from '../../utils/levelAdapter';
import './GamePage.css';

// Iconos para los botones
const ICONS = {
  RESTART: '🔄',
  PAUSE: '⏸️',
  PLAY: '▶️',
  HINT: '💡',
  DARK_MODE: '🌙',
  LIGHT_MODE: '☀️',
  SOUND_ON: '🔊',
  SOUND_OFF: '🔇',
  HOME: '🏠',
  INFO: 'ℹ️',
  SETTINGS: '⚙️'
};

const GamePage: React.FC = () => {
  const dispatch = useDispatch();
  const { 
    status, 
    level, 
    boardSize, 
    currentPlayMode, 
    currentDifficulty, 
    score, 
    timer, 
    spawnRate,
    darkMode,
    highScore
  } = useSelector((state: RootState) => state.game);
  
  // Usar GameContext para la integración con los modales
  const { 
    gameMode, 
    setGameMode, 
    gameDifficulty, 
    setGameDifficulty, 
    isSoundEnabled, 
    setIsSoundEnabled,
    isMusicEnabled,
    setIsMusicEnabled,
    gameState,
    updateGameState
  } = useGameContext();
  
  // Custom hooks para sonido y tema
  const { playSound } = useGameSound();
  const { darkMode: darkModeFromHook, toggleDarkMode: toggleDarkModeFromHook } = useDarkMode();
  
  // Renombrar la función importada para evitar conflictos
  const { 
    initializeBoard: initializeBoardFromHook, 
    stopTimers, 
    startTimers, 
    changeGameConfig,
    resetSystemsForNewLevel
  } = useGameLogic();
  
  // Referencia para controlar las inicializaciones repetidas
  const isInitializingRef = useRef<boolean>(false);
  // Track if board has been initialized
  const isBoardInitializedRef = useRef<boolean>(false);
  
  // Estado para controlar la visualización del selector de configuración
  const [showConfig, setShowConfig] = useState<boolean>(true);
  // Estado para detectar dispositivo móvil
  const [isMobile, setIsMobile] = useState<boolean>(false);
  // Estado para aplicar pantalla completa
  const [isFullscreen, setIsFullscreen] = useState<boolean>(true);
  // Estado para mostrar panel de ayuda
  const [showHelp, setShowHelp] = useState<boolean>(false);
  
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
  
  // Inicializar el tablero cuando cambie su tamaño o cuando el estado sea 'playing'
  useEffect(() => {
    if (status === 'playing' && !isBoardInitializedRef.current && !isInitializingRef.current) {
      logger.info('GamePage', `Inicializando tablero automáticamente por cambio de estado a playing`);
      initializeBoardFromHook();
    } else if (status !== 'playing' && status !== 'paused') {
      // Reiniciar el estado de inicialización cuando no estamos jugando o pausados
      isBoardInitializedRef.current = false;
    }
  }, [status, initializeBoardFromHook]);
  
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
  }, [level, boardSize, status, initializeBoardFromHook, stopTimers]);
  
  // Inicializar el sistema de niveles al cargar la aplicación
  useEffect(() => {
    // Inicializar el sistema de niveles
    const levelSystemInfo = initLevelSystem();
    logger.info('GamePage', 'Sistema de niveles inicializado', levelSystemInfo);
    
    // Resto del código de inicialización existente...
  }, []);
  
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
      console.log("\n**********************************************************");
      console.log("INICIO DEL FLUJO: PAUSAR JUEGO");
      console.log(`Nivel: ${level}, Modo: ${currentPlayMode}`);
      console.log("**********************************************************");
      
      dispatch(setGameStatus('paused'));
      console.log("Fase 1: Estado cambiado a 'paused'");
      
      stopTimers();
      console.log("Fase 2: Temporizadores detenidos");
      
      console.log("**********************************************************\n");
      console.log("FIN DEL FLUJO: JUEGO PAUSADO CORRECTAMENTE");
    } else if (status === 'paused') {
      console.log("\n**********************************************************");
      console.log("INICIO DEL FLUJO: REANUDAR JUEGO");
      console.log(`Nivel: ${level}, Modo: ${currentPlayMode}`);
      console.log("**********************************************************");
      
      dispatch(setGameStatus('playing'));
      console.log("Fase 1: Estado cambiado a 'playing'");
      
      startTimers(true);
      console.log("Fase 2: Temporizadores iniciados (forzado)");
      
      console.log("**********************************************************\n");
      console.log("FIN DEL FLUJO: JUEGO REANUDADO CORRECTAMENTE");
    }
  };

  const handleRestartClick = () => {
    console.log("\n**********************************************************");
    console.log("INICIO DEL FLUJO: REINICIAR JUEGO");
    console.log(`Nivel actual: ${level}, Modo: ${currentPlayMode}`);
    console.log("**********************************************************");
    
    // IMPORTANTE: Prevenimos múltiples llamadas
    if (isInitializingRef.current) {
      console.log("ADVERTENCIA: Ya hay una inicialización en progreso, ignorando solicitud");
      console.log("**********************************************************\n");
      return;
    }
    
    // Marcar que estamos en proceso de inicialización
    isInitializingRef.current = true;
    
    // Limpiar referencias
    isBoardInitializedRef.current = false;
    
    // Detener temporizadores
    stopTimers();
    console.log("Fase 1: Temporizadores detenidos");
    
    try {
      // Restaurar al nivel 1 para un nuevo juego
      dispatch(resetGame());
      
      // Esperar a que el resetGame se procese
      setTimeout(() => {
        // Usar la configuración centralizada para iconos del nivel 1
        const level1Icons = config.getIconSetForLevel(1);
        dispatch(setAvailableIcons(level1Icons));
        
        console.log(`Fase 2: Juego reiniciado con iconos: ${level1Icons.join(', ')}`);
        
        // Volver a la pantalla inicial
        dispatch(setGameStatus('startScreen'));
        console.log("Fase 3: Estado cambiado a 'startScreen'");
        
        logger.info('GamePage', 'Juego reiniciado, volviendo a la pantalla de inicio');
        console.log("**********************************************************\n");
        console.log("FIN DEL FLUJO: JUEGO REINICIADO CORRECTAMENTE");
        
        // Limpiar la referencia de inicialización
        isInitializingRef.current = false;
      }, 100);
    } catch (error) {
      console.error("Error al reiniciar el juego:", error);
      isInitializingRef.current = false;
      logger.error('GamePage', 'Error al reiniciar el juego', error);
    }
  };

  const handleStartGame = () => {
    console.log("\n**********************************************************");
    console.log("INICIO DEL FLUJO: INICIAR JUEGO NUEVO");
    console.log(`Nivel: ${level}, Modo: ${currentPlayMode}, Dificultad: ${currentDifficulty}`);
    console.log("**********************************************************");
    
    // IMPORTANTE: Prevenimos múltiples llamadas
    if (isInitializingRef.current) {
      console.log("ADVERTENCIA: Ya hay una inicialización en progreso, ignorando solicitud");
      console.log("**********************************************************\n");
      return;
    }
    
    // Marcar que estamos en proceso de inicialización
    isInitializingRef.current = true;
    
    // Limpiar referencias
    isBoardInitializedRef.current = false;
    
    // Limpiar temporizadores
    stopTimers();
    
    try {
      // Asegurarnos que estamos en nivel 1
      if (level !== 1) {
        dispatch(setLevel(1));
      }
      
      // Actualizar los iconos disponibles para el nivel 1 desde la configuración centralizada
      const level1Icons = config.getIconSetForLevel(1);
      dispatch(setAvailableIcons(level1Icons));
      console.log(`Iconos para nivel 1: ${level1Icons.join(', ')}`);
      
      // Esperar un breve momento antes de iniciar
      setTimeout(() => {
        logger.info('GamePage', 'Iniciando juego...');
        console.log("Fase 1: Iniciando tablero...");
        
        // Primero, inicializar el tablero
        const newBoard = initializeBoardFromHook();
        if (!newBoard || !newBoard.length) {
          console.log("ADVERTENCIA: El tablero no se inicializó correctamente");
        } else {
          let iconCount = 0;
          newBoard.forEach(row => {
            row.forEach(cell => {
              if (cell !== null) iconCount++;
            });
          });
          console.log(`Tablero inicializado con ${iconCount} iconos`);
        }
        
        // Luego cambiar el estado
        dispatch(setGameStatus('playing'));
        console.log("Fase 2: Estado cambiado a 'playing'");
        
        // Esperar a que se complete la inicialización para iniciar los temporizadores
        setTimeout(() => {
          if (!isBoardInitializedRef.current) {
            isBoardInitializedRef.current = true;
          }
          
          // Iniciar temporizadores explícitamente forzando reinicio
          logger.info('GamePage', 'Iniciando temporizadores explícitamente después de inicializar el juego (forzado)');
          startTimers(true);
          console.log("Fase 3: Temporizadores iniciados (forzado)");
          
          // Reproducir sonido de inicio
          audioManager.play('startLevel');
          
          logger.info('GamePage', 'Juego iniciado');
          console.log("**********************************************************\n");
          console.log("FIN DEL FLUJO: JUEGO INICIADO CORRECTAMENTE");
          
          // Limpiar referencia de inicialización
          isInitializingRef.current = false;
        }, 100);
      }, 100);
    } catch (error) {
      console.error("Error al iniciar el juego:", error);
      isInitializingRef.current = false;
      logger.error('GamePage', 'Error al iniciar el juego', error);
    }
  };

  const handleNextLevel = () => {
    console.log("\n**********************************************************");
    console.log("INICIO DEL FLUJO: AVANZAR AL SIGUIENTE NIVEL");
    console.log(`Nivel actual: ${level}, Nivel destino: ${level + 1}`);
    console.log(`Modo: ${currentPlayMode}, Dificultad: ${currentDifficulty}`);
    console.log("**********************************************************");
    
    // Calcular el próximo nivel
    const nextLevel = level + 1;
    
    // IMPORTANTE: PREVENIMOS MÚLTIPLES LLAMADAS
    if (isInitializingRef.current) {
      console.log("ADVERTENCIA: Ya hay una transición de nivel en progreso, ignorando solicitud");
      console.log("**********************************************************\n");
      return;
    }
    
    // Marcar que estamos en proceso de inicialización
    isInitializingRef.current = true;
    
    // Paso 1: Primero pausar el juego y asegurar que estamos en un estado controlado
    dispatch(setGameStatus('paused'));
    console.log("Fase 1: Estado cambiado a 'paused' para preparar transición");
    
    // Paso 2: Reiniciar todos los sistemas del juego (esto establece el período de gracia)
    resetSystemsForNewLevel();
    console.log("Fase 2: Sistemas de juego reiniciados completamente");
    
    // Paso 3: Asegurar que los temporizadores estén detenidos
    stopTimers();
    console.log("Fase 3: Temporizadores detenidos");
    
    // Obtener configuración para el siguiente nivel
    const nextLevelInfo = levelAdapter.getNextLevelDisplay(
      level,
      currentPlayMode,
      currentDifficulty
    );
    console.log(`Fase 4: Configuración para nivel ${nextLevel} generada`);
    
    logger.info('GamePage', `Avanzando al nivel ${nextLevel}`, nextLevelInfo);
    
    // Preparar para inicialización
    isBoardInitializedRef.current = false;
    console.log("Fase 5: Referencias de inicialización preparadas");
    
    // SECUENCIA DE INICIALIZACIÓN CON MAYOR TIEMPO DE ESPERA
    // Usamos setTimeout para garantizar que las acciones se ejecuten en secuencia y con tiempo suficiente
    setTimeout(() => {
      // Paso 4: Actualizar el nivel en el store (esto también actualiza los iconos disponibles)
      dispatch(setLevel(nextLevel));
      console.log(`Fase 6: Nivel actualizado a ${nextLevel}`);
      
      // Esperar más tiempo antes de continuar para asegurar que el cambio de nivel se procese completamente
      setTimeout(() => {
        try {
          // Verificar estado actual
          const stateBeforeInit = store.getState().game;
          if (stateBeforeInit.level !== nextLevel) {
            console.log(`ADVERTENCIA: El nivel en el store (${stateBeforeInit.level}) no coincide con el esperado (${nextLevel})`);
            dispatch(setLevel(nextLevel));
          }
          
          // Paso 5: Inicializar el tablero para el nuevo nivel - siempre obtiene el estado más reciente del store
          const newBoard = initializeBoardFromHook();
          if (!newBoard || !newBoard.length) {
            console.log("ADVERTENCIA: El tablero no se inicializó correctamente para el nivel " + nextLevel);
          } else {
            let iconCount = 0;
            newBoard.forEach(row => {
              row.forEach(cell => {
                if (cell !== null) iconCount++;
              });
            });
            console.log(`Tablero inicializado con ${iconCount} iconos para el nivel ${nextLevel}`);
          }
          console.log("Fase 7: Tablero inicializado para el nuevo nivel");
          
          // Esperar más tiempo para asegurar que la inicialización del tablero se complete
          setTimeout(() => {
            // Verificar el estado del store nuevamente
            const currentState = store.getState().game;
            console.log(`Fase 8: Verificando estado antes de iniciar nivel ${nextLevel}`);
            console.log(`Estado actual: nivel=${currentState.level}, modo=${currentState.currentPlayMode}, tablero inicializado=${isBoardInitializedRef.current}`);
            
            // Si por alguna razón el nivel no se actualizó, intentar corregirlo
            if (currentState.level !== nextLevel) {
              console.log(`ERROR: El nivel en el store (${currentState.level}) no coincide con el esperado (${nextLevel})`);
              dispatch(setLevel(nextLevel));
              
              // Dar un poco más de tiempo para que se actualice el nivel
              setTimeout(() => {
                dispatch(setGameStatus('playing'));
              }, 300);
              return;
            }
            
            // Ahora cambiar a estado "playing" con un retraso adicional
            setTimeout(() => {
              // Paso 7: Cambiar a estado "playing"
              dispatch(setGameStatus('playing'));
              console.log("Fase 9: Estado cambiado a 'playing'");
              
              // Dar un tiempo adicional antes de iniciar los temporizadores
              setTimeout(() => {
                // Comprobar el estado actual
                const finalState = store.getState().game;
                
                // Si por alguna razón el estado cambió a algo distinto de "playing", corregirlo
                if (finalState.status !== 'playing') {
                  console.log(`ADVERTENCIA: Estado inesperado (${finalState.status}) antes de iniciar temporizadores`);
                  dispatch(setGameStatus('playing'));
                  
                  // Dar un poco más de tiempo para que se actualice el estado
                  setTimeout(() => {
                    startTimers(true);
                  }, 300);
                  return;
                }
                
                // Verificar nivel una vez más
                if (finalState.level !== nextLevel) {
                  console.log(`ADVERTENCIA: Corrigiendo nivel a ${nextLevel} antes de iniciar temporizadores`);
                  dispatch(setLevel(nextLevel));
                  // Dar un poco más de tiempo para que se actualice el nivel
                  setTimeout(() => {
                    startTimers(true);
                  }, 300);
                  return;
                }
                
                // Iniciar temporizadores con reinicio forzado
                startTimers(true);
                console.log("Fase 10: Temporizadores iniciados (forzado)");
                
                // Reproducir sonido de inicio de nivel
                audioManager.play('startLevel');
                
                // Marcar que ya hemos terminado de inicializar
                isInitializingRef.current = false;
                
                // Log final para depuración
                const gameState = store.getState().game;
                logger.info('GamePage', `Nivel ${nextLevel} inicializado con éxito. SpawnRate: ${gameState.spawnRate}ms, Status: ${gameState.status}`);
                console.log("**********************************************************\n");
                console.log(`FIN DEL FLUJO: TRANSICIÓN AL NIVEL ${nextLevel} COMPLETADA`);
              }, 800); // Mayor tiempo de espera para iniciar temporizadores
            }, 600); // Mayor tiempo de espera para cambiar a playing
          }, 600); // Mayor tiempo de espera después de inicializar el tablero
        } catch (error) {
          console.error("Error durante la transición de nivel:", error);
          // Prevenir que el error rompa el juego - intentar recuperar
          dispatch(setGameStatus('playing'));
          startTimers(true);
          isInitializingRef.current = false;
        }
      }, 600); // Mayor tiempo de espera después de cambiar el nivel
    }, 600); // Mayor tiempo de espera inicial
  };

  // Nuevas funciones para los controles
  const toggleDarkMode = () => {
    toggleDarkModeFromHook();
    dispatch(setDarkMode(!darkMode));
  };
  
  const toggleHelp = () => {
    setShowHelp(!showHelp);
    audioManager.play('click');
  };
  
  const toggleSound = () => {
    setIsSoundEnabled(!isSoundEnabled);
    audioManager.toggleSound();
  };
  
  // Determinar las clases del contenedor principal
  const gamePageClasses = `game-page ${isFullscreen ? 'game-fullscreen' : ''} ${darkModeFromHook ? 'dark-mode' : 'light-mode'} ${status === 'playing' ? 'game-active' : ''}`;
  
  // Asegurar que no se muestre el contenido del juego cuando no estamos jugando
  useEffect(() => {
    const gamePageElement = document.querySelector('.game-page');
    
    // Si el juego está en un estado que requiere un modal, aseguramos que modal-active esté activo
    if (status === 'startScreen' || status === 'gameOver' || status === 'levelCompleted') {
      gamePageElement?.classList.add('modal-active');
    } else if (status === 'playing') {
      // Si el juego está activo, quitamos la clase modal-active
      gamePageElement?.classList.remove('modal-active');
    }
  }, [status]);

  // Inicializar el tablero
  const initializeBoard = useCallback(() => {
    // Detener cualquier inicialización en curso para evitar competencia
    if (isInitializingRef.current) {
      logger.warn('GamePage', 'Se canceló una inicialización en curso para iniciar una nueva');
      // No retornar aquí, sino continuar con la nueva inicialización
    }
    
    logger.info('GamePage', `Iniciando inicialización de tablero (nivel ${level}, modo ${currentPlayMode})`);
    
    // Marcar que estamos inicializando y reiniciar flags
    isInitializingRef.current = true;
    isBoardInitializedRef.current = false;
    
    // Detener todos los temporizadores antes de modificar el tablero
    stopTimers();
    
    // Limpiar explícitamente el estado anterior
    dispatch(setHighlightedCells([]));
    
    // Usar el sistema centralizado para configurar el tablero
    configureBoardForLevel(level);
    
    // Marcar el tablero como inicializado después de un breve retraso
    setTimeout(() => {
      isBoardInitializedRef.current = true;
      isInitializingRef.current = false;
      
      // Si el juego está en estado 'playing', iniciar temporizadores
      const currentStatus = store.getState().game.status;
      if (currentStatus === 'playing') {
        // Iniciar temporizadores con reinicio forzado
        startTimers(true);
        logger.info('GamePage', `Iniciando temporizadores con reinicio forzado (nivel ${level}, spawn ${spawnRate}ms)`);
      } else {
        logger.info('GamePage', `No se inician temporizadores, estado actual: ${currentStatus}`);
      }
      
      logger.info('GamePage', 'Tablero inicializado correctamente');
    }, 500);
  }, [dispatch, level, currentPlayMode, currentDifficulty, startTimers, stopTimers, spawnRate]);

  // Game Over
  const handleGameOver = useCallback(() => {
    console.log("\n**********************************************************");
    console.log("INICIO DEL FLUJO: GAME OVER");
    console.log(`Nivel: ${level}, Modo: ${currentPlayMode}`);
    console.log(`Puntuación: ${score}, Récord: ${highScore}`);
    console.log("**********************************************************");
    
    // Detener temporizadores
    stopTimers();
    console.log("Fase 1: Temporizadores detenidos");
    
    // Reproducir sonido de game over
    audioManager.play('gameOver');
    console.log("Fase 2: Sonido de Game Over reproducido");
    
    // Actualizar récord si es necesario
    if (score > highScore) {
      // Guardar nuevo récord en localStorage
      localStorage.setItem('highScore', score.toString());
      console.log(`Fase 3: Nuevo récord establecido: ${score} (anterior: ${highScore})`);
    } else {
      console.log("Fase 3: No se superó el récord actual");
    }
    
    // Guardar datos del juego
    localStorage.setItem('gameState', JSON.stringify(store.getState().game));
    console.log("Fase 4: Datos del juego guardados");
    
    // Mostrar modal de game over
    console.log("Fase 5: Preparando para mostrar resultados");
    
    console.log("**********************************************************\n");
    console.log("FIN DEL FLUJO: GAME OVER COMPLETADO");
  }, [dispatch, score, highScore, level, currentPlayMode, stopTimers]);

  // Completar nivel
  const handleLevelComplete = useCallback(() => {
    const { iconCount } = store.getState().game;
    
    console.log("\n**********************************************************");
    console.log("INICIO DEL FLUJO: NIVEL COMPLETADO");
    console.log(`Nivel actual: ${level}, Modo: ${currentPlayMode}`);
    console.log(`Puntuación: ${score}, Iconos en tablero: ${iconCount}`);
    console.log("**********************************************************");
    
    // Detener temporizadores
    stopTimers();
    console.log("Fase 1: Temporizadores detenidos");
    
    // Reproducir sonido de nivel completado
    audioManager.play('levelComplete');
    console.log("Fase 2: Sonido de nivel completado reproducido");
    
    console.log("Fase 3: Preparando transición al siguiente nivel");
    
    // Calcular bonificación de nivel según iconos restantes
    if (currentPlayMode === 'classic' || currentPlayMode === 'zen') {
      // Dar puntos extra por completar el nivel
      const levelBonus = Math.max(0, 100 - iconCount * 10);
      
      if (levelBonus > 0) {
        dispatch(incrementScore(levelBonus));
        console.log(`Fase 4: Bonificación por nivel: +${levelBonus} puntos`);
      } else {
        console.log("Fase 4: Sin bonificación adicional por nivel");
      }
    } else {
      console.log("Fase 4: Sin bonificación por nivel (no aplica en este modo)");
    }
    
    // Guardar datos del juego
    localStorage.setItem('gameState', JSON.stringify(store.getState().game));
    console.log("Fase 5: Datos del juego guardados");
    
    console.log("**********************************************************\n");
    console.log("FIN DEL FLUJO: NIVEL COMPLETADO CON ÉXITO");
  }, [dispatch, level, currentPlayMode, score, stopTimers]);

  return (
    <div className={`game-page ${darkModeFromHook ? 'dark-mode' : 'light-mode'}`}>
      <div className="game-container">
        {/* Selector de configuración */}
        {showConfig && (
          <div className="config-selector-container">
            <GameConfigSelector onApplyConfig={handleApplyConfig} />
          </div>
        )}
        
        {/* Sección del HUD y tablero de juego */}
        <div className="game-board-section">
          {/* GameHUD en la parte superior */}
          <GameHUD />
          
          {/* Contenedor del tablero de juego */}
          <div className="game-board-container">
            <div id="game-board">
              <GameBoard />
            </div>
          </div>
        </div>
        
        {/* Modales del juego */}
        <GameOverModal
          isVisible={status === 'gameOver'}
          onRestart={handleRestartClick}
        />
        
        <LevelCompleteModal
          isVisible={status === 'levelCompleted'}
          onContinue={handleNextLevel}
        />
        
        <StartGameModal
          isVisible={status === 'startScreen'}
          onStart={handleStartGame}
        />
      </div>
    </div>
  );
};

export default GamePage;