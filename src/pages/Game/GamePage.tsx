import React from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';

const GamePage: React.FC = () => {
  const { user } = useSelector((state: RootState) => state.auth);

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