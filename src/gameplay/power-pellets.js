import { DIRS } from "../data/config.js";

export const POWER_PELLET_COUNT = 5;
export function randomPowerSeed() {
  const seed = new Uint32Array(1);
  if (globalThis.crypto?.getRandomValues)
    return globalThis.crypto.getRandomValues(seed)[0];
  return Math.floor(Math.random() * 0x100000000) >>> 0;
}

// Güç yemleri birbirinden uzak, erişilebilir yollara konur. Bir geçidi kapatan
// hücre seçilmez; böylece "güç yemleri en sona" kuralı zıplama gerektirmez.
export function distributePowerPellets(grid, random, excluded = []) {
  const rows = grid.length,
    cols = grid[0].length;
  const forbidden = new Set(excluded.map(({ col, row }) => `${col},${row}`));
  const candidates = [];
  for (let row = 0; row < rows; row++)
    for (let col = 0; col < cols; col++) {
      if (grid[row][col] === 3) grid[row][col] = 2;
      if (grid[row][col] === 2 && !forbidden.has(`${col},${row}`))
        candidates.push({ col, row });
    }
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  const connectedWithout = (candidate) => {
    const open = (col, row) =>
      col >= 0 &&
      row >= 0 &&
      col < cols &&
      row < rows &&
      grid[row][col] !== 1 &&
      grid[row][col] !== 3 &&
      (col !== candidate.col || row !== candidate.row);
    let total = 0,
      start;
    for (let row = 0; row < rows; row++)
      for (let col = 0; col < cols; col++)
        if (open(col, row)) {
          total++;
          start ||= { col, row };
        }
    if (!start) return false;
    const seen = new Uint8Array(rows * cols),
      queue = [start];
    seen[start.row * cols + start.col] = 1;
    for (let i = 0; i < queue.length; i++)
      for (const d of Object.values(DIRS)) {
        const col = queue[i].col + d.x,
          row = queue[i].row + d.y;
        if (open(col, row) && !seen[row * cols + col]) {
          seen[row * cols + col] = 1;
          queue.push({ col, row });
        }
      }
    return queue.length === total;
  };
  const selected = [];
  for (const spacing of [
    Math.max(3, Math.floor(Math.min(rows, cols) / 4)),
    3,
    2,
  ]) {
    for (const cell of candidates) {
      if (selected.length === POWER_PELLET_COUNT) return grid;
      if (
        grid[cell.row][cell.col] !== 2 ||
        selected.some(
          (p) =>
            Math.abs(p.col - cell.col) + Math.abs(p.row - cell.row) < spacing,
        )
      )
        continue;
      if (!connectedWithout(cell)) continue;
      grid[cell.row][cell.col] = 3;
      selected.push(cell);
    }
  }
  if (selected.length !== POWER_PELLET_COUNT)
    throw new Error("Haritada beş güvenli güç yemi konumu bulunamadı.");
  return grid;
}
