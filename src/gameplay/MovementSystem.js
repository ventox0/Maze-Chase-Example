import { GameComponent } from "../core/GameComponent.js";
import { GridActor } from "../core/GridActor.js";
import { JUMP_DURATION } from "../data/abilities.js";
import { COLS, DIRS, OPPOSITE, ROWS, TILE } from "../data/config.js";

// Izgara hizalama, aktör konumları ve ortak yol bulma.
export class MovementSystem extends GameComponent {
  constructor(game) {
    super(game);
  }

  actor(col, row, dir = "left") {
    return new GridActor(col, row, dir);
  }

  position(entity) {
    if (entity === this.game.player.entity && this.game.abilities.jump) {
      const t = Math.min(1, this.game.abilities.jump.elapsed / JUMP_DURATION);
      return {
        x:
          this.game.abilities.jump.from.x +
          (this.game.abilities.jump.to.x - this.game.abilities.jump.from.x) * t,
        y:
          this.game.abilities.jump.from.y +
          (this.game.abilities.jump.to.y - this.game.abilities.jump.from.y) *
            t -
          Math.sin(t * Math.PI) * TILE * 0.65,
      };
    }
    if (entity !== this.game.player.entity && entity.wallHop) {
      const h = entity.wallHop,
        t = Math.min(1, h.elapsed / 0.5);
      return {
        x: h.from.x + (h.to.x - h.from.x) * t,
        y:
          h.from.y +
          (h.to.y - h.from.y) * t -
          Math.sin(t * Math.PI) * TILE * 0.5,
      };
    }
    const d = DIRS[entity.dir];
    return {
      x: (entity.col + 0.5) * TILE + d.x * entity.progress,
      y: (entity.row + 0.5) * TILE + d.y * entity.progress,
    };
  }

  canGo(entity, dir) {
    const d = DIRS[dir];
    return this.game.maze.walkable(entity.col + d.x, entity.row + d.y);
  }

  reverse(entity) {
    if (entity.progress > 0) {
      const d = DIRS[entity.dir];
      entity.col += d.x;
      entity.row += d.y;
      entity.progress = TILE - entity.progress;
    }
    entity.dir = OPPOSITE[entity.dir];
  }

  move(entity, distance, choose, onArrival) {
    entity.moving = false;
    while (distance > 0.000001 && this.game.state === "playing") {
      if (entity.progress < 0.000001) {
        const direction = choose(entity);
        if (!direction) break;
        entity.dir = direction;
      }
      entity.moving = true;
      const step = Math.min(distance, TILE - entity.progress);
      entity.progress += step;
      distance -= step;
      if (entity.progress >= TILE - 0.000001) {
        const d = DIRS[entity.dir];
        entity.col += d.x;
        entity.row += d.y;
        entity.progress = 0;
        if (onArrival) onArrival(entity);
      }
    }
  }

  distanceField(target) {
    const distance = Array.from({ length: ROWS }, () =>
      Array(COLS).fill(Infinity),
    );
    const queue = [[target.col, target.row]];
    distance[target.row][target.col] = 0;
    for (let i = 0; i < queue.length; i++) {
      const [x, y] = queue[i];
      for (const d of Object.values(DIRS)) {
        const nx = x + d.x,
          ny = y + d.y;
        if (this.game.maze.walkable(nx, ny) && distance[ny][nx] === Infinity) {
          distance[ny][nx] = distance[y][x] + 1;
          queue.push([nx, ny]);
        }
      }
    }
    return distance;
  }

  nearestRoad(target) {
    let best = Infinity,
      result = {
        col: this.game.player.entity.col,
        row: this.game.player.entity.row,
      };
    for (let row = 0; row < ROWS; row++)
      for (let col = 0; col < COLS; col++)
        if (this.game.maze.walkable(col, row)) {
          const d = Math.abs(col - target.col) + Math.abs(row - target.row);
          if (d < best) {
            best = d;
            result = { col, row };
          }
        }
    return result;
  }
}
