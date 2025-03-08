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
  score: number;
  level: number;
  lives: number;
  timeLeft: number;
  gameOver: boolean;
  isPaused: boolean;
  isMuted: boolean;
}

export interface GameConfig {
  difficulty: GameDifficulty;
  mode: GamePlayMode;
  boardSize: number;
  targetScore: number;
  timeLimit?: number;
} 