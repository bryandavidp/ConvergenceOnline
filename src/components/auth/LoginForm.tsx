// src/components/auth/LoginForm.tsx
import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { login } from '../../store/slices/authSlice';
import './LoginForm.css';

const LoginForm: React.FC = () => {
  const dispatch = useDispatch();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    try {
      await dispatch(login({ email, password }));
    } catch (err) {
      setError('Error al iniciar sesión. Verifica tus credenciales.');
    }
  };
  
  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <h2>Iniciar Sesión</h2>
      
      {error && <div className="error-message">{error}</div>}
      
      <div className="form-group">
        <label htmlFor="email">Email</label>
        <input
          type="email"
          id="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      
      <div className="form-group">
        <label htmlFor="password">Contraseña</label>
        <input
          type="password"
          id="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      
      <button type="submit" className="submit-button">
        Iniciar Sesión
      </button>
      
      <div className="auth-links">
        <a href="/register">¿No tienes cuenta? Regístrate</a>
        <button 
          type="button" 
          className="google-login-button"
          onClick={() => window.location.href = '/api/auth/google'}
        >
          Iniciar sesión con Google
        </button>
      </div>
    </form>
  );
};

export default LoginForm;
