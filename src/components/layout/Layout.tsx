import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import './Layout.css';

const Layout: React.FC = () => {
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);

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
        <Outlet />
      </main>
      <footer className="app-footer">
        <p>© {new Date().getFullYear()} Convergence Online - Todos los derechos reservados</p>
      </footer>
    </div>
  );
};

export default Layout;
