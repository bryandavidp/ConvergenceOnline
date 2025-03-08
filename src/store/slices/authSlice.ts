import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import logger from '../../utils/logger';

interface User {
  id: string;
  name: string;
  email: string;
}

interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  loading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  isAuthenticated: false,
  user: null,
  loading: false,
  error: null
};

export const checkAuth = createAsyncThunk<User | null>(
  'auth/checkAuth',
  async (_, { rejectWithValue }) => {
    logger.info('Auth', 'Verificando estado de autenticación');
    try {
      const user = localStorage.getItem('user');
      
      if (user) {
        const userData = JSON.parse(user) as User;
        logger.info('Auth', 'Usuario autenticado encontrado', userData);
        return userData;
      }
      
      logger.info('Auth', 'No se encontró usuario autenticado');
      return null;
    } catch (error) {
      logger.error('Auth', 'Error al verificar autenticación', error);
      return rejectWithValue(null);
    }
  }
);

export const login = createAsyncThunk<User, { email: string; password: string }>(
  'auth/login',
  async ({ email, password }, { rejectWithValue }) => {
    logger.info('Auth', 'Iniciando login', { email });
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const user: User = {
        id: '1',
        name: 'Usuario Demo',
        email
      };
      
      localStorage.setItem('user', JSON.stringify(user));
      
      logger.info('Auth', 'Login exitoso', user);
      return user;
    } catch (error) {
      logger.error('Auth', 'Error en login', error);
      return rejectWithValue('Credenciales incorrectas');
    }
  }
);

export const logout = createAsyncThunk(
  'auth/logout',
  async (_, { rejectWithValue }) => {
    logger.info('Auth', 'Cerrando sesión');
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      
      localStorage.removeItem('user');
      
      logger.info('Auth', 'Sesión cerrada exitosamente');
      return null;
    } catch (error) {
      logger.error('Auth', 'Error al cerrar sesión', error);
      return rejectWithValue('Error al cerrar sesión');
    }
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(checkAuth.pending, (state) => {
        logger.debug('Auth', 'Verificación de autenticación pendiente');
        state.loading = true;
        state.error = null;
      })
      .addCase(checkAuth.fulfilled, (state, action) => {
        logger.debug('Auth', 'Verificación de autenticación completada', action.payload);
        state.loading = false;
        state.user = action.payload;
        state.isAuthenticated = !!action.payload;
      })
      .addCase(checkAuth.rejected, (state, action) => {
        logger.debug('Auth', 'Verificación de autenticación rechazada', action.error);
        state.loading = false;
        state.error = action.error.message || 'Error de autenticación';
      });

    builder
      .addCase(login.pending, (state) => {
        logger.debug('Auth', 'Login pendiente');
        state.loading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        logger.debug('Auth', 'Login completado', action.payload);
        state.loading = false;
        state.user = action.payload;
        state.isAuthenticated = true;
      })
      .addCase(login.rejected, (state, action) => {
        logger.debug('Auth', 'Login rechazado', action.error);
        state.loading = false;
        state.error = action.error.message || 'Error de autenticación';
      });

    builder
      .addCase(logout.pending, (state) => {
        logger.debug('Auth', 'Logout pendiente');
        state.loading = true;
      })
      .addCase(logout.fulfilled, (state) => {
        logger.debug('Auth', 'Logout completado');
        state.loading = false;
        state.user = null;
        state.isAuthenticated = false;
      })
      .addCase(logout.rejected, (state, action) => {
        logger.debug('Auth', 'Logout rechazado', action.error);
        state.loading = false;
        state.error = action.error.message || 'Error al cerrar sesión';
      });
  }
});

export default authSlice.reducer;
