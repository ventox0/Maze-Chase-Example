import assert from "node:assert/strict";
import { createLanMap, lanGhosts } from "../src/gameplay/lan-map.js";
import { createLevelMap } from "../src/gameplay/map-generation.js";
import {
  LAN_COLS,
  LAN_ROWS,
  LAN_SPAWNS,
  LAN_LIFE_PELLET,
  MAX_LAN_GHOSTS,
} from "../src/data/lan.js";
import { COLS, ROWS, MAX_GHOSTS, DIRS, TILE } from "../src/data/config.js";
import { LanWorld } from "../server/LanWorld.js";
function world(level = 1) {
  const w = new LanWorld("coop");
  for (let slot = 0; slot < 4; slot++) {
    const p = w.addPlayer("p" + slot, "Pac " + slot, slot);
    p.connected = true;
  }
  w.level = level;
  w.loadRound();
  w.update(3);
  return w;
}
assert.equal(MAX_GHOSTS, 4);
assert.equal(COLS, 21);
assert.equal(ROWS, 23);
assert.equal(createLevelMap(1).length, ROWS);
const layouts = new Set();
for (const level of [
  ...Array.from({ length: 40 }, (_, i) => i + 1),
  250,
  999,
  1000,
]) {
  const w = world(level),
    grid = w.maze.grid,
    fields = w.movement.distanceField(LAN_LIFE_PELLET);
  assert.equal(grid.length, LAN_ROWS);
  assert.ok(grid.every((r) => r.length === LAN_COLS));
  assert.equal(fields.length, LAN_ROWS);
  assert.equal(fields[0].length, LAN_COLS);
  for (let row = 0; row < LAN_ROWS; row++)
    for (let col = 0; col < LAN_COLS; col++) {
      if (
        row === 0 ||
        col === 0 ||
        row === LAN_ROWS - 1 ||
        col === LAN_COLS - 1
      )
        assert.equal(grid[row][col], 1);
      if (grid[row][col] !== 1)
        assert.ok(
          Number.isFinite(fields[row][col]),
          `level ${level}: disconnected road ${col},${row}`,
        );
    }
  assert.equal(grid.flat().filter((c) => c === 3).length, 5);
  assert.equal(grid[LAN_LIFE_PELLET.row][LAN_LIFE_PELLET.col], 0);
  assert.equal(w.ghosts.entities.length, MAX_LAN_GHOSTS);
  assert.equal(new Set(w.ghosts.entities.map((g) => g.id)).size, 6);
  assert.equal(
    new Set(w.ghosts.entities.map((g) => `${g.col},${g.row}`)).size,
    6,
  );
  assert.ok(w.ghosts.entities.every((g) => w.maze.walkable(g.col, g.row)));
  for (const spawn of LAN_SPAWNS)
    assert.ok(w.maze.walkable(spawn.col, spawn.row));
  assert.equal(w.pellets, grid.flat().filter((c) => c === 2 || c === 3).length);
  assert.deepEqual(createLanMap(level), createLanMap(level));
  layouts.add(
    grid.map((row) => row.map((c) => (c === 1 ? 1 : 0)).join("")).join(""),
  );
  const snap = w.snapshot();
  assert.equal(snap.cols, LAN_COLS);
  assert.equal(snap.rows, LAN_ROWS);
  assert.equal(snap.ghosts.length, 6);
}
assert.equal(layouts.size, 43);
console.log(
  "PASS 43 large LAN maps: connected roads, closed borders, five power pellets, distinct spawns and six ghosts; solo unchanged",
);
assert.deepEqual(
  lanGhosts(1).map((g) => g.id),
  ["blaze", "pinky", "glitch", "cinder", "rush", "moss"],
);
assert.ok(lanGhosts(5).some((g) => g.id === "dozer"));
assert.ok(lanGhosts(6).some((g) => g.id === "shade"));
console.log(
  "PASS six unique ghosts per level, with Dozer and Shade joining the specialist rotation",
);
{
  const w = world(),
    p = w.players.get("p1");
  p.invulnerableUntil = 1e6;
  w.context(p);
  const nearest = w.movement.nearestRoad({
    col: LAN_COLS - 2,
    row: LAN_ROWS - 2,
  });
  assert.equal(nearest.col, LAN_COLS - 2);
  assert.equal(nearest.row, LAN_ROWS - 2);
  for (const ghost of w.ghosts.entities) {
    ghost.releaseAt = 0;
    ghost.skillReadyAt = 1e6;
    Object.assign(ghost, { col: LAN_COLS - 4, row: LAN_ROWS - 4, progress: 0 });
    const dir = w.ghosts.chooseGhostDirection(ghost);
    assert.ok(dir);
    const d = DIRS[dir];
    assert.ok(w.maze.walkable(ghost.col + d.x, ghost.row + d.y));
  }
  const before = w.pellets;
  p.abilities.magnetUntil = 5;
  w.updatePlayer(p, 0);
  assert.ok(w.pellets < before);
  assert.ok(p.score > 10);
}
console.log(
  "PASS ghost AI, nearest-road lookup and magnet collection work beyond the solo map boundaries",
);
{
  const w = world(),
    p = w.players.get("p1");
  let spot;
  for (let row = 24; row < LAN_ROWS - 1 && !spot; row++)
    for (let col = 24; col < LAN_COLS - 3 && !spot; col++)
      if (
        w.maze.walkable(col, row) &&
        w.maze.grid[row][col + 1] === 1 &&
        w.maze.walkable(col + 2, row)
      )
        spot = { col, row };
  assert.ok(spot);
  Object.assign(p.entity, {
    ...spot,
    dir: "right",
    next: "right",
    progress: 0,
  });
  p.respawnUntil = 0;
  assert.equal(w.useAbility(p, "q"), true);
  w.updatePlayer(p, 0.35);
  assert.equal(p.entity.col, spot.col + 2);
  assert.equal(p.abilities.jump, null);
  assert.ok(w.maze.walkable(p.entity.col, p.entity.row));
  w.pellets = 1;
  const last = w.maze.grid.findIndex((r) => r.includes(2));
  w.collect(p, w.maze.grid[last].indexOf(2), last);
  assert.equal(w.maze.phase, "bonus");
  assert.equal(w.ghosts.entities.length, 0);
  assert.equal(w.maze.grid[LAN_LIFE_PELLET.row][LAN_LIFE_PELLET.col], 4);
  p.lives = 2;
  w.collect(p, LAN_LIFE_PELLET.col, LAN_LIFE_PELLET.row);
  assert.equal(p.lives, 3);
  assert.equal(w.state, "roundComplete");
  w.level++;
  w.loadRound();
  assert.equal(w.ghosts.entities.length, 6);
  assert.equal(w.maze.grid.length, LAN_ROWS);
}
console.log(
  "PASS jumping in the distant region, the new central life pellet and six-ghost next round",
);
