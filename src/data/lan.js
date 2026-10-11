// LAN sahası ve kadro limiti tek oyunculu ayarlardan bağımsızdır.
export const LAN_COLS = 41,
  LAN_ROWS = 35,
  MAX_LAN_GHOSTS = 6;
export const LAN_LIFE_PELLET = {
  col: Math.floor(LAN_COLS / 2),
  row: Math.floor(LAN_ROWS / 2),
};
export const LAN_SPAWNS = [
  { col: 1, row: 3, dir: "down" },
  { col: LAN_COLS - 2, row: LAN_ROWS - 4, dir: "up" },
  { col: LAN_COLS - 2, row: 3, dir: "down" },
  { col: 1, row: LAN_ROWS - 4, dir: "up" },
];

export const LAN_REWARD_PERCENT = 50;
