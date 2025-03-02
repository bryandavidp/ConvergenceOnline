import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import userReducer from './slices/userSlice';
import { loggerMiddleware } from './middleware/loggerMiddleware';
import logger from '../utils/logger';

// Log la inicialización de la tienda
logger.info('Store', 'Inicializando la tienda Redux');

export const store = configureStore({
  reducer: {
    auth: authReducer,
    user: userReducer,
  },
  middleware: (getDefaultMiddleware) => 
    getDefaultMiddleware({
      serializableCheck: {
        // Ignorar algunas acciones no serializables si es necesario
        ignoredActions: [],
      },
    }).concat(loggerMiddleware)
});

// Log cuando la tienda ha sido configurada
logger.info('Store', 'Tienda Redux inicializada correctamente');

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;