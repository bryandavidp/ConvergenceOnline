import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import logger from '../../utils/logger';

// Definir el tipo de usuario
interface User {
  id: string;
  name: string;
  email: string;
  highScore: number;
  currentLevel: number;
}

// Estado inicial
interface UserState {
  user: User | null;
  loading: boolean;
  error: string | null;
}

const initialState: UserState = {
  user: null,
  loading: false,
  error: null
};

// Simular una llamada a la API para obtener los datos del perfil de usuario
export const fetchUserProfile = createAsyncThunk(
  'user/fetchUserProfile',
  async (_, { rejectWithValue }) => {
    try {
      logger.info('UserSlice', 'Solicitando datos del perfil de usuario');
      
      // Simulación de retraso de red
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Datos simulados del perfil
      const userData: User = {
        id: '1',
        name: 'Usuario de Prueba',
        email: 'usuario@ejemplo.com',
        highScore: 5280,
        currentLevel: 7
      };
      
      logger.info('UserSlice', 'Datos del perfil recibidos', userData);
      return userData;
    } catch (error) {
      logger.error('UserSlice', 'Error al obtener el perfil de usuario', error);
      return rejectWithValue('Error al obtener los datos del perfil. Por favor, inténtelo de nuevo.');
    }
  }
);

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    clearUserProfile: (state) => {
      logger.info('UserSlice', 'Limpiando datos del perfil de usuario');
      state.user = null;
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchUserProfile.pending, (state) => {
        logger.debug('UserSlice', 'Cargando perfil de usuario...');
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchUserProfile.fulfilled, (state, action: PayloadAction<User>) => {
        logger.debug('UserSlice', 'Perfil de usuario cargado correctamente');
        state.loading = false;
        state.user = action.payload;
      })
      .addCase(fetchUserProfile.rejected, (state, action) => {
        logger.error('UserSlice', 'Error al cargar el perfil', action.payload);
        state.loading = false;
        state.error = action.payload as string;
      });
  }
});

export const { clearUserProfile } = userSlice.actions;
export default userSlice.reducer;
