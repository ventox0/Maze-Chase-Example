import assert from "node:assert/strict";
import { LanLobby } from "../server/LanLobby.js";
import { LanWorld } from "../server/LanWorld.js";
import { LanClient } from "../src/lan/LanClient.js";
import { createLanMap } from "../src/gameplay/lan-map.js";
import {
  LAN_MAP_OPTIONS,
  lanBalance,
  normalizeAppearance,
} from "../src/data/lan-options.js";
import { LAN_SPAWNS } from "../src/data/lan.js";
import { createDevServer } from "../scripts/dev-server.mjs";

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 4000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (fn()) return;
    await wait(10);
  }
  assert.fail("Timed out");
}
function world(count = 2, mode = "coop") {
  const w = new LanWorld(mode);
  for (let i = 0; i < count; i++) {
    const p = w.addPlayer("p" + i, "Pac " + i, i);
    p.connected = true;
  }
  w.start();
  w.update(3);
  return w;
}
{
  const players = [
    { id: "a", connected: true, ready: true },
    { id: "b", connected: true, ready: true },
    { id: "c", connected: false },
  ];
  const lobby = new LanLobby("coop");
  assert.ok(lobby.vote(players[0], { mode: "race", map: "rings" }));
  assert.equal(players[0].ready, false);
  lobby.vote(players[1], { mode: "coop", map: "crossroads" });
  lobby.vote(players[2], { mode: "race", map: "streets" });
  assert.equal(lobby.resolve(players, "a").mode, "race");
  assert.equal(lobby.resolve(players, "a").map, "rings");
  assert.equal(lobby.resolve(players, "b").mode, "coop");
  assert.equal(lobby.vote(players[0], { mode: "hack", map: "rings" }), false);
  assert.deepEqual(
    normalizeAppearance({ outfit: "cyber_armor", head: "crown" }),
    { outfit: "cyber_armor", head: null },
  );
  assert.deepEqual(
    normalizeAppearance({ outfit: "https://evil.test", head: "__proto__" }),
    { outfit: null, head: null },
  );
}
console.log(
  "PASS votes: deterministic host tie-break, connected voters only, readiness reset and safe catalog appearance IDs",
);
{
  const centralPositions = new Set();
  for (const option of LAN_MAP_OPTIONS)
    for (let level = 1; level <= 24; level++) {
      const grid = createLanMap(level, level * 123, {
        mode: "race",
        map: option.id,
      });
      assert.equal(grid.flat().filter((v) => v === 3).length, 5);
      grid.forEach((row, y) =>
        row.forEach((v, x) => {
          const terrain = (cell) => (cell === 3 ? 2 : cell);
          assert.equal(terrain(v), terrain(grid[y][40 - x]));
          assert.equal(terrain(v), terrain(grid[34 - y][x]));
          if (v === 3 && Math.abs(x - 20) <= 2 && Math.abs(y - 17) <= 2)
            centralPositions.add(`${x},${y}`);
        }),
      );
      function distances(start) {
        const seen = new Map(),
          q = [[start.col, start.row, 0]];
        for (let i = 0; i < q.length; i++) {
          const [x, y, d] = q[i],
            key = y * 41 + x;
          if (seen.has(key) || grid[y]?.[x] === undefined || grid[y][x] === 1)
            continue;
          seen.set(key, d);
          q.push(
            [x + 1, y, d + 1],
            [x - 1, y, d + 1],
            [x, y + 1, d + 1],
            [x, y - 1, d + 1],
          );
        }
        return seen;
      }
      const ds = LAN_SPAWNS.map(distances);
      assert.equal(ds[0].size, grid.flat().filter((v) => v !== 1).length);
      assert.equal(new Set(ds.map((d) => d.get(17 * 41 + 20))).size, 1);
      const opportunities = ds.map(
        (d) =>
          [...d].filter(
            ([key, dist]) =>
              dist <= 12 &&
              [2, 3].includes(grid[Math.floor(key / 41)][key % 41]),
          ).length,
      );
      assert.equal(new Set(opportunities).size, 1);
    }
  assert.ok(centralPositions.size > 8);
}
console.log(
  "PASS 72 race maps: mirrored roads and food opportunities, equal centre distance, four symmetric powers and a randomized shared central power",
);
{
  const profiles = [2, 3, 4].map((n) => world(n));
  assert.deepEqual(
    profiles.map((w) => Math.round(w.balance.ghostSpeed * 100)),
    [90, 100, 110],
  );
  for (const w of profiles) {
    assert.equal(w.ghosts.entities.length, 6);
    assert.equal(w.balance.players, w.players.size);
    const p = w.players.get("p0");
    p.lives = 0;
    assert.equal(w.balance.players, w.players.size);
    assert.deepEqual(lanBalance(w.players.size), w.balance);
  }
  const w = world(),
    p = w.players.get("p0");
  const smallY = w.maze.grid.findIndex((r) => r.includes(2)),
    smallX = w.maze.grid[smallY].indexOf(2);
  w.collect(p, smallX, smallY);
  w.collect(p, smallX, smallY);
  const powerY = w.maze.grid.findIndex((r) => r.includes(3));
  w.collect(p, w.maze.grid[powerY].indexOf(3), powerY);
  assert.equal(p.stats.pellets, 1);
  assert.equal(p.stats.powerPellets, 1);
  const g = w.ghosts.entities[0];
  g.releaseAt = 0;
  g.immuneUntil = 0;
  Object.assign(p.entity, { col: g.col, row: g.row, progress: 0 });
  w.collisions([p]);
  assert.equal(p.stats.ghosts, 1);
  w.powerUntil = 0;
  g.releaseAt = 0;
  g.immuneUntil = 0;
  p.invulnerableUntil = 0;
  Object.assign(p.entity, { col: g.col, row: g.row, progress: 0 });
  w.collisions([p]);
  assert.equal(p.stats.deaths, 1);
  w.gameTime = p.respawnUntil + 1;
  w.useAbility(p, "e");
  w.useAbility(p, "e");
  assert.equal(p.stats.abilities, 1);
  assert.equal(w.snapshot().players[0].stats.ghosts, 1);
  w.level++;
  w.loadRound();
  assert.equal(p.stats.pellets, 1);
  w.start();
  assert.equal(p.stats.pellets, 0);
}
console.log(
  "PASS 2/3/4-player balance keeps six ghosts; match stats count real actions once, survive rounds and reset on rematch",
);

