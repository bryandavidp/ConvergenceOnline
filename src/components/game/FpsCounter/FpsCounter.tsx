import React, { useState, useEffect, useRef } from 'react';
import './FpsCounter.css';

const FpsCounter: React.FC = () => {
  const [fps, setFps] = useState<number>(0);
  const [maxFps, setMaxFps] = useState<number>(0);
  const [minFps, setMinFps] = useState<number>(1000);
  const [avgFps, setAvgFps] = useState<number>(0);
  const [showDetailed, setShowDetailed] = useState<boolean>(false);
  
  // Referencias para el cálculo de FPS
  const requestRef = useRef<number | null>(null);
  const previousTimeRef = useRef<number | null>(null);
  const frameCountRef = useRef<number>(0);
  const lastFpsUpdateTimeRef = useRef<number>(0);
  
  // Referencias para calcular estadísticas
  const fpsHistoryRef = useRef<number[]>([]);
  const maxFpsRecordedRef = useRef<number>(0);
  const minFpsRecordedRef = useRef<number>(1000);
  const totalFramesRef = useRef<number>(0);
  const totalTimeRef = useRef<number>(0);
  
  // Calcular FPS y actualizar métricas
  const updateFps = (time: number) => {
    if (previousTimeRef.current === null) {
      previousTimeRef.current = time;
      lastFpsUpdateTimeRef.current = time;
    }

    // Calcular delta de tiempo para esta frame
    const deltaTime = time - (previousTimeRef.current || 0);
    
    // Añadir al contador de frames
    frameCountRef.current++;
    totalFramesRef.current++;
    totalTimeRef.current += deltaTime;

    // Actualizar FPS cada 0.5 segundos para una lectura más estable
    const elapsed = time - lastFpsUpdateTimeRef.current;
    if (elapsed >= 500) {
      // Calcular FPS actual: frames / tiempo (convertido a segundos)
      const currentFps = Math.round((frameCountRef.current * 1000) / elapsed);
      setFps(currentFps);
      
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

  return (
    <div className={`fps-counter ${showDetailed ? 'detailed' : ''}`} onClick={toggleDetailedView}>
      {!showDetailed ? (
        <>{fps} FPS</>
      ) : (
        <div className="fps-details">
          <div>Act: {fps} FPS</div>
          <div>Min: {minFps === 1000 ? '-' : minFps} FPS</div>
          <div>Max: {maxFps} FPS</div>
          <div>Prom: {avgFps} FPS</div>
        </div>
      )}
    </div>
  );
};

export default FpsCounter; 