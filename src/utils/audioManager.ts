// src/utils/audioManager.ts
import { resolveAssetUrl } from './assetUrl';

interface AudioManagerInstance {
  sounds: Record<string, HTMLAudioElement>;
  music: HTMLAudioElement | null;
  enabled: boolean;
  musicEnabled: boolean;
  volume: number;
  musicVolume: number;
  
  play(name: string): void;
  startMusic(): void;
  stopMusic(): void;
  pauseMusic(): void;
  resumeMusic(): void;
  toggleSound(): boolean;
  toggleMusic(): boolean;
  setVolume(volume: number): void;
  setMusicVolume(volume: number): void;
  loadAll(): void;
}

/**
 * Crea una instancia del gestor de audio
 */
export function createAudioManager(): AudioManagerInstance {
  const sounds: Record<string, HTMLAudioElement> = {};
  let music: HTMLAudioElement | null = null;
  let enabled = localStorage.getItem('soundEnabled') !== 'false';
  let musicEnabled = localStorage.getItem('musicEnabled') !== 'false';
  let volume = parseFloat(localStorage.getItem('soundVolume') || '0.5');
  let musicVolume = parseFloat(localStorage.getItem('musicVolume') || '0.3');

  // Función para cargar un sonido con manejo de errores
  function loadSound(name: string, url: string) {
    try {
      const audio = new Audio();
      audio.src = resolveAssetUrl(url);
      audio.preload = 'auto';

      // Agregar un manejador de errores
      audio.onerror = () => {
        console.warn(`Error al cargar el sonido: ${name} (${url}). Usando sonido alternativo.`);
        // Si hay un error, asignar un sonido por defecto o uno vacío
        audio.src = getDefaultSoundUrl(name);
      };
      
      sounds[name] = audio;
    } catch (error) {
      console.error(`Error al inicializar el sonido: ${name}`, error);
      // Crear un audio vacío como fallback
      sounds[name] = new Audio();
    }
  }

  // Función para obtener una URL de sonido por defecto.
  // Importante: en el navegador no existe `process` (Vite solo resuelve NODE_ENV),
  // por eso usamos resolveAssetUrl(import.meta.env.BASE_URL). Además todas las rutas
  // apuntan a archivos que SÍ existen en public/assets/audio para no disparar onerror.
  function getDefaultSoundUrl(name: string): string {
    const soundUrls: Record<string, string> = {
      click: '/assets/audio/pops/click.wav',
      buttonClick: '/assets/audio/pops/click.wav',
      invalid: '/assets/audio/negatives/error.wav',
      invalidMove: '/assets/audio/negatives/error.wav',
      success: '/assets/audio/positives/bleep.wav',
      points: '/assets/audio/positives/bleep.wav',
      levelComplete: '/assets/audio/level-completed.wav',
      levelTransition: '/assets/audio/positives/cartoon-sparkle.wav',
      emptyBoard: '/assets/audio/positives/cartoon-sparkle.wav',
      gameOver: '/assets/audio/negatives/gameover.wav',
      start: '/assets/audio/positives/bleep.wav',
      startLevel: '/assets/audio/positives/bleep.wav',
      pause: '/assets/audio/pops/pause.wav',
      resume: '/assets/audio/pops/pop-up.wav',
      hint: '/assets/audio/pops/hint.wav',
      newIcon: '/assets/audio/pops/pop-up.wav',
      removeIcon: '/assets/audio/pops/bubble-pop.wav',
      speedUp: '/assets/audio/speed-up.mp3',
      penalty: '/assets/audio/error.mp3',
      timeBonus: '/assets/audio/positives/chime-up.wav',
      convergingFound: '/assets/audio/positives/chime-up.wav',
      // Sonidos del sistema de combos (reutilizan efectos existentes)
      comboSmall: '/assets/audio/positives/bleep.wav',
      comboMedium: '/assets/audio/positives/chime-up.wav',
      comboLarge: '/assets/audio/positives/cartoon-sparkle.wav'
    };

    return resolveAssetUrl(soundUrls[name] || '/assets/audio/pops/click.wav');
  }

  // Función para cargar música
  function loadMusic(url: string) {
    try {
      music = new Audio();
      music.src = resolveAssetUrl(url);
      music.loop = true;
      music.volume = musicVolume;
      music.preload = 'auto';
      
      // Agregar un manejador de errores
      music.onerror = () => {
        console.warn(`Error al cargar la música: ${url}. Usando música alternativa.`);
        // Si hay un error, asignar una música por defecto o una vacía
        if (music) {
          music.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
        }
      };
    } catch (error) {
      console.error('Error al inicializar la música', error);
      music = null;
    }
  }

  // Precargar sonidos con manejo seguro de errores
  try {
    // Sonidos básicos
    loadSound('success', '/assets/audio/positives/bleep.wav');
    loadSound('error', '/assets/audio/negatives/error.wav');
    loadSound('levelComplete', '/assets/audio/level-completed.wav');
    loadSound('gameOver', '/assets/audio/negatives/gameover.wav');
    loadSound('click', '/assets/audio/pops/click.wav');

    // Sonidos específicos del juego
    loadSound('newIcon', '/assets/audio/pops/pop-up.wav');
    loadSound('removeIcon', '/assets/audio/pops/bubble-pop.wav');
    loadSound('hint', '/assets/audio/pops/hint.wav');
    loadSound('speedUp', '/assets/audio/speed-up.mp3');
    loadSound('penalty', '/assets/audio/error.mp3');
    loadSound('emptyBoard', '/assets/audio/positives/cartoon-sparkle.wav');
    loadSound('levelTransition', '/assets/audio/positives/cartoon-sparkle.wav');
    
    // Sonido de convergencia encontrada (archivo existente)
    loadSound('convergingFound', '/assets/audio/positives/chime-up.wav');

    loadSound('start', '/assets/audio/positives/bleep.wav');
    loadSound('pause', '/assets/audio/pops/pause.wav');
    loadSound('resume', '/assets/audio/pops/pop-up.wav');
    loadSound('invalid', '/assets/audio/negatives/error.wav');
    loadSound('invalidMove', '/assets/audio/negatives/error.wav');
    loadSound('timeBonus', '/assets/audio/positives/chime-up.wav');

    // Puntos y combos (antes no se precargaban y disparaban el fallback en cada jugada)
    loadSound('points', '/assets/audio/positives/bleep.wav');
    loadSound('comboSmall', '/assets/audio/positives/bleep.wav');
    loadSound('comboMedium', '/assets/audio/positives/chime-up.wav');
    loadSound('comboLarge', '/assets/audio/positives/cartoon-sparkle.wav');

    // Música de fondo
    loadMusic('/assets/audio/level-music-2.mp3');
  } catch (error) {
    console.error('Error al cargar recursos de audio', error);
  }

  // Función para cargar todos los sonidos del juego
  function loadAllSounds() {
    // Efectos de interfaz
    loadSound('click', '/sounds/ui/click.mp3');
    loadSound('start', '/sounds/ui/start.mp3');
    loadSound('pause', '/sounds/ui/pause.mp3');
    loadSound('resume', '/sounds/ui/resume.mp3');
    
    // Efectos de juego
    loadSound('points', '/sounds/game/points.mp3');
    loadSound('gameOver', '/sounds/game/game_over.mp3');
    loadSound('levelComplete', '/sounds/game/level_complete.mp3');
    loadSound('startLevel', '/sounds/game/start_level.mp3');
    loadSound('removeIcon', '/sounds/game/remove_icon.mp3');
    loadSound('newIcon', '/sounds/game/new_icon.mp3');
    loadSound('invalidMove', '/sounds/game/invalid_move.mp3');
    loadSound('hint', '/sounds/game/hint.mp3');
    loadSound('timeBonus', '/sounds/game/time_bonus.mp3');
    loadSound('speedUp', '/sounds/game/speed_up.mp3');
    loadSound('convergingFound', '/sounds/game/converging_found.mp3');
    
    // Combos
    loadSound('comboSmall', '/sounds/game/combo_small.mp3');
    loadSound('comboMedium', '/sounds/game/combo_medium.mp3');
    loadSound('comboLarge', '/sounds/game/combo_large.mp3');
    
    // Cargar música de fondo
    loadMusic('/sounds/music/game_music.mp3');
  }

  return {
    sounds,
    music,
    enabled,
    musicEnabled,
    volume,
    musicVolume,

    play(name: string) {
      if (!enabled) return;
      
      try {
        // Verificar si el sonido existe
        if (!sounds[name]) {
          console.warn(`Sonido no encontrado: ${name}, creando uno temporal`);
          loadSound(name, getDefaultSoundUrl(name));
        }
        
        // Clonar el sonido para permitir reproducciones superpuestas
        const sound = sounds[name].cloneNode() as HTMLAudioElement;
        sound.volume = volume;
        sound.play().catch(e => {
          console.warn(`Error reproduciendo sonido ${name}:`, e);
          // No hacer nada más, simplemente registrar el error
        });
      } catch (error) {
        console.error(`Error al reproducir sonido: ${name}`, error);
      }
    },

    startMusic() {
      if (!musicEnabled || !music) return;

      try {
        music.volume = musicVolume;
        music.currentTime = 0;
        music.play().catch(e => {
          console.warn('Error reproduciendo música:', e);
        });
      } catch (error) {
        console.error('Error al iniciar música:', error);
      }
    },

    stopMusic() {
      try {
        if (music) {
          music.pause();
          music.currentTime = 0;
        }
      } catch (error) {
        console.error('Error al detener música:', error);
      }
    },

    pauseMusic() {
      try {
        if (music) {
          music.pause();
        }
      } catch (error) {
        console.error('Error al pausar música:', error);
      }
    },

    resumeMusic() {
      if (!musicEnabled || !music) return;

      try {
        music.play().catch(e => console.warn('Error al reanudar música:', e));
      } catch (error) {
        console.error('Error al reanudar música:', error);
      }
    },

    toggleSound() {
      enabled = !enabled;
      localStorage.setItem('soundEnabled', enabled.toString());
      return enabled;
    },

    toggleMusic() {
      musicEnabled = !musicEnabled;
      localStorage.setItem('musicEnabled', musicEnabled.toString());

      if (musicEnabled && music) {
        music.play().catch(e => console.warn('Error al activar música:', e));
      } else if (music) {
        music.pause();
      }

      return musicEnabled;
    },

    setVolume(newVolume: number) {
      volume = Math.max(0, Math.min(1, newVolume));
      localStorage.setItem('soundVolume', volume.toString());
    },

    setMusicVolume(newVolume: number) {
      musicVolume = Math.max(0, Math.min(1, newVolume));
      localStorage.setItem('musicVolume', musicVolume.toString());

      if (music) {
        music.volume = musicVolume;
      }
    },

    // Implementación del método loadAll
    loadAll() {
      console.log('Cargando todos los sonidos del juego...');
      loadAllSounds();
    }
  };
}

// Exportar una instancia única
export const audioManager = createAudioManager(); 