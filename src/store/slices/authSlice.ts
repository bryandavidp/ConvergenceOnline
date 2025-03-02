import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

export const checkAuth = createAsyncThunk('auth/checkAuth', async () => {
  const response = await axios.get('/api/auth/check');
  return response.data;
});

const authSlice = createSlice({
  name: 'auth',
  initialState: { isAuthenticated: false, user: null },
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(checkAuth.fulfilled, (state, action) => {
      state.isAuthenticated = true;
      state.user = action.payload;
    });
  },
});

export default authSlice.reducer;
