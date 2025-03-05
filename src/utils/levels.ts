import { GameDifficulty, GamePlayMode } from '../store/slices/gameSlice';
import { BASE_MODE_CONFIG } from './BASE_MODE_CONFIG';

// Interfaces para la configuración de niveles
export interface LevelRequirement {
  type: 'score' | 'occupation' | 'time';
  value: number;
  description: string;
}

export interface LevelReward {
  type: 'points' | 'hint' | 'powerup';
  value: number;
  description: string;
}

export interface SpecialFeature {
  type: 'specialIcon' | 'bonus' | 'powerup' | 'obstacle';
  enabled: boolean;
  config?: any;
}

export interface LevelConfig {
  id: number;
  boardSize: number;
  icons: string[];
  spawnRate: number;
  speedMultiplier: number;
  penaltyIcons: number; // Número de iconos a añadir como penalización por clic incorrecto
  requirements: {
    classic: LevelRequirement[];
    timed: LevelRequirement[];
    survival: LevelRequirement[];
    zen?: LevelRequirement[];
  };
  rewards: {
    classic?: LevelReward[];
    timed?: LevelReward[];
    survival?: LevelReward[];
    zen?: LevelReward[];
  };
  specialFeatures?: {
    specialIcons?: SpecialFeature;
    bonusItems?: SpecialFeature;
    powerUps?: SpecialFeature;
    obstacles?: SpecialFeature;
  };
}

// Multiplicadores para las diferentes dificultades
export const DIFFICULTY_MULTIPLIERS = {
  easy: {
    spawnRate: 1.3,
    scoreRequirement: 0.7,
    timeRequirement: 0.8
  },
  normal: {
    spawnRate: 1.0,
    scoreRequirement: 1.0,
    timeRequirement: 1.0
  },
  hard: {
    spawnRate: 0.7,
    scoreRequirement: 1.3,
    timeRequirement: 1.2
  },
  tutorial: {
    spawnRate: 2.0,
    scoreRequirement: 0.5,
    timeRequirement: 0.5
  }
};

// Tiempo mínimo (en segundos) para validar completado de nivel
export const minTimeToValidate = 3;

