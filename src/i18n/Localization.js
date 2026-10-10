import { $ } from "../core/dom.js";
import { GameComponent } from "../core/GameComponent.js";
import { GHOSTS } from "../data/ghosts.js";
import { FLAGS } from "./flags.js";
import { LANGUAGE_KEY, TRANSLATIONS } from "./messages.js";

// Türkçe/İngilizce çeviriler ve kalıcı dil tercihi.
export class Localization extends GameComponent {
  constructor(game) {
    super(game);
    this.language = "tr";
  }

  t(key, values = {}) {
    return (
      TRANSLATIONS[this.language][key] ||
      TRANSLATIONS.tr[key] ||
      key
    ).replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? ""));
  }

  abilityName(id) {
    return this.t("ability." + id);
  }

  modelName(id) {
    return this.t("model." + id);
  }

  formatScore(value) {
    return value.toLocaleString(this.language === "tr" ? "tr-TR" : "en-US");
  }

  applyLanguage() {
    document.documentElement.lang = this.language;
    document
      .querySelector('meta[name="description"]')
      .setAttribute("content", this.t("meta"));
    document.querySelectorAll("[data-i18n]").forEach((node) => {
      node.textContent = this.t(node.dataset.i18n);
    });
    document.querySelectorAll("[data-i18n-aria]").forEach((node) => {
      node.setAttribute("aria-label", this.t(node.dataset.i18nAria));
    });
    $("language-flag").innerHTML = FLAGS[this.language];
    $("language-code").textContent = this.language.toUpperCase();
    $("language-toggle").setAttribute("aria-label", this.t("switchLanguage"));
    $("language-toggle").setAttribute("title", this.t("switchLanguage"));
    document.querySelectorAll("[data-language]").forEach((button) => {
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.language === this.language),
      );
    });
    this.game.ui.renderSoundControl();
    this.game.ui.renderStateScreen();
    this.game.abilities.renderLoadout();
    this.game.ui.lastHud = "";
    this.game.ui.lastPlayerSkin = "";
    this.game.ui.updateHUD();
    this.game.saves.renderFeedback();
    this.game.shop.lastWallet = "";
    this.game.shop.renderFeedback();
    if (this.game.shop.dialog.open) this.game.shop.render();
    if (this.game.levels.dialog.open) this.game.levels.renderMenu();
    if (this.game.ui.lastAnnouncement) {
      const values = { ...this.game.ui.lastAnnouncement.values };
      if (this.game.ui.lastAnnouncement.key === "announce.victory")
        values.reward = this.game.maze.bonusReward;
      if (this.game.ui.lastAnnouncement.key === "announce.gameover")
        values.score = this.formatScore(this.game.score);
      if (this.game.ui.lastAnnouncement.key === "announce.next") {
        const fresh = GHOSTS.find((g) => g.unlock === values.level);
        values.newGhost = fresh
          ? this.t("ghostNew", {
              name: fresh.name,
              detail: this.t("ghost." + fresh.id + ".detail"),
            })
          : "";
      }
      this.game.ui.announce(this.game.ui.lastAnnouncement.key, values);
    }
  }

  setLanguage(next) {
    if (next !== "tr" && next !== "en") return;
    this.language = next;
    try {
      localStorage.setItem(LANGUAGE_KEY, this.language);
    } catch (_) {}
    this.applyLanguage();
  }
}
