// src/pages/Home/HomePage.tsx
import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import logger from '../../utils/logger';
import './HomePage.css';

const HomePage: React.FC = () => {
  const { isAuthenticated, user } = useSelector((state: RootState) => state.auth);

  useEffect(() => {
    logger.component.mount('HomePage');
    logger.component.render('HomePage');
    logger.debug('HomePage', 'Estado de autenticación:', { isAuthenticated, user });
    
    return () => {
      logger.component.unmount('HomePage');
    };
  }, [isAuthenticated, user]);

  return (
    <div className="home-page">
      <section className="hero">
        <h1>Bienvenido a Convergence Online</h1>
        <p className="subtitle">Un juego multijugador en línea con amigos</p>
        
        {isAuthenticated ? (
          <div className="welcome-message">
            <p>¡Hola, {user?.name || 'Jugador'}! Estás listo para jugar.</p>
            <Link to="/game" className="cta-button">Ir al Juego</Link>
          </div>
        ) : (
          <div className="auth-buttons">
            <Link to="/login" className="cta-button">Iniciar Sesión</Link>
            <Link to="/register" className="secondary-button">Registrarse</Link>
          </div>
        )}
      </section>

      <section className="features">
        <h2>Características del Juego</h2>
        <div className="feature-grid">
          <div className="feature-item">
            <h3>Multijugador en Tiempo Real</h3>
            <p>Juega con amigos y otros jugadores de todo el mundo en tiempo real.</p>
          </div>
          <div className="feature-item">
            <h3>Sistema de Puntuación</h3>
            <p>Compite por los mejores puntajes y sube en la tabla de clasificación.</p>
          </div>
          <div className="feature-item">
            <h3>Chat Integrado</h3>
            <p>Comunícate con otros jugadores durante tus partidas.</p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;