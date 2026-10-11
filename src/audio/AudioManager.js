import { GameComponent } from "../core/GameComponent.js";
import { SOUND_CUES } from "../data/audio.js";

// Ses bağlamı yalnızca kullanıcı etkileşiminden sonra açılır. Harici ses dosyası yoktur.
export class AudioManager extends GameComponent {
  constructor(game) {
    super(game);
    this.enabled = false;
    this.context = null;
    this.master = null;
    this.voices = new Set();
    this.lastPelletAt = -Infinity;
  }
  resumeAudio() {
    if (!this.enabled) return;
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    try {
      if (!this.context) {
        this.context = new Audio();
        this.master = this.context.createGain();
        this.master.connect(this.context.destination);
      }
      this.syncVolume();
      if (this.context.state === "suspended")
        this.context.resume().catch(() => {});
    } catch (_) {}
  }
  syncVolume() {
    if (!this.master) return;
    const volume = this.enabled ? this.game.settings.values.volume : 0;
    this.master.gain.setTargetAtTime(volume, this.context.currentTime, 0.02);
  }
  stopAll() {
    for (const voice of this.voices) {
      try {
        voice.stop();
      } catch (_) {}
    }
    this.voices.clear();
  }
  tone(
    frequency,
    duration = 0.07,
    type = "triangle",
    volume = 0.035,
    delay = 0,
  ) {
    if (
      !this.enabled ||
      !this.context ||
      this.context.state !== "running" ||
      this.game.settings.values.volume === 0 ||
      this.voices.size >= 32
    )
      return;
    try {
      const oscillator = this.context.createOscillator(),
        gain = this.context.createGain();
      const start = this.context.currentTime + delay;
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(
        Math.max(0.0001, Math.min(0.08, volume)),
        start + 0.005,
      );
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      oscillator.connect(gain);
      gain.connect(this.master);
      this.voices.add(oscillator);
      oscillator.onended = () => {
        this.voices.delete(oscillator);
        oscillator.disconnect();
        gain.disconnect();
      };
      oscillator.start(start);
      oscillator.stop(start + duration + 0.01);
    } catch (_) {}
  }
  play(name) {
    if (!this.enabled || !this.context || this.context.state !== "running")
      return;
    if (name === "pellet") {
      if (this.context.currentTime - this.lastPelletAt < 0.045) return;
      this.lastPelletAt = this.context.currentTime;
      this.tone(
        this.game.maze.pellets % 2 ? 440 : 554,
        0.04,
        "triangle",
        0.022,
      );
      return;
    }
    for (const [frequency, duration, delay, type = "triangle"] of SOUND_CUES[
      name
    ] || [])
      this.tone(
        frequency,
        duration,
        type,
        name === "hurt" ? 0.045 : 0.035,
        delay,
      );
  }
}
