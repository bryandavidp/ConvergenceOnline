import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import logger from '../../utils/logger';
import * as config from '../../utils/config';
// import { fetchGameState, updateGameState } from '../thunks/gameThunks';

// Definición de tipos para los modos de juego
export type GameDifficulty = 'easy' | 'normal' | 'hard' | 'tutorial';
export type GamePlayMode = 'classic' | 'timed' | 'survival' | 'zen' | 'tutorial';

export interface GameState {
  score: number;
  highScore: number;
  level: number;
  timer: number;
  board: (string | null)[][];
  status: 'idle' | 'playing' | 'paused' | 'levelCompleted' | 'gameOver' | 'startScreen';
  error: string | null;
  spawnRate: number;
  iconCount: number;
  currentDifficulty: GameDifficulty;
  currentPlayMode: GamePlayMode;
  boardSize: number;
  availableIcons: string[];
  hintsRemaining: number;
  hintCooldown: boolean;
  lastHintTime: number;
  canEmptyBoardBonus: boolean;
  speedMultiplier: number;
  highlightedCells: {row: number, col: number}[];
  // Sistema de combos
  comboCount: number;         // Número actual de combos consecutivos
  comboMultiplier: number;    // Multiplicador actual basado en el contador de combos
  comboTimestamp: number;     // Timestamp de la última eliminación para calcular ventana de combo
  comboTimeWindow: number;    // Ventana de tiempo para considerar combos consecutivos (en ms)
  lastComboPoints: number;     // Nuevo campo para almacenar los últimos puntos calculados con el combo
  // Preferencias de interfaz
  darkMode: boolean;
  // Nuevas propiedades para los modos de juego
  // Modo contrarreloj
  timeRemaining: number; // Tiempo restante en segundos para el modo contrarreloj
  levelTimeLimit: number; // Tiempo límite para el nivel actual en modo contrarreloj
  // Modo supervivencia
  survivalTime: number; // Tiempo transcurrido en modo supervivencia
  specialIconsEnabled: boolean; // Si los iconos especiales están habilitados en modo supervivencia
  // Objetivos por nivel
  levelScoreTarget: number; // Puntuación objetivo para pasar de nivel en modo clásico
  levelOccupationTarget: number; // Porcentaje de ocupación objetivo para el nivel en modo clásico
  // Nueva propiedad para almacenar el motivo de fin de juego o nivel completado
  gameEndReason: string;
}

const initialState: GameState = {
  score: 0,
  highScore: 0,
  level: 1,
  timer: 0,
  board: Array(8).fill(null).map(() => Array(8).fill(null)), // Inicializar como matriz 8x8 vacía
  status: 'startScreen',
  error: null,
  spawnRate: 3000, // Tiempo entre generación de iconos en ms
  iconCount: 0,
  currentDifficulty: 'normal',
  currentPlayMode: 'classic',
  boardSize: 8,
  // Usar la configuración centralizada para los iconos del nivel 1
  availableIcons: config.getIconSetForLevel(1),
  hintsRemaining: 3,
  hintCooldown: false,
  lastHintTime: 0,
  canEmptyBoardBonus: true,
  speedMultiplier: 1,
  highlightedCells: [],
  // Sistema de combos
  comboCount: 0,
  comboMultiplier: 1.0,
  comboTimestamp: 0,
  comboTimeWindow: 2500, // 2.5 segundos por defecto
  lastComboPoints: 0, // Inicializar en cero
  // Valores iniciales para las nuevas propiedades
  timeRemaining: config.BASE_GAME_DURATION, // 3 minutos por defecto
  levelTimeLimit: config.BASE_GAME_DURATION,
  survivalTime: 0,
  specialIconsEnabled: false,
  levelScoreTarget: 1000, // Puntuación objetivo inicial
  levelOccupationTarget: 70, // Porcentaje de ocupación objetivo inicial
  darkMode: false,
  // Nueva propiedad para almacenar el motivo de fin de juego o nivel completado
  gameEndReason: '',
};

// Función para inicializar el estado del juego
function initializeGameState(): GameState {
  try {
    // Intentar cargar el modo oscuro desde localStorage
    const savedDarkMode = localStorage.getItem('darkMode');
    const initialDarkMode = savedDarkMode ? savedDarkMode === 'true' : false;
    
    // Intentar cargar la puntuación máxima desde localStorage
    const savedHighScore = localStorage.getItem('highScore');
    const initialHighScore = savedHighScore ? parseInt(savedHighScore) : 0;
    
    // Crear un tablero vacío inicializado con el tamaño por defecto
    const emptyBoard = Array(initialState.boardSize).fill(null).map(() => 
      Array(initialState.boardSize).fill(null)
    );
    
    return {
      ...initialState,
      darkMode: initialDarkMode,
      highScore: initialHighScore,
      board: emptyBoard // Asegurar que el tablero esté correctamente inicializado
    };
  } catch (error) {
    logger.error('Game', 'Error al inicializar el estado del juego:', error);
    
    // Incluso en caso de error, asegurar que el tablero esté inicializado
    const emptyBoard = Array(initialState.boardSize).fill(null).map(() => 
      Array(initialState.boardSize).fill(null)
    );
    
    return {
      ...initialState,
      board: emptyBoard
    };
  }
}

