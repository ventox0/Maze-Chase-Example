import { GameComponent } from "../core/GameComponent.js";
import {
  COLS,
  DIRS,
  MAX_GHOSTS,
  OPPOSITE,
  ROWS,
  TILE,
} from "../data/config.js";
import { GHOSTS } from "../data/ghosts.js";

// Bölüm kadrosu, kovalamaca ve hayaletlerin özel yetenekleri.
export class GhostManager extends GameComponent {
  constructor(game) {
    super(game);
    this.entities = [];
  }

  update(dt) {
    for (const ghost of this.entities) {
      if (this.game.gameTime < ghost.releaseAt) continue;
      if (this.updateGhostSkill(ghost, dt)) continue;
      this.game.movement.move(
        ghost,
        this.ghostSpeed(ghost) * dt,
        this.chooseGhostDirection,
      );
    }
  }

  levelGhosts(number) {
    const unlocked = GHOSTS.filter((g) => g.unlock <= number);
    if (number <= 2) return unlocked.slice(0, MAX_GHOSTS);
    const specialists = unlocked.filter((g) => g.unlock > 1),
      latest = specialists.at(-1),
      older = specialists.slice(0, -1);
    return [
      GHOSTS[0],
      GHOSTS[number % 2 ? 1 : 2],
      older[(number - 3) % older.length],
      latest,
    ].slice(0, MAX_GHOSTS);
  }

  chooseGhostDirection(ghost) {
    // Hücre merkezine ulaşınca kontrol edilir; FPS hizası yeteneği kaçırmaz.
    if (this.updateGhostSkill(ghost, 0)) return null;
    let options = Object.keys(DIRS).filter((dir) =>
      this.game.movement.canGo(ghost, dir),
    );
    if (options.length > 1)
      options = options.filter((dir) => dir !== OPPOSITE[ghost.dir]);
    if (!options.length) return null;
    const frightened = this.ghostFrightened(ghost);
    let retreat = frightened,
      target = {
        col: this.game.player.entity.col,
        row: this.game.player.entity.row,
      };
    if (!frightened) {
      if (ghost.id === "pinky") {
        const d = DIRS[this.game.player.entity.dir];
        for (let i = 1; i <= 2; i++) {
          if (
            this.game.maze.walkable(
              this.game.player.entity.col + d.x * i,
              this.game.player.entity.row + d.y * i,
            )
          )
            target = {
              col: this.game.player.entity.col + d.x * i,
              row: this.game.player.entity.row + d.y * i,
            };
          else break;
        }
      } else if (ghost.id === "glitch") {
        const d = DIRS[this.game.player.entity.dir],
          side = Math.floor(this.game.gameTime / 4) % 2 ? 1 : -1;
        target = this.game.movement.nearestRoad({
          col: this.game.player.entity.col + d.x * 3 - d.y * 3 * side,
          row: this.game.player.entity.row + d.y * 3 + d.x * 3 * side,
        });
      } else if (
        ghost.id === "cinder" &&
        this.game.movement.distanceField(this.game.player.entity)[ghost.row][
          ghost.col
        ] < 5
      ) {
        target = { col: 1, row: ROWS - 2 };
      } else if (ghost.id === "dozer") {
        let best = Infinity;
        for (let row = 0; row < ROWS; row++)
          for (let col = 0; col < COLS; col++)
            if (this.game.maze.grid[row][col] === 3) {
              const distance =
                Math.abs(this.game.player.entity.col - col) +
                Math.abs(this.game.player.entity.row - row);
              if (distance < best) {
                best = distance;
                target = { col, row };
              }
            }
      }
    }
    const field = this.game.movement.distanceField(target);
    const priority =
      ghost.index % 3 === 2
        ? ["down", "right", "up", "left"]
        : ghost.index % 3 === 1
          ? ["left", "up", "right", "down"]
          : ["up", "left", "down", "right"];
    options.sort((a, b) => {
      const da = DIRS[a],
        db = DIRS[b],
        va = field[ghost.row + da.y][ghost.col + da.x],
        vb = field[ghost.row + db.y][ghost.col + db.x];
      return (
        (retreat ? vb - va : va - vb) ||
        priority.indexOf(a) - priority.indexOf(b)
      );
    });
    return options[0];
  }

