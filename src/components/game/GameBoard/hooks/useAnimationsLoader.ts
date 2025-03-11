import { useState, useRef, useCallback, useEffect } from 'react';
import logger from '../../../../utils/logger';

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
  const timeoutRef = useRef<number | null>(null);
  
  // Limpiar timeout al desmontar para evitar memory leaks
  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);
  
  /**
   * Carga el archivo CSS de animaciones según el modo seleccionado
   */
  const loadAnimations = useCallback((lite: boolean) => {
    if (hasInitialized.current) {
      // Si ya se ha inicializado pero no se ha marcado como cargado, forzar el estado
      if (!isLoaded) {
        logger.info('AnimationsLoader', 'Animaciones ya inicializadas, forzando estado a cargado');
        setIsLoaded(true);
      }
      return;
    }
    
    logger.info('AnimationsLoader', `Cargando animaciones en modo: ${lite ? 'lite' : 'normal'}`);
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
    
    // Intentar con múltiples rutas posibles para mayor compatibilidad
    const possiblePaths = [
      // Rutas relativas a la raíz
      `./src/components/game/GameBoard/styles/animations${lite ? '-lite' : ''}.css`,
      `/src/components/game/GameBoard/styles/animations${lite ? '-lite' : ''}.css`,
      // Rutas relativas al origen
      `${window.location.origin}/src/components/game/GameBoard/styles/animations${lite ? '-lite' : ''}.css`,
      // Rutas alternativas
      `./animations${lite ? '-lite' : ''}.css`,
      `/animations${lite ? '-lite' : ''}.css`,
    ];
    
    let currentPathIndex = 0;
    let maxAttempts = possiblePaths.length;
    
    // Intentar cargar con diferentes rutas
    const tryLoadPath = () => {
      if (currentPathIndex >= maxAttempts) {
        logger.error('AnimationsLoader', 'No se pudo cargar el archivo CSS de animaciones después de múltiples intentos');
        // Si no se puede cargar, considerar que está cargado para no bloquear
        setIsLoaded(true);
        hasInitialized.current = true;
        return;
      }
      
      link.href = possiblePaths[currentPathIndex];
      logger.info('AnimationsLoader', `Intentando cargar animaciones desde: ${link.href}`);
      currentPathIndex++;
    };
    
    // Configurar eventos
    link.onload = () => {
      logger.info('AnimationsLoader', `Cargado modo de animaciones: ${lite ? 'reducido' : 'completo'}`);
      setIsLoaded(true);
      hasInitialized.current = true;
      
      // Limpiar timeout si existe
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
    
    link.onerror = () => {
      logger.warn('AnimationsLoader', `Error al cargar animaciones desde: ${link.href}, intentando ruta alternativa...`);
      tryLoadPath();
    };
    
    // Establecer un timeout para casos donde ni onload ni onerror se dispara
    timeoutRef.current = window.setTimeout(() => {
      if (!isLoaded) {
        logger.warn('AnimationsLoader', 'Timeout al cargar animaciones, marcando como cargado de todos modos');
        setIsLoaded(true);
        hasInitialized.current = true;
      }
    }, 2000);
    
    // Agregar el link al head
    tryLoadPath();
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
  }, [fpsThreshold, isLoaded]);

  /**
   * Inicializa las animaciones con el modo seleccionado.
   * Diseñado para ser llamado desde LoadingScreen después de la detección de FPS.
   */
  const initializeAnimations = useCallback((useLite: boolean) => {
    // Permitir reintentar la inicialización si es necesario
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