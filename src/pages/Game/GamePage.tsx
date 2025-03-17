import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store';
import { store } from '../../store';
import { setGameStatus, setLevel, setDarkMode, setHighlightedCells, incrementScore, resetGame, setAvailableIcons, resetCombo } from '../../store/slices/gameSlice';
import logger from '../../utils/logger';
import useGameLogic from '../../hooks/useGameLogic';
import GameBoard from '../../components/game/GameBoard/GameBoard';
import GameHUD from '../../components/game/GameHUD/GameHUD';
import GameOverModal from '../../components/game/GameModals/GameOverModal';
import LevelCompleteModal from '../../components/game/GameModals/LevelCompleteModal';
import StartGameModal from '../../components/game/GameModals/StartGameModal';
import ModeSelectionModal from '../../components/game/GameModals/ModeSelectionModal';
import GameTutorial from '../../components/game/Tutorial/GameTutorial';
import FpsCounter from '../../components/game/FpsCounter/FpsCounter';
import { audioManager } from '../../utils/audioManager';
import * as config from '../../utils/config';
import { useGameContext } from '../../contexts/GameContext';
import { useGameSound } from '../../hooks/useGameSound';
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
import LoadingScreen from '../../components/game/LoadingScreen/LoadingScreen';

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

// Umbral de FPS para animaciones en baja calidad
const LOW_FPS_THRESHOLD = 10;

