import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../store';
import { login } from '../../store/slices/authSlice';
import logger from '../../utils/logger';
import './LoginPage.css';

interface LocationState {
  from: {
    pathname: string;
  };
}

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch<AppDispatch>();
  const { loading, error, isAuthenticated } = useSelector((state: RootState) => state.auth);

  // Obtener la ruta de origen o usar '/' por defecto
  const from = (location.state as LocationState)?.from?.pathname || '/';

  useEffect(() => {
    logger.component.mount('LoginPage');
    logger.component.render('LoginPage');
    logger.debug('LoginPage', 'Estado inicial', { from });
    
    return () => {
      logger.component.unmount('LoginPage');
    };
  }, [from]);

  // Redireccionar si ya está autenticado
  useEffect(() => {
    if (isAuthenticated) {
      logger.info('LoginPage', 'Usuario ya autenticado, redirigiendo a', from);
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, from]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    logger.info('LoginPage', 'Intentando login', { email });
    
    try {
      await dispatch(login({ email, password })).unwrap();
      logger.info('LoginPage', 'Login exitoso, redirigiendo a', from);
      navigate(from, { replace: true });
    } catch (err) {
      logger.error('LoginPage', 'Error en login', err);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <h1>Iniciar Sesión</h1>
        
        {error && <div className="error-message">{error}</div>}
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email:</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="password">Contraseña:</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          
          <button type="submit" disabled={loading} className="login-button">
            {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;