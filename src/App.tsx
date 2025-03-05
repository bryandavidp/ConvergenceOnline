import React, { useEffect, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { AppDispatch } from './store';
import { checkAuth } from './store/slices/authSlice';
import ProtectedRoute from './components/auth/ProtectedRoute';
import Layout from './components/layout/Layout';
import LoadingSpinner from './components/ui/LoadingSpiner';
import logger from './utils/logger';

const HomePage = lazy(() => import('./pages/Home/HomePage'));
const GamePage = lazy(() => import('./pages/Game/GamePage'));
const LoginPage = lazy(() => import('./pages/Login/LoginPage'));
const RegisterPage = lazy(() => import('./pages/Register/RegisterPage'));
const ProfilePage = lazy(() => import('./pages/Profile/ProfilePage'));
const NotFoundPage = lazy(() => import('./pages/NotFound/NotFoundPage'));

class ErrorBoundaryComponent extends React.Component<{ children: React.ReactNode }> {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    logger.error('ErrorBoundary', 'Error no capturado en la aplicación', { error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <h1>Algo salió mal</h1>
          <p>Ha ocurrido un error en la aplicación. Por favor recarga la página.</p>
          <button onClick={() => window.location.reload()}>Recargar</button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Flag para evitar múltiples verificaciones de autenticación
let authCheckInitiated = false;

const App: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  
  useEffect(() => {
    logger.component.mount('App');
    logger.component.render('App'); // Mover aquí
    
    // Evitar verificaciones duplicadas de autenticación
    if (!authCheckInitiated) {
      authCheckInitiated = true;
      logger.info('App', 'Verificando estado de autenticación');
      dispatch(checkAuth());
    }
    
    return () => {
      logger.component.unmount('App');
    };
  }, [dispatch]);
  
  return (
    <ErrorBoundaryComponent>
      <BrowserRouter>
        <Suspense fallback={<LoadingSpinner />}>
          <Routes>
            {/* Ruta del juego sin Layout */}
            <Route path="game" element={
              <ProtectedRoute>
                <GamePage />
              </ProtectedRoute>
            } />
            
            {/* Resto de rutas con Layout */}
            <Route path="/" element={<Layout />}>
              <Route index element={<HomePage />} />
              <Route path="profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
              <Route path="login" element={<LoginPage />} />
              <Route path="register" element={<RegisterPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ErrorBoundaryComponent>
  );
};

export default App;
