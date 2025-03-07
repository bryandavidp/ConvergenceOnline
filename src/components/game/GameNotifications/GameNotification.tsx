import React, { useEffect, useState, useRef } from 'react';
import './GameNotification.css';

export type NotificationType = 'success' | 'warning' | 'error' | 'info';

interface GameNotificationProps {
  message: string;
  type?: NotificationType;
  icon?: string;
  duration?: number;
  visible: boolean;
  onHide?: () => void;
  value?: string | number;
  animateValue?: boolean;
}

/**
 * Componente de notificación del juego
 * Muestra un mensaje en la pantalla durante el juego
 */
const GameNotification: React.FC<GameNotificationProps> = ({ 
  message,
  type = 'info',
  icon,
  duration = 3000,
  visible,
  onHide,
  value,
  animateValue = false
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [displayValue, setDisplayValue] = useState<string | number | undefined>(value);
  const prevValueRef = useRef<string | number | undefined>(undefined);
  
  // Animación del valor cuando cambia
  useEffect(() => {
    if (animateValue && value !== prevValueRef.current && typeof value === 'string' && value.startsWith('x')) {
      // Extraer el número del formato "x1.5"
      const newValue = parseFloat(value.substring(1));
      const prevValue = prevValueRef.current ? parseFloat(String(prevValueRef.current).substring(1)) : 1;
      
      if (!isNaN(newValue) && !isNaN(prevValue) && newValue !== prevValue) {
        // Animar el cambio de valor
        let startTime: number | null = null;
        const duration = 1000; // 1 segundo de animación
        
        const animateNumber = (timestamp: number) => {
          if (!startTime) startTime = timestamp;
          const elapsed = timestamp - startTime;
          const progress = Math.min(elapsed / duration, 1);
          
          // Función de easing para hacer la animación más natural
          const easeOutQuad = (t: number) => t * (2 - t);
          const easedProgress = easeOutQuad(progress);
          
          // Calcular el valor actual interpolado
          const currentValue = prevValue + (newValue - prevValue) * easedProgress;
          setDisplayValue(`x${currentValue.toFixed(1)}`);
          
          if (progress < 1) {
            requestAnimationFrame(animateNumber);
          } else {
            // Asegurarse de que el valor final sea exactamente el proporcionado
            setDisplayValue(value);
            prevValueRef.current = value;
          }
        };
        
        requestAnimationFrame(animateNumber);
      } else {
        // Si no es un número o no ha cambiado, simplemente actualizar el valor
        setDisplayValue(value);
        prevValueRef.current = value;
      }
    } else {
      // Si no se necesita animación, simplemente actualizar el valor
      setDisplayValue(value);
      prevValueRef.current = value;
    }
  }, [value, animateValue]);
  
  useEffect(() => {
    if (visible) {
      setIsVisible(true);
      setIsExiting(false);
      
      const timer = setTimeout(() => {
        setIsExiting(true);
        
        // Esperar a que termine la animación antes de ocultarlo completamente
        setTimeout(() => {
          setIsVisible(false);
          if (onHide) onHide();
        }, 300);
      }, duration);
      
      return () => clearTimeout(timer);
    }
  }, [visible, duration, onHide]);
  
  if (!isVisible && !visible) return null;
  
  // Determinar el icono según el tipo si no se proporciona uno
  const getIconForType = (): string => {
    if (icon) return icon;
    
    switch (type) {
      case 'success':
        return '✅';
      case 'warning':
        return '⚠️';
      case 'error':
        return '❌';
      case 'info':
      default:
        return 'ℹ️';
    }
  };
  
  return (
    <div className={`game-notification ${type} ${isExiting ? 'exiting' : ''}`}>
      <div className="notification-content">
        <span className="notification-icon">{getIconForType()}</span>
        <span className="notification-message">{message}</span>
        {displayValue && <span className={`notification-value ${animateValue ? 'animate-value' : ''}`}>{displayValue}</span>}
      </div>
    </div>
  );
};

export default GameNotification; 