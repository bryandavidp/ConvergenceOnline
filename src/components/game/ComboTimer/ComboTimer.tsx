import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../../store';
import { audioManager } from '../../../utils/audioManager';
import './ComboTimer.css';

/**
 * Componente que muestra un indicador de combo rediseñado con
 * el multiplicador prominente en el centro y el icono como fondo
 */
const ComboTimer: React.FC = () => {
  // Obtenemos los datos del combo desde el estado
  const { 
    comboCount, 
    comboMultiplier, 
    comboTimestamp, 
    comboTimeWindow 
  } = useSelector((state: RootState) => state.game);
  
  // Estado para controlar la visibilidad y el porcentaje de tiempo restante
  const [visible, setVisible] = useState(false);
  const [timePercentage, setTimePercentage] = useState(100);
  
  // Referencia para el intervalo de actualización
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Detectar si estamos en modo de rendimiento bajo (con fallback seguro)
  const isPerformanceMode = typeof document !== 'undefined' && 
    document.documentElement.classList.contains('performance-mode');
  
  // Determinar la clase y el icono del combo según el multiplicador
  const comboLevel = useMemo(() => {
    if (!comboMultiplier || comboMultiplier < 1.5) return { class: 'combo-basic', icon: '🔄' };
    if (comboMultiplier >= 5.0) return { class: 'combo-legendary', icon: '✨' };
    if (comboMultiplier >= 3.0) return { class: 'combo-epic', icon: '🔥' };
    if (comboMultiplier >= 2.0) return { class: 'combo-rare', icon: '💫' };
    return { class: 'combo-uncommon', icon: '⚡' };
  }, [comboMultiplier]);
  
  // Calcular el estilo del temporizador usando la variable CSS --angle para el conic-gradient
  const timerStyle = useMemo(() => {
    // Convertir el porcentaje a grados para el gradiente cónico (360deg = círculo completo)
    const angleInDegrees = Math.floor((timePercentage / 100) * 360);
    
    return {
      '--angle': `${angleInDegrees}deg`
    } as React.CSSProperties;
  }, [timePercentage]);
  
  // Formatea el multiplicador para mostrarlo con precisión y sin decimales innecesarios
  const formatMultiplier = (value: number): string => {
    if (!value || value < 1) return 'x1.0';
    
    // Si es un número entero o el decimal es .0, mostrar sin decimales
    if (value % 1 === 0 || (value * 10) % 10 === 0) {
      return `x${Math.floor(value)}`;
    }
    
    // En caso contrario, mostrar con un decimal
    return `x${value.toFixed(1)}`;
  };
  
  // Ajustar el sonido cuando cambia el nivel de combo
  useEffect(() => {
    if (visible && comboCount && comboCount >= 3) {
      // Reproducir un sonido acorde al nivel de combo
      if (comboMultiplier && comboMultiplier >= 5.0) {
        audioManager.play('comboLarge');
      } else if (comboMultiplier && comboMultiplier >= 3.0) {
        audioManager.play('comboMedium');
      } else if (comboMultiplier && comboMultiplier >= 1.5) {
        audioManager.play('comboSmall');
      }
    }
  }, [visible, comboCount, comboMultiplier]);
  
  // Efecto para forzar la visibilidad al inicio si hay combo activo
  useEffect(() => {
    // Verificar directamente si hay un combo activo
    const hasActiveCombo = comboCount && comboCount >= 3 && comboTimestamp > 0;
    if (hasActiveCombo) {
      setVisible(true);
    }
  }, [comboCount, comboTimestamp]);
  
  // Mostrar/ocultar el indicador según el estado del combo
  useEffect(() => {
    // Verificar si hay un combo activo
    const hasActiveCombo = comboCount && comboCount >= 3 && comboTimestamp > 0;
    
    // Actualizar la visibilidad inmediatamente según el estado actual
    setVisible(Boolean(hasActiveCombo));
    
    // Limpiar intervalo existente
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    // Solo continuar si hay un combo activo
    if (hasActiveCombo) {
      setTimePercentage(100); // Iniciar al 100%
      
      // Configurar la frecuencia de actualización para mejor fluidez
      const updateFrequency = isPerformanceMode ? 100 : 16; // ~60fps para animación fluida
      
      // Actualizar el porcentaje de tiempo restante
      intervalRef.current = setInterval(() => {
        const currentTime = Date.now();
        const elapsed = currentTime - comboTimestamp;
        const remaining = Math.max(0, comboTimeWindow - elapsed);
        const percent = (remaining / comboTimeWindow) * 100;
        
        setTimePercentage(percent);
        
        // Ocultar cuando se agote el tiempo
        if (percent <= 0) {
          setVisible(false);
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
        }
      }, updateFrequency);
    }
    
    // Limpiar al desmontar
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [comboCount, comboTimestamp, comboTimeWindow, isPerformanceMode]);
  
  // Para debug: renderizar siempre en desarrollo
  const forceShowForDebug = process.env.NODE_ENV === 'development' && !visible && comboCount && comboCount > 0;
  
  // No renderizar si no es visible (excepto en modo debug)
  if (!visible && !forceShowForDebug) return null;
  
  // Valores seguros para el renderizado
  const safeComboCount = comboCount || 0;
  const safeMultiplier = comboMultiplier || 1.0;
  
  return (
    <div className="combo-indicator">
      <div className={`combo-orbital ${comboLevel.class} ${isPerformanceMode ? 'performance-mode' : ''}`}>
        {/* Icono como fondo dentro del círculo */}
        <div className="combo-icon">{comboLevel.icon}</div>
        
        {/* Anillo de tiempo circular en el borde exterior */}
        <div className="combo-timer-ring">
          <div 
            className="combo-timer-fill" 
            style={timerStyle}
          />
        </div>
        
        {/* Contador arriba */}
        <div className="combo-count">{safeComboCount}</div>
        
        {/* Multiplicador en el centro */}
        <div className="combo-multiplier">{formatMultiplier(safeMultiplier)}</div>
      </div>
    </div>
  );
};

export default ComboTimer; 