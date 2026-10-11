import assert from "node:assert/strict";
import { sandbox, stored, element } from "./helpers/game-harness.mjs";
import { PointWallet } from "../src/storage/PointWallet.js";
import { LanRewards } from "../src/lan/LanRewards.js";
import { LanWorld } from "../server/LanWorld.js";
import { LanService } from "../server/LanService.js";
import { LanUI } from "../src/lan/LanUI.js";
import { LanRenderer } from "../src/lan/LanRenderer.js";
import { createLevelMap } from "../src/gameplay/map-generation.js";
import { createLanMap } from "../src/gameplay/lan-map.js";
import { LAN_LIFE_PELLET, LAN_REWARD_PERCENT } from "../src/data/lan.js";
import { POWER_PELLET_COUNT } from "../src/gameplay/power-pellets.js";
import { BASE_MAP } from "../src/data/maps.js";
const facade = { shop: { feedback() {} } };
const freshWallet = () => {
  stored.delete("maze-chaser-wallet-v1");
  const w = new PointWallet(facade);
  w.load();
  return w;
};
function world(mode = "coop") {
  const w = new LanWorld(mode);
  for (let i = 0; i < 4; i++) {
    const p = w.addPlayer("p" + i, "Pac " + i, i);
    p.connected = true;
  }
  w.start();
  w.update(3);
  return w;
}
const signature = (grid) =>
  grid
    .flatMap((row, y) => row.flatMap((v, x) => (v === 3 ? `${x},${y}` : [])))
    .join(";");
const soloVariants = new Set(),
  lanVariants = new Set();
