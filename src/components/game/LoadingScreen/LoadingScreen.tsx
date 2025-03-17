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
const LOW_FPS_THRESHOLD = 25;
// Tiempos más cortos para mejorar la experiencia de carga
const FPS_DETECTION_TIMEOUT = 1500; // Reducido de 3000ms a 1500ms
const ANIMATION_LOAD_TIMEOUT = 1500; // Reducido de 2500ms a 1500ms

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
    } else {
      document.documentElement.classList.remove("lite-animations");
      document.documentElement.classList.remove("performance-mode");
      logger.info('LoadingScreen', 'Modo de animaciones completas activado por buenos FPS');
    }
    
    // Guardar el modo detectado
    fpsDetectionRef.current.useLiteMode = lite;
    
    // Inicializar animaciones usando el hook
    animationsLoader.initializeAnimations(lite);
  }, [animationsLoader]);

  // Función simplificada para detectar FPS
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
    
    // Función simplificada que cuenta frames
    const countFrames = () => {
      fpsDetectionRef.current.frameCount++;
      frameId = requestAnimationFrame(countFrames);
    };
    
    // Empezar a contar frames
    frameId = requestAnimationFrame(countFrames);
    
    // Medición única después de un tiempo fijo
    const measurementTimeout = setTimeout(() => {
      const now = performance.now();
      const elapsed = now - fpsDetectionRef.current.startTime;
      
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
        frameId = null;
      }
      
      // Cálculo simplificado de FPS
      const fps = Math.round((fpsDetectionRef.current.frameCount * 1000) / elapsed);
      logger.info('LoadingScreen', `FPS medido: ${fps} (${fpsDetectionRef.current.frameCount} frames en ${elapsed.toFixed(0)}ms)`);
      
      // Decisión inmediata basada en el FPS obtenido
      const useLiteMode = fps <= LOW_FPS_THRESHOLD;
      applyAnimationMode(useLiteMode);
      
      // Marcar como completado
      fpsDetectionRef.current.hasDecided = true;
      fpsDetectionRef.current.isRunning = false;
      setFpsDetectionComplete(true);
      
      logger.info('LoadingScreen', `Detección de FPS completada: ${fps} FPS, modo ${useLiteMode ? 'ligero' : 'normal'}`);
    }, 300); // Solo 300ms de medición es suficiente
    
    return () => {
      clearTimeout(measurementTimeout);
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
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
    
    // Función para continuar independientemente de si el FPS se detectó correctamente
    const continueToAssetsLoading = (useFallbackMode = false) => {
      if (useFallbackMode && !fpsDetectionRef.current.hasDecided) {
        logger.warn('LoadingScreen', 'Usando modo de animaciones por defecto debido a timeout en FPS');
        // Usar animaciones normales por defecto
        applyAnimationMode(false);
        fpsDetectionRef.current.hasDecided = true;
        setFpsDetectionComplete(true);
      }
      
      setInternalStage('assets_loading');
      logger.info('LoadingScreen', '🎵 Cargando recursos de audio y assets');
      
      try {
        logger.info('LoadingScreen', 'Recursos de audio cargados');
      } catch (error) {
        logger.warn('LoadingScreen', `Error al cargar recursos de audio: ${error}`);
      }
      
      // Inicializar animaciones directamente si no se ha hecho
      if (!animationsLoader.isInitialized()) {
        const useLite = fpsDetectionRef.current.useLiteMode;
        logger.info('LoadingScreen', `Inicializando animaciones en modo: ${useLite ? 'lite' : 'normal'}`);
        animationsLoader.initializeAnimations(useLite);
      }
      
      // Continuar después de un breve retraso sin esperar a que se carguen completamente
      setTimeout(() => {
        completeInitialization();
      }, 200);
    };
    
    // Función para completar la inicialización
    const completeInitialization = () => {
      setInternalStage('complete');
      logger.info('LoadingScreen', '✅ Inicialización del juego completada exitosamente');
      
      // Asegurar que el estado del juego es 'startScreen'
      dispatch(setGameStatus('startScreen'));
      
      // Pequeña pausa antes de notificar la finalización
      setTimeout(() => {
        onInitComplete(fpsDetectionComplete, fpsDetectionRef.current.useLiteMode);
      }, 200);
    };
    
    const initializeGameSequentially = async () => {
      try {
        logger.info('LoadingScreen', '🚀 Iniciando secuencia de inicialización del juego');
        
        // Etapa 1: Inicialización del sistema
        setInternalStage('system_init');
        logger.info('LoadingScreen', '📋 Inicializando sistema de niveles');
        
        // Inicializar el sistema de niveles
        initLevelSystem();
        
        // Etapa 2: Detección de FPS rápida
        setInternalStage('fps_detection');
        logger.info('LoadingScreen', '📊 Comenzando detección de FPS');
        
        // Iniciar detección de FPS
        detectPerformance();
        
        // Configurar un timeout para continuar si la detección de FPS tarda demasiado
        const fpsTimeout = setTimeout(() => {
          if (!fpsDetectionComplete) {
            logger.warn('LoadingScreen', 'Tiempo de espera para detección de FPS agotado');
            continueToAssetsLoading(true);
          }
        }, FPS_DETECTION_TIMEOUT);
        
        // Verificar periódicamente si se completó la detección de FPS
        const fpsCheckInterval = setInterval(() => {
          if (fpsDetectionComplete) {
            clearInterval(fpsCheckInterval);
            clearTimeout(fpsTimeout);
            continueToAssetsLoading();
          }
        }, 100);
        
      } catch (error) {
        const errorMsg = `Error durante la inicialización: ${error}`;
        logger.error('LoadingScreen', errorMsg);
        setInternalError(errorMsg);
        
        // En caso de error, intentar continuar de todos modos
        if (!fpsDetectionRef.current.hasDecided) {
          applyAnimationMode(false); // Modo por defecto en caso de error
          fpsDetectionRef.current.hasDecided = true;
        }
        
        setInternalStage('complete');
        
        // Notificar el error, pero aún así permitir continuar
        setTimeout(() => {
          onInitComplete(fpsDetectionComplete, fpsDetectionRef.current.useLiteMode);
        }, 500);
      }
    };
    
    // Iniciar proceso de inicialización
    initializeGameSequentially();
    
    // Función de limpieza si se desmonta el componente
    return () => {
      logger.info('LoadingScreen', 'Componente de carga desmontado durante inicialización');
    };
  }, [dispatch, detectPerformance, fpsDetectionComplete, externalStage, onInitComplete, applyAnimationMode, animationsLoader]);
  
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