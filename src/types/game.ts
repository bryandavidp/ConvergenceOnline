export enum GamePlayMode {
  CLASSIC = 'Clásico',
  TIME_ATTACK = 'Contrarreloj',
  SURVIVAL = 'Supervivencia',
  ZEN = 'Zen',
  TUTORIAL = 'Tutorial'
}

export enum GameDifficulty {
  VERY_EASY = 'Muy Fácil',
  EASY = 'Fácil',
  MEDIUM = 'Normal',
  HARD = 'Difícil',
  VERY_HARD = 'Muy Difícil'
}

export interface GameState {
  // Propiedades básicas
  score: number;
  level: number;
  lives: number;
  timeLeft: number;
  gameOver: boolean;
  isPaused: boolean;
  isMuted: boolean;

  // Propiedades de juego
  currentPlayMode: GamePlayMode;
  currentDifficulty: GameDifficulty;
  spawnRate: number;
  iconCount: number;
  boardSize: number;
  
  // Estadísticas de juego
  timeElapsed: number;
  movesCount: number;
  matchesCount: number;
  comboCount: number;
  comboMultiplier: number;
  highScore: number;
  
  // Estado del nivel
  gameEndReason?: string;
  levelScoreTarget: number;
  levelOccupationTarget: number;
  availableIcons: string[];
  status: 'playing' | 'paused' | 'gameOver' | 'startScreen';
}

export interface GameConfig {
  difficulty: GameDifficulty;
  mode: GamePlayMode;
  boardSize: number;
  targetScore: number;
  timeLimit?: number;
} 