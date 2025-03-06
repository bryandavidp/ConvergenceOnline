import React, { useState, useEffect, useRef, useCallback } from 'react';
import './FpsCounter.css';
import { PERFORMANCE_CONFIG } from '../../../utils/config';

interface FpsCounterProps {
  onPerformanceDrop?: (avgFps: number) => void;
  performanceThreshold?: number;
  criticalThreshold?: number;
}

const FpsCounter: React.FC<FpsCounterProps> = ({ 
  onPerformanceDrop,
  performanceThreshold = PERFORMANCE_CONFIG.LOW_FPS_THRESHOLD, // Usar configuración global
  criticalThreshold = PERFORMANCE_CONFIG.CRITICAL_FPS_THRESHOLD // Usar configuración global
}) => {
  const [fps, setFps] = useState<number>(60); // Iniciar con un valor predeterminado razonable
  const [maxFps, setMaxFps] = useState<number>(60);
  const [minFps, setMinFps] = useState<number>(60);
  const [avgFps, setAvgFps] = useState<number>(60);
  const [showDetailed, setShowDetailed] = useState<boolean>(false);
  const [performanceMode, setPerformanceMode] = useState<boolean>(false);
  const [performanceDropDetected, setPerformanceDropDetected] = useState<boolean>(false);
  const [criticalPerformanceMode, setCriticalPerformanceMode] = useState<boolean>(false);
  
  // Referencias para el cálculo de FPS
  const requestRef = useRef<number | null>(null);
  const previousTimeRef = useRef<number | null>(null);
  const frameCountRef = useRef<number>(0);
  const lastFpsUpdateTimeRef = useRef<number>(0);
  
  // Referencias para calcular estadísticas
  const fpsHistoryRef = useRef<number[]>([60, 60, 60]); // Iniciar con valores razonables
  const maxFpsRecordedRef = useRef<number>(60);
  const minFpsRecordedRef = useRef<number>(60);
  const totalFramesRef = useRef<number>(0);
  const totalTimeRef = useRef<number>(0);
  
  // Referencia para los bajones de rendimiento
  const dropCountRef = useRef<number>(0);
  const lastPerformanceCheckRef = useRef<number>(0);
  const performanceNotifiedRef = useRef<boolean>(false);
  const criticalPerformanceNotifiedRef = useRef<boolean>(false);
  const startupPhaseRef = useRef<boolean>(true);
  
  // Timer para fase de inicio
  useEffect(() => {
    // Dar tiempo al sistema para estabilizarse antes de comenzar a detectar problemas
    const startupTimer = setTimeout(() => {
      startupPhaseRef.current = false;
    }, 5000);
    
    return () => clearTimeout(startupTimer);
  }, []);
  
  // Comprobar si debemos forzar el modo de rendimiento (para pruebas)
  useEffect(() => {
    // Si está configurado para forzar el modo de bajo rendimiento
    if (PERFORMANCE_CONFIG.FORCE_PERFORMANCE_MODE) {
      setPerformanceMode(true);
      setPerformanceDropDetected(true);
      performanceNotifiedRef.current = true;
      
      // Notificar al componente padre si hay un callback
      if (onPerformanceDrop) {
        onPerformanceDrop(performanceThreshold - 5);
      }
      
      // Notificar al documento
      document.documentElement.classList.add('performance-mode');
      console.warn('Modo de rendimiento forzado mediante configuración');
    }
    // Si está configurado para forzar el modo de alto rendimiento
    else if (PERFORMANCE_CONFIG.FORCE_HIGH_PERFORMANCE_MODE) {
      setPerformanceMode(true);
      setCriticalPerformanceMode(true);
      setPerformanceDropDetected(true);
      performanceNotifiedRef.current = true;
      criticalPerformanceNotifiedRef.current = true;
      
      // Notificar al componente padre si hay un callback
      if (onPerformanceDrop) {
        onPerformanceDrop(criticalThreshold - 5);
      }
      
      // Notificar al documento
      document.documentElement.classList.add('performance-mode');
      document.documentElement.classList.add('performance-mode-high');
      console.warn('Modo de rendimiento ALTO forzado mediante configuración');
    }
  }, [criticalThreshold, onPerformanceDrop, performanceThreshold]);
  
  // Función para detectar bajones de rendimiento
  const checkPerformanceDrop = useCallback((currentFps: number) => {
    // Ignorar detección durante la fase inicial de carga
    if (startupPhaseRef.current) {
      return;
    }
    
    // Ignorar FPS de 0, que podrían ser falsas lecturas, pero permitir FPS muy bajos
    if (currentFps === 0) {
      // Si tenemos historial de FPS, usar el último valor válido
      if (fpsHistoryRef.current.length > 0) {
        const lastValidFps = fpsHistoryRef.current[fpsHistoryRef.current.length - 1];
        currentFps = lastValidFps > 0 ? lastValidFps : 10; // Default a 10 FPS si no hay valores válidos
      } else {
        currentFps = 10; // Default conservador
      }
    }
    
    const now = Date.now();
    
    // Solo revisar cada medio segundo para ser más reactivo
    if (now - lastPerformanceCheckRef.current < 500) {
      return;
    }
    
    lastPerformanceCheckRef.current = now;
    
    // Si ya notificamos, no seguir aumentando el contador
    if (criticalPerformanceNotifiedRef.current || performanceNotifiedRef.current) {
      return;
    }
    
    // Verificar si el FPS es extremadamente bajo (situación crítica)
    if (currentFps < criticalThreshold) {
      dropCountRef.current += 2; // Incrementar más rápido en caso crítico
      console.log(`FPS crítico detectado: ${currentFps}, contador: ${dropCountRef.current}`);
    }
    // Si el FPS actual está por debajo del umbral, aumentar contador
    else if (currentFps < performanceThreshold) {
      dropCountRef.current++;
      console.log(`FPS bajo detectado: ${currentFps}, contador: ${dropCountRef.current}`);
    } else {
      // Restablecer contador si tenemos buenos FPS
      dropCountRef.current = Math.max(0, dropCountRef.current - 1);
    }
    
    // Umbrales ajustados para mejor detección
    // Si detectamos muchos bajones en un período corto (modo crítico)
    if (dropCountRef.current >= 5 && !criticalPerformanceNotifiedRef.current) {
      setCriticalPerformanceMode(true);
      setPerformanceMode(true);
      setPerformanceDropDetected(true);
      
      // Marcar como notificado para evitar múltiples activaciones
      criticalPerformanceNotifiedRef.current = true;
      performanceNotifiedRef.current = true;
      
      // Notificar al componente padre si hay un callback
      if (onPerformanceDrop) {
        // Usar el valor real de avgFps, pero asegurar que sea > 0
        const reportedFps = Math.max(1, avgFps);
        onPerformanceDrop(reportedFps);
      }
      
      // Notificar al documento para que otros componentes respondan
      document.documentElement.classList.add('performance-mode');
      document.documentElement.classList.add('performance-mode-high');
      
      // Registrar en la consola
      console.warn(`Bajón de rendimiento CRÍTICO detectado. FPS promedio: ${avgFps}. Activando modo de rendimiento alto.`);
    }
    // Si detectamos algunos bajones en un período corto (modo normal)
    else if (dropCountRef.current >= 3 && !performanceNotifiedRef.current) {
      setPerformanceDropDetected(true);
      setPerformanceMode(true);
      
      // Marcar como notificado para evitar múltiples activaciones
      performanceNotifiedRef.current = true;
      
      // Notificar al componente padre si hay un callback
      if (onPerformanceDrop) {
        // Usar el valor real de avgFps, pero asegurar que sea > 0
        const reportedFps = Math.max(1, avgFps);
        onPerformanceDrop(reportedFps);
      }
      
      // Notificar al documento para que otros componentes respondan
      document.documentElement.classList.add('performance-mode');
      
      // Registrar en la consola
      console.warn(`Bajón de rendimiento detectado. FPS promedio: ${avgFps}. Activando modo de rendimiento.`);
    }
  }, [avgFps, criticalThreshold, onPerformanceDrop, performanceThreshold]);
  
  // Calcular FPS y actualizar métricas
  const updateFps = (time: number) => {
    if (previousTimeRef.current === null) {
      previousTimeRef.current = time;
      lastFpsUpdateTimeRef.current = time;
      
      // No calcular FPS en la primera frame
      requestRef.current = requestAnimationFrame(updateFps);
      return;
    }

    // Calcular delta de tiempo para esta frame
    const deltaTime = time - (previousTimeRef.current || 0);
    
    // Prevenir divisiones por cero y valores negativos
    if (deltaTime <= 0) {
      previousTimeRef.current = time;
      requestRef.current = requestAnimationFrame(updateFps);
      return;
    }
    
    // Añadir al contador de frames
    frameCountRef.current++;
    totalFramesRef.current++;
    totalTimeRef.current += deltaTime;

    // Actualizar FPS cada 0.5 segundos para una lectura más estable
    const elapsed = time - lastFpsUpdateTimeRef.current;
    if (elapsed >= 500) {
      // Prevenir divisiones por cero
      if (elapsed <= 0 || frameCountRef.current <= 0) {
        previousTimeRef.current = time;
        requestRef.current = requestAnimationFrame(updateFps);
        return;
      }
      
      // Calcular FPS actual: frames / tiempo (convertido a segundos)
      const currentFps = Math.round((frameCountRef.current * 1000) / elapsed);
      
      // Ignorar valores de FPS extremadamente bajos o altos (posibles errores)
      if (currentFps > 0 && currentFps < 1000) {
        setFps(currentFps);
        
        // Comprobar si hay bajones de rendimiento
        checkPerformanceDrop(currentFps);
        
        // Registrar para el historial y cálculos de estadísticas
        fpsHistoryRef.current.push(currentFps);
        
        // Limitar el historial a las últimas 10 mediciones (5 segundos)
        if (fpsHistoryRef.current.length > 10) {
          fpsHistoryRef.current.shift();
        }
        
        // Actualizar máximo y mínimo
        if (currentFps > maxFpsRecordedRef.current) {
          maxFpsRecordedRef.current = currentFps;
          setMaxFps(currentFps);
        }
        
        if (currentFps < minFpsRecordedRef.current && currentFps > 0) {
          minFpsRecordedRef.current = currentFps;
          setMinFps(currentFps);
        }
        
        // Calcular promedio
        if (fpsHistoryRef.current.length > 0) {
          const sum = fpsHistoryRef.current.reduce((acc, val) => acc + val, 0);
          const average = Math.round(sum / fpsHistoryRef.current.length);
          setAvgFps(average);
        }
      }
      
      // Reiniciar contadores para la próxima medición
      frameCountRef.current = 0;
      lastFpsUpdateTimeRef.current = time;
    }

    previousTimeRef.current = time;
    requestRef.current = requestAnimationFrame(updateFps);
  };

  // Iniciar la medición al montar el componente
  useEffect(() => {
    requestRef.current = requestAnimationFrame(updateFps);
    
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, []);
  
  // Cambiar entre vista simple y detallada al hacer clic
  const toggleDetailedView = () => {
    setShowDetailed(!showDetailed);
  };

  // Determinar el color del indicador de FPS
  const getFpsColor = () => {
    if (fps >= 55) return 'fps-good';
    if (fps >= 30) return 'fps-medium';
    return 'fps-bad';
  };

  return (
    <div 
      className={`fps-counter ${showDetailed ? 'detailed' : ''} ${getFpsColor()} ${performanceMode ? 'performance-mode' : ''} ${criticalPerformanceMode ? 'critical-mode' : ''}`} 
      onClick={toggleDetailedView}
    >
      {!showDetailed ? (
        <>{fps} FPS {performanceMode && <small style={{fontSize: '9px'}}>⚡</small>}</>
      ) : (
        <div className="fps-details">
          <div>Act: {fps} FPS</div>
          <div>Min: {minFps === 1000 ? '-' : minFps} FPS</div>
          <div>Max: {maxFps} FPS</div>
          <div>Prom: {avgFps} FPS</div>
          {performanceMode && 
            <div className={`performance-indicator ${criticalPerformanceMode ? 'critical' : ''}`}>
              ⚡ Modo Rendimiento {criticalPerformanceMode ? 'Alto' : ''}
            </div>
          }
        </div>
      )}
    </div>
  );
};

export default FpsCounter; 