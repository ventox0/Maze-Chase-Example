import { SHOP_ITEMS } from "./shop.js";
import { MISSION_BY_ID } from "./missions.js";

// Yeni görev kostümleri katalogda unlockMission ile tanımlanır. Puan fiyatı yoktur.
export function isMissionCosmetic(item) {
  return typeof item?.unlockMission === "string";
}

export function cosmeticCost(item) {
  return isMissionCosmetic(item) ? 0 : item.price;
}

export function missionCosmetics(missionId) {
  return SHOP_ITEMS.filter((item) => item.unlockMission === missionId);
}

// Ödül kaydı ve envanter aynı cüzdanda saklanır; eski görevler de hak kazandırır.
export function grantMissionCosmetics(profile) {
  let changed = false;
  for (const item of SHOP_ITEMS) {
    if (
      isMissionCosmetic(item) &&
      MISSION_BY_ID.has(item.unlockMission) &&
      profile.missionRewards?.includes(item.unlockMission) &&
      !profile.owned.includes(item.id)
    ) {
      profile.owned.push(item.id);
      changed = true;
    }
  }
  return changed;
}
