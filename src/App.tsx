import React, { useEffect, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from './store';
import ProtectedRoute from './components/auth/ProtectedRoute';
import Layout from './components/layout/Layout';
import LoadingSpinner from './components/ui/LoadingSpiner';
import logger from './utils/logger';
import { GameProvider } from './contexts/GameContext';
import { NotificationProvider } from './components/game/GameNotifications/GameNotificationManager';
import AppInitializer from './components/ui/AppInitializer';
import './components/ui/GamePageIsolated.css';
import RouteTracker from './components/ui/RouteTracker';

// Importación lazy de componentes
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

// Componente que envuelve GamePage con GameProvider completamente aislado
const GamePageWithProviders: React.FC = () => {
  useEffect(() => {
    // Aplicar estilos al cuerpo del documento para evitar scroll
    document.body.style.overflow = 'hidden';
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    document.body.style.height = '100vh';
    
    // Script para ajustar unidades vh en móviles
    const setVhVariable = () => {
      // First we get the viewport height and we multiply it by 1% to get a value for a vh unit
      const vh = window.innerHeight * 0.01;
      // Then we set the value in the --vh custom property to the root of the document
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };
    
    // Configurar vh en carga inicial
    setVhVariable();
    
    // Configurar vh cuando cambia el tamaño de la ventana
    window.addEventListener('resize', setVhVariable);
    
    return () => {
      // Restaurar estilos al desmontar
      document.body.style.overflow = '';
      document.body.style.margin = '';
      document.body.style.padding = '';
      document.body.style.height = '';
      window.removeEventListener('resize', setVhVariable);
    };
  }, []);
  
  return (
    <div className="game-page-isolated">
      <GameProvider>
        <GamePage />
      </GameProvider>
    </div>
  );
};

// Componente para redireccionar la ruta raíz según el estado de autenticación
const RootRedirect: React.FC = () => {
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);
  
  // Si el usuario está autenticado, redireccionar a /game, de lo contrario a /login
  return <Navigate to={isAuthenticated ? "/game" : "/login"} replace />;
};

// Componente que envuelve las rutas con Layout y asegura que sean contenedores independientes
const LayoutWrapper: React.FC = () => {
  return (
    <div className="route-container">
      <Layout />
    </div>
  );
};

const App: React.FC = () => {
  useEffect(() => {
    logger.component.mount('App');
    logger.component.render('App');
    
    return () => {
      logger.component.unmount('App');
    };
  }, []);
  
  return (
    <ErrorBoundaryComponent>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <AppInitializer>
          {/* Rastreador de ruta para actualizar data-route en el body */}
          <RouteTracker />
          
          <Routes>
            {/* Redirección inteligente de la ruta raíz */}
            <Route path="/" element={<RootRedirect />} />
            
            {/* Ruta del juego completamente aislada */}
            <Route 
              path="game" 
              element={
                <div className="route-container game-route-container">
                  <NotificationProvider>
                    <Suspense fallback={<LoadingSpinner />}>
                      <ProtectedRoute>
                        <GamePageWithProviders />
                      </ProtectedRoute>
                    </Suspense>
                  </NotificationProvider>
                </div>
              } 
            />
            
            {/* Resto de rutas con Layout */}
            <Route 
              element={
                <NotificationProvider>
                  <Suspense fallback={<LoadingSpinner />}>
                    <LayoutWrapper />
                  </Suspense>
                </NotificationProvider>
              }
            >
              {/* Rutas de autenticación que redirigirán a /game si ya está autenticado */}
              <Route path="login" element={
                <ProtectedRoute requireAuth={false}>
                  <LoginPage />
                </ProtectedRoute>
              } />
              <Route path="register" element={
                <ProtectedRoute requireAuth={false}>
                  <RegisterPage />
                </ProtectedRoute>
              } />
              <Route path="profile" element={
                <ProtectedRoute>
                  <ProfilePage />
                </ProtectedRoute>
              } />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </AppInitializer>
      </BrowserRouter>
    </ErrorBoundaryComponent>
  );
};

export default App;
