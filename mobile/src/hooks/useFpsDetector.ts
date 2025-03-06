import { useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';

/**
 * Hook para detectar el rendimiento del dispositivo y ajustar el modo de animación
 */
interface FpsDetectorHook {
  fps: number | null;
  useLiteAnimations: boolean;
  setAnimationMode: (useLite: boolean) => void;
}

/**
 * Hook personalizado para detectar FPS y ajustar el modo de animación
 * Compatible con web y móvil
 * @param threshold Umbral de FPS para cambiar automáticamente al modo ligero
 * @returns Estado actual de FPS y controladores de animación
 */
const useFpsDetector = (threshold: number = 30): FpsDetectorHook => {
  const [fps, setFps] = useState<number | null>(null);
  const [useLiteAnimations, setUseLiteAnimations] = useState<boolean>(false);
  
  useEffect(() => {
    // Solo medir FPS en navegadores, no en aplicaciones nativas
    if (Platform.OS === 'web') {
      let lastTime = performance.now();
      let frameCount = 0;
      let measuring = true;
      
      const measure = () => {
        if (!measuring) return;
        
        const now = performance.now();
        frameCount++;
        
        if (now - lastTime >= 1000) {
          setFps(Math.round(frameCount * 1000 / (now - lastTime)));
          frameCount = 0;
          lastTime = now;
        }
        
        requestAnimationFrame(measure);
      };
      
      requestAnimationFrame(measure);
      
      return () => {
        measuring = false;
      };
    } else {
      // En dispositivos móviles, asumimos FPS adecuados por defecto
      setFps(60);
    }
  }, []);
  
  useEffect(() => {
    // Si fps baja del umbral, cambiar a animaciones ligeras
    if (fps !== null && fps < threshold && !useLiteAnimations) {
      setUseLiteAnimations(true);
    }
  }, [fps, threshold, useLiteAnimations]);
  
  const setAnimationMode = useCallback((useLite: boolean) => {
    setUseLiteAnimations(useLite);
  }, []);
  
  return { fps, useLiteAnimations, setAnimationMode };
};

export default useFpsDetector; 