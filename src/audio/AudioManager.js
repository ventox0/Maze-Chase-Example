import { GameComponent } from "../core/GameComponent.js";

// İsteğe bağlı Web Audio sesleri; sessiz başlangıç.
export class AudioManager extends GameComponent {
  constructor(game) {
    super(game);
    this.enabled = false;
    this.context = null;
  }

  resumeAudio() {
    if (!this.enabled) return;
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    try {
      if (!this.context) this.context = new Audio();
      if (this.context.state === "suspended")
        this.context.resume().catch(() => {});
    } catch (_) {}
  }

  tone(frequency, duration = 0.07, type = "triangle", volume = 0.035) {
    if (!this.enabled || !this.context || this.context.state !== "running")
      return;
    const oscillator = this.context.createOscillator(),
      gain = this.context.createGain(),
      now = this.context.currentTime;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.connect(gain);
    gain.connect(this.context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration);
  }
}
