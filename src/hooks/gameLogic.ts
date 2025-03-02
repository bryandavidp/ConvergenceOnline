import { useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../store';
import { 
  incrementScore, 
  updateBoard, 
  setGameStatus, 
  incrementTimer 
} from '../store/slices/gameSlice';
import { useAudio } from './useAudio';

export const useGameLogic = () => {
  const dispatch = useDispatch();
  const { 
    board, 
    score, 
    level, 
    timer, 
    status 
  } = useSelector((state: RootState) => state.game);
  const { playSound } = useAudio();

  // Iniciar temporizadores
  useEffect(() => {
    let timerInterval: number;
    
    if (status === 'playing') {
      timerInterval = window.setInterval(() => {
        dispatch(incrementTimer());
      }, 1000);
    }
    
    return () => {
      if (timerInterval) clearInterval(timerInterval);
    };
  }, [status, dispatch]);

  // Función para manejar clics en celdas
  const handleCellClick = useCallback((row: number, col: number) => {
    if (status !== 'playing') return;
    
    // Verificar si la celda está vacía
    if (!board[row][col]) {
      const convergingIcons = findConvergingIcons(row, col, board);
      
      if (convergingIcons.length > 0) {
        playSound('convergingFound');
        
        // Eliminar iconos convergentes
        const newBoard = [...board];
        convergingIcons.forEach(({ row, col }) => {
          newBoard[row][col] = null;
        });
        
        dispatch(updateBoard(newBoard));
        dispatch(incrementScore(convergingIcons.length * 10));
        
        // Verificar si el tablero está vacío
        if (isEmptyBoard(newBoard)) {
          playSound('emptyBoard');
          dispatch(incrementScore(500)); // Bonus
          dispatch(setGameStatus('levelCompleted'));
        }
        // Verificar si no hay movimientos válidos
        else if (!hasValidMoves(newBoard)) {
          dispatch(setGameStatus('levelCompleted'));
        }
      } else {
        // Penalización por clic erróneo
        playSound('error');
        penalize();
      }
    }
  }, [board, status, dispatch, playSound]);

  // Funciones auxiliares
  const findConvergingIcons = (row: number, col: number, board: (string | null)[][]) => {
    // Implementación de la lógica para encontrar iconos convergentes
    // ...
    return [];
  };

  const isEmptyBoard = (board: (string | null)[][]) => {
    return board.every(row => row.every(cell => cell === null));
  };

  const hasValidMoves = (board: (string | null)[][]) => {
    // Implementación de la lógica para verificar movimientos válidos
    // ...
    return true;
  };

  const penalize = () => {
    // Implementación de la lógica de penalización
    // ...
  };

  return {
    handleCellClick,
    // Otras funciones y estados que necesites exponer
  };
};
