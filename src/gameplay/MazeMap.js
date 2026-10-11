import { GameComponent } from "../core/GameComponent.js";
import {
  COLS,
  HEIGHT,
  LIFE_PELLET,
  POWER_DURATION,
  ROWS,
  TILE,
  WIDTH,
} from "../data/config.js";
import { BASE_MAP, MAP_STYLES } from "../data/maps.js";

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
    return MAP_STYLES[number <= 1 ? 0 : 1 + ((number - 2) % 4)];
  }

  mapRandom(number) {
    let seed = (Math.imul(number >>> 0, 0x9e3779b1) ^ 0xa511e9b3) >>> 0;
    return () => {
      seed = (seed + 0x6d2b79f5) >>> 0;
      let n = Math.imul(seed ^ (seed >>> 15), seed | 1);
      n ^= n + Math.imul(n ^ (n >>> 7), n | 61);
      return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
    };
  }

  createLevelMap(number, generation = null) {
    if (number <= 1 && !generation) return BASE_MAP.map((row) => row.slice());
    const random = this.mapRandom(generation?.seed ?? number),
      style = this.mapStyle(generation?.styleLevel ?? number);
    const grid = Array.from({ length: ROWS }, () => Array(COLS).fill(1));
    const directions = [
      [2, 0],
      [-2, 0],
      [0, 2],
      [0, -2],
    ];
    const inside = (x, y) => x > 0 && x < COLS - 1 && y > 0 && y < ROWS - 1;
    const choose = (list) => list[Math.floor(random() * list.length)];
    const stack = [{ x: 1, y: 1 }];
    grid[1][1] = 0;
    while (stack.length) {
      const node = stack[stack.length - 1];
      const options = directions.filter(
        ([dx, dy]) =>
          inside(node.x + dx, node.y + dy) &&
          grid[node.y + dy][node.x + dx] === 1,
      );
      if (!options.length) {
        stack.pop();
        continue;
      }
      const preferred = options.filter(([dx, dy]) =>
        style.axis === "horizontal"
          ? dx !== 0
          : style.axis === "vertical"
            ? dy !== 0
            : true,
      );
      const [dx, dy] = choose(
        preferred.length && random() < 0.78 ? preferred : options,
      );
      grid[node.y + dy / 2][node.x + dx / 2] = 0;
      grid[node.y + dy][node.x + dx] = 0;
      stack.push({ x: node.x + dx, y: node.y + dy });
    }
    const nodes = [];
    for (let y = 1; y < ROWS - 1; y += 2)
      for (let x = 1; x < COLS - 1; x += 2) nodes.push({ x, y });
    for (let i = nodes.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [nodes[i], nodes[j]] = [nodes[j], nodes[i]];
    }
    for (const { x, y } of nodes) {
      const neighbors = directions.filter(([dx, dy]) => inside(x + dx, y + dy));
      if (
        neighbors.filter(([dx, dy]) => grid[y + dy / 2][x + dx / 2] === 0)
          .length !== 1
      )
        continue;
      const walls = neighbors.filter(
        ([dx, dy]) => grid[y + dy / 2][x + dx / 2] === 1,
      );
      if (walls.length) {
        const [dx, dy] = choose(walls);
        grid[y + dy / 2][x + dx / 2] = 0;
      }
    }
    // Ek bağlantılar kovalamacaya kavşaklar ve kaçış seçenekleri verir.
    const joins = [];
    for (const { x, y } of nodes)
      for (const [dx, dy] of [
        [2, 0],
        [0, 2],
      ]) {
        if (inside(x + dx, y + dy) && grid[y + dy / 2][x + dx / 2] === 1)
          joins.push({ x: x + dx / 2, y: y + dy / 2 });
      }
    for (let i = 0; i < style.loops && joins.length; i++) {
      const j = Math.floor(random() * joins.length),
        cell = joins.splice(j, 1)[0];
      grid[cell.y][cell.x] = 0;
    }
    if (style.id === "crossroads") {
      for (let x = 1; x < COLS - 1; x++) grid[LIFE_PELLET.row][x] = 0;
      for (let y = 1; y < ROWS - 1; y++) grid[y][LIFE_PELLET.col] = 0;
    } else if (style.id === "rings") {
      for (let x = 1; x < COLS - 1; x++) {
        grid[1][x] = 0;
        grid[ROWS - 2][x] = 0;
      }
      for (let y = 1; y < ROWS - 1; y++) {
        grid[y][1] = 0;
        grid[y][COLS - 2] = 0;
      }
    }
    // Merkezde dört hayaletin doğumu, can yemi ve oyuncu başlangıcı daima açıktır.
    for (let y = 8; y <= 11; y++) for (let x = 8; x <= 12; x++) grid[y][x] = 0;
    for (let x = 9; x <= 11; x++) grid[17][x] = 0;
    for (let y = 1; y < ROWS - 1; y++)
      for (let x = 1; x < COLS - 1; x++) if (grid[y][x] === 0) grid[y][x] = 2;
    for (let y = 8; y <= 11; y++) for (let x = 8; x <= 12; x++) grid[y][x] = 0;
    grid[17][10] = 0;
    for (const [x, y] of [
      [1, 1],
      [COLS - 2, 1],
      [1, ROWS - 2],
      [COLS - 2, ROWS - 2],
    ])
      grid[y][x] = 3;
    return grid;
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
    this.wallLayer = document.createElement("canvas");
    this.wallLayer.width = WIDTH * 2;
    this.wallLayer.height = HEIGHT * 2;
    const c = this.wallLayer.getContext("2d");
    c.scale(2, 2);
    c.fillStyle = "#0d1025";
    for (let y = 0; y < ROWS; y++)
      for (let x = 0; x < COLS; x++)
        if (this.grid[y][x] === 1) c.fillRect(x * TILE, y * TILE, TILE, TILE);
    const style = this.mapStyle(
      this.game.challenges.active
        ? this.game.challenges.current.styleLevel
        : this.game.level,
    );
    c.strokeStyle = style.color;
    c.lineWidth = 1.5;
    c.lineJoin = "round";
    c.lineCap = "round";
    c.shadowColor = style.glow;
    c.shadowBlur = 7;
    c.beginPath();
    for (let y = 0; y < ROWS; y++)
      for (let x = 0; x < COLS; x++) {
        if (this.grid[y][x] !== 1) continue;
        const left = x * TILE + 3,
          right = (x + 1) * TILE - 3,
          top = y * TILE + 3,
          bottom = (y + 1) * TILE - 3;
        const exposed = (dx, dy) =>
          y + dy < 0 ||
          y + dy >= ROWS ||
          x + dx < 0 ||
          x + dx >= COLS ||
          this.grid[y + dy][x + dx] !== 1;
        const t = exposed(0, -1),
          b = exposed(0, 1),
          l = exposed(-1, 0),
          r = exposed(1, 0),
          radius = 4;
        if (t) {
          c.moveTo(l ? left + radius : x * TILE, top);
          c.lineTo(r ? right - radius : (x + 1) * TILE, top);
        }
        if (b) {
          c.moveTo(l ? left + radius : x * TILE, bottom);
          c.lineTo(r ? right - radius : (x + 1) * TILE, bottom);
        }
        if (l) {
          c.moveTo(left, t ? top + radius : y * TILE);
          c.lineTo(left, b ? bottom - radius : (y + 1) * TILE);
        }
        if (r) {
          c.moveTo(right, t ? top + radius : y * TILE);
          c.lineTo(right, b ? bottom - radius : (y + 1) * TILE);
        }
        if (t && l) {
          c.moveTo(left, top + radius);
          c.quadraticCurveTo(left, top, left + radius, top);
        }
        if (t && r) {
          c.moveTo(right - radius, top);
          c.quadraticCurveTo(right, top, right, top + radius);
        }
        if (b && l) {
          c.moveTo(left, bottom - radius);
          c.quadraticCurveTo(left, bottom, left + radius, bottom);
        }
        if (b && r) {
          c.moveTo(right - radius, bottom);
          c.quadraticCurveTo(right, bottom, right, bottom - radius);
        }
      }
    c.stroke();
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
