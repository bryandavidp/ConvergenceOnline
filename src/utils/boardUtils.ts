import { store } from '../store';
import { setBoardSize, setSpawnRate, setAvailableIcons } from '../store/slices/gameSlice';
import { shuffleArray } from './gameUtils';
import * as config from './config';
import { createLogger } from './logUtils';

// Crear un logger específico para las utilidades del tablero
const logger = createLogger('boardUtils');

/**
 * Interfaz para las opciones de configuración del tablero
 */
export interface BoardConfig {
  size?: number;
  spawnRate?: number;
  icons?: string[];
  minCellSize?: number;
  maxCellSize?: number;
  cellMargin?: number;
}

/**
 * Valores predeterminados para la configuración del tablero
 */
export const DEFAULT_BOARD_CONFIG: BoardConfig = {
  size: config.DEFAULT_BOARD_SIZE,
  spawnRate: config.SPAWN_RATES.MEDIUM,
  icons: ["🍎", "🍇", "🍊", "🍓"],
  minCellSize: 30,
  maxCellSize: 80,
  cellMargin: 8
};

/**
 * Cambia el tamaño del tablero
 * @param size Nuevo tamaño del tablero (NxN)
 * @returns El nuevo tamaño del tablero
 */
export function changeBoardSize(size: number): number {
  const safeSize = Math.max(
    config.BOARD_MIN_SIZE, 
    Math.min(config.BOARD_MAX_SIZE, size)
  );
  
  logger.info(`Cambiando tamaño del tablero a ${safeSize}x${safeSize}`);
  store.dispatch(setBoardSize(safeSize));
  
  return safeSize;
}

/**
 * Cambia la velocidad de aparición de iconos
 * @param newSpawnRate Nueva velocidad en milisegundos (menor = más rápido)
 * @returns La nueva velocidad de aparición
 */
export function changeSpawnRate(newSpawnRate: number): number {
  const minRate = 200; // No permitir velocidades demasiado rápidas
  const maxRate = 5000; // No permitir velocidades demasiado lentas
  
  const safeRate = Math.max(minRate, Math.min(maxRate, newSpawnRate));
  
  logger.info(`Cambiando velocidad de aparición a ${safeRate}ms`);
  store.dispatch(setSpawnRate(safeRate));
  
  return safeRate;
}

/**
 * Establece los iconos disponibles para el tablero
 * @param icons Array de iconos a utilizar
 * @returns El array de iconos establecido
 */
export function setAvailableBoardIcons(icons: string[]): string[] {
  if (!icons || icons.length === 0) {
    logger.warn('Intento de establecer un array vacío de iconos, usando iconos por defecto');
    icons = DEFAULT_BOARD_CONFIG.icons || [];
  }
  
  logger.info(`Estableciendo ${icons.length} iconos disponibles`);
  store.dispatch(setAvailableIcons(icons));
  
  return icons;
}

/**
 * Obtiene iconos aleatorios del conjunto completo
 * @param count Número de iconos a seleccionar
 * @returns Array con los iconos seleccionados
 */
export function getRandomIcons(count: number): string[] {
  const allIcons = [...config.AVAILABLE_ICONS];
  shuffleArray(allIcons);
  
  const selectedCount = Math.min(count, allIcons.length);
  const selectedIcons = allIcons.slice(0, selectedCount);
  
  logger.debug(`Seleccionados ${selectedIcons.length} iconos aleatorios`);
  return selectedIcons;
}

/**
 * Configura el tablero para un nivel específico
 * @param level Nivel del juego
 * @param preserveSpeed Si es true, mantiene la velocidad actual
 * @returns Objeto con la configuración aplicada
 */
export function configureBoardForLevel(level: number, preserveSpeed: boolean = false): BoardConfig {
  // Obtener el estado actual
  const { spawnRate: currentSpawnRate } = store.getState().game;
  
  // Determinar nuevos valores basados en el nivel
  const size = config.getLevelBoardSize(level);
  const spawnRate = preserveSpeed ? currentSpawnRate : config.getLevelSpawnRate(level);
  const iconCount = config.iconCountByLevel(level);
  const icons = getRandomIcons(iconCount);
  
  // Aplicar los cambios
  changeBoardSize(size);
  if (!preserveSpeed) {
    changeSpawnRate(spawnRate);
  }
  setAvailableBoardIcons(icons);
  
  logger.info(`Tablero configurado para nivel ${level}`, {
    tamaño: size,
    velocidad: preserveSpeed ? `mantenida (${currentSpawnRate}ms)` : `${spawnRate}ms`,
    iconos: icons.length
  });
  
  return {
    size,
    spawnRate: preserveSpeed ? currentSpawnRate : spawnRate,
    icons
  };
}

/**
 * Ajusta el tamaño visual del tablero y celdas
 * @param boardContainer Elemento contenedor del tablero
 * @param boardElement Elemento del tablero
 * @param config Configuración opcional para ajustar el tablero
 */
export function adjustBoardVisuals(
  boardContainer: HTMLElement,
  boardElement: HTMLElement,
  config?: BoardConfig
): void {
  if (!boardContainer || !boardElement) {
    logger.warn('No se pueden ajustar los visuales del tablero: elementos no encontrados');
    return;
  }
  
  const { boardSize } = store.getState().game;
  const {
    minCellSize = DEFAULT_BOARD_CONFIG.minCellSize,
    maxCellSize = DEFAULT_BOARD_CONFIG.maxCellSize,
    cellMargin = DEFAULT_BOARD_CONFIG.cellMargin || 8
  } = config || {};
  
  // Calcular el tamaño disponible
  const containerWidth = boardContainer.clientWidth;
  const containerHeight = boardContainer.clientHeight;
  
  // Usar el mínimo entre ancho y alto disponible, con un margen seguro
  const availableSize = Math.min(containerWidth, containerHeight) - 20; // 20px de margen
  
  // Calcular el tamaño de la celda basado en el espacio disponible y el número de celdas
  const totalCellsSpace = availableSize - (boardSize * cellMargin * 2);
  const calculatedCellSize = Math.floor(totalCellsSpace / boardSize);
  
  // Aplicar límites al tamaño de celda calculado
  const cellSize = Math.max(
    minCellSize || 30, 
    Math.min(maxCellSize || 80, calculatedCellSize)
  );
  
  // Calcular el tamaño total del tablero basado en el tamaño de celda final
  const finalBoardSize = (cellSize * boardSize) + (cellMargin * 2 * boardSize);
  
  // Aplicar tamaños al tablero y celdas
  boardElement.style.width = `${finalBoardSize}px`;
  boardElement.style.height = `${finalBoardSize}px`;
  document.documentElement.style.setProperty('--cell-size', `${cellSize}px`);
  
  // Establecer otras variables CSS para asegurar consistencia en el diseño
  document.documentElement.style.setProperty('--board-size', `${boardSize}`);
  document.documentElement.style.setProperty('--cell-gap', `${cellMargin}px`);
  
  // Asegurarnos de que el tablero permanezca centrado
  boardElement.style.position = 'relative';
  boardElement.style.margin = 'auto';
  
  logger.debug('Tablero ajustado visualmente', { 
    containerSize: { width: containerWidth, height: containerHeight }, 
    boardSize: finalBoardSize, 
    cellSize,
    cellMargin,
    availableSize
  });
} 