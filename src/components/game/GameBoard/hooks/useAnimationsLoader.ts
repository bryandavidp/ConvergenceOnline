import { useEffect, useState } from 'react';

/**
 * Hook personalizado para cargar las animaciones según el rendimiento del dispositivo
 * @param fpsThreshold Umbral de FPS para considerar un buen rendimiento (por defecto 40)
 * @returns Objeto con información sobre las animaciones y método para forzar el modo
 */
const useAnimationsLoader = (fpsThreshold: number = 40) => {
  const [useLiteAnimations, setUseLiteAnimations] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [fps, setFps] = useState<number | null>(null);
  const [manualMode, setManualMode] = useState<boolean>(false);

  // Función para cargar el archivo CSS de animaciones
  const loadAnimations = (lite: boolean) => {
    const head = document.head;
    const existingLink = document.getElementById('game-animations-css');
    
    if (existingLink) {
      existingLink.remove();
    }

    const link = document.createElement('link');
    link.id = 'game-animations-css';
    link.rel = 'stylesheet';
    link.type = 'text/css';
    link.href = lite 
      ? '/src/components/game/GameBoard/styles/animations-lite.css'
      : '/src/components/game/GameBoard/styles/animations.css';
    
    link.onload = () => {
      setIsLoaded(true);
      console.log(`Cargado modo de animaciones: ${lite ? 'reducido' : 'completo'}`);
    };
    
    head.appendChild(link);
    setUseLiteAnimations(lite);
  };

  // Medición de FPS básica
  useEffect(() => {
    if (manualMode) return;

    let frameCount = 0;
    let startTime = performance.now();
    let frameId: number;
    let initialMeasurementComplete = false;

    const measureFps = () => {
      frameCount++;
      const currentTime = performance.now();
      const elapsed = currentTime - startTime;
      
      if (elapsed >= 1000) {
        const currentFps = Math.round(frameCount * 1000 / elapsed);
        setFps(currentFps);
        
        if (!initialMeasurementComplete) {
          initialMeasurementComplete = true;
          loadAnimations(currentFps < fpsThreshold);
        }
        
        frameCount = 0;
        startTime = currentTime;
      }
      
      frameId = requestAnimationFrame(measureFps);
    };

    frameId = requestAnimationFrame(measureFps);

    // Después de 5 segundos, detener la medición continua
    const timeoutId = setTimeout(() => {
      cancelAnimationFrame(frameId);
    }, 5000);

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(timeoutId);
    };
  }, [fpsThreshold, manualMode]);

  // Función para cambiar manualmente el modo de animaciones
  const setAnimationMode = (lite: boolean) => {
    setManualMode(true);
    loadAnimations(lite);
  };

  return {
    useLiteAnimations,
    isLoaded,
    fps,
    setAnimationMode,
    isManualMode: manualMode
  };
};

export default useAnimationsLoader; 