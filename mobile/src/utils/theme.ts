// Definición de colores para toda la aplicación
export const colors = {
  // Colores principales
  primary: '#3b82f6',
  secondary: '#6366f1',
  success: '#10b981',
  danger: '#ef4444',
  warning: '#f59e0b',
  
  // Fondos
  appBackground: '#0f172a',
  boardBackground: 'rgba(20, 30, 50, 0.8)',
  cardBackground: 'rgba(30, 41, 59, 0.7)',
  messageBackground: 'rgba(51, 65, 85, 0.9)',
  successBackground: 'rgba(16, 185, 129, 0.9)',
  dangerBackground: 'rgba(239, 68, 68, 0.9)',
  
  // Celdas
  cellEmpty: 'rgba(255, 255, 255, 0.05)',
  cellWithIcon: 'rgba(80, 120, 255, 0.15)',
  cellHighlighted: 'rgba(100, 200, 255, 0.3)',
  cellBorder: 'rgba(255, 255, 255, 0.1)',
  
  // Texto
  textLight: '#ffffff',
  textDark: '#0f172a',
  textMuted: '#94a3b8',
  
  // Botones
  primaryButton: '#3b82f6',
  secondaryButton: '#64748b',
  disabledButton: '#475569',
  
  // Sombras
  shadowDark: '#000000',
  shadowLight: '#ffffff',
};

// Tamaños de fuente
export const fontSizes = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
};

// Espaciados
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

// Radios de bordes
export const borderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
};

// Iconos para el juego
export const gameIcons = [
  '🚀', '🌟', '🪐', '🛸', '👾', '🌌', '🔭', '🌠',
  '🌑', '🌓', '🌕', '☄️', '🛰️', '🧑‍🚀', '🪄', '⚡',
  '🔥', '💧', '🌪️', '🌍', '🌈', '❄️', '☀️', '🌙'
];

// Configuración de niveles
export const levelConfig = {
  // Nivel: {número de íconos diferentes, número de parejas, tiempo límite (si aplica)}
  1: { iconTypes: 4, pairs: 4, timeLimit: null },
  2: { iconTypes: 5, pairs: 6, timeLimit: null },
  3: { iconTypes: 6, pairs: 8, timeLimit: null },
  4: { iconTypes: 6, pairs: 10, timeLimit: null },
  5: { iconTypes: 8, pairs: 12, timeLimit: null },
  6: { iconTypes: 8, pairs: 14, timeLimit: null },
  7: { iconTypes: 10, pairs: 16, timeLimit: null },
  8: { iconTypes: 10, pairs: 18, timeLimit: null },
  9: { iconTypes: 12, pairs: 20, timeLimit: null },
  10: { iconTypes: 12, pairs: 24, timeLimit: null },
};

// Tema base
export const theme = {
  colors,
  fontSizes,
  spacing,
  borderRadius,
}; 