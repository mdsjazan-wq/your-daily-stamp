/**
 * Beacon Audio Service - Web Audio API based sound notifications
 * Generates beep sounds for entry/exit events without external files
 */

// Audio settings interface
export interface BeaconAudioSettings {
  entryEnabled: boolean;
  exitEnabled: boolean;
  volume: number; // 0-100
}

// Storage key
const AUDIO_SETTINGS_KEY = 'beaconAudioSettings';

// AudioContext singleton
let audioContext: AudioContext | null = null;

/**
 * Get or create AudioContext
 */
const getAudioContext = (): AudioContext => {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  }
  return audioContext;
};

/**
 * Resume AudioContext if suspended (required for user gesture)
 */
export const resumeAudioContext = async (): Promise<void> => {
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') {
    await ctx.resume();
  }
};

/**
 * Get audio settings from localStorage
 */
export const getAudioSettings = (): BeaconAudioSettings => {
  const saved = localStorage.getItem(AUDIO_SETTINGS_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      // Return default if parsing fails
    }
  }
  return {
    entryEnabled: true,
    exitEnabled: true,
    volume: 70,
  };
};

/**
 * Save audio settings to localStorage
 */
export const saveAudioSettings = (settings: BeaconAudioSettings): void => {
  localStorage.setItem(AUDIO_SETTINGS_KEY, JSON.stringify(settings));
};

/**
 * Generate a beep sound using Web Audio API
 * @param frequency - Frequency in Hz
 * @param duration - Duration in milliseconds
 * @param volume - Volume 0-100
 * @param type - Oscillator type
 */
const playBeep = (
  frequency: number,
  duration: number,
  volume: number,
  type: OscillatorType = 'sine'
): Promise<void> => {
  return new Promise((resolve) => {
    try {
      const ctx = getAudioContext();
      
      // Create oscillator
      const oscillator = ctx.createOscillator();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);
      
      // Create gain node for volume control
      const gainNode = ctx.createGain();
      const normalizedVolume = (volume / 100) * 0.5; // Max 50% to prevent distortion
      
      // Envelope for smooth sound
      gainNode.gain.setValueAtTime(0, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(normalizedVolume, ctx.currentTime + 0.01);
      gainNode.gain.linearRampToValueAtTime(normalizedVolume, ctx.currentTime + (duration / 1000) - 0.05);
      gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + (duration / 1000));
      
      // Connect nodes
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      // Play
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + (duration / 1000));
      
      oscillator.onended = () => resolve();
    } catch (error) {
      console.error('Error playing beep:', error);
      resolve();
    }
  });
};

/**
 * Play entry sound - 2 short high beeps
 */
export const playEntrySound = async (volume?: number): Promise<boolean> => {
  const settings = getAudioSettings();
  const vol = volume ?? settings.volume;
  
  try {
    await resumeAudioContext();
    
    // Two short ascending beeps
    await playBeep(880, 150, vol, 'sine'); // A5
    await new Promise(r => setTimeout(r, 100));
    await playBeep(1108, 200, vol, 'sine'); // C#6
    
    return true;
  } catch (error) {
    console.error('Error playing entry sound:', error);
    return false;
  }
};

/**
 * Play exit sound - 1 long descending beep
 */
export const playExitSound = async (volume?: number): Promise<boolean> => {
  const settings = getAudioSettings();
  const vol = volume ?? settings.volume;
  
  try {
    await resumeAudioContext();
    
    const ctx = getAudioContext();
    const oscillator = ctx.createOscillator();
    oscillator.type = 'sine';
    
    // Descending frequency
    oscillator.frequency.setValueAtTime(880, ctx.currentTime); // A5
    oscillator.frequency.linearRampToValueAtTime(440, ctx.currentTime + 0.5); // A4
    
    const gainNode = ctx.createGain();
    const normalizedVolume = (vol / 100) * 0.5;
    
    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(normalizedVolume, ctx.currentTime + 0.02);
    gainNode.gain.linearRampToValueAtTime(normalizedVolume, ctx.currentTime + 0.4);
    gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);
    
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.5);
    
    return true;
  } catch (error) {
    console.error('Error playing exit sound:', error);
    return false;
  }
};

/**
 * Play test sound based on type
 */
export const playTestSound = async (type: 'entry' | 'exit', volume?: number): Promise<boolean> => {
  if (type === 'entry') {
    return playEntrySound(volume);
  } else {
    return playExitSound(volume);
  }
};

/**
 * Check if audio is supported
 */
export const isAudioSupported = (): boolean => {
  return typeof AudioContext !== 'undefined' || 
         typeof (window as unknown as { webkitAudioContext: unknown }).webkitAudioContext !== 'undefined';
};
