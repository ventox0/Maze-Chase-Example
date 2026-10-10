import { $, canvas, loadoutDialog } from "../core/dom.js";
import { GameComponent } from "../core/GameComponent.js";
import { SPRITE_SOURCES } from "../data/assets.js";
import { SHOP_ITEMS } from "../data/shop.js";

// Puan dükkânı: önizleme, satın alma ve iki bağımsız giyim yuvası.
export class PointShop extends GameComponent {
  constructor(game) {
    super(game);
    this.dialog = $("shop-dialog");
    this.category = "outfit";
    this.previewId = "royal_cloak";
    this.resumeAfterClose = false;
    this.feedbackKey = "shop.hint";
    this.feedbackValues = {};
    this.avatarCache = new Map();
    this.imageCache = new Map();
    this.lastWallet = "";
  }
  item(id) {
    return SHOP_ITEMS.find((item) => item.id === id);
  }
  name(item) {
    return item
      ? item.name[this.game.i18n.language]
      : this.game.i18n.t("shop.none");
  }
  equippedName() {
    const e = this.game.wallet.profile.equipped;
    return (
      [e.outfit, e.head]
        .filter(Boolean)
        .map((id) => this.name(this.item(id)))
        .join(" + ") || this.game.i18n.t("model.normal")
    );
  }
  open() {
    if (
      this.dialog.open ||
      this.game.levels.dialog.open ||
      loadoutDialog.open ||
      this.game.state === "dying"
    )
      return;
    this.resumeAfterClose = ["playing", "cutscene"].includes(this.game.state);
    if (this.resumeAfterClose) this.game.togglePause();
    this.game.wallet.refresh();
    this.render();
    this.dialog.showModal();
    this.game.ui.updateHUD();
  }
  close() {
    if (!this.dialog.open) return;
    this.dialog.close();
    this.game.ui.updateHUD();
    if (this.resumeAfterClose && this.game.state === "paused")
      this.game.resumeGameplay();
    this.resumeAfterClose = false;
    canvas.focus({ preventScroll: true });
  }
  chooseCategory(category) {
    if (!["outfit", "head", "owned"].includes(category)) return;
    this.category = category;
    const items = this.visibleItems();
    if (!items.some((item) => item.id === this.previewId))
      this.previewId = items[0]?.id || null;
    this.render();
    this.dialog.scrollTop = 0;
  }
  visibleItems() {
    return SHOP_ITEMS.filter((item) =>
      this.category === "owned"
        ? this.game.wallet.profile.owned.includes(item.id)
        : item.category === this.category,
    );
  }
  preview(id) {
    if (!this.item(id)) return;
    this.previewId = id;
    this.render();
    this.dialog
      .querySelector?.('[data-shop-preview="' + id + '"]')
      ?.focus({ preventScroll: true });
  }
  purchase(id) {
    const item = this.item(id);
    if (!item) return false;
    this.game.wallet.refresh();
    const p = this.game.wallet.profile;
    if (p.owned.includes(id)) return false;
    if (p.balance < item.price) {
      this.feedback("shop.short", { points: item.price - p.balance });
      return false;
    }
    const next = this.game.wallet.clone();
    next.balance -= item.price;
    next.owned.push(id);
    const cleared = this.applyEquipment(next, item);
    if (!this.game.wallet.persist(next, true)) return false;
    this.changed(cleared ? "shop.boughtExclusive" : "shop.bought", {
      itemId: item.id,
    });
    return true;
  }
  applyEquipment(profile, item) {
    let cleared = false;
    if (item.category === "outfit" && item.exclusive) {
      cleared = !!profile.equipped.head;
      profile.equipped.head = null;
    }
    if (
      item.category === "head" &&
      this.item(profile.equipped.outfit)?.exclusive
    ) {
      cleared = true;
      profile.equipped.outfit = null;
    }
    profile.equipped[item.category] = item.id;
    return cleared;
  }
  equip(id) {
    const item = this.item(id);
    if (!item) return false;
    this.game.wallet.refresh();
    if (!this.game.wallet.profile.owned.includes(id)) return false;
    const next = this.game.wallet.clone(),
      cleared = this.applyEquipment(next, item);
    if (!this.game.wallet.persist(next, true)) return false;
    this.changed(cleared ? "shop.equippedExclusive" : "shop.equipped", {
      itemId: item.id,
    });
    return true;
  }
  remove(slot) {
    if (!["outfit", "head", "all"].includes(slot)) return false;
    this.game.wallet.refresh();
    const next = this.game.wallet.clone();
    for (const key of ["outfit", "head"])
      if (slot === "all" || slot === key) next.equipped[key] = null;
    if (!this.game.wallet.persist(next, true)) return false;
    this.changed("shop.removed");
    return true;
  }
  changed(key, values = {}) {
    this.game.ui.lastPlayerSkin = "";
    this.feedback(key, values);
    this.render();
    this.game.ui.updateHUD();
  }
  feedback(key, values = {}) {
    this.feedbackKey = key;
    this.feedbackValues = values;
    this.renderFeedback();
  }
  renderFeedback() {
    const values = { ...this.feedbackValues };
    if (values.itemId) values.name = this.name(this.item(values.itemId));
    if (typeof values.points === "number")
      values.points = this.game.i18n.formatScore(values.points);
    $("shop-feedback").textContent = this.game.i18n.t(this.feedbackKey, values);
    $("shop-feedback").classList.toggle(
      "shop-error",
      ["shop.storageError", "shop.short"].includes(this.feedbackKey),
    );
  }
  updateWallet() {
    const p = this.game.wallet.profile,
      key = [p.balance, p.totalEarned, this.game.i18n.language].join("|");
    if (key !== this.lastWallet) {
      $("wallet-balance").textContent = this.game.i18n.formatScore(p.balance);
      $("wallet-total").textContent = this.game.i18n.formatScore(p.totalEarned);
      this.lastWallet = key;
    }
    $("shop-button").disabled =
      this.game.state === "dying" ||
      this.game.levels.dialog.open ||
      loadoutDialog.open;
  }
  // Şeffaf atlaslardan tek karakter kompoze edilir; önbellek sınırlı tutulur.
  avatar(outfit = null, head = null) {
    if (!outfit && !head) return SPRITE_SOURCES.normal;
    const key = [outfit, head].join("|");
    if (this.avatarCache.has(key)) return this.avatarCache.get(key);
    const body =
        this.game.assets.cosmetics[outfit] || this.game.assets.players.normal,
      hat = this.game.assets.cosmetics[head];
    if (!body || body.complete === false || body.naturalWidth === 0)
      return SPRITE_SOURCES.normal;
    const image = document.createElement("canvas");
    image.width = 192;
    image.height = 192;
    const c = image.getContext("2d");
    const bw = body.width || body.naturalWidth,
      bh = body.height || body.naturalHeight;
    const size = outfit ? 146 : 142,
      scale = Math.min(size / bw, size / bh),
      w = bw * scale,
      h = bh * scale;
    const x = (192 - w) / 2,
      y = 184 - h;
    c.drawImage(body, x, y, w, h);
    if (head && hat) {
      const item = this.item(head),
        faceY = outfit ? y + h * 0.32 : y + h * 0.48,
        r = outfit ? w * 0.29 : w * 0.43;
      const hw = hat.width || hat.naturalWidth,
        hh = hat.height || hat.naturalHeight;
      let width = r * (item.wrap ? 2.45 : 2.28),
        height = (width * hh) / hw;
      // Kask ve kulaklık yüzü çevreler; diğer parçalar üst yayda durur.
      let top = item.wrap ? faceY - height * 0.5 : faceY + r * 0.06 - height;
      if (top < 5) {
        height *= Math.max(0.65, (faceY + r * 0.06 - 5) / height);
        width = (height * hw) / hh;
        top = 5;
      }
      c.drawImage(hat, (192 - width) / 2, top, width, height);
    }
    const source = image.toDataURL("image/png");
    if (this.avatarCache.size >= 96) {
      const oldest = this.avatarCache.keys().next().value;
      this.avatarCache.delete(oldest);
      this.imageCache.delete(oldest);
    }
    this.avatarCache.set(key, source);
    return source;
  }
  playerSprite(skin) {
    if (skin !== "normal") return null;
    const e = this.game.wallet.profile.equipped;
    if (!e.outfit && !e.head) return null;
    const key = [e.outfit, e.head].join("|"),
      source = this.avatar(e.outfit, e.head);
    let image = this.imageCache.get(key);
    if (!image) {
      image = new Image();
      image.src = source;
      this.imageCache.set(key, image);
    }
    return image;
  }
  previewEquipment(item) {
    const equipped = { ...this.game.wallet.profile.equipped };
    if (item) this.applyEquipment({ equipped }, item);
    return equipped;
  }
  render() {
    const t = this.game.i18n.t,
      format = this.game.i18n.formatScore,
      p = this.game.wallet.profile,
      item = this.item(this.previewId),
      e = this.previewEquipment(item);
    $("shop-balance").textContent = format(p.balance);
    $("shop-total").textContent = format(p.totalEarned);
    document
      .querySelectorAll("[data-shop-category]")
      .forEach((button) =>
        button.setAttribute(
          "aria-pressed",
          String(button.dataset.shopCategory === this.category),
        ),
      );
    $("shop-preview-image").src = this.avatar(e.outfit, e.head);
    $("shop-preview-image").alt = item ? this.name(item) : this.equippedName();
    $("shop-preview-name").textContent = item
      ? this.name(item)
      : this.equippedName();
    $("shop-preview-info").textContent = item?.exclusive
      ? t("shop.fullInfo")
      : t("shop.mixInfo");
    const owned = item && p.owned.includes(item.id),
      selected = item && p.equipped[item.category] === item.id;
    const action = $("shop-preview-action");
    action.hidden = !item;
    if (item) {
      action.dataset.shopAction = owned ? "equip" : "buy";
      action.dataset.shopId = item.id;
      action.disabled = selected || (!owned && p.balance < item.price);
      action.textContent = selected
        ? t("shop.wearing")
        : owned
          ? t("shop.equip")
          : t("shop.buyPrice", { points: format(item.price) });
    }
    for (const slot of ["outfit", "head"]) {
      $("shop-equipped-" + slot).textContent = this.name(
        this.item(p.equipped[slot]),
      );
      $("shop-remove-" + slot).disabled = !p.equipped[slot];
    }
    const items = this.visibleItems();
    $("shop-items").innerHTML =
      items
        .map((product) => {
          const own = p.owned.includes(product.id),
            wearing = p.equipped[product.category] === product.id;
          const source = this.avatar(
            product.category === "outfit" ? product.id : null,
            product.category === "head" ? product.id : null,
          );
          return `<article class="shop-item${this.previewId === product.id ? " previewed" : ""}"><button type="button" class="shop-item-art" data-shop-preview="${product.id}" aria-label="${t("shop.previewName", { name: this.name(product) })}" aria-pressed="${this.previewId === product.id}"><img src="${source}" alt=""><strong>${this.name(product)}</strong></button><small class="shop-item-tag">${product.exclusive ? t("shop.full") : own ? t("shop.owned") : t("shop." + product.category)}</small><span class="shop-price">${own ? t("shop.owned") : t("shop.price", { points: format(product.price) })}</span><button type="button" class="shop-item-action" data-shop-action="${own ? "equip" : "buy"}" data-shop-id="${product.id}" ${wearing || (!own && p.balance < product.price) ? "disabled" : ""}>${wearing ? t("shop.wearing") : own ? t("shop.equip") : t("shop.buy")}</button></article>`;
        })
        .join("") || `<p class="shop-empty">${t("shop.empty")}</p>`;
    this.renderFeedback();
    this.updateWallet();
  }
  assetsReady() {
    this.avatarCache.clear();
    this.imageCache.clear();
    this.game.ui.lastPlayerSkin = "";
    if (this.dialog.open) this.render();
  }
}
