import { createSlice, PayloadAction } from '@reduxjs/toolkit';

// Enums para tipos de juego
export enum GameStatus {
  IDLE = 'idle',
  PLAYING = 'playing',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  GAME_OVER = 'gameOver'
}

export enum GamePlayMode {
  CLASSIC = 'classic',
  TIMED = 'timed',
  COMPETITIVE = 'competitive'
}

export enum GameDifficulty {
  EASY = 'easy',
  MEDIUM = 'medium',
  HARD = 'hard',
  EXPERT = 'expert'
}

// Tipos e interfaces
export interface Cell {
  id: string;
  iconId: number | null;
  row: number;
  col: number;
}

export interface GameState {
  board: Cell[][];
  boardSize: number;
  status: GameStatus;
  score: number;
  level: number;
  highlightedCells: string[];
  iconCount: number;
  hintsRemaining: number;
  currentPlayMode: GamePlayMode;
  currentDifficulty: GameDifficulty;
  spawnRate: number;
  timeRemaining: number | null;
  useLiteAnimations: boolean;
}

// Estado inicial
const initialState: GameState = {
  board: [],
  boardSize: 8, // Tamaño por defecto
  status: GameStatus.IDLE,
  score: 0,
  level: 1,
  highlightedCells: [],
  iconCount: 0,
  hintsRemaining: 3,
  currentPlayMode: GamePlayMode.CLASSIC,
  currentDifficulty: GameDifficulty.MEDIUM,
  spawnRate: 1000, // milisegundos
  timeRemaining: null,
  useLiteAnimations: false
};

// Slice de Redux
export const gameSlice = createSlice({
  name: 'game',
  initialState,
  reducers: {
    setBoard: (state, action: PayloadAction<Cell[][]>) => {
      state.board = action.payload;
    },
    setBoardSize: (state, action: PayloadAction<number>) => {
      state.boardSize = action.payload;
    },
    setGameStatus: (state, action: PayloadAction<GameStatus>) => {
      state.status = action.payload;
    },
    setScore: (state, action: PayloadAction<number>) => {
      state.score = action.payload;
    },
    incrementScore: (state, action: PayloadAction<number>) => {
      state.score += action.payload;
    },
    setLevel: (state, action: PayloadAction<number>) => {
      state.level = action.payload;
    },
    incrementLevel: (state) => {
      state.level += 1;
    },
    setHighlightedCells: (state, action: PayloadAction<string[]>) => {
      state.highlightedCells = action.payload;
    },
    setIconCount: (state, action: PayloadAction<number>) => {
      state.iconCount = action.payload;
    },
    incrementIconCount: (state, action: PayloadAction<number>) => {
      state.iconCount += action.payload;
    },
    decrementIconCount: (state, action: PayloadAction<number>) => {
      state.iconCount -= action.payload;
    },
    setHintsRemaining: (state, action: PayloadAction<number>) => {
      state.hintsRemaining = action.payload;
    },
    decrementHintsRemaining: (state) => {
      if (state.hintsRemaining > 0) {
        state.hintsRemaining -= 1;
      }
    },
    setPlayMode: (state, action: PayloadAction<GamePlayMode>) => {
      state.currentPlayMode = action.payload;
    },
    setDifficulty: (state, action: PayloadAction<GameDifficulty>) => {
      state.currentDifficulty = action.payload;
    },
    setSpawnRate: (state, action: PayloadAction<number>) => {
      state.spawnRate = action.payload;
    },
    setTimeRemaining: (state, action: PayloadAction<number | null>) => {
      state.timeRemaining = action.payload;
    },
    setAnimationMode: (state, action: PayloadAction<boolean>) => {
      state.useLiteAnimations = action.payload;
    },
    resetGame: (state) => {
      return {
        ...initialState,
        boardSize: state.boardSize,
        currentPlayMode: state.currentPlayMode,
        currentDifficulty: state.currentDifficulty,
        useLiteAnimations: state.useLiteAnimations
      };
    }
  },
});

// Exportar acciones
export const {
  setBoard,
  setBoardSize,
  setGameStatus,
  setScore,
  incrementScore,
  setLevel,
  incrementLevel,
  setHighlightedCells,
  setIconCount,
  incrementIconCount,
  decrementIconCount,
  setHintsRemaining,
  decrementHintsRemaining,
  setPlayMode,
  setDifficulty,
  setSpawnRate,
  setTimeRemaining,
  setAnimationMode,
  resetGame
} = gameSlice.actions;

// Exportar reducer
export default gameSlice.reducer; 