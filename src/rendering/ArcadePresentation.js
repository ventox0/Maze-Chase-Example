import { $, canvas } from "../core/dom.js";
import { GameComponent } from "../core/GameComponent.js";
import { HEIGHT, POWER_DURATION, WIDTH } from "../data/config.js";

// Sunum zamanı oyun fiziğinden ayrıdır. Duraklatma ve açık menüler süreleri dondurur.
export class ArcadePresentation extends GameComponent {
  constructor(game) {
    super(game);
    this.combo = 0;
    this.transition = null;
    this.hit = null;
  }
  reset() {
    this.combo = 0;
    this.transition = null;
    this.hit = null;
  }
  beginPower() {
    this.combo = 0;
  }
  ghostCaught() {
    this.combo++;
    this.game.ui.announce("arcade.comboAnnouncement", {
      count: this.combo,
      points: this.game.i18n.formatScore(this.combo * 200),
    });
  }
  impact(kind) {
    this.hit = { kind, life: 0.32 };
  }
  beginTransition() {
    if (!this.game.settings.values.transitions) return;
    this.transition = {
      elapsed: 0,
      duration: this.game.settings.reduced ? 0.5 : 1.15,
    };
    this.game.changeState("transition");
    this.game.audio.play("level");
  }
  finishTransition() {
    if (!this.transition) return;
    this.transition = null;
    // Ayarlar açıkken dünyayı devam ettirme; kapanınca eski durum geri yüklenir.
    if (this.game.state === "transition") this.game.changeState("playing");
    this.game.lastFrame = 0;
    this.game.accumulator = 0;
    this.renderUI();
    if (!this.game.settings.dialog.open && !this.game.customization.dialog.open)
      canvas.focus({ preventScroll: true });
  }
  update(dt) {
    if (
      !["playing", "cutscene", "transition", "dying"].includes(this.game.state)
    )
      return;
    if (this.hit) {
      this.hit.life -= dt;
      if (this.hit.life <= 0) this.hit = null;
    }
    if (this.game.gameTime >= this.game.powerUntil) this.combo = 0;
    if (this.game.state === "transition" && this.transition) {
      this.transition.elapsed += dt;
      if (this.transition.elapsed >= this.transition.duration - 1e-9)
        this.finishTransition();
    }
  }
  offset() {
    if (!this.hit || !this.game.settings.effectsAllowed("shake"))
      return { x: 0, y: 0 };
    const strength =
      ((this.hit.kind === "hurt" ? 4 : 2.5) * this.hit.life) / 0.32;
    return {
      x: Math.sin(this.hit.life * 110) * strength,
      y: Math.cos(this.hit.life * 85) * strength * 0.5,
    };
  }
  drawFeedback(ctx) {
    if (!this.hit || this.game.settings.reduced) return;
    ctx.save();
    ctx.globalAlpha = (this.hit.life / 0.32) * 0.32;
    ctx.strokeStyle = this.hit.kind === "hurt" ? "#ff657b" : "#ffe15b";
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, WIDTH - 6, HEIGHT - 6);
    ctx.restore();
  }
  renderUI() {
    const active = this.combo > 0 && this.game.gameTime < this.game.powerUntil;
    $("combo-display").hidden =
      !active || !["playing", "cutscene", "paused"].includes(this.game.state);
    $("combo-count").textContent = this.game.i18n.t("arcade.combo", {
      count: this.combo,
    });
    $("combo-points").textContent = this.game.i18n.t("arcade.comboPoints", {
      points: this.game.i18n.formatScore(this.combo * 200),
    });
    $("combo-meter").style.width =
      `${Math.min(100, (Math.max(0, this.game.powerUntil - this.game.gameTime) / (this.game.challenges.active ? this.game.challenges.current.powerDuration : POWER_DURATION)) * 100)}%`;
    $("level-transition").hidden = this.game.state !== "transition";
    if (!this.transition) return;
    $("transition-number").textContent = this.game.i18n.t(
      this.game.challenges.active ? "challenge.title" : "arcade.level",
      {
        level: this.game.level,
      },
    );
    $("transition-map").textContent = this.game.i18n.t(
      "map." +
        this.game.maze.mapStyle(
          this.game.challenges.active
            ? this.game.challenges.current.styleLevel
            : this.game.level,
        ).id,
    );
    $("transition-ghosts").textContent = this.game.ghosts
      .levelGhosts(this.game.level)
      .map((g) => g.name)
      .join(" · ");
    $("transition-progress").style.width =
      `${Math.min(100, (this.transition.elapsed / this.transition.duration) * 100)}%`;
  }
}
