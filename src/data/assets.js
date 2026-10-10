// Görseller dış dosyalardır; URL’ler modül konumundan çözülür.
export const SPRITE_SOURCES = {
  normal: new URL("../../assets/players/normal.webp", import.meta.url).href,
  boost: new URL("../../assets/players/boost.webp", import.meta.url).href,
  magnet: new URL("../../assets/players/magnet.webp", import.meta.url).href,
  power: new URL("../../assets/players/power.webp", import.meta.url).href,
  shield: new URL("../../assets/players/shield.webp", import.meta.url).href,
};

export const ICON_SOURCES = {
  jump: new URL("../../assets/icons/jump.webp", import.meta.url).href,
};

export const SHOP_ATLAS_SOURCES = {
  outfits: new URL(
    "../../assets/shop/outfits-open-mouth-v1.png",
    import.meta.url,
  ).href,
  heads: new URL("../../assets/shop/head-accessories-v1.png", import.meta.url)
    .href,
  special: new URL("../../assets/shop/special-outfits-v2.png", import.meta.url)
    .href,
};

export const GHOST_ATLAS_SOURCES = [
  new URL("../../assets/ghosts/ghosts-1.png", import.meta.url).href,
  new URL("../../assets/ghosts/ghosts-2.png", import.meta.url).href,
];

export const ACTION_ATLAS_SOURCE = new URL(
  "../../assets/actions/hero-actions-atlas.png",
  import.meta.url,
).href;
