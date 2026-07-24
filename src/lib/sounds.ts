
/**
 * Sound utility for Entertainment Dashboard
 */

const SOUND_URLS = {
  click: 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3',
  success: 'https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3',
  wrong: 'https://assets.mixkit.co/active_storage/sfx/2959/2959-preview.mp3',
  win: 'https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3',
  levelUp: 'https://assets.mixkit.co/active_storage/sfx/2018/2018-preview.mp3',
  pop: 'https://assets.mixkit.co/active_storage/sfx/2572/2572-preview.mp3'
};

class SoundManager {
  private static instance: SoundManager;
  private audioCache: Map<string, HTMLAudioElement> = new Map();
  private backgroundMusic: HTMLAudioElement | null = null;
  private musicUrl = 'https://assets.mixkit.co/active_storage/sfx/123/123-preview.mp3'; // Placeholder for meditation music

  private constructor() {}

  public static getInstance(): SoundManager {
    if (!SoundManager.instance) {
      SoundManager.instance = new SoundManager();
    }
    return SoundManager.instance;
  }

  public play(soundName: keyof typeof SOUND_URLS) {
    const isEnabled = localStorage.getItem('entertainment_sound_enabled') !== 'false';
    if (!isEnabled) return;

    try {
      let audio = this.audioCache.get(soundName);
      if (!audio) {
        audio = new Audio(SOUND_URLS[soundName]);
        this.audioCache.set(soundName, audio);
      }
      
      // Reset and play
      audio.currentTime = 0;
      audio.play().catch(e => console.warn('Audio play failed:', e));
    } catch (error) {
      console.warn('Sound playback error:', error);
    }
  }

  public toggleMusic(enabled: boolean) {
    if (enabled) {
      if (!this.backgroundMusic) {
        this.backgroundMusic = new Audio('https://www.soundhelix.com/examples/mp3/SoundHelix-Song-17.mp3'); // Smooth background melody
        this.backgroundMusic.loop = true;
        this.backgroundMusic.volume = 0.3;
      }
      this.backgroundMusic.play().catch(e => console.warn('Music play failed:', e));
    } else {
      if (this.backgroundMusic) {
        this.backgroundMusic.pause();
      }
    }
  }
}

export const playSound = (soundName: keyof typeof SOUND_URLS) => {
  SoundManager.getInstance().play(soundName);
};

export const toggleBackgroundMusic = (enabled: boolean) => {
  SoundManager.getInstance().toggleMusic(enabled);
};
