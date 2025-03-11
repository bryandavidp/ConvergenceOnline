import { useState, useRef, useCallback } from 'react';

// Umbral crítico para FPS que siempre debe activar animaciones ligeras
const CRITICAL_FPS_THRESHOLD = 10;

/**
 * Hook personalizado para cargar las animaciones según el rendimiento del dispositivo.
 * Diseñado para ser utilizado durante la carga inicial en LoadingScreen.
 * 
 * @param fpsThreshold Umbral de FPS para considerar un buen rendimiento (por defecto 30)
 * @returns Objeto con información sobre las animaciones y métodos para el modo
 */
const useAnimationsLoader = (fpsThreshold: number = 30) => {
  const [useLiteAnimations, setUseLiteAnimations] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  
  // Referencias para la detección de FPS
  const hasInitialized = useRef(false);
  const detectionComplete = useRef(false);
  
  /**
   * Carga el archivo CSS de animaciones según el modo seleccionado
   */
  const loadAnimations = useCallback((lite: boolean) => {
    if (hasInitialized.current) return;
    
    console.log(`Cargando animaciones en modo: ${lite ? 'lite' : 'normal'}`);
    const head = document.head;
    const existingLink = document.getElementById('game-animations-css');
    
    if (existingLink) {
      existingLink.remove();
    }

    // Crear un nuevo elemento link
    const link = document.createElement('link');
    link.id = 'game-animations-css';
    link.rel = 'stylesheet';
    link.type = 'text/css';
    
    // URLs relativas para evitar problemas de ruta en diferentes entornos
    const basePath = window.location.origin;
    link.href = lite 
      ? `${basePath}/src/components/game/GameBoard/styles/animations-lite.css`
      : `${basePath}/src/components/game/GameBoard/styles/animations.css`;
    
    // Monitorear la carga
    link.onload = () => {
      setIsLoaded(true);
      hasInitialized.current = true;
      console.log(`Cargado modo de animaciones: ${lite ? 'reducido' : 'completo'}`);
    };
    
    link.onerror = (e) => {
      console.error('Error al cargar el archivo CSS de animaciones:', e);
      // Intentar cargar de forma alternativa
      const alternativePath = lite 
        ? '/animations-lite.css'
        : '/animations.css';
      link.href = alternativePath;
    };
    
    // Agregar el link al head
    head.appendChild(link);
    setUseLiteAnimations(lite);
    
    // También añadir clase global para otros componentes
    if (lite) {
      document.documentElement.classList.add('lite-animations');
      
      if (fpsThreshold <= CRITICAL_FPS_THRESHOLD) {
        document.documentElement.classList.add('performance-mode-high');
      } else {
        document.documentElement.classList.add('performance-mode');
      }
    } else {
      document.documentElement.classList.remove('lite-animations');
      document.documentElement.classList.remove('performance-mode');
      document.documentElement.classList.remove('performance-mode-high');
    }
  }, [fpsThreshold]);

  /**
   * Inicializa las animaciones con el modo seleccionado.
   * Diseñado para ser llamado desde LoadingScreen después de la detección de FPS.
   */
  const initializeAnimations = useCallback((useLite: boolean) => {
    if (detectionComplete.current) return;
    
    loadAnimations(useLite);
    detectionComplete.current = true;
  }, [loadAnimations]);

  /**
   * Comprueba si las animaciones ya han sido inicializadas.
   */
  const isInitialized = useCallback(() => {
    return hasInitialized.current;
  }, []);

  return {
    useLiteAnimations,
    isLoaded,
    initializeAnimations,
    isInitialized
  };
};

export default useAnimationsLoader; 