import { $, canvas, loadoutDialog } from "../core/dom.js";
import { GameComponent } from "../core/GameComponent.js";
import {
  ABILITIES,
  BOOST_COOLDOWN,
  BOOST_DURATION,
  JUMP_COOLDOWN,
  JUMP_DURATION,
  MAGNET_COOLDOWN,
  MAGNET_DURATION,
  MAGNET_RADIUS,
  SHIELD_COOLDOWN,
  SHIELD_DURATION,
} from "../data/abilities.js";
import { COLS, DIRS, MAX_LEVEL, ROWS, TILE } from "../data/config.js";

// Q/E seçimleri, güç etkileri ve oyun zamanına bağlı beklemeler.
export class AbilitySystem extends GameComponent {
  constructor(game) {
    super(game);
    this.jump = null;
    this.jumpReadyAt = 0;
    this.pendingJumpUntil = 0;
    this.magnetUntil = 0;
    this.magnetReadyAt = 0;
    this.pelletTrails = [];
    this.boostUntil = 0;
    this.boostReadyAt = 0;
    this.shieldUntil = 0;
    this.shieldReadyAt = 0;
    this.loadout = { q: "jump", e: "magnet" };
    this.draftLoadout = { ...this.loadout };
    this.selectedSlot = "q";
    this.loadoutNext = "start";
    this.startLevel = 1;
    this.fromLevelMenu = false;
  }

  updateTrails(dt) {
    const player = this.game.movement.position(this.game.player.entity);
    this.pelletTrails = this.pelletTrails.filter((trail) => {
      trail.life -= dt;
      const blend = Math.min(1, dt * 18);
      trail.x += (player.x - trail.x) * blend;
      trail.y += (player.y - trail.y) * blend;
      return trail.life > 0;
    });
  }

  openLoadout(next, startLevel = 1, fromLevelMenu = false) {
    if (!["ready", "gameover", "victory"].includes(this.game.state)) return;
    if (next === "next" && this.game.level >= MAX_LEVEL) return;
    this.draftLoadout = { ...this.loadout };
    this.selectedSlot = "q";
    this.loadoutNext = next;
    this.startLevel = startLevel;
    this.fromLevelMenu = fromLevelMenu;
    this.renderLoadout();
    loadoutDialog.showModal();
  }

  selectSlot(slot) {
    this.selectedSlot = slot;
    this.renderLoadout();
  }

  selectAbility(id) {
    if (!ABILITIES[id]) return;
    const other = this.selectedSlot === "q" ? "e" : "q",
      previous = this.draftLoadout[this.selectedSlot];
    if (this.draftLoadout[other] === id) this.draftLoadout[other] = previous;
    this.draftLoadout[this.selectedSlot] = id;
    this.renderLoadout();
  }

  renderLoadout() {
    for (const slot of ["q", "e"]) {
      $(`slot-${slot}`).setAttribute(
        "aria-pressed",
        String(this.selectedSlot === slot),
      );
      $(`slot-${slot}-name`).textContent = this.game.i18n.abilityName(
        this.draftLoadout[slot],
      );
    }
    document.querySelectorAll("[data-ability]").forEach((button) => {
      const slot = ["q", "e"].find(
        (key) => this.draftLoadout[key] === button.dataset.ability,
      );
      button.setAttribute("aria-pressed", String(!!slot));
      button.querySelector(".loadout-badge").textContent = slot
        ? slot.toUpperCase()
        : "";
    });
    $("loadout-confirm").firstChild.textContent =
      this.game.i18n.t(
        this.loadoutNext === "next" ? "confirm.next" : "confirm.start",
      ) + " ";
    const upcoming =
      this.loadoutNext === "next" ? this.game.level + 1 : this.startLevel;
    $("loadout-enemies").textContent = this.game.i18n.t("ghostLoadout", {
      level: upcoming,
      names: this.game.ghosts
        .levelGhosts(upcoming)
        .map((g) => g.name)
        .join(" · "),
    });
    $("loadout-map").textContent = this.game.i18n.t("map.preview", {
      name: this.game.i18n.t("map." + this.game.maze.mapStyle(upcoming).id),
    });
  }

  confirmLoadout() {
    if (
      !loadoutDialog.open ||
      !["ready", "gameover", "victory"].includes(this.game.state)
    )
      return;
    this.loadout = { ...this.draftLoadout };
    loadoutDialog.close();
    if (this.loadoutNext === "next") this.game.nextLevel();
    else this.game.startGame(this.startLevel);
    canvas.focus({ preventScroll: true });
  }

  cancelLoadout() {
    loadoutDialog.close();
    if (this.fromLevelMenu) this.game.levels.open();
  }

  useAbility(slot) {
    if (this.game.state !== "playing" || loadoutDialog.open) return;
    ({
      jump: this.useJump,
      magnet: this.useMagnet,
      boost: this.useBoost,
      shield: this.useShield,
    })[this.loadout[slot]]();
  }