const server = createDevServer(undefined, { lan: true });
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = "http://127.0.0.1:" + server.address().port;
const clients = [];
try {
  let loseAck = true,
    eventConnections = 0;
  const transport = async (path, options) => {
    const response = await fetch(origin + path, options);
    if (
      path.includes("/action") &&
      loseAck &&
      JSON.parse(options.body).type === "ready"
    ) {
      loseAck = false;
      await response.json();
      throw new TypeError("simulated lost acknowledgement");
    }
    if (!path.includes("/events")) return response;
    eventConnections++;
    const reader = response.body.getReader(),
      decoder = new TextDecoder(),
      encoder = new TextEncoder();
    let buffer = "",
      events = 0;
    const stream = new ReadableStream({
      async pull(controller) {
        try {
          while (true) {
            const chunk = await reader.read();
            if (chunk.done) {
              controller.close();
              return;
            }
            buffer += decoder.decode(chunk.value, { stream: true });
            let i;
            const outgoing = [];
            while ((i = buffer.indexOf("\n\n")) >= 0) {
              const event = buffer.slice(0, i + 2);
              buffer = buffer.slice(i + 2);
              events++;
              if (events % 3) outgoing.push(event); // Eksik snapshot; TCP paketlerinin kendisi değiştirilmez.
            }
            if (!outgoing.length) continue;
            await wait(70 + (events % 2) * 30); // gecikme ve jitter
            controller.enqueue(encoder.encode(outgoing.join("")));
            return;
          }
        } catch (error) {
          try {
            controller.error(error);
          } catch {}
        }
      },
      cancel() {
        return reader.cancel().catch(() => {});
      },
    });
    return new Response(stream, { status: response.status });
  };
  const states = [],
    statuses = [],
    metrics = [];
  const a = new LanClient(
    (s) => states.push(s),
    (s) => statuses.push(s),
    (m) => metrics.push(m),
    { fetch: transport, retryMs: 20 },
  );
  const b = new LanClient(
    () => {},
    () => {},
    () => {},
    { fetch: (path, options) => fetch(origin + path, options) },
  );
  b.onMetrics = () => {};
  clients.push(a, b);
  const owner = await a.enter("create", {
    name: "Host",
    mode: "coop",
    appearance: { outfit: "cyber_armor", head: "crown" },
  });
  await b.enter("join", { name: "Guest", room: owner.room });
  await until(() => a.connected && b.connected);
  const room = server.lanService.rooms.get(owner.room);
  assert.equal(room.world.players.get(owner.id).appearance.head, null);
  await a.action("vote", { mode: "race", map: "rings" });
  await b.action("vote", { mode: "race", map: "rings" });
  await a.action("ready"); // işlenen istek, kaybolan yanıt, aynı seq ile tekrar
  assert.equal(room.world.players.get(owner.id).ready, true);
  assert.equal(loseAck, false);
  await b.action("ready");
  await a.action("start");
  assert.equal(room.world.mode, "race");
  assert.equal(room.world.mapChoice, "rings");
  await a.action("vote", { mode: "coop", map: "streets" }).then(
    () => assert.fail("live vote accepted"),
    (e) => assert.equal(e.message, "alreadyStarted"),
  );
  await a.action("direction", {
    dir: "left",
    score: 999999,
    walletRewards: [{ points: 999999 }],
  });
  assert.equal(room.world.players.get(owner.id).score, 0);
  assert.equal(room.world.players.get(owner.id).walletRewards.length, 0);
  await a.measurePing(a.generation, a.controller.signal);
  assert.ok(Number.isFinite(a.ping));
  const last = states.at(-1);
  assert.equal(a.receive({ ...last, revision: last.revision - 1 }), false);
  assert.equal(a.receive(last), false);
  room.members.get(owner.id).stream.end();
  await until(
    () =>
      statuses.includes("reconnecting") && eventConnections >= 2 && a.connected,
  );
  assert.equal(a.session.id, owner.id);
  assert.equal(a.session.token, owner.token);
  assert.ok(states.every((s, i) => !i || s.revision > states[i - 1].revision));
  assert.ok(metrics.some((m) => m.reconnectRemaining === 30));
  console.log(
    "PASS real HTTP with latency/jitter and skipped snapshots: votes, lost-ACK idempotence, spoof rejection, ping, ordered state and same-session reconnect",
  );
} finally {
  clients.forEach((c) => c.stop());
  server.lanService.close();
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
}
{
  let streams = 0;
  const client = new LanClient(
    () => {},
    () => {},
    () => {},
    {
      staleMs: 30,
      retryMs: 10,
      fetch: async (path, { signal }) => {
        streams++;
        return new Response(
          new ReadableStream({
            start(c) {
              signal.addEventListener(
                "abort",
                () => c.error(new Error("aborted")),
                { once: true },
              );
            },
          }),
        );
      },
    },
  );
  client.session = { room: "ABCDEF", id: "test", token: "test" };
  client.connect();
  await until(() => streams >= 2, 1000);
  assert.equal(client.connected, false);
  client.stop();
  const received = [];
  const fake = new LanClient(
    () => {},
    () => {},
    () => {},
    {
      fetch: async (path, options) => {
        received.push(JSON.parse(options.body));
        return new Response('{"ok":true}');
      },
    },
  );
  fake.session = { room: "ABCDEF", id: "test", token: "test" };
  fake.connected = true;
  await Promise.all([
    fake.action("direction", { dir: "up" }),
    fake.action("direction", { dir: "left" }),
    fake.action("direction", { dir: "right" }),
  ]);
  assert.equal(received.length, 1);
  assert.equal(received[0].dir, "right");
}
console.log(
  "PASS silent streams hit watchdog and retry; stale queued directions collapse to the latest intention",
);
{
  let clock = 1000;
  const statuses = [];
  const client = new LanClient(
    () => {},
    (s) => statuses.push(s),
    () => {},
    {
      now: () => clock,
      retryMs: 5,
      fetch: async () => {
        throw new TypeError("network down");
      },
    },
  );
  client.session = { room: "ABCDEF", id: "test", token: "test" };
  client.connect();
  await until(() => statuses.includes("reconnecting"));
  clock += 31000;
  await until(() => statuses.includes("sessionExpired"));
  assert.equal(client.session, null);
  assert.equal(client.controller, null);
  assert.equal(client.connected, false);
  let reported;
  const quality = new LanClient(
    () => {},
    () => {},
    (m) => (reported = m),
    { now: () => clock },
  );
  quality.connected = true;
  quality.lastSnapshot = clock;
  quality.ping = 300;
  quality.metrics();
  assert.equal(reported.quality, "slow");
  quality.ping = 10;
  quality.metrics();
  assert.equal(reported.quality, "good");
  clock += 1300;
  quality.metrics();
  assert.equal(reported.quality, "slow");
  const sent = [];
  const queue = new LanClient(
    () => {},
    () => {},
    () => {},
    {
      now: () => clock,
      fetch: async (path, o) => {
        sent.push(JSON.parse(o.body));
        return new Response('{"ok":true}');
      },
    },
  );
  queue.session = { room: "ABCDEF", id: "test", token: "test" };
  queue.connected = true;
  let release;
  queue.commandQueue = new Promise((r) => {
    release = r;
  });
  const ability = queue.action("ability", { slot: "q" });
  clock += 1001;
  release();
  await ability;
  assert.equal(sent.length, 0);
}
console.log(
  "PASS expired reconnect sessions are released; quality reflects ping/staleness and obsolete ability inputs are dropped",
);
{
  for (const count of [2, 3, 4]) {
    const w = world(count),
      g = w.ghosts.entities[0];
    g.releaseAt = 0;
    let moved;
    w.movement.move = (entity, distance) => {
      if (entity === g) moved = distance;
    };
    const base = w.ghosts.ghostSpeed(g);
    w.updateGhosts(1 / 120, w.activePlayers());
    assert.ok(Math.abs(moved - (base * w.balance.ghostSpeed) / 120) < 1e-8);
    w.powerUntil = 10;
    w.gameTime = 1;
    assert.ok(Math.abs(w.ghosts.ghostSpeed(g) / base - 0.7) < 1e-8);
  }
}
console.log(
  "PASS player-count balance changes actual ghost movement; frightened speed keeps its 30% reduction",
);
