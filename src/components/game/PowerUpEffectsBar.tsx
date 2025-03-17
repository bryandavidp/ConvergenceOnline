import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { POWERUP_CATALOG } from '../../utils/powerups/catalog';
import { PowerUpType } from '../../utils/powerups/types';

const PowerUpEffectsBar: React.FC = () => {
  const effects = useSelector((state: any) => state.game.powerUpEffects);
  const [activeEffects, setActiveEffects] = useState<any[]>([]);
  
  // Filtrar y formatear los efectos activos
  useEffect(() => {
    const now = Date.now();
    
    const active = effects
      .filter((effect: any) => effect.isActive && (!effect.endTime || effect.endTime > now))
      .map((effect: any) => {
        const powerUpDef = POWERUP_CATALOG[effect.type as PowerUpType];
        const remainingTime = effect.endTime ? Math.max(0, Math.floor((effect.endTime - now) / 1000)) : null;
        
        return {
          ...effect,
          name: powerUpDef?.displayName || effect.type,
          color: powerUpDef?.color || '#ccc',
          icon: powerUpDef?.icon || '',
          remainingTime
        };
      });
    
    setActiveEffects(active);
  }, [effects]);
  
  // Si no hay efectos activos, no renderizar nada
  if (activeEffects.length === 0) {
    return null;
  }
  
  return (
    <div className="powerup-effects-bar">
      <div className="effects-title">Efectos Activos:</div>
      <div className="effects-container">
        {activeEffects.map((effect, index) => (
          <div 
            key={`${effect.type}-${index}`}
            className="effect-item"
            style={{
              backgroundColor: effect.color,
              padding: '4px 8px',
              borderRadius: '4px',
              margin: '0 4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: '80px'
            }}
          >
            <span className="effect-name">{effect.name}</span>
            {effect.remainingTime !== null && (
              <span className="effect-timer" style={{ marginLeft: '4px' }}>
                {effect.remainingTime}s
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default PowerUpEffectsBar; 