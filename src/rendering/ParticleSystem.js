import { GameComponent } from "../core/GameComponent.js";

// Görsel parçacıklar ve puan yazıları.
export class ParticleSystem extends GameComponent {
  constructor(game) {
    super(game);
    this.particles = [];
    this.floatingTexts = [];
  }

  update(dt) {
    this.particles = this.particles.filter((particle) => {
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      return particle.life > 0;
    });
    this.floatingTexts = this.floatingTexts.filter((text) => {
      text.life -= dt;
      text.y -= 22 * dt;
      return text.life > 0;
    });
  }

  burst(x, y, color, count = 9) {
    if (!this.game.settings.effectsAllowed("particles")) return;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2,
        s = 20 + Math.random() * 70;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0.45,
        max: 0.45,
        color,
      });
    }
  }
}
