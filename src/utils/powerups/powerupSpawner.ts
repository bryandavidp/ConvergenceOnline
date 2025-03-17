import { MutableRefObject } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { PowerUpInstance, PowerUpSpawnConfig, PowerUpType } from './types';
import { getRandomPowerUp } from './catalog';

// Configuración predeterminada para la generación de powerups
export const DEFAULT_POWERUP_SPAWN_CONFIG: PowerUpSpawnConfig = {
  baseSpawnRate: 0.05, // 5% de probabilidad base
  levelMultiplier: 0.02, // Incremento del 2% por nivel
  modeMultipliers: {
    classic: 1.0,
    timed: 1.2,
    survival: 1.5,
    zen: 0.8,
    tutorial: 0
  },
  difficultyMultipliers: {
    easy: 1.2,
    normal: 1.0,
    hard: 0.8,
    tutorial: 1.5
  },
  maxPowerUpsOnBoard: 3,
  cooldownBetweenSpawns: 15000 // 15 segundos entre powerups
};

export interface PowerUpSpawnerHookResult {
  attemptPowerUpSpawn: (forceSpawn?: boolean) => PowerUpInstance | null;
  isSpawningPowerUpRef: MutableRefObject<boolean>;
  lastPowerUpAddedTimeRef: MutableRefObject<number>;
  activePowerUpsRef: MutableRefObject<PowerUpInstance[]>;
  collectPowerUp: (id: string) => PowerUpInstance | null;
  resetPowerUpState: () => void;
}

export const usePowerUpSpawner = (
  boardSizeRef: MutableRefObject<number>,
  boardRef: MutableRefObject<(string | null)[][]>,
  levelRef: MutableRefObject<number>,
  playModeRef: MutableRefObject<string>,
  difficultyRef: MutableRefObject<string>,
  config: PowerUpSpawnConfig = DEFAULT_POWERUP_SPAWN_CONFIG
): PowerUpSpawnerHookResult => {
  // Referencias para mantener el estado entre renders
  const isSpawningPowerUpRef = { current: false };
  const lastPowerUpAddedTimeRef = { current: 0 };
  const activePowerUpsRef = { current: [] as PowerUpInstance[] };
  
  // Comprueba si hay espacio disponible para añadir un powerup
  const hasSpaceForPowerUp = (): boolean => {
    return activePowerUpsRef.current.length < config.maxPowerUpsOnBoard;
  };
  
  // Comprueba si ha pasado el tiempo de enfriamiento
  const hasCooldownPassed = (): boolean => {
    const now = Date.now();
    return now - lastPowerUpAddedTimeRef.current >= config.cooldownBetweenSpawns;
  };
  
  // Calcula la probabilidad actual de generación basada en nivel, modo y dificultad
  const calculateCurrentSpawnRate = (): number => {
    const baseRate = config.baseSpawnRate;
    const levelBonus = config.levelMultiplier * levelRef.current;
    const modeMultiplier = config.modeMultipliers[playModeRef.current as keyof typeof config.modeMultipliers] || 1;
    const difficultyMultiplier = config.difficultyMultipliers[difficultyRef.current as keyof typeof config.difficultyMultipliers] || 1;
    
    return Math.min(0.75, baseRate + levelBonus) * modeMultiplier * difficultyMultiplier;
  };
  
  // Encuentra una celda vacía en el tablero para colocar el powerup
  const findEmptyCell = (): { row: number, col: number } | null => {
    const boardSize = boardSizeRef.current;
    const board = boardRef.current;
    
    // Crear lista de todas las celdas vacías
    const emptyCells: { row: number, col: number }[] = [];
    
    for (let row = 0; row < boardSize; row++) {
      for (let col = 0; col < boardSize; col++) {
        if (!board[row][col]) {
          emptyCells.push({ row, col });
        }
      }
    }
    
    if (emptyCells.length === 0) {
      return null;
    }
    
    // Seleccionar una celda vacía aleatoria
    return emptyCells[Math.floor(Math.random() * emptyCells.length)];
  };
  
  // Intenta generar un powerup en el tablero
  const attemptPowerUpSpawn = (forceSpawn: boolean = false): PowerUpInstance | null => {
    // Si ya está generando o no hay espacio o no ha pasado el cooldown
    if (
      isSpawningPowerUpRef.current || 
      !hasSpaceForPowerUp() || 
      (!forceSpawn && !hasCooldownPassed())
    ) {
      return null;
    }
    
    // Determinar si se genera un powerup según la probabilidad
    if (!forceSpawn && Math.random() > calculateCurrentSpawnRate()) {
      return null;
    }
    
    isSpawningPowerUpRef.current = true;
    
    try {
      // Obtener un powerup aleatorio según el nivel y modo de juego
      const powerUp = getRandomPowerUp(levelRef.current, playModeRef.current);
      
      if (!powerUp) {
        return null;
      }
      
      // Encontrar una celda vacía para colocar el powerup
      const emptyCell = findEmptyCell();
      
      if (!emptyCell) {
        return null;
      }
      
      // Crear la instancia del powerup
      const now = Date.now();
      const powerUpInstance: PowerUpInstance = {
        id: uuidv4(),
        type: powerUp.id as PowerUpType,
        row: emptyCell.row,
        col: emptyCell.col,
        createdAt: now,
        expiresAt: powerUp.duration ? now + powerUp.duration : undefined,
        state: 'active'
      };
      
      // Añadir a la lista de powerups activos
      activePowerUpsRef.current.push(powerUpInstance);
      
      // Actualizar el tiempo de la última generación
      lastPowerUpAddedTimeRef.current = now;
      
      return powerUpInstance;
    } finally {
      isSpawningPowerUpRef.current = false;
    }
  };
  
  // Recolectar un powerup por su ID
  const collectPowerUp = (id: string): PowerUpInstance | null => {
    const powerUpIndex = activePowerUpsRef.current.findIndex(p => p.id === id);
    
    if (powerUpIndex === -1) {
      return null;
    }
    
    const powerUp = activePowerUpsRef.current[powerUpIndex];
    powerUp.state = 'collected';
    
    // Remover de la lista de activos
    activePowerUpsRef.current = activePowerUpsRef.current.filter(p => p.id !== id);
    
    return powerUp;
  };
  
  // Resetear el estado del generador de powerups
  const resetPowerUpState = () => {
    activePowerUpsRef.current = [];
    lastPowerUpAddedTimeRef.current = 0;
    isSpawningPowerUpRef.current = false;
  };
  
  return {
    attemptPowerUpSpawn,
    isSpawningPowerUpRef,
    lastPowerUpAddedTimeRef,
    activePowerUpsRef,
    collectPowerUp,
    resetPowerUpState
  };
}; 