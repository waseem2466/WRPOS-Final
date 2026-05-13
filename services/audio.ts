/**
 * WR POS - Tactical Audio Feedback Service
 * Uses Web Audio API for high-performance, dependency-free sound synthesis.
 */

class AudioService {
  private ctx: AudioContext | null = null;

  private init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }

  /**
   * Classic POS Scanner Beep
   */
  public playBeep() {
    this.init();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, this.ctx.currentTime); // A5 note

    gain.gain.setValueAtTime(0, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.1, this.ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.1);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  }

  /**
   * Cash Register / Completion "Cha-ching" 
   */
  public playSuccess() {
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    
    // Low frequency thud
    this.playTone(150, 0.1, 0.2, 'square');
    
    // High frequency shimmering coins
    setTimeout(() => this.playTone(1200, 0.1, 0.05, 'sine'), 50);
    setTimeout(() => this.playTone(1500, 0.1, 0.05, 'sine'), 100);
    setTimeout(() => this.playTone(1800, 0.1, 0.1, 'sine'), 150);
  }

  /**
   * Soft Notification Chime (WhatsApp / AI)
   */
  public playNotification() {
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    this.playTone(660, 0.1, 0.1, 'sine');
    setTimeout(() => this.playTone(880, 0.2, 0.1, 'sine'), 100);
  }

  private playTone(freq: number, duration: number, volume: number, type: OscillatorType) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    
    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }
}

export const audioService = new AudioService();
