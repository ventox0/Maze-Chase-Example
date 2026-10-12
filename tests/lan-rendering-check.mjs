import assert from "node:assert/strict";
import { BASE_MAP } from "../src/data/maps.js";
import { TILE, LIFE_PELLET } from "../src/data/config.js";
import { mapStyle, createLevelMap } from "../src/gameplay/map-generation.js";
import { TRANSLATIONS } from "../src/i18n/messages.js";
import { LanWorld } from "../server/LanWorld.js";

function recordingCanvas() {
  const log = [],
    stack = [];
  const ctx = new Proxy(
    { globalAlpha: 1, shadowBlur: 0, dash: [] },
    {
      get(target, key) {
        if (key in target) return target[key];
        return (...args) => {
          if (key === "save") {
            stack.push({ ...target });
            return;
          }
          if (key === "restore") {
            const state = stack.pop();
            for (const k of Object.keys(target)) delete target[k];
            Object.assign(target, state);
            return;
          }
          if (key === "setLineDash") {
            target.dash = args[0];
            return;
          }
          if (key === "translate" && args.every((v) => v === 0)) return;
          const styles = [
            "fillStyle",
            "strokeStyle",
            "lineWidth",
            "shadowColor",
            "shadowBlur",
            "globalAlpha",
            "font",
            "textAlign",
            "dash",
          ];
          // Capture the styles which affect paint, not irrelevant previous Canvas assignments.
          const paint = [
            "fill",
            "stroke",
            "fillRect",
            "fillText",
            "drawImage",
          ].includes(key);
          log.push([
            key,
            args.map((v) => (v?.getContext ? "[canvas]" : v)),
            paint
              ? Object.fromEntries(
                  styles.filter((k) => k in target).map((k) => [k, target[k]]),
                )
              : null,
          ]);
        };
      },
    },
  );
  return { width: 0, height: 0, log, getContext: () => ctx };
}
const singleCanvas = recordingCanvas();
globalThis.document = {
  getElementById: (id) => (id === "game" ? singleCanvas : {}),
  createElement: () => recordingCanvas(),
};
globalThis.window = {
  devicePixelRatio: 1,
  matchMedia: () => ({ matches: false }),
};
globalThis.Image = class {};
globalThis.requestAnimationFrame = () => {};
const { CanvasRenderer } = await import("../src/rendering/CanvasRenderer.js");
const { LanRenderer } = await import("../src/lan/LanRenderer.js");
const { buildWallLayer } = await import("../src/rendering/ArcadeDrawing.js");
const lanCanvas = recordingCanvas(),
  lan = new LanRenderer(lanCanvas);
