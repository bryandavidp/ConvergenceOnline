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

  // Función para cargar un sonido
  function loadSound(name: string, url: string) {
    const audio = new Audio();
    audio.src = url;
    audio.preload = 'auto';
    sounds[name] = audio;
  }

  // Función para cargar música
  function loadMusic(url: string) {
    music = new Audio();
    music.src = url;
    music.loop = true;
    music.volume = musicVolume;
    music.preload = 'auto';
  }

  // Precargar sonidos básicos
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
  loadSound('convergingFound', '/assets/audio/positives/bleep.wav');
  loadSound('start', '/assets/audio/positives/bleep.wav');

  // Música de fondo
  loadMusic('/assets/audio/level-music-2.mp3');

  return {
    sounds,
    music,
    enabled,
    musicEnabled,
    volume,
    musicVolume,

    play(name: string) {
      if (!enabled || !sounds[name]) return;
      console.log('Reproduciendo sonido:', name);

      try {
        // Clonar el sonido para permitir reproducciones superpuestas
        const sound = sounds[name].cloneNode() as HTMLAudioElement;
        sound.volume = volume;
        sound.play().catch(e => console.log('Error reproduciendo sonido:', e));
      } catch (error) {
        console.error('Error al reproducir sonido:', error);
      }
    },

    startMusic() {
      if (!musicEnabled || !music) return;

      try {
        music.volume = musicVolume;
        music.currentTime = 0;
        music.play().catch(e => console.log('Error reproduciendo música:', e));
      } catch (error) {
        console.error('Error al iniciar música:', error);
      }
    },

    stopMusic() {
      if (!music) return;

      try {
        music.pause();
        music.currentTime = 0;
      } catch (error) {
        console.error('Error al detener música:', error);
      }
    },

    pauseMusic() {
      if (!music) return;

      try {
        music.pause();
      } catch (error) {
        console.error('Error al pausar música:', error);
      }
    },

    resumeMusic() {
      if (!musicEnabled || !music) return;

      try {
        music.play().catch(e => console.log('Error resumiendo música:', e));
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

      if (musicEnabled) {
        this.resumeMusic();
      } else {
        this.pauseMusic();
      }

      return musicEnabled;
    },

    setVolume(newVolume: number) {
      volume = newVolume;
      localStorage.setItem('soundVolume', newVolume.toString());
    },

    setMusicVolume(newVolume: number) {
      musicVolume = newVolume;
      localStorage.setItem('musicVolume', newVolume.toString());

      if (music) {
        music.volume = newVolume;
      }
    }
  };
}

// Exportar una instancia global para uso general
export const audioManager = createAudioManager(); 