import React, { useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../../store';
import { logout } from '../../store/slices/authSlice';
import logger from '../../utils/logger';
import './Layout.css';

const Layout: React.FC = () => {
  const { isAuthenticated, user } = useSelector((state: RootState) => state.auth);
  const dispatch = useDispatch<AppDispatch>();
  const location = useLocation();

  useEffect(() => {
    logger.component.mount('Layout');
    logger.component.render('Layout');
    logger.debug('Layout', 'Estado de autenticación:', { isAuthenticated, user });
    
    // Asegurarnos de que el scroll funciona normalmente en el Layout
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.height = '';
    document.body.style.width = '';
    
    // Marcar que estamos fuera de la página del juego
    document.body.classList.remove('in-game-page');
    
    return () => {
      logger.component.unmount('Layout');
      
      // Al desmontar, limpiar cualquier estilo que hayamos añadido
      // No resetear aquí overflow y position, ya que la próxima ruta podría necesitar configurar sus propios valores
    };
  }, [isAuthenticated, user]);

  useEffect(() => {
    logger.info('Layout', 'Ruta cambiada', { pathname: location.pathname });
    
    // Asegurarnos de que el scroll vuelve arriba en cada cambio de ruta
    window.scrollTo(0, 0);
  }, [location.pathname]);

  const handleLogout = async () => {
    logger.info('Layout', 'Iniciando logout');
    try {
      await dispatch(logout()).unwrap();
      logger.info('Layout', 'Logout exitoso');
    } catch (err) {
      logger.error('Layout', 'Error en logout', err);
    }
  };

  return (
    <div className="app-layout">
      <header className="app-header">
        <div className="logo">
          <Link to="/">Convergence Online</Link>
        </div>
        <nav className="main-nav">
          <ul>
            <li><Link to="/">Inicio</Link></li>
            {isAuthenticated ? (
              <>
                <li><Link to="/game">Juego</Link></li>
                <li><Link to="/profile">Perfil</Link></li>
                <li><button className="nav-button" onClick={handleLogout}>Cerrar Sesión</button></li>
              </>
            ) : (
              <>
                <li><Link to="/login">Iniciar Sesión</Link></li>
                <li><Link to="/register">Registrarse</Link></li>
              </>
            )}
          </ul>
        </nav>
      </header>
      <main className="app-main">
        <div className="outlet-wrapper">
          <Outlet />
        </div>
      </main>
      <footer className="app-footer">
        <p>© {new Date().getFullYear()} Convergence Online - Todos los derechos reservados</p>
      </footer>
    </div>
  );
};

export default Layout;