// Niveles predefinidos con configuraciones específicas
export const PREDEFINED_LEVELS: LevelConfig[] = [
  // Nivel 1 - Introducción
  {
    id: 1,
    boardSize: 5,
    icons: ["🌶️", "🍌", "🍊", "🥑"],
    spawnRate: 2000,
    speedMultiplier: 1.0,
    penaltyIcons: 1,
    requirements: {
      classic: [
        { type: 'score', value: 1500, description: 'Alcanza 1500 puntos' },
        { type: 'occupation', value: 5, description: 'Mantén ocupación menor al 5%' }
      ],
      timed: [
        { type: 'time', value: 30, description: 'Sobrevive 30 segundos' }
      ],
      survival: [
        { type: 'time', value: 120, description: 'Sobrevive 2 minutos' }
      ],
      zen: [
        { type: 'time', value: 0, description: 'Juega sin presión' }
      ]
    },
    rewards: {
      classic: [
        { type: 'points', value: 500, description: 'Bonus de nivel' }
      ],
      zen: [
        { type: 'points', value: 100, description: 'Bonus de zen' }
      ]
    }
  },
  
  // Nivel 2 - Más iconos
  {
    id: 2,
    boardSize: 6,
    icons: ["🍎", "🍇", "🍊", "🍓", "🍉"],
    spawnRate: 1800,
    speedMultiplier: 1.1,
    penaltyIcons: 2,
    requirements: {
      classic: [
        { type: 'score', value: 2000, description: 'Alcanza 2000 puntos' },
        { type: 'occupation', value: 15, description: 'Mantén ocupación menor al 15%' }
      ],
      timed: [
        { type: 'time', value: 45, description: 'Sobrevive 45 segundos' }
      ],
      survival: [
        { type: 'time', value: 180, description: 'Sobrevive 3 minutos' }
      ],
      zen: [
        { type: 'time', value: 0, description: 'Juega sin presión' }
      ]
    },
    rewards: {
      classic: [
        { type: 'points', value: 750, description: 'Bonus de nivel' }
      ],
      zen: [
        { type: 'points', value: 150, description: 'Bonus de zen' }
      ]
    }
  },
  
  // Nivel 3 - Introduce iconos especiales
  {
    id: 3,
    boardSize: 7,
    icons: ["🍎", "🍇", "🍊", "🍓", "🍉", "🍌"],
    spawnRate: 1600,
    speedMultiplier: 1.2,
    penaltyIcons: 3,
    requirements: {
      classic: [
        { type: 'score', value: 3000, description: 'Alcanza 3000 puntos' },
        { type: 'occupation', value: 15, description: 'Mantén ocupación menor al 15%' }
      ],
      timed: [
        { type: 'time', value: 60, description: 'Sobrevive 1 minuto' }
      ],
      survival: [
        { type: 'time', value: 240, description: 'Sobrevive 4 minutos' }
      ],
      zen: [
        { type: 'time', value: 0, description: 'Juega sin presión' }
      ]
    },
    rewards: {
      classic: [
        { type: 'points', value: 1000, description: 'Bonus de nivel' }
      ],
      zen: [
        { type: 'points', value: 200, description: 'Bonus de zen' }
      ]
    },
    specialFeatures: {
      specialIcons: {
        type: 'specialIcon',
        enabled: true,
        config: {
          probability: 0.05,
          types: ['bomb', 'star']
        }
      }
    }
  },
  
  // Nivel 4 - Introduce bonus items
  {
    id: 4,
    boardSize: 8,
    icons: ["🍎", "🍇", "🍊", "🍓", "🍉", "🍌", "🍋"],
    spawnRate: 1400,
    speedMultiplier: 1.3,
    penaltyIcons: 3,
    requirements: {
      classic: [
        { type: 'score', value: 4000, description: 'Alcanza 4000 puntos' },
        { type: 'occupation', value: 15, description: 'Mantén ocupación menor al 15%' }
      ],
      timed: [
        { type: 'time', value: 75, description: 'Sobrevive 1 minuto y 15 segundos' }
      ],
      survival: [
        { type: 'time', value: 300, description: 'Sobrevive 5 minutos' }
      ],
      zen: [
        { type: 'time', value: 0, description: 'Juega sin presión' }
      ]
    },
    rewards: {
      classic: [
        { type: 'points', value: 1500, description: 'Bonus de nivel' },
        { type: 'hint', value: 1, description: 'Pista adicional' }
      ],
      zen: [
        { type: 'points', value: 300, description: 'Bonus de zen' },
        { type: 'hint', value: 1, description: 'Pista adicional' }
      ]
    },
    specialFeatures: {
      specialIcons: {
        type: 'specialIcon',
        enabled: true,
        config: {
          probability: 0.07,
          types: ['bomb', 'star', 'rainbow']
        }
      },
      bonusItems: {
        type: 'bonus',
        enabled: true,
        config: {
          probability: 0.03,
          types: ['points', 'time']
        }
      }
    }
  },
  
  // Nivel 5 - Introduce power-ups
  {
    id: 5,
    boardSize: 9,
    icons: ["🍎", "🍇", "🍊", "🍓", "🍉", "🍌", "🍋", "🍍"],
    spawnRate: 1200,
    speedMultiplier: 1.4,
    penaltyIcons: 4,
    requirements: {
      classic: [
        { type: 'score', value: 5000, description: 'Alcanza 5000 puntos' },
        { type: 'occupation', value: 15, description: 'Mantén ocupación menor al 15%' }
      ],
      timed: [
        { type: 'time', value: 90, description: 'Sobrevive 1 minuto y 30 segundos' }
      ],
      survival: [
        { type: 'time', value: 360, description: 'Sobrevive 6 minutos' }
      ],
      zen: [
        { type: 'time', value: 0, description: 'Juega sin presión' }
      ]
    },
    rewards: {
      classic: [
        { type: 'points', value: 2000, description: 'Bonus de nivel' },
        { type: 'hint', value: 2, description: 'Pistas adicionales' }
      ],
      zen: [
        { type: 'points', value: 400, description: 'Bonus de zen' },
        { type: 'hint', value: 1, description: 'Pista adicional' }
      ]
    },
    specialFeatures: {
      specialIcons: {
        type: 'specialIcon',
        enabled: true,
        config: {
          probability: 0.08,
          types: ['bomb', 'star', 'rainbow', 'clock']
        }
      },
      bonusItems: {
        type: 'bonus',
        enabled: true,
        config: {
          probability: 0.05,
          types: ['points', 'time', 'hint']
        }
      },
      powerUps: {
        type: 'powerup',
        enabled: true,
        config: {
          probability: 0.03,
          types: ['slowdown', 'clear']
        }
      }
    }
  }
];

// Funciones de utilidad para acceder a la configuración de los niveles

/**
 * Verifica si un nivel tiene alguna característica especial
 */
export function hasSpecialFeatures(level: number): boolean {
  if (level > 2) return true;
  return false;
}

/**
 * Genera un nivel dinámico para niveles que no están predefinidos
 */
