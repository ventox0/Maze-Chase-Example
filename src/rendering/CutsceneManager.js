import { canvas, ctx, motionPreference } from "../core/dom.js";
import { GameComponent } from "../core/GameComponent.js";
import { HEIGHT, WIDTH } from "../data/config.js";

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
    const reduced = Boolean(motionPreference && motionPreference.matches);
    this.current = {
      kind: kinds[index],
      index,
      ghost: { id: ghost.id, name: ghost.name, color: ghost.color },
      elapsed: 0,
      duration: reduced ? 0.65 : 1.3,
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
      this.current.elapsed >= this.current.duration * 0.4
    ) {
      this.current.impactPlayed = true;
      this.game.audio.tone(110, 0.09, "triangle", 0.055);
    }
    if (this.current.elapsed >= this.current.duration - 1e-9)
      this.finishCutscene();
  }

  drawCutscene() {
    if (!this.current) return;
    const s = this.current,
      p = Math.min(1, s.elapsed / s.duration),
      hit = 0.4;
    const entry = Math.min(1, p / 0.22),
      ease = 1 - Math.pow(1 - entry, 3),
      recoil = Math.max(0, (p - hit) / (1 - hit));
    const fade = p > 0.86 ? (1 - p) / 0.14 : 1;
    const shake =
      !s.reduced && p >= hit && p < hit + 0.1
        ? Math.sin(p * 160) * 5 * (1 - (p - hit) / 0.1)
        : 0;
    ctx.save();
    ctx.globalAlpha = 0.98;
    ctx.fillStyle = "#0c0b1b";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#2c23401c";
    for (let y = 0; y < HEIGHT; y += 24) ctx.fillRect(0, y, WIDTH, 1);
    ctx.strokeStyle = "#a28bff22";
    ctx.lineWidth = 1;
    ctx.strokeRect(18, 18, WIDTH - 36, HEIGHT - 36);
    ctx.fillStyle = "#ffe15b08";
    ctx.beginPath();
    ctx.ellipse(WIDTH * 0.5, HEIGHT * 0.69, 180, 27, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.translate(shake, 0);
    ctx.globalAlpha = Math.max(0, fade);
    // Kısa yumrukların temas mesafesi uzun düz yumruktan daha yakındır.
    let gx =
        (s.kind === "punch" ? 335 : 280) + (s.reduced ? 0 : (1 - ease) * 170),
      gy = HEIGHT * 0.52,
      rotation = 0;
    if (p >= hit && !s.reduced) {
      if (s.kind === "uppercut") {
        gx += recoil * 35;
        gy -= Math.sin(recoil * Math.PI * 0.85) * 195;
        rotation = recoil * 0.65;
      } else if (s.kind === "punch") {
        gx += recoil * 130;
        gy -= Math.sin(recoil * Math.PI) * 28;
        rotation = recoil * 0.9;
      } else {
        gx += recoil * 75;
        gy += Math.sin(recoil * Math.PI) * 12;
        rotation = -recoil * 0.6;
      }
    }
    const victim = this.game.assets.ghosts[s.ghost.id];
    ctx.save();
    ctx.translate(gx, gy);
    ctx.rotate(rotation);
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
    // Darbe sonrası gözlerin karikatür X olması, düşmanın yendiğini belirtir.
    if (p >= hit && p < hit + 0.23) {
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
    const striking = p >= 0.26 && p < 0.8,
      image = striking
        ? this.game.assets.actions[s.index] || this.game.assets.players.power
        : this.game.assets.players.power;
    const hx =
      175 -
      (s.reduced ? 0 : (1 - ease) * 170) +
      (striking && !s.reduced
        ? Math.sin(Math.min(1, (p - 0.26) / 0.2) * Math.PI) * 12
        : 0);
    const hy =
      HEIGHT * 0.55 -
      (s.kind === "uppercut" && striking && !s.reduced ? 18 : 0);
    ctx.save();
    ctx.translate(hx, hy);
    if (!s.reduced) ctx.rotate(striking && s.kind === "hook" ? -0.09 : 0);
    if (image && image.complete !== false) {
      const ratio =
          (image.width || image.naturalWidth) /
          (image.height || image.naturalHeight),
        height = 230;
      ctx.drawImage(
        image,
        (-height * ratio) / 2,
        -height / 2,
        height * ratio,
        height,
      );
    }
    ctx.restore();
    // Kısa yıldız patlaması; hızlı tam ekran flaş kullanılmaz.
    if (p >= hit && p < hit + 0.19) {
      const impact = (p - hit) / 0.19,
        size = s.reduced ? 26 : 42 * (1 - impact) + 14;
      const x = s.kind === "punch" ? 302 : 250,
        y =
          HEIGHT *
          (s.kind === "uppercut" ? 0.39 : s.kind === "hook" ? 0.56 : 0.49);
      ctx.fillStyle = "#fff5a2";
      ctx.strokeStyle = "#ffe15b";
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = 0; i < 20; i++) {
        const a = (i * Math.PI) / 10,
          r = i % 2 ? size * 0.46 : size;
        const px = x + Math.cos(a) * r,
          py = y + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      if (!s.reduced) {
        ctx.strokeStyle = s.ghost.color;
        ctx.lineWidth = 3;
        for (let i = 0; i < 8; i++) {
          const a = (i * Math.PI) / 4;
          ctx.beginPath();
          ctx.moveTo(
            x + Math.cos(a) * (size + 8),
            y + Math.sin(a) * (size + 8),
          );
          ctx.lineTo(
            x + Math.cos(a) * (size + 25),
            y + Math.sin(a) * (size + 25),
          );
          ctx.stroke();
        }
      }
    }
    ctx.restore();
  }
}
