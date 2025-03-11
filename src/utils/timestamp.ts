/**
 * timestamp.ts
 * Utilidad para manejar timestamps consistentes y formatearlos para los logs.
 */

/**
 * Obtiene un timestamp actual con precisión de milisegundos
 * @returns Timestamp actual en milisegundos
 */
export const getCurrentTimestamp = (): number => {
  return performance.now();
};

/**
 * Formatea un timestamp para mostrar en logs
 * @param timestamp Timestamp en milisegundos
 * @returns String formateado con hora:minuto:segundo.milisegundos
 */
export const formatTimestamp = (timestamp: number): string => {
  const date = new Date();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  const milliseconds = date.getMilliseconds().toString().padStart(3, '0');
  
  return `${hours}:${minutes}:${seconds}.${milliseconds}`;
};

/**
 * Calcula la diferencia entre dos timestamps y la formatea
 * @param current Timestamp actual
 * @param previous Timestamp anterior
 * @returns String formateado con la diferencia en segundos y milisegundos
 */
export const formatTimeDifference = (current: number, previous: number): string => {
  const diff = current - previous;
  const seconds = Math.floor(diff / 1000);
  const milliseconds = Math.floor(diff % 1000);
  
  return `${seconds}.${milliseconds.toString().padStart(3, '0')}s`;
};

/**
 * Crea un timestamp formateado para usar en logs
 * @returns String con el timestamp actual formateado
 */
export const getLogTimestamp = (): string => {
  return formatTimestamp(getCurrentTimestamp());
}; 