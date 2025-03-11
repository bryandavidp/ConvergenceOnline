import React, { useState, useEffect, useRef } from 'react';
import './FpsCounter.css';

interface FpsCounterProps {
  performanceThreshold?: number; // Umbral de FPS para considerar bajo rendimiento
}

/**
 * Componente para mostrar los FPS actuales.
 * Ya no detecta caídas de rendimiento, solo muestra información.
 */
const FpsCounter: React.FC<FpsCounterProps> = ({
  performanceThreshold = 30
}) => {
  // Estado para los FPS actuales
  const [fps, setFps] = useState<number | null>(null);
  
  // Referencia para mantener contadores entre renders
  const fpsRef = useRef({
    frames: 0,
    lastTime: performance.now(),
    samples: [] as number[],
  });

  // Efecto para medir FPS
  useEffect(() => {
    let frameId: number;
    let intervalId: NodeJS.Timeout;
    
    // Función que se ejecuta en cada frame
    const countFrame = () => {
      fpsRef.current.frames++;
      frameId = requestAnimationFrame(countFrame);
    };
    
    // Iniciar conteo de frames
    frameId = requestAnimationFrame(countFrame);
    
    // Calcular FPS cada segundo
    intervalId = setInterval(() => {
      const now = performance.now();
      const elapsed = now - fpsRef.current.lastTime;
      
      if (elapsed < 200) return; // Ignorar intervalos muy cortos
      
      const currentFps = Math.round((fpsRef.current.frames * 1000) / elapsed);
      setFps(currentFps);
      
      // Guardar en historial (máximo 5 muestras)
      fpsRef.current.samples.push(currentFps);
      if (fpsRef.current.samples.length > 5) {
        fpsRef.current.samples.shift();
      }
      
      // Reiniciar contadores
      fpsRef.current.frames = 0;
      fpsRef.current.lastTime = now;
    }, 1000);
    
    // Limpieza al desmontar
    return () => {
      cancelAnimationFrame(frameId);
      clearInterval(intervalId);
    };
  }, []);
  
  // Calcular color según FPS (solo visual)
  const getFpsColor = () => {
    if (!fps) return 'var(--color-text-secondary)';
    if (fps >= performanceThreshold) return 'var(--color-success)';
    if (fps >= performanceThreshold / 2) return 'var(--color-warning)';
    return 'var(--color-danger)';
  };
  
  return (
    <div className="fps-counter">
      <span style={{ color: getFpsColor() }}>
        {fps ? `${fps} FPS` : 'Calculando...'}
      </span>
    </div>
  );
};

export default FpsCounter; 