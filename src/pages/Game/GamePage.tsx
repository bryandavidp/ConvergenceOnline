import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store';
import { store } from '../../store';
import { setGameStatus, setLevel, resetGame, setAvailableIcons, resetCombo } from '../../store/slices/gameSlice';
import logger from '../../utils/logger';
import useGameLogic from '../../hooks/useGameLogic';
import GameBoard from '../../components/game/GameBoard/GameBoard';
import GameHUD from '../../components/game/GameHUD/GameHUD';
import GameOverModal from '../../components/game/GameModals/GameOverModal';
import LevelCompleteModal from '../../components/game/GameModals/LevelCompleteModal';
import StartGameModal from '../../components/game/GameModals/StartGameModal';
import { audioManager } from '../../utils/audioManager';
import * as config from '../../utils/config';
import { useDarkMode } from '../../hooks/useDarkMode';
import {
  configureBoardForLevel,
  adjustBoardVisuals
} from '../../utils/boardUtils';
import { initLevelSystem } from '../../utils/initLevelSystem';
import * as levelAdapter from '../../utils/levelAdapter';
import './GamePage.css';
import PauseModal from '../../components/game/GameModals/PauseModal';
import { useNavigate } from 'react-router-dom';

const GamePage: React.FC = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const gameComponentRef = useRef<HTMLDivElement>(null);
  const { 
    status, 
    level, 
    boardSize, 
    currentPlayMode, 
    currentDifficulty,
  } = useSelector((state: RootState) => state.game);
  
/*   // Usar GameContext para la integración con los modales
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
  } = useGameContext(); */
  
  const { darkMode: darkModeFromHook, toggleDarkMode: toggleDarkModeFromHook } = useDarkMode();
  
  // Renombrar la función importada para evitar conflictos
  const { 
    initializeBoard: initializeBoardFromHook, 
    stopTimers, 
    startTimers, 
    resetSystemsForNewLevel
  } = useGameLogic();
  
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

  // Manejadores para los botones de control
  const handlePlayPauseClick = () => {
    console.log("\n**********************************************************");
    console.log("INICIO DEL FLUJO: ALTERNAR ESTADO PAUSA/JUEGO");
    console.log(`Estado actual: ${status}`);
    console.log("**********************************************************");
    
    if (status === 'playing') {
      // Pausar el juego - solo cambiamos el estado y detenemos temporizadores
      dispatch(setGameStatus('paused'));
      stopTimers();
      
      // Resetear el combo cuando se pausa el juego para evitar que se quede congelado
      dispatch(resetCombo());
      
      audioManager.play("pause");
      console.log("Juego pausado y temporizadores detenidos");
    } else if (status === 'paused') {
      // Reanudar el juego - restaurar el estado y reiniciar temporizadores
      dispatch(setGameStatus('playing'));
      
      // Aseguramos que el combo esté reseteado al reanudar
      dispatch(resetCombo());
      
      // Iniciar los temporizadores después de un breve momento
      setTimeout(() => {
        startTimers(true);
      }, 100);
      
      audioManager.play("play");
      console.log("Juego reanudado y temporizadores iniciados");
    }
    
    console.log("**********************************************************\n");
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
      
      // Resetear combos al iniciar un nuevo juego
      console.log("[COMBO] Reseteando sistema de combos al iniciar un nuevo juego");
      dispatch(resetCombo());
      
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
    
    // Paso 4: Resetear el sistema de combos para el nuevo nivel
    console.log("[COMBO] Reseteando sistema de combos para el nuevo nivel");
    dispatch(resetCombo());

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
  
  // Añadimos la función toggleSettings para mostrar/ocultar la configuración
  const toggleSettings = () => {
    // Puedes implementar esto para mostrar opciones de configuración
    // Por ahora, simplemente cerramos el modal de pausa y mostramos un mensaje
    dispatch(setGameStatus('playing'));
    console.log('Configuración de juego');
  };
  
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


  // Efecto para prevenir scroll en iOS y otros dispositivos móviles
  useEffect(() => {
    // Crear una función para manejar el evento touchmove
    const preventScroll = (e: TouchEvent) => {
      if (gameComponentRef.current && gameComponentRef.current.contains(e.target as Node)) {
        e.preventDefault();
      }
    };
    
    // Añadir listener con opciones passive: false para poder prevenir el comportamiento por defecto
    document.addEventListener('touchmove', preventScroll, { passive: false });
    
    // Deshabilitar el bouncing del scroll en iOS
    document.documentElement.style.overscrollBehavior = 'none';
    document.body.style.overscrollBehavior = 'none';
    
    // Añadir clase específica para la página del juego
    document.body.classList.add('in-game-page');
    
    return () => {
      // Limpiar al desmontar
      document.removeEventListener('touchmove', preventScroll);
      document.documentElement.style.overscrollBehavior = '';
      document.body.style.overscrollBehavior = '';
      document.body.classList.remove('in-game-page');
    };
  }, []);

  return (
    <div 
      className={`game-page ${darkModeFromHook ? 'dark-mode' : 'light-mode'}`} 
      ref={gameComponentRef}
    >
      <div className="game-container">
        
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
          stars={3}
          rewards={['monedas', 'gemas', 'vidas']}
        />
        
        <PauseModal
          // isVisible={status === 'paused'}
          onResume={handlePlayPauseClick}
          onRestart={handleRestartClick}
          onExit={() => navigate('/')}
          onSettings={toggleSettings}
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