  useBoost() {
    if (this.game.state !== "playing" || this.game.gameTime < this.boostReadyAt)
      return;
    this.game.audio.resumeAudio();
    this.boostUntil = this.game.gameTime + BOOST_DURATION;
    this.boostReadyAt = this.game.gameTime + BOOST_COOLDOWN;
    const p = this.game.movement.position(this.game.player.entity);
    this.game.effects.burst(p.x, p.y, "#ffa563", 18);
    this.game.audio.tone(880, 0.18);
    this.game.ui.announce("announce.boost");
  }

  useShield() {
    if (
      this.game.state !== "playing" ||
      this.game.gameTime < this.shieldReadyAt
    )
      return;
    this.game.audio.resumeAudio();
    this.shieldUntil = this.game.gameTime + SHIELD_DURATION;
    this.shieldReadyAt = this.game.gameTime + SHIELD_COOLDOWN;
    const p = this.game.movement.position(this.game.player.entity);
    this.game.effects.burst(p.x, p.y, "#81c9ff", 18);
    this.game.audio.tone(550, 0.25, "sine");
    this.game.ui.announce("announce.shield");
  }

  useJump() {
    if (
      this.game.state !== "playing" ||
      this.jump ||
      this.game.gameTime < this.jumpReadyAt
    )
      return;
    this.game.audio.resumeAudio();
    if (this.game.player.entity.progress > 0.000001) {
      this.pendingJumpUntil = this.game.gameTime + 0.65;
      return;
    }
    this.attemptJump();
  }

  attemptJump() {
    this.pendingJumpUntil = 0;
    const dir = this.game.player.entity.next,
      d = DIRS[dir];
    let col = this.game.player.entity.col + d.x,
      row = this.game.player.entity.row + d.y,
      walls = 0;
    while (
      row >= 0 &&
      row < ROWS &&
      col >= 0 &&
      col < COLS &&
      this.game.maze.grid[row][col] === 1 &&
      walls < 3
    ) {
      walls++;
      col += d.x;
      row += d.y;
    }
    if (!walls || !this.game.maze.walkable(col, row)) {
      this.game.ui.announce("announce.invalidJump");
      return false;
    }
    const from = this.game.movement.position(this.game.player.entity);
    this.jump = {
      from,
      to: { x: (col + 0.5) * TILE, y: (row + 0.5) * TILE },
      col,
      row,
      dir,
      elapsed: 0,
    };
    this.game.player.entity.dir = dir;
    this.game.player.entity.moving = true;
    this.jumpReadyAt = this.game.gameTime + JUMP_COOLDOWN;
    this.game.effects.burst(from.x, from.y, "#a28bff", 14);
    this.game.audio.tone(740, 0.18, "sine");
    this.game.ui.announce("announce.jump");
    return true;
  }

  advanceJump(dt) {
    this.jump.elapsed += dt;
    if (this.jump.elapsed < JUMP_DURATION) return;
    const landing = this.jump;
    Object.assign(this.game.player.entity, {
      col: landing.col,
      row: landing.row,
      dir: landing.dir,
      progress: 0,
      moving: false,
    });
    this.jump = null;
    this.game.effects.burst(landing.to.x, landing.to.y, "#a28bff", 14);
    this.game.player.eatPellet();
  }

  useMagnet() {
    if (
      this.game.state !== "playing" ||
      this.game.gameTime < this.magnetReadyAt
    )
      return;
    this.game.audio.resumeAudio();
    this.magnetUntil = this.game.gameTime + MAGNET_DURATION;
    this.magnetReadyAt = this.game.gameTime + MAGNET_COOLDOWN;
    const p = this.game.movement.position(this.game.player.entity);
    this.game.effects.burst(p.x, p.y, "#65dcca", 18);
    this.game.audio.tone(330, 0.25, "sine");
    this.game.ui.announce("announce.magnet");
    this.attractPellets();
  }

  attractPellets() {
    if (this.game.gameTime >= this.magnetUntil || this.game.state !== "playing")
      return;
    const p = this.game.movement.position(this.game.player.entity);
    for (
      let row = Math.max(0, Math.floor(p.y / TILE) - 3);
      row <= Math.min(ROWS - 1, Math.floor(p.y / TILE) + 3);
      row++
    ) {
      for (
        let col = Math.max(0, Math.floor(p.x / TILE) - 3);
        col <= Math.min(COLS - 1, Math.floor(p.x / TILE) + 3);
        col++
      ) {
        const x = (col + 0.5) * TILE,
          y = (row + 0.5) * TILE;
        // Güç yemleri yerinde kalır; küçük yemler duvarın arkasından da çekilebilir.
        if (
          this.game.maze.grid[row][col] !== 2 ||
          Math.hypot(x - p.x, y - p.y) > MAGNET_RADIUS
        )
          continue;
        this.pelletTrails.push({ x, y, life: 0.28 });
        this.game.maze.collectPellet(col, row, true);
        if (this.game.state !== "playing") return;
      }
    }
  }
}
