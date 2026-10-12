import { AssetLoader } from "../rendering/AssetLoader.js";
import { AVATAR_SIZE, avatarLayout } from "../rendering/AvatarLayout.js";
import { SPRITE_SOURCES } from "../data/assets.js";
import { normalizeAppearance } from "../data/lan-options.js";

// Başlık yerleşimi ve atlas kırpması tek oyunculu dükkânla aynıdır.
export class LanAppearance {
  constructor(onReady = () => {}) {
    this.cache = new Map();
    this.sources = new Map();
    this.assets = new AssetLoader({
      shop: {
        assetsReady: () => {
          this.cache.clear();
          this.sources.clear();
          onReady();
        },
      },
    });
    this.assets.loadSprites({ decorateDOM: false });
    this.assets.loadShopSprites();
  }
  sprite(value) {
    const { outfit, head } = normalizeAppearance(value);
    if (!outfit && !head) return this.assets.players.normal;
    const key = `${outfit}|${head}`;
    if (this.cache.has(key)) return this.cache.get(key);
    const body = this.assets.cosmetics[outfit] || this.assets.players.normal;
    const hat = this.assets.cosmetics[head];
    if (
      !body ||
      body.complete === false ||
      (head && !hat) ||
      (outfit && !this.assets.cosmetics[outfit])
    )
      return this.assets.players.normal;
    const image = document.createElement("canvas");
    image.width = image.height = AVATAR_SIZE;
    const layout = avatarLayout(
      body.width,
      body.height,
      outfit,
      head,
      hat?.width,
      hat?.height,
    );
    const c = image.getContext("2d"),
      b = layout.body,
      h = layout.hat;
    c.drawImage(body, b.x, b.y, b.width, b.height);
    if (h) c.drawImage(hat, h.x, h.y, h.width, h.height);
    if (this.cache.size >= 64)
      this.cache.delete(this.cache.keys().next().value);
    this.cache.set(key, image);
    return image;
  }
  source(value) {
    const normalized = normalizeAppearance(value),
      key = `${normalized.outfit}|${normalized.head}`;
    if (this.sources.has(key)) return this.sources.get(key);
    const sprite = this.sprite(normalized);
    const source = sprite?.toDataURL
      ? sprite.toDataURL("image/png")
      : SPRITE_SOURCES.normal;
    if (sprite?.toDataURL) {
      if (this.sources.size >= 64)
        this.sources.delete(this.sources.keys().next().value);
      this.sources.set(key, source);
    }
    return source;
  }
}
