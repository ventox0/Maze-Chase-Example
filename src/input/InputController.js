import { $, canvas, loadoutDialog } from "../core/dom.js";
import { GameComponent } from "../core/GameComponent.js";
import { KEYS } from "../data/config.js";

// Klavye, düğmeler, dokunma ve pencere yaşam döngüsü.
export class InputController extends GameComponent {
  constructor(game) {
    super(game);
    this.touchStart = null;
    this.bound = false;
  }

  bindEvents() {
    if (this.bound) return;
    this.bound = true;
    window.addEventListener("keydown", (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      // Account fields keep native text/Enter handling while the game is paused.
      if (document.getElementById("account-dialog")?.open) return;
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      if (
        this.game.settings.dialog.open ||
        this.game.challengeMenu.dialog.open ||
        this.game.missionMenu.dialog.open
      )
        return;
      // Bayrak ve dil seçeneklerinde Space/Enter standart düğme davranışını korur.
      if (
        (event.code === "Space" || event.key === "Enter") &&
        event.target instanceof HTMLButtonElement &&
        (event.target.id === "language-toggle" ||
          event.target.id === "skip-action" ||
          event.target.id === "save-button" ||
          event.target.id === "home-button" ||
          event.target.id === "resume-game" ||
          event.target.id === "shop-button" ||
          event.target.id === "customization-button" ||
          event.target.id === "settings-button" ||
          event.target.id === "missions-button" ||
          event.target.id === "skip-transition" ||
          event.target.dataset.mode ||
          event.target.id === "challenge-retry" ||
          event.target.id === "challenge-menu-button" ||
          event.target.dataset.language)
      )
        return;
      if (this.game.shop.dialog.open || this.game.customization.dialog.open) return;
      if (this.game.levels.dialog.open) {
        if (
          event.key === "Enter" &&
          !(event.target instanceof HTMLButtonElement) &&
          !event.repeat
        ) {
          event.preventDefault();
          if (event.target.id === "level-number")
            this.game.levels.jumpToLevel();
          else this.game.levels.confirmSelection();
        }
        return;
      }
      if (loadoutDialog.open) {
        if (key === "q" || key === "e") {
          event.preventDefault();
          this.game.abilities.selectSlot(key);
        } else if (
          event.key === "Enter" &&
          !(event.target instanceof HTMLButtonElement) &&
          !event.repeat
        ) {
          event.preventDefault();
          this.game.abilities.confirmLoadout();
        }
        return;
      }
      if (
        this.game.state === "cutscene" &&
        event.key === "Enter" &&
        !(event.target instanceof HTMLButtonElement)
      ) {
        event.preventDefault();
        if (!event.repeat) this.game.cutscenes.finishCutscene();
        return;
      }
      if (this.game.state === "transition" && event.key === "Enter") {
        event.preventDefault();
        if (!event.repeat) this.game.arcade.finishTransition();
        return;
      }
      if (KEYS[key]) {
        event.preventDefault();
        this.game.player.setDirection(KEYS[key]);
      } else if (key === "k") {
        event.preventDefault();
        if (!event.repeat) this.game.saves.saveManual();
      } else if (key === "q" || key === "e") {
        event.preventDefault();
        if (!event.repeat) this.game.abilities.useAbility(key);
      } else if (event.code === "Space") {
        event.preventDefault();
        if (!event.repeat) this.game.togglePause();
      } else if (event.key === "Escape") {
        event.preventDefault();
        if (["playing", "cutscene", "transition"].includes(this.game.state))
          this.game.togglePause();
      } else if (event.key === "Enter" && !event.repeat) {
        if (event.target instanceof HTMLButtonElement) return;
        event.preventDefault();
        this.game.mainAction();
      }
    });
    this.game.settings.bindEvents();
    $("missions-button").addEventListener("click", this.game.missionMenu.open);
    $("missions-close").addEventListener("click", this.game.missionMenu.close);
    $("missions-prev").addEventListener("click", () =>
      this.game.missionMenu.changePage(-1),
    );
    $("missions-next").addEventListener("click", () =>
      this.game.missionMenu.changePage(1),
    );
    $("missions-category").addEventListener("change", (event) =>
      this.game.missionMenu.setCategory(event.target.value),
    );
    $("missions-claim-all").addEventListener(
      "click",
      this.game.missionMenu.claimAll,
    );
    this.game.missionMenu.dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      this.game.missionMenu.close();
    });
    this.game.missionMenu.dialog.addEventListener("click", (event) => {
      const filter = event.target.closest("[data-mission-filter]");
      if (filter) this.game.missionMenu.setFilter(filter.dataset.missionFilter);
      const claim = event.target.closest("[data-mission-claim]");
      if (claim && !claim.disabled)
        this.game.missionMenu.claim(claim.dataset.missionClaim);
    });
    document
      .querySelectorAll("[data-mode]")
      .forEach((button) =>
        button.addEventListener("click", () =>
          this.game.challengeMenu.chooseMode(button.dataset.mode),
        ),
      );
    $("challenge-reroll").addEventListener(
      "click",
      this.game.challengeMenu.reroll,
    );
    $("challenge-difficulty").addEventListener("change", (event) =>
      this.game.challengeMenu.setDifficulty(event.target.value),
    );
    $("challenge-confirm").addEventListener(
      "click",
      this.game.challengeMenu.confirm,
    );
    $("challenge-cancel").addEventListener("click", () =>
      this.game.challengeMenu.dialog.close(),
    );
    $("challenge-retry").addEventListener(
      "click",
      this.game.challengeMenu.retry,
    );
    $("challenge-menu-button").addEventListener(
      "click",
      this.game.challenges.menu,
    );
    $("skip-transition").addEventListener(
      "click",
      this.game.arcade.finishTransition,
    );
    this.game.customization.bindEvents();
    $("shop-button").addEventListener("click", this.game.shop.open);
    $("shop-close").addEventListener("click", this.game.shop.close);
    $("shop-close-bottom").addEventListener("click", this.game.shop.close);
    this.game.shop.dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      this.game.shop.close();
    });
    this.game.shop.dialog.addEventListener("click", (event) => {
      const preview = event.target.closest("[data-shop-preview]");
      if (preview) {
        this.game.shop.preview(preview.dataset.shopPreview);
        return;
      }
      const category = event.target.closest("[data-shop-category]");
      if (category) {
        this.game.shop.chooseCategory(category.dataset.shopCategory);
        return;
      }
      const action = event.target.closest("[data-shop-action]");
      if (action && !action.disabled)
        this.game.shop.purchase(action.dataset.shopId);
    });
    window.addEventListener("storage", (event) => {
      if (event.key === this.game.missions.key) {
        this.game.missions.refresh();
        if (this.game.missionMenu.dialog.open) this.game.missionMenu.render();
      }
      if (event.key === this.game.wallet.key) {
        this.game.wallet.refresh();
        this.game.ui.lastPlayerSkin = "";
        if (this.game.shop.dialog.open) this.game.shop.render();
        if (this.game.customization.dialog.open) this.game.customization.render();
        if (this.game.missionMenu.dialog.open) this.game.missionMenu.render();
        this.game.ui.updateHUD();
      }
    });
    $("language-toggle").addEventListener("click", () =>
      this.game.i18n.setLanguage(
        this.game.i18n.language === "tr" ? "en" : "tr",
      ),
    );
    document
      .querySelectorAll("[data-language]")
      .forEach((button) =>
        button.addEventListener("click", () =>
          this.game.i18n.setLanguage(button.dataset.language),
        ),
      );
    $("main-action").addEventListener("click", () => {
      this.game.mainAction();
      $("main-action").blur();
    });
    $("pause-button").addEventListener("click", this.game.togglePause);
    $("save-button").addEventListener("click", this.game.saves.saveManual);
    $("home-button").addEventListener("click", this.game.saveAndMenu);
    $("resume-game").addEventListener("click", () => this.game.saves.resume());
    $("level-jump").addEventListener("submit", (event) => {
      event.preventDefault();
      this.game.levels.jumpToLevel();
    });
    $("level-prev").addEventListener("click", () =>
      this.game.levels.changePage(-1),
    );
    $("level-next").addEventListener("click", () =>
      this.game.levels.changePage(1),
    );
    $("level-cancel").addEventListener("click", () =>
      this.game.levels.dialog.close(),
    );
    $("level-confirm").addEventListener(
      "click",
      this.game.levels.confirmSelection,
    );
    $("level-grid").addEventListener("click", (event) => {
      const button = event.target.closest("[data-level]");
      if (button) this.game.levels.selectLevel(Number(button.dataset.level));
    });
    $("saved-games").addEventListener("click", (event) => {
      const button = event.target.closest("[data-resume]");
      if (button) this.game.saves.resume(button.dataset.resume);
    });
    $("autosave-toggle").addEventListener("change", (event) =>
      this.game.saves.setAuto(event.target.checked),
    );
    $("skip-action").addEventListener(
      "click",
      this.game.cutscenes.finishCutscene,
    );
    $("q-button").addEventListener("click", () =>
      this.game.abilities.useAbility("q"),
    );
    $("e-button").addEventListener("click", () =>
      this.game.abilities.useAbility("e"),
    );
    $("slot-q").addEventListener("click", () =>
      this.game.abilities.selectSlot("q"),
    );
    $("slot-e").addEventListener("click", () =>
      this.game.abilities.selectSlot("e"),
    );
    document
      .querySelectorAll("[data-ability]")
      .forEach((button) =>
        button.addEventListener("click", () =>
          this.game.abilities.selectAbility(button.dataset.ability),
        ),
      );
    $("loadout-confirm").addEventListener(
      "click",
      this.game.abilities.confirmLoadout,
    );
    $("loadout-cancel").addEventListener(
      "click",
      this.game.abilities.cancelLoadout,
    );
    loadoutDialog.addEventListener("cancel", (event) => {
      if (
        this.game.abilities.fromLevelMenu ||
        this.game.abilities.loadoutNext === "challenge"
      ) {
        event.preventDefault();
        this.game.abilities.cancelLoadout();
      }
    });
    $("sound-button").addEventListener("click", () => {
      this.game.settings.update("sound", !this.game.audio.enabled);
      this.game.ui.renderSoundControl();
      this.game.audio.resumeAudio();
      if (this.game.audio.enabled) this.game.audio.play("preview");
    });
    document.querySelectorAll("[data-dir]").forEach((button) =>
      button.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        this.game.player.setDirection(button.dataset.dir);
      }),
    );

    canvas.addEventListener("pointerdown", (event) => {
      this.touchStart = { x: event.clientX, y: event.clientY };
      canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener("pointermove", (event) => {
      if (!this.touchStart) return;
      const dx = event.clientX - this.touchStart.x,
        dy = event.clientY - this.touchStart.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 14) return;
      this.game.player.setDirection(
        Math.abs(dx) > Math.abs(dy)
          ? dx > 0
            ? "right"
            : "left"
          : dy > 0
            ? "down"
            : "up",
      );
      this.touchStart = { x: event.clientX, y: event.clientY };
    });
    const stopTouch = () => {
      this.touchStart = null;
    };
    canvas.addEventListener("pointerup", stopTouch);
    canvas.addEventListener("pointercancel", stopTouch);
    document.addEventListener("visibilitychange", () => {
      if (
        document.hidden &&
        ["playing", "cutscene", "transition"].includes(this.game.state)
      )
        this.game.togglePause();
      this.game.lastFrame = 0;
      this.game.accumulator = 0;
    });
    window.addEventListener("blur", () => {
      if (["playing", "cutscene", "transition"].includes(this.game.state))
        this.game.togglePause();
    });
    window.addEventListener("resize", this.game.renderer.configureCanvas);
  }
}
