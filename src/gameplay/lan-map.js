import { createLevelMap } from "./map-generation.js";
import { LAN_COLS, LAN_ROWS, MAX_LAN_GHOSTS, LAN_SPAWNS } from "../data/lan.js";
import { GHOSTS } from "../data/ghosts.js";

export function createLanMap(level, powerSeed = level) {
  return createLevelMap(level, {
    seed: level,
    styleLevel: level,
    powerSeed,
    powerExcluded: LAN_SPAWNS,
    cols: LAN_COLS,
    rows: LAN_ROWS,
  });
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
