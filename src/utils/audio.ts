// src/utils/audio.ts
// Utilidades para la reproducción de sonidos en el juego

import { resolveAssetUrl } from './assetUrl';

// Mapa de sonidos cargados
const sounds: Record<string, HTMLAudioElement> = {};

// Cargar un sonido
const loadSound = (name: string, url: string) => {
  try {
    const audio = new Audio();
    audio.src = resolveAssetUrl(url);
    audio.preload = 'auto';
    sounds[name] = audio;
  } catch (error) {
    console.error(`Error al cargar el sonido: ${name}`, error);
  }
};

// Inicializar sonidos básicos
const initSounds = () => {
  // Sonidos básicos
  loadSound('success', '/assets/audio/positives/bleep.wav');
  loadSound('error', '/assets/audio/negatives/error.wav');
  loadSound('levelComplete', '/assets/audio/level-completed.wav');
  loadSound('gameOver', '/assets/audio/pops/gameover.wav');
  loadSound('buttonClick', '/assets/audio/pops/click.wav');
  loadSound('highScore', '/assets/audio/positives/bell-up.wav');

  // Sonidos específicos del juego
  loadSound('newIcon', '/assets/audio/pops/pop-up.wav');
  loadSound('removeIcon', '/assets/audio/pops/bubble-pop.wav');
  loadSound('hint', '/assets/audio/pops/hint.wav');
  loadSound('speedUp', '/assets/audio/speed-up.mp3');
  loadSound('penalty', '/assets/audio/error.mp3');
  loadSound('emptyBoard', '/assets/audio/pops/chime-up.wav');
  loadSound('levelTransition', '/assets/audio/positives/cartoon-sparkle.wav');
  loadSound('convergingFound', '/assets/audio/positives/bell-up.wav');
  loadSound('start', '/assets/audio/positives/bleep.wav');
  loadSound('pause', '/assets/audio/pops/pause.wav');
  loadSound('resume', '/assets/audio/pops/resume.wav');
  loadSound('invalid', '/assets/audio/negatives/error.wav');
  loadSound('invalidMove', '/assets/audio/negatives/error.wav');
  loadSound('timeBonus', '/assets/audio/positives/time-bonus.wav');
};

// Inicializar sonidos
initSounds();

// Verificar si el sonido está habilitado
const isSoundEnabled = (): boolean => {
  const soundEnabled = localStorage.getItem('soundEnabled');
  return soundEnabled !== 'false'; // Por defecto habilitado
};

// Reproducir un sonido
export const playSound = (name: string) => {
  if (!isSoundEnabled() || !sounds[name]) return;
  
  try {
    // Clonar el sonido para permitir reproducciones superpuestas
    const sound = sounds[name].cloneNode() as HTMLAudioElement;
    sound.volume = 0.5; // Volumen predeterminado
    sound.play().catch(e => {
      console.warn(`Error reproduciendo sonido ${name}:`, e);
    });
  } catch (error) {
    console.error(`Error al reproducir sonido: ${name}`, error);
  }
};

// Habilitar/deshabilitar sonido
export const toggleSound = (): boolean => {
  const enabled = !isSoundEnabled();
  localStorage.setItem('soundEnabled', enabled.toString());
  return enabled;
};

// Establecer volumen global
export const setVolume = (volume: number) => {
  const normalizedVolume = Math.max(0, Math.min(1, volume));
  localStorage.setItem('soundVolume', normalizedVolume.toString());
};

export default {
  playSound,
  toggleSound,
  setVolume
}; 