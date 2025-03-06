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
  lowPerformanceMode?: boolean;
}

const Cell: React.FC<CellProps> = ({ 
  icon, 
  row, 
  col, 
  onClick, 
  isNew = false,
  isRemoving = false,
  isHighlighted = false,
  lowPerformanceMode = false
}) => {
  const isLight = (row + col) % 2 === 0;
  
  if (lowPerformanceMode) {
    return (
      <div 
        className={`cell ${isLight ? 'light' : 'dark'} ${isHighlighted ? 'highlight' : ''} ${isRemoving ? 'removing' : ''}`}
        data-row={row}
        data-col={col}
        onClick={onClick}
        style={{
          opacity: isRemoving ? 0 : 1,
          transform: isRemoving ? 'scale(0.8)' : 'scale(1)',
          transition: 'opacity 0.5s ease, transform 0.5s ease'
        }}
      >
        {icon}
      </div>
    );
  }
  
  return (
    <motion.div 
      className={`cell ${isLight ? 'light' : 'dark'} ${isHighlighted ? 'highlight' : ''}`}
      data-row={row}
      data-col={col}
      onClick={onClick}
      initial={false}
      animate={isRemoving ? { scale: 0, opacity: 0 } : { scale: 1, opacity: 1 }}
      transition={{ 
        type: 'tween',
        duration: 0.4,
        ease: "easeOut"
      }}
      style={{ 
        willChange: 'transform, opacity',
        transform: 'translateZ(0)'
      }}
    >
      {icon && (
        <motion.span
          initial={isNew ? { scale: 0 } : { scale: 1 }}
          animate={{ scale: 1 }}
          exit={{ scale: 0 }}
          transition={{ 
            type: 'tween', 
            duration: 0.4,
            ease: "easeOut"
          }}
        >
          {icon}
        </motion.span>
      )}
    </motion.div>
  );
};

export default memo(Cell);
