import { profileStorage } from "./account/ProfileStorage.js";
import { AccountUI } from "./account/AccountUI.js";
import { Game } from "./core/Game.js";

// HTML modül betikleri DOM hazır olduğunda başlar.
await profileStorage.initialize();
new AccountUI();
const game = new Game();
game.start();
let resumeAfterAccount = false;
window.addEventListener("account-open", () => {
  resumeAfterAccount = ["playing", "cutscene", "transition"].includes(
    game.state,
  );
  if (resumeAfterAccount) game.togglePause();
});
window.addEventListener("account-close", () => {
  if (resumeAfterAccount && game.state === "paused") game.resumeGameplay();
  resumeAfterAccount = false;
});

profileStorage.listeners.add(() => {
  if (profileStorage.user && profileStorage.state === "synced") {
    game.wallet.refresh();
    game.missions.refresh();
    game.ui.updateHUD();
    if (game.shop.dialog.open) game.shop.render();
    if (game.missionMenu.dialog.open) game.missionMenu.render();
  }
});
