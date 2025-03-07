import React, { useState, useEffect, useRef, useCallback } from 'react';
import './FpsCounter.css';

interface FpsCounterProps {
  onPerformanceDrop?: (avgFps: number) => void;
  performanceThreshold?: number;
}

const FpsCounter: React.FC<FpsCounterProps> = ({ 
  onPerformanceDrop,
  performanceThreshold = 35
}) => {
  const [fps, setFps] = useState<number>(60);
  const [showDevControls, setShowDevControls] = useState<boolean>(false);
  
  // Referencias para el cálculo de FPS
  const requestRef = useRef<number | null>(null);
  const previousTimeRef = useRef<number | null>(null);
  const frameCountRef = useRef<number>(0);
  const lastFpsUpdateTimeRef = useRef<number>(0);
  
  // Calcular FPS
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

    // Actualizar FPS cada 0.5 segundos para una lectura más estable
    const elapsed = time - lastFpsUpdateTimeRef.current;
    if (elapsed >= 500) {
      // Calcular FPS actual: frames / tiempo (convertido a segundos)
      const currentFps = Math.round((frameCountRef.current * 1000) / elapsed);
      
      // Ignorar valores de FPS extremadamente bajos o altos (posibles errores)
      if (currentFps > 0 && currentFps < 1000) {
        setFps(currentFps);
        
        // Comprobar si hay bajones de rendimiento
        if (currentFps < performanceThreshold && onPerformanceDrop) {
          onPerformanceDrop(currentFps);
        }
      }
      
      // Reiniciar contadores para la próxima ventana de medición
      frameCountRef.current = 0;
      lastFpsUpdateTimeRef.current = time;
    }
    
    previousTimeRef.current = time;
    requestRef.current = requestAnimationFrame(updateFps);
  }, [onPerformanceDrop, performanceThreshold]);
  
  // Iniciar y detener el loop de animación
  useEffect(() => {
    requestRef.current = requestAnimationFrame(updateFps);
    return () => {
      if (requestRef.current !== null) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [updateFps]);
  
  // Determinar el color del contador según el rendimiento
  const getFpsClass = () => {
    if (fps < 30) return 'critical';
    if (fps < 45) return 'warning';
    return '';
  };
  
  // Mostrar/ocultar controles de desarrollador
  const toggleDevControls = () => {
    setShowDevControls(!showDevControls);
    // Aquí podemos emitir un evento o actualizar el estado global
    if (window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('toggleDevControls', { 
        detail: { show: !showDevControls } 
      }));
    }
  };
  
  return (
    <div className="dev-controls-container">
      <div 
        className="dev-controls-toggle"
        onClick={toggleDevControls}
      >
        Controles Dev
      </div>
      <div className={`fps-counter ${getFpsClass()}`}>
        {fps} FPS
      </div>
    </div>
  );
};

export default FpsCounter; 