import { canvas, ctx } from "../core/dom.js";
import { GameComponent } from "../core/GameComponent.js";
import { HEIGHT, WIDTH } from "../data/config.js";
import {
  CUTSCENE_DURATION,
  REDUCED_CUTSCENE_DURATION,
  IMPACT_PHASE,
  clamp,
  segment,
} from "./animation.js";

// Hayalet yenme sahneleri; dünya zamanından bağımsız animasyon.
export class CutsceneManager extends GameComponent {
  constructor(game) {
    super(game);
    this.current = null;
    this.sequence = 0;
  }

  beginCutscene(ghost) {
    const kinds = ["punch", "uppercut", "hook"],
      index = this.sequence++ % kinds.length;
    const reduced = this.game.settings.reduced;
    this.current = {
      kind: kinds[index],
      index,
      ghost: { id: ghost.id, name: ghost.name, color: ghost.color },
      elapsed: 0,
      duration: reduced ? REDUCED_CUTSCENE_DURATION : CUTSCENE_DURATION,
      reduced,
      impactPlayed: false,
    };
    this.game.changeState("cutscene");
    this.game.ui.announce("announce.action", { name: ghost.name });
  }

  finishCutscene() {
    if (this.game.state !== "cutscene" || !this.current) return;
    this.current = null;
    this.game.changeState("playing");
    this.game.lastFrame = 0;
    this.game.accumulator = 0;
    canvas.focus({ preventScroll: true });
  }

  advanceCutscene(dt) {
    if (!this.current) return;
    this.current.elapsed += dt;
    if (
      !this.current.impactPlayed &&
      this.current.elapsed >= this.current.duration * IMPACT_PHASE
    ) {
      this.current.impactPlayed = true;
      this.game.audio.play("impact");
      this.game.arcade.impact("ghost");
    }
    if (this.current.elapsed >= this.current.duration - 1e-9)
      this.finishCutscene();
  }

  // Kesintisiz fazlar: geliş, hazırlık, vuruş, savrulma ve toparlanma.
  // İki oyuncu pozu ani görsel değişimi yerine birbirine karışır.
  pose() {
    const s = this.current,
      p = clamp(s.elapsed / s.duration);
    const entry = segment(p, 0, 0.24),
      windup = segment(p, 0.22, 0.34) * (1 - segment(p, 0.34, IMPACT_PHASE)),
      strike = segment(p, 0.34, IMPACT_PHASE) * (1 - segment(p, 0.64, 0.9)),
      flight = segment(p, 0.49, 0.86),
      action = segment(p, 0.3, 0.42) * (1 - segment(p, 0.7, 0.92)),
      fade = segment(p, 0, 0.08) * (1 - segment(p, 0.9, 1));
    const upper = s.kind === "uppercut",
      hook = s.kind === "hook";
    return {
      p,
      flight,
      action,
      fade,
      hx:
        175 + (s.reduced ? 0 : -(1 - entry) * 170 - windup * 14 + strike * 27),
      hy:
        HEIGHT * 0.55 +
        (s.reduced ? 0 : windup * 5 - strike * (upper ? 28 : 5)),
      heroAngle: s.reduced
        ? 0
        : -windup * 0.07 + strike * (hook ? -0.12 : upper ? -0.05 : 0.04),
      gx:
        (s.kind === "punch" ? 335 : 280) +
        (s.reduced
          ? 0
          : (1 - entry) * 170 + flight * (upper ? 62 : hook ? 120 : 135)),
      gy:
        HEIGHT * 0.52 +
        (s.reduced
          ? 0
          : -Math.sin(flight * Math.PI * (upper ? 0.72 : 1)) *
            (upper ? 200 : hook ? 52 : 36)),
      ghostAngle: s.reduced ? 0 : flight * (upper ? 1.1 : hook ? -1.3 : 1.6),
      ghostAlpha: 1 - segment(p, 0.75, 0.9),
      impact:
        segment(p, IMPACT_PHASE, IMPACT_PHASE + 0.02) *
        (1 - segment(p, 0.51, 0.67)),
    };
  }

  drawHero(image, opacity, height = 230) {
    if (!image || image.complete === false || opacity <= 0) return;
    const width = image.width || image.naturalWidth,
      sourceHeight = image.height || image.naturalHeight;
    if (!width || !sourceHeight) return;
    ctx.save();
    ctx.globalAlpha *= opacity;
    const ratio = width / sourceHeight;
    ctx.drawImage(
      image,
      (-height * ratio) / 2,
      -height / 2,
      height * ratio,
      height,
    );
    ctx.restore();
  }

