import { useCallback, useState, useRef, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../../../store';
import {
  Cell,
  setHighlightedCells,
  decrementIconCount,
  incrementScore,
  GameStatus,
  GamePlayMode,
  setGameStatus,
  incrementLevel,
  setIconCount,
  setBoard,
  decrementHintsRemaining,
} from '../../../../store/slices/gameSlice';
import {
  isMatch,
  findRandomMatch,
  findAllMatches,
  getRemainingIcons,
  getMatchScore,
  generateBoard,
} from '../../../../utils/gameUtils';

interface BoardInteraction {
  selectedCells: Cell[];
  handleCellPress: (cell: Cell) => void;
  findPotentialMatches: () => { cell1: Cell; cell2: Cell } | null;
  checkForMatches: () => boolean;
  resetSelection: () => void;
  removeCellsById: (cellIds: string[]) => void;
  showHint: () => void;
  initializeBoard: (level: number, boardSize: number) => void;
  restartLevel: () => void;
  removedCells: string[];
}

/**
 * Hook para manejar la interacción con el tablero de juego
 */
const useBoardInteraction = (): BoardInteraction => {
  const dispatch = useDispatch();
  const { 
    board, 
    status, 
    level, 
    highlightedCells, 
    boardSize, 
    currentPlayMode,
    currentDifficulty,
    iconCount
  } = useSelector((state: RootState) => state.game);
  
  const [selectedCells, setSelectedCells] = useState<Cell[]>([]);
  const [removedCells, setRemovedCells] = useState<string[]>([]);
  const lastMatchTimestamp = useRef<number>(0);
  
  // Restablecer las selecciones cuando cambia el estado del juego
  useEffect(() => {
    if (status !== GameStatus.PLAYING) {
      resetSelection();
    }
  }, [status]);
  
  // Inicializar el tablero para un nivel
  const initializeBoard = useCallback((level: number, boardSize: number) => {
    const newBoard = generateBoard(boardSize, level);
    dispatch(setBoard(newBoard));
    
    // Contar íconos en el tablero
    const iconsCount = getRemainingIcons(newBoard);
    dispatch(setIconCount(iconsCount));
    
    // Limpiar estado
    resetSelection();
    setRemovedCells([]);
  }, [dispatch]);
  
  // Reiniciar el nivel actual
  const restartLevel = useCallback(() => {
    initializeBoard(level, boardSize);
  }, [initializeBoard, level, boardSize]);
  
  /**
   * Comprobar si hay alguna coincidencia en el tablero
   */
  const checkForMatches = useCallback((): boolean => {
    const matches = findAllMatches(board);
    return matches.length > 0;
  }, [board]);
  
  /**
   * Buscar coincidencias potenciales para sugerir al jugador
   */
  const findPotentialMatches = useCallback((): { cell1: Cell; cell2: Cell } | null => {
    return findRandomMatch(board);
  }, [board]);
  
  /**
   * Eliminar celdas por sus IDs
   */
  const removeCellsById = useCallback((cellIds: string[]) => {
    setRemovedCells(prev => [...prev, ...cellIds]);
    
    // Actualizar el tablero en Redux para quitar los íconos
    const newBoard = board.map(row => 
      row.map(cell => 
        cellIds.includes(cell.id) 
          ? { ...cell, iconId: null } 
          : cell
      )
    );
    
    dispatch(setBoard(newBoard));
  }, [board, dispatch]);
  
  /**
   * Mostrar una pista al jugador
   */
  const showHint = useCallback(() => {
    const match = findRandomMatch(board);
    
    if (match) {
      // Resaltar la pista
      dispatch(setHighlightedCells([match.cell1.id, match.cell2.id]));
      dispatch(decrementHintsRemaining());
      
      // Limpiar la pista después de un tiempo
      setTimeout(() => {
        dispatch(setHighlightedCells([]));
      }, 1500);
    }
  }, [board, dispatch]);
  
  /**
   * Verificar si el nivel ha sido completado
   */
  const checkLevelComplete = useCallback(() => {
    // Si no quedan más íconos o coincidencias, el nivel está completo
    const remainingIcons = getRemainingIcons(board);
    
    if (remainingIcons === 0) {
      // Victoria completa, nivel finalizado
      dispatch(setGameStatus(GameStatus.COMPLETED));
      return true;
    }
    
    // Si no quedan coincidencias pero aún hay íconos, puede ser fin de juego
    const hasMatches = checkForMatches();
    if (!hasMatches && remainingIcons > 0 && currentPlayMode !== GamePlayMode.COMPETITIVE) {
      // No hay más movimientos disponibles
      dispatch(setGameStatus(GameStatus.GAME_OVER));
      return true;
    }
    
    return false;
  }, [board, dispatch, checkForMatches, currentPlayMode]);
  
  /**
   * Manejar el clic en una celda
   */
  const handleCellPress = useCallback(
    (cell: Cell) => {
      if (status !== GameStatus.PLAYING || cell.iconId === null || removedCells.includes(cell.id)) {
        return;
      }
      
      // Lógica de selección de celdas
      if (selectedCells.length === 0) {
        // Primera selección
        setSelectedCells([cell]);
        dispatch(setHighlightedCells([cell.id]));
      } else if (selectedCells.length === 1) {
        const firstCell = selectedCells[0];
        
        // No permitir seleccionar la misma celda dos veces
        if (firstCell.id === cell.id) {
          return;
        }
        
        // Comprobar si las celdas coinciden
        if (isMatch(firstCell, cell)) {
          // ¡Coincidencia encontrada!
          const matchedCellsIds = [firstCell.id, cell.id];
          dispatch(setHighlightedCells(matchedCellsIds));
          
          // Calcular puntuación
          const difficultyMultiplier = {
            easy: 1,
            medium: 1.5,
            hard: 2.0,
            expert: 2.5,
          }[currentDifficulty] || 1;
          
          const comboMultiplier = getComboMultiplier();
          const score = getMatchScore(level, difficultyMultiplier) * comboMultiplier;
          
          // Actualizar estado con un ligero retraso para la animación
          setTimeout(() => {
            // Eliminar celdas y actualizar puntuación
            removeCellsById(matchedCellsIds);
            dispatch(decrementIconCount(2));
            dispatch(incrementScore(Math.round(score)));
            dispatch(setHighlightedCells([]));
            lastMatchTimestamp.current = Date.now();
            
            // Resetear selección
            setSelectedCells([]);
            
            // Verificar si el nivel está completo
            setTimeout(() => {
              checkLevelComplete();
            }, 300);
          }, 400);
        } else {
          // No coinciden, deseleccionar después de un tiempo
          dispatch(setHighlightedCells([firstCell.id, cell.id]));
          
          setTimeout(() => {
            dispatch(setHighlightedCells([]));
            setSelectedCells([]);
          }, 500);
        }
      }
    },
    [selectedCells, board, status, dispatch, level, removedCells, currentDifficulty, checkLevelComplete, removeCellsById]
  );
  
  /**
   * Calcula el multiplicador de combo basado en el tiempo entre coincidencias
   */
  const getComboMultiplier = useCallback((): number => {
    const now = Date.now();
    const timeSinceLastMatch = now - lastMatchTimestamp.current;
    
    if (timeSinceLastMatch < 1000) {
      return 1.5; // Coincidencia muy rápida
    } else if (timeSinceLastMatch < 2000) {
      return 1.25; // Coincidencia rápida
    }
    
    return 1; // Sin bonus
  }, []);
  
  /**
   * Resetear la selección actual
   */
  const resetSelection = useCallback(() => {
    setSelectedCells([]);
    dispatch(setHighlightedCells([]));
  }, [dispatch]);
  
  return {
    selectedCells,
    handleCellPress,
    findPotentialMatches,
    checkForMatches,
    resetSelection,
    removeCellsById,
    showHint,
    initializeBoard,
    restartLevel,
    removedCells,
  };
};

export default useBoardInteraction; 