import React, { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import logger from '../../utils/logger';
import './GamePage.css';

const GamePage: React.FC = () => {
  const { user } = useSelector((state: RootState) => state.auth);

  useEffect(() => {
    logger.component.mount('GamePage');
    logger.component.render('GamePage');
    logger.debug('GamePage', 'Usuario actual:', user);
    
    return () => {
      logger.component.unmount('GamePage');
    };
  }, [user]);

  return (
    <div className="game-page">
      <h1>Página del Juego</h1>
      <p>Bienvenido {user?.name || 'Jugador'}</p>
      <div className="game-container">
        <p>El juego se implementará aquí</p>
      </div>
    </div>
  );
};

export default GamePage;