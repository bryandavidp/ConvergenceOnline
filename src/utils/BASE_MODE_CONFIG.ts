/**
 * Configuración base para los diferentes modos de juego
 * Este archivo define los parámetros iniciales para cada modo de juego
 */
export const BASE_MODE_CONFIG = {
  classic: {
    baseSpawnRate: 2000,
    spawnRateDecrement: 100,
    minSpawnRate: 500,
    scoreMultiplier: 1,
    baseScoreTarget: 1000
  },
  timed: {
    baseSpawnRate: 1500,
    spawnRateDecrement: 150,
    minSpawnRate: 400,
    scoreMultiplier: 1.2,
    baseTimeTarget: 30
  },
  survival: {
    baseSpawnRate: 1800,
    spawnRateDecrement: 120,
    minSpawnRate: 450,
    scoreMultiplier: 0.8,
    baseSurvivalTarget: 120
  },
  zen: {
    baseSpawnRate: 2500,
    spawnRateDecrement: 50,
    minSpawnRate: 600,
    scoreMultiplier: 0.5,
    baseScoreTarget: 500
  }
}; 