const gameSlice = createSlice({
  name: 'game',
  initialState: initializeGameState(),
  reducers: {
    incrementScore: (state, action: PayloadAction<number>) => {
      state.score += action.payload;
      if (state.score > state.highScore) {
        state.highScore = state.score;
        // Guardar puntuación máxima en localStorage
        localStorage.setItem('highScore', state.highScore.toString());
      }
      logger.info('Game', `Puntuación incrementada en ${action.payload}`, { score: state.score });
    },
    
    updateBoard: (state, action: PayloadAction<(string | null)[][]>) => {
      // Crear una copia del nuevo tablero
      const newBoard = action.payload;
      
      // Proteger iconos recién añadidos solo si estamos en estado de juego activo o pausado
      if (state.status === 'playing' || state.status === 'paused') {
        for (let i = 0; i < state.boardSize; i++) {
          for (let j = 0; j < state.boardSize; j++) {
            // Si la celda actual tiene un icono y la nueva está vacía,
            // verificar si debemos preservar el icono actual (puede ser un icono recién añadido)
            const currentCellValue = state.board[i][j];
            const newCellValue = newBoard[i][j];
            
            // Si el icono actual no está marcado para eliminar pero el nuevo tablero lo eliminaría,
            // esto podría ser un icono recién añadido que debe preservarse
            if (currentCellValue && 
                !currentCellValue.includes('_removing') && 
                newCellValue === null) {
              // Esta situación puede ocurrir cuando un icono aleatorio aparece justo cuando
              // se está eliminando una convergencia
              logger.debug('Game', `Preservando icono en [${i},${j}]: ${currentCellValue}`);
              newBoard[i][j] = currentCellValue;
            }
          }
        }
      }
      
      // Siempre actualizar el tablero, independientemente del estado
      state.board = newBoard;
      logger.debug('Game', `Tablero actualizado (Estado: ${state.status})`);
      
      // Verificar si el tablero está vacío para la bonificación, solo si estamos jugando
      if (state.canEmptyBoardBonus && state.status === 'playing') {
        let isEmpty = true;
        let iconCount = 0;
        
        for (let i = 0; i < state.boardSize; i++) {
          for (let j = 0; j < state.boardSize; j++) {
            if (state.board[i][j] !== null) {
              isEmpty = false;
              iconCount++;
            }
          }
        }
        
        // Actualizar el conteo de iconos para que esté sincronizado con el estado real del tablero
        state.iconCount = iconCount;
        
        // Si el tablero está vacío, dar la bonificación
        if (isEmpty && iconCount === 0) {
          state.score += config.SCORE_VALUES.EMPTY_BOARD_BONUS;
          state.canEmptyBoardBonus = false; // Solo una vez por nivel
          logger.info('Game', `¡Bonificación de tablero vacío! +${config.SCORE_VALUES.EMPTY_BOARD_BONUS} puntos`);
        }
      }
    },
    
    setBoardSize: (state, action: PayloadAction<number>) => {
      state.boardSize = action.payload;
      logger.info('Game', `Tamaño del tablero actualizado a ${action.payload}x${action.payload}`);
    },
    
    setIconCount: (state, action: PayloadAction<number>) => {
      state.iconCount = action.payload;
      logger.debug('Game', `Contador de iconos actualizado a ${action.payload}`);
    },
    
    setAvailableIcons: (state, action: PayloadAction<string[]>) => {
      state.availableIcons = action.payload;
      logger.info('Game', 'Iconos disponibles actualizados', { icons: action.payload });
    },
    
    setLevel: (state, action: PayloadAction<number>) => {
      const newLevel = action.payload;
      
      console.log("\n**********************************************************");
      console.log("INICIO DEL FLUJO: CAMBIO DE NIVEL");
      console.log(`Cambiando de nivel ${state.level} a nivel ${newLevel}`);
      console.log(`Modo: ${state.currentPlayMode}, Dificultad: ${state.currentDifficulty}`);
      console.log("**********************************************************");
      
      // Establecer el nuevo nivel
      state.level = newLevel;
      console.log("Fase 1: Nivel actualizado en el estado");
      
      // Actualizar los iconos disponibles para este nivel y dificultad
      const newIcons = config.getIconsForLevel(newLevel, state.currentDifficulty);
      state.availableIcons = newIcons;
      console.log(`Fase 2: Iconos actualizados para nivel ${newLevel}: ${newIcons.slice(0, 8).join(', ')}${newIcons.length > 8 ? '...' : ''}`);
      
      // Reiniciar bonificaciones y pistas
      state.canEmptyBoardBonus = true;
      state.hintsRemaining = config.HINT_SYSTEM.MAX_HINTS_PER_LEVEL;
      console.log("Fase 3: Bonificaciones y pistas reiniciadas");
      
      // Reiniciar contador de iconos para nuevo nivel (tablero vacío)
      state.iconCount = 0;
      
      // Establecer el tamaño del tablero según el nivel
      if (config.BOARD_SIZES.length >= newLevel) {
        state.boardSize = config.BOARD_SIZES[newLevel - 1];
        console.log(`Fase 4: Tablero redimensionado a ${state.boardSize}x${state.boardSize}`);
      }
      
      // Ajustar la velocidad según el nivel y modo de juego
      let newSpawnRate = 0;
      if (state.currentPlayMode === 'tutorial') {
        // Modo tutorial: Siempre muy lento para facilitar el aprendizaje
        newSpawnRate = config.SPAWN_RATES.VERY_SLOW;
      } else if (state.currentPlayMode === 'classic') {
        // Modo clásico: Cada nivel es un 10% más rápido
        newSpawnRate = Math.max(
          config.MIN_SPAWN_RATE,
          config.SPAWN_RATES.SLOW - ((newLevel - 1) * 150)
        );
      } else if (state.currentPlayMode === 'timed') {
        // Modo contrarreloj: Cada nivel es un 15% más rápido
        newSpawnRate = Math.max(
          config.MIN_SPAWN_RATE, 
          config.SPAWN_RATES.MEDIUM - ((newLevel - 1) * 200)
        );
      } else if (state.currentPlayMode === 'survival') {
        // Modo supervivencia: Comienza más lento pero acelera durante el juego
        newSpawnRate = Math.max(
          config.MIN_SPAWN_RATE,
          config.SPAWN_RATES.VERY_SLOW - ((newLevel - 1) * 100)
        );
      } else {
        // Modo zen o cualquier otro: Mantener velocidad consistente
        newSpawnRate = config.SPAWN_RATES.SLOW;
      }
      
      // Actualizar velocidad de spawn
      state.spawnRate = newSpawnRate;
      state.speedMultiplier = Number((config.INITIAL_SPAWN_RATE / newSpawnRate).toFixed(1));
      console.log(`Fase 5: Velocidad de spawn ajustada a ${newSpawnRate}ms (multiplicador: ${state.speedMultiplier}x)`);
      
      // Ajustar objetivos según el modo de juego
      if (state.currentPlayMode === 'classic') {
        state.levelScoreTarget = config.LEVEL_REQUIREMENTS.classic.baseScore * 
                               Math.pow(config.LEVEL_REQUIREMENTS.classic.scoreMultiplier, newLevel - 1);
        state.levelOccupationTarget = Math.max(
          30, 
          config.LEVEL_REQUIREMENTS.classic.baseOccupation - 
          (newLevel * config.LEVEL_REQUIREMENTS.classic.occupationDecrease)
        );
        console.log(`Fase 6: Objetivos establecidos - Puntuación: ${state.levelScoreTarget}, Ocupación: ${state.levelOccupationTarget}%`);
      } else if (state.currentPlayMode === 'timed') {
        const timeLimit = config.LEVEL_REQUIREMENTS.timed.baseTime - 
                           (newLevel - 1) * config.LEVEL_REQUIREMENTS.timed.timeDecreasePerLevel;
        state.timeRemaining = Math.max(30, timeLimit);
        state.levelTimeLimit = Math.max(30, timeLimit);
        console.log(`Fase 6: Tiempo establecido para el nivel: ${state.timeRemaining} segundos`);
      } else {
        console.log(`Fase 6: Sin objetivos específicos para el modo ${state.currentPlayMode}`);
      }
      
      // Crear tablero vacío para el nuevo nivel
      state.board = Array(state.boardSize).fill(null).map(() => Array(state.boardSize).fill(null));
      console.log(`Fase 7: Tablero vacío creado (${state.boardSize}x${state.boardSize})`);
      
      // Limpiar las celdas resaltadas
      state.highlightedCells = [];
      
      console.log("**********************************************************\n");
      console.log(`FIN DEL FLUJO: NIVEL ${newLevel} CONFIGURADO CORRECTAMENTE`);
    },
    
    incrementTimer: (state) => {
      state.timer += 1;
      
      // En modo supervivencia, también incrementamos el tiempo de supervivencia
      if (state.currentPlayMode === 'survival' && state.status === 'playing') {
        state.survivalTime += 1;
      }
    },
    
    decrementTimeRemaining: (state) => {
      // Solo aplica para el modo contrarreloj
      if (state.currentPlayMode === 'timed' && state.status === 'playing') {
        if (state.timeRemaining > 0) {
          state.timeRemaining -= 1;
          
          // Verificar si se agotó el tiempo
          if (state.timeRemaining === 0) {
            state.status = 'gameOver';
            logger.info('Game', 'Tiempo agotado en modo contrarreloj');
          }
        }
      }
    },
    
    setLevelTimeLimit: (state, action: PayloadAction<number>) => {
      state.levelTimeLimit = action.payload;
      state.timeRemaining = action.payload;
      logger.info('Game', `Tiempo límite del nivel establecido a ${action.payload} segundos`);
    },
    
    addTimeBonus: (state, action: PayloadAction<number>) => {
      // Solo aplica para el modo contrarreloj
      if (state.currentPlayMode === 'timed') {
        state.timeRemaining += action.payload;
        logger.info('Game', `Bonificación de tiempo: +${action.payload} segundos`);
      }
    },
    
    setLevelTarget: (state, action: PayloadAction<{ score?: number, occupation?: number }>) => {
      if (action.payload.score !== undefined) {
        state.levelScoreTarget = action.payload.score;
      }
      
      if (action.payload.occupation !== undefined) {
        state.levelOccupationTarget = action.payload.occupation;
      }
      
      logger.info('Game', 'Objetivos de nivel actualizados', {
        puntuación: state.levelScoreTarget,
        ocupación: state.levelOccupationTarget
      });
    },
    
    setSpawnRate: (state, action: PayloadAction<number>) => {
      // Validar que el nuevo valor es razonable
      const minRate = 300; // No permitir velocidades demasiado rápidas
      const maxRate = 6000; // No permitir velocidades demasiado lentas
      const validatedRate = Math.max(minRate, Math.min(maxRate, action.payload));
      
      // Comprobar si realmente hay un cambio significativo
      if (Math.abs(state.spawnRate - validatedRate) < 50) {
        // Cambio muy pequeño, probablemente no perceptible
        logger.debug('Game', `Cambio de velocidad ignorado por ser muy pequeño: ${state.spawnRate}ms → ${validatedRate}ms`);
        return;
      }
      
      // Establecer la nueva velocidad de aparición
      const oldRate = state.spawnRate;
      state.spawnRate = validatedRate;
      
      // Actualizar el multiplicador de velocidad usando SPAWN_RATES.MEDIUM como base
      // para mantener consistencia en todo el código
      const baseSpeed = config.SPAWN_RATES.MEDIUM; // 2000ms
      
      // Calcular el multiplicador (un valor más pequeño significa aparición más rápida)
      state.speedMultiplier = parseFloat((baseSpeed / validatedRate).toFixed(1));
      
      logger.info('Game', `Velocidad de aparición ajustada de ${oldRate}ms a ${validatedRate}ms (${state.speedMultiplier}x)`);
    },
    
    increaseSpeed: (state, action: PayloadAction<number>) => {
      // Incrementar velocidad (disminuir el tiempo entre apariciones)
      const speedIncrease = action.payload || 0.1;
      const minRate = 300; // Límite mínimo ajustado para evitar velocidades imposibles
      const currentRate = state.spawnRate;
      const baseSpeed = config.SPAWN_RATES.MEDIUM;
      
      // Obtener la configuración del modo actual
      const modeConfig = state.currentPlayMode.toUpperCase() === 'CLASSIC' 
        ? config.GAME_MODES.CLASSIC 
        : state.currentPlayMode.toUpperCase() === 'TIMED'
          ? config.GAME_MODES.TIMED
          : config.GAME_MODES.SURVIVAL;
      
      // Obtener el multiplicador máximo permitido para este modo
      const maxMultiplier = modeConfig.maxSpeedMultiplier || config.MAX_SPEED_MULTIPLIER;
      const maxSpeed = Math.max(minRate, Math.round(baseSpeed / maxMultiplier));
      
      // Calcular nueva velocidad (con reducción percentual)
      let newRate = Math.round(currentRate * (1 - speedIncrease));
      
      // Aplicar límites
      if (newRate < maxSpeed) {
        newRate = maxSpeed;
      }
      
      // Asegurar que hay un cambio mínimo perceptible
      const minChange = 50; // Al menos 50ms de diferencia
      if (Math.abs(currentRate - newRate) < minChange && currentRate > maxSpeed + minChange) {
        state.spawnRate = currentRate - minChange;
      } else {
        state.spawnRate = newRate;
      }
      
      // Actualizar el multiplicador de velocidad
      state.speedMultiplier = parseFloat((baseSpeed / state.spawnRate).toFixed(1));
      
      logger.info('Game', `Velocidad incrementada a ${state.speedMultiplier}x (${state.spawnRate}ms)`);
    },
    
    setGameStatus: (state, action: PayloadAction<GameState['status']>) => {
      const oldStatus = state.status;
      const newStatus = action.payload;
      
      console.log("\n**********************************************************");
      console.log("INICIO DEL FLUJO: CAMBIO DE ESTADO DEL JUEGO");
      console.log(`Cambiando de ${oldStatus} a ${newStatus}`);
      console.log(`Nivel: ${state.level}, Modo: ${state.currentPlayMode}`);
      console.log("**********************************************************");
      
      // Si estamos cambiando a un estado diferente que no sea gameOver o levelCompleted
      // Reseteamos el motivo
      if (newStatus !== 'gameOver' && newStatus !== 'levelCompleted') {
        state.gameEndReason = '';
      }
      
      // Actualizar el estado del juego
      state.status = newStatus;
      
      // Manejar lógica específica para cada transición de estado
      if (newStatus === 'playing') {
        if (oldStatus === 'paused') {
          console.log("Fase 1: Reanudando juego desde pausa");
        } else {
          console.log("Fase 1: Iniciando nuevo juego");
        }
        
        console.log("Fase 2: Asegurando estado correcto para el juego");
      }
      else if (newStatus === 'paused') {
        console.log("Fase 1: Juego pausado");
      }
      else if (newStatus === 'gameOver') {
        console.log("Fase 1: Juego terminado (Game Over)");
        
        console.log("Fase 2: Configurando estado de Game Over");
        
        // Resetear highlightedCells
        state.highlightedCells = [];
        console.log("Fase 3: Celdas resaltadas limpiadas");
      }
      else if (newStatus === 'levelCompleted') {
        console.log("Fase 1: Nivel completado");
        console.log("Fase 2: Preparando transición al siguiente nivel");
      }
      else if (newStatus === 'startScreen') {
        console.log("Fase 1: Volviendo a pantalla inicial");
        console.log("Fase 2: Reiniciando estados para nueva partida");
      }
      
      console.log("**********************************************************\n");
      console.log(`FIN DEL FLUJO: ESTADO DEL JUEGO CAMBIADO A ${newStatus}`);
    },
    
    setGameMode: (state, action: PayloadAction<GameState['currentDifficulty']>) => {
      const previousDifficulty = state.currentDifficulty;
      const newDifficulty = action.payload;
      
      console.log("\n**********************************************************");
      console.log("INICIO DEL FLUJO: CAMBIO DE DIFICULTAD");
      console.log(`Cambiando de ${previousDifficulty} a ${newDifficulty}`);
      console.log("**********************************************************");
      
      // Actualizar la dificultad en el estado
      state.currentDifficulty = newDifficulty;
      
      // Actualizar los iconos disponibles para el nivel actual y la nueva dificultad
      state.availableIcons = config.getIconsForLevel(state.level, newDifficulty);
      
      // Obtener configuración específica de la dificultad
      const difficultyConfig = config.getDifficultyConfig(newDifficulty);
      if (difficultyConfig) {
        // Aplicar la velocidad de generación de iconos específica de la dificultad
        state.spawnRate = difficultyConfig.spawnRate;
        console.log(`SpawnRate actualizado según dificultad: ${difficultyConfig.spawnRate}ms`);
        
        // Actualizar la ventana de tiempo para combos
        if (config.COMBO_SYSTEM && config.COMBO_SYSTEM.TIME_WINDOWS) {
          const comboTimeWindow = config.COMBO_SYSTEM.TIME_WINDOWS[newDifficulty] || 
                                 config.COMBO_SYSTEM.TIME_WINDOWS.normal;
          state.comboTimeWindow = comboTimeWindow;
          console.log(`Ventana de tiempo para combos actualizada: ${comboTimeWindow}ms`);
        }
        
        // Ajustar objetivos de nivel según la dificultad
        const difficultyMod = config.LEVEL_REQUIREMENT_MULTIPLIERS[newDifficulty] || 
                             config.LEVEL_REQUIREMENT_MULTIPLIERS.normal;
        
        // Ajustar objetivos de puntuación si estamos en modo clásico
        if (state.currentPlayMode === 'classic') {
          const baseScoreTarget = state.levelScoreTarget;
          const adjustedScoreTarget = Math.round(baseScoreTarget * difficultyMod.scoreRequirement);
          state.levelScoreTarget = adjustedScoreTarget;
          console.log(`Objetivo de puntuación ajustado: ${baseScoreTarget} → ${adjustedScoreTarget}`);
        }
        
        // Ajustar tiempos si estamos en modo contrarreloj
        if (state.currentPlayMode === 'timed') {
          const baseTimeLimit = state.levelTimeLimit;
          const adjustedTimeLimit = Math.round(baseTimeLimit * difficultyMod.timeRequirement);
          state.levelTimeLimit = adjustedTimeLimit;
          state.timeRemaining = adjustedTimeLimit;
          console.log(`Tiempo límite ajustado: ${baseTimeLimit}s → ${adjustedTimeLimit}s`);
        }
      }
      
      console.log(`Iconos configurados para nivel ${state.level} y dificultad ${newDifficulty}`);
      console.log(`Iconos: ${state.availableIcons.slice(0, 8).join(', ')}${state.availableIcons.length > 8 ? '...' : ''}`);
      console.log("**********************************************************\n");
      console.log(`FIN DEL FLUJO: DIFICULTAD CAMBIADA A ${newDifficulty}`);
      
      logger.info('Game', `Dificultad de juego establecida a ${newDifficulty}`);
    },
    
    setPlayMode: (state, action: PayloadAction<GameState['currentPlayMode']>) => {
      const previousMode = state.currentPlayMode;
      const newPlayMode = action.payload;
      
      console.log("\n**********************************************************");
      console.log("INICIO DEL FLUJO: CAMBIO DE MODO DE JUEGO");
      console.log(`Cambiando de ${previousMode} a ${newPlayMode}`);
      console.log("**********************************************************");
      
      // Actualizar solo el modo de juego, mantener el resto del estado intacto
      state.currentPlayMode = newPlayMode;
      
      // Actualizar los iconos disponibles para el nivel y dificultad actuales
      state.availableIcons = config.getIconsForLevel(state.level, state.currentDifficulty);
      
      console.log(`Iconos configurados para nivel ${state.level} y dificultad ${state.currentDifficulty}`);
      console.log(`Iconos: ${state.availableIcons.slice(0, 8).join(', ')}${state.availableIcons.length > 8 ? '...' : ''}`);
      console.log("**********************************************************\n");
      
      // Obtener configuración específica del modo para actualizar parámetros relacionados
      const modeConfig = config.getGameModeConfig(newPlayMode);
      if (modeConfig) {
        console.log(`Aplicando configuración específica para modo ${newPlayMode}:`);
        
        if (newPlayMode === 'classic') {
          // Configurar objetivos base para el modo clásico
          state.levelScoreTarget = modeConfig.initialScoreTarget || config.LEVEL_REQUIREMENTS.classic.baseScore;
          state.levelOccupationTarget = modeConfig.initialOccupationTarget || config.LEVEL_REQUIREMENTS.classic.baseOccupation;
          console.log(`- Objetivo de puntuación base: ${state.levelScoreTarget}`);
          console.log(`- Objetivo de ocupación base: ${state.levelOccupationTarget}%`);
        } else if (newPlayMode === 'timed') {
          // Configurar tiempo límite para el modo contrarreloj
          state.levelTimeLimit = modeConfig.initialTimeLimit || config.LEVEL_REQUIREMENTS.timed.baseTime;
          state.timeRemaining = state.levelTimeLimit;
          console.log(`- Tiempo límite inicial: ${state.levelTimeLimit}s`);
        }
      }
      
      console.log(`FIN DEL FLUJO: MODO DE JUEGO CAMBIADO A ${newPlayMode}`);
      logger.info('Game', `Modo de juego establecido a ${newPlayMode}`);
    },
    
    useHint: (state) => {
      if (state.hintsRemaining > 0 && !state.hintCooldown) {
        state.hintsRemaining -= 1;
        state.hintCooldown = true;
        state.lastHintTime = Date.now();
        logger.info('Game', `Pista utilizada. Quedan ${state.hintsRemaining} pistas`);
      } else {
        logger.info('Game', 'No se pueden usar más pistas o está en espera');
      }
    },
    
    rechargeHint: (state) => {
      if (state.hintsRemaining < config.HINT_SYSTEM.MAX_HINTS_PER_LEVEL) {
        state.hintsRemaining += 1;
        logger.info('Game', `Pista recargada. Ahora hay ${state.hintsRemaining} pistas disponibles`);
      }
    },
    
    resetHintCooldown: (state) => {
      state.hintCooldown = false;
    },
    
    setHighlightedCells: (state, action: PayloadAction<{row: number, col: number}[]>) => {
      state.highlightedCells = action.payload;
    },
    
    addIcon: (state, action: PayloadAction<{row: number, col: number, icon: string, isPenalty?: boolean}>) => {
      const { row, col, icon, isPenalty = false } = action.payload;
      
      // Verificar que la posición sea válida y esté vacía
      if (row >= 0 && row < state.boardSize && col >= 0 && col < state.boardSize && state.board[row][col] === null) {
        // Colocar el icono en el tablero
        state.board[row][col] = icon;
        // Incrementar el contador de iconos
        state.iconCount += 1;
        
        // Log con información sobre el icono añadido
        if (isPenalty) {
          logger.info('Game', `Icono de penalización añadido en [${row},${col}]: ${icon}`);
        } else {
          logger.info('Game', `Icono aleatorio añadido en [${row},${col}]: ${icon}`);
        }
      } else {
        // Si la celda no está vacía, registrar el evento como error
        logger.warn('Game', `No se pudo añadir icono en [${row},${col}] porque la celda no está vacía o es inválida.`);
      }
    },
    
    resetGame: (state, action: PayloadAction<{ difficulty?: GameState['currentDifficulty'], playMode?: GameState['currentPlayMode'] } | undefined>) => {
      const difficulty = action.payload?.difficulty || state.currentDifficulty;
      const playMode = action.payload?.playMode || state.currentPlayMode;
      
      console.log("\n**********************************************************");
      console.log("INICIO DEL FLUJO: REINICIO DEL JUEGO");
      console.log(`Dificultad: ${difficulty}, Modo: ${playMode}`);
      console.log("**********************************************************");
      
      // Conservar la puntuación máxima y preferencias de usuario
      const highScore = state.highScore;
      const darkMode = state.darkMode;
      
      // Determinar el tamaño inicial del tablero según el modo de juego
      let initialBoardSize = config.DEFAULT_BOARD_SIZE;
      let initialSpawnRate = config.SPAWN_RATES.MEDIUM;
      
      // Configurar tamaño del tablero y spawn rate según el modo de juego
      switch (playMode) {
        case 'tutorial':
          initialBoardSize = config.BOARD_SIZE.SMALL;
          initialSpawnRate = config.SPAWN_RATES.VERY_SLOW; // Más lento para el tutorial
          break;
        case 'classic':
          initialBoardSize = config.BOARD_SIZE.SMALL;
          initialSpawnRate = config.SPAWN_RATES.SLOW;
          break;
        case 'timed':
          initialBoardSize = config.BOARD_SIZE.MEDIUM;
          initialSpawnRate = config.SPAWN_RATES.MEDIUM;
          break;
        case 'survival':
          initialBoardSize = config.BOARD_SIZE.LARGE;
          initialSpawnRate = config.SPAWN_RATES.VERY_SLOW;
          break;
        case 'zen':
          initialBoardSize = config.BOARD_SIZE.MEDIUM;
          initialSpawnRate = config.SPAWN_RATES.VERY_SLOW;
          break;
      }
      
      console.log(`Fase 1: Tamaño de tablero: ${initialBoardSize}x${initialBoardSize}, Velocidad: ${initialSpawnRate}ms`);
      
      // Obtener los iconos para el nivel 1 y la dificultad seleccionada
      const initialIcons = config.getIconsForLevel(1, difficulty);
      console.log(`Fase 2: Iconos configurados: ${initialIcons.slice(0, 8).join(', ')}${initialIcons.length > 8 ? '...' : ''}`);
      
      // Restablecer el estado completamente
      Object.assign(state, {
        ...initialState,
        highScore,
        darkMode,
        currentDifficulty: difficulty,
        currentPlayMode: playMode,
        status: 'startScreen', // Cambiar a pantalla de inicio en lugar de playing
        hintsRemaining: config.HINT_SYSTEM.MAX_HINTS_PER_LEVEL,
        canEmptyBoardBonus: true,
        score: 0,
        level: 1,
        timer: 0,
        iconCount: 0,
        board: Array(initialBoardSize).fill(null).map(() => Array(initialBoardSize).fill(null)),
        boardSize: initialBoardSize,
        spawnRate: initialSpawnRate,
        speedMultiplier: 1.0,
        hintCooldown: false,
        lastHintTime: 0,
        timeRemaining: config.GAME_MODE_CONFIG.TIMED.initialTimeLimit,
        survivalTime: 0,
        highlightedCells: [],
        availableIcons: initialIcons
      });
      
      console.log("Fase 3: Estado del juego reiniciado");
      
      // Configurar propiedades específicas según el modo de juego
      switch (playMode) {
        case 'tutorial':
          // Configurar objetivos más simples para el tutorial
          state.levelScoreTarget = Math.floor(config.LEVEL_REQUIREMENTS.classic.baseScore * 0.5);
          state.levelOccupationTarget = 40; // 40% de ocupación objetivo (más fácil)
          // Ventana de combo más amplia para el tutorial
          state.comboTimeWindow = 10000; // 10 segundos
          break;
        case 'classic':
          state.levelScoreTarget = config.LEVEL_REQUIREMENTS.classic.baseScore;
          state.levelOccupationTarget = config.LEVEL_REQUIREMENTS.classic.baseOccupation;
          console.log(`Fase 4: Objetivos establecidos - Puntuación: ${state.levelScoreTarget}, Ocupación: ${state.levelOccupationTarget}%`);
          break;
        case 'timed':
          state.timeRemaining = config.LEVEL_REQUIREMENTS.timed.baseTime;
          state.levelTimeLimit = config.LEVEL_REQUIREMENTS.timed.baseTime;
          console.log(`Fase 4: Tiempo establecido: ${state.timeRemaining} segundos`);
          break;
        case 'survival':
          state.survivalTime = 0;
          state.specialIconsEnabled = false;
          console.log("Fase 4: Modo supervivencia configurado");
          break;
        case 'zen':
          console.log("Fase 4: Modo zen configurado - sin límites ni objetivos");
          break;
      }
      
      console.log("**********************************************************\n");
      console.log("FIN DEL FLUJO: JUEGO REINICIADO CORRECTAMENTE");
      
      logger.info('Game', `Juego reiniciado con modo ${playMode} y dificultad ${difficulty}`);
    },
    
    loadHighScore: (state) => {
      const savedHighScore = localStorage.getItem('highScore');
      if (savedHighScore) {
        state.highScore = parseInt(savedHighScore, 10);
        logger.info('Game', `Puntuación máxima cargada: ${state.highScore}`);
      }
    },
    
    // Toggle del modo oscuro
    setDarkMode: (state, action: PayloadAction<boolean>) => {
      state.darkMode = action.payload;
      // Guardar preferencia en localStorage
      localStorage.setItem('darkMode', action.payload.toString());
    },
    
    incrementCombo: (state, action: PayloadAction<number | undefined>) => {
      // Puntos base para esta eliminación (opcional)
      const basePoints = action.payload || 0;
      
      // Guardar valores anteriores para debug
      const prevCount = state.comboCount;
      const prevMultiplier = state.comboMultiplier;
      
      // Incrementar contador de combos
      state.comboCount += 1;
      
      // Actualizar multiplicador basado en contador
      if (state.comboCount >= 15) {
        state.comboMultiplier = 5.0;
      } else if (state.comboCount >= 10) {
        state.comboMultiplier = 3.0;
      } else if (state.comboCount >= 6) {
        state.comboMultiplier = 2.0;
      } else if (state.comboCount >= 3) {
        state.comboMultiplier = 1.5;
      } else {
        state.comboMultiplier = 1.0;
      }
      
      // Actualizar timestamp con la hora actual
      const currentTime = Date.now();
      state.comboTimestamp = currentTime;
      
      // Calcular puntos ganados con el multiplicador (si se proporcionaron puntos base)
      const pointsWithMultiplier = basePoints > 0 ? Math.floor(basePoints * state.comboMultiplier) : 0;
      state.lastComboPoints = pointsWithMultiplier; // Guardar en el estado en lugar de retornarlo
      
      console.log(`[COMBO] Incrementado de ${prevCount} a ${state.comboCount}`);
      console.log(`[COMBO] Multiplicador actualizado de ${prevMultiplier.toFixed(1)}x a ${state.comboMultiplier.toFixed(1)}x`);
      console.log(`[COMBO] Timestamp actualizado: ${state.comboTimestamp} (${new Date(currentTime).toISOString()})`);
      
      if (basePoints > 0) {
        console.log(`[COMBO] Puntos base: ${basePoints}, Con multiplicador: ${pointsWithMultiplier}`);
      }
    },

    resetCombo: (state) => {
      // Solo logear si hay un combo activo
      if (state.comboCount > 0) {
        console.log(`[COMBO] Reset completo - Era: ${state.comboCount}x con multiplicador ${state.comboMultiplier.toFixed(1)}x`);
      }
      
      // Resetear todos los valores del combo
      state.comboCount = 0;
      state.comboMultiplier = 1.0;
      state.comboTimestamp = 0; // También reseteamos el timestamp para evitar cálculos erróneos
      
      console.log(`[COMBO] Estado después del reset: Combo ${state.comboCount}, Mult ${state.comboMultiplier.toFixed(1)}x, TS: ${state.comboTimestamp}`);
    },

    // Añadir este nuevo reducer
    setComboTimeWindow: (state, action: PayloadAction<number>) => {
      const oldValue = state.comboTimeWindow;
      state.comboTimeWindow = action.payload;
      console.log(`[COMBO CONFIG] Ventana de tiempo de combo actualizada: ${oldValue}ms → ${action.payload}ms`);
    },
    
    // Nuevo reducer para establecer el motivo de fin de juego
    setGameEndReason: (state, action: PayloadAction<string>) => {
      state.gameEndReason = action.payload;
    },
  },
  extraReducers: (builder) => {
    // ... extra reducers existentes
  }
});

