import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import logger from '../../utils/logger';
// import { fetchGameState, updateGameState } from '../thunks/gameThunks';

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
  currentMode: 'easy' | 'normal' | 'hard' | 'tutorial';
  boardSize: number;
  availableIcons: string[];
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
  currentMode: 'normal',
  boardSize: 8,
  availableIcons: ["🍎", "🍇", "🍊", "🍓"]
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
      state.level = action.payload;
      logger.info('Game', `Nivel establecido a ${action.payload}`);
    },
    
    incrementTimer: (state) => {
      state.timer += 1;
    },
    
    setSpawnRate: (state, action: PayloadAction<number>) => {
      state.spawnRate = action.payload;
      logger.info('Game', `Velocidad de aparición ajustada a ${action.payload}ms`);
    },
    
    setGameStatus: (state, action: PayloadAction<GameState['status']>) => {
      const prevStatus = state.status;
      state.status = action.payload;
      logger.info('Game', `Estado del juego cambiado de ${prevStatus} a ${action.payload}`);
    },
    
    setGameMode: (state, action: PayloadAction<GameState['currentMode']>) => {
      state.currentMode = action.payload;
      logger.info('Game', `Modo de juego establecido a ${action.payload}`);
    },
    
    resetGame: (state, action: PayloadAction<GameState['currentMode'] | undefined>) => {
      const mode = action.payload || state.currentMode;
      
      // Conservar la puntuación máxima
      const highScore = state.highScore;
      
      // Restablecer el estado
      Object.assign(state, {
        ...initialState,
        highScore,
        currentMode: mode,
        status: 'playing'
      });
      
      logger.info('Game', `Juego reiniciado en modo ${mode}`);
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
  setSpawnRate,
  setGameStatus,
  setGameMode,
  resetGame,
  loadHighScore
} = gameSlice.actions;

export default gameSlice.reducer;
