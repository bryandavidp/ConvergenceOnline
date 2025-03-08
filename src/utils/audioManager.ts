// src/utils/audioManager.ts
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
      audio.src = url;
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

  // Función para obtener una URL de sonido por defecto
  function getDefaultSoundUrl(name: string): string {
    const basePath = process.env.PUBLIC_URL || '';
    
    // Mapeo de nombres de sonidos a URLs
    const soundUrls: Record<string, string> = {
      click: `${basePath}/sounds/click.mp3`,
      invalidMove: `${basePath}/sounds/error.mp3`,
      success: `${basePath}/sounds/success.mp3`,
      levelComplete: `${basePath}/sounds/level_complete.mp3`,
      gameOver: `${basePath}/sounds/game_over.mp3`,
      startLevel: `${basePath}/sounds/start_level.mp3`,
      hint: `${basePath}/sounds/hint.mp3`,
      newIcon: `${basePath}/sounds/new_icon.mp3`,
      removeIcon: `${basePath}/sounds/remove_icon.mp3`,
      timeBonus: `${basePath}/sounds/time_bonus.mp3`,
      buttonClick: `${basePath}/sounds/button_click.mp3`,
      // Añadir sonidos para el sistema de combos
      comboSmall: `${basePath}/sounds/success.mp3`,      // Reutilizar el sonido de success
      comboMedium: `${basePath}/sounds/success.mp3`,     // Reutilizar el sonido de success
      comboLarge: `${basePath}/sounds/level_complete.mp3` // Reutilizar el sonido de level_complete
    };
    
    return soundUrls[name] || `${basePath}/sounds/${name}.mp3`;
  }

  // Función para cargar música
  function loadMusic(url: string) {
    try {
      music = new Audio();
      music.src = url;
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
    loadSound('gameOver', '/assets/audio/pops/gameover.wav');
    loadSound('click', '/assets/audio/pops/click.wav');

    // Sonidos específicos del juego
    loadSound('newIcon', '/assets/audio/pops/pop-up.wav');
    loadSound('removeIcon', '/assets/audio/pops/bubble-pop.wav');
    loadSound('hint', '/assets/audio/pops/hint.wav');
    loadSound('speedUp', '/assets/audio/speed-up.mp3');
    loadSound('penalty', '/assets/audio/error.mp3');
    loadSound('emptyBoard', '/assets/audio/pops/chime-up.wav');
    loadSound('levelTransition', '/assets/audio/positives/cartoon-sparkle.wav');
    
    // Mejora del sonido de convergencia encontrada para hacerlo más satisfactorio
    loadSound('convergingFound', '/assets/audio/positives/bell-up.wav');
    
    loadSound('start', '/assets/audio/positives/bleep.wav');
    loadSound('pause', '/assets/audio/pops/pause.wav');
    loadSound('resume', '/assets/audio/pops/resume.wav');
    loadSound('invalid', '/assets/audio/negatives/error.wav');
    loadSound('invalidMove', '/assets/audio/negatives/error.wav');
    loadSound('timeBonus', '/assets/audio/positives/time-bonus.wav');

    // Música de fondo
    loadMusic('/assets/audio/level-music-2.mp3');
  } catch (error) {
    console.error('Error al cargar recursos de audio', error);
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
    }
  };
}

// Exportar una instancia única
export const audioManager = createAudioManager(); 