import { GameComponent } from "../core/GameComponent.js";
import {
  ACTION_ATLAS_SOURCE,
  GHOST_ATLAS_SOURCES,
  ICON_SOURCES,
  SHOP_ATLAS_SOURCES,
  SPRITE_SOURCES,
} from "../data/assets.js";
import { GHOSTS } from "../data/ghosts.js";
import { SHOP_ATLAS_REGIONS, SHOP_ITEMS } from "../data/shop.js";
import { FULL_SUIT_REGIONS } from "../data/fullSuits.js";

// Harici oyuncu, hayalet, aksiyon ve dükkân görsellerini yükler ve kırpar.
export class AssetLoader extends GameComponent {
  constructor(game) {
    super(game);
    this.players = {};
    this.ghosts = {};
    this.actions = [];
    this.cosmetics = {};
  }

  loadSprites({ decorateDOM = true } = {}) {
    for (const [key, source] of Object.entries(SPRITE_SOURCES)) {
      const image = new Image();
      image.src = source;
      this.players[key] = image;
    }
    if (!decorateDOM) return;
    document.querySelectorAll("[data-sprite]").forEach((image) => {
      image.src = SPRITE_SOURCES[image.dataset.sprite];
    });
    document.querySelectorAll("[data-icon]").forEach((image) => {
      image.src = ICON_SOURCES[image.dataset.icon];
    });
  }

  // Komşu hücreden kalan küçük parçalar baskın alpha bileşeninden ayrılır.
  isolateShopSprite(image, left, top, width, height) {
    const cell = document.createElement("canvas");
    cell.width = width;
    cell.height = height;
    const c = cell.getContext("2d");
    c.drawImage(image, left, top, width, height, 0, 0, width, height);
    const pixels = c.getImageData(0, 0, width, height),
      data = pixels.data,
      visited = new Uint8Array(width * height);
    let largest = [];
    for (let start = 0; start < visited.length; start++) {
      if (visited[start] || data[start * 4 + 3] < 40) continue;
      const stack = [start],
        component = [];
      visited[start] = 1;
      while (stack.length) {
        const n = stack.pop(),
          x = n % width;
        component.push(n);
        for (const next of [
          x ? n - 1 : -1,
          x + 1 < width ? n + 1 : -1,
          n - width,
          n + width,
        ])
          if (
            next >= 0 &&
            next < visited.length &&
            !visited[next] &&
            data[next * 4 + 3] >= 40
          ) {
            visited[next] = 1;
            stack.push(next);
          }
      }
      if (component.length > largest.length) largest = component;
    }
    if (!largest.length) return cell;
    const keep = new Uint8Array(width * height);
    let minX = width,
      minY = height,
      maxX = 0,
      maxY = 0;
    for (const n of largest) {
      const x = n % width,
        y = Math.floor(n / width);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++)
          if (x + dx >= 0 && x + dx < width && y + dy >= 0 && y + dy < height)
            keep[n + dy * width + dx] = 1;
    }
    for (let n = 0; n < keep.length; n++) if (!keep[n]) data[n * 4 + 3] = 0;
    c.putImageData(pixels, 0, 0);
    minX = Math.max(0, minX - 1);
    minY = Math.max(0, minY - 1);
    maxX = Math.min(width - 1, maxX + 1);
    maxY = Math.min(height - 1, maxY + 1);
    const sprite = document.createElement("canvas");
    sprite.width = maxX - minX + 1;
    sprite.height = maxY - minY + 1;
    sprite
      .getContext("2d")
      .drawImage(
        cell,
        minX,
        minY,
        sprite.width,
        sprite.height,
        0,
        0,
        sprite.width,
        sprite.height,
      );
    return sprite;
  }

  loadShopSprites() {
    // Yeni kostümler kendi şeffaf dosyalarıyla eklenebilir; mevcut atlaslar korunur.
    for (const item of SHOP_ITEMS.filter((item) => item.source)) {
      const image = new Image();
      image.onload = () => {
        this.cosmetics[item.id] = image;
        this.game.shop.assetsReady();
      };
      image.src = item.source;
    }
    for (const [sheet, source] of Object.entries(SHOP_ATLAS_SOURCES)) {
      const image = new Image();
      image.onload = () => {
        for (const item of SHOP_ITEMS.filter(
          (item) =>
            !item.source &&
            (item.atlas ||
              (item.original
                ? "special"
                : item.category === "outfit"
                  ? "outfits"
                  : "heads")) === sheet,
        )) {
          const region =
            sheet === "suits"
              ? FULL_SUIT_REGIONS[item.index]
              : SHOP_ATLAS_REGIONS[sheet][item.index];
          this.cosmetics[item.id] = this.isolateShopSprite(image, ...region);
        }
        this.game.shop.assetsReady();
      };
      image.src = source;
    }
    this.players.normal.addEventListener?.("load", this.game.shop.assetsReady);
  }

  loadGhostSprites() {
    GHOST_ATLAS_SOURCES.forEach((source, atlas) => {
      const image = new Image();
      image.onload = () => {
        GHOSTS.filter((g) => g.atlas === atlas).forEach((g) => {
          const crop = document.createElement("canvas");
          crop.width = 120;
          crop.height = 160;
          crop
            .getContext("2d")
            .drawImage(
              image,
              (g.cell * image.naturalWidth) / 4,
              0,
              image.naturalWidth / 4,
              image.naturalHeight,
              0,
              0,
              crop.width,
              crop.height,
            );
          this.ghosts[g.id] = crop;
        });
        this.game.ui.ghostHudKey = "";
        this.game.ui.renderGhostRoster();
      };
      image.src = source;
    });
  }

  // Alpha kolonları üç pozun sınırlarını bulur; geniş yumruk kırpılmaz.
  loadActionSprites() {
    const image = new Image();
    image.onload = () => {
      const atlas = document.createElement("canvas");
      atlas.width = image.naturalWidth;
      atlas.height = image.naturalHeight;
      const c = atlas.getContext("2d");
      c.drawImage(image, 0, 0);
      const pixels = c.getImageData(0, 0, atlas.width, atlas.height).data,
        runs = [];
      let start = -1;
      for (let x = 0; x < atlas.width; x++) {
        let occupied = false;
        for (let y = 0; y < atlas.height; y++)
          if (pixels[(y * atlas.width + x) * 4 + 3] > 32) {
            occupied = true;
            break;
          }
        if (occupied && start < 0) start = x;
        if (start >= 0 && (!occupied || x === atlas.width - 1)) {
          const end = occupied ? x + 1 : x;
          if (end - start > atlas.width * 0.12) runs.push({ start, end });
          start = -1;
        }
      }
      const regions =
        runs.length === 3
          ? runs
          : Array.from({ length: 3 }, (_, i) => ({
              start: (i * atlas.width) / 3,
              end: ((i + 1) * atlas.width) / 3,
            }));
      const width =
        Math.ceil(Math.max(...regions.map((r) => r.end - r.start))) + 16;
      regions.forEach((r, index) => {
        const sprite = document.createElement("canvas");
        sprite.width = width;
        sprite.height = atlas.height;
        const left = Math.max(0, r.start - 6),
          right = Math.min(atlas.width, r.end + 6);
        sprite
          .getContext("2d")
          .drawImage(
            image,
            left,
            0,
            right - left,
            atlas.height,
            (width - (right - left)) / 2,
            0,
            right - left,
            atlas.height,
          );
        this.actions[index] = sprite;
      });
    };
    image.src = ACTION_ATLAS_SOURCE;
  }
}
