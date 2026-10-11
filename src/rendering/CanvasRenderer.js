import { canvas, ctx } from "../core/dom.js";
import { GameComponent } from "../core/GameComponent.js";
import { JUMP_DURATION, MAGNET_RADIUS } from "../data/abilities.js";
import { PlayerAnimation } from "./PlayerAnimation.js";
import {
  COLS,
  DIRS,
  HEIGHT,
  LIFE_PELLET,
  ROWS,
  TILE,
  WIDTH,
} from "../data/config.js";

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
    const p = this.game.movement.position(this.game.player.entity),
      pose = this.playerAnimation.pose(this.game.settings.reduced),
      mouth = pose.mouth;
    const skin = this.game.player.currentPlayerSkin(),
      image =
        this.game.shop.playerSprite(skin) || this.game.assets.players[skin];
    ctx.save();
    ctx.translate(p.x, p.y);
    if (this.game.abilities.jump) {
      const scale =
        1 +
        Math.sin(
          Math.min(1, this.game.abilities.jump.elapsed / JUMP_DURATION) *
            Math.PI,
        ) *
          0.25;
      ctx.scale(scale, scale);
    }
    if (
      this.game.state === "playing" &&
      this.game.gameTime < this.game.invulnerableUntil &&
      (this.game.settings.reduced ||
        Math.floor(this.game.gameTime * 8) % 2 === 0)
    )
      ctx.globalAlpha = 0.45;
    if (image && image.complete && image.naturalWidth > 0) {
      // Poz fiziğin merkezinde kalır; kostüm ve başlık tek model olarak salınır.
      if (this.game.player.entity.dir === "left") ctx.scale(-1, 1);
      ctx.rotate(pose.angle);
      ctx.scale(pose.scaleX, pose.scaleY);
      const size = TILE * 1.18;
      ctx.drawImage(image, -size / 2, -size / 2 + pose.bob, size, size);
      ctx.restore();
      return;
    }
    // Yükleme tamamlanana kadar klasik animasyon kullanılır.
    ctx.rotate(DIRS[this.game.player.entity.dir].angle);
    ctx.scale(pose.scaleX, pose.scaleY);
    ctx.fillStyle = "#ffe15b";
    ctx.shadowColor = "#ffe15b";
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, TILE * 0.39, mouth, Math.PI * 2 - mouth);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#161424";
    ctx.beginPath();
    ctx.arc(1, -5, 1.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawGhostEffects(ghost) {
    if (!this.game.ghosts.ghostSkillsEnabled(ghost)) return;
    const p = this.game.movement.position(ghost),
      phase = this.game.ghosts.ghostCycle(ghost, ghost.id === "moss" ? 8 : 9);
    ctx.save();
    ctx.lineWidth = 1.2;
    if (ghost.id === "moss" && phase >= 3 && phase < 7) {
      ctx.strokeStyle = phase < 4 ? "#69e44855" : "#69e448b0";
      ctx.fillStyle = phase < 4 ? "#69e44808" : "#69e44818";
      ctx.setLineDash(phase < 4 ? [3, 5] : []);
      ctx.beginPath();
      ctx.arc(p.x, p.y, TILE * 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    if (ghost.id === "rush" && phase >= 6 && phase < 8.4) {
      ctx.strokeStyle = "#d49aff";
      ctx.setLineDash(this.game.ghosts.sprinting(ghost) ? [] : [2, 3]);
      ctx.beginPath();
      ctx.arc(
        p.x,
        p.y,
        15 + Math.sin(this.game.gameTime * 12) * 2,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
      if (this.game.ghosts.sprinting(ghost)) {
        const d = DIRS[ghost.dir];
        ctx.strokeStyle = "#d49aff70";
        ctx.beginPath();
        ctx.moveTo(p.x - d.x * 25, p.y - d.y * 25);
        ctx.lineTo(p.x - d.x * 10, p.y - d.y * 10);
        ctx.stroke();
      }
    }
    const hop = ghost.wallPlan || ghost.wallHop;
    if (hop) {
      ctx.strokeStyle = "#c7d2eab0";
      ctx.fillStyle = "#c7d2ea12";
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.arc(
        hop.to.x,
        hop.to.y,
        13 + Math.sin(this.game.gameTime * 12) * 2,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(hop.from.x, hop.from.y);
      ctx.lineTo(hop.to.x, hop.to.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawGhost(ghost) {
    const p = this.game.movement.position(ghost),
      frightened =
        this.game.gameTime < this.game.powerUntil &&
        this.game.gameTime >= ghost.immuneUntil;
    const blink =
      frightened &&
      !this.game.settings.reduced &&
      this.game.powerUntil - this.game.gameTime < 3 &&
      Math.floor(this.game.gameTime * 5) % 2 === 0;
    const color = frightened ? (blink ? "#e5e9ff" : "#7186f8") : ghost.color;
    this.drawGhostEffects(ghost);
    ctx.save();
    ctx.translate(p.x, p.y);
    if (this.game.gameTime < ghost.releaseAt) ctx.globalAlpha = 0.45;
    const sprite = this.game.assets.ghosts[ghost.id];
    if (!frightened && sprite) {
      const height = TILE * 1.5,
        width = (height * sprite.width) / sprite.height;
      ctx.drawImage(
        sprite,
        -width / 2,
        -height / 2 + Math.sin(this.game.gameTime * 5 + ghost.index) * 0.7,
        width,
        height,
      );
      ctx.restore();
      return;
    }
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    const r = 9,
      wave = Math.sin(this.game.gameTime * 9 + ghost.index) * 1.5;
    ctx.beginPath();
    ctx.moveTo(-r, 9);
    ctx.lineTo(-r, 0);
    ctx.arc(0, 0, r, Math.PI, 0);
    ctx.lineTo(r, 9);
    ctx.lineTo(5, 6 + wave);
    ctx.lineTo(1, 9);
    ctx.lineTo(-3, 6 - wave);
    ctx.lineTo(-6, 9);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    if (frightened) {
      ctx.fillStyle = blink ? "#5265c8" : "white";
      ctx.fillRect(-4, -1, 2, 2);
      ctx.fillRect(3, -1, 2, 2);
      ctx.strokeStyle = ctx.fillStyle;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-5, 5);
      ctx.lineTo(-3, 3);
      ctx.lineTo(-1, 5);
      ctx.lineTo(1, 3);
      ctx.lineTo(3, 5);
      ctx.lineTo(5, 3);
      ctx.stroke();
    } else {
      const d = DIRS[ghost.dir];
      for (const x of [-4, 4]) {
        ctx.fillStyle = "white";
        ctx.beginPath();
        ctx.ellipse(x, -1, 3, 3.6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#171934";
        ctx.beginPath();
        ctx.arc(x + d.x * 1.2, -1 + d.y * 1.4, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  render(time) {
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = "#070914";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.save();
    const offset = this.game.arcade.offset();
    ctx.translate(offset.x, offset.y);
    ctx.drawImage(this.game.maze.wallLayer, 0, 0, WIDTH, HEIGHT);
    for (let y = 0; y < ROWS; y++)
      for (let x = 0; x < COLS; x++) {
        const cell = this.game.maze.grid[y][x];
        if (cell !== 2 && cell !== 3) continue;
        const power = cell === 3,
          r = power ? 5 + Math.sin(time * 4) * 0.9 : 2;
        ctx.fillStyle = power ? "#ffe15b" : "#e4cbaa";
        ctx.shadowColor = "#ffe15b";
        ctx.shadowBlur = power ? 13 : 0;
        ctx.beginPath();
        ctx.arc((x + 0.5) * TILE, (y + 0.5) * TILE, r, 0, Math.PI * 2);
        ctx.fill();
        if (power) {
          ctx.strokeStyle = "#ffe15b35";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc((x + 0.5) * TILE, (y + 0.5) * TILE, 8, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    ctx.shadowBlur = 0;
    // Merkezdeki doğma noktası yolu kapatmayan küçük bir etiketle işaretlenir.
    ctx.fillStyle = "#69617f";
    ctx.font = "6px ui-monospace,monospace";
    ctx.textAlign = "center";
    if (this.game.maze.phase === "maze")
      ctx.fillText(this.game.i18n.t("ghostHQ"), 10.5 * TILE, 10.6 * TILE);
    if (this.game.maze.grid[LIFE_PELLET.row][LIFE_PELLET.col] === 4)
      this.drawLifePellet(time);
    if (this.game.gameTime < this.game.abilities.magnetUntil) {
      const p = this.game.movement.position(this.game.player.entity);
      ctx.save();
      ctx.strokeStyle = "#65dcca80";
      ctx.fillStyle = "#65dcca0b";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, MAGNET_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = "#65dcca40";
      ctx.beginPath();
      ctx.arc(
        p.x,
        p.y,
        (this.game.gameTime * 35) % MAGNET_RADIUS,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
      ctx.restore();
    }
    if (this.game.abilities.jump) {
      ctx.save();
      ctx.strokeStyle = "#a28bff66";
      ctx.lineWidth = 3;
      ctx.setLineDash([3, 5]);
      ctx.beginPath();
      ctx.moveTo(
        this.game.abilities.jump.from.x,
        this.game.abilities.jump.from.y,
      );
      ctx.quadraticCurveTo(
        (this.game.abilities.jump.from.x + this.game.abilities.jump.to.x) / 2,
        (this.game.abilities.jump.from.y + this.game.abilities.jump.to.y) / 2 -
          TILE * 1.3,
        this.game.abilities.jump.to.x,
        this.game.abilities.jump.to.y,
      );
      ctx.stroke();
      ctx.restore();
    }
    if (this.game.gameTime < this.game.abilities.boostUntil) {
      const p = this.game.movement.position(this.game.player.entity),
        d = DIRS[this.game.player.entity.dir];
      ctx.save();
      for (let i = 1; i <= 3; i++) {
        ctx.globalAlpha = 0.3 / i;
        ctx.fillStyle = "#ffa563";
        ctx.beginPath();
        ctx.arc(p.x - d.x * i * 7, p.y - d.y * i * 7, 7 - i, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    if (this.game.gameTime < this.game.abilities.shieldUntil) {
      const p = this.game.movement.position(this.game.player.entity);
      ctx.save();
      ctx.strokeStyle = "#81c9ff";
      ctx.fillStyle = "#81c9ff18";
      ctx.shadowColor = "#81c9ff";
      ctx.shadowBlur = 10;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 14 + Math.sin(this.game.gameTime * 8), 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
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
    const x = (LIFE_PELLET.col + 0.5) * TILE,
      y = (LIFE_PELLET.row + 0.5) * TILE,
      pulse = Math.sin(time * 4);
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = "#80e8b280";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, 15 + pulse * 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.scale(1 + pulse * 0.08, 1 + pulse * 0.08);
    ctx.fillStyle = "#80e8b2";
    ctx.shadowColor = "#80e8b2";
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.moveTo(0, 8);
    ctx.bezierCurveTo(-16, -2, -6, -13, 0, -6);
    ctx.bezierCurveTo(6, -13, 16, -2, 0, 8);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#a2f5d4";
    ctx.font = "bold 7px ui-monospace,monospace";
    ctx.textAlign = "center";
    ctx.fillText(this.game.i18n.t("lifeCanvas"), 0, 27);
    ctx.font = "6px ui-monospace,monospace";
    ctx.fillText(
      this.game.i18n.t(this.game.lives < 3 ? "lifeReward" : "pointsReward"),
      0,
      36,
    );
    ctx.restore();
  }
}
