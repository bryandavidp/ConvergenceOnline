// src/utils/assetUrl.ts
// Resuelve rutas de assets públicos teniendo en cuenta el `base` de Vite
// (necesario para servir el juego desde un subdirectorio en GitHub Pages,
// por ejemplo https://bryandavidp.github.io/ConvergenceOnline/).

const BASE = import.meta.env.BASE_URL || '/';

/**
 * Devuelve la URL de un asset alojado en /public anteponiendo el base path.
 * Si la url no es absoluta (no empieza por '/') o ya es una URL completa
 * (http/data/blob), se devuelve sin cambios.
 */
export const resolveAssetUrl = (url: string): string => {
  if (!url) return url;
  if (/^(https?:|data:|blob:)/.test(url)) return url;
  if (!url.startsWith('/')) return url;
  // BASE termina en '/', así que evitamos la doble barra.
  return BASE.replace(/\/$/, '') + url;
};