for (let seed = 0; seed < 100; seed++) {
  for (const [grid, variants] of [
    [createLevelMap(1, { powerSeed: seed }), soloVariants],
    [createLanMap(1, seed), lanVariants],
  ]) {
    assert.equal(grid.flat().filter((v) => v === 3).length, POWER_PELLET_COUNT);
    variants.add(signature(grid));
    let roads = 0,
      start;
    grid.forEach((row, y) =>
      row.forEach((v, x) => {
        if (v !== 1 && v !== 3) {
          roads++;
          start ||= { x, y };
        }
      }),
    );
    const seen = new Set([`${start.x},${start.y}`]),
      q = [start];
    for (let i = 0; i < q.length; i++)
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const x = q[i].x + dx,
          y = q[i].y + dy,
          key = `${x},${y}`;
        if (
          grid[y]?.[x] !== undefined &&
          grid[y][x] !== 1 &&
          grid[y][x] !== 3 &&
          !seen.has(key)
        ) {
          seen.add(key);
          q.push({ x, y });
        }
      }
    assert.equal(
      seen.size,
      roads,
      "power-last must remain possible without any jump",
    );
  }
}
assert.ok(soloVariants.size > 90 && lanVariants.size > 90);
assert.deepEqual(
  createLevelMap(1, { powerSeed: 1 }).map((r) =>
    r.map((v) => (v === 1 ? 1 : 0)),
  ),
  BASE_MAP.map((r) => r.map((v) => (v === 1 ? 1 : 0))),
);
console.log(
  "PASS 200 randomized layouts: exactly five accessible power pellets, broad distribution and no power-last blockers",
);
{
  const game = sandbox.game;
  let seed = 0;
  const original = crypto.getRandomValues;
  crypto.getRandomValues = (array) => {
    array.fill(seed++);
    return array;
  };
  try {
    game.startGame(1);
    const first = signature(game.maze.grid);
    game.startGame(1);
    assert.notEqual(signature(game.maze.grid), first);
    const saved = game.saves.capture();
    assert.ok(game.saves.validate(saved));
    game.saves.slots.manual = saved;
    game.startGame(1);
    assert.ok(game.saves.resume("manual"));
    assert.deepEqual(game.maze.grid, saved.data.map);
    const legacy = game.saves.capture();
    legacy.data.map = BASE_MAP.map((r) => r.slice());
    assert.ok(game.saves.validate(legacy));
  } finally {
    crypto.getRandomValues = original;
  }
}
console.log(
  "PASS solo runs redistribute power pellets; random layouts and legacy corner-pellet saves remain loadable",
);
{
  assert.equal(LAN_REWARD_PERCENT, 50);
  const w = world("race"),
    [a, b] = w.players.values();
  w.credit(a, 1001);
  w.credit(b, 201);
  w.finish("time");
  assert.equal(a.walletRewards[0].points, 500);
  assert.equal(b.walletRewards[0].points, 100);
  const snapshot = LanService.prototype.snapshot.call(
    {},
    { world: w, code: "ABCDEF", ownerId: a.id },
    { id: a.id },
  );
  assert.deepEqual(snapshot.walletRewards, a.walletRewards);
  assert.ok(!snapshot.players.some((p) => p.walletRewards));
  const wallet = freshWallet(),
    receipt = a.walletRewards[0];
  assert.equal(wallet.claimLanReward(receipt).amount, 500);
  const reloaded = new PointWallet(facade);
  reloaded.load();
  assert.equal(reloaded.claimLanReward(receipt).amount, 0);
  assert.equal(reloaded.profile.balance, 500);
  w.start();
  w.credit(a, 200);
  w.finish("time");
  assert.notEqual(a.walletRewards.at(-1).id, receipt.id);
  assert.equal(wallet.claimLanReward(a.walletRewards.at(-1)).amount, 100);
  assert.equal(wallet.profile.balance, 600);
  assert.equal(wallet.profile.totalEarned, 600);
}
console.log(
  "PASS private server receipts award 50% of personal score once; reconnect and rematch preserve correct balances",
);
{
  const w = world(),
    p = w.players.get("p0"),
    teammate = w.players.get("p1");
  w.credit(p, 500);
  w.credit(teammate, 201);
  for (const member of w.players.values()) member.lives = 2;
  teammate.lives = 3;
  // Elenen oyuncu da takım toplamından aynı payı alır.
  w.players.get("p3").lives = 0;
  w.maze.phase = "bonus";
  w.maze.grid[LAN_LIFE_PELLET.row][LAN_LIFE_PELLET.col] = 4;
  w.collect(p, LAN_LIFE_PELLET.col, LAN_LIFE_PELLET.row);
  assert.equal(w.state, "roundComplete");
  const wallet = freshWallet();
  // Can yemi bonusu da dahil: 500 + 201 + 500 = 1201; %50 = 600.
  assert.equal(w.teamScore, 1201);
  for (const member of w.players.values())
    assert.equal(member.walletRewards[0].points, 600);
  assert.equal(wallet.claimLanReward(p.walletRewards[0]).amount, 600);
  assert.equal(wallet.claimLanReward(p.walletRewards[0]).amount, 0);
  w.level++;
  w.loadRound();
  w.credit(p, 200);
  w.finish("lives");
  assert.equal(wallet.claimLanReward(p.walletRewards[0]).amount, 100);
  assert.equal(wallet.profile.balance, 700);
  assert.equal(wallet.profile.totalEarned, 700);
  for (const member of w.players.values())
    assert.equal(member.walletRewards[0].points, 700);
  w.finish("lives");
  assert.equal(wallet.claimLanReward(p.walletRewards[0]).amount, 0);
}
console.log(
  "PASS co-op awards each player 50% of the final team total including bonuses; later rounds and repeated settlement pay only the new share",
);
{
  const wallet = freshWallet(),
    receipt = { id: "lan-storage-check", points: 250, startedAt: 1 };
  const write = sandbox.localStorage.setItem;
  sandbox.localStorage.setItem = () => {
    throw new Error("quota");
  };
  try {
    assert.equal(wallet.claimLanReward(receipt).status, "storageError");
    assert.equal(wallet.profile.balance, 0);
  } finally {
    sandbox.localStorage.setItem = write;
  }
  assert.equal(wallet.claimLanReward(receipt).amount, 250);
  assert.equal(wallet.claimLanReward(receipt).amount, 0);
  assert.equal(
    wallet.claimLanReward({ ...receipt, id: "__proto__" }).status,
    "invalid",
  );
}
console.log(
  "PASS storage errors leave receipts unpaid and retryable; malformed receipts are rejected",
);
{
  freshWallet();
  const a = new LanRewards(),
    b = new LanRewards(),
    receipt = { id: "lan-duplicate-stream", points: 250, startedAt: 1 };
  const results = await Promise.all([
    a.settle([receipt]),
    b.settle([receipt]),
    a.settle([receipt]),
  ]);
  assert.equal(
    results.reduce((sum, r) => sum + r.amount, 0),
    250,
  );
  a.wallet.refresh();
  assert.equal(a.wallet.profile.balance, 250);
  const wallet = freshWallet();
  for (let i = 1; i <= 513; i++)
    wallet.claimLanReward({
      id: "lan-bounded-" + String(i).padStart(6, "0"),
      points: 1,
      startedAt: i,
    });
  assert.equal(Object.keys(wallet.profile.lanRewards).length, 512);
  assert.equal(wallet.profile.balance, 513);
  assert.equal(
    wallet.claimLanReward({ id: "lan-bounded-000001", points: 1, startedAt: 1 })
      .status,
    "expired",
  );
  assert.equal(wallet.profile.balance, 513);
}
console.log(
  "PASS duplicate streams and bounded receipt history cannot award the same points twice",
);
// Exercise the real UI render path with fake DOM nodes, without running a network loop.
const augment = (node) => {
  node.replaceChildren = (...children) => {
    node.children = children;
  };
  node.append = (...children) => node.children.push(...children);
  return node;
};
const get = document.getElementById,
  create = document.createElement;
document.getElementById = (id) => augment(get(id));
document.createElement = (tag) => augment(create(tag));
globalThis.location = { origin: "http://localhost:9999" };
{
  const w = world(),
    s = { ...w.snapshot(), room: "ABCDEF", ownerId: "p0" };
  s.players[0].lives = 0;
  const renderer = new LanRenderer(element("spectator-canvas"));
  renderer.configureCanvas(s.map);
  renderer.myId = "p0";
  renderer.zoom = 2;
  const ui = Object.assign(Object.create(LanUI.prototype), {
    language: "tr",
    state: s,
    status: "connected",
    client: { session: { id: "p0" } },
    renderer,
    info: { urls: [] },
    rosterKey: null,
    scoreKey: null,
    spectatorKey: null,
  });
  ui.render();
  assert.equal(element("arena-message").hidden, true);
  assert.equal(element("spectator-controls").hidden, false);
  assert.equal(renderer.spectatingId, "p1");
  renderer.spectatingId = "p2";
  ui.render();
  assert.equal(element("spectator-player").value, "p2");
  assert.equal(renderer.camera(s).y, 0);
  s.players[2].connected = false;
  ui.render();
  assert.equal(renderer.spectatingId, "p1");
  s.players[0].lives = 1;
  ui.render();
  assert.equal(element("spectator-controls").hidden, true);
  assert.equal(renderer.spectatingId, null);
}
console.log(
  "PASS eliminated players see an unobscured map, choose a living teammate and leave spectator mode after revival",
);
