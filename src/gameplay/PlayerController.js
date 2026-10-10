import { GameComponent } from "../core/GameComponent.js";
import { BOOST_MULTIPLIER } from "../data/abilities.js";
import { OPPOSITE, TILE } from "../data/config.js";

// Oyuncunun yön tamponu, hareket kararı ve görünümü.
export class PlayerController extends GameComponent {
  constructor(game) {
    super(game);
    this.entity = null;
  }

  update(dt) {
    const game = this.game;
    const speed =
      (4.65 + Math.min(game.level - 1, 8) * 0.12) *
      TILE *
      (game.gameTime < game.abilities.boostUntil ? BOOST_MULTIPLIER : 1) *
      (game.ghosts.playerSlowed() ? 0.8 : 1);
    if (game.abilities.jump) game.abilities.advanceJump(dt);
    else {
      this.eatPellet();
      game.movement.move(
        this.entity,
        speed * dt,
        this.choosePlayerDirection,
        this.eatPellet,
      );
    }
  }

  setDirection(dir) {
    this.entity.next = dir;
    if (this.game.state !== "playing" || this.game.abilities.jump) return;
    if (this.entity.progress > 0 && dir === OPPOSITE[this.entity.dir])
      this.game.movement.reverse(this.entity);
  }

  choosePlayerDirection() {
    if (
      this.game.abilities.pendingJumpUntil > this.game.gameTime &&
      this.game.gameTime >= this.game.abilities.jumpReadyAt &&
      this.game.abilities.attemptJump()
    )
      return null;
    if (this.game.movement.canGo(this.entity, this.entity.next))
      this.entity.dir = this.entity.next;
    return this.game.movement.canGo(this.entity, this.entity.dir)
      ? this.entity.dir
      : null;
  }

  eatPellet() {
    this.game.maze.collectPellet(this.entity.col, this.entity.row);
  }

  currentPlayerSkin() {
    if (this.game.gameTime < this.game.abilities.shieldUntil) return "shield";
    if (this.game.gameTime < this.game.powerUntil) return "power";
    if (this.game.gameTime < this.game.abilities.magnetUntil) return "magnet";
    if (this.game.gameTime < this.game.abilities.boostUntil) return "boost";
    return "normal";
  }
}
