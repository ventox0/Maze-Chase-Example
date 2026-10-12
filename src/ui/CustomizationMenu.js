import { $, canvas, loadoutDialog } from "../core/dom.js";
import { GameComponent } from "../core/GameComponent.js";
import { SHOP_ITEMS } from "../data/shop.js";

// Görünüm düzenleme alışverişten ayrıdır. Taslak yalnızca Uygula ile kaydedilir.
export class CustomizationMenu extends GameComponent {
  constructor(game) {
    super(game);
    this.dialog = $("customization-dialog");
    this.category = "all";
    this.draft = { outfit: null, head: null };
    this.resumeAfterClose = false;
    this.feedbackKey = "customization.hint";
  }
  open() {
    if (
      this.dialog.open || this.game.shop.dialog.open ||
      this.game.settings.dialog.open || this.game.levels.dialog.open ||
      this.game.challengeMenu.dialog.open || this.game.missionMenu.dialog.open ||
      loadoutDialog.open || this.game.state === "dying"
    ) return;
    this.resumeAfterClose = ["playing", "cutscene", "transition"].includes(this.game.state);
    if (this.resumeAfterClose) this.game.togglePause();
    this.game.wallet.refresh();
    this.draft = { ...this.game.wallet.profile.equipped };
    this.feedbackKey = "customization.hint";
    this.render();
    this.dialog.showModal();
    this.game.ui.updateHUD();
  }
  close() {
    if (!this.dialog.open) return;
    this.dialog.close();
    if (this.resumeAfterClose && this.game.state === "paused") this.game.resumeGameplay();
    this.resumeAfterClose = false;
    this.game.ui.updateHUD();
    canvas.focus({ preventScroll: true });
  }
  // İki ekran arasında geçerken oyun bir an bile devam etmez.
  transfer(from, to) {
    if (!from.dialog.open) return;
    const resume = from.resumeAfterClose;
    from.resumeAfterClose = false;
    from.close();
    to.open();
    to.resumeAfterClose = resume;
  }
  fromShop() { this.transfer(this.game.shop, this); }
  toShop() { this.transfer(this, this.game.shop); }
  visibleItems() {
    const owned = this.game.wallet.profile.owned;
    return SHOP_ITEMS.filter((item) => owned.includes(item.id) && (
      this.category === "all" ||
      (this.category === "suit" ? item.exclusive : item.category === this.category && !item.exclusive)
    ));
  }
  chooseCategory(category) {
    if (!["all", "outfit", "head", "suit"].includes(category)) return;
    this.category = category;
    this.render();
  }
  preview(id) {
    const item = this.game.shop.item(id);
    if (!item || !this.game.wallet.profile.owned.includes(id)) return false;
    const cleared = this.game.shop.applyEquipment({ equipped: this.draft }, item);
    this.feedbackKey = cleared ? "customization.exclusiveHint" : "customization.hint";
    this.render();
    this.dialog.querySelector?.(`[data-custom-preview="${id}"]`)?.focus({ preventScroll: true });
    return true;
  }
  remove(slot) {
    if (!["outfit", "head", "all"].includes(slot)) return;
    for (const key of ["outfit", "head"])
      if (slot === "all" || key === slot) this.draft[key] = null;
    this.feedbackKey = "customization.hint";
    this.render();
  }
  apply() {
    this.game.wallet.refresh();
    const next = this.game.wallet.clone();
    next.equipped = { ...this.draft };
    if (!this.game.wallet.persist(next, true)) {
      this.feedbackKey = "customization.saveError";
      this.render();
      return false;
    }
    this.feedbackKey = "customization.saved";
    this.game.ui.lastPlayerSkin = "";
    this.game.ui.updateHUD();
    this.render();
    return true;
  }
  updateButton() {
    $("customization-button").disabled = this.game.state === "dying" ||
      this.game.shop.dialog.open || this.game.settings.dialog.open ||
      this.game.levels.dialog.open || this.game.challengeMenu.dialog.open ||
      this.game.missionMenu.dialog.open || loadoutDialog.open;
  }
  render() {
    const shop = this.game.shop, t = this.game.i18n.t,
      owned = this.game.wallet.profile.owned,
      current = this.game.wallet.profile.equipped;
    // Hesap/sekme eşitlemesi, artık sahip olunmayan bir parçayı taslakta tutmaz.
    for (const slot of ["outfit", "head"]) {
      if (this.draft[slot] && !owned.includes(this.draft[slot])) this.draft[slot] = null;
      $("customization-equipped-" + slot).textContent = shop.name(shop.item(this.draft[slot]));
      $("customization-remove-" + slot).disabled = !this.draft[slot];
    }
    const names = Object.values(this.draft).filter(Boolean).map((id) => shop.name(shop.item(id))).join(" + ");
    $("customization-preview-image").src = shop.avatar(this.draft.outfit, this.draft.head);
    $("customization-preview-image").alt = names || t("model.normal");
    $("customization-preview-name").textContent = names || t("model.normal");
    $("customization-count").textContent = t("customization.count", { count: owned.length });
    $("customization-apply").disabled = current.outfit === this.draft.outfit && current.head === this.draft.head;
    $("customization-feedback").textContent = t(this.feedbackKey);
    document.querySelectorAll("[data-custom-category]").forEach((button) =>
      button.setAttribute("aria-pressed", String(button.dataset.customCategory === this.category)));
    $("customization-items").innerHTML = this.visibleItems().map((item) => {
      const selected = this.draft[item.category] === item.id;
      const image = shop.avatar(item.category === "outfit" ? item.id : null, item.category === "head" ? item.id : null);
      return `<article class="shop-item${selected ? " previewed" : ""}"><button type="button" class="shop-item-art" data-custom-preview="${item.id}" aria-pressed="${selected}" aria-label="${t("shop.previewName", { name: shop.name(item) })}"><img src="${image}" alt=""><strong>${shop.name(item)}</strong></button><small class="shop-item-tag">${t(item.exclusive ? "shop.full" : "shop." + item.category)}</small><span class="customization-item-state">${t(selected ? "customization.selected" : "customization.select")}</span></article>`;
    }).join("") || `<p class="shop-empty">${t(owned.length ? "customization.emptyCategory" : "customization.empty")}</p>`;
  }
  bindEvents() {
    $("customization-button").addEventListener("click", this.open);
    $("customization-close").addEventListener("click", this.close);
    $("customization-close-bottom").addEventListener("click", this.close);
    $("customization-apply").addEventListener("click", this.apply);
    $("customization-shop").addEventListener("click", this.toShop);
    $("shop-customization").addEventListener("click", this.fromShop);
    this.dialog.addEventListener("cancel", (event) => { event.preventDefault(); this.close(); });
    this.dialog.addEventListener("click", (event) => {
      const preview = event.target.closest("[data-custom-preview]");
      const category = event.target.closest("[data-custom-category]");
      const remove = event.target.closest("[data-custom-remove]");
      if (preview) this.preview(preview.dataset.customPreview);
      else if (category) this.chooseCategory(category.dataset.customCategory);
      else if (remove) this.remove(remove.dataset.customRemove);
    });
  }
}
