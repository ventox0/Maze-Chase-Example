import { SHOP_ITEMS } from "./shop.js";

export const LAN_MAP_OPTIONS = [
  { id: "streets", styleLevel: 2, tr: "Neon Sokaklar", en: "Neon Streets" },
  { id: "crossroads", styleLevel: 3, tr: "Kavşaklar", en: "Crossroads" },
  { id: "rings", styleLevel: 4, tr: "Çevre Yolu", en: "Ring Roads" },
];
export const LAN_MODES = ["coop", "race"];
export const LAN_RECONNECT_MS = 30000;
export const LAN_STALE_MS = 6000;
export function normalizeAppearance(value) {
  const outfit = SHOP_ITEMS.find(
    (i) => i.id === value?.outfit && i.category === "outfit",
  );
  const head = SHOP_ITEMS.find(
    (i) => i.id === value?.head && i.category === "head",
  );
  return {
    outfit: outfit?.id || null,
    head: outfit?.exclusive ? null : head?.id || null,
  };
}
// Kadro bir bölüm boyunca sabittir: can kaybı zorluğu düşürmez.
export function lanBalance(count) {
  const players = Math.max(2, Math.min(4, count));
  return {
    players,
    ghostSpeed: 0.9 + (players - 2) * 0.1,
    releaseSpacing: 1.25 - (players - 2) * 0.25,
    skillCooldown: 1.15 - (players - 2) * 0.15,
  };
}
