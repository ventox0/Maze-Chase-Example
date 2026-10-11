import { buildWallLayer } from "../rendering/ArcadeDrawing.js";
import { GameComponent } from "../core/GameComponent.js";
import {
  COLS,
  LIFE_PELLET,
  POWER_DURATION,
  ROWS,
  TILE,
} from "../data/config.js";
import { mapStyle, mapRandom, createLevelMap } from "./map-generation.js";

// Bölüme özel labirent, yemler, can yemi ve önbelleğe alınmış duvarlar.
export class MazeMap extends GameComponent {
  constructor(game) {
    super(game);
    this.grid = [];
    this.pellets = 0;
    this.phase = "maze";
    this.bonusReward = "";
    this.bonusRewardKey = "";
    this.wallLayer = null;
  }

  mapStyle(number) {
    return mapStyle(number);
  }
  mapRandom(number) {
    return mapRandom(number);
  }
  createLevelMap(number, generation = null) {
    return createLevelMap(number, generation);
  }

  walkable(col, row) {
    return (
      row >= 0 &&
      row < ROWS &&
      col >= 0 &&
      col < COLS &&
      this.grid[row][col] !== 1
    );
  }

  buildWalls() {
    const style = this.mapStyle(
      this.game.challenges.active
        ? this.game.challenges.current.styleLevel
        : this.game.level,
    );
    this.wallLayer = buildWallLayer(this.grid, style);
  }

  collectPellet(col, row, magnetic = false) {
    const value = this.grid[row][col];
    if (value === 4) {
      if (
        !magnetic &&
        this.phase === "bonus" &&
        this.game.player.entity.col === col &&
        this.game.player.entity.row === row
      )
        this.collectLifePellet();
      return;
    }
    if (value !== 2 && value !== 3) return;
    if (!this.game.challenges.beforePellet(value)) return;
    this.grid[row][col] = 0;
    this.pellets--;
    this.game.addScore(value === 3 ? 50 : 10);
    this.game.missions.record(value === 3 ? "powerPellets" : "smallPellets");
    if (magnetic && value === 2) this.game.missions.record("magnetPellets");
    if (value === 3) {
      this.game.powerUntil =
        this.game.gameTime +
        (this.game.challenges.active
          ? this.game.challenges.current.powerDuration
          : POWER_DURATION);
      this.game.arcade.beginPower();
      this.game.ghosts.entities.forEach((g) => {
        g.wallPlan = null;
        g.wallHop = null;
        if (this.game.gameTime >= g.releaseAt) this.game.movement.reverse(g);
      });
      const p = this.game.movement.position(this.game.player.entity);
      this.game.effects.burst(p.x, p.y, "#ffe15b", 18);
      this.game.audio.play("power");
      this.game.ui.announce("announce.power");
    } else if (!magnetic) {
      this.game.audio.play("pellet");
    }
    if (this.pellets === 0) this.beginRoundBonus();
  }

  beginRoundBonus() {
    if (this.phase !== "maze" || !this.game.challenges.beforeBonus()) return;
    this.phase = "bonus";
    this.game.ghosts.entities = [];
    this.game.powerUntil = 0;
    this.grid[LIFE_PELLET.row][LIFE_PELLET.col] = 4;
    const x = (LIFE_PELLET.col + 0.5) * TILE,
      y = (LIFE_PELLET.row + 0.5) * TILE;
    this.game.effects.burst(x, y, "#80e8b2", 24);
    this.game.audio.play("bonus");
    this.game.ui.announce("announce.bonus");
    this.game.ui.updateHUD();
  }

  collectLifePellet() {
    if (
      this.phase !== "bonus" ||
      this.grid[LIFE_PELLET.row][LIFE_PELLET.col] !== 4
    )
      return;
    this.grid[LIFE_PELLET.row][LIFE_PELLET.col] = 0;
    this.phase = "complete";
    if (this.game.lives < 3) {
      this.game.lives++;
      this.bonusRewardKey = "reward.life";
    } else {
      this.game.addScore(500);
      this.bonusRewardKey = "reward.points";
    }
    const p = this.game.movement.position(this.game.player.entity);
    this.game.effects.burst(p.x, p.y, "#80e8b2", 24);

    this.game.changeState("victory");
    this.game.audio.play("victory");
    this.game.ui.announce("announce.victory", { reward: this.bonusReward });
  }
}
