import { useCallback } from 'react';
import { useGameContext } from '../contexts/GameContext';

// Tipos de sonidos disponibles en el juego
type SoundType = 
  | 'uiClick' 
  | 'uiTap' 
  | 'uiSelect' 
  | 'uiOpen' 
  | 'uiClose' 
  | 'match' 
  | 'levelUp' 
  | 'gameOver' 
  | 'scorePoint';

export const useGameSound = () => {
  const { isSoundEnabled } = useGameContext();
  
  // Función para reproducir un sonido
  const playSound = useCallback((soundType: SoundType) => {
    if (!isSoundEnabled) return;
    
    // Aquí iría la lógica real para reproducir sonidos
    // Por ahora, simulemos que se reproduce el sonido
    console.log(`Playing sound: ${soundType}`);
    
    // En una implementación real, podríamos hacer algo como:
    /*
    const audio = new Audio(`/sounds/${soundType}.mp3`);
    audio.volume = 0.5; // Volumen
    audio.play().catch(e => console.error('Error playing sound:', e));
    */
  }, [isSoundEnabled]);
  
  return { playSound };
}; 