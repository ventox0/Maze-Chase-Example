import assert from "node:assert/strict";
import { sandbox, element, events } from "./helpers/game-harness.mjs";
import { PointWallet } from "../src/storage/PointWallet.js";
const game = sandbox.game, shop = game.shop, custom = game.customization;
game.startGame(1);
game.ghosts.entities = [];
game.addScore(150000);

assert.equal(shop.purchase("sports_singlet"), true);
assert.equal(shop.purchase("baseball_cap"), true);
assert.equal(shop.purchase("pharaoh_robe"), true);
assert.deepEqual(game.wallet.profile.equipped, { outfit: null, head: null });
shop.render();
assert.doesNotMatch(element("shop-items").innerHTML, /data-shop-action="equip"/);
assert.match(element("shop-feedback").textContent, /Özelleştirme/);

const balance = game.wallet.profile.balance, time = game.gameTime;
custom.open();
assert.equal(game.state, "paused");
assert.equal(game.saves.canSave(), false);
assert.equal(element("shop-button").disabled, true);
game.settings.open();
game.missionMenu.open();
game.togglePause();
assert.equal(game.settings.dialog.open, false);
assert.equal(game.missionMenu.dialog.open, false);
assert.equal(game.state, "paused");
events.window.keydown({ key: "q", code: "KeyQ", target: { id: "customization-dialog" } });
game.update(5);
assert.equal(game.gameTime, time);
assert.equal(custom.preview("crown"), false);
assert.equal(custom.preview("sports_singlet"), true);
assert.equal(custom.preview("baseball_cap"), true);
assert.deepEqual(game.wallet.profile.equipped, { outfit: null, head: null });
assert.deepEqual(custom.draft, { outfit: "sports_singlet", head: "baseball_cap" });
custom.close();
assert.equal(game.state, "playing");
custom.open();
assert.deepEqual(custom.draft, { outfit: null, head: null });
custom.preview("sports_singlet");
custom.preview("baseball_cap");
assert.equal(custom.apply(), true);
assert.equal(game.wallet.profile.balance, balance);
assert.deepEqual(game.wallet.profile.equipped, custom.draft);
assert.equal(element("customization-apply").disabled, true);
const reloaded = new PointWallet(game);
reloaded.load();
assert.deepEqual(reloaded.profile.equipped, custom.draft);
console.log("PASS shop buys without equipping; customization drafts, apply/cancel, ownership guards and persistence preserve balance");

custom.preview("pharaoh_robe");
assert.equal(custom.draft.head, null);
custom.preview("baseball_cap");
assert.equal(custom.draft.outfit, null);
custom.remove("all");
const before = game.wallet.clone(), set = localStorage.setItem;
localStorage.setItem = () => { throw Error("quota"); };
try {
  assert.equal(custom.apply(), false);
  assert.deepEqual(game.wallet.profile, before);
} finally { localStorage.setItem = set; game.wallet.storageUnavailable = false; }
assert.equal(custom.apply(), true);
assert.deepEqual(game.wallet.profile.equipped, { outfit: null, head: null });
assert.equal(game.wallet.profile.balance, balance);
console.log("PASS full suits remove incompatible headwear in draft; save failure never changes active appearance or wallet");

for (const [category, count] of [["all", 3], ["outfit", 1], ["head", 1], ["suit", 1]]) {
  custom.chooseCategory(category);
  assert.equal(custom.visibleItems().length, count);
}
for (const language of ["tr", "en"]) {
  game.i18n.setLanguage(language);
  assert.doesNotMatch(element("customization-feedback").textContent, /customization\.|\{\w+\}/);
  assert.doesNotMatch(element("customization-count").textContent, /customization\.|\{\w+\}/);
}
game.i18n.setLanguage("tr");
custom.toShop();
assert.equal(shop.dialog.open, true);
assert.equal(custom.dialog.open, false);
assert.equal(game.state, "paused");
custom.fromShop();
assert.equal(custom.dialog.open, true);
assert.equal(shop.dialog.open, false);
assert.equal(game.state, "paused");
custom.close();
assert.equal(game.state, "playing");
game.togglePause();
custom.open();
custom.toShop();
shop.close();
assert.equal(game.state, "paused");
console.log("PASS owned category filters, bilingual text and shop/customization transfers retain exactly the prior pause state");
