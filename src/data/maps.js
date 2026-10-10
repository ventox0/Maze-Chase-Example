// Harita: 0 yol, 1 duvar, 2 küçük yem, 3 güç yemi, 4 bölüm sonu can yemi.
export const HALF_MAP = [
  ["1111111111", 1],
  ["1322222222", 0],
  ["1211121112", 1],
  ["1211121112", 1],
  ["1222222222", 1],
  ["1212111112", 1],
  ["1222122222", 0],
  ["1112121110", 1],
  ["1112121000", 0],
  ["1222221000", 0],
  ["1212121000", 0],
  ["1222121110", 0],
  ["1112122222", 0],
  ["1112121112", 1],
  ["1222222222", 1],
  ["1211121112", 1],
  ["1222122222", 0],
  ["1112121210", 0],
  ["1222221212", 1],
  ["1211121112", 1],
  ["1211111112", 1],
  ["1322222222", 0],
  ["1111111111", 1],
];

export const BASE_MAP = HALF_MAP.map(([half, middle]) =>
  [...half, String(middle), ...[...half].reverse()].map(Number),
);

export const MAP_STYLES = [
  { id: "classic", color: "#7964e8", glow: "#6f4eff" },
  {
    id: "streets",
    color: "#48cee6",
    glow: "#16aeca",
    axis: "horizontal",
    loops: 12,
  },
  {
    id: "crossroads",
    color: "#e887dd",
    glow: "#c552b9",
    axis: "vertical",
    loops: 14,
  },
  { id: "rings", color: "#edbe61", glow: "#c89232", axis: "mixed", loops: 10 },
  {
    id: "districts",
    color: "#8fd38b",
    glow: "#57a964",
    axis: "mixed",
    loops: 18,
  },
];
