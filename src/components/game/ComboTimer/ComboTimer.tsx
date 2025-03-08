import React, { useEffect, useState, useRef } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../../store';
import { audioManager } from '../../../utils/audioManager';
import './ComboTimer.css';

// Importación condicional del CSS según el modo de rendimiento
// Se cargará automáticamente cuando se necesite
import './ComboTimer-lite.css';

/**
 * Componente que muestra el tiempo restante del combo actual
 * con una animación llamativa y divertida
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
  
  // Detectar si estamos en modo de rendimiento bajo
  const isPerformanceMode = document.documentElement.classList.contains('performance-mode');
  
  // Determinar la clase del combo según el multiplicador
  let comboClass = 'combo-basic';
  if (comboMultiplier >= 5.0) comboClass = 'combo-legendary';
  else if (comboMultiplier >= 3.0) comboClass = 'combo-epic';
  else if (comboMultiplier >= 2.0) comboClass = 'combo-rare';
  else if (comboMultiplier >= 1.5) comboClass = 'combo-uncommon';
  
  // Texto para el indicador según el nivel del combo
  const getComboText = () => {
    if (comboMultiplier >= 5.0) return '¡LEGENDARIO!';
    if (comboMultiplier >= 3.0) return '¡ÉPICO!';
    if (comboMultiplier >= 2.0) return '¡RARO!';
    if (comboMultiplier >= 1.5) return '¡COMBO!';
    return 'COMBO';
  };
  
  // Seleccionar el icono según el nivel del combo
  const getComboIcon = () => {
    if (comboMultiplier >= 5.0) return '✨';
    if (comboMultiplier >= 3.0) return '🔥';
    if (comboMultiplier >= 2.0) return '💫';
    if (comboMultiplier >= 1.5) return '⚡';
    return '🔥';
  };
  
  // Ajustar el sonido cuando aparece el temporizador de combo
  useEffect(() => {
    if (visible && comboCount >= 3) {
      // Reproducir un sonido cuando aparece el timer
      if (comboMultiplier >= 5.0) {
        audioManager.play('comboLarge');
      } else if (comboMultiplier >= 3.0) {
        audioManager.play('comboMedium');
      } else if (comboMultiplier >= 1.5) {
        audioManager.play('comboSmall');
      }
    }
  }, [visible, comboCount, comboMultiplier]);
  
  // Mostrar/ocultar el timer según el estado del combo
  useEffect(() => {
    // Limpiar intervalo existente
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    // Solo mostrar si hay un combo activo (3 o más)
    if (comboCount >= 3 && comboTimestamp > 0) {
      setVisible(true);
      setTimePercentage(100); // Iniciar al 100%
      
      // Configurar la frecuencia de actualización según modo de rendimiento
      const updateFrequency = isPerformanceMode ? 100 : 33; // 10fps o 30fps
      
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
    } else {
      // Ocultar si no hay combo activo
      setVisible(false);
    }
    
    // Limpiar al desmontar
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [comboCount, comboTimestamp, comboTimeWindow, isPerformanceMode]);
  
  // No renderizar si no es visible
  if (!visible) return null;
  
  return (
    <div className={`combo-timer-container ${comboClass} ${isPerformanceMode ? 'performance-mode' : ''}`}>
      <div className="combo-timer-icon">
        {getComboIcon()}
      </div>
      
      <div className="combo-timer-info">
        <div className="combo-timer-text">
          {getComboText()} <span className="combo-timer-multiplier">x{comboMultiplier.toFixed(1)}</span>
        </div>
        
        <div className="combo-timer-bar-container">
          <div 
            className="combo-timer-bar" 
            style={{ width: `${timePercentage}%` }}
          />
        </div>
      </div>
      
      <div className="combo-timer-counter">
        x{comboCount}
      </div>
    </div>
  );
};

export default ComboTimer; 