export function generateDynamicLevel(level: number): LevelConfig {
  const baseIconCount = 4;
  const additionalIcons = Math.min(6, Math.floor((level - 1) / 2));
  const iconCount = baseIconCount + additionalIcons;
  
  // Configuración base que escala con el nivel
  const dynamicConfig: LevelConfig = {
    id: level,
    boardSize: Math.min(12, 5 + Math.floor(level / 2)),
    icons: Array.from({length: iconCount}, (_, i) => {
      const allIcons = ["🍎", "🍇", "🍊", "🍓", "🍉", "🍌", "🍋", "🍍", "🍑", "🍒"];
      return allIcons[i % allIcons.length];
    }),
    spawnRate: Math.max(500, 2000 - (level * 100)),
    speedMultiplier: 1 + (level * 0.1),
    penaltyIcons: Math.min(5, 1 + Math.floor(level / 2)),
    requirements: {
      classic: [
        { 
          type: 'score', 
          value: 1000 * level, 
          description: `Alcanza ${1000 * level} puntos` 
        },
        { 
          type: 'occupation', 
          value: 15, 
          description: 'Mantén ocupación menor al 15%' 
        }
      ],
      timed: [
        { 
          type: 'time', 
          value: 30 + (level * 15), 
          description: `Sobrevive ${30 + (level * 15)} segundos` 
        }
      ],
      survival: [
        { 
          type: 'time', 
          value: 120 + (level * 60), 
          description: `Sobrevive ${(120 + (level * 60)) / 60} minutos` 
        }
      ],
      zen: [
        { 
          type: 'time', 
          value: 0, 
          description: 'Juega sin presión' 
        }
      ]
    },
    rewards: {
      classic: [
        { 
          type: 'points', 
          value: 500 * level, 
          description: 'Bonus de nivel' 
        }
      ],
      zen: [
        {
          type: 'points',
          value: 100 * level,
          description: 'Bonus de zen'
        }
      ]
    }
  };
  
  // Añadir características especiales según el nivel
  const specialFeatures: any = {};
  
  // Iconos especiales desde nivel 3
  if (level >= 3) {
    specialFeatures.specialIcons = {
      type: 'specialIcon',
      enabled: true,
      config: {
        probability: 0.7 + (level * 0.01),
        types: ['bomb', 'star']
      }
    };
    
    // Añadir más tipos de iconos especiales en niveles superiores
    if (level >= 4) specialFeatures.specialIcons.config.types.push('rainbow');
    if (level >= 5) specialFeatures.specialIcons.config.types.push('clock');
  }
  
  // Bonus items desde nivel 4
  if (level >= 4) {
    specialFeatures.bonusItems = {
      type: 'bonus',
      enabled: true,
      config: {
        probability: 0.03 + (level * 0.005),
        types: ['points', 'time']
      }
    };
    
    // Añadir más tipos de bonus en niveles superiores
    if (level >= 5) specialFeatures.bonusItems.config.types.push('hint');
  }
  
  // Power-ups desde nivel 5
  if (level >= 5) {
    specialFeatures.powerUps = {
      type: 'powerup',
      enabled: true,
      config: {
        probability: 0.03 + ((level - 5) * 0.005),
        types: ['slowdown', 'clear']
      }
    };
    
    // Añadir más tipos de power-ups en niveles superiores
    if (level >= 7) specialFeatures.powerUps.config.types.push('freeze');
    if (level >= 9) specialFeatures.powerUps.config.types.push('double');
  }
  
  // Obstáculos desde nivel 6
  if (level >= 6) {
    specialFeatures.obstacles = {
      type: 'obstacle',
      enabled: true,
      config: {
        probability: 0.02 + ((level - 6) * 0.003),
        types: ['stone']
      }
    };
    
    // Añadir más tipos de obstáculos en niveles superiores
    if (level >= 8) specialFeatures.obstacles.config.types.push('ice');
    if (level >= 10) specialFeatures.obstacles.config.types.push('lock');
  }
  
  if (Object.keys(specialFeatures).length > 0) {
    dynamicConfig.specialFeatures = specialFeatures;
  }
  
  return dynamicConfig;
}

/**
 * Obtiene la configuración de un nivel específico
 */
