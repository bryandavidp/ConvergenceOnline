import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../store';
import { loadHighScore, setGameStatus, setBoardSize } from '../../store/slices/gameSlice';
import GameBoard from '../../components/game/GameBoard/GameBoard';
import GameControls from '../../components/game/GameControls/GameControls';
import GameInfo from '../../components/game/GameInfo/GameInfo';
import LevelCompleteModal from '../../components/game/GameModals/LevelCompleteModal';
import GameOverModal from '../../components/game/GameModals/GameOverModal';
import { useGameLogic } from '../../hooks/useGameLogic';
import logger from '../../utils/logger';
import './GamePage.css';

const GamePage: React.FC = () => {
  const dispatch = useDispatch();
  const { user } = useSelector((state: RootState) => state.auth);
  const { status, boardSize } = useSelector((state: RootState) => state.game);
  const { initializeBoard } = useGameLogic();
  
  // Estado para controlar la visibilidad de los modales
  const [showLevelComplete, setShowLevelComplete] = useState(false);
  const [showGameOver, setShowGameOver] = useState(false);
  
  // Inicializar el juego
  useEffect(() => {
    logger.component.mount('GamePage');
    logger.component.render('GamePage');
    logger.debug('GamePage', 'Usuario actual:', user);
    
    // Cargar puntuación máxima
    dispatch(loadHighScore());
    
    // Secuencia de inicialización
    const initGame = async () => {
      try {
        // Primero, asegurarse de que el tamaño del tablero está configurado
        dispatch(setBoardSize(8));
        
        // Esperar un momento para que Redux actualice el estado
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Inicializar el tablero con ese tamaño
        initializeBoard(8);
        
        // Esperar a que se inicialice el tablero antes de cambiar el estado
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Iniciar el juego
        dispatch(setGameStatus('playing'));
        
        logger.info('GamePage', 'Juego inicializado correctamente');
      } catch (error) {
        logger.error('GamePage', 'Error al inicializar el juego', error);
      }
    };
    
    initGame();
    
    return () => {
      logger.component.unmount('GamePage');
    };
  }, [dispatch, user, initializeBoard]);
  
  // Controlar la visibilidad de los modales según el estado del juego
  useEffect(() => {
    setShowLevelComplete(status === 'levelCompleted');
    setShowGameOver(status === 'gameOver');
  }, [status]);

  return (
    <div className="game-page">
      <h1>Convergence</h1>
      <p className="game-subtitle">Un juego de lógica y estrategia</p>
      
      <GameInfo />
      
      <div className="game-container">
        <GameBoard />
      </div>
      
      <GameControls />
      
      {/* Modales */}
      <LevelCompleteModal isVisible={showLevelComplete} />
      <GameOverModal isVisible={showGameOver} />
    </div>
  );
};

export default GamePage;