lan.configureCanvas(BASE_MAP);
const game = {
  movement: { position: (entity) => entity },
  settings: { reduced: false, effectsAllowed: () => true },
  player: { entity: { x: 36, y: 84, dir: "down" } },
  abilities: { pelletTrails: [] },
  arcade: { offset: () => ({ x: 0, y: 0 }), drawFeedback() {} },
  effects: { particles: [], floatingTexts: [] },
  cutscenes: {},
  assets: { ghosts: {} },
  ghosts: {
    entities: [],
    ghostSkillsEnabled: (g) => g.skillsEnabled,
    ghostCycle: (g) => g.skillPhase,
    sprinting: (g) => g.sprinting,
  },
  i18n: { t: (key) => TRANSLATIONS.tr[key] },
  gameTime: 5,
  powerUntil: 0,
  lives: 2,
};
const single = new CanvasRenderer(game);
single.drawPlayer = () => {};
// Canvas state that does not affect a primitive (e.g. stroke colour on a fill) is omitted.
function painted(log) {
  return log.map(([method, args, styles]) => {
    if (styles) {
      if (["fill", "fillRect", "fillText"].includes(method)) {
        delete styles.strokeStyle;
        delete styles.lineWidth;
        delete styles.dash;
      }
      if (method === "stroke") {
        delete styles.fillStyle;
        delete styles.font;
        delete styles.textAlign;
      }
      if (method !== "fillText") {
        delete styles.font;
        delete styles.textAlign;
      }
      if (method === "drawImage") {
        delete styles.fillStyle;
        delete styles.strokeStyle;
        delete styles.lineWidth;
        delete styles.dash;
      }
      if (!styles.shadowBlur) delete styles.shadowColor;
    }
    return [method, args, styles];
  });
}
for (const level of [1, 2, 3, 4, 5, 999]) {
  const map = createLevelMap(level);
  game.maze = {
    grid: map,
    phase: "maze",
    wallLayer: buildWallLayer(map, mapStyle(level)),
  };
  singleCanvas.log.length = lanCanvas.log.length = 0;
  single.render(5);
  lan.draw(
    {
      map,
      level,
      gameTime: 5,
      phase: "maze",
      players: [],
      ghosts: [],
      powerRemaining: 0,
    },
    0,
    5,
  );
  assert.deepEqual(
    painted(lan.wallLayer.log),
    painted(game.maze.wallLayer.log),
    `level ${level}: wall contours`,
  );
  assert.deepEqual(
    painted(lanCanvas.log),
    painted(singleCanvas.log),
    `level ${level}: pellets/scene`,
  );
}
console.log(
  "PASS six maps: LAN and single produce identical wall and pellet draw commands",
);
const cached = lan.wallLayer;
const changed = createLevelMap(999);
changed[1][1] = 0;
lan.draw(
  {
    map: changed,
    level: 999,
    gameTime: 5,
    players: [],
    ghosts: [],
    phase: "maze",
  },
  0,
  5,
);
assert.equal(
  lan.wallLayer,
  cached,
  "eating a pellet must not rebuild the wall texture",
);
changed[1][1] = 1;
lan.draw(
  {
    map: changed,
    level: 999,
    gameTime: 5,
    players: [],
    ghosts: [],
    phase: "maze",
  },
  0,
  5,
);
assert.notEqual(lan.wallLayer, cached, "wall geometry invalidates the texture");
console.log(
  "PASS pellet changes preserve the wall cache; geometry changes invalidate it",
);
const w = new LanWorld("coop");
const p = w.addPlayer("p", "Pac", 0);
p.abilities.boostUntil = 9;
p.abilities.jump = {
  from: { x: 36, y: 36 },
  to: { x: 84, y: 36 },
  elapsed: 0.17,
};
let snap = w.snapshot();
assert.equal(snap.players[0].boost, true);
assert.equal(snap.players[0].jumpVisual.elapsed, 0.17);
assert.ok(
  snap.ghosts.every(
    (g) =>
      typeof g.skillPhase === "number" && typeof g.skillsEnabled === "boolean",
  ),
);
assert.deepEqual(p.abilities.jump.from, snap.players[0].jumpVisual.from);
console.log(
  "PASS authoritative snapshots carry jump, boost and special ghost visual state",
);
for (const language of ["tr", "en"]) {
  lan.language = language;
  const map = BASE_MAP.map((row) => row.map((v) => (v === 1 ? 1 : 0)));
  map[LIFE_PELLET.row][LIFE_PELLET.col] = 4;
  lanCanvas.log.length = 0;
  lan.draw(
    { map, level: 1, gameTime: 5, phase: "bonus", players: [], ghosts: [] },
    0,
    5,
  );
  const labels = lanCanvas.log
    .filter((c) => c[0] === "fillText")
    .map((c) => c[1][0]);
  assert.deepEqual(labels, [
    TRANSLATIONS[language].lifeCanvas,
    TRANSLATIONS[language].pointsReward,
  ]);
}
console.log("PASS bonus heart uses the selected language");
for (const frightened of [false, true]) {
  const ghosts = [
    "blaze",
    "rose",
    "aqua",
    "cinder",
    "rush",
    "moss",
    "amber",
    "shade",
  ].map((id, index) => ({
    id,
    index,
    x: (3 + index * 2) * TILE,
    y: 8.5 * TILE,
    dir: "right",
    color: "#f95357",
    immuneUntil: 0,
    releaseAt: 0,
    skillsEnabled: !frightened,
    skillPhase: id === "moss" ? 5 : 7.5,
    sprinting: !frightened && id === "rush",
    wallPlan:
      !frightened && id === "shade"
        ? { from: { x: 420, y: 204 }, to: { x: 468, y: 204 } }
        : null,
    frightened,
    respawning: false,
  }));
  for (const ghost of ghosts) ghost.hop = ghost.wallPlan;
  game.maze = {
    grid: BASE_MAP,
    phase: "maze",
    wallLayer: buildWallLayer(BASE_MAP, mapStyle(1)),
  };
  game.ghosts.entities = ghosts;
  game.powerUntil = frightened ? 7 : 0;
  lan.language = "tr";
  singleCanvas.log.length = lanCanvas.log.length = 0;
  single.render(5);
  lan.draw(
    {
      map: BASE_MAP,
      level: 1,
      gameTime: 5,
      phase: "maze",
      players: [],
      ghosts,
      powerRemaining: frightened ? 2 : 0,
    },
    0,
    5,
  );
  assert.deepEqual(painted(lanCanvas.log), painted(singleCanvas.log));
}
console.log(
  "PASS all eight ghost fallbacks, frightened blinking and special ability warnings match single",
);
{
  const w = new LanWorld("coop"),
    state = w.snapshot();
  lan.zoom = 1;
  lanCanvas.log.length = 0;
  lan.draw(state, 0, 5);
  assert.equal(lanCanvas.width, state.cols * TILE);
  assert.equal(lanCanvas.height, state.rows * TILE);
  assert.equal(lan.wallLayer.width, state.cols * TILE * 2);
  assert.equal(lan.wallLayer.height, state.rows * TILE * 2);
  assert.ok(
    lanCanvas.log.some(
      ([method, args]) =>
        method === "arc" && args[0] > 21 * TILE && args[1] > 23 * TILE,
    ),
  );
  const map = state.map.map((row) => row.map((c) => (c === 1 ? 1 : 0)));
  const col = Math.floor(state.cols / 2),
    row = Math.floor(state.rows / 2);
  map[row][col] = 4;
  lanCanvas.log.length = 0;
  lan.draw({ ...state, map, phase: "bonus" }, 0, 5);
  assert.ok(
    lanCanvas.log.some(
      ([method, args]) =>
        method === "translate" &&
        args[0] === (col + 0.5) * TILE &&
        args[1] === (row + 0.5) * TILE,
    ),
  );
  const p = { id: "camera", lives: 3, connected: true, x: 0, y: 0 };
  lan.myId = p.id;
  lan.zoom = 2;
  assert.deepEqual(lan.camera({ players: [p] }), { scale: 2, x: 0, y: 0 });
  p.x = lan.width;
  p.y = lan.height;
  assert.deepEqual(lan.camera({ players: [p] }), {
    scale: 2,
    x: lan.width / 2,
    y: lan.height / 2,
  });
  lan.zoom = 1;
  assert.deepEqual(lan.camera({ players: [p] }), { scale: 1, x: 0, y: 0 });
}
console.log(
  "PASS large Canvas, distant pellets, central bonus and close-up camera clamping",
);

