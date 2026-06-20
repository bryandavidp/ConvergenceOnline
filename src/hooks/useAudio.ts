import { useCallback, useEffect, useRef } from 'react';
import { resolveAssetUrl } from '../utils/assetUrl';

interface Sound {
  [key: string]: HTMLAudioElement;
}

export const useAudio = () => {
  const sounds = useRef<Sound>({});
  const musicRef = useRef<HTMLAudioElement | null>(null);
  const enabledRef = useRef<boolean>(true);
  const musicEnabledRef = useRef<boolean>(true);

  // Inicializar sonidos
  useEffect(() => {
    // Cargar sonidos básicos
    loadSound('click', '/assets/audio/pops/click.wav');
    loadSound('success', '/assets/audio/positives/bleep.wav');
    loadSound('error', '/assets/audio/negatives/error.wav');
    // Añadir más sonidos según sea necesario
    
    // Cargar música
    loadMusic('/assets/audio/level-music-2.mp3');
    
    // Cargar preferencias guardadas
    const soundEnabled = localStorage.getItem('soundEnabled');
    const musicEnabled = localStorage.getItem('musicEnabled');
    
    if (soundEnabled !== null) enabledRef.current = soundEnabled === 'true';
    if (musicEnabled !== null) musicEnabledRef.current = musicEnabled === 'true';
    
    return () => {
      // Limpiar recursos de audio
      Object.values(sounds.current).forEach(sound => {
        sound.pause();
        sound.src = '';
      });
      
      if (musicRef.current) {
        musicRef.current.pause();
        musicRef.current.src = '';
      }
    };
  }, []);

  const loadSound = useCallback((name: string, url: string) => {
    const audio = new Audio();
    audio.src = resolveAssetUrl(url);
    audio.preload = 'auto';
    sounds.current[name] = audio;
  }, []);

  const loadMusic = useCallback((url: string) => {
    const audio = new Audio();
    audio.src = resolveAssetUrl(url);
    audio.loop = true;
    audio.volume = 0.3;
    audio.preload = 'auto';
    musicRef.current = audio;
  }, []);

  const playSound = useCallback((name: string) => {
    if (!enabledRef.current || !sounds.current[name]) return;
    
    // Clonar el sonido para permitir reproducciones superpuestas
    const sound = sounds.current[name].cloneNode() as HTMLAudioElement;
    sound.volume = 0.5;
    sound.play().catch(e => console.error('Error reproduciendo sonido:', e));
  }, []);

  const startMusic = useCallback(() => {
    if (!musicEnabledRef.current || !musicRef.current) return;
    
    musicRef.current.currentTime = 0;
    musicRef.current.play().catch(e => console.error('Error reproduciendo música:', e));
  }, []);

  const stopMusic = useCallback(() => {
    if (!musicRef.current) return;
    
    musicRef.current.pause();
    musicRef.current.currentTime = 0;
  }, []);

  const toggleSound = useCallback(() => {
    enabledRef.current = !enabledRef.current;
    localStorage.setItem('soundEnabled', String(enabledRef.current));
    return enabledRef.current;
  }, []);

  const toggleMusic = useCallback(() => {
    musicEnabledRef.current = !musicEnabledRef.current;
    localStorage.setItem('musicEnabled', String(musicEnabledRef.current));
    
    if (musicEnabledRef.current && musicRef.current) {
      musicRef.current.play().catch(e => console.error('Error resumiendo música:', e));
    } else if (musicRef.current) {
      musicRef.current.pause();
    }
    
    return musicEnabledRef.current;
  }, []);

  return {
    playSound,
    startMusic,
    stopMusic,
    toggleSound,
    toggleMusic,
    isSoundEnabled: enabledRef.current,
    isMusicEnabled: musicEnabledRef.current
  };
};
