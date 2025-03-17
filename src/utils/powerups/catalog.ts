import { PowerUpDefinition, PowerUpType } from './types';

// Catálogo de todos los powerups disponibles en el juego
export const POWERUP_CATALOG: Record<PowerUpType, PowerUpDefinition> = {
  bombaCruz: {
    id: 'bombaCruz',
    displayName: 'Bomba Cruz',
    description: 'Elimina todos los íconos en forma de cruz (fila y columna completas)',
    rarity: 'raro',
    icon: 'explosion-cross',
    color: '#FF5A5A',
    spawnWeight: 5,
    levelUnlock: 3,
    compatibleModes: ['classic', 'timed', 'survival', 'zen']
  },
  
  bombaArea: {
    id: 'bombaArea',
    displayName: 'Bomba de Área',
    description: 'Elimina todos los íconos en un área de 3x3 alrededor del objeto',
    rarity: 'comun',
    icon: 'explosion-area',
    color: '#FF8C42',
    spawnWeight: 10,
    levelUnlock: 2,
    compatibleModes: ['classic', 'timed', 'survival', 'zen']
  },
  
  congelacion: {
    id: 'congelacion',
    displayName: 'Congelación',
    description: 'Detiene la generación de nuevos íconos durante 15 segundos',
    rarity: 'epico',
    icon: 'ice-cube',
    color: '#42A5F5',
    duration: 15000,
    spawnWeight: 3,
    levelUnlock: 5,
    compatibleModes: ['survival', 'timed']
  },
  
  comodin: {
    id: 'comodin',
    displayName: 'Comodín',
    description: 'Actúa como cualquier ícono para formar convergencias',
    rarity: 'raro',
    icon: 'joker',
    color: '#42F5BC',
    spawnWeight: 5,
    levelUnlock: 4,
    compatibleModes: ['classic', 'timed', 'survival', 'zen']
  },
  
  multiplicadorPuntos: {
    id: 'multiplicadorPuntos',
    displayName: 'Multiplicador',
    description: 'Multiplica x2 los puntos obtenidos durante 20 segundos',
    rarity: 'epico',
    icon: 'multiplier',
    color: '#E542F5',
    duration: 20000,
    spawnWeight: 3,
    levelUnlock: 6,
    compatibleModes: ['classic', 'timed', 'survival', 'zen']
  },
  
  tiempoExtra: {
    id: 'tiempoExtra',
    displayName: 'Tiempo Extra',
    description: 'Añade 15 segundos al tiempo restante',
    rarity: 'raro',
    icon: 'hourglass',
    color: '#F5D442',
    spawnWeight: 6,
    levelUnlock: 3,
    compatibleModes: ['timed']
  },
  
  eliminaColor: {
    id: 'eliminaColor',
    displayName: 'Elimina Color',
    description: 'Elimina todos los íconos de un color aleatorio del tablero',
    rarity: 'legendario',
    icon: 'color-wipe',
    color: '#9C27B0',
    spawnWeight: 2,
    levelUnlock: 7,
    compatibleModes: ['classic', 'timed', 'survival', 'zen']
  }
};

// Función para obtener powerups disponibles según nivel y modo de juego
export const getAvailablePowerUps = (
  level: number,
  playMode: string
): PowerUpDefinition[] => {
  return Object.values(POWERUP_CATALOG).filter(
    powerup => 
      powerup.levelUnlock <= level && 
      powerup.compatibleModes.includes(playMode)
  );
};

// Función para obtener un powerup aleatorio según nivel y modo
export const getRandomPowerUp = (
  level: number,
  playMode: string
): PowerUpDefinition | null => {
  const available = getAvailablePowerUps(level, playMode);
  
  if (available.length === 0) {
    return null;
  }
  
  // Sistema basado en pesos para la rareza
  const totalWeight = available.reduce((sum, powerup) => sum + powerup.spawnWeight, 0);
  let random = Math.random() * totalWeight;
  
  for (const powerup of available) {
    random -= powerup.spawnWeight;
    if (random <= 0) {
      return powerup;
    }
  }
  
  return available[0]; // Fallback
}; 