  ghostFrightened(ghost) {
    return (
      this.game.gameTime < this.game.powerUntil &&
      this.game.gameTime >= ghost.immuneUntil
    );
  }

  ghostSkillsEnabled(ghost) {
    return (
      this.game.maze.phase === "maze" &&
      this.game.gameTime >= ghost.releaseAt &&
      this.game.gameTime >= this.game.powerUntil
    );
  }

  ghostCycle(ghost, seconds) {
    return Math.max(0, this.game.gameTime - ghost.skillEpoch) % seconds;
  }

  sprinting(ghost) {
    const phase = this.ghostCycle(ghost, 9);
    return (
      ghost.id === "rush" &&
      this.ghostSkillsEnabled(ghost) &&
      phase >= 7 &&
      phase < 8.4
    );
  }

  mossActive(ghost) {
    const phase = this.ghostCycle(ghost, 8);
    return (
      ghost.id === "moss" &&
      this.ghostSkillsEnabled(ghost) &&
      phase >= 4 &&
      phase < 7
    );
  }

  playerSlowed() {
    if (
      !this.game.player.entity ||
      !this.entities ||
      this.game.abilities.jump ||
      this.game.maze.phase !== "maze" ||
      this.game.gameTime < this.game.abilities.shieldUntil ||
      this.game.gameTime < this.game.powerUntil
    )
      return false;
    const p = this.game.movement.position(this.game.player.entity);
    return this.entities.some(
      (g) =>
        this.mossActive(g) &&
        Math.hypot(
          p.x - this.game.movement.position(g).x,
          p.y - this.game.movement.position(g).y,
        ) <=
          TILE * 2,
    );
  }

  ghostSpeed(ghost) {
    const base =
      (3.45 + Math.min(this.game.level - 1, 8) * 0.14) * TILE * ghost.speed;
    return (
      base *
      (this.game.challenges.active && !this.ghostFrightened(ghost)
        ? this.game.challenges.current.ghostMultiplier
        : 1) *
      (this.ghostFrightened(ghost) ? 0.7 : this.sprinting(ghost) ? 1.35 : 1)
    );
  }

  updateGhostSkill(ghost, dt) {
    if (!this.ghostSkillsEnabled(ghost)) {
      ghost.wallPlan = null;
      ghost.wallHop = null;
      return false;
    }
    if (ghost.wallHop) {
      ghost.wallHop.elapsed += dt;
      if (ghost.wallHop.elapsed >= 0.5) {
        const h = ghost.wallHop;
        Object.assign(ghost, {
          col: h.col,
          row: h.row,
          dir: h.dir,
          progress: 0,
          wallHop: null,
        });
        this.game.effects.burst(h.to.x, h.to.y, ghost.color, 10);
      }
      return true;
    }
    if (ghost.wallPlan) {
      ghost.moving = false;
      if (this.game.gameTime >= ghost.wallPlan.startsAt) {
        ghost.wallHop = { ...ghost.wallPlan, elapsed: 0 };
        ghost.wallPlan = null;
      }
      return true;
    }
    if (
      ghost.id !== "shade" ||
      this.game.gameTime < ghost.skillReadyAt ||
      ghost.progress > 0.000001
    )
      return false;
    const field = this.game.movement.distanceField(this.game.player.entity),
      current = field[ghost.row][ghost.col];
    if (current <= 3) return false;
    let best = null,
      bestDistance = current;
    for (const [dir, d] of Object.entries(DIRS)) {
      const x = ghost.col + d.x,
        y = ghost.row + d.y,
        col = ghost.col + d.x * 2,
        row = ghost.row + d.y * 2;
      if (
        !this.game.maze.walkable(col, row) ||
        this.game.maze.grid[y][x] !== 1 ||
        field[row][col] >= bestDistance
      )
        continue;
      bestDistance = field[row][col];
      best = { col, row, dir };
    }
    if (!best) return false;
    ghost.wallPlan = {
      ...best,
      from: this.game.movement.position(ghost),
      to: { x: (best.col + 0.5) * TILE, y: (best.row + 0.5) * TILE },
      startsAt: this.game.gameTime + 0.9,
    };
    ghost.skillReadyAt = this.game.gameTime + 10;
    ghost.moving = false;
    return true;
  }
}