  drawCutscene() {
    if (!this.current) return;
    const s = this.current,
      pose = this.pose();
    ctx.save();
    // Labirent girişte ve çıkışta görünür; ani ekran kesmesi olmaz.
    ctx.globalAlpha = pose.fade * 0.98;
    ctx.fillStyle = "#0c0b1b";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.globalAlpha = pose.fade;
    ctx.fillStyle = "#2c23401c";
    for (let y = 0; y < HEIGHT; y += 24) ctx.fillRect(0, y, WIDTH, 1);
    ctx.strokeStyle = "#a28bff22";
    ctx.lineWidth = 1;
    ctx.strokeRect(18, 18, WIDTH - 36, HEIGHT - 36);
    ctx.fillStyle = "#ffe15b0d";
    ctx.beginPath();
    ctx.ellipse(WIDTH * 0.5, HEIGHT * 0.76, 180, 23, 0, 0, Math.PI * 2);
    ctx.fill();

    // Darbeden sonra kısa bir bekleme, ardından eğri boyunca savrulma.
    ctx.save();
    ctx.globalAlpha *= pose.ghostAlpha;
    ctx.translate(pose.gx, pose.gy);
    ctx.rotate(pose.ghostAngle);
    const squash = s.reduced ? 0 : pose.impact * 0.09;
    ctx.scale(1 - squash, 1 + squash);
    const victim = this.game.assets.ghosts[s.ghost.id];
    if (victim) ctx.drawImage(victim, -56, -75, 112, 150);
    else {
      ctx.fillStyle = s.ghost.color;
      ctx.beginPath();
      ctx.arc(0, -18, 48, Math.PI, 0);
      ctx.lineTo(48, 65);
      ctx.lineTo(-48, 65);
      ctx.closePath();
      ctx.fill();
    }
    if (pose.p >= IMPACT_PHASE) {
      ctx.strokeStyle = "#101020";
      ctx.lineWidth = 4;
      for (const x of [-15, 15]) {
        ctx.beginPath();
        ctx.moveTo(x - 5, -26);
        ctx.lineTo(x + 5, -16);
        ctx.moveTo(x + 5, -26);
        ctx.lineTo(x - 5, -16);
        ctx.stroke();
      }
    }
    ctx.restore();

    ctx.save();
    ctx.translate(pose.hx, pose.hy);
    ctx.rotate(pose.heroAngle);
    const stretch = s.reduced ? 0 : pose.impact * 0.025;
    ctx.scale(1 + stretch, 1 - stretch);
    const resting = this.game.assets.players.power,
      striking = this.game.assets.actions[s.index] || resting;
    this.drawHero(resting, 1 - pose.action);
    this.drawHero(striking, pose.action);
    ctx.restore();

    // Yıldız, genişleyen halka ve çizgiler aynı vuruş anıyla senkronize olur.
    if (pose.impact > 0) {
      const x = s.kind === "punch" ? 302 : 250,
        y =
          HEIGHT *
          (s.kind === "uppercut" ? 0.39 : s.kind === "hook" ? 0.56 : 0.49),
        size = s.reduced ? 26 : 18 + pose.impact * 38;
      ctx.save();
      ctx.globalAlpha *= pose.impact;
      ctx.translate(x, y);
      ctx.rotate(s.reduced ? 0 : (pose.p - IMPACT_PHASE) * 1.4);
      ctx.fillStyle = "#fff5a2";
      ctx.strokeStyle = "#ffe15b";
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = 0; i < 20; i++) {
        const a = (i * Math.PI) / 10,
          r = i % 2 ? size * 0.46 : size;
        if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      if (!s.reduced && this.game.settings.effectsAllowed("particles")) {
        const expansion = segment(pose.p, IMPACT_PHASE, 0.67);
        ctx.strokeStyle = s.ghost.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 36 + expansion * 58, 0, Math.PI * 2);
        ctx.stroke();
        for (let i = 0; i < 8; i++) {
          const a = (i * Math.PI) / 4,
            inner = size + 8 + expansion * 20;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * inner, Math.sin(a) * inner);
          ctx.lineTo(Math.cos(a) * (inner + 25), Math.sin(a) * (inner + 25));
          ctx.stroke();
        }
      }
      ctx.restore();
    }
    ctx.restore();
  }
}
