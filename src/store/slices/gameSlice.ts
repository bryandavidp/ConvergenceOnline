import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import logger from '../../utils/logger';
import * as config from '../../utils/config';
// import { fetchGameState, updateGameState } from '../thunks/gameThunks';

// Definición de tipos para los modos de juego
export type GameDifficulty = 'easy' | 'normal' | 'hard' | 'tutorial';
export type GamePlayMode = 'classic' | 'timed' | 'survival';

export interface GameState {
  score: number;
  highScore: number;
  level: number;
  timer: number;
  board: (string | null)[][];
  status: 'idle' | 'playing' | 'paused' | 'levelCompleted' | 'gameOver' | 'startScreen';
  error: string | null;
  spawnRate: number;
  iconCount: number;
  currentDifficulty: GameDifficulty;
  currentPlayMode: GamePlayMode;
  boardSize: number;
  availableIcons: string[];
  hintsRemaining: number;
  hintCooldown: boolean;
  lastHintTime: number;
  canEmptyBoardBonus: boolean;
  speedMultiplier: number;
  highlightedCells: {row: number, col: number}[];
  // Nuevas propiedades para los modos de juego
  // Modo contrarreloj
  timeRemaining: number; // Tiempo restante en segundos para el modo contrarreloj
  levelTimeLimit: number; // Tiempo límite para el nivel actual en modo contrarreloj
  // Modo supervivencia
  survivalTime: number; // Tiempo transcurrido en modo supervivencia
  specialIconsEnabled: boolean; // Si los iconos especiales están habilitados en modo supervivencia
  // Objetivos por nivel
  levelScoreTarget: number; // Puntuación objetivo para pasar de nivel en modo clásico
  levelOccupationTarget: number; // Porcentaje de ocupación objetivo para el nivel en modo clásico
}

const initialState: GameState = {
  score: 0,
  highScore: 0,
  level: 1,
  timer: 0,
  board: [],
  status: 'startScreen',
  error: null,
  spawnRate: 3000, // Tiempo entre generación de iconos en ms
  iconCount: 0,
  currentDifficulty: 'normal',
  currentPlayMode: 'classic',
  boardSize: 8,
  availableIcons: ["🍎", "🍇", "🍊", "🍓"],
  hintsRemaining: 3,
  hintCooldown: false,
  lastHintTime: 0,
  canEmptyBoardBonus: true,
  speedMultiplier: 1,
  highlightedCells: [],
  // Valores iniciales para las nuevas propiedades
  timeRemaining: config.BASE_GAME_DURATION, // 3 minutos por defecto
  levelTimeLimit: config.BASE_GAME_DURATION,
  survivalTime: 0,
  specialIconsEnabled: false,
  levelScoreTarget: 1000, // Puntuación objetivo inicial
  levelOccupationTarget: 70, // Porcentaje de ocupación objetivo inicial
};

