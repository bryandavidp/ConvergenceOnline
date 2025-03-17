// Tipos de objetos de habilidad disponibles
export type PowerUpType = 
  | 'bombaCruz' 
  | 'bombaArea' 
  | 'congelacion' 
  | 'comodin'
  | 'multiplicadorPuntos'
  | 'tiempoExtra'
  | 'eliminaColor';

// Clase de rareza para los powerups
export type PowerUpRarity = 'comun' | 'raro' | 'epico' | 'legendario';

// Interfaz para la configuración de generación de powerups
export interface PowerUpSpawnConfig {
  baseSpawnRate: number;  // Tasa base de generación (0-1)
  levelMultiplier: number; // Multiplicador basado en nivel
  modeMultipliers: Record<string, number>; // Multiplicadores específicos por modo de juego
  difficultyMultipliers: Record<string, number>; // Multiplicadores por dificultad
  maxPowerUpsOnBoard: number; // Número máximo de powerups permitidos en el tablero a la vez
  cooldownBetweenSpawns: number; // Tiempo mínimo entre generaciones (ms)
}

// Interfaz para la definición de un powerup
export interface PowerUpDefinition {
  id: PowerUpType;
  displayName: string;
  description: string;
  rarity: PowerUpRarity;
  icon: string; // Nombre del icono o SVG a utilizar
  color: string; // Color para representación visual
  duration?: number; // Duración del efecto en ms (si aplica)
  cooldown?: number; // Tiempo de espera antes de poder generar otro igual (ms)
  spawnWeight: number; // Probabilidad relativa de generación
  levelUnlock: number; // Nivel en que se desbloquea este powerup
  compatibleModes: string[]; // Modos de juego compatibles con este powerup
}

// Interfaz para los datos de un powerup en el tablero
export interface PowerUpInstance {
  id: string; // ID único de la instancia
  type: PowerUpType;
  row: number;
  col: number;
  createdAt: number; // timestamp
  expiresAt?: number; // timestamp opcional de expiración
  state: 'active' | 'collected' | 'expired';
}

// Interfaz para los efectos de los powerups
export interface PowerUpEffect {
  // Propiedades específicas del efecto aplicado al juego
  type: PowerUpType;
  startTime: number;
  endTime?: number;
  intensity?: number;
  affected?: {
    rows?: number[];
    cols?: number[];
    cells?: Array<{row: number, col: number}>;
    icons?: string[];
  };
  multiplier?: number;
  isActive: boolean;
} 