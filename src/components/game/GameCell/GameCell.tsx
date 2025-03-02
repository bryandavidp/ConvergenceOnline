import React, { useCallback } from 'react';
import './GameCell.css';

interface GameCellProps {
  icon: string | null;
  row: number;
  col: number;
  onClick: () => void;
  isEven: boolean;
}

const GameCell: React.FC<GameCellProps> = React.memo(({ 
  icon, 
  row, 
  col, 
  onClick,
  isEven
}) => {
  const handleClick = useCallback(() => {
    onClick();
  }, [onClick]);

  return (
    <div 
      className={`game-cell ${isEven ? 'light' : 'dark'} ${icon ? 'has-icon' : 'empty'}`}
      data-row={row} 
      data-col={col}
      onClick={handleClick}
    >
      {icon}
    </div>
  );
});

GameCell.displayName = 'GameCell';

export default GameCell; 