const gameSlice = createSlice({
  name: 'game',
  initialState,
  reducers: {
    incrementScore: (state, action: PayloadAction<number>) => {
      state.score += action.payload;
      if (state.score > state.highScore) {
        state.highScore = state.score;
        // Guardar puntuación máxima en localStorage
        localStorage.setItem('highScore', state.highScore.toString());
      }
      logger.info('Game', `Puntuación incrementada en ${action.payload}`, { score: state.score });
    },
    
    updateBoard: (state, action: PayloadAction<(string | null)[][]>) => {
      state.board = action.payload;
      logger.debug('Game', 'Tablero actualizado');
      
      // Verificar si el tablero está vacío para la bonificación
      if (state.canEmptyBoardBonus) {
        let isEmpty = true;
        for (let i = 0; i < state.boardSize; i++) {
          for (let j = 0; j < state.boardSize; j++) {
            if (state.board[i][j] !== null) {
              isEmpty = false;
              break;
            }
          }
          if (!isEmpty) break;
        }
        
        // Si el tablero está vacío, dar la bonificación
        if (isEmpty && state.iconCount === 0) {
          state.score += config.SCORE_VALUES.EMPTY_BOARD_BONUS;
          state.canEmptyBoardBonus = false; // Solo una vez por nivel
          logger.info('Game', `¡Bonificación de tablero vacío! +${config.SCORE_VALUES.EMPTY_BOARD_BONUS} puntos`);
        }
      }
    },
    
    setBoardSize: (state, action: PayloadAction<number>) => {
      state.boardSize = action.payload;
      logger.info('Game', `Tamaño del tablero actualizado a ${action.payload}x${action.payload}`);
    },
    
    setIconCount: (state, action: PayloadAction<number>) => {
      state.iconCount = action.payload;
      logger.debug('Game', `Contador de iconos actualizado a ${action.payload}`);
    },
    
    setAvailableIcons: (state, action: PayloadAction<string[]>) => {
      state.availableIcons = action.payload;
      logger.info('Game', 'Iconos disponibles actualizados', { icons: action.payload });
    },
    
    setLevel: (state, action: PayloadAction<number>) => {
      const newLevel = action.payload;
      const prevLevel = state.level;
      
      state.level = newLevel;
      
      // Si avanzamos de nivel, reiniciar las bonificaciones y pistas
      if (newLevel > prevLevel) {
        state.canEmptyBoardBonus = true;
        state.hintsRemaining = config.HINT_SYSTEM.MAX_HINTS_PER_LEVEL;
      }
      
      logger.info('Game', `Nivel establecido a ${action.payload}`);
    },
    
    incrementTimer: (state) => {
      state.timer += 1;
      
      // En modo supervivencia, también incrementamos el tiempo de supervivencia
      if (state.currentPlayMode === 'survival' && state.status === 'playing') {
        state.survivalTime += 1;
      }
    },
    
    decrementTimeRemaining: (state) => {
      // Solo aplica para el modo contrarreloj
      if (state.currentPlayMode === 'timed' && state.status === 'playing') {
        if (state.timeRemaining > 0) {
          state.timeRemaining -= 1;
          
          // Verificar si se agotó el tiempo
          if (state.timeRemaining === 0) {
            state.status = 'gameOver';
            logger.info('Game', 'Tiempo agotado en modo contrarreloj');
          }
        }
      }
    },
    
    setLevelTimeLimit: (state, action: PayloadAction<number>) => {
      state.levelTimeLimit = action.payload;
      state.timeRemaining = action.payload;
      logger.info('Game', `Tiempo límite del nivel establecido a ${action.payload} segundos`);
    },
    
    addTimeBonus: (state, action: PayloadAction<number>) => {
      // Solo aplica para el modo contrarreloj
      if (state.currentPlayMode === 'timed') {
        state.timeRemaining += action.payload;
        logger.info('Game', `Bonificación de tiempo: +${action.payload} segundos`);
      }
    },
    
    setLevelTarget: (state, action: PayloadAction<{ score?: number, occupation?: number }>) => {
      if (action.payload.score !== undefined) {
        state.levelScoreTarget = action.payload.score;
      }
      
      if (action.payload.occupation !== undefined) {
        state.levelOccupationTarget = action.payload.occupation;
      }
      
      logger.info('Game', 'Objetivos de nivel actualizados', {
        puntuación: state.levelScoreTarget,
        ocupación: state.levelOccupationTarget
      });
    },
    
    setSpawnRate: (state, action: PayloadAction<number>) => {
      state.spawnRate = action.payload;
      // Actualizar el multiplicador de velocidad
      const baseSpeed = config.SPAWN_RATES.MEDIUM;
      state.speedMultiplier = parseFloat((baseSpeed / action.payload).toFixed(1));
      logger.info('Game', `Velocidad de aparición ajustada a ${action.payload}ms (${state.speedMultiplier}x)`);
    },
    
    increaseSpeed: (state, action: PayloadAction<number>) => {
      // Incrementar velocidad (disminuir el tiempo entre apariciones)
      const speedIncrease = action.payload || 0.1;
      const minRate = 200; // No permitir velocidades demasiado rápidas
      const currentRate = state.spawnRate;
      
      // Calcular nueva velocidad
      const newRate = Math.max(minRate, Math.round(currentRate / (1 + speedIncrease)));
      
      state.spawnRate = newRate;
      
      // Actualizar el multiplicador de velocidad
      const baseSpeed = config.SPAWN_RATES.MEDIUM;
      state.speedMultiplier = parseFloat((baseSpeed / newRate).toFixed(1));
      
      logger.info('Game', `Velocidad incrementada a ${state.speedMultiplier}x (${newRate}ms)`);
    },
    
    setGameStatus: (state, action: PayloadAction<GameState['status']>) => {
      const prevStatus = state.status;
      state.status = action.payload;
      
      // Limpiar las celdas resaltadas al cambiar estado
      if (action.payload !== 'playing') {
        state.highlightedCells = [];
      }
      
      logger.info('Game', `Estado del juego cambiado de ${prevStatus} a ${action.payload}`);
    },
    
    setGameMode: (state, action: PayloadAction<GameState['currentDifficulty']>) => {
      state.currentDifficulty = action.payload;
      logger.info('Game', `Dificultad de juego establecida a ${action.payload}`);
    },
    
    setPlayMode: (state, action: PayloadAction<GameState['currentPlayMode']>) => {
      state.currentPlayMode = action.payload;
      
      // Configurar propiedades específicas según el modo de juego
      switch (action.payload) {
        case 'classic':
          state.boardSize = 5; // Tamaño inicial para el modo clásico
          state.spawnRate = config.SPAWN_RATES.SLOW;
          state.levelScoreTarget = 1000 * state.level;
          state.levelOccupationTarget = Math.max(30, 70 - (state.level * 3)); // Disminuye con los niveles
          break;
        case 'timed':
          state.boardSize = 7; // Tamaño fijo para el modo contrarreloj
          state.spawnRate = config.SPAWN_RATES.MEDIUM;
          state.timeRemaining = config.BASE_GAME_DURATION;
          state.levelTimeLimit = config.BASE_GAME_DURATION;
          break;
        case 'survival':
          state.boardSize = 10; // Tamaño grande fijo para supervivencia
          state.spawnRate = config.SPAWN_RATES.VERY_SLOW; // Comienza lento
          state.specialIconsEnabled = true;
          state.survivalTime = 0;
          break;
      }
      
      logger.info('Game', `Modo de juego establecido a ${action.payload}`, {
        boardSize: state.boardSize,
        spawnRate: state.spawnRate,
        timeRemaining: state.timeRemaining
      });
    },
    
    useHint: (state) => {
      if (state.hintsRemaining > 0 && !state.hintCooldown) {
        state.hintsRemaining -= 1;
        state.hintCooldown = true;
        state.lastHintTime = Date.now();
        logger.info('Game', `Pista utilizada. Quedan ${state.hintsRemaining} pistas`);
      } else {
        logger.info('Game', 'No se pueden usar más pistas o está en espera');
      }
    },
    
    rechargeHint: (state) => {
      if (state.hintsRemaining < config.HINT_SYSTEM.MAX_HINTS_PER_LEVEL) {
        state.hintsRemaining += 1;
        logger.info('Game', `Pista recargada. Ahora hay ${state.hintsRemaining} pistas disponibles`);
      }
    },
    
    resetHintCooldown: (state) => {
      state.hintCooldown = false;
    },
    
    setHighlightedCells: (state, action: PayloadAction<{row: number, col: number}[]>) => {
      state.highlightedCells = action.payload;
    },
    
    resetGame: (state, action: PayloadAction<{ difficulty?: GameState['currentDifficulty'], playMode?: GameState['currentPlayMode'] } | undefined>) => {
      const difficulty = action.payload?.difficulty || state.currentDifficulty;
      const playMode = action.payload?.playMode || state.currentPlayMode;
      
      // Conservar la puntuación máxima
      const highScore = state.highScore;
      
      // Restablecer el estado
      Object.assign(state, {
        ...initialState,
        highScore,
        currentDifficulty: difficulty,
        currentPlayMode: playMode,
        status: 'playing',
        hintsRemaining: config.HINT_SYSTEM.MAX_HINTS_PER_LEVEL,
        canEmptyBoardBonus: true
      });
      
      // Configurar propiedades específicas según el modo de juego
      switch (playMode) {
        case 'classic':
          state.boardSize = 5; // Tamaño inicial para el modo clásico
          state.spawnRate = config.SPAWN_RATES.SLOW;
          state.levelScoreTarget = 1000;
          state.levelOccupationTarget = 70;
          break;
        case 'timed':
          state.boardSize = 7; // Tamaño fijo para el modo contrarreloj
          state.spawnRate = config.SPAWN_RATES.MEDIUM;
          state.timeRemaining = config.BASE_GAME_DURATION;
          state.levelTimeLimit = config.BASE_GAME_DURATION;
          break;
        case 'survival':
          state.boardSize = 10; // Tamaño grande fijo para supervivencia
          state.spawnRate = config.SPAWN_RATES.VERY_SLOW; // Comienza lento
          state.specialIconsEnabled = true;
          break;
      }
      
      logger.info('Game', `Juego reiniciado en modo ${playMode}, dificultad ${difficulty}`);
    },
    
    loadHighScore: (state) => {
      const savedHighScore = localStorage.getItem('highScore');
      if (savedHighScore) {
        state.highScore = parseInt(savedHighScore, 10);
        logger.info('Game', `Puntuación máxima cargada: ${state.highScore}`);
      }
    }
  }
});

