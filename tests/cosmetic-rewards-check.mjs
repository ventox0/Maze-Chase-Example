import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sandbox, element } from "./helpers/game-harness.mjs";
import { SHOP_ITEMS } from "../src/data/shop.js";
import { MISSION_BY_ID } from "../src/data/missions.js";
import { PointWallet } from "../src/storage/PointWallet.js";
import { AccountStore } from "../server/AccountStore.js";
import { WALLET_KEY, MISSIONS_KEY } from "../src/data/account-profile.js";

// Geçici katalog kaydı ile gerçek cüzdan/UI/sunucu sınanır; kullanıcı kaydı kullanılmaz.
const item = {
  id: "test_mission_costume", category: "outfit", price: 0,
  unlockMission: "ghosts-3", name: { tr: "Test Kostümü", en: "Test Costume" },
  exclusive: true,
};
SHOP_ITEMS.push(item);
const game = sandbox.game, mission = MISSION_BY_ID.get(item.unlockMission);
const directory = await mkdtemp(join(tmpdir(), "maze-cosmetic-rewards-"));
try {
  game.startGame(1);
  game.wallet.profile.totalEarned = game.wallet.profile.balance = 50000;
  game.wallet.persist(game.wallet.profile);
  assert.equal(game.shop.purchase(item.id), false);
  assert.equal(game.shop.equip(item.id), false);
  assert.equal(game.missions.claim(mission.id), false);
  assert.equal(game.wallet.profile.balance, 50000);
  game.shop.previewId = item.id;
  for (const language of ["tr", "en"]) {
    game.i18n.setLanguage(language);
    game.shop.render();
    assert.equal(element("shop-preview-action").disabled, true);
    assert.match(element("shop-preview-info").textContent, /5/);
    assert.doesNotMatch(element("shop-preview-info").textContent, /shop\.|missions\.|\{\w+\}/);
  }
  game.missions.profile.stats.ghosts = mission.target;
  game.missions.persist();
  // Depolama hatasında ne puan ne de kostüm yarım olarak verilir.
  const setter = localStorage.setItem;
  localStorage.setItem = () => { throw Error("quota"); };
  try {
    assert.equal(game.missions.claim(mission.id), false);
    assert.deepEqual(game.wallet.profile.owned, []);
    assert.equal(game.wallet.profile.balance, 50000);
  } finally {
    localStorage.setItem = setter;
    game.wallet.storageUnavailable = false;
  }
  assert.equal(game.missions.claim(mission.id), true);
  assert.equal(game.wallet.profile.balance, 50000 + mission.reward);
  assert.deepEqual(game.wallet.profile.owned, [item.id]);
  assert.equal(game.missions.claim(mission.id), false);
  assert.equal(game.shop.equip(item.id), true);
  assert.equal(game.wallet.profile.equipped.outfit, item.id);
  assert.equal(game.wallet.validate(game.wallet.profile), true);
  game.missionMenu.category = "ghosts";
  game.missionMenu.render();
  assert.match(element("missions-list").innerHTML, /mission-cosmetic-reward/);
  assert.match(element("missions-list").innerHTML, /Test Costume/);
  const invalid = game.wallet.clone();
  invalid.missionRewards = [];
  assert.equal(game.wallet.validate(invalid), false);
  // Yeni bir ödül daha önce alınmış göreve bağlanırsa mevcut oyuncuya da verilir.
  const old = game.wallet.clone();
  old.owned = [];
  old.equipped.outfit = null;
  delete old.purchasePrices;
  game.wallet.persist(old);
  const loaded = new PointWallet(game);
  loaded.load();
  assert.deepEqual(loaded.profile.owned, [item.id]);
  assert.equal(loaded.profile.balance, old.balance);
  console.log("PASS mission-only purchase/equip locks, bilingual requirements, one-time grant and old-claim migration");

  const store = new AccountStore(directory);
  const profile = { data: {} };
  const incoming = loaded.clone();
  incoming.totalEarned = incoming.balance = mission.reward;
  incoming.runs = {};
  assert.throws(() => store.mergeWallet(profile, incoming));
  const stats = game.missions.empty();
  stats.stats.ghosts = mission.target;
  profile.data[MISSIONS_KEY] = JSON.stringify(stats);
  store.mergeWallet(profile, incoming);
  const accepted = JSON.parse(profile.data[WALLET_KEY]);
  assert.deepEqual(accepted.owned, [item.id]);
  assert.equal(accepted.balance, mission.reward);
  store.mergeWallet(profile, incoming);
  assert.deepEqual(JSON.parse(profile.data[WALLET_KEY]), accepted);
  // Tamamlanmış hedef tek başına yetmez; ödül alınmadan envantere eklenemez.
  const unclaimed = { ...incoming, missionRewards: [], totalEarned: 0, balance: 0 };
  assert.equal(loaded.validate(unclaimed), false);
  await store.ready;
  console.log("PASS server rejects unmet reward claims and repeats neither costume nor points");
} finally {
  SHOP_ITEMS.splice(SHOP_ITEMS.indexOf(item), 1);
  await rm(directory, { recursive: true, force: true });
}
