import { useEffect, useState, useRef } from 'react';

/**
 * Hook personalizado para cargar las animaciones según el rendimiento del dispositivo
 * @param fpsThreshold Umbral de FPS para considerar un buen rendimiento (por defecto 30)
 * @returns Objeto con información sobre las animaciones y método para forzar el modo
 */
const useAnimationsLoader = (fpsThreshold: number = 30) => {
  const [useLiteAnimations, setUseLiteAnimations] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [fps, setFps] = useState<number | null>(null);
  const [manualMode, setManualMode] = useState<boolean>(false);
  
  // Referencia para evitar múltiples decisiones de rendimiento
  const hasDecided = useRef(false);
  // Referencia para acumular muestras de FPS
  const fpsSamples = useRef<number[]>([]);
  // Referencia para el intervalo de medición
  const measurementIntervalRef = useRef<NodeJS.Timeout | null>(null);
  // Referencia para identificar el navegador
  const isIOSRef = useRef(false);

  // Función para cargar el archivo CSS de animaciones de forma optimizada
  const loadAnimations = (lite: boolean) => {
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
    } else {
      document.documentElement.classList.remove('lite-animations');
    }
  };

  // Detectar tipo de navegador/dispositivo al inicio (solo para info, no para decisiones)
  useEffect(() => {
    // Detectar iOS para ajustar la medición de FPS
    const userAgent = navigator.userAgent.toLowerCase();
    isIOSRef.current = /iphone|ipad|ipod/.test(userAgent);
    
    console.log(`Dispositivo detectado: ${isIOSRef.current ? 'iOS' : 'No iOS'}`);
    console.log(`Hardware: Cores=${navigator.hardwareConcurrency || 'N/A'}, 
                 Memoria=${(navigator as any).deviceMemory || 'N/A'}GB`);
  }, []);

  // Medición de FPS primaria para determinar el modo de animaciones
  useEffect(() => {
    if (manualMode || hasDecided.current) return;

    let frameCount = 0;
    let startTime = performance.now();
    let frameId: number | null = null;
    let decisionTimeoutId: NodeJS.Timeout | null = null;
    
    // Número mínimo de muestras antes de tomar una decisión
    const MIN_SAMPLES = isIOSRef.current ? 8 : 5; // Más muestras para iOS por su variabilidad
    
    // Función que cuenta frames
    const countFrames = () => {
      frameCount++;
      frameId = requestAnimationFrame(countFrames);
    };
    
    // Inicia la medición después de 1.5 segundos para permitir que la página se cargue completamente
    const initialDelayId = setTimeout(() => {
      console.log('Iniciando medición de FPS para determinar modo de animaciones...');
      
      // Iniciar el contador de frames
      frameId = requestAnimationFrame(countFrames);
      
      // Cada segundo, calcular el FPS y decidir si cambiar el modo
      measurementIntervalRef.current = setInterval(() => {
        const now = performance.now();
        const elapsed = now - startTime;
        
        if (elapsed < 200) { // Ignorar intervalos muy cortos (puede ocurrir en iOS)
          console.log('Intervalo de medición demasiado corto, ignorando...');
          return;
        }
        
        const currentFps = Math.round((frameCount * 1000) / elapsed);
        console.log(`Medición FPS: ${currentFps}fps (${frameCount} frames en ${elapsed.toFixed(0)}ms)`);
        
        // Actualizar estado
        setFps(currentFps);
        
        // Recolectar muestras (hasta 10)
        fpsSamples.current.push(currentFps);
        if (fpsSamples.current.length > 10) {
          fpsSamples.current.shift();
        }
        
        // Reiniciar contadores para el próximo segundo
        frameCount = 0;
        startTime = now;
        
        // Si tenemos suficientes muestras, podemos tomar una decisión
        if (fpsSamples.current.length >= MIN_SAMPLES && !hasDecided.current) {
          // Calcular el promedio de FPS, pero ignorar los valores extremos
          const sortedSamples = [...fpsSamples.current].sort((a, b) => a - b);
          // Eliminar el valor más bajo y más alto si tenemos suficientes muestras
          const filteredSamples = sortedSamples.length > 3 
            ? sortedSamples.slice(1, -1) 
            : sortedSamples;
          
          const avgFps = filteredSamples.reduce((a, b) => a + b, 0) / filteredSamples.length;
          
          console.log(`FPS promedio (filtrado): ${avgFps.toFixed(1)}fps`);
          console.log(`Todas las muestras: ${fpsSamples.current.join(', ')}`);
          
          // Decidir basado en el promedio de FPS (no en el tipo de dispositivo)
          const shouldUseLite = avgFps < fpsThreshold;
          console.log(`Decisión: Usar animaciones ${shouldUseLite ? 'lite' : 'normales'}`);
          
          // Cargar las animaciones correspondientes
          loadAnimations(shouldUseLite);
          
          // Marcar como decidido
          hasDecided.current = true;
          
          // Limpiar todo
          cleanupMeasurement();
        }
      }, 1000);
      
      // Configurar un tiempo máximo para la decisión (15 segundos)
      decisionTimeoutId = setTimeout(() => {
        if (!hasDecided.current) {
          // Si no hemos tomado una decisión, usar animaciones normales por defecto
          console.log('Tiempo de medición agotado. Usando animaciones normales por defecto.');
          loadAnimations(false);
          hasDecided.current = true;
          
          // Limpiar medición
          cleanupMeasurement();
        }
      }, 15000); // 15 segundos máximo
    }, 1500); // 1.5 segundos de retraso inicial
    
    // Función para limpiar todas las mediciones
    const cleanupMeasurement = () => {
      if (frameId) {
        cancelAnimationFrame(frameId);
        frameId = null;
      }
      
      if (measurementIntervalRef.current) {
        clearInterval(measurementIntervalRef.current);
        measurementIntervalRef.current = null;
      }
      
      if (decisionTimeoutId) {
        clearTimeout(decisionTimeoutId);
        decisionTimeoutId = null;
      }
    };
    
    // Limpieza al desmontar el componente
    return () => {
      clearTimeout(initialDelayId);
      cleanupMeasurement();
    };
  }, [fpsThreshold, manualMode]);

  // Función para cambiar manualmente el modo de animaciones
  const setAnimationMode = (lite: boolean) => {
    // Limpiar cualquier medición en curso
    if (measurementIntervalRef.current) {
      clearInterval(measurementIntervalRef.current);
      measurementIntervalRef.current = null;
    }
    
    setManualMode(true);
    hasDecided.current = true;
    loadAnimations(lite);
    console.log(`Modo de animaciones cambiado manualmente a: ${lite ? 'lite' : 'normal'}`);
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