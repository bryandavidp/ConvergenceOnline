import React, { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../../store';
import { resetGame, setGameStatus } from '../../../store/slices/gameSlice';
import { audioManager } from '../../../utils/audioManager';
import logger from '../../../utils/logger';
import './GameModals.css';

interface GameOverModalProps {
  isVisible: boolean;
}

const GameOverModal: React.FC<GameOverModalProps> = ({ isVisible }) => {
  const dispatch = useDispatch();
  const { score, highScore, level, currentMode } = useSelector((state: RootState) => state.game);
  
  const handleRestart = useCallback(() => {
    logger.info('GameOverModal', 'Reiniciando juego');
    audioManager.play('start');
    dispatch(resetGame(currentMode));
  }, [dispatch, currentMode]);

  const handleGoToHome = useCallback(() => {
    logger.info('GameOverModal', 'Volviendo a la pantalla principal');
    dispatch(setGameStatus('startScreen'));
  }, [dispatch]);
  
  if (!isVisible) return null;
  
  const isNewHighScore = score === highScore && score > 0;
  
  return (
    <div className="game-modal game-over">
      <div className="modal-content">
        <h2>{isNewHighScore ? '¡Nueva Puntuación Máxima!' : 'Juego Terminado'}</h2>
        
        {isNewHighScore && (
          <div className="new-highscore">
            <span role="img" aria-label="trophy">🏆</span>
            <span>¡Felicidades!</span>
          </div>
        )}
        
        <p>Tu puntuación final: <span className="highlight">{score}</span></p>
        <p>Mejor puntuación: <span className="highlight">{highScore}</span></p>
        <p>Nivel alcanzado: <span className="highlight">{level}</span></p>
        <p>Modo de juego: <span className="highlight">{currentMode}</span></p>
        
        <div className="modal-buttons">
          <button className="modal-button primary" onClick={handleRestart}>
            Jugar de Nuevo
          </button>
          <button className="modal-button secondary" onClick={handleGoToHome}>
            Menú Principal
          </button>
        </div>
      </div>
    </div>
  );
};

export default GameOverModal; 