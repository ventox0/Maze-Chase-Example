import { TILE } from "./config.js";

export const JUMP_DURATION = 0.34,
  JUMP_COOLDOWN = 8,
  MAGNET_DURATION = 5,
  MAGNET_COOLDOWN = 14,
  MAGNET_RADIUS = 3 * TILE;

export const BOOST_DURATION = 3,
  BOOST_COOLDOWN = 12,
  BOOST_MULTIPLIER = 1.65,
  SHIELD_DURATION = 4,
  SHIELD_COOLDOWN = 18;

export const ABILITIES = {
  jump: { name: "Duvar atlayışı", cooldown: JUMP_COOLDOWN, duration: 0 },
  magnet: {
    name: "Mıknatıs",
    cooldown: MAGNET_COOLDOWN,
    duration: MAGNET_DURATION,
  },
  boost: { name: "Boost", cooldown: BOOST_COOLDOWN, duration: BOOST_DURATION },
  shield: {
    name: "Hasar görmezlik",
    cooldown: SHIELD_COOLDOWN,
    duration: SHIELD_DURATION,
  },
};
