// src/services/api/authService.ts
import api from './apiService';

export const authService = {
  login: async (credentials: { email: string; password: string }) => {
    const response = await api.post('/auth/login', credentials);
    return response.data;
  },
  
  register: async (userData: { 
    name: string; 
    email: string; 
    password: string 
  }) => {
    const response = await api.post('/auth/register', userData);
    return response.data;
  },
  
  logout: async () => {
    const response = await api.post('/auth/logout');
    return response.data;
  },
  
  getProfile: async () => {
    const response = await api.get('/auth/profile');
    return response.data;
  },
  
  checkAuth: async () => {
    const response = await api.get('/auth/check');
    return response.data;
  }
};
