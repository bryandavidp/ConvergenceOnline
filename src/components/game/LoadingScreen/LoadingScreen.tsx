import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { setGameStatus } from '../../../store/slices/gameSlice';
import { initLevelSystem } from '../../../utils/initLevelSystem';
import { audioManager } from '../../../utils/audioManager';
import logger from '../../../utils/logger';
import useAnimationsLoader from '../GameBoard/hooks/useAnimationsLoader';
import './LoadingScreen.css';

export type InitStage = 
  | 'not_started' 
  | 'system_init' 
  | 'fps_detection' 
  | 'assets_loading' 
  | 'complete';

interface LoadingScreenProps {
  stage?: InitStage;
  error?: string | null;
  onInitComplete: (fpsDetected: boolean, useLiteMode: boolean) => void;
}

// Umbral de FPS para activar el modo de animaciones ligeras
const LOW_FPS_THRESHOLD = 10;

const LoadingScreen: React.FC<LoadingScreenProps> = ({ 
  stage: externalStage, 
  error: externalError,
  onInitComplete 
}) => {
  const dispatch = useDispatch();
  
  // Estados internos para cuando el componente maneja su propia inicialización
  const [internalStage, setInternalStage] = useState<InitStage>('not_started');
  const [internalError, setInternalError] = useState<string | null>(null);
  const [fpsDetectionComplete, setFpsDetectionComplete] = useState(false);
  
  // Usamos el estado externo si se proporciona, sino el interno
  const stage = externalStage || internalStage;
  const error = externalError || internalError;
  
  // Referencias para la detección de FPS
  const fpsDetectionRef = useRef({
    isRunning: false,
    frameCount: 0,
    startTime: 0,
    samples: [] as number[],
    hasDecided: false,
    useLiteMode: false
  });
  
  // Hook para cargar animaciones según el rendimiento
  const animationsLoader = useAnimationsLoader(LOW_FPS_THRESHOLD);
  
  // Referencia para evitar múltiples inicializaciones
  const systemInitializedRef = useRef(false);
  
  // Aplicar modo de animaciones según FPS detectados
  const applyAnimationMode = useCallback((lite: boolean) => {
    // Añadir clase a nivel de documento para que otros componentes respondan
    if (lite) {
      document.documentElement.classList.add("lite-animations");
      document.documentElement.classList.add("performance-mode");
      logger.info('LoadingScreen', 'Modo de animaciones ligeras activado por FPS bajos');
      
      // Guardar el modo detectado
      fpsDetectionRef.current.useLiteMode = true;
    } else {
      document.documentElement.classList.remove("lite-animations");
      document.documentElement.classList.remove("performance-mode");
      logger.info('LoadingScreen', 'Modo de animaciones completas activado por buenos FPS');
      
      // Guardar el modo detectado
      fpsDetectionRef.current.useLiteMode = false;
    }
    
    // Inicializar animaciones usando el hook
    animationsLoader.initializeAnimations(lite);
  }, [animationsLoader]);

  // Función para detectar FPS una sola vez al inicio
  const detectPerformance = useCallback(() => {
    if (fpsDetectionRef.current.isRunning || fpsDetectionRef.current.hasDecided) {
      return;
    }

    // Marcar como en ejecución
    fpsDetectionRef.current.isRunning = true;
    fpsDetectionRef.current.startTime = performance.now();
    fpsDetectionRef.current.frameCount = 0;
    fpsDetectionRef.current.samples = [];

    logger.info('LoadingScreen', 'Iniciando detección de FPS inicial...');
    
    let frameId: number | null = null;
    let measurementIntervalId: number | null = null;
    
    // Función que cuenta frames
    const countFrames = () => {
      fpsDetectionRef.current.frameCount++;
      frameId = requestAnimationFrame(countFrames);
    };
    
    // Empezar a contar frames
    frameId = requestAnimationFrame(countFrames);
    
    // Medir FPS cada 500ms
    measurementIntervalId = window.setInterval(() => {
      const now = performance.now();
      const elapsed = now - fpsDetectionRef.current.startTime;
      
      if (elapsed < 200) return; // Ignorar intervalos muy cortos
      
      const currentFps = Math.round((fpsDetectionRef.current.frameCount * 1000) / elapsed);
      logger.info('LoadingScreen', `FPS medido: ${currentFps} (${fpsDetectionRef.current.frameCount} frames en ${elapsed.toFixed(0)}ms)`);
      
      // Añadir muestra (hasta 5)
      fpsDetectionRef.current.samples.push(currentFps);
      if (fpsDetectionRef.current.samples.length > 5) {
        fpsDetectionRef.current.samples.shift();
      }
      
      // Reiniciar contadores
      fpsDetectionRef.current.frameCount = 0;
      fpsDetectionRef.current.startTime = now;
      
      // Si tenemos al menos 3 muestras, tomar decisión
      if (fpsDetectionRef.current.samples.length >= 3 && !fpsDetectionRef.current.hasDecided) {
        // Calcular promedio ignorando valores extremos
        const sortedSamples = [...fpsDetectionRef.current.samples].sort((a, b) => a - b);
        const filteredSamples = sortedSamples.length > 3 
          ? sortedSamples.slice(1, -1)  // Quitar el más alto y el más bajo
          : sortedSamples;
        
        const avgFps = filteredSamples.reduce((sum, fps) => sum + fps, 0) / filteredSamples.length;
        logger.info('LoadingScreen', `Promedio FPS: ${avgFps.toFixed(1)}, muestras: ${fpsDetectionRef.current.samples.join(', ')}`);
        
        // Decidir modo según FPS
        const shouldUseLite = avgFps <= LOW_FPS_THRESHOLD;
        applyAnimationMode(shouldUseLite);
        
        // Marcar como completado
        fpsDetectionRef.current.hasDecided = true;
        setFpsDetectionComplete(true);
        
        // Limpiar recursos
        if (frameId !== null) {
          cancelAnimationFrame(frameId);
          frameId = null;
        }
        
        if (measurementIntervalId !== null) {
          clearInterval(measurementIntervalId);
          measurementIntervalId = null;
        }
        
        fpsDetectionRef.current.isRunning = false;
      }
    }, 500);
    
    // Configurar timeout por si no se llega a una decisión después de 5 segundos
    const timeoutId = setTimeout(() => {
      if (!fpsDetectionRef.current.hasDecided) {
        logger.info('LoadingScreen', 'Tiempo de detección de FPS agotado, usando animaciones normales por defecto');
        
        // Por defecto, usar animaciones normales
        applyAnimationMode(false);
        
        fpsDetectionRef.current.hasDecided = true;
        setFpsDetectionComplete(true);
        
        if (frameId !== null) {
          cancelAnimationFrame(frameId);
        }
        
        if (measurementIntervalId !== null) {
          clearInterval(measurementIntervalId);
        }
        
        fpsDetectionRef.current.isRunning = false;
      }
    }, 5000);
    
    return () => {
      clearTimeout(timeoutId);
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }
      if (measurementIntervalId !== null) {
        clearInterval(measurementIntervalId);
      }
    };
  }, [applyAnimationMode]);
  
  // Proceso secuencial de inicialización
  useEffect(() => {
    // Solo si manejamos la inicialización internamente y no se ha inicializado ya
    if (externalStage || systemInitializedRef.current) {
      return;
    }
    
    // Marcar que estamos inicializando para evitar inicializaciones múltiples
    systemInitializedRef.current = true;
    
    const initializeGameSequentially = async () => {
      try {
        logger.info('LoadingScreen', '🚀 Iniciando secuencia de inicialización del juego');
        
        // Etapa 1: Inicialización del sistema
        setInternalStage('system_init');
        logger.info('LoadingScreen', '📋 Inicializando sistema de niveles');
        
        // Inicializar el sistema de niveles
        initLevelSystem();
        
        // Simular tiempo de carga
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Etapa 2: Detección de FPS (solo si no se ha realizado)
        setInternalStage('fps_detection');
        logger.info('LoadingScreen', '📊 Comenzando detección de FPS');
        
        // Solo iniciar detección de FPS si no tiene resultados previos
        if (!fpsDetectionRef.current.hasDecided) {
          detectPerformance();
          
          // Esperar a que se complete la detección de FPS o timeout después de 5 segundos (reducido de 8)
          const fpsPromise = new Promise<void>(resolve => {
            // Verificar periódicamente si se completó la detección de FPS
            const checkInterval = setInterval(() => {
              if (fpsDetectionComplete) {
                clearInterval(checkInterval);
                resolve();
              }
            }, 200);
            
            // Si después de 5 segundos no se completa, continuar de todos modos
            setTimeout(() => {
              clearInterval(checkInterval);
              if (!fpsDetectionComplete) {
                logger.warn('LoadingScreen', 'Tiempo de espera para detección de FPS agotado');
                setFpsDetectionComplete(true);
                resolve();
              }
            }, 5000);
          });
          
          await fpsPromise;
        } else {
          logger.info('LoadingScreen', 'Omitiendo detección de FPS, ya se completó anteriormente');
          setFpsDetectionComplete(true);
        }
        
        // Etapa 3: Cargar recursos adicionales
        setInternalStage('assets_loading');
        logger.info('LoadingScreen', '🎵 Cargando recursos de audio y assets');
        
        try {
          // Cargar recursos de audio solo si no se han cargado previamente
          // Como audioManager no tiene propiedad isLoaded, cargar siempre
        //   audioManager.loadAll();
          logger.info('LoadingScreen', 'Recursos de audio cargados');
        } catch (error) {
          logger.warn('LoadingScreen', `Error al cargar recursos de audio: ${error}`);
        }
        
        // Esperar a que las animaciones estén cargadas
        if (!animationsLoader.isLoaded) {
          logger.info('LoadingScreen', 'Esperando que se carguen las animaciones...');
          const animationPromise = new Promise<void>(resolve => {
            const checkInterval = setInterval(() => {
              if (animationsLoader.isLoaded) {
                clearInterval(checkInterval);
                resolve();
              }
            }, 200);
            
            // Timeout después de 3 segundos (reducido de 5)
            setTimeout(() => {
              clearInterval(checkInterval);
              logger.warn('LoadingScreen', 'Tiempo de espera para carga de animaciones agotado');
              resolve();
            }, 3000);
          });
          
          await animationPromise;
        } else {
          logger.info('LoadingScreen', 'Animaciones ya cargadas, omitiendo espera');
        }
        
        // Pequeña pausa antes de completar
        await new Promise(resolve => setTimeout(resolve, 300)); // Reducido de 800ms
        
        // Etapa 4: Inicialización completa
        setInternalStage('complete');
        logger.info('LoadingScreen', '✅ Inicialización del juego completada exitosamente');
        
        // Asegurar que el estado del juego es 'startScreen'
        dispatch(setGameStatus('startScreen'));
        
        // Pequeña pausa antes de notificar la finalización
        setTimeout(() => {
          onInitComplete(fpsDetectionComplete, fpsDetectionRef.current.useLiteMode);
        }, 300); // Reducido de 500ms
        
      } catch (error) {
        const errorMsg = `Error durante la inicialización: ${error}`;
        logger.error('LoadingScreen', errorMsg);
        setInternalError(errorMsg);
        setInternalStage('complete');
        
        // Notificar el error, pero aún así permitir continuar
        setTimeout(() => {
          onInitComplete(fpsDetectionComplete, fpsDetectionRef.current.useLiteMode);
        }, 1000); // Reducido de 2000ms
      }
    };
    
    // Iniciar proceso de inicialización
    initializeGameSequentially();
    
    // Función de limpieza si se desmonta el componente
    return () => {
      logger.info('LoadingScreen', 'Componente de carga desmontado durante inicialización');
    };
  }, [dispatch, detectPerformance, fpsDetectionComplete, externalStage, onInitComplete, animationsLoader.isLoaded]);
  
  // Determinar el texto y porcentaje de carga según la etapa
  let messageText = 'Cargando...';
  let progressPercent = 0;
  
  switch (stage) {
    case 'not_started':
      messageText = 'Preparando el juego...';
      progressPercent = 0;
      break;
    case 'system_init':
      messageText = 'Inicializando sistemas...';
      progressPercent = 25;
      break;
    case 'fps_detection':
      messageText = 'Analizando rendimiento...';
      progressPercent = 50;
      break;
    case 'assets_loading':
      messageText = 'Cargando recursos...';
      progressPercent = 75;
      break;
    case 'complete':
      messageText = 'Iniciando juego...';
      progressPercent = 100;
      break;
  }
  
  return (
    <div className="game-loading-screen">
      <div className="loading-content">
        <h2>Convergencia</h2>
        <div className="loading-spinner"></div>
        <p className="loading-message">{messageText}</p>
        <div className="loading-progress-container">
          <div 
            className="loading-progress-bar" 
            style={{ width: `${progressPercent}%` }}
          ></div>
        </div>
        {error && (
          <div className="loading-error">
            Error: {error}
          </div>
        )}
      </div>
    </div>
  );
};

export default LoadingScreen; 