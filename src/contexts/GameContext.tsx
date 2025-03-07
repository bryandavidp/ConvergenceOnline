import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { GamePlayMode, GameDifficulty, GameState, GameConfig } from '../types/game';

interface GameContextProps {
  gameMode: GamePlayMode;
  setGameMode: (mode: GamePlayMode) => void;
  gameDifficulty: GameDifficulty;
  setGameDifficulty: (difficulty: GameDifficulty) => void;
  isSoundEnabled: boolean;
  setIsSoundEnabled: (enabled: boolean) => void;
  isMusicEnabled: boolean;
  setIsMusicEnabled: (enabled: boolean) => void;
  gameState: GameState;
  updateGameState: (partialState: Partial<GameState>) => void;
  resetGame: () => void;
  gameConfig: GameConfig;
}

const defaultGameState: GameState = {
  score: 0,
  level: 1,
  lives: 3,
  timeLeft: 60,
  gameOver: false,
  isPaused: false,
  isMuted: false
};

const defaultGameConfig: GameConfig = {
  difficulty: GameDifficulty.MEDIUM,
  mode: GamePlayMode.CLASSIC,
  boardSize: 8,
  targetScore: 1000
};

const GameContext = createContext<GameContextProps | undefined>(undefined);

export const GameProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Cargar preferencias del localStorage o usar valores predeterminados
  const [gameMode, setGameMode] = useState<GamePlayMode>(() => {
    const saved = localStorage.getItem('gameMode');
    return saved ? (saved as GamePlayMode) : GamePlayMode.CLASSIC;
  });
  
  const [gameDifficulty, setGameDifficulty] = useState<GameDifficulty>(() => {
    const saved = localStorage.getItem('gameDifficulty');
    return saved ? (saved as GameDifficulty) : GameDifficulty.MEDIUM;
  });
  
  const [isSoundEnabled, setIsSoundEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('soundEnabled');
    return saved !== null ? saved === 'true' : true;
  });
  
  const [isMusicEnabled, setIsMusicEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('musicEnabled');
    return saved !== null ? saved === 'true' : true;
  });
  
  const [gameState, setGameState] = useState<GameState>(defaultGameState);
  const [gameConfig, setGameConfig] = useState<GameConfig>(defaultGameConfig);
  
  // Guardar preferencias en localStorage cuando cambien
  useEffect(() => {
    localStorage.setItem('gameMode', gameMode);
  }, [gameMode]);
  
  useEffect(() => {
    localStorage.setItem('gameDifficulty', gameDifficulty);
  }, [gameDifficulty]);
  
  useEffect(() => {
    localStorage.setItem('soundEnabled', String(isSoundEnabled));
  }, [isSoundEnabled]);
  
  useEffect(() => {
    localStorage.setItem('musicEnabled', String(isMusicEnabled));
  }, [isMusicEnabled]);
  
  // Actualizar la configuración del juego basada en dificultad y modo
  useEffect(() => {
    let boardSize = 8;
    let targetScore = 1000;
    let timeLimit: number | undefined = 60;
    
    // Ajustar según dificultad
    switch (gameDifficulty) {
      case GameDifficulty.EASY:
        boardSize = 6;
        targetScore = 800;
        timeLimit = 90;
        break;
      case GameDifficulty.MEDIUM:
        boardSize = 8;
        targetScore = 1000;
        timeLimit = 60;
        break;
      case GameDifficulty.HARD:
        boardSize = 10;
        targetScore = 1500;
        timeLimit = 45;
        break;
    }
    
    // Ajustar según modo de juego
    switch (gameMode) {
      case GamePlayMode.CLASSIC:
        // Configuración estándar
        break;
      case GamePlayMode.TIME_ATTACK:
        // Menos tiempo pero menor objetivo
        if (timeLimit) {
          timeLimit = Math.floor(timeLimit * 0.8);
        }
        targetScore = Math.floor(targetScore * 0.8);
        break;
      case GamePlayMode.SURVIVAL:
        // Sin límite de nivel pero con dificultad creciente
        timeLimit = 120; // Tiempo inicial más largo
        targetScore = Math.floor(targetScore * 1.5);
        break;
      // Podríamos incluir una lógica especial para ZEN en el futuro si se implementa como un enum
    }
    
    setGameConfig({
      difficulty: gameDifficulty,
      mode: gameMode,
      boardSize,
      targetScore,
      timeLimit
    });
  }, [gameDifficulty, gameMode]);
  
  // Función para actualizar el estado del juego parcialmente
  const updateGameState = (partialState: Partial<GameState>) => {
    setGameState(prevState => ({
      ...prevState,
      ...partialState
    }));
  };
  
  // Función para reiniciar el juego
  const resetGame = () => {
    setGameState(defaultGameState);
  };
  
  return (
    <GameContext.Provider
      value={{
        gameMode,
        setGameMode,
        gameDifficulty,
        setGameDifficulty,
        isSoundEnabled,
        setIsSoundEnabled,
        isMusicEnabled,
        setIsMusicEnabled,
        gameState,
        updateGameState,
        resetGame,
        gameConfig
      }}
    >
      {children}
    </GameContext.Provider>
  );
};

export const useGameContext = () => {
  const context = useContext(GameContext);
  if (context === undefined) {
    throw new Error('useGameContext must be used within a GameProvider');
  }
  return context;
}; 