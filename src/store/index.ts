import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import userReducer from './slices/userSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    user: userReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;


/* import { configureStore } from '@reduxjs/toolkit';
import gameReducer from './slices/gameSlice';
import authReducer from './slices/authSlice';
import chatReducer from './slices/chatSlice';
import { apiMiddleware } from './middleware/apiMiddleware';

export const store = configureStore({
  reducer: {
    game: gameReducer,
    auth: authReducer,
    chat: chatReducer
  },
  middleware: (getDefaultMiddleware) => 
    getDefaultMiddleware().concat(apiMiddleware)
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
 */