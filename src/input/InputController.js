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
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
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
          event.target.dataset.language)
      )
        return;
      if (this.game.shop.dialog.open) return;
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
        if (this.game.state === "playing" || this.game.state === "cutscene")
          this.game.togglePause();
      } else if (event.key === "Enter" && !event.repeat) {
        if (event.target instanceof HTMLButtonElement) return;
        event.preventDefault();
        this.game.mainAction();
      }
    });
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
      const remove = event.target.closest("[data-shop-remove]");
      if (remove) {
        this.game.shop.remove(remove.dataset.shopRemove);
        return;
      }
      const action = event.target.closest("[data-shop-action]");
      if (action && !action.disabled)
        this.game.shop[
          action.dataset.shopAction === "buy" ? "purchase" : "equip"
        ](action.dataset.shopId);
    });
    window.addEventListener("storage", (event) => {
      if (event.key === this.game.wallet.key) {
        this.game.wallet.refresh();
        this.game.ui.lastPlayerSkin = "";
        if (this.game.shop.dialog.open) this.game.shop.render();
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
      if (this.game.abilities.fromLevelMenu) {
        event.preventDefault();
        this.game.abilities.cancelLoadout();
      }
    });
    $("sound-button").addEventListener("click", () => {
      this.game.audio.enabled = !this.game.audio.enabled;
      this.game.ui.renderSoundControl();
      this.game.audio.resumeAudio();
      if (this.game.audio.enabled) this.game.audio.tone(660, 0.1);
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
        (this.game.state === "playing" || this.game.state === "cutscene")
      )
        this.game.togglePause();
      this.game.lastFrame = 0;
      this.game.accumulator = 0;
    });
    window.addEventListener("blur", () => {
      if (this.game.state === "playing" || this.game.state === "cutscene")
        this.game.togglePause();
    });
    window.addEventListener("resize", this.game.renderer.configureCanvas);
  }
}