{
  const { drawPlayer } = await import("../src/rendering/ArcadeDrawing.js");
  const composed = recordingCanvas();
  composed.width = composed.height = 192;
  const output = recordingCanvas();
  drawPlayer(
    output.getContext("2d"),
    { x: 20, y: 20 },
    { angle: 0, scaleX: 1, scaleY: 1, bob: 0, mouth: 0.2 },
    composed,
    "right",
    null,
  );
  assert.ok(
    output.log.some(
      (entry) => entry[0] === "drawImage" && entry[1][0] === "[canvas]",
    ),
  );
}
console.log(
  "PASS composed costume Canvas is drawn as a player sprite instead of the loading fallback",
);

{
  const w = new LanWorld();
  const p = w.addPlayer("local", "Test", 0);
  p.connected = true;
  w.state = "playing";
  const old = w.snapshot();
  const latest = { ...old, players: old.players.map((p) => ({ ...p, x: p.x + 12 })) };
  const peer = { ...old.players[0], id: "peer", x: 36 };
  old.players.push(peer);
  latest.players.push({ ...peer, x: 60 });
  lan.myId = p.id;
  lan.networkConnected = true;
  lan.frames = [{ received: 0, state: old }, { received: 100, state: latest }];
  lan.prediction.reset(); // Eski sunucuyla da kendi oyuncu en yeni durumdan çizilir.
  const rendered = lan.sample(150);
  assert.equal(rendered.players[0].x, latest.players[0].x);
  assert.ok(Math.abs(rendered.players[1].x - 50.4) < 1e-8);
  lan.networkConnected = false;
  assert.notEqual(lan.sample(150).players[0].x, latest.players[0].x);
}
console.log("PASS own player bypasses the 90 ms buffer; peers retain smooth interpolation");
