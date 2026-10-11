import { POWER_DURATION } from "./config.js";

// Aynı tohum ve zorluk aynı kuralı, haritayı ve kadroyu üretir.
export const CHALLENGE_RULES = [
  "noSkills",
  "powerLast",
  "noPower",
  "oneLife",
  "timeTrial",
  "shortPower",
  "fastGhosts",
  "limitedSkills",
  "ghostHunt",
  "pacifist",
];
export const CHALLENGE_DIFFICULTIES = {
  easy: { levels: [2, 4], reward: 300, seconds: 240 },
  normal: { levels: [5, 8], reward: 500, seconds: 210 },
  hard: { levels: [9, 14], reward: 800, seconds: 180 },
};
export const CHALLENGE_HIGH_KEY = "maze-chaser-challenge-high-v1";

export function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let n = Math.imul(state ^ (state >>> 15), state | 1);
    n ^= n + Math.imul(n ^ (n >>> 7), n | 61);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
}
export function generateChallenge(seed, difficulty = "normal") {
  const tier =
    CHALLENGE_DIFFICULTIES[difficulty] || CHALLENGE_DIFFICULTIES.normal;
  const random = seededRandom(seed);
  const rule = CHALLENGE_RULES[Math.floor(random() * CHALLENGE_RULES.length)];
  return {
    seed: seed >>> 0,
    code: (seed >>> 0).toString(16).padStart(8, "0").toUpperCase(),
    difficulty: Object.hasOwn(CHALLENGE_DIFFICULTIES, difficulty)
      ? difficulty
      : "normal",
    rule,
    level:
      tier.levels[0] +
      Math.floor(random() * (tier.levels[1] - tier.levels[0] + 1)),
    styleLevel: 2 + Math.floor(random() * 4),
    lives: rule === "oneLife" ? 1 : 3,
    timeLimit: rule === "timeTrial" ? tier.seconds : 0,
    reward: tier.reward,
    abilityLimit:
      rule === "limitedSkills"
        ? { easy: 8, normal: 6, hard: 4 }[difficulty] || 6
        : 0,
    ghostTarget:
      rule === "ghostHunt"
        ? { easy: 2, normal: 3, hard: 4 }[difficulty] || 3
        : 0,
    powerDuration: rule === "shortPower" ? 4 : POWER_DURATION,
    ghostMultiplier: rule === "fastGhosts" ? 1.2 : 1,
  };
}

// Köşedeki güç yemleri geçişi kapatmamalı: iki komşuyu iç köşeden birleştir.
// Böylece güç yemlerini almadan bütün küçük yemlere ulaşmak her tohumda mümkün.
export function applyChallengeRule(grid, rule) {
  if (rule === "noPower") {
    for (const row of grid)
      for (let x = 0; x < row.length; x++) if (row[x] === 3) row[x] = 2;
  } else if (rule === "powerLast") {
    const bottom = grid.length - 2,
      right = grid[0].length - 2;
    for (const [x, y, dx, dy] of [
      [1, 1, 1, 1],
      [right, 1, -1, 1],
      [1, bottom, 1, -1],
      [right, bottom, -1, -1],
    ])
      for (const [cx, cy] of [
        [x + dx, y],
        [x, y + dy],
        [x + dx, y + dy],
      ])
        grid[cy][cx] = 2;
  }
  return grid;
}
