import { $, canvas, loadoutDialog } from "../core/dom.js";
import { GameComponent } from "../core/GameComponent.js";
import { applyChallengeRule } from "../data/challenges.js";
import { COLS, ROWS } from "../data/config.js";

// Başlamadan önce üretilen haritayı, kuralı ve ödülü gösterir.
export class ChallengeSelection extends GameComponent {
  constructor(game) {
    super(game);
    this.dialog = $("challenge-dialog");
    this.difficulty = "normal";
    this.pending = null;
  }
  chooseMode(mode) {
    if (
      !["campaign", "challenge"].includes(mode) ||
      this.game.state !== "ready"
    )
      return;
    this.game.menuMode = mode;
    this.game.ui.renderStateScreen();
  }
  open(keep = false) {
    if (
      !["ready", "gameover", "victory"].includes(this.game.state) ||
      this.dialog.open ||
      loadoutDialog.open ||
      this.game.missionMenu.dialog.open ||
      this.game.levels.dialog.open ||
      this.game.shop.dialog.open ||
      this.game.settings.dialog.open
    )
      return;
    if (!keep || !this.pending) this.reroll();
    else this.render();
    this.dialog.showModal();
  }
  reroll() {
    this.pending = this.game.challenges.create(this.difficulty);
    this.render();
  }
  setDifficulty(value) {
    if (!["easy", "normal", "hard"].includes(value)) return;
    this.difficulty = value;
    this.reroll();
  }
  confirm() {
    if (!this.dialog.open || !this.pending) return;
    this.dialog.close();
    if (this.pending.rule === "noSkills") {
      this.game.challenges.start(this.pending);
      canvas.focus({ preventScroll: true });
    } else this.game.abilities.openLoadout("challenge", this.pending.level);
  }
  retry() {
    if (
      !this.game.challenges.active ||
      !this.game.challenges.result ||
      !["victory", "gameover"].includes(this.game.state)
    )
      return;
    this.pending = { ...this.game.challenges.current };
    this.difficulty = this.pending.difficulty;
    if (this.pending.rule === "noSkills")
      this.game.challenges.start(this.pending);
    else this.game.abilities.openLoadout("challenge", this.pending.level);
  }
  render() {
    if (!this.pending) return;
    const c = this.pending,
      t = this.game.i18n.t;
    $("challenge-difficulty").value = this.difficulty;
    $("challenge-rule").textContent = t("challenge.rule." + c.rule);
    $("challenge-rule-description").textContent = t(
      "challenge.detail." + c.rule,
      {
        seconds: c.timeLimit,
        uses: c.abilityLimit,
        target: c.ghostTarget,
        powerSeconds: c.powerDuration,
      },
    );
    $("challenge-code").textContent = "#" + c.code;
    $("challenge-lives").textContent = t("challenge.lives", { lives: c.lives });
    $("challenge-reward").textContent = t("challenge.reward", {
      points: this.game.i18n.formatScore(c.reward),
    });
    $("challenge-enemies").textContent = this.game.ghosts
      .levelGhosts(c.level)
      .map((g) => g.name)
      .join(" · ");
    $("challenge-map-name").textContent = t(
      "map." + this.game.maze.mapStyle(c.styleLevel).id,
    );
    $("challenge-confirm").textContent = t(
      c.rule === "noSkills" ? "challenge.start" : "challenge.loadout",
    );
    const grid = applyChallengeRule(
      this.game.maze.createLevelMap(c.level, {
        seed: c.seed,
        styleLevel: c.styleLevel,
      }),
      c.rule,
    );
    const preview = $("challenge-map");
    preview.width = COLS * 6;
    preview.height = ROWS * 6;
    const ctx = preview.getContext("2d");
    ctx.fillStyle = "#090b17";
    ctx.fillRect(0, 0, preview.width, preview.height);
    for (let y = 0; y < ROWS; y++)
      for (let x = 0; x < COLS; x++) {
        ctx.fillStyle =
          grid[y][x] === 1
            ? this.game.maze.mapStyle(c.styleLevel).color
            : grid[y][x] === 3 && c.rule !== "noPower"
              ? "#ffe15b"
              : "#586077";
        if (grid[y][x] === 1) ctx.fillRect(x * 6, y * 6, 6, 6);
        else if (grid[y][x] === 2 || grid[y][x] === 3)
          ctx.fillRect(x * 6 + 2, y * 6 + 2, 2, 2);
      }
    ctx.fillStyle = "#ffe15b";
    ctx.fillRect(10 * 6, 17 * 6, 6, 6);
  }
}
