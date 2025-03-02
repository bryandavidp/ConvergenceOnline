import { createSlice, PayloadAction } from '@reduxjs/toolkit';
// import { fetchGameState, updateGameState } from '../thunks/gameThunks';

interface GameState {
  score: number;
  level: number;
  timer: number;
  board: (string | null)[][];
  status: 'idle' | 'playing' | 'paused' | 'levelCompleted' | 'gameOver';
  error: string | null;
}

const initialState: GameState = {
  score: 0,
  level: 1,
  timer: 0,
  board: [],
  status: 'idle',
  error: null
};

const gameSlice = {reducer: '', actions: {}} as any;

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
  setLevel, 
  incrementTimer, 
  setGameStatus, 
  resetGame 
} = gameSlice.actions;

export default gameSlice.reducer;
