import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../store';
import { checkAuth } from '../../store/slices/authSlice';
import logger from '../../utils/logger';
import './LoadingSpiner.css';

interface AppInitializerProps {
  children: React.ReactNode;
}

// Flag para evitar múltiples verificaciones de autenticación
let authCheckInitiated = false;

const AppInitializer: React.FC<AppInitializerProps> = ({ children }) => {
  const dispatch = useDispatch<AppDispatch>();
  const [isInitialized, setIsInitialized] = useState(false);
  const { loading } = useSelector((state: RootState) => state.auth);
  
  useEffect(() => {
    const initializeAuth = async () => {
      if (!authCheckInitiated) {
        authCheckInitiated = true;
        logger.info('AppInitializer', 'Verificando estado de autenticación');
        try {
          await dispatch(checkAuth()).unwrap();
          logger.info('AppInitializer', 'Verificación de autenticación completada');
        } catch (error) {
          logger.error('AppInitializer', 'Error al verificar autenticación', error);
        }
      }
      setIsInitialized(true);
    };
    
    initializeAuth();
  }, [dispatch]);
  
  // Mostrar un indicador de carga mientras se inicializa
  if (!isInitialized || loading) {
    return (
      <div className="app-initializing">
        Convergence Online
      </div>
    );
  }
  
  return <>{children}</>;
};

export default AppInitializer; 