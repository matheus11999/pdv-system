import { supabase } from '../lib/supabase';

let soundsEnabled = true; // Default value

// Load sound settings on module initialization
const loadSoundSettings = async () => {
  try {
    const { data } = await supabase
      .from('store_settings')
      .select('sound_effects_enabled')
      .single();
    
    if (data) {
      soundsEnabled = data.sound_effects_enabled !== false;
    }
  } catch (error) {
    console.warn('Could not load sound settings:', error);
  }
};

// Initialize sound settings
loadSoundSettings();

export const playSound = (soundPath: string, volume: number = 0.5): void => {
  if (!soundsEnabled) return;
  
  try {
    const audio = new Audio(soundPath);
    audio.volume = volume;
    audio.play().catch(error => {
      console.warn('Erro ao reproduzir som:', error);
    });
  } catch (error) {
    console.warn('Erro ao carregar arquivo de som:', error);
  }
};

export const playScanSound = (): void => {
  playSound('/scan-sound.mp3', 0.3);
};

export const playSuccessSound = (): void => {
  playSound('/sucess-sale.mp3', 0.5);
};

export const setSoundEnabled = (enabled: boolean): void => {
  soundsEnabled = enabled;
};