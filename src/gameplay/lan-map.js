import { createLevelMap } from "./map-generation.js";
import { LAN_COLS, LAN_ROWS, MAX_LAN_GHOSTS, LAN_SPAWNS } from "../data/lan.js";
import { LAN_MAP_OPTIONS } from "../data/lan-options.js";
import { mapRandom } from "./map-generation.js";
import { GHOSTS } from "../data/ghosts.js";

export function createLanMap(level, powerSeed = level, options = {}) {
  const selected = LAN_MAP_OPTIONS.find((m) => m.id === options.map);
  const grid = createLevelMap(level, {
    seed: level,
    styleLevel: selected?.styleLevel ?? level,
    powerSeed,
    powerExcluded: LAN_SPAWNS,
    cols: LAN_COLS,
    rows: LAN_ROWS,
  });
  return options.mode === "race" ? symmetricRaceMap(grid, powerSeed) : grid;
}

// Dört temel hayalet + iki uzman. İlk haritada Rush/Moss, ilerledikçe Dozer/Shade açılır.
export function lanGhosts(level) {
  const specialists = GHOSTS.slice(4).filter(
    (g) => g.unlock <= Math.max(4, level),
  );
  const start = Math.max(0, level - 4) % specialists.length;
  return [
    ...GHOSTS.slice(0, 4),
    specialists[start],
    specialists[(start + 1) % specialists.length],
  ].slice(0, MAX_LAN_GHOSTS);
}

// Yarışta dört başlangıç aynı duvar, yem ve merkeze erişim düzenine sahiptir.
// Dört güç yemi simetriktir; beşinci ortak merkez alanında rastgele yerleşir.
function symmetricRaceMap(source, seed) {
  const maxX = LAN_COLS - 1,
    maxY = LAN_ROWS - 1;
  const orbit = (x, y) => [
    [x, y],
    [maxX - x, y],
    [x, maxY - y],
    [maxX - x, maxY - y],
  ];
  const grid = source.map((row, y) =>
    row.map((_, x) => {
      const values = orbit(x, y).map(([a, b]) => source[b][a]);
      return values.every((v) => v === 1) ? 1 : values.includes(0) ? 0 : 2;
    }),
  );
  for (const p of LAN_SPAWNS) grid[p.row][p.col] = 0;
  const center = [maxX / 2, maxY / 2];
  const random = mapRandom(seed ^ 0x72616365);
  const central = [];
  for (let y = center[1] - 2; y <= center[1] + 2; y++)
    for (let x = center[0] - 2; x <= center[0] + 2; x++)
      if (grid[y][x] !== 1) {
        grid[y][x] = 2;
        central.push([x, y]);
      }
  const extra = central[Math.floor(random() * central.length)];
  grid[extra[1]][extra[0]] = 3;
  const candidates = [];
  for (let y = 1; y < maxY / 2; y++)
    for (let x = 1; x < maxX / 2; x++)
      if (
        grid[y][x] === 2 &&
        Math.abs(x - center[0]) + Math.abs(y - center[1]) > 10
      )
        candidates.push([x, y]);
  while (candidates.length) {
    const [x, y] = candidates.splice(
      Math.floor(random() * candidates.length),
      1,
    )[0];
    const cells = orbit(x, y);
    for (const [a, b] of cells) grid[b][a] = 3;
    // Güç yemleri sona bırakıldığında da bütün diğer yemlere ulaşılabilir.
    const seen = new Set(),
      queue = [[LAN_SPAWNS[0].col, LAN_SPAWNS[0].row]];
    for (let i = 0; i < queue.length; i++) {
      const [a, b] = queue[i],
        key = b * LAN_COLS + a;
      if (
        seen.has(key) ||
        grid[b]?.[a] === undefined ||
        [1, 3].includes(grid[b][a])
      )
        continue;
      seen.add(key);
      queue.push([a + 1, b], [a - 1, b], [a, b + 1], [a, b - 1]);
    }
    if (grid.flat().filter((v) => v !== 1 && v !== 3).length === seen.size)
      return grid;
    for (const [a, b] of cells) grid[b][a] = 2;
  }
  throw new Error("No fair power-pellet layout");
}
