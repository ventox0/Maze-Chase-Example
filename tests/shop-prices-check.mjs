import assert from "node:assert/strict";
import { sandbox, stored } from "./helpers/game-harness.mjs";
import { SHOP_ITEMS } from "../src/data/shop.js";
import { PointWallet } from "../src/storage/PointWallet.js";
import { AccountStore } from "../server/AccountStore.js";
import { WALLET_KEY } from "../src/data/account-profile.js";

const game = sandbox.game, wallet = game.wallet;
const suits = SHOP_ITEMS.filter((item) => item.exclusive);
assert.equal(suits.length, 28);
for (const item of suits) assert.equal(item.price, item.previousPrice * 3);
assert.equal(SHOP_ITEMS.find((item) => item.id === "sports_singlet").price, 2500);
assert.equal(SHOP_ITEMS.find((item) => item.id === "crown").price, 6000);

// Etiket değişince eski fiyatla alınan her tam giysinin kaydı hâlâ yüklenir.
for (const item of suits) {
  const legacy = wallet.empty();
  legacy.totalEarned = 100000;
  legacy.balance = legacy.totalEarned - item.previousPrice;
  legacy.owned = [item.id];
  legacy.equipped.outfit = item.id;
  legacy.runs = { "run-suit-prices-old": 100000 };
  assert.equal(wallet.validate(legacy), true, item.id);
  stored.set(wallet.key, JSON.stringify(legacy));
  wallet.load();
  assert.equal(wallet.profile.balance, legacy.balance);
  assert.equal(wallet.profile.equipped.outfit, item.id);
  assert.deepEqual(wallet.profile.owned, [item.id]);
  const newcomer = suits.find((other) => other.id !== item.id);
  assert.equal(game.shop.purchase(newcomer.id), true);
  assert.equal(wallet.profile.balance, legacy.balance - newcomer.price);
  assert.equal(wallet.profile.purchasePrices[item.id], item.previousPrice);
  assert.equal(wallet.profile.purchasePrices[newcomer.id], newcomer.price);
  const reloaded = new PointWallet(game);
  reloaded.load();
  assert.deepEqual(reloaded.profile, wallet.profile);
  const invalid = wallet.clone();
  invalid.purchasePrices[item.id] = 1;
  assert.equal(wallet.validate(invalid), false);
}
console.log("PASS all 28 suits cost 3×; old ownership/balances and mixed old/new purchases survive reload");

// Sunucu istemcinin ödediğini söylediği bedelden bağımsız güncel fiyatı tahsil eder.
const item = suits[0], newcomer = suits[1], legacy = wallet.empty();
Object.assign(legacy, {
  totalEarned: 200000, balance: 200000 - item.previousPrice,
  owned: [item.id], equipped: { outfit: item.id, head: null },
});
const serverProfile = { data: { [WALLET_KEY]: JSON.stringify(legacy) } };
const incoming = JSON.parse(JSON.stringify(legacy));
incoming.owned.push(newcomer.id);
incoming.balance -= newcomer.previousPrice;
const store = Object.create(AccountStore.prototype);
store.mergeWallet(serverProfile, incoming);
const result = JSON.parse(serverProfile.data[WALLET_KEY]);
assert.equal(result.balance, legacy.balance - newcomer.price);
assert.deepEqual(result.purchasePrices, {
  [item.id]: item.previousPrice, [newcomer.id]: newcomer.price,
});
assert.equal(wallet.validate(result), true);
store.mergeWallet(serverProfile, incoming);
assert.deepEqual(JSON.parse(serverProfile.data[WALLET_KEY]), result);
console.log("PASS server preserves old paid price, charges new catalog price once and ignores client price claims");
