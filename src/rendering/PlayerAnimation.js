import { TILE } from "../data/config.js";

// Mesafeye bağlı uzun yürüyüş döngüsü. Başlama/durma üstel olarak yumuşar;
// faz dururken sıfırlanmaz, böylece yeniden hareket ederken model sıçramaz.
export class PlayerAnimation {
  constructor() {
    this.reset();
  }
  reset() {
    this.phase = 0;
    this.clock = 0;
    this.weight = 0;
    this.tilt = 0;
    this.lastPosition = null;
  }
  update(dt, position, entity, jumping) {
    const distance = this.lastPosition
      ? Math.hypot(
          position.x - this.lastPosition.x,
          position.y - this.lastPosition.y,
        )
      : 0;
    this.lastPosition = { ...position };
    this.clock += dt;
    const moving = entity.moving && !jumping;
    const blend = 1 - Math.exp(-dt * 10);
    this.weight += ((moving ? 1 : 0) - this.weight) * blend;
    const tilt = entity.dir === "up" ? -0.16 : entity.dir === "down" ? 0.16 : 0;
    this.tilt += (tilt - this.tilt) * (1 - Math.exp(-dt * 12));
    if (moving && distance < TILE)
      this.phase += (distance / (TILE * 2.8)) * Math.PI * 2;
    this.phase %= Math.PI * 2;
  }
  pose(reduced) {
    if (reduced) return { bob: 0, angle: 0, scaleX: 1, scaleY: 1, mouth: 0.22 };
    const stride = Math.sin(this.phase),
      lift = Math.cos(this.phase);
    return {
      bob:
        lift * 1.35 * this.weight +
        Math.sin(this.clock * 2.3) * 0.2 * (1 - this.weight),
      angle: this.tilt + stride * 0.055 * this.weight,
      scaleX: 1 + lift * 0.035 * this.weight,
      scaleY: 1 - lift * 0.035 * this.weight,
      mouth: 0.22 + (1 - lift) * 0.28 * this.weight,
    };
  }
}
