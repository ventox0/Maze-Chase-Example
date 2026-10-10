// DOM ve Canvas taklitleri gerçek ESM oyun sınıflarını sınar; üretim koduna kanca eklemez.
const context = new Proxy(
  {},
  { get: (t, key) => (key === "canvas" ? {} : () => {}) },
);
const elements = new Map();
function element(id) {
  if (elements.has(id)) return elements.get(id);
  const e = {
    id,
    dataset: {},
    textContent: "",
    hidden: false,
    style: {},
    children: [],
    firstElementChild: { textContent: "" },
    firstChild: { textContent: "" },
    open: false,
    showModal() {
      this.open = true;
    },
    close() {
      this.open = false;
    },
    focus() {},
    toDataURL() {
      return "data:image/png;base64,test";
    },
    classList: { toggle() {} },
    setAttribute() {},
    addEventListener() {},
    blur() {},
    getContext: () => context,
  };
  if (id === "lives")
    e.children = Array.from({ length: 3 }, () => ({
      classList: { toggle() {} },
    }));
  elements.set(id, e);
  return e;
}
const events = { window: {}, document: {} };
const motion = { matches: false };
const stored = new Map();
const sandbox = {
  Image: class {
    constructor() {
      this.complete = true;
      this.naturalWidth = 384;
      this.naturalHeight = 384;
    }
  },
  console,
  Math,
  Number,
  String,
  Array,
  Object,
  Infinity,
  document: {
    documentElement: { lang: "tr" },
    querySelector: () => element("meta"),
    getElementById: element,
    createElement: () => element("canvas-" + Math.random()),
    querySelectorAll: () => [],
    addEventListener(type, fn) {
      events.document[type] = fn;
    },
  },
  window: {
    devicePixelRatio: 1,
    matchMedia: () => motion,
    addEventListener(type, fn) {
      events.window[type] = fn;
    },
  },
  localStorage: {
    getItem: (k) => stored.get(k),
    setItem: (k, v) => stored.set(k, v),
  },
  requestAnimationFrame() {},
  HTMLButtonElement: class {},
};

Object.assign(globalThis, {
  document: sandbox.document,
  window: sandbox.window,
  Image: sandbox.Image,
  localStorage: sandbox.localStorage,
  HTMLButtonElement: sandbox.HTMLButtonElement,
  requestAnimationFrame: sandbox.requestAnimationFrame,
});

const { Game } = await import("../../src/core/Game.js");
const { GameComponent } = await import("../../src/core/GameComponent.js");
const { TRANSLATIONS } = await import("../../src/i18n/messages.js");
const { BASE_MAP } = await import("../../src/data/maps.js");
const { GHOSTS } = await import("../../src/data/ghosts.js");
const { LIFE_PELLET } = await import("../../src/data/config.js");
const { SPRITE_SOURCES, SHOP_ATLAS_SOURCES } = await import(
  "../../src/data/assets.js"
);
const { SHOP_ITEMS } = await import("../../src/data/shop.js");

const game = new Game();
game.start();
sandbox.game = game;
// Test adaptörü sınıfların gerçek metotlarını kullanır; oyun dosyasına eklenmez.
const components = [
  game,
  ...Object.values(game).filter((value) => value instanceof GameComponent),
];
const test = { TRANSLATIONS };
for (const component of components)
  for (const name of Object.getOwnPropertyNames(
    Object.getPrototypeOf(component),
  )) {
    if (name !== "constructor" && typeof component[name] === "function")
      if (!Object.hasOwn(test, name)) test[name] = component[name];
  }
test.get = () => ({
  cutscene: game.cutscenes.current,
  actionSequence: game.cutscenes.sequence,
  actionSprites: game.assets.actions,
  ghostSprites: game.assets.ghosts,
  language: game.i18n.language,
  stateTime: game.stateTime,
  accumulator: game.accumulator,
  selectedSlot: game.abilities.selectedSlot,
  map: game.maze.grid,
  player: game.player.entity,
  ghosts: game.ghosts.entities,
  pellets: game.maze.pellets,
  score: game.score,
  highScore: game.highScore,
  lives: game.lives,
  level: game.level,
  state: game.state,
  gameTime: game.gameTime,
  powerUntil: game.powerUntil,
  jump: game.abilities.jump,
  jumpReadyAt: game.abilities.jumpReadyAt,
  magnetUntil: game.abilities.magnetUntil,
  magnetReadyAt: game.abilities.magnetReadyAt,
  pendingJumpUntil: game.abilities.pendingJumpUntil,
  pelletTrails: game.abilities.pelletTrails,
  boostUntil: game.abilities.boostUntil,
  boostReadyAt: game.abilities.boostReadyAt,
  shieldUntil: game.abilities.shieldUntil,
  shieldReadyAt: game.abilities.shieldReadyAt,
  loadout: game.abilities.loadout,
  draftLoadout: game.abilities.draftLoadout,
  roundPhase: game.maze.phase,
  bonusReward: game.maze.bonusReward,
  sprites: game.assets.players,
  levelGhostTypes: GHOSTS,
  LIFE_PELLET,
  SPRITE_SOURCES,
});
test.set = (key, value) => {
  if (key === "level") game.level = value;
  if (key === "time") game.gameTime = value;
  if (key === "lives") game.lives = value;
  if (key === "pellets") game.maze.pellets = value;
  if (key === "invulnerable") game.invulnerableUntil = value;
  if (key === "power") game.powerUntil = value;
};
sandbox.test = test;
sandbox.SHOP_ITEMS = SHOP_ITEMS;
sandbox.SHOP_ATLAS_SOURCES = SHOP_ATLAS_SOURCES;
sandbox.mapTest = {
  createLevelMap: game.maze.createLevelMap,
  mapStyle: game.maze.mapStyle,
  BASE_MAP,
};

export { sandbox, element, stored, events, motion };
export const t = sandbox.test;
