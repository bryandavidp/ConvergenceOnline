import React, { useEffect, useState } from 'react';
import { POWERUP_CATALOG } from '../../../utils/powerups/catalog';
import { PowerUpType } from '../../../utils/powerups/types';

interface PowerUpItemProps {
  type: PowerUpType;
  onClick: () => void;
  size: number;
  isExpiring?: boolean;
  expiryTime?: number;
}

const PowerUpItem: React.FC<PowerUpItemProps> = ({ 
  type, 
  onClick, 
  size, 
  isExpiring = false, 
  expiryTime 
}) => {
  const powerUpDef = POWERUP_CATALOG[type];
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  
  // Animación de pulso para hacerlos destacar
  const [pulseAnimation, setPulseAnimation] = useState(false);
  
  // Efecto para animar el powerup
  useEffect(() => {
    // Animar cada 2 segundos
    const pulseInterval = setInterval(() => {
      setPulseAnimation(prev => !prev);
    }, 2000);
    
    return () => clearInterval(pulseInterval);
  }, []);
  
  // Manejo de la cuenta regresiva para powerups que expiran
  useEffect(() => {
    if (!isExpiring || !expiryTime) return;
    
    const interval = setInterval(() => {
      const now = Date.now();
      const remaining = Math.max(0, expiryTime - now);
      
      setTimeLeft(Math.ceil(remaining / 1000));
      
      if (remaining <= 0) {
        clearInterval(interval);
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [isExpiring, expiryTime]);
  
  // Determinar la opacidad basada en el tiempo restante
  const getOpacity = () => {
    if (!isExpiring || timeLeft === null) return 1;
    
    // Reducir opacidad a medida que se acerca al tiempo de expiración
    const totalDuration = POWERUP_CATALOG[type].duration || 15000;
    const msLeft = (timeLeft * 1000);
    
    return Math.max(0.5, msLeft / totalDuration);
  };
  
  // Clases para rareza
  const rarityClass = {
    'comun': 'powerup-common',
    'raro': 'powerup-rare',
    'epico': 'powerup-epic',
    'legendario': 'powerup-legendary'
  }[powerUpDef.rarity] || 'powerup-common';
  
  return (
    <div 
      className={`powerup-item ${rarityClass} ${pulseAnimation ? 'pulse' : ''}`}
      onClick={onClick}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        backgroundColor: powerUpDef.color,
        opacity: getOpacity(),
        transition: 'all 0.3s ease',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: '50%',
        boxShadow: `0 0 10px ${powerUpDef.color}`,
        cursor: 'pointer',
        fontSize: `${size / 4}px`
      }}
      title={`${powerUpDef.displayName}: ${powerUpDef.description}`}
    >
      <div className="powerup-content">
        <div className="powerup-icon">
          {/* Aquí podría ir un componente de ícono o una letra */}
          {powerUpDef.displayName.charAt(0)}
        </div>
        
        {isExpiring && timeLeft !== null && timeLeft < 10 && (
          <div className="powerup-timer">
            {timeLeft}s
          </div>
        )}
      </div>
    </div>
  );
};

export default PowerUpItem; 