export function getLevelConfig(
  level: number,
  playMode: GamePlayMode,
  difficulty: GameDifficulty
): LevelConfig {
  // Primero intentamos obtener un nivel predefinido
  const predefinedLevel = PREDEFINED_LEVELS.find(l => l.id === level);
  
  // Si existe, lo utilizamos como base
  const baseConfig = predefinedLevel || generateDynamicLevel(level);
  
  // Ajustar según dificultad
  const difficultyMod = DIFFICULTY_MULTIPLIERS[difficulty];
  
  // Crear una copia para no modificar el original
  const adjustedConfig = JSON.parse(JSON.stringify(baseConfig)) as LevelConfig;
  
  // Ajustar spawnRate según dificultad
  adjustedConfig.spawnRate = Math.round(adjustedConfig.spawnRate * difficultyMod.spawnRate);
  
  // Asegurarse de que existen requisitos para el modo de juego seleccionado
  // Si no existen, copiar los del modo clásico o crear unos básicos
  if (!adjustedConfig.requirements[playMode] || adjustedConfig.requirements[playMode].length === 0) {
    if (playMode === 'zen') {
      // Para el modo zen, crear requisitos básicos sin objetivos específicos
      adjustedConfig.requirements.zen = [
        { type: 'time', value: 0, description: 'Juega sin presión' }
      ];
    } else if (adjustedConfig.requirements.classic) {
      // Para otros modos, copiar los del clásico si existen
      adjustedConfig.requirements[playMode] = [...adjustedConfig.requirements.classic];
    } else {
      // Si no hay requisitos clásicos, crear algo básico
      adjustedConfig.requirements[playMode] = [
        { type: 'score', value: 1000 * level, description: `Alcanza ${1000 * level} puntos` }
      ];
    }
  }
  
  // Ajustar requisitos según dificultad
  const modeRequirements = adjustedConfig.requirements[playMode];
  if (modeRequirements) {
    modeRequirements.forEach(req => {
      if (req.type === 'score') {
        req.value = Math.round(req.value * difficultyMod.scoreRequirement);
        req.description = `Alcanza ${req.value} puntos`;
      } else if (req.type === 'time') {
        // Para el modo zen, no ajustar requisitos de tiempo
        if (playMode !== 'zen') {
          req.value = Math.round(req.value * difficultyMod.timeRequirement);
          req.description = `Sobrevive ${req.value >= 60 ? `${Math.floor(req.value/60)} minuto${req.value >= 120 ? 's' : ''}` : ''}${req.value % 60 > 0 ? (req.value >= 60 ? ' y ' : '') + `${req.value % 60} segundo${req.value % 60 !== 1 ? 's' : ''}` : ''}`;
        }
      }
    });
  }
  
  return adjustedConfig;
}

/**
 * Obtiene el tamaño del tablero para un nivel específico
 */
export function getLevelBoardSize(level: number, playMode: GamePlayMode = 'classic'): number {
  // Intenta encontrar el nivel predefinido
  const predefinedLevel = PREDEFINED_LEVELS.find(l => l.id === level);
  
  if (predefinedLevel) {
    return predefinedLevel.boardSize;
  }
  
  // Para niveles dinámicos, calculamos el tamaño
  return Math.min(12, 5 + Math.floor(level / 2));
}

/**
 * Obtiene los iconos para un nivel específico
 */
export function getLevelIcons(level: number, playMode: GamePlayMode = 'classic'): string[] {
  // Intenta encontrar el nivel predefinido
  const predefinedLevel = PREDEFINED_LEVELS.find(l => l.id === level);
  
  if (predefinedLevel) {
    return [...predefinedLevel.icons];
  }
  
  // Para niveles dinámicos, generamos iconos
  const baseIconCount = 4;
  const additionalIcons = Math.min(6, Math.floor((level - 1) / 2));
  const iconCount = baseIconCount + additionalIcons;
  
  return Array.from({length: iconCount}, (_, i) => {
    const allIcons = ["🍎", "🍇", "🍊", "🍓", "🍉", "🍌", "🍋", "🍍", "🍑", "🍒"];
    return allIcons[i % allIcons.length];
  });
}

/**
 * Obtiene la velocidad de aparición para un nivel específico
 */
export function getLevelSpawnRate(
  level: number,
  playMode: GamePlayMode = 'classic',
  difficulty: GameDifficulty = 'normal'
): number {
  // Intenta encontrar el nivel predefinido
  const predefinedLevel = PREDEFINED_LEVELS.find(l => l.id === level);
  
  let baseRate;
  if (predefinedLevel) {
    baseRate = predefinedLevel.spawnRate;
  } else {
    // Para niveles dinámicos, calculamos la velocidad
    baseRate = Math.max(500, 2000 - (level * 100));
  }
  
  // Ajustar según dificultad
  const difficultyMod = DIFFICULTY_MULTIPLIERS[difficulty];
  return Math.round(baseRate * difficultyMod.spawnRate);
}

/**
 * Obtiene el multiplicador de velocidad para un nivel específico
 */
export function getLevelSpeedMultiplier(
  level: number,
  playMode: GamePlayMode = 'classic'
): number {
  // Intenta encontrar el nivel predefinido
  const predefinedLevel = PREDEFINED_LEVELS.find(l => l.id === level);
  
  if (predefinedLevel) {
    return predefinedLevel.speedMultiplier;
  }
  
  // Para niveles dinámicos, calculamos el multiplicador
  return 1 + (level * 0.1);
}

/**
 * Verifica si un nivel tiene una característica especial específica
 */
export function hasSpecialFeature(level: number, featureType: string): boolean {
  const config = getLevelConfig(level, 'classic', 'normal');
  if (!config.specialFeatures) return false;
  
  const feature = config.specialFeatures[featureType as keyof typeof config.specialFeatures];
  return feature ? feature.enabled : false;
} 