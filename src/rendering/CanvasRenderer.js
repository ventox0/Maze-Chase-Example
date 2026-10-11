import { canvas, ctx } from "../core/dom.js";
import { GameComponent } from "../core/GameComponent.js";
import {
  drawPlayer,
  drawGhostEffects,
  drawGhost,
  drawPellets,
  drawAbilities,
  drawLifePellet,
} from "./ArcadeDrawing.js";
import { PlayerAnimation } from "./PlayerAnimation.js";
import { HEIGHT, LIFE_PELLET, TILE, WIDTH } from "../data/config.js";

// Canvas boyutlandırma ve tüm oyun çizimleri.
export class CanvasRenderer extends GameComponent {
  constructor(game) {
    super(game);
    this.playerAnimation = new PlayerAnimation();
  }

  configureCanvas() {
    const ratio = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.round(WIDTH * ratio);
    canvas.height = Math.round(HEIGHT * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  drawPlayer() {
    const game = this.game,
      player = game.player.entity,
      skin = game.player.currentPlayerSkin();
    const alpha =
      game.state === "playing" &&
      game.gameTime < game.invulnerableUntil &&
      (game.settings.reduced || Math.floor(game.gameTime * 8) % 2 === 0)
        ? 0.45
        : 1;
    drawPlayer(
      ctx,
      game.movement.position(player),
      this.playerAnimation.pose(game.settings.reduced),
      game.shop.playerSprite(skin) || game.assets.players[skin],
      player.dir,
      game.abilities.jump,
      alpha,
    );
  }
  drawGhostEffects(ghost) {
    const game = this.game;
    drawGhostEffects(
      ctx,
      ghost,
      game.movement.position(ghost),
      game.gameTime,
      game.ghosts.ghostSkillsEnabled(ghost),
      game.ghosts.ghostCycle(ghost, ghost.id === "moss" ? 8 : 9),
      game.ghosts.sprinting(ghost),
      ghost.wallPlan || ghost.wallHop,
    );
  }
  drawGhost(ghost) {
    const game = this.game,
      frightened =
        game.gameTime < game.powerUntil && game.gameTime >= ghost.immuneUntil;
    const blink =
      frightened &&
      !game.settings.reduced &&
      game.powerUntil - game.gameTime < 3 &&
      Math.floor(game.gameTime * 5) % 2 === 0;
    this.drawGhostEffects(ghost);
    drawGhost(
      ctx,
      ghost,
      game.movement.position(ghost),
      game.assets.ghosts[ghost.id],
      game.gameTime,
      frightened,
      blink,
      game.gameTime < ghost.releaseAt,
    );
  }

  render(time) {
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = "#070914";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.save();
    const offset = this.game.arcade.offset();
    ctx.translate(offset.x, offset.y);
    ctx.drawImage(this.game.maze.wallLayer, 0, 0, WIDTH, HEIGHT);
    drawPellets(ctx, this.game.maze.grid, time);
    // Merkezdeki doğma noktası yolu kapatmayan küçük bir etiketle işaretlenir.
    ctx.fillStyle = "#69617f";
    ctx.font = "6px ui-monospace,monospace";
    ctx.textAlign = "center";
    if (this.game.maze.phase === "maze")
      ctx.fillText(this.game.i18n.t("ghostHQ"), 10.5 * TILE, 10.6 * TILE);
    if (this.game.maze.grid[LIFE_PELLET.row][LIFE_PELLET.col] === 4)
      this.drawLifePellet(time);
    drawAbilities(
      ctx,
      this.game.movement.position(this.game.player.entity),
      this.game.player.entity.dir,
      {
        jump: this.game.abilities.jump,
        magnet: this.game.gameTime < this.game.abilities.magnetUntil,
        boost: this.game.gameTime < this.game.abilities.boostUntil,
        shield: this.game.gameTime < this.game.abilities.shieldUntil,
      },
      this.game.gameTime,
    );
    this.game.ghosts.entities.forEach(this.drawGhost);
    this.drawPlayer();
    for (const t of this.game.abilities.pelletTrails) {
      ctx.globalAlpha = Math.min(1, t.life / 0.15);
      ctx.fillStyle = "#ffe15b";
      ctx.beginPath();
      ctx.arc(t.x, t.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const p of this.game.settings.effectsAllowed("particles")
      ? this.game.effects.particles
      : []) {
      ctx.globalAlpha = p.life / p.max;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
    }
    ctx.globalAlpha = 1;
    for (const f of this.game.effects.floatingTexts) {
      ctx.globalAlpha = f.life;
      ctx.fillStyle = "#ffe15b";
      ctx.font = "bold 12px ui-monospace,monospace";
      ctx.fillText(f.text, f.x, f.y - 12);
    }
    ctx.globalAlpha = 1;
    if (this.game.cutscenes.current) this.game.cutscenes.drawCutscene();
    ctx.restore();
    this.game.arcade.drawFeedback(ctx);
  }

  drawLifePellet(time) {
    drawLifePellet(
      ctx,
      time,
      this.game.i18n.t("lifeCanvas"),
      this.game.i18n.t(this.game.lives < 3 ? "lifeReward" : "pointsReward"),
    );
  }
}