const GamePage: React.FC = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const gameComponentRef = useRef<HTMLDivElement>(null);
  const { playSound } = useGameSound();
  const { 
    status, 
    level, 
    boardSize, 
    currentPlayMode, 
    currentDifficulty,
    score,
    highScore,
    darkMode,
    timer,
    spawnRate
  } = useSelector((state: RootState) => state.game);
  
  // Estados para controlar la visualización de modales
  const [showTutorial, setShowTutorial] = useState(false);
  const [showModeSelection, setShowModeSelection] = useState(false);
  
  // Estado para controlar si se ha completado la detección de FPS
  const [fpsDetectionComplete, setFpsDetectionComplete] = useState(false);
  
  // Usar GameContext para la integración con los modales
  const { 
    gameMode, 
    setGameMode, 
    gameDifficulty, 
    setGameDifficulty, 
    isSoundEnabled: soundOn,
    setIsSoundEnabled: setSoundOn,
    isMusicEnabled: musicOn,
    setIsMusicEnabled: setMusicOn,
    gameState
  } = useGameContext();
  
  // Estado local para sincronizar con el contexto
  const [isDarkMode, setIsDarkMode] = useState(darkMode);
  
  // Estado para mostrar/ocultar la configuración
  const [showConfig, setShowConfig] = useState(true);
  
  // Estado para controlar si se está en un dispositivo móvil
  const [isMobile, setIsMobile] = useState(false);
  
  // Referencias para evitar múltiples renders o efectos no deseados
  const isInitializingRef = useRef(false);
  const isBoardInitializedRef = useRef(false);
  
  // Obtener funciones del hook de lógica del juego
  const { stopTimers, startTimers, initializeBoard } = useGameLogic();
  
  // Referencia para la detección de FPS
  const fpsDetectionRef = useRef({
    isRunning: false,
    frameCount: 0,
    startTime: 0,
    samples: [] as number[],
    hasDecided: false
  });
  
  // Hook para el modo oscuro
  const { toggleDarkMode: themeToggle } = useDarkMode();
  
  // Aplicar modo de animaciones según FPS detectados
  const applyAnimationMode = useCallback((lite: boolean) => {
    // Añadir clase a nivel de documento para que otros componentes respondan
    if (lite) {
      document.documentElement.classList.add("lite-animations");
      document.documentElement.classList.add("performance-mode");
      logger.info('GamePage', 'Modo de animaciones ligeras activado por FPS bajos');
    } else {
      document.documentElement.classList.remove("lite-animations");
      document.documentElement.classList.remove("performance-mode");
      logger.info('GamePage', 'Modo de animaciones completas activado');
    }
  }, []);
  
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
  
  // Efecto para configurar el estado inicial del juego 
  // solo se ejecuta una vez al montar el componente
  useEffect(() => {
    // Solo cambiar a 'startScreen' si la carga inicial no está en progreso
    if (status === 'idle' && fpsDetectionComplete) {
      dispatch(setGameStatus('startScreen'));
    }
  }, [fpsDetectionComplete, dispatch, status]);
  
  // Efecto para mostrar/ocultar la configuración según el estado del juego
  useEffect(() => {
    // Mostrar el selector de configuración en la pantalla de inicio
    if (status === 'startScreen' || status === 'paused' || status === 'gameOver' || status === 'levelCompleted') {
      setShowConfig(true);
    } else {
      setShowConfig(false);
    }
  }, [status]);
  
  // Ajustar el tamaño del tablero cuando cambia la ventana
  useEffect(() => {
    const handleResize = () => {
      // Solo ajustar visuales si el tablero está renderizado
      const boardElement = document.getElementById('game-board');
      if (boardElement && isBoardInitializedRef.current) {
        // Pasar el elemento del boardElement en lugar de boardSize
        const boardContainer = boardElement.parentElement as HTMLElement;
        if (boardContainer) {
          adjustBoardVisuals(boardContainer, boardElement);
        }
      }
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [boardSize, isMobile]);
  
  // Sincronizar el modo oscuro
  useEffect(() => {
    setIsDarkMode(darkMode);
  }, [darkMode]);
  
  // Evitar que el usuario haga zoom en dispositivos móviles para una mejor experiencia
  useEffect(() => {
    // Agregar meta tag para evitar zoom en móviles
    const viewportMeta = document.createElement('meta');
    viewportMeta.name = 'viewport';
    viewportMeta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
    document.head.appendChild(viewportMeta);
    
    // Prevenir zoom con gestos de pinch
    const preventZoom = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    };
    
    document.addEventListener('touchmove', preventZoom, { passive: false });
    
    return () => {
      // Limpiar al desmontar
      document.removeEventListener('touchmove', preventZoom);
      document.head.removeChild(viewportMeta);
    };
  }, []);
  
  // Prevenir scroll en dispositivos móviles para el área del juego
  useEffect(() => {
    const gameElement = gameComponentRef.current;
    
    if (!gameElement) return;
    
    const preventScroll = (e: TouchEvent) => {
      // Permitir scroll en los modales o elementos específicos
      let targetElement = e.target as HTMLElement;
      
      // Comprobar si estamos dentro de un elemento desplazable
      while (targetElement && targetElement !== gameElement) {
        if (targetElement.classList.contains('scrollable')) {
          return; // Permitir scroll
        }
        targetElement = targetElement.parentElement as HTMLElement;
      }
      
      e.preventDefault();
    };
    
    gameElement.addEventListener('touchmove', preventScroll, { passive: false });
    
    return () => {
      gameElement.removeEventListener('touchmove', preventScroll);
    };
  }, []);
  
  // Manejar el evento de finalización del tutorial
  const handleTutorialComplete = () => {
    setShowTutorial(false);
    dispatch(setGameStatus('playing'));
    // Otros ajustes necesarios después del tutorial
  };
  
  // Aplicar configuración seleccionada
  const handleApplyConfig = (difficulty: any, mode: any) => {
    setGameDifficulty(difficulty);
    setGameMode(mode);
  };
  
  // Manejar el botón de pausa/play
  const handlePlayPauseClick = () => {
    if (status === 'playing') {
      dispatch(setGameStatus('paused'));
      // Pausar los temporizadores
      stopTimers();
    } else if (status === 'paused') {
      dispatch(setGameStatus('playing'));
      // Otros ajustes necesarios al reanudar
    }
  };
  
  // Reiniciar el juego (usado en varias situaciones)
  const handleRestartClick = () => {
    try {
      // Limpiar referencias
      isBoardInitializedRef.current = false;
      
      // Detener temporizadores
      stopTimers();
      
      // Resetear el estado del juego
      dispatch(resetGame());
      dispatch(resetCombo());
      
      // Configurar nivel 1 (siempre empezamos desde el principio al reiniciar)
      const newBoardConfig = configureBoardForLevel(1);
      dispatch(setAvailableIcons(newBoardConfig.icons || []));
      
      // Reiniciar el juego
      dispatch(setGameStatus('playing'));
      
      // Limpiar la selección actual si existe
      dispatch(setHighlightedCells([]));
      
      // SOLUCIÓN: Inicializar el tablero con los iconos iniciales
      console.log("Fase 4: Inicializando tablero para el nuevo juego");
      initializeBoard(boardSize, true, 1);
      
      // SOLUCIÓN: Iniciar los temporizadores
      console.log("Fase 5: Iniciando temporizadores para el nuevo juego");
      setTimeout(() => {
        // Usar un pequeño retraso para asegurar que el tablero esté listo
        startTimers(true);
        console.log("Temporizadores iniciados correctamente");
      }, 100);
      
      console.log("**********************************************************");
      console.log("FIN DEL FLUJO: REINICIO DE PARTIDA COMPLETADO");
      console.log("**********************************************************\n");
      
      isInitializingRef.current = false;
    } catch (error) {
      isInitializingRef.current = false;
      logger.error('GamePage', 'Error al reiniciar el juego', error);
      console.error("Error al reiniciar el juego:", error);
    }
  };

  // Iniciar un juego nuevo
  const handleStartGame = () => {
    try {
      // Reiniciar el juego antes de iniciar uno nuevo para evitar estados residuales
      dispatch(resetGame());
      dispatch(resetCombo());
      
      // Esperar un poco antes de continuar con la inicialización
      setTimeout(() => {
        try {
          // Configurar el tablero para el nivel actual
          logger.info('GamePage', `Configurando tablero para nivel ${level}`);
          const boardConfig = configureBoardForLevel(level);
          
          // Actualizar el conjunto de iconos disponibles para el juego
          dispatch(setAvailableIcons(boardConfig.icons || []));
          
          // Inicializar el tablero con los iconos del nivel
          initializeBoard(boardConfig.size, true, level);
          
          // Cambiar el estado a 'playing' para iniciar el juego
          dispatch(setGameStatus('playing'));
          
          // IMPORTANTE: Solo iniciamos los temporizadores UNA VEZ desde aquí
          setTimeout(() => {
            if (store.getState().game.status === 'playing') {
              logger.info('GamePage', "Iniciando temporizadores para el juego");
              startTimers();
            }
          }, 100);
          
          // Marcar que la inicialización ha terminado
          isInitializingRef.current = false;
          isBoardInitializedRef.current = true;
          
          logger.info('GamePage', "FIN DEL FLUJO: JUEGO INICIADO CORRECTAMENTE");
        } catch (error) {
          logger.error('GamePage', "Error durante la inicialización del juego", error);
          isInitializingRef.current = false;
        }
      }, 100);
    } catch (error) {
      logger.error('GamePage', "Error al iniciar el juego", error);
      isInitializingRef.current = false;
    }
  };

  // Nuevo método para volver a la pantalla de inicio de forma segura
  const handleReturnToStart = () => {
    // Detener temporizadores primero
    stopTimers();
    
    // Limpiar el estado actual
    dispatch(resetGame());
    
    // Asegurar que no hay inicializaciones pendientes
    isInitializingRef.current = false;
    isBoardInitializedRef.current = false;
    
    // Volver a la pantalla de inicio
    dispatch(setGameStatus('startScreen'));
    
    // Resetear el estado del selector de modo
    setShowModeSelection(false);
    
    logger.info('GamePage', "Volviendo a la pantalla de inicio");
  };

  // Manejar el paso al siguiente nivel
  const handleNextLevel = () => {
    // Verificamos si ya hay una inicialización en progreso
    if (isInitializingRef.current) {
      console.warn("Ya hay una inicialización en progreso, ignorando paso a siguiente nivel");
      return;
    }
    
    isInitializingRef.current = true;
    console.log("\n**********************************************************");
    console.log("INICIO DEL FLUJO: AVANZAR AL SIGUIENTE NIVEL");
    console.log(`Avanzando del nivel ${level} al nivel ${level + 1}`);
    console.log("**********************************************************");
    
    try {
      // Detener temporizadores actuales
      stopTimers();
      
      // Calcular el siguiente nivel
      const nextLevel = level + 1;
      
      // Actualizar el nivel en el estado
      dispatch(setLevel(nextLevel));
      
      // Configurar el nuevo tablero según el nivel
      const newBoardConfig = configureBoardForLevel(nextLevel);
      
      // Actualizar iconos disponibles
      dispatch(setAvailableIcons(newBoardConfig.icons || []));
      
      // Reiniciar para el nuevo nivel pero mantener puntuación
      dispatch(setGameStatus('playing'));
      
      // Limpiar la selección actual
      dispatch(setHighlightedCells([]));
      
      // SOLUCIÓN: Inicializar el tablero con los iconos iniciales
      console.log("Fase 4: Inicializando tablero para el nuevo nivel");
      initializeBoard(boardSize, true, nextLevel);
      
      // SOLUCIÓN: Iniciar los temporizadores
      console.log("Fase 5: Iniciando temporizadores para el nuevo nivel");
      setTimeout(() => {
        // Usar un pequeño retraso para asegurar que el tablero esté listo
        startTimers(true);
        console.log("Temporizadores iniciados correctamente");
      }, 100);
      
      // Reproducir sonido de nivel completado
      if (soundOn) {
        playSound('levelUp');
      }
      
      console.log("**********************************************************");
      console.log("FIN DEL FLUJO: AVANCE AL SIGUIENTE NIVEL COMPLETADO");
      console.log("**********************************************************\n");
      
      isInitializingRef.current = false;
    } catch (error) {
      isInitializingRef.current = false;
      logger.error('GamePage', 'Error al avanzar al siguiente nivel', error);
      console.error("Error al avanzar al siguiente nivel:", error);
    }
  };

  // Función para continuar jugando después de ver algún modal
  const continueToPlaying = () => {
    // Verificar que no esté en curso otra inicialización
    if (isInitializingRef.current) {
      return;
    }
    
    dispatch(setGameStatus('playing'));
  };

  // Funciones para acciones UI
  const toggleGameDarkMode = () => {
    dispatch(setDarkMode(!darkMode));
    themeToggle();
  };
  
  const toggleHelp = () => {
    setShowTutorial(!showTutorial);
  };
  
  const toggleSound = () => {
    const newSoundState = !soundOn;
    setSoundOn(newSoundState);
    
    // Usar toggleSound del audioManager
    audioManager.toggleSound();
  };
  
  const toggleSettings = () => {
    if (status === 'playing') {
      dispatch(setGameStatus('paused'));
    }
  };

  // Determinar si el tablero debe ser renderizado
  const shouldRenderBoard = status === 'playing';

  // Efecto para activar el tutorial cuando el modo cambia a tutorial
  useEffect(() => {
    if (currentPlayMode === 'tutorial' && status === 'playing') {
      console.log("Modo tutorial detectado - Activando componente de tutorial");
      setShowTutorial(true);
    }
  }, [currentPlayMode, status]);

  return (
    <div className="game-page" ref={gameComponentRef}>
      {/* FPS Counter siempre visible en todas las pantallas */}
      <FpsCounter performanceThreshold={10} />
      
      <div className="game-container">
        {/* PASO 1: Pantalla de carga - se muestra primero */}
        {!fpsDetectionComplete && (
          <LoadingScreen 
            onInitComplete={(fpsDetected, useLiteMode) => {
              logger.info('GamePage', "Inicialización completa detectada: " + fpsDetected + ", Modo Lite: " + useLiteMode);
              // Usar un pequeño retraso para evitar renderizaciones simultáneas
              setTimeout(() => {
                setFpsDetectionComplete(true);
                applyAnimationMode(useLiteMode);
                // Asegurar que el estado del juego es correcto después de la inicialización
                if (status === 'idle') {
                  dispatch(setGameStatus('startScreen'));
                }
              }, 500);
            }}
          />
        )}
        
        {/* PASOS 2-4: Contenido del juego después de la carga inicial */}
        {fpsDetectionComplete && (
          <>
            {/* PASO 4: Tablero de juego - solo se muestra durante el juego activo */}
            {shouldRenderBoard && (
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
            )}
            
            {/* Tutorial - visible solo cuando está activado */}
            {showTutorial && status === 'playing' && (
              <GameTutorial onComplete={handleTutorialComplete} />
            )}
            
            {/* PASO 2: Pantalla de inicio */}
            {status === 'startScreen' && !showModeSelection && (
              <StartGameModal
                isVisible={true}
                onPlay={() => setShowModeSelection(true)}
                onOptions={toggleGameDarkMode}
                onCredits={() => {}}
              />
            )}
            
            {/* PASO 3: Pantalla de selección de modo */}
            {status === 'startScreen' && showModeSelection && (
              <ModeSelectionModal
                isVisible={true}
                onStart={() => {
                  setShowModeSelection(false);
                  handleStartGame();
                }}
              />
            )}
            
            {/* Otros estados del juego */}
            {status === 'gameOver' && (
              <GameOverModal
                isVisible={true}
                onRestart={handleRestartClick}
                onReturnToMenu={handleReturnToStart}
              />
            )}
            
            {status === 'levelCompleted' && (
              <LevelCompleteModal
                isVisible={true}
                onContinue={handleNextLevel}
                onMainMenu={handleReturnToStart}
                onClose={() => store.dispatch(setGameStatus('playing'))}
                gameStats={{
                  score: score,
                  timeFormatted: '00:30',
                  maxCombo: 5,
                  moves: 20,
                  averageSpeed: 0.5
                }}
                levelNumber={level}
                nextLevel={level + 1}
                starsEarned={3}
                rewards={[
                  { type: 'coins', amount: 100, name: 'Monedas', icon: '🪙', rarity: 'common' },
                  { type: 'gems', amount: 20, name: 'Gemas', icon: '💎', rarity: 'uncommon' },
                  { type: 'xp', amount: 50, name: 'Experiencia', icon: '⭐', rarity: 'common' }
                ]}
              />
            )}
            
            {status === 'paused' && (
              <PauseModal
                isVisible={true}
                onResume={handlePlayPauseClick}
                onRestart={handleRestartClick}
                onExit={handleReturnToStart}
                onSettings={toggleSettings}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default GamePage; 