/* const gameSlice = createSlice({
  name: 'game',
  initialState,
  reducers: {
    incrementScore: (state, action: PayloadAction<number>) => {
      state.score += action.payload;
    },
    updateBoard: (state, action: PayloadAction<(string | null)[][]>) => {
      state.board = action.payload;
    },
    setLevel: (state, action: PayloadAction<number>) => {
      state.level = action.payload;
    },
    incrementTimer: (state) => {
      state.timer += 1;
    },
    setGameStatus: (state, action: PayloadAction<GameState['status']>) => {
      state.status = action.payload;
    },
    resetGame: (state) => {
      state.score = 0;
      state.level = 1;
      state.timer = 0;
      state.status = 'idle';
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchGameState.pending, (state) => {
        state.status = 'idle';
      })
      .addCase(fetchGameState.fulfilled, (state, action) => {
        return { ...state, ...action.payload };
      })
      .addCase(fetchGameState.rejected, (state, action) => {
        state.error = action.error.message || 'Error al cargar el juego';
      });
  }
}); */

export const { 
  incrementScore, 
  updateBoard,
  setBoardSize,
  setIconCount, 
  setAvailableIcons,
  setLevel, 
  incrementTimer,
  decrementTimeRemaining,
  setSpawnRate,
  increaseSpeed,
  setGameStatus,
  setGameMode,
  setPlayMode,
  useHint,
  rechargeHint,
  resetHintCooldown,
  setHighlightedCells,
  resetGame,
  loadHighScore,
  setLevelTimeLimit,
  addTimeBonus,
  setLevelTarget
} = gameSlice.actions;

export default gameSlice.reducer;
