import { $, loadoutDialog } from "../core/dom.js";
import { GameComponent } from "../core/GameComponent.js";
import { COLS, MAX_LEVEL, ROWS } from "../data/config.js";

// 1.000 bölüm sayfalanır; bölüm atlamak mevcut oyunu değiştirmez.
export class LevelSelection extends GameComponent {
  constructor(game) {
    super(game);
    this.dialog = $("level-dialog");
    this.selected = 1;
    this.page = 0;
    this.pageSize = 12;
    this.thumbnails = new Map();
  }
  open() {
    if (
      this.game.customization.dialog.open ||
      !(
        ["ready", "gameover"].includes(this.game.state) ||
        (this.game.state === "victory" && this.game.level === MAX_LEVEL)
      ) ||
      loadoutDialog.open
    )
      return;
    this.page = Math.floor((this.selected - 1) / this.pageSize);
    this.renderMenu();
    this.dialog.showModal();
  }
  selectLevel(level) {
    if (!this.game.saves.validLevel(level)) {
      $("level-error").textContent = this.game.i18n.t("levels.invalid");
      return false;
    }
    this.selected = level;
    this.page = Math.floor((level - 1) / this.pageSize);
    $("level-error").textContent = "";
    this.renderMenu();
    return true;
  }
  jumpToLevel() {
    return this.selectLevel(Number($("level-number").value));
  }
  changePage(delta) {
    const page = Math.min(
      Math.floor((MAX_LEVEL - 1) / this.pageSize),
      Math.max(0, this.page + delta),
    );
    this.page = page;
    this.renderMenu();
  }
  confirmSelection() {
    if (!this.dialog.open || !this.game.saves.validLevel(this.selected)) return;
    this.dialog.close();
    this.game.abilities.openLoadout("start", this.selected, true);
  }
  thumbnail(level) {
    if (this.thumbnails.has(level)) return this.thumbnails.get(level);
    const image = document.createElement("canvas");
    image.width = COLS * 3;
    image.height = ROWS * 3;
    const context = image.getContext("2d"),
      grid = this.game.maze.createLevelMap(level),
      style = this.game.maze.mapStyle(level);
    context.fillStyle = "#090b17";
    context.fillRect(0, 0, image.width, image.height);
    for (let y = 0; y < ROWS; y++)
      for (let x = 0; x < COLS; x++) {
        if (grid[y][x] === 1) {
          context.fillStyle = style.color;
          context.fillRect(x * 3, y * 3, 3, 3);
        } else if (grid[y][x] === 3) {
          context.fillStyle = "#ffe15b";
          context.fillRect(x * 3, y * 3, 3, 3);
        }
      }
    const url = image.toDataURL();
    if (this.thumbnails.size >= 48)
      this.thumbnails.delete(this.thumbnails.keys().next().value);
    this.thumbnails.set(level, url);
    return url;
  }
  renderMenu() {
    const t = this.game.i18n.t,
      start = this.page * this.pageSize + 1,
      end = Math.min(MAX_LEVEL, start + this.pageSize - 1);
    $("level-range").textContent = t("levels.range", { start, end });
    $("level-prev").disabled = this.page === 0;
    $("level-next").disabled = end === MAX_LEVEL;
    $("level-number").value = String(this.selected);
    $("autosave-toggle").checked = this.game.saves.autoEnabled;
    $("level-grid").innerHTML = Array.from(
      { length: end - start + 1 },
      (_, i) => {
        const level = start + i,
          style = this.game.maze.mapStyle(level);
        return `<button type="button" class="level-card" data-level="${level}" aria-pressed="${level === this.selected}" style="--map-color:${style.color}"><img src="${this.thumbnail(level)}" alt="" aria-hidden="true"><strong>${t("levels.number", { level })}</strong><span>${t("map." + style.id)}</span><small>${t("levels.ghosts", { count: this.game.ghosts.levelGhosts(level).length })}${level % 5 === 0 ? " · " + t("levels.checkpoint") : ""}</small></button>`;
      },
    ).join("");
    $("level-choice").textContent = t("levels.choice", {
      level: this.selected,
      name: t("map." + this.game.maze.mapStyle(this.selected).id),
    });
    const cards = ["manual", "auto"]
      .map((slot) => {
        const record = this.game.saves.slots[slot];
        if (!this.game.saves.validate(record)) return "";
        const date = new Date(record.savedAt).toLocaleString(
          this.game.i18n.language === "tr" ? "tr-TR" : "en-GB",
          { dateStyle: "short", timeStyle: "short" },
        );
        return `<article class="save-card"><div><strong>${t("save." + slot)}</strong><p>${t("save.summary", { level: record.data.level, score: this.game.i18n.formatScore(record.data.score) })}</p><small>${date}</small></div><button type="button" class="icon-button" data-resume="${slot}">${t("save.load")}</button></article>`;
      })
      .join("");
    $("saved-games").innerHTML =
      cards || `<p class="no-saves">${t("save.empty")}</p>`;
  }
}
