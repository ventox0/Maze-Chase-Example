import { SHOP_ITEMS } from "./shop.js";
import { cosmeticCost } from "./cosmeticRewards.js";

// Envanterin harcanan puanı güncel etiketten değil, gerçek alışveriş bedelinden gelir.
export function purchasePrices(profile) {
  const recorded = profile.purchasePrices === undefined ? {} : profile.purchasePrices;
  if (
    !recorded || typeof recorded !== "object" || Array.isArray(recorded) ||
    Object.keys(recorded).some((id) => !profile.owned.includes(id))
  ) return null;
  for (const previous of [false, true]) {
    const prices = {};
    let spent = 0, valid = true;
    for (const id of profile.owned) {
      const item = SHOP_ITEMS.find((item) => item.id === id);
      if (!item) return null;
      const current = cosmeticCost(item),
        old = current === 0 ? 0 : (item.previousPrice ?? current),
        paid = Object.hasOwn(recorded, id) ? recorded[id] : (previous ? old : current);
      if (!Number.isSafeInteger(paid) || (paid !== current && paid !== old)) {
        valid = false;
        break;
      }
      prices[id] = paid;
      spent += paid;
    }
    if (valid && profile.totalEarned === profile.balance + spent) return prices;
  }
  return null;
}