/* const gameSlice = createSlice({
  name: 'game',
  initialState,
  reducers: {
    incrementScore: (state, action: PayloadAction<number>) => {
      state.score += action.payload;
    },
    updateBoard: (state, action: PayloadAction<(string | null)[][]>) => {
      state.board = action.payload;
    },
    setLevel: (state, action: PayloadAction<number>) => {
      state.level = action.payload;
    },
    incrementTimer: (state) => {
      state.timer += 1;
    },
    setGameStatus: (state, action: PayloadAction<GameState['status']>) => {
      state.status = action.payload;
    },
    resetGame: (state) => {
      state.score = 0;
      state.level = 1;
      state.timer = 0;
      state.status = 'idle';
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchGameState.pending, (state) => {
        state.status = 'idle';
      })
      .addCase(fetchGameState.fulfilled, (state, action) => {
        return { ...state, ...action.payload };
      })
      .addCase(fetchGameState.rejected, (state, action) => {
        state.error = action.error.message || 'Error al cargar el juego';
      });
  }
}); */

export const { 
  incrementScore, 
  updateBoard,
  setBoardSize,
  setIconCount, 
  setAvailableIcons,
  setLevel, 
  incrementTimer,
  decrementTimeRemaining,
  setSpawnRate,
  increaseSpeed,
  setGameStatus,
  setGameMode,
  setPlayMode,
  useHint,
  rechargeHint,
  resetHintCooldown,
  setHighlightedCells,
  resetGame,
  loadHighScore,
  setLevelTimeLimit,
  addTimeBonus,
  setLevelTarget,
  addIcon,
  setDarkMode,
  incrementCombo,
  resetCombo,
  setComboTimeWindow,
  setGameEndReason,
} = gameSlice.actions;

export default gameSlice.reducer;
