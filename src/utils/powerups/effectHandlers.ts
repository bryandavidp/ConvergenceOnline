import { MutableRefObject } from 'react';
import { PowerUpEffect, PowerUpInstance, PowerUpType } from './types';
import { POWERUP_CATALOG } from './catalog';

// Interfaz para el contexto de ejecución de los efectos
export interface PowerUpEffectContext {
  board: MutableRefObject<(string | null)[][]>;
  score: MutableRefObject<number>;
  scoreMultiplier: MutableRefObject<number>;
  spawnRate: MutableRefObject<number>;
  timeRemaining?: MutableRefObject<number>;
  comboMultiplier: MutableRefObject<number>;
  iconSpawningPaused: MutableRefObject<boolean>;
  dispatch: (action: any) => void;
}

// Tipo para los manejadores de efectos
export type EffectHandler = (
  powerUp: PowerUpInstance,
  context: PowerUpEffectContext
) => PowerUpEffect;

// Objeto con todos los manejadores de efectos
export const effectHandlers: Record<PowerUpType, EffectHandler> = {
  // Bomba Cruz - Elimina fila y columna completas
  bombaCruz: (powerUp, context) => {
    const { board, dispatch, score } = context;
    const { row, col } = powerUp;
    const boardSize = board.current.length;
    const affectedCells: {row: number, col: number}[] = [];
    
    // Añadir todas las celdas en la misma fila y columna
    for (let i = 0; i < boardSize; i++) {
      // Fila completa
      if (board.current[row][i] !== null) {
        affectedCells.push({ row, col: i });
      }
      
      // Columna completa (evitar duplicar la célula central)
      if (i !== row && board.current[i][col] !== null) {
        affectedCells.push({ row: i, col });
      }
    }
    
    // Calcular puntos en base a las celdas afectadas
    const points = affectedCells.length * 10;
    score.current += points;
    
    // Limpiar las celdas afectadas
    affectedCells.forEach(cell => {
      board.current[cell.row][cell.col] = null;
    });
    
    // Despachar acción para actualizar el estado visual
    dispatch({ type: 'game/highlightCells', payload: affectedCells });
    dispatch({ type: 'game/updateBoard', payload: board.current });
    dispatch({ type: 'game/updateScore', payload: score.current });
    
    // Retornar el efecto
    return {
      type: 'bombaCruz',
      startTime: Date.now(),
      affected: { cells: affectedCells },
      isActive: false // Efecto instantáneo
    };
  },
  
  // Bomba Área - Elimina área 3x3
  bombaArea: (powerUp, context) => {
    const { board, dispatch, score } = context;
    const { row, col } = powerUp;
    const boardSize = board.current.length;
    const affectedCells: {row: number, col: number}[] = [];
    
    // Añadir todas las celdas en un área 3x3
    for (let r = Math.max(0, row - 1); r <= Math.min(boardSize - 1, row + 1); r++) {
      for (let c = Math.max(0, col - 1); c <= Math.min(boardSize - 1, col + 1); c++) {
        if (board.current[r][c] !== null) {
          affectedCells.push({ row: r, col: c });
        }
      }
    }
    
    // Calcular puntos
    const points = affectedCells.length * 8;
    score.current += points;
    
    // Limpiar las celdas afectadas
    affectedCells.forEach(cell => {
      board.current[cell.row][cell.col] = null;
    });
    
    // Despachar acción para actualizar el estado visual
    dispatch({ type: 'game/highlightCells', payload: affectedCells });
    dispatch({ type: 'game/updateBoard', payload: board.current });
    dispatch({ type: 'game/updateScore', payload: score.current });
    
    return {
      type: 'bombaArea',
      startTime: Date.now(),
      affected: { cells: affectedCells },
      isActive: false // Efecto instantáneo
    };
  },
  
  // Congelación - Detiene la generación de iconos
  congelacion: (powerUp, context) => {
    const { iconSpawningPaused, dispatch } = context;
    const duration = POWERUP_CATALOG.congelacion.duration || 15000;
    const startTime = Date.now();
    
    // Pausar la generación de iconos
    iconSpawningPaused.current = true;
    
    // Programar la finalización del efecto
    setTimeout(() => {
      iconSpawningPaused.current = false;
      dispatch({ type: 'game/powerUpEffectEnded', payload: 'congelacion' });
    }, duration);
    
    // Notificar sobre el efecto
    dispatch({ 
      type: 'game/powerUpEffectStarted', 
      payload: { type: 'congelacion', duration }
    });
    
    return {
      type: 'congelacion',
      startTime,
      endTime: startTime + duration,
      isActive: true
    };
  },
  
  // Comodín - Se utiliza como cualquier icono para completar convergencias
  // (Este efecto se maneja principalmente en la lógica de verificación de convergencia)
  comodin: (powerUp, context) => {
    const { dispatch } = context;
    
    // Notificar que se ha recogido un comodín para la lógica de juego
    dispatch({ 
      type: 'game/powerUpCollected', 
      payload: { type: 'comodin', position: { row: powerUp.row, col: powerUp.col } }
    });
    
    return {
      type: 'comodin',
      startTime: Date.now(),
      isActive: false // Efecto se maneja en la lógica de convergencia
    };
  },
  
  // Multiplicador de puntos
  multiplicadorPuntos: (powerUp, context) => {
    const { scoreMultiplier, dispatch } = context;
    const startTime = Date.now();
    const duration = POWERUP_CATALOG.multiplicadorPuntos.duration || 20000;
    const multiplier = 2; // Multiplicador x2
    
    // Guardar el multiplicador original
    const originalMultiplier = scoreMultiplier.current;
    
    // Aplicar el nuevo multiplicador
    scoreMultiplier.current = multiplier;
    
    // Programar la finalización del efecto
    setTimeout(() => {
      scoreMultiplier.current = originalMultiplier;
      dispatch({ type: 'game/powerUpEffectEnded', payload: 'multiplicadorPuntos' });
    }, duration);
    
    // Notificar sobre el efecto
    dispatch({ 
      type: 'game/powerUpEffectStarted', 
      payload: { type: 'multiplicadorPuntos', duration, multiplier }
    });
    
    return {
      type: 'multiplicadorPuntos',
      startTime,
      endTime: startTime + duration,
      multiplier,
      isActive: true
    };
  },
  
  // Tiempo Extra - Añade tiempo al modo contrarreloj
  tiempoExtra: (powerUp, context) => {
    const { timeRemaining, dispatch } = context;
    
    // Solo aplicable en modo contrarreloj
    if (!timeRemaining) {
      return {
        type: 'tiempoExtra',
        startTime: Date.now(),
        isActive: false
      };
    }
    
    // Añadir 15 segundos al tiempo restante
    const extraTime = 15;
    timeRemaining.current += extraTime;
    
    // Despachar acción para actualizar el tiempo
    dispatch({ type: 'game/addTime', payload: extraTime });
    
    return {
      type: 'tiempoExtra',
      startTime: Date.now(),
      isActive: false // Efecto instantáneo
    };
  },
  
  // Elimina Color - Elimina todos los íconos de un color aleatorio
  eliminaColor: (powerUp, context) => {
    const { board, dispatch, score } = context;
    const boardSize = board.current.length;
    const availableIcons: string[] = [];
    
    // Identificar los diferentes iconos presentes en el tablero
    for (let r = 0; r < boardSize; r++) {
      for (let c = 0; c < boardSize; c++) {
        const icon = board.current[r][c];
        if (icon && !availableIcons.includes(icon)) {
          availableIcons.push(icon);
        }
      }
    }
    
    if (availableIcons.length === 0) {
      return {
        type: 'eliminaColor',
        startTime: Date.now(),
        isActive: false
      };
    }
    
    // Seleccionar un icono aleatorio para eliminar
    const iconToRemove = availableIcons[Math.floor(Math.random() * availableIcons.length)];
    const affectedCells: {row: number, col: number}[] = [];
    
    // Encontrar todas las instancias de ese icono
    for (let r = 0; r < boardSize; r++) {
      for (let c = 0; c < boardSize; c++) {
        if (board.current[r][c] === iconToRemove) {
          affectedCells.push({ row: r, col: c });
          board.current[r][c] = null;
        }
      }
    }
    
    // Calcular puntos basados en el número de celdas afectadas
    const points = affectedCells.length * 15;
    score.current += points;
    
    // Despachar acciones para actualizar el estado
    dispatch({ type: 'game/highlightCells', payload: affectedCells });
    dispatch({ type: 'game/updateBoard', payload: board.current });
    dispatch({ type: 'game/updateScore', payload: score.current });
    
    return {
      type: 'eliminaColor',
      startTime: Date.now(),
      affected: { icons: [iconToRemove], cells: affectedCells },
      isActive: false
    };
  }
};

// Función principal para ejecutar el efecto de un powerup
export const executePowerUpEffect = (
  powerUp: PowerUpInstance,
  context: PowerUpEffectContext
): PowerUpEffect | null => {
  const handler = effectHandlers[powerUp.type];
  
  if (!handler) {
    console.warn(`No se encontró manejador para el powerup de tipo: ${powerUp.type}`);
    return null;
  }
  
  try {
    return handler(powerUp, context);
  } catch (error) {
    console.error(`Error al ejecutar el efecto del powerup ${powerUp.type}:`, error);
    return null;
  }
}; 