import React, { useEffect, useRef, memo, useState } from 'react';
import { TouchableOpacity, Animated, View } from 'react-native';
import { Cell } from '../../../../store/slices/gameSlice';
import { boardStyles } from '../styles/boardStyles';
import { cellSelectionAnimation, cellRemoveAnimation } from '../styles/animations';
import { getIconById } from '../../../../utils/gameUtils';

interface BoardCellProps {
  cell: Cell;
  size: number;
  onPress: (cell: Cell) => void;
  isHighlighted: boolean;
  isHint: boolean;
  isRemoving: boolean;
  onRemoveComplete?: () => void;
}

/**
 * Componente para representar una celda individual del tablero de juego
 */
const BoardCell: React.FC<BoardCellProps> = ({
  cell,
  size,
  onPress,
  isHighlighted,
  isHint,
  isRemoving,
  onRemoveComplete,
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;
  const translateAnim = useRef(new Animated.Value(0)).current;
  const [isCompletelyRemoved, setIsCompletelyRemoved] = useState(false);
  
  // Aplicar animación cuando cambia el estado de la celda
  useEffect(() => {
    if (isHighlighted) {
      cellSelectionAnimation(scaleAnim);
    }
  }, [isHighlighted, scaleAnim]);
  
  // Aplicar animación de eliminación
  useEffect(() => {
    if (isRemoving) {
      cellRemoveAnimation(scaleAnim, opacityAnim, () => {
        setIsCompletelyRemoved(true);
        if (onRemoveComplete) {
          onRemoveComplete();
        }
      });
    }
  }, [isRemoving, scaleAnim, opacityAnim, onRemoveComplete]);
  
  // Determinar el estilo de la celda según su estado
  const getCellStyles = () => {
    const styles = [];
    
    if (cell.iconId !== null) {
      styles.push(boardStyles.cellWithIcon);
    } else {
      styles.push(boardStyles.cellEmpty);
    }
    
    if (isHighlighted) {
      styles.push(boardStyles.cellHighlighted);
    }
    
    if (isHint) {
      styles.push(boardStyles.cellHint);
    }
    
    return styles;
  };
  
  // Obtener el ícono a mostrar
  const iconText = getIconById(cell.iconId);
  
  // No renderizar nada si la celda ha sido eliminada completamente
  if (isCompletelyRemoved) {
    return null;
  }
  
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => onPress(cell)}
      disabled={isRemoving || cell.iconId === null}
    >
      <Animated.View
        style={[
          boardStyles.cell,
          {
            width: size,
            height: size,
            transform: [
              { scale: scaleAnim },
              { translateX: translateAnim },
            ],
            opacity: opacityAnim,
          },
          ...getCellStyles(),
        ]}
      >
        <View style={boardStyles.cellContent}>
          {cell.iconId !== null && (
            <Animated.Text 
              style={[
                boardStyles.cellText,
                { fontSize: size * 0.5 },
              ]}
            >
              {iconText}
            </Animated.Text>
          )}
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
};

export default memo(BoardCell); 