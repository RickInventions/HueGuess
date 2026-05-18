class SoundService {
  private audioContext: AudioContext | null = null;
  private isMuted: boolean = false;
  private volume: number = 0.5;
  private initialized: boolean = false;
  
  constructor() {
    // Load preferences from localStorage
    const savedMuted = localStorage.getItem('sound_muted');
    const savedVolume = localStorage.getItem('sound_volume');
    
    this.isMuted = savedMuted === 'true';
    this.volume = savedVolume ? parseFloat(savedVolume) : 0.5;
  }
  
  private async initAudioContext() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
    return this.audioContext;
  }
  
  private playTone(frequency: number, duration: number, type: OscillatorType = 'sine') {
    if (this.isMuted) return;
    
    this.initAudioContext().then(ctx => {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      oscillator.type = type;
      oscillator.frequency.value = frequency;
      gainNode.gain.value = this.volume;
      
      oscillator.start();
      gainNode.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + duration);
      oscillator.stop(ctx.currentTime + duration);
    }).catch(console.error);
  }
  
  // Initialize on user interaction (required by browsers)
  async initialize() {
    if (this.initialized) return;
    await this.initAudioContext();
    this.initialized = true;
  }
  
  // Countdown beep (3, 2, 1)
  playCountdownBeep() {
    this.playTone(880, 0.15, 'sine');
  }
  
  // Round start chime
  playRoundStart() {
    this.playTone(523.25, 0.3, 'sine'); // C5
    setTimeout(() => this.playTone(659.25, 0.3, 'sine'), 150); // E5
    setTimeout(() => this.playTone(783.99, 0.5, 'sine'), 300); // G5
  }
  
  // Memorization end soft transition
  playMemorizationEnd() {
    this.playTone(440, 0.2, 'sine');
    setTimeout(() => this.playTone(349.23, 0.3, 'sine'), 100);
  }
  
  // Final 10s ticking
  playTick() {
    this.playTone(440, 0.05, 'sine');
  }
  
  // Final 5s urgent tick
  playUrgentTick() {
    this.playTone(880, 0.1, 'sine');
  }
  
  // Round expired buzz
  playExpired() {
    this.playTone(220, 0.5, 'sawtooth');
  }
  
  // Submission confirm ding
  playSubmitDing() {
    this.playTone(880, 0.1, 'sine');
    setTimeout(() => this.playTone(1046.5, 0.15, 'sine'), 50);
  }
  
  // Achievement unlocked fanfare
  playAchievementUnlock() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((note, i) => {
      setTimeout(() => this.playTone(note, 0.2, 'sine'), i * 100);
    });
  }
  
  // Negative score descending tone
  playNegativeTone() {
    this.playTone(440, 0.3, 'sawtooth');
    setTimeout(() => this.playTone(349.23, 0.3, 'sawtooth'), 200);
    setTimeout(() => this.playTone(261.63, 0.4, 'sawtooth'), 400);
  }
  
  // Toggle mute
  toggleMute() {
    this.isMuted = !this.isMuted;
    localStorage.setItem('sound_muted', String(this.isMuted));
    return this.isMuted;
  }
  
  // Set volume
  setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
    localStorage.setItem('sound_volume', String(this.volume));
  }
  
  // Get mute state
  getMuted() {
    return this.isMuted;
  }
  
  // Get volume
  getVolume() {
    return this.volume;
  }
}

export const soundService = new SoundService();