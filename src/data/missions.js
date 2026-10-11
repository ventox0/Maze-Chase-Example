import { CHALLENGE_RULES } from "./challenges.js";

// Sabit kimlikler kayıt ve ödüller için sözleşmedir; sıra değişse de kimlik değişmez.
export const MISSION_CATEGORIES = [
  "score",
  "pellets",
  "ghosts",
  "abilities",
  "levels",
  "challenges",
];
const entries = [];
function series(kind, metric, category, targets) {
  targets.forEach((target, index) =>
    entries.push({
      id: `${kind}-${index + 1}`,
      kind,
      metric,
      category,
      target,
      tier: index + 1,
      reward: (index + 1) * 75,
    }),
  );
}
series(
  "earned",
  "earned",
  "score",
  [500, 1000, 2500, 5000, 10000, 20000, 40000, 75000, 125000, 200000],
);
series(
  "runScore",
  "bestRunScore",
  "score",
  [100, 500, 1000, 2000, 3500, 5000, 8000, 12000, 16000, 25000],
);
series(
  "smallPellets",
  "smallPellets",
  "pellets",
  [25, 75, 150, 300, 600, 1000, 2000, 3500, 5000, 10000],
);
series(
  "powerPellets",
  "powerPellets",
  "pellets",
  [1, 4, 8, 16, 30, 50, 75, 100, 150, 250],
);
series(
  "magnetPellets",
  "magnetPellets",
  "pellets",
  [10, 25, 50, 100, 200, 400, 700, 1000, 1500, 2500],
);
series("ghosts", "ghosts", "ghosts", [1, 3, 5, 10, 20, 35, 50, 75, 100, 150]);
series("levels", "levels", "levels", [1, 3, 5, 10, 20, 35, 50, 75, 100, 150]);
series(
  "challenges",
  "challenges",
  "challenges",
  [1, 2, 3, 5, 8, 12, 20, 30, 40, 60],
);
for (const [ability, targets] of [
  ["jump", [1, 5, 15]],
  ["magnet", [1, 5, 15]],
  ["boost", [3, 10]],
  ["shield", [3, 10]],
])
  targets.forEach((target, index) =>
    entries.push({
      id: `skill-${ability}-${index + 1}`,
      kind: "skill",
      metric: `skill-${ability}`,
      category: "abilities",
      target,
      ability,
      tier: index + 1,
      reward: (index + 1) * 150,
    }),
  );
for (const rule of CHALLENGE_RULES)
  entries.push({
    id: `rule-${rule}`,
    kind: "rule",
    metric: `rule-${rule}`,
    category: "challenges",
    target: 1,
    rule,
    tier: 1,
    reward: 500,
  });

const kinds = [...new Set(entries.map((m) => m.kind))];
const ordered = Array.from({ length: 10 }, (_, tier) =>
  kinds.map((kind) => entries.filter((m) => m.kind === kind)[tier]),
).flat();
export const MISSIONS = Object.freeze(
  ordered.map((mission, index) =>
    Object.freeze({ ...mission, number: index + 1 }),
  ),
);
export const MISSION_METRICS = Object.freeze(
  [...new Set(MISSIONS.map((m) => m.metric))].filter((k) => k !== "earned"),
);
export const MISSION_COUNTERS = Object.freeze(
  MISSION_METRICS.filter((k) => k !== "bestRunScore"),
);
export const MISSION_BY_ID = new Map(MISSIONS.map((m) => [m.id, m]));
export const MISSION_STORAGE_KEY = "maze-chaser-missions-v1";
