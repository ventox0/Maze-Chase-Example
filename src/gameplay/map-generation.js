import { distributePowerPellets } from "./power-pellets.js";
import { COLS, ROWS } from "../data/config.js";
import { BASE_MAP, MAP_STYLES } from "../data/maps.js";

// Aynı deterministik labirent üretimi tek oyunculu ve LAN oyununda paylaşılır.
export function mapStyle(number) {
  return MAP_STYLES[number <= 1 ? 0 : 1 + ((number - 2) % 4)];
}

export function mapRandom(number) {
  let seed = (Math.imul(number >>> 0, 0x9e3779b1) ^ 0xa511e9b3) >>> 0;
  return () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let n = Math.imul(seed ^ (seed >>> 15), seed | 1);
    n ^= n + Math.imul(n ^ (n >>> 7), n | 61);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
}

export function createLevelMap(number, generation = null) {
  const powerRandom = mapRandom(
    (generation?.powerSeed ?? generation?.seed ?? number) ^ 0x726f6164,
  );
  if (
    number <= 1 &&
    generation?.seed === undefined &&
    generation?.cols === undefined
  )
    return distributePowerPellets(
      BASE_MAP.map((row) => row.slice()),
      powerRandom,
    );
  const cols = generation?.cols ?? COLS,
    rows = generation?.rows ?? ROWS,
    center = { col: Math.floor(cols / 2), row: Math.floor(rows / 2) };
  const random = mapRandom(generation?.seed ?? number),
    style = mapStyle(generation?.styleLevel ?? number);
  const grid = Array.from({ length: rows }, () => Array(cols).fill(1));
  const directions = [
    [2, 0],
    [-2, 0],
    [0, 2],
    [0, -2],
  ];
  const inside = (x, y) => x > 0 && x < cols - 1 && y > 0 && y < rows - 1;
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
  for (let y = 1; y < rows - 1; y += 2)
    for (let x = 1; x < cols - 1; x += 2) nodes.push({ x, y });
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
  for (
    let i = 0;
    i < Math.round((style.loops * (cols * rows)) / (COLS * ROWS)) &&
    joins.length;
    i++
  ) {
    const j = Math.floor(random() * joins.length),
      cell = joins.splice(j, 1)[0];
    grid[cell.y][cell.x] = 0;
  }
  if (style.id === "crossroads") {
    for (let x = 1; x < cols - 1; x++) grid[center.row][x] = 0;
    for (let y = 1; y < rows - 1; y++) grid[y][center.col] = 0;
  } else if (style.id === "rings") {
    for (let x = 1; x < cols - 1; x++) {
      grid[1][x] = 0;
      grid[rows - 2][x] = 0;
    }
    for (let y = 1; y < rows - 1; y++) {
      grid[y][1] = 0;
      grid[y][cols - 2] = 0;
    }
  }
  // Merkez odası ve başlangıç yolu seçilen saha boyutuna göre açılır.
  for (let y = center.row - 3; y <= center.row; y++)
    for (let x = center.col - 2; x <= center.col + 2; x++) grid[y][x] = 0;
  for (let x = center.col - 1; x <= center.col + 1; x++)
    grid[center.row + 6][x] = 0;
  for (let y = 1; y < rows - 1; y++)
    for (let x = 1; x < cols - 1; x++) if (grid[y][x] === 0) grid[y][x] = 2;
  for (let y = center.row - 3; y <= center.row; y++)
    for (let x = center.col - 2; x <= center.col + 2; x++) grid[y][x] = 0;
  grid[center.row + 6][center.col] = 0;
  return distributePowerPellets(grid, powerRandom, generation?.powerExcluded);
}
