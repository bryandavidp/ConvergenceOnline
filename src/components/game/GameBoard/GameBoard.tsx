import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../../store';
import { useGameLogic } from '../../../hooks/useGameLogic';
import logger from '../../../utils/logger';
import { audioManager } from '../../../utils/audioManager';
import './GameBoard.css';

// Componente para una celda individual
const Cell = React.memo(({ 
  row, 
  col, 
  value, 
  onClick,
  isNew = false 
}: { 
  row: number; 
  col: number; 
  value: string | null; 
  onClick: (row: number, col: number) => void;
  isNew?: boolean;
}) => {
  const [animationClass, setAnimationClass] = useState<string>('');
  
  // Efecto para la animación cuando un nuevo icono aparece
  useEffect(() => {
    if (isNew && value !== null) {
      setAnimationClass('new-icon');
      const timer = setTimeout(() => {
        setAnimationClass('');
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [value, isNew]);
  
  // Manejador de clic con animación
  const handleClick = () => {
    if (value === null) {
      setAnimationClass('glow-effect');
      onClick(row, col);
      setTimeout(() => setAnimationClass(''), 300);
    }
  };
  
  return (
    <div 
      className={`cell ${animationClass}`}
      data-row={row} 
      data-col={col} 
      onClick={handleClick}
    >
      {value}
    </div>
  );
});

Cell.displayName = 'Cell';

const GameBoard: React.FC = () => {
  const { board, boardSize, status } = useSelector((state: RootState) => state.game);
  const { handleCellClick } = useGameLogic();
  const [newCells, setNewCells] = useState<{[key: string]: boolean}>({});
  const prevBoardRef = useRef<(string | null)[][]>([]);
  
  // Referencias
  const boardRef = useRef<HTMLDivElement>(null);
  const boardContainerRef = useRef<HTMLDivElement>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const isInitialRender = useRef<boolean>(true);
  
  // Ajustar el tamaño del tablero según el contenedor
  const adjustBoardSize = useCallback(() => {
    if (!boardRef.current || !boardContainerRef.current) return;
    
    const containerWidth = boardContainerRef.current.clientWidth;
    const containerHeight = boardContainerRef.current.clientHeight;
    
    // Calcular el tamaño disponible (el mínimo entre ancho y alto)
    const size = Math.min(containerWidth, containerHeight) - 20; // Margen
    
    // Establecer el tamaño como variable CSS para el grid
    document.documentElement.style.setProperty('--board-size', boardSize.toString());
    
    // Calcular y establecer el tamaño de celda
    const cellSize = Math.max(30, Math.min(80, Math.floor(size / boardSize) - 8));
    document.documentElement.style.setProperty('--cell-size', `${cellSize}px`);
    
    // Solo loggear si hay cambios significativos en el tamaño (mayor a 10px)
    const prevSize = boardRef.current.getAttribute('data-last-size');
    const prevCellSize = boardRef.current.getAttribute('data-last-cell-size');
    
    if (!prevSize || !prevCellSize || 
        Math.abs(parseInt(prevSize) - size) > 10 || 
        Math.abs(parseInt(prevCellSize) - cellSize) > 2) {
      logger.debug('GameBoard', 'Tablero redimensionado', { 
        contenedor: { ancho: containerWidth, alto: containerHeight }, 
        tamañoTablero: size, 
        tamañoCelda: cellSize 
      });
      
      // Guardar el último tamaño para comparar en futuros ajustes
      boardRef.current.setAttribute('data-last-size', size.toString());
      boardRef.current.setAttribute('data-last-cell-size', cellSize.toString());
    }
  }, [boardSize]);
  
  // Manejar click en celda
  const onCellClick = useCallback((row: number, col: number) => {
    if (status !== 'playing') return;
    
    try {
      // Reproducir sonido de clic
      audioManager.play('click');
      handleCellClick(row, col);
    } catch (error) {
      logger.error('GameBoard', 'Error al hacer clic en celda', { row, col, error });
    }
  }, [status, handleCellClick]);
  
  // Configurar el observador de tamaño - Solo una vez al montar el componente
  useEffect(() => {
    // Ajustar el tamaño inicialmente
    adjustBoardSize();
    
    // Crear un observador de cambio de tamaño
    if (!resizeObserverRef.current && boardContainerRef.current) {
      resizeObserverRef.current = new ResizeObserver(() => {
        adjustBoardSize();
      });
      
      resizeObserverRef.current.observe(boardContainerRef.current);
    }
    
    // Limpiar
    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }
    };
  }, [adjustBoardSize]);
  
  // Solo ajustar el tamaño cuando cambia el tamaño del tablero, no cuando cambia su contenido
  useEffect(() => {
    // Evitamos ajustar durante el primer render para prevenir loops
    if (isInitialRender.current) {
      isInitialRender.current = false;
      return;
    }
    adjustBoardSize();
  }, [boardSize, adjustBoardSize]);
  
  // Detectar celdas nuevas para animaciones - Solo cuando cambia el contenido del tablero
  useEffect(() => {
    // Si no hay un tablero anterior para comparar, simplemente guardamos el actual
    if (!board || !board.length || !prevBoardRef.current.length) {
      prevBoardRef.current = board ? board.map(row => [...row]) : [];
      return;
    }
    
    const newCellsObj: {[key: string]: boolean} = {};
    let cellsChanged = false;
    let celdasNuevas = [];
    
    // Comparar el tablero actual con el anterior para detectar nuevas celdas
    for (let row = 0; row < board.length; row++) {
      for (let col = 0; col < board[row].length; col++) {
        // Si la celda anterior era null y ahora tiene un valor, es nueva
        if (
          prevBoardRef.current[row] && 
          prevBoardRef.current[row][col] === null && 
          board[row][col] !== null
        ) {
          newCellsObj[`${row}-${col}`] = true;
          cellsChanged = true;
          celdasNuevas.push({ fila: row, columna: col, icono: board[row][col] });
        }
      }
    }
    
    if (cellsChanged) {
      logger.debug('GameBoard', 'Nuevas celdas detectadas', { 
        cantidad: celdasNuevas.length,
        celdas: celdasNuevas
      });
      setNewCells(newCellsObj);
    }
    
    // Actualizar la referencia del tablero anterior - importante para la siguiente comparación
    prevBoardRef.current = board.map(row => [...row]);
    
    // Limpiar las celdas nuevas después de un tiempo
    const timer = setTimeout(() => {
      setNewCells({});
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [board]);
  
  return (
    <div className="board-container" ref={boardContainerRef}>
      <div 
        className="board" 
        ref={boardRef}
        style={{
          gridTemplateColumns: `repeat(${boardSize}, var(--cell-size))`,
          gridTemplateRows: `repeat(${boardSize}, var(--cell-size))`
        }}
      >
        {board && board.map((row, rowIndex) => 
          row.map((cell, colIndex) => (
            <Cell
              key={`${rowIndex}-${colIndex}`}
              row={rowIndex}
              col={colIndex}
              value={cell}
              onClick={onCellClick}
              isNew={newCells[`${rowIndex}-${colIndex}`] || false}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default GameBoard; 