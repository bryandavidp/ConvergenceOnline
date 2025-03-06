import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../../store';
import {
  GameStatus,
  GamePlayMode,
  GameDifficulty,
  setGameStatus,
  setTimeRemaining,
  setBoard,
  incrementLevel,
  resetGame,
  setScore,
  setHintsRemaining
} from '../../../store/slices/gameSlice';
import {
  formatTime,
  generateBoard,
  getInitialTimeForLevel,
  getSpawnRate,
  addRandomIcon,
  isBoardFull,
  hasAvailableMoves
} from '../../../utils/gameUtils';

// Intervalo del temporizador en ms
const TIMER_INTERVAL = 1000;

const GameControls: React.FC = () => {
  const dispatch = useDispatch();
  const {
    status,
    level,
    score,
    boardSize,
    board,
    currentPlayMode,
    currentDifficulty,
    timeRemaining,
    iconCount,
    spawnRate
  } = useSelector((state: RootState) => state.game);
  
  // Referencias para los temporizadores
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const spawnTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Estado local para información del juego
  const [levelProgress, setLevelProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  
  // Iniciar el juego con un nuevo tablero
  const startGame = () => {
    setIsLoading(true);
    
    // Generar nuevo tablero
    const newBoard = generateBoard(boardSize, level);
    
    // Configurar tiempo según modo de juego
    let initialTime = null;
    if (currentPlayMode === GamePlayMode.TIMED) {
      initialTime = getInitialTimeForLevel(level, currentDifficulty);
    }
    
    // Reiniciar estado del juego
    dispatch(resetGame());
    dispatch(setBoard(newBoard));
    dispatch(setGameStatus(GameStatus.PLAYING));
    dispatch(setTimeRemaining(initialTime));
    dispatch(setHintsRemaining(3)); // 3 pistas por nivel
    
    setIsLoading(false);
  };
  
  // Pausar el juego
  const pauseGame = () => {
    if (status === GameStatus.PLAYING) {
      dispatch(setGameStatus(GameStatus.PAUSED));
      
      // Detener temporizadores
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      
      if (spawnTimerRef.current) {
        clearInterval(spawnTimerRef.current);
        spawnTimerRef.current = null;
      }
    } else if (status === GameStatus.PAUSED) {
      dispatch(setGameStatus(GameStatus.PLAYING));
      
      // Reiniciar temporizadores
      startTimers();
    }
  };
  
  // Función para avanzar al siguiente nivel
  const goToNextLevel = () => {
    dispatch(incrementLevel());
    startGame();
  };
  
  // Función para reiniciar el nivel actual
  const restartCurrentLevel = () => {
    startGame();
  };
  
  // Gestionar el temporizador en modo contrarreloj
  const handleTimedMode = () => {
    if (status !== GameStatus.PLAYING || currentPlayMode !== GamePlayMode.TIMED) {
      return;
    }
    
    if (timeRemaining !== null && timeRemaining > 0) {
      dispatch(setTimeRemaining(timeRemaining - 1));
    } else if (timeRemaining === 0) {
      // Tiempo agotado
      dispatch(setGameStatus(GameStatus.GAME_OVER));
      
      // Detener temporizadores
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };
  
  // Gestionar el modo supervivencia (spawning icons)
  const handleCompetitiveMode = () => {
    if (status !== GameStatus.PLAYING || currentPlayMode !== GamePlayMode.COMPETITIVE) {
      return;
    }
    
    // Verificar si el tablero está lleno
    if (isBoardFull(board)) {
      dispatch(setGameStatus(GameStatus.GAME_OVER));
      return;
    }
    
    // Obtener config del nivel
    const currentLevel = Math.min(10, level); // Máximo nivel 10
    const iconTypes = 4 + Math.floor(currentLevel / 2); // Incrementar tipos según nivel
    
    // Añadir icono aleatorio
    const updatedBoard = addRandomIcon(board, iconTypes);
    if (updatedBoard) {
      dispatch(setBoard(updatedBoard));
      
      // Verificar si hay movimientos disponibles
      if (!hasAvailableMoves(updatedBoard)) {
        // Dar tiempo para ver el tablero final
        setTimeout(() => {
          dispatch(setGameStatus(GameStatus.GAME_OVER));
        }, 2000);
      }
    }
  };
  
  // Iniciar o detener temporizadores según el estado del juego
  const startTimers = () => {
    // Temporizador principal (actualización cada segundo)
    if (!timerRef.current) {
      timerRef.current = setInterval(() => {
        if (currentPlayMode === GamePlayMode.TIMED) {
          handleTimedMode();
        }
      }, TIMER_INTERVAL);
    }
    
    // Temporizador para modo supervivencia
    if (currentPlayMode === GamePlayMode.COMPETITIVE && !spawnTimerRef.current) {
      const currentSpawnRate = getSpawnRate(level, currentDifficulty);
      spawnTimerRef.current = setInterval(() => {
        handleCompetitiveMode();
      }, currentSpawnRate);
    }
  };
  
  // Limpiar temporizadores al desmontar
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (spawnTimerRef.current) {
        clearInterval(spawnTimerRef.current);
      }
    };
  }, []);
  
  // Controlar inicio/pausa de temporizadores según estado del juego
  useEffect(() => {
    if (status === GameStatus.PLAYING) {
      startTimers();
    } else {
      // Detener temporizadores si no estamos jugando
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (spawnTimerRef.current) {
        clearInterval(spawnTimerRef.current);
        spawnTimerRef.current = null;
      }
    }
  }, [status, currentPlayMode]);
  
  // Controlar cambios en el nivel y recalcular temporizador para spawn
  useEffect(() => {
    if (status === GameStatus.PLAYING && currentPlayMode === GamePlayMode.COMPETITIVE) {
      // Reiniciar temporizador con nueva tasa
      if (spawnTimerRef.current) {
        clearInterval(spawnTimerRef.current);
      }
      
      const currentSpawnRate = getSpawnRate(level, currentDifficulty);
      spawnTimerRef.current = setInterval(() => {
        handleCompetitiveMode();
      }, currentSpawnRate);
    }
  }, [level, currentDifficulty, currentPlayMode]);
  
  // Verificar condiciones de victoria/derrota
  useEffect(() => {
    if (status !== GameStatus.PLAYING) return;
    
    // Victoria: no quedan iconos
    // Solo verificar victoria después de que el juego haya estado activo por al menos un segundo
    // para evitar la detección falsa cuando el tablero se está inicializando
    if (iconCount === 0 && board.length > 0 && board.some(row => row.length > 0)) {
      // Verificar si el tablero ha sido inicializado correctamente (no está vacío)
      const hasInitializedBoard = board.flat().some(cell => cell.iconId !== null);
      
      // Si es un tablero nuevo sin inicializar, ignoramos la comprobación
      if (!hasInitializedBoard) {
        console.log('El tablero aún no se ha inicializado completamente');
        return;
      }
      
      console.log('¡Nivel completado! Iconos restantes:', iconCount);
      dispatch(setGameStatus(GameStatus.COMPLETED));
    }
  }, [iconCount, status, dispatch, board]);
  
  return (
    <View style={styles.container}>
      {/* Información del juego */}
      <View style={styles.infoContainer}>
        <Text style={styles.infoText}>Nivel: {level}</Text>
        <Text style={styles.infoText}>Puntos: {score}</Text>
        {currentPlayMode === GamePlayMode.TIMED && timeRemaining !== null && (
          <Text style={[
            styles.infoText, 
            timeRemaining < 30 ? styles.warningText : null
          ]}>
            Tiempo: {formatTime(timeRemaining)}
          </Text>
        )}
      </View>
      
      {/* Controles de juego */}
      <View style={styles.controlsContainer}>
        {status === GameStatus.IDLE && (
          <TouchableOpacity 
            style={styles.button} 
            onPress={startGame}
            disabled={isLoading}
          >
            <Text style={styles.buttonText}>
              {isLoading ? 'Cargando...' : 'Iniciar Juego'}
            </Text>
          </TouchableOpacity>
        )}
        
        {(status === GameStatus.PLAYING || status === GameStatus.PAUSED) && (
          <TouchableOpacity 
            style={styles.button} 
            onPress={pauseGame}
          >
            <Text style={styles.buttonText}>
              {status === GameStatus.PAUSED ? 'Continuar' : 'Pausar'}
            </Text>
          </TouchableOpacity>
        )}
        
        {(status === GameStatus.COMPLETED || status === GameStatus.GAME_OVER) && (
          <>
            {status === GameStatus.COMPLETED && (
              <TouchableOpacity 
                style={styles.button} 
                onPress={goToNextLevel}
              >
                <Text style={styles.buttonText}>Siguiente nivel</Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity 
              style={[styles.button, styles.secondaryButton]} 
              onPress={restartCurrentLevel}
            >
              <Text style={styles.buttonText}>
                {status === GameStatus.COMPLETED 
                  ? 'Repetir nivel' 
                  : 'Reintentar'
                }
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    padding: 10,
  },
  infoContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 10,
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderRadius: 8,
    padding: 10,
  },
  infoText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  warningText: {
    color: '#f59e0b',
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  button: {
    backgroundColor: 'rgba(59, 130, 246, 0.8)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginHorizontal: 5,
  },
  secondaryButton: {
    backgroundColor: 'rgba(100, 116, 139, 0.8)',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
});

export default GameControls; 