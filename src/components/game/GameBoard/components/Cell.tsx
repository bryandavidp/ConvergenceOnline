import React, { useRef, useEffect } from 'react';
import '../GameBoard.css';

interface CellProps {
  row: number;
  col: number;
  value: string | null;
  onClick: (row: number, col: number) => void;
  isHighlighted?: boolean;
  registerCellRef?: (row: number, col: number, element: HTMLDivElement | null) => void;
}

// Componente para una celda individual
const Cell: React.FC<CellProps> = React.memo(({ 
  row, 
  col, 
  value, 
  onClick,
  isHighlighted,
  registerCellRef
}) => {
  const cellRef = useRef<HTMLDivElement>(null);
  const isRemoving = value?.includes('_removing') || false;
  
  // Extraer el icono base en caso de que incluya "_removing"
  const displayValue = isRemoving && value ? value.split('_')[0] : value;

  // Registrar la referencia de la celda al montar el componente
  useEffect(() => {
    if (registerCellRef && cellRef.current) {
      registerCellRef(row, col, cellRef.current);
    }
    
    return () => {
      // Limpiar la referencia al desmontar
      if (registerCellRef) {
        registerCellRef(row, col, null);
      }
    };
  }, [row, col, registerCellRef]);

  // Manejador de clics específico para esta celda
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault(); // Prevenir comportamiento por defecto
    e.stopPropagation(); // Evitar propagación
    onClick(row, col);
  };

  return (
    <div 
      className={`cell ${isHighlighted ? 'highlighted' : ''} ${value ? 'occupied' : 'empty'} ${isRemoving ? 'removing' : ''}`} 
      data-row={row} 
      data-col={col} 
      onClick={handleClick}
      ref={cellRef}
    >
      {displayValue}
    </div>
  );
});

Cell.displayName = 'Cell';

export default Cell; 