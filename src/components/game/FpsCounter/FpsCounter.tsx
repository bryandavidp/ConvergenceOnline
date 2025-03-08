import React, { useState, useEffect, useRef, useCallback } from 'react';
import './FpsCounter.css';

interface FpsCounterProps {
  onPerformanceDrop?: (avgFps: number) => void;
  performanceThreshold?: number;
}

const FpsCounter: React.FC<FpsCounterProps> = ({ 
  onPerformanceDrop,
  performanceThreshold = 30 // Ajustado a 30 FPS como umbral
}) => {
  const [fps, setFps] = useState<number>(60);
  const [avgFps, setAvgFps] = useState<number>(60);
  const [showDevControls, setShowDevControls] = useState<boolean>(false);
  const [lowPerformanceDetected, setLowPerformanceDetected] = useState<boolean>(false);
  
  // Referencias para el cálculo de FPS
  const requestRef = useRef<number | null>(null);
  const previousTimeRef = useRef<number | null>(null);
  const frameCountRef = useRef<number>(0);
  const lastFpsUpdateTimeRef = useRef<number>(0);
  
  // Monitoreo de rendimiento
  const fpsHistoryRef = useRef<number[]>([]);
  const performanceCheckCompleteRef = useRef<boolean>(false);
  
  // Detectar iOS para ajustar la medición
  const isIOSRef = useRef<boolean>(false);
  
  // Detectar dispositivo al inicio
  useEffect(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    isIOSRef.current = /iphone|ipad|ipod/.test(userAgent);
    console.log(`FpsCounter: Dispositivo iOS detectado: ${isIOSRef.current}`);
  }, []);
  
  // Calcular FPS de manera más eficiente
  const updateFps = useCallback((time: number) => {
    if (previousTimeRef.current === null) {
      previousTimeRef.current = time;
      lastFpsUpdateTimeRef.current = time;
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

    // Actualizar FPS cada segundo para una lectura más estable
    const elapsed = time - lastFpsUpdateTimeRef.current;
    if (elapsed >= 1000) { // Usar intervalo de 1000ms para mejores mediciones
      // Ignorar intervalos muy cortos (puede ocurrir en iOS)
      if (elapsed < 200) {
        previousTimeRef.current = time;
        requestRef.current = requestAnimationFrame(updateFps);
        return;
      }
      
      // Calcular FPS actual: frames / tiempo (convertido a segundos)
      const currentFps = Math.round((frameCountRef.current * 1000) / elapsed);
      
      // Ignorar valores de FPS extremadamente bajos o altos (posibles errores)
      if (currentFps > 0 && currentFps < 1000) {
        setFps(currentFps);
        
        // Guardar muestra para análisis (máximo 10 muestras)
        fpsHistoryRef.current.push(currentFps);
        if (fpsHistoryRef.current.length > 10) {
          fpsHistoryRef.current.shift();
        }
        
        // Calcular promedio de FPS, ignorando valores extremos
        if (fpsHistoryRef.current.length >= 3) {
          // Ordenar valores y eliminar extremos si hay suficientes muestras
          const sortedValues = [...fpsHistoryRef.current].sort((a, b) => a - b);
          const filteredValues = sortedValues.length > 4 
            ? sortedValues.slice(1, -1) 
            : sortedValues;
          
          const newAvgFps = filteredValues.reduce((sum, val) => sum + val, 0) / filteredValues.length;
          setAvgFps(Math.round(newAvgFps));
          
          // Verificar rendimiento después de 5 segundos (5 muestras) si no se ha hecho
          if (fpsHistoryRef.current.length >= (isIOSRef.current ? 8 : 5) && !performanceCheckCompleteRef.current) {
            performanceCheckCompleteRef.current = true;
            
            // Determinar si tenemos bajo rendimiento
            const hasLowPerformance = newAvgFps < performanceThreshold;
            
            console.log(`FpsCounter: Verificación de rendimiento completada`);
            console.log(`FpsCounter: FPS promedio: ${newAvgFps.toFixed(1)} (${hasLowPerformance ? 'bajo' : 'normal'})`);
            console.log(`FpsCounter: Muestras: ${fpsHistoryRef.current.join(', ')}`);
            
            // Notificar solo si tenemos bajo rendimiento
            if (hasLowPerformance) {
              setLowPerformanceDetected(true);
              
              if (onPerformanceDrop) {
                onPerformanceDrop(newAvgFps);
              }
            }
          }
        }
      }
      
      // Reiniciar contadores para la próxima ventana de medición
      frameCountRef.current = 0;
      lastFpsUpdateTimeRef.current = time;
    }
    
    previousTimeRef.current = time;
    
    // Usar requestAnimationFrame para la siguiente medición
    requestRef.current = requestAnimationFrame(updateFps);
  }, [onPerformanceDrop, performanceThreshold]);
  
  // Iniciar y detener el loop de animación
  useEffect(() => {
    // Empezar medición después de un pequeño retraso para permitir carga inicial
    const startTimeout = setTimeout(() => {
      requestRef.current = requestAnimationFrame(updateFps);
    }, 1500); // Usar 1.5s para estar alineado con useAnimationsLoader
    
    return () => {
      clearTimeout(startTimeout);
      if (requestRef.current !== null) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [updateFps]);
  
  // Determinar el color del contador según el rendimiento
  const getFpsClass = () => {
    if (avgFps < 25) return 'critical';
    if (avgFps < 40) return 'warning';
    return '';
  };
  
  // Mostrar/ocultar controles de desarrollador
  const toggleDevControls = () => {
    setShowDevControls(!showDevControls);
    // Emitir evento para notificar a otros componentes
    if (window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('toggleDevControls', { 
        detail: { show: !showDevControls } 
      }));
    }
  };
  
  return (
    <div className={`dev-controls-container ${lowPerformanceDetected ? 'low-performance' : ''}`}>
      <div 
        className="dev-controls-toggle"
        onClick={toggleDevControls}
      >
        Controles Dev
      </div>
      <div className={`fps-counter ${getFpsClass()}`}>
        {fps} FPS
        <span className="avg-fps">Media: {avgFps}</span>
      </div>
    </div>
  );
};

export default FpsCounter; 