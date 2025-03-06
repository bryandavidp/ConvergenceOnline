import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../../store';
import { 
  GameStatus, 
  Cell, 
  GamePlayMode,
  GameDifficulty,
  setHighlightedCells, 
  setBoard, 
  incrementScore, 
  decrementHintsRemaining,
  setIconCount
} from '../../../store/slices/gameSlice';
import { 
  checkCellConvergence, 
  processConvergence, 
  getConvergenceScore, 
  hasAvailableMoves,
  findRandomHint,
  getIconById,
  getRemainingIcons
} from '../../../utils/gameUtils';

// Constantes
const CELL_MARGIN = 2;
const { width } = Dimensions.get('window');

// Mapa de multiplicadores de dificultad
const DIFFICULTY_MULTIPLIERS = {
  [GameDifficulty.EASY]: 0.8,
  [GameDifficulty.MEDIUM]: 1.0,
  [GameDifficulty.HARD]: 1.5,
  [GameDifficulty.EXPERT]: 2.0,
};

const GameBoard: React.FC = () => {
  const dispatch = useDispatch();
  const { 
    boardSize, 
    board, 
    status, 
    highlightedCells,
    level,
    score,
    hintsRemaining,
    currentPlayMode,
    currentDifficulty
  } = useSelector((state: RootState) => state.game);
  
  const [cellSize, setCellSize] = useState(
    Math.floor((width - 40) / boardSize) - CELL_MARGIN * 2
  );
  
  // Estado local para las animaciones y efectos visuales
  const [convergingCells, setConvergingCells] = useState<string[]>([]);
  const [animatingRemoval, setAnimatingRemoval] = useState(false);
  const [hintCell, setHintCell] = useState<string | null>(null);
  
  // Calcular el tamaño de celda cuando cambia el tamaño del tablero
  useEffect(() => {
    setCellSize(Math.floor((width - 40) / boardSize) - CELL_MARGIN * 2);
  }, [boardSize]);
  
  // Añadir esta comprobación para verificar los iconos en el tablero
  useEffect(() => {
    if (board && board.length > 0) {
      let iconCount = 0;
      board.forEach(row => {
        row.forEach(cell => {
          if (cell.iconId !== null) {
            iconCount++;
          }
        });
      });
      
      console.log(`[DEPURACIÓN] Iconos encontrados en el tablero: ${iconCount}`);
      
      if (iconCount === 0 && status === GameStatus.PLAYING) {
        console.warn("No hay iconos en el tablero. Esto podría causar que el nivel se complete automáticamente.");
      }
    }
  }, [board, status]);
  
  // Actualizar el contador de íconos cada vez que cambia el tablero
  useEffect(() => {
    const totalIcons = getRemainingIcons(board);
    dispatch(setIconCount(totalIcons));
    
    // Verificar si se ha completado el nivel
    // Solo considerar nivel completo si:
    // 1. El estado es PLAYING
    // 2. El tablero está inicializado (tiene longitud)
    // 3. Ya no quedan iconos
    // 4. Inicialmente había iconos (para evitar completarse automáticamente)
    if (status === GameStatus.PLAYING && 
        board.length > 0 && 
        totalIcons === 0) {
      
      // Verificar que inicialmente hubo iconos colocados
      // Si no hay iconos desde el principio, no considerar nivel completado
      const initialBoardHadIcons = board.flat().some(cell => 
        cell.iconId !== null || cell.id.includes('removed'));
      
      if (initialBoardHadIcons) {
        console.log('¡Nivel completado!');
      } else {
        console.warn('Tablero sin iconos detectado - No se considerará nivel completado');
        // Reinicializar tablero si está vacío
        // (esto solo es un failsafe para casos extremos)
      }
    }
    
    // Verificar si hay movimientos disponibles
    if (status === GameStatus.PLAYING && totalIcons > 0 && !hasAvailableMoves(board)) {
      // TODO: Implementar lógica para cuando no hay movimientos disponibles
      console.log('No hay movimientos disponibles');
    }
  }, [board, status, dispatch]);
  
  /**
   * Verifica las convergencias en una celda y procesa la eliminación de íconos
   * @param cell Celda presionada
   */
  const handleCellPress = (cell: Cell) => {
    // Solo procesar si estamos jugando
    if (status !== GameStatus.PLAYING || animatingRemoval) return;
    
    // Si la celda contiene un ícono, no hacer nada
    if (cell.iconId !== null) {
      // Opcionalmente, podemos resaltar la celda brevemente
      dispatch(setHighlightedCells([cell.id]));
      setTimeout(() => {
        dispatch(setHighlightedCells([]));
      }, 300);
      return;
    }
    
    // Verificar convergencias en la celda
    const convergenceMap = checkCellConvergence(board, cell);
    
    // Si no hay convergencias, no hacer nada
    if (convergenceMap.size === 0) {
      return;
    }
    
    // Si hay múltiples tipos de íconos convergentes, podríamos mostrar una selección
    // Por ahora, simplemente usaremos el primer tipo
    const iconIdToRemove = Array.from(convergenceMap.keys())[0];
    const convergingIconCells = convergenceMap.get(iconIdToRemove) || [];
    
    // Mostrar animación de convergencia
    const cellIdsToHighlight = convergingIconCells.map(c => c.id);
    setConvergingCells(cellIdsToHighlight);
    dispatch(setHighlightedCells([cell.id, ...cellIdsToHighlight]));
    setAnimatingRemoval(true);
    
    // Procesar la convergencia después de mostrar la animación
    setTimeout(() => {
      // Procesar la eliminación
      const { removedCount, updatedBoard } = processConvergence(board, cell, iconIdToRemove);
      
      // Actualizar puntuación
      if (removedCount > 0) {
        const difficultyMultiplier = DIFFICULTY_MULTIPLIERS[currentDifficulty] || 1;
        const pointsEarned = getConvergenceScore(removedCount, level, difficultyMultiplier);
        dispatch(incrementScore(pointsEarned));
        
        // Actualizar el tablero
        dispatch(setBoard(updatedBoard));
      }
      
      // Limpiar estados de animación
      setConvergingCells([]);
      dispatch(setHighlightedCells([]));
      setAnimatingRemoval(false);
      
      // Limpiar pista si estaba activa
      if (hintCell) {
        setHintCell(null);
      }
    }, 600); // Duración de la animación
  };
  
  /**
   * Muestra una pista de movimiento disponible
   */
  const showHint = () => {
    if (hintsRemaining <= 0 || status !== GameStatus.PLAYING) return;
    
    const hint = findRandomHint(board);
    if (!hint) return;
    
    // Mostrar pista visualmente
    const { cell, convergingCells: hintCells } = hint;
    const cellIdsToHighlight = [...hintCells.map(c => c.id), cell.id];
    dispatch(setHighlightedCells(cellIdsToHighlight));
    setHintCell(cell.id);
    
    // Reducir número de pistas disponibles
    dispatch(decrementHintsRemaining());
    
    // Ocultar la pista después de un tiempo
    setTimeout(() => {
      dispatch(setHighlightedCells([]));
      setHintCell(null);
    }, 2000);
  };
  
  // Componente de celda mejorado con iconos y estados visuales
  const renderCell = (cell: Cell) => {
    const isHighlighted = highlightedCells.includes(cell.id);
    const isConverging = convergingCells.includes(cell.id);
    const isHint = hintCell === cell.id;
    
    // Asignar estilo combinado a la celda
    const styleProps = {
      width: cellSize,
      height: cellSize,
      backgroundColor: cell.iconId !== null 
        ? isHighlighted 
          ? 'rgba(100, 200, 255, 0.3)' 
          : isConverging 
            ? 'rgba(100, 255, 150, 0.4)' 
            : isHint 
              ? 'rgba(255, 215, 0, 0.3)'
              : 'rgba(80, 120, 255, 0.15)' 
        : 'rgba(255, 255, 255, 0.05)',
    };
    
    // Obtener el icono a mostrar
    const icon = cell.iconId !== null ? getIconById(cell.iconId) : '';
    
    // Contador global para depuración
    if (cell.iconId !== null) {
      // No hacer nada aquí, solo para que se cuente en la verificación de renderizado
    }
    
    return (
      <TouchableOpacity
        key={cell.id}
        onPress={() => handleCellPress(cell)}
        disabled={status !== GameStatus.PLAYING || animatingRemoval}
        style={[
          styles.cell,
          styleProps,
          isHighlighted && styles.cellHighlighted
        ]}
      >
        {cell.iconId !== null && (
          <Text style={styles.cellText}>
            {icon}
          </Text>
        )}
      </TouchableOpacity>
    );
  };
  
  // Renderizar una fila del tablero
  const renderRow = (row: Cell[], rowIndex: number) => {
    return (
      <View key={`row-${rowIndex}`} style={styles.row}>
        {row.map(cell => renderCell(cell))}
      </View>
    );
  };
  
  // Mensaje cuando no se está jugando
  if (status !== GameStatus.PLAYING && status !== GameStatus.PAUSED) {
    return (
      <View style={styles.messageContainer}>
        <Text style={styles.messageText}>
          {status === GameStatus.COMPLETED 
            ? '¡Nivel completado!' 
            : status === GameStatus.GAME_OVER 
              ? 'Juego terminado' 
              : 'Presiona "Iniciar Juego" para comenzar'}
        </Text>
      </View>
    );
  }
  
  // Si no hay tablero, mostrar cargando
  if (!board || board.length === 0) {
    return (
      <View style={styles.messageContainer}>
        <Text style={styles.messageText}>Cargando tablero...</Text>
      </View>
    );
  }
  
  // Contar íconos para depuración
  const iconCount = board.flat().filter(cell => cell.iconId !== null).length;
  console.log(`Renderizando tablero con ${iconCount} íconos. Estado: ${status}`);
  
  return (
    <View style={styles.container}>
      <View
        style={[
          styles.board,
          {
            width: cellSize * boardSize + boardSize * CELL_MARGIN * 2 + 20,
            height: cellSize * boardSize + boardSize * CELL_MARGIN * 2 + 20,
          },
        ]}
      >
        {board.map((row, index) => renderRow(row, index))}
      </View>
      
      {/* Indicador de pistas disponibles */}
      {currentPlayMode !== GamePlayMode.COMPETITIVE && (
        <TouchableOpacity 
          style={[
            styles.hintButton, 
            hintsRemaining <= 0 && styles.hintButtonDisabled
          ]} 
          onPress={showHint}
          disabled={hintsRemaining <= 0 || status !== GameStatus.PLAYING || animatingRemoval}
        >
          <Text style={styles.hintButtonText}>
            {`Pista (${hintsRemaining})`}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  board: {
    backgroundColor: 'rgba(20, 30, 50, 0.5)',
    borderRadius: 12,
    padding: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
  },
  cell: {
    margin: CELL_MARGIN,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  cellText: {
    color: '#ffffff',
    fontSize: 20,
    textAlign: 'center',
  },
  messageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    padding: 20,
    borderRadius: 16,
    width: '100%',
  },
  messageText: {
    color: 'white',
    fontSize: 18,
    textAlign: 'center',
    fontWeight: '500',
  },
  hintButton: {
    marginTop: 15,
    backgroundColor: 'rgba(59, 130, 246, 0.7)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
  },
  hintButtonDisabled: {
    backgroundColor: 'rgba(100, 116, 139, 0.5)',
  },
  hintButtonText: {
    color: 'white',
    fontWeight: '500',
  },
  cellHighlighted: {
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
});

export default GameBoard; 