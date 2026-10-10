import { BASE_MAP } from "./maps.js";

export const TILE = 24,
  COLS = BASE_MAP[0].length,
  ROWS = BASE_MAP.length;

export const WIDTH = COLS * TILE,
  HEIGHT = ROWS * TILE,
  POWER_DURATION = 10;

export const MAX_LEVEL = 1000,
  MAX_GHOSTS = 4,
  GHOST_RESPAWN_DELAY = 3;

export const LIFE_PELLET = {
  col: Math.floor(COLS / 2),
  row: Math.floor(ROWS / 2),
};

export const DIRS = {
  right: { x: 1, y: 0, angle: 0 },
  down: { x: 0, y: 1, angle: Math.PI / 2 },
  left: { x: -1, y: 0, angle: Math.PI },
  up: { x: 0, y: -1, angle: -Math.PI / 2 },
};

export const OPPOSITE = {
  right: "left",
  left: "right",
  up: "down",
  down: "up",
};

export const KEYS = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  a: "left",
  s: "down",
  d: "right",
};

export const STEP = 1 / 120;
