// src/components/game/Cell/Cell.tsx (versión con animaciones)
import React, { memo } from 'react';
import { motion } from 'framer-motion';
import './Cell.css';

interface CellProps {
  icon: string | null;
  row: number;
  col: number;
  onClick: () => void;
  isNew?: boolean;
  isRemoving?: boolean;
  isHighlighted?: boolean;
}

const Cell: React.FC<CellProps> = ({ 
  icon, 
  row, 
  col, 
  onClick, 
  isNew = false,
  isRemoving = false,
  isHighlighted = false
}) => {
  const isLight = (row + col) % 2 === 0;
  
  return (
    <motion.div 
      className={`cell ${isLight ? 'light' : 'dark'} ${isHighlighted ? 'highlight' : ''}`}
      data-row={row}
      data-col={col}
      onClick={onClick}
      animate={isRemoving ? { scale: 0, opacity: 0 } : { scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
    >
      {icon && (
        <motion.span
          initial={isNew ? { scale: 0 } : { scale: 1 }}
          animate={{ scale: 1 }}
          exit={{ scale: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        >
          {icon}
        </motion.span>
      )}
    </motion.div>
  );
};

export default memo(Cell);
